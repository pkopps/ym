"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  cleanupStoredSessionIfInvalid,
  loadStoredSession,
  StoredWebSession,
  subscribeToStoredSession
} from "./api";

export function useStoredWebSession(): {
  session: StoredWebSession | undefined;
  sessionReady: boolean;
} {
  const session = useSyncExternalStore(
    subscribeToStoredSession,
    loadStoredSession,
    () => undefined
  );
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    cleanupStoredSessionIfInvalid();
    setSessionReady(true);
  }, []);

  return {
    session,
    sessionReady
  };
}
