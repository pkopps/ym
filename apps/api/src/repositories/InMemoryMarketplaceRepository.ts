import {
  AppNotification,
  Address,
  AvailabilitySlot,
  Booking,
  BookingAddressChangeRequest,
  CrewMatchCandidate,
  CustomerProviderConversation,
  CustomerProviderMessage,
  ProviderCrewConversation,
  ProviderCrewMessage,
  CrewMemberProfile,
  CustomerProperty,
  CustomerProfile,
  OpsProfile,
  NotificationDeliveryRecord,
  NotificationPreferences,
  PaymentRecord,
  PushDevice,
  RecurringServicePlan,
  ProviderProfile,
  ProviderReview,
  LaunchLead,
  ReviewInvite,
  SupportTicket
} from "@yardmatch/contracts";
import { hashPassword } from "../auth";
import { AuthIdentityRecord, MarketplaceRepository } from "./MarketplaceRepository";

export class InMemoryMarketplaceRepository implements MarketplaceRepository {
  private readonly customers: CustomerProfile[] = [];
  private readonly providers: ProviderProfile[] = [];
  private readonly crewMembers: CrewMemberProfile[] = [];
  private readonly opsUsers: OpsProfile[] = [];
  private readonly slots: AvailabilitySlot[] = [];
  private readonly bookings: Booking[] = [];
  private readonly recurringServicePlans: RecurringServicePlan[] = [];
  private readonly payments: PaymentRecord[] = [];
  private readonly launchLeads: LaunchLead[] = [];
  private readonly providerReviews: ProviderReview[] = [];
  private readonly reviewInvites: ReviewInvite[] = [];
  private readonly supportTickets: SupportTicket[] = [];
  private readonly notifications: AppNotification[] = [];
  private readonly notificationPreferences: NotificationPreferences[] = [];
  private readonly notificationDeliveries: NotificationDeliveryRecord[] = [];
  private readonly pushDevices: PushDevice[] = [];
  private readonly crewMatches: CrewMatchCandidate[] = [];
  private readonly providerCrewConversations: ProviderCrewConversation[] = [];
  private readonly providerCrewMessages: ProviderCrewMessage[] = [];
  private readonly customerProviderConversations: CustomerProviderConversation[] = [];
  private readonly customerProviderMessages: CustomerProviderMessage[] = [];
  private readonly authIdentities: AuthIdentityRecord[] = [];

  public constructor() {
    this.seedProviders();
    this.seedOpsUsers();
  }

  public async createCustomer(customer: CustomerProfile, passwordHash?: string): Promise<CustomerProfile> {
    this.customers.push(customer);
    this.saveAuthIdentity(customer.id, customer.email, customer.role, passwordHash);
    return customer;
  }

  public async createProvider(provider: ProviderProfile, passwordHash?: string): Promise<ProviderProfile> {
    this.providers.push(provider);
    this.saveAuthIdentity(provider.id, provider.email, provider.role, passwordHash);
    return provider;
  }

  public async createCrewMember(
    crewMember: CrewMemberProfile,
    passwordHash?: string
  ): Promise<CrewMemberProfile> {
    this.crewMembers.push(crewMember);
    this.saveAuthIdentity(crewMember.id, crewMember.email, crewMember.role, passwordHash);
    return crewMember;
  }

  public async createOpsUser(opsUser: OpsProfile, passwordHash?: string): Promise<OpsProfile> {
    this.opsUsers.push(opsUser);
    this.saveAuthIdentity(opsUser.id, opsUser.email, opsUser.role, passwordHash);
    return opsUser;
  }

  public async listProviders(): Promise<ProviderProfile[]> {
    return [...this.providers];
  }

  public async listCustomers(): Promise<CustomerProfile[]> {
    return [...this.customers];
  }

  public async listCrewMembers(): Promise<CrewMemberProfile[]> {
    return [...this.crewMembers];
  }

  public async listOpsUsers(): Promise<OpsProfile[]> {
    return [...this.opsUsers];
  }

  public async findCustomerById(customerId: string): Promise<CustomerProfile | undefined> {
    return this.customers.find((customer) => customer.id === customerId);
  }

  public async findCrewMemberById(crewMemberId: string): Promise<CrewMemberProfile | undefined> {
    return this.crewMembers.find((crewMember) => crewMember.id === crewMemberId);
  }

  public async findOpsUserById(opsUserId: string): Promise<OpsProfile | undefined> {
    return this.opsUsers.find((opsUser) => opsUser.id === opsUserId);
  }

  public async updateCrewMember(
    crewMemberId: string,
    updates: Partial<CrewMemberProfile>
  ): Promise<CrewMemberProfile | undefined> {
    const crewMember = this.crewMembers.find((item) => item.id === crewMemberId);

    if (!crewMember) {
      return undefined;
    }

    Object.assign(crewMember, updates);
    return crewMember;
  }

  public async updateCustomer(
    customerId: string,
    updates: Partial<CustomerProfile>
  ): Promise<CustomerProfile | undefined> {
    const customer = this.customers.find((item) => item.id === customerId);

    if (!customer) {
      return undefined;
    }

    Object.assign(customer, updates);
    return customer;
  }

  public async updateOpsUser(
    opsUserId: string,
    updates: Partial<OpsProfile>
  ): Promise<OpsProfile | undefined> {
    const opsUser = this.opsUsers.find((item) => item.id === opsUserId);

    if (!opsUser) {
      return undefined;
    }

    Object.assign(opsUser, updates);
    return opsUser;
  }

  public async listCustomerProperties(customerId: string): Promise<CustomerProperty[]> {
    return this.customers.find((customer) => customer.id === customerId)?.properties ?? [];
  }

  public async listSlotsByProvider(providerId: string): Promise<AvailabilitySlot[]> {
    return this.slots.filter((slot) => slot.providerId === providerId);
  }

  public async listAllSlots(): Promise<AvailabilitySlot[]> {
    return [...this.slots];
  }

  public async createBooking(booking: Booking): Promise<Booking> {
    this.bookings.push(booking);
    return booking;
  }

  public async listBookings(): Promise<Booking[]> {
    return [...this.bookings];
  }

  public async findBookingById(bookingId: string): Promise<Booking | undefined> {
    return this.bookings.find((booking) => booking.id === bookingId);
  }

  public async updateBooking(bookingId: string, updates: Partial<Booking>): Promise<Booking | undefined> {
    const booking = this.bookings.find((item) => item.id === bookingId);

    if (!booking) {
      return undefined;
    }

    Object.assign(booking, updates);
    return booking;
  }

  public async createRecurringServicePlan(plan: RecurringServicePlan): Promise<RecurringServicePlan> {
    this.recurringServicePlans.push(plan);
    return plan;
  }

  public async listRecurringServicePlans(): Promise<RecurringServicePlan[]> {
    return this.recurringServicePlans.map((plan) => ({ ...plan }));
  }

  public async findRecurringServicePlanById(planId: string): Promise<RecurringServicePlan | undefined> {
    const plan = this.recurringServicePlans.find((item) => item.id === planId);
    return plan ? { ...plan } : undefined;
  }

  public async updateRecurringServicePlan(
    planId: string,
    updates: Partial<RecurringServicePlan>
  ): Promise<RecurringServicePlan | undefined> {
    const plan = this.recurringServicePlans.find((item) => item.id === planId);
    if (!plan) {
      return undefined;
    }

    Object.assign(plan, updates);
    return { ...plan };
  }

  public async createCrewMatch(match: CrewMatchCandidate): Promise<CrewMatchCandidate> {
    this.crewMatches.push(match);
    return match;
  }

  public async listCrewMatches(): Promise<CrewMatchCandidate[]> {
    return this.crewMatches.map((match) => ({ ...match }));
  }

  public async updateCrewMatch(
    matchId: string,
    updates: Partial<CrewMatchCandidate>
  ): Promise<CrewMatchCandidate | undefined> {
    const match = this.crewMatches.find((item) => item.id === matchId);
    if (!match) {
      return undefined;
    }

    Object.assign(match, updates);
    return match;
  }

  public async findCrewMatchById(matchId: string): Promise<CrewMatchCandidate | undefined> {
    return this.crewMatches.find((match) => match.id === matchId);
  }

  public async createProviderReview(review: ProviderReview): Promise<ProviderReview> {
    this.providerReviews.push(review);
    return review;
  }

  public async listProviderReviews(providerId: string): Promise<ProviderReview[]> {
    return this.providerReviews.filter((review) => review.providerId === providerId).map((review) => ({ ...review }));
  }

  public async findProviderReviewById(reviewId: string): Promise<ProviderReview | undefined> {
    const review = this.providerReviews.find((item) => item.id === reviewId);
    return review ? { ...review } : undefined;
  }

  public async findProviderReviewByBookingId(bookingId: string): Promise<ProviderReview | undefined> {
    const review = this.providerReviews.find((item) => item.bookingId === bookingId);
    return review ? { ...review } : undefined;
  }

  public async updateProviderReview(
    reviewId: string,
    updates: Partial<ProviderReview>
  ): Promise<ProviderReview | undefined> {
    const index = this.providerReviews.findIndex((review) => review.id === reviewId);
    if (index === -1) {
      return undefined;
    }

    this.providerReviews[index] = {
      ...this.providerReviews[index],
      ...updates
    };
    return { ...this.providerReviews[index] };
  }

  public async createReviewInvite(invite: ReviewInvite): Promise<ReviewInvite> {
    this.reviewInvites.push(invite);
    return invite;
  }

  public async listReviewInvites(): Promise<ReviewInvite[]> {
    return this.reviewInvites.map((invite) => ({ ...invite }));
  }

  public async listReviewInvitesByCustomer(customerId: string): Promise<ReviewInvite[]> {
    return this.reviewInvites
      .filter((invite) => invite.customerId === customerId)
      .map((invite) => ({ ...invite }));
  }

  public async findReviewInviteByBookingId(bookingId: string): Promise<ReviewInvite | undefined> {
    return this.reviewInvites.find((invite) => invite.bookingId === bookingId);
  }

  public async listScheduledReviewInvites(): Promise<ReviewInvite[]> {
    return this.reviewInvites
      .filter((invite) => invite.status === "scheduled")
      .map((invite) => ({ ...invite }));
  }

  public async updateReviewInvite(
    inviteId: string,
    updates: Partial<ReviewInvite>
  ): Promise<ReviewInvite | undefined> {
    const invite = this.reviewInvites.find((item) => item.id === inviteId);

    if (!invite) {
      return undefined;
    }

    Object.assign(invite, updates);
    return invite;
  }

  public async appendBookingAddressChange(
    bookingId: string,
    change: BookingAddressChangeRequest
  ): Promise<Booking | undefined> {
    const booking = this.bookings.find((item) => item.id === bookingId);

    if (!booking) {
      return undefined;
    }

    booking.addressChangeHistory.push(change);
    return booking;
  }

  public async findProviderById(providerId: string): Promise<ProviderProfile | undefined> {
    return this.providers.find((provider) => provider.id === providerId);
  }

  public async updateProvider(
    providerId: string,
    updates: Partial<ProviderProfile>
  ): Promise<ProviderProfile | undefined> {
    const provider = this.providers.find((item) => item.id === providerId);

    if (!provider) {
      return undefined;
    }

    Object.assign(provider, updates);
    return provider;
  }

  public async createPayment(payment: PaymentRecord): Promise<PaymentRecord> {
    this.payments.push(payment);
    return payment;
  }

  public async findPaymentById(paymentId: string): Promise<PaymentRecord | undefined> {
    return this.payments.find((payment) => payment.id === paymentId);
  }

  public async findPaymentByCheckoutSessionId(
    checkoutSessionId: string
  ): Promise<PaymentRecord | undefined> {
    return this.payments.find((payment) => payment.checkoutSessionId === checkoutSessionId);
  }

  public async listPayments(): Promise<PaymentRecord[]> {
    return [...this.payments];
  }

  public async updatePayment(
    paymentId: string,
    updates: Partial<PaymentRecord>
  ): Promise<PaymentRecord | undefined> {
    const payment = this.payments.find((item) => item.id === paymentId);

    if (!payment) {
      return undefined;
    }

    Object.assign(payment, updates);
    return payment;
  }

  public async createLaunchLead(lead: LaunchLead): Promise<LaunchLead> {
    this.launchLeads.push(lead);
    return lead;
  }

  public async listLaunchLeads(): Promise<LaunchLead[]> {
    return this.launchLeads.map((lead) => ({ ...lead }));
  }

  public async findLaunchLeadById(leadId: string): Promise<LaunchLead | undefined> {
    const lead = this.launchLeads.find((item) => item.id === leadId);
    return lead ? { ...lead } : undefined;
  }

  public async findLaunchLeadBySourceReferenceId(sourceReferenceId: string): Promise<LaunchLead | undefined> {
    const lead = this.launchLeads.find((item) => item.sourceReferenceId === sourceReferenceId);
    return lead ? { ...lead } : undefined;
  }

  public async updateLaunchLead(
    leadId: string,
    updates: Partial<LaunchLead>
  ): Promise<LaunchLead | undefined> {
    const lead = this.launchLeads.find((item) => item.id === leadId);
    if (!lead) {
      return undefined;
    }

    Object.assign(lead, updates);
    return lead;
  }

  public async createSupportTicket(ticket: SupportTicket): Promise<SupportTicket> {
    this.supportTickets.push(ticket);
    return ticket;
  }

  public async listSupportTickets(): Promise<SupportTicket[]> {
    return [...this.supportTickets];
  }

  public async updateSupportTicket(
    ticketId: string,
    updates: Partial<SupportTicket>
  ): Promise<SupportTicket | undefined> {
    const ticket = this.supportTickets.find((item) => item.id === ticketId);
    if (!ticket) {
      return undefined;
    }

    Object.assign(ticket, updates);
    return ticket;
  }

  public async createNotification(notification: AppNotification): Promise<AppNotification> {
    this.notifications.push(notification);
    return notification;
  }

  public async listNotificationsByRecipient(recipientId: string): Promise<AppNotification[]> {
    return this.notifications
      .filter((notification) => notification.recipientId === recipientId)
      .map((notification) => ({ ...notification }));
  }

  public async updateNotification(
    notificationId: string,
    updates: Partial<AppNotification>
  ): Promise<AppNotification | undefined> {
    const notification = this.notifications.find((item) => item.id === notificationId);
    if (!notification) {
      return undefined;
    }

    Object.assign(notification, updates);
    return notification;
  }

  public async getNotificationPreferences(recipientId: string): Promise<NotificationPreferences | undefined> {
    return this.notificationPreferences.find((item) => item.userId === recipientId);
  }

  public async upsertNotificationPreferences(
    preferences: NotificationPreferences
  ): Promise<NotificationPreferences> {
    const current = this.notificationPreferences.find((item) => item.userId === preferences.userId);
    if (current) {
      Object.assign(current, preferences);
      return current;
    }

    this.notificationPreferences.push(preferences);
    return preferences;
  }

  public async createNotificationDelivery(
    delivery: NotificationDeliveryRecord
  ): Promise<NotificationDeliveryRecord> {
    this.notificationDeliveries.push(delivery);
    return delivery;
  }

  public async listNotificationDeliveriesByRecipient(
    recipientId: string
  ): Promise<NotificationDeliveryRecord[]> {
    return this.notificationDeliveries
      .filter((delivery) => delivery.recipientId === recipientId)
      .map((delivery) => ({ ...delivery }));
  }

  public async listAllNotificationDeliveries(): Promise<NotificationDeliveryRecord[]> {
    return this.notificationDeliveries.map((delivery) => ({ ...delivery }));
  }

  public async updateNotificationDelivery(
    deliveryId: string,
    updates: Partial<NotificationDeliveryRecord>
  ): Promise<NotificationDeliveryRecord | undefined> {
    const delivery = this.notificationDeliveries.find((item) => item.id === deliveryId);
    if (!delivery) {
      return undefined;
    }

    Object.assign(delivery, updates);
    return delivery;
  }

  public async upsertPushDevice(device: PushDevice): Promise<PushDevice> {
    const existing = this.pushDevices.find((item) => item.token === device.token);
    if (existing) {
      Object.assign(existing, device);
      return existing;
    }

    this.pushDevices.push(device);
    return device;
  }

  public async deactivatePushDevice(token: string): Promise<boolean> {
    const device = this.pushDevices.find((item) => item.token === token);
    if (!device) {
      return false;
    }

    device.isActive = false;
    device.updatedAt = new Date().toISOString();
    return true;
  }

  public async listActivePushDevicesByRecipient(
    recipientId: string,
    role: PushDevice["role"]
  ): Promise<PushDevice[]> {
    return this.pushDevices
      .filter((device) => device.userId === recipientId && device.role === role && device.isActive)
      .map((device) => ({ ...device }));
  }

  public async createProviderCrewConversation(
    conversation: ProviderCrewConversation
  ): Promise<ProviderCrewConversation> {
    this.providerCrewConversations.push(conversation);
    return conversation;
  }

  public async findProviderCrewConversationById(
    conversationId: string
  ): Promise<ProviderCrewConversation | undefined> {
    return this.providerCrewConversations.find((conversation) => conversation.id === conversationId);
  }

  public async findProviderCrewConversationByCrewMatchId(
    crewMatchId: string
  ): Promise<ProviderCrewConversation | undefined> {
    return this.providerCrewConversations.find((conversation) => conversation.crewMatchId === crewMatchId);
  }

  public async listProviderCrewConversations(): Promise<ProviderCrewConversation[]> {
    return this.providerCrewConversations.map((conversation) => ({ ...conversation }));
  }

  public async updateProviderCrewConversation(
    conversationId: string,
    updates: Partial<ProviderCrewConversation>
  ): Promise<ProviderCrewConversation | undefined> {
    const conversation = this.providerCrewConversations.find((item) => item.id === conversationId);
    if (!conversation) {
      return undefined;
    }

    Object.assign(conversation, updates);
    return conversation;
  }

  public async createProviderCrewMessage(message: ProviderCrewMessage): Promise<ProviderCrewMessage> {
    this.providerCrewMessages.push(message);
    return message;
  }

  public async listProviderCrewMessages(conversationId: string): Promise<ProviderCrewMessage[]> {
    return this.providerCrewMessages
      .filter((message) => message.threadId === conversationId)
      .map((message) => ({ ...message }));
  }

  public async createCustomerProviderConversation(
    conversation: CustomerProviderConversation
  ): Promise<CustomerProviderConversation> {
    this.customerProviderConversations.push(conversation);
    return conversation;
  }

  public async findCustomerProviderConversationById(
    conversationId: string
  ): Promise<CustomerProviderConversation | undefined> {
    return this.customerProviderConversations.find((conversation) => conversation.id === conversationId);
  }

  public async findCustomerProviderConversationByBookingId(
    bookingId: string
  ): Promise<CustomerProviderConversation | undefined> {
    return this.customerProviderConversations.find((conversation) => conversation.bookingId === bookingId);
  }

  public async listCustomerProviderConversations(): Promise<CustomerProviderConversation[]> {
    return this.customerProviderConversations.map((conversation) => ({ ...conversation }));
  }

  public async updateCustomerProviderConversation(
    conversationId: string,
    updates: Partial<CustomerProviderConversation>
  ): Promise<CustomerProviderConversation | undefined> {
    const conversation = this.customerProviderConversations.find((item) => item.id === conversationId);
    if (!conversation) {
      return undefined;
    }

    Object.assign(conversation, updates);
    return conversation;
  }

  public async createCustomerProviderMessage(
    message: CustomerProviderMessage
  ): Promise<CustomerProviderMessage> {
    this.customerProviderMessages.push(message);
    return message;
  }

  public async listCustomerProviderMessages(conversationId: string): Promise<CustomerProviderMessage[]> {
    return this.customerProviderMessages
      .filter((message) => message.threadId === conversationId)
      .map((message) => ({ ...message }));
  }

  public async findAuthIdentityByEmail(email: string): Promise<AuthIdentityRecord | undefined> {
    return this.authIdentities.find((identity) => identity.email.toLowerCase() === email.toLowerCase());
  }

  public async findAuthIdentityByProvider(
    provider: "google" | "apple",
    subject: string
  ): Promise<AuthIdentityRecord | undefined> {
    return this.authIdentities.find((identity) =>
      provider === "google" ? identity.googleSubject === subject : identity.appleSubject === subject
    );
  }

  public async findAuthIdentityByUserId(userId: string): Promise<AuthIdentityRecord | undefined> {
    return this.authIdentities.find((identity) => identity.userId === userId);
  }

  public async updateAuthIdentity(
    userId: string,
    updates: Partial<AuthIdentityRecord>
  ): Promise<AuthIdentityRecord | undefined> {
    const identity = this.authIdentities.find((item) => item.userId === userId);
    if (!identity) {
      return undefined;
    }

    Object.assign(identity, updates);
    return identity;
  }

  private seedProviders(): void {
    const sampleAddresses: Address[] = [
      this.createAddress("145 Prospect Ave", "Brooklyn", "NY", "11215", 40.6681, -73.9836),
      this.createAddress("88 River Rd", "Jersey City", "NJ", "07310", 40.7261, -74.0321),
      this.createAddress("2118 South St", "Philadelphia", "PA", "19146", 39.9444, -75.1761)
    ];

    const providers: ProviderProfile[] = [
      {
        id: crypto.randomUUID(),
        fullName: "Ariana Fields",
        email: "ariana@greenstride.example",
        phone: "555-0101",
        role: "provider",
        address: sampleAddresses[0],
        createdAt: new Date().toISOString(),
        companyName: "GreenStride Lawn Co.",
        bio: "Weekly mowing, cleanup, edging, leaf service, and winter walkway clearing for busy homeowners.",
        yearsExperience: 7,
        serviceRadiusMiles: 18,
        minimumBookingLeadHours: 0,
        staffingMode: "review-first",
        crewReviewLeadHours: 24,
        departureReminderLeadMinutes: 60,
        routeLeaderMode: "provider-only",
        weeklyPayoutDay: "Thu",
        instantPayoutsEnabled: false,
        verificationStatus: "verified",
        verificationSubmittedAt: new Date().toISOString(),
        verificationReviewedAt: new Date().toISOString(),
        verificationNotes: "Seeded local provider verification for development.",
        sponsoredListingEnabled: true,
        categories: [
          "lawn-mowing",
          "seasonal-cleanup",
          "weed-control",
          "leaf-blowing",
          "gutter-cleaning",
          "snow-shoveling"
        ],
        rating: 4.9,
        timelinessRating: 4.8,
        attentionToDetailRating: 4.9,
        reviewCount: 128,
        calendarConnection: {
          provider: "google",
          connected: true,
          externalCalendarId: "greenstride-main"
        }
      },
      {
        id: crypto.randomUUID(),
        fullName: "Luis Ortega",
        email: "luis@terracut.example",
        phone: "555-0102",
        role: "provider",
        address: sampleAddresses[1],
        createdAt: new Date().toISOString(),
        companyName: "TerraCut Studio",
        bio: "Premium lawn, hedge, mulch, fertilization, and driveway snow service with weekend availability.",
        yearsExperience: 12,
        serviceRadiusMiles: 24,
        minimumBookingLeadHours: 0,
        staffingMode: "review-first",
        crewReviewLeadHours: 24,
        departureReminderLeadMinutes: 60,
        routeLeaderMode: "provider-only",
        weeklyPayoutDay: "Thu",
        instantPayoutsEnabled: false,
        verificationStatus: "verified",
        verificationSubmittedAt: new Date().toISOString(),
        verificationReviewedAt: new Date().toISOString(),
        verificationNotes: "Seeded local provider verification for development.",
        sponsoredListingEnabled: false,
        categories: [
          "lawn-mowing",
          "hedge-trimming",
          "mulch-installation",
          "fertilization",
          "aeration",
          "snow-blowing"
        ],
        rating: 4.8,
        timelinessRating: 4.7,
        attentionToDetailRating: 4.9,
        reviewCount: 221,
        calendarConnection: {
          provider: "apple",
          connected: true,
          externalCalendarId: "terracut-pro"
        }
      },
      {
        id: crypto.randomUUID(),
        fullName: "Nina Brooks",
        email: "nina@cedarstone.example",
        phone: "555-0103",
        role: "provider",
        address: sampleAddresses[2],
        createdAt: new Date().toISOString(),
        companyName: "Cedarstone Landscaping",
        bio: "Cleanup, irrigation checks, lawn refresh packages, gutter care, and winter de-icing support.",
        yearsExperience: 10,
        serviceRadiusMiles: 30,
        minimumBookingLeadHours: 0,
        staffingMode: "review-first",
        crewReviewLeadHours: 24,
        departureReminderLeadMinutes: 60,
        routeLeaderMode: "provider-only",
        weeklyPayoutDay: "Thu",
        instantPayoutsEnabled: false,
        verificationStatus: "verified",
        verificationSubmittedAt: new Date().toISOString(),
        verificationReviewedAt: new Date().toISOString(),
        verificationNotes: "Seeded local provider verification for development.",
        sponsoredListingEnabled: true,
        categories: [
          "seasonal-cleanup",
          "irrigation-check",
          "lawn-mowing",
          "leaf-blowing",
          "gutter-cleaning",
          "ice-melt-salting"
        ],
        rating: 4.7,
        timelinessRating: 4.8,
        attentionToDetailRating: 4.6,
        reviewCount: 173,
        calendarConnection: {
          provider: "outlook",
          connected: true,
          externalCalendarId: "cedarstone-schedule"
        }
      }
    ];

    providers.forEach((provider, index) => {
      this.providers.push(provider);
      this.saveAuthIdentity(provider.id, provider.email, provider.role);
      this.slots.push(
        {
          id: crypto.randomUUID(),
          providerId: provider.id,
          startIso: this.addHours(index + 2),
          endIso: this.addHours(index + 3),
          isBooked: false
        },
        {
          id: crypto.randomUUID(),
          providerId: provider.id,
          startIso: this.addHours(index + 26),
          endIso: this.addHours(index + 27),
          isBooked: false
        }
      );
    });
  }

  private seedOpsUsers(): void {
    const now = new Date().toISOString();
    const defaultOpsPassword = hashPassword("YardMatch123!");
    const opsUsers: OpsProfile[] = [
      {
        id: crypto.randomUUID(),
        fullName: "Casey Ops",
        email: "ops@example.com",
        phone: "555-0990",
        role: "ops",
        address: this.createAddress("18 Bay Ave", "Barnegat", "NJ", "08005", 39.7532, -74.2229),
        createdAt: now,
        internalScope: "admin"
      }
    ];

    opsUsers.forEach((opsUser) => {
      this.opsUsers.push(opsUser);
      this.saveAuthIdentity(opsUser.id, opsUser.email, opsUser.role, defaultOpsPassword);
    });
  }

  private createAddress(
    line1: string,
    city: string,
    state: string,
    postalCode: string,
    latitude: number,
    longitude: number
  ): Address {
    return {
      line1,
      city,
      state,
      postalCode,
      country: "US",
      point: {
        latitude,
        longitude
      }
    };
  }

  private addHours(hours: number): string {
    return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
  }

  private saveAuthIdentity(
    userId: string,
    email: string,
    role: AuthIdentityRecord["role"],
    passwordHash?: string
  ): void {
    const existing = this.authIdentities.find((identity) => identity.userId === userId);
    if (existing) {
      existing.email = email;
      existing.role = role;
      existing.passwordHash = passwordHash ?? existing.passwordHash;
      return;
    }

    this.authIdentities.push({
      userId,
      email,
      role,
      passwordHash,
      googleSubject: undefined,
      appleSubject: undefined,
      sessionVersion: 1,
      accessHistory: [],
      authHistory: [],
      failedAuthenticationCount: 0,
      authenticationLockExpiresAt: undefined,
      lastAccessChangeKind: "created",
      lastAccessChangeAt: new Date().toISOString()
    });
  }
}
