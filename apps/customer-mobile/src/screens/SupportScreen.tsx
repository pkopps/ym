import { useEffect, useState } from "react";
import { StyleSheet, Switch, Text, View, Pressable } from "react-native";
import { BrandTokens } from "@yardmatch/branding";
import { CreateCustomerPropertyRequest, CustomerProperty } from "@yardmatch/contracts";
import { CustomerPropertyForm } from "../components/CustomerPropertyForm";
import { InfoCard } from "../components/InfoCard";
import { ScreenShell } from "../components/ScreenShell";
import { createCustomerMobileApiClient } from "../lib/api";
import { useCustomerSession } from "../session/CustomerSessionContext";

export function SupportScreen() {
  const [pushEnabled, setPushEnabled] = useState(true);
  const [reviewRemindersEnabled, setReviewRemindersEnabled] = useState(true);
  const [properties, setProperties] = useState<CustomerProperty[]>([]);
  const [statusMessage, setStatusMessage] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const { envelope, signOut } = useCustomerSession();

  async function loadProperties() {
    if (!envelope?.session.token) {
      return;
    }

    try {
      const api = createCustomerMobileApiClient();
      api.setAuthToken(envelope.session.token);
      setProperties(await api.getCustomerProperties());
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load your account.");
    }
  }

  async function handleCreateProperty(payload: CreateCustomerPropertyRequest) {
    if (!envelope?.session.token) {
      return;
    }

    try {
      setIsWorking(true);
      setErrorMessage("");
      const api = createCustomerMobileApiClient();
      api.setAuthToken(envelope.session.token);
      const property = await api.createCustomerProperty(payload);
      setStatusMessage(`${property.label} added.`);
      await loadProperties();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to save your property.");
    } finally {
      setIsWorking(false);
    }
  }

  async function handleSetDefault(propertyId: string) {
    if (!envelope?.session.token) {
      return;
    }

    try {
      setIsWorking(true);
      setErrorMessage("");
      const api = createCustomerMobileApiClient();
      api.setAuthToken(envelope.session.token);
      await api.setDefaultCustomerProperty({ propertyId });
      setStatusMessage("Default property updated.");
      await loadProperties();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update your default property.");
    } finally {
      setIsWorking(false);
    }
  }

  useEffect(() => {
    void loadProperties();
  }, [envelope?.session.token]);

  return (
    <ScreenShell eyebrow="Account" title="Your account">
      {statusMessage ? <InfoCard title="Updated" description={statusMessage} /> : null}
      {errorMessage ? <InfoCard title="Needs attention" description={errorMessage} /> : null}

      <InfoCard title="Saved properties" description={`${properties.length} on file`}>
        <View style={styles.list}>
          {properties.map((property) => (
            <View key={property.id} style={styles.row}>
              <View style={styles.copy}>
                <Text style={styles.title}>{property.label}</Text>
                <Text style={styles.meta}>{property.address.line1}</Text>
              </View>
              {property.isDefault ? (
                <Text style={styles.badge}>Default</Text>
              ) : (
                <Pressable
                  disabled={isWorking}
                  onPress={() => void handleSetDefault(property.id)}
                  style={styles.linkButton}
                >
                  <Text style={styles.linkButtonLabel}>Make default</Text>
                </Pressable>
              )}
            </View>
          ))}
        </View>
        <CustomerPropertyForm isWorking={isWorking} onSubmit={handleCreateProperty} submitLabel="Add property" />
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
        <Text style={styles.meta}>Billing depth stays lighter on mobile so booking and schedule management stay faster.</Text>
      </InfoCard>

      <InfoCard title="Help" description="Fast support paths">
        <Text style={styles.meta}>Use the website for billing disputes and deeper support workflows.</Text>
      </InfoCard>

      <InfoCard title="Session" description="Manage this device">
        <Pressable onPress={signOut} style={styles.logoutButton}>
          <Text style={styles.logoutButtonLabel}>Log out</Text>
        </Pressable>
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
  linkButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BrandTokens.colors.primary,
    paddingHorizontal: BrandTokens.spacing.md,
    paddingVertical: BrandTokens.spacing.sm
  },
  linkButtonLabel: {
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
  logoutButton: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BrandTokens.colors.border,
    backgroundColor: "rgba(255,255,255,0.96)",
    paddingVertical: BrandTokens.spacing.md
  },
  logoutButtonLabel: {
    color: BrandTokens.colors.primaryStrong,
    fontWeight: "700"
  }
});
