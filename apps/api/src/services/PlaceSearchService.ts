import { Address, PlaceSearchResponse, PlaceSuggestion } from "@yardmatch/contracts";

type LocalPlaceSeed = {
  id: string;
  label: string;
  city: string;
  state: string;
  postalCode: string;
  latitude: number;
  longitude: number;
};

const localPlaceSeeds: LocalPlaceSeed[] = [
  { id: "brooklyn-ny", label: "Brooklyn, NY", city: "Brooklyn", state: "NY", postalCode: "11201", latitude: 40.6782, longitude: -73.9442 },
  { id: "queens-ny", label: "Queens, NY", city: "Queens", state: "NY", postalCode: "11101", latitude: 40.7282, longitude: -73.7949 },
  { id: "jersey-city-nj", label: "Jersey City, NJ", city: "Jersey City", state: "NJ", postalCode: "07302", latitude: 40.7178, longitude: -74.0431 },
  { id: "hoboken-nj", label: "Hoboken, NJ", city: "Hoboken", state: "NJ", postalCode: "07030", latitude: 40.7433, longitude: -74.0324 },
  { id: "newark-nj", label: "Newark, NJ", city: "Newark", state: "NJ", postalCode: "07102", latitude: 40.7357, longitude: -74.1724 },
  { id: "nashville-tn", label: "Nashville, TN", city: "Nashville", state: "TN", postalCode: "37203", latitude: 36.1627, longitude: -86.7816 },
  { id: "franklin-tn", label: "Franklin, TN", city: "Franklin", state: "TN", postalCode: "37064", latitude: 35.9251, longitude: -86.8689 },
  { id: "brentwood-tn", label: "Brentwood, TN", city: "Brentwood", state: "TN", postalCode: "37027", latitude: 36.0331, longitude: -86.7828 },
  { id: "austin-tx", label: "Austin, TX", city: "Austin", state: "TX", postalCode: "78701", latitude: 30.2672, longitude: -97.7431 },
  { id: "round-rock-tx", label: "Round Rock, TX", city: "Round Rock", state: "TX", postalCode: "78664", latitude: 30.5083, longitude: -97.6789 },
  { id: "atlanta-ga", label: "Atlanta, GA", city: "Atlanta", state: "GA", postalCode: "30303", latitude: 33.749, longitude: -84.388 },
  { id: "charlotte-nc", label: "Charlotte, NC", city: "Charlotte", state: "NC", postalCode: "28202", latitude: 35.2271, longitude: -80.8431 },
  { id: "denver-co", label: "Denver, CO", city: "Denver", state: "CO", postalCode: "80202", latitude: 39.7392, longitude: -104.9903 },
  { id: "scottsdale-az", label: "Scottsdale, AZ", city: "Scottsdale", state: "AZ", postalCode: "85251", latitude: 33.4942, longitude: -111.9261 },
  { id: "san-diego-ca", label: "San Diego, CA", city: "San Diego", state: "CA", postalCode: "92101", latitude: 32.7157, longitude: -117.1611 }
];

export class PlaceSearchService {
  public constructor(private readonly googleMapsApiKey?: string) {}

  public async search(query: string): Promise<PlaceSearchResponse> {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      return { suggestions: [] };
    }

    const googleSuggestions = await this.searchGoogle(trimmed);
    if (googleSuggestions.length > 0) {
      return { suggestions: googleSuggestions };
    }

    return {
      suggestions: this.searchLocal(trimmed)
    };
  }

  private searchLocal(query: string): PlaceSuggestion[] {
    const normalizedQuery = query.trim().toLowerCase();
    const queryTokens = normalizedQuery.split(/[\s,]+/).filter(Boolean);

    return localPlaceSeeds
      .map((seed) => {
        const haystack = `${seed.label} ${seed.city} ${seed.state} ${seed.postalCode}`.toLowerCase();
        const matchesAllTokens = queryTokens.every((token) => haystack.includes(token));
        const prefixBoost = haystack.startsWith(normalizedQuery) ? 2 : 0;
        const exactCityBoost = seed.city.toLowerCase() === normalizedQuery ? 3 : 0;
        return {
          seed,
          score: matchesAllTokens ? 1 + prefixBoost + exactCityBoost : 0
        };
      })
      .filter((candidate) => candidate.score > 0)
      .sort((left, right) => right.score - left.score || left.seed.label.localeCompare(right.seed.label))
      .slice(0, 8)
      .map((candidate) => this.toSuggestion(candidate.seed, "local-dataset"));
  }

  private async searchGoogle(query: string): Promise<PlaceSuggestion[]> {
    if (!this.googleMapsApiKey) {
      return [];
    }

    try {
      const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
      url.searchParams.set("address", query);
      url.searchParams.set("components", "country:US");
      url.searchParams.set("key", this.googleMapsApiKey);

      const response = await fetch(url.toString());
      if (!response.ok) {
        return [];
      }

      const payload = (await response.json()) as {
        results?: Array<{
          formatted_address: string;
          geometry?: { location?: { lat: number; lng: number } };
          place_id?: string;
          address_components?: Array<{ long_name: string; short_name: string; types: string[] }>;
        }>;
      };

      return (payload.results ?? [])
        .map((result) => this.fromGoogleResult(result))
        .filter((suggestion): suggestion is PlaceSuggestion => Boolean(suggestion))
        .slice(0, 8);
    } catch {
      return [];
    }
  }

  private fromGoogleResult(result: {
    formatted_address: string;
    geometry?: { location?: { lat: number; lng: number } };
    place_id?: string;
    address_components?: Array<{ long_name: string; short_name: string; types: string[] }>;
  }): PlaceSuggestion | undefined {
    const location = result.geometry?.location;
    if (!location) {
      return undefined;
    }

    const components = result.address_components ?? [];
    const city =
      this.findGoogleComponent(components, "locality") ??
      this.findGoogleComponent(components, "postal_town") ??
      this.findGoogleComponent(components, "administrative_area_level_3") ??
      "Unknown";
    const state = this.findGoogleComponent(components, "administrative_area_level_1", true) ?? "US";
    const postalCode = this.findGoogleComponent(components, "postal_code") ?? "00000";

    return {
      id: result.place_id ?? `google-${city}-${state}-${postalCode}`,
      label: result.formatted_address,
      source: "google-geocoding",
      address: {
        line1: result.formatted_address,
        city,
        state,
        postalCode,
        country: "US",
        point: {
          latitude: location.lat,
          longitude: location.lng
        }
      }
    };
  }

  private findGoogleComponent(
    components: Array<{ long_name: string; short_name: string; types: string[] }>,
    type: string,
    useShortName = false
  ) {
    const component = components.find((item) => item.types.includes(type));
    if (!component) {
      return undefined;
    }

    return useShortName ? component.short_name : component.long_name;
  }

  private toSuggestion(seed: LocalPlaceSeed, source: "local-dataset"): PlaceSuggestion {
    return {
      id: seed.id,
      label: seed.label,
      source,
      address: {
        line1: seed.label,
        city: seed.city,
        state: seed.state,
        postalCode: seed.postalCode,
        country: "US",
        point: {
          latitude: seed.latitude,
          longitude: seed.longitude
        }
      }
    };
  }
}
