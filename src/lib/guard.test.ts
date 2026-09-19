import { describe, expect, it } from "vite-plus/test";
import { resolveGuardDecision } from "./guard.ts";

describe("resolveGuardDecision", () => {
  it("waits (never redirects) while the session is still pending", () => {
    expect(
      resolveGuardDecision("require-session", { isPending: true, isAuthenticated: false }),
    ).toEqual({ action: "pending" });
    expect(
      resolveGuardDecision("require-guest", { isPending: true, isAuthenticated: true }),
    ).toEqual({ action: "pending" });
  });

  it("redirects unauthenticated users away from a protected route to /sign-in", () => {
    expect(
      resolveGuardDecision("require-session", { isPending: false, isAuthenticated: false }),
    ).toEqual({ action: "redirect", to: "/sign-in" });
  });

  it("renders a protected route for an authenticated user", () => {
    expect(
      resolveGuardDecision("require-session", { isPending: false, isAuthenticated: true }),
    ).toEqual({ action: "render" });
  });

  it("redirects authenticated users away from auth pages to /", () => {
    expect(
      resolveGuardDecision("require-guest", { isPending: false, isAuthenticated: true }),
    ).toEqual({ action: "redirect", to: "/" });
  });

  it("renders an auth page for an unauthenticated visitor", () => {
    expect(
      resolveGuardDecision("require-guest", { isPending: false, isAuthenticated: false }),
    ).toEqual({ action: "render" });
  });
});
