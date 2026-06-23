import type { Metadata } from "next";
import { TrustPolicyPage } from "../../components/TrustPolicyPage";
import { buildSiteUrl } from "../../lib/site";
import { trustPolicyPageById } from "../../lib/trustPolicyContent";

const page = trustPolicyPageById["privacy-policy"];

export const metadata: Metadata = {
  title: `${page.title} | YardMatch`,
  description: page.description,
  alternates: {
    canonical: buildSiteUrl(page.href)
  },
  openGraph: {
    title: `${page.title} | YardMatch`,
    description: page.summary,
    url: buildSiteUrl(page.href)
  }
};

export default function PrivacyPolicyPage() {
  return <TrustPolicyPage page={page} />;
}
