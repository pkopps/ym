import type { Metadata } from "next";
import { LaunchServiceLandingPage } from "../../../components/LaunchServiceLandingPage";
import { getLocalizedPageMetadata } from "../../../lib/i18n-server";
import { launchAreaLabel, launchServiceContent } from "../../../lib/launchLandingContent";

const content = launchServiceContent["lawn-mowing"];

export function generateMetadata(): Promise<Metadata> {
  return getLocalizedPageMetadata({
    titleKey: content.metadataTitleKey,
    descriptionKey: content.metadataDescriptionKey,
    path: content.path,
    values: {
      area: launchAreaLabel
    }
  });
}

export default function LawnMowingServicePage() {
  return <LaunchServiceLandingPage serviceKey="lawn-mowing" variant="service" />;
}
