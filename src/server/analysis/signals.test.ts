import { describe, expect, it } from "vite-plus/test";
import { calculateSignals } from "./signals.ts";

describe("calculateSignals", () => {
  it("calculates return, benchmark-relative return, and volume ratio", () => {
    const signals = calculateSignals({
      price: [
        { date: "2026-09-15", close: 100, volume: 100 },
        { date: "2026-09-16", close: 110, volume: 180 },
      ],
      market: [
        { date: "2026-09-15", close: 100 },
        { date: "2026-09-16", close: 105 },
      ],
    });

    expect(signals.dailyReturn).toBeCloseTo(0.1);
    expect(signals.marketReturn).toBeCloseTo(0.05);
    expect(signals.relativeReturn).toBeCloseTo(0.05);
    expect(signals.averageVolume).toBe(100);
    expect(signals.volumeRatio).toBeCloseTo(1.8);
    expect(signals.unusualMovement).toBe(true);
  });

  it("keeps missing market data explicit", () => {
    const signals = calculateSignals({
      price: [{ date: "2026-09-16", close: 110, volume: 180 }],
      market: [],
    });

    expect(signals.dailyReturn).toBeNull();
    expect(signals.marketReturn).toBeNull();
    expect(signals.relativeReturn).toBeNull();
    expect(signals.unusualMovement).toBe(false);
  });
});
