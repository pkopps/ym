import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import type {
  Booking,
  CustomerProfile,
  FinancialLedgerEntry,
  PaymentRecord,
  ProviderProfile,
  ProviderTransferRecord
} from "@yardmatch/contracts";
import { PrismaMarketplaceRepository } from "../src/repositories/PrismaMarketplaceRepository";

const databaseUrl = process.env.TEST_DATABASE_URL?.trim();

test(
  "Postgres atomically claims first-match economics and persists a balanced idempotent ledger",
  { skip: databaseUrl ? false : "TEST_DATABASE_URL is not configured" },
  async () => {
    const prisma = new PrismaClient({ datasourceUrl: databaseUrl! });
    const repository = new PrismaMarketplaceRepository(prisma);
    const suffix = randomUUID();
    const customerId = `pg-it-customer-${suffix}`;
    const providerId = `pg-it-provider-${suffix}`;
    const bookingId = `pg-it-booking-${suffix}`;
    const paymentId = `pg-it-payment-${suffix}`;
    const now = new Date().toISOString();
    const address = {
      line1: "1 Integration Way",
      city: "Barnegat",
      state: "NJ",
      postalCode: "08005",
      country: "US",
      point: { latitude: 39.7532, longitude: -74.2229 }
    };

    const cleanup = async () => {
      await (prisma as any).providerTransferRecord.deleteMany({ where: { bookingId } });
      await (prisma as any).financialLedgerEntry.deleteMany({ where: { bookingId } });
      await (prisma as any).bookingFinancialSettlement.deleteMany({ where: { bookingId } });
      await (prisma as any).customerProviderRelationship.deleteMany({
        where: { customerId, providerId }
      });
      await prisma.paymentRecord.deleteMany({ where: { id: paymentId } });
      await prisma.booking.deleteMany({ where: { id: bookingId } });
      await (prisma as any).providerCredential.deleteMany({ where: { providerId } });
      await (prisma as any).providerConnectAccount.deleteMany({ where: { providerId } });
      await prisma.customerProperty.deleteMany({ where: { customerId } });
      await prisma.customerProfile.deleteMany({ where: { userId: customerId } });
      await prisma.providerBusinessProfile.deleteMany({ where: { userId: providerId } });
      await prisma.userAccount.deleteMany({ where: { id: { in: [customerId, providerId] } } });
    };

    try {
      await cleanup();
      const customer: CustomerProfile = {
        id: customerId,
        fullName: "Postgres Test Customer",
        email: `${customerId}@example.com`,
        phone: "555-0100",
        role: "customer",
        address,
        createdAt: now,
        propertyNotes: "",
        lawnSizeSqFt: 1000,
        properties: [],
        defaultPropertyId: ""
      };
      const provider: ProviderProfile = {
        id: providerId,
        fullName: "Postgres Test Provider",
        email: `${providerId}@example.com`,
        phone: "555-0200",
        role: "provider",
        address,
        createdAt: now,
        companyName: "Postgres Test Lawns",
        bio: "A test provider used only by the isolated Postgres repository integration suite.",
        yearsExperience: 5,
        serviceRadiusMiles: 10,
        minimumBookingLeadHours: 0,
        staffingMode: "review-first",
        crewReviewLeadHours: 24,
        departureReminderLeadMinutes: 60,
        routeLeaderMode: "provider-only",
        weeklyPayoutDay: "Thu",
        instantPayoutsEnabled: false,
        verificationStatus: "verified",
        sponsoredListingEnabled: false,
        categories: ["lawn-mowing"],
        rating: 5,
        timelinessRating: 5,
        attentionToDetailRating: 5,
        reviewCount: 0,
        calendarConnection: { provider: "google", connected: false }
      };
      await repository.createCustomer(customer);
      await repository.createProvider(provider);

      const booking: Booking = {
        id: bookingId,
        customerId,
        providerId,
        serviceAddress: address,
        category: "lawn-mowing",
        requestedAt: now,
        scheduledStartIso: now,
        scheduledEndIso: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        status: "completed",
        completedAt: now,
        notes: "Postgres finance integration test",
        totalCents: 7_500,
        serviceEvidence: [],
        interventions: [],
        addressChangeHistory: []
      };
      const payment: PaymentRecord = {
        id: paymentId,
        bookingId,
        amountCents: 7_500,
        currency: "usd",
        status: "captured",
        processor: "stripe",
        refundable: true,
        checkoutSessionId: `cs_${suffix}`,
        processorPaymentIntentId: `pi_${suffix}`,
        processorChargeId: `ch_${suffix}`,
        actualProcessorFeeCents: 248,
        processorFeeStatus: "reconciled",
        processorFeeUpdatedAt: now,
        paidAt: now,
        createdAt: now,
        updatedAt: now
      };
      await repository.createBooking(booking);
      await repository.createPayment(payment);

      const first = await repository.settleBookingFinancials({
        bookingId,
        paymentId,
        customerId,
        providerId,
        customerChargeCents: 7_500,
        currency: "usd",
        actualProcessorFeeCents: 248
      });
      const repeated = await repository.settleBookingFinancials({
        bookingId,
        paymentId,
        customerId,
        providerId,
        customerChargeCents: 7_500,
        currency: "usd",
        actualProcessorFeeCents: 248
      });
      assert.equal(repeated.id, first.id);
      assert.equal(first.finderFeeCents, 3_000);
      assert.equal(first.providerNetCents, 3_801);

      const ledger = await repository.listFinancialLedgerEntries(bookingId);
      const debits = ledger
        .filter((entry) => entry.direction === "debit")
        .reduce((sum, entry) => sum + entry.amountCents, 0);
      const credits = ledger
        .filter((entry) => entry.direction === "credit")
        .reduce((sum, entry) => sum + entry.amountCents, 0);
      assert.equal(debits, credits);
      assert.equal(new Set(ledger.map((entry) => entry.idempotencyKey)).size, ledger.length);

      const providerTransfer: ProviderTransferRecord = {
        id: `pg-it-transfer-${suffix}`,
        settlementId: first.id,
        bookingId,
        paymentId,
        providerId,
        stripeAccountId: `acct_${suffix}`,
        amountCents: first.providerNetCents,
        currency: first.currency,
        status: "pending",
        idempotencyKey: `provider-transfer:${first.id}:v1`,
        createdAt: now,
        updatedAt: now
      };
      await repository.createProviderTransferRecord(providerTransfer);
      const transferEntries: FinancialLedgerEntry[] = [
        {
          id: `pg-it-transfer-debit-${suffix}`,
          settlementId: first.id,
          bookingId,
          paymentId,
          account: "provider-payable",
          direction: "debit",
          amountCents: first.providerNetCents,
          currency: first.currency,
          idempotencyKey: `provider-transfer:${first.id}:provider-payable:debit`,
          source: "provider-transfer",
          createdAt: now
        },
        {
          id: `pg-it-transfer-credit-${suffix}`,
          settlementId: first.id,
          bookingId,
          paymentId,
          account: "stripe-clearing",
          direction: "credit",
          amountCents: first.providerNetCents,
          currency: first.currency,
          idempotencyKey: `provider-transfer:${first.id}:stripe-clearing:credit`,
          source: "provider-transfer",
          createdAt: now
        }
      ];
      const transferred = await repository.completeProviderTransfer({
        transferRecordId: providerTransfer.id,
        stripeTransferId: `tr_${suffix}`,
        transferredAt: now,
        ledgerEntries: transferEntries
      });
      const repeatedTransfer = await repository.completeProviderTransfer({
        transferRecordId: providerTransfer.id,
        stripeTransferId: `tr_${suffix}`,
        transferredAt: now,
        ledgerEntries: transferEntries
      });
      assert.equal(transferred.status, "transferred");
      assert.equal(repeatedTransfer.status, "transferred");
      assert.equal(
        (await repository.listFinancialLedgerEntries(bookingId)).filter(
          (entry) => entry.source === "provider-transfer"
        ).length,
        2
      );

      const reversalEntries: FinancialLedgerEntry[] = [
        {
          id: `pg-it-reversal-debit-${suffix}`,
          settlementId: first.id,
          bookingId,
          paymentId,
          account: "stripe-clearing",
          direction: "debit",
          amountCents: first.providerNetCents,
          currency: first.currency,
          idempotencyKey: `provider-transfer-reversal:${first.id}:stripe-clearing:debit`,
          source: "reversal",
          createdAt: now
        },
        {
          id: `pg-it-reversal-credit-${suffix}`,
          settlementId: first.id,
          bookingId,
          paymentId,
          account: "provider-payable",
          direction: "credit",
          amountCents: first.providerNetCents,
          currency: first.currency,
          idempotencyKey: `provider-transfer-reversal:${first.id}:provider-payable:credit`,
          source: "reversal",
          createdAt: now
        }
      ];
      const reversed = await repository.completeProviderTransferReversal({
        transferRecordId: providerTransfer.id,
        stripeTransferReversalId: `trr_${suffix}`,
        reversedAt: now,
        ledgerEntries: reversalEntries
      });
      const repeatedReversal = await repository.completeProviderTransferReversal({
        transferRecordId: providerTransfer.id,
        stripeTransferReversalId: `trr_${suffix}`,
        reversedAt: now,
        ledgerEntries: reversalEntries
      });
      assert.equal(reversed.status, "reversed");
      assert.equal(repeatedReversal.status, "reversed");
      assert.equal(
        (await repository.findBookingFinancialSettlement(bookingId))?.status,
        "reversed"
      );
      const finalLedger = await repository.listFinancialLedgerEntries(bookingId);
      assert.equal(
        finalLedger
          .filter((entry) => entry.direction === "debit")
          .reduce((sum, entry) => sum + entry.amountCents, 0),
        finalLedger
          .filter((entry) => entry.direction === "credit")
          .reduce((sum, entry) => sum + entry.amountCents, 0)
      );

      await assert.rejects(
        () =>
          prisma.paymentRecord.create({
            data: {
              ...payment,
              id: `${paymentId}-duplicate`,
              checkoutSessionId: payment.checkoutSessionId,
              processorPaymentIntentId: `pi_duplicate_${suffix}`,
              processorChargeId: `ch_duplicate_${suffix}`,
              processorFeeUpdatedAt: new Date(payment.processorFeeUpdatedAt!),
              paidAt: new Date(payment.paidAt!),
              createdAt: new Date(payment.createdAt),
              updatedAt: new Date(payment.updatedAt)
            }
          }),
        (error: unknown) =>
          error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
      );
    } finally {
      await cleanup();
      await prisma.$disconnect();
    }
  }
);

test(
  "Postgres persists two-factor settings, remembered devices, and security activity",
  { skip: databaseUrl ? false : "TEST_DATABASE_URL is not configured" },
  async () => {
    const prisma = new PrismaClient({ datasourceUrl: databaseUrl! });
    const repository = new PrismaMarketplaceRepository(prisma);
    const suffix = randomUUID();
    const customerId = `pg-security-customer-${suffix}`;
    const now = new Date().toISOString();
    const expiresAtIso = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const customer: CustomerProfile = {
      id: customerId,
      fullName: "Postgres Security Customer",
      email: `${customerId}@example.com`,
      phone: "+15558675309",
      role: "customer",
      address: {
        line1: "1 Security Way",
        city: "Barnegat",
        state: "NJ",
        postalCode: "08005",
        country: "US",
        point: { latitude: 39.7532, longitude: -74.2229 }
      },
      createdAt: now,
      propertyNotes: "",
      lawnSizeSqFt: 1000,
      properties: [],
      defaultPropertyId: ""
    };

    try {
      await repository.createCustomer(customer, "test-password-hash");
      await repository.updateAuthIdentity(customerId, {
        twoFactorMethod: "sms",
        twoFactorEnabledAt: now,
        trustedDevices: [
          {
            id: `trusted-${suffix}`,
            deviceIdHash: `hash-${suffix}`,
            label: "Postgres test phone",
            platform: "android",
            firstSeenAt: now,
            lastSeenAt: now,
            expiresAtIso
          }
        ],
        securityEventHistory: [
          {
            id: `event-${suffix}`,
            kind: "two-factor-enabled",
            occurredAt: now,
            deviceLabel: "Postgres test phone",
            detail: "Two-factor authentication was enabled by text message."
          }
        ]
      });

      const persisted = await repository.findAuthIdentityByUserId(customerId);
      assert.equal(persisted?.twoFactorMethod, "sms");
      assert.equal(persisted?.twoFactorEnabledAt, now);
      assert.deepEqual(persisted?.trustedDevices, [
        {
          id: `trusted-${suffix}`,
          deviceIdHash: `hash-${suffix}`,
          label: "Postgres test phone",
          platform: "android",
          firstSeenAt: now,
          lastSeenAt: now,
          expiresAtIso
        }
      ]);
      assert.equal(persisted?.securityEventHistory?.[0]?.kind, "two-factor-enabled");
      assert.equal(
        persisted?.securityEventHistory?.[0]?.detail,
        "Two-factor authentication was enabled by text message."
      );
    } finally {
      await prisma.customerProperty.deleteMany({ where: { customerId } });
      await prisma.customerProfile.deleteMany({ where: { userId: customerId } });
      await prisma.userAccount.deleteMany({ where: { id: customerId } });
      await prisma.$disconnect();
    }
  }
);

test('Postgres serializes recovery and checkout across service instances and rolls back recurring creation',
  {skip: databaseUrl ? false : 'TEST_DATABASE_URL is not configured'}, async () => {
    const {DataEngineeringLogger} = await import('@yardmatch/analytics');
    const {InMemoryMarketplaceRepository} = await import('../src/repositories/InMemoryMarketplaceRepository');
    const {MarketplacePlatformService} = await import('../src/services/MarketplacePlatformService');
    const {hashPassword} = await import('../src/auth');
    const prisma = new PrismaClient({datasourceUrl:databaseUrl!});
    const secondClient = new PrismaClient({datasourceUrl:databaseUrl!});
    const repository = new PrismaMarketplaceRepository(prisma);
    const secondRepository = new PrismaMarketplaceRepository(secondClient);
    const suffix=randomUUID();
    const memory=new InMemoryMarketplaceRepository();
    const template=(await memory.listProviders())[0];
    const provider={...template,id:`audit-provider-${suffix}`,email:`audit-provider-${suffix}@example.com`};
    const keys = new Set<string>();
    const gateway = {
      isConfigured:()=>true,
      createCheckoutSession:async (input: {idempotencyKey?:string;paymentId?:string})=>{
        keys.add(input.idempotencyKey!);
        return {checkoutSessionId:`cs_${input.paymentId}`,checkoutUrl:`https://checkout.example/${input.paymentId}`,paymentIntentId:`pi_${input.paymentId}`};
      },
      verifyCheckoutSession:async (id:string)=>({checkoutSessionId:id,paid:true,paymentIntentId:id.replace('cs_','pi_')}),
      retrieveChargeFinancials:async (id:string)=>({chargeId:`ch_${id}`,actualProcessorFeeCents:50}),
      parseWebhookEvent:async (raw:string)=>JSON.parse(raw),
      createRefund:async()=>({refundId:'re_fixture',status:'succeeded'})
    };
    const first = new MarketplacePlatformService(repository,new DataEngineeringLogger(),gateway);
    const second = new MarketplacePlatformService(secondRepository,new DataEngineeringLogger(),gateway);
    let customerId='';
    try {
      await repository.createProvider(provider);
      for (const credential of template.credentials ?? []) await repository.upsertProviderCredential({...credential,id:randomUUID(),providerId:provider.id});
      const customer=await first.registerUser({fullName:'Audit Customer',email:`audit-customer-${suffix}@example.com`,phone:'555-0200',role:'customer',address:template.address},hashPassword('Password123!'));
      customerId=customer.id;
      const reset=await first.requestPasswordReset({email:customer.email});
      assert.ok(reset.resetCodePreview);
      const confirmations=await Promise.allSettled([first,second].map(service=>service.confirmPasswordReset({email:customer.email,resetCode:reset.resetCodePreview!,newPassword:'Changed123!'})));
      assert.equal(confirmations.filter(result=>result.status==='fulfilled').length,1);
      assert.equal((await repository.findAuthIdentityByUserId(customer.id))?.sessionVersion,2);
      const quota=await Promise.all(Array.from({length:12},(_,index)=>(index%2?first:second).consumeSecurityLimit(`pg-quota-${suffix}`,3,60)));
      assert.equal(quota.filter(Boolean).length,3);
      const quote=await first.createInstantQuote({customerId:customer.id,address:template.address,category:'lawn-mowing'});
      const payload={providerId:provider.id,serviceAddress:template.address,category:'lawn-mowing' as const,scheduledStartIso:new Date(Date.now()+72*3600000).toISOString(),scheduledEndIso:new Date(Date.now()+73*3600000).toISOString(),notes:'Database audit fixture',totalCents:quote.estimatedPriceCents,quoteToken:quote.quoteToken};
      const booking=await first.createBooking(customer.id,payload);
      const replies=await Promise.all([first,second,first,second].map(service=>service.createCheckoutSession(customer.id,{bookingId:booking.id})));
      assert.equal(keys.size,1);
      assert.equal(new Set(replies.map(reply=>reply.payment.id)).size,1);
      const payment=replies[0].payment;
      await first.processStripeWebhook(JSON.stringify({id:`evt_refund_${suffix}`,type:'charge.refunded',paymentIntentId:payment.processorPaymentIntentId}),'stub');
      await second.processStripeWebhook(JSON.stringify({id:`evt_completed_${suffix}`,type:'checkout.session.completed',checkoutSessionId:payment.checkoutSessionId,paid:true}),'stub');
      assert.equal((await repository.findPaymentById(payment.id))?.status,'refunded');
      // Even a writer that misses the service lock cannot overwrite a refunded payment.
      await repository.updatePayment(payment.id,{status:'captured',refundable:true});
      assert.equal((await repository.findPaymentById(payment.id))?.status,'refunded');
      const plans=await Promise.all([first,second].map(service=>service.createRecurringServicePlan(customer.id,{...payload,frequency:'weekly'})));
      assert.equal(plans[0].plan.plan.id,plans[1].plan.plan.id);
      const orphanId=`rollback-${suffix}`;
      await assert.rejects(repository.createRecurringPlanWithBooking({...plans[0].plan.plan,id:orphanId}, {...booking,recurringPlanId:orphanId})); // Duplicate booking ID forces a write failure.
      assert.equal(await repository.findRecurringServicePlanById(orphanId),undefined);
      const feed=(uid:string,day:number)=>`data:text/calendar,${encodeURIComponent(`BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nUID:${uid}\nDTSTART:${new Date(Date.now()+day*86400000).toISOString().replaceAll(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z')}\nDTEND:${new Date(Date.now()+day*86400000+3600000).toISOString().replaceAll(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z')}\nEND:VEVENT\nEND:VCALENDAR`)}`;
      await Promise.all([first,second].map((service,index)=>service.createProviderCalendarImport(provider.id,{title:`Feed ${index}`,provider:'google',feedUrl:feed(`pg-feed-${index}`,10+index)})));
      assert.equal((await repository.findProviderById(provider.id))?.calendarConnection.externalBlocks?.length,2);
    } finally {
      // Delete only rows owned by this test's random fixture IDs.
      const recipients=[customerId,provider.id].filter(Boolean);
      await prisma.notificationDelivery.deleteMany({where:{recipientId:{in:recipients}}});
      await prisma.appNotification.deleteMany({where:{recipientId:{in:recipients}}});
      await prisma.notificationPreference.deleteMany({where:{userId:{in:recipients}}});
      await prisma.paymentRecord.deleteMany({where:{bookingId:{in:(await prisma.booking.findMany({where:{customerId},select:{id:true}})).map(b=>b.id)}}});
      await prisma.booking.deleteMany({where:{customerId}});
      await prisma.recurringServicePlan.deleteMany({where:{customerId}});
      await prisma.providerCredential.deleteMany({where:{providerId:provider.id}});
      await prisma.customerProperty.deleteMany({where:{customerId}});
      await prisma.customerProfile.deleteMany({where:{userId:customerId}});
      await prisma.providerBusinessProfile.deleteMany({where:{userId:provider.id}});
      await prisma.userAccount.deleteMany({where:{id:{in:recipients}}});
      await prisma.$disconnect();
      await secondClient.$disconnect();
    }
});
