# Zocdoc UX Research Crawler

This is a local Playwright crawler for capturing screenshots of public Zocdoc marketplace UX patterns for YardMatch research.

The output is for UX research and original design inspiration only. Do not copy Zocdoc branding, logos, exact copy, design assets, or protected visual identity. The crawler does not log in, does not scrape private user data, and does not bypass paywalls, CAPTCHAs, robots, or access controls.

## Install

From this folder:

```bash
npm install
npx playwright install
```

If you are creating the project from scratch, these are the equivalent setup commands:

```bash
npm init -y
npm install playwright
npx playwright install
```

## Run

```bash
node crawl-zocdoc.js
```

Or:

```bash
npm run crawl
```

The crawler uses:

- Desktop viewport: `1440x1600`
- Mobile viewport: `390x844`
- Search query: `dentist`
- Location: `New York, NY`

It tries to capture the homepage, homepage search state, public search results, filters UI, provider cards, a provider profile, and public booking steps when accessible without login.

## Output

Screenshots and the manifest are saved here:

```text
screenshots/zocdoc/
```

The generated `manifest.json` includes each screenshot filename, page URL, viewport type, timestamp, notes, and any non-fatal errors encountered during the crawl.

If Zocdoc returns HTTP 403, CAPTCHA, or another access-control page, the crawler records the issue in `manifest.json` and stops that flow. It intentionally does not try to work around those controls.

Native iOS/Android app screens are not captured here. Playwright can capture web pages, but it does not install or operate the native Zocdoc app, and app-store marketing/listing assets should not be treated as real app UI evidence.

## Useful Options

Run with a visible browser for debugging:

```bash
HEADFUL=1 node crawl-zocdoc.js
```

Slow down actions or navigation if the site is loading gradually:

```bash
SLOW_MO_MS=250 POLITE_DELAY_MS=2500 node crawl-zocdoc.js
```

## Research Guardrails

- Capture public UX patterns only.
- Do not log in or enter personal information.
- Do not bypass access controls or CAPTCHA pages.
- Use screenshots as reference material for general marketplace patterns.
- Build original YardMatch designs instead of copying Zocdoc-specific visuals, text, or brand elements.
