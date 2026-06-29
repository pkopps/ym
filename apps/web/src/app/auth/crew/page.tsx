import type { Metadata } from "next";
import { CrewSignupExperience } from "../../../components/CrewSignupExperience";

export const metadata: Metadata = {
  title: "Crew member sign up"
};

export default function CrewSignupPage() {
  return (
    <main className="container stack-lg">
      <section className="page-hero">
        <span className="eyebrow">Crew member sign up</span>
        <h1>Create your crew profile.</h1>
        <p>Set the skills and availability YardMatch should use for recommended crew openings.</p>
      </section>

      <CrewSignupExperience />
    </main>
  );
}
