import { expect, test, type Page } from "@playwright/test";
import { opsEmail, opsPassword } from "./workflow-helpers";

async function expectSocialAuthLinks({
  expectedMode,
  expectedReturnTo,
  expectedRole,
  page
}: {
  expectedMode: "login" | "signup";
  expectedReturnTo: string;
  expectedRole: "customer" | "provider" | "crew-member";
  page: Page;
}) {
  for (const provider of ["google", "apple"] as const) {
    const label = provider === "google" ? "Continue with Google" : "Continue with Apple";
    const href = await page.getByRole("link", { name: label }).getAttribute("href");
    expect(href).toBeTruthy();

    const startUrl = new URL(href ?? "");
    expect(startUrl.pathname).toBe(`/api/auth/${provider}/start`);
    expect(startUrl.searchParams.get("role")).toBe(expectedRole);
    expect(startUrl.searchParams.get("mode")).toBe(expectedMode);

    const redirectUri = startUrl.searchParams.get("redirectUri");
    expect(redirectUri).toBeTruthy();
    const redirectUrl = new URL(redirectUri ?? "");
    expect(redirectUrl.pathname).toBe("/auth/complete");
    expect(redirectUrl.searchParams.get("role")).toBe(expectedRole);
    expect(redirectUrl.searchParams.get("returnTo")).toBe(expectedReturnTo);
  }
}

test.describe("YardMatch web smoke", () => {
  test("public marketplace loads and shows recommendation-first positioning", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "One local match for yard care." })).toBeVisible();
    await expect(page.getByText("Three quick steps. No directory rabbit hole.")).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Need" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: /Where/ })).toHaveValue(/Barnegat, NJ/i);
    await expect(page.getByRole("button", { name: "Find my match" }).first()).toBeVisible();
  });

  test("spanish public marketplace route renders localized shell", async ({ page }) => {
    await page.goto("/es");

    await expect(page.locator("html")).toHaveAttribute("lang", "es");
    await expect(page.getByRole("heading", { name: "Una recomendacion local para cuidar tu jardin." })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Necesito" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: /Donde/ })).toHaveValue(/Barnegat, NJ/i);
    await expect(page.getByRole("button", { name: "Encontrar mi recomendacion" }).first()).toBeVisible();
    await expect(page.getByLabel("Idioma")).toHaveValue("es");
    await expect(page.locator("body")).not.toContainText("market.home.");
  });

  test("public listings can request a seeded provider match with carried intent", async ({ page }) => {
    const params = new URLSearchParams({
      service: "lawn-mowing",
      area: "Brooklyn, NY",
      city: "Brooklyn",
      state: "NY",
      postalCode: "11201",
      lat: "40.6782",
      lng: "-73.9442",
      when: "tomorrow-morning"
    });

    await page.goto(`/customer/listings?${params.toString()}`);

    await expect(page.getByText("Recommended for this property", { exact: true })).toBeVisible();
    await expect(page.getByText("Best overall match", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { level: 3, name: "GreenStride Lawn Co." })).toBeVisible();
    const requestMatch = page.getByRole("link", { name: "Request this match" });
    await expect(requestMatch).toBeVisible();

    await requestMatch.click();
    await expect(page).toHaveURL(/\/auth\/customer/);

    const signupUrl = new URL(page.url());
    expect(signupUrl.pathname).toBe("/auth/customer");
    expect(signupUrl.searchParams.get("providerId")).toBeTruthy();
    expect(signupUrl.searchParams.get("providerName")).toBe("GreenStride Lawn Co.");
    expect(signupUrl.searchParams.get("rank")).toBe("1");
    expect(signupUrl.searchParams.get("when")).toBe("tomorrow-morning");
    expect(signupUrl.searchParams.get("service")).toBe("lawn-mowing");
    expect(signupUrl.searchParams.get("area")).toBe("Brooklyn, NY");
    expect(signupUrl.searchParams.get("city")).toBe("Brooklyn");
    expect(signupUrl.searchParams.get("state")).toBe("NY");
    expect(signupUrl.searchParams.get("postalCode")).toBe("11201");
    expect(signupUrl.searchParams.get("source")).toBe("listings");
    expect(Date.parse(signupUrl.searchParams.get("slot") ?? "")).not.toBeNaN();
  });

  test("ops login opens the authenticated operations workspace", async ({ page }) => {
    await page.goto("/login/ops");

    await page.getByLabel("Email").fill(opsEmail);
    await page.getByLabel("Password").fill(opsPassword);
    await page.getByRole("button", { name: "Log in" }).click();

    await expect(page).toHaveURL(/\/ops$/);
    await expect(page.getByRole("heading", { name: "Bookings, activity, and support." })).toBeVisible();
    await expect(page.getByText("Live from the authenticated API.")).toBeVisible();
    await expect(page.getByText("Total bookings recorded")).toBeVisible();
  });

  test("customer auth social links carry stable redirect URIs", async ({ page }) => {
    const hydrationErrors: string[] = [];
    page.on("console", (message) => {
      if (
        message.type() === "error" &&
        /hydration|server rendered html didn't match|did not match/i.test(message.text())
      ) {
        hydrationErrors.push(message.text());
      }
    });

    const requestParams = new URLSearchParams({
      service: "lawn-mowing",
      area: "Brooklyn, NY",
      when: "tomorrow-morning",
      providerId: "provider-seed",
      providerName: "GreenStride Lawn Co.",
      rank: "1",
      slot: "2026-07-10T09:00:00.000Z"
    });
    const expectedSignupReturnTo =
      "/customer/dashboard?flow=request&service=lawn-mowing&when=tomorrow-morning&providerId=provider-seed&providerName=GreenStride+Lawn+Co.&rank=1&slot=2026-07-10T09%3A00%3A00.000Z";

    await page.goto(`/auth/customer?${requestParams.toString()}`);
    await expect(page.getByRole("link", { name: "Continue with Google" })).toBeVisible();
    await expectSocialAuthLinks({
      expectedMode: "signup",
      expectedReturnTo: expectedSignupReturnTo,
      expectedRole: "customer",
      page
    });

    const loginReturnTo = "/customer/dashboard?flow=request&providerId=provider-seed";
    await page.goto(`/login/customer?returnTo=${encodeURIComponent(loginReturnTo)}`);
    await expect(page.getByRole("link", { name: "Continue with Apple" })).toBeVisible();
    await expectSocialAuthLinks({
      expectedMode: "login",
      expectedReturnTo: loginReturnTo,
      expectedRole: "customer",
      page
    });

    expect(hydrationErrors).toEqual([]);
  });

  test("protected dashboards show the expected login gates when signed out", async ({ page }) => {
    await page.goto("/customer/dashboard");
    await expect(page.getByRole("heading", { name: "Log in to manage your account" })).toBeVisible();

    await page.goto("/provider/management");
    await expect(page.getByRole("heading", { name: "Business owner login required" })).toBeVisible();

    await page.goto("/ops");
    await expect(page.getByRole("heading", { name: "Internal login required" })).toBeVisible();
  });
});
