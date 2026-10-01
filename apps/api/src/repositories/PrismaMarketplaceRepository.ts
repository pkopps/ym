import type { ZipServiceMinimumRecord } from "@yardmatch/contracts";
import type { NotificationHealthSnapshot } from "./notificationHealth";
import type { CustomerReferralRecord } from "./customerReferrals";
import { utcTimestamp } from "./sqlTime";
import { providerClientQuery } from "./providerClientQuery";
import type { ProviderClientProperty } from "@yardmatch/contracts";
import { searchBounds, type ProviderSearchQuery, type ProviderBookingMetrics } from "./searchQueries";
import { resolveScheduleUpdates } from "../policies/bookingSchedulePolicy";
import { Prisma, PrismaClient, type NotificationDelivery } from "@prisma/client";
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
  OpsProfile,
  OpsAccessHistoryEntry,
  OpsAuthenticationHistoryEntry,
  OpsAutomationRunRecord,
  OpsAutomationSweepRunItem,
  OpsAutomationSweepKey,
  NotificationDeliveryRecord,
  NotificationPreferences,
  OpsPayoutDisbursementRun,
  OpsPayoutDisbursementEntryRef,
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
  LaunchOperationsTask,
  ReviewInvite,
  SupportTicket
} from "@yardmatch/contracts";
import { buildSettlementLedgerDraft, calculateMarketplaceSettlement } from "@yardmatch/domain";
import {
  AuthIdentityRecord,
  BookingPageQuery,
  CompleteProviderTransferInput,
  CompleteProviderTransferReversalInput,
  MarketplaceRepository
} from "./MarketplaceRepository";

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
  public constructor(private readonly prisma: PrismaClient, private readonly inTransaction = false) {}

  private transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.inTransaction ? work(this.prisma) : this.prisma.$transaction(work, { maxWait: 10000, timeout: 30000 });
  }

  public async withLock<T>(key: string, work: (repository: MarketplaceRepository) => Promise<T>): Promise<T> {
    return this.transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text`;
      return work(new PrismaMarketplaceRepository(tx as PrismaClient, true));
    });
  }

  public async getSecurityState(key: string): Promise<Record<string, unknown> | undefined> {
    const entry = await this.prisma.securityState.findUnique({ where: { key } });
    return entry && entry.expiresAt.getTime() > Date.now() ? entry.value as Record<string, unknown> : undefined;
  }

  public async putSecurityState(key: string, value: Record<string, unknown>, expiresAt: string): Promise<void> {
    await this.prisma.securityState.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    await this.prisma.securityState.upsert({ where: { key }, create: { key, value: asJson(value), expiresAt: new Date(expiresAt) }, update: { value: asJson(value), expiresAt: new Date(expiresAt) } });
  }

  public async createRecurringPlanWithBooking(plan: RecurringServicePlan, booking: Booking): Promise<Booking> {
    return this.transaction(async (tx) => {
      const repository = new PrismaMarketplaceRepository(tx as PrismaClient, true);
      await repository.createRecurringServicePlan(plan);
      return repository.createBooking(booking);
    });
  }

  public async createCustomer(
    customer: CustomerProfile,
    passwordHash?: string
  ): Promise<CustomerProfile> {
    await this.transaction(async (tx: any) => {
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

  public async listZipServiceMinimums(postalCode: string): Promise<ZipServiceMinimumRecord[]> {
    const rows = await this.prisma.zipServiceMinimum.findMany({ where: { postalCode }, orderBy: { category: "asc" } });
    return rows as unknown as ZipServiceMinimumRecord[];
  }
  public async saveZipServiceMinimum(record: ZipServiceMinimumRecord): Promise<ZipServiceMinimumRecord> {
    const data = { ...record, history: asJson(record.history) };
    await this.prisma.zipServiceMinimum.upsert({ where: { postalCode_category: { postalCode: record.postalCode, category: record.category } }, create: data, update: data });
    return record;
  }

  public async createProvider(
    provider: ProviderProfile,
    passwordHash?: string
  ): Promise<ProviderProfile> {
    await this.transaction(async (tx: any) => {
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
          minimumBookingLeadHours: provider.minimumBookingLeadHours,
          staffingMode: provider.staffingMode,
          crewReviewLeadHours: provider.crewReviewLeadHours,
          departureReminderLeadMinutes: provider.departureReminderLeadMinutes,
          routeLeaderMode: provider.routeLeaderMode,
          weeklyPayoutDay: provider.weeklyPayoutDay,
          instantPayoutsEnabled: provider.instantPayoutsEnabled,
          verificationStatus: provider.verificationStatus,
          verificationSubmittedAt: provider.verificationSubmittedAt
            ? new Date(provider.verificationSubmittedAt)
            : undefined,
          verificationReviewedAt: provider.verificationReviewedAt
            ? new Date(provider.verificationReviewedAt)
            : undefined,
          verificationNotes: provider.verificationNotes,
          servicePrices: asJson(provider.servicePrices ?? []),
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
    await this.transaction(async (tx: any) => {
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
          cancellationCount: crewMember.cancellationCount,
          lastCancellationAt: crewMember.lastCancellationAt ? new Date(crewMember.lastCancellationAt) : undefined,
          status: crewMember.status,
          assignedProviderId: crewMember.assignedProviderId
        }
      });
    });

    return (await this.findCrewMemberById(crewMember.id))!;
  }

  public async createOpsUser(
    opsUser: OpsProfile,
    passwordHash?: string
  ): Promise<OpsProfile> {
    await this.prisma.userAccount.create({
      data: {
        id: opsUser.id,
        email: opsUser.email,
        passwordHash,
        fullName: opsUser.fullName,
        phone: opsUser.phone,
        role: opsUser.role,
        internalScope: opsUser.internalScope,
        address: asJson(opsUser.address),
        createdAt: new Date(opsUser.createdAt)
      }
    });

    return (await this.findOpsUserById(opsUser.id))!;
  }

  public async searchProvidersPage(query: ProviderSearchQuery) {
    if (!query.categories.length) return { items: [], hasMore: false };
    const bounds = searchBounds(query.address);
    const longitude = Prisma.sql`(u.address->'point'->>'longitude')::double precision`;
    const longitudeCondition = bounds.west <= bounds.east
      ? Prisma.sql`${longitude} BETWEEN ${bounds.west} AND ${bounds.east}`
      : Prisma.sql`(${longitude} >= ${bounds.west} OR ${longitude} <= ${bounds.east})`;
    const ids = await this.prisma.$queryRaw<Array<{ userId: string }>>`
      SELECT p."userId" FROM provider_business_profiles p JOIN user_accounts u ON u.id = p."userId"
      WHERE p."verificationStatus" = 'verified' AND p.categories && ARRAY[${Prisma.join(query.categories)}]::text[]
        AND (u.address->'point'->>'latitude')::double precision BETWEEN ${bounds.south} AND ${bounds.north}
        AND ${longitudeCondition} ${query.cursorId ? Prisma.sql`AND p."userId" > ${query.cursorId}` : Prisma.empty}
      ORDER BY p."userId" LIMIT 101`;
    const pageIds = ids.slice(0, 100).map(row => row.userId);
    const rows = await this.prisma.providerBusinessProfile.findMany({ where: { userId: { in: pageIds } },
      include: { user: true, credentials: true, connectAccount: true }, orderBy: { userId: "asc" } });
    return { items: rows.map(row => this.mapProviderProfile(row.user, row)), hasMore: ids.length > 100,
      nextCursorId: ids.length > 100 ? pageIds.at(-1) : undefined };
  }

  public async getProviderBookingMetrics(providerIds: string[], address: Address): Promise<ProviderBookingMetrics[]> {
    if (!providerIds.length) return [];
    return this.prisma.$queryRaw<ProviderBookingMetrics[]>`
      SELECT "providerId", COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status NOT IN ('completed', 'cancelled', 'refunded'))::int AS open,
        COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
        COUNT(*) FILTER (WHERE status = 'completed' AND "serviceAddress"->>'city' = ${address.city}
          AND "serviceAddress"->>'state' = ${address.state})::int AS "nearbyCompleted",
        COUNT(*) FILTER (WHERE status = 'disputed')::int AS disputed,
        COUNT(*) FILTER (WHERE status = 'refunded')::int AS refunded,
        COUNT(*) FILTER (WHERE COALESCE("activeExceptionType", '') <> '')::int AS exceptions,
        COUNT(*) FILTER (WHERE status NOT IN ('requested', 'cancelled'))::int AS "nonRequestedActive",
        COUNT(*) FILTER (WHERE "lateNoticeSentAt" IS NOT NULL)::int AS late
      FROM bookings WHERE "providerId" IN (${Prisma.join(providerIds)}) GROUP BY "providerId"`;
  }

  public async listSearchSlots(providerIds: string[], minimumDurationMinutes = 0, range?: { startIso: string; endIso: string }): Promise<AvailabilitySlot[]> {
    if (!providerIds.length) return [];
    const rows = await this.prisma.$queryRaw<Array<{ id: string; providerId: string; startIso: Date; endIso: Date; isBooked: boolean }>>`
      SELECT slot.* FROM provider_business_profiles provider CROSS JOIN LATERAL (
        SELECT candidate.* FROM availability_slots candidate
        WHERE candidate."providerId" = provider."userId" AND NOT candidate."isBooked"
          AND candidate."startIso" >= ${utcTimestamp(new Date())} + provider."minimumBookingLeadHours" * interval '1 hour'
          AND (${!range} OR (candidate."startIso" >= ${utcTimestamp(new Date(range?.startIso ?? 0))}
            AND candidate."startIso" < ${utcTimestamp(new Date(range?.endIso ?? 0))}))
          AND NOT EXISTS (SELECT 1 FROM bookings job WHERE job."providerId" = provider."userId"
            AND job.status NOT IN ('cancelled', 'completed', 'refunded')
            AND candidate."startIso" < job."scheduledEndIso" AND candidate."endIso" > job."scheduledStartIso")
          AND candidate."endIso" - candidate."startIso" >= ${minimumDurationMinutes} * interval '1 minute'
          AND (COALESCE(provider."calendarConnection"->>'externalEventsBlockingEnabled', 'false') <> 'true' OR NOT EXISTS (
            SELECT 1 FROM jsonb_array_elements(COALESCE(provider."calendarConnection"->'externalBlocks', '[]'::jsonb)) block
            WHERE candidate."startIso" < ((block->>'endIso')::timestamptz AT TIME ZONE 'UTC')
              AND candidate."endIso" > ((block->>'startIso')::timestamptz AT TIME ZONE 'UTC')
          ))
        ORDER BY candidate."startIso", candidate.id LIMIT 3
      ) slot WHERE provider."userId" IN (${Prisma.join(providerIds)})`;
    return rows.map(row => ({ ...row, startIso: row.startIso.toISOString(), endIso: row.endIso.toISOString() }));
  }

  public async listScopedBookings(query: { providerId?: string; customerId?: string; endAfter?: string; excludeStatuses?: string[] }) {
    if (!query.providerId && !query.customerId) throw new Error("Booking queries require an owner scope");
    const rows = await this.prisma.booking.findMany({ where: {
      providerId: query.providerId, customerId: query.customerId,
      ...(query.endAfter ? { scheduledEndIso: { gt: new Date(query.endAfter) } } : {}),
      ...(query.excludeStatuses ? { status: { notIn: query.excludeStatuses } } : {})
    }, orderBy: [{ scheduledStartIso: "asc" }, { id: "asc" }] });
    return rows.map(row => this.mapBooking(row));
  }

  public async getRetentionEvidence(bookingIds: string[]) {
    const tickets: SupportTicket[] = [], reviews: ProviderReview[] = [], settlements: BookingFinancialSettlement[] = [];
    for (let offset = 0; offset < bookingIds.length; offset += 1000) {
      const where = { bookingId: { in: bookingIds.slice(offset, offset + 1000) } };
      const [t, r, f] = await Promise.all([this.prisma.supportTicket.findMany({ where }),
        this.prisma.providerReview.findMany({ where }), this.prisma.bookingFinancialSettlement.findMany({ where })]);
      tickets.push(...t.map(row => this.mapSupportTicket(row)));
      reviews.push(...r.map(row => this.mapProviderReview(row)));
      settlements.push(...f.map(row => this.mapBookingFinancialSettlement(row)));
    }
    return { tickets, reviews, settlements };
  }

  public async getProviderClientProperties(providerId: string, nowIso: string): Promise<ProviderClientProperty[]> {
    const rows = await this.prisma.$queryRaw<Array<Omit<ProviderClientProperty, "lastCompletedAt"> & { lastCompletedAt: Date | null }>>(providerClientQuery(providerId, nowIso));
    return rows.map(row => ({ ...row, lastCompletedAt: row.lastCompletedAt?.toISOString() }));
  }

  public async listProviders(): Promise<ProviderProfile[]> {
    const providers = await this.prisma.providerBusinessProfile.findMany({
      include: {
        user: true,
        credentials: true,
        connectAccount: true
      }
    });

    return providers.map((record: any) => this.mapProviderProfile(record.user, record));
  }

  public async listCustomers(customerIds?: string[]): Promise<CustomerProfile[]> {
    const customers = await this.prisma.customerProfile.findMany({
      where: customerIds ? { userId: { in: customerIds } } : undefined,
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

  public async listOpsUsers(): Promise<OpsProfile[]> {
    const opsUsers = await this.prisma.userAccount.findMany({
      where: { role: "ops" },
      orderBy: { createdAt: "desc" }
    });

    return opsUsers.map((record: any) => this.mapOpsProfile(record));
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

  public async findOpsUserById(opsUserId: string): Promise<OpsProfile | undefined> {
    const opsUser = await this.prisma.userAccount.findFirst({
      where: {
        id: opsUserId,
        role: "ops"
      }
    });

    return opsUser ? this.mapOpsProfile(opsUser) : undefined;
  }

  public async updateCrewMember(
    crewMemberId: string,
    updates: Partial<CrewMemberProfile>
  ): Promise<CrewMemberProfile | undefined> {
    const current = await this.findCrewMemberById(crewMemberId);
    if (!current) {
      return undefined;
    }

    await this.transaction(async (tx: any) => {
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
          cancellationCount: updates.cancellationCount,
          lastCancellationAt:
            "lastCancellationAt" in updates
              ? updates.lastCancellationAt
                ? new Date(updates.lastCancellationAt)
                : null
              : undefined,
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

    await this.transaction(async (tx: any) => {
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

  public async updateOpsUser(
    opsUserId: string,
    updates: Partial<OpsProfile>
  ): Promise<OpsProfile | undefined> {
    const current = await this.findOpsUserById(opsUserId);
    if (!current) {
      return undefined;
    }

    const opsUser = await this.prisma.userAccount.update({
      where: { id: opsUserId },
      data: this.buildUserAccountUpdate(updates)
    });

    return this.mapOpsProfile(opsUser);
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
        launchLeadId: booking.launchLeadId,
        recurringPlanId: booking.recurringPlanId,
        recurringOccurrenceIndex: booking.recurringOccurrenceIndex,
        serviceAddress: asJson(booking.serviceAddress),
        servicePropertyId: booking.servicePropertyId,
        category: booking.category,
        services: asJson(booking.services ?? []),
        requestedAt: new Date(booking.requestedAt),
        scheduledStartIso: new Date(booking.scheduledStartIso),
        scheduledEndIso: new Date(booking.scheduledEndIso),
        status: booking.status,
        assignedRouteLeaderCrewMemberId: booking.assignedRouteLeaderCrewMemberId,
        onRouteConfirmedAt: booking.onRouteConfirmedAt ? new Date(booking.onRouteConfirmedAt) : undefined,
        onRouteConfirmedByCrewMemberId: booking.onRouteConfirmedByCrewMemberId,
        lateNoticeSentAt: booking.lateNoticeSentAt ? new Date(booking.lateNoticeSentAt) : undefined,
        lateEtaIso: booking.lateEtaIso ? new Date(booking.lateEtaIso) : undefined,
        lateReason: booking.lateReason,
        scheduleUpdates: asJson(booking.scheduleUpdates ?? []),
        scheduleVersion: booking.scheduleVersion ?? 0,
        activeExceptionType: booking.activeExceptionType,
        activeExceptionReportedAt: booking.activeExceptionReportedAt
          ? new Date(booking.activeExceptionReportedAt)
          : undefined,
        activeExceptionNotes: booking.activeExceptionNotes,
        routeActiveStop: booking.routeActiveStop ? asJson(booking.routeActiveStop) : undefined,
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
        serviceEvidence: asJson(booking.serviceEvidence),
        interventions: asJson(booking.interventions),
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

  public async listBookingsPage(query: BookingPageQuery) {
    const historyStatuses = ["completed", "cancelled", "refunded", "disputed"];
    const bookings = await this.prisma.booking.findMany({
      where: {
        ...(query.actorRole === "customer"
          ? { customerId: query.actorId }
          : { providerId: query.actorId }),
        ...(query.scope === "history"
          ? { status: { in: historyStatuses } }
          : query.scope === "active"
            ? { status: { notIn: historyStatuses } }
            : {})
      },
      orderBy: [{ scheduledStartIso: "desc" }, { id: "desc" }],
      take: query.limit + 1,
      ...(query.cursorId ? { cursor: { id: query.cursorId }, skip: 1 } : {})
    });
    const hasMore = bookings.length > query.limit;
    const items = bookings.slice(0, query.limit).map((booking) => this.mapBooking(booking));
    return {
      items,
      hasMore,
      nextCursorId: hasMore ? items.at(-1)?.id : undefined
    };
  }

  public async listBookingsByIds(bookingIds: string[]): Promise<Booking[]> {
    if (bookingIds.length === 0) {
      return [];
    }
    const bookings = await this.prisma.booking.findMany({
      where: { id: { in: bookingIds } }
    });
    return bookings.map((booking) => this.mapBooking(booking));
  }

  public async findBookingById(bookingId: string): Promise<Booking | undefined> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId }
    });
    return booking ? this.mapBooking(booking) : undefined;
  }

  public async updateBooking(bookingId: string, updates: Partial<Booking>, expectedVersion?: number): Promise<Booking | undefined> {
    const current = await this.findBookingById(bookingId);
    if (!current) {
      return undefined;
    }

    const booking = await this.prisma.booking.update({
      where: { id: bookingId, scheduleVersion: expectedVersion },
      data: {
        scheduleVersion: { increment: 1 },
        scheduleUpdates: updates.scheduleUpdates || resolveScheduleUpdates(current, updates) !== current.scheduleUpdates
          ? asJson(resolveScheduleUpdates(current, updates) ?? []) : undefined,
        customerId: updates.customerId,
        providerId: updates.providerId,
        launchLeadId: "launchLeadId" in updates ? updates.launchLeadId ?? null : undefined,
        recurringPlanId:
          "recurringPlanId" in updates ? updates.recurringPlanId ?? null : undefined,
        recurringOccurrenceIndex:
          "recurringOccurrenceIndex" in updates ? updates.recurringOccurrenceIndex ?? null : undefined,
        serviceAddress: updates.serviceAddress ? asJson(updates.serviceAddress) : undefined,
        servicePropertyId: updates.servicePropertyId,
        category: updates.category,
        requestedAt: updates.requestedAt ? new Date(updates.requestedAt) : undefined,
        scheduledStartIso: updates.scheduledStartIso ? new Date(updates.scheduledStartIso) : undefined,
        scheduledEndIso: updates.scheduledEndIso ? new Date(updates.scheduledEndIso) : undefined,
        status: updates.status,
        assignedRouteLeaderCrewMemberId:
          "assignedRouteLeaderCrewMemberId" in updates
            ? updates.assignedRouteLeaderCrewMemberId ?? null
            : undefined,
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
        routeActiveStop:
          "routeActiveStop" in updates
            ? updates.routeActiveStop
              ? asJson(updates.routeActiveStop)
              : null
            : undefined,
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
        serviceEvidence: updates.serviceEvidence ? asJson(updates.serviceEvidence) : undefined,
        interventions: updates.interventions ? asJson(updates.interventions) : undefined,
        addressChangeHistory: updates.addressChangeHistory ? asJson(updates.addressChangeHistory) : undefined
      }
    }).catch((error: { code?: string }) => {
      if (error.code === "P2025" && expectedVersion !== undefined) return undefined;
      throw error;
    });

    return booking ? this.mapBooking(booking) : undefined;
  }

  public async createRecurringServicePlan(plan: RecurringServicePlan): Promise<RecurringServicePlan> {
    await this.prisma.recurringServicePlan.create({
      data: {
        id: plan.id,
        customerId: plan.customerId,
        providerId: plan.providerId,
        launchLeadId: plan.launchLeadId,
        serviceAddress: asJson(plan.serviceAddress),
        servicePropertyId: plan.servicePropertyId,
        category: plan.category,
        frequency: plan.frequency,
        requestedAt: new Date(plan.requestedAt),
        notes: plan.notes,
        totalCents: plan.totalCents,
        status: plan.status,
        anchorScheduledStartIso: new Date(plan.anchorScheduledStartIso),
        anchorScheduledEndIso: new Date(plan.anchorScheduledEndIso),
        lastGeneratedBookingId: plan.lastGeneratedBookingId,
        lastGeneratedAt: plan.lastGeneratedAt ? new Date(plan.lastGeneratedAt) : undefined,
        lastSchedulingAttemptAt: plan.lastSchedulingAttemptAt
          ? new Date(plan.lastSchedulingAttemptAt)
          : undefined,
        lastSchedulingError: plan.lastSchedulingError,
        cancelledAt: plan.cancelledAt ? new Date(plan.cancelledAt) : undefined,
        cancellationReason: plan.cancellationReason
      }
    });

    return plan;
  }

  public async listRecurringServicePlans(): Promise<RecurringServicePlan[]> {
    const plans = await this.prisma.recurringServicePlan.findMany({
      orderBy: { requestedAt: "desc" }
    });
    return plans.map((plan: any) => this.mapRecurringServicePlan(plan));
  }

  public async findRecurringServicePlanById(planId: string): Promise<RecurringServicePlan | undefined> {
    const plan = await this.prisma.recurringServicePlan.findUnique({
      where: { id: planId }
    });
    return plan ? this.mapRecurringServicePlan(plan) : undefined;
  }

  public async updateRecurringServicePlan(
    planId: string,
    updates: Partial<RecurringServicePlan>
  ): Promise<RecurringServicePlan | undefined> {
    const current = await this.findRecurringServicePlanById(planId);
    if (!current) {
      return undefined;
    }

    const plan = await this.prisma.recurringServicePlan.update({
      where: { id: planId },
      data: {
        customerId: updates.customerId,
        providerId: updates.providerId,
        launchLeadId: "launchLeadId" in updates ? updates.launchLeadId ?? null : undefined,
        serviceAddress: updates.serviceAddress ? asJson(updates.serviceAddress) : undefined,
        servicePropertyId: "servicePropertyId" in updates ? updates.servicePropertyId ?? null : undefined,
        category: updates.category,
        frequency: updates.frequency,
        requestedAt: updates.requestedAt ? new Date(updates.requestedAt) : undefined,
        notes: updates.notes,
        totalCents: updates.totalCents,
        status: updates.status,
        anchorScheduledStartIso: updates.anchorScheduledStartIso
          ? new Date(updates.anchorScheduledStartIso)
          : undefined,
        anchorScheduledEndIso: updates.anchorScheduledEndIso
          ? new Date(updates.anchorScheduledEndIso)
          : undefined,
        lastGeneratedBookingId:
          "lastGeneratedBookingId" in updates ? updates.lastGeneratedBookingId ?? null : undefined,
        lastGeneratedAt:
          "lastGeneratedAt" in updates
            ? updates.lastGeneratedAt
              ? new Date(updates.lastGeneratedAt)
              : null
            : undefined,
        lastSchedulingAttemptAt:
          "lastSchedulingAttemptAt" in updates
            ? updates.lastSchedulingAttemptAt
              ? new Date(updates.lastSchedulingAttemptAt)
              : null
            : undefined,
        lastSchedulingError:
          "lastSchedulingError" in updates ? updates.lastSchedulingError ?? null : undefined,
        cancelledAt:
          "cancelledAt" in updates
            ? updates.cancelledAt
              ? new Date(updates.cancelledAt)
              : null
            : undefined,
        cancellationReason:
          "cancellationReason" in updates ? updates.cancellationReason ?? null : undefined
      }
    });

    return this.mapRecurringServicePlan(plan);
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
        cancellationReason: match.cancellationReason,
        cancelledAt: match.cancelledAt ? new Date(match.cancelledAt) : undefined,
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
    return matches.map((match) => this.mapCrewMatch(match));
  }

  public async listCrewMatchesForBookings(
    bookingIds: string[],
    crewMemberId?: string
  ): Promise<CrewMatchCandidate[]> {
    if (bookingIds.length === 0) {
      return [];
    }
    const matches = await this.prisma.crewMatch.findMany({
      where: {
        crewMemberId,
        bookingId: { in: bookingIds }
      }
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
        cancellationReason:
          "cancellationReason" in updates ? updates.cancellationReason ?? null : undefined,
        cancelledAt:
          "cancelledAt" in updates
            ? updates.cancelledAt
              ? new Date(updates.cancelledAt)
              : null
            : undefined,
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
        responseStatus: review.responseStatus,
        responseHandledAt: review.responseHandledAt ? new Date(review.responseHandledAt) : undefined,
        responseHandledBy: review.responseHandledBy,
        responseNotes: review.responseNotes,
        publicReplyBody: review.publicReplyBody,
        responseChannel: review.responseChannel,
        responseChannelMetadata:
          review.responseChannelMetadata as Prisma.InputJsonValue | undefined,
        externalResponseId: review.externalResponseId,
        publicResponseUrl: review.publicResponseUrl,
        supportTicketId: review.supportTicketId,
        escalatedAt: review.escalatedAt ? new Date(review.escalatedAt) : undefined,
        escalatedBy: review.escalatedBy,
        escalationNotes: review.escalationNotes,
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

  public async findProviderReviewById(reviewId: string): Promise<ProviderReview | undefined> {
    const review = await this.prisma.providerReview.findUnique({
      where: { id: reviewId }
    });
    return review ? this.mapProviderReview(review) : undefined;
  }

  public async findProviderReviewByBookingId(bookingId: string): Promise<ProviderReview | undefined> {
    const review = await this.prisma.providerReview.findUnique({
      where: { bookingId }
    });
    return review ? this.mapProviderReview(review) : undefined;
  }

  public async updateProviderReview(
    reviewId: string,
    updates: Partial<ProviderReview>
  ): Promise<ProviderReview | undefined> {
    const review = await this.prisma.providerReview.update({
      where: { id: reviewId },
      data: {
        bookingId: updates.bookingId,
        providerId: updates.providerId,
        customerId: updates.customerId,
        overallRating: updates.overallRating,
        timelinessRating: updates.timelinessRating,
        attentionToDetailRating: updates.attentionToDetailRating,
        reviewText: updates.reviewText,
        responseStatus: updates.responseStatus,
        responseHandledAt:
          "responseHandledAt" in updates
            ? updates.responseHandledAt ? new Date(updates.responseHandledAt) : null
            : undefined,
        responseHandledBy:
          "responseHandledBy" in updates ? updates.responseHandledBy ?? null : undefined,
        responseNotes: "responseNotes" in updates ? updates.responseNotes ?? null : undefined,
        publicReplyBody:
          "publicReplyBody" in updates ? updates.publicReplyBody ?? null : undefined,
        responseChannel:
          "responseChannel" in updates ? updates.responseChannel ?? null : undefined,
        responseChannelMetadata:
          "responseChannelMetadata" in updates
            ? updates.responseChannelMetadata === undefined
              ? undefined
              : updates.responseChannelMetadata === null
                ? Prisma.JsonNull
                : (updates.responseChannelMetadata as Prisma.InputJsonValue)
            : undefined,
        externalResponseId:
          "externalResponseId" in updates ? updates.externalResponseId ?? null : undefined,
        publicResponseUrl:
          "publicResponseUrl" in updates ? updates.publicResponseUrl ?? null : undefined,
        supportTicketId: "supportTicketId" in updates ? updates.supportTicketId ?? null : undefined,
        escalatedAt:
          "escalatedAt" in updates ? (updates.escalatedAt ? new Date(updates.escalatedAt) : null) : undefined,
        escalatedBy: "escalatedBy" in updates ? updates.escalatedBy ?? null : undefined,
        escalationNotes: "escalationNotes" in updates ? updates.escalationNotes ?? null : undefined,
        createdAt: updates.createdAt ? new Date(updates.createdAt) : undefined
      }
    }).catch(() => undefined);

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

  public async listReviewInvites(): Promise<ReviewInvite[]> {
    const invites = await this.prisma.reviewInvite.findMany();
    return invites.map((invite: any) => this.mapReviewInvite(invite));
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
      include: { user: true, credentials: true, connectAccount: true }
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

    await this.transaction(async (tx: any) => {
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
          minimumBookingLeadHours: updates.minimumBookingLeadHours,
          staffingMode: updates.staffingMode,
          crewReviewLeadHours: updates.crewReviewLeadHours,
          departureReminderLeadMinutes: updates.departureReminderLeadMinutes,
          routeLeaderMode: updates.routeLeaderMode,
          weeklyPayoutDay: updates.weeklyPayoutDay,
          instantPayoutsEnabled: updates.instantPayoutsEnabled,
          verificationStatus: updates.verificationStatus,
          verificationSubmittedAt: updates.verificationSubmittedAt
            ? new Date(updates.verificationSubmittedAt)
            : updates.verificationSubmittedAt === undefined
              ? undefined
              : null,
          verificationReviewedAt: updates.verificationReviewedAt
            ? new Date(updates.verificationReviewedAt)
            : updates.verificationReviewedAt === undefined
              ? undefined
              : null,
          verificationNotes:
            updates.verificationNotes === undefined ? undefined : updates.verificationNotes,
          servicePrices: updates.servicePrices ? asJson(updates.servicePrices) : undefined,
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
        fullRefundAttempt: payment.fullRefundAttempt as unknown as Prisma.InputJsonValue | undefined,
        partialRefunds: payment.partialRefunds as unknown as Prisma.InputJsonValue | undefined,
        checkoutSessionExpiredAt: payment.checkoutSessionExpiredAt ? new Date(payment.checkoutSessionExpiredAt) : undefined,
        refundRequestedAt: payment.refundRequestedAt ? new Date(payment.refundRequestedAt) : undefined,
        refundReviewedAt: payment.refundReviewedAt ? new Date(payment.refundReviewedAt) : undefined,
        processorFeeUpdatedAt: payment.processorFeeUpdatedAt
          ? new Date(payment.processorFeeUpdatedAt)
          : undefined,
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
    return payments.map((payment) => this.mapPaymentRecord(payment));
  }

  public async listPaymentsForBookingIds(bookingIds: string[]): Promise<PaymentRecord[]> {
    if (bookingIds.length === 0) {
      return [];
    }
    const payments = await this.prisma.paymentRecord.findMany({
      where: { bookingId: { in: bookingIds } },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }]
    });
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

    await this.prisma.paymentRecord.updateMany({
      where: { id: paymentId, ...(updates.status && updates.status !== "refunded" ? { status: { not: "refunded" } } : {}) },
      data: {
        ...updates,
        fullRefundAttempt: updates.fullRefundAttempt as unknown as Prisma.InputJsonValue | undefined,
        partialRefunds: updates.partialRefunds as unknown as Prisma.InputJsonValue | undefined,
        checkoutSessionExpiredAt: updates.checkoutSessionExpiredAt ? new Date(updates.checkoutSessionExpiredAt) : undefined,
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
        processorFeeUpdatedAt:
          updates.processorFeeUpdatedAt
            ? new Date(updates.processorFeeUpdatedAt)
            : updates.processorFeeUpdatedAt === undefined
              ? undefined
              : null,
        paidAt: updates.paidAt ? new Date(updates.paidAt) : updates.paidAt === undefined ? undefined : null,
        updatedAt: updates.updatedAt ? new Date(updates.updatedAt) : undefined
      }
    });
    return this.findPaymentById(paymentId);
  }

  public async settleBookingFinancials(
    input: CreateBookingFinancialSettlementInput
  ): Promise<BookingFinancialSettlement> {
    const existing = await (this.prisma as any).bookingFinancialSettlement.findUnique({
      where: { bookingId: input.bookingId }
    });
    if (existing) {
      return this.mapBookingFinancialSettlement(existing);
    }

    try {
      const settlement = await this.transaction(async (tx: any) => {
        const claim = await tx.customerProviderRelationship.createMany({
          data: {
            customerId: input.customerId,
            providerId: input.providerId,
            firstSettledBookingId: input.bookingId,
            createdAt: new Date()
          },
          skipDuplicates: true
        });
        const relationship = await tx.customerProviderRelationship.findUnique({
          where: {
            customerId_providerId: {
              customerId: input.customerId,
              providerId: input.providerId
            }
          }
        });
        const isFirstCompletedCustomerProviderJob =
          claim.count === 1 || relationship?.firstSettledBookingId === input.bookingId;
        const breakdown = calculateMarketplaceSettlement({
          customerChargeCents: input.customerChargeCents,
          isFirstCompletedCustomerProviderJob,
          actualProcessorFeeCents: input.actualProcessorFeeCents
        });
        const now = new Date();
        const created = await tx.bookingFinancialSettlement.create({
          data: {
            id: crypto.randomUUID(),
            bookingId: input.bookingId,
            paymentId: input.paymentId,
            customerId: input.customerId,
            providerId: input.providerId,
            currency: input.currency.toLowerCase(),
            policyVersion: breakdown.policyVersion,
            customerChargeCents: breakdown.customerChargeCents,
            providerServiceGrossCents: breakdown.providerServiceGrossCents,
            finderFeeCents: breakdown.finderFeeCents,
            completedJobFeeCents: breakdown.completedJobFeeCents,
            platformGrossRevenueCents: breakdown.platformGrossRevenueCents,
            actualProcessorFeeCents: breakdown.actualProcessorFeeCents,
            platformNetRevenueCents: breakdown.platformNetRevenueCents,
            providerNetCents: breakdown.providerNetCents,
            crewPayoutByYardMatchCents: 0,
            isFirstCompletedCustomerProviderJob,
            status: "recorded",
            createdAt: now,
            updatedAt: now
          }
        });
        const ledgerDraft = buildSettlementLedgerDraft(input.bookingId, breakdown);
        await tx.financialLedgerEntry.createMany({
          data: ledgerDraft.map((entry) => ({
            id: crypto.randomUUID(),
            settlementId: created.id,
            bookingId: input.bookingId,
            paymentId: input.paymentId,
            account: entry.account,
            direction: entry.direction,
            amountCents: entry.amountCents,
            currency: input.currency.toLowerCase(),
            idempotencyKey: entry.idempotencyKey,
            source:
              entry.account === "payment-processing-expense"
                ? "processor-fee"
                : "booking-settlement",
            createdAt: now
          })),
          skipDuplicates: true
        });
        return created;
      });
      return this.mapBookingFinancialSettlement(settlement);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const concurrent = await (this.prisma as any).bookingFinancialSettlement.findUnique({
          where: { bookingId: input.bookingId }
        });
        if (concurrent) {
          return this.mapBookingFinancialSettlement(concurrent);
        }
      }
      throw error;
    }
  }

  public async findBookingFinancialSettlement(
    bookingId: string
  ): Promise<BookingFinancialSettlement | undefined> {
    const settlement = await (this.prisma as any).bookingFinancialSettlement.findUnique({
      where: { bookingId }
    });
    return settlement ? this.mapBookingFinancialSettlement(settlement) : undefined;
  }

  public async appendFinancialLedgerEntries(entries: FinancialLedgerEntry[]): Promise<void> {
    await this.prisma.financialLedgerEntry.createMany({ data: entries.map(entry => ({ ...entry, createdAt: new Date(entry.createdAt) })), skipDuplicates: true });
  }

  public async listFinancialLedgerEntries(bookingId?: string): Promise<FinancialLedgerEntry[]> {
    const entries = await (this.prisma as any).financialLedgerEntry.findMany({
      where: bookingId ? { bookingId } : undefined,
      orderBy: { createdAt: "asc" }
    });
    return entries.map((entry: any) => this.mapFinancialLedgerEntry(entry));
  }

  public async listProviderCredentials(providerId: string): Promise<ProviderCredential[]> {
    const credentials = await (this.prisma as any).providerCredential.findMany({
      where: { providerId },
      orderBy: [{ type: "asc" }, { jurisdiction: "asc" }]
    });
    return credentials.map((credential: any) => this.mapProviderCredential(credential));
  }

  public async upsertProviderCredential(credential: ProviderCredential): Promise<ProviderCredential> {
    const saved = await (this.prisma as any).providerCredential.upsert({
      where: {
        providerId_type_jurisdiction: {
          providerId: credential.providerId,
          type: credential.type,
          jurisdiction: credential.jurisdiction
        }
      },
      create: this.buildProviderCredentialPersistence(credential),
      update: this.buildProviderCredentialPersistence(credential)
    });
    return this.mapProviderCredential(saved);
  }

  public async findProviderConnectAccount(
    providerId: string
  ): Promise<ProviderConnectAccount | undefined> {
    const account = await (this.prisma as any).providerConnectAccount.findUnique({
      where: { providerId }
    });
    return account ? this.mapProviderConnectAccount(account) : undefined;
  }

  public async upsertProviderConnectAccount(
    account: ProviderConnectAccount
  ): Promise<ProviderConnectAccount> {
    const persistence = {
      ...account,
      createdAt: new Date(account.createdAt),
      updatedAt: new Date(account.updatedAt),
      lastSyncedAt: account.lastSyncedAt ? new Date(account.lastSyncedAt) : null
    };
    const saved = await (this.prisma as any).providerConnectAccount.upsert({
      where: { providerId: account.providerId },
      create: persistence,
      update: {
        ...persistence,
        createdAt: undefined
      }
    });
    return this.mapProviderConnectAccount(saved);
  }

  public async createPayoutDisbursementRun(
    run: OpsPayoutDisbursementRun
  ): Promise<OpsPayoutDisbursementRun> {
    try {
      await (this.prisma as any).payoutDisbursementRun.create({
        data: {
        id: run.id,
        previewBatchId: run.previewBatchId,
        entryFingerprint: run.entryFingerprint,
        runDateIso: new Date(run.runDateIso),
        recipientRole: run.recipientRole,
        railMode: run.railMode,
        actionStatus: run.actionStatus,
        status: run.status,
        totalCents: run.totalCents,
        recipientCount: run.recipientCount,
        bookingCount: run.bookingCount,
        entryCount: run.entryCount,
        recipientIds: run.recipientIds,
        entryIds: run.entryIds,
        entries: asJson(run.entries),
        blockerReasons: run.blockerReasons,
        manualActionLabel: run.manualActionLabel,
        auditInstructions: run.auditInstructions,
        createdAt: new Date(run.createdAt),
        updatedAt: new Date(run.updatedAt),
        createdByOpsUserId: run.createdByOpsUserId,
        createdByOpsEmail: run.createdByOpsEmail,
        operatorNotes: run.operatorNotes,
        reconciliationReference: run.reconciliationReference,
        reconciliationNotes: run.reconciliationNotes,
        reconciledAt: run.reconciledAt ? new Date(run.reconciledAt) : undefined,
        reconciledByOpsUserId: run.reconciledByOpsUserId
        }
      });
      return run;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const existing = await this.findPayoutDisbursementRunByBatchFingerprint(
          run.previewBatchId,
          run.entryFingerprint
        );
        if (existing) {
          return existing;
        }
      }
      throw error;
    }
  }

  public async listPayoutDisbursementRuns(): Promise<OpsPayoutDisbursementRun[]> {
    const runs = await (this.prisma as any).payoutDisbursementRun.findMany({
      orderBy: [{ runDateIso: "desc" }, { createdAt: "desc" }]
    });
    return runs.map((run: any) => this.mapPayoutDisbursementRun(run));
  }

  public async findPayoutDisbursementRunByBatchFingerprint(
    previewBatchId: string,
    entryFingerprint: string
  ): Promise<OpsPayoutDisbursementRun | undefined> {
    const run = await (this.prisma as any).payoutDisbursementRun.findFirst({
      where: {
        previewBatchId,
        entryFingerprint
      }
    });
    return run ? this.mapPayoutDisbursementRun(run) : undefined;
  }

  public async updatePayoutDisbursementRun(
    runId: string,
    updates: Partial<OpsPayoutDisbursementRun>
  ): Promise<OpsPayoutDisbursementRun | undefined> {
    const current = await (this.prisma as any).payoutDisbursementRun.findUnique({
      where: { id: runId }
    });
    if (!current) {
      return undefined;
    }
    const saved = await (this.prisma as any).payoutDisbursementRun.update({
      where: { id: runId },
      data: {
        previewBatchId: updates.previewBatchId,
        entryFingerprint: updates.entryFingerprint,
        runDateIso: updates.runDateIso ? new Date(updates.runDateIso) : undefined,
        recipientRole: updates.recipientRole,
        railMode: updates.railMode,
        actionStatus: updates.actionStatus,
        status: updates.status,
        totalCents: updates.totalCents,
        recipientCount: updates.recipientCount,
        bookingCount: updates.bookingCount,
        entryCount: updates.entryCount,
        recipientIds: updates.recipientIds,
        entryIds: updates.entryIds,
        entries: updates.entries ? asJson(updates.entries) : undefined,
        blockerReasons: updates.blockerReasons,
        manualActionLabel: updates.manualActionLabel,
        auditInstructions: updates.auditInstructions,
        updatedAt: updates.updatedAt ? new Date(updates.updatedAt) : undefined,
        operatorNotes: updates.operatorNotes,
        reconciliationReference: updates.reconciliationReference,
        reconciliationNotes: updates.reconciliationNotes,
        reconciledAt:
          updates.reconciledAt
            ? new Date(updates.reconciledAt)
            : updates.reconciledAt === undefined
              ? undefined
              : null,
        reconciledByOpsUserId: updates.reconciledByOpsUserId
      }
    });
    return this.mapPayoutDisbursementRun(saved);
  }

  public async createProviderTransferRecord(
    record: ProviderTransferRecord
  ): Promise<ProviderTransferRecord> {
    try {
      const saved = await (this.prisma as any).providerTransferRecord.create({
        data: this.buildProviderTransferPersistence(record)
      });
      return this.mapProviderTransferRecord(saved);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const existing = await this.findProviderTransferBySettlementId(record.settlementId);
        if (existing) {
          return existing;
        }
      }
      throw error;
    }
  }

  public async findProviderTransferBySettlementId(
    settlementId: string
  ): Promise<ProviderTransferRecord | undefined> {
    const record = await (this.prisma as any).providerTransferRecord.findUnique({
      where: { settlementId }
    });
    return record ? this.mapProviderTransferRecord(record) : undefined;
  }

  public async listProviderTransferRecords(): Promise<ProviderTransferRecord[]> {
    const records = await (this.prisma as any).providerTransferRecord.findMany({
      orderBy: { createdAt: "desc" }
    });
    return records.map((record: any) => this.mapProviderTransferRecord(record));
  }

  public async updateProviderTransferRecord(
    transferRecordId: string,
    updates: Partial<ProviderTransferRecord>
  ): Promise<ProviderTransferRecord | undefined> {
    const current = await (this.prisma as any).providerTransferRecord.findUnique({
      where: { id: transferRecordId }
    });
    if (!current) {
      return undefined;
    }
    const saved = await (this.prisma as any).providerTransferRecord.update({
      where: { id: transferRecordId },
      data: {
        stripeAccountId: updates.stripeAccountId,
        stripeTransferId: updates.stripeTransferId,
        stripeTransferReversalId: updates.stripeTransferReversalId,
        amountCents: updates.amountCents,
        currency: updates.currency,
        status: updates.status,
        failureReason: updates.failureReason,
        updatedAt: updates.updatedAt ? new Date(updates.updatedAt) : undefined,
        transferredAt:
          updates.transferredAt
            ? new Date(updates.transferredAt)
            : updates.transferredAt === undefined
              ? undefined
              : null,
        reversedAt:
          updates.reversedAt
            ? new Date(updates.reversedAt)
            : updates.reversedAt === undefined
              ? undefined
              : null
      }
    });
    return this.mapProviderTransferRecord(saved);
  }

  public async completeProviderTransfer(
    input: CompleteProviderTransferInput
  ): Promise<ProviderTransferRecord> {
    const record = await this.transaction(async (tx: any) => {
      const current = await tx.providerTransferRecord.findUnique({
        where: { id: input.transferRecordId }
      });
      if (!current) {
        throw new Error("Provider transfer record not found");
      }
      if (current.status === "transferred" || current.status === "reversed") {
        return current;
      }
      await tx.financialLedgerEntry.createMany({
        data: input.ledgerEntries.map((entry) => ({
          ...entry,
          createdAt: new Date(entry.createdAt)
        })),
        skipDuplicates: true
      });
      await tx.bookingFinancialSettlement.update({
        where: { id: current.settlementId },
        data: { status: "transferred", updatedAt: new Date(input.transferredAt) }
      });
      return tx.providerTransferRecord.update({
        where: { id: input.transferRecordId },
        data: {
          stripeTransferId: input.stripeTransferId,
          status: "transferred",
          failureReason: null,
          transferredAt: new Date(input.transferredAt),
          updatedAt: new Date(input.transferredAt)
        }
      });
    });
    return this.mapProviderTransferRecord(record);
  }

  public async completeProviderTransferReversal(
    input: CompleteProviderTransferReversalInput
  ): Promise<ProviderTransferRecord> {
    const record = await this.transaction(async (tx: any) => {
      const current = await tx.providerTransferRecord.findUnique({
        where: { id: input.transferRecordId }
      });
      if (!current) {
        throw new Error("Provider transfer record not found");
      }
      if (current.status === "reversed") {
        return current;
      }
      await tx.financialLedgerEntry.createMany({
        data: input.ledgerEntries.map((entry) => ({
          ...entry,
          createdAt: new Date(entry.createdAt)
        })),
        skipDuplicates: true
      });
      await tx.bookingFinancialSettlement.update({
        where: { id: current.settlementId },
        data: { status: "reversed", updatedAt: new Date(input.reversedAt) }
      });
      return tx.providerTransferRecord.update({
        where: { id: input.transferRecordId },
        data: {
          stripeTransferReversalId: input.stripeTransferReversalId,
          status: "reversed",
          failureReason: null,
          reversedAt: new Date(input.reversedAt),
          updatedAt: new Date(input.reversedAt)
        }
      });
    });
    return this.mapProviderTransferRecord(record);
  }

  public async createLaunchOperationsTask(task: LaunchOperationsTask): Promise<LaunchOperationsTask> {
    await (this.prisma as any).launchOperationsTask.create({
      data: {
        id: task.id,
        recommendationFingerprint: task.recommendationFingerprint,
        recommendationKey: task.recommendationKey,
        pocketKey: task.pocketKey,
        city: task.city,
        state: task.state,
        postalCode: task.postalCode,
        priority: task.priority,
        owner: task.owner,
        status: task.status,
        title: task.title,
        detail: task.detail,
        recommendedAction: task.recommendedAction,
        dueAtIso: new Date(task.dueAtIso),
        relatedScenarioKeys: task.relatedScenarioKeys,
        createdAt: new Date(task.createdAt),
        updatedAt: new Date(task.updatedAt),
        createdByOpsUserId: task.createdByOpsUserId,
        createdByOpsEmail: task.createdByOpsEmail,
        assignedToOpsUserId: task.assignedToOpsUserId,
        assignedToOpsEmail: task.assignedToOpsEmail,
        operatorNotes: task.operatorNotes,
        completionNotes: task.completionNotes,
        completedAt: task.completedAt ? new Date(task.completedAt) : undefined,
        completedByOpsUserId: task.completedByOpsUserId
      }
    });
    return task;
  }

  public async listLaunchOperationsTasks(): Promise<LaunchOperationsTask[]> {
    const tasks = await (this.prisma as any).launchOperationsTask.findMany({
      orderBy: [{ status: "asc" }, { dueAtIso: "asc" }, { priority: "desc" }, { updatedAt: "desc" }]
    });
    return tasks.map((task: any) => this.mapLaunchOperationsTask(task));
  }

  public async findLaunchOperationsTaskByRecommendationFingerprint(
    recommendationFingerprint: string
  ): Promise<LaunchOperationsTask | undefined> {
    const task = await (this.prisma as any).launchOperationsTask.findUnique({
      where: { recommendationFingerprint }
    });
    return task ? this.mapLaunchOperationsTask(task) : undefined;
  }

  public async updateLaunchOperationsTask(
    taskId: string,
    updates: Partial<LaunchOperationsTask>
  ): Promise<LaunchOperationsTask | undefined> {
    const data: Record<string, unknown> = {
      recommendationFingerprint: updates.recommendationFingerprint,
      recommendationKey: updates.recommendationKey,
      pocketKey: updates.pocketKey,
      city: updates.city,
      state: updates.state,
      postalCode: updates.postalCode,
      priority: updates.priority,
      owner: updates.owner,
      status: updates.status,
      title: updates.title,
      detail: updates.detail,
      recommendedAction: updates.recommendedAction,
      dueAtIso: updates.dueAtIso ? new Date(updates.dueAtIso) : undefined,
      relatedScenarioKeys: updates.relatedScenarioKeys,
      updatedAt: updates.updatedAt ? new Date(updates.updatedAt) : undefined
    };
    if (Object.prototype.hasOwnProperty.call(updates, "assignedToOpsUserId")) {
      data.assignedToOpsUserId = updates.assignedToOpsUserId ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(updates, "assignedToOpsEmail")) {
      data.assignedToOpsEmail = updates.assignedToOpsEmail ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(updates, "operatorNotes")) {
      data.operatorNotes = updates.operatorNotes ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(updates, "completionNotes")) {
      data.completionNotes = updates.completionNotes ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(updates, "completedAt")) {
      data.completedAt = updates.completedAt ? new Date(updates.completedAt) : null;
    }
    if (Object.prototype.hasOwnProperty.call(updates, "completedByOpsUserId")) {
      data.completedByOpsUserId = updates.completedByOpsUserId ?? null;
    }

    const task = await (this.prisma as any).launchOperationsTask.update({
      where: { id: taskId },
      data
    }).catch((error: unknown) => {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: string }).code === "P2025"
      ) {
        return undefined;
      }
      throw error;
    });
    return task ? this.mapLaunchOperationsTask(task) : undefined;
  }

  public async createOpsAutomationRun(run: OpsAutomationRunRecord): Promise<OpsAutomationRunRecord> {
    await (this.prisma as any).opsAutomationRun.create({
      data: {
        id: run.id,
        runId: run.runId,
        generatedAt: new Date(run.generatedAt),
        asOfIso: new Date(run.asOfIso),
        dryRun: run.dryRun,
        requestedSweepKeys: run.requestedSweepKeys,
        requestedSweepCount: run.requestedSweepCount,
        completedSweepCount: run.completedSweepCount,
        failedSweepCount: run.failedSweepCount,
        sentNotificationCount: run.sentNotificationCount,
        alreadySentCount: run.alreadySentCount,
        skippedCount: run.skippedCount,
        items: asJson(run.items),
        createdAt: new Date(run.createdAt),
        createdByOpsUserId: run.createdByOpsUserId,
        createdByOpsEmail: run.createdByOpsEmail
      }
    });
    return run;
  }

  public async listOpsAutomationRuns(): Promise<OpsAutomationRunRecord[]> {
    const runs = await (this.prisma as any).opsAutomationRun.findMany({
      orderBy: [{ createdAt: "desc" }]
    });
    return runs.map((run: any) => this.mapOpsAutomationRun(run));
  }

  public async createLaunchLead(lead: LaunchLead): Promise<LaunchLead> {
    await this.prisma.launchLead.create({
      data: {
        ...lead,
        sourceReferenceId: lead.sourceReferenceId,
        channelMetadata: lead.channelMetadata ? asJson(lead.channelMetadata) : undefined,
        attribution: lead.attribution ? asJson(lead.attribution) : undefined,
        email: lead.email,
        phone: lead.phone,
        serviceCategory: lead.serviceCategory,
        requestSource: lead.requestSource,
        assignedOwner: lead.assignedOwner,
        firstResponseDueAt: new Date(lead.firstResponseDueAt),
        firstRespondedAt: lead.firstRespondedAt ? new Date(lead.firstRespondedAt) : undefined,
        lastContactedAt: lead.lastContactedAt ? new Date(lead.lastContactedAt) : undefined,
        nextFollowUpDueAt: lead.nextFollowUpDueAt ? new Date(lead.nextFollowUpDueAt) : undefined,
        closedAt: lead.closedAt ? new Date(lead.closedAt) : undefined,
        lossReason: lead.lossReason,
        outcomeSummary: lead.outcomeSummary,
        createdAt: new Date(lead.createdAt),
        updatedAt: new Date(lead.updatedAt)
      }
    });
    return lead;
  }

  public async createCustomerReferralWithLead(referral: CustomerReferralRecord, lead: LaunchLead): Promise<CustomerReferralRecord> {
    return this.transaction(async (tx) => {
      await new PrismaMarketplaceRepository(tx as PrismaClient, true).createLaunchLead(lead);
      const data = { id: referral.id, referrerCustomerId: referral.referrerCustomerId, leadId: referral.leadId,
        friendName: referral.friendName, channel: referral.channel, contact: referral.contact, areaLabel: referral.areaLabel,
        consentVersion: referral.consentVersion, consentedAt: referral.consentedAt, createdAt: referral.createdAt };
      await tx.customerReferral.create({ data: { ...data, consentedAt: new Date(data.consentedAt), createdAt: new Date(data.createdAt) } });
      return referral;
    });
  }

  private mapCustomerReferral(record: Prisma.CustomerReferralGetPayload<{ include: { lead: true } }>): CustomerReferralRecord {
    return { id: record.id, referrerCustomerId: record.referrerCustomerId, leadId: record.leadId,
      friendName: record.friendName, channel: record.channel as CustomerReferralRecord["channel"], contact: record.contact,
      areaLabel: record.areaLabel ?? undefined, consentVersion: record.consentVersion,
      consentedAt: record.consentedAt.toISOString(), createdAt: record.createdAt.toISOString(),
      leadStatus: record.lead.status as CustomerReferralRecord["leadStatus"] };
  }

  public async findCustomerReferralByContact(customerId: string, channel: string, contact: string): Promise<CustomerReferralRecord | undefined> {
    const record = await this.prisma.customerReferral.findUnique({
      where: { referrerCustomerId_channel_contact: { referrerCustomerId: customerId, channel, contact } }, include: { lead: true }
    });
    return record ? this.mapCustomerReferral(record) : undefined;
  }

  public async listCustomerReferrals(customerId: string): Promise<CustomerReferralRecord[]> {
    const records = await this.prisma.customerReferral.findMany({ where: { referrerCustomerId: customerId },
      include: { lead: true }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 100 });
    return records.map((record) => this.mapCustomerReferral(record));
  }

  public async countCustomerReferralsSince(customerId: string, since: string): Promise<number> {
    return this.prisma.customerReferral.count({ where: { referrerCustomerId: customerId, createdAt: { gte: new Date(since) } } });
  }

  public async listLaunchLeads(): Promise<LaunchLead[]> {
    const leads = await this.prisma.launchLead.findMany({
      orderBy: { createdAt: "desc" }
    });
    return leads.map((lead: any) => this.mapLaunchLead(lead));
  }

  public async findLaunchLeadById(leadId: string): Promise<LaunchLead | undefined> {
    const lead = await this.prisma.launchLead.findUnique({
      where: { id: leadId }
    });
    return lead ? this.mapLaunchLead(lead) : undefined;
  }

  public async findLaunchLeadBySourceReferenceId(
    sourceReferenceId: string
  ): Promise<LaunchLead | undefined> {
    const lead = await this.prisma.launchLead.findUnique({
      where: { sourceReferenceId }
    });
    return lead ? this.mapLaunchLead(lead) : undefined;
  }

  public async updateLaunchLead(
    leadId: string,
    updates: Partial<LaunchLead>
  ): Promise<LaunchLead | undefined> {
    const current = await this.prisma.launchLead.findUnique({
      where: { id: leadId }
    });

    if (!current) {
      return undefined;
    }

    const lead = await this.prisma.launchLead.update({
      where: { id: leadId },
      data: {
        sourceChannel: updates.sourceChannel,
        requestSource: updates.requestSource,
        sourceReferenceId: updates.sourceReferenceId,
        channelMetadata:
          updates.channelMetadata === undefined
            ? undefined
            : updates.channelMetadata
              ? asJson(updates.channelMetadata)
              : null,
        attribution:
          updates.attribution === undefined
            ? undefined
            : updates.attribution
              ? asJson(updates.attribution)
              : null,
        contactName: updates.contactName,
        email: updates.email,
        phone: updates.phone,
        preferredContactMethod: updates.preferredContactMethod,
        areaLabel: updates.areaLabel,
        serviceCategory: updates.serviceCategory,
        message: updates.message,
        status: updates.status,
        assignedOwner: updates.assignedOwner,
        firstResponseDueAt: updates.firstResponseDueAt ? new Date(updates.firstResponseDueAt) : undefined,
        firstRespondedAt:
          updates.firstRespondedAt
            ? new Date(updates.firstRespondedAt)
            : updates.firstRespondedAt === undefined
              ? undefined
              : null,
        lastContactedAt:
          updates.lastContactedAt
            ? new Date(updates.lastContactedAt)
            : updates.lastContactedAt === undefined
              ? undefined
              : null,
        nextFollowUpDueAt:
          updates.nextFollowUpDueAt
            ? new Date(updates.nextFollowUpDueAt)
            : updates.nextFollowUpDueAt === undefined
              ? undefined
              : null,
        closedAt:
          updates.closedAt ? new Date(updates.closedAt) : updates.closedAt === undefined ? undefined : null,
        lossReason: updates.lossReason === undefined ? undefined : updates.lossReason,
        outcomeSummary:
          updates.outcomeSummary === undefined ? undefined : updates.outcomeSummary,
        convertedBookingIds:
          updates.convertedBookingIds === undefined ? undefined : updates.convertedBookingIds,
        reviewIds: updates.reviewIds === undefined ? undefined : updates.reviewIds,
        firstConvertedBookingAt:
          updates.firstConvertedBookingAt
            ? new Date(updates.firstConvertedBookingAt)
            : updates.firstConvertedBookingAt === undefined
              ? undefined
              : null,
        lastConvertedBookingAt:
          updates.lastConvertedBookingAt
            ? new Date(updates.lastConvertedBookingAt)
            : updates.lastConvertedBookingAt === undefined
              ? undefined
              : null,
        lastReviewSubmittedAt:
          updates.lastReviewSubmittedAt
            ? new Date(updates.lastReviewSubmittedAt)
            : updates.lastReviewSubmittedAt === undefined
              ? undefined
              : null,
        createdAt: updates.createdAt ? new Date(updates.createdAt) : undefined,
        updatedAt: updates.updatedAt ? new Date(updates.updatedAt) : undefined
      }
    });

    return this.mapLaunchLead(lead);
  }

  public async createSupportTicket(ticket: SupportTicket): Promise<SupportTicket> {
    await this.prisma.supportTicket.create({
      data: {
        ...ticket,
        complaint: ticket.complaint as unknown as Prisma.InputJsonValue | undefined,
        launchLeadId: ticket.launchLeadId,
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
        complaint: updates.complaint as unknown as Prisma.InputJsonValue | undefined,
        bookingId: updates.bookingId,
        launchLeadId: updates.launchLeadId,
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

  public async createNotificationIfAbsent(notification: AppNotification): Promise<boolean> {
    const result = await this.prisma.appNotification.createMany({
      data: [{ ...notification, createdAt: new Date(notification.createdAt), readAt: notification.readAt ? new Date(notification.readAt) : null }],
      skipDuplicates: true
    });
    return result.count === 1;
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

  public async findNotificationById(id: string): Promise<AppNotification | undefined> {
    const row = await this.prisma.appNotification.findUnique({ where: { id } });
    return row ? this.mapAppNotification(row) : undefined;
  }

  public async claimNotificationDeliveries(limit: number, nowIso: string, leaseSeconds: number) {
    const now = new Date(nowIso);
    const token = crypto.randomUUID();
    const expires = new Date(now.getTime() + leaseSeconds * 1000);
    // Exhausted abandoned jobs remain visible to ops, without an endless crash/retry loop.
    await this.prisma.notificationDelivery.updateMany({
      where: { leaseExpiresAt: { lte: now }, attemptCount: { gte: 3 }, status: { in: ["queued", "failed"] } },
      data: { status: "failed", leaseToken: null, leaseExpiresAt: null, nextRetryAt: null,
        errorMessage: "Delivery repeatedly interrupted; manual review required." }
    });
    const rows = await this.prisma.$queryRaw<NotificationDelivery[]>`
      WITH due AS (
        SELECT id FROM notification_deliveries
        WHERE (status = 'queued' OR (status = 'failed' AND "nextRetryAt" <= ${utcTimestamp(now)}))
          AND ("leaseExpiresAt" IS NULL OR "leaseExpiresAt" <= ${utcTimestamp(now)}) AND "attemptCount" < 3
        ORDER BY "createdAt", id LIMIT ${Math.max(1, Math.min(100, limit))}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE notification_deliveries AS delivery SET "leaseToken" = ${token}, "leaseExpiresAt" = ${utcTimestamp(expires)},
        "attemptCount" = "attemptCount" + 1, "lastAttemptAt" = ${utcTimestamp(now)}
      FROM due WHERE delivery.id = due.id RETURNING delivery.*`;
    return rows.map(row => ({ ...this.mapNotificationDelivery(row), leaseToken: token }));
  }

  public async countDueNotificationDeliveries(nowIso: string): Promise<number> {
    const now = new Date(nowIso);
    return this.prisma.notificationDelivery.count({ where: {
      AND: [{ OR: [{ status: "queued" }, { status: "failed", nextRetryAt: { lte: now } }] },
        { OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lte: now } }] }], attemptCount: { lt: 3 }
    } });
  }

  public async completeNotificationDelivery(id: string, leaseToken: string, updates: Partial<NotificationDeliveryRecord>) {
    const result = await this.prisma.notificationDelivery.updateMany({ where: { id, leaseToken }, data: {
      provider: updates.provider, status: updates.status, errorMessage: updates.errorMessage ?? null,
      nextRetryAt: updates.nextRetryAt ? new Date(updates.nextRetryAt) : null,
      sentAt: updates.sentAt ? new Date(updates.sentAt) : null, leaseToken: null, leaseExpiresAt: null
    } });
    if (!result.count) return undefined;
    const row = await this.prisma.notificationDelivery.findUniqueOrThrow({ where: { id } });
    return this.mapNotificationDelivery(row);
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

  public async getNotificationHealth(nowIso: string): Promise<NotificationHealthSnapshot> {
    const now = new Date(nowIso), since = new Date(now.getTime() - 86400_000);
    const [totals, groups, recent] = await Promise.all([
      this.prisma.$queryRaw<Array<Omit<NotificationHealthSnapshot, "channels" | "recentFailures">>>`SELECT
        count(*)::int AS "totalDeliveries", count(*) FILTER (WHERE "createdAt" >= ${utcTimestamp(since)})::int AS "deliveriesLast24Hours",
        count(*) FILTER (WHERE status = 'sent' AND COALESCE("sentAt", "lastAttemptAt") >= ${utcTimestamp(since)})::int AS "sentLast24Hours",
        count(*) FILTER (WHERE status = 'failed' AND COALESCE("lastAttemptAt", "createdAt") >= ${utcTimestamp(since)})::int AS "failedLast24Hours",
        count(*) FILTER (WHERE status = 'queued')::int AS "queuedCount",
        count(*) FILTER (WHERE status = 'failed' AND "nextRetryAt" IS NOT NULL)::int AS "pendingRetryCount",
        count(*) FILTER (WHERE status = 'failed' AND "nextRetryAt" <= ${utcTimestamp(now)})::int AS "overdueRetryCount",
        count(*) FILTER (WHERE status = 'failed' AND "nextRetryAt" IS NULL)::int AS "exhaustedFailureCount" FROM notification_deliveries`,
      this.prisma.$queryRaw<Array<Omit<NotificationHealthSnapshot["channels"][number], "lastAttemptAt"> & { lastAttemptAt: Date }>>`SELECT channel, provider,
        count(*)::int AS "totalDeliveries", count(*) FILTER (WHERE "createdAt" >= ${utcTimestamp(since)})::int AS "deliveriesLast24Hours",
        count(*) FILTER (WHERE status = 'sent')::int AS "sentCount", count(*) FILTER (WHERE status = 'failed')::int AS "failedCount",
        count(*) FILTER (WHERE status = 'queued')::int AS "queuedCount", count(*) FILTER (WHERE "nextRetryAt" IS NOT NULL)::int AS "pendingRetryCount",
        count(*) FILTER (WHERE "nextRetryAt" <= ${utcTimestamp(now)})::int AS "overdueRetryCount",
        max(COALESCE("lastAttemptAt", "sentAt", "createdAt")) AS "lastAttemptAt"
        FROM notification_deliveries GROUP BY channel, provider ORDER BY "failedCount" DESC, "totalDeliveries" DESC`,
      this.prisma.notificationDelivery.findMany({ where: { status: "failed" }, orderBy: { createdAt: "desc" }, take: 8 })
    ]);
    return { ...totals[0], channels: groups.map(row => ({ ...row, lastAttemptAt: row.lastAttemptAt.toISOString() })),
      recentFailures: recent.map(row => this.mapNotificationDelivery(row)) };
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
    return identity ? this.mapAuthIdentity(identity) : undefined;
  }

  public async findAuthIdentityByProvider(
    provider: "google" | "apple",
    subject: string
  ): Promise<AuthIdentityRecord | undefined> {
    const identity = await this.prisma.userAccount.findFirst({
      where: provider === "google" ? { googleSubject: subject } : { appleSubject: subject }
    });
    return identity ? this.mapAuthIdentity(identity) : undefined;
  }

  public async findAuthIdentityByUserId(userId: string): Promise<AuthIdentityRecord | undefined> {
    const identity = await this.prisma.userAccount.findUnique({
      where: { id: userId }
    });
    return identity ? this.mapAuthIdentity(identity) : undefined;
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
        accessDisabledAt:
          "accessDisabledAt" in updates
            ? updates.accessDisabledAt
              ? new Date(updates.accessDisabledAt)
              : null
            : undefined,
        accessDisabledBy:
          "accessDisabledBy" in updates ? updates.accessDisabledBy ?? null : undefined,
        accessChangeNotes:
          "accessChangeNotes" in updates ? updates.accessChangeNotes ?? null : undefined,
        lastAccessChangeAt:
          "lastAccessChangeAt" in updates
            ? updates.lastAccessChangeAt
              ? new Date(updates.lastAccessChangeAt)
              : null
            : undefined,
        lastAccessChangeBy:
          "lastAccessChangeBy" in updates ? updates.lastAccessChangeBy ?? null : undefined,
        lastAccessChangeKind:
          "lastAccessChangeKind" in updates ? updates.lastAccessChangeKind ?? null : undefined,
        accessChangeHistory:
          "accessHistory" in updates ? asJson(updates.accessHistory ?? null) : undefined,
        authenticationEventHistory:
          "authHistory" in updates ? asJson(updates.authHistory ?? null) : undefined,
        lastAuthenticatedAt:
          "lastAuthenticatedAt" in updates
            ? updates.lastAuthenticatedAt
              ? new Date(updates.lastAuthenticatedAt)
              : null
            : undefined,
        lastAuthenticatedMethod:
          "lastAuthenticatedMethod" in updates ? updates.lastAuthenticatedMethod ?? null : undefined,
        failedAuthenticationCount:
          "failedAuthenticationCount" in updates ? updates.failedAuthenticationCount ?? 0 : undefined,
        lastFailedAuthenticationAt:
          "lastFailedAuthenticationAt" in updates
            ? updates.lastFailedAuthenticationAt
              ? new Date(updates.lastFailedAuthenticationAt)
              : null
            : undefined,
        lastFailedAuthenticationReason:
          "lastFailedAuthenticationReason" in updates
            ? updates.lastFailedAuthenticationReason ?? null
            : undefined,
        authenticationLockExpiresAt:
          "authenticationLockExpiresAt" in updates
            ? updates.authenticationLockExpiresAt
              ? new Date(updates.authenticationLockExpiresAt)
              : null
            : undefined,
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
            : undefined,
        twoFactorMethod:
          "twoFactorMethod" in updates ? updates.twoFactorMethod ?? null : undefined,
        twoFactorEnabledAt:
          "twoFactorEnabledAt" in updates
            ? updates.twoFactorEnabledAt
              ? new Date(updates.twoFactorEnabledAt)
              : null
            : undefined,
        twoFactorChallengeId:
          "twoFactorChallengeId" in updates ? updates.twoFactorChallengeId ?? null : undefined,
        twoFactorChallengePurpose:
          "twoFactorChallengePurpose" in updates ? updates.twoFactorChallengePurpose ?? null : undefined,
        twoFactorChallengeMethod:
          "twoFactorChallengeMethod" in updates ? updates.twoFactorChallengeMethod ?? null : undefined,
        twoFactorChallengeCodeHash:
          "twoFactorChallengeCodeHash" in updates ? updates.twoFactorChallengeCodeHash ?? null : undefined,
        twoFactorChallengeExpiresAt:
          "twoFactorChallengeExpiresAt" in updates
            ? updates.twoFactorChallengeExpiresAt
              ? new Date(updates.twoFactorChallengeExpiresAt)
              : null
            : undefined,
        twoFactorChallengeRequestedAt:
          "twoFactorChallengeRequestedAt" in updates
            ? updates.twoFactorChallengeRequestedAt
              ? new Date(updates.twoFactorChallengeRequestedAt)
              : null
            : undefined,
        twoFactorChallengeFailedAttempts:
          "twoFactorChallengeFailedAttempts" in updates
            ? updates.twoFactorChallengeFailedAttempts ?? 0
            : undefined,
        twoFactorChallengeDeviceIdHash:
          "twoFactorChallengeDeviceIdHash" in updates
            ? updates.twoFactorChallengeDeviceIdHash ?? null
            : undefined,
        twoFactorChallengeDeviceLabel:
          "twoFactorChallengeDeviceLabel" in updates
            ? updates.twoFactorChallengeDeviceLabel ?? null
            : undefined,
        twoFactorChallengeDevicePlatform:
          "twoFactorChallengeDevicePlatform" in updates
            ? updates.twoFactorChallengeDevicePlatform ?? null
            : undefined,
        trustedDevices:
          "trustedDevices" in updates ? asJson(updates.trustedDevices ?? null) : undefined,
        securityEventHistory:
          "securityEventHistory" in updates ? asJson(updates.securityEventHistory ?? null) : undefined
      }
    }).catch((error: any) => {
      if (error?.code === "P2025") {
        return undefined;
      }
      throw error;
    });

    return identity ? this.mapAuthIdentity(identity) : undefined;
  }

  private mapAuthIdentity(identity: {
    id: string;
    email: string;
    passwordHash: string | null;
    googleSubject: string | null;
    appleSubject: string | null;
    role: string;
    sessionVersion: number;
    accessDisabledAt: Date | null;
    accessDisabledBy: string | null;
    accessChangeNotes: string | null;
    lastAccessChangeAt: Date | null;
    lastAccessChangeBy: string | null;
    lastAccessChangeKind: string | null;
    accessChangeHistory: unknown;
    authenticationEventHistory: unknown;
    lastAuthenticatedAt: Date | null;
    lastAuthenticatedMethod: string | null;
    failedAuthenticationCount: number;
    lastFailedAuthenticationAt: Date | null;
    lastFailedAuthenticationReason: string | null;
    authenticationLockExpiresAt: Date | null;
    resetPasswordCodeHash: string | null;
    resetPasswordExpiresAt: Date | null;
    resetPasswordRequestedAt: Date | null;
    twoFactorMethod: string | null;
    twoFactorEnabledAt: Date | null;
    twoFactorChallengeId: string | null;
    twoFactorChallengePurpose: string | null;
    twoFactorChallengeMethod: string | null;
    twoFactorChallengeCodeHash: string | null;
    twoFactorChallengeExpiresAt: Date | null;
    twoFactorChallengeRequestedAt: Date | null;
    twoFactorChallengeFailedAttempts: number;
    twoFactorChallengeDeviceIdHash: string | null;
    twoFactorChallengeDeviceLabel: string | null;
    twoFactorChallengeDevicePlatform: string | null;
    trustedDevices: unknown;
    securityEventHistory: unknown;
  }): AuthIdentityRecord {
    return {
      userId: identity.id,
      email: identity.email,
      passwordHash: identity.passwordHash ?? undefined,
      googleSubject: identity.googleSubject ?? undefined,
      appleSubject: identity.appleSubject ?? undefined,
      role: identity.role as AuthIdentityRecord["role"],
      sessionVersion: identity.sessionVersion,
      accessDisabledAt: identity.accessDisabledAt?.toISOString(),
      accessDisabledBy: identity.accessDisabledBy ?? undefined,
      accessChangeNotes: identity.accessChangeNotes ?? undefined,
      lastAccessChangeAt: identity.lastAccessChangeAt?.toISOString(),
      lastAccessChangeBy: identity.lastAccessChangeBy ?? undefined,
      lastAccessChangeKind: identity.lastAccessChangeKind as AuthIdentityRecord["lastAccessChangeKind"] | undefined,
      accessHistory: identity.accessChangeHistory
        ? readJson<OpsAccessHistoryEntry[]>(identity.accessChangeHistory)
        : undefined,
      authHistory: identity.authenticationEventHistory
        ? readJson<OpsAuthenticationHistoryEntry[]>(identity.authenticationEventHistory)
        : undefined,
      lastAuthenticatedAt: identity.lastAuthenticatedAt?.toISOString(),
      lastAuthenticatedMethod: identity.lastAuthenticatedMethod as AuthIdentityRecord["lastAuthenticatedMethod"] | undefined,
      failedAuthenticationCount: identity.failedAuthenticationCount ?? 0,
      lastFailedAuthenticationAt: identity.lastFailedAuthenticationAt?.toISOString(),
      lastFailedAuthenticationReason:
        identity.lastFailedAuthenticationReason as AuthIdentityRecord["lastFailedAuthenticationReason"] | undefined,
      authenticationLockExpiresAt: identity.authenticationLockExpiresAt?.toISOString(),
      resetPasswordCodeHash: identity.resetPasswordCodeHash ?? undefined,
      resetPasswordExpiresAt: identity.resetPasswordExpiresAt?.toISOString(),
      resetPasswordRequestedAt: identity.resetPasswordRequestedAt?.toISOString(),
      twoFactorMethod: identity.twoFactorMethod as AuthIdentityRecord["twoFactorMethod"],
      twoFactorEnabledAt: identity.twoFactorEnabledAt?.toISOString(),
      twoFactorChallengeId: identity.twoFactorChallengeId ?? undefined,
      twoFactorChallengePurpose:
        identity.twoFactorChallengePurpose as AuthIdentityRecord["twoFactorChallengePurpose"],
      twoFactorChallengeMethod:
        identity.twoFactorChallengeMethod as AuthIdentityRecord["twoFactorChallengeMethod"],
      twoFactorChallengeCodeHash: identity.twoFactorChallengeCodeHash ?? undefined,
      twoFactorChallengeExpiresAt: identity.twoFactorChallengeExpiresAt?.toISOString(),
      twoFactorChallengeRequestedAt: identity.twoFactorChallengeRequestedAt?.toISOString(),
      twoFactorChallengeFailedAttempts: identity.twoFactorChallengeFailedAttempts ?? 0,
      twoFactorChallengeDeviceIdHash: identity.twoFactorChallengeDeviceIdHash ?? undefined,
      twoFactorChallengeDeviceLabel: identity.twoFactorChallengeDeviceLabel ?? undefined,
      twoFactorChallengeDevicePlatform:
        identity.twoFactorChallengeDevicePlatform as AuthIdentityRecord["twoFactorChallengeDevicePlatform"],
      trustedDevices: identity.trustedDevices
        ? readJson<NonNullable<AuthIdentityRecord["trustedDevices"]>>(identity.trustedDevices)
        : undefined,
      securityEventHistory: identity.securityEventHistory
        ? readJson<NonNullable<AuthIdentityRecord["securityEventHistory"]>>(identity.securityEventHistory)
        : undefined
    };
  }

  private buildUserAccountUpdate(
    updates: Partial<CustomerProfile> | Partial<ProviderProfile> | Partial<CrewMemberProfile> | Partial<OpsProfile>
  ): any {
    return {
      email: updates.email?.toLowerCase(),
      fullName: updates.fullName,
      phone: updates.phone,
      internalScope: "internalScope" in updates ? updates.internalScope ?? null : undefined,
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
      minimumBookingLeadHours: number;
      staffingMode?: string;
      crewReviewLeadHours: number;
      departureReminderLeadMinutes: number;
      routeLeaderMode: string;
      weeklyPayoutDay: string;
      instantPayoutsEnabled: boolean;
      verificationStatus?: string;
      verificationSubmittedAt?: Date | null;
      verificationReviewedAt?: Date | null;
      verificationNotes?: string | null;
      servicePrices?: unknown;
      sponsoredListingEnabled: boolean;
      categories: string[];
      rating: number;
      timelinessRating: number;
      attentionToDetailRating: number;
      reviewCount: number;
      calendarConnection: unknown;
      credentials?: Array<Record<string, unknown>>;
      connectAccount?: Record<string, unknown> | null;
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
      minimumBookingLeadHours: profile.minimumBookingLeadHours ?? 0,
      staffingMode: (profile.staffingMode as ProviderProfile["staffingMode"] | undefined) ?? "review-first",
      crewReviewLeadHours: profile.crewReviewLeadHours,
      departureReminderLeadMinutes: profile.departureReminderLeadMinutes,
      routeLeaderMode:
        (profile.routeLeaderMode as ProviderProfile["routeLeaderMode"] | undefined) ?? "provider-only",
      weeklyPayoutDay: (profile.weeklyPayoutDay as ProviderProfile["weeklyPayoutDay"] | undefined) ?? "Thu",
      instantPayoutsEnabled: profile.instantPayoutsEnabled ?? false,
      verificationStatus:
        (profile.verificationStatus as ProviderProfile["verificationStatus"] | undefined) ??
        "verified",
      verificationSubmittedAt: profile.verificationSubmittedAt?.toISOString(),
      verificationReviewedAt: profile.verificationReviewedAt?.toISOString(),
      verificationNotes: profile.verificationNotes ?? undefined,
      servicePrices: (profile.servicePrices ?? []) as ProviderProfile["servicePrices"],
      sponsoredListingEnabled: profile.sponsoredListingEnabled,
      categories: profile.categories as ProviderProfile["categories"],
      rating: profile.rating,
      timelinessRating: profile.timelinessRating,
      attentionToDetailRating: profile.attentionToDetailRating,
      reviewCount: profile.reviewCount,
      calendarConnection: readJson<CalendarConnection>(profile.calendarConnection),
      credentials: (profile.credentials ?? []).map((credential) =>
        this.mapProviderCredential(credential as any)
      ),
      connectAccount: profile.connectAccount
        ? this.mapProviderConnectAccount(profile.connectAccount as any)
        : undefined
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
      cancellationCount: number;
      lastCancellationAt: Date | null;
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
      cancellationCount: profile.cancellationCount,
      lastCancellationAt: profile.lastCancellationAt?.toISOString(),
      status: profile.status as CrewMemberProfile["status"],
      assignedProviderId: profile.assignedProviderId ?? undefined
    };
  }

  private mapOpsProfile(user: {
    id: string;
    fullName: string;
    email: string;
    phone: string;
    role: string;
    internalScope: string | null;
    address: unknown;
    createdAt: Date;
  }): OpsProfile {
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      role: "ops",
      address: readJson<Address>(user.address),
      createdAt: user.createdAt.toISOString(),
      internalScope: user.internalScope === "admin" ? "admin" : "operations"
    };
  }

  private mapBooking(record: {
    id: string;
    customerId: string;
    providerId: string;
    launchLeadId: string | null;
    recurringPlanId: string | null;
    recurringOccurrenceIndex: number | null;
    serviceAddress: unknown;
    servicePropertyId: string | null;
    category: string;
    services: unknown;
    requestedAt: Date;
    scheduledStartIso: Date;
    scheduledEndIso: Date;
    status: string;
    assignedRouteLeaderCrewMemberId: string | null;
    onRouteConfirmedAt: Date | null;
    onRouteConfirmedByCrewMemberId: string | null;
    lateNoticeSentAt: Date | null;
    lateEtaIso: Date | null;
    lateReason: string | null;
    scheduleUpdates: unknown;
    scheduleVersion: number;
    activeExceptionType: string | null;
    activeExceptionReportedAt: Date | null;
    activeExceptionNotes: string | null;
    routeActiveStop: unknown | null;
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
    serviceEvidence: unknown;
    interventions: unknown;
    addressChangeHistory: unknown;
  }): Booking {
    return {
      id: record.id,
      customerId: record.customerId,
      providerId: record.providerId,
      launchLeadId: record.launchLeadId ?? undefined,
      recurringPlanId: record.recurringPlanId ?? undefined,
      recurringOccurrenceIndex: record.recurringOccurrenceIndex ?? undefined,
      serviceAddress: readJson<Address>(record.serviceAddress),
      servicePropertyId: record.servicePropertyId ?? undefined,
      category: record.category as Booking["category"],
      services: readJson<Booking["services"]>(record.services),
      requestedAt: record.requestedAt.toISOString(),
      scheduledStartIso: record.scheduledStartIso.toISOString(),
      scheduledEndIso: record.scheduledEndIso.toISOString(),
      status: record.status as Booking["status"],
      assignedRouteLeaderCrewMemberId: record.assignedRouteLeaderCrewMemberId ?? undefined,
      onRouteConfirmedAt: record.onRouteConfirmedAt?.toISOString(),
      onRouteConfirmedByCrewMemberId: record.onRouteConfirmedByCrewMemberId ?? undefined,
      lateNoticeSentAt: record.lateNoticeSentAt?.toISOString(),
      lateEtaIso: record.lateEtaIso?.toISOString(),
      lateReason: record.lateReason ?? undefined,
      scheduleUpdates: readJson<Booking["scheduleUpdates"]>(record.scheduleUpdates),
      scheduleVersion: record.scheduleVersion,
      activeExceptionType: record.activeExceptionType as Booking["activeExceptionType"],
      activeExceptionReportedAt: record.activeExceptionReportedAt?.toISOString(),
      activeExceptionNotes: record.activeExceptionNotes ?? undefined,
      routeActiveStop: record.routeActiveStop ? readJson<Booking["routeActiveStop"]>(record.routeActiveStop) : undefined,
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
      serviceEvidence: readJson<Booking["serviceEvidence"]>(record.serviceEvidence),
      interventions: readJson<Booking["interventions"]>(record.interventions),
      addressChangeHistory: readJson<BookingAddressChangeRequest[]>(record.addressChangeHistory)
    };
  }

  private mapRecurringServicePlan(record: {
    id: string;
    customerId: string;
    providerId: string;
    launchLeadId: string | null;
    serviceAddress: unknown;
    servicePropertyId: string | null;
    category: string;
    frequency: string;
    requestedAt: Date;
    notes: string;
    totalCents: number;
    status: string;
    anchorScheduledStartIso: Date;
    anchorScheduledEndIso: Date;
    lastGeneratedBookingId: string | null;
    lastGeneratedAt: Date | null;
    lastSchedulingAttemptAt: Date | null;
    lastSchedulingError: string | null;
    cancelledAt: Date | null;
    cancellationReason: string | null;
  }): RecurringServicePlan {
    return {
      id: record.id,
      customerId: record.customerId,
      providerId: record.providerId,
      launchLeadId: record.launchLeadId ?? undefined,
      serviceAddress: readJson<Address>(record.serviceAddress),
      servicePropertyId: record.servicePropertyId ?? undefined,
      category: record.category as RecurringServicePlan["category"],
      frequency: record.frequency as RecurringServicePlan["frequency"],
      requestedAt: record.requestedAt.toISOString(),
      notes: record.notes,
      totalCents: record.totalCents,
      status: record.status as RecurringServicePlan["status"],
      anchorScheduledStartIso: record.anchorScheduledStartIso.toISOString(),
      anchorScheduledEndIso: record.anchorScheduledEndIso.toISOString(),
      lastGeneratedBookingId: record.lastGeneratedBookingId ?? undefined,
      lastGeneratedAt: record.lastGeneratedAt?.toISOString(),
      lastSchedulingAttemptAt: record.lastSchedulingAttemptAt?.toISOString(),
      lastSchedulingError: record.lastSchedulingError ?? undefined,
      cancelledAt: record.cancelledAt?.toISOString(),
      cancellationReason: record.cancellationReason ?? undefined
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
    complaint?: unknown;
    id: string;
    bookingId: string | null;
    launchLeadId: string | null;
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
      complaint: (record.complaint ?? undefined) as SupportTicket["complaint"],
      id: record.id,
      bookingId: record.bookingId ?? undefined,
      launchLeadId: record.launchLeadId ?? undefined,
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

  private mapLaunchLead(record: {
    id: string;
    sourceChannel: string;
    requestSource: string | null;
    sourceReferenceId: string | null;
    channelMetadata: unknown | null;
    attribution: unknown | null;
    contactName: string;
    email: string | null;
    phone: string | null;
    preferredContactMethod: string;
    areaLabel: string;
    serviceCategory: string | null;
    message: string;
    status: string;
    assignedOwner: string | null;
    firstResponseDueAt: Date;
    firstRespondedAt: Date | null;
    lastContactedAt: Date | null;
    nextFollowUpDueAt: Date | null;
    closedAt: Date | null;
    lossReason: string | null;
    outcomeSummary: string | null;
    convertedBookingIds: string[];
    reviewIds: string[];
    firstConvertedBookingAt: Date | null;
    lastConvertedBookingAt: Date | null;
    lastReviewSubmittedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): LaunchLead {
    return {
      id: record.id,
      sourceChannel: record.sourceChannel as LaunchLead["sourceChannel"],
      requestSource: record.requestSource ?? undefined,
      sourceReferenceId: record.sourceReferenceId ?? undefined,
      channelMetadata: record.channelMetadata
        ? readJson<LaunchLead["channelMetadata"]>(record.channelMetadata)
        : undefined,
      attribution: record.attribution ? readJson<LaunchLead["attribution"]>(record.attribution) : undefined,
      contactName: record.contactName,
      email: record.email ?? undefined,
      phone: record.phone ?? undefined,
      preferredContactMethod:
        record.preferredContactMethod as LaunchLead["preferredContactMethod"],
      areaLabel: record.areaLabel,
      serviceCategory: record.serviceCategory as LaunchLead["serviceCategory"],
      message: record.message,
      status: record.status as LaunchLead["status"],
      assignedOwner: record.assignedOwner ?? undefined,
      firstResponseDueAt: record.firstResponseDueAt.toISOString(),
      firstRespondedAt: record.firstRespondedAt?.toISOString(),
      lastContactedAt: record.lastContactedAt?.toISOString(),
      nextFollowUpDueAt: record.nextFollowUpDueAt?.toISOString(),
      closedAt: record.closedAt?.toISOString(),
      lossReason: record.lossReason as LaunchLead["lossReason"],
      outcomeSummary: record.outcomeSummary ?? undefined,
      convertedBookingIds: record.convertedBookingIds,
      reviewIds: record.reviewIds,
      firstConvertedBookingAt: record.firstConvertedBookingAt?.toISOString(),
      lastConvertedBookingAt: record.lastConvertedBookingAt?.toISOString(),
      lastReviewSubmittedAt: record.lastReviewSubmittedAt?.toISOString(),
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString()
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
    responseStatus: string;
    responseHandledAt: Date | null;
    responseHandledBy: string | null;
    responseNotes: string | null;
    publicReplyBody: string | null;
    responseChannel: string | null;
    responseChannelMetadata: unknown;
    externalResponseId: string | null;
    publicResponseUrl: string | null;
    supportTicketId: string | null;
    escalatedAt: Date | null;
    escalatedBy: string | null;
    escalationNotes: string | null;
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
      responseStatus: record.responseStatus as ProviderReview["responseStatus"],
      responseHandledAt: record.responseHandledAt?.toISOString(),
      responseHandledBy: record.responseHandledBy ?? undefined,
      responseNotes: record.responseNotes ?? undefined,
      publicReplyBody: record.publicReplyBody ?? undefined,
      responseChannel: record.responseChannel as ProviderReview["responseChannel"],
      responseChannelMetadata: (record.responseChannelMetadata as ProviderReview["responseChannelMetadata"]) ?? undefined,
      externalResponseId: record.externalResponseId ?? undefined,
      publicResponseUrl: record.publicResponseUrl ?? undefined,
      supportTicketId: record.supportTicketId ?? undefined,
      escalatedAt: record.escalatedAt?.toISOString(),
      escalatedBy: record.escalatedBy ?? undefined,
      escalationNotes: record.escalationNotes ?? undefined,
      createdAt: record.createdAt.toISOString()
    };
  }

  private mapProviderCredential(record: {
    id: string;
    providerId: string;
    type: string;
    status: string;
    jurisdiction: string;
    referenceNumber: string | null;
    documentUrl: string | null;
    issuedAt: Date | null;
    expiresAt: Date | null;
    submittedAt: Date;
    reviewedAt: Date | null;
    reviewedByOpsUserId: string | null;
    reviewNotes: string | null;
  }): ProviderCredential {
    return {
      id: record.id,
      providerId: record.providerId,
      type: record.type as ProviderCredential["type"],
      status: record.status as ProviderCredential["status"],
      jurisdiction: record.jurisdiction,
      referenceNumber: record.referenceNumber ?? undefined,
      documentUrl: record.documentUrl ?? undefined,
      issuedAt: record.issuedAt?.toISOString(),
      expiresAt: record.expiresAt?.toISOString(),
      submittedAt: record.submittedAt.toISOString(),
      reviewedAt: record.reviewedAt?.toISOString(),
      reviewedByOpsUserId: record.reviewedByOpsUserId ?? undefined,
      reviewNotes: record.reviewNotes ?? undefined
    };
  }

  private buildProviderCredentialPersistence(credential: ProviderCredential) {
    return {
      id: credential.id,
      providerId: credential.providerId,
      type: credential.type,
      status: credential.status,
      jurisdiction: credential.jurisdiction,
      referenceNumber: credential.referenceNumber,
      documentUrl: credential.documentUrl,
      issuedAt: credential.issuedAt ? new Date(credential.issuedAt) : null,
      expiresAt: credential.expiresAt ? new Date(credential.expiresAt) : null,
      submittedAt: new Date(credential.submittedAt),
      reviewedAt: credential.reviewedAt ? new Date(credential.reviewedAt) : null,
      reviewedByOpsUserId: credential.reviewedByOpsUserId,
      reviewNotes: credential.reviewNotes
    };
  }

  private mapProviderConnectAccount(record: {
    providerId: string;
    stripeAccountId: string;
    dashboard: string;
    feesCollector: string;
    lossesCollector: string;
    chargePattern: string;
    onboardingStatus: string;
    transfersStatus: string;
    payoutsStatus: string;
    createdAt: Date;
    updatedAt: Date;
    lastSyncedAt: Date | null;
  }): ProviderConnectAccount {
    return {
      providerId: record.providerId,
      stripeAccountId: record.stripeAccountId,
      dashboard: record.dashboard as ProviderConnectAccount["dashboard"],
      feesCollector: record.feesCollector as ProviderConnectAccount["feesCollector"],
      lossesCollector: record.lossesCollector as ProviderConnectAccount["lossesCollector"],
      chargePattern: record.chargePattern as ProviderConnectAccount["chargePattern"],
      onboardingStatus: record.onboardingStatus as ProviderConnectAccount["onboardingStatus"],
      transfersStatus: record.transfersStatus as ProviderConnectAccount["transfersStatus"],
      payoutsStatus: record.payoutsStatus as ProviderConnectAccount["payoutsStatus"],
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      lastSyncedAt: record.lastSyncedAt?.toISOString()
    };
  }

  private mapBookingFinancialSettlement(record: any): BookingFinancialSettlement {
    return {
      id: record.id,
      bookingId: record.bookingId,
      paymentId: record.paymentId,
      customerId: record.customerId,
      providerId: record.providerId,
      policyVersion: record.policyVersion,
      currency: record.currency,
      customerChargeCents: record.customerChargeCents,
      providerServiceGrossCents: record.providerServiceGrossCents,
      finderFeeCents: record.finderFeeCents,
      completedJobFeeCents: record.completedJobFeeCents,
      platformGrossRevenueCents: record.platformGrossRevenueCents,
      actualProcessorFeeCents: record.actualProcessorFeeCents,
      platformNetRevenueCents: record.platformNetRevenueCents,
      providerNetCents: record.providerNetCents,
      crewPayoutByYardMatchCents: 0,
      isFirstCompletedCustomerProviderJob: record.isFirstCompletedCustomerProviderJob,
      status: record.status as BookingFinancialSettlement["status"],
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString()
    };
  }

  private mapFinancialLedgerEntry(record: any): FinancialLedgerEntry {
    return {
      id: record.id,
      settlementId: record.settlementId,
      bookingId: record.bookingId,
      paymentId: record.paymentId,
      account: record.account as FinancialLedgerEntry["account"],
      direction: record.direction as FinancialLedgerEntry["direction"],
      amountCents: record.amountCents,
      currency: record.currency,
      idempotencyKey: record.idempotencyKey,
      source: record.source as FinancialLedgerEntry["source"],
      reversalOfEntryId: record.reversalOfEntryId ?? undefined,
      createdAt: record.createdAt.toISOString()
    };
  }

  private mapPaymentRecord(record: {
    fullRefundAttempt?: unknown;
    partialRefunds?: unknown;
    refundedAmountCents?: number;
    checkoutSessionExpiredAt: Date | null;
    checkoutSuccessPath: string | null;
    checkoutCancelPath: string | null;
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
    processorChargeId: string | null;
    actualProcessorFeeCents: number | null;
    processorFeeStatus: string | null;
    processorFeeUpdatedAt: Date | null;
    processorFeeFailureReason: string | null;
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
      fullRefundAttempt: (record.fullRefundAttempt ?? undefined) as PaymentRecord["fullRefundAttempt"],
      partialRefunds: (record.partialRefunds ?? []) as PaymentRecord["partialRefunds"],
      refundedAmountCents: record.refundedAmountCents ?? 0,
      checkoutSessionExpiredAt: record.checkoutSessionExpiredAt?.toISOString(),
      checkoutSuccessPath: record.checkoutSuccessPath ?? undefined,
      checkoutCancelPath: record.checkoutCancelPath ?? undefined,
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
      processorChargeId: record.processorChargeId ?? undefined,
      actualProcessorFeeCents: record.actualProcessorFeeCents ?? undefined,
      processorFeeStatus:
        (record.processorFeeStatus as PaymentRecord["processorFeeStatus"]) ?? undefined,
      processorFeeUpdatedAt: record.processorFeeUpdatedAt?.toISOString(),
      processorFeeFailureReason: record.processorFeeFailureReason ?? undefined,
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

  private buildProviderTransferPersistence(record: ProviderTransferRecord) {
    return {
      id: record.id,
      settlementId: record.settlementId,
      bookingId: record.bookingId,
      paymentId: record.paymentId,
      providerId: record.providerId,
      stripeAccountId: record.stripeAccountId,
      stripeTransferId: record.stripeTransferId,
      stripeTransferReversalId: record.stripeTransferReversalId,
      amountCents: record.amountCents,
      currency: record.currency,
      status: record.status,
      idempotencyKey: record.idempotencyKey,
      failureReason: record.failureReason,
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt),
      transferredAt: record.transferredAt ? new Date(record.transferredAt) : undefined,
      reversedAt: record.reversedAt ? new Date(record.reversedAt) : undefined
    };
  }

  private mapProviderTransferRecord(record: {
    id: string;
    settlementId: string;
    bookingId: string;
    paymentId: string;
    providerId: string;
    stripeAccountId: string;
    stripeTransferId: string | null;
    stripeTransferReversalId: string | null;
    amountCents: number;
    currency: string;
    status: string;
    idempotencyKey: string;
    failureReason: string | null;
    createdAt: Date;
    updatedAt: Date;
    transferredAt: Date | null;
    reversedAt: Date | null;
  }): ProviderTransferRecord {
    return {
      id: record.id,
      settlementId: record.settlementId,
      bookingId: record.bookingId,
      paymentId: record.paymentId,
      providerId: record.providerId,
      stripeAccountId: record.stripeAccountId,
      stripeTransferId: record.stripeTransferId ?? undefined,
      stripeTransferReversalId: record.stripeTransferReversalId ?? undefined,
      amountCents: record.amountCents,
      currency: record.currency,
      status: record.status as ProviderTransferRecord["status"],
      idempotencyKey: record.idempotencyKey,
      failureReason: record.failureReason ?? undefined,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      transferredAt: record.transferredAt?.toISOString(),
      reversedAt: record.reversedAt?.toISOString()
    };
  }

  private mapPayoutDisbursementRun(record: {
    id: string;
    previewBatchId: string;
    entryFingerprint: string;
    runDateIso: Date;
    recipientRole: string;
    railMode: string;
    actionStatus: string;
    status: string;
    totalCents: number;
    recipientCount: number;
    bookingCount: number;
    entryCount: number;
    recipientIds: string[];
    entryIds: string[];
    entries: unknown;
    blockerReasons: string[];
    manualActionLabel: string;
    auditInstructions: string[];
    createdAt: Date;
    updatedAt: Date;
    createdByOpsUserId: string;
    createdByOpsEmail: string;
    operatorNotes: string | null;
    reconciliationReference: string | null;
    reconciliationNotes: string | null;
    reconciledAt: Date | null;
    reconciledByOpsUserId: string | null;
  }): OpsPayoutDisbursementRun {
    return {
      id: record.id,
      previewBatchId: record.previewBatchId,
      entryFingerprint: record.entryFingerprint,
      runDateIso: record.runDateIso.toISOString(),
      recipientRole: record.recipientRole as OpsPayoutDisbursementRun["recipientRole"],
      railMode: record.railMode as OpsPayoutDisbursementRun["railMode"],
      actionStatus: record.actionStatus as OpsPayoutDisbursementRun["actionStatus"],
      status: record.status as OpsPayoutDisbursementRun["status"],
      totalCents: record.totalCents,
      recipientCount: record.recipientCount,
      bookingCount: record.bookingCount,
      entryCount: record.entryCount,
      recipientIds: record.recipientIds,
      entryIds: record.entryIds,
      entries: readJson<OpsPayoutDisbursementEntryRef[]>(record.entries),
      blockerReasons: record.blockerReasons,
      manualActionLabel: record.manualActionLabel,
      auditInstructions: record.auditInstructions,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      createdByOpsUserId: record.createdByOpsUserId,
      createdByOpsEmail: record.createdByOpsEmail,
      operatorNotes: record.operatorNotes ?? undefined,
      reconciliationReference: record.reconciliationReference ?? undefined,
      reconciliationNotes: record.reconciliationNotes ?? undefined,
      reconciledAt: record.reconciledAt?.toISOString(),
      reconciledByOpsUserId: record.reconciledByOpsUserId ?? undefined
    };
  }

  private mapLaunchOperationsTask(record: {
    id: string;
    recommendationFingerprint: string;
    recommendationKey: string;
    pocketKey: string;
    city: string;
    state: string;
    postalCode: string;
    priority: string;
    owner: string;
    status: string;
    title: string;
    detail: string;
    recommendedAction: string;
    dueAtIso: Date;
    relatedScenarioKeys: string[];
    createdAt: Date;
    updatedAt: Date;
    createdByOpsUserId: string;
    createdByOpsEmail: string;
    assignedToOpsUserId: string | null;
    assignedToOpsEmail: string | null;
    operatorNotes: string | null;
    completionNotes: string | null;
    completedAt: Date | null;
    completedByOpsUserId: string | null;
  }): LaunchOperationsTask {
    return {
      id: record.id,
      recommendationFingerprint: record.recommendationFingerprint,
      recommendationKey: record.recommendationKey as LaunchOperationsTask["recommendationKey"],
      pocketKey: record.pocketKey,
      city: record.city,
      state: record.state,
      postalCode: record.postalCode,
      priority: record.priority as LaunchOperationsTask["priority"],
      owner: record.owner as LaunchOperationsTask["owner"],
      status: record.status as LaunchOperationsTask["status"],
      title: record.title,
      detail: record.detail,
      recommendedAction: record.recommendedAction,
      dueAtIso: record.dueAtIso.toISOString(),
      relatedScenarioKeys: record.relatedScenarioKeys as LaunchOperationsTask["relatedScenarioKeys"],
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      createdByOpsUserId: record.createdByOpsUserId,
      createdByOpsEmail: record.createdByOpsEmail,
      assignedToOpsUserId: record.assignedToOpsUserId ?? undefined,
      assignedToOpsEmail: record.assignedToOpsEmail ?? undefined,
      operatorNotes: record.operatorNotes ?? undefined,
      completionNotes: record.completionNotes ?? undefined,
      completedAt: record.completedAt?.toISOString(),
      completedByOpsUserId: record.completedByOpsUserId ?? undefined
    };
  }

  private mapOpsAutomationRun(record: {
    id: string;
    runId: string;
    generatedAt: Date;
    asOfIso: Date;
    dryRun: boolean;
    requestedSweepKeys: string[];
    requestedSweepCount: number;
    completedSweepCount: number;
    failedSweepCount: number;
    sentNotificationCount: number;
    alreadySentCount: number;
    skippedCount: number;
    items: unknown;
    createdAt: Date;
    createdByOpsUserId: string;
    createdByOpsEmail: string;
  }): OpsAutomationRunRecord {
    return {
      id: record.id,
      runId: record.runId,
      generatedAt: record.generatedAt.toISOString(),
      asOfIso: record.asOfIso.toISOString(),
      dryRun: record.dryRun,
      requestedSweepKeys: record.requestedSweepKeys as OpsAutomationSweepKey[],
      requestedSweepCount: record.requestedSweepCount,
      completedSweepCount: record.completedSweepCount,
      failedSweepCount: record.failedSweepCount,
      sentNotificationCount: record.sentNotificationCount,
      alreadySentCount: record.alreadySentCount,
      skippedCount: record.skippedCount,
      items: readJson<OpsAutomationSweepRunItem[]>(record.items),
      createdAt: record.createdAt.toISOString(),
      createdByOpsUserId: record.createdByOpsUserId,
      createdByOpsEmail: record.createdByOpsEmail
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
    cancellationReason: string | null;
    cancelledAt: Date | null;
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
      cancellationReason: record.cancellationReason ?? undefined,
      cancelledAt: record.cancelledAt?.toISOString(),
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
