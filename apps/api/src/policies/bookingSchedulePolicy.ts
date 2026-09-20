import type { Booking } from "@yardmatch/contracts";

export function resolveScheduleUpdates(current: Booking, updates: Partial<Booking>): Booking["scheduleUpdates"] {
  if (updates.scheduleUpdates) return updates.scheduleUpdates;
  const resolved = Boolean(updates.onRouteConfirmedAt) ||
    (updates.status !== undefined && ["completed", "cancelled", "refunded", "disputed"].includes(updates.status)) ||
    (updates.scheduledStartIso !== undefined && updates.scheduledStartIso !== current.scheduledStartIso) ||
    (updates.scheduledEndIso !== undefined && updates.scheduledEndIso !== current.scheduledEndIso);
  if (!resolved) return current.scheduleUpdates;
  return current.scheduleUpdates?.map(item => ["active", "declined"].includes(item.state)
    ? { ...item, state: "resolved", updatedAt: new Date().toISOString() } : item);
}
