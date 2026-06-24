"use client";

import { ObservabilityOverview } from "@yardmatch/contracts";
import { useEffect, useState } from "react";
import { createAuthenticatedWebApiClient } from "../lib/api";
import { useStoredWebSession } from "../lib/session";
import { NotificationOpsBoard } from "./NotificationOpsBoard";
import { OpsFinancialExceptionBoard } from "./OpsFinancialExceptionBoard";
import { OpsLaunchLeadBoard } from "./OpsLaunchLeadBoard";
import { OpsLaunchPlaybook } from "./OpsLaunchPlaybook";
import { OpsPayoutRunBoard } from "./OpsPayoutRunBoard";
import { OpsProviderVerificationQueue } from "./OpsProviderVerificationQueue";
import { OpsReviewResponseBoard } from "./OpsReviewResponseBoard";
import { OpsSupportQueue } from "./OpsSupportQueue";

function formatRate(value: number) {
  return `${(value * 100).toFixed(0)}%`;
}

function createEmptyOverview(): ObservabilityOverview {
  return {
    generatedAt: new Date().toISOString(),
    totalBookings: 0,
    requestedBookings: 0,
    bookingsLast24Hours: 0,
    refundRequestedCount: 0,
    openSupportTickets: 0,
    providerSearches: 0,
    providerSearchesNoResults: 0,
    providerSearchesNoOpenWindows: 0,
    providerSearchCoverageRate: 0,
    providerSearchOpenWindowRate: 0,
    recommendationViews: 0,
    recommendationAlternativesViewed: 0,
    recommendationAlternativeRevealRate: 0,
    recommendationDismissals: 0,
    recommendationDismissalRate: 0,
    recommendationBookingIntents: 0,
    recommendationBookingIntentRate: 0,
    acceptedRecommendations: 0,
    swappedRecommendations: 0,
    recommendationAcceptanceRate: 0,
    recommendationSwapRate: 0,
    providerBookingConfirmations: 0,
    providerBookingDeclines: 0,
    customerBookingCancellations: 0,
    paymentCheckoutStarts: 0,
    paymentAuthorizations: 0,
    paymentCaptures: 0,
    paymentFailures: 0,
    totalReviewInvites: 0,
    scheduledReviewInvites: 0,
    sentReviewInvites: 0,
    openedReviewInvites: 0,
    completedReviewInvites: 0,
    expiredReviewInvites: 0,
    reviewRequestCompletionRate: 0,
    pendingReviewResponses: 0,
    urgentReviewResponses: 0,
    watchReviewResponses: 0,
    overdueReviewResponses: 0,
    recentReviewResponses: [],
    retentionPromptViews: 0,
    retentionPromptAccepts: 0,
    retentionPromptAcceptanceRate: 0,
    retentionMetricsByStrategy: [],
    retentionMetricsBySource: [],
    retentionMetricsByProvider: [],
    totalLaunchLeads: 0,
    openLaunchLeads: 0,
    overdueLaunchLeads: 0,
    firstResponseOverdueLaunchLeads: 0,
    followUpOverdueLaunchLeads: 0,
    convertedLaunchLeads: 0,
    closedLostLaunchLeads: 0,
    launchLeadSourceMetrics: [],
    recommendationMetricsBySource: [],
    activeUsers5m: 0,
    activeCustomers5m: 0,
    activeProviders5m: 0,
    activeCrewMembers5m: 0,
    activeUsersByPlatform: {},
    recentEvents: []
  };
}

export function OpsDashboardClient() {
  const { session, sessionReady } = useStoredWebSession();
  const [overview, setOverview] = useState<ObservabilityOverview>(createEmptyOverview);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);

  const hasOpsAccess = session?.role === "ops";

  useEffect(() => {
    if (!sessionReady) {
      return;
    }

    if (!hasOpsAccess) {
      setIsLoading(false);
      setOverview(createEmptyOverview());
      return;
    }

    void (async () => {
      try {
        setErrorMessage(undefined);
        setIsLoading(true);
        const api = createAuthenticatedWebApiClient();
        setOverview(await api.getObservabilityOverview());
      } catch (error) {
        setOverview(createEmptyOverview());
        setErrorMessage(error instanceof Error ? error.message : "Unable to load the ops overview.");
      } finally {
        setIsLoading(false);
      }
    })();
  }, [hasOpsAccess, sessionReady]);

  if (!sessionReady) {
    return (
      <main className="container stack-lg">
        <section className="page-hero">
          <span className="eyebrow">Live operations</span>
          <h1>Bookings, activity, and support.</h1>
          <p>Loading the authenticated ops workspace.</p>
        </section>
      </main>
    );
  }

  if (!hasOpsAccess) {
    return (
      <main className="container stack-lg">
        <section className="page-hero">
          <span className="eyebrow">Live operations</span>
          <h1>Bookings, activity, and support.</h1>
          <p>This internal dashboard now requires an authorized ops session instead of loading anonymously.</p>
        </section>
        <section className="card">
          <h2>Internal login required</h2>
          <p>Sign in with an authorized ops account to open the internal operations workspace.</p>
          <a className="button" href="/login/ops">
            Go to ops login
          </a>
        </section>
      </main>
    );
  }

  return (
    <main className="container stack-lg">
      <section className="page-hero">
        <span className="eyebrow">Live operations</span>
        <h1>Bookings, activity, and support.</h1>
        <p>Live from the authenticated API.</p>
        {isLoading ? <p>Refreshing the latest ops data.</p> : null}
        {errorMessage ? <p>{errorMessage}</p> : null}
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
          <h2>{formatRate(overview.providerSearchCoverageRate)}</h2>
          <p>Searches that found at least one provider</p>
        </article>
        <article className="card">
          <h2>{formatRate(overview.providerSearchOpenWindowRate)}</h2>
          <p>Searches that found a live route window</p>
        </article>
        <article className="card">
          <h2>{overview.providerSearches}</h2>
          <p>Provider searches recorded</p>
        </article>
      </section>

      <section className="grid-three">
        <article className="card">
          <h2>{formatRate(overview.recommendationBookingIntentRate)}</h2>
          <p>Recommendation sessions that reached booking intent</p>
        </article>
        <article className="card">
          <h2>{formatRate(overview.recommendationAcceptanceRate)}</h2>
          <p>Recommendation sessions that stayed with the first choice</p>
        </article>
        <article className="card">
          <h2>{formatRate(overview.recommendationAlternativeRevealRate)}</h2>
          <p>Recommendation sessions that opened alternatives</p>
        </article>
        <article className="card">
          <h2>{formatRate(overview.recommendationSwapRate)}</h2>
          <p>Recommendation sessions that switched providers</p>
        </article>
        <article className="card">
          <h2>{formatRate(overview.recommendationDismissalRate)}</h2>
          <p>Recommendation sessions dismissed for a new search</p>
        </article>
      </section>

      <section className="grid-three">
        <article className="card">
          <h2>{overview.providerSearchesNoResults}</h2>
          <p>Searches with no provider matches</p>
        </article>
        <article className="card">
          <h2>{overview.providerSearchesNoOpenWindows}</h2>
          <p>Searches with providers but no open window</p>
        </article>
        <article className="card">
          <h2>{overview.recommendationViews}</h2>
          <p>Recommendation views recorded</p>
        </article>
        <article className="card">
          <h2>{overview.recommendationBookingIntents}</h2>
          <p>Raw booking-intent events from recommendation flows</p>
        </article>
        <article className="card">
          <h2>{overview.recommendationDismissals}</h2>
          <p>Raw recommendation dismissals</p>
        </article>
        <article className="card">
          <h2>{overview.swappedRecommendations}</h2>
          <p>Raw swap events to another provider</p>
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
          <h2>{overview.openLaunchLeads}</h2>
          <p>Open launch leads needing follow-up</p>
        </article>
        <article className="card">
          <h2>{overview.overdueLaunchLeads}</h2>
          <p>Launch leads currently overdue</p>
        </article>
        <article className="card">
          <h2>{overview.convertedLaunchLeads}</h2>
          <p>Launch leads already converted</p>
        </article>
      </section>

      <section className="grid-three">
        <article className="card">
          <h2>{overview.firstResponseOverdueLaunchLeads}</h2>
          <p>First responses overdue</p>
        </article>
        <article className="card">
          <h2>{overview.followUpOverdueLaunchLeads}</h2>
          <p>Follow-up actions overdue</p>
        </article>
        <article className="card">
          <h2>{overview.closedLostLaunchLeads}</h2>
          <p>Launch leads closed lost</p>
        </article>
      </section>

      <section className="grid-three">
        <article className="card">
          <h2>{overview.paymentCheckoutStarts}</h2>
          <p>Stripe checkout sessions started</p>
        </article>
        <article className="card">
          <h2>{overview.paymentAuthorizations}</h2>
          <p>Payment authorizations recorded</p>
        </article>
        <article className="card">
          <h2>{overview.paymentCaptures}</h2>
          <p>Payments captured</p>
        </article>
        <article className="card">
          <h2>{overview.paymentFailures}</h2>
          <p>Payments that failed or expired</p>
        </article>
        <article className="card">
          <h2>{overview.refundRequestedCount}</h2>
          <p>Refund requests raised</p>
        </article>
      </section>

      <section className="grid-three">
        <article className="card">
          <h2>{overview.totalReviewInvites}</h2>
          <p>Review requests created</p>
        </article>
        <article className="card">
          <h2>{overview.completedReviewInvites}</h2>
          <p>Reviews received from invite flow</p>
        </article>
        <article className="card">
          <h2>{formatRate(overview.reviewRequestCompletionRate)}</h2>
          <p>Review request completion rate</p>
        </article>
      </section>

      <section className="grid-three">
        <article className="card">
          <h2>{overview.pendingReviewResponses}</h2>
          <p>Recent public review replies to work</p>
        </article>
        <article className="card">
          <h2>{overview.urgentReviewResponses}</h2>
          <p>Review replies that should go out today</p>
        </article>
        <article className="card">
          <h2>{overview.overdueReviewResponses}</h2>
          <p>Pending review replies already overdue</p>
        </article>
      </section>

      <section className="grid-three">
        <article className="card">
          <h2>{overview.retentionPromptViews}</h2>
          <p>Retention nudges shown</p>
        </article>
        <article className="card">
          <h2>{overview.retentionPromptAccepts}</h2>
          <p>Retention nudges clicked</p>
        </article>
        <article className="card">
          <h2>{formatRate(overview.retentionPromptAcceptanceRate)}</h2>
          <p>Retention nudge acceptance rate</p>
        </article>
      </section>

      <OpsReviewResponseBoard initialItems={overview.recentReviewResponses} />

      <section className="card">
        <h2>Retention strategy performance</h2>
        {overview.retentionMetricsByStrategy.length === 0 ? (
          <p>No retention strategy events recorded yet.</p>
        ) : (
          <div className="stack-lg" style={{ paddingBottom: 0 }}>
            {overview.retentionMetricsByStrategy.map((metric) => (
              <article className="list-panel" key={`${metric.strategyKey}:${metric.category}`}>
                <div className="search-result-title">
                  <div>
                    <h3>{metric.strategyKey.replaceAll("-", " ")}</h3>
                    <p>
                      {metric.category.replaceAll("-", " ")} • {metric.trigger.replaceAll("-", " ")}
                    </p>
                  </div>
                  <span className="result-badge">{formatRate(metric.acceptanceRate)}</span>
                </div>
                <p>
                  {metric.promptViews} prompt view{metric.promptViews === 1 ? "" : "s"} •{" "}
                  {metric.promptAccepts} click{metric.promptAccepts === 1 ? "" : "s"}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="grid-two">
        <article className="card">
          <h2>Retention conversion by source</h2>
          {overview.retentionMetricsBySource.length === 0 ? (
            <p>No repeat-service conversions recorded from retention flows yet.</p>
          ) : (
            <div className="stack-lg" style={{ paddingBottom: 0 }}>
              {overview.retentionMetricsBySource.map((metric) => (
                <article
                  className="list-panel"
                  key={`${metric.requestSource}:${metric.strategyKey}:${metric.category}`}
                >
                  <div className="search-result-title">
                    <div>
                      <h3>{metric.requestSource.replaceAll("-", " ")}</h3>
                      <p>
                        {metric.strategyKey.replaceAll("-", " ")} • {metric.category.replaceAll("-", " ")}
                      </p>
                    </div>
                    <span className="result-badge">{formatRate(metric.clickToBookingRate)}</span>
                  </div>
                  <p>
                    {metric.bookingRequests} booking request{metric.bookingRequests === 1 ? "" : "s"} from{" "}
                    {metric.promptAccepts} click{metric.promptAccepts === 1 ? "" : "s"} •{" "}
                    {metric.recurringPlanStarts} recurring plan
                    {metric.recurringPlanStarts === 1 ? "" : "s"} • {metric.oneTimeRebooks} one-time rebook
                    {metric.oneTimeRebooks === 1 ? "" : "s"}
                  </p>
                </article>
              ))}
            </div>
          )}
        </article>

        <article className="card">
          <h2>Retention conversion by provider</h2>
          {overview.retentionMetricsByProvider.length === 0 ? (
            <p>No provider-level repeat-service conversions recorded from retention flows yet.</p>
          ) : (
            <div className="stack-lg" style={{ paddingBottom: 0 }}>
              {overview.retentionMetricsByProvider.map((metric) => (
                <article
                  className="list-panel"
                  key={`${metric.providerId}:${metric.strategyKey}:${metric.category}`}
                >
                  <div className="search-result-title">
                    <div>
                      <h3>{metric.providerName ?? "Provider"}</h3>
                      <p>
                        {metric.strategyKey.replaceAll("-", " ")} • {metric.category.replaceAll("-", " ")}
                      </p>
                    </div>
                    <span className="result-badge">{metric.bookingRequests} repeat bookings</span>
                  </div>
                  <p>
                    {metric.recurringPlanStarts} recurring plan{metric.recurringPlanStarts === 1 ? "" : "s"} •{" "}
                    {metric.oneTimeRebooks} one-time rebook{metric.oneTimeRebooks === 1 ? "" : "s"}
                  </p>
                </article>
              ))}
            </div>
          )}
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
              <span>{overview.providerSearchesNoResults} searches ended with no provider coverage</span>
            </li>
            <li>
              <strong>5</strong>
              <span>{overview.providerSearchesNoOpenWindows} searches found providers but no live route opening</span>
            </li>
            <li>
              <strong>6</strong>
              <span>{overview.recommendationAlternativesViewed} recommendation sessions opened alternatives</span>
            </li>
            <li>
              <strong>7</strong>
              <span>{overview.recommendationBookingIntents} recommendation sessions reached booking intent</span>
            </li>
            <li>
              <strong>8</strong>
              <span>{overview.acceptedRecommendations} bookings accepted the first recommendation</span>
            </li>
            <li>
              <strong>9</strong>
              <span>{overview.paymentCaptures} bookings have reached captured payment status</span>
            </li>
            <li>
              <strong>10</strong>
              <span>{overview.paymentFailures} checkout attempts failed or expired before capture</span>
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
        <article className="card">
          <h2>Launch lead sources</h2>
          {overview.launchLeadSourceMetrics.length === 0 ? (
            <p>No launch lead activity yet.</p>
          ) : (
            <ul className="timeline">
              {overview.launchLeadSourceMetrics.slice(0, 5).map((metric) => (
                <li key={metric.sourceChannel}>
                  <strong>{metric.sourceChannel.replaceAll("-", " ")}</strong>
                  <span>
                    {metric.totalCount} total
                    {` • ${metric.openCount} open`}
                    {metric.overdueCount ? ` • ${metric.overdueCount} overdue` : ""}
                    {metric.convertedCount ? ` • ${metric.convertedCount} converted` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </article>
        <article className="card">
          <h2>Review workflow</h2>
          <ul className="timeline">
            <li>
              <strong>1</strong>
              <span>{overview.scheduledReviewInvites} review invites still scheduled</span>
            </li>
            <li>
              <strong>2</strong>
              <span>{overview.sentReviewInvites} review invites already sent</span>
            </li>
            <li>
              <strong>3</strong>
              <span>{overview.openedReviewInvites} review invites opened</span>
            </li>
            <li>
              <strong>4</strong>
              <span>{overview.completedReviewInvites} invites completed into real reviews</span>
            </li>
            <li>
              <strong>5</strong>
              <span>{overview.expiredReviewInvites} invites expired without a review</span>
            </li>
          </ul>
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
                    {surface.providerSearches} searches • {formatRate(surface.providerSearchCoverageRate)} coverage •{" "}
                    {formatRate(surface.providerSearchOpenWindowRate)} open-window
                  </p>
                  <p>
                    {surface.recommendationViews} views • {formatRate(surface.recommendationBookingIntentRate)} booking intent •{" "}
                    {formatRate(surface.recommendationAcceptanceRate)} first-choice accept
                  </p>
                  <p>
                    {formatRate(surface.recommendationAlternativeRevealRate)} alternatives opened •{" "}
                    {formatRate(surface.recommendationDismissalRate)} dismissed • {formatRate(surface.recommendationSwapRate)} swapped
                  </p>
                  <p>
                    {surface.providerSearchesNoResults} no-match • {surface.providerSearchesNoOpenWindows} no-window •{" "}
                    {surface.recommendationBookingIntents} raw booking-intent events
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
              Recommendation telemetry now groups search demand, no-match/no-window outcomes,
              booking intent, and conversion by source so you can compare public search, customer
              dashboard, and mobile booking behavior without exporting raw analytics first. Key
              rates are session-based, so repeated booking attempts from one recommendation session
              do not artificially inflate conversion.
            </p>
          </div>
        </article>
      </section>

      <OpsLaunchPlaybook />
      <NotificationOpsBoard />
      <OpsPayoutRunBoard />
      <OpsFinancialExceptionBoard />
      <OpsLaunchLeadBoard />
      <OpsProviderVerificationQueue />
      <OpsSupportQueue />
    </main>
  );
}
