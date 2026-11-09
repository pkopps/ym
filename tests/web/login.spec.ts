import { expect, hydrateContextNavigation, test, type Page } from "./fixtures";
import {
  apiBaseUrl,
  barnegatAddress,
  evidenceRoot,
  opsEmail,
  opsPassword,
  registerCustomer,
  registerProvider,
  testPassword,
  uniqueEmail
} from "./workflow-helpers";

async function submitLogin(page: Page, email: string, password = testPassword) {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
}

async function readPreviewCode(page: Page, label: RegExp): Promise<string> {
  const preview = page.getByText(label).last();
  await expect(preview).toBeVisible();
  const code = (await preview.textContent())?.match(/\b\d{6}\b/)?.[0];
  expect(code).toBeTruthy();
  return code as string;
}

async function storedRole(page: Page) {
  return page.evaluate(() => {
    for (const key of Object.keys(window.localStorage)) {
      try {
        const role = (JSON.parse(window.localStorage.getItem(key) ?? "null") as { role?: string } | null)?.role;
        if (role) return role;
      } catch {
        // Not a JSON entry.
      }
    }
    return undefined;
  });
}

test("login page is one heading and one form with sign-in field hints", async ({ page }) => {
  for (const viewport of [{ label: "desktop", width: 1440, height: 900 }, { label: "mobile", width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/login");

    await expect(page.getByRole("heading", { level: 1, name: "Log in", exact: true })).toBeVisible();
    await expect(page.locator("main").getByRole("heading")).toHaveCount(1);
    await expect(page.locator("main p")).toHaveCount(0);
    await expect(page.locator("main img")).toHaveCount(0);

    const email = page.getByLabel("Email");
    await expect(email).toHaveAttribute("type", "email");
    await expect(email).toHaveAttribute("autocomplete", "username");
    await expect(email).toHaveAttribute("inputmode", "email");
    await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("autocomplete", "current-password");

    await expect(page.locator("main .button")).toHaveCount(1);
    await expect(page.locator("main .button")).toHaveText("Log in");
    await expect(page.getByRole("button", { name: "Forgot password?" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Continue with Google" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Continue with Apple" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Create an account" })).toHaveAttribute("href", "/auth");
    await expect(page.locator("main").getByRole("link", { name: "Back" })).toHaveCount(0);
    await expect(page.locator("html")).toHaveJSProperty("scrollWidth", viewport.width);
    await page.screenshot({ path: `${evidenceRoot}/single-login/login-${viewport.label}.png`, fullPage: true });
  }
});

test("one login form sends each role to its own workspace", async ({ browser, request }) => {
  const customer = await registerCustomer(request);
  const provider = await registerProvider(request);
  const crewEmail = uniqueEmail("crew");
  const crewRegistration = await request.post(`${apiBaseUrl}/api/auth/register`, {
    data: {
      fullName: "Riley Crew",
      email: crewEmail,
      password: testPassword,
      phone: "555-0173",
      role: "crew-member",
      address: barnegatAddress,
      categories: ["lawn-mowing"],
      availableWeekdays: [1, 2, 3],
      willingToTravelMiles: 15,
      preferredSchedule: "part-time",
      hasOwnEquipment: false,
      winterWorkEnabled: false
    }
  });
  expect(crewRegistration.ok(), await crewRegistration.text()).toBeTruthy();

  for (const [email, role, destination] of [
    [customer.email, "customer", /\/customer\/dashboard$/],
    [provider.email, "provider", /\/provider\/management$/],
    [crewEmail, "crew-member", /\/crew$/]
  ] as const) {
    const context = hydrateContextNavigation(await browser.newContext());
    const page = await context.newPage();
    try {
      await page.goto("/login");
      await submitLogin(page, email);
      await expect(page).toHaveURL(destination);
      expect(await storedRole(page)).toBe(role);
    } finally {
      await context.close();
    }
  }
});

test("returnTo is honored for the signed-in role and ignored for another role or site", async ({ browser, request }) => {
  const provider = await registerProvider(request);

  for (const [returnTo, destination] of [
    ["/provider/clients", /\/provider\/clients$/],
    ["/customer/dashboard?flow=request", /\/provider\/management$/],
    ["https://example.com/provider/clients", /\/provider\/management$/],
    ["//example.com/provider", /\/provider\/management$/]
  ] as const) {
    const context = hydrateContextNavigation(await browser.newContext());
    const page = await context.newPage();
    try {
      await page.goto(`/login?returnTo=${encodeURIComponent(returnTo)}`);
      await submitLogin(page, provider.email);
      await expect(page).toHaveURL(destination);
      expect(page.url()).not.toContain("example.com");
    } finally {
      await context.close();
    }
  }
});

test("former role login addresses lead to the single page and keep returnTo", async ({ page, request }) => {
  for (const role of ["customer", "provider", "crew"]) {
    const response = await request.get(`/login/${role}?returnTo=%2Fprovider%2Fclients`, { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers().location).toMatch(/\/login\?returnTo=%2Fprovider%2Fclients$/);

    await page.goto(`/login/${role}?returnTo=${encodeURIComponent("/provider/clients?view=map")}`);
    await expect(page).toHaveURL(/\/login\?returnTo=/);
    expect(new URL(page.url()).pathname).toBe("/login");
    expect(new URL(page.url()).searchParams.get("returnTo")).toBe("/provider/clients?view=map");
    await expect(page.getByRole("heading", { level: 1, name: "Log in", exact: true })).toBeVisible();
  }

  await page.goto("/es/login/provider");
  expect(new URL(page.url()).pathname).toBe("/es/login");
  await expect(page.getByRole("heading", { level: 1, name: "Iniciar sesion", exact: true })).toBeVisible();
});

test("two-factor sign-in on the single page finishes at the role workspace", async ({ browser, request }) => {
  const provider = await registerProvider(request);
  const setup = await request.post(`${apiBaseUrl}/api/auth/security/two-factor/setup`, {
    data: { method: "email" },
    headers: { Authorization: `Bearer ${provider.token}` }
  });
  expect(setup.ok(), await setup.text()).toBeTruthy();
  const setupBody = (await setup.json()) as { codePreview?: string; challengeToken?: string };
  expect(setupBody.codePreview).toBeTruthy();
  const confirm = await request.post(`${apiBaseUrl}/api/auth/security/two-factor/confirm`, {
    data: { code: setupBody.codePreview, challengeToken: setupBody.challengeToken },
    headers: { Authorization: `Bearer ${provider.token}` }
  });
  expect(confirm.ok(), await confirm.text()).toBeTruthy();

  const context = hydrateContextNavigation(await browser.newContext());
  const page = await context.newPage();
  try {
    await page.goto(`/login?returnTo=${encodeURIComponent("/provider/clients")}`);
    await submitLogin(page, provider.email);
    await expect(page.getByRole("heading", { name: "Enter your security code" })).toBeVisible();
    expect(await storedRole(page)).toBeUndefined();

    const codeInput = page.getByLabel("6-digit security code");
    await expect(codeInput).toHaveAttribute("autocomplete", "one-time-code");
    await expect(codeInput).toHaveAttribute("inputmode", "numeric");
    await codeInput.fill("000000");
    await page.getByRole("button", { name: "Verify and sign in" }).click();
    await expect(page.locator("main").getByRole("alert")).toBeVisible();
    expect(await storedRole(page)).toBeUndefined();

    await codeInput.fill(await readPreviewCode(page, /Local test code:/));
    await page.getByRole("button", { name: "Verify and sign in" }).click();
    await expect(page).toHaveURL(/\/provider\/clients$/);
    expect(await storedRole(page)).toBe("provider");
  } finally {
    await context.close();
  }
});

test("password reset from the single page signs in with the new password only", async ({ page, request }) => {
  const customer = await registerCustomer(request);
  const newPassword = "FreshStart456!";

  await page.goto("/login");
  await page.getByLabel("Email").fill(customer.email);
  await page.getByRole("button", { name: "Forgot password?" }).click();
  await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();
  await expect(page.getByLabel("Reset code")).toHaveAttribute("inputmode", "numeric");
  await expect(page.getByLabel("New password")).toHaveAttribute("autocomplete", "new-password");

  const resetCode = await readPreviewCode(page, /Local reset code:/);
  await page.getByLabel("Reset code").fill(resetCode === "000000" ? "111111" : "000000");
  await page.getByLabel("New password").fill(newPassword);
  await page.getByRole("button", { name: "Reset password" }).click();
  await expect(page.locator("main").getByRole("alert")).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);

  expect(await storedRole(page)).toBeUndefined();
  await page.getByLabel("Reset code").fill(resetCode);
  await page.getByRole("button", { name: "Reset password" }).click();
  await expect(page).toHaveURL(/\/customer\/dashboard$/);
  expect(await storedRole(page)).toBe("customer");

  const oldPassword = await request.post(`${apiBaseUrl}/api/auth/login`, {
    data: { email: customer.email, password: testPassword }
  });
  expect(oldPassword.ok()).toBeFalsy();
  const updated = await request.post(`${apiBaseUrl}/api/auth/login`, {
    data: { email: customer.email, password: newPassword }
  });
  expect(updated.ok(), await updated.text()).toBeTruthy();
});

test("staff login is a separate page that accepts only staff accounts", async ({ browser, request }) => {
  const customer = await registerCustomer(request);

  const staffContext = hydrateContextNavigation(await browser.newContext());
  const staffPage = await staffContext.newPage();
  try {
    for (const viewport of [{ label: "desktop", width: 1440, height: 900 }, { label: "mobile", width: 390, height: 844 }]) {
      await staffPage.setViewportSize(viewport);
      await staffPage.goto("/login/ops");
      await expect(staffPage.getByRole("heading", { level: 1, name: "Staff log in", exact: true })).toBeVisible();
      await expect(staffPage.locator("main").getByRole("heading")).toHaveCount(1);
      await expect(staffPage.locator("main p")).toHaveCount(0);
      await expect(staffPage.getByRole("link", { name: /Continue with/ })).toHaveCount(0);
      await expect(staffPage.getByRole("link", { name: "Create an account" })).toHaveCount(0);
      await expect(staffPage.locator("html")).toHaveJSProperty("scrollWidth", viewport.width);
      await staffPage.screenshot({ path: `${evidenceRoot}/single-login/staff-login-${viewport.label}.png`, fullPage: true });
    }

    // A customer, provider or crew account is refused here and no session is kept.
    await submitLogin(staffPage, customer.email);
    await expect(staffPage.locator("main").getByRole("alert")).toContainText("This page is for YardMatch staff accounts.");
    await expect(staffPage).toHaveURL(/\/login\/ops$/);
    expect(await storedRole(staffPage)).toBeUndefined();

    await submitLogin(staffPage, opsEmail, opsPassword);
    await expect(staffPage).toHaveURL((url) => url.pathname === "/ops");
    expect(await storedRole(staffPage)).toBe("ops");
  } finally {
    await staffContext.close();
  }

  // The shared page does not open the operations workspace for a staff account.
  const memberContext = hydrateContextNavigation(await browser.newContext());
  const memberPage = await memberContext.newPage();
  try {
    await memberPage.goto(`/login?returnTo=${encodeURIComponent("/ops")}`);
    await submitLogin(memberPage, opsEmail, opsPassword);
    await expect(memberPage.locator("main").getByRole("alert")).toContainText("Staff accounts log in from the staff login page.");
    await expect(memberPage).toHaveURL(/\/login\?returnTo=/);
    expect(await storedRole(memberPage)).toBeUndefined();
  } finally {
    await memberContext.close();
  }
});
