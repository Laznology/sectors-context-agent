import type { MarketSignals } from "@/lib/investigation-view-model";

const PERCENT = new Intl.NumberFormat("id-ID", {
  style: "percent",
  signDisplay: "always",
  maximumFractionDigits: 2,
});
const NUMBER = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 });
const SHARES = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });
const RUPIAH = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export function InvestigationSignalChart({
  ticker,
  signals,
}: {
  ticker: string;
  signals: MarketSignals | null;
}) {
  if (!signals) return null;

  const returns = [signals.dailyReturn, signals.marketReturn].filter(
    (value): value is number => value !== null,
  );
  const domain = Math.max(...returns.map(Math.abs), 0.005) * 1.2;
  const plotStart = 20;
  const plotWidth = 460;
  const zeroX = plotStart + plotWidth / 2;
  const xFor = (value: number | null) => zeroX + ((value ?? 0) / (domain * 2)) * plotWidth;
  const dailyX = xFor(signals.dailyReturn);
  const marketX = xFor(signals.marketReturn);
  const formatReturn = (value: number | null) =>
    value === null ? "Tidak tersedia" : PERCENT.format(value);

  return (
    <section className="border-rule grid gap-5 border-y py-5 lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-8">
      <figure className="min-w-0 space-y-3">
        <figcaption>
          <h3 className="font-mono text-xs font-bold tracking-wider text-muted-foreground uppercase">
            Return sesi terakhir
          </h3>
          <p className="mt-1 text-sm text-foreground">Bandingkan saham dengan IHSG</p>
        </figcaption>

        <div className="grid grid-cols-[3.25rem_minmax(0,1fr)_4.5rem] items-center gap-x-3 gap-y-2 text-xs">
          <span className="font-mono font-semibold uppercase">{ticker}</span>
          <svg
            viewBox="0 0 500 94"
            className="col-start-2 row-span-2 h-23.5 w-full overflow-visible"
            role="img"
            aria-label={`${ticker} ${formatReturn(signals.dailyReturn)}; IHSG ${formatReturn(signals.marketReturn)}. Garis vertikal menandai nol.`}
          >
            <line x1={zeroX} x2={zeroX} y1="8" y2="76" className="stroke-border" strokeWidth="1" />
            {signals.dailyReturn !== null && (
              <>
                <line
                  x1={zeroX}
                  x2={dailyX}
                  y1="26"
                  y2="26"
                  className="stroke-signal"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <circle cx={dailyX} cy="26" r="4" className="fill-signal" />
              </>
            )}
            {signals.marketReturn !== null && (
              <>
                <line
                  x1={zeroX}
                  x2={marketX}
                  y1="59"
                  y2="59"
                  className="stroke-muted-foreground"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <circle cx={marketX} cy="59" r="4" className="fill-muted-foreground" />
              </>
            )}
            <line
              x1={plotStart}
              x2={plotStart + plotWidth}
              y1="82"
              y2="82"
              className="stroke-border"
              strokeWidth="1"
            />
            <line x1={plotStart} x2={plotStart} y1="79" y2="85" className="stroke-border" />
            <line
              x1={plotStart + plotWidth / 2}
              x2={plotStart + plotWidth / 2}
              y1="79"
              y2="85"
              className="stroke-border"
            />
            <line
              x1={plotStart + plotWidth}
              x2={plotStart + plotWidth}
              y1="79"
              y2="85"
              className="stroke-border"
            />
          </svg>
          <span className="tabular text-right">{formatReturn(signals.dailyReturn)}</span>

          <span className="font-mono text-muted-foreground uppercase">IHSG</span>
          <span className="tabular text-right text-muted-foreground">
            {formatReturn(signals.marketReturn)}
          </span>

          <span aria-hidden />
          <span className="col-start-2 flex justify-between font-mono text-[10px] text-muted-foreground tabular">
            <span>{PERCENT.format(-domain)}</span>
            <span>0</span>
            <span>{PERCENT.format(domain)}</span>
          </span>
          <span aria-hidden />
        </div>
      </figure>

      <div className="flex flex-col justify-center gap-4 border-t border-rule pt-4 lg:border-t-0 lg:border-l lg:pl-6 lg:pt-0">
        <div>
          <p className="font-mono text-xs font-bold tracking-wider text-muted-foreground uppercase">
            Selisih dari IHSG
          </p>
          <p className="tabular mt-1 text-2xl font-semibold tracking-tight">
            {signals.relativeReturn === null
              ? "Tidak tersedia"
              : PERCENT.format(signals.relativeReturn)}
          </p>
          <p className="text-xs text-muted-foreground">poin persentase</p>
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-rule pt-4">
          <div>
            <p className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
              Penutupan
            </p>
            <p className="tabular mt-1 text-sm font-semibold">
              {signals.latestPrice === null ? "Tidak tersedia" : RUPIAH.format(signals.latestPrice)}
            </p>
          </div>
          <div>
            <p className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
              Volume
            </p>
            <p className="tabular mt-1 text-sm font-semibold">
              {signals.volumeRatio === null
                ? "Tidak tersedia"
                : `${NUMBER.format(signals.volumeRatio)}×`}
            </p>
            <p className="text-[11px] text-muted-foreground">dari rata-rata</p>
          </div>
        </div>

        {signals.latestVolume !== null && signals.averageVolume !== null && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            {SHARES.format(signals.latestVolume)} dari rata-rata{" "}
            {SHARES.format(signals.averageVolume)} saham.
          </p>
        )}
      </div>
    </section>
  );
}
