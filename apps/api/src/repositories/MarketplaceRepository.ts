import {
  ActiveSession,
  Address,
  AvailabilitySlot,
  Booking,
  BookingAddressChangeRequest,
  CrewMemberProfile,
  CustomerProperty,
  CustomerProfile,
  PaymentRecord,
  ProviderProfile,
  ProviderReview,
  ReviewInvite,
  SupportTicket
} from "@yardmatch/contracts";

export interface AuthIdentityRecord {
  userId: string;
  email: string;
  passwordHash?: string;
  role: CustomerProfile["role"] | ProviderProfile["role"] | CrewMemberProfile["role"];
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
  listPayments(): Promise<PaymentRecord[]>;
  updatePayment(paymentId: string, updates: Partial<PaymentRecord>): Promise<PaymentRecord | undefined>;
  createSupportTicket(ticket: SupportTicket): Promise<SupportTicket>;
  listSupportTickets(): Promise<SupportTicket[]>;
  findAuthIdentityByEmail(email: string): Promise<AuthIdentityRecord | undefined>;
  findAuthIdentityByUserId(userId: string): Promise<AuthIdentityRecord | undefined>;
}
