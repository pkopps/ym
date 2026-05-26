import type { Metadata } from "next";
import { BookedBusinessResults } from "../../../components/BookedBusinessResults";

export const metadata: Metadata = {
  title: "Listings and map",
  description:
    "Browse a wider YardMatch results layout with dense provider information and an expandable map."
};

export default function CustomerListingsPage() {
  return (
    <main className="container container--wide stack-lg">
      <section className="page-hero">
        <span className="eyebrow">Listings</span>
        <h1>Browse providers with a full map view.</h1>
        <p>See more at once.</p>
      </section>

      <BookedBusinessResults allowMapToggle />
    </main>
  );
}
