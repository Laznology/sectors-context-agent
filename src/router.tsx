import { createRouter } from "@tanstack/react-router";
import { rootRoute } from "@/routes/__root";
import { indexRoute } from "@/routes/index";
import { signInRoute } from "@/routes/sign-in";
import { signUpRoute } from "@/routes/sign-up";

const routeTree = rootRoute.addChildren([indexRoute, signInRoute, signUpRoute]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
