# Sectors Context Agent

AI agent for Indonesian stock investigations. Ask why a ticker moved — e.g. "Kenapa ANTM bergerak hari ini?" — and get an evidence-backed explanation with a driver, confidence, and what to monitor. Every investigation is scoped per user, keeps its evidence, and supports scoped follow-up questions.

- **Web** — React 19 + Vite+ (TanStack Router), `http://localhost:5173`
- **API** — Hono, `http://localhost:3001`. All secrets and AI calls stay server-side; the browser only talks to `/api/*`
- **Agent** — LangGraph staged workflow (baseline → signals → plan → tools → synthesize → finalize) on the AI SDK, against any OpenAI-compatible gateway
- **Data** — Sectors REST API v2 + Sectors MCP tools, PostgreSQL 17 + Drizzle

Product docs: [PRD.md](./PRD.md) · [MVP.md](./MVP.md) · [INTENT.md](./INTENT.md) · agent conventions: [AGENTS.md](./AGENTS.md)

## Requirements

| Tool        | Notes                                                            |
| ----------- | ---------------------------------------------------------------- |
| Node.js 22+ | `node -v`                                                        |
| pnpm 12     | `corepack enable` (the repo pins the version) or `npm i -g pnpm` |
| Docker      | for Postgres 17 — or point `DATABASE_URL` at your own Postgres   |

## Setup

```bash
git clone https://github.com/Laznology/sectors-context-agent.git
cd sectors-context-agent

pnpm install
cp .env.example .env     # fill the empty keys — see the table below
docker compose up -d     # Postgres 17 on localhost:5432
pnpm db:migrate          # create tables
pnpm db:seed:user        # local demo user
pnpm dev                 # web :5173 + api :3001 together
```

Then open **http://localhost:5173** and sign in with `demo@example.com` / `demo-password-123` (override with `SEED_USER_*` in `.env` before seeding).

## .env keys

| Key                                                         | Value                                                                                                                      |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `AI_GATEWAY_URL`                                            | Any OpenAI-compatible base URL, e.g. `https://ai-gateway.vercel.sh/v1` or a local gateway like `http://localhost:20128/v1` |
| `AI_GATEWAY_API_KEY`                                        | Key for that gateway                                                                                                       |
| `AI_MODEL_PLANNER` / `AI_MODEL_SYNTHESIZER`                 | Model IDs with tool calling + structured output, e.g. `antigravity/gemini-3.6-flash-medium`                                |
| `SECTORS_API_KEY`                                           | Your sectors.app API key                                                                                                   |
| `SECTORS_BASE_URL`                                          | `https://api.sectors.app/v2` (default)                                                                                     |
| `SECTORS_MCP_URL`                                           | `https://sectors-mcp.supertype.ai/mcp` (default; keep the `/mcp` path)                                                     |
| `DATABASE_URL`                                              | Matches the docker-compose defaults. If 5432 is taken, set `POSTGRES_PORT=5433` and use 5433 in the URL                    |
| `BETTER_AUTH_SECRET`                                        | Generate with `openssl rand -base64 32`                                                                                    |
| `PORT`                                                      | API port, default `3001`                                                                                                   |
| `SEED_USER_NAME` / `SEED_USER_EMAIL` / `SEED_USER_PASSWORD` | Optional demo-user overrides                                                                                               |

## Daily commands

| Command                         | Does                                                          |
| ------------------------------- | ------------------------------------------------------------- |
| `pnpm dev`                      | Web + API together — Vite proxies `/api` to `:3001`           |
| `pnpm dev:web` · `pnpm dev:api` | Run only one side                                             |
| `pnpm test`                     | Unit tests (Vitest via Vite+)                                 |
| `pnpm check`                    | Format + lint + typecheck in one go                           |
| `pnpm build`                    | Type-check + production build                                 |
| `pnpm db:generate`              | Generate a migration after changing `src/server/db/schema.ts` |
| `pnpm db:migrate`               | Apply migrations                                              |
| `pnpm db:studio`                | Drizzle Studio (inspect data)                                 |

## Verify real integrations (optional)

```bash
# AI gateway + Sectors MCP reachability, with one real tool call:
pnpm exec tsx src/server/scripts/smoke.ts
pnpm exec tsx src/server/scripts/smoke.ts fetch-foreign-flow '{"symbol":"ANTM"}'

# Full HTTP flow against a running API (pnpm dev:api), using the seeded user:
pnpm exec tsx src/server/scripts/e2e.ts
```

## API surface

Everything lives under `/api`; session-cookie auth via Better Auth.

```text
GET    /api/health
GET    /api/me
GET    /api/watchlist                 POST /api/watchlist       DELETE /api/watchlist/:ticker
GET    /api/investigations            POST /api/investigations
GET    /api/investigations/:id
GET    /api/investigations/:id/events       SSE progress stream
POST   /api/investigations/:id/chat         scoped follow-up (completed runs only)
POST   /api/auth/*                          Better Auth
```

## Project layout

```text
src/
  routes/  components/   web pages (scaffolded, JSDoc TODOs — FE work)
  server/                Hono API, agents, db, scripts
  shared/                Zod schemas shared by web + server
```

## Troubleshooting

- **`ECONNREFUSED` on 5432** — Postgres is not ready yet: `docker compose up -d`, check `docker compose ps` until healthy, then migrate.
- **Port 5432 already in use** — set `POSTGRES_PORT=5433` in `.env` and update `DATABASE_URL` to match.
- **`AI_GATEWAY_URL is not set`** — `.env` is missing or the key is empty; copy `.env.example`.
- **MCP 404** — `SECTORS_MCP_URL` must end with `/mcp`.
- **Chat fails or answers are empty** — the configured model must support tool calling; list available models via `GET` on your gateway's `/models`.
- **Windows** — run the setup commands in Git Bash or WSL (`cp`, `openssl`).
