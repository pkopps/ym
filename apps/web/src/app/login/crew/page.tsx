import type { Metadata } from "next";
import { RoleLoginExperience } from "../../../components/RoleLoginExperience";
import { getLocalizedPageMetadata } from "../../../lib/i18n-server";

export function generateMetadata(): Promise<Metadata> {
  return getLocalizedPageMetadata({
    path: "/login/crew",
    titleKey: "login_role.crew.metadata.title"
  });
}

export default function CrewLoginPage() {
  return <RoleLoginExperience role="crew-member" />;
}
