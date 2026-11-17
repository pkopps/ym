/**
 * Reads a bot run's database and fails on any invariant from the testing plan
 * (docs/plans/testing-and-matching-plan.md, "Scripted bot army and invariant checker"). Prints the offending rows.
 *
 *   node --import tsx scripts/bots/check-invariants.mts --run-dir reports/bot-runs/<run>
 *
 * The database comes from BOT_DATABASE_URL (loopback, named *test* or *scale*) or the run's default.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { userInfo } from "node:os";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { PrismaClient } from "@prisma/client";
import { resolveFinderFeeTier } from "@yardmatch/domain";
import { assertLocalTestDatabase } from "../lib/local-database-guard.mts";
import type { EventRecord, FindingRecord } from "./recorder.mts";

export interface InvariantResult {
  name: string;
  breakdown?: Record<string, number>;
  rule: string;
  checked: number;
  failures: number;
  rows: unknown[];
}

export interface InvariantReport {
  results: InvariantResult[];
  failures: Array<{ name: string; message: string; rows: unknown[] }>;
  /** Not in the plan's list, but reported so a reader can decide whether they are bugs. */
  observations: Array<{ name: string; message: string; rows: unknown[] }>;
}

const ACTIVE_EXCLUDED = ["cancelled", "refunded"];
const CREW_BASE: Record<string, number> = {
  "lawn-mowing": 1, "hedge-trimming": 1, "mulch-installation": 2, "seasonal-cleanup": 2, "weed-control": 1, "irrigation-check": 1,
  "leaf-blowing": 1, aeration: 1, fertilization: 1, "gutter-cleaning": 2, "snow-shoveling": 2, "ice-melt-salting": 1, "snow-blowing": 2
};

/** Mirrors MarketplacePlatformService.estimateRequiredCrewMembers; the checker restates the rule rather than importing it. */
export function requiredCrew(category: string, lawnSizeSqFt?: number | null, shrubBedSqFt?: number | null): number {
  let size = CREW_BASE[category] ?? 1;
  if (lawnSizeSqFt && lawnSizeSqFt > 5000) size += 1;
  if (shrubBedSqFt && shrubBedSqFt > 900) size += 1;
  return Math.min(size, 4);
}

/**
 * Which party should hear about each bot action, and the title of that notice. Many notices link to a dashboard
 * without a booking id, so a notice is matched by recipient, title and time: each bot action claims one matching notice
 * created up to 30 s before the action's response. An action with nothing to claim is "missing"; a second notice with the
 * same title to the same person within 3 s of a claimed one is a "duplicate".
 */
const NOTIFY: Record<string, Array<{ party: "customer" | "provider"; title: RegExp }>> = {
  book: [{ party: "provider", title: /^New booking request$/ }],
  "book-recurring": [{ party: "provider", title: /^New recurring booking request$/ }],
  confirm: [{ party: "customer", title: /^Your booking is confirmed$/ }],
  decline: [{ party: "customer", title: /^Provider declined/ }],
  cancel: [{ party: "provider", title: /^Booking cancelled$/ }],
  reschedule: [{ party: "provider", title: /^Booking rescheduled$/ }],
  "on-route": [{ party: "customer", title: /on the way/ }],
  complete: [{ party: "customer", title: /^Service marked complete$/ }],
  dispute: [{ party: "provider", title: /dispute/i }]
};

export async function checkInvariants(prisma: PrismaClient, options: { runDir?: string; events?: EventRecord[] } = {}): Promise<InvariantReport> {
  const results: InvariantResult[] = [];
  const observations: InvariantReport["observations"] = [];
  const add = (name: string, rule: string, checked: number, rows: unknown[]) => {
    // Tally rows by their cause or problem so the summary says what kind of failure dominates.
    const tally = new Map<string, number>();
    for (const row of rows as Array<{ cause?: string; problem?: string; action?: string }>) {
      const key = [row.cause ?? row.problem, row.action].filter(Boolean).join(": ");
      if (key) tally.set(key, (tally.get(key) ?? 0) + 1);
    }
    results.push({ name, rule, checked, failures: rows.length, rows: rows.slice(0, 50), ...(tally.size ? { breakdown: Object.fromEntries(tally) } : {}) });
  };

  const bookings = await prisma.booking.findMany({
    select: { id: true, customerId: true, providerId: true, servicePropertyId: true, category: true, status: true, recurringPlanId: true,
      scheduledStartIso: true, scheduledEndIso: true, completedAt: true, disputedAt: true, routeLivePoint: true, onRouteConfirmedAt: true, recovery: true }
  });
  const bookingById = new Map(bookings.map(row => [row.id, row]));
  const properties = await prisma.customerProperty.findMany({ select: { id: true, lawnSizeSqFt: true, shrubBedSqFt: true } });
  const propertyById = new Map(properties.map(row => [row.id, row]));

  // 1. No availability slot is booked twice; no provider has overlapping jobs.
  const live = bookings.filter(row => !ACTIVE_EXCLUDED.includes(row.status) && (row.recovery as { state?: string } | null)?.state !== "open");
  const byProvider = groupBy(live, row => row.providerId);
  const overlaps: unknown[] = [];
  for (const rows of byProvider.values()) {
    const sorted = [...rows].sort((a, b) => a.scheduledStartIso.getTime() - b.scheduledStartIso.getTime());
    for (let i = 0; i < sorted.length; i += 1) {
      for (let j = i + 1; j < sorted.length && sorted[j]!.scheduledStartIso < sorted[i]!.scheduledEndIso; j += 1) {
        const early = [sorted[i]!, sorted[j]!].some(row => row.completedAt && row.completedAt < row.scheduledStartIso);
        overlaps.push({ providerId: sorted[i]!.providerId, cause: early ? "one visit was completed before its scheduled start, which freed the slot" : "both visits active",
          first: brief(sorted[i]!), second: brief(sorted[j]!) });
      }
    }
  }
  add("provider-no-overlapping-jobs", "No availability slot is booked twice; no provider has overlapping jobs", live.length, overlaps);

  // 2-4. Finder fees.
  const charges = await prisma.finderFeeCharge.findMany();
  const pairCounts = groupBy(charges, row => `${row.customerId}|${row.providerId}`);
  add("finder-fee-one-per-pair", "At most one finder fee per owner-provider pair", charges.length,
    [...pairCounts.entries()].filter(([, rows]) => rows.length > 1).map(([pair, rows]) => ({ pair, chargeIds: rows.map(row => row.id) })));

  const tierRows: unknown[] = [];
  for (const charge of charges) {
    const booking = bookingById.get(charge.bookingId);
    const property = booking?.servicePropertyId ? propertyById.get(booking.servicePropertyId) : undefined;
    const expected = resolveFinderFeeTier(property?.lawnSizeSqFt ?? undefined);
    const expectedFee = charge.waived ? 0 : expected.feeCents;
    if (charge.tier !== expected.tier || charge.listFeeCents !== expected.feeCents || charge.feeCents !== expectedFee) {
      tierRows.push({ chargeId: charge.id, lawnSizeSqFt: property?.lawnSizeSqFt, tier: charge.tier, expectedTier: expected.tier,
        listFeeCents: charge.listFeeCents, feeCents: charge.feeCents, expectedFeeCents: expectedFee, waived: charge.waived });
    }
  }
  add("finder-fee-tier", "Finder fee at the right tier ($75 / $110 / $150), zero when waived", charges.length, tierRows);

  const waiverRows: unknown[] = [];
  for (const [providerId, rows] of groupBy(charges.filter(row => row.status !== "void"), row => row.providerId)) {
    const waived = rows.filter(row => row.waived);
    const first = [...rows].sort((a, b) => a.completedAt.getTime() - b.completedAt.getTime())[0]!;
    if (waived.length > 1) waiverRows.push({ providerId, problem: "more than one waiver", chargeIds: waived.map(row => row.id) });
    else if (waived.length === 0 && !rows.some(row => row.status === "covered-by-prior-policy")) waiverRows.push({ providerId, problem: "first relationship was charged", firstChargeId: first.id });
    else if (waived[0] && waived[0].completedAt > first.completedAt) waiverRows.push({ providerId, problem: "waiver is not on the first relationship", waivedChargeId: waived[0].id, firstChargeId: first.id });
  }
  add("finder-fee-first-relationship-waived", "The provider's first relationship is waived, and only that one", charges.length, waiverRows);

  const badJobRows: unknown[] = [];
  for (const charge of charges) {
    const booking = bookingById.get(charge.bookingId);
    // "awaiting-customer" is re-checked for disputes when billing runs, so only a charge billing has acted on counts.
    const billable = ["charging", "paid", "retry-scheduled", "failed"].includes(charge.status);
    if (!booking) badJobRows.push({ chargeId: charge.id, problem: "booking missing" });
    else if (booking.status !== "completed" && booking.status !== "disputed" && charge.status !== "void") badJobRows.push({ chargeId: charge.id, bookingId: booking.id, bookingStatus: booking.status, chargeStatus: charge.status, problem: "fee on a job that is not completed" });
    else if ((booking.status === "disputed" || booking.disputedAt) && billable) badJobRows.push({ chargeId: charge.id, bookingId: booking.id, chargeStatus: charge.status, problem: "billable fee on a disputed job" });
    else if (!booking.completedAt && charge.status !== "void") badJobRows.push({ chargeId: charge.id, bookingId: booking.id, problem: "fee on a job with no completion time" });
  }
  add("finder-fee-not-on-bad-job", "No fee on a cancelled, disputed or never-completed first job", charges.length, badJobRows);

  const planCharges = groupBy(charges.flatMap(charge => {
    const planId = bookingById.get(charge.bookingId)?.recurringPlanId;
    return planId ? [{ planId, chargeId: charge.id }] : [];
  }), row => row.planId);
  const plans = await prisma.recurringServicePlan.count();
  add("finder-fee-once-per-plan", "A recurring plan charges the finder fee once, not per visit", plans,
    [...planCharges.entries()].filter(([, rows]) => rows.length > 1).map(([planId, rows]) => ({ planId, chargeIds: rows.map(row => row.chargeId) })));

  // 5. Crew.
  const matches = await prisma.crewMatch.findMany({ where: { status: "accepted" }, select: { id: true, bookingId: true, crewMemberId: true } });
  const overfilled: unknown[] = [];
  for (const [bookingId, rows] of groupBy(matches, row => row.bookingId)) {
    const booking = bookingById.get(bookingId);
    if (!booking) continue;
    const property = booking.servicePropertyId ? propertyById.get(booking.servicePropertyId) : undefined;
    const needed = requiredCrew(booking.category, property?.lawnSizeSqFt, property?.shrubBedSqFt);
    if (rows.length > needed) overfilled.push({ bookingId, category: booking.category, needed, accepted: rows.length, crewMemberIds: rows.map(row => row.crewMemberId) });
  }
  add("crew-not-overfilled", "No job has more accepted crew than it needs", new Set(matches.map(row => row.bookingId)).size, overfilled);

  const crewOverlaps: unknown[] = [];
  for (const [crewMemberId, rows] of groupBy(matches, row => row.crewMemberId)) {
    const jobs = rows.map(row => bookingById.get(row.bookingId)).filter(row => row && !ACTIVE_EXCLUDED.includes(row.status))
      .sort((a, b) => a!.scheduledStartIso.getTime() - b!.scheduledStartIso.getTime());
    for (let i = 0; i < jobs.length; i += 1) {
      for (let j = i + 1; j < jobs.length && jobs[j]!.scheduledStartIso < jobs[i]!.scheduledEndIso; j += 1) {
        const early = [jobs[i]!, jobs[j]!].some(row => row.completedAt && row.completedAt < row.scheduledStartIso);
        crewOverlaps.push({ crewMemberId, cause: early ? "one visit was completed before its scheduled start, which freed the slot" : "both visits active",
          first: brief(jobs[i]!), second: brief(jobs[j]!) });
      }
    }
  }
  add("crew-not-double-booked", "No crew member is on two jobs at once", matches.length, crewOverlaps);

  // 6. Live location: the bots probed every route they ran; the probes are the evidence.
  const findings = options.runDir ? readJsonl<FindingRecord>(join(options.runDir, "findings.jsonl")) : [];
  const locationProbes = findings.filter(item => item.kind === "probe" && item.name === "live-location-access");
  const routed = bookings.filter(row => row.onRouteConfirmedAt).length;
  add("live-location-access", "Live location is readable only by that booking's owner, provider and assigned crew, and only while on route",
    routed, locationProbes.map(item => ({ message: item.message, ...(item.rows?.[0] as object ?? {}) })));
  const staleLive = bookings.filter(row => ["completed", "cancelled", "refunded"].includes(row.status) && row.routeLivePoint);
  if (staleLive.length) observations.push({ name: "live-point-retained", message: `${staleLive.length} finished or cancelled bookings still store a live GPS point in the database`, rows: staleLive.slice(0, 10).map(brief) });

  // 7. Notifications: one per affected party per state change.
  const events = options.events ?? (options.runDir ? readJsonl<EventRecord>(join(options.runDir, "events.jsonl")) : []);
  const notifications = await prisma.appNotification.findMany({ select: { id: true, recipientId: true, title: true, createdAt: true }, orderBy: { createdAt: "asc" } });
  const byRecipient = groupBy(notifications, row => row.recipientId);
  const claimed = new Set<string>();
  const notificationRows: unknown[] = [];
  let expectedNotices = 0;
  for (const event of [...events].sort((a, b) => a.at.localeCompare(b.at))) {
    const expected = NOTIFY[event.action];
    if (!expected || !event.bookingId || event.detail?.ok === false) continue;
    const booking = bookingById.get(event.bookingId);
    if (!booking) continue;
    for (const { party, title } of expected) {
      expectedNotices += 1;
      const recipientId = party === "customer" ? booking.customerId : booking.providerId;
      const at = Date.parse(event.at);
      const match = (byRecipient.get(recipientId) ?? []).find(row => !claimed.has(row.id) && title.test(row.title) &&
        row.createdAt.getTime() >= at - 30_000 && row.createdAt.getTime() <= at + 2_000);
      if (match) claimed.add(match.id);
      else notificationRows.push({ problem: "missing", action: event.action, party, recipientId, bookingId: event.bookingId, at: event.at });
    }
  }
  const trackedTitles = Object.values(NOTIFY).flat().map(item => item.title);
  for (const rows of byRecipient.values()) {
    for (const row of rows) {
      if (claimed.has(row.id) || !trackedTitles.some(title => title.test(row.title))) continue;
      const twin = rows.find(other => claimed.has(other.id) && other.title === row.title && Math.abs(other.createdAt.getTime() - row.createdAt.getTime()) < 3_000);
      if (twin) notificationRows.push({ problem: "duplicate", recipientId: row.recipientId, title: row.title, notificationIds: [twin.id, row.id] });
    }
  }
  add("notification-once-per-party", "Every state change produced exactly one notification per affected party", expectedNotices, notificationRows);

  // Observations outside the plan's list.
  const early = bookings.filter(row => row.completedAt && row.completedAt < row.scheduledStartIso);
  if (early.length) observations.push({ name: "completed-before-scheduled-start", message: `${early.length} visits were marked complete before their scheduled start`, rows: early.slice(0, 10).map(brief) });

  const failures = results.filter(item => item.failures > 0).map(item => ({ name: item.name, rows: item.rows,
    message: `${item.failures} of ${item.checked} checked: ${item.rule}${item.breakdown ? ` (${Object.entries(item.breakdown).map(([key, count]) => `${count} ${key}`).join("; ")})` : ""}` }));
  return { results, failures, observations };
}

export function formatInvariantReport(report: InvariantReport): string {
  const lines = ["## Invariants", "", "| Invariant | Checked | Failures |", "| --- | ---: | ---: |",
    ...report.results.map(item => `| ${item.rule} | ${item.checked} | ${item.failures ? `**${item.failures}**` : 0} |`), ""];
  for (const failure of report.failures) {
    lines.push(`### FAILED: ${failure.name}`, "", failure.message, "", "```json", JSON.stringify(failure.rows.slice(0, 10), null, 2), "```", "");
  }
  if (report.observations.length) {
    lines.push("## Observations (not in the plan's invariant list)", "");
    for (const item of report.observations) lines.push(`- **${item.name}**: ${item.message}`);
  }
  return lines.join("\n");
}

function brief(row: { id: string; status: string; scheduledStartIso: Date; scheduledEndIso: Date; customerId?: string; completedAt?: Date | null }) {
  return { id: row.id, status: row.status, start: row.scheduledStartIso.toISOString(), end: row.scheduledEndIso.toISOString(),
    ...(row.customerId ? { customerId: row.customerId } : {}), ...(row.completedAt ? { completedAt: row.completedAt.toISOString() } : {}) };
}

function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const list = map.get(key(row)) ?? [];
    list.push(row);
    map.set(key(row), list);
  }
  return map;
}

function readJsonl<T>(path: string): T[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8").split("\n").filter(Boolean).map(line => JSON.parse(line) as T);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const { values } = parseArgs({ options: { "run-dir": { type: "string" } } });
  const url = assertLocalTestDatabase(process.env.BOT_DATABASE_URL ?? `postgresql://${userInfo().username}@localhost:5432/yardmatch_bots_test`, "BOT_DATABASE_URL");
  const prisma = new PrismaClient({ datasourceUrl: url.toString() });
  try {
    const report = await checkInvariants(prisma, { runDir: values["run-dir"] });
    console.log(formatInvariantReport(report));
    process.exitCode = report.failures.length ? 1 : 0;
  } finally {
    await prisma.$disconnect();
  }
}
