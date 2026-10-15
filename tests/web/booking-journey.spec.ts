import { expect, test, type Page } from "./fixtures";
import { apiBaseUrl, evidenceRoot, testPassword, uniqueEmail } from "./workflow-helpers";

async function manualSearch(page: Page) {
  await page.goto("/");
  await page.getByRole("combobox", { name: "Need" }).selectOption("leaf-blowing");
  await expect(page.getByRole("dialog", { name: "Find care near you" })).toBeVisible();
  await page.getByRole("button", { name: "Enter my area instead" }).click();
  await page.getByRole("combobox", { name: "Need" }).selectOption("lawn-mowing");
  await page.getByRole("button", { name: "Enter my area instead" }).click();
  await page.getByRole("textbox", { name: "Where", exact: true }).fill("Brooklyn, NY");
  await page.locator(".customer-search-shell__suggestion").filter({ hasText: "Brooklyn, NY" }).first().click();
  await page.getByRole("button", { name: "Find my match" }).click();
  await expect(page.getByRole("heading", { name: "Your top matches" })).toBeVisible();
  await expect(page.locator(".journey-provider-card").first()).toBeVisible();
}
async function capture(page: Page, stem: string) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: `${evidenceRoot}/${stem}-desktop.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${evidenceRoot}/${stem}-mobile.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.setViewportSize({ width: 1440, height: 900 });
}
async function answerPropertyQuestions(page: Page) {
  const dialog = page.getByRole("dialog", { name: "Schedule your service" });
  await expect(dialog.getByRole("group", { name: "A few details about your property" })).toBeVisible();
  const selects = dialog.getByRole("group", { name: "A few details about your property" }).getByRole("combobox");
  for (let i = 0; i < await selects.count(); i++) await selects.nth(i).selectOption({ index: 1 });
}

test("service selection asks for location, browser permission finds the area, and denial retains manual search", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 40.6782, longitude: -73.9442 });
  await page.goto("/");
  await page.getByRole("combobox", { name: "Need" }).selectOption("leaf-blowing");
  const prompt = page.getByRole("dialog", { name: "Find care near you" });
  await expect(prompt).toBeVisible();
  await prompt.getByRole("button", { name: "Use my location", exact: true }).click();
  await expect(page).toHaveURL(/customer\/listings/);
  await expect(page.locator(".journey-provider-card").first()).toBeVisible();
  expect(new URL(page.url()).searchParams.get("service")).toBe("leaf-blowing");
  expect(new URL(page.url()).searchParams.get("area")).toMatch(/Brooklyn/);
  expect(new URL(page.url()).searchParams.has("when")).toBe(false);
  await page.goto("/");
  await page.evaluate(() => { navigator.geolocation.getCurrentPosition = (_success, error) => error?.({ code: 1, message: "Permission denied", PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }); });
  await page.getByRole("combobox", { name: "Need" }).selectOption("leaf-blowing");
  await prompt.getByRole("button", { name: "Use my location", exact: true }).click();
  await expect(prompt.getByRole("status")).toContainText(/location|permission/i);
  await prompt.getByRole("button", { name: "Enter my area instead" }).click();
  await expect(page.getByRole("textbox", { name: "Where", exact: true })).toBeFocused();
});

test("guest books multiple services through review and signup, receives one persisted request, then reschedules", async ({ page, request }) => {
  test.setTimeout(120000);
  await manualSearch(page);
  const cards = page.locator(".journey-provider-card");
  expect(await cards.count()).toBeLessThanOrEqual(3);
  await expect(page.locator(".journey-provider-card--recommended")).toHaveCount(1);
  await expect(cards.first().getByText("Great reviews", { exact: true })).toBeVisible();
  if (await cards.count() > 1) { const a = await cards.nth(0).boundingBox(); const b = await cards.nth(1).boundingBox(); expect(b!.y).toBeGreaterThan(a!.y + a!.height); }
  await capture(page, "booking-journey-recommendations");
  await cards.first().locator(".journey-slot-pill").first().click();
  const dialog = page.getByRole("dialog", { name: "Schedule your service" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("combobox", { name: "Day", exact: true })).not.toHaveValue("");
  await dialog.getByRole("searchbox", { name: "Search this provider’s services" }).fill("Leaf");
  await dialog.getByRole("button", { name: "+ Leaf blowing", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Remove Leaf blowing" })).toBeVisible();
  await expect(dialog.getByRole("combobox", { name: "Day", exact: true })).toBeEnabled();
  const days = await dialog.getByRole("combobox", { name: "Day", exact: true }).locator("option").count();
  await dialog.getByRole("combobox", { name: "Day", exact: true }).selectOption({ index: days - 1 });
  await dialog.getByLabel("Street address", { exact: true }).fill("170 5th Ave");
  await dialog.getByLabel("Unit (optional)").fill("Unit B");
  await dialog.getByRole("button", { name: "Book", exact: true }).click();
  await answerPropertyQuestions(page);
  await capture(page, "booking-journey-modal");
  await dialog.getByRole("button", { name: "Book", exact: true }).click();
  await expect(page).toHaveURL(/customer\/booking\/review\?draft=/);
  await expect(page.getByRole("heading", { name: "Review and confirm" })).toBeVisible();
  await expect(page.getByText("170 5th Ave, Unit B")).toBeVisible();
  await expect(page.locator(".journey-price-lines li")).toHaveCount(2);
  await capture(page, "booking-journey-review-guest");
  await page.reload();
  await expect(page.locator(".journey-price-lines li")).toHaveCount(2);
  await page.getByRole("link", { name: "Create an account", exact: true }).click();
  const email = uniqueEmail("journey");
  await page.getByLabel("Full name", { exact: true }).fill("Maya Journey");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Phone", { exact: true }).fill("555-0188");
  await page.getByLabel("Password", { exact: true }).fill(testPassword);
  await page.getByLabel("Confirm password", { exact: true }).fill(testPassword);
  await expect(page.getByLabel("Service address", { exact: true })).toHaveValue("170 5th Ave");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page).toHaveURL(/customer\/booking\/review\?draft=/);
  const confirm = page.getByRole("button", { name: "Confirm booking request", exact: true });
  await expect(confirm).toBeEnabled();
  await capture(page, "booking-journey-review");
  let creates = 0; page.on("request", req => { if (req.method() === "POST" && new URL(req.url()).pathname === "/api/bookings") creates++; });
  // Commit on the real API, then lose the response: the client must recover the
  // same request instead of abandoning the customer or creating another booking.
  await page.route("**/api/bookings", async route => {
    if (route.request().method() !== "POST") return route.continue();
    const response = await route.fetch();
    expect(response.ok()).toBeTruthy();
    await route.abort("connectionreset");
  });
  await confirm.evaluate((element: HTMLButtonElement) => { element.click(); element.click(); });
  await expect(page).toHaveURL(/customer\/booking\/confirmation\?bookingId=/);
  await expect(page.getByRole("heading", { name: "Your booking request is in" })).toBeVisible();
  await expect(page.getByText(/You’ll receive an email/)).toBeVisible();
  expect(creates).toBe(1);
  const bookingId = new URL(page.url()).searchParams.get("bookingId")!;
  const token = await page.evaluate(() => JSON.parse(localStorage.getItem("yardmatch-web-session")!).token as string);
  const bookingResponse = await request.get(`${apiBaseUrl}/api/bookings/detail?bookingId=${encodeURIComponent(bookingId)}`, { headers: { Authorization: `Bearer ${token}` } });
  expect(bookingResponse.ok()).toBeTruthy(); const booking = await bookingResponse.json();
  expect(booking.services.map((item: {category: string}) => item.category)).toEqual(["lawn-mowing", "leaf-blowing"]);
  expect(booking.status).toBe("requested");
  await capture(page, "booking-journey-confirmation");
  await page.reload();
  await page.getByRole("button", { name: "Reschedule", exact: true }).click();
  const reschedule = page.getByRole("dialog", { name: "Choose a new opening" });
  await reschedule.locator(".journey-slot-pill").first().click();
  await reschedule.getByRole("button", { name: "Confirm new time" }).click();
  await expect(page.getByRole("status")).toHaveText("Your visit has been rescheduled.");
  const updated = await (await request.get(`${apiBaseUrl}/api/bookings/detail?bookingId=${encodeURIComponent(bookingId)}`, { headers: { Authorization: `Bearer ${token}` } })).json();
  expect(updated.scheduledStartIso).not.toBe(booking.scheduledStartIso);
});

test("directory shows list and map, filters real openings and opens an editable scheduling modal", async ({ page }) => {
  // Tile rendering is deterministic offline; live imagery delivery is a staging check.
  await page.route("https://tile.openstreetmap.org/**", route => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#eef0e9"/><path d="M0 128h256M128 0v256" stroke="#d9ded2"/></svg>' }));
  test.setTimeout(60000);
  await manualSearch(page);
  await page.getByRole("button", { name: "View more providers" }).click();
  await expect(page).toHaveURL(/view=directory/);
  await expect(page.getByRole("heading", { name: "Providers near you" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Provider map" })).toBeVisible();
  await expect(page.locator(".journey-map .leaflet-tile-loaded").first()).toBeVisible({ timeout: 20000 });
  await capture(page, "booking-journey-directory");
  const providerList = await page.locator(".booking-discovery__providers").boundingBox();
  const map = await page.locator(".booking-discovery__map").boundingBox();
  expect(map!.x).toBeGreaterThan(providerList!.x + providerList!.width);
  const requestPromise = page.waitForRequest(req => new URL(req.url()).pathname === "/api/providers/search" && Boolean(req.postDataJSON().availability));
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  await page.getByLabel("Day", { exact: true }).fill(tomorrow);
  const searchRequest = await requestPromise;
  expect(searchRequest.postDataJSON().availability.startIso).toBeTruthy();
  await page.getByRole("combobox", { name: "Time of day", exact: true }).selectOption("afternoon");
  await page.getByRole("button", { name: "Clear dates" }).click();
  await expect(page.locator(".journey-provider-card").first()).toBeVisible();
  await page.locator(".journey-provider-card").first().locator(".journey-slot-pill").first().click();
  const dialog = page.getByRole("dialog", { name: "Schedule your service" });
  await expect(dialog.getByRole("combobox", { name: "Day", exact: true })).not.toHaveValue("");
  await dialog.getByRole("button", { name: "Remove Lawn mowing" }).click();
  await expect(dialog.getByRole("button", { name: "Book", exact: true })).toBeDisabled();
  await dialog.getByRole("searchbox").fill("Leaf");
  await dialog.getByRole("button", { name: "+ Leaf blowing", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Remove Leaf blowing" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await page.getByRole("button", { name: "Back to recommendations" }).click();
  await expect(page).not.toHaveURL(/view=directory/);
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Providers near you" })).toBeVisible();
});
