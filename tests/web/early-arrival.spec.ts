import { bookingScheduleStartIso, earlierArrivalOptions } from "@yardmatch/contracts";
import { expect, test } from "./fixtures";
import { approveProvider, authenticatedGet, authenticatedPost, captureResponsiveEvidence, createBooking, registerCustomer, registerProvider, testPassword } from "./workflow-helpers";

test("a provider offers an earlier arrival and the customer accepts it in one tap", async ({ page, request }) => {
  const provider = await registerProvider(request, { staffingMode: "review-first" });
  await approveProvider(request, provider.providerId, provider.token);
  const customer = await registerCustomer(request, "Avery Early");
  // An afternoon visit two days out leaves earlier times that day to offer.
  const day = new Date(Date.now() + 2 * 24 * 3_600_000).toISOString().slice(0, 10);
  const hoursFromNow = Math.ceil((Date.parse(bookingScheduleStartIso(day, 16)) - Date.now()) / 3_600_000);
  const booking = await createBooking(request, { customerToken: customer.token, providerId: provider.providerId, customerName: "Avery Early", hoursFromNow });
  await authenticatedPost(request, provider.token, "/api/bookings/confirm", { bookingId: booking.id });
  const visit = await authenticatedGet<{ scheduledStartIso: string; scheduledEndIso: string }>(request, customer.token, `/api/bookings/detail?bookingId=${booking.id}`);
  const earlier = earlierArrivalOptions(visit.scheduledStartIso)[0]!;
  await authenticatedPost(request, provider.token, "/api/bookings/schedule-update", {
    bookingId: booking.id, kind: "early-arrival", reason: "We finished the job before yours early.", nextUpdateByIso: earlier,
    proposedStartIso: earlier, proposedEndIso: new Date(Date.parse(earlier) + Date.parse(visit.scheduledEndIso) - Date.parse(visit.scheduledStartIso)).toISOString()
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/login");
  await page.getByLabel("Email").fill(customer.email);
  await page.getByLabel("Password").fill(testPassword);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/customer\/dashboard/);
  await expect(page.getByRole("heading", { name: "Earlier arrival offered" }).first()).toBeVisible();
  const accept = page.getByRole("button", { name: /^Yes, come at / });
  await expect(accept).toBeVisible();
  await expect(page.getByRole("button", { name: "Keep my window" })).toBeVisible();
  await captureResponsiveEvidence(page, "customer-early-arrival-offer", accept.locator("xpath=ancestor::section[1]"));

  await accept.click();
  await expect(page.getByText(/Expect your provider around/).first()).toBeVisible();
  const moved = await authenticatedGet<{ scheduledStartIso: string }>(request, customer.token, `/api/bookings/detail?bookingId=${booking.id}`);
  expect(moved.scheduledStartIso).toBe(earlier);
});
