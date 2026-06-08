"use client";

import {
  MarketplaceApiClient,
  NotificationDeliveryRecord,
  NotificationOpsHealthResponse,
  NotificationOpsRetrySweepResponse
} from "@yardmatch/contracts";
import { useEffect, useState } from "react";
import { getWebApiBaseUrl } from "../lib/api";

function formatDateTime(iso?: string) {
  if (!iso) {
    return "Not attempted yet";
  }

  return new Date(iso).toLocaleString(undefined, {
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
  const [health, setHealth] = useState<NotificationOpsHealthResponse | undefined>();
  const [retryResult, setRetryResult] = useState<NotificationOpsRetrySweepResponse | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [isRetrying, setIsRetrying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  async function loadHealth() {
    const api = new MarketplaceApiClient(getWebApiBaseUrl());
    const response = await api.getNotificationOpsHealth();
    setHealth(response);
  }

  useEffect(() => {
    void (async () => {
      try {
        setErrorMessage(undefined);
        await loadHealth();
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Unable to load notification health.");
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  async function handleRetrySweep() {
    try {
      setIsRetrying(true);
      setErrorMessage(undefined);
      const api = new MarketplaceApiClient(getWebApiBaseUrl());
      const response = await api.retryDueNotificationDeliveriesForOps();
      setRetryResult(response);
      await loadHealth();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to retry overdue deliveries.");
    } finally {
      setIsRetrying(false);
    }
  }

  return (
    <section className="card">
      <span className="eyebrow">Notification health</span>
      <h2>Watch delivery failures before customers miss important updates.</h2>
      <p>
        This view tracks overdue retries, exhausted failures, and noisy providers across push, email,
        and SMS so ops can catch broken delivery paths early.
      </p>

      {isLoading ? <p>Checking notification delivery health.</p> : null}
      {errorMessage ? <p>{errorMessage}</p> : null}
      {retryResult ? (
        <p>
          Retry sweep: retried {retryResult.retriedCount}, recovered {retryResult.sentCount}, still failing{" "}
          {retryResult.failedCount}, overdue now {retryResult.remainingOverdueCount}.
        </p>
      ) : null}

      {health ? (
        <div className="stack-lg" style={{ paddingBottom: 0 }}>
          <div className="grid-three">
            <article className="card">
              <h2>{health.deliveriesLast24Hours}</h2>
              <p>Deliveries created in the last 24 hours</p>
            </article>
            <article className="card">
              <h2>{health.overdueRetryCount}</h2>
              <p>Retries overdue right now</p>
            </article>
            <article className="card">
              <h2>{health.exhaustedFailureCount}</h2>
              <p>Failures with no retry remaining</p>
            </article>
          </div>

          <div className="cta-row">
            <button
              className="button-secondary"
              disabled={isRetrying || health.overdueRetryCount === 0}
              onClick={() => void handleRetrySweep()}
              type="button"
            >
              {isRetrying ? "Retrying..." : "Run retry sweep"}
            </button>
            <span>Last refreshed {formatDateTime(health.generatedAt)}</span>
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
              <h3>Channel and provider breakdown</h3>
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
                            {channel.failedCount} failed • {channel.sentCount} sent • {channel.pendingRetryCount} retryable
                          </p>
                        </div>
                        <span className="result-badge">{channel.deliveriesLast24Hours} / 24h</span>
                      </div>
                      <p>
                        Total {channel.totalDeliveries} • queued {channel.queuedCount} • overdue{" "}
                        {channel.overdueRetryCount} • last attempt {formatDateTime(channel.lastAttemptAt)}
                      </p>
                    </article>
                  ))
                ) : (
                  <p>No delivery records yet.</p>
                )}
              </div>
            </article>

            <article className="list-panel">
              <h3>Recent failed deliveries</h3>
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
                            {maskDestination(delivery)} • {delivery.recipientRole} • attempt {delivery.attemptCount}
                          </p>
                        </div>
                        <span className="result-badge">{delivery.status}</span>
                      </div>
                      <p>{delivery.title}</p>
                      <p>{delivery.errorMessage ?? "Delivery failed without an error message."}</p>
                      <p>
                        Last attempt {formatDateTime(delivery.lastAttemptAt ?? delivery.createdAt)}
                        {delivery.nextRetryAt ? ` • next retry ${formatDateTime(delivery.nextRetryAt)}` : " • no retry scheduled"}
                      </p>
                    </article>
                  ))
                ) : (
                  <p>No failed deliveries right now.</p>
                )}
              </div>
            </article>
          </div>
        </div>
      ) : null}
    </section>
  );
}
