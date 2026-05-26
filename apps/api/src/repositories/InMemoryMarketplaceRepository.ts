import {
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

export class InMemoryMarketplaceRepository {
  private readonly customers: CustomerProfile[] = [];
  private readonly providers: ProviderProfile[] = [];
  private readonly crewMembers: CrewMemberProfile[] = [];
  private readonly slots: AvailabilitySlot[] = [];
  private readonly bookings: Booking[] = [];
  private readonly payments: PaymentRecord[] = [];
  private readonly providerReviews: ProviderReview[] = [];
  private readonly reviewInvites: ReviewInvite[] = [];
  private readonly supportTickets: SupportTicket[] = [];

  public constructor() {
    this.seedProviders();
  }

  public createCustomer(customer: CustomerProfile): CustomerProfile {
    this.customers.push(customer);
    return customer;
  }

  public createProvider(provider: ProviderProfile): ProviderProfile {
    this.providers.push(provider);
    return provider;
  }

  public createCrewMember(crewMember: CrewMemberProfile): CrewMemberProfile {
    this.crewMembers.push(crewMember);
    return crewMember;
  }

  public listProviders(): ProviderProfile[] {
    return [...this.providers];
  }

  public listCustomers(): CustomerProfile[] {
    return [...this.customers];
  }

  public listCrewMembers(): CrewMemberProfile[] {
    return [...this.crewMembers];
  }

  public findCustomerById(customerId: string): CustomerProfile | undefined {
    return this.customers.find((customer) => customer.id === customerId);
  }

  public findCrewMemberById(crewMemberId: string): CrewMemberProfile | undefined {
    return this.crewMembers.find((crewMember) => crewMember.id === crewMemberId);
  }

  public updateCrewMember(
    crewMemberId: string,
    updates: Partial<CrewMemberProfile>
  ): CrewMemberProfile | undefined {
    const crewMember = this.findCrewMemberById(crewMemberId);

    if (!crewMember) {
      return undefined;
    }

    Object.assign(crewMember, updates);
    return crewMember;
  }

  public updateCustomer(customerId: string, updates: Partial<CustomerProfile>): CustomerProfile | undefined {
    const customer = this.findCustomerById(customerId);

    if (!customer) {
      return undefined;
    }

    Object.assign(customer, updates);
    return customer;
  }

  public listCustomerProperties(customerId: string): CustomerProperty[] {
    return this.findCustomerById(customerId)?.properties ?? [];
  }

  public listSlotsByProvider(providerId: string): AvailabilitySlot[] {
    return this.slots.filter((slot) => slot.providerId === providerId);
  }

  public listAllSlots(): AvailabilitySlot[] {
    return [...this.slots];
  }

  public createBooking(booking: Booking): Booking {
    this.bookings.push(booking);
    return booking;
  }

  public listBookings(): Booking[] {
    return [...this.bookings];
  }

  public findBookingById(bookingId: string): Booking | undefined {
    return this.bookings.find((booking) => booking.id === bookingId);
  }

  public updateBooking(bookingId: string, updates: Partial<Booking>): Booking | undefined {
    const booking = this.findBookingById(bookingId);

    if (!booking) {
      return undefined;
    }

    Object.assign(booking, updates);
    return booking;
  }

  public createProviderReview(review: ProviderReview): ProviderReview {
    this.providerReviews.push(review);
    return review;
  }

  public listProviderReviews(providerId: string): ProviderReview[] {
    return this.providerReviews.filter((review) => review.providerId === providerId).map((review) => ({ ...review }));
  }

  public findProviderReviewByBookingId(bookingId: string): ProviderReview | undefined {
    return this.providerReviews.find((review) => review.bookingId === bookingId);
  }

  public createReviewInvite(invite: ReviewInvite): ReviewInvite {
    this.reviewInvites.push(invite);
    return invite;
  }

  public listReviewInvitesByCustomer(customerId: string): ReviewInvite[] {
    return this.reviewInvites
      .filter((invite) => invite.customerId === customerId)
      .map((invite) => ({ ...invite }));
  }

  public findReviewInviteByBookingId(bookingId: string): ReviewInvite | undefined {
    return this.reviewInvites.find((invite) => invite.bookingId === bookingId);
  }

  public listScheduledReviewInvites(): ReviewInvite[] {
    return this.reviewInvites
      .filter((invite) => invite.status === "scheduled")
      .map((invite) => ({ ...invite }));
  }

  public updateReviewInvite(inviteId: string, updates: Partial<ReviewInvite>): ReviewInvite | undefined {
    const invite = this.reviewInvites.find((item) => item.id === inviteId);

    if (!invite) {
      return undefined;
    }

    Object.assign(invite, updates);
    return invite;
  }

  public appendBookingAddressChange(
    bookingId: string,
    change: BookingAddressChangeRequest
  ): Booking | undefined {
    const booking = this.findBookingById(bookingId);

    if (!booking) {
      return undefined;
    }

    booking.addressChangeHistory.push(change);
    return booking;
  }

  public findProviderById(providerId: string): ProviderProfile | undefined {
    return this.providers.find((provider) => provider.id === providerId);
  }

  public updateProvider(providerId: string, updates: Partial<ProviderProfile>): ProviderProfile | undefined {
    const provider = this.findProviderById(providerId);

    if (!provider) {
      return undefined;
    }

    Object.assign(provider, updates);
    return provider;
  }

  public createPayment(payment: PaymentRecord): PaymentRecord {
    this.payments.push(payment);
    return payment;
  }

  public listPayments(): PaymentRecord[] {
    return [...this.payments];
  }

  public updatePayment(paymentId: string, updates: Partial<PaymentRecord>): PaymentRecord | undefined {
    const payment = this.payments.find((item) => item.id === paymentId);

    if (!payment) {
      return undefined;
    }

    Object.assign(payment, updates);
    return payment;
  }

  public createSupportTicket(ticket: SupportTicket): SupportTicket {
    this.supportTickets.push(ticket);
    return ticket;
  }

  public listSupportTickets(): SupportTicket[] {
    return [...this.supportTickets];
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
}
