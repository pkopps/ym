import { DataEngineeringLogger } from "@yardmatch/analytics";
import {
  ActiveSession,
  AddBookingEvidenceRequest,
  AssignBookingRouteLeaderRequest,
  AppNotification,
  AnalyticsEvent,
  Address,
  AvailabilitySlot,
  BookingEvidenceEntry,
  CancelBookingRequest,
  CancelCrewMatchRequest,
  CancelRecurringServicePlanRequest,
  BookingArrivalTracking,
  CompleteBookingRequest,
  ConfirmBookingRequest,
  CreateOpsBookingInterventionRequest,
  CrewAvailabilityDay,
  CrewMatchCandidate,
  CrewMatchesResponse,
  CustomerProviderConversation,
  CustomerProviderConversationThread,
  CustomerProviderMessage,
  getBookingExceptionLabel,
  formatBookingWindowSummary,
  getBookingServiceWindow,
  MarkBookingExceptionRequest,
  MarkBookingLateRequest,
  MarkBookingOnRouteRequest,
  MarkNotificationsReadRequest,
  NotificationChannel,
  NotificationDeliveriesResponse,
  NotificationDeliveryRecord,
  NotificationOpsAlert,
  NotificationOpsChannelHealth,
  NotificationOpsEscalationResponse,
  NotificationOpsHealthResponse,
  NotificationOpsRetrySweepResponse,
  OpsBookingExceptionSummaryItem,
  OpsFinancialExceptionSummaryResponse,
  OpsPayoutRunPreviewResponse,
  OpsRefundSummaryItem,
  ProviderCrewConversation,
  ProviderCrewConversationThread,
  ProviderCrewMessage,
  ProviderPayoutLedgerEntry,
  ProviderPayoutLedgerResponse,
  PublicMarketplaceOverviewResponse,
  CrewOpportunity,
  CrewPayoutLedgerEntry,
  CrewPayoutLedgerResponse,
  CustomerReviewOpportunity,
  CreateProviderReviewRequest,
  CreateCustomerPropertyRequest,
  CreateBookingRequest,
  CreateRecurringServicePlanRequest,
  CreateRecurringServicePlanResponse,
  CreateBookingDisputeRequest,
  CreateExternalCalendarImportRequest,
  CreateCheckoutSessionRequest,
  CreateCheckoutSessionResponse,
  InstantQuoteRequest,
  InstantQuoteResponse,
  ListCustomerReviewOpportunitiesResponse,
  ListRecurringServicePlansResponse,
  CreatePaymentIntentRequest,
  CreateOpsRefundOverrideRequest,
  FinalizeCheckoutSessionRequest,
  ProcessReviewInvitesRequest,
  ProcessReviewInvitesResponse,
  RequestPasswordResetRequest,
  RequestPasswordResetResponse,
  CreateRefundRequest,
  CreateSupportTicketRequest,
  UpdateSupportTicketRequest,
  Booking,
  BookingServiceWindowKey,
  BookingInterventionRecord,
  BookingRouteStop,
  CrewMemberProfile,
  CrewMemberSchedulePreference,
  CustomerProperty,
  ObservabilityOverview,
  CustomerProfile,
  CurrentUserResponse,
  NotificationListResponse,
  NotificationPreferences,
  PaymentRecord,
  ProviderAssistantActionType,
  ProviderAssistantBookingCandidate,
  ProviderAssistantCommandRequest,
  ProviderAssistantCommandResponse,
  PushDevice,
  RecurringServicePlan,
  RecurringServicePlanSummary,
  ProviderProfile,
  ProviderVerificationQueueItem,
  ExternalCalendarBlock,
  ExternalCalendarSubscription,
  ProviderReview,
  ReviewBookingEvidenceForOpsRequest,
  ProviderStaffingJobSummary,
  ProviderStaffingOverview,
  ProviderCalendarSubscriptionResponse,
  ProviderCalendarSubscriptionAction,
  ProviderCalendarImportsResponse,
  ProviderCalendarSyncHealth,
  SyncStaleProviderCalendarImportsResponse,
  ProviderCalendarOverviewResponse,
  ProviderDispatchRangeSummary,
  ProviderDispatchRouteStatus,
  PlaceSearchResponse,
  RegisterUserRequest,
  ReviewProviderVerificationRequest,
  ReviewCrewMatchRequest,
  RemoveExternalCalendarImportRequest,
  RescheduleBookingRequest,
  ReviewInvite,
  ReviewInviteDispatch,
  ClearBookingRouteStopRequest,
  SendCustomerProviderMessageRequest,
  SendProviderCrewMessageRequest,
  SetBookingRouteStopRequest,
  SetDefaultCustomerPropertyRequest,
  SessionHeartbeatRequest,
  SearchProvidersRequest,
  SearchProviderResult,
  SearchProvidersResponse,
  StartBookingRequest,
  ConfirmPasswordResetRequest,
  UpdateBookingRouteLocationRequest,
  UpdateCrewPreferencesRequest,
  UpdateNotificationPreferencesRequest,
  RegisterPushDeviceRequest,
  RemovePushDeviceRequest,
  UpdateProviderSettingsRequest,
  SupportTicket,
  SupportOpsTicket,
  SyncExternalCalendarImportRequest,
  UpdateBookingAddressRequest,
  UpdateBookingAddressResponse
} from "@yardmatch/contracts";
import {
  BookingAddressPolicyService,
  BookingLifecycleService,
  GeoService,
  InstantQuoteEngine,
  PropertyBookService,
  ProviderMatchService,
  SchedulingService
} from "@yardmatch/domain";
import { MarketplaceTelemetryEventCatalog } from "@yardmatch/observability";
import {
  PASSWORD_RESET_TTL_MINUTES,
  generatePasswordResetCode,
  hashPassword,
  hashPasswordResetCode,
  validatePasswordStrength
} from "../auth";
import { HttpError } from "../http";
import { AuthIdentityRecord, MarketplaceRepository } from "../repositories/MarketplaceRepository";
import { NotificationDeliveryService } from "./NotificationDeliveryService";
import { AddressValidationOutcome, AddressValidationService } from "./AddressValidationService";
import { PlaceSearchService } from "./PlaceSearchService";
import { PaymentCheckoutGateway, StripeCheckoutService } from "./StripeCheckoutService";

type ParsedProviderAssistantAction = {
  command: string;
  actionType: ProviderAssistantActionType;
  sourceWindowKey?: "morning" | "afternoon" | "late-afternoon-night";
  targetWindowKey?: "morning" | "afternoon" | "late-afternoon-night";
  notifyCustomer: boolean;
  dispatchScope?: "today" | "tomorrow" | "next-7-days";
  dispatchFocus?: "summary" | "attention";
  crewMatchCrewNameQuery?: string;
  routeLeaderCrewNameQuery?: string;
  crewMessageCrewNameQuery?: string;
  crewMessageBody?: string;
  routeStopKind?: SetBookingRouteStopRequest["kind"];
  lateMinutes?: number;
  lateReason?: string;
  exceptionType?: MarkBookingExceptionRequest["exceptionType"];
  exceptionNotes?: string;
};

type ParsedProviderAssistantCommand = {
  understood: boolean;
  actionType?: ProviderAssistantActionType;
  actionTypes: ProviderAssistantActionType[];
  actions: ParsedProviderAssistantAction[];
  dispatchScope?: "today" | "tomorrow" | "next-7-days";
  dispatchFocus?: "summary" | "attention";
  sourceWindowKey?: "morning" | "afternoon" | "late-afternoon-night";
  targetWindowKey?: "morning" | "afternoon" | "late-afternoon-night";
  notifyCustomer: boolean;
  routeLeaderCrewNameQuery?: string;
  lateMinutes?: number;
  lateReason?: string;
  exceptionType?: MarkBookingExceptionRequest["exceptionType"];
  exceptionNotes?: string;
};

export class MarketplacePlatformService {
  private static readonly reviewInviteDelayHours = 48;
  private static readonly reviewInviteExpiryDays = 30;
  private static readonly liveRouteLocationStaleMinutes = 5;
  private static readonly routeStopReachedThresholdMiles = 0.12;
  private static readonly routeStopDwellMinutes = 6;
  private readonly payoutHoldHours = 48;
  private readonly instantPayoutMinimumCents = 10_000;
  private readonly crewPayoutWeekday: CrewAvailabilityDay = "Fri";
  private readonly geoService = new GeoService();
  private readonly providerMatcher = new ProviderMatchService(this.geoService);
  private readonly schedulingService = new SchedulingService();
  private readonly bookingLifecycle = new BookingLifecycleService();
  private readonly propertyBook = new PropertyBookService();
  private readonly bookingAddressPolicy = new BookingAddressPolicyService(this.geoService);
  private readonly instantQuoteEngine = new InstantQuoteEngine();
  private readonly placeSearch = new PlaceSearchService(process.env.GOOGLE_MAPS_API_KEY);
  private readonly addressValidation = new AddressValidationService(
    process.env.GOOGLE_ADDRESS_VALIDATION_API_KEY
  );
  private readonly notificationDelivery = new NotificationDeliveryService();
  private readonly stripeCheckout: PaymentCheckoutGateway;
  private readonly appBaseUrl: string;
  private readonly apiBaseUrl: string;

  public constructor(
    private readonly repository: MarketplaceRepository,
    private readonly analytics: DataEngineeringLogger,
    stripeCheckout: PaymentCheckoutGateway = new StripeCheckoutService(),
    appBaseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000"
  ) {
    this.stripeCheckout = stripeCheckout;
    this.appBaseUrl = appBaseUrl;
    this.apiBaseUrl =
      process.env.API_BASE_URL ?? `http://localhost:${process.env.PORT ?? "4000"}`;
  }

  public async registerUser(
    payload: Omit<RegisterUserRequest, "password"> & Partial<Pick<RegisterUserRequest, "password">>,
    passwordHash?: string
  ): Promise<CustomerProfile | CrewMemberProfile | ProviderProfile> {
    const now = new Date().toISOString();
    const validatedAddress = await this.normalizeAndValidateAddress(payload.address);
    const normalizedAddress = validatedAddress.address;

    if (payload.role === "customer") {
      const primaryProperty = {
        id: crypto.randomUUID(),
        label: payload.propertyLabel ?? "Primary property",
        address: normalizedAddress,
        accessNotes: payload.propertyNotes,
        lawnSizeSqFt: payload.lawnSizeSqFt,
        isDefault: true,
        createdAt: now
      };

      const customer: CustomerProfile = {
        id: crypto.randomUUID(),
        fullName: payload.fullName,
        email: payload.email,
        phone: payload.phone,
        role: "customer",
        address: normalizedAddress,
        createdAt: now,
        propertyNotes: payload.propertyNotes ?? "",
        lawnSizeSqFt: payload.lawnSizeSqFt ?? 0,
        properties: [primaryProperty],
        defaultPropertyId: primaryProperty.id
      };

      this.analytics.recordFunnelStep(MarketplaceTelemetryEventCatalog.customerRegistered, customer.id, {
        city: customer.address.city,
        lawnSizeSqFt: customer.lawnSizeSqFt
      });
      return this.repository.createCustomer(customer, passwordHash);
    }

    if (payload.role === "crew-member") {
      const crewMember: CrewMemberProfile = {
        id: crypto.randomUUID(),
        fullName: payload.fullName,
        email: payload.email,
        phone: payload.phone,
        role: "crew-member",
        address: normalizedAddress,
        createdAt: now,
        bio:
          payload.bio ??
          "Dependable crew member available for recurring lawn care, cleanup, and seasonal field work.",
        yearsExperience: payload.yearsExperience ?? 1,
        categories: payload.categories ?? ["lawn-mowing", "seasonal-cleanup"],
        availableWeekdays: payload.availableWeekdays ?? ["Mon", "Tue", "Wed", "Thu", "Fri"],
        willingToTravelMiles: payload.willingToTravelMiles ?? 20,
        preferredSchedule: payload.preferredSchedule ?? "flex",
        hasOwnEquipment: payload.hasOwnEquipment ?? false,
        winterWorkEnabled: payload.winterWorkEnabled ?? true,
        rating: 5,
        completedJobs: 0,
        cancellationCount: 0,
        status: "available"
      };

      this.analytics.recordFunnelStep(
        MarketplaceTelemetryEventCatalog.crewMemberRegistered,
        crewMember.id,
        {
          city: crewMember.address.city,
          willingToTravelMiles: crewMember.willingToTravelMiles,
          preferredSchedule: crewMember.preferredSchedule
        }
      );
      return this.repository.createCrewMember(crewMember, passwordHash);
    }

    const provider: ProviderProfile = {
      id: crypto.randomUUID(),
      fullName: payload.fullName,
      email: payload.email,
      phone: payload.phone,
      role: "provider",
      address: normalizedAddress,
      createdAt: now,
      companyName: payload.companyName ?? `${payload.fullName} Landscaping`,
      bio: payload.bio ?? "Quality lawn care and landscaping services.",
      yearsExperience: payload.yearsExperience ?? 1,
      serviceRadiusMiles: payload.serviceRadiusMiles ?? 15,
      minimumBookingLeadHours: 0,
      staffingMode: "review-first",
      crewReviewLeadHours: 24,
      departureReminderLeadMinutes: 60,
      routeLeaderMode: "provider-only",
      weeklyPayoutDay: "Thu",
      instantPayoutsEnabled: false,
      verificationStatus: "pending-review",
      verificationSubmittedAt: now,
      sponsoredListingEnabled: false,
      categories: payload.categories ?? ["lawn-mowing"],
      rating: 5,
      timelinessRating: 5,
      attentionToDetailRating: 5,
      reviewCount: 0,
      calendarConnection: {
        provider: "google",
        connected: false
      }
    };

    this.analytics.recordFunnelStep(MarketplaceTelemetryEventCatalog.providerRegistered, provider.id, {
      city: provider.address.city,
      serviceRadiusMiles: provider.serviceRadiusMiles
    });
    return this.repository.createProvider(provider, passwordHash);
  }

  public async requestPasswordReset(
    payload: RequestPasswordResetRequest
  ): Promise<RequestPasswordResetResponse> {
    const email = payload.email.trim().toLowerCase();
    const identity = await this.repository.findAuthIdentityByEmail(email);

    if (!identity?.passwordHash) {
      return {
        success: true,
        message: "If that account exists, YardMatch has prepared a password reset code."
      };
    }

    const resetCode = generatePasswordResetCode();
    const expiresAtIso = new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000).toISOString();
    await this.repository.updateAuthIdentity(identity.userId, {
      resetPasswordCodeHash: hashPasswordResetCode(email, resetCode),
      resetPasswordExpiresAt: expiresAtIso,
      resetPasswordRequestedAt: new Date().toISOString()
    });

    await this.createNotification({
      recipientId: identity.userId,
      recipientRole: identity.role,
      category: "account",
      title: "Password reset requested",
      body: "Use the latest YardMatch password reset code to finish securing your account.",
      actionHref: "/login"
    });

    return {
      success: true,
      message: "If that account exists, YardMatch has prepared a password reset code.",
      expiresAtIso,
      resetCodePreview: resetCode,
      resetUrlPreview: `${this.appBaseUrl}/login?resetCode=${encodeURIComponent(resetCode)}&email=${encodeURIComponent(email)}`
    };
  }

  public async confirmPasswordReset(
    payload: ConfirmPasswordResetRequest
  ): Promise<CustomerProfile | CrewMemberProfile | ProviderProfile> {
    const email = payload.email.trim().toLowerCase();
    const identity = await this.repository.findAuthIdentityByEmail(email);

    if (!identity?.passwordHash) {
      throw new HttpError(400, "Invalid password reset code");
    }

    if (!identity.resetPasswordCodeHash || !identity.resetPasswordExpiresAt) {
      throw new HttpError(400, "Password reset code has expired");
    }

    if (new Date(identity.resetPasswordExpiresAt).getTime() <= Date.now()) {
      throw new HttpError(400, "Password reset code has expired");
    }

    const expectedHash = hashPasswordResetCode(email, payload.resetCode.trim());
    if (expectedHash !== identity.resetPasswordCodeHash) {
      throw new HttpError(400, "Invalid password reset code");
    }

    validatePasswordStrength(payload.newPassword);
    const nextSessionVersion = (identity.sessionVersion ?? 1) + 1;
    await this.repository.updateAuthIdentity(identity.userId, {
      passwordHash: hashPassword(payload.newPassword),
      sessionVersion: nextSessionVersion,
      resetPasswordCodeHash: undefined,
      resetPasswordExpiresAt: undefined,
      resetPasswordRequestedAt: undefined
    });

    await this.createNotification({
      recipientId: identity.userId,
      recipientRole: identity.role,
      category: "account",
      title: "Password updated",
      body: "Your YardMatch password was changed and older sessions were signed out.",
      actionHref: "/login"
    });

    const updatedIdentity = await this.repository.findAuthIdentityByUserId(identity.userId);
    if (!updatedIdentity) {
      throw new HttpError(404, "User profile not found");
    }

    const user = await this.getUserByIdentity(updatedIdentity);
    if (!user) {
      throw new HttpError(404, "User profile not found");
    }

    return user;
  }

  public async searchPlaces(query: string): Promise<PlaceSearchResponse> {
    return this.placeSearch.search(query);
  }

  public async listNotifications(identity: AuthIdentityRecord): Promise<NotificationListResponse> {
    await this.ensureTimedNotifications(identity);
    await this.retryDueNotificationDeliveries(identity);
    const notifications = (await this.repository.listNotificationsByRecipient(identity.userId))
      .filter((notification) => notification.recipientRole === identity.role)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

    return {
      notifications,
      unreadCount: notifications.filter((notification) => !notification.isRead).length
    };
  }

  public async markNotificationsRead(
    identity: AuthIdentityRecord,
    payload: MarkNotificationsReadRequest
  ): Promise<NotificationListResponse> {
    await this.ensureTimedNotifications(identity);
    await this.retryDueNotificationDeliveries(identity);
    const notifications = (await this.repository.listNotificationsByRecipient(identity.userId)).filter(
      (notification) => notification.recipientRole === identity.role
    );
    const targetIds =
      payload.notificationIds && payload.notificationIds.length > 0
        ? new Set(payload.notificationIds)
        : new Set(notifications.filter((notification) => !notification.isRead).map((notification) => notification.id));
    const nowIso = new Date().toISOString();

    await Promise.all(
      notifications
        .filter((notification) => targetIds.has(notification.id) && !notification.isRead)
        .map((notification) =>
          this.repository.updateNotification(notification.id, {
            isRead: true,
            readAt: nowIso
          })
        )
    );

    return this.listNotifications(identity);
  }

  public async getNotificationPreferences(identity: AuthIdentityRecord): Promise<NotificationPreferences> {
    return this.ensureNotificationPreferences(identity);
  }

  public async updateNotificationPreferences(
    identity: AuthIdentityRecord,
    payload: UpdateNotificationPreferencesRequest
  ): Promise<NotificationPreferences> {
    const current = await this.ensureNotificationPreferences(identity);
    const updatedAt = new Date().toISOString();

    return this.repository.upsertNotificationPreferences({
      ...current,
      emailEnabled: payload.emailEnabled ?? current.emailEnabled,
      smsEnabled: payload.smsEnabled ?? current.smsEnabled,
      pushEnabled: payload.pushEnabled ?? current.pushEnabled,
      reviewRemindersEnabled: payload.reviewRemindersEnabled ?? current.reviewRemindersEnabled,
      updatedAt
    });
  }

  public async listNotificationDeliveries(
    identity: AuthIdentityRecord
  ): Promise<NotificationDeliveriesResponse> {
    await this.ensureTimedNotifications(identity);
    await this.retryDueNotificationDeliveries(identity);
    const deliveries = (await this.repository.listNotificationDeliveriesByRecipient(identity.userId))
      .filter((delivery) => delivery.recipientRole === identity.role)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

    return {
      deliveries
    };
  }

  public async getNotificationOpsHealth(): Promise<NotificationOpsHealthResponse> {
    const now = Date.now();
    const last24Hours = now - 24 * 60 * 60 * 1000;
    const deliveries = (await this.repository.listAllNotificationDeliveries()).sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt)
    );
    const deliveriesLast24Hours = deliveries.filter((delivery) => Date.parse(delivery.createdAt) >= last24Hours);
    const failedDeliveries = deliveries.filter((delivery) => delivery.status === "failed");
    const queuedCount = deliveries.filter((delivery) => delivery.status === "queued").length;
    const pendingRetryDeliveries = failedDeliveries.filter((delivery) => Boolean(delivery.nextRetryAt));
    const overdueRetryDeliveries = pendingRetryDeliveries.filter(
      (delivery) => Date.parse(delivery.nextRetryAt as string) <= now
    );
    const exhaustedFailureCount = failedDeliveries.filter((delivery) => !delivery.nextRetryAt).length;
    const sentLast24Hours = deliveries.filter((delivery) => {
      const sentAt = delivery.sentAt ?? delivery.lastAttemptAt;
      return Boolean(sentAt) && Date.parse(sentAt as string) >= last24Hours && delivery.status === "sent";
    }).length;
    const failedLast24Hours = failedDeliveries.filter((delivery) => {
      const failedAt = delivery.lastAttemptAt ?? delivery.createdAt;
      return Date.parse(failedAt) >= last24Hours;
    }).length;
    const channels = this.buildNotificationOpsChannelHealth(deliveries, now, last24Hours);
    const alerts = this.buildNotificationOpsAlerts({
      deliveriesLast24Hours: deliveriesLast24Hours.length,
      failedLast24Hours,
      pendingRetryCount: pendingRetryDeliveries.length,
      overdueRetryCount: overdueRetryDeliveries.length,
      exhaustedFailureCount,
      channels
    });

    return {
      generatedAt: new Date().toISOString(),
      totalDeliveries: deliveries.length,
      deliveriesLast24Hours: deliveriesLast24Hours.length,
      sentLast24Hours,
      failedLast24Hours,
      queuedCount,
      pendingRetryCount: pendingRetryDeliveries.length,
      overdueRetryCount: overdueRetryDeliveries.length,
      exhaustedFailureCount,
      channels,
      recentFailures: failedDeliveries.slice(0, 8),
      alerts
    };
  }

  public async retryDueNotificationDeliveriesForOps(): Promise<NotificationOpsRetrySweepResponse> {
    const dueDeliveries = await this.listDueNotificationDeliveries();
    if (dueDeliveries.length === 0) {
      return {
        retriedCount: 0,
        sentCount: 0,
        failedCount: 0,
        remainingOverdueCount: 0
      };
    }

    await Promise.all(dueDeliveries.map((delivery) => this.dispatchNotificationDelivery(delivery)));

    const updatedDeliveries = await this.repository.listAllNotificationDeliveries();
    const updatedById = new Map(updatedDeliveries.map((delivery) => [delivery.id, delivery]));
    const retried = dueDeliveries
      .map((delivery) => updatedById.get(delivery.id))
      .filter((delivery): delivery is NotificationDeliveryRecord => Boolean(delivery));

    return {
      retriedCount: retried.length,
      sentCount: retried.filter((delivery) => delivery.status === "sent").length,
      failedCount: retried.filter((delivery) => delivery.status === "failed").length,
      remainingOverdueCount: updatedDeliveries.filter(
        (delivery) =>
          delivery.status === "failed" &&
          delivery.nextRetryAt &&
          Date.parse(delivery.nextRetryAt) <= Date.now()
      ).length
    };
  }

  public async escalateNotificationOpsAlerts(): Promise<NotificationOpsEscalationResponse> {
    const health = await this.getNotificationOpsHealth();
    const actionableAlerts = health.alerts.filter((alert) => alert.severity === "warning" || alert.severity === "critical");
    if (actionableAlerts.length === 0) {
      return {
        generatedAt: new Date().toISOString(),
        escalated: false,
        reason: "Delivery health is currently stable, so no external ops escalation was sent.",
        targetCount: 0,
        sentCount: 0,
        failedCount: 0
      };
    }

    const targets = this.notificationDelivery.getOpsAlertTargets();
    if (targets.length === 0) {
      return {
        generatedAt: new Date().toISOString(),
        escalated: false,
        reason: "No NOTIFICATION_ALERT_EMAILS or NOTIFICATION_ALERT_SMS_NUMBERS contacts are configured.",
        targetCount: 0,
        sentCount: 0,
        failedCount: 0
      };
    }

    const title = actionableAlerts.some((alert) => alert.severity === "critical")
      ? "YardMatch notification delivery alert"
      : "YardMatch notification delivery warning";
    const body = actionableAlerts
      .slice(0, 4)
      .map((alert) => `${alert.severity.toUpperCase()}: ${alert.title} — ${alert.detail}`)
      .join("\n");

    let sentCount = 0;
    let failedCount = 0;

    await Promise.all(
      targets.map(async (target) => {
        try {
          const dispatch = await this.notificationDelivery.dispatch({
            channel: target.channel,
            destination: target.destination,
            title,
            body
          });

          await this.repository.createNotificationDelivery({
            id: crypto.randomUUID(),
            notificationId: `ops-alert-${health.generatedAt}`,
            recipientId: "ops-alert-target",
            recipientRole: "provider",
            category: "support",
            channel: target.channel,
            destination: target.destination,
            provider: dispatch.provider,
            status: "sent",
            title,
            bodyPreview: body.slice(0, 160),
            attemptCount: 1,
            createdAt: new Date().toISOString(),
            lastAttemptAt: dispatch.sentAt,
            sentAt: dispatch.sentAt
          });
          sentCount += 1;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Notification ops escalation failed.";
          await this.repository.createNotificationDelivery({
            id: crypto.randomUUID(),
            notificationId: `ops-alert-${health.generatedAt}`,
            recipientId: "ops-alert-target",
            recipientRole: "provider",
            category: "support",
            channel: target.channel,
            destination: target.destination,
            provider: this.notificationDelivery.getProviderName(target.channel, target.destination),
            status: "failed",
            title,
            bodyPreview: body.slice(0, 160),
            errorMessage: message,
            attemptCount: 1,
            createdAt: new Date().toISOString(),
            lastAttemptAt: new Date().toISOString()
          });
          failedCount += 1;
        }
      })
    );

    return {
      generatedAt: new Date().toISOString(),
      escalated: sentCount > 0,
      reason: sentCount > 0 ? "Notification delivery health was escalated to configured ops contacts." : "All configured ops alert attempts failed.",
      targetCount: targets.length,
      sentCount,
      failedCount
    };
  }

  public async registerPushDevice(
    identity: AuthIdentityRecord,
    payload: RegisterPushDeviceRequest
  ): Promise<PushDevice> {
    if (payload.provider !== "expo") {
      throw new HttpError(400, "Unsupported push provider.");
    }
    if (!payload.token.trim()) {
      throw new HttpError(400, "Push token is required.");
    }

    const nowIso = new Date().toISOString();
    return this.repository.upsertPushDevice({
      id: crypto.randomUUID(),
      userId: identity.userId,
      role: identity.role,
      platform: payload.platform,
      provider: payload.provider,
      token: payload.token.trim(),
      isActive: true,
      createdAt: nowIso,
      updatedAt: nowIso,
      lastSeenAt: nowIso
    });
  }

  public async removePushDevice(
    identity: AuthIdentityRecord,
    payload: RemovePushDeviceRequest
  ): Promise<{ success: true }> {
    await this.repository.deactivatePushDevice(payload.token.trim());
    return { success: true };
  }

  public async searchProviders(payload: SearchProvidersRequest): Promise<SearchProvidersResponse> {
    const normalizedAddress = (await this.normalizeAndValidateAddress(payload.address)).address;
    const recommendationSessionId = crypto.randomUUID();
    const providerDecisionMetrics = this.buildProviderDecisionMetrics();

    this.analytics.recordFunnelStep(MarketplaceTelemetryEventCatalog.providerSearchPerformed, "anonymous", {
      recommendationSessionId,
      dateIso: payload.dateIso,
      categoryCount: payload.categories.length,
      city: normalizedAddress.city,
      requestSource: payload.requestSource ?? "unknown"
    });

    const [providers, bookings] = await Promise.all([
      this.repository.listProviders(),
      this.repository.listBookings()
    ]);

    const rankedCandidates = (
      await Promise.all(
        providers
          .filter(
            (provider) =>
              provider.verificationStatus === "verified" &&
              payload.categories.some((category) => provider.categories.includes(category))
          )
          .map(async (provider) => {
            const distanceMiles = this.geoService.distanceMiles(normalizedAddress, provider.address);
            if (distanceMiles > provider.serviceRadiusMiles) {
              return undefined;
            }

            const providerSlots = this.filterProviderSlotsAgainstExternalBlocks(
              provider,
              await this.repository.listSlotsByProvider(provider.id)
            );
            const acceptanceReadySlots = providerSlots.filter((slot) =>
              this.isWithinProviderAcceptanceWindow(provider, slot.startIso)
            );

            const matchingSlots = payload.estimatedDurationMinutes
              ? (() => {
                  const firstMatchingSlot = this.schedulingService.findFirstAvailableSlot(
                    acceptanceReadySlots,
                    payload.estimatedDurationMinutes
                  );
                  return firstMatchingSlot ? [firstMatchingSlot] : [];
                })()
              : acceptanceReadySlots.filter((slot) => !slot.isBooked);

            const suggestedSlot = matchingSlots[0];
            const providerBookings = bookings.filter((booking) => booking.providerId === provider.id);
            const ranking = this.buildSearchProviderRanking(
              payload,
              provider,
              providerBookings,
              distanceMiles,
              suggestedSlot,
              providerDecisionMetrics.get(provider.id)
            );

            return {
              ranking,
              matchingSlots
            };
          })
      )
    )
      .filter(
        (candidate): candidate is { ranking: SearchProviderResult; matchingSlots: AvailabilitySlot[] } =>
          Boolean(candidate)
      )
      .sort((left, right) => {
        if (right.ranking.score !== left.ranking.score) {
          return right.ranking.score - left.ranking.score;
        }

        if (left.ranking.distanceMiles !== right.ranking.distanceMiles) {
          return left.ranking.distanceMiles - right.ranking.distanceMiles;
        }

        return right.ranking.provider.rating - left.ranking.provider.rating;
      });

    const suggestedSlots = rankedCandidates.flatMap((candidate) => candidate.matchingSlots);
    const rankedProviders = this.withCustomerSelectionSummaries(
      rankedCandidates.map((candidate) => candidate.ranking)
    );
    const matchingProviders = rankedProviders.map((candidate) => candidate.provider);
    const recommendedProviderId = rankedProviders[0]?.provider.id;

    this.analytics.record({
      id: crypto.randomUUID(),
      name: MarketplaceTelemetryEventCatalog.providerMatchReturned,
      occurredAt: new Date().toISOString(),
      properties: {
        recommendationSessionId,
        recommendedProviderId,
        providerCount: matchingProviders.length,
        slotCount: suggestedSlots.length,
        city: normalizedAddress.city,
        requestSource: payload.requestSource ?? "unknown"
      }
    });

    if (matchingProviders.length === 0) {
      this.analytics.record({
        id: crypto.randomUUID(),
        name: MarketplaceTelemetryEventCatalog.providerSearchNoResults,
        occurredAt: new Date().toISOString(),
        properties: {
          recommendationSessionId,
          providerCount: 0,
          slotCount: 0,
          city: normalizedAddress.city,
          requestSource: payload.requestSource ?? "unknown"
        }
      });
    } else if (suggestedSlots.length === 0) {
      this.analytics.record({
        id: crypto.randomUUID(),
        name: MarketplaceTelemetryEventCatalog.providerSearchNoOpenWindows,
        occurredAt: new Date().toISOString(),
        properties: {
          recommendationSessionId,
          providerCount: matchingProviders.length,
          slotCount: 0,
          city: normalizedAddress.city,
          requestSource: payload.requestSource ?? "unknown"
        }
      });
    }

    if (recommendedProviderId) {
      this.analytics.record({
        id: crypto.randomUUID(),
        name: MarketplaceTelemetryEventCatalog.recommendationPresented,
        occurredAt: new Date().toISOString(),
        properties: {
          recommendationSessionId,
          recommendedProviderId,
          providerCount: matchingProviders.length,
          city: normalizedAddress.city,
          hasOpenSlot: Boolean(rankedProviders[0]?.hasOpenSlot),
          requestSource: payload.requestSource ?? "unknown"
        }
      });
    }

    return {
      providers: matchingProviders,
      rankedProviders,
      suggestedSlots,
      recommendationSessionId,
      recommendedProviderId
    };
  }

  public async getPublicMarketplaceOverview(): Promise<PublicMarketplaceOverviewResponse> {
    const providers = (await this.repository.listProviders()).filter(
      (provider) => provider.verificationStatus === "verified"
    );
    const featuredProviders = providers
      .slice()
      .sort((left, right) => {
        if (right.reviewCount !== left.reviewCount) {
          return right.reviewCount - left.reviewCount;
        }
        if (right.rating !== left.rating) {
          return right.rating - left.rating;
        }
        return left.companyName.localeCompare(right.companyName);
      })
      .slice(0, 6)
      .map((provider) => ({
        id: provider.id,
        companyName: provider.companyName,
        city: provider.address.city,
        state: provider.address.state,
        rating: provider.rating,
        reviewCount: provider.reviewCount,
        primaryCategory: provider.categories[0]
      }));

    const averageRating =
      providers.length > 0
        ? Number(
            (
              providers.reduce((total, provider) => total + provider.rating, 0) / providers.length
            ).toFixed(1)
          )
        : 0;

    const activeCategoryCount = new Set(
      providers.flatMap((provider) => provider.categories)
    ).size;

    return {
      generatedAt: new Date().toISOString(),
      verifiedProviderCount: providers.length,
      averageRating,
      activeCategoryCount,
      featuredProviders
    };
  }

  public async getProviderProfile(providerId: string): Promise<ProviderProfile> {
    const provider = await this.repository.findProviderById(providerId);
    if (!provider) {
      throw new Error("Provider not found");
    }

    return provider;
  }

  public async listProviderVerificationQueue(): Promise<ProviderVerificationQueueItem[]> {
    const [providers, bookings] = await Promise.all([
      this.repository.listProviders(),
      this.repository.listBookings()
    ]);

    return providers
      .filter((provider) => provider.verificationStatus !== "verified")
      .map((provider) => ({
        provider,
        openBookingCount: bookings.filter(
          (booking) =>
            booking.providerId === provider.id &&
            booking.status !== "completed" &&
            booking.status !== "cancelled" &&
            booking.status !== "refunded"
        ).length,
        reviewCount: provider.reviewCount
      }))
      .sort((left, right) => {
        const rightSubmitted = right.provider.verificationSubmittedAt ?? right.provider.createdAt;
        const leftSubmitted = left.provider.verificationSubmittedAt ?? left.provider.createdAt;
        return rightSubmitted.localeCompare(leftSubmitted);
      });
  }

  public async reviewProviderVerification(
    payload: ReviewProviderVerificationRequest
  ): Promise<ProviderProfile> {
    const provider = await this.repository.findProviderById(payload.providerId);
    if (!provider) {
      throw new HttpError(404, "Provider not found");
    }

    const notes = payload.notes?.trim();
    if (payload.action === "reject" && !notes) {
      throw new HttpError(400, "Notes are required when rejecting a provider verification");
    }

    const updatedProvider = await this.repository.updateProvider(provider.id, {
      verificationStatus: payload.action === "approve" ? "verified" : "rejected",
      verificationReviewedAt: new Date().toISOString(),
      verificationNotes:
        notes ??
        (payload.action === "approve"
          ? "Ops verified the business profile for public marketplace visibility."
          : provider.verificationNotes)
    });

    if (!updatedProvider) {
      throw new HttpError(500, "Provider verification could not be updated");
    }

    await this.createNotification({
      recipientId: updatedProvider.id,
      recipientRole: "provider",
      category: "account",
      title:
        payload.action === "approve"
          ? "Business verification approved"
          : "Business verification needs updates",
      body:
        payload.action === "approve"
          ? "Your business is now verified and visible in YardMatch search results."
          : notes ??
            "Ops reviewed the business profile and left notes before it can go live in search.",
      actionHref: "/provider/management"
    });

    return updatedProvider;
  }

  public async updateCrewPreferences(
    crewMemberId: string,
    payload: UpdateCrewPreferencesRequest
  ): Promise<CrewMemberProfile> {
    const crewMember = await this.repository.findCrewMemberById(crewMemberId);
    if (!crewMember) {
      throw new Error("Crew member not found");
    }

    const nextMiles = payload.willingToTravelMiles ?? crewMember.willingToTravelMiles;
    if (nextMiles < 5 || nextMiles > 60) {
      throw new Error("willingToTravelMiles must be between 5 and 60");
    }

    const nextDays =
      payload.availableWeekdays ?? crewMember.availableWeekdays ?? ["Mon", "Tue", "Wed", "Thu", "Fri"];
    if (nextDays.length === 0) {
      throw new Error("At least one available day is required");
    }

    const updatedCrewMember = await this.repository.updateCrewMember(crewMemberId, {
      categories: payload.categories ?? crewMember.categories,
      availableWeekdays: nextDays,
      willingToTravelMiles: nextMiles,
      preferredSchedule: payload.preferredSchedule ?? crewMember.preferredSchedule,
      hasOwnEquipment: payload.hasOwnEquipment ?? crewMember.hasOwnEquipment,
      winterWorkEnabled: payload.winterWorkEnabled ?? crewMember.winterWorkEnabled ?? true
    });

    if (!updatedCrewMember) {
      throw new Error("Crew preferences could not be updated");
    }

    return updatedCrewMember;
  }

  public async getProviderStaffingOverview(providerId: string): Promise<ProviderStaffingOverview> {
    const provider = await this.repository.findProviderById(providerId);
    if (!provider) {
      throw new Error("Provider not found");
    }

    const jobs = await this.buildProviderStaffingSummaries(provider);
    return {
      provider,
      jobs
    };
  }

  public async reviewCrewMatch(
    providerId: string,
    payload: ReviewCrewMatchRequest
  ): Promise<CrewMatchCandidate> {
    const match = await this.repository.findCrewMatchById(payload.crewMatchId);
    if (!match) {
      throw new Error("Crew match not found");
    }

    if (match.providerId !== providerId) {
      throw new Error("Only the provider can review this crew match");
    }

    const nextStatus = payload.action === "accept" ? "accepted" : "denied";
    const updatedMatch = await this.repository.updateCrewMatch(match.id, {
      status: nextStatus,
      autoAccepted: false,
      reviewedAt: new Date().toISOString()
    });

    if (!updatedMatch) {
      throw new Error("Crew match could not be updated");
    }

    const booking = await this.repository.findBookingById(match.bookingId);
    if (
      booking?.assignedRouteLeaderCrewMemberId === updatedMatch.crewMemberId &&
      updatedMatch.status !== "accepted"
    ) {
      await this.repository.updateBooking(booking.id, {
        assignedRouteLeaderCrewMemberId: undefined
      });
    }

    await this.refreshCrewMemberStatus(updatedMatch.crewMemberId);
    const provider = await this.repository.findProviderById(providerId);
    if (provider) {
      await this.createNotification({
        recipientId: updatedMatch.crewMemberId,
        recipientRole: "crew-member",
        category: "staffing",
        title: payload.action === "accept" ? "You were accepted for a job" : "A crew match was declined",
        body:
          payload.action === "accept"
            ? `${provider.companyName} added you to an upcoming ${this.titleCaseCategory(updatedMatch.categories[0] ?? "lawn-mowing")} job.`
            : `${provider.companyName} passed on one of your staffing matches.`,
        actionHref: "/crew/schedule"
      });
    }

    return updatedMatch;
  }

  public async assignBookingRouteLeader(
    providerId: string,
    payload: AssignBookingRouteLeaderRequest
  ): Promise<Booking> {
    const booking = await this.repository.findBookingById(payload.bookingId);
    if (!booking || booking.providerId !== providerId) {
      throw new HttpError(404, "Booking not found for this provider");
    }

    const provider = await this.repository.findProviderById(providerId);
    if (!provider) {
      throw new HttpError(404, "Provider not found");
    }

    if (provider.routeLeaderMode !== "accepted-crew-fallback") {
      throw new HttpError(400, "Enable accepted crew fallback before assigning a crew route leader");
    }

    if (
      booking.status === "completed" ||
      booking.status === "cancelled" ||
      booking.status === "refunded"
    ) {
      throw new HttpError(400, "Route leaders can only be assigned on active bookings");
    }

    if (booking.onRouteConfirmedAt) {
      throw new HttpError(400, "Route leader assignment is locked once the route has started");
    }

    const acceptedMatches = (await this.repository.listCrewMatches()).filter(
      (match) => match.bookingId === booking.id && match.status === "accepted"
    );

    if (payload.crewMemberId) {
      const assignedMatch = acceptedMatches.find((match) => match.crewMemberId === payload.crewMemberId);
      if (!assignedMatch) {
        throw new HttpError(400, "Only accepted crew members can be assigned as route leader");
      }

      const updatedBooking = await this.repository.updateBooking(booking.id, {
        assignedRouteLeaderCrewMemberId: payload.crewMemberId
      });

      if (!updatedBooking) {
        throw new HttpError(500, "Route leader could not be assigned");
      }

      const crewMember = await this.repository.findCrewMemberById(payload.crewMemberId);
      if (crewMember) {
        await this.createNotification({
          recipientId: crewMember.id,
          recipientRole: "crew-member",
          category: "staffing",
          title: "You were assigned as route leader",
          body: `${provider.companyName} chose you to start and share the route for an upcoming ${this.titleCaseCategory(booking.category).toLowerCase()} job.`,
          actionHref: "/crew/schedule"
        });
      }

      return updatedBooking;
    }

    const clearedBooking = await this.repository.updateBooking(booking.id, {
      assignedRouteLeaderCrewMemberId: undefined
    });
    if (!clearedBooking) {
      throw new HttpError(500, "Route leader assignment could not be updated");
    }
    return clearedBooking;
  }

  public async getCrewMatchesForCrew(crewMemberId: string): Promise<CrewMatchesResponse> {
    const crewMember = await this.repository.findCrewMemberById(crewMemberId);
    if (!crewMember) {
      throw new Error("Crew member not found");
    }

    await this.reconcileCrewMatches();

    const [matches, providers, bookings] = await Promise.all([
      this.repository.listCrewMatches(),
      this.repository.listProviders(),
      this.repository.listBookings()
    ]);

    return {
      crewMember,
      matches: matches
        .filter((match) => match.crewMemberId === crewMemberId)
        .flatMap((match) => {
          const provider = providers.find((item) => item.id === match.providerId);
          const booking = bookings.find((item) => item.id === match.bookingId);
          if (!provider || !booking) {
            return [];
          }

          const acceptedMatchCount = matches.filter(
            (candidate) => candidate.bookingId === booking.id && candidate.status === "accepted"
          ).length;
          return [this.buildCrewMatchSummary(match, provider, booking, acceptedMatchCount)];
        })
        .sort((left, right) => left.scheduledStartIso.localeCompare(right.scheduledStartIso))
    };
  }

  public async cancelCrewMatch(
    crewMemberId: string,
    payload: CancelCrewMatchRequest
  ): Promise<CrewMatchesResponse["matches"][number]> {
    const [crewMember, match] = await Promise.all([
      this.repository.findCrewMemberById(crewMemberId),
      this.repository.findCrewMatchById(payload.crewMatchId)
    ]);

    if (!crewMember) {
      throw new HttpError(404, "Crew member not found");
    }

    if (!match || match.crewMemberId !== crewMemberId) {
      throw new HttpError(404, "Crew match not found");
    }

    if (match.status !== "accepted") {
      throw new HttpError(400, "Only accepted assignments can be cancelled by the crew member");
    }

    const [provider, booking] = await Promise.all([
      this.repository.findProviderById(match.providerId),
      this.repository.findBookingById(match.bookingId)
    ]);

    if (!provider || !booking) {
      throw new HttpError(404, "Assignment details could not be found");
    }

    if (booking.status === "completed" || booking.status === "cancelled" || booking.status === "refunded") {
      throw new HttpError(400, "This assignment is no longer active");
    }

    if (booking.onRouteConfirmedAt || booking.status === "in-progress") {
      throw new HttpError(400, "This assignment can no longer be cancelled because work is already underway");
    }

    if (new Date(booking.scheduledStartIso).getTime() <= Date.now()) {
      throw new HttpError(400, "This assignment can no longer be cancelled because the start time has passed");
    }

    const cancelledAt = new Date().toISOString();
    const cancellationReason = payload.reason?.trim() || "Crew member cancelled this assignment.";
    const updatedMatch = await this.repository.updateCrewMatch(match.id, {
      status: "cancelled-by-crew",
      reviewedAt: cancelledAt,
      cancelledAt,
      cancellationReason
    });

    if (!updatedMatch) {
      throw new HttpError(500, "Crew assignment could not be cancelled");
    }

    if (booking.assignedRouteLeaderCrewMemberId === crewMemberId) {
      await this.repository.updateBooking(booking.id, {
        assignedRouteLeaderCrewMemberId: undefined
      });
    }

    await this.repository.updateCrewMember(crewMemberId, {
      cancellationCount: (crewMember.cancellationCount ?? 0) + 1,
      lastCancellationAt: cancelledAt
    });

    const existingConversation = await this.repository.findProviderCrewConversationByCrewMatchId(match.id);
    if (existingConversation) {
      await this.repository.updateProviderCrewConversation(existingConversation.id, {
        status: "cancelled-by-crew",
        updatedAt: cancelledAt,
        lastMessagePreview: `${crewMember.fullName} cancelled this assignment.`
      });
    }

    await this.refreshCrewMemberStatus(crewMemberId);
    await this.reconcileCrewMatches(provider.id);

    await this.createNotification({
      recipientId: provider.id,
      recipientRole: "provider",
      category: "staffing",
      title: "Crew member cancelled",
      body: `${crewMember.fullName} cancelled an accepted assignment for ${this.titleCaseCategory(booking.category).toLowerCase()}.`,
      actionHref: "/provider/management"
    });

    await this.createNotification({
      recipientId: crewMemberId,
      recipientRole: "crew-member",
      category: "staffing",
      title: "Assignment cancelled",
      body: "This cancellation was recorded and may lower your future match priority if it becomes a pattern.",
      actionHref: "/crew/schedule"
    });

    const acceptedMatchCount = (await this.repository.listCrewMatches()).filter(
      (candidate) => candidate.bookingId === booking.id && candidate.status === "accepted"
    ).length;
    const refreshedBooking = (await this.repository.findBookingById(booking.id)) ?? booking;
    return this.buildCrewMatchSummary(updatedMatch, provider, refreshedBooking, acceptedMatchCount);
  }

  public async listProviderCrewConversations(
    actor: AuthIdentityRecord
  ): Promise<ProviderCrewConversation[]> {
    const conversations = await this.repository.listProviderCrewConversations();
    return conversations.filter((conversation) =>
      actor.role === "provider"
        ? conversation.providerId === actor.userId
        : conversation.crewMemberId === actor.userId
    );
  }

  private buildCrewMatchSummary(
    match: CrewMatchCandidate,
    provider: ProviderProfile,
    booking: Booking,
    acceptedMatchCount: number
  ): CrewMatchesResponse["matches"][number] {
    const resolvedRouteLeaderCrewMemberId =
      booking.assignedRouteLeaderCrewMemberId ??
      (acceptedMatchCount === 1 && match.status === "accepted" ? match.crewMemberId : undefined);
    const requiresRouteLeaderAssignment =
      provider.routeLeaderMode === "accepted-crew-fallback" &&
      acceptedMatchCount > 1 &&
      !booking.assignedRouteLeaderCrewMemberId;
    return {
      id: match.id,
      bookingId: match.bookingId,
      providerId: match.providerId,
      providerCompanyName: provider.companyName,
      providerPhone: provider.phone,
      category: booking.category,
      serviceAddress: booking.serviceAddress,
      scheduledStartIso: booking.scheduledStartIso,
      scheduledEndIso: booking.scheduledEndIso,
      bookingStatus: booking.status,
      assignedRouteLeaderCrewMemberId: resolvedRouteLeaderCrewMemberId,
      isAssignedRouteLeader: resolvedRouteLeaderCrewMemberId === match.crewMemberId,
      requiresRouteLeaderAssignment,
      onRouteConfirmedAt: booking.onRouteConfirmedAt,
      lateNoticeSentAt: booking.lateNoticeSentAt,
      lateEtaIso: booking.lateEtaIso,
      lateReason: booking.lateReason,
      activeExceptionType: booking.activeExceptionType,
      activeExceptionReportedAt: booking.activeExceptionReportedAt,
      activeExceptionNotes: booking.activeExceptionNotes,
      disputedAt: booking.disputedAt,
      disputeReason: booking.disputeReason,
      disputedByRole: booking.disputedByRole,
      beforeEvidenceCount: this.countBookingEvidence(booking, "before"),
      afterEvidenceCount: this.countBookingEvidence(booking, "after"),
      status: match.status,
      hourlyRateCents: match.hourlyRateCents,
      canChat: match.status === "pending-provider-review" || match.status === "accepted",
      summary:
        match.status === "accepted"
          ? `${provider.companyName} accepted you for this job.`
          : match.status === "denied"
            ? `${provider.companyName} passed on this match.`
            : match.status === "cancelled-by-crew"
              ? `You cancelled this accepted assignment with ${provider.companyName}.`
              : `${provider.companyName} is reviewing your fit for this job.`,
      cancellationReason: match.cancellationReason,
      cancelledAt: match.cancelledAt
    };
  }

  private resolveDelegatedCrewRouteLeaderId(
    booking: Booking,
    acceptedMatches: CrewMatchCandidate[]
  ): string | undefined {
    if (
      booking.assignedRouteLeaderCrewMemberId &&
      acceptedMatches.some((match) => match.crewMemberId === booking.assignedRouteLeaderCrewMemberId)
    ) {
      return booking.assignedRouteLeaderCrewMemberId;
    }

    return acceptedMatches.length === 1 ? acceptedMatches[0]?.crewMemberId : undefined;
  }

  private async resolveProviderAssistantCrewMatch(
    crewNameQuery: string | undefined,
    matches: CrewMatchCandidate[]
  ): Promise<(CrewMatchCandidate & { crewMemberName: string }) | undefined> {
    const query = crewNameQuery?.trim().toLowerCase();
    if (!query) {
      return undefined;
    }

    const crewMembers = await Promise.all(
      matches.map(async (match) => ({
        ...match,
        crewMemberId: match.crewMemberId,
        crewMemberName: (await this.repository.findCrewMemberById(match.crewMemberId))?.fullName ?? "Crew member"
      }))
    );

    const normalizedQuery = query.replace(/^the\s+/i, "").trim();
    const exact = crewMembers.find((crewMember) => crewMember.crewMemberName.toLowerCase() === normalizedQuery);
    if (exact) {
      return exact;
    }

    const partialMatches = crewMembers.filter((crewMember) => {
      const normalizedName = crewMember.crewMemberName.toLowerCase();
      return normalizedName.includes(normalizedQuery) || normalizedQuery.includes(normalizedName);
    });

    return partialMatches.length === 1 ? partialMatches[0] : undefined;
  }

  public async getProviderCrewConversationThread(
    actor: AuthIdentityRecord,
    threadId?: string,
    crewMatchId?: string
  ): Promise<ProviderCrewConversationThread> {
    const thread = threadId
      ? await this.repository.findProviderCrewConversationById(threadId)
      : crewMatchId
        ? await this.repository.findProviderCrewConversationByCrewMatchId(crewMatchId)
        : undefined;

    if (!thread) {
      throw new Error("Conversation not found");
    }

    this.assertCanAccessConversation(actor, thread);
    const messages = await this.repository.listProviderCrewMessages(thread.id);
    return {
      thread,
      messages
    };
  }

  public async sendProviderCrewMessage(
    actor: AuthIdentityRecord,
    payload: SendProviderCrewMessageRequest
  ): Promise<ProviderCrewConversationThread> {
    const body = payload.body.trim();
    if (body.length === 0) {
      throw new Error("Message body is required");
    }

    let thread = payload.threadId
      ? await this.repository.findProviderCrewConversationById(payload.threadId)
      : payload.crewMatchId
        ? await this.repository.findProviderCrewConversationByCrewMatchId(payload.crewMatchId)
        : undefined;

    if (!thread && !payload.crewMatchId) {
      throw new Error("threadId or crewMatchId is required");
    }

    if (!thread && payload.crewMatchId) {
      const match = await this.repository.findCrewMatchById(payload.crewMatchId);
      if (!match) {
        throw new Error("Crew match not found");
      }

      if (match.status !== "pending-provider-review" && match.status !== "accepted") {
        throw new Error("Chat is only available for pending or accepted crew matches");
      }

      const provider = await this.repository.findProviderById(match.providerId);
      const crewMember = await this.repository.findCrewMemberById(match.crewMemberId);
      if (!provider || !crewMember) {
        throw new Error("Conversation participants could not be loaded");
      }

      if (
        !(
          (actor.role === "provider" && actor.userId === provider.id) ||
          (actor.role === "crew-member" && actor.userId === crewMember.id)
        )
      ) {
        throw new Error("You cannot send a message for this crew match");
      }

      thread = await this.repository.createProviderCrewConversation({
        id: crypto.randomUUID(),
        crewMatchId: match.id,
        bookingId: match.bookingId,
        providerId: match.providerId,
        crewMemberId: match.crewMemberId,
        providerName: provider.companyName,
        crewMemberName: crewMember.fullName,
        status: match.status,
        updatedAt: new Date().toISOString(),
        lastMessagePreview: body,
        unreadCount: 0
      });
    }

    if (!thread) {
      throw new Error("Conversation not found");
    }

    this.assertCanAccessConversation(actor, thread);

    const message: ProviderCrewMessage = {
      id: crypto.randomUUID(),
      threadId: thread.id,
      senderId: actor.userId,
      senderRole: actor.role === "provider" ? "provider" : "crew-member",
      body,
      createdAt: new Date().toISOString()
    };
    await this.repository.createProviderCrewMessage(message);
    await this.repository.updateProviderCrewConversation(thread.id, {
      status: thread.status,
      updatedAt: message.createdAt,
      lastMessagePreview: body
    });

    return this.getProviderCrewConversationThread(actor, thread.id);
  }

  public async markBookingOnRoute(
    actor: AuthIdentityRecord,
    payload: MarkBookingOnRouteRequest
  ): Promise<Booking> {
    const booking = await this.repository.findBookingById(payload.bookingId);
    if (!booking) {
      throw new HttpError(404, "Booking not found");
    }

    const [allMatches, provider] = await Promise.all([
      this.repository.listCrewMatches(),
      this.repository.findProviderById(booking.providerId)
    ]);
    const acceptedMatches = allMatches.filter(
      (match) => match.bookingId === booking.id && match.status === "accepted"
    );

    if (!provider) {
      throw new HttpError(404, "Provider not found");
    }

    if (actor.role === "provider" && booking.providerId !== actor.userId) {
      throw new HttpError(403, "Providers can only start the route for their own bookings");
    }

    if (actor.role === "crew-member") {
      if (provider.routeLeaderMode !== "accepted-crew-fallback") {
        throw new HttpError(403, "This business owner handles route start personally for this booking");
      }

      if (!acceptedMatches.some((match) => match.crewMemberId === actor.userId)) {
        throw new HttpError(403, "Only accepted crew members can confirm they are on route");
      }

      const delegatedRouteLeaderId = this.resolveDelegatedCrewRouteLeaderId(booking, acceptedMatches);
      if (!delegatedRouteLeaderId) {
        throw new HttpError(403, "A specific crew route leader must be assigned before crew can start this route");
      }

      if (delegatedRouteLeaderId !== actor.userId) {
        throw new HttpError(403, "Only the assigned route leader can confirm they are on route");
      }
    }

    if (actor.role !== "provider" && actor.role !== "crew-member") {
      throw new HttpError(403, "Only the provider or accepted crew member can confirm on-route status");
    }

    if (booking.status !== "confirmed" && booking.status !== "in-progress") {
      throw new HttpError(
        400,
        "Bookings must be confirmed before the route can be started"
      );
    }

    if (booking.onRouteConfirmedAt) {
      return booking;
    }

    const updatedBooking = await this.repository.updateBooking(booking.id, {
      onRouteConfirmedAt: new Date().toISOString(),
      onRouteConfirmedByCrewMemberId: actor.role === "crew-member" ? actor.userId : undefined,
      lateNoticeSentAt: undefined,
      lateEtaIso: undefined,
      lateReason: undefined
    });

    if (!updatedBooking) {
      throw new HttpError(500, "Booking could not be updated");
    }

    const routeLeaderLabel =
      actor.role === "provider"
        ? provider?.companyName ?? "Your landscaping business"
        : (await this.repository.findCrewMemberById(actor.userId))?.fullName ?? "Your landscaping business";

    await Promise.all([
      this.createNotification({
        recipientId: booking.customerId,
        recipientRole: "customer",
        category: "booking",
        title: "Your crew is on the way",
        body: `${routeLeaderLabel} is heading to your property now.`,
        actionHref: `/customer/dashboard?bookingId=${booking.id}&tracking=1`
      }),
      this.createNotification({
        recipientId: booking.providerId,
        recipientRole: "provider",
        category: "staffing",
        title: actor.role === "provider" ? "Route started" : "Crew confirmed on route",
        body:
          actor.role === "provider"
            ? "You marked this job on route and customer tracking is now live."
            : "Your assigned crew member marked this job on route.",
        actionHref: `/provider/management?bookingId=${booking.id}&tracking=1`
      })
    ]);

    return updatedBooking;
  }

  public async setBookingRouteStop(
    providerId: string,
    payload: SetBookingRouteStopRequest
  ): Promise<Booking> {
    const booking = await this.repository.findBookingById(payload.bookingId);
    if (!booking) {
      throw new HttpError(404, "Booking not found");
    }

    if (booking.providerId !== providerId) {
      throw new HttpError(403, "Only the booking provider can set route stops");
    }

    if (booking.status === "completed" || booking.status === "cancelled" || booking.status === "refunded") {
      throw new HttpError(400, "Route stops can only be managed while the booking is active");
    }

    const provider = await this.repository.findProviderById(providerId);
    if (!provider) {
      throw new HttpError(404, "Provider not found");
    }

    const address = payload.address ?? provider.address;
    if (!address.point) {
      throw new HttpError(400, "Route stop address must include a point");
    }

    const defaultLabel = payload.kind === "staging" ? "Staging stop" : "Equipment pickup";
    const routeStop: BookingRouteStop = {
      id: crypto.randomUUID(),
      kind: payload.kind,
      label: payload.label?.trim() || defaultLabel,
      address,
      createdAt: new Date().toISOString()
    };

    const updatedBooking = await this.repository.updateBooking(booking.id, {
      routeActiveStop: routeStop
    });

    if (!updatedBooking) {
      throw new HttpError(500, "Booking route stop could not be saved");
    }

    return updatedBooking;
  }

  public async clearBookingRouteStop(
    providerId: string,
    payload: ClearBookingRouteStopRequest
  ): Promise<Booking> {
    const booking = await this.repository.findBookingById(payload.bookingId);
    if (!booking) {
      throw new HttpError(404, "Booking not found");
    }

    if (booking.providerId !== providerId) {
      throw new HttpError(403, "Only the booking provider can clear route stops");
    }

    const updatedBooking = await this.repository.updateBooking(booking.id, {
      routeActiveStop: undefined
    });

    if (!updatedBooking) {
      throw new HttpError(500, "Booking route stop could not be cleared");
    }

    return updatedBooking;
  }

  public async updateBookingRouteLocation(
    actor: AuthIdentityRecord,
    payload: UpdateBookingRouteLocationRequest
  ): Promise<BookingArrivalTracking> {
    const booking = await this.repository.findBookingById(payload.bookingId);
    if (!booking) {
      throw new HttpError(404, "Booking not found");
    }

    const [allMatches, provider] = await Promise.all([
      this.repository.listCrewMatches(),
      this.repository.findProviderById(booking.providerId)
    ]);
    const acceptedMatches = allMatches.filter(
      (match) => match.bookingId === booking.id && match.status === "accepted"
    );

    if (actor.role === "provider" && booking.providerId !== actor.userId) {
      throw new HttpError(403, "Providers can only share live route location for their own bookings");
    }

    if (actor.role === "crew-member") {
      if ((provider?.routeLeaderMode ?? "provider-only") !== "accepted-crew-fallback") {
        throw new HttpError(403, "This business owner handles route tracking personally for this booking");
      }

      if (!acceptedMatches.some((match) => match.crewMemberId === actor.userId)) {
        throw new HttpError(403, "Only accepted crew members can share route location");
      }

      const delegatedRouteLeaderId = this.resolveDelegatedCrewRouteLeaderId(booking, acceptedMatches);
      if (!delegatedRouteLeaderId) {
        throw new HttpError(403, "A specific crew route leader must be assigned before crew can share route location");
      }

      if (delegatedRouteLeaderId !== actor.userId) {
        throw new HttpError(403, "Only the assigned route leader can share route location");
      }
    }

    if (actor.role !== "provider" && actor.role !== "crew-member") {
      throw new HttpError(403, "Only the provider or accepted crew member can share route location");
    }

    if (!booking.onRouteConfirmedAt) {
      throw new HttpError(400, "Start the route before sharing live location");
    }

    const capturedAtIso = payload.capturedAtIso
      ? new Date(payload.capturedAtIso).toISOString()
      : new Date().toISOString();
    if (Number.isNaN(new Date(capturedAtIso).getTime())) {
      throw new HttpError(400, "capturedAtIso must be a valid ISO date when provided");
    }

    const activeRouteStop =
      booking.routeActiveStop && !booking.routeActiveStop.reachedAt ? booking.routeActiveStop : undefined;
    const routeStopReached =
      activeRouteStop && this.isRouteStopReached(activeRouteStop, payload.point)
        ? {
            ...activeRouteStop,
            reachedAt: capturedAtIso
          }
        : undefined;

    const updatedBooking = await this.repository.updateBooking(booking.id, {
      routeActiveStop: routeStopReached ?? booking.routeActiveStop,
      routeLivePoint: payload.point,
      routeLiveUpdatedAt: capturedAtIso,
      routeLiveSource: actor.role === "provider" ? "provider-device" : "crew-device",
      routeLiveSpeedMph: payload.speedMph,
      routeLiveAccuracyMeters: payload.accuracyMeters
    });

    if (!updatedBooking) {
      throw new HttpError(500, "Booking could not be updated");
    }

    return this.getBookingArrivalTracking(actor, booking.id, capturedAtIso);
  }

  public async markBookingLate(
    providerId: string,
    payload: MarkBookingLateRequest
  ): Promise<Booking> {
    const booking = await this.repository.findBookingById(payload.bookingId);
    if (!booking) {
      throw new HttpError(404, "Booking not found");
    }

    if (booking.providerId !== providerId) {
      throw new HttpError(403, "Only the booking provider can send a delay update");
    }

    if (
      booking.status === "completed" ||
      booking.status === "cancelled" ||
      booking.status === "refunded"
    ) {
      throw new HttpError(400, "Delay updates are only available for active bookings");
    }

    const lateEta = new Date(payload.lateEtaIso);
    if (Number.isNaN(lateEta.getTime())) {
      throw new HttpError(400, "A valid updated ETA is required");
    }

    if (lateEta.getTime() <= Date.now()) {
      throw new HttpError(400, "Updated ETA must be in the future");
    }

    const updatedBooking = await this.repository.updateBooking(booking.id, {
      lateNoticeSentAt: new Date().toISOString(),
      lateEtaIso: lateEta.toISOString(),
      lateReason: payload.reason?.trim() || undefined
    });

    if (!updatedBooking) {
      throw new HttpError(500, "Booking could not be updated");
    }

    const provider = await this.repository.findProviderById(booking.providerId);
    const window = getBookingServiceWindow(booking.scheduledStartIso);
    const etaText = lateEta.toLocaleTimeString([], { timeStyle: "short" });
    const reasonText = payload.reason?.trim() ? ` Reason: ${payload.reason.trim()}` : "";

    await this.createNotification({
      recipientId: booking.customerId,
      recipientRole: "customer",
      category: "booking",
      title: "Your provider is running late",
      body: `${provider?.companyName ?? "Your landscaping business"} now expects to arrive in the ${window.label.toLowerCase()} window, around ${etaText}.${reasonText}`,
      actionHref: `/customer/dashboard?bookingId=${booking.id}&late=1`
    });

    return updatedBooking;
  }

  public async addBookingEvidence(
    actor: AuthIdentityRecord,
    payload: AddBookingEvidenceRequest
  ): Promise<Booking> {
    const booking = await this.repository.findBookingById(payload.bookingId);
    if (!booking) {
      throw new HttpError(404, "Booking not found");
    }

    const acceptedMatch = (await this.repository.listCrewMatches()).find(
      (match) => match.bookingId === booking.id && match.status === "accepted"
    );

    if (actor.role === "provider" && booking.providerId !== actor.userId) {
      throw new HttpError(403, "Providers can only attach evidence to their own bookings");
    }

    if (actor.role === "crew-member") {
      if (!acceptedMatch || acceptedMatch.crewMemberId !== actor.userId) {
        throw new HttpError(403, "Only accepted crew members can attach booking evidence");
      }
    }

    if (actor.role !== "provider" && actor.role !== "crew-member") {
      throw new HttpError(403, "Only providers and accepted crew members can attach booking evidence");
    }

    if (booking.status === "completed" || booking.status === "cancelled" || booking.status === "refunded") {
      throw new HttpError(400, "Evidence can only be attached while the booking is still active");
    }

    const evidenceType = payload.evidenceType ?? "photo";
    const note = payload.note?.trim() || undefined;
    const checklistItems = payload.checklistItems?.map((item) => ({
      label: item.label.trim(),
      completed: Boolean(item.completed)
    }));

    if (evidenceType === "photo") {
      const imageDataUrl = payload.imageDataUrl?.trim() ?? "";
      if (!imageDataUrl.startsWith("data:image/")) {
        throw new HttpError(400, "Photo evidence must be provided as an image data URL");
      }

      if (imageDataUrl.length > 2_000_000) {
        throw new HttpError(400, "Booking evidence image is too large");
      }
    } else if (evidenceType === "note") {
      if (!note) {
        throw new HttpError(400, "Note evidence requires a written onsite note");
      }
    } else if (evidenceType === "checklist") {
      if (!checklistItems || checklistItems.length === 0) {
        throw new HttpError(400, "Checklist evidence requires at least one checklist item");
      }

      if (checklistItems.some((item) => !item.label)) {
        throw new HttpError(400, "Checklist evidence items must have labels");
      }
    }

    const evidence: BookingEvidenceEntry = {
      id: crypto.randomUUID(),
      phase: payload.phase,
      evidenceType,
      capturedAt: new Date().toISOString(),
      capturedByRole: actor.role,
      capturedByUserId: actor.userId,
      imageDataUrl: evidenceType === "photo" ? payload.imageDataUrl?.trim() : undefined,
      note,
      checklistItems: evidenceType === "checklist" ? checklistItems : undefined
    };

    const updatedBooking = await this.repository.updateBooking(booking.id, {
      serviceEvidence: [...booking.serviceEvidence, evidence]
    });

    if (!updatedBooking) {
      throw new HttpError(500, "Booking evidence could not be saved");
    }

    return updatedBooking;
  }

  public async markBookingException(
    providerId: string,
    payload: MarkBookingExceptionRequest
  ): Promise<Booking> {
    const booking = await this.repository.findBookingById(payload.bookingId);
    if (!booking) {
      throw new HttpError(404, "Booking not found");
    }

    if (booking.providerId !== providerId) {
      throw new HttpError(403, "Only the booking provider can report a service issue");
    }

    if (
      booking.status === "completed" ||
      booking.status === "cancelled" ||
      booking.status === "refunded"
    ) {
      throw new HttpError(400, "Service issues are only available for active bookings");
    }

    const exceptionLabel = getBookingExceptionLabel(payload.exceptionType);
    const updatedBooking = await this.repository.updateBooking(booking.id, {
      activeExceptionType: payload.exceptionType,
      activeExceptionReportedAt: new Date().toISOString(),
      activeExceptionNotes: payload.notes?.trim() || undefined
    });

    if (!updatedBooking) {
      throw new HttpError(500, "Booking could not be updated");
    }

    const provider = await this.repository.findProviderById(providerId);
    const reasonText = payload.notes?.trim() ? ` ${payload.notes.trim()}` : "";

    await Promise.all([
      this.createNotification({
        recipientId: booking.customerId,
        recipientRole: "customer",
        category: "support",
        title: exceptionLabel,
        body: `${provider?.companyName ?? "Your landscaping business"} reported: ${exceptionLabel}.${reasonText}`,
        actionHref: `/customer/dashboard?bookingId=${booking.id}&issue=${payload.exceptionType}`
      }),
      this.createNotification({
        recipientId: providerId,
        recipientRole: "provider",
        category: "support",
        title: "Issue logged on booking",
        body: `${exceptionLabel} was saved on this booking. Support can now see the issue context.`,
        actionHref: `/provider/management?bookingId=${booking.id}&issue=${payload.exceptionType}`
      })
    ]);

    return updatedBooking;
  }

  public async createBookingDispute(
    requester: AuthIdentityRecord,
    payload: CreateBookingDisputeRequest
  ): Promise<Booking> {
    const booking = await this.repository.findBookingById(payload.bookingId);
    if (!booking) {
      throw new HttpError(404, "Booking not found");
    }

    if (requester.role === "customer" && booking.customerId !== requester.userId) {
      throw new HttpError(403, "Customers can only dispute their own bookings");
    }

    if (requester.role === "provider" && booking.providerId !== requester.userId) {
      throw new HttpError(403, "Providers can only dispute their own jobs");
    }

    if (booking.status === "cancelled" || booking.status === "refunded") {
      throw new HttpError(400, "Cancelled or refunded bookings cannot be disputed");
    }

    if (booking.status === "requested") {
      throw new HttpError(400, "Requested bookings must be confirmed before they can be disputed");
    }

    if (requester.role === "crew-member") {
      throw new HttpError(403, "Crew members cannot open booking disputes");
    }

    const reason = payload.reason.trim();
    if (!reason) {
      throw new HttpError(400, "A dispute reason is required");
    }

    if (booking.status === "disputed") {
      return booking;
    }

    const disputedAt = new Date().toISOString();
    const updatedBooking = await this.repository.updateBooking(booking.id, {
      status: "disputed",
      disputedAt,
      disputeReason: reason,
      disputedByRole: requester.role
    });

    if (!updatedBooking) {
      throw new HttpError(500, "Booking could not be disputed");
    }

    await this.createSupportTicket(
      { userId: requester.userId, role: requester.role },
      {
        bookingId: booking.id,
        issueType: "service-quality",
        subject: `Booking dispute: ${this.titleCaseCategory(booking.category)}`,
        description: reason
      }
    );

    const customer = await this.repository.findCustomerById(booking.customerId);
    const provider = await this.repository.findProviderById(booking.providerId);
    const actorLabel =
      requester.role === "customer"
        ? customer?.fullName ?? "The customer"
        : provider?.companyName ?? "The landscaping business";

    await Promise.all([
      this.createNotification({
        recipientId: booking.customerId,
        recipientRole: "customer",
        category: "support",
        title: requester.role === "customer" ? "Dispute opened" : "Provider opened a dispute",
        body:
          requester.role === "customer"
            ? "Your dispute has been logged and support now has the booking context."
            : `${actorLabel} opened a dispute for this booking. YardMatch support can now step in.`,
        actionHref: `/customer/dashboard?bookingId=${booking.id}&issue=dispute`
      }),
      this.createNotification({
        recipientId: booking.providerId,
        recipientRole: "provider",
        category: "support",
        title: requester.role === "provider" ? "Dispute opened" : "Customer opened a dispute",
        body:
          requester.role === "provider"
            ? "Your dispute has been logged and support now has the booking context."
            : `${actorLabel} opened a dispute for this booking. YardMatch support can now step in.`,
        actionHref: `/provider/management?bookingId=${booking.id}&issue=dispute`
      })
    ]);

    return updatedBooking;
  }

  public async getBookingArrivalTracking(
    actor: AuthIdentityRecord,
    bookingId: string,
    nowIso = new Date().toISOString()
  ): Promise<BookingArrivalTracking> {
    const booking = await this.repository.findBookingById(bookingId);
    if (!booking) {
      throw new HttpError(404, "Booking not found");
    }

    const provider = await this.repository.findProviderById(booking.providerId);
    const matches = await this.repository.listCrewMatches();
    const acceptedMatches = matches.filter((match) => match.bookingId === booking.id && match.status === "accepted");
    const acceptedMatch = acceptedMatches[0];

    if (actor.role === "customer" && booking.customerId !== actor.userId) {
      throw new HttpError(403, "Customers can only track their own bookings");
    }

    if (actor.role === "provider" && booking.providerId !== actor.userId) {
      throw new HttpError(403, "Providers can only track their own jobs");
    }

    if (
      actor.role === "crew-member" &&
      !acceptedMatches.some((match) => match.crewMemberId === actor.userId)
    ) {
      throw new HttpError(403, "Crew members can only track accepted assignments");
    }

    const crewMemberId =
      booking.onRouteConfirmedByCrewMemberId ??
      this.resolveDelegatedCrewRouteLeaderId(booking, acceptedMatches);
    const crewMember = crewMemberId ? await this.repository.findCrewMemberById(crewMemberId) : undefined;
    const routeLeaderPoint =
      booking.onRouteConfirmedByCrewMemberId && crewMember
        ? crewMember.address.point
        : provider?.address.point ?? crewMember?.address.point;
    const routeLeaderName =
      booking.onRouteConfirmedByCrewMemberId && crewMember
        ? crewMember.fullName
        : provider?.companyName ?? crewMember?.fullName ?? "Your landscaping business";
    const activeRouteStop =
      booking.status === "confirmed" ? this.getActiveBookingRouteStop(booking, booking.routeLivePoint) : undefined;
    const providerVisibleCurrentLegDestination =
      actor.role === "customer"
        ? undefined
        : activeRouteStop?.address ?? booking.serviceAddress;

    const baseTracking: BookingArrivalTracking = {
      bookingId: booking.id,
      status: "unavailable",
      customerId: booking.customerId,
      providerId: booking.providerId,
      crewMemberId: crewMember?.id,
      crewMemberName: routeLeaderName,
      destination: booking.serviceAddress,
      routeStartPoint: routeLeaderPoint,
      currentLegDestination: providerVisibleCurrentLegDestination,
      activeRouteStop: actor.role === "customer" ? undefined : activeRouteStop,
      source: "computed-origin",
      progressPercent: 0,
      lastComputedAt: nowIso,
      message: "Tracking is not available for this booking yet."
    };

    if (!provider && !crewMember) {
      return {
        ...baseTracking,
        message: "No route leader is assigned yet."
      };
    }

    if (!booking.onRouteConfirmedAt) {
      return {
        ...baseTracking,
        status: "not-started",
        message: `${routeLeaderName} is assigned, but has not started the route yet.`
      };
    }

    const startedAt = new Date(booking.onRouteConfirmedAt).getTime();
    const now = new Date(nowIso).getTime();
    const totalDistanceMiles = this.calculateBookingRouteTotalMiles(
      routeLeaderPoint,
      booking.serviceAddress,
      activeRouteStop
    );
    const totalTravelMinutes = this.estimateRouteTravelMinutes(totalDistanceMiles, undefined, activeRouteStop);
    const elapsedMinutes = Math.max(0, (now - startedAt) / (1000 * 60));
    const liveLocationAgeMinutes = booking.routeLiveUpdatedAt
      ? Math.max(0, (now - new Date(booking.routeLiveUpdatedAt).getTime()) / (1000 * 60))
      : undefined;
    const hasLiveRoutePoint = Boolean(booking.routeLivePoint && booking.routeLiveUpdatedAt);
    const isLiveLocationStale =
      typeof liveLocationAgeMinutes === "number" &&
      liveLocationAgeMinutes > MarketplacePlatformService.liveRouteLocationStaleMinutes;
    const computedProgress =
      booking.status === "in-progress" || booking.status === "completed"
        ? 1
        : Math.max(0, Math.min(1, elapsedMinutes / totalTravelMinutes));
    const effectiveCurrentPoint = hasLiveRoutePoint
      ? booking.routeLivePoint
      : this.interpolatePoint(
          routeLeaderPoint ?? booking.serviceAddress.point,
          activeRouteStop?.address.point ?? booking.serviceAddress.point,
          computedProgress
        );
    const activeStopDuringTracking = this.getActiveBookingRouteStop(booking, effectiveCurrentPoint);
    const liveRemainingDistanceMiles =
      effectiveCurrentPoint
        ? this.calculateRemainingBookingRouteMiles(effectiveCurrentPoint, booking.serviceAddress, activeStopDuringTracking)
        : undefined;
    const liveRemainingLegDistanceMiles =
      effectiveCurrentPoint
        ? this.calculateRemainingBookingLegMiles(effectiveCurrentPoint, booking.serviceAddress, activeStopDuringTracking)
        : undefined;
    const clampedProgress =
      typeof liveRemainingDistanceMiles === "number" && totalDistanceMiles > 0
        ? Math.max(0, Math.min(1, 1 - liveRemainingDistanceMiles / totalDistanceMiles))
        : computedProgress;
    const etaMinutesFromLivePoint =
      typeof liveRemainingDistanceMiles === "number"
        ? this.estimateRouteTravelMinutes(
            liveRemainingDistanceMiles,
            booking.routeLiveSpeedMph,
            activeStopDuringTracking
          )
        : undefined;
    const legEtaMinutesFromLivePoint =
      typeof liveRemainingLegDistanceMiles === "number"
        ? this.estimateRouteTravelMinutes(liveRemainingLegDistanceMiles, booking.routeLiveSpeedMph)
        : undefined;

    if (booking.status === "completed") {
      return {
        ...baseTracking,
        status: "completed",
        currentPoint: booking.serviceAddress.point,
        source: hasLiveRoutePoint ? booking.routeLiveSource ?? "computed-origin" : "computed-origin",
        liveUpdatedAt: booking.routeLiveUpdatedAt,
        isLiveLocationStale,
        progressPercent: 100,
        remainingDistanceMiles: 0,
        etaMinutes: 0,
        unlockedAt: booking.onRouteConfirmedAt,
        message: `${routeLeaderName} already completed this service.`
      };
    }

    if (booking.status === "in-progress" || clampedProgress >= 1) {
      return {
        ...baseTracking,
        status: "arrived",
        currentPoint: booking.serviceAddress.point,
        source: hasLiveRoutePoint ? booking.routeLiveSource ?? "computed-origin" : "computed-origin",
        liveUpdatedAt: booking.routeLiveUpdatedAt,
        isLiveLocationStale,
        progressPercent: 100,
        remainingDistanceMiles: 0,
        etaMinutes: 0,
        unlockedAt: booking.onRouteConfirmedAt,
        message: `${routeLeaderName} has arrived at the property.`
      };
    }

    return {
      ...baseTracking,
      status: "on-route",
      currentPoint: effectiveCurrentPoint,
      currentLegDestination:
        actor.role === "customer"
          ? undefined
          : activeStopDuringTracking?.address ?? booking.serviceAddress,
      activeRouteStop: actor.role === "customer" ? undefined : activeStopDuringTracking,
      source: hasLiveRoutePoint ? booking.routeLiveSource ?? "computed-origin" : "computed-origin",
      liveUpdatedAt: booking.routeLiveUpdatedAt,
      isLiveLocationStale,
      progressPercent: Math.round(clampedProgress * 100),
      remainingLegDistanceMiles:
        typeof liveRemainingLegDistanceMiles === "number"
          ? Number(liveRemainingLegDistanceMiles.toFixed(1))
          : undefined,
      remainingDistanceMiles:
        typeof liveRemainingDistanceMiles === "number"
          ? Number(liveRemainingDistanceMiles.toFixed(1))
          : Number((totalDistanceMiles * (1 - clampedProgress)).toFixed(1)),
      etaToCurrentLegMinutes:
        typeof legEtaMinutesFromLivePoint === "number" ? Math.max(1, legEtaMinutesFromLivePoint) : undefined,
      etaMinutes:
        typeof etaMinutesFromLivePoint === "number"
          ? Math.max(1, etaMinutesFromLivePoint)
          : Math.max(1, Math.ceil(totalTravelMinutes - elapsedMinutes)),
      unlockedAt: booking.onRouteConfirmedAt,
      message: hasLiveRoutePoint
        ? isLiveLocationStale
          ? `${routeLeaderName} shared a live location, but it has not refreshed in a few minutes.`
          : `${routeLeaderName} is on the way with live location updates.`
        : `${routeLeaderName} is on the way.`
    };
  }

  private getActiveBookingRouteStop(
    booking: Booking,
    currentPoint?: Address["point"]
  ): Booking["routeActiveStop"] | undefined {
    const routeStop = booking.routeActiveStop;
    if (!routeStop || routeStop.reachedAt) {
      return undefined;
    }

    if (currentPoint && this.isRouteStopReached(routeStop, currentPoint)) {
      return undefined;
    }

    return routeStop;
  }

  private isRouteStopReached(routeStop: BookingRouteStop, point: Address["point"]): boolean {
    return (
      this.geoService.distanceMiles(
        {
          ...routeStop.address,
          point
        },
        routeStop.address
      ) <= MarketplacePlatformService.routeStopReachedThresholdMiles
    );
  }

  private calculateBookingRouteTotalMiles(
    routeStartPoint: Address["point"] | undefined,
    destination: Address,
    activeRouteStop?: Booking["routeActiveStop"]
  ): number {
    if (!routeStartPoint) {
      return 0;
    }

    if (!activeRouteStop) {
      return this.geoService.distanceMiles(
        {
          ...destination,
          point: routeStartPoint
        },
        destination
      );
    }

    const firstLeg = this.geoService.distanceMiles(
      {
        ...activeRouteStop.address,
        point: routeStartPoint
      },
      activeRouteStop.address
    );
    const secondLeg = this.geoService.distanceMiles(activeRouteStop.address, destination);
    return firstLeg + secondLeg;
  }

  private calculateRemainingBookingRouteMiles(
    currentPoint: Address["point"],
    destination: Address,
    activeRouteStop?: Booking["routeActiveStop"]
  ): number {
    if (!activeRouteStop) {
      return this.geoService.distanceMiles(
        {
          ...destination,
          point: currentPoint
        },
        destination
      );
    }

    const firstLegRemaining = this.geoService.distanceMiles(
      {
        ...activeRouteStop.address,
        point: currentPoint
      },
      activeRouteStop.address
    );
    return firstLegRemaining + this.geoService.distanceMiles(activeRouteStop.address, destination);
  }

  private calculateRemainingBookingLegMiles(
    currentPoint: Address["point"],
    destination: Address,
    activeRouteStop?: Booking["routeActiveStop"]
  ): number {
    if (!activeRouteStop) {
      return this.geoService.distanceMiles(
        {
          ...destination,
          point: currentPoint
        },
        destination
      );
    }

    return this.geoService.distanceMiles(
      {
        ...activeRouteStop.address,
        point: currentPoint
      },
      activeRouteStop.address
    );
  }

  private estimateRouteTravelMinutes(
    distanceMiles: number,
    speedMph?: number,
    activeRouteStop?: Booking["routeActiveStop"]
  ): number {
    const travelMinutes = Math.ceil((Math.max(0, distanceMiles) / Math.max(10, speedMph ?? 22)) * 60);
    const dwellMinutes = activeRouteStop ? MarketplacePlatformService.routeStopDwellMinutes : 0;
    return Math.max(0, travelMinutes + dwellMinutes);
  }

  public async startBooking(actor: AuthIdentityRecord, payload: StartBookingRequest): Promise<Booking> {
    const booking = await this.repository.findBookingById(payload.bookingId);
    if (!booking) {
      throw new HttpError(404, "Booking not found");
    }

    const acceptedMatch = (await this.repository.listCrewMatches()).find(
      (match) =>
        match.bookingId === booking.id &&
        match.status === "accepted"
    );

    if (actor.role === "provider" && booking.providerId !== actor.userId) {
      throw new HttpError(403, "Providers can only start their own bookings");
    }

    if (actor.role === "crew-member") {
      if (!acceptedMatch || acceptedMatch.crewMemberId !== actor.userId) {
        throw new HttpError(403, "Only accepted crew members can start this booking");
      }
    }

    if (actor.role !== "provider" && actor.role !== "crew-member") {
      throw new HttpError(403, "Only the provider or accepted crew member can start this booking");
    }

    if (booking.status === "in-progress") {
      return booking;
    }

    if (booking.status !== "confirmed") {
      throw new HttpError(400, "Bookings must be confirmed before work can start");
    }

    if (!booking.onRouteConfirmedAt) {
      throw new HttpError(400, "Confirm on route before starting work");
    }

    if (this.countBookingEvidence(booking, "before") < 1) {
      throw new HttpError(400, "Capture at least one before photo before starting work");
    }

    const updatedBooking = await this.repository.updateBooking(booking.id, {
      status: "in-progress",
      lateNoticeSentAt: undefined,
      lateEtaIso: undefined,
      lateReason: undefined,
      activeExceptionType: undefined,
      activeExceptionReportedAt: undefined,
      activeExceptionNotes: undefined
    });

    if (!updatedBooking) {
      throw new HttpError(500, "Booking could not be started");
    }

    this.analytics.record({
      id: crypto.randomUUID(),
      name: MarketplaceTelemetryEventCatalog.crewCheckInCompleted,
      actorId: actor.userId,
      occurredAt: new Date().toISOString(),
      properties: {
        bookingId: booking.id,
        providerId: booking.providerId
      }
    });

    await this.createNotification({
      recipientId: booking.providerId,
      recipientRole: "provider",
      category: "staffing",
      title: "Work started",
      body: "An assigned crew member checked in and started work on an upcoming job.",
      actionHref: "/provider/management"
    });

    return updatedBooking;
  }

  public async listCustomerProviderConversations(
    actor: AuthIdentityRecord
  ): Promise<CustomerProviderConversation[]> {
    const conversations = await this.repository.listCustomerProviderConversations();
    return conversations.filter((conversation) =>
      actor.role === "customer"
        ? conversation.customerId === actor.userId
        : conversation.providerId === actor.userId
    );
  }

  public async getCustomerProviderConversationThread(
    actor: AuthIdentityRecord,
    threadId?: string,
    bookingId?: string
  ): Promise<CustomerProviderConversationThread> {
    const thread = threadId
      ? await this.repository.findCustomerProviderConversationById(threadId)
      : bookingId
        ? await this.repository.findCustomerProviderConversationByBookingId(bookingId)
        : undefined;

    if (!thread) {
      throw new HttpError(404, "Conversation not found");
    }

    this.assertCanAccessCustomerProviderConversation(actor, thread);
    const messages = await this.repository.listCustomerProviderMessages(thread.id);
    return {
      thread,
      messages
    };
  }

  public async sendCustomerProviderMessage(
    actor: AuthIdentityRecord,
    payload: SendCustomerProviderMessageRequest
  ): Promise<CustomerProviderConversationThread> {
    const body = payload.body.trim();
    if (body.length === 0) {
      throw new HttpError(400, "Message body is required");
    }

    let thread = payload.threadId
      ? await this.repository.findCustomerProviderConversationById(payload.threadId)
      : payload.bookingId
        ? await this.repository.findCustomerProviderConversationByBookingId(payload.bookingId)
        : undefined;

    if (!thread && !payload.bookingId) {
      throw new HttpError(400, "threadId or bookingId is required");
    }

    if (!thread && payload.bookingId) {
      const booking = await this.repository.findBookingById(payload.bookingId);
      if (!booking) {
        throw new HttpError(404, "Booking not found");
      }

      if (!booking.onRouteConfirmedAt) {
        throw new HttpError(403, "Customer-provider chat unlocks only after the crew is on route");
      }

      const customer = await this.repository.findCustomerById(booking.customerId);
      const provider = await this.repository.findProviderById(booking.providerId);
      if (!customer || !provider) {
        throw new HttpError(500, "Conversation participants could not be loaded");
      }

      if (
        !(
          (actor.role === "customer" && actor.userId === customer.id) ||
          (actor.role === "provider" && actor.userId === provider.id)
        )
      ) {
        throw new HttpError(403, "You cannot send a message for this booking");
      }

      thread = await this.repository.createCustomerProviderConversation({
        id: crypto.randomUUID(),
        bookingId: booking.id,
        customerId: booking.customerId,
        providerId: booking.providerId,
        customerName: customer.fullName,
        providerName: provider.companyName,
        updatedAt: new Date().toISOString(),
        lastMessagePreview: body,
        unreadCount: 0
      });
    }

    if (!thread) {
      throw new HttpError(404, "Conversation not found");
    }

    const booking = await this.repository.findBookingById(thread.bookingId);
    if (!booking?.onRouteConfirmedAt) {
      throw new HttpError(403, "Customer-provider chat unlocks only after the crew is on route");
    }

    this.assertCanAccessCustomerProviderConversation(actor, thread);

    const message: CustomerProviderMessage = {
      id: crypto.randomUUID(),
      threadId: thread.id,
      senderId: actor.userId,
      senderRole: actor.role === "customer" ? "customer" : "provider",
      body,
      createdAt: new Date().toISOString()
    };
    await this.repository.createCustomerProviderMessage(message);
    await this.repository.updateCustomerProviderConversation(thread.id, {
      updatedAt: message.createdAt,
      lastMessagePreview: body
    });

    return this.getCustomerProviderConversationThread(actor, thread.id);
  }

  public async listCrewOpportunities(): Promise<CrewOpportunity[]> {
    const [providers, bookings] = await Promise.all([
      this.repository.listProviders(),
      this.repository.listBookings()
    ]);

    const now = Date.now();
    return bookings
      .filter((booking) => {
        const start = new Date(booking.scheduledStartIso).getTime();
        return (
          start > now &&
          (booking.status === "requested" || booking.status === "confirmed")
        );
      })
      .map((booking) => {
        const provider = providers.find((item) => item.id === booking.providerId);
        if (!provider) {
          return undefined;
        }

        const opportunity: CrewOpportunity = {
          id: booking.id,
          providerId: provider.id,
          providerCompanyName: provider.companyName,
          title: `${this.titleCaseCategory(booking.category)} crew support`,
          categories: [booking.category],
          city: provider.address.city,
          state: provider.address.state,
          neededByStartIso: booking.scheduledStartIso,
          neededByEndIso: booking.scheduledEndIso,
          hourlyRateCents: this.estimateCrewHourlyRate(booking.category),
          preferredSchedule: "flex",
          requiresEquipmentOwnership: false,
          trainingProvided: true,
          equipmentProvided: true,
          summary: `${provider.companyName} needs extra crew coverage for an upcoming ${this.titleCaseCategory(booking.category).toLowerCase()} job.`
        };

        return opportunity;
      })
      .filter((opportunity): opportunity is CrewOpportunity => opportunity !== undefined);
  }

  public async updateProviderSettings(
    providerId: string,
    payload: UpdateProviderSettingsRequest
  ): Promise<ProviderProfile> {
    const provider = await this.repository.findProviderById(providerId);
    if (!provider) {
      throw new Error("Provider not found");
    }

    const normalizedRadius = Math.round(payload.serviceRadiusMiles);
    if (normalizedRadius < 5 || normalizedRadius > 60) {
      throw new Error("serviceRadiusMiles must be between 5 and 60");
    }

    const minimumBookingLeadHours = Math.round(
      payload.minimumBookingLeadHours ?? provider.minimumBookingLeadHours ?? 0
    );
    if (minimumBookingLeadHours < 0 || minimumBookingLeadHours > 72) {
      throw new Error("minimumBookingLeadHours must be between 0 and 72");
    }

    const staffingMode = payload.staffingMode ?? provider.staffingMode ?? "review-first";
    if (staffingMode !== "auto-accept" && staffingMode !== "review-first") {
      throw new Error("staffingMode must be auto-accept or review-first");
    }

    const crewReviewLeadHours = Math.round(payload.crewReviewLeadHours ?? provider.crewReviewLeadHours ?? 24);
    if (crewReviewLeadHours < 1 || crewReviewLeadHours > 72) {
      throw new Error("crewReviewLeadHours must be between 1 and 72");
    }

    const departureReminderLeadMinutes = Math.round(
      payload.departureReminderLeadMinutes ?? provider.departureReminderLeadMinutes ?? 60
    );
    if (departureReminderLeadMinutes < 10 || departureReminderLeadMinutes > 180) {
      throw new Error("departureReminderLeadMinutes must be between 10 and 180");
    }

    const routeLeaderMode = payload.routeLeaderMode ?? provider.routeLeaderMode ?? "provider-only";
    if (routeLeaderMode !== "provider-only" && routeLeaderMode !== "accepted-crew-fallback") {
      throw new Error("routeLeaderMode must be provider-only or accepted-crew-fallback");
    }

    const weeklyPayoutDay = payload.weeklyPayoutDay ?? provider.weeklyPayoutDay ?? "Thu";
    if (!this.isValidPayoutWeekday(weeklyPayoutDay)) {
      throw new Error("weeklyPayoutDay must be Mon, Tue, Wed, Thu, Fri, Sat, or Sun");
    }

    const instantPayoutsEnabled =
      payload.instantPayoutsEnabled ?? provider.instantPayoutsEnabled ?? false;

    const nextCalendarConnection = {
      ...provider.calendarConnection,
      externalEventsBlockingEnabled:
        payload.externalEventsBlockingEnabled ??
        provider.calendarConnection.externalEventsBlockingEnabled ??
        false,
      externalBlocks: this.normalizeExternalCalendarBlocks(
        payload.externalCalendarBlocks ?? provider.calendarConnection.externalBlocks ?? []
      )
    };

    await this.ensureExternalCalendarBlocksDoNotConflict({
      ...provider,
      serviceRadiusMiles: normalizedRadius,
      minimumBookingLeadHours,
      staffingMode,
      crewReviewLeadHours,
      departureReminderLeadMinutes,
      routeLeaderMode,
      weeklyPayoutDay,
      instantPayoutsEnabled,
      sponsoredListingEnabled:
        payload.sponsoredListingEnabled ?? provider.sponsoredListingEnabled,
      calendarConnection: nextCalendarConnection
    });

    const updatedProvider = await this.repository.updateProvider(provider.id, {
      serviceRadiusMiles: normalizedRadius,
      minimumBookingLeadHours,
      staffingMode,
      crewReviewLeadHours,
      departureReminderLeadMinutes,
      routeLeaderMode,
      weeklyPayoutDay,
      instantPayoutsEnabled,
      sponsoredListingEnabled:
        payload.sponsoredListingEnabled ?? provider.sponsoredListingEnabled,
      calendarConnection: nextCalendarConnection
    });

    if (!updatedProvider) {
      throw new Error("Provider settings could not be updated");
    }

    this.analytics.record({
      id: crypto.randomUUID(),
      name: MarketplaceTelemetryEventCatalog.providerSettingsUpdated,
      actorId: provider.id,
      occurredAt: new Date().toISOString(),
      properties: {
        serviceRadiusMiles: normalizedRadius,
        minimumBookingLeadHours,
        staffingMode,
        crewReviewLeadHours,
        departureReminderLeadMinutes,
        routeLeaderMode,
        weeklyPayoutDay,
        instantPayoutsEnabled,
        sponsoredListingEnabled:
          payload.sponsoredListingEnabled ?? provider.sponsoredListingEnabled,
        externalEventsBlockingEnabled:
          payload.externalEventsBlockingEnabled ??
          provider.calendarConnection.externalEventsBlockingEnabled ??
          false,
        externalCalendarBlockCount:
          payload.externalCalendarBlocks?.length ??
          provider.calendarConnection.externalBlocks?.length ??
          0,
        city: provider.address.city
      }
    });

    if (payload.sponsoredListingEnabled !== undefined) {
      this.analytics.record({
        id: crypto.randomUUID(),
        name: MarketplaceTelemetryEventCatalog.providerSponsorshipUpdated,
        actorId: provider.id,
        occurredAt: new Date().toISOString(),
        properties: {
          sponsoredListingEnabled: payload.sponsoredListingEnabled,
          city: provider.address.city
        }
      });
    }

    return updatedProvider;
  }

  public async createProviderReview(
    customerId: string,
    payload: CreateProviderReviewRequest
  ): Promise<ProviderReview> {
    const booking = await this.repository.findBookingById(payload.bookingId);
    if (!booking) {
      throw new Error("Booking not found");
    }

    if (booking.customerId !== customerId) {
      throw new Error("Only the booking customer can submit a review");
    }

    if (booking.status !== "completed" || !booking.completedAt) {
      throw new Error("Reviews can only be submitted after the service is completed");
    }

    if (booking.reviewId || (await this.repository.findProviderReviewByBookingId(booking.id))) {
      throw new Error("A review has already been submitted for this booking");
    }

    const invite = await this.getActiveReviewInviteOrThrow(booking.id);

    const provider = await this.repository.findProviderById(booking.providerId);
    if (!provider) {
      throw new Error("Provider not found");
    }

    this.assertReviewScore(payload.overallRating, "overallRating");
    this.assertReviewScore(payload.timelinessRating, "timelinessRating");
    this.assertReviewScore(payload.attentionToDetailRating, "attentionToDetailRating");
    const normalizedReviewText = payload.reviewText.trim();

    if (normalizedReviewText.length === 0) {
      throw new Error("reviewText is required");
    }

    const review: ProviderReview = {
      id: crypto.randomUUID(),
      bookingId: booking.id,
      providerId: booking.providerId,
      customerId,
      overallRating: payload.overallRating,
      timelinessRating: payload.timelinessRating,
      attentionToDetailRating: payload.attentionToDetailRating,
      reviewText: normalizedReviewText,
      createdAt: new Date().toISOString()
    };

    const savedReview = await this.repository.createProviderReview(review);
    await this.repository.updateBooking(booking.id, {
      reviewId: review.id
    });
    await this.repository.updateReviewInvite(invite.id, {
      status: "completed",
      completedAt: savedReview.createdAt
    });

    const providerReviews = await this.repository.listProviderReviews(provider.id);
    const nextReviewCount = providerReviews.length;

    await this.repository.updateProvider(provider.id, {
      rating: this.calculateAverageRating(providerReviews, "overallRating"),
      timelinessRating: this.calculateAverageRating(providerReviews, "timelinessRating"),
      attentionToDetailRating: this.calculateAverageRating(providerReviews, "attentionToDetailRating"),
      reviewCount: nextReviewCount
    });

    this.analytics.record({
      id: crypto.randomUUID(),
      name: MarketplaceTelemetryEventCatalog.providerReviewSubmitted,
      actorId: customerId,
      occurredAt: savedReview.createdAt,
      properties: {
        bookingId: booking.id,
        providerId: booking.providerId,
        overallRating: payload.overallRating,
        timelinessRating: payload.timelinessRating,
        attentionToDetailRating: payload.attentionToDetailRating,
        hasReviewText: true
      }
    });

    await this.createNotification({
      recipientId: booking.providerId,
      recipientRole: "provider",
      category: "review",
      title: "You received a new review",
      body: `${payload.overallRating}/5 from a completed ${this.titleCaseCategory(booking.category)} booking.`,
      actionHref: "/provider/management"
    });

    return savedReview;
  }

  public async completeBooking(
    providerId: string,
    payload: CompleteBookingRequest
  ): Promise<Booking> {
    const booking = await this.repository.findBookingById(payload.bookingId);
    if (!booking) {
      throw new Error("Booking not found");
    }

    if (booking.providerId !== providerId) {
      throw new Error("Only the booking provider can mark the service completed");
    }

    if (
      booking.status !== "completed" &&
      booking.status !== "confirmed" &&
      booking.status !== "in-progress"
    ) {
      throw new Error("Bookings must be confirmed before the provider can complete them");
    }

    if (this.countBookingEvidence(booking, "after") < 1) {
      throw new Error("Capture at least one after photo before completing the booking");
    }

    const wasAlreadyCompleted = booking.status === "completed" && Boolean(booking.completedAt);
    const completedAt = booking.completedAt ?? new Date().toISOString();
    const updatedBooking = await this.repository.updateBooking(booking.id, {
      status: "completed",
      completedAt,
      activeExceptionType: undefined,
      activeExceptionReportedAt: undefined,
      activeExceptionNotes: undefined
    });

    if (!updatedBooking) {
      throw new Error("Booking could not be completed");
    }

    const existingInvite = await this.repository.findReviewInviteByBookingId(booking.id);
    if (!existingInvite) {
      const customer = await this.repository.findCustomerById(booking.customerId);
      if (!customer) {
        throw new Error("Customer not found");
      }

      const reviewInvite = this.buildReviewInvite(updatedBooking, customer.email, completedAt);
      await this.repository.createReviewInvite(reviewInvite);

      this.analytics.record({
        id: crypto.randomUUID(),
        name: MarketplaceTelemetryEventCatalog.reviewInviteScheduled,
        actorId: booking.customerId,
        occurredAt: completedAt,
        properties: {
          bookingId: booking.id,
          providerId: booking.providerId,
          scheduledSendIso: reviewInvite.scheduledSendIso
        }
      });
    }

    if (!wasAlreadyCompleted) {
      this.analytics.record({
        id: crypto.randomUUID(),
        name: MarketplaceTelemetryEventCatalog.bookingCompleted,
        actorId: booking.customerId,
        occurredAt: completedAt,
        properties: {
          bookingId: booking.id,
          providerId: booking.providerId
        }
      });

      await this.createNotification({
        recipientId: booking.customerId,
        recipientRole: "customer",
        category: "review",
        title: "Service marked complete",
        body: "Your landscaping service was completed. A review prompt will unlock after the follow-up delay.",
        actionHref: "/customer/dashboard"
      });

      await this.scheduleNextRecurringBookingIfNeeded(updatedBooking);
    }

    return updatedBooking;
  }

  public async confirmBooking(
    providerId: string,
    payload: ConfirmBookingRequest
  ): Promise<Booking> {
    const booking = await this.repository.findBookingById(payload.bookingId);
    if (!booking) {
      throw new HttpError(404, "Booking not found");
    }

    if (booking.providerId !== providerId) {
      throw new HttpError(403, "Only the booking provider can confirm this service");
    }

    if (
      booking.status === "confirmed" ||
      booking.status === "in-progress" ||
      booking.status === "completed"
    ) {
      return booking;
    }

    if (booking.status !== "requested") {
      throw new HttpError(400, "Only requested bookings can be confirmed");
    }

    const updatedBooking = await this.repository.updateBooking(booking.id, {
      status: "confirmed"
    });

    if (!updatedBooking) {
      throw new HttpError(500, "Booking could not be confirmed");
    }

    this.analytics.record({
      id: crypto.randomUUID(),
      name: MarketplaceTelemetryEventCatalog.bookingConfirmed,
      actorId: providerId,
      occurredAt: new Date().toISOString(),
      properties: {
        bookingId: booking.id,
        customerId: booking.customerId
      }
    });

    await this.createNotification({
      recipientId: booking.customerId,
      recipientRole: "customer",
      category: "booking",
      title: "Your booking is confirmed",
      body: "The landscaping business confirmed your requested service window.",
      actionHref: "/customer/dashboard"
    });

    return updatedBooking;
  }

  public async declineBooking(
    providerId: string,
    payload: { bookingId: string; reason?: string }
  ): Promise<Booking> {
    const booking = await this.repository.findBookingById(payload.bookingId);
    if (!booking) {
      throw new HttpError(404, "Booking not found");
    }

    if (booking.providerId !== providerId) {
      throw new HttpError(403, "Only the booking provider can decline this service");
    }

    if (booking.status === "cancelled") {
      return booking;
    }

    if (booking.status !== "requested") {
      throw new HttpError(400, "Only requested bookings can be declined");
    }

    const updatedBooking = await this.repository.updateBooking(booking.id, {
      status: "cancelled",
      activeExceptionType: undefined,
      activeExceptionReportedAt: undefined,
      activeExceptionNotes: undefined
    });

    if (!updatedBooking) {
      throw new HttpError(500, "Booking could not be declined");
    }

    this.analytics.record({
      id: crypto.randomUUID(),
      name: MarketplaceTelemetryEventCatalog.bookingDeclinedByProvider,
      actorId: providerId,
      occurredAt: new Date().toISOString(),
      properties: {
        bookingId: booking.id,
        customerId: booking.customerId,
        category: booking.category,
        reason: payload.reason?.trim() || "none"
      }
    });

    await this.createNotification({
      recipientId: booking.customerId,
      recipientRole: "customer",
      category: "booking",
      title: "Provider declined this request",
      body: payload.reason?.trim()
        ? `The provider could not take this service window. Note: ${payload.reason.trim()}`
        : "The provider could not take this service window. Please choose another qualified provider.",
      actionHref: "/customer/dashboard"
    });

    return updatedBooking;
  }

  public async createInstantQuote(payload: InstantQuoteRequest): Promise<InstantQuoteResponse> {
    const customer = payload.customerId ? await this.repository.findCustomerById(payload.customerId) : undefined;
    const property = payload.propertyId
      ? customer?.properties.find((item) => item.id === payload.propertyId)
      : undefined;

    if (payload.propertyId && !property) {
      throw new Error("Selected property does not belong to the customer");
    }

    const rawAddress = property?.address ?? payload.address;
    const validatedAddress = property
      ? {
          address: rawAddress,
          source: "local-rules" as const,
          confidence: "local-only" as const,
          message: undefined
        }
      : await this.normalizeAndValidateAddress(rawAddress);
    const normalizedAddress = validatedAddress.address;

    const quote = this.instantQuoteEngine.buildQuote({
      request: {
        ...payload,
        address: normalizedAddress
      },
      property,
      normalizedAddress: this.buildNormalizedAddressSummary(rawAddress, normalizedAddress, validatedAddress)
    });

    this.analytics.record({
      id: crypto.randomUUID(),
      name:
        quote.followUpQuestions.length > 0
          ? MarketplaceTelemetryEventCatalog.instantQuoteNeedsFollowUp
          : MarketplaceTelemetryEventCatalog.instantQuoteGenerated,
      actorId: payload.customerId,
      occurredAt: new Date().toISOString(),
      properties: {
        category: payload.category,
        confidenceTier: quote.confidenceTier,
        estimatedPriceCents: quote.estimatedPriceCents,
        estimatedDurationMinutes: quote.estimatedDurationMinutes,
        followUpQuestionCount: quote.followUpQuestions.length
      }
    });

    return quote;
  }

  public async createBooking(
    customerId: string,
    payload: CreateBookingRequest
  ): Promise<Booking> {
    return this.createBookingRecord(customerId, payload);
  }

  public async createRecurringServicePlan(
    customerId: string,
    payload: CreateRecurringServicePlanRequest
  ): Promise<CreateRecurringServicePlanResponse> {
    const customer = await this.repository.findCustomerById(customerId);
    if (!customer) {
      throw new Error("Customer not found");
    }

    const selectedProperty = payload.servicePropertyId
      ? customer.properties.find((property) => property.id === payload.servicePropertyId)
      : undefined;

    if (payload.servicePropertyId && !selectedProperty) {
      throw new Error("Selected property does not belong to the customer");
    }

    const validatedServiceAddress = selectedProperty
      ? selectedProperty.address
      : (await this.normalizeAndValidateAddress(payload.serviceAddress)).address;

    const plan: RecurringServicePlan = {
      id: crypto.randomUUID(),
      customerId,
      providerId: payload.providerId,
      serviceAddress: validatedServiceAddress,
      servicePropertyId: payload.servicePropertyId,
      category: payload.category,
      frequency: payload.frequency,
      requestedAt: new Date().toISOString(),
      notes: payload.notes,
      totalCents: payload.totalCents,
      status: "active",
      anchorScheduledStartIso: payload.scheduledStartIso,
      anchorScheduledEndIso: payload.scheduledEndIso
    };

    await this.repository.createRecurringServicePlan(plan);

    const initialBooking = await this.createBookingRecord(
      customerId,
      {
        providerId: payload.providerId,
        serviceAddress: validatedServiceAddress,
        servicePropertyId: payload.servicePropertyId,
        category: payload.category,
        scheduledStartIso: payload.scheduledStartIso,
        scheduledEndIso: payload.scheduledEndIso,
        notes: payload.notes,
        totalCents: payload.totalCents,
        recommendationSessionId: payload.recommendationSessionId,
        recommendedProviderId: payload.recommendedProviderId,
        selectedProviderRank: payload.selectedProviderRank,
        viewedAlternativeProviders: payload.viewedAlternativeProviders,
        recommendationSource: payload.recommendationSource
      },
      {
        recurringPlanId: plan.id,
        recurringOccurrenceIndex: 1,
        providerNotificationTitle: "New recurring booking request",
        providerNotificationBody: `${customer.fullName} started a ${this.describeRecurringFrequency(
          payload.frequency
        )} ${this.titleCaseCategory(payload.category).toLowerCase()} plan beginning ${this.formatBookingWindowWithDate(
          payload.scheduledStartIso
        )}.`
      }
    );

    await this.repository.updateRecurringServicePlan(plan.id, {
      lastGeneratedBookingId: initialBooking.id,
      lastGeneratedAt: initialBooking.requestedAt,
      lastSchedulingAttemptAt: initialBooking.requestedAt,
      lastSchedulingError: undefined
    });

    await this.createNotification({
      recipientId: customerId,
      recipientRole: "customer",
      category: "booking",
      title: "Recurring plan started",
      body: `Your ${this.describeRecurringFrequency(payload.frequency)} ${this.titleCaseCategory(
        payload.category
      ).toLowerCase()} plan is active. The first visit has been requested.`,
      actionHref: "/customer/dashboard"
    });

    return {
      plan: await this.buildRecurringServicePlanSummary(plan.id),
      initialBooking
    };
  }

  public async listRecurringServicePlansForCustomer(
    customerId: string
  ): Promise<ListRecurringServicePlansResponse> {
    const plans = (await this.repository.listRecurringServicePlans())
      .filter((plan) => plan.customerId === customerId)
      .sort((left, right) => right.requestedAt.localeCompare(left.requestedAt));

    return {
      plans: await Promise.all(plans.map((plan) => this.buildRecurringServicePlanSummary(plan.id)))
    };
  }

  public async cancelRecurringServicePlan(
    customerId: string,
    payload: CancelRecurringServicePlanRequest
  ): Promise<RecurringServicePlanSummary> {
    const plan = await this.repository.findRecurringServicePlanById(payload.planId);
    if (!plan) {
      throw new HttpError(404, "Recurring plan not found");
    }

    if (plan.customerId !== customerId) {
      throw new HttpError(403, "Customers can only manage their own recurring plans");
    }

    if (plan.status === "cancelled") {
      return this.buildRecurringServicePlanSummary(plan.id);
    }

    const cancelledAt = new Date().toISOString();
    const allBookings = await this.repository.listBookings();
    const futureBookings = allBookings.filter(
      (booking) =>
        booking.recurringPlanId === plan.id &&
        (booking.status === "requested" || booking.status === "confirmed") &&
        new Date(booking.scheduledStartIso).getTime() > Date.now()
    );

    for (const booking of futureBookings) {
      await this.repository.updateBooking(booking.id, {
        status: "cancelled",
        activeExceptionType: undefined,
        activeExceptionReportedAt: undefined,
        activeExceptionNotes: undefined
      });
    }

    await this.repository.updateRecurringServicePlan(plan.id, {
      status: "cancelled",
      cancelledAt,
      cancellationReason: payload.reason?.trim() || "Customer cancelled the recurring service plan."
    });

    await this.createNotification({
      recipientId: plan.providerId,
      recipientRole: "provider",
      category: "booking",
      title: "Recurring plan cancelled",
      body: "A customer cancelled an active recurring service plan and any upcoming requested visits tied to it.",
      actionHref: "/provider/management"
    });

    return this.buildRecurringServicePlanSummary(plan.id);
  }

  private async createBookingRecord(
    customerId: string,
    payload: CreateBookingRequest,
    options?: {
      recurringPlanId?: string;
      recurringOccurrenceIndex?: number;
      providerNotificationTitle?: string;
      providerNotificationBody?: string;
      skipProviderAvailabilityCheck?: boolean;
      skipRequestedFunnelEvent?: boolean;
    }
  ): Promise<Booking> {
    const customer = await this.repository.findCustomerById(customerId);
    if (!customer) {
      throw new Error("Customer not found");
    }

    const selectedProperty = payload.servicePropertyId
      ? customer.properties.find((property) => property.id === payload.servicePropertyId)
      : undefined;

    if (payload.servicePropertyId && !selectedProperty) {
      throw new Error("Selected property does not belong to the customer");
    }

    const validatedServiceAddress = selectedProperty
      ? selectedProperty.address
      : (await this.normalizeAndValidateAddress(payload.serviceAddress)).address;

    const bookingBase = this.bookingLifecycle.createBooking(crypto.randomUUID(), {
      customerId,
      ...payload,
      serviceAddress: validatedServiceAddress
    });

    const booking: Booking = {
      ...bookingBase,
      recurringPlanId: options?.recurringPlanId,
      recurringOccurrenceIndex: options?.recurringOccurrenceIndex
    };

    if (!options?.skipProviderAvailabilityCheck) {
      await this.assertProviderWindowIsAvailable(
        payload.providerId,
        payload.scheduledStartIso,
        payload.scheduledEndIso
      );
    }

    const result = await this.repository.createBooking(booking);

    if (!options?.skipRequestedFunnelEvent) {
      this.analytics.recordFunnelStep(MarketplaceTelemetryEventCatalog.bookingRequested, customerId, {
        providerId: payload.providerId,
        totalCents: payload.totalCents,
        category: payload.category,
        servicePropertyId: payload.servicePropertyId ?? "custom-address"
      });
      this.recordRecommendationBookingIntent(customerId, payload, Boolean(options?.recurringPlanId));
      this.recordRecommendationSelection(customerId, booking, payload, Boolean(options?.recurringPlanId));
    }

    await this.createNotification({
      recipientId: payload.providerId,
      recipientRole: "provider",
      category: "booking",
      title: options?.providerNotificationTitle ?? "New booking request",
      body:
        options?.providerNotificationBody ??
        `${customer.fullName} requested ${this.titleCaseCategory(payload.category)} for ${new Date(
          booking.scheduledStartIso
        ).toLocaleDateString()}.`,
      actionHref: "/provider/management"
    });

    return result;
  }

  private recordRecommendationSelection(
    customerId: string,
    booking: Booking,
    payload: CreateBookingRequest,
    recurringPlanStarted: boolean
  ): void {
    if (!payload.recommendationSessionId) {
      return;
    }

    const selectedRecommendedProvider = payload.recommendedProviderId
      ? payload.providerId === payload.recommendedProviderId
      : payload.selectedProviderRank === 1;
    const eventName = selectedRecommendedProvider
      ? MarketplaceTelemetryEventCatalog.recommendationAccepted
      : MarketplaceTelemetryEventCatalog.recommendationSwapped;

    this.analytics.recordFunnelStep(eventName, customerId, {
      bookingId: booking.id,
      providerId: payload.providerId,
      category: payload.category,
      recommendationSessionId: payload.recommendationSessionId,
      recommendedProviderId: payload.recommendedProviderId ?? "unknown",
      selectedProviderRank: payload.selectedProviderRank ?? "unknown",
      viewedAlternativeProviders: payload.viewedAlternativeProviders ?? false,
      recommendationSource: payload.recommendationSource ?? "unknown",
      recurringPlanStarted
    });
  }

  private recordRecommendationBookingIntent(
    customerId: string,
    payload: CreateBookingRequest,
    recurringPlanStarted: boolean
  ): void {
    if (!payload.recommendationSessionId) {
      return;
    }

    this.analytics.recordFunnelStep(MarketplaceTelemetryEventCatalog.recommendationBookingIntent, customerId, {
      providerId: payload.providerId,
      category: payload.category,
      recommendationSessionId: payload.recommendationSessionId,
      recommendedProviderId: payload.recommendedProviderId ?? "unknown",
      selectedProviderRank: payload.selectedProviderRank ?? "unknown",
      viewedAlternativeProviders: payload.viewedAlternativeProviders ?? false,
      recommendationSource: payload.recommendationSource ?? "unknown",
      recurringPlanStarted
    });
  }

  public async cancelBooking(
    customerId: string,
    payload: CancelBookingRequest
  ): Promise<Booking> {
    const booking = await this.repository.findBookingById(payload.bookingId);
    if (!booking) {
      throw new Error("Booking not found");
    }

    this.assertCustomerCanManageBooking(customerId, booking);
    if (!this.canCustomerCancelOrReschedule(booking)) {
      throw new Error("Only future requested or confirmed bookings can be cancelled");
    }

    const updatedBooking = await this.repository.updateBooking(booking.id, {
      status: "cancelled",
      activeExceptionType: undefined,
      activeExceptionReportedAt: undefined,
      activeExceptionNotes: undefined
    });

    if (!updatedBooking) {
      throw new Error("Booking could not be cancelled");
    }

    this.analytics.record({
      id: crypto.randomUUID(),
      name: MarketplaceTelemetryEventCatalog.bookingCancelled,
      actorId: customerId,
      occurredAt: new Date().toISOString(),
      properties: {
        bookingId: booking.id,
        providerId: booking.providerId,
        category: booking.category,
        actorRole: "customer"
      }
    });

    await this.createNotification({
      recipientId: booking.providerId,
      recipientRole: "provider",
      category: "booking",
      title: "Booking cancelled",
      body: "A customer cancelled an upcoming booking.",
      actionHref: "/provider/management"
    });

    return updatedBooking;
  }

  public async rescheduleBooking(
    customerId: string,
    payload: RescheduleBookingRequest
  ): Promise<Booking> {
    const booking = await this.repository.findBookingById(payload.bookingId);
    if (!booking) {
      throw new Error("Booking not found");
    }

    this.assertCustomerCanManageBooking(customerId, booking);
    if (!this.canCustomerCancelOrReschedule(booking)) {
      throw new Error("Only future requested or confirmed bookings can be rescheduled");
    }

    const nextStart = new Date(payload.scheduledStartIso);
    const nextEnd = new Date(payload.scheduledEndIso);

    if (Number.isNaN(nextStart.getTime()) || Number.isNaN(nextEnd.getTime())) {
      throw new Error("A valid start and end time are required");
    }

    if (nextStart.getTime() <= Date.now()) {
      throw new Error("Rescheduled start time must be in the future");
    }

    if (nextEnd.getTime() <= nextStart.getTime()) {
      throw new Error("Rescheduled end time must be after the start time");
    }

    const hoursUntilOriginalStart =
      (new Date(booking.scheduledStartIso).getTime() - Date.now()) / (60 * 60 * 1000);

    if (booking.status === "confirmed" && hoursUntilOriginalStart < 24) {
      throw new Error("Confirmed bookings starting in less than 24 hours cannot be rescheduled in app");
    }

    await this.assertProviderRescheduleWindowIsAvailable(
      booking.providerId,
      booking.id,
      payload.scheduledStartIso,
      payload.scheduledEndIso
    );

    const updatedBooking = await this.repository.updateBooking(booking.id, {
      scheduledStartIso: payload.scheduledStartIso,
      scheduledEndIso: payload.scheduledEndIso,
      lateNoticeSentAt: undefined,
      lateEtaIso: undefined,
      lateReason: undefined,
      activeExceptionType: undefined,
      activeExceptionReportedAt: undefined,
      activeExceptionNotes: undefined
    });

    if (!updatedBooking) {
      throw new Error("Booking could not be rescheduled");
    }

    this.analytics.record({
      id: crypto.randomUUID(),
      name: MarketplaceTelemetryEventCatalog.bookingRescheduled,
      actorId: customerId,
      occurredAt: new Date().toISOString(),
      properties: {
        bookingId: booking.id,
        providerId: booking.providerId,
        previousStartIso: booking.scheduledStartIso,
        nextStartIso: payload.scheduledStartIso
      }
    });

    await this.createNotification({
      recipientId: booking.providerId,
      recipientRole: "provider",
      category: "booking",
      title: "Booking rescheduled",
      body: `A customer moved a ${this.titleCaseCategory(booking.category)} booking to a new time.`,
      actionHref: "/provider/management"
    });

    return updatedBooking;
  }

  public async runProviderAssistantCommand(
    providerId: string,
    payload: ProviderAssistantCommandRequest
  ): Promise<ProviderAssistantCommandResponse> {
    const command = payload.command.trim();
    if (!command) {
      throw new HttpError(400, "A provider assistant command is required");
    }

    const parsed = this.parseProviderAssistantCommand(command);
    if (
      !parsed.understood ||
      parsed.actions.some(
        (action) =>
          (action.actionType === "summarize-dispatch" && !action.dispatchScope) ||
          (action.actionType === "reschedule-booking" && !action.targetWindowKey) ||
          (action.actionType === "mark-booking-late" && !action.lateMinutes) ||
          (action.actionType === "report-booking-exception" && !action.exceptionType)
      )
    ) {
      return {
        command,
        understood: false,
        requiresBookingSelection: false,
        requiresConfirmation: false,
        executed: false,
        notifyCustomer: parsed.notifyCustomer,
        actionTypes: parsed.actionTypes.length > 0 ? parsed.actionTypes : undefined,
        previewLabel: "Could not understand command",
        previewMessage: this.providerAssistantHelpText(),
        bookingCandidates: []
      };
    }

    if (parsed.actions.length === 1 && parsed.actions[0]?.actionType === "summarize-dispatch") {
      return this.runProviderAssistantDispatchSummary(providerId, parsed.actions[0], command);
    }

    if (parsed.actions.length === 1 && parsed.actions[0]?.actionType === "recommend-dispatch-adjustment") {
      return this.runProviderAssistantDispatchAdjustment(providerId, parsed.actions[0], command);
    }

    if (parsed.actions.length === 1 && parsed.actions[0]?.actionType === "recommend-staffing-adjustment") {
      return this.runProviderAssistantStaffingAdjustment(providerId, parsed.actions[0], command);
    }

    const upcomingBookings = await this.listProviderAssistantCandidates(providerId);
    const matchingCandidates = payload.bookingId
      ? upcomingBookings.filter((booking) => booking.id === payload.bookingId)
      : parsed.sourceWindowKey
        ? upcomingBookings.filter(
            (booking) => getBookingServiceWindow(booking.scheduledStartIso).key === parsed.sourceWindowKey
          )
        : upcomingBookings;

    if (payload.bookingId && matchingCandidates.length === 0) {
      throw new HttpError(404, "Booking not found for this provider assistant command");
    }

    if (!payload.bookingId && matchingCandidates.length !== 1) {
      const candidates = matchingCandidates.map((booking) => this.toProviderAssistantBookingCandidate(booking));
      return {
        command,
        understood: true,
        actionType: parsed.actionType,
        actionTypes: parsed.actionTypes,
        requiresBookingSelection: true,
        requiresConfirmation: false,
        executed: false,
        notifyCustomer: parsed.notifyCustomer,
        sourceWindowKey: parsed.sourceWindowKey,
        targetWindowKey: parsed.targetWindowKey,
        targetWindowLabel: parsed.targetWindowKey
          ? this.providerAssistantWindowLabel(parsed.targetWindowKey)
          : undefined,
        lateMinutes: parsed.lateMinutes,
        previewLabel:
          matchingCandidates.length === 0 ? "No matching appointment found" : "Pick the appointment",
        previewMessage:
          matchingCandidates.length === 0
            ? "The assistant could not find an upcoming provider booking that matches that time window."
            : "More than one upcoming booking matches that request, so choose the booking explicitly and run the command again.",
        bookingCandidates: candidates
      };
    }

    const booking = matchingCandidates[0];
    if (!booking) {
      throw new HttpError(404, "No matching provider booking was found");
    }

    if (parsed.actions.length === 1) {
      return this.runProviderAssistantSingleAction(providerId, booking, parsed.actions[0]!, payload.execute === true, command);
    }

    const stepResponses: ProviderAssistantCommandResponse[] = [];
    let currentBooking = booking;
    let projectedMatches =
      payload.execute === true
        ? undefined
        : await this.listProviderAssistantBookingMatches(providerId, booking.id);

    for (const [index, action] of parsed.actions.entries()) {
      const response = await this.runProviderAssistantSingleAction(
        providerId,
        currentBooking,
        action,
        payload.execute === true,
        command,
        projectedMatches
      );
      stepResponses.push(response);

      if (!payload.execute && !response.requiresConfirmation) {
        return {
          ...response,
          command,
          actionTypes: parsed.actionTypes,
          previewLabel: "Multi-step command needs attention",
          previewMessage: `Step ${index + 1} is blocked. ${response.previewMessage}`
        };
      }

      if (payload.execute && !response.executed) {
        return {
          ...response,
          command,
          actionTypes: parsed.actionTypes,
          previewLabel: "Multi-step command stopped early",
          previewMessage: `Step ${index + 1} could not finish. ${response.previewMessage}`
        };
      }

      currentBooking =
        payload.execute === true
          ? response.updatedBooking
            ? {
                ...response.updatedBooking,
                customerName: currentBooking.customerName ?? "Customer"
              }
            : currentBooking
          : this.projectBookingAfterProviderAssistantAction(currentBooking, action);
      if (payload.execute !== true && projectedMatches) {
        projectedMatches = this.projectCrewMatchesAfterProviderAssistantAction(projectedMatches, action);
      }
    }

    return this.mergeProviderAssistantResponses(command, parsed.actionTypes, stepResponses, payload.execute === true);
  }

  private async runProviderAssistantDispatchSummary(
    providerId: string,
    action: ParsedProviderAssistantAction,
    originalCommand: string
  ): Promise<ProviderAssistantCommandResponse> {
    const window = this.buildProviderAssistantDispatchWindow(action.dispatchScope ?? "today");
    const overview = await this.getProviderCalendarOverview(providerId, window);
    const scopeLabel = this.providerAssistantDispatchScopeLabel(action.dispatchScope ?? "today");

    if (action.dispatchScope === "next-7-days") {
      const rangeSummary = this.buildProviderAssistantDispatchRangeSummary(overview.dispatchDays);
      if (!rangeSummary) {
        return {
          command: originalCommand,
          understood: true,
          actionType: "summarize-dispatch",
          actionTypes: ["summarize-dispatch"],
          requiresBookingSelection: false,
          requiresConfirmation: false,
          executed: false,
          notifyCustomer: false,
          previewLabel: `${scopeLabel} looks open`,
          previewMessage: `There are no YardMatch jobs or outside calendar blocks across ${scopeLabel.toLowerCase()}.`,
          bookingCandidates: []
        };
      }

      if (action.dispatchFocus === "attention") {
        const targetDay =
          rangeSummary.overloadedDayCount > 0
            ? overview.dispatchDays.find((day) => day.routeStatus === "overloaded")
            : rangeSummary.highestCrewGapDay?.crewGap
              ? rangeSummary.highestCrewGapDay
              : rangeSummary.watchDayCount > 0
                ? overview.dispatchDays.find((day) => day.routeStatus === "watch")
                : rangeSummary.highestDriveMilesDay ?? rangeSummary.busiestDay;

        if (targetDay) {
          const focusWindow = this.selectProviderAssistantDispatchFocusWindow(targetDay);
          const recommendationText =
            targetDay.recommendations.length > 0
              ? ` Recommendations: ${targetDay.recommendations.join(" ")}`
              : "";
          const focusWindowText = focusWindow
            ? ` Biggest pressure window: ${focusWindow.label} with ${focusWindow.yardmatchJobCount} job${
                focusWindow.yardmatchJobCount === 1 ? "" : "s"
              }, crew gap ${focusWindow.crewGap}, and ${focusWindow.blockedMinutes} blocked minutes.`
            : "";

          return {
            command: originalCommand,
            understood: true,
            actionType: "summarize-dispatch",
            actionTypes: ["summarize-dispatch"],
            requiresBookingSelection: false,
            requiresConfirmation: false,
            executed: false,
            notifyCustomer: false,
            dispatchDaySummary: targetDay,
            dispatchWindowSummary: focusWindow,
            dispatchRangeSummary: rangeSummary,
            previewLabel: `${scopeLabel} dispatch attention`,
            previewMessage: `${targetDay.dayLabel} needs the most attention. It is ${targetDay.routeStatus} with ${
              targetDay.yardmatchJobCount
            } YardMatch job${targetDay.yardmatchJobCount === 1 ? "" : "s"}, crew gap ${
              targetDay.crewGap
            }, and ${targetDay.estimatedDriveMiles.toFixed(1)} route miles.${focusWindowText}${recommendationText}`,
            bookingCandidates: this.buildProviderAssistantDispatchBookingCandidates(overview, targetDay, focusWindow)
          };
        }
      }

      const rangeRecommendations =
        rangeSummary.recommendations.length > 0
          ? ` Recommendations: ${rangeSummary.recommendations.join(" ")}`
          : "";
      const busiestDayText = rangeSummary.busiestDay
        ? ` Busiest day: ${rangeSummary.busiestDay.dayLabel} with ${rangeSummary.busiestDay.yardmatchJobCount} jobs.`
        : "";
      const crewGapText =
        rangeSummary.highestCrewGapDay && rangeSummary.highestCrewGapDay.crewGap > 0
          ? ` Biggest crew gap: ${rangeSummary.highestCrewGapDay.dayLabel} (${rangeSummary.highestCrewGapDay.crewGap}).`
          : "";

      return {
        command: originalCommand,
        understood: true,
        actionType: "summarize-dispatch",
        actionTypes: ["summarize-dispatch"],
        requiresBookingSelection: false,
        requiresConfirmation: false,
        executed: false,
        notifyCustomer: false,
        dispatchRangeSummary: rangeSummary,
        previewLabel: `${scopeLabel} dispatch summary`,
        previewMessage: `${scopeLabel} has ${rangeSummary.totalYardmatchJobs} YardMatch jobs across ${
          rangeSummary.activeDayCount
        } active day${rangeSummary.activeDayCount === 1 ? "" : "s"}, ${rangeSummary.watchDayCount} watch day${
          rangeSummary.watchDayCount === 1 ? "" : "s"
        }, and ${rangeSummary.overloadedDayCount} overloaded day${
          rangeSummary.overloadedDayCount === 1 ? "" : "s"
        }.${busiestDayText}${crewGapText}${rangeRecommendations}`,
        bookingCandidates: []
      };
    }

    const targetDay =
      overview.dispatchDays.find((day) =>
        this.doIntervalsOverlap(
          day.dateIso,
          new Date(new Date(day.dateIso).getTime() + 24 * 60 * 60 * 1000).toISOString(),
          window.fromIso,
          window.toIso
        )
      ) ?? overview.dispatchDays[0];

    if (!targetDay) {
      return {
        command: originalCommand,
        understood: true,
        actionType: "summarize-dispatch",
        actionTypes: ["summarize-dispatch"],
        requiresBookingSelection: false,
        requiresConfirmation: false,
        executed: false,
        notifyCustomer: false,
        previewLabel: `${scopeLabel} looks open`,
        previewMessage: `There are no YardMatch jobs or outside calendar blocks on ${scopeLabel.toLowerCase()}.`,
        bookingCandidates: []
      };
    }

    const recommendationText =
      targetDay.recommendations.length > 0
        ? ` Recommendations: ${targetDay.recommendations.join(" ")}`
        : "";
    const firstStopText = targetDay.firstStopAddressLine ? ` First stop: ${targetDay.firstStopAddressLine}.` : "";
    const focusWindow = this.selectProviderAssistantDispatchFocusWindow(targetDay);

    if (action.dispatchFocus === "attention") {
      const focusWindowText = focusWindow
        ? ` The biggest pressure is in the ${focusWindow.label.toLowerCase()} window with ${focusWindow.yardmatchJobCount} job${
            focusWindow.yardmatchJobCount === 1 ? "" : "s"
          }, crew gap ${focusWindow.crewGap}, and ${focusWindow.blockedMinutes} blocked minutes.`
        : "";
      return {
        command: originalCommand,
        understood: true,
        actionType: "summarize-dispatch",
        actionTypes: ["summarize-dispatch"],
        requiresBookingSelection: false,
        requiresConfirmation: false,
        executed: false,
        notifyCustomer: false,
        dispatchDaySummary: targetDay,
        dispatchWindowSummary: focusWindow,
        previewLabel: `${scopeLabel} dispatch attention`,
        previewMessage: `${scopeLabel} needs attention because the route is ${targetDay.routeStatus} with crew gap ${
          targetDay.crewGap
        } and ${targetDay.estimatedDriveMiles.toFixed(1)} route miles.${focusWindowText}${recommendationText}`,
        bookingCandidates: this.buildProviderAssistantDispatchBookingCandidates(overview, targetDay, focusWindow)
      };
    }

    return {
      command: originalCommand,
      understood: true,
      actionType: "summarize-dispatch",
      actionTypes: ["summarize-dispatch"],
      requiresBookingSelection: false,
      requiresConfirmation: false,
      executed: false,
      notifyCustomer: false,
      dispatchDaySummary: targetDay,
      previewLabel: `${scopeLabel} dispatch summary`,
      previewMessage: `${scopeLabel} is ${targetDay.routeStatus}. ${targetDay.yardmatchJobCount} YardMatch job${
        targetDay.yardmatchJobCount === 1 ? "" : "s"
      }, ${targetDay.externalBlockCount} outside block${targetDay.externalBlockCount === 1 ? "" : "s"}, crew gap ${
        targetDay.crewGap
      }, and about ${targetDay.estimatedDriveMiles.toFixed(1)} route miles.${firstStopText}${recommendationText}`,
      bookingCandidates: []
    };
  }

  private async runProviderAssistantDispatchAdjustment(
    providerId: string,
    action: ParsedProviderAssistantAction,
    originalCommand: string
  ): Promise<ProviderAssistantCommandResponse> {
    const window = this.buildProviderAssistantDispatchWindow(action.dispatchScope ?? "today");
    const overview = await this.getProviderCalendarOverview(providerId, window);
    const scopeLabel = this.providerAssistantDispatchScopeLabel(action.dispatchScope ?? "today");
    const targetDay =
      action.dispatchScope === "next-7-days"
        ? this.selectProviderAssistantWeekAttentionDay(overview)
        : overview.dispatchDays.find((day) =>
            this.doIntervalsOverlap(
              day.dateIso,
              new Date(new Date(day.dateIso).getTime() + 24 * 60 * 60 * 1000).toISOString(),
              window.fromIso,
              window.toIso
            )
          ) ?? overview.dispatchDays[0];

    if (!targetDay) {
      return {
        command: originalCommand,
        understood: true,
        actionType: "recommend-dispatch-adjustment",
        actionTypes: ["recommend-dispatch-adjustment"],
        requiresBookingSelection: false,
        requiresConfirmation: false,
        executed: false,
        notifyCustomer: false,
        previewLabel: `${scopeLabel} looks open`,
        previewMessage: `There are no YardMatch jobs or outside calendar blocks on ${scopeLabel.toLowerCase()}, so no dispatch adjustment is needed.`,
        bookingCandidates: []
      };
    }

    const focusWindow = this.selectProviderAssistantDispatchFocusWindow(targetDay);
    if (!focusWindow || focusWindow.yardmatchJobCount === 0) {
      return {
        command: originalCommand,
        understood: true,
        actionType: "recommend-dispatch-adjustment",
        actionTypes: ["recommend-dispatch-adjustment"],
        requiresBookingSelection: false,
        requiresConfirmation: false,
        executed: false,
        notifyCustomer: false,
        dispatchDaySummary: targetDay,
        previewLabel: `${scopeLabel} does not need a move`,
        previewMessage: `${targetDay.dayLabel} does not have a pressured YardMatch window that needs a reschedule recommendation right now.`,
        bookingCandidates: []
      };
    }

    const focusCandidates = this.buildProviderAssistantDispatchBookingCandidates(overview, targetDay, focusWindow);
    if (focusCandidates.length === 0) {
      return {
        command: originalCommand,
        understood: true,
        actionType: "recommend-dispatch-adjustment",
        actionTypes: ["recommend-dispatch-adjustment"],
        requiresBookingSelection: false,
        requiresConfirmation: false,
        executed: false,
        notifyCustomer: false,
        dispatchDaySummary: targetDay,
        dispatchWindowSummary: focusWindow,
        previewLabel: `${scopeLabel} needs manual review`,
        previewMessage: `The ${focusWindow.label.toLowerCase()} window looks pressured, but the assistant could not isolate a booking candidate to move yet.`,
        bookingCandidates: []
      };
    }

    const suggestedWindow = this.selectProviderAssistantReliefWindow(targetDay, focusWindow);
    const providerBookings = await this.listProviderAssistantCandidates(providerId);
    const providerBookingsById = new Map(providerBookings.map((booking) => [booking.id, booking]));
    const orderedCandidates = this.orderProviderAssistantDispatchAdjustmentCandidates(
      focusCandidates,
      focusWindow.windowKey,
      suggestedWindow?.windowKey
    );
    const recommendedCandidate =
      orderedCandidates
        .map((candidate) => providerBookingsById.get(candidate.bookingId))
        .find((candidate): candidate is Awaited<ReturnType<typeof this.listProviderAssistantCandidates>>[number] =>
          Boolean(candidate)
        ) ?? providerBookingsById.get(orderedCandidates[0]!.bookingId);

    if (!recommendedCandidate) {
      return {
        command: originalCommand,
        understood: true,
        actionType: "recommend-dispatch-adjustment",
        actionTypes: ["recommend-dispatch-adjustment"],
        requiresBookingSelection: false,
        requiresConfirmation: false,
        executed: false,
        notifyCustomer: false,
        dispatchDaySummary: targetDay,
        dispatchWindowSummary: focusWindow,
        previewLabel: `${scopeLabel} needs manual review`,
        previewMessage: `The ${focusWindow.label.toLowerCase()} window looks pressured, but the assistant could not load the booking details needed to recommend a move.`,
        bookingCandidates: orderedCandidates
      };
    }

    const crossDayReliefSlot =
      suggestedWindow
        ? undefined
        : await this.findProviderAssistantCrossDayReliefSlot(
            providerId,
            recommendedCandidate,
            new Date(new Date(targetDay.dateIso).getTime() + 24 * 60 * 60 * 1000).toISOString()
          );
    const suggestedTimes = suggestedWindow
      ? this.buildProviderAssistantTargetWindow(recommendedCandidate, suggestedWindow.windowKey)
      : crossDayReliefSlot
        ? this.buildProviderAssistantTargetWindowFromSlot(recommendedCandidate, crossDayReliefSlot)
        : undefined;
    const targetWindowLabel = suggestedWindow
      ? suggestedWindow.label
      : crossDayReliefSlot
        ? this.formatBookingWindowWithDate(crossDayReliefSlot.startIso)
        : undefined;
    const recommendationContext = suggestedWindow
      ? `${focusWindow.label} currently has ${focusWindow.yardmatchJobCount} job${
          focusWindow.yardmatchJobCount === 1 ? "" : "s"
        }, crew gap ${focusWindow.crewGap}, and ${focusWindow.blockedMinutes} blocked minutes, while ${
          suggestedWindow.label
        } is lighter with ${suggestedWindow.yardmatchJobCount} job${
          suggestedWindow.yardmatchJobCount === 1 ? "" : "s"
        } and crew gap ${suggestedWindow.crewGap}.`
      : crossDayReliefSlot
        ? `${focusWindow.label} currently has ${focusWindow.yardmatchJobCount} job${
            focusWindow.yardmatchJobCount === 1 ? "" : "s"
          }, crew gap ${focusWindow.crewGap}, and ${focusWindow.blockedMinutes} blocked minutes. The next cleaner route opening lands on ${this.formatBookingWindowWithDate(
            crossDayReliefSlot.startIso
          )}.`
      : `${focusWindow.label} currently has ${focusWindow.yardmatchJobCount} job${
          focusWindow.yardmatchJobCount === 1 ? "" : "s"
        }, crew gap ${focusWindow.crewGap}, and ${focusWindow.blockedMinutes} blocked minutes.`;
    const recommendationTail = suggestedWindow
      ? ` Move ${recommendedCandidate.customerName}'s ${this.providerAssistantWindowLabel(
          getBookingServiceWindow(recommendedCandidate.scheduledStartIso).key
        ).toLowerCase()} appointment into ${suggestedWindow.label.toLowerCase()} first.`
      : crossDayReliefSlot
        ? ` Move ${recommendedCandidate.customerName}'s ${this.providerAssistantWindowLabel(
            getBookingServiceWindow(recommendedCandidate.scheduledStartIso).key
          ).toLowerCase()} appointment to ${this.formatBookingWindowWithDate(crossDayReliefSlot.startIso).toLowerCase()} first.`
      : ` Review ${recommendedCandidate.customerName}'s ${this.providerAssistantWindowLabel(
          getBookingServiceWindow(recommendedCandidate.scheduledStartIso).key
        ).toLowerCase()} appointment first if you need to free space in that window.`;

    return {
      command: originalCommand,
      understood: true,
      actionType: "recommend-dispatch-adjustment",
      actionTypes: ["recommend-dispatch-adjustment"],
      requiresBookingSelection: false,
      requiresConfirmation: false,
      executed: false,
      notifyCustomer: false,
      matchedBookingId: recommendedCandidate.id,
      matchedCustomerName: recommendedCandidate.customerName,
      sourceWindowKey: focusWindow.windowKey,
      targetWindowKey: suggestedWindow?.windowKey ?? (crossDayReliefSlot ? getBookingServiceWindow(crossDayReliefSlot.startIso).key : undefined),
      targetWindowLabel,
      suggestedStartIso: suggestedTimes?.startIso,
      suggestedEndIso: suggestedTimes?.endIso,
      dispatchDaySummary: targetDay,
      dispatchWindowSummary: focusWindow,
      previewLabel: `${scopeLabel} booking to move`,
      previewMessage: `${recommendationContext}${recommendationTail}`,
      bookingCandidates: orderedCandidates
    };
  }

  private async runProviderAssistantStaffingAdjustment(
    providerId: string,
    action: ParsedProviderAssistantAction,
    originalCommand: string
  ): Promise<ProviderAssistantCommandResponse> {
    const window = this.buildProviderAssistantDispatchWindow(action.dispatchScope ?? "today");
    const overview = await this.getProviderCalendarOverview(providerId, window);
    const staffing = await this.getProviderStaffingOverview(providerId);
    const scopeLabel = this.providerAssistantDispatchScopeLabel(action.dispatchScope ?? "today");
    const targetDay =
      action.dispatchScope === "next-7-days"
        ? this.selectProviderAssistantWeekAttentionDay(overview)
        : overview.dispatchDays.find((day) =>
            this.doIntervalsOverlap(
              day.dateIso,
              new Date(new Date(day.dateIso).getTime() + 24 * 60 * 60 * 1000).toISOString(),
              window.fromIso,
              window.toIso
            )
          ) ?? overview.dispatchDays[0];

    if (!targetDay) {
      return {
        command: originalCommand,
        understood: true,
        actionType: "recommend-staffing-adjustment",
        actionTypes: ["recommend-staffing-adjustment"],
        requiresBookingSelection: false,
        requiresConfirmation: false,
        executed: false,
        notifyCustomer: false,
        previewLabel: `${scopeLabel} looks covered`,
        previewMessage: `There are no active YardMatch jobs on ${scopeLabel.toLowerCase()}, so no extra crew recommendation is needed.`,
        bookingCandidates: []
      };
    }

    const dayStartIso = targetDay.dateIso;
    const dayEndIso = new Date(new Date(targetDay.dateIso).getTime() + 24 * 60 * 60 * 1000).toISOString();
    const jobsNeedingCrew = staffing.jobs
      .filter(
        (job) =>
          job.crewGap > 0 &&
          this.doIntervalsOverlap(job.scheduledStartIso, job.scheduledEndIso, dayStartIso, dayEndIso)
      )
      .sort((left, right) => {
        const uncoveredGapDelta =
          this.getProviderAssistantUncoveredCrewGap(right) - this.getProviderAssistantUncoveredCrewGap(left);
        if (uncoveredGapDelta !== 0) {
          return uncoveredGapDelta;
        }

        const gapDelta = right.crewGap - left.crewGap;
        if (gapDelta !== 0) {
          return gapDelta;
        }

        return new Date(left.scheduledStartIso).getTime() - new Date(right.scheduledStartIso).getTime();
      });

    if (jobsNeedingCrew.length === 0) {
      return {
        command: originalCommand,
        understood: true,
        actionType: "recommend-staffing-adjustment",
        actionTypes: ["recommend-staffing-adjustment"],
        requiresBookingSelection: false,
        requiresConfirmation: false,
        executed: false,
        notifyCustomer: false,
        dispatchDaySummary: targetDay,
        previewLabel: `${scopeLabel} does not need more crew`,
        previewMessage: `${targetDay.dayLabel} has no open crew gap right now. If the route still feels tight, a move recommendation is probably more useful than adding people.`,
        bookingCandidates: []
      };
    }

    const recommendedJob = jobsNeedingCrew[0]!;
    const bookingCandidates = jobsNeedingCrew.map((job) => this.toProviderAssistantBookingCandidateFromStaffingJob(job));
    const matchedBookingId = bookingCandidates[0]?.bookingId;
    const pendingMatchCount = this.getProviderAssistantPendingMatchCount(recommendedJob);
    const uncoveredCrewGap = this.getProviderAssistantUncoveredCrewGap(recommendedJob);
    const recommendationLead =
      pendingMatchCount >= recommendedJob.crewGap
        ? `Review pending crew matches for ${recommendedJob.customerName}'s ${this.providerAssistantWindowLabel(
            getBookingServiceWindow(recommendedJob.scheduledStartIso).key
          ).toLowerCase()} ${this.titleCaseCategory(recommendedJob.category).toLowerCase()} booking first.`
        : pendingMatchCount > 0
          ? `Review the pending matches for ${recommendedJob.customerName}'s ${this.providerAssistantWindowLabel(
              getBookingServiceWindow(recommendedJob.scheduledStartIso).key
            ).toLowerCase()} ${this.titleCaseCategory(recommendedJob.category).toLowerCase()} booking, then source more crew if needed.`
          : `Source more crew for ${recommendedJob.customerName}'s ${this.providerAssistantWindowLabel(
              getBookingServiceWindow(recommendedJob.scheduledStartIso).key
            ).toLowerCase()} ${this.titleCaseCategory(recommendedJob.category).toLowerCase()} booking first.`;
    const recommendationDetail =
      pendingMatchCount >= recommendedJob.crewGap
        ? `It still shows a crew gap of ${recommendedJob.crewGap}, but ${pendingMatchCount} pending match${
            pendingMatchCount === 1 ? "" : "es"
          } already exist and could close that gap without sourcing new people.`
        : pendingMatchCount > 0
          ? `It still shows a crew gap of ${recommendedJob.crewGap}, with ${pendingMatchCount} pending match${
              pendingMatchCount === 1 ? "" : "es"
            } already in review. Even after those, about ${uncoveredCrewGap} more crew member${
              uncoveredCrewGap === 1 ? "" : "s"
            } may still need coverage.`
          : `It still shows a crew gap of ${recommendedJob.crewGap} and has no pending matches in review, so the shortage is not likely to close on its own.`;

    return {
      command: originalCommand,
      understood: true,
      actionType: "recommend-staffing-adjustment",
      actionTypes: ["recommend-staffing-adjustment"],
      requiresBookingSelection: false,
      requiresConfirmation: false,
      executed: false,
      notifyCustomer: false,
      matchedBookingId,
      matchedCustomerName: recommendedJob.customerName,
      sourceWindowKey: getBookingServiceWindow(recommendedJob.scheduledStartIso).key,
      dispatchDaySummary: targetDay,
      previewLabel: `${scopeLabel} crew gap recommendation`,
      previewMessage: `${recommendationLead} ${recommendationDetail} ${targetDay.dayLabel} carries ${
        targetDay.crewGap
      } total open crew slot${targetDay.crewGap === 1 ? "" : "s"} right now.`,
      bookingCandidates
    };
  }

  private async runProviderAssistantSingleAction(
    providerId: string,
    booking: Booking & { customerName: string },
    action: ParsedProviderAssistantAction,
    execute: boolean,
    originalCommand: string,
    projectedMatches?: CrewMatchCandidate[]
  ): Promise<ProviderAssistantCommandResponse> {
    const sourceWindowKey = action.sourceWindowKey ?? getBookingServiceWindow(booking.scheduledStartIso).key;

    if (
      action.actionType === "accept-best-crew-match" ||
      action.actionType === "accept-crew-match" ||
      action.actionType === "deny-crew-match"
    ) {
      const bookingMatches = (projectedMatches ?? (await this.listProviderAssistantBookingMatches(providerId, booking.id))).filter(
        (match) =>
          match.bookingId === booking.id &&
          (match.status === "pending-provider-review" || match.status === "accepted")
      );

      if (bookingMatches.length === 0) {
        return {
          command: originalCommand,
          understood: true,
          actionType: action.actionType,
          actionTypes: [action.actionType],
          requiresBookingSelection: false,
          requiresConfirmation: false,
          executed: false,
          notifyCustomer: false,
          matchedBookingId: booking.id,
          matchedCustomerName: booking.customerName,
          sourceWindowKey,
          previewLabel: "No crew matches to review",
          previewMessage: "This booking does not currently have any pending crew matches to accept or decline.",
          bookingCandidates: [this.toProviderAssistantBookingCandidate(booking)]
        };
      }

      const crewMatch =
        action.actionType === "accept-best-crew-match"
          ? bookingMatches.find((match) => match.status === "pending-provider-review")
          : await this.resolveProviderAssistantCrewMatch(action.crewMatchCrewNameQuery, bookingMatches);
      if (!crewMatch) {
        return {
          command: originalCommand,
          understood: true,
          actionType: action.actionType,
          actionTypes: [action.actionType],
          requiresBookingSelection: false,
          requiresConfirmation: false,
          executed: false,
          notifyCustomer: false,
          matchedBookingId: booking.id,
          matchedCustomerName: booking.customerName,
          sourceWindowKey,
          previewLabel:
            action.actionType === "accept-best-crew-match"
              ? "No recommended crew left"
              : "Crew match not found",
          previewMessage:
            action.actionType === "accept-best-crew-match"
              ? "This booking does not currently have a pending crew recommendation to accept."
              : "The assistant could not match that crew name to a pending or accepted staffing match on this job.",
          bookingCandidates: [this.toProviderAssistantBookingCandidate(booking)]
        };
      }

      if (crewMatch.status === "accepted") {
        return {
          command: originalCommand,
          understood: true,
          actionType: action.actionType,
          actionTypes: [action.actionType],
          requiresBookingSelection: false,
          requiresConfirmation: false,
          executed: false,
          notifyCustomer: false,
          matchedBookingId: booking.id,
          matchedCustomerName: booking.customerName,
          sourceWindowKey,
          previewLabel:
            action.actionType === "accept-best-crew-match"
              ? "Best crew already accepted"
              : "Crew already accepted",
          previewMessage:
            action.actionType === "accept-best-crew-match"
              ? `${crewMatch.crewMemberName} is already the best accepted crew on this job.`
              : `${crewMatch.crewMemberName} is already accepted on this job.`,
          bookingCandidates: [this.toProviderAssistantBookingCandidate(booking)]
        };
      }

      const reviewAction =
        action.actionType === "deny-crew-match" ? "deny" : "accept";
      const reviewVerb = reviewAction === "accept" ? "Accept" : "Decline";
      const pastTense = reviewAction === "accept" ? "accepted" : "declined";
      const recommendationReasons = crewMatch.recommendationReasons?.length
        ? ` Best fit notes: ${crewMatch.recommendationReasons.join(", ")}.`
        : "";

      if (!execute) {
        return {
          command: originalCommand,
          understood: true,
          actionType: action.actionType,
          actionTypes: [action.actionType],
          requiresBookingSelection: false,
          requiresConfirmation: true,
          executed: false,
          notifyCustomer: false,
          matchedBookingId: booking.id,
          matchedCustomerName: booking.customerName,
          sourceWindowKey,
          previewLabel:
            action.actionType === "accept-best-crew-match"
              ? "Ready to accept best crew"
              : reviewAction === "accept"
                ? "Ready to accept crew"
                : "Ready to decline crew",
          previewMessage:
            action.actionType === "accept-best-crew-match"
              ? `Accept ${crewMatch.crewMemberName} as the best crew for this job.${recommendationReasons} They will be accepted through the normal staffing review flow.`
              : `${reviewVerb} ${crewMatch.crewMemberName} for this job. They will be ${pastTense} through the normal staffing review flow.${recommendationReasons}`,
          bookingCandidates: [this.toProviderAssistantBookingCandidate(booking)]
        };
      }

      await this.reviewCrewMatch(providerId, {
        crewMatchId: crewMatch.id,
        action: reviewAction
      });

      const now = new Date().toISOString();
      const intervention: BookingInterventionRecord = {
        id: crypto.randomUUID(),
        action:
          action.actionType === "accept-best-crew-match"
            ? "provider-assistant-accept-best-crew-match"
            : reviewAction === "accept"
              ? "provider-assistant-accept-crew-match"
            : "provider-assistant-deny-crew-match",
        createdAt: now,
        actorRole: "provider-assistant",
        actorUserId: providerId,
        note: `Provider assistant command: ${originalCommand}`,
        previousStatus: booking.status,
        nextStatus: booking.status
      };
      const bookingWithIntervention = await this.repository.updateBooking(booking.id, {
        interventions: [...booking.interventions, intervention]
      });

      return {
        command: originalCommand,
        understood: true,
        actionType: action.actionType,
        actionTypes: [action.actionType],
        requiresBookingSelection: false,
        requiresConfirmation: false,
        executed: true,
        notifyCustomer: false,
        matchedBookingId: booking.id,
        matchedCustomerName: booking.customerName,
        sourceWindowKey,
        previewLabel:
          action.actionType === "accept-best-crew-match"
            ? "Best crew accepted"
            : reviewAction === "accept"
              ? "Crew accepted"
              : "Crew declined",
        previewMessage:
          action.actionType === "accept-best-crew-match"
            ? `Accepted ${crewMatch.crewMemberName} as the best crew through the staffing review flow.`
            : `${this.toTitleCase(pastTense)} ${crewMatch.crewMemberName} through the staffing review flow.`,
        bookingCandidates: [this.toProviderAssistantBookingCandidate(bookingWithIntervention ?? booking)],
        updatedBooking: bookingWithIntervention ?? booking
      };
    }

    if (action.actionType === "set-route-stop" || action.actionType === "clear-route-stop") {
      const provider = await this.repository.findProviderById(providerId);
      if (!provider) {
        throw new HttpError(404, "Provider not found for this assistant command");
      }

      const activeRouteStop = booking.routeActiveStop && !booking.routeActiveStop.reachedAt ? booking.routeActiveStop : undefined;
      if (action.actionType === "clear-route-stop") {
        if (!activeRouteStop) {
          return {
            command: originalCommand,
            understood: true,
            actionType: "clear-route-stop",
            actionTypes: ["clear-route-stop"],
            requiresBookingSelection: false,
            requiresConfirmation: false,
            executed: false,
            notifyCustomer: false,
            matchedBookingId: booking.id,
            matchedCustomerName: booking.customerName,
            sourceWindowKey,
            previewLabel: "No route stop set",
            previewMessage: "This booking does not currently have a provider-only interim route stop.",
            bookingCandidates: [this.toProviderAssistantBookingCandidate(booking)]
          };
        }

        if (!execute) {
          return {
            command: originalCommand,
            understood: true,
            actionType: "clear-route-stop",
            actionTypes: ["clear-route-stop"],
            requiresBookingSelection: false,
            requiresConfirmation: true,
            executed: false,
            notifyCustomer: false,
            matchedBookingId: booking.id,
            matchedCustomerName: booking.customerName,
            sourceWindowKey,
            previewLabel: "Ready to clear route stop",
            previewMessage: `Clear ${activeRouteStop.label} so tracking heads straight to the property again.`,
            bookingCandidates: [this.toProviderAssistantBookingCandidate(booking)]
          };
        }

        const clearedBooking = await this.clearBookingRouteStop(providerId, { bookingId: booking.id });
        const now = new Date().toISOString();
        const intervention: BookingInterventionRecord = {
          id: crypto.randomUUID(),
          action: "provider-assistant-clear-route-stop",
          createdAt: now,
          actorRole: "provider-assistant",
          actorUserId: providerId,
          note: `Provider assistant command: ${originalCommand}`
        };
        const bookingWithIntervention = await this.repository.updateBooking(booking.id, {
          interventions: [...clearedBooking.interventions, intervention]
        });

        return {
          command: originalCommand,
          understood: true,
          actionType: "clear-route-stop",
          actionTypes: ["clear-route-stop"],
          requiresBookingSelection: false,
          requiresConfirmation: false,
          executed: true,
          notifyCustomer: false,
          matchedBookingId: booking.id,
          matchedCustomerName: booking.customerName,
          sourceWindowKey,
          previewLabel: "Route stop cleared",
          previewMessage: `Cleared ${activeRouteStop.label}. Tracking will now point straight to the property.`,
          bookingCandidates: [this.toProviderAssistantBookingCandidate(bookingWithIntervention ?? clearedBooking)],
          updatedBooking: bookingWithIntervention ?? clearedBooking
        };
      }

      const routeStopKind = action.routeStopKind ?? "equipment-pickup";
      const defaultLabel = routeStopKind === "staging" ? "Staging stop" : "Equipment pickup";
      if (
        activeRouteStop &&
        activeRouteStop.kind === routeStopKind &&
        activeRouteStop.address.line1 === provider.address.line1
      ) {
        return {
          command: originalCommand,
          understood: true,
          actionType: "set-route-stop",
          actionTypes: ["set-route-stop"],
          requiresBookingSelection: false,
          requiresConfirmation: false,
          executed: false,
          notifyCustomer: false,
          matchedBookingId: booking.id,
          matchedCustomerName: booking.customerName,
          sourceWindowKey,
          previewLabel: "Route stop already set",
          previewMessage: `${activeRouteStop.label} is already set as the next provider-only route stop for this booking.`,
          bookingCandidates: [this.toProviderAssistantBookingCandidate(booking)]
        };
      }

      if (!execute) {
        return {
          command: originalCommand,
          understood: true,
          actionType: "set-route-stop",
          actionTypes: ["set-route-stop"],
          requiresBookingSelection: false,
          requiresConfirmation: true,
          executed: false,
          notifyCustomer: false,
          matchedBookingId: booking.id,
          matchedCustomerName: booking.customerName,
          sourceWindowKey,
          previewLabel: "Ready to add route stop",
          previewMessage: `Add ${defaultLabel.toLowerCase()} at your business address before heading to the property. Customers will still only see your business route, while provider tracking keeps the extra stop visible internally.`,
          bookingCandidates: [this.toProviderAssistantBookingCandidate(booking)]
        };
      }

      const stopBooking = await this.setBookingRouteStop(providerId, {
        bookingId: booking.id,
        kind: routeStopKind,
        label: defaultLabel,
        address: provider.address
      });
      const now = new Date().toISOString();
      const intervention: BookingInterventionRecord = {
        id: crypto.randomUUID(),
        action: "provider-assistant-set-route-stop",
        createdAt: now,
        actorRole: "provider-assistant",
        actorUserId: providerId,
        note: `Provider assistant command: ${originalCommand}`
      };
      const bookingWithIntervention = await this.repository.updateBooking(booking.id, {
        interventions: [...stopBooking.interventions, intervention]
      });

      return {
        command: originalCommand,
        understood: true,
        actionType: "set-route-stop",
        actionTypes: ["set-route-stop"],
        requiresBookingSelection: false,
        requiresConfirmation: false,
        executed: true,
        notifyCustomer: false,
        matchedBookingId: booking.id,
        matchedCustomerName: booking.customerName,
        sourceWindowKey,
        previewLabel: "Route stop added",
        previewMessage: `${defaultLabel} is now the next provider-only route stop before the property.`,
        bookingCandidates: [this.toProviderAssistantBookingCandidate(bookingWithIntervention ?? stopBooking)],
        updatedBooking: bookingWithIntervention ?? stopBooking
      };
    }

    if (action.actionType === "message-crew") {
      const bookingMatches = (projectedMatches ?? (await this.repository.listCrewMatches())).filter(
        (match) =>
          match.bookingId === booking.id &&
          (match.status === "accepted" || match.status === "pending-provider-review")
      );

      if (bookingMatches.length === 0) {
        return {
          command: originalCommand,
          understood: true,
          actionType: "message-crew",
          actionTypes: ["message-crew"],
          requiresBookingSelection: false,
          requiresConfirmation: false,
          executed: false,
          notifyCustomer: false,
          matchedBookingId: booking.id,
          matchedCustomerName: booking.customerName,
          sourceWindowKey,
          previewLabel: "No crew available to message",
          previewMessage:
            "Add or accept at least one crew member on this job before sending a crew message from the provider assistant.",
          bookingCandidates: [this.toProviderAssistantBookingCandidate(booking)]
        };
      }

      const crewMatch = await this.resolveProviderAssistantCrewMatch(
        action.crewMessageCrewNameQuery,
        bookingMatches
      );
      if (!crewMatch || !action.crewMessageBody) {
        return {
          command: originalCommand,
          understood: true,
          actionType: "message-crew",
          actionTypes: ["message-crew"],
          requiresBookingSelection: false,
          requiresConfirmation: false,
          executed: false,
          notifyCustomer: false,
          matchedBookingId: booking.id,
          matchedCustomerName: booking.customerName,
          sourceWindowKey,
          previewLabel: "Crew message target not found",
          previewMessage:
            "The assistant could not match that crew name to a pending or accepted crew member on this job.",
          bookingCandidates: [this.toProviderAssistantBookingCandidate(booking)]
        };
      }

      if (!execute) {
        return {
          command: originalCommand,
          understood: true,
          actionType: "message-crew",
          actionTypes: ["message-crew"],
          requiresBookingSelection: false,
          requiresConfirmation: true,
          executed: false,
          notifyCustomer: false,
          matchedBookingId: booking.id,
          matchedCustomerName: booking.customerName,
          sourceWindowKey,
          previewLabel: "Ready to message crew",
          previewMessage: `Send ${crewMatch.crewMemberName}: "${action.crewMessageBody}"`,
          bookingCandidates: [this.toProviderAssistantBookingCandidate(booking)]
        };
      }

      const providerIdentity = await this.repository.findAuthIdentityByUserId(providerId);
      if (!providerIdentity || providerIdentity.role !== "provider") {
        throw new HttpError(404, "Provider identity not found for this assistant command");
      }

      await this.sendProviderCrewMessage(providerIdentity, {
        crewMatchId: crewMatch.id,
        body: action.crewMessageBody
      });

      const now = new Date().toISOString();
      const intervention: BookingInterventionRecord = {
        id: crypto.randomUUID(),
        action: "provider-assistant-message-crew",
        createdAt: now,
        actorRole: "provider-assistant",
        actorUserId: providerId,
        note: `Provider assistant command: ${originalCommand}`,
        previousStatus: booking.status,
        nextStatus: booking.status
      };
      const bookingWithIntervention = await this.repository.updateBooking(booking.id, {
        interventions: [...booking.interventions, intervention]
      });

      return {
        command: originalCommand,
        understood: true,
        actionType: "message-crew",
        actionTypes: ["message-crew"],
        requiresBookingSelection: false,
        requiresConfirmation: false,
        executed: true,
        notifyCustomer: false,
        matchedBookingId: booking.id,
        matchedCustomerName: booking.customerName,
        sourceWindowKey,
        previewLabel: "Crew message sent",
        previewMessage: `Sent ${crewMatch.crewMemberName}: "${action.crewMessageBody}"`,
        bookingCandidates: [this.toProviderAssistantBookingCandidate(bookingWithIntervention ?? booking)],
        updatedBooking: bookingWithIntervention ?? booking
      };
    }

    if (action.actionType === "assign-route-leader" || action.actionType === "clear-route-leader") {
      const provider = await this.repository.findProviderById(providerId);
      if (!provider) {
        throw new HttpError(404, "Provider not found for this assistant command");
      }

      if (provider.routeLeaderMode !== "accepted-crew-fallback") {
        return {
          command: originalCommand,
          understood: true,
          actionType: action.actionType,
          actionTypes: [action.actionType],
          requiresBookingSelection: false,
          requiresConfirmation: false,
          executed: false,
          notifyCustomer: false,
          matchedBookingId: booking.id,
          sourceWindowKey,
          previewLabel: "Crew route fallback is off",
          previewMessage: "Turn on accepted-crew fallback before using the provider assistant to delegate route leadership.",
          bookingCandidates: [this.toProviderAssistantBookingCandidate(booking)]
        };
      }

      if (booking.onRouteConfirmedAt) {
        return {
          command: originalCommand,
          understood: true,
          actionType: action.actionType,
          actionTypes: [action.actionType],
          requiresBookingSelection: false,
          requiresConfirmation: false,
          executed: false,
          notifyCustomer: false,
          matchedBookingId: booking.id,
          sourceWindowKey,
          previewLabel: "Route already started",
          previewMessage: "Route leadership is locked once the route is already live.",
          bookingCandidates: [this.toProviderAssistantBookingCandidate(booking)]
        };
      }

      const acceptedMatches = (projectedMatches ?? (await this.repository.listCrewMatches())).filter(
        (match) => match.bookingId === booking.id && match.status === "accepted"
      );

      if (acceptedMatches.length === 0) {
        return {
          command: originalCommand,
          understood: true,
          actionType: action.actionType,
          actionTypes: [action.actionType],
          requiresBookingSelection: false,
          requiresConfirmation: false,
          executed: false,
          notifyCustomer: false,
          matchedBookingId: booking.id,
          sourceWindowKey,
          previewLabel: "No accepted crew yet",
          previewMessage: "Accept at least one crew member on this job before delegating route leadership.",
          bookingCandidates: [this.toProviderAssistantBookingCandidate(booking)]
        };
      }

      if (action.actionType === "clear-route-leader") {
        if (!booking.assignedRouteLeaderCrewMemberId) {
          return {
            command: originalCommand,
            understood: true,
            actionType: "clear-route-leader",
            actionTypes: ["clear-route-leader"],
            requiresBookingSelection: false,
            requiresConfirmation: false,
            executed: false,
            notifyCustomer: false,
            matchedBookingId: booking.id,
            sourceWindowKey,
            previewLabel: "No explicit route leader set",
            previewMessage: "This job does not currently have an explicit crew route-leader assignment to clear.",
            bookingCandidates: [this.toProviderAssistantBookingCandidate(booking)]
          };
        }

        const currentLeader = await this.repository.findCrewMemberById(booking.assignedRouteLeaderCrewMemberId);
        if (!execute) {
          return {
            command: originalCommand,
            understood: true,
            actionType: "clear-route-leader",
            actionTypes: ["clear-route-leader"],
            requiresBookingSelection: false,
            requiresConfirmation: true,
            executed: false,
            notifyCustomer: false,
            matchedBookingId: booking.id,
            sourceWindowKey,
            previewLabel: "Ready to clear route leader",
            previewMessage: `Clear ${currentLeader?.fullName ?? "the crew lead"} as the explicit route leader for this job.`,
            bookingCandidates: [this.toProviderAssistantBookingCandidate(booking)]
          };
        }

        const clearedBooking = await this.assignBookingRouteLeader(providerId, {
          bookingId: booking.id
        });
        const now = new Date().toISOString();
        const intervention: BookingInterventionRecord = {
          id: crypto.randomUUID(),
          action: "provider-assistant-clear-route-leader",
          createdAt: now,
          actorRole: "provider-assistant",
          actorUserId: providerId,
          note: `Provider assistant command: ${originalCommand}`,
          previousStatus: booking.status,
          nextStatus: clearedBooking.status
        };
        const bookingWithIntervention = await this.repository.updateBooking(booking.id, {
          interventions: [...clearedBooking.interventions, intervention]
        });

        return {
          command: originalCommand,
          understood: true,
          actionType: "clear-route-leader",
          actionTypes: ["clear-route-leader"],
          requiresBookingSelection: false,
          requiresConfirmation: false,
          executed: true,
          notifyCustomer: false,
          matchedBookingId: booking.id,
          sourceWindowKey,
          previewLabel: "Route leader cleared",
          previewMessage: `Cleared the explicit route-leader assignment for this job.`,
          bookingCandidates: [this.toProviderAssistantBookingCandidate(bookingWithIntervention ?? clearedBooking)],
          updatedBooking: bookingWithIntervention ?? clearedBooking
        };
      }

      const routeLeaderMatch = await this.resolveProviderAssistantCrewMatch(
        action.routeLeaderCrewNameQuery,
        acceptedMatches
      );
      if (!routeLeaderMatch) {
        return {
          command: originalCommand,
          understood: true,
          actionType: "assign-route-leader",
          actionTypes: ["assign-route-leader"],
          requiresBookingSelection: false,
          requiresConfirmation: false,
          executed: false,
          notifyCustomer: false,
          matchedBookingId: booking.id,
          sourceWindowKey,
          previewLabel: "Accepted crew member not found",
          previewMessage: "The assistant could not match that crew name to an accepted crew member on this job.",
          bookingCandidates: [this.toProviderAssistantBookingCandidate(booking)]
        };
      }

      if (booking.assignedRouteLeaderCrewMemberId === routeLeaderMatch.crewMemberId) {
        return {
          command: originalCommand,
          understood: true,
          actionType: "assign-route-leader",
          actionTypes: ["assign-route-leader"],
          requiresBookingSelection: false,
          requiresConfirmation: false,
          executed: false,
          notifyCustomer: false,
          matchedBookingId: booking.id,
          sourceWindowKey,
          previewLabel: "Route leader already assigned",
          previewMessage: `${routeLeaderMatch.crewMemberName} is already the explicit route leader for this job.`,
          bookingCandidates: [this.toProviderAssistantBookingCandidate(booking)]
        };
      }

      if (!execute) {
        return {
          command: originalCommand,
          understood: true,
          actionType: "assign-route-leader",
          actionTypes: ["assign-route-leader"],
          requiresBookingSelection: false,
          requiresConfirmation: true,
          executed: false,
          notifyCustomer: false,
          matchedBookingId: booking.id,
          sourceWindowKey,
          previewLabel: "Ready to assign route leader",
          previewMessage: `Assign ${routeLeaderMatch.crewMemberName} as the route leader for this job.`,
          bookingCandidates: [this.toProviderAssistantBookingCandidate(booking)]
        };
      }

      const assignedBooking = await this.assignBookingRouteLeader(providerId, {
        bookingId: booking.id,
        crewMemberId: routeLeaderMatch.crewMemberId
      });
      const now = new Date().toISOString();
      const intervention: BookingInterventionRecord = {
        id: crypto.randomUUID(),
        action: "provider-assistant-assign-route-leader",
        createdAt: now,
        actorRole: "provider-assistant",
        actorUserId: providerId,
        note: `Provider assistant command: ${originalCommand}`,
        previousStatus: booking.status,
        nextStatus: assignedBooking.status
      };
      const bookingWithIntervention = await this.repository.updateBooking(booking.id, {
        interventions: [...assignedBooking.interventions, intervention]
      });

      return {
        command: originalCommand,
        understood: true,
        actionType: "assign-route-leader",
        actionTypes: ["assign-route-leader"],
        requiresBookingSelection: false,
        requiresConfirmation: false,
        executed: true,
        notifyCustomer: false,
        matchedBookingId: booking.id,
        sourceWindowKey,
        previewLabel: "Route leader assigned",
        previewMessage: `Assigned ${routeLeaderMatch.crewMemberName} as the route leader for this job.`,
        bookingCandidates: [this.toProviderAssistantBookingCandidate(bookingWithIntervention ?? assignedBooking)],
        updatedBooking: bookingWithIntervention ?? assignedBooking
      };
    }

    if (action.actionType === "confirm-booking") {
      const customer = await this.repository.findCustomerById(booking.customerId);
      if (booking.status === "confirmed" || booking.status === "in-progress" || booking.status === "completed") {
        return {
          command: originalCommand,
          understood: true,
          actionType: "confirm-booking",
          actionTypes: ["confirm-booking"],
          requiresBookingSelection: false,
          requiresConfirmation: false,
          executed: false,
          notifyCustomer: true,
          matchedBookingId: booking.id,
          matchedCustomerName: customer?.fullName,
          sourceWindowKey,
          previewLabel: "Booking already confirmed",
          previewMessage: `${customer?.fullName ?? "This customer"} is already confirmed and ready for the next lifecycle step.`,
          bookingCandidates: [this.toProviderAssistantBookingCandidate(booking)]
        };
      }

      if (booking.status !== "requested") {
        return {
          command: originalCommand,
          understood: true,
          actionType: "confirm-booking",
          actionTypes: ["confirm-booking"],
          requiresBookingSelection: false,
          requiresConfirmation: false,
          executed: false,
          notifyCustomer: true,
          matchedBookingId: booking.id,
          matchedCustomerName: customer?.fullName,
          sourceWindowKey,
          previewLabel: "Booking cannot be confirmed",
          previewMessage: "Only requested bookings can be confirmed from the provider assistant.",
          bookingCandidates: [this.toProviderAssistantBookingCandidate(booking)]
        };
      }

      const customerNotificationPreview = `${
        customer?.fullName ?? "The customer"
      } will be told that their requested service window is confirmed.`;

      if (!execute) {
        return {
          command: originalCommand,
          understood: true,
          actionType: "confirm-booking",
          actionTypes: ["confirm-booking"],
          requiresBookingSelection: false,
          requiresConfirmation: true,
          executed: false,
          notifyCustomer: true,
          matchedBookingId: booking.id,
          matchedCustomerName: customer?.fullName,
          sourceWindowKey,
          previewLabel: "Ready to confirm booking",
          previewMessage: `Confirm ${customer?.fullName ?? "this customer"} for ${this.formatBookingWindowWithDate(
            booking.scheduledStartIso
          )}.`,
          customerNotificationPreview,
          bookingCandidates: [this.toProviderAssistantBookingCandidate(booking)]
        };
      }

      const confirmedBooking = await this.confirmBooking(providerId, { bookingId: booking.id });
      const now = new Date().toISOString();
      const intervention: BookingInterventionRecord = {
        id: crypto.randomUUID(),
        action: "provider-assistant-confirm-booking",
        createdAt: now,
        actorRole: "provider-assistant",
        actorUserId: providerId,
        note: `Provider assistant command: ${originalCommand}`,
        previousStatus: booking.status,
        nextStatus: confirmedBooking.status
      };
      const bookingWithIntervention = await this.repository.updateBooking(booking.id, {
        interventions: [...confirmedBooking.interventions, intervention]
      });

      return {
        command: originalCommand,
        understood: true,
        actionType: "confirm-booking",
        actionTypes: ["confirm-booking"],
        requiresBookingSelection: false,
        requiresConfirmation: false,
        executed: true,
        notifyCustomer: true,
        matchedBookingId: booking.id,
        matchedCustomerName: customer?.fullName,
        sourceWindowKey,
        previewLabel: "Booking confirmed",
        previewMessage: `Confirmed ${customer?.fullName ?? "the customer"} for ${this.formatBookingWindowWithDate(
          booking.scheduledStartIso
        )}.`,
        customerNotificationPreview,
        bookingCandidates: [this.toProviderAssistantBookingCandidate(bookingWithIntervention ?? confirmedBooking)],
        updatedBooking: bookingWithIntervention ?? confirmedBooking
      };
    }

    if (action.actionType === "complete-booking") {
      const customer = await this.repository.findCustomerById(booking.customerId);
      if (booking.status === "completed") {
        return {
          command: originalCommand,
          understood: true,
          actionType: "complete-booking",
          actionTypes: ["complete-booking"],
          requiresBookingSelection: false,
          requiresConfirmation: false,
          executed: false,
          notifyCustomer: true,
          matchedBookingId: booking.id,
          matchedCustomerName: customer?.fullName,
          sourceWindowKey,
          previewLabel: "Booking already completed",
          previewMessage: `${customer?.fullName ?? "This customer"} is already marked complete.`,
          bookingCandidates: [this.toProviderAssistantBookingCandidate(booking)]
        };
      }

      if (booking.status !== "confirmed" && booking.status !== "in-progress") {
        return {
          command: originalCommand,
          understood: true,
          actionType: "complete-booking",
          actionTypes: ["complete-booking"],
          requiresBookingSelection: false,
          requiresConfirmation: false,
          executed: false,
          notifyCustomer: true,
          matchedBookingId: booking.id,
          matchedCustomerName: customer?.fullName,
          sourceWindowKey,
          previewLabel: "Booking cannot be completed",
          previewMessage: "Only confirmed or in-progress bookings can be completed from the provider assistant.",
          bookingCandidates: [this.toProviderAssistantBookingCandidate(booking)]
        };
      }

      if (this.countBookingEvidence(booking, "after") < 1) {
        return {
          command: originalCommand,
          understood: true,
          actionType: "complete-booking",
          actionTypes: ["complete-booking"],
          requiresBookingSelection: false,
          requiresConfirmation: false,
          executed: false,
          notifyCustomer: true,
          matchedBookingId: booking.id,
          matchedCustomerName: customer?.fullName,
          sourceWindowKey,
          previewLabel: "After photo still needed",
          previewMessage: "Capture at least one after photo before completing the booking from the provider assistant.",
          bookingCandidates: [this.toProviderAssistantBookingCandidate(booking)]
        };
      }

      const customerNotificationPreview = `${
        customer?.fullName ?? "The customer"
      } will be told the service is complete and the review follow-up timer will begin.`;

      if (!execute) {
        return {
          command: originalCommand,
          understood: true,
          actionType: "complete-booking",
          actionTypes: ["complete-booking"],
          requiresBookingSelection: false,
          requiresConfirmation: true,
          executed: false,
          notifyCustomer: true,
          matchedBookingId: booking.id,
          matchedCustomerName: customer?.fullName,
          sourceWindowKey,
          previewLabel: "Ready to complete booking",
          previewMessage: `Complete ${customer?.fullName ?? "this customer"} and close out the service lifecycle.`,
          customerNotificationPreview,
          bookingCandidates: [this.toProviderAssistantBookingCandidate(booking)]
        };
      }

      const completedBooking = await this.completeBooking(providerId, { bookingId: booking.id });
      const now = new Date().toISOString();
      const intervention: BookingInterventionRecord = {
        id: crypto.randomUUID(),
        action: "provider-assistant-complete-booking",
        createdAt: now,
        actorRole: "provider-assistant",
        actorUserId: providerId,
        note: `Provider assistant command: ${originalCommand}`,
        previousStatus: booking.status,
        nextStatus: completedBooking.status
      };
      const bookingWithIntervention = await this.repository.updateBooking(booking.id, {
        interventions: [...completedBooking.interventions, intervention]
      });

      return {
        command: originalCommand,
        understood: true,
        actionType: "complete-booking",
        actionTypes: ["complete-booking"],
        requiresBookingSelection: false,
        requiresConfirmation: false,
        executed: true,
        notifyCustomer: true,
        matchedBookingId: booking.id,
        matchedCustomerName: customer?.fullName,
        sourceWindowKey,
        previewLabel: "Booking completed",
        previewMessage: `Completed ${customer?.fullName ?? "the customer"} and closed out the service lifecycle.`,
        customerNotificationPreview,
        bookingCandidates: [this.toProviderAssistantBookingCandidate(bookingWithIntervention ?? completedBooking)],
        updatedBooking: bookingWithIntervention ?? completedBooking
      };
    }

    if (action.actionType === "report-booking-exception") {
      const customer = await this.repository.findCustomerById(booking.customerId);
      const exceptionLabel = getBookingExceptionLabel(action.exceptionType!);
      const notesSuffix = action.exceptionNotes ? ` Reason: ${action.exceptionNotes}` : "";
      const customerNotificationPreview = `${customer?.fullName ?? "The customer"} will be told: ${exceptionLabel}.${notesSuffix}`;

      if (booking.status === "completed" || booking.status === "cancelled" || booking.status === "refunded") {
        return {
          command: originalCommand,
          understood: true,
          actionType: "report-booking-exception",
          actionTypes: ["report-booking-exception"],
          requiresBookingSelection: false,
          requiresConfirmation: false,
          executed: false,
          notifyCustomer: true,
          matchedBookingId: booking.id,
          matchedCustomerName: customer?.fullName,
          sourceWindowKey,
          previewLabel: "Issue cannot be logged now",
          previewMessage: "Service issues can only be reported while the booking is still active.",
          bookingCandidates: [this.toProviderAssistantBookingCandidate(booking)]
        };
      }

      if (!execute) {
        return {
          command: originalCommand,
          understood: true,
          actionType: "report-booking-exception",
          actionTypes: ["report-booking-exception"],
          requiresBookingSelection: false,
          requiresConfirmation: true,
          executed: false,
          notifyCustomer: true,
          matchedBookingId: booking.id,
          matchedCustomerName: customer?.fullName,
          sourceWindowKey,
          previewLabel: "Ready to report issue",
          previewMessage: `Log ${exceptionLabel.toLowerCase()} for ${customer?.fullName ?? "this customer"} and notify support-facing surfaces immediately.`,
          customerNotificationPreview,
          bookingCandidates: [this.toProviderAssistantBookingCandidate(booking)]
        };
      }

      const exceptionBooking = await this.markBookingException(providerId, {
        bookingId: booking.id,
        exceptionType: action.exceptionType!,
        notes: action.exceptionNotes
      });
      const now = new Date().toISOString();
      const intervention: BookingInterventionRecord = {
        id: crypto.randomUUID(),
        action: "provider-assistant-report-exception",
        createdAt: now,
        actorRole: "provider-assistant",
        actorUserId: providerId,
        note: `Provider assistant command: ${originalCommand}`,
        previousStatus: booking.status,
        nextStatus: exceptionBooking.status
      };
      const bookingWithIntervention = await this.repository.updateBooking(booking.id, {
        interventions: [...exceptionBooking.interventions, intervention]
      });

      return {
        command: originalCommand,
        understood: true,
        actionType: "report-booking-exception",
        actionTypes: ["report-booking-exception"],
        requiresBookingSelection: false,
        requiresConfirmation: false,
        executed: true,
        notifyCustomer: true,
        matchedBookingId: booking.id,
        matchedCustomerName: customer?.fullName,
        sourceWindowKey,
        previewLabel: "Issue reported",
        previewMessage: `Logged ${exceptionLabel.toLowerCase()} for ${customer?.fullName ?? "the customer"}.`,
        customerNotificationPreview,
        bookingCandidates: [this.toProviderAssistantBookingCandidate(bookingWithIntervention ?? exceptionBooking)],
        updatedBooking: bookingWithIntervention ?? exceptionBooking
      };
    }

    if (action.actionType === "mark-booking-late") {
      const lateEtaIso = this.buildProviderAssistantLateEta(booking, action.lateMinutes!);
      const customer = await this.repository.findCustomerById(booking.customerId);
      const lateWindowLabel = getBookingServiceWindow(booking.scheduledStartIso).label.toLowerCase();
      const etaText = new Date(lateEtaIso).toLocaleTimeString([], { timeStyle: "short" });
      const reasonText = action.lateReason ? ` Reason: ${action.lateReason}` : "";
      const customerNotificationPreview = `${
        customer?.fullName ?? "The customer"
      } will be told you now expect to arrive around ${etaText} in the ${lateWindowLabel} window.${reasonText}`;

      if (!execute) {
        return {
          command: originalCommand,
          understood: true,
          actionType: "mark-booking-late",
          actionTypes: ["mark-booking-late"],
          requiresBookingSelection: false,
          requiresConfirmation: true,
          executed: false,
          notifyCustomer: true,
          matchedBookingId: booking.id,
          matchedCustomerName: customer?.fullName,
          sourceWindowKey,
          lateMinutes: action.lateMinutes,
          lateEtaIso,
          previewLabel: "Ready to send a late update",
          previewMessage: `Let ${customer?.fullName ?? "this customer"} know you are about ${
            action.lateMinutes
          } minutes behind and now expect to arrive around ${etaText}.`,
          customerNotificationPreview,
          bookingCandidates: [this.toProviderAssistantBookingCandidate(booking)]
        };
      }

      const lateUpdatedBooking = await this.markBookingLate(providerId, {
        bookingId: booking.id,
        lateEtaIso,
        reason: action.lateReason
      });
      const now = new Date().toISOString();
      const intervention: BookingInterventionRecord = {
        id: crypto.randomUUID(),
        action: "provider-assistant-late-update",
        createdAt: now,
        actorRole: "provider-assistant",
        actorUserId: providerId,
        note: `Provider assistant command: ${originalCommand}`,
        previousStatus: booking.status,
        nextStatus: lateUpdatedBooking.status
      };
      const bookingWithIntervention = await this.repository.updateBooking(booking.id, {
        interventions: [...lateUpdatedBooking.interventions, intervention]
      });

      return {
        command: originalCommand,
        understood: true,
        actionType: "mark-booking-late",
        actionTypes: ["mark-booking-late"],
        requiresBookingSelection: false,
        requiresConfirmation: false,
        executed: true,
        notifyCustomer: true,
        matchedBookingId: booking.id,
        matchedCustomerName: customer?.fullName,
        sourceWindowKey,
        lateMinutes: action.lateMinutes,
        lateEtaIso,
        previewLabel: "Late update sent",
        previewMessage: `Sent a late update to ${customer?.fullName ?? "the customer"} with an arrival estimate around ${etaText}.`,
        customerNotificationPreview,
        bookingCandidates: [this.toProviderAssistantBookingCandidate(bookingWithIntervention ?? lateUpdatedBooking)],
        updatedBooking: bookingWithIntervention ?? lateUpdatedBooking
      };
    }

    if (action.actionType === "start-route") {
      const customer = await this.repository.findCustomerById(booking.customerId);
      if (booking.status !== "confirmed") {
        return {
          command: originalCommand,
          understood: true,
          actionType: "start-route",
          actionTypes: ["start-route"],
          requiresBookingSelection: false,
          requiresConfirmation: false,
          executed: false,
          notifyCustomer: true,
          matchedBookingId: booking.id,
          matchedCustomerName: customer?.fullName,
          sourceWindowKey,
          previewLabel: "Route cannot start yet",
          previewMessage: "Confirm this booking before starting the route from the provider assistant.",
          bookingCandidates: [this.toProviderAssistantBookingCandidate(booking)]
        };
      }

      const customerNotificationPreview = `${
        customer?.fullName ?? "The customer"
      } will be told that your crew is on the way and live arrival tracking will unlock.`;

      if (!execute) {
        return {
          command: originalCommand,
          understood: true,
          actionType: "start-route",
          actionTypes: ["start-route"],
          requiresBookingSelection: false,
          requiresConfirmation: true,
          executed: false,
          notifyCustomer: true,
          matchedBookingId: booking.id,
          matchedCustomerName: customer?.fullName,
          sourceWindowKey,
          previewLabel: "Ready to start the route",
          previewMessage: `Start the route for ${customer?.fullName ?? "this customer"} and unlock live arrival tracking.`,
          customerNotificationPreview,
          bookingCandidates: [this.toProviderAssistantBookingCandidate(booking)]
        };
      }

      const providerIdentity = await this.repository.findAuthIdentityByUserId(providerId);
      if (!providerIdentity || providerIdentity.role !== "provider") {
        throw new HttpError(404, "Provider identity not found for this assistant command");
      }

      const onRouteBooking = await this.markBookingOnRoute(providerIdentity, { bookingId: booking.id });
      const now = new Date().toISOString();
      const intervention: BookingInterventionRecord = {
        id: crypto.randomUUID(),
        action: "provider-assistant-start-route",
        createdAt: now,
        actorRole: "provider-assistant",
        actorUserId: providerId,
        note: `Provider assistant command: ${originalCommand}`,
        previousStatus: booking.status,
        nextStatus: onRouteBooking.status
      };
      const bookingWithIntervention = await this.repository.updateBooking(booking.id, {
        interventions: [...onRouteBooking.interventions, intervention]
      });

      return {
        command: originalCommand,
        understood: true,
        actionType: "start-route",
        actionTypes: ["start-route"],
        requiresBookingSelection: false,
        requiresConfirmation: false,
        executed: true,
        notifyCustomer: true,
        matchedBookingId: booking.id,
        matchedCustomerName: customer?.fullName,
        sourceWindowKey,
        previewLabel: "Route started",
        previewMessage: `Started the route for ${customer?.fullName ?? "the customer"} and unlocked live arrival tracking.`,
        customerNotificationPreview,
        bookingCandidates: [this.toProviderAssistantBookingCandidate(bookingWithIntervention ?? onRouteBooking)],
        updatedBooking: bookingWithIntervention ?? onRouteBooking
      };
    }

    if (action.actionType === "start-work") {
      const customer = await this.repository.findCustomerById(booking.customerId);
      if (booking.status === "in-progress") {
        return {
          command: originalCommand,
          understood: true,
          actionType: "start-work",
          actionTypes: ["start-work"],
          requiresBookingSelection: false,
          requiresConfirmation: false,
          executed: false,
          notifyCustomer: false,
          matchedBookingId: booking.id,
          matchedCustomerName: customer?.fullName,
          sourceWindowKey,
          previewLabel: "Work already started",
          previewMessage: `${customer?.fullName ?? "This customer"} is already marked in progress.`,
          bookingCandidates: [this.toProviderAssistantBookingCandidate(booking)]
        };
      }

      if (booking.status !== "confirmed") {
        return {
          command: originalCommand,
          understood: true,
          actionType: "start-work",
          actionTypes: ["start-work"],
          requiresBookingSelection: false,
          requiresConfirmation: false,
          executed: false,
          notifyCustomer: false,
          matchedBookingId: booking.id,
          matchedCustomerName: customer?.fullName,
          sourceWindowKey,
          previewLabel: "Work cannot start yet",
          previewMessage: "Confirm this booking before starting work from the provider assistant.",
          bookingCandidates: [this.toProviderAssistantBookingCandidate(booking)]
        };
      }

      if (!booking.onRouteConfirmedAt) {
        return {
          command: originalCommand,
          understood: true,
          actionType: "start-work",
          actionTypes: ["start-work"],
          requiresBookingSelection: false,
          requiresConfirmation: false,
          executed: false,
          notifyCustomer: false,
          matchedBookingId: booking.id,
          matchedCustomerName: customer?.fullName,
          sourceWindowKey,
          previewLabel: "Start the route first",
          previewMessage: "Start the route first, then ask the provider assistant to begin work.",
          bookingCandidates: [this.toProviderAssistantBookingCandidate(booking)]
        };
      }

      if (this.countBookingEvidence(booking, "before") < 1) {
        return {
          command: originalCommand,
          understood: true,
          actionType: "start-work",
          actionTypes: ["start-work"],
          requiresBookingSelection: false,
          requiresConfirmation: false,
          executed: false,
          notifyCustomer: false,
          matchedBookingId: booking.id,
          matchedCustomerName: customer?.fullName,
          sourceWindowKey,
          previewLabel: "Before photo still needed",
          previewMessage: "Capture at least one before photo before starting work from the provider assistant.",
          bookingCandidates: [this.toProviderAssistantBookingCandidate(booking)]
        };
      }

      if (!execute) {
        return {
          command: originalCommand,
          understood: true,
          actionType: "start-work",
          actionTypes: ["start-work"],
          requiresBookingSelection: false,
          requiresConfirmation: true,
          executed: false,
          notifyCustomer: false,
          matchedBookingId: booking.id,
          matchedCustomerName: customer?.fullName,
          sourceWindowKey,
          previewLabel: "Ready to start work",
          previewMessage: `Start work for ${customer?.fullName ?? "this customer"} and move the booking into the active job state.`,
          bookingCandidates: [this.toProviderAssistantBookingCandidate(booking)]
        };
      }

      const providerIdentity = await this.repository.findAuthIdentityByUserId(providerId);
      if (!providerIdentity || providerIdentity.role !== "provider") {
        throw new HttpError(404, "Provider identity not found for this assistant command");
      }

      const startedBooking = await this.startBooking(providerIdentity, { bookingId: booking.id });
      const now = new Date().toISOString();
      const intervention: BookingInterventionRecord = {
        id: crypto.randomUUID(),
        action: "provider-assistant-start-work",
        createdAt: now,
        actorRole: "provider-assistant",
        actorUserId: providerId,
        note: `Provider assistant command: ${originalCommand}`,
        previousStatus: booking.status,
        nextStatus: startedBooking.status
      };
      const bookingWithIntervention = await this.repository.updateBooking(booking.id, {
        interventions: [...startedBooking.interventions, intervention]
      });

      return {
        command: originalCommand,
        understood: true,
        actionType: "start-work",
        actionTypes: ["start-work"],
        requiresBookingSelection: false,
        requiresConfirmation: false,
        executed: true,
        notifyCustomer: false,
        matchedBookingId: booking.id,
        matchedCustomerName: customer?.fullName,
        sourceWindowKey,
        previewLabel: "Work started",
        previewMessage: `Started work for ${customer?.fullName ?? "the customer"} and moved the booking into progress.`,
        bookingCandidates: [this.toProviderAssistantBookingCandidate(bookingWithIntervention ?? startedBooking)],
        updatedBooking: bookingWithIntervention ?? startedBooking
      };
    }

    const targetWindowKey = action.targetWindowKey!;
    const targetWindow = this.buildProviderAssistantTargetWindow(booking, targetWindowKey);
    const customer = await this.repository.findCustomerById(booking.customerId);
    await this.assertProviderRescheduleWindowIsAvailable(
      booking.providerId,
      booking.id,
      targetWindow.startIso,
      targetWindow.endIso
    );

    const customerNotificationPreview = `Updated to ${this.formatBookingWindowWithDate(targetWindow.startIso)} for ${
      customer?.fullName ?? "the customer"
    }.`;

    if (!execute) {
      return {
        command: originalCommand,
        understood: true,
        actionType: "reschedule-booking",
        actionTypes: ["reschedule-booking"],
        requiresBookingSelection: false,
        requiresConfirmation: true,
        executed: false,
        notifyCustomer: true,
        matchedBookingId: booking.id,
        matchedCustomerName: customer?.fullName,
        sourceWindowKey,
        targetWindowKey,
        targetWindowLabel: this.providerAssistantWindowLabel(targetWindowKey),
        suggestedStartIso: targetWindow.startIso,
        suggestedEndIso: targetWindow.endIso,
        previewLabel: "Ready to reschedule",
        previewMessage: `Move ${customer?.fullName ?? "this customer"} to ${this.providerAssistantWindowLabel(
          targetWindowKey
        )} on ${new Date(targetWindow.startIso).toLocaleDateString()}.`,
        customerNotificationPreview,
        bookingCandidates: [this.toProviderAssistantBookingCandidate(booking)]
      };
    }

    const now = new Date().toISOString();
    const intervention: BookingInterventionRecord = {
      id: crypto.randomUUID(),
      action: "provider-assistant-reschedule",
      createdAt: now,
      actorRole: "provider-assistant",
      actorUserId: providerId,
      note: `Provider assistant command: ${originalCommand}`,
      previousStatus: booking.status,
      nextStatus: booking.status === "requested" ? "requested" : "confirmed",
      previousScheduledStartIso: booking.scheduledStartIso,
      previousScheduledEndIso: booking.scheduledEndIso,
      nextScheduledStartIso: targetWindow.startIso,
      nextScheduledEndIso: targetWindow.endIso
    };

    const updatedBooking = await this.repository.updateBooking(booking.id, {
      scheduledStartIso: targetWindow.startIso,
      scheduledEndIso: targetWindow.endIso,
      status: booking.status === "requested" ? "requested" : "confirmed",
      onRouteConfirmedAt: undefined,
      onRouteConfirmedByCrewMemberId: undefined,
      lateNoticeSentAt: undefined,
      lateEtaIso: undefined,
      lateReason: undefined,
      activeExceptionType: undefined,
      activeExceptionReportedAt: undefined,
      activeExceptionNotes: undefined,
      disputedAt: undefined,
      disputeReason: undefined,
      disputedByRole: undefined,
      completedAt: undefined,
      interventions: [...booking.interventions, intervention]
    });

    if (!updatedBooking) {
      throw new HttpError(500, "Provider assistant could not reschedule the booking");
    }

    await this.createNotification({
      recipientId: booking.customerId,
      recipientRole: "customer",
      category: "booking",
      title: "Your service window was updated",
      body: `Your provider moved this job to ${this.formatBookingWindowWithDate(targetWindow.startIso)}.`,
      actionHref: `/customer/dashboard?bookingId=${booking.id}`
    });

    this.analytics.record({
      id: crypto.randomUUID(),
      name: MarketplaceTelemetryEventCatalog.bookingRescheduled,
      actorId: providerId,
      occurredAt: now,
      properties: {
        bookingId: booking.id,
        providerId,
        previousStartIso: booking.scheduledStartIso,
        nextStartIso: targetWindow.startIso,
        source: "provider-assistant"
      }
    });

    return {
      command: originalCommand,
      understood: true,
      actionType: "reschedule-booking",
      actionTypes: ["reschedule-booking"],
      requiresBookingSelection: false,
      requiresConfirmation: false,
      executed: true,
      notifyCustomer: true,
      matchedBookingId: booking.id,
      matchedCustomerName: customer?.fullName,
      sourceWindowKey,
      targetWindowKey,
      targetWindowLabel: this.providerAssistantWindowLabel(targetWindowKey),
      suggestedStartIso: targetWindow.startIso,
      suggestedEndIso: targetWindow.endIso,
      previewLabel: "Command executed",
      previewMessage: `Moved ${customer?.fullName ?? "the customer"} to ${this.providerAssistantWindowLabel(
        targetWindowKey
      )} and sent an update.`,
      customerNotificationPreview,
      bookingCandidates: [this.toProviderAssistantBookingCandidate(updatedBooking)],
      updatedBooking
    };
  }

  private projectBookingAfterProviderAssistantAction(
    booking: Booking & { customerName: string },
    action: ParsedProviderAssistantAction
  ): Booking & { customerName: string } {
    const now = new Date().toISOString();
    if (action.actionType === "accept-crew-match" || action.actionType === "deny-crew-match") {
      return {
        ...booking
      };
    }

    if (action.actionType === "message-crew") {
      return {
        ...booking
      };
    }

    if (action.actionType === "set-route-stop") {
      return {
        ...booking
      };
    }

    if (action.actionType === "assign-route-leader") {
      return {
        ...booking
      };
    }

    if (action.actionType === "clear-route-leader") {
      return {
        ...booking,
        assignedRouteLeaderCrewMemberId: undefined
      };
    }

    if (action.actionType === "clear-route-stop") {
      return {
        ...booking,
        routeActiveStop: undefined
      };
    }

    if (action.actionType === "confirm-booking") {
      return {
        ...booking,
        status: "confirmed"
      };
    }

    if (action.actionType === "start-route") {
      return {
        ...booking,
        onRouteConfirmedAt: now,
        lateNoticeSentAt: undefined,
        lateEtaIso: undefined,
        lateReason: undefined
      };
    }

    if (action.actionType === "start-work") {
      return {
        ...booking,
        status: "in-progress"
      };
    }

    if (action.actionType === "complete-booking") {
      return {
        ...booking,
        status: "completed",
        completedAt: now,
        activeExceptionType: undefined,
        activeExceptionReportedAt: undefined,
        activeExceptionNotes: undefined
      };
    }

    if (action.actionType === "mark-booking-late") {
      return {
        ...booking,
        lateNoticeSentAt: now,
        lateEtaIso: this.buildProviderAssistantLateEta(booking, action.lateMinutes ?? 0),
        lateReason: action.lateReason
      };
    }

    if (action.actionType === "report-booking-exception") {
      return {
        ...booking,
        activeExceptionType: action.exceptionType,
        activeExceptionReportedAt: now,
        activeExceptionNotes: action.exceptionNotes
      };
    }

    const targetWindow = this.buildProviderAssistantTargetWindow(booking, action.targetWindowKey!);
    return {
      ...booking,
      scheduledStartIso: targetWindow.startIso,
      scheduledEndIso: targetWindow.endIso,
      status: booking.status === "requested" ? "requested" : "confirmed",
      onRouteConfirmedAt: undefined,
      onRouteConfirmedByCrewMemberId: undefined,
      lateNoticeSentAt: undefined,
      lateEtaIso: undefined,
      lateReason: undefined,
      activeExceptionType: undefined,
      activeExceptionReportedAt: undefined,
      activeExceptionNotes: undefined,
      disputedAt: undefined,
      disputeReason: undefined,
      disputedByRole: undefined,
      completedAt: undefined
    };
  }

  private projectCrewMatchesAfterProviderAssistantAction(
    matches: CrewMatchCandidate[],
    action: ParsedProviderAssistantAction
  ): CrewMatchCandidate[] {
    if (
      action.actionType !== "accept-best-crew-match" &&
      action.actionType !== "accept-crew-match" &&
      action.actionType !== "deny-crew-match"
    ) {
      return matches;
    }

    const matchedCrew =
      action.actionType === "accept-best-crew-match"
        ? matches.find((match) => match.status === "pending-provider-review")
        : matches.find((match) => {
            if (
              match.status !== "pending-provider-review" &&
              match.status !== "accepted"
            ) {
              return false;
            }

            const normalizedName = match.crewMemberName.toLowerCase();
            const query = action.crewMatchCrewNameQuery?.trim().toLowerCase();
            if (!query) {
              return false;
            }

            return normalizedName === query || normalizedName.includes(query) || query.includes(normalizedName);
          });

    if (!matchedCrew) {
      return matches;
    }

    const nextStatus = action.actionType === "accept-crew-match" ? "accepted" : "denied";
    return matches.map((match) =>
      match.id === matchedCrew.id
        ? {
            ...match,
            status: nextStatus,
            reviewedAt: new Date().toISOString()
          }
        : match
    );
  }

  private buildProviderAssistantDispatchRangeSummary(
    dispatchDays: ProviderCalendarOverviewResponse["dispatchDays"]
  ): ProviderDispatchRangeSummary | undefined {
    const activeDays = dispatchDays.filter(
      (day) => day.yardmatchJobCount > 0 || day.externalBlockCount > 0
    );
    if (activeDays.length === 0) {
      return undefined;
    }

    const watchDays = activeDays.filter((day) => day.routeStatus === "watch");
    const overloadedDays = activeDays.filter((day) => day.routeStatus === "overloaded");
    const busiestDay = [...activeDays].sort((left, right) => right.yardmatchJobCount - left.yardmatchJobCount)[0];
    const highestCrewGapDay = [...activeDays].sort((left, right) => right.crewGap - left.crewGap)[0];
    const highestDriveMilesDay = [...activeDays].sort(
      (left, right) => right.estimatedDriveMiles - left.estimatedDriveMiles
    )[0];
    const recommendations = Array.from(
      new Set(activeDays.flatMap((day) => day.recommendations).filter(Boolean))
    ).slice(0, 3);

    return {
      scope: "next-7-days",
      activeDayCount: activeDays.length,
      totalYardmatchJobs: activeDays.reduce((sum, day) => sum + day.yardmatchJobCount, 0),
      totalExternalBlocks: activeDays.reduce((sum, day) => sum + day.externalBlockCount, 0),
      totalCrewGap: activeDays.reduce((sum, day) => sum + day.crewGap, 0),
      watchDayCount: watchDays.length,
      overloadedDayCount: overloadedDays.length,
      busiestDay,
      highestCrewGapDay,
      highestDriveMilesDay,
      recommendations
    };
  }

  private mergeProviderAssistantResponses(
    command: string,
    actionTypes: ProviderAssistantActionType[],
    responses: ProviderAssistantCommandResponse[],
    executed: boolean
  ): ProviderAssistantCommandResponse {
    const lastResponse = responses.at(-1)!;
    const previewMessages = responses.map((response, index) => `Step ${index + 1}: ${response.previewMessage}`);
    const notificationPreview = responses
      .map((response) => response.customerNotificationPreview)
      .filter((value): value is string => Boolean(value))
      .join(" Then, ");

    return {
      command,
      understood: true,
      actionType: responses[0]?.actionType,
      actionTypes,
      requiresBookingSelection: false,
      requiresConfirmation: !executed,
      executed,
      notifyCustomer: responses.some((response) => response.notifyCustomer),
      matchedBookingId: lastResponse.matchedBookingId,
      matchedCustomerName: lastResponse.matchedCustomerName,
      sourceWindowKey: responses[0]?.sourceWindowKey,
      targetWindowKey: lastResponse.targetWindowKey,
      targetWindowLabel: lastResponse.targetWindowLabel,
      suggestedStartIso: lastResponse.suggestedStartIso,
      suggestedEndIso: lastResponse.suggestedEndIso,
      lateMinutes: lastResponse.lateMinutes,
      lateEtaIso: lastResponse.lateEtaIso,
      previewLabel: executed ? "Multi-step command executed" : "Ready to run multi-step command",
      previewMessage: previewMessages.join(" "),
      customerNotificationPreview: notificationPreview || undefined,
      bookingCandidates: lastResponse.bookingCandidates,
      updatedBooking: lastResponse.updatedBooking
    };
  }

  private providerAssistantHelpText(): string {
    return 'Try a command like "Set equipment pickup as the next stop for my afternoon appointment", "Clear the route stop for my afternoon appointment", "Accept the best crew for my afternoon appointment", "Accept Morgan Crew for my afternoon appointment", "Confirm my afternoon appointment", "Confirm my afternoon appointment and start route", "Start route for my afternoon appointment and start work", "Make Taylor Crew the route leader for my afternoon appointment", "Tell Morgan Crew to head to the equipment pickup first for my afternoon appointment", "Clear the route leader for my afternoon appointment", "Move my afternoon appointment to evening and notify the customer", "Tell my afternoon customer I am 30 minutes late", "Complete my afternoon appointment", or "Mark my afternoon appointment no access because the gate is locked."';
  }

  public async createCustomerProperty(
    customerId: string,
    payload: CreateCustomerPropertyRequest
  ): Promise<CustomerProperty> {
    const customer = await this.repository.findCustomerById(customerId);

    if (!customer) {
      throw new Error("Customer not found");
    }

    const validatedAddress = await this.normalizeAndValidateAddress(payload.address);
    const property = this.propertyBook.createProperty(crypto.randomUUID(), {
      ...payload,
      address: validatedAddress.address,
      customerId
    });
    const properties = customer.properties.map((existingProperty) => ({
      ...existingProperty,
      isDefault: payload.setAsDefault ? false : existingProperty.isDefault
    }));
    properties.push(property);

    const defaultProperty = payload.setAsDefault
      ? property
      : properties.find((existingProperty) => existingProperty.isDefault) ?? property;

    await this.repository.updateCustomer(customer.id, {
      properties,
      defaultPropertyId: defaultProperty.id,
      address: defaultProperty.address,
      lawnSizeSqFt: defaultProperty.lawnSizeSqFt ?? customer.lawnSizeSqFt,
      propertyNotes: defaultProperty.accessNotes ?? customer.propertyNotes
    });

    this.analytics.record({
      id: crypto.randomUUID(),
      name: MarketplaceTelemetryEventCatalog.customerPropertyAdded,
      actorId: customer.id,
      occurredAt: new Date().toISOString(),
      properties: {
        propertyLabel: property.label,
        setAsDefault: property.isDefault,
        city: property.address.city
      }
    });

    return property;
  }

  public async listCustomerProperties(customerId: string): Promise<CustomerProperty[]> {
    return this.repository.listCustomerProperties(customerId);
  }

  public async listProviderReviews(providerId: string): Promise<ProviderReview[]> {
    return this.repository.listProviderReviews(providerId);
  }

  public async listCustomerReviewOpportunities(
    customerId: string
  ): Promise<ListCustomerReviewOpportunitiesResponse> {
    const now = new Date();
    const opportunities = (await this.repository
      .listBookings())
      .filter((booking) => booking.customerId === customerId && booking.status === "completed")
      .map(async (booking) => this.buildReviewOpportunity(booking, now))
      ;

    const resolvedOpportunities = (await Promise.all(opportunities))
      .filter((opportunity): opportunity is CustomerReviewOpportunity => opportunity !== undefined)
      .sort((left, right) => (right.completedAt ?? "").localeCompare(left.completedAt ?? ""));

    return {
      opportunities: resolvedOpportunities
    };
  }

  public async setDefaultCustomerProperty(
    customerId: string,
    payload: SetDefaultCustomerPropertyRequest
  ): Promise<CustomerProfile> {
    const customer = await this.repository.findCustomerById(customerId);

    if (!customer) {
      throw new Error("Customer not found");
    }

    const property = customer.properties.find((item) => item.id === payload.propertyId);
    if (!property) {
      throw new Error("Property not found");
    }

    const properties = this.propertyBook.setDefaultProperty(customer.properties, payload.propertyId);
    const updatedCustomer = await this.repository.updateCustomer(customer.id, {
      properties,
      defaultPropertyId: payload.propertyId,
      address: property.address,
      lawnSizeSqFt: property.lawnSizeSqFt ?? customer.lawnSizeSqFt,
      propertyNotes: property.accessNotes ?? customer.propertyNotes
    });

    if (!updatedCustomer) {
      throw new Error("Customer could not be updated");
    }

    this.analytics.record({
      id: crypto.randomUUID(),
      name: MarketplaceTelemetryEventCatalog.customerDefaultPropertyChanged,
      actorId: customer.id,
      occurredAt: new Date().toISOString(),
      properties: {
        propertyId: payload.propertyId,
        city: property.address.city
      }
    });

    return updatedCustomer;
  }

  public async listBookingsForUser(actor: AuthIdentityRecord): Promise<Booking[]> {
    const bookings = await this.repository.listBookings();
    if (actor.role === "customer") {
      return bookings.filter((booking) => booking.customerId === actor.userId);
    }

    if (actor.role === "provider") {
      return bookings.filter((booking) => booking.providerId === actor.userId);
    }

    return [];
  }

  public async updateBookingAddress(
    customerId: string,
    payload: UpdateBookingAddressRequest
  ): Promise<UpdateBookingAddressResponse> {
    const booking = await this.repository.findBookingById(payload.bookingId);
    if (!booking) {
      throw new Error("Booking not found");
    }

    if (booking.customerId !== customerId) {
      throw new Error("Only the booking customer can request an address change");
    }

    const customer = await this.repository.findCustomerById(customerId);
    if (!customer) {
      throw new Error("Customer not found");
    }

    const selectedProperty = payload.newPropertyId
      ? customer.properties.find((property) => property.id === payload.newPropertyId)
      : undefined;

    if (payload.newPropertyId && !selectedProperty) {
      throw new Error("Selected property does not belong to the customer");
    }

    const requestedAddress = selectedProperty
      ? selectedProperty.address
      : (await this.normalizeAndValidateAddress(payload.newAddress)).address;

    const provider = await this.repository.findProviderById(booking.providerId);
    if (!provider) {
      throw new Error("Provider not found");
    }

    const evaluation = this.bookingAddressPolicy.evaluateAddressChange({
      booking,
      provider,
      newAddress: requestedAddress
    });

    const historyEntry = this.bookingAddressPolicy.buildAddressChangeHistoryEntry({
      bookingId: booking.id,
      customerId,
      previousAddress: booking.serviceAddress,
      requestedAddress: requestedAddress,
      requestedPropertyId: payload.newPropertyId,
      outcome: evaluation.outcome,
      reason: evaluation.reason
    });

    const nextHistory = [...booking.addressChangeHistory, historyEntry];
    const updatedBooking =
      evaluation.outcome === "updated"
        ? await this.repository.updateBooking(booking.id, {
            serviceAddress: requestedAddress,
            servicePropertyId: payload.newPropertyId,
            addressChangeHistory: nextHistory
          })
        : await this.repository.updateBooking(booking.id, {
            addressChangeHistory: nextHistory
          });

    if (!updatedBooking) {
      throw new Error("Booking could not be updated");
    }

    const eventName =
      evaluation.outcome === "updated"
        ? MarketplaceTelemetryEventCatalog.bookingAddressChanged
        : evaluation.outcome === "requires-provider-review"
          ? MarketplaceTelemetryEventCatalog.bookingAddressChangePendingReview
          : MarketplaceTelemetryEventCatalog.bookingAddressChangeBlocked;

    this.analytics.record({
      id: crypto.randomUUID(),
      name: eventName,
      actorId: customerId,
      occurredAt: new Date().toISOString(),
      properties: {
        bookingId: booking.id,
        providerId: booking.providerId,
        outcome: evaluation.outcome,
        reason: evaluation.reason
      }
    });

    return {
      booking: updatedBooking,
      outcome: evaluation.outcome,
      reason: evaluation.reason
    };
  }

  public async listPaymentsForUser(actor: AuthIdentityRecord): Promise<PaymentRecord[]> {
    const [payments, bookings, matches] = await Promise.all([
      this.repository.listPayments(),
      this.repository.listBookings(),
      actor.role === "crew-member" ? this.repository.listCrewMatches() : Promise.resolve([])
    ]);

    return payments
      .filter((payment) => {
        const booking = bookings.find((candidate) => candidate.id === payment.bookingId);
        if (!booking) {
          return false;
        }

        if (actor.role === "customer") {
          return booking.customerId === actor.userId;
        }

        if (actor.role === "provider") {
          return booking.providerId === actor.userId;
        }

        return matches.some(
          (match) =>
            match.bookingId === booking.id &&
            match.crewMemberId === actor.userId &&
            match.status === "accepted"
        );
      })
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  public async getProviderPayoutLedger(providerId: string): Promise<ProviderPayoutLedgerResponse> {
    const provider = await this.repository.findProviderById(providerId);
    if (!provider) {
      throw new HttpError(404, "Provider not found");
    }

    const [bookings, payments, matches, customers] = await Promise.all([
      this.repository.listBookings(),
      this.repository.listPayments(),
      this.repository.listCrewMatches(),
      this.repository.listCustomers()
    ]);

    const entries = bookings
      .filter((booking) => booking.providerId === providerId && this.isPayoutRelevantBooking(booking))
      .map((booking) => {
        const payment = payments.find((candidate) => candidate.bookingId === booking.id);
        const acceptedMatches = matches.filter(
          (match) => match.bookingId === booking.id && match.status === "accepted"
        );
        const customer = customers.find((candidate) => candidate.id === booking.customerId);
        const crewShareCents = acceptedMatches.reduce(
          (sum, match) => sum + this.estimateCrewMatchPayoutCents(booking, match.hourlyRateCents),
          0
        );
        const payoutStatus = this.getPayoutLedgerStatus(booking, payment);
        const availableAtIso = this.getPayoutAvailabilityIso(booking, payoutStatus);
        const providerNetAmountCents = Math.max(booking.totalCents - crewShareCents, 0);

        const entry: ProviderPayoutLedgerEntry = {
          id: `provider-payout-${booking.id}`,
          bookingId: booking.id,
          customerName: customer?.fullName ?? "Customer",
          serviceDateIso: booking.scheduledStartIso,
          serviceLabel: this.titleCaseCategory(booking.category),
          addressLine: this.formatAddressLine(booking.serviceAddress),
          grossAmountCents: booking.totalCents,
          crewShareCents,
          providerNetAmountCents,
          crewMembersAssigned: acceptedMatches.length,
          paymentId: payment?.id,
          paymentStatus: payment?.status,
          status: payoutStatus,
          availableAtIso,
          note: this.buildProviderPayoutNote(payoutStatus, payment, acceptedMatches.length)
        };

        return entry;
      })
      .sort((left, right) => right.serviceDateIso.localeCompare(left.serviceDateIso));

    return {
      providerId,
      totalGrossCapturedCents: entries
        .filter((entry) => entry.paymentStatus === "captured")
        .reduce((sum, entry) => sum + entry.grossAmountCents, 0),
      totalNetReadyCents: entries
        .filter((entry) => entry.status === "ready")
        .reduce((sum, entry) => sum + entry.providerNetAmountCents, 0),
      totalNetScheduledCents: entries
        .filter((entry) => entry.status === "scheduled")
        .reduce((sum, entry) => sum + entry.providerNetAmountCents, 0),
      totalCrewOwedCents: entries
        .filter((entry) => entry.status !== "reversed")
        .reduce((sum, entry) => sum + entry.crewShareCents, 0),
      pendingCustomerPaymentCents: entries
        .filter((entry) => entry.status === "awaiting-customer-payment")
        .reduce((sum, entry) => sum + entry.grossAmountCents, 0),
      payoutSchedule: this.buildProviderPayoutScheduleSummary(provider, entries),
      entries
    };
  }

  public async getCrewPayoutLedger(crewMemberId: string): Promise<CrewPayoutLedgerResponse> {
    const crewMember = await this.repository.findCrewMemberById(crewMemberId);
    if (!crewMember) {
      throw new HttpError(404, "Crew member not found");
    }

    const [matches, bookings, payments, providers] = await Promise.all([
      this.repository.listCrewMatches(),
      this.repository.listBookings(),
      this.repository.listPayments(),
      this.repository.listProviders()
    ]);

    const entries = matches
      .filter((match) => match.crewMemberId === crewMemberId && match.status === "accepted")
      .map((match) => {
        const booking = bookings.find((candidate) => candidate.id === match.bookingId);
        if (!booking || !this.isPayoutRelevantBooking(booking)) {
          return undefined;
        }

        const payment = payments.find((candidate) => candidate.bookingId === booking.id);
        const provider = providers.find((candidate) => candidate.id === booking.providerId);
        const payoutStatus = this.getPayoutLedgerStatus(booking, payment);
        const availableAtIso = this.getPayoutAvailabilityIso(booking, payoutStatus);
        const amountCents = this.estimateCrewMatchPayoutCents(booking, match.hourlyRateCents);

        const entry: CrewPayoutLedgerEntry = {
          id: `crew-payout-${match.id}`,
          bookingId: booking.id,
          providerId: booking.providerId,
          providerCompanyName: provider?.companyName ?? "Provider",
          serviceDateIso: booking.scheduledStartIso,
          serviceLabel: this.titleCaseCategory(booking.category),
          addressLine: this.formatAddressLine(booking.serviceAddress),
          amountCents,
          paymentId: payment?.id,
          paymentStatus: payment?.status,
          status: payoutStatus,
          availableAtIso,
          note: this.buildCrewPayoutNote(payoutStatus, payment)
        };

        return entry;
      })
      .filter((entry): entry is CrewPayoutLedgerEntry => Boolean(entry))
      .sort((left, right) => right.serviceDateIso.localeCompare(left.serviceDateIso));

    return {
      crewMemberId,
      totalReadyCents: entries
        .filter((entry) => entry.status === "ready")
        .reduce((sum, entry) => sum + entry.amountCents, 0),
      totalScheduledCents: entries
        .filter((entry) => entry.status === "scheduled")
        .reduce((sum, entry) => sum + entry.amountCents, 0),
      totalPaidCents: entries
        .filter((entry) => entry.status === "paid")
        .reduce((sum, entry) => sum + entry.amountCents, 0),
      pendingCustomerPaymentCents: entries
        .filter((entry) => entry.status === "awaiting-customer-payment")
        .reduce((sum, entry) => sum + entry.amountCents, 0),
      nextWeeklyPayoutDateIso: this.getNextPayoutRunIso(this.crewPayoutWeekday),
      holdPeriodHours: this.payoutHoldHours,
      entries
    };
  }

  public async getOpsPayoutPreview(): Promise<OpsPayoutRunPreviewResponse> {
    const [providers, bookings, payments, matches] = await Promise.all([
      this.repository.listProviders(),
      this.repository.listBookings(),
      this.repository.listPayments(),
      this.repository.listCrewMatches()
    ]);

    const providerRuns = new Map<
      string,
      {
        runDateIso: string;
        providerIds: Set<string>;
        bookingIds: Set<string>;
        providerNetCents: number;
        crewShareCents: number;
      }
    >();

    let totalProviderReadyCents = 0;
    let totalCrewReadyCents = 0;
    let totalAwaitingCustomerPaymentCents = 0;
    let onHoldEntryCount = 0;
    let providerInstantEligibleCount = 0;

    for (const provider of providers) {
      const providerBookings = bookings.filter(
        (booking) => booking.providerId === provider.id && this.isPayoutRelevantBooking(booking)
      );
      const nextRunIso = this.getNextPayoutRunIso(provider.weeklyPayoutDay);
      let providerInstantEligibleCents = 0;

      for (const booking of providerBookings) {
        const payment = payments.find((candidate) => candidate.bookingId === booking.id);
        const acceptedMatches = matches.filter(
          (match) => match.bookingId === booking.id && match.status === "accepted"
        );
        const crewShareCents = acceptedMatches.reduce(
          (sum, match) => sum + this.estimateCrewMatchPayoutCents(booking, match.hourlyRateCents),
          0
        );
        const providerNetAmountCents = Math.max(booking.totalCents - crewShareCents, 0);
        const payoutStatus = this.getPayoutLedgerStatus(booking, payment);

        if (payoutStatus === "ready") {
          totalProviderReadyCents += providerNetAmountCents;
          totalCrewReadyCents += crewShareCents;
          providerInstantEligibleCents += providerNetAmountCents;

          const run = providerRuns.get(nextRunIso) ?? {
            runDateIso: nextRunIso,
            providerIds: new Set<string>(),
            bookingIds: new Set<string>(),
            providerNetCents: 0,
            crewShareCents: 0
          };
          run.providerIds.add(provider.id);
          run.bookingIds.add(booking.id);
          run.providerNetCents += providerNetAmountCents;
          run.crewShareCents += crewShareCents;
          providerRuns.set(nextRunIso, run);
        } else if (payoutStatus === "awaiting-customer-payment") {
          totalAwaitingCustomerPaymentCents += booking.totalCents;
        } else if (payoutStatus === "on-hold") {
          onHoldEntryCount += 1;
        }
      }

      if (
        provider.instantPayoutsEnabled &&
        providerInstantEligibleCents >= this.instantPayoutMinimumCents
      ) {
        providerInstantEligibleCount += 1;
      }
    }

    return {
      generatedAt: new Date().toISOString(),
      totalProviderReadyCents,
      totalCrewReadyCents,
      totalAwaitingCustomerPaymentCents,
      onHoldEntryCount,
      providerInstantEligibleCount,
      crewNextWeeklyPayoutDateIso: this.getNextPayoutRunIso(this.crewPayoutWeekday),
      providerRuns: Array.from(providerRuns.values())
        .map((run) => ({
          runDateIso: run.runDateIso,
          providerCount: run.providerIds.size,
          bookingCount: run.bookingIds.size,
          providerNetCents: run.providerNetCents,
          crewShareCents: run.crewShareCents,
          providerIds: Array.from(run.providerIds)
        }))
        .sort((left, right) => left.runDateIso.localeCompare(right.runDateIso))
    };
  }

  public async createCheckoutSession(
    customerId: string,
    payload: CreateCheckoutSessionRequest
  ): Promise<CreateCheckoutSessionResponse> {
    const booking = await this.repository.findBookingById(payload.bookingId);
    if (!booking) {
      throw new HttpError(404, "Booking not found");
    }

    if (booking.customerId !== customerId) {
      throw new HttpError(403, "Customers can only pay for their own bookings");
    }

    if (booking.status === "cancelled" || booking.status === "refunded") {
      throw new HttpError(400, "Cancelled or refunded bookings cannot be paid");
    }

    const customer = await this.repository.findCustomerById(customerId);
    if (!customer) {
      throw new HttpError(404, "Customer not found");
    }

    const existingPayments = (await this.repository.listPayments()).filter(
      (payment) => payment.bookingId === booking.id
    );
    const paidPayment = existingPayments.find((payment) => payment.status === "captured");
    if (paidPayment) {
      throw new HttpError(409, "This booking has already been paid.");
    }

    const session = await this.stripeCheckout.createCheckoutSession({
      booking,
      customer,
      appBaseUrl: this.appBaseUrl,
      successPath: payload.successPath ?? "/customer/dashboard?payment=stripe-success",
      cancelPath: payload.cancelPath ?? "/customer/dashboard?payment=stripe-cancelled"
    });

    const now = new Date().toISOString();
    const currentPayment = existingPayments[0];
    const paymentBase: PaymentRecord = {
      id: currentPayment?.id ?? crypto.randomUUID(),
      bookingId: booking.id,
      amountCents: booking.totalCents,
      currency: "usd",
      status: "pending",
      processor: "stripe",
      refundable: false,
      checkoutSessionId: session.checkoutSessionId,
      checkoutSessionUrl: session.checkoutUrl,
      processorPaymentIntentId: session.paymentIntentId,
      refundReason: currentPayment?.refundReason,
      refundReviewStatus: currentPayment?.refundReviewStatus,
      refundRequestedAt: currentPayment?.refundRequestedAt,
      refundRequestedByRole: currentPayment?.refundRequestedByRole,
      refundReviewedAt: currentPayment?.refundReviewedAt,
      refundReviewedByRole: currentPayment?.refundReviewedByRole,
      refundDecisionNotes: currentPayment?.refundDecisionNotes,
      failureReason: undefined,
      paidAt: undefined,
      createdAt: currentPayment?.createdAt ?? now,
      updatedAt: now
    };

    const payment = currentPayment
      ? await this.repository.updatePayment(currentPayment.id, {
          amountCents: paymentBase.amountCents,
          currency: paymentBase.currency,
          status: paymentBase.status,
          processor: paymentBase.processor,
          refundable: paymentBase.refundable,
          checkoutSessionId: paymentBase.checkoutSessionId,
          checkoutSessionUrl: paymentBase.checkoutSessionUrl,
          processorPaymentIntentId: paymentBase.processorPaymentIntentId,
          refundReason: paymentBase.refundReason,
          refundReviewStatus: paymentBase.refundReviewStatus,
          refundRequestedAt: paymentBase.refundRequestedAt,
          refundRequestedByRole: paymentBase.refundRequestedByRole,
          refundReviewedAt: paymentBase.refundReviewedAt,
          refundReviewedByRole: paymentBase.refundReviewedByRole,
          refundDecisionNotes: paymentBase.refundDecisionNotes,
          failureReason: paymentBase.failureReason,
          paidAt: paymentBase.paidAt,
          updatedAt: paymentBase.updatedAt
        })
      : await this.repository.createPayment(paymentBase);

    if (!payment) {
      throw new HttpError(500, "Payment record could not be created");
    }

    return {
      checkoutUrl: session.checkoutUrl,
      payment
    };
  }

  public async finalizeCheckoutSession(
    customerId: string,
    payload: FinalizeCheckoutSessionRequest
  ): Promise<PaymentRecord> {
    const payment = await this.repository.findPaymentByCheckoutSessionId(payload.checkoutSessionId);
    if (!payment) {
      throw new HttpError(404, "Payment session not found");
    }

    const booking = await this.repository.findBookingById(payment.bookingId);
    if (!booking) {
      throw new HttpError(404, "Booking not found");
    }

    if (booking.customerId !== customerId) {
      throw new HttpError(403, "Customers can only finalize payments for their own bookings");
    }

    const session = await this.stripeCheckout.verifyCheckoutSession(payload.checkoutSessionId);
    if (session.paid) {
      return this.capturePaymentRecord(payment, booking, session.paymentIntentId);
    }

    await this.failPaymentRecord(payment, session.failureReason ?? "Stripe payment has not completed yet.");
    throw new HttpError(409, session.failureReason ?? "Stripe payment has not completed yet.");
  }

  public async processStripeWebhook(rawBody: string, signatureHeader: string): Promise<{
    received: true;
    eventType: string;
    paymentId?: string;
  }> {
    const event = await this.stripeCheckout.parseWebhookEvent(rawBody, signatureHeader);

    if (!event.checkoutSessionId) {
      return {
        received: true,
        eventType: event.type
      };
    }

    const payment = await this.repository.findPaymentByCheckoutSessionId(event.checkoutSessionId);
    if (!payment) {
      throw new HttpError(404, "Payment session not found");
    }

    const booking = await this.repository.findBookingById(payment.bookingId);
    if (!booking) {
      throw new HttpError(404, "Booking not found");
    }

    if (event.type === "checkout.session.completed" && event.paid) {
      const updatedPayment = await this.capturePaymentRecord(payment, booking, event.paymentIntentId);
      return {
        received: true,
        eventType: event.type,
        paymentId: updatedPayment.id
      };
    }

    if (event.type === "checkout.session.expired") {
      const updatedPayment = await this.failPaymentRecord(
        payment,
        event.failureReason ?? "Stripe checkout expired."
      );
      return {
        received: true,
        eventType: event.type,
        paymentId: updatedPayment.id
      };
    }

    return {
      received: true,
      eventType: event.type,
      paymentId: payment.id
    };
  }

  public async createPaymentIntent(payload: CreatePaymentIntentRequest): Promise<PaymentRecord> {
    const now = new Date().toISOString();
    const payment: PaymentRecord = {
      id: crypto.randomUUID(),
      bookingId: payload.bookingId,
      amountCents: payload.amountCents,
      currency: payload.currency ?? "usd",
      processor: "manual",
      createdAt: now,
      updatedAt: now,
      status: "authorized",
      refundable: true,
      refundReviewStatus: undefined,
      refundRequestedAt: undefined,
      refundRequestedByRole: undefined,
      refundReviewedAt: undefined,
      refundReviewedByRole: undefined,
      refundDecisionNotes: undefined
    };

    this.analytics.recordFunnelStep(MarketplaceTelemetryEventCatalog.paymentAuthorized, payload.bookingId, {
      amountCents: payload.amountCents
    });
    return this.repository.createPayment(payment);
  }

  public async createRefund(
    requester: AuthIdentityRecord,
    payload: CreateRefundRequest
  ): Promise<PaymentRecord> {
    const payment = await this.repository.findPaymentById(payload.paymentId);
    if (!payment) {
      throw new HttpError(404, "Payment not found");
    }

    const booking = await this.repository.findBookingById(payment.bookingId);
    if (!booking) {
      throw new HttpError(404, "Booking not found");
    }

    if (requester.role === "customer" && booking.customerId !== requester.userId) {
      throw new HttpError(403, "Customers can only request refunds for their own bookings");
    }

    if (requester.role === "provider" && booking.providerId !== requester.userId) {
      throw new HttpError(403, "Providers can only manage refunds for their own jobs");
    }

    if (requester.role === "crew-member") {
      throw new HttpError(403, "Crew members cannot request refunds");
    }

    if (payment.status !== "captured") {
      throw new HttpError(400, "Only captured customer payments can enter refund review");
    }

    if (booking.status === "refunded") {
      throw new HttpError(409, "This booking has already been refunded");
    }

    const existingRefundTicket = (await this.repository.listSupportTickets()).find(
      (ticket) =>
        ticket.bookingId === booking.id &&
        ticket.issueType === "billing" &&
        ticket.status !== "resolved"
    );
    if (existingRefundTicket) {
      throw new HttpError(409, "A refund review is already open for this booking");
    }

    if (payment.refundReviewStatus === "requested") {
      throw new HttpError(409, "A refund review is already in progress for this payment");
    }

    const now = new Date().toISOString();
    const reason = payload.reason.trim();
    if (!reason) {
      throw new HttpError(400, "A refund reason is required");
    }

    const updatedPayment = await this.repository.updatePayment(payload.paymentId, {
      refundReason: reason,
      refundReviewStatus: "requested",
      refundRequestedAt: now,
      refundRequestedByRole: requester.role === "provider" ? "provider" : "customer",
      refundReviewedAt: undefined,
      refundReviewedByRole: undefined,
      refundDecisionNotes: undefined,
      refundable: false,
      updatedAt: now
    });

    if (!updatedPayment) {
      throw new Error("Payment not found");
    }

    await this.createSupportTicket(
      {
        userId: requester.userId,
        role: requester.role
      },
      {
        bookingId: booking.id,
        issueType: "billing",
        subject: "Refund review requested",
        description: `${requester.role === "provider" ? "Provider" : "Customer"} requested a refund review. Reason: ${reason}`
      }
    );

    const requesterLabel = requester.role === "provider" ? "The business owner" : "The customer";
    await Promise.all([
      this.createNotification({
        recipientId: booking.customerId,
        recipientRole: "customer",
        category: "support",
        title:
          requester.role === "customer"
            ? "Refund review requested"
            : "Provider requested a refund review",
        body:
          requester.role === "customer"
            ? "YardMatch support is reviewing your refund request."
            : "The provider asked YardMatch support to review this booking for a refund.",
        actionHref: `/customer/dashboard?bookingId=${booking.id}`
      }),
      this.createNotification({
        recipientId: booking.providerId,
        recipientRole: "provider",
        category: "support",
        title:
          requester.role === "provider"
            ? "Refund review requested"
            : "Customer requested a refund review",
        body: `${requesterLabel} asked YardMatch support to review this booking for a refund.`,
        actionHref: `/provider/management?bookingId=${booking.id}`
      })
    ]);

    this.analytics.recordFunnelStep(MarketplaceTelemetryEventCatalog.refundRequested, updatedPayment.bookingId, {
      paymentId: updatedPayment.id,
      reason
    });
    return updatedPayment;
  }

  public async createOpsRefundOverride(
    payload: CreateOpsRefundOverrideRequest
  ): Promise<PaymentRecord> {
    const ticket = (await this.repository.listSupportTickets()).find(
      (candidate) => candidate.id === payload.ticketId
    );
    if (!ticket) {
      throw new HttpError(404, "Support ticket not found");
    }

    if (ticket.issueType !== "billing") {
      throw new HttpError(400, "Refund overrides can only start from billing tickets");
    }

    if (ticket.status === "resolved") {
      throw new HttpError(409, "Resolved tickets cannot open a new refund review");
    }

    const payment = await this.repository.findPaymentById(payload.paymentId);
    if (!payment) {
      throw new HttpError(404, "Payment not found");
    }

    const booking = await this.repository.findBookingById(payment.bookingId);
    if (!booking) {
      throw new HttpError(404, "Booking not found");
    }

    if (ticket.bookingId && ticket.bookingId !== booking.id) {
      throw new HttpError(400, "This billing ticket is not tied to the selected payment");
    }

    if (payment.status !== "captured") {
      throw new HttpError(400, "Only captured customer payments can enter refund review");
    }

    if (booking.status === "refunded") {
      throw new HttpError(409, "This booking has already been refunded");
    }

    if (payment.refundReviewStatus === "requested") {
      throw new HttpError(409, "A refund review is already in progress for this payment");
    }

    const reason = payload.reason.trim();
    if (!reason) {
      throw new HttpError(400, "A refund reason is required");
    }

    const now = new Date().toISOString();
    const updatedPayment = await this.repository.updatePayment(payment.id, {
      refundReason: reason,
      refundReviewStatus: "requested",
      refundRequestedAt: now,
      refundRequestedByRole: "ops",
      refundReviewedAt: undefined,
      refundReviewedByRole: undefined,
      refundDecisionNotes: undefined,
      refundable: false,
      updatedAt: now
    });

    if (!updatedPayment) {
      throw new HttpError(500, "Payment could not be updated for refund review");
    }

    await this.repository.updateSupportTicket(ticket.id, {
      updatedAt: now,
      description: `${ticket.description}\n\nCustomer service opened a refund review override. Reason: ${reason}`
    });

    await Promise.all([
      this.createNotification({
        recipientId: booking.customerId,
        recipientRole: "customer",
        category: "support",
        title: "Customer service opened a refund review",
        body: "YardMatch support opened a refund review on this booking and is reviewing next steps.",
        actionHref: `/customer/dashboard?bookingId=${booking.id}`
      }),
      this.createNotification({
        recipientId: booking.providerId,
        recipientRole: "provider",
        category: "support",
        title: "Customer service opened a refund review",
        body: "YardMatch support opened a refund review tied to this booking.",
        actionHref: `/provider/management?bookingId=${booking.id}`
      })
    ]);

    this.analytics.recordFunnelStep(MarketplaceTelemetryEventCatalog.refundRequested, updatedPayment.bookingId, {
      paymentId: updatedPayment.id,
      reason,
      openedBy: "ops"
    });

    return updatedPayment;
  }

  public async createOpsBookingIntervention(
    payload: CreateOpsBookingInterventionRequest
  ): Promise<Booking> {
    const booking = await this.repository.findBookingById(payload.bookingId);
    if (!booking) {
      throw new HttpError(404, "Booking not found");
    }

    const note = payload.note.trim();
    if (!note) {
      throw new HttpError(400, "An intervention note is required");
    }

    const ticket = payload.ticketId
      ? (await this.repository.listSupportTickets()).find((candidate) => candidate.id === payload.ticketId)
      : undefined;
    if (payload.ticketId && !ticket) {
      throw new HttpError(404, "Support ticket not found");
    }
    if (ticket?.bookingId && ticket.bookingId !== booking.id) {
      throw new HttpError(400, "This support ticket is not tied to the selected booking");
    }

    const now = new Date().toISOString();
    let scheduledStartIso = payload.scheduledStartIso;
    let scheduledEndIso = payload.scheduledEndIso;

    if (payload.action === "reschedule-booking") {
      if (!scheduledStartIso || !scheduledEndIso) {
        throw new HttpError(400, "A new start and end time are required to reschedule the booking");
      }

      const startMs = Date.parse(scheduledStartIso);
      const endMs = Date.parse(scheduledEndIso);
      if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
        throw new HttpError(400, "A valid booking window is required");
      }

      if (startMs <= Date.now()) {
        throw new HttpError(400, "Rescheduled bookings must stay in the future");
      }
    } else {
      scheduledStartIso = undefined;
      scheduledEndIso = undefined;
    }

    if (
      booking.status === "cancelled" &&
      payload.action !== "restore-active-booking" &&
      payload.action !== "add-note"
    ) {
      throw new HttpError(409, "Cancelled bookings cannot take that intervention");
    }

    if (
      booking.status === "refunded" &&
      payload.action !== "add-note"
    ) {
      throw new HttpError(409, "Refunded bookings cannot take that intervention");
    }

    const intervention: BookingInterventionRecord = {
      id: crypto.randomUUID(),
      action: payload.action,
      createdAt: now,
      actorRole: "ops",
      actorUserId: "ops-system",
      note,
      ticketId: payload.ticketId,
      previousStatus: booking.status,
      nextStatus: this.getInterventionNextStatus(booking, payload.action),
      previousScheduledStartIso: booking.scheduledStartIso,
      previousScheduledEndIso: booking.scheduledEndIso,
      nextScheduledStartIso: scheduledStartIso,
      nextScheduledEndIso: scheduledEndIso
    };

    const updatedBooking = await this.applyOpsBookingIntervention(booking, payload, intervention, now);

    if (ticket) {
      await this.repository.updateSupportTicket(ticket.id, {
        updatedAt: now,
        triagedAt: ticket.triagedAt ?? (ticket.status === "open" ? now : undefined),
        status: ticket.status === "open" ? "triaged" : ticket.status,
        description: `${ticket.description}\n\nOps intervention: ${payload.action}. Note: ${note}`
      });
    }

    this.analytics.record({
      id: crypto.randomUUID(),
      name: MarketplaceTelemetryEventCatalog.supportTicketOpened,
      actorId: booking.id,
      occurredAt: now,
      properties: {
        bookingId: booking.id,
        interventionAction: payload.action,
        ticketId: payload.ticketId ?? "none"
      }
    });

    return updatedBooking;
  }

  public async reviewBookingEvidenceForOps(
    payload: ReviewBookingEvidenceForOpsRequest
  ): Promise<Booking> {
    const booking = await this.repository.findBookingById(payload.bookingId);
    if (!booking) {
      throw new HttpError(404, "Booking not found");
    }

    const evidenceIndex = booking.serviceEvidence.findIndex((photo) => photo.id === payload.evidenceId);
    if (evidenceIndex === -1) {
      throw new HttpError(404, "Booking evidence not found");
    }

    const ticket = payload.ticketId
      ? (await this.repository.listSupportTickets()).find((candidate) => candidate.id === payload.ticketId)
      : undefined;
    if (payload.ticketId && !ticket) {
      throw new HttpError(404, "Support ticket not found");
    }
    if (ticket?.bookingId && ticket.bookingId !== booking.id) {
      throw new HttpError(400, "This support ticket is not tied to the selected booking");
    }

    const reviewNotes = payload.reviewNotes?.trim();
    const reviewedAt = new Date().toISOString();
    const nextEvidence = booking.serviceEvidence.map((photo, index) =>
      index === evidenceIndex
        ? {
            ...photo,
            reviewStatus: payload.reviewStatus,
            reviewNotes: reviewNotes || undefined,
            reviewedAt,
            reviewedByRole: "ops" as const,
            reviewedByUserId: "ops-system"
          }
        : photo
    );

    const updatedBooking = await this.repository.updateBooking(booking.id, {
      serviceEvidence: nextEvidence
    });

    if (!updatedBooking) {
      throw new HttpError(500, "Booking evidence review could not be saved");
    }

    if (ticket) {
      const evidence = booking.serviceEvidence[evidenceIndex];
      await this.repository.updateSupportTicket(ticket.id, {
        updatedAt: reviewedAt,
        triagedAt: ticket.triagedAt ?? (ticket.status === "open" ? reviewedAt : undefined),
        status: ticket.status === "open" ? "triaged" : ticket.status,
        description:
          `${ticket.description}\n\nOps evidence review: ${evidence?.phase ?? "photo"} ` +
          `${payload.reviewStatus}${reviewNotes ? `. Notes: ${reviewNotes}` : "."}`
      });
    }

    return updatedBooking;
  }

  public async createSupportTicket(
    requester: { userId: string; role: "customer" | "provider" | "crew-member" },
    payload: CreateSupportTicketRequest
  ): Promise<SupportTicket> {
    if (payload.bookingId) {
      const booking = await this.repository.findBookingById(payload.bookingId);
      if (!booking) {
        throw new Error("Booking not found");
      }

      if (requester.role === "customer" && booking.customerId !== requester.userId) {
        throw new Error("Customers can only open support tickets for their own bookings");
      }

      if (requester.role === "provider" && booking.providerId !== requester.userId) {
        throw new Error("Providers can only open support tickets for their own jobs");
      }

      if (requester.role === "crew-member") {
        const matches = await this.repository.listCrewMatches();
        const hasAcceptedMatch = matches.some(
          (match) =>
            match.bookingId === booking.id &&
            match.crewMemberId === requester.userId &&
            match.status === "accepted"
        );
        if (!hasAcceptedMatch) {
          throw new Error("Crew members can only open support tickets for accepted assignments");
        }
      }
    }

    const ticket: SupportTicket = {
      id: crypto.randomUUID(),
      bookingId: payload.bookingId,
      requesterId: requester.userId,
      subject: payload.subject,
      description: payload.description,
      issueType: payload.issueType,
      status: "open",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.analytics.recordFunnelStep(MarketplaceTelemetryEventCatalog.supportTicketOpened, requester.userId, {
      issueType: payload.issueType,
      bookingId: payload.bookingId ?? "none"
    });
    return this.repository.createSupportTicket(ticket);
  }

  public async listSupportTicketsForRequester(
    requester: { userId: string; role: "customer" | "provider" | "crew-member" }
  ): Promise<SupportTicket[]> {
    return (await this.repository.listSupportTickets())
      .filter((ticket) => ticket.requesterId === requester.userId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  public async listOpsSupportTickets(): Promise<SupportOpsTicket[]> {
    const [tickets, bookings, payments, customers, providers] = await Promise.all([
      this.repository.listSupportTickets(),
      this.repository.listBookings(),
      this.repository.listPayments(),
      this.repository.listCustomers(),
      this.repository.listProviders()
    ]);

    return tickets
      .map((ticket) => {
        const booking = ticket.bookingId
          ? bookings.find((candidate) => candidate.id === ticket.bookingId)
          : undefined;
        const payment = booking
          ? payments.find((candidate) => candidate.bookingId === booking.id)
          : undefined;
        const customer = booking
          ? customers.find((candidate) => candidate.id === booking.customerId)
          : undefined;
        const provider = booking
          ? providers.find((candidate) => candidate.id === booking.providerId)
          : undefined;
        const evidenceSummary = booking ? this.buildSupportEvidenceSummary(booking) : undefined;
        const resolutionGuidance =
          booking && evidenceSummary
            ? this.buildSupportResolutionGuidance(ticket, booking, payment, evidenceSummary)
            : undefined;

        return {
          ticket,
          booking,
          payment,
          customerName: customer?.fullName,
          providerName: provider?.companyName,
          evidenceSummary,
          resolutionGuidance
        } satisfies SupportOpsTicket;
      })
      .sort((left, right) => right.ticket.createdAt.localeCompare(left.ticket.createdAt));
  }

  public async getOpsFinancialExceptionSummary(): Promise<OpsFinancialExceptionSummaryResponse> {
    const [tickets, bookings, payments, customers, providers] = await Promise.all([
      this.repository.listSupportTickets(),
      this.repository.listBookings(),
      this.repository.listPayments(),
      this.repository.listCustomers(),
      this.repository.listProviders()
    ]);

    const customerById = new Map(customers.map((customer) => [customer.id, customer]));
    const providerById = new Map(providers.map((provider) => [provider.id, provider]));
    const bookingById = new Map(bookings.map((booking) => [booking.id, booking]));
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    const refundReviews = payments
      .filter((payment) => payment.refundReviewStatus === "requested")
      .map((payment) => {
        const booking = bookingById.get(payment.bookingId);
        const customer = booking ? customerById.get(booking.customerId) : undefined;
        const provider = booking ? providerById.get(booking.providerId) : undefined;
        return {
          bookingId: payment.bookingId,
          paymentId: payment.id,
          customerName: customer?.fullName,
          providerName: provider?.companyName,
          amountCents: payment.amountCents,
          bookingStatus: booking?.status ?? "completed",
          paymentStatus: payment.status,
          refundReviewStatus: payment.refundReviewStatus,
          refundReason: payment.refundReason,
          refundRequestedAt: payment.refundRequestedAt,
          refundRequestedByRole: payment.refundRequestedByRole
        } satisfies OpsRefundSummaryItem;
      })
      .sort((left, right) =>
        (right.refundRequestedAt ?? "").localeCompare(left.refundRequestedAt ?? "")
      );

    const activeExceptions = bookings
      .filter(
        (booking) =>
          Boolean(booking.activeExceptionType) &&
          booking.status !== "completed" &&
          booking.status !== "cancelled" &&
          booking.status !== "refunded"
      )
      .map((booking) => {
        const customer = customerById.get(booking.customerId);
        const provider = providerById.get(booking.providerId);
        return {
          bookingId: booking.id,
          customerName: customer?.fullName,
          providerName: provider?.companyName,
          category: booking.category,
          bookingStatus: booking.status,
          exceptionType: booking.activeExceptionType as OpsBookingExceptionSummaryItem["exceptionType"],
          reportedAt: booking.activeExceptionReportedAt,
          notes: booking.activeExceptionNotes
        } satisfies OpsBookingExceptionSummaryItem;
      })
      .sort((left, right) => (right.reportedAt ?? "").localeCompare(left.reportedAt ?? ""));

    return {
      generatedAt: new Date().toISOString(),
      refundReviewOpenCount: refundReviews.length,
      refundedAmountLast30DaysCents: payments
        .filter(
          (payment) =>
            payment.status === "refunded" &&
            payment.refundReviewedAt &&
            new Date(payment.refundReviewedAt).getTime() >= thirtyDaysAgo
        )
        .reduce((sum, payment) => sum + payment.amountCents, 0),
      payoutHoldCount: payments.filter((payment) => payment.refundReviewStatus === "requested").length,
      activeBookingExceptionCount: activeExceptions.length,
      disputedBookingCount: bookings.filter((booking) => booking.status === "disputed").length,
      openBillingTicketCount: tickets.filter(
        (ticket) => ticket.issueType === "billing" && ticket.status !== "resolved"
      ).length,
      refundReviews,
      activeExceptions
    };
  }

  public async updateSupportTicketForOps(
    payload: UpdateSupportTicketRequest
  ): Promise<SupportTicket> {
    const ticket = (await this.repository.listSupportTickets()).find(
      (candidate) => candidate.id === payload.ticketId
    );
    if (!ticket) {
      throw new HttpError(404, "Support ticket not found");
    }

    const now = new Date().toISOString();
    const resolutionNotes = payload.resolutionNotes?.trim() || undefined;
    if (payload.status === "resolved" && !resolutionNotes) {
      throw new HttpError(400, "Resolution notes are required when resolving a support ticket");
    }

    if (ticket.bookingId) {
      const booking = await this.repository.findBookingById(ticket.bookingId);
      if (booking) {
        if (payload.status === "resolved") {
          if (payload.resolutionAction === "approve-refund" || payload.resolutionAction === "deny-refund") {
            await this.applySupportResolutionToRefund(booking, payload.resolutionAction, resolutionNotes as string);
          } else {
            await this.applySupportResolutionToBooking(booking, payload.resolutionAction);
          }
        } else if (payload.status === "triaged" && booking.status === "disputed") {
          await this.createNotification({
            recipientId: booking.customerId,
            recipientRole: "customer",
            category: "support",
            title: "Dispute under review",
            body: "YardMatch support has triaged your dispute and is reviewing next steps.",
            actionHref: `/customer/dashboard?bookingId=${booking.id}&issue=dispute`
          });
        }
        if (payload.status === "triaged" && ticket.issueType === "billing") {
          await Promise.all([
            this.createNotification({
              recipientId: booking.customerId,
              recipientRole: "customer",
              category: "support",
              title: "Refund review under review",
              body: "YardMatch support triaged your refund request and is reviewing next steps.",
              actionHref: `/customer/dashboard?bookingId=${booking.id}`
            }),
            this.createNotification({
              recipientId: booking.providerId,
              recipientRole: "provider",
              category: "support",
              title: "Refund review under review",
              body: "YardMatch support triaged the refund request tied to this booking.",
              actionHref: `/provider/management?bookingId=${booking.id}`
            })
          ]);
        }
      }
    }

    const updatedTicket = await this.repository.updateSupportTicket(ticket.id, {
      status: payload.status,
      updatedAt: now,
      triagedAt: payload.status === "triaged" ? ticket.triagedAt ?? now : ticket.triagedAt,
      resolvedAt: payload.status === "resolved" ? now : ticket.resolvedAt,
      resolutionNotes,
      resolutionAction: payload.status === "resolved" ? payload.resolutionAction : undefined
    });

    if (!updatedTicket) {
      throw new HttpError(500, "Support ticket could not be updated");
    }

    return updatedTicket;
  }

  private getInterventionNextStatus(
    booking: Booking,
    action: CreateOpsBookingInterventionRequest["action"]
  ): Booking["status"] | undefined {
    if (action === "cancel-booking") {
      return "cancelled";
    }

    if (action === "complete-booking") {
      return "completed";
    }

    if (action === "restore-active-booking") {
      return booking.onRouteConfirmedAt || booking.completedAt ? "in-progress" : "confirmed";
    }

    if (action === "reschedule-booking") {
      return "confirmed";
    }

    return undefined;
  }

  private async applyOpsBookingIntervention(
    booking: Booking,
    payload: CreateOpsBookingInterventionRequest,
    intervention: BookingInterventionRecord,
    now: string
  ): Promise<Booking> {
    const baseUpdates: Partial<Booking> = {
      interventions: [...booking.interventions, intervention]
    };

    if (payload.action === "add-note") {
      const notedBooking = await this.repository.updateBooking(booking.id, baseUpdates);
      if (!notedBooking) {
        throw new HttpError(500, "Booking intervention note could not be saved");
      }
      return notedBooking;
    }

    if (payload.action === "reschedule-booking") {
      const rescheduledBooking = await this.repository.updateBooking(booking.id, {
        ...baseUpdates,
        scheduledStartIso: payload.scheduledStartIso,
        scheduledEndIso: payload.scheduledEndIso,
        status: "confirmed",
        onRouteConfirmedAt: undefined,
        onRouteConfirmedByCrewMemberId: undefined,
        lateNoticeSentAt: undefined,
        lateEtaIso: undefined,
        lateReason: undefined,
        activeExceptionType: undefined,
        activeExceptionReportedAt: undefined,
        activeExceptionNotes: undefined,
        disputedAt: undefined,
        disputeReason: undefined,
        disputedByRole: undefined,
        completedAt: undefined
      });
      if (!rescheduledBooking) {
        throw new HttpError(500, "Booking could not be rescheduled");
      }

      await this.notifyOpsBookingIntervention(
        booking,
        "Support rescheduled your booking",
        `YardMatch support moved this booking to ${this.formatBookingWindowWithDate(payload.scheduledStartIso ?? booking.scheduledStartIso)}.`
      );
      return rescheduledBooking;
    }

    if (payload.action === "cancel-booking") {
      const cancelledBooking = await this.repository.updateBooking(booking.id, {
        ...baseUpdates,
        status: "cancelled",
        activeExceptionType: undefined,
        activeExceptionReportedAt: undefined,
        activeExceptionNotes: undefined,
        disputedAt: undefined,
        disputeReason: undefined,
        disputedByRole: undefined
      });
      if (!cancelledBooking) {
        throw new HttpError(500, "Booking could not be cancelled");
      }

      await this.notifyOpsBookingIntervention(
        booking,
        "Support cancelled your booking",
        "YardMatch support cancelled this booking after review."
      );
      return cancelledBooking;
    }

    if (payload.action === "complete-booking") {
      const completedBooking = await this.repository.updateBooking(booking.id, {
        ...baseUpdates,
        status: "completed",
        completedAt: booking.completedAt ?? now,
        activeExceptionType: undefined,
        activeExceptionReportedAt: undefined,
        activeExceptionNotes: undefined,
        disputedAt: undefined,
        disputeReason: undefined,
        disputedByRole: undefined
      });
      if (!completedBooking) {
        throw new HttpError(500, "Booking could not be completed");
      }

      const existingInvite = await this.repository.findReviewInviteByBookingId(booking.id);
      if (!existingInvite) {
        const customer = await this.repository.findCustomerById(booking.customerId);
        if (customer) {
          await this.repository.createReviewInvite(
            this.buildReviewInvite(completedBooking, customer.email, completedBooking.completedAt ?? now)
          );
        }
      }

      await this.notifyOpsBookingIntervention(
        booking,
        "Support marked your booking complete",
        "YardMatch support reviewed the service record and marked this booking complete."
      );
      return completedBooking;
    }

    const restoredStatus: Booking["status"] =
      booking.onRouteConfirmedAt || booking.completedAt ? "in-progress" : "confirmed";
    const restoredBooking = await this.repository.updateBooking(booking.id, {
      ...baseUpdates,
      status: restoredStatus,
      activeExceptionType: undefined,
      activeExceptionReportedAt: undefined,
      activeExceptionNotes: undefined,
      disputedAt: undefined,
      disputeReason: undefined,
      disputedByRole: undefined
    });
    if (!restoredBooking) {
      throw new HttpError(500, "Booking could not be restored");
    }

    await this.notifyOpsBookingIntervention(
      booking,
      "Support restored your booking",
      "YardMatch support reviewed the issue and restored this booking to the active schedule."
    );
    return restoredBooking;
  }

  private async notifyOpsBookingIntervention(
    booking: Booking,
    customerTitle: string,
    body: string
  ): Promise<void> {
    await Promise.all([
      this.createNotification({
        recipientId: booking.customerId,
        recipientRole: "customer",
        category: "support",
        title: customerTitle,
        body,
        actionHref: `/customer/dashboard?bookingId=${booking.id}`
      }),
      this.createNotification({
        recipientId: booking.providerId,
        recipientRole: "provider",
        category: "support",
        title: customerTitle,
        body,
        actionHref: `/provider/management?bookingId=${booking.id}`
      })
    ]);
  }

  public createAnalyticsEvent(payload: AnalyticsEvent): AnalyticsEvent {
    return this.analytics.record(payload);
  }

  private async applySupportResolutionToBooking(
    booking: Booking,
    resolutionAction: UpdateSupportTicketRequest["resolutionAction"]
  ): Promise<void> {
    const action = resolutionAction ?? "restore-active-booking";

    const baseUpdates: Partial<Booking> = {
      activeExceptionType: undefined,
      activeExceptionReportedAt: undefined,
      activeExceptionNotes: undefined,
      disputeReason: undefined,
      disputedAt: undefined,
      disputedByRole: undefined
    };

    if (action === "cancel-booking") {
      await this.repository.updateBooking(booking.id, {
        ...baseUpdates,
        status: "cancelled"
      });
      await this.createNotification({
        recipientId: booking.customerId,
        recipientRole: "customer",
        category: "support",
        title: "Support resolved your booking issue",
        body: "YardMatch support closed the ticket and cancelled the booking.",
        actionHref: `/customer/dashboard?bookingId=${booking.id}`
      });
      return;
    }

    if (action === "complete-booking") {
      await this.repository.updateBooking(booking.id, {
        ...baseUpdates,
        status: "completed",
        completedAt: booking.completedAt ?? new Date().toISOString()
      });
      await this.createNotification({
        recipientId: booking.customerId,
        recipientRole: "customer",
        category: "support",
        title: "Support resolved your booking issue",
        body: "YardMatch support closed the ticket and marked the service complete.",
        actionHref: `/customer/dashboard?bookingId=${booking.id}`
      });
      return;
    }

    const restoredStatus: Booking["status"] =
      booking.onRouteConfirmedAt || booking.completedAt ? "in-progress" : "confirmed";

    await this.repository.updateBooking(booking.id, {
      ...baseUpdates,
      status: restoredStatus
    });
    await this.createNotification({
      recipientId: booking.customerId,
      recipientRole: "customer",
      category: "support",
      title: "Support resolved your booking issue",
      body: "YardMatch support reviewed the issue and restored the booking to the active schedule.",
      actionHref: `/customer/dashboard?bookingId=${booking.id}`
    });
  }

  private async applySupportResolutionToRefund(
    booking: Booking,
    resolutionAction: "approve-refund" | "deny-refund",
    resolutionNotes: string
  ): Promise<void> {
    const payment = (await this.repository.listPayments())
      .filter((candidate) => candidate.bookingId === booking.id)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];

    if (!payment) {
      throw new HttpError(404, "Payment record not found for this booking");
    }

    if (payment.refundReviewStatus !== "requested") {
      throw new HttpError(409, "There is no active refund review to resolve for this payment");
    }

    const now = new Date().toISOString();

    if (resolutionAction === "approve-refund") {
      const updatedPayment = await this.repository.updatePayment(payment.id, {
        status: "refunded",
        refundable: false,
        refundReviewStatus: "approved",
        refundReviewedAt: now,
        refundReviewedByRole: "ops",
        refundDecisionNotes: resolutionNotes,
        updatedAt: now
      });
      if (!updatedPayment) {
        throw new HttpError(500, "Payment record could not be updated");
      }

      await this.repository.updateBooking(booking.id, {
        status: "refunded"
      });

      this.analytics.recordFunnelStep(MarketplaceTelemetryEventCatalog.refundCompleted, booking.id, {
        paymentId: updatedPayment.id
      });

      await Promise.all([
        this.createNotification({
          recipientId: booking.customerId,
          recipientRole: "customer",
          category: "support",
          title: "Refund approved",
          body: "YardMatch support approved this refund request and reversed the customer payment.",
          actionHref: `/customer/dashboard?bookingId=${booking.id}`
        }),
        this.createNotification({
          recipientId: booking.providerId,
          recipientRole: "provider",
          category: "support",
          title: "Refund approved",
          body: "YardMatch support approved the refund review tied to this booking.",
          actionHref: `/provider/management?bookingId=${booking.id}`
        })
      ]);
      return;
    }

    const updatedPayment = await this.repository.updatePayment(payment.id, {
      status: "captured",
      refundable: true,
      refundReviewStatus: "denied",
      refundReviewedAt: now,
      refundReviewedByRole: "ops",
      refundDecisionNotes: resolutionNotes,
      updatedAt: now
    });
    if (!updatedPayment) {
      throw new HttpError(500, "Payment record could not be updated");
    }

    await Promise.all([
      this.createNotification({
        recipientId: booking.customerId,
        recipientRole: "customer",
        category: "support",
        title: "Refund request denied",
        body: "YardMatch support reviewed this refund request and left the payment in place.",
        actionHref: `/customer/dashboard?bookingId=${booking.id}`
      }),
      this.createNotification({
        recipientId: booking.providerId,
        recipientRole: "provider",
        category: "support",
        title: "Refund request denied",
        body: "YardMatch support closed the refund review and kept the payment captured.",
        actionHref: `/provider/management?bookingId=${booking.id}`
      })
    ]);
  }

  public async processReviewInvites(
    payload: ProcessReviewInvitesRequest = {}
  ): Promise<ProcessReviewInvitesResponse> {
    const now = payload.nowIso ? new Date(payload.nowIso) : new Date();
    const sentAt = now.toISOString();
    const dispatches = (await this.repository
      .listScheduledReviewInvites())
      .filter((invite) => {
        if (new Date(invite.expiresAtIso).getTime() <= now.getTime()) {
          void this.repository.updateReviewInvite(invite.id, {
            status: "expired"
          });
          return false;
        }

        return new Date(invite.scheduledSendIso).getTime() <= now.getTime();
      })
      .map(async (invite) => {
        const updatedInvite = await this.repository.updateReviewInvite(invite.id, {
          status: "sent",
          sentAt
        });

        if (!updatedInvite) {
          throw new Error("Review invite could not be updated");
        }

        this.analytics.record({
          id: crypto.randomUUID(),
          name: MarketplaceTelemetryEventCatalog.reviewInviteSent,
          actorId: updatedInvite.customerId,
          occurredAt: sentAt,
          properties: {
            bookingId: updatedInvite.bookingId,
            providerId: updatedInvite.providerId,
            channelCount: updatedInvite.channels.length
          }
        });

        await this.createNotification({
          recipientId: updatedInvite.customerId,
          recipientRole: "customer",
          category: "review",
          title: "Leave your service review",
          body: "Your review window is now open for a completed YardMatch service.",
          actionHref: "/customer/dashboard"
        });

        return {
          inviteId: updatedInvite.id,
          bookingId: updatedInvite.bookingId,
          customerId: updatedInvite.customerId,
          email: updatedInvite.email,
          scheduledSendIso: updatedInvite.scheduledSendIso,
          sentAt,
          deepLinkPath: updatedInvite.deepLinkPath,
          subject: "How did your YardMatch service go?",
          templateKey: "review-invite-v1"
        } satisfies ReviewInviteDispatch;
      });

    return {
      dispatches: await Promise.all(dispatches)
    };
  }

  public recordSessionHeartbeat(payload: SessionHeartbeatRequest): ActiveSession {
    return this.analytics.recordSessionHeartbeat(payload);
  }

  public async getObservabilityOverview(): Promise<ObservabilityOverview> {
    return this.analytics.getOverview({
      bookings: await this.repository.listBookings(),
      supportTickets: await this.repository.listSupportTickets()
    });
  }

  public async buildCalendarFeed(providerId: string): Promise<string> {
    const provider = await this.repository.findProviderById(providerId);
    if (!provider) {
      throw new HttpError(404, "Provider not found");
    }

    const bookings = await this.listProviderCalendarBookings(providerId);
    return this.schedulingService.buildProviderCombinedCalendarFeed({
      providerName: provider.companyName,
      bookings,
      externalBlocks: this.getActiveExternalCalendarBlocks(provider)
    });
  }

  public async buildCalendarFeedByToken(feedToken: string): Promise<string> {
    const provider = (await this.repository.listProviders()).find(
      (item) => item.calendarConnection.feedToken === feedToken
    );

    if (!provider) {
      throw new HttpError(404, "Calendar feed not found");
    }

    return this.buildCalendarFeed(provider.id);
  }

  public async getProviderCalendarSubscription(
    providerId: string
  ): Promise<ProviderCalendarSubscriptionResponse> {
    const provider = await this.ensureProviderCalendarFeedToken(providerId);
    const token = provider.calendarConnection.feedToken;
    if (!token) {
      throw new HttpError(500, "Calendar feed token could not be created");
    }

    const feedUrl = `${this.apiBaseUrl}${"/api/calendar/feed"}?token=${encodeURIComponent(token)}`;
    return {
      providerId: provider.id,
      providerName: provider.companyName,
      feedUrl,
      webcalUrl: feedUrl.replace(/^http/, "webcal"),
      actions: this.buildProviderCalendarSubscriptionActions(feedUrl),
      instructions: [
        "Apple Calendar can subscribe directly with the Apple Calendar action or the raw webcal link.",
        "Google Calendar can use the Google Calendar action or paste the feed URL into Add calendar by URL.",
        "The feed includes YardMatch jobs plus your manual outside-client and personal blocks."
      ]
    };
  }

  public async getProviderCalendarImports(providerId: string): Promise<ProviderCalendarImportsResponse> {
    const provider = await this.repository.findProviderById(providerId);
    if (!provider) {
      throw new HttpError(404, "Provider not found");
    }
    const bookings = await this.listFutureProviderCalendarConflictBookings(provider.id);

    return {
      providerId: provider.id,
      subscriptions: [...(provider.calendarConnection.externalSubscriptions ?? [])].sort((left, right) =>
        left.title.localeCompare(right.title)
      ),
      importedBlockCount: (provider.calendarConnection.externalBlocks ?? []).filter(
        (block) => block.source === "calendar-import"
      ).length,
      syncHealth: this.buildProviderCalendarSyncHealth(provider, bookings)
    };
  }

  public async createProviderCalendarImport(
    providerId: string,
    payload: CreateExternalCalendarImportRequest
  ): Promise<ProviderCalendarImportsResponse> {
    const provider = await this.repository.findProviderById(providerId);
    if (!provider) {
      throw new HttpError(404, "Provider not found");
    }

    const title = payload.title.trim();
    const feedUrl = payload.feedUrl.trim();
    if (!title) {
      throw new HttpError(400, "Calendar import title is required");
    }

    if (!/^https?:\/\/|^webcal:\/\//i.test(feedUrl) && !/^data:text\/calendar/i.test(feedUrl)) {
      throw new HttpError(400, "Calendar import feedUrl must be an http, https, webcal, or data URL");
    }

    const subscription: ExternalCalendarSubscription = {
      id: crypto.randomUUID(),
      title,
      provider: payload.provider,
      feedUrl,
      importedEventCount: 0,
      syncStatus: "active"
    };

    const nextSubscriptions = [...(provider.calendarConnection.externalSubscriptions ?? []), subscription];
    const savedProvider = await this.repository.updateProvider(provider.id, {
      calendarConnection: {
        ...provider.calendarConnection,
        externalSubscriptions: nextSubscriptions
      }
    });
    if (!savedProvider) {
      throw new HttpError(500, "Calendar import could not be created");
    }

    const imported = await this.syncExternalCalendarSubscription(savedProvider, subscription, nextSubscriptions);
    const bookings = await this.listFutureProviderCalendarConflictBookings(imported.id);
    return {
      providerId,
      subscriptions: imported.calendarConnection.externalSubscriptions ?? [],
      importedBlockCount: (imported.calendarConnection.externalBlocks ?? []).filter(
        (block) => block.source === "calendar-import"
      ).length,
      syncHealth: this.buildProviderCalendarSyncHealth(imported, bookings)
    };
  }

  public async syncProviderCalendarImport(
    providerId: string,
    payload: SyncExternalCalendarImportRequest
  ): Promise<ProviderCalendarImportsResponse> {
    const provider = await this.repository.findProviderById(providerId);
    if (!provider) {
      throw new HttpError(404, "Provider not found");
    }

    const subscription = (provider.calendarConnection.externalSubscriptions ?? []).find(
      (item) => item.id === payload.subscriptionId
    );
    if (!subscription) {
      throw new HttpError(404, "Calendar import not found");
    }

    const updatedProvider = await this.syncExternalCalendarSubscription(
      provider,
      subscription,
      provider.calendarConnection.externalSubscriptions ?? []
    );
    const bookings = await this.listFutureProviderCalendarConflictBookings(updatedProvider.id);
    return {
      providerId,
      subscriptions: updatedProvider.calendarConnection.externalSubscriptions ?? [],
      importedBlockCount: (updatedProvider.calendarConnection.externalBlocks ?? []).filter(
        (block) => block.source === "calendar-import"
      ).length,
      syncHealth: this.buildProviderCalendarSyncHealth(updatedProvider, bookings)
    };
  }

  public async syncStaleProviderCalendarImports(
    providerId: string
  ): Promise<SyncStaleProviderCalendarImportsResponse> {
    const provider = await this.repository.findProviderById(providerId);
    if (!provider) {
      throw new HttpError(404, "Provider not found");
    }

    const subscriptions = provider.calendarConnection.externalSubscriptions ?? [];
    const now = Date.now();
    const targets = subscriptions.filter(
      (subscription) =>
        subscription.syncStatus === "error" ||
        !subscription.lastSyncedAt ||
        now - Date.parse(subscription.lastSyncedAt) > 24 * 60 * 60 * 1000
    );

    let currentProvider = provider;
    let syncedSubscriptionCount = 0;
    let failedSubscriptionCount = 0;

    for (const target of targets) {
      const currentSubscription = (currentProvider.calendarConnection.externalSubscriptions ?? []).find(
        (item) => item.id === target.id
      );
      if (!currentSubscription) {
        failedSubscriptionCount += 1;
        continue;
      }

      const beforeStatus = currentSubscription.syncStatus;
      currentProvider = await this.syncExternalCalendarSubscription(
        currentProvider,
        currentSubscription,
        currentProvider.calendarConnection.externalSubscriptions ?? []
      );
      const afterStatus = (currentProvider.calendarConnection.externalSubscriptions ?? []).find(
        (item) => item.id === target.id
      )?.syncStatus;

      if (afterStatus === "active") {
        syncedSubscriptionCount += 1;
      } else if (beforeStatus === "error" || afterStatus === "error") {
        failedSubscriptionCount += 1;
      }
    }

    const bookings = await this.listFutureProviderCalendarConflictBookings(currentProvider.id);
    return {
      providerId,
      subscriptions: currentProvider.calendarConnection.externalSubscriptions ?? [],
      importedBlockCount: (currentProvider.calendarConnection.externalBlocks ?? []).filter(
        (block) => block.source === "calendar-import"
      ).length,
      syncHealth: this.buildProviderCalendarSyncHealth(currentProvider, bookings),
      attemptedSubscriptionCount: targets.length,
      syncedSubscriptionCount,
      failedSubscriptionCount
    };
  }

  public async removeProviderCalendarImport(
    providerId: string,
    payload: RemoveExternalCalendarImportRequest
  ): Promise<ProviderCalendarImportsResponse> {
    const provider = await this.repository.findProviderById(providerId);
    if (!provider) {
      throw new HttpError(404, "Provider not found");
    }

    const nextSubscriptions = (provider.calendarConnection.externalSubscriptions ?? []).filter(
      (item) => item.id !== payload.subscriptionId
    );
    const nextBlocks = (provider.calendarConnection.externalBlocks ?? []).filter(
      (block) => block.subscriptionId !== payload.subscriptionId
    );

    const updatedProvider = await this.repository.updateProvider(providerId, {
      calendarConnection: {
        ...provider.calendarConnection,
        externalSubscriptions: nextSubscriptions,
        externalBlocks: nextBlocks
      }
    });

    if (!updatedProvider) {
      throw new HttpError(500, "Calendar import could not be removed");
    }
    const bookings = await this.listFutureProviderCalendarConflictBookings(updatedProvider.id);

    return {
      providerId,
      subscriptions: updatedProvider.calendarConnection.externalSubscriptions ?? [],
      importedBlockCount: (updatedProvider.calendarConnection.externalBlocks ?? []).filter(
        (block) => block.source === "calendar-import"
      ).length,
      syncHealth: this.buildProviderCalendarSyncHealth(updatedProvider, bookings)
    };
  }

  public async getProviderCalendarOverview(
    providerId: string,
    input?: {
      fromIso?: string;
      toIso?: string;
    }
  ): Promise<ProviderCalendarOverviewResponse> {
    const provider = await this.repository.findProviderById(providerId);
    if (!provider) {
      throw new HttpError(404, "Provider not found");
    }

    const windowStartIso = input?.fromIso
      ? new Date(input.fromIso).toISOString()
      : new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
    const windowEndIso = input?.toIso
      ? new Date(input.toIso).toISOString()
      : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    if (
      Number.isNaN(new Date(windowStartIso).getTime()) ||
      Number.isNaN(new Date(windowEndIso).getTime()) ||
      new Date(windowEndIso).getTime() <= new Date(windowStartIso).getTime()
    ) {
      throw new HttpError(400, "Calendar overview window must use valid ISO dates with end after start");
    }

    const [staffingSummaries, rawBookings] = await Promise.all([
      this.buildProviderStaffingSummaries(provider),
      this.repository.listBookings()
    ]);
    const bookingNotesById = new Map(rawBookings.map((booking) => [booking.id, booking.notes]));
    const bookings = staffingSummaries
      .map((job) => ({
        id: job.bookingId,
        category: job.category,
        customerName: job.customerName,
        addressLine: job.serviceAddress.line1,
        city: job.serviceAddress.city,
        state: job.serviceAddress.state,
        scheduledStartIso: job.scheduledStartIso,
        scheduledEndIso: job.scheduledEndIso,
        status: job.status,
        notes: bookingNotesById.get(job.bookingId),
        serviceAddress: job.serviceAddress,
        requiredCrewMembers: job.requiredCrewMembers,
        assignedCrewMembers: job.assignedCrewMembers
      }))
      .filter((booking) =>
      this.doIntervalsOverlap(booking.scheduledStartIso, booking.scheduledEndIso, windowStartIso, windowEndIso)
    );
    const externalBlocks = this.getActiveExternalCalendarBlocks(provider).filter((block) =>
      this.doIntervalsOverlap(block.startIso, block.endIso, windowStartIso, windowEndIso)
    );

    const events = this.schedulingService.buildProviderCalendarEvents({
      bookings: bookings.map((booking) => ({
        id: booking.id,
        category: booking.category,
        customerName: booking.customerName,
        addressLine: booking.addressLine,
        city: booking.city,
        state: booking.state,
        scheduledStartIso: booking.scheduledStartIso,
        scheduledEndIso: booking.scheduledEndIso,
        status: booking.status,
        notes: booking.notes
      })),
      externalBlocks
    });
    const dispatchDays = this.schedulingService.buildProviderDispatchDays({
      providerAddress: provider.address,
      bookings,
      externalBlocks
    });

    return {
      providerId: provider.id,
      providerName: provider.companyName,
      windowStartIso,
      windowEndIso,
      totalEvents: events.length,
      yardmatchJobCount: bookings.length,
      externalBlockCount: externalBlocks.length,
      syncHealth: this.buildProviderCalendarSyncHealth(provider, bookings, externalBlocks),
      dispatchDays,
      events
    };
  }

  private filterProviderSlotsAgainstExternalBlocks(
    provider: ProviderProfile,
    slots: Array<{ startIso: string; endIso: string; isBooked: boolean; providerId: string; id: string }>
  ) {
    const blocks = this.getActiveExternalCalendarBlocks(provider);
    if (blocks.length === 0) {
      return slots;
    }

    return slots.filter(
      (slot) =>
        !blocks.some((block) =>
          this.doIntervalsOverlap(slot.startIso, slot.endIso, block.startIso, block.endIso)
        )
    );
  }

  private getActiveExternalCalendarBlocks(provider: ProviderProfile): ExternalCalendarBlock[] {
    if (!provider.calendarConnection.externalEventsBlockingEnabled) {
      return [];
    }

    return [...(provider.calendarConnection.externalBlocks ?? [])].sort((left, right) =>
      left.startIso.localeCompare(right.startIso)
    );
  }

  private buildProviderCalendarSyncHealth(
    provider: ProviderProfile,
    bookings: Array<{ scheduledStartIso: string; scheduledEndIso: string }> = [],
    activeExternalBlocks = this.getActiveExternalCalendarBlocks(provider)
  ): ProviderCalendarSyncHealth {
    const subscriptions = provider.calendarConnection.externalSubscriptions ?? [];
    const now = Date.now();
    const allExternalBlocks = provider.calendarConnection.externalBlocks ?? [];
    const manualBlockCount = allExternalBlocks.filter((block) => block.source === "manual").length;
    const importedBlocks = allExternalBlocks.filter((block) => block.source === "calendar-import");
    const importedBlockCount = importedBlocks.length;
    const upcomingExternalBlocks = allExternalBlocks.filter(
      (block) => Date.parse(block.endIso) > now
    );
    const conflictingYardmatchJobCount = bookings.filter((booking) =>
      allExternalBlocks.some((block) =>
        this.doIntervalsOverlap(block.startIso, block.endIso, booking.scheduledStartIso, booking.scheduledEndIso)
      )
    ).length;
    const staleSubscriptions = subscriptions.filter((subscription) => {
      if (!subscription.lastSyncedAt) {
        return true;
      }

      return now - Date.parse(subscription.lastSyncedAt) > 24 * 60 * 60 * 1000;
    });
    const erroredSubscriptions = subscriptions.filter((subscription) => subscription.syncStatus === "error");

    const notes: string[] = [];
    const externalBlockingEnabled = provider.calendarConnection.externalEventsBlockingEnabled ?? false;

    if (subscriptions.length === 0) {
      notes.push("No outside calendar feeds are connected yet.");
    }

    if (!externalBlockingEnabled && upcomingExternalBlocks.length > 0) {
      notes.push("Outside blocks are saved, but they are not reducing YardMatch availability yet.");
    }

    if (conflictingYardmatchJobCount > 0) {
      notes.push(
        `${conflictingYardmatchJobCount} YardMatch job${conflictingYardmatchJobCount === 1 ? " overlaps" : "s overlap"} an outside calendar block and needs ops or provider review.`
      );
    }

    if (erroredSubscriptions.length > 0) {
      notes.push(
        `${erroredSubscriptions.length} calendar feed${erroredSubscriptions.length === 1 ? " is" : "s are"} currently failing to sync.`
      );
    }

    if (staleSubscriptions.length > 0) {
      notes.push(
        `${staleSubscriptions.length} calendar feed${staleSubscriptions.length === 1 ? " has" : "s have"} not synced in the last 24 hours.`
      );
    }

    if (externalBlockingEnabled && importedBlockCount > 0 && activeExternalBlocks.length === 0) {
      notes.push("Imported outside calendars exist, but there are no active blocks in the current schedule window.");
    }

    if (notes.length === 0) {
      notes.push("Outside calendars are synced and availability protection looks healthy.");
    }

    const status: ProviderCalendarSyncHealth["status"] =
      erroredSubscriptions.length > 0 ||
      (!externalBlockingEnabled && upcomingExternalBlocks.length > 0) ||
      conflictingYardmatchJobCount > 0
        ? "at-risk"
        : staleSubscriptions.length > 0
          ? "attention"
          : "healthy";

    return {
      status,
      externalBlockingEnabled,
      subscriptionCount: subscriptions.length,
      activeSubscriptionCount: subscriptions.filter((subscription) => subscription.syncStatus === "active").length,
      erroredSubscriptionCount: erroredSubscriptions.length,
      staleSubscriptionCount: staleSubscriptions.length,
      importedBlockCount,
      manualBlockCount,
      upcomingExternalBlockCount: upcomingExternalBlocks.length,
      conflictingYardmatchJobCount,
      nextExternalBlockStartIso: upcomingExternalBlocks
        .sort((left, right) => left.startIso.localeCompare(right.startIso))[0]?.startIso,
      notes
    };
  }

  private buildProviderCalendarSubscriptionActions(feedUrl: string): ProviderCalendarSubscriptionAction[] {
    const webcalUrl = feedUrl.replace(/^http/, "webcal");
    const googleCalendarUrl = `https://calendar.google.com/calendar/u/0/r/settings/addbyurl?cid=${encodeURIComponent(feedUrl)}`;

    return [
      {
        platform: "apple-calendar",
        label: "Apple Calendar",
        href: webcalUrl,
        helperText: "Opens the native subscribe flow in Apple Calendar and other webcal-capable apps."
      },
      {
        platform: "google-calendar",
        label: "Google Calendar",
        href: googleCalendarUrl,
        helperText: "Opens Google Calendar's Add by URL screen with the YardMatch feed prefilled."
      },
      {
        platform: "ical",
        label: "Raw feed URL",
        href: feedUrl,
        helperText: "Use this HTTPS feed in any iCal-compatible calendar that prefers a plain URL."
      }
    ];
  }

  private async listFutureProviderCalendarConflictBookings(providerId: string) {
    return (await this.repository.listBookings()).filter(
      (booking) =>
        booking.providerId === providerId &&
        booking.status !== "cancelled" &&
        booking.status !== "completed" &&
        booking.status !== "refunded" &&
        Date.parse(booking.scheduledEndIso) > Date.now()
    );
  }

  private async persistExternalCalendarSubscriptionError(
    provider: ProviderProfile,
    subscriptionId: string,
    errorMessage: string,
    allSubscriptions: ExternalCalendarSubscription[]
  ): Promise<ProviderProfile> {
    const nextSubscriptions = allSubscriptions.map((item) =>
      item.id === subscriptionId
        ? {
            ...item,
            lastSyncedAt: new Date().toISOString(),
            syncStatus: "error" as const,
            lastError: errorMessage
          }
        : item
    );

    const updatedProvider = await this.repository.updateProvider(provider.id, {
      calendarConnection: {
        ...provider.calendarConnection,
        externalSubscriptions: nextSubscriptions,
        lastSyncedAt: new Date().toISOString()
      }
    });

    if (!updatedProvider) {
      throw new HttpError(500, "Calendar import error state could not be saved");
    }

    return updatedProvider;
  }

  private async syncExternalCalendarSubscription(
    provider: ProviderProfile,
    subscription: ExternalCalendarSubscription,
    allSubscriptions: ExternalCalendarSubscription[]
  ): Promise<ProviderProfile> {
    try {
      const icsBody = await this.fetchExternalCalendarFeed(subscription.feedUrl);
      const importedBlocks = this.parseExternalCalendarFeed({
        icsBody,
        subscriptionId: subscription.id,
        title: subscription.title
      });
      const manualBlocks = (provider.calendarConnection.externalBlocks ?? []).filter(
        (block) => block.source !== "calendar-import" && block.subscriptionId !== subscription.id
      );
      const nextBlocks = this.normalizeExternalCalendarBlocks([...manualBlocks, ...importedBlocks]);
      const nextSubscriptions = allSubscriptions.map((item) =>
        item.id === subscription.id
          ? {
              ...item,
              importedEventCount: importedBlocks.length,
              lastSyncedAt: new Date().toISOString(),
              syncStatus: "active" as const,
              lastError: undefined
            }
          : item
      );

      await this.ensureExternalCalendarBlocksDoNotConflict({
        ...provider,
        calendarConnection: {
          ...provider.calendarConnection,
          externalBlocks: nextBlocks,
          externalSubscriptions: nextSubscriptions
        }
      });

      const updatedProvider = await this.repository.updateProvider(provider.id, {
        calendarConnection: {
          ...provider.calendarConnection,
          externalBlocks: nextBlocks,
          externalSubscriptions: nextSubscriptions,
          lastSyncedAt: new Date().toISOString()
        }
      });

      if (!updatedProvider) {
        throw new HttpError(500, "Calendar import could not be synced");
      }

      return updatedProvider;
    } catch (error) {
      return this.persistExternalCalendarSubscriptionError(
        provider,
        subscription.id,
        error instanceof Error ? error.message : "Calendar import could not be synced",
        allSubscriptions
      );
    }
  }

  private async fetchExternalCalendarFeed(feedUrl: string): Promise<string> {
    const normalizedUrl = feedUrl.replace(/^webcal:\/\//i, "https://");
    const response = await fetch(normalizedUrl);
    if (!response.ok) {
      throw new HttpError(400, `Calendar feed returned ${response.status}`);
    }

    return response.text();
  }

  private parseExternalCalendarFeed(input: {
    icsBody: string;
    subscriptionId: string;
    title: string;
  }): ExternalCalendarBlock[] {
    const unfolded = input.icsBody.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
    const events = unfolded.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) ?? [];
    const now = Date.now();
    const oneYearFromNow = now + 366 * 24 * 60 * 60 * 1000;

    const importedBlocks: ExternalCalendarBlock[] = [];

    for (const event of events) {
        const summary = this.readIcsValue(event, "SUMMARY") ?? input.title;
        const description = this.readIcsValue(event, "DESCRIPTION");
        const dtStart = this.readIcsDate(event, "DTSTART");
        const dtEnd = this.readIcsDate(event, "DTEND");
        if (!dtStart || !dtEnd || dtEnd.getTime() <= dtStart.getTime()) {
          continue;
        }

        if (dtEnd.getTime() < now - 24 * 60 * 60 * 1000 || dtStart.getTime() > oneYearFromNow) {
          continue;
        }

        const normalizedTitle = summary.trim() || input.title;
        importedBlocks.push({
          id: `${input.subscriptionId}:${this.readIcsValue(event, "UID") ?? crypto.randomUUID()}`,
          title: normalizedTitle,
          blockType: "off-platform-client" as const,
          startIso: dtStart.toISOString(),
          endIso: dtEnd.toISOString(),
          notes: description?.trim() || `Imported from ${input.title}`,
          source: "calendar-import" as const,
          createdAt: new Date().toISOString(),
          subscriptionId: input.subscriptionId
        } satisfies ExternalCalendarBlock);
    }

    return importedBlocks.sort((left, right) => left.startIso.localeCompare(right.startIso));
  }

  private readIcsValue(eventBlock: string, propertyName: string): string | undefined {
    const match = eventBlock.match(new RegExp(`^${propertyName}(?:;[^:]+)?:([^\r\n]+)$`, "m"));
    return match?.[1]
      ?.replaceAll("\\n", "\n")
      .replaceAll("\\,", ",")
      .replaceAll("\\;", ";")
      .replaceAll("\\\\", "\\");
  }

  private readIcsDate(eventBlock: string, propertyName: "DTSTART" | "DTEND"): Date | undefined {
    const match = eventBlock.match(new RegExp(`^${propertyName}((?:;[^:]+)?):([^\r\n]+)$`, "m"));
    if (!match) {
      return undefined;
    }

    const parameters = match[1] ?? "";
    const rawValue = match[2]?.trim();
    if (!rawValue) {
      return undefined;
    }

    if (parameters.includes("VALUE=DATE")) {
      const year = Number(rawValue.slice(0, 4));
      const month = Number(rawValue.slice(4, 6)) - 1;
      const day = Number(rawValue.slice(6, 8));
      return new Date(Date.UTC(year, month, day));
    }

    const normalized = rawValue.endsWith("Z") ? rawValue.slice(0, -1) : rawValue;
    const year = Number(normalized.slice(0, 4));
    const month = Number(normalized.slice(4, 6)) - 1;
    const day = Number(normalized.slice(6, 8));
    const hour = Number(normalized.slice(9, 11) || "0");
    const minute = Number(normalized.slice(11, 13) || "0");
    const second = Number(normalized.slice(13, 15) || "0");
    return rawValue.endsWith("Z")
      ? new Date(Date.UTC(year, month, day, hour, minute, second))
      : new Date(year, month, day, hour, minute, second);
  }

  private normalizeExternalCalendarBlocks(
    blocks: UpdateProviderSettingsRequest["externalCalendarBlocks"]
  ): ExternalCalendarBlock[] {
    return [...(blocks ?? [])]
      .map((block) => {
        const title = block.title.trim();
        if (!title) {
          throw new HttpError(400, "Each external calendar block needs a title");
        }

        const startTime = new Date(block.startIso);
        const endTime = new Date(block.endIso);
        if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) {
          throw new HttpError(400, "External calendar block times must be valid ISO dates");
        }

        if (endTime.getTime() <= startTime.getTime()) {
          throw new HttpError(400, "Each external calendar block must end after it starts");
        }

        return {
          id: block.id ?? crypto.randomUUID(),
          title,
          blockType: block.blockType,
          startIso: startTime.toISOString(),
          endIso: endTime.toISOString(),
          notes: block.notes?.trim() || undefined,
          source: block.source ?? "manual",
          createdAt: block.createdAt ?? new Date().toISOString(),
          subscriptionId: block.subscriptionId
        } satisfies ExternalCalendarBlock;
      })
      .sort((left, right) => left.startIso.localeCompare(right.startIso));
  }

  private async listProviderCalendarBookings(providerId: string) {
    const customers = await this.repository.listCustomers();
    return (await this.repository.listBookings())
      .filter(
        (booking) =>
          booking.providerId === providerId &&
          booking.status !== "cancelled" &&
          booking.status !== "refunded"
      )
      .sort((left, right) => left.scheduledStartIso.localeCompare(right.scheduledStartIso))
      .map((booking) => {
        const customer = customers.find((item) => item.id === booking.customerId);
        return {
          id: booking.id,
          category: booking.category,
          customerName: customer?.fullName ?? "YardMatch customer",
          addressLine: booking.serviceAddress.line1,
          city: booking.serviceAddress.city,
          state: booking.serviceAddress.state,
          scheduledStartIso: booking.scheduledStartIso,
          scheduledEndIso: booking.scheduledEndIso,
          status: booking.status,
          notes: booking.notes
        };
      });
  }

  private async ensureExternalCalendarBlocksDoNotConflict(provider: ProviderProfile): Promise<void> {
    const blocks = this.getActiveExternalCalendarBlocks(provider);
    if (blocks.length === 0) {
      return;
    }

    const bookings = (await this.repository.listBookings()).filter(
      (booking) =>
        booking.providerId === provider.id &&
        booking.status !== "cancelled" &&
        booking.status !== "completed" &&
        booking.status !== "refunded"
    );

    const conflictingBlock = blocks.find((block) =>
      bookings.some((booking) =>
        this.doIntervalsOverlap(
          block.startIso,
          block.endIso,
          booking.scheduledStartIso,
          booking.scheduledEndIso
        )
      )
    );

    if (conflictingBlock) {
      throw new HttpError(
        400,
        `The block "${conflictingBlock.title}" overlaps an existing YardMatch job. Adjust the block window or reschedule the booked service first.`
      );
    }
  }

  private async assertProviderRescheduleWindowIsAvailable(
    providerId: string,
    bookingId: string,
    scheduledStartIso: string,
    scheduledEndIso: string
  ): Promise<void> {
    await this.assertProviderWindowIsAvailable(providerId, scheduledStartIso, scheduledEndIso);

    const overlappingBooking = (await this.repository.listBookings()).find(
      (booking) =>
        booking.providerId === providerId &&
        booking.id !== bookingId &&
        booking.status !== "cancelled" &&
        booking.status !== "refunded" &&
        booking.status !== "completed" &&
        this.doIntervalsOverlap(
          booking.scheduledStartIso,
          booking.scheduledEndIso,
          scheduledStartIso,
          scheduledEndIso
        )
    );

    if (overlappingBooking) {
      throw new HttpError(
        409,
        "That provider window overlaps another YardMatch job. Pick a different service window."
      );
    }
  }

  private async assertProviderWindowIsAvailable(
    providerId: string,
    scheduledStartIso: string,
    scheduledEndIso: string
  ): Promise<void> {
    const provider = await this.repository.findProviderById(providerId);
    if (!provider) {
      throw new HttpError(404, "Provider not found");
    }

    const overlapsExternalBlock = this.getActiveExternalCalendarBlocks(provider).some((block) =>
      this.doIntervalsOverlap(
        block.startIso,
        block.endIso,
        scheduledStartIso,
        scheduledEndIso
      )
    );

    if (overlapsExternalBlock) {
      throw new HttpError(
        409,
        "That service window is no longer available. The provider may be booked or blocked by an outside calendar event."
      );
    }

    if (!this.isWithinProviderAcceptanceWindow(provider, scheduledStartIso)) {
      throw new HttpError(409, this.buildProviderAcceptanceWindowMessage(provider.minimumBookingLeadHours));
    }
  }

  private isWithinProviderAcceptanceWindow(
    provider: Pick<ProviderProfile, "minimumBookingLeadHours">,
    scheduledStartIso: string
  ): boolean {
    const minimumLeadHours = provider.minimumBookingLeadHours ?? 0;
    if (minimumLeadHours <= 0) {
      return true;
    }

    const scheduledStart = Date.parse(scheduledStartIso);
    if (Number.isNaN(scheduledStart)) {
      return false;
    }

    return scheduledStart - Date.now() >= minimumLeadHours * 60 * 60 * 1000;
  }

  private buildProviderAcceptanceWindowMessage(minimumBookingLeadHours: number): string {
    const leadText =
      minimumBookingLeadHours === 1
        ? "at least 1 hour in advance"
        : `at least ${minimumBookingLeadHours} hours in advance`;
    return `This business only accepts new bookings ${leadText}. Pick a later service window.`;
  }

  private doIntervalsOverlap(
    leftStartIso: string,
    leftEndIso: string,
    rightStartIso: string,
    rightEndIso: string
  ): boolean {
    return (
      new Date(leftStartIso).getTime() < new Date(rightEndIso).getTime() &&
      new Date(rightStartIso).getTime() < new Date(leftEndIso).getTime()
    );
  }

  private parseProviderAssistantCommand(command: string): ParsedProviderAssistantCommand {
    const trimmed = command.trim();
    const chainSegments = trimmed
      .split(/\s+\band\b\s+/i)
      .map((segment) => segment.trim())
      .filter(Boolean);

    if (chainSegments.length >= 2) {
      const parsedSegments = chainSegments.map((segment) => this.parseSingleProviderAssistantAction(segment));
      if (parsedSegments.every((action): action is ParsedProviderAssistantAction => Boolean(action))) {
        let inheritedSourceWindowKey: ParsedProviderAssistantAction["sourceWindowKey"];
        const actions = parsedSegments.map((action) => {
          const withInheritedWindow = {
            ...action,
            sourceWindowKey: action.sourceWindowKey ?? inheritedSourceWindowKey
          };
          inheritedSourceWindowKey = withInheritedWindow.sourceWindowKey;
          return withInheritedWindow;
        });

        return {
          understood: true,
          actionType: actions[0].actionType,
          actionTypes: actions.map((action) => action.actionType),
          actions,
          dispatchScope: actions.find((action) => action.dispatchScope)?.dispatchScope,
          dispatchFocus: actions.find((action) => action.dispatchFocus)?.dispatchFocus,
          sourceWindowKey: actions[0].sourceWindowKey,
          targetWindowKey: actions.find((action) => action.targetWindowKey)?.targetWindowKey,
          notifyCustomer: actions.some((action) => action.notifyCustomer),
          routeLeaderCrewNameQuery: actions.find((action) => action.routeLeaderCrewNameQuery)?.routeLeaderCrewNameQuery,
          lateMinutes: actions.find((action) => action.lateMinutes)?.lateMinutes,
          lateReason: actions.find((action) => action.lateReason)?.lateReason,
          exceptionType: actions.find((action) => action.exceptionType)?.exceptionType,
          exceptionNotes: actions.find((action) => action.exceptionNotes)?.exceptionNotes
        };
      }
    }

    const singleAction = this.parseSingleProviderAssistantAction(trimmed);
    return {
      understood: Boolean(singleAction),
      actionType: singleAction?.actionType,
      actionTypes: singleAction ? [singleAction.actionType] : [],
      actions: singleAction ? [singleAction] : [],
      dispatchScope: singleAction?.dispatchScope,
      dispatchFocus: singleAction?.dispatchFocus,
      sourceWindowKey: singleAction?.sourceWindowKey,
      targetWindowKey: singleAction?.targetWindowKey,
      notifyCustomer: singleAction?.notifyCustomer ?? false,
      routeLeaderCrewNameQuery: singleAction?.routeLeaderCrewNameQuery,
      lateMinutes: singleAction?.lateMinutes,
      lateReason: singleAction?.lateReason,
      exceptionType: singleAction?.exceptionType,
      exceptionNotes: singleAction?.exceptionNotes
    };
  }

  private parseSingleProviderAssistantAction(command: string): ParsedProviderAssistantAction | undefined {
    const normalized = command.trim().toLowerCase();
    const notifyCustomer =
      /notify|notification|message|tell/.test(normalized) &&
      /customer|property owner|homeowner|client/.test(normalized);
    const targetBoundary = normalized.match(/\b(?:to|into)\b/);
    const beforeTarget = targetBoundary ? normalized.slice(0, targetBoundary.index).trim() : normalized;
    const afterTarget = targetBoundary
      ? normalized.slice((targetBoundary.index ?? 0) + targetBoundary[0].length).trim()
      : "";

    const crewMessageDetails = this.parseProviderAssistantCrewMessage(command);
    const targetWindowKey = this.parseProviderAssistantWindowFromCommand(afterTarget, true);
    const sourceWindowKey =
      crewMessageDetails?.crewNameQuery && crewMessageDetails?.body
        ? this.parseProviderAssistantWindowFromCommand(normalized, true)
        : this.parseProviderAssistantWindowFromCommand(beforeTarget, true);
    const crewMatchCrewNameQuery = this.parseProviderAssistantCrewMatchName(command);
    const routeLeaderCrewNameQuery = this.parseProviderAssistantRouteLeaderCrewName(command);
    const routeStopKind = this.parseProviderAssistantRouteStopKind(normalized);
    const dispatchScope = this.parseProviderAssistantDispatchScope(normalized);
    const dispatchFocus = this.parseProviderAssistantDispatchFocus(normalized);
    const lateMinutes = this.parseProviderAssistantLateMinutes(normalized);
    const lateReason = this.parseProviderAssistantLateReason(normalized);
    const exceptionType = this.parseProviderAssistantExceptionType(normalized);
    const exceptionNotes = this.parseProviderAssistantExceptionNotes(command);
    const isClearRouteLeaderCommand =
      /\b(clear|remove|unset)\b/.test(normalized) &&
      /\broute leader\b/.test(normalized);
    const isAssignRouteLeaderCommand =
      Boolean(routeLeaderCrewNameQuery) &&
      /\b(assign|make|set)\b/.test(normalized) &&
      /\broute leader\b/.test(normalized);
    const isCrewMessageCommand =
      Boolean(crewMessageDetails?.crewNameQuery && crewMessageDetails?.body) &&
      /\b(?:tell|message|ask)\b/.test(normalized) &&
      /\bcrew\b/.test(normalized) &&
      !/\broute leader\b/.test(normalized);
    const isClearRouteStopCommand =
      /\b(clear|remove|skip)\b/.test(normalized) &&
      /\b(route stop|equipment pickup|staging stop)\b/.test(normalized);
    const isSetRouteStopCommand =
      Boolean(routeStopKind) &&
      /\b(set|use|add|make)\b/.test(normalized) &&
      /\b(stop|first)\b/.test(normalized);
    const isAcceptBestCrewCommand =
      /\b(?:accept|assign|pick|choose)\b/.test(normalized) &&
      /\b(?:the\s+)?(?:best|top)\s+crew\b/.test(normalized);
    const isDispatchSummaryCommand =
      Boolean(dispatchScope) &&
      (/\b(?:how|what|show|summarize|summary|review)\b/.test(normalized) ||
        /\b(?:route|dispatch|schedule)\b/.test(normalized)) &&
      !/\b(?:appointment|booking|job|visit)\b/.test(normalized);
    const isDispatchAdjustmentCommand =
      Boolean(dispatchScope) &&
      /\b(?:what|which|suggest|recommend)\b/.test(normalized) &&
      /\b(?:move|reschedule|shift|push)\b/.test(normalized) &&
      !/\b(?:appointment|booking|job|visit)\b/.test(normalized);
    const isStaffingAdjustmentCommand =
      Boolean(dispatchScope) &&
      /\b(?:need|add|bring|get|send|assign|where)\b/.test(normalized) &&
      /\b(?:crew|staffing|hands|people)\b/.test(normalized) &&
      !/\b(?:appointment|booking|job|visit)\b/.test(normalized);
    const isAcceptCrewCommand =
      Boolean(crewMatchCrewNameQuery) &&
      /\b(?:accept|approve)\b/.test(normalized) &&
      /\bcrew\b/.test(normalized);
    const isDenyCrewCommand =
      Boolean(crewMatchCrewNameQuery) &&
      /\b(?:deny|decline|pass on)\b/.test(normalized) &&
      /\bcrew\b/.test(normalized);
    const isConfirmCommand = /\b(confirm|approve|accept)\b/.test(normalized) && /\b(appointment|booking|job|visit)\b/.test(normalized);
    const isCompleteCommand = /\b(complete|finish|wrap up|done with)\b/.test(normalized) && /\b(appointment|booking|job|visit|service)\b/.test(normalized);
    const isLateCommand = Boolean(lateMinutes) && /\blate|behind\b/.test(normalized);
    const isRescheduleCommand = Boolean(targetWindowKey && /change|move|shift|resched/.test(normalized));
    const isExceptionCommand =
      Boolean(exceptionType) &&
      /\b(no access|can't access|cannot access|unable to access|customer not ready|no show|no-show|could not complete|couldn't complete|cannot complete)\b/.test(
        normalized
      );
    const isStartWorkCommand = /\b(start work|begin work|start the job|begin the job|start service|begin service)\b/.test(
      normalized
    );
    const isStartRouteCommand = /\b(start route|start the route|on my way|head out|heading out|leave for|heading to)\b/.test(
      normalized
    );

    const actionType = isCrewMessageCommand
      ? "message-crew"
      : isClearRouteStopCommand
        ? "clear-route-stop"
      : isSetRouteStopCommand
        ? "set-route-stop"
      : isStaffingAdjustmentCommand
        ? "recommend-staffing-adjustment"
      : isDispatchAdjustmentCommand
        ? "recommend-dispatch-adjustment"
      : isDispatchSummaryCommand
        ? "summarize-dispatch"
      : isAcceptBestCrewCommand
        ? "accept-best-crew-match"
      : isAcceptCrewCommand
        ? "accept-crew-match"
        : isDenyCrewCommand
          ? "deny-crew-match"
      : isAssignRouteLeaderCommand
      ? "assign-route-leader"
      : isClearRouteLeaderCommand
        ? "clear-route-leader"
        : isConfirmCommand
      ? "confirm-booking"
      : isCompleteCommand
        ? "complete-booking"
        : isExceptionCommand
          ? "report-booking-exception"
          : isRescheduleCommand
            ? "reschedule-booking"
            : isLateCommand
              ? "mark-booking-late"
              : isStartRouteCommand
                ? "start-route"
                : isStartWorkCommand
                  ? "start-work"
                  : undefined;

    if (!actionType) {
      return undefined;
    }

    return {
      command,
      actionType,
      dispatchScope,
      dispatchFocus,
      sourceWindowKey,
      targetWindowKey,
      crewMatchCrewNameQuery,
      routeLeaderCrewNameQuery,
      crewMessageCrewNameQuery: crewMessageDetails?.crewNameQuery,
      crewMessageBody: crewMessageDetails?.body,
      routeStopKind,
      notifyCustomer:
        actionType === "confirm-booking" ||
        actionType === "complete-booking" ||
        actionType === "report-booking-exception" ||
        actionType === "mark-booking-late" ||
        actionType === "start-route"
          ? true
          : notifyCustomer,
      lateMinutes,
      lateReason,
      exceptionType,
      exceptionNotes
    };
  }

  private parseProviderAssistantExceptionType(command: string): MarkBookingExceptionRequest["exceptionType"] | undefined {
    if (/\b(no show|no-show)\b/.test(command)) {
      return "customer-no-show";
    }

    if (/\bcustomer not ready\b/.test(command)) {
      return "customer-not-ready";
    }

    if (/\b(no access|can't access|cannot access|unable to access)\b/.test(command)) {
      return "unable-to-access-property";
    }

    if (/\b(could not complete|couldn't complete|cannot complete)\b/.test(command)) {
      return "service-could-not-be-completed";
    }

    return undefined;
  }

  private parseProviderAssistantExceptionNotes(command: string): string | undefined {
    const match = command.match(/\b(?:because|reason[:]?|due to)\b\s+(.+)$/i);
    return match?.[1]?.trim() || undefined;
  }

  private parseProviderAssistantRouteLeaderCrewName(command: string): string | undefined {
    const assignMatch =
      command.match(/\b(?:assign|make|set)\s+(.+?)\s+(?:as\s+|the\s+)?route leader\b/i) ??
      command.match(/\broute leader\s+(?:should be|is)\s+(.+?)(?:\s+for\b|$)/i);
    return assignMatch?.[1]?.trim();
  }

  private parseProviderAssistantRouteStopKind(
    command: string
  ): SetBookingRouteStopRequest["kind"] | undefined {
    if (/\bstaging stop\b/.test(command)) {
      return "staging";
    }

    if (/\bequipment pickup\b/.test(command) || /\bpickup stop\b/.test(command)) {
      return "equipment-pickup";
    }

    return undefined;
  }

  private parseProviderAssistantCrewMatchName(command: string): string | undefined {
    const reviewMatch =
      command.match(/\b(?:accept|approve|deny|decline)\s+(.+?)(?:\s+for\b|$)/i) ??
      command.match(/\bpass on\s+(.+?)(?:\s+for\b|$)/i);
    return reviewMatch?.[1]?.trim();
  }

  private parseProviderAssistantDispatchScope(
    command: string
  ): "today" | "tomorrow" | "next-7-days" | undefined {
    if (/\b(next 7 days|next seven days|this week|next week)\b/.test(command)) {
      return "next-7-days";
    }

    if (/\btomorrow\b/.test(command)) {
      return "tomorrow";
    }

    if (/\btoday\b/.test(command)) {
      return "today";
    }

    return undefined;
  }

  private parseProviderAssistantDispatchFocus(command: string): "summary" | "attention" {
    return /\b(attention|risk|risky|problem|pressure|overloaded|watch)\b/.test(command)
      ? "attention"
      : "summary";
  }

  private parseProviderAssistantCrewMessage(
    command: string
  ): { crewNameQuery?: string; body?: string } | undefined {
    const match =
      command.match(/\b(?:tell|ask)\s+(.+?)\s+to\s+(.+)$/i) ??
      command.match(/\b(?:message|tell|ask)\s+(.+?)\s+(?:that|about)\s+(.+)$/i);
    if (!match) {
      return undefined;
    }

    const crewNameQuery = match[1]?.trim();
    const body = this.stripProviderAssistantBookingSelector(match[2] ?? "");
    if (!crewNameQuery || !body) {
      return undefined;
    }

    return {
      crewNameQuery,
      body: this.toSentenceCase(body)
    };
  }

  private stripProviderAssistantBookingSelector(value: string): string {
    return value
      .trim()
      .replace(
        /\s+for\s+(?:my|this|the|today'?s)\s+(?:(?:late\s+afternoon(?:\s*\/\s*evening)?)|morning|afternoon|evening|night)\s+(?:appointment|booking|job|visit)\b.*$/i,
        ""
      )
      .replace(/\s+for\s+(?:my|this|the)\s+(?:appointment|booking|job|visit)\b.*$/i, "")
      .replace(/^["'\s]+|["'\s]+$/g, "")
      .trim();
  }

  private parseProviderAssistantWindowFromCommand(
    text: string,
    targetOnly = false
  ): "morning" | "afternoon" | "late-afternoon-night" | undefined {
    if (/late afternoon|evening|night/.test(text)) {
      return "late-afternoon-night";
    }

    if (/afternoon/.test(text)) {
      return "afternoon";
    }

    if (/morning/.test(text)) {
      return "morning";
    }

    return targetOnly ? undefined : undefined;
  }

  private async listProviderAssistantCandidates(providerId: string) {
    const [bookings, customers] = await Promise.all([
      this.repository.listBookings(),
      this.repository.listCustomers()
    ]);
    const customerById = new Map(customers.map((customer) => [customer.id, customer]));

    return bookings
      .filter(
        (booking) =>
          booking.providerId === providerId &&
          booking.status !== "cancelled" &&
          booking.status !== "completed" &&
          booking.status !== "refunded" &&
          Date.parse(booking.scheduledStartIso) > Date.now()
      )
      .sort((left, right) => left.scheduledStartIso.localeCompare(right.scheduledStartIso))
      .map((booking) => ({
        ...booking,
        customerName: customerById.get(booking.customerId)?.fullName ?? "Customer"
      }));
  }

  private async listProviderAssistantBookingMatches(
    providerId: string,
    bookingId: string
  ): Promise<CrewMatchCandidate[]> {
    const staffing = await this.getProviderStaffingOverview(providerId);
    return staffing.jobs.find((job) => job.bookingId === bookingId)?.matches ?? [];
  }

  private toProviderAssistantBookingCandidate(booking: Booking & { customerName?: string }): ProviderAssistantBookingCandidate {
    const window = getBookingServiceWindow(booking.scheduledStartIso);
    return {
      bookingId: booking.id,
      customerName: booking.customerName ?? "Customer",
      scheduledStartIso: booking.scheduledStartIso,
      scheduledEndIso: booking.scheduledEndIso,
      currentWindowKey: window.key,
      currentWindowLabel: window.label,
      addressLine: this.formatAddressLine(booking.serviceAddress)
    };
  }

  private toProviderAssistantBookingCandidateFromCalendarEvent(
    event: ProviderCalendarOverviewResponse["events"][number]
  ): ProviderAssistantBookingCandidate | undefined {
    if (event.source !== "yardmatch-booking" || !event.bookingId) {
      return undefined;
    }

    const window = getBookingServiceWindow(event.startIso);
    const addressLine =
      event.addressLine ??
      ([event.city, event.state].filter(Boolean).join(", ") || "Service address");

    return {
      bookingId: event.bookingId,
      customerName: event.customerName ?? "Customer",
      scheduledStartIso: event.startIso,
      scheduledEndIso: event.endIso,
      currentWindowKey: window.key,
      currentWindowLabel: window.label,
      addressLine
    };
  }

  private toProviderAssistantBookingCandidateFromStaffingJob(
    job: ProviderStaffingJobSummary
  ): ProviderAssistantBookingCandidate {
    const window = getBookingServiceWindow(job.scheduledStartIso);
    return {
      bookingId: job.bookingId,
      customerName: job.customerName,
      scheduledStartIso: job.scheduledStartIso,
      scheduledEndIso: job.scheduledEndIso,
      currentWindowKey: window.key,
      currentWindowLabel: window.label,
      addressLine: this.formatAddressLine(job.serviceAddress)
    };
  }

  private getProviderAssistantPendingMatchCount(job: ProviderStaffingJobSummary): number {
    return job.matches.filter((match) => match.status === "pending-provider-review").length;
  }

  private getProviderAssistantUncoveredCrewGap(job: ProviderStaffingJobSummary): number {
    return Math.max(job.crewGap - this.getProviderAssistantPendingMatchCount(job), 0);
  }

  private selectProviderAssistantDispatchFocusWindow(
    targetDay: ProviderCalendarOverviewResponse["dispatchDays"][number]
  ): ProviderCalendarOverviewResponse["dispatchDays"][number]["windowSummaries"][number] | undefined {
    return [...targetDay.windowSummaries].sort((left, right) => {
      const crewGapDelta = right.crewGap - left.crewGap;
      if (crewGapDelta !== 0) {
        return crewGapDelta;
      }

      const bookedDelta = right.bookedMinutes - left.bookedMinutes;
      if (bookedDelta !== 0) {
        return bookedDelta;
      }

      return right.blockedMinutes - left.blockedMinutes;
    })[0];
  }

  private selectProviderAssistantWeekAttentionDay(
    overview: ProviderCalendarOverviewResponse
  ): ProviderCalendarOverviewResponse["dispatchDays"][number] | undefined {
    if (overview.dispatchDays.length === 0) {
      return undefined;
    }

    return [...overview.dispatchDays].sort((left, right) => {
      const routeStatusDelta = this.providerDispatchRoutePriority(right.routeStatus) - this.providerDispatchRoutePriority(left.routeStatus);
      if (routeStatusDelta !== 0) {
        return routeStatusDelta;
      }

      const crewGapDelta = right.crewGap - left.crewGap;
      if (crewGapDelta !== 0) {
        return crewGapDelta;
      }

      const driveDelta = right.estimatedDriveMiles - left.estimatedDriveMiles;
      if (driveDelta !== 0) {
        return driveDelta;
      }

      return right.yardmatchJobCount - left.yardmatchJobCount;
    })[0];
  }

  private providerDispatchRoutePriority(status: ProviderDispatchRouteStatus): number {
    if (status === "overloaded") {
      return 3;
    }

    if (status === "watch") {
      return 2;
    }

    return 1;
  }

  private selectProviderAssistantReliefWindow(
    targetDay: ProviderCalendarOverviewResponse["dispatchDays"][number],
    focusWindow: ProviderCalendarOverviewResponse["dispatchDays"][number]["windowSummaries"][number]
  ): ProviderCalendarOverviewResponse["dispatchDays"][number]["windowSummaries"][number] | undefined {
    const focusPressure = this.calculateProviderAssistantDispatchWindowPressure(focusWindow);
    const bestWindow = [...targetDay.windowSummaries]
      .filter((window) => window.windowKey !== focusWindow.windowKey)
      .sort((left, right) => {
        const pressureDelta =
          this.calculateProviderAssistantDispatchWindowPressure(left) -
          this.calculateProviderAssistantDispatchWindowPressure(right);
        if (pressureDelta !== 0) {
          return pressureDelta;
        }

        return left.yardmatchJobCount - right.yardmatchJobCount;
      })[0];

    if (!bestWindow) {
      return undefined;
    }

    const bestPressure = this.calculateProviderAssistantDispatchWindowPressure(bestWindow);
    return bestPressure + 45 <= focusPressure ? bestWindow : undefined;
  }

  private calculateProviderAssistantDispatchWindowPressure(
    window: ProviderCalendarOverviewResponse["dispatchDays"][number]["windowSummaries"][number]
  ): number {
    return window.crewGap * 240 + window.bookedMinutes + window.blockedMinutes + window.yardmatchJobCount * 45;
  }

  private buildProviderAssistantTargetWindowFromSlot(
    booking: Booking,
    slot: AvailabilitySlot
  ) {
    const durationMs =
      new Date(booking.scheduledEndIso).getTime() - new Date(booking.scheduledStartIso).getTime();
    const start = new Date(slot.startIso);
    return {
      startIso: start.toISOString(),
      endIso: new Date(start.getTime() + durationMs).toISOString()
    };
  }

  private async findProviderAssistantCrossDayReliefSlot(
    providerId: string,
    booking: Booking,
    afterIso: string
  ): Promise<AvailabilitySlot | undefined> {
    const provider = await this.repository.findProviderById(providerId);
    if (!provider) {
      return undefined;
    }

    const durationMinutes = Math.max(
      30,
      (new Date(booking.scheduledEndIso).getTime() - new Date(booking.scheduledStartIso).getTime()) / 60_000
    );
    const providerSlots = this.filterProviderSlotsAgainstExternalBlocks(
      provider,
      await this.repository.listSlotsByProvider(provider.id)
    );
    const candidateSlots = providerSlots.filter(
      (slot) =>
        Date.parse(slot.startIso) >= Date.parse(afterIso) &&
        this.isWithinProviderAcceptanceWindow(provider, slot.startIso)
    );

    return this.schedulingService.findFirstAvailableSlot(candidateSlots, durationMinutes);
  }

  private orderProviderAssistantDispatchAdjustmentCandidates(
    candidates: ProviderAssistantBookingCandidate[],
    sourceWindowKey: BookingServiceWindowKey,
    targetWindowKey?: BookingServiceWindowKey
  ): ProviderAssistantBookingCandidate[] {
    const ordered = [...candidates].sort((left, right) =>
      new Date(left.scheduledStartIso).getTime() - new Date(right.scheduledStartIso).getTime()
    );

    if (!targetWindowKey || targetWindowKey === sourceWindowKey) {
      return ordered.reverse();
    }

    const moveEarlier =
      sourceWindowKey === "late-afternoon-night" ||
      (sourceWindowKey === "afternoon" && targetWindowKey === "morning");
    return moveEarlier ? ordered : ordered.reverse();
  }

  private buildProviderAssistantDispatchBookingCandidates(
    overview: ProviderCalendarOverviewResponse,
    targetDay: ProviderCalendarOverviewResponse["dispatchDays"][number],
    focusWindow?: ProviderCalendarOverviewResponse["dispatchDays"][number]["windowSummaries"][number]
  ): ProviderAssistantBookingCandidate[] {
    const dayStartIso = targetDay.dateIso;
    const dayEndIso = new Date(new Date(targetDay.dateIso).getTime() + 24 * 60 * 60 * 1000).toISOString();

    const dayEvents = overview.events
      .filter(
        (event) =>
          event.source === "yardmatch-booking" &&
          event.bookingId &&
          this.doIntervalsOverlap(event.startIso, event.endIso, dayStartIso, dayEndIso)
      )
      .sort((left, right) => new Date(left.startIso).getTime() - new Date(right.startIso).getTime());

    const focusEvents =
      focusWindow && focusWindow.yardmatchJobCount > 0
        ? dayEvents.filter((event) => getBookingServiceWindow(event.startIso).key === focusWindow.windowKey)
        : dayEvents;

    const candidateEvents = focusEvents.length > 0 ? focusEvents : dayEvents;
    const seenBookingIds = new Set<string>();

    return candidateEvents.flatMap((event) => {
      if (!event.bookingId || seenBookingIds.has(event.bookingId)) {
        return [];
      }

      const candidate = this.toProviderAssistantBookingCandidateFromCalendarEvent(event);
      if (!candidate) {
        return [];
      }

      seenBookingIds.add(event.bookingId);
      return [candidate];
    });
  }

  private buildProviderAssistantDispatchWindow(scope: "today" | "tomorrow" | "next-7-days"): {
    fromIso: string;
    toIso: string;
  } {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    if (scope === "tomorrow") {
      start.setDate(start.getDate() + 1);
    }

    const end = new Date(start);
    end.setDate(end.getDate() + (scope === "next-7-days" ? 7 : 1));
    return {
      fromIso: start.toISOString(),
      toIso: end.toISOString()
    };
  }

  private providerAssistantDispatchScopeLabel(scope: "today" | "tomorrow" | "next-7-days"): string {
    switch (scope) {
      case "tomorrow":
        return "Tomorrow";
      case "next-7-days":
        return "The next 7 days";
      default:
        return "Today";
    }
  }

  private buildProviderAssistantTargetWindow(
    booking: Booking,
    targetWindowKey: "morning" | "afternoon" | "late-afternoon-night"
  ) {
    const durationMs =
      new Date(booking.scheduledEndIso).getTime() - new Date(booking.scheduledStartIso).getTime();
    const start = new Date(booking.scheduledStartIso);

    if (targetWindowKey === "morning") {
      start.setHours(8, 0, 0, 0);
    } else if (targetWindowKey === "afternoon") {
      start.setHours(13, 0, 0, 0);
    } else {
      start.setHours(17, 0, 0, 0);
    }

    if (start.getTime() <= Date.now()) {
      start.setDate(start.getDate() + 1);
    }

    const end = new Date(start.getTime() + durationMs);
    return {
      startIso: start.toISOString(),
      endIso: end.toISOString()
    };
  }

  private buildProviderAssistantLateEta(booking: Booking, lateMinutes: number): string {
    const scheduledStartMs = new Date(booking.scheduledStartIso).getTime();
    const baselineMs = Math.max(scheduledStartMs, Date.now());
    return new Date(baselineMs + lateMinutes * 60 * 1000).toISOString();
  }

  private providerAssistantWindowLabel(windowKey: "morning" | "afternoon" | "late-afternoon-night"): string {
    return windowKey === "late-afternoon-night" ? "Late afternoon / evening" : this.toTitleCase(windowKey);
  }

  private parseProviderAssistantLateMinutes(command: string): number | undefined {
    const match =
      command.match(/(\d+)\s*(minute|minutes|min|mins)\s+late/) ??
      command.match(/late\s+by\s+(\d+)\s*(minute|minutes|min|mins)/) ??
      command.match(/(\d+)\s*(hour|hours|hr|hrs)\s+late/) ??
      command.match(/late\s+by\s+(\d+)\s*(hour|hours|hr|hrs)/);

    if (!match) {
      return undefined;
    }

    const numericValue = Number(match[1]);
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      return undefined;
    }

    return /hour|hours|hr|hrs/.test(match[2] ?? "") ? numericValue * 60 : numericValue;
  }

  private parseProviderAssistantLateReason(command: string): string | undefined {
    const becauseMatch = command.match(/\b(?:because|due to)\b\s+(.+)$/);
    if (becauseMatch?.[1]) {
      return this.toSentenceCase(becauseMatch[1].trim().replace(/[.]+$/, ""));
    }

    const finishingMatch = command.match(/\b(finishing .+)$/);
    if (finishingMatch?.[1]) {
      return this.toSentenceCase(finishingMatch[1].trim().replace(/[.]+$/, ""));
    }

    return undefined;
  }

  public async getUserByIdentity(
    identity: AuthIdentityRecord
  ): Promise<CurrentUserResponse["user"] | undefined> {
    if (identity.role === "customer") {
      return this.repository.findCustomerById(identity.userId);
    }

    if (identity.role === "provider") {
      return this.repository.findProviderById(identity.userId);
    }

    return this.repository.findCrewMemberById(identity.userId);
  }

  public async findAuthIdentityByEmail(email: string): Promise<AuthIdentityRecord | undefined> {
    return this.repository.findAuthIdentityByEmail(email);
  }

  public async findAuthIdentityByProvider(
    provider: "google" | "apple",
    subject: string
  ): Promise<AuthIdentityRecord | undefined> {
    return this.repository.findAuthIdentityByProvider(provider, subject);
  }

  public async findAuthIdentityByUserId(userId: string): Promise<AuthIdentityRecord | undefined> {
    return this.repository.findAuthIdentityByUserId(userId);
  }

  public async updateAuthIdentity(
    userId: string,
    updates: Partial<AuthIdentityRecord>
  ): Promise<AuthIdentityRecord | undefined> {
    return this.repository.updateAuthIdentity(userId, updates);
  }

  public getAppBaseUrl(): string {
    return this.appBaseUrl;
  }

  public getApiBaseUrl(): string {
    return this.apiBaseUrl;
  }

  private async buildProviderStaffingSummaries(
    provider: ProviderProfile
  ): Promise<ProviderStaffingJobSummary[]> {
    await this.reconcileCrewMatches(provider.id);

    const [bookings, customers, matches, crewMembers] = await Promise.all([
      this.repository.listBookings(),
      this.repository.listCustomers(),
      this.repository.listCrewMatches(),
      this.repository.listCrewMembers()
    ]);

    return bookings
      .filter(
        (booking) =>
          booking.providerId === provider.id &&
          (booking.status === "requested" ||
            booking.status === "confirmed" ||
            booking.status === "in-progress" ||
            booking.status === "disputed")
      )
      .map((booking) => {
        const customer = customers.find((item) => item.id === booking.customerId);
        const requiredCrewMembers = this.estimateRequiredCrewMembers(
          booking,
          customer?.properties.find((property) => property.id === booking.servicePropertyId)
        );
        const bookingMatches = matches.filter((match) => match.bookingId === booking.id);
        const acceptedMatches = bookingMatches.filter((match) => match.status === "accepted");
        const assignedCrewMembers = acceptedMatches.length;
        const assignedRouteLeaderCrewMemberId = this.resolveDelegatedCrewRouteLeaderId(booking, acceptedMatches);
        const assignedRouteLeaderCrewMemberName = assignedRouteLeaderCrewMemberId
          ? crewMembers.find((item) => item.id === assignedRouteLeaderCrewMemberId)?.fullName
          : undefined;
        const requiresRouteLeaderAssignment =
          provider.routeLeaderMode === "accepted-crew-fallback" &&
          acceptedMatches.length > 1 &&
          !assignedRouteLeaderCrewMemberId;
        const matchesWithRecommendations = bookingMatches
          .map((match) => {
            const crewMember = crewMembers.find((item) => item.id === match.crewMemberId);
            if (!crewMember) {
              return match;
            }

            const recommendation = this.buildCrewMatchRecommendation({
              crewMember,
              booking,
              provider,
              allBookings: bookings,
              allMatches: matches
            });

            return {
              ...match,
              recommendationScore: recommendation.score,
              recommendationLabel: recommendation.label,
              recommendationReasons: recommendation.reasons
            };
          })
          .sort((left, right) => {
            const scoreDelta = (right.recommendationScore ?? 0) - (left.recommendationScore ?? 0);
            if (scoreDelta !== 0) {
              return scoreDelta;
            }
            return left.distanceMiles - right.distanceMiles;
          });

        return {
          bookingId: booking.id,
          customerName: customer?.fullName ?? "Customer",
          serviceAddress: booking.serviceAddress,
          category: booking.category,
          status: booking.status,
          scheduledStartIso: booking.scheduledStartIso,
          scheduledEndIso: booking.scheduledEndIso,
          assignedRouteLeaderCrewMemberId,
          assignedRouteLeaderCrewMemberName,
          requiresRouteLeaderAssignment,
          onRouteConfirmedAt: booking.onRouteConfirmedAt,
          onRouteConfirmedByCrewMemberId: booking.onRouteConfirmedByCrewMemberId,
          lateNoticeSentAt: booking.lateNoticeSentAt,
          lateEtaIso: booking.lateEtaIso,
          lateReason: booking.lateReason,
          activeExceptionType: booking.activeExceptionType,
          activeExceptionReportedAt: booking.activeExceptionReportedAt,
          activeExceptionNotes: booking.activeExceptionNotes,
          disputedAt: booking.disputedAt,
          disputeReason: booking.disputeReason,
          disputedByRole: booking.disputedByRole,
          beforeEvidenceCount: this.countBookingEvidence(booking, "before"),
          afterEvidenceCount: this.countBookingEvidence(booking, "after"),
          totalCents: booking.totalCents,
          requiredCrewMembers,
          assignedCrewMembers,
          crewGap: Math.max(requiredCrewMembers - assignedCrewMembers, 0),
          matches: matchesWithRecommendations
        };
      })
      .sort((left, right) => left.scheduledStartIso.localeCompare(right.scheduledStartIso));
  }

  private async reconcileCrewMatches(providerId?: string): Promise<void> {
    const [providers, crewMembers, bookings, matches, customers] = await Promise.all([
      this.repository.listProviders(),
      this.repository.listCrewMembers(),
      this.repository.listBookings(),
      this.repository.listCrewMatches(),
      this.repository.listCustomers()
    ]);

    const targetProviders = providerId
      ? providers.filter((provider) => provider.id === providerId)
      : providers;
    const crewDayLoadMap = this.buildCrewDayLoadMap(matches, bookings);

    for (const provider of targetProviders) {
      const providerBookings = bookings.filter(
        (booking) =>
          booking.providerId === provider.id &&
          (booking.status === "requested" || booking.status === "confirmed" || booking.status === "in-progress") &&
          new Date(booking.scheduledStartIso).getTime() > Date.now()
      );

      for (const booking of providerBookings) {
        const property = customers
          .find((customer) => customer.id === booking.customerId)
          ?.properties.find((item) => item.id === booking.servicePropertyId);
        const requiredCrewMembers = this.estimateRequiredCrewMembers(booking, property);
        const bookingMatches = matches.filter((match) => match.bookingId === booking.id);
        const acceptedMatches = bookingMatches.filter((match) => match.status === "accepted");

        if (acceptedMatches.length >= requiredCrewMembers) {
          continue;
        }

        const candidatePool = crewMembers
          .filter((crewMember) =>
            this.isCrewMemberEligibleForBooking(crewMember, booking, matches, bookings, crewDayLoadMap)
          )
          .map((crewMember) => ({
            crewMember,
            recommendation: this.buildCrewMatchRecommendation({
              crewMember,
              booking,
              provider,
              allBookings: bookings,
              allMatches: matches,
              dayLoadCount:
                crewDayLoadMap.get(this.getCrewDayLoadKey(crewMember.id, booking.scheduledStartIso)) ?? 0
            })
          }))
          .sort((left, right) => {
            const scoreDelta = right.recommendation.score - left.recommendation.score;
            if (scoreDelta !== 0) {
              return scoreDelta;
            }

            return (
              this.geoService.distanceMiles(left.crewMember.address, booking.serviceAddress) -
              this.geoService.distanceMiles(right.crewMember.address, booking.serviceAddress)
            );
          });

        const gap = requiredCrewMembers - acceptedMatches.length;
        const existingIds = new Set(bookingMatches.map((match) => match.crewMemberId));
        const nextCandidates = candidatePool
          .filter(({ crewMember }) => !existingIds.has(crewMember.id))
          .slice(0, provider.staffingMode === "auto-accept" ? gap : Math.max(3, gap));

        for (const { crewMember } of nextCandidates) {
          const distanceMiles = Number(
            this.geoService.distanceMiles(crewMember.address, booking.serviceAddress).toFixed(1)
          );
          const status = provider.staffingMode === "auto-accept" ? "accepted" : "pending-provider-review";
          await this.repository.createCrewMatch({
            id: crypto.randomUUID(),
            bookingId: booking.id,
            providerId: provider.id,
            crewMemberId: crewMember.id,
            crewMemberName: crewMember.fullName,
            crewMemberPhone: crewMember.phone,
            categories: crewMember.categories,
            availableWeekdays: crewMember.availableWeekdays ?? ["Mon", "Tue", "Wed", "Thu", "Fri"],
            preferredSchedule: crewMember.preferredSchedule,
            willingToTravelMiles: crewMember.willingToTravelMiles,
            hasOwnEquipment: crewMember.hasOwnEquipment,
            winterWorkEnabled: crewMember.winterWorkEnabled ?? true,
            status,
            autoAccepted: provider.staffingMode === "auto-accept",
            distanceMiles,
            hourlyRateCents: this.estimateCrewHourlyRate(booking.category),
            createdAt: new Date().toISOString(),
            reviewedAt: provider.staffingMode === "auto-accept" ? new Date().toISOString() : undefined
          });
          const crewDayLoadKey = this.getCrewDayLoadKey(crewMember.id, booking.scheduledStartIso);
          crewDayLoadMap.set(crewDayLoadKey, (crewDayLoadMap.get(crewDayLoadKey) ?? 0) + 1);

          await this.createNotification({
            recipientId: crewMember.id,
            recipientRole: "crew-member",
            category: "staffing",
            title:
              provider.staffingMode === "auto-accept"
                ? "You were auto-matched to a job"
                : "You have a new crew match",
            body:
              provider.staffingMode === "auto-accept"
                ? `${provider.companyName} automatically assigned you to an upcoming ${this.titleCaseCategory(booking.category)} job.`
                : `${provider.companyName} is reviewing you for an upcoming ${this.titleCaseCategory(booking.category)} job.`,
            actionHref: "/crew/schedule"
          });

          if (provider.staffingMode === "auto-accept") {
            await this.refreshCrewMemberStatus(crewMember.id);
          }
        }
      }
    }
  }

  private async refreshCrewMemberStatus(crewMemberId: string): Promise<void> {
    const crewMember = await this.repository.findCrewMemberById(crewMemberId);
    if (!crewMember) {
      return;
    }

    const matches = await this.repository.listCrewMatches();
    const hasAcceptedFutureMatch = matches.some(
      (match) =>
        match.crewMemberId === crewMemberId &&
        match.status === "accepted" &&
        new Date(match.createdAt).getTime() > Date.now() - 90 * 24 * 60 * 60 * 1000
    );

    await this.repository.updateCrewMember(crewMemberId, {
      status: hasAcceptedFutureMatch ? "assigned" : "available"
    });
  }

  private isCrewMemberEligibleForBooking(
    crewMember: CrewMemberProfile,
    booking: Booking,
    allMatches: CrewMatchCandidate[],
    allBookings: Booking[],
    crewDayLoadMap?: Map<string, number>
  ): boolean {
    if (!crewMember.categories.includes(booking.category)) {
      return false;
    }

    const distanceMiles = this.geoService.distanceMiles(crewMember.address, booking.serviceAddress);
    if (distanceMiles > crewMember.willingToTravelMiles) {
      return false;
    }

    const day = this.isoToAvailabilityDay(booking.scheduledStartIso);
    if (!(crewMember.availableWeekdays ?? ["Mon", "Tue", "Wed", "Thu", "Fri"]).includes(day)) {
      return false;
    }

    if (
      (booking.category === "snow-shoveling" ||
        booking.category === "snow-blowing" ||
        booking.category === "ice-melt-salting") &&
      !(crewMember.winterWorkEnabled ?? true)
    ) {
      return false;
    }

    const acceptedBookedJobs = this.getAcceptedCrewBookings(crewMember.id, allMatches, allBookings);
    const hasConflictingAcceptedJob = acceptedBookedJobs.some(
      (acceptedBooking) =>
        acceptedBooking.id !== booking.id &&
        this.doIntervalsOverlap(
          acceptedBooking.scheduledStartIso,
          acceptedBooking.scheduledEndIso,
          booking.scheduledStartIso,
          booking.scheduledEndIso
        )
    );

    if (hasConflictingAcceptedJob) {
      return false;
    }

    return crewMember.status !== "off-duty";
  }

  private buildCrewMatchRecommendation(input: {
    crewMember: CrewMemberProfile;
    booking: Booking;
    provider: ProviderProfile;
    allBookings: Booking[];
    allMatches: CrewMatchCandidate[];
    dayLoadCount?: number;
  }): {
    score: number;
    label: "best-fit" | "good-fit" | "backup";
    reasons: string[];
  } {
    const { crewMember, booking, provider, allBookings, allMatches } = input;
    const distanceMiles = this.geoService.distanceMiles(crewMember.address, booking.serviceAddress);
    const acceptedCrewBookings = this.getAcceptedCrewBookings(crewMember.id, allMatches, allBookings);
    const sameDayAcceptedBookings = acceptedCrewBookings.filter(
      (candidate) =>
        this.localDateKey(candidate.scheduledStartIso) === this.localDateKey(booking.scheduledStartIso) &&
        candidate.id !== booking.id
    );
    const sameDayLoadCount =
      input.dayLoadCount ??
      this.getCrewSameDayLoadCount(crewMember.id, booking.scheduledStartIso, allMatches, allBookings);
    const priorProviderAssignments = acceptedCrewBookings.filter(
      (candidate) => candidate.providerId === provider.id && candidate.id !== booking.id
    ).length;
    const reliabilityPenalty = Math.min((crewMember.cancellationCount ?? 0) * 4, 12);
    const scoreParts = {
      distance: Math.round(Math.max(0, 1 - distanceMiles / Math.max(crewMember.willingToTravelMiles, 1)) * 28),
      schedulePreference: this.getSchedulePreferenceScore(crewMember.preferredSchedule),
      reliability: Math.max(
        0,
        Math.round((crewMember.rating / 5) * 12 + (Math.min(crewMember.completedJobs, 150) / 150) * 10) -
          reliabilityPenalty
      ),
      providerFamiliarity:
        crewMember.assignedProviderId === provider.id ? 12 : Math.min(priorProviderAssignments * 4, 10),
      workload:
        sameDayLoadCount === 0 ? 14 : sameDayLoadCount === 1 ? 9 : sameDayLoadCount === 2 ? 3 : -16,
      equipment:
        this.categoryBenefitsFromEquipmentOwnership(booking.category) && crewMember.hasOwnEquipment ? 8 : 0
    };

    const score = Math.max(
      0,
      scoreParts.distance +
        scoreParts.schedulePreference +
        scoreParts.reliability +
        scoreParts.providerFamiliarity +
        scoreParts.workload +
        scoreParts.equipment
    );

    const reasons: string[] = [];
    if ((crewMember.cancellationCount ?? 0) > 0) {
      reasons.push("Recent call-offs lower future match priority");
    }
    if (scoreParts.schedulePreference >= 14) {
      reasons.push("Has strong availability capacity for new jobs");
    }
    if (distanceMiles <= 5) {
      reasons.push("Very close to the property");
    }
    if (scoreParts.providerFamiliarity >= 8) {
      reasons.push("Already familiar with this business");
    }
    if (sameDayLoadCount === 0) {
      reasons.push("Open capacity on this day");
    } else if (sameDayLoadCount === 1) {
      reasons.push("Can still fit this route into the same day");
    } else if (sameDayLoadCount === 2) {
      reasons.push("Already carrying a fuller day than other crew");
    } else if (sameDayLoadCount >= 3) {
      reasons.push("Heavy same-day load, keep as a fallback only");
    }
    if (scoreParts.equipment > 0) {
      reasons.push("Brings equipment that helps on this job");
    }
    if (crewMember.rating >= 4.8 && crewMember.completedJobs >= 25) {
      reasons.push("Strong reliability history");
    }
    if (reasons.length === 0) {
      reasons.push("Matches the service and area");
    }

    return {
      score,
      label: score >= 60 ? "best-fit" : score >= 42 ? "good-fit" : "backup",
      reasons: reasons.slice(0, 3)
    };
  }

  private getAcceptedCrewBookings(
    crewMemberId: string,
    allMatches: CrewMatchCandidate[],
    allBookings: Booking[]
  ): Booking[] {
    const acceptedBookingIds = new Set(
      allMatches
        .filter((match) => match.crewMemberId === crewMemberId && match.status === "accepted")
        .map((match) => match.bookingId)
    );

    return allBookings.filter((booking) => acceptedBookingIds.has(booking.id));
  }

  private getCrewSameDayLoadCount(
    crewMemberId: string,
    scheduledStartIso: string,
    allMatches: CrewMatchCandidate[],
    allBookings: Booking[]
  ): number {
    const dayKey = this.localDateKey(scheduledStartIso);
    const bookingIds = new Set(
      allMatches
        .filter(
          (match) =>
            match.crewMemberId === crewMemberId &&
            (match.status === "accepted" || match.status === "pending-provider-review")
        )
        .map((match) => match.bookingId)
    );

    return allBookings.filter(
      (booking) => bookingIds.has(booking.id) && this.localDateKey(booking.scheduledStartIso) === dayKey
    ).length;
  }

  private buildCrewDayLoadMap(allMatches: CrewMatchCandidate[], allBookings: Booking[]): Map<string, number> {
    const loadMap = new Map<string, number>();
    for (const match of allMatches) {
      if (match.status !== "accepted" && match.status !== "pending-provider-review") {
        continue;
      }

      const booking = allBookings.find((item) => item.id === match.bookingId);
      if (!booking) {
        continue;
      }

      const key = this.getCrewDayLoadKey(match.crewMemberId, booking.scheduledStartIso);
      loadMap.set(key, (loadMap.get(key) ?? 0) + 1);
    }

    return loadMap;
  }

  private getCrewDayLoadKey(crewMemberId: string, scheduledStartIso: string): string {
    return `${crewMemberId}:${this.localDateKey(scheduledStartIso)}`;
  }

  private getSchedulePreferenceScore(preference: CrewMemberSchedulePreference): number {
    switch (preference) {
      case "full-time":
        return 16;
      case "flex":
        return 12;
      case "part-time":
        return 8;
      case "seasonal":
        return 5;
    }
  }

  private categoryBenefitsFromEquipmentOwnership(category: Booking["category"]): boolean {
    return (
      category === "mulch-installation" ||
      category === "gutter-cleaning" ||
      category === "snow-blowing" ||
      category === "leaf-blowing"
    );
  }

  private estimateRequiredCrewMembers(booking: Booking, property?: CustomerProperty): number {
    const baseByCategory: Record<Booking["category"], number> = {
      "lawn-mowing": 1,
      "hedge-trimming": 1,
      "mulch-installation": 2,
      "seasonal-cleanup": 2,
      "weed-control": 1,
      "irrigation-check": 1,
      "leaf-blowing": 1,
      "aeration": 1,
      "fertilization": 1,
      "gutter-cleaning": 2,
      "snow-shoveling": 2,
      "ice-melt-salting": 1,
      "snow-blowing": 2
    };

    let crewSize = baseByCategory[booking.category] ?? 1;
    if (property?.lawnSizeSqFt && property.lawnSizeSqFt > 5000) {
      crewSize += 1;
    }
    if (property?.shrubBedSqFt && property.shrubBedSqFt > 900) {
      crewSize += 1;
    }

    return Math.min(crewSize, 4);
  }

  private isoToAvailabilityDay(iso: string): CrewAvailabilityDay {
    return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
      new Date(iso).getDay()
    ] as CrewAvailabilityDay;
  }

  private assertCanAccessConversation(
    actor: AuthIdentityRecord,
    thread: ProviderCrewConversation
  ): void {
    const canAccess =
      (actor.role === "provider" && actor.userId === thread.providerId) ||
      (actor.role === "crew-member" && actor.userId === thread.crewMemberId);

    if (!canAccess) {
      throw new HttpError(403, "You cannot access this conversation");
    }
  }

  private assertCanAccessCustomerProviderConversation(
    actor: AuthIdentityRecord,
    thread: CustomerProviderConversation
  ): void {
    const canAccess =
      (actor.role === "customer" && actor.userId === thread.customerId) ||
      (actor.role === "provider" && actor.userId === thread.providerId);

    if (!canAccess) {
      throw new HttpError(403, "You cannot access this conversation");
    }
  }

  private assertCustomerCanManageBooking(customerId: string, booking: Booking): void {
    if (booking.customerId !== customerId) {
      throw new Error("Only the booking customer can manage this booking");
    }
  }

  private canCustomerCancelOrReschedule(booking: Booking): boolean {
    if (!(booking.status === "requested" || booking.status === "confirmed")) {
      return false;
    }

    return new Date(booking.scheduledStartIso).getTime() > Date.now();
  }

  // Review validation stays centralized here so web and mobile both inherit the same rule set.
  private assertReviewScore(score: number, fieldName: string): void {
    if (!Number.isInteger(score) || score < 1 || score > 5) {
      throw new Error(`${fieldName} must be an integer from 1 to 5`);
    }
  }

  private calculateAverageRating(
    reviews: ProviderReview[],
    field: "overallRating" | "timelinessRating" | "attentionToDetailRating"
  ): number {
    if (reviews.length === 0) {
      return 0;
    }

    const total = reviews.reduce((sum, review) => sum + review[field], 0);
    return Number((total / reviews.length).toFixed(1));
  }

  private buildReviewInvite(booking: Booking, email: string, completedAt: string): ReviewInvite {
    const scheduledSendIso = this.addHours(completedAt, MarketplacePlatformService.reviewInviteDelayHours);
    const expiresAtIso = this.addDays(scheduledSendIso, MarketplacePlatformService.reviewInviteExpiryDays);

    return {
      id: crypto.randomUUID(),
      bookingId: booking.id,
      customerId: booking.customerId,
      providerId: booking.providerId,
      email,
      status: "scheduled",
      channels: ["email", "in-app"],
      scheduledSendIso,
      expiresAtIso,
      deepLinkPath: `/bookings/${booking.id}/review`
    };
  }

  private async buildReviewOpportunity(
    booking: Booking,
    now: Date
  ): Promise<CustomerReviewOpportunity | undefined> {
    const provider = await this.repository.findProviderById(booking.providerId);
    if (!provider) {
      return undefined;
    }

    const review = await this.repository.findProviderReviewByBookingId(booking.id);
    const invite = await this.getResolvedReviewInvite(booking.id, now);

    if (review) {
      return {
        bookingId: booking.id,
        providerId: booking.providerId,
        providerName: provider.companyName,
        category: booking.category,
        completedAt: booking.completedAt,
        inviteStatus: invite?.status,
        inviteScheduledSendIso: invite?.scheduledSendIso,
        inviteSentAt: invite?.sentAt,
        reviewSubmittedAt: review.createdAt,
        canReviewNow: false,
        reviewAlreadySubmitted: true,
        reason: "Review already submitted for this completed booking."
      };
    }

    if (!invite) {
      return {
        bookingId: booking.id,
        providerId: booking.providerId,
        providerName: provider.companyName,
        category: booking.category,
        completedAt: booking.completedAt,
        canReviewNow: false,
        reviewAlreadySubmitted: false,
        reason: "The review invite has not been scheduled yet."
      };
    }

    if (invite.status === "scheduled") {
      return {
        bookingId: booking.id,
        providerId: booking.providerId,
        providerName: provider.companyName,
        category: booking.category,
        completedAt: booking.completedAt,
        inviteStatus: invite.status,
        inviteScheduledSendIso: invite.scheduledSendIso,
        canReviewNow: false,
        reviewAlreadySubmitted: false,
        reason: "A review email is scheduled for 48 hours after service completion."
      };
    }

    if (invite.status === "expired") {
      return {
        bookingId: booking.id,
        providerId: booking.providerId,
        providerName: provider.companyName,
        category: booking.category,
        completedAt: booking.completedAt,
        inviteStatus: invite.status,
        inviteScheduledSendIso: invite.scheduledSendIso,
        inviteSentAt: invite.sentAt,
        canReviewNow: false,
        reviewAlreadySubmitted: false,
        reason: "The review window has expired for this booking."
      };
    }

    return {
      bookingId: booking.id,
      providerId: booking.providerId,
      providerName: provider.companyName,
      category: booking.category,
      completedAt: booking.completedAt,
      inviteStatus: invite.status,
      inviteScheduledSendIso: invite.scheduledSendIso,
      inviteSentAt: invite.sentAt,
      canReviewNow: invite.status === "sent" || invite.status === "opened",
      reviewAlreadySubmitted: false,
      reason: "Review is unlocked from the booking-specific invite only."
    };
  }

  private async getActiveReviewInviteOrThrow(bookingId: string): Promise<ReviewInvite> {
    const invite = await this.getResolvedReviewInvite(bookingId, new Date());

    if (!invite) {
      throw new Error("No review invite exists for this booking");
    }

    if (invite.status !== "sent" && invite.status !== "opened") {
      throw new Error("The review invite is not active yet");
    }

    return invite;
  }

  private async getResolvedReviewInvite(bookingId: string, now: Date): Promise<ReviewInvite | undefined> {
    const invite = await this.repository.findReviewInviteByBookingId(bookingId);
    if (!invite) {
      return undefined;
    }

    if (
      invite.status !== "completed" &&
      invite.status !== "expired" &&
      new Date(invite.expiresAtIso).getTime() <= now.getTime()
    ) {
      return this.repository.updateReviewInvite(invite.id, {
        status: "expired"
      });
    }

    return invite;
  }

  private addHours(iso: string, hours: number): string {
    return new Date(new Date(iso).getTime() + hours * 60 * 60 * 1000).toISOString();
  }

  private addDays(iso: string, days: number): string {
    return new Date(new Date(iso).getTime() + days * 24 * 60 * 60 * 1000).toISOString();
  }

  private async buildRecurringServicePlanSummary(planId: string): Promise<RecurringServicePlanSummary> {
    const plan = await this.repository.findRecurringServicePlanById(planId);
    if (!plan) {
      throw new HttpError(404, "Recurring plan not found");
    }

    const [provider, allBookings] = await Promise.all([
      this.repository.findProviderById(plan.providerId),
      this.repository.listBookings()
    ]);

    const planBookings = allBookings
      .filter((booking) => booking.recurringPlanId === plan.id)
      .sort((left, right) => left.scheduledStartIso.localeCompare(right.scheduledStartIso));

    const upcomingBooking = planBookings.find(
      (booking) =>
        booking.status !== "cancelled" &&
        booking.status !== "completed" &&
        booking.status !== "refunded"
    );

    return {
      plan,
      providerName: provider?.companyName ?? "Landscaping business",
      upcomingBooking,
      completedOccurrenceCount: planBookings.filter((booking) => booking.status === "completed").length,
      activeOccurrenceCount: planBookings.filter((booking) =>
        booking.status === "requested" ||
        booking.status === "confirmed" ||
        booking.status === "in-progress" ||
        booking.status === "disputed"
      ).length
    };
  }

  private async scheduleNextRecurringBookingIfNeeded(completedBooking: Booking): Promise<void> {
    if (!completedBooking.recurringPlanId) {
      return;
    }

    const plan = await this.repository.findRecurringServicePlanById(completedBooking.recurringPlanId);
    if (!plan || plan.status !== "active") {
      return;
    }

    const allBookings = await this.repository.listBookings();
    const hasUpcomingRecurringBooking = allBookings.some(
      (booking) =>
        booking.recurringPlanId === plan.id &&
        booking.id !== completedBooking.id &&
        booking.status !== "cancelled" &&
        booking.status !== "completed" &&
        booking.status !== "refunded"
    );

    if (hasUpcomingRecurringBooking) {
      return;
    }

    const nextStartIso = this.shiftRecurringIso(completedBooking.scheduledStartIso, plan.frequency);
    const nextEndIso = this.shiftRecurringIso(completedBooking.scheduledEndIso, plan.frequency);
    const attemptAt = new Date().toISOString();

    try {
      const nextBooking = await this.createBookingRecord(
        plan.customerId,
        {
          providerId: plan.providerId,
          serviceAddress: plan.serviceAddress,
          servicePropertyId: plan.servicePropertyId,
          category: plan.category,
          scheduledStartIso: nextStartIso,
          scheduledEndIso: nextEndIso,
          notes: plan.notes,
          totalCents: plan.totalCents
        },
        {
          recurringPlanId: plan.id,
          recurringOccurrenceIndex: (completedBooking.recurringOccurrenceIndex ?? 1) + 1,
          providerNotificationTitle: "Next recurring visit requested",
          providerNotificationBody: `The next ${this.describeRecurringFrequency(plan.frequency)} ${this.titleCaseCategory(
            plan.category
          ).toLowerCase()} visit was queued for ${this.formatBookingWindowWithDate(nextStartIso)}.`,
          skipProviderAvailabilityCheck: true,
          skipRequestedFunnelEvent: true
        }
      );

      await this.repository.updateRecurringServicePlan(plan.id, {
        lastGeneratedBookingId: nextBooking.id,
        lastGeneratedAt: nextBooking.requestedAt,
        lastSchedulingAttemptAt: attemptAt,
        lastSchedulingError: undefined
      });

      await this.createNotification({
        recipientId: plan.customerId,
        recipientRole: "customer",
        category: "booking",
        title: "Next recurring visit scheduled",
        body: `Your next ${this.describeRecurringFrequency(plan.frequency)} ${this.titleCaseCategory(
          plan.category
        ).toLowerCase()} visit was queued for ${this.formatBookingWindowWithDate(nextStartIso)}.`,
        actionHref: "/customer/dashboard"
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "We could not queue the next recurring visit automatically.";

      await this.repository.updateRecurringServicePlan(plan.id, {
        lastSchedulingAttemptAt: attemptAt,
        lastSchedulingError: message
      });

      await this.createNotification({
        recipientId: plan.customerId,
        recipientRole: "customer",
        category: "booking",
        title: "Recurring plan needs review",
        body: `We could not automatically queue the next ${this.describeRecurringFrequency(
          plan.frequency
        )} visit. ${message}`,
        actionHref: "/customer/dashboard"
      });
    }
  }

  private shiftRecurringIso(iso: string, frequency: RecurringServicePlan["frequency"]): string {
    return this.addDays(iso, frequency === "biweekly" ? 14 : 7);
  }

  private describeRecurringFrequency(frequency: RecurringServicePlan["frequency"]): string {
    return frequency === "biweekly" ? "every 2 weeks" : "every week";
  }

  private titleCaseCategory(category: Booking["category"]): string {
    return category
      .split("-")
      .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
      .join(" ");
  }

  private countBookingEvidence(booking: Booking, phase: BookingEvidenceEntry["phase"]): number {
    return booking.serviceEvidence.filter(
      (evidence) => evidence.phase === phase && evidence.evidenceType === "photo"
    ).length;
  }

  private buildSupportEvidenceSummary(booking: Booking) {
    const reviewed = booking.serviceEvidence.filter((evidence) => Boolean(evidence.reviewStatus));
    return {
      photoCount: booking.serviceEvidence.filter((evidence) => evidence.evidenceType === "photo").length,
      noteCount: booking.serviceEvidence.filter((evidence) => evidence.evidenceType === "note").length,
      checklistCount: booking.serviceEvidence.filter((evidence) => evidence.evidenceType === "checklist").length,
      reviewedCount: reviewed.length,
      unreviewedCount: booking.serviceEvidence.length - reviewed.length,
      supportsProviderCount: reviewed.filter((evidence) => evidence.reviewStatus === "supports-provider").length,
      supportsCustomerCount: reviewed.filter((evidence) => evidence.reviewStatus === "supports-customer").length,
      inconclusiveCount: reviewed.filter((evidence) => evidence.reviewStatus === "inconclusive").length
    };
  }

  private buildSupportResolutionGuidance(
    ticket: SupportTicket,
    booking: Booking,
    payment: PaymentRecord | undefined,
    evidenceSummary: SupportOpsTicket["evidenceSummary"]
  ) {
    if (!evidenceSummary) {
      return undefined;
    }

    if (evidenceSummary.reviewedCount === 0) {
      return {
        confidence: "low" as const,
        rationale: "No reviewed evidence yet. Start by annotating the strongest booking evidence before resolving."
      } satisfies NonNullable<SupportOpsTicket["resolutionGuidance"]>;
    }

    const providerLead = evidenceSummary.supportsProviderCount - evidenceSummary.supportsCustomerCount;
    const customerLead = evidenceSummary.supportsCustomerCount - evidenceSummary.supportsProviderCount;
    const refundOpen = payment?.refundReviewStatus === "requested";

    if (customerLead >= 2 || (customerLead >= 1 && ticket.issueType === "billing")) {
      const confidence: "high" | "medium" = customerLead >= 2 ? "high" : "medium";
      return {
        recommendedAction: refundOpen ? "approve-refund" : "cancel-booking",
        confidence,
        rationale:
          "Reviewed evidence currently leans toward the customer, so ops should consider a customer-favoring resolution."
      } satisfies NonNullable<SupportOpsTicket["resolutionGuidance"]>;
    }

    if (providerLead >= 2 || (providerLead >= 1 && booking.status === "disputed")) {
      const confidence: "high" | "medium" = providerLead >= 2 ? "high" : "medium";
      return {
        recommendedAction: refundOpen ? "deny-refund" : "restore-active-booking",
        confidence,
        rationale:
          "Reviewed evidence currently leans toward the provider, so ops should consider restoring the job or keeping payment in place."
      } satisfies NonNullable<SupportOpsTicket["resolutionGuidance"]>;
    }

    return {
      confidence: "low" as const,
      rationale:
        "Reviewed evidence is mixed or inconclusive. Add more evidence review notes or use a manual ops intervention before resolving."
    } satisfies NonNullable<SupportOpsTicket["resolutionGuidance"]>;
  }

  private localDateKey(iso: string): string {
    const date = new Date(iso);
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  private getServiceWindowKey(iso: string): "morning" | "afternoon" | "late-afternoon-night" {
    const hour = new Date(iso).getHours();
    if (hour < 12) {
      return "morning";
    }
    if (hour < 16) {
      return "afternoon";
    }
    return "late-afternoon-night";
  }

  private buildSearchProviderRanking(
    payload: SearchProvidersRequest,
    provider: ProviderProfile,
    providerBookings: Booking[],
    distanceMiles: number,
    suggestedSlot?: AvailabilitySlot,
    providerDecisionMetrics?: {
      confirmations: number;
      declines: number;
    }
  ): SearchProviderResult {
    const matchedCategories = payload.categories.filter((category) => provider.categories.includes(category));
    const requestedCategoryCount = Math.max(payload.categories.length, 1);
    const providerCategoryCount = Math.max(provider.categories.length, 1);
    const completedBookings = providerBookings.filter((booking) => booking.status === "completed").length;
    const nearbyCompletedBookings = providerBookings.filter(
      (booking) =>
        booking.status === "completed" &&
        booking.serviceAddress.city === payload.address.city &&
        booking.serviceAddress.state === payload.address.state
    ).length;
    const disputedBookings = providerBookings.filter((booking) => booking.status === "disputed").length;
    const refundedBookings = providerBookings.filter((booking) => booking.status === "refunded").length;
    const activeExceptionBookings = providerBookings.filter((booking) => Boolean(booking.activeExceptionType)).length;
    const nonRequestedActiveBookings = providerBookings.filter(
      (booking) => booking.status !== "requested" && booking.status !== "cancelled"
    );
    const lateNoticeCount = providerBookings.filter((booking) => Boolean(booking.lateNoticeSentAt)).length;
    const lateNoticeRate = lateNoticeCount / Math.max(nonRequestedActiveBookings.length, 1);
    const providerConfirmations = providerDecisionMetrics?.confirmations ?? 0;
    const providerDeclines = providerDecisionMetrics?.declines ?? 0;
    const providerDecisionCount = providerConfirmations + providerDeclines;
    const providerAcceptanceRate =
      providerDecisionCount > 0 ? providerConfirmations / providerDecisionCount : undefined;
    const adjustedAcceptanceScore =
      providerDecisionCount === 0
        ? 0.78
        : providerDecisionCount < 5
          ? 0.78 + ((providerAcceptanceRate ?? 0.78) - 0.78) * (providerDecisionCount / 5)
          : providerAcceptanceRate ?? 0.78;
    const rawLateScore = Math.max(0, 1 - lateNoticeRate);
    const adjustedLateScore =
      nonRequestedActiveBookings.length < 5
        ? 0.84 + (rawLateScore - 0.84) * (nonRequestedActiveBookings.length / 5)
        : rawLateScore;
    const issueRate =
      (disputedBookings + refundedBookings + activeExceptionBookings) /
      Math.max(providerBookings.length, 1);
    const specializationFocus =
      matchedCategories.length === 0
        ? 0
        : Math.min(
            1,
            matchedCategories.length / providerCategoryCount +
              (providerCategoryCount <= requestedCategoryCount + 1
                ? 0.3
                : providerCategoryCount <= requestedCategoryCount + 3
                  ? 0.15
                  : 0)
          );

    const factors = {
      serviceFit: Math.round((matchedCategories.length / requestedCategoryCount) * 22),
      specialization: Math.round(specializationFocus * 10),
      distance: Math.round(
        Math.max(0, 1 - distanceMiles / Math.max(provider.serviceRadiusMiles, 1)) * 20
      ),
      reliability: Math.round(
        (provider.rating / 5) * 16 +
          (provider.timelinessRating / 5) * 12 +
          (provider.attentionToDetailRating / 5) * 8 +
          (Math.min(provider.reviewCount, 100) / 100) * 4 +
          (Math.min(completedBookings, 75) / 75) * 5
      ),
      operationalReliability: Math.round(adjustedAcceptanceScore * 7 + adjustedLateScore * 5),
      experience: Math.round((Math.min(provider.yearsExperience, 15) / 15) * 6),
      availability: suggestedSlot ? 8 : 0,
      sponsorship: provider.sponsoredListingEnabled ? 5 : 0,
      issuePenalty: Math.round(
        Math.min(disputedBookings * 5 + refundedBookings * 4 + activeExceptionBookings * 3 + issueRate * 12, 20)
      )
    };

    const score = Math.max(
      0,
        factors.serviceFit +
        factors.specialization +
        factors.distance +
        factors.reliability +
        factors.operationalReliability +
        factors.experience +
        factors.availability +
        factors.sponsorship -
        factors.issuePenalty
    );

    const reasons: string[] = [];
    if (suggestedSlot) {
      reasons.push("Open route window available");
    }
    if (
      matchedCategories.length === payload.categories.length &&
      payload.categories.length > 0 &&
      (payload.categories.length > 1 || factors.specialization < 7)
    ) {
      reasons.push(
        payload.categories.length > 1 ? "Covers all requested services" : "Matches the requested service"
      );
    }
    if (factors.specialization >= 7) {
      reasons.push(
        payload.categories.length > 1
          ? "Focused on this mix of services"
          : "Focused on this type of service"
      );
    }
    if (distanceMiles <= 5) {
      reasons.push("Close to the property");
    }
    if (provider.timelinessRating >= 4.8) {
      reasons.push("High punctuality rating");
    }
    if (providerDecisionCount >= 5 && (providerAcceptanceRate ?? 0) >= 0.9) {
      reasons.push("Usually accepts matching requests");
    }
    if (nonRequestedActiveBookings.length >= 5 && lateNoticeRate <= 0.08) {
      reasons.push("Rarely sends late updates");
    }
    if (provider.rating >= 4.8 && provider.reviewCount >= 50) {
      reasons.push("Strong reliability and review history");
    }
    if (provider.yearsExperience >= 10) {
      reasons.push("Deep local experience");
    }
    if (provider.sponsoredListingEnabled) {
      reasons.push("Sponsored placement");
    }
    if (reasons.length === 0) {
      reasons.push("Serves this property area");
    }

    const availabilityConfidence = suggestedSlot
      ? nearbyCompletedBookings >= 5 || distanceMiles <= 6
        ? "high"
        : "medium"
      : "low";
    const availabilityConfidenceLabel =
      availabilityConfidence === "high"
        ? "High confidence in this window"
        : availabilityConfidence === "medium"
          ? "Good chance this window holds"
          : "No live route window right now";
    const hasWeakOperationalSignals =
      providerDecisionCount >= 5 && (providerAcceptanceRate ?? 1) < 0.75
        ? true
        : nonRequestedActiveBookings.length >= 5 && lateNoticeRate > 0.2;
    const reliabilityLabel =
      factors.issuePenalty >= 5 ||
      provider.timelinessRating < 4.4 ||
      provider.rating < 4.4 ||
      hasWeakOperationalSignals
        ? "Reliability record trails the top match"
        : provider.rating >= 4.85 &&
            provider.timelinessRating >= 4.8 &&
            (provider.reviewCount >= 50 || completedBookings >= 25) &&
            factors.issuePenalty === 0 &&
            factors.operationalReliability >= 10
          ? "Proven dependable track record"
        : provider.rating >= 4.7 &&
            provider.timelinessRating >= 4.7 &&
            (provider.reviewCount >= 20 || completedBookings >= 10) &&
            factors.issuePenalty <= 2 &&
            factors.operationalReliability >= 8
            ? "Consistently strong service history"
          : provider.reviewCount >= 5 || completedBookings >= 3
              ? "Solid early reliability signs"
              : "Still building a YardMatch track record";
    const reliabilityDetail =
      factors.issuePenalty >= 5 || provider.timelinessRating < 4.4 || provider.rating < 4.4 || hasWeakOperationalSignals
        ? `${provider.companyName} still qualifies for the area, but GreenRain ranks it below the top recommendation because its recent reliability signals are weaker${
            providerDecisionCount >= 5 && (providerAcceptanceRate ?? 1) < 0.75
              ? ", including a higher recent request-decline rate"
              : nonRequestedActiveBookings.length >= 5 && lateNoticeRate > 0.2
                ? ", including more late updates than the strongest matches"
                : ""
          }.`
        : provider.rating >= 4.85 &&
            provider.timelinessRating >= 4.8 &&
            (provider.reviewCount >= 50 || completedBookings >= 25) &&
            factors.issuePenalty === 0 &&
            factors.operationalReliability >= 10
          ? `${provider.companyName} pairs strong reviews with on-time performance, a larger completed-job history, and steady booking follow-through.`
          : provider.rating >= 4.7 &&
              provider.timelinessRating >= 4.7 &&
              (provider.reviewCount >= 20 || completedBookings >= 10) &&
              factors.issuePenalty <= 2 &&
              factors.operationalReliability >= 8
            ? `${provider.companyName} has a healthy mix of customer reviews, punctuality, completed work history, and stable booking follow-through.`
            : provider.reviewCount >= 5 || completedBookings >= 3
              ? `${provider.companyName} has enough completed work and customer feedback to show encouraging reliability signs, even if the history is lighter than the top match.`
              : `${provider.companyName} is still building up more completed work and customer feedback on YardMatch.`;
    const neighborhoodFamiliarityLabel =
      nearbyCompletedBookings >= 10
        ? "Works this area every week"
        : nearbyCompletedBookings >= 4
          ? "Knows this neighborhood well"
          : nearbyCompletedBookings >= 1
            ? "Has already served this area"
            : "Ready to take work in this area";
    const neighborhoodFamiliarityDetail =
      nearbyCompletedBookings >= 1
        ? `${provider.companyName} has completed ${nearbyCompletedBookings} YardMatch job${
            nearbyCompletedBookings === 1 ? "" : "s"
          } in ${payload.address.city}.`
        : `${provider.companyName} serves ${payload.address.city} within a ${provider.serviceRadiusMiles}-mile route radius.`;

    return {
      provider,
      score,
      distanceMiles: Number(distanceMiles.toFixed(1)),
      hasOpenSlot: Boolean(suggestedSlot),
      suggestedSlot,
      reasons: reasons.slice(0, 3),
      completedJobCount: completedBookings,
      nearbyCompletedJobCount: nearbyCompletedBookings,
      availabilityConfidence,
      availabilityConfidenceLabel,
      reliabilityLabel,
      reliabilityDetail,
      selectionSummaryLabel: "Qualified match for this property",
      selectionSummaryDetail: `${provider.companyName} serves the area and meets the baseline fit requirements for this request.`,
      neighborhoodFamiliarityLabel,
      neighborhoodFamiliarityDetail,
      factors
    };
  }

  private withCustomerSelectionSummaries(
    rankedProviders: SearchProviderResult[]
  ): SearchProviderResult[] {
    if (rankedProviders.length === 0) {
      return rankedProviders;
    }

    const topResult = rankedProviders[0];
    const nextResult = rankedProviders[1];

    return rankedProviders.map((result, index) => {
      if (index === 0) {
        return {
          ...result,
          ...this.buildTopSelectionSummary(result, nextResult)
        };
      }

      return {
        ...result,
        ...this.buildAlternativeSelectionSummary(result, topResult)
      };
    });
  }

  private buildTopSelectionSummary(
    result: SearchProviderResult,
    nextResult?: SearchProviderResult
  ): Pick<SearchProviderResult, "selectionSummaryLabel" | "selectionSummaryDetail"> {
    const strengths: string[] = [];

    if (result.hasOpenSlot && !nextResult?.hasOpenSlot) {
      strengths.push("it has a real route opening when nearby backups do not");
    } else if (result.hasOpenSlot) {
      strengths.push("it has a real route opening for this request");
    }

    if ((nextResult?.factors.serviceFit ?? 0) + 3 <= result.factors.serviceFit) {
      strengths.push("its service fit is materially stronger than the next backup");
    } else if ((nextResult?.factors.specialization ?? 0) + 2 <= result.factors.specialization) {
      strengths.push("it is more focused on this kind of work");
    }

    if ((nextResult?.factors.reliability ?? 0) + 5 <= result.factors.reliability) {
      strengths.push("its reliability signals are stronger than the next option");
    } else if (result.reliabilityLabel === "Proven dependable track record") {
      strengths.push("its review and punctuality history is unusually strong");
    }

    if ((nextResult?.factors.operationalReliability ?? 0) + 3 <= result.factors.operationalReliability) {
      strengths.push("it has steadier booking follow-through than the next option");
    }

    if (nextResult && nextResult.distanceMiles - result.distanceMiles >= 2) {
      strengths.push("it is meaningfully closer to the property");
    }

    if (nextResult && result.nearbyCompletedJobCount - nextResult.nearbyCompletedJobCount >= 3) {
      strengths.push("it has deeper nearby service history");
    }

    if (strengths.length === 0) {
      strengths.push("it gives the best combined balance of fit, trust, and route efficiency");
    }

    const summaryLabel =
      result.hasOpenSlot && strengths.some((strength) => strength.includes("route opening"))
        ? "Best mix of trust and bookable availability"
        : strengths.some((strength) => strength.includes("reliability"))
          ? "Strongest overall trust signal"
          : strengths.some((strength) => strength.includes("service fit"))
            ? "Best fit for this request"
            : "Best overall match for this property";

    return {
      selectionSummaryLabel: summaryLabel,
      selectionSummaryDetail: `GreenRain recommended ${result.provider.companyName} because ${strengths
        .slice(0, 3)
        .join(", ")}.`
    };
  }

  private buildAlternativeSelectionSummary(
    result: SearchProviderResult,
    topResult: SearchProviderResult
  ): Pick<SearchProviderResult, "selectionSummaryLabel" | "selectionSummaryDetail"> {
    const tradeoffs: string[] = [];

    if (!result.hasOpenSlot && topResult.hasOpenSlot) {
      tradeoffs.push("the recommendation has the cleaner route opening");
    }
    if (topResult.factors.reliability - result.factors.reliability >= 5) {
      tradeoffs.push("the recommendation has stronger reliability signals");
    }
    if (topResult.factors.operationalReliability - result.factors.operationalReliability >= 3) {
      tradeoffs.push("the recommendation has steadier booking follow-through");
    }
    if (topResult.factors.serviceFit - result.factors.serviceFit >= 3) {
      tradeoffs.push("the recommendation is a tighter service-fit match");
    }
    if (result.distanceMiles - topResult.distanceMiles >= 2) {
      tradeoffs.push("the recommendation is closer to the property");
    }
    if (topResult.nearbyCompletedJobCount - result.nearbyCompletedJobCount >= 3) {
      tradeoffs.push("the recommendation has deeper nearby route history");
    }

    const fallbackStrengths: string[] = [];
    if (result.hasOpenSlot) {
      fallbackStrengths.push("it still has a bookable route opening");
    }
    if (result.factors.specialization >= topResult.factors.specialization) {
      fallbackStrengths.push("it is still focused on this kind of work");
    }
    if (result.factors.reliability >= topResult.factors.reliability - 2) {
      fallbackStrengths.push("its trust profile is still competitive");
    }
    if (fallbackStrengths.length === 0) {
      fallbackStrengths.push("it still serves the area and fits the request");
    }

    const summaryLabel =
      tradeoffs.length > 0 ? "Why it ranks behind the recommendation" : "Still a qualified fallback";
    const summaryDetail =
      tradeoffs.length > 0
        ? `${result.provider.companyName} remains qualified, but GreenRain kept it behind the main recommendation because ${tradeoffs
            .slice(0, 2)
            .join(" and ")}.`
        : `${result.provider.companyName} still works as a fallback because ${fallbackStrengths
            .slice(0, 2)
            .join(" and ")}.`;

    return {
      selectionSummaryLabel: summaryLabel,
      selectionSummaryDetail: summaryDetail
    };
  }

  private buildProviderDecisionMetrics(): Map<string, { confirmations: number; declines: number }> {
    const metrics = new Map<string, { confirmations: number; declines: number }>();

    for (const event of this.analytics.listEvents()) {
      if (
        event.name !== MarketplaceTelemetryEventCatalog.bookingConfirmed &&
        event.name !== MarketplaceTelemetryEventCatalog.bookingDeclinedByProvider
      ) {
        continue;
      }

      if (!event.actorId) {
        continue;
      }

      const current = metrics.get(event.actorId) ?? {
        confirmations: 0,
        declines: 0
      };

      if (event.name === MarketplaceTelemetryEventCatalog.bookingConfirmed) {
        current.confirmations += 1;
      } else {
        current.declines += 1;
      }

      metrics.set(event.actorId, current);
    }

    return metrics;
  }

  private formatBookingWindowWithDate(iso: string): string {
    const dateLabel = new Date(iso).toLocaleDateString([], {
      weekday: "short",
      month: "short",
      day: "numeric"
    });
    return `${dateLabel} • ${formatBookingWindowSummary(iso)}`;
  }

  private interpolatePoint(
    origin: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number },
    progress: number
  ) {
    return {
      latitude: Number((origin.latitude + (destination.latitude - origin.latitude) * progress).toFixed(6)),
      longitude: Number(
        (origin.longitude + (destination.longitude - origin.longitude) * progress).toFixed(6)
      )
    };
  }

  private async createNotification(
    payload: Omit<AppNotification, "id" | "isRead" | "createdAt">
  ): Promise<void> {
    const notification = await this.repository.createNotification({
      id: crypto.randomUUID(),
      recipientId: payload.recipientId,
      recipientRole: payload.recipientRole,
      category: payload.category,
      title: payload.title,
      body: payload.body,
      actionHref: payload.actionHref,
      isRead: false,
      createdAt: new Date().toISOString(),
      readAt: undefined
    });

    await this.queueNotificationDeliveries(notification);
  }

  private async ensureNotificationPreferences(
    identity: AuthIdentityRecord
  ): Promise<NotificationPreferences> {
    const existing = await this.repository.getNotificationPreferences(identity.userId);
    if (existing) {
      return existing;
    }

    const nowIso = new Date().toISOString();
    return this.repository.upsertNotificationPreferences({
      userId: identity.userId,
      role: identity.role,
      emailEnabled: true,
      smsEnabled: true,
      pushEnabled: true,
      reviewRemindersEnabled: true,
      updatedAt: nowIso
    });
  }

  private async queueNotificationDeliveries(notification: AppNotification): Promise<void> {
    const identity = await this.repository.findAuthIdentityByUserId(notification.recipientId);
    if (!identity) {
      return;
    }

    const preferences = await this.ensureNotificationPreferences(identity);
    const channels = this.getExternalNotificationChannels(notification.category, preferences);
    if (channels.length === 0) {
      return;
    }

    const destinationProfile = await this.getNotificationDestinationProfile(identity);
    if (!destinationProfile) {
      return;
    }

    await Promise.all(
      channels.map(async (channel) => {
        const delivery = await this.repository.createNotificationDelivery({
          id: crypto.randomUUID(),
          notificationId: notification.id,
          recipientId: notification.recipientId,
          recipientRole: notification.recipientRole,
          category: notification.category,
          channel,
          destination: this.getNotificationDestination(channel, destinationProfile),
          provider: "queued",
          status: "queued",
          title: notification.title,
          bodyPreview: notification.body.slice(0, 160),
          createdAt: new Date().toISOString(),
          attemptCount: 0,
          lastAttemptAt: undefined,
          nextRetryAt: undefined,
          sentAt: undefined,
          errorMessage: undefined
        });

        await this.dispatchNotificationDelivery(delivery);
      })
    );
  }

  private getExternalNotificationChannels(
    category: AppNotification["category"],
    preferences: NotificationPreferences
  ): NotificationChannel[] {
    if (category === "review") {
      return preferences.reviewRemindersEnabled && preferences.pushEnabled ? ["push"] : [];
    }

    const channels: NotificationChannel[] = [];
    if (preferences.pushEnabled) {
      channels.push("push");
    }
    if (preferences.emailEnabled) {
      channels.push("email");
    }
    if (preferences.smsEnabled && (category === "booking" || category === "staffing" || category === "support")) {
      channels.push("sms");
    }
    return channels;
  }

  private async getNotificationDestinationProfile(identity: AuthIdentityRecord): Promise<{
    email: string;
    phone: string;
    pushTokens: string[];
  } | undefined> {
    const pushTokens = (
      await this.repository.listActivePushDevicesByRecipient(identity.userId, identity.role as PushDevice["role"])
    ).map((device) => device.token);

    if (identity.role === "customer") {
      const customer = await this.repository.findCustomerById(identity.userId);
      if (!customer) {
        return undefined;
      }
      return {
        email: customer.email,
        phone: customer.phone,
        pushTokens
      };
    }

    if (identity.role === "provider") {
      const provider = await this.repository.findProviderById(identity.userId);
      if (!provider) {
        return undefined;
      }
      return {
        email: provider.email,
        phone: provider.phone,
        pushTokens
      };
    }

    const crewMember = await this.repository.findCrewMemberById(identity.userId);
    if (!crewMember) {
      return undefined;
    }

    return {
      email: crewMember.email,
      phone: crewMember.phone,
      pushTokens
    };
  }

  private getNotificationDestination(
    channel: NotificationChannel,
    profile: { email: string; phone: string; pushTokens: string[] }
  ): string {
    if (channel === "email") {
      return profile.email;
    }

    if (channel === "sms") {
      return profile.phone;
    }

    return profile.pushTokens[0] ?? "local-device";
  }

  private async dispatchNotificationDelivery(delivery: NotificationDeliveryRecord): Promise<void> {
    const attemptCount = delivery.attemptCount + 1;
    const lastAttemptAt = new Date().toISOString();
    try {
      const dispatch = await this.notificationDelivery.dispatch({
        channel: delivery.channel,
        destination: delivery.destination,
        title: delivery.title,
        body: delivery.bodyPreview
      });

      await this.repository.updateNotificationDelivery(delivery.id, {
        provider: dispatch.provider,
        status: "sent",
        attemptCount,
        lastAttemptAt,
        nextRetryAt: undefined,
        sentAt: dispatch.sentAt,
        errorMessage: undefined
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Notification delivery failed.";
      const shouldRetry = this.shouldRetryNotificationDelivery(delivery.channel, delivery.destination, attemptCount);
      await this.repository.updateNotificationDelivery(delivery.id, {
        provider: this.getFailedDeliveryProvider(delivery.channel, delivery.destination),
        status: "failed",
        attemptCount,
        lastAttemptAt,
        nextRetryAt: shouldRetry ? this.buildNotificationRetryAt(attemptCount) : undefined,
        errorMessage
      });
    }
  }

  private getFailedDeliveryProvider(channel: NotificationChannel, destination: string): string {
    return this.notificationDelivery.getProviderName(channel, destination);
  }

  private shouldRetryNotificationDelivery(
    channel: NotificationChannel,
    destination: string,
    attemptCount: number
  ): boolean {
    return attemptCount < 3 && this.notificationDelivery.supportsRetry(channel, destination);
  }

  private buildNotificationRetryAt(attemptCount: number): string {
    const retryMinutes = attemptCount === 1 ? 1 : attemptCount === 2 ? 5 : 15;
    return new Date(Date.now() + retryMinutes * 60 * 1000).toISOString();
  }

  private async listDueNotificationDeliveries(): Promise<NotificationDeliveryRecord[]> {
    return (await this.repository.listAllNotificationDeliveries()).filter(
      (delivery) =>
        delivery.status === "failed" &&
        delivery.nextRetryAt &&
        Date.parse(delivery.nextRetryAt) <= Date.now()
    );
  }

  private async retryDueNotificationDeliveries(identity: AuthIdentityRecord): Promise<void> {
    const deliveries = (await this.listDueNotificationDeliveries()).filter(
      (delivery) => delivery.recipientId === identity.userId && delivery.recipientRole === identity.role
    );

    await Promise.all(deliveries.map((delivery) => this.dispatchNotificationDelivery(delivery)));
  }

  private buildNotificationOpsChannelHealth(
    deliveries: NotificationDeliveryRecord[],
    now: number,
    last24Hours: number
  ): NotificationOpsChannelHealth[] {
    const groups = new Map<string, NotificationOpsChannelHealth>();

    for (const delivery of deliveries) {
      const key = `${delivery.channel}:${delivery.provider}`;
      const existing = groups.get(key) ?? {
        channel: delivery.channel,
        provider: delivery.provider,
        totalDeliveries: 0,
        deliveriesLast24Hours: 0,
        sentCount: 0,
        failedCount: 0,
        queuedCount: 0,
        pendingRetryCount: 0,
        overdueRetryCount: 0,
        lastAttemptAt: undefined
      };

      existing.totalDeliveries += 1;
      if (Date.parse(delivery.createdAt) >= last24Hours) {
        existing.deliveriesLast24Hours += 1;
      }
      if (delivery.status === "sent") {
        existing.sentCount += 1;
      }
      if (delivery.status === "failed") {
        existing.failedCount += 1;
      }
      if (delivery.status === "queued") {
        existing.queuedCount += 1;
      }
      if (delivery.nextRetryAt) {
        existing.pendingRetryCount += 1;
        if (Date.parse(delivery.nextRetryAt) <= now) {
          existing.overdueRetryCount += 1;
        }
      }

      const candidateAttemptAt = delivery.lastAttemptAt ?? delivery.sentAt ?? delivery.createdAt;
      if (!existing.lastAttemptAt || candidateAttemptAt > existing.lastAttemptAt) {
        existing.lastAttemptAt = candidateAttemptAt;
      }

      groups.set(key, existing);
    }

    return [...groups.values()].sort((left, right) => {
      if (right.failedCount !== left.failedCount) {
        return right.failedCount - left.failedCount;
      }
      return right.totalDeliveries - left.totalDeliveries;
    });
  }

  private buildNotificationOpsAlerts(input: {
    deliveriesLast24Hours: number;
    failedLast24Hours: number;
    pendingRetryCount: number;
    overdueRetryCount: number;
    exhaustedFailureCount: number;
    channels: NotificationOpsChannelHealth[];
  }): NotificationOpsAlert[] {
    const alerts: NotificationOpsAlert[] = [];
    const opsAlertTargets = this.notificationDelivery.getOpsAlertTargets();

    if (input.overdueRetryCount > 0) {
      alerts.push({
        severity: "critical",
        title: "Overdue notification retries need attention",
        detail: `${input.overdueRetryCount} delivery attempt${input.overdueRetryCount === 1 ? "" : "s"} should have retried already but are still waiting.`
      });
    }

    if (input.exhaustedFailureCount > 0) {
      alerts.push({
        severity: "warning",
        title: "Some deliveries exhausted retry attempts",
        detail: `${input.exhaustedFailureCount} delivery failure${input.exhaustedFailureCount === 1 ? "" : "s"} no longer have a retry scheduled and may need manual follow-up.`
      });
    }

    const noisyChannels = input.channels.filter((channel) => channel.failedCount >= 3 || channel.overdueRetryCount > 0);
    if (noisyChannels.length > 0) {
      alerts.push({
        severity: "warning",
        title: "One or more delivery channels are noisy",
        detail: noisyChannels
          .slice(0, 3)
          .map(
            (channel) =>
              `${channel.provider} ${channel.channel} (${channel.failedCount} failed${channel.overdueRetryCount > 0 ? `, ${channel.overdueRetryCount} overdue` : ""})`
          )
          .join(" • ")
      });
    }

    const mockProviders = [...new Set(input.channels.filter((channel) => channel.provider.startsWith("mock-")).map((channel) => channel.provider))];
    if (mockProviders.length > 0) {
      alerts.push({
        severity: "info",
        title: "Mock notification providers are still active",
        detail: `${mockProviders.join(", ")} are still being used in this environment, so those channels are not yet production-grade.`
      });
    }

    if (opsAlertTargets.length === 0 && alerts.some((alert) => alert.severity === "warning" || alert.severity === "critical")) {
      alerts.push({
        severity: "warning",
        title: "No external ops alert targets are configured",
        detail: "Set NOTIFICATION_ALERT_EMAILS or NOTIFICATION_ALERT_SMS_NUMBERS so critical delivery problems can reach ops outside the dashboard."
      });
    }

    if (alerts.length === 0) {
      const failureRate =
        input.deliveriesLast24Hours > 0 ? Math.round((input.failedLast24Hours / input.deliveriesLast24Hours) * 100) : 0;
      alerts.push({
        severity: "info",
        title: "Delivery health looks stable",
        detail:
          input.deliveriesLast24Hours > 0
            ? `${input.failedLast24Hours} failed out of ${input.deliveriesLast24Hours} deliveries in the last 24 hours (${failureRate}% failure rate), with ${input.pendingRetryCount} retryable item${input.pendingRetryCount === 1 ? "" : "s"} in flight.`
            : "No notification deliveries have been recorded in the last 24 hours."
      });
    }

    return alerts;
  }

  private async ensureTimedNotifications(identity: AuthIdentityRecord): Promise<void> {
    if (identity.role !== "provider") {
      return;
    }

    await Promise.all([
      this.ensureProviderDepartureReminders(identity.userId),
      this.ensureProviderStaffingReviewReminders(identity.userId)
    ]);
  }

  private async ensureProviderDepartureReminders(providerId: string): Promise<void> {
    const [provider, bookings, notifications] = await Promise.all([
      this.repository.findProviderById(providerId),
      this.repository.listBookings(),
      this.repository.listNotificationsByRecipient(providerId)
    ]);

    if (!provider) {
      return;
    }

    const now = Date.now();
    const existingReminderActions = new Set(
      notifications
        .filter((notification) => notification.recipientRole === "provider")
        .map((notification) => notification.actionHref)
        .filter((actionHref): actionHref is string => Boolean(actionHref))
    );

    await Promise.all(
      bookings
        .filter(
          (booking) =>
            booking.providerId === providerId &&
            booking.status === "confirmed" &&
            !booking.onRouteConfirmedAt
        )
        .map(async (booking) => {
          const scheduledStart = new Date(booking.scheduledStartIso).getTime();
          const minutesUntilStart = Math.round((scheduledStart - now) / (1000 * 60));
          if (minutesUntilStart < 0 || minutesUntilStart > provider.departureReminderLeadMinutes) {
            return;
          }

          const actionHref = `/provider/management?bookingId=${booking.id}&reminder=departure`;
          if (existingReminderActions.has(actionHref)) {
            return;
          }

          const customer = await this.repository.findCustomerById(booking.customerId);
          const leadText =
            minutesUntilStart <= 15
              ? `Leave now for ${customer?.fullName ?? "your next customer"}.`
              : `Plan to head out in about ${minutesUntilStart} minutes.`;

          await this.createNotification({
            recipientId: providerId,
            recipientRole: "provider",
            category: "booking",
            title: "Time to head out soon",
            body: `${leadText} ${booking.serviceAddress.line1} • ${this.formatBookingWindowWithDate(booking.scheduledStartIso)}`,
            actionHref
          });
        })
    );
  }

  private async ensureProviderStaffingReviewReminders(providerId: string): Promise<void> {
    const [provider, bookings, notifications, matches, customers] = await Promise.all([
      this.repository.findProviderById(providerId),
      this.repository.listBookings(),
      this.repository.listNotificationsByRecipient(providerId),
      this.repository.listCrewMatches(),
      this.repository.listCustomers()
    ]);

    if (!provider || provider.staffingMode !== "review-first") {
      return;
    }

    const now = Date.now();
    const existingReminderActions = new Set(
      notifications
        .filter((notification) => notification.recipientRole === "provider")
        .map((notification) => notification.actionHref)
        .filter((actionHref): actionHref is string => Boolean(actionHref))
    );

    await Promise.all(
      bookings
        .filter(
          (booking) =>
            booking.providerId === providerId &&
            (booking.status === "requested" || booking.status === "confirmed") &&
            !booking.onRouteConfirmedAt
        )
        .map(async (booking) => {
          const scheduledStart = new Date(booking.scheduledStartIso).getTime();
          const hoursUntilStart = (scheduledStart - now) / (1000 * 60 * 60);
          if (hoursUntilStart < 0 || hoursUntilStart > provider.crewReviewLeadHours) {
            return;
          }

          const actionHref = `/provider/management?bookingId=${booking.id}&reminder=staffing`;
          if (existingReminderActions.has(actionHref)) {
            return;
          }

          const customer = customers.find((item) => item.id === booking.customerId);
          const bookingMatches = matches.filter((match) => match.bookingId === booking.id);
          const acceptedCount = bookingMatches.filter((match) => match.status === "accepted").length;
          const pendingCount = bookingMatches.filter((match) => match.status === "pending-provider-review").length;
          const requiredCrewMembers = this.estimateRequiredCrewMembers(
            booking,
            customer?.properties.find((property) => property.id === booking.servicePropertyId)
          );
          const crewGap = Math.max(requiredCrewMembers - acceptedCount, 0);

          if (pendingCount === 0 || crewGap === 0) {
            return;
          }

          await this.createNotification({
            recipientId: providerId,
            recipientRole: "provider",
            category: "staffing",
            title: "Review crew staffing soon",
            body: `${pendingCount} pending crew match${pendingCount === 1 ? "" : "es"} still need review for ${customer?.fullName ?? "this customer"} • ${crewGap} open slot${crewGap === 1 ? "" : "s"} remaining.`,
            actionHref
          });
        })
    );
  }

  private async ensureProviderCalendarFeedToken(providerId: string): Promise<ProviderProfile> {
    const provider = await this.repository.findProviderById(providerId);
    if (!provider) {
      throw new HttpError(404, "Provider not found");
    }

    if (provider.calendarConnection.feedToken) {
      return provider;
    }

    const updatedProvider = await this.repository.updateProvider(providerId, {
      calendarConnection: {
        ...provider.calendarConnection,
        feedToken: crypto.randomUUID(),
        lastSyncedAt: new Date().toISOString()
      }
    });

    if (!updatedProvider) {
      throw new HttpError(500, "Calendar feed token could not be saved");
    }

    return updatedProvider;
  }

  private async capturePaymentRecord(
    payment: PaymentRecord,
    booking: Booking,
    paymentIntentId?: string
  ): Promise<PaymentRecord> {
    if (payment.status === "captured") {
      return payment;
    }

    const now = new Date().toISOString();
    const updatedPayment = await this.repository.updatePayment(payment.id, {
      status: "captured",
      refundable: true,
      processorPaymentIntentId: paymentIntentId ?? payment.processorPaymentIntentId,
      failureReason: undefined,
      paidAt: payment.paidAt ?? now,
      updatedAt: now
    });

    if (!updatedPayment) {
      throw new HttpError(500, "Payment record could not be updated");
    }

    this.analytics.recordFunnelStep(MarketplaceTelemetryEventCatalog.paymentCaptured, booking.id, {
      paymentId: updatedPayment.id,
      amountCents: updatedPayment.amountCents,
      processor: updatedPayment.processor
    });
    await this.createNotification({
      recipientId: booking.customerId,
      recipientRole: "customer",
      category: "booking",
      title: "Payment received",
      body: "Your YardMatch payment went through successfully.",
      actionHref: "/customer/dashboard"
    });
    await this.createNotification({
      recipientId: booking.providerId,
      recipientRole: "provider",
      category: "booking",
      title: "Customer payment received",
      body: "A customer completed payment for an upcoming YardMatch booking.",
      actionHref: "/provider/management"
    });

    return updatedPayment;
  }

  private async failPaymentRecord(payment: PaymentRecord, failureReason: string): Promise<PaymentRecord> {
    if (payment.status === "captured") {
      return payment;
    }

    const updatedPayment = await this.repository.updatePayment(payment.id, {
      status: "failed",
      refundable: false,
      failureReason,
      updatedAt: new Date().toISOString()
    });

    if (!updatedPayment) {
      throw new HttpError(500, "Payment record could not be updated");
    }

    return updatedPayment;
  }

  private estimateCrewHourlyRate(category: Booking["category"]): number {
    const rateByCategory: Record<Booking["category"], number> = {
      "lawn-mowing": 2200,
      "hedge-trimming": 2400,
      "mulch-installation": 2500,
      "seasonal-cleanup": 2300,
      "weed-control": 2200,
      "irrigation-check": 2600,
      "leaf-blowing": 2100,
      "aeration": 2300,
      "fertilization": 2250,
      "gutter-cleaning": 2550,
      "snow-shoveling": 2350,
      "ice-melt-salting": 2300,
      "snow-blowing": 2450
    };

    return rateByCategory[category];
  }

  private isPayoutRelevantBooking(booking: Booking): boolean {
    return booking.status === "completed" || booking.status === "refunded";
  }

  private estimateCrewMatchPayoutCents(booking: Booking, hourlyRateCents: number): number {
    const durationHours = Math.max(
      1,
      (Date.parse(booking.scheduledEndIso) - Date.parse(booking.scheduledStartIso)) / (60 * 60 * 1000)
    );
    return Math.round(hourlyRateCents * durationHours);
  }

  private isValidPayoutWeekday(value: string): value is ProviderProfile["weeklyPayoutDay"] {
    return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].includes(value);
  }

  private getNextPayoutRunIso(weekday: CrewAvailabilityDay): string {
    const dayIndexByKey: Record<CrewAvailabilityDay, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6
    };
    const now = new Date();
    const next = new Date(now);
    next.setHours(9, 0, 0, 0);
    const targetDay = dayIndexByKey[weekday];
    const delta = (targetDay - next.getDay() + 7) % 7 || 7;
    next.setDate(next.getDate() + delta);
    return next.toISOString();
  }

  private buildProviderPayoutScheduleSummary(
    provider: ProviderProfile,
    entries: ProviderPayoutLedgerEntry[]
  ): ProviderPayoutLedgerResponse["payoutSchedule"] {
    const instantPayoutEligibleCents = provider.instantPayoutsEnabled
      ? entries
          .filter((entry) => entry.status === "ready")
          .reduce((sum, entry) => sum + entry.providerNetAmountCents, 0)
      : 0;

    return {
      weeklyPayoutDay: provider.weeklyPayoutDay,
      nextWeeklyPayoutDateIso: this.getNextPayoutRunIso(provider.weeklyPayoutDay),
      holdPeriodHours: this.payoutHoldHours,
      instantPayoutsEnabled: provider.instantPayoutsEnabled,
      instantPayoutMinimumCents: this.instantPayoutMinimumCents,
      instantPayoutEligibleCents
    };
  }

  private getPayoutLedgerStatus(
    booking: Booking,
    payment?: PaymentRecord
  ): ProviderPayoutLedgerEntry["status"] {
    if (booking.status === "refunded" || payment?.status === "refunded") {
      return "reversed";
    }

    if (payment?.refundReviewStatus === "requested") {
      return "on-hold";
    }

    if (payment?.status !== "captured") {
      return "awaiting-customer-payment";
    }

    const completedAtMs = Date.parse(booking.completedAt ?? booking.scheduledEndIso);
    const readyAtMs = completedAtMs + this.payoutHoldHours * 60 * 60 * 1000;
    return readyAtMs <= Date.now() ? "ready" : "scheduled";
  }

  private getPayoutAvailabilityIso(
    booking: Booking,
    status: ProviderPayoutLedgerEntry["status"]
  ): string | undefined {
    if (status !== "scheduled" && status !== "ready") {
      return undefined;
    }

    return new Date(
      Date.parse(booking.completedAt ?? booking.scheduledEndIso) + this.payoutHoldHours * 60 * 60 * 1000
    ).toISOString();
  }

  private normalizeAddress(address: Address): Address {
    const line1 = this.toTitleCase(this.normalizeAddressText(address.line1));
    const line2 = this.toTitleCase(this.normalizeAddressText(address.line2));
    const city = this.toTitleCase(this.normalizeAddressText(address.city));
    const state = this.normalizeAddressText(address.state).toUpperCase();
    const postalCode = this.normalizePostalCode(address.postalCode);
    const country = this.normalizeAddressText(address.country).toUpperCase();

    return {
      ...address,
      line1,
      line2: line2 || undefined,
      city,
      state,
      postalCode,
      country
    };
  }

  private async normalizeAndValidateAddress(address: Address): Promise<AddressValidationOutcome> {
    const normalizedAddress = this.normalizeAddress(address);
    const validatedAddress = await this.addressValidation.validateAddress(normalizedAddress);
    return {
      ...validatedAddress,
      address: this.normalizeAddress(validatedAddress.address)
    };
  }

  private buildNormalizedAddressSummary(
    original: Address,
    normalized: Address,
    validation?: AddressValidationOutcome
  ) {
    const normalizedFields = (
      [
        ["line1", original.line1, normalized.line1],
        ["line2", original.line2 ?? "", normalized.line2 ?? ""],
        ["city", original.city, normalized.city],
        ["state", original.state, normalized.state],
        ["postalCode", original.postalCode, normalized.postalCode],
        ["country", original.country, normalized.country]
      ] as const
    )
      .filter(([, before, after]) => before !== after)
      .map(([field]) => field);

    return {
      displayLabel: this.formatAddressLine(normalized),
      wasNormalized: normalizedFields.length > 0,
      normalizedFields,
      validationSource: validation?.source,
      validationConfidence: validation?.confidence,
      validationMessage: validation?.message
    };
  }

  private normalizeAddressText(value: string | undefined): string {
    return (value ?? "").trim().replace(/\s+/g, " ");
  }

  private normalizePostalCode(postalCode: string): string {
    const compact = this.normalizeAddressText(postalCode).replace(/\s+/g, "");
    const digits = compact.replace(/[^0-9]/g, "");
    if (digits.length === 9) {
      return `${digits.slice(0, 5)}-${digits.slice(5)}`;
    }

    if (digits.length === 5) {
      return digits;
    }

    return compact.toUpperCase();
  }

  private toTitleCase(value: string): string {
    return value.replace(/\b([a-z])/gi, (segment) => segment.toUpperCase());
  }

  private toSentenceCase(value: string): string {
    if (!value) {
      return value;
    }

    return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
  }

  private formatAddressLine(address: Address): string {
    return `${address.line1}, ${address.city}, ${address.state} ${address.postalCode}`;
  }

  private buildProviderPayoutNote(
    status: ProviderPayoutLedgerEntry["status"],
    payment: PaymentRecord | undefined,
    assignedCrewCount: number
  ): string {
    if (status === "reversed") {
      return "Customer payment was refunded, so provider payout is reversed.";
    }

    if (status === "awaiting-customer-payment") {
      return "Customer payment still needs to clear before provider earnings can settle.";
    }

    if (status === "on-hold") {
      return `A refund review is open for this booking, so provider payout is on hold. Latest note: ${payment?.refundReason ?? "Refund review requested."}`;
    }

    if (assignedCrewCount === 0) {
      return status === "ready"
        ? "No crew share is attached to this job, so the full provider net is ready."
        : "No crew share is attached to this job. The provider net is scheduled for weekly payout.";
    }

    return status === "ready"
      ? `Crew share has been reserved and the provider net is ready. Payment status: ${payment?.status ?? "unknown"}.`
      : `Crew share has been reserved and the provider net is scheduled for weekly payout. Payment status: ${payment?.status ?? "unknown"}.`;
  }

  private buildCrewPayoutNote(
    status: CrewPayoutLedgerEntry["status"],
    payment?: PaymentRecord
  ): string {
    if (status === "reversed") {
      return "Customer payment was refunded, so this crew payout was reversed.";
    }

    if (status === "awaiting-customer-payment") {
      return "Customer payment still needs to clear before this crew payout can move forward.";
    }

    if (status === "on-hold") {
      return `A refund review is open for this booking, so crew payout is on hold. Latest note: ${payment?.refundReason ?? "Refund review requested."}`;
    }

    return status === "ready"
      ? `This payout is ready based on the completed service and captured customer payment (${payment?.status ?? "unknown"}).`
      : `This payout is scheduled to move after the standard post-service hold period. Payment status: ${payment?.status ?? "unknown"}.`;
  }
}
