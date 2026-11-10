import { expect, test } from "./fixtures";
import { captureResponsiveEvidence, loginUi, registerProvider } from "./workflow-helpers";
import type { ProviderBillingStatusResponse } from "@yardmatch/contracts";

const tiers: ProviderBillingStatusResponse["finderFees"] = [
  { tier: "typical", feeCents: 7_500, maxLawnSqFt: 5_000 },
  { tier: "large", feeCents: 11_000, maxLawnSqFt: 9_000 },
  { tier: "very-large", feeCents: 15_000 }
];

test.describe("provider card for finder fees", () => {
  test("shows the finder-fee tiers and card status from the API", async ({ page, request }) => {
    const provider = await registerProvider(request);
    await loginUi(page, "provider", provider.email);
    await page.goto("/provider/management#provider-billing");
    const section = page.locator("#provider-billing");
    await expect(section).toHaveAttribute("open", "");
    await expect(section.getByText("$75")).toBeVisible();
    await expect(section.getByText("Lawns up to 5,000 sq ft")).toBeVisible();
    await expect(section.getByText("$110")).toBeVisible();
    await expect(section.getByText("Lawns over 9,000 sq ft")).toBeVisible();
    await expect(section.getByText("Your first new customer is free.")).toBeVisible();
    await expect(section.getByText("No card saved yet.")).toBeVisible();
    // Local development has no Stripe key, so setup is unavailable rather than broken.
    await expect(section.getByText("Card setup isn't available right now. Please try again later.")).toBeVisible();
    await expect(section.getByRole("button", { name: "Add card" })).toHaveCount(0);
  });

  test("saves a card through the Stripe return and flags charges that need it", async ({ page, request }) => {
    const provider = await registerProvider(request);
    let status: ProviderBillingStatusResponse = {
      billingConfigured: true, hasCardOnFile: false, finderFees: tiers, firstCustomerFree: true, chargesNeedingAttention: 1
    };
    let started = 0;
    await page.route("**/api/providers/billing", route => route.fulfill({ json: status }));
    await page.route("**/api/providers/billing/card-setup", async route => {
      started++;
      expect(route.request().postDataJSON()).toEqual({ returnPath: "/provider/management#provider-billing" });
      // Stand in for Stripe's hosted page by returning straight to the success URL.
      await route.fulfill({ json: { setupSessionId: "cs_test_1", url: "/provider/management?billing=card-saved&setup_session_id=cs_test_1#provider-billing" } });
    });
    await page.route("**/api/providers/billing/card-setup/complete", async route => {
      expect(route.request().postDataJSON()).toEqual({ setupSessionId: "cs_test_1" });
      status = { ...status, hasCardOnFile: true, chargesNeedingAttention: 0, card: { brand: "visa", last4: "4242", expMonth: 4, expYear: 2030 } };
      await route.fulfill({ json: status });
    });

    await loginUi(page, "provider", provider.email);
    await page.goto("/provider/management#provider-billing");
    const section = page.locator("#provider-billing");
    await expect(section.getByRole("alert")).toHaveText("1 finder fee could not be charged. Add or replace your card and we'll try again.");
    await captureResponsiveEvidence(page, "provider-billing-no-card", section);
    await page.setViewportSize({ width: 1440, height: 900 });

    await section.getByRole("button", { name: "Add card" }).click();
    await expect(section.getByText("Card saved.")).toBeVisible();
    await expect(section.getByText("Visa ending in 4242, expires 04/2030")).toBeVisible();
    await expect(section.getByRole("button", { name: "Replace card" })).toBeVisible();
    await expect(section.getByRole("alert")).toHaveCount(0);
    expect(new URL(page.url()).search).toBe("");
    expect(started).toBe(1);
    await captureResponsiveEvidence(page, "provider-billing-card-saved", section);
  });

  test("the app return page confirms or reports a cancelled card setup", async ({ page }) => {
    await page.goto("/provider/card-saved?billing=card-saved&setup_session_id=cs_test_1");
    await expect(page.getByRole("heading", { name: "Card saved" })).toBeVisible();
    await expect(page.getByText("Close this page to return to the YardMatch Provider app.")).toBeVisible();
    await captureResponsiveEvidence(page, "provider-card-saved");
    await page.goto("/provider/card-saved?billing=card-cancelled");
    await expect(page.getByRole("heading", { name: "Card not saved" })).toBeVisible();
  });
});
