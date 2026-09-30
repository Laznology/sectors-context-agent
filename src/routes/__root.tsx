import "@/index.css";
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { indexRoute } from "@/routes/index";
import { investigationDetailRoute } from "@/routes/investigations.$id"; // <-- Pastikan terimport
import { historyRoute } from "@/routes/history";
import { signInRoute } from "@/routes/sign-in";
import { signUpRoute } from "@/routes/sign-up";

export const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

// Wajib terdaftar di array ini
export const routeTree = rootRoute.addChildren([
  indexRoute,
  investigationDetailRoute,
  historyRoute,
  signInRoute,
  signUpRoute,
]);
