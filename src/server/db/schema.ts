import { sql } from "drizzle-orm";
import {
  check,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type {
  ConversationRole,
  InvestigationClassification,
  InvestigationDriver,
  InvestigationEvidenceType,
  InvestigationStatus,
  InvestigationStatusLabel,
  InvestigationToolCallStatus,
} from "../../shared/schemas/investigation.ts";
import { user } from "./auth-schema.ts";

export * from "./auth-schema.ts";

export const watchlists = pgTable(
  "watchlists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    ticker: text("ticker").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("watchlists_user_ticker_idx").on(table.userId, table.ticker)],
);

/** One stock investigation run owned by one authenticated user. */
export const investigations = pgTable(
  "investigations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    ticker: text("ticker").notNull(),
    companyName: text("company_name"),
    subSector: text("sub_sector"),
    statusLabel: text("status_label").$type<InvestigationStatusLabel>(),
    question: text("question"),
    asOfDate: date("as_of_date"),
    status: text("status").$type<InvestigationStatus>().notNull().default("pending"),
    classification: text("classification").$type<InvestigationClassification>(),
    driver: text("driver").$type<InvestigationDriver>(),
    confidence: doublePrecision("confidence"),
    confidenceReason: text("confidence_reason"),
    signalsJson: jsonb("signals_json"),
    planJson: jsonb("plan_json"),
    evidenceSummary: text("evidence_summary"),
    evidenceSummaryJson: jsonb("evidence_summary_json"),
    disclaimer: text("disclaimer"),
    whatChanged: text("what_changed"),
    whyItMatters: text("why_it_matters"),
    explanation: text("explanation"),
    whatToMonitor: text("what_to_monitor"),
    whatToMonitorJson: jsonb("what_to_monitor_json"),
    changesSincePrevious: text("changes_since_previous"),
    comparisonJson: jsonb("comparison_json"),
    previousInvestigationId: uuid("previous_investigation_id"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("investigations_user_ticker_created_idx").on(table.userId, table.ticker, table.createdAt),
    check(
      "investigations_confidence_range",
      sql`${table.confidence} IS NULL OR (${table.confidence} >= 0 AND ${table.confidence} <= 1)`,
    ),
  ],
);

/** Evidence collected from a semantic data source for one investigation. */
export const investigationEvidence = pgTable(
  "investigation_evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    investigationId: uuid("investigation_id")
      .notNull()
      .references(() => investigations.id, { onDelete: "cascade" }),
    source: text("source").notNull(),
    type: text("type").$type<InvestigationEvidenceType>().notNull(),
    title: text("title").notNull(),
    payloadJson: jsonb("payload_json"),
    interpretation: text("interpretation"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("investigation_evidence_investigation_created_idx").on(
      table.investigationId,
      table.createdAt,
    ),
  ],
);

/** Audit trail of every application-controlled semantic tool call. */
export const agentToolCalls = pgTable(
  "agent_tool_calls",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    investigationId: uuid("investigation_id")
      .notNull()
      .references(() => investigations.id, { onDelete: "cascade" }),
    toolName: text("tool_name").notNull(),
    status: text("status").$type<InvestigationToolCallStatus>().notNull().default("pending"),
    inputJson: jsonb("input_json"),
    outputJson: jsonb("output_json"),
    reason: text("reason"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    durationMs: integer("duration_ms"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("agent_tool_calls_investigation_created_idx").on(table.investigationId, table.createdAt),
  ],
);

/** Ticker-scoped follow-up messages for one investigation. */
export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    investigationId: uuid("investigation_id")
      .notNull()
      .references(() => investigations.id, { onDelete: "cascade" }),
    role: text("role").$type<ConversationRole>().notNull(),
    content: text("content").notNull(),
    /** Validated UI blocks attached to this turn; null for plain-text turns. */
    uiBlocks: jsonb("ui_blocks"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("conversations_investigation_created_idx").on(table.investigationId, table.createdAt),
  ],
);

export type Watchlist = typeof watchlists.$inferSelect;
export type NewWatchlist = typeof watchlists.$inferInsert;
export type Investigation = typeof investigations.$inferSelect;
export type NewInvestigation = typeof investigations.$inferInsert;
export type InvestigationEvidence = typeof investigationEvidence.$inferSelect;
export type NewInvestigationEvidence = typeof investigationEvidence.$inferInsert;
export type AgentToolCall = typeof agentToolCalls.$inferSelect;
export type NewAgentToolCall = typeof agentToolCalls.$inferInsert;
export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
