export type PricePoint = {
  readonly date: string;
  readonly close: number;
  readonly volume: number;
};

export type MarketPoint = {
  readonly date: string;
  readonly close: number;
};

export type SignalInput = {
  readonly price: readonly PricePoint[];
  readonly market: readonly MarketPoint[];
};

export type DeterministicSignals = {
  readonly latestPrice: number | null;
  readonly latestVolume: number | null;
  readonly dailyReturn: number | null;
  readonly marketReturn: number | null;
  readonly relativeReturn: number | null;
  readonly averageVolume: number | null;
  readonly volumeRatio: number | null;
  readonly unusualMovement: boolean;
};

export type SignalThresholds = {
  /** Absolute relative return that counts as an unusual move. */
  readonly unusualReturn: number;
  /** Volume ratio that counts as unusual participation. */
  readonly unusualVolumeRatio: number;
  /** Trading days used for the average-volume baseline. */
  readonly volumeWindow: number;
};

/** Product heuristics, not financial recommendations. Override per environment. */
export const DEFAULT_SIGNAL_THRESHOLDS: SignalThresholds = {
  unusualReturn: 0.02,
  unusualVolumeRatio: 1.5,
  volumeWindow: 20,
};

/** Reads the thresholds from the environment, falling back to the documented defaults. */
export function signalThresholdsFromEnv(
  environment: NodeJS.ProcessEnv = process.env,
): SignalThresholds {
  return {
    unusualReturn: positiveNumber(
      environment.SIGNAL_UNUSUAL_RETURN,
      DEFAULT_SIGNAL_THRESHOLDS.unusualReturn,
    ),
    unusualVolumeRatio: positiveNumber(
      environment.SIGNAL_UNUSUAL_VOLUME_RATIO,
      DEFAULT_SIGNAL_THRESHOLDS.unusualVolumeRatio,
    ),
    volumeWindow: positiveInteger(
      environment.SIGNAL_VOLUME_WINDOW,
      DEFAULT_SIGNAL_THRESHOLDS.volumeWindow,
    ),
  };
}

export function calculateSignals(
  input: SignalInput,
  thresholds: SignalThresholds = DEFAULT_SIGNAL_THRESHOLDS,
): DeterministicSignals {
  const prices = [...input.price].sort(byDate);
  const market = [...input.market].sort(byDate);
  const latestPrice = prices.at(-1);
  const previousPrice = prices.at(-2);
  const latestMarket = market.at(-1);
  const previousMarket = market.at(-2);
  const baseline = prices.slice(0, -1).slice(-thresholds.volumeWindow);
  const averageVolume = calculateAverageVolume(baseline.map((point) => point.volume));
  const volumeRatio = divide(latestPrice?.volume, averageVolume);
  const dailyReturn = percentChange(previousPrice?.close, latestPrice?.close);
  const marketReturn = percentChange(previousMarket?.close, latestMarket?.close);
  const relativeReturn = subtract(dailyReturn, marketReturn);
  const unusualMovement =
    Math.abs(relativeReturn ?? dailyReturn ?? 0) >= thresholds.unusualReturn ||
    (volumeRatio !== null && volumeRatio >= thresholds.unusualVolumeRatio);

  return {
    latestPrice: latestPrice?.close ?? null,
    latestVolume: latestPrice?.volume ?? null,
    dailyReturn,
    marketReturn,
    relativeReturn,
    averageVolume,
    volumeRatio,
    unusualMovement,
  };
}

function byDate(left: { date: string }, right: { date: string }): number {
  return left.date.localeCompare(right.date);
}

function calculateAverageVolume(volumes: readonly number[]): number | null {
  if (volumes.length === 0) return null;
  return volumes.reduce((total, volume) => total + volume, 0) / volumes.length;
}

function percentChange(previous: number | undefined, latest: number | undefined): number | null {
  if (previous === undefined || latest === undefined || previous === 0) return null;
  return (latest - previous) / previous;
}

function divide(numerator: number | undefined, denominator: number | null): number | null {
  if (numerator === undefined || denominator === null || denominator === 0) return null;
  return numerator / denominator;
}

function subtract(left: number | null, right: number | null): number | null {
  if (left === null || right === null) return null;
  return left - right;
}

function positiveNumber(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function positiveInteger(raw: string | undefined, fallback: number): number {
  const value = positiveNumber(raw, fallback);
  return Number.isInteger(value) ? value : Math.round(value);
}
