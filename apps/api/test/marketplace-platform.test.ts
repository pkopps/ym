import assert from "node:assert/strict";
import test from "node:test";
import { DataEngineeringLogger } from "@yardmatch/analytics";
import { getBookingServiceWindow } from "@yardmatch/contracts";
import { MarketplaceTelemetryEventCatalog } from "@yardmatch/observability";
import { HttpError } from "../src/http";
import { InMemoryMarketplaceRepository } from "../src/repositories/InMemoryMarketplaceRepository";
import { MarketplacePlatformService } from "../src/services/MarketplacePlatformService";
import { PhotoStorageService } from "../src/services/PhotoStorageService";
import { ValidatedEvidenceImage } from "../src/media/imageValidation";
import { PaymentCheckoutGateway } from "../src/services/StripeCheckoutService";
import { StripeConnectGateway } from "../src/services/StripeConnectService";

function createAddress(
  line1 = "112 Garden Row",
  latitude = 30.2435,
  longitude = -97.7638
) {
  return {
    line1,
    city: "Austin",
    state: "TX",
    postalCode: "78704",
    country: "US",
    point: {
      latitude,
      longitude
    }
  };
}

function futureIso(hoursFromNow: number) {
  return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000).toISOString();
}

async function createLaunchOperationsPressureFixture(
  platform: MarketplacePlatformService,
  repository: InMemoryMarketplaceRepository,
  emailSuffix: string
) {
  const customer = await platform.registerUser({
    fullName: `Jordan Launch Ops ${emailSuffix}`,
    email: `customer-launch-ops-${emailSuffix}@example.com`,
    password: "Password123!",
    phone: "555-1175",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress()
  });
  const provider = (await repository.listProviders())[0];
  assert.ok(provider);

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress(),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(8),
    scheduledEndIso: futureIso(10),
    notes: "Launch operations policy pressure coverage",
    totalCents: 6400
  });
  await platform.confirmBooking(provider.id, { bookingId: booking.id });
  await platform.markBookingException(provider.id, {
    bookingId: booking.id,
    exceptionType: "unable-to-access-property",
    notes: "The gate is locked and support needs to coordinate access."
  });

  const noSupplyAddress = {
    ...createAddress("900 Remote Ridge", 30.3095, -104.0206),
    city: "Marfa",
    postalCode: "79843"
  };
  await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: noSupplyAddress,
    category: "seasonal-cleanup",
    scheduledStartIso: futureIso(12),
    scheduledEndIso: futureIso(14),
    notes: "Launch operations no-supply pocket coverage",
    totalCents: 9800
  });

  return {
    customer,
    provider
  };
}

async function withMockedNow<T>(iso: string, callback: () => Promise<T> | T): Promise<T> {
  const originalNow = Date.now;
  Date.now = () => new Date(iso).getTime();
  try {
    return await callback();
  } finally {
    Date.now = originalNow;
  }
}

function availabilityDayForIso(iso: string) {
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(iso).getDay()] as
    | "Sun"
    | "Mon"
    | "Tue"
    | "Wed"
    | "Thu"
    | "Fri"
    | "Sat";
}

function createFakeStripeGateway(overrides?: {
  verifyCheckoutSession?: PaymentCheckoutGateway["verifyCheckoutSession"];
  retrieveChargeFinancials?: PaymentCheckoutGateway["retrieveChargeFinancials"];
  parseWebhookEvent?: PaymentCheckoutGateway["parseWebhookEvent"];
  createRefund?: PaymentCheckoutGateway["createRefund"];
}): PaymentCheckoutGateway {
  return {
    isConfigured() {
      return true;
    },
    async createCheckoutSession() {
      return {
        checkoutSessionId: "cs_test_123",
        checkoutUrl: "https://checkout.stripe.test/session/cs_test_123",
        paymentIntentId: "pi_test_123"
      };
    },
    verifyCheckoutSession:
      overrides?.verifyCheckoutSession ??
      (async () => ({
        checkoutSessionId: "cs_test_123",
        paymentIntentId: "pi_test_123",
        paid: true
      })),
    retrieveChargeFinancials:
      overrides?.retrieveChargeFinancials ??
      (async () => ({
        chargeId: "ch_test_123",
        actualProcessorFeeCents: 225
      })),
    parseWebhookEvent:
      overrides?.parseWebhookEvent ??
      (async () => ({
        type: "checkout.session.completed",
        checkoutSessionId: "cs_test_123",
        paymentIntentId: "pi_test_123",
        paid: true
      })),
    createRefund:
      overrides?.createRefund ??
      (async () => ({
        refundId: "re_test_123",
        status: "succeeded"
      }))
  };
}

function createFakeStripeConnectGateway(options?: {
  transferIds?: string[];
  reversalIds?: string[];
  readiness?: {
    transfersStatus: "not-requested" | "pending" | "restricted" | "active";
    payoutsStatus: "not-requested" | "pending" | "restricted" | "active";
    onboardingStatus: "not-started" | "requirements-due" | "in-review" | "restricted" | "ready";
  };
  onCreateAccount?: (providerId: string) => void;
  onTransfer?: (input: Parameters<StripeConnectGateway["createProviderTransfer"]>[0]) => void;
  onReversal?: (input: Parameters<StripeConnectGateway["reverseProviderTransfer"]>[0]) => void;
  transferErrors?: Error[];
}): StripeConnectGateway {
  return {
    isConfigured: () => true,
    async createRecipientAccount(provider) {
      options?.onCreateAccount?.(provider.id);
      return {
        stripeAccountId: `acct_${provider.id}`,
        transfersStatus: options?.readiness?.transfersStatus ?? "active",
        payoutsStatus: options?.readiness?.payoutsStatus ?? "active",
        onboardingStatus: options?.readiness?.onboardingStatus ?? "ready"
      };
    },
    async retrieveRecipientReadiness(stripeAccountId) {
      return {
        stripeAccountId,
        transfersStatus: options?.readiness?.transfersStatus ?? "active",
        payoutsStatus: options?.readiness?.payoutsStatus ?? "active",
        onboardingStatus: options?.readiness?.onboardingStatus ?? "ready"
      };
    },
    async createOnboardingLink() {
      return {
        url: "https://connect.stripe.test/onboarding",
        expiresAt: futureIso(1)
      };
    },
    async createProviderTransfer(input) {
      options?.onTransfer?.(input);
      const transferError = options?.transferErrors?.shift();
      if (transferError) {
        throw transferError;
      }
      return { transferId: options?.transferIds?.shift() ?? `tr_${input.bookingId}` };
    },
    async reverseProviderTransfer(input) {
      options?.onReversal?.(input);
      return { reversalId: options?.reversalIds?.shift() ?? `trr_${input.bookingId}` };
    }
  };
}

async function attachEvidence(
  platform: MarketplacePlatformService,
  actor: { userId: string; email: string; role: "provider" | "crew-member" },
  bookingId: string,
  phase: "before" | "after"
) {
  return platform.addBookingEvidence(actor, {
    bookingId,
    phase,
    imageDataUrl: testImageDataUrl(`${phase}-photo`)
  });
}

const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+Av7czgAAAABJRU5ErkJggg==",
  "base64"
);

function testImageDataUrl(label: string): string {
  return `data:image/png;base64,${Buffer.concat([onePixelPng, Buffer.from(label)]).toString("base64")}`;
}

class FakePrivatePhotoStorage extends PhotoStorageService {
  private readonly photos = new Map<string, { bytes: Buffer; contentType: string }>();

  public constructor() {
    super("https://api.staging.yardmatch.test", "inline");
  }

  public override async store(
    bookingId: string,
    evidenceId: string,
    _originalDataUrl: string,
    image: ValidatedEvidenceImage
  ) {
    const objectPathname = `booking-evidence/${bookingId}/${evidenceId}.${image.extension}`;
    this.photos.set(objectPathname, { bytes: image.bytes, contentType: image.contentType });
    return {
      deliveryUrl: `https://api.staging.yardmatch.test/api/media/evidence/${evidenceId}?token=secret-${evidenceId}`,
      storageProvider: "vercel-blob-private" as const,
      objectPathname
    };
  }

  public override async read(objectPathname: string) {
    return this.photos.get(objectPathname);
  }
}

async function verifyProviderCredentials(
  platform: MarketplacePlatformService,
  providerId: string,
  options: { includeWorkersComp?: boolean } = {}
) {
  const credentialTypes = [
    "business-registration",
    "general-liability-insurance",
    ...(options.includeWorkersComp ? (["workers-compensation"] as const) : [])
  ] as const;

  for (const type of credentialTypes) {
    const current = await platform.getProviderProfile(providerId);
    if (current.credentials?.some((credential) => credential.type === type && credential.status === "verified")) {
      continue;
    }

    const submitted = await platform.submitProviderCredential(providerId, {
      type,
      jurisdiction: "NJ",
      referenceNumber: `test-${providerId}-${type}`,
      expiresAt: futureIso(24 * 365)
    });
    const credential = submitted.credentials?.find((candidate) => candidate.type === type);
    assert.ok(credential);
    await platform.reviewProviderCredential("ops-test-user", {
      providerId,
      credentialId: credential.id,
      action: "verify",
      notes: "Verified launch regression fixture credential."
    });
  }
}

async function createExecutedStripeProviderTransferFixture(options?: {
  parseWebhookEvent?: PaymentCheckoutGateway["parseWebhookEvent"];
  transferErrors?: Error[];
}) {
  const repository = new InMemoryMarketplaceRepository();
  const transferInputs: Parameters<StripeConnectGateway["createProviderTransfer"]>[0][] = [];
  const reversalInputs: Parameters<StripeConnectGateway["reverseProviderTransfer"]>[0][] = [];
  const stripeCheckout = createFakeStripeGateway({
    parseWebhookEvent: options?.parseWebhookEvent
  });
  const stripeConnect = createFakeStripeConnectGateway({
    onTransfer: (input) => transferInputs.push(input),
    onReversal: (input) => reversalInputs.push(input),
    transferErrors: options?.transferErrors
  });
  const platform = new MarketplacePlatformService(
    repository,
    new DataEngineeringLogger(),
    stripeCheckout,
    "http://localhost:3000",
    stripeConnect
  );
  const customer = await platform.registerUser({
    fullName: "Stripe Transfer Customer",
    email: `stripe-transfer-${crypto.randomUUID()}@example.com`,
    password: "Password123!",
    phone: "555-0299",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress()
  });
  const provider = (await repository.listProviders())[0];
  const opsProfile = (await repository.listOpsUsers())[0];
  assert.ok(provider);
  assert.ok(opsProfile);
  const opsActor = {
    userId: opsProfile.id,
    email: opsProfile.email,
    role: "ops" as const,
    sessionVersion: 1
  };
  await platform.startProviderConnectOnboarding(provider.id);
  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress(),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(72),
    scheduledEndIso: futureIso(73),
    notes: "Stripe provider transfer lifecycle fixture",
    totalCents: 12_800
  });
  await platform.confirmBooking(provider.id, { bookingId: booking.id });
  await attachEvidence(
    platform,
    { userId: provider.id, email: provider.email, role: "provider" },
    booking.id,
    "after"
  );
  await platform.completeBooking(provider.id, { bookingId: booking.id });
  await platform.createCheckoutSession(customer.id, { bookingId: booking.id });
  const payment = await platform.finalizeCheckoutSession(customer.id, {
    checkoutSessionId: "cs_test_123"
  });
  await repository.updateBooking(booking.id, {
    completedAt: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString()
  });
  const preview = await platform.getOpsPayoutPreview();
  const batch = preview.disbursementBatches.find(
    (candidate) =>
      candidate.recipientRole === "provider" && candidate.recipientIds.includes(provider.id)
  );
  assert.ok(batch);
  assert.equal(batch.actionStatus, "ready-for-transfer");
  const created = await platform.createOpsPayoutDisbursementRun(opsActor, {
    previewBatchId: batch.id,
    operatorNotes: "All provider transfer controls reviewed before execution."
  });
  const executed = await withMockedNow(
    new Date(Date.parse(created.run.runDateIso) + 1_000).toISOString(),
    () =>
      platform.executeOpsPayoutDisbursementRun(opsActor, {
        runId: created.run.id,
        confirmation: "execute-provider-transfers",
        operatorNotes: "Revalidated delivery, payment, credentials, and Stripe readiness."
      })
  );
  return {
    repository,
    platform,
    customer,
    provider,
    opsActor,
    booking,
    payment,
    createdRun: created.run,
    executed,
    transferInputs,
    reversalInputs
  };
}

async function reviewCrewMatchForEligibleProvider(
  platform: MarketplacePlatformService,
  providerId: string,
  payload: Parameters<MarketplacePlatformService["reviewCrewMatch"]>[1]
) {
  await verifyProviderCredentials(platform, providerId, { includeWorkersComp: true });
  return platform.reviewCrewMatch(providerId, payload);
}

test("instant quotes normalize addresses and explain confidence sources", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const quote = await platform.createInstantQuote({
    address: {
      line1: "  112   garden row ",
      city: " austin ",
      state: " tx ",
      postalCode: "787041234 ",
      country: " us ",
      point: {
        latitude: 30.2435,
        longitude: -97.7638
      }
    },
    category: "lawn-mowing",
    followUpAnswers: [
      { questionId: "turf_sq_ft", value: 3500 },
      { questionId: "shrub_sq_ft", value: 300 }
    ]
  });

  assert.equal(quote.address.line1, "112 Garden Row");
  assert.equal(quote.address.city, "Austin");
  assert.equal(quote.address.state, "TX");
  assert.equal(quote.address.postalCode, "78704-1234");
  assert.equal(quote.address.country, "US");
  assert.equal(quote.normalizedAddress.wasNormalized, true);
  assert.ok(quote.normalizedAddress.normalizedFields.includes("line1"));
  assert.ok(quote.normalizedAddress.normalizedFields.includes("postalCode"));
  assert.equal(quote.normalizedAddress.validationSource, "local-rules");
  assert.equal(quote.normalizedAddress.validationConfidence, "local-only");
  assert.equal(quote.category, "lawn-mowing");
  assert.equal(quote.launchPricingPolicy.pricingModel, "hybrid-managed-marketplace");
  assert.equal(quote.launchPricingPolicy.introductoryOffer.appliesTo, "first-completed-service");
  assert.equal(quote.launchPricingPolicy.launchServiceCategories[0], "lawn-mowing");
  assert.ok(quote.launchPricingPolicy.customerPricingPrinciples.some((principle) => /one clear/i.test(principle)));
  assert.ok(quote.launchPricingPolicy.providerEconomicsPrinciples.some((principle) => /provider net payouts/i.test(principle)));
  assert.match(quote.launchPricingPolicy.providerFacingExplanation, /not as an expectation to underbid/i);
  assert.ok(quote.estimatedPriceCents > 0);
  assert.equal(quote.measurementSources.turfSqFt, "customer-follow-up");
  assert.equal(quote.measurementSources.shrubBedSqFt, "customer-follow-up");
  assert.ok(quote.confidenceReasons.some((reason) => reason.label === "Your answers sharpened the quote"));
  assert.ok(
    quote.confidenceReasons.some((reason) => /modeled from the address|fallback assumptions/i.test(reason.label))
  );
});

test("instant quotes use google address validation when configured", async () => {
  const originalKey = process.env.GOOGLE_ADDRESS_VALIDATION_API_KEY;
  const originalFetch = global.fetch;

  process.env.GOOGLE_ADDRESS_VALIDATION_API_KEY = "test-address-key";
  global.fetch = (async () =>
    ({
      ok: true,
      async json() {
        return {
          result: {
            verdict: {
              addressComplete: true,
              hasUnconfirmedComponents: false,
              hasInferredComponents: false,
              hasReplacedComponents: false
            },
            address: {
              postalAddress: {
                addressLines: ["112 Garden Row"],
                locality: "Austin",
                administrativeArea: "TX",
                postalCode: "78704-1234",
                regionCode: "US"
              }
            },
            geocode: {
              location: {
                latitude: 30.2435,
                longitude: -97.7638
              }
            }
          }
        };
      }
    }) as Response) as typeof fetch;

  try {
    const repository = new InMemoryMarketplaceRepository();
    const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

    const quote = await platform.createInstantQuote({
      address: {
        line1: "112 garden row",
        city: "austin",
        state: "tx",
        postalCode: "787041234",
        country: "us",
        point: {
          latitude: 30.2435,
          longitude: -97.7638
        }
      },
      category: "lawn-mowing"
    });

    assert.equal(quote.address.line1, "112 Garden Row");
    assert.equal(quote.address.postalCode, "78704-1234");
    assert.equal(quote.normalizedAddress.validationSource, "google-address-validation");
    assert.equal(quote.normalizedAddress.validationConfidence, "validated");
    assert.match(quote.normalizedAddress.validationMessage ?? "", /validated/i);
  } finally {
    process.env.GOOGLE_ADDRESS_VALIDATION_API_KEY = originalKey;
    global.fetch = originalFetch;
  }
});

test("complex heuristic-heavy quotes ask for layout follow-up and explain scope risk", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const quote = await platform.createInstantQuote({
    address: {
      line1: "4500 Canyon Run",
      city: "Austin",
      state: "TX",
      postalCode: "78749",
      country: "US",
      point: {
        latitude: 30.205,
        longitude: -97.91
      }
    },
    category: "seasonal-cleanup",
    followUpAnswers: [{ questionId: "turf_sq_ft", value: 11000 }]
  });

  assert.equal(quote.measurementSources.turfSqFt, "customer-follow-up");
  assert.ok(quote.followUpQuestions.some((question) => question.id === "lot_complexity"));
  assert.ok(
    quote.confidenceReasons.some((reason) => reason.label === "The property layout may still swing the final scope")
  );
  assert.ok(quote.confidenceScore < 0.82);
});

test("winter hardscape quotes ask for driveway and sidewalk measurements", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const address = {
    line1: "8 Bayshore Drive",
    city: "Barnegat",
    state: "NJ",
    postalCode: "08005",
    country: "US",
    point: {
      latitude: 39.7532,
      longitude: -74.2229
    }
  };

  const heuristicQuote = await platform.createInstantQuote({
    address,
    category: "snow-shoveling"
  });

  assert.equal(heuristicQuote.category, "snow-shoveling");
  assert.equal(heuristicQuote.measurementSources.drivewaySqFt, "address-heuristic");
  assert.equal(heuristicQuote.measurementSources.sidewalkLinearFt, "address-heuristic");
  assert.ok(heuristicQuote.followUpQuestions.some((question) => question.id === "driveway_sq_ft"));
  assert.ok(heuristicQuote.followUpQuestions.some((question) => question.id === "sidewalk_linear_ft"));
  assert.ok(!heuristicQuote.followUpQuestions.some((question) => question.id === "turf_sq_ft"));
  assert.ok(!heuristicQuote.followUpQuestions.some((question) => question.id === "shrub_sq_ft"));

  const clarifiedQuote = await platform.createInstantQuote({
    address,
    category: "snow-shoveling",
    followUpAnswers: [
      { questionId: "driveway_sq_ft", value: 1100 },
      { questionId: "sidewalk_linear_ft", value: 100 }
    ]
  });

  assert.equal(clarifiedQuote.category, "snow-shoveling");
  assert.equal(clarifiedQuote.measurements.drivewaySqFt, 1100);
  assert.equal(clarifiedQuote.measurements.sidewalkLinearFt, 100);
  assert.equal(clarifiedQuote.measurementSources.drivewaySqFt, "customer-follow-up");
  assert.equal(clarifiedQuote.measurementSources.sidewalkLinearFt, "customer-follow-up");
  assert.ok(!clarifiedQuote.followUpQuestions.some((question) => question.id === "driveway_sq_ft"));
  assert.ok(!clarifiedQuote.followUpQuestions.some((question) => question.id === "sidewalk_linear_ft"));
  assert.ok(clarifiedQuote.confidenceReasons.some((reason) => reason.label === "Your answers sharpened the quote"));
  assert.ok(clarifiedQuote.estimatedDurationMinutes > heuristicQuote.estimatedDurationMinutes);
});

test("customer addresses are normalized before properties and booking snapshots are saved", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-normalized-address@example.com",
    password: "Password123!",
    phone: "555-0199",
    role: "customer",
    propertyLabel: "Primary home",
    address: {
      line1: "  112   garden row ",
      city: " austin ",
      state: " tx ",
      postalCode: "787041234 ",
      country: " us ",
      point: {
        latitude: 30.2435,
        longitude: -97.7638
      }
    }
  });
  assert.equal(customer.role, "customer");
  assert.equal(customer.address.line1, "112 Garden Row");
  assert.equal(customer.address.city, "Austin");
  assert.equal(customer.address.state, "TX");
  assert.equal(customer.address.postalCode, "78704-1234");

  const addedProperty = await platform.createCustomerProperty(customer.id, {
    label: "Rental house",
    address: {
      line1: "  45  maple avenue ",
      city: " nashville ",
      state: " tn ",
      postalCode: " 372035555 ",
      country: " us ",
      point: {
        latitude: 36.1627,
        longitude: -86.7816
      }
    },
    setAsDefault: false
  });
  assert.equal(addedProperty.address.line1, "45 Maple Avenue");
  assert.equal(addedProperty.address.city, "Nashville");
  assert.equal(addedProperty.address.postalCode, "37203-5555");

  const provider = (await repository.listProviders())[0];
  assert.ok(provider);

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: {
      line1: "  77  elm street ",
      city: " austin ",
      state: " tx ",
      postalCode: "78704 ",
      country: " us ",
      point: {
        latitude: 30.2439,
        longitude: -97.7632
      }
    },
    category: "lawn-mowing",
    scheduledStartIso: futureIso(24),
    scheduledEndIso: futureIso(25),
    notes: "Normalization snapshot test",
    totalCents: 6200
  });

  assert.equal(booking.serviceAddress.line1, "77 Elm Street");
  assert.equal(booking.serviceAddress.city, "Austin");
  assert.equal(booking.serviceAddress.state, "TX");
  assert.equal(booking.serviceAddress.country, "US");
});

test("saved customer properties reuse cached geocodes for the same normalized address", async () => {
  const originalMapsKey = process.env.GOOGLE_MAPS_API_KEY;
  const originalAddressValidationKey = process.env.GOOGLE_ADDRESS_VALIDATION_API_KEY;
  const originalFetch = global.fetch;
  let fetchCalls = 0;

  process.env.GOOGLE_MAPS_API_KEY = "test-maps-key";
  delete process.env.GOOGLE_ADDRESS_VALIDATION_API_KEY;
  global.fetch = (async () => {
    fetchCalls += 1;
    return {
      ok: true,
      async json() {
        return {
          results: [
            {
              formatted_address: "12 Oak Lane, Franklin, TN 37064, USA",
              place_id: "google-oak-lane-franklin",
              geometry: {
                location: {
                  lat: 35.9302,
                  lng: -86.8721
                }
              },
              address_components: [
                { long_name: "12", short_name: "12", types: ["street_number"] },
                { long_name: "Oak Lane", short_name: "Oak Ln", types: ["route"] },
                { long_name: "Franklin", short_name: "Franklin", types: ["locality"] },
                { long_name: "Tennessee", short_name: "TN", types: ["administrative_area_level_1"] },
                { long_name: "37064", short_name: "37064", types: ["postal_code"] },
                { long_name: "United States", short_name: "US", types: ["country"] }
              ]
            }
          ]
        };
      }
    } as Response;
  }) as typeof fetch;

  try {
    const repository = new InMemoryMarketplaceRepository();
    await repository.createCustomer({
      id: "customer-geocode-cache",
      fullName: "Geocode Cache",
      email: "geocode-cache@example.com",
      phone: "555-0101",
      role: "customer",
      address: createAddress("1 Existing Home", 35.92, -86.86),
      createdAt: new Date().toISOString(),
      propertyNotes: "",
      lawnSizeSqFt: 0,
      properties: [],
      defaultPropertyId: ""
    });
    const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());
    const firstProperty = await platform.createCustomerProperty("customer-geocode-cache", {
      label: "Front lawn",
      address: {
        line1: "12 oak lane",
        city: "franklin",
        state: "tn",
        postalCode: "37064",
        country: "us",
        point: {
          latitude: 0,
          longitude: 0
        }
      }
    });
    const secondProperty = await platform.createCustomerProperty("customer-geocode-cache", {
      label: "Same address",
      address: {
        line1: "  12   Oak  Lane ",
        city: " Franklin ",
        state: " TN ",
        postalCode: "37064",
        country: "US",
        point: {
          latitude: 1,
          longitude: 1
        }
      }
    });

    assert.equal(fetchCalls, 1);
    assert.equal(firstProperty.address.point.latitude, 35.9302);
    assert.equal(firstProperty.address.point.longitude, -86.8721);
    assert.deepEqual(secondProperty.address.point, firstProperty.address.point);
    assert.equal(secondProperty.address.geocodeCacheKey, firstProperty.address.geocodeCacheKey);
    assert.equal(secondProperty.address.geocodeProvider, "google-geocoding");
  } finally {
    process.env.GOOGLE_MAPS_API_KEY = originalMapsKey;
    process.env.GOOGLE_ADDRESS_VALIDATION_API_KEY = originalAddressValidationKey;
    global.fetch = originalFetch;
  }
});

test("quotes and bookings reuse saved customer property geocodes for matching custom addresses", async () => {
  const originalMapsKey = process.env.GOOGLE_MAPS_API_KEY;
  const originalAddressValidationKey = process.env.GOOGLE_ADDRESS_VALIDATION_API_KEY;
  const originalFetch = global.fetch;
  let fetchCalls = 0;

  process.env.GOOGLE_MAPS_API_KEY = "test-maps-key";
  delete process.env.GOOGLE_ADDRESS_VALIDATION_API_KEY;
  global.fetch = (async () => {
    fetchCalls += 1;
    return {
      ok: true,
      async json() {
        return {
          results: [
            {
              formatted_address: "8 Bayshore Drive, Barnegat, NJ 08005, USA",
              place_id: "google-bayshore-barnegat",
              geometry: {
                location: {
                  lat: 39.7541,
                  lng: -74.2234
                }
              },
              address_components: [
                { long_name: "8", short_name: "8", types: ["street_number"] },
                { long_name: "Bayshore Drive", short_name: "Bayshore Dr", types: ["route"] },
                { long_name: "Barnegat", short_name: "Barnegat", types: ["locality"] },
                { long_name: "New Jersey", short_name: "NJ", types: ["administrative_area_level_1"] },
                { long_name: "08005", short_name: "08005", types: ["postal_code"] },
                { long_name: "United States", short_name: "US", types: ["country"] }
              ]
            }
          ]
        };
      }
    } as Response;
  }) as typeof fetch;

  try {
    const repository = new InMemoryMarketplaceRepository();
    await repository.createCustomer({
      id: "customer-repeat-geocode-cache",
      fullName: "Repeat Geocode Cache",
      email: "repeat-geocode-cache@example.com",
      phone: "555-0102",
      role: "customer",
      address: createAddress("1 Existing Home", 39.75, -74.22),
      createdAt: new Date().toISOString(),
      propertyNotes: "",
      lawnSizeSqFt: 0,
      properties: [],
      defaultPropertyId: ""
    });
    const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());
    const savedProperty = await platform.createCustomerProperty("customer-repeat-geocode-cache", {
      label: "Barnegat home",
      address: {
        line1: "8 bayshore drive",
        city: "barnegat",
        state: "nj",
        postalCode: "08005",
        country: "us",
        point: {
          latitude: 0,
          longitude: 0
        }
      }
    });

    const repeatedAddress = {
      line1: "  8   Bayshore  Drive ",
      city: " Barnegat ",
      state: " NJ ",
      postalCode: "08005",
      country: "US",
      point: {
        latitude: 1,
        longitude: 1
      }
    };
    const quote = await platform.createInstantQuote({
      customerId: "customer-repeat-geocode-cache",
      address: repeatedAddress,
      category: "lawn-mowing"
    });
    const provider = (await repository.listProviders())[0];
    assert.ok(provider);
    const slot = (await repository.listSlotsByProvider(provider.id)).find((candidate) => !candidate.isBooked);
    assert.ok(slot);
    const booking = await platform.createBooking("customer-repeat-geocode-cache", {
      providerId: provider.id,
      serviceAddress: repeatedAddress,
      category: "lawn-mowing",
      scheduledStartIso: slot.startIso,
      scheduledEndIso: slot.endIso,
      notes: "Repeat geocode cache booking",
      totalCents: 6200
    });

    assert.equal(fetchCalls, 1);
    assert.deepEqual(quote.address.point, savedProperty.address.point);
    assert.equal(quote.address.geocodeCacheKey, savedProperty.address.geocodeCacheKey);
    assert.equal(quote.address.geocodeProvider, "google-geocoding");
    assert.deepEqual(booking.serviceAddress.point, savedProperty.address.point);
    assert.equal(booking.serviceAddress.geocodeCacheKey, savedProperty.address.geocodeCacheKey);
    assert.equal(booking.serviceAddress.geocodeProvider, "google-geocoding");
  } finally {
    process.env.GOOGLE_MAPS_API_KEY = originalMapsKey;
    process.env.GOOGLE_ADDRESS_VALIDATION_API_KEY = originalAddressValidationKey;
    global.fetch = originalFetch;
  }
});

test("provider search returns ranked results with score reasons and reliability-aware ordering", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const [nearProvider, farProvider] = (await repository.listProviders()).slice(0, 2);
  assert.ok(nearProvider);
  assert.ok(farProvider);

  await repository.updateProvider(nearProvider.id, {
    companyName: "Near Reliable Lawn",
    address: createAddress("113 Garden Row", 30.24355, -97.76385),
    serviceRadiusMiles: 20,
    sponsoredListingEnabled: false,
    categories: ["lawn-mowing"],
    rating: 4.9,
    timelinessRating: 4.9,
    attentionToDetailRating: 4.9,
    reviewCount: 220,
    yearsExperience: 12,
    verificationStatus: "verified"
  });

  await repository.updateProvider(farProvider.id, {
    companyName: "Sponsored Route Co.",
    address: createAddress("2200 Outer Loop", 30.305, -97.82),
    serviceRadiusMiles: 50,
    sponsoredListingEnabled: true,
    categories: ["lawn-mowing", "seasonal-cleanup", "mulch-installation", "weed-control"],
    rating: 4.1,
    timelinessRating: 3.8,
    attentionToDetailRating: 4,
    reviewCount: 12,
    yearsExperience: 4,
    verificationStatus: "verified"
  });

  const broadProvider = await platform.registerUser({
    fullName: "Morgan Lane",
    email: "provider-broad-ranking@example.com",
    password: "Password123!",
    phone: "555-0230",
    role: "provider",
    companyName: "Broad Route Yard Care",
    categories: ["lawn-mowing", "seasonal-cleanup", "mulch-installation", "weed-control"],
    serviceRadiusMiles: 20,
    address: createAddress("114 Garden Row", 30.2437, -97.76395)
  });

  await repository.updateProvider(broadProvider.id, {
    rating: 4.8,
    timelinessRating: 4.8,
    attentionToDetailRating: 4.8,
    reviewCount: 180,
    yearsExperience: 12,
    verificationStatus: "verified"
  });

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-ranking@example.com",
    password: "Password123!",
    phone: "555-0200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638)
  });

  const nearbyCompletedBooking = await platform.createBooking(customer.id, {
    providerId: nearProvider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(48),
    scheduledEndIso: futureIso(49),
    notes: "Nearby familiarity coverage",
    totalCents: 6200
  });

  await repository.updateBooking(nearbyCompletedBooking.id, {
    status: "completed"
  });

  for (let index = 0; index < 5; index += 1) {
    const acceptedBooking = await platform.createBooking(customer.id, {
      providerId: nearProvider.id,
      serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
      servicePropertyId: customer.defaultPropertyId,
      category: "lawn-mowing",
      scheduledStartIso: futureIso(52 + index * 2),
      scheduledEndIso: futureIso(53 + index * 2),
      notes: `Operational reliability acceptance ${index + 1}`,
      totalCents: 6200
    });

    await platform.confirmBooking(nearProvider.id, {
      bookingId: acceptedBooking.id
    });
  }

  for (let index = 0; index < 5; index += 1) {
    const declinedRequest = await platform.createBooking(customer.id, {
      providerId: farProvider.id,
      serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
      servicePropertyId: customer.defaultPropertyId,
      category: "lawn-mowing",
      scheduledStartIso: futureIso(64 + index * 2),
      scheduledEndIso: futureIso(65 + index * 2),
      notes: `Operational reliability decline ${index + 1}`,
      totalCents: 6200
    });

    await platform.declineBooking(farProvider.id, {
      bookingId: declinedRequest.id,
      reason: "Route already committed to stronger jobs."
    });
  }

  const problemBooking = await platform.createBooking(customer.id, {
    providerId: farProvider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(72),
    scheduledEndIso: futureIso(73),
    notes: "Ranking penalty coverage",
    totalCents: 6200
  });

  await repository.updateBooking(problemBooking.id, {
    status: "disputed",
    disputedAt: new Date().toISOString(),
    disputeReason: "Customer reported a missed service window."
  });

  const results = await platform.searchProviders({
    address: createAddress("112 Garden Row", 30.2435, -97.7638),
    categories: ["lawn-mowing"],
    dateIso: new Date().toISOString(),
    estimatedDurationMinutes: 60
  });

  assert.ok(results.rankedProviders.length >= 2);
  assert.equal(results.providers[0]?.id, nearProvider.id);
  assert.equal(results.rankedProviders[0]?.provider.id, nearProvider.id);
  const customerSafeProvider = results.rankedProviders[0]!.provider;
  assert.equal("email" in customerSafeProvider, false);
  assert.equal("phone" in customerSafeProvider, false);
  assert.equal("fullName" in customerSafeProvider, false);
  assert.equal("address" in customerSafeProvider, false);
  assert.equal("verificationNotes" in customerSafeProvider, false);
  assert.equal("connectAccount" in customerSafeProvider, false);
  assert.equal(customerSafeProvider.serviceArea.city, nearProvider.address.city);
  assert.equal(customerSafeProvider.serviceArea.center.latitude, 30.24);
  assert.equal(customerSafeProvider.serviceArea.center.longitude, -97.76);
  const customerSafeProfile = await platform.getMarketplaceProviderProfile(nearProvider.id);
  assert.deepEqual(customerSafeProfile, customerSafeProvider);
  await assert.rejects(
    platform.updateProviderProfile(nearProvider.id, {
      bio: "Reliable lawn care. Text us at five five five 123 4567 for a faster quote."
    }),
    /keep communication in YardMatch/
  );
  assert.ok(results.rankedProviders[0]!.score > results.rankedProviders[1]!.score);
  assert.ok(results.rankedProviders[0]!.reasons.length > 0);
  assert.ok(results.rankedProviders[0]!.reasons.includes("Close to the property"));
  assert.ok(results.rankedProviders[0]!.reasons.includes("Focused on this type of service"));
  assert.ok((results.rankedProviders[0]!.factors.specialization ?? 0) > 0);
  assert.ok((results.rankedProviders[0]!.factors.operationalReliability ?? 0) > 0);
  assert.ok((results.rankedProviders[0]!.factors.providerEconomics ?? 0) > 0);
  assert.equal(results.rankedProviders[0]!.providerEconomics.status, "healthy");
  assert.match(results.rankedProviders[0]!.providerEconomics.label, /provider payout/i);
  assert.ok(
    results.rankedProviders[0]!.providerEconomics.estimatedProviderNetCents >
      results.rankedProviders[0]!.providerEconomics.minimumRecommendedPayoutCents
  );
  assert.match(results.rankedProviders[0]!.providerEconomics.detail, /provider net/i);
  assert.ok(results.rankedProviders[0]!.completedJobCount >= 1);
  assert.ok(results.rankedProviders[0]!.nearbyCompletedJobCount >= 1);
  assert.equal(results.rankedProviders[0]!.availabilityConfidence, "high");
  assert.match(results.rankedProviders[0]!.reliabilityLabel, /track record|service history|reliability/i);
  assert.match(results.rankedProviders[0]!.reliabilityDetail, /reviews|punctuality|completed|follow-through/i);
  assert.match(results.rankedProviders[0]!.selectionSummaryLabel, /match|trust|fit/i);
  assert.match(results.rankedProviders[0]!.selectionSummaryDetail, /GreenRain recommended|because/i);
  assert.ok(/area|neighborhood/i.test(results.rankedProviders[0]!.neighborhoodFamiliarityLabel));
  assert.ok(results.rankedProviders[0]!.availabilityConfidenceLabel.length > 0);

  const broadResult = results.rankedProviders.find((result) => result.provider.id === broadProvider.id);
  assert.ok(broadResult);
  assert.ok((results.rankedProviders[0]!.factors.specialization ?? 0) > (broadResult?.factors.specialization ?? 0));

  const sponsoredResult = results.rankedProviders.find((result) => result.provider.id === farProvider.id);
  assert.ok(sponsoredResult);
  assert.equal(sponsoredResult?.factors.sponsorship, 0);
  assert.equal(sponsoredResult?.reasons.includes("Sponsored placement"), false);
  assert.ok(
    (results.rankedProviders[0]!.factors.operationalReliability ?? 0) >
      (sponsoredResult?.factors.operationalReliability ?? 0)
  );
  assert.ok((sponsoredResult?.factors.issuePenalty ?? 0) > 0);
  assert.match(sponsoredResult?.reliabilityLabel ?? "", /reliability|track record/i);
  assert.match(sponsoredResult?.reliabilityDetail ?? "", /decline|weaker/i);
  assert.match(sponsoredResult?.selectionSummaryLabel ?? "", /ranks behind|fallback/i);
});

test("provider search favors full-service fit for multi-service requests", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const fullMixProvider = await platform.registerUser({
    fullName: "Maya Turner",
    email: "provider-full-mix-ranking@example.com",
    password: "Password123!",
    phone: "555-0236",
    role: "provider",
    companyName: "Barnegat Full Mix Care",
    categories: ["lawn-mowing", "mulch-installation"],
    serviceRadiusMiles: 20,
    address: createAddress("12 Bayshore Drive", 39.7535, -74.2225)
  });
  await repository.updateProvider(fullMixProvider.id, {
    verificationStatus: "verified",
    rating: 4.7,
    timelinessRating: 4.7,
    attentionToDetailRating: 4.7,
    reviewCount: 35,
    yearsExperience: 7
  });

  const partialProvider = await platform.registerUser({
    fullName: "Noah Kim",
    email: "provider-partial-mix-ranking@example.com",
    password: "Password123!",
    phone: "555-0237",
    role: "provider",
    companyName: "Barnegat Mowing Only",
    categories: ["lawn-mowing"],
    serviceRadiusMiles: 20,
    address: createAddress("10 Bayshore Drive", 39.75325, -74.22275)
  });
  await repository.updateProvider(partialProvider.id, {
    verificationStatus: "verified",
    rating: 4.95,
    timelinessRating: 4.95,
    attentionToDetailRating: 4.95,
    reviewCount: 80,
    yearsExperience: 10,
    sponsoredListingEnabled: true
  });

  const results = await platform.searchProviders({
    address: createAddress("8 Bayshore Drive", 39.7532, -74.2229),
    categories: ["lawn-mowing", "mulch-installation"],
    dateIso: new Date().toISOString(),
    estimatedDurationMinutes: 180
  });

  const fullMixResult = results.rankedProviders.find((result) => result.provider.id === fullMixProvider.id);
  const partialResult = results.rankedProviders.find((result) => result.provider.id === partialProvider.id);

  assert.ok(fullMixResult);
  assert.ok(partialResult);
  assert.equal(results.rankedProviders[0]?.provider.id, fullMixProvider.id);
  assert.equal(fullMixResult.serviceFitSummary.status, "complete");
  assert.deepEqual(fullMixResult.serviceFitSummary.requestedCategories, ["lawn-mowing", "mulch-installation"]);
  assert.deepEqual(fullMixResult.serviceFitSummary.matchedCategories, ["lawn-mowing", "mulch-installation"]);
  assert.deepEqual(fullMixResult.serviceFitSummary.missingCategories, []);
  assert.match(fullMixResult.serviceFitSummary.label, /full service mix/i);
  assert.match(fullMixResult.serviceFitSummary.detail, /one managed request/i);
  assert.ok(fullMixResult.reasons.includes("Covers all requested services"));
  assert.ok(fullMixResult.factors.serviceFit > partialResult.factors.serviceFit);
  assert.match(fullMixResult.providerEconomics.detail, /service mix/i);

  assert.equal(partialResult.serviceFitSummary.status, "partial");
  assert.deepEqual(partialResult.serviceFitSummary.matchedCategories, ["lawn-mowing"]);
  assert.deepEqual(partialResult.serviceFitSummary.missingCategories, ["mulch-installation"]);
  assert.match(partialResult.serviceFitSummary.detail, /another provider|ops follow-up/i);
  assert.ok(fullMixResult.providerEconomics.minimumRecommendedPayoutCents > partialResult.providerEconomics.minimumRecommendedPayoutCents);
  assert.equal(partialResult.providerEconomics.status, "healthy");
  assert.equal(partialResult.provider.categories.includes("mulch-installation"), false);
});

test("provider search flags thin long-route economics without dropping qualified providers", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-economics-risk@example.com",
    password: "Password123!",
    phone: "555-0235",
    role: "provider",
    companyName: "Long Route Leaf Care",
    categories: ["leaf-blowing"],
    serviceRadiusMiles: 60,
    address: createAddress("900 Rural Route", 30.68, -97.95)
  });
  await repository.updateProvider(provider.id, {
    verificationStatus: "verified",
    rating: 4.9,
    timelinessRating: 4.9,
    attentionToDetailRating: 4.9,
    reviewCount: 40
  });

  const results = await platform.searchProviders({
    address: createAddress("112 Garden Row", 30.2435, -97.7638),
    categories: ["leaf-blowing"],
    dateIso: new Date().toISOString(),
    estimatedDurationMinutes: 30
  });

  const rankedProvider = results.rankedProviders.find((result) => result.provider.id === provider.id);
  assert.ok(rankedProvider);
  assert.equal(rankedProvider.provider.id, provider.id);
  assert.equal(rankedProvider.providerEconomics.status, "at-risk");
  assert.equal(rankedProvider.factors.providerEconomics, 0);
  assert.ok(
    rankedProvider.providerEconomics.estimatedProviderNetCents <
      rankedProvider.providerEconomics.minimumRecommendedPayoutCents
  );
  assert.ok(rankedProvider.reasons.includes("Provider payout needs ops review"));
  assert.match(rankedProvider.providerEconomics.detail, /ops should review pricing/i);
});

test("provider search can softly prefer a proven provider for retention-driven rebooks", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const analytics = new DataEngineeringLogger();
  const platform = new MarketplacePlatformService(repository, analytics);

  const [priorProvider, challengerProvider] = (await repository.listProviders()).slice(0, 2);
  assert.ok(priorProvider);
  assert.ok(challengerProvider);

  await repository.updateProvider(priorProvider.id, {
    companyName: "Trusted Repeat Lawn",
    address: createAddress("113 Garden Row", 30.24355, -97.76385),
    serviceRadiusMiles: 20,
    sponsoredListingEnabled: false,
    categories: ["lawn-mowing"],
    rating: 4.6,
    timelinessRating: 4.5,
    attentionToDetailRating: 4.6,
    reviewCount: 18,
    yearsExperience: 6,
    verificationStatus: "verified"
  });

  await repository.updateProvider(challengerProvider.id, {
    companyName: "Top Fresh Match Lawn",
    address: createAddress("114 Garden Row", 30.2436, -97.7639),
    serviceRadiusMiles: 20,
    sponsoredListingEnabled: false,
    categories: ["lawn-mowing"],
    rating: 4.95,
    timelinessRating: 4.95,
    attentionToDetailRating: 4.95,
    reviewCount: 160,
    yearsExperience: 12,
    verificationStatus: "verified"
  });

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-retention-ranking@example.com",
    password: "Password123!",
    phone: "555-0200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638)
  });

  for (let index = 0; index < 2; index += 1) {
    const booking = await platform.createBooking(customer.id, {
      providerId: priorProvider.id,
      serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
      servicePropertyId: customer.defaultPropertyId,
      category: "lawn-mowing",
      scheduledStartIso: futureIso(48 + index * 24),
      scheduledEndIso: futureIso(49 + index * 24),
      notes: `Repeat mowing history ${index + 1}`,
      totalCents: 6200
    });

    await repository.updateBooking(booking.id, {
      status: "completed",
      completedAt: new Date(Date.now() - (21 - index * 14) * 24 * 60 * 60 * 1000).toISOString()
    });
  }

  const withoutRetention = await platform.searchProviders({
    address: createAddress("112 Garden Row", 30.2435, -97.7638),
    categories: ["lawn-mowing"],
    dateIso: new Date().toISOString(),
    estimatedDurationMinutes: 60,
    requestSource: "customer-web-dashboard"
  });
  assert.equal(withoutRetention.rankedProviders[0]?.provider.id, challengerProvider.id);

  const withRetention = await platform.searchProviders({
    address: createAddress("112 Garden Row", 30.2435, -97.7638),
    categories: ["lawn-mowing"],
    dateIso: new Date().toISOString(),
    estimatedDurationMinutes: 60,
    requestSource: "customer-retention-nudge",
    retentionPreference: {
      priorProviderId: priorProvider.id,
      sourceBookingId: "retention-source-booking",
      strategyKey: "lawn-mowing-biweekly-repeat",
      trigger: "recent-completion",
      loyaltySegment: "provider-loyal",
      completedCategoryCount: 2,
      sameProviderCompletedCount: 2
    }
  });

  assert.equal(withRetention.rankedProviders[0]?.provider.id, priorProvider.id);
  assert.ok(withRetention.rankedProviders[0]?.reasons.includes("Already completed this service at the property"));
  assert.equal(withRetention.rankedProviders[0]?.factors.loyalty, 10);
  assert.match(withRetention.rankedProviders[0]?.selectionSummaryLabel ?? "", /trusted repeat-provider/i);

  const retentionPresentedEvent = analytics
    .listEvents()
    .filter((event) => event.name === MarketplaceTelemetryEventCatalog.recommendationPresented)
    .find(
      (event) =>
        event.properties.requestSource === "customer-retention-nudge" &&
        event.properties.retentionStrategyKey === "lawn-mowing-biweekly-repeat"
    );
  assert.ok(retentionPresentedEvent);
  assert.equal(retentionPresentedEvent?.properties.loyaltySegment, "provider-loyal");
});

test("provider decline flow and ops overview counters cover confirms, declines, cancellations, and payment milestones", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const analytics = new DataEngineeringLogger();
  const platform = new MarketplacePlatformService(repository, analytics, createFakeStripeGateway());

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-provider-decline@example.com",
    password: "Password123!",
    phone: "555-0200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress()
  });

  const provider = (await repository.listProviders())[0];
  assert.ok(provider);

  const confirmedBooking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress(),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(72),
    scheduledEndIso: futureIso(73),
    notes: "Confirm me",
    totalCents: 6200
  });

  const declinedBooking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("113 Garden Row"),
    servicePropertyId: customer.defaultPropertyId,
    category: "hedge-trimming",
    scheduledStartIso: futureIso(74),
    scheduledEndIso: futureIso(75),
    notes: "Decline me",
    totalCents: 7200
  });

  const cancelledBooking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("114 Garden Row"),
    servicePropertyId: customer.defaultPropertyId,
    category: "seasonal-cleanup",
    scheduledStartIso: futureIso(76),
    scheduledEndIso: futureIso(77),
    notes: "Cancel me",
    totalCents: 8200
  });

  const authorizedBooking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("115 Garden Row"),
    servicePropertyId: customer.defaultPropertyId,
    category: "weed-control",
    scheduledStartIso: futureIso(78),
    scheduledEndIso: futureIso(79),
    notes: "Authorize me",
    totalCents: 5200
  });

  const capturedBooking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("116 Garden Row"),
    servicePropertyId: customer.defaultPropertyId,
    category: "mulch-installation",
    scheduledStartIso: futureIso(80),
    scheduledEndIso: futureIso(81),
    notes: "Capture me",
    totalCents: 9200
  });

  await platform.confirmBooking(provider.id, { bookingId: confirmedBooking.id });
  const declined = await platform.declineBooking(provider.id, {
    bookingId: declinedBooking.id,
    reason: "Route already full for that window."
  });
  assert.equal(declined.status, "cancelled");

  await platform.cancelBooking(customer.id, { bookingId: cancelledBooking.id });
  await platform.createPaymentIntent({
    bookingId: authorizedBooking.id,
    amountCents: authorizedBooking.totalCents
  });
  await platform.createCheckoutSession(customer.id, { bookingId: capturedBooking.id });
  await platform.finalizeCheckoutSession(customer.id, { checkoutSessionId: "cs_test_123" });

  const customerNotifications = await repository.listNotificationsByRecipient(customer.id);
  assert.ok(
    customerNotifications.some((notification) => notification.title === "Provider declined this request")
  );

  const overview = analytics.getOverview({
    bookings: await repository.listBookings(),
    launchLeads: await repository.listLaunchLeads(),
    reviewInvites: await repository.listReviewInvites(),
    supportTickets: await repository.listSupportTickets()
  });

  assert.equal(overview.providerBookingConfirmations, 1);
  assert.equal(overview.providerBookingDeclines, 1);
  assert.equal(overview.customerBookingCancellations, 1);
  assert.equal(overview.paymentAuthorizations, 1);
  assert.equal(overview.paymentCaptures, 1);
});

test("observability overview includes launch lead backlog and source metrics", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const analytics = new DataEngineeringLogger();
  const platform = new MarketplacePlatformService(repository, analytics);
  const seededProvider = (await repository.listProviders())[0];
  assert.ok(seededProvider);

  const overdueLead = await platform.createLaunchLead({
    sourceChannel: "email",
    requestSource: "direct-email-forward",
    contactName: "Jamie Homeowner",
    email: "jamie@example.com",
    preferredContactMethod: "email",
    areaLabel: "Barnegat, NJ",
    serviceCategory: "lawn-mowing",
    message: "Need help getting weekly mowing started."
  });
  await repository.updateLaunchLead(overdueLead.id, {
    firstResponseDueAt: new Date(Date.now() - 60 * 60 * 1000).toISOString()
  });

  const followUpLead = await platform.createLaunchLead({
    sourceChannel: "google-business-profile",
    requestSource: "google-business-profile-message",
    channelMetadata: {
      threadUrl: "https://business.google.com/messages/thread/gbp_thread_789"
    },
    contactName: "Pat Homeowner",
    preferredContactMethod: "platform-message",
    areaLabel: "Barnegat, NJ",
    serviceCategory: "seasonal-cleanup",
    message: "Can GreenRain help with a cleanup this week?"
  });
  await platform.updateLaunchLeadForOps({
    leadId: followUpLead.id,
    status: "contacted",
    assignedOwner: "Casey Ops",
    nextFollowUpDueAt: new Date(Date.now() - 30 * 60 * 1000).toISOString()
  });

  const closedLead = await platform.createLaunchLead({
    sourceChannel: "referral",
    requestSource: "referral-forwarder",
    channelMetadata: {
      referrerName: "Alex Neighbor",
      referralFollowUpTarget: "referrer"
    },
    contactName: "Taylor Homeowner",
    email: "taylor@example.com",
    preferredContactMethod: "email",
    areaLabel: "Barnegat, NJ",
    serviceCategory: "lawn-mowing",
    message: "Referral asking whether GreenRain can help this month."
  });
  await platform.updateLaunchLeadForOps({
    leadId: closedLead.id,
    status: "closed-lost",
    assignedOwner: "Casey Ops",
    lossReason: "not-ready",
    outcomeSummary: "Customer wants to wait until next season."
  });

  const reviewInviteBaseTime = new Date().toISOString();
  await repository.createReviewInvite({
    id: "review-invite-scheduled",
    bookingId: "booking-review-scheduled",
    customerId: "customer-review-scheduled",
    providerId: "provider-review-scheduled",
    email: "scheduled@example.com",
    status: "scheduled",
    channels: ["email"],
    scheduledSendIso: reviewInviteBaseTime,
    expiresAtIso: futureIso(48),
    deepLinkPath: "/customer/dashboard?review=scheduled"
  });
  await repository.createReviewInvite({
    id: "review-invite-sent",
    bookingId: "booking-review-sent",
    customerId: "customer-review-sent",
    providerId: "provider-review-sent",
    email: "sent@example.com",
    status: "sent",
    channels: ["email"],
    scheduledSendIso: reviewInviteBaseTime,
    sentAt: reviewInviteBaseTime,
    expiresAtIso: futureIso(48),
    deepLinkPath: "/customer/dashboard?review=sent"
  });
  await repository.createReviewInvite({
    id: "review-invite-completed",
    bookingId: "booking-review-completed",
    customerId: "customer-review-completed",
    providerId: "provider-review-completed",
    email: "completed@example.com",
    status: "completed",
    channels: ["email"],
    scheduledSendIso: reviewInviteBaseTime,
    sentAt: reviewInviteBaseTime,
    openedAt: reviewInviteBaseTime,
    completedAt: reviewInviteBaseTime,
    expiresAtIso: futureIso(48),
    deepLinkPath: "/customer/dashboard?review=completed"
  });
  await repository.createReviewInvite({
    id: "review-invite-expired",
    bookingId: "booking-review-expired",
    customerId: "customer-review-expired",
    providerId: "provider-review-expired",
    email: "expired@example.com",
    status: "expired",
    channels: ["email"],
    scheduledSendIso: reviewInviteBaseTime,
    sentAt: reviewInviteBaseTime,
    expiresAtIso: reviewInviteBaseTime,
    deepLinkPath: "/customer/dashboard?review=expired"
  });

  platform.createAnalyticsEvent({
    id: crypto.randomUUID(),
    name: MarketplaceTelemetryEventCatalog.retentionPromptPresented,
    actorId: "customer-retention",
    occurredAt: new Date().toISOString(),
    properties: {
      retentionStrategyKey: "lawn-mowing-recurring",
      retentionTrigger: "recent-completion",
      category: "lawn-mowing",
      requestSource: "customer-web-dashboard"
    }
  });
  platform.createAnalyticsEvent({
    id: crypto.randomUUID(),
    name: MarketplaceTelemetryEventCatalog.retentionPromptPresented,
    actorId: "customer-retention",
    occurredAt: new Date().toISOString(),
    properties: {
      retentionStrategyKey: "lawn-mowing-recurring",
      retentionTrigger: "recent-completion",
      category: "lawn-mowing",
      requestSource: "customer-web-dashboard"
    }
  });
  platform.createAnalyticsEvent({
    id: crypto.randomUUID(),
    name: MarketplaceTelemetryEventCatalog.retentionPromptAccepted,
    actorId: "customer-retention",
    occurredAt: new Date().toISOString(),
    properties: {
      retentionStrategyKey: "lawn-mowing-recurring",
      retentionTrigger: "recent-completion",
      category: "lawn-mowing",
      requestSource: "customer-web-dashboard"
    }
  });
  platform.createAnalyticsEvent({
    id: crypto.randomUUID(),
    name: MarketplaceTelemetryEventCatalog.bookingRequested,
    actorId: "customer-retention",
    occurredAt: new Date().toISOString(),
    properties: {
      providerId: seededProvider.id,
      category: "lawn-mowing",
      requestSource: "customer-retention-nudge",
      recurringPlanStarted: true,
      retentionStrategyKey: "lawn-mowing-recurring",
      retentionTrigger: "recent-completion"
    }
  });

  const overview = await platform.getObservabilityOverview();
  assert.equal(overview.totalLaunchLeads, 3);
  assert.equal(overview.openLaunchLeads, 2);
  assert.equal(overview.overdueLaunchLeads, 2);
  assert.equal(overview.firstResponseOverdueLaunchLeads, 1);
  assert.equal(overview.followUpOverdueLaunchLeads, 1);
  assert.equal(overview.closedLostLaunchLeads, 1);
  assert.equal(overview.convertedLaunchLeads, 0);
  assert.equal(overview.totalReviewInvites, 4);
  assert.equal(overview.scheduledReviewInvites, 1);
  assert.equal(overview.sentReviewInvites, 1);
  assert.equal(overview.openedReviewInvites, 0);
  assert.equal(overview.completedReviewInvites, 1);
  assert.equal(overview.expiredReviewInvites, 1);
  assert.equal(overview.reviewRequestCompletionRate, 0.25);
  assert.equal(overview.retentionPromptViews, 2);
  assert.equal(overview.retentionPromptAccepts, 1);
  assert.equal(overview.retentionPromptAcceptanceRate, 0.5);

  const emailMetric = overview.launchLeadSourceMetrics.find((metric) => metric.sourceChannel === "email");
  const gbpMetric = overview.launchLeadSourceMetrics.find(
    (metric) => metric.sourceChannel === "google-business-profile"
  );
  assert.equal(emailMetric?.overdueCount, 1);
  assert.equal(gbpMetric?.openCount, 1);

  const mowingRetentionMetric = overview.retentionMetricsByStrategy.find(
    (metric) => metric.strategyKey === "lawn-mowing-recurring"
  );
  assert.equal(mowingRetentionMetric?.promptViews, 2);
  assert.equal(mowingRetentionMetric?.promptAccepts, 1);
  assert.equal(mowingRetentionMetric?.acceptanceRate, 0.5);

  const retentionSourceMetric = overview.retentionMetricsBySource.find(
    (metric) =>
      metric.requestSource === "customer-retention-nudge" &&
      metric.strategyKey === "lawn-mowing-recurring"
  );
  assert.equal(retentionSourceMetric?.bookingRequests, 1);
  assert.equal(retentionSourceMetric?.recurringPlanStarts, 1);
  assert.equal(retentionSourceMetric?.oneTimeRebooks, 0);

  const retentionProviderMetric = overview.retentionMetricsByProvider.find(
    (metric) =>
      metric.providerId === seededProvider.id && metric.strategyKey === "lawn-mowing-recurring"
  );
  assert.equal(retentionProviderMetric?.providerName, seededProvider.companyName);
  assert.equal(retentionProviderMetric?.bookingRequests, 1);
  assert.equal(retentionProviderMetric?.recurringPlanStarts, 1);

  const volumeInsight = overview.retentionInsights.find((insight) => insight.kind === "volume");
  assert.equal(volumeInsight?.status, "needs-volume");
  assert.equal(volumeInsight?.promptViews, 2);
  assert.equal(volumeInsight?.bookingRequests, 1);
  assert.match(volumeInsight?.recommendedAction ?? "", /10 views and 3 repeat bookings/i);

  const strategyInsight = overview.retentionInsights.find((insight) => insight.kind === "strategy");
  assert.equal(strategyInsight?.strategyKey, "lawn-mowing-recurring");
  assert.equal(strategyInsight?.category, "lawn-mowing");
  assert.equal(strategyInsight?.promptAccepts, 1);
  assert.equal(strategyInsight?.rate, 0.5);

  const providerInsight = overview.retentionInsights.find((insight) => insight.kind === "provider");
  assert.equal(providerInsight?.providerId, seededProvider.id);
  assert.equal(providerInsight?.providerName, seededProvider.companyName);
  assert.equal(providerInsight?.bookingRequests, 1);
});

test("observability overview includes internal ops access health, recent access changes, and sign-in reporting", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const analytics = new DataEngineeringLogger();
  const platform = new MarketplacePlatformService(repository, analytics);
  const adminIdentity = await platform.findAuthIdentityByEmail("ops@example.com");
  assert.ok(adminIdentity);

  const staffCreate = await withMockedNow("2026-06-24T09:00:00.000Z", () =>
    platform.createOpsAccount(adminIdentity, {
      fullName: "Jamie Staff",
      email: "jamie.staff@example.com",
      phone: "555-0413",
      password: "StaffPass123!",
      internalScope: "operations"
    })
  );
  const backupAdminCreate = await withMockedNow("2026-06-24T09:05:00.000Z", () =>
    platform.createOpsAccount(adminIdentity, {
      fullName: "Taylor Admin",
      email: "taylor.admin@example.com",
      phone: "555-0414",
      password: "BackupAdmin123!",
      internalScope: "admin"
    })
  );
  await withMockedNow("2026-06-24T09:07:00.000Z", () =>
    platform.createOpsAccount(adminIdentity, {
      fullName: "Morgan Locked",
      email: "morgan.locked@example.com",
      phone: "555-0415",
      password: "LockedPass123!",
      internalScope: "operations"
    })
  );
  await withMockedNow("2026-06-24T09:08:00.000Z", () =>
    platform.createOpsAccount(adminIdentity, {
      fullName: "Riley Watch",
      email: "riley.watch@example.com",
      phone: "555-0416",
      password: "WatchPass123!",
      internalScope: "operations"
    })
  );
  await withMockedNow("2026-06-24T09:10:00.000Z", () =>
    platform.requestOpsAccountPasswordReset(adminIdentity, {
      opsUserId: staffCreate.account.profile.id
    })
  );
  await withMockedNow("2026-06-24T09:15:00.000Z", () =>
    platform.updateOpsAccount(adminIdentity, {
      opsUserId: staffCreate.account.profile.id,
      internalScope: "admin"
    })
  );
  await withMockedNow("2026-06-24T09:20:00.000Z", () =>
    platform.updateOpsAccountAccess(adminIdentity, {
      opsUserId: backupAdminCreate.account.profile.id,
      action: "deactivate",
      notes: "Seasonal coverage ended."
    })
  );
  const backupAdminIdentity = await platform.findAuthIdentityByEmail("taylor.admin@example.com");
  assert.ok(backupAdminIdentity);
  await withMockedNow("2026-06-24T09:22:00.000Z", () =>
    platform.recordFailedOpsAuthentication(backupAdminIdentity, "disabled-account")
  );
  const lockedIdentity = await platform.findAuthIdentityByEmail("morgan.locked@example.com");
  assert.ok(lockedIdentity);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await withMockedNow(`2026-06-24T09:${String(23 + attempt).padStart(2, "0")}:00.000Z`, () =>
      platform.recordFailedOpsAuthentication(lockedIdentity, "invalid-password")
    );
  }
  const watchIdentity = await platform.findAuthIdentityByEmail("riley.watch@example.com");
  assert.ok(watchIdentity);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await withMockedNow(`2026-06-24T09:${String(28 + attempt).padStart(2, "0")}:30.000Z`, () =>
      platform.recordFailedOpsAuthentication(watchIdentity, "invalid-password")
    );
  }
  await withMockedNow("2026-05-01T09:00:00.000Z", () =>
    platform.recordSuccessfulAuthentication(adminIdentity.userId, "password")
  );
  await withMockedNow("2026-06-24T09:25:00.000Z", () =>
    platform.recordSuccessfulAuthentication(staffCreate.account.profile.id, "password")
  );

  const overview = await withMockedNow("2026-06-24T09:31:00.000Z", () => platform.getObservabilityOverview());
  assert.equal(overview.totalOpsAccounts, 5);
  assert.equal(overview.activeOpsAdminAccounts, 2);
  assert.equal(overview.activeOpsStaffAccounts, 2);
  assert.equal(overview.disabledOpsAccounts, 1);
  assert.equal(overview.lockedOpsAccounts, 1);
  assert.equal(overview.dormantOpsAccounts, 1);
  assert.equal(overview.neverSignedInOpsAccounts, 2);
  assert.equal(overview.opsAccountsWithRecentFailures, 3);
  assert.equal(overview.pendingOpsPasswordResetInvites, 0);
  assert.equal(overview.opsAccessPolicy.roleModel, "admin-and-operations");
  assert.equal(overview.opsAccessPolicy.activeAdminAccountCount, 2);
  assert.equal(overview.opsAccessPolicy.hasRequiredAdminCoverage, true);
  assert.ok(
    overview.opsAccessPolicy.adminRequiredActions.some((action) => /deactivate/i.test(action))
  );
  assert.ok(
    overview.opsAccessPolicy.operationsAllowedActions.some((action) => /support/i.test(action))
  );
  assert.ok(
    overview.opsAccessPolicy.authenticationControls.some((control) => /dedicated ops identities/i.test(control))
  );
  assert.ok(
    overview.opsAccessPolicy.escalationTriggers.some((trigger) => /locked internal staff account/i.test(trigger))
  );
  assert.ok(
    overview.opsAccessPolicy.warnings.some((warning) => /locked internal accounts/i.test(warning))
  );
  assert.equal(overview.accessAlerts.length, 3);
  assert.ok(overview.recentOpsAuthenticationEvents.length >= 6);
  const lockEvent = overview.recentOpsAuthenticationEvents.find(
    (event) =>
      event.opsUserEmail === "morgan.locked@example.com" && event.kind === "temporary-lock-triggered"
  );
  assert.equal(lockEvent?.failedCount, 5);
  assert.equal(lockEvent?.lockExpiresAt, "2026-06-24T09:57:00.000Z");
  const watchFailureEvent = overview.recentOpsAuthenticationEvents.find(
    (event) =>
      event.opsUserEmail === "riley.watch@example.com" && event.kind === "sign-in-failed"
  );
  assert.equal(watchFailureEvent?.failedCount, 3);
  assert.equal(watchFailureEvent?.reason, "invalid-password");
  const resetRequestedEvent = overview.recentOpsAuthenticationEvents.find(
    (event) =>
      event.opsUserEmail === "jamie.staff@example.com" && event.kind === "password-reset-requested"
  );
  assert.equal(resetRequestedEvent?.recordedByName, "Casey Ops");
  const successfulSignInEvent = overview.recentOpsAuthenticationEvents.find(
    (event) =>
      event.opsUserEmail === "jamie.staff@example.com" && event.kind === "sign-in-succeeded"
  );
  assert.equal(successfulSignInEvent?.method, "password");
  assert.deepEqual(
    overview.accessAlerts.map((alert) => ({
      opsUserEmail: alert.opsUserEmail,
      severity: alert.severity,
      title: alert.title
    })),
    [
      {
        opsUserEmail: "morgan.locked@example.com",
        severity: "critical",
        title: "Internal staff login is temporarily locked"
      },
      {
        opsUserEmail: "riley.watch@example.com",
        severity: "warning",
        title: "Internal staff login is approaching lockout"
      },
      {
        opsUserEmail: "taylor.admin@example.com",
        severity: "warning",
        title: "Disabled internal account is still receiving login attempts"
      }
    ]
  );
  const deactivatedItem = overview.recentOpsAccessChanges.find(
    (item) => item.kind === "deactivated" && item.opsUserEmail === "taylor.admin@example.com"
  );
  assert.ok(deactivatedItem);
  assert.match(deactivatedItem.notes ?? "", /seasonal coverage ended/i);

  const promotedItem = overview.recentOpsAccessChanges.find(
    (item) => item.kind === "profile-updated" && item.opsUserEmail === "jamie.staff@example.com"
  );
  assert.equal(promotedItem?.internalScope, "admin");
  assert.equal(promotedItem?.changedByName, "Casey Ops");

  const resetItem = overview.recentOpsAccessChanges.find(
    (item) => item.kind === "password-reset-invited" && item.opsUserEmail === "jamie.staff@example.com"
  );
  assert.ok(resetItem);
  const latestSignIn = overview.recentOpsSignIns[0];
  assert.equal(latestSignIn?.opsUserEmail, "jamie.staff@example.com");
  assert.equal(latestSignIn?.method, "password");
  assert.equal(latestSignIn?.signedInAt, "2026-06-24T09:25:00.000Z");
  const latestFailedSignIn = overview.recentFailedOpsSignIns[0];
  assert.equal(latestFailedSignIn?.opsUserEmail, "riley.watch@example.com");
  assert.equal(latestFailedSignIn?.reason, "invalid-password");
  assert.equal(latestFailedSignIn?.failedCount, 3);
  assert.equal(latestFailedSignIn?.failedAt, "2026-06-24T09:30:30.000Z");
  const lockedFailedSignIn = overview.recentFailedOpsSignIns.find(
    (item) => item.opsUserEmail === "morgan.locked@example.com"
  );
  assert.equal(lockedFailedSignIn?.reason, "invalid-password");
  assert.equal(lockedFailedSignIn?.failedCount, 5);
  assert.equal(lockedFailedSignIn?.failedAt, "2026-06-24T09:27:00.000Z");
  const disabledFailedSignIn = overview.recentFailedOpsSignIns.find(
    (item) => item.opsUserEmail === "taylor.admin@example.com"
  );
  assert.equal(disabledFailedSignIn?.reason, "disabled-account");
});

test("observability overview includes backend-authored launch operations policy and live pressure warnings", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  await createLaunchOperationsPressureFixture(platform, repository, "policy");

  const overview = await platform.getObservabilityOverview();
  assert.equal(overview.launchOperationsPolicy.policyVersion, "launch-ops-v1");
  assert.equal(overview.launchOperationsPolicy.activePressureLevel, "watch");
  assert.ok(
    overview.launchOperationsPolicy.warnings.some((warning) => /active field exception/i.test(warning))
  );
  assert.ok(
    overview.launchOperationsPolicy.warnings.some((warning) => /ZIP-level supply|launch pocket/i.test(warning))
  );
  const launchPocket = overview.launchOperationsPolicy.coveragePockets.find(
    (pocket) => pocket.postalCode === "78704" && pocket.city === "Austin"
  );
  assert.ok(launchPocket);
  assert.equal(launchPocket?.activeExceptionCount, 1);
  assert.ok((launchPocket?.activeBookingCount ?? 0) >= 1);
  assert.ok(launchPocket?.supportedCategories.includes("lawn-mowing"));
  assert.notEqual(launchPocket?.pressureLevel, "normal");
  assert.match(launchPocket?.recommendedAction ?? "", /demand|monitor|supply/i);
  assert.ok(
    overview.launchOperationsPolicy.coverageActionRecommendations.some(
      (action) =>
        action.pocketKey === launchPocket?.pocketKey &&
        action.key === "recover-field-exception" &&
        action.owner === "support" &&
        action.priority === "high" &&
        action.relatedScenarioKeys.includes("service-quality")
    )
  );
  assert.ok(
    overview.launchOperationsPolicy.coverageActionRecommendations.some(
      (action) =>
        action.postalCode === "79843" &&
        action.key === "hold-demand" &&
        action.owner === "ops" &&
        action.priority === "urgent" &&
        action.relatedScenarioKeys.includes("coverage-limit")
    )
  );
  assert.deepEqual(
    overview.launchOperationsPolicy.scenarioRules.map((rule) => rule.key),
    [
      "coverage-limit",
      "low-supply",
      "weather-delay",
      "provider-no-show",
      "customer-no-show",
      "service-quality",
      "completed-dispute"
    ]
  );
  assert.equal(
    overview.launchOperationsPolicy.scenarioRules.find((rule) => rule.key === "completed-dispute")
      ?.recommendedInterventionAction,
    "complete-booking"
  );
  assert.ok(
    overview.launchOperationsPolicy.serviceQualityStandards.some((standard) =>
      /before\/after evidence/i.test(standard)
    )
  );
  assert.ok(
    overview.launchOperationsPolicy.interventionRules.some((rule) =>
      /Outcome-changing interventions/i.test(rule)
    )
  );
});

test("launch operations recommendations can become audited ops workflow tasks", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  await createLaunchOperationsPressureFixture(platform, repository, "tasks");
  const overview = await platform.getObservabilityOverview();
  const recommendation = overview.launchOperationsPolicy.coverageActionRecommendations.find(
    (action) => action.key === "hold-demand" && action.postalCode === "79843"
  );
  assert.ok(recommendation);
  const opsUser = (await repository.listOpsUsers())[0];
  assert.ok(opsUser);
  const opsActor = {
    userId: opsUser.id,
    email: opsUser.email,
    role: "ops" as const,
    sessionVersion: 1
  };

  const createdTask = await platform.createLaunchOperationsTask(opsActor, {
    recommendationKey: recommendation.key,
    pocketKey: recommendation.pocketKey,
    assignedToOpsUserId: opsUser.id,
    operatorNotes: "Coordinate supply check before expanding this pocket."
  });

  assert.equal(createdTask.created, true);
  assert.equal(createdTask.matchedRecommendation.key, recommendation.key);
  assert.equal(createdTask.task.recommendationKey, recommendation.key);
  assert.equal(createdTask.task.pocketKey, recommendation.pocketKey);
  assert.equal(createdTask.task.owner, "ops");
  assert.equal(createdTask.task.priority, "urgent");
  assert.equal(createdTask.task.status, "open");
  assert.equal(createdTask.task.assignedToOpsUserId, opsUser.id);
  assert.equal(createdTask.task.assignedToOpsEmail, opsUser.email);
  assert.match(createdTask.task.recommendationFingerprint, /^[a-f0-9]{64}$/);
  assert.deepEqual(createdTask.task.relatedScenarioKeys, recommendation.relatedScenarioKeys);
  assert.ok(new Date(createdTask.task.dueAtIso).getTime() > new Date(createdTask.task.createdAt).getTime());

  const dueSweep = await platform.notifyDueLaunchOperationsTasks(opsActor, {
    taskId: createdTask.task.id,
    asOfIso: new Date(new Date(createdTask.task.dueAtIso).getTime() + 60 * 1000).toISOString()
  });
  assert.equal(dueSweep.taskCount, 1);
  assert.equal(dueSweep.candidateNotificationCount, 1);
  assert.equal(dueSweep.sentNotificationCount, 1);
  assert.equal(dueSweep.items[0]?.notificationStatus, "sent");
  assert.equal(dueSweep.items[0]?.taskId, createdTask.task.id);
  assert.equal(dueSweep.items[0]?.recommendationKey, recommendation.key);
  const opsNotifications = await repository.listNotificationsByRecipient(opsUser.id);
  assert.ok(
    opsNotifications.some(
      (notification) =>
        notification.category === "support" &&
        notification.actionHref === "/ops" &&
        notification.body.includes(`Launch operations task: ${createdTask.task.id}`)
    )
  );

  const repeatedDueSweep = await platform.notifyDueLaunchOperationsTasks(opsActor, {
    taskId: createdTask.task.id,
    asOfIso: new Date(new Date(createdTask.task.dueAtIso).getTime() + 60 * 1000).toISOString()
  });
  assert.equal(repeatedDueSweep.sentNotificationCount, 0);
  assert.equal(repeatedDueSweep.alreadySentCount, 1);
  assert.equal(repeatedDueSweep.items[0]?.notificationStatus, "already-sent");

  const earlyEscalationSweep = await platform.escalateOverdueLaunchOperationsTasks(opsActor, {
    taskId: createdTask.task.id,
    asOfIso: new Date(new Date(createdTask.task.dueAtIso).getTime() + 60 * 60 * 1000).toISOString()
  });
  assert.equal(earlyEscalationSweep.taskCount, 1);
  assert.equal(earlyEscalationSweep.candidateEscalationCount, 1);
  assert.equal(earlyEscalationSweep.sentNotificationCount, 0);
  assert.equal(earlyEscalationSweep.items[0]?.escalationStatus, "not-overdue");
  assert.equal(earlyEscalationSweep.items[0]?.escalationThresholdHours, 2);

  const escalationSweep = await platform.escalateOverdueLaunchOperationsTasks(opsActor, {
    taskId: createdTask.task.id,
    asOfIso: new Date(new Date(createdTask.task.dueAtIso).getTime() + 3 * 60 * 60 * 1000).toISOString()
  });
  assert.equal(escalationSweep.taskCount, 1);
  assert.equal(escalationSweep.candidateEscalationCount, 1);
  assert.equal(escalationSweep.overdueEscalationCount, 1);
  assert.equal(escalationSweep.sentNotificationCount, 1);
  assert.equal(escalationSweep.items[0]?.escalationStatus, "sent");
  assert.equal(escalationSweep.items[0]?.taskId, createdTask.task.id);
  assert.equal(escalationSweep.items[0]?.recommendationKey, recommendation.key);
  assert.equal(escalationSweep.items[0]?.pocketKey, recommendation.pocketKey);
  assert.equal(escalationSweep.items[0]?.priority, "urgent");
  assert.equal(escalationSweep.items[0]?.owner, "ops");
  assert.equal(escalationSweep.items[0]?.taskStatus, "open");
  assert.equal(escalationSweep.items[0]?.dueAtIso, createdTask.task.dueAtIso);
  assert.ok((escalationSweep.items[0]?.overdueHours ?? 0) >= 3);
  const opsNotificationsAfterEscalation = await repository.listNotificationsByRecipient(opsUser.id);
  assert.ok(
    opsNotificationsAfterEscalation.some(
      (notification) =>
        notification.category === "support" &&
        notification.actionHref === "/ops" &&
        notification.body.includes(`Launch operations task escalation: ${createdTask.task.id}`)
    )
  );

  const repeatedEscalationSweep = await platform.escalateOverdueLaunchOperationsTasks(opsActor, {
    taskId: createdTask.task.id,
    asOfIso: new Date(new Date(createdTask.task.dueAtIso).getTime() + 3 * 60 * 60 * 1000).toISOString()
  });
  assert.equal(repeatedEscalationSweep.sentNotificationCount, 0);
  assert.equal(repeatedEscalationSweep.alreadySentCount, 1);
  assert.equal(repeatedEscalationSweep.items[0]?.escalationStatus, "already-sent");

  const duplicateTask = await platform.createLaunchOperationsTask(opsActor, {
    recommendationKey: recommendation.key,
    pocketKey: recommendation.pocketKey,
    operatorNotes: "Duplicate task should reuse the open workflow record."
  });
  assert.equal(duplicateTask.created, false);
  assert.equal(duplicateTask.task.id, createdTask.task.id);
  assert.equal(duplicateTask.task.recommendationKey, recommendation.key);

  const updatedTask = await platform.updateLaunchOperationsTask(opsActor, {
    taskId: createdTask.task.id,
    status: "completed",
    assignedToOpsUserId: null,
    completionNotes: "Paused demand and opened provider-success follow-up."
  });
  assert.equal(updatedTask.task.status, "completed");
  assert.equal(updatedTask.task.assignedToOpsUserId, undefined);
  assert.equal(updatedTask.task.assignedToOpsEmail, undefined);
  assert.equal(updatedTask.task.completedByOpsUserId, opsUser.id);
  assert.ok(updatedTask.task.completedAt);
  assert.match(updatedTask.task.completionNotes ?? "", /provider-success/);
  assert.equal(updatedTask.task.recommendationKey, recommendation.key);
  assert.equal(updatedTask.task.pocketKey, recommendation.pocketKey);

  const completedSweep = await platform.notifyDueLaunchOperationsTasks(opsActor, {
    taskId: createdTask.task.id,
    includeFuture: true
  });
  assert.equal(completedSweep.sentNotificationCount, 0);
  assert.equal(completedSweep.skippedNotificationCount, 1);
  assert.equal(completedSweep.items[0]?.notificationStatus, "completed");

  const completedEscalationSweep = await platform.escalateOverdueLaunchOperationsTasks(opsActor, {
    taskId: createdTask.task.id,
    asOfIso: new Date(new Date(createdTask.task.dueAtIso).getTime() + 3 * 60 * 60 * 1000).toISOString()
  });
  assert.equal(completedEscalationSweep.sentNotificationCount, 0);
  assert.equal(completedEscalationSweep.skippedEscalationCount, 1);
  assert.equal(completedEscalationSweep.items[0]?.escalationStatus, "completed");

  const taskList = await platform.listLaunchOperationsTasks();
  assert.equal(taskList.tasks.length, 1);
  assert.equal(taskList.tasks[0]?.id, createdTask.task.id);

  await assert.rejects(
    platform.createLaunchOperationsTask(
      {
        userId: "customer-actor",
        email: "customer@example.com",
        role: "customer",
        sessionVersion: 1
      },
      {
        recommendationKey: recommendation.key,
        pocketKey: recommendation.pocketKey
      }
    ),
    /Only operations can create launch operations tasks/
  );
  await assert.rejects(
    platform.escalateOverdueLaunchOperationsTasks(
      {
        userId: "customer-actor",
        email: "customer@example.com",
        role: "customer",
        sessionVersion: 1
      },
      { taskId: createdTask.task.id }
    ),
    /Only operations can escalate launch operations tasks/
  );
});

test("ops automation runner orchestrates due backend sweeps in dry-run mode", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const { customer } = await createLaunchOperationsPressureFixture(platform, repository, "automation");
  const overview = await platform.getObservabilityOverview();
  const recommendation = overview.launchOperationsPolicy.coverageActionRecommendations.find(
    (action) => action.key === "hold-demand" && action.postalCode === "79843"
  );
  assert.ok(recommendation);
  const opsUser = (await repository.listOpsUsers())[0];
  assert.ok(opsUser);
  const opsActor = {
    userId: opsUser.id,
    email: opsUser.email,
    role: "ops" as const,
    sessionVersion: 1
  };

  const createdTask = await platform.createLaunchOperationsTask(opsActor, {
    recommendationKey: recommendation.key,
    pocketKey: recommendation.pocketKey,
    assignedToOpsUserId: opsUser.id,
    operatorNotes: "Automation runner dry-run coverage."
  });
  const asOfIso = new Date(new Date(createdTask.task.dueAtIso).getTime() + 3 * 60 * 60 * 1000).toISOString();
  const staleSupportUpdatedAt = new Date(new Date(asOfIso).getTime() - 3 * 60 * 60 * 1000).toISOString();
  const activeExceptionBooking = (await repository.listBookings()).find((booking) => booking.activeExceptionType);
  assert.ok(activeExceptionBooking);
  const supportTicket = await platform.createSupportTicket(
    { userId: customer.id, role: "customer" },
    {
      bookingId: activeExceptionBooking.id,
      subject: "Automation should catch stale access issue",
      description: "Customer still needs a recovery update.",
      issueType: "service-quality"
    }
  );
  await repository.updateSupportTicket(supportTicket.id, {
    createdAt: staleSupportUpdatedAt,
    updatedAt: staleSupportUpdatedAt
  });
  const opsNotificationsBefore = await repository.listNotificationsByRecipient(opsUser.id);

  const automationRun = await platform.runDueOpsAutomation(opsActor, {
    sweepKeys: [
      "support-ticket-escalations",
      "launch-operations-task-notifications",
      "launch-operations-task-escalations"
    ],
    asOfIso,
    dryRun: true
  });

  assert.equal(automationRun.requestedSweepCount, 3);
  assert.match(automationRun.runId, /^[0-9a-f-]{36}$/);
  assert.deepEqual(automationRun.requestedSweepKeys, [
    "support-ticket-escalations",
    "launch-operations-task-notifications",
    "launch-operations-task-escalations"
  ]);
  assert.equal(automationRun.completedSweepCount, 3);
  assert.equal(automationRun.failedSweepCount, 0);
  assert.equal(automationRun.dryRun, true);
  assert.equal(automationRun.sentNotificationCount, 0);
  assert.equal(automationRun.items.map((item) => item.sweepKey).join(","), [
    "support-ticket-escalations",
    "launch-operations-task-notifications",
    "launch-operations-task-escalations"
  ].join(","));

  const supportSweep = automationRun.items.find((item) => item.sweepKey === "support-ticket-escalations");
  assert.equal(supportSweep?.status, "completed");
  assert.equal(supportSweep?.supportTicketEscalations?.dryRun, true);
  assert.ok(
    supportSweep?.supportTicketEscalations?.items.some(
      (item) => item.ticketId === supportTicket.id && item.escalationStatus === "dry-run"
    )
  );

  const taskNotificationSweep = automationRun.items.find(
    (item) => item.sweepKey === "launch-operations-task-notifications"
  );
  assert.equal(taskNotificationSweep?.launchOperationsTaskNotifications?.dryRun, true);
  assert.ok(
    taskNotificationSweep?.launchOperationsTaskNotifications?.items.some(
      (item) => item.taskId === createdTask.task.id && item.notificationStatus === "dry-run"
    )
  );

  const taskEscalationSweep = automationRun.items.find(
    (item) => item.sweepKey === "launch-operations-task-escalations"
  );
  assert.equal(taskEscalationSweep?.launchOperationsTaskEscalations?.dryRun, true);
  assert.ok(
    taskEscalationSweep?.launchOperationsTaskEscalations?.items.some(
      (item) => item.taskId === createdTask.task.id && item.escalationStatus === "dry-run"
    )
  );
  const opsNotificationsAfter = await repository.listNotificationsByRecipient(opsUser.id);
  assert.equal(opsNotificationsAfter.length, opsNotificationsBefore.length);

  const automationHistory = await platform.listOpsAutomationRuns();
  assert.equal(automationHistory.runs.length, 1);
  const savedRun = automationHistory.runs[0];
  assert.equal(savedRun?.id, automationRun.runId);
  assert.equal(savedRun?.runId, automationRun.runId);
  assert.equal(savedRun?.createdByOpsUserId, opsUser.id);
  assert.equal(savedRun?.createdByOpsEmail, opsUser.email);
  assert.deepEqual(savedRun?.requestedSweepKeys, automationRun.requestedSweepKeys);
  assert.equal(savedRun?.dryRun, true);
  assert.equal(savedRun?.requestedSweepCount, 3);
  assert.equal(savedRun?.completedSweepCount, 3);
  assert.equal(savedRun?.items.some((item) => item.sweepKey === "support-ticket-escalations"), true);

  await assert.rejects(
    platform.runDueOpsAutomation(
      {
        userId: "customer-actor",
        email: "customer@example.com",
        role: "customer",
        sessionVersion: 1
      },
      { dryRun: true }
    ),
    /Only operations can run ops automation sweeps/
  );
});

test("observability overview includes a public review response queue with urgency and drafts", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const analytics = new DataEngineeringLogger();
  const platform = new MarketplacePlatformService(repository, analytics);
  const seededProvider = (await repository.listProviders())[0];
  assert.ok(seededProvider);

  const customer = await platform.registerUser({
    fullName: "Casey Homeowner",
    email: "review-response@example.com",
    password: "Password123!",
    phone: "555-0301",
    role: "customer",
    propertyLabel: "Home",
    address: createAddress("15 Cedar Lane", 39.7532, -74.2221)
  });

  const nowIso = new Date().toISOString();
  const booking = await repository.createBooking({
    id: crypto.randomUUID(),
    customerId: customer.id,
    providerId: seededProvider.id,
    serviceAddress: customer.address,
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    status: "completed",
    requestedAt: nowIso,
    scheduledStartIso: nowIso,
    scheduledEndIso: futureIso(1),
    completedAt: nowIso,
    notes: "Completed booking for review queue test",
    totalCents: 6800
  });

  await repository.createReviewInvite({
    id: crypto.randomUUID(),
    bookingId: booking.id,
    customerId: customer.id,
    providerId: seededProvider.id,
    email: customer.email,
    status: "sent",
    channels: ["email"],
    scheduledSendIso: nowIso,
    sentAt: nowIso,
    expiresAtIso: futureIso(72),
    deepLinkPath: `/bookings/${booking.id}/review`
  });

  const review = await platform.createProviderReview(customer.id, {
    bookingId: booking.id,
    overallRating: 2,
    timelinessRating: 2,
    attentionToDetailRating: 2,
    reviewText: "The crew was late and left clippings behind, so the yard still looked rushed."
  });
  await repository.updateProviderReview(review.id, {
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
  });

  await repository.createSupportTicket({
    id: crypto.randomUUID(),
    bookingId: booking.id,
    requesterId: customer.id,
    subject: "Service follow-up",
    description: "Customer wants a follow-up on lateness and quality.",
    issueType: "service-quality",
    status: "open",
    createdAt: nowIso,
    updatedAt: nowIso
  });

  const overview = await platform.getObservabilityOverview();
  assert.equal(overview.pendingReviewResponses, 1);
  assert.equal(overview.urgentReviewResponses, 1);
  assert.equal(overview.watchReviewResponses, 0);
  assert.equal(overview.overdueReviewResponses, 1);

  const responseItem = overview.recentReviewResponses.find((item) => item.reviewId === review.id);
  assert.ok(responseItem);
  assert.equal(responseItem?.priority, "urgent");
  assert.equal(responseItem?.sentiment, "negative");
  assert.equal(responseItem?.isResponseOverdue, true);
  assert.ok(responseItem?.responseDueAt);
  assert.equal(responseItem?.supportFollowUpRecommended, true);
  assert.equal(responseItem?.providerName, seededProvider.companyName);
  assert.equal(responseItem?.category, "lawn-mowing");
  assert.ok(responseItem?.issueSignals.includes("timing"));
  assert.ok(responseItem?.issueSignals.includes("quality"));
  assert.match(responseItem?.recommendedAction ?? "", /reply publicly today/i);
  assert.ok(
    responseItem?.watchouts.some((watchout) => /open support ticket already exists/i.test(watchout))
  );
  assert.equal(responseItem?.publicReplyTemplate.key, "public-recovery");
  assert.match(responseItem?.publicReplyTemplate.body ?? "", /sorry/i);

  const updatedReview = await platform.updateReviewResponse({
    reviewId: review.id,
    responseStatus: "posted",
    responseHandledBy: "Casey Ops",
    responseNotes: "Posted publicly after checking the open support thread.",
    responseChannel: "shared-inbox",
    responseChannelMetadata: {
      mailboxName: "GreenRain Reviews",
      emailMessageId: "review_reply_msg_42",
      emailThreadId: "review_thread_42",
      threadUrl: "https://inbox.example.com/threads/review_thread_42",
      intakeNotes: ["Posted through the shared inbox workflow after the support queue was reviewed."]
    },
    externalResponseId: "review_reply_msg_42",
    publicResponseUrl: "https://reviews.example.com/replies/review_reply_msg_42",
    publicReplyBody:
      "Thank you for the candid feedback. We are sorry this lawn mowing visit missed the mark, and we are reviewing the details internally so the follow-up stays specific."
  });
  assert.equal(updatedReview.responseStatus, "posted");
  assert.equal(updatedReview.responseHandledBy, "Casey Ops");
  assert.equal(updatedReview.responseChannel, "shared-inbox");
  assert.equal(updatedReview.responseChannelMetadata?.mailboxName, "GreenRain Reviews");
  assert.equal(updatedReview.responseChannelMetadata?.emailThreadId, "review_thread_42");
  assert.equal(updatedReview.externalResponseId, "review_reply_msg_42");
  assert.equal(updatedReview.publicResponseUrl, "https://reviews.example.com/replies/review_reply_msg_42");
  assert.ok(updatedReview.responseHandledAt);

  const updatedOverview = await platform.getObservabilityOverview();
  assert.equal(updatedOverview.pendingReviewResponses, 0);
  assert.equal(updatedOverview.urgentReviewResponses, 0);
  assert.equal(updatedOverview.overdueReviewResponses, 0);
  const updatedResponseItem = updatedOverview.recentReviewResponses.find((item) => item.reviewId === review.id);
  assert.equal(updatedResponseItem?.responseStatus, "posted");
  assert.equal(updatedResponseItem?.responseChannel, "shared-inbox");
  assert.equal(updatedResponseItem?.responseChannelMetadata?.mailboxName, "GreenRain Reviews");
  assert.equal(
    updatedResponseItem?.responseChannelMetadata?.threadUrl,
    "https://inbox.example.com/threads/review_thread_42"
  );
  assert.equal(updatedResponseItem?.externalResponseId, "review_reply_msg_42");
  assert.equal(
    updatedResponseItem?.publicResponseUrl,
    "https://reviews.example.com/replies/review_reply_msg_42"
  );
  assert.match(updatedResponseItem?.recommendedAction ?? "", /already recorded/i);
});

test("observability overview includes inbound automation health for leads and review replies", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const analytics = new DataEngineeringLogger();
  const platform = new MarketplacePlatformService(repository, analytics);
  const seededProvider = (await repository.listProviders())[0];
  assert.ok(seededProvider);

  const previousLeadSecret = process.env.INBOUND_LEAD_WEBHOOK_SECRET;
  const previousReviewSecret = process.env.INBOUND_REVIEW_RESPONSE_WEBHOOK_SECRET;
  process.env.INBOUND_LEAD_WEBHOOK_SECRET = "lead-secret";
  process.env.INBOUND_REVIEW_RESPONSE_WEBHOOK_SECRET = "review-secret";

  try {
    const launchLead = await platform.createInboundEmailLaunchLead(
      {
        senderEmail: "alex@example.com",
        messageId: "<lead-msg-1>",
        threadId: "<lead-thread-1>",
        subject: "Need mowing in Barnegat",
        textBody: "Can someone help with mowing near Barnegat this week?"
      },
      "lead-secret"
    );

    await platform.createInboundGoogleBusinessProfileLead(
      {
        sourceReferenceId: "gbp-lead-1",
        customerName: "Jordan Neighbor",
        messageText: "Do you handle yard cleanup in Barnegat?",
        profileLocationName: "GreenRain Barnegat"
      },
      "lead-secret"
    );

    const customer = await platform.registerUser({
      fullName: "Review Automation Customer",
      email: "review-automation@example.com",
      password: "Password123!",
      phone: "555-0308",
      role: "customer",
      propertyLabel: "Home",
      address: createAddress("28 Cedar Lane", 39.7542, -74.2225)
    });

    const nowIso = new Date().toISOString();
    const booking = await repository.createBooking({
      id: crypto.randomUUID(),
      customerId: customer.id,
      providerId: seededProvider.id,
      serviceAddress: customer.address,
      servicePropertyId: customer.defaultPropertyId,
      category: "lawn-mowing",
      status: "completed",
      requestedAt: nowIso,
      scheduledStartIso: nowIso,
      scheduledEndIso: futureIso(1),
      completedAt: nowIso,
      notes: "Completed booking for inbound automation overview test",
      totalCents: 6400
    });

    await repository.createReviewInvite({
      id: crypto.randomUUID(),
      bookingId: booking.id,
      customerId: customer.id,
      providerId: seededProvider.id,
      email: customer.email,
      status: "sent",
      channels: ["email"],
      scheduledSendIso: nowIso,
      sentAt: nowIso,
      expiresAtIso: futureIso(72),
      deepLinkPath: `/bookings/${booking.id}/review`
    });

    const review = await platform.createProviderReview(customer.id, {
      bookingId: booking.id,
      overallRating: 4,
      timelinessRating: 4,
      attentionToDetailRating: 4,
      reviewText: "Good visit overall."
    });

    await platform.createInboundSharedInboxReviewResponse(
      {
        reviewId: review.id,
        messageId: "<review-reply-1>",
        threadId: "<review-thread-1>",
        mailboxName: "GreenRain Reviews",
        senderEmail: "reviews@greenrain.example",
        publicResponseUrl: "https://reviews.example.com/replies/review-reply-1",
        publicReplyBody: "Thank you for the feedback. We appreciate the note and are following up directly."
      },
      "review-secret"
    );

    const overview = await platform.getObservabilityOverview();
    assert.ok(overview.inboundAutomationSourceMetrics.length >= 3);
    const directEmailMetric = overview.inboundAutomationSourceMetrics.find(
      (item) => item.sourceKey === "direct-email-lead"
    );
    assert.ok(directEmailMetric);
    assert.equal(directEmailMetric?.recentCount, 1);
    assert.equal(directEmailMetric?.openLeadCount, 1);
    assert.equal(directEmailMetric?.status, "healthy");

    const gbpLeadMetric = overview.inboundAutomationSourceMetrics.find(
      (item) => item.sourceKey === "google-business-profile-lead"
    );
    assert.ok(gbpLeadMetric);
    assert.equal(gbpLeadMetric?.recentCount, 1);

    const reviewMetric = overview.inboundAutomationSourceMetrics.find(
      (item) => item.sourceKey === "shared-inbox-review-response"
    );
    assert.ok(reviewMetric);
    assert.equal(reviewMetric?.recentCount, 1);

    assert.equal(overview.inboundAutomationAlerts.length, 0);
    assert.ok(
      overview.recentInboundAutomationActivity.some(
        (item) => item.kind === "launch-lead" && item.reference === launchLead.sourceReferenceId
      )
    );
    assert.ok(
      overview.recentInboundAutomationActivity.some(
        (item) => item.kind === "review-response" && item.reference === "review-reply-1"
      )
    );
  } finally {
    if (previousLeadSecret === undefined) {
      delete process.env.INBOUND_LEAD_WEBHOOK_SECRET;
    } else {
      process.env.INBOUND_LEAD_WEBHOOK_SECRET = previousLeadSecret;
    }

    if (previousReviewSecret === undefined) {
      delete process.env.INBOUND_REVIEW_RESPONSE_WEBHOOK_SECRET;
    } else {
      process.env.INBOUND_REVIEW_RESPONSE_WEBHOOK_SECRET = previousReviewSecret;
    }
  }
});

test("observability overview includes expected inbound automation sources before first traffic", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const analytics = new DataEngineeringLogger();
  const platform = new MarketplacePlatformService(repository, analytics);
  const previousExpectedSources = process.env.OPS_EXPECTED_INBOUND_AUTOMATION_SOURCES;
  process.env.OPS_EXPECTED_INBOUND_AUTOMATION_SOURCES =
    "direct-email-lead,shared-inbox-review-response";

  try {
    const overview = await platform.getObservabilityOverview();
    const directEmailMetric = overview.inboundAutomationSourceMetrics.find(
      (item) => item.sourceKey === "direct-email-lead"
    );
    const sharedInboxMetric = overview.inboundAutomationSourceMetrics.find(
      (item) => item.sourceKey === "shared-inbox-review-response"
    );

    assert.ok(directEmailMetric);
    assert.equal(directEmailMetric?.recentCount, 0);
    assert.equal(directEmailMetric?.status, "stale");
    assert.equal(directEmailMetric?.lastOccurredAt, undefined);

    assert.ok(sharedInboxMetric);
    assert.equal(sharedInboxMetric?.recentCount, 0);
    assert.equal(sharedInboxMetric?.status, "stale");

    assert.ok(
      overview.inboundAutomationAlerts.some(
        (item) =>
          item.sourceKey === "direct-email-lead" &&
          /No inbound activity has been recorded yet/i.test(item.detail)
      )
    );
    assert.ok(
      overview.inboundAutomationAlerts.some(
        (item) => item.sourceKey === "shared-inbox-review-response"
      )
    );
  } finally {
    if (previousExpectedSources === undefined) {
      delete process.env.OPS_EXPECTED_INBOUND_AUTOMATION_SOURCES;
    } else {
      process.env.OPS_EXPECTED_INBOUND_AUTOMATION_SOURCES = previousExpectedSources;
    }
  }
});

test("review escalation opens a service-quality follow-up and links it back into the review queue", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const analytics = new DataEngineeringLogger();
  const platform = new MarketplacePlatformService(repository, analytics);
  const seededProvider = (await repository.listProviders())[0];
  assert.ok(seededProvider);

  const customer = await platform.registerUser({
    fullName: "Taylor Homeowner",
    email: "review-escalation@example.com",
    password: "Password123!",
    phone: "555-0311",
    role: "customer",
    propertyLabel: "Home",
    address: createAddress("18 Maple Court", 39.7542, -74.2231)
  });

  const nowIso = new Date().toISOString();
  const booking = await repository.createBooking({
    id: crypto.randomUUID(),
    customerId: customer.id,
    providerId: seededProvider.id,
    serviceAddress: customer.address,
    servicePropertyId: customer.defaultPropertyId,
    category: "yard-cleanup",
    status: "completed",
    requestedAt: nowIso,
    scheduledStartIso: nowIso,
    scheduledEndIso: futureIso(1),
    completedAt: nowIso,
    notes: "Completed booking for review escalation test",
    totalCents: 8400
  });

  await repository.createReviewInvite({
    id: crypto.randomUUID(),
    bookingId: booking.id,
    customerId: customer.id,
    providerId: seededProvider.id,
    email: customer.email,
    status: "sent",
    channels: ["email"],
    scheduledSendIso: nowIso,
    sentAt: nowIso,
    expiresAtIso: futureIso(72),
    deepLinkPath: `/bookings/${booking.id}/review`
  });

  const review = await platform.createProviderReview(customer.id, {
    bookingId: booking.id,
    overallRating: 2,
    timelinessRating: 4,
    attentionToDetailRating: 2,
    reviewText: "Cleanup missed a lot of debris around the side yard and the finish felt rushed."
  });

  const initialOverview = await platform.getObservabilityOverview();
  const initialItem = initialOverview.recentReviewResponses.find((item) => item.reviewId === review.id);
  assert.equal(initialItem?.supportFollowUpRecommended, true);
  assert.equal(initialItem?.supportTicketId, undefined);

  const escalated = await platform.escalateReviewForSupport({
    reviewId: review.id,
    escalatedBy: "Casey Ops",
    escalationNotes: "Customer needs direct recovery follow-up on missed cleanup details before we close the loop publicly."
  });

  assert.equal(escalated.supportFollowUpRecommended, false);
  assert.ok(escalated.supportTicketId);
  assert.equal(escalated.supportTicketStatus, "open");
  assert.match(escalated.supportTicketSubject ?? "", /review escalation/i);
  assert.equal(escalated.escalatedBy, "Casey Ops");
  assert.match(escalated.escalationNotes ?? "", /recovery follow-up/i);

  const supportTickets = await repository.listSupportTickets();
  assert.equal(supportTickets.length, 1);
  assert.equal(supportTickets[0]?.issueType, "service-quality");
  assert.equal(supportTickets[0]?.bookingId, booking.id);
  assert.match(supportTickets[0]?.description ?? "", /missed cleanup details/i);

  const updatedOverview = await platform.getObservabilityOverview();
  const updatedItem = updatedOverview.recentReviewResponses.find((item) => item.reviewId === review.id);
  assert.equal(updatedItem?.supportTicketId, escalated.supportTicketId);
  assert.equal(updatedItem?.supportTicketStatus, "open");
  assert.ok(
    updatedItem?.watchouts.some((watchout) => /linked support follow-up is already open/i.test(watchout))
  );
  assert.match(updatedItem?.recommendedAction ?? "", /linked support follow-up/i);
});

test("recommendation telemetry tracks views, alternatives, accepted recommendations, and swaps", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const analytics = new DataEngineeringLogger();
  const platform = new MarketplacePlatformService(repository, analytics);
  const launchAttribution = {
    source: "google",
    medium: "cpc",
    campaign: "barnegat-launch",
    referrerHost: "www.google.com",
    landingPath: "/barnegat-nj/lawn-mowing",
    capturedAt: "2026-06-17T12:00:00.000Z"
  };

  const [recommendedSeedProvider, alternateSeedProvider] = (await repository.listProviders()).slice(0, 2);
  assert.ok(recommendedSeedProvider);
  assert.ok(alternateSeedProvider);

  await repository.updateProvider(recommendedSeedProvider.id, {
    companyName: "Recommended Route Lawn",
    address: createAddress("113 Garden Row", 30.24355, -97.76385),
    serviceRadiusMiles: 20,
    categories: ["lawn-mowing"],
    rating: 4.9,
    timelinessRating: 4.9,
    attentionToDetailRating: 4.9,
    reviewCount: 240,
    yearsExperience: 12,
    verificationStatus: "verified"
  });

  await repository.updateProvider(alternateSeedProvider.id, {
    companyName: "Alternate Route Lawn",
    address: createAddress("114 Garden Row", 30.24365, -97.76395),
    serviceRadiusMiles: 20,
    categories: ["lawn-mowing"],
    rating: 4.7,
    timelinessRating: 4.7,
    attentionToDetailRating: 4.7,
    reviewCount: 160,
    yearsExperience: 10,
    verificationStatus: "verified"
  });

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-recommendation-telemetry@example.com",
    password: "Password123!",
    phone: "555-0260",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638)
  });

  const results = await platform.searchProviders({
    address: createAddress("112 Garden Row", 30.2435, -97.7638),
    categories: ["lawn-mowing"],
    dateIso: new Date().toISOString(),
    estimatedDurationMinutes: 60,
    requestSource: "customer-web-dashboard",
    attribution: launchAttribution
  });

  await platform.searchProviders({
    address: createAddress("112 Garden Row", 30.2435, -97.7638),
    categories: ["lawn-mowing"],
    dateIso: new Date().toISOString(),
    estimatedDurationMinutes: 60,
    requestSource: "public-web-listings"
  });

  await platform.searchProviders({
    address: createAddress("7000 Hill Country Way", 31.2435, -98.7638),
    categories: ["lawn-mowing"],
    dateIso: new Date().toISOString(),
    estimatedDurationMinutes: 60,
    requestSource: "customer-mobile-book"
  });

  await repository.updateProvider(recommendedSeedProvider.id, {
    serviceRadiusMiles: 0.1
  });
  await repository.updateProvider(alternateSeedProvider.id, {
    serviceRadiusMiles: 0.1
  });

  const noWindowCustomer = await platform.registerUser({
    fullName: "Taylor Reed",
    email: "customer-no-window-telemetry@example.com",
    password: "Password123!",
    phone: "555-0261",
    role: "customer",
    propertyLabel: "Far property",
    address: createAddress("900 Remote Road", 36.1627, -86.7816)
  });

  const noWindowProvider = await platform.registerUser({
    fullName: "No Window Owner",
    email: "provider-no-window@example.com",
    password: "Password123!",
    phone: "555-0262",
    role: "provider",
    companyName: "No Window Lawn",
    categories: ["lawn-mowing"],
    serviceRadiusMiles: 25,
    address: createAddress("901 Route Base", 36.1629, -86.7818)
  });

  await repository.updateProvider(noWindowProvider.id, {
    rating: 4.8,
    timelinessRating: 4.8,
    attentionToDetailRating: 4.8,
    reviewCount: 50,
    yearsExperience: 10,
    verificationStatus: "verified"
  });

  await platform.searchProviders({
    address: noWindowCustomer.address,
    categories: ["lawn-mowing"],
    dateIso: new Date().toISOString(),
    estimatedDurationMinutes: 60,
    requestSource: "customer-mobile-book"
  });

  assert.ok(results.recommendationSessionId);
  assert.equal(results.recommendedProviderId, results.rankedProviders[0]?.provider.id);
  assert.ok(results.rankedProviders.length >= 2);

  platform.createAnalyticsEvent({
    id: crypto.randomUUID(),
    name: MarketplaceTelemetryEventCatalog.recommendationAlternativesViewed,
    actorId: customer.id,
    occurredAt: new Date().toISOString(),
    properties: {
      recommendationSessionId: results.recommendationSessionId,
      recommendedProviderId: results.recommendedProviderId ?? "none",
      requestSource: "customer-web-dashboard"
    }
  });

  platform.createAnalyticsEvent({
    id: crypto.randomUUID(),
    name: MarketplaceTelemetryEventCatalog.recommendationDismissed,
    actorId: customer.id,
    occurredAt: new Date().toISOString(),
    properties: {
      recommendationSessionId: results.recommendationSessionId,
      recommendedProviderId: results.recommendedProviderId ?? "none",
      requestSource: "customer-web-dashboard"
    }
  });

  const recommendedResult = results.rankedProviders[0]!;
  const alternateResult = results.rankedProviders[1]!;

  await platform.createBooking(customer.id, {
    providerId: recommendedResult.provider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: recommendedResult.suggestedSlot?.startIso ?? futureIso(72),
    scheduledEndIso: recommendedResult.suggestedSlot?.endIso ?? futureIso(73),
    notes: "Recommended booking",
    totalCents: 6200,
    recommendationSessionId: results.recommendationSessionId,
    recommendedProviderId: results.recommendedProviderId,
    selectedProviderRank: 1,
    viewedAlternativeProviders: false,
    recommendationSource: "customer-web-dashboard",
    attribution: launchAttribution
  });

  await platform.createBooking(customer.id, {
    providerId: alternateResult.provider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: alternateResult.suggestedSlot?.startIso ?? futureIso(96),
    scheduledEndIso: alternateResult.suggestedSlot?.endIso ?? futureIso(97),
    notes: "Swapped to alternate provider",
    totalCents: 6200,
    recommendationSessionId: results.recommendationSessionId,
    recommendedProviderId: results.recommendedProviderId,
    selectedProviderRank: 2,
    viewedAlternativeProviders: true,
    recommendationSource: "customer-web-dashboard",
    attribution: launchAttribution
  });

  const overview = analytics.getOverview({
    bookings: await repository.listBookings(),
    launchLeads: await repository.listLaunchLeads(),
    reviewInvites: await repository.listReviewInvites(),
    supportTickets: await repository.listSupportTickets()
  });

  assert.equal(overview.recommendationViews, 3);
  assert.equal(overview.providerSearches, 4);
  assert.equal(overview.providerSearchesNoResults, 1);
  assert.equal(overview.providerSearchesNoOpenWindows, 1);
  assert.equal(overview.providerSearchCoverageRate, 0.75);
  assert.equal(overview.providerSearchOpenWindowRate, 0.5);
  assert.equal(overview.recommendationAlternativesViewed, 1);
  assert.equal(overview.recommendationAlternativeRevealRate, 1 / 3);
  assert.equal(overview.recommendationDismissals, 1);
  assert.equal(overview.recommendationDismissalRate, 1 / 3);
  assert.equal(overview.recommendationBookingIntents, 2);
  assert.equal(overview.recommendationBookingIntentRate, 1 / 3);
  assert.equal(overview.acceptedRecommendations, 1);
  assert.equal(overview.swappedRecommendations, 1);
  assert.equal(overview.recommendationAcceptanceRate, 1 / 3);
  assert.equal(overview.recommendationSwapRate, 1 / 3);
  assert.equal(overview.recommendationMetricsBySource.length, 3);
  const dashboardMetrics = overview.recommendationMetricsBySource.find(
    (metric) => metric.requestSource === "customer-web-dashboard"
  );
  const publicMetrics = overview.recommendationMetricsBySource.find(
    (metric) => metric.requestSource === "public-web-listings"
  );
  const mobileMetrics = overview.recommendationMetricsBySource.find(
    (metric) => metric.requestSource === "customer-mobile-book"
  );
  assert.ok(dashboardMetrics);
  assert.equal(dashboardMetrics?.providerSearches, 1);
  assert.equal(dashboardMetrics?.providerSearchesNoResults, 0);
  assert.equal(dashboardMetrics?.providerSearchesNoOpenWindows, 0);
  assert.equal(dashboardMetrics?.providerSearchCoverageRate, 1);
  assert.equal(dashboardMetrics?.providerSearchOpenWindowRate, 1);
  assert.equal(dashboardMetrics?.recommendationViews, 1);
  assert.equal(dashboardMetrics?.recommendationAlternativesViewed, 1);
  assert.equal(dashboardMetrics?.recommendationAlternativeRevealRate, 1);
  assert.equal(dashboardMetrics?.recommendationDismissals, 1);
  assert.equal(dashboardMetrics?.recommendationDismissalRate, 1);
  assert.equal(dashboardMetrics?.recommendationBookingIntents, 2);
  assert.equal(dashboardMetrics?.recommendationBookingIntentRate, 1);
  assert.equal(dashboardMetrics?.acceptedRecommendations, 1);
  assert.equal(dashboardMetrics?.swappedRecommendations, 1);
  assert.equal(dashboardMetrics?.recommendationAcceptanceRate, 1);
  assert.equal(dashboardMetrics?.recommendationSwapRate, 1);
  assert.ok(publicMetrics);
  assert.equal(publicMetrics?.providerSearches, 1);
  assert.equal(publicMetrics?.providerSearchCoverageRate, 1);
  assert.equal(publicMetrics?.providerSearchOpenWindowRate, 1);
  assert.equal(publicMetrics?.recommendationViews, 1);
  assert.equal(publicMetrics?.recommendationBookingIntentRate, 0);
  assert.equal(publicMetrics?.recommendationDismissals, 0);
  assert.equal(publicMetrics?.acceptedRecommendations, 0);
  assert.ok(mobileMetrics);
  assert.equal(mobileMetrics?.providerSearches, 2);
  assert.equal(mobileMetrics?.providerSearchesNoResults, 1);
  assert.equal(mobileMetrics?.providerSearchesNoOpenWindows, 1);
  assert.equal(mobileMetrics?.providerSearchCoverageRate, 0.5);
  assert.equal(mobileMetrics?.providerSearchOpenWindowRate, 0);
  assert.equal(mobileMetrics?.recommendationViews, 1);
  assert.equal(mobileMetrics?.recommendationAcceptanceRate, 0);
  assert.equal(mobileMetrics?.recommendationBookingIntentRate, 0);

  const searchEvent = analytics
    .listEvents()
    .find(
      (event) =>
        event.name === MarketplaceTelemetryEventCatalog.providerSearchPerformed &&
        event.properties.requestSource === "customer-web-dashboard"
    );
  assert.equal(searchEvent?.properties.attributionSource, "google");
  assert.equal(searchEvent?.properties.attributionMedium, "cpc");
  assert.equal(searchEvent?.properties.attributionCampaign, "barnegat-launch");
  assert.equal(searchEvent?.properties.attributionReferrerHost, "www.google.com");
  assert.equal(searchEvent?.properties.attributionLandingPath, "/barnegat-nj/lawn-mowing");

  const bookingRequestedEvent = analytics
    .listEvents()
    .find(
      (event) =>
        event.name === MarketplaceTelemetryEventCatalog.bookingRequested &&
        event.properties.recommendationSource === undefined &&
        event.properties.attributionSource === "google"
    );
  assert.ok(bookingRequestedEvent);

  const acceptedRecommendationEvent = analytics
    .listEvents()
    .find((event) => event.name === MarketplaceTelemetryEventCatalog.recommendationAccepted);
  assert.equal(acceptedRecommendationEvent?.properties.attributionSource, "google");
  assert.equal(acceptedRecommendationEvent?.properties.attributionLandingPath, "/barnegat-nj/lawn-mowing");
});

test("observability overview includes backend-authored recommendation insights by surface", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const analytics = new DataEngineeringLogger();
  const platform = new MarketplacePlatformService(repository, analytics);
  const occurredAt = new Date().toISOString();

  const recordRecommendationEvent = (
    name: string,
    recommendationSessionId: string,
    requestSource: string
  ) => {
    platform.createAnalyticsEvent({
      id: crypto.randomUUID(),
      name,
      actorId: `actor-${recommendationSessionId}`,
      occurredAt,
      properties: {
        recommendationSessionId,
        requestSource
      }
    });
  };

  for (const sessionId of ["public-1", "public-2"]) {
    recordRecommendationEvent(MarketplaceTelemetryEventCatalog.providerSearchPerformed, sessionId, "public-web-listings");
    recordRecommendationEvent(MarketplaceTelemetryEventCatalog.recommendationPresented, sessionId, "public-web-listings");
    recordRecommendationEvent(
      MarketplaceTelemetryEventCatalog.recommendationBookingIntent,
      sessionId,
      "public-web-listings"
    );
    recordRecommendationEvent(MarketplaceTelemetryEventCatalog.recommendationAccepted, sessionId, "public-web-listings");
  }

  for (const sessionId of ["dashboard-1", "dashboard-2"]) {
    recordRecommendationEvent(
      MarketplaceTelemetryEventCatalog.providerSearchPerformed,
      sessionId,
      "customer-web-dashboard"
    );
    recordRecommendationEvent(
      MarketplaceTelemetryEventCatalog.recommendationPresented,
      sessionId,
      "customer-web-dashboard"
    );
    recordRecommendationEvent(
      MarketplaceTelemetryEventCatalog.recommendationDismissed,
      sessionId,
      "customer-web-dashboard"
    );
  }
  recordRecommendationEvent(
    MarketplaceTelemetryEventCatalog.recommendationAlternativesViewed,
    "dashboard-1",
    "customer-web-dashboard"
  );
  recordRecommendationEvent(
    MarketplaceTelemetryEventCatalog.recommendationSwapped,
    "dashboard-1",
    "customer-web-dashboard"
  );

  for (const sessionId of ["mobile-1", "mobile-2"]) {
    recordRecommendationEvent(
      MarketplaceTelemetryEventCatalog.providerSearchPerformed,
      sessionId,
      "customer-mobile-book"
    );
    recordRecommendationEvent(
      MarketplaceTelemetryEventCatalog.providerSearchNoOpenWindows,
      sessionId,
      "customer-mobile-book"
    );
  }

  const overview = await platform.getObservabilityOverview();

  assert.equal(overview.recommendationViews, 4);
  assert.equal(overview.recommendationBookingIntents, 2);
  assert.equal(overview.acceptedRecommendations, 2);
  assert.equal(overview.swappedRecommendations, 1);

  const volumeInsight = overview.recommendationInsights.find((insight) => insight.kind === "volume");
  assert.equal(volumeInsight?.status, "needs-volume");
  assert.equal(volumeInsight?.recommendationViews, 4);
  assert.equal(volumeInsight?.recommendationBookingIntents, 2);
  assert.match(volumeInsight?.recommendedAction ?? "", /10 views and 3 booking intents/i);

  const coverageInsight = overview.recommendationInsights.find((insight) => insight.kind === "coverage");
  assert.equal(coverageInsight?.requestSource, "customer-mobile-book");
  assert.equal(coverageInsight?.status, "watch");
  assert.equal(coverageInsight?.providerSearches, 2);
  assert.equal(coverageInsight?.rate, 0);
  assert.match(coverageInsight?.recommendedAction ?? "", /ZIP\/category supply/i);

  const handoffInsight = overview.recommendationInsights.find((insight) => insight.kind === "handoff");
  assert.equal(handoffInsight?.requestSource, "customer-web-dashboard");
  assert.equal(handoffInsight?.status, "watch");
  assert.equal(handoffInsight?.recommendationViews, 2);
  assert.equal(handoffInsight?.recommendationBookingIntents, 0);
  assert.equal(handoffInsight?.swappedRecommendations, 1);
  assert.match(handoffInsight?.detail ?? "", /2 dismissals/i);

  const surfaceInsight = overview.recommendationInsights.find((insight) => insight.kind === "surface");
  assert.equal(surfaceInsight?.requestSource, "public-web-listings");
  assert.equal(surfaceInsight?.status, "working");
  assert.equal(surfaceInsight?.acceptedRecommendations, 2);
  assert.equal(surfaceInsight?.rate, 1);
  assert.match(surfaceInsight?.title ?? "", /strongest recommendation surface/i);
});

test("launch leads capture attribution and require owners, follow-up dates, and closed outcomes", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const analytics = new DataEngineeringLogger();
  const platform = new MarketplacePlatformService(repository, analytics);

  const lead = await platform.createLaunchLead({
    requestSource: "launch-town-page-lead-form",
    attribution: {
      source: "google",
      medium: "organic",
      campaign: "barnegat-launch",
      landingPath: "/barnegat-nj",
      capturedAt: "2026-06-17T10:00:00.000Z"
    },
    contactName: "Jamie Homeowner",
    email: "jamie@example.com",
    phone: "(555) 210-0000",
    preferredContactMethod: "text",
    areaLabel: "Barnegat, NJ",
    serviceCategory: "lawn-mowing",
    message: "Need help figuring out whether weekly mowing is available next week."
  });

  assert.equal(lead.status, "new");
  assert.ok(lead.firstResponseDueAt);
  assert.equal(lead.sourceChannel, "website");

  const capturedEvent = analytics
    .listEvents()
    .find((event) => event.name === MarketplaceTelemetryEventCatalog.launchLeadCaptured);
  assert.ok(capturedEvent);
  assert.equal(capturedEvent?.properties.attributionSource, "google");
  assert.equal(capturedEvent?.properties.attributionMedium, "organic");
  assert.equal(capturedEvent?.properties.requestSource, "launch-town-page-lead-form");
  assert.equal(capturedEvent?.properties.hasPhone, true);
  assert.equal("email" in (capturedEvent?.properties ?? {}), false);

  await assert.rejects(
    platform.updateLaunchLeadForOps({
      leadId: lead.id,
      status: "contacted",
      nextFollowUpDueAt: futureIso(24)
    }),
    /assign an owner/i
  );

  await assert.rejects(
    platform.updateLaunchLeadForOps({
      leadId: lead.id,
      status: "contacted",
      assignedOwner: "Casey Ops"
    }),
    /next follow-up/i
  );

  const contacted = await platform.updateLaunchLeadForOps({
    leadId: lead.id,
    status: "contacted",
    assignedOwner: "Casey Ops",
    nextFollowUpDueAt: futureIso(24)
  });
  assert.equal(contacted.assignedOwner, "Casey Ops");
  assert.ok(contacted.firstRespondedAt);
  assert.ok(contacted.lastContactedAt);

  const contactedEvent = analytics
    .listEvents()
    .find((event) => event.name === MarketplaceTelemetryEventCatalog.launchLeadContacted);
  assert.ok(contactedEvent);
  assert.equal(contactedEvent?.properties.hasAssignedOwner, true);

  await assert.rejects(
    platform.updateLaunchLeadForOps({
      leadId: lead.id,
      status: "closed-lost",
      assignedOwner: "Casey Ops",
      lossReason: "no-response"
    }),
    /outcome summary/i
  );

  const closed = await platform.updateLaunchLeadForOps({
    leadId: lead.id,
    status: "closed-lost",
    assignedOwner: "Casey Ops",
    lossReason: "no-response",
    outcomeSummary: "Three follow-ups across text and email with no reply."
  });
  assert.equal(closed.status, "closed-lost");
  assert.equal(closed.lossReason, "no-response");
  assert.ok(closed.closedAt);

  const queue = await platform.listOpsLaunchLeads();
  assert.equal(queue[0]?.lead.id, lead.id);
  assert.equal(queue[0]?.isFirstResponseOverdue, false);
  assert.equal(queue[0]?.isFollowUpOverdue, false);

  const closedEvent = analytics
    .listEvents()
    .find((event) => event.name === MarketplaceTelemetryEventCatalog.launchLeadClosed);
  assert.ok(closedEvent);
  assert.equal(closedEvent?.properties.lossReason, "no-response");
});

test("launch leads can be captured from phone-first customer service requests without an email address", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const analytics = new DataEngineeringLogger();
  const platform = new MarketplacePlatformService(repository, analytics);

  const lead = await platform.createLaunchLead({
    sourceChannel: "phone",
    requestSource: "customer-service-help-request",
    contactName: "Taylor Caller",
    phone: "555-111-2222",
    preferredContactMethod: "phone",
    areaLabel: "Barnegat, NJ",
    message: "Called in asking whether GreenRain can handle a cleanup before guests arrive.",
    assignedOwner: "Casey Ops"
  });

  assert.equal(lead.email, undefined);
  assert.ok(lead.phone);
  assert.equal(lead.assignedOwner, "Casey Ops");
  assert.equal(lead.sourceChannel, "phone");

  const capturedEvent = analytics
    .listEvents()
    .find((event) => event.name === MarketplaceTelemetryEventCatalog.launchLeadCaptured);
  assert.ok(capturedEvent);
  assert.equal(capturedEvent?.properties.hasEmail, false);
  assert.equal(capturedEvent?.properties.hasPhone, true);
  assert.equal(capturedEvent?.properties.hasAssignedOwner, true);
  assert.equal(capturedEvent?.properties.sourceChannel, "phone");
});

test("ops launch lead guidance preserves inbound intake notes for inferred email details", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const analytics = new DataEngineeringLogger();
  const platform = new MarketplacePlatformService(repository, analytics);
  const originalSecret = process.env.INBOUND_LEAD_WEBHOOK_SECRET;

  process.env.INBOUND_LEAD_WEBHOOK_SECRET = "launch-webhook-secret";

  try {
    const lead = await platform.createInboundEmailLaunchLead(
      {
        sourceReferenceId: "email_ops_123",
        senderEmail: "jamie.homeowner@example.com",
        subject: "Need help with mulch",
        textBody: "Please call me at 609-555-0101 about mulch refresh in Barnegat before the weekend."
      },
      "launch-webhook-secret"
    );

    assert.equal(lead.areaLabel, "Barnegat, NJ");
    assert.equal(lead.serviceCategory, "mulch-installation");
    assert.equal(lead.phone, "6095550101");
    assert.equal(lead.preferredContactMethod, "phone");

    const queue = await platform.listOpsLaunchLeads();
    const queuedLead = queue.find((item) => item.lead.id === lead.id);
    assert.ok(queuedLead);
    assert.ok(
      queuedLead?.lead.channelMetadata?.intakeNotes?.some((note) => /Area was inferred from the inbound message/i.test(note))
    );
    assert.ok(
      queuedLead?.lead.channelMetadata?.intakeNotes?.some((note) => /Service was inferred from the inbound message/i.test(note))
    );
    assert.ok(
      queuedLead?.responseGuidance.warnings.some((warning) =>
        /Follow-up preference was inferred from the inbound message as phone/i.test(warning)
      )
    );
  } finally {
    process.env.INBOUND_LEAD_WEBHOOK_SECRET = originalSecret;
  }
});

test("ops lead queue includes backend-authored response guidance and reply drafts", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const analytics = new DataEngineeringLogger();
  const platform = new MarketplacePlatformService(repository, analytics);

  const lead = await platform.createLaunchLead({
    sourceChannel: "email",
    requestSource: "customer-service-help-request",
    contactName: "Jamie Homeowner",
    email: "jamie@example.com",
    preferredContactMethod: "email",
    areaLabel: "Needs area confirmation",
    message: "I need help understanding whether GreenRain can help with service before I book."
  });

  const queue = await platform.listOpsLaunchLeads();
  const queuedLead = queue.find((item) => item.lead.id === lead.id);
  assert.ok(queuedLead);
  assert.match(queuedLead.responseGuidance.recommendedAction, /first email response/i);
  assert.ok(
    queuedLead.responseGuidance.warnings.some((warning) => /assign an owner/i.test(warning))
  );
  assert.ok(
    queuedLead.responseGuidance.warnings.some((warning) => /confirm the service area/i.test(warning))
  );
  assert.ok(
    queuedLead.responseGuidance.warnings.some((warning) => /keep the final resolution in support/i.test(warning))
  );
  assert.equal(queuedLead.responseGuidance.templates[0]?.key, "first-response-email");
  assert.ok(
    queuedLead.responseGuidance.templates.some((template) => template.key === "issue-help-follow-up")
  );
});

test("active category-qualified launch leads include provider outreach drafts", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const analytics = new DataEngineeringLogger();
  const platform = new MarketplacePlatformService(repository, analytics);

  const lead = await platform.createLaunchLead({
    sourceChannel: "website",
    requestSource: "launch-town-page-lead-form",
    contactName: "Morgan Homeowner",
    email: "morgan@example.com",
    preferredContactMethod: "email",
    areaLabel: "Barnegat, NJ",
    serviceCategory: "lawn-mowing",
    message: "Need weekly mowing and edging.",
    assignedOwner: "Casey Ops"
  });

  const queue = await platform.listOpsLaunchLeads();
  const queuedLead = queue.find((item) => item.lead.id === lead.id);
  assert.ok(queuedLead);

  const providerTemplate = queuedLead.responseGuidance.templates.find(
    (template) => template.key === "provider-outreach"
  );
  assert.ok(providerTemplate);
  assert.equal(providerTemplate.audience, "provider");
  assert.match(providerTemplate.subject ?? "", /availability check/i);
  assert.match(providerTemplate.reason, /live capacity confirmation/i);
  assert.match(providerTemplate.body, /\[Provider name\]/i);

  const backupTemplate = queuedLead.responseGuidance.templates.find(
    (template) => template.key === "provider-backup-outreach"
  );
  assert.ok(backupTemplate);
  assert.equal(backupTemplate.audience, "provider");
  assert.match(backupTemplate.reason, /recommendation-first/i);
  assert.match(backupTemplate.body, /backup coverage/i);
  assert.match(backupTemplate.body, /payout constraint/i);

  const pilotTemplate = queuedLead.responseGuidance.templates.find(
    (template) => template.key === "provider-pilot-readiness"
  );
  assert.ok(pilotTemplate);
  assert.equal(pilotTemplate.audience, "provider");
  assert.match(pilotTemplate.reason, /newer or narrow-launch provider/i);
  assert.match(pilotTemplate.body, /before\/after proof/i);
});

test("converted completed launch leads surface review-request drafts instead of new-lead scripts", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const analytics = new DataEngineeringLogger();
  const platform = new MarketplacePlatformService(repository, analytics);

  const customer = await platform.registerUser({
    fullName: "Jamie Homeowner",
    email: "jamie-review@example.com",
    password: "Password123!",
    phone: "555-9922",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress()
  });
  const providers = await repository.listProviders();
  const provider = providers[0];
  assert.ok(provider);

  const lead = await platform.createLaunchLead({
    sourceChannel: "email",
    requestSource: "launch-town-page-lead-form",
    contactName: "Jamie Homeowner",
    email: customer.email,
    preferredContactMethod: "email",
    areaLabel: "Barnegat, NJ",
    serviceCategory: "lawn-mowing",
    message: "I want to get mowing started this week.",
    assignedOwner: "Casey Ops"
  });

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    launchLeadId: lead.id,
    serviceAddress: createAddress(),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    scheduledEndIso: new Date(Date.now() + 49 * 60 * 60 * 1000).toISOString(),
    notes: "Please mow and edge.",
    totalCents: 6200
  });

  await platform.confirmBooking(provider.id, { bookingId: booking.id });
  await attachEvidence(
    platform,
    { userId: provider.id, email: provider.email, role: "provider" },
    booking.id,
    "after"
  );
  await platform.completeBooking(provider.id, { bookingId: booking.id });

  const queue = await platform.listOpsLaunchLeads();
  const queuedLead = queue.find((item) => item.lead.id === lead.id);
  assert.ok(queuedLead);
  assert.match(queuedLead.responseGuidance.recommendedAction, /booking is already linked/i);
  assert.ok(
    queuedLead.responseGuidance.templates.some((template) => template.key === "booking-confirmation")
  );
  assert.ok(
    queuedLead.responseGuidance.templates.some((template) => template.key === "review-request")
  );
  assert.ok(
    queuedLead.responseGuidance.templates.every((template) => !template.key.startsWith("first-response"))
  );
});

test("closed-lost launch leads surface a closeout template instead of first-response drafts", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const analytics = new DataEngineeringLogger();
  const platform = new MarketplacePlatformService(repository, analytics);

  const lead = await platform.createLaunchLead({
    sourceChannel: "email",
    requestSource: "launch-town-page-lead-form",
    contactName: "Dana Homeowner",
    email: "dana@example.com",
    preferredContactMethod: "email",
    areaLabel: "Forked River, NJ",
    serviceCategory: "yard-cleanup",
    message: "Can you handle a cleanup by tomorrow morning?",
    assignedOwner: "Casey Ops"
  });

  await platform.updateLaunchLeadForOps({
    leadId: lead.id,
    status: "closed-lost",
    assignedOwner: "Casey Ops",
    lossReason: "timeline-mismatch",
    outcomeSummary: "Customer needed next-morning service outside our launch capacity."
  });

  const queue = await platform.listOpsLaunchLeads();
  const queuedLead = queue.find((item) => item.lead.id === lead.id);
  assert.ok(queuedLead);
  assert.match(queuedLead.responseGuidance.recommendedAction, /closed-lost/i);
  assert.equal(queuedLead.responseGuidance.templates[0]?.key, "closed-lost-follow-up");
  assert.ok(
    queuedLead.responseGuidance.templates.every((template) => !template.key.startsWith("first-response"))
  );
});

test("google business profile leads can use platform-message follow-up without direct contact details", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const analytics = new DataEngineeringLogger();
  const platform = new MarketplacePlatformService(repository, analytics);

  const lead = await platform.createLaunchLead({
    sourceChannel: "google-business-profile",
    requestSource: "google-business-profile-message",
    sourceReferenceId: "gbp_thread_789",
    channelMetadata: {
      threadUrl: "https://business.google.com/messages/thread/gbp_thread_789"
    },
    contactName: "Pat Homeowner",
    preferredContactMethod: "platform-message",
    areaLabel: "Needs area confirmation",
    serviceCategory: "lawn-mowing",
    message:
      "Google Business Profile message asking whether GreenRain can handle weekly mowing. Reply thread: https://business.google.com/messages/thread/gbp_thread_789"
  });

  assert.equal(lead.email, undefined);
  assert.equal(lead.phone, undefined);
  assert.equal(lead.preferredContactMethod, "platform-message");
  assert.equal(lead.channelMetadata?.threadUrl, "https://business.google.com/messages/thread/gbp_thread_789");
  assert.equal(lead.channelMetadata?.profileLocationName, undefined);

  const queue = await platform.listOpsLaunchLeads();
  const queuedLead = queue.find((item) => item.lead.id === lead.id);
  assert.ok(queuedLead);
  assert.match(queuedLead.responseGuidance.recommendedAction, /reply in the source thread/i);
  assert.equal(queuedLead.responseGuidance.templates[0]?.key, "first-response-platform-message");

  const capturedEvent = analytics
    .listEvents()
    .find((event) => event.name === MarketplaceTelemetryEventCatalog.launchLeadCaptured);
  assert.equal(capturedEvent?.properties.sourceChannel, "google-business-profile");
  assert.equal(capturedEvent?.properties.hasEmail, false);
  assert.equal(capturedEvent?.properties.hasPhone, false);
  assert.equal(capturedEvent?.properties.preferredContactMethod, "platform-message");
});

test("referral leads can guide ops to coordinate through the referrer when customer contact is missing", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const analytics = new DataEngineeringLogger();
  const platform = new MarketplacePlatformService(repository, analytics);
  const originalSecret = process.env.INBOUND_LEAD_WEBHOOK_SECRET;
  process.env.INBOUND_LEAD_WEBHOOK_SECRET = "launch-webhook-secret";

  try {
    const lead = await platform.createInboundReferralLaunchLead(
      {
        sourceReferenceId: "ref_123",
        referrerName: "Alex Neighbor",
        referrerEmail: "alex@example.com",
        referredCustomerName: "Jamie Homeowner",
        areaLabel: "Barnegat, NJ",
        serviceCategory: "lawn-mowing",
        messageText: "Neighbor wants help getting weekly mowing started."
      },
      "launch-webhook-secret"
    );

    assert.equal(lead.sourceChannel, "referral");
    assert.equal(lead.email, "alex@example.com");
    assert.equal(lead.phone, undefined);
    assert.equal(lead.channelMetadata?.referrerName, "Alex Neighbor");
    assert.equal(lead.channelMetadata?.referralFollowUpTarget, "referrer");

    const queue = await platform.listOpsLaunchLeads();
    const queuedLead = queue.find((item) => item.lead.id === lead.id);
    assert.ok(queuedLead);
    assert.ok(
      queuedLead.responseGuidance.warnings.some((warning) => /back through the referrer/i.test(warning))
    );
    assert.match(queuedLead.responseGuidance.recommendedAction, /first email response/i);
    const partnerTemplate = queuedLead.responseGuidance.templates.find(
      (template) => template.key === "partner-follow-up"
    );
    assert.ok(partnerTemplate);
    assert.equal(partnerTemplate.audience, "partner");
    assert.match(partnerTemplate.body, /active contact/i);
  } finally {
    process.env.INBOUND_LEAD_WEBHOOK_SECRET = originalSecret;
  }
});

test("ops lead queue suggests existing booking matches and can manually attach them", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const analytics = new DataEngineeringLogger();
  const platform = new MarketplacePlatformService(repository, analytics);

  const customer = await platform.registerUser({
    fullName: "Jamie Homeowner",
    email: "jamie@example.com",
    password: "Password123!",
    phone: "555-2200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress()
  });
  const providers = await repository.listProviders();
  const provider = providers[0];
  assert.ok(provider);

  const recurring = await platform.createRecurringServicePlan(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress(),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
    scheduledEndIso: new Date(Date.now() + 73 * 60 * 60 * 1000).toISOString(),
    notes: "Start weekly mowing",
    totalCents: 6200,
    frequency: "weekly"
  });
  assert.equal(recurring.initialBooking.launchLeadId, undefined);

  const lead = await platform.createLaunchLead({
    sourceChannel: "email",
    requestSource: "customer-service-help-request",
    contactName: "Jamie Homeowner",
    email: "jamie@example.com",
    preferredContactMethod: "email",
    areaLabel: "Barnegat, NJ",
    serviceCategory: "lawn-mowing",
    message: "Customer emailed after booking and wants the inquiry tracked in the launch queue.",
    assignedOwner: "Casey Ops"
  });

  const queue = await platform.listOpsLaunchLeads();
  const queuedLead = queue.find((item) => item.lead.id === lead.id);
  assert.ok(queuedLead);
  assert.equal(queuedLead?.suggestedBookingMatches[0]?.bookingId, recurring.initialBooking.id);
  assert.equal(queuedLead?.suggestedBookingMatches[0]?.matchReason, "email");

  const updatedLead = await platform.updateLaunchLeadForOps({
    leadId: lead.id,
    status: "qualified",
    assignedOwner: "Casey Ops",
    linkBookingId: recurring.initialBooking.id
  });
  assert.equal(updatedLead.status, "converted");
  assert.deepEqual(updatedLead.convertedBookingIds, [recurring.initialBooking.id]);
  assert.ok(new Date(updatedLead.closedAt ?? "").getTime() >= new Date(updatedLead.createdAt).getTime());

  const linkedBooking = await repository.findBookingById(recurring.initialBooking.id);
  assert.equal(linkedBooking?.launchLeadId, lead.id);
  const linkedPlan = await repository.findRecurringServicePlanById(recurring.plan.plan.id);
  assert.equal(linkedPlan?.launchLeadId, lead.id);

  const closedEvent = analytics
    .listEvents()
    .find((event) => event.name === MarketplaceTelemetryEventCatalog.launchLeadClosed);
  assert.equal(closedEvent?.properties.status, "converted");
});

test("manual email leads auto-link to later bookings from the same customer identity", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const analytics = new DataEngineeringLogger();
  const platform = new MarketplacePlatformService(repository, analytics);

  const lead = await platform.createLaunchLead({
    sourceChannel: "email",
    requestSource: "customer-service-help-request",
    contactName: "Jamie Homeowner",
    email: "jamie@example.com",
    preferredContactMethod: "email",
    areaLabel: "Barnegat, NJ",
    serviceCategory: "lawn-mowing",
    message: "Can GreenRain help me get weekly mowing set up soon?"
  });

  const customer = await platform.registerUser({
    fullName: "Jamie Homeowner",
    email: "jamie@example.com",
    password: "Password123!",
    phone: "555-2200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress()
  });
  const providers = await repository.listProviders();
  const provider = providers[0];
  assert.ok(provider);

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress(),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
    scheduledEndIso: new Date(Date.now() + 73 * 60 * 60 * 1000).toISOString(),
    notes: "Please mow weekly.",
    totalCents: 6200
  });

  assert.equal(booking.launchLeadId, lead.id);
  const convertedLead = await repository.findLaunchLeadById(lead.id);
  assert.equal(convertedLead?.status, "converted");
  assert.deepEqual(convertedLead?.convertedBookingIds, [booking.id]);

  const bookingRequestedEvent = analytics
    .listEvents()
    .find((event) => event.name === MarketplaceTelemetryEventCatalog.bookingRequested);
  assert.equal(bookingRequestedEvent?.properties.launchLeadId, lead.id);
  assert.equal(bookingRequestedEvent?.properties.launchLeadLinkMode, "email-match");
  assert.equal(bookingRequestedEvent?.properties.launchLeadSourceChannel, "email");
});

test("converted launch leads surface booking follow-up drafts instead of requalification copy", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const analytics = new DataEngineeringLogger();
  const platform = new MarketplacePlatformService(repository, analytics);

  const lead = await platform.createLaunchLead({
    sourceChannel: "email",
    requestSource: "customer-service-help-request",
    contactName: "Jamie Homeowner",
    email: "jamie@example.com",
    preferredContactMethod: "email",
    areaLabel: "Barnegat, NJ",
    serviceCategory: "lawn-mowing",
    message: "Can GreenRain help me get weekly mowing set up soon?"
  });

  const customer = await platform.registerUser({
    fullName: "Jamie Homeowner",
    email: "jamie@example.com",
    password: "Password123!",
    phone: "555-2200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress()
  });
  const providers = await repository.listProviders();
  const provider = providers[0];
  assert.ok(provider);

  await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress(),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
    scheduledEndIso: new Date(Date.now() + 73 * 60 * 60 * 1000).toISOString(),
    notes: "Please mow weekly.",
    totalCents: 6200
  });

  const queue = await platform.listOpsLaunchLeads();
  const queuedLead = queue.find((item) => item.lead.id === lead.id);
  assert.ok(queuedLead);
  assert.match(queuedLead.responseGuidance.recommendedAction, /already linked/i);
  assert.ok(
    queuedLead.responseGuidance.templates.some((template) => template.key === "booking-confirmation")
  );
});

test("manual phone leads auto-link to later bookings when email is unavailable", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const analytics = new DataEngineeringLogger();
  const platform = new MarketplacePlatformService(repository, analytics);

  const lead = await platform.createLaunchLead({
    sourceChannel: "phone",
    requestSource: "customer-service-help-request",
    contactName: "Taylor Caller",
    phone: "(555) 111-2222",
    preferredContactMethod: "phone",
    areaLabel: "Barnegat, NJ",
    serviceCategory: "seasonal-cleanup",
    message: "Can someone help me get a cleanup scheduled before guests arrive?"
  });

  const customer = await platform.registerUser({
    fullName: "Taylor Caller",
    email: "taylor@example.com",
    password: "Password123!",
    phone: "5551112222",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress()
  });
  const providers = await repository.listProviders();
  const provider = providers[0];
  assert.ok(provider);

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress(),
    servicePropertyId: customer.defaultPropertyId,
    category: "seasonal-cleanup",
    scheduledStartIso: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
    scheduledEndIso: new Date(Date.now() + 74 * 60 * 60 * 1000).toISOString(),
    notes: "Seasonal cleanup before family visits.",
    totalCents: 8200
  });

  assert.equal(booking.launchLeadId, lead.id);
  const convertedLead = await repository.findLaunchLeadById(lead.id);
  assert.equal(convertedLead?.status, "converted");
  assert.deepEqual(convertedLead?.convertedBookingIds, [booking.id]);

  const bookingRequestedEvent = analytics
    .listEvents()
    .find((event) => event.name === MarketplaceTelemetryEventCatalog.bookingRequested);
  assert.equal(bookingRequestedEvent?.properties.launchLeadId, lead.id);
  assert.equal(bookingRequestedEvent?.properties.launchLeadLinkMode, "phone-match");
  assert.equal(bookingRequestedEvent?.properties.launchLeadSourceChannel, "phone");
});

test("launch leads stay linked through recurring bookings and review generation", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const analytics = new DataEngineeringLogger();
  const platform = new MarketplacePlatformService(repository, analytics);

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "launch-linked@example.com",
    password: "Password123!",
    phone: "555-0200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress()
  });
  const providers = await repository.listProviders();
  const provider = providers[0];
  assert.ok(provider);

  const lead = await platform.createLaunchLead({
    requestSource: "launch-town-page-lead-form",
    attribution: {
      source: "google",
      medium: "organic",
      campaign: "barnegat-launch",
      landingPath: "/barnegat-nj/lawn-mowing",
      capturedAt: "2026-06-17T10:00:00.000Z"
    },
    contactName: "Jamie Homeowner",
    email: "jamie@example.com",
    preferredContactMethod: "email",
    areaLabel: "Barnegat, NJ",
    serviceCategory: "lawn-mowing",
    message: "Please help me get mowing started now and keep it going weekly."
  });

  const recurring = await platform.createRecurringServicePlan(customer.id, {
    providerId: provider.id,
    launchLeadId: lead.id,
    serviceAddress: createAddress(),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
    scheduledEndIso: new Date(Date.now() + 73 * 60 * 60 * 1000).toISOString(),
    notes: "Start weekly mowing",
    totalCents: 6200,
    frequency: "weekly"
  });

  assert.equal(recurring.plan.plan.launchLeadId, lead.id);
  assert.equal(recurring.initialBooking.launchLeadId, lead.id);

  const convertedLead = await repository.findLaunchLeadById(lead.id);
  assert.equal(convertedLead?.status, "converted");
  assert.deepEqual(convertedLead?.convertedBookingIds, [recurring.initialBooking.id]);
  assert.equal(convertedLead?.firstConvertedBookingAt, recurring.initialBooking.requestedAt);
  assert.equal(convertedLead?.lastConvertedBookingAt, recurring.initialBooking.requestedAt);

  const bookingRequestedEvent = analytics
    .listEvents()
    .find((event) => event.name === MarketplaceTelemetryEventCatalog.bookingRequested);
  assert.equal(bookingRequestedEvent?.properties.launchLeadId, lead.id);
  assert.equal(bookingRequestedEvent?.properties.launchLeadSourceChannel, "website");
  assert.equal(bookingRequestedEvent?.properties.attributionSource, "google");
  assert.equal(bookingRequestedEvent?.properties.launchLeadConvertedBookingCount, 1);

  await platform.confirmBooking(provider.id, {
    bookingId: recurring.initialBooking.id
  });

  await attachEvidence(
    platform,
    { userId: provider.id, email: provider.email, role: "provider" },
    recurring.initialBooking.id,
    "after"
  );

  await platform.completeBooking(provider.id, {
    bookingId: recurring.initialBooking.id
  });

  const allBookings = await repository.listBookings();
  const nextRecurringBooking = allBookings.find(
    (booking) =>
      booking.recurringPlanId === recurring.plan.plan.id && booking.recurringOccurrenceIndex === 2
  );
  assert.ok(nextRecurringBooking);
  assert.equal(nextRecurringBooking?.launchLeadId, lead.id);

  const leadAfterRepeatBooking = await repository.findLaunchLeadById(lead.id);
  assert.deepEqual(leadAfterRepeatBooking?.convertedBookingIds, [
    recurring.initialBooking.id,
    nextRecurringBooking?.id
  ]);
  assert.equal(leadAfterRepeatBooking?.lastConvertedBookingAt, nextRecurringBooking?.requestedAt);

  await platform.processReviewInvites({
    nowIso: new Date(Date.now() + 96 * 60 * 60 * 1000).toISOString()
  });

  const review = await platform.createProviderReview(customer.id, {
    bookingId: recurring.initialBooking.id,
    overallRating: 5,
    timelinessRating: 5,
    attentionToDetailRating: 5,
    reviewText: "Weekly setup was smooth and the crew did a great job."
  });

  const leadAfterReview = await repository.findLaunchLeadById(lead.id);
  assert.deepEqual(leadAfterReview?.reviewIds, [review.id]);
  assert.equal(leadAfterReview?.lastReviewSubmittedAt, review.createdAt);

  const reviewSubmittedEvent = analytics
    .listEvents()
    .find((event) => event.name === MarketplaceTelemetryEventCatalog.providerReviewSubmitted);
  assert.equal(reviewSubmittedEvent?.properties.launchLeadId, lead.id);
  assert.equal(reviewSubmittedEvent?.properties.launchLeadReviewCount, 1);
  assert.equal(reviewSubmittedEvent?.properties.attributionSource, "google");
});

test("completed bookings unlock review invites and reject duplicate reviews", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const analytics = new DataEngineeringLogger();
  const platform = new MarketplacePlatformService(repository, analytics);

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer@example.com",
    password: "Password123!",
    phone: "555-0200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress()
  });
  assert.equal(customer.role, "customer");

  const providers = await repository.listProviders();
  const provider = providers[0];
  assert.ok(provider);

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress(),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
    scheduledEndIso: new Date(Date.now() + 73 * 60 * 60 * 1000).toISOString(),
    notes: "Mow and edge",
    totalCents: 6200
  });

  await platform.confirmBooking(provider.id, {
    bookingId: booking.id
  });

  await attachEvidence(
    platform,
    { userId: provider.id, email: provider.email, role: "provider" },
    booking.id,
    "after"
  );

  await platform.completeBooking(provider.id, {
    bookingId: booking.id
  });

  const opportunitiesBeforeSend = await platform.listCustomerReviewOpportunities(customer.id);
  assert.equal(opportunitiesBeforeSend.opportunities[0]?.inviteStatus, "scheduled");
  assert.equal(opportunitiesBeforeSend.opportunities[0]?.canReviewNow, false);

  await platform.processReviewInvites({
    nowIso: new Date(Date.now() + 96 * 60 * 60 * 1000).toISOString()
  });

  const opportunitiesAfterSend = await platform.listCustomerReviewOpportunities(customer.id);
  assert.equal(opportunitiesAfterSend.opportunities[0]?.inviteStatus, "sent");
  assert.equal(opportunitiesAfterSend.opportunities[0]?.canReviewNow, true);

  const review = await platform.createProviderReview(customer.id, {
    bookingId: booking.id,
    overallRating: 5,
    timelinessRating: 5,
    attentionToDetailRating: 4,
    reviewText: "Fast, neat, and on time.",
    attribution: {
      source: "google",
      medium: "organic",
      campaign: "barnegat-reviews",
      landingPath: "/barnegat-nj",
      capturedAt: "2026-06-17T14:30:00.000Z"
    }
  });
  assert.equal(review.providerId, provider.id);

  const reviewSubmittedEvent = analytics
    .listEvents()
    .find((event) => event.name === MarketplaceTelemetryEventCatalog.providerReviewSubmitted);
  assert.equal(reviewSubmittedEvent?.properties.attributionSource, "google");
  assert.equal(reviewSubmittedEvent?.properties.attributionMedium, "organic");
  assert.equal(reviewSubmittedEvent?.properties.attributionCampaign, "barnegat-reviews");
  assert.equal(reviewSubmittedEvent?.properties.attributionLandingPath, "/barnegat-nj");

  await assert.rejects(
    platform.createProviderReview(customer.id, {
      bookingId: booking.id,
      overallRating: 5,
      timelinessRating: 5,
      attentionToDetailRating: 5,
      reviewText: "Duplicate review"
    }),
    /already been submitted/
  );
});

test("customer retention opportunities suggest recurring mowing and one-time rebooks", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-retention@example.com",
    password: "Password123!",
    phone: "555-0200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress()
  });

  const provider = (await repository.listProviders())[0];
  assert.ok(provider);

  const mowingBooking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress(),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(72),
    scheduledEndIso: futureIso(73),
    notes: "Mow and edge",
    totalCents: 6200
  });
  await repository.updateBooking(mowingBooking.id, {
    status: "completed",
    completedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  });

  const cleanupBooking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress(),
    servicePropertyId: customer.defaultPropertyId,
    category: "seasonal-cleanup",
    scheduledStartIso: futureIso(96),
    scheduledEndIso: futureIso(98),
    notes: "Cleanup leaves and beds",
    totalCents: 8400
  });
  await repository.updateBooking(cleanupBooking.id, {
    status: "completed",
    completedAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString()
  });

  const retention = await platform.listCustomerRetentionOpportunities(customer.id);
  assert.equal(retention.opportunities.length, 2);
  assert.equal(retention.opportunities[0]?.kind, "start-recurring-plan");
  assert.equal(retention.opportunities[0]?.recommendedCadence, "weekly");
  assert.equal(retention.opportunities[0]?.strategyKey, "lawn-mowing-recurring");
  assert.equal(retention.opportunities[0]?.trigger, "recent-completion");
  assert.equal(retention.opportunities[0]?.daysSinceCompleted, 7);
  assert.equal(retention.opportunities[0]?.completedCategoryCount, 1);
  assert.equal(retention.opportunities[0]?.sameProviderCompletedCount, 1);
  assert.equal(retention.opportunities[0]?.loyaltySegment, "new-repeat");
  assert.match(retention.opportunities[0]?.message ?? "", /weekly plan/i);
  assert.equal(retention.opportunities[1]?.kind, "rebook-service");
  assert.equal(retention.opportunities[1]?.recommendedCadence, "one-time");
  assert.equal(retention.opportunities[1]?.strategyKey, "seasonal-cleanup-follow-up");
  assert.equal(retention.opportunities[1]?.trigger, "30-day-follow-up");
  assert.match(retention.opportunities[1]?.title ?? "", /plan the next cleanup pass/i);
});

test("customer retention opportunities recommend biweekly mowing for repeat customers with the same provider", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-retention-biweekly@example.com",
    password: "Password123!",
    phone: "555-0200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress()
  });

  const provider = (await repository.listProviders())[0];
  assert.ok(provider);

  const earlierMowing = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress(),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(72),
    scheduledEndIso: futureIso(73),
    notes: "Earlier mowing visit",
    totalCents: 6200
  });
  await repository.updateBooking(earlierMowing.id, {
    status: "completed",
    completedAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString()
  });

  const recentMowing = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress(),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(96),
    scheduledEndIso: futureIso(97),
    notes: "Recent mowing visit",
    totalCents: 6200
  });
  await repository.updateBooking(recentMowing.id, {
    status: "completed",
    completedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  });

  const retention = await platform.listCustomerRetentionOpportunities(customer.id);
  const mowingOpportunity = retention.opportunities.find((item) => item.category === "lawn-mowing");
  assert.ok(mowingOpportunity);
  assert.equal(mowingOpportunity?.recommendedCadence, "biweekly");
  assert.equal(mowingOpportunity?.strategyKey, "lawn-mowing-biweekly-repeat");
  assert.equal(mowingOpportunity?.loyaltySegment, "provider-loyal");
  assert.equal(mowingOpportunity?.completedCategoryCount, 2);
  assert.equal(mowingOpportunity?.sameProviderCompletedCount, 2);
  assert.equal(mowingOpportunity?.lastServiceGapDays, 14);
  assert.match(mowingOpportunity?.title ?? "", /every-2-weeks route/i);
  assert.match(mowingOpportunity?.message ?? "", /same relationship|already completed 2 lawn mowing visits/i);
});

test("retention rebooks and recurring plans flow into repeat-service conversion analytics", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const analytics = new DataEngineeringLogger();
  const platform = new MarketplacePlatformService(repository, analytics);

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-retention-analytics@example.com",
    password: "Password123!",
    phone: "555-0200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress()
  });

  const provider = (await repository.listProviders())[0];
  assert.ok(provider);

  const mowingBooking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress(),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(72),
    scheduledEndIso: futureIso(73),
    notes: "Mow and edge",
    totalCents: 6200
  });
  await repository.updateBooking(mowingBooking.id, {
    status: "completed",
    completedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  });

  const cleanupBooking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress(),
    servicePropertyId: customer.defaultPropertyId,
    category: "seasonal-cleanup",
    scheduledStartIso: futureIso(96),
    scheduledEndIso: futureIso(98),
    notes: "Cleanup leaves and beds",
    totalCents: 8400
  });
  await repository.updateBooking(cleanupBooking.id, {
    status: "completed",
    completedAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString()
  });

  const retention = await platform.listCustomerRetentionOpportunities(customer.id);
  const mowingOpportunity = retention.opportunities.find((item) => item.category === "lawn-mowing");
  const cleanupOpportunity = retention.opportunities.find((item) => item.category === "seasonal-cleanup");
  assert.ok(mowingOpportunity);
  assert.ok(cleanupOpportunity);

  await platform.createRecurringServicePlan(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress(),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(144),
    scheduledEndIso: futureIso(145),
    notes: "Recurring mowing from retention flow",
    totalCents: 6200,
    frequency: "weekly",
    requestSource: "customer-retention-nudge",
    recommendationSource: "customer-retention-nudge",
    retentionContext: {
      opportunityId: mowingOpportunity.id,
      sourceBookingId: mowingOpportunity.sourceBookingId,
      kind: mowingOpportunity.kind,
      strategyKey: mowingOpportunity.strategyKey,
      trigger: mowingOpportunity.trigger
    }
  });

  await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress(),
    servicePropertyId: customer.defaultPropertyId,
    category: "seasonal-cleanup",
    scheduledStartIso: futureIso(168),
    scheduledEndIso: futureIso(170),
    notes: "Cleanup rebook from retention flow",
    totalCents: 8400,
    requestSource: "customer-retention-nudge",
    recommendationSource: "customer-retention-nudge",
    retentionContext: {
      opportunityId: cleanupOpportunity.id,
      sourceBookingId: cleanupOpportunity.sourceBookingId,
      kind: cleanupOpportunity.kind,
      strategyKey: cleanupOpportunity.strategyKey,
      trigger: cleanupOpportunity.trigger
    }
  });

  const bookingRequestedEvents = analytics
    .listEvents()
    .filter((event) => event.name === MarketplaceTelemetryEventCatalog.bookingRequested);
  assert.ok(
    bookingRequestedEvents.some(
      (event) =>
        event.properties.retentionStrategyKey === "lawn-mowing-recurring" &&
        event.properties.requestSource === "customer-retention-nudge" &&
        event.properties.recurringPlanStarted === true
    )
  );
  assert.ok(
    bookingRequestedEvents.some(
      (event) =>
        event.properties.retentionStrategyKey === "seasonal-cleanup-follow-up" &&
        event.properties.requestSource === "customer-retention-nudge" &&
        event.properties.recurringPlanStarted === false
    )
  );

  const overview = await platform.getObservabilityOverview();
  const sourceMetric = overview.retentionMetricsBySource.find(
    (metric) =>
      metric.requestSource === "customer-retention-nudge" &&
      metric.strategyKey === "lawn-mowing-recurring"
  );
  assert.equal(sourceMetric?.bookingRequests, 1);
  assert.equal(sourceMetric?.recurringPlanStarts, 1);

  const cleanupSourceMetric = overview.retentionMetricsBySource.find(
    (metric) =>
      metric.requestSource === "customer-retention-nudge" &&
      metric.strategyKey === "seasonal-cleanup-follow-up"
  );
  assert.equal(cleanupSourceMetric?.bookingRequests, 1);
  assert.equal(cleanupSourceMetric?.oneTimeRebooks, 1);

  const providerMetric = overview.retentionMetricsByProvider.find(
    (metric) =>
      metric.providerId === provider.id && metric.strategyKey === "lawn-mowing-recurring"
  );
  assert.equal(providerMetric?.providerName, provider.companyName);
  assert.equal(providerMetric?.recurringPlanStarts, 1);
});

test("customer retention opportunities skip categories that already have future work queued", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-retention-future@example.com",
    password: "Password123!",
    phone: "555-0200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress()
  });

  const provider = (await repository.listProviders())[0];
  assert.ok(provider);

  const completedBooking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress(),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(72),
    scheduledEndIso: futureIso(73),
    notes: "Mow and edge",
    totalCents: 6200
  });
  await repository.updateBooking(completedBooking.id, {
    status: "completed",
    completedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  });

  await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress(),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(120),
    scheduledEndIso: futureIso(121),
    notes: "Already booked again",
    totalCents: 6200
  });

  const retention = await platform.listCustomerRetentionOpportunities(customer.id);
  assert.equal(retention.opportunities.some((item) => item.category === "lawn-mowing"), false);
});

test("customer retention opportunities wait for hedge trimming reminder timing", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-retention-hedges@example.com",
    password: "Password123!",
    phone: "555-0200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress()
  });

  const provider = (await repository.listProviders())[0];
  assert.ok(provider);

  const earlyBooking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress(),
    servicePropertyId: customer.defaultPropertyId,
    category: "hedge-trimming",
    scheduledStartIso: futureIso(72),
    scheduledEndIso: futureIso(73),
    notes: "Trim the front hedge",
    totalCents: 5400
  });
  await repository.updateBooking(earlyBooking.id, {
    status: "completed",
    completedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString()
  });

  let retention = await platform.listCustomerRetentionOpportunities(customer.id);
  assert.equal(retention.opportunities.some((item) => item.category === "hedge-trimming"), false);

  await repository.updateBooking(earlyBooking.id, {
    completedAt: new Date(Date.now() - 65 * 24 * 60 * 60 * 1000).toISOString()
  });

  retention = await platform.listCustomerRetentionOpportunities(customer.id);
  const hedgeOpportunity = retention.opportunities.find((item) => item.category === "hedge-trimming");
  assert.ok(hedgeOpportunity);
  assert.equal(hedgeOpportunity?.strategyKey, "hedge-trimming-reminder");
  assert.equal(hedgeOpportunity?.trigger, "60-day-follow-up");
  assert.equal(hedgeOpportunity?.daysSinceCompleted, 65);
});

test("customer retention opportunities use spring and fall season windows for seasonal services", async () => {
  await withMockedNow("2026-04-15T12:00:00.000Z", async () => {
    const repository = new InMemoryMarketplaceRepository();
    const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

    const customer = await platform.registerUser({
      fullName: "Jordan Rivera",
      email: "customer-retention-spring@example.com",
      password: "Password123!",
      phone: "555-0200",
      role: "customer",
      propertyLabel: "Primary home",
      address: createAddress()
    });

    const provider = (await repository.listProviders())[0];
    assert.ok(provider);

    const mulchBooking = await platform.createBooking(customer.id, {
      providerId: provider.id,
      serviceAddress: createAddress(),
      servicePropertyId: customer.defaultPropertyId,
      category: "mulch-installation",
      scheduledStartIso: futureIso(72),
      scheduledEndIso: futureIso(75),
      notes: "Refresh mulch beds",
      totalCents: 9200
    });
    await repository.updateBooking(mulchBooking.id, {
      status: "completed",
      completedAt: "2025-04-20T12:00:00.000Z"
    });

    const springRetention = await platform.listCustomerRetentionOpportunities(customer.id);
    const mulchOpportunity = springRetention.opportunities.find(
      (item) => item.category === "mulch-installation"
    );
    assert.ok(mulchOpportunity);
    assert.equal(mulchOpportunity?.strategyKey, "mulch-refresh-spring");
    assert.equal(mulchOpportunity?.trigger, "spring-season-window");
    assert.match(mulchOpportunity?.title ?? "", /refresh the mulch/i);
  });

  await withMockedNow("2026-07-15T12:00:00.000Z", async () => {
    const repository = new InMemoryMarketplaceRepository();
    const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

    const customer = await platform.registerUser({
      fullName: "Jordan Rivera",
      email: "customer-retention-summer@example.com",
      password: "Password123!",
      phone: "555-0200",
      role: "customer",
      propertyLabel: "Primary home",
      address: createAddress()
    });

    const provider = (await repository.listProviders())[0];
    assert.ok(provider);

    const mulchBooking = await platform.createBooking(customer.id, {
      providerId: provider.id,
      serviceAddress: createAddress(),
      servicePropertyId: customer.defaultPropertyId,
      category: "mulch-installation",
      scheduledStartIso: futureIso(72),
      scheduledEndIso: futureIso(75),
      notes: "Refresh mulch beds",
      totalCents: 9200
    });
    await repository.updateBooking(mulchBooking.id, {
      status: "completed",
      completedAt: "2025-04-20T12:00:00.000Z"
    });

    const summerRetention = await platform.listCustomerRetentionOpportunities(customer.id);
    assert.equal(
      summerRetention.opportunities.some((item) => item.strategyKey === "mulch-refresh-spring"),
      false
    );
  });

  await withMockedNow("2026-10-10T12:00:00.000Z", async () => {
    const repository = new InMemoryMarketplaceRepository();
    const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

    const customer = await platform.registerUser({
      fullName: "Jordan Rivera",
      email: "customer-retention-fall@example.com",
      password: "Password123!",
      phone: "555-0200",
      role: "customer",
      propertyLabel: "Primary home",
      address: createAddress()
    });

    const provider = (await repository.listProviders())[0];
    assert.ok(provider);

    const leafBooking = await platform.createBooking(customer.id, {
      providerId: provider.id,
      serviceAddress: createAddress(),
      servicePropertyId: customer.defaultPropertyId,
      category: "leaf-blowing",
      scheduledStartIso: futureIso(72),
      scheduledEndIso: futureIso(73),
      notes: "Clear leaves from the yard",
      totalCents: 5600
    });
    await repository.updateBooking(leafBooking.id, {
      status: "completed",
      completedAt: "2025-10-18T12:00:00.000Z"
    });

    const fallRetention = await platform.listCustomerRetentionOpportunities(customer.id);
    const leafOpportunity = fallRetention.opportunities.find((item) => item.category === "leaf-blowing");
    assert.ok(leafOpportunity);
    assert.equal(leafOpportunity?.strategyKey, "leaf-blowing-fall-return");
    assert.equal(leafOpportunity?.trigger, "fall-season-window");
    assert.match(leafOpportunity?.title ?? "", /leaf cycle/i);
  });

  await withMockedNow("2026-04-15T12:00:00.000Z", async () => {
    const repository = new InMemoryMarketplaceRepository();
    const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

    const customer = await platform.registerUser({
      fullName: "Jordan Rivera",
      email: "customer-retention-fertilization@example.com",
      password: "Password123!",
      phone: "555-0200",
      role: "customer",
      propertyLabel: "Primary home",
      address: createAddress()
    });

    const provider = (await repository.listProviders())[0];
    assert.ok(provider);

    const fertilizationBooking = await platform.createBooking(customer.id, {
      providerId: provider.id,
      serviceAddress: createAddress(),
      servicePropertyId: customer.defaultPropertyId,
      category: "fertilization",
      scheduledStartIso: futureIso(72),
      scheduledEndIso: futureIso(73),
      notes: "Spring lawn treatment",
      totalCents: 5900
    });
    await repository.updateBooking(fertilizationBooking.id, {
      status: "completed",
      completedAt: "2025-09-20T12:00:00.000Z"
    });

    const springRetention = await platform.listCustomerRetentionOpportunities(customer.id);
    const fertilizationOpportunity = springRetention.opportunities.find(
      (item) => item.category === "fertilization"
    );
    assert.ok(fertilizationOpportunity);
    assert.equal(fertilizationOpportunity?.strategyKey, "fertilization-spring-return");
    assert.equal(fertilizationOpportunity?.trigger, "spring-season-window");
    assert.match(fertilizationOpportunity?.title ?? "", /spring fertilization/i);
  });

  await withMockedNow("2026-10-10T12:00:00.000Z", async () => {
    const repository = new InMemoryMarketplaceRepository();
    const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

    const customer = await platform.registerUser({
      fullName: "Jordan Rivera",
      email: "customer-retention-aeration@example.com",
      password: "Password123!",
      phone: "555-0200",
      role: "customer",
      propertyLabel: "Primary home",
      address: createAddress()
    });

    const provider = (await repository.listProviders())[0];
    assert.ok(provider);

    const aerationBooking = await platform.createBooking(customer.id, {
      providerId: provider.id,
      serviceAddress: createAddress(),
      servicePropertyId: customer.defaultPropertyId,
      category: "aeration",
      scheduledStartIso: futureIso(72),
      scheduledEndIso: futureIso(73),
      notes: "Fall core aeration",
      totalCents: 6100
    });
    await repository.updateBooking(aerationBooking.id, {
      status: "completed",
      completedAt: "2026-04-20T12:00:00.000Z"
    });

    const fallRetention = await platform.listCustomerRetentionOpportunities(customer.id);
    const aerationOpportunity = fallRetention.opportunities.find((item) => item.category === "aeration");
    assert.ok(aerationOpportunity);
    assert.equal(aerationOpportunity?.strategyKey, "aeration-fall-return");
    assert.equal(aerationOpportunity?.trigger, "fall-season-window");
    assert.match(aerationOpportunity?.title ?? "", /fall aeration/i);
  });
});

test("customer retention opportunities use winter and gutter season windows for seasonal services", async () => {
  await withMockedNow("2026-12-10T12:00:00.000Z", async () => {
    const repository = new InMemoryMarketplaceRepository();
    const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

    const customer = await platform.registerUser({
      fullName: "Jordan Rivera",
      email: "customer-retention-winter@example.com",
      password: "Password123!",
      phone: "555-0200",
      role: "customer",
      propertyLabel: "Primary home",
      address: createAddress()
    });

    const providers = await repository.listProviders();
    const shovelProvider = providers.find((provider) => provider.categories.includes("snow-shoveling"));
    const blowerProvider = providers.find((provider) => provider.categories.includes("snow-blowing"));
    const saltingProvider = providers.find((provider) => provider.categories.includes("ice-melt-salting"));
    assert.ok(shovelProvider);
    assert.ok(blowerProvider);
    assert.ok(saltingProvider);

    const snowShovelingBooking = await platform.createBooking(customer.id, {
      providerId: shovelProvider.id,
      serviceAddress: createAddress(),
      servicePropertyId: customer.defaultPropertyId,
      category: "snow-shoveling",
      scheduledStartIso: futureIso(72),
      scheduledEndIso: futureIso(73),
      notes: "Clear the walkway",
      totalCents: 4200
    });
    await repository.updateBooking(snowShovelingBooking.id, {
      status: "completed",
      completedAt: "2026-01-20T12:00:00.000Z"
    });

    const snowBlowingBooking = await platform.createBooking(customer.id, {
      providerId: blowerProvider.id,
      serviceAddress: createAddress(),
      servicePropertyId: customer.defaultPropertyId,
      category: "snow-blowing",
      scheduledStartIso: futureIso(96),
      scheduledEndIso: futureIso(97),
      notes: "Clear the driveway",
      totalCents: 6800
    });
    await repository.updateBooking(snowBlowingBooking.id, {
      status: "completed",
      completedAt: "2026-01-24T12:00:00.000Z"
    });

    const saltingBooking = await platform.createBooking(customer.id, {
      providerId: saltingProvider.id,
      serviceAddress: createAddress(),
      servicePropertyId: customer.defaultPropertyId,
      category: "ice-melt-salting",
      scheduledStartIso: futureIso(120),
      scheduledEndIso: futureIso(121),
      notes: "Treat icy walkways",
      totalCents: 3600
    });
    await repository.updateBooking(saltingBooking.id, {
      status: "completed",
      completedAt: "2026-01-28T12:00:00.000Z"
    });

    const retention = await platform.listCustomerRetentionOpportunities(customer.id);
    const snowShovelingOpportunity = retention.opportunities.find((item) => item.category === "snow-shoveling");
    const snowBlowingOpportunity = retention.opportunities.find((item) => item.category === "snow-blowing");
    const saltingOpportunity = retention.opportunities.find((item) => item.category === "ice-melt-salting");

    assert.ok(snowShovelingOpportunity);
    assert.equal(snowShovelingOpportunity?.strategyKey, "snow-shoveling-winter-ready");
    assert.equal(snowShovelingOpportunity?.trigger, "winter-season-window");
    assert.match(snowShovelingOpportunity?.message ?? "", /fresh recommendation before the next storm/i);

    assert.ok(snowBlowingOpportunity);
    assert.equal(snowBlowingOpportunity?.strategyKey, "snow-blowing-winter-ready");
    assert.equal(snowBlowingOpportunity?.trigger, "winter-season-window");

    assert.ok(saltingOpportunity);
    assert.equal(saltingOpportunity?.strategyKey, "ice-melt-salting-winter-ready");
    assert.equal(saltingOpportunity?.trigger, "winter-season-window");
    assert.match(saltingOpportunity?.actionLabel ?? "", /ice treatment/i);
  });

  await withMockedNow("2026-11-05T12:00:00.000Z", async () => {
    const repository = new InMemoryMarketplaceRepository();
    const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

    const customer = await platform.registerUser({
      fullName: "Jordan Rivera",
      email: "customer-retention-gutters@example.com",
      password: "Password123!",
      phone: "555-0200",
      role: "customer",
      propertyLabel: "Primary home",
      address: createAddress()
    });

    const provider = (await repository.listProviders()).find((candidate) =>
      candidate.categories.includes("gutter-cleaning")
    );
    assert.ok(provider);

    const gutterBooking = await platform.createBooking(customer.id, {
      providerId: provider.id,
      serviceAddress: createAddress(),
      servicePropertyId: customer.defaultPropertyId,
      category: "gutter-cleaning",
      scheduledStartIso: futureIso(72),
      scheduledEndIso: futureIso(74),
      notes: "Clear roofline gutters",
      totalCents: 7600
    });
    await repository.updateBooking(gutterBooking.id, {
      status: "completed",
      completedAt: "2025-11-20T12:00:00.000Z"
    });

    const retention = await platform.listCustomerRetentionOpportunities(customer.id);
    const gutterOpportunity = retention.opportunities.find((item) => item.category === "gutter-cleaning");
    assert.ok(gutterOpportunity);
    assert.equal(gutterOpportunity?.strategyKey, "gutter-cleaning-fall-prep");
    assert.equal(gutterOpportunity?.trigger, "fall-season-window");
    assert.match(gutterOpportunity?.title ?? "", /clear gutters/i);
    assert.match(gutterOpportunity?.message ?? "", /overflow, ice, or messy winter runoff/i);
  });
});

test("customer retention opportunities fall back to a 90-day rebook for other services", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-retention-general@example.com",
    password: "Password123!",
    phone: "555-0200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress()
  });

  const provider = (await repository.listProviders())[0];
  assert.ok(provider);

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress(),
    servicePropertyId: customer.defaultPropertyId,
    category: "weed-control",
    scheduledStartIso: futureIso(72),
    scheduledEndIso: futureIso(73),
    notes: "Treat weeds around the beds",
    totalCents: 5100
  });
  await repository.updateBooking(booking.id, {
    status: "completed",
    completedAt: new Date(Date.now() - 95 * 24 * 60 * 60 * 1000).toISOString()
  });

  const retention = await platform.listCustomerRetentionOpportunities(customer.id);
  const generalOpportunity = retention.opportunities.find((item) => item.category === "weed-control");
  assert.ok(generalOpportunity);
  assert.equal(generalOpportunity?.strategyKey, "general-90-day-rebook");
  assert.equal(generalOpportunity?.trigger, "90-day-follow-up");
  assert.equal(generalOpportunity?.recommendedCadence, "one-time");
});

test("customers can change addresses only when the booking state allows it", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer2@example.com",
    password: "Password123!",
    phone: "555-0200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("145 Prospect Ave", 40.6681, -73.9836)
  });
  assert.equal(customer.role, "customer");

  const providers = await repository.listProviders();
  const provider = providers[0];

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: provider.address,
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
    scheduledEndIso: new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString(),
    notes: "Front and back yard",
    totalCents: 5500
  });

  const response = await platform.updateBookingAddress(customer.id, {
    bookingId: booking.id,
    newAddress: createAddress("150 Prospect Ave", 40.6692, -73.9827),
    newPropertyId: undefined
  });

  assert.equal(response.outcome, "updated");

  await platform.confirmBooking(provider.id, {
    bookingId: booking.id
  });

  await attachEvidence(
    platform,
    { userId: provider.id, email: provider.email, role: "provider" },
    booking.id,
    "after"
  );

  const completed = await platform.completeBooking(provider.id, {
    bookingId: booking.id
  });

  const blockedResponse = await platform.updateBookingAddress(customer.id, {
    bookingId: completed.id,
    newAddress: createAddress("111 New Address", 40.6701, -73.982),
    newPropertyId: undefined
  });

  assert.equal(blockedResponse.outcome, "blocked");
  assert.match(blockedResponse.reason, /no longer be changed/);
});

test("customers can cancel and reschedule future requested bookings", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer3@example.com",
    password: "Password123!",
    phone: "555-0200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress()
  });
  assert.equal(customer.role, "customer");

  const provider = (await repository.listProviders())[0];

  const bookingToReschedule = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress(),
    servicePropertyId: customer.defaultPropertyId,
    category: "mulch-installation",
    scheduledStartIso: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
    scheduledEndIso: new Date(Date.now() + 75 * 60 * 60 * 1000).toISOString(),
    notes: "Front beds",
    totalCents: 8200
  });
  const nextStartIso = new Date(Date.now() + 96 * 60 * 60 * 1000).toISOString();
  const nextEndIso = new Date(Date.now() + 99 * 60 * 60 * 1000).toISOString();

  const rescheduledBooking = await platform.rescheduleBooking(customer.id, {
    bookingId: bookingToReschedule.id,
    scheduledStartIso: nextStartIso,
    scheduledEndIso: nextEndIso
  });
  assert.equal(rescheduledBooking.scheduledStartIso, nextStartIso);
  assert.equal(rescheduledBooking.scheduledEndIso, nextEndIso);

  const bookingToCancel = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress(),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: new Date(Date.now() + 120 * 60 * 60 * 1000).toISOString(),
    scheduledEndIso: new Date(Date.now() + 121 * 60 * 60 * 1000).toISOString(),
    notes: "Cancel this one",
    totalCents: 6200
  });

  const cancelledBooking = await platform.cancelBooking(customer.id, {
    bookingId: bookingToCancel.id
  });
  assert.equal(cancelledBooking.status, "cancelled");

  await assert.rejects(
    platform.rescheduleBooking(customer.id, {
      bookingId: cancelledBooking.id,
      scheduledStartIso: new Date(Date.now() + 140 * 60 * 60 * 1000).toISOString(),
      scheduledEndIso: new Date(Date.now() + 141 * 60 * 60 * 1000).toISOString()
    }),
    /Only future requested or confirmed bookings/
  );
});

test("customer reschedules must still respect provider booking conflicts", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-reschedule-conflict@example.com",
    password: "Password123!",
    phone: "555-0201",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress()
  });
  assert.equal(customer.role, "customer");

  const provider = (await repository.listProviders())[0];

  const blockedStart = futureIso(96);
  const blockedEnd = futureIso(99);
  await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress(),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: blockedStart,
    scheduledEndIso: blockedEnd,
    notes: "Existing provider job",
    totalCents: 6200
  });

  const bookingToReschedule = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("117 Garden Row", 30.2437, -97.7634),
    servicePropertyId: customer.defaultPropertyId,
    category: "mulch-installation",
    scheduledStartIso: futureIso(120),
    scheduledEndIso: futureIso(123),
    notes: "Try to move into a conflict",
    totalCents: 8200
  });

  await assert.rejects(
    platform.rescheduleBooking(customer.id, {
      bookingId: bookingToReschedule.id,
      scheduledStartIso: blockedStart,
      scheduledEndIso: blockedEnd
    }),
    /overlaps another YardMatch job/
  );
});

test("customers can start recurring service plans and future visits are generated after completion", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-recurring@example.com",
    password: "Password123!",
    phone: "555-0200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("145 Prospect Ave", 40.6681, -73.9836)
  });

  const provider = (await repository.listProviders())[0];
  assert.ok(provider);

  const slot = (await repository.listSlotsByProvider(provider.id))[1];
  assert.ok(slot);

  const recurring = await platform.createRecurringServicePlan(customer.id, {
    providerId: provider.id,
    serviceAddress: customer.address,
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: slot.startIso,
    scheduledEndIso: slot.endIso,
    notes: "Recurring weekly mow",
    totalCents: 6200,
    frequency: "weekly"
  });

  assert.equal(recurring.plan.plan.frequency, "weekly");
  assert.equal(recurring.initialBooking.recurringPlanId, recurring.plan.plan.id);
  assert.equal(recurring.initialBooking.recurringOccurrenceIndex, 1);

  const beforePlans = await platform.listRecurringServicePlansForCustomer(customer.id);
  assert.equal(beforePlans.plans.length, 1);
  assert.equal(beforePlans.plans[0]?.upcomingBooking?.id, recurring.initialBooking.id);

  await platform.confirmBooking(provider.id, {
    bookingId: recurring.initialBooking.id
  });

  await attachEvidence(
    platform,
    { userId: provider.id, email: provider.email, role: "provider" },
    recurring.initialBooking.id,
    "after"
  );

  await platform.completeBooking(provider.id, {
    bookingId: recurring.initialBooking.id
  });

  const recurringBookings = (await repository.listBookings()).filter(
    (booking) => booking.recurringPlanId === recurring.plan.plan.id
  );
  assert.equal(recurringBookings.length, 2);

  const nextBooking = recurringBookings.find((booking) => booking.id !== recurring.initialBooking.id);
  assert.ok(nextBooking);
  assert.equal(nextBooking?.status, "requested");
  assert.equal(nextBooking?.recurringOccurrenceIndex, 2);
  assert.equal(nextBooking?.scheduledStartIso, new Date(new Date(slot.startIso).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString());

  const cancelledPlan = await platform.cancelRecurringServicePlan(customer.id, {
    planId: recurring.plan.plan.id,
    reason: "Customer paused recurring mowing for the season."
  });

  assert.equal(cancelledPlan.plan.status, "cancelled");
  const cancelledNextBooking = await repository.findBookingById(nextBooking!.id);
  assert.equal(cancelledNextBooking?.status, "cancelled");
});

test("providers can send one-tap late updates to customers for active bookings", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-late@example.com",
    password: "Password123!",
    phone: "555-0200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress()
  });

  const provider = (await repository.listProviders())[0];
  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress(),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(6),
    scheduledEndIso: futureIso(8),
    notes: "Backyard and edging",
    totalCents: 6200
  });

  await platform.confirmBooking(provider.id, {
    bookingId: booking.id
  });

  const lateEtaIso = futureIso(6.5);
  const updatedBooking = await platform.markBookingLate(provider.id, {
    bookingId: booking.id,
    lateEtaIso,
    reason: "Finishing the prior property."
  });

  assert.equal(updatedBooking.lateEtaIso, lateEtaIso);
  assert.equal(updatedBooking.lateReason, "Finishing the prior property.");

  const notifications = await platform.listNotifications({
    userId: customer.id,
    email: customer.email,
    role: "customer"
  });
  assert.ok(
    notifications.notifications.some(
      (notification) =>
        notification.title === "Your provider is running late" &&
        /Finishing the prior property/.test(notification.body)
    )
  );
});

test("outside calendar blocks remove overlapping availability from provider search", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = (await repository.listProviders())[0];
  const providerSlots = await repository.listSlotsByProvider(provider.id);
  const blockedSlot = providerSlots[0];
  const fallbackSlot = providerSlots[1];

  await platform.updateProviderSettings(provider.id, {
    serviceRadiusMiles: provider.serviceRadiusMiles,
    staffingMode: provider.staffingMode,
    sponsoredListingEnabled: provider.sponsoredListingEnabled,
    externalEventsBlockingEnabled: true,
    externalCalendarBlocks: [
      {
        title: "Direct client visit",
        blockType: "off-platform-client",
        startIso: blockedSlot.startIso,
        endIso: blockedSlot.endIso
      }
    ]
  });

  const response = await platform.searchProviders({
    address: provider.address,
    categories: [provider.categories[0]],
    dateIso: blockedSlot.startIso,
    estimatedDurationMinutes: 45
  });

  assert.ok(response.providers.some((item) => item.id === provider.id));
  assert.ok(!response.suggestedSlots.some((slot) => slot.id === blockedSlot.id));
  assert.ok(response.suggestedSlots.some((slot) => slot.id === fallbackSlot.id));
});

test("provider acceptance windows hide too-soon slots and reject booking requests inside the lead window", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-acceptance-window@example.com",
    password: "Password123!",
    phone: "555-0201",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress()
  });

  const provider = (await repository.listProviders())[0];
  assert.ok(provider);
  const providerSlots = await repository.listSlotsByProvider(provider.id);
  const sameDaySlot = providerSlots[0];
  const laterSlot = providerSlots[1];
  assert.ok(sameDaySlot);
  assert.ok(laterSlot);

  const updatedProvider = await platform.updateProviderSettings(provider.id, {
    serviceRadiusMiles: provider.serviceRadiusMiles,
    minimumBookingLeadHours: 12,
    staffingMode: provider.staffingMode,
    sponsoredListingEnabled: provider.sponsoredListingEnabled
  });
  assert.equal(updatedProvider.minimumBookingLeadHours, 12);

  const response = await platform.searchProviders({
    address: provider.address,
    categories: [provider.categories[0]],
    dateIso: sameDaySlot.startIso,
    estimatedDurationMinutes: 45
  });

  assert.ok(!response.suggestedSlots.some((slot) => slot.id === sameDaySlot.id));
  assert.ok(response.suggestedSlots.some((slot) => slot.id === laterSlot.id));

  await assert.rejects(
    platform.createBooking(customer.id, {
      providerId: provider.id,
      serviceAddress: customer.address,
      servicePropertyId: customer.defaultPropertyId,
      category: provider.categories[0],
      scheduledStartIso: sameDaySlot.startIso,
      scheduledEndIso: sameDaySlot.endIso,
      notes: "Try to book inside the provider acceptance window",
      totalCents: 6900
    }),
    /only accepts new bookings/
  );

  const laterBooking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: customer.address,
    servicePropertyId: customer.defaultPropertyId,
    category: provider.categories[0],
    scheduledStartIso: laterSlot.startIso,
    scheduledEndIso: laterSlot.endIso,
    notes: "Book the later acceptance-ready slot",
    totalCents: 6900
  });
  assert.equal(laterBooking.scheduledStartIso, laterSlot.startIso);
});

test("customers cannot book a provider window blocked by an outside calendar event", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-calendar-block@example.com",
    password: "Password123!",
    phone: "555-0200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress()
  });

  const provider = (await repository.listProviders())[0];
  const blockedSlot = (await repository.listSlotsByProvider(provider.id))[0];

  await platform.updateProviderSettings(provider.id, {
    serviceRadiusMiles: provider.serviceRadiusMiles,
    staffingMode: provider.staffingMode,
    sponsoredListingEnabled: provider.sponsoredListingEnabled,
    externalEventsBlockingEnabled: true,
    externalCalendarBlocks: [
      {
        title: "Family appointment",
        blockType: "personal-time",
        startIso: blockedSlot.startIso,
        endIso: blockedSlot.endIso
      }
    ]
  });

  await assert.rejects(
    platform.createBooking(customer.id, {
      providerId: provider.id,
      serviceAddress: customer.address,
      servicePropertyId: customer.defaultPropertyId,
      category: provider.categories[0],
      scheduledStartIso: blockedSlot.startIso,
      scheduledEndIso: blockedSlot.endIso,
      notes: "Try to book during a blocked window",
      totalCents: 6900
    }),
    /outside calendar event/
  );
});

test("providers can log active booking exceptions and notify customers", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-exception@example.com",
    password: "Password123!",
    phone: "555-0200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress()
  });

  const provider = (await repository.listProviders())[0];
  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress(),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(6),
    scheduledEndIso: futureIso(8),
    notes: "Front and back yard",
    totalCents: 6200
  });

  await platform.confirmBooking(provider.id, {
    bookingId: booking.id
  });

  const updatedBooking = await platform.markBookingException(provider.id, {
    bookingId: booking.id,
    exceptionType: "unable-to-access-property",
    notes: "The side gate is locked and there is no alternate entry."
  });

  assert.equal(updatedBooking.activeExceptionType, "unable-to-access-property");
  assert.equal(updatedBooking.activeExceptionNotes, "The side gate is locked and there is no alternate entry.");
  assert.ok(updatedBooking.activeExceptionReportedAt);

  const notifications = await platform.listNotifications({
    userId: customer.id,
    email: customer.email,
    role: "customer"
  });
  assert.ok(
    notifications.notifications.some(
      (notification) =>
        notification.title === "Unable to access property" &&
        /side gate is locked/i.test(notification.body)
    )
  );
});

test("ops support queue includes delay-update drafts for active field exceptions", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-exception-support@example.com",
    password: "Password123!",
    phone: "555-0200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress()
  });

  const provider = (await repository.listProviders())[0];
  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress(),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(6),
    scheduledEndIso: futureIso(8),
    notes: "Support template exception test",
    totalCents: 6200
  });

  await platform.confirmBooking(provider.id, { bookingId: booking.id });
  await platform.markBookingException(provider.id, {
    bookingId: booking.id,
    exceptionType: "unable-to-access-property",
    notes: "The side gate is locked and there is no alternate entry."
  });

  const ticket = await platform.createSupportTicket(
    { userId: customer.id, role: "customer" },
    {
      bookingId: booking.id,
      subject: "Access issue",
      description: "Customer wants an update on the blocked visit.",
      issueType: "service-quality"
    }
  );

  const opsTicket = (await platform.listOpsSupportTickets()).find((candidate) => candidate.ticket.id === ticket.id);
  assert.ok(opsTicket?.resolutionGuidance);
  assert.equal(opsTicket?.resolutionGuidance?.confidence, "low");
  const delayTemplate = opsTicket?.resolutionGuidance?.templates.find(
    (template) => template.key === "delay-update"
  );
  assert.ok(delayTemplate);
  assert.match(delayTemplate?.body ?? "", /side gate is locked/i);
  assert.match(delayTemplate?.body ?? "", /unable to access property/i);
  const providerTemplate = opsTicket?.providerCoordinationTemplates.find(
    (template) => template.key === "field-exception-provider-update"
  );
  assert.ok(providerTemplate);
  assert.equal(providerTemplate?.channel, "email");
  assert.match(providerTemplate?.reason ?? "", /active field exception/i);
  assert.match(providerTemplate?.subject ?? "", /field issue/i);
  assert.match(providerTemplate?.body ?? "", /side gate is locked/i);
  assert.match(providerTemplate?.body ?? "", /earliest realistic continuation or reschedule window/i);

  const accessScript = opsTicket?.exceptionScripts.find((script) => script.key === "field-access-recovery");
  assert.ok(accessScript);
  assert.equal(accessScript?.scenarioKey, "customer-no-show");
  assert.equal(accessScript?.priority, "urgent");
  assert.match(accessScript?.customerUpdate ?? "", /gate code|entry instructions/i);
  assert.match(accessScript?.providerInstruction ?? "", /route can wait/i);
  assert.ok(accessScript?.opsChecklist.some((item) => /audited intervention/i.test(item)));
  assert.ok(accessScript?.escalationTriggers.some((item) => /actively waiting/i.test(item)));
  assert.ok(accessScript?.recommendedActions.includes("request-evidence"));
  assert.ok(accessScript?.recommendedActions.includes("cancel-booking"));
  assert.equal(opsTicket?.ticket.id, ticket.id);
  assert.equal(opsTicket?.ticket.issueType, "service-quality");
  assert.equal(opsTicket?.booking?.activeExceptionType, "unable-to-access-property");
  assert.equal(opsTicket?.booking?.status, "confirmed");
});

test("ops support queue includes weather or route delay exception scripts without changing machine fields", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-route-delay-script@example.com",
    password: "Password123!",
    phone: "555-0200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress()
  });

  const provider = (await repository.listProviders())[0];
  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress(),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(6),
    scheduledEndIso: futureIso(8),
    notes: "Support route-delay script test",
    totalCents: 6200
  });

  await platform.confirmBooking(provider.id, { bookingId: booking.id });
  const lateEtaIso = futureIso(6.75);
  const delayedBooking = await platform.markBookingLate(provider.id, {
    bookingId: booking.id,
    lateEtaIso,
    reason: "Storm cell is slowing the route."
  });

  const ticket = await platform.createSupportTicket(
    { userId: customer.id, role: "customer" },
    {
      bookingId: booking.id,
      subject: "Weather delay",
      description: "Customer wants to know whether the visit is still happening.",
      issueType: "general"
    }
  );

  const opsTicket = (await platform.listOpsSupportTickets()).find((candidate) => candidate.ticket.id === ticket.id);
  assert.ok(opsTicket);
  const weatherScript = opsTicket?.exceptionScripts.find((script) => script.key === "weather-or-route-delay");
  assert.ok(weatherScript);
  assert.equal(weatherScript?.scenarioKey, "weather-delay");
  assert.equal(weatherScript?.priority, "high");
  assert.match(weatherScript?.trigger ?? "", /weather|route/i);
  assert.match(weatherScript?.customerUpdate ?? "", /arrival estimate/i);
  assert.match(weatherScript?.providerInstruction ?? "", /realistic arrival\/completion timing/i);
  assert.ok(weatherScript?.recommendedActions.includes("reschedule-booking"));
  assert.ok(weatherScript?.recommendedActions.includes("escalate-ops-owner"));
  assert.equal(opsTicket?.ticket.id, ticket.id);
  assert.equal(opsTicket?.ticket.issueType, "general");
  assert.equal(opsTicket?.ticket.status, "open");
  assert.equal(opsTicket?.booking?.id, booking.id);
  assert.equal(opsTicket?.booking?.lateEtaIso, lateEtaIso);
  assert.equal(opsTicket?.booking?.lateReason, "Storm cell is slowing the route.");
  assert.equal(delayedBooking.status, "confirmed");
});

test("ops can escalate stale support tickets without mutating stable ticket fields", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-stale-support@example.com",
    password: "Password123!",
    phone: "555-0200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress()
  });

  const provider = (await repository.listProviders())[0];
  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress(),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(6),
    scheduledEndIso: futureIso(8),
    notes: "Support escalation stale ticket test",
    totalCents: 6200
  });

  await platform.confirmBooking(provider.id, { bookingId: booking.id });
  await platform.markBookingException(provider.id, {
    bookingId: booking.id,
    exceptionType: "unable-to-access-property",
    notes: "The side gate is locked and there is no alternate entry."
  });

  const ticket = await platform.createSupportTicket(
    { userId: customer.id, role: "customer" },
    {
      bookingId: booking.id,
      subject: "Access issue needs owner",
      description: "Customer has not heard whether the blocked visit will be recovered.",
      issueType: "service-quality"
    }
  );
  const openedAtIso = new Date("2026-07-20T10:00:00.000Z").toISOString();
  await repository.updateSupportTicket(ticket.id, {
    createdAt: openedAtIso,
    updatedAt: openedAtIso
  });

  const opsUser = (await repository.listOpsUsers())[0];
  assert.ok(opsUser);
  const opsActor = {
    userId: opsUser.id,
    email: opsUser.email,
    role: "ops" as const,
    sessionVersion: 1
  };

  const earlySweep = await platform.escalateStaleOpsSupportTickets(opsActor, {
    ticketId: ticket.id,
    asOfIso: new Date("2026-07-20T11:00:00.000Z").toISOString()
  });
  assert.equal(earlySweep.ticketCount, 1);
  assert.equal(earlySweep.candidateEscalationCount, 1);
  assert.equal(earlySweep.sentNotificationCount, 0);
  assert.equal(earlySweep.items[0]?.escalationStatus, "not-due");
  assert.equal(earlySweep.items[0]?.escalationThresholdHours, 2);

  const escalationSweep = await platform.escalateStaleOpsSupportTickets(opsActor, {
    ticketId: ticket.id,
    asOfIso: new Date("2026-07-20T13:00:00.000Z").toISOString()
  });
  assert.equal(escalationSweep.ticketCount, 1);
  assert.equal(escalationSweep.candidateEscalationCount, 1);
  assert.equal(escalationSweep.dueEscalationCount, 1);
  assert.equal(escalationSweep.sentNotificationCount, 1);
  assert.equal(escalationSweep.items[0]?.escalationStatus, "sent");
  assert.equal(escalationSweep.items[0]?.ticketId, ticket.id);
  assert.equal(escalationSweep.items[0]?.bookingId, booking.id);
  assert.equal(escalationSweep.items[0]?.issueType, "service-quality");
  assert.equal(escalationSweep.items[0]?.ticketStatus, "open");
  assert.equal(escalationSweep.items[0]?.priority, "urgent");
  assert.equal(escalationSweep.items[0]?.openedAtIso, openedAtIso);
  assert.equal(escalationSweep.items[0]?.lastUpdatedAtIso, openedAtIso);
  assert.ok((escalationSweep.items[0]?.hoursSinceUpdate ?? 0) >= 3);

  const opsNotifications = await repository.listNotificationsByRecipient(opsUser.id);
  assert.ok(
    opsNotifications.some(
      (notification) =>
        notification.category === "support" &&
        notification.actionHref === "/ops/support" &&
        notification.body.includes(`Support SLA escalation: ${ticket.id}`)
    )
  );
  const refreshedTicket = (await repository.listSupportTickets()).find((candidate) => candidate.id === ticket.id);
  assert.equal(refreshedTicket?.id, ticket.id);
  assert.equal(refreshedTicket?.bookingId, booking.id);
  assert.equal(refreshedTicket?.issueType, "service-quality");
  assert.equal(refreshedTicket?.status, "open");

  const repeatedSweep = await platform.escalateStaleOpsSupportTickets(opsActor, {
    ticketId: ticket.id,
    asOfIso: new Date("2026-07-20T13:30:00.000Z").toISOString()
  });
  assert.equal(repeatedSweep.sentNotificationCount, 0);
  assert.equal(repeatedSweep.alreadySentCount, 1);
  assert.equal(repeatedSweep.items[0]?.escalationStatus, "already-sent");

  await repository.updateSupportTicket(ticket.id, {
    status: "resolved",
    updatedAt: new Date("2026-07-20T14:00:00.000Z").toISOString(),
    resolvedAt: new Date("2026-07-20T14:00:00.000Z").toISOString(),
    resolutionNotes: "Customer and provider agreed on a recovery window."
  });
  const resolvedSweep = await platform.escalateStaleOpsSupportTickets(opsActor, {
    ticketId: ticket.id,
    asOfIso: new Date("2026-07-20T17:00:00.000Z").toISOString()
  });
  assert.equal(resolvedSweep.sentNotificationCount, 0);
  assert.equal(resolvedSweep.skippedEscalationCount, 1);
  assert.equal(resolvedSweep.items[0]?.escalationStatus, "resolved");

  await assert.rejects(
    platform.escalateStaleOpsSupportTickets(
      {
        userId: "customer-actor",
        email: "customer@example.com",
        role: "customer",
        sessionVersion: 1
      },
      { ticketId: ticket.id }
    ),
    /Only operations can escalate support tickets/
  );
});

test("customers can dispute a booking and automatically create support context", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-dispute@example.com",
    password: "Password123!",
    phone: "555-0200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress()
  });

  const provider = (await repository.listProviders())[0];
  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress(),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(6),
    scheduledEndIso: futureIso(8),
    notes: "Front and back yard",
    totalCents: 6200
  });

  await platform.confirmBooking(provider.id, {
    bookingId: booking.id
  });

  const disputedBooking = await platform.createBookingDispute(
    {
      userId: customer.id,
      email: customer.email,
      role: "customer"
    },
    {
      bookingId: booking.id,
      reason: "The agreed scope changed and I need YardMatch to review the booking."
    }
  );

  assert.equal(disputedBooking.status, "disputed");
  assert.equal(disputedBooking.disputedByRole, "customer");
  assert.match(disputedBooking.disputeReason ?? "", /scope changed/i);
  assert.ok(disputedBooking.disputedAt);

  const supportTickets = await platform.listSupportTicketsForRequester({
    userId: customer.id,
    role: "customer"
  });
  assert.ok(
    supportTickets.some(
      (ticket) =>
        ticket.bookingId === booking.id &&
        ticket.issueType === "service-quality" &&
        /scope changed/i.test(ticket.description)
    )
  );

  const providerNotifications = await platform.listNotifications({
    userId: provider.id,
    email: provider.email,
    role: "provider"
  });
  assert.ok(
    providerNotifications.notifications.some(
      (notification) =>
        notification.title === "Customer opened a dispute" &&
        /support can now step in/i.test(notification.body)
    )
  );
});

test("ops can resolve a disputed booking and restore it to the active schedule", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-dispute-resolve@example.com",
    password: "Password123!",
    phone: "555-0200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress()
  });

  const provider = (await repository.listProviders())[0];
  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress(),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(6),
    scheduledEndIso: futureIso(8),
    notes: "Dispute resolution test",
    totalCents: 6200
  });

  await platform.confirmBooking(provider.id, {
    bookingId: booking.id
  });

  const disputedBooking = await platform.createBookingDispute(
    {
      userId: customer.id,
      email: customer.email,
      role: "customer"
    },
    {
      bookingId: booking.id,
      reason: "Need a support review before the visit continues."
    }
  );
  assert.equal(disputedBooking.status, "disputed");

  const opsQueue = await platform.listOpsSupportTickets();
  const disputeTicket = opsQueue.find(
    (entry) => entry.ticket.bookingId === booking.id && entry.ticket.status === "open"
  );
  assert.ok(disputeTicket);

  const resolvedTicket = await platform.updateSupportTicketForOps({
    ticketId: disputeTicket.ticket.id,
    status: "resolved",
    resolutionAction: "restore-active-booking",
    resolutionNotes: "Support reviewed the dispute and restored the booking."
  });

  assert.equal(resolvedTicket.status, "resolved");
  assert.equal(resolvedTicket.resolutionAction, "restore-active-booking");
  assert.match(resolvedTicket.resolutionNotes ?? "", /restored the booking/i);

  const restoredBooking = await repository.findBookingById(booking.id);
  assert.equal(restoredBooking?.status, "confirmed");
  assert.equal(restoredBooking?.disputeReason, undefined);
  assert.equal(restoredBooking?.activeExceptionType, undefined);
});

test("ops cannot resolve a disputed booking with submitted evidence before reviewing any evidence", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-dispute-evidence-gate@example.com",
    password: "Password123!",
    phone: "555-0200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress()
  });

  const provider = (await repository.listProviders())[0];
  assert.ok(provider);

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress(),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(10),
    scheduledEndIso: futureIso(12),
    notes: "Dispute evidence gate test",
    totalCents: 6200
  });

  await platform.confirmBooking(provider.id, {
    bookingId: booking.id
  });
  await attachEvidence(
    platform,
    { userId: provider.id, email: provider.email, role: "provider" },
    booking.id,
    "after"
  );

  await platform.createBookingDispute(
    {
      userId: customer.id,
      email: customer.email,
      role: "customer"
    },
    {
      bookingId: booking.id,
      reason: "Need support to review the submitted service evidence."
    }
  );

  const disputeTicket = (await platform.listOpsSupportTickets()).find(
    (entry) => entry.ticket.bookingId === booking.id && entry.ticket.status === "open"
  );
  assert.ok(disputeTicket);

  await assert.rejects(
    () =>
      platform.updateSupportTicketForOps({
        ticketId: disputeTicket?.ticket.id ?? "",
        status: "resolved",
        resolutionAction: "restore-active-booking",
        resolutionNotes: "Support resolved the dispute and restored the booking."
      }),
    /review at least one submitted evidence item/i
  );

  const updatedBooking = await repository.findBookingById(booking.id);
  assert.equal(updatedBooking?.status, "disputed");
});

test("disputed bookings cannot start new payment attempts until support resolves them", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(
    repository,
    new DataEngineeringLogger(),
    createFakeStripeGateway()
  );

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-dispute-payment-block@example.com",
    password: "Password123!",
    phone: "555-0200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress()
  });

  const provider = (await repository.listProviders())[0];
  assert.ok(provider);

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress(),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(16),
    scheduledEndIso: futureIso(17),
    notes: "Disputed booking payment block test",
    totalCents: 6400
  });

  await platform.confirmBooking(provider.id, {
    bookingId: booking.id
  });
  await platform.createBookingDispute(
    {
      userId: customer.id,
      email: customer.email,
      role: "customer"
    },
    {
      bookingId: booking.id,
      reason: "Do not continue charging this booking until support reviews it."
    }
  );

  await assert.rejects(
    () =>
      platform.createCheckoutSession(customer.id, {
        bookingId: booking.id
      }),
    /disputed bookings must be resolved by support before payment can continue/i
  );

  await assert.rejects(
    () =>
      platform.createPaymentIntent({
        bookingId: booking.id,
        amountCents: booking.totalCents
      }),
    /disputed bookings must be resolved by support before payment can continue/i
  );

  assert.equal((await repository.listPayments()).length, 0);
});

test("customers can create and finalize Stripe checkout for their own bookings", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(
    repository,
    new DataEngineeringLogger(),
    createFakeStripeGateway()
  );

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-payments@example.com",
    password: "Password123!",
    phone: "555-0200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress()
  });
  assert.equal(customer.role, "customer");

  const provider = (await repository.listProviders())[0];
  assert.ok(provider);

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress(),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(72),
    scheduledEndIso: futureIso(73),
    notes: "Stripe payment test",
    totalCents: 7200
  });

  const checkout = await platform.createCheckoutSession(customer.id, {
    bookingId: booking.id
  });
  assert.equal(checkout.payment.status, "pending");
  assert.equal(checkout.payment.processor, "stripe");
  assert.equal(checkout.checkoutUrl, "https://checkout.stripe.test/session/cs_test_123");

  const beforeFinalize = await platform.listPaymentsForUser({
    userId: customer.id,
    email: customer.email,
    role: "customer"
  });
  assert.equal(beforeFinalize.length, 1);
  assert.equal(beforeFinalize[0]?.status, "pending");

  const finalized = await platform.finalizeCheckoutSession(customer.id, {
    checkoutSessionId: "cs_test_123"
  });
  assert.equal(finalized.status, "captured");
  assert.equal(finalized.processorPaymentIntentId, "pi_test_123");
  assert.ok(finalized.paidAt);
  assert.equal(finalized.refundable, true);
});

test("stripe webhook capture updates pending payments without a customer redirect", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(
    repository,
    new DataEngineeringLogger(),
    createFakeStripeGateway()
  );

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-webhook@example.com",
    password: "Password123!",
    phone: "555-0200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress()
  });
  assert.equal(customer.role, "customer");

  const provider = (await repository.listProviders())[0];
  assert.ok(provider);

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress(),
    servicePropertyId: customer.defaultPropertyId,
    category: "mulch-installation",
    scheduledStartIso: futureIso(72),
    scheduledEndIso: futureIso(75),
    notes: "Webhook payment test",
    totalCents: 9800
  });

  const checkout = await platform.createCheckoutSession(customer.id, {
    bookingId: booking.id
  });
  assert.equal(checkout.payment.status, "pending");

  const webhook = await platform.processStripeWebhook("{}", "sig_test");
  assert.equal(webhook.eventType, "checkout.session.completed");
  assert.equal(webhook.paymentId, checkout.payment.id);

  const payments = await platform.listPaymentsForUser({
    userId: customer.id,
    email: customer.email,
    role: "customer"
  });
  assert.equal(payments[0]?.status, "captured");
});

test("checkout finalization is idempotent when webhook capture wins the redirect race", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(
    repository,
    new DataEngineeringLogger(),
    createFakeStripeGateway()
  );

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-webhook-race@example.com",
    password: "Password123!",
    phone: "555-0200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress()
  });
  assert.equal(customer.role, "customer");

  const provider = (await repository.listProviders())[0];
  assert.ok(provider);

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress(),
    servicePropertyId: customer.defaultPropertyId,
    category: "mulch-installation",
    scheduledStartIso: futureIso(72),
    scheduledEndIso: futureIso(75),
    notes: "Webhook-before-redirect payment test",
    totalCents: 9800
  });

  const checkout = await platform.createCheckoutSession(customer.id, {
    bookingId: booking.id
  });
  assert.equal(checkout.payment.status, "pending");

  await platform.processStripeWebhook("{}", "sig_test");
  await repository.updatePayment(checkout.payment.id, {
    checkoutSessionId: undefined
  });

  const finalized = await platform.finalizeCheckoutSession(customer.id, {
    checkoutSessionId: "cs_test_123"
  });

  assert.equal(finalized.id, checkout.payment.id);
  assert.equal(finalized.status, "captured");
  assert.equal(finalized.processorPaymentIntentId, "pi_test_123");
  assert.equal(finalized.refundable, true);
});

test("failed checkout finalization marks the payment failed and records payment failure telemetry", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const analytics = new DataEngineeringLogger();
  const platform = new MarketplacePlatformService(
    repository,
    analytics,
    createFakeStripeGateway({
      verifyCheckoutSession: async () => ({
        checkoutSessionId: "cs_test_123",
        paymentIntentId: "pi_test_123",
        paid: false,
        failureReason: "Stripe payment has not completed yet."
      })
    })
  );

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-payment-failure@example.com",
    password: "Password123!",
    phone: "555-0200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress()
  });
  assert.equal(customer.role, "customer");

  const provider = (await repository.listProviders())[0];
  assert.ok(provider);

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress(),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(72),
    scheduledEndIso: futureIso(73),
    notes: "Checkout failure test",
    totalCents: 7200
  });

  const checkout = await platform.createCheckoutSession(customer.id, {
    bookingId: booking.id
  });

  await assert.rejects(
    () =>
      platform.finalizeCheckoutSession(customer.id, {
        checkoutSessionId: checkout.payment.checkoutSessionId ?? ""
      }),
    /Stripe payment has not completed yet\./
  );

  const payments = await platform.listPaymentsForUser({
    userId: customer.id,
    email: customer.email,
    role: "customer"
  });
  assert.equal(payments[0]?.status, "failed");

  const paymentFailureEvent = analytics
    .listEvents()
    .find((event) => event.name === MarketplaceTelemetryEventCatalog.paymentFailed);
  assert.ok(paymentFailureEvent);
  assert.equal(paymentFailureEvent?.properties.failureStage, "checkout-finalize");
  assert.equal(paymentFailureEvent?.properties.failureReasonCategory, "not-completed");
});

test("expired checkout webhooks record payment failure telemetry for ops", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const analytics = new DataEngineeringLogger();
  const platform = new MarketplacePlatformService(
    repository,
    analytics,
    createFakeStripeGateway({
      parseWebhookEvent: async () => ({
        type: "checkout.session.expired",
        checkoutSessionId: "cs_test_123",
        paid: false,
        failureReason: "Stripe checkout expired."
      })
    })
  );

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-payment-expired@example.com",
    password: "Password123!",
    phone: "555-0200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress()
  });
  assert.equal(customer.role, "customer");

  const provider = (await repository.listProviders())[0];
  assert.ok(provider);

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress(),
    servicePropertyId: customer.defaultPropertyId,
    category: "mulch-installation",
    scheduledStartIso: futureIso(72),
    scheduledEndIso: futureIso(75),
    notes: "Webhook expiration test",
    totalCents: 9800
  });

  const checkout = await platform.createCheckoutSession(customer.id, {
    bookingId: booking.id
  });

  const webhook = await platform.processStripeWebhook("{}", "sig_test");
  assert.equal(webhook.eventType, "checkout.session.expired");
  assert.equal(webhook.paymentId, checkout.payment.id);

  const overview = await platform.getObservabilityOverview();
  assert.equal(overview.paymentCheckoutStarts, 1);
  assert.equal(overview.paymentFailures, 1);

  const paymentFailureEvent = analytics
    .listEvents()
    .find((event) => event.name === MarketplaceTelemetryEventCatalog.paymentFailed);
  assert.ok(paymentFailureEvent);
  assert.equal(paymentFailureEvent?.properties.failureStage, "webhook");
  assert.equal(paymentFailureEvent?.properties.failureReasonCategory, "expired");
});

test("payment failure webhooks can reconcile pending Stripe payments by payment intent", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const analytics = new DataEngineeringLogger();
  const platform = new MarketplacePlatformService(
    repository,
    analytics,
    createFakeStripeGateway({
      parseWebhookEvent: async () => ({
        type: "payment_intent.payment_failed",
        paymentIntentId: "pi_test_123",
        failureReason: "Your card was declined."
      })
    })
  );

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-payment-failed-webhook@example.com",
    password: "Password123!",
    phone: "555-0200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress()
  });
  assert.equal(customer.role, "customer");

  const provider = (await repository.listProviders())[0];
  assert.ok(provider);

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress(),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(72),
    scheduledEndIso: futureIso(73),
    notes: "Payment failure webhook test",
    totalCents: 7200
  });

  const checkout = await platform.createCheckoutSession(customer.id, {
    bookingId: booking.id
  });
  assert.equal(checkout.payment.processorPaymentIntentId, "pi_test_123");

  const webhook = await platform.processStripeWebhook("{}", "sig_test");
  assert.equal(webhook.eventType, "payment_intent.payment_failed");
  assert.equal(webhook.paymentId, checkout.payment.id);

  const payment = await repository.findPaymentById(checkout.payment.id);
  assert.equal(payment?.status, "failed");

  const paymentFailureEvent = analytics
    .listEvents()
    .find((event) => event.name === MarketplaceTelemetryEventCatalog.paymentFailed);
  assert.ok(paymentFailureEvent);
  assert.equal(paymentFailureEvent?.properties.failureStage, "webhook");
  assert.equal(paymentFailureEvent?.properties.failureReasonCategory, "declined-or-failed");
});

test("refund webhooks can reconcile captured Stripe payments by payment intent", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const analytics = new DataEngineeringLogger();
  const platform = new MarketplacePlatformService(
    repository,
    analytics,
    createFakeStripeGateway({
      parseWebhookEvent: async () => ({
        type: "charge.refunded",
        paymentIntentId: "pi_test_123"
      })
    })
  );

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-refund-webhook@example.com",
    password: "Password123!",
    phone: "555-0200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress()
  });
  assert.equal(customer.role, "customer");

  const provider = (await repository.listProviders())[0];
  assert.ok(provider);

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress(),
    servicePropertyId: customer.defaultPropertyId,
    category: "mulch-installation",
    scheduledStartIso: futureIso(72),
    scheduledEndIso: futureIso(75),
    notes: "Refund webhook test",
    totalCents: 9800
  });

  await platform.createCheckoutSession(customer.id, {
    bookingId: booking.id
  });
  await platform.finalizeCheckoutSession(customer.id, {
    checkoutSessionId: "cs_test_123"
  });

  const webhook = await platform.processStripeWebhook("{}", "sig_test");
  assert.equal(webhook.eventType, "charge.refunded");

  const payment = (await platform.listPaymentsForUser({
    userId: customer.id,
    email: customer.email,
    role: "customer"
  }))[0];
  assert.equal(payment?.status, "refunded");

  const updatedBooking = await repository.findBookingById(booking.id);
  assert.equal(updatedBooking?.status, "refunded");

  const refundCompletedEvent = analytics
    .listEvents()
    .find((event) => event.name === MarketplaceTelemetryEventCatalog.refundCompleted);
  assert.ok(refundCompletedEvent);
  assert.equal(refundCompletedEvent?.properties.source, "stripe-webhook");
});

test("provider payout ledger shows completed jobs waiting on customer payment", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-payout-pending@example.com",
    password: "Password123!",
    phone: "555-0200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress()
  });
  const provider = (await repository.listProviders())[0];
  assert.ok(provider);

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress(),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(72),
    scheduledEndIso: futureIso(73),
    notes: "Pending payout state test",
    totalCents: 7200
  });

  await platform.confirmBooking(provider.id, { bookingId: booking.id });
  await attachEvidence(
    platform,
    { userId: provider.id, email: provider.email, role: "provider" },
    booking.id,
    "after"
  );
  await platform.completeBooking(provider.id, { bookingId: booking.id });

  const ledger = await platform.getProviderPayoutLedger(provider.id);
  const entry = ledger.entries.find((candidate) => candidate.bookingId === booking.id);

  assert.ok(entry);
  assert.equal(entry?.status, "awaiting-customer-payment");
  assert.equal(entry?.grossAmountCents, 7200);
  assert.equal(ledger.pendingCustomerPaymentCents, 7200);
});

test("captured disputed bookings hold provider settlement while crew history stays provider-responsible", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(
    repository,
    new DataEngineeringLogger(),
    createFakeStripeGateway()
  );

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-dispute-payout-hold@example.com",
    password: "Password123!",
    phone: "555-0200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress()
  });
  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-dispute-payout-hold@example.com",
    password: "Password123!",
    phone: "555-0300",
    role: "provider",
    companyName: "Dispute Hold Lawn Co.",
    categories: ["mulch-installation"],
    serviceRadiusMiles: 25,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });
  const crewMember = await platform.registerUser({
    fullName: "Marco Crew",
    email: "crew-dispute-payout-hold@example.com",
    password: "Password123!",
    phone: "555-0400",
    role: "crew-member",
    address: createAddress("118 Garden Row", 30.2437, -97.7634),
    categories: ["mulch-installation"],
    availableWeekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    willingToTravelMiles: 25
  });

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: customer.defaultPropertyId,
    category: "mulch-installation",
    scheduledStartIso: futureIso(72),
    scheduledEndIso: futureIso(75),
    notes: "Dispute payout hold test",
    totalCents: 9600
  });

  const staffing = await platform.getProviderStaffingOverview(provider.id);
  const acceptedMatch = staffing.jobs
    .find((job) => job.bookingId === booking.id)
    ?.matches.find((match) => match.crewMemberId === crewMember.id);
  assert.ok(acceptedMatch);
  await reviewCrewMatchForEligibleProvider(platform, provider.id, {
    crewMatchId: acceptedMatch?.id ?? "",
    action: "accept"
  });

  await platform.confirmBooking(provider.id, { bookingId: booking.id });
  await attachEvidence(
    platform,
    { userId: provider.id, email: provider.email, role: "provider" },
    booking.id,
    "after"
  );
  await platform.completeBooking(provider.id, { bookingId: booking.id });
  await platform.createCheckoutSession(customer.id, { bookingId: booking.id });
  await platform.finalizeCheckoutSession(customer.id, {
    checkoutSessionId: "cs_test_123"
  });

  const disputedBooking = await platform.createBookingDispute(
    {
      userId: customer.id,
      email: customer.email,
      role: "customer"
    },
    {
      bookingId: booking.id,
      reason: "Customer reported the mulch depth was inconsistent."
    }
  );
  assert.equal(disputedBooking.status, "disputed");

  const providerLedger = await platform.getProviderPayoutLedger(provider.id);
  const providerEntry = providerLedger.entries.find((candidate) => candidate.bookingId === booking.id);
  assert.equal(providerEntry?.status, "on-hold");
  assert.match(providerEntry?.note ?? "", /booking dispute is open/i);
  assert.match(providerEntry?.note ?? "", /mulch depth was inconsistent/i);

  const crewLedger = await platform.getCrewPayoutLedger(crewMember.id);
  assert.equal(crewLedger.entries.length, 0);
  assert.equal(crewLedger.earningsSummary.onHoldCents, 0);
  assert.equal(crewLedger.earningsSummary.completedAssignmentCount, 1);
  assert.ok(
    crewLedger.earningsSummary.guidance.some((item) => /provider business.*responsible/i.test(item))
  );
  assert.equal(crewLedger.attendanceSummary.acceptedAssignmentCount, 1);
  assert.equal(crewLedger.attendanceSummary.completedAssignmentCount, 1);
  assert.equal(crewLedger.attendanceSummary.reliabilityStatus, "strong");

  const summary = await platform.getOpsFinancialExceptionSummary();
  assert.equal(summary.refundReviewOpenCount, 0);
  assert.equal(summary.payoutHoldCount, 1);
  assert.equal(summary.disputedBookingCount, 1);
  assert.equal(summary.payoutHolds.length, 1);
  assert.equal(summary.payoutHolds[0]?.holdReason, "dispute");
  assert.equal(summary.payoutHolds[0]?.bookingId, booking.id);
  assert.match(summary.payoutHolds[0]?.notes ?? "", /mulch depth was inconsistent/i);

  const payoutPreview = await platform.getOpsPayoutPreview();
  assert.equal(payoutPreview.onHoldEntryCount, 1);

  const disputeTicket = (await platform.listOpsSupportTickets()).find(
    (entry) => entry.ticket.bookingId === booking.id && entry.ticket.issueType === "service-quality"
  );
  assert.ok(disputeTicket?.booking?.serviceEvidence[0]);

  await platform.reviewBookingEvidenceForOps({
    bookingId: booking.id,
    ticketId: disputeTicket?.ticket.id ?? "",
    evidenceId: disputeTicket?.booking?.serviceEvidence[0]?.id ?? "",
    reviewStatus: "supports-provider",
    reviewNotes: "Support confirmed the completed work evidence supports the provider."
  });

  await platform.updateSupportTicketForOps({
    ticketId: disputeTicket?.ticket.id ?? "",
    status: "resolved",
    resolutionAction: "restore-active-booking",
    resolutionNotes: "Support reviewed the dispute and kept the booking marked complete."
  });

  const resolvedBooking = await repository.findBookingById(booking.id);
  assert.equal(resolvedBooking?.status, "completed");
  assert.equal(resolvedBooking?.disputeReason, undefined);

  const releasedProviderLedger = await platform.getProviderPayoutLedger(provider.id);
  assert.equal(
    releasedProviderLedger.entries.find((candidate) => candidate.bookingId === booking.id)?.status,
    "scheduled"
  );

  const releasedCrewLedger = await platform.getCrewPayoutLedger(crewMember.id);
  assert.equal(releasedCrewLedger.entries.length, 0);
  assert.equal(releasedCrewLedger.earningsSummary.onHoldCents, 0);
  assert.equal(releasedCrewLedger.earningsSummary.scheduledCents, 0);

  const resolvedSummary = await platform.getOpsFinancialExceptionSummary();
  assert.equal(resolvedSummary.payoutHoldCount, 0);
  assert.equal(resolvedSummary.disputedBookingCount, 0);
  assert.equal(resolvedSummary.payoutHolds.length, 0);
});

test("refund review requests hold payouts until ops approves the refund", async () => {
  const repository = new InMemoryMarketplaceRepository();
  let refundedPaymentIntentId: string | undefined;
  const platform = new MarketplacePlatformService(
    repository,
    new DataEngineeringLogger(),
    createFakeStripeGateway({
      createRefund: async (input) => {
        refundedPaymentIntentId = input.paymentIntentId;
        return {
          refundId: "re_test_approved",
          status: "succeeded"
        };
      }
    })
  );

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-payout-ready@example.com",
    password: "Password123!",
    phone: "555-0200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress()
  });
  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-payout-ready@example.com",
    password: "Password123!",
    phone: "555-0300",
    role: "provider",
    companyName: "Ledger Lawn Co.",
    categories: ["mulch-installation"],
    serviceRadiusMiles: 25,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });
  const crewMember = await platform.registerUser({
    fullName: "Marco Crew",
    email: "crew-payout-ready@example.com",
    password: "Password123!",
    phone: "555-0400",
    role: "crew-member",
    address: createAddress("118 Garden Row", 30.2437, -97.7634),
    categories: ["mulch-installation"],
    availableWeekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    willingToTravelMiles: 25
  });

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: customer.defaultPropertyId,
    category: "mulch-installation",
    scheduledStartIso: futureIso(72),
    scheduledEndIso: futureIso(75),
    notes: "Ready payout state test",
    totalCents: 9600
  });

  const staffing = await platform.getProviderStaffingOverview(provider.id);
  const acceptedMatch = staffing.jobs
    .find((job) => job.bookingId === booking.id)
    ?.matches.find((match) => match.crewMemberId === crewMember.id);
  assert.ok(acceptedMatch);
  await reviewCrewMatchForEligibleProvider(platform, provider.id, {
    crewMatchId: acceptedMatch?.id ?? "",
    action: "accept"
  });

  await platform.confirmBooking(provider.id, { bookingId: booking.id });
  await attachEvidence(
    platform,
    { userId: provider.id, email: provider.email, role: "provider" },
    booking.id,
    "after"
  );
  await platform.completeBooking(provider.id, { bookingId: booking.id });

  await platform.createCheckoutSession(customer.id, {
    bookingId: booking.id
  });
  await platform.finalizeCheckoutSession(customer.id, {
    checkoutSessionId: "cs_test_123"
  });

  const providerLedger = await platform.getProviderPayoutLedger(provider.id);
  const providerEntry = providerLedger.entries.find((candidate) => candidate.bookingId === booking.id);
  assert.ok(providerEntry);
  assert.equal(providerEntry?.status, "scheduled");
  assert.equal(providerEntry?.crewShareCents, 0);
  assert.ok((providerEntry?.providerNetAmountCents ?? 0) >= 0);
  assert.match(providerEntry?.note ?? "", /crew compensation.*provider business/i);
  assert.ok(providerLedger.totalNetScheduledCents >= (providerEntry?.providerNetAmountCents ?? 0));

  const crewLedger = await platform.getCrewPayoutLedger(crewMember.id);
  assert.equal(crewLedger.entries.length, 0);
  assert.equal(crewLedger.earningsSummary.scheduledCents, 0);
  assert.ok(crewLedger.earningsSummary.guidance.some((item) => /does not.*pay individual crew/i.test(item)));

  const payment = (await platform.listPaymentsForUser({
    userId: customer.id,
    email: customer.email,
    role: "customer"
  }))[0];
  assert.ok(payment);

  await platform.createRefund(
    {
      userId: customer.id,
      email: customer.email,
      role: "customer"
    },
    {
      paymentId: payment?.id ?? "",
      reason: "Customer requested a refund review."
    }
  );

  const heldProviderLedger = await platform.getProviderPayoutLedger(provider.id);
  assert.equal(
    heldProviderLedger.entries.find((candidate) => candidate.bookingId === booking.id)?.status,
    "on-hold"
  );

  const heldCrewLedger = await platform.getCrewPayoutLedger(crewMember.id);
  assert.equal(heldCrewLedger.entries.length, 0);
  assert.equal(heldCrewLedger.earningsSummary.onHoldCents, 0);

  const refundTicket = (await platform.listOpsSupportTickets()).find(
    (entry) => entry.ticket.bookingId === booking.id && entry.ticket.issueType === "billing"
  );
  assert.ok(refundTicket);
  assert.ok(refundTicket?.booking?.serviceEvidence[0]);

  await platform.reviewBookingEvidenceForOps({
    bookingId: booking.id,
    ticketId: refundTicket?.ticket.id ?? "",
    evidenceId: refundTicket?.booking?.serviceEvidence[0]?.id ?? "",
    reviewStatus: "supports-customer",
    reviewNotes: "Evidence review completed before approving the refund."
  });

  await platform.updateSupportTicketForOps({
    ticketId: refundTicket?.ticket.id ?? "",
    status: "resolved",
    resolutionAction: "approve-refund",
    resolutionNotes: "Support approved the refund review after checking the booking."
  });

  assert.equal(refundedPaymentIntentId, "pi_test_123");

  const reversedProviderLedger = await platform.getProviderPayoutLedger(provider.id);
  assert.equal(
    reversedProviderLedger.entries.find((candidate) => candidate.bookingId === booking.id)?.status,
    "reversed"
  );

  const reversedCrewLedger = await platform.getCrewPayoutLedger(crewMember.id);
  assert.equal(reversedCrewLedger.entries.length, 0);
  assert.equal(reversedCrewLedger.earningsSummary.reversedCents, 0);
});

test("ops cannot approve a Stripe refund review without a saved payment intent", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(
    repository,
    new DataEngineeringLogger(),
    createFakeStripeGateway()
  );

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-refund-missing-intent@example.com",
    password: "Password123!",
    phone: "555-0200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress()
  });
  const provider = (await repository.listProviders())[0];
  assert.ok(provider);

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress(),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(72),
    scheduledEndIso: futureIso(73),
    notes: "Missing payment intent refund test",
    totalCents: 7200
  });

  await platform.confirmBooking(provider.id, { bookingId: booking.id });
  const bookingWithEvidence = await attachEvidence(
    platform,
    { userId: provider.id, email: provider.email, role: "provider" },
    booking.id,
    "after"
  );
  await platform.completeBooking(provider.id, { bookingId: booking.id });

  const manualStripeLikePayment = await repository.createPayment({
    id: "payment-missing-intent",
    bookingId: booking.id,
    amountCents: 7200,
    currency: "usd",
    status: "captured",
    processor: "stripe",
    refundable: false,
    refundReason: "Support is reviewing this payment.",
    refundReviewStatus: "requested",
    refundRequestedAt: new Date().toISOString(),
    refundRequestedByRole: "customer",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  assert.equal(manualStripeLikePayment.processorPaymentIntentId, undefined);

  await repository.createSupportTicket({
    id: "ticket-missing-intent",
    bookingId: booking.id,
    requesterId: customer.id,
    subject: "Refund review requested",
    description: "Customer requested a refund review.",
    issueType: "billing",
    status: "open",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  await platform.reviewBookingEvidenceForOps({
    bookingId: booking.id,
    ticketId: "ticket-missing-intent",
    evidenceId: bookingWithEvidence.serviceEvidence[0]?.id ?? "",
    reviewStatus: "supports-customer",
    reviewNotes: "Ops reviewed the submitted evidence before attempting refund resolution."
  });

  await assert.rejects(
    () =>
      platform.updateSupportTicketForOps({
        ticketId: "ticket-missing-intent",
        status: "resolved",
        resolutionAction: "approve-refund",
        resolutionNotes: "Support approved the refund review after checking the booking."
      }),
    /Stripe refund sync requires a saved payment intent/i
  );

  const updatedPayment = await repository.findPaymentById("payment-missing-intent");
  assert.equal(updatedPayment?.status, "captured");
  assert.equal(updatedPayment?.refundReviewStatus, "requested");
});

test("ops can deny a refund review and return payouts to the normal schedule", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(
    repository,
    new DataEngineeringLogger(),
    createFakeStripeGateway()
  );

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-refund-denied@example.com",
    password: "Password123!",
    phone: "555-0200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress()
  });
  const provider = (await repository.listProviders())[0];
  assert.ok(provider);

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress(),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(72),
    scheduledEndIso: futureIso(73),
    notes: "Refund denial test",
    totalCents: 7200
  });

  await platform.confirmBooking(provider.id, { bookingId: booking.id });
  await attachEvidence(
    platform,
    { userId: provider.id, email: provider.email, role: "provider" },
    booking.id,
    "after"
  );
  await platform.completeBooking(provider.id, { bookingId: booking.id });
  await platform.createCheckoutSession(customer.id, { bookingId: booking.id });
  await platform.finalizeCheckoutSession(customer.id, {
    checkoutSessionId: "cs_test_123"
  });

  const payment = (await platform.listPaymentsForUser({
    userId: customer.id,
    email: customer.email,
    role: "customer"
  }))[0];
  assert.ok(payment);

  await platform.createRefund(
    {
      userId: customer.id,
      email: customer.email,
      role: "customer"
    },
    {
      paymentId: payment?.id ?? "",
      reason: "Please review this payment."
    }
  );

  const refundTicket = (await platform.listOpsSupportTickets()).find(
    (entry) => entry.ticket.bookingId === booking.id && entry.ticket.issueType === "billing"
  );
  assert.ok(refundTicket);
  assert.ok(refundTicket?.booking?.serviceEvidence[0]);

  await platform.reviewBookingEvidenceForOps({
    bookingId: booking.id,
    ticketId: refundTicket?.ticket.id ?? "",
    evidenceId: refundTicket?.booking?.serviceEvidence[0]?.id ?? "",
    reviewStatus: "supports-provider",
    reviewNotes: "Ops reviewed the service proof before denying the refund."
  });

  await platform.updateSupportTicketForOps({
    ticketId: refundTicket?.ticket.id ?? "",
    status: "resolved",
    resolutionAction: "deny-refund",
    resolutionNotes: "Support verified the work and kept the payment captured."
  });

  const updatedPayment = await repository.findPaymentById(payment?.id ?? "");
  assert.equal(updatedPayment?.status, "captured");
  assert.equal(updatedPayment?.refundReviewStatus, "denied");
  assert.equal(updatedPayment?.refundable, true);

  const providerLedger = await platform.getProviderPayoutLedger(provider.id);
  assert.equal(
    providerLedger.entries.find((candidate) => candidate.bookingId === booking.id)?.status,
    "scheduled"
  );
});

test("refund-review support tickets include refund-approved drafts when reviewed evidence supports the customer", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(
    repository,
    new DataEngineeringLogger(),
    createFakeStripeGateway()
  );

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-refund-template@example.com",
    password: "Password123!",
    phone: "555-0200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress()
  });
  const provider = (await repository.listProviders())[0];
  assert.ok(provider);

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress(),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(72),
    scheduledEndIso: futureIso(73),
    notes: "Refund support template test",
    totalCents: 7200
  });

  await platform.confirmBooking(provider.id, { bookingId: booking.id });
  const bookingWithEvidence = await attachEvidence(
    platform,
    { userId: provider.id, email: provider.email, role: "provider" },
    booking.id,
    "after"
  );
  await platform.completeBooking(provider.id, { bookingId: booking.id });
  await platform.createCheckoutSession(customer.id, { bookingId: booking.id });
  await platform.finalizeCheckoutSession(customer.id, {
    checkoutSessionId: "cs_test_123"
  });

  const payment = (await platform.listPaymentsForUser({
    userId: customer.id,
    email: customer.email,
    role: "customer"
  }))[0];
  assert.ok(payment);

  await platform.createRefund(
    {
      userId: customer.id,
      email: customer.email,
      role: "customer"
    },
    {
      paymentId: payment?.id ?? "",
      reason: "Please review this payment."
    }
  );

  const refundTicket = (await platform.listOpsSupportTickets()).find(
    (entry) => entry.ticket.bookingId === booking.id && entry.ticket.issueType === "billing"
  );
  assert.ok(refundTicket);

  await platform.reviewBookingEvidenceForOps({
    bookingId: booking.id,
    ticketId: refundTicket?.ticket.id ?? "",
    evidenceId: bookingWithEvidence.serviceEvidence[0]?.id ?? "",
    reviewStatus: "supports-customer",
    reviewNotes: "Ops reviewed the submitted evidence before refund approval."
  });

  const updatedRefundTicket = (await platform.listOpsSupportTickets()).find(
    (entry) => entry.ticket.id === refundTicket?.ticket.id
  );
  assert.equal(updatedRefundTicket?.resolutionGuidance?.recommendedAction, "approve-refund");
  const refundTemplate = updatedRefundTicket?.resolutionGuidance?.templates.find(
    (template) => template.key === "refund-approved"
  );
  assert.ok(refundTemplate);
  assert.match(refundTemplate?.body ?? "", /approving the refund review/i);
});

test("ops cannot resolve a refund review with submitted evidence before reviewing any evidence", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(
    repository,
    new DataEngineeringLogger(),
    createFakeStripeGateway()
  );

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-refund-evidence-gate@example.com",
    password: "Password123!",
    phone: "555-0200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress()
  });
  const provider = (await repository.listProviders())[0];
  assert.ok(provider);

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress(),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(76),
    scheduledEndIso: futureIso(77),
    notes: "Refund evidence gate test",
    totalCents: 7200
  });

  await platform.confirmBooking(provider.id, { bookingId: booking.id });
  await attachEvidence(
    platform,
    { userId: provider.id, email: provider.email, role: "provider" },
    booking.id,
    "after"
  );
  await platform.completeBooking(provider.id, { bookingId: booking.id });
  await platform.createCheckoutSession(customer.id, { bookingId: booking.id });
  await platform.finalizeCheckoutSession(customer.id, {
    checkoutSessionId: "cs_test_123"
  });

  const payment = (await platform.listPaymentsForUser({
    userId: customer.id,
    email: customer.email,
    role: "customer"
  }))[0];
  assert.ok(payment);

  await platform.createRefund(
    {
      userId: customer.id,
      email: customer.email,
      role: "customer"
    },
    {
      paymentId: payment?.id ?? "",
      reason: "Please review this payment."
    }
  );

  const refundTicket = (await platform.listOpsSupportTickets()).find(
    (entry) => entry.ticket.bookingId === booking.id && entry.ticket.issueType === "billing"
  );
  assert.ok(refundTicket);

  await assert.rejects(
    () =>
      platform.updateSupportTicketForOps({
        ticketId: refundTicket?.ticket.id ?? "",
        status: "resolved",
        resolutionAction: "deny-refund",
        resolutionNotes: "Support reviewed the refund request and kept the payment captured."
      }),
    /review at least one submitted evidence item/i
  );

  const updatedPayment = await repository.findPaymentById(payment?.id ?? "");
  assert.equal(updatedPayment?.refundReviewStatus, "requested");
});

test("provider payout ledger exposes weekly and instant payout schedule details", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(
    repository,
    new DataEngineeringLogger(),
    createFakeStripeGateway()
  );

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-payout-schedule@example.com",
    password: "Password123!",
    phone: "555-0200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress()
  });
  const provider = (await repository.listProviders())[0];
  assert.ok(provider);

  await platform.updateProviderSettings(provider.id, {
    serviceRadiusMiles: provider.serviceRadiusMiles,
    staffingMode: provider.staffingMode,
    crewReviewLeadHours: provider.crewReviewLeadHours,
    departureReminderLeadMinutes: provider.departureReminderLeadMinutes,
    routeLeaderMode: provider.routeLeaderMode,
    weeklyPayoutDay: "Tue",
    instantPayoutsEnabled: true,
    sponsoredListingEnabled: provider.sponsoredListingEnabled
  });

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress(),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(72),
    scheduledEndIso: futureIso(73),
    notes: "Provider payout schedule test",
    totalCents: 12800
  });

  await platform.confirmBooking(provider.id, { bookingId: booking.id });
  await attachEvidence(
    platform,
    { userId: provider.id, email: provider.email, role: "provider" },
    booking.id,
    "after"
  );
  await platform.completeBooking(provider.id, { bookingId: booking.id });
  await platform.createCheckoutSession(customer.id, { bookingId: booking.id });
  await platform.finalizeCheckoutSession(customer.id, { checkoutSessionId: "cs_test_123" });
  await repository.updateBooking(booking.id, {
    completedAt: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString()
  });

  const ledger = await platform.getProviderPayoutLedger(provider.id);
  const entry = ledger.entries.find((candidate) => candidate.bookingId === booking.id);

  assert.ok(entry);
  assert.equal(entry?.status, "ready");
  assert.equal(ledger.payoutSchedule.weeklyPayoutDay, "Tue");
  assert.equal(ledger.payoutSchedule.instantPayoutsEnabled, true);
  assert.equal(ledger.payoutSchedule.instantPayoutMinimumCents, 10000);
  assert.equal(ledger.payoutSchedule.instantPayoutEligibleCents, entry?.providerNetAmountCents ?? 0);
  assert.equal(ledger.payoutSchedule.holdPeriodHours, 48);
});

test("ops payout preview groups ready balances into upcoming payout runs", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(
    repository,
    new DataEngineeringLogger(),
    createFakeStripeGateway()
  );

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-ops-payout-preview@example.com",
    password: "Password123!",
    phone: "555-0200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress()
  });
  const providers = await repository.listProviders();
  assert.ok(providers.length >= 2);
  const firstBookingStartIso = futureIso(72);
  const firstBookingDay = availabilityDayForIso(firstBookingStartIso);
  const crewMember = await platform.registerUser({
    fullName: "Casey Payout Crew",
    email: "crew-ops-payout-preview@example.com",
    password: "Password123!",
    phone: "555-0201",
    role: "crew-member",
    address: createAddress("114 Garden Row", 30.2436, -97.7639),
    categories: ["lawn-mowing"],
    availableWeekdays: [firstBookingDay],
    willingToTravelMiles: 20,
    preferredSchedule: "part-time",
    hasOwnEquipment: true
  });
  assert.equal(crewMember.role, "crew-member");

  await platform.updateProviderSettings(providers[0]!.id, {
    serviceRadiusMiles: providers[0]!.serviceRadiusMiles,
    staffingMode: "auto-accept",
    crewReviewLeadHours: providers[0]!.crewReviewLeadHours,
    departureReminderLeadMinutes: providers[0]!.departureReminderLeadMinutes,
    routeLeaderMode: providers[0]!.routeLeaderMode,
    weeklyPayoutDay: "Tue",
    instantPayoutsEnabled: true,
    sponsoredListingEnabled: providers[0]!.sponsoredListingEnabled
  });
  await platform.updateProviderSettings(providers[1]!.id, {
    serviceRadiusMiles: providers[1]!.serviceRadiusMiles,
    staffingMode: providers[1]!.staffingMode,
    crewReviewLeadHours: providers[1]!.crewReviewLeadHours,
    departureReminderLeadMinutes: providers[1]!.departureReminderLeadMinutes,
    routeLeaderMode: providers[1]!.routeLeaderMode,
    weeklyPayoutDay: "Fri",
    instantPayoutsEnabled: false,
    sponsoredListingEnabled: providers[1]!.sponsoredListingEnabled
  });

  const firstBooking = await platform.createBooking(customer.id, {
    providerId: providers[0]!.id,
    serviceAddress: createAddress(),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: firstBookingStartIso,
    scheduledEndIso: futureIso(73),
    notes: "Ops payout preview first provider",
    totalCents: 14200
  });
  const secondBooking = await platform.createBooking(customer.id, {
    providerId: providers[1]!.id,
    serviceAddress: createAddress("118 Garden Row", 30.2437, -97.76395),
    servicePropertyId: customer.defaultPropertyId,
    category: "hedge-trimming",
    scheduledStartIso: futureIso(80),
    scheduledEndIso: futureIso(81),
    notes: "Ops payout preview second provider",
    totalCents: 8600
  });
  const firstStaffing = await platform.getProviderStaffingOverview(providers[0]!.id);
  const firstJob = firstStaffing.jobs.find((job) => job.bookingId === firstBooking.id);
  const acceptedCrewMatch = firstJob?.matches.find(
    (match) => match.crewMemberId === crewMember.id && match.status === "accepted"
  );
  assert.ok(acceptedCrewMatch);

  for (const current of [
    { booking: firstBooking, provider: providers[0]! },
    { booking: secondBooking, provider: providers[1]! }
  ]) {
    await platform.confirmBooking(current.provider.id, { bookingId: current.booking.id });
    await attachEvidence(
      platform,
      { userId: current.provider.id, email: current.provider.email, role: "provider" },
      current.booking.id,
      "after"
    );
    await platform.completeBooking(current.provider.id, { bookingId: current.booking.id });
    const checkout = await platform.createCheckoutSession(customer.id, { bookingId: current.booking.id });
    await repository.updatePayment(checkout.payment.id, {
      status: "captured",
      paymentIntentId: checkout.payment.paymentIntentId ?? "pi_test_123",
      updatedAt: new Date().toISOString()
    });
    await repository.updateBooking(current.booking.id, {
      completedAt: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString()
    });
  }

  const preview = await platform.getOpsPayoutPreview();
  const firstSettlement = await repository.findBookingFinancialSettlement(firstBooking.id);
  const secondSettlement = await repository.findBookingFinancialSettlement(secondBooking.id);
  assert.ok(firstSettlement);
  assert.ok(secondSettlement);
  const expectedProviderReadyCents = firstSettlement.providerNetCents + secondSettlement.providerNetCents;
  const providerDisbursementBatches = preview.disbursementBatches.filter(
    (batch) => batch.recipientRole === "provider"
  );
  const firstProviderBatch = providerDisbursementBatches.find((batch) =>
    batch.recipientIds.includes(providers[0]!.id)
  );

  assert.equal(preview.providerRuns.length, 2);
  assert.equal(preview.providerInstantEligibleCount, 1);
  assert.equal(preview.totalProviderReadyCents, expectedProviderReadyCents);
  assert.equal(preview.totalCrewReadyCents, 0);
  assert.equal(preview.disbursementBatches.some((batch) => batch.recipientRole === "crew-member"), false);
  assert.ok(
    preview.providerRuns.some(
      (run) => run.providerCount === 1 && run.providerNetCents === firstSettlement.providerNetCents
    )
  );
  assert.equal(preview.payoutPolicy.disbursementRailStatus, "manual-preview-only");
  assert.equal(preview.payoutPolicy.providerHoldPeriodHours, 48);
  assert.equal(preview.payoutPolicy.crewHoldPeriodHours, 0);
  assert.equal(preview.payoutPolicy.crewCompensationResponsibility, "provider");
  assert.match(preview.payoutPolicy.providerWeeklyRunRule, /crew compensation never enters/i);
  assert.equal(preview.payoutPolicy.instantPayoutMinimumCents, 10000);
  assert.ok(
    preview.payoutPolicy.readyRequirements.some((requirement) => /customer payment captured/i.test(requirement))
  );
  assert.ok(
    preview.payoutPolicy.holdReasons.some((reason) => /refund review/i.test(reason))
  );
  assert.ok(providerDisbursementBatches.length >= 2);
  assert.ok(
    providerDisbursementBatches.some(
      (batch) =>
        batch.railMode === "manual-preview" &&
        batch.actionStatus === "ready-for-manual-review" &&
        batch.entryIds.includes(`provider-payout-${firstBooking.id}`) &&
        batch.recipientIds.includes(providers[0]!.id) &&
        batch.blockerReasons.some((reason) => /external payout rails/i.test(reason))
    )
  );
  assert.ok(firstProviderBatch);
  assert.equal(firstProviderBatch?.totalCents, firstSettlement.providerNetCents);
  assert.ok(firstProviderBatch?.entryIds.includes(`provider-payout-${firstBooking.id}`));
  assert.equal(firstProviderBatch?.recipientIds.includes(crewMember.id), false);

  const opsActor = {
    userId: "ops-payout-run-reviewer",
    email: "ops-payout-run-reviewer@yardmatch.test",
    role: "ops" as const,
    sessionVersion: 1
  };
  const createdRun = await platform.createOpsPayoutDisbursementRun(opsActor, {
    previewBatchId: firstProviderBatch!.id,
    operatorNotes: "Prepared for manual provider-settlement review."
  });

  assert.equal(createdRun.created, true);
  assert.equal(createdRun.matchedPreviewBatch.id, firstProviderBatch?.id);
  assert.equal(createdRun.run.previewBatchId, firstProviderBatch?.id);
  assert.equal(createdRun.run.status, "manual-review");
  assert.equal(createdRun.run.railMode, "manual-preview");
  assert.equal(createdRun.run.recipientRole, "provider");
  assert.equal(createdRun.run.totalCents, firstSettlement.providerNetCents);
  assert.equal(createdRun.run.entryIds[0], `provider-payout-${firstBooking.id}`);
  assert.equal(createdRun.run.entries[0]?.bookingId, firstBooking.id);
  assert.equal(createdRun.run.entries[0]?.paymentId, firstProviderBatch?.entries[0]?.paymentId);
  assert.equal(createdRun.run.createdByOpsUserId, opsActor.userId);
  assert.match(createdRun.run.entryFingerprint, /^[a-f0-9]{64}$/);
  assert.ok(
    createdRun.run.auditInstructions.some((instruction) =>
      /external bank or payout-provider reference/i.test(instruction)
    )
  );

  const duplicateRun = await platform.createOpsPayoutDisbursementRun(opsActor, {
    previewBatchId: firstProviderBatch!.id,
    operatorNotes: "Second click should reuse the same audit record."
  });
  assert.equal(duplicateRun.created, false);
  assert.equal(duplicateRun.run.id, createdRun.run.id);
  assert.equal(duplicateRun.run.operatorNotes, "Prepared for manual provider-settlement review.");

  const recordedRuns = await platform.listOpsPayoutDisbursementRuns();
  assert.equal(recordedRuns.runs.length, 1);
  assert.equal(recordedRuns.runs[0]?.id, createdRun.run.id);

  await assert.rejects(
    () =>
      platform.createOpsPayoutDisbursementRun(
        {
          userId: customer.id,
          email: customer.email,
          role: "customer",
          sessionVersion: 1
        },
        { previewBatchId: firstProviderBatch!.id }
      ),
    /Only operations can create payout disbursement runs/i
  );
});

test("Stripe provider transfers reconcile actual fees, execute once, and keep the ledger balanced", async () => {
  const fixture = await createExecutedStripeProviderTransferFixture();

  assert.equal(fixture.payment.processorFeeStatus, "reconciled");
  assert.equal(fixture.payment.processorChargeId, "ch_test_123");
  assert.equal(fixture.payment.actualProcessorFeeCents, 225);
  assert.equal(fixture.executed.run.status, "transferred");
  assert.equal(fixture.executed.transferredCount, 1);
  assert.equal(fixture.executed.failedCount, 0);
  assert.equal(fixture.transferInputs.length, 1);
  assert.equal(fixture.transferInputs[0]?.stripeAccountId, `acct_${fixture.provider.id}`);
  assert.equal(fixture.transferInputs[0]?.sourceTransactionId, "ch_test_123");

  const settlement = await fixture.repository.findBookingFinancialSettlement(fixture.booking.id);
  assert.ok(settlement);
  assert.equal(settlement.status, "transferred");
  assert.equal(settlement.actualProcessorFeeCents, 225);
  assert.equal(fixture.executed.transfers[0]?.providerId, fixture.provider.id);
  assert.equal(
    fixture.executed.transfers.some(
      (transfer) => transfer.providerId !== fixture.provider.id
    ),
    false
  );

  const ledgerEntries = await fixture.repository.listFinancialLedgerEntries(fixture.booking.id);
  const debits = ledgerEntries
    .filter((entry) => entry.direction === "debit")
    .reduce((sum, entry) => sum + entry.amountCents, 0);
  const credits = ledgerEntries
    .filter((entry) => entry.direction === "credit")
    .reduce((sum, entry) => sum + entry.amountCents, 0);
  assert.equal(debits, credits);
  assert.equal(
    ledgerEntries.filter((entry) => entry.source === "provider-transfer").length,
    2
  );

  const retried = await withMockedNow(
    new Date(Date.parse(fixture.createdRun.runDateIso) + 2_000).toISOString(),
    () =>
      fixture.platform.executeOpsPayoutDisbursementRun(fixture.opsActor, {
        runId: fixture.createdRun.id,
        confirmation: "execute-provider-transfers",
        operatorNotes: "Idempotency recheck for the already completed provider transfer."
      })
  );
  assert.equal(retried.transferredCount, 0);
  assert.equal(retried.alreadyTransferredCount, 1);
  assert.equal(fixture.transferInputs.length, 1);

  const payoutLedger = await fixture.platform.getProviderPayoutLedger(fixture.provider.id);
  assert.equal(
    payoutLedger.entries.find((entry) => entry.bookingId === fixture.booking.id)?.status,
    "paid"
  );
});

test("failed provider transfers keep an audited reason and can be retried safely", async () => {
  const fixture = await createExecutedStripeProviderTransferFixture({
    transferErrors: [new Error("Stripe recipient transfer was temporarily unavailable.")]
  });

  assert.equal(fixture.executed.run.status, "failed");
  assert.equal(fixture.executed.failedCount, 1);
  assert.ok(
    fixture.executed.run.blockerReasons.some((reason) =>
      /temporarily unavailable/i.test(reason)
    )
  );
  assert.equal(fixture.executed.transfers[0]?.status, "failed");

  const retried = await withMockedNow(
    new Date(Date.parse(fixture.createdRun.runDateIso) + 3_000).toISOString(),
    () =>
      fixture.platform.executeOpsPayoutDisbursementRun(fixture.opsActor, {
        runId: fixture.createdRun.id,
        confirmation: "execute-provider-transfers",
        operatorNotes: "Retry after confirming the temporary Stripe transfer failure cleared."
      })
  );
  assert.equal(retried.run.status, "transferred");
  assert.deepEqual(retried.run.blockerReasons, []);
  assert.equal(retried.transferredCount, 1);
  assert.equal(retried.failedCount, 0);
  assert.equal(fixture.transferInputs.length, 2);
  assert.equal(
    fixture.transferInputs[0]?.idempotencyKey,
    fixture.transferInputs[1]?.idempotencyKey
  );
});

test("provider Connect onboarding reuses one recipient and blocks transfers until capabilities are active", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const createdProviderIds: string[] = [];
  const platform = new MarketplacePlatformService(
    repository,
    new DataEngineeringLogger(),
    createFakeStripeGateway(),
    "http://localhost:3000",
    createFakeStripeConnectGateway({
      readiness: {
        transfersStatus: "pending",
        payoutsStatus: "restricted",
        onboardingStatus: "restricted"
      },
      onCreateAccount: (providerId) => createdProviderIds.push(providerId)
    })
  );
  const provider = (await repository.listProviders())[0];
  assert.ok(provider);
  const firstOnboarding = await platform.startProviderConnectOnboarding(provider.id);
  const secondOnboarding = await platform.startProviderConnectOnboarding(provider.id);
  assert.equal(createdProviderIds.length, 1);
  assert.equal(firstOnboarding.account?.stripeAccountId, secondOnboarding.account?.stripeAccountId);
  assert.equal(firstOnboarding.account?.dashboard, "express");
  assert.equal(firstOnboarding.account?.feesCollector, "application");
  assert.equal(firstOnboarding.account?.lossesCollector, "application");
  assert.equal(firstOnboarding.chargePattern, "separate-charges-and-transfers");
  assert.equal(firstOnboarding.crewCompensationResponsibility, "provider");
  assert.equal(firstOnboarding.transferReady, false);

  const customer = await platform.registerUser({
    fullName: "Restricted Connect Customer",
    email: "restricted-connect-customer@example.com",
    password: "Password123!",
    phone: "555-0217",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress()
  });
  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress(),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(72),
    scheduledEndIso: futureIso(73),
    notes: "Restricted Connect payout gate",
    totalCents: 8_400
  });
  await platform.confirmBooking(provider.id, { bookingId: booking.id });
  await attachEvidence(
    platform,
    { userId: provider.id, email: provider.email, role: "provider" },
    booking.id,
    "after"
  );
  await platform.completeBooking(provider.id, { bookingId: booking.id });
  await platform.createCheckoutSession(customer.id, { bookingId: booking.id });
  await platform.finalizeCheckoutSession(customer.id, { checkoutSessionId: "cs_test_123" });
  await repository.updateBooking(booking.id, {
    completedAt: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString()
  });
  const preview = await platform.getOpsPayoutPreview();
  const providerBatch = preview.disbursementBatches.find((candidate) =>
    candidate.recipientIds.includes(provider.id)
  );
  assert.equal(providerBatch?.railMode, "stripe-transfer");
  assert.equal(providerBatch?.actionStatus, "blocked");
  assert.ok(
    providerBatch?.blockerReasons.some((reason) => /not both active/i.test(reason))
  );
});

test("provider settlements stay on hold when Stripe fee reconciliation fails", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(
    repository,
    new DataEngineeringLogger(),
    createFakeStripeGateway({
      retrieveChargeFinancials: async () => {
        throw new Error("Stripe balance transaction is not available yet.");
      }
    })
  );
  const customer = await platform.registerUser({
    fullName: "Fee Hold Customer",
    email: "fee-hold-customer@example.com",
    password: "Password123!",
    phone: "555-0218",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress()
  });
  const provider = (await repository.listProviders())[0];
  assert.ok(provider);
  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress(),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(72),
    scheduledEndIso: futureIso(73),
    notes: "Processor fee reconciliation hold",
    totalCents: 7_900
  });
  await platform.confirmBooking(provider.id, { bookingId: booking.id });
  await attachEvidence(
    platform,
    { userId: provider.id, email: provider.email, role: "provider" },
    booking.id,
    "after"
  );
  await platform.completeBooking(provider.id, { bookingId: booking.id });
  await platform.createCheckoutSession(customer.id, { bookingId: booking.id });
  const payment = await platform.finalizeCheckoutSession(customer.id, {
    checkoutSessionId: "cs_test_123"
  });
  assert.equal(payment.status, "captured");
  assert.equal(payment.processorFeeStatus, "failed");
  assert.equal(await repository.findBookingFinancialSettlement(booking.id), undefined);
  const ledger = await platform.getProviderPayoutLedger(provider.id);
  const entry = ledger.entries.find((candidate) => candidate.bookingId === booking.id);
  assert.equal(entry?.status, "on-hold");
  assert.match(entry?.note ?? "", /processing fees are reconciled/i);
});

test("Stripe refund webhooks reverse released provider transfers exactly once", async () => {
  let eventType = "charge.refunded";
  const fixture = await createExecutedStripeProviderTransferFixture({
    parseWebhookEvent: async () => ({
      type: eventType,
      paymentIntentId: "pi_test_123"
    })
  });

  const firstWebhook = await fixture.platform.processStripeWebhook("{}", "sig_test");
  assert.equal(firstWebhook.eventType, "charge.refunded");
  assert.equal(fixture.reversalInputs.length, 1);
  const settlement = await fixture.repository.findBookingFinancialSettlement(fixture.booking.id);
  const transfer = settlement
    ? await fixture.repository.findProviderTransferBySettlementId(settlement.id)
    : undefined;
  assert.equal(settlement?.status, "reversed");
  assert.equal(transfer?.status, "reversed");
  assert.ok(transfer?.stripeTransferReversalId);
  assert.equal(
    (await fixture.repository.listPayoutDisbursementRuns()).find(
      (run) => run.id === fixture.createdRun.id
    )?.status,
    "reversed"
  );

  await fixture.platform.processStripeWebhook("{}", "sig_test");
  assert.equal(fixture.reversalInputs.length, 1);
  const ledgerEntries = await fixture.repository.listFinancialLedgerEntries(fixture.booking.id);
  assert.equal(ledgerEntries.filter((entry) => entry.source === "reversal").length, 2);
  const payoutLedger = await fixture.platform.getProviderPayoutLedger(fixture.provider.id);
  assert.equal(
    payoutLedger.entries.find((entry) => entry.bookingId === fixture.booking.id)?.status,
    "reversed"
  );
  const replayedRun = await withMockedNow(
    new Date(Date.parse(fixture.createdRun.runDateIso) + 4_000).toISOString(),
    () =>
      fixture.platform.executeOpsPayoutDisbursementRun(fixture.opsActor, {
        runId: fixture.createdRun.id,
        confirmation: "execute-provider-transfers",
        operatorNotes: "Confirm the reversed transfer run remains terminal and idempotent."
      })
  );
  assert.equal(replayedRun.run.status, "reversed");
  assert.equal(replayedRun.transferredCount, 0);
  assert.equal(replayedRun.failedCount, 0);
  assert.equal(fixture.transferInputs.length, 1);
  eventType = "charge.refunded";
});

test("approved in-product refunds reverse a released provider transfer before refunding", async () => {
  const fixture = await createExecutedStripeProviderTransferFixture();
  await fixture.platform.createRefund(
    { userId: fixture.customer.id, role: "customer" },
    {
      paymentId: fixture.payment.id,
      reason: "The customer reported a material service-quality problem after payout release."
    }
  );
  const heldLedger = await fixture.platform.getProviderPayoutLedger(fixture.provider.id);
  assert.equal(
    heldLedger.entries.find((entry) => entry.bookingId === fixture.booking.id)?.status,
    "on-hold"
  );
  assert.equal(fixture.reversalInputs.length, 0);

  const ticket = (await fixture.repository.listSupportTickets()).find(
    (candidate) =>
      candidate.bookingId === fixture.booking.id && candidate.issueType === "billing"
  );
  const booking = await fixture.repository.findBookingById(fixture.booking.id);
  const evidence = booking?.serviceEvidence[0];
  assert.ok(ticket);
  assert.ok(evidence);
  await fixture.platform.reviewBookingEvidenceForOps({
    bookingId: fixture.booking.id,
    ticketId: ticket.id,
    evidenceId: evidence.id,
    reviewStatus: "supports-customer",
    reviewNotes: "The submitted evidence supports the customer's refund request."
  });
  await fixture.platform.updateSupportTicketForOps({
    ticketId: ticket.id,
    status: "resolved",
    resolutionAction: "approve-refund",
    resolutionNotes: "Approved after evidence review confirmed the service-quality issue."
  });

  assert.equal(fixture.reversalInputs.length, 1);
  const settlement = await fixture.repository.findBookingFinancialSettlement(fixture.booking.id);
  const transfer = settlement
    ? await fixture.repository.findProviderTransferBySettlementId(settlement.id)
    : undefined;
  assert.equal(settlement?.status, "reversed");
  assert.equal(transfer?.status, "reversed");
  assert.equal((await fixture.repository.findPaymentById(fixture.payment.id))?.status, "refunded");
});

test("in-product booking disputes hold an already released transfer pending support resolution", async () => {
  const fixture = await createExecutedStripeProviderTransferFixture();

  const disputed = await fixture.platform.createBookingDispute(
    { userId: fixture.customer.id, role: "customer" },
    {
      bookingId: fixture.booking.id,
      reason: "The completed service needs a quality review after payout release."
    }
  );

  assert.equal(disputed.status, "disputed");
  assert.equal(fixture.reversalInputs.length, 0);
  const settlement = await fixture.repository.findBookingFinancialSettlement(fixture.booking.id);
  const transfer = settlement
    ? await fixture.repository.findProviderTransferBySettlementId(settlement.id)
    : undefined;
  assert.equal(settlement?.status, "transferred");
  assert.equal(transfer?.status, "transferred");
  const payoutLedger = await fixture.platform.getProviderPayoutLedger(fixture.provider.id);
  assert.equal(
    payoutLedger.entries.find((entry) => entry.bookingId === fixture.booking.id)?.status,
    "on-hold"
  );
});

test("Stripe dispute webhooks reverse released provider transfers and open a payout hold", async () => {
  const fixture = await createExecutedStripeProviderTransferFixture({
    parseWebhookEvent: async () => ({
      type: "charge.dispute.created",
      paymentIntentId: "pi_test_123",
      disputeId: "dp_test_123",
      disputedAmountCents: 12_800,
      disputeReason: "product_not_received"
    })
  });

  const webhook = await fixture.platform.processStripeWebhook("{}", "sig_test");
  assert.equal(webhook.eventType, "charge.dispute.created");
  assert.equal(fixture.reversalInputs.length, 1);
  const booking = await fixture.repository.findBookingById(fixture.booking.id);
  assert.equal(booking?.status, "disputed");
  assert.match(booking?.disputeReason ?? "", /dp_test_123/);
  const settlement = await fixture.repository.findBookingFinancialSettlement(fixture.booking.id);
  assert.equal(settlement?.status, "reversed");
  assert.ok(
    (await fixture.repository.listSupportTickets()).some(
      (ticket) => ticket.bookingId === fixture.booking.id
    )
  );
});

test("customer service can open a refund review override from a billing ticket", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(
    repository,
    new DataEngineeringLogger(),
    createFakeStripeGateway()
  );

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-ops-override@example.com",
    password: "Password123!",
    phone: "555-0200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress()
  });
  const provider = (await repository.listProviders())[0];
  assert.ok(provider);

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress(),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(72),
    scheduledEndIso: futureIso(73),
    notes: "Ops refund override coverage",
    totalCents: 7100
  });

  await platform.confirmBooking(provider.id, { bookingId: booking.id });
  await attachEvidence(
    platform,
    { userId: provider.id, email: provider.email, role: "provider" },
    booking.id,
    "after"
  );
  await platform.completeBooking(provider.id, { bookingId: booking.id });

  await platform.createCheckoutSession(customer.id, {
    bookingId: booking.id
  });
  await platform.finalizeCheckoutSession(customer.id, {
    checkoutSessionId: "cs_test_123"
  });

  const payment = (await platform.listPaymentsForUser({
    userId: customer.id,
    email: customer.email,
    role: "customer"
  }))[0];
  assert.ok(payment);

  const ticket = await repository.createSupportTicket({
    id: crypto.randomUUID(),
    bookingId: booking.id,
    requesterId: customer.id,
    subject: "Billing question",
    description: "Customer called support about this charge.",
    issueType: "billing",
    status: "open",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  const overriddenPayment = await platform.createOpsRefundOverride({
    ticketId: ticket.id,
    paymentId: payment.id,
    reason: "Customer service opened a refund review after validating the billing complaint."
  });

  assert.equal(overriddenPayment.refundReviewStatus, "requested");
  assert.equal(overriddenPayment.refundRequestedByRole, "ops");

  const updatedTicket = (await repository.listSupportTickets()).find((item) => item.id === ticket.id);
  assert.ok(updatedTicket?.description.includes("Customer service opened a refund review override."));

  const providerLedger = await platform.getProviderPayoutLedger(provider.id);
  assert.equal(
    providerLedger.entries.find((candidate) => candidate.bookingId === booking.id)?.status,
    "on-hold"
  );
});

test("ops can reschedule a booking, append an intervention audit trail, and touch the linked support ticket", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-ops-intervention@example.com",
    password: "Password123!",
    phone: "555-0200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress()
  });
  const provider = (await repository.listProviders())[0];
  assert.ok(provider);

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress(),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(72),
    scheduledEndIso: futureIso(73),
    notes: "Ops intervention coverage",
    totalCents: 6900
  });

  const ticket = await platform.createSupportTicket(
    { userId: customer.id, role: "customer" },
    {
      bookingId: booking.id,
      subject: "Storm reschedule",
      description: "Customer called support to move the job after a storm.",
      issueType: "general"
    }
  );

  const nextStartIso = futureIso(96);
  const nextEndIso = futureIso(97);
  const updatedBooking = await platform.createOpsBookingIntervention({
    bookingId: booking.id,
    ticketId: ticket.id,
    action: "reschedule-booking",
    note: "Customer approved moving the job to tomorrow afternoon after weather delays.",
    scheduledStartIso: nextStartIso,
    scheduledEndIso: nextEndIso
  });

  assert.equal(updatedBooking.scheduledStartIso, nextStartIso);
  assert.equal(updatedBooking.scheduledEndIso, nextEndIso);
  assert.equal(updatedBooking.status, "confirmed");
  assert.equal(updatedBooking.interventions.length, 1);
  assert.equal(updatedBooking.interventions[0]?.action, "reschedule-booking");
  assert.equal(updatedBooking.interventions[0]?.ticketId, ticket.id);

  const updatedTicket = (await repository.listSupportTickets()).find((candidate) => candidate.id === ticket.id);
  assert.ok(updatedTicket);
  assert.equal(updatedTicket?.status, "triaged");
  assert.match(updatedTicket?.description ?? "", /Ops intervention: reschedule-booking/);
});

test("ops cannot change the final outcome of a disputed booking intervention without linking the support ticket", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-ops-intervention-ticket-required@example.com",
    password: "Password123!",
    phone: "555-0200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress()
  });
  const provider = (await repository.listProviders())[0];
  assert.ok(provider);

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress(),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(98),
    scheduledEndIso: futureIso(99),
    notes: "Ops intervention dispute ticket requirement",
    totalCents: 6900
  });

  await platform.confirmBooking(provider.id, { bookingId: booking.id });
  await attachEvidence(
    platform,
    { userId: provider.id, email: provider.email, role: "provider" },
    booking.id,
    "after"
  );
  await platform.createBookingDispute(
    {
      userId: customer.id,
      email: customer.email,
      role: "customer"
    },
    {
      bookingId: booking.id,
      reason: "Support should review this job before it is restored."
    }
  );

  await assert.rejects(
    () =>
      platform.createOpsBookingIntervention({
        bookingId: booking.id,
        action: "restore-active-booking",
        note: "Support attempted to restore the booking without linking the ticket."
      }),
    /link the related support ticket/i
  );
});

test("ops cannot use booking interventions to apply a provider-favoring disputed outcome against the reviewed evidence", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-ops-intervention-direction-gate@example.com",
    password: "Password123!",
    phone: "555-0200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress()
  });
  const provider = (await repository.listProviders())[0];
  assert.ok(provider);

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress(),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(100),
    scheduledEndIso: futureIso(101),
    notes: "Ops intervention direction gate",
    totalCents: 6900
  });

  await platform.confirmBooking(provider.id, { bookingId: booking.id });
  await attachEvidence(
    platform,
    { userId: provider.id, email: provider.email, role: "provider" },
    booking.id,
    "after"
  );

  await platform.createBookingDispute(
    {
      userId: customer.id,
      email: customer.email,
      role: "customer"
    },
    {
      bookingId: booking.id,
      reason: "Support should review whether this booking should stay active."
    }
  );

  const disputeTicket = (await platform.listOpsSupportTickets()).find(
    (entry) => entry.ticket.bookingId === booking.id && entry.ticket.issueType === "service-quality"
  );
  assert.ok(disputeTicket?.booking?.serviceEvidence[0]);

  await platform.reviewBookingEvidenceForOps({
    bookingId: booking.id,
    ticketId: disputeTicket?.ticket.id ?? "",
    evidenceId: disputeTicket?.booking?.serviceEvidence[0]?.id ?? "",
    reviewStatus: "supports-customer",
    reviewNotes: "Evidence still supports the customer side."
  });

  await assert.rejects(
    () =>
      platform.createOpsBookingIntervention({
        bookingId: booking.id,
        ticketId: disputeTicket?.ticket.id ?? "",
        action: "restore-active-booking",
        note: "Support attempted to restore the booking despite the customer-leaning evidence."
      }),
    /does not currently support a provider-favoring resolution/i
  );
});

test("review-first staffing creates pending crew matches that providers can approve", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-staffing@example.com",
    password: "Password123!",
    phone: "555-0300",
    role: "provider",
    companyName: "GreenStride Lawn",
    categories: ["mulch-installation", "lawn-mowing"],
    serviceRadiusMiles: 25,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });
  assert.equal(provider.role, "provider");

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-staffing@example.com",
    password: "Password123!",
    phone: "555-0200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638),
    lawnSizeSqFt: 6400
  });
  assert.equal(customer.role, "customer");

  const crewMatch = await platform.registerUser({
    fullName: "Marco Crew",
    email: "crew-match@example.com",
    password: "Password123!",
    phone: "555-0400",
    role: "crew-member",
    address: createAddress("118 Garden Row", 30.2437, -97.7634),
    categories: ["mulch-installation", "lawn-mowing"],
    availableWeekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    willingToTravelMiles: 25,
    winterWorkEnabled: true
  });
  assert.equal(crewMatch.role, "crew-member");

  await platform.registerUser({
    fullName: "Nina Snow",
    email: "crew-nonmatch@example.com",
    password: "Password123!",
    phone: "555-0401",
    role: "crew-member",
    address: createAddress("400 Far Away Rd", 35.0, -100.0),
    categories: ["snow-shoveling"],
    availableWeekdays: ["Sun"],
    willingToTravelMiles: 5,
    winterWorkEnabled: false
  });

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: customer.defaultPropertyId,
    category: "mulch-installation",
    scheduledStartIso: futureIso(72),
    scheduledEndIso: futureIso(75),
    notes: "Front beds and walkway border",
    totalCents: 9200
  });

  const staffing = await platform.getProviderStaffingOverview(provider.id);
  const job = staffing.jobs.find((item) => item.bookingId === booking.id);
  assert.ok(job);
  assert.equal(staffing.provider.staffingMode, "review-first");
  assert.ok(job.matches.some((match) => match.crewMemberId === crewMatch.id));
  assert.ok(job.matches.every((match) => match.status === "pending-provider-review"));
  assert.ok(job.matches.every((match) => !match.autoAccepted));

  const pendingMatch = job.matches.find((match) => match.crewMemberId === crewMatch.id);
  assert.ok(pendingMatch);

  const acceptedMatch = await reviewCrewMatchForEligibleProvider(platform, provider.id, {
    crewMatchId: pendingMatch.id,
    action: "accept"
  });
  assert.equal(acceptedMatch.status, "accepted");

  const crewMatches = await platform.getCrewMatchesForCrew(crewMatch.id);
  assert.ok(crewMatches.matches.some((match) => match.id === acceptedMatch.id && match.status === "accepted"));
  assert.equal(crewMatches.availabilityConstraints.availabilityStatus, "open");
  assert.equal(crewMatches.availabilityConstraints.availableWeekdays.length, 7);
  assert.equal(crewMatches.availabilityConstraints.unavailableWeekdays.length, 0);
  assert.equal(crewMatches.availabilityConstraints.willingToTravelMiles, 25);
  assert.equal(crewMatches.availabilityConstraints.winterWorkEnabled, true);
  assert.equal(crewMatches.availabilityConstraints.acceptedUpcomingCount, 1);
  assert.equal(crewMatches.assignmentForecast.forecastStatus, "scheduled");
  assert.equal(crewMatches.assignmentForecast.workloadBand, "light");
  assert.equal(crewMatches.assignmentForecast.acceptedUpcomingCount, 1);
  assert.equal(crewMatches.assignmentForecast.pendingReviewCount, 0);
  assert.equal(crewMatches.assignmentForecast.nextAssignmentIso, booking.scheduledStartIso);
  assert.equal(crewMatches.assignmentForecast.nextProviderCompanyName, provider.companyName);
  assert.equal(crewMatches.assignmentForecast.nextServiceCategory, "mulch-installation");
  assert.equal(crewMatches.assignmentForecast.nextAssignmentStatus, "accepted");
  assert.equal(crewMatches.assignmentForecast.nextBookingStatus, "requested");
});

test("crew members can cancel accepted assignments and future staffing penalizes repeat call-offs", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-crew-cancel@example.com",
    password: "Password123!",
    phone: "555-5300",
    role: "provider",
    companyName: "GreenStride Lawn",
    categories: ["lawn-mowing"],
    serviceRadiusMiles: 25,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });
  assert.equal(provider.role, "provider");

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-crew-cancel@example.com",
    password: "Password123!",
    phone: "555-5310",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638)
  });
  assert.equal(customer.role, "customer");

  const targetDayStartIso = futureIso(72);
  const targetDay = availabilityDayForIso(targetDayStartIso);

  const cancellingCrew = await platform.registerUser({
    fullName: "Taylor Cancel",
    email: "crew-cancel@example.com",
    password: "Password123!",
    phone: "555-5320",
    role: "crew-member",
    address: createAddress("113 Garden Row", 30.24355, -97.76385),
    categories: ["lawn-mowing"],
    availableWeekdays: [targetDay],
    willingToTravelMiles: 20,
    preferredSchedule: "full-time",
    hasOwnEquipment: true
  });

  const steadyCrew = await platform.registerUser({
    fullName: "Casey Steady",
    email: "crew-steady@example.com",
    password: "Password123!",
    phone: "555-5330",
    role: "crew-member",
    address: createAddress("114 Garden Row", 30.2436, -97.7639),
    categories: ["lawn-mowing"],
    availableWeekdays: [targetDay],
    willingToTravelMiles: 20,
    preferredSchedule: "full-time",
    hasOwnEquipment: true
  });

  await repository.updateCrewMember(cancellingCrew.id, {
    rating: 4.9,
    completedJobs: 26
  });
  await repository.updateCrewMember(steadyCrew.id, {
    rating: 4.8,
    completedJobs: 24
  });

  const firstBooking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: customer.address,
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: targetDayStartIso,
    scheduledEndIso: futureIso(73),
    notes: "First staffing target",
    totalCents: 6200
  });

  const firstOverview = await platform.getProviderStaffingOverview(provider.id);
  const firstJob = firstOverview.jobs.find((job) => job.bookingId === firstBooking.id);
  assert.ok(firstJob);
  const firstMatch = firstJob?.matches.find((match) => match.crewMemberId === cancellingCrew.id);
  assert.ok(firstMatch);

  await reviewCrewMatchForEligibleProvider(platform, provider.id, {
    crewMatchId: firstMatch!.id,
    action: "accept"
  });

  const cancelledSummary = await platform.cancelCrewMatch(cancellingCrew.id, {
    crewMatchId: firstMatch!.id,
    reason: "Had to back out this time."
  });
  assert.equal(cancelledSummary.status, "cancelled-by-crew");
  assert.equal(cancelledSummary.cancellationReason, "Had to back out this time.");

  const updatedCrew = await repository.findCrewMemberById(cancellingCrew.id);
  assert.equal(updatedCrew?.cancellationCount, 1);

  const providerNotifications = await repository.listNotificationsByRecipient(provider.id);
  assert.ok(providerNotifications.some((notification) => notification.title === "Crew member cancelled"));

  const secondBooking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("118 Garden Row", 30.2437, -97.76395),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(240),
    scheduledEndIso: futureIso(241),
    notes: "Second staffing target",
    totalCents: 6200
  });

  const secondOverview = await platform.getProviderStaffingOverview(provider.id);
  const secondJob = secondOverview.jobs.find((job) => job.bookingId === secondBooking.id);
  assert.ok(secondJob);
  assert.ok(secondJob!.matches.length >= 2);
  assert.equal(secondJob!.matches[0]?.crewMemberId, steadyCrew.id);
  const cancellingCrewMatch = secondJob!.matches.find((match) => match.crewMemberId === cancellingCrew.id);
  assert.ok(cancellingCrewMatch);
  assert.ok(
    cancellingCrewMatch!.recommendationReasons?.some((reason) => /call-offs lower future match priority/i.test(reason))
  );

  const crewLedger = await platform.getCrewPayoutLedger(cancellingCrew.id);
  assert.equal(crewLedger.attendanceSummary.cancelledAssignmentCount, 1);
  assert.equal(crewLedger.attendanceSummary.cancellationCount, 1);
  assert.equal(crewLedger.attendanceSummary.reliabilityStatus, "watch");
  assert.equal(crewLedger.attendanceSummary.attendanceRate, 0);
  assert.ok(
    crewLedger.attendanceSummary.warnings.some((warning) => /call-offs/i.test(warning))
  );
  assert.equal(crewLedger.earningsSummary.completedAssignmentCount, 0);
  assert.ok(
    crewLedger.earningsSummary.guidance.some((item) => /provider business.*responsible/i.test(item))
  );
  assert.equal(crewLedger.performanceSummary.completedAssignmentCount, 0);
  assert.equal(crewLedger.performanceSummary.performanceStatus, "building");
  assert.ok(
    crewLedger.performanceSummary.warnings.some((warning) => /No completed assignments/i.test(warning))
  );
  assert.ok(
    crewLedger.performanceSummary.warnings.some((warning) => /call-off/i.test(warning))
  );

  const crewMatches = await platform.getCrewMatchesForCrew(cancellingCrew.id);
  assert.equal(crewMatches.availabilityConstraints.availabilityStatus, "limited");
  assert.deepEqual(crewMatches.availabilityConstraints.availableWeekdays, [targetDay]);
  assert.equal(crewMatches.availabilityConstraints.unavailableWeekdays.length, 6);
  assert.equal(crewMatches.availabilityConstraints.acceptedUpcomingCount, 0);
  assert.ok(
    crewMatches.availabilityConstraints.warnings.some((warning) => /Limited available weekdays/i.test(warning))
  );
  assert.equal(crewMatches.assignmentForecast.forecastStatus, "pending-review");
  assert.equal(crewMatches.assignmentForecast.acceptedUpcomingCount, 0);
  assert.equal(crewMatches.assignmentForecast.pendingReviewCount, 1);
  assert.equal(crewMatches.assignmentForecast.workloadBand, "open");
  assert.equal(crewMatches.assignmentForecast.nextAssignmentIso, undefined);
  assert.ok(
    crewMatches.assignmentForecast.guidance.some((item) => /pending match/i.test(item))
  );
  assert.ok(
    crewMatches.assignmentForecast.warnings.some((warning) => /call-off/i.test(warning))
  );
});

test("staffing recommendations rank the best-fit crew first and exclude overlapping accepted jobs", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const primaryProvider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-staffing-rank@example.com",
    password: "Password123!",
    phone: "555-4500",
    role: "provider",
    companyName: "Ranking Lawn Co.",
    categories: ["lawn-mowing", "leaf-blowing"],
    serviceRadiusMiles: 25,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });

  const otherProvider = await platform.registerUser({
    fullName: "Marcus Hale",
    email: "provider-staffing-other@example.com",
    password: "Password123!",
    phone: "555-4510",
    role: "provider",
    companyName: "Conflict Lawn Co.",
    categories: ["lawn-mowing"],
    serviceRadiusMiles: 25,
    address: createAddress("1900 Outer Route", 30.275, -97.79)
  });

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-staffing-rank@example.com",
    password: "Password123!",
    phone: "555-4520",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638)
  });

  const targetStartIso = futureIso(72);
  const targetEndIso = futureIso(73);
  const targetDay = availabilityDayForIso(targetStartIso);

  const bestCrew = await platform.registerUser({
    fullName: "Taylor Crew",
    email: "crew-best-fit@example.com",
    password: "Password123!",
    phone: "555-4530",
    role: "crew-member",
    address: createAddress("113 Garden Row", 30.24355, -97.76385),
    categories: ["lawn-mowing"],
    availableWeekdays: [targetDay],
    willingToTravelMiles: 20,
    preferredSchedule: "full-time",
    hasOwnEquipment: true
  });

  const conflictCrew = await platform.registerUser({
    fullName: "Jordan Conflict",
    email: "crew-conflict@example.com",
    password: "Password123!",
    phone: "555-4540",
    role: "crew-member",
    address: createAddress("114 Garden Row", 30.2436, -97.7639),
    categories: ["lawn-mowing"],
    availableWeekdays: [targetDay],
    willingToTravelMiles: 20,
    preferredSchedule: "full-time",
    hasOwnEquipment: true
  });

  const backupCrew = await platform.registerUser({
    fullName: "Casey Backup",
    email: "crew-backup@example.com",
    password: "Password123!",
    phone: "555-4550",
    role: "crew-member",
    address: createAddress("500 Far Route", 30.31, -97.84),
    categories: ["lawn-mowing"],
    availableWeekdays: [targetDay],
    willingToTravelMiles: 50,
    preferredSchedule: "part-time",
    hasOwnEquipment: false
  });

  await repository.updateCrewMember(bestCrew.id, {
    assignedProviderId: primaryProvider.id,
    rating: 4.9,
    completedJobs: 48
  });
  await repository.updateCrewMember(conflictCrew.id, {
    rating: 4.8,
    completedJobs: 30
  });
  await repository.updateCrewMember(backupCrew.id, {
    rating: 4.4,
    completedJobs: 8
  });

  const overlappingBooking = await platform.createBooking(customer.id, {
    providerId: otherProvider.id,
    serviceAddress: createAddress("220 Conflict Ave", 30.265, -97.782),
    servicePropertyId: undefined,
    category: "lawn-mowing",
    scheduledStartIso: targetStartIso,
    scheduledEndIso: targetEndIso,
    notes: "Conflict booking",
    totalCents: 6200
  });

  await repository.createCrewMatch({
    id: "accepted-conflict-match",
    bookingId: overlappingBooking.id,
    providerId: otherProvider.id,
    crewMemberId: conflictCrew.id,
    crewMemberName: conflictCrew.fullName,
    crewMemberPhone: conflictCrew.phone,
    categories: conflictCrew.categories,
    availableWeekdays: conflictCrew.availableWeekdays ?? [targetDay],
    preferredSchedule: conflictCrew.preferredSchedule,
    willingToTravelMiles: conflictCrew.willingToTravelMiles,
    hasOwnEquipment: conflictCrew.hasOwnEquipment,
    winterWorkEnabled: conflictCrew.winterWorkEnabled ?? true,
    status: "accepted",
    autoAccepted: true,
    distanceMiles: 1.5,
    hourlyRateCents: 3200,
    createdAt: new Date().toISOString(),
    reviewedAt: new Date().toISOString()
  });

  const targetBooking = await platform.createBooking(customer.id, {
    providerId: primaryProvider.id,
    serviceAddress: customer.address,
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: targetStartIso,
    scheduledEndIso: targetEndIso,
    notes: "Target booking",
    totalCents: 6200
  });

  const overview = await platform.getProviderStaffingOverview(primaryProvider.id);
  const targetJob = overview.jobs.find((job) => job.bookingId === targetBooking.id);
  assert.ok(targetJob);
  assert.ok(targetJob!.matches.length >= 2);
  assert.ok(!targetJob!.matches.some((match) => match.crewMemberId === conflictCrew.id));
  assert.equal(targetJob!.matches[0]?.crewMemberId, bestCrew.id);
  assert.equal(targetJob!.matches[0]?.recommendationLabel, "best-fit");
  assert.ok((targetJob!.matches[0]?.recommendationScore ?? 0) > (targetJob!.matches[1]?.recommendationScore ?? 0));
  assert.ok(
    targetJob!.matches[0]?.recommendationReasons?.some(
      (reason) => /window|business|reliability|capacity/i.test(reason)
    )
  );
});

test("automated day-load balancing rotates crew recommendations across same-day jobs", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-load-balance@example.com",
    password: "Password123!",
    phone: "555-4600",
    role: "provider",
    companyName: "Balanced Route Co.",
    categories: ["lawn-mowing"],
    serviceRadiusMiles: 25,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-load-balance@example.com",
    password: "Password123!",
    phone: "555-4610",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638)
  });

  const serviceDay = new Date();
  serviceDay.setDate(serviceDay.getDate() + 3);
  const jobStarts = [8, 10, 12, 14].map((hour) => {
    const start = new Date(serviceDay);
    start.setHours(hour, 0, 0, 0);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    return {
      startIso: start.toISOString(),
      endIso: end.toISOString()
    };
  });
  const availableDay = availabilityDayForIso(jobStarts[0].startIso);

  const crewConfigs = [
    ["crew-load-a@example.com", "Taylor A", "111 Garden Row", 30.24355, -97.76385],
    ["crew-load-b@example.com", "Taylor B", "112 Garden Row", 30.2436, -97.7639],
    ["crew-load-c@example.com", "Taylor C", "113 Garden Row", 30.24365, -97.76395],
    ["crew-load-d@example.com", "Taylor D", "114 Garden Row", 30.2437, -97.764]
  ] as const;

  const crewMembers = [];
  for (const [email, fullName, line1, latitude, longitude] of crewConfigs) {
    const crew = await platform.registerUser({
      fullName,
      email,
      password: "Password123!",
      phone: "555-4620",
      role: "crew-member",
      address: createAddress(line1, latitude, longitude),
      categories: ["lawn-mowing"],
      availableWeekdays: [availableDay],
      willingToTravelMiles: 25,
      preferredSchedule: "full-time",
      hasOwnEquipment: true
    });

    await repository.updateCrewMember(crew.id, {
      rating: 4.8,
      completedJobs: 20
    });
    crewMembers.push(crew);
  }

  const createdBookings = [];
  for (const [index, slot] of jobStarts.entries()) {
    const booking = await platform.createBooking(customer.id, {
      providerId: provider.id,
      serviceAddress: createAddress(`20${index} Garden Row`, 30.2435 + index * 0.001, -97.7638 - index * 0.001),
      servicePropertyId: undefined,
      category: "lawn-mowing",
      scheduledStartIso: slot.startIso,
      scheduledEndIso: slot.endIso,
      notes: `Job ${index + 1}`,
      totalCents: 6200
    });
    createdBookings.push(booking);
  }

  const overview = await platform.getProviderStaffingOverview(provider.id);
  const fourthJob = overview.jobs.find((job) => job.bookingId === createdBookings[3]?.id);
  assert.ok(fourthJob);
  assert.ok(fourthJob!.matches.length > 0);

  const firstThreeCrewIds = new Set(
    overview.jobs
      .filter((job) => createdBookings.slice(0, 3).some((booking) => booking.id === job.bookingId))
      .flatMap((job) => job.matches.slice(0, 1).map((match) => match.crewMemberId))
  );

  assert.ok(firstThreeCrewIds.size <= 3);
  assert.ok(
    fourthJob!.matches.some((match) => !firstThreeCrewIds.has(match.crewMemberId)),
    "expected the fourth job to include a fresher crew option after earlier same-day load stacked up"
  );
});

test("auto-accept staffing immediately creates accepted crew matches", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Riley Bishop",
    email: "provider-auto@example.com",
    password: "Password123!",
    phone: "555-0500",
    role: "provider",
    companyName: "Bishop Outdoor",
    categories: ["lawn-mowing"],
    serviceRadiusMiles: 20,
    address: createAddress("200 Provider Way", 30.2438, -97.7635)
  });
  assert.equal(provider.role, "provider");

  await platform.updateProviderSettings(provider.id, {
    serviceRadiusMiles: 20,
    staffingMode: "auto-accept",
    sponsoredListingEnabled: false
  });

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-auto@example.com",
    password: "Password123!",
    phone: "555-0200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638),
    lawnSizeSqFt: 7000
  });
  assert.equal(customer.role, "customer");

  const crew = await platform.registerUser({
    fullName: "Alex Mower",
    email: "crew-auto@example.com",
    password: "Password123!",
    phone: "555-0600",
    role: "crew-member",
    address: createAddress("110 Garden Row", 30.2433, -97.7636),
    categories: ["lawn-mowing"],
    availableWeekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    willingToTravelMiles: 30
  });
  assert.equal(crew.role, "crew-member");

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(72),
    scheduledEndIso: futureIso(73),
    notes: "Weekly service",
    totalCents: 6200
  });

  const staffing = await platform.getProviderStaffingOverview(provider.id);
  const job = staffing.jobs.find((item) => item.bookingId === booking.id);
  assert.ok(job);
  assert.equal(staffing.provider.staffingMode, "auto-accept");
  assert.ok(job.matches.some((match) => match.crewMemberId === crew.id && match.status === "accepted"));
});

test("provider and crew can chat on a valid crew match while unrelated users are blocked", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-chat@example.com",
    password: "Password123!",
    phone: "555-0700",
    role: "provider",
    companyName: "GreenStride Lawn",
    categories: ["mulch-installation"],
    serviceRadiusMiles: 25,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });
  assert.equal(provider.role, "provider");

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-chat@example.com",
    password: "Password123!",
    phone: "555-0200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638)
  });
  assert.equal(customer.role, "customer");

  const crew = await platform.registerUser({
    fullName: "Terry Crew",
    email: "crew-chat@example.com",
    password: "Password123!",
    phone: "555-0800",
    role: "crew-member",
    address: createAddress("118 Garden Row", 30.2437, -97.7634),
    categories: ["mulch-installation"],
    availableWeekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    willingToTravelMiles: 25
  });
  assert.equal(crew.role, "crew-member");

  const otherCrew = await platform.registerUser({
    fullName: "Chris Unrelated",
    email: "crew-other@example.com",
    password: "Password123!",
    phone: "555-0801",
    role: "crew-member",
    address: createAddress("120 Garden Row", 30.2439, -97.7632),
    categories: ["mulch-installation"],
    availableWeekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    willingToTravelMiles: 25
  });
  assert.equal(otherCrew.role, "crew-member");

  await platform.updateProviderSettings(provider.id, {
    serviceRadiusMiles: provider.serviceRadiusMiles,
    staffingMode: provider.staffingMode,
    crewReviewLeadHours: provider.crewReviewLeadHours,
    departureReminderLeadMinutes: provider.departureReminderLeadMinutes,
    routeLeaderMode: "accepted-crew-fallback",
    sponsoredListingEnabled: provider.sponsoredListingEnabled
  });

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: customer.defaultPropertyId,
    category: "mulch-installation",
    scheduledStartIso: futureIso(72),
    scheduledEndIso: futureIso(75),
    notes: "Front beds and walkway border",
    totalCents: 9200
  });

  const staffing = await platform.getProviderStaffingOverview(provider.id);
  const job = staffing.jobs.find((item) => item.bookingId === booking.id);
  assert.ok(job);
  const crewMatch = job.matches.find((match) => match.crewMemberId === crew.id);
  assert.ok(crewMatch);

  const providerThread = await platform.sendProviderCrewMessage(
    { userId: provider.id, email: provider.email, role: "provider" },
    {
      crewMatchId: crewMatch.id,
      body: "Can you meet at the property 15 minutes early?"
    }
  );
  assert.equal(providerThread.messages.length, 1);
  assert.equal(providerThread.messages[0]?.senderRole, "provider");

  const crewThread = await platform.sendProviderCrewMessage(
    { userId: crew.id, email: crew.email, role: "crew-member" },
    {
      threadId: providerThread.thread.id,
      body: "Yes, I can be there early."
    }
  );
  assert.equal(crewThread.messages.length, 2);
  assert.equal(crewThread.messages[1]?.senderRole, "crew-member");

  await assert.rejects(
    platform.getProviderCrewConversationThread(
      { userId: otherCrew.id, email: otherCrew.email, role: "crew-member" },
      providerThread.thread.id
    ),
    /cannot access this conversation/
  );
});

test("customer-provider chat unlocks only after an accepted crew member is on route", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const analytics = new DataEngineeringLogger();
  const platform = new MarketplacePlatformService(repository, analytics);

  await assert.rejects(
    platform.registerUser({
      fullName: "Jordan 555-867-5309",
      email: "customer-contact-name@example.com",
      password: "Password123!",
      phone: "555-0209",
      role: "customer",
      propertyLabel: "Primary home",
      address: createAddress("119 Garden Row", 30.2438, -97.7637)
    }),
    /keep communication in YardMatch/
  );
  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-customer-chat@example.com",
    password: "Password123!",
    phone: "555-0900",
    role: "provider",
    companyName: "GreenStride Lawn",
    categories: ["mulch-installation"],
    serviceRadiusMiles: 25,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });
  assert.equal(provider.role, "provider");

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-customer-chat@example.com",
    password: "Password123!",
    phone: "555-0200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638),
    lawnSizeSqFt: 6400
  });
  assert.equal(customer.role, "customer");

  await assert.rejects(
    platform.createBooking(customer.id, {
      providerId: provider.id,
      serviceAddress: createAddress("Call 555-867-5309", 30.2435, -97.7638),
      category: "mulch-installation",
      scheduledStartIso: futureIso(67),
      scheduledEndIso: futureIso(69),
      notes: "Front beds and walkway border",
      totalCents: 9200
    }),
    /keep communication in YardMatch/
  );

  const otherCustomer = await platform.registerUser({
    fullName: "Casey Blocked",
    email: "customer-blocked@example.com",
    password: "Password123!",
    phone: "555-0201",
    role: "customer",
    propertyLabel: "Rental",
    address: createAddress("210 Other St", 30.2501, -97.759)
  });
  assert.equal(otherCustomer.role, "customer");

  const crew = await platform.registerUser({
    fullName: "Terry Crew",
    email: "crew-on-route@example.com",
    password: "Password123!",
    phone: "555-0800",
    role: "crew-member",
    address: createAddress("118 Garden Row", 30.2437, -97.7634),
    categories: ["mulch-installation"],
    availableWeekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    willingToTravelMiles: 25
  });
  assert.equal(crew.role, "crew-member");

  const otherCrew = await platform.registerUser({
    fullName: "Chris Backup",
    email: "crew-backup@example.com",
    password: "Password123!",
    phone: "555-0801",
    role: "crew-member",
    address: createAddress("120 Garden Row", 30.2439, -97.7632),
    categories: ["mulch-installation"],
    availableWeekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    willingToTravelMiles: 25
  });
  assert.equal(otherCrew.role, "crew-member");

  await assert.rejects(
    platform.createBooking(customer.id, {
      providerId: provider.id,
      serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
      servicePropertyId: customer.defaultPropertyId,
      category: "mulch-installation",
      scheduledStartIso: futureIso(66),
      scheduledEndIso: futureIso(68),
      notes: "Please call me at (555) 867-5309 before starting.",
      totalCents: 9200
    }),
    /keep communication in YardMatch/
  );

  await platform.updateProviderSettings(provider.id, {
    serviceRadiusMiles: provider.serviceRadiusMiles,
    staffingMode: provider.staffingMode,
    crewReviewLeadHours: provider.crewReviewLeadHours,
    departureReminderLeadMinutes: provider.departureReminderLeadMinutes,
    routeLeaderMode: "accepted-crew-fallback",
    sponsoredListingEnabled: provider.sponsoredListingEnabled
  });

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: customer.defaultPropertyId,
    category: "mulch-installation",
    scheduledStartIso: futureIso(72),
    scheduledEndIso: futureIso(75),
    notes: "Front beds and walkway border",
    totalCents: 9200
  });

  await assert.rejects(
    platform.updateBookingAddress(customer.id, {
      bookingId: booking.id,
      newAddress: createAddress("Text 555-867-5309", 30.2436, -97.7637)
    }),
    /keep communication in YardMatch/
  );

  const staffing = await platform.getProviderStaffingOverview(provider.id);
  const job = staffing.jobs.find((item) => item.bookingId === booking.id);
  assert.ok(job);
  const crewMatch = job.matches.find((match) => match.crewMemberId === crew.id);
  assert.ok(crewMatch);

  await reviewCrewMatchForEligibleProvider(platform, provider.id, {
    crewMatchId: crewMatch.id,
    action: "accept"
  });

  await assert.rejects(
    platform.sendCustomerProviderMessage(
      { userId: customer.id, email: customer.email, role: "customer" },
      {
        bookingId: booking.id,
        body: "Are you still on schedule?"
      }
    ),
    /unlocks only after the crew is on route/
  );

  await assert.rejects(
    platform.markBookingOnRoute(
      { userId: otherCrew.id, email: otherCrew.email, role: "crew-member" },
      {
        bookingId: booking.id
      }
    ),
    /Only accepted crew members can confirm they are on route/
  );

  await platform.confirmBooking(provider.id, {
    bookingId: booking.id
  });

  const onRouteBooking = await platform.markBookingOnRoute(
    { userId: provider.id, email: provider.email, role: "provider" },
    {
      bookingId: booking.id
    }
  );
  assert.ok(onRouteBooking.onRouteConfirmedAt);
  assert.equal(onRouteBooking.onRouteConfirmedByCrewMemberId, undefined);

  const emptyThread = await platform.getCustomerProviderConversationThread(
    { userId: provider.id, email: provider.email, role: "provider" },
    undefined,
    booking.id
  );
  assert.equal(emptyThread.messages.length, 0);
  assert.equal(emptyThread.thread.bookingId, booking.id);

  const customerThread = await platform.sendCustomerProviderMessage(
    { userId: customer.id, email: customer.email, role: "customer" },
    {
      threadId: emptyThread.thread.id,
      body: "Thanks for the update. The side gate will be open."
    }
  );
  assert.equal(customerThread.messages.length, 1);
  assert.equal(customerThread.messages[0]?.senderRole, "customer");

  const providerThread = await platform.sendCustomerProviderMessage(
    { userId: provider.id, email: provider.email, role: "provider" },
    {
      threadId: customerThread.thread.id,
      body: "Perfect. Our crew is 10 minutes away."
    }
  );
  assert.equal(providerThread.messages.length, 2);
  assert.equal(providerThread.messages[1]?.senderRole, "provider");

  await assert.rejects(
    platform.sendCustomerProviderMessage(
      { userId: customer.id, email: customer.email, role: "customer" },
      {
        threadId: customerThread.thread.id,
        body: "Call me at 555-867-5309."
      }
    ),
    /keep communication in YardMatch/
  );
  await assert.rejects(
    platform.sendCustomerProviderMessage(
      { userId: provider.id, email: provider.email, role: "provider" },
      {
        threadId: customerThread.thread.id,
        body: "Email route@example.com or visit route-care.com."
      }
    ),
    /keep communication in YardMatch/
  );
  await assert.rejects(
    platform.sendCustomerProviderMessage(
      { userId: customer.id, email: customer.email, role: "customer" },
      {
        threadId: customerThread.thread.id,
        body: "DM me on Instagram @yardowner."
      }
    ),
    /keep communication in YardMatch/
  );

  const directContactBlocks = analytics
    .listEvents()
    .filter((event) => event.name === MarketplaceTelemetryEventCatalog.directContactShareBlocked);
  assert.equal(directContactBlocks.length, 7);
  assert.ok(directContactBlocks.every((event) => !Object.values(event.properties).includes("555-867-5309")));

  const legacyMessageCreatedAt = new Date().toISOString();
  await repository.createCustomerProviderMessage({
    id: "legacy-contact-message",
    threadId: customerThread.thread.id,
    senderId: provider.id,
    senderRole: "provider",
    body: "Legacy contact: 555-111-2222",
    createdAt: legacyMessageCreatedAt
  });
  await repository.updateCustomerProviderConversation(customerThread.thread.id, {
    lastMessagePreview: "Legacy contact: 555-111-2222",
    updatedAt: legacyMessageCreatedAt
  });
  const protectedThread = await platform.getCustomerProviderConversationThread(
    { userId: customer.id, email: customer.email, role: "customer" },
    customerThread.thread.id
  );
  assert.equal(protectedThread.messages.at(-1)?.body.includes("555-111-2222"), false);
  assert.match(protectedThread.messages.at(-1)?.body ?? "", /Contact details removed/);
  const protectedConversationList = await platform.listCustomerProviderConversations({
    userId: customer.id,
    email: customer.email,
    role: "customer"
  });
  assert.equal(protectedConversationList[0]?.lastMessagePreview?.includes("555-111-2222"), false);

  await assert.rejects(
    platform.getCustomerProviderConversationThread(
      { userId: otherCustomer.id, email: otherCustomer.email, role: "customer" },
      providerThread.thread.id
    ),
    /cannot access this conversation/
  );
});

test("arrival tracking shows a live route once the crew is on route", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-tracking@example.com",
    password: "Password123!",
    phone: "555-0900",
    role: "provider",
    companyName: "GreenStride Lawn",
    categories: ["mulch-installation"],
    serviceRadiusMiles: 25,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });
  assert.equal(provider.role, "provider");

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-tracking@example.com",
    password: "Password123!",
    phone: "555-0200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638)
  });
  assert.equal(customer.role, "customer");

  const crew = await platform.registerUser({
    fullName: "Terry Crew",
    email: "crew-tracking@example.com",
    password: "Password123!",
    phone: "555-0800",
    role: "crew-member",
    address: createAddress("118 Garden Row", 30.2437, -97.7634),
    categories: ["mulch-installation"],
    availableWeekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    willingToTravelMiles: 25
  });
  assert.equal(crew.role, "crew-member");

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: customer.defaultPropertyId,
    category: "mulch-installation",
    scheduledStartIso: futureIso(72),
    scheduledEndIso: futureIso(75),
    notes: "Front beds and walkway border",
    totalCents: 9200
  });

  const staffing = await platform.getProviderStaffingOverview(provider.id);
  const crewMatch = staffing.jobs[0]?.matches.find((match) => match.crewMemberId === crew.id);
  assert.ok(crewMatch);

  await reviewCrewMatchForEligibleProvider(platform, provider.id, {
    crewMatchId: crewMatch.id,
    action: "accept"
  });
  await platform.confirmBooking(provider.id, { bookingId: booking.id });
  const onRouteBooking = await platform.markBookingOnRoute(
    { userId: provider.id, email: provider.email, role: "provider" },
    { bookingId: booking.id }
  );
  assert.ok(onRouteBooking.onRouteConfirmedAt);

  const oneMinuteLater = new Date(
    new Date(onRouteBooking.onRouteConfirmedAt as string).getTime() + 1 * 60 * 1000
  ).toISOString();
  const liveTracking = await platform.updateBookingRouteLocation(
    { userId: provider.id, email: provider.email, role: "provider" },
    {
      bookingId: booking.id,
      point: {
        latitude: 30.2438,
        longitude: -97.76395
      },
      speedMph: 18,
      capturedAtIso: oneMinuteLater
    }
  );
  assert.equal(liveTracking.source, "provider-device");
  assert.equal(liveTracking.isLiveLocationStale, false);

  const tracking = await platform.getBookingArrivalTracking(
    { userId: customer.id, email: customer.email, role: "customer" },
    booking.id,
    oneMinuteLater
  );

  assert.equal(tracking.status, "on-route");
  assert.ok(tracking.currentPoint);
  assert.ok((tracking.etaMinutes ?? 0) > 0);
  assert.ok(tracking.progressPercent > 0);
  assert.equal(tracking.source, "provider-device");
  assert.equal(tracking.message.includes("live location"), true);
});

test("provider-only route stops adjust ETA while customer tracking keeps stop details hidden", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-route-stop@example.com",
    password: "Password123!",
    phone: "555-0901",
    role: "provider",
    companyName: "GreenStride Lawn",
    categories: ["mulch-installation"],
    serviceRadiusMiles: 25,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });
  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-route-stop@example.com",
    password: "Password123!",
    phone: "555-0201",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638)
  });

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: customer.defaultPropertyId,
    category: "mulch-installation",
    scheduledStartIso: futureIso(72),
    scheduledEndIso: futureIso(75),
    notes: "Front beds and walkway border",
    totalCents: 9200
  });

  await platform.confirmBooking(provider.id, { bookingId: booking.id });
  await platform.setBookingRouteStop(provider.id, {
    bookingId: booking.id,
    kind: "equipment-pickup",
    label: "Equipment pickup",
    address: createAddress("95 Supply Yard", 30.2515, -97.7521)
  });
  const onRouteBooking = await platform.markBookingOnRoute(
    { userId: provider.id, email: provider.email, role: "provider" },
    { bookingId: booking.id }
  );

  const oneMinuteLater = new Date(
    new Date(onRouteBooking.onRouteConfirmedAt as string).getTime() + 1 * 60 * 1000
  ).toISOString();
  await platform.updateBookingRouteLocation(
    { userId: provider.id, email: provider.email, role: "provider" },
    {
      bookingId: booking.id,
      point: {
        latitude: 30.245,
        longitude: -97.7615
      },
      speedMph: 18,
      capturedAtIso: oneMinuteLater
    }
  );

  const providerTracking = await platform.getBookingArrivalTracking(
    { userId: provider.id, email: provider.email, role: "provider" },
    booking.id,
    oneMinuteLater
  );
  const customerTracking = await platform.getBookingArrivalTracking(
    { userId: customer.id, email: customer.email, role: "customer" },
    booking.id,
    oneMinuteLater
  );

  assert.equal(providerTracking.activeRouteStop?.label, "Equipment pickup");
  assert.equal(providerTracking.currentLegDestination?.line1, "95 Supply Yard");
  assert.ok((providerTracking.etaToCurrentLegMinutes ?? 0) > 0);
  assert.ok((providerTracking.etaMinutes ?? 0) > (providerTracking.etaToCurrentLegMinutes ?? 0));
  assert.ok((providerTracking.remainingDistanceMiles ?? 0) > (providerTracking.remainingLegDistanceMiles ?? 0));
  assert.equal(customerTracking.activeRouteStop, undefined);
  assert.equal(customerTracking.currentLegDestination, undefined);
  assert.equal(customerTracking.etaMinutes, providerTracking.etaMinutes);

  const atStopTime = new Date(new Date(oneMinuteLater).getTime() + 4 * 60 * 1000).toISOString();
  const trackingAfterStop = await platform.updateBookingRouteLocation(
    { userId: provider.id, email: provider.email, role: "provider" },
    {
      bookingId: booking.id,
      point: {
        latitude: 30.2515,
        longitude: -97.7521
      },
      speedMph: 12,
      capturedAtIso: atStopTime
    }
  );

  assert.equal(trackingAfterStop.activeRouteStop, undefined);
  assert.equal(trackingAfterStop.currentLegDestination?.line1, "112 Garden Row");
});

test("providers confirm bookings before crew can go on route or start work", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-lifecycle@example.com",
    password: "Password123!",
    phone: "555-1300",
    role: "provider",
    companyName: "Route Ready Lawn",
    categories: ["lawn-mowing", "mulch-installation"],
    serviceRadiusMiles: 25,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });
  assert.equal(provider.role, "provider");

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-lifecycle@example.com",
    password: "Password123!",
    phone: "555-1200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638),
    lawnSizeSqFt: 6400
  });
  assert.equal(customer.role, "customer");

  const crewMember = await platform.registerUser({
    fullName: "Marco Crew",
    email: "crew-lifecycle@example.com",
    password: "Password123!",
    phone: "555-1400",
    role: "crew-member",
    address: createAddress("118 Garden Row", 30.2437, -97.7634),
    categories: ["lawn-mowing", "mulch-installation"],
    availableWeekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    willingToTravelMiles: 25,
    winterWorkEnabled: true
  });
  assert.equal(crewMember.role, "crew-member");

  await platform.updateProviderSettings(provider.id, {
    serviceRadiusMiles: provider.serviceRadiusMiles,
    staffingMode: provider.staffingMode,
    crewReviewLeadHours: provider.crewReviewLeadHours,
    departureReminderLeadMinutes: provider.departureReminderLeadMinutes,
    routeLeaderMode: "accepted-crew-fallback",
    sponsoredListingEnabled: provider.sponsoredListingEnabled
  });

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: customer.defaultPropertyId,
    category: "mulch-installation",
    scheduledStartIso: futureIso(96),
    scheduledEndIso: futureIso(99),
    notes: "Front beds",
    totalCents: 9100
  });

  const overview = await platform.getProviderStaffingOverview(provider.id);
  const pendingMatch = overview.jobs[0]?.matches[0];
  assert.ok(pendingMatch);

  await reviewCrewMatchForEligibleProvider(platform, provider.id, {
    crewMatchId: pendingMatch.id,
    action: "accept"
  });

  await assert.rejects(
    platform.markBookingOnRoute(
      { userId: crewMember.id, email: crewMember.email, role: "crew-member" },
      {
        bookingId: booking.id
      }
    ),
    /must be confirmed/
  );

  const confirmedBooking = await platform.confirmBooking(provider.id, {
    bookingId: booking.id
  });
  assert.equal(confirmedBooking.status, "confirmed");

  const onRouteBooking = await platform.markBookingOnRoute(
    { userId: provider.id, email: provider.email, role: "provider" },
    {
      bookingId: booking.id
    }
  );
  assert.ok(onRouteBooking.onRouteConfirmedAt);

  await attachEvidence(
    platform,
    { userId: provider.id, email: provider.email, role: "provider" },
    booking.id,
    "before"
  );

  const inProgressBooking = await platform.startBooking(
    { userId: provider.id, email: provider.email, role: "provider" },
    {
      bookingId: booking.id
    }
  );
  assert.equal(inProgressBooking.status, "in-progress");
});

test("before and after photos still gate booking start and completion while notes and checklists can also be attached", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-evidence@example.com",
    password: "Password123!",
    phone: "555-1500",
    role: "provider",
    companyName: "Proof Lawn Co.",
    categories: ["lawn-mowing"],
    serviceRadiusMiles: 25,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });
  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-evidence@example.com",
    password: "Password123!",
    phone: "555-1600",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638)
  });
  const crewMember = await platform.registerUser({
    fullName: "Terry Crew",
    email: "crew-evidence@example.com",
    password: "Password123!",
    phone: "555-1700",
    role: "crew-member",
    address: createAddress("118 Garden Row", 30.2437, -97.7634),
    categories: ["lawn-mowing"],
    availableWeekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    willingToTravelMiles: 25
  });
  const unrelatedCrew = await platform.registerUser({
    fullName: "Other Crew",
    email: "other-crew-evidence@example.com",
    password: "Password123!",
    phone: "555-1710",
    role: "crew-member",
    address: createAddress("119 Garden Row", 30.2438, -97.7633),
    categories: ["lawn-mowing"],
    availableWeekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    willingToTravelMiles: 25
  });

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(96),
    scheduledEndIso: futureIso(97),
    notes: "Evidence workflow coverage",
    totalCents: 6200
  });

  const overview = await platform.getProviderStaffingOverview(provider.id);
  const pendingMatch = overview.jobs[0]?.matches.find((match) => match.crewMemberId === crewMember.id);
  assert.ok(pendingMatch);
  await reviewCrewMatchForEligibleProvider(platform, provider.id, {
    crewMatchId: pendingMatch.id,
    action: "accept"
  });
  await platform.confirmBooking(provider.id, { bookingId: booking.id });
  await platform.markBookingOnRoute(
    { userId: provider.id, email: provider.email, role: "provider" },
    { bookingId: booking.id }
  );

  await assert.rejects(
    platform.startBooking(
      { userId: provider.id, email: provider.email, role: "provider" },
      { bookingId: booking.id }
    ),
    /before photo/
  );

  await assert.rejects(
    attachEvidence(
      platform,
      { userId: unrelatedCrew.id, email: unrelatedCrew.email, role: "crew-member" },
      booking.id,
      "before"
    ),
    /accepted crew members/
  );

  const bookingWithBeforeEvidence = await attachEvidence(
    platform,
    { userId: crewMember.id, email: crewMember.email, role: "crew-member" },
    booking.id,
    "before"
  );
  assert.equal(bookingWithBeforeEvidence.serviceEvidence.filter((photo) => photo.phase === "before").length, 1);

  const bookingWithBeforeNote = await platform.addBookingEvidence(
    { userId: provider.id, email: provider.email, role: "provider" },
    {
      bookingId: booking.id,
      phase: "before",
      evidenceType: "note",
      note: "Front gate was open and the lawn was wet from overnight rain."
    }
  );
  assert.ok(
    bookingWithBeforeNote.serviceEvidence.some(
      (evidence) => evidence.phase === "before" && evidence.evidenceType === "note"
    )
  );

  const bookingWithBeforeChecklist = await platform.addBookingEvidence(
    { userId: provider.id, email: provider.email, role: "provider" },
    {
      bookingId: booking.id,
      phase: "before",
      evidenceType: "checklist",
      checklistItems: [
        { label: "Access path confirmed", completed: true },
        { label: "Service area reviewed", completed: true }
      ]
    }
  );
  assert.ok(
    bookingWithBeforeChecklist.serviceEvidence.some(
      (evidence) => evidence.phase === "before" && evidence.evidenceType === "checklist"
    )
  );

  const startedBooking = await platform.startBooking(
    { userId: provider.id, email: provider.email, role: "provider" },
    { bookingId: booking.id }
  );
  assert.equal(startedBooking.status, "in-progress");

  await assert.rejects(
    platform.completeBooking(provider.id, { bookingId: booking.id }),
    /after photo/
  );

  const bookingWithAfterEvidence = await attachEvidence(
    platform,
    { userId: crewMember.id, email: crewMember.email, role: "crew-member" },
    booking.id,
    "after"
  );
  assert.equal(bookingWithAfterEvidence.serviceEvidence.filter((photo) => photo.phase === "after").length, 1);

  const bookingWithAfterNote = await platform.addBookingEvidence(
    { userId: crewMember.id, email: crewMember.email, role: "crew-member" },
    {
      bookingId: booking.id,
      phase: "after",
      evidenceType: "note",
      note: "Trim pass completed and clippings were blown off the driveway."
    }
  );
  assert.ok(
    bookingWithAfterNote.serviceEvidence.some(
      (evidence) => evidence.phase === "after" && evidence.evidenceType === "note"
    )
  );

  const bookingWithAfterChecklist = await platform.addBookingEvidence(
    { userId: crewMember.id, email: crewMember.email, role: "crew-member" },
    {
      bookingId: booking.id,
      phase: "after",
      evidenceType: "checklist",
      checklistItems: [
        { label: "Primary service completed", completed: true },
        { label: "Debris cleared", completed: true }
      ]
    }
  );
  assert.ok(
    bookingWithAfterChecklist.serviceEvidence.some(
      (evidence) => evidence.phase === "after" && evidence.evidenceType === "checklist"
    )
  );

  const completedBooking = await platform.completeBooking(provider.id, { bookingId: booking.id });
  assert.equal(completedBooking.status, "completed");

  const crewLedger = await platform.getCrewPayoutLedger(crewMember.id);
  assert.equal(crewLedger.performanceSummary.completedAssignmentCount, 1);
  assert.equal(crewLedger.performanceSummary.completedWithoutIssueCount, 1);
  assert.equal(crewLedger.performanceSummary.disputedAssignmentCount, 0);
  assert.equal(crewLedger.performanceSummary.refundedAssignmentCount, 0);
  assert.equal(crewLedger.performanceSummary.routeConfirmationCount, 1);
  assert.equal(crewLedger.performanceSummary.beforeEvidenceCount, 1);
  assert.equal(crewLedger.performanceSummary.afterEvidenceCount, 3);
  assert.equal(crewLedger.performanceSummary.evidenceContributionCount, 4);
  assert.deepEqual(crewLedger.performanceSummary.serviceCategories, ["lawn-mowing"]);
  assert.equal(crewLedger.performanceSummary.performanceStatus, "strong");
  assert.ok(
    crewLedger.performanceSummary.highlights.some((highlight) => /crew-captured evidence/i.test(highlight))
  );
  assert.equal(crewLedger.performanceSummary.warnings.length, 0);
});

test("customers can share private property photos with the provider and explicitly control public before-and-after use", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const photoStorage = new FakePrivatePhotoStorage();
  const platform = new MarketplacePlatformService(
    repository,
    new DataEngineeringLogger(),
    undefined,
    undefined,
    undefined,
    photoStorage
  );

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-customer-photos@example.com",
    password: "Password123!",
    phone: "555-1720",
    role: "provider",
    companyName: "Proof Lawn Co.",
    categories: ["hedge-trimming"],
    serviceRadiusMiles: 25,
    address: createAddress("1400 Provider Way", 39.755, -74.22)
  });
  await repository.updateProvider(provider.id, { verificationStatus: "verified" });

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-property-photos@example.com",
    password: "Password123!",
    phone: "555-1730",
    role: "customer",
    propertyLabel: "Home",
    address: createAddress("112 Garden Row", 39.7532, -74.2229)
  });
  const otherCustomer = await platform.registerUser({
    fullName: "Sam Neighbor",
    email: "other-customer-property-photos@example.com",
    password: "Password123!",
    phone: "555-1740",
    role: "customer",
    propertyLabel: "Home",
    address: createAddress("114 Garden Row", 39.7534, -74.2227)
  });

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: customer.address,
    servicePropertyId: customer.defaultPropertyId,
    category: "hedge-trimming",
    scheduledStartIso: futureIso(96),
    scheduledEndIso: futureIso(98),
    notes: "Front shrubs beside the steps",
    totalCents: 8400
  });

  await assert.rejects(
    platform.addBookingEvidence(
      { userId: otherCustomer.id, email: otherCustomer.email, role: "customer" },
      {
        bookingId: booking.id,
        phase: "before",
        imageDataUrl: testImageDataUrl("not-their-property")
      }
    ),
    /their own bookings/
  );
  await assert.rejects(
    platform.addBookingEvidence(
      { userId: customer.id, email: customer.email, role: "customer" },
      {
        bookingId: booking.id,
        phase: "after",
        imageDataUrl: testImageDataUrl("customer-after")
      }
    ),
    /before-service property photos/
  );

  const withCustomerPhoto = await platform.addBookingEvidence(
    { userId: customer.id, email: customer.email, role: "customer" },
    {
      bookingId: booking.id,
      phase: "before",
      imageDataUrl: testImageDataUrl("front-shrubs-before"),
      photoArea: "shrubs",
      note: "Trim below the front window."
    }
  );
  const customerPhoto = withCustomerPhoto.serviceEvidence[0];
  assert.equal(customerPhoto?.capturedByRole, "customer");
  assert.equal(customerPhoto?.photoArea, "shrubs");
  assert.equal(customerPhoto?.marketingUseStatus, undefined);
  assert.equal(customerPhoto?.imageStorageProvider, "vercel-blob-private");
  assert.match(customerPhoto?.imageDataUrl ?? "", /\/api\/media\/evidence\//);
  await assert.rejects(
    platform.getEvidencePhoto(customerPhoto!.id, "wrong-token", false),
    /Photo not found/
  );
  const privatePhoto = await platform.getEvidencePhoto(
    customerPhoto!.id,
    `secret-${customerPhoto!.id}`,
    false
  );
  assert.equal(privatePhoto.contentType, "image/png");

  const providerOverview = await platform.getProviderStaffingOverview(provider.id);
  assert.equal(providerOverview.jobs[0]?.evidencePhotos.length, 1);
  assert.equal(providerOverview.jobs[0]?.evidencePhotos[0]?.capturedByRole, "customer");
  assert.equal(providerOverview.jobs[0]?.beforeEvidenceCount, 0);

  await platform.confirmBooking(provider.id, { bookingId: booking.id });
  await platform.markBookingOnRoute(
    { userId: provider.id, email: provider.email, role: "provider" },
    { bookingId: booking.id }
  );
  await assert.rejects(
    platform.startBooking(
      { userId: provider.id, email: provider.email, role: "provider" },
      { bookingId: booking.id }
    ),
    /before photo/
  );
  await platform.addBookingEvidence(
    { userId: provider.id, email: provider.email, role: "provider" },
    {
      bookingId: booking.id,
      phase: "before",
      imageDataUrl: testImageDataUrl("provider-arrival-before"),
      photoArea: "shrubs"
    }
  );
  const started = await platform.startBooking(
    { userId: provider.id, email: provider.email, role: "provider" },
    { bookingId: booking.id }
  );
  assert.equal(started.status, "in-progress");

  await assert.rejects(
    platform.updateBookingPhotoMarketingUse(customer.id, { bookingId: booking.id, status: "granted" }),
    /after the service is complete/
  );

  await platform.addBookingEvidence(
    { userId: provider.id, email: provider.email, role: "provider" },
    {
      bookingId: booking.id,
      phase: "after",
      imageDataUrl: testImageDataUrl("front-shrubs-after"),
      photoArea: "shrubs",
      note: "Shrubs shaped and clippings removed."
    }
  );
  await platform.completeBooking(provider.id, { bookingId: booking.id });

  assert.equal((await platform.getPublicMarketplaceOverview()).beforeAfterProjects.length, 0);

  const granted = await platform.updateBookingPhotoMarketingUse(customer.id, {
    bookingId: booking.id,
    status: "granted"
  });
  assert.ok(
    granted.serviceEvidence
      .filter((evidence) => evidence.evidenceType === "photo")
      .every((evidence) => evidence.marketingUseStatus === "granted")
  );

  const publicOverview = await platform.getPublicMarketplaceOverview();
  assert.equal(publicOverview.beforeAfterProjects.length, 1);
  assert.deepEqual(publicOverview.beforeAfterProjects[0], {
    bookingId: booking.id,
    providerId: provider.id,
    providerCompanyName: "Proof Lawn Co.",
    city: customer.address.city,
    state: customer.address.state,
    category: "hedge-trimming",
    photoArea: "shrubs",
    completedAt: granted.completedAt,
    beforeImageDataUrl: `https://api.staging.yardmatch.test/api/media/marketing/${customerPhoto!.id}`,
    afterImageDataUrl: `https://api.staging.yardmatch.test/api/media/marketing/${
      granted.serviceEvidence.find((evidence) => evidence.phase === "after" && evidence.evidenceType === "photo")!.id
    }`
  });
  assert.equal((await platform.getEvidencePhoto(customerPhoto!.id, undefined, true)).contentType, "image/png");
  assert.equal("customerName" in publicOverview.beforeAfterProjects[0]!, false);
  assert.equal("streetAddress" in publicOverview.beforeAfterProjects[0]!, false);

  await assert.rejects(
    platform.updateBookingPhotoMarketingUse(otherCustomer.id, {
      bookingId: booking.id,
      status: "revoked"
    }),
    /booking customer/
  );
  await platform.updateBookingPhotoMarketingUse(customer.id, {
    bookingId: booking.id,
    status: "revoked"
  });
  assert.equal((await platform.getPublicMarketplaceOverview()).beforeAfterProjects.length, 0);
  await assert.rejects(
    platform.getEvidencePhoto(customerPhoto!.id, undefined, true),
    /Photo not found/
  );
});

test("ops can annotate booking evidence for disputes and refund reviews", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-evidence-review@example.com",
    password: "Password123!",
    phone: "555-1750",
    role: "provider",
    companyName: "Proof Lawn Co.",
    categories: ["lawn-mowing"],
    serviceRadiusMiles: 25,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });
  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-evidence-review@example.com",
    password: "Password123!",
    phone: "555-1760",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638)
  });

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(96),
    scheduledEndIso: futureIso(97),
    notes: "Evidence review workflow coverage",
    totalCents: 6200
  });

  const bookingWithEvidence = await attachEvidence(
    platform,
    { userId: provider.id, email: provider.email, role: "provider" },
    booking.id,
    "before"
  );
  const evidenceId = bookingWithEvidence.serviceEvidence[0]?.id;
  assert.ok(evidenceId);

  const ticket = await platform.createSupportTicket(
    { userId: customer.id, role: "customer" },
    {
      bookingId: booking.id,
      issueType: "service-quality",
      subject: "Need evidence review",
      description: "Please review the before-work photo."
    }
  );

  const updatedBooking = await platform.reviewBookingEvidenceForOps({
    bookingId: booking.id,
    ticketId: ticket.id,
    evidenceId: evidenceId!,
    reviewStatus: "supports-provider",
    reviewNotes: "Before-work photo clearly shows the uncut lawn."
  });

  assert.equal(updatedBooking.serviceEvidence[0]?.reviewStatus, "supports-provider");
  assert.equal(updatedBooking.serviceEvidence[0]?.reviewedByRole, "ops");
  assert.match(updatedBooking.serviceEvidence[0]?.reviewNotes ?? "", /uncut lawn/i);

  const updatedTicket = (await repository.listSupportTickets()).find((candidate) => candidate.id === ticket.id);
  assert.ok(updatedTicket);
  assert.equal(updatedTicket?.status, "triaged");
  assert.match(updatedTicket?.description ?? "", /Ops evidence review: before supports-provider/i);
});

test("ops support tickets include evidence summaries and resolution guidance", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-guidance@example.com",
    password: "Password123!",
    phone: "555-1510",
    role: "provider",
    companyName: "Guidance Lawn Co.",
    categories: ["lawn-mowing"],
    serviceRadiusMiles: 25,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });
  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-guidance@example.com",
    password: "Password123!",
    phone: "555-1610",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638)
  });

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(72),
    scheduledEndIso: futureIso(73),
    notes: "Evidence guidance coverage",
    totalCents: 6200
  });

  await repository.updateBooking(booking.id, {
    status: "disputed",
    disputedAt: new Date().toISOString(),
    disputeReason: "Customer said the job was incomplete.",
    disputedByRole: "customer"
  });

  const ticket = await platform.createSupportTicket(
    { userId: customer.id, role: "customer" },
    {
      bookingId: booking.id,
      subject: "Review service evidence",
      description: "Customer challenged whether the crew completed the work.",
      issueType: "service-quality"
    }
  );

  const bookingWithPhoto = await platform.addBookingEvidence(
    { userId: provider.id, email: provider.email, role: "provider" },
    {
      bookingId: booking.id,
      phase: "after",
      evidenceType: "photo",
      imageDataUrl: testImageDataUrl("after-photo")
    }
  );
  const photoEvidenceId = bookingWithPhoto.serviceEvidence.find((evidence) => evidence.evidenceType === "photo")?.id;
  assert.ok(photoEvidenceId);

  await platform.addBookingEvidence(
    { userId: provider.id, email: provider.email, role: "provider" },
    {
      bookingId: booking.id,
      phase: "after",
      evidenceType: "note",
      note: "Completed mow, edging, and cleanup around the driveway."
    }
  );

  await platform.reviewBookingEvidenceForOps({
    bookingId: booking.id,
    evidenceId: photoEvidenceId!,
    reviewStatus: "supports-provider",
    reviewNotes: "The after photo shows fresh mow lines and trimmed edges.",
    ticketId: ticket.id
  });

  const opsTickets = await platform.listOpsSupportTickets();
  const opsTicket = opsTickets.find((candidate) => candidate.ticket.id === ticket.id);
  assert.ok(opsTicket?.evidenceSummary);
  assert.equal(opsTicket?.evidenceSummary?.photoCount, 1);
  assert.equal(opsTicket?.evidenceSummary?.noteCount, 1);
  assert.equal(opsTicket?.evidenceSummary?.supportsProviderCount, 1);
  assert.equal(opsTicket?.resolutionGuidance?.recommendedAction, "restore-active-booking");
  assert.equal(opsTicket?.resolutionGuidance?.confidence, "medium");
  assert.ok(
    opsTicket?.resolutionGuidance?.templates.some((template) => template.key === "issue-resolution")
  );
  assert.equal(opsTicket?.resolutionPolicy?.evidenceSignal, "supports-provider");
  assert.equal(opsTicket?.resolutionPolicy?.requiresDetailedRationale, false);
  assert.ok(opsTicket?.resolutionPolicy?.blockedActions.includes("cancel-booking"));
  assert.ok(
    opsTicket?.resolutionPolicy?.warnings.some((warning) => /leans toward the provider/i.test(warning))
  );
});

test("completed disputed bookings guide ops toward keeping the booking complete", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(
    repository,
    new DataEngineeringLogger(),
    createFakeStripeGateway()
  );

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-completed-dispute-guidance@example.com",
    password: "Password123!",
    phone: "555-1710",
    role: "provider",
    companyName: "Completed Guidance Lawn Co.",
    categories: ["lawn-mowing"],
    serviceRadiusMiles: 25,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });
  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-completed-dispute-guidance@example.com",
    password: "Password123!",
    phone: "555-1810",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638)
  });

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(74),
    scheduledEndIso: futureIso(75),
    notes: "Completed dispute guidance coverage",
    totalCents: 6200
  });

  await platform.confirmBooking(provider.id, { bookingId: booking.id });
  const bookingWithEvidence = await platform.addBookingEvidence(
    { userId: provider.id, email: provider.email, role: "provider" },
    {
      bookingId: booking.id,
      phase: "after",
      evidenceType: "photo",
      imageDataUrl: testImageDataUrl("completed-after-photo")
    }
  );
  const photoEvidenceId = bookingWithEvidence.serviceEvidence.find(
    (evidence) => evidence.evidenceType === "photo"
  )?.id;
  assert.ok(photoEvidenceId);

  await platform.completeBooking(provider.id, { bookingId: booking.id });
  await repository.updateBooking(booking.id, {
    status: "disputed",
    disputedAt: new Date().toISOString(),
    disputeReason: "Customer questioned the finished cut quality.",
    disputedByRole: "customer"
  });

  const ticket = await platform.createSupportTicket(
    { userId: customer.id, role: "customer" },
    {
      bookingId: booking.id,
      subject: "Review completed service evidence",
      description: "Customer challenged whether the finished job should stay marked complete.",
      issueType: "service-quality"
    }
  );

  await platform.reviewBookingEvidenceForOps({
    bookingId: booking.id,
    evidenceId: photoEvidenceId!,
    reviewStatus: "supports-provider",
    reviewNotes: "The after photo supports keeping the completed service record in place.",
    ticketId: ticket.id
  });

  const opsTicket = (await platform.listOpsSupportTickets()).find((candidate) => candidate.ticket.id === ticket.id);
  assert.equal(opsTicket?.resolutionGuidance?.recommendedAction, "complete-booking");
  assert.equal(opsTicket?.resolutionGuidance?.confidence, "medium");
});

test("paid completed disputes require refund review before cancellation resolves the hold", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(
    repository,
    new DataEngineeringLogger(),
    createFakeStripeGateway()
  );

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-paid-dispute-refund-guard@example.com",
    password: "Password123!",
    phone: "555-1850",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress()
  });
  const provider = (await repository.listProviders())[0];
  assert.ok(provider);

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress(),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(76),
    scheduledEndIso: futureIso(77),
    notes: "Paid completed dispute refund guard",
    totalCents: 7200
  });

  await platform.confirmBooking(provider.id, { bookingId: booking.id });
  await platform.addBookingEvidence(
    { userId: provider.id, email: provider.email, role: "provider" },
    {
      bookingId: booking.id,
      phase: "after",
      evidenceType: "photo",
      imageDataUrl: testImageDataUrl("customer-leaning-photo")
    }
  );
  await platform.addBookingEvidence(
    { userId: provider.id, email: provider.email, role: "provider" },
    {
      bookingId: booking.id,
      phase: "after",
      evidenceType: "note",
      note: "Crew note confirms part of the requested edging was missed."
    }
  );
  await platform.completeBooking(provider.id, { bookingId: booking.id });
  await platform.createCheckoutSession(customer.id, { bookingId: booking.id });
  await platform.finalizeCheckoutSession(customer.id, {
    checkoutSessionId: "cs_test_123"
  });

  await platform.createBookingDispute(
    {
      userId: customer.id,
      email: customer.email,
      role: "customer"
    },
    {
      bookingId: booking.id,
      reason: "Customer reported the completed visit missed the promised edging."
    }
  );

  const disputeTicket = (await platform.listOpsSupportTickets()).find(
    (entry) => entry.ticket.bookingId === booking.id && entry.ticket.issueType === "service-quality"
  );
  assert.ok(disputeTicket);
  const refreshedDisputeTicket = (await platform.listOpsSupportTickets()).find(
    (entry) => entry.ticket.id === disputeTicket?.ticket.id
  );
  const photoEvidenceId = refreshedDisputeTicket?.booking?.serviceEvidence.find(
    (evidence) => evidence.evidenceType === "photo"
  )?.id;
  const noteEvidenceId = refreshedDisputeTicket?.booking?.serviceEvidence.find(
    (evidence) => evidence.evidenceType === "note"
  )?.id;
  assert.ok(photoEvidenceId);
  assert.ok(noteEvidenceId);

  await platform.reviewBookingEvidenceForOps({
    bookingId: booking.id,
    ticketId: disputeTicket?.ticket.id ?? "",
    evidenceId: photoEvidenceId,
    reviewStatus: "supports-customer",
    reviewNotes: "The photo shows the disputed edging was not finished."
  });
  await platform.reviewBookingEvidenceForOps({
    bookingId: booking.id,
    ticketId: disputeTicket?.ticket.id ?? "",
    evidenceId: noteEvidenceId,
    reviewStatus: "supports-customer",
    reviewNotes: "The provider note confirms a material scope miss."
  });

  const guardedTicket = (await platform.listOpsSupportTickets()).find(
    (entry) => entry.ticket.id === disputeTicket?.ticket.id
  );
  assert.equal(guardedTicket?.resolutionGuidance?.recommendedAction, undefined);
  assert.match(guardedTicket?.resolutionGuidance?.rationale ?? "", /refund review/i);
  assert.ok(guardedTicket?.resolutionPolicy?.blockedActions.includes("cancel-booking"));
  assert.ok(
    guardedTicket?.resolutionPolicy?.warnings.some((warning) => /captured customer payment/i.test(warning))
  );

  await assert.rejects(
    () =>
      platform.updateSupportTicketForOps({
        ticketId: disputeTicket?.ticket.id ?? "",
        status: "resolved",
        resolutionAction: "cancel-booking",
        resolutionNotes:
          "Support reviewed the completed dispute and found the customer evidence strong enough to unwind the job."
      }),
    /refund review before cancelling/i
  );

  const stillDisputedBooking = await repository.findBookingById(booking.id);
  assert.equal(stillDisputedBooking?.status, "disputed");

  const providerLedger = await platform.getProviderPayoutLedger(provider.id);
  const providerEntry = providerLedger.entries.find((entry) => entry.bookingId === booking.id);
  assert.equal(providerEntry?.status, "on-hold");
  assert.match(providerEntry?.note ?? "", /booking dispute is open/i);

  const payment = (await platform.listPaymentsForUser({
    userId: customer.id,
    email: customer.email,
    role: "customer"
  }))[0];
  assert.equal(payment?.status, "captured");
  assert.equal(payment?.refundReviewStatus, undefined);
});

test("ops cannot deny a refund review when reviewed evidence still supports the customer", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(
    repository,
    new DataEngineeringLogger(),
    createFakeStripeGateway()
  );

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-refund-direction-gate@example.com",
    password: "Password123!",
    phone: "555-1910",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress()
  });
  const provider = (await repository.listProviders())[0];
  assert.ok(provider);

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress(),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(90),
    scheduledEndIso: futureIso(91),
    notes: "Refund direction gate test",
    totalCents: 7200
  });

  await platform.confirmBooking(provider.id, { bookingId: booking.id });
  await attachEvidence(
    platform,
    { userId: provider.id, email: provider.email, role: "provider" },
    booking.id,
    "after"
  );
  await platform.completeBooking(provider.id, { bookingId: booking.id });
  await platform.createCheckoutSession(customer.id, { bookingId: booking.id });
  await platform.finalizeCheckoutSession(customer.id, {
    checkoutSessionId: "cs_test_123"
  });

  const payment = (await platform.listPaymentsForUser({
    userId: customer.id,
    email: customer.email,
    role: "customer"
  }))[0];
  assert.ok(payment);

  await platform.createRefund(
    {
      userId: customer.id,
      email: customer.email,
      role: "customer"
    },
    {
      paymentId: payment?.id ?? "",
      reason: "Please review this payment."
    }
  );

  const refundTicket = (await platform.listOpsSupportTickets()).find(
    (entry) => entry.ticket.bookingId === booking.id && entry.ticket.issueType === "billing"
  );
  assert.ok(refundTicket?.booking?.serviceEvidence[0]);

  await platform.reviewBookingEvidenceForOps({
    bookingId: booking.id,
    ticketId: refundTicket?.ticket.id ?? "",
    evidenceId: refundTicket?.booking?.serviceEvidence[0]?.id ?? "",
    reviewStatus: "supports-customer",
    reviewNotes: "Evidence currently supports the customer request."
  });

  await assert.rejects(
    () =>
      platform.updateSupportTicketForOps({
        ticketId: refundTicket?.ticket.id ?? "",
        status: "resolved",
        resolutionAction: "deny-refund",
        resolutionNotes: "Support reviewed the refund request and kept the payment captured."
      }),
    /does not currently support a provider-favoring resolution/i
  );
});

test("ops cannot restore a disputed booking when reviewed evidence still supports the customer", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-dispute-direction-gate@example.com",
    password: "Password123!",
    phone: "555-2010",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress()
  });

  const provider = (await repository.listProviders())[0];
  assert.ok(provider);

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress(),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(92),
    scheduledEndIso: futureIso(93),
    notes: "Dispute direction gate test",
    totalCents: 6200
  });

  await platform.confirmBooking(provider.id, {
    bookingId: booking.id
  });
  await attachEvidence(
    platform,
    { userId: provider.id, email: provider.email, role: "provider" },
    booking.id,
    "after"
  );

  await platform.createBookingDispute(
    {
      userId: customer.id,
      email: customer.email,
      role: "customer"
    },
    {
      bookingId: booking.id,
      reason: "Support should review whether this job should stay active."
    }
  );

  const disputeTicket = (await platform.listOpsSupportTickets()).find(
    (entry) => entry.ticket.bookingId === booking.id && entry.ticket.status === "open"
  );
  assert.ok(disputeTicket?.booking?.serviceEvidence[0]);

  await platform.reviewBookingEvidenceForOps({
    bookingId: booking.id,
    ticketId: disputeTicket?.ticket.id ?? "",
    evidenceId: disputeTicket?.booking?.serviceEvidence[0]?.id ?? "",
    reviewStatus: "supports-customer",
    reviewNotes: "Evidence currently supports the customer side."
  });

  await assert.rejects(
    () =>
      platform.updateSupportTicketForOps({
        ticketId: disputeTicket?.ticket.id ?? "",
        status: "resolved",
        resolutionAction: "restore-active-booking",
        resolutionNotes: "Support resolved the dispute and restored the booking."
      }),
    /does not currently support a provider-favoring resolution/i
  );
});

test("ops require a detailed rationale before resolving a mixed-evidence refund review", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(
    repository,
    new DataEngineeringLogger(),
    createFakeStripeGateway()
  );

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-refund-mixed-rationale@example.com",
    password: "Password123!",
    phone: "555-2110",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress()
  });
  const provider = (await repository.listProviders())[0];
  assert.ok(provider);

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress(),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(94),
    scheduledEndIso: futureIso(95),
    notes: "Mixed evidence refund rationale test",
    totalCents: 7300
  });

  await platform.confirmBooking(provider.id, { bookingId: booking.id });
  const bookingWithPhoto = await platform.addBookingEvidence(
    { userId: provider.id, email: provider.email, role: "provider" },
    {
      bookingId: booking.id,
      phase: "after",
      evidenceType: "photo",
      imageDataUrl: testImageDataUrl("mixed-refund-photo")
    }
  );
  const photoEvidenceId = bookingWithPhoto.serviceEvidence.find(
    (evidence) => evidence.evidenceType === "photo"
  )?.id;
  assert.ok(photoEvidenceId);

  const bookingWithNote = await platform.addBookingEvidence(
    { userId: provider.id, email: provider.email, role: "provider" },
    {
      bookingId: booking.id,
      phase: "after",
      evidenceType: "note",
      note: "Customer reported a missed strip near the fence even though the main cut looked complete."
    }
  );
  const noteEvidenceId = bookingWithNote.serviceEvidence.find((evidence) => evidence.evidenceType === "note")?.id;
  assert.ok(noteEvidenceId);

  await platform.completeBooking(provider.id, { bookingId: booking.id });
  await platform.createCheckoutSession(customer.id, { bookingId: booking.id });
  await platform.finalizeCheckoutSession(customer.id, {
    checkoutSessionId: "cs_test_123"
  });

  const payment = (await platform.listPaymentsForUser({
    userId: customer.id,
    email: customer.email,
    role: "customer"
  }))[0];
  assert.ok(payment);

  await platform.createRefund(
    {
      userId: customer.id,
      email: customer.email,
      role: "customer"
    },
    {
      paymentId: payment.id,
      reason: "Please review the final service quality."
    }
  );

  const refundTicket = (await platform.listOpsSupportTickets()).find(
    (entry) => entry.ticket.bookingId === booking.id && entry.ticket.issueType === "billing"
  );
  assert.ok(refundTicket);

  await platform.reviewBookingEvidenceForOps({
    bookingId: booking.id,
    ticketId: refundTicket?.ticket.id ?? "",
    evidenceId: photoEvidenceId!,
    reviewStatus: "supports-provider",
    reviewNotes: "The after photo suggests the overall mow was completed."
  });
  await platform.reviewBookingEvidenceForOps({
    bookingId: booking.id,
    ticketId: refundTicket?.ticket.id ?? "",
    evidenceId: noteEvidenceId!,
    reviewStatus: "supports-customer",
    reviewNotes: "The provider note acknowledges an unfinished strip near the fence."
  });

  const policyTicket = (await platform.listOpsSupportTickets()).find(
    (entry) => entry.ticket.id === refundTicket?.ticket.id
  );
  assert.equal(policyTicket?.resolutionPolicy?.evidenceSignal, "mixed");
  assert.equal(policyTicket?.resolutionPolicy?.requiresDetailedRationale, true);
  assert.equal(policyTicket?.resolutionPolicy?.blockedActions.length, 0);
  assert.equal(policyTicket?.resolutionPolicy?.minimumDetailedRationaleLength, 48);
  assert.ok(
    policyTicket?.resolutionPolicy?.warnings.some((warning) => /low-confidence/i.test(warning))
  );

  await assert.rejects(
    () =>
      platform.updateSupportTicketForOps({
        ticketId: refundTicket?.ticket.id ?? "",
        status: "resolved",
        resolutionAction: "deny-refund",
        resolutionNotes: "Support reviewed the refund request and kept the payment captured."
      }),
    /specific manual rationale/i
  );
});

test("ops can apply a mixed-evidence disputed intervention when the note is specific", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-dispute-mixed-intervention@example.com",
    password: "Password123!",
    phone: "555-2120",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress()
  });
  const provider = (await repository.listProviders())[0];
  assert.ok(provider);

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress(),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(96),
    scheduledEndIso: futureIso(97),
    notes: "Mixed evidence intervention rationale test",
    totalCents: 6800
  });

  await platform.confirmBooking(provider.id, { bookingId: booking.id });
  const bookingWithPhoto = await platform.addBookingEvidence(
    { userId: provider.id, email: provider.email, role: "provider" },
    {
      bookingId: booking.id,
      phase: "after",
      evidenceType: "photo",
      imageDataUrl: testImageDataUrl("mixed-dispute-photo")
    }
  );
  const photoEvidenceId = bookingWithPhoto.serviceEvidence.find(
    (evidence) => evidence.evidenceType === "photo"
  )?.id;
  assert.ok(photoEvidenceId);

  const bookingWithNote = await platform.addBookingEvidence(
    { userId: provider.id, email: provider.email, role: "provider" },
    {
      bookingId: booking.id,
      phase: "after",
      evidenceType: "note",
      note: "Customer flagged a narrow missed edge by the back gate during the walkthrough."
    }
  );
  const noteEvidenceId = bookingWithNote.serviceEvidence.find((evidence) => evidence.evidenceType === "note")?.id;
  assert.ok(noteEvidenceId);

  await platform.createBookingDispute(
    {
      userId: customer.id,
      email: customer.email,
      role: "customer"
    },
    {
      bookingId: booking.id,
      reason: "Support should decide whether this booking can return to the schedule."
    }
  );

  const disputeTicket = (await platform.listOpsSupportTickets()).find(
    (entry) => entry.ticket.bookingId === booking.id && entry.ticket.issueType === "service-quality"
  );
  assert.ok(disputeTicket);

  await platform.reviewBookingEvidenceForOps({
    bookingId: booking.id,
    ticketId: disputeTicket?.ticket.id ?? "",
    evidenceId: photoEvidenceId!,
    reviewStatus: "supports-provider",
    reviewNotes: "The photo suggests most of the finished work is intact."
  });
  await platform.reviewBookingEvidenceForOps({
    bookingId: booking.id,
    ticketId: disputeTicket?.ticket.id ?? "",
    evidenceId: noteEvidenceId!,
    reviewStatus: "supports-customer",
    reviewNotes: "The note confirms there was still a small missed area to review."
  });

  const updatedBooking = await platform.createOpsBookingIntervention({
    bookingId: booking.id,
    ticketId: disputeTicket?.ticket.id ?? "",
    action: "restore-active-booking",
    note:
      "Ops reviewed the conflicting photo and note, confirmed the missed strip was minor, and is restoring the booking while requiring provider follow-up on the edge cleanup."
  });

  assert.equal(updatedBooking.status, "confirmed");
  assert.equal(updatedBooking.interventions.at(-1)?.action, "restore-active-booking");
});

test("ops support tickets include a structured audit timeline for refund, evidence, and resolution events", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(
    repository,
    new DataEngineeringLogger(),
    createFakeStripeGateway()
  );

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-support-timeline@example.com",
    password: "Password123!",
    phone: "555-0200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress()
  });
  const provider = (await repository.listProviders())[0];
  assert.ok(provider);

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress(),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(72),
    scheduledEndIso: futureIso(73),
    notes: "Support timeline test",
    totalCents: 7200
  });

  await platform.confirmBooking(provider.id, { bookingId: booking.id });
  await attachEvidence(
    platform,
    { userId: provider.id, email: provider.email, role: "provider" },
    booking.id,
    "after"
  );
  await platform.completeBooking(provider.id, { bookingId: booking.id });
  await platform.createCheckoutSession(customer.id, {
    bookingId: booking.id
  });
  await platform.finalizeCheckoutSession(customer.id, {
    checkoutSessionId: "cs_test_123"
  });

  const payment = (await platform.listPaymentsForUser({
    userId: customer.id,
    email: customer.email,
    role: "customer"
  }))[0];
  assert.ok(payment);

  await platform.createRefund(
    {
      userId: customer.id,
      email: customer.email,
      role: "customer"
    },
    {
      paymentId: payment?.id ?? "",
      reason: "Customer requested a refund review for the timeline."
    }
  );

  const ticket = (await platform.listOpsSupportTickets()).find(
    (candidate) => candidate.ticket.bookingId === booking.id && candidate.ticket.issueType === "billing"
  );
  assert.ok(ticket?.booking);
  assert.ok(ticket?.booking?.serviceEvidence[0]);

  await platform.reviewBookingEvidenceForOps({
    bookingId: booking.id,
    ticketId: ticket?.ticket.id ?? "",
    evidenceId: ticket?.booking?.serviceEvidence[0]?.id ?? "",
    reviewStatus: "supports-provider",
    reviewNotes: "Reviewed timeline evidence."
  });

  await platform.updateSupportTicketForOps({
    ticketId: ticket?.ticket.id ?? "",
    status: "triaged"
  });

  await platform.updateSupportTicketForOps({
    ticketId: ticket?.ticket.id ?? "",
    status: "resolved",
    resolutionAction: "deny-refund",
    resolutionNotes:
      "Support reviewed the submitted photo, found no clear proof of unfinished work, and kept the payment captured while documenting the remaining customer concern for follow-up."
  });

  const refreshedTicket = (await platform.listOpsSupportTickets()).find(
    (candidate) => candidate.ticket.id === ticket?.ticket.id
  );
  assert.ok(refreshedTicket);
  const timelineKinds = refreshedTicket?.timeline.map((entry) => entry.kind) ?? [];
  assert.ok(timelineKinds.includes("ticket-opened"));
  assert.ok(timelineKinds.includes("refund-review-opened"));
  assert.ok(timelineKinds.includes("evidence-reviewed"));
  assert.ok(timelineKinds.includes("ticket-triaged"));
  assert.ok(timelineKinds.includes("refund-review-resolved"));
  assert.ok(timelineKinds.includes("ticket-resolved"));
  assert.ok(
    refreshedTicket?.timeline.some(
      (entry) =>
        entry.kind === "ticket-resolved" &&
        /kept the payment captured/i.test(entry.detail)
    )
  );
});

test("providers cannot complete requested bookings before confirmation", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-precomplete@example.com",
    password: "Password123!",
    phone: "555-2200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress()
  });
  assert.equal(customer.role, "customer");

  const provider = (await repository.listProviders())[0];
  assert.ok(provider);

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress(),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(72),
    scheduledEndIso: futureIso(73),
    notes: "Front and back yard",
    totalCents: 6200
  });

  await assert.rejects(
    platform.completeBooking(provider.id, {
      bookingId: booking.id
    }),
    /must be confirmed/
  );
});

test("notifications track booking, staffing, and review milestones across roles", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-notify@example.com",
    password: "Password123!",
    phone: "555-3300",
    role: "provider",
    companyName: "Signal Lawn Co.",
    categories: ["mulch-installation"],
    serviceRadiusMiles: 25,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });
  assert.equal(provider.role, "provider");

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-notify@example.com",
    password: "Password123!",
    phone: "555-3200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638)
  });
  assert.equal(customer.role, "customer");

  const crew = await platform.registerUser({
    fullName: "Terry Crew",
    email: "crew-notify@example.com",
    password: "Password123!",
    phone: "555-3400",
    role: "crew-member",
    address: createAddress("118 Garden Row", 30.2437, -97.7634),
    categories: ["mulch-installation"],
    availableWeekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    willingToTravelMiles: 25
  });
  assert.equal(crew.role, "crew-member");

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: customer.defaultPropertyId,
    category: "mulch-installation",
    scheduledStartIso: futureIso(72),
    scheduledEndIso: futureIso(75),
    notes: "Front beds and walkway border",
    totalCents: 9200
  });

  const providerNotifications = await platform.listNotifications({
    userId: provider.id,
    email: provider.email,
    role: "provider"
  });
  assert.equal(providerNotifications.unreadCount, 1);
  assert.equal(providerNotifications.notifications[0]?.title, "New booking request");

  await platform.confirmBooking(provider.id, { bookingId: booking.id });
  const customerNotifications = await platform.listNotifications({
    userId: customer.id,
    email: customer.email,
    role: "customer"
  });
  assert.ok(customerNotifications.notifications.some((notification) => notification.title === "Your booking is confirmed"));

  const staffing = await platform.getProviderStaffingOverview(provider.id);
  const crewMatch = staffing.jobs[0]?.matches.find((match) => match.crewMemberId === crew.id);
  assert.ok(crewMatch);

  const crewPendingNotifications = await platform.listNotifications({
    userId: crew.id,
    email: crew.email,
    role: "crew-member"
  });
  assert.ok(crewPendingNotifications.notifications.some((notification) => notification.title === "You have a new crew match"));

  await reviewCrewMatchForEligibleProvider(platform, provider.id, {
    crewMatchId: crewMatch.id,
    action: "accept"
  });

  const crewAcceptedNotifications = await platform.listNotifications({
    userId: crew.id,
    email: crew.email,
    role: "crew-member"
  });
  assert.ok(crewAcceptedNotifications.notifications.some((notification) => notification.title === "You were accepted for a job"));

  await platform.markNotificationsRead(
    {
      userId: crew.id,
      email: crew.email,
      role: "crew-member"
    },
    {}
  );
  const crewReadNotifications = await platform.listNotifications({
    userId: crew.id,
    email: crew.email,
    role: "crew-member"
  });
  assert.equal(crewReadNotifications.unreadCount, 0);
});

test("notifications generate external delivery records for push, email, and sms", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-delivery@example.com",
    password: "Password123!",
    phone: "555-3500",
    role: "provider",
    companyName: "Signal Lawn Co.",
    categories: ["lawn-mowing"],
    serviceRadiusMiles: 25,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-delivery@example.com",
    password: "Password123!",
    phone: "555-3600",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638)
  });

  await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: undefined,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(24),
    scheduledEndIso: futureIso(25),
    notes: "Delivery fanout test",
    totalCents: 6200
  });

  const deliveries = await platform.listNotificationDeliveries({
    userId: provider.id,
    email: provider.email,
    role: "provider"
  });

  const channels = deliveries.deliveries.map((delivery) => delivery.channel).sort();
  assert.deepEqual(channels, ["email", "push", "sms"]);
  assert.ok(deliveries.deliveries.every((delivery) => delivery.status === "sent"));
});

test("selecting a public crew opportunity texts auto-accept providers that the opening was filled", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-auto-select@example.com",
    password: "Password123!",
    phone: "555-3510",
    role: "provider",
    companyName: "Auto Select Lawn Co.",
    categories: ["lawn-mowing"],
    serviceRadiusMiles: 25,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });
  await platform.updateProviderSettings(provider.id, {
    serviceRadiusMiles: provider.serviceRadiusMiles,
    staffingMode: "auto-accept"
  });

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-auto-select@example.com",
    password: "Password123!",
    phone: "555-3610",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638)
  });

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: undefined,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(30),
    scheduledEndIso: futureIso(31),
    notes: "Public crew selection auto accept test",
    totalCents: 6200
  });

  const selection = await platform.selectPublicCrewOpportunity({ opportunityId: booking.id });
  assert.equal(selection.staffingMode, "auto-accept");
  assert.equal(selection.notificationTitle, "Your crew opening was filled");

  const deliveries = await platform.listNotificationDeliveries({
    userId: provider.id,
    email: provider.email,
    role: "provider"
  });
  const sms = deliveries.deliveries.find(
    (delivery) => delivery.channel === "sms" && delivery.title === "Your crew opening was filled"
  );
  assert.ok(sms);
  assert.match(sms.bodyPreview, /auto-accept setting marked the opening as filled/i);
});

test("crew members can claim a selected public opportunity after signup", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-claim-select@example.com",
    password: "Password123!",
    phone: "555-3515",
    role: "provider",
    companyName: "Claim Select Lawn Co.",
    categories: ["lawn-mowing"],
    serviceRadiusMiles: 25,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });
  await platform.updateProviderSettings(provider.id, {
    serviceRadiusMiles: provider.serviceRadiusMiles,
    staffingMode: "auto-accept"
  });

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-claim-select@example.com",
    password: "Password123!",
    phone: "555-3615",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638)
  });

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: undefined,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(31),
    scheduledEndIso: futureIso(32),
    notes: "Public crew claim auto accept test",
    totalCents: 6200
  });

  const crewMember = await platform.registerUser({
    fullName: "Riley Crew",
    email: "crew-claim-select@example.com",
    password: "Password123!",
    phone: "555-3715",
    role: "crew-member",
    address: createAddress("114 Garden Row", 47.6062, -122.3321),
    categories: ["lawn-mowing"],
    availableWeekdays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    willingToTravelMiles: 20,
    preferredSchedule: "flex",
    hasOwnEquipment: false,
    winterWorkEnabled: true
  });

  const match = await platform.claimPublicCrewOpportunity(crewMember.id, {
    opportunityId: booking.id
  });

  assert.equal(match.bookingId, booking.id);
  assert.equal(match.crewMemberId, crewMember.id);
  assert.equal(match.status, "accepted");
  assert.equal(match.autoAccepted, true);
  assert.ok(match.reviewedAt);

  const crewMatches = await platform.getCrewMatchesForCrew(crewMember.id);
  assert.equal(crewMatches.matches.length, 1);
  assert.equal(crewMatches.matches[0]?.providerCompanyName, "Claim Select Lawn Co.");
  assert.equal(crewMatches.matches[0]?.status, "accepted");
});

test("selecting a public crew opportunity texts review-first providers that review is needed", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-review-select@example.com",
    password: "Password123!",
    phone: "555-3520",
    role: "provider",
    companyName: "Review Select Lawn Co.",
    categories: ["lawn-mowing"],
    serviceRadiusMiles: 25,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-review-select@example.com",
    password: "Password123!",
    phone: "555-3620",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638)
  });

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: undefined,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(32),
    scheduledEndIso: futureIso(33),
    notes: "Public crew selection review first test",
    totalCents: 6200
  });

  const selection = await platform.selectPublicCrewOpportunity({ opportunityId: booking.id });
  assert.equal(selection.staffingMode, "review-first");
  assert.equal(selection.notificationTitle, "Crew opening needs review");

  const deliveries = await platform.listNotificationDeliveries({
    userId: provider.id,
    email: provider.email,
    role: "provider"
  });
  const sms = deliveries.deliveries.find(
    (delivery) => delivery.channel === "sms" && delivery.title === "Crew opening needs review"
  );
  assert.ok(sms);
  assert.match(sms.bodyPreview, /Review this match before adding them to the crew/i);
});

test("notification preferences can disable sms and review reminder delivery", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-pref@example.com",
    password: "Password123!",
    phone: "555-3700",
    role: "provider",
    companyName: "Review Lawn Co.",
    categories: ["lawn-mowing"],
    serviceRadiusMiles: 25,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-pref@example.com",
    password: "Password123!",
    phone: "555-3800",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638)
  });

  await platform.updateNotificationPreferences(
    {
      userId: customer.id,
      email: customer.email,
      role: "customer"
    },
    {
      smsEnabled: false,
      reviewRemindersEnabled: false
    }
  );

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(72),
    scheduledEndIso: futureIso(73),
    notes: "Notification preference test",
    totalCents: 6200
  });

  await platform.confirmBooking(provider.id, { bookingId: booking.id });
  await attachEvidence(
    platform,
    { userId: provider.id, email: provider.email, role: "provider" },
    booking.id,
    "after"
  );
  await platform.completeBooking(provider.id, { bookingId: booking.id });
  await platform.processReviewInvites({
    nowIso: futureIso(96)
  });

  const deliveries = await platform.listNotificationDeliveries({
    userId: customer.id,
    email: customer.email,
    role: "customer"
  });

  assert.ok(!deliveries.deliveries.some((delivery) => delivery.channel === "sms"));
  assert.ok(!deliveries.deliveries.some((delivery) => delivery.category === "review" && delivery.channel === "push"));
});

test("registered Expo push devices create retryable push deliveries", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-push@example.com",
    password: "Password123!",
    phone: "555-3810",
    role: "provider",
    companyName: "Push Lawn Co.",
    categories: ["lawn-mowing"],
    serviceRadiusMiles: 25,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-push@example.com",
    password: "Password123!",
    phone: "555-3820",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638)
  });

  await platform.registerPushDevice(
    {
      userId: provider.id,
      email: provider.email,
      role: "provider"
    },
    {
      platform: "ios",
      provider: "expo",
      token: "ExponentPushToken[providerpush123]"
    }
  );

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error("push delivery offline");
  }) as typeof globalThis.fetch;

  try {
    await platform.createBooking(customer.id, {
      providerId: provider.id,
      serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
      servicePropertyId: customer.defaultPropertyId,
      category: "lawn-mowing",
      scheduledStartIso: futureIso(24),
      scheduledEndIso: futureIso(25),
      notes: "Push delivery retry test",
      totalCents: 6200
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  const deliveries = await platform.listNotificationDeliveries({
    userId: provider.id,
    email: provider.email,
    role: "provider"
  });
  const pushDelivery = deliveries.deliveries.find((delivery) => delivery.channel === "push");

  assert.ok(pushDelivery);
  assert.equal(pushDelivery?.destination, "ExponentPushToken[providerpush123]");
  assert.equal(pushDelivery?.provider, "expo-push");
  assert.equal(pushDelivery?.status, "failed");
  assert.equal(pushDelivery?.attemptCount, 1);
  assert.ok(pushDelivery?.nextRetryAt);
});

test("configured Resend email delivery uses the real email provider path", async () => {
  const originalResendApiKey = process.env.RESEND_API_KEY;
  const originalNotificationEmailFrom = process.env.NOTIFICATION_EMAIL_FROM;
  const originalFetch = globalThis.fetch;

  process.env.RESEND_API_KEY = "re_test_123";
  process.env.NOTIFICATION_EMAIL_FROM = "YardMatch <alerts@yardmatch.example>";

  let recordedAuthorization = "";
  let recordedBody = "";

  globalThis.fetch = (async (_input, init) => {
    recordedAuthorization = String(init?.headers && "Authorization" in init.headers ? init.headers.Authorization : "");
    recordedBody = String(init?.body ?? "");
    return {
      ok: true,
      json: async () => ({
        id: "email_123"
      })
    } as Response;
  }) as typeof globalThis.fetch;

  try {
    const repository = new InMemoryMarketplaceRepository();
    const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

    const provider = await platform.registerUser({
      fullName: "Ariana Flores",
      email: "provider-email@example.com",
      password: "Password123!",
      phone: "555-3830",
      role: "provider",
      companyName: "Inbox Lawn Co.",
      categories: ["lawn-mowing"],
      serviceRadiusMiles: 25,
      address: createAddress("1400 Provider Way", 30.244, -97.764)
    });

    const customer = await platform.registerUser({
      fullName: "Jordan Rivera",
      email: "customer-email@example.com",
      password: "Password123!",
      phone: "555-3840",
      role: "customer",
      propertyLabel: "Primary home",
      address: createAddress("112 Garden Row", 30.2435, -97.7638)
    });

    await platform.updateNotificationPreferences(
      {
        userId: provider.id,
        email: provider.email,
        role: "provider"
      },
      {
        pushEnabled: false,
        smsEnabled: false,
        emailEnabled: true
      }
    );

    await platform.createBooking(customer.id, {
      providerId: provider.id,
      serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
      servicePropertyId: customer.defaultPropertyId,
      category: "lawn-mowing",
      scheduledStartIso: futureIso(24),
      scheduledEndIso: futureIso(25),
      notes: "Resend delivery test",
      totalCents: 6200
    });

    const deliveries = await platform.listNotificationDeliveries({
      userId: provider.id,
      email: provider.email,
      role: "provider"
    });
    const emailDelivery = deliveries.deliveries.find((delivery) => delivery.channel === "email");

    assert.ok(emailDelivery);
    assert.equal(emailDelivery?.provider, "resend");
    assert.equal(emailDelivery?.status, "sent");
    assert.equal(emailDelivery?.attemptCount, 1);
    assert.equal(emailDelivery?.sentAt ? typeof emailDelivery.sentAt : "undefined", "string");
    assert.match(recordedAuthorization, /^Bearer re_test_123$/);
    assert.match(recordedBody, /alerts@yardmatch\.example/);
    assert.match(recordedBody, /New booking request/);
  } finally {
    process.env.RESEND_API_KEY = originalResendApiKey;
    process.env.NOTIFICATION_EMAIL_FROM = originalNotificationEmailFrom;
    globalThis.fetch = originalFetch;
  }
});

test("configured Twilio SMS delivery failures create retryable records", async () => {
  const originalTwilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
  const originalTwilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
  const originalTwilioFromNumber = process.env.TWILIO_FROM_NUMBER;
  const originalFetch = globalThis.fetch;

  process.env.TWILIO_ACCOUNT_SID = "AC123456789";
  process.env.TWILIO_AUTH_TOKEN = "twilio-secret";
  process.env.TWILIO_FROM_NUMBER = "+15555550100";

  globalThis.fetch = (async () => {
    throw new Error("twilio unavailable");
  }) as typeof globalThis.fetch;

  try {
    const repository = new InMemoryMarketplaceRepository();
    const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

    const provider = await platform.registerUser({
      fullName: "Ariana Flores",
      email: "provider-sms@example.com",
      password: "Password123!",
      phone: "+15555550330",
      role: "provider",
      companyName: "Text Lawn Co.",
      categories: ["lawn-mowing"],
      serviceRadiusMiles: 25,
      address: createAddress("1400 Provider Way", 30.244, -97.764)
    });

    const customer = await platform.registerUser({
      fullName: "Jordan Rivera",
      email: "customer-sms@example.com",
      password: "Password123!",
      phone: "+15555550340",
      role: "customer",
      propertyLabel: "Primary home",
      address: createAddress("112 Garden Row", 30.2435, -97.7638)
    });

    await platform.updateNotificationPreferences(
      {
        userId: provider.id,
        email: provider.email,
        role: "provider"
      },
      {
        pushEnabled: false,
        emailEnabled: false,
        smsEnabled: true
      }
    );

    await platform.createBooking(customer.id, {
      providerId: provider.id,
      serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
      servicePropertyId: customer.defaultPropertyId,
      category: "lawn-mowing",
      scheduledStartIso: futureIso(24),
      scheduledEndIso: futureIso(25),
      notes: "Twilio delivery retry test",
      totalCents: 6200
    });

    const deliveries = await platform.listNotificationDeliveries({
      userId: provider.id,
      email: provider.email,
      role: "provider"
    });
    const smsDelivery = deliveries.deliveries.find((delivery) => delivery.channel === "sms");

    assert.ok(smsDelivery);
    assert.equal(smsDelivery?.provider, "twilio");
    assert.equal(smsDelivery?.status, "failed");
    assert.equal(smsDelivery?.attemptCount, 1);
    assert.ok(smsDelivery?.nextRetryAt);
    assert.match(smsDelivery?.errorMessage ?? "", /twilio unavailable/i);
  } finally {
    process.env.TWILIO_ACCOUNT_SID = originalTwilioAccountSid;
    process.env.TWILIO_AUTH_TOKEN = originalTwilioAuthToken;
    process.env.TWILIO_FROM_NUMBER = originalTwilioFromNumber;
    globalThis.fetch = originalFetch;
  }
});

test("ops notification health surfaces overdue retries and can run a retry sweep", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const now = Date.now();

  await repository.createNotificationDelivery({
    id: "delivery_sent_1",
    notificationId: "notification_sent_1",
    recipientId: "customer-1",
    recipientRole: "customer",
    category: "booking",
    channel: "email",
    destination: "customer@example.com",
    provider: "mock-email",
    status: "sent",
    title: "Your booking is confirmed",
    bodyPreview: "Your booking is confirmed.",
    errorMessage: undefined,
    attemptCount: 1,
    createdAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
    lastAttemptAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
    nextRetryAt: undefined,
    sentAt: new Date(now - 2 * 60 * 60 * 1000).toISOString()
  });

  await repository.createNotificationDelivery({
    id: "delivery_failed_retry",
    notificationId: "notification_failed_retry",
    recipientId: "provider-1",
    recipientRole: "provider",
    category: "booking",
    channel: "sms",
    destination: "+15555550123",
    provider: "twilio",
    status: "failed",
    title: "Route should start soon",
    bodyPreview: "Time to head out soon.",
    errorMessage: "twilio unavailable",
    attemptCount: 1,
    createdAt: new Date(now - 90 * 60 * 1000).toISOString(),
    lastAttemptAt: new Date(now - 30 * 60 * 1000).toISOString(),
    nextRetryAt: new Date(now - 5 * 60 * 1000).toISOString(),
    sentAt: undefined
  });

  await repository.createNotificationDelivery({
    id: "delivery_failed_exhausted",
    notificationId: "notification_failed_exhausted",
    recipientId: "crew-1",
    recipientRole: "crew-member",
    category: "staffing",
    channel: "push",
    destination: "local-device",
    provider: "mock-push",
    status: "failed",
    title: "You have a new crew match",
    bodyPreview: "Open the app to review it.",
    errorMessage: "device offline",
    attemptCount: 3,
    createdAt: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
    lastAttemptAt: new Date(now - 70 * 60 * 1000).toISOString(),
    nextRetryAt: undefined,
    sentAt: undefined
  });

  const health = await platform.getNotificationOpsHealth();
  assert.equal(health.totalDeliveries, 3);
  assert.equal(health.deliveriesLast24Hours, 3);
  assert.equal(health.overdueRetryCount, 1);
  assert.equal(health.exhaustedFailureCount, 1);
  assert.ok(health.channels.some((channel) => channel.channel === "sms" && channel.overdueRetryCount === 1));
  assert.ok(
    health.alerts.some(
      (alert) => alert.severity === "critical" && /overdue notification retries/i.test(alert.title)
    )
  );

  const retrySweep = await platform.retryDueNotificationDeliveriesForOps();
  assert.equal(retrySweep.retriedCount, 1);
  assert.equal(retrySweep.sentCount + retrySweep.failedCount, 1);
  assert.equal(retrySweep.remainingOverdueCount, 0);

  const refreshedHealth = await platform.getNotificationOpsHealth();
  assert.equal(refreshedHealth.overdueRetryCount, 0);
  const retriedSmsDelivery = (await repository.listAllNotificationDeliveries()).find(
    (delivery) => delivery.id === "delivery_failed_retry"
  );
  assert.equal(retriedSmsDelivery?.attemptCount, 2);
  assert.ok(
    !retriedSmsDelivery?.nextRetryAt || Date.parse(retriedSmsDelivery.nextRetryAt) > Date.now()
  );
});

test("ops notification health exposes production delivery policy and preserves channel counters", async () => {
  const originalResendApiKey = process.env.RESEND_API_KEY;
  const originalNotificationEmailFrom = process.env.NOTIFICATION_EMAIL_FROM;
  const originalTwilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
  const originalTwilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
  const originalTwilioFromNumber = process.env.TWILIO_FROM_NUMBER;
  const originalNotificationAlertEmails = process.env.NOTIFICATION_ALERT_EMAILS;
  const originalNotificationAlertSmsNumbers = process.env.NOTIFICATION_ALERT_SMS_NUMBERS;
  const restoreEnv = (key: string, value: string | undefined) => {
    if (value === undefined) {
      delete process.env[key];
      return;
    }

    process.env[key] = value;
  };

  try {
    delete process.env.RESEND_API_KEY;
    delete process.env.NOTIFICATION_EMAIL_FROM;
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_FROM_NUMBER;
    delete process.env.NOTIFICATION_ALERT_EMAILS;
    delete process.env.NOTIFICATION_ALERT_SMS_NUMBERS;

    const repository = new InMemoryMarketplaceRepository();
    const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());
    await repository.createNotificationDelivery({
      id: "delivery_policy_mock_email",
      notificationId: "notification_policy_mock_email",
      recipientId: "customer-1",
      recipientRole: "customer",
      category: "booking",
      channel: "email",
      destination: "customer@example.com",
      provider: "mock-email",
      status: "sent",
      title: "Your booking is confirmed",
      bodyPreview: "Your booking is confirmed.",
      errorMessage: undefined,
      attemptCount: 1,
      createdAt: new Date().toISOString(),
      lastAttemptAt: new Date().toISOString(),
      nextRetryAt: undefined,
      sentAt: new Date().toISOString()
    });

    const health = await platform.getNotificationOpsHealth();
    assert.equal(health.deliveryPolicy.productionReadinessStatus, "partially-configured");
    assert.equal(health.deliveryPolicy.pushStrategy, "expo-push");
    assert.equal(health.deliveryPolicy.opsAlertTargetsConfigured, false);
    assert.ok(
      health.channels.some((channel) => channel.channel === "email" && channel.provider === "mock-email")
    );
    const emailPolicy = health.deliveryPolicy.channelPolicies.find((policy) => policy.channel === "email");
    const smsPolicy = health.deliveryPolicy.channelPolicies.find((policy) => policy.channel === "sms");
    assert.equal(emailPolicy?.activeProvider, "mock-email");
    assert.equal(emailPolicy?.readinessStatus, "mock-fallback");
    assert.ok(emailPolicy?.missingConfiguration.includes("RESEND_API_KEY"));
    assert.equal(smsPolicy?.activeProvider, "mock-sms");
    assert.equal(smsPolicy?.readinessStatus, "mock-fallback");
    assert.ok(smsPolicy?.missingConfiguration.includes("TWILIO_ACCOUNT_SID"));
    assert.ok(
      health.alerts.some((alert) => /production notification channels/i.test(alert.title))
    );

    process.env.RESEND_API_KEY = "resend_test_key";
    process.env.NOTIFICATION_EMAIL_FROM = "YardMatch <ops@yardmatch.test>";
    process.env.TWILIO_ACCOUNT_SID = "AC123";
    process.env.TWILIO_AUTH_TOKEN = "twilio_secret";
    process.env.TWILIO_FROM_NUMBER = "+15555550123";
    process.env.NOTIFICATION_ALERT_EMAILS = "alerts@yardmatch.test";

    const configuredPlatform = new MarketplacePlatformService(
      new InMemoryMarketplaceRepository(),
      new DataEngineeringLogger()
    );
    const configuredHealth = await configuredPlatform.getNotificationOpsHealth();
    assert.equal(configuredHealth.deliveryPolicy.productionReadinessStatus, "production-ready");
    assert.equal(configuredHealth.deliveryPolicy.opsAlertTargetsConfigured, true);
    assert.equal(
      configuredHealth.deliveryPolicy.channelPolicies.find((policy) => policy.channel === "email")?.activeProvider,
      "resend"
    );
    assert.equal(
      configuredHealth.deliveryPolicy.channelPolicies.find((policy) => policy.channel === "sms")?.activeProvider,
      "twilio"
    );
  } finally {
    restoreEnv("RESEND_API_KEY", originalResendApiKey);
    restoreEnv("NOTIFICATION_EMAIL_FROM", originalNotificationEmailFrom);
    restoreEnv("TWILIO_ACCOUNT_SID", originalTwilioAccountSid);
    restoreEnv("TWILIO_AUTH_TOKEN", originalTwilioAuthToken);
    restoreEnv("TWILIO_FROM_NUMBER", originalTwilioFromNumber);
    restoreEnv("NOTIFICATION_ALERT_EMAILS", originalNotificationAlertEmails);
    restoreEnv("NOTIFICATION_ALERT_SMS_NUMBERS", originalNotificationAlertSmsNumbers);
  }
});

test("ops notification health can escalate external alerts to configured contacts", async () => {
  const originalFetch = globalThis.fetch;
  const originalResendApiKey = process.env.RESEND_API_KEY;
  const originalNotificationEmailFrom = process.env.NOTIFICATION_EMAIL_FROM;
  const originalNotificationAlertEmails = process.env.NOTIFICATION_ALERT_EMAILS;

  process.env.RESEND_API_KEY = "resend_test_key";
  process.env.NOTIFICATION_EMAIL_FROM = "ops@yardmatch.test";
  process.env.NOTIFICATION_ALERT_EMAILS = "alerts@yardmatch.test";

  try {
    globalThis.fetch = (async () =>
      ({
        ok: true,
        json: async () => ({ id: "email_alert_123" })
      }) as Response) as typeof fetch;

    const repository = new InMemoryMarketplaceRepository();
    const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());
    const now = Date.now();

    await repository.createNotificationDelivery({
      id: "delivery_failed_retry_ops",
      notificationId: "notification_failed_retry_ops",
      recipientId: "provider-1",
      recipientRole: "provider",
      category: "booking",
      channel: "sms",
      destination: "+15555550123",
      provider: "twilio",
      status: "failed",
      title: "Route should start soon",
      bodyPreview: "Time to head out soon.",
      errorMessage: "twilio unavailable",
      attemptCount: 1,
      createdAt: new Date(now - 90 * 60 * 1000).toISOString(),
      lastAttemptAt: new Date(now - 30 * 60 * 1000).toISOString(),
      nextRetryAt: new Date(now - 5 * 60 * 1000).toISOString(),
      sentAt: undefined
    });

    const escalation = await platform.escalateNotificationOpsAlerts();
    assert.equal(escalation.escalated, true);
    assert.equal(escalation.targetCount, 1);
    assert.equal(escalation.sentCount, 1);
    assert.equal(escalation.failedCount, 0);

    const deliveries = await repository.listAllNotificationDeliveries();
    assert.ok(
      deliveries.some(
        (delivery) =>
          delivery.destination === "alerts@yardmatch.test" &&
          delivery.provider === "resend" &&
          delivery.status === "sent"
      )
    );
  } finally {
    process.env.RESEND_API_KEY = originalResendApiKey;
    process.env.NOTIFICATION_EMAIL_FROM = originalNotificationEmailFrom;
    process.env.NOTIFICATION_ALERT_EMAILS = originalNotificationAlertEmails;
    globalThis.fetch = originalFetch;
  }
});

test("inbound automation health can escalate external alerts to configured contacts", async () => {
  const originalFetch = globalThis.fetch;
  const originalResendApiKey = process.env.RESEND_API_KEY;
  const originalNotificationEmailFrom = process.env.NOTIFICATION_EMAIL_FROM;
  const originalNotificationAlertEmails = process.env.NOTIFICATION_ALERT_EMAILS;
  const originalExpectedSources = process.env.OPS_EXPECTED_INBOUND_AUTOMATION_SOURCES;

  process.env.RESEND_API_KEY = "resend_test_key";
  process.env.NOTIFICATION_EMAIL_FROM = "ops@yardmatch.test";
  process.env.NOTIFICATION_ALERT_EMAILS = "alerts@yardmatch.test";
  process.env.OPS_EXPECTED_INBOUND_AUTOMATION_SOURCES = "direct-email-lead";

  try {
    globalThis.fetch = (async () =>
      ({
        ok: true,
        json: async () => ({ id: "email_alert_456" })
      }) as Response) as typeof fetch;

    const repository = new InMemoryMarketplaceRepository();
    const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

    const escalation = await platform.escalateInboundAutomationAlerts();
    assert.equal(escalation.escalated, true);
    assert.equal(escalation.targetCount, 1);
    assert.equal(escalation.sentCount, 1);
    assert.equal(escalation.failedCount, 0);

    const deliveries = await repository.listAllNotificationDeliveries();
    assert.ok(
      deliveries.some(
        (delivery) =>
          delivery.destination === "alerts@yardmatch.test" &&
          delivery.provider === "resend" &&
          delivery.status === "sent" &&
          /inbound automation/i.test(delivery.title)
      )
    );
  } finally {
    process.env.RESEND_API_KEY = originalResendApiKey;
    process.env.NOTIFICATION_EMAIL_FROM = originalNotificationEmailFrom;
    process.env.NOTIFICATION_ALERT_EMAILS = originalNotificationAlertEmails;
    process.env.OPS_EXPECTED_INBOUND_AUTOMATION_SOURCES = originalExpectedSources;
    globalThis.fetch = originalFetch;
  }
});

test("providers can get a subscribable calendar feed and merged overview for mixed schedule management", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-calendar@example.com",
    password: "Password123!",
    phone: "555-3900",
    role: "provider",
    companyName: "Calendar Lawn Co.",
    categories: ["lawn-mowing"],
    serviceRadiusMiles: 25,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-calendar@example.com",
    password: "Password123!",
    phone: "555-3910",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638)
  });

  await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(24),
    scheduledEndIso: futureIso(25),
    notes: "Calendar export test",
    totalCents: 6200
  });

  await platform.updateProviderSettings(provider.id, {
    serviceRadiusMiles: provider.serviceRadiusMiles,
    staffingMode: provider.staffingMode,
    sponsoredListingEnabled: provider.sponsoredListingEnabled,
    externalEventsBlockingEnabled: true,
    externalCalendarBlocks: [
      {
        title: "Direct client cleanup",
        blockType: "off-platform-client",
        startIso: futureIso(28),
        endIso: futureIso(29),
        notes: "Neighbor referral cleanup",
        source: "manual"
      }
    ]
  });

  const subscription = await platform.getProviderCalendarSubscription(provider.id);
  assert.ok(subscription.feedUrl.includes("/api/calendar/feed?token="));
  assert.ok(subscription.webcalUrl.startsWith("webcal://"));
  assert.equal(subscription.actions.length, 3);
  assert.equal(subscription.actions[0]?.platform, "apple-calendar");
  assert.equal(subscription.actions[0]?.href, subscription.webcalUrl);
  assert.equal(subscription.actions[1]?.platform, "google-calendar");
  assert.ok(subscription.actions[1]?.href.includes(encodeURIComponent(subscription.feedUrl)));
  assert.equal(subscription.actions[2]?.platform, "ical");
  assert.equal(subscription.actions[2]?.href, subscription.feedUrl);

  const overview = await platform.getProviderCalendarOverview(provider.id);
  assert.equal(overview.yardmatchJobCount, 1);
  assert.equal(overview.externalBlockCount, 1);
  assert.equal(overview.syncHealth.externalBlockingEnabled, true);
  assert.equal(overview.syncHealth.manualBlockCount, 1);
  assert.equal(overview.events.length, 2);
  assert.equal(overview.events[0].source, "yardmatch-booking");
  assert.equal(overview.events[1].source, "external-block");

  const token = new URL(subscription.feedUrl).searchParams.get("token");
  assert.ok(token);

  const feed = await platform.buildCalendarFeedByToken(token as string);
  assert.match(feed, /BEGIN:VCALENDAR/);
  assert.match(feed, /Calendar Lawn Co.: Lawn Mowing for Jordan Rivera/);
  assert.match(feed, /Calendar export test/);
  assert.match(feed, /Calendar Lawn Co.: Direct client cleanup/);
  assert.match(feed, /Neighbor referral cleanup/);
});

test("providers can import an external iCal feed and use it to block YardMatch availability", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-calendar-import@example.com",
    password: "Password123!",
    phone: "555-3920",
    role: "provider",
    companyName: "Import Lawn Co.",
    categories: ["lawn-mowing"],
    serviceRadiusMiles: 25,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });
  await verifyProviderCredentials(platform, provider.id);

  await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-calendar-import@example.com",
    password: "Password123!",
    phone: "555-3930",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638)
  });

  const importStart = futureIso(48);
  const importEnd = futureIso(49);
  const rawFeed = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "BEGIN:VEVENT",
    "UID:outside-client-1@example.com",
    `DTSTART:${importStart.replaceAll(/[-:]/g, "").replace(".000Z", "Z")}`,
    `DTEND:${importEnd.replaceAll(/[-:]/g, "").replace(".000Z", "Z")}`,
    "SUMMARY:Outside cleanup route",
    "DESCRIPTION:Imported from Google Calendar",
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\n");
  const feedUrl = `data:text/calendar;charset=utf-8,${encodeURIComponent(rawFeed)}`;

  await platform.updateProviderSettings(provider.id, {
    serviceRadiusMiles: provider.serviceRadiusMiles,
    staffingMode: provider.staffingMode,
    sponsoredListingEnabled: provider.sponsoredListingEnabled,
    externalEventsBlockingEnabled: true,
    externalCalendarBlocks: []
  });

  const imports = await platform.createProviderCalendarImport(provider.id, {
    title: "Google Calendar - Outside work",
    provider: "google",
    feedUrl
  });
  assert.equal(imports.subscriptions.length, 1);
  assert.equal(imports.importedBlockCount, 1);
  assert.equal(imports.syncHealth.status, "healthy");
  assert.equal(imports.syncHealth.subscriptionCount, 1);
  assert.equal(imports.subscriptions[0]?.importedEventCount, 1);

  const providerAfterImport = await platform.getProviderProfile(provider.id);
  const importedBlock = providerAfterImport.calendarConnection.externalBlocks?.find(
    (block) => block.source === "calendar-import"
  );
  assert.ok(importedBlock);
  assert.equal(importedBlock?.title, "Outside cleanup route");

  await platform.reviewProviderVerification({
    providerId: provider.id,
    action: "approve",
    notes:
      "Ops confirmed this calendar-import test provider still has a tight launch radius, current category coverage, and reliable exception handling for live search visibility."
  });

  const matchingSlots = await platform.searchProviders({
    address: createAddress("112 Garden Row", 30.2435, -97.7638),
    categories: ["lawn-mowing"],
    dateIso: importStart,
    estimatedDurationMinutes: 45
  });

  assert.ok(matchingSlots.providers.some((item) => item.id === provider.id));
  assert.ok(
    !matchingSlots.suggestedSlots.some(
      (slot) =>
        slot.providerId === provider.id &&
        slot.startIso === importStart &&
        slot.endIso === importEnd
    )
  );

  const overview = await platform.getProviderCalendarOverview(provider.id);
  assert.ok(
    overview.events.some((event) => event.source === "external-block" && event.title === "Outside cleanup route")
  );

  const synced = await platform.syncProviderCalendarImport(provider.id, {
    subscriptionId: imports.subscriptions[0].id
  });
  assert.equal(synced.subscriptions[0]?.importedEventCount, 1);
  assert.equal(synced.syncHealth.status, "healthy");

  const removed = await platform.removeProviderCalendarImport(provider.id, {
    subscriptionId: imports.subscriptions[0].id
  });
  assert.equal(removed.subscriptions.length, 0);

  const matchingSlotsAfterRemoval = await platform.searchProviders({
    address: createAddress("112 Garden Row", 30.2435, -97.7638),
    categories: ["lawn-mowing"],
    dateIso: importStart,
    estimatedDurationMinutes: 45
  });

  assert.ok(matchingSlotsAfterRemoval.providers.some((item) => item.id === provider.id));
});

test("calendar import sync failures persist provider-facing health state", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-calendar-import-error@example.com",
    password: "Password123!",
    phone: "555-3940",
    role: "provider",
    companyName: "Error Lawn Co.",
    categories: ["lawn-mowing"],
    serviceRadiusMiles: 25,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });

  await platform.updateProviderSettings(provider.id, {
    serviceRadiusMiles: provider.serviceRadiusMiles,
    staffingMode: provider.staffingMode,
    sponsoredListingEnabled: provider.sponsoredListingEnabled,
    externalEventsBlockingEnabled: true,
    externalCalendarBlocks: []
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response("calendar unavailable", {
      status: 503
    })) as typeof fetch;

  try {
    const imports = await platform.createProviderCalendarImport(provider.id, {
      title: "Google Calendar - Broken feed",
      provider: "google",
      feedUrl: "https://calendar.example.com/broken.ics"
    });

    assert.equal(imports.subscriptions.length, 1);
    assert.equal(imports.subscriptions[0]?.syncStatus, "error");
    assert.match(imports.subscriptions[0]?.lastError ?? "", /503/);
    assert.equal(imports.syncHealth.status, "at-risk");
    assert.equal(imports.syncHealth.erroredSubscriptionCount, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("providers can bulk-refresh stale or errored calendar feeds", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-calendar-sync-stale@example.com",
    password: "Password123!",
    phone: "555-3945",
    role: "provider",
    companyName: "Recover Lawn Co.",
    categories: ["lawn-mowing"],
    serviceRadiusMiles: 25,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });

  await platform.updateProviderSettings(provider.id, {
    serviceRadiusMiles: provider.serviceRadiusMiles,
    staffingMode: provider.staffingMode,
    sponsoredListingEnabled: provider.sponsoredListingEnabled,
    externalEventsBlockingEnabled: true,
    externalCalendarBlocks: []
  });

  const brokenFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response("calendar unavailable", {
      status: 503
    })) as typeof fetch;

  let imports;
  try {
    imports = await platform.createProviderCalendarImport(provider.id, {
      title: "Google Calendar - Recoverable feed",
      provider: "google",
      feedUrl: "https://calendar.example.com/recoverable.ics"
    });
  } finally {
    globalThis.fetch = brokenFetch;
  }

  assert.equal(imports.subscriptions[0]?.syncStatus, "error");

  const importStart = futureIso(96);
  const importEnd = futureIso(97);
  const rawFeed = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "BEGIN:VEVENT",
    "UID:outside-client-recovered@example.com",
    `DTSTART:${importStart.replaceAll(/[-:]/g, "").replace(".000Z", "Z")}`,
    `DTEND:${importEnd.replaceAll(/[-:]/g, "").replace(".000Z", "Z")}`,
    "SUMMARY:Recovered outside route",
    "DESCRIPTION:Recovered from stale feed sync",
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\n");

  globalThis.fetch = (async () =>
    new Response(rawFeed, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar"
      }
    })) as typeof fetch;

  try {
    const refreshed = await platform.syncStaleProviderCalendarImports(provider.id);
    assert.equal(refreshed.attemptedSubscriptionCount, 1);
    assert.equal(refreshed.syncedSubscriptionCount, 1);
    assert.equal(refreshed.failedSubscriptionCount, 0);
    assert.equal(refreshed.subscriptions[0]?.syncStatus, "active");
    assert.equal(refreshed.syncHealth.status, "healthy");
    assert.ok(refreshed.subscriptions[0]?.lastSyncedAt);
  } finally {
    globalThis.fetch = brokenFetch;
  }
});

test("calendar health warns when outside blocks are saved but not reducing availability", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-calendar-risk@example.com",
    password: "Password123!",
    phone: "555-3950",
    role: "provider",
    companyName: "Risk Lawn Co.",
    categories: ["lawn-mowing"],
    serviceRadiusMiles: 25,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });

  await platform.updateProviderSettings(provider.id, {
    serviceRadiusMiles: provider.serviceRadiusMiles,
    staffingMode: provider.staffingMode,
    sponsoredListingEnabled: provider.sponsoredListingEnabled,
    externalEventsBlockingEnabled: false,
    externalCalendarBlocks: [
      {
        title: "Direct client visit",
        blockType: "off-platform-client",
        startIso: futureIso(12),
        endIso: futureIso(13),
        source: "manual"
      }
    ]
  });

  const overview = await platform.getProviderCalendarOverview(provider.id);
  assert.equal(overview.syncHealth.status, "at-risk");
  assert.equal(overview.syncHealth.externalBlockingEnabled, false);
  assert.equal(overview.syncHealth.upcomingExternalBlockCount, 1);
  assert.ok(overview.syncHealth.notes.some((note) => /not reducing YardMatch availability/i.test(note)));
});

test("calendar health flags outside blocks that overlap real YardMatch jobs", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-calendar-conflict@example.com",
    password: "Password123!",
    phone: "555-3960",
    role: "provider",
    companyName: "Conflict Lawn Co.",
    categories: ["lawn-mowing"],
    serviceRadiusMiles: 25,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-calendar-conflict@example.com",
    password: "Password123!",
    phone: "555-3961",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638)
  });

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(18),
    scheduledEndIso: futureIso(19),
    notes: "Calendar conflict visibility test",
    totalCents: 6200
  });
  assert.ok(booking.id);

  await platform.updateProviderSettings(provider.id, {
    serviceRadiusMiles: provider.serviceRadiusMiles,
    staffingMode: provider.staffingMode,
    sponsoredListingEnabled: provider.sponsoredListingEnabled,
    externalEventsBlockingEnabled: false,
    externalCalendarBlocks: [
      {
        title: "Direct client overlap",
        blockType: "off-platform-client",
        startIso: futureIso(18.25),
        endIso: futureIso(19.25),
        source: "manual"
      }
    ]
  });

  const overview = await platform.getProviderCalendarOverview(provider.id);
  assert.equal(overview.syncHealth.status, "at-risk");
  assert.equal(overview.syncHealth.conflictingYardmatchJobCount, 1);
  assert.ok(overview.syncHealth.notes.some((note) => /overlaps an outside calendar block/i.test(note)));
});

test("provider calendar overview includes dispatch load summaries for route planning", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Casey Green",
    email: "provider-dispatch@example.com",
    password: "Password123!",
    phone: "555-4400",
    role: "provider",
    companyName: "Dispatch Lawn Co.",
    categories: ["lawn-mowing", "mulch-installation", "leaf-blowing"],
    serviceRadiusMiles: 25,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-dispatch@example.com",
    password: "Password123!",
    phone: "555-4410",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638)
  });

  const serviceDay = new Date();
  serviceDay.setDate(serviceDay.getDate() + 3);

  const atHour = (hour: number, durationHours: number) => {
    const start = new Date(serviceDay);
    start.setHours(hour, 0, 0, 0);
    const end = new Date(start.getTime() + durationHours * 60 * 60 * 1000);
    return {
      startIso: start.toISOString(),
      endIso: end.toISOString()
    };
  };

  const morning = atHour(8, 1);
  const afternoon = atHour(13, 2);

  await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: morning.startIso,
    scheduledEndIso: morning.endIso,
    notes: "Morning stop",
    totalCents: 6200
  });

  await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("980 Ridge View", 30.3442, -97.6641),
    servicePropertyId: undefined,
    category: "mulch-installation",
    scheduledStartIso: afternoon.startIso,
    scheduledEndIso: afternoon.endIso,
    notes: "Afternoon stop",
    totalCents: 9800
  });

  await platform.updateProviderSettings(provider.id, {
    serviceRadiusMiles: provider.serviceRadiusMiles,
    staffingMode: provider.staffingMode,
    sponsoredListingEnabled: provider.sponsoredListingEnabled,
    externalEventsBlockingEnabled: true,
    externalCalendarBlocks: [
      {
        title: "Outside estimate visit",
        blockType: "off-platform-client",
        startIso: atHour(16, 2).startIso,
        endIso: atHour(16, 2).endIso
      }
    ]
  });

  const overview = await platform.getProviderCalendarOverview(provider.id, {
    fromIso: atHour(6, 1).startIso,
    toIso: atHour(20, 1).startIso
  });

  assert.ok(overview.dispatchDays.length >= 1);
  const day = overview.dispatchDays[0];
  assert.ok(day);
  assert.equal(day.yardmatchJobCount, 2);
  assert.equal(day.externalBlockCount, 1);
  assert.equal(day.totalCrewRequired, 3);
  assert.equal(day.totalCrewAssigned, 0);
  assert.equal(day.crewGap, 3);
  assert.equal(day.routeStatus, "overloaded");
  assert.ok(day.estimatedDriveMiles > 0);
  assert.ok(day.recommendations.some((item) => /crew/i.test(item)));
  assert.equal(day.windowSummaries.find((window) => window.windowKey === "morning")?.yardmatchJobCount, 1);
  assert.equal(day.windowSummaries.find((window) => window.windowKey === "afternoon")?.yardmatchJobCount, 1);
  assert.ok(
    (day.windowSummaries.find((window) => window.windowKey === "late-afternoon-night")?.blockedMinutes ?? 0) > 0
  );
  assert.ok(day.longestDriveLegMiles >= 8);
  assert.ok(day.largestIdleGapMinutes >= 180);
  assert.ok(day.outlierStopCount >= 1);
  assert.ok(day.recommendations.some((item) => /idle gap/i.test(item) || /off route/i.test(item)));
});

test("providers receive one timed departure reminder for confirmed upcoming jobs", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-reminder@example.com",
    password: "Password123!",
    phone: "555-4300",
    role: "provider",
    companyName: "Prompt Lawn Co.",
    categories: ["lawn-mowing"],
    serviceRadiusMiles: 25,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });
  assert.equal(provider.role, "provider");

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-reminder@example.com",
    password: "Password123!",
    phone: "555-4200",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638)
  });
  assert.equal(customer.role, "customer");

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(0.5),
    scheduledEndIso: futureIso(1.5),
    notes: "Departure reminder test",
    totalCents: 6400
  });

  await platform.confirmBooking(provider.id, { bookingId: booking.id });

  const firstList = await platform.listNotifications({
    userId: provider.id,
    email: provider.email,
    role: "provider"
  });
  const departureReminders = firstList.notifications.filter(
    (notification) => notification.title === "Time to head out soon"
  );
  assert.equal(departureReminders.length, 1);

  const secondList = await platform.listNotifications({
    userId: provider.id,
    email: provider.email,
    role: "provider"
  });
  const secondDepartureReminders = secondList.notifications.filter(
    (notification) => notification.title === "Time to head out soon"
  );
  assert.equal(secondDepartureReminders.length, 1);
});

test("provider dispatch controls tune reminder timing and route-leader permissions", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-dispatch-controls@example.com",
    password: "Password123!",
    phone: "555-4350",
    role: "provider",
    companyName: "Prompt Lawn Co.",
    categories: ["lawn-mowing"],
    serviceRadiusMiles: 25,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });
  assert.equal(provider.role, "provider");

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-dispatch-controls@example.com",
    password: "Password123!",
    phone: "555-4360",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638)
  });
  assert.equal(customer.role, "customer");

  const crewMember = await platform.registerUser({
    fullName: "Taylor Crew",
    email: "crew-dispatch-controls@example.com",
    password: "Password123!",
    phone: "555-4370",
    role: "crew-member",
    address: createAddress("113 Garden Row", 30.24355, -97.76385),
    categories: ["lawn-mowing"],
    availableWeekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    willingToTravelMiles: 20,
    preferredSchedule: "full-time",
    hasOwnEquipment: true
  });

  const updatedProvider = await platform.updateProviderSettings(provider.id, {
    serviceRadiusMiles: 20,
    staffingMode: "review-first",
    crewReviewLeadHours: 6,
    departureReminderLeadMinutes: 30,
    routeLeaderMode: "accepted-crew-fallback",
    sponsoredListingEnabled: provider.sponsoredListingEnabled
  });
  assert.equal(updatedProvider.crewReviewLeadHours, 6);
  assert.equal(updatedProvider.departureReminderLeadMinutes, 30);
  assert.equal(updatedProvider.routeLeaderMode, "accepted-crew-fallback");

  const upcomingBooking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(0.4),
    scheduledEndIso: futureIso(1.4),
    notes: "Dispatch controls departure reminder",
    totalCents: 6400
  });

  const staffingOverview = await platform.getProviderStaffingOverview(provider.id);
  const pendingMatch = staffingOverview.jobs
    .find((job) => job.bookingId === upcomingBooking.id)
    ?.matches.find((match) => match.crewMemberId === crewMember.id);
  assert.ok(pendingMatch);

  await platform.confirmBooking(provider.id, { bookingId: upcomingBooking.id });

  const notificationList = await platform.listNotifications({
    userId: provider.id,
    email: provider.email,
    role: "provider"
  });
  assert.ok(
    notificationList.notifications.some((notification) => notification.title === "Time to head out soon")
  );
  assert.ok(
    notificationList.notifications.some((notification) => notification.title === "Review crew staffing soon")
  );

  await reviewCrewMatchForEligibleProvider(platform, provider.id, {
    crewMatchId: pendingMatch!.id,
    action: "accept"
  });

  const crewStartedRoute = await platform.markBookingOnRoute(
    { userId: crewMember.id, email: crewMember.email, role: "crew-member" },
    { bookingId: upcomingBooking.id }
  );
  assert.ok(crewStartedRoute.onRouteConfirmedAt);
  assert.equal(crewStartedRoute.onRouteConfirmedByCrewMemberId, crewMember.id);
  const crewTracking = await platform.updateBookingRouteLocation(
    { userId: crewMember.id, email: crewMember.email, role: "crew-member" },
    {
      bookingId: upcomingBooking.id,
      point: {
        latitude: 30.2437,
        longitude: -97.76395
      },
      speedMph: 18
    }
  );
  assert.equal(crewTracking.source, "crew-device");

  await platform.updateProviderSettings(provider.id, {
    serviceRadiusMiles: 20,
    staffingMode: "review-first",
    crewReviewLeadHours: 6,
    departureReminderLeadMinutes: 30,
    routeLeaderMode: "provider-only",
    sponsoredListingEnabled: provider.sponsoredListingEnabled
  });

  const secondBooking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("118 Garden Row", 30.2437, -97.76395),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(24),
    scheduledEndIso: futureIso(25),
    notes: "Dispatch controls route leader",
    totalCents: 6400
  });
  const secondOverview = await platform.getProviderStaffingOverview(provider.id);
  const secondPendingMatch = secondOverview.jobs
    .find((job) => job.bookingId === secondBooking.id)
    ?.matches.find((match) => match.crewMemberId === crewMember.id);
  assert.ok(secondPendingMatch);
  await reviewCrewMatchForEligibleProvider(platform, provider.id, {
    crewMatchId: secondPendingMatch!.id,
    action: "accept"
  });
  await platform.confirmBooking(provider.id, { bookingId: secondBooking.id });

  await assert.rejects(
    platform.markBookingOnRoute(
      { userId: crewMember.id, email: crewMember.email, role: "crew-member" },
      { bookingId: secondBooking.id }
    ),
    /handles route start personally/
  );
  await assert.rejects(
    platform.updateBookingRouteLocation(
      { userId: crewMember.id, email: crewMember.email, role: "crew-member" },
      {
        bookingId: secondBooking.id,
        point: {
          latitude: 30.24375,
          longitude: -97.76398
        },
        speedMph: 12
      }
    ),
    /handles route tracking personally/
  );
});

test("providers can assign a specific route leader when multiple accepted crew members share a job", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-route-assignment@example.com",
    password: "Password123!",
    phone: "555-4375",
    role: "provider",
    companyName: "Route Captain Lawn",
    categories: ["lawn-mowing"],
    serviceRadiusMiles: 20,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });
  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-route-assignment@example.com",
    password: "Password123!",
    phone: "555-4376",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638)
  });
  const firstCrew = await platform.registerUser({
    fullName: "Taylor Crew",
    email: "crew-route-assignment-1@example.com",
    password: "Password123!",
    phone: "555-4377",
    role: "crew-member",
    address: createAddress("113 Garden Row", 30.24355, -97.76385),
    categories: ["lawn-mowing"],
    availableWeekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    willingToTravelMiles: 20
  });
  const secondCrew = await platform.registerUser({
    fullName: "Morgan Crew",
    email: "crew-route-assignment-2@example.com",
    password: "Password123!",
    phone: "555-4378",
    role: "crew-member",
    address: createAddress("114 Garden Row", 30.24358, -97.76382),
    categories: ["lawn-mowing"],
    availableWeekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    willingToTravelMiles: 20
  });

  await platform.updateProviderSettings(provider.id, {
    serviceRadiusMiles: 20,
    staffingMode: "review-first",
    crewReviewLeadHours: 6,
    departureReminderLeadMinutes: 30,
    routeLeaderMode: "accepted-crew-fallback",
    sponsoredListingEnabled: provider.sponsoredListingEnabled
  });

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(48),
    scheduledEndIso: futureIso(49),
    notes: "Delegated route leader test",
    totalCents: 6400
  });

  const overview = await platform.getProviderStaffingOverview(provider.id);
  const job = overview.jobs.find((item) => item.bookingId === booking.id);
  assert.ok(job);
  const firstMatch = job?.matches.find((match) => match.crewMemberId === firstCrew.id);
  const secondMatch = job?.matches.find((match) => match.crewMemberId === secondCrew.id);
  assert.ok(firstMatch);
  assert.ok(secondMatch);

  await reviewCrewMatchForEligibleProvider(platform, provider.id, { crewMatchId: firstMatch!.id, action: "accept" });
  await reviewCrewMatchForEligibleProvider(platform, provider.id, { crewMatchId: secondMatch!.id, action: "accept" });
  await platform.confirmBooking(provider.id, { bookingId: booking.id });

  const multiCrewOverview = await platform.getProviderStaffingOverview(provider.id);
  const multiCrewJob = multiCrewOverview.jobs.find((item) => item.bookingId === booking.id);
  assert.equal(multiCrewJob?.requiresRouteLeaderAssignment, true);

  await assert.rejects(
    platform.markBookingOnRoute(
      { userId: firstCrew.id, email: firstCrew.email, role: "crew-member" },
      { bookingId: booking.id }
    ),
    /specific crew route leader must be assigned/
  );

  const assignedBooking = await platform.assignBookingRouteLeader(provider.id, {
    bookingId: booking.id,
    crewMemberId: secondCrew.id
  });
  assert.equal(assignedBooking.assignedRouteLeaderCrewMemberId, secondCrew.id);

  const assignedOverview = await platform.getProviderStaffingOverview(provider.id);
  const assignedJob = assignedOverview.jobs.find((item) => item.bookingId === booking.id);
  assert.equal(assignedJob?.assignedRouteLeaderCrewMemberId, secondCrew.id);
  assert.equal(assignedJob?.assignedRouteLeaderCrewMemberName, secondCrew.fullName);
  assert.equal(assignedJob?.requiresRouteLeaderAssignment, false);

  await assert.rejects(
    platform.markBookingOnRoute(
      { userId: firstCrew.id, email: firstCrew.email, role: "crew-member" },
      { bookingId: booking.id }
    ),
    /assigned route leader/
  );

  const onRoute = await platform.markBookingOnRoute(
    { userId: secondCrew.id, email: secondCrew.email, role: "crew-member" },
    { bookingId: booking.id }
  );
  assert.equal(onRoute.onRouteConfirmedByCrewMemberId, secondCrew.id);

  const tracking = await platform.updateBookingRouteLocation(
    { userId: secondCrew.id, email: secondCrew.email, role: "crew-member" },
    {
      bookingId: booking.id,
      point: {
        latitude: 30.2437,
        longitude: -97.76395
      },
      speedMph: 18
    }
  );
  assert.equal(tracking.source, "crew-device");

  const crewMatches = await platform.getCrewMatchesForCrew(secondCrew.id);
  assert.equal(crewMatches.matches[0]?.isAssignedRouteLeader, true);
});

test("provider assistant can assign and clear a crew route leader from plain language", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-assistant-route-leader@example.com",
    password: "Password123!",
    phone: "555-4379",
    role: "provider",
    companyName: "Route Captain Lawn",
    categories: ["lawn-mowing"],
    serviceRadiusMiles: 20,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });
  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-assistant-route-leader@example.com",
    password: "Password123!",
    phone: "555-4380",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638)
  });
  const firstCrew = await platform.registerUser({
    fullName: "Taylor Crew",
    email: "crew-assistant-route-leader-1@example.com",
    password: "Password123!",
    phone: "555-4381",
    role: "crew-member",
    address: createAddress("113 Garden Row", 30.24355, -97.76385),
    categories: ["lawn-mowing"],
    availableWeekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    willingToTravelMiles: 20
  });
  const secondCrew = await platform.registerUser({
    fullName: "Morgan Crew",
    email: "crew-assistant-route-leader-2@example.com",
    password: "Password123!",
    phone: "555-4382",
    role: "crew-member",
    address: createAddress("114 Garden Row", 30.24358, -97.76382),
    categories: ["lawn-mowing"],
    availableWeekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    willingToTravelMiles: 20
  });

  await platform.updateProviderSettings(provider.id, {
    serviceRadiusMiles: 20,
    staffingMode: "review-first",
    crewReviewLeadHours: 6,
    departureReminderLeadMinutes: 30,
    routeLeaderMode: "accepted-crew-fallback",
    sponsoredListingEnabled: provider.sponsoredListingEnabled
  });

  const serviceDay = new Date();
  serviceDay.setDate(serviceDay.getDate() + 3);
  serviceDay.setHours(13, 0, 0, 0);
  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: serviceDay.toISOString(),
    scheduledEndIso: new Date(serviceDay.getTime() + 2 * 60 * 60 * 1000).toISOString(),
    notes: "Assistant route leader test",
    totalCents: 6200
  });

  const overview = await platform.getProviderStaffingOverview(provider.id);
  const job = overview.jobs.find((item) => item.bookingId === booking.id);
  const firstMatch = job?.matches.find((match) => match.crewMemberId === firstCrew.id);
  const secondMatch = job?.matches.find((match) => match.crewMemberId === secondCrew.id);
  assert.ok(firstMatch);
  assert.ok(secondMatch);
  await reviewCrewMatchForEligibleProvider(platform, provider.id, { crewMatchId: firstMatch!.id, action: "accept" });
  await reviewCrewMatchForEligibleProvider(platform, provider.id, { crewMatchId: secondMatch!.id, action: "accept" });

  const preview = await platform.runProviderAssistantCommand(provider.id, {
    command: "Make Morgan Crew the route leader for my afternoon appointment",
    bookingId: booking.id,
    execute: false
  });

  assert.equal(preview.understood, true);
  assert.equal(preview.actionType, "assign-route-leader");
  assert.equal(preview.requiresConfirmation, true);
  assert.match(preview.previewMessage, /Assign Morgan Crew as the route leader/i);

  const executed = await platform.runProviderAssistantCommand(provider.id, {
    command: "Make Morgan Crew the route leader for my afternoon appointment",
    bookingId: booking.id,
    execute: true
  });

  assert.equal(executed.executed, true);
  assert.equal(executed.actionType, "assign-route-leader");
  assert.equal(executed.updatedBooking?.assignedRouteLeaderCrewMemberId, secondCrew.id);
  assert.equal(executed.updatedBooking?.interventions.at(-1)?.action, "provider-assistant-assign-route-leader");

  const clearPreview = await platform.runProviderAssistantCommand(provider.id, {
    command: "Clear the route leader for my afternoon appointment",
    bookingId: booking.id,
    execute: false
  });
  assert.equal(clearPreview.understood, true);
  assert.equal(clearPreview.actionType, "clear-route-leader");
  assert.equal(clearPreview.requiresConfirmation, true);

  const cleared = await platform.runProviderAssistantCommand(provider.id, {
    command: "Clear the route leader for my afternoon appointment",
    bookingId: booking.id,
    execute: true
  });
  assert.equal(cleared.executed, true);
  assert.equal(cleared.actionType, "clear-route-leader");
  assert.equal(cleared.updatedBooking?.assignedRouteLeaderCrewMemberId, undefined);
  assert.equal(cleared.updatedBooking?.interventions.at(-1)?.action, "provider-assistant-clear-route-leader");
});

test("provider assistant can preview and send a provider-crew coordination message", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-assistant-crew-message@example.com",
    password: "Password123!",
    phone: "555-4383",
    role: "provider",
    companyName: "Route Captain Lawn",
    categories: ["lawn-mowing"],
    serviceRadiusMiles: 20,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });
  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-assistant-crew-message@example.com",
    password: "Password123!",
    phone: "555-4384",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638)
  });
  const crew = await platform.registerUser({
    fullName: "Morgan Crew",
    email: "crew-assistant-message@example.com",
    password: "Password123!",
    phone: "555-4385",
    role: "crew-member",
    address: createAddress("113 Garden Row", 30.24355, -97.76385),
    categories: ["lawn-mowing"],
    availableWeekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    willingToTravelMiles: 20
  });

  const serviceDay = new Date();
  serviceDay.setDate(serviceDay.getDate() + 3);
  serviceDay.setHours(13, 0, 0, 0);
  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: serviceDay.toISOString(),
    scheduledEndIso: new Date(serviceDay.getTime() + 2 * 60 * 60 * 1000).toISOString(),
    notes: "Assistant crew message test",
    totalCents: 6200
  });

  const overview = await platform.getProviderStaffingOverview(provider.id);
  const job = overview.jobs.find((item) => item.bookingId === booking.id);
  const crewMatch = job?.matches.find((match) => match.crewMemberId === crew.id);
  assert.ok(crewMatch);

  const preview = await platform.runProviderAssistantCommand(provider.id, {
    command: "Tell Morgan Crew to head to the equipment pickup first for my afternoon appointment",
    bookingId: booking.id,
    execute: false
  });

  assert.equal(preview.understood, true);
  assert.equal(preview.actionType, "message-crew");
  assert.equal(preview.requiresConfirmation, true);
  assert.match(preview.previewMessage, /Send Morgan Crew:/i);
  assert.match(preview.previewMessage, /equipment pickup first/i);

  const executed = await platform.runProviderAssistantCommand(provider.id, {
    command: "Tell Morgan Crew to head to the equipment pickup first for my afternoon appointment",
    bookingId: booking.id,
    execute: true
  });

  assert.equal(executed.executed, true);
  assert.equal(executed.actionType, "message-crew");
  assert.equal(executed.updatedBooking?.interventions.at(-1)?.action, "provider-assistant-message-crew");

  const providerThread = await platform.getProviderCrewConversationThread(
    { userId: provider.id, email: provider.email, role: "provider" },
    undefined,
    crewMatch!.id
  );
  assert.equal(providerThread.messages.length, 1);
  assert.equal(providerThread.messages[0]?.senderRole, "provider");
  assert.equal(providerThread.messages[0]?.body, "Head to the equipment pickup first");
});

test("provider assistant can message the route leader and accepted crew from plain language", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-assistant-crew-role-message@example.com",
    password: "Password123!",
    phone: "555-43831",
    role: "provider",
    companyName: "Route Captain Lawn",
    categories: ["mulch-installation"],
    serviceRadiusMiles: 20,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });
  await platform.updateProviderSettings(provider.id, {
    serviceRadiusMiles: provider.serviceRadiusMiles,
    staffingMode: "auto-accept",
    crewReviewLeadHours: provider.crewReviewLeadHours,
    departureReminderLeadMinutes: provider.departureReminderLeadMinutes,
    routeLeaderMode: "accepted-crew-fallback",
    sponsoredListingEnabled: provider.sponsoredListingEnabled
  });

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-assistant-crew-role-message@example.com",
    password: "Password123!",
    phone: "555-43832",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638)
  });

  const serviceDay = new Date();
  serviceDay.setDate(serviceDay.getDate() + 3);
  serviceDay.setHours(13, 0, 0, 0);
  const availableDay = availabilityDayForIso(serviceDay.toISOString());

  const crewMembers = [];
  for (const [index, name] of ["Morgan Crew", "Terry Crew", "Alex Crew"].entries()) {
    crewMembers.push(
      await platform.registerUser({
        fullName: name,
        email: `crew-assistant-role-message-${index + 1}@example.com`,
        password: "Password123!",
        phone: `555-4383${index + 3}`,
        role: "crew-member",
        address: createAddress(`${113 + index} Garden Row`, 30.24355 + index * 0.00005, -97.76385),
        categories: ["mulch-installation"],
        availableWeekdays: [availableDay],
        willingToTravelMiles: 20,
        preferredSchedule: "full-time",
        hasOwnEquipment: true
      })
    );
  }

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: customer.defaultPropertyId,
    category: "mulch-installation",
    scheduledStartIso: serviceDay.toISOString(),
    scheduledEndIso: new Date(serviceDay.getTime() + 3 * 60 * 60 * 1000).toISOString(),
    notes: "Assistant crew role message test",
    totalCents: 9200
  });

  const staffing = await platform.getProviderStaffingOverview(provider.id);
  const job = staffing.jobs.find((item) => item.bookingId === booking.id);
  assert.ok(job);
  const acceptedMatches = job.matches.filter((match) => match.status === "accepted");
  assert.ok(acceptedMatches.length >= 2);
  const routeLeaderMatch = acceptedMatches[0]!;
  const routeLeader = crewMembers.find((crewMember) => crewMember.id === routeLeaderMatch.crewMemberId);
  assert.ok(routeLeader);

  const assigned = await platform.runProviderAssistantCommand(provider.id, {
    command: `Make ${routeLeader.fullName} the route leader for my afternoon appointment`,
    bookingId: booking.id,
    execute: true
  });
  assert.equal(assigned.executed, true);
  assert.equal(assigned.updatedBooking?.assignedRouteLeaderCrewMemberId, routeLeader.id);

  const routeLeaderPreview = await platform.runProviderAssistantCommand(provider.id, {
    command: "Tell the route leader to confirm the trailer is loaded for my afternoon appointment",
    bookingId: booking.id,
    execute: false
  });

  assert.equal(routeLeaderPreview.understood, true);
  assert.equal(routeLeaderPreview.actionType, "message-crew");
  assert.equal(routeLeaderPreview.requiresConfirmation, true);
  assert.equal(routeLeaderPreview.matchedBookingId, booking.id);
  assert.match(routeLeaderPreview.previewMessage, new RegExp(`Send route leader ${routeLeader.fullName}`, "i"));

  const routeLeaderMessage = await platform.runProviderAssistantCommand(provider.id, {
    command: "Tell the route leader to confirm the trailer is loaded for my afternoon appointment",
    bookingId: booking.id,
    execute: true
  });

  assert.equal(routeLeaderMessage.executed, true);
  assert.equal(routeLeaderMessage.actionType, "message-crew");
  assert.equal(routeLeaderMessage.updatedCrewConversations?.length, 1);
  assert.equal(routeLeaderMessage.updatedCrewConversation?.thread.crewMatchId, routeLeaderMatch.id);
  assert.equal(routeLeaderMessage.updatedCrewConversation?.messages.at(-1)?.body, "Confirm the trailer is loaded");

  const acceptedCrewMessage = await platform.runProviderAssistantCommand(provider.id, {
    command: "Tell the accepted crew to meet at the side gate for my afternoon appointment",
    bookingId: booking.id,
    execute: true
  });

  assert.equal(acceptedCrewMessage.executed, true);
  assert.equal(acceptedCrewMessage.actionType, "message-crew");
  assert.equal(acceptedCrewMessage.updatedCrewConversations?.length, acceptedMatches.length);
  assert.equal(acceptedCrewMessage.updatedBooking?.interventions.at(-1)?.action, "provider-assistant-message-crew");
  assert.match(acceptedCrewMessage.previewMessage, new RegExp(`Sent accepted crew \\(${acceptedMatches.length}\\)`, "i"));
  for (const thread of acceptedCrewMessage.updatedCrewConversations ?? []) {
    assert.equal(thread.messages.at(-1)?.senderRole, "provider");
    assert.equal(thread.messages.at(-1)?.body, "Meet at the side gate");
  }
});

test("provider assistant can accept or deny crew matches from plain language", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-assistant-crew-review@example.com",
    password: "Password123!",
    phone: "555-4386",
    role: "provider",
    companyName: "Route Captain Lawn",
    categories: ["lawn-mowing"],
    serviceRadiusMiles: 20,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });
  await verifyProviderCredentials(platform, provider.id, { includeWorkersComp: true });
  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-assistant-crew-review@example.com",
    password: "Password123!",
    phone: "555-4387",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638)
  });
  const firstCrew = await platform.registerUser({
    fullName: "Morgan Crew",
    email: "crew-assistant-review-1@example.com",
    password: "Password123!",
    phone: "555-4388",
    role: "crew-member",
    address: createAddress("113 Garden Row", 30.24355, -97.76385),
    categories: ["lawn-mowing"],
    availableWeekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    willingToTravelMiles: 20
  });
  const secondCrew = await platform.registerUser({
    fullName: "Taylor Crew",
    email: "crew-assistant-review-2@example.com",
    password: "Password123!",
    phone: "555-4389",
    role: "crew-member",
    address: createAddress("114 Garden Row", 30.24358, -97.76382),
    categories: ["lawn-mowing"],
    availableWeekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    willingToTravelMiles: 20
  });

  const serviceDay = new Date();
  serviceDay.setDate(serviceDay.getDate() + 3);
  serviceDay.setHours(13, 0, 0, 0);
  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: serviceDay.toISOString(),
    scheduledEndIso: new Date(serviceDay.getTime() + 2 * 60 * 60 * 1000).toISOString(),
    notes: "Assistant crew review test",
    totalCents: 6200
  });

  const overview = await platform.getProviderStaffingOverview(provider.id);
  const job = overview.jobs.find((item) => item.bookingId === booking.id);
  assert.ok(job);
  assert.equal(
    job?.matches.filter((match) => match.status === "pending-provider-review").length,
    2
  );

  const acceptPreview = await platform.runProviderAssistantCommand(provider.id, {
    command: "Accept Morgan Crew for my afternoon appointment",
    bookingId: booking.id,
    execute: false
  });
  assert.equal(acceptPreview.understood, true);
  assert.equal(acceptPreview.actionType, "accept-crew-match");
  assert.equal(acceptPreview.requiresConfirmation, true);
  assert.match(acceptPreview.previewMessage, /Accept Morgan Crew/i);

  const accepted = await platform.runProviderAssistantCommand(provider.id, {
    command: "Accept Morgan Crew for my afternoon appointment",
    bookingId: booking.id,
    execute: true
  });
  assert.equal(accepted.executed, true);
  assert.equal(accepted.actionType, "accept-crew-match");
  assert.equal(accepted.updatedBooking?.interventions.at(-1)?.action, "provider-assistant-accept-crew-match");

  const acceptedMatches = await platform.getProviderStaffingOverview(provider.id);
  const acceptedJob = acceptedMatches.jobs.find((item) => item.bookingId === booking.id);
  const acceptedCrewMatch = acceptedJob?.matches.find((match) => match.crewMemberId === firstCrew.id);
  assert.equal(acceptedCrewMatch?.status, "accepted");

  const denyPreview = await platform.runProviderAssistantCommand(provider.id, {
    command: "Decline Taylor Crew for my afternoon appointment",
    bookingId: booking.id,
    execute: false
  });
  assert.equal(denyPreview.understood, true);
  assert.equal(denyPreview.actionType, "deny-crew-match");
  assert.equal(denyPreview.requiresConfirmation, true);
  assert.match(denyPreview.previewMessage, /Decline Taylor Crew/i);

  const denied = await platform.runProviderAssistantCommand(provider.id, {
    command: "Decline Taylor Crew for my afternoon appointment",
    bookingId: booking.id,
    execute: true
  });
  assert.equal(denied.executed, true);
  assert.equal(denied.actionType, "deny-crew-match");
  assert.equal(denied.updatedBooking?.interventions.at(-1)?.action, "provider-assistant-deny-crew-match");

  const deniedMatches = await platform.getProviderStaffingOverview(provider.id);
  const deniedJob = deniedMatches.jobs.find((item) => item.bookingId === booking.id);
  const deniedCrewMatch = deniedJob?.matches.find((match) => match.crewMemberId === secondCrew.id);
  assert.equal(deniedCrewMatch?.status, "denied");
});

test("provider assistant can accept the best recommended crew from plain language", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-assistant-best-crew@example.com",
    password: "Password123!",
    phone: "555-4390",
    role: "provider",
    companyName: "Route Captain Lawn",
    categories: ["lawn-mowing"],
    serviceRadiusMiles: 20,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });
  await verifyProviderCredentials(platform, provider.id, { includeWorkersComp: true });
  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-assistant-best-crew@example.com",
    password: "Password123!",
    phone: "555-4391",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638)
  });
  const bestCrew = await platform.registerUser({
    fullName: "Morgan Crew",
    email: "crew-assistant-best-1@example.com",
    password: "Password123!",
    phone: "555-4392",
    role: "crew-member",
    address: createAddress("113 Garden Row", 30.24355, -97.76385),
    categories: ["lawn-mowing"],
    availableWeekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    willingToTravelMiles: 20,
    preferredSchedule: "full-time"
  });
  const backupCrew = await platform.registerUser({
    fullName: "Taylor Crew",
    email: "crew-assistant-best-2@example.com",
    password: "Password123!",
    phone: "555-4393",
    role: "crew-member",
    address: createAddress("1600 Far Crew Lane", 30.31, -97.86),
    categories: ["lawn-mowing"],
    availableWeekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    willingToTravelMiles: 25,
    preferredSchedule: "seasonal"
  });

  const serviceDay = new Date();
  serviceDay.setDate(serviceDay.getDate() + 3);
  serviceDay.setHours(13, 0, 0, 0);
  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: serviceDay.toISOString(),
    scheduledEndIso: new Date(serviceDay.getTime() + 2 * 60 * 60 * 1000).toISOString(),
    notes: "Assistant best crew test",
    totalCents: 6200
  });

  const overview = await platform.getProviderStaffingOverview(provider.id);
  const job = overview.jobs.find((item) => item.bookingId === booking.id);
  assert.ok(job);
  assert.equal(job?.matches[0]?.crewMemberId, bestCrew.id);

  const preview = await platform.runProviderAssistantCommand(provider.id, {
    command: "Accept the best crew for my afternoon appointment",
    bookingId: booking.id,
    execute: false
  });
  assert.equal(preview.understood, true);
  assert.equal(preview.actionType, "accept-best-crew-match");
  assert.equal(preview.requiresConfirmation, true);
  assert.match(preview.previewMessage, /Accept Morgan Crew as the best crew/i);

  const executed = await platform.runProviderAssistantCommand(provider.id, {
    command: "Accept the best crew for my afternoon appointment",
    bookingId: booking.id,
    execute: true
  });
  assert.equal(executed.executed, true);
  assert.equal(executed.actionType, "accept-best-crew-match");
  assert.equal(
    executed.updatedBooking?.interventions.at(-1)?.action,
    "provider-assistant-accept-best-crew-match"
  );

  const staffingAfter = await platform.getProviderStaffingOverview(provider.id);
  const updatedJob = staffingAfter.jobs.find((item) => item.bookingId === booking.id);
  const acceptedMatch = updatedJob?.matches.find((match) => match.crewMemberId === bestCrew.id);
  const untouchedBackup = updatedJob?.matches.find((match) => match.crewMemberId === backupCrew.id);
  assert.equal(acceptedMatch?.status, "accepted");
  assert.equal(untouchedBackup?.status, "pending-provider-review");
});

test("provider assistant can summarize tomorrow's dispatch load without picking a booking", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-assistant-dispatch-summary@example.com",
    password: "Password123!",
    phone: "555-4394",
    role: "provider",
    companyName: "Route Captain Lawn",
    categories: ["lawn-mowing"],
    serviceRadiusMiles: 20,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });
  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-assistant-dispatch-summary@example.com",
    password: "Password123!",
    phone: "555-4395",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638)
  });

  const serviceDay = new Date();
  serviceDay.setDate(serviceDay.getDate() + 1);
  serviceDay.setHours(13, 0, 0, 0);
  await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: serviceDay.toISOString(),
    scheduledEndIso: new Date(serviceDay.getTime() + 2 * 60 * 60 * 1000).toISOString(),
    notes: "Assistant dispatch summary test",
    totalCents: 6200
  });

  const summary = await platform.runProviderAssistantCommand(provider.id, {
    command: "How does tomorrow look?",
    execute: false
  });

  assert.equal(summary.understood, true);
  assert.equal(summary.actionType, "summarize-dispatch");
  assert.equal(summary.requiresBookingSelection, false);
  assert.equal(summary.requiresConfirmation, false);
  assert.equal(summary.executed, false);
  assert.ok(summary.dispatchDaySummary);
  assert.equal(summary.dispatchDaySummary?.yardmatchJobCount, 1);
  assert.match(summary.previewLabel, /Tomorrow dispatch summary/i);
  assert.match(summary.previewMessage, /Tomorrow is/i);
});

test("provider assistant can highlight the highest-pressure window tomorrow", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-assistant-day-attention@example.com",
    password: "Password123!",
    phone: "555-4394",
    role: "provider",
    companyName: "Route Captain Lawn",
    categories: ["lawn-mowing"],
    serviceRadiusMiles: 20,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });
  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-assistant-day-attention@example.com",
    password: "Password123!",
    phone: "555-4395",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638)
  });

  const firstJob = new Date();
  firstJob.setDate(firstJob.getDate() + 1);
  firstJob.setHours(8, 0, 0, 0);
  const secondJob = new Date(firstJob);
  secondJob.setHours(13, 0, 0, 0);

  await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: firstJob.toISOString(),
    scheduledEndIso: new Date(firstJob.getTime() + 2 * 60 * 60 * 1000).toISOString(),
    notes: "Assistant day attention test 1",
    totalCents: 6200
  });

  await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("118 Garden Row", 30.2437, -97.76395),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: secondJob.toISOString(),
    scheduledEndIso: new Date(secondJob.getTime() + 2 * 60 * 60 * 1000).toISOString(),
    notes: "Assistant day attention test 2",
    totalCents: 6200
  });

  const summary = await platform.runProviderAssistantCommand(provider.id, {
    command: "What needs attention tomorrow?",
    execute: false
  });

  assert.equal(summary.understood, true);
  assert.equal(summary.actionType, "summarize-dispatch");
  assert.ok(summary.dispatchDaySummary);
  assert.ok(summary.dispatchWindowSummary);
  assert.ok(summary.bookingCandidates.length > 0);
  assert.equal(summary.bookingCandidates.length, summary.dispatchWindowSummary!.yardmatchJobCount);
  assert.match(summary.previewLabel, /Tomorrow dispatch attention/i);
  assert.match(summary.previewMessage, /biggest pressure/i);
  assert.ok(["Morning", "Afternoon", "Late afternoon / evening"].includes(summary.dispatchWindowSummary!.label));
});

test("provider assistant can recommend which booking to move tomorrow", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-assistant-move-tomorrow@example.com",
    password: "Password123!",
    phone: "555-43945",
    role: "provider",
    companyName: "Route Captain Lawn",
    categories: ["lawn-mowing"],
    serviceRadiusMiles: 20,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });
  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-assistant-move-tomorrow@example.com",
    password: "Password123!",
    phone: "555-43946",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638)
  });

  const firstAfternoonJob = new Date();
  firstAfternoonJob.setDate(firstAfternoonJob.getDate() + 1);
  firstAfternoonJob.setHours(13, 0, 0, 0);
  const secondAfternoonJob = new Date(firstAfternoonJob);
  secondAfternoonJob.setHours(15, 30, 0, 0);

  const firstBooking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: firstAfternoonJob.toISOString(),
    scheduledEndIso: new Date(firstAfternoonJob.getTime() + 2 * 60 * 60 * 1000).toISOString(),
    notes: "Assistant move recommendation test 1",
    totalCents: 6200
  });

  const secondBooking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("118 Garden Row", 30.2437, -97.76395),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: secondAfternoonJob.toISOString(),
    scheduledEndIso: new Date(secondAfternoonJob.getTime() + 2 * 60 * 60 * 1000).toISOString(),
    notes: "Assistant move recommendation test 2",
    totalCents: 6200
  });

  const recommendation = await platform.runProviderAssistantCommand(provider.id, {
    command: "What should I move tomorrow?",
    execute: false
  });

  assert.equal(recommendation.understood, true);
  assert.equal(recommendation.actionType, "recommend-dispatch-adjustment");
  assert.equal(recommendation.requiresBookingSelection, false);
  assert.equal(recommendation.requiresConfirmation, false);
  assert.equal(recommendation.executed, false);
  assert.ok(recommendation.dispatchDaySummary);
  assert.ok(recommendation.dispatchWindowSummary);
  assert.equal(recommendation.dispatchWindowSummary?.windowKey, "afternoon");
  assert.equal(recommendation.targetWindowKey, "morning");
  assert.equal(recommendation.bookingCandidates.length, 2);
  assert.equal(recommendation.bookingCandidates[0]?.bookingId, recommendation.matchedBookingId);
  assert.equal(recommendation.sourceWindowKey, "afternoon");
  assert.ok(recommendation.suggestedStartIso);
  assert.ok(recommendation.suggestedEndIso);
  assert.match(recommendation.previewLabel, /booking to move/i);
  assert.match(recommendation.previewMessage, /Move .* appointment into .* first/i);
  assert.ok(
    [firstBooking.id, secondBooking.id].includes(recommendation.matchedBookingId ?? "")
  );
});

test("provider assistant recommends staffing first when crew gap is the real dispatch pressure", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-assistant-staffing-first@example.com",
    password: "Password123!",
    phone: "555-439451",
    role: "provider",
    companyName: "Route Captain Lawn",
    categories: ["mulch-installation"],
    serviceRadiusMiles: 20,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });
  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-assistant-staffing-first@example.com",
    password: "Password123!",
    phone: "555-439452",
    role: "customer",
    propertyLabel: "Primary home",
    lawnSizeSqFt: 6400,
    address: createAddress("112 Garden Row", 30.2435, -97.7638)
  });

  const mulchJob = new Date();
  mulchJob.setDate(mulchJob.getDate() + 1);
  mulchJob.setHours(9, 0, 0, 0);

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: customer.defaultPropertyId,
    category: "mulch-installation",
    scheduledStartIso: mulchJob.toISOString(),
    scheduledEndIso: new Date(mulchJob.getTime() + 3 * 60 * 60 * 1000).toISOString(),
    notes: "Assistant staffing-first dispatch test",
    totalCents: 9800
  });

  const recommendation = await platform.runProviderAssistantCommand(provider.id, {
    command: "What should I move tomorrow?",
    execute: false
  });

  assert.equal(recommendation.understood, true);
  assert.equal(recommendation.actionType, "recommend-dispatch-adjustment");
  assert.equal(recommendation.requiresBookingSelection, false);
  assert.equal(recommendation.requiresConfirmation, false);
  assert.equal(recommendation.executed, false);
  assert.ok(recommendation.dispatchDaySummary);
  assert.ok(recommendation.dispatchWindowSummary);
  assert.equal(recommendation.dispatchWindowSummary?.crewGap, 3);
  assert.equal(recommendation.bookingCandidates.length, 1);
  assert.equal(recommendation.bookingCandidates[0]?.bookingId, booking.id);
  assert.equal(recommendation.matchedBookingId, undefined);
  assert.equal(recommendation.sourceWindowKey, undefined);
  assert.equal(recommendation.targetWindowKey, undefined);
  assert.equal(recommendation.suggestedStartIso, undefined);
  assert.match(recommendation.previewLabel, /staffing first/i);
  assert.match(recommendation.previewMessage, /Source or approve crew/i);
});

test("provider assistant can recommend a cross-day move when tomorrow stays tight", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-assistant-cross-day-move@example.com",
    password: "Password123!",
    phone: "555-439465",
    role: "provider",
    companyName: "Route Captain Lawn",
    categories: ["lawn-mowing"],
    serviceRadiusMiles: 20,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });
  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-assistant-cross-day-move@example.com",
    password: "Password123!",
    phone: "555-439466",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638)
  });

  const morningJob = new Date();
  morningJob.setDate(morningJob.getDate() + 1);
  morningJob.setHours(8, 0, 0, 0);
  const afternoonJob = new Date(morningJob);
  afternoonJob.setHours(13, 0, 0, 0);
  const eveningJob = new Date(morningJob);
  eveningJob.setHours(17, 0, 0, 0);
  const pressuredCrossDaySlotStart = new Date(morningJob);
  pressuredCrossDaySlotStart.setDate(pressuredCrossDaySlotStart.getDate() + 1);
  pressuredCrossDaySlotStart.setHours(10, 0, 0, 0);
  const pressuredCrossDaySlotEnd = new Date(pressuredCrossDaySlotStart.getTime() + 60 * 60 * 1000);
  const cleanCrossDaySlotStart = new Date(morningJob);
  cleanCrossDaySlotStart.setDate(cleanCrossDaySlotStart.getDate() + 2);
  cleanCrossDaySlotStart.setHours(10, 0, 0, 0);
  const cleanCrossDaySlotEnd = new Date(cleanCrossDaySlotStart.getTime() + 60 * 60 * 1000);

  (
    repository as unknown as {
      slots: Array<{
        id: string;
        providerId: string;
        startIso: string;
        endIso: string;
        isBooked: boolean;
      }>;
    }
  ).slots.push(
    {
      id: crypto.randomUUID(),
      providerId: provider.id,
      startIso: pressuredCrossDaySlotStart.toISOString(),
      endIso: pressuredCrossDaySlotEnd.toISOString(),
      isBooked: false
    },
    {
      id: crypto.randomUUID(),
      providerId: provider.id,
      startIso: cleanCrossDaySlotStart.toISOString(),
      endIso: cleanCrossDaySlotEnd.toISOString(),
      isBooked: false
    }
  );

  const morningBooking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: morningJob.toISOString(),
    scheduledEndIso: new Date(morningJob.getTime() + 60 * 60 * 1000).toISOString(),
    notes: "Cross-day move test morning",
    totalCents: 6200
  });

  const afternoonBooking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("118 Garden Row", 30.2437, -97.76395),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: afternoonJob.toISOString(),
    scheduledEndIso: new Date(afternoonJob.getTime() + 60 * 60 * 1000).toISOString(),
    notes: "Cross-day move test afternoon",
    totalCents: 6200
  });

  await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("125 Garden Row", 30.2439, -97.7641),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: eveningJob.toISOString(),
    scheduledEndIso: new Date(eveningJob.getTime() + 60 * 60 * 1000).toISOString(),
    notes: "Cross-day move test evening",
    totalCents: 6200
  });

  await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("130 Garden Row", 30.24395, -97.76412),
    servicePropertyId: customer.defaultPropertyId,
    category: "mulch-installation",
    scheduledStartIso: new Date(pressuredCrossDaySlotStart.getTime() - 2 * 60 * 60 * 1000).toISOString(),
    scheduledEndIso: new Date(pressuredCrossDaySlotStart.getTime() - 60 * 60 * 1000).toISOString(),
    notes: "Cross-day move test pressure on earlier slot",
    totalCents: 9200
  });

  const recommendation = await platform.runProviderAssistantCommand(provider.id, {
    command: "What should I move tomorrow?",
    execute: false
  });

  assert.equal(recommendation.understood, true);
  assert.equal(recommendation.actionType, "recommend-dispatch-adjustment");
  assert.ok(recommendation.targetWindowLabel);
  assert.ok(recommendation.suggestedStartIso);
  assert.ok(recommendation.suggestedEndIso);
  assert.equal(recommendation.suggestedStartIso, cleanCrossDaySlotStart.toISOString());
  assert.match(recommendation.previewMessage, /next cleaner route opening|appointment to/i);
  assert.ok(
    [morningBooking.id, afternoonBooking.id].includes(recommendation.matchedBookingId ?? "")
  );
});

test("provider assistant can recommend where more crew is needed tomorrow", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-assistant-crew-gap@example.com",
    password: "Password123!",
    phone: "555-43947",
    role: "provider",
    companyName: "Route Captain Lawn",
    categories: ["lawn-mowing", "mulch-installation"],
    serviceRadiusMiles: 20,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });
  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-assistant-crew-gap@example.com",
    password: "Password123!",
    phone: "555-43948",
    role: "customer",
    propertyLabel: "Primary home",
    lawnSizeSqFt: 6200,
    address: createAddress("112 Garden Row", 30.2435, -97.7638)
  });

  const firstJob = new Date();
  firstJob.setDate(firstJob.getDate() + 1);
  firstJob.setHours(9, 0, 0, 0);
  const secondJob = new Date(firstJob);
  secondJob.setHours(14, 0, 0, 0);

  const largerGapBooking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: customer.defaultPropertyId,
    category: "mulch-installation",
    scheduledStartIso: firstJob.toISOString(),
    scheduledEndIso: new Date(firstJob.getTime() + 3 * 60 * 60 * 1000).toISOString(),
    notes: "Assistant staffing recommendation test 1",
    totalCents: 9200
  });

  const smallerGapBooking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("118 Garden Row", 30.2437, -97.76395),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: secondJob.toISOString(),
    scheduledEndIso: new Date(secondJob.getTime() + 2 * 60 * 60 * 1000).toISOString(),
    notes: "Assistant staffing recommendation test 2",
    totalCents: 6200
  });

  const recommendation = await platform.runProviderAssistantCommand(provider.id, {
    command: "Do I need more crew tomorrow?",
    execute: false
  });

  assert.equal(recommendation.understood, true);
  assert.equal(recommendation.actionType, "recommend-staffing-adjustment");
  assert.equal(recommendation.requiresBookingSelection, false);
  assert.equal(recommendation.requiresConfirmation, false);
  assert.equal(recommendation.executed, false);
  assert.ok(recommendation.dispatchDaySummary);
  assert.equal(recommendation.bookingCandidates.length, 2);
  assert.equal(recommendation.bookingCandidates[0]?.bookingId, largerGapBooking.id);
  assert.equal(recommendation.matchedBookingId, largerGapBooking.id);
  assert.ok(
    recommendation.bookingCandidates.some((candidate) => candidate.bookingId === smallerGapBooking.id)
  );
  assert.equal(recommendation.staffingPlan?.length, 2);
  assert.equal(recommendation.staffingPlan?.[0]?.bookingId, largerGapBooking.id);
  assert.equal(recommendation.staffingPlan?.[0]?.category, "mulch-installation");
  assert.equal(recommendation.staffingPlan?.[0]?.recommendedAction, "source-more-crew");
  assert.equal(recommendation.staffingPlan?.[0]?.pendingMatchCount, 0);
  assert.equal(recommendation.staffingPlan?.[0]?.uncoveredCrewGap, 3);
  assert.ok(recommendation.staffingPlan?.some((item) => item.bookingId === smallerGapBooking.id));
  assert.match(recommendation.previewMessage, /Staffing plan covers 2 competing jobs/i);
  assert.match(recommendation.previewLabel, /crew gap recommendation/i);
  assert.match(recommendation.previewMessage, /extra crew first|open crew slot/i);
});

test("provider assistant can recommend reviewing pending crew matches before sourcing more crew", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-assistant-review-pending-crew@example.com",
    password: "Password123!",
    phone: "555-43949",
    role: "provider",
    companyName: "Route Captain Lawn",
    categories: ["mulch-installation"],
    serviceRadiusMiles: 20,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });

  await repository.updateProvider(provider.id, {
    staffingMode: "review-first"
  });

  const serviceDay = new Date();
  serviceDay.setDate(serviceDay.getDate() + 1);
  serviceDay.setHours(9, 0, 0, 0);
  const availableDay = availabilityDayForIso(serviceDay.toISOString());

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-assistant-review-pending-crew@example.com",
    password: "Password123!",
    phone: "555-43950",
    role: "customer",
    propertyLabel: "Primary home",
    lawnSizeSqFt: 6200,
    address: createAddress("112 Garden Row", 30.2435, -97.7638)
  });

  for (const [index, offset] of [0, 1, 2].entries()) {
    await platform.registerUser({
      fullName: `Crew Pending ${index + 1}`,
      email: `crew-pending-${index + 1}@example.com`,
      password: "Password123!",
      phone: `555-4395${index + 1}`,
      role: "crew-member",
      address: createAddress(`11${index + 3} Garden Row`, 30.24355 + offset * 0.00005, -97.76385 - offset * 0.00005),
      categories: ["mulch-installation"],
      availableWeekdays: [availableDay],
      willingToTravelMiles: 20,
      preferredSchedule: "full-time",
      hasOwnEquipment: true
    });
  }

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: customer.defaultPropertyId,
    category: "mulch-installation",
    scheduledStartIso: serviceDay.toISOString(),
    scheduledEndIso: new Date(serviceDay.getTime() + 3 * 60 * 60 * 1000).toISOString(),
    notes: "Assistant review pending crew recommendation test",
    totalCents: 9200
  });

  const recommendation = await platform.runProviderAssistantCommand(provider.id, {
    command: "Do I need more crew tomorrow?",
    execute: false
  });

  assert.equal(recommendation.understood, true);
  assert.equal(recommendation.actionType, "recommend-staffing-adjustment");
  assert.equal(recommendation.matchedBookingId, booking.id);
  assert.equal(recommendation.staffingPlan?.length, 1);
  assert.equal(recommendation.staffingPlan?.[0]?.bookingId, booking.id);
  assert.equal(recommendation.staffingPlan?.[0]?.recommendedAction, "review-pending-matches");
  assert.equal(recommendation.staffingPlan?.[0]?.pendingMatchCount, 3);
  assert.equal(recommendation.staffingPlan?.[0]?.uncoveredCrewGap, 0);
  assert.match(recommendation.previewMessage, /Review pending crew matches/i);
  assert.match(recommendation.previewMessage, /pending match/i);
});

test("provider assistant staffing plan recommends route leader assignment when crew coverage is full", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-assistant-route-leader-staffing@example.com",
    password: "Password123!",
    phone: "555-43952",
    role: "provider",
    companyName: "Route Captain Lawn",
    categories: ["lawn-mowing"],
    serviceRadiusMiles: 20,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });

  await platform.updateProviderSettings(provider.id, {
    serviceRadiusMiles: 20,
    staffingMode: "review-first",
    crewReviewLeadHours: 6,
    departureReminderLeadMinutes: 30,
    routeLeaderMode: "accepted-crew-fallback",
    sponsoredListingEnabled: provider.sponsoredListingEnabled
  });

  const serviceDay = new Date();
  serviceDay.setDate(serviceDay.getDate() + 1);
  serviceDay.setHours(9, 0, 0, 0);
  const availableDay = availabilityDayForIso(serviceDay.toISOString());

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-assistant-route-leader-staffing@example.com",
    password: "Password123!",
    phone: "555-43953",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638)
  });
  const firstCrew = await platform.registerUser({
    fullName: "Taylor Crew",
    email: "crew-assistant-route-leader-staffing-1@example.com",
    password: "Password123!",
    phone: "555-43954",
    role: "crew-member",
    address: createAddress("113 Garden Row", 30.24355, -97.76385),
    categories: ["lawn-mowing"],
    availableWeekdays: [availableDay],
    willingToTravelMiles: 20,
    preferredSchedule: "full-time",
    hasOwnEquipment: true
  });
  const secondCrew = await platform.registerUser({
    fullName: "Morgan Crew",
    email: "crew-assistant-route-leader-staffing-2@example.com",
    password: "Password123!",
    phone: "555-43955",
    role: "crew-member",
    address: createAddress("114 Garden Row", 30.24358, -97.76382),
    categories: ["lawn-mowing"],
    availableWeekdays: [availableDay],
    willingToTravelMiles: 20,
    preferredSchedule: "full-time",
    hasOwnEquipment: true
  });

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: serviceDay.toISOString(),
    scheduledEndIso: new Date(serviceDay.getTime() + 60 * 60 * 1000).toISOString(),
    notes: "Assistant route leader staffing recommendation test",
    totalCents: 6200
  });

  const staffing = await platform.getProviderStaffingOverview(provider.id);
  const job = staffing.jobs.find((item) => item.bookingId === booking.id);
  assert.ok(job);
  const firstMatch = job?.matches.find((match) => match.crewMemberId === firstCrew.id);
  const secondMatch = job?.matches.find((match) => match.crewMemberId === secondCrew.id);
  assert.ok(firstMatch);
  assert.ok(secondMatch);

  await reviewCrewMatchForEligibleProvider(platform, provider.id, { crewMatchId: firstMatch!.id, action: "accept" });
  await reviewCrewMatchForEligibleProvider(platform, provider.id, { crewMatchId: secondMatch!.id, action: "accept" });

  const recommendation = await platform.runProviderAssistantCommand(provider.id, {
    command: "Do I need more crew tomorrow?",
    execute: false
  });

  assert.equal(recommendation.understood, true);
  assert.equal(recommendation.actionType, "recommend-staffing-adjustment");
  assert.equal(recommendation.matchedBookingId, booking.id);
  assert.equal(recommendation.staffingPlan?.length, 1);
  const planItem = recommendation.staffingPlan?.[0];
  assert.equal(planItem?.bookingId, booking.id);
  assert.equal(planItem?.crewGap, 0);
  assert.equal(planItem?.uncoveredCrewGap, 0);
  assert.equal(planItem?.acceptedCrewCount, 2);
  assert.equal(planItem?.recommendedAction, "assign-route-leader");
  assert.equal(planItem?.routeLeaderRequired, true);
  assert.equal(planItem?.routeLeaderAssigned, false);
  assert.ok([firstCrew.id, secondCrew.id].includes(planItem?.recommendedRouteLeaderCrewMemberId ?? ""));
  assert.match(planItem?.recommendedRouteLeaderCrewMemberName ?? "", /Crew/);
  assert.ok(planItem?.reasons.some((reason) => /route leader/i.test(reason)));
  assert.match(recommendation.previewMessage, /Assign .*route leader/i);
  assert.match(recommendation.previewMessage, /coverage is already full/i);
});

test("provider assistant can summarize the next 7 days of dispatch pressure", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-assistant-week-summary@example.com",
    password: "Password123!",
    phone: "555-4396",
    role: "provider",
    companyName: "Route Captain Lawn",
    categories: ["lawn-mowing"],
    serviceRadiusMiles: 20,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });
  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-assistant-week-summary@example.com",
    password: "Password123!",
    phone: "555-4397",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638)
  });

  const firstDay = new Date();
  firstDay.setDate(firstDay.getDate() + 1);
  firstDay.setHours(13, 0, 0, 0);
  const secondDay = new Date(firstDay);
  secondDay.setDate(secondDay.getDate() + 2);
  secondDay.setHours(17, 0, 0, 0);

  await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: firstDay.toISOString(),
    scheduledEndIso: new Date(firstDay.getTime() + 2 * 60 * 60 * 1000).toISOString(),
    notes: "Assistant week summary test 1",
    totalCents: 6200
  });

  await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("118 Garden Row", 30.2437, -97.76395),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: secondDay.toISOString(),
    scheduledEndIso: new Date(secondDay.getTime() + 2 * 60 * 60 * 1000).toISOString(),
    notes: "Assistant week summary test 2",
    totalCents: 6200
  });

  const summary = await platform.runProviderAssistantCommand(provider.id, {
    command: "How does this week look?",
    execute: false
  });

  assert.equal(summary.understood, true);
  assert.equal(summary.actionType, "summarize-dispatch");
  assert.equal(summary.requiresBookingSelection, false);
  assert.equal(summary.requiresConfirmation, false);
  assert.equal(summary.executed, false);
  assert.ok(summary.dispatchRangeSummary);
  assert.equal(summary.dispatchRangeSummary?.scope, "next-7-days");
  assert.equal(summary.dispatchRangeSummary?.activeDayCount, 2);
  assert.equal(summary.dispatchRangeSummary?.totalYardmatchJobs, 2);
  assert.match(summary.previewLabel, /next 7 days dispatch summary/i);
  assert.match(summary.previewMessage, /next 7 days has 2 YardMatch jobs/i);
});

test("provider assistant can highlight the highest-attention day this week", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-assistant-week-attention@example.com",
    password: "Password123!",
    phone: "555-4398",
    role: "provider",
    companyName: "Route Captain Lawn",
    categories: ["lawn-mowing"],
    serviceRadiusMiles: 20,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });
  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-assistant-week-attention@example.com",
    password: "Password123!",
    phone: "555-4399",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638)
  });

  const firstDay = new Date();
  firstDay.setDate(firstDay.getDate() + 1);
  firstDay.setHours(13, 0, 0, 0);
  const secondDay = new Date(firstDay);
  secondDay.setDate(secondDay.getDate() + 3);
  secondDay.setHours(13, 0, 0, 0);

  await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: firstDay.toISOString(),
    scheduledEndIso: new Date(firstDay.getTime() + 2 * 60 * 60 * 1000).toISOString(),
    notes: "Assistant week attention test 1",
    totalCents: 6200
  });

  await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("118 Garden Row", 30.2437, -97.76395),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: secondDay.toISOString(),
    scheduledEndIso: new Date(secondDay.getTime() + 2 * 60 * 60 * 1000).toISOString(),
    notes: "Assistant week attention test 2a",
    totalCents: 6200
  });

  await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("125 Garden Row", 30.2439, -97.7641),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: new Date(secondDay.getTime() + 2.5 * 60 * 60 * 1000).toISOString(),
    scheduledEndIso: new Date(secondDay.getTime() + 4.5 * 60 * 60 * 1000).toISOString(),
    notes: "Assistant week attention test 2b",
    totalCents: 6200
  });

  const summary = await platform.runProviderAssistantCommand(provider.id, {
    command: "What needs attention this week?",
    execute: false
  });

  assert.equal(summary.understood, true);
  assert.equal(summary.actionType, "summarize-dispatch");
  assert.ok(summary.dispatchRangeSummary);
  assert.ok(summary.dispatchDaySummary);
  assert.ok(summary.dispatchWindowSummary);
  assert.ok(summary.bookingCandidates.length > 0);
  assert.match(summary.previewLabel, /dispatch attention/i);
  assert.match(summary.previewMessage, /needs the most attention/i);
  assert.equal(summary.bookingCandidates.length, summary.dispatchWindowSummary!.yardmatchJobCount);
  const candidateDayIsos = [
    summary.dispatchRangeSummary?.highestCrewGapDay?.dateIso,
    summary.dispatchRangeSummary?.highestDriveMilesDay?.dateIso,
    summary.dispatchRangeSummary?.busiestDay?.dateIso
  ].filter(Boolean);
  assert.ok(candidateDayIsos.includes(summary.dispatchDaySummary?.dateIso));
});

test("provider assistant can preview and clear an equipment pickup route stop", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-assistant-route-stop@example.com",
    password: "Password123!",
    phone: "555-4390",
    role: "provider",
    companyName: "Route Captain Lawn",
    categories: ["lawn-mowing"],
    serviceRadiusMiles: 20,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });
  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-assistant-route-stop@example.com",
    password: "Password123!",
    phone: "555-4391",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638)
  });

  const afternoonStart = new Date();
  afternoonStart.setDate(afternoonStart.getDate() + 2);
  afternoonStart.setHours(13, 0, 0, 0);
  const afternoonEnd = new Date(afternoonStart.getTime() + 2 * 60 * 60 * 1000);

  await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: afternoonStart.toISOString(),
    scheduledEndIso: afternoonEnd.toISOString(),
    notes: "Assistant route stop test",
    totalCents: 6200
  });

  const preview = await platform.runProviderAssistantCommand(provider.id, {
    command: "Set equipment pickup as the next stop for my afternoon appointment",
    execute: false
  });
  assert.equal(preview.actionType, "set-route-stop");
  assert.equal(preview.requiresConfirmation, true);
  assert.match(preview.previewMessage, /equipment pickup/i);

  const executed = await platform.runProviderAssistantCommand(provider.id, {
    command: "Set equipment pickup as the next stop for my afternoon appointment",
    execute: true
  });
  assert.equal(executed.actionType, "set-route-stop");
  assert.equal(executed.updatedBooking?.routeActiveStop?.kind, "equipment-pickup");
  assert.equal(executed.updatedBooking?.interventions.at(-1)?.action, "provider-assistant-set-route-stop");

  const clearPreview = await platform.runProviderAssistantCommand(provider.id, {
    command: "Clear the route stop for my afternoon appointment",
    execute: false
  });
  assert.equal(clearPreview.actionType, "clear-route-stop");
  assert.equal(clearPreview.requiresConfirmation, true);

  const cleared = await platform.runProviderAssistantCommand(provider.id, {
    command: "Clear the route stop for my afternoon appointment",
    execute: true
  });
  assert.equal(cleared.actionType, "clear-route-stop");
  assert.equal(cleared.updatedBooking?.routeActiveStop, undefined);
  assert.equal(cleared.updatedBooking?.interventions.at(-1)?.action, "provider-assistant-clear-route-stop");
});

test("provider assistant previews and executes a reschedule command with customer notification", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-assistant@example.com",
    password: "Password123!",
    phone: "555-4380",
    role: "provider",
    companyName: "Prompt Lawn Co.",
    categories: ["lawn-mowing"],
    serviceRadiusMiles: 25,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });
  assert.equal(provider.role, "provider");

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-assistant@example.com",
    password: "Password123!",
    phone: "555-4381",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638)
  });

  const serviceDay = new Date();
  serviceDay.setDate(serviceDay.getDate() + 3);
  serviceDay.setHours(13, 0, 0, 0);
  const startIso = serviceDay.toISOString();
  const endIso = new Date(serviceDay.getTime() + 2 * 60 * 60 * 1000).toISOString();

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: startIso,
    scheduledEndIso: endIso,
    notes: "Assistant reschedule test",
    totalCents: 6200
  });

  const preview = await platform.runProviderAssistantCommand(provider.id, {
    command: "Change my afternoon appointment to evening and notify the customer",
    bookingId: booking.id,
    execute: false
  });

  assert.equal(preview.understood, true);
  assert.equal(preview.requiresConfirmation, true);
  assert.equal(preview.executed, false);
  assert.equal(preview.targetWindowKey, "late-afternoon-night");
  assert.match(preview.previewMessage, /Move Jordan Rivera to Late afternoon \/ evening/i);

  const executed = await platform.runProviderAssistantCommand(provider.id, {
    command: "Change my afternoon appointment to evening and notify the customer",
    bookingId: booking.id,
    execute: true
  });

  assert.equal(executed.executed, true);
  assert.ok(executed.updatedBooking);
  assert.equal(getBookingServiceWindow(executed.updatedBooking!.scheduledStartIso).key, "late-afternoon-night");
  assert.equal(executed.updatedBooking?.interventions.at(-1)?.action, "provider-assistant-reschedule");

  const notifications = await platform.listNotifications({
    userId: customer.id,
    email: customer.email,
    role: "customer"
  });
  assert.ok(
    notifications.notifications.some((notification) => notification.title === "Your service window was updated")
  );
});

test("provider assistant asks for booking selection when more than one booking matches the command", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-assistant-ambiguous@example.com",
    password: "Password123!",
    phone: "555-4382",
    role: "provider",
    companyName: "Prompt Lawn Co.",
    categories: ["lawn-mowing"],
    serviceRadiusMiles: 25,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-assistant-ambiguous@example.com",
    password: "Password123!",
    phone: "555-4383",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638)
  });

  const firstDay = new Date();
  firstDay.setDate(firstDay.getDate() + 4);
  firstDay.setHours(13, 0, 0, 0);
  const secondDay = new Date(firstDay.getTime() + 24 * 60 * 60 * 1000);

  await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: firstDay.toISOString(),
    scheduledEndIso: new Date(firstDay.getTime() + 60 * 60 * 1000).toISOString(),
    notes: "First afternoon booking",
    totalCents: 6200
  });
  await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("118 Garden Row", 30.2437, -97.76395),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: secondDay.toISOString(),
    scheduledEndIso: new Date(secondDay.getTime() + 60 * 60 * 1000).toISOString(),
    notes: "Second afternoon booking",
    totalCents: 6200
  });

  const response = await platform.runProviderAssistantCommand(provider.id, {
    command: "Change my afternoon appointment to evening and notify the customer",
    execute: false
  });

  assert.equal(response.understood, true);
  assert.equal(response.requiresBookingSelection, true);
  assert.equal(response.executed, false);
  assert.equal(response.bookingCandidates.length, 2);
});

test("provider assistant can send a late update with parsed delay timing", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-assistant-late@example.com",
    password: "Password123!",
    phone: "555-4384",
    role: "provider",
    companyName: "Prompt Lawn Co.",
    categories: ["lawn-mowing"],
    serviceRadiusMiles: 25,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-assistant-late@example.com",
    password: "Password123!",
    phone: "555-4385",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638)
  });

  const serviceDay = new Date();
  serviceDay.setDate(serviceDay.getDate() + 3);
  serviceDay.setHours(13, 0, 0, 0);
  const startIso = serviceDay.toISOString();
  const endIso = new Date(serviceDay.getTime() + 2 * 60 * 60 * 1000).toISOString();

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: startIso,
    scheduledEndIso: endIso,
    notes: "Assistant late update test",
    totalCents: 6200
  });

  const preview = await platform.runProviderAssistantCommand(provider.id, {
    command: "Tell my afternoon customer I am 30 minutes late because traffic",
    bookingId: booking.id,
    execute: false
  });

  assert.equal(preview.understood, true);
  assert.equal(preview.actionType, "mark-booking-late");
  assert.equal(preview.requiresConfirmation, true);
  assert.equal(preview.lateMinutes, 30);
  assert.ok(preview.lateEtaIso);
  assert.match(preview.previewMessage, /30 minutes behind/i);

  const executed = await platform.runProviderAssistantCommand(provider.id, {
    command: "Tell my afternoon customer I am 30 minutes late because traffic",
    bookingId: booking.id,
    execute: true
  });

  assert.equal(executed.executed, true);
  assert.equal(executed.actionType, "mark-booking-late");
  assert.ok(executed.updatedBooking?.lateEtaIso);
  assert.equal(executed.updatedBooking?.lateReason, "Traffic");
  assert.equal(executed.updatedBooking?.interventions.at(-1)?.action, "provider-assistant-late-update");

  const notifications = await platform.listNotifications({
    userId: customer.id,
    email: customer.email,
    role: "customer"
  });
  assert.ok(
    notifications.notifications.some((notification) => notification.title === "Your provider is running late")
  );
});

test("provider assistant can preview and confirm a requested booking", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-assistant-confirm@example.com",
    password: "Password123!",
    phone: "555-4385",
    role: "provider",
    companyName: "Prompt Lawn Co.",
    categories: ["lawn-mowing"],
    serviceRadiusMiles: 25,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-assistant-confirm@example.com",
    password: "Password123!",
    phone: "555-4384",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638)
  });

  const serviceDay = new Date();
  serviceDay.setDate(serviceDay.getDate() + 3);
  serviceDay.setHours(13, 0, 0, 0);
  const startIso = serviceDay.toISOString();
  const endIso = new Date(serviceDay.getTime() + 2 * 60 * 60 * 1000).toISOString();

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: startIso,
    scheduledEndIso: endIso,
    notes: "Assistant confirm test",
    totalCents: 6200
  });

  const preview = await platform.runProviderAssistantCommand(provider.id, {
    command: "Confirm my afternoon appointment",
    bookingId: booking.id,
    execute: false
  });

  assert.equal(preview.understood, true);
  assert.equal(preview.actionType, "confirm-booking");
  assert.equal(preview.requiresConfirmation, true);
  assert.match(preview.previewMessage, /confirm .* for/i);

  const executed = await platform.runProviderAssistantCommand(provider.id, {
    command: "Confirm my afternoon appointment",
    bookingId: booking.id,
    execute: true
  });

  assert.equal(executed.executed, true);
  assert.equal(executed.actionType, "confirm-booking");
  assert.equal(executed.updatedBooking?.status, "confirmed");
  assert.equal(executed.updatedBooking?.interventions.at(-1)?.action, "provider-assistant-confirm-booking");
});

test("provider assistant can preview and start a route from a natural-language command", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-assistant-route@example.com",
    password: "Password123!",
    phone: "555-4386",
    role: "provider",
    companyName: "Prompt Lawn Co.",
    categories: ["lawn-mowing"],
    serviceRadiusMiles: 25,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-assistant-route@example.com",
    password: "Password123!",
    phone: "555-4387",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638)
  });

  const serviceDay = new Date();
  serviceDay.setDate(serviceDay.getDate() + 3);
  serviceDay.setHours(13, 0, 0, 0);
  const startIso = serviceDay.toISOString();
  const endIso = new Date(serviceDay.getTime() + 2 * 60 * 60 * 1000).toISOString();

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: startIso,
    scheduledEndIso: endIso,
    notes: "Assistant route start test",
    totalCents: 6200
  });

  await platform.confirmBooking(provider.id, { bookingId: booking.id });

  const preview = await platform.runProviderAssistantCommand(provider.id, {
    command: "Start route for my afternoon appointment",
    bookingId: booking.id,
    execute: false
  });

  assert.equal(preview.understood, true);
  assert.equal(preview.actionType, "start-route");
  assert.equal(preview.requiresConfirmation, true);
  assert.match(preview.previewMessage, /on-my-way ETA/i);
  assert.match(preview.customerNotificationPreview ?? "", /Estimated arrival is about \d+ minutes?/i);
  assert.match(preview.customerNotificationPreview ?? "", /Live arrival tracking is available/i);

  const executed = await platform.runProviderAssistantCommand(provider.id, {
    command: "Start route for my afternoon appointment",
    bookingId: booking.id,
    execute: true
  });

  assert.equal(executed.executed, true);
  assert.equal(executed.actionType, "start-route");
  assert.ok(executed.updatedBooking?.onRouteConfirmedAt);
  assert.equal(executed.updatedBooking?.interventions.at(-1)?.action, "provider-assistant-start-route");
  assert.match(executed.previewMessage, /sent an on-my-way ETA/i);
  assert.match(executed.customerNotificationPreview ?? "", /Estimated arrival is about \d+ minutes?/i);

  const customerNotifications = await repository.listNotificationsByRecipient(customer.id);
  const onRouteNotification = customerNotifications.find(
    (notification) => notification.title === "Your crew is on the way"
  );
  assert.ok(onRouteNotification);
  assert.match(onRouteNotification.body, /Estimated arrival is about \d+ minutes?/i);
  assert.match(onRouteNotification.body, /Live arrival tracking is available/i);
  assert.match(onRouteNotification.actionHref ?? "", /tracking=1/);
});

test("provider assistant can preview and execute a confirm-then-route multi-step command", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-assistant-confirm-route@example.com",
    password: "Password123!",
    phone: "555-4394",
    role: "provider",
    companyName: "Prompt Lawn Co.",
    categories: ["lawn-mowing"],
    serviceRadiusMiles: 25,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-assistant-confirm-route@example.com",
    password: "Password123!",
    phone: "555-4395",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638)
  });

  const serviceDay = new Date();
  serviceDay.setDate(serviceDay.getDate() + 3);
  serviceDay.setHours(13, 0, 0, 0);
  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: serviceDay.toISOString(),
    scheduledEndIso: new Date(serviceDay.getTime() + 2 * 60 * 60 * 1000).toISOString(),
    notes: "Assistant multi-step confirm route test",
    totalCents: 6200
  });

  const preview = await platform.runProviderAssistantCommand(provider.id, {
    command: "Confirm my afternoon appointment and start route",
    bookingId: booking.id,
    execute: false
  });

  assert.equal(preview.understood, true);
  assert.deepEqual(preview.actionTypes, ["confirm-booking", "start-route"]);
  assert.equal(preview.requiresConfirmation, true);
  assert.match(preview.previewMessage, /Step 1:/);
  assert.match(preview.previewMessage, /Step 2:/);

  const executed = await platform.runProviderAssistantCommand(provider.id, {
    command: "Confirm my afternoon appointment and start route",
    bookingId: booking.id,
    execute: true
  });

  assert.equal(executed.executed, true);
  assert.deepEqual(executed.actionTypes, ["confirm-booking", "start-route"]);
  assert.equal(executed.updatedBooking?.status, "confirmed");
  assert.ok(executed.updatedBooking?.onRouteConfirmedAt);
  assert.equal(executed.updatedBooking?.interventions.at(-1)?.action, "provider-assistant-start-route");
});

test("provider assistant can send an arrived customer update without changing lifecycle state", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-assistant-arrived@example.com",
    password: "Password123!",
    phone: "555-4401",
    role: "provider",
    companyName: "Prompt Lawn Co.",
    categories: ["lawn-mowing"],
    serviceRadiusMiles: 25,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-assistant-arrived@example.com",
    password: "Password123!",
    phone: "555-4402",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638)
  });

  const serviceDay = new Date();
  serviceDay.setDate(serviceDay.getDate() + 3);
  serviceDay.setHours(13, 0, 0, 0);
  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: serviceDay.toISOString(),
    scheduledEndIso: new Date(serviceDay.getTime() + 2 * 60 * 60 * 1000).toISOString(),
    notes: "Assistant arrived update test",
    totalCents: 6200
  });

  await platform.confirmBooking(provider.id, { bookingId: booking.id });
  const onRoute = await platform.markBookingOnRoute(
    { userId: provider.id, email: provider.email, role: "provider" },
    { bookingId: booking.id }
  );

  const preview = await platform.runProviderAssistantCommand(provider.id, {
    command: "Tell the customer we arrived for my afternoon appointment",
    bookingId: booking.id,
    execute: false
  });

  assert.equal(preview.understood, true);
  assert.equal(preview.actionType, "start-route");
  assert.equal(preview.requiresConfirmation, true);
  assert.match(preview.previewMessage, /crew has arrived/i);
  assert.match(preview.customerNotificationPreview ?? "", /has arrived for your lawn mowing visit/i);

  const executed = await platform.runProviderAssistantCommand(provider.id, {
    command: "Tell the customer we arrived for my afternoon appointment",
    bookingId: booking.id,
    execute: true
  });

  assert.equal(executed.executed, true);
  assert.equal(executed.actionType, "start-route");
  assert.equal(executed.updatedBooking?.status, "confirmed");
  assert.equal(executed.updatedBooking?.onRouteConfirmedAt, onRoute.onRouteConfirmedAt);
  assert.equal(executed.updatedBooking?.interventions.at(-1)?.action, "provider-assistant-arrival-update");
  assert.match(executed.customerNotificationPreview ?? "", /keep following the visit/i);

  const customerNotifications = await repository.listNotificationsByRecipient(customer.id);
  const arrivalNotification = customerNotifications.find(
    (notification) => notification.title === "Your crew has arrived"
  );
  assert.ok(arrivalNotification);
  assert.match(arrivalNotification.body, /Prompt Lawn Co\. has arrived/i);
  assert.match(arrivalNotification.body, /keep following the visit/i);
  assert.match(arrivalNotification.actionHref ?? "", /tracking=1/);
});

test("provider assistant can preview and start work once route and before-photo requirements are met", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-assistant-work@example.com",
    password: "Password123!",
    phone: "555-4388",
    role: "provider",
    companyName: "Prompt Lawn Co.",
    categories: ["lawn-mowing"],
    serviceRadiusMiles: 25,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-assistant-work@example.com",
    password: "Password123!",
    phone: "555-4389",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638)
  });

  const serviceDay = new Date();
  serviceDay.setDate(serviceDay.getDate() + 3);
  serviceDay.setHours(13, 0, 0, 0);
  const startIso = serviceDay.toISOString();
  const endIso = new Date(serviceDay.getTime() + 2 * 60 * 60 * 1000).toISOString();

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: startIso,
    scheduledEndIso: endIso,
    notes: "Assistant start work test",
    totalCents: 6200
  });

  await platform.confirmBooking(provider.id, { bookingId: booking.id });

  const blockedPreview = await platform.runProviderAssistantCommand(provider.id, {
    command: "Start work for my afternoon appointment",
    bookingId: booking.id,
    execute: false
  });

  assert.equal(blockedPreview.understood, true);
  assert.equal(blockedPreview.actionType, "start-work");
  assert.equal(blockedPreview.requiresConfirmation, false);
  assert.match(blockedPreview.previewMessage, /start the route first/i);

  await platform.markBookingOnRoute(
    { userId: provider.id, email: provider.email, role: "provider" },
    { bookingId: booking.id }
  );
  await attachEvidence(platform, { userId: provider.id, email: provider.email, role: "provider" }, booking.id, "before");

  const preview = await platform.runProviderAssistantCommand(provider.id, {
    command: "Start work for my afternoon appointment",
    bookingId: booking.id,
    execute: false
  });

  assert.equal(preview.understood, true);
  assert.equal(preview.actionType, "start-work");
  assert.equal(preview.requiresConfirmation, true);
  assert.match(preview.previewMessage, /move the booking into the active job state/i);

  const executed = await platform.runProviderAssistantCommand(provider.id, {
    command: "Start work for my afternoon appointment",
    bookingId: booking.id,
    execute: true
  });

  assert.equal(executed.executed, true);
  assert.equal(executed.actionType, "start-work");
  assert.equal(executed.updatedBooking?.status, "in-progress");
  assert.equal(executed.updatedBooking?.interventions.at(-1)?.action, "provider-assistant-start-work");
});

test("provider assistant can preview and execute a route-then-work multi-step command", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-assistant-route-work@example.com",
    password: "Password123!",
    phone: "555-4396",
    role: "provider",
    companyName: "Prompt Lawn Co.",
    categories: ["lawn-mowing"],
    serviceRadiusMiles: 25,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-assistant-route-work@example.com",
    password: "Password123!",
    phone: "555-4397",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638)
  });

  const serviceDay = new Date();
  serviceDay.setDate(serviceDay.getDate() + 3);
  serviceDay.setHours(13, 0, 0, 0);
  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: serviceDay.toISOString(),
    scheduledEndIso: new Date(serviceDay.getTime() + 2 * 60 * 60 * 1000).toISOString(),
    notes: "Assistant multi-step route work test",
    totalCents: 6200
  });

  await platform.confirmBooking(provider.id, { bookingId: booking.id });
  await attachEvidence(platform, { userId: provider.id, email: provider.email, role: "provider" }, booking.id, "before");

  const preview = await platform.runProviderAssistantCommand(provider.id, {
    command: "Start route for my afternoon appointment and start work",
    bookingId: booking.id,
    execute: false
  });

  assert.equal(preview.understood, true);
  assert.deepEqual(preview.actionTypes, ["start-route", "start-work"]);
  assert.equal(preview.requiresConfirmation, true);

  const executed = await platform.runProviderAssistantCommand(provider.id, {
    command: "Start route for my afternoon appointment and start work",
    bookingId: booking.id,
    execute: true
  });

  assert.equal(executed.executed, true);
  assert.deepEqual(executed.actionTypes, ["start-route", "start-work"]);
  assert.equal(executed.updatedBooking?.status, "in-progress");
  assert.equal(executed.updatedBooking?.interventions.at(-1)?.action, "provider-assistant-start-work");
});

test("provider assistant can preview and execute a broader three-step same-booking chain", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-assistant-three-step@example.com",
    password: "Password123!",
    phone: "555-4398",
    role: "provider",
    companyName: "Prompt Lawn Co.",
    categories: ["lawn-mowing"],
    serviceRadiusMiles: 25,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });
  await verifyProviderCredentials(platform, provider.id, { includeWorkersComp: true });

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-assistant-three-step@example.com",
    password: "Password123!",
    phone: "555-4399",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638)
  });

  const crew = await platform.registerUser({
    fullName: "Morgan Crew",
    email: "crew-assistant-three-step@example.com",
    password: "Password123!",
    phone: "555-4400",
    role: "crew-member",
    address: createAddress("113 Garden Row", 30.24355, -97.76385),
    categories: ["lawn-mowing"],
    availableWeekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    willingToTravelMiles: 20
  });

  await platform.updateProviderSettings(provider.id, {
    serviceRadiusMiles: 25,
    staffingMode: "review-first",
    crewReviewLeadHours: 6,
    departureReminderLeadMinutes: 30,
    routeLeaderMode: "accepted-crew-fallback",
    sponsoredListingEnabled: provider.sponsoredListingEnabled
  });

  const serviceDay = new Date();
  serviceDay.setDate(serviceDay.getDate() + 3);
  serviceDay.setHours(13, 0, 0, 0);
  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: serviceDay.toISOString(),
    scheduledEndIso: new Date(serviceDay.getTime() + 2 * 60 * 60 * 1000).toISOString(),
    notes: "Assistant broader chain test",
    totalCents: 6200
  });

  const overview = await platform.getProviderStaffingOverview(provider.id);
  const job = overview.jobs.find((item) => item.bookingId === booking.id);
  const crewMatch = job?.matches.find((match) => match.crewMemberId === crew.id);
  assert.ok(crewMatch);

  const command =
    "Accept Morgan Crew for my afternoon appointment and make Morgan Crew the route leader and tell Morgan Crew to head to the equipment pickup first";

  const preview = await platform.runProviderAssistantCommand(provider.id, {
    command,
    bookingId: booking.id,
    execute: false
  });

  assert.equal(preview.understood, true);
  assert.deepEqual(preview.actionTypes, ["accept-crew-match", "assign-route-leader", "message-crew"]);
  assert.equal(preview.requiresConfirmation, true);
  assert.match(preview.previewMessage, /Step 1:/);
  assert.match(preview.previewMessage, /Step 2:/);
  assert.match(preview.previewMessage, /Step 3:/);

  const executed = await platform.runProviderAssistantCommand(provider.id, {
    command,
    bookingId: booking.id,
    execute: true
  });

  assert.equal(executed.executed, true);
  assert.deepEqual(executed.actionTypes, ["accept-crew-match", "assign-route-leader", "message-crew"]);
  assert.equal(executed.updatedBooking?.assignedRouteLeaderCrewMemberId, crew.id);
  assert.equal(executed.updatedBooking?.interventions.at(-1)?.action, "provider-assistant-message-crew");

  const staffingAfter = await platform.getProviderStaffingOverview(provider.id);
  const updatedJob = staffingAfter.jobs.find((item) => item.bookingId === booking.id);
  const updatedMatch = updatedJob?.matches.find((match) => match.crewMemberId === crew.id);
  assert.equal(updatedMatch?.status, "accepted");
  assert.equal(updatedJob?.assignedRouteLeaderCrewMemberId, crew.id);

  const providerThread = await platform.getProviderCrewConversationThread(
    { userId: provider.id, email: provider.email, role: "provider" },
    undefined,
    crewMatch!.id
  );
  assert.equal(providerThread.messages.length, 1);
  assert.equal(providerThread.messages[0]?.body, "Head to the equipment pickup first");
});

test("provider assistant can preview and complete a booking once after-photo requirements are met", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-assistant-complete@example.com",
    password: "Password123!",
    phone: "555-4390",
    role: "provider",
    companyName: "Prompt Lawn Co.",
    categories: ["lawn-mowing"],
    serviceRadiusMiles: 25,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-assistant-complete@example.com",
    password: "Password123!",
    phone: "555-4391",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638)
  });

  const serviceDay = new Date();
  serviceDay.setDate(serviceDay.getDate() + 3);
  serviceDay.setHours(13, 0, 0, 0);
  const startIso = serviceDay.toISOString();
  const endIso = new Date(serviceDay.getTime() + 2 * 60 * 60 * 1000).toISOString();

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: startIso,
    scheduledEndIso: endIso,
    notes: "Assistant complete test",
    totalCents: 6200
  });

  await platform.confirmBooking(provider.id, { bookingId: booking.id });

  const blockedPreview = await platform.runProviderAssistantCommand(provider.id, {
    command: "Complete my afternoon appointment",
    bookingId: booking.id,
    execute: false
  });

  assert.equal(blockedPreview.understood, true);
  assert.equal(blockedPreview.actionType, "complete-booking");
  assert.equal(blockedPreview.requiresConfirmation, false);
  assert.match(blockedPreview.previewMessage, /after photo/i);

  await attachEvidence(platform, { userId: provider.id, email: provider.email, role: "provider" }, booking.id, "after");

  const preview = await platform.runProviderAssistantCommand(provider.id, {
    command: "Complete my afternoon appointment",
    bookingId: booking.id,
    execute: false
  });

  assert.equal(preview.understood, true);
  assert.equal(preview.actionType, "complete-booking");
  assert.equal(preview.requiresConfirmation, true);
  assert.match(preview.previewMessage, /close out the service lifecycle/i);

  const executed = await platform.runProviderAssistantCommand(provider.id, {
    command: "Complete my afternoon appointment",
    bookingId: booking.id,
    execute: true
  });

  assert.equal(executed.executed, true);
  assert.equal(executed.actionType, "complete-booking");
  assert.equal(executed.updatedBooking?.status, "completed");
  assert.ok(executed.updatedBooking?.completedAt);
  assert.equal(executed.updatedBooking?.interventions.at(-1)?.action, "provider-assistant-complete-booking");
});

test("provider assistant can preview and report a booking exception with notes", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Ariana Flores",
    email: "provider-assistant-exception@example.com",
    password: "Password123!",
    phone: "555-4392",
    role: "provider",
    companyName: "Prompt Lawn Co.",
    categories: ["lawn-mowing"],
    serviceRadiusMiles: 25,
    address: createAddress("1400 Provider Way", 30.244, -97.764)
  });

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-assistant-exception@example.com",
    password: "Password123!",
    phone: "555-4393",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638)
  });

  const serviceDay = new Date();
  serviceDay.setDate(serviceDay.getDate() + 3);
  serviceDay.setHours(13, 0, 0, 0);
  const startIso = serviceDay.toISOString();
  const endIso = new Date(serviceDay.getTime() + 2 * 60 * 60 * 1000).toISOString();

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: startIso,
    scheduledEndIso: endIso,
    notes: "Assistant exception test",
    totalCents: 6200
  });

  const preview = await platform.runProviderAssistantCommand(provider.id, {
    command: "Mark my afternoon appointment no access because the gate is locked",
    bookingId: booking.id,
    execute: false
  });

  assert.equal(preview.understood, true);
  assert.equal(preview.actionType, "report-booking-exception");
  assert.equal(preview.requiresConfirmation, true);
  assert.match(preview.previewMessage, /log unable to access property/i);

  const executed = await platform.runProviderAssistantCommand(provider.id, {
    command: "Mark my afternoon appointment no access because the gate is locked",
    bookingId: booking.id,
    execute: true
  });

  assert.equal(executed.executed, true);
  assert.equal(executed.actionType, "report-booking-exception");
  assert.equal(executed.updatedBooking?.activeExceptionType, "unable-to-access-property");
  assert.equal(executed.updatedBooking?.activeExceptionNotes, "the gate is locked");
  assert.equal(executed.updatedBooking?.interventions.at(-1)?.action, "provider-assistant-report-exception");
});

test("new providers stay out of public search until ops approves verification", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Casey Warner",
    email: "provider-verification@example.com",
    password: "Password123!",
    phone: "555-4400",
    role: "provider",
    companyName: "Warner Grounds",
    categories: ["lawn-mowing", "leaf-blowing"],
    serviceRadiusMiles: 20,
    address: createAddress("118 Maple Ave", 30.2438, -97.7639)
  });
  assert.equal(provider.role, "provider");
  assert.equal(provider.verificationStatus, "pending-review");
  await verifyProviderCredentials(platform, provider.id);

  const queueBeforeReview = await platform.listProviderVerificationQueue();
  const queuedProvider = queueBeforeReview.find((item) => item.provider.id === provider.id);
  assert.ok(queuedProvider);
  assert.equal(queuedProvider?.guidance.recommendedAction, "manual-review");
  assert.ok(
    queuedProvider?.guidance.checklist.some((item) => item.key === "profile-completeness")
  );
  assert.ok(
    queuedProvider?.guidance.checklist.some(
      (item) => item.key === "experience-signal" && item.status === "review"
    )
  );
  assert.ok(
    queuedProvider?.guidance.checklist.some(
      (item) => item.key === "service-quality-expectations" && item.status === "review"
    )
  );
  assert.ok(
    queuedProvider?.guidance.checklist.some(
      (item) => item.key === "intervention-readiness" && item.status === "ready"
    )
  );

  const searchBeforeApproval = await platform.searchProviders({
    address: createAddress("112 Garden Row", 30.2435, -97.7638),
    categories: ["lawn-mowing"],
    dateIso: futureIso(48),
    estimatedDurationMinutes: 45
  });
  assert.equal(searchBeforeApproval.providers.some((item) => item.id === provider.id), false);

  await assert.rejects(
    () =>
      platform.reviewProviderVerification({
        providerId: provider.id,
        action: "approve",
        notes: "Business profile is complete and ready to go live."
      }),
    (error: unknown) =>
      error instanceof HttpError &&
      error.statusCode === 400 &&
      /launch-fit checks|ready to go live despite the checklist watchouts/i.test(error.message)
  );

  const approvedProvider = await platform.reviewProviderVerification({
    providerId: provider.id,
    action: "approve",
    notes:
      "Ops confirmed the provider can keep the Barnegat launch radius tight, respond to field exceptions quickly, and handle the lighter experience history with managed first-week oversight."
  });
  assert.equal(approvedProvider.verificationStatus, "verified");
  assert.ok(approvedProvider.verificationReviewedAt);

  const queueAfterReview = await platform.listProviderVerificationQueue();
  assert.equal(queueAfterReview.some((item) => item.provider.id === provider.id), false);

  const searchAfterApproval = await platform.searchProviders({
    address: createAddress("112 Garden Row", 30.2435, -97.7638),
    categories: ["lawn-mowing"],
    dateIso: futureIso(48),
    estimatedDurationMinutes: 45
  });
  assert.equal(searchAfterApproval.providers.some((item) => item.id === provider.id), true);
});

test("provider verification guidance flags missing launch-fit basics before go-live", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Riley Sparse",
    email: "provider-verification-thin@example.com",
    password: "Password123!",
    phone: "555-4499",
    role: "provider",
    companyName: "Sparse Launch Co.",
    categories: ["lawn-mowing"],
    serviceRadiusMiles: 45,
    address: createAddress("119 Maple Ave", 30.2438, -97.7639)
  });

  await repository.updateProvider(provider.id, {
    bio: "Reliable lawns.",
    yearsExperience: 0,
    minimumBookingLeadHours: 72
  });
  await verifyProviderCredentials(platform, provider.id);

  const queue = await platform.listProviderVerificationQueue();
  const queuedProvider = queue.find((item) => item.provider.id === provider.id);
  assert.ok(queuedProvider);
  assert.equal(queuedProvider?.guidance.recommendedAction, "reject");
  assert.ok(
    queuedProvider?.guidance.checklist.some(
      (item) => item.key === "launch-area-fit" && item.status === "missing"
    )
  );
  assert.ok(
    queuedProvider?.guidance.checklist.some(
      (item) => item.key === "experience-signal" && item.status === "missing"
    )
  );
  assert.ok(
    queuedProvider?.guidance.checklist.some(
      (item) => item.key === "service-quality-expectations" && item.status === "missing"
    )
  );
  assert.ok(
    queuedProvider?.guidance.warnings.some((warning) => /lead-time|launch pocket/i.test(warning))
  );
  assert.equal(queuedProvider?.onboardingPlan.stage, "fixes-needed");
  assert.ok(
    queuedProvider?.onboardingPlan.launchReadinessSignals.some((signal) =>
      /recommended verification action: reject/i.test(signal)
    )
  );
  assert.ok(
    queuedProvider?.onboardingPlan.steps.some(
      (step) =>
        step.key === "dispatch-settings" &&
        step.owner === "provider" &&
        step.status === "blocked" &&
        /automatically resubmits/i.test(step.automationTrigger ?? "")
    )
  );
  assert.ok(
    queuedProvider?.onboardingPlan.steps.some(
      (step) => step.key === "ops-review" && step.owner === "ops" && step.status === "blocked"
    )
  );

  await assert.rejects(
    () =>
      platform.reviewProviderVerification({
        providerId: provider.id,
        action: "approve",
        notes: "Provider looks ready for launch visibility."
      }),
    (error: unknown) =>
      error instanceof HttpError &&
      error.statusCode === 400 &&
      /specific missing launch-readiness gaps|safe right now/i.test(error.message)
  );

  const approvedProvider = await platform.reviewProviderVerification({
    providerId: provider.id,
    action: "approve",
    notes:
      "Ops is approving a narrow pilot because the provider agreed to reduce the service pocket immediately, tighten lead-time settings before first booking release, and stay on same-day support escalation for the first launch jobs."
  });
  assert.equal(approvedProvider.verificationStatus, "verified");
});

test("provider verification guidance blocks launch approval when incident history needs ops review", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Morgan Recovery",
    email: "provider-verification-incident@example.com",
    password: "Password123!",
    phone: "555-4420",
    role: "provider",
    companyName: "Recovery Ready Lawns",
    bio: "Launch-ready mowing and cleanup with photo-backed communication, fast issue recovery, and clear customer follow-through.",
    yearsExperience: 6,
    categories: ["lawn-mowing", "seasonal-cleanup"],
    serviceRadiusMiles: 18,
    address: createAddress("121 Maple Ave", 30.2438, -97.7639)
  });
  assert.equal(provider.role, "provider");
  await verifyProviderCredentials(platform, provider.id);

  const customer = await platform.registerUser({
    fullName: "Jordan Incident",
    email: "customer-verification-incident@example.com",
    password: "Password123!",
    phone: "555-4421",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638)
  });
  assert.equal(customer.role, "customer");

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(72),
    scheduledEndIso: futureIso(73),
    notes: "Incident verification coverage",
    totalCents: 6800
  });
  await repository.updateBooking(booking.id, {
    status: "disputed",
    disputedAt: new Date().toISOString(),
    disputeReason: "Customer reported incomplete recovery from a prior service issue.",
    disputedByRole: "customer"
  });

  const queue = await platform.listProviderVerificationQueue();
  const queuedProvider = queue.find((item) => item.provider.id === provider.id);
  assert.ok(queuedProvider);
  assert.equal(queuedProvider?.guidance.recommendedAction, "reject");
  assert.ok(
    queuedProvider?.guidance.checklist.some(
      (item) => item.key === "incident-history" && item.status === "missing"
    )
  );
  assert.ok(
    queuedProvider?.guidance.warnings.some((warning) => /dispute and refund history/i.test(warning))
  );

  const profile = await platform.getProviderProfile(provider.id);
  assert.ok(
    profile.verificationSummary?.nextSteps.some((step) => /document recent disputes/i.test(step))
  );

  await assert.rejects(
    () =>
      platform.reviewProviderVerification({
        providerId: provider.id,
        action: "approve",
        notes: "Provider looks ready for launch visibility."
      }),
    (error: unknown) =>
      error instanceof HttpError &&
      error.statusCode === 400 &&
      /specific missing launch-readiness gaps|safe right now/i.test(error.message)
  );

  const approvedProvider = await platform.reviewProviderVerification({
    providerId: provider.id,
    action: "approve",
    notes:
      "Ops reviewed the disputed booking history, confirmed the customer recovery plan with the provider, documented how future evidence and support handoffs will work, and approved a narrow monitored launch pilot."
  });
  assert.equal(approvedProvider.verificationStatus, "verified");
});

test("provider profiles include backend-authored verification next steps while pending review", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Jamie Pending",
    email: "provider-pending-summary@example.com",
    password: "Password123!",
    phone: "555-4411",
    role: "provider",
    companyName: "Pending Pocket Lawns",
    categories: ["lawn-mowing"],
    serviceRadiusMiles: 35,
    address: createAddress("120 Maple Ave", 30.2438, -97.7639)
  });
  await verifyProviderCredentials(platform, provider.id);

  const profile = await platform.getProviderProfile(provider.id);
  assert.equal(profile.verificationStatus, "pending-review");
  assert.ok(profile.verificationSummary);
  assert.match(profile.verificationSummary?.headline ?? "", /pending review/i);
  assert.ok(
    profile.verificationSummary?.nextSteps.some((step) => /service radius|launch pocket/i.test(step))
  );
  assert.ok(
    profile.verificationSummary?.checklist.some(
      (item) => item.key === "launch-area-fit" && item.status === "review"
    )
  );
  assert.equal(profile.verificationSummary?.onboardingPlan.stage, "ops-review");
  assert.ok(
    profile.verificationSummary?.onboardingPlan.steps.some(
      (step) => step.key === "profile-fixes" && step.status === "pending"
    )
  );
  assert.ok(
    profile.verificationSummary?.onboardingPlan.steps.some(
      (step) => step.key === "ops-review" && step.status === "ready"
    )
  );
  assert.ok(
    profile.verificationSummary?.onboardingPlan.automationActions.some(
      (action) =>
        action.key === "ops-review-launch-fit" &&
        action.owner === "ops" &&
        action.status === "ready" &&
        action.priority === "high" &&
        action.blockedByStepKeys.length === 0 &&
        action.actionHref === "/ops/providers"
    )
  );
  assert.ok(
    profile.verificationSummary?.onboardingPlan.automationActions.some(
      (action) =>
        action.key === "ops-approve-narrow-pilot" &&
        action.status === "blocked" &&
        action.blockedByStepKeys.includes("ops-review")
    )
  );
  assert.equal(profile.businessControls?.teamAccessMode, "owner-only");
  assert.equal(profile.businessControls?.teamPermissionsStatus, "owner-only");
  assert.ok(
    profile.businessControls?.ownerManagedControls.includes("business profile")
  );
  assert.ok(
    profile.businessControls?.opsManagedControls.includes("provider verification")
  );
  assert.ok(
    profile.businessControls?.freshReauthRequiredControls.includes("future bank account changes")
  );
  assert.ok(
    profile.businessControls?.warnings.some((warning) => /visibility remains gated/i.test(warning))
  );
});

test("provider onboarding automation sweep sends due action notifications idempotently", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const opsUser = await platform.registerUser({
    fullName: "Owen Onboarding",
    email: "ops-onboarding-sweep@example.com",
    password: "Password123!",
    phone: "555-4510",
    role: "ops",
    address: createAddress("101 Ops Way", 30.2441, -97.7641)
  });
  assert.equal(opsUser.role, "ops");
  const opsActor = {
    userId: opsUser.id,
    email: opsUser.email,
    role: "ops" as const,
    sessionVersion: 1
  };

  const submittedAt = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
  const blockedProvider = await platform.registerUser({
    fullName: "Parker Fixes",
    email: "provider-onboarding-fixes@example.com",
    password: "Password123!",
    phone: "555-4511",
    role: "provider",
    companyName: "Fixes Needed Lawns",
    categories: ["lawn-mowing"],
    serviceRadiusMiles: 45,
    address: createAddress("122 Maple Ave", 30.2438, -97.7639)
  });
  assert.equal(blockedProvider.role, "provider");
  await repository.updateProvider(blockedProvider.id, {
    bio: "Too short.",
    yearsExperience: 0,
    minimumBookingLeadHours: 72,
    verificationSubmittedAt: submittedAt
  });

  const blockedSweep = await platform.processProviderOnboardingAutomation(opsActor, {
    providerId: blockedProvider.id,
    asOfIso: new Date().toISOString()
  });
  assert.equal(blockedSweep.providerCount, 1);
  assert.ok(blockedSweep.sentNotificationCount >= 2);
  assert.ok(
    blockedSweep.items.some(
      (item) =>
        item.actionKey === "provider-complete-profile" &&
        item.recipientId === blockedProvider.id &&
        item.recipientRole === "provider" &&
        item.notificationStatus === "sent" &&
        item.notificationId
    )
  );
  assert.ok(
    blockedSweep.items.some(
      (item) => item.actionKey === "ops-review-launch-fit" && item.notificationStatus === "blocked"
    )
  );
  const providerNotifications = await repository.listNotificationsByRecipient(blockedProvider.id);
  assert.ok(
    providerNotifications.some(
      (notification) =>
        notification.title === "Provider profile fixes are due" &&
        notification.body.includes(`Onboarding automation: ${blockedProvider.id}/provider-complete-profile`)
    )
  );

  const repeatedBlockedSweep = await platform.processProviderOnboardingAutomation(opsActor, {
    providerId: blockedProvider.id,
    asOfIso: new Date().toISOString()
  });
  assert.equal(repeatedBlockedSweep.sentNotificationCount, 0);
  assert.ok(repeatedBlockedSweep.alreadySentCount >= 2);
  assert.ok(
    repeatedBlockedSweep.items.some(
      (item) =>
        item.actionKey === "provider-complete-profile" &&
        item.notificationStatus === "already-sent"
    )
  );

  const readyProvider = await platform.registerUser({
    fullName: "Quinn Ready",
    email: "provider-onboarding-ready@example.com",
    password: "Password123!",
    phone: "555-4512",
    role: "provider",
    companyName: "Ready Launch Lawns",
    bio: "Launch-ready mowing and cleanup with careful communication, photo-backed updates, and reliable service recovery.",
    yearsExperience: 6,
    categories: ["lawn-mowing", "seasonal-cleanup"],
    serviceRadiusMiles: 18,
    address: createAddress("123 Maple Ave", 30.2438, -97.7639)
  });
  assert.equal(readyProvider.role, "provider");
  await verifyProviderCredentials(platform, readyProvider.id);
  await repository.updateProvider(readyProvider.id, {
    verificationSubmittedAt: submittedAt,
    minimumBookingLeadHours: 12
  });

  const readySweep = await platform.processProviderOnboardingAutomation(opsActor, {
    providerId: readyProvider.id,
    asOfIso: new Date().toISOString()
  });
  assert.ok(
    readySweep.items.some(
      (item) =>
        item.actionKey === "ops-review-launch-fit" &&
        item.recipientRole === "ops" &&
        item.notificationStatus === "sent" &&
        item.actionHref === "/ops/providers"
    )
  );
  assert.ok(
    readySweep.items.some(
      (item) =>
        item.actionKey === "ops-approve-narrow-pilot" &&
        item.recipientRole === "ops" &&
        item.notificationStatus === "sent"
    )
  );
  const opsNotifications = await repository.listNotificationsByRecipient(opsUser.id);
  assert.ok(
    opsNotifications.some(
      (notification) =>
        notification.title === "Provider verification is ready for review" &&
        notification.body.includes(`Onboarding automation: ${readyProvider.id}/ops-review-launch-fit`)
    )
  );

  await assert.rejects(
    () =>
      platform.processProviderOnboardingAutomation(
        {
          userId: readyProvider.id,
          email: readyProvider.email,
          role: "provider",
          sessionVersion: 1
        },
        { providerId: readyProvider.id }
      ),
    /Only operations can process provider onboarding automation/i
  );
});

test("rejected providers are automatically resubmitted when they update business profile details", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const opsUser = await platform.registerUser({
    fullName: "Olivia Ops",
    email: "ops-provider-resubmission@example.com",
    password: "Password123!",
    phone: "555-4410",
    role: "ops",
    address: createAddress("100 Ops Way", 30.244, -97.764)
  });
  assert.equal(opsUser.role, "ops");

  const provider = await platform.registerUser({
    fullName: "Taylor Retry",
    email: "provider-retry-profile@example.com",
    password: "Password123!",
    phone: "555-4412",
    role: "provider",
    companyName: "Retry Lawns",
    categories: ["lawn-mowing"],
    serviceRadiusMiles: 25,
    address: createAddress("121 Maple Ave", 30.2438, -97.7639)
  });
  await verifyProviderCredentials(platform, provider.id);

  await repository.updateProvider(provider.id, {
    bio: "Short bio.",
    yearsExperience: 0
  });

  const rejectedProvider = await platform.reviewProviderVerification({
    providerId: provider.id,
    action: "reject",
    notes: "Add more detail about experience and the customer-facing service quality standard before relaunch."
  });
  assert.equal(rejectedProvider.verificationStatus, "rejected");

  const resubmittedProvider = await platform.updateProviderProfile(provider.id, {
    companyName: "Retry Lawns and Cleanup",
    bio: "Weekly mowing and seasonal cleanup with careful communication, photo-backed field updates, and launch-ready customer follow-through.",
    yearsExperience: 4,
    categories: ["lawn-mowing", "seasonal-cleanup"]
  });

  assert.equal(resubmittedProvider.verificationStatus, "pending-review");
  assert.equal(resubmittedProvider.companyName, "Retry Lawns and Cleanup");
  assert.equal(resubmittedProvider.yearsExperience, 4);
  assert.ok(resubmittedProvider.verificationSubmittedAt);
  assert.match(resubmittedProvider.verificationSummary?.headline ?? "", /back in review/i);
  assert.match(
    resubmittedProvider.verificationSummary?.summary ?? "",
    /last review note: add more detail about experience/i
  );
  assert.equal(resubmittedProvider.verificationSummary?.onboardingPlan.stage, "ready-for-approval");
  assert.match(
    resubmittedProvider.verificationSummary?.onboardingPlan.recommendedAutomation ?? "",
    /approve verification/i
  );
  assert.ok(
    resubmittedProvider.verificationSummary?.onboardingPlan.steps.some(
      (step) => step.key === "launch-pilot" && step.status === "ready"
    )
  );
  assert.ok(
    resubmittedProvider.verificationSummary?.onboardingPlan.automationActions.some(
      (action) =>
        action.key === "ops-approve-narrow-pilot" &&
        action.owner === "ops" &&
        action.status === "ready" &&
        action.priority === "normal" &&
        action.blockedByStepKeys.length === 0 &&
        action.actionHref === "/ops/providers"
    )
  );
  assert.ok(
    resubmittedProvider.verificationSummary?.onboardingPlan.automationActions.some(
      (action) =>
        action.key === "provider-complete-profile" &&
        action.status === "completed" &&
        action.blockedByStepKeys.length === 0
    )
  );

  const opsNotifications = await repository.listNotificationsByRecipient(opsUser.id);
  assert.ok(
    opsNotifications.some(
      (notification) =>
        notification.recipientRole === "ops" &&
        notification.title === "Provider verification resubmitted" &&
        /profile and service-scope updates/i.test(notification.body) &&
        notification.actionHref === "/ops/providers"
    )
  );
});

test("rejected providers are automatically resubmitted when they fix launch settings", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  const provider = await platform.registerUser({
    fullName: "Morgan Dispatch",
    email: "provider-retry-settings@example.com",
    password: "Password123!",
    phone: "555-4413",
    role: "provider",
    companyName: "Dispatch Retry Co.",
    categories: ["lawn-mowing"],
    serviceRadiusMiles: 45,
    address: createAddress("122 Maple Ave", 30.2438, -97.7639)
  });

  await repository.updateProvider(provider.id, {
    bio: "Launch-ready mowing and cleanup support with clear customer updates.",
    yearsExperience: 4,
    minimumBookingLeadHours: 72,
    crewReviewLeadHours: 6,
    departureReminderLeadMinutes: 10
  });

  const rejectedProvider = await platform.reviewProviderVerification({
    providerId: provider.id,
    action: "reject",
    notes: "Tighten the launch radius and staffing-response settings before this business goes live."
  });
  assert.equal(rejectedProvider.verificationStatus, "rejected");

  const resubmittedProvider = await platform.updateProviderSettings(provider.id, {
    serviceRadiusMiles: 20,
    minimumBookingLeadHours: 24,
    staffingMode: "review-first",
    crewReviewLeadHours: 24,
    departureReminderLeadMinutes: 45
  });

  assert.equal(resubmittedProvider.verificationStatus, "pending-review");
  assert.equal(resubmittedProvider.serviceRadiusMiles, 20);
  assert.equal(resubmittedProvider.minimumBookingLeadHours, 24);
  assert.match(
    resubmittedProvider.verificationSummary?.summary ?? "",
    /last review note: tighten the launch radius/i
  );
});

test("ops summary reports refund reviews and active booking exceptions", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(
    repository,
    new DataEngineeringLogger(),
    createFakeStripeGateway()
  );

  const provider = await platform.registerUser({
    fullName: "Dana Green",
    email: "provider-ops-summary@example.com",
    password: "Password123!",
    phone: "555-4700",
    role: "provider",
    companyName: "Green Ops Co.",
    categories: ["lawn-mowing"],
    serviceRadiusMiles: 25,
    address: createAddress("180 Service Ln", 30.244, -97.764)
  });
  assert.equal(provider.role, "provider");

  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "customer-ops-summary@example.com",
    password: "Password123!",
    phone: "555-4800",
    role: "customer",
    propertyLabel: "Primary home",
    address: createAddress("112 Garden Row", 30.2435, -97.7638)
  });
  assert.equal(customer.role, "customer");

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("112 Garden Row", 30.2435, -97.7638),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(72),
    scheduledEndIso: futureIso(73),
    notes: "Ops summary coverage",
    totalCents: 6800
  });

  await platform.confirmBooking(provider.id, { bookingId: booking.id });
  await attachEvidence(
    platform,
    { userId: provider.id, email: provider.email, role: "provider" },
    booking.id,
    "after"
  );
  await platform.completeBooking(provider.id, { bookingId: booking.id });
  const checkoutPayment = await platform.createCheckoutSession(customer.id, { bookingId: booking.id });
  const finalizedPayment = await platform.finalizeCheckoutSession(customer.id, {
    checkoutSessionId: checkoutPayment.payment.checkoutSessionId ?? ""
  });

  const exceptionBooking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: createAddress("114 Garden Row", 30.2437, -97.7637),
    servicePropertyId: customer.defaultPropertyId,
    category: "lawn-mowing",
    scheduledStartIso: futureIso(96),
    scheduledEndIso: futureIso(97),
    notes: "Ops summary exception coverage",
    totalCents: 6900
  });

  await platform.confirmBooking(provider.id, { bookingId: exceptionBooking.id });

  await platform.createRefund(
    { userId: customer.id, email: customer.email, role: "customer" },
    { paymentId: finalizedPayment.id, reason: "Service quality review requested." }
  );

  await platform.markBookingException(provider.id, {
    bookingId: exceptionBooking.id,
    exceptionType: "service-could-not-be-completed",
    notes: "Rain interrupted the service before completion."
  });

  const summary = await platform.getOpsFinancialExceptionSummary();
  assert.equal(summary.refundReviewOpenCount, 1);
  assert.equal(summary.payoutHoldCount, 1);
  assert.equal(summary.activeBookingExceptionCount, 1);
  assert.equal(summary.openBillingTicketCount, 1);
  assert.equal(summary.payoutHolds.length, 1);
  assert.equal(summary.payoutHolds[0]?.holdReason, "refund-review");
  assert.equal(summary.payoutHolds[0]?.bookingId, booking.id);
  assert.ok(summary.refundReviews.some((item) => item.bookingId === booking.id));
  assert.ok(summary.activeExceptions.some((item) => item.bookingId === exceptionBooking.id));
});

test("public marketplace overview returns only verified providers and live aggregate stats", async () => {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());
  const customer = await platform.registerUser({
    fullName: "Jordan Rivera",
    email: "public-overview-customer@example.com",
    password: "Password123!",
    phone: "555-0101",
    role: "customer",
    propertyLabel: "Home",
    address: createAddress()
  });

  const verifiedProviders = (await repository.listProviders()).filter(
    (provider) => provider.verificationStatus === "verified"
  );
  const provider = verifiedProviders[0];
  assert.ok(provider);

  const booking = await platform.createBooking(customer.id, {
    providerId: provider.id,
    serviceAddress: {
      line1: "45 Bayview Ave",
      city: "Barnegat",
      state: "NJ",
      postalCode: "08005",
      country: "US",
      point: {
        latitude: 39.7532,
        longitude: -74.2229
      }
    },
    category: provider.categories[0] ?? "lawn-mowing",
    scheduledStartIso: futureIso(72),
    scheduledEndIso: futureIso(73),
    notes: "Public overview review coverage booking"
  });

  await platform.confirmBooking(provider.id, { bookingId: booking.id });
  await attachEvidence(
    platform,
    { userId: provider.id, email: provider.email, role: "provider" },
    booking.id,
    "after"
  );
  await platform.completeBooking(provider.id, { bookingId: booking.id });
  await platform.processReviewInvites({ nowIso: futureIso(96) });

  const review = await platform.createProviderReview(customer.id, {
    bookingId: booking.id,
    overallRating: 5,
    timelinessRating: 5,
    attentionToDetailRating: 5,
    reviewText: "The crew was on time, careful around the beds, and the lawn looked great."
  });

  const overview = await platform.getPublicMarketplaceOverview();

  assert.equal(overview.verifiedProviderCount, verifiedProviders.length);
  assert.equal(overview.featuredProviders.length, Math.min(verifiedProviders.length, 6));
  assert.equal(overview.topRatedProviders.length, Math.min(verifiedProviders.length, 8));
  assert.equal(overview.mostOnTimeProviders.length, Math.min(verifiedProviders.length, 8));
  assert.ok(overview.averageRating >= 0);
  assert.ok(overview.activeCategoryCount > 0);
  assert.equal(overview.launchPricingPolicy.pricingModel, "hybrid-managed-marketplace");
  assert.equal(overview.launchPricingPolicy.introductoryOffer.appliesTo, "first-completed-service");
  assert.ok(overview.launchPricingPolicy.launchServiceCategories.includes("lawn-mowing"));
  assert.ok(
    overview.launchPricingPolicy.customerPricingPrinciples.some((principle) =>
      /managed-marketplace price/i.test(principle)
    )
  );
  assert.ok(
    overview.launchPricingPolicy.providerEconomicsPrinciples.some((principle) =>
      /silently compressing provider net payouts/i.test(principle)
    )
  );
  assert.match(overview.launchPricingPolicy.providerFacingExplanation, /YardMatch sets the customer-facing launch price/i);
  assert.equal(
    overview.featuredProviders.every((provider) =>
      verifiedProviders.some((candidate) => candidate.id === provider.id)
    ),
    true
  );
  assert.equal(
    overview.topRatedProviders.every((provider) =>
      verifiedProviders.some((candidate) => candidate.id === provider.id)
    ),
    true
  );
  assert.equal(
    overview.mostOnTimeProviders.every((provider) =>
      verifiedProviders.some((candidate) => candidate.id === provider.id)
    ),
    true
  );
  assert.equal(
    overview.highlightedReviews.every((highlightedReview) =>
      verifiedProviders.some((candidate) => candidate.id === highlightedReview.providerId)
    ),
    true
  );
  assert.ok(
    overview.highlightedReviews.some(
      (highlightedReview) =>
        highlightedReview.reviewId === review.id &&
        highlightedReview.providerId === provider.id &&
        highlightedReview.providerCompanyName === provider.companyName
    )
  );
  const barnegatCoverage = overview.coverageAreas.find(
    (area) => area.city === "Barnegat" && area.state === "NJ"
  );
  assert.ok(barnegatCoverage);
  assert.equal(barnegatCoverage?.verifiedProviderCount, 1);
  assert.equal(barnegatCoverage?.completedBookingCount, 1);
  assert.equal(barnegatCoverage?.recentCompletedBookingCount, 1);
  assert.ok(barnegatCoverage?.supportedCategories.includes(provider.categories[0] ?? "lawn-mowing"));
});
