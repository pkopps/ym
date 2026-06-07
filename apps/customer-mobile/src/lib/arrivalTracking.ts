import { Booking, BookingArrivalTracking } from "@yardmatch/contracts";

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

export function buildTrackingSummary(tracking: BookingArrivalTracking) {
  if (tracking.status === "arrived" || tracking.status === "completed") {
    return "At the property";
  }

  if (typeof tracking.etaMinutes === "number" && tracking.etaMinutes > 0) {
    return `${tracking.etaMinutes} min away`;
  }

  return "Crew on the way";
}

export function buildTrackingDetail(tracking: BookingArrivalTracking) {
  const pieces: string[] = [];

  if (typeof tracking.remainingDistanceMiles === "number" && tracking.remainingDistanceMiles > 0) {
    pieces.push(`${tracking.remainingDistanceMiles.toFixed(1)} miles left`);
  }

  if (tracking.status === "on-route") {
    pieces.push(`${tracking.progressPercent}% of route covered`);
  }

  return pieces.join(" • ");
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
