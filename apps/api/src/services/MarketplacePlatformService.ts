import { DataEngineeringLogger } from "@yardmatch/analytics";
import {
  ActiveSession,
  AnalyticsEvent,
  CompleteBookingRequest,
  CustomerReviewOpportunity,
  CreateProviderReviewRequest,
  CreateCustomerPropertyRequest,
  CreateBookingRequest,
  InstantQuoteRequest,
  InstantQuoteResponse,
  ListCustomerReviewOpportunitiesResponse,
  CreatePaymentIntentRequest,
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
  PaymentRecord,
  ProviderProfile,
  ProviderReview,
  RegisterUserRequest,
  ReviewInvite,
  ReviewInviteDispatch,
  SetDefaultCustomerPropertyRequest,
  SessionHeartbeatRequest,
  SearchProvidersRequest,
  SearchProvidersResponse,
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
import { AuthIdentityRecord, MarketplaceRepository } from "../repositories/MarketplaceRepository";

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

  public constructor(
    private readonly repository: MarketplaceRepository,
    private readonly analytics: DataEngineeringLogger
  ) {}

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
        willingToTravelMiles: payload.willingToTravelMiles ?? 20,
        preferredSchedule: payload.preferredSchedule ?? "flex",
        hasOwnEquipment: payload.hasOwnEquipment ?? false,
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

    const updatedProvider = await this.repository.updateProvider(provider.id, {
      serviceRadiusMiles: normalizedRadius,
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
    }

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
    return result;
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

  public async createPaymentIntent(payload: CreatePaymentIntentRequest): Promise<PaymentRecord> {
    const payment: PaymentRecord = {
      id: crypto.randomUUID(),
      bookingId: payload.bookingId,
      amountCents: payload.amountCents,
      status: "authorized",
      refundable: true
    };

    this.analytics.recordFunnelStep(MarketplaceTelemetryEventCatalog.paymentAuthorized, payload.bookingId, {
      amountCents: payload.amountCents
    });
    return this.repository.createPayment(payment);
  }

  public async createRefund(payload: CreateRefundRequest): Promise<PaymentRecord> {
    const updatedPayment = await this.repository.updatePayment(payload.paymentId, {
      status: "refunded",
      refundReason: payload.reason,
      refundable: false
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
    requesterId: string,
    payload: CreateSupportTicketRequest
  ): Promise<SupportTicket> {
    const ticket: SupportTicket = {
      id: crypto.randomUUID(),
      bookingId: payload.bookingId,
      requesterId,
      subject: payload.subject,
      description: payload.description,
      issueType: payload.issueType,
      status: "open",
      createdAt: new Date().toISOString()
    };

    this.analytics.recordFunnelStep(MarketplaceTelemetryEventCatalog.supportTicketOpened, requesterId, {
      issueType: payload.issueType,
      bookingId: payload.bookingId ?? "none"
    });
    return this.repository.createSupportTicket(ticket);
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
}
