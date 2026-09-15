<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Built-in Commands vs Scripts

`vp <name>` runs a built-in command. `vp run <name>` runs a `package.json` script or a `vite.config.ts` task. Scripts cannot overwrite built-ins, so `vp dev` and `vp run dev` may do different things. Check `package.json` and `vite.config.ts` first, and run `vp run <name>` when the project defines a script or task with that name.

## Tool Versions

Run `vp toolchain` to show versions and relationships in the active Vite+
release. Add a tool name to select part of the graph. For example, run
`vp toolchain vite`. Use `--global` to ignore the local `vite-plus` package. Use
`vp why <package>` to show the package-manager dependency graph.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->
<!--PROJECT BEGIN-->

## Purpose

This file defines how coding agents should work in the **Sectors Context Agent** repository.

Read `INTENT.md` before making product or architecture decisions. `INTENT.md` explains what the product is trying to achieve and what is intentionally out of scope. This file explains how to change the code safely and consistently.

## Source of Truth

When instructions conflict, use this order:

1. The user's current explicit request.
2. `INTENT.md` for product goals, scope, constraints, and non-goals.
3. This `AGENTS.md` for repository-wide engineering rules.
4. Existing local code patterns and tests.
5. General framework conventions.

Do not silently reinterpret product intent to fit an implementation preference.

## Working Principles

- Inspect before editing. Read the smallest relevant set of files, configuration, tests, and call sites before making changes.
- Make the smallest maintainable change that fully solves the request.
- Prefer existing patterns over introducing new abstractions.
- Do not perform unrelated refactors, dependency upgrades, formatting sweeps, or file moves.
- Do not invent APIs, environment variables, scripts, endpoints, database fields, or Sectors capabilities.
- Do not claim a command, test, build, API call, or integration works unless it was actually verified.
- Keep boundaries explicit: UI, server, agent orchestration, deterministic analysis, external data, and persistence should not collapse into one module.
- Optimize for code that another agent or teammate can understand quickly.

## Project Shape

This is a single-package, single-repository application.

Do not convert it into:

- a monorepo;
- Next.js;
- TanStack Start;
- microservices;
- a separate Python backend;

unless the user explicitly changes that decision.

Target architecture:

```text
React + Vite+
  |
  | HTTP / SSE
  v
Hono server
  |
  v
LangGraph orchestration
  |-- deterministic TypeScript analysis
  |-- Vercel AI SDK model calls
  |-- Sectors semantic tools
  `-- PostgreSQL persistence
```

Primary technology direction:

- React
- Vite+
- TypeScript
- TanStack Router
- TanStack Query
- Zod
- Hono on Node.js
- LangGraph.js for orchestration
- Vercel AI SDK for model interaction
- Vercel AI Gateway for model/provider access
- Sectors REST API v2 as the primary market-data integration
- PostgreSQL + Drizzle for persistence
- SSE for investigation progress streaming

Some target dependencies may not be installed yet. Always inspect `package.json` before importing or configuring them.

## Package Manager and Commands

Use **pnpm only**.

Known repository commands:

```bash
pnpm dev
pnpm build
pnpm lint
pnpm preview
pnpm prepare
```

Do not replace Vite+ commands with raw Vite commands unless there is a demonstrated compatibility reason.

Before finishing a code change:

1. run the narrowest relevant tests if tests exist;
2. run `pnpm build`;
3. run `pnpm lint` when the change can affect linted code;
4. report any failure accurately, including whether it appears pre-existing.

Do not hide failing validation by weakening TypeScript, ESLint, Zod schemas, or test assertions.

## TypeScript Rules

- Prefer strict, explicit types at system boundaries.
- Prefer inference inside small local functions.
- Use `unknown` instead of `any` for untrusted external data.
- Validate external input and API responses with Zod when correctness depends on their shape.
- Prefer `z.infer<typeof Schema>` instead of duplicating a schema as a separate interface.
- Keep functions focused and names domain-specific.
- Prefer pure functions for financial calculations.
- Avoid speculative generic helpers and premature framework abstractions.
- Never suppress a type error with `as any` merely to make a build pass.

## Frontend Rules

The frontend is a React SPA.

Use:

- TanStack Router for routing;
- TanStack Query for server-state fetching/caching;
- local React state only for local UI state.

Do not duplicate server state into global client stores without a concrete need.

The primary UI is an **agent investigation workspace**, not a traditional financial dashboard.

Prefer interfaces that expose:

- what changed;
- why it may matter;
- evidence;
- investigation progress/path;
- confidence;
- what to monitor;
- scoped follow-up questions.

Do not turn the product into a wall of raw financial metrics.

## Server Rules

Server-only concerns must stay server-side:

- Sectors API keys;
- AI Gateway credentials;
- model calls;
- database credentials;
- LangGraph execution;
- privileged external API calls.

The browser should call application endpoints such as `/api/...`; it must not receive private provider credentials.

Prefer Hono routes with explicit Zod-validated request and response boundaries.

Use native `fetch` for ordinary HTTP integrations unless a dependency provides material value beyond it.

## Agent Architecture

**LangGraph owns orchestration.**

Do not add a second autonomous agent loop using AI SDK Agents, LangChain ReAct agents, or another orchestration framework unless explicitly requested.

Prefer explicit graph stages such as:

```text
collect baseline
-> calculate deterministic signals
-> plan investigation
-> conditionally collect evidence
-> synthesize
-> persist result/state
```

Agent behavior must be inspectable and auditable.

The LLM may:

- form hypotheses;
- choose among approved semantic tools;
- interpret evidence;
- synthesize an explanation;
- answer scoped follow-up questions.

The LLM must not:

- invent unavailable financial data;
- perform routine numeric calculations that deterministic TypeScript can perform;
- generate arbitrary HTTP requests;
- decide arbitrary shell commands;
- silently ignore failed tools;
- produce BUY/SELL/HOLD instructions as product output.

## Deterministic Analysis

Financial calculations belong in deterministic TypeScript functions.

Examples:

- daily return;
- relative return versus benchmark;
- rolling average volume;
- volume ratio;
- z-scores or configured anomaly thresholds;
- foreign-flow deltas.

The LLM receives the resulting facts and metrics for interpretation.

Do not ask the model to calculate values that can be computed reliably in code.

## Sectors Integration

Sectors is the primary market-data source for the product.

Use **Sectors REST API v2** through an application-owned typed client and semantic wrappers.

Preferred shape:

```text
agent node
-> semantic tool
-> validation
-> Sectors client
-> validated result
-> evidence
```

Examples of semantic tools:

- `get_stock_price_context`
- `get_market_context`
- `get_sector_context`
- `get_foreign_flow`
- `get_broker_activity`
- `get_company_news`
- `get_company_filings`

Do not give the LLM a generic arbitrary-URL fetch tool.

Do not use shell execution or generated `curl` commands for routine Sectors API calls.

MCP is optional. It may extend the product later, but it is not the primary dependency for the MVP.

Code execution is also optional and should only be introduced for genuinely dynamic analysis that cannot reasonably be expressed as audited application code.

## Evidence and Claims

Every substantive investigation claim should be traceable to collected evidence.

Store enough context to answer:

- which source/tool was used;
- why it was used;
- what it returned;
- how it contributed to the conclusion.

If data is unavailable, say it is unavailable. Do not infer a missing value.

If evidence conflicts, preserve the conflict and lower confidence rather than forcing a neat narrative.

Do not expose private model chain-of-thought. Expose concise investigation steps, tool choices, evidence, and conclusions instead.

## Product Safety Boundary

The application provides market context and evidence, not investment advice.

Do not implement product output that presents:

- guaranteed returns;
- price targets as facts;
- automated BUY/SELL/HOLD recommendations;
- trade execution;
- fabricated certainty.

Preferred language concerns:

- analysis;
- evidence;
- context;
- observation;
- attention;
- confidence;
- what to monitor.

## Persistence and Memory

Memory should be structured and product-specific.

For the MVP, prefer relational state such as:

- prior investigations;
- ticker;
- classification;
- metrics;
- evidence summaries;
- confidence;
- timestamps;
- scoped conversation history.

Do not add a vector database merely because the product uses an LLM.

When comparing with a previous investigation, use persisted evidence/state rather than asking the model to reconstruct history from prose.

## Dependencies

Before adding a dependency:

1. verify the existing stack cannot solve the problem cleanly;
2. prefer small, actively maintained, framework-native packages;
3. avoid overlapping libraries with the same responsibility;
4. explain any architecture-level addition in the change summary.

Do not add dependencies for trivial helpers.

## Environment and Secrets

Never commit real secrets.

Expected secret categories may include:

- Sectors API credentials;
- AI Gateway credentials;
- database credentials.

Use environment variables and maintain `.env.example` without real values.

Never expose server secrets through Vite client environment variables.

## Git and Change Discipline

- Do not rewrite history, force-push, rebase, or delete branches unless explicitly requested.
- Do not commit generated secrets or local environment files.
- Do not modify unrelated files just to make a diff look cleaner.
- Preserve user changes that are unrelated to the current task.
- If an existing working pattern differs from this file, inspect why before replacing it.

## When Product Intent Changes

If a user request materially changes:

- the target user;
- core problem;
- product outcome;
- primary interface;
- major constraints;
- major non-goals;

update `INTENT.md` as part of the same change when appropriate.

Do not rewrite `INTENT.md` for ordinary implementation details.

## Definition of Done

A change is done when:

- it satisfies the requested behavior;
- it preserves the intent and architecture unless the request changes them;
- affected external boundaries are validated;
- relevant failure paths are handled;
- build/lint/tests have been run where applicable;
- no secrets are exposed;
- no unsupported financial claims were introduced;
- the final report states what changed and what was actually verified.

<!--PROJECT END-->
