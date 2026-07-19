import type { IncomingHttpHeaders } from "node:http";
import type {
  BookingServiceWindowKey,
  ProviderCalendarOverviewResponse
} from "@yardmatch/contracts";
import {
  createI18n,
  loadFallbackMessages,
  loadLocaleMessages,
  resolveLocale,
  type I18nInstance,
  type MessageDictionary,
  type SupportedLocale,
  type TranslationKey
} from "@yardmatch/i18n";

type HeaderMap = IncomingHttpHeaders | Record<string, string | undefined>;

const messageCache = new Map<SupportedLocale, Promise<MessageDictionary>>();

const apiErrorMessageKeys = new Map<string, TranslationKey>([
  ["Malformed JSON request body.", "api.error.malformed_json"],
  ["Route not found", "api.error.route_not_found"],
  ["Unknown server error", "api.error.unknown_server_error"],
  ["Invalid bearer token", "api.auth.invalid_bearer_token"],
  ["Malformed bearer token", "api.auth.malformed_bearer_token"],
  ["Expired bearer token", "api.auth.expired_bearer_token"],
  ["Missing bearer token", "api.auth.missing_bearer_token"],
  ["Unknown session", "api.auth.unknown_session"],
  ["Session has been replaced", "api.auth.session_replaced"],
  ["Account access has been disabled", "api.auth.account_access_disabled"],
  ["Invalid email or password", "api.auth.invalid_email_or_password"],
  ["Password must be at least 8 characters long", "api.auth.password_min_length"],
  [
    "Password must include uppercase, lowercase, and numeric characters",
    "api.auth.password_complexity"
  ]
]);

const bookingWindowLabelKeys: Record<BookingServiceWindowKey, TranslationKey> = {
  morning: "booking.window.morning.label",
  afternoon: "booking.window.afternoon.label",
  "late-afternoon-night": "booking.window.late_afternoon_night.label"
};

function headerValue(headers: HeaderMap, name: string): string | undefined {
  const value = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(value)) {
    return value.join(", ");
  }

  return value;
}

function messagesForLocale(locale: SupportedLocale): Promise<MessageDictionary> {
  const cached = messageCache.get(locale);
  if (cached) {
    return cached;
  }

  const promise = loadLocaleMessages(locale);
  messageCache.set(locale, promise);
  return promise;
}

export function resolveApiLocale(headers: HeaderMap): SupportedLocale {
  return resolveLocale({
    explicitLocale: headerValue(headers, "x-yardmatch-locale"),
    acceptLanguage: headerValue(headers, "accept-language")
  });
}

export async function createApiI18n(locale: SupportedLocale): Promise<I18nInstance> {
  const [messages, fallbackMessages] = await Promise.all([
    messagesForLocale(locale),
    locale === "en" ? messagesForLocale("en") : loadFallbackMessages()
  ]);

  return createI18n({ locale, messages, fallbackMessages });
}

export async function localizeApiErrorMessage(
  message: string,
  headers: HeaderMap
): Promise<string> {
  const key = apiErrorMessageKeys.get(message);
  if (!key) {
    return message;
  }

  const i18n = await createApiI18n(resolveApiLocale(headers));
  const values = key === "api.auth.password_min_length" ? { minLength: 8 } : undefined;
  return i18n.t(key, values);
}

export async function localizeProviderCalendarOverview(
  overview: ProviderCalendarOverviewResponse,
  headers: HeaderMap
): Promise<ProviderCalendarOverviewResponse> {
  const i18n = await createApiI18n(resolveApiLocale(headers));

  return {
    ...overview,
    dispatchDays: overview.dispatchDays.map((day) => ({
      ...day,
      windowSummaries: day.windowSummaries.map((window) => ({
        ...window,
        label: i18n.t(bookingWindowLabelKeys[window.windowKey])
      }))
    }))
  };
}
