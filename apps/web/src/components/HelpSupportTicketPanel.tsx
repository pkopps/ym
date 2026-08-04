"use client";

import {
  Booking,
  CreateSupportTicketRequest,
  SupportIssueType,
  SupportTicket
} from "@yardmatch/contracts";
import { addLocalePrefix, type I18nInstance, type TranslationKey } from "@yardmatch/i18n";
import { useI18n } from "@yardmatch/i18n/react";
import { useEffect, useState } from "react";
import { createAuthenticatedWebApiClient } from "../lib/api";
import { useStoredWebSession } from "../lib/session";

const issueOptions: SupportIssueType[] = ["billing", "service-quality", "account", "general"];
const issueLabelKeys: Record<SupportIssueType, TranslationKey> = {
  account: "support.issue.account",
  billing: "support.issue.billing",
  general: "support.issue.general",
  "service-quality": "support.issue.service_quality"
};

type BookingOption = {
  id: string;
  label: string;
};

function formatDate(i18n: I18nInstance, iso: string) {
  return i18n.formatDate(iso, {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

export function HelpSupportTicketPanel() {
  const i18n = useI18n();
  const { session, sessionReady } = useStoredWebSession();
  const [isLoadingSupport, setIsLoadingSupport] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [supportLoadError, setSupportLoadError] = useState<string | undefined>();
  const [submitError, setSubmitError] = useState<string | undefined>();
  const [statusMessage, setStatusMessage] = useState<string | undefined>();
  const [showComposer, setShowComposer] = useState(false);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [bookingOptions, setBookingOptions] = useState<BookingOption[]>([]);
  const [issueType, setIssueType] = useState<SupportIssueType>("general");
  const [selectedBookingId, setSelectedBookingId] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [showRecentTickets, setShowRecentTickets] = useState(false);
  const bookingLabelById = bookingOptions.reduce<Record<string, string>>((accumulator, option) => {
    accumulator[option.id] = option.label;
    return accumulator;
  }, {});

  async function loadSupportView() {
    if (!session) {
      return;
    }

    try {
      setIsLoadingSupport(true);
      setSupportLoadError(undefined);
      const api = createAuthenticatedWebApiClient();
      const [nextTickets, options] = await Promise.all([
        api.getSupportTickets(),
        (async () => {
          if (session.role === "crew-member") {
            const matches = await api.getCrewMatches();
            return matches.matches.map((match) => ({
              id: match.bookingId,
              label: `${match.providerCompanyName} • ${match.category.replaceAll("-", " ")}`
            }));
          }

          const bookings = await api.getBookings();
          return bookings.map((booking: Booking) => ({
            id: booking.id,
            label: `${booking.category.replaceAll("-", " ")} • ${formatDate(i18n, booking.scheduledStartIso)}`
          }));
        })()
      ]);

      setTickets(nextTickets);
      setBookingOptions(options);
    } catch (error) {
      setSupportLoadError(error instanceof Error ? error.message : i18n.t("support.error.load"));
    } finally {
      setIsLoadingSupport(false);
    }
  }

  useEffect(() => {
    if (typeof window !== "undefined") {
      const query = new URLSearchParams(window.location.search);
      const bookingId = query.get("bookingId");
      const issueTypeParam = query.get("issueType");
      const subjectParam = query.get("subject");
      if (bookingId) {
        setSelectedBookingId(bookingId);
        setShowComposer(true);
      }
      if (
        issueTypeParam &&
        issueOptions.includes(issueTypeParam as SupportIssueType)
      ) {
        setIssueType(issueTypeParam as SupportIssueType);
        setShowComposer(true);
      }
      if (subjectParam) {
        setSubject(subjectParam);
        setShowComposer(true);
      }
    }
    if (!sessionReady) {
      return;
    }

    void loadSupportView();
  }, [sessionReady, session?.token, session?.role]);

  async function handleSubmit() {
    if (!session || subject.trim().length === 0 || description.trim().length === 0) {
      return;
    }

    try {
      setIsWorking(true);
      setSubmitError(undefined);
      const api = createAuthenticatedWebApiClient();
      await api.createSupportTicket({
        bookingId: selectedBookingId || undefined,
        issueType,
        subject: subject.trim(),
        description: description.trim()
      } satisfies CreateSupportTicketRequest);
      setStatusMessage(i18n.t("support.status.submitted"));
      setShowComposer(false);
      setSubject("");
      setDescription("");
      setSelectedBookingId("");
      await loadSupportView();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : i18n.t("support.error.submit"));
    } finally {
      setIsWorking(false);
    }
  }

  if (!sessionReady || (session && isLoadingSupport && tickets.length === 0 && bookingOptions.length === 0 && !supportLoadError)) {
    return (
      <article className="card">
        <h2>{i18n.t("support.open_ticket")}</h2>
        <p>{i18n.t("support.loading")}</p>
      </article>
    );
  }

  if (!session) {
    return (
      <article className="card">
        <h2>{i18n.t("support.open_ticket")}</h2>
        <p>{i18n.t("support.login_body")}</p>
        <div className="cta-row" style={{ marginTop: "1rem" }}>
          <a className="button" href={addLocalePrefix("/login", i18n.locale)}>
            {i18n.t("nav.log_in")}
          </a>
          <a className="button-secondary" href="#contact-us">
            {i18n.t("support.prebooking_help")}
          </a>
        </div>
      </article>
    );
  }

  return (
    <article className="card">
      <h2>{i18n.t("support.open_ticket")}</h2>
      <p>{i18n.t("support.body")}</p>
      <div className="cta-row" style={{ marginTop: "1rem" }}>
        <button
          className={showComposer ? "button-secondary" : "button"}
          onClick={() => setShowComposer((current) => !current)}
          type="button"
        >
          {showComposer ? i18n.t("support.hide_form") : i18n.t("support.open_ticket")}
        </button>
      </div>
      {showComposer ? (
        <>
          <div className="form-grid" style={{ marginTop: "1rem" }}>
            <label className="form-field">
              <span>{i18n.t("support.issue_type")}</span>
              <select onChange={(event) => setIssueType(event.target.value as SupportIssueType)} value={issueType}>
                {issueOptions.map((option) => (
                  <option key={option} value={option}>
                    {i18n.t(issueLabelKeys[option])}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span>{i18n.t("support.booking")}</span>
              <select onChange={(event) => setSelectedBookingId(event.target.value)} value={selectedBookingId}>
                <option value="">{i18n.t("support.no_booking")}</option>
                {bookingOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field form-field--full">
              <span>{i18n.t("support.subject")}</span>
              <input onChange={(event) => setSubject(event.target.value)} placeholder={i18n.t("support.subject_placeholder")} value={subject} />
            </label>
            <label className="form-field form-field--full">
              <span>{i18n.t("support.description")}</span>
              <textarea
                onChange={(event) => setDescription(event.target.value)}
                rows={5}
                placeholder={i18n.t("support.description_placeholder")}
                value={description}
              />
            </label>
          </div>
          <div className="cta-row" style={{ marginTop: "1rem" }}>
            <button className="button" disabled={isWorking} onClick={() => void handleSubmit()} type="button">
              {isWorking ? i18n.t("support.submitting") : i18n.t("support.submit_ticket")}
            </button>
          </div>
        </>
      ) : null}
      {statusMessage ? <p style={{ marginTop: "1rem" }}>{statusMessage}</p> : null}
      {submitError ? <p style={{ marginTop: "1rem" }}>{submitError}</p> : null}
      {supportLoadError ? (
        <div className="stack-lg" style={{ marginTop: "1rem", paddingBottom: 0 }}>
          <p>{supportLoadError}</p>
          <div className="cta-row">
            <button
              className="button-secondary"
              disabled={isLoadingSupport}
              onClick={() => void loadSupportView()}
              type="button"
            >
              {isLoadingSupport ? i18n.t("common.actions.trying_again") : i18n.t("common.actions.try_again")}
            </button>
          </div>
        </div>
      ) : null}
      {tickets.length > 0 ? (
        <div className="stack-lg" style={{ marginTop: "1.5rem", paddingBottom: 0 }}>
          <div className="cta-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <h3>{i18n.t("support.recent_tickets")}</h3>
            <button
              className="button-secondary"
              onClick={() => setShowRecentTickets((current) => !current)}
              type="button"
            >
              {showRecentTickets ? i18n.t("support.hide_recent_tickets") : i18n.t("support.recent_tickets")}
            </button>
          </div>
          {showRecentTickets ? (
            tickets.slice(0, 4).map((ticket) => (
              <article className="list-panel" key={ticket.id}>
                <div className="cta-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                  <h3>{ticket.subject}</h3>
                  <span>{i18n.formatDate(ticket.createdAt)}</span>
                </div>
                <p>
                  {i18n.t(issueLabelKeys[ticket.issueType])} • {ticket.status}
                  {ticket.bookingId
                    ? ` • ${bookingLabelById[ticket.bookingId] ?? i18n.t("support.related_booking")}`
                    : ""}
                </p>
                <p>{ticket.description}</p>
                {ticket.resolutionNotes ? (
                  <p>
                    {i18n.t("support.resolution_label")} {ticket.resolutionNotes}
                    {ticket.resolutionAction ? ` • ${ticket.resolutionAction.replaceAll("-", " ")}` : ""}
                  </p>
                ) : null}
              </article>
            ))
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
