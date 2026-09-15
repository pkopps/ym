import type { Metadata } from "next";
import { LaunchServiceLandingPage } from "../../../components/LaunchServiceLandingPage";
import { getLocalizedPageMetadata } from "../../../lib/i18n-server";
import { launchAreaLabel, launchServiceContent } from "../../../lib/launchLandingContent";

const content = launchServiceContent["yard-cleanup"];

export function generateMetadata(): Promise<Metadata> {
  return getLocalizedPageMetadata({
    titleKey: content.serviceMetadataTitleKey,
    descriptionKey: content.serviceMetadataDescriptionKey,
    path: content.path,
    values: {
      area: launchAreaLabel
    }
  });
}

export default function YardCleanupServicePage() {
  return <LaunchServiceLandingPage serviceKey="yard-cleanup" variant="service" />;
}
