export type GuardMode = "require-session" | "require-guest";

export type GuardDecision =
  | { readonly action: "render" }
  | { readonly action: "pending" }
  | { readonly action: "redirect"; readonly to: "/sign-in" | "/" };

/**
 * Pure decision function for a route guard. Extracted from the React
 * `SessionGuard` so the redirect behavior can be unit-tested without a DOM.
 *
 * - While the session is still resolving, we wait (never redirect).
 * - `require-session` redirects unauthenticated visitors to `/sign-in`.
 * - `require-guest` redirects authenticated visitors to `/`.
 */
export function resolveGuardDecision(
  mode: GuardMode,
  session: { readonly isPending: boolean; readonly isAuthenticated: boolean },
): GuardDecision {
  if (session.isPending) return { action: "pending" };

  if (mode === "require-session" && !session.isAuthenticated) {
    return { action: "redirect", to: "/sign-in" };
  }
  if (mode === "require-guest" && session.isAuthenticated) {
    return { action: "redirect", to: "/" };
  }
  return { action: "render" };
}
