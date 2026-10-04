import "@/index.css";
import { indexRoute } from "@/routes/index";
import { investigationDetailRoute } from "@/routes/investigations.$ticker";
import { signInRoute } from "@/routes/sign-in";
import { signUpRoute } from "@/routes/sign-up";
import { createRootRoute, Outlet } from "@tanstack/react-router";

export const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

// Wajib terdaftar di array ini
export const routeTree = rootRoute.addChildren([
  indexRoute,
  investigationDetailRoute,
  signInRoute,
  signUpRoute,
]);
