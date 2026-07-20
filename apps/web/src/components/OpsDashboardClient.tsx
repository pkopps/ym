"use client";

import { InboundAutomationEscalationResponse, ObservabilityOverview } from "@yardmatch/contracts";
import { useEffect, useState } from "react";
import { createAuthenticatedWebApiClient } from "../lib/api";
import { useStoredWebSession } from "../lib/session";
import { NotificationOpsBoard } from "./NotificationOpsBoard";
import { OpsAccountManagementBoard } from "./OpsAccountManagementBoard";
import { OpsFinancialExceptionBoard } from "./OpsFinancialExceptionBoard";
import { OpsLaunchLeadBoard } from "./OpsLaunchLeadBoard";
import { OpsLaunchPlaybook } from "./OpsLaunchPlaybook";
import { OpsPayoutRunBoard } from "./OpsPayoutRunBoard";
import { OpsProviderVerificationQueue } from "./OpsProviderVerificationQueue";
import { OpsReviewResponseBoard } from "./OpsReviewResponseBoard";
import { OpsSupportQueue } from "./OpsSupportQueue";
import { useI18n } from "@yardmatch/i18n/react";

function formatRate(value: number) {
  return `${(value * 100).toFixed(0)}%`;
}

function formatOpsAuditLabel(value: string) {
  return value.replaceAll("-", " ");
}

function formatAutomationStatus(value: "healthy" | "watch" | "stale") {
  return value === "healthy" ? "Healthy" : value === "watch" ? "Watch" : "Stale";
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
    retentionInsights: [],
    totalLaunchLeads: 0,
    openLaunchLeads: 0,
    overdueLaunchLeads: 0,
    firstResponseOverdueLaunchLeads: 0,
    followUpOverdueLaunchLeads: 0,
    convertedLaunchLeads: 0,
    closedLostLaunchLeads: 0,
    launchLeadSourceMetrics: [],
    inboundAutomationSourceMetrics: [],
    inboundAutomationAlerts: [],
    recentInboundAutomationActivity: [],
    recommendationMetricsBySource: [],
    activeUsers5m: 0,
    activeCustomers5m: 0,
    activeProviders5m: 0,
    activeCrewMembers5m: 0,
    totalOpsAccounts: 0,
    activeOpsAdminAccounts: 0,
    activeOpsStaffAccounts: 0,
    disabledOpsAccounts: 0,
    lockedOpsAccounts: 0,
    dormantOpsAccounts: 0,
    neverSignedInOpsAccounts: 0,
    opsAccountsWithRecentFailures: 0,
    pendingOpsPasswordResetInvites: 0,
    opsAccessPolicy: {
      roleModel: "admin-and-operations",
      minimumActiveAdminAccounts: 1,
      activeAdminAccountCount: 0,
      hasRequiredAdminCoverage: false,
      adminRequiredActions: [],
      operationsAllowedActions: [],
      authenticationControls: [],
      escalationTriggers: [],
      warnings: ["At least one active ops-admin account is required before internal staff tooling is launch-ready."]
    },
    launchOperationsPolicy: {
      policyVersion: "launch-ops-v1",
      activePressureLevel: "normal",
      coveragePockets: [],
      coverageActionRecommendations: [],
      scenarioRules: [],
      serviceQualityStandards: [],
      interventionRules: [],
      escalationTriggers: [],
      warnings: []
    },
    accessAlerts: [],
    recentOpsAccessChanges: [],
    recentOpsAuthenticationEvents: [],
    recentOpsSignIns: [],
    recentFailedOpsSignIns: [],
    activeUsersByPlatform: {},
    recentEvents: []
  };
}

export function OpsDashboardClient() {
  const i18n = useI18n();
  const { session, sessionReady } = useStoredWebSession();
  const [overview, setOverview] = useState<ObservabilityOverview>(createEmptyOverview);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [inboundEscalationResult, setInboundEscalationResult] = useState<
    InboundAutomationEscalationResponse | undefined
  >();
  const [isEscalatingInboundAlerts, setIsEscalatingInboundAlerts] = useState(false);

  const hasOpsAccess = session?.role === "ops";
  const hasOpsAdminAccess = session?.role === "ops" && session.internalScope === "admin";

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
          <span className="eyebrow">{i18n.t("ops_auto.ops_dashboard_client.live_operations_6th7cw")}</span>
          <h1>{i18n.t("ops_auto.ops_dashboard_client.bookings_activity_and_support_y23kvt")}</h1>
          <p>{i18n.t("ops_auto.ops_dashboard_client.loading_the_authenticated_ops_workspace_6hz0s5")}</p>
        </section>
      </main>
    );
  }

  if (!hasOpsAccess) {
    return (
      <main className="container stack-lg">
        <section className="page-hero">
          <span className="eyebrow">{i18n.t("ops_auto.ops_dashboard_client.live_operations_6th7cw")}</span>
          <h1>{i18n.t("ops_auto.ops_dashboard_client.bookings_activity_and_support_y23kvt")}</h1>
          <p>{i18n.t("ops_auto.ops_dashboard_client.this_internal_dashboard_now_requires_an_authorized_ops_c1xeyq")}</p>
        </section>
        <section className="card">
          <h2>{i18n.t("ops_auto.ops_dashboard_client.internal_login_required_o4urdl")}</h2>
          <p>{i18n.t("ops_auto.ops_dashboard_client.sign_in_with_an_authorized_ops_account_to_r4dqpr")}</p>
          <a className="button" href="/login/ops">
            {i18n.t("ops_auto.ops_dashboard_client.go_to_ops_login_xyifm")} </a>
        </section>
      </main>
    );
  }

  async function handleEscalateInboundAutomation() {
    try {
      setIsEscalatingInboundAlerts(true);
      setErrorMessage(undefined);
      const api = createAuthenticatedWebApiClient();
      const response = await api.escalateInboundAutomationAlerts();
      setInboundEscalationResult(response);
      setOverview(await api.getObservabilityOverview());
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to send inbound automation escalation."
      );
    } finally {
      setIsEscalatingInboundAlerts(false);
    }
  }

  return (
    <main className="container stack-lg">
      <section className="page-hero">
        <span className="eyebrow">{i18n.t("ops_auto.ops_dashboard_client.live_operations_6th7cw")}</span>
        <h1>{i18n.t("ops_auto.ops_dashboard_client.bookings_activity_and_support_y23kvt")}</h1>
        <p>{i18n.t("ops_auto.ops_dashboard_client.live_from_the_authenticated_api_5w1d6y")}</p>
        {isLoading ? <p>{i18n.t("ops_auto.ops_dashboard_client.refreshing_the_latest_ops_data_i6zw57")}</p> : null}
        {errorMessage ? <p>{errorMessage}</p> : null}
      </section>

      <section className="grid-three">
        <article className="card">
          <h2>{overview.totalBookings}</h2>
          <p>{i18n.t("ops_auto.ops_dashboard_client.total_bookings_recorded_o3wco6")}</p>
        </article>
        <article className="card">
          <h2>{overview.activeUsers5m}</h2>
          <p>{i18n.t("ops_auto.ops_dashboard_client.active_users_in_the_last_5_minutes_hoz8si")}</p>
        </article>
        <article className="card">
          <h2>{overview.refundRequestedCount}</h2>
          <p>{i18n.t("ops_auto.ops_dashboard_client.refund_requests_raised_bg7ubw")}</p>
        </article>
      </section>

      <section className="grid-three">
        <article className="card">
          <h2>{formatRate(overview.providerSearchCoverageRate)}</h2>
          <p>{i18n.t("ops_auto.ops_dashboard_client.searches_that_found_at_least_one_provider_oiwq8u")}</p>
        </article>
        <article className="card">
          <h2>{formatRate(overview.providerSearchOpenWindowRate)}</h2>
          <p>{i18n.t("ops_auto.ops_dashboard_client.searches_that_found_a_live_route_window_yzkzgx")}</p>
        </article>
        <article className="card">
          <h2>{overview.providerSearches}</h2>
          <p>{i18n.t("ops_auto.ops_dashboard_client.provider_searches_recorded_sibi8l")}</p>
        </article>
      </section>

      <section className="grid-three">
        <article className="card">
          <h2>{formatRate(overview.recommendationBookingIntentRate)}</h2>
          <p>{i18n.t("ops_auto.ops_dashboard_client.recommendation_sessions_that_reached_booking_intent_x9fm1a")}</p>
        </article>
        <article className="card">
          <h2>{formatRate(overview.recommendationAcceptanceRate)}</h2>
          <p>{i18n.t("ops_auto.ops_dashboard_client.recommendation_sessions_that_stayed_with_the_first_choice_k1l8vl")}</p>
        </article>
        <article className="card">
          <h2>{formatRate(overview.recommendationAlternativeRevealRate)}</h2>
          <p>{i18n.t("ops_auto.ops_dashboard_client.recommendation_sessions_that_opened_alternatives_uo9zkw")}</p>
        </article>
        <article className="card">
          <h2>{formatRate(overview.recommendationSwapRate)}</h2>
          <p>{i18n.t("ops_auto.ops_dashboard_client.recommendation_sessions_that_switched_providers_wm3mum")}</p>
        </article>
        <article className="card">
          <h2>{formatRate(overview.recommendationDismissalRate)}</h2>
          <p>{i18n.t("ops_auto.ops_dashboard_client.recommendation_sessions_dismissed_for_a_new_search_xghvgv")}</p>
        </article>
      </section>

      <section className="grid-three">
        <article className="card">
          <h2>{overview.providerSearchesNoResults}</h2>
          <p>{i18n.t("ops_auto.ops_dashboard_client.searches_with_no_provider_matches_kvtdhv")}</p>
        </article>
        <article className="card">
          <h2>{overview.providerSearchesNoOpenWindows}</h2>
          <p>{i18n.t("ops_auto.ops_dashboard_client.searches_with_providers_but_no_open_window_qwv8t0")}</p>
        </article>
        <article className="card">
          <h2>{overview.recommendationViews}</h2>
          <p>{i18n.t("ops_auto.ops_dashboard_client.recommendation_views_recorded_g2y37b")}</p>
        </article>
        <article className="card">
          <h2>{overview.recommendationBookingIntents}</h2>
          <p>{i18n.t("ops_auto.ops_dashboard_client.raw_booking_intent_events_from_recommendation_flows_ra091h")}</p>
        </article>
        <article className="card">
          <h2>{overview.recommendationDismissals}</h2>
          <p>{i18n.t("ops_auto.ops_dashboard_client.raw_recommendation_dismissals_5mgbd9")}</p>
        </article>
        <article className="card">
          <h2>{overview.swappedRecommendations}</h2>
          <p>{i18n.t("ops_auto.ops_dashboard_client.raw_swap_events_to_another_provider_szp9xb")}</p>
        </article>
      </section>

      <section className="grid-three">
        <article className="card">
          <h2>{overview.providerBookingConfirmations}</h2>
          <p>{i18n.t("ops_auto.ops_dashboard_client.provider_booking_confirmations_i75408")}</p>
        </article>
        <article className="card">
          <h2>{overview.providerBookingDeclines}</h2>
          <p>{i18n.t("ops_auto.ops_dashboard_client.provider_booking_declines_9sr87n")}</p>
        </article>
        <article className="card">
          <h2>{overview.customerBookingCancellations}</h2>
          <p>{i18n.t("ops_auto.ops_dashboard_client.customer_booking_cancellations_xe87fr")}</p>
        </article>
      </section>

      <section className="grid-three">
        <article className="card">
          <h2>{overview.openLaunchLeads}</h2>
          <p>{i18n.t("ops_auto.ops_dashboard_client.open_launch_leads_needing_follow_up_y88wgz")}</p>
        </article>
        <article className="card">
          <h2>{overview.overdueLaunchLeads}</h2>
          <p>{i18n.t("ops_auto.ops_dashboard_client.launch_leads_currently_overdue_n7zkgg")}</p>
        </article>
        <article className="card">
          <h2>{overview.convertedLaunchLeads}</h2>
          <p>{i18n.t("ops_auto.ops_dashboard_client.launch_leads_already_converted_7rfdx0")}</p>
        </article>
      </section>

      <section className="grid-three">
        <article className="card">
          <h2>{overview.firstResponseOverdueLaunchLeads}</h2>
          <p>{i18n.t("ops_auto.ops_dashboard_client.first_responses_overdue_lyna6a")}</p>
        </article>
        <article className="card">
          <h2>{overview.followUpOverdueLaunchLeads}</h2>
          <p>{i18n.t("ops_auto.ops_dashboard_client.follow_up_actions_overdue_uw8gwc")}</p>
        </article>
        <article className="card">
          <h2>{overview.closedLostLaunchLeads}</h2>
          <p>{i18n.t("ops_auto.ops_dashboard_client.launch_leads_closed_lost_4ek9qa")}</p>
        </article>
      </section>

      <section className="grid-three">
        <article className="card">
          <h2>{overview.paymentCheckoutStarts}</h2>
          <p>{i18n.t("ops_auto.ops_dashboard_client.stripe_checkout_sessions_started_4n7pzv")}</p>
        </article>
        <article className="card">
          <h2>{overview.paymentAuthorizations}</h2>
          <p>{i18n.t("ops_auto.ops_dashboard_client.payment_authorizations_recorded_1yenno")}</p>
        </article>
        <article className="card">
          <h2>{overview.paymentCaptures}</h2>
          <p>{i18n.t("ops_auto.ops_dashboard_client.payments_captured_w3zx3l")}</p>
        </article>
        <article className="card">
          <h2>{overview.paymentFailures}</h2>
          <p>{i18n.t("ops_auto.ops_dashboard_client.payments_that_failed_or_expired_nwz1d1")}</p>
        </article>
        <article className="card">
          <h2>{overview.refundRequestedCount}</h2>
          <p>{i18n.t("ops_auto.ops_dashboard_client.refund_requests_raised_bg7ubw")}</p>
        </article>
      </section>

      <section className="grid-three">
        <article className="card">
          <h2>{overview.totalReviewInvites}</h2>
          <p>{i18n.t("ops_auto.ops_dashboard_client.review_requests_created_l73zn8")}</p>
        </article>
        <article className="card">
          <h2>{overview.completedReviewInvites}</h2>
          <p>{i18n.t("ops_auto.ops_dashboard_client.reviews_received_from_invite_flow_alwcmh")}</p>
        </article>
        <article className="card">
          <h2>{formatRate(overview.reviewRequestCompletionRate)}</h2>
          <p>{i18n.t("ops_auto.ops_dashboard_client.review_request_completion_rate_lnjwd1")}</p>
        </article>
      </section>

      <section className="grid-three">
        <article className="card">
          <h2>{overview.pendingReviewResponses}</h2>
          <p>{i18n.t("ops_auto.ops_dashboard_client.recent_public_review_replies_to_work_lfhm6w")}</p>
        </article>
        <article className="card">
          <h2>{overview.urgentReviewResponses}</h2>
          <p>{i18n.t("ops_auto.ops_dashboard_client.review_replies_that_should_go_out_today_j6iwl")}</p>
        </article>
        <article className="card">
          <h2>{overview.overdueReviewResponses}</h2>
          <p>{i18n.t("ops_auto.ops_dashboard_client.pending_review_replies_already_overdue_w27k1r")}</p>
        </article>
      </section>

      <section className="grid-three">
        <article className="card">
          <h2>{overview.inboundAutomationSourceMetrics.length}</h2>
          <p>{i18n.t("ops_auto.ops_dashboard_client.inbound_automation_channels_tracked_8h58xw")}</p>
        </article>
        <article className="card">
          <h2>
            {overview.inboundAutomationSourceMetrics.filter((item) => item.status === "stale").length}
          </h2>
          <p>{i18n.t("ops_auto.ops_dashboard_client.inbound_channels_now_stale_mjb546")}</p>
        </article>
        <article className="card">
          <h2>{overview.recentInboundAutomationActivity.length}</h2>
          <p>{i18n.t("ops_auto.ops_dashboard_client.recent_automated_inbound_items_shown_below_l3vdru")}</p>
        </article>
      </section>

      <section className="grid-two">
        <article className="card">
          <h2>{i18n.t("ops_auto.ops_dashboard_client.inbound_automation_alerts_vww8jr")}</h2>
          {inboundEscalationResult ? (
            <p>
              {i18n.t("ops_auto.ops_dashboard_client.external_inbound_alert_8ygu2")} {inboundEscalationResult.reason} {i18n.t("ops_auto.ops_dashboard_client.sent_1j5iw")}{" "}
              {inboundEscalationResult.sentCount} of {inboundEscalationResult.targetCount} target
              {inboundEscalationResult.targetCount === 1 ? "" : "s"}.
            </p>
          ) : null}
          <div className="cta-row">
            <button
              className="button-secondary"
              disabled={isEscalatingInboundAlerts || overview.inboundAutomationAlerts.length === 0}
              onClick={() => void handleEscalateInboundAutomation()}
              type="button"
            >
              {isEscalatingInboundAlerts ? "Escalating..." : "Send external inbound alert"}
            </button>
          </div>
          {overview.inboundAutomationAlerts.length === 0 ? (
            <p>{i18n.t("ops_auto.ops_dashboard_client.no_inbound_automation_channels_look_stale_right_now_rch9k9")}</p>
          ) : (
            <div className="stack-lg" style={{ paddingBottom: 0 }}>
              {overview.inboundAutomationAlerts.map((alert) => (
                <article className="list-panel" key={`${alert.kind}:${alert.sourceKey}`}>
                  <h3>{alert.label}</h3>
                  <p>
                    {alert.kind === "launch-lead" ? "Launch lead forwarder" : "Review reply forwarder"} •{" "}
                    {alert.severity}
                  </p>
                  <p>{alert.detail}</p>
                  <p>{alert.recommendedAction}</p>
                </article>
              ))}
            </div>
          )}
        </article>

        <article className="card">
          <h2>{i18n.t("ops_auto.ops_dashboard_client.recent_inbound_automation_activity_82cz84")}</h2>
          {overview.recentInboundAutomationActivity.length === 0 ? (
            <p>{i18n.t("ops_auto.ops_dashboard_client.no_automated_inbound_lead_or_review_activity_has_9iv4w")}</p>
          ) : (
            <div className="stack-lg" style={{ paddingBottom: 0 }}>
              {overview.recentInboundAutomationActivity.map((item) => (
                <article className="list-panel" key={item.id}>
                  <h3>{item.label}</h3>
                  <p>
                    {item.kind === "launch-lead" ? "Launch lead" : "Review reply"} •{" "}
                    {new Date(item.occurredAt).toLocaleString()}
                  </p>
                  <p>{item.summary}</p>
                  {item.reference ? <p>{i18n.t("ops_auto.ops_dashboard_client.reference_f5ow41")} {item.reference}</p> : null}
                </article>
              ))}
            </div>
          )}
        </article>
      </section>

      <section className="card">
        <h2>{i18n.t("ops_auto.ops_dashboard_client.inbound_automation_health_by_source_lsma72")}</h2>
        {overview.inboundAutomationSourceMetrics.length === 0 ? (
          <p>{i18n.t("ops_auto.ops_dashboard_client.no_automated_inbound_channels_have_been_recorded_yet_cpi4n4")}</p>
        ) : (
          <div className="stack-lg" style={{ paddingBottom: 0 }}>
            {overview.inboundAutomationSourceMetrics.map((metric) => (
              <article className="list-panel" key={`${metric.kind}:${metric.sourceKey}`}>
                <div className="search-result-title">
                  <div>
                    <h3>{metric.label}</h3>
                    <p>
                      {metric.kind === "launch-lead" ? "Launch lead forwarder" : "Review reply forwarder"} •{" "}
                      {i18n.t("ops_auto.ops_dashboard_client.last_seen_wc0fd1")}{" "}
                      {metric.lastOccurredAt ? new Date(metric.lastOccurredAt).toLocaleString() : "never"}
                    </p>
                  </div>
                  <span className="result-badge">{formatAutomationStatus(metric.status)}</span>
                </div>
                <p>
                  {metric.recentCount} {i18n.t("ops_auto.ops_dashboard_client.automated_item_vf4war")}{metric.recentCount === 1 ? "" : "s"} {i18n.t("ops_auto.ops_dashboard_client.in_the_last_7_days_3x9iyo")} {metric.openLeadCount !== undefined
                    ? ` • ${metric.openLeadCount} still open in the lead queue`
                    : ""}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="grid-two">
        <article className="card">
          <h2>{i18n.t("ops_auto.ops_dashboard_client.internal_access_alerts_wqipf4")}</h2>
          {overview.accessAlerts.length === 0 ? (
            <p>{i18n.t("ops_auto.ops_dashboard_client.no_internal_access_alerts_need_action_right_now_y7izot")}</p>
          ) : (
            <div className="stack-lg" style={{ paddingBottom: 0 }}>
              {overview.accessAlerts.map((alert) => (
                <article className="list-panel" key={`${alert.opsUserId}:${alert.title}`}>
                  <h3>{alert.title}</h3>
                  <p>
                    {alert.opsUserName} • {alert.opsUserEmail} • {alert.severity}
                  </p>
                  <p>{alert.detail}</p>
                  <p>{alert.recommendedAction}</p>
                </article>
              ))}
            </div>
          )}
        </article>

        <article className="card">
          <h2>{i18n.t("ops_auto.ops_dashboard_client.recent_failed_internal_sign_ins_mmfpkt")}</h2>
          {overview.recentFailedOpsSignIns.length === 0 ? (
            <p>{i18n.t("ops_auto.ops_dashboard_client.no_failed_internal_sign_ins_recorded_recently_xohrw9")}</p>
          ) : (
            <div className="stack-lg" style={{ paddingBottom: 0 }}>
              {overview.recentFailedOpsSignIns.map((item) => (
                <article className="list-panel" key={`${item.opsUserId}:${item.failedAt}`}>
                  <h3>{item.opsUserName}</h3>
                  <p>
                    {item.opsUserEmail} • {item.internalScope === "admin" ? "Admin" : "Operations staff"} •{" "}
                    {item.isActive ? "Active" : "Disabled"}
                  </p>
                  <p>
                    {item.failedCount} {i18n.t("ops_auto.ops_dashboard_client.failed_sign_in_7ei8nm")}{item.failedCount === 1 ? "" : "s"} {i18n.t("ops_auto.ops_dashboard_client.last_bczgvg")} {item.reason.replaceAll("-", " ")} •{" "}
                    {new Date(item.failedAt).toLocaleString()}
                  </p>
                </article>
              ))}
            </div>
          )}
        </article>
      </section>

      <section className="grid-three">
        <article className="card">
          <h2>{overview.retentionPromptViews}</h2>
          <p>{i18n.t("ops_auto.ops_dashboard_client.retention_nudges_shown_4atiet")}</p>
        </article>
        <article className="card">
          <h2>{overview.retentionPromptAccepts}</h2>
          <p>{i18n.t("ops_auto.ops_dashboard_client.retention_nudges_clicked_wzqpr3")}</p>
        </article>
        <article className="card">
          <h2>{formatRate(overview.retentionPromptAcceptanceRate)}</h2>
          <p>{i18n.t("ops_auto.ops_dashboard_client.retention_nudge_acceptance_rate_yaj8gu")}</p>
        </article>
      </section>

      <section className="grid-three">
        <article className="card">
          <h2>{overview.activeOpsAdminAccounts}</h2>
          <p>{i18n.t("ops_auto.ops_dashboard_client.active_admin_ops_accounts_ju8em9")}</p>
        </article>
        <article className="card">
          <h2>{overview.activeOpsStaffAccounts}</h2>
          <p>{i18n.t("ops_auto.ops_dashboard_client.active_staff_ops_accounts_77eh9u")}</p>
        </article>
        <article className="card">
          <h2>{overview.disabledOpsAccounts}</h2>
          <p>{i18n.t("ops_auto.ops_dashboard_client.disabled_ops_accounts_m38ns")}</p>
        </article>
      </section>

      <OpsReviewResponseBoard initialItems={overview.recentReviewResponses} />

      <section className="card">
        <h2>{i18n.t("ops_auto.ops_dashboard_client.retention_strategy_performance_5z8ov9")}</h2>
        {overview.retentionMetricsByStrategy.length === 0 ? (
          <p>{i18n.t("ops_auto.ops_dashboard_client.no_retention_strategy_events_recorded_yet_hdv8ed")}</p>
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
                  {metric.promptViews} {i18n.t("ops_auto.ops_dashboard_client.prompt_view_q2igv5")}{metric.promptViews === 1 ? "" : "s"} •{" "}
                  {metric.promptAccepts} click{metric.promptAccepts === 1 ? "" : "s"}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="grid-two">
        <article className="card">
          <h2>{i18n.t("ops_auto.ops_dashboard_client.retention_conversion_by_source_oelbc4")}</h2>
          {overview.retentionMetricsBySource.length === 0 ? (
            <p>{i18n.t("ops_auto.ops_dashboard_client.no_repeat_service_conversions_recorded_from_retention_flows_a35sfe")}</p>
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
                    {metric.bookingRequests} {i18n.t("ops_auto.ops_dashboard_client.booking_request_7bzpdk")}{metric.bookingRequests === 1 ? "" : "s"} from{" "}
                    {metric.promptAccepts} click{metric.promptAccepts === 1 ? "" : "s"} •{" "}
                    {metric.recurringPlanStarts} {i18n.t("ops_auto.ops_dashboard_client.recurring_plan_w7ytmc")} {metric.recurringPlanStarts === 1 ? "" : "s"} • {metric.oneTimeRebooks} {i18n.t("ops_auto.ops_dashboard_client.one_time_rebook_prkyvs")} {metric.oneTimeRebooks === 1 ? "" : "s"}
                  </p>
                </article>
              ))}
            </div>
          )}
        </article>

        <article className="card">
          <h2>{i18n.t("ops_auto.ops_dashboard_client.retention_conversion_by_provider_chnape")}</h2>
          {overview.retentionMetricsByProvider.length === 0 ? (
            <p>{i18n.t("ops_auto.ops_dashboard_client.no_provider_level_repeat_service_conversions_recorded_from_5ajlgw")}</p>
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
                    <span className="result-badge">{metric.bookingRequests} {i18n.t("ops_auto.ops_dashboard_client.repeat_bookings_r0kw69")}</span>
                  </div>
                  <p>
                    {metric.recurringPlanStarts} {i18n.t("ops_auto.ops_dashboard_client.recurring_plan_w7ytmc")}{metric.recurringPlanStarts === 1 ? "" : "s"} •{" "}
                    {metric.oneTimeRebooks} {i18n.t("ops_auto.ops_dashboard_client.one_time_rebook_prkyvs")}{metric.oneTimeRebooks === 1 ? "" : "s"}
                  </p>
                </article>
              ))}
            </div>
          )}
        </article>
      </section>

      <section className="grid-two">
        <article className="card">
          <h2>{i18n.t("ops_auto.ops_dashboard_client.operational_counts_sfd5zi")}</h2>
          <ul className="timeline">
            <li>
              <strong>1</strong>
              <span>{overview.bookingsLast24Hours} {i18n.t("ops_auto.ops_dashboard_client.bookings_created_in_the_last_24_hours_8ob1ht")}</span>
            </li>
            <li>
              <strong>2</strong>
              <span>{overview.requestedBookings} {i18n.t("ops_auto.ops_dashboard_client.bookings_still_waiting_on_fulfillment_progress_ab6o0v")}</span>
            </li>
            <li>
              <strong>3</strong>
              <span>{overview.openSupportTickets} {i18n.t("ops_auto.ops_dashboard_client.support_tickets_still_open_or_triaged_pvd89")}</span>
            </li>
            <li>
              <strong>4</strong>
              <span>{overview.providerSearchesNoResults} {i18n.t("ops_auto.ops_dashboard_client.searches_ended_with_no_provider_coverage_nej66a")}</span>
            </li>
            <li>
              <strong>5</strong>
              <span>{overview.providerSearchesNoOpenWindows} {i18n.t("ops_auto.ops_dashboard_client.searches_found_providers_but_no_live_route_opening_x05juv")}</span>
            </li>
            <li>
              <strong>6</strong>
              <span>{overview.recommendationAlternativesViewed} {i18n.t("ops_auto.ops_dashboard_client.recommendation_sessions_opened_alternatives_u4kunz")}</span>
            </li>
            <li>
              <strong>7</strong>
              <span>{overview.recommendationBookingIntents} {i18n.t("ops_auto.ops_dashboard_client.recommendation_sessions_reached_booking_intent_ibgqer")}</span>
            </li>
            <li>
              <strong>8</strong>
              <span>{overview.acceptedRecommendations} {i18n.t("ops_auto.ops_dashboard_client.bookings_accepted_the_first_recommendation_5j5x1x")}</span>
            </li>
            <li>
              <strong>9</strong>
              <span>{overview.paymentCaptures} {i18n.t("ops_auto.ops_dashboard_client.bookings_have_reached_captured_payment_status_wx2fma")}</span>
            </li>
            <li>
              <strong>10</strong>
              <span>{overview.paymentFailures} {i18n.t("ops_auto.ops_dashboard_client.checkout_attempts_failed_or_expired_before_capture_zdegw6")}</span>
            </li>
          </ul>
        </article>

        <article className="card">
          <h2>{i18n.t("ops_auto.ops_dashboard_client.active_users_by_role_drpur7")}</h2>
          <div className="metrics">
            <article className="stat-card">
              <strong>{overview.activeCustomers5m}</strong>
              <p>{i18n.t("ops_auto.ops_dashboard_client.customers_active_in_the_last_5_minutes_7h062t")}</p>
            </article>
            <article className="stat-card">
              <strong>{overview.activeProviders5m}</strong>
              <p>{i18n.t("ops_auto.ops_dashboard_client.providers_active_in_the_last_5_minutes_3qhmco")}</p>
            </article>
            <article className="stat-card">
              <strong>{overview.activeCrewMembers5m}</strong>
              <p>{i18n.t("ops_auto.ops_dashboard_client.crew_members_active_in_the_last_5_minutes_rho76o")}</p>
            </article>
          </div>
        </article>
        <article className="card">
          <h2>{i18n.t("ops_auto.ops_dashboard_client.launch_lead_sources_q49ja7")}</h2>
          {overview.launchLeadSourceMetrics.length === 0 ? (
            <p>{i18n.t("ops_auto.ops_dashboard_client.no_launch_lead_activity_yet_so9l35")}</p>
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
          <h2>{i18n.t("ops_auto.ops_dashboard_client.review_workflow_c6sivt")}</h2>
          <ul className="timeline">
            <li>
              <strong>1</strong>
              <span>{overview.scheduledReviewInvites} {i18n.t("ops_auto.ops_dashboard_client.review_invites_still_scheduled_7jw0k7")}</span>
            </li>
            <li>
              <strong>2</strong>
              <span>{overview.sentReviewInvites} {i18n.t("ops_auto.ops_dashboard_client.review_invites_already_sent_fjnc3m")}</span>
            </li>
            <li>
              <strong>3</strong>
              <span>{overview.openedReviewInvites} {i18n.t("ops_auto.ops_dashboard_client.review_invites_opened_li8y2v")}</span>
            </li>
            <li>
              <strong>4</strong>
              <span>{overview.completedReviewInvites} {i18n.t("ops_auto.ops_dashboard_client.invites_completed_into_real_reviews_t5kyqa")}</span>
            </li>
            <li>
              <strong>5</strong>
              <span>{overview.expiredReviewInvites} {i18n.t("ops_auto.ops_dashboard_client.invites_expired_without_a_review_870abk")}</span>
            </li>
          </ul>
        </article>
        <article className="card">
          <h2>{i18n.t("ops_auto.ops_dashboard_client.internal_access_health_tj4l7v")}</h2>
          <ul className="timeline">
            <li>
              <strong>1</strong>
              <span>{overview.totalOpsAccounts} {i18n.t("ops_auto.ops_dashboard_client.total_ops_account_saplp")}{overview.totalOpsAccounts === 1 ? "" : "s"}</span>
            </li>
            <li>
              <strong>2</strong>
              <span>{overview.activeOpsAdminAccounts} {i18n.t("ops_auto.ops_dashboard_client.active_admin_account_z4atry")}{overview.activeOpsAdminAccounts === 1 ? "" : "s"}</span>
            </li>
            <li>
              <strong>3</strong>
              <span>{overview.activeOpsStaffAccounts} {i18n.t("ops_auto.ops_dashboard_client.active_staff_account_jzf5n7")}{overview.activeOpsStaffAccounts === 1 ? "" : "s"}</span>
            </li>
            <li>
              <strong>4</strong>
              <span>{overview.disabledOpsAccounts} {i18n.t("ops_auto.ops_dashboard_client.disabled_internal_account_oo8xea")}{overview.disabledOpsAccounts === 1 ? "" : "s"}</span>
            </li>
            <li>
              <strong>5</strong>
              <span>{overview.lockedOpsAccounts} {i18n.t("ops_auto.ops_dashboard_client.ops_account_hr76td")}{overview.lockedOpsAccounts === 1 ? "" : "s"} {i18n.t("ops_auto.ops_dashboard_client.temporarily_locked_after_repeated_failures_1wifll")}</span>
            </li>
            <li>
              <strong>6</strong>
              <span>{overview.neverSignedInOpsAccounts} {i18n.t("ops_auto.ops_dashboard_client.active_ops_account_nt332z")}{overview.neverSignedInOpsAccounts === 1 ? "" : "s"} {i18n.t("ops_auto.ops_dashboard_client.never_signed_in_f4r1ez")}</span>
            </li>
            <li>
              <strong>7</strong>
              <span>{overview.dormantOpsAccounts} {i18n.t("ops_auto.ops_dashboard_client.active_ops_account_nt332z")}{overview.dormantOpsAccounts === 1 ? "" : "s"} {i18n.t("ops_auto.ops_dashboard_client.dormant_for_30_days_qjbig1")}</span>
            </li>
            <li>
              <strong>8</strong>
              <span>{overview.opsAccountsWithRecentFailures} {i18n.t("ops_auto.ops_dashboard_client.ops_account_hr76td")}{overview.opsAccountsWithRecentFailures === 1 ? "" : "s"} {i18n.t("ops_auto.ops_dashboard_client.with_recent_failed_sign_ins_11lioa")}</span>
            </li>
            <li>
              <strong>9</strong>
              <span>{overview.pendingOpsPasswordResetInvites} {i18n.t("ops_auto.ops_dashboard_client.pending_reset_invite_5xg92b")}{overview.pendingOpsPasswordResetInvites === 1 ? "" : "s"}</span>
            </li>
          </ul>
        </article>
      </section>

      <section className="grid-two">
        <article className="card">
          <h2>{i18n.t("ops_auto.ops_dashboard_client.platform_activity_sqbk04")}</h2>
          <div className="stack-lg" style={{ paddingBottom: 0 }}>
            {Object.entries(overview.activeUsersByPlatform).map(([platform, count]) => (
              <article className="list-panel" key={platform}>
                <h3>{platform}</h3>
                <p>{count} {i18n.t("ops_auto.ops_dashboard_client.active_sessions_z6x1mf")}</p>
              </article>
            ))}
          </div>
        </article>

        <article className="card">
          <h2>{i18n.t("ops_auto.ops_dashboard_client.recommendation_performance_by_surface_fxqyv9")}</h2>
          <div className="stack-lg" style={{ paddingBottom: 0 }}>
            {overview.recommendationMetricsBySource.length === 0 ? (
              <p>{i18n.t("ops_auto.ops_dashboard_client.no_recommendation_conversion_data_recorded_yet_a3rnia")}</p>
            ) : (
              overview.recommendationMetricsBySource.map((surface) => (
                <article className="list-panel" key={surface.requestSource}>
                  <h3>{surface.requestSource}</h3>
                  <p>
                    {surface.providerSearches} {i18n.t("ops_auto.ops_dashboard_client.searches_bqon54")} {formatRate(surface.providerSearchCoverageRate)} {i18n.t("ops_auto.ops_dashboard_client.coverage_kqriei")}{" "}
                    {formatRate(surface.providerSearchOpenWindowRate)} open-window
                  </p>
                  <p>
                    {surface.recommendationViews} {i18n.t("ops_auto.ops_dashboard_client.views_7ig834")} {formatRate(surface.recommendationBookingIntentRate)} {i18n.t("ops_auto.ops_dashboard_client.booking_intent_1p9rb9")}{" "}
                    {formatRate(surface.recommendationAcceptanceRate)} {i18n.t("ops_auto.ops_dashboard_client.first_choice_accept_2v9xbq")} </p>
                  <p>
                    {formatRate(surface.recommendationAlternativeRevealRate)} {i18n.t("ops_auto.ops_dashboard_client.alternatives_opened_hyact7")}{" "}
                    {formatRate(surface.recommendationDismissalRate)} {i18n.t("ops_auto.ops_dashboard_client.dismissed_mogr6d")} {formatRate(surface.recommendationSwapRate)} swapped
                  </p>
                  <p>
                    {surface.providerSearchesNoResults} {i18n.t("ops_auto.ops_dashboard_client.no_match_kjuvt1")} {surface.providerSearchesNoOpenWindows} {i18n.t("ops_auto.ops_dashboard_client.no_window_l6j5oi")}{" "}
                    {surface.recommendationBookingIntents} {i18n.t("ops_auto.ops_dashboard_client.raw_booking_intent_events_d1csz5")} </p>
                </article>
              ))
            )}
          </div>
        </article>
      </section>

      <section className="grid-two">
        <article className="card">
          <h2>{i18n.t("ops_auto.ops_dashboard_client.recent_telemetry_events_crou57")}</h2>
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
          <h2>{i18n.t("ops_auto.ops_dashboard_client.recent_internal_access_changes_cmayfv")}</h2>
          {overview.recentOpsAccessChanges.length === 0 ? (
            <p>{i18n.t("ops_auto.ops_dashboard_client.no_internal_access_changes_recorded_yet_wo11pd")}</p>
          ) : (
            <div className="stack-lg" style={{ paddingBottom: 0 }}>
              {overview.recentOpsAccessChanges.map((change) => (
                <article className="list-panel" key={`${change.opsUserId}:${change.changedAt}:${change.kind}`}>
                  <h3>{change.opsUserName}</h3>
                  <p>
                    {change.opsUserEmail} • {change.internalScope === "admin" ? "Admin" : "Operations staff"} •{" "}
                    {change.isActive ? "Active" : "Disabled"}
                  </p>
                  <p>
                    {change.kind.replaceAll("-", " ")} • {new Date(change.changedAt).toLocaleString()}
                    {change.changedByName ? ` • by ${change.changedByName}` : ""}
                  </p>
                  {change.notes ? <p>{change.notes}</p> : null}
                </article>
              ))}
            </div>
          )}
        </article>

        <article className="card">
          <h2>{i18n.t("ops_auto.ops_dashboard_client.recent_internal_sign_ins_kbqzd0")}</h2>
          {overview.recentOpsSignIns.length === 0 ? (
            <p>{i18n.t("ops_auto.ops_dashboard_client.no_internal_sign_ins_recorded_yet_1qjn20")}</p>
          ) : (
            <div className="stack-lg" style={{ paddingBottom: 0 }}>
              {overview.recentOpsSignIns.map((item) => (
                <article className="list-panel" key={`${item.opsUserId}:${item.signedInAt}`}>
                  <h3>{item.opsUserName}</h3>
                  <p>
                    {item.opsUserEmail} • {item.internalScope === "admin" ? "Admin" : "Operations staff"} •{" "}
                    {item.isActive ? "Active" : "Disabled"}
                  </p>
                  <p>
                    {i18n.t("ops_auto.ops_dashboard_client.signed_in_via_gdv1u1")} {item.method.replaceAll("-", " ")} •{" "}
                    {new Date(item.signedInAt).toLocaleString()}
                  </p>
                </article>
              ))}
            </div>
          )}
        </article>

        <article className="card">
          <h2>{i18n.t("ops_auto.ops_dashboard_client.recent_internal_auth_events_ld8t2r")}</h2>
          {overview.recentOpsAuthenticationEvents.length === 0 ? (
            <p>{i18n.t("ops_auto.ops_dashboard_client.no_internal_auth_events_recorded_yet_jcfihv")}</p>
          ) : (
            <div className="stack-lg" style={{ paddingBottom: 0 }}>
              {overview.recentOpsAuthenticationEvents.map((event) => (
                <article className="list-panel" key={`${event.opsUserId}:${event.occurredAt}:${event.kind}`}>
                  <h3>{event.opsUserName}</h3>
                  <p>
                    {event.opsUserEmail} • {event.internalScope === "admin" ? "Admin" : "Operations staff"} •{" "}
                    {event.isActive ? "Active" : "Disabled"}
                  </p>
                  <p>
                    {formatOpsAuditLabel(event.kind)} • {new Date(event.occurredAt).toLocaleString()}
                    {event.recordedByName ? ` • by ${event.recordedByName}` : ""}
                  </p>
                  {event.method ? <p>{i18n.t("ops_auto.ops_dashboard_client.method_rp4cdj")} {formatOpsAuditLabel(event.method)}</p> : null}
                  {event.reason ? (
                    <p>
                      {i18n.t("ops_auto.ops_dashboard_client.reason_pmi1ey")} {formatOpsAuditLabel(event.reason)}
                      {event.failedCount !== undefined ? ` • count ${event.failedCount}` : ""}
                    </p>
                  ) : event.failedCount !== undefined ? (
                    <p>{i18n.t("ops_auto.ops_dashboard_client.failed_attempt_count_pohwz2")} {event.failedCount}</p>
                  ) : null}
                  {event.lockExpiresAt ? (
                    <p>{i18n.t("ops_auto.ops_dashboard_client.lock_expires_2hqpwh")} {new Date(event.lockExpiresAt).toLocaleString()}</p>
                  ) : null}
                  {event.notes ? <p>{event.notes}</p> : null}
                </article>
              ))}
            </div>
          )}
        </article>

      </section>

      <section className="grid-two">
        <article className="card">
          <h2>{i18n.t("ops_auto.ops_dashboard_client.recommendation_analytics_notes_pylilc")}</h2>
          <div className="stack-lg" style={{ paddingBottom: 0 }}>
            <p>
              {i18n.t("ops_auto.ops_dashboard_client.recommendation_telemetry_now_groups_search_demand_no_match_n8fqpn")} </p>
          </div>
        </article>
      </section>

      <OpsLaunchPlaybook />
      {hasOpsAdminAccess ? (
        <OpsAccountManagementBoard currentOpsUserId={session?.userId} />
      ) : (
        <section className="card">
          <h2>{i18n.t("ops_auto.ops_dashboard_client.ops_account_management_3dg678")}</h2>
          <p>{i18n.t("ops_auto.ops_dashboard_client.this_internal_account_management_workspace_is_limited_to_siiu5o")}</p>
        </section>
      )}
      <NotificationOpsBoard />
      <OpsPayoutRunBoard />
      <OpsFinancialExceptionBoard />
      <OpsLaunchLeadBoard />
      <OpsProviderVerificationQueue />
      <OpsSupportQueue />
    </main>
  );
}
