import type { Metadata } from "next";
import { LaunchServiceLandingPage } from "../../../components/LaunchServiceLandingPage";
import { buildLaunchMetadata, launchServiceContent } from "../../../lib/launchLandingContent";

const content = launchServiceContent["lawn-mowing"];

export const metadata: Metadata = buildLaunchMetadata({
  title: content.title,
  description: content.description,
  path: content.townPath
});

export default function BarnegatLawnMowingPage() {
  return <LaunchServiceLandingPage serviceKey="lawn-mowing" variant="town-service" />;
}
