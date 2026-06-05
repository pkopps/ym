import { DataEngineeringLogger } from "@yardmatch/analytics";
import {
  ActiveSession,
  AppNotification,
  AnalyticsEvent,
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
  MarkBookingOnRouteRequest,
  MarkNotificationsReadRequest,
  ProviderCrewConversation,
  ProviderCrewConversationThread,
  ProviderCrewMessage,
  CrewOpportunity,
  CustomerReviewOpportunity,
  CreateProviderReviewRequest,
  CreateCustomerPropertyRequest,
  CreateBookingRequest,
  CreateCheckoutSessionRequest,
  CreateCheckoutSessionResponse,
  InstantQuoteRequest,
  InstantQuoteResponse,
  ListCustomerReviewOpportunitiesResponse,
  CreatePaymentIntentRequest,
  FinalizeCheckoutSessionRequest,
  ProcessReviewInvitesRequest,
  ProcessReviewInvitesResponse,
  CreateRefundRequest,
  CreateSupportTicketRequest,
  Booking,
  CrewMemberProfile,
  CustomerProperty,
  ObservabilityOverview,
  CustomerProfile,
  CurrentUserResponse,
  NotificationListResponse,
  PaymentRecord,
  ProviderProfile,
  ProviderReview,
  ProviderStaffingJobSummary,
  ProviderStaffingOverview,
  PlaceSearchResponse,
  RegisterUserRequest,
  ReviewCrewMatchRequest,
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
  UpdateCrewPreferencesRequest,
  UpdateProviderSettingsRequest,
  SupportTicket,
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
import { HttpError } from "../http";
import { AuthIdentityRecord, MarketplaceRepository } from "../repositories/MarketplaceRepository";
import { PlaceSearchService } from "./PlaceSearchService";
import { PaymentCheckoutGateway, StripeCheckoutService } from "./StripeCheckoutService";

export class MarketplacePlatformService {
  private static readonly reviewInviteDelayHours = 48;
  private static readonly reviewInviteExpiryDays = 30;
  private readonly geoService = new GeoService();
  private readonly providerMatcher = new ProviderMatchService(this.geoService);
  private readonly schedulingService = new SchedulingService();
  private readonly bookingLifecycle = new BookingLifecycleService();
  private readonly propertyBook = new PropertyBookService();
  private readonly bookingAddressPolicy = new BookingAddressPolicyService(this.geoService);
  private readonly instantQuoteEngine = new InstantQuoteEngine();
  private readonly placeSearch = new PlaceSearchService(process.env.GOOGLE_MAPS_API_KEY);
  private readonly stripeCheckout: PaymentCheckoutGateway;
  private readonly appBaseUrl: string;

  public constructor(
    private readonly repository: MarketplaceRepository,
    private readonly analytics: DataEngineeringLogger,
    stripeCheckout: PaymentCheckoutGateway = new StripeCheckoutService(),
    appBaseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000"
  ) {
    this.stripeCheckout = stripeCheckout;
    this.appBaseUrl = appBaseUrl;
  }

  public async registerUser(
    payload: RegisterUserRequest,
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

  public async searchPlaces(query: string): Promise<PlaceSearchResponse> {
    return this.placeSearch.search(query);
  }

  public async listNotifications(identity: AuthIdentityRecord): Promise<NotificationListResponse> {
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
          const providerSlots = await this.repository.listSlotsByProvider(provider.id);

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
    crewMemberId: string,
    payload: MarkBookingOnRouteRequest
  ): Promise<Booking> {
    const booking = await this.repository.findBookingById(payload.bookingId);
    if (!booking) {
      throw new HttpError(404, "Booking not found");
    }

    const acceptedMatch = (await this.repository.listCrewMatches()).find(
      (match) =>
        match.bookingId === booking.id &&
        match.crewMemberId === crewMemberId &&
        match.status === "accepted"
    );
    if (!acceptedMatch) {
      throw new HttpError(403, "Only accepted crew members can confirm they are on route");
    }

    if (booking.status !== "confirmed" && booking.status !== "in-progress") {
      throw new HttpError(
        400,
        "Bookings must be confirmed before a crew member can mark them on route"
      );
    }

    const updatedBooking = await this.repository.updateBooking(booking.id, {
      onRouteConfirmedAt: new Date().toISOString(),
      onRouteConfirmedByCrewMemberId: crewMemberId
    });

    if (!updatedBooking) {
      throw new HttpError(500, "Booking could not be updated");
    }

    const provider = await this.repository.findProviderById(booking.providerId);
    await Promise.all([
      this.createNotification({
        recipientId: booking.customerId,
        recipientRole: "customer",
        category: "booking",
        title: "Your crew is on the way",
        body: `${provider?.companyName ?? "Your landscaping business"} is heading to your property now.`,
        actionHref: "/customer/dashboard"
      }),
      this.createNotification({
        recipientId: booking.providerId,
        recipientRole: "provider",
        category: "staffing",
        title: "Crew confirmed on route",
        body: "Your assigned crew member marked this job on route.",
        actionHref: "/provider/management"
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
    const crewMember = crewMemberId
      ? await this.repository.findCrewMemberById(crewMemberId)
      : undefined;

    const baseTracking: BookingArrivalTracking = {
      bookingId: booking.id,
      status: "unavailable",
      customerId: booking.customerId,
      providerId: booking.providerId,
      crewMemberId: crewMember?.id,
      crewMemberName: crewMember?.fullName,
      destination: booking.serviceAddress,
      routeStartPoint: crewMember?.address.point,
      progressPercent: 0,
      lastComputedAt: nowIso,
      message: "Tracking is not available for this booking yet."
    };

    if (!acceptedMatch || !crewMember) {
      return {
        ...baseTracking,
        message: "No accepted crew member is assigned yet."
      };
    }

    if (!booking.onRouteConfirmedAt) {
      return {
        ...baseTracking,
        status: "not-started",
        message: `${crewMember.fullName} is assigned, but has not marked this booking on route yet.`
      };
    }

    const startedAt = new Date(booking.onRouteConfirmedAt).getTime();
    const now = new Date(nowIso).getTime();
    const totalDistanceMiles = this.geoService.distanceMiles(crewMember.address, booking.serviceAddress);
    const totalTravelMinutes = Math.max(6, Math.min(45, Math.round((totalDistanceMiles / 22) * 60) + 4));
    const elapsedMinutes = Math.max(0, (now - startedAt) / (1000 * 60));
    const clampedProgress = Math.max(0, Math.min(1, elapsedMinutes / totalTravelMinutes));
    const currentPoint = this.interpolatePoint(
      crewMember.address.point,
      booking.serviceAddress.point,
      booking.status === "in-progress" || booking.status === "completed" ? 1 : clampedProgress
    );

    if (booking.status === "completed") {
      return {
        ...baseTracking,
        status: "completed",
        currentPoint: booking.serviceAddress.point,
        progressPercent: 100,
        remainingDistanceMiles: 0,
        etaMinutes: 0,
        unlockedAt: booking.onRouteConfirmedAt,
        message: `${crewMember.fullName} already completed this service.`
      };
    }

    if (booking.status === "in-progress" || clampedProgress >= 1) {
      return {
        ...baseTracking,
        status: "arrived",
        currentPoint: booking.serviceAddress.point,
        progressPercent: 100,
        remainingDistanceMiles: 0,
        etaMinutes: 0,
        unlockedAt: booking.onRouteConfirmedAt,
        message: `${crewMember.fullName} has arrived at the property.`
      };
    }

    return {
      ...baseTracking,
      status: "on-route",
      currentPoint,
      progressPercent: Math.round(clampedProgress * 100),
      remainingDistanceMiles: Number((totalDistanceMiles * (1 - clampedProgress)).toFixed(1)),
      etaMinutes: Math.max(1, Math.ceil(totalTravelMinutes - elapsedMinutes)),
      unlockedAt: booking.onRouteConfirmedAt,
      message: `${crewMember.fullName} is on the way.`
    };
  }

  public async startBooking(crewMemberId: string, payload: StartBookingRequest): Promise<Booking> {
    const booking = await this.repository.findBookingById(payload.bookingId);
    if (!booking) {
      throw new HttpError(404, "Booking not found");
    }

    const acceptedMatch = (await this.repository.listCrewMatches()).find(
      (match) =>
        match.bookingId === booking.id &&
        match.crewMemberId === crewMemberId &&
        match.status === "accepted"
    );
    if (!acceptedMatch) {
      throw new HttpError(403, "Only accepted crew members can start this booking");
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
      status: "in-progress"
    });

    if (!updatedBooking) {
      throw new HttpError(500, "Booking could not be started");
    }

    this.analytics.record({
      id: crypto.randomUUID(),
      name: MarketplaceTelemetryEventCatalog.crewCheckInCompleted,
      actorId: crewMemberId,
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

    const updatedProvider = await this.repository.updateProvider(provider.id, {
      serviceRadiusMiles: normalizedRadius,
      staffingMode,
      sponsoredListingEnabled:
        payload.sponsoredListingEnabled ?? provider.sponsoredListingEnabled
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
      completedAt
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
      status: "cancelled"
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
      scheduledEndIso: payload.scheduledEndIso
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
      createdAt: new Date().toISOString()
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

  public createAnalyticsEvent(payload: AnalyticsEvent): AnalyticsEvent {
    return this.analytics.record(payload);
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
    return this.schedulingService.buildCalendarFeed(await this.repository.listSlotsByProvider(providerId));
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

  public async findAuthIdentityByUserId(userId: string): Promise<AuthIdentityRecord | undefined> {
    return this.repository.findAuthIdentityByUserId(userId);
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
          (booking.status === "requested" || booking.status === "confirmed" || booking.status === "in-progress")
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
    await this.repository.createNotification({
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
}
