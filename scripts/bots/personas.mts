import { ApiError, BotClient } from "./client.mts";
import { addressIn, lawnSize, pickZone, type BotAddress, type Zone } from "./market.mts";
import type { RunRecorder } from "./recorder.mts";
import { sleep, type Rng } from "./random.mts";

/* eslint-disable @typescript-eslint/no-explicit-any -- bots read loosely typed JSON responses */

export const ONE_PIXEL_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+Av7czgAAAABJRU5ErkJggg==";
export const BOT_PASSWORD = "Bot-Local-Only-7rT!q2";
const HOUR = 3_600_000;

export interface Timing {
  minDelayMs: number;
  maxDelayMs: number;
}

export interface BotSettings {
  baseUrl: string;
  runId: string;
  recorder: RunRecorder;
  timing: Timing;
  zones: Zone[];
  /** Provider service radius range in miles. */
  radiusMiles: [number, number];
  /** Days of availability each provider publishes. */
  horizonDays: number;
  /**
   * Moves a visit into the window when its route, work start and completion are allowed (from 3 hours before the
   * visit). The run compresses a season into minutes, so it does this in the local test database before working one.
   */
  bringVisitIntoWindow?: (bookingId: string) => Promise<void>;
}

export interface ProviderBot {
  id: string;
  email: string;
  client: BotClient;
  rng: Rng;
  address: BotAddress;
  staffingMode: "auto-accept" | "review-first";
  acceptRate: number;
  publishedHours: number;
}

export interface OwnerBot {
  id: string;
  email: string;
  client: BotClient;
  rng: Rng;
  properties: Array<{ id: string; address: BotAddress; lawnSizeSqFt: number }>;
}

export interface CrewBot {
  id: string;
  email: string;
  client: BotClient;
  rng: Rng;
}

export async function pause(rng: Rng, timing: Timing) {
  if (timing.maxDelayMs > 0) await sleep(rng.int(timing.minDelayMs, timing.maxDelayMs));
}

/** Next local (America/New_York, approximated as UTC-5) day at the given hour, `days` from now. */
export function localDayAt(days: number, hour: number): Date {
  const date = new Date(Date.now() + days * 24 * HOUR);
  date.setUTCHours(hour + 5, 0, 0, 0);
  return date;
}

const email = (settings: BotSettings, kind: string, index: number) => `${settings.runId}-${kind}-${index}@example.invalid`;

export async function signUpOps(settings: BotSettings, ops: { email: string; password: string }): Promise<BotClient> {
  const client = new BotClient(settings.baseUrl, settings.recorder, "ops", "ops");
  const login = await client.post<any>("/api/auth/login", ops, { action: "login" });
  client.token = login.session.token;
  return client;
}

const CATEGORY_SETS: string[][] = [
  ["lawn-mowing"], ["lawn-mowing", "hedge-trimming"], ["lawn-mowing", "leaf-blowing", "seasonal-cleanup"],
  ["lawn-mowing", "mulch-installation", "hedge-trimming"]
];

export async function signUpProvider(settings: BotSettings, ops: BotClient, rng: Rng, index: number, zone?: Zone): Promise<ProviderBot> {
  const client = new BotClient(settings.baseUrl, settings.recorder, "provider", `provider-${index}`);
  const address = addressIn(rng, zone ?? pickZone(rng, settings.zones), 2);
  const mail = email(settings, "provider", index);
  const registered = await client.post<any>("/api/auth/register", {
    role: "provider", fullName: `Provider ${index}`, email: mail, password: BOT_PASSWORD, phone: `555-02${String(index).padStart(2, "0")}`,
    address, companyName: `Bot Lawn ${index}`, bio: "Insured local lawn and property care with careful arrivals and complete proof of work.",
    yearsExperience: rng.int(1, 20), serviceRadiusMiles: rng.int(settings.radiusMiles[0], settings.radiusMiles[1]), categories: rng.pick(CATEGORY_SETS)
  }, { action: "sign up" });
  client.token = registered.session.token;
  const id = registered.user.id as string;
  await pause(rng, settings.timing);
  for (const type of ["business-registration", "general-liability-insurance", "workers-compensation"]) {
    const profile = await client.post<any>("/api/providers/credentials", { type, jurisdiction: "NJ", referenceNumber: `bot-${type}-${index}`, expiresAt: "2099-01-01T00:00:00Z" }, { action: "submit credential" });
    const credential = profile.credentials.find((item: any) => item.type === type);
    await ops.post("/api/providers/credentials/review", { providerId: id, credentialId: credential.id, action: "verify" }, { action: "verify credential" });
  }
  await ops.post("/api/providers/verification/review", { providerId: id, action: "approve",
    notes: "Reviewed category coverage, insurance, service area, profile and operational controls. Approved for the stated categories." }, { action: "approve provider" });
  const staffingMode = rng.chance(0.5) ? "auto-accept" : "review-first";
  const settingsBody = { serviceRadiusMiles: registered.user.serviceRadiusMiles, staffingMode, routeLeaderMode: rng.chance(0.4) ? "accepted-crew-fallback" : "provider-only" };
  await client.attempt(() => client.post("/api/providers/settings", settingsBody, { action: "update settings" }));
  const bot: ProviderBot = { id, email: mail, client, rng, address, staffingMode, acceptRate: 0.75 + rng.next() * 0.2, publishedHours: 0 };
  await publishAvailability(settings, bot);
  return bot;
}

/** Publishes 8am-5pm openings on most days of the horizon. */
export async function publishAvailability(settings: BotSettings, bot: ProviderBot) {
  for (let day = 1; day <= settings.horizonDays; day += 1) {
    if (bot.rng.chance(0.25)) continue;
    const start = localDayAt(day, 8), end = localDayAt(day, 17);
    const ok = await bot.client.attempt(() => bot.client.post("/api/providers/availability/manage", { action: "add", startIso: start.toISOString(), endIso: end.toISOString() }, { action: "add availability" }));
    if (ok) bot.publishedHours += 9;
  }
}

export async function signUpCrew(settings: BotSettings, rng: Rng, index: number): Promise<CrewBot> {
  const client = new BotClient(settings.baseUrl, settings.recorder, "crew", `crew-${index}`);
  const mail = email(settings, "crew", index);
  const registered = await client.post<any>("/api/auth/register", {
    role: "crew-member", fullName: `Crew ${index}`, email: mail, password: BOT_PASSWORD, phone: `555-03${String(index).padStart(2, "0")}`,
    address: addressIn(rng, pickZone(rng, settings.zones), 3), categories: rng.pick(CATEGORY_SETS),
    availableWeekdays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].filter(() => rng.chance(0.75)),
    willingToTravelMiles: rng.int(8, 25), preferredSchedule: rng.pick(["mornings", "afternoons", "flexible"]), hasOwnEquipment: rng.chance(0.5)
  }, { action: "sign up" });
  client.token = registered.session.token;
  return { id: registered.user.id, email: mail, client, rng };
}

export async function signUpOwner(settings: BotSettings, rng: Rng, index: number, zone?: Zone): Promise<OwnerBot> {
  const client = new BotClient(settings.baseUrl, settings.recorder, "owner", `owner-${index}`);
  const mail = email(settings, "owner", index);
  const address = addressIn(rng, zone ?? pickZone(rng, settings.zones));
  const size = lawnSize(rng);
  const registered = await client.post<any>("/api/auth/register", {
    role: "customer", fullName: `Owner ${index}`, email: mail, password: BOT_PASSWORD, phone: `555-04${String(index % 100).padStart(2, "0")}`,
    address, propertyLabel: "Home", lawnSizeSqFt: size
  }, { action: "sign up" });
  client.token = registered.session.token;
  const property = registered.user.properties[0];
  const owner: OwnerBot = { id: registered.user.id, email: mail, client, rng, properties: [{ id: property.id, address: property.address, lawnSizeSqFt: size }] };
  if (rng.chance(0.25)) {
    const second = addressIn(rng, pickZone(rng, settings.zones));
    const secondSize = lawnSize(rng);
    const result = await client.attempt(() => client.post<any>("/api/customers/properties", { label: "Second home", address: second, lawnSizeSqFt: secondSize }, { action: "add property" }));
    const created = result && (result.properties ?? [result]).find((item: any) => item.label === "Second home");
    if (created) owner.properties.push({ id: created.id, address: created.address, lawnSizeSqFt: secondSize });
  }
  return owner;
}

export interface SearchOutcome {
  ranked: Array<{ providerId: string; distanceMiles: number; slot?: { startIso: string; endIso: string } }>;
}

export async function search(owner: OwnerBot, property: OwnerBot["properties"][number], category: string, dateIso: string): Promise<SearchOutcome> {
  const result = await owner.client.post<any>("/api/providers/search", { address: property.address, categories: [category], dateIso, requestSource: "bot" }, { action: "search" });
  return {
    ranked: (result.rankedProviders ?? []).map((item: any) => ({
      providerId: item.provider.id, distanceMiles: item.distanceMiles,
      slot: item.suggestedSlot ? { startIso: item.suggestedSlot.startIso, endIso: item.suggestedSlot.endIso } : undefined
    }))
  };
}

export interface BookingDraft {
  providerId: string;
  property: OwnerBot["properties"][number];
  category: string;
  startIso: string;
  endIso: string;
}

async function quote(owner: OwnerBot, draft: BookingDraft) {
  return owner.client.post<any>("/api/quotes/instant", { address: draft.property.address, category: draft.category, propertyId: draft.property.id, providerId: draft.providerId }, { action: "quote" });
}

export async function book(owner: OwnerBot, draft: BookingDraft, options: { recurring?: "weekly" | "biweekly"; requestId?: string; action?: string; expect?: number[] } = {}): Promise<any> {
  const priced = await quote(owner, draft);
  const body = {
    quoteToken: priced.quoteToken, providerId: draft.providerId, serviceAddress: draft.property.address, servicePropertyId: draft.property.id,
    category: draft.category, scheduledStartIso: draft.startIso, scheduledEndIso: draft.endIso, notes: "", totalCents: priced.estimatedPriceCents,
    ...(options.requestId ? { requestId: options.requestId } : {}), ...(options.recurring ? { frequency: options.recurring } : {})
  };
  return owner.client.post<any>(options.recurring ? "/api/bookings/recurring-plans" : "/api/bookings", body, { action: options.action ?? (options.recurring ? "book recurring" : "book one-time"), expect: options.expect });
}

/** The booking a recurring plan created: the plan response may return the plan or its first booking. */
export function bookingIdFromCreate(result: any): string | undefined {
  return result?.booking?.id ?? result?.firstBooking?.id ?? (result?.customerId && result?.scheduledStartIso ? result.id : undefined) ?? result?.bookings?.[0]?.id;
}

export async function listProviderBookings(provider: ProviderBot): Promise<any[]> {
  const page = await provider.client.get<any>("/api/bookings?scope=active&limit=100", { action: "list bookings" });
  return page.items ?? [];
}

const reasonFor = (error: unknown) => error instanceof ApiError ? `${error.status}` : "error";

/**
 * Works one booking through the provider's day: route, pings, photos, start, complete. Each step is a separate HTTP
 * call with randomized gaps. Returns the final status the API reported.
 */
export async function workBooking(settings: BotSettings, provider: ProviderBot, booking: any, owner?: OwnerBot, strangers: BotClient[] = []): Promise<string> {
  const { client, rng } = provider, timing = settings.timing, id = booking.id as string;
  const record = (action: string, detail?: Record<string, unknown>) => settings.recorder.event({ botId: client.botId, action, bookingId: id, detail });

  await settings.bringVisitIntoWindow?.(id);
  // Before the route starts, nobody should see a live point.
  if (owner) await probeTracking(settings, owner.client, id, "owner before route", "no-live-point");
  await client.post("/api/bookings/on-route", { bookingId: id }, { action: "start route" });
  record("on-route");
  const destination = booking.serviceAddress.point;
  const steps = rng.int(2, 5);
  for (let step = steps; step >= 0; step -= 1) {
    await pause(rng, timing);
    const fraction = step / Math.max(steps, 1);
    const point = {
      latitude: destination.latitude + (provider.address.point.latitude - destination.latitude) * fraction,
      longitude: destination.longitude + (provider.address.point.longitude - destination.longitude) * fraction
    };
    await client.post("/api/bookings/route-location", { bookingId: id, point, speedMph: rng.int(15, 40), accuracyMeters: rng.int(5, 30) }, { action: "gps ping" });
  }
  if (owner) await probeTracking(settings, owner.client, id, "owner on route", "allowed");
  for (const stranger of strangers) await probeTracking(settings, stranger, id, `stranger (${stranger.persona}) on route`, "denied");
  await client.post("/api/bookings/evidence", { bookingId: id, phase: "before", imageDataUrl: ONE_PIXEL_PNG }, { action: "before photo" });
  await pause(rng, timing);
  await client.post("/api/bookings/start", { bookingId: id }, { action: "start work" });
  record("start");
  await pause(rng, timing);
  await client.post("/api/bookings/evidence", { bookingId: id, phase: "after", imageDataUrl: ONE_PIXEL_PNG }, { action: "after photo" });
  const completed = await client.post<any>("/api/bookings/complete", { bookingId: id }, { action: "complete" });
  record("complete", { status: completed?.status });
  if (owner) await probeTracking(settings, owner.client, id, "owner after completion", "no-live-point");
  return completed?.status ?? "unknown";
}

/**
 * Reads arrival tracking as `client` and records a probe finding when the answer breaks the rule:
 * "allowed" must return a point, "denied" must be refused, "no-live-point" must not expose a live point.
 */
export async function probeTracking(settings: BotSettings, client: BotClient, bookingId: string, who: string, rule: "allowed" | "denied" | "no-live-point") {
  try {
    const tracking = await client.get<any>(`/api/bookings/tracking?bookingId=${bookingId}`, { action: `tracking: ${who}`, expect: rule === "denied" ? [403, 404] : [] });
    // After the visit, tracking shows the property's own address; only a point elsewhere is someone's live position.
    const destination = tracking?.destination?.point;
    const atProperty = destination && tracking?.currentPoint && destination.latitude === tracking.currentPoint.latitude && destination.longitude === tracking.currentPoint.longitude;
    const livePoint = atProperty ? undefined : tracking?.currentPoint;
    if (rule === "denied") {
      settings.recorder.finding({ kind: "probe", name: "live-location-access", message: `${who} could read live tracking for booking ${bookingId}`, rows: [{ bookingId, who, keys: Object.keys(tracking ?? {}) }] });
    } else if (rule === "no-live-point" && livePoint) {
      settings.recorder.finding({ kind: "probe", name: "live-location-access", message: `${who} sees a live point for booking ${bookingId}`, rows: [{ bookingId, who, trackingStatus: tracking?.status, livePoint }] });
    }
  } catch (error) {
    if (rule === "allowed") settings.recorder.finding({ kind: "probe", name: "live-location-access", message: `${who} was refused tracking (${reasonFor(error)}) for booking ${bookingId}`, rows: [{ bookingId, who }] });
  }
}

export async function reviewCrew(settings: BotSettings, provider: ProviderBot, raceAccept: boolean) {
  const overview = await provider.client.attempt(() => provider.client.get<any>("/api/providers/staffing", { action: "staffing overview" }));
  for (const job of overview?.jobs ?? []) {
    const pending = (job.matches ?? []).filter((match: any) => match.status === "pending-provider-review");
    if (!pending.length) continue;
    // Accepting every pending candidate at once tests that a job cannot be overfilled.
    const chosen = raceAccept ? pending : pending.slice(0, Math.max(job.crewGap, 0));
    await Promise.all(chosen.map((match: any) => provider.client.attempt(() =>
      provider.client.post("/api/providers/staffing/review", { crewMatchId: match.id, action: provider.rng.chance(0.9) ? "accept" : "deny" },
        // A candidate who took another job since the list loaded is refused with 409; that is the API working.
        { action: "review crew", expect: [409] }))));
    settings.recorder.event({ botId: provider.client.botId, action: "review-crew", bookingId: job.bookingId, detail: { reviewed: chosen.length, gap: job.crewGap } });
  }
}

export async function crewRound(settings: BotSettings, crew: CrewBot) {
  const result = await crew.client.attempt(() => crew.client.get<any>("/api/crew/matches", { action: "crew schedule" }));
  for (const match of result?.matches ?? []) {
    const upcoming = ["requested", "confirmed"].includes(match.bookingStatus) && Date.parse(match.scheduledStartIso) > Date.now();
    if (match.status === "accepted" && upcoming && crew.rng.chance(0.05)) {
      await crew.client.attempt(() => crew.client.post("/api/crew/matches/cancel", { crewMatchId: match.id, reason: "Unable to attend" }, { action: "call off" }));
      settings.recorder.event({ botId: crew.client.botId, action: "crew-call-off", bookingId: match.bookingId });
    }
  }
  return result?.matches ?? [];
}

/**
 * The password-reset journey from the scenario matrix: request, unknown email, wrong code, right code, reused code,
 * expired code, and whether a session from before the reset still works.
 */
export async function passwordResetJourney(settings: BotSettings, owner: OwnerBot, expireCode: (email: string) => Promise<void>) {
  const { client, recorder } = { client: owner.client, recorder: settings.recorder };
  const gap = (name: string, message: string, rows: unknown[] = []) => recorder.finding({ kind: "probe", name, message, rows });
  const oldToken = client.token!;
  const unknown = await client.post<any>("/api/auth/password-reset/request", { email: `${settings.runId}-nobody@example.invalid` }, { action: "reset: unknown email" });
  if (unknown.resetCodePreview) gap("password-reset", "An unknown email received a reset code preview");
  const requested = await client.post<any>("/api/auth/password-reset/request", { email: owner.email }, { action: "reset: request" });
  if (unknown.message !== requested.message) gap("password-reset", "Reset request wording differs for known and unknown emails (account enumeration)", [{ unknown: unknown.message, known: requested.message }]);
  const code = requested.resetCodePreview as string | undefined;
  if (!code) { gap("password-reset", "Local API returned no reset code preview"); return; }
  const wrong = code === "000000" ? "111111" : "000000";
  await client.attempt(() => client.post("/api/auth/password-reset/confirm", { email: owner.email, resetCode: wrong, newPassword: `${BOT_PASSWORD}x1` }, { action: "reset: wrong code", expect: [400] }));
  const newPassword = `${BOT_PASSWORD}Z9`;
  const confirmed = await client.attempt(() => client.post<any>("/api/auth/password-reset/confirm", { email: owner.email, resetCode: code, newPassword }, { action: "reset: confirm" }));
  if (!confirmed?.session?.token) { gap("password-reset", "Confirming a fresh reset code did not sign the user in"); return; }
  recorder.event({ botId: client.botId, action: "password-reset" });
  const reused = await client.attempt(() => client.post("/api/auth/password-reset/confirm", { email: owner.email, resetCode: code, newPassword: `${BOT_PASSWORD}Q8` }, { action: "reset: reused code", expect: [400] }));
  if (reused) gap("password-reset", "A reset code worked a second time");
  const stillIn = await client.attempt(() => client.get("/api/auth/me", { token: oldToken, action: "reset: old session", expect: [401] }));
  if (stillIn) gap("password-reset", "A session from before the password reset still works");
  const oldPassword = await client.attempt(() => client.post("/api/auth/login", { email: owner.email, password: BOT_PASSWORD }, { action: "reset: old password", expect: [400, 401] }));
  if (oldPassword) gap("password-reset", "The old password still signs in after a reset");
  client.token = confirmed.session.token;
  // Expired code: request another (after the one-per-minute cooldown), expire it in the test database, try it.
  await sleep(61_000);
  const again = await client.post<any>("/api/auth/password-reset/request", { email: owner.email }, { action: "reset: request again" });
  if (again.resetCodePreview) {
    await expireCode(owner.email);
    const expired = await client.attempt(() => client.post("/api/auth/password-reset/confirm", { email: owner.email, resetCode: again.resetCodePreview, newPassword: `${BOT_PASSWORD}E7` }, { action: "reset: expired code", expect: [400] }));
    if (expired) gap("password-reset", "An expired reset code still worked");
  } else {
    gap("password-reset", "A second reset request a minute later returned no code preview");
  }
}

/** Duplicate email, lockout after failed passwords, and launch flags. */
export async function accountAndFlagProbes(settings: BotSettings, owner: OwnerBot, crew: CrewBot | undefined) {
  const { client } = owner;
  const gap = (name: string, message: string, rows: unknown[] = []) => settings.recorder.finding({ kind: "probe", name, message, rows });
  const duplicate = await client.attempt(() => client.post("/api/auth/register", { role: "customer", fullName: "Dup", email: owner.email.toUpperCase(), password: BOT_PASSWORD,
    phone: "555-0999", address: owner.properties[0]!.address, propertyLabel: "Home" }, { action: "sign up: duplicate email", expect: [400, 409] }));
  if (duplicate) gap("sign-up", "A second account was created with the same email in different case");
  let locked = false;
  for (let attempt = 1; attempt <= 8 && !locked; attempt += 1) {
    try {
      await client.post("/api/auth/login", { email: owner.email, password: "Wrong-Password-123!" }, { action: "login: wrong password", expect: [400, 401, 423, 429] });
    } catch (error) {
      if (error instanceof ApiError && [423, 429].includes(error.status)) locked = true;
      if (error instanceof ApiError && /lock|too many/i.test(error.message)) locked = true;
    }
  }
  if (!locked) gap("lockout", "Eight wrong passwords in a row did not lock the account or slow sign-in");
  const anon = new BotClient(settings.baseUrl, settings.recorder, "anonymous", "flags");
  for (const path of ["/api/crew/opportunities", "/api/crew/opportunities/public", "/api/payouts/provider", "/api/payments"]) {
    const token = path.startsWith("/api/crew") ? crew?.client.token : client.token;
    const reached = await anon.attempt(() => anon.get(path, { token, action: "launch flag", expect: [404] }));
    if (reached) gap("launch-flags", `${path} answered with launch flags off`);
  }
}
