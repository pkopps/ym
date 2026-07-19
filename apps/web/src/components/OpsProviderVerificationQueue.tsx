"use client";

import {
  ProviderVerificationQueueItem
} from "@yardmatch/contracts";
import { useEffect, useState } from "react";
import { createAuthenticatedWebApiClient } from "../lib/api";
import { useI18n } from "@yardmatch/i18n/react";

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
  const i18n = useI18n();
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
      <span className="eyebrow">{i18n.t("ops_auto.ops_provider_verification_queue.provider_verification_uu1gl2")}</span>
      <h2>{i18n.t("ops_auto.ops_provider_verification_queue.review_new_landscaping_businesses_before_they_go_live_zbgs5f")}</h2>
      <p>
        {i18n.t("ops_auto.ops_provider_verification_queue.approve_providers_when_their_business_profile_is_ready_22r3z9")} </p>
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
                  {i18n.t("ops_auto.ops_provider_verification_queue.submitted_1d29fl")} {formatDateTime(provider.verificationSubmittedAt)} • {provider.yearsExperience}{" "}
                  {i18n.t("ops_auto.ops_provider_verification_queue.years_experience_6bwjyk")} </p>
                <p>
                  {i18n.t("ops_auto.ops_provider_verification_queue.radius_rh7eig")} {provider.serviceRadiusMiles} {i18n.t("ops_auto.ops_provider_verification_queue.miles_hkmuf4")} {reviewCount} {i18n.t("ops_auto.ops_provider_verification_queue.customer_review_neoel6")} {reviewCount === 1 ? "" : "s"} • {openBookingCount} {i18n.t("ops_auto.ops_provider_verification_queue.open_booking_uy3ji5")} {openBookingCount === 1 ? "" : "s"}
                </p>
                <p>{i18n.t("ops_auto.ops_provider_verification_queue.services_txhy0s")} {provider.categories.map((category) => category.replaceAll("-", " ")).join(", ")}</p>
                <p>
                  {i18n.t("ops_auto.ops_provider_verification_queue.recommended_action_v1n6xr")} {item.guidance.recommendedAction.replaceAll("-", " ")} •{" "}
                  {item.guidance.rationale}
                </p>
                {item.guidance.warnings.length > 0 ? (
                  <div className="stack-sm">
                    <p>{i18n.t("ops_auto.ops_provider_verification_queue.watchouts_sii2ok")}</p>
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
                    <p>{i18n.t("ops_auto.ops_provider_verification_queue.approval_override_required_bm6xh2")}</p>
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
                      placeholder={i18n.t("ops_auto.ops_provider_verification_queue.explain_the_specific_launch_fit_checks_exceptions_and_q1v7b9")}
                      rows={4}
                      value={overrideNote}
                    />
                    <p>
                      {i18n.t("ops_auto.ops_provider_verification_queue.add_at_least_pic0ed")} {minimumOverrideLength} {i18n.t("ops_auto.ops_provider_verification_queue.characters_and_avoid_generic_approval_notes_so_the_uk0f1a")} </p>
                  </div>
                ) : null}
                <div className="stack-sm">
                  <p>{i18n.t("ops_auto.ops_provider_verification_queue.verification_checklist_x1gxdt")}</p>
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
                {provider.verificationNotes ? <p>{i18n.t("ops_auto.ops_provider_verification_queue.latest_ops_note_oht28v")} {provider.verificationNotes}</p> : null}
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
                  {i18n.t("ops_auto.ops_provider_verification_queue.send_back_for_updates_lz4ysy")} </button>
              </div>
            </article>
          );
          })
        ) : (
          <p>{i18n.t("ops_auto.ops_provider_verification_queue.no_providers_are_waiting_on_verification_right_now_nrb6e4")}</p>
        )}
      </div>
    </section>
  );
}
