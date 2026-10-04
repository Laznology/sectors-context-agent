import { createRouter, RouterProvider } from "@tanstack/react-router";
import React from "react";
import ReactDOM from "react-dom/client";

// 1. Impor Root Route & Semua Rute Halaman
import { rootRoute } from "@/routes/__root";
import { indexRoute } from "@/routes/index";
import { investigationDetailRoute } from "@/routes/investigations.$ticker";
import { signInRoute } from "@/routes/sign-in";
import { signUpRoute } from "@/routes/sign-up";

import "@/index.css";

// 2. Daftarkan Rute ke routeTree
const routeTree = rootRoute.addChildren([
  indexRoute,
  investigationDetailRoute, // <-- Wajib ada di sini!
  signInRoute,
  signUpRoute,
]);

// 3. Buat Instance Router
const router = createRouter({ routeTree });

// Register Router untuk Type Safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

// 4. Render App
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
