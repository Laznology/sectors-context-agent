import { describe, expect, it } from "vite-plus/test";
import { calculateSignals, signalThresholdsFromEnv } from "./signals.ts";

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

  it("averages volume over the configured window, excluding the latest day", () => {
    const price = Array.from({ length: 25 }, (_, index) => ({
      date: `2026-08-${String(index + 1).padStart(2, "0")}`,
      close: 100,
      volume: index < 4 ? 10 : 100,
    }));

    const signals = calculateSignals(
      { price, market: [] },
      {
        unusualReturn: 0.02,
        unusualVolumeRatio: 1.5,
        volumeWindow: 20,
      },
    );

    expect(signals.averageVolume).toBe(100);
    expect(signals.volumeRatio).toBe(1);
  });

  it("uses the configured thresholds to decide an unusual move", () => {
    const input = {
      price: [
        { date: "2026-09-15", close: 100, volume: 100 },
        { date: "2026-09-16", close: 103, volume: 100 },
      ],
      market: [
        { date: "2026-09-15", close: 100 },
        { date: "2026-09-16", close: 100 },
      ],
    };

    const strict = calculateSignals(input, {
      unusualReturn: 0.5,
      unusualVolumeRatio: 9,
      volumeWindow: 20,
    });
    const loose = calculateSignals(input, {
      unusualReturn: 0.01,
      unusualVolumeRatio: 9,
      volumeWindow: 20,
    });

    expect(strict.unusualMovement).toBe(false);
    expect(loose.unusualMovement).toBe(true);
  });
});

describe("signalThresholdsFromEnv", () => {
  it("falls back to the documented defaults", () => {
    expect(signalThresholdsFromEnv({})).toEqual({
      unusualReturn: 0.02,
      unusualVolumeRatio: 1.5,
      volumeWindow: 20,
    });
  });

  it("reads overrides and ignores invalid values", () => {
    expect(
      signalThresholdsFromEnv({
        SIGNAL_UNUSUAL_RETURN: "0.05",
        SIGNAL_UNUSUAL_VOLUME_RATIO: "2",
        SIGNAL_VOLUME_WINDOW: "30",
      }),
    ).toEqual({ unusualReturn: 0.05, unusualVolumeRatio: 2, volumeWindow: 30 });

    expect(
      signalThresholdsFromEnv({
        SIGNAL_UNUSUAL_RETURN: "not-a-number",
        SIGNAL_UNUSUAL_VOLUME_RATIO: "-1",
        SIGNAL_VOLUME_WINDOW: "",
      }),
    ).toEqual({ unusualReturn: 0.02, unusualVolumeRatio: 1.5, volumeWindow: 20 });
  });
});
