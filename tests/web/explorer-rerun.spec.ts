// Regression coverage for the explorer re-run of November 17, 2026 (reports/explorer/summary-2026-11-17.md).
import { expect, test } from "./fixtures";
import { approveProvider, authenticatedGet, authenticatedPost, captureResponsiveEvidence, createBooking, loginUi, registerCustomer, registerProvider } from "./workflow-helpers";

test("N4: a typed street address goes straight to matches, with no location prompt", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByRole("textbox", { name: "Where", exact: true }).fill("100 Atlantic Ave, Brooklyn, NY 11201");
  await page.getByRole("button", { name: "Find my match" }).click();
  await expect(page.getByRole("dialog", { name: "Find care near you" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Your top matches" })).toBeVisible();
});

test("N3: one-tap late and issue notices wait until the visit is close and ask before telling the customer", async ({ page, request }) => {
  const provider = await registerProvider(request, { staffingMode: "auto-accept" });
  await approveProvider(request, provider.providerId, provider.token);
  const soon = await registerCustomer(request, "Jordan Soon");
  const later = await registerCustomer(request, "Morgan Later");
  const soonBooking = await createBooking(request, { customerToken: soon.token, providerId: provider.providerId, customerName: "Jordan Soon", hoursFromNow: 2 });
  const laterBooking = await createBooking(request, { customerToken: later.token, providerId: provider.providerId, customerName: "Morgan Later", hoursFromNow: 72 });
  await authenticatedPost(request, provider.token, "/api/bookings/confirm", { bookingId: soonBooking.id });
  await authenticatedPost(request, provider.token, "/api/bookings/confirm", { bookingId: laterBooking.id });

  await page.setViewportSize({ width: 1440, height: 900 });
  await loginUi(page, "provider", provider.email);
  const laterJob = page.locator("article.history-card").filter({ hasText: "Morgan Later" });
  await expect(laterJob).toBeVisible();
  await expect(laterJob.getByText("Report issue", { exact: true })).toHaveCount(0);

  const soonJob = page.locator("article.history-card").filter({ hasText: "Jordan Soon" });
  await soonJob.getByText("Report issue", { exact: true }).click();
  // The window hasn't started, so no-show isn't offered yet.
  await expect(soonJob.getByRole("button", { name: "Customer no-show" })).toHaveCount(0);
  await soonJob.getByRole("button", { name: "Running 15 min late" }).click();
  const dialog = page.getByRole("dialog", { name: "Tell the customer you're running 15 minutes late?" });
  await expect(dialog.getByText(/Jordan Soon gets a message now with a new arrival time of/)).toBeVisible();
  await captureResponsiveEvidence(page, "provider-late-confirmation", dialog);
  await dialog.getByRole("button", { name: "Not now" }).click();
  await expect(dialog).toHaveCount(0);
  const untouched = await authenticatedGet<{ scheduleUpdates?: unknown[] }>(request, soon.token, `/api/bookings/detail?bookingId=${soonBooking.id}`);
  expect(untouched.scheduleUpdates ?? []).toHaveLength(0);

  await soonJob.getByRole("button", { name: "Running 15 min late" }).click();
  await page.getByRole("dialog", { name: "Tell the customer you're running 15 minutes late?" }).getByRole("button", { name: "Send to customer" }).click();
  await expect(page.getByText("Customer notified of the delay.")).toBeVisible();
});
