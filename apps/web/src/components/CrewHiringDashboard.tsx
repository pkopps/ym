"use client";

import { useState } from "react";
import { addLocalePrefix } from "@yardmatch/i18n";
import { useI18n } from "@yardmatch/i18n/react";
import { crewHiringOpportunities } from "@yardmatch/ui";

type RequestStatus = "idle" | "success" | "filled";

export function CrewHiringDashboard() {
  const i18n = useI18n();
  const [requestStates, setRequestStates] = useState<Record<string, RequestStatus>>({});

  const trainingCount = crewHiringOpportunities.filter((opportunity) => opportunity.trainingProvided).length;
  const totalOpenWindows = crewHiringOpportunities.reduce(
    (total, opportunity) => total + opportunity.hiringWindows.length,
    0
  );

  return (
    <>
      <section className="grid-three">
        <article className="card">
          <h2>{crewHiringOpportunities.length}</h2>
          <p>{i18n.t("crew_hiring.metric.businesses")}</p>
        </article>
        <article className="card">
          <h2>{totalOpenWindows}</h2>
          <p>{i18n.t("crew_hiring.metric.windows")}</p>
        </article>
        <article className="card">
          <h2>{trainingCount}</h2>
          <p>{i18n.t("crew_hiring.metric.training")}</p>
        </article>
      </section>

      <section className="grid-two">
        <article className="card">
          <div id="open-crews" />
          <div className="search-result-title">
            <h2>{i18n.t("crew_hiring.open_crews")}</h2>
            <a className="button-secondary" href={addLocalePrefix("/crew/schedule", i18n.locale)}>
              {i18n.t("crew_hiring.view_schedule")}
            </a>
          </div>
          <div className="stack-lg" style={{ paddingBottom: 0 }}>
            {crewHiringOpportunities.map((opportunity) => {
              const status = requestStates[opportunity.id] ?? "idle";

              return (
                <article className="crew-opportunity-card" key={opportunity.id}>
                  <div className="crew-opportunity-card__header">
                    <div className="crew-opportunity-card__identity">
                      <img
                        alt={i18n.t("crew_hiring.avatar_alt", { ownerName: opportunity.ownerName })}
                        className="crew-opportunity-card__avatar"
                        src={opportunity.avatarUrl}
                      />
                      <div>
                        <div className="search-result-title">
                          <h3>{opportunity.businessName}</h3>
                          <span className="result-badge">{opportunity.urgencyLabel}</span>
                        </div>
                        <p>
                          {i18n.t("crew_hiring.owner_location_distance", {
                            ownerName: opportunity.ownerName,
                            city: opportunity.city,
                            state: opportunity.state,
                            distance: opportunity.distanceMiles
                          })}
                        </p>
                      </div>
                    </div>
                    <strong>{opportunity.payRange}</strong>
                  </div>

                  <div className="crew-opportunity-card__grid">
                    <div>
                      <h4>{i18n.t("crew_hiring.need")}</h4>
                      <p>{opportunity.needsLabel}</p>
                      <p>{opportunity.crewGapLabel}</p>
                    </div>
                    <div>
                      <h4>{i18n.t("crew_hiring.best_for")}</h4>
                      <div className="chip-row">
                        {opportunity.serviceNeeds.map((need) => (
                          <span key={need}>{need}</span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="crew-opportunity-card__grid">
                    <div>
                      <h4>{i18n.t("crew_hiring.when")}</h4>
                      <ul className="timeline">
                        {opportunity.hiringWindows.map((window) => (
                          <li key={`${window.dayLabel}-${window.timeLabel}`}>
                            <strong>{window.dayLabel}</strong>
                            <span>{window.timeLabel}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4>{i18n.t("crew_hiring.training_equipment")}</h4>
                      <p>
                        {i18n.t(
                          opportunity.trainingProvided
                            ? "crew_hiring.training_provided"
                            : "crew_hiring.no_formal_training"
                        )}
                      </p>
                      <p>{opportunity.guidanceStyle}</p>
                      <p>{opportunity.equipmentProvided}</p>
                    </div>
                  </div>

                  {status === "success" ? (
                    <div className="crew-request-feedback crew-request-feedback--success">
                      <strong>{i18n.t("crew_hiring.request_sent")}</strong>
                      <p>{i18n.t("crew_hiring.request_sent_body")}</p>
                      <div className="cta-row">
                        <a className="button-secondary" href={addLocalePrefix("/crew/schedule", i18n.locale)}>
                          {i18n.t("crew_hiring.view_schedule")}
                        </a>
                      </div>
                    </div>
                  ) : null}

                  {status === "filled" ? (
                    <div className="crew-request-feedback crew-request-feedback--warning">
                      <strong>{i18n.t("crew_hiring.no_longer_available")}</strong>
                      <p>{i18n.t("crew_hiring.no_longer_available_body")}</p>
                      <div className="cta-row">
                        <a className="button-secondary" href="#open-crews">
                          {i18n.t("crew_hiring.more_businesses")}
                        </a>
                      </div>
                    </div>
                  ) : null}

                  <div className="cta-row">
                    <button
                      className="button"
                      onClick={() =>
                        setRequestStates((current) => ({
                          ...current,
                          [opportunity.id]: opportunity.requestOutcome
                        }))
                      }
                      type="button"
                    >
                      {i18n.t("crew_hiring.request_to_join")}
                    </button>
                    <button className="button-secondary" type="button">
                      {i18n.t("crew_hiring.save_for_later")}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </article>

        <article className="card" id="other-open-crews">
          <h2>{i18n.t("crew_hiring.profile.title")}</h2>
          <div className="stack-lg" style={{ paddingBottom: 0 }}>
            <article className="list-panel">
              <h3>{i18n.t("crew_signup.skills")}</h3>
              <p>{i18n.t("crew_hiring.profile.skills")}</p>
            </article>
            <article className="list-panel">
              <h3>{i18n.t("crew_hiring.profile.availability")}</h3>
              <p>{i18n.t("crew_hiring.profile.availability_value")}</p>
            </article>
            <article className="list-panel">
              <h3>{i18n.t("crew_hiring.profile.travel_radius")}</h3>
              <p>{i18n.t("crew_hiring.profile.travel_radius_value", { distance: 20 })}</p>
            </article>
            <article className="list-panel">
              <h3>{i18n.t("crew_hiring.profile.equipment")}</h3>
              <p>{i18n.t("crew_hiring.profile.equipment_value")}</p>
            </article>
            <article className="list-panel">
              <h3>{i18n.t("crew_signup.schedule")}</h3>
              <p>{i18n.t("crew_hiring.profile.schedule_value")}</p>
              <div className="cta-row">
                <a className="button-secondary" href={addLocalePrefix("/crew/schedule", i18n.locale)}>
                  {i18n.t("crew_hiring.profile.open_schedule")}
                </a>
              </div>
            </article>
          </div>
        </article>
      </section>
    </>
  );
}
