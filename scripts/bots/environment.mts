import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { createWriteStream } from "node:fs";
import { userInfo } from "node:os";
import { fileURLToPath } from "node:url";
import { assertLocalTestDatabase, assertLoopbackBaseUrl, VENDOR_SECRET_KEYS } from "../lib/local-database-guard.mts";
import { sleep } from "./random.mts";

export const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

export interface LocalEnvironment {
  databaseUrl: URL;
  apiBaseUrl: string;
  ops: { email: string; password: string };
  stop(): Promise<void>;
}

export interface EnvironmentOptions {
  /** BOT_DATABASE_URL; must be loopback and named *test* or *scale*. */
  databaseUrl?: string;
  apiPort?: number;
  /** Drop and recreate the database first so invariants only see this run's rows. */
  fresh: boolean;
  /** Connection pool size for the API under test. */
  connectionLimit?: number;
  /** The API's stdout and stderr go here, so a 500 in the run can be traced to its stack. */
  apiLogPath?: string;
  /** Extra API environment, such as CORS_ALLOWED_ORIGINS for a local web app. Vendor keys stay blank. */
  apiEnv?: Record<string, string>;
  log?: (line: string) => void;
}

function run(command: string, args: string[], env: NodeJS.ProcessEnv) {
  const result = spawnSync(command, args, { cwd: repoRoot, env, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed:\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}

/** Environment for child processes: the shell's PATH and friends, never a vendor credential. */
export function scrubbedEnv(extra: Record<string, string>): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const key of VENDOR_SECRET_KEYS) env[key] = "";
  // Keep the API in local mode: password reset and 2FA codes are previewable only outside staging/production.
  env.NODE_ENV = "development";
  return { ...env, ...extra };
}

/**
 * Creates (or recreates) a disposable local database, migrates it, creates an ops account, and starts the API on a
 * loopback port with launch defaults (payments and crew marketplace off). Never touches a non-loopback host.
 */
export async function startLocalEnvironment(options: EnvironmentOptions): Promise<LocalEnvironment> {
  const log = options.log ?? (line => console.log(`[bots] ${line}`));
  const databaseUrl = assertLocalTestDatabase(
    options.databaseUrl ?? process.env.BOT_DATABASE_URL ?? `postgresql://${userInfo().username}@localhost:5432/yardmatch_bots_test`, "BOT_DATABASE_URL"
  );
  const databaseName = databaseUrl.pathname.slice(1);
  const port = options.apiPort ?? Number(process.env.BOT_API_PORT ?? 4011);
  const apiBaseUrl = assertLoopbackBaseUrl(`http://127.0.0.1:${port}`, "BOT_API_PORT").origin;
  const adminUrl = new URL(databaseUrl.toString());
  adminUrl.pathname = "/postgres";
  adminUrl.search = "";

  const pgEnv = scrubbedEnv({});
  if (options.fresh) {
    log(`recreating ${databaseName}`);
    run("psql", [adminUrl.toString(), "-v", "ON_ERROR_STOP=1", "-c", `DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`], pgEnv);
    run("psql", [adminUrl.toString(), "-v", "ON_ERROR_STOP=1", "-c", `CREATE DATABASE "${databaseName}"`], pgEnv);
  }
  const plainUrl = new URL(databaseUrl.toString());
  plainUrl.search = "";
  const dbEnv = scrubbedEnv({ DATABASE_URL: plainUrl.toString() });
  log("applying migrations");
  // The repo deploy script applies the init migration first on an empty database, as production does.
  run(process.execPath, ["scripts/deploy-database.mjs"], dbEnv);

  const ops = { email: "bot-ops@example.invalid", password: "Bot-Ops-Local-Only-9q!Xz" };
  run(process.execPath, ["--import", "tsx", "apps/api/src/scripts/createOpsUser.ts", "--email", ops.email, "--name", "Bot Ops",
    "--password", ops.password, "--phone", "555-0199", "--scope", "admin"], dbEnv);

  const apiUrl = new URL(plainUrl.toString());
  apiUrl.searchParams.set("connection_limit", String(options.connectionLimit ?? 10));
  apiUrl.searchParams.set("pool_timeout", "20");
  const apiEnv = scrubbedEnv({
    DATABASE_URL: apiUrl.toString(), PORT: String(port), API_BASE_URL: apiBaseUrl, APP_BASE_URL: "http://localhost:3000",
    YARDMATCH_ENV: "local", JWT_SECRET: "bots-local-only-jwt-secret-not-for-any-deployed-environment",
    // Local mode turns both launch features on; the bots test the launch configuration, where both are off.
    YARDMATCH_PAYMENTS_ENABLED: "false", YARDMATCH_CREW_MARKETPLACE_ENABLED: "false",
    ...Object.fromEntries(Object.entries(options.apiEnv ?? {}).filter(([key]) => !VENDOR_SECRET_KEYS.includes(key)))
  });
  log(`starting API on ${apiBaseUrl}`);
  const api: ChildProcess = spawn(process.execPath, ["--import", "tsx", "apps/api/src/index.ts"], { cwd: repoRoot, env: apiEnv, stdio: ["ignore", "pipe", "pipe"] });
  const output: string[] = [];
  const apiLog = options.apiLogPath ? createWriteStream(options.apiLogPath) : undefined;
  api.stdout?.on("data", chunk => { output.push(String(chunk)); apiLog?.write(chunk); });
  api.stderr?.on("data", chunk => { output.push(String(chunk)); apiLog?.write(chunk); });
  const closed = new Promise(resolve => api.once("close", resolve));

  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (api.exitCode !== null) break;
    try {
      const response = await fetch(`${apiBaseUrl}/readyz`);
      if (response.ok) break;
    } catch { /* not up yet */ }
    await sleep(400);
  }
  if (api.exitCode !== null || Date.now() >= deadline) {
    api.kill("SIGKILL");
    throw new Error(`API did not start:\n${output.join("").slice(-4000)}`);
  }

  return {
    databaseUrl: plainUrl, apiBaseUrl, ops,
    async stop() {
      api.kill("SIGTERM");
      const force = setTimeout(() => api.kill("SIGKILL"), 5_000);
      await closed;
      clearTimeout(force);
    }
  };
}
