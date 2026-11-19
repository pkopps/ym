// N6, N7, N10, N11 and N12 from reports/explorer/summary-2026-11-17.md.
import { expect, test } from "./fixtures";
import {
  apiBaseUrl, approveProvider, authenticatedPost, barnegatAddress, captureResponsiveEvidence, createBooking, loginUi,
  registerCustomer, registerProvider, testPassword, uniqueEmail
} from "./workflow-helpers";

test("N6: a visit card says which day and which property", async ({ page, request }) => {
  const provider = await registerProvider(request);
  await approveProvider(request, provider.providerId, provider.token);
  const customer = await registerCustomer(request, "Quinn Dates");
  await createBooking(request, { customerToken: customer.token, providerId: provider.providerId, customerName: "Quinn Dates", hoursFromNow: 72 });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/login");
  await page.getByLabel("Email").fill(customer.email);
  await page.getByLabel("Password").fill(testPassword);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/customer\/dashboard/);
  // Weekday and date, then the arrival window; and the street with its town.
  await expect(page.getByText(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), [A-Z][a-z]{2} \d{1,2} · /).first()).toBeVisible();
  await expect(page.getByText(/22 Bay Ave, Barnegat/).first()).toBeVisible();
});

test("N7, N10: business setup speaks to the provider, and a credential takes a PDF", async ({ page, request }) => {
  const provider = await registerProvider(request);
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginUi(page, "provider", provider.email);
  await expect(page).toHaveURL(/\/provider\/management$/);
  // Business setup starts open until the business is approved.
  const setup = page.locator("#provider-setup");
  await expect(setup.getByText(`We'll review your business and email you at ${provider.email} when it's approved.`)).toBeVisible();
  await expect(setup).not.toContainText(/\bops\b|launch route|counsel|signal/i);

  const credentials = page.locator("#provider-credentials");
  await credentials.getByLabel("Credential type", { exact: true }).selectOption("commercial-auto-insurance");
  await credentials.getByLabel("Photo or PDF of the document").setInputFiles({
    name: "auto-policy.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF")
  });
  await credentials.getByRole("button", { name: "Submit credential", exact: true }).click();
  await expect(credentials.getByText("Credential submitted for review.")).toBeVisible();
  await expect(credentials.getByText("Commercial auto insurance: we're checking it · document attached")).toBeVisible();
});

test("N12, N11: a provider adds a crew member, puts them on a job, and the crew sees the site details", async ({ page, request }) => {
  const provider = await registerProvider(request, { staffingMode: "review-first" });
  await approveProvider(request, provider.providerId, provider.token);
  const customer = await registerCustomer(request, "Sky Gatecode");
  const booking = await createBooking(request, { customerToken: customer.token, providerId: provider.providerId, customerName: "Sky Gatecode", hoursFromNow: 50 });
  await authenticatedPost(request, provider.token, "/api/bookings/confirm", { bookingId: booking.id });

  // An existing crew account, so the test can sign in as them.
  const crewEmail = uniqueEmail("own-crew");
  const crewResponse = await request.post(`${apiBaseUrl}/api/auth/register`, { data: {
    role: "crew-member", fullName: "Jordan Owncrew", email: crewEmail, password: testPassword, phone: "555-0190",
    address: barnegatAddress, categories: ["lawn-mowing"], availableWeekdays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], willingToTravelMiles: 30
  } });
  expect(crewResponse.ok(), await crewResponse.text()).toBeTruthy();

  await page.setViewportSize({ width: 1440, height: 900 });
  await loginUi(page, "provider", provider.email);
  const crewSection = page.locator("#provider-crew");
  await crewSection.locator("summary").first().click();
  await crewSection.getByLabel("Full name").fill("Jordan Owncrew");
  await crewSection.getByLabel("Email").fill(crewEmail);
  await crewSection.getByRole("button", { name: "Send invite" }).click();
  await expect(crewSection.getByText("Jordan Owncrew joined your crew. They can sign in with their existing account.")).toBeVisible();
  await expect(crewSection.getByText("Jordan Owncrew", { exact: true })).toBeVisible();
  await captureResponsiveEvidence(page, "provider-crew-panel", crewSection);

  const job = page.locator(`#provider-job-${booking.id}`);
  await job.getByLabel("Add from your crew").selectOption({ label: "Jordan Owncrew" });
  await job.getByRole("button", { name: "Add to job" }).click();
  await expect(page.getByText("Jordan Owncrew is on this job and has been told.")).toBeVisible();

  await loginUi(page, "crew", crewEmail);
  const card = page.locator("article.crew-opportunity-card").filter({ hasText: provider.companyName });
  await expect(card.getByRole("heading", { name: "On site" })).toBeVisible();
  await expect(card.getByText("Launch workflow request for Sky Gatecode")).toBeVisible();
  await expect(card.getByText("Take before photos before you start and after photos when you finish.")).toBeVisible();
  await captureResponsiveEvidence(page, "crew-site-instructions", card);
});
