import { defineConfig, devices } from "@playwright/test";

const apiPort = Number(process.env.PORT ?? process.env.YARDMATCH_API_PORT ?? 4001);
const webPort = Number(process.env.YARDMATCH_WEB_PORT ?? 3000);
const apiBaseUrl = process.env.API_BASE_URL ?? `http://localhost:${apiPort}`;
const webBaseUrl = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${webPort}`;
const reuseExistingServer = !process.env.CI;

export default defineConfig({
  testDir: "./tests/web",
  timeout: 30_000,
  workers: 1,
  expect: {
    timeout: 10_000
  },
  fullyParallel: false,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: webBaseUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"]
      }
    }
  ],
  webServer: [
    {
      command: `API_BASE_URL=${apiBaseUrl} PORT=${apiPort} DATABASE_URL= npm run dev:api`,
      url: `${apiBaseUrl}/api/docs/openapi.json`,
      reuseExistingServer,
      timeout: 30_000
    },
    {
      command: `NEXT_PUBLIC_API_BASE_URL=${apiBaseUrl} npm run dev:web`,
      url: webBaseUrl,
      reuseExistingServer,
      timeout: 60_000
    }
  ]
});
