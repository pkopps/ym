import { PrismaClient } from "@prisma/client";
import {
  Address,
  AvailabilitySlot,
  Booking,
  BookingAddressChangeRequest,
  CalendarConnection,
  CrewMatchCandidate,
  ProviderCrewConversation,
  ProviderCrewMessage,
  CrewMemberProfile,
  CustomerProperty,
  CustomerProfile,
  PaymentRecord,
  ProviderProfile,
  ProviderReview,
  ReviewInvite,
  SupportTicket
} from "@yardmatch/contracts";
import { AuthIdentityRecord, MarketplaceRepository } from "./MarketplaceRepository";

function asJson(value: unknown): any {
  return value as any;
}

function readJson<T>(value: unknown): T {
  return value as T;
}

function mapCustomerProperty(record: {
  id: string;
  label: string;
  address: unknown;
  gateCode: string | null;
  accessNotes: string | null;
  lawnSizeSqFt: number | null;
  shrubBedSqFt: number | null;
  drivewaySqFt: number | null;
  sidewalkLinearFt: number | null;
  isDefault: boolean;
  createdAt: Date;
}): CustomerProperty {
  return {
    id: record.id,
    label: record.label,
    address: readJson<Address>(record.address),
    gateCode: record.gateCode ?? undefined,
    accessNotes: record.accessNotes ?? undefined,
    lawnSizeSqFt: record.lawnSizeSqFt ?? undefined,
    shrubBedSqFt: record.shrubBedSqFt ?? undefined,
    drivewaySqFt: record.drivewaySqFt ?? undefined,
    sidewalkLinearFt: record.sidewalkLinearFt ?? undefined,
    isDefault: record.isDefault,
    createdAt: record.createdAt.toISOString()
  };
}

export class PrismaMarketplaceRepository implements MarketplaceRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async createCustomer(
    customer: CustomerProfile,
    passwordHash?: string
  ): Promise<CustomerProfile> {
    await this.prisma.$transaction(async (tx: any) => {
      await tx.userAccount.create({
        data: {
          id: customer.id,
          email: customer.email,
          passwordHash,
          fullName: customer.fullName,
          phone: customer.phone,
          role: customer.role,
          address: asJson(customer.address),
          createdAt: new Date(customer.createdAt)
        }
      });

      await tx.customerProfile.create({
        data: {
          userId: customer.id,
          propertyNotes: customer.propertyNotes,
          lawnSizeSqFt: customer.lawnSizeSqFt,
          defaultPropertyId: customer.defaultPropertyId
        }
      });

      if (customer.properties.length > 0) {
        await tx.customerProperty.createMany({
          data: customer.properties.map((property) => ({
            id: property.id,
            customerId: customer.id,
            label: property.label,
            address: asJson(property.address),
            gateCode: property.gateCode,
            accessNotes: property.accessNotes,
            lawnSizeSqFt: property.lawnSizeSqFt,
            shrubBedSqFt: property.shrubBedSqFt,
            drivewaySqFt: property.drivewaySqFt,
            sidewalkLinearFt: property.sidewalkLinearFt,
            isDefault: property.isDefault,
            createdAt: new Date(property.createdAt)
          }))
        });
      }
    });

    return (await this.findCustomerById(customer.id))!;
  }

  public async createProvider(
    provider: ProviderProfile,
    passwordHash?: string
  ): Promise<ProviderProfile> {
    await this.prisma.$transaction(async (tx: any) => {
      await tx.userAccount.create({
        data: {
          id: provider.id,
          email: provider.email,
          passwordHash,
          fullName: provider.fullName,
          phone: provider.phone,
          role: provider.role,
          address: asJson(provider.address),
          createdAt: new Date(provider.createdAt)
        }
      });

      await tx.providerBusinessProfile.create({
        data: {
          userId: provider.id,
          companyName: provider.companyName,
          bio: provider.bio,
          yearsExperience: provider.yearsExperience,
          serviceRadiusMiles: provider.serviceRadiusMiles,
          staffingMode: provider.staffingMode,
          sponsoredListingEnabled: provider.sponsoredListingEnabled,
          categories: provider.categories,
          rating: provider.rating,
          timelinessRating: provider.timelinessRating,
          attentionToDetailRating: provider.attentionToDetailRating,
          reviewCount: provider.reviewCount,
          calendarConnection: asJson(provider.calendarConnection)
        }
      });
    });

    return (await this.findProviderById(provider.id))!;
  }

  public async createCrewMember(
    crewMember: CrewMemberProfile,
    passwordHash?: string
  ): Promise<CrewMemberProfile> {
    await this.prisma.$transaction(async (tx: any) => {
      await tx.userAccount.create({
        data: {
          id: crewMember.id,
          email: crewMember.email,
          passwordHash,
          fullName: crewMember.fullName,
          phone: crewMember.phone,
          role: crewMember.role,
          address: asJson(crewMember.address),
          createdAt: new Date(crewMember.createdAt)
        }
      });

      await tx.crewMemberProfile.create({
        data: {
          userId: crewMember.id,
          bio: crewMember.bio,
          yearsExperience: crewMember.yearsExperience,
          categories: crewMember.categories,
          availableWeekdays: crewMember.availableWeekdays,
          willingToTravelMiles: crewMember.willingToTravelMiles,
          preferredSchedule: crewMember.preferredSchedule,
          hasOwnEquipment: crewMember.hasOwnEquipment,
          winterWorkEnabled: crewMember.winterWorkEnabled,
          rating: crewMember.rating,
          completedJobs: crewMember.completedJobs,
          status: crewMember.status,
          assignedProviderId: crewMember.assignedProviderId
        }
      });
    });

    return (await this.findCrewMemberById(crewMember.id))!;
  }

  public async listProviders(): Promise<ProviderProfile[]> {
    const providers = await this.prisma.providerBusinessProfile.findMany({
      include: {
        user: true
      }
    });

    return providers.map((record: any) => this.mapProviderProfile(record.user, record));
  }

  public async listCustomers(): Promise<CustomerProfile[]> {
    const customers = await this.prisma.customerProfile.findMany({
      include: {
        user: true,
        properties: true
      }
    });

    return customers.map((record: any) => this.mapCustomerProfile(record.user, record, record.properties));
  }

  public async listCrewMembers(): Promise<CrewMemberProfile[]> {
    const crewMembers = await this.prisma.crewMemberProfile.findMany({
      include: {
        user: true
      }
    });

    return crewMembers.map((record: any) => this.mapCrewMemberProfile(record.user, record));
  }

  public async findCustomerById(customerId: string): Promise<CustomerProfile | undefined> {
    const customer = await this.prisma.customerProfile.findUnique({
      where: {
        userId: customerId
      },
      include: {
        user: true,
        properties: true
      }
    });

    return customer
      ? this.mapCustomerProfile(customer.user, customer, customer.properties)
      : undefined;
  }

  public async findCrewMemberById(crewMemberId: string): Promise<CrewMemberProfile | undefined> {
    const crewMember = await this.prisma.crewMemberProfile.findUnique({
      where: {
        userId: crewMemberId
      },
      include: {
        user: true
      }
    });

    return crewMember ? this.mapCrewMemberProfile(crewMember.user, crewMember) : undefined;
  }

  public async updateCrewMember(
    crewMemberId: string,
    updates: Partial<CrewMemberProfile>
  ): Promise<CrewMemberProfile | undefined> {
    const current = await this.findCrewMemberById(crewMemberId);
    if (!current) {
      return undefined;
    }

    await this.prisma.$transaction(async (tx: any) => {
      await tx.userAccount.update({
        where: { id: crewMemberId },
        data: this.buildUserAccountUpdate(updates)
      });

      await tx.crewMemberProfile.update({
        where: { userId: crewMemberId },
        data: {
          bio: updates.bio,
          yearsExperience: updates.yearsExperience,
          categories: updates.categories,
          availableWeekdays: updates.availableWeekdays,
          willingToTravelMiles: updates.willingToTravelMiles,
          preferredSchedule: updates.preferredSchedule,
          hasOwnEquipment: updates.hasOwnEquipment,
          winterWorkEnabled: updates.winterWorkEnabled,
          rating: updates.rating,
          completedJobs: updates.completedJobs,
          status: updates.status,
          assignedProviderId: updates.assignedProviderId
        }
      });
    });

    return this.findCrewMemberById(crewMemberId);
  }

  public async updateCustomer(
    customerId: string,
    updates: Partial<CustomerProfile>
  ): Promise<CustomerProfile | undefined> {
    const current = await this.findCustomerById(customerId);
    if (!current) {
      return undefined;
    }

    await this.prisma.$transaction(async (tx: any) => {
      await tx.userAccount.update({
        where: { id: customerId },
        data: this.buildUserAccountUpdate(updates)
      });

      await tx.customerProfile.update({
        where: { userId: customerId },
        data: {
          propertyNotes: updates.propertyNotes,
          lawnSizeSqFt: updates.lawnSizeSqFt,
          defaultPropertyId: updates.defaultPropertyId
        }
      });

      if (updates.properties) {
        await tx.customerProperty.deleteMany({
          where: { customerId }
        });

        if (updates.properties.length > 0) {
          await tx.customerProperty.createMany({
            data: updates.properties.map((property) => ({
              id: property.id,
              customerId,
              label: property.label,
              address: asJson(property.address),
              gateCode: property.gateCode,
              accessNotes: property.accessNotes,
              lawnSizeSqFt: property.lawnSizeSqFt,
              shrubBedSqFt: property.shrubBedSqFt,
              drivewaySqFt: property.drivewaySqFt,
              sidewalkLinearFt: property.sidewalkLinearFt,
              isDefault: property.isDefault,
              createdAt: new Date(property.createdAt)
            }))
          });
        }
      }
    });

    return this.findCustomerById(customerId);
  }

  public async listCustomerProperties(customerId: string): Promise<CustomerProperty[]> {
    const properties = await this.prisma.customerProperty.findMany({
      where: { customerId },
      orderBy: { createdAt: "asc" }
    });
    return properties.map((property: any) => mapCustomerProperty(property));
  }

  public async listSlotsByProvider(providerId: string): Promise<AvailabilitySlot[]> {
    const slots = await this.prisma.availabilitySlot.findMany({
      where: { providerId },
      orderBy: { startIso: "asc" }
    });
    return slots.map((slot: any) => ({
      id: slot.id,
      providerId: slot.providerId,
      startIso: slot.startIso.toISOString(),
      endIso: slot.endIso.toISOString(),
      isBooked: slot.isBooked
    }));
  }

  public async listAllSlots(): Promise<AvailabilitySlot[]> {
    const slots = await this.prisma.availabilitySlot.findMany({
      orderBy: { startIso: "asc" }
    });
    return slots.map((slot: any) => ({
      id: slot.id,
      providerId: slot.providerId,
      startIso: slot.startIso.toISOString(),
      endIso: slot.endIso.toISOString(),
      isBooked: slot.isBooked
    }));
  }

  public async createBooking(booking: Booking): Promise<Booking> {
    await this.prisma.booking.create({
      data: {
        id: booking.id,
        customerId: booking.customerId,
        providerId: booking.providerId,
        serviceAddress: asJson(booking.serviceAddress),
        servicePropertyId: booking.servicePropertyId,
        category: booking.category,
        requestedAt: new Date(booking.requestedAt),
        scheduledStartIso: new Date(booking.scheduledStartIso),
        scheduledEndIso: new Date(booking.scheduledEndIso),
        status: booking.status,
        completedAt: booking.completedAt ? new Date(booking.completedAt) : undefined,
        notes: booking.notes,
        totalCents: booking.totalCents,
        reviewId: booking.reviewId,
        addressChangeHistory: asJson(booking.addressChangeHistory)
      }
    });
    return booking;
  }

  public async listBookings(): Promise<Booking[]> {
    const bookings = await this.prisma.booking.findMany({
      orderBy: { scheduledStartIso: "asc" }
    });
    return bookings.map((booking: any) => this.mapBooking(booking));
  }

  public async findBookingById(bookingId: string): Promise<Booking | undefined> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId }
    });
    return booking ? this.mapBooking(booking) : undefined;
  }

  public async updateBooking(bookingId: string, updates: Partial<Booking>): Promise<Booking | undefined> {
    const current = await this.findBookingById(bookingId);
    if (!current) {
      return undefined;
    }

    const booking = await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        customerId: updates.customerId,
        providerId: updates.providerId,
        serviceAddress: updates.serviceAddress ? asJson(updates.serviceAddress) : undefined,
        servicePropertyId: updates.servicePropertyId,
        category: updates.category,
        requestedAt: updates.requestedAt ? new Date(updates.requestedAt) : undefined,
        scheduledStartIso: updates.scheduledStartIso ? new Date(updates.scheduledStartIso) : undefined,
        scheduledEndIso: updates.scheduledEndIso ? new Date(updates.scheduledEndIso) : undefined,
        status: updates.status,
        completedAt: updates.completedAt ? new Date(updates.completedAt) : updates.completedAt === undefined ? undefined : null,
        notes: updates.notes,
        totalCents: updates.totalCents,
        reviewId: updates.reviewId,
        addressChangeHistory: updates.addressChangeHistory ? asJson(updates.addressChangeHistory) : undefined
      }
    });

    return this.mapBooking(booking);
  }

  public async createCrewMatch(match: CrewMatchCandidate): Promise<CrewMatchCandidate> {
    await this.prisma.crewMatch.create({
      data: {
        id: match.id,
        bookingId: match.bookingId,
        providerId: match.providerId,
        crewMemberId: match.crewMemberId,
        crewMemberName: match.crewMemberName,
        crewMemberPhone: match.crewMemberPhone,
        categories: match.categories,
        availableWeekdays: match.availableWeekdays,
        preferredSchedule: match.preferredSchedule,
        willingToTravelMiles: match.willingToTravelMiles,
        hasOwnEquipment: match.hasOwnEquipment,
        winterWorkEnabled: match.winterWorkEnabled,
        status: match.status,
        autoAccepted: match.autoAccepted,
        distanceMiles: match.distanceMiles,
        hourlyRateCents: match.hourlyRateCents,
        createdAt: new Date(match.createdAt),
        reviewedAt: match.reviewedAt ? new Date(match.reviewedAt) : undefined
      }
    });
    return match;
  }

  public async listCrewMatches(): Promise<CrewMatchCandidate[]> {
    const matches = await this.prisma.crewMatch.findMany({
      orderBy: { createdAt: "desc" }
    });
    return matches.map((match: any) => this.mapCrewMatch(match));
  }

  public async updateCrewMatch(
    matchId: string,
    updates: Partial<CrewMatchCandidate>
  ): Promise<CrewMatchCandidate | undefined> {
    const current = await this.prisma.crewMatch.findUnique({
      where: { id: matchId }
    });
    if (!current) {
      return undefined;
    }

    const match = await this.prisma.crewMatch.update({
      where: { id: matchId },
      data: {
        crewMemberName: updates.crewMemberName,
        crewMemberPhone: updates.crewMemberPhone,
        categories: updates.categories,
        availableWeekdays: updates.availableWeekdays,
        preferredSchedule: updates.preferredSchedule,
        willingToTravelMiles: updates.willingToTravelMiles,
        hasOwnEquipment: updates.hasOwnEquipment,
        winterWorkEnabled: updates.winterWorkEnabled,
        status: updates.status,
        autoAccepted: updates.autoAccepted,
        distanceMiles: updates.distanceMiles,
        hourlyRateCents: updates.hourlyRateCents,
        reviewedAt: updates.reviewedAt
          ? new Date(updates.reviewedAt)
          : updates.reviewedAt === undefined
            ? undefined
            : null
      }
    });

    return this.mapCrewMatch(match);
  }

  public async findCrewMatchById(matchId: string): Promise<CrewMatchCandidate | undefined> {
    const match = await this.prisma.crewMatch.findUnique({
      where: { id: matchId }
    });
    return match ? this.mapCrewMatch(match) : undefined;
  }

  public async createProviderReview(review: ProviderReview): Promise<ProviderReview> {
    await this.prisma.providerReview.create({
      data: {
        id: review.id,
        bookingId: review.bookingId,
        providerId: review.providerId,
        customerId: review.customerId,
        overallRating: review.overallRating,
        timelinessRating: review.timelinessRating,
        attentionToDetailRating: review.attentionToDetailRating,
        reviewText: review.reviewText,
        createdAt: new Date(review.createdAt)
      }
    });
    return review;
  }

  public async listProviderReviews(providerId: string): Promise<ProviderReview[]> {
    const reviews = await this.prisma.providerReview.findMany({
      where: { providerId },
      orderBy: { createdAt: "desc" }
    });
    return reviews.map((review: any) => this.mapProviderReview(review));
  }

  public async findProviderReviewByBookingId(bookingId: string): Promise<ProviderReview | undefined> {
    const review = await this.prisma.providerReview.findUnique({
      where: { bookingId }
    });
    return review ? this.mapProviderReview(review) : undefined;
  }

  public async createReviewInvite(invite: ReviewInvite): Promise<ReviewInvite> {
    await this.prisma.reviewInvite.create({
      data: {
        id: invite.id,
        bookingId: invite.bookingId,
        customerId: invite.customerId,
        providerId: invite.providerId,
        email: invite.email,
        status: invite.status,
        channels: invite.channels,
        scheduledSendIso: new Date(invite.scheduledSendIso),
        sentAt: invite.sentAt ? new Date(invite.sentAt) : undefined,
        openedAt: invite.openedAt ? new Date(invite.openedAt) : undefined,
        completedAt: invite.completedAt ? new Date(invite.completedAt) : undefined,
        expiresAtIso: new Date(invite.expiresAtIso),
        deepLinkPath: invite.deepLinkPath
      }
    });
    return invite;
  }

  public async listReviewInvitesByCustomer(customerId: string): Promise<ReviewInvite[]> {
    const invites = await this.prisma.reviewInvite.findMany({
      where: { customerId }
    });
    return invites.map((invite: any) => this.mapReviewInvite(invite));
  }

  public async findReviewInviteByBookingId(bookingId: string): Promise<ReviewInvite | undefined> {
    const invite = await this.prisma.reviewInvite.findUnique({
      where: { bookingId }
    });
    return invite ? this.mapReviewInvite(invite) : undefined;
  }

  public async listScheduledReviewInvites(): Promise<ReviewInvite[]> {
    const invites = await this.prisma.reviewInvite.findMany({
      where: { status: "scheduled" }
    });
    return invites.map((invite: any) => this.mapReviewInvite(invite));
  }

  public async updateReviewInvite(
    inviteId: string,
    updates: Partial<ReviewInvite>
  ): Promise<ReviewInvite | undefined> {
    const current = await this.prisma.reviewInvite.findUnique({
      where: { id: inviteId }
    });
    if (!current) {
      return undefined;
    }

    const invite = await this.prisma.reviewInvite.update({
      where: { id: inviteId },
      data: {
        status: updates.status,
        channels: updates.channels,
        scheduledSendIso: updates.scheduledSendIso ? new Date(updates.scheduledSendIso) : undefined,
        sentAt: updates.sentAt ? new Date(updates.sentAt) : updates.sentAt === undefined ? undefined : null,
        openedAt: updates.openedAt ? new Date(updates.openedAt) : updates.openedAt === undefined ? undefined : null,
        completedAt:
          updates.completedAt ? new Date(updates.completedAt) : updates.completedAt === undefined ? undefined : null,
        expiresAtIso: updates.expiresAtIso ? new Date(updates.expiresAtIso) : undefined,
        deepLinkPath: updates.deepLinkPath
      }
    });
    return this.mapReviewInvite(invite);
  }

  public async appendBookingAddressChange(
    bookingId: string,
    change: BookingAddressChangeRequest
  ): Promise<Booking | undefined> {
    const current = await this.findBookingById(bookingId);
    if (!current) {
      return undefined;
    }

    return this.updateBooking(bookingId, {
      addressChangeHistory: [...current.addressChangeHistory, change]
    });
  }

  public async findProviderById(providerId: string): Promise<ProviderProfile | undefined> {
    const provider = await this.prisma.providerBusinessProfile.findUnique({
      where: { userId: providerId },
      include: { user: true }
    });
    return provider ? this.mapProviderProfile(provider.user, provider) : undefined;
  }

  public async updateProvider(
    providerId: string,
    updates: Partial<ProviderProfile>
  ): Promise<ProviderProfile | undefined> {
    const current = await this.findProviderById(providerId);
    if (!current) {
      return undefined;
    }

    await this.prisma.$transaction(async (tx: any) => {
      await tx.userAccount.update({
        where: { id: providerId },
        data: this.buildUserAccountUpdate(updates)
      });

      await tx.providerBusinessProfile.update({
        where: { userId: providerId },
        data: {
          companyName: updates.companyName,
          bio: updates.bio,
          yearsExperience: updates.yearsExperience,
          serviceRadiusMiles: updates.serviceRadiusMiles,
          staffingMode: updates.staffingMode,
          sponsoredListingEnabled: updates.sponsoredListingEnabled,
          categories: updates.categories,
          rating: updates.rating,
          timelinessRating: updates.timelinessRating,
          attentionToDetailRating: updates.attentionToDetailRating,
          reviewCount: updates.reviewCount,
          calendarConnection: updates.calendarConnection ? asJson(updates.calendarConnection) : undefined
        }
      });
    });

    return this.findProviderById(providerId);
  }

  public async createPayment(payment: PaymentRecord): Promise<PaymentRecord> {
    await this.prisma.paymentRecord.create({
      data: payment
    });
    return payment;
  }

  public async listPayments(): Promise<PaymentRecord[]> {
    const payments = await this.prisma.paymentRecord.findMany();
    return payments.map((payment: any) => this.mapPaymentRecord(payment));
  }

  public async updatePayment(
    paymentId: string,
    updates: Partial<PaymentRecord>
  ): Promise<PaymentRecord | undefined> {
    const current = await this.prisma.paymentRecord.findUnique({
      where: { id: paymentId }
    });
    if (!current) {
      return undefined;
    }

    const payment = await this.prisma.paymentRecord.update({
      where: { id: paymentId },
      data: updates
    });
    return this.mapPaymentRecord(payment);
  }

  public async createSupportTicket(ticket: SupportTicket): Promise<SupportTicket> {
    await this.prisma.supportTicket.create({
      data: {
        ...ticket,
        createdAt: new Date(ticket.createdAt)
      }
    });
    return ticket;
  }

  public async listSupportTickets(): Promise<SupportTicket[]> {
    const tickets = await this.prisma.supportTicket.findMany({
      orderBy: { createdAt: "desc" }
    });
    return tickets.map((ticket: any) => ({
      ...ticket,
      bookingId: ticket.bookingId ?? undefined,
      createdAt: ticket.createdAt.toISOString()
    }));
  }

  public async createProviderCrewConversation(
    conversation: ProviderCrewConversation
  ): Promise<ProviderCrewConversation> {
    await this.prisma.providerCrewConversation.create({
      data: {
        id: conversation.id,
        crewMatchId: conversation.crewMatchId,
        bookingId: conversation.bookingId,
        providerId: conversation.providerId,
        crewMemberId: conversation.crewMemberId,
        providerName: conversation.providerName,
        crewMemberName: conversation.crewMemberName,
        status: conversation.status,
        updatedAt: new Date(conversation.updatedAt),
        lastMessagePreview: conversation.lastMessagePreview,
        unreadCount: conversation.unreadCount,
        createdAt: new Date(conversation.updatedAt)
      }
    });
    return conversation;
  }

  public async findProviderCrewConversationById(
    conversationId: string
  ): Promise<ProviderCrewConversation | undefined> {
    const conversation = await this.prisma.providerCrewConversation.findUnique({
      where: { id: conversationId }
    });
    return conversation ? this.mapProviderCrewConversation(conversation) : undefined;
  }

  public async findProviderCrewConversationByCrewMatchId(
    crewMatchId: string
  ): Promise<ProviderCrewConversation | undefined> {
    const conversation = await this.prisma.providerCrewConversation.findUnique({
      where: { crewMatchId }
    });
    return conversation ? this.mapProviderCrewConversation(conversation) : undefined;
  }

  public async listProviderCrewConversations(): Promise<ProviderCrewConversation[]> {
    const conversations = await this.prisma.providerCrewConversation.findMany({
      orderBy: { updatedAt: "desc" }
    });
    return conversations.map((conversation: any) => this.mapProviderCrewConversation(conversation));
  }

  public async updateProviderCrewConversation(
    conversationId: string,
    updates: Partial<ProviderCrewConversation>
  ): Promise<ProviderCrewConversation | undefined> {
    const current = await this.prisma.providerCrewConversation.findUnique({
      where: { id: conversationId }
    });
    if (!current) {
      return undefined;
    }

    const conversation = await this.prisma.providerCrewConversation.update({
      where: { id: conversationId },
      data: {
        status: updates.status,
        updatedAt: updates.updatedAt ? new Date(updates.updatedAt) : undefined,
        lastMessagePreview: updates.lastMessagePreview,
        unreadCount: updates.unreadCount
      }
    });
    return this.mapProviderCrewConversation(conversation);
  }

  public async createProviderCrewMessage(message: ProviderCrewMessage): Promise<ProviderCrewMessage> {
    await this.prisma.providerCrewMessage.create({
      data: {
        id: message.id,
        conversationId: message.threadId,
        senderId: message.senderId,
        senderRole: message.senderRole,
        body: message.body,
        createdAt: new Date(message.createdAt)
      }
    });
    return message;
  }

  public async listProviderCrewMessages(conversationId: string): Promise<ProviderCrewMessage[]> {
    const messages = await this.prisma.providerCrewMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" }
    });
    return messages.map((message: any) => this.mapProviderCrewMessage(message));
  }

  public async findAuthIdentityByEmail(email: string): Promise<AuthIdentityRecord | undefined> {
    const identity = await this.prisma.userAccount.findUnique({
      where: { email: email.toLowerCase() }
    });
    return identity
      ? {
          userId: identity.id,
          email: identity.email,
          passwordHash: identity.passwordHash ?? undefined,
          role: identity.role as AuthIdentityRecord["role"]
        }
      : undefined;
  }

  public async findAuthIdentityByUserId(userId: string): Promise<AuthIdentityRecord | undefined> {
    const identity = await this.prisma.userAccount.findUnique({
      where: { id: userId }
    });
    return identity
      ? {
          userId: identity.id,
          email: identity.email,
          passwordHash: identity.passwordHash ?? undefined,
          role: identity.role as AuthIdentityRecord["role"]
        }
      : undefined;
  }

  private buildUserAccountUpdate(
    updates: Partial<CustomerProfile> | Partial<ProviderProfile> | Partial<CrewMemberProfile>
  ): any {
    return {
      email: updates.email?.toLowerCase(),
      fullName: updates.fullName,
      phone: updates.phone,
      address: updates.address ? asJson(updates.address) : undefined
    };
  }

  private mapCustomerProfile(
    user: {
      id: string;
      fullName: string;
      email: string;
      phone: string;
      role: string;
      address: unknown;
      createdAt: Date;
    },
    profile: {
      propertyNotes: string;
      lawnSizeSqFt: number;
      defaultPropertyId: string | null;
    },
    properties: Array<{
      id: string;
      label: string;
      address: unknown;
      gateCode: string | null;
      accessNotes: string | null;
      lawnSizeSqFt: number | null;
      shrubBedSqFt: number | null;
      drivewaySqFt: number | null;
      sidewalkLinearFt: number | null;
      isDefault: boolean;
      createdAt: Date;
    }>
  ): CustomerProfile {
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      role: "customer",
      address: readJson<Address>(user.address),
      createdAt: user.createdAt.toISOString(),
      propertyNotes: profile.propertyNotes,
      lawnSizeSqFt: profile.lawnSizeSqFt,
      properties: properties.map((property) => mapCustomerProperty(property)),
      defaultPropertyId: profile.defaultPropertyId ?? properties.find((property) => property.isDefault)?.id ?? ""
    };
  }

  private mapProviderProfile(
    user: {
      id: string;
      fullName: string;
      email: string;
      phone: string;
      role: string;
      address: unknown;
      createdAt: Date;
    },
    profile: {
      companyName: string;
      bio: string;
      yearsExperience: number;
      serviceRadiusMiles: number;
      staffingMode?: string;
      sponsoredListingEnabled: boolean;
      categories: string[];
      rating: number;
      timelinessRating: number;
      attentionToDetailRating: number;
      reviewCount: number;
      calendarConnection: unknown;
    }
  ): ProviderProfile {
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      role: "provider",
      address: readJson<Address>(user.address),
      createdAt: user.createdAt.toISOString(),
      companyName: profile.companyName,
      bio: profile.bio,
      yearsExperience: profile.yearsExperience,
      serviceRadiusMiles: profile.serviceRadiusMiles,
      staffingMode: (profile.staffingMode as ProviderProfile["staffingMode"] | undefined) ?? "review-first",
      sponsoredListingEnabled: profile.sponsoredListingEnabled,
      categories: profile.categories as ProviderProfile["categories"],
      rating: profile.rating,
      timelinessRating: profile.timelinessRating,
      attentionToDetailRating: profile.attentionToDetailRating,
      reviewCount: profile.reviewCount,
      calendarConnection: readJson<CalendarConnection>(profile.calendarConnection)
    };
  }

  private mapCrewMemberProfile(
    user: {
      id: string;
      fullName: string;
      email: string;
      phone: string;
      role: string;
      address: unknown;
      createdAt: Date;
    },
    profile: {
      bio: string;
      yearsExperience: number;
      categories: string[];
      availableWeekdays?: string[];
      willingToTravelMiles: number;
      preferredSchedule: string;
      hasOwnEquipment: boolean;
      winterWorkEnabled?: boolean;
      rating: number;
      completedJobs: number;
      status: string;
      assignedProviderId: string | null;
    }
  ): CrewMemberProfile {
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      role: "crew-member",
      address: readJson<Address>(user.address),
      createdAt: user.createdAt.toISOString(),
      bio: profile.bio,
      yearsExperience: profile.yearsExperience,
      categories: profile.categories as CrewMemberProfile["categories"],
      availableWeekdays:
        (profile.availableWeekdays as CrewMemberProfile["availableWeekdays"] | undefined) ??
        ["Mon", "Tue", "Wed", "Thu", "Fri"],
      willingToTravelMiles: profile.willingToTravelMiles,
      preferredSchedule: profile.preferredSchedule as CrewMemberProfile["preferredSchedule"],
      hasOwnEquipment: profile.hasOwnEquipment,
      winterWorkEnabled: profile.winterWorkEnabled ?? true,
      rating: profile.rating,
      completedJobs: profile.completedJobs,
      status: profile.status as CrewMemberProfile["status"],
      assignedProviderId: profile.assignedProviderId ?? undefined
    };
  }

  private mapBooking(record: {
    id: string;
    customerId: string;
    providerId: string;
    serviceAddress: unknown;
    servicePropertyId: string | null;
    category: string;
    requestedAt: Date;
    scheduledStartIso: Date;
    scheduledEndIso: Date;
    status: string;
    completedAt: Date | null;
    notes: string;
    totalCents: number;
    reviewId: string | null;
    addressChangeHistory: unknown;
  }): Booking {
    return {
      id: record.id,
      customerId: record.customerId,
      providerId: record.providerId,
      serviceAddress: readJson<Address>(record.serviceAddress),
      servicePropertyId: record.servicePropertyId ?? undefined,
      category: record.category as Booking["category"],
      requestedAt: record.requestedAt.toISOString(),
      scheduledStartIso: record.scheduledStartIso.toISOString(),
      scheduledEndIso: record.scheduledEndIso.toISOString(),
      status: record.status as Booking["status"],
      completedAt: record.completedAt?.toISOString(),
      notes: record.notes,
      totalCents: record.totalCents,
      reviewId: record.reviewId ?? undefined,
      addressChangeHistory: readJson<BookingAddressChangeRequest[]>(record.addressChangeHistory)
    };
  }

  private mapReviewInvite(record: {
    id: string;
    bookingId: string;
    customerId: string;
    providerId: string;
    email: string;
    status: string;
    channels: string[];
    scheduledSendIso: Date;
    sentAt: Date | null;
      openedAt: Date | null;
      completedAt: Date | null;
    expiresAtIso: Date;
    deepLinkPath: string;
  }): ReviewInvite {
    return {
      id: record.id,
      bookingId: record.bookingId,
      customerId: record.customerId,
      providerId: record.providerId,
      email: record.email,
      status: record.status as ReviewInvite["status"],
      channels: record.channels as ReviewInvite["channels"],
      scheduledSendIso: record.scheduledSendIso.toISOString(),
      sentAt: record.sentAt?.toISOString(),
      openedAt: record.openedAt?.toISOString(),
      completedAt: record.completedAt?.toISOString(),
      expiresAtIso: record.expiresAtIso.toISOString(),
      deepLinkPath: record.deepLinkPath
    };
  }

  private mapProviderReview(record: {
    id: string;
    bookingId: string;
    providerId: string;
    customerId: string;
    overallRating: number;
    timelinessRating: number;
    attentionToDetailRating: number;
    reviewText: string;
    createdAt: Date;
  }): ProviderReview {
    return {
      id: record.id,
      bookingId: record.bookingId,
      providerId: record.providerId,
      customerId: record.customerId,
      overallRating: record.overallRating as ProviderReview["overallRating"],
      timelinessRating: record.timelinessRating as ProviderReview["timelinessRating"],
      attentionToDetailRating:
        record.attentionToDetailRating as ProviderReview["attentionToDetailRating"],
      reviewText: record.reviewText,
      createdAt: record.createdAt.toISOString()
    };
  }

  private mapPaymentRecord(record: {
    id: string;
    bookingId: string;
    amountCents: number;
    status: string;
    refundable: boolean;
    refundReason: string | null;
  }): PaymentRecord {
    return {
      id: record.id,
      bookingId: record.bookingId,
      amountCents: record.amountCents,
      status: record.status as PaymentRecord["status"],
      refundable: record.refundable,
      refundReason: record.refundReason ?? undefined
    };
  }

  private mapCrewMatch(record: {
    id: string;
    bookingId: string;
    providerId: string;
    crewMemberId: string;
    crewMemberName: string;
    crewMemberPhone: string;
    categories: string[];
    availableWeekdays: string[];
    preferredSchedule: string;
    willingToTravelMiles: number;
    hasOwnEquipment: boolean;
    winterWorkEnabled: boolean;
    status: string;
    autoAccepted: boolean;
    distanceMiles: number;
    hourlyRateCents: number;
    createdAt: Date;
    reviewedAt: Date | null;
  }): CrewMatchCandidate {
    return {
      id: record.id,
      bookingId: record.bookingId,
      providerId: record.providerId,
      crewMemberId: record.crewMemberId,
      crewMemberName: record.crewMemberName,
      crewMemberPhone: record.crewMemberPhone,
      categories: record.categories as CrewMatchCandidate["categories"],
      availableWeekdays: record.availableWeekdays as CrewMatchCandidate["availableWeekdays"],
      preferredSchedule: record.preferredSchedule as CrewMatchCandidate["preferredSchedule"],
      willingToTravelMiles: record.willingToTravelMiles,
      hasOwnEquipment: record.hasOwnEquipment,
      winterWorkEnabled: record.winterWorkEnabled,
      status: record.status as CrewMatchCandidate["status"],
      autoAccepted: record.autoAccepted,
      distanceMiles: record.distanceMiles,
      hourlyRateCents: record.hourlyRateCents,
      createdAt: record.createdAt.toISOString(),
      reviewedAt: record.reviewedAt?.toISOString()
    };
  }

  private mapProviderCrewConversation(record: {
    id: string;
    crewMatchId: string;
    bookingId: string;
    providerId: string;
    crewMemberId: string;
    providerName: string;
    crewMemberName: string;
    status: string;
    updatedAt: Date;
    lastMessagePreview: string | null;
    unreadCount: number;
  }): ProviderCrewConversation {
    return {
      id: record.id,
      crewMatchId: record.crewMatchId,
      bookingId: record.bookingId,
      providerId: record.providerId,
      crewMemberId: record.crewMemberId,
      providerName: record.providerName,
      crewMemberName: record.crewMemberName,
      status: record.status as ProviderCrewConversation["status"],
      updatedAt: record.updatedAt.toISOString(),
      lastMessagePreview: record.lastMessagePreview ?? undefined,
      unreadCount: record.unreadCount
    };
  }

  private mapProviderCrewMessage(record: {
    id: string;
    conversationId: string;
    senderId: string;
    senderRole: string;
    body: string;
    createdAt: Date;
  }): ProviderCrewMessage {
    return {
      id: record.id,
      threadId: record.conversationId,
      senderId: record.senderId,
      senderRole: record.senderRole as ProviderCrewMessage["senderRole"],
      body: record.body,
      createdAt: record.createdAt.toISOString()
    };
  }
}
