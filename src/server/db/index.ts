import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.ts";

export type Database = PostgresJsDatabase<typeof schema>;

let database: Database | undefined;

/**
 * Lazily creates the Drizzle client so that importing this module never
 * requires `DATABASE_URL` to be configured.
 */
export function getDb(): Database {
  if (database) return database;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env and configure it.");
  }

  database = drizzle(postgres(connectionString), { schema });
  return database;
}

export { schema };
