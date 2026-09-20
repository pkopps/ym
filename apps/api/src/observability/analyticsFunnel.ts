import type { AnalyticsEvent } from "@yardmatch/contracts";
const steps = ["page_viewed", "quote_evaluated", "provider_search_performed", "recommendation_presented",
  "booking_requested", "booking_confirmed", "payment_captured", "booking_completed"];

/** Ordered, person-level cohorts. Business outcomes must come from the server. */
export function buildAnalyticsFunnel(events: AnalyticsEvent[]) {
  const anonymousOwners = new Map<string, string>();
  const bookingOwners = new Map<string, string>();
  for (const event of events) {
    if (event.name === "journey_identified" && event.actorId && event.properties.anonymousId) {
      anonymousOwners.set(String(event.properties.anonymousId), event.actorId);
    }
    if (event.name === "booking_requested" && event.actorId && event.properties.bookingId && event.properties.origin !== "client") {
      bookingOwners.set(String(event.properties.bookingId), event.actorId);
    }
  }
  const people = new Map<string, AnalyticsEvent[]>();
  for (const event of events) {
    const id = event.properties.origin !== "client" && event.properties.customerId ? String(event.properties.customerId)
      : event.properties.origin !== "client" && event.properties.bookingId && bookingOwners.has(String(event.properties.bookingId)) ? bookingOwners.get(String(event.properties.bookingId))!
      : event.actorId && event.actorId !== "anonymous" ? bookingOwners.get(event.actorId) ?? event.actorId
      : anonymousOwners.get(String(event.properties.anonymousId)) ?? String(event.properties.anonymousId ?? event.id);
    const history = people.get(id) ?? []; history.push(event); people.set(id, history);
  }
  const reached = steps.map(() => 0);
  const segments: Record<string, {visitors: number; requested: number; completed: number}> = {};
  const reasons: Record<string, number> = {};
  let returningCustomers = 0;
  for (const history of people.values()) {
    history.sort((a,b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));
    let cursor = -Infinity;
    let stepIndex = 0;
    for (const step of steps) {
      const event = history.find(item => (item.name === step || (step === "page_viewed" && item.name === "screen_viewed") ||
        (step === "quote_evaluated" && ["instant_quote_generated", "instant_quote_needs_follow_up"].includes(item.name))) && Date.parse(item.occurredAt) >= cursor &&
        (step === "page_viewed" || item.properties.origin !== "client"));
      if (!event) break;
      cursor = Date.parse(event.occurredAt); reached[stepIndex++]++;
    }
    const entry = history.find(event => ["page_viewed", "screen_viewed"].includes(event.name));
    if (entry) for (const dimension of ["source", "platform", "locale", "category", "area"]) {
      const value = entry.properties[dimension] ?? history.map(event => event.properties[dimension] ??
        (dimension === "category" ? event.properties.serviceCategory : undefined)).find(item => item !== undefined) ?? "unknown";
      const segment = `${dimension}:${value}`;
      const row = segments[segment] ?? {visitors: 0, requested: 0, completed: 0};
      row.visitors++;
      if (history.some(event => event.name === "booking_requested" && event.properties.origin !== "client")) row.requested++;
      if (history.some(event => event.name === "booking_completed" && event.properties.origin !== "client")) row.completed++;
      segments[segment] = row;
    }
    if (new Set(history.filter(event => event.name === "booking_completed" && event.properties.origin !== "client").map(event => event.properties.bookingId ?? event.id)).size > 1) returningCustomers++;
    for (const event of history) if (["provider_search_no_results", "provider_search_no_open_windows", "payment_failed", "booking_declined_by_provider", "journey_feedback", "form_validation_failed"].includes(event.name)) {
      const key = String(event.properties.reason ?? event.name);
      reasons[key] = (reasons[key] ?? 0) + 1;
    }
  }
  return {steps: steps.map((name, index) => ({name, people: reached[index],
    previousStepPeople: index ? reached[index - 1] : reached[0],
    conversionRate: index && reached[index - 1] ? reached[index] / reached[index - 1] : null})),
    segments, reasons, returningCustomers, lowSample: reached[0] < 30};
}
