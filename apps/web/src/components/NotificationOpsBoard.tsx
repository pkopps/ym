"use client";

import {
  NotificationDeliveryRecord,
  NotificationOpsEscalationResponse,
  NotificationOpsHealthResponse,
  NotificationOpsRetrySweepResponse
} from "@yardmatch/contracts";
import { I18nInstance } from "@yardmatch/i18n";
import { useI18n } from "@yardmatch/i18n/react";
import { useEffect, useState } from "react";
import { createAuthenticatedWebApiClient } from "../lib/api";

function formatDateTime(i18n: I18nInstance, iso?: string) {
  if (!iso) {
    return i18n.t("notification_ops.not_attempted");
  }

  return i18n.formatDate(iso, {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function maskDestination(delivery: NotificationDeliveryRecord) {
  if (delivery.channel === "email") {
    const [localPart, domain] = delivery.destination.split("@");
    if (!domain) {
      return delivery.destination;
    }
    return `${localPart.slice(0, 2)}***@${domain}`;
  }

  if (delivery.channel === "sms") {
    return delivery.destination.length > 4
      ? `${"*".repeat(Math.max(delivery.destination.length - 4, 0))}${delivery.destination.slice(-4)}`
      : delivery.destination;
  }

  if (delivery.channel === "push" && delivery.destination.startsWith("ExponentPushToken[")) {
    return `ExponentPushToken[...${delivery.destination.slice(-6)}]`;
  }

  return delivery.destination;
}

export function NotificationOpsBoard() {
  const i18n = useI18n();
  const [health, setHealth] = useState<NotificationOpsHealthResponse | undefined>();
  const [retryResult, setRetryResult] = useState<NotificationOpsRetrySweepResponse | undefined>();
  const [escalationResult, setEscalationResult] = useState<NotificationOpsEscalationResponse | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isEscalating, setIsEscalating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  async function loadHealth() {
    const api = createAuthenticatedWebApiClient();
    const response = await api.getNotificationOpsHealth();
    setHealth(response);
  }

  useEffect(() => {
    void (async () => {
      try {
        setErrorMessage(undefined);
        await loadHealth();
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : i18n.t("notification_ops.error.load"));
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  async function handleRetrySweep() {
      try {
        setIsRetrying(true);
        setErrorMessage(undefined);
      const api = createAuthenticatedWebApiClient();
      const response = await api.retryDueNotificationDeliveriesForOps();
      setRetryResult(response);
      await loadHealth();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("notification_ops.error.retry"));
    } finally {
      setIsRetrying(false);
    }
  }

  async function handleEscalate() {
      try {
        setIsEscalating(true);
        setErrorMessage(undefined);
      const api = createAuthenticatedWebApiClient();
      const response = await api.escalateNotificationOpsAlerts();
      setEscalationResult(response);
      await loadHealth();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("notification_ops.error.escalate"));
    } finally {
      setIsEscalating(false);
    }
  }

  return (
    <section className="card">
      <span className="eyebrow">{i18n.t("notification_ops.eyebrow")}</span>
      <h2>{i18n.t("notification_ops.title")}</h2>
      <p>{i18n.t("notification_ops.body")}</p>

      {isLoading ? <p>{i18n.t("notification_ops.loading")}</p> : null}
      {errorMessage ? <p>{errorMessage}</p> : null}
      {retryResult ? (
        <p>
          {i18n.t("notification_ops.retry_result", {
            retried: retryResult.retriedCount,
            recovered: retryResult.sentCount,
            failed: retryResult.failedCount,
            overdue: retryResult.remainingOverdueCount
          })}
        </p>
      ) : null}
      {escalationResult ? (
        <p>
          {i18n.t("notification_ops.escalation_result", {
            reason: escalationResult.reason,
            sent: escalationResult.sentCount,
            targets: escalationResult.targetCount
          })}
        </p>
      ) : null}

      {health ? (
        <div className="stack-lg" style={{ paddingBottom: 0 }}>
          <div className="grid-three">
            <article className="card">
              <h2>{health.deliveriesLast24Hours}</h2>
              <p>{i18n.t("notification_ops.metric.deliveries_24h")}</p>
            </article>
            <article className="card">
              <h2>{health.overdueRetryCount}</h2>
              <p>{i18n.t("notification_ops.metric.overdue_retries")}</p>
            </article>
            <article className="card">
              <h2>{health.exhaustedFailureCount}</h2>
              <p>{i18n.t("notification_ops.metric.exhausted_failures")}</p>
            </article>
          </div>

          <div className="cta-row">
            <button
              className="button-secondary"
              disabled={isRetrying || health.overdueRetryCount === 0}
              onClick={() => void handleRetrySweep()}
              type="button"
            >
              {isRetrying ? i18n.t("notification_ops.retrying") : i18n.t("notification_ops.run_retry_sweep")}
            </button>
            <button
              className="button-secondary"
              disabled={
                isEscalating ||
                !health.alerts.some((alert) => alert.severity === "warning" || alert.severity === "critical")
              }
              onClick={() => void handleEscalate()}
              type="button"
            >
              {isEscalating ? i18n.t("notification_ops.escalating") : i18n.t("notification_ops.send_external_alert")}
            </button>
            <span>{i18n.t("notification_ops.last_refreshed", { date: formatDateTime(i18n, health.generatedAt) })}</span>
          </div>

          <div className="stack-md">
            {health.alerts.map((alert) => (
              <article className="list-panel" key={`${alert.severity}-${alert.title}`}>
                <div className="search-result-title">
                  <div>
                    <h3>{alert.title}</h3>
                    <p>{alert.detail}</p>
                  </div>
                  <span className="result-badge">{alert.severity}</span>
                </div>
              </article>
            ))}
          </div>

          <div className="grid-two">
            <article className="list-panel">
              <h3>{i18n.t("notification_ops.breakdown.title")}</h3>
              <div className="stack-md" style={{ paddingBottom: 0 }}>
                {health.channels.length > 0 ? (
                  health.channels.map((channel) => (
                    <article className="list-panel" key={`${channel.channel}-${channel.provider}`}>
                      <div className="search-result-title">
                        <div>
                          <h3>
                            {channel.provider} • {channel.channel.toUpperCase()}
                          </h3>
                          <p>
                            {i18n.t("notification_ops.breakdown.channel_counts", {
                              failed: channel.failedCount,
                              sent: channel.sentCount,
                              retryable: channel.pendingRetryCount
                            })}
                          </p>
                        </div>
                        <span className="result-badge">{i18n.t("notification_ops.breakdown.last_24h", { count: channel.deliveriesLast24Hours })}</span>
                      </div>
                      <p>
                        {i18n.t("notification_ops.breakdown.channel_total", {
                          total: channel.totalDeliveries,
                          queued: channel.queuedCount,
                          overdue: channel.overdueRetryCount,
                          lastAttempt: formatDateTime(i18n, channel.lastAttemptAt)
                        })}
                      </p>
                    </article>
                  ))
                ) : (
                  <p>{i18n.t("notification_ops.breakdown.empty")}</p>
                )}
              </div>
            </article>

            <article className="list-panel">
              <h3>{i18n.t("notification_ops.failures.title")}</h3>
              <div className="stack-md" style={{ paddingBottom: 0 }}>
                {health.recentFailures.length > 0 ? (
                  health.recentFailures.map((delivery) => (
                    <article className="list-panel" key={delivery.id}>
                      <div className="search-result-title">
                        <div>
                          <h3>
                            {delivery.provider} • {delivery.channel.toUpperCase()}
                          </h3>
                          <p>
                            {i18n.t("notification_ops.failures.delivery_summary", {
                              destination: maskDestination(delivery),
                              role: delivery.recipientRole,
                              attempt: delivery.attemptCount
                            })}
                          </p>
                        </div>
                        <span className="result-badge">{delivery.status}</span>
                      </div>
                      <p>{delivery.title}</p>
                      <p>{delivery.errorMessage ?? i18n.t("notification_ops.failures.no_error_message")}</p>
                      <p>
                        {i18n.t("notification_ops.failures.last_attempt", {
                          date: formatDateTime(i18n, delivery.lastAttemptAt ?? delivery.createdAt)
                        })}
                        {delivery.nextRetryAt
                          ? ` • ${i18n.t("notification_ops.failures.next_retry", { date: formatDateTime(i18n, delivery.nextRetryAt) })}`
                          : ` • ${i18n.t("notification_ops.failures.no_retry")}`}
                      </p>
                    </article>
                  ))
                ) : (
                  <p>{i18n.t("notification_ops.failures.empty")}</p>
                )}
              </div>
            </article>
          </div>
        </div>
      ) : null}
    </section>
  );
}
