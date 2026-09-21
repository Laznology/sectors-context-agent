import { and, asc, desc, eq, sql } from "drizzle-orm";
import { getDb, type Database } from "./index.ts";
import type { WatchlistDashboardItem } from "./investigations.ts";
import { investigations, watchlists } from "./schema.ts";

export type WatchlistItem = {
  readonly ticker: string;
  readonly createdAt: string;
};

export interface WatchlistStore {
  list(userId: string): Promise<WatchlistItem[]>;
  add(userId: string, ticker: string): Promise<void>;
  remove(userId: string, ticker: string): Promise<void>;
  /** Watchlist plus dashboard context; joined server-side to avoid N+1 client calls. */
  dashboard(userId: string): Promise<WatchlistDashboardItem[]>;
}

export class PostgresWatchlistStore implements WatchlistStore {
  private readonly db: Database;

  constructor(db: Database = getDb()) {
    this.db = db;
  }

  async list(userId: string): Promise<WatchlistItem[]> {
    const rows = await this.db
      .select({ ticker: watchlists.ticker, createdAt: watchlists.createdAt })
      .from(watchlists)
      .where(eq(watchlists.userId, userId))
      .orderBy(asc(watchlists.createdAt));

    return rows.map((row) => ({
      ticker: row.ticker,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async add(userId: string, ticker: string): Promise<void> {
    await this.db.insert(watchlists).values({ userId, ticker }).onConflictDoNothing();
  }

  async remove(userId: string, ticker: string): Promise<void> {
    await this.db
      .delete(watchlists)
      .where(and(eq(watchlists.userId, userId), eq(watchlists.ticker, ticker)));
  }

  async dashboard(userId: string): Promise<WatchlistDashboardItem[]> {
    const entries = await this.db
      .select({ ticker: watchlists.ticker, createdAt: watchlists.createdAt })
      .from(watchlists)
      .where(eq(watchlists.userId, userId))
      .orderBy(asc(watchlists.createdAt));

    if (entries.length === 0) return [];

    // ponytail: DISTINCT ON gives the latest investigation per ticker in one query; revisit if the list grows.
    const latest = await this.db
      .selectDistinctOn([investigations.ticker], {
        ticker: investigations.ticker,
        companyName: investigations.companyName,
        subSector: investigations.subSector,
        id: investigations.id,
        status: investigations.status,
        statusLabel: investigations.statusLabel,
        lastClose: sql<
          number | null
        >`(${investigations.signalsJson}->>'latestPrice')::double precision`,
        asOfDate: investigations.asOfDate,
        createdAt: investigations.createdAt,
        completedAt: investigations.completedAt,
      })
      .from(investigations)
      .where(eq(investigations.userId, userId))
      .orderBy(investigations.ticker, desc(investigations.createdAt));

    const byTicker = Object.fromEntries(latest.map((row) => [row.ticker, row]));

    return entries.map((entry) => {
      const investigation = byTicker[entry.ticker];
      return {
        ticker: entry.ticker,
        createdAt: entry.createdAt.toISOString(),
        companyName: investigation?.companyName ?? null,
        lastClose: investigation?.lastClose ?? null,
        lastCloseDate: investigation?.asOfDate ?? null,
        lastInvestigation: investigation
          ? {
              id: investigation.id,
              status: investigation.status,
              statusLabel: investigation.statusLabel ?? null,
              createdAt: investigation.createdAt.toISOString(),
              completedAt: investigation.completedAt?.toISOString() ?? null,
            }
          : null,
      };
    });
  }
}
