import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { test } from "node:test";

async function unusedPort() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

for (const failStartup of [false, true]) {
  test(`API smoke exits and releases its server after ${failStartup ? "failure" : "success"}`, async () => {
    const port = await unusedPort();
    const child = spawn(process.execPath, ["scripts/api-smoke.mjs"], {
      cwd: new URL("..", import.meta.url),
      env: {
        ...process.env,
        API_BASE_URL: `http://127.0.0.1:${port}`,
        YARDMATCH_SMOKE_START_API: "1",
        YARDMATCH_SMOKE_DATABASE_URL: "",
        YARDMATCH_SMOKE_TIMEOUT_MS: failStartup ? "0" : "30000"
      },
      timeout: 45_000,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    const [code, signal] = await new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("close", (...result) => resolve(result));
    });
    assert.equal(signal, null, output);
    assert.equal(code, failStartup ? 1 : 0, output);
    assert.match(output, failStartup ? /API did not become reachable/ : /\[api-smoke\] passed/);
    // Binding the same port proves the smoke-owned API was stopped.
    const probe = createServer();
    await new Promise((resolve, reject) => {
      probe.once("error", reject);
      probe.listen(port, "127.0.0.1", resolve);
    });
    await new Promise((resolve) => probe.close(resolve));
  });
}
