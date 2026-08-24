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
  LaunchOperationsTask,
  OpsProfile,
  OpsAutomationRunRecord,
  NotificationDeliveryRecord,
  NotificationPreferences,
  OpsPayoutDisbursementRun,
  ProviderTransferRecord,
  PaymentRecord,
  BookingFinancialSettlement,
  CreateBookingFinancialSettlementInput,
  FinancialLedgerEntry,
  ProviderConnectAccount,
  ProviderCredential,
  PushDevice,
  RecurringServicePlan,
  ProviderProfile,
  ProviderReview,
  LaunchLead,
  ReviewInvite,
  SupportTicket
} from "@yardmatch/contracts";
import { buildSettlementLedgerDraft, calculateMarketplaceSettlement } from "@yardmatch/domain";
import { hashPassword } from "../auth";
import {
  AuthIdentityRecord,
  BookingPageQuery,
  CompleteProviderTransferInput,
  CompleteProviderTransferReversalInput,
  MarketplaceRepository
} from "./MarketplaceRepository";

export class InMemoryMarketplaceRepository implements MarketplaceRepository {
  private readonly customers: CustomerProfile[] = [];
  private readonly providers: ProviderProfile[] = [];
  private readonly crewMembers: CrewMemberProfile[] = [];
  private readonly opsUsers: OpsProfile[] = [];
  private readonly slots: AvailabilitySlot[] = [];
  private readonly bookings: Booking[] = [];
  private readonly recurringServicePlans: RecurringServicePlan[] = [];
  private readonly payments: PaymentRecord[] = [];
  private readonly financialSettlements: BookingFinancialSettlement[] = [];
  private readonly financialLedgerEntries: FinancialLedgerEntry[] = [];
  private readonly payoutDisbursementRuns: OpsPayoutDisbursementRun[] = [];
  private readonly providerTransferRecords: ProviderTransferRecord[] = [];
  private readonly launchOperationsTasks: LaunchOperationsTask[] = [];
  private readonly opsAutomationRuns: OpsAutomationRunRecord[] = [];
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

  public async listBookingsPage(query: BookingPageQuery) {
    const historyStatuses = new Set<Booking["status"]>([
      "completed",
      "cancelled",
      "refunded",
      "disputed"
    ]);
    const sorted = this.bookings
      .filter((booking) =>
        query.actorRole === "customer"
          ? booking.customerId === query.actorId
          : booking.providerId === query.actorId
      )
      .filter((booking) => {
        if (query.scope === "all") {
          return true;
        }
        const isHistory = historyStatuses.has(booking.status);
        return query.scope === "history" ? isHistory : !isHistory;
      })
      .sort((left, right) => {
        const dateOrder = right.scheduledStartIso.localeCompare(left.scheduledStartIso);
        return dateOrder !== 0 ? dateOrder : right.id.localeCompare(left.id);
      });
    const cursorIndex = query.cursorId
      ? sorted.findIndex((booking) => booking.id === query.cursorId)
      : -1;
    if (query.cursorId && cursorIndex < 0) {
      return { items: [], hasMore: false };
    }
    const startIndex = query.cursorId ? cursorIndex + 1 : 0;
    const candidates = sorted.slice(startIndex, startIndex + query.limit + 1);
    const hasMore = candidates.length > query.limit;
    const items = candidates.slice(0, query.limit);
    return {
      items,
      hasMore,
      nextCursorId: hasMore ? items.at(-1)?.id : undefined
    };
  }

  public async listBookingsByIds(bookingIds: string[]): Promise<Booking[]> {
    const requestedIds = new Set(bookingIds);
    return this.bookings.filter((booking) => requestedIds.has(booking.id));
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

  public async listCrewMatchesForBookings(
    bookingIds: string[],
    crewMemberId: string
  ): Promise<CrewMatchCandidate[]> {
    const requestedIds = new Set(bookingIds);
    return this.crewMatches
      .filter((match) => match.crewMemberId === crewMemberId && requestedIds.has(match.bookingId))
      .map((match) => ({ ...match }));
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

  public async listPaymentsForBookingIds(bookingIds: string[]): Promise<PaymentRecord[]> {
    const requestedIds = new Set(bookingIds);
    return this.payments
      .filter((payment) => requestedIds.has(payment.bookingId))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
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

  public async settleBookingFinancials(
    input: CreateBookingFinancialSettlementInput
  ): Promise<BookingFinancialSettlement> {
    const existing = this.financialSettlements.find(
      (settlement) => settlement.bookingId === input.bookingId
    );
    if (existing) {
      return { ...existing };
    }

    const isFirstCompletedCustomerProviderJob = !this.financialSettlements.some(
      (settlement) =>
        settlement.customerId === input.customerId && settlement.providerId === input.providerId
    );
    const breakdown = calculateMarketplaceSettlement({
      customerChargeCents: input.customerChargeCents,
      isFirstCompletedCustomerProviderJob,
      actualProcessorFeeCents: input.actualProcessorFeeCents
    });
    const now = new Date().toISOString();
    const settlement: BookingFinancialSettlement = {
      id: crypto.randomUUID(),
      bookingId: input.bookingId,
      paymentId: input.paymentId,
      customerId: input.customerId,
      providerId: input.providerId,
      currency: input.currency.toLowerCase(),
      ...breakdown,
      isFirstCompletedCustomerProviderJob,
      status: "recorded",
      createdAt: now,
      updatedAt: now
    };
    this.financialSettlements.push(settlement);

    const ledgerDraft = buildSettlementLedgerDraft(input.bookingId, breakdown);
    this.financialLedgerEntries.push(
      ...ledgerDraft.map((entry) => ({
        id: crypto.randomUUID(),
        settlementId: settlement.id,
        bookingId: settlement.bookingId,
        paymentId: settlement.paymentId,
        account: entry.account,
        direction: entry.direction,
        amountCents: entry.amountCents,
        currency: settlement.currency,
        idempotencyKey: entry.idempotencyKey,
        source: entry.account === "payment-processing-expense" ? "processor-fee" as const : "booking-settlement" as const,
        createdAt: now
      }))
    );

    return { ...settlement };
  }

  public async findBookingFinancialSettlement(
    bookingId: string
  ): Promise<BookingFinancialSettlement | undefined> {
    const settlement = this.financialSettlements.find((candidate) => candidate.bookingId === bookingId);
    return settlement ? { ...settlement } : undefined;
  }

  public async listFinancialLedgerEntries(bookingId?: string): Promise<FinancialLedgerEntry[]> {
    return this.financialLedgerEntries
      .filter((entry) => !bookingId || entry.bookingId === bookingId)
      .map((entry) => ({ ...entry }));
  }

  public async listProviderCredentials(providerId: string): Promise<ProviderCredential[]> {
    return (this.providers.find((provider) => provider.id === providerId)?.credentials ?? []).map(
      (credential) => ({ ...credential })
    );
  }

  public async upsertProviderCredential(credential: ProviderCredential): Promise<ProviderCredential> {
    const provider = this.providers.find((candidate) => candidate.id === credential.providerId);
    if (!provider) {
      throw new Error("Provider not found");
    }
    const credentials = provider.credentials ?? [];
    const index = credentials.findIndex(
      (candidate) =>
        candidate.type === credential.type && candidate.jurisdiction === credential.jurisdiction
    );
    if (index >= 0) {
      credentials[index] = { ...credential };
    } else {
      credentials.push({ ...credential });
    }
    provider.credentials = credentials;
    return { ...credential };
  }

  public async findProviderConnectAccount(
    providerId: string
  ): Promise<ProviderConnectAccount | undefined> {
    const account = this.providers.find((provider) => provider.id === providerId)?.connectAccount;
    return account ? { ...account } : undefined;
  }

  public async upsertProviderConnectAccount(
    account: ProviderConnectAccount
  ): Promise<ProviderConnectAccount> {
    const provider = this.providers.find((candidate) => candidate.id === account.providerId);
    if (!provider) {
      throw new Error("Provider not found");
    }
    provider.connectAccount = { ...account };
    return { ...account };
  }

  public async createPayoutDisbursementRun(
    run: OpsPayoutDisbursementRun
  ): Promise<OpsPayoutDisbursementRun> {
    const existing = this.payoutDisbursementRuns.find(
      (candidate) =>
        candidate.previewBatchId === run.previewBatchId &&
        candidate.entryFingerprint === run.entryFingerprint
    );
    if (existing) {
      return { ...existing, entries: [...existing.entries] };
    }
    this.payoutDisbursementRuns.push({ ...run });
    return run;
  }

  public async listPayoutDisbursementRuns(): Promise<OpsPayoutDisbursementRun[]> {
    return this.payoutDisbursementRuns.map((run) => ({ ...run, entries: [...run.entries] }));
  }

  public async findPayoutDisbursementRunByBatchFingerprint(
    previewBatchId: string,
    entryFingerprint: string
  ): Promise<OpsPayoutDisbursementRun | undefined> {
    const run = this.payoutDisbursementRuns.find(
      (candidate) =>
        candidate.previewBatchId === previewBatchId &&
        candidate.entryFingerprint === entryFingerprint
    );
    return run ? { ...run, entries: [...run.entries] } : undefined;
  }

  public async updatePayoutDisbursementRun(
    runId: string,
    updates: Partial<OpsPayoutDisbursementRun>
  ): Promise<OpsPayoutDisbursementRun | undefined> {
    const run = this.payoutDisbursementRuns.find((candidate) => candidate.id === runId);
    if (!run) {
      return undefined;
    }
    Object.assign(run, updates);
    return { ...run, entries: [...run.entries] };
  }

  public async createProviderTransferRecord(
    record: ProviderTransferRecord
  ): Promise<ProviderTransferRecord> {
    const existing = this.providerTransferRecords.find(
      (candidate) =>
        candidate.settlementId === record.settlementId ||
        candidate.idempotencyKey === record.idempotencyKey
    );
    if (existing) {
      return { ...existing };
    }
    this.providerTransferRecords.push({ ...record });
    return { ...record };
  }

  public async findProviderTransferBySettlementId(
    settlementId: string
  ): Promise<ProviderTransferRecord | undefined> {
    const record = this.providerTransferRecords.find(
      (candidate) => candidate.settlementId === settlementId
    );
    return record ? { ...record } : undefined;
  }

  public async listProviderTransferRecords(): Promise<ProviderTransferRecord[]> {
    return this.providerTransferRecords.map((record) => ({ ...record }));
  }

  public async updateProviderTransferRecord(
    transferRecordId: string,
    updates: Partial<ProviderTransferRecord>
  ): Promise<ProviderTransferRecord | undefined> {
    const record = this.providerTransferRecords.find(
      (candidate) => candidate.id === transferRecordId
    );
    if (!record) {
      return undefined;
    }
    Object.assign(record, updates);
    return { ...record };
  }

  public async completeProviderTransfer(
    input: CompleteProviderTransferInput
  ): Promise<ProviderTransferRecord> {
    const record = this.providerTransferRecords.find(
      (candidate) => candidate.id === input.transferRecordId
    );
    if (!record) {
      throw new Error("Provider transfer record not found");
    }
    if (record.status === "transferred" || record.status === "reversed") {
      return { ...record };
    }
    const settlement = this.financialSettlements.find(
      (candidate) => candidate.id === record.settlementId
    );
    if (!settlement) {
      throw new Error("Booking financial settlement not found");
    }
    for (const entry of input.ledgerEntries) {
      if (!this.financialLedgerEntries.some((candidate) => candidate.idempotencyKey === entry.idempotencyKey)) {
        this.financialLedgerEntries.push({ ...entry });
      }
    }
    settlement.status = "transferred";
    settlement.updatedAt = input.transferredAt;
    Object.assign(record, {
      stripeTransferId: input.stripeTransferId,
      status: "transferred" as const,
      failureReason: undefined,
      transferredAt: input.transferredAt,
      updatedAt: input.transferredAt
    });
    return { ...record };
  }

  public async completeProviderTransferReversal(
    input: CompleteProviderTransferReversalInput
  ): Promise<ProviderTransferRecord> {
    const record = this.providerTransferRecords.find(
      (candidate) => candidate.id === input.transferRecordId
    );
    if (!record) {
      throw new Error("Provider transfer record not found");
    }
    if (record.status === "reversed") {
      return { ...record };
    }
    const settlement = this.financialSettlements.find(
      (candidate) => candidate.id === record.settlementId
    );
    if (!settlement) {
      throw new Error("Booking financial settlement not found");
    }
    for (const entry of input.ledgerEntries) {
      if (!this.financialLedgerEntries.some((candidate) => candidate.idempotencyKey === entry.idempotencyKey)) {
        this.financialLedgerEntries.push({ ...entry });
      }
    }
    settlement.status = "reversed";
    settlement.updatedAt = input.reversedAt;
    Object.assign(record, {
      stripeTransferReversalId: input.stripeTransferReversalId,
      status: "reversed" as const,
      failureReason: undefined,
      reversedAt: input.reversedAt,
      updatedAt: input.reversedAt
    });
    return { ...record };
  }

  public async createLaunchOperationsTask(task: LaunchOperationsTask): Promise<LaunchOperationsTask> {
    this.launchOperationsTasks.push({ ...task, relatedScenarioKeys: [...task.relatedScenarioKeys] });
    return task;
  }

  public async listLaunchOperationsTasks(): Promise<LaunchOperationsTask[]> {
    return this.launchOperationsTasks.map((task) => ({
      ...task,
      relatedScenarioKeys: [...task.relatedScenarioKeys]
    }));
  }

  public async findLaunchOperationsTaskByRecommendationFingerprint(
    recommendationFingerprint: string
  ): Promise<LaunchOperationsTask | undefined> {
    const task = this.launchOperationsTasks.find(
      (candidate) => candidate.recommendationFingerprint === recommendationFingerprint
    );
    return task ? { ...task, relatedScenarioKeys: [...task.relatedScenarioKeys] } : undefined;
  }

  public async updateLaunchOperationsTask(
    taskId: string,
    updates: Partial<LaunchOperationsTask>
  ): Promise<LaunchOperationsTask | undefined> {
    const task = this.launchOperationsTasks.find((candidate) => candidate.id === taskId);
    if (!task) {
      return undefined;
    }
    Object.assign(task, updates);
    return { ...task, relatedScenarioKeys: [...task.relatedScenarioKeys] };
  }

  public async createOpsAutomationRun(run: OpsAutomationRunRecord): Promise<OpsAutomationRunRecord> {
    this.opsAutomationRuns.push(run);
    return {
      ...run,
      requestedSweepKeys: [...run.requestedSweepKeys],
      items: run.items.map((item) => ({ ...item }))
    };
  }

  public async listOpsAutomationRuns(): Promise<OpsAutomationRunRecord[]> {
    return this.opsAutomationRuns
      .map((run) => ({
        ...run,
        requestedSweepKeys: [...run.requestedSweepKeys],
        items: run.items.map((item) => ({ ...item }))
      }))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
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
    const defaultProviderPassword = hashPassword("YardMatch123!");
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
        sponsoredListingEnabled: false,
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
        sponsoredListingEnabled: false,
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
      const submittedAt = new Date().toISOString();
      provider.credentials = [
        {
          id: crypto.randomUUID(),
          providerId: provider.id,
          type: "business-registration",
          status: "verified",
          jurisdiction: "NJ",
          referenceNumber: `DEV-BUS-${index + 1}`,
          submittedAt,
          reviewedAt: submittedAt,
          reviewNotes: "Seed-only credential for local development."
        },
        {
          id: crypto.randomUUID(),
          providerId: provider.id,
          type: "general-liability-insurance",
          status: "verified",
          jurisdiction: "NJ",
          referenceNumber: `DEV-GL-${index + 1}`,
          expiresAt: "2099-12-31T23:59:59.000Z",
          submittedAt,
          reviewedAt: submittedAt,
          reviewNotes: "Seed-only credential for local development."
        },
        {
          id: crypto.randomUUID(),
          providerId: provider.id,
          type: "workers-compensation",
          status: "verified",
          jurisdiction: "NJ",
          referenceNumber: `DEV-WC-${index + 1}`,
          expiresAt: "2099-12-31T23:59:59.000Z",
          submittedAt,
          reviewedAt: submittedAt,
          reviewNotes: "Seed-only credential for local development."
        },
        ...(provider.categories.some(
          (category) => category === "fertilization" || category === "weed-control"
        )
          ? [
              {
                id: crypto.randomUUID(),
                providerId: provider.id,
                type: "pesticide-applicator-license" as const,
                status: "verified" as const,
                jurisdiction: "NJ",
                referenceNumber: `DEV-PA-${index + 1}`,
                expiresAt: "2099-12-31T23:59:59.000Z",
                submittedAt,
                reviewedAt: submittedAt,
                reviewNotes: "Seed-only credential for local development."
              }
            ]
          : [])
      ];
      this.providers.push(provider);
      this.saveAuthIdentity(provider.id, provider.email, provider.role, defaultProviderPassword);
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
