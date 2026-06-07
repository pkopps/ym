import { MarketplaceApiClient } from "@yardmatch/contracts";

const authStorageKey = "yardmatch-web-session";

export interface StoredWebSession {
  token: string;
  role: "customer" | "provider" | "crew-member";
  email: string;
  userId: string;
  fullName: string;
  expiresAtIso: string;
}

export function hasSessionExpired(expiresAtIso: string): boolean {
  const expiry = Date.parse(expiresAtIso);
  return Number.isNaN(expiry) || expiry <= Date.now();
}

export function getWebApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4001";
}

export function createWebApiClient(): MarketplaceApiClient {
  return new MarketplaceApiClient(getWebApiBaseUrl());
}

export function loadStoredSession(): StoredWebSession | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const raw = window.localStorage.getItem(authStorageKey);
  if (!raw) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(raw) as StoredWebSession;
    if (!parsed.expiresAtIso || hasSessionExpired(parsed.expiresAtIso)) {
      clearStoredSession();
      return undefined;
    }

    return parsed;
  } catch {
    clearStoredSession();
    return undefined;
  }
}

export function saveStoredSession(session: StoredWebSession): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(authStorageKey, JSON.stringify(session));
}

export function clearStoredSession(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(authStorageKey);
}

export function createAuthenticatedWebApiClient(): MarketplaceApiClient {
  const api = createWebApiClient();
  const session = loadStoredSession();
  api.setAuthToken(session?.token);
  return api;
}
