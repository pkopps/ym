import { expect, test } from "@playwright/test";
import {
  approveProvider,
  authenticatedPost,
  captureResponsiveEvidence,
  createBooking,
  registerCustomer,
  registerProvider,
  testPassword,
  tinyPng,
  uniqueEmail
} from "./workflow-helpers";

test("crew selects a fit, creates preferences, receives work, routes, and sees completed assignment history", async ({ page, request }) => {
  const provider = await registerProvider(request, {
    companyName: `Crew Route Partner ${Date.now()}`,
    staffingMode: "auto-accept"
  });
  await approveProvider(request, provider.providerId);
  const customer = await registerCustomer(request, "Crew Route Customer");
  const booking = await createBooking(request, {
    customerToken: customer.token,
    providerId: provider.providerId,
    customerName: "Crew Route Customer",
    hoursFromNow: 50
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/crew");
  const opening = page.locator("article.crew-opportunity-card").filter({ hasText: provider.companyName });
  await expect(opening).toBeVisible();
  await opening.getByRole("button", { name: "Request this fit" }).click();
  await expect(page.getByText("Provider notified")).toBeVisible();
  await page.getByRole("link", { name: "Sign up for this opening" }).click();
  await expect(page).toHaveURL(/\/auth\/crew\?.*opportunityId=/);
  await expect(page.getByText("Opening selected")).toBeVisible();

  const crewEmail = uniqueEmail("crew-assignment");
  await page.getByLabel("Full name").fill("Riley Crew");
  await page.getByLabel("Email").fill(crewEmail);
  await page.getByLabel("Phone").fill("555-0182");
  await page.getByLabel("Password", { exact: true }).fill(testPassword);
  await page.getByLabel("Confirm password").fill(testPassword);
  await page.getByLabel("Home base").fill("18 Bay Ave");
  await page.getByLabel("City").fill("Barnegat");
  await page.getByLabel("State").fill("NJ");
  await page.getByLabel("ZIP").fill("08005");
  await page.getByRole("button", { name: "Create crew account" }).click();

  await expect(page).toHaveURL(/\/crew$/);
  const assignment = page.locator("article.crew-opportunity-card").filter({ hasText: provider.companyName });
  await expect(assignment).toBeVisible();
  await expect(assignment.getByText("accepted", { exact: true })).toBeVisible();
  await expect(assignment.getByRole("link", { name: "Get help" })).toBeVisible();
  await page.getByRole("button", { name: "+5 miles" }).first().click();
  await expect(page.getByText("Availability updated.")).toBeVisible();

  await captureResponsiveEvidence(page, "crew-assignment-accepted", assignment);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/crew/schedule");
  await expect(page.getByText("1").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: provider.companyName }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Google Maps" }).first()).toBeVisible();

  await authenticatedPost(request, provider.token, "/api/bookings/confirm", { bookingId: booking.id });
  await authenticatedPost(request, provider.token, "/api/bookings/on-route", { bookingId: booking.id });
  await page.goto("/crew");
  const routedAssignment = page.locator("article.crew-opportunity-card").filter({ hasText: provider.companyName });
  await routedAssignment.getByLabel("Before service photo").setInputFiles({
    name: "crew-before.png",
    mimeType: "image/png",
    buffer: tinyPng
  });
  await expect(page.getByText("Before-service photo saved. Work can now begin.")).toBeVisible();
  await routedAssignment.getByRole("button", { name: "Start work" }).click();
  await expect(page.getByText(/Work started/)).toBeVisible();
  await routedAssignment.getByLabel("After service photo").setInputFiles({
    name: "crew-after.png",
    mimeType: "image/png",
    buffer: tinyPng
  });
  await expect(page.getByText("After-service photo saved.")).toBeVisible();

  await authenticatedPost(request, provider.token, "/api/bookings/complete", { bookingId: booking.id });
  await page.goto("/crew/schedule/history");
  await expect(page.getByRole("heading", { name: "Past job history." })).toBeVisible();
  await expect(page.getByText(provider.companyName)).toBeVisible();
  await expect(page.getByText("Provider business handles compensation.", { exact: true })).toBeVisible();
  await captureResponsiveEvidence(
    page,
    "crew-assignment-history",
    page.getByText(provider.companyName, { exact: true })
  );
});
