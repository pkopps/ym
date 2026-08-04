import { expect, type APIRequestContext, type Locator, type Page } from "@playwright/test";

export const apiBaseUrl = process.env.API_BASE_URL ?? `http://localhost:${process.env.PORT ?? 4001}`;
export const evidenceRoot = "reports/agent-checkpoints/engineer/latest";
export const testPassword = "LaunchReady123";

export const barnegatAddress = {
  line1: "18 Bay Ave",
  city: "Barnegat",
  state: "NJ",
  postalCode: "08005",
  country: "US",
  point: {
    latitude: 42.7,
    longitude: -102.25
  }
};

type AuthEnvelope = {
  session: { token: string };
  user: { id: string; email: string; role: string };
};

type ProviderCredentialFixtureProfile = {
  credentials?: Array<{ id: string; type: string; status: string }>;
};

export function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}@example.com`;
}

async function postJson<T>(
  request: APIRequestContext,
  path: string,
  data: unknown,
  token?: string
): Promise<T> {
  const response = await request.post(`${apiBaseUrl}${path}`, {
    data,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json() as Promise<T>;
}

async function prepareProviderCredentials(
  request: APIRequestContext,
  providerToken: string,
  providerId: string
) {
  const ops = await loginApi(request, "ops@example.com", "YardMatch123!");
  const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

  for (const type of [
    "business-registration",
    "general-liability-insurance",
    "workers-compensation"
  ] as const) {
    const profile = await postJson<ProviderCredentialFixtureProfile>(
      request,
      "/api/providers/credentials",
      {
        type,
        jurisdiction: "NJ",
        referenceNumber: `playwright-${providerId}-${type}`,
        expiresAt
      },
      providerToken
    );
    const credential = profile.credentials?.find((candidate) => candidate.type === type);
    expect(credential).toBeTruthy();
    await postJson(
      request,
      "/api/providers/credentials/review",
      {
        providerId,
        credentialId: credential!.id,
        action: "verify",
        notes: "Verified launch workflow fixture credential."
      },
      ops.session.token
    );
  }
}

export async function registerProvider(
  request: APIRequestContext,
  input: { email?: string; companyName?: string; staffingMode?: "auto-accept" | "review-first" } = {}
) {
  const email = input.email ?? uniqueEmail("provider");
  const companyName = input.companyName ?? `Bay Route Lawn ${Date.now()}`;
  const envelope = await postJson<AuthEnvelope>(request, "/api/auth/register", {
    fullName: "Morgan Field",
    email,
    password: testPassword,
    phone: "555-0171",
    role: "provider",
    companyName,
    bio: "Local mowing and seasonal cleanup with documented field handoffs and dependable route coverage.",
    yearsExperience: 6,
    serviceRadiusMiles: 20,
    categories: ["lawn-mowing", "seasonal-cleanup"],
    address: barnegatAddress
  });

  if (input.staffingMode === "auto-accept") {
    await postJson(request, "/api/providers/settings", {
      serviceRadiusMiles: 20,
      staffingMode: "auto-accept",
      sponsoredListingEnabled: false
    }, envelope.session.token);
  }

  await prepareProviderCredentials(request, envelope.session.token, envelope.user.id);

  return { email, companyName, token: envelope.session.token, providerId: envelope.user.id };
}

export async function registerCustomer(request: APIRequestContext, fullName = "Taylor Customer") {
  const email = uniqueEmail("customer");
  const envelope = await postJson<AuthEnvelope>(request, "/api/auth/register", {
    fullName,
    email,
    password: testPassword,
    phone: "555-0172",
    role: "customer",
    propertyLabel: "Launch property",
    address: { ...barnegatAddress, line1: "22 Bay Ave" }
  });
  return { email, token: envelope.session.token, customerId: envelope.user.id };
}

export async function loginApi(request: APIRequestContext, email: string, password = testPassword) {
  return postJson<AuthEnvelope>(request, "/api/auth/login", { email, password });
}

export async function approveProvider(
  request: APIRequestContext,
  providerId: string,
  providerToken?: string
) {
  if (providerToken) {
    await prepareProviderCredentials(request, providerToken, providerId);
  }
  const ops = await loginApi(request, "ops@example.com", "YardMatch123!");
  await postJson(request, "/api/providers/verification/review", {
    providerId,
    action: "approve",
    notes:
      "Ops reviewed the local service area, categories, route controls, profile detail, and first-job readiness. The business is approved for a narrow launch pilot with normal monitoring."
  }, ops.session.token);
  return ops.session.token;
}

export function futureServiceWindow(hoursFromNow = 48) {
  const start = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
  start.setMinutes(0, 0, 0);
  const end = new Date(start.getTime() + 90 * 60 * 1000);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

export async function createBooking(
  request: APIRequestContext,
  input: { customerToken: string; providerId: string; customerName?: string; hoursFromNow?: number }
) {
  const window = futureServiceWindow(input.hoursFromNow);
  return postJson<{ id: string; status: string }>(request, "/api/bookings", {
    providerId: input.providerId,
    serviceAddress: { ...barnegatAddress, line1: "22 Bay Ave" },
    category: "lawn-mowing",
    scheduledStartIso: window.startIso,
    scheduledEndIso: window.endIso,
    notes: `Launch workflow request for ${input.customerName ?? "customer"}`,
    totalCents: 7200,
    recommendedProviderId: input.providerId,
    selectedProviderRank: 1,
    viewedAlternativeProviders: false,
    requestSource: "playwright-core-workflow",
    recommendationSource: "playwright-core-workflow"
  }, input.customerToken);
}

export async function authenticatedPost<T>(
  request: APIRequestContext,
  token: string,
  path: string,
  data: unknown
) {
  return postJson<T>(request, path, data, token);
}

export async function authenticatedGet<T>(request: APIRequestContext, token: string, path: string) {
  const response = await request.get(`${apiBaseUrl}${path}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json() as Promise<T>;
}

export async function loginUi(page: Page, role: "provider" | "crew" | "ops", email: string, password = testPassword) {
  await page.goto(`/login/${role}`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => {
    const clientWidth = document.documentElement.clientWidth;
    const offenders = [...document.querySelectorAll<HTMLElement>("body *")]
      .map((element) => ({
        className: element.className,
        right: Math.round(element.getBoundingClientRect().right),
        tagName: element.tagName,
        text: element.textContent?.trim().slice(0, 80) ?? ""
      }))
      .filter((element) => element.right > clientWidth + 1)
      .slice(0, 8);

    return {
      clientWidth,
      offenders,
      scrollWidth: document.documentElement.scrollWidth
    };
  });
  expect(dimensions.scrollWidth, JSON.stringify(dimensions.offenders, null, 2)).toBeLessThanOrEqual(
    dimensions.clientWidth + 1
  );
}

export async function captureResponsiveEvidence(page: Page, stem: string, target?: Locator) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await target?.evaluate((element) => {
    document.documentElement.style.scrollBehavior = "auto";
    element.scrollIntoView({ block: "center", inline: "nearest" });
  });
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: `${evidenceRoot}/${stem}-desktop.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await target?.evaluate((element) => element.scrollIntoView({ block: "center", inline: "nearest" }));
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: `${evidenceRoot}/${stem}-mobile.png` });
}

export const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nKAAAAAASUVORK5CYII=",
  "base64"
);
