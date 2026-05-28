import { useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { BrandTokens } from "@yardmatch/branding";
import { customerSavedProperties } from "@yardmatch/ui";
import { InfoCard } from "../components/InfoCard";
import { ScreenShell } from "../components/ScreenShell";

export function SupportScreen() {
  const [pushEnabled, setPushEnabled] = useState(true);
  const [reviewRemindersEnabled, setReviewRemindersEnabled] = useState(true);

  return (
    <ScreenShell eyebrow="Account" title="Your account">
      <InfoCard title="Saved properties" description={`${customerSavedProperties.length} on file`}>
        <View style={styles.list}>
          {customerSavedProperties.map((property) => (
            <View key={property.id} style={styles.row}>
              <View style={styles.copy}>
                <Text style={styles.title}>{property.label}</Text>
                <Text style={styles.meta}>{property.addressLine}</Text>
              </View>
              {property.isDefault ? <Text style={styles.badge}>Default</Text> : null}
            </View>
          ))}
        </View>
      </InfoCard>

      <InfoCard title="Notifications" description="Only what matters">
        <PreferenceRow
          label="Push for upcoming services"
          value={pushEnabled}
          onValueChange={setPushEnabled}
        />
        <PreferenceRow
          label="Review reminders"
          value={reviewRemindersEnabled}
          onValueChange={setReviewRemindersEnabled}
        />
      </InfoCard>

      <InfoCard title="Payments" description="Saved here for later">
        <Text style={styles.meta}>Primary card ending in 2048</Text>
        <Text style={styles.meta}>Payment methods and billing details stay simple on mobile.</Text>
      </InfoCard>

      <InfoCard title="Help" description="Fast support paths">
        <View style={styles.actionStack}>
          <ActionChip label="Billing issue" />
          <ActionChip label="Service quality" />
          <ActionChip label="Booking help" />
        </View>
      </InfoCard>
    </ScreenShell>
  );
}

function PreferenceRow({
  label,
  value,
  onValueChange
}: {
  label: string;
  value: boolean;
  onValueChange: (nextValue: boolean) => void;
}) {
  return (
    <View style={styles.preferenceRow}>
      <Text style={styles.title}>{label}</Text>
      <Switch
        trackColor={{ false: BrandTokens.colors.border, true: BrandTokens.colors.primary }}
        thumbColor="#ffffff"
        value={value}
        onValueChange={onValueChange}
      />
    </View>
  );
}

function ActionChip({ label }: { label: string }) {
  return (
    <Pressable style={styles.actionChip}>
      <Text style={styles.actionChipLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: BrandTokens.spacing.md
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: BrandTokens.spacing.md
  },
  copy: {
    flex: 1,
    gap: BrandTokens.spacing.xs
  },
  title: {
    color: BrandTokens.colors.ink,
    fontWeight: "700"
  },
  meta: {
    color: BrandTokens.colors.inkSoft,
    lineHeight: 20
  },
  badge: {
    color: BrandTokens.colors.primaryStrong,
    fontSize: 12,
    fontWeight: "700"
  },
  preferenceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: BrandTokens.spacing.md
  },
  actionStack: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: BrandTokens.spacing.sm
  },
  actionChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BrandTokens.colors.border,
    paddingHorizontal: BrandTokens.spacing.lg,
    paddingVertical: BrandTokens.spacing.sm
  },
  actionChipLabel: {
    color: BrandTokens.colors.primaryStrong,
    fontWeight: "700"
  }
});
