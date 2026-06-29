import { useEffect, useState } from "react";
import { StyleSheet, Switch, Text, View, Pressable, TextInput } from "react-native";
import { BrandTokens } from "@yardmatch/branding";
import {
  AppNotification,
  BookingArrivalTracking,
  Booking,
  CreateCustomerPropertyRequest,
  CreateSupportTicketRequest,
  CustomerProperty,
  NotificationDeliveryRecord,
  NotificationPreferences,
  SupportIssueType,
  SupportTicket
} from "@yardmatch/contracts";
import { ArrivalTrackingModal } from "../components/ArrivalTrackingModal";
import { CustomerPropertyForm } from "../components/CustomerPropertyForm";
import { InfoCard } from "../components/InfoCard";
import { ScreenShell } from "../components/ScreenShell";
import { createCustomerMobileApiClient } from "../lib/api";
import { findTrackableBooking, parseTrackingBookingId } from "../lib/arrivalTracking";
import { useCustomerSession } from "../session/CustomerSessionContext";

const supportIssueOptions: SupportIssueType[] = ["billing", "service-quality", "account", "general"];

export function SupportScreen() {
  const [preferences, setPreferences] = useState<NotificationPreferences | undefined>();
  const [properties, setProperties] = useState<CustomerProperty[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [deliveries, setDeliveries] = useState<NotificationDeliveryRecord[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeTrackingBookingId, setActiveTrackingBookingId] = useState<string | undefined>();
  const [tracking, setTracking] = useState<BookingArrivalTracking | undefined>();
  const [selectedIssueType, setSelectedIssueType] = useState<SupportIssueType>("general");
  const [selectedBookingId, setSelectedBookingId] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [showAddPropertyForm, setShowAddPropertyForm] = useState(false);
  const [showAlertPreferences, setShowAlertPreferences] = useState(false);
  const [showSupportComposer, setShowSupportComposer] = useState(false);
  const [showSupportHistory, setShowSupportHistory] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const { biometricAvailable, biometricEnabled, biometricLabel, envelope, setBiometricEnabled, signOut } =
    useCustomerSession();

  async function loadAccount() {
    if (!envelope?.session.token) {
      return;
    }

    try {
      const api = createCustomerMobileApiClient();
      api.setAuthToken(envelope.session.token);
      const [nextProperties, nextBookings, nextTickets, notificationResponse, nextPreferences, nextDeliveries] = await Promise.all([
        api.getCustomerProperties(),
        api.getBookings(),
        api.getSupportTickets(),
        api.getNotifications(),
        api.getNotificationPreferences(),
        api.getNotificationDeliveries()
      ]);
      setProperties(nextProperties);
      setBookings(nextBookings);
      setSupportTickets(nextTickets);
      setNotifications(notificationResponse.notifications);
      setUnreadCount(notificationResponse.unreadCount);
      setPreferences(nextPreferences);
      setDeliveries(nextDeliveries.deliveries);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load your account.");
    }
  }

  async function handleUpdatePreferences(
    updates: Partial<Pick<NotificationPreferences, "pushEnabled" | "emailEnabled" | "smsEnabled" | "reviewRemindersEnabled">>
  ) {
    if (!envelope?.session.token || !preferences) {
      return;
    }

    try {
      setIsWorking(true);
      setErrorMessage("");
      const api = createCustomerMobileApiClient();
      api.setAuthToken(envelope.session.token);
      const nextPreferences = await api.updateNotificationPreferences(updates);
      setPreferences(nextPreferences);
      setStatusMessage("Delivery preferences updated.");
      const nextDeliveries = await api.getNotificationDeliveries();
      setDeliveries(nextDeliveries.deliveries);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update notification preferences.");
    } finally {
      setIsWorking(false);
    }
  }

  async function handleMarkNotificationsRead() {
    if (!envelope?.session.token || unreadCount === 0) {
      return;
    }

    try {
      setIsWorking(true);
      const api = createCustomerMobileApiClient();
      api.setAuthToken(envelope.session.token);
      const response = await api.markNotificationsRead({});
      setNotifications(response.notifications);
      setUnreadCount(response.unreadCount);
      setStatusMessage("Notifications marked read.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update notifications.");
    } finally {
      setIsWorking(false);
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
      setShowAddPropertyForm(false);
      await loadAccount();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to save your property.");
    } finally {
      setIsWorking(false);
    }
  }

  async function openTrackingFromNotification(notification: AppNotification) {
    if (!envelope?.session.token) {
      return;
    }

    const fallbackBookingId = findTrackableBooking(bookings)?.id;
    const bookingId =
      parseTrackingBookingId(notification.actionHref) ??
      (notification.title.toLowerCase().includes("on the way") ? fallbackBookingId : undefined);

    if (!bookingId) {
      return;
    }

    try {
      setIsWorking(true);
      setErrorMessage("");
      const api = createCustomerMobileApiClient();
      api.setAuthToken(envelope.session.token);
      setTracking(await api.getBookingTracking(bookingId));
      setActiveTrackingBookingId(bookingId);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to open arrival tracking.");
    } finally {
      setIsWorking(false);
    }
  }

  async function refreshTracking() {
    if (!envelope?.session.token || !activeTrackingBookingId) {
      return;
    }

    const api = createCustomerMobileApiClient();
    api.setAuthToken(envelope.session.token);
    setTracking(await api.getBookingTracking(activeTrackingBookingId));
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
      await loadAccount();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update your default property.");
    } finally {
      setIsWorking(false);
    }
  }

  async function handleCreateSupportTicket() {
    if (!envelope?.session.token || subject.trim().length === 0 || description.trim().length === 0) {
      return;
    }

    try {
      setIsWorking(true);
      setErrorMessage("");
      const api = createCustomerMobileApiClient();
      api.setAuthToken(envelope.session.token);
      await api.createSupportTicket({
        bookingId: selectedBookingId || undefined,
        issueType: selectedIssueType,
        subject: subject.trim(),
        description: description.trim()
      } satisfies CreateSupportTicketRequest);
      setStatusMessage("Support ticket submitted.");
      setSubject("");
      setDescription("");
      setSelectedBookingId("");
      setShowSupportComposer(false);
      await loadAccount();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to open a support ticket.");
    } finally {
      setIsWorking(false);
    }
  }

  useEffect(() => {
    void loadAccount();
  }, [envelope?.session.token]);

  async function handleBiometricToggle(nextValue: boolean) {
    const updated = await setBiometricEnabled(nextValue);
    if (updated) {
      setStatusMessage(
        nextValue
          ? `${biometricLabel} will be used when you reopen the customer app.`
          : "Biometric unlock turned off for this app."
      );
      return;
    }

    if (nextValue) {
      setErrorMessage(`Unable to enable ${biometricLabel} right now.`);
    }
  }

  return (
    <ScreenShell
      eyebrow="Account"
      title="Account"
      description="Properties, security, and support."
    >
      {statusMessage ? <InfoCard title="Updated" description={statusMessage} /> : null}
      {errorMessage ? <InfoCard title="Needs attention" description={errorMessage} /> : null}

      <InfoCard title="Saved properties" description={`${properties.length} saved`}>
        {properties.length > 0 ? (
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
        ) : (
          <Text style={styles.meta}>No properties saved yet.</Text>
        )}
        <Pressable
          disabled={isWorking}
          onPress={() => setShowAddPropertyForm((current) => !current)}
          style={styles.linkButton}
        >
          <Text style={styles.linkButtonLabel}>
            {showAddPropertyForm ? "Hide property form" : "Add property"}
          </Text>
        </Pressable>
        {showAddPropertyForm ? (
          <CustomerPropertyForm isWorking={isWorking} onSubmit={handleCreateProperty} submitLabel="Add property" />
        ) : null}
      </InfoCard>

      <InfoCard title="Security" description="Protect this device without slowing down daily use.">
        <View style={styles.switchRow}>
          <View style={styles.copy}>
            <Text style={styles.title}>Use {biometricLabel}</Text>
            <Text style={styles.meta}>
              {biometricAvailable
                ? "Ask for biometric unlock after the app has been away for about a minute."
                : "Face ID or another enrolled biometric method is not available on this device yet."}
            </Text>
          </View>
          <Switch
            disabled={!biometricAvailable || isWorking}
            onValueChange={(value) => {
              void handleBiometricToggle(value);
            }}
            value={biometricEnabled}
          />
        </View>
        <Pressable onPress={signOut} style={styles.logoutButton}>
          <Text style={styles.logoutButtonLabel}>Log out</Text>
        </Pressable>
      </InfoCard>

      <InfoCard title="Updates" description={`${unreadCount} unread`}>
        {notifications.length > 0 ? (
          <View style={styles.list}>
            {notifications.slice(0, 4).map((notification) => (
              <Pressable
                key={notification.id}
                onPress={() => void openTrackingFromNotification(notification)}
                style={styles.ticketRow}
              >
                <View style={styles.copy}>
                  <Text style={styles.title}>{notification.title}</Text>
                  <Text style={styles.meta}>{notification.body}</Text>
                  {parseTrackingBookingId(notification.actionHref) ||
                  notification.title.toLowerCase().includes("on the way") ? (
                    <Text style={styles.notificationLink}>Open live map</Text>
                  ) : null}
                </View>
                <Text style={styles.badge}>{notification.isRead ? "Read" : "New"}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <Text style={styles.meta}>No updates yet.</Text>
        )}
        {unreadCount > 0 ? (
          <Pressable
            disabled={isWorking}
            onPress={() => void handleMarkNotificationsRead()}
            style={styles.linkButton}
          >
            <Text style={styles.linkButtonLabel}>Mark updates read</Text>
          </Pressable>
        ) : null}
        <Pressable
          disabled={isWorking}
          onPress={() => setShowAlertPreferences((current) => !current)}
          style={styles.linkButton}
        >
          <Text style={styles.linkButtonLabel}>
            {showAlertPreferences ? "Hide alert preferences" : "Alert preferences"}
          </Text>
        </Pressable>
        {showAlertPreferences ? (
          <View style={styles.list}>
            <PreferenceRow
              label="Push for upcoming services"
              value={preferences?.pushEnabled ?? true}
              onValueChange={(value) => void handleUpdatePreferences({ pushEnabled: value })}
            />
            <PreferenceRow
              label="Email updates"
              value={preferences?.emailEnabled ?? true}
              onValueChange={(value) => void handleUpdatePreferences({ emailEnabled: value })}
            />
            <PreferenceRow
              label="SMS updates"
              value={preferences?.smsEnabled ?? true}
              onValueChange={(value) => void handleUpdatePreferences({ smsEnabled: value })}
            />
            <PreferenceRow
              label="Review reminders"
              value={preferences?.reviewRemindersEnabled ?? true}
              onValueChange={(value) => void handleUpdatePreferences({ reviewRemindersEnabled: value })}
            />
          </View>
        ) : null}
      </InfoCard>

      <InfoCard title="Delivery activity" description="What YardMatch already sent.">
        {deliveries.length > 0 ? (
          <View style={styles.list}>
            {deliveries.slice(0, 4).map((delivery) => (
              <View key={delivery.id} style={styles.ticketRow}>
                <View style={styles.copy}>
                  <Text style={styles.title}>
                    {delivery.channel.toUpperCase()} • {delivery.title}
                  </Text>
                  <Text style={styles.meta}>{delivery.destination}</Text>
                  <Text style={styles.meta}>{delivery.provider}</Text>
                </View>
                <Text style={styles.badge}>{delivery.status}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.meta}>Nothing sent yet.</Text>
        )}
      </InfoCard>

      <InfoCard title="Help" description="Get help quickly.">
        <Pressable
          onPress={() => setShowSupportComposer((current) => !current)}
          style={showSupportComposer ? styles.linkButton : styles.primaryButton}
        >
          <Text style={showSupportComposer ? styles.linkButtonLabel : styles.primaryButtonLabel}>
            {showSupportComposer ? "Hide ticket form" : "Open support ticket"}
          </Text>
        </Pressable>
        {showSupportComposer ? (
          <View style={styles.list}>
            <View style={styles.chipWrap}>
              {supportIssueOptions.map((issueType) => {
                const isActive = issueType === selectedIssueType;
                return (
                  <Pressable
                    key={issueType}
                    onPress={() => setSelectedIssueType(issueType)}
                    style={[styles.chip, isActive && styles.chipActive]}
                  >
                    <Text style={[styles.chipLabel, isActive && styles.chipLabelActive]}>
                      {issueType.replaceAll("-", " ")}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.list}>
              <Text style={styles.meta}>Related booking (optional)</Text>
              <View style={styles.chipWrap}>
                <Pressable
                  onPress={() => setSelectedBookingId("")}
                  style={[styles.chip, !selectedBookingId && styles.chipActive]}
                >
                  <Text style={[styles.chipLabel, !selectedBookingId && styles.chipLabelActive]}>No booking</Text>
                </Pressable>
                {bookings.slice(0, 4).map((booking) => {
                  const isActive = selectedBookingId === booking.id;
                  return (
                    <Pressable
                      key={booking.id}
                      onPress={() => setSelectedBookingId(booking.id)}
                      style={[styles.chip, isActive && styles.chipActive]}
                    >
                      <Text style={[styles.chipLabel, isActive && styles.chipLabelActive]}>
                        {booking.category.replaceAll("-", " ")}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <TextInput
              onChangeText={setSubject}
              placeholder="Short subject"
              placeholderTextColor={BrandTokens.colors.muted}
              style={styles.input}
              value={subject}
            />
            <TextInput
              multiline
              onChangeText={setDescription}
              placeholder="Tell us what happened and what you need."
              placeholderTextColor={BrandTokens.colors.muted}
              style={[styles.input, styles.textarea]}
              value={description}
            />
            <Pressable
              disabled={isWorking || subject.trim().length === 0 || description.trim().length === 0}
              onPress={() => void handleCreateSupportTicket()}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonLabel}>{isWorking ? "Sending..." : "Send ticket"}</Text>
            </Pressable>
          </View>
        ) : null}
        {supportTickets.length > 0 ? (
          <>
            <Pressable
              onPress={() => setShowSupportHistory((current) => !current)}
              style={styles.linkButton}
            >
              <Text style={styles.linkButtonLabel}>
                {showSupportHistory ? "Hide recent tickets" : "Recent tickets"}
              </Text>
            </Pressable>
            {showSupportHistory ? (
              <View style={styles.list}>
                {supportTickets.slice(0, 3).map((ticket) => (
                  <View key={ticket.id} style={styles.ticketRow}>
                    <View style={styles.copy}>
                      <Text style={styles.title}>{ticket.subject}</Text>
                      <Text style={styles.meta}>
                        {ticket.issueType.replaceAll("-", " ")} • {ticket.status}
                      </Text>
                    </View>
                    <Text style={styles.badge}>{new Date(ticket.createdAt).toLocaleDateString()}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </>
        ) : null}
      </InfoCard>

      <ArrivalTrackingModal
        onClose={() => {
          setTracking(undefined);
          setActiveTrackingBookingId(undefined);
        }}
        onRefresh={() => void refreshTracking()}
        tracking={tracking}
        visible={Boolean(tracking && activeTrackingBookingId)}
      />
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
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: BrandTokens.spacing.sm
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BrandTokens.colors.border,
    paddingHorizontal: BrandTokens.spacing.md,
    paddingVertical: BrandTokens.spacing.sm,
    backgroundColor: "rgba(255,255,255,0.94)"
  },
  chipActive: {
    borderColor: BrandTokens.colors.primary,
    backgroundColor: BrandTokens.colors.primary
  },
  chipLabel: {
    color: BrandTokens.colors.primaryStrong,
    fontWeight: "700"
  },
  chipLabelActive: {
    color: "#ffffff"
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: BrandTokens.spacing.md
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
  textarea: {
    minHeight: 120,
    textAlignVertical: "top"
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
  ticketRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: BrandTokens.spacing.md
  },
  notificationLink: {
    color: BrandTokens.colors.primaryStrong,
    fontWeight: "700"
  }
});
