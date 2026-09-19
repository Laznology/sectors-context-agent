/**
 * Investigation detail route (PRD #26).
 *
 * TODO(frontend): implement.
 *
 * Data:
 * - GET /api/investigations/:id — investigation detail payload;
 * - GET /api/investigations/:id/events — SSE stream for live status updates.
 *
 * Sections:
 * - header: ticker + company name;
 * - status badge (e.g. NEEDS ATTENTION);
 * - what changed, why (agent explanation);
 * - evidence cards, see components/evidence-panel.tsx;
 * - confidence, what to monitor (2-3 items max);
 * - scoped follow-up chat, see components/chat-panel.tsx (PRD #19).
 */
