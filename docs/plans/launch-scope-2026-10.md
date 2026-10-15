# Launch scope decisions — October 2026

Decided October 14, 2026. Patrick chose the crew and app direction; he delegated the billing model to Claude's recommendation, so treat that one as open to revision and confirm it with launch counsel before the provider agreement is finalized.

## 1. Billing: providers get paid directly; YardMatch earns a finder fee plus subscriptions

**Decision.** Launch with the model already in `output/presentations/YardMatch-Revenue-Options.md`:

- Customers pay providers directly. YardMatch does not collect, hold or transfer service money at launch.
- YardMatch charges the provider a one-time finder fee per new customer relationship ($75 typical, $110 large, $150 very large property), after the first completed job. Each provider's first relationship is waived.
- Optional provider software: Pro $49/month, Teams $99/month. Subscription never affects recommendation ranking.
- No per-job fee.

**Why.**

- The current app model ($30 first job + $6.99 per job, YardMatch absorbs processing) loses money on card-paid repeat jobs above ~$231 and costs a weekly-mow provider ~18% of that customer's season revenue. It also gives providers a reason to move repeat customers off-platform.
- With no per-job fee, there's nothing to route around after the first job, which removes the main disintermediation incentive.
- Not handling service funds removes merchant-of-record, settlement-ledger, Connect-onboarding and transfer-reversal work from the launch path, and keeps the code consistent with what investors have seen.

**Costs of this choice, to manage rather than ignore.**

- YardMatch can't see payment, so "first completed job" needs a trustworthy trigger: provider marks complete **and** the customer confirms (or doesn't dispute within a window). Finder fees are charged to a provider card on file.
- Less leverage in customer disputes. Keep complaint intake and evidence review; refunds become provider-handled with YardMatch goodwill credits when warranted.
- The existing Stripe Connect, checkout, settlement and payout code is not deleted. Put it behind a feature flag (off) so YardMatch payments can return later as an optional Pro feature for providers who want card acceptance and invoicing.

## 2. Crew: a provider tool, not a marketplace

**Decision.** Crew members are the provider's own team. Providers invite, schedule, message and assign crew. YardMatch does not match crew to providers at launch.

- Hide public crew opportunities and crew claiming (`listCrewOpportunities`, `selectPublicCrewOpportunity`, `claimPublicCrewOpportunity`, the web `CrewHiringDashboard`) behind a flag, off.
- Keep: invites, assignments, route leader, crew messaging, crew schedule view. The rule that YardMatch never pays crew stays.

## 3. Apps: native provider app; customers on the web

**Decision.** Launch one native app, for providers, with crew as a role inside it. Customers use the responsive web app.

- `apps/provider-mobile` gains a crew role (sign-in as crew shows the crew views: today's jobs, route, messages, availability). Port screens from `apps/crew-mobile`; don't rebuild.
- `apps/customer-mobile` and `apps/crew-mobile` stay in the repo but leave the release pipeline (EAS profiles, store workflows, launch checklist). No new customer-native features.
- `apps/mobile` is the legacy Expo workspace (`MOBILE_DEPLOYMENT.md` already says it is not a release target). Remove it.
- Customer web booking, account, bookings and support must be fully usable at 390×844.

## Implementation chunks (for Claude Code, one PR each)

| # | Chunk | Checks |
|---|---|---|
| A | Add feature flags (`YARDMATCH_PAYMENTS_ENABLED`, `YARDMATCH_CREW_MARKETPLACE_ENABLED`), default off in production config; gate the payment, payout and crew-marketplace routes and UI entry points. No deletions. | typecheck, lint, `test:api`, `test:smoke` |
| B | New economics policy version for the finder-fee model: size-tiered fee, provider first-relationship waiver, completion trigger (provider complete + customer confirm or no dispute within window), provider card-on-file billing. Keep the old policy version for history. | `test:api`, economics tests, Postgres integration |
| C | Update provider and customer copy, pricing pages, help center and terms references to direct payment. Copy review per `AGENTS.md` Production-Facing Content rules. | typecheck, `test:web:smoke`, screenshots at 1440×900 and 390×844 |
| D | Crew role in `apps/provider-mobile`, porting crew screens. | typecheck, Expo export, simulator smoke |
| E | Pull `customer-mobile` and `crew-mobile` from EAS/store workflows and the launch checklist; remove `apps/mobile`. | `verify:mobile-release`, CI |
| F | Pro/Teams subscriptions (Stripe Billing on the provider). Can follow launch. | `test:api` |

Run these after, or interleaved with, `docs/refactor/marketplace-platform-service-split.md`. Chunk A is small and safe to do first; chunk B is easier after the payments split (refactor chunk 10).
