import { defineConfig, devices } from "@playwright/test";

const webBaseUrl = process.env.PLAYWRIGHT_BASE_URL;
if (!webBaseUrl) {
  throw new Error("PLAYWRIGHT_BASE_URL is required for hosted staging acceptance.");
}

export default defineConfig({
  testDir: "./tests/staging",
  timeout: 45_000,
  workers: 1,
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
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
