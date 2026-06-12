import type { Metadata } from "next";
import { RoleLoginExperience } from "../../../components/RoleLoginExperience";

export const metadata: Metadata = {
  title: "Crew member login"
};

export default function CrewLoginPage() {
  return <RoleLoginExperience role="crew-member" />;
}
