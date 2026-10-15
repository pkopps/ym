import { expect, test } from "./fixtures";
import { evidenceRoot, opsEmail, opsPassword } from "./workflow-helpers";

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
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
      .slice(0, 5);

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

test("spanish provider, crew, and ops workflow routes remain localized", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/es/auth/provider/create");
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(page.getByLabel("Nombre del negocio")).toBeVisible();
  await expect(page.getByLabel("Radio de servicio")).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.goto("/es/auth/crew");
  await expect(page.getByRole("heading", { name: "Crea tu perfil de equipo." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Crear cuenta de equipo" })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.goto("/es/login/ops");
  await page.getByLabel("Correo").fill(opsEmail);
  const opsPasswordInput = page.getByLabel("Contrasena");
  await opsPasswordInput.fill(opsPassword);
  await opsPasswordInput.press("Enter");
  await expect(page).toHaveURL(/\/es\/ops$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await page.locator('.workspace-nav a[href="#ops-administration"]').click();
  await expect(page.getByText("Control de automatizacion")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: `${evidenceRoot}/i18n-spanish-ops-mobile.png` });
});

test("pseudo locale expands core workflow copy without mobile or desktop overflow", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/pseudo/auth/crew");
  await expect(page.locator("html")).toHaveAttribute("lang", "en-XA");
  await expect(page.locator("body")).toContainText("[!!");
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: `${evidenceRoot}/i18n-pseudo-crew-desktop.png` });

  await page.setViewportSize({ width: 390, height: 844 });
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: `${evidenceRoot}/i18n-pseudo-crew-mobile.png` });

  await page.goto("/pseudo/provider/management");
  await expect(page.locator("html")).toHaveAttribute("lang", "en-XA");
  await expect(page.locator("body")).toContainText("[!!");
  await expectNoHorizontalOverflow(page);
});
