import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { BrandTokens } from "@yardmatch/branding";
import { CreateCustomerPropertyRequest, PlaceSuggestion } from "@yardmatch/contracts";
import { useI18n } from "@yardmatch/i18n/react";
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
  submitLabel
}: {
  isWorking?: boolean;
  onSubmit: (payload: CreateCustomerPropertyRequest) => Promise<void>;
  submitLabel?: string;
}) {
  const i18n = useI18n();
  const [label, setLabel] = useState("");
  const [line1, setLine1] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [setAsDefault, setSetAsDefault] = useState(true);
  const [selectedSuggestion, setSelectedSuggestion] = useState<PlaceSuggestion | undefined>();
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [searchMessage, setSearchMessage] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [step, setStep] = useState<"address" | "details">("address");

  const canContinueAddress =
    line1.trim().length > 0 &&
    city.trim().length > 0 &&
    state.trim().length > 0 &&
    postalCode.trim().length > 0;
  const canSubmit =
    label.trim().length > 0 &&
    canContinueAddress;

  useEffect(() => {
    if (locationQuery.trim().length < 2) {
      setSuggestions([]);
      setSearchMessage("");
      return;
    }

    const timeoutId = setTimeout(() => {
      setIsSearching(true);
      createCustomerMobileApiClient()
        .searchPlaces(locationQuery)
        .then((response) => {
          setSuggestions(response.suggestions);
          setSearchMessage(response.searchMessage ?? "");
        })
        .catch(() => {
          setSuggestions([]);
          setSearchMessage("");
        })
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
    setStep("address");
  }

  return (
    <View style={styles.stack}>
      <View style={styles.stepPath}>
        <View style={[styles.stepItem, step === "address" && styles.stepItemActive]}>
          <Text style={[styles.stepLabel, step === "address" && styles.stepLabelActive]}>
            {i18n.t("mobile.property.step.address")}
          </Text>
          <Text style={styles.stepMeta}>
            {canContinueAddress ? i18n.t("mobile.property.step.ready") : i18n.t("mobile.property.step.now")}
          </Text>
        </View>
        <View style={[styles.stepItem, step === "details" && styles.stepItemActive]}>
          <Text style={[styles.stepLabel, step === "details" && styles.stepLabelActive]}>
            {i18n.t("mobile.property.step.details")}
          </Text>
          <Text style={styles.stepMeta}>
            {step === "details"
              ? canSubmit
                ? i18n.t("mobile.property.step.ready")
                : i18n.t("mobile.property.step.now")
              : i18n.t("mobile.property.step.next")}
          </Text>
        </View>
      </View>

      {step === "address" ? (
        <>
          <TextInput
            autoCapitalize="words"
            onChangeText={(value) => {
              setLocationQuery(value);
              setSelectedSuggestion(undefined);
            }}
            placeholder={i18n.t("mobile.property.search_city")}
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
                    {suggestion.matchReason ??
                      (suggestion.source === "google-geocoding"
                        ? i18n.t("mobile.property.google_verified_area")
                        : i18n.t("mobile.property.suggested_area"))}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : locationQuery.trim().length >= 2 && isSearching ? (
            <Text style={styles.searchingLabel}>{i18n.t("mobile.property.searching_areas")}</Text>
          ) : locationQuery.trim().length >= 2 && searchMessage ? (
            <Text style={styles.searchingLabel}>{searchMessage}</Text>
          ) : null}
          <TextInput
            autoCapitalize="words"
            onChangeText={setLine1}
            placeholder={i18n.t("mobile.property.street_address")}
            placeholderTextColor={BrandTokens.colors.muted}
            style={styles.input}
            value={line1}
          />
          <View style={styles.inlineRow}>
            <TextInput
              autoCapitalize="words"
              onChangeText={setCity}
              placeholder={i18n.t("mobile.property.city")}
              placeholderTextColor={BrandTokens.colors.muted}
              style={[styles.input, styles.inlineInput]}
              value={city}
            />
            <TextInput
              autoCapitalize="characters"
              maxLength={2}
              onChangeText={setState}
              placeholder={i18n.t("mobile.property.state_abbr")}
              placeholderTextColor={BrandTokens.colors.muted}
              style={[styles.input, styles.stateInput]}
              value={state}
            />
            <TextInput
              keyboardType="number-pad"
              maxLength={10}
              onChangeText={setPostalCode}
              placeholder={i18n.t("mobile.property.zip")}
              placeholderTextColor={BrandTokens.colors.muted}
              style={[styles.input, styles.zipInput]}
              value={postalCode}
            />
          </View>
          <Pressable
            disabled={!canContinueAddress}
            onPress={() => setStep("details")}
            style={[styles.submitButton, !canContinueAddress && styles.submitButtonDisabled]}
          >
            <Text style={styles.submitButtonLabel}>{i18n.t("mobile.property.continue")}</Text>
          </Pressable>
        </>
      ) : (
        <>
          <View style={styles.summaryCard}>
            <View style={styles.summaryCopy}>
              <Text style={styles.summaryTitle}>{line1}</Text>
              <Text style={styles.summaryMeta}>
                {city}, {state.toUpperCase()} {postalCode}
              </Text>
            </View>
            <Pressable onPress={() => setStep("address")} style={styles.linkButton}>
              <Text style={styles.linkButtonLabel}>{i18n.t("common.actions.edit")}</Text>
            </Pressable>
          </View>
          <TextInput
            autoCapitalize="words"
            onChangeText={setLabel}
            placeholder={i18n.t("mobile.property.label_placeholder")}
            placeholderTextColor={BrandTokens.colors.muted}
            style={styles.input}
            value={label}
          />
          <Pressable
            onPress={() => setSetAsDefault((current) => !current)}
            style={[styles.toggleButton, setAsDefault && styles.toggleButtonActive]}
          >
            <Text style={[styles.toggleButtonLabel, setAsDefault && styles.toggleButtonLabelActive]}>
              {setAsDefault ? i18n.t("mobile.property.default_property") : i18n.t("mobile.property.keep_current_default")}
            </Text>
          </Pressable>
          <Pressable
            disabled={isWorking || !canSubmit}
            onPress={() => void handleSubmit()}
            style={[styles.submitButton, (!canSubmit || isWorking) && styles.submitButtonDisabled]}
          >
            <Text style={styles.submitButtonLabel}>
              {isWorking ? i18n.t("common.loading.saving") : submitLabel ?? i18n.t("mobile.book.save_property")}
            </Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: BrandTokens.spacing.sm
  },
  stepPath: {
    flexDirection: "row",
    gap: BrandTokens.spacing.sm
  },
  stepItem: {
    flex: 1,
    borderRadius: BrandTokens.radius.sm,
    borderWidth: 1,
    borderColor: BrandTokens.colors.border,
    backgroundColor: "rgba(255,255,255,0.9)",
    gap: 2,
    paddingHorizontal: BrandTokens.spacing.md,
    paddingVertical: BrandTokens.spacing.sm
  },
  stepItemActive: {
    borderColor: "rgba(47, 125, 76, 0.36)",
    backgroundColor: BrandTokens.colors.surfaceStrong
  },
  stepLabel: {
    color: BrandTokens.colors.ink,
    fontSize: 13,
    fontWeight: "800"
  },
  stepLabelActive: {
    color: BrandTokens.colors.primaryStrong
  },
  stepMeta: {
    color: BrandTokens.colors.inkSoft,
    fontSize: 12,
    fontWeight: "700"
  },
  summaryCard: {
    alignItems: "center",
    borderRadius: BrandTokens.radius.sm,
    backgroundColor: BrandTokens.colors.surfaceStrong,
    flexDirection: "row",
    gap: BrandTokens.spacing.md,
    justifyContent: "space-between",
    padding: BrandTokens.spacing.md
  },
  summaryCopy: {
    flex: 1,
    gap: 2
  },
  summaryTitle: {
    color: BrandTokens.colors.ink,
    fontWeight: "800"
  },
  summaryMeta: {
    color: BrandTokens.colors.inkSoft,
    lineHeight: 20
  },
  linkButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BrandTokens.colors.primary,
    paddingHorizontal: BrandTokens.spacing.md,
    paddingVertical: BrandTokens.spacing.xs
  },
  linkButtonLabel: {
    color: BrandTokens.colors.primaryStrong,
    fontWeight: "700"
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
