import type { Address, Booking, CustomerProfile, ProviderClientProperty, RecurringServicePlan } from "@yardmatch/contracts";

// Use booked addresses, never a customer's unrelated saved properties. Including
// the unit keeps separate homes separate; coordinates can change after geocoding.
function propertyKey(customerId: string, address: Address): string {
  return JSON.stringify([customerId, ...[
    address.line1, address.line2 ?? "", address.city, address.state, address.postalCode, address.country
  ].map((value) => value.trim().toLocaleLowerCase("en-US").replace(/\s+/g, " "))]);
}

export function buildProviderClientProperties(
  providerId: string,
  bookings: Booking[],
  customers: CustomerProfile[],
  plans: RecurringServicePlan[],
  now = Date.now()
): ProviderClientProperty[] {
  const names = new Map(customers.map((customer) => [customer.id, customer.fullName]));
  const recurringKeys = new Set(plans.filter((plan) => plan.providerId === providerId && plan.status === "active")
    .map((plan) => propertyKey(plan.customerId, plan.serviceAddress)));
  const grouped = new Map<string, Booking[]>();
  for (const booking of bookings) {
    if (booking.providerId !== providerId || booking.status === "cancelled") continue;
    const key = propertyKey(booking.customerId, booking.serviceAddress);
    const group = grouped.get(key) ?? [];
    group.push(booking);
    grouped.set(key, group);
  }
  return [...grouped.entries()].map(([key, visits]) => {
    visits.sort((a, b) => a.scheduledStartIso.localeCompare(b.scheduledStartIso) || a.id.localeCompare(b.id));
    const latest = visits[visits.length - 1];
    const completed = visits.filter((visit) => visit.status === "completed");
    const lastCompleted = completed.at(-1);
    return {
      id: visits[0].id,
      customerName: names.get(latest.customerId) ?? "—",
      address: latest.serviceAddress,
      recurring: recurringKeys.has(key),
      completedVisitCount: completed.length,
      lastCompletedAt: lastCompleted?.completedAt ?? lastCompleted?.scheduledEndIso,
      upcomingVisits: visits.filter((visit) =>
        (visit.status === "requested" || visit.status === "confirmed" || visit.status === "in-progress") &&
        (Date.parse(visit.scheduledEndIso) >= now || visit.status === "in-progress")
      ).map((visit) => ({
        bookingId: visit.id, category: visit.category, status: visit.status,
        scheduledStartIso: visit.scheduledStartIso, scheduledEndIso: visit.scheduledEndIso
      }))
    };
  }).sort((a, b) => a.customerName.localeCompare(b.customerName) || a.address.line1.localeCompare(b.address.line1));
}
