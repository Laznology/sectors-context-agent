import { describe, expect, it } from "vite-plus/test";
import { hasNewerSession, latestAvailableSession } from "./session-freshness.ts";

describe("latestAvailableSession", () => {
  it("returns the same weekday once the end-of-day session is published", () => {
    const wednesday = new Date("2026-09-30T13:00:00Z");

    expect(latestAvailableSession(wednesday)).toBe("2026-09-30");
  });

  it("steps back a day before the session is published", () => {
    const wednesdayMorning = new Date("2026-09-30T03:00:00Z");

    expect(latestAvailableSession(wednesdayMorning)).toBe("2026-09-29");
  });

  it("steps back over the weekend to Friday", () => {
    const sunday = new Date("2026-10-04T05:00:00Z");

    expect(latestAvailableSession(sunday)).toBe("2026-10-02");
  });

  it("treats Saturday as the Friday session", () => {
    const saturday = new Date("2026-10-03T05:00:00Z");

    expect(latestAvailableSession(saturday)).toBe("2026-10-02");
  });

  it("steps back over the weekend from a Monday before publication", () => {
    const mondayMorning = new Date("2026-10-05T02:00:00Z");

    expect(latestAvailableSession(mondayMorning)).toBe("2026-10-02");
  });

  it("resolves the boundary at the publication hour in Jakarta time", () => {
    const justBefore = new Date("2026-09-30T10:59:00Z");
    const justAfter = new Date("2026-09-30T11:00:00Z");

    expect(latestAvailableSession(justBefore)).toBe("2026-09-29");
    expect(latestAvailableSession(justAfter)).toBe("2026-09-30");
  });
});

describe("hasNewerSession", () => {
  it("reports no newer session when the run is on the latest session", () => {
    expect(hasNewerSession("2026-09-30", "2026-09-30")).toBe(false);
  });

  it("reports a newer session when the run predates it", () => {
    expect(hasNewerSession("2026-09-29", "2026-09-30")).toBe(true);
  });

  it("reports no newer session when the run is ahead of the latest session", () => {
    expect(hasNewerSession("2026-10-01", "2026-09-30")).toBe(false);
  });

  it("reports no newer session when the run has no as-of date", () => {
    expect(hasNewerSession(null, "2026-09-30")).toBe(false);
  });
});
