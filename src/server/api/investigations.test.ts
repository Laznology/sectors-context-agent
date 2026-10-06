import type { MiddlewareHandler } from "hono";
import { describe, expect, it, vi } from "vite-plus/test";
import { parseUiBlocks } from "../../lib/conversation-view-model.ts";
import {
  createInvestigationRoutes,
  InvestigationRunManager,
  type InvestigationStore,
} from "./investigations.ts";

describe("investigation API", () => {
  it("accepts a ticker and streams ordered investigation events", async () => {
    const store: InvestigationStore = {
      create: vi.fn().mockResolvedValue({ id: "inv-1" }),
      findPrevious: vi.fn().mockResolvedValue(null),
      getDetail: vi.fn().mockResolvedValue({ id: "inv-1", status: "pending" }),
      list: vi.fn().mockResolvedValue([]),
      updateFromState: vi.fn(),
      appendEvidence: vi.fn(),
      appendToolCalls: vi.fn(),
      appendConversation: vi.fn(),
      complete: vi.fn(),
      fail: vi.fn(),
    };
    const manager = new InvestigationRunManager(async (_input, emit) => {
      emit({
        type: "step",
        step: "collectBaseline",
        status: "collecting_baseline",
        label: "Collecting price, market, and company context",
      });
      emit({
        type: "step",
        step: "synthesize",
        status: "completed",
        label: "Synthesizing the evidence-backed explanation",
      });
      emit({ type: "completed", result: { driver: "UNCLEAR" } });
    });
    const allowRequest: MiddlewareHandler = async (_context, next) => next();
    const app = createInvestigationRoutes({
      store,
      manager,
      conversation: vi.fn(),
      authMiddleware: allowRequest,
      resolveUserId: () => "user-1",
    });

    const created = await app.request("http://localhost/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker: " antm ", question: "Why did ANTM move?" }),
    });

    expect(created.status).toBe(202);
    expect(await created.json()).toEqual({ id: "inv-1", status: "pending" });

    const events = await app.request("http://localhost/inv-1/events");
    expect(events.status).toBe(200);
    expect(events.headers.get("content-type")).toContain("text/event-stream");
    const body = await events.text();
    expect(body.indexOf("event: step")).toBeGreaterThanOrEqual(0);
    expect(body.indexOf('"collectBaseline"')).toBeLessThan(body.indexOf('"synthesize"'));
    expect(body).toContain("event: completed");
  });

  it("runs a scoped follow-up conversation for a completed investigation", async () => {
    const conversation = vi.fn().mockResolvedValue({
      message: {
        id: "message-1",
        role: "assistant",
        content: "Foreign flow remains relevant.",
        createdAt: "2026-09-17T00:00:00.000Z",
      },
      toolCalls: [],
    });
    const store: InvestigationStore = {
      create: vi.fn(),
      findPrevious: vi.fn(),
      getDetail: vi.fn().mockResolvedValue({
        id: "inv-3",
        ticker: "ANTM",
        status: "completed",
        conversations: [],
        evidence: [],
        toolCalls: [],
      }),
      list: vi.fn(),
      updateFromState: vi.fn(),
      appendEvidence: vi.fn(),
      appendToolCalls: vi.fn(),
      appendConversation: vi.fn(),
      complete: vi.fn(),
      fail: vi.fn(),
    };
    const app = createInvestigationRoutes({
      store,
      manager: new InvestigationRunManager(async () => undefined),
      conversation,
      authMiddleware: (async (_context, next) => next()) satisfies MiddlewareHandler,
      resolveUserId: () => "user-1",
    });

    const response = await app.request("http://localhost/inv-3/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Apakah foreign flow berlanjut?" }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      message: { role: "assistant", content: "Foreign flow remains relevant." },
    });
    expect(conversation).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Apakah foreign flow berlanjut?" }),
    );
  });

  it("passes validated UI blocks through the chat response", async () => {
    const conversation = vi.fn().mockResolvedValue({
      message: {
        id: "m-1",
        role: "assistant",
        content: "Foreign flow remains relevant.",
        uiBlocks: [{ type: "metric", label: "Net inflow", value: "Rp 12,4 M" }],
        createdAt: "2026-10-04T00:00:00.000Z",
      },
      toolCalls: [],
    });
    const store = {
      create: vi.fn(),
      findPrevious: vi.fn(),
      getDetail: vi.fn().mockResolvedValue({
        id: "inv-3",
        ticker: "ANTM",
        status: "completed",
        conversations: [],
        evidence: [],
        toolCalls: [],
      }),
      list: vi.fn(),
      updateFromState: vi.fn(),
      appendEvidence: vi.fn(),
      appendToolCalls: vi.fn(),
      appendConversation: vi.fn(),
      complete: vi.fn(),
      fail: vi.fn(),
    };
    const app = createInvestigationRoutes({
      store,
      manager: new InvestigationRunManager(async () => undefined),
      conversation,
      authMiddleware: (async (_context, next) => next()) satisfies MiddlewareHandler,
      resolveUserId: () => "user-1",
    });

    const response = await app.request("http://localhost/inv-3/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Bagaimana foreign flow?" }),
    });
    const body = (await response.json()) as {
      message: { uiBlocks: Array<{ type: string }> };
    };

    expect(response.status).toBe(200);
    expect(parseUiBlocks(body.message.uiBlocks).map((block) => block.type)).toEqual(["metric"]);
  });

  it("lists investigations for the authenticated user", async () => {
    const list = vi.fn().mockResolvedValue([
      {
        id: "inv-2",
        ticker: "ANTM",
        status: "completed",
        classification: "bullish",
        driver: "FLOW_DRIVEN",
        confidence: 0.7,
        createdAt: "2026-09-19T00:00:00.000Z",
        completedAt: "2026-09-19T00:05:00.000Z",
      },
    ]);
    const store: InvestigationStore = {
      create: vi.fn(),
      findPrevious: vi.fn(),
      getDetail: vi.fn(),
      list,
      updateFromState: vi.fn(),
      appendEvidence: vi.fn(),
      appendToolCalls: vi.fn(),
      appendConversation: vi.fn(),
      complete: vi.fn(),
      fail: vi.fn(),
    };
    const app = createInvestigationRoutes({
      store,
      manager: new InvestigationRunManager(async () => undefined),
      conversation: vi.fn(),
      authMiddleware: (async (_context, next) => next()) satisfies MiddlewareHandler,
      resolveUserId: () => "user-1",
    });

    const response = await app.request("http://localhost/");

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      investigations: [{ id: "inv-2", ticker: "ANTM", status: "completed" }],
    });
    expect(list).toHaveBeenCalledWith("user-1", { limit: 51, offset: 0 });
  });

  it("honors limit and offset and reports whether more rows exist", async () => {
    const list = vi.fn().mockResolvedValue([
      { id: "inv-3", ticker: "BBCA", status: "completed", createdAt: "2026-09-20T00:00:00.000Z" },
      { id: "inv-2", ticker: "ANTM", status: "completed", createdAt: "2026-09-19T00:00:00.000Z" },
      { id: "inv-1", ticker: "TLKM", status: "completed", createdAt: "2026-09-18T00:00:00.000Z" },
    ]);
    const store: InvestigationStore = {
      create: vi.fn(),
      findPrevious: vi.fn(),
      getDetail: vi.fn(),
      list,
      updateFromState: vi.fn(),
      appendEvidence: vi.fn(),
      appendToolCalls: vi.fn(),
      appendConversation: vi.fn(),
      complete: vi.fn(),
      fail: vi.fn(),
    };
    const app = createInvestigationRoutes({
      store,
      manager: new InvestigationRunManager(async () => undefined),
      conversation: vi.fn(),
      authMiddleware: (async (_context, next) => next()) satisfies MiddlewareHandler,
      resolveUserId: () => "user-1",
    });

    const response = await app.request("http://localhost/?limit=2&offset=1");

    expect(list).toHaveBeenCalledWith("user-1", { limit: 3, offset: 1 });
    expect(await response.json()).toMatchObject({
      investigations: [{ id: "inv-3" }, { id: "inv-2" }],
      pagination: { limit: 2, offset: 1, hasMore: true },
    });
  });

  it("rejects a pagination request outside the allowed range", async () => {
    const list = vi.fn();
    const store: InvestigationStore = {
      create: vi.fn(),
      findPrevious: vi.fn(),
      getDetail: vi.fn(),
      list,
      updateFromState: vi.fn(),
      appendEvidence: vi.fn(),
      appendToolCalls: vi.fn(),
      appendConversation: vi.fn(),
      complete: vi.fn(),
      fail: vi.fn(),
    };
    const app = createInvestigationRoutes({
      store,
      manager: new InvestigationRunManager(async () => undefined),
      conversation: vi.fn(),
      authMiddleware: (async (_context, next) => next()) satisfies MiddlewareHandler,
      resolveUserId: () => "user-1",
    });

    const response = await app.request("http://localhost/?limit=5000");

    expect(response.status).toBe(400);
    expect(list).not.toHaveBeenCalled();
  });

  it("refuses to start more runs than the per-user cap and fails the row", async () => {
    const fail = vi.fn();
    const store: InvestigationStore = {
      create: vi
        .fn()
        .mockResolvedValueOnce({ id: "inv-first" })
        .mockResolvedValueOnce({ id: "inv-capped" }),
      findPrevious: vi.fn().mockResolvedValue(null),
      getDetail: vi.fn(),
      list: vi.fn(),
      updateFromState: vi.fn(),
      appendEvidence: vi.fn(),
      appendToolCalls: vi.fn(),
      appendConversation: vi.fn(),
      complete: vi.fn(),
      fail,
    };
    const neverSettles = new Promise<never>(() => {});
    const manager = new InvestigationRunManager(() => neverSettles, {
      maxConcurrentPerUser: 1,
    });
    const app = createInvestigationRoutes({
      store,
      manager,
      conversation: vi.fn(),
      authMiddleware: (async (_context, next) => next()) satisfies MiddlewareHandler,
      resolveUserId: () => "user-1",
    });

    const first = await app.request("http://localhost/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker: "ANTM" }),
    });
    const second = await app.request("http://localhost/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker: "BBCA" }),
    });

    expect(first.status).toBe(202);
    expect(second.status).toBe(429);
    expect(fail).toHaveBeenCalledWith("inv-capped", expect.stringContaining("Already running"));
  });

  it("replays a terminal snapshot for a run no longer in memory", async () => {
    const store: InvestigationStore = {
      create: vi.fn(),
      findPrevious: vi.fn(),
      getDetail: vi.fn().mockResolvedValue({
        id: "inv-old",
        ticker: "ANTM",
        status: "completed",
        statusLabel: "attention",
        driver: "FLOW_DRIVEN",
        explanation: "Foreign buying dominated.",
      }),
      list: vi.fn(),
      updateFromState: vi.fn(),
      appendEvidence: vi.fn(),
      appendToolCalls: vi.fn(),
      appendConversation: vi.fn(),
      complete: vi.fn(),
      fail: vi.fn(),
    };
    const app = createInvestigationRoutes({
      store,
      manager: new InvestigationRunManager(async () => undefined),
      conversation: vi.fn(),
      authMiddleware: (async (_context, next) => next()) satisfies MiddlewareHandler,
      resolveUserId: () => "user-1",
    });

    const response = await app.request("http://localhost/inv-old/events");
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain("event: snapshot");
    expect(body).toContain("FLOW_DRIVEN");
    expect(body).not.toContain("run is not available");
  });

  it("rejects malformed ticker before creating an investigation", async () => {
    const create = vi.fn();
    const store: InvestigationStore = {
      create,
      findPrevious: vi.fn(),
      getDetail: vi.fn(),
      list: vi.fn(),
      updateFromState: vi.fn(),
      appendEvidence: vi.fn(),
      appendToolCalls: vi.fn(),
      appendConversation: vi.fn(),
      complete: vi.fn(),
      fail: vi.fn(),
    };
    const app = createInvestigationRoutes({
      store,
      manager: new InvestigationRunManager(async () => undefined),
      conversation: vi.fn(),
      authMiddleware: (async (_context, next) => next()) satisfies MiddlewareHandler,
      resolveUserId: () => "user-1",
    });

    const response = await app.request("http://localhost/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker: "ABC" }),
    });

    expect(response.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects a well-formed ticker that Sectors does not know", async () => {
    const create = vi.fn();
    const store: InvestigationStore = {
      create,
      findPrevious: vi.fn(),
      getDetail: vi.fn(),
      list: vi.fn(),
      updateFromState: vi.fn(),
      appendEvidence: vi.fn(),
      appendToolCalls: vi.fn(),
      appendConversation: vi.fn(),
      complete: vi.fn(),
      fail: vi.fn(),
    };
    const app = createInvestigationRoutes({
      store,
      manager: new InvestigationRunManager(async () => undefined),
      conversation: vi.fn(),
      authMiddleware: (async (_context, next) => next()) satisfies MiddlewareHandler,
      resolveUserId: () => "user-1",
      verifyTicker: async () => null,
    });

    const response = await app.request("http://localhost/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker: "ZZZZ" }),
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining("ZZZZ") });
    expect(create).not.toHaveBeenCalled();
  });

  it("reports a Sectors outage as 502 instead of creating a doomed investigation", async () => {
    const create = vi.fn();
    const store: InvestigationStore = {
      create,
      findPrevious: vi.fn(),
      getDetail: vi.fn(),
      list: vi.fn(),
      updateFromState: vi.fn(),
      appendEvidence: vi.fn(),
      appendToolCalls: vi.fn(),
      appendConversation: vi.fn(),
      complete: vi.fn(),
      fail: vi.fn(),
    };
    const app = createInvestigationRoutes({
      store,
      manager: new InvestigationRunManager(async () => undefined),
      conversation: vi.fn(),
      authMiddleware: (async (_context, next) => next()) satisfies MiddlewareHandler,
      resolveUserId: () => "user-1",
      verifyTicker: async () => {
        throw new Error("Sectors API request failed");
      },
    });

    const response = await app.request("http://localhost/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker: "ANTM" }),
    });

    expect(response.status).toBe(502);
    expect(create).not.toHaveBeenCalled();
  });

  it("exposes the investigation path for audit", async () => {
    const store: InvestigationStore = {
      create: vi.fn(),
      findPrevious: vi.fn(),
      getDetail: vi.fn().mockResolvedValue({
        id: "inv-4",
        ticker: "ANTM",
        status: "completed",
        statusLabel: "attention",
        plan: {
          hypotheses: ["FLOW_DRIVEN"],
          steps: [{ id: "s1", intent: "Check flow", tool: "get_foreign_flow" }],
        },
        toolCalls: [
          {
            id: "c1",
            toolName: "get_foreign_flow",
            status: "succeeded",
            reason: "Check flow",
            durationMs: 120,
          },
          {
            id: "c2",
            toolName: "get_broker_activity",
            status: "skipped",
            reason: "Check brokers",
            errorCode: "ROUTING_BLOCKED",
          },
        ],
        evidence: [
          {
            id: "e1",
            type: "foreign_flow",
            source: "sectors:foreign-flow:ANTM",
            summary: "Net inflow strengthened.",
          },
        ],
      }),
      list: vi.fn(),
      updateFromState: vi.fn(),
      appendEvidence: vi.fn(),
      appendToolCalls: vi.fn(),
      appendConversation: vi.fn(),
      complete: vi.fn(),
      fail: vi.fn(),
    };
    const app = createInvestigationRoutes({
      store,
      manager: new InvestigationRunManager(async () => undefined),
      conversation: vi.fn(),
      authMiddleware: (async (_context, next) => next()) satisfies MiddlewareHandler,
      resolveUserId: () => "user-1",
    });

    const response = await app.request("http://localhost/inv-4/path");

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      hypotheses: ["FLOW_DRIVEN"],
      evidenceCategories: ["foreign_flow"],
      steps: [
        { tool: "get_foreign_flow", status: "succeeded", evidence: ["Net inflow strengthened."] },
        { tool: "get_broker_activity", status: "skipped", errorCode: "ROUTING_BLOCKED" },
      ],
    });
  });
});

it("keeps the server-owned run alive when the detail page disconnects", async () => {
  let finish!: () => void;
  const execute = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const manager = new InvestigationRunManager(execute, { finishedRetentionMs: 1 });
  const controller = new AbortController();

  manager.start({
    investigationId: "inv-detached",
    userId: "user-1",
    ticker: "ADRO",
    previousInvestigation: null,
  });

  const events = manager.subscribe("inv-detached", controller.signal);
  const pendingEvent = events.next();
  controller.abort();
  await pendingEvent;

  finish();
  await vi.waitFor(() => expect(execute).toHaveBeenCalledOnce());
  expect(manager.has("inv-detached")).toBe(true);
  await events.return?.(undefined);
});
