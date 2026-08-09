import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const apiBaseUrl = (process.env.API_BASE_URL ?? "http://localhost:4001").replace(/\/$/, "");
const allowLocal = process.env.YARDMATCH_ALLOW_LOCAL_STAGING_SMOKE === "1";
const opsEmail = process.env.YARDMATCH_SMOKE_OPS_EMAIL ?? (allowLocal ? "ops@example.com" : "");
const opsPassword = process.env.YARDMATCH_SMOKE_OPS_PASSWORD ?? (allowLocal ? "YardMatch123!" : "");
const evidencePath = process.env.YARDMATCH_ACCEPTANCE_EVIDENCE_PATH?.trim();
const testPassword = `Acceptance-${randomBytes(18).toString("base64url")}!aA1`;
const runId = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
const tinyPngDataUrl =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nKAAAAAASUVORK5CYII=";

function log(message) {
  console.log(`[staging-photo-smoke] ${message}`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function requestJson(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {})
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : undefined;
  } catch {
    payload = text;
  }
  if (!response.ok) {
    throw new Error(`${options.method ?? "GET"} ${path} failed with ${response.status}: ${text.slice(0, 800)}`);
  }
  return payload;
}

async function expectImage(url, expectedAccess) {
  const response = await fetch(url, { redirect: "error" });
  assert(response.ok, `Expected ${expectedAccess} image delivery to return 200, received ${response.status}.`);
  assert(response.headers.get("content-type") === "image/png", `${expectedAccess} image type was not preserved.`);
  assert(response.headers.get("cache-control") === "no-store", `${expectedAccess} images must not be cached.`);
  assert((await response.arrayBuffer()).byteLength > 0, `${expectedAccess} image response was empty.`);
}

function address(line1) {
  return {
    line1,
    city: "Barnegat",
    state: "NJ",
    postalCode: "08005",
    country: "US",
    point: { latitude: 39.7532, longitude: -74.2229 }
  };
}

function futureWindow() {
  const start = new Date(Date.now() + 72 * 60 * 60 * 1000);
  start.setMinutes(0, 0, 0);
  return {
    scheduledStartIso: start.toISOString(),
    scheduledEndIso: new Date(start.getTime() + 90 * 60 * 1000).toISOString()
  };
}

async function login(email, password) {
  return requestJson("/api/auth/login", {
    method: "POST",
    body: { email, password }
  });
}

async function run() {
  assert(opsEmail && opsPassword, "Staging photo smoke requires YARDMATCH_SMOKE_OPS_EMAIL and YARDMATCH_SMOKE_OPS_PASSWORD.");
  if (!allowLocal) {
    assert(apiBaseUrl.startsWith("https://"), "Staging photo smoke requires an HTTPS API_BASE_URL.");
  }

  const health = await requestJson("/healthz");
  const readiness = await requestJson("/readyz");
  assert(health.status === "ok" && readiness.status === "ready", "API health/readiness did not pass.");
  if (!allowLocal) {
    assert(health.environment === "staging", "Photo acceptance refuses to mutate a non-staging API.");
    assert(health.repository === "prisma-postgres", "Staging photo acceptance requires PostgreSQL.");
  }
  log(`health passed (${health.environment}, ${health.repository})`);

  const ops = await login(opsEmail, opsPassword);
  const providerEmail = `deployment-provider-${runId}@example.com`;
  const customerEmail = `deployment-customer-${runId}@example.com`;
  const provider = await requestJson("/api/auth/register", {
    method: "POST",
    body: {
      fullName: "Deployment Proof Provider",
      email: providerEmail,
      password: testPassword,
      phone: "555-0171",
      role: "provider",
      companyName: `[Acceptance] Barnegat Proof ${runId}`,
      bio: "Staging-only provider used to verify the complete private photo and consent lifecycle.",
      yearsExperience: 6,
      serviceRadiusMiles: 20,
      categories: ["lawn-mowing"],
      address: address("18 Bay Ave")
    }
  });
  const providerId = provider.user.id;
  const providerToken = provider.session.token;
  let marketingGranted = false;
  let bookingId;

  try {
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    for (const type of ["business-registration", "general-liability-insurance", "workers-compensation"]) {
      const profile = await requestJson("/api/providers/credentials", {
        method: "POST",
        token: providerToken,
        body: {
          type,
          jurisdiction: "NJ",
          referenceNumber: `acceptance-${runId}-${type}`,
          expiresAt
        }
      });
      const credential = profile.credentials.find((candidate) => candidate.type === type);
      assert(credential, `Provider credential ${type} was not saved.`);
      await requestJson("/api/providers/credentials/review", {
        method: "POST",
        token: ops.session.token,
        body: {
          providerId,
          credentialId: credential.id,
          action: "verify",
          notes: "Verified automated staging acceptance credential. Not valid for launch use."
        }
      });
    }
    await requestJson("/api/providers/verification/review", {
      method: "POST",
      token: ops.session.token,
      body: {
        providerId,
        action: "approve",
        notes:
          "Approved only for the automated staging acceptance lifecycle after credential and launch-control review."
      }
    });

    const customer = await requestJson("/api/auth/register", {
      method: "POST",
      body: {
        fullName: "Deployment Proof Customer",
        email: customerEmail,
        password: testPassword,
        phone: "555-0172",
        role: "customer",
        propertyLabel: "Staging acceptance property",
        propertyNotes: "Staging-only property record.",
        address: address("22 Bay Ave")
      }
    });
    const customerToken = customer.session.token;
    const window = futureWindow();
    const booking = await requestJson("/api/bookings", {
      method: "POST",
      token: customerToken,
      body: {
        providerId,
        serviceAddress: address("22 Bay Ave"),
        category: "lawn-mowing",
        ...window,
        notes: "Automated staging photo lifecycle acceptance.",
        totalCents: 7200,
        recommendedProviderId: providerId,
        selectedProviderRank: 1,
        viewedAlternativeProviders: false,
        requestSource: "staging-photo-acceptance",
        recommendationSource: "staging-photo-acceptance"
      }
    });
    bookingId = booking.id;

    const customerBefore = await requestJson("/api/bookings/evidence", {
      method: "POST",
      token: customerToken,
      body: {
        bookingId,
        phase: "before",
        evidenceType: "photo",
        imageDataUrl: tinyPngDataUrl,
        photoArea: "lawn",
        note: "Customer staging before photo."
      }
    });
    const customerPhoto = customerBefore.serviceEvidence.find(
      (evidence) => evidence.capturedByRole === "customer" && evidence.phase === "before"
    );
    assert(customerPhoto, "Customer before photo was not persisted.");

    if (health.environment === "staging") {
      assert(customerPhoto.imageStorageProvider === "vercel-blob-private", "Staging photo did not use private Blob storage.");
      const privateUrl = new URL(customerPhoto.imageDataUrl);
      assert(privateUrl.origin === new URL(apiBaseUrl).origin, "Private photo exposed a vendor storage URL.");
      await expectImage(privateUrl.toString(), "private");
    }

    await requestJson("/api/bookings/confirm", { method: "POST", token: providerToken, body: { bookingId } });
    await requestJson("/api/bookings/on-route", { method: "POST", token: providerToken, body: { bookingId } });
    await requestJson("/api/bookings/evidence", {
      method: "POST",
      token: providerToken,
      body: {
        bookingId,
        phase: "before",
        evidenceType: "photo",
        imageDataUrl: tinyPngDataUrl,
        photoArea: "lawn",
        note: "Provider arrival photo."
      }
    });
    await requestJson("/api/bookings/start", { method: "POST", token: providerToken, body: { bookingId } });
    await requestJson("/api/bookings/evidence", {
      method: "POST",
      token: providerToken,
      body: {
        bookingId,
        phase: "after",
        evidenceType: "photo",
        imageDataUrl: tinyPngDataUrl,
        photoArea: "lawn",
        note: "Provider completion photo."
      }
    });
    await requestJson("/api/bookings/complete", { method: "POST", token: providerToken, body: { bookingId } });

    const serviceHistory = await requestJson("/api/bookings", { token: customerToken });
    const completed = serviceHistory.find((candidate) => candidate.id === bookingId);
    assert(completed?.status === "completed", "Completed service was missing from customer history.");
    assert(
      completed.serviceEvidence.some((evidence) => evidence.phase === "before" && evidence.capturedByRole === "customer") &&
        completed.serviceEvidence.some((evidence) => evidence.phase === "after" && evidence.capturedByRole === "provider"),
      "Service history did not preserve the customer-before/provider-after evidence pair."
    );

    await requestJson("/api/bookings/photo-marketing-use", {
      method: "POST",
      token: customerToken,
      body: { bookingId, status: "granted" }
    });
    marketingGranted = true;
    const publicOverview = await requestJson("/api/providers/public-overview");
    const proof = publicOverview.beforeAfterProjects.find((candidate) => candidate.bookingId === bookingId);
    assert(proof, "Consented completed work did not appear in public trust assets.");
    assert(!("customerName" in proof) && !("streetAddress" in proof), "Public trust asset leaked customer identity or address.");
    if (health.environment === "staging") {
      await expectImage(proof.beforeImageDataUrl, "marketing before");
      await expectImage(proof.afterImageDataUrl, "marketing after");
    }

    const revokedBeforeUrl = proof.beforeImageDataUrl;
    await requestJson("/api/bookings/photo-marketing-use", {
      method: "POST",
      token: customerToken,
      body: { bookingId, status: "revoked" }
    });
    marketingGranted = false;
    const afterRevocation = await requestJson("/api/providers/public-overview");
    assert(
      !afterRevocation.beforeAfterProjects.some((candidate) => candidate.bookingId === bookingId),
      "Revoked trust asset remained in the public marketplace overview."
    );
    if (health.environment === "staging") {
      const revokedResponse = await fetch(revokedBeforeUrl, { redirect: "error" });
      assert(revokedResponse.status === 404, "Previously consented marketing URL remained readable after revocation.");
    }

    const evidence = {
      status: "passed",
      runId,
      apiBaseUrl,
      apiEnvironment: health.environment,
      apiRepository: health.repository,
      apiRevision: health.revision ?? null,
      bookingId,
      providerId,
      checks: [
        "customer-private-before-photo",
        "provider-before-and-after-photos",
        "completed-service-history-pair",
        "consented-public-trust-asset",
        "consent-revocation-removal"
      ],
      completedAt: new Date().toISOString()
    };
    if (evidencePath) {
      const resolvedPath = resolve(evidencePath);
      await mkdir(dirname(resolvedPath), { recursive: true });
      await writeFile(resolvedPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
    }
    log("private upload, service history, trust asset, and revocation checks passed");
    return evidence;
  } finally {
    if (marketingGranted && bookingId) {
      const customer = await login(customerEmail, testPassword).catch(() => undefined);
      if (customer) {
        await requestJson("/api/bookings/photo-marketing-use", {
          method: "POST",
          token: customer.session.token,
          body: { bookingId, status: "revoked" }
        }).catch(() => undefined);
      }
    }
    await requestJson("/api/providers/verification/review", {
      method: "POST",
      token: ops.session.token,
      body: {
        providerId,
        action: "reject",
        notes:
          "Automated staging acceptance is complete. This synthetic provider must remain excluded from customer matching."
      }
    }).catch(() => undefined);
  }
}

await run();
