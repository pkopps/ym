"use client";

import { CrewMatchSummary } from "@yardmatch/contracts";
import { addLocalePrefix } from "@yardmatch/i18n";
import { serviceCategoryToI18nKey } from "@yardmatch/i18n/service-labels";
import { useI18n } from "@yardmatch/i18n/react";
import { useEffect, useMemo, useState } from "react";
import { createAuthenticatedWebApiClient } from "../lib/api";
import { useStoredWebSession } from "../lib/session";

const completedBookingStatuses = new Set(["completed", "disputed", "refunded"]);

function formatAssignmentStatus(status: CrewMatchSummary["bookingStatus"]) {
  return status.replaceAll("-", " ");
}

export function CrewHistoryBoard() {
  const i18n = useI18n();
  const { session, sessionReady } = useStoredWebSession();
  const [accessDenied, setAccessDenied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [assignments, setAssignments] = useState<CrewMatchSummary[]>([]);

  useEffect(() => {
    if (!sessionReady) {
      return;
    }

    if (!session || session.role !== "crew-member") {
      setAccessDenied(true);
      return;
    }

    setAccessDenied(false);

    void (async () => {
      try {
        const api = createAuthenticatedWebApiClient();
        const response = await api.getCrewMatches();
        setAssignments(
          response.matches
            .filter(
              (match) =>
                match.status === "accepted" && completedBookingStatuses.has(match.bookingStatus)
            )
            .slice()
            .sort((left, right) => right.scheduledStartIso.localeCompare(left.scheduledStartIso))
        );
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : i18n.t("crew_history.load_error"));
      }
    })();
  }, [i18n, sessionReady, session?.role, session?.token]);

  const providerCount = useMemo(
    () => new Set(assignments.map((assignment) => assignment.providerId)).size,
    [assignments]
  );
  const evidenceCount = useMemo(
    () =>
      assignments.reduce(
        (total, assignment) =>
          total + assignment.beforeEvidenceCount + assignment.afterEvidenceCount,
        0
      ),
    [assignments]
  );

  if (!sessionReady) {
    return (
      <section className="card">
        <h2>{i18n.t("crew_history.loading")}</h2>
      </section>
    );
  }

  if (accessDenied) {
    return (
      <section className="card">
        <h2>{i18n.t("crew_history.login_required")}</h2>
        <p>{i18n.t("crew_history.login_body")}</p>
        <div className="cta-row">
          <a className="button" href={addLocalePrefix("/login/crew", i18n.locale)}>
            {i18n.t("crew_history.login_cta")}
          </a>
        </div>
      </section>
    );
  }

  return (
    <div className="stack-lg">
      {errorMessage ? (
        <section className="card">
          <h2>{i18n.t("common.state.needs_attention")}</h2>
          <p>{errorMessage}</p>
        </section>
      ) : null}

      <section className="grid-three">
        <article className="card">
          <h2>{assignments.length}</h2>
          <p>{i18n.t("crew_history.metric.completed_assignments")}</p>
        </article>
        <article className="card">
          <h2>{providerCount}</h2>
          <p>{i18n.t("crew_history.metric.providers")}</p>
        </article>
        <article className="card">
          <h2>{evidenceCount}</h2>
          <p>{i18n.t("crew_history.metric.evidence_items")}</p>
        </article>
      </section>

      {assignments.length === 0 ? (
        <section className="card">
          <h2>{i18n.t("crew_history.empty.title")}</h2>
          <p>{i18n.t("crew_history.empty.body")}</p>
        </section>
      ) : (
        <section className="stack-lg">
          {assignments.map((assignment) => (
            <article className="history-card" key={assignment.id}>
              <div className="history-card__header">
                <div>
                  <span className="eyebrow">
                    {i18n.t(serviceCategoryToI18nKey(assignment.category))}
                  </span>
                  <h2>{assignment.providerCompanyName}</h2>
                </div>
                <strong>{formatAssignmentStatus(assignment.bookingStatus)}</strong>
              </div>
              <div className="history-card__grid">
                <div>
                  <h3>{i18n.t("crew_history.service_date")}</h3>
                  <p>
                    {i18n.formatDate(assignment.scheduledStartIso, {
                      dateStyle: "medium",
                      timeStyle: "short"
                    })}
                  </p>
                </div>
                <div>
                  <h3>{i18n.t("common.label.address")}</h3>
                  <p>{assignment.serviceAddress.line1}</p>
                  <p>
                    {assignment.serviceAddress.city}, {assignment.serviceAddress.state}{" "}
                    {assignment.serviceAddress.postalCode}
                  </p>
                </div>
                <div>
                  <h3>{i18n.t("crew_history.work_record")}</h3>
                  <p>
                    {i18n.t("crew_history.evidence_summary", {
                      after: assignment.afterEvidenceCount,
                      before: assignment.beforeEvidenceCount
                    })}
                  </p>
                  <p>{i18n.t("crew_history.compensation.provider_responsible")}</p>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
