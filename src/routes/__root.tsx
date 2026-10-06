import "@/index.css";
import { createRootRoute, Link, Outlet } from "@tanstack/react-router";

export const rootRoute = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <>
      <header className="app-header mx-auto flex w-full max-w-6xl items-center px-6 py-4 sm:px-8">
        <Link
          to="/"
          aria-label="Accel"
          className="inline-flex items-center gap-2 font-serif text-xl font-semibold tracking-tight"
        >
          <img src="/android-chrome-192x192.png" alt="" className="h-9 w-auto" />
          <span>Accel</span>
        </Link>
      </header>
      <Outlet />
    </>
  );
}
