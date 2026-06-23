import type { Metadata } from "next";
import { PublicCustomerMarketplacePage } from "../../components/PublicCustomerMarketplacePage";
import { buildSiteUrl, launchAreaLabel, noIndexRobots } from "../../lib/site";

export const metadata: Metadata = {
  title: `Book lawn care in ${launchAreaLabel}`,
  description: `Search for vetted lawn care and landscaping services in ${launchAreaLabel}.`,
  alternates: {
    canonical: buildSiteUrl("/")
  },
  robots: noIndexRobots
};

export default function CustomerPage() {
  return <PublicCustomerMarketplacePage />;
}
