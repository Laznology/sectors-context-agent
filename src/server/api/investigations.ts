import { Hono, type Context, type MiddlewareHandler } from "hono";
import { streamSSE } from "hono/streaming";
import { randomUUID } from "node:crypto";
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
import type { InvestigationStore } from "../db/investigations.ts";

export type InvestigationRouteEnv = {};

export type InvestigationRouteDependencies = {
  readonly store: InvestigationStore;
  readonly manager: InvestigationRunManager;
  readonly conversation: (
    input: InvestigationConversationInput,
  ) => Promise<InvestigationConversationResult>;
  readonly authMiddleware: MiddlewareHandler;
  readonly resolveUserId: (context: Context) => string;
};

export function createInvestigationRoutes(dependencies: InvestigationRouteDependencies): Hono {
  const routes = new Hono();

  routes.use("*", dependencies.authMiddleware);

  routes.get("/", async (context) => {
    const investigations = await dependencies.store.list(dependencies.resolveUserId(context));
    return context.json({ investigations });
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
    const previousInvestigation = await dependencies.store.findPrevious(userId, parsed.data.ticker);
    const created = await dependencies.store.create({
      userId,
      ticker: parsed.data.ticker,
      question: parsed.data.question,
      previousInvestigationId: previousInvestigation?.id,
    });
    dependencies.manager.start({
      investigationId: created.id,
      userId,
      ticker: parsed.data.ticker,
      question: parsed.data.question,
      previousInvestigation,
    });
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

    return streamSSE(context, async (stream) => {
      try {
        for await (const event of dependencies.manager.subscribe(
          investigation.id,
          context.req.raw.signal,
        )) {
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

  return routes;
}

export class InvestigationRunManager {
  private readonly runs = new Map<string, InvestigationRun>();
  private readonly execute: InvestigationExecutor;

  constructor(execute: InvestigationExecutor) {
    this.execute = execute;
  }
  start(input: InvestigationRunInput): void {
    if (this.runs.has(input.investigationId)) {
      throw new Error(`Investigation is already running: ${input.investigationId}`);
    }
    const run: InvestigationRun = { events: [], waiters: new Set(), done: false };
    this.runs.set(input.investigationId, run);
    const emit: InvestigationEventEmitter = (event) => this.publish(input.investigationId, event);
    void this.execute(input, emit).catch((error: unknown) => {
      this.publish(input.investigationId, {
        type: "error",
        message: errorMessage(error),
      });
    });
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
