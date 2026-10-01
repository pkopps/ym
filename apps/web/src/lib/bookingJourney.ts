import type { Address, AvailabilitySlot, InstantQuoteResponse, MarketplaceProviderProfile, QuoteFollowUpAnswer, ServiceCategory } from "@yardmatch/contracts";
import { bookingScheduleWindowHour, bookingScheduleStartIso } from "@yardmatch/contracts";
import type { I18nInstance } from "@yardmatch/i18n";
import { createWebApiClient, loadStoredSession } from "./api";

export const serviceTimeZone = "America/New_York";
export type ArrivalWindow = "morning" | "afternoon" | "evening";
export const arrivalWindows: ArrivalWindow[] = ["morning", "afternoon", "evening"];
export type BookingDraft = {
  id: string;
  createdAt: number;
  ownerId?: string;
  provider: MarketplaceProviderProfile;
  address: Address;
  categories: ServiceCategory[];
  quotes: InstantQuoteResponse[];
  answers: Record<string, QuoteFollowUpAnswer[]>;
  slot: AvailabilitySlot;
  recommendationSessionId?: string;
  recommendedProviderId?: string;
  rank: number;
  directory: boolean;
  returnTo: string;
  bookingId?: string;
  confirmationAttempted?: boolean;
};

export function journeyApi() {
  const api = createWebApiClient();
  const session = loadStoredSession();
  if (session?.role === "customer") api.setAuthToken(session.token);
  return api;
}

export function serviceDay(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: serviceTimeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(iso));
  const part = (type: string) => parts.find(item => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function arrivalWindow(iso: string): ArrivalWindow {
  const hour = bookingScheduleWindowHour(iso);
  return hour === 7 ? "morning" : hour === 12 ? "afternoon" : "evening";
}
export function openingLabel(i18n: I18nInstance, iso: string) {
  return `${i18n.formatDate(iso, { timeZone: serviceTimeZone, weekday: "short", month: "short", day: "numeric" })} · ${i18n.t(`customer.window.${arrivalWindow(iso)}`)}`;
}
export function uniqueOpenings(slots: AvailabilitySlot[]) {
  const seen = new Set<string>();
  return slots.filter(slot => {
    const key = `${serviceDay(slot.startIso)}-${arrivalWindow(slot.startIso)}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}
export function availabilityRange(day: string, window: ArrivalWindow | "any") {
  if (!day) return undefined;
  const nextDay = new Date(`${day}T12:00:00Z`); nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  // New York is behind UTC and changes clocks after midnight. Resolve each day's
  // boundary separately so a date filter includes exactly that local date, even at DST.
  const midnight = (date: string) => {
    const utc = new Date(`${date}T00:00:00Z`);
    const localHour = Number(new Intl.DateTimeFormat("en-US", { timeZone: serviceTimeZone, hour: "numeric", hourCycle: "h23" }).format(utc));
    return new Date(utc.getTime() + (24 - localHour) * 3600000).toISOString();
  };
  const startIso = window === "afternoon" ? bookingScheduleStartIso(day, 12) : window === "evening" ? bookingScheduleStartIso(day, 16) : midnight(day);
  const endIso = window === "morning" ? bookingScheduleStartIso(day, 12) : window === "afternoon" ? bookingScheduleStartIso(day, 16) : midnight(nextDay.toISOString().slice(0, 10));
  return { startIso, endIso };
}
export function saveBookingDraft(draft: BookingDraft) {
  sessionStorage.setItem(`yardmatch-booking-draft:${draft.id}`, JSON.stringify(draft));
}
export function readBookingDraft(id: string): BookingDraft | undefined {
  try {
    const value = JSON.parse(sessionStorage.getItem(`yardmatch-booking-draft:${id}`) ?? "null") as BookingDraft | null;
    if (!value || value.id !== id || Date.now() - value.createdAt > 2 * 3600000 || !value.categories?.length || !value.slot || !value.address) return undefined;
    const user = loadStoredSession();
    if (value.ownerId && value.ownerId !== user?.userId) return undefined;
    return value;
  } catch { return undefined; }
}
