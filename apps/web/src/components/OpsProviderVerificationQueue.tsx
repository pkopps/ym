"use client";

import {
  ProviderVerificationQueueItem
} from "@yardmatch/contracts";
import { useEffect, useState } from "react";
import { createAuthenticatedWebApiClient } from "../lib/api";

function formatDateTime(iso?: string) {
  if (!iso) {
    return "Not submitted yet";
  }

  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function defaultReviewNotes(item: ProviderVerificationQueueItem, action: "approve" | "reject") {
  if (action === "approve") {
    return item.guidance.recommendedAction === "approve"
      ? "Ops approved the business for public marketplace visibility after checking launch fit and operational readiness."
      : "Ops approved the business after manual verification review confirmed the launch fit was acceptable.";
  }

  return item.guidance.recommendedAction === "reject"
    ? "Please tighten the launch-area fit or profile details noted in the verification checklist before going live."
    : "Please confirm the business details, launch-area fit, and operational settings noted in the checklist before going live.";
}

export function OpsProviderVerificationQueue() {
  const [items, setItems] = useState<ProviderVerificationQueueItem[]>([]);
  const [approvalOverrideNotes, setApprovalOverrideNotes] = useState<Record<string, string>>({});
  const [statusMessage, setStatusMessage] = useState<string | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [isWorking, setIsWorking] = useState(false);

  async function loadQueue() {
    const api = createAuthenticatedWebApiClient();
    setItems(await api.getProviderVerificationQueue());
  }

  useEffect(() => {
    void loadQueue().catch((error) => {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load provider verification.");
    });
  }, []);

  async function reviewProvider(item: ProviderVerificationQueueItem, action: "approve" | "reject") {
    try {
      setIsWorking(true);
      setStatusMessage(undefined);
      setErrorMessage(undefined);
      const api = createAuthenticatedWebApiClient();
      const overrideNote = approvalOverrideNotes[item.provider.id]?.trim();
      await api.reviewProviderVerification({
        providerId: item.provider.id,
        action,
        notes:
          action === "approve" && item.guidance.requiresApprovalOverrideNotes
            ? overrideNote
            : defaultReviewNotes(item, action)
      });
      setStatusMessage(
        action === "approve"
          ? item.guidance.requiresApprovalOverrideNotes
            ? "Provider approved with an explicit launch override note."
            : "Provider approved and moved into the live marketplace."
          : "Provider sent back for profile updates."
      );
      if (action === "approve") {
        setApprovalOverrideNotes((current) => {
          if (!current[item.provider.id]) {
            return current;
          }

          const next = { ...current };
          delete next[item.provider.id];
          return next;
        });
      }
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
          items.map((item) => {
            const { provider, openBookingCount, reviewCount } = item;
            const overrideNote = approvalOverrideNotes[provider.id] ?? "";
            const minimumOverrideLength = item.guidance.minimumApprovalOverrideNoteLength ?? 0;
            const needsApprovalOverride = item.guidance.requiresApprovalOverrideNotes;
            const overrideLooksPresent = overrideNote.trim().length >= minimumOverrideLength;

            return (
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
                <p>
                  Recommended action: {item.guidance.recommendedAction.replaceAll("-", " ")} •{" "}
                  {item.guidance.rationale}
                </p>
                {item.guidance.warnings.length > 0 ? (
                  <div className="stack-sm">
                    <p>Watchouts</p>
                    <ul className="timeline">
                      {item.guidance.warnings.map((warning: string) => (
                        <li key={warning}>
                          <strong>!</strong>
                          <span>{warning}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {needsApprovalOverride ? (
                  <div className="stack-sm">
                    <p>Approval override required</p>
                    <p>{item.guidance.approvalOverridePrompt}</p>
                    <textarea
                      className="input"
                      disabled={isWorking}
                      onChange={(event) =>
                        setApprovalOverrideNotes((current) => ({
                          ...current,
                          [provider.id]: event.target.value
                        }))
                      }
                      placeholder="Explain the specific launch-fit checks, exceptions, and safeguards that make this approval safe."
                      rows={4}
                      value={overrideNote}
                    />
                    <p>
                      Add at least {minimumOverrideLength} characters and avoid generic approval notes so
                      the launch override is auditable.
                    </p>
                  </div>
                ) : null}
                <div className="stack-sm">
                  <p>Verification checklist</p>
                  <ul className="timeline">
                    {item.guidance.checklist.map((check) => (
                      <li key={check.key}>
                        <strong>{check.status}</strong>
                        <span>
                          {check.label} • {check.detail}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                {provider.verificationNotes ? <p>Latest ops note: {provider.verificationNotes}</p> : null}
              </div>
              <div className="cta-row">
                <button
                  className="button-secondary"
                  disabled={isWorking || (needsApprovalOverride && !overrideLooksPresent)}
                  onClick={() => void reviewProvider(item, "approve")}
                  type="button"
                >
                  {needsApprovalOverride ? "Approve with override" : "Approve provider"}
                </button>
                <button
                  className="button-secondary"
                  disabled={isWorking}
                  onClick={() => void reviewProvider(item, "reject")}
                  type="button"
                >
                  Send back for updates
                </button>
              </div>
            </article>
          );
          })
        ) : (
          <p>No providers are waiting on verification right now.</p>
        )}
      </div>
    </section>
  );
}
