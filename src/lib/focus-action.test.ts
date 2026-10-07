import { describe, expect, it } from "vite-plus/test";
import { parseInvestigationSearch, resolveFocusAction } from "./focus-action.ts";

describe("resolveFocusAction", () => {
  it("opens the report chat when a question is typed, whatever the card says", () => {
    expect(
      resolveFocusAction({
        ticker: "ANTM",
        question: "Apa yang terjadi?",
        primaryAction: "OPEN_REPORT",
      }),
    ).toEqual({ type: "OPEN_CHAT", ticker: "ANTM", question: "Apa yang terjadi?" });
    expect(
      resolveFocusAction({ ticker: "ANTM", question: "  Kenapa naik?  ", primaryAction: "UPDATE" }),
    ).toEqual({ type: "OPEN_CHAT", ticker: "ANTM", question: "Kenapa naik?" });
    expect(
      resolveFocusAction({
        ticker: "ANTM",
        question: "Mengapa turun?",
        primaryAction: "INVESTIGATE",
      }),
    ).toEqual({ type: "OPEN_CHAT", ticker: "ANTM", question: "Mengapa turun?" });
  });

  it("treats a whitespace-only question as no question", () => {
    expect(
      resolveFocusAction({ ticker: "ANTM", question: "   ", primaryAction: "OPEN_REPORT" }),
    ).toEqual({
      type: "OPEN_REPORT",
      ticker: "ANTM",
    });
  });

  it("opens the existing report when no question and the report is fresh", () => {
    expect(
      resolveFocusAction({ ticker: "ANTM", question: "", primaryAction: "OPEN_REPORT" }),
    ).toEqual({
      type: "OPEN_REPORT",
      ticker: "ANTM",
    });
  });

  it("starts an update run when no question and data is stale", () => {
    expect(resolveFocusAction({ ticker: "ANTM", question: "", primaryAction: "UPDATE" })).toEqual({
      type: "UPDATE",
      ticker: "ANTM",
    });
  });

  it("starts a first investigation when no question and never run", () => {
    expect(
      resolveFocusAction({ ticker: "ANTM", question: "", primaryAction: "INVESTIGATE" }),
    ).toEqual({
      type: "INVESTIGATE",
      ticker: "ANTM",
    });
  });
});

describe("parseInvestigationSearch", () => {
  it("accepts all shapes the router can produce for ?chat=", () => {
    expect(parseInvestigationSearch({ chat: "1" }).chat).toBe(true);
    expect(parseInvestigationSearch({ chat: 1 }).chat).toBe(true);
    expect(parseInvestigationSearch({ chat: true }).chat).toBe(true);
    expect(parseInvestigationSearch({ chat: "true" }).chat).toBe(true);
    expect(parseInvestigationSearch({}).chat).toBe(undefined);
  });

  it("keeps a non-empty question, drops blank ones", () => {
    expect(parseInvestigationSearch({ q: "Apa yang terjadi?" }).q).toBe("Apa yang terjadi?");
    expect(parseInvestigationSearch({ q: "   " }).q).toBe(undefined);
    expect(parseInvestigationSearch({}).q).toBe(undefined);
  });
});
