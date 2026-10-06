import "@/index.css";
import { createRootRoute, Link, Outlet } from "@tanstack/react-router";

export const rootRoute = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <>
      <header className="mx-auto flex w-full max-w-6xl items-center px-4 py-4">
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
