# Product Requirements Document

## Product Name

**Sectors Context Agent**

Working tagline:

> Understand what changed, why it matters, and what deserves your attention.

---

# 1. Product Overview

Sectors Context Agent adalah AI-powered market investigation assistant untuk investor saham Indonesia yang sudah memahami dasar saham tetapi masih kesulitan menginterpretasikan berbagai data pasar secara bersamaan.

Produk tidak memberikan rekomendasi BUY/SELL.

Produk membantu user menjawab:

> “Kenapa saham di watchlist saya bergerak, dan data apa yang paling relevan untuk menjelaskannya?”

Agent akan mengambil data dari Sectors, menentukan data tambahan apa yang perlu diperiksa, lalu menghasilkan explanation berbasis evidence.

Sectors API atau Sectors MCP wajib menjadi sumber data utama.

---

# 2. Target User

Primary persona:

Investor retail Indonesia level beginner-to-intermediate yang:

- sudah memahami ticker, return, volume, fundamental dasar;
- memiliki watchlist sendiri;
- belum nyaman membaca banyak dashboard finansial;
- harus membuka beberapa halaman untuk memahami penyebab pergerakan saham;
- membutuhkan explanation, bukan tambahan raw data.

Produk bukan ditujukan untuk trader profesional atau quantitative analyst.

---

# 3. Primary User Problem

Existing financial dashboards menunjukkan data.

Masalahnya, user masih harus menentukan sendiri:

- apakah pergerakan saham berasal dari market;
- apakah subsector ikut bergerak;
- apakah volume tidak normal;
- apakah foreign investor masuk atau keluar;
- broker mana yang melakukan accumulation/distribution;
- apakah terdapat news atau filing yang relevan.

Sectors Context Agent melakukan proses investigasi tersebut secara otomatis.

---

# 4. Core Product Question

Agent harus mengoptimalkan seluruh workflow untuk menjawab:

> “What changed, why did it happen, and what should I pay attention to?”

Bukan:

> “Should I buy this stock?”

Agent harus menjadi information and analysis tool dan tidak boleh memberikan financial advice atau automated trading recommendation.

---

# 5. MVP Scope

MVP terdiri dari:

1. Watchlist management.
2. Stock investigation.
3. Custom agent orchestration.
4. Conditional Sectors tool routing.
5. Evidence-based explanation.
6. Investigation history.
7. Basic memory/state between investigations.
8. Simple dashboard.
9. Follow-up question terhadap hasil investigation.

Tidak termasuk MVP:

- automated trading;
- BUY/SELL recommendation;
- portfolio optimization;
- stock price prediction;
- SRBI;
- Equity Risk Premium;
- WhatsApp/Telegram notification;
- intraday monitoring;
- real-time price alert;
- complex authentication;
- social/community feature;
- backtesting engine.

Do not implement features outside MVP until all MVP acceptance criteria pass.

---

# 6. Main User Flow

## Flow A — Add Watchlist

User opens dashboard.

User enters ticker:

`ANTM`

System validates ticker through Sectors.

Ticker is added to user's watchlist.

Dashboard displays basic information:

- ticker;
- company name;
- latest available close;
- last investigation status;
- last investigated time.

---

## Flow B — Investigate Stock

User selects:

`ANTM → Investigate`

Frontend sends:

```json
{
  "ticker": "ANTM",
  "question": "Why did ANTM move?"
}
```

Backend creates an investigation.

Status:

```text
pending
↓
collecting_context
↓
investigating
↓
synthesizing
↓
completed
```

Frontend should display investigation progress.

---

# 7. Agent Architecture

Implement custom orchestration.

Do NOT simply expose every Sectors tool directly to an LLM.

Architecture:

```text
User Request
      ↓
Ticker Resolver
      ↓
Context Collector
      ↓
Deterministic Signal Calculator
      ↓
Agent Planner
      ↓
Conditional Tool Router
      ↓
Evidence Store
      ↓
LLM Synthesizer
      ↓
Structured Investigation Result
      ↓
Memory Persistence
```

The system must contain application logic outside the LLM prompt.

---

# 8. Investigation Workflow

## Stage 1 — Resolve Context

Validate ticker.

Fetch company overview.

Determine:

- company name;
- sector;
- subsector;
- index membership where available.

If ticker does not exist:

Return a user-friendly validation error.

---

# 9. Stage 2 — Market Context

Fetch approximately 20–30 trading days of stock data.

Required data:

- close;
- volume;
- daily return.

Fetch corresponding market index historical data.

Preferred benchmark:

IHSG / appropriate available broad IDX benchmark.

Calculate:

```text
stock_return_1d
market_return_1d

relative_return =
stock_return_1d - market_return_1d
```

Calculate:

```text
avg_volume_20d =
average(volume previous 20 trading days)

volume_ratio =
current_volume / avg_volume_20d
```

These calculations must be performed in application code.

Do not ask the LLM to calculate them.

---

# 10. Stage 3 — Initial Classification

Create deterministic flags.

Example:

```text
ABS(relative_return) >= threshold
→ unusual_relative_move

volume_ratio >= threshold
→ unusual_volume
```

Thresholds should be configuration values.

Initial defaults:

```text
RELATIVE_RETURN_THRESHOLD = 0.02
VOLUME_RATIO_THRESHOLD = 1.5
```

These are product heuristics, not financial recommendations.

Store calculated signals as evidence.

---

# 11. Stage 4 — Agent Planning

Provide the Agent Planner with:

- ticker;
- company context;
- market context;
- calculated signals;
- user's question;
- available tool definitions.

Planner must return structured JSON.

Example:

```json
{
  "hypotheses": ["market_driven", "sector_driven", "flow_driven", "company_specific"],
  "tools": [
    {
      "name": "get_sector_context",
      "reason": "Determine whether peers moved similarly"
    },
    {
      "name": "get_foreign_flow",
      "reason": "Check participation shift"
    }
  ]
}
```

The planner must select tools based on evidence.

Do not call every tool for every investigation.

---

# 12. Agent Tools

Implement application-owned tool wrappers.

Suggested tool interface:

```ts
interface AgentTool<TInput, TOutput> {
  name: string;
  description: string;

  execute(input: TInput): Promise<TOutput>;
}
```

Required tools for MVP:

### get_company_context

Returns:

- company overview;
- sector;
- subsector.

Underlying Sectors data:

company report.

---

### get_price_context

Returns historical:

- close;
- volume;
- market cap where available.

Underlying Sectors data:

daily transaction.

---

### get_market_context

Returns benchmark historical daily data.

Underlying Sectors data:

index daily.

---

### get_sector_context

Returns relevant subsector information.

Used to determine whether movement is sector-wide.

---

### get_foreign_flow

Returns daily foreign inflow/outflow for stock.

---

### get_broker_activity

Returns top accumulating and distributing brokers.

Use broker-summary-top or equivalent Sectors endpoint/tool.

---

### get_company_news

Returns recent company news.

Limit results to a relevant recent time window.

---

### get_company_filings

Returns recent available filings/events relevant to ticker.

---

# 13. Conditional Tool Routing

Implement explicit routing rules.

Example:

```text
START
 |
 | fetch price + market
 |
 ├── Normal movement
 |      ↓
 |    limited investigation
 |
 └── Unusual movement
        ↓
      sector context
        ↓
      foreign flow
        ↓
      broker activity
        ↓
      news / filings
```

Agent Planner may modify this route.

Example:

If user asks:

> “Apakah pergerakan ANTM hari ini disebabkan foreign flow?”

Prioritize:

1. price;
2. market;
3. foreign flow;
4. broker activity.

Do not fetch unrelated financial statement data unless needed.

---

# 14. Evidence Model

Every tool call must create an evidence item.

Example:

```ts
type Evidence = {
  id: string;
  source: string;
  type: "market" | "price" | "volume" | "sector" | "foreign_flow" | "broker" | "news" | "filing";
  title: string;
  data: unknown;
  interpretation?: string;
  collectedAt: string;
};
```

The final response must only make factual claims supported by collected evidence.

---

# 15. Final Classification

Agent should classify investigation into one of:

```text
MARKET_DRIVEN
SECTOR_DRIVEN
FLOW_DRIVEN
COMPANY_SPECIFIC
MIXED
UNCLEAR
```

The classification is explanatory.

It must NOT imply:

```text
BUY
SELL
HOLD
```

---

# 16. Confidence

Return:

```text
HIGH
MEDIUM
LOW
```

Confidence should depend on evidence consistency.

Example logic:

HIGH:
multiple independent evidence sources support the same explanation.

MEDIUM:
some evidence supports explanation but alternative explanations remain.

LOW:
insufficient or conflicting evidence.

LLM must provide confidence_reason.

---

# 17. Final Agent Output

Agent must return structured output.

Example schema:

```ts
type InvestigationResult = {
  ticker: string;

  status: "normal" | "attention" | "unclear";

  classification:
    "MARKET_DRIVEN" | "SECTOR_DRIVEN" | "FLOW_DRIVEN" | "COMPANY_SPECIFIC" | "MIXED" | "UNCLEAR";

  whatChanged: string;

  whyItMatters: string;

  explanation: string;

  evidenceSummary: {
    label: string;
    finding: string;
    importance: "high" | "medium" | "low";
  }[];

  whatToMonitor: string[];

  confidence: "HIGH" | "MEDIUM" | "LOW";

  confidenceReason: string;

  disclaimer: string;
};
```

Required disclaimer:

```text
This analysis is informational and does not constitute investment advice.
```

---

# 18. Memory

Memory for MVP does not require vector database.

Use relational persistence.

For every completed investigation store:

- ticker;
- investigation date;
- calculated signals;
- classification;
- confidence;
- evidence summary;
- final explanation.

When another investigation occurs for the same ticker, retrieve the latest previous investigation.

Provide it to the agent as:

```json
{
  "previousInvestigation": {
    "classification": "FLOW_DRIVEN",
    "summary": "...",
    "date": "..."
  }
}
```

Agent should produce:

`changesSincePreviousInvestigation`

Example:

```text
Compared with the previous investigation:
foreign inflow continued but abnormal volume weakened.
```

This demonstrates meaningful state management.

---

# 19. Follow-up Conversation

Investigation detail page contains a simple input.

Example:

```text
User:
Apakah foreign flow ini baru terjadi hari ini?

Agent:
...
```

Follow-up agent receives:

- current investigation;
- collected evidence;
- conversation history.

It may call additional Sectors tools if necessary.

Do not create a completely general financial chatbot.

Conversation must remain scoped to the current investigation/ticker.

---

# 20. Database Model

Recommended database:

PostgreSQL / Supabase.

MVP tables:

## watchlists

```text
id
user_id
ticker
created_at
```

## investigations

```text
id
user_id
ticker
question
status
classification
confidence
what_changed
why_it_matters
explanation
what_to_monitor
created_at
completed_at
```

## investigation_evidence

```text
id
investigation_id
source
type
title
payload_json
interpretation
created_at
```

## agent_tool_calls

```text
id
investigation_id
tool_name
input_json
output_json
reason
duration_ms
created_at
```

## conversations

```text
id
investigation_id
role
content
created_at
```

Authentication may be simplified for hackathon demo.

A single demo user is acceptable during early development.

---

# 21. Suggested Backend API

Implement:

```text
GET    /api/watchlist
POST   /api/watchlist
DELETE /api/watchlist/:ticker

POST   /api/investigations
GET    /api/investigations
GET    /api/investigations/:id

POST   /api/investigations/:id/chat
```

Example investigation request:

```json
{
  "ticker": "ANTM",
  "question": "Why did ANTM move?"
}
```

---

# 22. Suggested Project Structure

```text
src/
├── app/
│   ├── dashboard/
│   ├── stocks/[ticker]/
│   ├── investigations/[id]/
│   └── api/
│
├── agents/
│   ├── context-agent.ts
│   ├── planner.ts
│   ├── synthesizer.ts
│   ├── schemas.ts
│   └── prompts/
│
├── tools/
│   ├── company-context.ts
│   ├── price-context.ts
│   ├── market-context.ts
│   ├── sector-context.ts
│   ├── foreign-flow.ts
│   ├── broker-activity.ts
│   ├── news.ts
│   └── filings.ts
│
├── sectors/
│   ├── client.ts
│   ├── types.ts
│   └── errors.ts
│
├── analysis/
│   ├── returns.ts
│   ├── volume.ts
│   └── signals.ts
│
├── db/
│   ├── queries/
│   └── schema/
│
└── lib/
```

Keep financial calculations separate from LLM logic.

---

# 23. Technology

Recommended:

Frontend:

- Next.js
- TypeScript
- Tailwind CSS

Backend:

- Next.js server routes or equivalent Node backend

Database:

- Supabase/PostgreSQL

Market Data:

- Sectors Financial API or Sectors MCP

LLM:

- any model supporting reliable structured output/tool use.

Do not depend on an external AI client such as Claude Desktop or Cursor as the product runtime.

The application itself must own the orchestration.

---

# 24. LLM Responsibilities

LLM MAY:

- formulate hypotheses;
- determine which analysis tools should be called;
- interpret evidence;
- synthesize explanation;
- answer follow-up questions;
- estimate explanation confidence.

LLM MUST NOT:

- invent financial data;
- calculate raw numerical metrics when application code can calculate them;
- issue BUY/SELL/HOLD instructions;
- execute trades;
- fabricate unavailable news;
- silently ignore failed tools.

---

# 25. Tool Failure Handling

Each tool must return either:

```ts
{
  ok: true,
  data: ...
}
```

or:

```ts
{
  ok: false,
  error: {
    code: string,
    message: string
  }
}
```

If Sectors returns no data, agent must state:

```text
Data unavailable
```

Do not infer a value.

If one optional tool fails, investigation may continue.

If core market/stock data fails, investigation status should become:

```text
failed
```

with a user-readable error.

---

# 26. UI Pages

MVP requires only three main views.

## Dashboard

Contains:

- product description;
- watchlist;
- latest investigation;
- investigate button.

---

## Investigation Detail

Contains:

### Header

```text
ANTM
PT Aneka Tambang Tbk
```

### Status

```text
NEEDS ATTENTION
```

### What Changed

Short summary.

### Why

Agent explanation.

### Evidence

Cards for:

- Price/Volume;
- Market;
- Sector;
- Foreign Flow;
- Broker Activity;
- News/Filings.

### Confidence

```text
Medium confidence
```

### What To Monitor

2–3 items maximum.

### Follow-up

Small scoped chat input.

---

## History

Show previous investigations grouped by ticker/date.

No complex analytics dashboard is required.

---

# 27. Explainability

Every investigation must expose:

1. which tools were used;
2. why each tool was selected;
3. major evidence found;
4. final classification;
5. confidence.

Optional UI:

```text
Investigation Path

✓ Price Context
  Large relative move detected

✓ Sector Context
  Peers did not show equivalent movement

✓ Foreign Flow
  Significant positive shift detected

✓ Broker Activity
  Accumulation concentrated in several brokers

✓ News
  No strong company catalyst found
```

This is important for demoing custom agent reasoning without exposing private model chain-of-thought.

---

# 28. Demo Scenario

Prepare one ticker with interesting historical/current Sectors data.

Demo flow:

### 0:00–0:20

Problem:

User sees a stock move but must inspect several datasets manually.

### 0:20–0:40

Open watchlist.

Select ANTM.

Press:

`Investigate`

### 0:40–1:20

Show agent process:

```text
Checking market context...
Checking sector...
Checking foreign flow...
Checking broker activity...
Checking company events...
```

### 1:20–2:10

Show final explanation and evidence.

Highlight that agent selected tools conditionally.

### 2:10–2:35

Ask follow-up:

```text
Is this movement company-specific?
```

Show answer grounded in existing evidence.

### 2:35–2:50

Show previous investigation comparison.

Demonstrate memory/state.

### 2:50–3:00

Closing statement:

Sectors Context Agent turns fragmented Indonesian market data into an auditable investigation for investors who know the basics but still struggle to connect the evidence.

---

# 29. Acceptance Criteria

MVP is complete only when all conditions below pass.

## Watchlist

- ticker can be added;
- invalid ticker produces error;
- watchlist persists.

## Investigation

- investigation works end-to-end;
- stock data comes from Sectors;
- index/market data comes from Sectors;
- at least three different Sectors data categories can be used;
- routing is conditional;
- tool calls are stored.

## Agent

- LLM is used;
- planner produces structured output;
- final response uses structured output;
- tool calls are application-controlled;
- unsupported claims are prohibited;
- no automated investment recommendation is produced.

## Evidence

- user can see supporting evidence;
- user can identify which tools were called;
- final conclusion references collected evidence.

## Memory

- investigation is persisted;
- previous investigation can be retrieved;
- new investigation can compare against previous investigation.

## UX

- user can understand the primary finding without reading raw API JSON;
- core workflow requires no external financial dashboard;
- investigation can be demonstrated end-to-end.

---

# 30. Testing

Unit test:

- stock return calculation;
- relative return calculation;
- average volume;
- volume ratio;
- signal thresholds;
- ticker normalization;
- output schema validation.

Integration test:

- Sectors client;
- individual tools;
- planner;
- investigation pipeline;
- database persistence.

Create mocked Sectors responses for automated tests to avoid consuming API credits unnecessarily.

At least one demo path must also be tested against real Sectors data.

---

# 31. Security

Environment variables:

```text
SECTORS_API_KEY
LLM_API_KEY
DATABASE_URL
```

Never expose keys to client-side JavaScript.

Never commit `.env`.

Add:

```text
.env*
```

to `.gitignore`.

Provide:

```text
.env.example
```

without actual credentials.

---

# 32. Observability

Every investigation should log:

```text
investigation_id
ticker
started_at
finished_at
tools_called
tool_duration
tool_error
agent_status
```

Create a development-only debug panel or log page showing tool execution.

This also helps demonstrate that the agent genuinely performs multi-step tool orchestration.

---

# 33. Product Boundaries

The application must describe outputs as:

- analysis;
- context;
- evidence;
- observations;
- signals requiring attention.

Avoid:

- recommended buy;
- recommended sell;
- price target;
- guaranteed upside;
- investment recommendation.

Always display:

> This analysis is informational and does not constitute investment advice.

---

# 34. Definition of Done

MVP is DONE when:

```text
User adds ticker
      ↓
User starts investigation
      ↓
App retrieves Sectors data
      ↓
App calculates deterministic signals
      ↓
Agent creates investigation plan
      ↓
Agent conditionally selects additional tools
      ↓
Tools retrieve supporting evidence
      ↓
Agent synthesizes evidence
      ↓
UI displays explanation
      ↓
Investigation is persisted
      ↓
Future investigation can reference previous state
```

If this complete workflow works reliably, stop adding features and focus on demo quality, error handling, repository quality, and presentation.
