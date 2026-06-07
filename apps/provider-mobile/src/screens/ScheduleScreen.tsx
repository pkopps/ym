import { useEffect, useMemo, useRef, useState } from "react";
import * as Location from "expo-location";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { BrandTokens } from "@yardmatch/branding";
import {
  BookingArrivalTracking,
  CustomerProviderConversationThread,
  formatBookingWindowSummary,
  getExternalCalendarBlockLabel,
  getBookingExceptionLabel,
  ProviderCalendarOverviewResponse,
  ProviderStaffingOverview
} from "@yardmatch/contracts";
import { InfoCard } from "../components/InfoCard";
import { ScreenShell } from "../components/ScreenShell";
import { createProviderMobileApiClient } from "../lib/api";
import { useProviderSession } from "../session/ProviderSessionContext";

type ViewMode = "calendar" | "list";

export function ScheduleScreen() {
  const { envelope } = useProviderSession();
  const [viewMode, setViewMode] = useState<ViewMode>("calendar");
  const [overview, setOverview] = useState<ProviderStaffingOverview | undefined>();
  const [calendarOverview, setCalendarOverview] = useState<ProviderCalendarOverviewResponse | undefined>();
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [activeBookingId, setActiveBookingId] = useState<string | undefined>();
  const [chatThread, setChatThread] = useState<CustomerProviderConversationThread | undefined>();
  const [activeTrackingBookingId, setActiveTrackingBookingId] = useState<string | undefined>();
  const [tracking, setTracking] = useState<BookingArrivalTracking | undefined>();
  const [chatDraft, setChatDraft] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const locationSubscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const routeSharingBookingIdRef = useRef<string | undefined>(undefined);
  const activeTrackingBookingIdRef = useRef<string | undefined>(undefined);

  async function loadOverview() {
    if (!envelope?.session.token) {
      return;
    }

    try {
      const api = createProviderMobileApiClient();
      api.setAuthToken(envelope.session.token);
      const [nextOverview, nextCalendarOverview] = await Promise.all([
        api.getProviderStaffingOverview(),
        api.getProviderCalendarOverview()
      ]);
      setOverview(nextOverview);
      setCalendarOverview(nextCalendarOverview);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load schedule.");
    }
  }

  useEffect(() => {
    void loadOverview();
  }, [envelope?.session.token]);

  const jobs = overview?.jobs ?? [];
  const calendarEvents = calendarOverview?.events ?? [];
  const activeRouteJob = useMemo(
    () =>
      [...jobs]
        .filter((job) => Boolean(job.onRouteConfirmedAt) && (job.status === "confirmed" || job.status === "in-progress"))
        .sort((left, right) => left.scheduledStartIso.localeCompare(right.scheduledStartIso))[0],
    [jobs]
  );

  useEffect(() => {
    activeTrackingBookingIdRef.current = activeTrackingBookingId;
  }, [activeTrackingBookingId]);

  function buildLateEta(bookingIso: string, minutes: number) {
    return new Date(new Date(bookingIso).getTime() + minutes * 60_000).toISOString();
  }

  function stopRouteLocationSharing() {
    locationSubscriptionRef.current?.remove();
    locationSubscriptionRef.current = null;
    routeSharingBookingIdRef.current = undefined;
  }

  async function pushRouteLocation(bookingId: string, location: Location.LocationObject) {
    if (!envelope?.session.token) {
      return;
    }

    try {
      const api = createProviderMobileApiClient();
      api.setAuthToken(envelope.session.token);
      const nextTracking = await api.updateBookingRouteLocation({
        bookingId,
        point: {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude
        },
        capturedAtIso: new Date(location.timestamp).toISOString(),
        speedMph:
          typeof location.coords.speed === "number" && location.coords.speed >= 0
            ? Number((location.coords.speed * 2.23694).toFixed(1))
            : undefined,
        accuracyMeters:
          typeof location.coords.accuracy === "number" ? Number(location.coords.accuracy.toFixed(1)) : undefined
      });

      if (activeTrackingBookingIdRef.current === bookingId) {
        setTracking(nextTracking);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to share live route location.");
    }
  }

  async function beginRouteLocationSharing(bookingId: string) {
    if (!envelope?.session.token) {
      return;
    }

    if (routeSharingBookingIdRef.current === bookingId && locationSubscriptionRef.current) {
      return;
    }

    stopRouteLocationSharing();

    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        routeSharingBookingIdRef.current = bookingId;
        setStatusMessage(
          "Route is live. Turn on location access for live customer map updates, or YardMatch will keep using estimated tracking."
        );
        return;
      }

      routeSharingBookingIdRef.current = bookingId;
      setStatusMessage("Sharing your live route with the customer now.");

      const currentPosition = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      });
      await pushRouteLocation(bookingId, currentPosition);

      locationSubscriptionRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 30_000,
          distanceInterval: 50,
          mayShowUserSettingsDialog: true
        },
        (nextPosition) => {
          if (routeSharingBookingIdRef.current !== bookingId) {
            return;
          }

          void pushRouteLocation(bookingId, nextPosition);
        }
      );
    } catch (error) {
      setStatusMessage(
        "Route is live, but we could not start live location sharing. Customers will still see estimated tracking."
      );
      setErrorMessage(error instanceof Error ? error.message : "Unable to start live route sharing.");
    }
  }

  useEffect(() => {
    if (!activeRouteJob?.bookingId) {
      stopRouteLocationSharing();
      return;
    }

    void beginRouteLocationSharing(activeRouteJob.bookingId);

    return () => {
      stopRouteLocationSharing();
    };
  }, [activeRouteJob?.bookingId, envelope?.session.token]);

  useEffect(() => () => stopRouteLocationSharing(), []);

  async function completeJob(bookingId: string) {
    if (!envelope?.session.token) {
      return;
    }

    try {
      setIsWorking(true);
      setErrorMessage("");
      const api = createProviderMobileApiClient();
      api.setAuthToken(envelope.session.token);
      await api.completeBooking({ bookingId });
      setStatusMessage("Job marked complete.");
      setActiveBookingId(undefined);
      setChatThread(undefined);
      await loadOverview();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to complete that job.");
    } finally {
      setIsWorking(false);
    }
  }

  async function confirmJob(bookingId: string) {
    if (!envelope?.session.token) {
      return;
    }

    try {
      setIsWorking(true);
      setErrorMessage("");
      const api = createProviderMobileApiClient();
      api.setAuthToken(envelope.session.token);
      await api.confirmBooking({ bookingId });
      setStatusMessage("Booking confirmed.");
      await loadOverview();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to confirm that booking.");
    } finally {
      setIsWorking(false);
    }
  }

  async function openCustomerChat(bookingId: string) {
    if (!envelope?.session.token) {
      return;
    }

    try {
      const api = createProviderMobileApiClient();
      api.setAuthToken(envelope.session.token);
      setActiveBookingId(bookingId);
      setChatThread(await api.getCustomerProviderConversationThread(undefined, bookingId));
    } catch (error) {
      if (error instanceof Error && /Conversation not found/.test(error.message)) {
        setActiveBookingId(bookingId);
        setChatThread(undefined);
        return;
      }
      setErrorMessage(error instanceof Error ? error.message : "Unable to open customer chat.");
    }
  }

  async function sendCustomerChat(bookingId: string) {
    if (!envelope?.session.token || !chatDraft.trim()) {
      return;
    }

    try {
      setIsWorking(true);
      const api = createProviderMobileApiClient();
      api.setAuthToken(envelope.session.token);
      setChatThread(
        await api.sendCustomerProviderMessage({
          threadId: chatThread?.thread.id,
          bookingId,
          body: chatDraft.trim()
        })
      );
      setChatDraft("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to send customer message.");
    } finally {
      setIsWorking(false);
    }
  }

  async function openArrivalTracking(bookingId: string) {
    if (!envelope?.session.token) {
      return;
    }

    try {
      const api = createProviderMobileApiClient();
      api.setAuthToken(envelope.session.token);
      setTracking(await api.getBookingTracking(bookingId));
      setActiveTrackingBookingId(bookingId);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to open arrival tracking.");
    }
  }

  async function startRoute(bookingId: string) {
    if (!envelope?.session.token) {
      return;
    }

    try {
      setIsWorking(true);
      setErrorMessage("");
      const api = createProviderMobileApiClient();
      api.setAuthToken(envelope.session.token);
      await api.markBookingOnRoute({ bookingId });
      setStatusMessage("Route started. Asking for live location so the customer can track your arrival.");
      await loadOverview();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to start the route.");
    } finally {
      setIsWorking(false);
    }
  }

  async function startWork(bookingId: string) {
    if (!envelope?.session.token) {
      return;
    }

    try {
      setIsWorking(true);
      setErrorMessage("");
      const api = createProviderMobileApiClient();
      api.setAuthToken(envelope.session.token);
      await api.startBooking({ bookingId });
      setStatusMessage("Work started.");
      await loadOverview();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to start work.");
    } finally {
      setIsWorking(false);
    }
  }

  async function markLate(bookingId: string, lateEtaIso: string, reason: string) {
    if (!envelope?.session.token) {
      return;
    }

    try {
      setIsWorking(true);
      setErrorMessage("");
      const api = createProviderMobileApiClient();
      api.setAuthToken(envelope.session.token);
      await api.markBookingLate({
        bookingId,
        lateEtaIso,
        reason
      });
      setStatusMessage("Customer updated about the delay.");
      await loadOverview();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to send the delay update.");
    } finally {
      setIsWorking(false);
    }
  }

  async function reportIssue(
    bookingId: string,
    exceptionType:
      | "customer-no-show"
      | "customer-not-ready"
      | "unable-to-access-property"
      | "service-could-not-be-completed",
    notes: string
  ) {
    if (!envelope?.session.token) {
      return;
    }

    try {
      setIsWorking(true);
      setErrorMessage("");
      const api = createProviderMobileApiClient();
      api.setAuthToken(envelope.session.token);
      await api.markBookingException({
        bookingId,
        exceptionType,
        notes
      });
      setStatusMessage(`${getBookingExceptionLabel(exceptionType)} shared with the customer.`);
      await loadOverview();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to log that issue.");
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <ScreenShell eyebrow="Schedule" title="Upcoming jobs">
      <View style={styles.modeRow}>
        <ModeButton active={viewMode === "calendar"} label="Calendar" onPress={() => setViewMode("calendar")} />
        <ModeButton active={viewMode === "list"} label="List" onPress={() => setViewMode("list")} />
      </View>

      {statusMessage ? <InfoCard title="Updated" description={statusMessage} /> : null}
      {errorMessage ? <InfoCard title="Needs attention" description={errorMessage} /> : null}

      {viewMode === "calendar" ? (
        <InfoCard
          title="This week"
          description={`${calendarOverview?.yardmatchJobCount ?? jobs.length} YardMatch jobs • ${calendarOverview?.externalBlockCount ?? 0} outside blocks`}
        >
          <View style={styles.list}>
            {calendarEvents.map((event) => (
              <View key={event.id} style={styles.dayCard}>
                <Text style={styles.dayLabel}>
                  {new Date(event.startIso).toLocaleDateString(undefined, { weekday: "short" })}
                </Text>
                <Text style={styles.timeLabel}>
                  {formatBookingWindowSummary(event.startIso)}
                </Text>
                <Text style={styles.clientLabel}>{event.title}</Text>
                <Text style={styles.metaLine}>
                  {event.source === "yardmatch-booking"
                    ? `${event.customerName ?? "Customer"} • ${event.status?.replaceAll("-", " ")}`
                    : `${getExternalCalendarBlockLabel(event.blockType ?? "off-platform-client")} • Outside block`}
                </Text>
                {event.addressLine ? <Text style={styles.metaLine}>{event.addressLine}</Text> : null}
                {event.notes ? <Text style={styles.metaLine}>{event.notes}</Text> : null}
              </View>
            ))}
          </View>
        </InfoCard>
      ) : (
        <InfoCard title="Job list" description={`${jobs.length} scheduled`}>
          <View style={styles.list}>
            {jobs.map((job) => (
              <View key={job.bookingId} style={styles.jobRow}>
                <View style={styles.jobCopy}>
                  <Text style={styles.clientLabel}>{job.customerName}</Text>
                  <Text style={styles.metaLine}>
                    {formatBookingWindowSummary(job.scheduledStartIso)}
                  </Text>
                  <Text style={styles.metaLine}>{new Date(job.scheduledStartIso).toLocaleString()}</Text>
                  <Text style={styles.metaLine}>{job.serviceAddress.line1}</Text>
                  <Text style={styles.metaLine}>
                    {job.category.replaceAll("-", " ")} • {job.assignedCrewMembers}/{job.requiredCrewMembers} crew
                  </Text>
                  <Text style={styles.statusLine}>{job.status.replaceAll("-", " ")}</Text>
                  {job.onRouteConfirmedAt ? (
                    <Text style={styles.metaLine}>Route is live. Customer chat is open.</Text>
                  ) : null}
                  {job.lateEtaIso && !job.onRouteConfirmedAt ? (
                    <Text style={styles.metaLine}>
                      Delay notice sent for{" "}
                      {new Date(job.lateEtaIso).toLocaleTimeString(undefined, { timeStyle: "short" })}.
                    </Text>
                  ) : null}
                  {job.activeExceptionType ? (
                    <Text style={styles.metaLine}>
                      {getBookingExceptionLabel(job.activeExceptionType)}
                      {job.activeExceptionNotes ? ` • ${job.activeExceptionNotes}` : ""}
                    </Text>
                  ) : null}
                  {job.status === "disputed" ? (
                    <Text style={styles.metaLine}>
                      Disputed{job.disputeReason ? ` • ${job.disputeReason}` : ""}
                    </Text>
                  ) : null}
                  <View style={styles.actionRow}>
                    {job.status === "requested" ? (
                      <Pressable
                        disabled={isWorking}
                        onPress={() => void confirmJob(job.bookingId)}
                        style={styles.completeButton}
                      >
                        <Text style={styles.completeButtonLabel}>{isWorking ? "Working..." : "Confirm booking"}</Text>
                      </Pressable>
                    ) : null}
                    {job.status === "confirmed" && !job.onRouteConfirmedAt ? (
                      <Pressable
                        disabled={isWorking}
                        onPress={() => void startRoute(job.bookingId)}
                        style={styles.completeButton}
                      >
                        <Text style={styles.completeButtonLabel}>{isWorking ? "Working..." : "Start route"}</Text>
                      </Pressable>
                    ) : null}
                    {job.status === "confirmed" && !job.onRouteConfirmedAt ? (
                      <Pressable
                        disabled={isWorking}
                        onPress={() =>
                          void reportIssue(
                            job.bookingId,
                            "customer-no-show",
                            "The customer did not appear for the scheduled service window."
                          )
                        }
                        style={styles.chatButton}
                      >
                        <Text style={styles.chatButtonLabel}>Customer no-show</Text>
                      </Pressable>
                    ) : null}
                    {job.status === "confirmed" && !job.onRouteConfirmedAt ? (
                      <Pressable
                        disabled={isWorking}
                        onPress={() =>
                          void markLate(
                            job.bookingId,
                            buildLateEta(job.scheduledStartIso, 15),
                            "Running about 15 minutes behind the route."
                          )
                        }
                        style={styles.chatButton}
                      >
                        <Text style={styles.chatButtonLabel}>+15 min</Text>
                      </Pressable>
                    ) : null}
                    {job.status === "confirmed" && !job.onRouteConfirmedAt ? (
                      <Pressable
                        disabled={isWorking}
                        onPress={() =>
                          void markLate(
                            job.bookingId,
                            buildLateEta(job.scheduledStartIso, 30),
                            "Running about 30 minutes behind the route."
                          )
                        }
                        style={styles.chatButton}
                      >
                        <Text style={styles.chatButtonLabel}>+30 min</Text>
                      </Pressable>
                    ) : null}
                    {job.status === "confirmed" && job.onRouteConfirmedAt ? (
                      <Pressable
                        disabled={isWorking}
                        onPress={() => void startWork(job.bookingId)}
                        style={styles.completeButton}
                      >
                        <Text style={styles.completeButtonLabel}>{isWorking ? "Working..." : "Start work"}</Text>
                      </Pressable>
                    ) : null}
                    {(job.status === "confirmed" || job.status === "in-progress") ? (
                      <Pressable
                        disabled={isWorking}
                        onPress={() => void completeJob(job.bookingId)}
                        style={styles.completeButton}
                      >
                        <Text style={styles.completeButtonLabel}>{isWorking ? "Working..." : "Complete job"}</Text>
                      </Pressable>
                    ) : null}
                    {(job.status === "confirmed" || job.status === "in-progress") ? (
                      <Pressable
                        disabled={isWorking}
                        onPress={() =>
                          void reportIssue(
                            job.bookingId,
                            "customer-not-ready",
                            "The property owner is not ready for the scheduled service."
                          )
                        }
                        style={styles.chatButton}
                      >
                        <Text style={styles.chatButtonLabel}>Customer not ready</Text>
                      </Pressable>
                    ) : null}
                    {(job.status === "confirmed" || job.status === "in-progress") ? (
                      <Pressable
                        disabled={isWorking}
                        onPress={() =>
                          void reportIssue(
                            job.bookingId,
                            "unable-to-access-property",
                            "The crew could not safely access the property as scheduled."
                          )
                        }
                        style={styles.chatButton}
                      >
                        <Text style={styles.chatButtonLabel}>No access</Text>
                      </Pressable>
                    ) : null}
                    {job.status === "in-progress" ? (
                      <Pressable
                        disabled={isWorking}
                        onPress={() =>
                          void reportIssue(
                            job.bookingId,
                            "service-could-not-be-completed",
                            "The service could not be completed during this visit."
                          )
                        }
                        style={styles.chatButton}
                      >
                        <Text style={styles.chatButtonLabel}>Could not complete</Text>
                      </Pressable>
                    ) : null}
                    {job.onRouteConfirmedAt ? (
                      <Pressable
                        disabled={isWorking}
                        onPress={() => void openCustomerChat(job.bookingId)}
                        style={styles.chatButton}
                      >
                        <Text style={styles.chatButtonLabel}>Message customer</Text>
                      </Pressable>
                    ) : null}
                    {job.onRouteConfirmedAt ? (
                      <Pressable
                        disabled={isWorking}
                        onPress={() => void openArrivalTracking(job.bookingId)}
                        style={styles.chatButton}
                      >
                        <Text style={styles.chatButtonLabel}>Track crew</Text>
                      </Pressable>
                    ) : null}
                  </View>
                  {job.onRouteConfirmedAt &&
                  activeTrackingBookingId === job.bookingId &&
                  tracking ? (
                    <View style={styles.trackingCard}>
                      <Text style={styles.clientLabel}>
                        {tracking.etaMinutes ? `${tracking.etaMinutes} min away` : "At the property"}
                      </Text>
                      <Text style={styles.metaLine}>{tracking.message}</Text>
                      <Text style={styles.metaLine}>
                        {tracking.progressPercent}% complete •{" "}
                        {tracking.remainingDistanceMiles !== undefined
                          ? `${tracking.remainingDistanceMiles.toFixed(1)} miles left`
                          : "Waiting for route"}
                      </Text>
                      <Text style={styles.metaLine}>
                        {tracking.source === "provider-device"
                          ? tracking.isLiveLocationStale
                            ? "Live location paused a few minutes ago."
                            : `Live provider location${
                                tracking.liveUpdatedAt
                                  ? ` • updated ${new Date(tracking.liveUpdatedAt).toLocaleTimeString(undefined, {
                                      timeStyle: "short"
                                    })}`
                                  : ""
                              }`
                          : "Estimated route from provider base"}
                      </Text>
                    </View>
                  ) : null}
                  {job.onRouteConfirmedAt && activeBookingId === job.bookingId ? (
                    <View style={styles.chatStack}>
                      {(chatThread?.messages ?? []).map((message) => (
                        <View key={message.id} style={styles.chatBubble}>
                          <Text style={styles.clientLabel}>
                            {message.senderRole === "provider" ? "You" : job.customerName}
                          </Text>
                          <Text style={styles.metaLine}>{message.body}</Text>
                        </View>
                      ))}
                      <TextInput
                        multiline
                        onChangeText={setChatDraft}
                        placeholder="Message the property owner."
                        placeholderTextColor={BrandTokens.colors.muted}
                        style={styles.input}
                        value={chatDraft}
                      />
                      <Pressable
                        disabled={isWorking}
                        onPress={() => void sendCustomerChat(job.bookingId)}
                        style={styles.submitButton}
                      >
                        <Text style={styles.submitButtonLabel}>{isWorking ? "Sending..." : "Send message"}</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        </InfoCard>
      )}
    </ScreenShell>
  );
}

function ModeButton({
  active,
  label,
  onPress
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.modeButton, active && styles.modeButtonActive]}>
      <Text style={[styles.modeLabel, active && styles.modeLabelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  modeRow: {
    flexDirection: "row",
    gap: BrandTokens.spacing.sm
  },
  modeButton: {
    flex: 1,
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BrandTokens.colors.border,
    paddingVertical: BrandTokens.spacing.sm,
    backgroundColor: "rgba(255,255,255,0.9)"
  },
  modeButtonActive: {
    backgroundColor: BrandTokens.colors.primary,
    borderColor: BrandTokens.colors.primary
  },
  modeLabel: {
    color: BrandTokens.colors.primaryStrong,
    fontWeight: "700"
  },
  modeLabelActive: {
    color: "#ffffff"
  },
  list: {
    gap: BrandTokens.spacing.md
  },
  dayCard: {
    borderRadius: BrandTokens.radius.sm,
    borderWidth: 1,
    borderColor: BrandTokens.colors.border,
    padding: BrandTokens.spacing.md,
    gap: BrandTokens.spacing.xs,
    backgroundColor: "rgba(255,255,255,0.96)"
  },
  dayLabel: {
    color: BrandTokens.colors.primaryStrong,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  timeLabel: {
    color: BrandTokens.colors.ink,
    fontWeight: "700"
  },
  clientLabel: {
    color: BrandTokens.colors.ink,
    fontWeight: "700"
  },
  metaLine: {
    color: BrandTokens.colors.inkSoft,
    lineHeight: 20
  },
  statusLine: {
    color: BrandTokens.colors.primaryStrong,
    fontWeight: "700"
  },
  jobRow: {
    borderBottomWidth: 1,
    borderBottomColor: BrandTokens.colors.border,
    paddingBottom: BrandTokens.spacing.md
  },
  jobCopy: {
    gap: BrandTokens.spacing.xs
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: BrandTokens.spacing.sm,
    marginTop: BrandTokens.spacing.xs
  },
  completeButton: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: BrandTokens.colors.primary,
    paddingHorizontal: BrandTokens.spacing.lg,
    paddingVertical: BrandTokens.spacing.sm
  },
  completeButtonLabel: {
    color: "#ffffff",
    fontWeight: "700"
  },
  chatButton: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BrandTokens.colors.primary,
    paddingHorizontal: BrandTokens.spacing.md,
    paddingVertical: BrandTokens.spacing.sm,
    marginTop: BrandTokens.spacing.sm
  },
  chatButtonLabel: {
    color: BrandTokens.colors.primaryStrong,
    fontWeight: "700"
  },
  chatStack: {
    gap: BrandTokens.spacing.sm,
    marginTop: BrandTokens.spacing.sm
  },
  trackingCard: {
    gap: BrandTokens.spacing.xs,
    marginTop: BrandTokens.spacing.sm,
    borderRadius: BrandTokens.radius.md,
    backgroundColor: BrandTokens.colors.surfaceStrong,
    padding: BrandTokens.spacing.md
  },
  chatBubble: {
    gap: BrandTokens.spacing.xs
  },
  input: {
    minHeight: 92,
    borderRadius: BrandTokens.radius.sm,
    borderWidth: 1,
    borderColor: BrandTokens.colors.border,
    backgroundColor: "rgba(255,255,255,0.96)",
    padding: BrandTokens.spacing.md,
    color: BrandTokens.colors.ink,
    textAlignVertical: "top"
  },
  submitButton: {
    alignItems: "center",
    borderRadius: 999,
    backgroundColor: BrandTokens.colors.primary,
    paddingVertical: BrandTokens.spacing.md
  },
  submitButtonLabel: {
    color: "#ffffff",
    fontWeight: "700"
  }
});
