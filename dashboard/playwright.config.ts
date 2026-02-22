import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";

const port = 3001;
const baseURL = `http://localhost:${port}`;
const chromeExecutableCandidates = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
];
const hasSystemChrome = chromeExecutableCandidates.some((path) =>
  fs.existsSync(path)
);

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: true,
  retries: 0,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: {
    command: `npm run dev -- --port ${port}`,
    url: `${baseURL}/login`,
    timeout: 120_000,
    reuseExistingServer: true,
    env: {
      NEXT_PUBLIC_SITE_URL: baseURL,
      NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
      MODAL_WEBHOOK_SELECT_AGENT: "http://localhost:4000/mock",
    },
  },
  projects: [
    {
      name: "chromium",
      use: hasSystemChrome
        ? { ...devices["Desktop Chrome"], channel: "chrome" }
        : { ...devices["Desktop Chrome"] },
    },
  ],
});
