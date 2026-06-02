import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BrandTokens } from "@yardmatch/branding";
import { ProviderProfile } from "@yardmatch/contracts";
import { InfoCard } from "../components/InfoCard";
import { ScreenShell } from "../components/ScreenShell";
import { createProviderMobileApiClient } from "../lib/api";
import { useProviderSession } from "../session/ProviderSessionContext";

export function SupportScreen() {
  const { envelope, signOut } = useProviderSession();
  const [provider, setProvider] = useState<ProviderProfile | undefined>();
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isWorking, setIsWorking] = useState(false);

  async function loadProvider() {
    if (!envelope?.session.token) {
      return;
    }

    try {
      const api = createProviderMobileApiClient();
      api.setAuthToken(envelope.session.token);
      const me = await api.getCurrentUser();
      setProvider(me.user as ProviderProfile);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load settings.");
    }
  }

  useEffect(() => {
    void loadProvider();
  }, [envelope?.session.token]);

  async function saveSettings(updates: Partial<Pick<ProviderProfile, "serviceRadiusMiles" | "staffingMode">>) {
    if (!envelope?.session.token || !provider) {
      return;
    }

    try {
      setIsWorking(true);
      setErrorMessage("");
      const api = createProviderMobileApiClient();
      api.setAuthToken(envelope.session.token);
      const nextProvider = await api.updateProviderSettings({
        serviceRadiusMiles: updates.serviceRadiusMiles ?? provider.serviceRadiusMiles,
        staffingMode: updates.staffingMode ?? provider.staffingMode,
        sponsoredListingEnabled: provider.sponsoredListingEnabled
      });
      setProvider(nextProvider);
      setStatusMessage("Settings updated.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update settings.");
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <ScreenShell eyebrow="Account" title="Settings and payouts">
      {statusMessage ? <InfoCard title="Updated" description={statusMessage} /> : null}
      {errorMessage ? <InfoCard title="Needs attention" description={errorMessage} /> : null}

      <InfoCard title="Service radius" description="Measured from customer property addresses">
        <View style={styles.stepRow}>
          <Pressable
            disabled={isWorking || !provider}
            onPress={() => void saveSettings({ serviceRadiusMiles: Math.max(5, (provider?.serviceRadiusMiles ?? 15) - 5) })}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonLabel}>-5</Text>
          </Pressable>
          <Text style={styles.valueText}>{provider?.serviceRadiusMiles ?? 0} miles</Text>
          <Pressable
            disabled={isWorking || !provider}
            onPress={() => void saveSettings({ serviceRadiusMiles: Math.min(60, (provider?.serviceRadiusMiles ?? 15) + 5) })}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonLabel}>+5</Text>
          </Pressable>
        </View>
      </InfoCard>

      <InfoCard title="Staffing mode" description="Choose how matched crew is added">
        <View style={styles.stepRow}>
          <Pressable
            disabled={isWorking || !provider}
            onPress={() => void saveSettings({ staffingMode: "review-first" })}
            style={[styles.secondaryButton, provider?.staffingMode === "review-first" && styles.secondaryButtonActive]}
          >
            <Text style={[styles.secondaryButtonLabel, provider?.staffingMode === "review-first" && styles.secondaryButtonLabelActive]}>
              Review first
            </Text>
          </Pressable>
          <Pressable
            disabled={isWorking || !provider}
            onPress={() => void saveSettings({ staffingMode: "auto-accept" })}
            style={[styles.secondaryButton, provider?.staffingMode === "auto-accept" && styles.secondaryButtonActive]}
          >
            <Text style={[styles.secondaryButtonLabel, provider?.staffingMode === "auto-accept" && styles.secondaryButtonLabelActive]}>
              Auto accept
            </Text>
          </Pressable>
        </View>
      </InfoCard>

      <InfoCard title="Payouts" description="Weekly direct deposit is still the default">
        <Text style={styles.meta}>Crew payout depth stays web-first for now so the field app stays lighter.</Text>
      </InfoCard>

      <InfoCard title="Session" description="Manage this device">
        <Pressable onPress={signOut} style={styles.logoutButton}>
          <Text style={styles.logoutButtonLabel}>Log out</Text>
        </Pressable>
      </InfoCard>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: BrandTokens.spacing.md
  },
  secondaryButton: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BrandTokens.colors.primary,
    paddingHorizontal: BrandTokens.spacing.lg,
    paddingVertical: BrandTokens.spacing.sm
  },
  secondaryButtonActive: {
    backgroundColor: BrandTokens.colors.primary
  },
  secondaryButtonLabel: {
    color: BrandTokens.colors.primaryStrong,
    fontWeight: "700"
  },
  secondaryButtonLabelActive: {
    color: "#ffffff"
  },
  valueText: {
    color: BrandTokens.colors.ink,
    fontSize: 18,
    fontWeight: "700"
  },
  meta: {
    color: BrandTokens.colors.inkSoft,
    lineHeight: 20
  },
  logoutButton: {
    alignItems: "center",
    borderRadius: 999,
    backgroundColor: BrandTokens.colors.primary,
    paddingVertical: BrandTokens.spacing.md
  },
  logoutButtonLabel: {
    color: "#ffffff",
    fontWeight: "700"
  }
});
