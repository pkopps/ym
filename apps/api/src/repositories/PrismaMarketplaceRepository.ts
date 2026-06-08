import { PrismaClient } from "@prisma/client";
import {
  AppNotification,
  Address,
  AvailabilitySlot,
  Booking,
  BookingAddressChangeRequest,
  CalendarConnection,
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
        onRouteConfirmedAt: booking.onRouteConfirmedAt ? new Date(booking.onRouteConfirmedAt) : undefined,
        onRouteConfirmedByCrewMemberId: booking.onRouteConfirmedByCrewMemberId,
        lateNoticeSentAt: booking.lateNoticeSentAt ? new Date(booking.lateNoticeSentAt) : undefined,
        lateEtaIso: booking.lateEtaIso ? new Date(booking.lateEtaIso) : undefined,
        lateReason: booking.lateReason,
        activeExceptionType: booking.activeExceptionType,
        activeExceptionReportedAt: booking.activeExceptionReportedAt
          ? new Date(booking.activeExceptionReportedAt)
          : undefined,
        activeExceptionNotes: booking.activeExceptionNotes,
        routeLivePoint: booking.routeLivePoint ? asJson(booking.routeLivePoint) : undefined,
        routeLiveUpdatedAt: booking.routeLiveUpdatedAt ? new Date(booking.routeLiveUpdatedAt) : undefined,
        routeLiveSource: booking.routeLiveSource,
        routeLiveSpeedMph: booking.routeLiveSpeedMph,
        routeLiveAccuracyMeters: booking.routeLiveAccuracyMeters,
        disputedAt: booking.disputedAt ? new Date(booking.disputedAt) : undefined,
        disputeReason: booking.disputeReason,
        disputedByRole: booking.disputedByRole,
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
        onRouteConfirmedAt:
          "onRouteConfirmedAt" in updates
            ? updates.onRouteConfirmedAt
              ? new Date(updates.onRouteConfirmedAt)
              : null
            : undefined,
        onRouteConfirmedByCrewMemberId:
          "onRouteConfirmedByCrewMemberId" in updates
            ? updates.onRouteConfirmedByCrewMemberId ?? null
            : undefined,
        lateNoticeSentAt:
          "lateNoticeSentAt" in updates
            ? updates.lateNoticeSentAt
              ? new Date(updates.lateNoticeSentAt)
              : null
            : undefined,
        lateEtaIso:
          "lateEtaIso" in updates
            ? updates.lateEtaIso
              ? new Date(updates.lateEtaIso)
              : null
            : undefined,
        lateReason: "lateReason" in updates ? updates.lateReason ?? null : undefined,
        activeExceptionType:
          "activeExceptionType" in updates ? updates.activeExceptionType ?? null : undefined,
        activeExceptionReportedAt:
          "activeExceptionReportedAt" in updates
            ? updates.activeExceptionReportedAt
              ? new Date(updates.activeExceptionReportedAt)
              : null
            : undefined,
        activeExceptionNotes:
          "activeExceptionNotes" in updates ? updates.activeExceptionNotes ?? null : undefined,
        routeLivePoint:
          "routeLivePoint" in updates
            ? updates.routeLivePoint
              ? asJson(updates.routeLivePoint)
              : null
            : undefined,
        routeLiveUpdatedAt:
          "routeLiveUpdatedAt" in updates
            ? updates.routeLiveUpdatedAt
              ? new Date(updates.routeLiveUpdatedAt)
              : null
            : undefined,
        routeLiveSource: "routeLiveSource" in updates ? updates.routeLiveSource ?? null : undefined,
        routeLiveSpeedMph:
          "routeLiveSpeedMph" in updates ? updates.routeLiveSpeedMph ?? null : undefined,
        routeLiveAccuracyMeters:
          "routeLiveAccuracyMeters" in updates ? updates.routeLiveAccuracyMeters ?? null : undefined,
        disputedAt:
          "disputedAt" in updates
            ? updates.disputedAt
              ? new Date(updates.disputedAt)
              : null
            : undefined,
        disputeReason: "disputeReason" in updates ? updates.disputeReason ?? null : undefined,
        disputedByRole:
          "disputedByRole" in updates ? updates.disputedByRole ?? null : undefined,
        completedAt:
          "completedAt" in updates
            ? updates.completedAt
              ? new Date(updates.completedAt)
              : null
            : undefined,
        notes: updates.notes,
        totalCents: updates.totalCents,
        reviewId: "reviewId" in updates ? updates.reviewId ?? null : undefined,
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
      data: {
        ...payment,
        refundRequestedAt: payment.refundRequestedAt ? new Date(payment.refundRequestedAt) : undefined,
        refundReviewedAt: payment.refundReviewedAt ? new Date(payment.refundReviewedAt) : undefined,
        paidAt: payment.paidAt ? new Date(payment.paidAt) : undefined,
        createdAt: new Date(payment.createdAt),
        updatedAt: new Date(payment.updatedAt)
      }
    });
    return payment;
  }

  public async findPaymentById(paymentId: string): Promise<PaymentRecord | undefined> {
    const payment = await this.prisma.paymentRecord.findUnique({
      where: { id: paymentId }
    });
    return payment ? this.mapPaymentRecord(payment) : undefined;
  }

  public async findPaymentByCheckoutSessionId(
    checkoutSessionId: string
  ): Promise<PaymentRecord | undefined> {
    const payment = await this.prisma.paymentRecord.findFirst({
      where: { checkoutSessionId }
    });
    return payment ? this.mapPaymentRecord(payment) : undefined;
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
      data: {
        ...updates,
        refundRequestedAt:
          updates.refundRequestedAt
            ? new Date(updates.refundRequestedAt)
            : updates.refundRequestedAt === undefined
              ? undefined
              : null,
        refundReviewedAt:
          updates.refundReviewedAt
            ? new Date(updates.refundReviewedAt)
            : updates.refundReviewedAt === undefined
              ? undefined
              : null,
        paidAt: updates.paidAt ? new Date(updates.paidAt) : updates.paidAt === undefined ? undefined : null,
        updatedAt: updates.updatedAt ? new Date(updates.updatedAt) : undefined
      }
    });
    return this.mapPaymentRecord(payment);
  }

  public async createSupportTicket(ticket: SupportTicket): Promise<SupportTicket> {
    await this.prisma.supportTicket.create({
      data: {
        ...ticket,
        createdAt: new Date(ticket.createdAt),
        updatedAt: new Date(ticket.updatedAt),
        triagedAt: ticket.triagedAt ? new Date(ticket.triagedAt) : undefined,
        resolvedAt: ticket.resolvedAt ? new Date(ticket.resolvedAt) : undefined,
        resolutionNotes: ticket.resolutionNotes,
        resolutionAction: ticket.resolutionAction
      }
    });
    return ticket;
  }

  public async listSupportTickets(): Promise<SupportTicket[]> {
    const tickets = await this.prisma.supportTicket.findMany({
      orderBy: { createdAt: "desc" }
    });
    return tickets.map((ticket: any) => this.mapSupportTicket(ticket));
  }

  public async updateSupportTicket(
    ticketId: string,
    updates: Partial<SupportTicket>
  ): Promise<SupportTicket | undefined> {
    const current = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId }
    });

    if (!current) {
      return undefined;
    }

    const ticket = await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        bookingId: updates.bookingId,
        requesterId: updates.requesterId,
        subject: updates.subject,
        description: updates.description,
        issueType: updates.issueType,
        status: updates.status,
        createdAt: updates.createdAt ? new Date(updates.createdAt) : undefined,
        updatedAt: updates.updatedAt ? new Date(updates.updatedAt) : undefined,
        triagedAt: updates.triagedAt
          ? new Date(updates.triagedAt)
          : updates.triagedAt === undefined
            ? undefined
            : null,
        resolvedAt: updates.resolvedAt
          ? new Date(updates.resolvedAt)
          : updates.resolvedAt === undefined
            ? undefined
            : null,
        resolutionNotes:
          updates.resolutionNotes === undefined ? undefined : updates.resolutionNotes,
        resolutionAction:
          updates.resolutionAction === undefined ? undefined : updates.resolutionAction
      }
    });

    return this.mapSupportTicket(ticket);
  }

  public async createNotification(notification: AppNotification): Promise<AppNotification> {
    await this.prisma.appNotification.create({
      data: {
        id: notification.id,
        recipientId: notification.recipientId,
        recipientRole: notification.recipientRole,
        category: notification.category,
        title: notification.title,
        body: notification.body,
        actionHref: notification.actionHref,
        isRead: notification.isRead,
        createdAt: new Date(notification.createdAt),
        readAt: notification.readAt ? new Date(notification.readAt) : null
      }
    });
    return notification;
  }

  public async listNotificationsByRecipient(recipientId: string): Promise<AppNotification[]> {
    const notifications = await this.prisma.appNotification.findMany({
      where: { recipientId },
      orderBy: { createdAt: "desc" }
    });
    return notifications.map((notification: any) => this.mapAppNotification(notification));
  }

  public async updateNotification(
    notificationId: string,
    updates: Partial<AppNotification>
  ): Promise<AppNotification | undefined> {
    const current = await this.prisma.appNotification.findUnique({
      where: { id: notificationId }
    });
    if (!current) {
      return undefined;
    }

    const notification = await this.prisma.appNotification.update({
      where: { id: notificationId },
      data: {
        category: updates.category,
        title: updates.title,
        body: updates.body,
        actionHref: updates.actionHref,
        isRead: updates.isRead,
        readAt: updates.readAt ? new Date(updates.readAt) : updates.readAt === undefined ? undefined : null
      }
    });
    return this.mapAppNotification(notification);
  }

  public async getNotificationPreferences(
    recipientId: string
  ): Promise<NotificationPreferences | undefined> {
    const preferences = await this.prisma.notificationPreference.findUnique({
      where: { userId: recipientId }
    });

    return preferences ? this.mapNotificationPreferences(preferences) : undefined;
  }

  public async upsertNotificationPreferences(
    preferences: NotificationPreferences
  ): Promise<NotificationPreferences> {
    const record = await this.prisma.notificationPreference.upsert({
      where: { userId: preferences.userId },
      create: {
        userId: preferences.userId,
        role: preferences.role,
        emailEnabled: preferences.emailEnabled,
        smsEnabled: preferences.smsEnabled,
        pushEnabled: preferences.pushEnabled,
        reviewRemindersEnabled: preferences.reviewRemindersEnabled,
        createdAt: new Date(preferences.updatedAt),
        updatedAt: new Date(preferences.updatedAt)
      },
      update: {
        role: preferences.role,
        emailEnabled: preferences.emailEnabled,
        smsEnabled: preferences.smsEnabled,
        pushEnabled: preferences.pushEnabled,
        reviewRemindersEnabled: preferences.reviewRemindersEnabled,
        updatedAt: new Date(preferences.updatedAt)
      }
    });

    return this.mapNotificationPreferences(record);
  }

  public async createNotificationDelivery(
    delivery: NotificationDeliveryRecord
  ): Promise<NotificationDeliveryRecord> {
    await this.prisma.notificationDelivery.create({
      data: {
        id: delivery.id,
        notificationId: delivery.notificationId,
        recipientId: delivery.recipientId,
        recipientRole: delivery.recipientRole,
        category: delivery.category,
        channel: delivery.channel,
        destination: delivery.destination,
        provider: delivery.provider,
        status: delivery.status,
        title: delivery.title,
        bodyPreview: delivery.bodyPreview,
        errorMessage: delivery.errorMessage,
        attemptCount: delivery.attemptCount,
        createdAt: new Date(delivery.createdAt),
        lastAttemptAt: delivery.lastAttemptAt ? new Date(delivery.lastAttemptAt) : null,
        nextRetryAt: delivery.nextRetryAt ? new Date(delivery.nextRetryAt) : null,
        sentAt: delivery.sentAt ? new Date(delivery.sentAt) : null
      }
    });
    return delivery;
  }

  public async listNotificationDeliveriesByRecipient(
    recipientId: string
  ): Promise<NotificationDeliveryRecord[]> {
    const deliveries = await this.prisma.notificationDelivery.findMany({
      where: { recipientId },
      orderBy: { createdAt: "desc" }
    });
    return deliveries.map((delivery: any) => this.mapNotificationDelivery(delivery));
  }

  public async listAllNotificationDeliveries(): Promise<NotificationDeliveryRecord[]> {
    const deliveries = await this.prisma.notificationDelivery.findMany({
      orderBy: { createdAt: "desc" }
    });
    return deliveries.map((delivery: any) => this.mapNotificationDelivery(delivery));
  }

  public async updateNotificationDelivery(
    deliveryId: string,
    updates: Partial<NotificationDeliveryRecord>
  ): Promise<NotificationDeliveryRecord | undefined> {
    const current = await this.prisma.notificationDelivery.findUnique({
      where: { id: deliveryId }
    });
    if (!current) {
      return undefined;
    }

    const delivery = await this.prisma.notificationDelivery.update({
      where: { id: deliveryId },
      data: {
        provider: updates.provider,
        status: updates.status,
        destination: updates.destination,
        title: updates.title,
        bodyPreview: updates.bodyPreview,
        errorMessage: updates.errorMessage,
        attemptCount: updates.attemptCount,
        lastAttemptAt:
          updates.lastAttemptAt ? new Date(updates.lastAttemptAt) : updates.lastAttemptAt === undefined ? undefined : null,
        nextRetryAt:
          updates.nextRetryAt ? new Date(updates.nextRetryAt) : updates.nextRetryAt === undefined ? undefined : null,
        sentAt: updates.sentAt ? new Date(updates.sentAt) : updates.sentAt === undefined ? undefined : null
      }
    });

    return this.mapNotificationDelivery(delivery);
  }

  public async upsertPushDevice(device: PushDevice): Promise<PushDevice> {
    const record = await this.prisma.pushDevice.upsert({
      where: { token: device.token },
      create: {
        id: device.id,
        userId: device.userId,
        role: device.role,
        platform: device.platform,
        provider: device.provider,
        token: device.token,
        isActive: device.isActive,
        createdAt: new Date(device.createdAt),
        updatedAt: new Date(device.updatedAt),
        lastSeenAt: new Date(device.lastSeenAt)
      },
      update: {
        userId: device.userId,
        role: device.role,
        platform: device.platform,
        provider: device.provider,
        isActive: device.isActive,
        updatedAt: new Date(device.updatedAt),
        lastSeenAt: new Date(device.lastSeenAt)
      }
    });
    return this.mapPushDevice(record);
  }

  public async deactivatePushDevice(token: string): Promise<boolean> {
    const record = await this.prisma.pushDevice
      .update({
        where: { token },
        data: {
          isActive: false,
          updatedAt: new Date()
        }
      })
      .catch((error: any) => {
        if (error?.code === "P2025") {
          return undefined;
        }
        throw error;
      });
    return Boolean(record);
  }

  public async listActivePushDevicesByRecipient(
    recipientId: string,
    role: PushDevice["role"]
  ): Promise<PushDevice[]> {
    const records = await this.prisma.pushDevice.findMany({
      where: {
        userId: recipientId,
        role,
        isActive: true
      },
      orderBy: { updatedAt: "desc" }
    });
    return records.map((record: any) => this.mapPushDevice(record));
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

  public async createCustomerProviderConversation(
    conversation: CustomerProviderConversation
  ): Promise<CustomerProviderConversation> {
    await this.prisma.customerProviderConversation.create({
      data: {
        id: conversation.id,
        bookingId: conversation.bookingId,
        customerId: conversation.customerId,
        providerId: conversation.providerId,
        customerName: conversation.customerName,
        providerName: conversation.providerName,
        updatedAt: new Date(conversation.updatedAt),
        lastMessagePreview: conversation.lastMessagePreview,
        unreadCount: conversation.unreadCount,
        createdAt: new Date(conversation.updatedAt)
      }
    });
    return conversation;
  }

  public async findCustomerProviderConversationById(
    conversationId: string
  ): Promise<CustomerProviderConversation | undefined> {
    const conversation = await this.prisma.customerProviderConversation.findUnique({
      where: { id: conversationId }
    });
    return conversation ? this.mapCustomerProviderConversation(conversation) : undefined;
  }

  public async findCustomerProviderConversationByBookingId(
    bookingId: string
  ): Promise<CustomerProviderConversation | undefined> {
    const conversation = await this.prisma.customerProviderConversation.findUnique({
      where: { bookingId }
    });
    return conversation ? this.mapCustomerProviderConversation(conversation) : undefined;
  }

  public async listCustomerProviderConversations(): Promise<CustomerProviderConversation[]> {
    const conversations = await this.prisma.customerProviderConversation.findMany({
      orderBy: { updatedAt: "desc" }
    });
    return conversations.map((conversation: any) => this.mapCustomerProviderConversation(conversation));
  }

  public async updateCustomerProviderConversation(
    conversationId: string,
    updates: Partial<CustomerProviderConversation>
  ): Promise<CustomerProviderConversation | undefined> {
    const current = await this.prisma.customerProviderConversation.findUnique({
      where: { id: conversationId }
    });
    if (!current) {
      return undefined;
    }

    const conversation = await this.prisma.customerProviderConversation.update({
      where: { id: conversationId },
      data: {
        updatedAt: updates.updatedAt ? new Date(updates.updatedAt) : undefined,
        lastMessagePreview: updates.lastMessagePreview,
        unreadCount: updates.unreadCount
      }
    });
    return this.mapCustomerProviderConversation(conversation);
  }

  public async createCustomerProviderMessage(
    message: CustomerProviderMessage
  ): Promise<CustomerProviderMessage> {
    await this.prisma.customerProviderMessage.create({
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

  public async listCustomerProviderMessages(conversationId: string): Promise<CustomerProviderMessage[]> {
    const messages = await this.prisma.customerProviderMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" }
    });
    return messages.map((message: any) => this.mapCustomerProviderMessage(message));
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
          googleSubject: identity.googleSubject ?? undefined,
          appleSubject: identity.appleSubject ?? undefined,
          role: identity.role as AuthIdentityRecord["role"],
          sessionVersion: identity.sessionVersion,
          resetPasswordCodeHash: identity.resetPasswordCodeHash ?? undefined,
          resetPasswordExpiresAt: identity.resetPasswordExpiresAt?.toISOString(),
          resetPasswordRequestedAt: identity.resetPasswordRequestedAt?.toISOString()
        }
      : undefined;
  }

  public async findAuthIdentityByProvider(
    provider: "google" | "apple",
    subject: string
  ): Promise<AuthIdentityRecord | undefined> {
    const identity = await this.prisma.userAccount.findFirst({
      where: provider === "google" ? { googleSubject: subject } : { appleSubject: subject }
    });
    return identity
      ? {
          userId: identity.id,
          email: identity.email,
          passwordHash: identity.passwordHash ?? undefined,
          googleSubject: identity.googleSubject ?? undefined,
          appleSubject: identity.appleSubject ?? undefined,
          role: identity.role as AuthIdentityRecord["role"],
          sessionVersion: identity.sessionVersion,
          resetPasswordCodeHash: identity.resetPasswordCodeHash ?? undefined,
          resetPasswordExpiresAt: identity.resetPasswordExpiresAt?.toISOString(),
          resetPasswordRequestedAt: identity.resetPasswordRequestedAt?.toISOString()
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
          googleSubject: identity.googleSubject ?? undefined,
          appleSubject: identity.appleSubject ?? undefined,
          role: identity.role as AuthIdentityRecord["role"],
          sessionVersion: identity.sessionVersion,
          resetPasswordCodeHash: identity.resetPasswordCodeHash ?? undefined,
          resetPasswordExpiresAt: identity.resetPasswordExpiresAt?.toISOString(),
          resetPasswordRequestedAt: identity.resetPasswordRequestedAt?.toISOString()
        }
      : undefined;
  }

  public async updateAuthIdentity(
    userId: string,
    updates: Partial<AuthIdentityRecord>
  ): Promise<AuthIdentityRecord | undefined> {
    const identity = await this.prisma.userAccount.update({
      where: { id: userId },
      data: {
        email: updates.email?.toLowerCase(),
        passwordHash: "passwordHash" in updates ? updates.passwordHash ?? null : undefined,
        googleSubject: "googleSubject" in updates ? updates.googleSubject ?? null : undefined,
        appleSubject: "appleSubject" in updates ? updates.appleSubject ?? null : undefined,
        sessionVersion: updates.sessionVersion,
        resetPasswordCodeHash:
          "resetPasswordCodeHash" in updates ? updates.resetPasswordCodeHash ?? null : undefined,
        resetPasswordExpiresAt:
          "resetPasswordExpiresAt" in updates
            ? updates.resetPasswordExpiresAt
              ? new Date(updates.resetPasswordExpiresAt)
              : null
            : undefined,
        resetPasswordRequestedAt:
          "resetPasswordRequestedAt" in updates
            ? updates.resetPasswordRequestedAt
              ? new Date(updates.resetPasswordRequestedAt)
              : null
            : undefined
      }
    }).catch((error: any) => {
      if (error?.code === "P2025") {
        return undefined;
      }
      throw error;
    });

    return identity
      ? {
          userId: identity.id,
          email: identity.email,
          passwordHash: identity.passwordHash ?? undefined,
          googleSubject: identity.googleSubject ?? undefined,
          appleSubject: identity.appleSubject ?? undefined,
          role: identity.role as AuthIdentityRecord["role"],
          sessionVersion: identity.sessionVersion,
          resetPasswordCodeHash: identity.resetPasswordCodeHash ?? undefined,
          resetPasswordExpiresAt: identity.resetPasswordExpiresAt?.toISOString(),
          resetPasswordRequestedAt: identity.resetPasswordRequestedAt?.toISOString()
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
    onRouteConfirmedAt: Date | null;
    onRouteConfirmedByCrewMemberId: string | null;
    lateNoticeSentAt: Date | null;
    lateEtaIso: Date | null;
    lateReason: string | null;
    activeExceptionType: string | null;
    activeExceptionReportedAt: Date | null;
    activeExceptionNotes: string | null;
    routeLivePoint: unknown | null;
    routeLiveUpdatedAt: Date | null;
    routeLiveSource: string | null;
    routeLiveSpeedMph: number | null;
    routeLiveAccuracyMeters: number | null;
    disputedAt: Date | null;
    disputeReason: string | null;
    disputedByRole: string | null;
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
      onRouteConfirmedAt: record.onRouteConfirmedAt?.toISOString(),
      onRouteConfirmedByCrewMemberId: record.onRouteConfirmedByCrewMemberId ?? undefined,
      lateNoticeSentAt: record.lateNoticeSentAt?.toISOString(),
      lateEtaIso: record.lateEtaIso?.toISOString(),
      lateReason: record.lateReason ?? undefined,
      activeExceptionType: record.activeExceptionType as Booking["activeExceptionType"],
      activeExceptionReportedAt: record.activeExceptionReportedAt?.toISOString(),
      activeExceptionNotes: record.activeExceptionNotes ?? undefined,
      routeLivePoint: record.routeLivePoint ? readJson<Address["point"]>(record.routeLivePoint) : undefined,
      routeLiveUpdatedAt: record.routeLiveUpdatedAt?.toISOString(),
      routeLiveSource: record.routeLiveSource as Booking["routeLiveSource"],
      routeLiveSpeedMph: record.routeLiveSpeedMph ?? undefined,
      routeLiveAccuracyMeters: record.routeLiveAccuracyMeters ?? undefined,
      disputedAt: record.disputedAt?.toISOString(),
      disputeReason: record.disputeReason ?? undefined,
      disputedByRole: record.disputedByRole as Booking["disputedByRole"],
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

  private mapSupportTicket(record: {
    id: string;
    bookingId: string | null;
    requesterId: string;
    subject: string;
    description: string;
    issueType: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    triagedAt: Date | null;
    resolvedAt: Date | null;
    resolutionNotes: string | null;
    resolutionAction: string | null;
  }): SupportTicket {
    return {
      id: record.id,
      bookingId: record.bookingId ?? undefined,
      requesterId: record.requesterId,
      subject: record.subject,
      description: record.description,
      issueType: record.issueType as SupportTicket["issueType"],
      status: record.status as SupportTicket["status"],
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      triagedAt: record.triagedAt?.toISOString(),
      resolvedAt: record.resolvedAt?.toISOString(),
      resolutionNotes: record.resolutionNotes ?? undefined,
      resolutionAction: record.resolutionAction as SupportTicket["resolutionAction"]
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
    currency: string;
    status: string;
    processor: string;
    refundable: boolean;
    checkoutSessionId: string | null;
    checkoutSessionUrl: string | null;
    processorPaymentIntentId: string | null;
    refundReason: string | null;
    refundReviewStatus: string | null;
    refundRequestedAt: Date | null;
    refundRequestedByRole: string | null;
    refundReviewedAt: Date | null;
    refundReviewedByRole: string | null;
    refundDecisionNotes: string | null;
    failureReason: string | null;
    paidAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): PaymentRecord {
    return {
      id: record.id,
      bookingId: record.bookingId,
      amountCents: record.amountCents,
      currency: record.currency,
      status: record.status as PaymentRecord["status"],
      processor: record.processor as PaymentRecord["processor"],
      refundable: record.refundable,
      checkoutSessionId: record.checkoutSessionId ?? undefined,
      checkoutSessionUrl: record.checkoutSessionUrl ?? undefined,
      processorPaymentIntentId: record.processorPaymentIntentId ?? undefined,
      refundReason: record.refundReason ?? undefined,
      refundReviewStatus: record.refundReviewStatus as PaymentRecord["refundReviewStatus"],
      refundRequestedAt: record.refundRequestedAt?.toISOString(),
      refundRequestedByRole: record.refundRequestedByRole as PaymentRecord["refundRequestedByRole"],
      refundReviewedAt: record.refundReviewedAt?.toISOString(),
      refundReviewedByRole: record.refundReviewedByRole as PaymentRecord["refundReviewedByRole"],
      refundDecisionNotes: record.refundDecisionNotes ?? undefined,
      failureReason: record.failureReason ?? undefined,
      paidAt: record.paidAt?.toISOString(),
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString()
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

  private mapAppNotification(record: {
    id: string;
    recipientId: string;
    recipientRole: string;
    category: string;
    title: string;
    body: string;
    actionHref: string | null;
    isRead: boolean;
    createdAt: Date;
    readAt: Date | null;
  }): AppNotification {
    return {
      id: record.id,
      recipientId: record.recipientId,
      recipientRole: record.recipientRole as AppNotification["recipientRole"],
      category: record.category as AppNotification["category"],
      title: record.title,
      body: record.body,
      actionHref: record.actionHref ?? undefined,
      isRead: record.isRead,
      createdAt: record.createdAt.toISOString(),
      readAt: record.readAt?.toISOString()
    };
  }

  private mapNotificationPreferences(record: {
    userId: string;
    role: string;
    emailEnabled: boolean;
    smsEnabled: boolean;
    pushEnabled: boolean;
    reviewRemindersEnabled: boolean;
    updatedAt: Date;
  }): NotificationPreferences {
    return {
      userId: record.userId,
      role: record.role as NotificationPreferences["role"],
      emailEnabled: record.emailEnabled,
      smsEnabled: record.smsEnabled,
      pushEnabled: record.pushEnabled,
      reviewRemindersEnabled: record.reviewRemindersEnabled,
      updatedAt: record.updatedAt.toISOString()
    };
  }

  private mapNotificationDelivery(record: {
    id: string;
    notificationId: string;
    recipientId: string;
    recipientRole: string;
    category: string;
    channel: string;
    destination: string;
    provider: string;
    status: string;
    title: string;
    bodyPreview: string;
    errorMessage: string | null;
    attemptCount: number;
    createdAt: Date;
    lastAttemptAt: Date | null;
    nextRetryAt: Date | null;
    sentAt: Date | null;
  }): NotificationDeliveryRecord {
    return {
      id: record.id,
      notificationId: record.notificationId,
      recipientId: record.recipientId,
      recipientRole: record.recipientRole as NotificationDeliveryRecord["recipientRole"],
      category: record.category as NotificationDeliveryRecord["category"],
      channel: record.channel as NotificationDeliveryRecord["channel"],
      destination: record.destination,
      provider: record.provider,
      status: record.status as NotificationDeliveryRecord["status"],
      title: record.title,
      bodyPreview: record.bodyPreview,
      errorMessage: record.errorMessage ?? undefined,
      attemptCount: record.attemptCount,
      createdAt: record.createdAt.toISOString(),
      lastAttemptAt: record.lastAttemptAt?.toISOString(),
      nextRetryAt: record.nextRetryAt?.toISOString(),
      sentAt: record.sentAt?.toISOString()
    };
  }

  private mapPushDevice(record: {
    id: string;
    userId: string;
    role: string;
    platform: string;
    provider: string;
    token: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    lastSeenAt: Date;
  }): PushDevice {
    return {
      id: record.id,
      userId: record.userId,
      role: record.role as PushDevice["role"],
      platform: record.platform as PushDevice["platform"],
      provider: record.provider as PushDevice["provider"],
      token: record.token,
      isActive: record.isActive,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      lastSeenAt: record.lastSeenAt.toISOString()
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

  private mapCustomerProviderConversation(record: {
    id: string;
    bookingId: string;
    customerId: string;
    providerId: string;
    customerName: string;
    providerName: string;
    updatedAt: Date;
    lastMessagePreview: string | null;
    unreadCount: number;
  }): CustomerProviderConversation {
    return {
      id: record.id,
      bookingId: record.bookingId,
      customerId: record.customerId,
      providerId: record.providerId,
      customerName: record.customerName,
      providerName: record.providerName,
      updatedAt: record.updatedAt.toISOString(),
      lastMessagePreview: record.lastMessagePreview ?? undefined,
      unreadCount: record.unreadCount
    };
  }

  private mapCustomerProviderMessage(record: {
    id: string;
    conversationId: string;
    senderId: string;
    senderRole: string;
    body: string;
    createdAt: Date;
  }): CustomerProviderMessage {
    return {
      id: record.id,
      threadId: record.conversationId,
      senderId: record.senderId,
      senderRole: record.senderRole as CustomerProviderMessage["senderRole"],
      body: record.body,
      createdAt: record.createdAt.toISOString()
    };
  }
}
