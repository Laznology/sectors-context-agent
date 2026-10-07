/**
 * Deterministic clean-up for follow-up answers.
 *
 * The chat renders markdown, so formatting is preserved. This only strips
 * narration the model adds in front of the answer and normalises dashes;
 * it must not flatten markdown back to plain text.
 */

/** Opening lines that narrate the answer instead of giving it. */
const META_PREAMBLE =
  /^(?:the data\b.*|let me\b.*|i(?:'ll| will)\b.*|here(?:'s| is) (?:a |the )?summary\b.*|berikut (?:ini )?(?:ringkasan|rangkuman)\b.*)$/i;

const TABLE_SEPARATOR = /^\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)*\|?$/;

/** Labels the model puts in front of the answer instead of just answering. */
const ANSWER_LABEL =
  /^\*{0,2}(?:jawaban(?: singkat(?:nya)?)?|singkatnya|ringkasan|kesimpulan|intinya|tl;?dr|short answer|answer)\s*:\s*\*{0,2}\s*/i;

export function toPlainAnswer(raw: string): string {
  const lines: string[] = [];
  for (const original of raw.replace(/\r\n?/g, "\n").split("\n")) {
    let line = original.trim();

    if (TABLE_SEPARATOR.test(line)) {
      lines.push(line);
      continue;
    }

    line = line
      .replace(/^[*+]\s+/, "- ")
      .replace(/^(\d+)\)\s+/, "$1. ")
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
