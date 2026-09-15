# INTENT.md

## Intent: Sectors Context Agent

**Status:** Draft  
**Last updated:** 2026-09-15  
**Product track:** AI Agents & Assistants  
**Owner:** Team

## Problem

Indonesian retail investors who already understand basic stock concepts can still struggle to explain _why_ a stock in their watchlist moved.

Existing market platforms expose useful raw data, but interpreting a move often requires the user to manually connect several kinds of evidence:

- the stock's own price and volume;
- broad-market movement;
- sector or subsector movement;
- foreign flow;
- broker activity;
- company news;
- filings or corporate events.

This is especially painful for users in the transition between beginner and expert. They understand enough to know the data matters, but not enough to efficiently decide which data matters for a specific move.

Showing them another dashboard of raw metrics does not solve that problem.

## Proposed Outcome

Build a web-based AI market investigation agent that answers:

> **What changed, why did it happen, and what should I pay attention to?**

A user should be able to select a stock from a watchlist or start an investigation for a ticker.

The system should:

1. collect baseline stock and market context;
2. calculate deterministic signals such as relative return and abnormal volume;
3. form investigation hypotheses;
4. choose relevant Sectors data sources conditionally;
5. collect evidence from market, sector, flow, broker, news, or filing data;
6. synthesize a concise explanation;
7. expose the evidence and investigation path;
8. provide an explicit confidence level;
9. persist the investigation so a later run can explain what changed since the previous investigation.

The product should reduce the need to open multiple market screens merely to understand one meaningful stock movement.

## Target User

Primary user:

An Indonesian retail investor who:

- already knows basic stock terminology;
- has or follows a watchlist;
- can read simple financial metrics;
- is not yet comfortable interpreting multiple market datasets together;
- wants context and explanation rather than another raw-data terminal.

The MVP is not designed primarily for institutional allocators, quantitative researchers, or professional traders.

## Core User Job

When something meaningful happens to a stock I follow, help me understand:

- whether the move is unusual;
- whether it can be explained by the broader market;
- whether its sector moved similarly;
- whether participation or flow changed;
- whether broker activity supports that interpretation;
- whether there is a relevant company-specific event;
- what evidence supports the explanation;
- what I should monitor next.

## Primary Experience

The primary interface is a **web application**.

The core experience should include:

### Watchlist

A lightweight list of followed tickers with their latest investigation state.

### Investigation

The user can ask a scoped question such as:

> Why did ANTM move?

The agent performs a multi-step investigation rather than immediately generating a generic summary.

### Evidence

The result should present evidence in a form a transitioning investor can understand.

Useful categories include:

- price and volume;
- market benchmark;
- sector/subsector;
- foreign flow;
- broker activity;
- company news;
- company filings.

### Explanation

The system should explain:

- what changed;
- the most plausible driver or combination of drivers;
- why that interpretation is supported;
- confidence;
- what to monitor next.

### Follow-up

The user may ask follow-up questions scoped to the current ticker and investigation.

### History / Memory

A later investigation should be able to compare against prior persisted state, for example whether foreign flow continued or an abnormal-volume condition disappeared.

## Product Differentiator

The product is not valuable because it summarizes data.

It is valuable because it **investigates conditionally**.

The agent should not call every available tool for every ticker. It should use custom orchestration to decide which evidence is relevant to the case.

The resulting explanation should be auditable through visible evidence and investigation steps.

## Sectors Role

Sectors must be a core data dependency, not a decorative integration.

The product should derive its market investigation from Sectors data wherever the relevant data is available.

The MVP is expected to use multiple Sectors data categories, potentially including:

- daily transaction data;
- index data;
- sector/subsector context;
- foreign flow;
- broker activity;
- news;
- filings.

Application-owned semantic tools should wrap these capabilities.

## Agent Behavior

The agent should combine deterministic software and LLM reasoning.

### Deterministic software should handle

- return calculations;
- benchmark-relative return;
- rolling volume calculations;
- volume ratios;
- configured anomaly thresholds;
- other straightforward numerical transforms.

### LLM reasoning should handle

- hypothesis formation;
- choosing among approved investigation tools;
- interpreting evidence;
- reconciling multiple evidence sources;
- producing the final explanation;
- handling scoped follow-up questions.

The system should not delegate routine arithmetic to the LLM.

## Explanatory Classification

The MVP may classify an investigation using labels such as:

- `MARKET_DRIVEN`
- `SECTOR_DRIVEN`
- `FLOW_DRIVEN`
- `COMPANY_SPECIFIC`
- `MIXED`
- `UNCLEAR`

These labels are explanatory, not investment recommendations.

## Constraints

### Data cadence

Do not market the core stock investigation as real-time when the underlying Sectors data used by the feature is end-of-day.

The MVP should prefer investigation on demand and/or event/EOD-oriented workflows.

### Financial safety

The product is informational.

It should not present itself as personalized investment advice and should not make automated BUY, SELL, or HOLD decisions.

It should not execute trades.

### Evidence grounding

Factual claims in an investigation should be grounded in collected evidence.

Missing data should remain missing. Conflicting evidence should reduce confidence rather than being hidden.

### Explainability

The user should be able to see:

- which major investigation steps occurred;
- which evidence categories were checked;
- the important findings;
- the final classification;
- the confidence.

The UI should not expose private model chain-of-thought.

### Architecture

The intended implementation is a single repository and single package.

Current direction:

- React + Vite+;
- TanStack Router;
- TanStack Query;
- Hono server;
- LangGraph.js for orchestration;
- Vercel AI SDK for model interaction;
- Vercel AI Gateway for model/provider access;
- Sectors REST API v2;
- PostgreSQL + Drizzle;
- SSE for investigation progress.

Architecture may evolve when there is a concrete product or operational reason, not merely because another framework is available.

## Non-Goals for the MVP

Do not make these part of the core MVP unless product intent is explicitly changed:

- Equity Risk Premium dashboard;
- SRBI comparison;
- stock-price prediction;
- price targets;
- automated portfolio optimization;
- automated trading;
- BUY/SELL/HOLD recommendations;
- intraday real-time market alerts;
- Telegram as the primary interface;
- a general-purpose financial chatbot;
- a traditional raw-metrics dashboard;
- a vector database solely for the sake of having memory;
- arbitrary code execution for routine Sectors API calls;
- MCP as a mandatory foundation.

Telegram notifications, MCP extensions, or sandboxed code execution may be considered later if the core investigation workflow already works and they solve a specific validated need.

## MVP Success Criteria

The MVP is successful when a user can complete this flow end to end:

```text
select ticker
-> start investigation
-> collect baseline Sectors data
-> calculate deterministic signals
-> create an investigation plan
-> conditionally collect additional evidence
-> synthesize an evidence-backed explanation
-> inspect evidence and confidence
-> persist the investigation
-> reference previous investigation state later
```

The user should be able to understand the primary explanation without opening another financial platform for basic interpretation.

The implementation should make it evident that the product contains custom agent orchestration rather than a single prompt wrapped around raw data.

## UX Success Criteria

The primary result should answer, in order:

1. **What changed?**
2. **What is the likely driver?**
3. **What evidence supports that?**
4. **How confident is the system?**
5. **What should the user monitor next?**

The user should not need to decode a dense table of raw financial metrics before understanding the conclusion.

## Technical Success Criteria

The implementation should demonstrate:

- explicit orchestration owned by the application;
- conditional tool routing;
- deterministic financial calculations outside the LLM;
- structured tool/evidence boundaries;
- persisted investigation state;
- validated external-data boundaries;
- graceful handling of unavailable evidence;
- a visible investigation path suitable for demo and audit.

## Out-of-Scope Product Claims

Do not position the product as:

- a guaranteed alpha generator;
- a stock-picking oracle;
- a replacement for professional financial advice;
- a high-frequency or real-time trading system.

The product is a market-context investigation assistant.

## Open Questions

These should be resolved through implementation discovery, data availability, or product testing rather than guessed:

- Which broad-market benchmark should be the default when analyzing each IDX stock?
- Which anomaly thresholds produce useful signals without excessive noise?
- Which Sectors endpoints provide the most reliable sector/subsector comparison for the MVP?
- How much broker detail is useful to the target user before the interface becomes too technical?
- Which model should be used for planning versus synthesis?
- Is authentication necessary for the hackathon demo, or is a single demo user sufficient?
- Which ticker and historical/current scenario provides the strongest reproducible demo?

## Current Decisions

The following decisions are intentional unless new evidence changes them:

- Web is the primary interface.
- The product is an investigation agent, not a conventional dashboard.
- Sectors is the core market-data source.
- Custom orchestration is required.
- LangGraph is intended to own orchestration.
- Deterministic calculations stay in TypeScript.
- Vercel AI SDK handles model interaction rather than owning the agent loop.
- REST is the primary Sectors integration path.
- Routine Sectors access uses typed HTTP calls, not generated `curl` commands or code execution.
- Memory is structured persisted investigation state.
- ERP and SRBI are not part of the MVP.
- “Real-time” is not a core product claim for EOD-backed investigation.
- Telegram is optional later, primarily for notification/delivery rather than investigation.
