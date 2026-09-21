import { Hono, type Context, type MiddlewareHandler } from "hono";
import { streamSSE } from "hono/streaming";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  ConversationRequestSchema,
  InvestigationRequestSchema,
} from "../../shared/schemas/investigation.ts";
import type {
  InvestigationConversationInput,
  InvestigationConversationResult,
} from "../agents/stock-investigator/conversation.ts";
import type {
  InvestigationEvent,
  InvestigationEventEmitter,
  InvestigationRunInput,
} from "../agents/stock-investigator/runner.ts";
import type { InvestigationDetail, InvestigationStore } from "../db/investigations.ts";

export type InvestigationRouteEnv = {};

/** Query params shared by the list endpoints. */
export const PaginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type Pagination = z.infer<typeof PaginationSchema>;

export type InvestigationRouteDependencies = {
  readonly store: InvestigationStore;
  readonly manager: InvestigationRunManager;
  readonly conversation: (
    input: InvestigationConversationInput,
  ) => Promise<InvestigationConversationResult>;
  readonly authMiddleware: MiddlewareHandler;
  readonly resolveUserId: (context: Context) => string;
  /** Returns `null` when Sectors has no record for the ticker. */
  readonly verifyTicker?: (
    ticker: string,
    signal?: AbortSignal,
  ) => Promise<{ companyName: string } | null>;
};

export function createInvestigationRoutes(dependencies: InvestigationRouteDependencies): Hono {
  const routes = new Hono();

  routes.use("*", dependencies.authMiddleware);

  routes.get("/", async (context) => {
    const pagination = PaginationSchema.safeParse({
      limit: context.req.query("limit"),
      offset: context.req.query("offset"),
    });
    if (!pagination.success) {
      return context.json(
        { error: "Invalid pagination", details: pagination.error.flatten() },
        400,
      );
    }

    const userId = dependencies.resolveUserId(context);
    const { limit, offset } = pagination.data;
    const rows = await dependencies.store.list(userId, { limit: limit + 1, offset });
    const hasMore = rows.length > limit;
    return context.json({
      investigations: hasMore ? rows.slice(0, limit) : rows,
      pagination: { limit, offset, hasMore },
    });
  });

  routes.post("/", async (context) => {
    const body = await readJson(context);
    const parsed = InvestigationRequestSchema.safeParse(body);
    if (!parsed.success) {
      return context.json(
        { error: "Invalid investigation request", details: parsed.error.flatten() },
        400,
      );
    }

    const userId = dependencies.resolveUserId(context);
    const ticker = parsed.data.ticker;

    if (dependencies.verifyTicker) {
      let known: { companyName: string } | null;
      try {
        known = await dependencies.verifyTicker(ticker, context.req.raw.signal);
      } catch (error) {
        return context.json(
          { error: "Could not verify ticker with Sectors", message: errorMessage(error) },
          502,
        );
      }
      if (!known) {
        return context.json({ error: `Sectors has no stock record for ${ticker}` }, 404);
      }
    }

    const previousInvestigation = await dependencies.store.findPrevious(userId, ticker);
    const created = await dependencies.store.create({
      userId,
      ticker,
      question: parsed.data.question,
      previousInvestigationId: previousInvestigation?.id,
    });

    try {
      dependencies.manager.start({
        investigationId: created.id,
        userId,
        ticker,
        question: parsed.data.question,
        previousInvestigation,
      });
    } catch (error) {
      if (error instanceof TooManyRunsError) {
        await dependencies.store.fail(created.id, error.message);
        return context.json({ error: error.message }, 429);
      }
      await dependencies.store.fail(created.id, errorMessage(error));
      throw error;
    }

    return context.json({ id: created.id, status: "pending" }, 202);
  });

  routes.post("/:id/chat", async (context) => {
    const body = await readJson(context);
    const parsed = ConversationRequestSchema.safeParse(body);
    if (!parsed.success) {
      return context.json(
        { error: "Invalid conversation request", details: parsed.error.flatten() },
        400,
      );
    }

    const investigation = await dependencies.store.getDetail(
      dependencies.resolveUserId(context),
      context.req.param("id"),
    );
    if (!investigation) return context.json({ error: "Investigation not found" }, 404);
    if (investigation.status !== "completed") {
      return context.json({ error: "Investigation is not complete" }, 409);
    }

    try {
      const result = await dependencies.conversation({
        investigation,
        message: parsed.data.message,
        signal: context.req.raw.signal,
      });
      return context.json(result);
    } catch (error) {
      if (context.req.raw.signal.aborted) return new Response(null, { status: 499 });
      return context.json({ error: "Conversation failed", message: errorMessage(error) }, 502);
    }
  });

  routes.get("/:id/events", async (context) => {
    const userId = dependencies.resolveUserId(context);
    const investigation = await dependencies.store.getDetail(userId, context.req.param("id"));
    if (!investigation) return context.json({ error: "Investigation not found" }, 404);

    if (!dependencies.manager.has(investigation.id)) {
      return streamSSE(context, async (stream) => {
        await stream.writeSSE({
          event: "snapshot",
          id: randomUUID(),
          data: JSON.stringify({
            type: "snapshot",
            status: investigation.status,
            statusLabel: investigation.statusLabel ?? null,
            result:
              investigation.status === "completed" ? investigationResult(investigation) : null,
            error: investigation.errorMessage ?? null,
          }),
        });
      });
    }

    return streamSSE(context, async (stream) => {
      let closed = false;
      context.req.raw.signal.addEventListener("abort", () => {
        closed = true;
      });

      const heartbeat = setInterval(() => {
        if (!closed) void stream.writeSSE({ event: "heartbeat", data: "{}" });
      }, 15_000);

      try {
        for await (const event of dependencies.manager.subscribe(
          investigation.id,
          context.req.raw.signal,
        )) {
          if (closed) break;
          await stream.writeSSE({
            event: event.type,
            id: event.id,
            data: JSON.stringify(event),
          });
        }
      } catch (error) {
        if (!context.req.raw.signal.aborted) {
          await stream.writeSSE({
            event: "error",
            id: randomUUID(),
            data: JSON.stringify({ type: "error", message: errorMessage(error) }),
          });
        }
      } finally {
        clearInterval(heartbeat);
      }
    });
  });

  routes.get("/:id", async (context) => {
    const investigation = await dependencies.store.getDetail(
      dependencies.resolveUserId(context),
      context.req.param("id"),
    );
    if (!investigation) return context.json({ error: "Investigation not found" }, 404);
    return context.json(investigation);
  });

  routes.get("/:id/path", async (context) => {
    const investigation = await dependencies.store.getDetail(
      dependencies.resolveUserId(context),
      context.req.param("id"),
    );
    if (!investigation) return context.json({ error: "Investigation not found" }, 404);

    const plan = investigation.plan;
    return context.json({
      id: investigation.id,
      ticker: investigation.ticker,
      status: investigation.status,
      statusLabel: investigation.statusLabel ?? null,
      hypotheses: plan?.hypotheses ?? [],
      steps: (investigation.toolCalls ?? []).map((call) => ({
        tool: call.toolName,
        reason: call.reason ?? null,
        status: call.status,
        durationMs: call.durationMs ?? null,
        errorCode: call.errorCode ?? null,
        evidence: (investigation.evidence ?? [])
          .filter((item) => item.type === EVIDENCE_TYPE_BY_TOOL[call.toolName])
          .map((item) => item.summary),
      })),
      evidenceCategories: [...new Set((investigation.evidence ?? []).map((item) => item.type))],
    });
  });

  return routes;
}

export class InvestigationRunManager {
  private readonly runs = new Map<string, InvestigationRun>();
  private readonly execute: InvestigationExecutor;
  private readonly maxConcurrentPerUser: number;
  private readonly runningByUser = new Map<string, number>();
  private readonly finishedRetentionMs: number;

  constructor(
    execute: InvestigationExecutor,
    options: { maxConcurrentPerUser?: number; finishedRetentionMs?: number } = {},
  ) {
    this.execute = execute;
    this.maxConcurrentPerUser = options.maxConcurrentPerUser ?? 3;
    this.finishedRetentionMs = options.finishedRetentionMs ?? 5 * 60_000;
  }

  start(input: InvestigationRunInput): void {
    if (this.runs.has(input.investigationId)) {
      throw new Error(`Investigation is already running: ${input.investigationId}`);
    }

    const active = this.runningByUser.get(input.userId) ?? 0;
    if (active >= this.maxConcurrentPerUser) {
      throw new TooManyRunsError(
        `Already running ${active} investigations. Wait for one to finish before starting another.`,
      );
    }

    const run: InvestigationRun = { events: [], waiters: new Set(), done: false };
    this.runs.set(input.investigationId, run);
    this.runningByUser.set(input.userId, active + 1);

    const emit: InvestigationEventEmitter = (event) => this.publish(input.investigationId, event);
    void this.execute(input, emit)
      .catch((error: unknown) => {
        this.publish(input.investigationId, {
          type: "error",
          message: errorMessage(error),
        });
      })
      .finally(() => {
        this.runningByUser.set(
          input.userId,
          Math.max(0, (this.runningByUser.get(input.userId) ?? 1) - 1),
        );
        setTimeout(() => {
          const finished = this.runs.get(input.investigationId);
          if (finished?.done) this.runs.delete(input.investigationId);
        }, this.finishedRetentionMs).unref();
      });
  }

  /** `true` while the run is in memory, including the post-completion retention window. */
  has(investigationId: string): boolean {
    return this.runs.has(investigationId);
  }

  async *subscribe(
    investigationId: string,
    signal?: AbortSignal,
  ): AsyncGenerator<InvestigationEvent> {
    const run = this.runs.get(investigationId);
    if (!run) throw new Error(`Investigation run is not available: ${investigationId}`);

    let offset = 0;
    while (true) {
      if (signal?.aborted) return;
      if (offset < run.events.length) {
        const event = run.events[offset];
        offset += 1;
        yield event;
        if (isTerminalEvent(event)) return;
        continue;
      }
      if (run.done) return;
      await waitForRun(run, signal);
    }
  }

  private publish(investigationId: string, event: InvestigationEvent): void {
    const run = this.runs.get(investigationId);
    if (!run) return;
    const storedEvent = { ...event, id: event.id ?? randomUUID() } as InvestigationEvent;
    run.events.push(storedEvent);
    if (isTerminalEvent(storedEvent)) run.done = true;
    for (const waiter of run.waiters) waiter();
    run.waiters.clear();
  }
}

type InvestigationExecutor = (
  input: InvestigationRunInput,
  emit: InvestigationEventEmitter,
) => Promise<void>;

/** Raised when one user already has the maximum number of investigations running. */
export class TooManyRunsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TooManyRunsError";
  }
}

/**
 * Each semantic tool emits exactly one evidence category, so the investigation
 * path can attribute stored evidence back to the step that produced it.
 */
const EVIDENCE_TYPE_BY_TOOL: Record<string, string> = {
  get_price_context: "price_volume",
  get_market_context: "market",
  get_company_context: "company",
  get_sector_context: "sector",
  get_foreign_flow: "foreign_flow",
  get_broker_activity: "broker",
  get_company_news: "news",
  get_company_filings: "filing",
};

type InvestigationRun = {
  readonly events: InvestigationEvent[];
  readonly waiters: Set<() => void>;
  done: boolean;
};

async function waitForRun(run: InvestigationRun, signal?: AbortSignal): Promise<void> {
  await new Promise<void>((resolve) => {
    const wake = () => {
      cleanup();
      resolve();
    };
    const cleanup = () => {
      run.waiters.delete(wake);
      signal?.removeEventListener("abort", wake);
    };
    run.waiters.add(wake);
    signal?.addEventListener("abort", wake, { once: true });
    if (run.done || signal?.aborted) wake();
  });
}

function isTerminalEvent(event: InvestigationEvent): boolean {
  return event.type === "completed" || event.type === "error";
}

/**
 * Reshapes a persisted investigation back into the result payload the SSE
 * `completed` event carries, so a late subscriber sees the same shape.
 */
function investigationResult(investigation: InvestigationDetail): Record<string, unknown> {
  return {
    driver: investigation.driver ?? null,
    classification: investigation.classification ?? null,
    status: investigation.statusLabel ?? null,
    confidence: investigation.confidence ?? null,
    confidenceReason: investigation.confidenceReason ?? null,
    whatChanged: investigation.whatChanged ?? null,
    whyItMatters: investigation.whyItMatters ?? null,
    explanation: investigation.explanation ?? null,
    whatToMonitor: investigation.whatToMonitorJson ?? [],
    evidenceSummary: investigation.evidenceSummaryJson ?? [],
    changesSincePrevious: investigation.changesSincePrevious ?? null,
    disclaimer: investigation.disclaimer ?? null,
  };
}

export async function readJson(context: Context): Promise<unknown> {
  try {
    return await context.req.json();
  } catch {
    return undefined;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export type { InvestigationStore };
