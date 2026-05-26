import type { Metadata } from "next";
import { ProviderPaymentsBoard } from "../../../components/ProviderPaymentsBoard";

export const metadata: Metadata = {
  title: "Payments",
  description:
    "Manage weekly direct deposits, instant cash-outs, and payout accounts for provider operations."
};

export default function ProviderPaymentsPage() {
  return (
    <main className="container stack-lg">
      <section className="page-hero">
        <div className="search-result-title">
          <div>
            <span className="eyebrow">Payments</span>
            <h1>Run crew payouts with weekly deposits and instant cash-out.</h1>
            <p>Completed-service earnings default to weekly direct deposit, with instant cash-out available whenever you need funds sooner.</p>
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
