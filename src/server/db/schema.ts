import {
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type {
  InvestigationClassification,
  InvestigationStatus,
} from "../../shared/schemas/investigation.ts";

/** One stock investigation run. */
export const investigations = pgTable("investigations", {
  id: uuid("id").primaryKey().defaultRandom(),
  ticker: text("ticker").notNull(),
  question: text("question"),
  status: text("status").$type<InvestigationStatus>().notNull().default("pending"),
  classification: text("classification").$type<InvestigationClassification>(),
  confidence: doublePrecision("confidence"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

/** Audit trail of every tool the agent executed, including why it ran it. */
export const agentToolCalls = pgTable("agent_tool_calls", {
  id: uuid("id").primaryKey().defaultRandom(),
  investigationId: uuid("investigation_id")
    .notNull()
    .references(() => investigations.id, { onDelete: "cascade" }),
  toolName: text("tool_name").notNull(),
  inputJson: jsonb("input_json"),
  outputJson: jsonb("output_json"),
  reason: text("reason"),
  durationMs: integer("duration_ms"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Investigation = typeof investigations.$inferSelect;
export type NewInvestigation = typeof investigations.$inferInsert;
export type AgentToolCall = typeof agentToolCalls.$inferSelect;
export type NewAgentToolCall = typeof agentToolCalls.$inferInsert;
