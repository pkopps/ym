import type { Metadata } from "next";
import { ProviderManagementBoard } from "../../../components/ProviderManagementBoard";

export const metadata: Metadata = {
  title: "Management portal",
  description:
    "Track upcoming client jobs, crew requirements, staffing gaps, and future route capacity in one provider portal."
};

export default function ProviderManagementPage() {
  return (
    <main className="container stack-lg">
      <section className="page-hero">
        <div className="search-result-title">
          <div>
            <span className="eyebrow">Management portal</span>
            <h1>Upcoming clients, routes, and crew demand.</h1>
            <p>See which properties need the most labor, where they are, and when crew supply is falling behind.</p>
          </div>
          <div className="cta-row">
            <a className="button" href="/crew">
              Find crew members
            </a>
            <a className="button-secondary" href="/provider">
              Back to provider overview
            </a>
          </div>
        </div>
      </section>

      <ProviderManagementBoard />
    </main>
  );
}
