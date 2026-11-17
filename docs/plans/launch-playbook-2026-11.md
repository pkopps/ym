# YardMatch Launch Playbook

November 14, 2026. Live version: [YardMatch Launch Playbook doc](https://claude.ai/artifact/JuwfRoYV9xPVEn4WoiXok1).

## Summary

The product is well built; the biggest launch risk is the finder fee, which is too expensive for small one-time jobs and easy for providers to avoid. Launch date is TBD. Fall and winter are for fixing the fee, running an alpha with Brian Riccitelli and friends in Barnegat, and signing up providers, so customer marketing starts in spring with supply already in place.

Based on a read of `pkopps/ym` at commit `061a844` (main, Nov 14, 2026) and the project docs on the fee model, testing and the Fable-week punch list.

## What the app does today

- **Customers (web):** pick a service and address, get up to three recommended verified providers with a size-based price estimate, book a slot, track the crew live, confirm completion, review, set up recurring plans, refer friends.
- **Providers (native app + web):** sign up and get verified, set ZIP-based prices, accept requests, schedule routes, manage their own crew, keep a card on file for finder fees. Customers pay providers directly.
- **YardMatch revenue:** one finder fee per customer–provider pair, $75 / $110 / $150 by lawn size, charged to the provider's card after the first completed job once the customer confirms or a 72-hour dispute window passes. Each provider's first customer is free. Pro/Teams subscriptions come later.
- **Switched off by flags:** crew marketplace and YardMatch-collected payments.

## Finder fee: problems and redesign

A flat fee is cheap for a recurring customer and a dealbreaker for a one-off, so providers will decline exactly the urgent one-time jobs the marketing targets.

| First job | Price | Fee | Fee as % of job |
| --- | ---: | ---: | ---: |
| Starting-price mow | $28 | $75 | 268% |
| Sick-week one-off mow | ~$45 | $75 | 167% |
| Snow shoveling (starting price) | $26 | $75 | 288% |
| Gutter cleaning on a big lot | $52 | $150 | 288% |
| Weekly mowing, 28-week season | ~$1,260 | $75 | 6% |

### Problems in the current code

- **Lawn size sets the tier for every service.** `FinderFeeService.resolveLawnSize` prices gutters, snow and ice work by grass area. The size is the customer's own estimate, and the provider can't correct it before being billed.
- **Only the provider can start the fee.** It begins when they mark the job complete; the customer can't confirm first, and there is no automatic completion. A provider who never taps Complete never pays.
- **Cancelling voids the fee.** "Cancel it in the app and I'll come Saturday anyway" gives a free customer.
- **Provider phone is shown before the job,** which makes taking the relationship off the app costless given the two points above.
- **Existing customers get charged.** A provider who moves their current customers into the app, or a long-time client who books through it, pays for a customer YardMatch didn't find.
- **Fee is per account, not household.** A spouse's second account means a second fee; a new tenant at the same rental needs a deliberate rule.
- **Providers don't see the fee before accepting.** A surprise $150 charge invites chargebacks.
- **First customer free may be a $40 one-off,** teaching the provider that every next one costs $75.
- **An open complaint ticket blocks the fee indefinitely.** It needs a time limit.

### Recommended redesign

1. **Charge by relationship type, not property size.**
    - Recurring plan: full tier fee after the first visit (as now).
    - One-time job: small capped fee, e.g. 15% of the quote, $25 max. If the customer books that provider again within 12 months, charge the rest of the tier fee then.
    - Snow and storm work: a flat per-season fee or the same capped percentage.
2. **Let the customer trigger completion.** Two hours after the scheduled end, ask "Did [provider] come?" A yes makes the fee billable. Flag cancelled first jobs where the pair never rebooks.
3. **Reward marking complete.** Send the review request only after completion, and count completed jobs and reviews toward ranking.
4. **Attribution clause in the provider agreement:** paid work for a YardMatch-introduced customer within 12 months owes the fee. Counsel drafts it.
5. **Free "bring your own customers":** import existing customers or flag a request as an existing customer (ops spot-checks), no fee.
6. **Provider controls:** opt out of one-time jobs or set a minimum job price.
7. **Show the fee on the request card** ("Finder fee for this customer: $110" or "free") and use a clear card statement line such as "YARDMATCH FINDER FEE".
8. **Longer free trial:** first 60 days or first three customers instead of one.

## Customer friction and edge cases

- **Overgrown grass at the door.** A sick customer hasn't mowed in three weeks and the estimate is wrong. Add "When was it last cut?" to the estimate questions, let providers set an overgrowth surcharge, and require customer approval of any price change before work starts.
- **"How do I pay?" is never answered.** Add accepted payment methods (cash, check, Venmo, Zelle) to provider profiles and show them on the confirmation, so providers don't chase sick or absent customers for $45.
- **Leftover copy that contradicts direct pay.** "You pay after they confirm" (`customer_live.state.requested`); the refund policy promises refund reviews on "completed, paid bookings"; `complaint.funding` says "YardMatch funds this refund." These suggest YardMatch owes refunds on money it never touched. Rewrite them with counsel.
- **Access and logistics:** gate codes, dogs, "I won't be home", parking, irrigation heads, garbage cans. Seasonal and absentee owners want photo proof on every visit.
- **Weather:** decide whether a rained-out visit moves to the next day automatically or needs both sides to agree, and tell customers up front.

## Provider pitch and crew strategy

The headline stays "Grow your business": YardMatch brings the customers and, later, the people to serve them. For busy established firms the limit is labor, not leads, so leads plus labor is the stronger offer.

### Two provider groups, one headline

- **Solo and newer operators** want more customers.
- **Established crews** want customers near their existing stops on the same weekday (route density), help in the August lull and fall cleanups, and the hands to take on more work.

### Why crew hiring is staged, not launched

- A crew login isn't a worker you can send to a job: they need to be free that day, nearby, have a ride, and be trusted with equipment and the customer's property.
- Every owner needs help in the April–May rush, when good workers are already taken. Gig shifts fit overflow (spring cleanups, mulch season, storm cleanup) better than everyday staffing.
- Once an owner finds a good worker, they'll hire them directly. Per-shift revenue disappears after the first good match.
- Matching individual shifts can make YardMatch look like a staffing agency or employer. NJ takes misclassification seriously; ask counsel.
- Three marketplace sides at once is three cold starts.

### Staged plan

1. **Launch:** "Grow your business" pitch. Crew stays a tool for an owner's existing workers (October decision). Start collecting crew sign-ups as a talent pool: skills, town, whether they drive, availability.
2. **Measure:** add a decline reason "booked up / not enough crew." It sizes the labor problem and becomes the sales line: "You turned down 9 jobs worth about $1,400 last month; here are 6 crew members within 10 miles."
3. **Hiring as placement:** the owner hires and employs the worker; YardMatch charges a one-time placement fee or includes hiring in Teams. Leakage stops mattering once the placement is paid.
4. **Overflow shifts later,** once there's enough vetted crew in one area and counsel has signed off.

### Crew pay stays off the app

Providers pay their crew themselves (cash, check, Gusto). The code already enforces this: settlements record `crewPayoutByYardMatchCents: 0`, and a launch gate requires that no YardMatch payout path can create a crew-member transfer. This keeps the owner clearly the employer. Keep the work record in the app with no money attached: who worked which jobs, check-in and check-out times, proof photos, and an hours-per-worker export (CSV, later QuickBooks or Gusto) as a Pro/Teams feature.

## Alpha with Brian and friends

Brian Riccitelli, who owns a Barnegat landscaping company and knows other local landscapers, is the alpha provider. Friends who live in Barnegat are the alpha customers.

### Brian (provider)

- **Start now with fall and winter work:** leaf cleanups, gutters, first snow. Bugs get found over the winter, not in March.
- **Watch him use the app in the field:** gloves, glare, one hand free, bad signal. Note every hesitation.
- **Test pricing with him directly:**
    - Would he pay $75 to pick up a one-off mow?
    - What does he charge a sick neighbor for one cut?
    - Does he turn work away in May, and is that because of customers or labor?
    - How does he find workers now?
- **Waive his fees during alpha.** Turn billing on for a few test jobs only, to exercise the card-on-file flow.
- **Make him the recruiter.** Waive first-season fees for each provider he brings in.

### Friends (customers)

- Send only a link; they book from scratch with no help.
- Ask what happened, not whether they liked it: how long booking took, what confused them, how they paid, whether confirmations and "on the way" messages arrived.
- Friends who are already Brian's customers test the "existing customer, no fee" case.
- Once there are other providers, have some friends book someone other than Brian to test matching.

### Track during alpha

- Time from request to provider confirmation
- Whether Brian marks jobs complete without reminders
- How customers paid, and whether anyone had to chase payment
- Every support question (becomes the FAQ and onboarding copy)

Goal by spring: real reviews on Brian's profile, a few providers from his network, and before-and-after photos for the postcard.

## Go-to-market

Providers first, in person, over fall and winter; homeowners by direct mail in spring, once two or three verified providers cover each launch service.

### Provider recruiting (now through March)

- Brian's network first (see Alpha).
- Call landscapers on Google Maps in Barnegat and nearby towns.
- Visit supply yards and mower dealers: counters, bulletin boards, early mornings.
- Post in local Facebook groups; talk to trucks working in town.
- Until coverage is solid, run it as a concierge: match by hand, with a "text us" fallback for customers.

### Direct mail to homeowners

- **One audience per card.** Front: one homeowner message, e.g. "Lawn mowed this week in Barnegat. Verified local pros." plus a QR code.
- **One small line for providers** at the bottom of the back: "Run a landscaping business? yardmatch.com/pros". No crew line; crew comes in through providers inviting their workers.
- **Timing:** mid-March for spring cleanups, then a mowing card in April. Exact dates follow the launch decision.
- **Routes:** skip carrier routes covering HOA or age-restricted communities where lawn care may be in the dues; focus on single-family streets.
- **Test two versions** (mowing, cleanup), each with its own QR code or URL.
- **No discounts:** YardMatch doesn't handle payment. Offer speed and trust ("Booked within 48 hours", "Every pro verified and insured"), or trade a reduced finder fee for a provider-funded discount.

### Positioning

The real competition is free: Facebook groups, Nextdoor and "my neighbor's guy." YardMatch wins on speed plus trust.

### Housekeeping

`MARKETING_PLAN.md` and `COSTS.md` are from June and still describe crew conversations and Stripe payment fees. Refresh them for the October model.

## NJ compliance

Confirm all of these with launch counsel.

- **Fertilizer certification is separate from a pesticide license.** `providerCredentialPolicy.ts` groups fertilization with weed control under one pesticide credential. NJ requires professional fertilizer applicators to be certified through Rutgers ([Rutgers](https://learn-landscaping.rutgers.edu/2017/11/07/fertilizer-training-and-blackout-dates-for-nj/)).
- **Professional fertilizer blackout: Dec 1 – Mar 1** ([source](https://news.agropages.com/News/print-8700.htm)). Booking doesn't block fertilization requests in that window yet.
- **Planting and sod need home improvement contractor registration;** basic mowing and trimming don't ([NJ Consumer Affairs](https://www.njconsumeraffairs.gov:443/News/Consumer%20Briefs/hiring-home-improvement-contractors.pdf)). Check where mulch installation falls and whether irrigation checks need an irrigation license.
- **Damage claims** (e.g. a mower throws a rock through a window): verification already requires general liability insurance. Spell out who handles claims in both the customer and provider agreements, since YardMatch holds no payment.

## Priorities and open decisions

### Fall and winter, in order

1. Redesign the finder fee by relationship type (capped one-time fee, separate rule for non-lawn services).
2. Customer "Did they come?" prompt triggers completion; reviews tied to completion.
3. Free import of providers' existing customers.
4. Fee shown on the request card; provider toggle for one-time jobs and minimum job price.
5. Fix leftover payment and refund copy.
6. Alpha with Brian and friends on fall and winter jobs.
7. Crew talent-pool sign-up and the "not enough crew" decline reason.
8. Provider recruiting through Brian's network and local outreach.
9. Refresh `MARKETING_PLAN.md` and `COSTS.md`; plan the spring mailing.

### Open decisions

- [ ] Launch date (TBD; spring customer marketing assumed)
- [ ] One-time fee rate and cap (15% / $25 proposed)
- [ ] Free trial length for providers (first customer vs 60 days vs first three)
- [ ] Household and tenant rule for the finder fee
- [ ] Placement fee vs Teams subscription for crew hiring
- [ ] Counsel review: attribution clause, refund copy, crew structure, NJ credentials

## Sources

- [Rutgers – Fertilizer Training and Blackout Dates for NJ](https://learn-landscaping.rutgers.edu/2017/11/07/fertilizer-training-and-blackout-dates-for-nj/)
- [Strict fertilizer rules now in effect across NJ](https://news.agropages.com/News/print-8700.htm)
- [NJ Consumer Affairs – Hiring Home Improvement Contractors](https://www.njconsumeraffairs.gov:443/News/Consumer%20Briefs/hiring-home-improvement-contractors.pdf)
