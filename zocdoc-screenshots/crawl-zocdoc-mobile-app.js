const fs = require("fs/promises");
const path = require("path");
const { chromium, devices } = require("playwright");

const OUTPUT_DIR = path.join(__dirname, "screenshots", "zocdoc");
const MANIFEST_PATH = path.join(OUTPUT_DIR, "manifest.json");
const RUN_STARTED_AT = new Date().toISOString();
const RUN_ID = RUN_STARTED_AT.replace(/[:.]/g, "-");
let screenshotIndex = 0;

const APPLE_LOOKUP_URL = "https://itunes.apple.com/search?term=zocdoc&entity=software&country=us&limit=5";
const GOOGLE_PLAY_URL = "https://play.google.com/store/apps/details?id=com.zocdoc.android&hl=en_US&gl=US";

const VIEWPORTS = [
  {
    type: "desktop",
    viewport: { width: 1440, height: 1600 },
    contextOptions: {
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    },
  },
  {
    type: "mobile",
    viewport: { width: 390, height: 844 },
    contextOptions: {
      ...devices["iPhone 13"],
      viewport: { width: 390, height: 844 },
    },
  },
];

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  screenshotIndex = await currentMaxScreenshotNumber();
  const manifest = await readManifest();
  const captured = [];
  const errors = [];
  const googlePlayAssetsOnly = process.argv.includes("--google-play-assets-only");

  const appStoreData = googlePlayAssetsOnly ? null : await getAppStoreData();
  const browser = await chromium.launch({
    headless: process.env.HEADFUL !== "1",
    slowMo: Number(process.env.SLOW_MO_MS || 100),
  });

  try {
    if (!googlePlayAssetsOnly) {
      for (const viewportConfig of VIEWPORTS) {
        const context = await browser.newContext({
          ...viewportConfig.contextOptions,
          viewport: viewportConfig.viewport,
          locale: "en-US",
          timezoneId: "America/New_York",
        });
        const page = await context.newPage();
        page.setDefaultTimeout(12_000);
        page.setDefaultNavigationTimeout(45_000);

        await captureListingPage({
          page,
          url: appStoreData.trackViewUrl,
          viewportType: viewportConfig.type,
          slug: "mobile-app-ios-app-store-listing",
          notes: "Public Apple App Store web listing for the Zocdoc iOS app.",
          captured,
          errors,
        });

        await captureListingPage({
          page,
          url: GOOGLE_PLAY_URL,
          viewportType: viewportConfig.type,
          slug: "mobile-app-google-play-listing",
          notes: "Public Google Play web listing for the Zocdoc Android app.",
          captured,
          errors,
        });

        await context.close();
      }

      await captureAppStoreScreenshotAssets({
        browser,
        appStoreData,
        captured,
        errors,
      });
    }

    await captureGooglePlayScreenshotAssets({
      browser,
      captured,
      errors,
    });
  } finally {
    await browser.close();
  }

  manifest.screenshots = mergeScreenshots(manifest.screenshots, captured);
  manifest.errors = [...(manifest.errors || []), ...errors];
  await fs.writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(JSON.stringify({ captured: captured.length, errors: errors.length, outputDir: OUTPUT_DIR }, null, 2));
}

async function getAppStoreData() {
  const response = await fetch(APPLE_LOOKUP_URL);
  if (!response.ok) {
    throw new Error(`Apple lookup failed: HTTP ${response.status}`);
  }

  const data = await response.json();
  const app = data.results.find((result) => result.trackId === 391062219 || /zocdoc/i.test(result.trackName));
  if (!app) {
    throw new Error("Could not find Zocdoc in Apple lookup results.");
  }

  return {
    trackName: app.trackName,
    trackId: app.trackId,
    trackViewUrl: app.trackViewUrl,
    version: app.version,
    currentVersionReleaseDate: app.currentVersionReleaseDate,
    screenshotUrls: app.screenshotUrls || [],
    ipadScreenshotUrls: app.ipadScreenshotUrls || [],
  };
}

async function captureListingPage({ page, url, viewportType, slug, notes, captured, errors }) {
  try {
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    await dismissBanners(page);
    await slowScroll(page);
    await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
    await page.waitForTimeout(700);

    const status = response ? response.status() : null;
    if (status && status >= 400) {
      errors.push(errorEntry("navigation", slug, `HTTP ${status} for ${url}`));
    }

    await savePageScreenshot({
      page,
      viewportType,
      slug,
      notes,
      captured,
    });
  } catch (error) {
    errors.push(errorEntry("capture", slug, error));
  }
}

async function captureAppStoreScreenshotAssets({ browser, appStoreData, captured, errors }) {
  const context = await browser.newContext({
    viewport: { width: 430, height: 932 },
    locale: "en-US",
    timezoneId: "America/New_York",
  });
  const page = await context.newPage();

  try {
    const iPhoneUrls = appStoreData.screenshotUrls.slice(0, 10);
    const iPadUrls = appStoreData.ipadScreenshotUrls.slice(0, 10);

    for (const [index, url] of iPhoneUrls.entries()) {
      await captureImageUrl({
        page,
        url,
        viewportType: "ios-app-store-asset",
        slug: `mobile-app-ios-iphone-screenshot-${index + 1}`,
        notes: `Public iPhone App Store screenshot asset ${index + 1} for ${appStoreData.trackName}.`,
        captured,
        errors,
      });
    }

    for (const [index, url] of iPadUrls.entries()) {
      await captureImageUrl({
        page,
        url,
        viewportType: "ios-app-store-asset",
        slug: `mobile-app-ios-ipad-screenshot-${index + 1}`,
        notes: `Public iPad App Store screenshot asset ${index + 1} for ${appStoreData.trackName}.`,
        captured,
        errors,
      });
    }
  } finally {
    await context.close();
  }
}

async function captureGooglePlayScreenshotAssets({ browser, captured, errors }) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1600 },
    locale: "en-US",
    timezoneId: "America/New_York",
  });
  const page = await context.newPage();
  page.setDefaultTimeout(12_000);
  page.setDefaultNavigationTimeout(45_000);

  try {
    await page.goto(GOOGLE_PLAY_URL, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    await dismissBanners(page);
    await page.waitForTimeout(1_000);

    const mediaUrls = await collectGooglePlayMediaUrls(page);
    if (mediaUrls.length === 0) {
      errors.push(errorEntry("asset", "mobile-app-google-play-assets", "No public Google Play media URLs found."));
      return;
    }

    for (const [index, url] of mediaUrls.entries()) {
      await captureImageUrl({
        page,
        url,
        viewportType: "google-play-asset",
        slug: `mobile-app-google-play-screenshot-${index + 1}`,
        notes: `Public high-resolution Google Play screenshot/media asset ${index + 1} for the Zocdoc Android app listing.`,
        captured,
        errors,
      });
    }
  } catch (error) {
    errors.push(errorEntry("asset", "mobile-app-google-play-assets", error));
  } finally {
    await context.close();
  }
}

async function collectGooglePlayMediaUrls(page) {
  return page
    .evaluate(() => {
      const urls = [];
      const seen = new Set();

      for (const img of document.querySelectorAll("img")) {
        const src = img.currentSrc || img.src || img.getAttribute("src");
        if (!src || !src.includes("play-lh.googleusercontent.com") || seen.has(src)) continue;

        const rect = img.getBoundingClientRect();
        const naturalWidth = img.naturalWidth || 0;
        const naturalHeight = img.naturalHeight || 0;
        const visualWidth = Math.max(rect.width, naturalWidth);
        const visualHeight = Math.max(rect.height, naturalHeight);
        const shortestSide = Math.min(visualWidth, visualHeight);
        const longestSide = Math.max(visualWidth, visualHeight);
        const isSquareIcon = shortestSide > 0 && Math.abs(visualWidth - visualHeight) / shortestSide < 0.15;
        const isLikelyScreenshot = !isSquareIcon && visualWidth >= 140 && visualHeight >= 180 && longestSide / shortestSide >= 1.2;

        if (!isLikelyScreenshot) continue;
        const highResolutionUrl = src.replace(/=w\d+-h\d+(?:-[a-z0-9]+)*$/i, "=w664-h1184-rw");
        if (seen.has(highResolutionUrl)) continue;
        seen.add(highResolutionUrl);
        urls.push(highResolutionUrl);
      }

      return urls.slice(0, 12);
    })
    .catch(() => []);
}

async function captureImageUrl({ page, url, viewportType, slug, notes, captured, errors }) {
  try {
    const response = await page.goto(url, { waitUntil: "load", timeout: 45_000 });
    await page.waitForTimeout(500);
    const status = response ? response.status() : null;
    if (status && status >= 400) {
      errors.push(errorEntry("asset", slug, `HTTP ${status} for ${url}`));
      return;
    }

    await savePageScreenshot({
      page,
      viewportType,
      slug,
      notes,
      captured,
      clipToImage: true,
    });
  } catch (error) {
    errors.push(errorEntry("asset", slug, error));
  }
}

async function savePageScreenshot({ page, viewportType, slug, notes, captured, clipToImage = false }) {
  screenshotIndex += 1;
  const next = screenshotIndex;
  const filename = `${String(next).padStart(3, "0")}-${viewportType}-${cleanSlug(slug)}-${RUN_ID}.png`;
  const filePath = path.join(OUTPUT_DIR, filename);

  const screenshotOptions = { path: filePath, fullPage: !clipToImage, animations: "disabled", timeout: 45_000 };
  if (clipToImage) {
    const clip = await imageClip(page);
    if (clip) {
      screenshotOptions.clip = clip;
      screenshotOptions.fullPage = false;
    }
  }

  await page.screenshot(screenshotOptions);
  captured.push({
    filename,
    pageUrl: page.url(),
    viewport: viewportType,
    timestamp: new Date().toISOString(),
    notes,
  });
  console.log(`Captured ${filename}`);
}

async function imageClip(page) {
  return page
    .evaluate(() => {
      const img = document.querySelector("img");
      if (!img) return null;
      const rect = img.getBoundingClientRect();
      return {
        x: Math.max(0, Math.floor(rect.x)),
        y: Math.max(0, Math.floor(rect.y)),
        width: Math.max(1, Math.ceil(rect.width)),
        height: Math.max(1, Math.ceil(rect.height)),
      };
    })
    .catch(() => null);
}

async function slowScroll(page) {
  const viewportHeight = page.viewportSize()?.height || 900;
  const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight).catch(() => viewportHeight);
  const steps = Math.min(10, Math.ceil(scrollHeight / Math.max(500, viewportHeight * 0.75)));

  for (let index = 0; index < steps; index += 1) {
    await page.evaluate((amount) => window.scrollBy(0, amount), Math.floor(viewportHeight * 0.75)).catch(() => {});
    await page.waitForTimeout(450);
  }
}

async function dismissBanners(page) {
  const candidates = [
    page.getByRole("button", { name: /accept/i }),
    page.getByRole("button", { name: /agree/i }),
    page.getByRole("button", { name: /ok/i }),
    page.locator('button[aria-label*="close" i]'),
  ];

  for (const locator of candidates) {
    const count = await locator.count().catch(() => 0);
    for (let index = 0; index < Math.min(count, 3); index += 1) {
      const candidate = locator.nth(index);
      if (!(await candidate.isVisible({ timeout: 700 }).catch(() => false))) continue;
      await candidate.click({ timeout: 2_000 }).catch(() => {});
      await page.waitForTimeout(500);
      return;
    }
  }
}

async function readManifest() {
  try {
    return JSON.parse(await fs.readFile(MANIFEST_PATH, "utf8"));
  } catch {
    return {
      runStartedAt: RUN_STARTED_AT,
      purpose:
        "UX pattern research from public Zocdoc pages only. Do not reuse branding, logos, exact copy, or protected visual identity.",
      search: { query: "dentist", location: "New York, NY" },
      screenshots: [],
      errors: [],
    };
  }
}

async function currentMaxScreenshotNumber() {
  const files = await fs.readdir(OUTPUT_DIR).catch(() => []);
  const numbers = files.map((file) => Number((file.match(/^(\d+)-/) || [])[1] || 0));
  return Math.max(0, ...numbers);
}

function mergeScreenshots(existing = [], additions = []) {
  const merged = new Map(existing.map((entry) => [entry.filename, entry]));
  for (const entry of additions) merged.set(entry.filename, entry);
  return [...merged.values()].sort((a, b) => a.filename.localeCompare(b.filename));
}

function errorEntry(scope, label, error) {
  return {
    scope,
    label,
    message: error instanceof Error ? error.message : String(error),
    timestamp: new Date().toISOString(),
  };
}

function cleanSlug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
