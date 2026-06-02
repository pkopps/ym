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
        <h1>Live crew openings.</h1>
        <p>See real demand coming from provider bookings.</p>
      </section>
      <CrewLiveDashboard />
    </main>
  );
}
