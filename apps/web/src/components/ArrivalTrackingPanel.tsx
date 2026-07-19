"use client";

import { BookingArrivalTracking } from "@yardmatch/contracts";
import { useI18n } from "@yardmatch/i18n/react";

function buildBoundingBox(tracking: BookingArrivalTracking) {
  const points = [tracking.destination.point];
  if (tracking.routeStartPoint) {
    points.push(tracking.routeStartPoint);
  }
  if (tracking.currentLegDestination?.point) {
    points.push(tracking.currentLegDestination.point);
  }
  if (tracking.currentPoint) {
    points.push(tracking.currentPoint);
  }

  const latitudes = points.map((point) => point.latitude);
  const longitudes = points.map((point) => point.longitude);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);
  const latPadding = Math.max(0.01, (maxLat - minLat) * 0.5);
  const lngPadding = Math.max(0.01, (maxLng - minLng) * 0.5);

  return {
    left: minLng - lngPadding,
    bottom: minLat - latPadding,
    right: maxLng + lngPadding,
    top: maxLat + latPadding
  };
}

function buildMapUrl(tracking: BookingArrivalTracking) {
  const bbox = buildBoundingBox(tracking);
  const marker = tracking.currentPoint ?? tracking.destination.point;
  const params = new URLSearchParams({
    bbox: `${bbox.left},${bbox.bottom},${bbox.right},${bbox.top}`,
    layer: "mapnik",
    marker: `${marker.latitude},${marker.longitude}`
  });

  return `https://www.openstreetmap.org/export/embed.html?${params.toString()}`;
}

function formatPercent(progressPercent: number) {
  return `${Math.max(0, Math.min(progressPercent, 100))}%`;
}

export function ArrivalTrackingPanel({
  tracking,
  title,
  subtitle,
  showProviderRouteDetails = false
}: {
  tracking: BookingArrivalTracking;
  title: string;
  subtitle?: string;
  showProviderRouteDetails?: boolean;
}) {
  const i18n = useI18n();

  return (
    <section className="arrival-tracking card">
      <div className="arrival-tracking__header">
        <div>
          <span className="eyebrow">{i18n.t("arrival_tracking.eyebrow")}</span>
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        <div className="arrival-tracking__eta">
          <strong>
            {tracking.etaMinutes
              ? i18n.t("arrival_tracking.minutes", { minutes: tracking.etaMinutes })
              : i18n.t("arrival_tracking.arrived")}
          </strong>
          <span>{tracking.status.replaceAll("-", " ")}</span>
        </div>
      </div>

      <div className="arrival-tracking__progress">
        <div className="arrival-tracking__progress-bar">
          <span
            className="arrival-tracking__progress-fill"
            style={{ width: formatPercent(tracking.progressPercent) }}
          />
        </div>
        <div className="arrival-tracking__progress-copy">
          <span>{i18n.t("arrival_tracking.complete", { percent: formatPercent(tracking.progressPercent) })}</span>
          <span>
            {tracking.remainingDistanceMiles !== undefined
              ? i18n.t("arrival_tracking.miles_left", { miles: tracking.remainingDistanceMiles })
              : i18n.t("arrival_tracking.waiting_route")}
          </span>
        </div>
      </div>

      <div className="arrival-tracking__map-shell">
        <iframe
          className="arrival-tracking__map"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          src={buildMapUrl(tracking)}
          title={i18n.t("arrival_tracking.map_title")}
        />
      </div>

      <div className="arrival-tracking__details">
        <div className="list-panel">
          <h3>{i18n.t("arrival_tracking.crew")}</h3>
          <p>{tracking.crewMemberName ?? i18n.t("arrival_tracking.assigned_crew")}</p>
          <p>
            {tracking.source === "provider-device"
              ? tracking.isLiveLocationStale
                ? i18n.t("arrival_tracking.provider_location_paused")
                : i18n.t("arrival_tracking.provider_location")
              : tracking.source === "crew-device"
                ? tracking.isLiveLocationStale
                  ? i18n.t("arrival_tracking.crew_location_paused")
                  : i18n.t("arrival_tracking.crew_location")
                : i18n.t("arrival_tracking.estimated_route")}
          </p>
          {tracking.liveUpdatedAt ? (
            <p>
              {i18n.t("arrival_tracking.updated", {
                time: i18n.formatDate(tracking.liveUpdatedAt, { timeStyle: "short" })
              })}
            </p>
          ) : null}
        </div>
        <div className="list-panel">
          <h3>{i18n.t("arrival_tracking.destination")}</h3>
          <p>{tracking.destination.line1}</p>
          <p>
            {tracking.destination.city}, {tracking.destination.state} {tracking.destination.postalCode}
          </p>
        </div>
        {showProviderRouteDetails && tracking.activeRouteStop ? (
          <div className="list-panel">
            <h3>{i18n.t("arrival_tracking.provider_stop")}</h3>
            <p>{tracking.activeRouteStop.label}</p>
            <p>{tracking.activeRouteStop.address.line1}</p>
            <p>
              {tracking.activeRouteStop.address.city}, {tracking.activeRouteStop.address.state}{" "}
              {tracking.activeRouteStop.address.postalCode}
            </p>
            {tracking.etaToCurrentLegMinutes ? (
              <p>{i18n.t("arrival_tracking.minutes_to_stop", { minutes: tracking.etaToCurrentLegMinutes })}</p>
            ) : null}
          </div>
        ) : null}
      </div>

      <p className="arrival-tracking__message">{tracking.message}</p>
    </section>
  );
}
