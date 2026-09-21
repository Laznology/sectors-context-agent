/**
 * PRD §32: every investigation logs its lifecycle so a demo or an incident can
 * be reconstructed from server logs alone.
 *
 * Deliberately plain `console` JSON lines: no logging dependency for a hackathon
 * MVP, and one line per event stays greppable. Swap for a real logger when logs
 * need shipping or levels.
 */
export type InvestigationLogEvent =
  | { readonly type: "started"; readonly investigationId: string; readonly ticker: string }
  | {
      readonly type: "step";
      readonly investigationId: string;
      readonly step: string;
      readonly status: string;
    }
  | {
      readonly type: "tool";
      readonly investigationId: string;
      readonly toolName: string;
      readonly status: string;
      readonly durationMs?: number;
      readonly errorCode?: string;
    }
  | {
      readonly type: "completed";
      readonly investigationId: string;
      readonly driver: string;
      readonly statusLabel: string;
      readonly durationMs: number;
    }
  | {
      readonly type: "failed";
      readonly investigationId: string;
      readonly message: string;
      readonly durationMs: number;
    };

const startedAtByInvestigation = new Map<string, number>();

export function logInvestigation(event: InvestigationLogEvent): void {
  if (process.env.INVESTIGATION_LOG === "off") return;
  // Test output stays readable; the behaviour is asserted through the events instead.
  if (process.env.NODE_ENV === "test" || process.env.VITEST === "true") return;

  const now = Date.now();
  if (event.type === "started") startedAtByInvestigation.set(event.investigationId, now);

  const startedAt = startedAtByInvestigation.get(event.investigationId);
  const durationMs =
    event.type === "completed" || event.type === "failed"
      ? event.durationMs
      : startedAt === undefined
        ? undefined
        : now - startedAt;

  if (event.type === "completed" || event.type === "failed") {
    startedAtByInvestigation.delete(event.investigationId);
  }

  console.log(
    JSON.stringify({
      scope: "investigation",
      at: new Date(now).toISOString(),
      durationMs,
      ...event,
    }),
  );
}
