import { Address, PlaceSearchResponse, PlaceSuggestion } from "@yardmatch/contracts";

type LocalPlaceSeed = {
  id: string;
  label: string;
  city: string;
  state: string;
  postalCode: string;
  latitude: number;
  longitude: number;
  aliases?: string[];
};

const stateNameToCode: Record<string, string> = {
  arizona: "az",
  california: "ca",
  colorado: "co",
  georgia: "ga",
  newjersey: "nj",
  "new jersey": "nj",
  newyork: "ny",
  "new york": "ny",
  northcarolina: "nc",
  "north carolina": "nc",
  tennessee: "tn",
  texas: "tx"
};

const localPlaceSeeds: LocalPlaceSeed[] = [
  { id: "brooklyn-ny", label: "Brooklyn, NY", city: "Brooklyn", state: "NY", postalCode: "11201", latitude: 40.6782, longitude: -73.9442, aliases: ["bklyn", "bk", "brooklyn ny", "new york city borough"] },
  { id: "queens-ny", label: "Queens, NY", city: "Queens", state: "NY", postalCode: "11101", latitude: 40.7282, longitude: -73.7949, aliases: ["queens ny", "new york city borough"] },
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
      return {
        query: trimmed,
        searchMode: "none",
        searchConfidence: "low",
        searchMessage: "Enter at least two characters to search for an area or address.",
        suggestions: []
      };
    }

    const googleSuggestions = await this.searchGoogle(trimmed);
    if (googleSuggestions.length > 0) {
      return {
        query: trimmed,
        searchMode: "google-geocoding",
        searchConfidence: "high",
        searchMessage: "Showing Google-verified address and area suggestions.",
        suggestions: googleSuggestions
      };
    }

    const localSuggestions = this.searchLocal(trimmed);
    const topMatchQuality = localSuggestions[0]?.matchQuality ?? "low";
    const searchConfidence =
      topMatchQuality === "high" ? "medium" : topMatchQuality === "medium" ? "low" : "low";

    return {
      query: trimmed,
      searchMode: localSuggestions.length > 0 ? "local-dataset" : "none",
      searchConfidence,
      searchMessage:
        localSuggestions.length > 0
          ? topMatchQuality === "high"
            ? "Showing the best local service-area matches while precise address geocoding is unavailable."
            : "Showing the closest local service-area guesses. A fuller city, ZIP, or street address can improve accuracy."
          : "No matching areas were found yet. Try a fuller city, ZIP, or street address.",
      suggestions: localSuggestions
    };
  }

  private searchLocal(query: string): PlaceSuggestion[] {
    const normalizedQuery = this.normalizeQuery(query);
    const queryTokens = this.expandQueryTokens(normalizedQuery);
    const postalQuery = normalizedQuery.replace(/\D/g, "");
    const stateQuery = this.extractStateQuery(queryTokens);

    return localPlaceSeeds
      .map((seed) => {
        const city = this.normalizeQuery(seed.city);
        const state = seed.state.toLowerCase();
        const postalCode = seed.postalCode.replace(/\D/g, "");
        const haystack = [
          this.normalizeQuery(seed.label),
          city,
          state,
          postalCode,
          ...(seed.aliases ?? []).map((alias) => this.normalizeQuery(alias))
        ].join(" ");
        const matchesAllTokens = queryTokens.every((token) => haystack.includes(token));
        const cityStateLabel = `${city} ${state}`;
        let score = matchesAllTokens ? 1 : 0;

        if (haystack.startsWith(normalizedQuery)) {
          score += 3;
        }
        if (city === normalizedQuery) {
          score += 5;
        }
        if (cityStateLabel === normalizedQuery) {
          score += 6;
        }
        if (postalQuery.length >= 3 && postalCode.startsWith(postalQuery)) {
          score += postalQuery.length >= 5 ? 8 : 5;
        }
        if (stateQuery && stateQuery === state) {
          score += 2;
        }
        if (queryTokens.some((token) => city.startsWith(token))) {
          score += 2;
        }
        if ((seed.aliases ?? []).some((alias) => this.normalizeQuery(alias) === normalizedQuery)) {
          score += 4;
        }

        return {
          seed,
          score
        };
      })
      .filter((candidate) => candidate.score > 0)
      .sort((left, right) => right.score - left.score || left.seed.label.localeCompare(right.seed.label))
      .slice(0, 8)
      .map((candidate) => this.toSuggestion(candidate.seed, "local-dataset", normalizedQuery, postalQuery));
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
    const streetNumber = this.findGoogleComponent(components, "street_number");
    const route = this.findGoogleComponent(components, "route");
    const city =
      this.findGoogleComponent(components, "locality") ??
      this.findGoogleComponent(components, "postal_town") ??
      this.findGoogleComponent(components, "administrative_area_level_3") ??
      "Unknown";
    const state = this.findGoogleComponent(components, "administrative_area_level_1", true) ?? "US";
    const postalCode = this.findGoogleComponent(components, "postal_code") ?? "00000";
    const country = this.findGoogleComponent(components, "country", true) ?? "US";
    const line1 = [streetNumber, route].filter(Boolean).join(" ") || city;
    const label = result.formatted_address.replace(/,\s*USA$/i, "");

    return {
      id: result.place_id ?? `google-${city}-${state}-${postalCode}`,
      label,
      source: "google-geocoding",
      matchQuality: "high",
      matchReason: "Google-verified address or area match",
      address: {
        line1,
        city,
        state,
        postalCode,
        country,
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

  private toSuggestion(
    seed: LocalPlaceSeed,
    source: "local-dataset",
    normalizedQuery: string,
    postalQuery: string
  ): PlaceSuggestion {
    const normalizedLabel = this.normalizeQuery(seed.label);
    const normalizedCity = this.normalizeQuery(seed.city);
    const normalizedAliases = (seed.aliases ?? []).map((alias) => this.normalizeQuery(alias));
    const cityStateLabel = `${normalizedCity} ${seed.state.toLowerCase()}`;
    const matchQuality =
      normalizedLabel === normalizedQuery ||
      normalizedCity === normalizedQuery ||
      cityStateLabel === normalizedQuery ||
      normalizedAliases.includes(normalizedQuery) ||
      (postalQuery.length >= 5 && seed.postalCode.startsWith(postalQuery))
        ? "high"
        : normalizedLabel.startsWith(normalizedQuery) || normalizedCity.startsWith(normalizedQuery)
          ? "medium"
          : "low";
    const matchReason =
      normalizedAliases.includes(normalizedQuery)
        ? "Matched a known local area alias"
        : postalQuery.length >= 5 && seed.postalCode.startsWith(postalQuery)
          ? "Matched the ZIP code"
          : normalizedCity === normalizedQuery
            ? "Matched the city directly"
            : cityStateLabel === normalizedQuery
              ? "Matched the city and state"
              : normalizedLabel.startsWith(normalizedQuery) || normalizedCity.startsWith(normalizedQuery)
                ? "Closest local service-area match"
                : "Nearby local service-area guess";

    return {
      id: seed.id,
      label: seed.label,
      source,
      matchQuality,
      matchReason,
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

  private normalizeQuery(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/\./g, "")
      .replace(/\s+/g, " ");
  }

  private expandQueryTokens(normalizedQuery: string): string[] {
    const tokens = normalizedQuery.split(/[\s,]+/).filter(Boolean);
    const expanded = new Set(tokens);

    for (const token of tokens) {
      if (stateNameToCode[token]) {
        expanded.add(stateNameToCode[token]);
      }
    }

    for (const [stateName, stateCode] of Object.entries(stateNameToCode)) {
      if (normalizedQuery.includes(stateName)) {
        expanded.add(stateCode);
      }
    }

    return [...expanded];
  }

  private extractStateQuery(tokens: string[]): string | undefined {
    return tokens.find((token) => token.length === 2 && Object.values(stateNameToCode).includes(token));
  }
}
