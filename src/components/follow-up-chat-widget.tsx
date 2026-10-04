/**
 * Floating follow-up chat on the dashboard (FE wiki #5, chatbot layout).
 *
 * Still scoped: the user picks one watchlist ticker whose latest investigation
 * has completed, and every message goes to that investigation's
 * POST /api/investigations/:id/chat. It is not a general financial chatbot
 * (INTENT.md non-goal).
 */
import { ChatPanel } from "@/components/chat-panel";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  toInvestigationData,
  type ConversationMessage,
  type InvestigationDetailResponse,
} from "@/lib/investigation-view-model";
import type { WatchlistItem } from "@/lib/watchlist-view-model";
import { Link } from "@tanstack/react-router";
import { LoaderCircle, MessageSquare, RefreshCw, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

type LoadedConversation =
  | { investigationId: string; messages: ConversationMessage[] }
  | { investigationId: string; error: string };

/** Investigation ids the user has already been nudged about, per browser. */
const SEEN_STORAGE_KEY = "sca:follow-up-seen";
const MAX_SEEN_IDS = 200;

function readSeenIds(): Set<string> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(SEEN_STORAGE_KEY) ?? "[]");
    return new Set(
      Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [],
    );
  } catch {
    return new Set();
  }
}

function writeSeenIds(ids: Set<string>): void {
  try {
    localStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify([...ids].slice(-MAX_SEEN_IDS)));
  } catch {
    // Storage can be unavailable (private mode, quota); the nudge just reappears.
  }
}

export function FollowUpChatWidget({ watchlist }: { watchlist: WatchlistItem[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<LoadedConversation | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [seenIds, setSeenIds] = useState<Set<string>>(readSeenIds);

  const launcherRef = useRef<HTMLButtonElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const panelId = useId();
  const titleId = useId();
  const selectId = useId();

  // Only completed investigations accept follow-ups.
  const eligible = watchlist.filter(
    (item) => item.investigationStatus === "COMPLETED" && item.investigationId,
  );
  const selected = eligible.find((item) => item.ticker === selectedTicker) ?? eligible[0] ?? null;
  const investigationId = selected?.investigationId ?? null;

  // Nudge about the most recently finished investigation the user has not
  // opened or dismissed yet. Only one nudge at a time.
  const nudge =
    eligible
      .filter((item) => item.investigationId && !seenIds.has(item.investigationId))
      .sort((a, b) => (b.lastInvestigatedAt ?? "").localeCompare(a.lastInvestigatedAt ?? ""))[0] ??
    null;

  function markAllSeen() {
    const next = new Set(seenIds);
    for (const item of eligible) {
      if (item.investigationId) next.add(item.investigationId);
    }
    setSeenIds(next);
    writeSeenIds(next);
  }

  function open(ticker?: string) {
    if (ticker) selectTicker(ticker);
    setIsOpen(true);
    markAllSeen();
  }

  useEffect(() => {
    if (!isOpen || !investigationId) return;
    const controller = new AbortController();

    void fetch(`/api/investigations/${encodeURIComponent(investigationId)}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Could not load the conversation (HTTP ${res.status})`);
        return toInvestigationData((await res.json()) as InvestigationDetailResponse);
      })
      .then((data) => setLoaded({ investigationId, messages: data.conversation }))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setLoaded({
          investigationId,
          error: err instanceof Error ? err.message : "Could not load the conversation.",
        });
      });

    return () => controller.abort();
  }, [isOpen, investigationId, reloadToken]);

  useEffect(() => {
    if (isOpen) closeRef.current?.focus();
  }, [isOpen]);

  function close() {
    setIsOpen(false);
    // Drop the cached history so reopening picks up turns sent from the
    // investigation detail page in the meantime.
    setLoaded(null);
    launcherRef.current?.focus();
  }

  function selectTicker(ticker: string) {
    setSelectedTicker(ticker);
    setLoaded(null);
  }

  function retry() {
    setLoaded(null);
    setReloadToken((token) => token + 1);
  }

  const current = loaded && loaded.investigationId === investigationId ? loaded : null;

  return (
    <div className="fixed right-4 bottom-4 z-50 flex flex-col items-end gap-3">
      {isOpen && (
        <div
          id={panelId}
          role="dialog"
          aria-labelledby={titleId}
          onKeyDown={(event) => {
            if (event.key === "Escape") close();
          }}
          className="bg-background border-border flex h-[min(36rem,calc(100dvh-6rem))] w-[min(24rem,calc(100vw-2rem))] flex-col gap-3 rounded-xl border p-4 shadow-2xl"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id={titleId} className="panel-title flex items-center gap-2">
                <MessageSquare className="size-4" aria-hidden />
                Follow-up Chat
              </h2>
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                Scoped to the latest investigation of the selected ticker. Not investment advice.
              </p>
            </div>
            <Button
              ref={closeRef}
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Close follow-up chat"
              onClick={close}
            >
              <X aria-hidden />
            </Button>
          </div>

          {eligible.length === 0 ? (
            <p className="text-muted-foreground text-xs leading-relaxed">
              No completed investigations in your watchlist yet. Run{" "}
              <strong className="text-foreground">Investigate</strong> on a ticker, then ask your
              follow-up here.
            </p>
          ) : (
            <>
              <div className="grid gap-1">
                <div className="flex items-baseline justify-between gap-2">
                  <Label htmlFor={selectId} className="text-xs font-medium">
                    Ticker
                  </Label>
                  {selected && (
                    <Link
                      to="/investigations/$ticker"
                      params={{ ticker: selected.ticker }}
                      className="text-signal-text text-[11px] underline-offset-4 hover:underline"
                    >
                      View report
                    </Link>
                  )}
                </div>
                <Select value={selected?.ticker ?? ""} onValueChange={selectTicker}>
                  <SelectTrigger id={selectId} aria-label="Select ticker">
                    <SelectValue placeholder="Select ticker" />
                  </SelectTrigger>
                  <SelectContent>
                    {eligible.map((item) => (
                      <SelectItem key={item.ticker} value={item.ticker}>
                        {item.ticker}
                        {item.companyName ? ` — ${item.companyName}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {!current ? (
                <p className="text-primary flex items-center gap-2 text-xs font-mono">
                  <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
                  Loading conversation…
                </p>
              ) : "error" in current ? (
                <div className="space-y-2">
                  <p className="text-destructive font-mono text-xs" role="alert">
                    {current.error}
                  </p>
                  <Button type="button" size="sm" variant="outline" onClick={retry}>
                    <RefreshCw aria-hidden />
                    Try again
                  </Button>
                </div>
              ) : (
                <ChatPanel
                  key={current.investigationId}
                  variant="widget"
                  investigationId={current.investigationId}
                  ticker={selected?.ticker ?? ""}
                  initialMessages={current.messages}
                  isEnabled
                />
              )}
            </>
          )}
        </div>
      )}

      {!isOpen &&
        nudge && (
          // A teaser, not a dialog: it does not take focus and is announced politely.
          <div
            role="status"
            className="bg-background border-border flex w-[min(18rem,calc(100vw-2rem))] items-start gap-2 rounded-xl border p-3 shadow-xl"
          >
            <div className="flex flex-1 flex-col items-start gap-2">
              <p className="text-xs leading-relaxed">
                The <strong className="font-semibold">{nudge.ticker}</strong> investigation is done.
                Ask a follow-up?
              </p>
              <Button type="button" size="xs" onClick={() => open(nudge.ticker)}>
                Ask
              </Button>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={`Dismiss ${nudge.ticker} notification`}
              onClick={markAllSeen}
            >
              <X aria-hidden />
            </Button>
          </div>
        )}

      {/* Keyed by the nudge so the short bounce replays once per new investigation. */}
      <span
        key={!isOpen && nudge ? nudge.investigationId : "idle"}
        className={`relative inline-flex ${!isOpen && nudge ? "follow-up-nudge" : ""}`}
      >
        <Button
          ref={launcherRef}
          type="button"
          size="lg"
          aria-expanded={isOpen}
          aria-controls={isOpen ? panelId : undefined}
          onClick={() => (isOpen ? close() : open())}
          className="rounded-full shadow-lg"
        >
          {isOpen ? <X aria-hidden /> : <MessageSquare aria-hidden />}
          {isOpen ? "Close" : "Follow-up"}
          {!isOpen && nudge && (
            <span className="sr-only"> (a new investigation just finished)</span>
          )}
        </Button>
        {!isOpen && nudge && (
          <span
            aria-hidden
            className="bg-signal ring-background absolute -top-0.5 -right-0.5 size-3 rounded-full ring-2"
          />
        )}
      </span>
    </div>
  );
}
