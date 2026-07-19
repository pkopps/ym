import type { Metadata } from "next";
import { TrustPolicyPage } from "../../components/TrustPolicyPage";
import { getLocalizedPageMetadata } from "../../lib/i18n-server";
import { getTrustPolicyPageKey, trustPolicyPageById } from "../../lib/trustPolicyContent";

const page = trustPolicyPageById.support;

export function generateMetadata(): Promise<Metadata> {
  return getLocalizedPageMetadata({
    path: page.href,
    titleKey: getTrustPolicyPageKey(page, "title"),
    descriptionKey: getTrustPolicyPageKey(page, "description")
  });
}

export default function SupportPage() {
  return <TrustPolicyPage page={page} />;
}
