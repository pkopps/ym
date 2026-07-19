import type { Metadata } from "next";
import { OpsDashboardClient } from "../../components/OpsDashboardClient";
import { getLocalizedPageMetadata } from "../../lib/i18n-server";

export async function generateMetadata(): Promise<Metadata> {
  const metadata = await getLocalizedPageMetadata({
    path: "/ops",
    titleKey: "ops.metadata.title"
  });
  return {
    ...metadata,
    robots: {
      index: false,
      follow: false
    }
  };
}

export default function OpsPage() {
  return <OpsDashboardClient />;
}
