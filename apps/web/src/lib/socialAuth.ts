import type { MarketplaceRole } from "@yardmatch/contracts";
import { addLocalePrefix, type SupportedLocale } from "@yardmatch/i18n";
import { buildSiteUrl } from "./site";

/**
 * Where the API sends the browser after Google or Apple sign-in.
 * Sign-up passes the role being created. Login leaves it out: the API signs the person in with
 * the role their account already has and reports it back on the completion URL.
 */
export function buildSocialAuthRedirectUri({
  locale,
  returnTo,
  role
}: {
  locale?: SupportedLocale;
  returnTo?: string;
  role?: MarketplaceRole;
}) {
  const completionUrl = new URL(buildSiteUrl(locale ? addLocalePrefix("/auth/complete", locale) : "/auth/complete"));
  if (role) {
    completionUrl.searchParams.set("role", role);
  }
  if (returnTo) {
    completionUrl.searchParams.set("returnTo", returnTo);
  }
  return completionUrl.toString();
}
