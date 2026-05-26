"use client";

import { useState } from "react";
import { crewHiringOpportunities } from "@yardmatch/ui";

type RequestStatus = "idle" | "success" | "filled";

export function CrewHiringDashboard() {
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
          <p>Businesses hiring now</p>
        </article>
        <article className="card">
          <h2>{totalOpenWindows}</h2>
          <p>Open shift windows</p>
        </article>
        <article className="card">
          <h2>{trainingCount}</h2>
          <p>Businesses offering training</p>
        </article>
      </section>

      <section className="grid-two">
        <article className="card">
          <div id="open-crews" />
          <div className="search-result-title">
            <h2>Open crews</h2>
            <a className="button-secondary" href="/crew/schedule">
              View your schedule
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
                        alt={`${opportunity.ownerName} avatar`}
                        className="crew-opportunity-card__avatar"
                        src={opportunity.avatarUrl}
                      />
                      <div>
                        <div className="search-result-title">
                          <h3>{opportunity.businessName}</h3>
                          <span className="result-badge">{opportunity.urgencyLabel}</span>
                        </div>
                        <p>
                          {opportunity.ownerName} • {opportunity.city}, {opportunity.state} •{" "}
                          {opportunity.distanceMiles} miles away
                        </p>
                      </div>
                    </div>
                    <strong>{opportunity.payRange}</strong>
                  </div>

                  <div className="crew-opportunity-card__grid">
                    <div>
                      <h4>Need</h4>
                      <p>{opportunity.needsLabel}</p>
                      <p>{opportunity.crewGapLabel}</p>
                    </div>
                    <div>
                      <h4>Best for</h4>
                      <div className="chip-row">
                        {opportunity.serviceNeeds.map((need) => (
                          <span key={need}>{need}</span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="crew-opportunity-card__grid">
                    <div>
                      <h4>When they need help</h4>
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
                      <h4>Training and equipment</h4>
                      <p>{opportunity.trainingProvided ? "Training provided" : "No formal training"}</p>
                      <p>{opportunity.guidanceStyle}</p>
                      <p>{opportunity.equipmentProvided}</p>
                    </div>
                  </div>

                  {status === "success" ? (
                    <div className="crew-request-feedback crew-request-feedback--success">
                      <strong>Request sent.</strong>
                      <p>This business owner can review your request now.</p>
                      <div className="cta-row">
                        <a className="button-secondary" href="/crew/schedule">
                          View your schedule
                        </a>
                      </div>
                    </div>
                  ) : null}

                  {status === "filled" ? (
                    <div className="crew-request-feedback crew-request-feedback--warning">
                      <strong>No longer available.</strong>
                      <p>That spot was filled while you were browsing.</p>
                      <div className="cta-row">
                        <a className="button-secondary" href="#open-crews">
                          Don&apos;t worry, more businesses still need help
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
                      Request to join
                    </button>
                    <button className="button-secondary" type="button">
                      Save for later
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </article>

        <article className="card" id="other-open-crews">
          <h2>Your crew profile</h2>
          <div className="stack-lg" style={{ paddingBottom: 0 }}>
            <article className="list-panel">
              <h3>Skills</h3>
              <p>Lawn mowing, hedge trimming, edging, cleanup, snow shoveling</p>
            </article>
            <article className="list-panel">
              <h3>Availability</h3>
              <p>Mon, Wed, Fri • 7:00 AM - 4:00 PM</p>
            </article>
            <article className="list-panel">
              <h3>Travel radius</h3>
              <p>20 miles from home base</p>
            </article>
            <article className="list-panel">
              <h3>Equipment</h3>
              <p>Prefers companies that provide equipment on site.</p>
            </article>
            <article className="list-panel">
              <h3>Schedule</h3>
              <p>Accepted shifts appear in your calendar and list view.</p>
              <div className="cta-row">
                <a className="button-secondary" href="/crew/schedule">
                  Open schedule
                </a>
              </div>
            </article>
          </div>
        </article>
      </section>
    </>
  );
}
