import { createRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { SessionGuard, useSession } from "@/lib/session";
import { rootRoute } from "@/routes/__root";

export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: IndexPage,
});

function IndexPage() {
  return (
    <SessionGuard mode="require-session">
      <AppShell />
    </SessionGuard>
  );
}

function AppShell() {
  const session = useSession();
  const navigate = useNavigate();
  const name = session.data?.user.name ?? "";

  async function handleSignOut() {
    await authClient.signOut({});
    await navigate({ to: "/sign-in", replace: true });
  }

  return (
    <div className="flex w-full flex-col gap-10">
      <div className="flex items-end justify-between gap-6">
        <div className="flex flex-col gap-2">
          <p className="text-signal-text tabular text-[11px] tracking-[0.22em] uppercase">
            Signed in
          </p>
          <h1 className="font-serif text-4xl tracking-tight">Welcome, {name}.</h1>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={handleSignOut}>
          Sign out
        </Button>
      </div>

      <div className="border-rule bg-panel/60 rounded-md border p-6">
        <p className="text-muted-foreground text-sm">
          Your watchlist and investigations will live here. The investigation workflow — watchlist,
          conditional evidence gathering, and the evidence-backed explanation — is the next build.
        </p>
      </div>
    </div>
  );
}
