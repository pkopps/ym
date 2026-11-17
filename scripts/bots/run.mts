/**
 * Bot army, part 1: owner, provider and crew bots drive the HTTP API of a local API process against a disposable local
 * database, then the invariant checker reads that database. Local only: the database must be on loopback and named
 * *test* or *scale*, the API listens on 127.0.0.1, every email is @example.invalid, and vendor keys are blanked.
 *
 *   npm run bots -- --owners 40 --providers 8 --crew 16 --seed 7
 *
 * Replay a failing run with the same --seed and counts. Choices (who books what, accept or decline, delays) come from
 * the seed; the interleaving of concurrent requests still depends on the machine, so a race may need a few replays.
 */
import { parseArgs } from "node:util";
import { join } from "node:path";
import { userInfo } from "node:os";
import { PrismaClient } from "@prisma/client";
import { mapConcurrent } from "../../apps/api/src/concurrency";
import { assertLocalTestDatabase } from "../lib/local-database-guard.mts";
import { ApiError } from "./client.mts";
import { startLocalEnvironment, repoRoot } from "./environment.mts";
import { closeDisputeWindows } from "./billing.mts";
import { checkInvariants, formatInvariantReport } from "./check-invariants.mts";
import { BARNEGAT_MARKET } from "./market.mts";
import {
  accountAndFlagProbes, book, bookingIdFromCreate, crewRound, listProviderBookings, localDayAt, passwordResetJourney, pause,
  reviewCrew, search, signUpCrew, signUpOps, signUpOwner, signUpProvider, workBooking,
  type BotSettings, type CrewBot, type OwnerBot, type ProviderBot
} from "./personas.mts";
import { RunRecorder } from "./recorder.mts";
import { Rng } from "./random.mts";

/* eslint-disable @typescript-eslint/no-explicit-any -- bots read loosely typed JSON responses */

const { values: args } = parseArgs({
  options: {
    owners: { type: "string", default: "40" },
    providers: { type: "string", default: "8" },
    crew: { type: "string", default: "16" },
    seed: { type: "string", default: String(Date.now() % 100_000) },
    "bookings-per-owner": { type: "string", default: "3" },
    concurrency: { type: "string", default: "24" },
    "min-delay": { type: "string", default: "20" },
    "max-delay": { type: "string", default: "400" },
    rounds: { type: "string", default: "6" },
    "skip-reset": { type: "boolean", default: false },
    "keep-db": { type: "boolean", default: false }
  }
});

// Refuse a non-local database before anything is written.
assertLocalTestDatabase(process.env.BOT_DATABASE_URL ?? `postgresql://${userInfo().username}@localhost:5432/yardmatch_bots_test`, "BOT_DATABASE_URL");
const counts = { owners: Number(args.owners), providers: Number(args.providers), crew: Number(args.crew) };
const seed = Number(args.seed), bookingsPerOwner = Number(args["bookings-per-owner"]), concurrency = Number(args.concurrency);
const rng = new Rng(seed);
const label = `${new Date().toISOString().replace(/[:.]/g, "-")}-seed-${seed}`;
const recorder = new RunRecorder(join(repoRoot, "reports/bot-runs"), label);
const log = (line: string) => console.log(`[bots] ${line}`);
recorder.writeJson("config.json", { ...counts, seed, bookingsPerOwner, concurrency, minDelayMs: Number(args["min-delay"]), maxDelayMs: Number(args["max-delay"]), rounds: Number(args.rounds) });

const env = await startLocalEnvironment({ fresh: !args["keep-db"], connectionLimit: 10, log, apiLogPath: join(recorder.dir, "api.log") });
const prisma = new PrismaClient({ datasourceUrl: env.databaseUrl.toString() });
// Each worked visit gets its own one-minute slot in the recent past, two minutes apart across every provider, so moving
// it never puts two visits on one provider or crew member at once. Booked visits start at least a day out, so the
// recent past is free. Local test database only (guarded above).
let workedVisits = 0;
const runStartedAt = Date.now();
const settings: BotSettings = {
  baseUrl: env.apiBaseUrl, runId: `bot${seed}`, recorder, zones: BARNEGAT_MARKET, radiusMiles: [8, 20], horizonDays: 14,
  timing: { minDelayMs: Number(args["min-delay"]), maxDelayMs: Number(args["max-delay"]) },
  bringVisitIntoWindow: async bookingId => {
    workedVisits += 1;
    const start = new Date(runStartedAt - workedVisits * 2 * 60_000);
    await prisma.booking.update({ where: { id: bookingId }, data: { scheduledStartIso: start, scheduledEndIso: new Date(start.getTime() + 60_000) } });
  }
};
const started = Date.now();
let exitCode = 0;

try {
  const ops = await signUpOps(settings, env.ops);
  log(`signing up ${counts.providers} providers, ${counts.crew} crew, ${counts.owners} owners (seed ${seed})`);
  const providers = (await mapConcurrent([...Array(counts.providers).keys()], 6, async index =>
    signUpProvider(settings, ops, rng.fork(`provider-${index}`), index).catch(error => { log(`provider ${index} sign-up failed: ${error.message}`); return undefined; })))
    .filter((item): item is ProviderBot => Boolean(item));
  const crew = (await mapConcurrent([...Array(counts.crew).keys()], 8, async index =>
    signUpCrew(settings, rng.fork(`crew-${index}`), index).catch(error => { log(`crew ${index} sign-up failed: ${error.message}`); return undefined; })))
    .filter((item): item is CrewBot => Boolean(item));
  const owners = (await mapConcurrent([...Array(counts.owners).keys()], concurrency, async index =>
    signUpOwner(settings, rng.fork(`owner-${index}`), index).catch(error => { log(`owner ${index} sign-up failed: ${error.message}`); return undefined; })))
    .filter((item): item is OwnerBot => Boolean(item));
  const ownerById = new Map(owners.map(owner => [owner.id, owner]));
  log(`signed up ${providers.length} providers, ${crew.length} crew, ${owners.length} owners`);

  const stats = { searches: 0, emptySearches: 0, booked: 0, recurring: 0, bookFailures: 0, accepted: 0, declined: 0, completed: 0, cancelled: 0, rescheduled: 0, disputed: 0, races: 0 };
  let ownersDone = false;

  const ownerWork = async (owner: OwnerBot) => {
    const orng = owner.rng;
    for (let attempt = 0; attempt < bookingsPerOwner; attempt += 1) {
      await pause(orng, settings.timing);
      const property = orng.pick(owner.properties);
      const category = orng.chance(0.8) ? "lawn-mowing" : orng.pick(["hedge-trimming", "leaf-blowing", "seasonal-cleanup", "mulch-installation"]);
      const day = orng.int(2, settings.horizonDays - 1);
      stats.searches += 1;
      const found = await owner.client.attempt(() => search(owner, property, category, localDayAt(day, 9).toISOString()));
      const choices = (found?.ranked ?? []).filter(item => item.slot);
      if (!choices.length) { stats.emptySearches += 1; recorder.event({ botId: owner.client.botId, action: "search-empty", detail: { postalCode: property.address.postalCode, category } }); continue; }
      // Mostly the recommendation; sometimes one of the curated backups.
      const choice = orng.chance(0.8) ? choices[0]! : orng.pick(choices);
      const start = new Date(choice.slot!.startIso);
      // Spread visits through the opening so several owners can share a provider's day.
      start.setUTCHours(start.getUTCHours() + orng.int(0, 6));
      const draft = { providerId: choice.providerId, property, category, startIso: start.toISOString(), endIso: new Date(start.getTime() + 3_600_000).toISOString() };
      const recurring = orng.chance(0.25) ? orng.pick(["weekly", "biweekly"] as const) : undefined;
      try {
        if (orng.chance(0.08)) {
          // Double-tap submit: the same request twice at once with one request id.
          stats.races += 1;
          const requestId = `${owner.id}-${attempt}`;
          const results = await Promise.allSettled([book(owner, draft, { requestId, action: "double-tap", expect: [409] }), book(owner, draft, { requestId, action: "double-tap", expect: [409] })]);
          const ids = results.flatMap(item => item.status === "fulfilled" ? [item.value.id] : []);
          recorder.event({ botId: owner.client.botId, action: "race-double-tap", bookingId: ids[0], detail: { ids } });
          for (const id of new Set(ids)) recorder.event({ botId: owner.client.botId, action: "book", bookingId: id, detail: { via: "double-tap" } });
          if (new Set(ids).size > 1) recorder.finding({ kind: "probe", name: "double-submit", message: "Two submits with one request id created two bookings", rows: [{ ids }] });
          if (ids.length) stats.booked += 1;
          continue;
        }
        if (orng.chance(0.08) && owners.length > 1) {
          // Two owners take the same slot at once.
          stats.races += 1;
          const rival = orng.pick(owners.filter(item => item.id !== owner.id));
          const rivalDraft = { ...draft, property: rival.properties[0]! };
          const results = await Promise.allSettled([book(owner, draft, { action: "same-slot race", expect: [409] }), book(rival, rivalDraft, { action: "same-slot race", expect: [409] })]);
          const ids = results.flatMap(item => item.status === "fulfilled" ? [item.value.id] : []);
          recorder.event({ botId: owner.client.botId, action: "race-same-slot", detail: { ids, providerId: draft.providerId, startIso: draft.startIso } });
          for (const id of ids) recorder.event({ botId: owner.client.botId, action: "book", bookingId: id, detail: { via: "same-slot race" } });
          if (ids.length > 1) recorder.finding({ kind: "probe", name: "same-slot-race", message: "Two owners booked the same provider slot at the same time and both succeeded", rows: [{ ids, providerId: draft.providerId, startIso: draft.startIso }] });
          stats.booked += ids.length;
          continue;
        }
        // Another owner may already hold this time; the API refuses with 409, and that is the rule working.
        const created = await book(owner, draft, { recurring, expect: [409] });
        const bookingId = bookingIdFromCreate(created) ?? created.id;
        recorder.event({ botId: owner.client.botId, action: recurring ? "book-recurring" : "book", bookingId, planId: recurring ? created.plan?.id ?? created.id : undefined, detail: { providerId: draft.providerId, startIso: draft.startIso, recurring } });
        stats.booked += 1;
        if (recurring) stats.recurring += 1;
      } catch (error) {
        stats.bookFailures += 1;
        if (!(error instanceof ApiError)) throw error;
      }
    }
  };

  const ownerFollowUps = async (owner: OwnerBot) => {
    const page = await owner.client.attempt(() => owner.client.get<any>("/api/bookings?scope=all&limit=100", { action: "list bookings" }));
    for (const booking of page?.items ?? []) {
      const roll = owner.rng.next();
      if (["requested", "confirmed"].includes(booking.status) && roll < 0.08) {
        await owner.client.attempt(() => owner.client.post("/api/bookings/cancel", { bookingId: booking.id }, { action: "cancel" }));
        recorder.event({ botId: owner.client.botId, action: "cancel", bookingId: booking.id });
        stats.cancelled += 1;
      } else if (["requested", "confirmed"].includes(booking.status) && roll < 0.16) {
        const start = new Date(Date.parse(booking.scheduledStartIso) + 24 * 3_600_000);
        const moved = await owner.client.attempt(() => owner.client.post("/api/bookings/reschedule", { bookingId: booking.id, scheduledStartIso: start.toISOString(), scheduledEndIso: new Date(start.getTime() + 3_600_000).toISOString() }, { action: "reschedule" }));
        recorder.event({ botId: owner.client.botId, action: "reschedule", bookingId: booking.id, detail: { ok: Boolean(moved) } });
        if (moved) stats.rescheduled += 1;
      } else if (booking.status === "completed" && roll < 0.1) {
        const disputed = await owner.client.attempt(() => owner.client.post("/api/bookings/dispute", { bookingId: booking.id, reason: "Front strip was not mowed and clippings were left on the walk." }, { action: "dispute" }));
        recorder.event({ botId: owner.client.botId, action: "dispute", bookingId: booking.id, detail: { ok: Boolean(disputed) } });
        if (disputed) stats.disputed += 1;
      }
    }
  };

  const providerRound = async (provider: ProviderBot, round: number) => {
    const prng = provider.rng;
    const bookings = await provider.client.attempt(() => listProviderBookings(provider)) ?? [];
    for (const booking of bookings) {
      await pause(prng, settings.timing);
      if (booking.status === "requested" && !booking.recovery) {
        const owner = ownerById.get(booking.customerId);
        if (owner && prng.chance(0.1)) {
          // Provider accepts while the owner cancels.
          stats.races += 1;
          const [accepted, cancelled] = await Promise.allSettled([
            provider.client.post("/api/bookings/confirm", { bookingId: booking.id }, { action: "accept (race)" }),
            owner.client.post("/api/bookings/cancel", { bookingId: booking.id }, { action: "cancel (race)" })
          ]);
          recorder.event({ botId: provider.client.botId, action: "race-accept-cancel", bookingId: booking.id, detail: { accepted: accepted.status, cancelled: cancelled.status } });
          if (accepted.status === "fulfilled") recorder.event({ botId: provider.client.botId, action: "confirm", bookingId: booking.id, detail: { via: "race" } });
          if (cancelled.status === "fulfilled") recorder.event({ botId: owner.client.botId, action: "cancel", bookingId: booking.id, detail: { via: "race" } });
          if (accepted.status === "fulfilled" && cancelled.status === "fulfilled") {
            const after = await owner.client.attempt(() => owner.client.get<any>(`/api/bookings/detail?bookingId=${booking.id}`, { action: "read after race" }));
            // Both can succeed legitimately (confirm first, then cancel); the owner's successful cancel must stand.
            if (after?.status !== "cancelled") {
              recorder.finding({ kind: "probe", name: "accept-cancel-race", message: `Provider accept and owner cancel both succeeded; the booking ended ${after?.status ?? "unreadable"}`,
                rows: [{ bookingId: booking.id, finalStatus: after?.status }] });
            }
          }
          continue;
        }
        if (prng.chance(provider.acceptRate)) {
          const ok = await provider.client.attempt(() => provider.client.post("/api/bookings/confirm", { bookingId: booking.id }, { action: "accept" }));
          recorder.event({ botId: provider.client.botId, action: "confirm", bookingId: booking.id, detail: { ok: Boolean(ok) } });
          if (ok) stats.accepted += 1;
        } else {
          const ok = await provider.client.attempt(() => provider.client.post("/api/bookings/decline", { bookingId: booking.id, reason: "No route capacity that day" }, { action: "decline" }));
          recorder.event({ botId: provider.client.botId, action: "decline", bookingId: booking.id, detail: { ok: Boolean(ok) } });
          if (ok) stats.declined += 1;
        }
      }
    }
    await reviewCrew(settings, provider, prng.chance(0.3));
    // From round 2, work some confirmed visits through the day (the season is compressed: visits run early).
    if (round >= 2) {
      const confirmed = (await provider.client.attempt(() => listProviderBookings(provider)) ?? []).filter(item => item.status === "confirmed");
      // Crew accepted on a job may track it; only crew with no accepted match there count as strangers.
      const staffing = await provider.client.attempt(() => provider.client.get<any>("/api/providers/staffing", { action: "staffing overview" }));
      const acceptedCrew = new Map<string, Set<string>>((staffing?.jobs ?? []).map((job: any) =>
        [job.bookingId, new Set((job.matches ?? []).filter((match: any) => match.status === "accepted").map((match: any) => match.crewMemberId))]));
      for (const booking of confirmed) {
        if (!prng.chance(0.6)) continue;
        const owner = ownerById.get(booking.customerId);
        const outsideCrew = crew.filter(member => !acceptedCrew.get(booking.id)?.has(member.id));
        const strangers = [prng.pick(owners.filter(item => item.id !== booking.customerId)).client,
          ...(outsideCrew.length ? [prng.pick(outsideCrew).client] : [])];
        try {
          const status = await workBooking(settings, provider, booking, owner, strangers);
          if (status === "completed") stats.completed += 1;
        } catch (error) {
          if (!(error instanceof ApiError)) throw error;
        }
      }
    }
  };

  const providerLoop = async () => {
    for (let round = 0; round < Number(args.rounds) || !ownersDone; round += 1) {
      await Promise.all(providers.map(provider => providerRound(provider, round)));
      await Promise.all(crew.map(member => crewRound(settings, member)));
      if (round % 2 === 1) await mapConcurrent(owners, concurrency, ownerFollowUps);
      log(`round ${round + 1}: ${JSON.stringify(stats)}`);
      if (round > Number(args.rounds) * 3) break;
    }
  };

  const probes = async () => {
    if (owners.length < 3) return;
    await accountAndFlagProbes(settings, owners.at(-1)!, crew[0]);
    if (!args["skip-reset"]) {
      await passwordResetJourney(settings, owners.at(-2)!, async address => {
        await prisma.userAccount.update({ where: { email: address }, data: { resetPasswordExpiresAt: new Date(Date.now() - 60_000) } });
      });
    }
  };

  await Promise.all([
    mapConcurrent(owners, concurrency, ownerWork).finally(() => { ownersDone = true; }),
    providerLoop(),
    probes()
  ]);
  log(`bot activity finished in ${Math.round((Date.now() - started) / 1000)} s: ${JSON.stringify(stats)}`);
  recorder.writeJson("stats.json", stats);

  log("closing the 72-hour dispute window with a fake card gateway");
  const billing = await closeDisputeWindows(prisma, providers.map(provider => provider.id));
  recorder.writeJson("finder-fees.json", billing);
  log(`finder fees after the window: ${JSON.stringify(billing.statuses)}`);

  const report = await checkInvariants(prisma, { runDir: recorder.dir, events: recorder.events });
  for (const failure of report.failures) recorder.finding({ kind: "invariant", name: failure.name, message: failure.message, rows: failure.rows });
  recorder.writeJson("invariants.json", report);
  const summary = [
    `# Bot run ${label}`, "",
    `Seed ${seed}. ${providers.length} providers, ${crew.length} crew, ${owners.length} owners, ${bookingsPerOwner} booking attempts per owner, ${concurrency} owners at once.`,
    `Elapsed ${Math.round((Date.now() - started) / 1000)} s. Replay: \`npm run bots -- --owners ${counts.owners} --providers ${counts.providers} --crew ${counts.crew} --seed ${seed}\`.`, "",
    "## Activity", "", "| Measure | Count |", "| --- | ---: |", ...Object.entries(stats).map(([key, value]) => `| ${key} | ${value} |`), "",
    `Finder fees after fast-forwarding past the dispute window (fake card gateway, no Stripe): ${Object.entries(billing.statuses).map(([status, count]) => `${count} ${status}`).join(", ")}.`, "",
    formatInvariantReport(report), "",
    "## Probe findings", "", ...(recorder.findings.filter(item => item.kind === "probe").length
      ? summarizeProbes(recorder.findings.filter(item => item.kind === "probe"))
      : ["None."]), "",
    "## Non-2xx responses", "", ...summarizeResponses(recorder.responses), "",
    "## Slowest routes (p95 ms)", "", "| Route | Calls | p50 | p95 | Max |", "| --- | ---: | ---: | ---: | ---: |",
    ...recorder.latencySummary().slice(0, 15).map(row => `| ${row.route} | ${row.count} | ${row.p50} | ${row.p95} | ${row.max} |`), ""
  ].join("\n");
  recorder.writeText("summary.md", summary);
  log(`report: ${recorder.dir}/summary.md`);
  log(`invariants: ${report.failures.length ? `${report.failures.length} FAILED` : "all held"}; unexpected non-2xx: ${recorder.responses.filter(item => !item.expected).length}`);
  if (report.failures.length) exitCode = 1;
} finally {
  await prisma.$disconnect();
  await env.stop();
}
process.exit(exitCode);

function summarizeResponses(responses: RunRecorder["responses"]): string[] {
  const groups = new Map<string, { count: number; expected: boolean; sample: string }>();
  for (const item of responses) {
    const key = `${item.status} ${item.method} ${item.path} (${item.action})`;
    const group = groups.get(key) ?? { count: 0, expected: Boolean(item.expected), sample: item.message ?? "" };
    group.count += 1;
    groups.set(key, group);
  }
  if (!groups.size) return ["None."];
  return ["| Response | Count | Expected | Sample message |", "| --- | ---: | --- | --- |",
    ...[...groups.entries()].sort((a, b) => Number(a[1].expected) - Number(b[1].expected) || b[1].count - a[1].count)
      .map(([key, group]) => `| ${key} | ${group.count} | ${group.expected ? "yes" : "no"} | ${group.sample.replace(/\|/g, "/").slice(0, 140)} |`)];
}

function summarizeProbes(findings: RunRecorder["findings"]): string[] {
  const groups = new Map<string, number>();
  for (const item of findings) groups.set(`${item.name}: ${item.message.replace(/booking [0-9a-f-]{36}/, "booking …")}`, (groups.get(`${item.name}: ${item.message.replace(/booking [0-9a-f-]{36}/, "booking …")}`) ?? 0) + 1);
  return [...groups.entries()].map(([message, count]) => `- ${message}${count > 1 ? ` (${count} times)` : ""}`);
}
