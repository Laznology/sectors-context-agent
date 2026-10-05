# Deploying with Docker

One image runs the whole app: the built React SPA and the Hono API on a single
port. Postgres runs as a second container (Compose) or stays external.

## What the image contains

| Path                       | Why                                                                    |
| -------------------------- | ---------------------------------------------------------------------- |
| `dist/`                    | Vite SPA bundle, served by Hono (`/` and every client-side route)      |
| `src/server`, `src/shared` | Server source, executed directly by Node's native TypeScript stripping |
| `drizzle/`                 | SQL migrations applied on boot by `src/server/scripts/migrate.ts`      |
| `node_modules`             | Production dependencies only                                           |

No `nginx`, no reverse-proxy container, no bundler in the runtime image.

## 1. Configure

```bash
cp .env.example .env
```

Required for a working deployment:

| Variable                                                                           | Production value                                                                                              |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                                                     | Set by Compose automatically. For `docker run`, use the external host: `postgres://user:pass@db:5432/sectors` |
| `BETTER_AUTH_SECRET`                                                               | `openssl rand -base64 32`                                                                                     |
| `BETTER_AUTH_URL`                                                                  | Public origin of the app, e.g. `https://app.example.com`                                                      |
| `BETTER_AUTH_TRUSTED_ORIGINS`                                                      | Same origin, comma separated (`http://localhost:5173` is always allowed)                                      |
| `SECTORS_API_KEY`                                                                  | Sectors REST v2 key                                                                                           |
| `AI_GATEWAY_URL`, `AI_GATEWAY_API_KEY`, `AI_MODEL_PLANNER`, `AI_MODEL_SYNTHESIZER` | AI gateway credentials                                                                                        |

Keep `PORT` unset in `.env`: the image sets `3000` and Compose publishes it.

## 2. Deploy with Compose (app + Postgres)

```bash
docker compose up -d --build
docker compose ps          # app must reach "healthy"
docker compose logs -f app
```

First boot creates the database, applies migrations, then serves on
`http://localhost:3000`. Change the host port with `APP_PORT=8080 docker compose up -d`.

Stop / remove:

```bash
docker compose down          # keeps the database volume
docker compose down -v       # deletes the database too
```

## 3. Deploy with plain Docker (external database)

```bash
docker build -t sectors-context-agent .

docker run -d \
  --name sectors-context-app \
  --restart unless-stopped \
  -p 3000:3000 \
  --env-file .env \
  -e NODE_ENV=production \
  -e PORT=3000 \
  -e DATABASE_URL='postgres://user:pass@db-host:5432/sectors' \
  -e BETTER_AUTH_URL='https://app.example.com' \
  -e BETTER_AUTH_TRUSTED_ORIGINS='https://app.example.com' \
  sectors-context-agent
```

### Prebuilt image from GHCR

Every push to `main` and every `v*` tag publishes `ghcr.io/<owner>/<repo>`
(linux/amd64) via `.github/workflows/docker.yml`. To deploy that instead of
building on the server, replace `build: .` in `docker-compose.yml` with the
image reference:

```yaml
app:
  image: ghcr.io/<owner>/<repo>:main
```

```bash
docker compose pull && docker compose up -d
```

Public packages pull anonymously — no login, no token. Log in only if the
package is private (or the repo is private):

```bash
echo "$CR_PAT" | docker login ghcr.io -u <github-user> --password-stdin   # PAT classic, read:packages
```

The workflow itself needs no PAT: Actions injects `secrets.GITHUB_TOKEN`, which
can push packages for its own repository. `docker/metadata-action` also writes
the `org.opencontainers.image.source` label, which links the package to the repo
so that token keeps write access on later runs.

## 4. Verify

```bash
docker compose exec app node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>r.json().then(console.log))"
curl -fsS http://localhost:3000/            | head -c 120   # index.html
curl -fsSI http://localhost:3000/assets/    | grep -i cache-control
curl -fsS -o /dev/null -w '%{http_code}\n' http://localhost:3000/sign-in   # 200, SPA fallback
```

`/api/health` returns `503` while Postgres is unreachable, which is what the
container `HEALTHCHECK` reports as unhealthy.

## 5. Migrations

Applied automatically on every boot; Drizzle skips already-applied files.
To apply them by hand (for example against a staging database):

```bash
docker compose exec app node src/server/scripts/migrate.ts
```

`pnpm db:generate` (drizzle-kit, local only) writes new SQL into `drizzle/` —
commit it, then rebuild.

## 6. Upgrade

```bash
git pull
docker compose up -d --build      # migrations run at startup
```

Rollback = redeploy the previous image tag; schema changes are forward-only, so
restore a backup if you must go back across a destructive migration.

## 7. Backup and restore

```bash
docker compose exec -T postgres pg_dump -U sectors -Fc sectors > sectors.dump
docker compose exec -T postgres pg_restore -U sectors -d sectors --clean < sectors.dump
```

## 8. Operations

```bash
docker compose logs -f app                      # structured JSON logs
docker compose exec app node src/server/scripts/seed-user.ts   # create a user
docker compose restart app                      # graceful SIGTERM shutdown (10s)
docker image inspect sectors-context-agent --format '{{.Size}}'
```

Put TLS in front of the container (Caddy, nginx, cloud load balancer) and set
`BETTER_AUTH_URL` / `BETTER_AUTH_TRUSTED_ORIGINS` to the HTTPS origin. The
container itself speaks plain HTTP on `3000`.

## Troubleshooting

| Symptom                                           | Cause                                                                             |
| ------------------------------------------------- | --------------------------------------------------------------------------------- |
| Container restarts, log `DATABASE_URL is not set` | `.env` missing or not passed (`--env-file .env`)                                  |
| `migrate` hangs                                   | Postgres not ready; Compose waits for its healthcheck, plain Docker does not      |
| Blank page, 404 on `/sign-in`                     | `dist/` missing: build stage failed, check `docker build` output                  |
| 404 with JSON body                                | Path is not a GET and matched no route; only GET falls through to `index.html`    |
| Auth `Invalid origin`                             | `BETTER_AUTH_URL` / `BETTER_AUTH_TRUSTED_ORIGINS` do not match the browser origin |
| Image build fails on native bindings              | musl platform; rebuild with `--platform linux/amd64`                              |
