import { spawn } from "node:child_process";

const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:4001";
const startApi = process.env.YARDMATCH_SMOKE_START_API !== "0";
const timeoutMs = Number(process.env.YARDMATCH_SMOKE_TIMEOUT_MS ?? 30_000);
let apiProcess;
const apiStartupOutput = [];

function log(message) {
  console.log(`[api-smoke] ${message}`);
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {})
    }
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : undefined;

  if (!response.ok) {
    throw new Error(`${options.method ?? "GET"} ${path} failed with ${response.status}: ${text}`);
  }

  return payload;
}

async function isApiReachable() {
  try {
    await request("/api/docs/openapi.json");
    return true;
  } catch {
    return false;
  }
}

function startLocalApi() {
  log(`starting API at ${apiBaseUrl}`);
  apiProcess = spawn("npm", ["run", "dev:api"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      API_BASE_URL: apiBaseUrl,
      PORT: new URL(apiBaseUrl).port || "4001",
      DATABASE_URL: process.env.YARDMATCH_SMOKE_DATABASE_URL ?? ""
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  apiProcess.stdout.on("data", (chunk) => {
    apiStartupOutput.push(chunk.toString());
    if (process.env.YARDMATCH_SMOKE_VERBOSE) {
      process.stdout.write(chunk);
    }
  });
  apiProcess.stderr.on("data", (chunk) => {
    apiStartupOutput.push(chunk.toString());
    if (process.env.YARDMATCH_SMOKE_VERBOSE) {
      process.stderr.write(chunk);
    }
  });
}

async function waitForApi() {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await isApiReachable()) {
      return;
    }
    await sleep(500);
  }

  const startupTail = apiStartupOutput.join("").trim().slice(-4000);
  throw new Error(
    `API did not become reachable at ${apiBaseUrl} within ${timeoutMs}ms${
      startupTail ? `\n\nAPI startup output:\n${startupTail}` : ""
    }`
  );
}

function address(overrides = {}) {
  return {
    line1: "150 Prospect Ave",
    city: "Brooklyn",
    state: "NY",
    postalCode: "11215",
    country: "US",
    point: {
      latitude: 40.6692,
      longitude: -73.9827
    },
    ...overrides
  };
}

async function runSmoke() {
  if (!(await isApiReachable())) {
    if (!startApi) {
      throw new Error(`API is not reachable at ${apiBaseUrl}`);
    }

    startLocalApi();
    await waitForApi();
  }

  log("API docs are reachable");

  const placeSearch = await request("/api/places/search?query=Brooklyn");
  const brooklyn = placeSearch.suggestions?.find((suggestion) => suggestion.label === "Brooklyn, NY");
  if (!brooklyn) {
    throw new Error("Brooklyn place suggestion was not returned");
  }
  log("place search returned Brooklyn");

  const providerSearch = await request("/api/providers/search", {
    method: "POST",
    body: JSON.stringify({
      address: brooklyn.address,
      categories: ["lawn-mowing"],
      dateIso: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      requestSource: "api-smoke"
    })
  });
  if (!providerSearch.rankedProviders?.length) {
    throw new Error("Provider search returned no ranked providers for Brooklyn lawn mowing");
  }
  log(`provider search returned ${providerSearch.rankedProviders.length} ranked provider(s)`);

  const unique = Date.now();
  const email = `smoke-${unique}@example.com`;
  const password = "YardMatch123!";

  const registered = await request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({
      fullName: "Smoke Test Customer",
      email,
      password,
      phone: "555-0400",
      role: "customer",
      address: address(),
      propertyLabel: "Smoke test property",
      propertyNotes: "Gate is unlocked for smoke testing.",
      lawnSizeSqFt: 3900
    })
  });
  if (registered.user?.email !== email || !registered.session?.token) {
    throw new Error("Customer registration did not return the expected user/session");
  }
  log("customer registration returned a session");

  const loggedIn = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
  if (loggedIn.user?.email !== email || !loggedIn.session?.token) {
    throw new Error("Customer login did not return the expected user/session");
  }
  log("customer login returned a session");

  const currentUser = await request("/api/auth/me", {
    headers: {
      Authorization: `Bearer ${loggedIn.session.token}`
    }
  });
  if (currentUser.user?.email !== email) {
    throw new Error("Current-user endpoint did not return the logged-in customer");
  }
  log("current-user endpoint returned the logged-in customer");

  const quote = await request("/api/quotes/instant", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${loggedIn.session.token}`
    },
    body: JSON.stringify({
      address: address(),
      category: "lawn-mowing"
    })
  });
  if (!quote.estimatedPriceCents || !quote.estimateSummary) {
    throw new Error("Instant quote did not return a price and summary");
  }
  log("instant quote returned a price and summary");

  log("passed");
}

try {
  await runSmoke();
} finally {
  if (apiProcess) {
    apiProcess.kill("SIGTERM");
  }
}
