import { and, asc, eq } from "drizzle-orm";
import { getDb, type Database } from "./index.ts";
import { watchlists } from "./schema.ts";

export type WatchlistItem = {
  readonly ticker: string;
  readonly createdAt: string;
};

export interface WatchlistStore {
  list(userId: string): Promise<WatchlistItem[]>;
  add(userId: string, ticker: string): Promise<void>;
  remove(userId: string, ticker: string): Promise<void>;
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
}
