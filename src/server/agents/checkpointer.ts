import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";

/**
 * LangGraph PostgreSQL checkpointer helper.
 *
 * `setup()` is deliberately *not* called here: creating the checkpoint tables is
 * an explicit, one-off migration step, never something a request performs.
 *
 * Usage:
 * ```ts
 * const checkpointer = createCheckpointer();
 * await checkpointer.setup(); // once per database
 * graph.compile({ checkpointer });
 * ```
 */
export function createCheckpointer(connectionString: string = requireDatabaseUrl()): PostgresSaver {
  return PostgresSaver.fromConnString(connectionString);
}

/** Runs the checkpointer migrations. Call this explicitly, e.g. from a script. */
export async function setupCheckpointer(
  checkpointer: PostgresSaver = createCheckpointer(),
): Promise<void> {
  await checkpointer.setup();
}

function requireDatabaseUrl(): string {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env and configure it.");
  }

  return connectionString;
}
