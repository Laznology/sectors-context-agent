import { describe, expect, it } from "vite-plus/test";
import { toPlainAnswer } from "./answer-format.ts";

describe("toPlainAnswer", () => {
  it("keeps markdown while dropping narration and normalising dashes", () => {
    const raw = [
      "The data clearly answers the question. Let me summarize.",
      "",
      "## Apakah foreign flow ini berlanjut? **Ya — berbalik menjadi outflow.**",
      "",
      "### 1. Pola arus asing",
      "",
      "| Periode | Karakter | Rentang net |",
      "|---|---|---|",
      "| 09 – 23 Sep | **Outflow besar** | −16,5 M s.d. −638,6 M IDR |",
      "",
      "* Penjual utama: `AK` net −668,3 M IDR",
      "*Catatan: data 21 Agu bernilai 0.*",
    ].join("\n");

    expect(toPlainAnswer(raw)).toBe(
      [
        "## Apakah foreign flow ini berlanjut? **Ya, berbalik menjadi outflow.**",
        "",
        "### 1. Pola arus asing",
        "",
        "| Periode | Karakter | Rentang net |",
        "|---|---|---|",
        "| 09-23 Sep | **Outflow besar** | −16,5 M s.d. −638,6 M IDR |",
        "",
        "- Penjual utama: `AK` net −668,3 M IDR",
        "*Catatan: data 21 Agu bernilai 0.*",
      ].join("\n"),
    );
  });

  it("leaves an already plain answer unchanged", () => {
    const plain = [
      "Ya, net sell asing berlanjut sampai 30 Sep.",
      "- 29 Sep: net −138,7 M IDR.",
      "- 30 Sep: net −176,3 M IDR.",
      "Pantau: apakah net buy 24-28 Sep muncul lagi.",
    ].join("\n");

    expect(toPlainAnswer(plain)).toBe(plain);
  });

  it("drops a title line and the answer label so the answer leads", () => {
    const raw = [
      "## Foreign Flow BBCA: 17–30 Sep 2026 — Ya, arus keluar berlanjut",
      "",
      "**Jawaban singkat:** Ya, net foreign outflow berlanjut di dua hari terakhir.",
      "- 30 Sep: net −176,3 M IDR.",
    ].join("\n");

    expect(toPlainAnswer(raw)).toBe(
      [
        "Ya, net foreign outflow berlanjut di dua hari terakhir.",
        "- 30 Sep: net −176,3 M IDR.",
      ].join("\n"),
    );
  });

  it("keeps identifiers with underscores intact", () => {
    expect(toPlainAnswer("Field net_foreign_inflow bernilai 0.")).toBe(
      "Field net_foreign_inflow bernilai 0.",
    );
  });
});
