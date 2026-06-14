import type { Metadata } from "next";
import { MarketplaceApiClient, ObservabilityOverview } from "@yardmatch/contracts";
import { getWebApiBaseUrl } from "../../lib/api";
import { NotificationOpsBoard } from "../../components/NotificationOpsBoard";
import { OpsFinancialExceptionBoard } from "../../components/OpsFinancialExceptionBoard";
import { OpsPayoutRunBoard } from "../../components/OpsPayoutRunBoard";
import { OpsProviderVerificationQueue } from "../../components/OpsProviderVerificationQueue";
import { OpsSupportQueue } from "../../components/OpsSupportQueue";

export const metadata: Metadata = {
  title: "Operational telemetry",
  robots: {
    index: false,
    follow: false
  }
};

async function getOverview(): Promise<ObservabilityOverview> {
  const api = new MarketplaceApiClient(getWebApiBaseUrl());

  try {
    return await api.getObservabilityOverview();
  } catch {
    return {
      generatedAt: new Date().toISOString(),
      totalBookings: 0,
      requestedBookings: 0,
      bookingsLast24Hours: 0,
      refundRequestedCount: 0,
      openSupportTickets: 0,
      recommendationViews: 0,
      recommendationAlternativesViewed: 0,
      recommendationDismissals: 0,
      acceptedRecommendations: 0,
      swappedRecommendations: 0,
      recommendationAcceptanceRate: 0,
      providerBookingConfirmations: 0,
      providerBookingDeclines: 0,
      customerBookingCancellations: 0,
      paymentAuthorizations: 0,
      paymentCaptures: 0,
      recommendationMetricsBySource: [],
      activeUsers5m: 0,
      activeCustomers5m: 0,
      activeProviders5m: 0,
      activeCrewMembers5m: 0,
      activeUsersByPlatform: {},
      recentEvents: []
    };
  }
}

export default async function OpsPage() {
  const overview = await getOverview();

  return (
    <main className="container stack-lg">
      <section className="page-hero">
        <span className="eyebrow">Live operations</span>
        <h1>Bookings, activity, and support.</h1>
        <p>Live from the API.</p>
      </section>

      <section className="grid-three">
        <article className="card">
          <h2>{overview.totalBookings}</h2>
          <p>Total bookings recorded</p>
        </article>
        <article className="card">
          <h2>{overview.activeUsers5m}</h2>
          <p>Active users in the last 5 minutes</p>
        </article>
        <article className="card">
          <h2>{overview.refundRequestedCount}</h2>
          <p>Refund requests raised</p>
        </article>
      </section>

      <section className="grid-three">
        <article className="card">
          <h2>{overview.recommendationViews}</h2>
          <p>Recommendation views recorded</p>
        </article>
        <article className="card">
          <h2>{(overview.recommendationAcceptanceRate * 100).toFixed(0)}%</h2>
          <p>Recommendation acceptance rate</p>
        </article>
        <article className="card">
          <h2>{overview.swappedRecommendations}</h2>
          <p>Bookings moved to an alternative provider</p>
        </article>
        <article className="card">
          <h2>{overview.recommendationDismissals}</h2>
          <p>Recommendations dismissed for a new search</p>
        </article>
      </section>

      <section className="grid-three">
        <article className="card">
          <h2>{overview.providerBookingConfirmations}</h2>
          <p>Provider booking confirmations</p>
        </article>
        <article className="card">
          <h2>{overview.providerBookingDeclines}</h2>
          <p>Provider booking declines</p>
        </article>
        <article className="card">
          <h2>{overview.customerBookingCancellations}</h2>
          <p>Customer booking cancellations</p>
        </article>
      </section>

      <section className="grid-three">
        <article className="card">
          <h2>{overview.paymentAuthorizations}</h2>
          <p>Payment authorizations recorded</p>
        </article>
        <article className="card">
          <h2>{overview.paymentCaptures}</h2>
          <p>Payments captured</p>
        </article>
        <article className="card">
          <h2>{overview.refundRequestedCount}</h2>
          <p>Refund requests raised</p>
        </article>
      </section>

      <section className="grid-two">
        <article className="card">
          <h2>Operational counts</h2>
          <ul className="timeline">
            <li>
              <strong>1</strong>
              <span>{overview.bookingsLast24Hours} bookings created in the last 24 hours</span>
            </li>
            <li>
              <strong>2</strong>
              <span>{overview.requestedBookings} bookings still waiting on fulfillment progress</span>
            </li>
            <li>
              <strong>3</strong>
              <span>{overview.openSupportTickets} support tickets still open or triaged</span>
            </li>
            <li>
              <strong>4</strong>
              <span>{overview.recommendationAlternativesViewed} recommendation sessions opened alternatives</span>
            </li>
            <li>
              <strong>5</strong>
              <span>{overview.acceptedRecommendations} bookings accepted the first recommendation</span>
            </li>
            <li>
              <strong>6</strong>
              <span>{overview.paymentCaptures} bookings have reached captured payment status</span>
            </li>
          </ul>
        </article>

        <article className="card">
          <h2>Active users by role</h2>
          <div className="metrics">
            <article className="stat-card">
              <strong>{overview.activeCustomers5m}</strong>
              <p>Customers active in the last 5 minutes</p>
            </article>
            <article className="stat-card">
              <strong>{overview.activeProviders5m}</strong>
              <p>Providers active in the last 5 minutes</p>
            </article>
            <article className="stat-card">
              <strong>{overview.activeCrewMembers5m}</strong>
              <p>Crew members active in the last 5 minutes</p>
            </article>
          </div>
        </article>
      </section>

      <section className="grid-two">
        <article className="card">
          <h2>Platform activity</h2>
          <div className="stack-lg" style={{ paddingBottom: 0 }}>
            {Object.entries(overview.activeUsersByPlatform).map(([platform, count]) => (
              <article className="list-panel" key={platform}>
                <h3>{platform}</h3>
                <p>{count} active sessions</p>
              </article>
            ))}
          </div>
        </article>

        <article className="card">
          <h2>Recommendation performance by surface</h2>
          <div className="stack-lg" style={{ paddingBottom: 0 }}>
            {overview.recommendationMetricsBySource.length === 0 ? (
              <p>No recommendation conversion data recorded yet.</p>
            ) : (
              overview.recommendationMetricsBySource.map((surface) => (
                <article className="list-panel" key={surface.requestSource}>
                  <h3>{surface.requestSource}</h3>
                  <p>
                    {surface.recommendationViews} views •{" "}
                    {(surface.recommendationAcceptanceRate * 100).toFixed(0)}% accepted
                  </p>
                  <p>
                    {surface.recommendationAlternativesViewed} alternative reveals •{" "}
                    {surface.recommendationDismissals} dismissals •{" "}
                    {surface.swappedRecommendations} swaps
                  </p>
                </article>
              ))
            )}
          </div>
        </article>
      </section>

      <section className="grid-two">
        <article className="card">
          <h2>Recent telemetry events</h2>
          <div className="stack-lg" style={{ paddingBottom: 0 }}>
            {overview.recentEvents.map((event) => (
              <article className="list-panel" key={event.id}>
                <h3>{event.name}</h3>
                <p>{new Date(event.occurredAt).toLocaleString()}</p>
              </article>
            ))}
          </div>
        </article>

        <article className="card">
          <h2>Recommendation analytics notes</h2>
          <div className="stack-lg" style={{ paddingBottom: 0 }}>
            <p>
              Recommendation views, reveals, accepts, and swaps are now grouped by source so you can
              compare public search, customer dashboard, and mobile booking behavior without
              exporting raw analytics first.
            </p>
          </div>
        </article>
      </section>

      <NotificationOpsBoard />
      <OpsPayoutRunBoard />
      <OpsFinancialExceptionBoard />
      <OpsProviderVerificationQueue />
      <OpsSupportQueue />
    </main>
  );
}
