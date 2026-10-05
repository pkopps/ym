import { expect, test } from "@playwright/test";
import {
  authenticatedPost,
  evidenceRoot,
  loginUi,
  opsEmail,
  opsPassword,
  registerCustomer,
  registerProvider
} from "./workflow-helpers";

test("ops workspace exposes and audits verification, support, leads, payouts, and automation", async ({ page, request }) => {
  test.setTimeout(60_000);
  const pendingProvider = await registerProvider(request, { companyName: `Ops Review Lawn ${Date.now()}` });
  const customer = await registerCustomer(request, "Ops Support Customer");
  await authenticatedPost(request, customer.token, "/api/support/tickets", {
    issueType: "general",
    subject: "Launch workflow support check",
    description: "Please verify this request is visible in the authenticated support queue."
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await loginUi(page, "ops", opsEmail, opsPassword);
  await expect(page).toHaveURL(/\/ops$/);
  await expect(page.getByText("Live from the authenticated API.")).toBeVisible();

  await page.locator('.workspace-nav a[href="#ops-providers"]').click();
  const verificationItem = page.locator("article.list-panel").filter({ hasText: pendingProvider.companyName });
  await expect(verificationItem).toBeVisible();
  const override = verificationItem.locator("textarea").last();
  if (await override.count()) {
    await override.fill(
      "Ops confirmed the narrow Barnegat service area, service scope, route settings, first-job monitoring owner, and launch-quality expectations for this pilot provider."
    );
  }
  await verificationItem.getByRole("button", { name: /Approve provider|Approve with override/ }).click();
  await expect(page.getByText(/Provider approved/)).toBeVisible();
  await expect(verificationItem).toHaveCount(0);

  const supportItem = page
    .locator("article.list-panel")
    .filter({ has: page.getByRole("button", { name: "Mark triaged" }) })
    .filter({ hasText: "Launch workflow support check" });
  await expect(supportItem).toBeVisible();
  await supportItem.getByRole("button", { name: "Mark triaged" }).click();
  await expect(page.getByText("Ticket triaged.")).toBeVisible();

  await page.locator('.workspace-nav a[href="#ops-leads"]').click();
  const leadComposer = page.locator("article.card").filter({ hasText: "Create a manual lead" }).first();
  await leadComposer.getByLabel("Name", { exact: true }).fill("Jamie Launch Lead");
  await leadComposer.getByLabel("Email", { exact: true }).fill("jamie-launch@example.com");
  await leadComposer.getByLabel("Owner", { exact: true }).fill("Casey Ops");
  await leadComposer.getByLabel("Lead summary").fill("Needs a recommendation-first mowing match in Barnegat next week.");
  await leadComposer.getByRole("button", { name: "Create lead" }).click();
  await expect(page.getByText("Launch lead created.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Jamie Launch Lead" }).first()).toBeVisible();

  await page.locator('.workspace-nav a[href="#ops-administration"]').click();
  const automationBoard = page.getByTestId("ops-automation-board");
  await expect(automationBoard).toBeVisible();
  await automationBoard.getByRole("button", { name: "Run due sweeps" }).click();
  await expect(automationBoard.getByRole("status")).toContainText("Automation finished");
  await expect(automationBoard.getByRole("heading", { name: "Dry-run automation audit" }).first()).toBeVisible();

  await page.locator('.workspace-nav a[href="#ops-payouts"]').click();
  await expect(page.getByTestId("ops-payout-batches")).toBeVisible();
  await expect(page.getByText("Crew transfer records (must stay 0)")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Provider business" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Provider disbursement history" })).toBeVisible();
  await expect(page.getByText(/No provider payout run records|manual-review/).first()).toBeVisible();

  await automationBoard.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${evidenceRoot}/ops-workspace-desktop.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await automationBoard.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${evidenceRoot}/ops-workspace-mobile.png` });
});

test("provider session cannot enter the internal ops workspace", async ({ page, request }) => {
  const provider = await registerProvider(request);
  await loginUi(page, "provider", provider.email);
  await page.goto("/ops");
  await expect(page.getByRole("heading", { name: "Internal login required" })).toBeVisible();
  await expect(page.getByText("Run and audit launch automation.")).toHaveCount(0);
});
