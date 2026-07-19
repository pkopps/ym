import { Booking, BookingArrivalTracking } from "@yardmatch/contracts";
import { I18nInstance } from "@yardmatch/i18n";

export function findTrackableBooking(bookings: Booking[]) {
  return bookings
    .filter(
      (booking) =>
        Boolean(booking.onRouteConfirmedAt) &&
        (booking.status === "confirmed" || booking.status === "in-progress")
    )
    .sort((left, right) => left.scheduledStartIso.localeCompare(right.scheduledStartIso))[0];
}

export function parseTrackingBookingId(actionHref?: string) {
  if (!actionHref) {
    return undefined;
  }

  const match = actionHref.match(/[?&]bookingId=([^&]+)/);
  return match ? decodeURIComponent(match[1]) : undefined;
}

export function buildTrackingSummary(i18n: I18nInstance, tracking: BookingArrivalTracking) {
  if (tracking.status === "arrived" || tracking.status === "completed") {
    return i18n.t("mobile.tracking.summary.at_property");
  }

  if (typeof tracking.etaMinutes === "number" && tracking.etaMinutes > 0) {
    return i18n.t("mobile.tracking.summary.minutes_away", { count: tracking.etaMinutes });
  }

  return i18n.t("mobile.tracking.summary.crew_on_way");
}

export function buildTrackingDetail(i18n: I18nInstance, tracking: BookingArrivalTracking) {
  const pieces: string[] = [];

  if (typeof tracking.remainingDistanceMiles === "number" && tracking.remainingDistanceMiles > 0) {
    pieces.push(i18n.t("mobile.tracking.detail.miles_left", { count: tracking.remainingDistanceMiles }));
  }

  if (tracking.status === "on-route") {
    pieces.push(i18n.t("mobile.tracking.detail.route_covered", { percent: tracking.progressPercent }));
  }

  if (tracking.source === "provider-device") {
    pieces.push(
      tracking.isLiveLocationStale
        ? i18n.t("mobile.tracking.detail.provider_paused")
        : tracking.liveUpdatedAt
          ? i18n.t("mobile.tracking.detail.provider_updated", {
              time: i18n.formatDate(tracking.liveUpdatedAt, { timeStyle: "short" })
            })
          : i18n.t("mobile.tracking.detail.provider_live")
    );
  } else if (tracking.source === "crew-device") {
    pieces.push(
      tracking.isLiveLocationStale
        ? i18n.t("mobile.tracking.detail.crew_paused")
        : tracking.liveUpdatedAt
          ? i18n.t("mobile.tracking.detail.crew_updated", {
              time: i18n.formatDate(tracking.liveUpdatedAt, { timeStyle: "short" })
            })
          : i18n.t("mobile.tracking.detail.crew_live")
    );
  } else {
    pieces.push(i18n.t("mobile.tracking.detail.estimated_route"));
  }

  return pieces.join(i18n.t("mobile.tracking.detail_separator"));
}

export function buildTrackingMapImageUrl(tracking: BookingArrivalTracking) {
  const currentPoint = tracking.currentPoint ?? tracking.routeStartPoint ?? tracking.destination.point;
  const destinationPoint = tracking.destination.point;
  const markers = [
    `${currentPoint.latitude},${currentPoint.longitude},lightblue1`,
    `${destinationPoint.latitude},${destinationPoint.longitude},red-pushpin`
  ].join("|");

  return `https://staticmap.openstreetmap.de/staticmap.php?size=900x900&maptype=mapnik&markers=${encodeURIComponent(markers)}`;
}

export function buildTrackingDirectionsUrl(tracking: BookingArrivalTracking) {
  const destination = `${tracking.destination.point.latitude},${tracking.destination.point.longitude}`;
  return `http://maps.apple.com/?daddr=${encodeURIComponent(destination)}&dirflg=d`;
}
