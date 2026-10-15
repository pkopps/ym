import { expect, hydrateContextNavigation, test, type APIRequestContext, type Page } from "./fixtures";

const apiBaseUrl = process.env.API_BASE_URL ?? `http://localhost:${process.env.PORT ?? process.env.YARDMATCH_API_PORT ?? 4001}`;
const evidenceRoot = "reports/agent-checkpoints/engineer/latest";

async function registerSecurityCustomer(request: APIRequestContext, email: string, password: string) {
  const response = await request.post(`${apiBaseUrl}/api/auth/register`, {
    data: {
      fullName: "Security Check",
      email,
      password,
      phone: "+15558675309",
      role: "customer",
      propertyLabel: "Primary home",
      address: {
        line1: "170 5th Ave",
        city: "Brooklyn",
        state: "NY",
        postalCode: "11201",
        country: "US",
        point: {
          latitude: 40.6782,
          longitude: -73.9442
        }
      }
    }
  });

  expect(response.ok(), await response.text()).toBeTruthy();
}

async function logIn(page: Page, email: string, password: string) {
  await page.goto("/login/customer");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
}

async function readLocalSecurityCode(page: Page): Promise<string> {
  const preview = page.getByText(/Local test code:/).last();
  await expect(preview).toBeVisible();
  const code = (await preview.textContent())?.match(/\b\d{6}\b/)?.[0];
  expect(code).toBeTruthy();
  return code as string;
}

test("customer can enable email 2FA and verify a new mobile-sized device", async ({ browser, page, request }) => {
  const email = `security-flow-${Date.now()}@example.com`;
  const password = "SecureFlow123!";
  await registerSecurityCustomer(request, email, password);

  await page.setViewportSize({ width: 1440, height: 900 });
  await logIn(page, email, password);
  await expect(page).toHaveURL(/\/customer\/dashboard/);

  await page.goto("/account/security");
  await expect(page.getByRole("heading", { level: 1, name: "Account security" })).toBeVisible();
  await page.getByRole("button", { name: "Send setup code" }).click();
  await page.getByLabel("6-digit security code").fill(await readLocalSecurityCode(page));
  await page.getByRole("button", { name: "Confirm and turn on" }).click();

  await expect(page.getByText(/On — codes are sent to/)).toBeVisible();
  await expect(page.getByText(/Current device/)).toBeVisible();
  await page.screenshot({
    path: `${evidenceRoot}/account-security-enabled-desktop.png`,
    fullPage: true
  });

  const mobileContext = hydrateContextNavigation(await browser.newContext({ viewport: { width: 390, height: 844 } }));
  const mobilePage = await mobileContext.newPage();
  try {
    await logIn(mobilePage, email, password);
    await expect(mobilePage.getByRole("heading", { name: "Enter your security code" })).toBeVisible();
    await expect(mobilePage.getByText("Remember this device for 30 days")).toBeVisible();
    await mobilePage.screenshot({
      path: `${evidenceRoot}/two-factor-login-mobile.png`,
      fullPage: true
    });

    await mobilePage.getByLabel("6-digit security code").fill(await readLocalSecurityCode(mobilePage));
    await mobilePage.getByRole("button", { name: "Verify and sign in" }).click();
    await expect(mobilePage).toHaveURL(/\/customer\/dashboard/);

    await mobilePage.goto("/account/security");
    await expect(mobilePage.getByText("New-device alerts are always on")).toBeVisible();
    await expect(mobilePage.getByText(/New-device sign-in completed/).first()).toBeVisible();
    await mobilePage.screenshot({
      path: `${evidenceRoot}/account-security-activity-mobile.png`,
      fullPage: true
    });
  } finally {
    await mobileContext.close();
  }
});
