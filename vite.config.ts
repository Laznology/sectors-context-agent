import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { configDefaults, defineConfig, lazyPlugins } from "vite-plus";

// https://vite.dev/config/
export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  fmt: {
    // Freebuff session worktrees and Vite+ caches live inside the repo and are not project sources.
    ignorePatterns: [".freebuff/**", ".vite-doctor/**"],
  },
  lint: {
    ignorePatterns: [".freebuff/**", ".vite-doctor/**"],
    plugins: ["react", "typescript", "oxc"],
    rules: {
      "react/rules-of-hooks": "error",
      // TanStack Router requires each route file to export its route object
      // alongside the page components, which this rule reads as a Fast Refresh
      // violation. The React plugin handles HMR for these files correctly.
      "react/only-export-components": "off",
      "vite-plus/prefer-vite-plus-imports": "error",
    },
    options: {
      typeAware: true,
      typeCheck: true,
    },
    jsPlugins: [
      {
        name: "vite-plus",
        specifier: "vite-plus/oxlint-plugin",
      },
    ],
  },
  plugins: lazyPlugins(() => [react(), tailwindcss()]),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    exclude: [...configDefaults.exclude, "**/.freebuff/**"],
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
