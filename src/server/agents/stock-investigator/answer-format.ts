/**
 * Deterministic clean-up for follow-up answers.
 *
 * The chat renders plain text, so markdown the model emits anyway would show
 * up as raw `##`, `**` and `|` characters. The prompt asks for plain text;
 * this is the safety net that keeps stored answers readable regardless.
 */

/** Opening lines that narrate the answer instead of giving it. */
const META_PREAMBLE =
  /^(?:the data\b.*|let me\b.*|i(?:'ll| will)\b.*|here(?:'s| is) (?:a |the )?summary\b.*|berikut (?:ini )?(?:ringkasan|rangkuman)\b.*)$/i;

const TABLE_SEPARATOR = /^\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)*\|?$/;

/** Labels the model puts in front of the answer instead of just answering. */
const ANSWER_LABEL =
  /^(?:jawaban(?: singkat(?:nya)?)?|singkatnya|ringkasan|kesimpulan|intinya|tl;?dr|short answer|answer)\s*:\s*/i;

export function toPlainAnswer(raw: string): string {
  const lines: string[] = [];
  let tableHeaderIndex: number | null = null;

  for (const original of raw.replace(/\r\n?/g, "\n").split("\n")) {
    let line = original.trim();

    if (TABLE_SEPARATOR.test(line)) {
      // The row before a separator is the table header; it repeats labels the
      // data rows already carry, so drop it.
      if (tableHeaderIndex !== null) lines.splice(tableHeaderIndex, 1);
      tableHeaderIndex = null;
      continue;
    }

    if (line.startsWith("|") && line.endsWith("|")) {
      const cells = line
        .slice(1, -1)
        .split("|")
        .map((cell) => cell.trim())
        .filter(Boolean);
      tableHeaderIndex = lines.length;
      line = cells.length > 0 ? `- ${cells.join(", ")}` : "";
    } else {
      tableHeaderIndex = null;
    }

    line = line
      .replace(/^#{1,6}\s+/, "")
      .replace(/^>\s?/, "")
      .replace(/^[*+]\s+/, "- ")
      .replace(/^(\d+)\)\s+/, "$1. ")
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/__(.+?)__/g, "$1")
      .replace(/(^|[\s(])\*(\S(?:.*?\S)?)\*(?=[\s).,;:!?]|$)/g, "$1$2")
      .replace(/(^|[\s(])_(\S(?:.*?\S)?)_(?=[\s).,;:!?]|$)/g, "$1$2")
      .replace(/`([^`]+)`/g, "$1")
      // Ranges keep a plain hyphen; any other dash becomes a comma.
      .replace(/(\d)\s*[\u2013\u2014]\s*(\d)/g, "$1-$2")
      .replace(/\s*[\u2013\u2014]\s*/g, ", ")
      .replace(/,\s*,/g, ",")
      .replace(/^,\s*/, "")
      .trim();

    lines.push(line);
  }

  // Drop narration that precedes the first real sentence of the answer.
  while (lines.length > 0 && (lines[0] === "" || META_PREAMBLE.test(lines[0]))) {
    lines.shift();
  }

  // A labelled answer ("Jawaban singkat: Ya, ...") means anything above it is
  // a title; drop the title and the label so the answer leads.
  const labelledIndex = lines.findIndex((line) => ANSWER_LABEL.test(line));
  if (labelledIndex !== -1 && lines.slice(0, labelledIndex).filter(Boolean).length <= 1) {
    lines.splice(0, labelledIndex);
  }
  for (let index = 0; index < lines.length; index += 1) {
    const stripped = lines[index].replace(ANSWER_LABEL, "");
    if (stripped !== lines[index]) {
      lines[index] = stripped.charAt(0).toUpperCase() + stripped.slice(1);
    }
  }

  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
