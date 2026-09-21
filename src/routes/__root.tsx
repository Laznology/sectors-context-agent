import { Outlet, createRootRoute } from "@tanstack/react-router";

export const rootRoute = createRootRoute({
  component: RootLayout,
});

/**
 * Editorial, instrument-like chrome: a hairline rule under a quiet wordmark.
 * No gradients, no grid wallpaper — the interface stays out of the way.
 */
function RootLayout() {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-baseline gap-2.5">
          <span
            aria-hidden
            className="bg-signal inline-block h-2 w-2 translate-y-[-2px] rounded-full"
          />
          <span className="text-sm font-medium tracking-tight">Sectors Context Agent</span>
        </div>
        <span className="text-muted-foreground tabular text-[11px] tracking-[0.18em] uppercase">
          IDX / market investigation
        </span>
      </header>

      <div aria-hidden className="mx-auto w-full max-w-6xl px-6">
        <div className="bg-rule h-px w-full" />
      </div>

      <main className="mx-auto flex w-full max-w-6xl flex-1 items-center px-6 py-16">
        <Outlet />
      </main>

      <footer className="mx-auto w-full max-w-6xl px-6 py-6">
        <div className="bg-rule mb-4 h-px w-full" />
        <p className="text-muted-foreground text-xs">
          Analysis, context and evidence — informational only, not investment advice.
        </p>
      </footer>
    </div>
  );
}
