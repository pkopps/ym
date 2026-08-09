import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const apiBaseUrl = (process.env.API_BASE_URL ?? "").trim().replace(/\/$/, "");
const webBaseUrl = (process.env.PLAYWRIGHT_BASE_URL ?? "").trim().replace(/\/$/, "");
const expectedRevision = process.env.YARDMATCH_EXPECTED_REVISION?.trim().slice(0, 12);
const allowLocal = process.env.YARDMATCH_ALLOW_LOCAL_STAGING_SMOKE === "1";
const timeoutMs = Number(process.env.YARDMATCH_DEPLOY_WAIT_MS ?? 12 * 60 * 1000);
const pollIntervalMs = 10_000;
const evidencePath = process.env.YARDMATCH_DEPLOYMENT_EVIDENCE_PATH?.trim();

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function readHealth(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": "YardMatch-Staging-Acceptance/1.0" },
    redirect: "error",
    signal: AbortSignal.timeout(20_000)
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}: ${text.slice(0, 500)}`);
  }
  return JSON.parse(text);
}

async function inspectTargets() {
  const [apiHealth, apiReadiness, webHealth] = await Promise.all([
    readHealth(`${apiBaseUrl}/healthz`),
    readHealth(`${apiBaseUrl}/readyz`),
    readHealth(`${webBaseUrl}/api/healthz`)
  ]);
  assert(apiHealth.status === "ok", "API liveness is not healthy.");
  assert(apiReadiness.status === "ready", "API readiness is not healthy.");
  assert(webHealth.status === "ok" && webHealth.apiConfigured, "Web deployment is not configured for its API.");
  if (!allowLocal) {
    assert(apiHealth.environment === "staging", "API target is not explicitly staging.");
    assert(apiHealth.repository === "prisma-postgres", "Staging API is not using PostgreSQL.");
    assert(webHealth.environment === "staging", "Web target is not explicitly staging.");
  }
  if (expectedRevision) {
    assert(apiHealth.revision === expectedRevision, `API revision ${apiHealth.revision ?? "unknown"} does not match ${expectedRevision}.`);
    assert(webHealth.revision === expectedRevision, `Web revision ${webHealth.revision ?? "unknown"} does not match ${expectedRevision}.`);
  }
  return { apiHealth, apiReadiness, webHealth };
}

assert(apiBaseUrl && webBaseUrl, "API_BASE_URL and PLAYWRIGHT_BASE_URL are required.");
assert(Number.isFinite(timeoutMs) && timeoutMs >= 0 && timeoutMs <= 30 * 60 * 1000, "YARDMATCH_DEPLOY_WAIT_MS must be between 0 and 30 minutes.");
if (!allowLocal) {
  assert(apiBaseUrl.startsWith("https://"), "Staging API target must use HTTPS.");
  assert(webBaseUrl.startsWith("https://"), "Staging web target must use HTTPS.");
  assert(new URL(apiBaseUrl).origin !== new URL(webBaseUrl).origin, "Staging API and web must use distinct origins.");
}

const startedAt = Date.now();
let lastError;
let result;
while (Date.now() - startedAt <= timeoutMs) {
  try {
    result = await inspectTargets();
    break;
  } catch (error) {
    lastError = error;
    const remainingMs = timeoutMs - (Date.now() - startedAt);
    if (remainingMs <= 0) {
      break;
    }
    console.log(`[wait-for-staging] targets not ready: ${error instanceof Error ? error.message : String(error)}`);
    await new Promise((resolvePromise) => setTimeout(resolvePromise, Math.min(pollIntervalMs, remainingMs)));
  }
}

if (!result) {
  throw new Error(
    `Staging targets did not become ready within ${timeoutMs}ms: ${lastError instanceof Error ? lastError.message : String(lastError)}`
  );
}

const evidence = {
  status: "ready",
  expectedRevision: expectedRevision ?? null,
  apiBaseUrl,
  webBaseUrl,
  api: result.apiHealth,
  web: result.webHealth,
  verifiedAt: new Date().toISOString()
};
if (evidencePath) {
  const resolvedPath = resolve(evidencePath);
  await mkdir(dirname(resolvedPath), { recursive: true });
  await writeFile(resolvedPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
}
console.log(JSON.stringify(evidence, null, 2));
