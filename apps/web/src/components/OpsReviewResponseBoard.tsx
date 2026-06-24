"use client";

import {
  OpsReviewResponseItem,
  ProviderReviewResponseStatus
} from "@yardmatch/contracts";
import { serviceCategoryLabels } from "@yardmatch/ui";
import { useState } from "react";
import { createAuthenticatedWebApiClient } from "../lib/api";

function formatPriority(priority: "urgent" | "watch" | "routine") {
  return priority === "urgent" ? "Reply today" : priority === "watch" ? "Reply soon" : "Healthy habit";
}

export function OpsReviewResponseBoard({ initialItems }: { initialItems: OpsReviewResponseItem[] }) {
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
        publicReplyBody: draft.publicReplyBody.trim() || undefined
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
                  publicReplyBody: updated.publicReplyBody
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
      <h2>Public review response queue</h2>
      {statusMessage ? <p>{statusMessage}</p> : null}
      {errorMessage ? <p>{errorMessage}</p> : null}
      {items.length === 0 ? (
        <p>No submitted reviews need response triage yet.</p>
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
                  <strong>Recommended action:</strong> {item.recommendedAction}
                </p>
                {item.issueSignals.length > 0 ? <p>Signals: {item.issueSignals.join(" • ")}</p> : null}
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
                    Last handled {new Date(item.responseHandledAt).toLocaleString()}
                    {item.responseHandledBy ? ` • by ${item.responseHandledBy}` : ""}
                  </p>
                ) : null}
                {item.supportTicketId ? (
                  <p>
                    Linked support follow-up: {item.supportTicketSubject ?? "Service-quality follow-up"} •{" "}
                    {item.supportTicketStatus?.replaceAll("-", " ") ?? "open"}
                    {item.escalatedAt ? ` • escalated ${new Date(item.escalatedAt).toLocaleString()}` : ""}
                    {item.escalatedBy ? ` by ${item.escalatedBy}` : ""}
                  </p>
                ) : item.supportFollowUpRecommended ? (
                  <p>
                    Support follow-up recommended before this review fades into a public-reply-only workflow.
                  </p>
                ) : null}
                <div className="form-grid">
                  <label className="form-field">
                    <span>Status</span>
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
                      <option value="pending">Pending</option>
                      <option value="posted">Posted publicly</option>
                      <option value="skipped">Skipped</option>
                    </select>
                  </label>
                  <label className="form-field">
                    <span>Handled by</span>
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
                      <span>Escalated by</span>
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
                      <span>Support follow-up note</span>
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
                <label className="form-field">
                  <span>Ops notes</span>
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
                    Save response state
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
