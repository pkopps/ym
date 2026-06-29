const fs = require("fs/promises");
const path = require("path");
const { chromium, devices } = require("playwright");

const BASE_URL = "https://www.zocdoc.com";
const SEARCH_QUERY = "dentist";
const SEARCH_LOCATION = "New York, NY";

const OUTPUT_DIR = path.join(__dirname, "screenshots", "zocdoc");
const MANIFEST_PATH = path.join(OUTPUT_DIR, "manifest.json");
const RUN_STARTED_AT = new Date().toISOString();
const RUN_ID = RUN_STARTED_AT.replace(/[:.]/g, "-");

const NAVIGATION_TIMEOUT_MS = Number(process.env.NAVIGATION_TIMEOUT_MS || 45_000);
const ACTION_DELAY_MS = Number(process.env.ACTION_DELAY_MS || 700);
const POLITE_DELAY_MS = Number(process.env.POLITE_DELAY_MS || 1_500);
const HEADFUL = process.env.HEADFUL === "1";

const desktopUserAgent =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const VIEWPORTS = [
  {
    type: "desktop",
    viewport: { width: 1440, height: 1600 },
    contextOptions: {
      userAgent: desktopUserAgent,
      isMobile: false,
      hasTouch: false,
    },
  },
  {
    type: "mobile",
    viewport: { width: 390, height: 844 },
    contextOptions: {
      ...devices["iPhone 13"],
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    },
  },
];

const manifest = {
  runStartedAt: RUN_STARTED_AT,
  purpose:
    "UX pattern research from public Zocdoc pages only. Do not reuse branding, logos, exact copy, or protected visual identity.",
  search: {
    query: SEARCH_QUERY,
    location: SEARCH_LOCATION,
  },
  screenshots: [],
  errors: [],
};

let screenshotIndex = 0;

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({
    headless: !HEADFUL,
    slowMo: Number(process.env.SLOW_MO_MS || 125),
  });

  try {
    for (const viewportConfig of VIEWPORTS) {
      await crawlViewport(browser, viewportConfig);
    }
  } finally {
    await browser.close();
    await writeManifest();
  }

  console.log(`Done. Manifest written to ${MANIFEST_PATH}`);
}

async function crawlViewport(browser, viewportConfig) {
  console.log(`\nStarting ${viewportConfig.type} crawl...`);

  const context = await browser.newContext({
    ...viewportConfig.contextOptions,
    viewport: viewportConfig.viewport,
    locale: "en-US",
    timezoneId: "America/New_York",
    extraHTTPHeaders: {
      DNT: "1",
    },
  });

  const page = await context.newPage();
  page.setDefaultTimeout(12_000);
  page.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT_MS);

  try {
    const homepageLoaded = await safeGoto(page, BASE_URL, "homepage", viewportConfig.type);
    if (!homepageLoaded) return;

    await capturePage(page, viewportConfig.type, "homepage", "Public homepage before search.");

    const searchState = await tryPopulateHomepageSearch(page);
    await capturePage(
      page,
      viewportConfig.type,
      "homepage-search-input-state",
      `Homepage after attempting to enter ${SEARCH_QUERY} near ${SEARCH_LOCATION}. ${searchState}`
    );

    const reachedResults = await submitSearchOrFallback(page, viewportConfig.type);
    if (!reachedResults) {
      logError(viewportConfig.type, "search-results", "Could not reach a public search results page.");
      return;
    }

    await capturePage(
      page,
      viewportConfig.type,
      "search-results-provider-cards",
      "Search results page, including provider-card marketplace patterns if available."
    );

    const resultsUrl = page.url();

    await tryOpenFilters(page);
    await capturePage(
      page,
      viewportConfig.type,
      "filters-ui",
      "Search results with filters UI opened if the public page exposed it."
    );

    await safeGoto(page, resultsUrl, "return-to-results-after-filters", viewportConfig.type);

    const profileUrl = await findProviderProfileUrl(page);
    if (profileUrl) {
      await politePause();
      const profileLoaded = await safeGoto(page, profileUrl, "provider-profile", viewportConfig.type);
      if (profileLoaded) {
        await capturePage(
          page,
          viewportConfig.type,
          "provider-profile",
          "Public provider profile page discovered from search results."
        );

        await tryPublicBookingFlow(page, viewportConfig.type);
      }
    } else {
      logError(viewportConfig.type, "provider-profile", "No accessible provider profile link found.");
    }
  } finally {
    await context.close();
  }
}

async function safeGoto(page, url, label, viewportType = "unknown") {
  try {
    console.log(`Navigating to ${label}: ${url}`);
    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: NAVIGATION_TIMEOUT_MS,
    });
    await waitForSettledPage(page);
    await dismissBanners(page);

    const status = response ? response.status() : null;
    if (status && status >= 400) {
      logError("navigation", label, `HTTP ${status} for ${url}`);
      await captureDiagnosticPage(
        page,
        viewportType,
        `${label}-http-${status}`,
        `Diagnostic capture only: ${url} returned HTTP ${status}. No access-control bypass attempted.`
      );
      return false;
    }

    if (await pageHasAccessControl(page)) {
      logError("navigation", label, "Access-control or CAPTCHA page detected. No bypass attempted.");
      await captureDiagnosticPage(
        page,
        viewportType,
        `${label}-access-control`,
        `Diagnostic capture only: access-control or CAPTCHA page detected at ${url}. No bypass attempted.`
      );
      return false;
    }

    await politePause();
    return true;
  } catch (error) {
    logError("navigation", label, error);
    return false;
  }
}

async function waitForSettledPage(page) {
  await page.waitForLoadState("domcontentloaded", { timeout: NAVIGATION_TIMEOUT_MS }).catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(ACTION_DELAY_MS);
}

async function dismissBanners(page) {
  const bannerButtons = [
    (p) => p.getByRole("button", { name: /^(accept|accept all|agree|i agree|got it|ok)$/i }),
    (p) => p.getByRole("button", { name: /accept.*cookie|allow.*cookie|agree.*cookie/i }),
    (p) => p.getByRole("button", { name: /not now|maybe later|dismiss/i }),
    (p) => p.locator('button[aria-label*="close" i]'),
    (p) => p.locator('[role="dialog"] button[aria-label*="close" i]'),
  ];

  for (const makeLocator of bannerButtons) {
    const button = await firstVisible(makeLocator(page), 3);
    if (!button) continue;

    try {
      await button.click({ timeout: 3_000 });
      await page.waitForTimeout(500);
      return true;
    } catch (error) {
      logError("banner", "dismiss", error);
    }
  }

  return false;
}

async function tryPopulateHomepageSearch(page) {
  const notes = [];

  const specialtyInput = await firstVisibleFromCandidates(page, [
    (p) => p.getByRole("combobox", { name: /condition|procedure|doctor|provider|specialty|search/i }),
    (p) => p.getByRole("textbox", { name: /condition|procedure|doctor|provider|specialty|search/i }),
    (p) => p.getByPlaceholder(/condition|procedure|doctor|provider|specialty|search/i),
    (p) => p.locator('input[type="search"]'),
    (p) => p.locator('input[name*="query" i]'),
    (p) => p.locator('input[placeholder*="doctor" i]'),
    (p) => p.locator('input[placeholder*="dentist" i]'),
  ]);

  if (specialtyInput) {
    await fillField(page, specialtyInput, SEARCH_QUERY, "specialty/search input");
    notes.push("entered specialty");
  } else {
    notes.push("specialty input not found");
  }

  const locationInput = await firstVisibleFromCandidates(page, [
    (p) => p.getByRole("combobox", { name: /location|city|zip|address|near/i }),
    (p) => p.getByRole("textbox", { name: /location|city|zip|address|near/i }),
    (p) => p.getByPlaceholder(/location|city|zip|address|near/i),
    (p) => p.locator('input[name*="location" i]'),
    (p) => p.locator('input[name*="address" i]'),
    (p) => p.locator('input[placeholder*="city" i]'),
    (p) => p.locator('input[placeholder*="zip" i]'),
  ]);

  if (locationInput) {
    await fillField(page, locationInput, SEARCH_LOCATION, "location input");
    await selectAutocompleteSuggestion(page);
    notes.push("entered location");
  } else {
    notes.push("location input not found");
  }

  await waitForSettledPage(page);
  return notes.join("; ");
}

async function fillField(page, locator, value, label) {
  try {
    await locator.scrollIntoViewIfNeeded();
    await locator.click({ timeout: 5_000 });
    await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A").catch(() => {});
    await locator.fill(value, { timeout: 5_000 }).catch(async () => {
      await page.keyboard.type(value, { delay: 60 });
    });
    await page.waitForTimeout(900);
    console.log(`Filled ${label}: ${value}`);
    return true;
  } catch (error) {
    logError("input", label, error);
    return false;
  }
}

async function selectAutocompleteSuggestion(page) {
  try {
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(250);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(700);
  } catch (error) {
    logError("input", "autocomplete", error);
  }
}

async function submitSearchOrFallback(page, viewportType) {
  const beforeUrl = page.url();
  const searchButton = await firstVisibleFromCandidates(page, [
    (p) => p.getByRole("button", { name: /^search$/i }),
    (p) => p.getByRole("button", { name: /find.*doctor|find.*care|find.*provider|search/i }),
    (p) => p.locator('button[type="submit"]'),
    (p) => p.locator('input[type="submit"]'),
  ]);

  try {
    if (searchButton) {
      await searchButton.click({ timeout: 6_000 });
    } else {
      await page.keyboard.press("Enter");
    }

    await Promise.race([
      page.waitForURL((url) => url.href !== beforeUrl, { timeout: 18_000 }),
      page.waitForLoadState("networkidle", { timeout: 18_000 }),
    ]).catch(() => {});

    await waitForSettledPage(page);
    await dismissBanners(page);

    if (await isLikelyResultsPage(page)) {
      return true;
    }
  } catch (error) {
    logError("search", "submit", error);
  }

  const fallbackUrls = [
    `${BASE_URL}/search?address=${encodeURIComponent(SEARCH_LOCATION)}&search_query=${encodeURIComponent(
      SEARCH_QUERY
    )}`,
    `${BASE_URL}/dentists/new-york-46063pm`,
  ];

  for (const url of fallbackUrls) {
    const loaded = await safeGoto(page, url, "public-search-fallback", viewportType);
    if (!loaded) continue;
    if (await isLikelyResultsPage(page)) return true;
  }

  return false;
}

async function isLikelyResultsPage(page) {
  const url = page.url();
  if (/\/search|\/dentists\//i.test(url)) return true;

  const text = await visibleText(page);
  return /dentist|provider|appointment|available|filter/i.test(text);
}

async function tryOpenFilters(page) {
  const filterButton = await firstVisibleFromCandidates(page, [
    (p) => p.getByRole("button", { name: /all filters|filters|filter by/i }),
    (p) => p.getByRole("link", { name: /all filters|filters|filter by/i }),
    (p) => p.locator('button:has-text("All filters")'),
    (p) => p.locator('button:has-text("Filters")'),
    (p) => p.locator('[aria-label*="filter" i]'),
    (p) => p.locator('[data-testid*="filter" i]'),
  ]);

  if (!filterButton) {
    logError("filters", "open", "No filters control found.");
    return false;
  }

  try {
    await filterButton.scrollIntoViewIfNeeded();
    await filterButton.click({ timeout: 6_000 });
    await waitForSettledPage(page);
    return true;
  } catch (error) {
    logError("filters", "open", error);
    return false;
  }
}

async function findProviderProfileUrl(page) {
  await waitForSettledPage(page);

  try {
    return await page.evaluate(() => {
      const profilePatterns = [/\/(doctor|dentist|provider|professional)s?\//i, /\/[^/]+-\d{4,}/i];
      const excludedPatterns = [/\/search/i, /\/dentists\/new-york/i, /\/specialty\//i, /\/insurance\//i];

      const anchors = Array.from(document.querySelectorAll("a[href]"));
      for (const anchor of anchors) {
        const rawHref = anchor.getAttribute("href");
        if (!rawHref) continue;

        const absoluteHref = new URL(rawHref, window.location.href).href;
        if (!absoluteHref.includes("zocdoc.com")) continue;
        if (excludedPatterns.some((pattern) => pattern.test(absoluteHref))) continue;
        if (!profilePatterns.some((pattern) => pattern.test(absoluteHref))) continue;

        const text = `${anchor.textContent || ""} ${anchor.getAttribute("aria-label") || ""}`.trim();
        if (/terms|privacy|login|sign in|reviews$/i.test(text)) continue;

        return absoluteHref;
      }

      return null;
    });
  } catch (error) {
    logError("profile", "find-link", error);
    return null;
  }
}

async function tryPublicBookingFlow(page, viewportType) {
  if (await hasPrivateOrLoginForm(page)) {
    logError(viewportType, "booking-flow", "Profile already shows login or private-data form. Stopping.");
    return;
  }

  const clickedFirstStep = await clickBookingLikeControl(page);
  if (!clickedFirstStep) {
    logError(viewportType, "booking-flow", "No public booking or appointment time control found.");
    return;
  }

  await waitForSettledPage(page);
  await capturePage(
    page,
    viewportType,
    "booking-step-public",
    "First public booking or appointment-selection step reached without login."
  );

  if (await hasPrivateOrLoginForm(page)) {
    logError(viewportType, "booking-flow", "Login or private-data form detected after first step. Stopping.");
    return;
  }

  const clickedSecondStep = await clickBookingLikeControl(page, { includeContinue: true });
  if (!clickedSecondStep) return;

  await waitForSettledPage(page);
  await capturePage(
    page,
    viewportType,
    "booking-step-public-next",
    "Next public booking step reached. No personal data was entered."
  );
}

async function clickBookingLikeControl(page, options = {}) {
  const { includeContinue = false } = options;
  const candidates = [
    (p) => p.getByRole("button", { name: /\b(book online|book appointment|schedule|select time)\b/i }),
    (p) => p.getByRole("link", { name: /\b(book online|book appointment|schedule|select time)\b/i }),
    (p) => p.getByRole("button", { name: /\b([1-9]|1[0-2]):[0-5][0-9]\s*(am|pm)\b/i }),
    (p) => p.getByRole("link", { name: /\b([1-9]|1[0-2]):[0-5][0-9]\s*(am|pm)\b/i }),
    (p) => p.locator('button:has-text("Book online")'),
    (p) => p.locator('a:has-text("Book online")'),
    (p) => p.locator('[data-testid*="appointment" i] button'),
    (p) => p.locator('[data-testid*="timeslot" i] button'),
    (p) => p.locator('a[href*="/book"]'),
  ];

  if (includeContinue) {
    candidates.push(
      (p) => p.getByRole("button", { name: /continue|next|confirm time/i }),
      (p) => p.getByRole("link", { name: /continue|next|confirm time/i })
    );
  }

  const control = await firstVisibleFromCandidates(page, candidates);
  if (!control) return false;

  try {
    await control.scrollIntoViewIfNeeded();
    await control.click({ timeout: 8_000 });
    return true;
  } catch (error) {
    logError("booking", "click-control", error);
    return false;
  }
}

async function capturePage(page, viewportType, slug, notes) {
  try {
    await dismissBanners(page);
    await waitForSettledPage(page);
    await slowScroll(page);
    await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: "instant" })).catch(() => {});
    await page.waitForTimeout(600);

    screenshotIndex += 1;
    const filename = `${String(screenshotIndex).padStart(3, "0")}-${viewportType}-${slug}-${RUN_ID}.png`;
    const filePath = path.join(OUTPUT_DIR, filename);

    await page.screenshot({
      path: filePath,
      fullPage: true,
      animations: "disabled",
      timeout: 60_000,
    });

    const entry = {
      filename,
      pageUrl: page.url(),
      viewport: viewportType,
      timestamp: new Date().toISOString(),
      notes,
    };

    manifest.screenshots.push(entry);
    await writeManifest();

    console.log(`Captured ${filename}`);
    await politePause();
  } catch (error) {
    logError(viewportType, `capture:${slug}`, error);
  }
}

async function captureDiagnosticPage(page, viewportType, slug, notes) {
  try {
    await waitForSettledPage(page);

    screenshotIndex += 1;
    const filename = `${String(screenshotIndex).padStart(3, "0")}-${viewportType}-diagnostic-${cleanSlug(
      slug
    )}-${RUN_ID}.png`;
    const filePath = path.join(OUTPUT_DIR, filename);

    await page.screenshot({
      path: filePath,
      fullPage: true,
      animations: "disabled",
      timeout: 30_000,
    });

    manifest.screenshots.push({
      filename,
      pageUrl: page.url(),
      viewport: viewportType,
      timestamp: new Date().toISOString(),
      notes,
    });
    await writeManifest();

    console.log(`Captured diagnostic screenshot ${filename}`);
  } catch (error) {
    logError(viewportType, `diagnostic:${slug}`, error);
  }
}

async function slowScroll(page) {
  try {
    const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight || document.body.scrollHeight);
    const viewportHeight = page.viewportSize()?.height || 900;
    const maxSteps = Math.min(24, Math.ceil(scrollHeight / Math.max(400, viewportHeight * 0.7)));

    for (let step = 0; step < maxSteps; step += 1) {
      await page.mouse.wheel(0, Math.floor(viewportHeight * 0.75));
      await page.waitForTimeout(450);
    }
  } catch (error) {
    logError("scroll", "lazy-load", error);
  }
}

async function firstVisibleFromCandidates(page, candidates) {
  for (const makeLocator of candidates) {
    try {
      const found = await firstVisible(makeLocator(page), 8);
      if (found) return found;
    } catch (error) {
      logError("locator", "candidate", error);
    }
  }

  return null;
}

async function firstVisible(locator, maxCount = 6) {
  const count = await locator.count().catch(() => 0);
  const limit = Math.min(count, maxCount);

  for (let index = 0; index < limit; index += 1) {
    const candidate = locator.nth(index);
    if (await candidate.isVisible({ timeout: 900 }).catch(() => false)) {
      return candidate;
    }
  }

  return null;
}

async function hasPrivateOrLoginForm(page) {
  if (/\/(login|signin|sign-in|account)/i.test(page.url())) return true;

  const privateInputCount = await page
    .locator(
      [
        'input[type="email"]',
        'input[type="password"]',
        'input[name*="first" i]',
        'input[name*="last" i]',
        'input[name*="birth" i]',
        'input[autocomplete="email"]',
        'input[autocomplete="given-name"]',
        'input[autocomplete="family-name"]',
      ].join(",")
    )
    .count()
    .catch(() => 0);

  if (privateInputCount > 0) return true;

  const dialog = await firstVisible(page.locator('[role="dialog"], [aria-modal="true"]'), 4);
  if (!dialog) return false;

  const dialogText = await dialog.innerText({ timeout: 2_000 }).catch(() => "");
  return /log in|sign in|create account|password|date of birth/i.test(dialogText);
}

async function pageHasAccessControl(page) {
  const text = await visibleText(page);
  return /captcha|verify you are human|access denied|unusual traffic|are you a robot/i.test(text);
}

async function visibleText(page) {
  return page
    .locator("body")
    .innerText({ timeout: 3_000 })
    .catch(() => "");
}

function logError(scope, label, error) {
  const message = error instanceof Error ? error.message : String(error);
  const entry = {
    scope,
    label,
    message,
    timestamp: new Date().toISOString(),
  };

  manifest.errors.push(entry);
  console.warn(`[${scope}] ${label}: ${message}`);
}

function cleanSlug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function writeManifest() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
}

async function politePause() {
  await new Promise((resolve) => setTimeout(resolve, POLITE_DELAY_MS));
}

main().catch(async (error) => {
  logError("fatal", "main", error);
  await writeManifest();
  process.exitCode = 1;
});
