import type { Metadata } from "next";
import { RoleLoginExperience } from "../../../components/RoleLoginExperience";
import { getLocalizedPageMetadata } from "../../../lib/i18n-server";

export function generateMetadata(): Promise<Metadata> {
  return getLocalizedPageMetadata({
    path: "/login/provider",
    titleKey: "login_role.provider.metadata.title"
  });
}

export default function ProviderLoginPage() {
  return <RoleLoginExperience role="provider" />;
}
