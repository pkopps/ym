"use client";

import {
  OpsReviewResponseItem,
  ProviderReviewResponseStatus,
  ReviewResponseChannel
} from "@yardmatch/contracts";
import { serviceCategoryLabels } from "@yardmatch/ui";
import { useState } from "react";
import { createAuthenticatedWebApiClient } from "../lib/api";
import { useI18n } from "@yardmatch/i18n/react";

function formatPriority(priority: "urgent" | "watch" | "routine") {
  return priority === "urgent" ? "Reply today" : priority === "watch" ? "Reply soon" : "Healthy habit";
}

const reviewResponseChannels: ReviewResponseChannel[] = [
  "google-business-profile",
  "shared-inbox",
  "manual-other"
];

function formatResponseChannel(channel?: ReviewResponseChannel) {
  return channel ? channel.replaceAll("-", " ") : "Not set";
}

function formatChannelMetadata(item: OpsReviewResponseItem) {
  const parts = [
    item.responseChannelMetadata?.profileLocationName
      ? `Location ${item.responseChannelMetadata.profileLocationName}`
      : undefined,
    item.responseChannelMetadata?.mailboxName
      ? `Mailbox ${item.responseChannelMetadata.mailboxName}`
      : undefined,
    item.responseChannelMetadata?.emailMessageId
      ? `message ${item.responseChannelMetadata.emailMessageId}`
      : undefined,
    item.responseChannelMetadata?.emailThreadId
      ? `thread ${item.responseChannelMetadata.emailThreadId}`
      : undefined,
    item.responseChannelMetadata?.senderEmail
      ? `sender ${item.responseChannelMetadata.senderEmail}`
      : undefined,
    item.responseChannelMetadata?.threadUrl
      ? item.responseChannelMetadata.threadUrl
      : undefined
  ].filter((part): part is string => Boolean(part));

  return parts.length > 0 ? parts.join(" • ") : undefined;
}

export function OpsReviewResponseBoard({ initialItems }: { initialItems: OpsReviewResponseItem[] }) {
  const i18n = useI18n();
  const [items, setItems] = useState(initialItems);
  const [statusMessage, setStatusMessage] = useState<string | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [isWorking, setIsWorking] = useState(false);
  const [drafts, setDrafts] = useState<
    Record<
      string,
      {
        responseStatus: ProviderReviewResponseStatus;
        responseHandledBy: string;
        responseNotes: string;
        publicReplyBody: string;
        responseChannel: ReviewResponseChannel;
        externalResponseId: string;
        publicResponseUrl: string;
        escalatedBy: string;
        escalationNotes: string;
      }
    >
  >({});

  function getDraft(item: OpsReviewResponseItem) {
    return (
      drafts[item.reviewId] ?? {
        responseStatus: item.responseStatus,
        responseHandledBy: item.responseHandledBy ?? "",
        responseNotes: item.responseNotes ?? "",
        publicReplyBody: item.publicReplyBody ?? item.publicReplyTemplate.body,
        responseChannel: item.responseChannel ?? "google-business-profile",
        externalResponseId: item.externalResponseId ?? "",
        publicResponseUrl: item.publicResponseUrl ?? "",
        escalatedBy: item.escalatedBy ?? "",
        escalationNotes: item.escalationNotes ?? ""
      }
    );
  }

  async function save(item: OpsReviewResponseItem) {
    const draft = getDraft(item);

    try {
      setIsWorking(true);
      setStatusMessage(undefined);
      setErrorMessage(undefined);
      const api = createAuthenticatedWebApiClient();
      const updated = await api.updateReviewResponse({
        reviewId: item.reviewId,
        responseStatus: draft.responseStatus,
        responseHandledBy: draft.responseHandledBy.trim() || undefined,
        responseNotes: draft.responseNotes.trim() || undefined,
        publicReplyBody: draft.publicReplyBody.trim() || undefined,
        responseChannel: draft.responseChannel,
        externalResponseId: draft.externalResponseId.trim() || undefined,
        publicResponseUrl: draft.publicResponseUrl.trim() || undefined
      });

      setItems((current) =>
        [...current]
          .map((candidate) =>
            candidate.reviewId === item.reviewId
              ? {
                  ...candidate,
                  responseStatus: updated.responseStatus,
                  responseHandledAt: updated.responseHandledAt,
                  responseHandledBy: updated.responseHandledBy,
                  responseNotes: updated.responseNotes,
                  publicReplyBody: updated.publicReplyBody,
                  responseChannel: updated.responseChannel,
                  responseChannelMetadata: updated.responseChannelMetadata,
                  externalResponseId: updated.externalResponseId,
                  publicResponseUrl: updated.publicResponseUrl
                }
              : candidate
          )
          .sort((left, right) => {
            if (left.responseStatus !== right.responseStatus) {
              return left.responseStatus === "pending" ? -1 : right.responseStatus === "pending" ? 1 : 0;
            }

            return right.createdAt.localeCompare(left.createdAt);
          })
      );
      setStatusMessage("Review response status saved.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to save the review response state.");
    } finally {
      setIsWorking(false);
    }
  }

  async function escalate(item: OpsReviewResponseItem) {
    const draft = getDraft(item);

    try {
      setIsWorking(true);
      setStatusMessage(undefined);
      setErrorMessage(undefined);
      const api = createAuthenticatedWebApiClient();
      const updated = await api.escalateReviewSupport({
        reviewId: item.reviewId,
        escalatedBy: draft.escalatedBy.trim() || undefined,
        escalationNotes: draft.escalationNotes.trim() || undefined
      });

      setItems((current) =>
        [...current]
          .map((candidate) => (candidate.reviewId === item.reviewId ? updated : candidate))
          .sort((left, right) => {
            if (left.responseStatus !== right.responseStatus) {
              return left.responseStatus === "pending" ? -1 : right.responseStatus === "pending" ? 1 : 0;
            }

            return right.createdAt.localeCompare(left.createdAt);
          })
      );
      setStatusMessage(
        updated.supportTicketStatus === "resolved"
          ? "Review follow-up linked to a resolved support ticket."
          : "Review follow-up moved into the support workflow."
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to escalate the review into support follow-up.");
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <section className="card">
      <h2>{i18n.t("ops_auto.ops_review_response_board.public_review_response_queue_dowgm5")}</h2>
      {statusMessage ? <p>{statusMessage}</p> : null}
      {errorMessage ? <p>{errorMessage}</p> : null}
      {items.length === 0 ? (
        <p>{i18n.t("ops_auto.ops_review_response_board.no_submitted_reviews_need_response_triage_yet_5ezies")}</p>
      ) : (
        <div className="stack-lg" style={{ paddingBottom: 0 }}>
          {items.map((item) => {
            const draft = getDraft(item);
            return (
              <article className="list-panel" key={item.reviewId}>
                <div className="search-result-title">
                  <div>
                    <h3>{item.providerName}</h3>
                    <p>
                      {serviceCategoryLabels[item.category]} • {item.overallRating}/5 •{" "}
                      {new Date(item.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="result-badge">
                    {item.responseStatus === "pending"
                      ? item.isResponseOverdue
                        ? "Overdue"
                        : formatPriority(item.priority)
                      : item.responseStatus.replaceAll("-", " ")}
                  </span>
                </div>
                <p>{item.reviewText}</p>
                {item.responseStatus === "pending" && item.responseDueAt ? (
                  <p>
                    {item.isResponseOverdue ? "Reply overdue since" : "Reply due"}{" "}
                    {new Date(item.responseDueAt).toLocaleString()}
                  </p>
                ) : null}
                <p>
                  <strong>{i18n.t("ops_auto.ops_review_response_board.recommended_action_v1n6xr")}</strong> {item.recommendedAction}
                </p>
                {item.issueSignals.length > 0 ? <p>{i18n.t("ops_auto.ops_review_response_board.signals_682rcf")} {item.issueSignals.join(" • ")}</p> : null}
                {item.watchouts.length > 0 ? (
                  <ul className="timeline">
                    {item.watchouts.map((watchout) => (
                      <li key={`${item.reviewId}-${watchout}`}>
                        <strong>!</strong>
                        <span>{watchout}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {item.responseHandledAt ? (
                  <p>
                    {i18n.t("ops_auto.ops_review_response_board.last_handled_gez6zy")} {new Date(item.responseHandledAt).toLocaleString()}
                    {item.responseHandledBy ? ` • by ${item.responseHandledBy}` : ""}
                  </p>
                ) : null}
                {item.responseStatus === "posted" ? (
                  <>
                    <p>
                      {i18n.t("ops_auto.ops_review_response_board.posted_via_31p9o3")} {formatResponseChannel(item.responseChannel)}
                      {item.externalResponseId ? ` • ref ${item.externalResponseId}` : ""}
                      {item.publicResponseUrl ? ` • ${item.publicResponseUrl}` : ""}
                    </p>
                    {formatChannelMetadata(item) ? <p>{formatChannelMetadata(item)}</p> : null}
                    {item.responseChannelMetadata?.intakeNotes?.length ? (
                      <ul className="timeline">
                        {item.responseChannelMetadata.intakeNotes.map((note) => (
                          <li key={`${item.reviewId}-${note}`}>
                            <strong>i</strong>
                            <span>{note}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </>
                ) : null}
                {item.supportTicketId ? (
                  <p>
                    {i18n.t("ops_auto.ops_review_response_board.linked_support_follow_up_de4ov9")} {item.supportTicketSubject ?? "Service-quality follow-up"} •{" "}
                    {item.supportTicketStatus?.replaceAll("-", " ") ?? "open"}
                    {item.escalatedAt ? ` • escalated ${new Date(item.escalatedAt).toLocaleString()}` : ""}
                    {item.escalatedBy ? ` by ${item.escalatedBy}` : ""}
                  </p>
                ) : item.supportFollowUpRecommended ? (
                  <p>
                    {i18n.t("ops_auto.ops_review_response_board.support_follow_up_recommended_before_this_review_fades_pz01f8")} </p>
                ) : null}
                <div className="form-grid">
                  <label className="form-field">
                    <span>{i18n.t("ops_auto.ops_review_response_board.status_twsvse")}</span>
                    <select
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [item.reviewId]: {
                            ...draft,
                            responseStatus: event.target.value as ProviderReviewResponseStatus
                          }
                        }))
                      }
                      value={draft.responseStatus}
                    >
                      <option value="pending">{i18n.t("ops_auto.ops_review_response_board.pending_g8p2lz")}</option>
                      <option value="posted">{i18n.t("ops_auto.ops_review_response_board.posted_publicly_p2cgix")}</option>
                      <option value="skipped">{i18n.t("ops_auto.ops_review_response_board.skipped_7zhkhc")}</option>
                    </select>
                  </label>
                  <label className="form-field">
                    <span>{i18n.t("ops_auto.ops_review_response_board.handled_by_56pelh")}</span>
                    <input
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [item.reviewId]: {
                            ...draft,
                            responseHandledBy: event.target.value
                          }
                        }))
                      }
                      value={draft.responseHandledBy}
                    />
                  </label>
                </div>
                {item.supportFollowUpRecommended || item.supportTicketId ? (
                  <div className="form-grid">
                    <label className="form-field">
                      <span>{i18n.t("ops_auto.ops_review_response_board.escalated_by_jdv2ed")}</span>
                      <input
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [item.reviewId]: {
                              ...draft,
                              escalatedBy: event.target.value
                            }
                          }))
                        }
                        value={draft.escalatedBy}
                      />
                    </label>
                    <label className="form-field">
                      <span>{i18n.t("ops_auto.ops_review_response_board.support_follow_up_note_exkzsk")}</span>
                      <textarea
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [item.reviewId]: {
                              ...draft,
                              escalationNotes: event.target.value
                            }
                          }))
                        }
                        rows={3}
                        value={draft.escalationNotes}
                      />
                    </label>
                  </div>
                ) : null}
                <label className="form-field">
                  <span>{item.publicReplyTemplate.title}</span>
                  <textarea
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [item.reviewId]: {
                          ...draft,
                          publicReplyBody: event.target.value
                        }
                      }))
                    }
                    rows={5}
                    value={draft.publicReplyBody}
                  />
                </label>
                {draft.responseStatus === "posted" ? (
                  <div className="form-grid">
                    <label className="form-field">
                      <span>{i18n.t("ops_auto.ops_review_response_board.posted_via_31p9o3")}</span>
                      <select
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [item.reviewId]: {
                              ...draft,
                              responseChannel: event.target.value as ReviewResponseChannel
                            }
                          }))
                        }
                        value={draft.responseChannel}
                      >
                        {reviewResponseChannels.map((channel) => (
                          <option key={channel} value={channel}>
                            {formatResponseChannel(channel)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="form-field">
                      <span>{i18n.t("ops_auto.ops_review_response_board.external_response_id_rlp5et")}</span>
                      <input
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [item.reviewId]: {
                              ...draft,
                              externalResponseId: event.target.value
                            }
                          }))
                        }
                        value={draft.externalResponseId}
                      />
                    </label>
                    <label className="form-field">
                      <span>{i18n.t("ops_auto.ops_review_response_board.public_reply_link_ich5d3")}</span>
                      <input
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [item.reviewId]: {
                              ...draft,
                              publicResponseUrl: event.target.value
                            }
                          }))
                        }
                        value={draft.publicResponseUrl}
                      />
                    </label>
                  </div>
                ) : null}
                <label className="form-field">
                  <span>{i18n.t("ops_auto.ops_review_response_board.ops_notes_eemmyb")}</span>
                  <textarea
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [item.reviewId]: {
                          ...draft,
                          responseNotes: event.target.value
                        }
                      }))
                    }
                    rows={3}
                    value={draft.responseNotes}
                  />
                </label>
                <p>{item.publicReplyTemplate.reason}</p>
                <div className="cta-row">
                  {item.supportFollowUpRecommended || item.supportTicketId ? (
                    <button
                      className="button secondary"
                      disabled={isWorking}
                      onClick={() => void escalate(item)}
                      type="button"
                    >
                      {item.supportTicketId ? "Refresh support follow-up" : "Escalate to support"}
                    </button>
                  ) : null}
                  <button className="button secondary" disabled={isWorking} onClick={() => void save(item)} type="button">
                    {i18n.t("ops_auto.ops_review_response_board.save_response_state_hw6a51")} </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
