/**
 * Scoped follow-up chat panel (PRD #19, FE wiki #5).
 *
 * Renders the persisted conversation of one investigation and sends
 * POST /api/investigations/:id/chat with { message }. The server only accepts
 * follow-ups for completed investigations, keeps answers grounded in the
 * investigation evidence, and may call Sectors tools for fresh data.
 */
import { UiBlockView } from "@/components/ui-block";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toMessageParts } from "@/lib/conversation-view-model";
import type { ConversationMessage } from "@/lib/investigation-view-model";
import { INVESTIGATION_DISCLAIMER } from "@/shared/schemas/investigation.ts";
import { ChevronDown, LoaderCircle, Send, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { z } from "zod";

const MAX_MESSAGE_LENGTH = 4_000;

const ChatResponseSchema = z.object({
  message: z.object({
    id: z.string(),
    role: z.enum(["user", "assistant"]),
    content: z.string(),
    uiBlocks: z.unknown().optional(),
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
  isOpen,
  isClosing,
  onClose,
}: {
  investigationId: string;
  ticker: string;
  initialMessages: ConversationMessage[];
  isOpen: boolean;
  isClosing: boolean;
  onClose: () => void;
}) {
  const inputId = useId();
  const [messages, setMessages] = useState<ConversationMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealMessageId, setRevealMessageId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const latestAnswerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const titleId = useId();
  const previousMessages = messages.slice(0, -2);
  const recentMessages = messages.slice(-2);

  useEffect(() => () => abortRef.current?.abort(), []);

  // Keep new turns in the thread, never scroll the report itself.
  useEffect(() => {
    const list = listRef.current;
    if (!list || !isOpen) return;
    list.scrollTop = list.scrollHeight;
  }, [messages.length, isSending, isOpen]);

  // Align the new answer's top so its reveal starts in view, not at the bottom.
  useEffect(() => {
    if (!revealMessageId) return;
    latestAnswerRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [revealMessageId]);

  async function sendMessage() {
    const message = draft.trim();
    if (!message || isSending) return;

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
        throw new Error(detail ?? `Pertanyaan lanjutan gagal (HTTP ${res.status})`);
      }

      const parsed = ChatResponseSchema.safeParse(body);
      if (!parsed.success) {
        throw new Error("Server mengembalikan respons pertanyaan lanjutan yang tidak sesuai.");
      }

      const answer = parsed.data.message;
      setRevealMessageId(answer.id);
      setMessages((prev) => [...prev, answer]);
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : "Pertanyaan lanjutan tidak dapat diproses.");
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

  const suggestedQuestions = [
    "Apa yang menjelaskan selisih dari IHSG?",
    "Seberapa kuat sinyal volume ini?",
    "Bukti apa yang masih belum tersedia?",
  ];

  function askSuggestedQuestion(question: string) {
    setDraft(question);
    window.requestAnimationFrame(() => textareaRef.current?.focus());
  }

  return (
    <aside
      id="investigation-chat-panel"
      aria-labelledby={titleId}
      className={`investigation-chat-panel relative flex h-[min(70dvh,40rem)] min-h-96 w-full min-w-0 flex-col overflow-hidden rounded-xl border border-border/70 bg-panel text-card-foreground xl:fixed xl:top-6 xl:right-10 xl:bottom-6 xl:h-auto xl:w-[36rem] xl:max-h-[calc(100dvh-3rem)] xl:min-h-0 ${
        isOpen ? `is-open${isClosing ? " is-closing" : ""}` : "is-closed"
      }`}
      aria-hidden={!isOpen}
      inert={!isOpen}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border/60 px-5 py-4">
          <div>
            <h2 id={titleId} className="text-base font-semibold">
              Tanya agent
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Laporan {ticker} · Jawaban berbasis bukti
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Tutup panel Tanya agent"
            onClick={onClose}
          >
            <X aria-hidden />
          </Button>
        </header>

        <div
          ref={listRef}
          className="scrollbar-theme min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-4"
          aria-live="polite"
        >
          {messages.length === 0 && !isSending && (
            <div className="space-y-3">
              <p className="max-w-[38ch] text-sm leading-relaxed text-muted-foreground">
                Tanyakan hal spesifik tentang pergerakan, sinyal, atau bukti yang belum tersedia.
              </p>
              <div
                className="divide-y divide-border/50 border-y border-border/50"
                role="group"
                aria-label="Pertanyaan yang disarankan"
              >
                {suggestedQuestions.map((question) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => askSuggestedQuestion(question)}
                    className="block w-full py-3 text-left text-sm text-foreground/85 transition-colors hover:text-signal-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          )}

          {previousMessages.length > 0 && (
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center gap-2 text-xs text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
                <ChevronDown
                  className="size-3.5 shrink-0 transition-transform group-open:rotate-180"
                  aria-hidden
                />
                Lihat {previousMessages.length} pesan sebelumnya
              </summary>
              <div className="mt-3 space-y-3">
                {previousMessages.map((item) => (
                  <ChatBubble key={item.id} message={item} animate={item.id === revealMessageId} />
                ))}
              </div>
            </details>
          )}

          {recentMessages.map((item) => {
            const isRevealing = item.id === revealMessageId;
            return (
              <div key={item.id} ref={isRevealing ? latestAnswerRef : undefined}>
                <ChatBubble message={item} animate={isRevealing} />
              </div>
            );
          })}

          {isSending && (
            <div className="flex items-start gap-2 border-y border-border/50 py-3 text-sm text-muted-foreground">
              <LoaderCircle
                className="mt-0.5 size-4 shrink-0 animate-spin text-signal-text"
                aria-hidden
              />
              <span>
                <span className="block text-foreground">Agent menyusun jawaban</span>
                <span className="mt-1 block text-xs">
                  Data Sectors tambahan mungkin sedang diperiksa.
                </span>
              </span>
            </div>
          )}
        </div>

        <form
          onSubmit={handleSubmit}
          className="shrink-0 border-t border-border/60 px-4 py-4 sm:px-5"
        >
          {error && (
            <p
              className="text-destructive rounded border border-destructive/50 bg-destructive/10 p-3 text-sm"
              role="alert"
            >
              {error}
            </p>
          )}
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <Label htmlFor={inputId} className="text-xs font-medium">
              Pertanyaan lanjutan
            </Label>
            <span className="text-[10px] text-muted-foreground">Khusus laporan {ticker}</span>
          </div>
          <div className="overflow-hidden rounded-xl border border-border/70 bg-background/60 transition-colors focus-within:border-ring/70 focus-within:ring-2 focus-within:ring-ring/20">
            <textarea
              ref={textareaRef}
              id={inputId}
              rows={4}
              maxLength={MAX_MESSAGE_LENGTH}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isSending}
              placeholder={`Contoh: bukti mana yang paling mendukung kesimpulan ${ticker}?`}
              className="block max-h-40 min-h-28 w-full resize-y bg-transparent px-3.5 py-3 text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
            <div className="flex items-center justify-between gap-3 border-t border-border/50 px-3 py-2">
              <span className="text-[10px] text-muted-foreground">
                Enter kirim <span aria-hidden>·</span> Shift+Enter baris baru
              </span>
              <div className="flex shrink-0 items-center gap-3">
                <span className="tabular font-mono text-[10px] text-muted-foreground">
                  {draft.length}/{MAX_MESSAGE_LENGTH}
                </span>
                <Button
                  type="submit"
                  size="sm"
                  aria-label={isSending ? "Mengirim pertanyaan" : "Kirim pertanyaan"}
                  disabled={isSending || draft.trim().length === 0}
                  className="h-8 px-3"
                >
                  {isSending ? (
                    <LoaderCircle className="animate-spin" aria-hidden />
                  ) : (
                    <Send aria-hidden />
                  )}
                  {isSending ? "Mengirim…" : "Kirim"}
                </Button>
              </div>
            </div>
          </div>
          <p className="mt-2 max-w-[48ch] text-[10px] leading-relaxed text-muted-foreground">
            {INVESTIGATION_DISCLAIMER}
          </p>
        </form>
      </div>
    </aside>
  );
}

const SENTENCE_CHUNK = /[^.!?\n]+(?:[.!?]+|\n|$)/g;
const REVEAL_STEP_MS = 130;

function splitSentences(text: string): string[] {
  const chunks = text.match(SENTENCE_CHUNK);
  return chunks && chunks.length > 0 ? chunks : [text];
}

function RevealText({ text, onDone }: { text: string; onDone?: () => void }) {
  const [sentences] = useState(() => splitSentences(text));
  const [shown, setShown] = useState(0);
  const done = shown >= sentences.length;
  const announcedRef = useRef(false);

  useEffect(() => {
    if (done) {
      if (!announcedRef.current) {
        announcedRef.current = true;
        onDone?.();
      }
      return;
    }
    const timer = window.setTimeout(() => setShown((count) => count + 1), REVEAL_STEP_MS);
    return () => window.clearTimeout(timer);
  }, [shown, sentences.length, done, onDone]);

  return (
    <p className="whitespace-pre-wrap">
      {sentences.map((sentence, index) => (
        <span key={index} className={`chat-sentence${index < shown ? " is-shown" : ""}`}>
          {sentence}
        </span>
      ))}
    </p>
  );
}

function ChatBubble({ message, animate }: { message: ConversationMessage; animate: boolean }) {
  const isUser = message.role === "user";
  const parts = toMessageParts(message);
  const hasProse = parts.some((part) => part.kind === "text");
  const [blocksReady, setBlocksReady] = useState(!animate || !hasProse);

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-full min-w-0 space-y-2 rounded-lg border p-3 text-sm leading-relaxed ${
          isUser
            ? "border-primary/40 bg-primary/10 text-foreground"
            : "border-border/60 bg-muted/20 text-foreground/90"
        }`}
      >
        <p className="text-muted-foreground font-mono text-[10px] tracking-wider uppercase">
          {isUser ? "Anda" : "Agent"}
        </p>
        {parts.map((part, index) =>
          part.kind === "text" ? (
            animate ? (
              <RevealText key={index} text={part.text} onDone={() => setBlocksReady(true)} />
            ) : (
              <p key={index} className="whitespace-pre-wrap">
                {part.text}
              </p>
            )
          ) : blocksReady ? (
            <div key={index} className="chat-block">
              <UiBlockView block={part.block} />
            </div>
          ) : null,
        )}
      </div>
    </div>
  );
}
