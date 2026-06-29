import type { MarketplaceRole } from "@yardmatch/contracts";

const fallbackOrigin = "https://yardmatch.local";

const rolePathPrefixes: Record<MarketplaceRole, string[]> = {
  customer: ["/customer"],
  provider: ["/provider"],
  "crew-member": ["/crew"],
  ops: ["/ops"]
};

export function getSafeRelativePath(candidate: string | null | undefined, fallback: string): string {
  const trimmed = candidate?.trim();
  if (!trimmed || !trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.includes("\\")) {
    return fallback;
  }

  try {
    const target = new URL(trimmed, fallbackOrigin);
    if (target.origin !== fallbackOrigin) {
      return fallback;
    }

    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return fallback;
  }
}

export function getRoleRedirectPath(
  role: MarketplaceRole,
  candidate: string | null | undefined,
  fallback: string
): string {
  const safePath = getSafeRelativePath(candidate, fallback);
  const allowedPrefixes = rolePathPrefixes[role];
  const isAllowed = allowedPrefixes.some(
    (prefix) => safePath === prefix || safePath.startsWith(`${prefix}/`) || safePath.startsWith(`${prefix}?`)
  );

  return isAllowed ? safePath : fallback;
}
