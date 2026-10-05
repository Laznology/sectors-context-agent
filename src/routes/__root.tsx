import "@/index.css";
import { indexRoute } from "@/routes/index";
import { investigationDetailRoute } from "@/routes/investigations.$ticker";
import { signInRoute } from "@/routes/sign-in";
import { signUpRoute } from "@/routes/sign-up";
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
          className="inline-flex items-center gap-2 font-serif text-lg font-semibold tracking-tight"
        >
          <img src="/android-chrome-192x192.png" alt="" className="size-8" />
          <span>Accel</span>
        </Link>
      </header>
      <Outlet />
    </>
  );
}

// Wajib terdaftar di array ini
export const routeTree = rootRoute.addChildren([
  indexRoute,
  investigationDetailRoute,
  signInRoute,
  signUpRoute,
]);
