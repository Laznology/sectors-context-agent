# syntax=docker/dockerfile:1

# deps: full dependency tree. Layer is invalidated by the lockfile only.
FROM node:24-alpine AS deps
RUN apk add --no-cache git && npm i -g pnpm@12.4.2   # `prepare: vp config` shells out to git
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# build: typecheck + Vite SPA bundle.
FROM deps AS build
COPY . .
RUN pnpm build

# prod-deps: runtime tree only. NODE_ENV=production drops devDependencies.
FROM node:24-alpine AS prod-deps
RUN npm i -g pnpm@12.4.2
WORKDIR /app
ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts

# runtime: node runs the TypeScript server directly via native type stripping,
# so there is no server bundling step and no transpiled output to drift.
FROM node:24-alpine AS runtime
ENV NODE_ENV=production \
    PORT=3000
WORKDIR /app
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./
COPY --chown=node:node src/server ./src/server
COPY --chown=node:node src/shared ./src/shared
COPY --chown=node:node drizzle ./drizzle
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
# exec so node is PID 1 and receives SIGTERM from `docker stop`.
CMD ["sh", "-c", "node src/server/scripts/migrate.ts && exec node src/server/index.ts"]