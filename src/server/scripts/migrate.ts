import "dotenv/config";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { closeDb, getDb } from "../db/index.ts";

/**
 * Applies ./drizzle to the database. Idempotent (Drizzle tracks applied
 * migrations), so the container runs it on every boot before serving.
 */
try {
  await migrate(getDb(), { migrationsFolder: "./drizzle" });
  console.log("[migrate] schema up to date");
} finally {
  await closeDb();
}
