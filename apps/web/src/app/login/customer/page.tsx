import type { Metadata } from "next";
import { RoleLoginExperience } from "../../../components/RoleLoginExperience";
import { getLocalizedPageMetadata } from "../../../lib/i18n-server";

export function generateMetadata(): Promise<Metadata> {
  return getLocalizedPageMetadata({
    path: "/login/customer",
    titleKey: "login_role.customer.metadata.title"
  });
}

export default function CustomerLoginPage() {
  return <RoleLoginExperience role="customer" />;
}
