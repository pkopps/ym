import type { Metadata } from "next";
import { RoleLoginExperience } from "../../../components/RoleLoginExperience";
import { getLocalizedPageMetadata } from "../../../lib/i18n-server";

export function generateMetadata(): Promise<Metadata> {
  return getLocalizedPageMetadata({
    path: "/login/ops",
    titleKey: "login_role.ops.metadata.title"
  });
}

export default function OpsLoginPage() {
  return <RoleLoginExperience role="ops" />;
}
