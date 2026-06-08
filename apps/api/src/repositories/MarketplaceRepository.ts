import {
  AppNotification,
  ActiveSession,
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
  NotificationDeliveryRecord,
  NotificationPreferences,
  PaymentRecord,
  PushDevice,
  ProviderProfile,
  ProviderReview,
  SupportOpsTicket,
  ReviewInvite,
  SupportTicket
} from "@yardmatch/contracts";

export interface AuthIdentityRecord {
  userId: string;
  email: string;
  passwordHash?: string;
  googleSubject?: string;
  appleSubject?: string;
  role: CustomerProfile["role"] | ProviderProfile["role"] | CrewMemberProfile["role"];
  sessionVersion: number;
  resetPasswordCodeHash?: string;
  resetPasswordExpiresAt?: string;
  resetPasswordRequestedAt?: string;
}

export interface MarketplaceRepository {
  createCustomer(customer: CustomerProfile, passwordHash?: string): Promise<CustomerProfile>;
  createProvider(provider: ProviderProfile, passwordHash?: string): Promise<ProviderProfile>;
  createCrewMember(crewMember: CrewMemberProfile, passwordHash?: string): Promise<CrewMemberProfile>;
  listProviders(): Promise<ProviderProfile[]>;
  listCustomers(): Promise<CustomerProfile[]>;
  listCrewMembers(): Promise<CrewMemberProfile[]>;
  findCustomerById(customerId: string): Promise<CustomerProfile | undefined>;
  findCrewMemberById(crewMemberId: string): Promise<CrewMemberProfile | undefined>;
  updateCrewMember(
    crewMemberId: string,
    updates: Partial<CrewMemberProfile>
  ): Promise<CrewMemberProfile | undefined>;
  updateCustomer(customerId: string, updates: Partial<CustomerProfile>): Promise<CustomerProfile | undefined>;
  listCustomerProperties(customerId: string): Promise<CustomerProperty[]>;
  listSlotsByProvider(providerId: string): Promise<AvailabilitySlot[]>;
  listAllSlots(): Promise<AvailabilitySlot[]>;
  createBooking(booking: Booking): Promise<Booking>;
  listBookings(): Promise<Booking[]>;
  findBookingById(bookingId: string): Promise<Booking | undefined>;
  updateBooking(bookingId: string, updates: Partial<Booking>): Promise<Booking | undefined>;
  createCrewMatch(match: CrewMatchCandidate): Promise<CrewMatchCandidate>;
  listCrewMatches(): Promise<CrewMatchCandidate[]>;
  updateCrewMatch(matchId: string, updates: Partial<CrewMatchCandidate>): Promise<CrewMatchCandidate | undefined>;
  findCrewMatchById(matchId: string): Promise<CrewMatchCandidate | undefined>;
  createProviderReview(review: ProviderReview): Promise<ProviderReview>;
  listProviderReviews(providerId: string): Promise<ProviderReview[]>;
  findProviderReviewByBookingId(bookingId: string): Promise<ProviderReview | undefined>;
  createReviewInvite(invite: ReviewInvite): Promise<ReviewInvite>;
  listReviewInvitesByCustomer(customerId: string): Promise<ReviewInvite[]>;
  findReviewInviteByBookingId(bookingId: string): Promise<ReviewInvite | undefined>;
  listScheduledReviewInvites(): Promise<ReviewInvite[]>;
  updateReviewInvite(inviteId: string, updates: Partial<ReviewInvite>): Promise<ReviewInvite | undefined>;
  appendBookingAddressChange(
    bookingId: string,
    change: BookingAddressChangeRequest
  ): Promise<Booking | undefined>;
  findProviderById(providerId: string): Promise<ProviderProfile | undefined>;
  updateProvider(providerId: string, updates: Partial<ProviderProfile>): Promise<ProviderProfile | undefined>;
  createPayment(payment: PaymentRecord): Promise<PaymentRecord>;
  findPaymentById(paymentId: string): Promise<PaymentRecord | undefined>;
  findPaymentByCheckoutSessionId(checkoutSessionId: string): Promise<PaymentRecord | undefined>;
  listPayments(): Promise<PaymentRecord[]>;
  updatePayment(paymentId: string, updates: Partial<PaymentRecord>): Promise<PaymentRecord | undefined>;
  createSupportTicket(ticket: SupportTicket): Promise<SupportTicket>;
  listSupportTickets(): Promise<SupportTicket[]>;
  updateSupportTicket(ticketId: string, updates: Partial<SupportTicket>): Promise<SupportTicket | undefined>;
  createNotification(notification: AppNotification): Promise<AppNotification>;
  listNotificationsByRecipient(recipientId: string): Promise<AppNotification[]>;
  updateNotification(
    notificationId: string,
    updates: Partial<AppNotification>
  ): Promise<AppNotification | undefined>;
  getNotificationPreferences(recipientId: string): Promise<NotificationPreferences | undefined>;
  upsertNotificationPreferences(preferences: NotificationPreferences): Promise<NotificationPreferences>;
  createNotificationDelivery(delivery: NotificationDeliveryRecord): Promise<NotificationDeliveryRecord>;
  listNotificationDeliveriesByRecipient(recipientId: string): Promise<NotificationDeliveryRecord[]>;
  updateNotificationDelivery(
    deliveryId: string,
    updates: Partial<NotificationDeliveryRecord>
  ): Promise<NotificationDeliveryRecord | undefined>;
  upsertPushDevice(device: PushDevice): Promise<PushDevice>;
  deactivatePushDevice(token: string): Promise<boolean>;
  listActivePushDevicesByRecipient(recipientId: string, role: PushDevice["role"]): Promise<PushDevice[]>;
  createProviderCrewConversation(conversation: ProviderCrewConversation): Promise<ProviderCrewConversation>;
  findProviderCrewConversationById(conversationId: string): Promise<ProviderCrewConversation | undefined>;
  findProviderCrewConversationByCrewMatchId(
    crewMatchId: string
  ): Promise<ProviderCrewConversation | undefined>;
  listProviderCrewConversations(): Promise<ProviderCrewConversation[]>;
  updateProviderCrewConversation(
    conversationId: string,
    updates: Partial<ProviderCrewConversation>
  ): Promise<ProviderCrewConversation | undefined>;
  createProviderCrewMessage(message: ProviderCrewMessage): Promise<ProviderCrewMessage>;
  listProviderCrewMessages(conversationId: string): Promise<ProviderCrewMessage[]>;
  createCustomerProviderConversation(
    conversation: CustomerProviderConversation
  ): Promise<CustomerProviderConversation>;
  findCustomerProviderConversationById(
    conversationId: string
  ): Promise<CustomerProviderConversation | undefined>;
  findCustomerProviderConversationByBookingId(
    bookingId: string
  ): Promise<CustomerProviderConversation | undefined>;
  listCustomerProviderConversations(): Promise<CustomerProviderConversation[]>;
  updateCustomerProviderConversation(
    conversationId: string,
    updates: Partial<CustomerProviderConversation>
  ): Promise<CustomerProviderConversation | undefined>;
  createCustomerProviderMessage(message: CustomerProviderMessage): Promise<CustomerProviderMessage>;
  listCustomerProviderMessages(conversationId: string): Promise<CustomerProviderMessage[]>;
  findAuthIdentityByEmail(email: string): Promise<AuthIdentityRecord | undefined>;
  findAuthIdentityByProvider(
    provider: "google" | "apple",
    subject: string
  ): Promise<AuthIdentityRecord | undefined>;
  findAuthIdentityByUserId(userId: string): Promise<AuthIdentityRecord | undefined>;
  updateAuthIdentity(
    userId: string,
    updates: Partial<AuthIdentityRecord>
  ): Promise<AuthIdentityRecord | undefined>;
}
