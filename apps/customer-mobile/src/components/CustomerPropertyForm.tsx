import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { BrandTokens } from "@yardmatch/branding";
import { CreateCustomerPropertyRequest, PlaceSuggestion } from "@yardmatch/contracts";
import { createCustomerMobileApiClient } from "../lib/api";

function buildEstimatedPoint(state: string, postalCode: string) {
  const normalizedState = state.trim().toUpperCase();
  const stateSignal =
    normalizedState.split("").reduce((sum, character) => sum + character.charCodeAt(0), 0) % 40;
  const zipDigits = Number(postalCode.replace(/\D/g, "").slice(0, 5) || "10001");

  return {
    latitude: Number((25 + stateSignal * 0.5 + (zipDigits % 90) * 0.02).toFixed(5)),
    longitude: Number((-124 + stateSignal * 0.6 + (zipDigits % 120) * 0.03).toFixed(5))
  };
}

export function CustomerPropertyForm({
  isWorking,
  onSubmit,
  submitLabel = "Save property"
}: {
  isWorking?: boolean;
  onSubmit: (payload: CreateCustomerPropertyRequest) => Promise<void>;
  submitLabel?: string;
}) {
  const [label, setLabel] = useState("");
  const [line1, setLine1] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [setAsDefault, setSetAsDefault] = useState(true);
  const [selectedSuggestion, setSelectedSuggestion] = useState<PlaceSuggestion | undefined>();
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const canSubmit =
    label.trim().length > 0 &&
    line1.trim().length > 0 &&
    city.trim().length > 0 &&
    state.trim().length > 0 &&
    postalCode.trim().length > 0;

  useEffect(() => {
    if (locationQuery.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    const timeoutId = setTimeout(() => {
      setIsSearching(true);
      createCustomerMobileApiClient()
        .searchPlaces(locationQuery)
        .then((response) => setSuggestions(response.suggestions))
        .catch(() => setSuggestions([]))
        .finally(() => setIsSearching(false));
    }, 220);

    return () => clearTimeout(timeoutId);
  }, [locationQuery]);

  async function handleSubmit() {
    if (!canSubmit) {
      return;
    }

    await onSubmit({
      label: label.trim(),
      address: {
        line1: line1.trim(),
        city: city.trim(),
        state: state.trim().toUpperCase(),
        postalCode: postalCode.trim(),
        country: "US",
        point:
          selectedSuggestion &&
          selectedSuggestion.address.city.toLowerCase() === city.trim().toLowerCase() &&
          selectedSuggestion.address.state.toLowerCase() === state.trim().toLowerCase() &&
          selectedSuggestion.address.postalCode === postalCode.trim()
            ? selectedSuggestion.address.point
            : buildEstimatedPoint(state, postalCode)
      },
      setAsDefault
    });

    setLabel("");
    setLine1("");
    setCity("");
    setState("");
    setPostalCode("");
    setLocationQuery("");
    setSelectedSuggestion(undefined);
    setSuggestions([]);
  }

  return (
    <View style={styles.stack}>
      <TextInput
        autoCapitalize="words"
        onChangeText={(value) => {
          setLocationQuery(value);
          setSelectedSuggestion(undefined);
        }}
        placeholder="Search city or town"
        placeholderTextColor={BrandTokens.colors.muted}
        style={styles.input}
        value={locationQuery}
      />
      {suggestions.length > 0 ? (
        <View style={styles.suggestionStack}>
          {suggestions.map((suggestion) => (
            <Pressable
              key={suggestion.id}
              onPress={() => {
                setLocationQuery(suggestion.label);
                setCity(suggestion.address.city);
                setState(suggestion.address.state);
                setPostalCode(suggestion.address.postalCode);
                setSelectedSuggestion(suggestion);
                setSuggestions([]);
              }}
              style={styles.suggestionRow}
            >
              <Text style={styles.suggestionTitle}>{suggestion.label}</Text>
              <Text style={styles.suggestionMeta}>
                {suggestion.source === "google-geocoding" ? "Google" : "Suggested area"}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : locationQuery.trim().length >= 2 && isSearching ? (
        <Text style={styles.searchingLabel}>Searching areas…</Text>
      ) : null}
      <TextInput
        autoCapitalize="words"
        onChangeText={setLabel}
        placeholder="Home, rental, or office"
        placeholderTextColor={BrandTokens.colors.muted}
        style={styles.input}
        value={label}
      />
      <TextInput
        autoCapitalize="words"
        onChangeText={setLine1}
        placeholder="Street address"
        placeholderTextColor={BrandTokens.colors.muted}
        style={styles.input}
        value={line1}
      />
      <View style={styles.inlineRow}>
        <TextInput
          autoCapitalize="words"
          onChangeText={setCity}
          placeholder="City"
          placeholderTextColor={BrandTokens.colors.muted}
          style={[styles.input, styles.inlineInput]}
          value={city}
        />
        <TextInput
          autoCapitalize="characters"
          maxLength={2}
          onChangeText={setState}
          placeholder="ST"
          placeholderTextColor={BrandTokens.colors.muted}
          style={[styles.input, styles.stateInput]}
          value={state}
        />
        <TextInput
          keyboardType="number-pad"
          maxLength={10}
          onChangeText={setPostalCode}
          placeholder="ZIP"
          placeholderTextColor={BrandTokens.colors.muted}
          style={[styles.input, styles.zipInput]}
          value={postalCode}
        />
      </View>
      <Pressable
        onPress={() => setSetAsDefault((current) => !current)}
        style={[styles.toggleButton, setAsDefault && styles.toggleButtonActive]}
      >
        <Text style={[styles.toggleButtonLabel, setAsDefault && styles.toggleButtonLabelActive]}>
          {setAsDefault ? "Default property" : "Keep current default"}
        </Text>
      </Pressable>
      <Pressable
        disabled={isWorking || !canSubmit}
        onPress={() => void handleSubmit()}
        style={[styles.submitButton, (!canSubmit || isWorking) && styles.submitButtonDisabled]}
      >
        <Text style={styles.submitButtonLabel}>{isWorking ? "Saving..." : submitLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: BrandTokens.spacing.sm
  },
  input: {
    borderRadius: BrandTokens.radius.sm,
    borderWidth: 1,
    borderColor: BrandTokens.colors.border,
    backgroundColor: "rgba(255,255,255,0.96)",
    color: BrandTokens.colors.ink,
    paddingHorizontal: BrandTokens.spacing.md,
    paddingVertical: BrandTokens.spacing.md
  },
  inlineRow: {
    flexDirection: "row",
    gap: BrandTokens.spacing.sm
  },
  suggestionStack: {
    gap: BrandTokens.spacing.xs
  },
  suggestionRow: {
    borderRadius: BrandTokens.radius.sm,
    borderWidth: 1,
    borderColor: BrandTokens.colors.border,
    backgroundColor: "rgba(255,255,255,0.96)",
    paddingHorizontal: BrandTokens.spacing.md,
    paddingVertical: BrandTokens.spacing.sm,
    gap: BrandTokens.spacing.xs
  },
  suggestionTitle: {
    color: BrandTokens.colors.ink,
    fontWeight: "700"
  },
  suggestionMeta: {
    color: BrandTokens.colors.inkSoft,
    fontSize: 12
  },
  searchingLabel: {
    color: BrandTokens.colors.inkSoft
  },
  inlineInput: {
    flex: 1
  },
  stateInput: {
    width: 72
  },
  zipInput: {
    width: 92
  },
  toggleButton: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BrandTokens.colors.border,
    backgroundColor: "rgba(255,255,255,0.94)",
    paddingHorizontal: BrandTokens.spacing.md,
    paddingVertical: BrandTokens.spacing.sm
  },
  toggleButtonActive: {
    backgroundColor: BrandTokens.colors.primary,
    borderColor: BrandTokens.colors.primary
  },
  toggleButtonLabel: {
    color: BrandTokens.colors.primaryStrong,
    fontWeight: "700"
  },
  toggleButtonLabelActive: {
    color: "#ffffff"
  },
  submitButton: {
    alignItems: "center",
    borderRadius: 999,
    backgroundColor: BrandTokens.colors.primary,
    paddingVertical: BrandTokens.spacing.md
  },
  submitButtonDisabled: {
    opacity: 0.5
  },
  submitButtonLabel: {
    color: "#ffffff",
    fontWeight: "700"
  }
});
