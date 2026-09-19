import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";
import { resolveGuardDecision, type GuardMode } from "@/lib/guard";

/**
 * Single source of truth for the current session.
 *
 * `authClient.useSession()` is a React hook (nanostores-backed), so it must be
 * called from a component render — never from a router `beforeLoad`. Call it
 * here once per consumer so every route reads the same atom.
 */
export function useSession() {
  return authClient.useSession();
}

/**
 * Route guard rendered around a page.
 *
 * - `require-session`: unauthenticated visitors are sent to `/sign-in`.
 * - `require-guest`: authenticated visitors are sent to `/`.
 *
 * While the session is still resolving (`isPending`) we render a loading state
 * and never redirect, so the guard cannot bounce a user before hydration.
 */
export function SessionGuard({ mode, children }: { mode: GuardMode; children: ReactNode }) {
  const session = useSession();
  const navigate = useNavigate();

  const decision = resolveGuardDecision(mode, {
    isPending: session.isPending,
    isAuthenticated: Boolean(session.data),
  });
  const redirectTarget = decision.action === "redirect" ? decision.to : null;

  useEffect(() => {
    if (!redirectTarget) return;
    void navigate({ to: redirectTarget, replace: true });
  }, [redirectTarget, navigate]);

  if (decision.action !== "render") {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        Checking session…
      </p>
    );
  }

  return <>{children}</>;
}
