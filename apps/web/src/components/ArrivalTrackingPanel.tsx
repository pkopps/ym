"use client";

import { BookingArrivalTracking } from "@yardmatch/contracts";

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
  return (
    <section className="arrival-tracking card">
      <div className="arrival-tracking__header">
        <div>
          <span className="eyebrow">Arrival tracking</span>
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        <div className="arrival-tracking__eta">
          <strong>{tracking.etaMinutes ? `${tracking.etaMinutes} min` : "Arrived"}</strong>
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
          <span>{formatPercent(tracking.progressPercent)} complete</span>
          <span>
            {tracking.remainingDistanceMiles !== undefined
              ? `${tracking.remainingDistanceMiles.toFixed(1)} miles left`
              : "Waiting for route"}
          </span>
        </div>
      </div>

      <div className="arrival-tracking__map-shell">
        <iframe
          className="arrival-tracking__map"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          src={buildMapUrl(tracking)}
          title="Live crew tracking map"
        />
      </div>

      <div className="arrival-tracking__details">
        <div className="list-panel">
          <h3>Crew</h3>
          <p>{tracking.crewMemberName ?? "Assigned crew member"}</p>
          <p>
            {tracking.source === "provider-device"
              ? tracking.isLiveLocationStale
                ? "Live provider location paused"
                : "Live provider location"
              : tracking.source === "crew-device"
                ? tracking.isLiveLocationStale
                  ? "Live crew location paused"
                  : "Live crew location"
                : "Estimated route"}
          </p>
          {tracking.liveUpdatedAt ? (
            <p>Updated {new Date(tracking.liveUpdatedAt).toLocaleTimeString(undefined, { timeStyle: "short" })}</p>
          ) : null}
        </div>
        <div className="list-panel">
          <h3>Destination</h3>
          <p>{tracking.destination.line1}</p>
          <p>
            {tracking.destination.city}, {tracking.destination.state} {tracking.destination.postalCode}
          </p>
        </div>
        {showProviderRouteDetails && tracking.activeRouteStop ? (
          <div className="list-panel">
            <h3>Provider-only stop</h3>
            <p>{tracking.activeRouteStop.label}</p>
            <p>{tracking.activeRouteStop.address.line1}</p>
            <p>
              {tracking.activeRouteStop.address.city}, {tracking.activeRouteStop.address.state}{" "}
              {tracking.activeRouteStop.address.postalCode}
            </p>
            {tracking.etaToCurrentLegMinutes ? (
              <p>{tracking.etaToCurrentLegMinutes} min to this stop</p>
            ) : null}
          </div>
        ) : null}
      </div>

      <p className="arrival-tracking__message">{tracking.message}</p>
    </section>
  );
}
