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
  OpsAuthenticationMethod,
  OpsAuthenticationHistoryEntry,
  OpsFailedAuthenticationReason,
  LaunchOperationsTask,
  CustomerProperty,
  CustomerProfile,
  OpsProfile,
  NotificationDeliveryRecord,
  NotificationPreferences,
  OpsAutomationRunRecord,
  PaymentRecord,
  BookingFinancialSettlement,
  CreateBookingFinancialSettlementInput,
  FinancialLedgerEntry,
  ProviderConnectAccount,
  ProviderCredential,
  OpsPayoutDisbursementRun,
  PushDevice,
  RecurringServicePlan,
  ProviderProfile,
  ProviderReview,
  LaunchLead,
  OpsAccessHistoryEntry,
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
  role: CustomerProfile["role"] | ProviderProfile["role"] | CrewMemberProfile["role"] | "ops";
  sessionVersion: number;
  accessDisabledAt?: string;
  accessDisabledBy?: string;
  accessChangeNotes?: string;
  lastAccessChangeAt?: string;
  lastAccessChangeBy?: string;
  lastAccessChangeKind?:
    | "created"
    | "profile-updated"
    | "sessions-rotated"
    | "password-reset-invited"
    | "deactivated"
    | "reactivated"
    | "auth-lock-cleared";
  accessHistory?: OpsAccessHistoryEntry[];
  authHistory?: OpsAuthenticationHistoryEntry[];
  lastAuthenticatedAt?: string;
  lastAuthenticatedMethod?: OpsAuthenticationMethod;
  failedAuthenticationCount?: number;
  lastFailedAuthenticationAt?: string;
  lastFailedAuthenticationReason?: OpsFailedAuthenticationReason;
  authenticationLockExpiresAt?: string;
  resetPasswordCodeHash?: string;
  resetPasswordExpiresAt?: string;
  resetPasswordRequestedAt?: string;
}

export interface MarketplaceRepository {
  createCustomer(customer: CustomerProfile, passwordHash?: string): Promise<CustomerProfile>;
  createProvider(provider: ProviderProfile, passwordHash?: string): Promise<ProviderProfile>;
  createCrewMember(crewMember: CrewMemberProfile, passwordHash?: string): Promise<CrewMemberProfile>;
  createOpsUser(opsUser: OpsProfile, passwordHash?: string): Promise<OpsProfile>;
  listProviders(): Promise<ProviderProfile[]>;
  listCustomers(): Promise<CustomerProfile[]>;
  listCrewMembers(): Promise<CrewMemberProfile[]>;
  listOpsUsers(): Promise<OpsProfile[]>;
  findCustomerById(customerId: string): Promise<CustomerProfile | undefined>;
  findCrewMemberById(crewMemberId: string): Promise<CrewMemberProfile | undefined>;
  findOpsUserById(opsUserId: string): Promise<OpsProfile | undefined>;
  updateCrewMember(
    crewMemberId: string,
    updates: Partial<CrewMemberProfile>
  ): Promise<CrewMemberProfile | undefined>;
  updateCustomer(customerId: string, updates: Partial<CustomerProfile>): Promise<CustomerProfile | undefined>;
  updateOpsUser(opsUserId: string, updates: Partial<OpsProfile>): Promise<OpsProfile | undefined>;
  listCustomerProperties(customerId: string): Promise<CustomerProperty[]>;
  listSlotsByProvider(providerId: string): Promise<AvailabilitySlot[]>;
  listAllSlots(): Promise<AvailabilitySlot[]>;
  createBooking(booking: Booking): Promise<Booking>;
  listBookings(): Promise<Booking[]>;
  findBookingById(bookingId: string): Promise<Booking | undefined>;
  updateBooking(bookingId: string, updates: Partial<Booking>): Promise<Booking | undefined>;
  createRecurringServicePlan(plan: RecurringServicePlan): Promise<RecurringServicePlan>;
  listRecurringServicePlans(): Promise<RecurringServicePlan[]>;
  findRecurringServicePlanById(planId: string): Promise<RecurringServicePlan | undefined>;
  updateRecurringServicePlan(
    planId: string,
    updates: Partial<RecurringServicePlan>
  ): Promise<RecurringServicePlan | undefined>;
  createCrewMatch(match: CrewMatchCandidate): Promise<CrewMatchCandidate>;
  listCrewMatches(): Promise<CrewMatchCandidate[]>;
  updateCrewMatch(matchId: string, updates: Partial<CrewMatchCandidate>): Promise<CrewMatchCandidate | undefined>;
  findCrewMatchById(matchId: string): Promise<CrewMatchCandidate | undefined>;
  createProviderReview(review: ProviderReview): Promise<ProviderReview>;
  listProviderReviews(providerId: string): Promise<ProviderReview[]>;
  findProviderReviewById(reviewId: string): Promise<ProviderReview | undefined>;
  findProviderReviewByBookingId(bookingId: string): Promise<ProviderReview | undefined>;
  updateProviderReview(reviewId: string, updates: Partial<ProviderReview>): Promise<ProviderReview | undefined>;
  createReviewInvite(invite: ReviewInvite): Promise<ReviewInvite>;
  listReviewInvites(): Promise<ReviewInvite[]>;
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
  settleBookingFinancials(
    input: CreateBookingFinancialSettlementInput
  ): Promise<BookingFinancialSettlement>;
  findBookingFinancialSettlement(
    bookingId: string
  ): Promise<BookingFinancialSettlement | undefined>;
  listFinancialLedgerEntries(bookingId?: string): Promise<FinancialLedgerEntry[]>;
  listProviderCredentials(providerId: string): Promise<ProviderCredential[]>;
  upsertProviderCredential(credential: ProviderCredential): Promise<ProviderCredential>;
  findProviderConnectAccount(providerId: string): Promise<ProviderConnectAccount | undefined>;
  upsertProviderConnectAccount(account: ProviderConnectAccount): Promise<ProviderConnectAccount>;
  createPayoutDisbursementRun(run: OpsPayoutDisbursementRun): Promise<OpsPayoutDisbursementRun>;
  listPayoutDisbursementRuns(): Promise<OpsPayoutDisbursementRun[]>;
  findPayoutDisbursementRunByBatchFingerprint(
    previewBatchId: string,
    entryFingerprint: string
  ): Promise<OpsPayoutDisbursementRun | undefined>;
  createLaunchOperationsTask(task: LaunchOperationsTask): Promise<LaunchOperationsTask>;
  listLaunchOperationsTasks(): Promise<LaunchOperationsTask[]>;
  findLaunchOperationsTaskByRecommendationFingerprint(
    recommendationFingerprint: string
  ): Promise<LaunchOperationsTask | undefined>;
  updateLaunchOperationsTask(
    taskId: string,
    updates: Partial<LaunchOperationsTask>
  ): Promise<LaunchOperationsTask | undefined>;
  createOpsAutomationRun(run: OpsAutomationRunRecord): Promise<OpsAutomationRunRecord>;
  listOpsAutomationRuns(): Promise<OpsAutomationRunRecord[]>;
  createLaunchLead(lead: LaunchLead): Promise<LaunchLead>;
  listLaunchLeads(): Promise<LaunchLead[]>;
  findLaunchLeadById(leadId: string): Promise<LaunchLead | undefined>;
  findLaunchLeadBySourceReferenceId(sourceReferenceId: string): Promise<LaunchLead | undefined>;
  updateLaunchLead(leadId: string, updates: Partial<LaunchLead>): Promise<LaunchLead | undefined>;
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
  listAllNotificationDeliveries(): Promise<NotificationDeliveryRecord[]>;
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
