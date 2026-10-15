"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { LaunchFeatureFlags } from "@yardmatch/contracts";

const LaunchFeatureFlagsContext = createContext<LaunchFeatureFlags>({
  payments: false,
  crewMarketplace: false
});

export function LaunchFeatureFlagsProvider({
  children,
  flags
}: Readonly<{ children: ReactNode; flags: LaunchFeatureFlags }>) {
  return <LaunchFeatureFlagsContext.Provider value={flags}>{children}</LaunchFeatureFlagsContext.Provider>;
}

export function useLaunchFeatureFlags(): LaunchFeatureFlags {
  return useContext(LaunchFeatureFlagsContext);
}
