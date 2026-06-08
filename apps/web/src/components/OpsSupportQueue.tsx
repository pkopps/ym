"use client";

import {
  MarketplaceApiClient,
  SupportOpsTicket,
  SupportTicket,
  SupportTicketStatus
} from "@yardmatch/contracts";
import { useEffect, useState } from "react";
import { getWebApiBaseUrl } from "../lib/api";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

export function OpsSupportQueue() {
  const [tickets, setTickets] = useState<SupportOpsTicket[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [isWorking, setIsWorking] = useState(false);

  async function loadQueue() {
    const api = new MarketplaceApiClient(getWebApiBaseUrl());
    const nextTickets = await api.getOpsSupportTickets();
    setTickets(nextTickets);
  }

  useEffect(() => {
    void loadQueue().catch((error) => {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load the ops queue.");
    });
  }, []);

  async function updateTicket(
    ticketId: string,
    status: SupportTicketStatus,
    resolutionAction?: SupportTicket["resolutionAction"],
    resolutionNotes?: string
  ) {
    try {
      setIsWorking(true);
      setStatusMessage(undefined);
      setErrorMessage(undefined);
      const api = new MarketplaceApiClient(getWebApiBaseUrl());
      await api.updateOpsSupportTicket({
        ticketId,
        status,
        resolutionAction,
        resolutionNotes
      });
      setStatusMessage(
        status === "triaged"
          ? "Ticket triaged."
          : resolutionAction === "approve-refund"
            ? "Refund approved and payment reversed."
            : resolutionAction === "deny-refund"
              ? "Refund review denied and payment left captured."
              : "Ticket resolved and booking state updated."
      );
      await loadQueue();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update that ticket.");
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <section className="card">
      <span className="eyebrow">Support queue</span>
      <h2>Resolve disputes and field issues.</h2>
      <p>
        Triage live incidents, then resolve them with an explicit booking outcome so customers and
        providers land in a clean state.
      </p>
      {statusMessage ? <p>{statusMessage}</p> : null}
      {errorMessage ? <p>{errorMessage}</p> : null}
      <div className="stack-lg" style={{ paddingBottom: 0 }}>
        {tickets.length > 0 ? (
          tickets.map(({ ticket, booking, payment, customerName, providerName }) => (
            <article className="list-panel" key={ticket.id}>
              <div className="search-result-title">
                <div>
                  <h3>{ticket.subject}</h3>
                  <p>
                    {ticket.issueType.replaceAll("-", " ")} • {ticket.status} • opened{" "}
                    {formatDateTime(ticket.createdAt)}
                  </p>
                </div>
                <span className="result-badge">{ticket.status}</span>
              </div>
              <p>{ticket.description}</p>
              {booking ? (
                <div className="stack-md">
                  <p>
                    Booking: {booking.category.replaceAll("-", " ")} • {formatDateTime(booking.scheduledStartIso)}
                  </p>
                  <p>
                    Customer: {customerName ?? booking.customerId} • Provider:{" "}
                    {providerName ?? booking.providerId}
                  </p>
                  <p>
                    Booking state: {booking.status}
                    {booking.disputeReason ? ` • dispute: ${booking.disputeReason}` : ""}
                    {booking.activeExceptionType ? ` • issue: ${booking.activeExceptionType}` : ""}
                  </p>
                  {payment ? (
                    <p>
                      Payment: {payment.status}
                      {payment.refundReviewStatus ? ` • refund review ${payment.refundReviewStatus}` : ""}
                      {payment.refundReason ? ` • reason: ${payment.refundReason}` : ""}
                    </p>
                  ) : null}
                </div>
              ) : null}
              {ticket.resolutionNotes ? <p>Resolution: {ticket.resolutionNotes}</p> : null}
              <div className="cta-row">
                {ticket.status === "open" ? (
                  <button
                    className="button-secondary"
                    disabled={isWorking}
                    onClick={() => void updateTicket(ticket.id, "triaged")}
                    type="button"
                  >
                    Mark triaged
                  </button>
                ) : null}
                {ticket.status !== "resolved" && ticket.issueType === "billing" && payment?.refundReviewStatus === "requested" ? (
                  <>
                    <button
                      className="button-secondary"
                      disabled={isWorking}
                      onClick={() =>
                        void updateTicket(
                          ticket.id,
                          "resolved",
                          "approve-refund",
                          "Support approved the refund review and reversed the customer payment."
                        )
                      }
                      type="button"
                    >
                      Approve refund
                    </button>
                    <button
                      className="button-secondary"
                      disabled={isWorking}
                      onClick={() =>
                        void updateTicket(
                          ticket.id,
                          "resolved",
                          "deny-refund",
                          "Support reviewed the refund request and kept the payment captured."
                        )
                      }
                      type="button"
                    >
                      Deny refund
                    </button>
                  </>
                ) : null}
                {ticket.status !== "resolved" && ticket.issueType !== "billing" ? (
                  <>
                    <button
                      className="button-secondary"
                      disabled={isWorking}
                      onClick={() =>
                        void updateTicket(
                          ticket.id,
                          "resolved",
                          "restore-active-booking",
                          "Support reviewed the issue and restored the booking to the active schedule."
                        )
                      }
                      type="button"
                    >
                      Resolve and restore
                    </button>
                    <button
                      className="button-secondary"
                      disabled={isWorking}
                      onClick={() =>
                        void updateTicket(
                          ticket.id,
                          "resolved",
                          "cancel-booking",
                          "Support resolved the issue by cancelling the booking."
                        )
                      }
                      type="button"
                    >
                      Resolve and cancel
                    </button>
                    <button
                      className="button-secondary"
                      disabled={isWorking}
                      onClick={() =>
                        void updateTicket(
                          ticket.id,
                          "resolved",
                          "complete-booking",
                          "Support confirmed the service should be treated as complete."
                        )
                      }
                      type="button"
                    >
                      Resolve and complete
                    </button>
                  </>
                ) : null}
              </div>
            </article>
          ))
        ) : (
          <p>No support tickets yet.</p>
        )}
      </div>
    </section>
  );
}
