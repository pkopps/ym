import type { Metadata } from "next";
import { addLocalePrefix } from "@yardmatch/i18n";
import { redirect } from "next/navigation";
import { getLocalizedPageMetadata, getRequestLocale } from "../../../lib/i18n-server";

export function generateMetadata(): Promise<Metadata> {
  return getLocalizedPageMetadata({
    path: "/auth/provider",
    titleKey: "auth_provider.alias_metadata.title"
  });
}

export default async function ProviderSignupPage() {
  const locale = await getRequestLocale();
  redirect(addLocalePrefix("/provider", locale));
}
