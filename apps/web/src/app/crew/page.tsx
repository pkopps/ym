import type { Metadata } from "next";
import { CrewHiringDashboard } from "../../components/CrewHiringDashboard";

export const metadata: Metadata = {
  title: "Crew dashboard",
  description:
    "Browse open landscaping crews, see hiring windows, and find business owners who need help right away."
};

export default function CrewPage() {
  return (
    <main className="container stack-lg">
      <section className="page-hero">
        <span className="eyebrow">Crew dashboard</span>
        <h1>Crews hiring near you.</h1>
        <p>See who needs help, when they need it, and what they provide.</p>
      </section>
      <CrewHiringDashboard />
    </main>
  );
}
