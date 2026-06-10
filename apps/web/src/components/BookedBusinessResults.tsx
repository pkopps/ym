"use client";

import { useState } from "react";
import { bookedBusinessSearchContext, bookedBusinessShowcase } from "@yardmatch/ui";

export function BookedBusinessResults({
  allowMapToggle = false,
  showOpenListingsLink = false,
  searchAreaLabel,
  serviceLabel
}: {
  allowMapToggle?: boolean;
  showOpenListingsLink?: boolean;
  searchAreaLabel?: string;
  serviceLabel?: string;
}) {
  const [mapExpanded, setMapExpanded] = useState(true);

  return (
    <div className={`results-shell${!mapExpanded ? " results-shell--map-collapsed" : ""}`}>
      <div className="results-shell__list">
        <div className="results-summary">
          <div className="results-summary__copy">
            <strong>{bookedBusinessSearchContext.resultCountLabel}</strong>
            <span>
              {serviceLabel ? `${serviceLabel} near ${searchAreaLabel ?? bookedBusinessSearchContext.userAddressLabel}` : bookedBusinessSearchContext.dateRangeLabel}
            </span>
          </div>
          <div className="results-summary__actions">
            {allowMapToggle ? (
              <button
                className="button-secondary"
                onClick={() => setMapExpanded((current) => !current)}
                type="button"
              >
                {mapExpanded ? "Collapse map" : "Expand map"}
              </button>
            ) : null}
            {showOpenListingsLink ? (
              <a className="button-secondary" href="/customer/listings">
                Open full listing view
              </a>
            ) : null}
          </div>
        </div>
        <div className="business-showcase-list">
          {bookedBusinessShowcase.map((business) => {
            const visibleSlots = business.slots.filter((slot) => slot.windowLabel.trim().length > 0);

            return (
            <article className="calendar-card calendar-card--condensed" key={business.name}>
              <div className="calendar-card__header">
                <div className="calendar-card__identity">
                  <img
                    alt={`${business.ownerName} from ${business.name}`}
                    className="calendar-card__avatar"
                    height={72}
                    src={business.avatarUrl}
                    width={72}
                  />
                  <div>
                    <span className="eyebrow">{business.fullyBookedLabel}</span>
                    <h3>{business.name}</h3>
                    {business.sponsored ? (
                      <div className="sponsored-cluster">
                        <span className="result-badge">Sponsored</span>
                        <details className="sponsored-explainer">
                          <summary className="sponsored-explainer__summary">Why am I seeing this?</summary>
                          <div className="sponsored-explainer__body">
                            Sponsored businesses can get stronger placement, but they still need to
                            fit the customer address, service type, and route radius.
                          </div>
                        </details>
                      </div>
                    ) : null}
                    <p>
                      {business.ownerName} • {business.rating} stars
                    </p>
                    <p>
                      {business.distanceMiles} mi away • {business.addressLine}
                    </p>
                  </div>
                </div>
                <strong>{business.crewSizeLabel}</strong>
              </div>
              <div className="chip-row">
                {business.specialties.map((specialty) => (
                  <span key={specialty}>{specialty}</span>
                ))}
              </div>
              <div className="calendar-slots calendar-slots--inline">
                {visibleSlots.map((slot) => (
                  <div className="calendar-slot calendar-slot--booked" key={`${business.name}-${slot.windowLabel}`}>
                    <span>{slot.windowLabel}</span>
                    <strong>Booked</strong>
                  </div>
                ))}
              </div>
            </article>
          );
          })}
        </div>
      </div>

      {mapExpanded ? (
        <aside className="results-shell__map">
          <div className="map-panel">
            <div className="map-panel__toolbar">
              <span className="eyebrow">Requested address</span>
              <strong>{searchAreaLabel ?? bookedBusinessSearchContext.userAddressLabel}</strong>
              <p>
                Distances are measured from the customer property to each booked landscaping
                business.
              </p>
            </div>
            <div className="map-viewport" aria-label="Customer address and nearby business distance map">
              <iframe
                className="map-viewport__frame"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                src={bookedBusinessSearchContext.mapEmbedUrl}
                title="Nearby landscaping businesses map"
              />
              <div className="map-viewport__overlay" />
              <div className="map-user-marker" style={{ left: "56%", top: "44%" }}>
                <span>Home</span>
              </div>
              {bookedBusinessShowcase.map((business, index) => (
                <div
                  className="map-business-marker"
                  key={`${business.name}-marker`}
                  style={{ left: `${business.mapX}%`, top: `${business.mapY}%` }}
                >
                  <strong>{index + 1}</strong>
                  <span>{business.distanceMiles} mi</span>
                </div>
              ))}
            </div>
            <div className="map-legend">
              {bookedBusinessShowcase.map((business, index) => (
                <article className="map-legend__row" key={`${business.name}-legend`}>
                  <div className="map-legend__business">
                    <strong>{index + 1}</strong>
                    <div>
                      <h4>{business.name}</h4>
                      <p>
                        {business.city}, {business.state}
                      </p>
                    </div>
                  </div>
                  <span>{business.distanceMiles} mi</span>
                </article>
              ))}
            </div>
          </div>
        </aside>
      ) : null}
    </div>
  );
}
