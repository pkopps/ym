# YardMatch SEO Plan

Last updated: September 14, 2026

## Scope and current status

Start with homeowner searches for lawn mowing and yard cleanup in Barnegat, New Jersey. Keep the customer journey recommendation-first: service, timing, property, then the best available provider with limited backups.

Patrick confirmed that there is no production website domain yet. Local implementation does not establish production indexability or search performance. Do not substitute an invented public domain, claim that Search Console is verified, or publish seeded customer proof.

Related docs: `ROADMAP.md`, `LOCAL_DEVELOPMENT.md`, `LAUNCH_CHECKLIST.md`, `MARKETING_PLAN.md`.

## Implemented foundations

- `NEXT_PUBLIC_SITE_URL` supplies canonical URLs, social metadata, robots sitemap location, and sitemap URLs. Local development falls back to `http://localhost:3000`.
- Public launch search defaults to Barnegat, NJ. Brooklyn/Jersey City remain useful local smoke-test fixtures.
- Public routes include `/barnegat-nj`, `/services/lawn-mowing`, `/services/yard-cleanup`, and their Barnegat service combinations.
- The sitemap lists public acquisition, trust, and provider recruitment pages rather than authenticated dashboards. Internal-route robots exclusions and page-level noindex rules already exist; recheck them against the deployed site before launch.
- English uses unprefixed URLs; Spanish uses `/es`. Request cookies and browser language preferences no longer change the language of a URL. The language picker navigates between explicit URLs.
- Public localized metadata and sitemap entries pair English and Spanish URLs and use the English URL as `x-default`. Pseudo-localized QA routes return `X-Robots-Tag: noindex, nofollow` and are excluded from the sitemap.
- Sitemap entries omit modification dates until accurate content-revision dates are available. Generating a sitemap is not a content update.
- General mowing/cleanup pages have distinct titles and descriptions, scope guidance, pricing factors, and service FAQs. Barnegat versions focus on property access, seasonal absences, local planning, coverage checks, and local booking questions.
- Local proof uses existing marketplace data filtered to the town. The page explains when verified local providers are not available. No fabricated job photos or testimonials were added.
- Landing attribution is captured on first page load and carried through the existing lead/booking analytics flow. Known Google, Bing, Yahoo, DuckDuckGo, Ecosia, and Brave search domains infer `organic`; explicit campaign medium tags take precedence. Recognized ad click IDs infer `paid` when no explicit medium exists. Referrer search queries and ad click IDs are not stored.
- `GOOGLE_SITE_VERIFICATION` optionally supplies the public Search Console verification meta tag. It stays empty until a real property and token exist.

## Domain and Search Console launch checklist

Owner: Patrick for domain/account access; engineer for deployment configuration and verification.

1. Choose and connect the real production domain; decide the canonical HTTPS hostname (www or apex) and redirect the other hostname permanently to it.
2. Set `NEXT_PUBLIC_SITE_URL` to that exact HTTPS origin in the production web build environment, then rebuild and deploy. Confirm the page HTML, sitemap, and robots file contain no localhost or example-domain references.
3. Keep staging and previews private or excluded from indexing using the hosting provider's deployment controls. Confirm those controls separately from production.
4. Add a Search Console Domain property and complete its DNS verification, or add a URL-prefix property and set the supplied `GOOGLE_SITE_VERIFICATION` token before rebuilding. A meta token is public verification material, not an OAuth credential. DNS verification does not require the token.
5. Submit the production `/sitemap.xml` in Search Console. Inspect the homepage, town page, and four service URLs, plus Spanish counterparts. Confirm HTTP 200, rendered content, canonical selection, language alternates, and indexability.
6. Record the inspection date and actual result for each URL. A successful submission or inspection does not guarantee indexing or ranking.
7. Review Search Console weekly once data is available. Save a 28-day baseline after the first complete reporting window.

Production domain: **not selected**. Search Console property: **not created/verified in this work**. Sitemap submission: **pending domain and deployment**. Search impressions/clicks/bookings baseline: **not available yet**.

## First content improvements

### Strengthen Barnegat before adding towns

- Obtain approved, real completed-job photos with publication consent, service type, and accurate location. Use the existing consented marketing-photo flow; private service evidence must not be reused without consent.
- Publish genuine reviews through the existing public review workflow. Document approval before adapting a testimonial into editorial content. Never relabel seeded or out-of-town reviews as Barnegat work.
- Keep availability language conditional on live provider supply. Confirm scope, haul-away, access, and pricing before booking rather than promising universal coverage or same-week slots.
- Improve content from actual homeowner questions and Search Console query evidence. Avoid pages that merely swap town names.

### Later service expansion

Consider hedge trimming, mulch installation, and gutter cleaning only when verified supply supports them. Nearby towns such as Manahawkin, Waretown, and Forked River need real coverage and distinct useful content before a landing page is justified.

### Structured data and local presence

The homepage currently has `WebSite` markup. Add `Organization` and visible breadcrumbs when verified business details and the content structure support them. Select any LocalBusiness subtype only after confirming the actual business model and public details. Do not imply that generic Service or FAQ markup guarantees a Google rich result.

Check Google Business Profile eligibility for YardMatch's actual managed-marketplace operations before creating a profile. Complete any eligible profile with accurate contact information, service area, hours, and photos. Request honest reviews consistently without filtering requests by customer sentiment.

## Measurement

Track each URL/language and these query groups:

- YardMatch branded searches
- Barnegat lawn care
- Barnegat lawn mowing
- Barnegat yard cleanup
- general service questions that lead to booking

Record:

| Metric | Source | Cadence |
| --- | --- | --- |
| Indexed URLs and selected canonical | Search Console URL inspection / indexing | At deployment and after significant changes |
| Impressions, clicks, click-through rate, average position | Search Console performance, branded vs non-branded | Weekly; compare complete 28-day windows |
| Organic inquiries and completed bookings | Existing first-touch lead and booking attribution | Weekly |
| Mobile loading and responsiveness | Search Console Core Web Vitals when field data exists; local browser measurements for diagnosis | At launch and after material UI changes |

Attribution limits: the search-domain list is deliberately bounded, browsers may omit referrers, and untagged ads can resemble organic visits. Tag paid campaigns explicitly. Existing stored first-touch records retain their original classification; do not silently rewrite historical data. Search Console queries are aggregate search data and must not be presented as known queries for individual customers.

## Verification

Run `npm run typecheck`, `npm run i18n:validate`, and `npm run test:web:smoke -- tests/web/seo.spec.ts`. The SEO browser suite checks locale URL stability, language-picker navigation, distinct bilingual metadata/content, sitemap language pairs, pseudo noindex headers, attribution precedence/persistence, and desktop/mobile overflow.

Run the full web suite for routing changes and API regressions when the lead/booking attribution flow changes. Record checkpoint evidence in `reports/agent-checkpoints/engineer/latest/seo/` and update `docs/agent-status/engineer.md`.

## Official references

- [Multilingual site URLs](https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites)
- [Canonical URL guidance](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)
- [Sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- [Start using Search Console](https://developers.google.com/search/docs/monitor-debug/search-console-start)
- [Business Profile eligibility and guidelines](https://support.google.com/business/answer/3038177)
