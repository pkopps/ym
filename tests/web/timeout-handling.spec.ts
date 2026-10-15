import { expect, test } from "./fixtures";

test("stalled place search stops loading and shows retry guidance", async ({ page }) => {
  await page.addInitScript(() => {
    const browserFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (!url.includes("/api/places/search")) {
        return browserFetch(input, init);
      }

      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("The request was aborted.", "AbortError"));
        }, { once: true });
      });
    };
  });

  await page.goto("/");
  const searchInput = page.locator(".customer-search-shell__field--search input");
  await searchInput.fill("Barnegat");

  await expect(page.getByText(/YardMatch is taking longer than expected/i)).toBeVisible({
    timeout: 15_000
  });
  await expect(page.locator(".customer-search-shell__action")).not.toContainText(/checking/i);

  if (process.env.YARDMATCH_CAPTURE_TIMEOUT_EVIDENCE === "1") {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({
      path: "reports/agent-checkpoints/engineer/latest/timeout-search-desktop.png",
      fullPage: true
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: "reports/agent-checkpoints/engineer/latest/timeout-search-mobile.png",
      fullPage: true
    });
  }
});
