import type { Rng } from "./random.mts";

export interface Zone {
  postalCode: string;
  city: string;
  latitude: number;
  longitude: number;
  /** Share of owners who live here. */
  weight: number;
}

/**
 * A synthetic market shaped like Barnegat, NJ and its neighbors. Centers are approximate town centers; bots place
 * properties and providers within a couple of miles of them. Long Beach Island (08008) sits across the bay, which is
 * close as the crow flies but a long drive, so it is a likely dead zone.
 */
export const BARNEGAT_MARKET: Zone[] = [
  { postalCode: "08005", city: "Barnegat", latitude: 39.7529, longitude: -74.2229, weight: 30 },
  { postalCode: "08050", city: "Manahawkin", latitude: 39.6954, longitude: -74.2587, weight: 18 },
  { postalCode: "08758", city: "Waretown", latitude: 39.7915, longitude: -74.1951, weight: 12 },
  { postalCode: "08731", city: "Forked River", latitude: 39.8398, longitude: -74.1907, weight: 12 },
  { postalCode: "08734", city: "Lanoka Harbor", latitude: 39.864, longitude: -74.1646, weight: 6 },
  { postalCode: "08092", city: "West Creek", latitude: 39.6326, longitude: -74.3087, weight: 5 },
  { postalCode: "08087", city: "Tuckerton", latitude: 39.6032, longitude: -74.3404, weight: 6 },
  { postalCode: "08008", city: "Beach Haven", latitude: 39.6276, longitude: -74.1979, weight: 5 },
  { postalCode: "08721", city: "Bayville", latitude: 39.9093, longitude: -74.1543, weight: 3 },
  { postalCode: "08753", city: "Toms River", latitude: 39.9537, longitude: -74.1979, weight: 3 }
];

const STREETS = ["Bay Ave", "Main St", "Route 9", "West Bay Ave", "Lighthouse Dr", "Pine St", "Brook Rd", "Cedar Run Rd",
  "Oak Ln", "Sandpiper Dr", "Heron Way", "Marsh Elder Ave", "Taylor Ln", "Gunning River Rd", "Lakeside Dr"];

export interface BotAddress {
  line1: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  point: { latitude: number; longitude: number };
}

export function pickZone(rng: Rng, zones: Zone[] = BARNEGAT_MARKET): Zone {
  const total = zones.reduce((sum, zone) => sum + zone.weight, 0);
  let roll = rng.next() * total;
  for (const zone of zones) {
    roll -= zone.weight;
    if (roll <= 0) return zone;
  }
  return zones[0]!;
}

/** A street address within about `radiusMiles` of the zone center. */
export function addressIn(rng: Rng, zone: Zone, radiusMiles = 1.5): BotAddress {
  const angle = rng.next() * 2 * Math.PI, miles = Math.sqrt(rng.next()) * radiusMiles;
  const latitude = zone.latitude + (miles / 69) * Math.sin(angle);
  const longitude = zone.longitude + (miles / (69 * Math.cos((zone.latitude * Math.PI) / 180))) * Math.cos(angle);
  return {
    line1: `${rng.int(1, 899)} ${rng.pick(STREETS)}`,
    city: zone.city,
    state: "NJ",
    postalCode: zone.postalCode,
    country: "US",
    point: { latitude: Number(latitude.toFixed(5)), longitude: Number(longitude.toFixed(5)) }
  };
}

export function distanceMiles(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180, earth = 3958.8;
  const dLat = toRad(b.latitude - a.latitude), dLon = toRad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * earth * Math.asin(Math.sqrt(h));
}

/** Lawn sizes spread across the three finder-fee tiers. */
export function lawnSize(rng: Rng): number {
  const roll = rng.next();
  if (roll < 0.55) return rng.int(2_000, 5_999);
  if (roll < 0.85) return rng.int(6_000, 11_999);
  return rng.int(12_000, 30_000);
}
