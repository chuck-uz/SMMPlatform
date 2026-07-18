import { defineConfig, devices } from "@playwright/test";

// Prod runs on smm.oresh.in; local docker compose serves on :3001 (см. README).
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3001";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  // Приложению нужен живой Postgres, поэтому по умолчанию переиспользуем
  // уже поднятый сервер (`docker compose up`), а не стартуем Next здесь.
  // Чтобы Playwright сам поднимал dev-сервер, раскомментируйте блок ниже:
  // webServer: {
  //   command: "npm run dev -- -p 3001",
  //   url: baseURL,
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 120_000,
  // },
});
