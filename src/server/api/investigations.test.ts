import type { MiddlewareHandler } from "hono";
import { describe, expect, it, vi } from "vite-plus/test";
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
      updateFromState: vi.fn(),
      appendEvidence: vi.fn(),
      appendToolCalls: vi.fn(),
      complete: vi.fn(),
      fail: vi.fn(),
    };
    const manager = new InvestigationRunManager(async (_input, emit) => {
      emit({ type: "step", step: "collectBaseline", status: "collecting_baseline" });
      emit({ type: "step", step: "synthesize", status: "completed" });
      emit({ type: "completed", result: { driver: "UNCLEAR" } });
    });
    const allowRequest: MiddlewareHandler = async (_context, next) => next();
    const app = createInvestigationRoutes({
      store,
      manager,
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

  it("rejects malformed ticker before creating an investigation", async () => {
    const create = vi.fn();
    const store: InvestigationStore = {
      create,
      findPrevious: vi.fn(),
      getDetail: vi.fn(),
      updateFromState: vi.fn(),
      appendEvidence: vi.fn(),
      appendToolCalls: vi.fn(),
      complete: vi.fn(),
      fail: vi.fn(),
    };
    const app = createInvestigationRoutes({
      store,
      manager: new InvestigationRunManager(async () => undefined),
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
});
