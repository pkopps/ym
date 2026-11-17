/**
 * Bot army, part 2: network simulation. Seeds a synthetic market (default shaped like Barnegat, NJ), runs a simulated
 * booking season through the HTTP API at several supply levels, and writes a side-by-side report of matching
 * efficiency. Local only, with the same guards as `npm run bots`. Crew is measured as the provider tool it is; the
 * simulation does not change how crew is matched.
 *
 *   npm run bots:simulate -- --providers 5,15,40 --owners 150 --seed 3
 *
 * Time model: each tick is one simulated hour of the booking season. Owners send requests at random ticks; each provider
 * opens the app on a tick with its own probability, then accepts, declines when that day is full, and reviews crew.
 * "Time to acceptance" and "crew fill time" are in simulated hours. Visits are not worked or completed here.
 * This tests the matching rules on invented supply and demand; it does not predict the real market.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { userInfo } from "node:os";
import { parseArgs } from "node:util";
import { PrismaClient } from "@prisma/client";
import { mapConcurrent } from "../../apps/api/src/concurrency";
import { assertLocalTestDatabase } from "../lib/local-database-guard.mts";
import { ApiError } from "./client.mts";
import { startLocalEnvironment, repoRoot } from "./environment.mts";
import { requiredCrew } from "./check-invariants.mts";
import { BARNEGAT_MARKET, distanceMiles, type Zone } from "./market.mts";
import {
  book, bookingIdFromCreate, listProviderBookings, localDayAt, search, signUpCrew, signUpOps, signUpOwner, signUpProvider,
  type BotSettings, type CrewBot, type OwnerBot, type ProviderBot
} from "./personas.mts";
import { RunRecorder } from "./recorder.mts";
import { Rng } from "./random.mts";

/* eslint-disable @typescript-eslint/no-explicit-any -- bots read loosely typed JSON responses */

const { values: args } = parseArgs({
  options: {
    providers: { type: "string", default: "5,15,40" },
    owners: { type: "string", default: "150" },
    "crew-per-provider": { type: "string", default: "2" },
    radius: { type: "string", default: "8-20" },
    "requests-per-owner": { type: "string", default: "2" },
    ticks: { type: "string", default: "36" },
    "jobs-per-day": { type: "string", default: "5" },
    seed: { type: "string", default: "3" },
    concurrency: { type: "string", default: "24" }
  }
});

assertLocalTestDatabase(process.env.BOT_DATABASE_URL ?? `postgresql://${userInfo().username}@localhost:5432/yardmatch_bots_test`, "BOT_DATABASE_URL");
const densities = args.providers.split(",").map(Number).filter(Boolean);
const [radiusMin, radiusMax = radiusMin] = args.radius.split("-").map(Number) as [number, number?];
const config = {
  densities, owners: Number(args.owners), crewPerProvider: Number(args["crew-per-provider"]), radiusMiles: [radiusMin, radiusMax] as [number, number],
  requestsPerOwner: Number(args["requests-per-owner"]), ticks: Number(args.ticks), jobsPerDay: Number(args["jobs-per-day"]), seed: Number(args.seed),
  concurrency: Number(args.concurrency), market: "Barnegat, NJ"
};
const outDir = join(repoRoot, "reports/network-sim", `${new Date().toISOString().replace(/[:.]/g, "-")}-seed-${config.seed}`);
mkdirSync(outDir, { recursive: true });
const log = (line: string) => console.log(`[simulate] ${line}`);

interface Request {
  ownerId: string;
  propertyId: string;
  postalCode: string;
  point: { latitude: number; longitude: number };
  tick: number;
  category: string;
  recurring?: "weekly" | "biweekly";
  matched?: boolean;
  /** Providers the search ranked, with or without an open slot. */
  ranked?: number;
  bookingId?: string;
  booked?: boolean;
}

interface Tracked {
  bookingId: string;
  ownerId: string;
  providerId: string;
  requestTick: number;
  acceptTick?: number;
  declined?: boolean;
  recoveredTick?: number;
  replacementOffered?: boolean;
  crewNeeded?: number;
  crewFilledTick?: number;
}

const results: Array<Awaited<ReturnType<typeof simulate>>> = [];
for (const providerCount of densities) {
  results.push(await simulate(providerCount));
}
writeFileSync(join(outDir, "config.json"), `${JSON.stringify(config, null, 2)}\n`);
writeFileSync(join(outDir, "summary.md"), summarize(results));
log(`report: ${join(outDir, "summary.md")}`);
process.exit(0);

async function simulate(providerCount: number) {
  const rng = new Rng(config.seed * 1000 + providerCount);
  const recorder = new RunRecorder(outDir, `providers-${providerCount}`);
  log(`=== ${providerCount} providers, ${providerCount * config.crewPerProvider} crew, ${config.owners} owners ===`);
  const env = await startLocalEnvironment({ fresh: true, connectionLimit: 10, log, apiLogPath: join(recorder.dir, "api.log") });
  const prisma = new PrismaClient({ datasourceUrl: env.databaseUrl.toString() });
  const settings: BotSettings = {
    baseUrl: env.apiBaseUrl, runId: `sim${config.seed}p${providerCount}`, recorder, zones: BARNEGAT_MARKET,
    radiusMiles: config.radiusMiles, horizonDays: 21, timing: { minDelayMs: 0, maxDelayMs: 0 }
  };
  try {
    const ops = await signUpOps(settings, env.ops);
    const providers = (await mapConcurrent([...Array(providerCount).keys()], 6, index =>
      signUpProvider(settings, ops, rng.fork(`provider-${index}`), index).catch(error => { log(`provider ${index}: ${error.message}`); return undefined; })))
      .filter((item): item is ProviderBot => Boolean(item));
    const crew = (await mapConcurrent([...Array(providerCount * config.crewPerProvider).keys()], 8, index =>
      signUpCrew(settings, rng.fork(`crew-${index}`), index).catch(() => undefined))).filter((item): item is CrewBot => Boolean(item));
    const owners = (await mapConcurrent([...Array(config.owners).keys()], config.concurrency, index =>
      signUpOwner(settings, rng.fork(`owner-${index}`), index).catch(() => undefined))).filter((item): item is OwnerBot => Boolean(item));
    const ownerById = new Map(owners.map(owner => [owner.id, owner]));
    const providerById = new Map(providers.map(provider => [provider.id, provider]));
    // Each provider opens the app on a given hour with its own probability; busy owners of small firms check less often.
    const checkRate = new Map(providers.map(provider => [provider.id, 0.25 + provider.rng.next() * 0.6]));
    log(`signed up ${providers.length} providers, ${crew.length} crew, ${owners.length} owners`);

    const requests: Request[] = owners.flatMap(owner => [...Array(config.requestsPerOwner).keys()].map(() => {
      const property = owner.rng.pick(owner.properties);
      return {
        ownerId: owner.id, propertyId: property.id, postalCode: property.address.postalCode, point: property.address.point,
        tick: owner.rng.int(0, Math.max(config.ticks - 8, 1)),
        category: owner.rng.chance(0.8) ? "lawn-mowing" : owner.rng.pick(["hedge-trimming", "leaf-blowing", "seasonal-cleanup", "mulch-installation"]),
        recurring: owner.rng.chance(0.3) ? owner.rng.pick(["weekly", "biweekly"] as const) : undefined
      };
    }));
    const tracked = new Map<string, Tracked>();

    for (let tick = 0; tick < config.ticks; tick += 1) {
      // Owners: requests due this tick.
      await mapConcurrent(requests.filter(item => item.tick === tick), config.concurrency, async request => {
        const owner = ownerById.get(request.ownerId)!;
        const property = owner.properties.find(item => item.id === request.propertyId)!;
        const day = owner.rng.int(2, settings.horizonDays - 1);
        const found = await owner.client.attempt(() => search(owner, property, request.category, localDayAt(day, 9).toISOString()));
        const choices = (found?.ranked ?? []).filter(item => item.slot);
        request.matched = choices.length > 0;
        request.ranked = found?.ranked.length ?? 0;
        for (const choice of choices.slice(0, 3)) {
          for (let attempt = 0; attempt < 3 && !request.booked; attempt += 1) {
            const start = new Date(choice.slot!.startIso);
            start.setUTCHours(start.getUTCHours() + owner.rng.int(0, 7));
            try {
              const created = await book(owner, { providerId: choice.providerId, property, category: request.category, startIso: start.toISOString(),
                endIso: new Date(start.getTime() + 3_600_000).toISOString() }, { recurring: request.recurring, expect: [409] });
              const bookingId = bookingIdFromCreate(created) ?? created.id;
              request.booked = true;
              request.bookingId = bookingId;
              tracked.set(bookingId, { bookingId, ownerId: owner.id, providerId: choice.providerId, requestTick: tick,
                crewNeeded: requiredCrew(request.category, property.lawnSizeSqFt) });
            } catch (error) {
              if (!(error instanceof ApiError)) throw error;
            }
          }
          if (request.booked) break;
        }
      });

      // Owners whose visit was declined: ask for a replacement.
      await mapConcurrent([...tracked.values()].filter(item => item.declined && item.recoveredTick === undefined), config.concurrency, async item => {
        const owner = ownerById.get(item.ownerId)!;
        const options = await owner.client.attempt(() => owner.client.post<any>("/api/bookings/recovery-options", { bookingId: item.bookingId }, { action: "recovery options" }));
        const alternative = options?.alternatives?.[0];
        item.replacementOffered = Boolean(alternative);
        if (!options?.recovery || !alternative) return;
        const replaced = await owner.client.attempt(() => owner.client.post<any>("/api/bookings/recover", { bookingId: item.bookingId, recoveryId: options.recovery.id,
          action: "replace", providerId: alternative.providerId, scheduledStartIso: alternative.startIso, scheduledEndIso: alternative.endIso }, { action: "replace provider" }));
        if (replaced) {
          item.recoveredTick = tick;
          item.providerId = replaced.providerId;
          item.declined = false;
          item.acceptTick = undefined;
        }
      });

      // Providers who open the app this tick.
      await Promise.all(providers.filter(provider => provider.rng.chance(checkRate.get(provider.id)!)).map(async provider => {
        const bookings = await provider.client.attempt(() => listProviderBookings(provider)) ?? [];
        const perDay = new Map<string, number>();
        for (const booking of bookings) {
          if (booking.status === "confirmed") perDay.set(booking.scheduledStartIso.slice(0, 10), (perDay.get(booking.scheduledStartIso.slice(0, 10)) ?? 0) + 1);
        }
        for (const booking of bookings.filter(item => item.status === "requested" && item.recovery?.state !== "open")) {
          const day = booking.scheduledStartIso.slice(0, 10);
          const full = (perDay.get(day) ?? 0) >= config.jobsPerDay;
          const item = tracked.get(booking.id);
          if (!full && provider.rng.chance(0.95)) {
            const ok = await provider.client.attempt(() => provider.client.post("/api/bookings/confirm", { bookingId: booking.id }, { action: "accept" }));
            if (ok) {
              perDay.set(day, (perDay.get(day) ?? 0) + 1);
              if (item && item.acceptTick === undefined) item.acceptTick = tick;
            }
          } else {
            const ok = await provider.client.attempt(() => provider.client.post("/api/bookings/decline", { bookingId: booking.id, reason: full ? "That day is full" : "Not a fit" }, { action: "decline" }));
            if (ok && item) item.declined = true;
          }
        }
        // Review-first providers staff crew when they open the app; auto-accept providers are staffed by the API.
        const staffing = await provider.client.attempt(() => provider.client.get<any>("/api/providers/staffing", { action: "staffing overview" }));
        for (const job of staffing?.jobs ?? []) {
          const item = tracked.get(job.bookingId);
          if (item && item.crewFilledTick === undefined && job.requiredCrewMembers > 0 && job.assignedCrewMembers >= job.requiredCrewMembers) item.crewFilledTick = tick;
          if (provider.staffingMode !== "review-first" || job.crewGap <= 0) continue;
          const pending = (job.matches ?? []).filter((match: any) => match.status === "pending-provider-review").slice(0, job.crewGap);
          for (const match of pending) {
            await provider.client.attempt(() => provider.client.post("/api/providers/staffing/review", { crewMatchId: match.id, action: "accept" }, { action: "review crew", expect: [409] }));
          }
        }
      }));
      if (tick % 6 === 5) log(`tick ${tick + 1}/${config.ticks}: ${[...tracked.values()].filter(item => item.acceptTick !== undefined).length} accepted of ${tracked.size} booked`);
    }

    // Final crew read for every provider.
    for (const provider of providers) {
      const staffing = await provider.client.attempt(() => provider.client.get<any>("/api/providers/staffing", { action: "staffing overview" }));
      for (const job of staffing?.jobs ?? []) {
        const item = tracked.get(job.bookingId);
        if (item && item.crewFilledTick === undefined && job.assignedCrewMembers >= job.requiredCrewMembers) item.crewFilledTick = config.ticks;
        if (item) item.crewNeeded = job.requiredCrewMembers;
      }
    }

    const metrics = await measure(prisma, providerCount, providers, crew.length, requests, tracked, providerById);
    writeFileSync(join(outDir, `providers-${providerCount}.json`), `${JSON.stringify(metrics, null, 2)}\n`);
    writeFileSync(join(outDir, `map-providers-${providerCount}.svg`), drawMap(providers, requests, BARNEGAT_MARKET));
    return metrics;
  } finally {
    await prisma.$disconnect();
    await env.stop();
  }
}

async function measure(prisma: PrismaClient, providerCount: number, providers: ProviderBot[], crewCount: number, requests: Request[],
  tracked: Map<string, Tracked>, providerById: Map<string, ProviderBot>) {
  const searches = requests.filter(item => item.matched !== undefined);
  const byZip = new Map<string, { searches: number; matched: number; booked: number }>();
  for (const request of searches) {
    const row = byZip.get(request.postalCode) ?? { searches: 0, matched: 0, booked: 0 };
    row.searches += 1;
    if (request.matched) row.matched += 1;
    if (request.booked) row.booked += 1;
    byZip.set(request.postalCode, row);
  }
  const zips = [...byZip.entries()].map(([postalCode, row]) => ({
    postalCode, city: BARNEGAT_MARKET.find(zone => zone.postalCode === postalCode)?.city ?? "", ...row, fillRate: ratio(row.matched, row.searches)
  })).sort((a, b) => a.fillRate - b.fillRate);

  const items = [...tracked.values()];
  const accepted = items.filter(item => item.acceptTick !== undefined);
  const hoursToAccept = accepted.map(item => item.acceptTick! - item.requestTick);
  const declinedEver = items.filter(item => item.declined || item.recoveredTick !== undefined);
  const recovered = items.filter(item => item.recoveredTick !== undefined);

  // Utilization from the database: booked hours over published hours, per provider.
  const ids = providers.map(provider => provider.id);
  const [slots, bookings] = await Promise.all([
    prisma.availabilitySlot.findMany({ where: { providerId: { in: ids } }, select: { providerId: true, startIso: true, endIso: true } }),
    prisma.booking.findMany({ where: { providerId: { in: ids }, status: { in: ["requested", "confirmed"] } },
      select: { id: true, providerId: true, status: true, scheduledStartIso: true, scheduledEndIso: true, serviceAddress: true } })
  ]);
  const hours = (start: Date, end: Date) => (end.getTime() - start.getTime()) / 3_600_000;
  const published = new Map<string, number>(), booked = new Map<string, number>();
  for (const slot of slots) published.set(slot.providerId, (published.get(slot.providerId) ?? 0) + hours(slot.startIso, slot.endIso));
  const confirmed = bookings.filter(row => row.status === "confirmed");
  for (const row of confirmed) booked.set(row.providerId, (booked.get(row.providerId) ?? 0) + hours(row.scheduledStartIso, row.scheduledEndIso));
  const utilization = ids.map(id => ratio(booked.get(id) ?? 0, published.get(id) ?? 0));
  const jobsPerProvider = ids.map(id => confirmed.filter(row => row.providerId === id).length);

  // Travel: provider base to property, and the day's route in visit order (base, stops, base).
  const miles: number[] = [];
  const days = new Map<string, Array<{ start: number; point: { latitude: number; longitude: number } }>>();
  for (const row of confirmed) {
    const provider = providerById.get(row.providerId)!;
    const point = (row.serviceAddress as { point: { latitude: number; longitude: number } }).point;
    miles.push(distanceMiles(provider.address.point, point));
    const key = `${row.providerId}|${row.scheduledStartIso.toISOString().slice(0, 10)}`;
    days.set(key, [...(days.get(key) ?? []), { start: row.scheduledStartIso.getTime(), point }]);
  }
  const routeMilesPerJob: number[] = [], jobsPerDay: number[] = [];
  for (const [key, stops] of days) {
    const base = providerById.get(key.split("|")[0]!)!.address.point;
    const ordered = stops.sort((a, b) => a.start - b.start).map(stop => stop.point);
    let total = 0, at = base;
    for (const point of [...ordered, base]) { total += distanceMiles(at, point); at = point; }
    routeMilesPerJob.push(total / ordered.length);
    jobsPerDay.push(ordered.length);
  }

  const crewJobs = accepted.filter(item => (item.crewNeeded ?? 0) > 0);
  const crewFilled = crewJobs.filter(item => item.crewFilledTick !== undefined);
  return {
    providers: providerCount, crew: crewCount, owners: new Set(requests.map(item => item.ownerId)).size, requests: requests.length,
    searchFillRate: ratio(searches.filter(item => item.matched).length, searches.length),
    bookedRate: ratio(searches.filter(item => item.booked).length, searches.length),
    deadZones: zips.filter(row => row.fillRate < 0.5).map(row => `${row.postalCode} ${row.city}`),
    unmatched: { noProviderForServiceInRange: searches.filter(item => !item.matched && !item.ranked).length,
      providersButNoOpenSlot: searches.filter(item => !item.matched && (item.ranked ?? 0) > 0).length },
    zips,
    acceptance: { booked: items.length, accepted: accepted.length, acceptedRate: ratio(accepted.length, items.length),
      medianHours: quantile(hoursToAccept, 0.5), p90Hours: quantile(hoursToAccept, 0.9), within4Hours: ratio(hoursToAccept.filter(value => value <= 4).length, hoursToAccept.length) },
    utilization: { median: quantile(utilization, 0.5), max: Math.max(0, ...utilization), gini: gini(jobsPerProvider),
      topFifthShareOfJobs: topShare(jobsPerProvider, 0.2), providersWithNoJobs: jobsPerProvider.filter(value => value === 0).length },
    travel: { medianMilesPerJob: quantile(miles, 0.5), p90MilesPerJob: quantile(miles, 0.9), medianRouteMilesPerJob: quantile(routeMilesPerJob, 0.5),
      medianJobsPerActiveDay: quantile(jobsPerDay, 0.5) },
    crew: { jobsNeedingCrew: crewJobs.length, fillRate: ratio(crewFilled.length, crewJobs.length),
      medianHoursToFill: quantile(crewFilled.map(item => Math.max(item.crewFilledTick! - (item.acceptTick ?? item.requestTick), 0)), 0.5) },
    recovery: { declined: declinedEver.length, replacementOffered: declinedEver.filter(item => item.replacementOffered || item.recoveredTick !== undefined).length,
      recovered: recovered.length, rate: ratio(recovered.length, declinedEver.length) }
  };
}

function summarize(rows: Array<Awaited<ReturnType<typeof simulate>>>): string {
  const pct = (value: number) => `${Math.round(value * 100)}%`;
  const num = (value: number) => (Number.isFinite(value) ? (Math.round(value * 10) / 10).toString() : "–");
  const line = (label: string, pick: (row: (typeof rows)[number]) => string) => `| ${label} | ${rows.map(pick).join(" | ")} |`;
  return [
    `# Network simulation, ${config.market}`, "",
    `Seed ${config.seed}. ${config.owners} owners, ${config.requestsPerOwner} requests each over ${config.ticks} simulated hours; service radius ${config.radiusMiles.join("–")} miles; providers take at most ${config.jobsPerDay} jobs a day and publish 8am–5pm on about three days in four for 21 days; ${config.crewPerProvider} crew per provider.`,
    "Invented supply and demand on the real matching rules. It shows where the rules strain; it does not predict the real market.", "",
    `| Measure | ${rows.map(row => `${row.providers} providers`).join(" | ")} |`, `| --- | ${rows.map(() => "---:").join(" | ")} |`,
    line("Search fill rate (at least one bookable provider)", row => pct(row.searchFillRate)),
    line("Requests that ended in a booking", row => pct(row.bookedRate)),
    line("Dead zones (ZIPs under 50% fill)", row => row.deadZones.join(", ") || "none"),
    line("Unmatched: no provider offers it in range / providers but no open slot", row => `${row.unmatched.noProviderForServiceInRange} / ${row.unmatched.providersButNoOpenSlot}`),
    line("Bookings accepted by the end", row => `${pct(row.acceptance.acceptedRate)} of ${row.acceptance.booked}`),
    line("Time to acceptance, median / p90 (sim hours)", row => `${num(row.acceptance.medianHours)} / ${num(row.acceptance.p90Hours)}`),
    line("Accepted within 4 hours", row => pct(row.acceptance.within4Hours)),
    line("Provider utilization, median / max (booked ÷ published hours)", row => `${pct(row.utilization.median)} / ${pct(row.utilization.max)}`),
    line("Share of jobs held by the top fifth of providers", row => pct(row.utilization.topFifthShareOfJobs)),
    line("Gini of jobs per provider (0 even, 1 one provider)", row => num(row.utilization.gini)),
    line("Providers with no jobs", row => String(row.utilization.providersWithNoJobs)),
    line("Miles from provider base to property, median / p90", row => `${num(row.travel.medianMilesPerJob)} / ${num(row.travel.p90MilesPerJob)}`),
    line("Route miles per job on a working day, median", row => num(row.travel.medianRouteMilesPerJob)),
    line("Jobs per active provider-day, median", row => num(row.travel.medianJobsPerActiveDay)),
    line("Crew fill rate (accepted jobs reaching required crew)", row => `${pct(row.crew.fillRate)} of ${row.crew.jobsNeedingCrew}`),
    line("Crew fill time, median (sim hours after acceptance)", row => num(row.crew.medianHoursToFill)),
    line("Recovery rate (declined visits that got a replacement)", row => `${pct(row.recovery.rate)} (${row.recovery.recovered} of ${row.recovery.declined})`),
    "", "## Fill rate by ZIP", "",
    `| ZIP | ${rows.map(row => `${row.providers} providers`).join(" | ")} |`, `| --- | ${rows.map(() => "---:").join(" | ")} |`,
    ...BARNEGAT_MARKET.map(zone => `| ${zone.postalCode} ${zone.city} | ${rows.map(row => {
      const zip = row.zips.find(item => item.postalCode === zone.postalCode);
      return zip ? `${pct(zip.fillRate)} (${zip.searches})` : "–";
    }).join(" | ")} |`),
    "", `Maps: ${rows.map(row => `\`map-providers-${row.providers}.svg\``).join(", ")} (green: request matched; red: no bookable provider; circles: provider service radius).`, ""
  ].join("\n");
}

function drawMap(providers: ProviderBot[], requests: Request[], zones: Zone[]): string {
  const lats = zones.map(zone => zone.latitude), lons = zones.map(zone => zone.longitude);
  const pad = 0.12, minLat = Math.min(...lats) - pad, maxLat = Math.max(...lats) + pad, minLon = Math.min(...lons) - pad, maxLon = Math.max(...lons) + pad;
  const width = 640, height = Math.round(width * ((maxLat - minLat) / ((maxLon - minLon) * Math.cos((39.75 * Math.PI) / 180))));
  const x = (lon: number) => ((lon - minLon) / (maxLon - minLon)) * width, y = (lat: number) => height - ((lat - minLat) / (maxLat - minLat)) * height;
  const milesToPx = width / ((maxLon - minLon) * 69 * Math.cos((39.75 * Math.PI) / 180));
  return [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" font-family="sans-serif" font-size="11">`,
    `<rect width="100%" height="100%" fill="#f7f6f2"/>`,
    ...providers.map(provider => `<circle cx="${x(provider.address.point.longitude).toFixed(1)}" cy="${y(provider.address.point.latitude).toFixed(1)}" r="${(provider.serviceRadiusMiles * milesToPx).toFixed(1)}" fill="#3b7d4f" fill-opacity="0.05" stroke="#3b7d4f" stroke-opacity="0.25"/>`),
    ...requests.filter(item => item.matched !== undefined).map(item => `<circle cx="${x(item.point.longitude).toFixed(1)}" cy="${y(item.point.latitude).toFixed(1)}" r="3" fill="${item.matched ? "#3b7d4f" : "#c0392b"}"/>`),
    ...providers.map(provider => `<rect x="${(x(provider.address.point.longitude) - 4).toFixed(1)}" y="${(y(provider.address.point.latitude) - 4).toFixed(1)}" width="8" height="8" fill="#1f2a44"/>`),
    ...zones.map(zone => `<text x="${(x(zone.longitude) + 6).toFixed(1)}" y="${(y(zone.latitude) - 6).toFixed(1)}" fill="#444">${zone.city} ${zone.postalCode}</text>`),
    "</svg>"].join("\n");
}

function ratio(part: number, whole: number) { return whole ? part / whole : 0; }
function quantile(values: number[], q: number) {
  if (!values.length) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]!;
}
function gini(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b), n = sorted.length, total = sorted.reduce((sum, value) => sum + value, 0);
  if (!n || !total) return 0;
  return sorted.reduce((sum, value, index) => sum + (2 * (index + 1) - n - 1) * value, 0) / (n * total);
}
function topShare(values: number[], fraction: number) {
  const sorted = [...values].sort((a, b) => b - a), total = sorted.reduce((sum, value) => sum + value, 0);
  return total ? sorted.slice(0, Math.max(1, Math.round(sorted.length * fraction))).reduce((sum, value) => sum + value, 0) / total : 0;
}
