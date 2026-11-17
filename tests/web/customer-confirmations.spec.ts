import { expect, test } from "./fixtures";
import { approveProvider, authenticatedGet, captureResponsiveEvidence, createBooking, registerCustomer, registerProvider, testPassword } from "./workflow-helpers";

test("cancelling a visit asks first, says what is cancelled and that it is free, and Keep visit leaves it alone", async ({ page, request }) => {
  const provider = await registerProvider(request, { staffingMode: "auto-accept" });
  await approveProvider(request, provider.providerId, provider.token);
  const customer = await registerCustomer(request, "Riley Confirm");
  const booking = await createBooking(request, { customerToken: customer.token, providerId: provider.providerId, customerName: "Riley Confirm", hoursFromNow: 72 });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/login");
  await page.getByLabel("Email").fill(customer.email);
  await page.getByLabel("Password").fill(testPassword);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/customer\/dashboard/);

  // A single visit's card keeps cancel under More options.
  await page.getByText("More options").first().click();
  await page.getByRole("button", { name: "Cancel booking" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Cancel this visit?" });
  await expect(dialog.getByText(/22 Bay Ave, Barnegat, NJ with .*There's no charge to cancel\./)).toBeVisible();
  await captureResponsiveEvidence(page, "customer-cancel-confirmation", dialog);

  await dialog.getByRole("button", { name: "Keep visit" }).click();
  await expect(dialog).toHaveCount(0);
  const kept = await authenticatedGet<{ status: string }>(request, customer.token, `/api/bookings/detail?bookingId=${booking.id}`);
  expect(kept.status).toBe("requested");

  await page.getByRole("button", { name: "Cancel booking" }).first().click();
  await page.getByRole("dialog", { name: "Cancel this visit?" }).getByRole("button", { name: "Cancel visit" }).click();
  await expect(page.getByText("Booking cancelled.")).toBeVisible();
  const cancelled = await authenticatedGet<{ status: string }>(request, customer.token, `/api/bookings/detail?bookingId=${booking.id}`);
  expect(cancelled.status).toBe("cancelled");
});
