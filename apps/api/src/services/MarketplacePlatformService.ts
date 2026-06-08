import { DataEngineeringLogger } from "@yardmatch/analytics";
import {
  ActiveSession,
  AppNotification,
  AnalyticsEvent,
  Address,
  CancelBookingRequest,
  BookingArrivalTracking,
  CompleteBookingRequest,
  ConfirmBookingRequest,
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
  NotificationOpsHealthResponse,
  NotificationOpsRetrySweepResponse,
  ProviderCrewConversation,
  ProviderCrewConversationThread,
  ProviderCrewMessage,
  ProviderPayoutLedgerEntry,
  ProviderPayoutLedgerResponse,
  CrewOpportunity,
  CrewPayoutLedgerEntry,
  CrewPayoutLedgerResponse,
  CustomerReviewOpportunity,
  CreateProviderReviewRequest,
  CreateCustomerPropertyRequest,
  CreateBookingRequest,
  CreateBookingDisputeRequest,
  CreateExternalCalendarImportRequest,
  CreateCheckoutSessionRequest,
  CreateCheckoutSessionResponse,
  InstantQuoteRequest,
  InstantQuoteResponse,
  ListCustomerReviewOpportunitiesResponse,
  CreatePaymentIntentRequest,
  FinalizeCheckoutSessionRequest,
  ProcessReviewInvitesRequest,
  ProcessReviewInvitesResponse,
  RequestPasswordResetRequest,
  RequestPasswordResetResponse,
  CreateRefundRequest,
  CreateSupportTicketRequest,
  UpdateSupportTicketRequest,
  Booking,
  CrewMemberProfile,
  CustomerProperty,
  ObservabilityOverview,
  CustomerProfile,
  CurrentUserResponse,
  NotificationListResponse,
  NotificationPreferences,
  PaymentRecord,
  PushDevice,
  ProviderProfile,
  ExternalCalendarBlock,
  ExternalCalendarSubscription,
  ProviderReview,
  ProviderStaffingJobSummary,
  ProviderStaffingOverview,
  ProviderCalendarSubscriptionResponse,
  ProviderCalendarImportsResponse,
  ProviderCalendarOverviewResponse,
  PlaceSearchResponse,
  RegisterUserRequest,
  ReviewCrewMatchRequest,
  RemoveExternalCalendarImportRequest,
  RescheduleBookingRequest,
  ReviewInvite,
  ReviewInviteDispatch,
  SendCustomerProviderMessageRequest,
  SendProviderCrewMessageRequest,
  SetDefaultCustomerPropertyRequest,
  SessionHeartbeatRequest,
  SearchProvidersRequest,
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
import { PlaceSearchService } from "./PlaceSearchService";
import { PaymentCheckoutGateway, StripeCheckoutService } from "./StripeCheckoutService";

export class MarketplacePlatformService {
  private static readonly reviewInviteDelayHours = 48;
  private static readonly reviewInviteExpiryDays = 30;
  private static readonly liveRouteLocationStaleMinutes = 5;
  private readonly geoService = new GeoService();
  private readonly providerMatcher = new ProviderMatchService(this.geoService);
  private readonly schedulingService = new SchedulingService();
  private readonly bookingLifecycle = new BookingLifecycleService();
  private readonly propertyBook = new PropertyBookService();
  private readonly bookingAddressPolicy = new BookingAddressPolicyService(this.geoService);
  private readonly instantQuoteEngine = new InstantQuoteEngine();
  private readonly placeSearch = new PlaceSearchService(process.env.GOOGLE_MAPS_API_KEY);
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

    if (payload.role === "customer") {
      const primaryProperty = {
        id: crypto.randomUUID(),
        label: payload.propertyLabel ?? "Primary property",
        address: payload.address,
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
        address: payload.address,
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
        address: payload.address,
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
      address: payload.address,
      createdAt: now,
      companyName: payload.companyName ?? `${payload.fullName} Landscaping`,
      bio: payload.bio ?? "Quality lawn care and landscaping services.",
      yearsExperience: payload.yearsExperience ?? 1,
      serviceRadiusMiles: payload.serviceRadiusMiles ?? 15,
      staffingMode: "review-first",
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
    this.analytics.recordFunnelStep(MarketplaceTelemetryEventCatalog.providerSearchPerformed, "anonymous", {
      dateIso: payload.dateIso,
      categoryCount: payload.categories.length,
      city: payload.address.city
    });

    const matchingProviders = this.providerMatcher
      .rankProviders(
        payload.address,
        (await this.repository
          .listProviders())
          .filter((provider) =>
            payload.categories.some((category) => provider.categories.includes(category))
          )
      )
      .filter(
        (provider) =>
          this.geoService.distanceMiles(payload.address, provider.address) <= provider.serviceRadiusMiles
      );

    const suggestedSlots = (
      await Promise.all(
        matchingProviders.map(async (provider) => {
          const providerSlots = this.filterProviderSlotsAgainstExternalBlocks(
            provider,
            await this.repository.listSlotsByProvider(provider.id)
          );

          if (!payload.estimatedDurationMinutes) {
            return providerSlots.filter((slot) => !slot.isBooked);
          }

          const firstMatchingSlot = this.schedulingService.findFirstAvailableSlot(
            providerSlots,
            payload.estimatedDurationMinutes
          );

          return firstMatchingSlot ? [firstMatchingSlot] : [];
        })
      )
    ).flat();

    this.analytics.record({
      id: crypto.randomUUID(),
      name: MarketplaceTelemetryEventCatalog.providerMatchReturned,
      occurredAt: new Date().toISOString(),
      properties: {
        providerCount: matchingProviders.length,
        slotCount: suggestedSlots.length,
        city: payload.address.city
      }
    });

    return {
      providers: matchingProviders,
      suggestedSlots
    };
  }

  public async getProviderProfile(providerId: string): Promise<ProviderProfile> {
    const provider = await this.repository.findProviderById(providerId);
    if (!provider) {
      throw new Error("Provider not found");
    }

    return provider;
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

          return [{
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
          status: match.status,
            hourlyRateCents: match.hourlyRateCents,
            canChat: match.status === "pending-provider-review" || match.status === "accepted",
            summary:
              match.status === "accepted"
                ? `${provider.companyName} accepted you for this job.`
                : match.status === "denied"
                  ? `${provider.companyName} passed on this match.`
                  : `${provider.companyName} is reviewing your fit for this job.`
          }];
        })
        .sort((left, right) => left.scheduledStartIso.localeCompare(right.scheduledStartIso))
    };
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

    const acceptedMatch = (await this.repository.listCrewMatches()).find(
      (match) =>
        match.bookingId === booking.id &&
        match.status === "accepted"
    );

    if (actor.role === "provider" && booking.providerId !== actor.userId) {
      throw new HttpError(403, "Providers can only start the route for their own bookings");
    }

    if (actor.role === "crew-member") {
      if (!acceptedMatch || acceptedMatch.crewMemberId !== actor.userId) {
        throw new HttpError(403, "Only accepted crew members can confirm they are on route");
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

    const provider = await this.repository.findProviderById(booking.providerId);
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

  public async updateBookingRouteLocation(
    actor: AuthIdentityRecord,
    payload: UpdateBookingRouteLocationRequest
  ): Promise<BookingArrivalTracking> {
    const booking = await this.repository.findBookingById(payload.bookingId);
    if (!booking) {
      throw new HttpError(404, "Booking not found");
    }

    const acceptedMatch = (await this.repository.listCrewMatches()).find(
      (match) => match.bookingId === booking.id && match.status === "accepted"
    );

    if (actor.role === "provider" && booking.providerId !== actor.userId) {
      throw new HttpError(403, "Providers can only share live route location for their own bookings");
    }

    if (actor.role === "crew-member") {
      if (!acceptedMatch || acceptedMatch.crewMemberId !== actor.userId) {
        throw new HttpError(403, "Only accepted crew members can share route location");
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

    const updatedBooking = await this.repository.updateBooking(booking.id, {
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
    const acceptedMatch = matches.find(
      (match) => match.bookingId === booking.id && match.status === "accepted"
    );

    if (actor.role === "customer" && booking.customerId !== actor.userId) {
      throw new HttpError(403, "Customers can only track their own bookings");
    }

    if (actor.role === "provider" && booking.providerId !== actor.userId) {
      throw new HttpError(403, "Providers can only track their own jobs");
    }

    if (
      actor.role === "crew-member" &&
      (!acceptedMatch || acceptedMatch.crewMemberId !== actor.userId)
    ) {
      throw new HttpError(403, "Crew members can only track accepted assignments");
    }

    const crewMemberId = booking.onRouteConfirmedByCrewMemberId ?? acceptedMatch?.crewMemberId;
    const crewMember = crewMemberId ? await this.repository.findCrewMemberById(crewMemberId) : undefined;
    const routeLeaderPoint =
      booking.onRouteConfirmedByCrewMemberId && crewMember
        ? crewMember.address.point
        : provider?.address.point ?? crewMember?.address.point;
    const routeLeaderName =
      booking.onRouteConfirmedByCrewMemberId && crewMember
        ? crewMember.fullName
        : provider?.companyName ?? crewMember?.fullName ?? "Your landscaping business";

    const baseTracking: BookingArrivalTracking = {
      bookingId: booking.id,
      status: "unavailable",
      customerId: booking.customerId,
      providerId: booking.providerId,
      crewMemberId: crewMember?.id,
      crewMemberName: routeLeaderName,
      destination: booking.serviceAddress,
      routeStartPoint: routeLeaderPoint,
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
    const totalDistanceMiles = routeLeaderPoint
      ? this.geoService.distanceMiles(
          {
            ...booking.serviceAddress,
            point: routeLeaderPoint
          },
          booking.serviceAddress
        )
      : 0;
    const totalTravelMinutes = Math.max(6, Math.min(45, Math.round((totalDistanceMiles / 22) * 60) + 4));
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
          booking.serviceAddress.point,
          computedProgress
        );
    const liveRemainingDistanceMiles = effectiveCurrentPoint
      ? this.geoService.distanceMiles(
          {
            ...booking.serviceAddress,
            point: effectiveCurrentPoint
          },
          booking.serviceAddress
        )
      : undefined;
    const clampedProgress =
      typeof liveRemainingDistanceMiles === "number" && totalDistanceMiles > 0
        ? Math.max(0, Math.min(1, 1 - liveRemainingDistanceMiles / totalDistanceMiles))
        : computedProgress;
    const etaMinutesFromLivePoint =
      typeof liveRemainingDistanceMiles === "number"
        ? Math.max(
            0,
            Math.ceil((liveRemainingDistanceMiles / Math.max(10, booking.routeLiveSpeedMph ?? 22)) * 60)
          )
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
      source: hasLiveRoutePoint ? booking.routeLiveSource ?? "computed-origin" : "computed-origin",
      liveUpdatedAt: booking.routeLiveUpdatedAt,
      isLiveLocationStale,
      progressPercent: Math.round(clampedProgress * 100),
      remainingDistanceMiles:
        typeof liveRemainingDistanceMiles === "number"
          ? Number(liveRemainingDistanceMiles.toFixed(1))
          : Number((totalDistanceMiles * (1 - clampedProgress)).toFixed(1)),
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

    const staffingMode = payload.staffingMode ?? provider.staffingMode ?? "review-first";
    if (staffingMode !== "auto-accept" && staffingMode !== "review-first") {
      throw new Error("staffingMode must be auto-accept or review-first");
    }

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
      staffingMode,
      sponsoredListingEnabled:
        payload.sponsoredListingEnabled ?? provider.sponsoredListingEnabled,
      calendarConnection: nextCalendarConnection
    });

    const updatedProvider = await this.repository.updateProvider(provider.id, {
      serviceRadiusMiles: normalizedRadius,
      staffingMode,
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
        staffingMode,
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

  public async createInstantQuote(payload: InstantQuoteRequest): Promise<InstantQuoteResponse> {
    const customer = payload.customerId ? await this.repository.findCustomerById(payload.customerId) : undefined;
    const property = payload.propertyId
      ? customer?.properties.find((item) => item.id === payload.propertyId)
      : undefined;

    if (payload.propertyId && !property) {
      throw new Error("Selected property does not belong to the customer");
    }

    const quote = this.instantQuoteEngine.buildQuote({
      request: {
        ...payload,
        address: property?.address ?? payload.address
      },
      property
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

    const booking = this.bookingLifecycle.createBooking(crypto.randomUUID(), {
      customerId,
      ...payload,
      serviceAddress: selectedProperty?.address ?? payload.serviceAddress
    });

    await this.assertProviderWindowIsAvailable(
      payload.providerId,
      payload.scheduledStartIso,
      payload.scheduledEndIso
    );

    const result = await this.repository.createBooking(booking);

    this.analytics.recordFunnelStep(MarketplaceTelemetryEventCatalog.bookingRequested, customerId, {
      providerId: payload.providerId,
      totalCents: payload.totalCents,
      category: payload.category,
      servicePropertyId: payload.servicePropertyId ?? "custom-address"
    });
    const provider = await this.repository.findProviderById(payload.providerId);
    await this.createNotification({
      recipientId: payload.providerId,
      recipientRole: "provider",
      category: "booking",
      title: "New booking request",
      body: `${customer.fullName} requested ${this.titleCaseCategory(payload.category)} for ${new Date(
        booking.scheduledStartIso
      ).toLocaleDateString()}.`,
      actionHref: "/provider/management"
    });
    return result;
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
        category: booking.category
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

  public async createCustomerProperty(
    customerId: string,
    payload: CreateCustomerPropertyRequest
  ): Promise<CustomerProperty> {
    const customer = await this.repository.findCustomerById(customerId);

    if (!customer) {
      throw new Error("Customer not found");
    }

    const property = this.propertyBook.createProperty(crypto.randomUUID(), {
      ...payload,
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

    const requestedAddress = selectedProperty?.address ?? payload.newAddress;

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
      entries
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
      refundable: true
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

    const updatedPayment = await this.repository.updatePayment(payload.paymentId, {
      status: "refunded",
      refundReason: payload.reason,
      refundable: false,
      updatedAt: new Date().toISOString()
    });

    if (!updatedPayment) {
      throw new Error("Payment not found");
    }

    this.analytics.recordFunnelStep(MarketplaceTelemetryEventCatalog.refundRequested, updatedPayment.bookingId, {
      paymentId: updatedPayment.id,
      reason: payload.reason
    });
    return updatedPayment;
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
    const [tickets, bookings, customers, providers] = await Promise.all([
      this.repository.listSupportTickets(),
      this.repository.listBookings(),
      this.repository.listCustomers(),
      this.repository.listProviders()
    ]);

    return tickets
      .map((ticket) => {
        const booking = ticket.bookingId
          ? bookings.find((candidate) => candidate.id === ticket.bookingId)
          : undefined;
        const customer = booking
          ? customers.find((candidate) => candidate.id === booking.customerId)
          : undefined;
        const provider = booking
          ? providers.find((candidate) => candidate.id === booking.providerId)
          : undefined;

        return {
          ticket,
          booking,
          customerName: customer?.fullName,
          providerName: provider?.companyName
        } satisfies SupportOpsTicket;
      })
      .sort((left, right) => right.ticket.createdAt.localeCompare(left.ticket.createdAt));
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
          await this.applySupportResolutionToBooking(booking, payload.resolutionAction);
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
      instructions: [
        "Apple Calendar and Outlook can subscribe directly with the webcal link.",
        "Google Calendar can subscribe to the feed URL from Add calendar by URL.",
        "The feed includes YardMatch jobs plus your manual outside-client and personal blocks."
      ]
    };
  }

  public async getProviderCalendarImports(providerId: string): Promise<ProviderCalendarImportsResponse> {
    const provider = await this.repository.findProviderById(providerId);
    if (!provider) {
      throw new HttpError(404, "Provider not found");
    }

    return {
      providerId: provider.id,
      subscriptions: [...(provider.calendarConnection.externalSubscriptions ?? [])].sort((left, right) =>
        left.title.localeCompare(right.title)
      ),
      importedBlockCount: (provider.calendarConnection.externalBlocks ?? []).filter(
        (block) => block.source === "calendar-import"
      ).length
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
    const imported = await this.syncExternalCalendarSubscription(provider, subscription, nextSubscriptions);
    return {
      providerId,
      subscriptions: imported.calendarConnection.externalSubscriptions ?? [],
      importedBlockCount: (imported.calendarConnection.externalBlocks ?? []).filter(
        (block) => block.source === "calendar-import"
      ).length
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
    return {
      providerId,
      subscriptions: updatedProvider.calendarConnection.externalSubscriptions ?? [],
      importedBlockCount: (updatedProvider.calendarConnection.externalBlocks ?? []).filter(
        (block) => block.source === "calendar-import"
      ).length
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

    return {
      providerId,
      subscriptions: updatedProvider.calendarConnection.externalSubscriptions ?? [],
      importedBlockCount: (updatedProvider.calendarConnection.externalBlocks ?? []).filter(
        (block) => block.source === "calendar-import"
      ).length
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

    const bookings = (await this.listProviderCalendarBookings(providerId)).filter((booking) =>
      this.doIntervalsOverlap(booking.scheduledStartIso, booking.scheduledEndIso, windowStartIso, windowEndIso)
    );
    const externalBlocks = this.getActiveExternalCalendarBlocks(provider).filter((block) =>
      this.doIntervalsOverlap(block.startIso, block.endIso, windowStartIso, windowEndIso)
    );

    const events = this.schedulingService.buildProviderCalendarEvents({
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

  private async syncExternalCalendarSubscription(
    provider: ProviderProfile,
    subscription: ExternalCalendarSubscription,
    allSubscriptions: ExternalCalendarSubscription[]
  ): Promise<ProviderProfile> {
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

    const [bookings, customers, matches] = await Promise.all([
      this.repository.listBookings(),
      this.repository.listCustomers(),
      this.repository.listCrewMatches()
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
        const assignedCrewMembers = bookingMatches.filter((match) => match.status === "accepted").length;

        return {
          bookingId: booking.id,
          customerName: customer?.fullName ?? "Customer",
          serviceAddress: booking.serviceAddress,
          category: booking.category,
          status: booking.status,
          scheduledStartIso: booking.scheduledStartIso,
          scheduledEndIso: booking.scheduledEndIso,
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
          totalCents: booking.totalCents,
          requiredCrewMembers,
          assignedCrewMembers,
          crewGap: Math.max(requiredCrewMembers - assignedCrewMembers, 0),
          matches: bookingMatches
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
          .filter((crewMember) => this.isCrewMemberEligibleForBooking(crewMember, booking))
          .sort(
            (left, right) =>
              this.geoService.distanceMiles(left.address, booking.serviceAddress) -
              this.geoService.distanceMiles(right.address, booking.serviceAddress)
          );

        const gap = requiredCrewMembers - acceptedMatches.length;
        const existingIds = new Set(bookingMatches.map((match) => match.crewMemberId));
        const nextCandidates = candidatePool
          .filter((crewMember) => !existingIds.has(crewMember.id))
          .slice(0, provider.staffingMode === "auto-accept" ? gap : Math.max(3, gap));

        for (const crewMember of nextCandidates) {
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

  private isCrewMemberEligibleForBooking(crewMember: CrewMemberProfile, booking: Booking): boolean {
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

    return crewMember.status !== "off-duty";
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

  private titleCaseCategory(category: Booking["category"]): string {
    return category
      .split("-")
      .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
      .join(" ");
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

    await this.ensureProviderDepartureReminders(identity.userId);
  }

  private async ensureProviderDepartureReminders(providerId: string): Promise<void> {
    const [bookings, notifications] = await Promise.all([
      this.repository.listBookings(),
      this.repository.listNotificationsByRecipient(providerId)
    ]);

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
          if (minutesUntilStart < 0 || minutesUntilStart > 60) {
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

  private getPayoutLedgerStatus(
    booking: Booking,
    payment?: PaymentRecord
  ): ProviderPayoutLedgerEntry["status"] {
    if (booking.status === "refunded" || payment?.status === "refunded") {
      return "reversed";
    }

    if (payment?.status !== "captured") {
      return "awaiting-customer-payment";
    }

    const completedAtMs = Date.parse(booking.completedAt ?? booking.scheduledEndIso);
    const readyAtMs = completedAtMs + 48 * 60 * 60 * 1000;
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
      Date.parse(booking.completedAt ?? booking.scheduledEndIso) + 48 * 60 * 60 * 1000
    ).toISOString();
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

    return status === "ready"
      ? `This payout is ready based on the completed service and captured customer payment (${payment?.status ?? "unknown"}).`
      : `This payout is scheduled to move after the standard post-service hold period. Payment status: ${payment?.status ?? "unknown"}.`;
  }
}
