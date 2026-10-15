import { expect, test } from "./fixtures";

const evidenceRoot = "reports/agent-checkpoints/engineer/latest/seo";

test("language URLs ignore conflicting cookies and browser preferences", async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: "ym-locale", value: "es", url: baseURL! }]);
  await page.setExtraHTTPHeaders({ "Accept-Language": "es-MX,es;q=0.9" });
  await page.goto("/services/lawn-mowing");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/services\/lawn-mowing$/);
  await expect(page.locator('link[rel="alternate"][hreflang="es"]')).toHaveAttribute("href", /\/es\/services\/lawn-mowing$/);
  await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute("href", /\/services\/lawn-mowing$/);
  await page.getByLabel("Language", { exact: true }).selectOption("es");
  await expect(page).toHaveURL(/\/es\/services\/lawn-mowing$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await page.getByLabel("Idioma", { exact: true }).selectOption("en");
  await expect(page).toHaveURL(/\/services\/lawn-mowing$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");

  await context.addCookies([{ name: "ym-locale", value: "en", url: baseURL! }]);
  await page.setExtraHTTPHeaders({ "Accept-Language": "en-US" });
  await page.goto("/es/barnegat-nj/lawn-mowing");
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/es\/barnegat-nj\/lawn-mowing$/);
});

test("sitemap has reciprocal language URLs without fabricated modification dates", async ({ request }) => {
  const response = await request.get("/sitemap.xml");
  expect(response.ok()).toBeTruthy();
  const xml = await response.text();
  expect(xml).not.toContain("<lastmod>");
  expect(xml).not.toContain("/pseudo");
  expect(xml).not.toContain("/customer/dashboard");
  expect(xml).not.toContain("yardmatch.example");
  const entries = xml.match(/<url>[\s\S]*?<\/url>/g) ?? [];
  expect(entries.length).toBeGreaterThan(0);
  for (const entry of entries) {
    expect(entry).toContain('hreflang="en"');
    expect(entry).toContain('hreflang="es"');
    expect(entry).toContain('hreflang="x-default"');
  }
  const pseudo = await request.get("/pseudo/services/lawn-mowing");
  expect(pseudo.headers()["x-robots-tag"]).toBe("noindex, nofollow");
});

for (const service of ["lawn-mowing", "yard-cleanup"]) {
  test(`${service} has distinct general and local content in both languages`, async ({ page }) => {
    test.setTimeout(90_000);
    for (const locale of ["", "/es"]) {
      await page.goto(`${locale}/services/${service}`);
      const generalTitle = await page.title();
      const generalDescription = await page.locator('meta[name="description"]').getAttribute("content");
      const generalBody = await page.locator("main").innerText();
      await page.goto(`${locale}/barnegat-nj/${service}`);
      expect(await page.title()).not.toBe(generalTitle);
      expect(await page.locator('meta[name="description"]').getAttribute("content")).not.toBe(generalDescription);
      expect(await page.locator("main").innerText()).not.toBe(generalBody);
      await expect(page.locator("main h1")).toContainText("Barnegat, NJ");
      await expect(page.locator("main")).not.toContainText("GreenStride Lawn Co.");
      await expect(page.locator("main")).not.toContainText("TerraCut Studio");
      const bookingLink = page.locator(`main a[href^="${locale}/customer?"]`).first();
      const href = await bookingLink.getAttribute("href");
      const params = new URL(href!, "http://localhost").searchParams;
      expect(params.get("service")).toBe(service);
      expect(params.get("area")).toBe("Barnegat, NJ");
    }
  });
}

test("landing attribution identifies organic visits and survives internal navigation", async ({ page }) => {
  await page.goto("/barnegat-nj/lawn-mowing", { referer: "https://www.google.com/search?q=private-query" });
  const attribution = () => page.evaluate(() => JSON.parse(localStorage.getItem("yardmatch-launch-attribution") ?? "null"));
  await expect.poll(attribution).toMatchObject({ source: "www.google.com", medium: "organic", landingPath: "/barnegat-nj/lawn-mowing" });
  expect(JSON.stringify(await attribution())).not.toContain("private-query");
  await page.locator('main a[href="/barnegat-nj"]').click();
  await expect(page).toHaveURL(/\/barnegat-nj$/);
  expect(await attribution()).toMatchObject({ source: "www.google.com", medium: "organic", landingPath: "/barnegat-nj/lawn-mowing" });
});

test("campaign tags, paid clicks, and lookalike domains do not become organic", async ({ browser, baseURL }) => {
  for (const scenario of [
    { query: "?utm_source=newsletter&utm_medium=email", referrer: "https://www.google.com/", source: "newsletter", medium: "email" },
    { query: "?gclid=private-click-id", referrer: "https://www.google.com/", source: "www.google.com", medium: "paid" },
    { query: "", referrer: "https://google.com.example.org/", source: "google.com.example.org", medium: "referral" },
    { query: "", referrer: "https://www.bing.com/", source: "www.bing.com", medium: "organic" }
  ]) {
    const context = await browser.newContext({ baseURL });
    try {
      const page = await context.newPage();
      await page.goto(`/services/lawn-mowing${scenario.query}`, { referer: scenario.referrer });
      await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("yardmatch-launch-attribution") ?? "null")))
        .toMatchObject({ source: scenario.source, medium: scenario.medium });
      expect(await page.evaluate(() => localStorage.getItem("yardmatch-launch-attribution"))).not.toContain("private-click-id");
    } finally {
      await context.close();
    }
  }
});

test("service pages fit desktop and mobile viewports", async ({ page }) => {
  test.setTimeout(90_000);
  for (const path of ["/services/lawn-mowing", "/services/yard-cleanup", "/barnegat-nj/lawn-mowing", "/barnegat-nj/yard-cleanup", "/es/barnegat-nj/lawn-mowing"]) {
    await page.goto(path);
    await page.evaluate(() => document.fonts.ready);
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await expect(page.locator("main h1")).toBeVisible();
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
      await page.screenshot({ path: `${evidenceRoot}/${path.slice(1).replaceAll("/", "-")}-${viewport.width}.png` });
    }
  }
});
