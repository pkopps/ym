# YardMatch Cost Sheet and Future P&L Starter

Last updated: June 16, 2026

This is the working cost model for YardMatch / GreenRain. Treat anything marked `Estimate` or `TBD` as a planning placeholder until the vendor account, usage pattern, and pricing tier are confirmed.

## Current Known / Near-Known Costs

| Cost item | Type | Current assumption | Monthly estimate | Notes |
| --- | --- | ---: | ---: | --- |
| Codex Pro | Fixed | User-provided | $100.00 | Current development assistant cost. |
| Google Maps Geocoding API | Variable | First 10,000 geocoding calls/month free; then roughly $5 per 1,000 calls for the next tier | $0.00 early | Cache every successfully geocoded address so each customer property/provider address is geocoded once. |
| Google Maps Places / Autocomplete | Variable | TBD by SKU/session usage | TBD | Use sparingly with session tokens. Prefer autocomplete only when typing an address, then cache selected place/address data. |
| Google Address Validation | Variable | TBD by SKU/usage | TBD | Useful for signup/booking quality, but should not run repeatedly for the same saved address. |
| Stripe card processing | Variable | 2.9% + $0.30 per online card transaction | Variable | Applies to customer payment volume. |
| Stripe Connect payouts | Variable | Estimate: $2 per active connected account/month plus payout fees if using Express/Custom | TBD | Verify final Connect structure before launch. |
| Apple Developer Program | Fixed | $99/year | $8.25 | Required for iOS App Store/TestFlight distribution. |
| Google Play Console | Fixed / one-time | $25 one-time registration | $0.00 ongoing | Amortize as $2.08/month only if modeling first-year setup cost. |
| Domain | Fixed | Estimate: $15-$25/year | $1-$2 | Depends on registrar and final domain choices. |
| Web hosting | Fixed | Estimate | $20-$50 | Example: Vercel/Netlify/Render style hosting. Final provider TBD. |
| API hosting | Fixed | Estimate | $25-$100 | Depends on traffic, deployment provider, background jobs, and scaling. |
| Postgres database | Fixed | Estimate | $20-$100 | Could be Supabase, Neon, Railway, Render, RDS, etc. Final provider TBD. |
| Object/file storage | Variable-ish | Estimate | $5-$25 | For property photos, provider photos, proof-of-work images, etc. |
| Email delivery | Variable-ish | Estimate | $0-$20 | Resend or similar. Early usage may fit free tier. |
| SMS delivery | Variable | Estimate: roughly cents per message after carrier fees | Variable | Twilio or similar. Keep SMS to high-value lifecycle messages only. |
| Push notifications | Fixed / variable | Usually low early | $0-$10 | Expo/APNs/FCM plumbing is mostly free; paid mobile build services may apply. |
| Monitoring / logging | Fixed | Estimate | $0-$50 | Sentry, Logtail, Datadog, PostHog, etc. Start free/low, upgrade later. |
| Analytics | Fixed | Estimate | $0-$50 | PostHog/GA/etc. depending on product analytics setup. |
| Expo EAS | Fixed | Optional | $0-$99 | Only if paid build capacity or team features are needed. |

## Practical Early Monthly Baseline

This is a rough planning baseline before paid customer volume:

| Category | Low case | Planning case |
| --- | ---: | ---: |
| Codex Pro | $100 | $100 |
| Apple Developer | $8 | $8 |
| Domain | $1 | $2 |
| Web hosting | $20 | $30 |
| API hosting | $25 | $50 |
| Postgres | $20 | $50 |
| Storage | $5 | $10 |
| Email | $0 | $20 |
| Monitoring / analytics | $0 | $25 |
| Google Maps | $0 | $0-$25 |
| SMS | $0 | Usage-based |
| Stripe | $0 | Usage-based |
| Estimated fixed monthly total | $179 | $295-$320 |

Important: this baseline excludes launch marketing spend. Marketing is variable and should be budgeted separately so we can scale or pause it based on response.

## Barnegat Launch Marketing Budget

These are practical estimates for the first local launch in Barnegat as of June 16, 2026.

Where possible, anchor to current official platform pricing. Where a vendor-specific print price is not yet locked, use planning ranges until the actual printer and quantity are chosen.

### Channel-Level Cost Assumptions

| Channel / item | Cost type | Working assumption | Estimated cost | Notes |
| --- | --- | --- | ---: | --- |
| USPS EDDM postage | Variable | USPS EDDM Retail rate | $0.247 per piece | Current USPS rate shown on the USPS EDDM page. Printing is separate. |
| Postcard / flyer printing for EDDM | Variable | Planning placeholder | $0.18-$0.45 per piece | Depends on size, paper, color, quantity, and printer. Use this until a print vendor is chosen. |
| Total EDDM cost per mailed piece | Variable | Postage + print placeholder | $0.43-$0.70 per piece | Best simple planning range for first-wave budgeting. |
| Landing page / QR tracking setup | Fixed / one-time | Use existing site and low-cost tools | $0-$50 | Can be nearly free if handled in-house. |
| Local phone / call tracking number | Fixed / monthly | Optional | $0-$30 | Useful if we want postcard-specific attribution. |
| Reddit organic posting | Variable | Time-only | $0 cash | Real cost is time and moderation risk if posting poorly. |
| Facebook page and organic posting | Variable | Time-only | $0 cash | Excludes optional boosts or ads. |
| Nextdoor organic presence | Variable | Time-only | $0 cash | Excludes optional paid local ads. |
| Door hanger / flyer print | Variable | Planning placeholder | $0.20-$0.45 per piece | Assumes simple full-color local leave-behind. Distribution labor not included. |
| Facebook or Instagram local test ads | Variable | Optional starter test | $100-$300/month | Keep this small until the landing page converts. |
| Nextdoor paid local ads | Variable | Optional starter test | $100-$250/month | Only worth testing after the offer and landing page are clear. |
| Referral credit | Variable | Per completed referred job | $25-$50 | Only pay on completed work, not just a lead. |
| Google Business Profile | Fixed | Official Google Business Profile | $0 | Google positions it as a free Business Profile. |

### Example EDDM Wave Budgets

Use these quick estimates for postcard-style first-wave planning:

| Mail volume | Postage only at $0.247 | Print at $0.18/piece | Print at $0.45/piece | Total estimated range |
| --- | ---: | ---: | ---: | ---: |
| 500 pieces | $123.50 | $90.00 | $225.00 | $213.50-$348.50 |
| 1,000 pieces | $247.00 | $180.00 | $450.00 | $427.00-$697.00 |
| 1,500 pieces | $370.50 | $270.00 | $675.00 | $640.50-$1,045.50 |
| 2,500 pieces | $617.50 | $450.00 | $1,125.00 | $1,067.50-$1,742.50 |

These totals exclude design labor. If we design in-house, treat that as founder time rather than a cash cost.

### Suggested First 30-Day Launch Budgets

Pick one of these instead of trying to do everything at once.

| Budget level | Estimated spend | What it funds |
| --- | ---: | --- |
| Lean test | $500-$800 | One 1,000-piece EDDM wave, QR landing page, and a small batch of flyers or door hangers. |
| Standard local launch | $1,000-$1,600 | Two EDDM waves or one larger wave, printed leave-behinds, and light referral credits or small ad testing. |
| Strong launch push | $2,000-$3,000 | Multiple mail waves, broader print coverage, referral incentives, and controlled paid social testing. |

Recommended default: start with the `Standard local launch` budget, but spend it in stages instead of all at once.

### Channel Prioritization By Cost Efficiency

If the goal is lowest cash risk first, prioritize channels in this order:

1. Google Business Profile
2. Reddit organic participation
3. Facebook and Nextdoor organic posting
4. Referral outreach
5. One EDDM test wave
6. Door hangers in the best-responding neighborhood
7. Paid local ads only after message-market fit is clearer

### Working Cost-Per-Lead Targets

Use these as rough guardrails for the first local tests:

| Metric | Working target |
| --- | ---: |
| Cost per inquiry from direct mail | under $40 |
| Cost per booked job from direct mail | under $100 |
| Cost per inquiry from paid social test | under $25 |
| Cost per booked job from paid social test | under $75 |
| Referral credit on completed job | $25-$50 max |

These are not final finance rules. They are starter thresholds to help decide whether a channel deserves a second round of spend.

## Active Revenue Model

YardMatch is moving forward with the hybrid model.

### Executable Launch Rules

The application now treats these assumptions as a versioned settlement policy rather than descriptive spreadsheet math:

- the customer charge remains the booked service price
- the provider funds the $30 finder fee on the first completed paid customer/provider job and the $6.99 fee on every completed paid job
- those fees are retained through Stripe transfer math; they are not separate crew deductions
- Stripe processing cost is a YardMatch expense and reduces platform net revenue, not the provider settlement already promised
- YardMatch transfers money only to the provider business; the provider is solely responsible for crew compensation
- a job is blocked from settlement when the provider proceeds would be negative
- actual processor cost must eventually come from Stripe balance-transaction data; estimates remain planning assumptions only

Policy identifier: `2026-07-provider-funded-v1`.

### Hybrid Finder Fee + Per-Job Fee

YardMatch charges a smaller one-time finder fee when a provider gets a new customer, then a smaller flat fee on each completed job.

| Input | Starter assumption |
| --- | ---: |
| Finder fee per new customer/provider match | $30.00 |
| Flat YardMatch fee per completed job | $6.99 |
| Gross revenue on first booking / accepted new client | $36.99 |
| Gross revenue on each repeat booking | $6.99 |
| Lower-fee sensitivity case | $30 finder fee + $5.00/job |

Pros:

- Easier for providers to accept than a high finder fee plus no ongoing support.
- Still gives YardMatch some recurring revenue when service repeats.
- Keeps the per-job fee predictable for providers.

Cons:

- A $6.99 per-job fee is still thin if YardMatch absorbs the full customer card processing cost, but it is meaningfully healthier than $5/job.
- Needs clear pricing language so providers understand both the new-client fee and the per-job fee.
- May require passing payment processing costs through separately to keep per-job margin healthy.

## Variable Cost Formula

Use this as the first simple P&L structure:

```text
GMV = completed bookings * average customer price

Hybrid platform revenue =
  new customer/provider matches * hybrid finder fee
  + completed bookings * hybrid per-job fee

Stripe processing = GMV * 2.9% + completed bookings * $0.30

Google geocoding cost =
  max(0, monthly geocode calls - free monthly calls) / 1,000 * geocoding price per 1,000

SMS cost =
  messages sent * blended SMS cost per message

Gross profit =
  platform revenue - Stripe processing - Google Maps cost - SMS cost - other variable costs

Operating profit before payroll/taxes =
  gross profit - fixed monthly software/vendor costs
```

## Example Booking Economics

Assumptions to replace later:

| Input | Placeholder |
| --- | ---: |
| Average customer job price | $75.00 |
| Hybrid finder fee per new customer/provider match | $30.00 |
| Hybrid flat fee per completed job | $6.99 |
| Hybrid lower-fee sensitivity | $5.00/job |
| Hybrid revenue on first booking | $36.99 |
| Hybrid revenue on repeat booking | $6.99 |
| Stripe fee per job | $2.48 |
| Stripe fee on $30 hybrid finder-fee charge | $1.17 |
| Hybrid first-booking net revenue if YardMatch absorbs job Stripe | $33.34 |
| Hybrid repeat-booking net revenue if YardMatch absorbs job Stripe | $4.51 |
| Hybrid repeat-booking net revenue if processing is passed through | $6.99 |
| Geocoding calls per completed job after caching | 0.10 |
| SMS messages per completed job | 2 |

Main takeaway: Stripe is the meaningful early variable cost. Google Maps should stay low if we geocode once, cache aggressively, and avoid repeated autocomplete/geocode calls. Within the chosen hybrid model, the biggest finance question is whether processing should be absorbed by YardMatch or passed through separately so repeat-job margin stays healthy.

## Break-Even Forecasting

This section estimates how much acquisition, booking volume, retention, and repeat service YardMatch needs to cover costs. These are directional planning numbers, not final finance assumptions.

### Contribution Assumptions

| Metric | Hybrid model |
| --- | ---: |
| Average customer job price | $75.00 |
| YardMatch revenue event | $30 per new match + $6.99/job |
| Gross YardMatch revenue per event | $36.99 first job, $6.99 repeat job |
| Stripe fee assumption | $1.17 on $30 finder fee + $2.48 per job if YardMatch absorbs card processing |
| Net contribution before support/ops labor | $33.34 first job, $4.51 repeat job |

### Monthly Break-Even Volume

| Monthly cost base | What it represents | Hybrid new customers needed if one job each |
| --- | --- | ---: |
| $320 | Planning-case software/tools only | 10 new customers/month |
| $2,500 | Lean early ops, light marketing, tools | 75 new customers/month |
| $5,000 | Part-time ops/support plus marketing | 150 new customers/month |
| $10,000 | Small paid operating base | 300 new customers/month |

Takeaway: the hybrid model is workable for launch, but it still needs repeat service or careful acquisition efficiency. The first job contributes well; the repeat-job margin is the part that needs protection.

### Repeat-Service Requirement Under Hybrid

These active customer counts show the conservative ongoing requirement after the $30 new-client fee is already earned. They assume YardMatch keeps $6.99/job but also absorbs the full $2.48 Stripe fee on a $75 customer payment, leaving $4.51 per repeat booking. If payment processing is passed through separately, these counts improve materially.

| Monthly cost base | Monthly service customers needed | Biweekly service customers needed | Weekly service customers needed |
| --- | ---: | ---: | ---: |
| $320 | 71 | 33 | 17 |
| $2,500 | 555 | 256 | 129 |
| $5,000 | 1,109 | 511 | 257 |
| $10,000 | 2,218 | 1,022 | 513 |

### Retention Needed to Hold the Base

Once the active customer base exists, new acquisition only needs to replace churn plus fuel growth. Example: at the $5,000/month cost base under the hybrid model:

| Service pattern | Active customers needed | New customers/month at 80% monthly retention | New customers/month at 90% monthly retention |
| --- | ---: | ---: | ---: |
| Monthly service | 1,109 | 222 | 111 |
| Biweekly service | 511 | 102 | 51 |
| Weekly service | 257 | 51 | 26 |

This is why recurring lawn mowing is strategically important. More repeat service lowers the number of new customers needed each month to stay at break-even.

### Customer Acquisition Allowance

Maximum CAC should be based on contribution margin, not gross booking value. These are rough caps before support labor, refunds, discounts, and overhead.

| Customer behavior | Hybrid contribution LTV |
| --- | ---: |
| One-time job | $33.34 |
| 4 monthly jobs | $46.87 |
| 12 monthly jobs | $82.95 |
| 26 biweekly jobs | $146.09 |

Practical CAC rule:

- For one-time cleanup-style jobs, keep CAC conservative because long-term value may never materialize.
- For recurring mowing, CAC can rise only after 30/60/90-day repeat behavior is real.
- The hybrid model becomes much healthier when repeat-job processing is passed through or when average ticket size rises.
- Until retention is measured, keep paid CAC below the first 1-3 months of expected contribution.

### Funnel Targets

Use these as starter acquisition targets:

| Goal | If visitor-to-booking conversion is 5% | If visitor-to-booking conversion is 10% | If visitor-to-booking conversion is 15% |
| --- | ---: | ---: | ---: |
| 52 new customers/month | 1,040 visitors/month | 520 visitors/month | 347 visitors/month |
| 104 new customers/month | 2,080 visitors/month | 1,040 visitors/month | 694 visitors/month |
| 208 new customers/month | 4,160 visitors/month | 2,080 visitors/month | 1,387 visitors/month |

For the early local-density strategy, the best target is not just traffic. The better target is qualified local homeowners in a tight service area who are likely to book recurring work.

### Early Profitability Hypothesis

The cleanest early path is likely:

- Start with the $30 + $6.99/job hybrid model as the preferred provider-friendly revenue model.
- Prioritize recurring lawn mowing because it turns one acquisition into many bookings.
- Track recommendation acceptance rate, booking conversion, first-job completion, 30/60/90-day repeat rate, and provider retention.
- Avoid paid acquisition until the first-job-to-repeat-service conversion is visible.
- Once repeat behavior is proven, scale only the channels that stay inside hybrid-model CAC payback targets.

## Google Maps Cost Control Rules

- Geocode each saved property address once and store latitude/longitude.
- Geocode each provider business address/service-area anchor once.
- Use Places Autocomplete only while the user is actively entering an address.
- Use Google session tokens for autocomplete flows so one address selection is billed as a session instead of scattered calls where applicable.
- Do not re-geocode on every search, booking page load, recommendation refresh, or provider listing view.
- Normalize address strings before cache lookup so `123 Main St` and `123 Main Street` do not create avoidable duplicate calls.
- Keep a `geocodedAt`, `geocodeProvider`, and `geocodePrecision` field so stale or low-confidence addresses can be refreshed intentionally.

## Future P&L Rows

When we build this into a real model, use these rows:

| P&L row | Formula / source |
| --- | --- |
| Completed bookings | Operating forecast |
| Average customer price | Service mix assumption |
| GMV | Bookings * average customer price |
| Provider payouts | GMV less platform fee, or direct payout logic |
| Hybrid platform revenue | New customer/provider matches * hybrid finder fee + completed bookings * hybrid per-job fee |
| Stripe processing fees | Card volume formula |
| Stripe Connect/payout fees | Connected account and payout assumptions |
| Google Maps/API costs | Usage assumptions less caching savings |
| SMS/email/push delivery | Message volume assumptions |
| Refunds/credits | % of GMV or % of bookings |
| Chargebacks | % of card volume |
| Hosting/database/storage | Vendor budget |
| Developer tooling | Codex, GitHub, Expo, etc. |
| Monitoring/support tools | Sentry, PostHog, helpdesk, etc. |
| Marketing spend | Paid acquisition, local flyers, referral credits |
| Customer support labor | Future payroll/contractor assumption |
| Ops/admin labor | Future payroll/contractor assumption |
| EBITDA / operating profit | Revenue minus variable and fixed operating costs |

## Pricing Sources to Recheck Before Launch

- Google Maps Platform pricing: https://mapsplatform.google.com/pricing/
- Google Geocoding API usage and billing: https://developers.google.com/maps/documentation/geocoding/usage-and-billing
- Stripe pricing: https://stripe.com/pricing
- Stripe Connect pricing: https://stripe.com/connect/pricing
- Apple Developer Program: https://developer.apple.com/programs/
- Google Play Console registration: https://support.google.com/googleplay/android-developer/
- Expo pricing: https://expo.dev/pricing
- Resend pricing: https://resend.com/pricing
- Twilio SMS pricing: https://www.twilio.com/en-us/sms/pricing/us
