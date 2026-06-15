import type { Metadata } from "next";
import { CustomerHistoryBoard } from "../../../components/CustomerHistoryBoard";

export const metadata: Metadata = {
  title: "Service history",
  description: "Review past YardMatch services, providers, crew notes, and billing outcomes."
};

export default function CustomerHistoryPage() {
  return (
    <main className="container stack-lg">
      <section className="page-hero">
        <span className="eyebrow">Service history</span>
        <h1>Past services in one place.</h1>
        <p>See what was done and who did it.</p>
      </section>

      <CustomerHistoryBoard />
    </main>
  );
}
