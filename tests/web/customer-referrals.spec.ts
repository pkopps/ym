import { expect, test, type Page } from "./fixtures";
import { apiBaseUrl, evidenceRoot, registerCustomer } from "./workflow-helpers";

async function signIn(page: Page, customer: Awaited<ReturnType<typeof registerCustomer>>) {
  await page.goto("/customer");
  await page.evaluate((account) => {
    localStorage.setItem("yardmatch-web-session", JSON.stringify({ token: account.token, userId: account.customerId, email: account.email,
      fullName: "Taylor Customer", role: "customer", expiresAtIso: new Date(Date.now() + 3_600_000).toISOString() }));
    window.dispatchEvent(new Event("yardmatch-web-session-change"));
  }, customer);
}

test("customer saves email and phone referrals, opens prepared invitations, and sees durable history on desktop and mobile", async ({ page, request }) => {
  const customer = await registerCustomer(request);
  await signIn(page, customer);
  await page.goto("/customer/referrals");
  await expect(page.getByRole("heading", { name: "Refer a friend" })).toBeVisible();
  await page.getByLabel("Friend's name", { exact: true }).fill("Jamie Neighbor");
  await page.getByLabel("Friend's email address").fill("Jamie.Neighbor@example.com");
  await page.getByLabel("Town or area").fill("Barnegat");
  await page.getByLabel("My friend agreed").check();
  await page.getByRole("button", { name: "Save referral", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Referral saved");
  const email = page.getByRole("link", { name: "Open email invitation" });
  await expect(email).toHaveAttribute("href", /^mailto:jamie.neighbor%40example.com\?subject=/);
  await expect(email).toHaveAttribute("href", /%2Fcustomer/);
  await page.getByLabel("Friend's name", { exact: true }).fill("Riley Neighbor");
  await page.getByLabel("Invite by").selectOption("phone");
  await page.getByLabel("Friend's US phone number").fill("(609) 555-0112");
  await page.getByLabel("My friend agreed").check();
  await page.getByRole("button", { name: "Save referral", exact: true }).click();
  await expect(page.getByRole("link", { name: "Open text invitation" })).toHaveAttribute("href", /^sms:\+16095550112\?body=/);
  await page.reload();
  await expect(page.locator(".referral-list li")).toHaveCount(2);
  await expect(page.getByText("jamie.neighbor@example.com", { exact: true })).toBeVisible();
  await page.getByLabel("Friend's name", { exact: true }).fill("Jamie Again");
  await page.getByLabel("Friend's email address").fill("JAMIE.NEIGHBOR@example.com");
  await page.getByLabel("My friend agreed").check();
  await page.getByRole("button", { name: "Save referral", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("already saved");
  await expect(page.locator(".referral-list li")).toHaveCount(2);
  await page.getByLabel("Friend's name", { exact: true }).fill("Another Neighbor");
  await page.getByLabel("Friend's email address").fill(customer.email);
  await page.getByLabel("My friend agreed").check();
  await page.getByRole("button", { name: "Save referral", exact: true }).click();
  await expect(page.locator(".referral-page").getByRole("alert")).toContainText("instead of your own");
  await page.reload();
  await expect(page.locator(".referral-list li")).toHaveCount(2);
  for (const viewport of [{ width: 1440, height: 900, name: "desktop" }, { width: 390, height: 844, name: "mobile" }]) {
    await page.setViewportSize(viewport);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `${evidenceRoot}/referrals-${viewport.name}.png`, fullPage: true });
  }
  await page.goto("/es/customer/referrals");
  await expect(page.getByRole("heading", { name: "Recomienda a un amigo" })).toBeVisible();
  await page.locator(".referral-list li").first().getByRole("button").click();
  await expect(page.locator(".referral-result a")).toHaveAttribute("href", /%2Fes%2Fcustomer/);
  await page.evaluate(() => { localStorage.removeItem("yardmatch-web-session"); window.dispatchEvent(new Event("yardmatch-web-session-change")); });
  await expect(page.getByText("jamie.neighbor@example.com", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Inicia sesión como cliente", { exact: false })).toBeVisible();
});

test("referral form recovers from loading and saving failures without losing a draft", async ({ page, request }) => {
  const customer = await registerCustomer(request);
  await signIn(page, customer);
  let failLoad = true;
  let failSave = true;
  await page.route("**/api/customer/referrals", async (route) => {
    if (route.request().method() === "GET" && failLoad) return route.fulfill({ status: 503, json: { message: "Temporarily unavailable" } });
    if (route.request().method() === "POST" && failSave) return route.fulfill({ status: 503, json: { message: "Try saving again" } });
    return route.continue();
  });
  await page.goto("/customer/referrals");
  await expect(page.locator(".referral-page").getByRole("alert")).toContainText("couldn't load");
  failLoad = false;
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await page.getByLabel("Friend's name", { exact: true }).fill("Alex Neighbor");
  await page.getByLabel("Friend's email address").fill("alex@example.com");
  await page.getByLabel("My friend agreed").check();
  await page.getByRole("button", { name: "Save referral", exact: true }).click();
  await expect(page.locator(".referral-page").getByRole("alert")).toContainText("Try saving again");
  await expect(page.getByLabel("Friend's name", { exact: true })).toHaveValue("Alex Neighbor");
  failSave = false;
  await page.getByRole("button", { name: "Save referral", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Referral saved");
  const stranger = await registerCustomer(request);
  const response = await request.get(`${apiBaseUrl}/api/customer/referrals?customerId=${customer.customerId}`, { headers: { Authorization: `Bearer ${stranger.token}` } });
  expect((await response.json()).referrals).toEqual([]);
  const unauthorized = await request.get(`${apiBaseUrl}/api/customer/referrals`);
  expect(unauthorized.status()).toBe(401);
});
