import { expect, test } from "./fixtures";
import {
  loginUi,
  opsEmail,
  opsPassword,
  captureResponsiveEvidence,
  testPassword,
  uniqueEmail
} from "./workflow-helpers";

test("provider signup reaches a complete, verified management profile", async ({ page }) => {
  test.setTimeout(120_000);
  const email = uniqueEmail("provider-onboarding");
  const companyName = `Barnegat Field Care ${Date.now()}`;
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/auth/provider/create");

  await page.getByLabel("Full name").fill("Morgan Field");
  await page.getByLabel("Business name").fill(companyName);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Phone").fill("555-0181");
  await page.getByLabel("Password", { exact: true }).fill(testPassword);
  await page.getByLabel("Confirm password").fill(testPassword);
  await page.getByLabel("Business address").fill("18 Bay Ave");
  await page.getByLabel("City").fill("Barnegat");
  await page.getByLabel("State").fill("NJ");
  await page.getByLabel("ZIP").fill("08005");
  await page.getByLabel("Service radius").fill("20");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/provider\/management$/);
  await expect(page.getByRole("heading", { name: "Upcoming jobs and customer requests." })).toBeVisible();
  await expect(page.getByText(/Status: pending review/i)).toBeVisible();
  await expect(page.getByText("Verification checklist")).toBeVisible();
  await expect(page.getByRole("heading", { name: "No scheduled jobs." })).toBeVisible();

  await page.getByLabel("Business description").fill(
    "Barnegat lawn mowing and seasonal cleanup with documented arrivals, insured field practices, and dependable route coverage."
  );
  await page.getByLabel("Years of experience").fill("6");
  await page.getByLabel("Hedge trimming").check();
  await page.getByRole("button", { name: "Save business profile" }).click();
  await expect(page.getByText("Business profile updated.")).toBeVisible();

  await page.locator('a[href="#provider-settings"]').click();
  await page.getByRole("button", { name: "+5 miles" }).first().click();
  await expect(page.getByText("Service radius updated.")).toBeVisible();
  await page.getByRole("button", { name: "Auto-accept" }).click();
  await expect(page.getByText("Auto-accept is on for future crew matches.")).toBeVisible();

  await page.getByRole("button", { name: "Publish opening" }).click();
  await expect(page.getByText("Opening published. Customers can request it after marketplace approval.")).toBeVisible();

  for (const type of ["business-registration", "general-liability-insurance", "workers-compensation"]) {
    await page.getByLabel("Credential type", { exact: true }).selectOption(type);
    await page.getByLabel("Registration or policy reference").fill(`policy-${type}`);
    await page.getByLabel("Credential expiration").fill("2028-01-01");
    await page.getByRole("button", { name: "Submit credential", exact: true }).click();
    await expect(page.getByText("Credential submitted for review.", { exact: true })).toBeVisible();
    await expect(page.getByText(`${type.replaceAll("-", " ")}: pending-review`, { exact: true })).toBeVisible();
  }
  await loginUi(page, "ops", opsEmail, opsPassword);
  await page.locator('.workspace-nav a[href="#ops-providers"]').click();
  const item = page.locator("article.list-panel").filter({ hasText: companyName });
  const credentials = item.getByRole("region", { name: "Credential review" });
  const liability = credentials.locator("div.list-panel").filter({ hasText: "general liability insurance" });
  await liability.getByLabel("Credential review reason").fill("Please provide the current policy reference and coverage dates.");
  await liability.getByRole("button", { name: "Reject credential" }).click();
  await expect(liability.getByText("general liability insurance: rejected", { exact: true })).toBeVisible();
  await loginUi(page, "provider", email);
  await expect(page).toHaveURL(/\/provider\/management$/);
  await expect(page.getByText(/general liability insurance: rejected.*Please provide/)).toBeVisible();
  await page.getByLabel("Credential type", { exact: true }).selectOption("general-liability-insurance");
  await page.getByLabel("Registration or policy reference").fill("updated-current-liability-policy");
  await page.getByLabel("Credential expiration").fill("2028-01-01");
  await page.getByRole("button", { name: "Submit credential", exact: true }).click();
  await expect(page.getByText("general liability insurance: pending-review", { exact: true })).toBeVisible();
  await loginUi(page, "ops", opsEmail, opsPassword);
  await expect(page).toHaveURL(/\/ops$/);
  await page.locator('.workspace-nav a[href="#ops-providers"]').click();
  await expect(credentials.getByRole("button", { name: "Verify credential" })).toHaveCount(3);
  for (let index = 0; index < 3; index++) {
    await credentials.getByRole("button", { name: "Verify credential" }).nth(index).click();
    await expect(page.getByText("Credential review saved.")).toBeVisible();
  }
  const override = item.locator("textarea").last();
  if (await item.getByText("Approval override required", { exact: true }).count()) {
    await override.fill("Reviewed service area, insurance policies, staffing supervision, experience and first-job monitoring. This business is ready for the stated service categories.");
  }
  await item.getByRole("button", { name: /Approve provider|Approve with override/ }).click();
  await expect(page.getByText(/Provider approved/)).toBeVisible();
  await loginUi(page, "provider", email);
  await expect(page).toHaveURL(/\/provider\/management$/);
  await page.reload();
  await page.locator('a[href="#provider-setup"]').click();
  await expect(page.getByText(/Status: verified/i)).toBeVisible();
  await expect(page.getByText(/verified and visible in search/i)).toBeVisible();

  await captureResponsiveEvidence(page, "provider-onboarding-verified", page.getByText(/Status: verified/i));
});
