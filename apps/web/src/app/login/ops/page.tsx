import type { Metadata } from "next";
import { RoleLoginExperience } from "../../../components/RoleLoginExperience";

export const metadata: Metadata = {
  title: "Operations login"
};

export default function OpsLoginPage() {
  return <RoleLoginExperience role="ops" />;
}
