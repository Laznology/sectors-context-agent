/**
 * Scoped follow-up chat panel (PRD #19, FE wiki #5).
 *
 * Renders the persisted conversation of one investigation and sends
 * POST /api/investigations/:id/chat with { message }. The server only accepts
 * follow-ups for completed investigations, keeps answers grounded in the
 * investigation evidence, and may call Sectors tools for fresh data.
 */
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { ConversationMessage } from "@/lib/investigation-view-model";
import { LoaderCircle, MessageSquare, Send, Wrench } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { z } from "zod";

const MAX_MESSAGE_LENGTH = 4_000;

const ChatResponseSchema = z.object({
  message: z.object({
    id: z.string(),
    role: z.enum(["user", "assistant"]),
    content: z.string(),
    createdAt: z.string(),
  }),
});

const ChatErrorSchema = z.object({
  error: z.string().optional(),
  message: z.string().optional(),
});

export function ChatPanel({
  investigationId,
  ticker,
  initialMessages,
  isEnabled,
  variant = "panel",
}: {
  investigationId: string;
  ticker: string;
  initialMessages: ConversationMessage[];
  /** Follow-ups are only accepted once the investigation has completed. */
  isEnabled: boolean;
  /** `panel` sits inline on a page; `widget` fills the floating chat window. */
  variant?: "panel" | "widget";
}) {
  const isWidget = variant === "widget";
  const inputId = useId();
  const titleId = useId();
  const [messages, setMessages] = useState<ConversationMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  // Scroll only the message list, never the page, so opening a report does not
  // jump the viewport down to the chat.
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages.length, isSending]);

  async function sendMessage() {
    const message = draft.trim();
    if (!message || isSending || !isEnabled) return;

    setError(null);
    setIsSending(true);
    setDraft("");
    // The server persists the user turn before calling the model, so it stays
    // in the history even if the answer fails.
    setMessages((prev) => [
      ...prev,
      {
        id: `local-${Date.now()}`,
        role: "user",
        content: message,
        createdAt: new Date().toISOString(),
      },
    ]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(`/api/investigations/${encodeURIComponent(investigationId)}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
        signal: controller.signal,
      });
      const body: unknown = await res.json().catch(() => null);

      if (!res.ok) {
        const parsedError = ChatErrorSchema.safeParse(body);
        const detail = parsedError.success
          ? (parsedError.data.message ?? parsedError.data.error)
          : undefined;
        throw new Error(detail ?? `Follow-up failed (HTTP ${res.status})`);
      }

      const parsed = ChatResponseSchema.safeParse(body);
      if (!parsed.success) {
        throw new Error("The server returned an unexpected follow-up response.");
      }

      const answer = parsed.data.message;
      setMessages((prev) => [...prev, answer]);
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : "The follow-up could not be processed.");
    } finally {
      if (!controller.signal.aborted) setIsSending(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void sendMessage();
    }
  }

  return (
    <section
      className={isWidget ? "flex min-h-0 flex-1 flex-col gap-3" : "dashboard-panel space-y-4"}
      aria-labelledby={titleId}
    >
      <div className={isWidget ? "sr-only" : undefined}>
        <h2 id={titleId} className="panel-title flex items-center gap-2">
          <MessageSquare className="size-4" aria-hidden />
          Follow-up Question
        </h2>
        <p className="panel-subtitle">
          Ask a follow-up about this <strong className="uppercase">{ticker}</strong> investigation.
          Answers stay grounded in the collected evidence and are not investment advice.
        </p>
      </div>

      <div
        ref={listRef}
        className={`space-y-3 overflow-y-auto ${isWidget ? "min-h-0 flex-1 pr-1" : "max-h-[28rem] pr-1"}`}
        aria-live="polite"
      >
        {messages.length === 0 && !isSending && (
          <p className="text-xs text-muted-foreground">
            No questions yet. Example: "Apakah foreign flow ini berlanjut?"
          </p>
        )}

        {messages.map((item) => (
          <ChatBubble key={item.id} message={item} />
        ))}

        {isSending && (
          <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
            <LoaderCircle className="size-3.5 shrink-0 animate-spin text-primary" aria-hidden />
            <span className="flex flex-col gap-1">
              <span className="text-foreground">The agent is drafting an answer…</span>
              <span className="flex items-center gap-1.5 font-mono text-[11px]">
                <Wrench className="size-3" aria-hidden />
                It may call Sectors tools for fresh data.
              </span>
            </span>
          </div>
        )}
      </div>

      {error && (
        <p
          className="border-destructive/50 bg-destructive/10 text-destructive rounded-lg border p-3 font-mono text-xs"
          role="alert"
        >
          {error}
        </p>
      )}

      {isEnabled ? (
        <form onSubmit={handleSubmit} className="space-y-2">
          <Label htmlFor={inputId} className={isWidget ? "sr-only" : "text-xs font-medium"}>
            Question
          </Label>
          <textarea
            id={inputId}
            rows={2}
            maxLength={MAX_MESSAGE_LENGTH}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isSending}
            placeholder={`Ask about ${ticker}… (Enter to send, Shift+Enter for a new line)`}
            className="w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
          />
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={isSending || draft.trim().length === 0}>
              {isSending ? (
                <LoaderCircle className="animate-spin" aria-hidden />
              ) : (
                <Send aria-hidden />
              )}
              {isSending ? "Sending…" : "Send"}
            </Button>
          </div>
        </form>
      ) : (
        <p className="text-xs text-muted-foreground">
          Follow-ups unlock once the investigation completes.
        </p>
      )}
    </section>
  );
}

function ChatBubble({ message }: { message: ConversationMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] space-y-2 rounded-lg border p-3 text-sm leading-relaxed ${
          isUser
            ? "border-primary/40 bg-primary/10 text-foreground"
            : "border-border/60 bg-muted/20 text-foreground/90"
        }`}
      >
        <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          {isUser ? "You" : "Agent"}
        </p>
        <p className="whitespace-pre-wrap">{message.content}</p>
      </div>
    </div>
  );
}
