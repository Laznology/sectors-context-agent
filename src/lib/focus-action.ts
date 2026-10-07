import type { PrimaryAction } from "./watchlist-view-model";

/** What picking a ticker from the palette should do, focus-box aware. */
export type FocusAction =
  | { readonly type: "OPEN_CHAT"; readonly ticker: string; readonly question: string }
  | { readonly type: "OPEN_REPORT"; readonly ticker: string }
  | { readonly type: "UPDATE"; readonly ticker: string }
  | { readonly type: "INVESTIGATE"; readonly ticker: string };

/**
 * Routes the dashboard focus box. A typed question always means "ask the
 * agent about this ticker" — open its report chat, never start a new run.
 * Without a question, follow the card's adaptive primary action.
 */
export function resolveFocusAction(input: {
  readonly ticker: string;
  readonly question: string;
  readonly primaryAction: PrimaryAction;
}): FocusAction {
  const question = input.question.trim();
  if (question) {
    return { type: "OPEN_CHAT", ticker: input.ticker, question };
  }
  if (input.primaryAction === "OPEN_REPORT") {
    return { type: "OPEN_REPORT", ticker: input.ticker };
  }
  if (input.primaryAction === "UPDATE") {
    return { type: "UPDATE", ticker: input.ticker };
  }
  return { type: "INVESTIGATE", ticker: input.ticker };
}

/** Search params for the investigation detail deep link. */
export interface InvestigationSearch {
  readonly chat?: boolean;
  readonly q?: string;
}

/**
 * Normalises `?chat=` / `?q=` from the URL. The router may deliver `chat` as
 * the string "1" or "true", the number 1, or the boolean true depending on
 * the parser, so accept all of them and emit a clean boolean.
 */
export function parseInvestigationSearch(search: Record<string, unknown>): InvestigationSearch {
  return {
    chat:
      search.chat === "1" || search.chat === 1 || search.chat === true || search.chat === "true"
        ? true
        : undefined,
    q: typeof search.q === "string" && search.q.trim() ? search.q : undefined,
  };
}
