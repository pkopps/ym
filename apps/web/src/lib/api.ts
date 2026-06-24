import type { OpsInternalScope } from "@yardmatch/contracts";
import { MarketplaceApiClient } from "@yardmatch/contracts";

const authStorageKey = "yardmatch-web-session";
const sessionChangeEventName = "yardmatch-web-session-change";
const sessionChannelName = "yardmatch-web-session";
let cachedSessionRawValue: string | null | undefined;
let cachedSessionValue: StoredWebSession | undefined;

export type WebSessionChangeReason = "saved" | "cleared" | "expired" | "invalidated";

export interface StoredWebSession {
  token: string;
  role: "customer" | "provider" | "crew-member" | "ops";
  internalScope?: OpsInternalScope;
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

  const state = readStoredSessionState();
  return getStableStoredSession(state.session);
}

export function cleanupStoredSessionIfInvalid(): void {
  if (typeof window === "undefined") {
    return;
  }

  const state = readStoredSessionState();
  if (state.shouldClear) {
    clearStoredSession(state.clearReason);
  }
}

function readStoredSessionState(): {
  session: StoredWebSession | undefined;
  shouldClear: boolean;
  clearReason: WebSessionChangeReason;
} {
  const raw = window.localStorage.getItem(authStorageKey);
  if (!raw) {
    return {
      session: undefined,
      shouldClear: false,
      clearReason: "cleared"
    };
  }

  try {
    const parsed = JSON.parse(raw) as StoredWebSession;
    if (!parsed.expiresAtIso || hasSessionExpired(parsed.expiresAtIso)) {
      return {
        session: undefined,
        shouldClear: true,
        clearReason: "expired"
      };
    }

    return {
      session: parsed,
      shouldClear: false,
      clearReason: "cleared"
    };
  } catch {
    return {
      session: undefined,
      shouldClear: true,
      clearReason: "invalidated"
    };
  }
}

export function saveStoredSession(session: StoredWebSession): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(authStorageKey, JSON.stringify(session));
  cachedSessionRawValue = undefined;
  cachedSessionValue = undefined;
  dispatchStoredSessionChange("saved");
}

export function clearStoredSession(reason: WebSessionChangeReason = "cleared"): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(authStorageKey);
  cachedSessionRawValue = null;
  cachedSessionValue = undefined;
  dispatchStoredSessionChange(reason);
}

export function subscribeToStoredSession(callback: () => void): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key === authStorageKey) {
      callback();
    }
  };
  const handleSessionChange = () => {
    callback();
  };
  const handleVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      callback();
    }
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener(sessionChangeEventName, handleSessionChange);
  document.addEventListener("visibilitychange", handleVisibilityChange);

  const channel = createSessionBroadcastChannel();
  channel?.addEventListener("message", handleSessionChange);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(sessionChangeEventName, handleSessionChange);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    channel?.removeEventListener("message", handleSessionChange);
  };
}

export function createAuthenticatedWebApiClient(): MarketplaceApiClient {
  const api = createWebApiClient();
  const session = loadStoredSession();
  api.setAuthToken(session?.token);
  api.setUnauthorizedHandler(() => {
    clearStoredSession("invalidated");
  });
  return api;
}

function dispatchStoredSessionChange(reason: WebSessionChangeReason): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent(sessionChangeEventName, { detail: { reason } }));
  createSessionBroadcastChannel()?.postMessage({ reason });
}

function createSessionBroadcastChannel(): BroadcastChannel | undefined {
  if (typeof window === "undefined" || typeof window.BroadcastChannel === "undefined") {
    return undefined;
  }

  const cached = (window as typeof window & {
    __yardmatchSessionChannel?: BroadcastChannel;
  }).__yardmatchSessionChannel;

  if (cached) {
    return cached;
  }

  const channel = new window.BroadcastChannel(sessionChannelName);
  (window as typeof window & {
    __yardmatchSessionChannel?: BroadcastChannel;
  }).__yardmatchSessionChannel = channel;
  return channel;
}

function getStableStoredSession(session: StoredWebSession | undefined): StoredWebSession | undefined {
  if (typeof window === "undefined") {
    return session;
  }

  const raw = window.localStorage.getItem(authStorageKey);
  if (!raw) {
    cachedSessionRawValue = null;
    cachedSessionValue = undefined;
    return undefined;
  }

  if (cachedSessionRawValue === raw) {
    return cachedSessionValue;
  }

  cachedSessionRawValue = raw;
  cachedSessionValue = session;
  return cachedSessionValue;
}
