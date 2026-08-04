import { expect, test } from "@playwright/test";
import {
  approveProvider,
  captureResponsiveEvidence,
  createBooking,
  loginUi,
  registerCustomer,
  registerProvider,
  tinyPng
} from "./workflow-helpers";

test("provider confirms, routes, proves, completes, and can decline a second request", async ({ page, request }) => {
  const provider = await registerProvider(request, { staffingMode: "auto-accept" });
  await approveProvider(request, provider.providerId);
  const primaryCustomer = await registerCustomer(request, "Taylor First Job");
  const declineCustomer = await registerCustomer(request, "Casey Backup Request");
  await createBooking(request, {
    customerToken: primaryCustomer.token,
    providerId: provider.providerId,
    customerName: "Taylor First Job",
    hoursFromNow: 48
  });
  await createBooking(request, {
    customerToken: declineCustomer.token,
    providerId: provider.providerId,
    customerName: "Casey Backup Request",
    hoursFromNow: 72
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await loginUi(page, "provider", provider.email);
  await expect(page).toHaveURL(/\/provider\/management$/);

  const primaryJob = page.locator("article.history-card").filter({ hasText: "Taylor First Job" });
  const declineJob = page.locator("article.history-card").filter({ hasText: "Casey Backup Request" });
  await expect(primaryJob).toBeVisible();
  await expect(primaryJob.getByText(/Status: requested/i)).toBeVisible();

  await primaryJob.getByRole("button", { name: "Confirm booking" }).click();
  await expect(page.getByText("Booking confirmed. Your crew can now head out when ready.")).toBeVisible();
  await primaryJob.getByRole("button", { name: "Start route" }).click();
  await expect(page.getByText("Route started. Customer tracking and chat are now live.")).toBeVisible();

  const startWork = primaryJob.getByRole("button", { name: "Start work" });
  await expect(startWork).toBeDisabled();
  await primaryJob.getByLabel("Before service photo").setInputFiles({
    name: "before.png",
    mimeType: "image/png",
    buffer: tinyPng
  });
  await expect(page.getByText("Before-service photo saved. Work can now begin.")).toBeVisible();
  await expect(startWork).toBeEnabled();
  await startWork.click();
  await expect(page.getByText("Work started.")).toBeVisible();

  const completeJob = primaryJob.getByRole("button", { name: "Complete job" });
  await expect(completeJob).toBeDisabled();
  await primaryJob.getByLabel("After service photo").setInputFiles({
    name: "after.png",
    mimeType: "image/png",
    buffer: tinyPng
  });
  await expect(page.getByText("After-service photo saved. The job can now be completed.")).toBeVisible();
  await expect(completeJob).toBeEnabled();

  await captureResponsiveEvidence(page, "provider-job-in-progress", primaryJob);
  await page.setViewportSize({ width: 1440, height: 900 });
  await completeJob.click();
  await expect(page.getByText("Job marked complete.")).toBeVisible();
  await expect(primaryJob).toHaveCount(0);

  await declineJob.locator("details").filter({ hasText: "More options" }).getByText("More options").click();
  await declineJob.getByRole("button", { name: "Decline request" }).click();
  await expect(page.getByText("Booking declined. The customer can choose another qualified provider.")).toBeVisible();
  await expect(declineJob).toHaveCount(0);

  await page.goto("/provider/payments");
  await expect(page.getByTestId("provider-connect-status")).toBeVisible();
  await expect(page.getByText("How the payout account works")).toBeVisible();
  await expect(page.getByText(/transfers go only to the provider business/i)).toBeVisible();
  const compensationPolicy = page.locator("article.card").filter({ hasText: "Managed by your business" });
  await expect(compensationPolicy).toBeVisible();
  await expect(page.getByText("No crew wages are deducted or disbursed by YardMatch.")).toBeVisible();
  await captureResponsiveEvidence(page, "provider-payments-responsibility", compensationPolicy);
});
