import { expect, test } from "@playwright/test";
import {
  approveProvider,
  captureResponsiveEvidence,
  loginApi,
  testPassword,
  uniqueEmail
} from "./workflow-helpers";

test("provider signup reaches a complete, verified management profile", async ({ page, request }) => {
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
  await expect(page.getByRole("heading", { name: "Upcoming jobs and live marketplace demand." })).toBeVisible();
  await expect(page.getByText(/Status: pending review/i)).toBeVisible();
  await expect(page.getByText("Launch checklist")).toBeVisible();
  await expect(page.getByRole("heading", { name: "No scheduled jobs." })).toBeVisible();

  await page.getByLabel("Business description").fill(
    "Barnegat lawn mowing and seasonal cleanup with documented arrivals, insured field practices, and dependable route coverage."
  );
  await page.getByLabel("Years of experience").fill("6");
  await page.getByLabel("Hedge trimming").check();
  await page.getByRole("button", { name: "Save business profile" }).click();
  await expect(page.getByText("Business profile updated.")).toBeVisible();

  await page.getByRole("button", { name: "+5 miles" }).first().click();
  await expect(page.getByText("Service radius updated.")).toBeVisible();
  await page.getByRole("button", { name: "Auto-accept" }).click();
  await expect(page.getByText("Auto-accept is on for future crew matches.")).toBeVisible();

  const login = await loginApi(request, email);
  await approveProvider(request, login.user.id, login.session.token);
  await page.reload();
  await expect(page.getByText(/Status: verified/i)).toBeVisible();
  await expect(page.getByText(/verified and visible in search/i)).toBeVisible();

  await captureResponsiveEvidence(page, "provider-onboarding-verified", page.getByText(/Status: verified/i));
});
