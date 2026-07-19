import assert from "node:assert/strict";
import test from "node:test";
import {
  createI18n,
  loadFallbackMessages,
  loadLocaleMessages,
  resolveLocale
} from "../src/index";

test("resolveLocale honors explicit, persisted, navigator, and Accept-Language candidates", () => {
  assert.equal(resolveLocale({ explicitLocale: "es-MX" }), "es");
  assert.equal(resolveLocale({ explicitLocale: "fr", persistedLocale: "es" }), "es");
  assert.equal(resolveLocale({ navigatorLanguages: ["fr-CA", "en-US"] }), "en");
  assert.equal(resolveLocale({ acceptLanguage: "fr-CA, es-US;q=0.8, en;q=0.7" }), "es");
});

test("createI18n formats ICU plurals and falls back to English when needed", async () => {
  const fallbackMessages = await loadFallbackMessages();
  const i18n = createI18n({
    locale: "es",
    messages: {},
    fallbackMessages
  });

  assert.equal(i18n.t("common.format.provider_count", { count: 1 }), "1 provider");
  assert.equal(i18n.t("common.format.provider_count", { count: 3 }), "3 providers");
});

test("createI18n formats Spanish numbers, currency, and dates through Intl", async () => {
  const [messages, fallbackMessages] = await Promise.all([
    loadLocaleMessages("es"),
    loadFallbackMessages()
  ]);
  const i18n = createI18n({ locale: "es", messages, fallbackMessages });

  assert.equal(i18n.t("common.format.provider_count", { count: 2 }), "2 proveedores");
  assert.match(i18n.formatCurrency(12500), /125/);
  assert.match(i18n.formatDate("2026-07-15T12:00:00Z", { month: "long", day: "numeric" }), /15/);
});

test("pseudo locale expands source strings without requiring a full copied locale file", async () => {
  const [messages, fallbackMessages] = await Promise.all([
    loadLocaleMessages("pseudo"),
    loadFallbackMessages()
  ]);
  const i18n = createI18n({ locale: "pseudo", messages, fallbackMessages });

  assert.match(i18n.t("nav.sign_up"), /^\[!! /);
});
