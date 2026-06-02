import { MarketplaceApiClient } from "@yardmatch/contracts";

const authStorageKey = "yardmatch-web-session";

export interface StoredWebSession {
  token: string;
  role: "customer" | "provider" | "crew-member";
  email: string;
  userId: string;
  fullName: string;
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
    return JSON.parse(raw) as StoredWebSession;
  } catch {
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
