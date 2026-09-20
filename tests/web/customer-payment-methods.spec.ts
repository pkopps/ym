import { expect, test } from "@playwright/test";
import { apiBaseUrl, registerProvider, registerCustomer, approveProvider, createBooking, authenticatedPost, loginApi, evidenceRoot } from "./workflow-helpers";

test("wallet-first checkout, optional bank guidance, and asynchronous payment status", async ({ page, request }) => {
  test.setTimeout(120000);
  const provider = await registerProvider(request);
  await approveProvider(request, provider.providerId, provider.token);
  const customer = await registerCustomer(request, "Casey Payment");
  const booking = await createBooking(request, { customerToken: customer.token, providerId: provider.providerId, hoursFromNow: 72 });
  await authenticatedPost(request, provider.token, "/api/bookings/confirm", { bookingId: booking.id });
  const auth = await loginApi(request, customer.email);
  await page.addInitScript(({ token, customer }) => {
    localStorage.setItem("yardmatch-web-session", JSON.stringify({ token, role: "customer", email: customer.email, userId: customer.customerId, fullName: "Casey Payment", expiresAtIso: new Date(Date.now() + 3600000).toISOString() }));
    localStorage.setItem("yardmatch-analytics-permission", "no");
  }, { token: auth.session.token, customer });
  let status = "pending";
  let returning = false;
  const payment = () => ({ id: "payment_browser_fixture", bookingId: booking.id, amountCents: booking.totalCents, currency: "usd", processor: "stripe", status, refundable: status === "captured", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  await page.route(`${apiBaseUrl}/api/payments?**`, route => route.fulfill({ json: [payment()] }));
  await page.route(`${apiBaseUrl}/api/bookings?**`, async route => {
    const response = await route.fetch();
    const data = await response.json();
    if (returning) {
      const previous = { ...booking, id: "previous_completed", status: "completed", completedAt: new Date().toISOString(), scheduledStartIso: new Date(Date.now() - 86400000).toISOString() };
      if (Array.isArray(data)) data.push(previous); else data.items.push(previous);
    }
    await route.fulfill({ response, json: data });
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/customer/dashboard");
  const guide = page.getByTestId("payment-method-guide").first();
  await expect(guide).toContainText("Apple Pay, Google Pay or card");
  await expect(guide.locator("summary")).toHaveText("Prefer to pay by bank?");
  await guide.locator("summary").click();
  await expect(guide).toContainText("does not enroll you in autopay");
  await expect(page.getByRole("button", { name: "Continue checkout", exact: true }).first()).toBeVisible();
  await guide.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${evidenceRoot}/payment-methods-desktop.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await guide.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${evidenceRoot}/payment-methods-mobile.png` });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  let checkoutRequests = 0;
  await page.route(`${apiBaseUrl}/api/payments/checkout-session`, route => {
    checkoutRequests++;
    expect(route.request().postDataJSON().bookingId).toBe(booking.id);
    return route.fulfill({ json: { checkoutUrl: new URL("/test-checkout", page.url()).href, payment: payment() } });
  });
  await page.route("**/test-checkout", route => route.fulfill({ contentType: "text/html", body: "<h1>Hosted checkout fixture</h1>" }));
  await page.getByRole("button", { name: "Continue checkout", exact: true }).first().click();
  await expect(page).toHaveURL(/\/test-checkout$/);
  expect(checkoutRequests).toBe(1);

  returning = true;
  await page.goto("/customer/dashboard");
  await expect(guide.locator("summary")).toHaveText("Booking again? Consider paying by bank");
  status = "processing";
  await page.route(`${apiBaseUrl}/api/payments/checkout-session/finalize`, route => route.fulfill({ json: payment() }));
  await page.goto("/customer/dashboard?payment=stripe-success&session_id=cs_fixture");
  await expect(page.getByRole("heading", { name: "Payment processing", exact: true })).toBeVisible();
  await expect(page.getByText(/Your payment was submitted and is awaiting confirmation/).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Continue checkout|Pay now/ })).toHaveCount(0);
  await expect(guide).toHaveCount(0);
  await page.screenshot({ path: `${evidenceRoot}/payment-processing-mobile.png` });
  status = "captured";
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect(page.getByRole("heading", { name: "Payment processing", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Continue checkout|Pay now/ })).toHaveCount(0);

  status = "failed";
  await page.reload();
  await expect(page.getByRole("button", { name: "Pay now", exact: true }).first()).toBeVisible();
  await expect(guide).toBeVisible();
  await page.goto("/es/customer/dashboard");
  await expect(guide).toContainText("Apple Pay, Google Pay o tarjeta");
});
