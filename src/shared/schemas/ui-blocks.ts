/**
 * The closed UI-block vocabulary the assistant may attach to an answer.
 *
 * Shared by the server (which validates what the model returns) and the client
 * (which renders it), so the two cannot drift. The model picks from this list;
 * it never authors components.
 */
import { z } from "zod";
import { InvestigationDriverSchema } from "./investigation.ts";

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

/** Validates a payload into blocks, dropping anything malformed. */
export function parseUiBlocks(payload: unknown): UiBlock[] {
  if (!Array.isArray(payload)) return [];
  const blocks: UiBlock[] = [];
  for (const candidate of payload) {
    const parsed = UiBlockSchema.safeParse(candidate);
    if (parsed.success) blocks.push(parsed.data);
  }
  return blocks;
}

/**
 * Splits a model answer into its prose and its validated blocks.
 *
 * The model may glue `{"blocks": ...}` onto the last sentence with no newline,
 * so the trailing object is tried first, then a whole-line scan as fallback.
 */
export function splitBlocksFromAnswer(raw: string): { prose: string; blocks: UiBlock[] } {
  const trailing = splitTrailingBlocks(raw);
  if (trailing) return trailing;

  const lines = raw.split("\n");
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const candidate = lines[index].trim();
    if (!candidate.startsWith("{") || !candidate.endsWith("}")) continue;

    const blocks = parseBlocksObject(candidate);
    if (!blocks) continue;

    const prose = [...lines.slice(0, index), ...lines.slice(index + 1)].join("\n").trim();
    return { prose, blocks };
  }

  return { prose: raw, blocks: [] };
}

function splitTrailingBlocks(raw: string): { prose: string; blocks: UiBlock[] } | null {
  const start = raw.lastIndexOf('{"blocks"');
  if (start === -1) return null;

  const blocks = parseBlocksObject(raw.slice(start).trim());
  if (!blocks) return null;

  return { prose: raw.slice(0, start).trim(), blocks };
}

function parseBlocksObject(candidate: string): UiBlock[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || !("blocks" in parsed)) return null;
  return parseUiBlocks((parsed as { blocks?: unknown }).blocks);
}
