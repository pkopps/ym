import type { PaymentRecord, SupportOpsTicket } from "@yardmatch/contracts";
import { expect, test } from "@playwright/test";
import { apiBaseUrl, approveProvider, authenticatedGet, authenticatedPost, createBooking, evidenceRoot, loginUi, opsEmail, opsPassword, registerCustomer, registerProvider, testPassword } from "./workflow-helpers";
import { mkdir } from "node:fs/promises";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aDXsAAAAASUVORK5CYII=", "base64");

test("customer complaint form submits evidence, supports human review, and protects ops routes", async ({ page, request }) => {
  test.setTimeout(90000);
  const provider = await registerProvider(request);
  await approveProvider(request, provider.providerId, provider.token);
  const customer = await registerCustomer(request, "Casey Complaint");
  const booking = await createBooking(request, { customerToken: customer.token, providerId: provider.providerId });
  const denied = await request.post(`${apiBaseUrl}/api/support/ops/partial-refund`, { headers: { Authorization: `Bearer ${customer.token}` }, data: { ticketId: "no", paymentId: "no", amountCents: 1500 } });
  expect(denied.status()).toBe(403);
  const deniedAssessment = await request.post(`${apiBaseUrl}/api/support/ops/complaints/assess`, { headers: { Authorization: `Bearer ${customer.token}` }, data: { ticketId: "no" } });
  expect(deniedAssessment.status()).toBe(403);
  const providerDenied = await request.post(`${apiBaseUrl}/api/support/complaints`, { headers: { Authorization: `Bearer ${provider.token}` }, data: { bookingId: booking.id } });
  expect(providerDenied.status()).toBe(403);
  await page.goto("/login/customer");
  await page.getByLabel("Email").fill(customer.email); await page.getByLabel("Password").fill(testPassword);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL(/customer/);
  await page.goto(`/help?bookingId=${booking.id}`);
  const panel = page.getByRole("region", { name: "Report a problem", exact: true });
  await expect(panel).toBeVisible();
  await panel.getByLabel("Which task or area?").fill("Backyard edging");
  await panel.getByLabel("What should we know?").fill("The edging beside the fence was missed. Please review this area.");
  await panel.getByLabel("How would you prefer to resolve this?").selectOption("refund");
  await expect(panel.getByRole("button", { name: "Submit report" })).toBeDisabled();
  await panel.getByLabel("Add photos (up to two)").setInputFiles({ name: "fence.png", mimeType: "image/png", buffer: png });
  await expect(panel.getByRole("button", { name: "Submit report" })).toBeEnabled();
  await mkdir(evidenceRoot, { recursive: true });
  for (const viewport of [{ width: 1440, height: 900, name: "desktop" }, { width: 390, height: 844, name: "mobile" }]) {
    await page.setViewportSize(viewport); await panel.scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await panel.screenshot({ path: `${evidenceRoot}/complaint-form-${viewport.name}.png` });
  }
  await panel.getByRole("button", { name: "Submit report" }).click();
  await expect(panel.getByRole("status")).toHaveText("Your report is saved");
  await expect(panel.getByRole("heading", { name: "Your service reports" })).toBeVisible();
  await panel.getByRole("button", { name: "Ask a person to review" }).click();
  await expect(panel.getByText("I would like a person to review this report and any resolution.", { exact: true })).toBeVisible();
  await loginUi(page, "ops", opsEmail, opsPassword);
  await expect(page).toHaveURL(/ops/);
  await page.goto("/ops?view=support#ops-support");
  await expect(page.getByRole("heading", { name: "Service report review" }).first()).toBeVisible();
  await expect(page.getByText("Human review requested", { exact: true }).first()).toBeVisible();
  for (const viewport of [{ width: 1440, height: 900, name: "desktop" }, { width: 390, height: 844, name: "mobile" }]) {
    await page.setViewportSize(viewport);
    await page.getByRole("heading", { name: "Service report review" }).first().scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole("region", { name: "Service report review", exact: true }).first().screenshot({ path: `${evidenceRoot}/complaint-review-${viewport.name}.png` });
  }
});

test("ops partial-refund controls display exact amounts and preserve a stable retry payload", async ({ page, request }) => {
  test.setTimeout(60000);
  const provider = await registerProvider(request);
  const opsToken = await approveProvider(request, provider.providerId, provider.token);
  const customer = await registerCustomer(request, "Jordan Refund Fixture");
  const booking = await createBooking(request, { customerToken: customer.token, providerId: provider.providerId });
  const report = await authenticatedPost<{ id: string }>(request, customer.token, "/api/support/complaints", {
    bookingId: booking.id, kind: "quality", affectedArea: "Backyard", description: "The cleanup around the fence needs attention.", preferredRemedy: "refund", noPhotoReason: "I am away from the property."
  });
  const item = (await authenticatedGet<SupportOpsTicket[]>(request, opsToken, "/api/support/ops/tickets")).find(item => item.ticket.id === report.id)!;
  // Explicit browser fixture: payment processing and ledger durability are exercised by API and PostgreSQL tests.
  item.booking = { ...item.booking!, status: "completed", completedAt: new Date().toISOString() };
  item.payment = { id: "payment-ui-fixture", bookingId: booking.id, amountCents: 10000, currency: "usd", processor: "stripe", status: "captured", refundable: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), partialRefunds: [], refundedAmountCents: 0 };
  await page.route(`${apiBaseUrl}/api/support/ops/tickets`, route => route.fulfill({ json: [item] }));
  const requests: unknown[] = [];
  await page.route(`${apiBaseUrl}/api/support/ops/partial-refund`, route => {
    const payload = route.request().postDataJSON(); requests.push(payload);
    item.payment = { ...item.payment!, partialRefunds: [{ id: "refund-ui-fixture", refundedBeforeCents: 0, funding: "platform", ticketId: report.id, actorUserId: "ops-fixture", amountCents: payload.amountCents,
      idempotencyKey: payload.idempotencyKey, reason: payload.reason, status: "pending", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }] } satisfies PaymentRecord;
    return route.fulfill({ json: item.payment });
  });
  await loginUi(page, "ops", opsEmail, opsPassword); await expect(page).toHaveURL(/\/ops/);
  const panel = page.getByRole("region", { name: "Service report review", exact: true });
  await expect(panel.getByText("Remaining payment: $100.00", { exact: true })).toBeVisible();
  await panel.getByLabel("Refund amount (USD)").fill("15.005");
  await panel.getByLabel("Decision and amount rationale").fill("YardMatch goodwill for the missed cleanup at the fence.");
  await expect(panel.getByRole("button", { name: "Approve partial refund" })).toBeDisabled();
  await panel.getByLabel("Refund amount (USD)").fill("15.00");
  await expect(panel.getByRole("button", { name: "Approve partial refund" })).toBeEnabled();
  for (const viewport of [{ width: 1440, height: 900, name: "desktop" }, { width: 390, height: 844, name: "mobile" }]) {
    await page.setViewportSize(viewport);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await panel.screenshot({ path: `${evidenceRoot}/partial-refund-${viewport.name}.png` });
  }
  await panel.getByRole("button", { name: "Approve partial refund" }).click();
  await expect(panel.getByText(/\$15.00 · pending · platform/)).toBeVisible();
  await expect(panel.getByRole("button", { name: "Approve partial refund" })).toBeDisabled();
  expect(requests).toHaveLength(1); expect(requests[0]).toMatchObject({ amountCents: 1500, ticketId: report.id, paymentId: "payment-ui-fixture" });
});
