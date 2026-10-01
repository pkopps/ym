# YardMatch provider pricing research

Updated September 27, 2026. Production pricing is unchanged; these are investor-model assumptions.

## Recommendation

Charge a one-time acquisition fee after the first completed paid job in a new customer/provider relationship:

| Property scope | Finder fee |
|---|---:|
| Typical | $75 |
| Large | $110 |
| Very large | $150 |

Preserve one finder-fee waiver for each new provider. If the first service bill is smaller than the finder fee, YardMatch can collect the fee over the first three completed jobs to reduce the initial cash burden. Validate fee acceptance and the property-size boundaries in the pilot.

Charge no recurring YardMatch service fee. Customers pay providers directly with cash, check, or the provider’s existing payment method. This removes card processing, ACH, Connect, payout, chargeback-reserve, and proprietary payment-engine costs from the selected marketplace forecast.

## Why Zocdoc is relevant

Zocdoc’s current provider help says discovery fees vary by specialty and location and are charged for qualifying new-patient/provider connections. Repeat visits to the same provider and specified non-discovery bookings are excluded. Zocdoc also offers paid add-ons. [Current pricing and billing help](https://www.zocdoc.com/provider-help/en/articles/10859404-understanding-zocdoc-pricing-and-billing).

A public Zocdoc page lists a $30–$140 new-patient booking range, while also containing older licensing language. Treat that range as a public reference, not a verified current nationwide quote. [Published billing explanation](https://www.zocdoc.com/about/understanding-your-bill/).

The lesson for YardMatch is the acquisition event: charge for a useful new relationship. YardMatch should not copy the exact fee or booking trigger because landscaping jobs, repeat frequency, provider margins, and no-shows differ.

## Provider economics

A provider keeps the full service bill from repeat jobs, less the provider’s own collection method and operating costs. YardMatch incurs an estimated $0.25 of support and infrastructure per completed booking and earns no recurring service fee, so repeat service has a small negative direct contribution. Finder fees and subscriptions fund that coordination layer.

The base 2033 forecast uses a weighted average finder fee of $91.25 before waivers:

- 65% typical properties at $75
- 25% large properties at $110
- 10% very large properties at $150

After 5,699 welcome waivers, 236,920 new households produce $21.1m of finder-fee revenue in 2033.

## Subscription pricing

Pro at $49 per month and Teams at $99 per month give the provider another reason to pay YardMatch after acquisition. The recruiting feature is the wedge: new customer demand can create a need for additional workers. Teams adds multi-crew controls and job-costing tools. Individual crew members pay $0.

[Jobber’s public pricing](https://www.getjobber.com/pricing/) shows a paid software category for field-service businesses. It does not prove YardMatch’s price or adoption. Provider interviews and a paid pilot should test whether the tools save enough time or improve enough capacity to justify the subscription.

## Model controls

- Finder tiers: `Assumptions!D69`, `D131`, and `D132`
- First-provider waiver: `Assumptions!D88`
- Pro and Teams prices and adoption: `Revenue streams`
- National property mix and cohort revenue: `National rollout`
- Direct-payment exclusions and consolidated EBITDA: `Operating model`

The `Payments` sheet is retained only as legacy reference research. Its costs do not enter the selected forecast.
