import type { Address, Booking, SearchProvidersRequest } from "@yardmatch/contracts";

export interface ProviderSearchQuery {
  categories: SearchProvidersRequest["categories"];
  address: Address;
  cursorId?: string;
}

/** Conservative spherical bounding box for the largest supported service radius. */
export function searchBounds(address: Address) {
  const { latitude, longitude } = address.point;
  const angular = 60 / 3958.7613;
  const latitudeDelta = angular * 180 / Math.PI;
  const reachesPole = Math.abs(latitude) + latitudeDelta >= 90;
  const longitudeDelta = reachesPole ? 180 : Math.asin(Math.sin(angular) / Math.cos(latitude * Math.PI / 180)) * 180 / Math.PI;
  const wrap = (value: number) => ((value + 540) % 360) - 180;
  return { south: Math.max(-90, latitude - latitudeDelta), north: Math.min(90, latitude + latitudeDelta),
    west: reachesPole ? -180 : wrap(longitude - longitudeDelta), east: reachesPole ? 180 : wrap(longitude + longitudeDelta) };
}

export interface ProviderBookingMetrics {
  providerId: string;
  total: number;
  open: number;
  completed: number;
  nearbyCompleted: number;
  disputed: number;
  refunded: number;
  exceptions: number;
  nonRequestedActive: number;
  late: number;
}

export function bookingMetrics(providerId: string, bookings: Booking[], address: Address): ProviderBookingMetrics {
  const result: ProviderBookingMetrics = { providerId, total: 0, open: 0, completed: 0, nearbyCompleted: 0, disputed: 0, refunded: 0, exceptions: 0, nonRequestedActive: 0, late: 0 };
  for (const booking of bookings) {
    if (booking.providerId !== providerId) continue;
    result.total++;
    if (!["completed", "cancelled", "refunded"].includes(booking.status)) result.open++;
    if (booking.status === "completed") {
      result.completed++;
      if (booking.serviceAddress.city === address.city && booking.serviceAddress.state === address.state) result.nearbyCompleted++;
    }
    if (booking.status === "disputed") result.disputed++;
    if (booking.status === "refunded") result.refunded++;
    if (booking.activeExceptionType) result.exceptions++;
    if (booking.status !== "requested" && booking.status !== "cancelled") result.nonRequestedActive++;
    if (booking.lateNoticeSentAt) result.late++;
  }
  return result;
}
