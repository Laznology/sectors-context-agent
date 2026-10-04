/**
 * The conversation seam: maps a stored message into the parts the thread renders.
 *
 * The block vocabulary itself lives in `src/shared/schemas/ui-blocks.ts` so the
 * server validates against the same closed set the client renders.
 */
import { parseUiBlocks, type UiBlock } from "../shared/schemas/ui-blocks.ts";

export {
  parseUiBlocks,
  UiBlockSchema,
  splitBlocksFromAnswer,
} from "../shared/schemas/ui-blocks.ts";
export type { UiBlock };

/** One renderable part of a message: its prose, or one validated block. */
export type MessagePart =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "block"; readonly block: UiBlock };

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
