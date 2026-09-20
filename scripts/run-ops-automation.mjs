import { mkdir, writeFile } from "node:fs/promises";
const base = process.env.API_BASE_URL;
const token = process.env.OPS_AUTOMATION_TOKEN;
if (!base || !token || token.length < 32) throw new Error("Configure API_BASE_URL and OPS_AUTOMATION_TOKEN.");
const url = new URL(base);
if (url.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(url.hostname)) throw new Error("Scheduler requires HTTPS.");
const response = await fetch(new URL("/api/observability/ops-automation/scheduled", url), {
  method: "POST", signal: AbortSignal.timeout(60000), headers: {Authorization: `Bearer ${token}`, "content-type": "application/json"},
  body: JSON.stringify({dryRun: process.env.OPS_AUTOMATION_EXECUTE !== "1"})
});
const result = await response.json();
if (!response.ok) throw new Error(`Scheduled run failed (${response.status}). Check the authenticated operations run history.`);
const evidence = {runId: result.runId, dryRun: result.dryRun, generatedAt: result.generatedAt,
  completedSweepCount: result.completedSweepCount, failedSweepCount: result.failedSweepCount};
await mkdir("reports/ci/ops-automation", {recursive: true});
await writeFile("reports/ci/ops-automation/run.json", JSON.stringify(evidence,null,2));
console.log(JSON.stringify(evidence));
if (result.failedSweepCount) process.exitCode = 1;
