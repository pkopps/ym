import type { Metadata } from "next";
import { OpsDashboardClient } from "../../components/OpsDashboardClient";

export const metadata: Metadata = {
  title: "Operational telemetry",
  robots: {
    index: false,
    follow: false
  }
};

export default function OpsPage() {
  return <OpsDashboardClient />;
}
