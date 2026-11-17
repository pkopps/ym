# Explorer: owner with two properties

- **Persona:** existing customer with a home in Barnegat and a second property.
- **Goal:** weekly mowing at the second property and a one-time cleanup at home, without mixing up the addresses.
- **Reached it:** no. Both requests went to the right property, but both were booked for tomorrow (Nov 17), not the dates I chose (Nov 25 and Nov 27). Each one holds the provider's whole 8am–5pm opening.
- **Steps:** 19.
- **Seed note:** the runner meant the second property to be a beach house in Manahawkin. Because of a seed bug this run got a randomly placed "Second home" in Toms River instead. The bug is fixed in the runner; the findings don't depend on the town.
- **Run folder:** `reports/explorer/runs/owner-two-properties-2026-11-16T23-38-25-568Z/`

## Steps taken
1. Logged in with the account in the brief; landed on "Welcome back, Owner." with only "Need service? Request service".
2. Clicked "Request service". Form: Property (Home / Second home), Service, When (Tomorrow morning … Choose date), Cadence (One-time / Every week / Every 2 weeks).
3. Chose Second home, Lawn mowing, Choose date → Nov 25 Morning, Every week. Clicked "Get price".
4. Saw "Lawn mowing • Nov 25 Morning • Every week", address 346 Route 9, Toms River, price $161.80, with tiles for Visit, Time, Confidence "low" and Yard size.
5. Saw the recommended match, Bot Lawn 3: "Morning • 7:00 AM - 12:00 PM", "Trust: 5 overall • 0 reviews", 9.0 mi, and "YardMatch picked this provider for service fit, trust history, and a real route opening".
6. Clicked "Start for $161.80". The plan started immediately, with no review step.
7. The dashboard showed "Next visit: Morning • 7:00 AM - 12:00 PM • Nov 17, 2026, 8:00 AM".
8. Checked the database: the plan's anchor and first visit are Nov 17, 8am to 5pm.
9. Went back to "Request service": Home, Seasonal cleanup, Choose date → Nov 27 Morning, One-time.
10. Got $196.17 and a match, Bot Lawn 2, "Morning • 7:00 AM - 12:00 PM".
11. Clicked "Request this time"; requested immediately.
12. Checked the database: the cleanup is also Nov 17, 8am to 5pm.
13. Dashboard: the main card shows the plan visit, "When: Morning • 7:00 AM - 12:00 PM" with no date. The cleanup sits under "Other visits" with no date and no address.
14. Opened "More options" on the main card: only "Get help". No reschedule or cancel.
15. Opened "Visit details" on the cleanup: address, schedule (Nov 17, 2026, 8:00 AM), Notes "Requested from the live YardMatch customer dashboard.", Payment "Not paid", New start / New end (8:00 AM to 5:00 PM), Reschedule, Cancel booking.
16. Clicked "Cancel booking".
17. The visit was cancelled at once: no confirmation and no cancellation terms.
18. The weekly plan's visit was untouched (good).
19. Captured the dashboard at both sizes.

## Findings

### 1. The date you choose is ignored; visits are booked for tomorrow (bug, high)
- **Repeat:** dashboard, Request service, When "Choose date" → a date next week, Get price, then "Start for …" or "Request this time".
- **Expected:** a visit on the chosen date.
- **Happened:** the booking is created for tomorrow, 8am (Nov 17). The price step and the match card both still show the chosen date ("Nov 25 Morning"). Reproduced twice (weekly plan and one-time cleanup).
- **Screenshots:** `02-request-form-1440x900.png`, `03-dashboard-after-1440x900.png`

### 2. A dashboard visit holds the provider's whole opening (corrected: product question, not a bug)
- **Correction:** openings are arrival windows (7–noon, noon–4, 4–8) and a booking reserves its window by design. The 8am–5pm span here came from the bot seed's nonstandard opening. Allowing several jobs per window would be a product decision.
- **Repeat:** as above; open "Visit details".
- **Happened:** a 123-minute mow and a 144-minute cleanup were each saved as 8:00 AM to 5:00 PM, the whole published opening. The provider can't take anything else that day, and the customer sees "Morning • 7:00 AM - 12:00 PM" while the visit is stored until 5 PM.

### 3. Weekly plan and request start with no review or confirmation (gap, high)
- **Repeat:** "Start for $161.80" or "Request this time".
- **Happened:** the plan or request is created on the first click: no summary of date, cadence, property and price, and no cancellation terms. Compare the public booking flow, which has a "Review and confirm" page.

### 4. Cancel booking has no confirmation and no terms (gap, high)
- **Repeat:** "Other visits", "Visit details", "Cancel booking".
- **Happened:** cancelled immediately. There's no "Are you sure?", no word on fees or how late you can cancel, and no undo.

### 5. Visit cards don't say which date or which property (gap, medium)
- **Happened:** the main card's "When" is a window with no date. "Other visits" shows neither date nor address; you have to open "Visit details". With two properties booked for the same morning, the cards look nearly identical.
- **Screenshot:** `03-dashboard-after-390x844.png`

### 6. Reschedule and cancel for one visit are hard to find (friction, medium)
- **Happened:** they exist only inside a collapsed "Visit details" on "Other visits". The main card's "More options" offers only "Get help". The plan card offers only "Cancel plan", which ends the whole plan.

### 7. Internal text shown to the customer (bug, medium; copy rules)
- **Happened:** Notes: "Requested from the live YardMatch customer dashboard." Also "Confidence: low" and "We estimate … with low confidence" on the price, and stat tiles (Visit, Time, Confidence, Yard size) the customer does not act on.

### 8. "Trust history" and "5 overall • 0 reviews" for a new provider (gap, high: trust)
- **Happened:** "YardMatch picked this provider for service fit, trust history, and a real route opening" for a provider with no completed jobs and no reviews.

### 9. Property picker shows labels, not addresses (friction, low)
- **Happened:** "Home" and "Second home" in the picker. The address appears only in the summary after "Get price". "Wrong service property?" does list addresses.

### 10. "Payment: Not paid" and "After provider confirms" (friction, medium)
- **Happened:** at launch the customer pays the provider directly, but the card reads as if YardMatch will collect payment later, and "Not paid" sounds like something is overdue.

### 11. An active plan sits under "Book again" (friction, low)
- **Happened:** the weekly plan's card is under a "Book again" heading; the confirmation banner starts with lower case ("every week plan started with Bot Lawn 3").

## Places I had to guess
- Whether the visit was on the date I picked (the dashboard never showed the date on the card).
- Whether cancelling the cleanup would touch the plan (it did not).

## Confirmations and emails
- An in-page "Done" banner after each request; the notification bell went to 3. No email checked (no mail vendor locally).

## Earlier first-time-owner finding 9
With the web app and API both on the launch flags, the dashboard loads ("Welcome back, Owner."). The "Route not found" failure in the first-time-owner run came from the runner's mismatched flags.
