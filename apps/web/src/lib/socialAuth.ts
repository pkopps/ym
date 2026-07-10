import type { MarketplaceRole } from "@yardmatch/contracts";
import { buildSiteUrl } from "./site";

export function buildSocialAuthRedirectUri({
  returnTo,
  role
}: {
  returnTo: string;
  role: MarketplaceRole;
}) {
  const completionUrl = new URL(buildSiteUrl("/auth/complete"));
  completionUrl.searchParams.set("role", role);
  completionUrl.searchParams.set("returnTo", returnTo);
  return completionUrl.toString();
}
