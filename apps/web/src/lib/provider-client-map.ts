import type { GeoPoint } from "@yardmatch/contracts";

export function hasMapPoint(point: GeoPoint | undefined): point is GeoPoint {
  return Boolean(point && Number.isFinite(point.latitude) && Number.isFinite(point.longitude) &&
    Math.abs(point.latitude) <= 85.05112878 && Math.abs(point.longitude) <= 180 &&
    (point.latitude !== 0 || point.longitude !== 0));
}
