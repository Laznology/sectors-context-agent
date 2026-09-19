import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.ts";

export type Database = PostgresJsDatabase<typeof schema>;

type DatabaseClient = postgres.Sql;

let database: Database | undefined;
let databaseClient: DatabaseClient | undefined;

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

  databaseClient = postgres(connectionString);
  database = drizzle(databaseClient, { schema });
  return database;
}

export async function closeDb(): Promise<void> {
  if (!databaseClient) return;
  await databaseClient.end({ timeout: 5 });
  database = undefined;
  databaseClient = undefined;
}

export { schema };
