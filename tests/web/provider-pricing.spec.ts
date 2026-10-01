import { expect, test } from "@playwright/test";
import { apiBaseUrl, evidenceRoot, loginApi, opsEmail, opsPassword, testPassword, uniqueEmail } from "./workflow-helpers";

test("provider prices can be set at signup, edited afterwards, and checked against audited ZIP minimums", async ({ page, request }) => {
  test.setTimeout(120000);
  const ops = await loginApi(request, opsEmail, opsPassword);
  const zip = "08006";
  for (const category of ["lawn-mowing", "seasonal-cleanup"]) {
    const response = await request.post(`${apiBaseUrl}/api/ops/pricing/minimums`, { headers: { Authorization: `Bearer ${ops.session.token}` }, data: { postalCode: zip, category, minimumStartingPriceCents: category === "lawn-mowing" ? 3500 : 5500, reason: "Synthetic browser test minimum" } });
    expect(response.ok(), await response.text()).toBeTruthy();
  }
  const email = uniqueEmail("pricing-provider");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/auth/provider/create");
  await page.getByLabel("Full name").fill("Morgan Price");
  await page.getByLabel("Business name").fill("Bay Lawn Care");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Phone", { exact: true }).fill("555-0181");
  await page.getByLabel("Password", { exact: true }).fill(testPassword);
  await page.getByLabel("Confirm password").fill(testPassword);
  await page.getByLabel("Business address").fill("18 Bay Ave");
  await page.getByLabel("City", { exact: true }).fill("Barnegat Light");
  await page.getByLabel("State", { exact: true }).fill("NJ");
  await page.getByLabel("ZIP", { exact: true }).fill(zip);
  const panel = page.getByRole("region", { name: "Service prices", exact: true });
  await expect(panel.getByText("ZIP minimum: $35.00")).toBeVisible();
  await panel.getByLabel("Lawn mowing — Starting price (USD)").fill("48.25");
  for (const [width, height, suffix] of [[1440, 900, "desktop"], [390, 844, "mobile"]] as const) {
    await page.setViewportSize({ width, height }); await panel.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${evidenceRoot}/zip-pricing-signup-${suffix}.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page).toHaveURL(/provider\/management/);
  await page.locator('a[href="#provider-pricing"]').click();
  await expect(panel.getByLabel("Lawn mowing — Starting price (USD)")).toHaveValue("48.25");
  await panel.getByLabel("Lawn mowing — Starting price (USD)").fill("34.99");
  await expect(panel.getByRole("button", { name: "Save prices" })).toBeDisabled();
  await panel.getByLabel("Lawn mowing — Starting price (USD)").fill("52.50");
  await panel.getByRole("button", { name: "Save prices" }).click();
  await expect(panel.getByRole("status")).toHaveText("Prices saved.");
  await page.reload(); await page.locator('a[href="#provider-pricing"]').click();
  await expect(panel.getByLabel("Lawn mowing — Starting price (USD)")).toHaveValue("52.50");
  for (const [width, height, suffix] of [[1440, 900, "desktop"], [390, 844, "mobile"]] as const) {
    await page.setViewportSize({ width, height }); await panel.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${evidenceRoot}/zip-pricing-settings-${suffix}.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
  await panel.getByLabel("Service ZIP code").fill("00000");
  await expect(panel.getByText("Custom pricing is not available for this service in this ZIP yet.").first()).toBeVisible();
  await expect(panel.getByRole("button", { name: "Save prices" })).toBeDisabled();
  const provider = await loginApi(request, email);
  const result = await request.get(`${apiBaseUrl}/api/providers/pricing?postalCode=${zip}`, { headers: { Authorization: `Bearer ${provider.session.token}` } });
  expect((await result.json()).prices.find((row: { category: string }) => row.category === "lawn-mowing").savedStartingPriceCents).toBe(5250);
});

test("ops admins edit ZIP minimums and can review the recorded reason", async ({ page, request }) => {
  test.setTimeout(60000);
  const ops = await loginApi(request, opsEmail, opsPassword);
  await page.goto("/");
  await page.evaluate(account => localStorage.setItem("yardmatch-web-session", JSON.stringify({ token: account.session.token, userId: account.user.id, email: account.user.email, role: "ops", internalScope: "admin", fullName: "Pricing admin", expiresAtIso: new Date(Date.now() + 3600000).toISOString() })), ops);
  await page.goto("/ops#ops-administration");
  await page.locator("#ops-administration > summary").evaluate(element => { (element.parentElement as HTMLDetailsElement).open = true; });
  await page.locator("#ops-pricing > summary").click();
  const panel = page.locator("#ops-pricing");
  await panel.getByLabel("Service ZIP code").fill("08008");
  await panel.getByRole("combobox", { name: "Service", exact: true }).selectOption("lawn-mowing");
  await panel.getByLabel("New minimum starting price (USD)").fill("37.50");
  await panel.getByLabel("Reason for change").fill("Synthetic local pricing acceptance");
  await panel.getByRole("button", { name: "Save minimum" }).click();
  await expect(panel.getByRole("status")).toHaveText("Prices saved.");
  await expect(panel.getByText("ZIP minimum: $37.50")).toBeVisible();
  await panel.getByText("Price change history", { exact: true }).click();
  await expect(panel.getByRole("listitem").last()).toContainText("Synthetic local pricing acceptance");
  for (const [width, height, suffix] of [[1440, 900, "desktop"], [390, 844, "mobile"]] as const) {
    await page.setViewportSize({ width, height }); await panel.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${evidenceRoot}/zip-pricing-ops-${suffix}.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
});
