import "dotenv/config";
import { eq } from "drizzle-orm";
import { auth } from "../auth.ts";
import { closeDb, getDb } from "../db/index.ts";
import { user } from "../db/schema.ts";

const name = process.env.SEED_USER_NAME?.trim() || "Demo User";
const email = (process.env.SEED_USER_EMAIL?.trim() || "demo@example.com").toLowerCase();
const password = process.env.SEED_USER_PASSWORD || "demo-password-123";

async function main(): Promise<void> {
  const [existing] = await getDb()
    .select({ id: user.id, email: user.email })
    .from(user)
    .where(eq(user.email, email))
    .limit(1);

  if (existing) {
    console.log(`Seed user already exists: ${existing.email}`);
    return;
  }

  const result = await auth.api.signUpEmail({
    body: { name, email, password },
  });
  if (!result.user) throw new Error("Better Auth did not return the seeded user");
  console.log(`Seed user created: ${result.user.email}`);
}

try {
  await main();
} finally {
  await closeDb();
}
