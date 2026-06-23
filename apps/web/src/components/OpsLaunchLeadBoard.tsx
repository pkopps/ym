"use client";

import {
  CreateLaunchLeadRequest,
  LaunchLeadContactPreference,
  LaunchLeadLossReason,
  LaunchLeadSourceChannel,
  LaunchLeadStatus,
  MarketplaceApiClient,
  OpsLaunchLead,
  ServiceCategory
} from "@yardmatch/contracts";
import { serviceCategoryLabels } from "@yardmatch/ui";
import { useEffect, useState } from "react";
import { getWebApiBaseUrl } from "../lib/api";

const statusOptions: LaunchLeadStatus[] = ["new", "contacted", "qualified", "converted", "closed-lost"];
const sourceChannelOptions: LaunchLeadSourceChannel[] = [
  "website",
  "email",
  "phone",
  "social",
  "referral",
  "mail",
  "seo",
  "google-business-profile"
];
const baseContactMethodOptions: LaunchLeadContactPreference[] = ["email", "phone", "text"];
const lossReasonOptions: LaunchLeadLossReason[] = [
  "out-of-area",
  "no-response",
  "price-mismatch",
  "timeline-mismatch",
  "not-ready",
  "duplicate",
  "other"
];
const serviceOptions: ServiceCategory[] = [
  "lawn-mowing",
  "seasonal-cleanup",
  "hedge-trimming",
  "mulch-installation",
  "weed-control",
  "gutter-cleaning"
];
const templateAudienceLabels = {
  customer: "Customer drafts",
  provider: "Provider outreach",
  partner: "Partner follow-up"
} as const;

function formatDateTime(iso?: string) {
  if (!iso) {
    return "Not set";
  }

  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function formatDateTimeLocalInput(iso?: string) {
  if (!iso) {
    return "";
  }

  const value = new Date(iso);
  const offsetMinutes = value.getTimezoneOffset();
  const local = new Date(value.getTime() - offsetMinutes * 60_000);
  return local.toISOString().slice(0, 16);
}

function getContactMethodOptions(sourceChannel: LaunchLeadSourceChannel): LaunchLeadContactPreference[] {
  if (sourceChannel === "google-business-profile" || sourceChannel === "social") {
    return [...baseContactMethodOptions, "platform-message"];
  }

  return baseContactMethodOptions;
}

export function OpsLaunchLeadBoard() {
  const [leads, setLeads] = useState<OpsLaunchLead[]>([]);
  const [newLeadDraft, setNewLeadDraft] = useState<{
    sourceChannel: LaunchLeadSourceChannel;
    requestSource: string;
    contactName: string;
    email: string;
    phone: string;
    preferredContactMethod: LaunchLeadContactPreference;
    areaLabel: string;
    serviceCategory: ServiceCategory | "";
    message: string;
    assignedOwner: string;
  }>({
    sourceChannel: "email",
    requestSource: "customer-service-help-request",
    contactName: "",
    email: "",
    phone: "",
    preferredContactMethod: "email",
    areaLabel: "Barnegat, NJ",
    serviceCategory: "",
    message: "",
    assignedOwner: ""
  });
  const [drafts, setDrafts] = useState<
    Record<
      string,
      {
        assignedOwner: string;
        status: LaunchLeadStatus;
        nextFollowUpLocal: string;
        outcomeSummary: string;
        lossReason: LaunchLeadLossReason | "";
        linkBookingId: string;
      }
    >
  >({});
  const [isWorking, setIsWorking] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  async function loadBoard() {
    const api = new MarketplaceApiClient(getWebApiBaseUrl());
    setLeads(await api.getOpsLaunchLeads());
  }

  useEffect(() => {
    void loadBoard().catch((error) => {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load launch leads.");
    });
  }, []);

  function getDraft(item: OpsLaunchLead) {
    return (
      drafts[item.lead.id] ?? {
        assignedOwner: item.lead.assignedOwner ?? "",
        status: item.lead.status,
        nextFollowUpLocal: formatDateTimeLocalInput(item.lead.nextFollowUpDueAt),
        outcomeSummary: item.lead.outcomeSummary ?? "",
        lossReason: item.lead.lossReason ?? "",
        linkBookingId: ""
      }
    );
  }

  async function createLead() {
    try {
      setIsWorking(true);
      setStatusMessage(undefined);
      setErrorMessage(undefined);
      const api = new MarketplaceApiClient(getWebApiBaseUrl());
      await api.createLaunchLead({
        sourceChannel: newLeadDraft.sourceChannel,
        requestSource: newLeadDraft.requestSource.trim() || undefined,
        contactName: newLeadDraft.contactName,
        email: newLeadDraft.email.trim() || undefined,
        phone: newLeadDraft.phone.trim() || undefined,
        preferredContactMethod: newLeadDraft.preferredContactMethod,
        areaLabel: newLeadDraft.areaLabel,
        serviceCategory: newLeadDraft.serviceCategory || undefined,
        message: newLeadDraft.message,
        assignedOwner: newLeadDraft.assignedOwner.trim() || undefined
      } satisfies CreateLaunchLeadRequest);
      setStatusMessage("Launch lead created.");
      setNewLeadDraft({
        sourceChannel: "email",
        requestSource: "customer-service-help-request",
        contactName: "",
        email: "",
        phone: "",
        preferredContactMethod: "email",
        areaLabel: "Barnegat, NJ",
        serviceCategory: "",
        message: "",
        assignedOwner: ""
      });
      await loadBoard();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to create that launch lead.");
    } finally {
      setIsWorking(false);
    }
  }

  async function saveLead(item: OpsLaunchLead) {
    const draft = getDraft(item);

    try {
      setIsWorking(true);
      setStatusMessage(undefined);
      setErrorMessage(undefined);
      const api = new MarketplaceApiClient(getWebApiBaseUrl());
      await api.updateOpsLaunchLead({
        leadId: item.lead.id,
        status: draft.status,
        assignedOwner: draft.assignedOwner.trim() || undefined,
        nextFollowUpDueAt: draft.nextFollowUpLocal
          ? new Date(draft.nextFollowUpLocal).toISOString()
          : undefined,
        outcomeSummary: draft.outcomeSummary.trim() || undefined,
        lossReason: draft.lossReason || undefined,
        linkBookingId: draft.linkBookingId.trim() || undefined
      });
      setStatusMessage("Launch lead updated.");
      await loadBoard();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update that launch lead.");
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <section className="stack-lg">
      <div className="section-header">
        <h2>Launch lead queue</h2>
        <p>Website, email, phone, referral, GBP, and customer-service follow-up requests with owners, due times, and a closed-loop outcome.</p>
      </div>
      {statusMessage ? <p>{statusMessage}</p> : null}
      {errorMessage ? <p>{errorMessage}</p> : null}
      <article className="card">
        <h3>Create a manual lead</h3>
        <p>Use this for contact-us emails, phone calls, texts, referrals, Google Business Profile messages, and customer-service issue help requests that still need pre-booking follow-up.</p>
        <div className="form-grid">
          <label className="form-field">
            <span>Source</span>
            <select
              onChange={(event) =>
                setNewLeadDraft((current) => {
                  const sourceChannel = event.target.value as LaunchLeadSourceChannel;
                  const nextOptions = getContactMethodOptions(sourceChannel);
                  return {
                    ...current,
                    sourceChannel,
                    preferredContactMethod: nextOptions.includes(current.preferredContactMethod)
                      ? current.preferredContactMethod
                      : nextOptions[0]
                  };
                })
              }
              value={newLeadDraft.sourceChannel}
            >
              {sourceChannelOptions.map((option) => (
                <option key={option} value={option}>
                  {option.replaceAll("-", " ")}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Request source label</span>
            <input
              onChange={(event) =>
                setNewLeadDraft((current) => ({
                  ...current,
                  requestSource: event.target.value
                }))
              }
              value={newLeadDraft.requestSource}
            />
          </label>
          <label className="form-field">
            <span>Name</span>
            <input
              onChange={(event) =>
                setNewLeadDraft((current) => ({
                  ...current,
                  contactName: event.target.value
                }))
              }
              value={newLeadDraft.contactName}
            />
          </label>
          <label className="form-field">
            <span>Email</span>
            <input
              onChange={(event) =>
                setNewLeadDraft((current) => ({
                  ...current,
                  email: event.target.value
                }))
              }
              type="email"
              value={newLeadDraft.email}
            />
          </label>
          <label className="form-field">
            <span>Phone</span>
            <input
              onChange={(event) =>
                setNewLeadDraft((current) => ({
                  ...current,
                  phone: event.target.value
                }))
              }
              type="tel"
              value={newLeadDraft.phone}
            />
          </label>
          <label className="form-field">
            <span>Preferred follow-up</span>
            <select
              onChange={(event) =>
                setNewLeadDraft((current) => ({
                  ...current,
                  preferredContactMethod: event.target.value as LaunchLeadContactPreference
                }))
              }
              value={newLeadDraft.preferredContactMethod}
            >
              {getContactMethodOptions(newLeadDraft.sourceChannel).map((option) => (
                <option key={option} value={option}>
                  {option.replaceAll("-", " ")}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Owner</span>
            <input
              onChange={(event) =>
                setNewLeadDraft((current) => ({
                  ...current,
                  assignedOwner: event.target.value
                }))
              }
              value={newLeadDraft.assignedOwner}
            />
          </label>
          <label className="form-field">
            <span>Town or area</span>
            <input
              onChange={(event) =>
                setNewLeadDraft((current) => ({
                  ...current,
                  areaLabel: event.target.value
                }))
              }
              value={newLeadDraft.areaLabel}
            />
          </label>
          <label className="form-field">
            <span>Service</span>
            <select
              onChange={(event) =>
                setNewLeadDraft((current) => ({
                  ...current,
                  serviceCategory: event.target.value as ServiceCategory | ""
                }))
              }
              value={newLeadDraft.serviceCategory}
            >
              <option value="">Not sure yet</option>
              {serviceOptions.map((option) => (
                <option key={option} value={option}>
                  {serviceCategoryLabels[option]}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field form-field--full">
            <span>Lead summary</span>
            <textarea
              onChange={(event) =>
                setNewLeadDraft((current) => ({
                  ...current,
                  message: event.target.value
                }))
              }
              rows={4}
              value={newLeadDraft.message}
            />
          </label>
        </div>
        <div className="cta-row" style={{ marginTop: "1rem" }}>
          <button className="button" disabled={isWorking} onClick={() => void createLead()} type="button">
            {isWorking ? "Saving..." : "Create lead"}
          </button>
        </div>
      </article>
      <div className="stack-lg" style={{ paddingBottom: 0 }}>
        {leads.length === 0 ? (
          <article className="card">
            <p>No launch leads yet.</p>
          </article>
        ) : (
          leads.map((item) => {
            const draft = getDraft(item);
            const isClosed = draft.status === "converted" || draft.status === "closed-lost";
            const linkedBookingCount = item.lead.convertedBookingIds.length;
            const repeatBookingCount = Math.max(0, linkedBookingCount - 1);
            const linkedReviewCount = item.lead.reviewIds.length;

            return (
              <article className="card" key={item.lead.id}>
                <div className="cta-row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <span className="eyebrow">{item.lead.status.replaceAll("-", " ")}</span>
                    <h3>{item.lead.contactName}</h3>
                    <p>
                      {item.lead.email ?? (item.lead.phone ? "No email" : "No direct email or phone")}
                      {item.lead.phone ? ` • ${item.lead.phone}` : ""}
                      {` • prefers ${item.lead.preferredContactMethod}`}
                    </p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p>Created {formatDateTime(item.lead.createdAt)}</p>
                    <p>{item.hoursSinceCreated} hours old</p>
                    <p>
                      {item.isFirstResponseOverdue
                        ? "First response overdue"
                        : item.isFollowUpOverdue
                          ? "Follow-up overdue"
                          : `Next action ${formatDateTime(item.nextActionDueAt)}`}
                    </p>
                  </div>
                </div>

                <p>
                  {item.lead.areaLabel}
                  {item.lead.serviceCategory ? ` • ${serviceCategoryLabels[item.lead.serviceCategory]}` : ""}
                  {item.lead.requestSource ? ` • ${item.lead.requestSource}` : ""}
                </p>
                <p>{item.lead.message}</p>
                <p>
                  Source: {item.lead.sourceChannel}
                  {item.lead.attribution?.source ? ` • ${item.lead.attribution.source}` : ""}
                  {item.lead.attribution?.medium ? ` / ${item.lead.attribution.medium}` : ""}
                  {item.lead.attribution?.campaign ? ` • ${item.lead.attribution.campaign}` : ""}
                  {item.lead.sourceReferenceId ? ` • ref ${item.lead.sourceReferenceId}` : ""}
                </p>
                {item.lead.channelMetadata?.threadUrl || item.lead.channelMetadata?.profileLocationName ? (
                  <p>
                    {item.lead.channelMetadata?.profileLocationName
                      ? `GBP location: ${item.lead.channelMetadata.profileLocationName}`
                      : "Google Business Profile thread"}
                    {item.lead.channelMetadata?.threadUrl ? ` • ${item.lead.channelMetadata.threadUrl}` : ""}
                  </p>
                ) : null}
                {item.lead.channelMetadata?.referrerName ? (
                  <p>
                    Referral from {item.lead.channelMetadata.referrerName}
                    {item.lead.channelMetadata.referrerEmail
                      ? ` • ${item.lead.channelMetadata.referrerEmail}`
                      : ""}
                    {item.lead.channelMetadata.referrerPhone
                      ? ` • ${item.lead.channelMetadata.referrerPhone}`
                      : ""}
                    {item.lead.channelMetadata.referralFollowUpTarget
                      ? ` • follow up via ${item.lead.channelMetadata.referralFollowUpTarget.replaceAll("-", " ")}`
                      : ""}
                  </p>
                ) : null}
                <p>
                  Linked bookings: {linkedBookingCount}
                  {repeatBookingCount ? ` • repeat bookings: ${repeatBookingCount}` : ""}
                  {linkedReviewCount ? ` • reviews: ${linkedReviewCount}` : ""}
                  {item.lead.lastConvertedBookingAt
                    ? ` • last booked ${formatDateTime(item.lead.lastConvertedBookingAt)}`
                    : ""}
                  {item.lead.lastReviewSubmittedAt
                    ? ` • last review ${formatDateTime(item.lead.lastReviewSubmittedAt)}`
                    : ""}
                </p>
                <div className="stack-sm">
                  <p>
                    <strong>Recommended next step:</strong> {item.responseGuidance.recommendedAction}
                  </p>
                  {item.responseGuidance.warnings.length > 0 ? (
                    <div className="stack-sm">
                      <p>Watchouts</p>
                      <ul className="timeline">
                        {item.responseGuidance.warnings.map((warning) => (
                          <li key={warning}>
                            <strong>!</strong>
                            <span>{warning}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {item.responseGuidance.templates.length > 0 ? (
                    <div className="stack-sm">
                      <p>Suggested drafts</p>
                      <div className="stack-sm">
                        {(["customer", "provider", "partner"] as const).map((audience) => {
                          const audienceTemplates = item.responseGuidance.templates.filter(
                            (template) => template.audience === audience
                          );
                          if (audienceTemplates.length === 0) {
                            return null;
                          }

                          return (
                            <div className="stack-sm" key={`${item.lead.id}-${audience}`}>
                              <p>{templateAudienceLabels[audience]}</p>
                              <div className="stack-sm">
                                {audienceTemplates.map((template) => (
                                  <article className="card" key={`${item.lead.id}-${template.key}`}>
                                    <div className="cta-row" style={{ justifyContent: "space-between", gap: "1rem" }}>
                                      <div>
                                        <strong>{template.title}</strong>
                                        <p>
                                          {template.channel} • {template.reason}
                                        </p>
                                      </div>
                                      <span className="eyebrow">{template.key.replaceAll("-", " ")}</span>
                                    </div>
                                    {template.subject ? (
                                      <label className="form-field">
                                        <span>Subject</span>
                                        <input readOnly value={template.subject} />
                                      </label>
                                    ) : null}
                                    <label className="form-field">
                                      <span>Copy-ready draft</span>
                                      <textarea
                                        readOnly
                                        rows={Math.min(10, Math.max(4, template.body.split("\n").length + 1))}
                                        value={template.body}
                                      />
                                    </label>
                                  </article>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
                {item.suggestedBookingMatches.length > 0 ? (
                  <div className="stack-sm">
                    <p>Possible booking matches</p>
                    <div className="cta-row" style={{ flexWrap: "wrap" }}>
                      {item.suggestedBookingMatches.map((match) => (
                        <button
                          className="button button-secondary"
                          key={match.bookingId}
                          onClick={() =>
                            setDrafts((current) => ({
                              ...current,
                              [item.lead.id]: {
                                ...draft,
                                status: "converted",
                                linkBookingId: match.bookingId,
                                outcomeSummary:
                                  draft.outcomeSummary ||
                                  `Matched ${serviceCategoryLabels[match.category]} booking ${match.bookingId} from the ${match.matchReason.replaceAll("-", " ")} contact path.`
                              }
                            }))
                          }
                          type="button"
                        >
                          {serviceCategoryLabels[match.category]} • {new Date(match.scheduledStartIso).toLocaleDateString()} • {match.matchReason.replaceAll("-", " ")}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="form-grid">
                  <label className="form-field">
                    <span>Owner</span>
                    <input
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [item.lead.id]: {
                            ...draft,
                            assignedOwner: event.target.value
                          }
                        }))
                      }
                      value={draft.assignedOwner}
                    />
                  </label>
                  <label className="form-field">
                    <span>Status</span>
                    <select
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [item.lead.id]: {
                            ...draft,
                            status: event.target.value as LaunchLeadStatus
                          }
                        }))
                      }
                      value={draft.status}
                    >
                      {statusOptions.map((option) => (
                        <option key={option} value={option}>
                          {option.replaceAll("-", " ")}
                        </option>
                      ))}
                    </select>
                  </label>
                  {!isClosed ? (
                    <label className="form-field">
                      <span>Next follow-up</span>
                      <input
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [item.lead.id]: {
                              ...draft,
                              nextFollowUpLocal: event.target.value
                            }
                          }))
                        }
                        type="datetime-local"
                        value={draft.nextFollowUpLocal}
                      />
                    </label>
                  ) : null}
                  <label className="form-field">
                    <span>Link booking ID</span>
                    <input
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [item.lead.id]: {
                            ...draft,
                            linkBookingId: event.target.value,
                            status: event.target.value.trim() ? "converted" : draft.status
                          }
                        }))
                      }
                      placeholder="booking_123"
                      value={draft.linkBookingId}
                    />
                  </label>
                  {draft.status === "closed-lost" ? (
                    <label className="form-field">
                      <span>Loss reason</span>
                      <select
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [item.lead.id]: {
                              ...draft,
                              lossReason: event.target.value as LaunchLeadLossReason | ""
                            }
                          }))
                        }
                        value={draft.lossReason}
                      >
                        <option value="">Choose a reason</option>
                        {lossReasonOptions.map((option) => (
                          <option key={option} value={option}>
                            {option.replaceAll("-", " ")}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  <label className="form-field form-field--full">
                    <span>Outcome or follow-up note</span>
                    <textarea
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [item.lead.id]: {
                            ...draft,
                            outcomeSummary: event.target.value
                          }
                        }))
                      }
                      rows={3}
                      value={draft.outcomeSummary}
                    />
                  </label>
                </div>

                <div className="cta-row" style={{ marginTop: "1rem" }}>
                  <button className="button" disabled={isWorking} onClick={() => void saveLead(item)} type="button">
                    {isWorking ? "Saving..." : "Save lead"}
                  </button>
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
