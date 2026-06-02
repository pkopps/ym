import type { Metadata } from "next";
import { ProviderLiveManagementBoard } from "../../../components/ProviderLiveManagementBoard";

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
            <h1>Upcoming jobs and live marketplace demand.</h1>
            <p>Manage booked work and see how it flows into the crew side.</p>
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

      <ProviderLiveManagementBoard />
    </main>
  );
}
