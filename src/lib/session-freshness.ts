/**
 * End-of-day session freshness for a ticker's latest completed run.
 *
 * Session source: the IDX end-of-day session is published around 18:00 WIB
 * (UTC+7), so the newest available session is the most recent weekday whose
 * publication hour has passed. Verified against Sectors on 2026-10-04 (Sunday):
 * `GET /v2/daily/ANTM/?start=2026-09-28&end=2026-10-04` returned its newest
 * record on 2026-10-02, the previous Friday, matching this rule.
 */
const PUBLICATION_HOUR_UTC = 11;

/** The newest end-of-day session whose data is available at `now`. */
export function latestAvailableSession(now: Date = new Date()): string {
  const candidate = new Date(now);
  if (candidate.getUTCHours() < PUBLICATION_HOUR_UTC) {
    candidate.setUTCDate(candidate.getUTCDate() - 1);
  }
  while (candidate.getUTCDay() === 0 || candidate.getUTCDay() === 6) {
    candidate.setUTCDate(candidate.getUTCDate() - 1);
  }
  return candidate.toISOString().slice(0, 10);
}

/**
 * `true` when a newer session than the run's as-of date is available.
 *
 * A run with no as-of date counts as current: the app must not claim data is
 * stale when it cannot prove it.
 */
export function hasNewerSession(
  runAsOfDate: string | null | undefined,
  latestSession: string,
): boolean {
  if (!runAsOfDate) return false;
  return runAsOfDate < latestSession;
}
