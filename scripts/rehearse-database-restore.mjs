import {spawnSync} from "node:child_process";
import {mkdtemp, chmod, rm, mkdir, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
const source = new URL(process.env.BACKUP_SOURCE_DATABASE_URL ?? "");
const target = new URL(process.env.RESTORE_TARGET_DATABASE_URL ?? "");
const sourceName = decodeURIComponent(source.pathname.slice(1));
const targetName = decodeURIComponent(target.pathname.slice(1));
if (!["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) || !/^ym_restore_[a-z0-9_]+$/.test(targetName) ||
  (source.hostname === target.hostname && source.port === target.port && sourceName === targetName)) {
  throw new Error("Restore target must be a separate local database named ym_restore_*. Never target a live database.");
}
const bin = process.env.POSTGRES_BIN ?? "";
function run(command, args, url) {
  const result = spawnSync(bin ? join(bin,command) : command, args, {encoding: "utf8", timeout: 120000,
    env: {...process.env, PGHOST: url.hostname, PGPORT: url.port || "5432", PGUSER: decodeURIComponent(url.username),
      PGPASSWORD: decodeURIComponent(url.password), PGDATABASE: decodeURIComponent(url.pathname.slice(1))}});
  if (result.error || result.status !== 0) throw new Error(`${command} failed; check local database access and permissions.`);
  return result.stdout.trim();
}
const directory = await mkdtemp(join(tmpdir(), "yardmatch-restore-"));
await chmod(directory, 0o700);
const archive = join(directory,"backup.dump");
const started = Date.now();
try {
  const before = run("psql", ["-At", "-c", "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'"],target);
  if (before !== "0") throw new Error("Restore target is not empty; use a fresh isolated database.");
  run("pg_dump", ["--format=custom", "--no-owner", "--no-acl", "--file",archive], source);
  await chmod(archive,0o600);
  run("pg_restore", ["--no-owner", "--no-acl", "--exit-on-error", "--dbname",targetName,archive], target);
  const tables = run("psql",["-At","-c","SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename"], source).split("\n").filter(Boolean);
  const counts = [];
  for (const table of tables) {
    const sql = `SELECT count(*) FROM "${table.replaceAll('"','""')}"`;
    const expected = run("psql",["-At","-c",sql], source);
    const actual = run("psql",["-At","-c",sql], target);
    if (actual !== expected) throw new Error(`Restore row counts differ for ${table}; use a quiescent source for this rehearsal.`);
    counts.push({table, rows:Number(actual)});
  }
  await mkdir("reports/ci/restore-rehearsal",{recursive:true});
  await writeFile("reports/ci/restore-rehearsal/result.json", JSON.stringify({completedAt:new Date().toISOString(),
    durationMs:Date.now()-started, targetDatabase:targetName, verifiedTables:counts},null,2));
  console.log(`Restore verified: ${counts.length} tables. Evidence contains counts only.`);
} finally {
  await rm(directory,{recursive:true,force:true});
}
