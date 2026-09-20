import { loginApi, opsEmail, opsPassword } from "./workflow-helpers";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const apiBaseUrl = process.env.API_BASE_URL ?? `http://localhost:${process.env.PORT ?? 4001}`;
const evidenceRoot = "reports/agent-checkpoints/engineer/latest";

async function searchSeededBrooklyn(page: Page, locale: "en" | "es") {
  const isSpanish = locale === "es";
  await page.goto(isSpanish ? "/es" : "/");

  const areaField = page.getByRole("textbox", { name: isSpanish ? /Donde/i : /Where/i });
  await expect(areaField).toHaveValue(/Barnegat, NJ/i);
  await areaField.fill("Brooklyn, NY");

  const brooklynSuggestion = page
    .locator(".customer-search-shell__suggestion")
    .filter({ hasText: "Brooklyn, NY" })
    .first();
  await expect(brooklynSuggestion).toBeVisible();
  await brooklynSuggestion.click();

  await page
    .getByRole("button", {
      name: isSpanish ? "Encontrar mi recomendacion" : "Find my match"
    })
    .first()
    .click();

  await expect(page).toHaveURL(isSpanish ? /\/es\/customer\/listings/ : /\/customer\/listings/);
  await expect(page.getByRole("heading", { level: 3, name: "GreenStride Lawn Co." })).toBeVisible();
  const curatedProviderCount = await page.locator(".live-provider-card").count();
  expect(curatedProviderCount).toBeGreaterThan(0);
  expect(curatedProviderCount).toBeLessThanOrEqual(3);
  await expect(
    page.getByText(isSpanish ? "El proveedor confirma antes del pago." : "Provider confirms before payment.").first()
  ).toBeVisible();
}

async function registerExistingCustomer(request: APIRequestContext, email: string, password: string) {
  const response = await request.post(`${apiBaseUrl}/api/auth/register`, {
    data: {
      fullName: "Elena Rivera",
      email,
      password,
      phone: "555-0142",
      role: "customer",
      propertyLabel: "Casa principal",
      address: {
        line1: "170 5th Ave",
        city: "Brooklyn",
        state: "NY",
        postalCode: "11201",
        country: "US",
        point: {
          latitude: 40.6782,
          longitude: -73.9442
        }
      }
    }
  });

  expect(response.ok()).toBeTruthy();
  const loginResponse = await request.post(`${apiBaseUrl}/api/auth/login`, {
    data: { email, password }
  });
  expect(loginResponse.ok(), await loginResponse.text()).toBeTruthy();
}

test.describe.serial("customer booking golden path", () => {
  test("homepage search carries signup intent through quote, recommendation, and booking state", async ({ page, request }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => localStorage.setItem("yardmatch-analytics-permission", "yes"));
    await searchSeededBrooklyn(page, "en");

    await page.screenshot({
      path: `${evidenceRoot}/customer-booking-listings-desktop.png`
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: `${evidenceRoot}/customer-booking-listings-mobile.png`
    });
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.getByRole("link", { name: "See price and request" }).click();
    await expect(page).toHaveURL(/\/auth\/customer/);
    const signupUrl = new URL(page.url());
    expect(signupUrl.searchParams.get("lat")).toBe("40.6782");
    expect(signupUrl.searchParams.get("lng")).toBe("-73.9442");
    await expect(page.locator(".auth-intent-compact summary")).toContainText("GreenStride Lawn Co.");
    await page.locator(".auth-intent-compact summary").click();
    await expect(page.getByRole("link", { name: "Log in and continue" })).toBeVisible();

    const email = `golden-path-${Date.now()}@example.com`;
    await page.getByLabel("Full name").fill("Maya Golden");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Phone").fill("555-0133");
    await page.getByLabel("Password", { exact: true }).fill("LaunchReady123");
    await page.getByLabel("Confirm password").fill("LaunchReady123");
    await page.getByLabel("Service address").fill("170 5th Ave");
    await expect(page.getByLabel("City")).toHaveValue("Brooklyn");
    await expect(page.getByLabel("State")).toHaveValue("NY");
    await expect(page.getByLabel("ZIP")).toHaveValue("11201");
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page).toHaveURL(/\/customer\/dashboard\?flow=request/);
    await expect(page.getByRole("heading", { name: "Request service" })).toBeVisible();
    await expect(page.getByLabel("Service").first()).toHaveValue("lawn-mowing");
    await expect(page.getByText("170 5th Ave, Brooklyn, NY")).toBeVisible();

    await page.getByRole("button", { name: "Get price" }).click();
    await expect(page.getByRole("button", { name: "See provider" })).toHaveCount(0);
    await page.getByText("Estimate details").click();
    await expect(page.getByText("Confidence notes")).toBeVisible();

    await expect(page.getByText("Selected match", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("heading", { level: 3, name: "GreenStride Lawn Co." })).toBeVisible();
    await expect(page.getByText("Open route window", { exact: true })).toBeVisible();
    await expect(
      page.getByText("No charge yet. The provider reviews and confirms before payment is collected.")
    ).toBeVisible();
    await page.getByRole("button", { name: "Request this time" }).click();

    await expect(page.getByRole("heading", { name: "Waiting on confirmation" })).toBeVisible();
    await expect(page.getByText(/GreenStride Lawn Co\. is reviewing this request/)).toBeVisible();
    await expect(page.getByText("After provider confirms")).toBeVisible();
    const ops = await loginApi(request, opsEmail, opsPassword);
    await expect.poll(async () => {
      const report = await request.get(`${apiBaseUrl}/api/observability/product-analytics`, {headers: {Authorization: `Bearer ${ops.session.token}`}});
      expect(report.ok()).toBeTruthy();
      const data = await report.json();
      return data.funnel.steps.find((step: {name: string; people: number}) => step.name === "booking_requested").people;
    }).toBeGreaterThan(0);
    await expect(page.getByRole("navigation", { name: "Customer account sections" }).getByRole("link", { name: "Past visits" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Track crew" })).toHaveCount(0);
    await page.getByText("More options").click();
    await expect(page.getByRole("link", { name: "Get help" }).first()).toBeVisible();

    await page.screenshot({
      path: `${evidenceRoot}/customer-booking-requested-desktop.png`
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: `${evidenceRoot}/customer-booking-requested-mobile.png`
    });
  });

  test("spanish mobile path keeps selected request through existing-customer login", async ({ page, request }) => {
    test.setTimeout(90_000);
    const email = `golden-path-es-${Date.now()}@example.com`;
    const password = "LaunchReady123";
    await registerExistingCustomer(request, email, password);
    await page.setViewportSize({ width: 390, height: 844 });
    await searchSeededBrooklyn(page, "es");

    await page.getByRole("link", { name: "Ver precio y solicitar" }).click();
    await expect(page).toHaveURL(/\/es\/auth\/customer/);
    await page.getByRole("link", { name: "Iniciar sesion y continuar" }).click();
    await expect(page).toHaveURL(/\/es\/login\/customer\?returnTo=/);

    const loginUrl = new URL(page.url());
    const returnTo = loginUrl.searchParams.get("returnTo") ?? "";
    expect(returnTo).toContain("/es/customer/dashboard?flow=request");
    expect(returnTo).toContain("service=lawn-mowing");
    expect(returnTo).toContain("providerName=GreenStride+Lawn+Co.");

    await expect(page.getByRole("link", { name: "Continuar con Apple" })).toBeVisible();
    await page.waitForLoadState("networkidle");
    const emailField = page.getByLabel("Correo");
    const passwordField = page.getByLabel("Contrasena");
    await emailField.fill(email);
    await passwordField.fill(password);
    await expect(emailField).toHaveValue(email);
    await expect(passwordField).toHaveValue(password);
    await passwordField.press("Enter");

    await expect(page).toHaveURL(/\/es\/customer\/dashboard\?flow=request/);
    await expect(page.getByRole("heading", { name: "Solicitar servicio" })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
    await expect(page.getByLabel("Servicio").first()).toHaveValue("lawn-mowing");
    await page.getByRole("button", { name: "Obtener precio" }).click();
    await expect(page.getByText("Recomendacion seleccionada", { exact: true }).first()).toBeVisible();
    await page.getByRole("button", { name: "Solicitar este horario" }).click();

    await expect(page.getByRole("heading", { name: "Esperando confirmacion" })).toBeVisible();
    await expect(page.getByText("Despues de que el proveedor confirme")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Secciones de cuenta de cliente" }).getByRole("link", { name: "Visitas anteriores" })).toBeVisible();
    await page.screenshot({
      path: `${evidenceRoot}/customer-booking-spanish-mobile.png`
    });
  });
});
