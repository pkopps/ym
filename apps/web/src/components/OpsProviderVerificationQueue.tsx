"use client";

import {
  MarketplaceApiClient,
  ProviderVerificationQueueItem
} from "@yardmatch/contracts";
import { useEffect, useState } from "react";
import { getWebApiBaseUrl } from "../lib/api";

function formatDateTime(iso?: string) {
  if (!iso) {
    return "Not submitted yet";
  }

  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

export function OpsProviderVerificationQueue() {
  const [items, setItems] = useState<ProviderVerificationQueueItem[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [isWorking, setIsWorking] = useState(false);

  async function loadQueue() {
    const api = new MarketplaceApiClient(getWebApiBaseUrl());
    setItems(await api.getProviderVerificationQueue());
  }

  useEffect(() => {
    void loadQueue().catch((error) => {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load provider verification.");
    });
  }, []);

  async function reviewProvider(providerId: string, action: "approve" | "reject") {
    try {
      setIsWorking(true);
      setStatusMessage(undefined);
      setErrorMessage(undefined);
      const api = new MarketplaceApiClient(getWebApiBaseUrl());
      await api.reviewProviderVerification({
        providerId,
        action,
        notes:
          action === "approve"
            ? "Ops approved the business for public marketplace visibility."
            : "Please confirm the business details and service area before going live."
      });
      setStatusMessage(
        action === "approve"
          ? "Provider approved and moved into the live marketplace."
          : "Provider sent back for profile updates."
      );
      await loadQueue();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to review that provider.");
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <section className="card">
      <span className="eyebrow">Provider verification</span>
      <h2>Review new landscaping businesses before they go live.</h2>
      <p>
        Approve providers when their business profile is ready for customer search, or send them
        back with notes if something still needs attention.
      </p>
      {statusMessage ? <p>{statusMessage}</p> : null}
      {errorMessage ? <p>{errorMessage}</p> : null}
      <div className="stack-lg" style={{ paddingBottom: 0 }}>
        {items.length > 0 ? (
          items.map(({ provider, openBookingCount, reviewCount }) => (
            <article className="list-panel" key={provider.id}>
              <div className="search-result-title">
                <div>
                  <h3>{provider.companyName}</h3>
                  <p>
                    {provider.fullName} • {provider.address.city}, {provider.address.state}
                  </p>
                </div>
                <span className="result-badge">{provider.verificationStatus.replaceAll("-", " ")}</span>
              </div>
              <p>{provider.bio}</p>
              <div className="stack-md">
                <p>
                  Submitted: {formatDateTime(provider.verificationSubmittedAt)} • {provider.yearsExperience}{" "}
                  years experience
                </p>
                <p>
                  Radius: {provider.serviceRadiusMiles} miles • {reviewCount} customer review
                  {reviewCount === 1 ? "" : "s"} • {openBookingCount} open booking
                  {openBookingCount === 1 ? "" : "s"}
                </p>
                <p>Services: {provider.categories.map((category) => category.replaceAll("-", " ")).join(", ")}</p>
                {provider.verificationNotes ? <p>Latest ops note: {provider.verificationNotes}</p> : null}
              </div>
              <div className="cta-row">
                <button
                  className="button-secondary"
                  disabled={isWorking}
                  onClick={() => void reviewProvider(provider.id, "approve")}
                  type="button"
                >
                  Approve provider
                </button>
                <button
                  className="button-secondary"
                  disabled={isWorking}
                  onClick={() => void reviewProvider(provider.id, "reject")}
                  type="button"
                >
                  Send back for updates
                </button>
              </div>
            </article>
          ))
        ) : (
          <p>No providers are waiting on verification right now.</p>
        )}
      </div>
    </section>
  );
}
