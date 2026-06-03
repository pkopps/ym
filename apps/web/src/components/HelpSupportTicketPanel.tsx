"use client";

import {
  Booking,
  CreateSupportTicketRequest,
  SupportIssueType,
  SupportTicket
} from "@yardmatch/contracts";
import { useEffect, useMemo, useState } from "react";
import { createAuthenticatedWebApiClient, loadStoredSession } from "../lib/api";

const issueOptions: SupportIssueType[] = ["billing", "service-quality", "account", "general"];

type BookingOption = {
  id: string;
  label: string;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

export function HelpSupportTicketPanel() {
  const [sessionReady, setSessionReady] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [statusMessage, setStatusMessage] = useState<string | undefined>();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [bookingOptions, setBookingOptions] = useState<BookingOption[]>([]);
  const [issueType, setIssueType] = useState<SupportIssueType>("general");
  const [selectedBookingId, setSelectedBookingId] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");

  const session = useMemo(() => loadStoredSession(), []);

  async function loadSupportView() {
    const currentSession = loadStoredSession();
    if (!currentSession) {
      setSessionReady(true);
      return;
    }

    try {
      const api = createAuthenticatedWebApiClient();
      const [nextTickets, options] = await Promise.all([
        api.getSupportTickets(),
        (async () => {
          if (currentSession.role === "crew-member") {
            const matches = await api.getCrewMatches();
            return matches.matches.map((match) => ({
              id: match.bookingId,
              label: `${match.providerCompanyName} • ${match.category.replaceAll("-", " ")}`
            }));
          }

          const bookings = await api.getBookings();
          return bookings.map((booking: Booking) => ({
            id: booking.id,
            label: `${booking.category.replaceAll("-", " ")} • ${formatDate(booking.scheduledStartIso)}`
          }));
        })()
      ]);

      setTickets(nextTickets);
      setBookingOptions(options);
      setSessionReady(true);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load support.");
      setSessionReady(true);
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
      }
      if (
        issueTypeParam &&
        issueOptions.includes(issueTypeParam as SupportIssueType)
      ) {
        setIssueType(issueTypeParam as SupportIssueType);
      }
      if (subjectParam) {
        setSubject(subjectParam);
      }
    }
    void loadSupportView();
  }, []);

  async function handleSubmit() {
    if (!session || subject.trim().length === 0 || description.trim().length === 0) {
      return;
    }

    try {
      setIsWorking(true);
      setErrorMessage(undefined);
      const api = createAuthenticatedWebApiClient();
      await api.createSupportTicket({
        bookingId: selectedBookingId || undefined,
        issueType,
        subject: subject.trim(),
        description: description.trim()
      } satisfies CreateSupportTicketRequest);
      setStatusMessage("Support ticket submitted.");
      setSubject("");
      setDescription("");
      setSelectedBookingId("");
      await loadSupportView();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to open a support ticket.");
    } finally {
      setIsWorking(false);
    }
  }

  if (!sessionReady) {
    return (
      <article className="card">
        <h2>Open a support ticket</h2>
        <p>Loading support options…</p>
      </article>
    );
  }

  if (!session) {
    return (
      <article className="card">
        <h2>Open a support ticket</h2>
        <p>Log in first so YardMatch can attach your request to the right account and booking.</p>
        <div className="cta-row" style={{ marginTop: "1rem" }}>
          <a className="button" href="/login">
            Log in
          </a>
        </div>
      </article>
    );
  }

  return (
    <article className="card">
      <h2>Open a support ticket</h2>
      <div className="form-grid">
        <label className="form-field">
          <span>Issue type</span>
          <select onChange={(event) => setIssueType(event.target.value as SupportIssueType)} value={issueType}>
            {issueOptions.map((option) => (
              <option key={option} value={option}>
                {option.replaceAll("-", " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="form-field">
          <span>Booking</span>
          <select onChange={(event) => setSelectedBookingId(event.target.value)} value={selectedBookingId}>
            <option value="">No booking</option>
            {bookingOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="form-field form-field--full">
          <span>Subject</span>
          <input onChange={(event) => setSubject(event.target.value)} placeholder="Short subject" value={subject} />
        </label>
        <label className="form-field form-field--full">
          <span>Describe the issue</span>
          <textarea
            onChange={(event) => setDescription(event.target.value)}
            rows={5}
            placeholder="Tell us what went wrong and what outcome you need."
            value={description}
          />
        </label>
      </div>
      <div className="cta-row" style={{ marginTop: "1rem" }}>
        <button className="button" disabled={isWorking} onClick={() => void handleSubmit()} type="button">
          {isWorking ? "Submitting..." : "Submit ticket"}
        </button>
      </div>
      {statusMessage ? <p style={{ marginTop: "1rem" }}>{statusMessage}</p> : null}
      {errorMessage ? <p style={{ marginTop: "1rem" }}>{errorMessage}</p> : null}
      <div className="stack-lg" style={{ marginTop: "1.5rem", paddingBottom: 0 }}>
        {tickets.slice(0, 4).map((ticket) => (
          <article className="list-panel" key={ticket.id}>
            <div className="cta-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <h3>{ticket.subject}</h3>
              <span>{new Date(ticket.createdAt).toLocaleDateString()}</span>
            </div>
            <p>
              {ticket.issueType.replaceAll("-", " ")} • {ticket.status}
              {ticket.bookingId ? ` • ${ticket.bookingId}` : ""}
            </p>
            <p>{ticket.description}</p>
          </article>
        ))}
      </div>
    </article>
  );
}
