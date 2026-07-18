import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    // Unit-тесты только под src; Playwright-спеки в e2e/ гоняются отдельно.
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
