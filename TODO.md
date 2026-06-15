# TODO

## Customer Matchmaking

- Keep improving trust framing as more long-term dispute, cancellation, and fulfillment signals become usable in customer-facing summaries.
- Continue keeping alternative providers curated and limited instead of turning the flow into open-ended browsing.
- Review search/match telemetry by surface once enough volume exists:
  - no provider coverage
  - no open route windows
  - recommendation booking intent
  - accepted vs swapped recommendation behavior
- Keep hidden Uber-style matching out of the default launch flow unless customer trust data later supports it.
- Track and review:
  - recommendation views
  - alternative reveals
  - recommendation dismissals
  - accepted recommendations
  - swapped recommendations
  - recommendation acceptance rate
- Review recommendation performance by surface:
  - public web listings
  - customer web dashboard
  - customer mobile booking
- Add time-based and cohort interpretation on top of the new session-based recommendation funnel rates once traffic volume is meaningful.

## Marketplace Guardrails

- Avoid directory drift:
  - no promoted-listings-first discovery
  - no many-provider bidding on a common-service lead
  - no quote-comparison-first posture for basic recurring care
- Preserve provider-first economics in matching and pricing decisions.
- Expand market-by-market with local density first instead of broad sparse coverage.

## Search And Address Quality

- Keep pushing geocoding quality beyond the current fallback + optional Google Address Validation baseline.
- Keep tuning which fallback suggestions feel safe enough to auto-select versus which should require clearer customer confirmation.
- Review whether denser market coverage should eventually feed neighborhood-aware address confidence and matching confidence.

## Provider Assistant

- Broaden dispatch-adjustment reasoning beyond the new `What should I move tomorrow?` baseline:
  - compare multiple candidate cross-day relief slots instead of only the first cleaner opening
- Broaden staffing-adjustment reasoning beyond the new `Do I need more crew tomorrow?` baseline:
  - suggest when route pressure is operational rather than staffing-driven, so moving work is better than adding crew
  - distinguish between “review pending matches” vs “source more crew” across multiple competing bookings, not just the top recommendation
