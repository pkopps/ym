import type { Metadata } from "next";
import { CrewLiveDashboard } from "../../components/CrewLiveDashboard";
import { getLocalizedPageMetadata } from "../../lib/i18n-server";

export function generateMetadata(): Promise<Metadata> {
  return getLocalizedPageMetadata({
    path: "/crew",
    titleKey: "crew_dashboard.metadata.title",
    descriptionKey: "crew_dashboard.metadata.description"
  });
}

export default async function CrewPage() {

  return (
    <main className="container stack-lg">
      <CrewLiveDashboard />
    </main>
  );
}
