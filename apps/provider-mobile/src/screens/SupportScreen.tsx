import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BrandTokens } from "@yardmatch/branding";
import {
  providerCrewPayouts,
  providerFundingAccounts
} from "@yardmatch/ui";
import { MarketplaceTelemetryEventCatalog } from "@yardmatch/observability";
import { InfoCard } from "../components/InfoCard";
import { ScreenShell } from "../components/ScreenShell";
import { ServiceRadiusSettingsCard } from "../components/ServiceRadiusSettingsCard";
import { getProviderMobileTracker } from "../lib/tracking";

export function SupportScreen() {
  const tracker = getProviderMobileTracker();
  const [defaultAccountId, setDefaultAccountId] = useState(
    providerFundingAccounts.find((account) => account.isDefault)?.id ?? providerFundingAccounts[0]?.id
  );

  const readyAmount = providerCrewPayouts
    .filter((payout) => payout.status === "ready")
    .reduce((sum, payout) => sum + Number(payout.amountLabel.replace(/[^0-9.]/g, "")), 0);

  return (
    <ScreenShell eyebrow="Account" title="Settings and payouts">
      <ServiceRadiusSettingsCard />

      <InfoCard title="Payouts" description="Weekly direct deposit is the default">
        <Text style={styles.emphasis}>${readyAmount.toFixed(0)} ready for cash-out now</Text>
        <Text style={styles.meta}>Instant cash-out is available up to 6 times per day.</Text>
        <Pressable
          onPress={() =>
            void tracker.track(MarketplaceTelemetryEventCatalog.providerCashOutInitiated, {
              app: "provider",
              readyAmount
            })
          }
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonLabel}>Cash out now</Text>
        </Pressable>
      </InfoCard>

      <InfoCard title="Bank accounts" description={`${providerFundingAccounts.length} linked`}>
        <View style={styles.list}>
          {providerFundingAccounts.map((account) => {
            const isDefault = account.id === defaultAccountId;
            return (
              <Pressable
                key={account.id}
                onPress={() => setDefaultAccountId(account.id)}
                style={[styles.accountRow, isDefault && styles.accountRowActive]}
              >
                <View style={styles.copy}>
                  <Text style={styles.title}>
                    {account.bankName} {account.accountMask}
                  </Text>
                  <Text style={styles.meta}>
                    {account.accountType} • {account.payoutSpeedLabel}
                  </Text>
                </View>
                {isDefault ? <Text style={styles.badge}>Default</Text> : null}
              </Pressable>
            );
          })}
        </View>
      </InfoCard>

      <InfoCard title="Help" description="Fast support routes">
        <View style={styles.helpRow}>
          <HelpChip label="Payout issue" />
          <HelpChip label="Crew help" />
          <HelpChip label="Dispute" />
        </View>
      </InfoCard>
    </ScreenShell>
  );
}

function HelpChip({ label }: { label: string }) {
  return (
    <Pressable style={styles.helpChip}>
      <Text style={styles.helpChipLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  emphasis: {
    color: BrandTokens.colors.ink,
    fontSize: 18,
    fontWeight: "700"
  },
  meta: {
    color: BrandTokens.colors.inkSoft,
    lineHeight: 20
  },
  primaryButton: {
    alignItems: "center",
    borderRadius: 999,
    backgroundColor: BrandTokens.colors.primary,
    paddingVertical: BrandTokens.spacing.md
  },
  primaryButtonLabel: {
    color: "#ffffff",
    fontWeight: "700"
  },
  list: {
    gap: BrandTokens.spacing.md
  },
  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: BrandTokens.spacing.md,
    borderRadius: BrandTokens.radius.sm,
    borderWidth: 1,
    borderColor: BrandTokens.colors.border,
    padding: BrandTokens.spacing.md,
    backgroundColor: "rgba(255,255,255,0.96)"
  },
  accountRowActive: {
    borderColor: BrandTokens.colors.primary,
    backgroundColor: BrandTokens.colors.surfaceStrong
  },
  copy: {
    flex: 1,
    gap: BrandTokens.spacing.xs
  },
  title: {
    color: BrandTokens.colors.ink,
    fontWeight: "700"
  },
  badge: {
    color: BrandTokens.colors.primaryStrong,
    fontSize: 12,
    fontWeight: "700"
  },
  helpRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: BrandTokens.spacing.sm
  },
  helpChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BrandTokens.colors.border,
    paddingHorizontal: BrandTokens.spacing.lg,
    paddingVertical: BrandTokens.spacing.sm
  },
  helpChipLabel: {
    color: BrandTokens.colors.primaryStrong,
    fontWeight: "700"
  }
});
