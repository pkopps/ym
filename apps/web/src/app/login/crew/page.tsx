import type { Metadata } from "next";
import { RoleLoginCard } from "../../../components/RoleLoginCard";

export const metadata: Metadata = {
  title: "Crew member login"
};

export default function CrewLoginPage() {
  return (
    <main className="container stack-lg">
      <section className="page-hero">
        <h1>Log in to your crew account.</h1>
        <p>Check openings, schedules, and past work.</p>
      </section>
      <RoleLoginCard role="crew-member" />
    </main>
  );
}
