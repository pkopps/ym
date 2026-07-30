import { IntlMessageFormat } from "intl-messageformat";
import enMessages from "../locales/en.json";

export const supportedLocales = ["en", "es", "pseudo"] as const;
export const sourceLocale = "en" as const;
export type SupportedLocale = (typeof supportedLocales)[number];
export type TranslationKey = keyof typeof enMessages;
export type TranslationValues = Record<string, string | number | boolean | Date | null | undefined>;
export type MessageDictionary = Record<string, string>;
export const sourceMessages = enMessages as MessageDictionary;

export interface LocaleResolutionInput {
  explicitLocale?: string | null;
  persistedLocale?: string | null;
  acceptLanguage?: string | null;
  navigatorLanguages?: readonly string[] | null;
  defaultLocale?: SupportedLocale;
}

export interface I18nInstance {
  locale: SupportedLocale;
  messages: MessageDictionary;
  fallbackMessages: MessageDictionary;
  t: (key: TranslationKey, values?: TranslationValues) => string;
  formatDate: (value: Date | number | string, options?: Intl.DateTimeFormatOptions) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatCurrency: (cents: number, currency?: string, options?: Intl.NumberFormatOptions) => string;
}

const localeAliases: Record<string, SupportedLocale> = {
  en: "en",
  "en-us": "en",
  es: "es",
  "es-es": "es",
  "es-mx": "es",
  "es-us": "es",
  pseudo: "pseudo",
  "en-xa": "pseudo"
};

export function isSupportedLocale(value: string | null | undefined): value is SupportedLocale {
  return supportedLocales.includes(value as SupportedLocale);
}

export function normalizeLocale(value: string | null | undefined): SupportedLocale | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase().replace("_", "-");
  if (normalized in localeAliases) {
    return localeAliases[normalized];
  }

  const language = normalized.split("-")[0];
  return localeAliases[language ?? ""];
}

export function parseAcceptLanguage(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((segment) => {
      const [localePart, ...qualityParts] = segment.trim().split(";");
      const quality = qualityParts
        .map((part) => part.trim())
        .find((part) => part.startsWith("q="))
        ?.slice(2);
      return {
        locale: localePart?.trim() ?? "",
        quality: quality ? Number.parseFloat(quality) : 1
      };
    })
    .filter((item) => item.locale.length > 0)
    .sort((left, right) => right.quality - left.quality)
    .map((item) => item.locale);
}

export function resolveLocale({
  explicitLocale,
  persistedLocale,
  acceptLanguage,
  navigatorLanguages,
  defaultLocale = "en"
}: LocaleResolutionInput): SupportedLocale {
  const candidates = [
    explicitLocale,
    persistedLocale,
    ...(navigatorLanguages ?? []),
    ...parseAcceptLanguage(acceptLanguage)
  ];

  for (const candidate of candidates) {
    const locale = normalizeLocale(candidate);
    if (locale) {
      return locale;
    }
  }

  return defaultLocale;
}

export function localeToHtmlLang(locale: SupportedLocale): string {
  return locale === "pseudo" ? "en-XA" : locale;
}

export function localePathPrefix(locale: SupportedLocale): string {
  return locale === "es" ? "/es" : locale === "pseudo" ? "/pseudo" : "";
}

export function addLocalePrefix(path: string, locale: SupportedLocale): string {
  const prefix = localePathPrefix(locale);
  if (!prefix) {
    return path;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return normalizedPath === "/" ? prefix : `${prefix}${normalizedPath}`;
}

export function stripLocalePrefix(path: string): { locale?: SupportedLocale; path: string } {
  if (path === "/es" || path.startsWith("/es/")) {
    return {
      locale: "es",
      path: path.slice(3) || "/"
    };
  }

  if (path === "/pseudo" || path.startsWith("/pseudo/")) {
    return {
      locale: "pseudo",
      path: path.slice(7) || "/"
    };
  }

  return { path };
}

export async function loadLocaleMessages(locale: SupportedLocale): Promise<MessageDictionary> {
  switch (locale) {
    case "es":
      return normalizeMessageModule(await import("../locales/es.json"));
    case "pseudo": {
      const messages = normalizeMessageModule(await import("../locales/en.json"));
      return createPseudoMessages({
        ...messages,
        ...normalizeMessageModule(await import("../locales/pseudo.json"))
      });
    }
    case "en":
      return normalizeMessageModule(await import("../locales/en.json"));
  }
}

export async function loadFallbackMessages(): Promise<MessageDictionary> {
  return loadLocaleMessages("en");
}

export function createI18n({
  locale,
  messages,
  fallbackMessages,
  onMissingKey
}: {
  locale: SupportedLocale;
  messages: MessageDictionary;
  fallbackMessages?: MessageDictionary;
  onMissingKey?: (key: TranslationKey, locale: SupportedLocale) => void;
}): I18nInstance {
  const resolvedFallbackMessages = fallbackMessages ?? messages;
  const cache = new Map<string, IntlMessageFormat>();

  function getFormatter(key: TranslationKey, template: string) {
    const cacheKey = `${locale}:${key}:${template}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const formatter = new IntlMessageFormat(template, locale === "pseudo" ? "en" : locale);
    cache.set(cacheKey, formatter);
    return formatter;
  }

  function t(key: TranslationKey, values: TranslationValues = {}) {
    const template = messages[key] ?? resolvedFallbackMessages[key];
    if (!template) {
      onMissingKey?.(key, locale);
      return String(key);
    }

    if (!messages[key]) {
      onMissingKey?.(key, locale);
    }

    return String(getFormatter(key, template).format(values));
  }

  function getIntlLocale() {
    return locale === "pseudo" ? "en-US" : locale === "es" ? "es-US" : "en-US";
  }

  return {
    locale,
    messages,
    fallbackMessages: resolvedFallbackMessages,
    t,
    formatDate(value, options) {
      return new Intl.DateTimeFormat(getIntlLocale(), options).format(new Date(value));
    },
    formatNumber(value, options) {
      return new Intl.NumberFormat(getIntlLocale(), options).format(value);
    },
    formatCurrency(cents, currency = "USD", options = {}) {
      return new Intl.NumberFormat(getIntlLocale(), {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
        ...options
      }).format(cents / 100);
    }
  };
}

export function createPseudoMessages(messages: MessageDictionary): MessageDictionary {
  return Object.fromEntries(
    Object.entries(messages).map(([key, value]) => [
      key,
      value.startsWith("[!!") ? value : `[!! ${pseudoLocalize(value)} !!]`
    ])
  );
}

function pseudoLocalize(value: string): string {
  const accentMap: Record<string, string> = {
    A: "Å",
    B: "ß",
    C: "Ç",
    D: "Ð",
    E: "Ë",
    F: "F",
    G: "Ĝ",
    H: "Ħ",
    I: "Ï",
    J: "Ĵ",
    K: "Ķ",
    L: "Ļ",
    M: "M",
    N: "Ñ",
    O: "Õ",
    P: "Þ",
    Q: "Q",
    R: "Ŕ",
    S: "Š",
    T: "Ŧ",
    U: "Ü",
    V: "V",
    W: "Ŵ",
    X: "Ẍ",
    Y: "Ÿ",
    Z: "Ž",
    a: "å",
    b: "ƀ",
    c: "ç",
    d: "ð",
    e: "ë",
    f: "ƒ",
    g: "ĝ",
    h: "ħ",
    i: "ï",
    j: "ĵ",
    k: "ķ",
    l: "ļ",
    m: "m",
    n: "ñ",
    o: "õ",
    p: "þ",
    q: "q",
    r: "ŕ",
    s: "š",
    t: "ŧ",
    u: "ü",
    v: "v",
    w: "ŵ",
    x: "ẍ",
    y: "ÿ",
    z: "ž"
  };
  let depth = 0;
  let literal = "";
  let expanded = "";
  let expansionSource = "";

  const flushLiteral = () => {
    const transformed = literal.replace(/[A-Za-z]/g, (character) => accentMap[character] ?? character);
    expanded += transformed;
    expansionSource += transformed;
    literal = "";
  };

  for (const character of value) {
    if (character === "{" && depth === 0) {
      flushLiteral();
      depth = 1;
      expanded += character;
      continue;
    }

    if (depth > 0) {
      expanded += character;
      if (character === "{") {
        depth += 1;
      } else if (character === "}") {
        depth -= 1;
      }
      continue;
    }

    literal += character;
  }

  flushLiteral();
  const normalizedExpansion = expansionSource.replace(/\s+/g, " ").trim();
  if (!normalizedExpansion) {
    return expanded;
  }

  return `${expanded} ${normalizedExpansion.slice(0, Math.ceil(normalizedExpansion.length * 0.35))}`;
}

function normalizeMessageModule(module: unknown): MessageDictionary {
  const candidate =
    typeof module === "object" && module && "default" in module
      ? (module as { default?: unknown }).default
      : module;

  return candidate as MessageDictionary;
}
