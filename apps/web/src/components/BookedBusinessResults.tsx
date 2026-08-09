"use client";

import { useState } from "react";
import { addLocalePrefix } from "@yardmatch/i18n";
import { useI18n } from "@yardmatch/i18n/react";
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
  const i18n = useI18n();
  const [mapExpanded, setMapExpanded] = useState(true);
  const addressLabel = searchAreaLabel ?? bookedBusinessSearchContext.userAddressLabel;

  return (
    <div className={`results-shell${!mapExpanded ? " results-shell--map-collapsed" : ""}`}>
      <div className="results-shell__list">
        <div className="results-summary">
          <div className="results-summary__copy">
            <strong>{bookedBusinessSearchContext.resultCountLabel}</strong>
            <span>
              {serviceLabel
                ? i18n.t("booked_results.service_near_area", {
                    serviceLabel,
                    area: addressLabel
                  })
                : bookedBusinessSearchContext.dateRangeLabel}
            </span>
            <small>{i18n.t("booked_results.summary_note")}</small>
          </div>
          <div className="results-summary__actions">
            {allowMapToggle ? (
              <button
                className="button-secondary"
                onClick={() => setMapExpanded((current) => !current)}
                type="button"
              >
                {i18n.t(mapExpanded ? "booked_results.map.collapse" : "booked_results.map.expand")}
              </button>
            ) : null}
            {showOpenListingsLink ? (
              <a className="button-secondary" href={addLocalePrefix("/customer/listings", i18n.locale)}>
                {i18n.t("booked_results.open_full_listing")}
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
                    alt={i18n.t("booked_results.business_avatar_alt", {
                      ownerName: business.ownerName,
                      businessName: business.name
                    })}
                    className="calendar-card__avatar"
                    height={72}
                    src={business.avatarUrl}
                    width={72}
                  />
                  <div>
                    <span className="eyebrow">{business.fullyBookedLabel}</span>
                    <h3>{business.name}</h3>
                    <p>
                      {i18n.t("booked_results.owner_rating", {
                        ownerName: business.ownerName,
                        rating: business.rating
                      })}
                    </p>
                    <p>
                      {i18n.t("booked_results.distance_address", {
                        distance: business.distanceMiles,
                        address: business.addressLine
                      })}
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
              <div className="calendar-card__metric-row">
                <span>{i18n.t("booked_results.rating", { rating: business.rating })}</span>
                <span>{i18n.t("booked_results.distance_away", { distance: business.distanceMiles })}</span>
                <span>{business.crewSizeLabel}</span>
              </div>
              <p className="calendar-card__note">
                {i18n.t("booked_results.best_known_for", {
                  specialties: business.specialties.slice(0, 2).join(" and ").toLowerCase(),
                  city: business.city
                })}
              </p>
              <div className="calendar-slots calendar-slots--inline">
                {visibleSlots.map((slot) => (
                  <div className="calendar-slot calendar-slot--booked" key={`${business.name}-${slot.windowLabel}`}>
                    <span>{slot.windowLabel}</span>
                    <strong>{i18n.t("booked_results.booked")}</strong>
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
              <span className="eyebrow">{i18n.t("booked_results.map.requested_address")}</span>
              <strong>{addressLabel}</strong>
              <p>{i18n.t("booked_results.map.distance_note")}</p>
            </div>
            <div className="map-viewport" aria-label={i18n.t("booked_results.map.aria")}>
              <iframe
                className="map-viewport__frame"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                src={bookedBusinessSearchContext.mapEmbedUrl}
                title={i18n.t("booked_results.map.title")}
              />
              <div className="map-viewport__overlay" />
              <div className="map-user-marker" style={{ left: "56%", top: "44%" }}>
                <span>{i18n.t("booked_results.map.home")}</span>
              </div>
              {bookedBusinessShowcase.map((business, index) => (
                <div
                  className="map-business-marker"
                  key={`${business.name}-marker`}
                  style={{ left: `${business.mapX}%`, top: `${business.mapY}%` }}
                >
                  <strong>{index + 1}</strong>
                  <span>{i18n.t("common.format.miles", { count: business.distanceMiles })}</span>
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
                  <span>{i18n.t("common.format.miles", { count: business.distanceMiles })}</span>
                </article>
              ))}
            </div>
          </div>
        </aside>
      ) : null}
    </div>
  );
}
