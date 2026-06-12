import type { Metadata } from "next";
import { RoleLoginExperience } from "../../../components/RoleLoginExperience";

export const metadata: Metadata = {
  title: "Business owner login"
};

export default function ProviderLoginPage() {
  return <RoleLoginExperience role="provider" />;
}
