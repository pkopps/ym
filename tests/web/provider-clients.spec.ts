import { expect, test } from "@playwright/test";
import type { ProviderClientsOverview } from "@yardmatch/contracts";
import { apiBaseUrl, approveProvider, authenticatedGet, evidenceRoot, createBooking, loginUi, registerCustomer, registerProvider } from "./workflow-helpers";

function visitTime(days: number, hour: number) {
  const date = new Date(Date.now() + days * 86_400_000);
  date.setUTCHours(hour, 0, 0, 0);
  return date.toISOString();
}

function fixture(): ProviderClientsOverview {
  const rows = [
    ["Morgan Ellis", "12 Oak Lane", 39.757, -74.246, true],
    ["Jamie Rivera", "8 Pine Street", 39.766, -74.222, true],
    ["Alex Chen", "3 Cedar Court", 39.748, -74.237, false],
    ["Sam Taylor", "27 Maple Avenue", 39.777, -74.210, true],
    ["Casey Brooks", "18 Bay Avenue", 39.752, -74.221, false]
  ] as const;
  return { companyName: "Barnegat Lawn & Garden", properties: rows.map(([customerName, line1, latitude, longitude, recurring], index) => ({
    id: `property-${index}`, customerName, address: { line1, city: "Barnegat", state: "NJ", postalCode: "08005", country: "US", point: { latitude, longitude } }, recurring,
    completedVisitCount: index + 1, lastCompletedAt: new Date(Date.now() - 10 * 86_400_000).toISOString(),
    upcomingVisits: index === 4 ? [] : [{ bookingId: `booking-${index}`, category: "lawn-mowing", status: "confirmed", scheduledStartIso: visitTime(index + 1, 14), scheduledEndIso: visitTime(index + 1, 15) }]
  })) };
}

test("real provider client endpoint isolates businesses and serves their booked customers", async ({ page, request }) => {
  const provider = await registerProvider(request);
  const other = await registerProvider(request);
  await approveProvider(request, provider.providerId, provider.token);
  const customer = await registerCustomer(request, "Taylor Client Map");
  await createBooking(request, { customerToken: customer.token, providerId: provider.providerId });
  const own = await authenticatedGet<ProviderClientsOverview>(request, provider.token, "/api/providers/clients");
  expect(own.properties).toHaveLength(1);
  expect(own.properties[0].customerName).toBe("Taylor Client Map");
  const foreign = await authenticatedGet<ProviderClientsOverview>(request, other.token, `/api/providers/clients?providerId=${provider.providerId}`);
  expect(foreign.properties).toEqual([]);
  const denied = await request.get(`${apiBaseUrl}/api/providers/clients`, { headers: { Authorization: `Bearer ${customer.token}` } });
  expect(denied.status()).toBe(403);
  await loginUi(page, "provider", provider.email);
  await page.getByRole("navigation").getByRole("link", { name: "Clients", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your clients, on the map" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "1 property", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Taylor Client Map/ }).click();
  await expect(page.getByRole("heading", { name: "Taylor Client Map" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Get directions/ })).toHaveAttribute("href", /22%20Bay%20Ave/);
});

test("client map synchronizes search, service filters, dates, list selection, and pins at desktop and mobile sizes", async ({ page, request }) => {
  const provider = await registerProvider(request);
  await loginUi(page, "provider", provider.email);
  await page.route("**/api/providers/clients", (route) => route.fulfill({ json: fixture() }));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/provider/clients");
  await expect(page.locator(".client-map-pin")).toHaveCount(5);
  await page.getByRole("button", { name: "Recurring", exact: true }).click();
  await expect(page.locator(".provider-client-row")).toHaveCount(3);
  await expect(page.locator(".client-map-pin")).toHaveCount(3);
  await page.getByRole("button", { name: "One-time", exact: true }).click();
  await expect(page.locator(".client-map-pin")).toHaveCount(2);
  await page.getByLabel("Visit dates").selectOption("7");
  await expect(page.locator(".client-map-pin")).toHaveCount(1);
  await page.getByRole("button", { name: "All", exact: true }).click();
  await page.getByLabel("Visit dates").selectOption("all");
  await page.getByRole("searchbox").fill("oak");
  await expect(page.locator(".client-map-pin")).toHaveCount(1);
  await page.getByRole("searchbox").fill("no-match");
  await expect(page.getByText("No properties match these filters.")).toBeVisible();
  await expect(page.locator(".client-map-pin")).toHaveCount(0);
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.locator(".client-map-pin")).toHaveCount(5);
  await page.locator('.client-map-pin[title^="Morgan Ellis"]').click();
  await expect(page.getByRole("heading", { name: "Morgan Ellis" })).toBeVisible();
  await expect(page.locator('.provider-client-row[aria-pressed="true"]')).toContainText("Morgan Ellis");
  await expect(page.locator(".leaflet-tile-loaded").first()).toBeVisible();
  for (const viewport of [{ width: 1440, height: 900, name: "desktop" }, { width: 390, height: 844, name: "mobile" }]) {
    await page.setViewportSize(viewport);
    await page.evaluate(() => { document.documentElement.style.scrollBehavior = "auto"; window.scrollTo(0, 0); });
    if (viewport.name === "mobile") await page.locator(".client-map-shell").evaluate((element) => element.scrollIntoView({ block: "center" }));
    await expect.poll(() => page.locator(".leaflet-tile").evaluateAll((tiles) => tiles.length > 0 && tiles.every((tile) => {
      const image = tile as HTMLImageElement;
      return image.complete && image.naturalWidth > 0 && Number(getComputedStyle(image).opacity) === 1;
    }))).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await page.screenshot({ path: `${evidenceRoot}/provider-clients-${viewport.name}.png` });
  }
  await page.locator(".provider-client-row").filter({ hasText: "Jamie Rivera" }).click();
  await expect(page.getByRole("heading", { name: "Jamie Rivera" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await page.goto("/es/provider/clients");
  await expect(page.getByRole("heading", { name: "Tus clientes, en el mapa" })).toBeVisible();
  await page.getByRole("button", { name: "Recurrente", exact: true }).click();
  await expect(page.locator(".client-map-pin")).toHaveCount(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

test("client map handles errors, empty clients, unavailable locations, shared pins, and session removal", async ({ page, request }) => {
  const provider = await registerProvider(request);
  await loginUi(page, "provider", provider.email);
  let state: "error" | "empty" | "locations" = "error";
  await page.route("**/api/providers/clients", (route) => {
    if (state === "error") return route.fulfill({ status: 503, json: { message: "Temporarily unavailable" } });
    const data = fixture();
    if (state === "empty") data.properties = [];
    else {
      data.properties[0].address.point = { latitude: 0, longitude: 0 };
      data.properties[2].address.point = data.properties[1].address.point;
    }
    return route.fulfill({ json: data });
  });
  await page.route("https://tile.openstreetmap.org/**", (route) => route.abort());
  await page.goto("/provider/clients");
  await expect(page.locator("main").getByRole("alert")).toContainText("Your clients could not be loaded");
  state = "empty";
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("heading", { name: "Your client map starts with your first booking" })).toBeVisible();
  state = "locations";
  await page.getByRole("button", { name: "Refresh clients" }).click();
  await expect(page.getByText("1 property has no map location yet. Its address is in the list.")).toBeVisible();
  await expect(page.locator(".client-map-pin")).toHaveCount(3);
  await expect(page.getByText("Map background unavailable. Pins and client details are still available.")).toBeVisible();
  await page.locator('.client-map-pin[title^="Jamie Rivera"]').click();
  await page.locator(".client-map-shared").getByRole("button", { name: /Alex Chen/ }).click();
  await expect(page.getByRole("heading", { name: "Alex Chen" })).toBeVisible();
  await page.evaluate(() => { localStorage.removeItem("yardmatch-web-session"); window.dispatchEvent(new Event("yardmatch-web-session-change")); });
  await expect(page.getByRole("heading", { name: "Your client map is private" })).toBeVisible();
  await expect(page.locator(".provider-client-row")).toHaveCount(0);
  await expect(page.locator(".client-map-pin")).toHaveCount(0);
});

test("anonymous client map does not fetch client data", async ({ page }) => {
  let requested = false;
  page.on("request", (request) => { if (request.url().includes("/api/providers/clients")) requested = true; });
  await page.goto("/provider/clients");
  await expect(page.getByRole("heading", { name: "Your client map is private" })).toBeVisible();
  expect(requested).toBe(false);
});

test("5,000 client properties keep map markers and list rows bounded while every property remains reachable", async ({ page, request }) => {
  const provider = await registerProvider(request);
  await loginUi(page, "provider", provider.email);
  const template = fixture().properties[0];
  const properties = Array.from({ length: 5000 }, (_, index) => ({ ...template, id: `scale-property-${index}`,
    customerName: `Scale Client ${String(index).padStart(4, "0")}`, address: { ...template.address,
      line1: `${index + 1} Scale Street`, point: { latitude: 39.74 + (index % 100) * 0.001, longitude: -74.26 + Math.floor(index / 100) * 0.001 } } }));
  await page.route("**/api/providers/clients", route => route.fulfill({ json: { companyName: "Scale Fixture", properties } }));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/provider/clients");
  await expect(page.locator(".provider-client-row")).toHaveCount(50);
  await expect.poll(() => page.locator(".client-map-pin").count()).toBeGreaterThan(0);
  expect(await page.locator(".client-map-pin").count()).toBeLessThan(250);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.locator(".provider-client-row").first()).toContainText("Scale Client 0050");
  await page.getByRole("searchbox").fill("Scale Client 4999");
  await expect(page.locator(".provider-client-row")).toHaveCount(1);
  await page.locator(".provider-client-row").click();
  await expect(page.getByRole("heading", { name: "Scale Client 4999" })).toBeVisible();
  await page.getByRole("searchbox").fill("");
  await expect(page.locator(".provider-client-row")).toHaveCount(50);
  for (const viewport of [{ width: 1440, height: 900, name: "desktop" }, { width: 390, height: 844, name: "mobile" }]) {
    await page.setViewportSize(viewport);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await page.screenshot({ path: `reports/agent-checkpoints/engineer/latest/scale-clients-${viewport.name}.png`, fullPage: false });
  }
});
