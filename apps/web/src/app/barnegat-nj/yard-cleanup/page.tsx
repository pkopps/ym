import type { Metadata } from "next";
import { LaunchServiceLandingPage } from "../../../components/LaunchServiceLandingPage";
import { buildLaunchMetadata, launchServiceContent } from "../../../lib/launchLandingContent";

const content = launchServiceContent["yard-cleanup"];

export const metadata: Metadata = buildLaunchMetadata({
  title: content.title,
  description: content.description,
  path: content.townPath
});

export default function BarnegatYardCleanupPage() {
  return <LaunchServiceLandingPage serviceKey="yard-cleanup" variant="town-service" />;
}
