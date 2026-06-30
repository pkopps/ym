import type { Metadata } from "next";
import { ProviderPaymentsBoard } from "../../../components/ProviderPaymentsBoard";

export const metadata: Metadata = {
  title: "Payments",
  description:
    "Review provider earnings, payout holds, crew reserves, and weekly payout timing."
};

export default function ProviderPaymentsPage() {
  return (
    <main className="container stack-lg">
      <section className="page-hero">
        <div className="search-result-title">
          <div>
            <span className="eyebrow">Payments</span>
            <h1>Know what is earned, held, ready, and paid.</h1>
            <p>Track completed-service earnings, crew reserves, payout holds, and the next weekly deposit in one place.</p>
          </div>
          <div className="cta-row">
            <a className="button" href="/provider/management">
              Open management portal
            </a>
            <a className="button-secondary" href="/provider">
              Back to provider overview
            </a>
          </div>
        </div>
      </section>

      <ProviderPaymentsBoard />
    </main>
  );
}
