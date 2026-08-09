import { expect, test } from "@playwright/test";

const apiBaseUrl = process.env.API_BASE_URL;
const opsEmail = process.env.YARDMATCH_SMOKE_OPS_EMAIL;
const opsPassword = process.env.YARDMATCH_SMOKE_OPS_PASSWORD;

test.beforeAll(() => {
  expect(apiBaseUrl, "API_BASE_URL is required").toBeTruthy();
  expect(opsEmail, "YARDMATCH_SMOKE_OPS_EMAIL is required").toBeTruthy();
  expect(opsPassword, "YARDMATCH_SMOKE_OPS_PASSWORD is required").toBeTruthy();
});

test("hosted web is healthy and connected to the ready marketplace API", async ({ page, request }) => {
  const webHealth = await request.get("/api/healthz");
  expect(webHealth.ok(), await webHealth.text()).toBeTruthy();
  expect(await webHealth.json()).toMatchObject({ status: "ok", apiConfigured: true });

  const apiHealth = await request.get(`${apiBaseUrl}/readyz`);
  expect(apiHealth.ok(), await apiHealth.text()).toBeTruthy();
  expect(await apiHealth.json()).toMatchObject({ status: "ready" });

  const marketplace = await request.get(`${apiBaseUrl}/api/providers/public-overview`);
  expect(marketplace.ok(), await marketplace.text()).toBeTruthy();
  const overview = await marketplace.json();
  expect(overview.verifiedProviderCount).toBeGreaterThan(0);

  await page.goto("/");
  await expect(page.getByRole("heading", { name: /yard care/i }).first()).toBeVisible();
  await expect(page.getByText(/recommended provider/i).first()).toBeVisible();
});

test("hosted ops authentication remains role-gated", async ({ page, request }) => {
  await page.goto("/ops");
  await expect(page.getByRole("heading", { name: "Internal login required" })).toBeVisible();

  const login = await request.post(`${apiBaseUrl}/api/auth/login`, {
    data: { email: opsEmail, password: opsPassword }
  });
  expect(login.ok(), await login.text()).toBeTruthy();
  const envelope = await login.json();
  expect(envelope.user).toMatchObject({ email: opsEmail, role: "ops" });

  await page.evaluate((session) => {
    window.localStorage.setItem("yardmatch-web-session", JSON.stringify(session));
  }, {
    token: envelope.session.token,
    role: envelope.user.role,
    internalScope: envelope.user.internalScope,
    email: envelope.user.email,
    userId: envelope.user.id,
    fullName: envelope.user.fullName,
    expiresAtIso: envelope.session.expiresAtIso
  });
  await page.reload();

  await expect(page.getByRole("heading", { name: "Bookings, activity, and support." })).toBeVisible();
  await expect(page.getByText("Live from the authenticated API.")).toBeVisible();
});
