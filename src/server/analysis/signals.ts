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

export const UNUSUAL_RETURN_THRESHOLD = 0.02;
export const UNUSUAL_VOLUME_RATIO_THRESHOLD = 1.5;

export function calculateSignals(input: SignalInput): DeterministicSignals {
  const prices = [...input.price].sort(byDate);
  const market = [...input.market].sort(byDate);
  const latestPrice = prices.at(-1);
  const previousPrice = prices.at(-2);
  const latestMarket = market.at(-1);
  const previousMarket = market.at(-2);
  const averageVolume = calculateAverageVolume(prices.slice(0, -1).map((point) => point.volume));
  const volumeRatio = divide(latestPrice?.volume, averageVolume);
  const dailyReturn = percentChange(previousPrice?.close, latestPrice?.close);
  const marketReturn = percentChange(previousMarket?.close, latestMarket?.close);
  const relativeReturn = subtract(dailyReturn, marketReturn);
  const unusualMovement =
    Math.abs(relativeReturn ?? dailyReturn ?? 0) >= UNUSUAL_RETURN_THRESHOLD ||
    (volumeRatio !== null && volumeRatio >= UNUSUAL_VOLUME_RATIO_THRESHOLD);

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
