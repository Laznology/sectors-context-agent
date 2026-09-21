import "dotenv/config";

/**
 * End-to-end HTTP smoke test against a running API server and real Postgres.
 *
 * Usage:
 *   pnpm exec tsx src/server/index.ts   # start the API first
 *   pnpm exec tsx src/server/scripts/e2e.ts
 */
const base = `http://localhost:${process.env.PORT ?? 3001}`;
const origin =
  process.env.BETTER_AUTH_TRUSTED_ORIGINS?.split(",")[0]?.trim() || "http://localhost:5173";
const email = (process.env.SEED_USER_EMAIL?.trim() || "demo@example.com").toLowerCase();
const password = process.env.SEED_USER_PASSWORD || "demo-password-123";

const cookies = new Map<string, string>();

function cookieHeader(): string {
  return [...cookies].map(([name, value]) => `${name}=${value}`).join("; ");
}

function captureCookies(response: Response): void {
  for (const value of response.headers.getSetCookie()) {
    const [pair] = value.split(";");
    const index = pair.indexOf("=");
    if (index > 0) cookies.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
  }
}

async function call(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Origin", origin);
  if (cookies.size > 0) headers.set("Cookie", cookieHeader());
  if (init.body) headers.set("Content-Type", "application/json");
  const response = await fetch(base + path, { ...init, headers });
  captureCookies(response);
  return response;
}

function fail(message: string): never {
  throw new Error(message);
}

async function main(): Promise<void> {
  const health = await call("/api/health");
  console.log(`health: ${health.status} ${JSON.stringify(await health.json())}`);

  const signIn = await call("/api/auth/sign-in/email", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (!signIn.ok) fail(`sign-in failed: ${signIn.status} ${await signIn.text()}`);
  console.log(`sign-in: ${signIn.status} (${email})`);

  const created = await call("/api/investigations", {
    method: "POST",
    body: JSON.stringify({ ticker: "ANTM", question: "Kenapa ANTM bergerak hari ini?" }),
  });
  if (created.status !== 202) fail(`create failed: ${created.status} ${await created.text()}`);
  const { id } = (await created.json()) as { id: string };
  console.log(`create: 202 ${id}`);

  const events = await call(`/api/investigations/${id}/events`);
  const reader = events.body?.getReader();
  if (!reader) fail("events stream has no body");
  const first = await reader.read();
  const chunk = new TextDecoder().decode(first.value ?? new Uint8Array());
  console.log(`sse: ${events.status} ${chunk.trim().split("\n")[0] ?? ""}`);
  await reader.cancel();

  const deadline = Date.now() + 300_000;
  let status = "pending";
  while (Date.now() < deadline) {
    const detail = await call(`/api/investigations/${id}`);
    if (!detail.ok) fail(`detail failed: ${detail.status}`);
    const body = (await detail.json()) as { status: string };
    if (body.status !== status) {
      status = body.status;
      console.log(`status: ${status}`);
    }
    if (status === "completed" || status === "failed") break;
    await new Promise((resolve) => setTimeout(resolve, 3_000));
  }
  if (status !== "completed") fail(`investigation ended as ${status}`);

  const chat = await call(`/api/investigations/${id}/chat`, {
    method: "POST",
    body: JSON.stringify({ message: "Apakah foreign flow masih berlanjut?" }),
  });
  if (!chat.ok) fail(`chat failed: ${chat.status} ${await chat.text()}`);
  const chatBody = (await chat.json()) as { message: { content: string } };
  console.log(`chat: ${chat.status} ${chatBody.message.content.slice(0, 160)}`);

  const list = await call("/api/investigations");
  if (!list.ok) fail(`list failed: ${list.status}`);
  const listBody = (await list.json()) as { investigations: Array<{ id: string }> };
  console.log(`list: ${list.status} ${listBody.investigations.length} investigations`);
  if (!listBody.investigations.some((item) => item.id === id)) {
    fail("created investigation missing from list");
  }

  const added = await call("/api/watchlist", {
    method: "POST",
    body: JSON.stringify({ ticker: "bbca" }),
  });
  if (added.status !== 201) fail(`watchlist add failed: ${added.status} ${await added.text()}`);
  const watchlist = await call("/api/watchlist");
  const watchlistBody = (await watchlist.json()) as { watchlist: Array<{ ticker: string }> };
  const tickers = watchlistBody.watchlist.map((item) => item.ticker).join(",");
  console.log(`watchlist: ${watchlist.status} ${tickers}`);
  if (!watchlistBody.watchlist.some((item) => item.ticker === "BBCA")) {
    fail("BBCA missing from watchlist");
  }

  const removed = await call("/api/watchlist/BBCA", { method: "DELETE" });
  if (removed.status !== 204) fail(`watchlist remove failed: ${removed.status}`);
  console.log(`watchlist remove: ${removed.status}`);

  console.log("e2e ok");
}

await main();
