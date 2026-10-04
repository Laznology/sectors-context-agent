/**
 * The conversation seam: the closed UI-block vocabulary and the mapping from a
 * stored message to its render parts.
 *
 * The assistant may attach validated blocks to a message; it never generates
 * components. Everything here is pure, so the mapping is testable without a DOM.
 */
import { z } from "zod";
import {
  InvestigationConfidenceSchema,
  InvestigationDriverSchema,
} from "../shared/schemas/investigation.ts";

export const UiBlockSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("metric"),
    label: z.string().min(1),
    value: z.string().min(1),
    change: z.string().min(1).optional(),
    direction: z.enum(["up", "down", "flat"]).optional(),
  }),
  z.object({
    type: z.literal("comparison"),
    title: z.string().min(1),
    rows: z
      .array(
        z.object({
          label: z.string().min(1),
          value: z.string().min(1),
          note: z.string().optional(),
        }),
      )
      .min(1),
  }),
  z.object({
    type: z.literal("series"),
    title: z.string().min(1),
    unit: z.string().optional(),
    points: z.array(z.object({ date: z.string().min(1), value: z.number() })).min(1),
  }),
  z.object({
    type: z.literal("driver"),
    driver: InvestigationDriverSchema,
    confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
  }),
  z.object({
    type: z.literal("sources"),
    items: z.array(z.object({ label: z.string().min(1), detail: z.string().optional() })).min(1),
  }),
]);

export type UiBlock = z.infer<typeof UiBlockSchema>;

/** One renderable part of a message: its prose, or one validated block. */
export type MessagePart =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "block"; readonly block: UiBlock };

/**
 * Validates a payload into blocks, dropping anything malformed.
 *
 * A bad completion degrades: unknown or invalid blocks are skipped rather than
 * breaking the thread.
 */
export function parseUiBlocks(payload: unknown): UiBlock[] {
  if (!Array.isArray(payload)) return [];
  const blocks: UiBlock[] = [];
  for (const candidate of payload) {
    const parsed = UiBlockSchema.safeParse(candidate);
    if (parsed.success) blocks.push(parsed.data);
  }
  return blocks;
}

/** Turns a stored message into its ordered render parts. */
export function toMessageParts(message: {
  readonly content: string;
  readonly uiBlocks?: unknown;
}): MessagePart[] {
  const parts: MessagePart[] = [];
  const text = message.content.trim();
  if (text.length > 0) parts.push({ kind: "text", text });
  for (const block of parseUiBlocks(message.uiBlocks)) parts.push({ kind: "block", block });
  return parts;
}

/**
 * Splits a model answer into its prose and its validated blocks.
 *
 * The prose is everything except the trailing JSON contract line, so the
 * plain-text fallback stays clean for any non-visual consumer.
 */
export function splitBlocksFromAnswer(raw: string): { prose: string; blocks: UiBlock[] } {
  const match = raw.match(/\{\s*"blocks"\s*:[\s\S]*\}\s*$/);
  if (!match) return { prose: raw, blocks: [] };

  const prose = raw.slice(0, match.index).trim();
  try {
    const parsed = JSON.parse(match[0]) as { blocks?: unknown };
    return { prose, blocks: parseUiBlocks(parsed.blocks) };
  } catch {
    return { prose, blocks: [] };
  }
}

export { InvestigationConfidenceSchema };
