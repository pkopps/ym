import { resolveLaunchFeatureFlags, type LaunchFeatureFlags } from "@yardmatch/contracts";

/** Mirrors the API's launch flags; the API stays the enforcement point for gated routes. */
export function getLaunchFeatureFlags(): LaunchFeatureFlags {
  return resolveLaunchFeatureFlags(process.env);
}
