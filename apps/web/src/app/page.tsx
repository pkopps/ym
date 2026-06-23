import type { Metadata } from "next";
import { PublicCustomerMarketplacePage } from "../components/PublicCustomerMarketplacePage";
import { buildSiteUrl, launchAreaLabel } from "../lib/site";

export const metadata: Metadata = {
  title: `Lawn care in ${launchAreaLabel}`,
  description: `Book lawn mowing, yard cleanup, hedge trimming, mulch refresh, and other vetted yard services in ${launchAreaLabel} through YardMatch's recommendation-first marketplace.`,
  alternates: {
    canonical: buildSiteUrl("/")
  },
  openGraph: {
    title: `Lawn care in ${launchAreaLabel} | YardMatch`,
    description:
      `Book vetted yard services in ${launchAreaLabel} with one recommended provider first and a short backup list if you want it.`,
    url: buildSiteUrl("/")
  }
};

export default function HomePage() {
  return <PublicCustomerMarketplacePage />;
}
