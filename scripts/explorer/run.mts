/**
 * Bot army, part 3: explorer runner. Starts a local API (disposable database, launch flags off, vendor keys blank) and
 * the web app, seeds the world one persona needs, writes that persona's brief (a goal, never steps), and keeps both
 * servers up until it is stopped. An explorer agent (see .claude/agents/yardmatch-explorer.md) then uses the web app in
 * a browser as that persona and writes reports/explorer/<persona>-<timestamp>.md.
 *
 *   npm run explorer -- --persona provider-busy-day
 *
 * Personas: first-time-owner, owner-two-properties, new-provider, provider-busy-day, crew-member, forgot-password.
 * Local only: the database guard, loopback ports and @example.invalid emails from the bot harness apply.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { createWriteStream, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { userInfo } from "node:os";
import { parseArgs } from "node:util";
import { mapConcurrent } from "../../apps/api/src/concurrency";
import { assertLocalTestDatabase } from "../lib/local-database-guard.mts";
import { repoRoot, scrubbedEnv, startLocalEnvironment } from "../bots/environment.mts";
import { BARNEGAT_MARKET } from "../bots/market.mts";
import {
  BOT_PASSWORD, book, listProviderBookings, localDayAt, signUpCrew, signUpOps, signUpOwner, signUpProvider,
  type BotSettings, type OwnerBot, type ProviderBot
} from "../bots/personas.mts";
import { RunRecorder } from "../bots/recorder.mts";
import { Rng, sleep } from "../bots/random.mts";
import { PERSONAS, type PersonaName } from "./personas.mts";


const { values: args } = parseArgs({
  options: {
    persona: { type: "string" },
    seed: { type: "string", default: "21" },
    "api-port": { type: "string", default: "4012" },
    "web-port": { type: "string", default: "3012" }
  }
});
const persona = args.persona as PersonaName;
if (!persona || !(persona in PERSONAS)) {
  throw new Error(`--persona must be one of: ${Object.keys(PERSONAS).join(", ")}`);
}
const databaseUrl = process.env.EXPLORER_DATABASE_URL ?? `postgresql://${userInfo().username}@localhost:5432/yardmatch_explorer_test`;
assertLocalTestDatabase(databaseUrl, "EXPLORER_DATABASE_URL");
const apiPort = Number(args["api-port"]), webPort = Number(args["web-port"]);
const webBaseUrl = `http://localhost:${webPort}`;
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const runDir = join(repoRoot, "reports/explorer/runs", `${persona}-${stamp}`);
mkdirSync(runDir, { recursive: true });
const log = (line: string) => console.log(`[explorer] ${line}`);
const recorder = new RunRecorder(runDir, "seed");

const env = await startLocalEnvironment({
  databaseUrl, apiPort, fresh: true, log, apiLogPath: join(runDir, "api.log"),
  apiEnv: { CORS_ALLOWED_ORIGINS: `${webBaseUrl},http://127.0.0.1:${webPort}`, APP_BASE_URL: webBaseUrl }
});

// next dev rewrites next-env.d.ts to point at its build folder; put the committed file back on stop.
const nextEnvPath = join(repoRoot, "apps/web/next-env.d.ts");
const nextEnv = readFileSync(nextEnvPath, "utf8");
log(`starting web app on ${webBaseUrl}`);
const web: ChildProcess = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "apps/web", "--port", String(webPort)], {
  cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"],
  env: scrubbedEnv({ NEXT_PUBLIC_API_BASE_URL: env.apiBaseUrl, YARDMATCH_NEXT_DIST_DIR: ".next-explorer", NEXT_TELEMETRY_DISABLED: "1",
    // Same launch configuration as the API: payments and the crew marketplace off.
    YARDMATCH_PAYMENTS_ENABLED: "false", YARDMATCH_CREW_MARKETPLACE_ENABLED: "false", APP_BASE_URL: webBaseUrl })
});
const webLog = createWriteStream(join(runDir, "web.log"));
web.stdout?.pipe(webLog);
web.stderr?.pipe(webLog);

const stop = async () => {
  web.kill("SIGTERM");
  await env.stop();
  writeFileSync(nextEnvPath, nextEnv);
};
process.on("SIGINT", () => void stop().then(() => process.exit(0)));
process.on("SIGTERM", () => void stop().then(() => process.exit(0)));

try {
  const settings: BotSettings = {
    baseUrl: env.apiBaseUrl, runId: `explore-${persona}`, recorder, zones: BARNEGAT_MARKET, radiusMiles: [12, 20], horizonDays: 21,
    timing: { minDelayMs: 0, maxDelayMs: 0 }
  };
  const rng = new Rng(Number(args.seed));
  const ops = await signUpOps(settings, env.ops);
  // Every persona lives in a working market: a handful of verified providers around Barnegat with open days.
  const providers = (await mapConcurrent([0, 1, 2, 3, 4, 5], 3, index => signUpProvider(settings, ops, rng.fork(`provider-${index}`), index,
    BARNEGAT_MARKET[index % 4]))).filter(Boolean) as ProviderBot[];
  const extra = await seedPersona(persona, settings, rng, providers);
  const brief = PERSONAS[persona];
  const lines = [
    `# Explorer brief: ${brief.title}`, "",
    `Web app: ${webBaseUrl}`, "",
    "## Who you are", "", brief.who, "",
    "## Your goal", "", brief.goal, "",
    ...(extra.account ? ["## What you know", "", ...extra.account.map(line => `- ${line}`), ""] : []),
    "## Also check", "", ...brief.alsoCheck.map(line => `- ${line}`), "",
    "## Tools", "",
    `- Screenshots at 1440x900 and 390x844: \`npm run explorer:tools -- capture --web ${webBaseUrl} --api ${env.apiBaseUrl} --path <path> --out ${runDir} --name <step>${extra.loginHint ?? ""}\``,
    ...(persona === "forgot-password" ? [
      `- Expire your newest reset code: \`npm run explorer:tools -- expire-reset --email ${extra.email}\``,
      `- Check whether the session from before the reset still works: \`npm run explorer:tools -- check-session --api ${env.apiBaseUrl} --token-file ${join(runDir, "old-session.txt")}\``
    ] : []),
    ""
  ];
  writeFileSync(join(runDir, "brief.md"), lines.join("\n"));
  writeFileSync(join(runDir, "seed.json"), `${JSON.stringify({ persona, seed: Number(args.seed), webBaseUrl, apiBaseUrl: env.apiBaseUrl, ...extra.facts }, null, 2)}\n`);

  // Wait for the web app to answer before handing over.
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try { if ((await fetch(webBaseUrl)).status < 500) break; } catch { /* starting */ }
    await sleep(1_000);
  }
  log(`READY persona=${persona} web=${webBaseUrl} brief=${join(runDir, "brief.md")}`);
  await new Promise(() => undefined);
} catch (error) {
  log(`failed: ${error instanceof Error ? error.stack : String(error)}`);
  await stop();
  process.exit(1);
}

async function seedPersona(name: PersonaName, settings: BotSettings, rng: Rng, providers: ProviderBot[]):
  Promise<{ account?: string[]; loginHint?: string; email?: string; facts?: Record<string, unknown> }> {
  const signIn = (email: string) => ` --email ${email} --password '${BOT_PASSWORD}'`;
  if (name === "first-time-owner" || name === "new-provider") return { facts: { providers: providers.length } };

  if (name === "owner-two-properties" || name === "forgot-password") {
    const owner = await signUpOwner(settings, rng.fork("persona-owner"), 900, BARNEGAT_MARKET[0]);
    if (name === "owner-two-properties" && !owner.properties.some(item => item.address.city === "Manahawkin")) {
      const second = { label: "Beach house", address: { line1: "212 Bay Ave", city: "Manahawkin", state: "NJ", postalCode: "08050", country: "US", point: { latitude: 39.6961, longitude: -74.2551 } }, lawnSizeSqFt: 7200 };
      await owner.client.post("/api/customers/properties", second, { action: "add property" });
    }
    if (name === "forgot-password") {
      // One past visit makes the account worth getting back into; the session from before the reset is kept to test logout.
      await bookOne(owner, providers[0]!, 3);
      writeFileSync(join(runDir, "old-session.txt"), owner.client.token!);
      return { account: [`Your email is ${owner.email}. You do not remember your password.`], email: owner.email, facts: { ownerId: owner.id } };
    }
    return { account: [`Email ${owner.email}`, `Password ${BOT_PASSWORD}`], loginHint: signIn(owner.email), facts: { ownerId: owner.id } };
  }

  // provider-busy-day and crew-member: one provider with a full day tomorrow and crew staffed by the API.
  const busy = providers[0]!;
  await busy.client.post("/api/providers/settings", { serviceRadiusMiles: 20, staffingMode: "auto-accept", routeLeaderMode: "accepted-crew-fallback" }, { action: "settings" });
  const crew = await mapConcurrent([0, 1, 2], 3, index => signUpCrew(settings, rng.fork(`persona-crew-${index}`), 800 + index));
  const owners = await mapConcurrent([0, 1, 2, 3, 4, 5, 6], 4, index => signUpOwner(settings, rng.fork(`persona-owner-${index}`), 700 + index, BARNEGAT_MARKET[index % 3]));
  for (const [index, owner] of owners.entries()) await bookOne(owner, busy, 1, 8 + index, index === 6 ? "weekly" : undefined);
  const bookings = await listProviderBookings(busy);
  // Leave the last request for the provider to answer; confirm the rest.
  for (const booking of bookings.slice(0, -1)) await busy.client.attempt(() => busy.client.post("/api/bookings/confirm", { bookingId: booking.id }, { action: "confirm" }));
  if (name === "provider-busy-day") {
    return { account: [`Email ${busy.email}`, `Password ${BOT_PASSWORD}`, `Business: Bot Lawn 0`], loginHint: signIn(busy.email), facts: { providerId: busy.id, bookings: bookings.length } };
  }
  const member = crew[0]!;
  return { account: [`Email ${member.email}`, `Password ${BOT_PASSWORD}`, "You work with Bot Lawn 0."], loginHint: signIn(member.email), facts: { crewMemberId: member.id } };
}

async function bookOne(owner: OwnerBot, provider: ProviderBot, days: number, hour = 9, recurring?: "weekly") {
  const start = localDayAt(days, hour);
  return book(owner, { providerId: provider.id, property: owner.properties[0]!, category: "lawn-mowing", startIso: start.toISOString(),
    endIso: new Date(start.getTime() + 3_600_000).toISOString() }, { recurring });
}
