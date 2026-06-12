import type { Metadata } from "next";
import { RoleLoginExperience } from "../../../components/RoleLoginExperience";

export const metadata: Metadata = {
  title: "Customer login"
};

export default function CustomerLoginPage() {
  return <RoleLoginExperience role="customer" />;
}
