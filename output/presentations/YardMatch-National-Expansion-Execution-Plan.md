# YardMatch national expansion execution plan

Research updated September 27, 2026. This document recommends an operating plan; it does not claim achieved traction or guarantee launch timing.

## Recommendation

Expand **cluster by cluster, with service areas as liquidity zones rather than political boundaries**. Start with supply, release demand in controlled batches, and expand outward only when the current zone passes reliability, retention, and contribution gates.

Within each cluster, start with **affluent suburban neighborhoods where homeowners have serviceable lawns and a strong reason to outsource the work**. Wealth is the commercial wedge, but it must be combined with detached-home density, lot size, provider coverage, and route adjacency. A wealthy urban ZIP code with few lawns is a poor market; a slightly less wealthy suburban corridor with large owner-occupied properties and abundant landscapers may be much better.

The current investor model's 750 service areas across 40 states by 2033 should be presented as an **upside case** until the first two seasons prove the launch playbook. A more defensible base is approximately **400 service areas across 25 states by 2033**, followed by the remaining continental states in 2034–2036.

The research supports this change:

- DoorDash described local network effects, critical mass, and a high-density starting category as central to improving marketplace economics. It also emphasized that a strong merchant footprint helps new markets reach critical mass quickly. [DoorDash S-1](https://www.sec.gov/Archives/edgar/data/1792789/000119312520292381/d752207ds1.htm).
- Rover reported that local density, provider diversity, and quality improve matches; 60% of its January 2022 customer cohort rebooked within 12 months. Rover also warned that lower-density suburban and rural markets are harder to penetrate. [Rover 2022 Form 10-K](https://www.sec.gov/Archives/edgar/data/1826018/000182601823000015/rovr-20221231.htm).
- Angi describes home services as fragmented and local. Its competitive factors include provider-network quality and stability, requests that convert into provider revenue cost-effectively, prescreening, and direct customer engagement. [Angi 2025 Form 10-K](https://www.sec.gov/Archives/edgar/data/1705110/000170511026000011/angi-20251231.htm).
- A current public-market expansion plan from Serve Robotics uses the same operating pattern: high-density neighborhood first, prove unit economics, then expand outward city by city. [Serve Robotics investor presentation](https://www.sec.gov/Archives/edgar/data/1832483/000183248326000004/finalserve_investorxdeck.htm).

## Define a service area correctly

A YardMatch service area should be a **liquidity zone** where the same providers can realistically serve the same customers. It should usually represent:

- a 15–30 minute provider route radius;
- a set of contiguous ZIP codes or neighborhoods;
- similar service pricing and seasonality;
- enough owner-occupied, serviceable properties to support at least 240 first-season households;
- at least six providers of core services, plus capacity reserve and backups.

Municipal borders are useful for marketing and reporting, but they should not force an artificial market boundary. Google similarly tells service-area businesses to specify actual cities or postal codes and keep the overall service geography within a practical driving range. [Google Business Profile service-area guidance](https://support.google.com/business/answer/9157481?hl=en).

The unit of marketplace health should be the **liquidity cell**: geography × service × time window × property scope. A town can appear supplied while a Saturday large-property mowing request still has no viable match.

## Affluent-neighborhood wedge

The initial customer profile should be an owner of a detached suburban home who values time, reliability, and property appearance more than finding the lowest possible price. Useful neighborhood signals include:

- high owner occupancy and detached-home share;
- household income and home value;
- medium, large, or estate-size properties;
- dual-income commuter patterns, second homes, or other indicators that make outsourcing more attractive;
- recent home purchases and household moves, which create a natural moment to choose a new service provider;
- existing landscaping businesses with capacity to serve the area;
- adjacency to neighborhoods already covered by those providers.

Avoid charging by homeowner income or ZIP code. Continue classifying finder fees by the serviceable property scope—typical, large, or very large—because that is more closely connected to the provider's expected relationship value and is easier to explain.

Affluent towns should usually be launched as part of a larger route cluster. For example, Rumson and Colts Neck offer high-value properties but limited household volume; combining them with Middletown, Holmdel, Wall, and Howell gives providers a larger, denser Monmouth County opportunity.

## Launch core services before complex services

Concentrate early liquidity in a narrow service stack:

1. **Launch everywhere:** mowing, edging, trimming, leaf and seasonal cleanup, and mulch.
2. **Add after reliable operations:** aeration, overseeding, recurring maintenance bundles, and larger cleanups.
3. **Add after state and insurance review:** pesticide or chemical applications, tree removal, hardscaping, and other high-liability projects.

EPA notes that commercial pesticide certification requirements vary by state and that many states require certification beyond federally restricted-use pesticides. YardMatch should maintain a state compliance matrix before enabling chemical services. [EPA applicator certification standards](https://www.epa.gov/pesticide-worker-safety/certification-standards-pesticide-applicators).

## Supply-first launch sequence

For each new liquidity zone:

1. Build a list of at least 50 provider prospects.
2. Qualify 15 businesses for service fit, insurance, licensing, reputation, geographic coverage, and available capacity.
3. Onboard at least eight providers, with six expected to be active and two held as capacity reserve.
4. Require at least three eligible providers for the core request cells so the primary recommendation and curated backups remain credible.
5. Confirm combined first-season capacity of at least 300 households before releasing a 240-household demand target.
6. Train providers on acceptance, schedule updates, issue resolution, finder-fee billing, and the Pro recruiting workflow.

The ideal initial provider is usually an established local firm with two to nine employees: large enough to absorb incremental demand, small enough to value customer acquisition and crew recruiting. The provider portfolio should also include one or two larger anchors and selected high-quality owner-operators.

## Immediate supply evidence

The following figures are YardMatch calculations from the Census Bureau's 2023 County Business Patterns employer-establishment file for NAICS 561730, Landscaping Services. County Business Patterns excludes nonemployer sole proprietors, so the total provider universe is larger. [2023 County Business Patterns datasets](https://www.census.gov/data/datasets/2023/econ/cbp/2023-cbp.html).

| Initial corridor | Employer landscaping establishments | Employees | Establishments with fewer than 10 employees |
|---|---:|---:|---:|
| Ocean County, NJ | 302 | 1,591 | 87.4% |
| Monmouth County, NJ | 464 | 2,269 | 86.6% |
| Middlesex County, NJ | 321 | 1,504 | 86.6% |
| Morris County, NJ | 481 | 2,587 | 87.1% |
| Bergen County, NJ | 582 | 2,615 | 88.1% |
| Rockland County, NY | 315 | 1,288 | 91.4% |
| Westchester County, NY | 847 | 3,073 | 90.8% |
| Nassau County, NY | 985 | 2,621 | 94.9% |
| Suffolk County, NY | 1,745 | 7,634 | 89.7% |

The same source reports 8,059 employer landscaping establishments in the New York–Newark–Jersey City metro, 2,642 in Philadelphia, 2,876 in Boston, 1,908 in Atlanta, 1,642 in Dallas–Fort Worth, 1,426 in Tampa, 1,276 in Orlando, 1,103 in Charlotte, 774 in Bridgeport–Stamford, and 622 in Hartford. This makes the tri-state corridor a strong place to learn before opening distant metros.

## Demand launch sequence

Do not turn on a whole town at once. Release demand in batches of 25–50 households and check provider capacity after every batch.

Use four channel groups:

- **Provider and customer referrals:** test $20 to the referring customer plus $10 to the new household after verified paid service, and a $50 finder-fee credit for a provider who introduces a verified business that activates. Attribute every referral and measure incremental conversions against a holdout. These are proposed pilot terms; see the [referral incentive plan](YardMatch-Referral-Incentives.md).
- **Address-targeted local search and town landing pages:** show eligibility only where verified supply exists.
- **Neighborhood direct mail:** USPS Every Door Direct Mail can target routes by ZIP code and demographic filters, and currently lists retail postage at $0.26 per piece. Use it as a measurable holdout test, not a blanket mailing. [USPS EDDM](https://www.usps.com/everydoordirectmail/).
- **Local partnerships:** real-estate agents, property managers, garden centers, community groups, and employer or HOA pilots where the customer remains free to choose.

Every market should run channel holdouts. Scale only channels that produce a completed first relationship within the local CAC gate. Organic and referral share should rise before a market is considered mature.

### Referral pilot to accelerate local growth

Reserve a maximum $4,250 economic allowance for 100 qualifying household referrals and five activated provider referrals: $4,000 cash allowance and $250 in future finder-fee credits. At full enrollment and conversion, the customer program costs $40 per acquired household including setup. Costs are higher if fewer households qualify. The current CAC assumption already includes incentives; replace it with channel-level spending rather than adding referral spending twice.

Release referrals in the same 25–50-household batches as other demand channels. Focus invitations on adjacent covered neighborhoods, verify direct homeowner-to-provider payment, and honor accepted offers even if new enrollment later pauses. Grow provider referrals alongside household demand. Rewards do not affect recommendation ranking, service prices, or provider verification standards.

The [referral incentive plan](YardMatch-Referral-Incentives.md) defines proposed amounts, qualification, budget reservations, holdout measurement, model treatment, and implementation work. Validate the $20 contribution gate after all incentives and waivers. Use measured improvements to release larger acquisition batches; retain the existing geographic expansion gates. The workbook and deck remain unchanged until a referral cost schedule and approved terms are incorporated.

## Eight-week market launch sprint

| Timing | Work |
|---|---|
| Weeks -8 to -6 | Score the zone, complete state/local compliance review, map liquidity cells, and recruit provider prospects |
| Weeks -6 to -3 | Verify and onboard providers, load availability and property limits, and build the homeowner waitlist |
| Weeks -3 to 0 | Run dry bookings, test backup coverage, train support, and approve the first demand tranche |
| Weeks 1 to 4 | Release 25–50 households per batch, monitor every failed match and service issue daily |
| Weeks 5 to 8 | Reconcile CAC, finder-fee realization, provider capacity, completion, support cost, and early rebooking signals |
| After week 8 | Expand into the adjacent zone only if the four-week scorecard passes |

A new state requires a reusable state pack before the first launch: provider agreement review, business and trade licensing matrix, insurance requirements, pesticide and tree-service rules, consumer-protection workflow, taxes, and escalation contacts.

## Hard expansion gates

### Before opening demand

- At least eight verified providers and 300-household combined capacity.
- A primary recommendation plus at least two credible backups for 90% of core liquidity cells.
- At least 150 qualified homeowner waitlist leads or a tested channel plan capable of reaching the 240-household target.
- Support, incident, and provider-removal procedures tested.
- State and local compliance checklist complete.

### Before opening the adjacent service area

Use four consecutive weeks, with at least 100 completed first relationships:

- at least 90% of eligible requests have a primary recommendation and two backups;
- at least 80% of recommended jobs are accepted within four business hours;
- at least 92% completion;
- provider-caused cancellation, rework, or material service-issue rate at or below 5%;
- customer CAC per completed first relationship at or below $55;
- at least $20 contribution per acquired relationship after finder-fee waivers, customer CAC, allocated provider onboarding, and first-season support;
- 90-day provider retention at or above 85%;
- no single provider controls more than 20% of zone capacity.

### Before accelerating a metro

- second-season paid household retention at or above 70%;
- annual provider retention at or above 85%;
- organic and referral acquisition at or above 25%;
- Pro plus Teams adoption supports the provider workflow thesis;
- two adjacent zones pass the same economics without emergency central support.

These thresholds are proposed operating gates. The Barnegat pilot should revise them with observed data.

## Recommended geographic sequence

### 2027: prove one liquidity zone

Launch Barnegat for the full season. Target 240 active households. Do not count an adjacent town as launched merely because a provider will drive there.

### 2028: complete the Ocean County cluster

Reach six contiguous service areas around Barnegat, Stafford, Lacey, Ocean/Waretown, Berkeley, and Toms River. Use the same provider relationships, support team, direct-mail routes, and local brand work.

### 2029: follow provider routes into affluent suburban clusters and a second state

Build through Monmouth, Middlesex, Somerset, Morris, Bergen, Rockland, and Westchester. Within those counties, prioritize the highest-scoring detached-home neighborhoods rather than opening whole municipalities uniformly. Reach roughly 20–25 service areas across New Jersey and New York. A second state is useful because it proves the compliance and operations pack, but most growth should still come from adjacency.

### 2030: complete the tri-state and Philadelphia test

Reach approximately 50–70 service areas across New Jersey, New York, Connecticut, and Pennsylvania. Operate six metro clusters: Jersey Shore, Central/North Jersey, Lower Hudson, Long Island, Fairfield/New Haven, and Philadelphia suburbs.

### 2031–2033: add metro pods, not isolated states

Expand through the Northeast corridor, then add a small number of Sun Belt metros to reduce winter seasonality. Prioritize metros with deep landscaping supply, suburban owner-occupied housing, enough provider fragmentation, and an accountable local pod. Examples for later scoring include Boston/Providence, Baltimore/DC/Northern Virginia, Charlotte/Raleigh, Atlanta, Tampa/Orlando, Dallas–Fort Worth, and selected Midwest metros.

## Recommended planning cases

| Case | 2033 service areas | States | Interpretation |
|---|---:|---:|---|
| Downside | 175–225 | 10–15 | Slow proof, high CAC, or delayed metro replication |
| Base | About 400 | About 25 | National multi-region footprint with controlled launch cadence |
| Upside | 750 | 40 | Current deck plan; requires a proven launch factory and strong follow-on capital |

A 750-area plan adds 350 service areas in 2033, approximately 29 launches per month. That is possible only if most launches are adjacent zones opened by standardized metro pods. It is not a credible base assumption while YardMatch is still proving its first market.

A 400-area base adds about 175 service areas in 2033, approximately 15 per month. Full continental coverage would follow in 2034–2036 rather than forcing thin supply across 40 states too early.

## Organization required to scale

Use a central platform team plus repeatable two-person metro launch pods.

- **Central:** product and data, growth systems, provider verification, trust and safety, support, finance, and compliance.
- **Metro pod:** one market lead and one provider-success/growth operator, with shared central support.
- **2027:** founder-led pilot, three paid staff.
- **2028:** one pod, approximately five staff total.
- **2029:** two pods, approximately eight to ten staff.
- **2030:** four pods, approximately fifteen staff.
- **2031:** eight pods, approximately twenty-five staff.
- **2032:** twelve to fifteen pods, approximately forty staff.
- **2033:** fifteen to twenty pods, approximately fifty to sixty staff.

At maturity, a pod should open roughly one adjacent service area per month while managing existing zone health. If it cannot do that without quality deterioration, the national schedule must slow.

## Market scoring model

Score every proposed metro and neighborhood zone out of 100:

| Factor | Weight | What to measure |
|---|---:|---|
| Affluent serviceable demand | 25 | Income, home value, owner occupancy, detached homes, lot-size proxy, outsourcing propensity |
| Provider supply and fragmentation | 25 | Landscaping establishments, small-firm share, service mix, available capacity |
| Adjacency and operating reuse | 20 | Provider route overlap, media halo, support distance, shared partners |
| Home turnover and customer entry points | 10 | Recent moves, home sales, realtor and property-manager partnerships |
| Observed unit economics | 10 | CAC, finder-fee realization, completion, support cost, subscription conversion |
| Operating complexity and seasonality | 10 | Licensing, insurance, state rules, climate, travel, support, and calendar diversification |

Affluence should determine which neighborhoods open first inside a cluster. Adjacency and provider supply determine whether YardMatch can serve them reliably. A distant wealthy neighborhood is less attractive than an affluent neighboring corridor that reuses trusted providers and the same acquisition channels.

## Management cadence

- Daily during launch: failed matches, late acceptances, cancellations, safety, and capacity.
- Weekly: zone scorecard, channel cohorts, provider pipeline, finder-fee collection, and support root causes.
- Monthly: area P&L, provider concentration, Pro conversion, and expansion budget release.
- Quarterly: re-rank metros, update the state compliance pack, and reset the national rollout using observed cohorts.
- Annually: measure paid second-season household retention before materially increasing the next year's launch count.

The central discipline is simple: **prove density, economics, and service quality in one cluster; copy the system into the next cluster; then accelerate the number of pods.**
