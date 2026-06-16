import type { Metadata } from "next";
import { CrewLiveDashboard } from "../../components/CrewLiveDashboard";

export const metadata: Metadata = {
  title: "Crew dashboard",
  description:
    "Browse open landscaping crews, see hiring windows, and find business owners who need help right away."
};

export default function CrewPage() {
  return (
    <main className="container stack-lg">
      <section className="page-hero">
        <h1>No equipment, no problem. View openings on local crews.</h1>
      </section>
      <CrewLiveDashboard />
    </main>
  );
}
