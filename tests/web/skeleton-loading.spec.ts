import { expect, test } from "./fixtures";

test("provider matching uses card skeletons without stacking the route loader", async ({ page }) => {
  let releaseSearch: (() => void) | undefined;
  const searchCanFinish = new Promise<void>((resolve) => {
    releaseSearch = resolve;
  });

  await page.route("**/api/providers/search", async (route) => {
    await searchCanFinish;
    await route.continue();
  });

  const params = new URLSearchParams({
    service: "lawn-mowing",
    area: "Brooklyn, NY",
    city: "Brooklyn",
    state: "NY",
    postalCode: "11201",
    lat: "40.6782",
    lng: "-73.9442",
    when: "tomorrow-morning"
  });

  await page.goto(`/customer/listings?${params.toString()}`);

  const skeletonRegion = page.locator('[aria-busy="true"]');
  await expect(skeletonRegion).toBeVisible();
  await expect(skeletonRegion.locator(".loading-skeleton-card")).toHaveCount(2);
  await expect(page.locator(".lawn-mower-loader")).toHaveCount(0);

  if (process.env.YARDMATCH_CAPTURE_SKELETON_EVIDENCE === "1") {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({
      path: "reports/agent-checkpoints/engineer/latest/skeleton-provider-match-desktop.png",
      fullPage: true
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: "reports/agent-checkpoints/engineer/latest/skeleton-provider-match-mobile-web.png",
      fullPage: true
    });
  }

  releaseSearch?.();
  await expect(page.getByRole("heading", { level: 3, name: "GreenStride Lawn Co." })).toBeVisible();
  await expect(skeletonRegion).toHaveCount(0);
});
