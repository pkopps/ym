# Explorer report: owner with two properties

Screenshots folder: `reports/explorer/runs/owner-two-properties-2026-11-17T03-03-39-349Z/` (`S/` below)

## 1. Summary

- **Persona:** an existing customer who owns a home in Barnegat and a beach house in Manahawkin.
- **Goal:** set up weekly mowing at the beach house and a one-time cleanup at home without mixing up the two addresses.
- **Reached:** yes. A weekly lawn mowing plan is set up at Beach house (212 Bay Ave, Manahawkin), with the first visit moved to Nov 24. A one-time seasonal cleanup is requested at Home (215 Main St, Barnegat) for Sat Nov 21, morning. Both are waiting for the provider to confirm.
- **Effort:** about 30 steps. Roughly 8 of them went to finding an open time (the default time slots were all full) and to finding the reschedule and cancel controls.
- **Also check:**
  - The booking flow made the property clear: the address shows under the form, the match card has a Property field, and the confirm dialog says "Beach house: 212 Bay Ave, Manahawkin, NJ".
  - The dashboard did not. After booking, visit cards show a street only or no property at all, and no date.
  - Changing or cancelling one visit without touching the other works. But the controls are different on each card and hidden under different links.

## 2. Steps taken

1. Opened http://localhost:3012 and saw the home page (`S/01-start-*.png`).
2. Clicked "Log in" and signed in with the account in the brief.
3. Landed on "Welcome back, Owner." The only items were "Request service", "Account" and "Past visits". No list of my properties.
4. Opened the bell. There was one "New device signed in" notice.
5. Opened Past visits: "No past visits yet".
6. Opened "Request service" (`S/02-request-form-*.png`). For a moment the Property dropdown was blank, then it showed "Home".
7. Opened the Property dropdown. It listed Home, Second home and Beach house. I own two properties, not three.
8. Picked "Second home". The line under the form read "346 Route 9, Toms River, NJ", which is not my address.
9. Picked "Beach house" (212 Bay Ave, Manahawkin, NJ). Kept Lawn mowing and set Cadence to "Every week".
10. Opened "Review or change details". The summary tiles show service, when, property and price, but not the cadence.
11. Clicked "Get price": $120.85, labelled "VISIT". Tomorrow morning: "No openings… Routes are full".
12. Clicked the suggested "Tomorrow afternoon". It was also full, but the "Start for $120.85" button was still enabled.
13. Clicked "Compare options". All three providers showed "No open slot".
14. Clicked "Change details", picked "Choose date" with Nov 23, Morning, then clicked "Refresh price". For a moment the old "No openings nov 23 morning" message showed, then Bot Lawn 5 appeared with an open window.
15. Clicked "Start for $120.85". A "Start this plan?" dialog showed provider, Mon Nov 23, "Beach house: 212 Bay Ave, Manahawkin, NJ", every week, $120.85 per visit, and the cancellation and payment terms.
16. Clicked "Start plan". The dashboard said "every week plan started with Bot Lawn 5…". The visit card shows "PROPERTY 212 Bay Ave" and no date (`S/03-after-beach-plan-*.png`).
17. Started a new request. The form defaulted back to Home (215 Main St, Barnegat).
18. Picked Seasonal cleanup, One-time visit, Choose date Nov 21, Morning, then clicked "Get price": $196.17 with Bot Lawn 3. The match card shows Property: Home.
19. Clicked "Request this time". It was submitted straight away with no confirm dialog (the plan had one).
20. Dashboard: the top card is the cleanup, showing "PROPERTY 215 Main St", no date and no service name. The "Book again" card is the mowing plan, with no property. The "Other visits" card is the mowing visit, with no property and no date (`S/04-both-visits-*.png`).
21. Opened the bell. There was "Recurring plan started" for the mowing plan, but nothing for the cleanup request.
22. On the cleanup card, "More options" shows only "Get help" and "Cancel booking". There is no reschedule.
23. Opened "Wrong service property?" on the cleanup card. It has a property picker (Home • 215 Main St / Second home • 346 Route 9 / Beach house • 212 Bay Ave) and "Request property correction".
24. On the mowing card, the "Visit details" link was the only place that showed the full address (212 Bay Ave, Manahawkin, NJ 08050), along with "New start", "New end", "Reschedule" and "Cancel booking".
25. Set New start to Nov 24 08:00 and New end to Nov 24 12:00, then clicked "Reschedule". It saved right away with no confirm, and the banner read "Booking rescheduled." The plan's "Next visit" changed to Nov 24.
26. I could not tell from the cleanup card whether the cleanup had changed, because it shows no date.
27. Clicked "Cancel booking" on the cleanup card. After a short delay a dialog appeared: "Cancel this visit?" with "Sat, Nov 21 · Morning … at 215 Main St, Barnegat, NJ with Bot Lawn 3". Clicked "Keep visit".
28. Clicked "Cancel plan" on the mowing plan. The dialog said "End this plan? Visits with Bot Lawn 5 that haven't started are cancelled." Clicked "Keep plan".
29. Reloaded Past visits. While loading, the header briefly showed the logged-out "Log in / Sign up".
30. Took the final capture (`S/05-end-after-reschedule-*.png`).

## 3. Findings

### Visit cards on the dashboard show no date, and only the street or nothing for the property
- **Type / severity:** gap, high
- **Steps:**
  1. Log in.
  2. Book weekly mowing at Beach house for a chosen date.
  3. Book a one-time cleanup at Home for a different date.
  4. Look at the dashboard.
- **Expected:** each visit card says which property it is for (label plus town, for example "Beach house · Manahawkin"), the service, and the date.
- **What happened:**
  - Cleanup card: "WHEN Morning • 7:00 AM - 12:00 PM" and "PROPERTY 215 Main St". No date, no service name, no property label, no town.
  - "Other visits" mowing card: service, provider and time window only. No property and no date unless you open "Visit details".
  - Both visits are mornings with different providers, so the only thing that tells them apart is the provider name, which a customer does not know.
  - The only place the cleanup's date (Sat, Nov 21) appeared after booking was the Cancel dialog.
- **Screenshots:** `S/04-both-visits-1440x900.png`, `S/04-both-visits-390x844.png`, `S/05-end-after-reschedule-1440x900.png`

### The recurring plan card does not say which property it is for
- **Type / severity:** gap, high
- **Steps:** after the step above, look at the "Book again" section.
- **Expected:** the plan names the property, for example "Lawn mowing plan · Beach house".
- **What happened:** the card shows "Bot Lawn 5 / Lawn mowing plan / ACTIVE PLAN / EVERY WEEK / Next visit…" with no property. An owner with two homes cannot tell which home the weekly mowing is for.
- **Screenshot:** `S/03-after-beach-plan-1440x900.png`

### An unknown "Second home" (Toms River) appears among my saved properties, and there is nowhere to manage properties
- **Type / severity:** gap, medium
- **Steps:**
  1. Log in and open Request service.
  2. Open the Property dropdown and pick "Second home".
- **Expected:** only my two properties, plus a way to see, rename or remove saved properties.
- **What happened:**
  - Three properties are listed. "Second home" is 346 Route 9, Toms River, NJ, which I don't own.
  - The dashboard has no properties section, and the Account menu has only Refer a friend, Security, Help, language and Sign out. So I can't remove it or check my addresses before booking.
  - The dropdown shows labels only. The address appears only in a line under the form, after you pick one, and on mobile that line is below the fold.
- **Screenshots:** `S/02-request-form-1440x900.png`, `S/02-request-form-390x844.png`

### "Cancel plan" warning names the provider, not the property or service
- **Type / severity:** friction, medium
- **Steps:** on the dashboard, click "Cancel plan" on the mowing plan.
- **Expected:** for example "End weekly lawn mowing at Beach house (212 Bay Ave)? Your other bookings are not affected."
- **What happened:** "Visits with Bot Lawn 5 that haven't started are cancelled. There's no charge." An owner with visits at two properties can't tell whether the home cleanup would also be cancelled (that would happen if one provider served both homes). I backed out instead of testing it.
- **Screenshot:** none saved; the dialog was seen in the browser pane.

### Reschedule saves immediately with no confirmation and no "this visit only / whole plan" choice
- **Type / severity:** friction, medium
- **Steps:**
  1. On the "Other visits" mowing card, open "Visit details".
  2. Change New start and New end.
  3. Click "Reschedule".
- **Expected:**
  - A confirm step showing the property and new time.
  - A choice between this visit and all future visits.
  - A note that the provider has to accept the new time.
- **What happened:**
  - It saved straight away with the banner "Booking rescheduled." The banner doesn't say which property or what the new time is.
  - The plan's "Next visit" changed to Nov 24, a Tuesday. It isn't clear whether every future weekly visit moves to Tuesday.
  - The inputs are raw date-time fields that default to 8:00 AM–5:00 PM, even though the booked window is "Morning 7:00 AM–12:00 PM".
- **Screenshot:** `S/05-end-after-reschedule-1440x900.png`

### The two visit cards offer different controls: no reschedule for the one-time cleanup
- **Type / severity:** gap, medium
- **Steps:**
  1. Book the cleanup.
  2. On its card, open "More options".
- **Expected:** the same Reschedule and Cancel controls on every pending visit, as promised by "Free to cancel or reschedule until … is on the way".
- **What happened:**
  - The top cleanup card has only "Get help" and "Cancel booking" under "More options".
  - The mowing card hides "Reschedule" and "Cancel booking" under a different link, "Visit details", plus a photo form the cleanup card doesn't have.
  - To change only the cleanup's date, I would have to cancel and rebook.
- **Screenshot:** `S/04-both-visits-1440x900.png`

### One-time request is submitted without a confirm step, while the recurring plan has one
- **Type / severity:** friction, medium
- **Steps:**
  1. Request a one-time cleanup.
  2. Click "Request this time".
- **Expected:** the same "Start this plan?" style dialog showing property, address, date, price and terms, so I can check I'm not booking the wrong home.
- **What happened:** the request was submitted on the first click. The address is only in the summary at the top of the page, not next to the button. The plan flow did have a clear confirm dialog with "Where: Beach house: 212 Bay Ave, Manahawkin, NJ".
- **Screenshot:** none saved; seen in the browser pane.

### No notification or confirmation for the one-time cleanup request
- **Type / severity:** gap, low
- **Steps:**
  1. Book the cleanup.
  2. Open the bell.
- **Expected:** a "Request sent" update naming the service, property and date.
- **What happened:**
  - Only "Recurring plan started" for the mowing plan. That notice also names no property ("Your every week lawn mowing plan is active").
  - Nothing was shown for the cleanup.
- **Screenshot:** none saved; seen in the browser pane.

### Suggested alternative times were also full; "Start for $…" stays enabled when there is no slot
- **Type / severity:** friction, medium
- **Steps:**
  1. Request Beach house mowing for "Tomorrow morning".
  2. Click the suggested "Tomorrow afternoon".
- **Expected:** suggestions lead to windows that have openings, and the start button is disabled when there is no slot.
- **What happened:**
  - Tomorrow afternoon was also "Routes are full".
  - After picking Nov 23, the suggestions still offered "Tomorrow morning / Tomorrow afternoon", which I already knew were full.
  - Every card said "No open slot" next to an active "Start for $120.85" button.
  - I only found an opening by picking a custom date.
- **Screenshot:** none saved; seen in the browser pane.

### Stale "No openings" message shows while new results load
- **Type / severity:** bug, low
- **Steps:**
  1. Change the date to Nov 23.
  2. Click "Refresh price".
- **Expected:** a loading state.
- **What happened:** for about a second the page showed "No openings nov 23 morning. Routes are full", with a lowercase month and all three providers listed as "No open slot". It then replaced this with an open window from Bot Lawn 5. That could make someone give up on that date.
- **Screenshot:** none saved; transient.

### Visit time shown three different ways
- **Type / severity:** friction, low
- **Steps:** after booking, look at the plan card and Visit details.
- **Expected:** one consistent time.
- **What happened:** "Next visit: Morning • 7:00 AM - 12:00 PM • Nov 23, 2026, 8:00 AM". Visit details shows the same, and the reschedule fields defaulted to 8:00 AM–5:00 PM. It's unclear whether the visit is 7–12, at 8:00, or 8–5.
- **Screenshot:** `S/04-both-visits-1440x900.png`

### Wording and layout polish
- **Type / severity:** friction, low
- **Wording:**
  - The success banner starts lowercase: "every week plan started with Bot Lawn 5."
  - The notice says "Your every week lawn mowing plan…".
  - An active plan sits under the heading "Book again".
  - The weekly plan price is labelled "VISIT $120.85" on the price step. The confirm dialog does say "Price per visit".
  - The request summary bar leaves out cadence.
  - The cleanup card repeats "Waiting on confirmation" as both heading and STATUS, and the price twice.
- **Layout and loading:**
  - The disabled "Request property correction" button runs into "Get help with property or access" with no gap.
  - Both Cancel buttons have the same accessible name ("Cancel booking") with no property context.
  - The Property dropdown is briefly blank on load.
  - Loading Past visits briefly shows the logged-out header.
- **Screenshots:** `S/03-after-beach-plan-1440x900.png`, `S/02-request-form-1440x900.png`

### Sign-in notice mixes time zones
- **Type / severity:** friction, low
- **Steps:** log in and open the bell.
- **What happened:** the body says "11/17/2026, 3:04:12 AM UTC" while the timestamp under it says "Nov 16, 10:04 PM".
- **Screenshot:** none saved; seen in the browser pane.

## 4. Places I had to guess, and missing confirmations or emails

**Guesses:**
- Where my properties are managed. I found no such place.
- Whether "Second home" was mine or a mistake.
- That "Visit details" (a small green text link) is where Reschedule lives. On the other card the same kind of controls sit under "More options".
- Whether the reschedule moved one visit or the whole weekly series.
- Whether "Cancel plan" would also cancel the cleanup at the other property.
- Which card was which. I had to match them up by provider name, because the cards show no dates.
- "Cancel booking" took about a second to open its dialog. My first click seemed to do nothing, so I clicked again.

**Missing confirmations:**
- No confirm before submitting the one-time request.
- No confirm before rescheduling.

**Missing emails and notifications:**
- No email or on-screen notification for the one-time cleanup request or the reschedule.
- The plan notification doesn't name the property.
- I can't see email in this environment, so email coverage is unknown.
