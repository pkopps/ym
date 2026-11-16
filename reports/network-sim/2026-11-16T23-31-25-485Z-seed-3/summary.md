# Network simulation, Barnegat, NJ

Seed 3. 150 owners, 2 requests each over 36 simulated hours; service radius 8–20 miles; providers take at most 5 jobs a day and publish 8am–5pm on about three days in four for 21 days; 2 crew per provider.
Invented supply and demand on the real matching rules. It shows where the rules strain; it does not predict the real market.

| Measure | 5 providers | 15 providers | 40 providers |
| --- | ---: | ---: | ---: |
| Search fill rate (at least one bookable provider) | 74% | 100% | 100% |
| Requests that ended in a booking | 74% | 100% | 100% |
| Dead zones (ZIPs under 50% fill) | 08092 West Creek, 08753 Toms River | none | none |
| Unmatched: no provider offers it in range / providers but no open slot | 50 / 28 | 0 / 0 | 0 / 0 |
| Bookings accepted by the end | 92% of 157 | 100% of 218 | 100% of 223 |
| Time to acceptance, median / p90 (sim hours) | 2 / 6 | 0 / 3 | 0 / 3 |
| Accepted within 4 hours | 75% | 98% | 96% |
| Provider utilization, median / max (booked ÷ published hours) | 30% / 41% | 14% / 30% | 3% / 23% |
| Share of jobs held by the top fifth of providers | 28% | 38% | 68% |
| Gini of jobs per provider (0 even, 1 one provider) | 0.2 | 0.3 | 0.7 |
| Providers with no jobs | 0 | 0 | 15 |
| Miles from provider base to property, median / p90 | 3 / 8 | 2 / 6.1 | 1.2 / 5.1 |
| Route miles per job on a working day, median | 5.6 | 3.4 | 2.4 |
| Jobs per active provider-day, median | 2 | 1 | 1 |
| Crew fill rate (accepted jobs reaching required crew) | 89% of 144 | 98% of 217 | 100% of 222 |
| Crew fill time, median (sim hours after acceptance) | 0 | 1 | 0 |
| Recovery rate (declined visits that got a replacement) | 64% (21 of 33) | 100% (11 of 11) | 100% (15 of 15) |

## Fill rate by ZIP

| ZIP | 5 providers | 15 providers | 40 providers |
| --- | ---: | ---: | ---: |
| 08005 Barnegat | 76% (109) | 100% (81) | 100% (96) |
| 08050 Manahawkin | 84% (51) | 100% (42) | 100% (55) |
| 08758 Waretown | 77% (30) | 100% (30) | 100% (21) |
| 08731 Forked River | 89% (19) | 100% (48) | 100% (39) |
| 08734 Lanoka Harbor | 69% (26) | 100% (7) | 100% (24) |
| 08092 West Creek | 44% (16) | 100% (19) | 100% (7) |
| 08087 Tuckerton | 70% (23) | 100% (20) | 100% (19) |
| 08008 Beach Haven | 64% (11) | 100% (22) | 100% (23) |
| 08721 Bayville | 75% (4) | 100% (8) | 100% (5) |
| 08753 Toms River | 45% (11) | 100% (23) | 100% (11) |

Maps: `map-providers-5.svg`, `map-providers-15.svg`, `map-providers-40.svg` (green: request matched; red: no bookable provider; circles: provider service radius).
