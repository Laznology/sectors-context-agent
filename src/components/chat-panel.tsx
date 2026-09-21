/**
 * Scoped follow-up chat panel (PRD #19).
 *
 * TODO(frontend): implement.
 *
 * Small chat input scoped to one investigation. Renders the conversation
 * history from the investigation payload and sends
 * POST /api/investigations/:id/chat with { message: string }.
 *
 * Server contract: only completed investigations accept follow-ups; answers
 * stay grounded in the investigation evidence and may call Sectors MCP tools
 * for fresh data. Never present BUY / SELL / HOLD advice.
 */
