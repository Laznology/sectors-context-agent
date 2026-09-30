/**
 * History route (PRD #26).
 *
 * TODO(frontend): implement.
 *
 * Shows previous investigations grouped by ticker/date.
 * No complex analytics dashboard required.
 *
 * Blocked on: GET /api/investigations list endpoint (does not exist yet).
 */
// src/routes/history.tsx
import { createRoute } from "@tanstack/react-router";
import { rootRoute } from "@/routes/__root";
import { SessionGuard } from "@/lib/session";

// Pastikan variabel diekspor dengan nama historyRoute!
export const historyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/history",
  component: HistoryPage,
});

function HistoryPage() {
  return (
    <SessionGuard mode="require-session">
      <div className="p-6">
        <h1 className="text-2xl font-bold">Investigation History</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Daftar riwayat investigasi yang pernah dijalankan.
        </p>
      </div>
    </SessionGuard>
  );
}
