# YardMatch SEO Plan

Last updated: June 17, 2026

This is the working SEO plan for YardMatch's local launch, starting in Barnegat, New Jersey.

This plan is meant to support:

- local organic search
- Google Business Profile visibility
- service-page rankings for high-intent homeowner searches
- branded search trust after people see mailers, Reddit posts, Facebook posts, or referrals

Related docs:

- `MARKETING_PLAN.md`
- `COSTS.md`

## Primary SEO Goal

In the first 60 to 90 days, SEO should help YardMatch:

- rank for a small set of Barnegat service terms
- look legitimate when people search the brand name
- capture demand from homeowners already searching for help
- build a base that can later expand into nearby Ocean County towns

This is not a national SEO project yet.

The immediate target is local trust plus local service-intent traffic.

## Current Site Snapshot

Based on the current web app, YardMatch already has:

- page-level metadata on many routes
- a sitemap route
- a robots route
- some structured data on the public marketplace page

Important current gaps:

- the site still uses the placeholder domain `https://yardmatch.example` in [apps/web/src/app/layout.tsx](/Users/patrickkopps/Documents/app/apps/web/src/app/layout.tsx:23), [apps/web/src/app/sitemap.ts](/Users/patrickkopps/Documents/app/apps/web/src/app/sitemap.ts:19), and [apps/web/src/app/robots.ts](/Users/patrickkopps/Documents/app/apps/web/src/app/robots.ts:9)
- the public customer experience still defaults to `Brooklyn, NY` in [apps/web/src/components/PublicCustomerMarketplacePage.tsx](/Users/patrickkopps/Documents/app/apps/web/src/components/PublicCustomerMarketplacePage.tsx:152), which fights the Barnegat launch story
- the current public SEO setup is broad and marketplace-oriented, but not yet strongly localized for Barnegat
- auth, login, ops, crew, and internal-product pages appear in the sitemap, even though they are not the best pages to rank for homeowner demand
- the homepage currently uses `WebSite` structured data, but the launch also needs local business and service-area trust signals

## SEO Strategy

The launch SEO strategy should focus on four things:

1. technical cleanup so search engines see the right domain, pages, and metadata
2. local landing pages for Barnegat and a small number of nearby future towns
3. service pages for the highest-intent jobs
4. local trust signals through Google Business Profile, reviews, and consistent business information

## Target Keyword Groups

Start small and only target keywords that match likely first bookings.

### Primary Barnegat Keywords

- lawn care Barnegat NJ
- lawn mowing Barnegat NJ
- landscaper Barnegat NJ
- landscaping Barnegat NJ
- yard cleanup Barnegat NJ
- hedge trimming Barnegat NJ
- mulch installation Barnegat NJ
- gutter cleaning Barnegat NJ

### Secondary Intent Keywords

- same week lawn mowing Barnegat NJ
- weekly lawn service Barnegat NJ
- local landscaper near me
- yard cleanup near me
- lawn service near me

### Brand Keywords

- YardMatch
- YardMatch Barnegat
- YardMatch lawn care

The early win is not ranking for every landscaping term. The early win is owning a tight set of local, high-intent searches.

## Recommended Site Architecture

Keep the structure simple and scalable.

Recommended public SEO sections:

- homepage
- one Barnegat town page
- one service page per core service
- one page that combines service + town for the best converting combinations
- a small FAQ or guides section

Recommended URL direction:

- `/barnegat-nj`
- `/services/lawn-mowing`
- `/services/yard-cleanup`
- `/services/hedge-trimming`
- `/services/mulch-refresh`
- `/barnegat-nj/lawn-mowing`
- `/barnegat-nj/yard-cleanup`

If we later expand, repeat the same pattern for nearby towns instead of inventing a new structure.

## Which Pages Should Rank

Focus search indexing on customer-acquisition pages, not internal product pages.

Best indexable pages:

- homepage
- about page
- customer booking / marketplace page
- local town pages
- service pages
- service-plus-town pages
- help pages only if they answer real pre-booking questions

Pages that likely should not be SEO priorities, and may eventually need `noindex`:

- login pages
- signup pages
- customer dashboard
- provider dashboard
- crew dashboard
- ops pages
- internal schedule and management pages

The sitemap should eventually emphasize only pages we actually want to rank.

## Homepage SEO Role

The homepage should become the main brand + local-market entry point.

Recommended homepage direction:

- headline should include Barnegat or the launch geography
- copy should clearly say what YardMatch helps homeowners book
- mention the first core services directly
- mention service area and trust signals
- link prominently to the town page and service pages

Good homepage keyword themes:

- lawn care in Barnegat
- landscaping in Barnegat
- book local yard services

## Local Landing Pages

The most important SEO asset for this launch is a real Barnegat page.

Recommended first local landing page:

- `Barnegat, NJ Lawn Care and Landscaping`

What it should include:

- unique intro copy about YardMatch in Barnegat
- specific services available in town
- trust framing around vetted providers, reliability, and fast booking
- local references that are real and natural
- FAQ section
- clear call to action

Do not make thin city pages.

Each local page should have:

- unique title tag
- unique meta description
- unique H1
- town-specific FAQ content
- internal links to service pages
- structured data where appropriate

## Service Pages

Build service pages around the jobs most likely to convert first.

Priority order:

1. lawn mowing
2. yard cleanup
3. hedge trimming
4. mulch refresh
5. gutter cleaning

Each service page should include:

- what the service includes
- who it is for
- when customers usually book it
- what affects price
- why use YardMatch instead of calling multiple companies
- FAQs
- links to Barnegat and future town pages

## Service + Town Pages

These are likely to be some of the highest-intent organic pages.

First priority pages:

- Barnegat lawn mowing
- Barnegat yard cleanup
- Barnegat hedge trimming

Each page should be genuinely useful, not just keyword-swapped.

Include:

- service overview in the town
- what customers in that area usually need
- seasonal timing cues
- trust and availability language
- FAQs specific to that service and town

## Metadata Plan

Every public SEO page should have:

- unique title tag
- unique meta description
- canonical URL
- strong H1
- helpful intro copy above the fold

Title tag pattern examples:

- `Lawn Care in Barnegat, NJ | YardMatch`
- `Lawn Mowing in Barnegat, NJ | YardMatch`
- `Yard Cleanup in Barnegat, NJ | YardMatch`

Meta description pattern:

- short service + location summary
- trust signal
- call to action

Example:

`Book lawn mowing and yard cleanup in Barnegat, NJ with trusted local providers through YardMatch. Fast quotes and simple scheduling.`

## Structured Data Plan

Keep structured data accurate and limited to what is actually true.

Priority schema types:

- `WebSite`
- `Organization`
- `LocalBusiness` or the most accurate service-business subtype once the business setup is final
- `FAQPage` on real FAQ sections
- `BreadcrumbList` once there are enough landing pages to justify it

Important rule:

- only mark up reviews, ratings, addresses, and business details that are real and publicly supportable

## Google Business Profile Plan

Google Business Profile matters as much as traditional SEO for this launch.

Recommended setup:

- create one real Business Profile
- configure it correctly as a service-area business if that matches operations
- use the real business name only
- set Barnegat and nearby actual service areas
- use a local phone number if possible
- link to the main website and the best local landing page

Profile completion priorities:

1. verification
2. primary category
3. service area
4. phone
5. website
6. hours
7. business description
8. photos
9. services

Review plan:

- ask every happy customer for a review
- ask for plain-language detail, not keyword stuffing
- reply to every review

## On-Page Content Rules

For local SEO, the copy needs to sound local and useful, not generated.

Use:

- clear homeowner language
- real service descriptions
- specific timing and seasonal cues
- natural mention of Barnegat and nearby areas
- trust language tied to booking experience

Avoid:

- pages that only swap town names
- repetitive keyword stuffing
- vague "full-service outdoor solutions" copy
- making promises about coverage before supply actually exists

## Content Plan

The first wave of SEO content should support bookings, not publishing volume.

Best first content types:

- town page for Barnegat
- service pages
- service-plus-town pages
- FAQ content around booking, timing, and homeowner expectations

Optional guide content after the first pages are live:

- when to schedule lawn mowing in coastal New Jersey
- what homeowners should ask before hiring lawn care help
- spring yard cleanup checklist for Barnegat homeowners
- how often most Barnegat lawns need mowing in peak season

Guide content should always link back to booking pages.

## Internal Linking Plan

Internal linking should make the service area obvious.

Link between:

- homepage and Barnegat page
- homepage and core service pages
- service pages and Barnegat versions
- FAQs and booking pages
- about page and customer booking pages

Anchor text should stay natural:

- `lawn mowing in Barnegat`
- `yard cleanup services`
- `book local lawn care`

## Technical SEO Priorities

### Immediate Fixes

These should happen before serious SEO rollout:

1. replace all `yardmatch.example` references with the real production domain
2. remove or de-prioritize non-marketing pages from the sitemap
3. decide which auth, login, dashboard, ops, and crew pages should be `noindex`
4. change the public default area from `Brooklyn, NY` to Barnegat or a neutral empty state
5. add canonical handling for indexable marketing pages

### Next Layer

After the immediate fixes:

1. add LocalBusiness or Organization structured data to the relevant public pages
2. add FAQ structured data only where the page visibly contains that FAQ
3. ensure all important pages are linked from crawlable navigation or internal links
4. verify metadata for every public landing page
5. submit sitemap in Google Search Console

## Measurement Plan

Track SEO as its own channel from day one.

Primary metrics:

- indexed pages
- impressions
- clicks
- average position
- branded vs non-branded queries
- leads from organic search
- booked jobs from organic search

Track in:

- Google Search Console
- Google Analytics or equivalent analytics
- internal lead-source tracking

Important query buckets:

- brand
- Barnegat town terms
- service terms
- service + town terms

## 30-Day SEO Execution Plan

### Week 1

- lock the real production domain
- fix metadata base, sitemap, and robots references
- define which public pages should be indexable
- define the first Barnegat keyword set

### Week 2

- publish or scope the Barnegat town page
- publish or scope lawn mowing and yard cleanup pages
- update homepage copy for the local launch
- set up Google Search Console

### Week 3

- add structured data improvements
- refine sitemap to focus on ranking pages
- launch Google Business Profile
- ask first customers for reviews

### Week 4

- review which queries start appearing
- expand to one or two more service pages
- tighten titles and descriptions based on impressions
- add FAQs where users show repeated questions

## 60- To 90-Day Expansion

Only expand after Barnegat pages are live and indexed.

Next possible locations:

- Manahawkin
- Waretown
- Forked River
- Stafford Township

Expansion rule:

- do not create new town pages until there is real operational intent to serve them

## Success Criteria

The plan is working if:

- branded searches look trustworthy
- Barnegat pages are indexed
- service-plus-town pages begin earning impressions
- Google Business Profile starts showing for local service searches
- organic leads begin appearing in the same funnel as mail and social leads

## Recommended Immediate Next Steps

If we want the most leverage first, do these next:

1. Create the real Barnegat local landing page.
2. Fix the placeholder domain references in the web app metadata, sitemap, and robots files.
3. Remove non-SEO pages from the sitemap strategy.
4. Change the public default location away from Brooklyn.
5. Set up Google Business Profile and Search Console.

## Reference Sources

This plan is informed by current official guidance from Google:

- Google Search Central SEO Starter Guide: https://developers.google.com/search/docs/fundamentals/seo-starter-guide
- Build and submit a sitemap: https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- robots.txt guide: https://developers.google.com/search/docs/crawling-indexing/robots/intro
- LocalBusiness structured data: https://developers.google.com/search/docs/appearance/structured-data/local-business
- Google Business Profile setup: https://support.google.com/business/answer/10514137
- Google Business Profile guidelines: https://support.google.com/business/answer/3038177
