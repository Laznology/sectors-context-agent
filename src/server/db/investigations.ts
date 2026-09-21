import { and, asc, desc, eq } from "drizzle-orm";
import type {
  InvestigationClassification,
  InvestigationDriver,
  InvestigationStatus,
  InvestigationStatusLabel,
  InvestigationToolCallStatus,
} from "../../shared/schemas/investigation.ts";
import type {
  EvidenceItem,
  InvestigationPlan,
  InvestigationResult,
  PreviousInvestigation,
  ToolCallRecord,
} from "../agents/stock-investigator/schemas.ts";
import { getDb, type Database } from "./index.ts";
import { agentToolCalls, conversations, investigationEvidence, investigations } from "./schema.ts";

export type InvestigationCreateInput = {
  readonly userId: string;
  readonly ticker: string;
  readonly question?: string;
  readonly previousInvestigationId?: string;
  /** Resolved during ticker verification so the UI can show the company name. */
  readonly companyName?: string;
  readonly subSector?: string | null;
};

export type InvestigationDetail = {
  readonly id: string;
  readonly userId?: string;
  readonly ticker?: string;
  readonly companyName?: string | null;
  readonly subSector?: string | null;
  readonly question?: string | null;
  readonly status: InvestigationStatus;
  readonly statusLabel?: InvestigationStatusLabel | null;
  readonly classification?: InvestigationClassification | null;
  readonly driver?: InvestigationDriver | null;
  readonly confidence?: number | null;
  readonly confidenceReason?: string | null;
  readonly signals?: unknown;
  readonly plan?: InvestigationPlan | null;
  readonly evidenceSummary?: string | null;
  readonly evidenceSummaryJson?: readonly InvestigationEvidenceSummary[] | null;
  readonly disclaimer?: string | null;
  readonly whatChanged?: string | null;
  readonly whyItMatters?: string | null;
  readonly explanation?: string | null;
  readonly whatToMonitor?: string | null;
  readonly whatToMonitorJson?: readonly string[] | null;
  readonly changesSincePrevious?: string | null;
  readonly previousInvestigationId?: string | null;
  readonly errorMessage?: string | null;
  readonly createdAt?: string;
  readonly completedAt?: string | null;
  readonly evidence?: readonly EvidenceItem[];
  readonly toolCalls?: readonly ToolCallRecord[];
  readonly conversations?: readonly ConversationRecord[];
};

/** One evidence card shown in the investigation UI. */
export type InvestigationEvidenceSummary = {
  readonly label: string;
  readonly finding: string;
  readonly importance: "high" | "medium" | "low";
};

/** Lightweight investigation row for dashboard and history lists. */
export type InvestigationSummary = {
  readonly id: string;
  readonly ticker: string;
  readonly companyName?: string | null;
  readonly status: InvestigationStatus;
  readonly statusLabel?: InvestigationStatusLabel | null;
  readonly classification?: InvestigationClassification | null;
  readonly driver?: InvestigationDriver | null;
  readonly confidence?: number | null;
  readonly createdAt: string;
  readonly completedAt?: string | null;
};

/** A watchlist entry plus the dashboard context PRD §6 Flow A asks for. */
export type WatchlistDashboardItem = {
  readonly ticker: string;
  readonly createdAt: string;
  readonly companyName: string | null;
  readonly lastClose: number | null;
  readonly lastCloseDate: string | null;
  readonly lastInvestigation: {
    readonly id: string;
    readonly status: InvestigationStatus;
    readonly statusLabel: InvestigationStatusLabel | null;
    readonly createdAt: string;
    readonly completedAt: string | null;
  } | null;
};

export type ConversationRecord = {
  readonly id: string;
  readonly role: "user" | "assistant";
  readonly content: string;
  readonly createdAt: string;
};

export type InvestigationStatePatch = {
  readonly status?: InvestigationStatus;
  readonly signalsJson?: unknown;
  readonly planJson?: InvestigationPlan | null;
  readonly companyName?: string | null;
  readonly subSector?: string | null;
  readonly asOfDate?: string;
};

export type InvestigationCompletion = {
  readonly result: InvestigationResult;
  readonly signals?: unknown;
  readonly plan?: InvestigationPlan | null;
  readonly evidenceSummary?: string;
  readonly comparison?: unknown;
  readonly asOfDate?: string;
};

export interface InvestigationStore {
  create(input: InvestigationCreateInput): Promise<{ id: string }>;
  findPrevious(userId: string, ticker: string): Promise<PreviousInvestigation | null>;
  list(userId: string, page?: { limit: number; offset: number }): Promise<InvestigationSummary[]>;
  getDetail(userId: string, investigationId: string): Promise<InvestigationDetail | null>;
  updateFromState(investigationId: string, patch: InvestigationStatePatch): Promise<void>;
  appendEvidence(investigationId: string, items: readonly EvidenceItem[]): Promise<void>;
  appendToolCalls(investigationId: string, records: readonly ToolCallRecord[]): Promise<void>;
  appendConversation(
    investigationId: string,
    role: ConversationRecord["role"],
    content: string,
  ): Promise<ConversationRecord>;
  complete(investigationId: string, completion: InvestigationCompletion): Promise<void>;
  fail(investigationId: string, errorMessage: string): Promise<void>;
}

export class PostgresInvestigationStore implements InvestigationStore {
  private readonly db: Database;

  constructor(db: Database = getDb()) {
    this.db = db;
  }

  async create(input: InvestigationCreateInput): Promise<{ id: string }> {
    const [row] = await this.db
      .insert(investigations)
      .values({
        userId: input.userId,
        ticker: input.ticker,
        question: input.question,
        previousInvestigationId: input.previousInvestigationId,
        companyName: input.companyName,
        subSector: input.subSector ?? undefined,
      })
      .returning({ id: investigations.id });
    if (!row) throw new Error("Failed to create investigation");
    return row;
  }

  async findPrevious(userId: string, ticker: string): Promise<PreviousInvestigation | null> {
    const [row] = await this.db
      .select({
        id: investigations.id,
        completedAt: investigations.completedAt,
        driver: investigations.driver,
        classification: investigations.classification,
        confidence: investigations.confidence,
        signals: investigations.signalsJson,
        evidenceSummary: investigations.evidenceSummary,
        whatChanged: investigations.whatChanged,
        whyItMatters: investigations.whyItMatters,
        explanation: investigations.explanation,
        whatToMonitor: investigations.whatToMonitor,
      })
      .from(investigations)
      .where(
        and(
          eq(investigations.userId, userId),
          eq(investigations.ticker, ticker),
          eq(investigations.status, "completed"),
        ),
      )
      .orderBy(desc(investigations.completedAt), desc(investigations.createdAt))
      .limit(1);

    if (!row) return null;
    return {
      id: row.id,
      completedAt: row.completedAt?.toISOString() ?? null,
      driver: row.driver ?? null,
      classification: row.classification ?? null,
      confidence: row.confidence ?? null,
      signals: row.signals,
      evidenceSummary: row.evidenceSummary,
      whatChanged: row.whatChanged,
      whyItMatters: row.whyItMatters,
      explanation: row.explanation,
      whatToMonitor: row.whatToMonitor,
    };
  }

  async list(
    userId: string,
    page: { limit: number; offset: number } = { limit: 50, offset: 0 },
  ): Promise<InvestigationSummary[]> {
    const rows = await this.db
      .select({
        id: investigations.id,
        ticker: investigations.ticker,
        companyName: investigations.companyName,
        status: investigations.status,
        statusLabel: investigations.statusLabel,
        classification: investigations.classification,
        driver: investigations.driver,
        confidence: investigations.confidence,
        createdAt: investigations.createdAt,
        completedAt: investigations.completedAt,
      })
      .from(investigations)
      .where(eq(investigations.userId, userId))
      .orderBy(desc(investigations.createdAt))
      .limit(page.limit)
      .offset(page.offset);

    return rows.map((row) => ({
      id: row.id,
      ticker: row.ticker,
      companyName: row.companyName ?? null,
      status: row.status,
      statusLabel: row.statusLabel ?? null,
      classification: row.classification ?? null,
      driver: row.driver ?? null,
      confidence: row.confidence ?? null,
      createdAt: row.createdAt.toISOString(),
      completedAt: row.completedAt?.toISOString() ?? null,
    }));
  }

  async getDetail(userId: string, investigationId: string): Promise<InvestigationDetail | null> {
    const [row] = await this.db
      .select()
      .from(investigations)
      .where(and(eq(investigations.id, investigationId), eq(investigations.userId, userId)))
      .limit(1);
    if (!row) return null;

    const [evidenceRows, toolCallRows, conversationRows] = await Promise.all([
      this.db
        .select()
        .from(investigationEvidence)
        .where(eq(investigationEvidence.investigationId, investigationId))
        .orderBy(asc(investigationEvidence.createdAt)),
      this.db
        .select()
        .from(agentToolCalls)
        .where(eq(agentToolCalls.investigationId, investigationId))
        .orderBy(asc(agentToolCalls.createdAt)),
      this.db
        .select()
        .from(conversations)
        .where(eq(conversations.investigationId, investigationId))
        .orderBy(asc(conversations.createdAt)),
    ]);

    return {
      id: row.id,
      userId: row.userId,
      ticker: row.ticker,
      companyName: row.companyName ?? null,
      subSector: row.subSector ?? null,
      question: row.question,
      status: row.status,
      statusLabel: row.statusLabel ?? null,
      classification: row.classification,
      driver: row.driver,
      confidence: row.confidence,
      confidenceReason: row.confidenceReason ?? null,
      signals: row.signalsJson,
      plan: row.planJson as InvestigationPlan | null,
      evidenceSummary: row.evidenceSummary,
      evidenceSummaryJson:
        (row.evidenceSummaryJson as InvestigationEvidenceSummary[] | null) ?? null,
      disclaimer: row.disclaimer ?? null,
      whatChanged: row.whatChanged,
      whyItMatters: row.whyItMatters,
      explanation: row.explanation,
      whatToMonitor: row.whatToMonitor,
      whatToMonitorJson: (row.whatToMonitorJson as string[] | null) ?? null,
      changesSincePrevious: row.changesSincePrevious,
      previousInvestigationId: row.previousInvestigationId,
      errorMessage: row.errorMessage,
      createdAt: row.createdAt.toISOString(),
      completedAt: row.completedAt?.toISOString() ?? null,
      evidence: evidenceRows.map((item) => ({
        id: item.id,
        type: item.type,
        source: item.source,
        summary: item.interpretation ?? item.title,
        payload: item.payloadJson ?? undefined,
        collectedAt: item.createdAt.toISOString(),
      })),
      toolCalls: toolCallRows.map((item) => ({
        id: item.id,
        toolName: item.toolName,
        status: item.status,
        reason: item.reason ?? undefined,
        input: item.inputJson as Record<string, unknown> | undefined,
        output: item.outputJson ?? undefined,
        errorCode: item.errorCode ?? undefined,
        errorMessage: item.errorMessage ?? undefined,
        durationMs: item.durationMs ?? undefined,
        startedAt: item.startedAt?.toISOString(),
        finishedAt: item.finishedAt?.toISOString(),
      })),
      conversations: conversationRows.map((item) => ({
        id: item.id,
        role: item.role,
        content: item.content,
        createdAt: item.createdAt.toISOString(),
      })),
    };
  }

  async updateFromState(investigationId: string, patch: InvestigationStatePatch): Promise<void> {
    if (Object.keys(patch).length === 0) return;
    await this.db.update(investigations).set(patch).where(eq(investigations.id, investigationId));
  }

  async appendEvidence(investigationId: string, items: readonly EvidenceItem[]): Promise<void> {
    if (items.length === 0) return;
    await this.db.insert(investigationEvidence).values(
      items.map((item) => ({
        id: item.id,
        investigationId,
        source: item.source,
        type: item.type,
        title: item.summary,
        payloadJson: item.payload,
        interpretation: item.summary,
        createdAt: item.collectedAt ? new Date(item.collectedAt) : new Date(),
      })),
    );
  }

  async appendToolCalls(
    investigationId: string,
    records: readonly ToolCallRecord[],
  ): Promise<void> {
    if (records.length === 0) return;
    await this.db.insert(agentToolCalls).values(
      records.map((record) => ({
        id: record.id,
        investigationId,
        toolName: record.toolName,
        status: record.status as InvestigationToolCallStatus,
        inputJson: record.input,
        outputJson: record.output,
        reason: record.reason,
        errorCode: record.errorCode,
        errorMessage: record.errorMessage,
        durationMs: record.durationMs,
        startedAt: record.startedAt ? new Date(record.startedAt) : undefined,
        finishedAt: record.finishedAt ? new Date(record.finishedAt) : undefined,
      })),
    );
  }

  async appendConversation(
    investigationId: string,
    role: ConversationRecord["role"],
    content: string,
  ): Promise<ConversationRecord> {
    const [row] = await this.db
      .insert(conversations)
      .values({ investigationId, role, content })
      .returning();
    if (!row) throw new Error("Failed to persist conversation message");
    return {
      id: row.id,
      role: row.role,
      content: row.content,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async complete(investigationId: string, completion: InvestigationCompletion): Promise<void> {
    const { result } = completion;
    await this.db
      .update(investigations)
      .set({
        status: "completed",
        classification: result.classification,
        driver: result.driver,
        statusLabel: result.status,
        confidence: result.confidence,
        confidenceReason: result.confidenceReason,
        signalsJson: completion.signals,
        planJson: completion.plan,
        evidenceSummary: completion.evidenceSummary,
        evidenceSummaryJson: result.evidenceSummary,
        disclaimer: result.disclaimer,
        whatChanged: result.whatChanged,
        whyItMatters: result.whyItMatters,
        explanation: result.explanation,
        whatToMonitor: result.whatToMonitor.join(" "),
        whatToMonitorJson: result.whatToMonitor,
        changesSincePrevious: result.changesSincePrevious,
        comparisonJson: completion.comparison,
        asOfDate: completion.asOfDate,
        errorMessage: null,
        completedAt: new Date(),
      })
      .where(eq(investigations.id, investigationId));
  }

  async fail(investigationId: string, errorMessage: string): Promise<void> {
    await this.db
      .update(investigations)
      .set({ status: "failed", errorMessage })
      .where(eq(investigations.id, investigationId));
  }
}
