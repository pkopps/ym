import { createHash } from "node:crypto";
import { DataEngineeringLogger } from "@yardmatch/analytics";
import {
  ActiveSession,
  AddBookingEvidenceRequest,
  AssignBookingRouteLeaderRequest,
  AppNotification,
  AnalyticsEvent,
  Address,
  AvailabilitySlot,
  BookingEvidenceEntry,
  CancelBookingRequest,
  CancelCrewMatchRequest,
  CancelRecurringServicePlanRequest,
  BookingArrivalTracking,
  CompleteBookingRequest,
  ConfirmBookingRequest,
  CreateOpsAccountResponse,
  CreateOpsAccountRequest,
  CreateLaunchOperationsTaskRequest,
  CreateLaunchOperationsTaskResponse,
  CreateOpsBookingInterventionRequest,
  CreateOpsPayoutDisbursementRunRequest,
  CreateOpsPayoutDisbursementRunResponse,
  CrewAvailabilityDay,
  CrewMatchCandidate,
  CrewMatchesResponse,
  CustomerProviderConversation,
  CustomerProviderConversationThread,
  CustomerProviderMessage,
  getBookingExceptionLabel,
  formatBookingWindowSummary,
  getBookingServiceWindow,
  MarkBookingExceptionRequest,
  MarkBookingLateRequest,
  MarkBookingOnRouteRequest,
  MarkNotificationsReadRequest,
  NotificationChannel,
  NotificationDeliveriesResponse,
  NotificationDeliveryRecord,
  NotificationOpsAlert,
  NotificationOpsChannelHealth,
  NotificationOpsDeliveryPolicy,
  NotificationOpsEscalationResponse,
  NotificationOpsHealthResponse,
  NotificationOpsRetrySweepResponse,
  OpsBookingExceptionSummaryItem,
  OpsAccountSummary,
  OpsAccessAuditItem,
  OpsAccessAlertItem,
  OpsAccessChangeKind,
  OpsAccessGovernancePolicy,
  OpsAccessHistoryEntry,
  OpsAuthenticationAuditItem,
  OpsAuthenticationHistoryEntry,
  OpsAuthenticationMethod,
  OpsFailedAuthenticationReason,
  OpsFailedSignInAuditItem,
  OpsInternalScope,
  OpsFinancialExceptionSummaryResponse,
  OpsPayoutHoldSummaryItem,
  OpsPayoutDisbursementRunsResponse,
  OpsPayoutRunPreviewResponse,
  OpsRefundSummaryItem,
  OpsSignInAuditItem,
  ProviderCrewConversation,
  ProviderCrewConversationThread,
  ProviderCrewMessage,
  ProviderPayoutLedgerEntry,
  ProviderPayoutLedgerResponse,
  PublicMarketplaceOverviewResponse,
  PublicMarketplaceHighlightedReview,
  PublicMarketplaceCoverageArea,
  CrewOpportunity,
  CrewPayoutLedgerEntry,
  CrewPayoutLedgerResponse,
  CustomerRetentionOpportunity,
  CustomerReviewOpportunity,
  CreateProviderReviewRequest,
  EscalateReviewSupportRequest,
  CreateCustomerPropertyRequest,
  CreateBookingRequest,
  CreateRecurringServicePlanRequest,
  CreateRecurringServicePlanResponse,
  CreateBookingDisputeRequest,
  CreateExternalCalendarImportRequest,
  CreateCheckoutSessionRequest,
  CreateCheckoutSessionResponse,
  InstantQuoteRequest,
  InstantQuoteResponse,
  LaunchPricingPolicy,
  InboundAutomationActivityItem,
  InboundAutomationEscalationResponse,
  InboundAutomationAlertItem,
  InboundAutomationSourceKey,
  InboundAutomationSourceMetric,
  ListCustomerRetentionOpportunitiesResponse,
  ListCustomerReviewOpportunitiesResponse,
  ListRecurringServicePlansResponse,
  CreatePaymentIntentRequest,
  CreateOpsRefundOverrideRequest,
  FinalizeCheckoutSessionRequest,
  ProcessReviewInvitesRequest,
  ProcessReviewInvitesResponse,
  ProcessProviderOnboardingAutomationRequest,
  RequestPasswordResetRequest,
  RequestPasswordResetResponse,
  CreateRefundRequest,
  CreateInboundEmailLaunchLeadRequest,
  CreateInboundGoogleBusinessProfileLeadRequest,
  CreateInboundGoogleBusinessProfileReviewResponseRequest,
  CreateInboundLaunchLeadRequest,
  CreateInboundReviewResponseRequest,
  CreateInboundReferralLaunchLeadRequest,
  CreateInboundSharedInboxReviewResponseRequest,
  CreateLaunchLeadRequest,
  CreateSupportTicketRequest,
  LaunchLeadReplyTemplate,
  LaunchLeadResponseGuidance,
  LaunchOperationsCoverageActionRecommendation,
  LaunchOperationsTask,
  LaunchOperationsTaskEscalationSweepItem,
  LaunchOperationsTaskEscalationSweepResponse,
  LaunchOperationsTaskNotificationSweepItem,
  LaunchOperationsTaskNotificationSweepResponse,
  LaunchOperationsTasksResponse,
  OpsAutomationRunRecord,
  OpsAutomationRunResponse,
  OpsAutomationRunsResponse,
  OpsAutomationSweepKey,
  OpsAutomationSweepRunItem,
  ProcessLaunchOperationsTaskEscalationsRequest,
  ProcessLaunchOperationsTaskNotificationsRequest,
  ProcessOpsAutomationRunRequest,
  UpdateLaunchLeadRequest,
  UpdateLaunchOperationsTaskRequest,
  UpdateLaunchOperationsTaskResponse,
  UpdateSupportTicketRequest,
  Booking,
  BookingStatus,
  BookingServiceWindowKey,
  BookingInterventionRecord,
  BookingRouteStop,
  CrewMemberProfile,
  CrewMemberSchedulePreference,
  CustomerProperty,
  ObservabilityOverview,
  CustomerProfile,
  CurrentUserResponse,
  OpsProfile,
  NotificationListResponse,
  NotificationPreferences,
  PaymentRecord,
  ProviderEconomicsSearchSummary,
  ProviderServiceFitSearchSummary,
  OpsReviewResponseItem,
  ProviderAssistantActionType,
  ProviderAssistantBookingCandidate,
  ProviderAssistantCommandRequest,
  ProviderAssistantCommandResponse,
  ProviderAssistantStaffingPlanItem,
  ProviderOnboardingAutomationAction,
  ProviderOnboardingAutomationSweepResponse,
  ProviderOnboardingAutomationSweepItem,
  PushDevice,
  RecurringServicePlan,
  RecurringServicePlanSummary,
  ProviderProfile,
  ProviderConnectAccount,
  ProviderConnectOnboardingResponse,
  ProviderConnectStatusResponse,
  ProviderVerificationStatusSummary,
  ProviderVerificationQueueItem,
  ExternalCalendarBlock,
  ExternalCalendarSubscription,
  ProviderReview,
  ReviewBookingEvidenceForOpsRequest,
  ProviderStaffingJobSummary,
  ProviderStaffingOverview,
  ProviderCalendarSubscriptionResponse,
  ProviderCalendarSubscriptionAction,
  ProviderCalendarImportsResponse,
  ProviderCalendarSyncHealth,
  SyncStaleProviderCalendarImportsResponse,
  ProviderCalendarOverviewResponse,
  ProviderDispatchRangeSummary,
  ProviderDispatchRouteStatus,
  PlaceSearchResponse,
  RequestOpsAccountPasswordResetResponse,
  RegisterUserRequest,
  RotateOpsAccountSessionsRequest,
  ReviewProviderVerificationRequest,
  ReviewProviderCredentialRequest,
  SubmitProviderCredentialRequest,
  ProviderCredential,
  ReviewCrewMatchRequest,
  RemoveExternalCalendarImportRequest,
  RescheduleBookingRequest,
  ReviewInvite,
  ReviewInviteDispatch,
  ReviewResponseChannelMetadata,
  LaunchLead,
  LaunchLeadBookingMatch,
  LaunchLeadChannelMetadata,
  LaunchLeadStatus,
  LaunchLeadLossReason,
  LaunchLeadSourceChannel,
  LaunchLeadContactPreference,
  ClearBookingRouteStopRequest,
  SendCustomerProviderMessageRequest,
  SendProviderCrewMessageRequest,
  SetBookingRouteStopRequest,
  SetDefaultCustomerPropertyRequest,
  SessionHeartbeatRequest,
  SearchProvidersRequest,
  SearchProviderResult,
  SearchProvidersResponse,
  ClaimPublicCrewOpportunityRequest,
  SelectPublicCrewOpportunityRequest,
  SelectPublicCrewOpportunityResponse,
  StartBookingRequest,
  ConfirmPasswordResetRequest,
  UpdateBookingRouteLocationRequest,
  UpdateCrewPreferencesRequest,
  UpdateNotificationPreferencesRequest,
  UpdateProviderProfileRequest,
  RegisterPushDeviceRequest,
  RemovePushDeviceRequest,
  ProcessSupportOpsTicketEscalationsRequest,
  UpdateProviderSettingsRequest,
  SupportTicket,
  LaunchAttributionContext,
  SensitiveActionPolicy,
  SensitiveActionPolicyItem,
  SupportTimelineActorRole,
  SupportTimelineEntry,
  SupportOpsTicket,
  SupportOpsTicketEscalationSweepItem,
  SupportOpsTicketEscalationSweepResponse,
  OpsLaunchLead,
  UpdateReviewResponseRequest,
  SyncExternalCalendarImportRequest,
  UpdateBookingAddressRequest,
  UpdateBookingPhotoMarketingUseRequest,
  UpdateOpsAccountAccessRequest,
  UpdateOpsAccountRequest,
  UpdateBookingAddressResponse
} from "@yardmatch/contracts";
import {
  BookingAddressPolicyService,
  BookingLifecycleService,
  GeoService,
  InstantQuoteEngine,
  PropertyBookService,
  ProviderMatchService,
  SchedulingService
} from "@yardmatch/domain";
import { MarketplaceTelemetryEventCatalog } from "@yardmatch/observability";
import {
  PASSWORD_RESET_TTL_MINUTES,
  generatePasswordResetCode,
  hashPassword,
  hashPasswordResetCode,
  validatePasswordStrength
} from "../auth";
import { HttpError } from "../http";
import { evaluateProviderCredentialReadiness } from "../policies/providerCredentialPolicy";
import { AuthIdentityRecord, MarketplaceRepository } from "../repositories/MarketplaceRepository";
import { NotificationDeliveryService } from "./NotificationDeliveryService";
import { AddressValidationOutcome, AddressValidationService } from "./AddressValidationService";
import { PlaceSearchService } from "./PlaceSearchService";
import {
  PaymentCheckoutGateway,
  StripeCheckoutService,
  StripeWebhookEvent
} from "./StripeCheckoutService";
import { StripeConnectGateway, StripeConnectService } from "./StripeConnectService";

const OPS_AUTH_FAILURE_LOCK_THRESHOLD = 5;
const OPS_AUTH_LOCK_WINDOW_MINUTES = 30;
const PROPERTY_PHOTO_AREAS = new Set([
  "lawn",
  "shrubs",
  "garden-beds",
  "trees",
  "driveway",
  "walkways",
  "gutters",
  "other"
]);
const PHOTO_MARKETING_USE_STATUSES = new Set(["granted", "denied", "revoked"]);

type ParsedProviderAssistantAction = {
  command: string;
  actionType: ProviderAssistantActionType;
  sourceWindowKey?: "morning" | "afternoon" | "late-afternoon-night";
  targetWindowKey?: "morning" | "afternoon" | "late-afternoon-night";
  notifyCustomer: boolean;
  dispatchScope?: "today" | "tomorrow" | "next-7-days";
  dispatchFocus?: "summary" | "attention";
  crewMatchCrewNameQuery?: string;
  routeLeaderCrewNameQuery?: string;
  crewMessageCrewNameQuery?: string;
  crewMessageTarget?: "named-crew" | "route-leader" | "accepted-crew";
  crewMessageBody?: string;
  routeStopKind?: SetBookingRouteStopRequest["kind"];
  lateMinutes?: number;
  lateReason?: string;
  arrivalUpdate?: boolean;
  exceptionType?: MarkBookingExceptionRequest["exceptionType"];
  exceptionNotes?: string;
};

type ParsedProviderAssistantCommand = {
  understood: boolean;
  actionType?: ProviderAssistantActionType;
  actionTypes: ProviderAssistantActionType[];
  actions: ParsedProviderAssistantAction[];
  dispatchScope?: "today" | "tomorrow" | "next-7-days";
  dispatchFocus?: "summary" | "attention";
  sourceWindowKey?: "morning" | "afternoon" | "late-afternoon-night";
  targetWindowKey?: "morning" | "afternoon" | "late-afternoon-night";
  notifyCustomer: boolean;
  routeLeaderCrewNameQuery?: string;
  lateMinutes?: number;
  lateReason?: string;
  exceptionType?: MarkBookingExceptionRequest["exceptionType"];
  exceptionNotes?: string;
};

type LaunchLeadLinkMode = "explicit-id" | "email-match" | "phone-match";

type ProviderVerificationOperationalHistory = {
  totalBookingCount: number;
  disputedBookingCount: number;
  refundedBookingCount: number;
  activeExceptionCount: number;
};

const MIN_DETAILED_SUPPORT_RATIONALE_LENGTH = 48;
const MIN_PROVIDER_APPROVAL_OVERRIDE_NOTE_LENGTH = 56;

const GENERIC_SUPPORT_RESOLUTION_NOTES = [
  "support approved the refund review and reversed the customer payment.",
  "support reviewed the refund request and kept the payment captured.",
  "support approved the refund review after checking the booking.",
  "support reviewed the issue and restored the booking to the active schedule.",
  "support resolved the issue by cancelling the booking.",
  "support confirmed the service should be treated as complete.",
  "support reviewed the issue and kept the booking marked complete.",
  "support reviewed the dispute and restored the booking.",
  "support reviewed the dispute and kept the booking marked complete."
] as const;

const GENERIC_PROVIDER_APPROVAL_OVERRIDE_NOTES = [
  "ops approved the business for public marketplace visibility after checking launch fit and operational readiness.",
  "ops approved the business after manual verification review confirmed the launch fit was acceptable.",
  "business profile is complete and ready to go live.",
  "provider looks ready for launch visibility."
] as const;

export class MarketplacePlatformService {
  private static readonly reviewInviteDelayHours = 48;
  private static readonly reviewInviteExpiryDays = 30;
  private static readonly liveRouteLocationStaleMinutes = 5;
  private static readonly routeStopReachedThresholdMiles = 0.12;
  private static readonly routeStopDwellMinutes = 6;
  private static readonly launchLeadFirstResponseSlaMinutes = 120;
  private readonly payoutHoldHours = 48;
  private readonly instantPayoutMinimumCents = 10_000;
  private readonly crewPayoutWeekday: CrewAvailabilityDay = "Fri";
  public static readonly sensitiveActionFreshSessionMaxAgeSeconds = 15 * 60;
  private readonly geoService = new GeoService();
  private readonly providerMatcher = new ProviderMatchService(this.geoService);
  private readonly schedulingService = new SchedulingService();
  private readonly bookingLifecycle = new BookingLifecycleService();
  private readonly propertyBook = new PropertyBookService();
  private readonly bookingAddressPolicy = new BookingAddressPolicyService(this.geoService);
  private readonly instantQuoteEngine = new InstantQuoteEngine();
  private readonly placeSearch = new PlaceSearchService(process.env.GOOGLE_MAPS_API_KEY);
  private readonly addressValidation = new AddressValidationService(
    process.env.GOOGLE_ADDRESS_VALIDATION_API_KEY
  );
  private readonly notificationDelivery = new NotificationDeliveryService();
  private readonly stripeCheckout: PaymentCheckoutGateway;
  private readonly stripeConnect: StripeConnectGateway;
  private readonly appBaseUrl: string;
  private readonly apiBaseUrl: string;

  public constructor(
    private readonly repository: MarketplaceRepository,
    private readonly analytics: DataEngineeringLogger,
    stripeCheckout: PaymentCheckoutGateway = new StripeCheckoutService(),
    appBaseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000",
    stripeConnect: StripeConnectGateway = new StripeConnectService()
  ) {
    this.stripeCheckout = stripeCheckout;
    this.stripeConnect = stripeConnect;
    this.appBaseUrl = appBaseUrl;
    this.apiBaseUrl =
      process.env.API_BASE_URL ?? `http://localhost:${process.env.PORT ?? "4001"}`;
  }

  public async registerUser(
    payload: Omit<RegisterUserRequest, "password"> & Partial<Pick<RegisterUserRequest, "password">>,
    passwordHash?: string
  ): Promise<CustomerProfile | CrewMemberProfile | ProviderProfile | OpsProfile> {
    const now = new Date().toISOString();
    const validatedAddress = await this.normalizeAndValidateAddress(payload.address);
    const normalizedAddress = await this.resolveSavedPropertyAddress(validatedAddress.address, []);

    if (payload.role === "customer") {
      const primaryProperty = {
        id: crypto.randomUUID(),
        label: payload.propertyLabel ?? "Primary property",
        address: normalizedAddress,
        accessNotes: payload.propertyNotes,
        lawnSizeSqFt: payload.lawnSizeSqFt,
        isDefault: true,
        createdAt: now
      };

      const customer: CustomerProfile = {
        id: crypto.randomUUID(),
        fullName: payload.fullName,
        email: payload.email,
        phone: payload.phone,
        role: "customer",
        address: normalizedAddress,
        createdAt: now,
        propertyNotes: payload.propertyNotes ?? "",
        lawnSizeSqFt: payload.lawnSizeSqFt ?? 0,
        properties: [primaryProperty],
        defaultPropertyId: primaryProperty.id
      };

      this.analytics.recordFunnelStep(MarketplaceTelemetryEventCatalog.customerRegistered, customer.id, {
        city: customer.address.city,
        lawnSizeSqFt: customer.lawnSizeSqFt
      });
      return this.repository.createCustomer(customer, passwordHash);
    }

    if (payload.role === "crew-member") {
      const crewMember: CrewMemberProfile = {
        id: crypto.randomUUID(),
        fullName: payload.fullName,
        email: payload.email,
        phone: payload.phone,
        role: "crew-member",
        address: normalizedAddress,
        createdAt: now,
        bio:
          payload.bio ??
          "Dependable crew member available for recurring lawn care, cleanup, and seasonal field work.",
        yearsExperience: payload.yearsExperience ?? 1,
        categories: payload.categories ?? ["lawn-mowing", "seasonal-cleanup"],
        availableWeekdays: payload.availableWeekdays ?? ["Mon", "Tue", "Wed", "Thu", "Fri"],
        willingToTravelMiles: payload.willingToTravelMiles ?? 20,
        preferredSchedule: payload.preferredSchedule ?? "flex",
        hasOwnEquipment: payload.hasOwnEquipment ?? false,
        winterWorkEnabled: payload.winterWorkEnabled ?? true,
        rating: 5,
        completedJobs: 0,
        cancellationCount: 0,
        status: "available"
      };

      this.analytics.recordFunnelStep(
        MarketplaceTelemetryEventCatalog.crewMemberRegistered,
        crewMember.id,
        {
          city: crewMember.address.city,
          willingToTravelMiles: crewMember.willingToTravelMiles,
          preferredSchedule: crewMember.preferredSchedule
        }
      );
      return this.repository.createCrewMember(crewMember, passwordHash);
    }

    if (payload.role === "ops") {
      const opsUser: OpsProfile = {
        id: crypto.randomUUID(),
        fullName: payload.fullName,
        email: payload.email,
        phone: payload.phone,
        role: "ops",
        address: normalizedAddress,
        createdAt: now,
        internalScope: payload.internalScope === "admin" ? "admin" : "operations"
      };

      return this.repository.createOpsUser(opsUser, passwordHash);
    }

    const provider: ProviderProfile = {
      id: crypto.randomUUID(),
      fullName: payload.fullName,
      email: payload.email,
      phone: payload.phone,
      role: "provider",
      address: normalizedAddress,
      createdAt: now,
      companyName: payload.companyName ?? `${payload.fullName} Landscaping`,
      bio: payload.bio ?? "Quality lawn care and landscaping services.",
      yearsExperience: payload.yearsExperience ?? 1,
      serviceRadiusMiles: payload.serviceRadiusMiles ?? 15,
      minimumBookingLeadHours: 0,
      staffingMode: "review-first",
      crewReviewLeadHours: 24,
      departureReminderLeadMinutes: 60,
      routeLeaderMode: "provider-only",
      weeklyPayoutDay: "Thu",
      instantPayoutsEnabled: false,
      verificationStatus: "pending-review",
      verificationSubmittedAt: now,
      sponsoredListingEnabled: false,
      categories: payload.categories ?? ["lawn-mowing"],
      rating: 5,
      timelinessRating: 5,
      attentionToDetailRating: 5,
      reviewCount: 0,
      calendarConnection: {
        provider: "google",
        connected: false
      }
    };

    this.analytics.recordFunnelStep(MarketplaceTelemetryEventCatalog.providerRegistered, provider.id, {
      city: provider.address.city,
      serviceRadiusMiles: provider.serviceRadiusMiles
    });
    return this.repository.createProvider(provider, passwordHash);
  }

  public async requestPasswordReset(
    payload: RequestPasswordResetRequest
  ): Promise<RequestPasswordResetResponse> {
    const email = payload.email.trim().toLowerCase();
    const identity = await this.repository.findAuthIdentityByEmail(email);

    if (!identity?.passwordHash) {
      return {
        success: true,
        message: "If that account exists, YardMatch has prepared a password reset code."
      };
    }

    const resetCode = generatePasswordResetCode();
    const expiresAtIso = new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000).toISOString();
    await this.repository.updateAuthIdentity(identity.userId, {
      resetPasswordCodeHash: hashPasswordResetCode(email, resetCode),
      resetPasswordExpiresAt: expiresAtIso,
      resetPasswordRequestedAt: new Date().toISOString()
    });

    await this.createNotification({
      recipientId: identity.userId,
      recipientRole: identity.role,
      category: "account",
      title: "Password reset requested",
      body: "Use the latest YardMatch password reset code to finish securing your account.",
      actionHref: "/login"
    });

    return {
      success: true,
      message: "If that account exists, YardMatch has prepared a password reset code.",
      expiresAtIso,
      resetCodePreview: resetCode,
      resetUrlPreview: `${this.appBaseUrl}/login?resetCode=${encodeURIComponent(resetCode)}&email=${encodeURIComponent(email)}`
    };
  }

  public async listOpsAccounts(): Promise<OpsAccountSummary[]> {
    const opsUsers = await this.repository.listOpsUsers();
    const identities = await Promise.all(
      opsUsers.map((opsUser) => this.repository.findAuthIdentityByUserId(opsUser.id))
    );

    return opsUsers.map((profile, index) => this.buildOpsAccountSummary(profile, identities[index]));
  }

  public async createOpsAccount(
    actor: AuthIdentityRecord,
    payload: CreateOpsAccountRequest
  ): Promise<CreateOpsAccountResponse> {
    const email = payload.email.trim().toLowerCase();
    const fullName = payload.fullName.trim();
    const phone = payload.phone.trim();
    if (!fullName) {
      throw new HttpError(400, "Full name is required.");
    }
    if (!phone) {
      throw new HttpError(400, "Phone number is required.");
    }

    const shouldPrepareResetInvite = payload.sendPasswordResetInvite ?? false;
    const internalScope: OpsInternalScope = payload.internalScope === "admin" ? "admin" : "operations";
    const suppliedPassword = payload.password?.trim();
    const passwordToStore = suppliedPassword || (shouldPrepareResetInvite ? this.generateTemporaryStrongPassword() : undefined);
    if (!passwordToStore) {
      throw new HttpError(400, "A password is required unless you prepare a password reset invite.");
    }
    validatePasswordStrength(passwordToStore);
    const existingIdentity = await this.repository.findAuthIdentityByEmail(email);
    if (existingIdentity) {
      if (existingIdentity.role !== "ops") {
        throw new HttpError(409, "That email already belongs to a different YardMatch role.");
      }
      throw new HttpError(409, "An ops account with that email already exists.");
    }

    const created = await this.registerUser(
      {
        fullName,
        email,
        phone,
        role: "ops",
        address: payload.address ?? this.getDefaultOpsAccountAddress(),
        internalScope
      },
      hashPassword(passwordToStore)
    );

    const identity = await this.repository.findAuthIdentityByUserId(created.id);
    if (!identity || created.role !== "ops") {
      throw new HttpError(500, "Unable to create the ops account.");
    }

    await this.applyAccessAudit(identity.userId, {
      changedBy: actor.userId,
      kind: "created"
    });
    const passwordReset = shouldPrepareResetInvite
      ? await this.requestPasswordReset({ email })
      : undefined;
    if (shouldPrepareResetInvite) {
      await this.applyAccessAudit(identity.userId, {
        changedBy: actor.userId,
        kind: "password-reset-invited"
      });
    }
    const refreshedIdentity =
      shouldPrepareResetInvite
      ? await this.repository.findAuthIdentityByUserId(created.id)
      : identity;

    return {
      account: this.buildOpsAccountSummary(created, refreshedIdentity ?? identity),
      passwordReset
    };
  }

  public async updateOpsAccount(
    actor: AuthIdentityRecord,
    payload: UpdateOpsAccountRequest
  ): Promise<OpsAccountSummary> {
    const current = await this.repository.findOpsUserById(payload.opsUserId);
    if (!current) {
      throw new HttpError(404, "Ops account not found.");
    }

    const fullName = payload.fullName?.trim();
    const phone = payload.phone?.trim();
    if ((payload.fullName !== undefined && !fullName) || (payload.phone !== undefined && !phone)) {
      throw new HttpError(400, "Ops account updates cannot blank out the name or phone number.");
    }
    if (
      actor.userId === payload.opsUserId &&
      payload.internalScope !== undefined &&
      payload.internalScope !== current.internalScope
    ) {
      throw new HttpError(400, "Use another admin account to change your own admin scope.");
    }
    if (current.internalScope === "admin" && payload.internalScope === "operations") {
      await this.assertAnotherActiveAdminExists(current.id);
    }

    const updated = await this.repository.updateOpsUser(payload.opsUserId, {
      fullName: fullName ?? undefined,
      phone: phone ?? undefined,
      internalScope: payload.internalScope ?? undefined
    });
    if (!updated) {
      throw new HttpError(404, "Ops account not found.");
    }
    await this.applyAccessAudit(updated.id, {
      changedBy: actor.userId,
      kind: "profile-updated"
    });

    const identity = await this.repository.findAuthIdentityByUserId(updated.id);
    if (!identity) {
      throw new HttpError(500, "Unable to load the updated ops account.");
    }

    return this.buildOpsAccountSummary(updated, identity);
  }

  public async rotateOpsAccountSessions(
    actor: AuthIdentityRecord,
    payload: RotateOpsAccountSessionsRequest
  ): Promise<OpsAccountSummary> {
    if (actor.userId === payload.opsUserId) {
      throw new HttpError(400, "Use the account settings flow to rotate your own active ops session.");
    }

    const current = await this.repository.findOpsUserById(payload.opsUserId);
    if (!current) {
      throw new HttpError(404, "Ops account not found.");
    }

    const identity = await this.repository.findAuthIdentityByUserId(payload.opsUserId);
    if (!identity || identity.role !== "ops") {
      throw new HttpError(404, "Ops account not found.");
    }

    const nextUpdates: Partial<AuthIdentityRecord> = {
      sessionVersion: (identity.sessionVersion ?? 1) + 1,
      failedAuthenticationCount: 0,
      lastFailedAuthenticationAt: undefined,
      lastFailedAuthenticationReason: undefined,
      authenticationLockExpiresAt: undefined
    };
    const newPassword = payload.newPassword?.trim();
    if (newPassword) {
      validatePasswordStrength(newPassword);
      nextUpdates.passwordHash = hashPassword(newPassword);
      nextUpdates.resetPasswordCodeHash = undefined;
      nextUpdates.resetPasswordExpiresAt = undefined;
      nextUpdates.resetPasswordRequestedAt = undefined;
    }

    const updatedIdentity = await this.repository.updateAuthIdentity(payload.opsUserId, nextUpdates);
    if (!updatedIdentity) {
      throw new HttpError(404, "Ops account not found.");
    }
    await this.applyAccessAudit(payload.opsUserId, {
      changedBy: actor.userId,
      kind: "sessions-rotated"
    });
    await this.appendOpsAuthenticationHistory(payload.opsUserId, {
      kind: "sessions-rotated",
      recordedBy: actor.userId,
      notes: newPassword ? "Password replaced while rotating sessions." : "Existing sessions were revoked."
    });

    return this.buildOpsAccountSummary(
      current,
      (await this.repository.findAuthIdentityByUserId(payload.opsUserId)) ?? updatedIdentity
    );
  }

  public async requestOpsAccountPasswordReset(
    actor: AuthIdentityRecord,
    payload: { opsUserId: string }
  ): Promise<RequestOpsAccountPasswordResetResponse> {
    const current = await this.repository.findOpsUserById(payload.opsUserId);
    if (!current) {
      throw new HttpError(404, "Ops account not found.");
    }
    const identityBeforeReset = await this.repository.findAuthIdentityByUserId(current.id);
    if (identityBeforeReset?.accessDisabledAt) {
      throw new HttpError(409, "Reactivate the ops account before preparing a password reset invite.");
    }

    const passwordReset = await this.requestPasswordReset({
      email: current.email
    });
    await this.applyAccessAudit(current.id, {
      changedBy: actor.userId,
      kind: "password-reset-invited"
    });
    await this.appendOpsAuthenticationHistory(current.id, {
      kind: "password-reset-requested",
      recordedBy: actor.userId,
      notes: "Reset invite prepared from the internal ops dashboard."
    });
    const identity = await this.repository.findAuthIdentityByUserId(current.id);
    if (!identity) {
      throw new HttpError(500, "Unable to reload the ops account after preparing the reset.");
    }

    return {
      account: this.buildOpsAccountSummary(current, identity),
      passwordReset
    };
  }

  public async updateOpsAccountAccess(
    actor: AuthIdentityRecord,
    payload: UpdateOpsAccountAccessRequest
  ): Promise<OpsAccountSummary> {
    if (actor.userId === payload.opsUserId) {
      throw new HttpError(400, "Use a separate account to change access for your own active ops login.");
    }

    const current = await this.repository.findOpsUserById(payload.opsUserId);
    if (!current) {
      throw new HttpError(404, "Ops account not found.");
    }

    const identity = await this.repository.findAuthIdentityByUserId(payload.opsUserId);
    if (!identity || identity.role !== "ops") {
      throw new HttpError(404, "Ops account not found.");
    }

    const notes = payload.notes?.trim() || undefined;
    if (payload.action === "clear-auth-lock" && !notes) {
      throw new HttpError(400, "Notes are required when clearing an auth lock or failed-attempt state.");
    }
    const now = new Date().toISOString();
    const isDeactivate = payload.action === "deactivate";
    const isClearAuthLock = payload.action === "clear-auth-lock";
    if (isDeactivate && identity.accessDisabledAt) {
      throw new HttpError(409, "That ops account is already deactivated.");
    }
    if (payload.action === "reactivate" && !identity.accessDisabledAt) {
      throw new HttpError(409, "That ops account is already active.");
    }
    if (
      isClearAuthLock &&
      !identity.authenticationLockExpiresAt &&
      !identity.lastFailedAuthenticationAt &&
      (identity.failedAuthenticationCount ?? 0) === 0
    ) {
      throw new HttpError(409, "That ops account has no auth lock or failed-attempt state to clear.");
    }
    if (isDeactivate && current.internalScope === "admin") {
      await this.assertAnotherActiveAdminExists(current.id);
    }

    const updated = await this.repository.updateAuthIdentity(payload.opsUserId, {
      sessionVersion: (identity.sessionVersion ?? 1) + 1,
      accessDisabledAt: isDeactivate ? now : payload.action === "reactivate" ? undefined : identity.accessDisabledAt,
      accessDisabledBy:
        isDeactivate ? actor.userId : payload.action === "reactivate" ? undefined : identity.accessDisabledBy,
      failedAuthenticationCount:
        isClearAuthLock ? 0 : identity.failedAuthenticationCount,
      lastFailedAuthenticationAt:
        isClearAuthLock ? undefined : identity.lastFailedAuthenticationAt,
      lastFailedAuthenticationReason:
        isClearAuthLock ? undefined : identity.lastFailedAuthenticationReason,
      authenticationLockExpiresAt:
        isClearAuthLock ? undefined : identity.authenticationLockExpiresAt,
      resetPasswordCodeHash: undefined,
      resetPasswordExpiresAt: undefined,
      resetPasswordRequestedAt: undefined
    });
    if (!updated) {
      throw new HttpError(404, "Ops account not found.");
    }

    await this.applyAccessAudit(payload.opsUserId, {
      changedBy: actor.userId,
      kind: isDeactivate ? "deactivated" : isClearAuthLock ? "auth-lock-cleared" : "reactivated",
      notes
    });
    if (isClearAuthLock) {
      await this.appendOpsAuthenticationHistory(payload.opsUserId, {
        kind: "auth-lock-cleared",
        recordedBy: actor.userId,
        notes,
        failedCount: 0
      });
    }

    return this.buildOpsAccountSummary(
      current,
      (await this.repository.findAuthIdentityByUserId(payload.opsUserId)) ?? updated
    );
  }

  public async confirmPasswordReset(
    payload: ConfirmPasswordResetRequest
  ): Promise<CustomerProfile | CrewMemberProfile | ProviderProfile | OpsProfile> {
    const email = payload.email.trim().toLowerCase();
    const identity = await this.repository.findAuthIdentityByEmail(email);

    if (!identity?.passwordHash) {
      throw new HttpError(400, "Invalid password reset code");
    }

    if (!identity.resetPasswordCodeHash || !identity.resetPasswordExpiresAt) {
      throw new HttpError(400, "Password reset code has expired");
    }

    if (new Date(identity.resetPasswordExpiresAt).getTime() <= Date.now()) {
      throw new HttpError(400, "Password reset code has expired");
    }

    const expectedHash = hashPasswordResetCode(email, payload.resetCode.trim());
    if (expectedHash !== identity.resetPasswordCodeHash) {
      throw new HttpError(400, "Invalid password reset code");
    }

    validatePasswordStrength(payload.newPassword);
    const nextSessionVersion = (identity.sessionVersion ?? 1) + 1;
    await this.repository.updateAuthIdentity(identity.userId, {
      passwordHash: hashPassword(payload.newPassword),
      sessionVersion: nextSessionVersion,
      failedAuthenticationCount: 0,
      lastFailedAuthenticationAt: undefined,
      lastFailedAuthenticationReason: undefined,
      authenticationLockExpiresAt: undefined,
      resetPasswordCodeHash: undefined,
      resetPasswordExpiresAt: undefined,
      resetPasswordRequestedAt: undefined
    });
    if (identity.role === "ops") {
      await this.appendOpsAuthenticationHistory(identity.userId, {
        kind: "password-reset-completed"
      });
    }

    await this.createNotification({
      recipientId: identity.userId,
      recipientRole: identity.role,
      category: "account",
      title: "Password updated",
      body: "Your YardMatch password was changed and older sessions were signed out.",
      actionHref: "/login"
    });

    const updatedIdentity = await this.repository.findAuthIdentityByUserId(identity.userId);
    if (!updatedIdentity) {
      throw new HttpError(404, "User profile not found");
    }

    const user = await this.getUserByIdentity(updatedIdentity);
    if (!user) {
      throw new HttpError(404, "User profile not found");
    }

    return user;
  }

  public async searchPlaces(query: string): Promise<PlaceSearchResponse> {
    return this.placeSearch.search(query);
  }

  public async reverseGeocodePlace(latitude: number, longitude: number): Promise<PlaceSearchResponse> {
    return this.placeSearch.reverseGeocode(latitude, longitude);
  }

  public async listNotifications(identity: AuthIdentityRecord): Promise<NotificationListResponse> {
    await this.ensureTimedNotifications(identity);
    await this.retryDueNotificationDeliveries(identity);
    const notifications = (await this.repository.listNotificationsByRecipient(identity.userId))
      .filter((notification) => notification.recipientRole === identity.role)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

    return {
      notifications,
      unreadCount: notifications.filter((notification) => !notification.isRead).length
    };
  }

  public async markNotificationsRead(
    identity: AuthIdentityRecord,
    payload: MarkNotificationsReadRequest
  ): Promise<NotificationListResponse> {
    await this.ensureTimedNotifications(identity);
    await this.retryDueNotificationDeliveries(identity);
    const notifications = (await this.repository.listNotificationsByRecipient(identity.userId)).filter(
      (notification) => notification.recipientRole === identity.role
    );
    const targetIds =
      payload.notificationIds && payload.notificationIds.length > 0
        ? new Set(payload.notificationIds)
        : new Set(notifications.filter((notification) => !notification.isRead).map((notification) => notification.id));
    const nowIso = new Date().toISOString();

    await Promise.all(
      notifications
        .filter((notification) => targetIds.has(notification.id) && !notification.isRead)
        .map((notification) =>
          this.repository.updateNotification(notification.id, {
            isRead: true,
            readAt: nowIso
          })
        )
    );

    return this.listNotifications(identity);
  }

  public async getNotificationPreferences(identity: AuthIdentityRecord): Promise<NotificationPreferences> {
    return this.ensureNotificationPreferences(identity);
  }

  public async updateNotificationPreferences(
    identity: AuthIdentityRecord,
    payload: UpdateNotificationPreferencesRequest
  ): Promise<NotificationPreferences> {
    const current = await this.ensureNotificationPreferences(identity);
    const updatedAt = new Date().toISOString();

    return this.repository.upsertNotificationPreferences({
      ...current,
      emailEnabled: payload.emailEnabled ?? current.emailEnabled,
      smsEnabled: payload.smsEnabled ?? current.smsEnabled,
      pushEnabled: payload.pushEnabled ?? current.pushEnabled,
      reviewRemindersEnabled: payload.reviewRemindersEnabled ?? current.reviewRemindersEnabled,
      updatedAt
    });
  }

  public async listNotificationDeliveries(
    identity: AuthIdentityRecord
  ): Promise<NotificationDeliveriesResponse> {
    await this.ensureTimedNotifications(identity);
    await this.retryDueNotificationDeliveries(identity);
    const deliveries = (await this.repository.listNotificationDeliveriesByRecipient(identity.userId))
      .filter((delivery) => delivery.recipientRole === identity.role)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

    return {
      deliveries
    };
  }

  public async getNotificationOpsHealth(): Promise<NotificationOpsHealthResponse> {
    const now = Date.now();
    const last24Hours = now - 24 * 60 * 60 * 1000;
    const deliveries = (await this.repository.listAllNotificationDeliveries()).sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt)
    );
    const deliveriesLast24Hours = deliveries.filter((delivery) => Date.parse(delivery.createdAt) >= last24Hours);
    const failedDeliveries = deliveries.filter((delivery) => delivery.status === "failed");
    const queuedCount = deliveries.filter((delivery) => delivery.status === "queued").length;
    const pendingRetryDeliveries = failedDeliveries.filter((delivery) => Boolean(delivery.nextRetryAt));
    const overdueRetryDeliveries = pendingRetryDeliveries.filter(
      (delivery) => Date.parse(delivery.nextRetryAt as string) <= now
    );
    const exhaustedFailureCount = failedDeliveries.filter((delivery) => !delivery.nextRetryAt).length;
    const sentLast24Hours = deliveries.filter((delivery) => {
      const sentAt = delivery.sentAt ?? delivery.lastAttemptAt;
      return Boolean(sentAt) && Date.parse(sentAt as string) >= last24Hours && delivery.status === "sent";
    }).length;
    const failedLast24Hours = failedDeliveries.filter((delivery) => {
      const failedAt = delivery.lastAttemptAt ?? delivery.createdAt;
      return Date.parse(failedAt) >= last24Hours;
    }).length;
    const channels = this.buildNotificationOpsChannelHealth(deliveries, now, last24Hours);
    const deliveryPolicy = this.notificationDelivery.getOpsDeliveryPolicy();
    const alerts = this.buildNotificationOpsAlerts({
      deliveriesLast24Hours: deliveriesLast24Hours.length,
      failedLast24Hours,
      pendingRetryCount: pendingRetryDeliveries.length,
      overdueRetryCount: overdueRetryDeliveries.length,
      exhaustedFailureCount,
      channels,
      deliveryPolicy
    });

    return {
      generatedAt: new Date().toISOString(),
      totalDeliveries: deliveries.length,
      deliveriesLast24Hours: deliveriesLast24Hours.length,
      sentLast24Hours,
      failedLast24Hours,
      queuedCount,
      pendingRetryCount: pendingRetryDeliveries.length,
      overdueRetryCount: overdueRetryDeliveries.length,
      exhaustedFailureCount,
      channels,
      recentFailures: failedDeliveries.slice(0, 8),
      alerts,
      deliveryPolicy
    };
  }

  public async retryDueNotificationDeliveriesForOps(): Promise<NotificationOpsRetrySweepResponse> {
    const dueDeliveries = await this.listDueNotificationDeliveries();
    if (dueDeliveries.length === 0) {
      return {
        retriedCount: 0,
        sentCount: 0,
        failedCount: 0,
        remainingOverdueCount: 0
      };
    }

    await Promise.all(dueDeliveries.map((delivery) => this.dispatchNotificationDelivery(delivery)));

    const updatedDeliveries = await this.repository.listAllNotificationDeliveries();
    const updatedById = new Map(updatedDeliveries.map((delivery) => [delivery.id, delivery]));
    const retried = dueDeliveries
      .map((delivery) => updatedById.get(delivery.id))
      .filter((delivery): delivery is NotificationDeliveryRecord => Boolean(delivery));

    return {
      retriedCount: retried.length,
      sentCount: retried.filter((delivery) => delivery.status === "sent").length,
      failedCount: retried.filter((delivery) => delivery.status === "failed").length,
      remainingOverdueCount: updatedDeliveries.filter(
        (delivery) =>
          delivery.status === "failed" &&
          delivery.nextRetryAt &&
          Date.parse(delivery.nextRetryAt) <= Date.now()
      ).length
    };
  }

  public async escalateNotificationOpsAlerts(): Promise<NotificationOpsEscalationResponse> {
    const health = await this.getNotificationOpsHealth();
    const actionableAlerts = health.alerts.filter((alert) => alert.severity === "warning" || alert.severity === "critical");
    if (actionableAlerts.length === 0) {
      return {
        generatedAt: new Date().toISOString(),
        escalated: false,
        reason: "Delivery health is currently stable, so no external ops escalation was sent.",
        targetCount: 0,
        sentCount: 0,
        failedCount: 0
      };
    }

    const targets = this.notificationDelivery.getOpsAlertTargets();
    if (targets.length === 0) {
      return {
        generatedAt: new Date().toISOString(),
        escalated: false,
        reason: "No NOTIFICATION_ALERT_EMAILS or NOTIFICATION_ALERT_SMS_NUMBERS contacts are configured.",
        targetCount: 0,
        sentCount: 0,
        failedCount: 0
      };
    }

    const title = actionableAlerts.some((alert) => alert.severity === "critical")
      ? "YardMatch notification delivery alert"
      : "YardMatch notification delivery warning";
    const body = actionableAlerts
      .slice(0, 4)
      .map((alert) => `${alert.severity.toUpperCase()}: ${alert.title} — ${alert.detail}`)
      .join("\n");

    let sentCount = 0;
    let failedCount = 0;

    await Promise.all(
      targets.map(async (target) => {
        try {
          const dispatch = await this.notificationDelivery.dispatch({
            channel: target.channel,
            destination: target.destination,
            title,
            body
          });

          await this.repository.createNotificationDelivery({
            id: crypto.randomUUID(),
            notificationId: `ops-alert-${health.generatedAt}`,
            recipientId: "ops-alert-target",
            recipientRole: "provider",
            category: "support",
            channel: target.channel,
            destination: target.destination,
            provider: dispatch.provider,
            status: "sent",
            title,
            bodyPreview: body.slice(0, 160),
            attemptCount: 1,
            createdAt: new Date().toISOString(),
            lastAttemptAt: dispatch.sentAt,
            sentAt: dispatch.sentAt
          });
          sentCount += 1;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Notification ops escalation failed.";
          await this.repository.createNotificationDelivery({
            id: crypto.randomUUID(),
            notificationId: `ops-alert-${health.generatedAt}`,
            recipientId: "ops-alert-target",
            recipientRole: "provider",
            category: "support",
            channel: target.channel,
            destination: target.destination,
            provider: this.notificationDelivery.getProviderName(target.channel, target.destination),
            status: "failed",
            title,
            bodyPreview: body.slice(0, 160),
            errorMessage: message,
            attemptCount: 1,
            createdAt: new Date().toISOString(),
            lastAttemptAt: new Date().toISOString()
          });
          failedCount += 1;
        }
      })
    );

    return {
      generatedAt: new Date().toISOString(),
      escalated: sentCount > 0,
      reason: sentCount > 0 ? "Notification delivery health was escalated to configured ops contacts." : "All configured ops alert attempts failed.",
      targetCount: targets.length,
      sentCount,
      failedCount
    };
  }

  public async escalateInboundAutomationAlerts(): Promise<InboundAutomationEscalationResponse> {
    const overview = await this.getObservabilityOverview();
    const actionableAlerts = overview.inboundAutomationAlerts.filter(
      (alert) => alert.severity === "watch" || alert.severity === "urgent"
    );

    if (actionableAlerts.length === 0) {
      return {
        generatedAt: new Date().toISOString(),
        escalated: false,
        reason: "Inbound automation health is currently stable, so no external ops escalation was sent.",
        targetCount: 0,
        sentCount: 0,
        failedCount: 0
      };
    }

    const targets = this.notificationDelivery.getOpsAlertTargets();
    if (targets.length === 0) {
      return {
        generatedAt: new Date().toISOString(),
        escalated: false,
        reason: "No NOTIFICATION_ALERT_EMAILS or NOTIFICATION_ALERT_SMS_NUMBERS contacts are configured.",
        targetCount: 0,
        sentCount: 0,
        failedCount: 0
      };
    }

    const title = actionableAlerts.some((alert) => alert.severity === "urgent")
      ? "YardMatch inbound automation alert"
      : "YardMatch inbound automation warning";
    const body = actionableAlerts
      .slice(0, 4)
      .map((alert) => `${alert.severity.toUpperCase()}: ${alert.label} — ${alert.detail}`)
      .join("\n");

    let sentCount = 0;
    let failedCount = 0;
    const notificationId = `inbound-automation-alert-${overview.generatedAt}`;

    await Promise.all(
      targets.map(async (target) => {
        try {
          const dispatch = await this.notificationDelivery.dispatch({
            channel: target.channel,
            destination: target.destination,
            title,
            body
          });

          await this.repository.createNotificationDelivery({
            id: crypto.randomUUID(),
            notificationId,
            recipientId: "ops-alert-target",
            recipientRole: "provider",
            category: "support",
            channel: target.channel,
            destination: target.destination,
            provider: dispatch.provider,
            status: "sent",
            title,
            bodyPreview: body.slice(0, 160),
            attemptCount: 1,
            createdAt: new Date().toISOString(),
            lastAttemptAt: dispatch.sentAt,
            sentAt: dispatch.sentAt
          });
          sentCount += 1;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Inbound automation escalation failed.";
          await this.repository.createNotificationDelivery({
            id: crypto.randomUUID(),
            notificationId,
            recipientId: "ops-alert-target",
            recipientRole: "provider",
            category: "support",
            channel: target.channel,
            destination: target.destination,
            provider: this.notificationDelivery.getProviderName(target.channel, target.destination),
            status: "failed",
            title,
            bodyPreview: body.slice(0, 160),
            errorMessage: message,
            attemptCount: 1,
            createdAt: new Date().toISOString(),
            lastAttemptAt: new Date().toISOString()
          });
          failedCount += 1;
        }
      })
    );

    return {
      generatedAt: new Date().toISOString(),
      escalated: sentCount > 0,
      reason:
        sentCount > 0
          ? "Inbound automation health was escalated to configured ops contacts."
          : "All configured inbound automation alert attempts failed.",
      targetCount: targets.length,
      sentCount,
      failedCount
    };
  }

  public async registerPushDevice(
    identity: AuthIdentityRecord,
    payload: RegisterPushDeviceRequest
  ): Promise<PushDevice> {
    if (payload.provider !== "expo") {
      throw new HttpError(400, "Unsupported push provider.");
    }
    if (!payload.token.trim()) {
      throw new HttpError(400, "Push token is required.");
    }

    const nowIso = new Date().toISOString();
    return this.repository.upsertPushDevice({
      id: crypto.randomUUID(),
      userId: identity.userId,
      role: identity.role,
      platform: payload.platform,
      provider: payload.provider,
      token: payload.token.trim(),
      isActive: true,
      createdAt: nowIso,
      updatedAt: nowIso,
      lastSeenAt: nowIso
    });
  }

  public async removePushDevice(
    identity: AuthIdentityRecord,
    payload: RemovePushDeviceRequest
  ): Promise<{ success: true }> {
    await this.repository.deactivatePushDevice(payload.token.trim());
    return { success: true };
  }

  public async searchProviders(payload: SearchProvidersRequest): Promise<SearchProvidersResponse> {
    const normalizedAddress = (await this.normalizeAndValidateAddress(payload.address)).address;
    const recommendationSessionId = crypto.randomUUID();
    const providerDecisionMetrics = this.buildProviderDecisionMetrics();

    this.analytics.recordFunnelStep(MarketplaceTelemetryEventCatalog.providerSearchPerformed, "anonymous", {
      recommendationSessionId,
      dateIso: payload.dateIso,
      categoryCount: payload.categories.length,
      city: normalizedAddress.city,
      requestSource: payload.requestSource ?? "unknown",
      ...this.buildSearchRetentionAnalyticsProperties(payload.retentionPreference),
      ...this.buildLaunchAttributionAnalyticsProperties(payload.attribution)
    });

    const [providers, bookings] = await Promise.all([
      this.repository.listProviders(),
      this.repository.listBookings()
    ]);

    const rankedCandidates = (
      await Promise.all(
        providers
          .filter(
            (provider) =>
              provider.verificationStatus === "verified" &&
              payload.categories.some((category) => provider.categories.includes(category))
          )
          .map(async (provider) => {
            const distanceMiles = this.geoService.distanceMiles(normalizedAddress, provider.address);
            if (distanceMiles > provider.serviceRadiusMiles) {
              return undefined;
            }

            const providerSlots = this.filterProviderSlotsAgainstExternalBlocks(
              provider,
              await this.repository.listSlotsByProvider(provider.id)
            );
            const acceptanceReadySlots = providerSlots.filter((slot) =>
              this.isWithinProviderAcceptanceWindow(provider, slot.startIso)
            );

            const matchingSlots = payload.estimatedDurationMinutes
              ? (() => {
                  const firstMatchingSlot = this.schedulingService.findFirstAvailableSlot(
                    acceptanceReadySlots,
                    payload.estimatedDurationMinutes
                  );
                  return firstMatchingSlot ? [firstMatchingSlot] : [];
                })()
              : acceptanceReadySlots.filter((slot) => !slot.isBooked);

            const suggestedSlot = matchingSlots[0];
            const providerBookings = bookings.filter((booking) => booking.providerId === provider.id);
            const ranking = this.buildSearchProviderRanking(
              payload,
              provider,
              providerBookings,
              distanceMiles,
              suggestedSlot,
              providerDecisionMetrics.get(provider.id)
            );

            return {
              ranking,
              matchingSlots
            };
          })
      )
    )
      .filter(
        (candidate): candidate is { ranking: SearchProviderResult; matchingSlots: AvailabilitySlot[] } =>
          Boolean(candidate)
      )
      .sort((left, right) => {
        if (right.ranking.score !== left.ranking.score) {
          return right.ranking.score - left.ranking.score;
        }

        if (left.ranking.distanceMiles !== right.ranking.distanceMiles) {
          return left.ranking.distanceMiles - right.ranking.distanceMiles;
        }

        return right.ranking.provider.rating - left.ranking.provider.rating;
      });

    const suggestedSlots = rankedCandidates.flatMap((candidate) => candidate.matchingSlots);
    const rankedProviders = this.withCustomerSelectionSummaries(
      rankedCandidates.map((candidate) => candidate.ranking)
    );
    const matchingProviders = rankedProviders.map((candidate) => candidate.provider);
    const recommendedProviderId = rankedProviders[0]?.provider.id;

    this.analytics.record({
      id: crypto.randomUUID(),
      name: MarketplaceTelemetryEventCatalog.providerMatchReturned,
      occurredAt: new Date().toISOString(),
      properties: {
        recommendationSessionId,
        recommendedProviderId,
        providerCount: matchingProviders.length,
        slotCount: suggestedSlots.length,
        city: normalizedAddress.city,
        requestSource: payload.requestSource ?? "unknown",
        ...this.buildSearchRetentionAnalyticsProperties(payload.retentionPreference),
        ...this.buildLaunchAttributionAnalyticsProperties(payload.attribution)
      }
    });

    if (matchingProviders.length === 0) {
      this.analytics.record({
        id: crypto.randomUUID(),
        name: MarketplaceTelemetryEventCatalog.providerSearchNoResults,
        occurredAt: new Date().toISOString(),
        properties: {
          recommendationSessionId,
          providerCount: 0,
          slotCount: 0,
          city: normalizedAddress.city,
          requestSource: payload.requestSource ?? "unknown",
          ...this.buildSearchRetentionAnalyticsProperties(payload.retentionPreference),
          ...this.buildLaunchAttributionAnalyticsProperties(payload.attribution)
        }
      });
    } else if (suggestedSlots.length === 0) {
      this.analytics.record({
        id: crypto.randomUUID(),
        name: MarketplaceTelemetryEventCatalog.providerSearchNoOpenWindows,
        occurredAt: new Date().toISOString(),
        properties: {
          recommendationSessionId,
          providerCount: matchingProviders.length,
          slotCount: 0,
          city: normalizedAddress.city,
          requestSource: payload.requestSource ?? "unknown",
          ...this.buildSearchRetentionAnalyticsProperties(payload.retentionPreference),
          ...this.buildLaunchAttributionAnalyticsProperties(payload.attribution)
        }
      });
    }

    if (recommendedProviderId) {
      this.analytics.record({
        id: crypto.randomUUID(),
        name: MarketplaceTelemetryEventCatalog.recommendationPresented,
        occurredAt: new Date().toISOString(),
        properties: {
          recommendationSessionId,
          recommendedProviderId,
          providerCount: matchingProviders.length,
          city: normalizedAddress.city,
          hasOpenSlot: Boolean(rankedProviders[0]?.hasOpenSlot),
          requestSource: payload.requestSource ?? "unknown",
          ...this.buildSearchRetentionAnalyticsProperties(payload.retentionPreference),
          ...this.buildLaunchAttributionAnalyticsProperties(payload.attribution)
        }
      });
    }

    return {
      providers: matchingProviders,
      rankedProviders,
      suggestedSlots,
      recommendationSessionId,
      recommendedProviderId
    };
  }

  public async getPublicMarketplaceOverview(): Promise<PublicMarketplaceOverviewResponse> {
    const [allProviders, bookings] = await Promise.all([
      this.repository.listProviders(),
      this.repository.listBookings()
    ]);
    const providers = allProviders.filter((provider) => provider.verificationStatus === "verified");
    const providerMap = new Map(providers.map((provider) => [provider.id, provider]));
    const mapFeaturedProvider = (provider: ProviderProfile) => ({
      id: provider.id,
      companyName: provider.companyName,
      ownerName: provider.fullName,
      city: provider.address.city,
      state: provider.address.state,
      rating: provider.rating,
      timelinessRating: provider.timelinessRating,
      reviewCount: provider.reviewCount,
      yearsExperience: provider.yearsExperience,
      serviceRadiusMiles: provider.serviceRadiusMiles,
      primaryCategory: provider.categories[0]
    });
    const featuredProviders = providers
      .slice()
      .sort((left, right) => {
        if (right.reviewCount !== left.reviewCount) {
          return right.reviewCount - left.reviewCount;
        }
        if (right.rating !== left.rating) {
          return right.rating - left.rating;
        }
        return left.companyName.localeCompare(right.companyName);
      })
      .slice(0, 6)
      .map(mapFeaturedProvider);
    const topRatedProviders = providers
      .slice()
      .sort((left, right) => {
        if (right.rating !== left.rating) {
          return right.rating - left.rating;
        }
        if (right.reviewCount !== left.reviewCount) {
          return right.reviewCount - left.reviewCount;
        }
        if (right.timelinessRating !== left.timelinessRating) {
          return right.timelinessRating - left.timelinessRating;
        }
        return left.companyName.localeCompare(right.companyName);
      })
      .slice(0, 8)
      .map(mapFeaturedProvider);
    const mostOnTimeProviders = providers
      .slice()
      .sort((left, right) => {
        if (right.timelinessRating !== left.timelinessRating) {
          return right.timelinessRating - left.timelinessRating;
        }
        if (right.rating !== left.rating) {
          return right.rating - left.rating;
        }
        if (right.reviewCount !== left.reviewCount) {
          return right.reviewCount - left.reviewCount;
        }
        return left.companyName.localeCompare(right.companyName);
      })
      .slice(0, 8)
      .map(mapFeaturedProvider);
    const highlightedReviews = (
      await Promise.all(
        providers.map(async (provider) => {
          const reviews = await this.repository.listProviderReviews(provider.id);
          return reviews.map((review) => this.mapPublicHighlightedReview(provider, review));
        })
      )
    )
      .flat()
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, 6);

    const averageRating =
      providers.length > 0
        ? Number(
            (
              providers.reduce((total, provider) => total + provider.rating, 0) / providers.length
            ).toFixed(1)
          )
        : 0;

    const activeCategoryCount = new Set(
      providers.flatMap((provider) => provider.categories)
    ).size;
    const coverageAreas = this.buildPublicCoverageAreas(providers, bookings, providerMap);
    const beforeAfterProjects = bookings
      .filter(
        (booking) =>
          booking.status === "completed" &&
          Boolean(booking.completedAt) &&
          providerMap.has(booking.providerId)
      )
      .flatMap((booking) => {
        const beforePhoto = booking.serviceEvidence.find(
          (evidence) =>
            evidence.phase === "before" &&
            evidence.evidenceType === "photo" &&
            evidence.marketingUseStatus === "granted" &&
            Boolean(evidence.imageDataUrl)
        );
        const afterPhoto = booking.serviceEvidence.find(
          (evidence) =>
            evidence.phase === "after" &&
            evidence.evidenceType === "photo" &&
            evidence.marketingUseStatus === "granted" &&
            Boolean(evidence.imageDataUrl)
        );
        const provider = providerMap.get(booking.providerId);

        if (!beforePhoto?.imageDataUrl || !afterPhoto?.imageDataUrl || !provider || !booking.completedAt) {
          return [];
        }

        return [
          {
            bookingId: booking.id,
            providerId: provider.id,
            providerCompanyName: provider.companyName,
            city: booking.serviceAddress.city,
            state: booking.serviceAddress.state,
            category: booking.category,
            photoArea: beforePhoto.photoArea ?? afterPhoto.photoArea,
            completedAt: booking.completedAt,
            beforeImageDataUrl: beforePhoto.imageDataUrl,
            afterImageDataUrl: afterPhoto.imageDataUrl
          }
        ];
      })
      .sort((left, right) => right.completedAt.localeCompare(left.completedAt))
      .slice(0, 6);

    return {
      generatedAt: new Date().toISOString(),
      verifiedProviderCount: providers.length,
      averageRating,
      activeCategoryCount,
      launchPricingPolicy: this.buildLaunchPricingPolicy(),
      featuredProviders,
      topRatedProviders,
      mostOnTimeProviders,
      highlightedReviews,
      coverageAreas,
      beforeAfterProjects
    };
  }

  private buildLaunchPricingPolicy(category?: Booking["category"]): LaunchPricingPolicy {
    const launchServiceCategories: Booking["category"][] = [
      "lawn-mowing",
      "seasonal-cleanup",
      "mulch-installation",
      "hedge-trimming",
      "leaf-blowing",
      "fertilization",
      "aeration"
    ];

    return {
      pricingModel: "hybrid-managed-marketplace",
      introductoryOffer: {
        label: "First-service launch offer",
        appliesTo: "first-completed-service",
        customerMessage:
          "Launch customers get a clear first-service price before checkout, with any introductory adjustment handled by YardMatch instead of asking providers to discount their work.",
        opsNote:
          "Apply launch incentives as a YardMatch-funded customer adjustment only after confirming the provider payout still meets the service and route economics."
      },
      launchServiceCategories: category
        ? [category, ...launchServiceCategories.filter((item) => item !== category)]
        : launchServiceCategories,
      customerPricingPrinciples: [
        "Show one clear managed-marketplace price before checkout.",
        "Use follow-up questions when property measurements or layout confidence could materially change scope.",
        "Keep backup provider choices curated instead of turning routine services into quote comparison."
      ],
      providerEconomicsPrinciples: [
        "Do not fund customer acquisition by silently compressing provider net payouts.",
        "Protect route density, service fit, and post-service payout holds before scaling launch demand.",
        "Use YardMatch-funded launch adjustments when a first-customer offer is needed."
      ],
      providerFacingExplanation:
        "YardMatch sets the customer-facing launch price from service scope, property signals, route fit, and marketplace reliability. Providers should see launch offers as YardMatch-funded demand generation, not as an expectation to underbid routine work."
    };
  }

  private mapPublicHighlightedReview(
    provider: ProviderProfile,
    review: ProviderReview
  ): PublicMarketplaceHighlightedReview {
    return {
      reviewId: review.id,
      providerId: provider.id,
      providerCompanyName: provider.companyName,
      city: provider.address.city,
      state: provider.address.state,
      primaryCategory: provider.categories[0],
      overallRating: review.overallRating,
      reviewText: review.reviewText,
      createdAt: review.createdAt
    };
  }

  private buildPublicCoverageAreas(
    providers: ProviderProfile[],
    bookings: Booking[],
    providerMap: Map<string, ProviderProfile>
  ): PublicMarketplaceCoverageArea[] {
    const recentWindowMs = 90 * 24 * 60 * 60 * 1000;
    const nowMs = Date.now();
    const areaMap = new Map<
      string,
      {
        city: string;
        state: string;
        providerIds: Set<string>;
        completedBookingCount: number;
        recentCompletedBookingCount: number;
        supportedCategories: Set<ProviderProfile["categories"][number]>;
      }
    >();

    const touchArea = (address: Address) => {
      const city = this.toTitleCase(this.normalizeAddressText(address.city));
      const state = this.normalizeAddressText(address.state).toUpperCase();
      const key = `${city.toLowerCase()}|${state.toLowerCase()}`;
      const current = areaMap.get(key);
      if (current) {
        return current;
      }

      const created = {
        city,
        state,
        providerIds: new Set<string>(),
        completedBookingCount: 0,
        recentCompletedBookingCount: 0,
        supportedCategories: new Set<ProviderProfile["categories"][number]>()
      };
      areaMap.set(key, created);
      return created;
    };

    for (const provider of providers) {
      const area = touchArea(provider.address);
      area.providerIds.add(provider.id);
      provider.categories.forEach((category) => area.supportedCategories.add(category));
    }

    for (const booking of bookings) {
      const provider = providerMap.get(booking.providerId);
      if (!provider || booking.status !== "completed") {
        continue;
      }

      const area = touchArea(booking.serviceAddress);
      area.providerIds.add(provider.id);
      area.completedBookingCount += 1;
      area.supportedCategories.add(booking.category);

      const completedAtMs = Date.parse(booking.completedAt ?? booking.scheduledEndIso);
      if (Number.isFinite(completedAtMs) && nowMs - completedAtMs <= recentWindowMs) {
        area.recentCompletedBookingCount += 1;
      }
    }

    return [...areaMap.values()]
      .map((area) => ({
        city: area.city,
        state: area.state,
        verifiedProviderCount: area.providerIds.size,
        completedBookingCount: area.completedBookingCount,
        recentCompletedBookingCount: area.recentCompletedBookingCount,
        supportedCategories: [...area.supportedCategories].sort()
      }))
      .sort((left, right) => {
        if (right.recentCompletedBookingCount !== left.recentCompletedBookingCount) {
          return right.recentCompletedBookingCount - left.recentCompletedBookingCount;
        }
        if (right.completedBookingCount !== left.completedBookingCount) {
          return right.completedBookingCount - left.completedBookingCount;
        }
        if (right.verifiedProviderCount !== left.verifiedProviderCount) {
          return right.verifiedProviderCount - left.verifiedProviderCount;
        }
        if (left.state !== right.state) {
          return left.state.localeCompare(right.state);
        }
        return left.city.localeCompare(right.city);
      })
      .slice(0, 6);
  }

  public async getProviderProfile(providerId: string): Promise<ProviderProfile> {
    const provider = await this.repository.findProviderById(providerId);
    if (!provider) {
      throw new Error("Provider not found");
    }

    const bookings = await this.repository.listBookings();
    const openBookingCount = this.countOpenProviderBookings(provider.id, bookings);
    const guidance = this.buildProviderVerificationGuidance(
      provider,
      openBookingCount,
      this.buildProviderVerificationOperationalHistory(provider.id, bookings)
    );
    const onboardingPlan = this.buildProviderOnboardingAutomationPlan(provider, guidance);
    const credentialReadiness = evaluateProviderCredentialReadiness(
      provider,
      provider.credentials ?? []
    );

    return {
      ...provider,
      credentialReadiness,
      verificationSummary: this.buildProviderVerificationStatusSummary(provider, guidance, onboardingPlan),
      businessControls: this.buildProviderBusinessControlsSummary(provider, openBookingCount)
    };
  }

  public async getProviderConnectStatus(
    providerId: string
  ): Promise<ProviderConnectStatusResponse> {
    const provider = await this.repository.findProviderById(providerId);
    if (!provider) {
      throw new HttpError(404, "Provider not found");
    }
    let account = await this.repository.findProviderConnectAccount(providerId);
    if (account && this.stripeConnect.isConfigured()) {
      const readiness = await this.stripeConnect.retrieveRecipientReadiness(
        account.stripeAccountId
      );
      account = await this.repository.upsertProviderConnectAccount({
        ...account,
        onboardingStatus: readiness.onboardingStatus,
        transfersStatus: readiness.transfersStatus,
        payoutsStatus: readiness.payoutsStatus,
        updatedAt: new Date().toISOString(),
        lastSyncedAt: new Date().toISOString()
      });
    }
    return this.buildProviderConnectStatus(account);
  }

  public async startProviderConnectOnboarding(
    providerId: string
  ): Promise<ProviderConnectOnboardingResponse> {
    const provider = await this.repository.findProviderById(providerId);
    if (!provider) {
      throw new HttpError(404, "Provider not found");
    }
    if (!this.stripeConnect.isConfigured()) {
      throw new HttpError(503, "Stripe Connect is not configured yet.");
    }
    let account = await this.repository.findProviderConnectAccount(providerId);
    if (!account) {
      const readiness = await this.stripeConnect.createRecipientAccount(provider);
      const now = new Date().toISOString();
      account = await this.repository.upsertProviderConnectAccount({
        providerId,
        stripeAccountId: readiness.stripeAccountId,
        dashboard: "express",
        feesCollector: "application",
        lossesCollector: "application",
        chargePattern: "separate-charges-and-transfers",
        onboardingStatus: readiness.onboardingStatus,
        transfersStatus: readiness.transfersStatus,
        payoutsStatus: readiness.payoutsStatus,
        createdAt: now,
        updatedAt: now,
        lastSyncedAt: now
      });
    }
    const onboarding = await this.stripeConnect.createOnboardingLink({
      stripeAccountId: account.stripeAccountId,
      returnUrl: new URL("/provider/management?connect=return", this.appBaseUrl).toString(),
      refreshUrl: new URL("/provider/management?connect=refresh", this.appBaseUrl).toString()
    });
    return {
      ...this.buildProviderConnectStatus(account),
      onboardingUrl: onboarding.url,
      expiresAt: onboarding.expiresAt
    };
  }

  private buildProviderConnectStatus(
    account?: ProviderConnectAccount
  ): ProviderConnectStatusResponse {
    return {
      stripeConfigured: this.stripeConnect.isConfigured(),
      transferReady:
        account?.onboardingStatus === "ready" &&
        account.transfersStatus === "active" &&
        account.payoutsStatus === "active",
      account,
      crewCompensationResponsibility: "provider",
      chargePattern: "separate-charges-and-transfers",
      readinessRequirements: [
        "Use Accounts v2 recipient configuration; do not request merchant/card-payments capabilities.",
        "Stripe transfers and payouts capabilities must both be active.",
        "Provider legal and insurance credentials must remain verified and current.",
        "Booking must be complete, paid, outside the hold window, and free of refund/dispute holds.",
        "Transfer amount must equal the immutable providerNetCents settlement and use an idempotency key.",
        "YardMatch never creates a transfer to an individual crew member."
      ]
    };
  }

  private buildProviderBusinessControlsSummary(
    provider: ProviderProfile,
    openBookingCount: number
  ): NonNullable<ProviderProfile["businessControls"]> {
    const warnings: string[] = [];

    if (provider.verificationStatus !== "verified") {
      warnings.push("Public marketplace visibility remains gated until ops approves provider verification.");
    }
    if (openBookingCount > 0) {
      warnings.push(
        `${openBookingCount} open booking${openBookingCount === 1 ? "" : "s"} should be considered before shrinking radius, lead time, crew review, or calendar-blocking settings.`
      );
    }
    if ((provider.staffingMode ?? "review-first") === "auto-accept") {
      warnings.push("Auto-accept staffing should stay limited to providers with reliable crew fit and low exception risk.");
    }

    return {
      teamAccessMode: "owner-only",
      teamPermissionsStatus: "owner-only",
      ownerManagedControls: [
        "business profile",
        "service categories",
        "service radius",
        "booking lead time",
        "crew staffing mode",
        "crew review timing",
        "departure reminders",
        "route leader delegation",
        "outside-calendar blocking",
        "weekly payout day",
        "instant payout preference"
      ],
      profileControls: [
        "company name",
        "customer-facing bio",
        "years of experience",
        "service categories"
      ],
      dispatchControls: [
        "service radius",
        "minimum booking lead time",
        "crew staffing mode",
        "crew review lead time",
        "departure reminder lead time",
        "route leader delegation",
        "outside-calendar blocking"
      ],
      payoutControls: [
        "weekly payout day",
        "instant payout preference"
      ],
      opsManagedControls: [
        "provider verification",
        "public marketplace visibility",
        "review escalation",
        "support interventions",
        "refund and dispute outcome controls"
      ],
      freshReauthRequiredControls: [
        "weekly payout day",
        "instant payout preference",
        "future bank account changes",
        "future payout account changes"
      ],
      launchGuardrails: [
        "Only the provider owner account can change business settings until team permissions are implemented.",
        "Ops verification controls public marketplace visibility and launch readiness.",
        "Payout-related settings require a fresh provider session.",
        "Open bookings should be protected from surprise radius, lead-time, calendar-blocking, or staffing changes."
      ],
      warnings
    };
  }

  public async listProviderVerificationQueue(): Promise<ProviderVerificationQueueItem[]> {
    const [providers, bookings] = await Promise.all([
      this.repository.listProviders(),
      this.repository.listBookings()
    ]);

    return providers
      .filter((provider) => provider.verificationStatus !== "verified")
      .map((provider) => {
        const openBookingCount = this.countOpenProviderBookings(provider.id, bookings);

        const guidance = this.buildProviderVerificationGuidance(
          provider,
          openBookingCount,
          this.buildProviderVerificationOperationalHistory(provider.id, bookings)
        );

        return {
          provider,
          openBookingCount,
          reviewCount: provider.reviewCount,
          guidance,
          onboardingPlan: this.buildProviderOnboardingAutomationPlan(provider, guidance)
        };
      })
      .sort((left, right) => {
        const rightSubmitted = right.provider.verificationSubmittedAt ?? right.provider.createdAt;
        const leftSubmitted = left.provider.verificationSubmittedAt ?? left.provider.createdAt;
        return rightSubmitted.localeCompare(leftSubmitted);
      });
  }

  private getOpsAutomationSweepLabel(sweepKey: OpsAutomationSweepKey) {
    switch (sweepKey) {
      case "provider-onboarding":
        return "Provider onboarding automation";
      case "support-ticket-escalations":
        return "Support ticket SLA escalations";
      case "launch-operations-task-notifications":
        return "Launch operations due-task notifications";
      case "launch-operations-task-escalations":
        return "Launch operations overdue-task escalations";
    }
  }

  private summarizeOpsAutomationSweepResult(input: {
    sweepKey: OpsAutomationSweepKey;
    response:
      | ProviderOnboardingAutomationSweepResponse
      | SupportOpsTicketEscalationSweepResponse
      | LaunchOperationsTaskNotificationSweepResponse
      | LaunchOperationsTaskEscalationSweepResponse;
  }) {
    if (input.sweepKey === "provider-onboarding") {
      const response = input.response as ProviderOnboardingAutomationSweepResponse;
      return {
        sentNotificationCount: response.sentNotificationCount,
        alreadySentCount: response.alreadySentCount,
        skippedCount: response.skippedActionCount
      };
    }
    if (input.sweepKey === "support-ticket-escalations") {
      const response = input.response as SupportOpsTicketEscalationSweepResponse;
      return {
        sentNotificationCount: response.sentNotificationCount,
        alreadySentCount: response.alreadySentCount,
        skippedCount: response.skippedEscalationCount
      };
    }
    if (input.sweepKey === "launch-operations-task-notifications") {
      const response = input.response as LaunchOperationsTaskNotificationSweepResponse;
      return {
        sentNotificationCount: response.sentNotificationCount,
        alreadySentCount: response.alreadySentCount,
        skippedCount: response.skippedNotificationCount
      };
    }
    const response = input.response as LaunchOperationsTaskEscalationSweepResponse;
    return {
      sentNotificationCount: response.sentNotificationCount,
      alreadySentCount: response.alreadySentCount,
      skippedCount: response.skippedEscalationCount
    };
  }

  public async runDueOpsAutomation(
    actor: AuthIdentityRecord,
    payload: ProcessOpsAutomationRunRequest = {}
  ): Promise<OpsAutomationRunResponse> {
    if (actor.role !== "ops") {
      throw new HttpError(403, "Only operations can run ops automation sweeps");
    }

    const asOfMs = payload.asOfIso ? Date.parse(payload.asOfIso) : Date.now();
    if (!Number.isFinite(asOfMs)) {
      throw new HttpError(400, "asOfIso must be a valid ISO timestamp");
    }
    const asOfIso = new Date(asOfMs).toISOString();
    const supportedSweepKeys: OpsAutomationSweepKey[] = [
      "provider-onboarding",
      "support-ticket-escalations",
      "launch-operations-task-notifications",
      "launch-operations-task-escalations"
    ];
    const requestedSweepKeys = payload.sweepKeys?.length
      ? [...new Set(payload.sweepKeys)]
      : supportedSweepKeys;
    const unsupportedSweepKeys = requestedSweepKeys.filter(
      (sweepKey) => !supportedSweepKeys.includes(sweepKey)
    );
    if (unsupportedSweepKeys.length > 0) {
      throw new HttpError(400, `Unsupported ops automation sweep key: ${unsupportedSweepKeys.join(", ")}`);
    }

    const items: OpsAutomationSweepRunItem[] = [];
    for (const sweepKey of requestedSweepKeys) {
      const startedAt = new Date().toISOString();
      try {
        if (sweepKey === "provider-onboarding") {
          const response = await this.processProviderOnboardingAutomation(actor, {
            asOfIso,
            dryRun: Boolean(payload.dryRun)
          });
          const summary = this.summarizeOpsAutomationSweepResult({ sweepKey, response });
          items.push({
            sweepKey,
            label: this.getOpsAutomationSweepLabel(sweepKey),
            status: "completed",
            startedAt,
            completedAt: new Date().toISOString(),
            dryRun: Boolean(payload.dryRun),
            ...summary,
            providerOnboarding: response
          });
          continue;
        }
        if (sweepKey === "support-ticket-escalations") {
          const response = await this.escalateStaleOpsSupportTickets(actor, {
            asOfIso,
            dryRun: Boolean(payload.dryRun)
          });
          const summary = this.summarizeOpsAutomationSweepResult({ sweepKey, response });
          items.push({
            sweepKey,
            label: this.getOpsAutomationSweepLabel(sweepKey),
            status: "completed",
            startedAt,
            completedAt: new Date().toISOString(),
            dryRun: Boolean(payload.dryRun),
            ...summary,
            supportTicketEscalations: response
          });
          continue;
        }
        if (sweepKey === "launch-operations-task-notifications") {
          const response = await this.notifyDueLaunchOperationsTasks(actor, {
            asOfIso,
            dryRun: Boolean(payload.dryRun)
          });
          const summary = this.summarizeOpsAutomationSweepResult({ sweepKey, response });
          items.push({
            sweepKey,
            label: this.getOpsAutomationSweepLabel(sweepKey),
            status: "completed",
            startedAt,
            completedAt: new Date().toISOString(),
            dryRun: Boolean(payload.dryRun),
            ...summary,
            launchOperationsTaskNotifications: response
          });
          continue;
        }

        const response = await this.escalateOverdueLaunchOperationsTasks(actor, {
          asOfIso,
          dryRun: Boolean(payload.dryRun)
        });
        const summary = this.summarizeOpsAutomationSweepResult({ sweepKey, response });
        items.push({
          sweepKey,
          label: this.getOpsAutomationSweepLabel(sweepKey),
          status: "completed",
          startedAt,
          completedAt: new Date().toISOString(),
          dryRun: Boolean(payload.dryRun),
          ...summary,
          launchOperationsTaskEscalations: response
        });
      } catch (error) {
        items.push({
          sweepKey,
          label: this.getOpsAutomationSweepLabel(sweepKey),
          status: "failed",
          startedAt,
          completedAt: new Date().toISOString(),
          dryRun: Boolean(payload.dryRun),
          sentNotificationCount: 0,
          alreadySentCount: 0,
          skippedCount: 0,
          errorMessage: error instanceof Error ? error.message : "Unknown sweep failure"
        });
      }
    }

    const generatedAt = new Date().toISOString();
    const runId = crypto.randomUUID();
    const response: OpsAutomationRunResponse = {
      runId,
      generatedAt,
      asOfIso,
      dryRun: Boolean(payload.dryRun),
      requestedSweepKeys,
      requestedSweepCount: requestedSweepKeys.length,
      completedSweepCount: items.filter((item) => item.status === "completed").length,
      failedSweepCount: items.filter((item) => item.status === "failed").length,
      sentNotificationCount: items.reduce((sum, item) => sum + item.sentNotificationCount, 0),
      alreadySentCount: items.reduce((sum, item) => sum + item.alreadySentCount, 0),
      skippedCount: items.reduce((sum, item) => sum + item.skippedCount, 0),
      items
    };
    await this.repository.createOpsAutomationRun({
      ...response,
      id: runId,
      createdAt: generatedAt,
      createdByOpsUserId: actor.userId,
      createdByOpsEmail: actor.email
    });
    return response;
  }

  public async listOpsAutomationRuns(): Promise<OpsAutomationRunsResponse> {
    const runs = await this.repository.listOpsAutomationRuns();
    return {
      generatedAt: new Date().toISOString(),
      runs
    };
  }

  public async processProviderOnboardingAutomation(
    actor: AuthIdentityRecord,
    payload: ProcessProviderOnboardingAutomationRequest = {}
  ): Promise<ProviderOnboardingAutomationSweepResponse> {
    if (actor.role !== "ops") {
      throw new HttpError(403, "Only operations can process provider onboarding automation");
    }

    const asOfMs = payload.asOfIso ? Date.parse(payload.asOfIso) : Date.now();
    if (!Number.isFinite(asOfMs)) {
      throw new HttpError(400, "asOfIso must be a valid ISO timestamp");
    }
    const asOfIso = new Date(asOfMs).toISOString();
    const [allProviders, bookings, opsUsers] = await Promise.all([
      this.repository.listProviders(),
      this.repository.listBookings(),
      this.repository.listOpsUsers()
    ]);
    const providers = allProviders.filter(
      (provider) =>
        provider.verificationStatus !== "verified" &&
        (!payload.providerId || provider.id === payload.providerId)
    );

    if (payload.providerId && providers.length === 0) {
      const exists = allProviders.some((provider) => provider.id === payload.providerId);
      if (!exists) {
        throw new HttpError(404, "Provider not found");
      }
    }

    const items: ProviderOnboardingAutomationSweepItem[] = [];

    for (const provider of providers) {
      const openBookingCount = this.countOpenProviderBookings(provider.id, bookings);
      const guidance = this.buildProviderVerificationGuidance(
        provider,
        openBookingCount,
        this.buildProviderVerificationOperationalHistory(provider.id, bookings)
      );
      const plan = this.buildProviderOnboardingAutomationPlan(provider, guidance);

      for (const action of plan.automationActions) {
        const recipients =
          action.owner === "provider"
            ? [{ recipientId: provider.id, recipientRole: "provider" as const }]
            : action.owner === "ops"
              ? opsUsers.map((opsUser) => ({
                  recipientId: opsUser.id,
                  recipientRole: "ops" as const
                }))
              : [{ recipientId: provider.id, recipientRole: "provider" as const }];

        for (const recipient of recipients) {
          items.push(
            await this.processProviderOnboardingAutomationAction({
              provider,
              planStage: plan.stage,
              action,
              recipientId: recipient.recipientId,
              recipientRole: recipient.recipientRole,
              asOfMs,
              dryRun: Boolean(payload.dryRun),
              includeFuture: Boolean(payload.includeFuture)
            })
          );
        }
      }
    }

    const dueActionCount = items.filter((item) =>
      ["sent", "already-sent", "dry-run", "no-notification"].includes(item.notificationStatus)
    ).length;
    const sentNotificationCount = items.filter((item) => item.notificationStatus === "sent").length;
    const alreadySentCount = items.filter((item) => item.notificationStatus === "already-sent").length;

    return {
      generatedAt: new Date().toISOString(),
      asOfIso,
      dryRun: Boolean(payload.dryRun),
      providerCount: providers.length,
      actionCount: items.length,
      dueActionCount,
      sentNotificationCount,
      alreadySentCount,
      skippedActionCount: items.length - dueActionCount,
      items
    };
  }

  public async updateProviderProfile(
    providerId: string,
    payload: UpdateProviderProfileRequest
  ): Promise<ProviderProfile> {
    const provider = await this.repository.findProviderById(providerId);
    if (!provider) {
      throw new Error("Provider not found");
    }

    const companyName = payload.companyName?.trim() ?? provider.companyName;
    if (companyName.length < 2) {
      throw new Error("companyName must be at least 2 characters");
    }

    const bio = payload.bio?.trim() ?? provider.bio;
    if (bio.length < 10) {
      throw new Error("bio must be at least 10 characters");
    }

    const rawYearsExperience = payload.yearsExperience ?? provider.yearsExperience ?? 0;
    const yearsExperience = Math.round(rawYearsExperience);
    if (!Number.isFinite(yearsExperience) || yearsExperience < 0 || yearsExperience > 60) {
      throw new Error("yearsExperience must be between 0 and 60");
    }

    const categories = payload.categories
      ? Array.from(new Set(payload.categories))
      : provider.categories;
    if (categories.length === 0) {
      throw new Error("Select at least one service category");
    }

    const profileUpdates: Partial<ProviderProfile> = {
      companyName,
      bio,
      yearsExperience,
      categories
    };

    const resubmissionUpdates = this.buildRejectedProviderVerificationResubmissionUpdates(provider, profileUpdates);
    const updatedProvider = await this.repository.updateProvider(provider.id, {
      ...profileUpdates,
      ...resubmissionUpdates
    });

    if (!updatedProvider) {
      throw new Error("Provider profile could not be updated");
    }

    if (resubmissionUpdates.verificationStatus === "pending-review") {
      await this.notifyOpsProviderVerificationResubmitted(updatedProvider, "profile-fixes");
    }

    return this.getProviderProfile(provider.id);
  }

  public async reviewProviderVerification(
    payload: ReviewProviderVerificationRequest
  ): Promise<ProviderProfile> {
    const provider = await this.repository.findProviderById(payload.providerId);
    if (!provider) {
      throw new HttpError(404, "Provider not found");
    }

    const notes = payload.notes?.trim();
    if (payload.action === "reject" && !notes) {
      throw new HttpError(400, "Notes are required when rejecting a provider verification");
    }

    if (payload.action === "approve") {
      const credentialReadiness = evaluateProviderCredentialReadiness(
        provider,
        provider.credentials ?? []
      );
      if (!credentialReadiness.ready) {
        throw new HttpError(
          409,
          `Provider cannot be approved until required credentials are verified: ${credentialReadiness.warnings.join(" ")}`
        );
      }
      const bookings = await this.repository.listBookings();
      const openBookingCount = this.countOpenProviderBookings(provider.id, bookings);
      const guidance = this.buildProviderVerificationGuidance(
        provider,
        openBookingCount,
        this.buildProviderVerificationOperationalHistory(provider.id, bookings)
      );

      if (guidance.requiresApprovalOverrideNotes && !this.isDetailedProviderApprovalOverrideNote(notes)) {
        throw new HttpError(
          400,
          guidance.approvalOverridePrompt ??
            "Add a specific approval override note before sending this provider live."
        );
      }
    }

    const updatedProvider = await this.repository.updateProvider(provider.id, {
      verificationStatus: payload.action === "approve" ? "verified" : "rejected",
      verificationReviewedAt: new Date().toISOString(),
      verificationNotes:
        notes ??
        (payload.action === "approve"
          ? "Ops verified the business profile for public marketplace visibility."
          : provider.verificationNotes)
    });

    if (!updatedProvider) {
      throw new HttpError(500, "Provider verification could not be updated");
    }

    await this.createNotification({
      recipientId: updatedProvider.id,
      recipientRole: "provider",
      category: "account",
      title:
        payload.action === "approve"
          ? "Business verification approved"
          : "Business verification needs updates",
      body:
        payload.action === "approve"
          ? "Your business is now verified and visible in YardMatch search results."
          : notes ??
            "Ops reviewed the business profile and left notes before it can go live in search.",
      actionHref: "/provider/management"
    });

    return updatedProvider;
  }

  public async submitProviderCredential(
    providerId: string,
    payload: SubmitProviderCredentialRequest
  ): Promise<ProviderProfile> {
    const provider = await this.repository.findProviderById(providerId);
    if (!provider) {
      throw new HttpError(404, "Provider not found");
    }
    const jurisdiction = (payload.jurisdiction ?? provider.address.state).trim().toUpperCase();
    if (!jurisdiction) {
      throw new HttpError(400, "Credential jurisdiction is required");
    }
    if (!payload.referenceNumber?.trim() && !payload.documentUrl?.trim()) {
      throw new HttpError(400, "A credential reference number or document URL is required");
    }
    if (payload.issuedAt && !Number.isFinite(Date.parse(payload.issuedAt))) {
      throw new HttpError(400, "issuedAt must be a valid ISO timestamp");
    }
    if (payload.expiresAt && !Number.isFinite(Date.parse(payload.expiresAt))) {
      throw new HttpError(400, "expiresAt must be a valid ISO timestamp");
    }
    if (
      payload.issuedAt &&
      payload.expiresAt &&
      Date.parse(payload.expiresAt) <= Date.parse(payload.issuedAt)
    ) {
      throw new HttpError(400, "Credential expiration must be after its issue date");
    }

    const existing = (provider.credentials ?? []).find(
      (credential) =>
        credential.type === payload.type && credential.jurisdiction === jurisdiction
    );
    const credential: ProviderCredential = {
      id: existing?.id ?? crypto.randomUUID(),
      providerId,
      type: payload.type,
      status: "pending-review",
      jurisdiction,
      referenceNumber: payload.referenceNumber?.trim() || undefined,
      documentUrl: payload.documentUrl?.trim() || undefined,
      issuedAt: payload.issuedAt,
      expiresAt: payload.expiresAt,
      submittedAt: new Date().toISOString()
    };
    await this.repository.upsertProviderCredential(credential);
    await this.repository.updateProvider(providerId, {
      verificationStatus:
        provider.verificationStatus === "verified" ? "pending-review" : provider.verificationStatus,
      verificationSubmittedAt: new Date().toISOString(),
      verificationReviewedAt: undefined
    });
    return this.getProviderProfile(providerId);
  }

  public async reviewProviderCredential(
    opsUserId: string,
    payload: ReviewProviderCredentialRequest
  ): Promise<ProviderProfile> {
    const provider = await this.repository.findProviderById(payload.providerId);
    if (!provider) {
      throw new HttpError(404, "Provider not found");
    }
    const credential = (provider.credentials ?? []).find(
      (candidate) => candidate.id === payload.credentialId
    );
    if (!credential) {
      throw new HttpError(404, "Provider credential not found");
    }
    const notes = payload.notes?.trim();
    if (payload.action === "reject" && !notes) {
      throw new HttpError(400, "Review notes are required when rejecting a credential");
    }
    await this.repository.upsertProviderCredential({
      ...credential,
      status: payload.action === "verify" ? "verified" : "rejected",
      reviewedAt: new Date().toISOString(),
      reviewedByOpsUserId: opsUserId,
      reviewNotes: notes
    });
    return this.getProviderProfile(provider.id);
  }

  private buildProviderVerificationGuidance(
    provider: ProviderProfile,
    openBookingCount: number,
    operationalHistory: ProviderVerificationOperationalHistory
  ): ProviderVerificationQueueItem["guidance"] {
    const checklist: ProviderVerificationQueueItem["guidance"]["checklist"] = [];
    const credentialReadiness = evaluateProviderCredentialReadiness(
      provider,
      provider.credentials ?? []
    );

    const normalizedBio = provider.bio.trim();
    checklist.push({
      key: "profile-completeness",
      label: "Profile completeness",
      status: normalizedBio.length >= 40 ? "ready" : normalizedBio.length >= 20 ? "review" : "missing",
      detail:
        normalizedBio.length >= 40
          ? "The business profile has enough detail for a customer-facing launch listing."
          : normalizedBio.length >= 20
            ? "The profile exists, but the business description is still thin for a trust-sensitive launch."
            : "The business profile needs a fuller customer-facing description before going live."
    });

    checklist.push({
      key: "service-scope",
      label: "Service scope fit",
      status: provider.categories.length >= 1 ? "ready" : "missing",
      detail:
        provider.categories.length >= 1
          ? `Current service scope: ${provider.categories
              .map((category) => this.titleCaseCategory(category))
              .join(", ")}.`
          : "No launch service categories are configured yet."
    });

    checklist.push({
      key: "launch-area-fit",
      label: "Launch-area fit",
      status:
        provider.serviceRadiusMiles <= 25 ? "ready" : provider.serviceRadiusMiles <= 35 ? "review" : "missing",
      detail:
        provider.serviceRadiusMiles <= 25
          ? `A ${provider.serviceRadiusMiles}-mile radius is still tight enough for a dense launch route.`
          : provider.serviceRadiusMiles <= 35
            ? `A ${provider.serviceRadiusMiles}-mile radius may be workable, but ops should confirm it does not stretch the launch pocket too thin.`
            : `A ${provider.serviceRadiusMiles}-mile radius is too broad for the current launch density and needs tightening before go-live.`
    });

    checklist.push({
      key: "experience-signal",
      label: "Experience signal",
      status:
        provider.yearsExperience >= 3 ? "ready" : provider.yearsExperience >= 1 ? "review" : "missing",
      detail:
        provider.yearsExperience >= 3
          ? `${provider.yearsExperience} years of experience is strong enough for launch visibility.`
          : provider.yearsExperience >= 1
            ? `${provider.yearsExperience} year of experience may be acceptable, but ops should confirm service reliability expectations directly.`
            : "Experience history is too light to approve without a stronger ops review."
    });

    checklist.push({
      key: "operational-readiness",
      label: "Operational readiness",
      status:
        provider.minimumBookingLeadHours <= 24 && openBookingCount <= 5
          ? "ready"
          : provider.minimumBookingLeadHours <= 48 && openBookingCount <= 8
            ? "review"
            : "missing",
      detail:
        provider.minimumBookingLeadHours <= 24 && openBookingCount <= 5
          ? `Lead time and current open workload look manageable for launch.`
          : provider.minimumBookingLeadHours <= 48 && openBookingCount <= 8
            ? `Ops should confirm that a ${provider.minimumBookingLeadHours}-hour lead window and ${openBookingCount} open bookings will not create a fragile launch experience.`
            : `Current lead-time or workload settings suggest the provider is not yet ready for a low-friction launch experience.`
    });

    checklist.push({
      key: "service-quality-expectations",
      label: "Service-quality expectations",
      status:
        provider.yearsExperience >= 3
          ? "ready"
          : provider.yearsExperience >= 1
            ? "review"
            : "missing",
      detail:
        provider.yearsExperience >= 3
          ? "Experience level is high enough that ops can hold this provider to normal launch service-quality expectations."
          : provider.yearsExperience >= 1
            ? "Ops should confirm how this provider handles evidence, service recovery, and customer communication before go-live."
            : "Service-quality expectations need an explicit ops review before this provider should be exposed publicly."
    });

    const incidentCount =
      operationalHistory.disputedBookingCount +
      operationalHistory.refundedBookingCount +
      operationalHistory.activeExceptionCount;
    const issueRate = incidentCount / Math.max(operationalHistory.totalBookingCount, 1);
    checklist.push({
      key: "incident-history",
      label: "Incident history",
      status:
        incidentCount === 0
          ? "ready"
          : operationalHistory.disputedBookingCount > 0 ||
              operationalHistory.refundedBookingCount > 0 ||
              issueRate >= 0.34
            ? "missing"
            : "review",
      detail:
        incidentCount === 0
          ? "No disputes, refunds, or active field exceptions are attached to this provider's YardMatch history."
          : operationalHistory.disputedBookingCount > 0 || operationalHistory.refundedBookingCount > 0
            ? `${incidentCount} incident${incidentCount === 1 ? "" : "s"} are attached to this provider, including ${operationalHistory.disputedBookingCount} dispute${operationalHistory.disputedBookingCount === 1 ? "" : "s"} and ${operationalHistory.refundedBookingCount} refunded booking${operationalHistory.refundedBookingCount === 1 ? "" : "s"}. Ops should confirm the recovery story before public visibility.`
            : `${operationalHistory.activeExceptionCount} active field exception${operationalHistory.activeExceptionCount === 1 ? "" : "s"} are attached to this provider. Ops should confirm those issues are resolved before launch traffic increases.`
    });

    checklist.push({
      key: "intervention-readiness",
      label: "Intervention readiness",
      status:
        provider.crewReviewLeadHours >= 24 &&
        provider.departureReminderLeadMinutes >= 30 &&
        Boolean(provider.staffingMode)
          ? "ready"
          : provider.crewReviewLeadHours >= 12 && provider.departureReminderLeadMinutes > 0
            ? "review"
            : "missing",
      detail:
        provider.crewReviewLeadHours >= 24 &&
        provider.departureReminderLeadMinutes >= 30 &&
        Boolean(provider.staffingMode)
          ? "The current staffing and route settings are aligned with launch intervention and escalation expectations."
          : provider.crewReviewLeadHours >= 12 && provider.departureReminderLeadMinutes > 0
            ? "Ops should confirm the provider can follow launch rules for late updates, exceptions, and support handoffs."
            : "Current staffing or route settings do not yet support the intervention standards expected during launch."
    });

    checklist.push({
      key: "legal-credentials",
      label: "Legal and insurance credentials",
      status: credentialReadiness.ready
        ? "ready"
        : credentialReadiness.pendingTypes.length > 0 &&
            credentialReadiness.missingTypes.length === 0 &&
            credentialReadiness.expiredTypes.length === 0
          ? "review"
          : "missing",
      detail: credentialReadiness.ready
        ? "All launch-required business, insurance, and category-specific credentials are verified and current."
        : credentialReadiness.warnings.join(" ")
    });

    const missingCount = checklist.filter((item) => item.status === "missing").length;
    const reviewCount = checklist.filter((item) => item.status === "review").length;
    const warnings: string[] = [];

    if (provider.serviceRadiusMiles > 25) {
      warnings.push("Confirm the real service pocket before exposing this provider in customer search.");
    }
    if (provider.minimumBookingLeadHours > 24) {
      warnings.push("Long lead-time settings may undercut the launch promise of fast managed booking.");
    }
    if (normalizedBio.length < 40) {
      warnings.push("The public profile still needs a stronger trust signal before launch traffic ramps.");
    }
    if (provider.yearsExperience < 3) {
      warnings.push("Confirm the provider understands the launch service-quality bar before approving public visibility.");
    }
    if (operationalHistory.disputedBookingCount > 0 || operationalHistory.refundedBookingCount > 0) {
      warnings.push("Review dispute and refund history before approving this provider for public launch visibility.");
    } else if (operationalHistory.activeExceptionCount > 0) {
      warnings.push("Resolve or document active field exceptions before scaling this provider's launch demand.");
    }
    if (provider.crewReviewLeadHours < 24 || provider.departureReminderLeadMinutes < 30) {
      warnings.push("Double-check late-update, exception, and staffing escalation readiness before go-live.");
    }
    warnings.push(...credentialReadiness.warnings);

    if (missingCount > 0) {
      return {
        recommendedAction: "reject",
        rationale:
          "One or more launch-readiness basics are missing, so ops should send this provider back with explicit changes before go-live.",
        warnings,
        checklist,
        requiresApprovalOverrideNotes: true,
        approvalOverridePrompt:
          "Document the specific missing launch-readiness gaps you reviewed and why approving this provider is still safe right now.",
        minimumApprovalOverrideNoteLength: MIN_PROVIDER_APPROVAL_OVERRIDE_NOTE_LENGTH,
        disallowedApprovalOverrideNotes: [...GENERIC_PROVIDER_APPROVAL_OVERRIDE_NOTES]
      };
    }

    if (reviewCount > 0) {
      return {
        recommendedAction: "manual-review",
        rationale:
          "The provider may be viable, but ops should confirm route density, service scope, and reliability expectations before approving public visibility.",
        warnings,
        checklist,
        requiresApprovalOverrideNotes: true,
        approvalOverridePrompt:
          "Document the specific launch-fit checks you completed and why this provider is still ready to go live despite the checklist watchouts.",
        minimumApprovalOverrideNoteLength: MIN_PROVIDER_APPROVAL_OVERRIDE_NOTE_LENGTH,
        disallowedApprovalOverrideNotes: [...GENERIC_PROVIDER_APPROVAL_OVERRIDE_NOTES]
      };
    }

    return {
      recommendedAction: "approve",
      rationale:
        "The profile, service scope, launch-area fit, and operational settings all look ready for recommendation-first launch visibility.",
      warnings,
      checklist,
      requiresApprovalOverrideNotes: false
    };
  }

  private buildProviderOnboardingAutomationPlan(
    provider: ProviderProfile,
    guidance: ProviderVerificationQueueItem["guidance"]
  ): ProviderVerificationQueueItem["onboardingPlan"] {
    const hasMissing = guidance.checklist.some((item) => item.status === "missing");
    const hasReview = guidance.checklist.some((item) => item.status === "review");
    const stage: ProviderVerificationQueueItem["onboardingPlan"]["stage"] =
      provider.verificationStatus === "verified"
        ? "verified-monitoring"
        : hasMissing || provider.verificationStatus === "rejected"
          ? "fixes-needed"
          : hasReview || guidance.recommendedAction === "manual-review"
            ? "ops-review"
            : "ready-for-approval";
    const profileItems = this.getProviderVerificationChecklistItems(guidance, [
      "profile-completeness",
      "service-scope",
      "experience-signal",
      "service-quality-expectations"
    ]);
    const dispatchItems = this.getProviderVerificationChecklistItems(guidance, [
      "launch-area-fit",
      "operational-readiness",
      "intervention-readiness"
    ]);
    const incidentItem = guidance.checklist.find((item) => item.key === "incident-history");
    const profileStatus = this.toProviderOnboardingStepStatus(profileItems);
    const dispatchStatus = this.toProviderOnboardingStepStatus(dispatchItems);
    const incidentStatus = incidentItem
      ? this.toProviderOnboardingStepStatus([incidentItem])
      : "complete";
    const opsReviewStatus =
      provider.verificationStatus === "verified"
        ? "complete"
        : hasMissing
          ? "blocked"
          : "ready";
    const launchPilotStatus =
      provider.verificationStatus === "verified"
        ? "complete"
        : guidance.recommendedAction === "approve"
          ? "ready"
          : "blocked";
    const monitoringStatus = provider.verificationStatus === "verified" ? "ready" : "blocked";
    const readyCount = guidance.checklist.filter((item) => item.status === "ready").length;
    const reviewCount = guidance.checklist.filter((item) => item.status === "review").length;
    const missingCount = guidance.checklist.filter((item) => item.status === "missing").length;
    const launchReadinessSignals = [
      `${readyCount} checklist item${readyCount === 1 ? "" : "s"} ready`,
      `${reviewCount} checklist item${reviewCount === 1 ? "" : "s"} need ops review`,
      `${missingCount} checklist item${missingCount === 1 ? "" : "s"} blocked`,
      `Recommended verification action: ${guidance.recommendedAction}`
    ];

    const steps: ProviderVerificationQueueItem["onboardingPlan"]["steps"] = [
      {
        key: "profile-fixes",
        title: "Profile and service-scope fixes",
        owner: "provider",
        status: profileStatus,
        detail:
          profileStatus === "complete"
            ? "Profile detail, service scope, experience, and service-quality expectations are launch-ready."
            : "Provider should update profile detail, service categories, experience signal, or service-quality expectations before ops approval.",
        automationTrigger:
          profileStatus === "complete"
            ? undefined
            : "Saving provider profile changes automatically sends a rejected business back into pending review."
      },
      {
        key: "dispatch-settings",
        title: "Dispatch and intervention settings",
        owner: "provider",
        status: dispatchStatus,
        detail:
          dispatchStatus === "complete"
            ? "Service radius, booking lead time, staffing review, and route reminders align with launch operations."
            : "Provider should tighten radius, lead time, staffing review, or route reminder settings before scaling launch demand.",
        automationTrigger:
          dispatchStatus === "complete"
            ? undefined
            : "Saving dispatch settings automatically resubmits a rejected business when launch settings materially improve."
      },
      {
        key: "incident-recovery",
        title: "Incident recovery documentation",
        owner: incidentStatus === "complete" ? "system" : "ops",
        status: incidentStatus,
        detail:
          incidentStatus === "complete"
            ? "No dispute, refund, or active field-exception history is blocking launch onboarding."
            : "Ops should document the recovery story for disputes, refunds, or active field exceptions before public visibility.",
        automationTrigger:
          incidentStatus === "complete"
            ? undefined
            : "Provider verification approval requires a detailed override note while incident history is unresolved."
      },
      {
        key: "ops-review",
        title: "Ops verification review",
        owner: "ops",
        status: opsReviewStatus,
        detail:
          opsReviewStatus === "complete"
            ? "Ops has already approved public marketplace visibility."
            : opsReviewStatus === "ready"
              ? "Ops can review checklist watchouts and choose approve or reject with a specific rationale."
              : "Ops review should wait until provider-owned launch-readiness blockers are addressed.",
        automationTrigger: "Provider verification queue ranks pending and rejected businesses by latest submitted update."
      },
      {
        key: "launch-pilot",
        title: "Narrow launch pilot",
        owner: "ops",
        status: launchPilotStatus,
        detail:
          launchPilotStatus === "complete"
            ? "Provider is verified and eligible for recommendation-first customer search."
            : launchPilotStatus === "ready"
              ? "Provider can be approved for a narrow launch pilot with normal support and payout guardrails."
              : "Launch pilot remains blocked until verification guidance no longer recommends rejection or manual review.",
        automationTrigger:
          launchPilotStatus === "ready"
            ? "Approving verification makes the provider visible in recommendation-first public search."
            : undefined
      },
      {
        key: "first-booking-monitoring",
        title: "First-booking monitoring",
        owner: "system",
        status: monitoringStatus,
        detail:
          monitoringStatus === "ready"
            ? "Monitor first bookings for disputes, refunds, active exceptions, crew gaps, and payout holds after go-live."
            : "Monitoring starts after verification approval and first launch bookings.",
        automationTrigger:
          monitoringStatus === "ready"
            ? "Booking, support, notification, payout, and verification summaries surface launch reliability issues automatically."
            : undefined
      }
    ];

    return {
      stage,
      recommendedAutomation: this.getProviderOnboardingRecommendedAutomation(stage, provider.verificationStatus),
      launchReadinessSignals,
      steps,
      automationActions: this.buildProviderOnboardingAutomationActions(provider, guidance, stage, steps)
    };
  }

  private buildProviderOnboardingAutomationActions(
    provider: ProviderProfile,
    guidance: ProviderVerificationQueueItem["guidance"],
    stage: ProviderVerificationQueueItem["onboardingPlan"]["stage"],
    steps: ProviderVerificationQueueItem["onboardingPlan"]["steps"]
  ): ProviderVerificationQueueItem["onboardingPlan"]["automationActions"] {
    const stepStatus = (key: ProviderVerificationQueueItem["onboardingPlan"]["steps"][number]["key"]) =>
      steps.find((step) => step.key === key)?.status ?? "blocked";
    const submittedAt = provider.verificationSubmittedAt ?? provider.createdAt;
    const dueAfter = (hours: number) => {
      const submittedMs = Date.parse(submittedAt);
      const baseMs = Number.isFinite(submittedMs) ? submittedMs : Date.parse(provider.createdAt);
      return new Date(baseMs + hours * 60 * 60 * 1000).toISOString();
    };
    const profileNeedsWork = stepStatus("profile-fixes") !== "complete";
    const dispatchNeedsWork = stepStatus("dispatch-settings") !== "complete";
    const incidentNeedsWork = stepStatus("incident-recovery") !== "complete";
    const profileBlocking = stepStatus("profile-fixes") === "blocked";
    const dispatchBlocking = stepStatus("dispatch-settings") === "blocked";
    const opsReady = stepStatus("ops-review") === "ready";
    const pilotReady = stepStatus("launch-pilot") === "ready";
    const profileChecklist = this.getProviderVerificationChecklistItems(guidance, [
      "profile-completeness",
      "service-scope",
      "experience-signal",
      "service-quality-expectations"
    ]);
    const dispatchChecklist = this.getProviderVerificationChecklistItems(guidance, [
      "launch-area-fit",
      "operational-readiness",
      "intervention-readiness"
    ]);

    return [
      {
        key: "provider-complete-profile",
        sourceStepKey: "profile-fixes",
        owner: "provider",
        status: profileNeedsWork ? "ready" : "completed",
        priority: profileChecklist.some((item) => item.status === "missing") ? "high" : "normal",
        title: "Complete launch profile fixes",
        detail: profileNeedsWork
          ? "Update customer-facing profile detail, service categories, experience, or service-quality commitments before ops approval."
          : "Profile and service-scope fixes are complete.",
        actionHref: "/provider/management",
        dueAtIso: profileNeedsWork ? dueAfter(48) : undefined,
        blockedByStepKeys: [],
        notificationTitle: profileNeedsWork ? "Provider profile fixes are due" : undefined,
        notificationBody: profileNeedsWork
          ? "Update the business profile so ops can continue launch verification."
          : undefined
      },
      {
        key: "provider-tighten-dispatch",
        sourceStepKey: "dispatch-settings",
        owner: "provider",
        status: dispatchNeedsWork ? "ready" : "completed",
        priority: dispatchChecklist.some((item) => item.status === "missing") ? "high" : "normal",
        title: "Tighten dispatch settings",
        detail: dispatchNeedsWork
          ? "Tighten launch radius, booking lead time, crew review, or route-reminder settings before customer demand scales."
          : "Dispatch and intervention settings are launch-ready.",
        actionHref: "/provider/management",
        dueAtIso: dispatchNeedsWork ? dueAfter(48) : undefined,
        blockedByStepKeys: [],
        notificationTitle: dispatchNeedsWork ? "Dispatch settings need launch updates" : undefined,
        notificationBody: dispatchNeedsWork
          ? "Adjust launch radius, lead time, staffing review, or route reminders so ops can continue verification."
          : undefined
      },
      {
        key: "ops-document-incident-recovery",
        sourceStepKey: "incident-recovery",
        owner: "ops",
        status: incidentNeedsWork ? "ready" : "completed",
        priority: incidentNeedsWork ? "urgent" : "low",
        title: "Document incident recovery",
        detail: incidentNeedsWork
          ? "Review disputes, refunds, or active field exceptions and document the recovery story before public visibility."
          : "Incident history is not blocking onboarding.",
        actionHref: "/ops/providers",
        dueAtIso: incidentNeedsWork ? dueAfter(24) : undefined,
        blockedByStepKeys: [],
        notificationTitle: incidentNeedsWork ? "Provider incident recovery needs review" : undefined,
        notificationBody: incidentNeedsWork
          ? `${provider.companyName} needs incident recovery documentation before launch approval.`
          : undefined
      },
      {
        key: "ops-review-launch-fit",
        sourceStepKey: "ops-review",
        owner: "ops",
        status: provider.verificationStatus === "verified" ? "completed" : opsReady ? "ready" : "blocked",
        priority: guidance.recommendedAction === "approve" ? "normal" : "high",
        title: "Review launch fit",
        detail: opsReady
          ? "Review checklist watchouts and approve or reject with an auditable rationale."
          : provider.verificationStatus === "verified"
            ? "Ops verification review is complete."
            : "Ops review is blocked until provider-owned launch-readiness fixes are addressed.",
        actionHref: "/ops/providers",
        dueAtIso: opsReady ? dueAfter(stage === "ready-for-approval" ? 24 : 48) : undefined,
        blockedByStepKeys: [
          ...(profileBlocking ? (["profile-fixes"] as const) : []),
          ...(dispatchBlocking ? (["dispatch-settings"] as const) : [])
        ],
        notificationTitle: opsReady ? "Provider verification is ready for review" : undefined,
        notificationBody: opsReady
          ? `${provider.companyName} is ready for launch-fit review in the provider verification queue.`
          : undefined
      },
      {
        key: "ops-approve-narrow-pilot",
        sourceStepKey: "launch-pilot",
        owner: "ops",
        status: provider.verificationStatus === "verified" ? "completed" : pilotReady ? "ready" : "blocked",
        priority: pilotReady ? "normal" : "low",
        title: "Approve narrow launch pilot",
        detail: pilotReady
          ? "Approve verification to make the provider eligible for recommendation-first customer search with launch guardrails."
          : provider.verificationStatus === "verified"
            ? "Provider is already eligible for recommendation-first public search."
            : "Narrow launch pilot waits until verification guidance no longer recommends rejection or manual review.",
        actionHref: "/ops/providers",
        dueAtIso: pilotReady ? dueAfter(24) : undefined,
        blockedByStepKeys: pilotReady ? [] : ["ops-review"],
        notificationTitle: pilotReady ? "Provider can enter a narrow launch pilot" : undefined,
        notificationBody: pilotReady
          ? `${provider.companyName} can be approved for a narrow launch pilot.`
          : undefined
      },
      {
        key: "system-monitor-first-bookings",
        sourceStepKey: "first-booking-monitoring",
        owner: "system",
        status: provider.verificationStatus === "verified" ? "queued" : "blocked",
        priority: provider.verificationStatus === "verified" ? "normal" : "low",
        title: "Monitor first launch bookings",
        detail:
          provider.verificationStatus === "verified"
            ? "Monitor early bookings for disputes, refunds, field exceptions, crew gaps, and payout holds."
            : "Monitoring starts after verification approval and launch bookings.",
        actionHref: "/ops/observability",
        blockedByStepKeys: provider.verificationStatus === "verified" ? [] : ["launch-pilot"]
      }
    ];
  }

  private getProviderVerificationChecklistItems(
    guidance: ProviderVerificationQueueItem["guidance"],
    keys: Array<ProviderVerificationQueueItem["guidance"]["checklist"][number]["key"]>
  ) {
    const keySet = new Set(keys);
    return guidance.checklist.filter((item) => keySet.has(item.key));
  }

  private toProviderOnboardingStepStatus(
    items: ProviderVerificationQueueItem["guidance"]["checklist"]
  ): ProviderVerificationQueueItem["onboardingPlan"]["steps"][number]["status"] {
    if (items.some((item) => item.status === "missing")) {
      return "blocked";
    }

    if (items.some((item) => item.status === "review")) {
      return "pending";
    }

    return "complete";
  }

  private getProviderOnboardingRecommendedAutomation(
    stage: ProviderVerificationQueueItem["onboardingPlan"]["stage"],
    verificationStatus: ProviderProfile["verificationStatus"]
  ) {
    switch (stage) {
      case "verified-monitoring":
        return "Keep automated monitoring active for early disputes, refunds, field exceptions, crew gaps, and payout holds while this provider handles launch demand.";
      case "ready-for-approval":
        return "Ops can approve verification or reject with notes; approval automatically makes this provider eligible for recommendation-first public search.";
      case "ops-review":
        return "Ops should review checklist watchouts, then document the launch-fit rationale before approving public visibility.";
      case "fixes-needed":
        return verificationStatus === "rejected"
          ? "Wait for provider profile or dispatch-setting changes; meaningful saves automatically move the business back into pending review."
          : "Send the provider specific profile, launch-area, incident, or dispatch-setting fixes before public search visibility.";
    }
  }

  private buildProviderVerificationStatusSummary(
    provider: ProviderProfile,
    guidance: ProviderVerificationQueueItem["guidance"],
    onboardingPlan = this.buildProviderOnboardingAutomationPlan(provider, guidance)
  ): ProviderVerificationStatusSummary {
    const nextSteps = this.buildProviderVerificationNextSteps(
      guidance.checklist,
      provider.verificationStatus
    );

    if (provider.verificationStatus === "verified") {
      return {
        headline: "Your business is verified and visible in search.",
        summary:
          nextSteps.length > 0
            ? "Customers can already discover this business in public YardMatch search results. Keep the flagged launch details current so the listing stays in good standing."
            : "Customers can now discover this business in public YardMatch search results.",
        nextSteps,
        checklist: guidance.checklist,
        onboardingPlan
      };
    }

    if (provider.verificationStatus === "rejected") {
      return {
        headline: "Your business needs a few updates before it can go live.",
        summary:
          provider.verificationNotes?.trim() ??
          "Ops reviewed the business and needs the items below updated before it can be shown to customers.",
        nextSteps,
        checklist: guidance.checklist,
        onboardingPlan
      };
    }

    if (provider.verificationReviewedAt && provider.verificationNotes?.trim()) {
      return {
        headline: "Your business is back in review after the latest updates.",
        summary: `Ops is re-reviewing the business. Last review note: ${provider.verificationNotes.trim()}`,
        nextSteps,
        checklist: guidance.checklist,
        onboardingPlan
      };
    }

    return {
      headline: "Your business is pending review before it appears in search.",
      summary:
        guidance.recommendedAction === "manual-review"
          ? "Ops is checking route fit, service scope, and reliability details before this business goes live."
          : "Ops will review the business profile, service area, and marketplace details before customers can book.",
      nextSteps,
      checklist: guidance.checklist,
      onboardingPlan
    };
  }

  private buildProviderVerificationNextSteps(
    checklist: ProviderVerificationQueueItem["guidance"]["checklist"],
    verificationStatus: ProviderProfile["verificationStatus"]
  ) {
    const steps = checklist
      .filter((item) => item.status !== "ready")
      .map((item) => this.getProviderVerificationNextStep(item.key));
    const uniqueSteps = Array.from(new Set(steps));

    if (verificationStatus === "rejected" && uniqueSteps.length > 0) {
      return [
        "Update the profile or dispatch settings below and save them to send the business back into ops review automatically.",
        ...uniqueSteps
      ];
    }

    return uniqueSteps;
  }

  private getProviderVerificationNextStep(
    key: ProviderVerificationQueueItem["guidance"]["checklist"][number]["key"]
  ) {
    switch (key) {
      case "profile-completeness":
        return "Expand the business description with enough detail to explain service quality, reliability, and what customers should expect.";
      case "service-scope":
        return "Add at least one launch service category so GreenRain knows what work this business is ready to fulfill.";
      case "launch-area-fit":
        return "Tighten the service radius to the launch pocket the team can reliably serve right now.";
      case "experience-signal":
        return "Update the years-of-experience detail so ops has a clearer reliability signal before go-live.";
      case "operational-readiness":
        return "Lower the minimum booking lead time or clear enough workload headroom to keep launch booking promises realistic.";
      case "service-quality-expectations":
        return "Be ready to handle evidence requests, service recovery, and customer communication at the launch service standard.";
      case "incident-history":
        return "Work with ops to document recent disputes, refunds, or active field exceptions and confirm what changed before public launch visibility.";
      case "intervention-readiness":
        return "Set staffing mode, crew review timing, and departure reminders so late updates and field exceptions can be handled cleanly.";
      case "legal-credentials":
        return "Submit current business-registration, insurance, and category-specific credential evidence for ops review before public launch visibility.";
    }
  }

  private isDetailedProviderApprovalOverrideNote(note: string | undefined) {
    const normalized = note?.trim().replace(/\s+/g, " ").toLowerCase();
    if (!normalized || normalized.length < MIN_PROVIDER_APPROVAL_OVERRIDE_NOTE_LENGTH) {
      return false;
    }

    return !this.isGenericProviderApprovalOverrideNote(normalized);
  }

  private isGenericProviderApprovalOverrideNote(normalized: string) {
    return GENERIC_PROVIDER_APPROVAL_OVERRIDE_NOTES.includes(
      normalized as (typeof GENERIC_PROVIDER_APPROVAL_OVERRIDE_NOTES)[number]
    );
  }

  private countOpenProviderBookings(providerId: string, bookings: Booking[]) {
    return bookings.filter(
      (booking) =>
        booking.providerId === providerId &&
        booking.status !== "completed" &&
        booking.status !== "cancelled" &&
        booking.status !== "refunded"
    ).length;
  }

  private buildProviderVerificationOperationalHistory(
    providerId: string,
    bookings: Booking[]
  ): ProviderVerificationOperationalHistory {
    const providerBookings = bookings.filter((booking) => booking.providerId === providerId);

    return {
      totalBookingCount: providerBookings.length,
      disputedBookingCount: providerBookings.filter((booking) => booking.status === "disputed").length,
      refundedBookingCount: providerBookings.filter((booking) => booking.status === "refunded").length,
      activeExceptionCount: providerBookings.filter((booking) => Boolean(booking.activeExceptionType)).length
    };
  }

  private buildRejectedProviderVerificationResubmissionUpdates(
    provider: ProviderProfile,
    updates: Partial<ProviderProfile>
  ): Partial<ProviderProfile> {
    if (!this.shouldResubmitRejectedProviderVerification(provider, updates)) {
      return {};
    }

    return {
      verificationStatus: "pending-review",
      verificationSubmittedAt: new Date().toISOString()
    };
  }

  private async notifyOpsProviderVerificationResubmitted(
    provider: ProviderProfile,
    sourceStepKey: "profile-fixes" | "dispatch-settings"
  ): Promise<void> {
    const opsUsers = await this.repository.listOpsUsers();
    const fixedArea =
      sourceStepKey === "profile-fixes" ? "profile and service-scope updates" : "dispatch-setting updates";

    await Promise.all(
      opsUsers.map((opsUser) =>
        this.createNotification({
          recipientId: opsUser.id,
          recipientRole: "ops",
          category: "account",
          title: "Provider verification resubmitted",
          body: `${provider.companyName} made ${fixedArea} and is back in the provider verification queue.`,
          actionHref: "/ops/providers"
        })
      )
    );
  }

  private async processProviderOnboardingAutomationAction(input: {
    provider: ProviderProfile;
    planStage: ProviderOnboardingAutomationSweepItem["stage"];
    action: ProviderOnboardingAutomationAction;
    recipientId: string;
    recipientRole: AppNotification["recipientRole"];
    asOfMs: number;
    dryRun: boolean;
    includeFuture: boolean;
  }): Promise<ProviderOnboardingAutomationSweepItem> {
    const baseItem = {
      providerId: input.provider.id,
      companyName: input.provider.companyName,
      stage: input.planStage,
      actionKey: input.action.key,
      sourceStepKey: input.action.sourceStepKey,
      owner: input.action.owner,
      actionStatus: input.action.status,
      priority: input.action.priority,
      dueAtIso: input.action.dueAtIso,
      actionHref: input.action.actionHref,
      notificationTitle: input.action.notificationTitle,
      notificationBody: input.action.notificationBody,
      recipientId: input.recipientId,
      recipientRole: input.recipientRole
    } satisfies Omit<ProviderOnboardingAutomationSweepItem, "notificationStatus" | "reason" | "notificationId">;

    if (input.action.status === "completed") {
      return {
        ...baseItem,
        notificationStatus: "completed",
        reason: "Action is already completed."
      };
    }
    if (input.action.status === "blocked") {
      return {
        ...baseItem,
        notificationStatus: "blocked",
        reason: "Action is blocked by unfinished onboarding steps."
      };
    }

    const dueMs = input.action.dueAtIso ? Date.parse(input.action.dueAtIso) : input.asOfMs;
    const isDue = input.includeFuture || !Number.isFinite(dueMs) || dueMs <= input.asOfMs;
    if (!isDue) {
      return {
        ...baseItem,
        notificationStatus: "not-due",
        reason: "Action has a future due date and includeFuture was not requested."
      };
    }

    if (!input.action.notificationTitle || !input.action.notificationBody) {
      return {
        ...baseItem,
        notificationStatus: "no-notification",
        reason: "Action is due, but it has no notification copy to send."
      };
    }

    const marker = this.buildProviderOnboardingAutomationNotificationMarker(
      input.provider.id,
      input.action.key
    );
    const existingNotification = (await this.repository.listNotificationsByRecipient(input.recipientId)).find(
      (notification) =>
        notification.category === "account" &&
        notification.actionHref === input.action.actionHref &&
        notification.body.includes(marker)
    );
    if (existingNotification) {
      return {
        ...baseItem,
        notificationStatus: "already-sent",
        notificationId: existingNotification.id,
        reason: "A matching onboarding automation notification already exists."
      };
    }

    if (input.dryRun) {
      return {
        ...baseItem,
        notificationStatus: "dry-run",
        reason: "Dry run requested; no notification was created."
      };
    }

    const notification = await this.createNotification({
      recipientId: input.recipientId,
      recipientRole: input.recipientRole,
      category: "account",
      title: input.action.notificationTitle,
      body: `${input.action.notificationBody}\n\n${marker}`,
      actionHref: input.action.actionHref
    });

    return {
      ...baseItem,
      notificationStatus: "sent",
      notificationId: notification.id,
      reason: "Onboarding automation notification created."
    };
  }

  private buildProviderOnboardingAutomationNotificationMarker(
    providerId: string,
    actionKey: ProviderOnboardingAutomationAction["key"]
  ) {
    return `Onboarding automation: ${providerId}/${actionKey}`;
  }

  private async processLaunchOperationsTaskNotification(input: {
    task: LaunchOperationsTask;
    recipientId?: string;
    recipientRole?: AppNotification["recipientRole"];
    asOfMs: number;
    dryRun: boolean;
    includeFuture: boolean;
  }): Promise<LaunchOperationsTaskNotificationSweepItem> {
    const notificationTitle = `Launch ops task: ${input.task.title}`;
    const notificationBody =
      `${input.task.detail} ${input.task.recommendedAction} ` +
      `Due ${this.formatShortDate(input.task.dueAtIso)} for ${input.task.city}, ${input.task.state} ${input.task.postalCode}.`;
    const baseItem = {
      taskId: input.task.id,
      recommendationKey: input.task.recommendationKey,
      pocketKey: input.task.pocketKey,
      city: input.task.city,
      state: input.task.state,
      postalCode: input.task.postalCode,
      priority: input.task.priority,
      owner: input.task.owner,
      taskStatus: input.task.status,
      dueAtIso: input.task.dueAtIso,
      recipientId: input.recipientId,
      recipientRole: input.recipientRole,
      notificationTitle,
      notificationBody
    } satisfies Omit<
      LaunchOperationsTaskNotificationSweepItem,
      "notificationStatus" | "reason" | "notificationId"
    >;

    if (input.task.status === "completed") {
      return {
        ...baseItem,
        notificationStatus: "completed",
        reason: "Task is already completed."
      };
    }
    if (input.task.status === "cancelled") {
      return {
        ...baseItem,
        notificationStatus: "cancelled",
        reason: "Task is cancelled."
      };
    }
    if (!input.recipientId || !input.recipientRole) {
      return {
        ...baseItem,
        notificationStatus: "no-recipient",
        reason: "No ops recipient is available for this launch operations task."
      };
    }

    const dueMs = Date.parse(input.task.dueAtIso);
    const isDue = input.includeFuture || !Number.isFinite(dueMs) || dueMs <= input.asOfMs;
    if (!isDue) {
      return {
        ...baseItem,
        notificationStatus: "not-due",
        reason: "Task has a future due date and includeFuture was not requested."
      };
    }

    const marker = this.buildLaunchOperationsTaskNotificationMarker(input.task.id);
    const existingNotification = (await this.repository.listNotificationsByRecipient(input.recipientId)).find(
      (notification) =>
        notification.category === "support" &&
        notification.actionHref === "/ops" &&
        notification.body.includes(marker)
    );
    if (existingNotification) {
      return {
        ...baseItem,
        notificationStatus: "already-sent",
        notificationId: existingNotification.id,
        reason: "A matching launch operations task notification already exists."
      };
    }

    if (input.dryRun) {
      return {
        ...baseItem,
        notificationStatus: "dry-run",
        reason: "Dry run requested; no notification was created."
      };
    }

    const notification = await this.createNotification({
      recipientId: input.recipientId,
      recipientRole: input.recipientRole,
      category: "support",
      title: notificationTitle,
      body: `${notificationBody}\n\n${marker}`,
      actionHref: "/ops"
    });

    return {
      ...baseItem,
      notificationStatus: "sent",
      notificationId: notification.id,
      reason: "Launch operations task notification created."
    };
  }

  private buildLaunchOperationsTaskNotificationMarker(taskId: string) {
    return `Launch operations task: ${taskId}`;
  }

  private getLaunchOperationsTaskEscalationThresholdHours(priority: LaunchOperationsTask["priority"]) {
    if (priority === "urgent") {
      return 2;
    }
    if (priority === "high") {
      return 12;
    }
    return 24;
  }

  private async processLaunchOperationsTaskEscalation(input: {
    task: LaunchOperationsTask;
    recipientId?: string;
    recipientRole?: AppNotification["recipientRole"];
    asOfMs: number;
    dryRun: boolean;
  }): Promise<LaunchOperationsTaskEscalationSweepItem> {
    const thresholdHours = this.getLaunchOperationsTaskEscalationThresholdHours(input.task.priority);
    const dueMs = Date.parse(input.task.dueAtIso);
    const overdueHours = Number.isFinite(dueMs)
      ? Number(Math.max(0, (input.asOfMs - dueMs) / (60 * 60 * 1000)).toFixed(2))
      : 0;
    const notificationTitle = `Launch ops escalation: ${input.task.title}`;
    const notificationBody =
      `${input.task.detail} ${input.task.recommendedAction} ` +
      `This ${input.task.priority} task is ${overdueHours} hours past due for ` +
      `${input.task.city}, ${input.task.state} ${input.task.postalCode}; ` +
      `the escalation threshold is ${thresholdHours} hours.`;
    const baseItem = {
      taskId: input.task.id,
      recommendationKey: input.task.recommendationKey,
      pocketKey: input.task.pocketKey,
      city: input.task.city,
      state: input.task.state,
      postalCode: input.task.postalCode,
      priority: input.task.priority,
      owner: input.task.owner,
      taskStatus: input.task.status,
      dueAtIso: input.task.dueAtIso,
      overdueHours,
      escalationThresholdHours: thresholdHours,
      recipientId: input.recipientId,
      recipientRole: input.recipientRole,
      notificationTitle,
      notificationBody
    } satisfies Omit<
      LaunchOperationsTaskEscalationSweepItem,
      "escalationStatus" | "reason" | "notificationId"
    >;

    if (input.task.status === "completed") {
      return {
        ...baseItem,
        escalationStatus: "completed",
        reason: "Task is already completed."
      };
    }
    if (input.task.status === "cancelled") {
      return {
        ...baseItem,
        escalationStatus: "cancelled",
        reason: "Task is cancelled."
      };
    }
    if (!Number.isFinite(dueMs)) {
      return {
        ...baseItem,
        escalationStatus: "not-overdue",
        reason: "Task due date is not a valid ISO timestamp."
      };
    }
    if (input.asOfMs < dueMs + thresholdHours * 60 * 60 * 1000) {
      return {
        ...baseItem,
        escalationStatus: "not-overdue",
        reason: "Task has not passed its escalation threshold."
      };
    }
    if (!input.recipientId || !input.recipientRole) {
      return {
        ...baseItem,
        escalationStatus: "no-recipient",
        reason: "No ops recipient is available for this launch operations task escalation."
      };
    }

    const marker = this.buildLaunchOperationsTaskEscalationMarker(input.task.id);
    const existingNotification = (await this.repository.listNotificationsByRecipient(input.recipientId)).find(
      (notification) =>
        notification.category === "support" &&
        notification.actionHref === "/ops" &&
        notification.body.includes(marker)
    );
    if (existingNotification) {
      return {
        ...baseItem,
        escalationStatus: "already-sent",
        notificationId: existingNotification.id,
        reason: "A matching launch operations task escalation notification already exists."
      };
    }

    if (input.dryRun) {
      return {
        ...baseItem,
        escalationStatus: "dry-run",
        reason: "Dry run requested; no escalation notification was created."
      };
    }

    const notification = await this.createNotification({
      recipientId: input.recipientId,
      recipientRole: input.recipientRole,
      category: "support",
      title: notificationTitle,
      body: `${notificationBody}\n\n${marker}`,
      actionHref: "/ops"
    });

    return {
      ...baseItem,
      escalationStatus: "sent",
      notificationId: notification.id,
      reason: "Launch operations task escalation notification created."
    };
  }

  private buildLaunchOperationsTaskEscalationMarker(taskId: string) {
    return `Launch operations task escalation: ${taskId}`;
  }

  private shouldResubmitRejectedProviderVerification(
    provider: ProviderProfile,
    updates: Partial<ProviderProfile>
  ) {
    if (provider.verificationStatus !== "rejected") {
      return false;
    }

    return (
      (updates.companyName !== undefined && updates.companyName !== provider.companyName) ||
      (updates.bio !== undefined && updates.bio !== provider.bio) ||
      (updates.yearsExperience !== undefined && updates.yearsExperience !== provider.yearsExperience) ||
      (updates.serviceRadiusMiles !== undefined && updates.serviceRadiusMiles !== provider.serviceRadiusMiles) ||
      (updates.minimumBookingLeadHours !== undefined &&
        updates.minimumBookingLeadHours !== provider.minimumBookingLeadHours) ||
      (updates.staffingMode !== undefined && updates.staffingMode !== provider.staffingMode) ||
      (updates.crewReviewLeadHours !== undefined &&
        updates.crewReviewLeadHours !== provider.crewReviewLeadHours) ||
      (updates.departureReminderLeadMinutes !== undefined &&
        updates.departureReminderLeadMinutes !== provider.departureReminderLeadMinutes) ||
      (updates.routeLeaderMode !== undefined && updates.routeLeaderMode !== provider.routeLeaderMode) ||
      (updates.categories !== undefined && !this.haveSameProviderCategories(updates.categories, provider.categories))
    );
  }

  private haveSameProviderCategories(
    left: ProviderProfile["categories"],
    right: ProviderProfile["categories"]
  ) {
    if (left.length !== right.length) {
      return false;
    }

    const leftSorted = [...left].sort();
    const rightSorted = [...right].sort();
    return leftSorted.every((value, index) => value === rightSorted[index]);
  }

  public async updateCrewPreferences(
    crewMemberId: string,
    payload: UpdateCrewPreferencesRequest
  ): Promise<CrewMemberProfile> {
    const crewMember = await this.repository.findCrewMemberById(crewMemberId);
    if (!crewMember) {
      throw new Error("Crew member not found");
    }

    const nextMiles = payload.willingToTravelMiles ?? crewMember.willingToTravelMiles;
    if (nextMiles < 5 || nextMiles > 60) {
      throw new Error("willingToTravelMiles must be between 5 and 60");
    }

    const nextDays =
      payload.availableWeekdays ?? crewMember.availableWeekdays ?? ["Mon", "Tue", "Wed", "Thu", "Fri"];
    if (nextDays.length === 0) {
      throw new Error("At least one available day is required");
    }

    const updatedCrewMember = await this.repository.updateCrewMember(crewMemberId, {
      categories: payload.categories ?? crewMember.categories,
      availableWeekdays: nextDays,
      willingToTravelMiles: nextMiles,
      preferredSchedule: payload.preferredSchedule ?? crewMember.preferredSchedule,
      hasOwnEquipment: payload.hasOwnEquipment ?? crewMember.hasOwnEquipment,
      winterWorkEnabled: payload.winterWorkEnabled ?? crewMember.winterWorkEnabled ?? true
    });

    if (!updatedCrewMember) {
      throw new Error("Crew preferences could not be updated");
    }

    return updatedCrewMember;
  }

  public async getProviderStaffingOverview(providerId: string): Promise<ProviderStaffingOverview> {
    const provider = await this.getProviderProfile(providerId);
    const jobs = await this.buildProviderStaffingSummaries(provider);
    return {
      provider,
      jobs
    };
  }

  public async reviewCrewMatch(
    providerId: string,
    payload: ReviewCrewMatchRequest
  ): Promise<CrewMatchCandidate> {
    const match = await this.repository.findCrewMatchById(payload.crewMatchId);
    if (!match) {
      throw new Error("Crew match not found");
    }

    if (match.providerId !== providerId) {
      throw new Error("Only the provider can review this crew match");
    }

    if (payload.action === "accept") {
      const provider = await this.repository.findProviderById(providerId);
      if (!provider) {
        throw new HttpError(404, "Provider not found");
      }
      const readiness = evaluateProviderCredentialReadiness(
        provider,
        provider.credentials ?? []
      );
      if (!readiness.crewEngagementAllowed) {
        throw new HttpError(
          409,
          "Crew cannot be engaged until the provider has verified workers-compensation coverage or a counsel-approved exemption."
        );
      }
    }

    const nextStatus = payload.action === "accept" ? "accepted" : "denied";
    const updatedMatch = await this.repository.updateCrewMatch(match.id, {
      status: nextStatus,
      autoAccepted: false,
      reviewedAt: new Date().toISOString()
    });

    if (!updatedMatch) {
      throw new Error("Crew match could not be updated");
    }

    const booking = await this.repository.findBookingById(match.bookingId);
    if (
      booking?.assignedRouteLeaderCrewMemberId === updatedMatch.crewMemberId &&
      updatedMatch.status !== "accepted"
    ) {
      await this.repository.updateBooking(booking.id, {
        assignedRouteLeaderCrewMemberId: undefined
      });
    }

    await this.refreshCrewMemberStatus(updatedMatch.crewMemberId);
    const provider = await this.repository.findProviderById(providerId);
    if (provider) {
      await this.createNotification({
        recipientId: updatedMatch.crewMemberId,
        recipientRole: "crew-member",
        category: "staffing",
        title: payload.action === "accept" ? "You were accepted for a job" : "A crew match was declined",
        body:
          payload.action === "accept"
            ? `${provider.companyName} added you to an upcoming ${this.titleCaseCategory(updatedMatch.categories[0] ?? "lawn-mowing")} job.`
            : `${provider.companyName} passed on one of your staffing matches.`,
        actionHref: "/crew/schedule"
      });
    }

    return updatedMatch;
  }

  public async assignBookingRouteLeader(
    providerId: string,
    payload: AssignBookingRouteLeaderRequest
  ): Promise<Booking> {
    const booking = await this.repository.findBookingById(payload.bookingId);
    if (!booking || booking.providerId !== providerId) {
      throw new HttpError(404, "Booking not found for this provider");
    }

    const provider = await this.repository.findProviderById(providerId);
    if (!provider) {
      throw new HttpError(404, "Provider not found");
    }

    if (provider.routeLeaderMode !== "accepted-crew-fallback") {
      throw new HttpError(400, "Enable accepted crew fallback before assigning a crew route leader");
    }

    if (
      booking.status === "completed" ||
      booking.status === "cancelled" ||
      booking.status === "refunded"
    ) {
      throw new HttpError(400, "Route leaders can only be assigned on active bookings");
    }

    if (booking.onRouteConfirmedAt) {
      throw new HttpError(400, "Route leader assignment is locked once the route has started");
    }

    const acceptedMatches = (await this.repository.listCrewMatches()).filter(
      (match) => match.bookingId === booking.id && match.status === "accepted"
    );

    if (payload.crewMemberId) {
      const assignedMatch = acceptedMatches.find((match) => match.crewMemberId === payload.crewMemberId);
      if (!assignedMatch) {
        throw new HttpError(400, "Only accepted crew members can be assigned as route leader");
      }

      const updatedBooking = await this.repository.updateBooking(booking.id, {
        assignedRouteLeaderCrewMemberId: payload.crewMemberId
      });

      if (!updatedBooking) {
        throw new HttpError(500, "Route leader could not be assigned");
      }

      const crewMember = await this.repository.findCrewMemberById(payload.crewMemberId);
      if (crewMember) {
        await this.createNotification({
          recipientId: crewMember.id,
          recipientRole: "crew-member",
          category: "staffing",
          title: "You were assigned as route leader",
          body: `${provider.companyName} chose you to start and share the route for an upcoming ${this.titleCaseCategory(booking.category).toLowerCase()} job.`,
          actionHref: "/crew/schedule"
        });
      }

      return updatedBooking;
    }

    const clearedBooking = await this.repository.updateBooking(booking.id, {
      assignedRouteLeaderCrewMemberId: undefined
    });
    if (!clearedBooking) {
      throw new HttpError(500, "Route leader assignment could not be updated");
    }
    return clearedBooking;
  }

  public async getCrewMatchesForCrew(crewMemberId: string): Promise<CrewMatchesResponse> {
    const crewMember = await this.repository.findCrewMemberById(crewMemberId);
    if (!crewMember) {
      throw new Error("Crew member not found");
    }

    await this.reconcileCrewMatches();

    const [matches, providers, bookings] = await Promise.all([
      this.repository.listCrewMatches(),
      this.repository.listProviders(),
      this.repository.listBookings()
    ]);

    const crewMatches = matches
      .filter((match) => match.crewMemberId === crewMemberId)
      .flatMap((match) => {
        const provider = providers.find((item) => item.id === match.providerId);
        const booking = bookings.find((item) => item.id === match.bookingId);
        if (!provider || !booking) {
          return [];
        }

        const acceptedMatchCount = matches.filter(
          (candidate) => candidate.bookingId === booking.id && candidate.status === "accepted"
        ).length;
        return [this.buildCrewMatchSummary(match, provider, booking, acceptedMatchCount)];
      })
      .sort((left, right) => left.scheduledStartIso.localeCompare(right.scheduledStartIso));

    return {
      crewMember,
      availabilityConstraints: this.buildCrewAvailabilityConstraintsSummary(crewMember, crewMatches),
      assignmentForecast: this.buildCrewAssignmentForecast(crewMember, crewMatches),
      matches: crewMatches
    };
  }

  public async cancelCrewMatch(
    crewMemberId: string,
    payload: CancelCrewMatchRequest
  ): Promise<CrewMatchesResponse["matches"][number]> {
    const [crewMember, match] = await Promise.all([
      this.repository.findCrewMemberById(crewMemberId),
      this.repository.findCrewMatchById(payload.crewMatchId)
    ]);

    if (!crewMember) {
      throw new HttpError(404, "Crew member not found");
    }

    if (!match || match.crewMemberId !== crewMemberId) {
      throw new HttpError(404, "Crew match not found");
    }

    if (match.status !== "accepted") {
      throw new HttpError(400, "Only accepted assignments can be cancelled by the crew member");
    }

    const [provider, booking] = await Promise.all([
      this.repository.findProviderById(match.providerId),
      this.repository.findBookingById(match.bookingId)
    ]);

    if (!provider || !booking) {
      throw new HttpError(404, "Assignment details could not be found");
    }

    if (booking.status === "completed" || booking.status === "cancelled" || booking.status === "refunded") {
      throw new HttpError(400, "This assignment is no longer active");
    }

    if (booking.onRouteConfirmedAt || booking.status === "in-progress") {
      throw new HttpError(400, "This assignment can no longer be cancelled because work is already underway");
    }

    if (new Date(booking.scheduledStartIso).getTime() <= Date.now()) {
      throw new HttpError(400, "This assignment can no longer be cancelled because the start time has passed");
    }

    const cancelledAt = new Date().toISOString();
    const cancellationReason = payload.reason?.trim() || "Crew member cancelled this assignment.";
    const updatedMatch = await this.repository.updateCrewMatch(match.id, {
      status: "cancelled-by-crew",
      reviewedAt: cancelledAt,
      cancelledAt,
      cancellationReason
    });

    if (!updatedMatch) {
      throw new HttpError(500, "Crew assignment could not be cancelled");
    }

    if (booking.assignedRouteLeaderCrewMemberId === crewMemberId) {
      await this.repository.updateBooking(booking.id, {
        assignedRouteLeaderCrewMemberId: undefined
      });
    }

    await this.repository.updateCrewMember(crewMemberId, {
      cancellationCount: (crewMember.cancellationCount ?? 0) + 1,
      lastCancellationAt: cancelledAt
    });

    const existingConversation = await this.repository.findProviderCrewConversationByCrewMatchId(match.id);
    if (existingConversation) {
      await this.repository.updateProviderCrewConversation(existingConversation.id, {
        status: "cancelled-by-crew",
        updatedAt: cancelledAt,
        lastMessagePreview: `${crewMember.fullName} cancelled this assignment.`
      });
    }

    await this.refreshCrewMemberStatus(crewMemberId);
    await this.reconcileCrewMatches(provider.id);

    await this.createNotification({
      recipientId: provider.id,
      recipientRole: "provider",
      category: "staffing",
      title: "Crew member cancelled",
      body: `${crewMember.fullName} cancelled an accepted assignment for ${this.titleCaseCategory(booking.category).toLowerCase()}.`,
      actionHref: "/provider/management"
    });

    await this.createNotification({
      recipientId: crewMemberId,
      recipientRole: "crew-member",
      category: "staffing",
      title: "Assignment cancelled",
      body: "This cancellation was recorded and may lower your future match priority if it becomes a pattern.",
      actionHref: "/crew/schedule"
    });

    const acceptedMatchCount = (await this.repository.listCrewMatches()).filter(
      (candidate) => candidate.bookingId === booking.id && candidate.status === "accepted"
    ).length;
    const refreshedBooking = (await this.repository.findBookingById(booking.id)) ?? booking;
    return this.buildCrewMatchSummary(updatedMatch, provider, refreshedBooking, acceptedMatchCount);
  }

  public async listProviderCrewConversations(
    actor: AuthIdentityRecord
  ): Promise<ProviderCrewConversation[]> {
    const conversations = await this.repository.listProviderCrewConversations();
    return conversations.filter((conversation) =>
      actor.role === "provider"
        ? conversation.providerId === actor.userId
        : conversation.crewMemberId === actor.userId
    );
  }

  private buildCrewMatchSummary(
    match: CrewMatchCandidate,
    provider: ProviderProfile,
    booking: Booking,
    acceptedMatchCount: number
  ): CrewMatchesResponse["matches"][number] {
    const resolvedRouteLeaderCrewMemberId =
      booking.assignedRouteLeaderCrewMemberId ??
      (acceptedMatchCount === 1 && match.status === "accepted" ? match.crewMemberId : undefined);
    const requiresRouteLeaderAssignment =
      provider.routeLeaderMode === "accepted-crew-fallback" &&
      acceptedMatchCount > 1 &&
      !booking.assignedRouteLeaderCrewMemberId;
    return {
      id: match.id,
      bookingId: match.bookingId,
      providerId: match.providerId,
      providerCompanyName: provider.companyName,
      providerPhone: provider.phone,
      category: booking.category,
      serviceAddress: booking.serviceAddress,
      scheduledStartIso: booking.scheduledStartIso,
      scheduledEndIso: booking.scheduledEndIso,
      bookingStatus: booking.status,
      assignedRouteLeaderCrewMemberId: resolvedRouteLeaderCrewMemberId,
      isAssignedRouteLeader: resolvedRouteLeaderCrewMemberId === match.crewMemberId,
      requiresRouteLeaderAssignment,
      onRouteConfirmedAt: booking.onRouteConfirmedAt,
      lateNoticeSentAt: booking.lateNoticeSentAt,
      lateEtaIso: booking.lateEtaIso,
      lateReason: booking.lateReason,
      activeExceptionType: booking.activeExceptionType,
      activeExceptionReportedAt: booking.activeExceptionReportedAt,
      activeExceptionNotes: booking.activeExceptionNotes,
      disputedAt: booking.disputedAt,
      disputeReason: booking.disputeReason,
      disputedByRole: booking.disputedByRole,
      beforeEvidenceCount: this.countBookingEvidence(booking, "before"),
      afterEvidenceCount: this.countBookingEvidence(booking, "after"),
      status: match.status,
      hourlyRateCents: match.hourlyRateCents,
      canChat: match.status === "pending-provider-review" || match.status === "accepted",
      summary:
        match.status === "accepted"
          ? `${provider.companyName} accepted you for this job.`
          : match.status === "denied"
            ? `${provider.companyName} passed on this match.`
            : match.status === "cancelled-by-crew"
              ? `You cancelled this accepted assignment with ${provider.companyName}.`
              : `${provider.companyName} is reviewing your fit for this job.`,
      cancellationReason: match.cancellationReason,
      cancelledAt: match.cancelledAt
    };
  }

  private buildCrewAvailabilityConstraintsSummary(
    crewMember: CrewMemberProfile,
    matches: CrewMatchesResponse["matches"]
  ): CrewMatchesResponse["availabilityConstraints"] {
    const allWeekdays: CrewAvailabilityDay[] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const availableWeekdays = crewMember.availableWeekdays ?? ["Mon", "Tue", "Wed", "Thu", "Fri"];
    const unavailableWeekdays = allWeekdays.filter((day) => !availableWeekdays.includes(day));
    const nowMs = Date.now();
    const acceptedUpcoming = matches.filter(
      (match) =>
        match.status === "accepted" &&
        Date.parse(match.scheduledEndIso) >= nowMs &&
        match.bookingStatus !== "completed" &&
        match.bookingStatus !== "cancelled" &&
        match.bookingStatus !== "refunded"
    );
    const activeAssignmentCount = acceptedUpcoming.filter((match) =>
      ["confirmed", "in-progress", "disputed"].includes(match.bookingStatus)
    ).length;
    const routeLeaderAssignmentCount = acceptedUpcoming.filter((match) => match.isAssignedRouteLeader).length;
    const constraints = [
      `${availableWeekdays.length} available weekday${availableWeekdays.length === 1 ? "" : "s"} are configured.`,
      `Travel radius is capped at ${crewMember.willingToTravelMiles} mile${crewMember.willingToTravelMiles === 1 ? "" : "s"}.`,
      `Preferred schedule is ${crewMember.preferredSchedule}.`,
      crewMember.hasOwnEquipment ? "Crew member has their own equipment." : "Crew member relies on provider-supplied equipment.",
      crewMember.winterWorkEnabled ?? true
        ? "Winter work categories are enabled."
        : "Winter work categories are disabled."
    ];
    const warnings: string[] = [];
    const guidance: string[] = [];

    if (crewMember.status === "off-duty") {
      warnings.push("Crew member is currently off duty and should not receive new staffing matches.");
    }
    if (availableWeekdays.length <= 2) {
      warnings.push("Limited available weekdays may reduce match volume and route flexibility.");
    }
    if (crewMember.willingToTravelMiles < 10) {
      warnings.push("Short travel radius may exclude otherwise good launch-area assignments.");
    }
    if (!crewMember.hasOwnEquipment) {
      guidance.push("Prioritize providers that can supply equipment or jobs where provider-owned equipment is expected.");
    }
    if (!(crewMember.winterWorkEnabled ?? true)) {
      guidance.push("Do not expect snow or ice-control matches unless winter work is re-enabled.");
    }
    if (activeAssignmentCount > 0) {
      guidance.push(
        `${activeAssignmentCount} active assignment${activeAssignmentCount === 1 ? "" : "s"} should be considered before adding more same-day work.`
      );
    }
    if (routeLeaderAssignmentCount > 0) {
      guidance.push(
        `${routeLeaderAssignmentCount} accepted assignment${routeLeaderAssignmentCount === 1 ? "" : "s"} currently designate this crew member as route leader.`
      );
    }
    if (guidance.length === 0) {
      guidance.push("Current availability settings are broad enough for launch staffing recommendations.");
    }

    const availabilityStatus =
      crewMember.status === "off-duty"
        ? "off-duty"
        : activeAssignmentCount >= 3
          ? "busy"
          : availableWeekdays.length <= 2 || crewMember.willingToTravelMiles < 10
            ? "limited"
            : "open";

    return {
      availableWeekdays,
      unavailableWeekdays,
      serviceCategoryCount: crewMember.categories.length,
      willingToTravelMiles: crewMember.willingToTravelMiles,
      preferredSchedule: crewMember.preferredSchedule,
      hasOwnEquipment: crewMember.hasOwnEquipment,
      winterWorkEnabled: crewMember.winterWorkEnabled ?? true,
      acceptedUpcomingCount: acceptedUpcoming.length,
      activeAssignmentCount,
      routeLeaderAssignmentCount,
      availabilityStatus,
      constraints,
      guidance,
      warnings
    };
  }

  private buildCrewAssignmentForecast(
    crewMember: CrewMemberProfile,
    matches: CrewMatchesResponse["matches"]
  ): CrewMatchesResponse["assignmentForecast"] {
    const nowMs = Date.now();
    const nextSevenDaysMs = nowMs + 7 * 24 * 60 * 60 * 1000;
    const activeBookingStatuses: BookingStatus[] = ["confirmed", "in-progress", "disputed"];
    const upcomingMatches = matches.filter(
      (match) =>
        Date.parse(match.scheduledEndIso) >= nowMs &&
        match.bookingStatus !== "completed" &&
        match.bookingStatus !== "cancelled" &&
        match.bookingStatus !== "refunded"
    );
    const acceptedUpcoming = upcomingMatches.filter((match) => match.status === "accepted");
    const pendingReview = upcomingMatches.filter((match) => match.status === "pending-provider-review");
    const activeAssignments = acceptedUpcoming.filter((match) => activeBookingStatuses.includes(match.bookingStatus));
    const nextAssignment = [...acceptedUpcoming].sort(
      (left, right) => Date.parse(left.scheduledStartIso) - Date.parse(right.scheduledStartIso)
    )[0];
    const acceptedNextSevenDays = acceptedUpcoming.filter((match) => Date.parse(match.scheduledStartIso) <= nextSevenDaysMs);
    const routeLeaderAssignmentCount = acceptedUpcoming.filter((match) => match.isAssignedRouteLeader).length;
    const warnings: string[] = [];
    const guidance: string[] = [];

    const riskyAcceptedMatches = acceptedUpcoming.filter(
      (match) =>
        match.requiresRouteLeaderAssignment ||
        Boolean(match.activeExceptionType) ||
        Boolean(match.lateNoticeSentAt) ||
        Boolean(match.disputedAt)
    );
    if (riskyAcceptedMatches.length > 0) {
      warnings.push(
        `${riskyAcceptedMatches.length} accepted assignment${riskyAcceptedMatches.length === 1 ? "" : "s"} need attention for route leader, late update, exception, or dispute context.`
      );
    }
    if ((crewMember.cancellationCount ?? 0) > 0) {
      warnings.push(`${crewMember.cancellationCount} prior call-off${crewMember.cancellationCount === 1 ? "" : "s"} remain visible in staffing priority.`);
    }
    if (pendingReview.length > 0) {
      guidance.push(
        `${pendingReview.length} pending match${pendingReview.length === 1 ? "" : "es"} may become assignments if providers approve them.`
      );
    }
    if (acceptedUpcoming.length > 0) {
      guidance.push(
        `${acceptedUpcoming.length} accepted upcoming assignment${acceptedUpcoming.length === 1 ? "" : "s"} are currently on the crew schedule.`
      );
    } else {
      guidance.push("No accepted upcoming assignments are currently scheduled.");
    }
    if (routeLeaderAssignmentCount > 0) {
      guidance.push(
        `${routeLeaderAssignmentCount} upcoming assignment${routeLeaderAssignmentCount === 1 ? "" : "s"} designate this crew member as route leader.`
      );
    }

    const workloadBand =
      acceptedNextSevenDays.length >= 5
        ? "full"
        : acceptedNextSevenDays.length >= 3
          ? "steady"
          : acceptedNextSevenDays.length >= 1
            ? "light"
            : "open";
    const forecastStatus =
      riskyAcceptedMatches.length > 0
        ? "attention"
        : activeAssignments.length > 0
          ? "active"
          : acceptedUpcoming.length > 0
            ? "scheduled"
            : pendingReview.length > 0
              ? "pending-review"
              : "open";

    return {
      upcomingAssignmentCount: upcomingMatches.length,
      acceptedUpcomingCount: acceptedUpcoming.length,
      pendingReviewCount: pendingReview.length,
      activeAssignmentCount: activeAssignments.length,
      routeLeaderAssignmentCount,
      nextAssignmentIso: nextAssignment?.scheduledStartIso,
      nextProviderCompanyName: nextAssignment?.providerCompanyName,
      nextServiceCategory: nextAssignment?.category,
      nextAssignmentStatus: nextAssignment?.status,
      nextBookingStatus: nextAssignment?.bookingStatus,
      forecastStatus,
      workloadBand,
      guidance,
      warnings
    };
  }

  private resolveDelegatedCrewRouteLeaderId(
    booking: Booking,
    acceptedMatches: CrewMatchCandidate[]
  ): string | undefined {
    if (
      booking.assignedRouteLeaderCrewMemberId &&
      acceptedMatches.some((match) => match.crewMemberId === booking.assignedRouteLeaderCrewMemberId)
    ) {
      return booking.assignedRouteLeaderCrewMemberId;
    }

    return acceptedMatches.length === 1 ? acceptedMatches[0]?.crewMemberId : undefined;
  }

  private async resolveProviderAssistantCrewMatch(
    crewNameQuery: string | undefined,
    matches: CrewMatchCandidate[]
  ): Promise<(CrewMatchCandidate & { crewMemberName: string }) | undefined> {
    const query = crewNameQuery?.trim().toLowerCase();
    if (!query) {
      return undefined;
    }

    const crewMembers = await Promise.all(
      matches.map(async (match) => ({
        ...match,
        crewMemberId: match.crewMemberId,
        crewMemberName: (await this.repository.findCrewMemberById(match.crewMemberId))?.fullName ?? "Crew member"
      }))
    );

    const normalizedQuery = query.replace(/^the\s+/i, "").trim();
    const exact = crewMembers.find((crewMember) => crewMember.crewMemberName.toLowerCase() === normalizedQuery);
    if (exact) {
      return exact;
    }

    const partialMatches = crewMembers.filter((crewMember) => {
      const normalizedName = crewMember.crewMemberName.toLowerCase();
      return normalizedName.includes(normalizedQuery) || normalizedQuery.includes(normalizedName);
    });

    return partialMatches.length === 1 ? partialMatches[0] : undefined;
  }

  private async resolveProviderAssistantCrewMessageTargets(
    booking: Booking,
    action: ParsedProviderAssistantAction,
    matches: CrewMatchCandidate[]
  ): Promise<Array<CrewMatchCandidate & { crewMemberName: string }>> {
    const acceptedMatches = matches.filter((match) => match.status === "accepted");

    if (action.crewMessageTarget === "route-leader") {
      const routeLeaderCrewMemberId = this.resolveDelegatedCrewRouteLeaderId(booking, acceptedMatches);
      if (!routeLeaderCrewMemberId) {
        return [];
      }

      const routeLeaderMatch = acceptedMatches.find((match) => match.crewMemberId === routeLeaderCrewMemberId);
      const crewMember = routeLeaderMatch
        ? await this.repository.findCrewMemberById(routeLeaderMatch.crewMemberId)
        : undefined;
      return routeLeaderMatch
        ? [
            {
              ...routeLeaderMatch,
              crewMemberName: crewMember?.fullName ?? "Crew member"
            }
          ]
        : [];
    }

    if (action.crewMessageTarget === "accepted-crew") {
      return Promise.all(
        acceptedMatches.map(async (match) => ({
          ...match,
          crewMemberName: (await this.repository.findCrewMemberById(match.crewMemberId))?.fullName ?? "Crew member"
        }))
      );
    }

    const namedTarget = await this.resolveProviderAssistantCrewMatch(action.crewMessageCrewNameQuery, matches);
    return namedTarget ? [namedTarget] : [];
  }

  private getProviderAssistantCrewMessageTargetFailure(action: ParsedProviderAssistantAction): {
    previewLabel: string;
    previewMessage: string;
  } {
    if (action.crewMessageTarget === "route-leader") {
      return {
        previewLabel: "Route leader not assigned",
        previewMessage:
          "Assign or accept a route leader on this job before sending a route-leader message from the provider assistant."
      };
    }

    if (action.crewMessageTarget === "accepted-crew") {
      return {
        previewLabel: "No accepted crew to message",
        previewMessage:
          "Accept at least one crew member on this job before sending a whole-crew message from the provider assistant."
      };
    }

    return {
      previewLabel: "Crew message target not found",
      previewMessage:
        "The assistant could not match that crew name to a pending or accepted crew member on this job."
    };
  }

  private formatProviderAssistantCrewMessageTarget(
    action: ParsedProviderAssistantAction,
    matches: Array<CrewMatchCandidate & { crewMemberName: string }>
  ): string {
    if (action.crewMessageTarget === "route-leader") {
      return `route leader ${matches[0]?.crewMemberName ?? "crew member"}`;
    }

    if (action.crewMessageTarget === "accepted-crew") {
      return `accepted crew (${matches.length})`;
    }

    return matches[0]?.crewMemberName ?? "crew member";
  }

  public async getProviderCrewConversationThread(
    actor: AuthIdentityRecord,
    threadId?: string,
    crewMatchId?: string
  ): Promise<ProviderCrewConversationThread> {
    const thread = threadId
      ? await this.repository.findProviderCrewConversationById(threadId)
      : crewMatchId
        ? await this.repository.findProviderCrewConversationByCrewMatchId(crewMatchId)
        : undefined;

    if (!thread) {
      throw new Error("Conversation not found");
    }

    this.assertCanAccessConversation(actor, thread);
    const messages = await this.repository.listProviderCrewMessages(thread.id);
    return {
      thread,
      messages
    };
  }

  public async sendProviderCrewMessage(
    actor: AuthIdentityRecord,
    payload: SendProviderCrewMessageRequest
  ): Promise<ProviderCrewConversationThread> {
    const body = payload.body.trim();
    if (body.length === 0) {
      throw new Error("Message body is required");
    }

    let thread = payload.threadId
      ? await this.repository.findProviderCrewConversationById(payload.threadId)
      : payload.crewMatchId
        ? await this.repository.findProviderCrewConversationByCrewMatchId(payload.crewMatchId)
        : undefined;

    if (!thread && !payload.crewMatchId) {
      throw new Error("threadId or crewMatchId is required");
    }

    if (!thread && payload.crewMatchId) {
      const match = await this.repository.findCrewMatchById(payload.crewMatchId);
      if (!match) {
        throw new Error("Crew match not found");
      }

      if (match.status !== "pending-provider-review" && match.status !== "accepted") {
        throw new Error("Chat is only available for pending or accepted crew matches");
      }

      const provider = await this.repository.findProviderById(match.providerId);
      const crewMember = await this.repository.findCrewMemberById(match.crewMemberId);
      if (!provider || !crewMember) {
        throw new Error("Conversation participants could not be loaded");
      }

      if (
        !(
          (actor.role === "provider" && actor.userId === provider.id) ||
          (actor.role === "crew-member" && actor.userId === crewMember.id)
        )
      ) {
        throw new Error("You cannot send a message for this crew match");
      }

      thread = await this.repository.createProviderCrewConversation({
        id: crypto.randomUUID(),
        crewMatchId: match.id,
        bookingId: match.bookingId,
        providerId: match.providerId,
        crewMemberId: match.crewMemberId,
        providerName: provider.companyName,
        crewMemberName: crewMember.fullName,
        status: match.status,
        updatedAt: new Date().toISOString(),
        lastMessagePreview: body,
        unreadCount: 0
      });
    }

    if (!thread) {
      throw new Error("Conversation not found");
    }

    this.assertCanAccessConversation(actor, thread);

    const message: ProviderCrewMessage = {
      id: crypto.randomUUID(),
      threadId: thread.id,
      senderId: actor.userId,
      senderRole: actor.role === "provider" ? "provider" : "crew-member",
      body,
      createdAt: new Date().toISOString()
    };
    await this.repository.createProviderCrewMessage(message);
    await this.repository.updateProviderCrewConversation(thread.id, {
      status: thread.status,
      updatedAt: message.createdAt,
      lastMessagePreview: body
    });

    return this.getProviderCrewConversationThread(actor, thread.id);
  }

  public async markBookingOnRoute(
    actor: AuthIdentityRecord,
    payload: MarkBookingOnRouteRequest
  ): Promise<Booking> {
    const booking = await this.repository.findBookingById(payload.bookingId);
    if (!booking) {
      throw new HttpError(404, "Booking not found");
    }

    const [allMatches, provider] = await Promise.all([
      this.repository.listCrewMatches(),
      this.repository.findProviderById(booking.providerId)
    ]);
    const acceptedMatches = allMatches.filter(
      (match) => match.bookingId === booking.id && match.status === "accepted"
    );

    if (!provider) {
      throw new HttpError(404, "Provider not found");
    }

    if (actor.role === "provider" && booking.providerId !== actor.userId) {
      throw new HttpError(403, "Providers can only start the route for their own bookings");
    }

    if (actor.role === "crew-member") {
      if (provider.routeLeaderMode !== "accepted-crew-fallback") {
        throw new HttpError(403, "This business owner handles route start personally for this booking");
      }

      if (!acceptedMatches.some((match) => match.crewMemberId === actor.userId)) {
        throw new HttpError(403, "Only accepted crew members can confirm they are on route");
      }

      const delegatedRouteLeaderId = this.resolveDelegatedCrewRouteLeaderId(booking, acceptedMatches);
      if (!delegatedRouteLeaderId) {
        throw new HttpError(403, "A specific crew route leader must be assigned before crew can start this route");
      }

      if (delegatedRouteLeaderId !== actor.userId) {
        throw new HttpError(403, "Only the assigned route leader can confirm they are on route");
      }
    }

    if (actor.role !== "provider" && actor.role !== "crew-member") {
      throw new HttpError(403, "Only the provider or accepted crew member can confirm on-route status");
    }

    if (booking.status !== "confirmed" && booking.status !== "in-progress") {
      throw new HttpError(
        400,
        "Bookings must be confirmed before the route can be started"
      );
    }

    if (booking.onRouteConfirmedAt) {
      return booking;
    }

    const updatedBooking = await this.repository.updateBooking(booking.id, {
      onRouteConfirmedAt: new Date().toISOString(),
      onRouteConfirmedByCrewMemberId: actor.role === "crew-member" ? actor.userId : undefined,
      lateNoticeSentAt: undefined,
      lateEtaIso: undefined,
      lateReason: undefined
    });

    if (!updatedBooking) {
      throw new HttpError(500, "Booking could not be updated");
    }

    const routeLeaderCrew =
      actor.role === "crew-member" ? await this.repository.findCrewMemberById(actor.userId) : undefined;
    const routeLeaderLabel =
      actor.role === "provider"
        ? provider?.companyName ?? "Your landscaping business"
        : routeLeaderCrew?.fullName ?? "Your landscaping business";
    const routeUpdate = this.buildOnRouteCustomerUpdate({
      booking,
      routeLeaderLabel,
      routeStartPoint: actor.role === "crew-member" ? routeLeaderCrew?.address.point : provider.address.point
    });

    await Promise.all([
      this.createNotification({
        recipientId: booking.customerId,
        recipientRole: "customer",
        category: "booking",
        title: "Your crew is on the way",
        body: routeUpdate.notificationBody,
        actionHref: `/customer/dashboard?bookingId=${booking.id}&tracking=1`
      }),
      this.createNotification({
        recipientId: booking.providerId,
        recipientRole: "provider",
        category: "staffing",
        title: actor.role === "provider" ? "Route started" : "Crew confirmed on route",
        body:
          actor.role === "provider"
            ? "You marked this job on route and customer tracking is now live."
            : "Your assigned crew member marked this job on route.",
        actionHref: `/provider/management?bookingId=${booking.id}&tracking=1`
      })
    ]);

    return updatedBooking;
  }

  private buildOnRouteCustomerUpdate(input: {
    booking: Booking;
    routeLeaderLabel: string;
    routeStartPoint?: Address["point"];
  }): { notificationBody: string; previewText: string; etaMinutes?: number } {
    const activeRouteStop =
      input.booking.status === "confirmed"
        ? this.getActiveBookingRouteStop(input.booking, input.routeStartPoint)
        : undefined;
    const travelMiles = this.calculateBookingRouteTotalMiles(
      input.routeStartPoint,
      input.booking.serviceAddress,
      activeRouteStop
    );
    const etaMinutes =
      travelMiles > 0 ? this.estimateRouteTravelMinutes(travelMiles, undefined, activeRouteStop) : undefined;
    const etaSentence =
      typeof etaMinutes === "number" && etaMinutes > 0
        ? ` Estimated arrival is about ${etaMinutes} minute${etaMinutes === 1 ? "" : "s"}.`
        : "";
    const notificationBody =
      `${input.routeLeaderLabel} is heading to your property now.${etaSentence} ` +
      "Live arrival tracking is available in your dashboard.";

    return {
      notificationBody,
      previewText: notificationBody,
      etaMinutes
    };
  }

  private buildArrivalCustomerUpdate(input: { providerLabel: string; booking: Booking }): {
    notificationBody: string;
  } {
    const serviceLabel = this.titleCaseCategory(input.booking.category).toLowerCase();
    return {
      notificationBody:
        `${input.providerLabel} has arrived for your ${serviceLabel} visit and is getting set up. ` +
        "You can keep following the visit from your dashboard."
    };
  }

  public async setBookingRouteStop(
    providerId: string,
    payload: SetBookingRouteStopRequest
  ): Promise<Booking> {
    const booking = await this.repository.findBookingById(payload.bookingId);
    if (!booking) {
      throw new HttpError(404, "Booking not found");
    }

    if (booking.providerId !== providerId) {
      throw new HttpError(403, "Only the booking provider can set route stops");
    }

    if (booking.status === "completed" || booking.status === "cancelled" || booking.status === "refunded") {
      throw new HttpError(400, "Route stops can only be managed while the booking is active");
    }

    const provider = await this.repository.findProviderById(providerId);
    if (!provider) {
      throw new HttpError(404, "Provider not found");
    }

    const address = payload.address ?? provider.address;
    if (!address.point) {
      throw new HttpError(400, "Route stop address must include a point");
    }

    const defaultLabel = payload.kind === "staging" ? "Staging stop" : "Equipment pickup";
    const routeStop: BookingRouteStop = {
      id: crypto.randomUUID(),
      kind: payload.kind,
      label: payload.label?.trim() || defaultLabel,
      address,
      createdAt: new Date().toISOString()
    };

    const updatedBooking = await this.repository.updateBooking(booking.id, {
      routeActiveStop: routeStop
    });

    if (!updatedBooking) {
      throw new HttpError(500, "Booking route stop could not be saved");
    }

    return updatedBooking;
  }

  public async clearBookingRouteStop(
    providerId: string,
    payload: ClearBookingRouteStopRequest
  ): Promise<Booking> {
    const booking = await this.repository.findBookingById(payload.bookingId);
    if (!booking) {
      throw new HttpError(404, "Booking not found");
    }

    if (booking.providerId !== providerId) {
      throw new HttpError(403, "Only the booking provider can clear route stops");
    }

    const updatedBooking = await this.repository.updateBooking(booking.id, {
      routeActiveStop: undefined
    });

    if (!updatedBooking) {
      throw new HttpError(500, "Booking route stop could not be cleared");
    }

    return updatedBooking;
  }

  public async updateBookingRouteLocation(
    actor: AuthIdentityRecord,
    payload: UpdateBookingRouteLocationRequest
  ): Promise<BookingArrivalTracking> {
    const booking = await this.repository.findBookingById(payload.bookingId);
    if (!booking) {
      throw new HttpError(404, "Booking not found");
    }

    const [allMatches, provider] = await Promise.all([
      this.repository.listCrewMatches(),
      this.repository.findProviderById(booking.providerId)
    ]);
    const acceptedMatches = allMatches.filter(
      (match) => match.bookingId === booking.id && match.status === "accepted"
    );

    if (actor.role === "provider" && booking.providerId !== actor.userId) {
      throw new HttpError(403, "Providers can only share live route location for their own bookings");
    }

    if (actor.role === "crew-member") {
      if ((provider?.routeLeaderMode ?? "provider-only") !== "accepted-crew-fallback") {
        throw new HttpError(403, "This business owner handles route tracking personally for this booking");
      }

      if (!acceptedMatches.some((match) => match.crewMemberId === actor.userId)) {
        throw new HttpError(403, "Only accepted crew members can share route location");
      }

      const delegatedRouteLeaderId = this.resolveDelegatedCrewRouteLeaderId(booking, acceptedMatches);
      if (!delegatedRouteLeaderId) {
        throw new HttpError(403, "A specific crew route leader must be assigned before crew can share route location");
      }

      if (delegatedRouteLeaderId !== actor.userId) {
        throw new HttpError(403, "Only the assigned route leader can share route location");
      }
    }

    if (actor.role !== "provider" && actor.role !== "crew-member") {
      throw new HttpError(403, "Only the provider or accepted crew member can share route location");
    }

    if (!booking.onRouteConfirmedAt) {
      throw new HttpError(400, "Start the route before sharing live location");
    }

    const capturedAtIso = payload.capturedAtIso
      ? new Date(payload.capturedAtIso).toISOString()
      : new Date().toISOString();
    if (Number.isNaN(new Date(capturedAtIso).getTime())) {
      throw new HttpError(400, "capturedAtIso must be a valid ISO date when provided");
    }

    const activeRouteStop =
      booking.routeActiveStop && !booking.routeActiveStop.reachedAt ? booking.routeActiveStop : undefined;
    const routeStopReached =
      activeRouteStop && this.isRouteStopReached(activeRouteStop, payload.point)
        ? {
            ...activeRouteStop,
            reachedAt: capturedAtIso
          }
        : undefined;

    const updatedBooking = await this.repository.updateBooking(booking.id, {
      routeActiveStop: routeStopReached ?? booking.routeActiveStop,
      routeLivePoint: payload.point,
      routeLiveUpdatedAt: capturedAtIso,
      routeLiveSource: actor.role === "provider" ? "provider-device" : "crew-device",
      routeLiveSpeedMph: payload.speedMph,
      routeLiveAccuracyMeters: payload.accuracyMeters
    });

    if (!updatedBooking) {
      throw new HttpError(500, "Booking could not be updated");
    }

    return this.getBookingArrivalTracking(actor, booking.id, capturedAtIso);
  }

  public async markBookingLate(
    providerId: string,
    payload: MarkBookingLateRequest
  ): Promise<Booking> {
    const booking = await this.repository.findBookingById(payload.bookingId);
    if (!booking) {
      throw new HttpError(404, "Booking not found");
    }

    if (booking.providerId !== providerId) {
      throw new HttpError(403, "Only the booking provider can send a delay update");
    }

    if (
      booking.status === "completed" ||
      booking.status === "cancelled" ||
      booking.status === "refunded"
    ) {
      throw new HttpError(400, "Delay updates are only available for active bookings");
    }

    const lateEta = new Date(payload.lateEtaIso);
    if (Number.isNaN(lateEta.getTime())) {
      throw new HttpError(400, "A valid updated ETA is required");
    }

    if (lateEta.getTime() <= Date.now()) {
      throw new HttpError(400, "Updated ETA must be in the future");
    }

    const updatedBooking = await this.repository.updateBooking(booking.id, {
      lateNoticeSentAt: new Date().toISOString(),
      lateEtaIso: lateEta.toISOString(),
      lateReason: payload.reason?.trim() || undefined
    });

    if (!updatedBooking) {
      throw new HttpError(500, "Booking could not be updated");
    }

    const provider = await this.repository.findProviderById(booking.providerId);
    const window = getBookingServiceWindow(booking.scheduledStartIso);
    const etaText = lateEta.toLocaleTimeString([], { timeStyle: "short" });
    const reasonText = payload.reason?.trim() ? ` Reason: ${payload.reason.trim()}` : "";

    await this.createNotification({
      recipientId: booking.customerId,
      recipientRole: "customer",
      category: "booking",
      title: "Your provider is running late",
      body: `${provider?.companyName ?? "Your landscaping business"} now expects to arrive in the ${window.label.toLowerCase()} window, around ${etaText}.${reasonText}`,
      actionHref: `/customer/dashboard?bookingId=${booking.id}&late=1`
    });

    return updatedBooking;
  }

  public async addBookingEvidence(
    actor: AuthIdentityRecord,
    payload: AddBookingEvidenceRequest
  ): Promise<Booking> {
    const booking = await this.repository.findBookingById(payload.bookingId);
    if (!booking) {
      throw new HttpError(404, "Booking not found");
    }

    const acceptedMatch = (await this.repository.listCrewMatches()).find(
      (match) => match.bookingId === booking.id && match.status === "accepted"
    );

    if (actor.role === "customer" && booking.customerId !== actor.userId) {
      throw new HttpError(403, "Customers can only add photos to their own bookings");
    }

    if (actor.role === "provider" && booking.providerId !== actor.userId) {
      throw new HttpError(403, "Providers can only attach evidence to their own bookings");
    }

    if (actor.role === "crew-member") {
      if (!acceptedMatch || acceptedMatch.crewMemberId !== actor.userId) {
        throw new HttpError(403, "Only accepted crew members can attach booking evidence");
      }
    }

    if (actor.role !== "customer" && actor.role !== "provider" && actor.role !== "crew-member") {
      throw new HttpError(403, "Only the customer, provider, or accepted crew can attach booking photos");
    }

    if (booking.status === "completed" || booking.status === "cancelled" || booking.status === "refunded") {
      throw new HttpError(400, "Evidence can only be attached while the booking is still active");
    }

    const evidenceType = payload.evidenceType ?? "photo";
    const note = payload.note?.trim() || undefined;
    const checklistItems = payload.checklistItems?.map((item) => ({
      label: item.label.trim(),
      completed: Boolean(item.completed)
    }));

    if (actor.role === "customer") {
      if (payload.phase !== "before" || evidenceType !== "photo") {
        throw new HttpError(400, "Customers can only add before-service property photos");
      }
      if (booking.status !== "requested" && booking.status !== "confirmed") {
        throw new HttpError(400, "Property photos must be added before work starts");
      }
    }

    if (evidenceType === "photo") {
      const imageDataUrl = payload.imageDataUrl?.trim() ?? "";
      if (!/^data:image\/(?:jpeg|jpg|png|webp);base64,/i.test(imageDataUrl)) {
        throw new HttpError(400, "Photo evidence must be a JPEG, PNG, or WebP image data URL");
      }

      if (imageDataUrl.length > 2_000_000) {
        throw new HttpError(400, "Booking evidence image is too large");
      }

      const actorPhotoCount = booking.serviceEvidence.filter(
        (evidence) =>
          evidence.phase === payload.phase &&
          evidence.evidenceType === "photo" &&
          (actor.role === "customer"
            ? evidence.capturedByRole === "customer"
            : evidence.capturedByRole !== "customer")
      ).length;
      const actorPhotoLimit = actor.role === "customer" ? 6 : 8;
      if (actorPhotoCount >= actorPhotoLimit) {
        throw new HttpError(
          400,
          `A booking can include up to ${actorPhotoLimit} ${actor.role === "customer" ? "customer property" : "field evidence"} photos for this phase`
        );
      }

      if (note && note.length > 240) {
        throw new HttpError(400, "Photo notes must be 240 characters or fewer");
      }

      if (payload.photoArea && !PROPERTY_PHOTO_AREAS.has(payload.photoArea)) {
        throw new HttpError(400, "Choose a valid property area for this photo");
      }
    } else if (evidenceType === "note") {
      if (!note) {
        throw new HttpError(400, "Note evidence requires a written onsite note");
      }
    } else if (evidenceType === "checklist") {
      if (!checklistItems || checklistItems.length === 0) {
        throw new HttpError(400, "Checklist evidence requires at least one checklist item");
      }

      if (checklistItems.some((item) => !item.label)) {
        throw new HttpError(400, "Checklist evidence items must have labels");
      }
    }

    const evidence: BookingEvidenceEntry = {
      id: crypto.randomUUID(),
      phase: payload.phase,
      evidenceType,
      capturedAt: new Date().toISOString(),
      capturedByRole: actor.role,
      capturedByUserId: actor.userId,
      imageDataUrl: evidenceType === "photo" ? payload.imageDataUrl?.trim() : undefined,
      photoArea: evidenceType === "photo" ? payload.photoArea ?? "other" : undefined,
      note,
      checklistItems: evidenceType === "checklist" ? checklistItems : undefined
    };

    const updatedBooking = await this.repository.updateBooking(booking.id, {
      serviceEvidence: [...booking.serviceEvidence, evidence]
    });

    if (!updatedBooking) {
      throw new HttpError(500, "Booking evidence could not be saved");
    }

    return updatedBooking;
  }

  public async updateBookingPhotoMarketingUse(
    customerId: string,
    payload: UpdateBookingPhotoMarketingUseRequest
  ): Promise<Booking> {
    if (!PHOTO_MARKETING_USE_STATUSES.has(payload.status)) {
      throw new HttpError(400, "Choose a valid photo marketing preference");
    }

    const booking = await this.repository.findBookingById(payload.bookingId);
    if (!booking) {
      throw new HttpError(404, "Booking not found");
    }
    if (booking.customerId !== customerId) {
      throw new HttpError(403, "Only the booking customer can manage photo marketing use");
    }
    if (!["completed", "disputed", "refunded"].includes(booking.status)) {
      throw new HttpError(400, "Photo marketing choices are available after the service is complete");
    }

    const beforePhotoCount = booking.serviceEvidence.filter(
      (evidence) => evidence.phase === "before" && evidence.evidenceType === "photo"
    ).length;
    const afterPhotoCount = booking.serviceEvidence.filter(
      (evidence) => evidence.phase === "after" && evidence.evidenceType === "photo"
    ).length;
    if (beforePhotoCount === 0 || afterPhotoCount === 0) {
      throw new HttpError(400, "A before and after photo are required before marketing use can be managed");
    }

    const updatedAt = new Date().toISOString();
    const serviceEvidence = booking.serviceEvidence.map((evidence) =>
      evidence.evidenceType === "photo"
        ? {
            ...evidence,
            marketingUseStatus: payload.status,
            marketingUseUpdatedAt: updatedAt,
            marketingUseUpdatedByCustomerId: customerId
          }
        : evidence
    );
    const updatedBooking = await this.repository.updateBooking(booking.id, { serviceEvidence });
    if (!updatedBooking) {
      throw new HttpError(500, "Photo marketing choice could not be saved");
    }
    return updatedBooking;
  }

  public async markBookingException(
    providerId: string,
    payload: MarkBookingExceptionRequest
  ): Promise<Booking> {
    const booking = await this.repository.findBookingById(payload.bookingId);
    if (!booking) {
      throw new HttpError(404, "Booking not found");
    }

    if (booking.providerId !== providerId) {
      throw new HttpError(403, "Only the booking provider can report a service issue");
    }

    if (
      booking.status === "completed" ||
      booking.status === "cancelled" ||
      booking.status === "refunded"
    ) {
      throw new HttpError(400, "Service issues are only available for active bookings");
    }

    const exceptionLabel = getBookingExceptionLabel(payload.exceptionType);
    const updatedBooking = await this.repository.updateBooking(booking.id, {
      activeExceptionType: payload.exceptionType,
      activeExceptionReportedAt: new Date().toISOString(),
      activeExceptionNotes: payload.notes?.trim() || undefined
    });

    if (!updatedBooking) {
      throw new HttpError(500, "Booking could not be updated");
    }

    const provider = await this.repository.findProviderById(providerId);
    const reasonText = payload.notes?.trim() ? ` ${payload.notes.trim()}` : "";

    await Promise.all([
      this.createNotification({
        recipientId: booking.customerId,
        recipientRole: "customer",
        category: "support",
        title: exceptionLabel,
        body: `${provider?.companyName ?? "Your landscaping business"} reported: ${exceptionLabel}.${reasonText}`,
        actionHref: `/customer/dashboard?bookingId=${booking.id}&issue=${payload.exceptionType}`
      }),
      this.createNotification({
        recipientId: providerId,
        recipientRole: "provider",
        category: "support",
        title: "Issue logged on booking",
        body: `${exceptionLabel} was saved on this booking. Support can now see the issue context.`,
        actionHref: `/provider/management?bookingId=${booking.id}&issue=${payload.exceptionType}`
      })
    ]);

    return updatedBooking;
  }

  public async createBookingDispute(
    requester: { userId: string; role: "customer" | "provider" },
    payload: CreateBookingDisputeRequest
  ): Promise<Booking> {
    const booking = await this.repository.findBookingById(payload.bookingId);
    if (!booking) {
      throw new HttpError(404, "Booking not found");
    }

    if (requester.role === "customer" && booking.customerId !== requester.userId) {
      throw new HttpError(403, "Customers can only dispute their own bookings");
    }

    if (requester.role === "provider" && booking.providerId !== requester.userId) {
      throw new HttpError(403, "Providers can only dispute their own jobs");
    }

    if (booking.status === "cancelled" || booking.status === "refunded") {
      throw new HttpError(400, "Cancelled or refunded bookings cannot be disputed");
    }

    if (booking.status === "requested") {
      throw new HttpError(400, "Requested bookings must be confirmed before they can be disputed");
    }

    const reason = payload.reason.trim();
    if (!reason) {
      throw new HttpError(400, "A dispute reason is required");
    }

    if (booking.status === "disputed") {
      return booking;
    }

    const disputedAt = new Date().toISOString();
    const updatedBooking = await this.repository.updateBooking(booking.id, {
      status: "disputed",
      disputedAt,
      disputeReason: reason,
      disputedByRole: requester.role
    });

    if (!updatedBooking) {
      throw new HttpError(500, "Booking could not be disputed");
    }

    await this.createSupportTicket(
      { userId: requester.userId, role: requester.role },
      {
        bookingId: booking.id,
        issueType: "service-quality",
        subject: `Booking dispute: ${this.titleCaseCategory(booking.category)}`,
        description: reason
      }
    );

    const customer = await this.repository.findCustomerById(booking.customerId);
    const provider = await this.repository.findProviderById(booking.providerId);
    const actorLabel =
      requester.role === "customer"
        ? customer?.fullName ?? "The customer"
        : provider?.companyName ?? "The landscaping business";

    await Promise.all([
      this.createNotification({
        recipientId: booking.customerId,
        recipientRole: "customer",
        category: "support",
        title: requester.role === "customer" ? "Dispute opened" : "Provider opened a dispute",
        body:
          requester.role === "customer"
            ? "Your dispute has been logged and support now has the booking context."
            : `${actorLabel} opened a dispute for this booking. YardMatch support can now step in.`,
        actionHref: `/customer/dashboard?bookingId=${booking.id}&issue=dispute`
      }),
      this.createNotification({
        recipientId: booking.providerId,
        recipientRole: "provider",
        category: "support",
        title: requester.role === "provider" ? "Dispute opened" : "Customer opened a dispute",
        body:
          requester.role === "provider"
            ? "Your dispute has been logged and support now has the booking context."
            : `${actorLabel} opened a dispute for this booking. YardMatch support can now step in.`,
        actionHref: `/provider/management?bookingId=${booking.id}&issue=dispute`
      })
    ]);

    return updatedBooking;
  }

  public async getBookingArrivalTracking(
    actor: AuthIdentityRecord,
    bookingId: string,
    nowIso = new Date().toISOString()
  ): Promise<BookingArrivalTracking> {
    const booking = await this.repository.findBookingById(bookingId);
    if (!booking) {
      throw new HttpError(404, "Booking not found");
    }

    const provider = await this.repository.findProviderById(booking.providerId);
    const matches = await this.repository.listCrewMatches();
    const acceptedMatches = matches.filter((match) => match.bookingId === booking.id && match.status === "accepted");
    const acceptedMatch = acceptedMatches[0];

    if (actor.role === "customer" && booking.customerId !== actor.userId) {
      throw new HttpError(403, "Customers can only track their own bookings");
    }

    if (actor.role === "provider" && booking.providerId !== actor.userId) {
      throw new HttpError(403, "Providers can only track their own jobs");
    }

    if (
      actor.role === "crew-member" &&
      !acceptedMatches.some((match) => match.crewMemberId === actor.userId)
    ) {
      throw new HttpError(403, "Crew members can only track accepted assignments");
    }

    const crewMemberId =
      booking.onRouteConfirmedByCrewMemberId ??
      this.resolveDelegatedCrewRouteLeaderId(booking, acceptedMatches);
    const crewMember = crewMemberId ? await this.repository.findCrewMemberById(crewMemberId) : undefined;
    const routeLeaderPoint =
      booking.onRouteConfirmedByCrewMemberId && crewMember
        ? crewMember.address.point
        : provider?.address.point ?? crewMember?.address.point;
    const routeLeaderName =
      booking.onRouteConfirmedByCrewMemberId && crewMember
        ? crewMember.fullName
        : provider?.companyName ?? crewMember?.fullName ?? "Your landscaping business";
    const activeRouteStop =
      booking.status === "confirmed" ? this.getActiveBookingRouteStop(booking, booking.routeLivePoint) : undefined;
    const providerVisibleCurrentLegDestination =
      actor.role === "customer"
        ? undefined
        : activeRouteStop?.address ?? booking.serviceAddress;

    const baseTracking: BookingArrivalTracking = {
      bookingId: booking.id,
      status: "unavailable",
      customerId: booking.customerId,
      providerId: booking.providerId,
      crewMemberId: crewMember?.id,
      crewMemberName: routeLeaderName,
      destination: booking.serviceAddress,
      routeStartPoint: routeLeaderPoint,
      currentLegDestination: providerVisibleCurrentLegDestination,
      activeRouteStop: actor.role === "customer" ? undefined : activeRouteStop,
      source: "computed-origin",
      progressPercent: 0,
      lastComputedAt: nowIso,
      message: "Tracking is not available for this booking yet."
    };

    if (!provider && !crewMember) {
      return {
        ...baseTracking,
        message: "No route leader is assigned yet."
      };
    }

    if (!booking.onRouteConfirmedAt) {
      return {
        ...baseTracking,
        status: "not-started",
        message: `${routeLeaderName} is assigned, but has not started the route yet.`
      };
    }

    const startedAt = new Date(booking.onRouteConfirmedAt).getTime();
    const now = new Date(nowIso).getTime();
    const totalDistanceMiles = this.calculateBookingRouteTotalMiles(
      routeLeaderPoint,
      booking.serviceAddress,
      activeRouteStop
    );
    const totalTravelMinutes = this.estimateRouteTravelMinutes(totalDistanceMiles, undefined, activeRouteStop);
    const elapsedMinutes = Math.max(0, (now - startedAt) / (1000 * 60));
    const liveLocationAgeMinutes = booking.routeLiveUpdatedAt
      ? Math.max(0, (now - new Date(booking.routeLiveUpdatedAt).getTime()) / (1000 * 60))
      : undefined;
    const hasLiveRoutePoint = Boolean(booking.routeLivePoint && booking.routeLiveUpdatedAt);
    const isLiveLocationStale =
      typeof liveLocationAgeMinutes === "number" &&
      liveLocationAgeMinutes > MarketplacePlatformService.liveRouteLocationStaleMinutes;
    const computedProgress =
      booking.status === "in-progress" || booking.status === "completed"
        ? 1
        : Math.max(0, Math.min(1, elapsedMinutes / totalTravelMinutes));
    const effectiveCurrentPoint = hasLiveRoutePoint
      ? booking.routeLivePoint
      : this.interpolatePoint(
          routeLeaderPoint ?? booking.serviceAddress.point,
          activeRouteStop?.address.point ?? booking.serviceAddress.point,
          computedProgress
        );
    const activeStopDuringTracking = this.getActiveBookingRouteStop(booking, effectiveCurrentPoint);
    const liveRemainingDistanceMiles =
      effectiveCurrentPoint
        ? this.calculateRemainingBookingRouteMiles(effectiveCurrentPoint, booking.serviceAddress, activeStopDuringTracking)
        : undefined;
    const liveRemainingLegDistanceMiles =
      effectiveCurrentPoint
        ? this.calculateRemainingBookingLegMiles(effectiveCurrentPoint, booking.serviceAddress, activeStopDuringTracking)
        : undefined;
    const clampedProgress =
      typeof liveRemainingDistanceMiles === "number" && totalDistanceMiles > 0
        ? Math.max(0, Math.min(1, 1 - liveRemainingDistanceMiles / totalDistanceMiles))
        : computedProgress;
    const etaMinutesFromLivePoint =
      typeof liveRemainingDistanceMiles === "number"
        ? this.estimateRouteTravelMinutes(
            liveRemainingDistanceMiles,
            booking.routeLiveSpeedMph,
            activeStopDuringTracking
          )
        : undefined;
    const legEtaMinutesFromLivePoint =
      typeof liveRemainingLegDistanceMiles === "number"
        ? this.estimateRouteTravelMinutes(liveRemainingLegDistanceMiles, booking.routeLiveSpeedMph)
        : undefined;

    if (booking.status === "completed") {
      return {
        ...baseTracking,
        status: "completed",
        currentPoint: booking.serviceAddress.point,
        source: hasLiveRoutePoint ? booking.routeLiveSource ?? "computed-origin" : "computed-origin",
        liveUpdatedAt: booking.routeLiveUpdatedAt,
        isLiveLocationStale,
        progressPercent: 100,
        remainingDistanceMiles: 0,
        etaMinutes: 0,
        unlockedAt: booking.onRouteConfirmedAt,
        message: `${routeLeaderName} already completed this service.`
      };
    }

    if (booking.status === "in-progress" || clampedProgress >= 1) {
      return {
        ...baseTracking,
        status: "arrived",
        currentPoint: booking.serviceAddress.point,
        source: hasLiveRoutePoint ? booking.routeLiveSource ?? "computed-origin" : "computed-origin",
        liveUpdatedAt: booking.routeLiveUpdatedAt,
        isLiveLocationStale,
        progressPercent: 100,
        remainingDistanceMiles: 0,
        etaMinutes: 0,
        unlockedAt: booking.onRouteConfirmedAt,
        message: `${routeLeaderName} has arrived at the property.`
      };
    }

    return {
      ...baseTracking,
      status: "on-route",
      currentPoint: effectiveCurrentPoint,
      currentLegDestination:
        actor.role === "customer"
          ? undefined
          : activeStopDuringTracking?.address ?? booking.serviceAddress,
      activeRouteStop: actor.role === "customer" ? undefined : activeStopDuringTracking,
      source: hasLiveRoutePoint ? booking.routeLiveSource ?? "computed-origin" : "computed-origin",
      liveUpdatedAt: booking.routeLiveUpdatedAt,
      isLiveLocationStale,
      progressPercent: Math.round(clampedProgress * 100),
      remainingLegDistanceMiles:
        typeof liveRemainingLegDistanceMiles === "number"
          ? Number(liveRemainingLegDistanceMiles.toFixed(1))
          : undefined,
      remainingDistanceMiles:
        typeof liveRemainingDistanceMiles === "number"
          ? Number(liveRemainingDistanceMiles.toFixed(1))
          : Number((totalDistanceMiles * (1 - clampedProgress)).toFixed(1)),
      etaToCurrentLegMinutes:
        typeof legEtaMinutesFromLivePoint === "number" ? Math.max(1, legEtaMinutesFromLivePoint) : undefined,
      etaMinutes:
        typeof etaMinutesFromLivePoint === "number"
          ? Math.max(1, etaMinutesFromLivePoint)
          : Math.max(1, Math.ceil(totalTravelMinutes - elapsedMinutes)),
      unlockedAt: booking.onRouteConfirmedAt,
      message: hasLiveRoutePoint
        ? isLiveLocationStale
          ? `${routeLeaderName} shared a live location, but it has not refreshed in a few minutes.`
          : `${routeLeaderName} is on the way with live location updates.`
        : `${routeLeaderName} is on the way.`
    };
  }

  private getActiveBookingRouteStop(
    booking: Booking,
    currentPoint?: Address["point"]
  ): Booking["routeActiveStop"] | undefined {
    const routeStop = booking.routeActiveStop;
    if (!routeStop || routeStop.reachedAt) {
      return undefined;
    }

    if (currentPoint && this.isRouteStopReached(routeStop, currentPoint)) {
      return undefined;
    }

    return routeStop;
  }

  private isRouteStopReached(routeStop: BookingRouteStop, point: Address["point"]): boolean {
    return (
      this.geoService.distanceMiles(
        {
          ...routeStop.address,
          point
        },
        routeStop.address
      ) <= MarketplacePlatformService.routeStopReachedThresholdMiles
    );
  }

  private calculateBookingRouteTotalMiles(
    routeStartPoint: Address["point"] | undefined,
    destination: Address,
    activeRouteStop?: Booking["routeActiveStop"]
  ): number {
    if (!routeStartPoint) {
      return 0;
    }

    if (!activeRouteStop) {
      return this.geoService.distanceMiles(
        {
          ...destination,
          point: routeStartPoint
        },
        destination
      );
    }

    const firstLeg = this.geoService.distanceMiles(
      {
        ...activeRouteStop.address,
        point: routeStartPoint
      },
      activeRouteStop.address
    );
    const secondLeg = this.geoService.distanceMiles(activeRouteStop.address, destination);
    return firstLeg + secondLeg;
  }

  private calculateRemainingBookingRouteMiles(
    currentPoint: Address["point"],
    destination: Address,
    activeRouteStop?: Booking["routeActiveStop"]
  ): number {
    if (!activeRouteStop) {
      return this.geoService.distanceMiles(
        {
          ...destination,
          point: currentPoint
        },
        destination
      );
    }

    const firstLegRemaining = this.geoService.distanceMiles(
      {
        ...activeRouteStop.address,
        point: currentPoint
      },
      activeRouteStop.address
    );
    return firstLegRemaining + this.geoService.distanceMiles(activeRouteStop.address, destination);
  }

  private calculateRemainingBookingLegMiles(
    currentPoint: Address["point"],
    destination: Address,
    activeRouteStop?: Booking["routeActiveStop"]
  ): number {
    if (!activeRouteStop) {
      return this.geoService.distanceMiles(
        {
          ...destination,
          point: currentPoint
        },
        destination
      );
    }

    return this.geoService.distanceMiles(
      {
        ...activeRouteStop.address,
        point: currentPoint
      },
      activeRouteStop.address
    );
  }

  private estimateRouteTravelMinutes(
    distanceMiles: number,
    speedMph?: number,
    activeRouteStop?: Booking["routeActiveStop"]
  ): number {
    const travelMinutes = Math.ceil((Math.max(0, distanceMiles) / Math.max(10, speedMph ?? 22)) * 60);
    const dwellMinutes = activeRouteStop ? MarketplacePlatformService.routeStopDwellMinutes : 0;
    return Math.max(0, travelMinutes + dwellMinutes);
  }

  public async startBooking(actor: AuthIdentityRecord, payload: StartBookingRequest): Promise<Booking> {
    const booking = await this.repository.findBookingById(payload.bookingId);
    if (!booking) {
      throw new HttpError(404, "Booking not found");
    }

    const acceptedMatch = (await this.repository.listCrewMatches()).find(
      (match) =>
        match.bookingId === booking.id &&
        match.status === "accepted"
    );

    if (actor.role === "provider" && booking.providerId !== actor.userId) {
      throw new HttpError(403, "Providers can only start their own bookings");
    }

    if (actor.role === "crew-member") {
      if (!acceptedMatch || acceptedMatch.crewMemberId !== actor.userId) {
        throw new HttpError(403, "Only accepted crew members can start this booking");
      }
    }

    if (actor.role !== "provider" && actor.role !== "crew-member") {
      throw new HttpError(403, "Only the provider or accepted crew member can start this booking");
    }

    if (booking.status === "in-progress") {
      return booking;
    }

    if (booking.status !== "confirmed") {
      throw new HttpError(400, "Bookings must be confirmed before work can start");
    }

    if (!booking.onRouteConfirmedAt) {
      throw new HttpError(400, "Confirm on route before starting work");
    }

    if (this.countBookingEvidence(booking, "before") < 1) {
      throw new HttpError(400, "Capture at least one before photo before starting work");
    }

    const updatedBooking = await this.repository.updateBooking(booking.id, {
      status: "in-progress",
      lateNoticeSentAt: undefined,
      lateEtaIso: undefined,
      lateReason: undefined,
      activeExceptionType: undefined,
      activeExceptionReportedAt: undefined,
      activeExceptionNotes: undefined
    });

    if (!updatedBooking) {
      throw new HttpError(500, "Booking could not be started");
    }

    this.analytics.record({
      id: crypto.randomUUID(),
      name: MarketplaceTelemetryEventCatalog.crewCheckInCompleted,
      actorId: actor.userId,
      occurredAt: new Date().toISOString(),
      properties: {
        bookingId: booking.id,
        providerId: booking.providerId
      }
    });

    await this.createNotification({
      recipientId: booking.providerId,
      recipientRole: "provider",
      category: "staffing",
      title: "Work started",
      body: "An assigned crew member checked in and started work on an upcoming job.",
      actionHref: "/provider/management"
    });

    return updatedBooking;
  }

  public async listCustomerProviderConversations(
    actor: AuthIdentityRecord
  ): Promise<CustomerProviderConversation[]> {
    const conversations = await this.repository.listCustomerProviderConversations();
    return conversations.filter((conversation) =>
      actor.role === "customer"
        ? conversation.customerId === actor.userId
        : conversation.providerId === actor.userId
    );
  }

  public async getCustomerProviderConversationThread(
    actor: AuthIdentityRecord,
    threadId?: string,
    bookingId?: string
  ): Promise<CustomerProviderConversationThread> {
    const thread = threadId
      ? await this.repository.findCustomerProviderConversationById(threadId)
      : bookingId
        ? await this.repository.findCustomerProviderConversationByBookingId(bookingId)
        : undefined;

    if (!thread) {
      throw new HttpError(404, "Conversation not found");
    }

    this.assertCanAccessCustomerProviderConversation(actor, thread);
    const messages = await this.repository.listCustomerProviderMessages(thread.id);
    return {
      thread,
      messages
    };
  }

  public async sendCustomerProviderMessage(
    actor: AuthIdentityRecord,
    payload: SendCustomerProviderMessageRequest
  ): Promise<CustomerProviderConversationThread> {
    const body = payload.body.trim();
    if (body.length === 0) {
      throw new HttpError(400, "Message body is required");
    }

    let thread = payload.threadId
      ? await this.repository.findCustomerProviderConversationById(payload.threadId)
      : payload.bookingId
        ? await this.repository.findCustomerProviderConversationByBookingId(payload.bookingId)
        : undefined;

    if (!thread && !payload.bookingId) {
      throw new HttpError(400, "threadId or bookingId is required");
    }

    if (!thread && payload.bookingId) {
      const booking = await this.repository.findBookingById(payload.bookingId);
      if (!booking) {
        throw new HttpError(404, "Booking not found");
      }

      if (!booking.onRouteConfirmedAt) {
        throw new HttpError(403, "Customer-provider chat unlocks only after the crew is on route");
      }

      const customer = await this.repository.findCustomerById(booking.customerId);
      const provider = await this.repository.findProviderById(booking.providerId);
      if (!customer || !provider) {
        throw new HttpError(500, "Conversation participants could not be loaded");
      }

      if (
        !(
          (actor.role === "customer" && actor.userId === customer.id) ||
          (actor.role === "provider" && actor.userId === provider.id)
        )
      ) {
        throw new HttpError(403, "You cannot send a message for this booking");
      }

      thread = await this.repository.createCustomerProviderConversation({
        id: crypto.randomUUID(),
        bookingId: booking.id,
        customerId: booking.customerId,
        providerId: booking.providerId,
        customerName: customer.fullName,
        providerName: provider.companyName,
        updatedAt: new Date().toISOString(),
        lastMessagePreview: body,
        unreadCount: 0
      });
    }

    if (!thread) {
      throw new HttpError(404, "Conversation not found");
    }

    const booking = await this.repository.findBookingById(thread.bookingId);
    if (!booking?.onRouteConfirmedAt) {
      throw new HttpError(403, "Customer-provider chat unlocks only after the crew is on route");
    }

    this.assertCanAccessCustomerProviderConversation(actor, thread);

    const message: CustomerProviderMessage = {
      id: crypto.randomUUID(),
      threadId: thread.id,
      senderId: actor.userId,
      senderRole: actor.role === "customer" ? "customer" : "provider",
      body,
      createdAt: new Date().toISOString()
    };
    await this.repository.createCustomerProviderMessage(message);
    await this.repository.updateCustomerProviderConversation(thread.id, {
      updatedAt: message.createdAt,
      lastMessagePreview: body
    });

    return this.getCustomerProviderConversationThread(actor, thread.id);
  }

  public async listCrewOpportunities(): Promise<CrewOpportunity[]> {
    const [providers, bookings] = await Promise.all([
      this.repository.listProviders(),
      this.repository.listBookings()
    ]);

    const now = Date.now();
    return bookings
      .filter((booking) => {
        const start = new Date(booking.scheduledStartIso).getTime();
        return (
          start > now &&
          (booking.status === "requested" || booking.status === "confirmed")
        );
      })
      .map((booking) => {
        const provider = providers.find((item) => item.id === booking.providerId);
        if (!provider) {
          return undefined;
        }

        const opportunity: CrewOpportunity = {
          id: booking.id,
          providerId: provider.id,
          providerCompanyName: provider.companyName,
          title: `${this.titleCaseCategory(booking.category)} crew support`,
          categories: [booking.category],
          city: provider.address.city,
          state: provider.address.state,
          neededByStartIso: booking.scheduledStartIso,
          neededByEndIso: booking.scheduledEndIso,
          hourlyRateCents: this.estimateCrewHourlyRate(booking.category),
          preferredSchedule: "flex",
          requiresEquipmentOwnership: false,
          trainingProvided: true,
          equipmentProvided: true,
          summary: `${provider.companyName} needs extra crew coverage for an upcoming ${this.titleCaseCategory(booking.category).toLowerCase()} job.`
        };

        return opportunity;
      })
      .filter((opportunity): opportunity is CrewOpportunity => opportunity !== undefined);
  }

  public async selectPublicCrewOpportunity(
    payload: SelectPublicCrewOpportunityRequest
  ): Promise<SelectPublicCrewOpportunityResponse> {
    const opportunityId = payload.opportunityId?.trim();
    if (!opportunityId) {
      throw new HttpError(400, "opportunityId is required");
    }

    const opportunity = (await this.listCrewOpportunities()).find((item) => item.id === opportunityId);
    if (!opportunity) {
      throw new HttpError(404, "Crew opportunity not found");
    }

    const provider = await this.repository.findProviderById(opportunity.providerId);
    if (!provider) {
      throw new HttpError(404, "Provider not found for this crew opportunity");
    }

    const staffingMode = provider.staffingMode ?? "review-first";
    const isAutoAccept = staffingMode === "auto-accept";
    const notificationTitle = isAutoAccept
      ? "Your crew opening was filled"
      : "Crew opening needs review";
    const notificationBody = isAutoAccept
      ? `A crew member selected your ${opportunity.title} opening in ${opportunity.city}, ${opportunity.state}. Your auto-accept setting marked the opening as filled.`
      : `A crew member selected your ${opportunity.title} opening in ${opportunity.city}, ${opportunity.state}. Review this match before adding them to the crew.`;

    await this.createNotification({
      recipientId: provider.id,
      recipientRole: "provider",
      category: "staffing",
      title: notificationTitle,
      body: notificationBody,
      actionHref: "/provider/management"
    });

    return {
      opportunityId: opportunity.id,
      providerId: provider.id,
      providerCompanyName: provider.companyName,
      staffingMode,
      notificationTitle,
      notificationBody
    };
  }

  public async claimPublicCrewOpportunity(
    crewMemberId: string,
    payload: ClaimPublicCrewOpportunityRequest
  ): Promise<CrewMatchCandidate> {
    const opportunityId = payload.opportunityId?.trim();
    if (!opportunityId) {
      throw new HttpError(400, "opportunityId is required");
    }

    const [crewMember, booking, allBookings, allMatches] = await Promise.all([
      this.repository.findCrewMemberById(crewMemberId),
      this.repository.findBookingById(opportunityId),
      this.repository.listBookings(),
      this.repository.listCrewMatches()
    ]);

    if (!crewMember) {
      throw new HttpError(404, "Crew member not found");
    }

    if (
      !booking ||
      new Date(booking.scheduledStartIso).getTime() <= Date.now() ||
      (booking.status !== "requested" && booking.status !== "confirmed")
    ) {
      throw new HttpError(404, "Crew opportunity not found");
    }

    const provider = await this.repository.findProviderById(booking.providerId);
    if (!provider) {
      throw new HttpError(404, "Provider not found for this crew opportunity");
    }

    const existingMatch = allMatches.find(
      (match) => match.bookingId === booking.id && match.crewMemberId === crewMember.id
    );
    if (existingMatch) {
      return existingMatch;
    }

    const distanceMiles = Number(this.geoService.distanceMiles(crewMember.address, booking.serviceAddress).toFixed(1));
    const acceptedBookedJobs = this.getAcceptedCrewBookings(crewMember.id, allMatches, allBookings);
    const hasConflictingAcceptedJob = acceptedBookedJobs.some(
      (acceptedBooking) =>
        acceptedBooking.id !== booking.id &&
        this.doIntervalsOverlap(
          acceptedBooking.scheduledStartIso,
          acceptedBooking.scheduledEndIso,
          booking.scheduledStartIso,
          booking.scheduledEndIso
        )
    );
    const isLocalAddressMatch = [booking.serviceAddress, provider.address].some(
      (address) =>
        address.postalCode === crewMember.address.postalCode ||
        (address.city.toLowerCase() === crewMember.address.city.toLowerCase() &&
          address.state.toLowerCase() === crewMember.address.state.toLowerCase())
    );
    const isEligible =
      crewMember.categories.includes(booking.category) &&
      (crewMember.availableWeekdays ?? ["Mon", "Tue", "Wed", "Thu", "Fri"]).includes(
        this.isoToAvailabilityDay(booking.scheduledStartIso)
      ) &&
      (booking.category !== "snow-shoveling" &&
      booking.category !== "snow-blowing" &&
      booking.category !== "ice-melt-salting"
        ? true
        : crewMember.winterWorkEnabled ?? true) &&
      !hasConflictingAcceptedJob &&
      crewMember.status !== "off-duty" &&
      (distanceMiles <= crewMember.willingToTravelMiles || isLocalAddressMatch);

    if (!isEligible) {
      throw new HttpError(409, "This crew profile is not eligible for the selected opportunity");
    }

    const staffingMode = provider.staffingMode ?? "review-first";
    const status = staffingMode === "auto-accept" ? "accepted" : "pending-provider-review";
    const now = new Date().toISOString();
    const match = await this.repository.createCrewMatch({
      id: crypto.randomUUID(),
      bookingId: booking.id,
      providerId: provider.id,
      crewMemberId: crewMember.id,
      crewMemberName: crewMember.fullName,
      crewMemberPhone: crewMember.phone,
      categories: crewMember.categories,
      availableWeekdays: crewMember.availableWeekdays ?? ["Mon", "Tue", "Wed", "Thu", "Fri"],
      preferredSchedule: crewMember.preferredSchedule,
      willingToTravelMiles: crewMember.willingToTravelMiles,
      hasOwnEquipment: crewMember.hasOwnEquipment,
      winterWorkEnabled: crewMember.winterWorkEnabled ?? true,
      status,
      autoAccepted: staffingMode === "auto-accept",
      distanceMiles,
      hourlyRateCents: this.estimateCrewHourlyRate(booking.category),
      createdAt: now,
      reviewedAt: staffingMode === "auto-accept" ? now : undefined
    });

    await this.createNotification({
      recipientId: provider.id,
      recipientRole: "provider",
      category: "staffing",
      title: staffingMode === "auto-accept" ? "Crew opening filled" : "Crew opening needs review",
      body:
        staffingMode === "auto-accept"
          ? `${crewMember.fullName} claimed your ${this.titleCaseCategory(booking.category)} opening and was auto-accepted.`
          : `${crewMember.fullName} claimed your ${this.titleCaseCategory(booking.category)} opening and is waiting for review.`,
      actionHref: "/provider/management"
    });

    await this.createNotification({
      recipientId: crewMember.id,
      recipientRole: "crew-member",
      category: "staffing",
      title: staffingMode === "auto-accept" ? "You were accepted for a job" : "You have a new crew match",
      body:
        staffingMode === "auto-accept"
          ? `${provider.companyName} added you to an upcoming ${this.titleCaseCategory(booking.category)} job.`
          : `${provider.companyName} is reviewing you for an upcoming ${this.titleCaseCategory(booking.category)} job.`,
      actionHref: "/crew/schedule"
    });

    if (staffingMode === "auto-accept") {
      await this.refreshCrewMemberStatus(crewMember.id);
    }

    return match;
  }

  public async updateProviderSettings(
    providerId: string,
    payload: UpdateProviderSettingsRequest
  ): Promise<ProviderProfile> {
    const provider = await this.repository.findProviderById(providerId);
    if (!provider) {
      throw new Error("Provider not found");
    }

    const normalizedRadius = Math.round(payload.serviceRadiusMiles);
    if (normalizedRadius < 5 || normalizedRadius > 60) {
      throw new Error("serviceRadiusMiles must be between 5 and 60");
    }

    const minimumBookingLeadHours = Math.round(
      payload.minimumBookingLeadHours ?? provider.minimumBookingLeadHours ?? 0
    );
    if (minimumBookingLeadHours < 0 || minimumBookingLeadHours > 72) {
      throw new Error("minimumBookingLeadHours must be between 0 and 72");
    }

    const staffingMode = payload.staffingMode ?? provider.staffingMode ?? "review-first";
    if (staffingMode !== "auto-accept" && staffingMode !== "review-first") {
      throw new Error("staffingMode must be auto-accept or review-first");
    }

    const crewReviewLeadHours = Math.round(payload.crewReviewLeadHours ?? provider.crewReviewLeadHours ?? 24);
    if (crewReviewLeadHours < 1 || crewReviewLeadHours > 72) {
      throw new Error("crewReviewLeadHours must be between 1 and 72");
    }

    const departureReminderLeadMinutes = Math.round(
      payload.departureReminderLeadMinutes ?? provider.departureReminderLeadMinutes ?? 60
    );
    if (departureReminderLeadMinutes < 10 || departureReminderLeadMinutes > 180) {
      throw new Error("departureReminderLeadMinutes must be between 10 and 180");
    }

    const routeLeaderMode = payload.routeLeaderMode ?? provider.routeLeaderMode ?? "provider-only";
    if (routeLeaderMode !== "provider-only" && routeLeaderMode !== "accepted-crew-fallback") {
      throw new Error("routeLeaderMode must be provider-only or accepted-crew-fallback");
    }

    const weeklyPayoutDay = payload.weeklyPayoutDay ?? provider.weeklyPayoutDay ?? "Thu";
    if (!this.isValidPayoutWeekday(weeklyPayoutDay)) {
      throw new Error("weeklyPayoutDay must be Mon, Tue, Wed, Thu, Fri, Sat, or Sun");
    }

    const instantPayoutsEnabled =
      payload.instantPayoutsEnabled ?? provider.instantPayoutsEnabled ?? false;

    const nextCalendarConnection = {
      ...provider.calendarConnection,
      externalEventsBlockingEnabled:
        payload.externalEventsBlockingEnabled ??
        provider.calendarConnection.externalEventsBlockingEnabled ??
        false,
      externalBlocks: this.normalizeExternalCalendarBlocks(
        payload.externalCalendarBlocks ?? provider.calendarConnection.externalBlocks ?? []
      )
    };

    await this.ensureExternalCalendarBlocksDoNotConflict({
      ...provider,
      serviceRadiusMiles: normalizedRadius,
      minimumBookingLeadHours,
      staffingMode,
      crewReviewLeadHours,
      departureReminderLeadMinutes,
      routeLeaderMode,
      weeklyPayoutDay,
      instantPayoutsEnabled,
      sponsoredListingEnabled:
        payload.sponsoredListingEnabled ?? provider.sponsoredListingEnabled,
      calendarConnection: nextCalendarConnection
    });

    const providerUpdates: Partial<ProviderProfile> = {
      serviceRadiusMiles: normalizedRadius,
      minimumBookingLeadHours,
      staffingMode,
      crewReviewLeadHours,
      departureReminderLeadMinutes,
      routeLeaderMode,
      weeklyPayoutDay,
      instantPayoutsEnabled,
      sponsoredListingEnabled:
        payload.sponsoredListingEnabled ?? provider.sponsoredListingEnabled,
      calendarConnection: nextCalendarConnection
    };

    const resubmissionUpdates = this.buildRejectedProviderVerificationResubmissionUpdates(provider, providerUpdates);
    const updatedProvider = await this.repository.updateProvider(provider.id, {
      ...providerUpdates,
      ...resubmissionUpdates
    });

    if (!updatedProvider) {
      throw new Error("Provider settings could not be updated");
    }

    if (resubmissionUpdates.verificationStatus === "pending-review") {
      await this.notifyOpsProviderVerificationResubmitted(updatedProvider, "dispatch-settings");
    }

    this.analytics.record({
      id: crypto.randomUUID(),
      name: MarketplaceTelemetryEventCatalog.providerSettingsUpdated,
      actorId: provider.id,
      occurredAt: new Date().toISOString(),
      properties: {
        serviceRadiusMiles: normalizedRadius,
        minimumBookingLeadHours,
        staffingMode,
        crewReviewLeadHours,
        departureReminderLeadMinutes,
        routeLeaderMode,
        weeklyPayoutDay,
        instantPayoutsEnabled,
        sponsoredListingEnabled:
          payload.sponsoredListingEnabled ?? provider.sponsoredListingEnabled,
        externalEventsBlockingEnabled:
          payload.externalEventsBlockingEnabled ??
          provider.calendarConnection.externalEventsBlockingEnabled ??
          false,
        externalCalendarBlockCount:
          payload.externalCalendarBlocks?.length ??
          provider.calendarConnection.externalBlocks?.length ??
          0,
        city: provider.address.city
      }
    });

    if (payload.sponsoredListingEnabled !== undefined) {
      this.analytics.record({
        id: crypto.randomUUID(),
        name: MarketplaceTelemetryEventCatalog.providerSponsorshipUpdated,
        actorId: provider.id,
        occurredAt: new Date().toISOString(),
        properties: {
          sponsoredListingEnabled: payload.sponsoredListingEnabled,
          city: provider.address.city
        }
      });
    }

    return this.getProviderProfile(provider.id);
  }

  public async createProviderReview(
    customerId: string,
    payload: CreateProviderReviewRequest
  ): Promise<ProviderReview> {
    const booking = await this.repository.findBookingById(payload.bookingId);
    if (!booking) {
      throw new Error("Booking not found");
    }

    if (booking.customerId !== customerId) {
      throw new Error("Only the booking customer can submit a review");
    }

    if (booking.status !== "completed" || !booking.completedAt) {
      throw new Error("Reviews can only be submitted after the service is completed");
    }

    if (booking.reviewId || (await this.repository.findProviderReviewByBookingId(booking.id))) {
      throw new Error("A review has already been submitted for this booking");
    }

    const invite = await this.getActiveReviewInviteOrThrow(booking.id);

    const provider = await this.repository.findProviderById(booking.providerId);
    if (!provider) {
      throw new Error("Provider not found");
    }

    this.assertReviewScore(payload.overallRating, "overallRating");
    this.assertReviewScore(payload.timelinessRating, "timelinessRating");
    this.assertReviewScore(payload.attentionToDetailRating, "attentionToDetailRating");
    const normalizedReviewText = payload.reviewText.trim();

    if (normalizedReviewText.length === 0) {
      throw new Error("reviewText is required");
    }

    const review: ProviderReview = {
      id: crypto.randomUUID(),
      bookingId: booking.id,
      providerId: booking.providerId,
      customerId,
      overallRating: payload.overallRating,
      timelinessRating: payload.timelinessRating,
      attentionToDetailRating: payload.attentionToDetailRating,
      reviewText: normalizedReviewText,
      responseStatus: "pending",
      supportTicketId: undefined,
      escalatedAt: undefined,
      escalatedBy: undefined,
      escalationNotes: undefined,
      createdAt: new Date().toISOString()
    };

    const savedReview = await this.repository.createProviderReview(review);
    await this.repository.updateBooking(booking.id, {
      reviewId: review.id
    });
    await this.repository.updateReviewInvite(invite.id, {
      status: "completed",
      completedAt: savedReview.createdAt
    });

    const providerReviews = await this.repository.listProviderReviews(provider.id);
    const nextReviewCount = providerReviews.length;

    await this.repository.updateProvider(provider.id, {
      rating: this.calculateAverageRating(providerReviews, "overallRating"),
      timelinessRating: this.calculateAverageRating(providerReviews, "timelinessRating"),
      attentionToDetailRating: this.calculateAverageRating(providerReviews, "attentionToDetailRating"),
      reviewCount: nextReviewCount
    });

    const linkedLead = booking.launchLeadId
      ? await this.syncLaunchLeadAfterReview(booking.launchLeadId, savedReview)
      : undefined;

    this.analytics.record({
      id: crypto.randomUUID(),
      name: MarketplaceTelemetryEventCatalog.providerReviewSubmitted,
      actorId: customerId,
      occurredAt: savedReview.createdAt,
      properties: {
        bookingId: booking.id,
        providerId: booking.providerId,
        overallRating: payload.overallRating,
        timelinessRating: payload.timelinessRating,
        attentionToDetailRating: payload.attentionToDetailRating,
        hasReviewText: true,
        ...this.buildLaunchAttributionAnalyticsProperties(payload.attribution ?? linkedLead?.attribution),
        ...this.buildLaunchLeadAnalyticsProperties(linkedLead),
        ...(linkedLead ? { launchLeadReviewCount: linkedLead.reviewIds.length } : {})
      }
    });

    await this.createNotification({
      recipientId: booking.providerId,
      recipientRole: "provider",
      category: "review",
      title: "You received a new review",
      body: `${payload.overallRating}/5 from a completed ${this.titleCaseCategory(booking.category)} booking.`,
      actionHref: "/provider/management"
    });

    return savedReview;
  }

  public async completeBooking(
    providerId: string,
    payload: CompleteBookingRequest
  ): Promise<Booking> {
    const booking = await this.repository.findBookingById(payload.bookingId);
    if (!booking) {
      throw new Error("Booking not found");
    }

    if (booking.providerId !== providerId) {
      throw new Error("Only the booking provider can mark the service completed");
    }

    if (
      booking.status !== "completed" &&
      booking.status !== "confirmed" &&
      booking.status !== "in-progress"
    ) {
      throw new Error("Bookings must be confirmed before the provider can complete them");
    }

    if (this.countBookingEvidence(booking, "after") < 1) {
      throw new Error("Capture at least one after photo before completing the booking");
    }

    const wasAlreadyCompleted = booking.status === "completed" && Boolean(booking.completedAt);
    const completedAt = booking.completedAt ?? new Date().toISOString();
    const updatedBooking = await this.repository.updateBooking(booking.id, {
      status: "completed",
      completedAt,
      activeExceptionType: undefined,
      activeExceptionReportedAt: undefined,
      activeExceptionNotes: undefined
    });

    if (!updatedBooking) {
      throw new Error("Booking could not be completed");
    }
    const capturedPayment = (await this.repository.listPayments()).find(
      (payment) => payment.bookingId === updatedBooking.id && payment.status === "captured"
    );
    if (capturedPayment) {
      await this.ensureBookingFinancialSettlement(updatedBooking, capturedPayment);
    }

    const existingInvite = await this.repository.findReviewInviteByBookingId(booking.id);
    if (!existingInvite) {
      const customer = await this.repository.findCustomerById(booking.customerId);
      if (!customer) {
        throw new Error("Customer not found");
      }

      const reviewInvite = this.buildReviewInvite(updatedBooking, customer.email, completedAt);
      await this.repository.createReviewInvite(reviewInvite);

      this.analytics.record({
        id: crypto.randomUUID(),
        name: MarketplaceTelemetryEventCatalog.reviewInviteScheduled,
        actorId: booking.customerId,
        occurredAt: completedAt,
        properties: {
          bookingId: booking.id,
          providerId: booking.providerId,
          scheduledSendIso: reviewInvite.scheduledSendIso
        }
      });
    }

    if (!wasAlreadyCompleted) {
      this.analytics.record({
        id: crypto.randomUUID(),
        name: MarketplaceTelemetryEventCatalog.bookingCompleted,
        actorId: booking.customerId,
        occurredAt: completedAt,
        properties: {
          bookingId: booking.id,
          providerId: booking.providerId
        }
      });

      await this.createNotification({
        recipientId: booking.customerId,
        recipientRole: "customer",
        category: "review",
        title: "Service marked complete",
        body: "Your landscaping service was completed. A review prompt will unlock after the follow-up delay.",
        actionHref: "/customer/dashboard"
      });

      await this.scheduleNextRecurringBookingIfNeeded(updatedBooking);
    }

    return updatedBooking;
  }

  public async confirmBooking(
    providerId: string,
    payload: ConfirmBookingRequest
  ): Promise<Booking> {
    const booking = await this.repository.findBookingById(payload.bookingId);
    if (!booking) {
      throw new HttpError(404, "Booking not found");
    }

    if (booking.providerId !== providerId) {
      throw new HttpError(403, "Only the booking provider can confirm this service");
    }

    if (
      booking.status === "confirmed" ||
      booking.status === "in-progress" ||
      booking.status === "completed"
    ) {
      return booking;
    }

    if (booking.status !== "requested") {
      throw new HttpError(400, "Only requested bookings can be confirmed");
    }

    const updatedBooking = await this.repository.updateBooking(booking.id, {
      status: "confirmed"
    });

    if (!updatedBooking) {
      throw new HttpError(500, "Booking could not be confirmed");
    }

    this.analytics.record({
      id: crypto.randomUUID(),
      name: MarketplaceTelemetryEventCatalog.bookingConfirmed,
      actorId: providerId,
      occurredAt: new Date().toISOString(),
      properties: {
        bookingId: booking.id,
        customerId: booking.customerId
      }
    });

    await this.createNotification({
      recipientId: booking.customerId,
      recipientRole: "customer",
      category: "booking",
      title: "Your booking is confirmed",
      body: "The landscaping business confirmed your requested service window.",
      actionHref: "/customer/dashboard"
    });

    return updatedBooking;
  }

  public async declineBooking(
    providerId: string,
    payload: { bookingId: string; reason?: string }
  ): Promise<Booking> {
    const booking = await this.repository.findBookingById(payload.bookingId);
    if (!booking) {
      throw new HttpError(404, "Booking not found");
    }

    if (booking.providerId !== providerId) {
      throw new HttpError(403, "Only the booking provider can decline this service");
    }

    if (booking.status === "cancelled") {
      return booking;
    }

    if (booking.status !== "requested") {
      throw new HttpError(400, "Only requested bookings can be declined");
    }

    const updatedBooking = await this.repository.updateBooking(booking.id, {
      status: "cancelled",
      activeExceptionType: undefined,
      activeExceptionReportedAt: undefined,
      activeExceptionNotes: undefined
    });

    if (!updatedBooking) {
      throw new HttpError(500, "Booking could not be declined");
    }

    this.analytics.record({
      id: crypto.randomUUID(),
      name: MarketplaceTelemetryEventCatalog.bookingDeclinedByProvider,
      actorId: providerId,
      occurredAt: new Date().toISOString(),
      properties: {
        bookingId: booking.id,
        customerId: booking.customerId,
        category: booking.category,
        reason: payload.reason?.trim() || "none"
      }
    });

    await this.createNotification({
      recipientId: booking.customerId,
      recipientRole: "customer",
      category: "booking",
      title: "Provider declined this request",
      body: payload.reason?.trim()
        ? `The provider could not take this service window. Note: ${payload.reason.trim()}`
        : "The provider could not take this service window. Please choose another qualified provider.",
      actionHref: "/customer/dashboard"
    });

    return updatedBooking;
  }

  public async createInstantQuote(payload: InstantQuoteRequest): Promise<InstantQuoteResponse> {
    const customer = payload.customerId ? await this.repository.findCustomerById(payload.customerId) : undefined;
    const property = payload.propertyId
      ? customer?.properties.find((item) => item.id === payload.propertyId)
      : undefined;

    if (payload.propertyId && !property) {
      throw new Error("Selected property does not belong to the customer");
    }

    const rawAddress = property?.address ?? payload.address;
    const validatedAddress = property
      ? {
          address: rawAddress,
          source: "local-rules" as const,
          confidence: "local-only" as const,
          message: undefined
        }
      : await this.normalizeValidateAndResolveCustomerAddress(rawAddress, customer);
    const normalizedAddress = validatedAddress.address;

    const quote = this.instantQuoteEngine.buildQuote({
      request: {
        ...payload,
        address: normalizedAddress
      },
      property,
      normalizedAddress: this.buildNormalizedAddressSummary(rawAddress, normalizedAddress, validatedAddress)
    });

    this.analytics.record({
      id: crypto.randomUUID(),
      name:
        quote.followUpQuestions.length > 0
          ? MarketplaceTelemetryEventCatalog.instantQuoteNeedsFollowUp
          : MarketplaceTelemetryEventCatalog.instantQuoteGenerated,
      actorId: payload.customerId,
      occurredAt: new Date().toISOString(),
      properties: {
        category: payload.category,
        confidenceTier: quote.confidenceTier,
        estimatedPriceCents: quote.estimatedPriceCents,
        estimatedDurationMinutes: quote.estimatedDurationMinutes,
        followUpQuestionCount: quote.followUpQuestions.length
      }
    });

    return {
      ...quote,
      launchPricingPolicy: this.buildLaunchPricingPolicy(payload.category)
    };
  }

  public async createBooking(
    customerId: string,
    payload: CreateBookingRequest
  ): Promise<Booking> {
    return this.createBookingRecord(customerId, payload);
  }

  public async createRecurringServicePlan(
    customerId: string,
    payload: CreateRecurringServicePlanRequest
  ): Promise<CreateRecurringServicePlanResponse> {
    const customer = await this.repository.findCustomerById(customerId);
    if (!customer) {
      throw new Error("Customer not found");
    }

    const selectedProperty = payload.servicePropertyId
      ? customer.properties.find((property) => property.id === payload.servicePropertyId)
      : undefined;

    if (payload.servicePropertyId && !selectedProperty) {
      throw new Error("Selected property does not belong to the customer");
    }

    const validatedServiceAddress = selectedProperty
      ? selectedProperty.address
      : (await this.normalizeValidateAndResolveCustomerAddress(payload.serviceAddress, customer)).address;
    const { lead: linkedLaunchLead } = await this.resolveLaunchLeadForCustomer(customer, payload);

    const plan: RecurringServicePlan = {
      id: crypto.randomUUID(),
      customerId,
      providerId: payload.providerId,
      launchLeadId: linkedLaunchLead?.id,
      serviceAddress: validatedServiceAddress,
      servicePropertyId: payload.servicePropertyId,
      category: payload.category,
      frequency: payload.frequency,
      requestedAt: new Date().toISOString(),
      notes: payload.notes,
      totalCents: payload.totalCents,
      status: "active",
      anchorScheduledStartIso: payload.scheduledStartIso,
      anchorScheduledEndIso: payload.scheduledEndIso
    };

    await this.repository.createRecurringServicePlan(plan);

    const initialBooking = await this.createBookingRecord(
      customerId,
      {
        providerId: payload.providerId,
        serviceAddress: validatedServiceAddress,
        servicePropertyId: payload.servicePropertyId,
        category: payload.category,
        scheduledStartIso: payload.scheduledStartIso,
        scheduledEndIso: payload.scheduledEndIso,
        notes: payload.notes,
        totalCents: payload.totalCents,
        launchLeadId: linkedLaunchLead?.id,
        recommendationSessionId: payload.recommendationSessionId,
        recommendedProviderId: payload.recommendedProviderId,
        selectedProviderRank: payload.selectedProviderRank,
        viewedAlternativeProviders: payload.viewedAlternativeProviders,
        requestSource: payload.requestSource,
        recommendationSource: payload.recommendationSource,
        retentionContext: payload.retentionContext,
        attribution: payload.attribution
      },
      {
        recurringPlanId: plan.id,
        recurringOccurrenceIndex: 1,
        providerNotificationTitle: "New recurring booking request",
        providerNotificationBody: `${customer.fullName} started a ${this.describeRecurringFrequency(
          payload.frequency
        )} ${this.titleCaseCategory(payload.category).toLowerCase()} plan beginning ${this.formatBookingWindowWithDate(
          payload.scheduledStartIso
        )}.`
      }
    );

    await this.repository.updateRecurringServicePlan(plan.id, {
      lastGeneratedBookingId: initialBooking.id,
      lastGeneratedAt: initialBooking.requestedAt,
      lastSchedulingAttemptAt: initialBooking.requestedAt,
      lastSchedulingError: undefined
    });

    await this.createNotification({
      recipientId: customerId,
      recipientRole: "customer",
      category: "booking",
      title: "Recurring plan started",
      body: `Your ${this.describeRecurringFrequency(payload.frequency)} ${this.titleCaseCategory(
        payload.category
      ).toLowerCase()} plan is active. The first visit has been requested.`,
      actionHref: "/customer/dashboard"
    });

    return {
      plan: await this.buildRecurringServicePlanSummary(plan.id),
      initialBooking
    };
  }

  public async listRecurringServicePlansForCustomer(
    customerId: string
  ): Promise<ListRecurringServicePlansResponse> {
    const plans = (await this.repository.listRecurringServicePlans())
      .filter((plan) => plan.customerId === customerId)
      .sort((left, right) => right.requestedAt.localeCompare(left.requestedAt));

    return {
      plans: await Promise.all(plans.map((plan) => this.buildRecurringServicePlanSummary(plan.id)))
    };
  }

  public async cancelRecurringServicePlan(
    customerId: string,
    payload: CancelRecurringServicePlanRequest
  ): Promise<RecurringServicePlanSummary> {
    const plan = await this.repository.findRecurringServicePlanById(payload.planId);
    if (!plan) {
      throw new HttpError(404, "Recurring plan not found");
    }

    if (plan.customerId !== customerId) {
      throw new HttpError(403, "Customers can only manage their own recurring plans");
    }

    if (plan.status === "cancelled") {
      return this.buildRecurringServicePlanSummary(plan.id);
    }

    const cancelledAt = new Date().toISOString();
    const allBookings = await this.repository.listBookings();
    const futureBookings = allBookings.filter(
      (booking) =>
        booking.recurringPlanId === plan.id &&
        (booking.status === "requested" || booking.status === "confirmed") &&
        new Date(booking.scheduledStartIso).getTime() > Date.now()
    );

    for (const booking of futureBookings) {
      await this.repository.updateBooking(booking.id, {
        status: "cancelled",
        activeExceptionType: undefined,
        activeExceptionReportedAt: undefined,
        activeExceptionNotes: undefined
      });
    }

    await this.repository.updateRecurringServicePlan(plan.id, {
      status: "cancelled",
      cancelledAt,
      cancellationReason: payload.reason?.trim() || "Customer cancelled the recurring service plan."
    });

    await this.createNotification({
      recipientId: plan.providerId,
      recipientRole: "provider",
      category: "booking",
      title: "Recurring plan cancelled",
      body: "A customer cancelled an active recurring service plan and any upcoming requested visits tied to it.",
      actionHref: "/provider/management"
    });

    return this.buildRecurringServicePlanSummary(plan.id);
  }

  private async createBookingRecord(
    customerId: string,
    payload: CreateBookingRequest,
    options?: {
      recurringPlanId?: string;
      recurringOccurrenceIndex?: number;
      providerNotificationTitle?: string;
      providerNotificationBody?: string;
      skipProviderAvailabilityCheck?: boolean;
      skipRequestedFunnelEvent?: boolean;
    }
  ): Promise<Booking> {
    const customer = await this.repository.findCustomerById(customerId);
    if (!customer) {
      throw new Error("Customer not found");
    }

    const selectedProperty = payload.servicePropertyId
      ? customer.properties.find((property) => property.id === payload.servicePropertyId)
      : undefined;

    if (payload.servicePropertyId && !selectedProperty) {
      throw new Error("Selected property does not belong to the customer");
    }

    const validatedServiceAddress = selectedProperty
      ? selectedProperty.address
      : (await this.normalizeValidateAndResolveCustomerAddress(payload.serviceAddress, customer)).address;
    const { lead: linkedLaunchLead, linkMode } = await this.resolveLaunchLeadForCustomer(customer, payload);

    const bookingBase = this.bookingLifecycle.createBooking(crypto.randomUUID(), {
      customerId,
      ...payload,
      launchLeadId: linkedLaunchLead?.id,
      serviceAddress: validatedServiceAddress
    });

    const booking: Booking = {
      ...bookingBase,
      recurringPlanId: options?.recurringPlanId,
      recurringOccurrenceIndex: options?.recurringOccurrenceIndex
    };

    if (!options?.skipProviderAvailabilityCheck) {
      await this.assertProviderWindowIsAvailable(
        payload.providerId,
        payload.scheduledStartIso,
        payload.scheduledEndIso
      );
    }

    const result = await this.repository.createBooking(booking);
    const linkedLead = result.launchLeadId
      ? await this.syncLaunchLeadAfterBooking(result.launchLeadId, result)
      : undefined;

    if (!options?.skipRequestedFunnelEvent) {
      this.analytics.recordFunnelStep(MarketplaceTelemetryEventCatalog.bookingRequested, customerId, {
        providerId: payload.providerId,
        totalCents: payload.totalCents,
        category: payload.category,
        servicePropertyId: payload.servicePropertyId ?? "custom-address",
        requestSource: payload.requestSource ?? payload.recommendationSource ?? "unknown",
        recurringPlanStarted: Boolean(options?.recurringPlanId),
        ...this.buildRetentionAnalyticsProperties(payload.retentionContext),
        ...this.buildLaunchAttributionAnalyticsProperties(payload.attribution ?? linkedLead?.attribution),
        ...this.buildLaunchLeadAnalyticsProperties(linkedLead, linkMode),
        ...(linkedLead
          ? { launchLeadConvertedBookingCount: linkedLead.convertedBookingIds.length }
          : {})
      });
      this.recordRecommendationBookingIntent(
        customerId,
        payload,
        Boolean(options?.recurringPlanId),
        linkedLead,
        linkMode
      );
      this.recordRecommendationSelection(
        customerId,
        result,
        payload,
        Boolean(options?.recurringPlanId),
        linkedLead,
        linkMode
      );
    }

    await this.createNotification({
      recipientId: payload.providerId,
      recipientRole: "provider",
      category: "booking",
      title: options?.providerNotificationTitle ?? "New booking request",
      body:
        options?.providerNotificationBody ??
        `${customer.fullName} requested ${this.titleCaseCategory(payload.category)} for ${new Date(
          booking.scheduledStartIso
        ).toLocaleDateString()}.`,
      actionHref: "/provider/management"
    });

    return result;
  }

  private recordRecommendationSelection(
    customerId: string,
    booking: Booking,
    payload: CreateBookingRequest,
    recurringPlanStarted: boolean,
    linkedLead?: LaunchLead,
    linkMode?: LaunchLeadLinkMode
  ): void {
    if (!payload.recommendationSessionId) {
      return;
    }

    const selectedRecommendedProvider = payload.recommendedProviderId
      ? payload.providerId === payload.recommendedProviderId
      : payload.selectedProviderRank === 1;
    const eventName = selectedRecommendedProvider
      ? MarketplaceTelemetryEventCatalog.recommendationAccepted
      : MarketplaceTelemetryEventCatalog.recommendationSwapped;

    this.analytics.recordFunnelStep(eventName, customerId, {
      bookingId: booking.id,
      providerId: payload.providerId,
      category: payload.category,
      recommendationSessionId: payload.recommendationSessionId,
      recommendedProviderId: payload.recommendedProviderId ?? "unknown",
      selectedProviderRank: payload.selectedProviderRank ?? "unknown",
      viewedAlternativeProviders: payload.viewedAlternativeProviders ?? false,
      requestSource: payload.requestSource ?? payload.recommendationSource ?? "unknown",
      recommendationSource: payload.recommendationSource ?? "unknown",
      recurringPlanStarted,
      ...this.buildRetentionAnalyticsProperties(payload.retentionContext),
      ...this.buildLaunchAttributionAnalyticsProperties(payload.attribution ?? linkedLead?.attribution),
      ...this.buildLaunchLeadAnalyticsProperties(linkedLead, linkMode),
      ...(linkedLead
        ? { launchLeadConvertedBookingCount: linkedLead.convertedBookingIds.length }
        : {})
    });
  }

  private recordRecommendationBookingIntent(
    customerId: string,
    payload: CreateBookingRequest,
    recurringPlanStarted: boolean,
    linkedLead?: LaunchLead,
    linkMode?: LaunchLeadLinkMode
  ): void {
    if (!payload.recommendationSessionId) {
      return;
    }

    this.analytics.recordFunnelStep(MarketplaceTelemetryEventCatalog.recommendationBookingIntent, customerId, {
      providerId: payload.providerId,
      category: payload.category,
      recommendationSessionId: payload.recommendationSessionId,
      recommendedProviderId: payload.recommendedProviderId ?? "unknown",
      selectedProviderRank: payload.selectedProviderRank ?? "unknown",
      viewedAlternativeProviders: payload.viewedAlternativeProviders ?? false,
      requestSource: payload.requestSource ?? payload.recommendationSource ?? "unknown",
      recommendationSource: payload.recommendationSource ?? "unknown",
      recurringPlanStarted,
      ...this.buildRetentionAnalyticsProperties(payload.retentionContext),
      ...this.buildLaunchAttributionAnalyticsProperties(payload.attribution ?? linkedLead?.attribution),
      ...this.buildLaunchLeadAnalyticsProperties(linkedLead, linkMode),
      ...(linkedLead
        ? { launchLeadConvertedBookingCount: linkedLead.convertedBookingIds.length }
          : {})
    });
  }

  public async cancelBooking(
    customerId: string,
    payload: CancelBookingRequest
  ): Promise<Booking> {
    const booking = await this.repository.findBookingById(payload.bookingId);
    if (!booking) {
      throw new Error("Booking not found");
    }

    this.assertCustomerCanManageBooking(customerId, booking);
    if (!this.canCustomerCancelOrReschedule(booking)) {
      throw new Error("Only future requested or confirmed bookings can be cancelled");
    }

    const updatedBooking = await this.repository.updateBooking(booking.id, {
      status: "cancelled",
      activeExceptionType: undefined,
      activeExceptionReportedAt: undefined,
      activeExceptionNotes: undefined
    });

    if (!updatedBooking) {
      throw new Error("Booking could not be cancelled");
    }

    this.analytics.record({
      id: crypto.randomUUID(),
      name: MarketplaceTelemetryEventCatalog.bookingCancelled,
      actorId: customerId,
      occurredAt: new Date().toISOString(),
      properties: {
        bookingId: booking.id,
        providerId: booking.providerId,
        category: booking.category,
        actorRole: "customer"
      }
    });

    await this.createNotification({
      recipientId: booking.providerId,
      recipientRole: "provider",
      category: "booking",
      title: "Booking cancelled",
      body: "A customer cancelled an upcoming booking.",
      actionHref: "/provider/management"
    });

    return updatedBooking;
  }

  public async rescheduleBooking(
    customerId: string,
    payload: RescheduleBookingRequest
  ): Promise<Booking> {
    const booking = await this.repository.findBookingById(payload.bookingId);
    if (!booking) {
      throw new Error("Booking not found");
    }

    this.assertCustomerCanManageBooking(customerId, booking);
    if (!this.canCustomerCancelOrReschedule(booking)) {
      throw new Error("Only future requested or confirmed bookings can be rescheduled");
    }

    const nextStart = new Date(payload.scheduledStartIso);
    const nextEnd = new Date(payload.scheduledEndIso);

    if (Number.isNaN(nextStart.getTime()) || Number.isNaN(nextEnd.getTime())) {
      throw new Error("A valid start and end time are required");
    }

    if (nextStart.getTime() <= Date.now()) {
      throw new Error("Rescheduled start time must be in the future");
    }

    if (nextEnd.getTime() <= nextStart.getTime()) {
      throw new Error("Rescheduled end time must be after the start time");
    }

    const hoursUntilOriginalStart =
      (new Date(booking.scheduledStartIso).getTime() - Date.now()) / (60 * 60 * 1000);

    if (booking.status === "confirmed" && hoursUntilOriginalStart < 24) {
      throw new Error("Confirmed bookings starting in less than 24 hours cannot be rescheduled in app");
    }

    await this.assertProviderRescheduleWindowIsAvailable(
      booking.providerId,
      booking.id,
      payload.scheduledStartIso,
      payload.scheduledEndIso
    );

    const updatedBooking = await this.repository.updateBooking(booking.id, {
      scheduledStartIso: payload.scheduledStartIso,
      scheduledEndIso: payload.scheduledEndIso,
      lateNoticeSentAt: undefined,
      lateEtaIso: undefined,
      lateReason: undefined,
      activeExceptionType: undefined,
      activeExceptionReportedAt: undefined,
      activeExceptionNotes: undefined
    });

    if (!updatedBooking) {
      throw new Error("Booking could not be rescheduled");
    }

    this.analytics.record({
      id: crypto.randomUUID(),
      name: MarketplaceTelemetryEventCatalog.bookingRescheduled,
      actorId: customerId,
      occurredAt: new Date().toISOString(),
      properties: {
        bookingId: booking.id,
        providerId: booking.providerId,
        previousStartIso: booking.scheduledStartIso,
        nextStartIso: payload.scheduledStartIso
      }
    });

    await this.createNotification({
      recipientId: booking.providerId,
      recipientRole: "provider",
      category: "booking",
      title: "Booking rescheduled",
      body: `A customer moved a ${this.titleCaseCategory(booking.category)} booking to a new time.`,
      actionHref: "/provider/management"
    });

    return updatedBooking;
  }

  public async runProviderAssistantCommand(
    providerId: string,
    payload: ProviderAssistantCommandRequest
  ): Promise<ProviderAssistantCommandResponse> {
    const command = payload.command.trim();
    if (!command) {
      throw new HttpError(400, "A provider assistant command is required");
    }

    const parsed = this.parseProviderAssistantCommand(command);
    if (
      !parsed.understood ||
      parsed.actions.some(
        (action) =>
          (action.actionType === "summarize-dispatch" && !action.dispatchScope) ||
          (action.actionType === "reschedule-booking" && !action.targetWindowKey) ||
          (action.actionType === "mark-booking-late" && !action.lateMinutes) ||
          (action.actionType === "report-booking-exception" && !action.exceptionType)
      )
    ) {
      return {
        command,
        understood: false,
        requiresBookingSelection: false,
        requiresConfirmation: false,
        executed: false,
        notifyCustomer: parsed.notifyCustomer,
        actionTypes: parsed.actionTypes.length > 0 ? parsed.actionTypes : undefined,
        previewLabel: "Could not understand command",
        previewMessage: this.providerAssistantHelpText(),
        bookingCandidates: []
      };
    }

    if (parsed.actions.length === 1 && parsed.actions[0]?.actionType === "summarize-dispatch") {
      return this.runProviderAssistantDispatchSummary(providerId, parsed.actions[0], command);
    }

    if (parsed.actions.length === 1 && parsed.actions[0]?.actionType === "recommend-dispatch-adjustment") {
      return this.runProviderAssistantDispatchAdjustment(providerId, parsed.actions[0], command);
    }

    if (parsed.actions.length === 1 && parsed.actions[0]?.actionType === "recommend-staffing-adjustment") {
      return this.runProviderAssistantStaffingAdjustment(providerId, parsed.actions[0], command);
    }

    const upcomingBookings = await this.listProviderAssistantCandidates(providerId);
    const matchingCandidates = payload.bookingId
      ? upcomingBookings.filter((booking) => booking.id === payload.bookingId)
      : parsed.sourceWindowKey
        ? upcomingBookings.filter(
            (booking) => getBookingServiceWindow(booking.scheduledStartIso).key === parsed.sourceWindowKey
          )
        : upcomingBookings;

    if (payload.bookingId && matchingCandidates.length === 0) {
      throw new HttpError(404, "Booking not found for this provider assistant command");
    }

    if (!payload.bookingId && matchingCandidates.length !== 1) {
      const candidates = matchingCandidates.map((booking) => this.toProviderAssistantBookingCandidate(booking));
      return {
        command,
        understood: true,
        actionType: parsed.actionType,
        actionTypes: parsed.actionTypes,
        requiresBookingSelection: true,
        requiresConfirmation: false,
        executed: false,
        notifyCustomer: parsed.notifyCustomer,
        sourceWindowKey: parsed.sourceWindowKey,
        targetWindowKey: parsed.targetWindowKey,
        targetWindowLabel: parsed.targetWindowKey
          ? this.providerAssistantWindowLabel(parsed.targetWindowKey)
          : undefined,
        lateMinutes: parsed.lateMinutes,
        previewLabel:
          matchingCandidates.length === 0 ? "No matching appointment found" : "Pick the appointment",
        previewMessage:
          matchingCandidates.length === 0
            ? "The assistant could not find an upcoming provider booking that matches that time window."
            : "More than one upcoming booking matches that request, so choose the booking explicitly and run the command again.",
        bookingCandidates: candidates
      };
    }

    const booking = matchingCandidates[0];
    if (!booking) {
      throw new HttpError(404, "No matching provider booking was found");
    }

    if (parsed.actions.length === 1) {
      return this.runProviderAssistantSingleAction(providerId, booking, parsed.actions[0]!, payload.execute === true, command);
    }

    const stepResponses: ProviderAssistantCommandResponse[] = [];
    let currentBooking = booking;
    let projectedMatches =
      payload.execute === true
        ? undefined
        : await this.listProviderAssistantBookingMatches(providerId, booking.id);

    for (const [index, action] of parsed.actions.entries()) {
      const response = await this.runProviderAssistantSingleAction(
        providerId,
        currentBooking,
        action,
        payload.execute === true,
        command,
        projectedMatches
      );
      stepResponses.push(response);

      if (!payload.execute && !response.requiresConfirmation) {
        return {
          ...response,
          command,
          actionTypes: parsed.actionTypes,
          previewLabel: "Multi-step command needs attention",
          previewMessage: `Step ${index + 1} is blocked. ${response.previewMessage}`
        };
      }

      if (payload.execute && !response.executed) {
        return {
          ...response,
          command,
          actionTypes: parsed.actionTypes,
          previewLabel: "Multi-step command stopped early",
          previewMessage: `Step ${index + 1} could not finish. ${response.previewMessage}`
        };
      }

      currentBooking =
        payload.execute === true
          ? response.updatedBooking
            ? {
                ...response.updatedBooking,
                customerName: currentBooking.customerName ?? "Customer"
              }
            : currentBooking
          : this.projectBookingAfterProviderAssistantAction(currentBooking, action);
      if (payload.execute !== true && projectedMatches) {
        projectedMatches = this.projectCrewMatchesAfterProviderAssistantAction(projectedMatches, action);
      }
    }

    return this.mergeProviderAssistantResponses(command, parsed.actionTypes, stepResponses, payload.execute === true);
  }

  private async runProviderAssistantDispatchSummary(
    providerId: string,
    action: ParsedProviderAssistantAction,
    originalCommand: string
  ): Promise<ProviderAssistantCommandResponse> {
    const window = this.buildProviderAssistantDispatchWindow(action.dispatchScope ?? "today");
    const overview = await this.getProviderCalendarOverview(providerId, window);
    const scopeLabel = this.providerAssistantDispatchScopeLabel(action.dispatchScope ?? "today");

    if (action.dispatchScope === "next-7-days") {
      const rangeSummary = this.buildProviderAssistantDispatchRangeSummary(overview.dispatchDays);
      if (!rangeSummary) {
        return {
          command: originalCommand,
          understood: true,
          actionType: "summarize-dispatch",
          actionTypes: ["summarize-dispatch"],
          requiresBookingSelection: false,
          requiresConfirmation: false,
          executed: false,
          notifyCustomer: false,
          previewLabel: `${scopeLabel} looks open`,
          previewMessage: `There are no YardMatch jobs or outside calendar blocks across ${scopeLabel.toLowerCase()}.`,
          bookingCandidates: []
        };
      }

      if (action.dispatchFocus === "attention") {
        const targetDay =
          rangeSummary.overloadedDayCount > 0
            ? overview.dispatchDays.find((day) => day.routeStatus === "overloaded")
            : rangeSummary.highestCrewGapDay?.crewGap
              ? rangeSummary.highestCrewGapDay
              : rangeSummary.watchDayCount > 0
                ? overview.dispatchDays.find((day) => day.routeStatus === "watch")
                : rangeSummary.highestDriveMilesDay ?? rangeSummary.busiestDay;

        if (targetDay) {
          const focusWindow = this.selectProviderAssistantDispatchFocusWindow(targetDay);
          const recommendationText =
            targetDay.recommendations.length > 0
              ? ` Recommendations: ${targetDay.recommendations.join(" ")}`
              : "";
          const focusWindowText = focusWindow
            ? ` Biggest pressure window: ${focusWindow.label} with ${focusWindow.yardmatchJobCount} job${
                focusWindow.yardmatchJobCount === 1 ? "" : "s"
              }, crew gap ${focusWindow.crewGap}, and ${focusWindow.blockedMinutes} blocked minutes.`
            : "";

          return {
            command: originalCommand,
            understood: true,
            actionType: "summarize-dispatch",
            actionTypes: ["summarize-dispatch"],
            requiresBookingSelection: false,
            requiresConfirmation: false,
            executed: false,
            notifyCustomer: false,
            dispatchDaySummary: targetDay,
            dispatchWindowSummary: focusWindow,
            dispatchRangeSummary: rangeSummary,
            previewLabel: `${scopeLabel} dispatch attention`,
            previewMessage: `${targetDay.dayLabel} needs the most attention. It is ${targetDay.routeStatus} with ${
              targetDay.yardmatchJobCount
            } YardMatch job${targetDay.yardmatchJobCount === 1 ? "" : "s"}, crew gap ${
              targetDay.crewGap
            }, and ${targetDay.estimatedDriveMiles.toFixed(1)} route miles.${focusWindowText}${recommendationText}`,
            bookingCandidates: this.buildProviderAssistantDispatchBookingCandidates(overview, targetDay, focusWindow)
          };
        }
      }

      const rangeRecommendations =
        rangeSummary.recommendations.length > 0
          ? ` Recommendations: ${rangeSummary.recommendations.join(" ")}`
          : "";
      const busiestDayText = rangeSummary.busiestDay
        ? ` Busiest day: ${rangeSummary.busiestDay.dayLabel} with ${rangeSummary.busiestDay.yardmatchJobCount} jobs.`
        : "";
      const crewGapText =
        rangeSummary.highestCrewGapDay && rangeSummary.highestCrewGapDay.crewGap > 0
          ? ` Biggest crew gap: ${rangeSummary.highestCrewGapDay.dayLabel} (${rangeSummary.highestCrewGapDay.crewGap}).`
          : "";

      return {
        command: originalCommand,
        understood: true,
        actionType: "summarize-dispatch",
        actionTypes: ["summarize-dispatch"],
        requiresBookingSelection: false,
        requiresConfirmation: false,
        executed: false,
        notifyCustomer: false,
        dispatchRangeSummary: rangeSummary,
        previewLabel: `${scopeLabel} dispatch summary`,
        previewMessage: `${scopeLabel} has ${rangeSummary.totalYardmatchJobs} YardMatch jobs across ${
          rangeSummary.activeDayCount
        } active day${rangeSummary.activeDayCount === 1 ? "" : "s"}, ${rangeSummary.watchDayCount} watch day${
          rangeSummary.watchDayCount === 1 ? "" : "s"
        }, and ${rangeSummary.overloadedDayCount} overloaded day${
          rangeSummary.overloadedDayCount === 1 ? "" : "s"
        }.${busiestDayText}${crewGapText}${rangeRecommendations}`,
        bookingCandidates: []
      };
    }

    const targetDay =
      overview.dispatchDays.find((day) =>
        this.doIntervalsOverlap(
          day.dateIso,
          new Date(new Date(day.dateIso).getTime() + 24 * 60 * 60 * 1000).toISOString(),
          window.fromIso,
          window.toIso
        )
      ) ?? overview.dispatchDays[0];

    if (!targetDay) {
      return {
        command: originalCommand,
        understood: true,
        actionType: "summarize-dispatch",
        actionTypes: ["summarize-dispatch"],
        requiresBookingSelection: false,
        requiresConfirmation: false,
        executed: false,
        notifyCustomer: false,
        previewLabel: `${scopeLabel} looks open`,
        previewMessage: `There are no YardMatch jobs or outside calendar blocks on ${scopeLabel.toLowerCase()}.`,
        bookingCandidates: []
      };
    }

    const recommendationText =
      targetDay.recommendations.length > 0
        ? ` Recommendations: ${targetDay.recommendations.join(" ")}`
        : "";
    const firstStopText = targetDay.firstStopAddressLine ? ` First stop: ${targetDay.firstStopAddressLine}.` : "";
    const focusWindow = this.selectProviderAssistantDispatchFocusWindow(targetDay);

    if (action.dispatchFocus === "attention") {
      const focusWindowText = focusWindow
        ? ` The biggest pressure is in the ${focusWindow.label.toLowerCase()} window with ${focusWindow.yardmatchJobCount} job${
            focusWindow.yardmatchJobCount === 1 ? "" : "s"
          }, crew gap ${focusWindow.crewGap}, and ${focusWindow.blockedMinutes} blocked minutes.`
        : "";
      return {
        command: originalCommand,
        understood: true,
        actionType: "summarize-dispatch",
        actionTypes: ["summarize-dispatch"],
        requiresBookingSelection: false,
        requiresConfirmation: false,
        executed: false,
        notifyCustomer: false,
        dispatchDaySummary: targetDay,
        dispatchWindowSummary: focusWindow,
        previewLabel: `${scopeLabel} dispatch attention`,
        previewMessage: `${scopeLabel} needs attention because the route is ${targetDay.routeStatus} with crew gap ${
          targetDay.crewGap
        } and ${targetDay.estimatedDriveMiles.toFixed(1)} route miles.${focusWindowText}${recommendationText}`,
        bookingCandidates: this.buildProviderAssistantDispatchBookingCandidates(overview, targetDay, focusWindow)
      };
    }

    return {
      command: originalCommand,
      understood: true,
      actionType: "summarize-dispatch",
      actionTypes: ["summarize-dispatch"],
      requiresBookingSelection: false,
      requiresConfirmation: false,
      executed: false,
      notifyCustomer: false,
      dispatchDaySummary: targetDay,
      previewLabel: `${scopeLabel} dispatch summary`,
      previewMessage: `${scopeLabel} is ${targetDay.routeStatus}. ${targetDay.yardmatchJobCount} YardMatch job${
        targetDay.yardmatchJobCount === 1 ? "" : "s"
      }, ${targetDay.externalBlockCount} outside block${targetDay.externalBlockCount === 1 ? "" : "s"}, crew gap ${
        targetDay.crewGap
      }, and about ${targetDay.estimatedDriveMiles.toFixed(1)} route miles.${firstStopText}${recommendationText}`,
      bookingCandidates: []
    };
  }

  private async runProviderAssistantDispatchAdjustment(
    providerId: string,
    action: ParsedProviderAssistantAction,
    originalCommand: string
  ): Promise<ProviderAssistantCommandResponse> {
    const window = this.buildProviderAssistantDispatchWindow(action.dispatchScope ?? "today");
    const overview = await this.getProviderCalendarOverview(providerId, window);
    const scopeLabel = this.providerAssistantDispatchScopeLabel(action.dispatchScope ?? "today");
    const targetDay =
      action.dispatchScope === "next-7-days"
        ? this.selectProviderAssistantWeekAttentionDay(overview)
        : overview.dispatchDays.find((day) =>
            this.doIntervalsOverlap(
              day.dateIso,
              new Date(new Date(day.dateIso).getTime() + 24 * 60 * 60 * 1000).toISOString(),
              window.fromIso,
              window.toIso
            )
          ) ?? overview.dispatchDays[0];

    if (!targetDay) {
      return {
        command: originalCommand,
        understood: true,
        actionType: "recommend-dispatch-adjustment",
        actionTypes: ["recommend-dispatch-adjustment"],
        requiresBookingSelection: false,
        requiresConfirmation: false,
        executed: false,
        notifyCustomer: false,
        previewLabel: `${scopeLabel} looks open`,
        previewMessage: `There are no YardMatch jobs or outside calendar blocks on ${scopeLabel.toLowerCase()}, so no dispatch adjustment is needed.`,
        bookingCandidates: []
      };
    }

    const focusWindow = this.selectProviderAssistantDispatchFocusWindow(targetDay);
    if (!focusWindow || focusWindow.yardmatchJobCount === 0) {
      return {
        command: originalCommand,
        understood: true,
        actionType: "recommend-dispatch-adjustment",
        actionTypes: ["recommend-dispatch-adjustment"],
        requiresBookingSelection: false,
        requiresConfirmation: false,
        executed: false,
        notifyCustomer: false,
        dispatchDaySummary: targetDay,
        previewLabel: `${scopeLabel} does not need a move`,
        previewMessage: `${targetDay.dayLabel} does not have a pressured YardMatch window that needs a reschedule recommendation right now.`,
        bookingCandidates: []
      };
    }

    if (this.isProviderAssistantStaffingPressureDominant(targetDay, focusWindow)) {
      const staffing = await this.getProviderStaffingOverview(providerId);
      const dayStartIso = targetDay.dateIso;
      const dayEndIso = new Date(new Date(targetDay.dateIso).getTime() + 24 * 60 * 60 * 1000).toISOString();
      const staffingPlan = this.buildProviderAssistantStaffingPlan(
        this.getProviderAssistantStaffingJobsNeedingCrew(staffing, dayStartIso, dayEndIso, focusWindow.windowKey)
      );
      const staffingPlanPreview = this.buildProviderAssistantStaffingPlanPreview(staffingPlan);

      return {
        command: originalCommand,
        understood: true,
        actionType: "recommend-dispatch-adjustment",
        actionTypes: ["recommend-dispatch-adjustment"],
        requiresBookingSelection: false,
        requiresConfirmation: false,
        executed: false,
        notifyCustomer: false,
        dispatchDaySummary: targetDay,
        dispatchWindowSummary: focusWindow,
        previewLabel: `${scopeLabel} needs staffing first`,
        previewMessage: `${targetDay.dayLabel} is pressured mainly because the ${focusWindow.label.toLowerCase()} window has ${focusWindow.crewGap} open crew slot${
          focusWindow.crewGap === 1 ? "" : "s"
        }. Source or approve crew before moving appointments; a reschedule will not fix the staffing gap by itself.${staffingPlanPreview}`,
        bookingCandidates: this.buildProviderAssistantDispatchBookingCandidates(overview, targetDay, focusWindow),
        staffingPlan
      };
    }

    const focusCandidates = this.buildProviderAssistantDispatchBookingCandidates(overview, targetDay, focusWindow);
    if (focusCandidates.length === 0) {
      return {
        command: originalCommand,
        understood: true,
        actionType: "recommend-dispatch-adjustment",
        actionTypes: ["recommend-dispatch-adjustment"],
        requiresBookingSelection: false,
        requiresConfirmation: false,
        executed: false,
        notifyCustomer: false,
        dispatchDaySummary: targetDay,
        dispatchWindowSummary: focusWindow,
        previewLabel: `${scopeLabel} needs manual review`,
        previewMessage: `The ${focusWindow.label.toLowerCase()} window looks pressured, but the assistant could not isolate a booking candidate to move yet.`,
        bookingCandidates: []
      };
    }

    const suggestedWindow = this.selectProviderAssistantReliefWindow(targetDay, focusWindow);
    const providerBookings = await this.listProviderAssistantCandidates(providerId);
    const providerBookingsById = new Map(providerBookings.map((booking) => [booking.id, booking]));
    const orderedCandidates = this.orderProviderAssistantDispatchAdjustmentCandidates(
      focusCandidates,
      focusWindow.windowKey,
      suggestedWindow?.windowKey
    );
    const recommendedCandidate =
      orderedCandidates
        .map((candidate) => providerBookingsById.get(candidate.bookingId))
        .find((candidate): candidate is Awaited<ReturnType<typeof this.listProviderAssistantCandidates>>[number] =>
          Boolean(candidate)
        ) ?? providerBookingsById.get(orderedCandidates[0]!.bookingId);

    if (!recommendedCandidate) {
      return {
        command: originalCommand,
        understood: true,
        actionType: "recommend-dispatch-adjustment",
        actionTypes: ["recommend-dispatch-adjustment"],
        requiresBookingSelection: false,
        requiresConfirmation: false,
        executed: false,
        notifyCustomer: false,
        dispatchDaySummary: targetDay,
        dispatchWindowSummary: focusWindow,
        previewLabel: `${scopeLabel} needs manual review`,
        previewMessage: `The ${focusWindow.label.toLowerCase()} window looks pressured, but the assistant could not load the booking details needed to recommend a move.`,
        bookingCandidates: orderedCandidates
      };
    }

    const crossDayReliefSlot =
      suggestedWindow
        ? undefined
        : await this.findProviderAssistantCrossDayReliefSlot(
            providerId,
            recommendedCandidate,
            new Date(new Date(targetDay.dateIso).getTime() + 24 * 60 * 60 * 1000).toISOString()
          );
    const suggestedTimes = suggestedWindow
      ? this.buildProviderAssistantTargetWindow(recommendedCandidate, suggestedWindow.windowKey)
      : crossDayReliefSlot
        ? this.buildProviderAssistantTargetWindowFromSlot(recommendedCandidate, crossDayReliefSlot)
        : undefined;
    const targetWindowLabel = suggestedWindow
      ? suggestedWindow.label
      : crossDayReliefSlot
        ? this.formatBookingWindowWithDate(crossDayReliefSlot.startIso)
        : undefined;
    const recommendationContext = suggestedWindow
      ? `${focusWindow.label} currently has ${focusWindow.yardmatchJobCount} job${
          focusWindow.yardmatchJobCount === 1 ? "" : "s"
        }, crew gap ${focusWindow.crewGap}, and ${focusWindow.blockedMinutes} blocked minutes, while ${
          suggestedWindow.label
        } is lighter with ${suggestedWindow.yardmatchJobCount} job${
          suggestedWindow.yardmatchJobCount === 1 ? "" : "s"
        } and crew gap ${suggestedWindow.crewGap}.`
      : crossDayReliefSlot
        ? `${focusWindow.label} currently has ${focusWindow.yardmatchJobCount} job${
            focusWindow.yardmatchJobCount === 1 ? "" : "s"
          }, crew gap ${focusWindow.crewGap}, and ${focusWindow.blockedMinutes} blocked minutes. The next cleaner route opening lands on ${this.formatBookingWindowWithDate(
            crossDayReliefSlot.startIso
          )}.`
      : `${focusWindow.label} currently has ${focusWindow.yardmatchJobCount} job${
          focusWindow.yardmatchJobCount === 1 ? "" : "s"
        }, crew gap ${focusWindow.crewGap}, and ${focusWindow.blockedMinutes} blocked minutes.`;
    const recommendationTail = suggestedWindow
      ? ` Move ${recommendedCandidate.customerName}'s ${this.providerAssistantWindowLabel(
          getBookingServiceWindow(recommendedCandidate.scheduledStartIso).key
        ).toLowerCase()} appointment into ${suggestedWindow.label.toLowerCase()} first.`
      : crossDayReliefSlot
        ? ` Move ${recommendedCandidate.customerName}'s ${this.providerAssistantWindowLabel(
            getBookingServiceWindow(recommendedCandidate.scheduledStartIso).key
          ).toLowerCase()} appointment to ${this.formatBookingWindowWithDate(crossDayReliefSlot.startIso).toLowerCase()} first.`
      : ` Review ${recommendedCandidate.customerName}'s ${this.providerAssistantWindowLabel(
          getBookingServiceWindow(recommendedCandidate.scheduledStartIso).key
        ).toLowerCase()} appointment first if you need to free space in that window.`;

    return {
      command: originalCommand,
      understood: true,
      actionType: "recommend-dispatch-adjustment",
      actionTypes: ["recommend-dispatch-adjustment"],
      requiresBookingSelection: false,
      requiresConfirmation: false,
      executed: false,
      notifyCustomer: false,
      matchedBookingId: recommendedCandidate.id,
      matchedCustomerName: recommendedCandidate.customerName,
      sourceWindowKey: focusWindow.windowKey,
      targetWindowKey: suggestedWindow?.windowKey ?? (crossDayReliefSlot ? getBookingServiceWindow(crossDayReliefSlot.startIso).key : undefined),
      targetWindowLabel,
      suggestedStartIso: suggestedTimes?.startIso,
      suggestedEndIso: suggestedTimes?.endIso,
      dispatchDaySummary: targetDay,
      dispatchWindowSummary: focusWindow,
      previewLabel: `${scopeLabel} booking to move`,
      previewMessage: `${recommendationContext}${recommendationTail}`,
      bookingCandidates: orderedCandidates
    };
  }

  private async runProviderAssistantStaffingAdjustment(
    providerId: string,
    action: ParsedProviderAssistantAction,
    originalCommand: string
  ): Promise<ProviderAssistantCommandResponse> {
    const window = this.buildProviderAssistantDispatchWindow(action.dispatchScope ?? "today");
    const overview = await this.getProviderCalendarOverview(providerId, window);
    const staffing = await this.getProviderStaffingOverview(providerId);
    const scopeLabel = this.providerAssistantDispatchScopeLabel(action.dispatchScope ?? "today");
    const targetDay =
      action.dispatchScope === "next-7-days"
        ? this.selectProviderAssistantWeekAttentionDay(overview)
        : overview.dispatchDays.find((day) =>
            this.doIntervalsOverlap(
              day.dateIso,
              new Date(new Date(day.dateIso).getTime() + 24 * 60 * 60 * 1000).toISOString(),
              window.fromIso,
              window.toIso
            )
          ) ?? overview.dispatchDays[0];

    if (!targetDay) {
      return {
        command: originalCommand,
        understood: true,
        actionType: "recommend-staffing-adjustment",
        actionTypes: ["recommend-staffing-adjustment"],
        requiresBookingSelection: false,
        requiresConfirmation: false,
        executed: false,
        notifyCustomer: false,
        previewLabel: `${scopeLabel} looks covered`,
        previewMessage: `There are no active YardMatch jobs on ${scopeLabel.toLowerCase()}, so no extra crew recommendation is needed.`,
        bookingCandidates: []
      };
    }

    const dayStartIso = targetDay.dateIso;
    const dayEndIso = new Date(new Date(targetDay.dateIso).getTime() + 24 * 60 * 60 * 1000).toISOString();
    const jobsNeedingCrew = this.getProviderAssistantStaffingJobsNeedingCrew(staffing, dayStartIso, dayEndIso);

    if (jobsNeedingCrew.length === 0) {
      return {
        command: originalCommand,
        understood: true,
        actionType: "recommend-staffing-adjustment",
        actionTypes: ["recommend-staffing-adjustment"],
        requiresBookingSelection: false,
        requiresConfirmation: false,
        executed: false,
        notifyCustomer: false,
        dispatchDaySummary: targetDay,
        previewLabel: `${scopeLabel} does not need more crew`,
        previewMessage: `${targetDay.dayLabel} has no open crew gap right now. If the route still feels tight, a move recommendation is probably more useful than adding people.`,
        bookingCandidates: []
      };
    }

    const recommendedJob = jobsNeedingCrew[0]!;
    const bookingCandidates = jobsNeedingCrew.map((job) => this.toProviderAssistantBookingCandidateFromStaffingJob(job));
    const staffingPlan = this.buildProviderAssistantStaffingPlan(jobsNeedingCrew);
    const staffingPlanPreview = this.buildProviderAssistantStaffingPlanPreview(staffingPlan);
    const matchedBookingId = bookingCandidates[0]?.bookingId;
    const pendingMatchCount = this.getProviderAssistantPendingMatchCount(recommendedJob);
    const uncoveredCrewGap = this.getProviderAssistantUncoveredCrewGap(recommendedJob);
    const recommendedRouteLeader = this.selectProviderAssistantRouteLeaderCandidate(recommendedJob);
    const recommendationLead =
      recommendedJob.crewGap <= 0 && recommendedJob.requiresRouteLeaderAssignment
        ? `Assign ${
            recommendedRouteLeader?.crewMemberName ?? "a route leader"
          } as route leader for ${recommendedJob.customerName}'s ${this.providerAssistantWindowLabel(
            getBookingServiceWindow(recommendedJob.scheduledStartIso).key
          ).toLowerCase()} ${this.titleCaseCategory(recommendedJob.category).toLowerCase()} booking first.`
        : pendingMatchCount >= recommendedJob.crewGap
        ? `Review pending crew matches for ${recommendedJob.customerName}'s ${this.providerAssistantWindowLabel(
            getBookingServiceWindow(recommendedJob.scheduledStartIso).key
          ).toLowerCase()} ${this.titleCaseCategory(recommendedJob.category).toLowerCase()} booking first.`
        : pendingMatchCount > 0
          ? `Review the pending matches for ${recommendedJob.customerName}'s ${this.providerAssistantWindowLabel(
              getBookingServiceWindow(recommendedJob.scheduledStartIso).key
            ).toLowerCase()} ${this.titleCaseCategory(recommendedJob.category).toLowerCase()} booking, then source more crew if needed.`
          : `Source more crew for ${recommendedJob.customerName}'s ${this.providerAssistantWindowLabel(
              getBookingServiceWindow(recommendedJob.scheduledStartIso).key
            ).toLowerCase()} ${this.titleCaseCategory(recommendedJob.category).toLowerCase()} booking first.`;
    const recommendationDetail =
      recommendedJob.crewGap <= 0 && recommendedJob.requiresRouteLeaderAssignment
        ? `Crew coverage is already full with ${recommendedJob.assignedCrewMembers} accepted crew member${
            recommendedJob.assignedCrewMembers === 1 ? "" : "s"
          }, but accepted-crew fallback mode still needs one field owner before the route starts.`
        : pendingMatchCount >= recommendedJob.crewGap
        ? `It still shows a crew gap of ${recommendedJob.crewGap}, but ${pendingMatchCount} pending match${
            pendingMatchCount === 1 ? "" : "es"
          } already exist and could close that gap without sourcing new people.`
        : pendingMatchCount > 0
          ? `It still shows a crew gap of ${recommendedJob.crewGap}, with ${pendingMatchCount} pending match${
              pendingMatchCount === 1 ? "" : "es"
            } already in review. Even after those, about ${uncoveredCrewGap} more crew member${
              uncoveredCrewGap === 1 ? "" : "s"
            } may still need coverage.`
          : `It still shows a crew gap of ${recommendedJob.crewGap} and has no pending matches in review, so the shortage is not likely to close on its own.`;

    return {
      command: originalCommand,
      understood: true,
      actionType: "recommend-staffing-adjustment",
      actionTypes: ["recommend-staffing-adjustment"],
      requiresBookingSelection: false,
      requiresConfirmation: false,
      executed: false,
      notifyCustomer: false,
      matchedBookingId,
      matchedCustomerName: recommendedJob.customerName,
      sourceWindowKey: getBookingServiceWindow(recommendedJob.scheduledStartIso).key,
      dispatchDaySummary: targetDay,
      previewLabel: `${scopeLabel} crew gap recommendation`,
      previewMessage: `${recommendationLead} ${recommendationDetail} ${targetDay.dayLabel} carries ${
        targetDay.crewGap
      } total open crew slot${targetDay.crewGap === 1 ? "" : "s"} right now.${staffingPlanPreview}`,
      bookingCandidates,
      staffingPlan
    };
  }

  private async runProviderAssistantSingleAction(
    providerId: string,
    booking: Booking & { customerName: string },
    action: ParsedProviderAssistantAction,
    execute: boolean,
    originalCommand: string,
    projectedMatches?: CrewMatchCandidate[]
  ): Promise<ProviderAssistantCommandResponse> {
    const sourceWindowKey = action.sourceWindowKey ?? getBookingServiceWindow(booking.scheduledStartIso).key;

    if (
      action.actionType === "accept-best-crew-match" ||
      action.actionType === "accept-crew-match" ||
      action.actionType === "deny-crew-match"
    ) {
      const bookingMatches = (projectedMatches ?? (await this.listProviderAssistantBookingMatches(providerId, booking.id))).filter(
        (match) =>
          match.bookingId === booking.id &&
          (match.status === "pending-provider-review" || match.status === "accepted")
      );

      if (bookingMatches.length === 0) {
        return {
          command: originalCommand,
          understood: true,
          actionType: action.actionType,
          actionTypes: [action.actionType],
          requiresBookingSelection: false,
          requiresConfirmation: false,
          executed: false,
          notifyCustomer: false,
          matchedBookingId: booking.id,
          matchedCustomerName: booking.customerName,
          sourceWindowKey,
          previewLabel: "No crew matches to review",
          previewMessage: "This booking does not currently have any pending crew matches to accept or decline.",
          bookingCandidates: [this.toProviderAssistantBookingCandidate(booking)]
        };
      }

      const crewMatch =
        action.actionType === "accept-best-crew-match"
          ? bookingMatches.find((match) => match.status === "pending-provider-review")
          : await this.resolveProviderAssistantCrewMatch(action.crewMatchCrewNameQuery, bookingMatches);
      if (!crewMatch) {
        return {
          command: originalCommand,
          understood: true,
          actionType: action.actionType,
          actionTypes: [action.actionType],
          requiresBookingSelection: false,
          requiresConfirmation: false,
          executed: false,
          notifyCustomer: false,
          matchedBookingId: booking.id,
          matchedCustomerName: booking.customerName,
          sourceWindowKey,
          previewLabel:
            action.actionType === "accept-best-crew-match"
              ? "No recommended crew left"
              : "Crew match not found",
          previewMessage:
            action.actionType === "accept-best-crew-match"
              ? "This booking does not currently have a pending crew recommendation to accept."
              : "The assistant could not match that crew name to a pending or accepted staffing match on this job.",
          bookingCandidates: [this.toProviderAssistantBookingCandidate(booking)]
        };
      }

      if (crewMatch.status === "accepted") {
        return {
          command: originalCommand,
          understood: true,
          actionType: action.actionType,
          actionTypes: [action.actionType],
          requiresBookingSelection: false,
          requiresConfirmation: false,
          executed: false,
          notifyCustomer: false,
          matchedBookingId: booking.id,
          matchedCustomerName: booking.customerName,
          sourceWindowKey,
          previewLabel:
            action.actionType === "accept-best-crew-match"
              ? "Best crew already accepted"
              : "Crew already accepted",
          previewMessage:
            action.actionType === "accept-best-crew-match"
              ? `${crewMatch.crewMemberName} is already the best accepted crew on this job.`
              : `${crewMatch.crewMemberName} is already accepted on this job.`,
          bookingCandidates: [this.toProviderAssistantBookingCandidate(booking)]
        };
      }

      const reviewAction =
        action.actionType === "deny-crew-match" ? "deny" : "accept";
      const reviewVerb = reviewAction === "accept" ? "Accept" : "Decline";
      const pastTense = reviewAction === "accept" ? "accepted" : "declined";
      const recommendationReasons = crewMatch.recommendationReasons?.length
        ? ` Best fit notes: ${crewMatch.recommendationReasons.join(", ")}.`
        : "";

      if (!execute) {
        return {
          command: originalCommand,
          understood: true,
          actionType: action.actionType,
          actionTypes: [action.actionType],
          requiresBookingSelection: false,
          requiresConfirmation: true,
          executed: false,
          notifyCustomer: false,
          matchedBookingId: booking.id,
          matchedCustomerName: booking.customerName,
          sourceWindowKey,
          previewLabel:
            action.actionType === "accept-best-crew-match"
              ? "Ready to accept best crew"
              : reviewAction === "accept"
                ? "Ready to accept crew"
                : "Ready to decline crew",
          previewMessage:
            action.actionType === "accept-best-crew-match"
              ? `Accept ${crewMatch.crewMemberName} as the best crew for this job.${recommendationReasons} They will be accepted through the normal staffing review flow.`
              : `${reviewVerb} ${crewMatch.crewMemberName} for this job. They will be ${pastTense} through the normal staffing review flow.${recommendationReasons}`,
          bookingCandidates: [this.toProviderAssistantBookingCandidate(booking)]
        };
      }

      await this.reviewCrewMatch(providerId, {
        crewMatchId: crewMatch.id,
        action: reviewAction
      });

      const now = new Date().toISOString();
      const intervention: BookingInterventionRecord = {
        id: crypto.randomUUID(),
        action:
          action.actionType === "accept-best-crew-match"
            ? "provider-assistant-accept-best-crew-match"
            : reviewAction === "accept"
              ? "provider-assistant-accept-crew-match"
            : "provider-assistant-deny-crew-match",
        createdAt: now,
        actorRole: "provider-assistant",
        actorUserId: providerId,
        note: `Provider assistant command: ${originalCommand}`,
        previousStatus: booking.status,
        nextStatus: booking.status
      };
      const bookingWithIntervention = await this.repository.updateBooking(booking.id, {
        interventions: [...booking.interventions, intervention]
      });

      return {
        command: originalCommand,
        understood: true,
        actionType: action.actionType,
        actionTypes: [action.actionType],
        requiresBookingSelection: false,
        requiresConfirmation: false,
        executed: true,
        notifyCustomer: false,
        matchedBookingId: booking.id,
        matchedCustomerName: booking.customerName,
        sourceWindowKey,
        previewLabel:
          action.actionType === "accept-best-crew-match"
            ? "Best crew accepted"
            : reviewAction === "accept"
              ? "Crew accepted"
              : "Crew declined",
        previewMessage:
          action.actionType === "accept-best-crew-match"
            ? `Accepted ${crewMatch.crewMemberName} as the best crew through the staffing review flow.`
            : `${this.toTitleCase(pastTense)} ${crewMatch.crewMemberName} through the staffing review flow.`,
        bookingCandidates: [this.toProviderAssistantBookingCandidate(bookingWithIntervention ?? booking)],
        updatedBooking: bookingWithIntervention ?? booking
      };
    }

    if (action.actionType === "set-route-stop" || action.actionType === "clear-route-stop") {
      const provider = await this.repository.findProviderById(providerId);
      if (!provider) {
        throw new HttpError(404, "Provider not found for this assistant command");
      }

      const activeRouteStop = booking.routeActiveStop && !booking.routeActiveStop.reachedAt ? booking.routeActiveStop : undefined;
      if (action.actionType === "clear-route-stop") {
        if (!activeRouteStop) {
          return {
            command: originalCommand,
            understood: true,
            actionType: "clear-route-stop",
            actionTypes: ["clear-route-stop"],
            requiresBookingSelection: false,
            requiresConfirmation: false,
            executed: false,
            notifyCustomer: false,
            matchedBookingId: booking.id,
            matchedCustomerName: booking.customerName,
            sourceWindowKey,
            previewLabel: "No route stop set",
            previewMessage: "This booking does not currently have a provider-only interim route stop.",
            bookingCandidates: [this.toProviderAssistantBookingCandidate(booking)]
          };
        }

        if (!execute) {
          return {
            command: originalCommand,
            understood: true,
            actionType: "clear-route-stop",
            actionTypes: ["clear-route-stop"],
            requiresBookingSelection: false,
            requiresConfirmation: true,
            executed: false,
            notifyCustomer: false,
            matchedBookingId: booking.id,
            matchedCustomerName: booking.customerName,
            sourceWindowKey,
            previewLabel: "Ready to clear route stop",
            previewMessage: `Clear ${activeRouteStop.label} so tracking heads straight to the property again.`,
            bookingCandidates: [this.toProviderAssistantBookingCandidate(booking)]
          };
        }

        const clearedBooking = await this.clearBookingRouteStop(providerId, { bookingId: booking.id });
        const now = new Date().toISOString();
        const intervention: BookingInterventionRecord = {
          id: crypto.randomUUID(),
          action: "provider-assistant-clear-route-stop",
          createdAt: now,
          actorRole: "provider-assistant",
          actorUserId: providerId,
          note: `Provider assistant command: ${originalCommand}`
        };
        const bookingWithIntervention = await this.repository.updateBooking(booking.id, {
          interventions: [...clearedBooking.interventions, intervention]
        });

        return {
          command: originalCommand,
          understood: true,
          actionType: "clear-route-stop",
          actionTypes: ["clear-route-stop"],
          requiresBookingSelection: false,
          requiresConfirmation: false,
          executed: true,
          notifyCustomer: false,
          matchedBookingId: booking.id,
          matchedCustomerName: booking.customerName,
          sourceWindowKey,
          previewLabel: "Route stop cleared",
          previewMessage: `Cleared ${activeRouteStop.label}. Tracking will now point straight to the property.`,
          bookingCandidates: [this.toProviderAssistantBookingCandidate(bookingWithIntervention ?? clearedBooking)],
          updatedBooking: bookingWithIntervention ?? clearedBooking
        };
      }

      const routeStopKind = action.routeStopKind ?? "equipment-pickup";
      const defaultLabel = routeStopKind === "staging" ? "Staging stop" : "Equipment pickup";
      if (
        activeRouteStop &&
        activeRouteStop.kind === routeStopKind &&
        activeRouteStop.address.line1 === provider.address.line1
      ) {
        return {
          command: originalCommand,
          understood: true,
          actionType: "set-route-stop",
          actionTypes: ["set-route-stop"],
          requiresBookingSelection: false,
          requiresConfirmation: false,
          executed: false,
          notifyCustomer: false,
          matchedBookingId: booking.id,
          matchedCustomerName: booking.customerName,
          sourceWindowKey,
          previewLabel: "Route stop already set",
          previewMessage: `${activeRouteStop.label} is already set as the next provider-only route stop for this booking.`,
          bookingCandidates: [this.toProviderAssistantBookingCandidate(booking)]
        };
      }

      if (!execute) {
        return {
          command: originalCommand,
          understood: true,
          actionType: "set-route-stop",
          actionTypes: ["set-route-stop"],
          requiresBookingSelection: false,
          requiresConfirmation: true,
          executed: false,
          notifyCustomer: false,
          matchedBookingId: booking.id,
          matchedCustomerName: booking.customerName,
          sourceWindowKey,
          previewLabel: "Ready to add route stop",
          previewMessage: `Add ${defaultLabel.toLowerCase()} at your business address before heading to the property. Customers will still only see your business route, while provider tracking keeps the extra stop visible internally.`,
          bookingCandidates: [this.toProviderAssistantBookingCandidate(booking)]
        };
      }

      const stopBooking = await this.setBookingRouteStop(providerId, {
        bookingId: booking.id,
        kind: routeStopKind,
        label: defaultLabel,
        address: provider.address
      });
      const now = new Date().toISOString();
      const intervention: BookingInterventionRecord = {
        id: crypto.randomUUID(),
        action: "provider-assistant-set-route-stop",
        createdAt: now,
        actorRole: "provider-assistant",
        actorUserId: providerId,
        note: `Provider assistant command: ${originalCommand}`
      };
      const bookingWithIntervention = await this.repository.updateBooking(booking.id, {
        interventions: [...stopBooking.interventions, intervention]
      });

      return {
        command: originalCommand,
        understood: true,
        actionType: "set-route-stop",
        actionTypes: ["set-route-stop"],
        requiresBookingSelection: false,
        requiresConfirmation: false,
        executed: true,
        notifyCustomer: false,
        matchedBookingId: booking.id,
        matchedCustomerName: booking.customerName,
        sourceWindowKey,
        previewLabel: "Route stop added",
        previewMessage: `${defaultLabel} is now the next provider-only route stop before the property.`,
        bookingCandidates: [this.toProviderAssistantBookingCandidate(bookingWithIntervention ?? stopBooking)],
        updatedBooking: bookingWithIntervention ?? stopBooking
      };
    }

    if (action.actionType === "message-crew") {
      const bookingMatches = (projectedMatches ?? (await this.repository.listCrewMatches())).filter(
        (match) =>
          match.bookingId === booking.id &&
          (match.status === "accepted" || match.status === "pending-provider-review")
      );

      if (bookingMatches.length === 0) {
        return {
          command: originalCommand,
          understood: true,
          actionType: "message-crew",
          actionTypes: ["message-crew"],
          requiresBookingSelection: false,
          requiresConfirmation: false,
          executed: false,
          notifyCustomer: false,
          matchedBookingId: booking.id,
          matchedCustomerName: booking.customerName,
          sourceWindowKey,
          previewLabel: "No crew available to message",
          previewMessage:
            "Add or accept at least one crew member on this job before sending a crew message from the provider assistant.",
          bookingCandidates: [this.toProviderAssistantBookingCandidate(booking)]
        };
      }

      const crewMatches = await this.resolveProviderAssistantCrewMessageTargets(booking, action, bookingMatches);
      if (crewMatches.length === 0 || !action.crewMessageBody) {
        const failure = this.getProviderAssistantCrewMessageTargetFailure(action);
        return {
          command: originalCommand,
          understood: true,
          actionType: "message-crew",
          actionTypes: ["message-crew"],
          requiresBookingSelection: false,
          requiresConfirmation: false,
          executed: false,
          notifyCustomer: false,
          matchedBookingId: booking.id,
          matchedCustomerName: booking.customerName,
          sourceWindowKey,
          previewLabel: failure.previewLabel,
          previewMessage: failure.previewMessage,
          bookingCandidates: [this.toProviderAssistantBookingCandidate(booking)]
        };
      }

      const crewMessageTargetLabel = this.formatProviderAssistantCrewMessageTarget(action, crewMatches);
      if (!execute) {
        return {
          command: originalCommand,
          understood: true,
          actionType: "message-crew",
          actionTypes: ["message-crew"],
          requiresBookingSelection: false,
          requiresConfirmation: true,
          executed: false,
          notifyCustomer: false,
          matchedBookingId: booking.id,
          matchedCustomerName: booking.customerName,
          sourceWindowKey,
          previewLabel: "Ready to message crew",
          previewMessage: `Send ${crewMessageTargetLabel}: "${action.crewMessageBody}"`,
          bookingCandidates: [this.toProviderAssistantBookingCandidate(booking)]
        };
      }

      const providerIdentity = await this.repository.findAuthIdentityByUserId(providerId);
      if (!providerIdentity || providerIdentity.role !== "provider") {
        throw new HttpError(404, "Provider identity not found for this assistant command");
      }

      const updatedCrewConversations = await Promise.all(
        crewMatches.map((crewMatch) =>
          this.sendProviderCrewMessage(providerIdentity, {
            crewMatchId: crewMatch.id,
            body: action.crewMessageBody!
          })
        )
      );

      const now = new Date().toISOString();
      const intervention: BookingInterventionRecord = {
        id: crypto.randomUUID(),
        action: "provider-assistant-message-crew",
        createdAt: now,
        actorRole: "provider-assistant",
        actorUserId: providerId,
        note: `Provider assistant command: ${originalCommand}`,
        previousStatus: booking.status,
        nextStatus: booking.status
      };
      const bookingWithIntervention = await this.repository.updateBooking(booking.id, {
        interventions: [...booking.interventions, intervention]
      });

      return {
        command: originalCommand,
        understood: true,
        actionType: "message-crew",
        actionTypes: ["message-crew"],
        requiresBookingSelection: false,
        requiresConfirmation: false,
        executed: true,
        notifyCustomer: false,
        matchedBookingId: booking.id,
        matchedCustomerName: booking.customerName,
        sourceWindowKey,
        previewLabel: "Crew message sent",
        previewMessage: `Sent ${crewMessageTargetLabel}: "${action.crewMessageBody}"`,
        bookingCandidates: [this.toProviderAssistantBookingCandidate(bookingWithIntervention ?? booking)],
        updatedCrewConversation:
          updatedCrewConversations.length === 1 ? updatedCrewConversations[0] : undefined,
        updatedCrewConversations,
        updatedBooking: bookingWithIntervention ?? booking
      };
    }

    if (action.actionType === "assign-route-leader" || action.actionType === "clear-route-leader") {
      const provider = await this.repository.findProviderById(providerId);
      if (!provider) {
        throw new HttpError(404, "Provider not found for this assistant command");
      }

      if (provider.routeLeaderMode !== "accepted-crew-fallback") {
        return {
          command: originalCommand,
          understood: true,
          actionType: action.actionType,
          actionTypes: [action.actionType],
          requiresBookingSelection: false,
          requiresConfirmation: false,
          executed: false,
          notifyCustomer: false,
          matchedBookingId: booking.id,
          sourceWindowKey,
          previewLabel: "Crew route fallback is off",
          previewMessage: "Turn on accepted-crew fallback before using the provider assistant to delegate route leadership.",
          bookingCandidates: [this.toProviderAssistantBookingCandidate(booking)]
        };
      }

      if (booking.onRouteConfirmedAt) {
        return {
          command: originalCommand,
          understood: true,
          actionType: action.actionType,
          actionTypes: [action.actionType],
          requiresBookingSelection: false,
          requiresConfirmation: false,
          executed: false,
          notifyCustomer: false,
          matchedBookingId: booking.id,
          sourceWindowKey,
          previewLabel: "Route already started",
          previewMessage: "Route leadership is locked once the route is already live.",
          bookingCandidates: [this.toProviderAssistantBookingCandidate(booking)]
        };
      }

      const acceptedMatches = (projectedMatches ?? (await this.repository.listCrewMatches())).filter(
        (match) => match.bookingId === booking.id && match.status === "accepted"
      );

      if (acceptedMatches.length === 0) {
        return {
          command: originalCommand,
          understood: true,
          actionType: action.actionType,
          actionTypes: [action.actionType],
          requiresBookingSelection: false,
          requiresConfirmation: false,
          executed: false,
          notifyCustomer: false,
          matchedBookingId: booking.id,
          sourceWindowKey,
          previewLabel: "No accepted crew yet",
          previewMessage: "Accept at least one crew member on this job before delegating route leadership.",
          bookingCandidates: [this.toProviderAssistantBookingCandidate(booking)]
        };
      }

      if (action.actionType === "clear-route-leader") {
        if (!booking.assignedRouteLeaderCrewMemberId) {
          return {
            command: originalCommand,
            understood: true,
            actionType: "clear-route-leader",
            actionTypes: ["clear-route-leader"],
            requiresBookingSelection: false,
            requiresConfirmation: false,
            executed: false,
            notifyCustomer: false,
            matchedBookingId: booking.id,
            sourceWindowKey,
            previewLabel: "No explicit route leader set",
            previewMessage: "This job does not currently have an explicit crew route-leader assignment to clear.",
            bookingCandidates: [this.toProviderAssistantBookingCandidate(booking)]
          };
        }

        const currentLeader = await this.repository.findCrewMemberById(booking.assignedRouteLeaderCrewMemberId);
        if (!execute) {
          return {
            command: originalCommand,
            understood: true,
            actionType: "clear-route-leader",
            actionTypes: ["clear-route-leader"],
            requiresBookingSelection: false,
            requiresConfirmation: true,
            executed: false,
            notifyCustomer: false,
            matchedBookingId: booking.id,
            sourceWindowKey,
            previewLabel: "Ready to clear route leader",
            previewMessage: `Clear ${currentLeader?.fullName ?? "the crew lead"} as the explicit route leader for this job.`,
            bookingCandidates: [this.toProviderAssistantBookingCandidate(booking)]
          };
        }

        const clearedBooking = await this.assignBookingRouteLeader(providerId, {
          bookingId: booking.id
        });
        const now = new Date().toISOString();
        const intervention: BookingInterventionRecord = {
          id: crypto.randomUUID(),
          action: "provider-assistant-clear-route-leader",
          createdAt: now,
          actorRole: "provider-assistant",
          actorUserId: providerId,
          note: `Provider assistant command: ${originalCommand}`,
          previousStatus: booking.status,
          nextStatus: clearedBooking.status
        };
        const bookingWithIntervention = await this.repository.updateBooking(booking.id, {
          interventions: [...clearedBooking.interventions, intervention]
        });

        return {
          command: originalCommand,
          understood: true,
          actionType: "clear-route-leader",
          actionTypes: ["clear-route-leader"],
          requiresBookingSelection: false,
          requiresConfirmation: false,
          executed: true,
          notifyCustomer: false,
          matchedBookingId: booking.id,
          sourceWindowKey,
          previewLabel: "Route leader cleared",
          previewMessage: `Cleared the explicit route-leader assignment for this job.`,
          bookingCandidates: [this.toProviderAssistantBookingCandidate(bookingWithIntervention ?? clearedBooking)],
          updatedBooking: bookingWithIntervention ?? clearedBooking
        };
      }

      const routeLeaderMatch = await this.resolveProviderAssistantCrewMatch(
        action.routeLeaderCrewNameQuery,
        acceptedMatches
      );
      if (!routeLeaderMatch) {
        return {
          command: originalCommand,
          understood: true,
          actionType: "assign-route-leader",
          actionTypes: ["assign-route-leader"],
          requiresBookingSelection: false,
          requiresConfirmation: false,
          executed: false,
          notifyCustomer: false,
          matchedBookingId: booking.id,
          sourceWindowKey,
          previewLabel: "Accepted crew member not found",
          previewMessage: "The assistant could not match that crew name to an accepted crew member on this job.",
          bookingCandidates: [this.toProviderAssistantBookingCandidate(booking)]
        };
      }

      if (booking.assignedRouteLeaderCrewMemberId === routeLeaderMatch.crewMemberId) {
        return {
          command: originalCommand,
          understood: true,
          actionType: "assign-route-leader",
          actionTypes: ["assign-route-leader"],
          requiresBookingSelection: false,
          requiresConfirmation: false,
          executed: false,
          notifyCustomer: false,
          matchedBookingId: booking.id,
          sourceWindowKey,
          previewLabel: "Route leader already assigned",
          previewMessage: `${routeLeaderMatch.crewMemberName} is already the explicit route leader for this job.`,
          bookingCandidates: [this.toProviderAssistantBookingCandidate(booking)]
        };
      }

      if (!execute) {
        return {
          command: originalCommand,
          understood: true,
          actionType: "assign-route-leader",
          actionTypes: ["assign-route-leader"],
          requiresBookingSelection: false,
          requiresConfirmation: true,
          executed: false,
          notifyCustomer: false,
          matchedBookingId: booking.id,
          sourceWindowKey,
          previewLabel: "Ready to assign route leader",
          previewMessage: `Assign ${routeLeaderMatch.crewMemberName} as the route leader for this job.`,
          bookingCandidates: [this.toProviderAssistantBookingCandidate(booking)]
        };
      }

      const assignedBooking = await this.assignBookingRouteLeader(providerId, {
        bookingId: booking.id,
        crewMemberId: routeLeaderMatch.crewMemberId
      });
      const now = new Date().toISOString();
      const intervention: BookingInterventionRecord = {
        id: crypto.randomUUID(),
        action: "provider-assistant-assign-route-leader",
        createdAt: now,
        actorRole: "provider-assistant",
        actorUserId: providerId,
        note: `Provider assistant command: ${originalCommand}`,
        previousStatus: booking.status,
        nextStatus: assignedBooking.status
      };
      const bookingWithIntervention = await this.repository.updateBooking(booking.id, {
        interventions: [...assignedBooking.interventions, intervention]
      });

      return {
        command: originalCommand,
        understood: true,
        actionType: "assign-route-leader",
        actionTypes: ["assign-route-leader"],
        requiresBookingSelection: false,
        requiresConfirmation: false,
        executed: true,
        notifyCustomer: false,
        matchedBookingId: booking.id,
        sourceWindowKey,
        previewLabel: "Route leader assigned",
        previewMessage: `Assigned ${routeLeaderMatch.crewMemberName} as the route leader for this job.`,
        bookingCandidates: [this.toProviderAssistantBookingCandidate(bookingWithIntervention ?? assignedBooking)],
        updatedBooking: bookingWithIntervention ?? assignedBooking
      };
    }

    if (action.actionType === "confirm-booking") {
      const customer = await this.repository.findCustomerById(booking.customerId);
      if (booking.status === "confirmed" || booking.status === "in-progress" || booking.status === "completed") {
        return {
          command: originalCommand,
          understood: true,
          actionType: "confirm-booking",
          actionTypes: ["confirm-booking"],
          requiresBookingSelection: false,
          requiresConfirmation: false,
          executed: false,
          notifyCustomer: true,
          matchedBookingId: booking.id,
          matchedCustomerName: customer?.fullName,
          sourceWindowKey,
          previewLabel: "Booking already confirmed",
          previewMessage: `${customer?.fullName ?? "This customer"} is already confirmed and ready for the next lifecycle step.`,
          bookingCandidates: [this.toProviderAssistantBookingCandidate(booking)]
        };
      }

      if (booking.status !== "requested") {
        return {
          command: originalCommand,
          understood: true,
          actionType: "confirm-booking",
          actionTypes: ["confirm-booking"],
          requiresBookingSelection: false,
          requiresConfirmation: false,
          executed: false,
          notifyCustomer: true,
          matchedBookingId: booking.id,
          matchedCustomerName: customer?.fullName,
          sourceWindowKey,
          previewLabel: "Booking cannot be confirmed",
          previewMessage: "Only requested bookings can be confirmed from the provider assistant.",
          bookingCandidates: [this.toProviderAssistantBookingCandidate(booking)]
        };
      }

      const customerNotificationPreview = `${
        customer?.fullName ?? "The customer"
      } will be told that their requested service window is confirmed.`;

      if (!execute) {
        return {
          command: originalCommand,
          understood: true,
          actionType: "confirm-booking",
          actionTypes: ["confirm-booking"],
          requiresBookingSelection: false,
          requiresConfirmation: true,
          executed: false,
          notifyCustomer: true,
          matchedBookingId: booking.id,
          matchedCustomerName: customer?.fullName,
          sourceWindowKey,
          previewLabel: "Ready to confirm booking",
          previewMessage: `Confirm ${customer?.fullName ?? "this customer"} for ${this.formatBookingWindowWithDate(
            booking.scheduledStartIso
          )}.`,
          customerNotificationPreview,
          bookingCandidates: [this.toProviderAssistantBookingCandidate(booking)]
        };
      }

      const confirmedBooking = await this.confirmBooking(providerId, { bookingId: booking.id });
      const now = new Date().toISOString();
      const intervention: BookingInterventionRecord = {
        id: crypto.randomUUID(),
        action: "provider-assistant-confirm-booking",
        createdAt: now,
        actorRole: "provider-assistant",
        actorUserId: providerId,
        note: `Provider assistant command: ${originalCommand}`,
        previousStatus: booking.status,
        nextStatus: confirmedBooking.status
      };
      const bookingWithIntervention = await this.repository.updateBooking(booking.id, {
        interventions: [...confirmedBooking.interventions, intervention]
      });

      return {
        command: originalCommand,
        understood: true,
        actionType: "confirm-booking",
        actionTypes: ["confirm-booking"],
        requiresBookingSelection: false,
        requiresConfirmation: false,
        executed: true,
        notifyCustomer: true,
        matchedBookingId: booking.id,
        matchedCustomerName: customer?.fullName,
        sourceWindowKey,
        previewLabel: "Booking confirmed",
        previewMessage: `Confirmed ${customer?.fullName ?? "the customer"} for ${this.formatBookingWindowWithDate(
          booking.scheduledStartIso
        )}.`,
        customerNotificationPreview,
        bookingCandidates: [this.toProviderAssistantBookingCandidate(bookingWithIntervention ?? confirmedBooking)],
        updatedBooking: bookingWithIntervention ?? confirmedBooking
      };
    }

    if (action.actionType === "complete-booking") {
      const customer = await this.repository.findCustomerById(booking.customerId);
      if (booking.status === "completed") {
        return {
          command: originalCommand,
          understood: true,
          actionType: "complete-booking",
          actionTypes: ["complete-booking"],
          requiresBookingSelection: false,
          requiresConfirmation: false,
          executed: false,
          notifyCustomer: true,
          matchedBookingId: booking.id,
          matchedCustomerName: customer?.fullName,
          sourceWindowKey,
          previewLabel: "Booking already completed",
          previewMessage: `${customer?.fullName ?? "This customer"} is already marked complete.`,
          bookingCandidates: [this.toProviderAssistantBookingCandidate(booking)]
        };
      }

      if (booking.status !== "confirmed" && booking.status !== "in-progress") {
        return {
          command: originalCommand,
          understood: true,
          actionType: "complete-booking",
          actionTypes: ["complete-booking"],
          requiresBookingSelection: false,
          requiresConfirmation: false,
          executed: false,
          notifyCustomer: true,
          matchedBookingId: booking.id,
          matchedCustomerName: customer?.fullName,
          sourceWindowKey,
          previewLabel: "Booking cannot be completed",
          previewMessage: "Only confirmed or in-progress bookings can be completed from the provider assistant.",
          bookingCandidates: [this.toProviderAssistantBookingCandidate(booking)]
        };
      }

      if (this.countBookingEvidence(booking, "after") < 1) {
        return {
          command: originalCommand,
          understood: true,
          actionType: "complete-booking",
          actionTypes: ["complete-booking"],
          requiresBookingSelection: false,
          requiresConfirmation: false,
          executed: false,
          notifyCustomer: true,
          matchedBookingId: booking.id,
          matchedCustomerName: customer?.fullName,
          sourceWindowKey,
          previewLabel: "After photo still needed",
          previewMessage: "Capture at least one after photo before completing the booking from the provider assistant.",
          bookingCandidates: [this.toProviderAssistantBookingCandidate(booking)]
        };
      }

      const customerNotificationPreview = `${
        customer?.fullName ?? "The customer"
      } will be told the service is complete and the review follow-up timer will begin.`;

      if (!execute) {
        return {
          command: originalCommand,
          understood: true,
          actionType: "complete-booking",
          actionTypes: ["complete-booking"],
          requiresBookingSelection: false,
          requiresConfirmation: true,
          executed: false,
          notifyCustomer: true,
          matchedBookingId: booking.id,
          matchedCustomerName: customer?.fullName,
          sourceWindowKey,
          previewLabel: "Ready to complete booking",
          previewMessage: `Complete ${customer?.fullName ?? "this customer"} and close out the service lifecycle.`,
          customerNotificationPreview,
          bookingCandidates: [this.toProviderAssistantBookingCandidate(booking)]
        };
      }

      const completedBooking = await this.completeBooking(providerId, { bookingId: booking.id });
      const now = new Date().toISOString();
      const intervention: BookingInterventionRecord = {
        id: crypto.randomUUID(),
        action: "provider-assistant-complete-booking",
        createdAt: now,
        actorRole: "provider-assistant",
        actorUserId: providerId,
        note: `Provider assistant command: ${originalCommand}`,
        previousStatus: booking.status,
        nextStatus: completedBooking.status
      };
      const bookingWithIntervention = await this.repository.updateBooking(booking.id, {
        interventions: [...completedBooking.interventions, intervention]
      });

      return {
        command: originalCommand,
        understood: true,
        actionType: "complete-booking",
        actionTypes: ["complete-booking"],
        requiresBookingSelection: false,
        requiresConfirmation: false,
        executed: true,
        notifyCustomer: true,
        matchedBookingId: booking.id,
        matchedCustomerName: customer?.fullName,
        sourceWindowKey,
        previewLabel: "Booking completed",
        previewMessage: `Completed ${customer?.fullName ?? "the customer"} and closed out the service lifecycle.`,
        customerNotificationPreview,
        bookingCandidates: [this.toProviderAssistantBookingCandidate(bookingWithIntervention ?? completedBooking)],
        updatedBooking: bookingWithIntervention ?? completedBooking
      };
    }

    if (action.actionType === "report-booking-exception") {
      const customer = await this.repository.findCustomerById(booking.customerId);
      const exceptionLabel = getBookingExceptionLabel(action.exceptionType!);
      const notesSuffix = action.exceptionNotes ? ` Reason: ${action.exceptionNotes}` : "";
      const customerNotificationPreview = `${customer?.fullName ?? "The customer"} will be told: ${exceptionLabel}.${notesSuffix}`;

      if (booking.status === "completed" || booking.status === "cancelled" || booking.status === "refunded") {
        return {
          command: originalCommand,
          understood: true,
          actionType: "report-booking-exception",
          actionTypes: ["report-booking-exception"],
          requiresBookingSelection: false,
          requiresConfirmation: false,
          executed: false,
          notifyCustomer: true,
          matchedBookingId: booking.id,
          matchedCustomerName: customer?.fullName,
          sourceWindowKey,
          previewLabel: "Issue cannot be logged now",
          previewMessage: "Service issues can only be reported while the booking is still active.",
          bookingCandidates: [this.toProviderAssistantBookingCandidate(booking)]
        };
      }

      if (!execute) {
        return {
          command: originalCommand,
          understood: true,
          actionType: "report-booking-exception",
          actionTypes: ["report-booking-exception"],
          requiresBookingSelection: false,
          requiresConfirmation: true,
          executed: false,
          notifyCustomer: true,
          matchedBookingId: booking.id,
          matchedCustomerName: customer?.fullName,
          sourceWindowKey,
          previewLabel: "Ready to report issue",
          previewMessage: `Log ${exceptionLabel.toLowerCase()} for ${customer?.fullName ?? "this customer"} and notify support-facing surfaces immediately.`,
          customerNotificationPreview,
          bookingCandidates: [this.toProviderAssistantBookingCandidate(booking)]
        };
      }

      const exceptionBooking = await this.markBookingException(providerId, {
        bookingId: booking.id,
        exceptionType: action.exceptionType!,
        notes: action.exceptionNotes
      });
      const now = new Date().toISOString();
      const intervention: BookingInterventionRecord = {
        id: crypto.randomUUID(),
        action: "provider-assistant-report-exception",
        createdAt: now,
        actorRole: "provider-assistant",
        actorUserId: providerId,
        note: `Provider assistant command: ${originalCommand}`,
        previousStatus: booking.status,
        nextStatus: exceptionBooking.status
      };
      const bookingWithIntervention = await this.repository.updateBooking(booking.id, {
        interventions: [...exceptionBooking.interventions, intervention]
      });

      return {
        command: originalCommand,
        understood: true,
        actionType: "report-booking-exception",
        actionTypes: ["report-booking-exception"],
        requiresBookingSelection: false,
        requiresConfirmation: false,
        executed: true,
        notifyCustomer: true,
        matchedBookingId: booking.id,
        matchedCustomerName: customer?.fullName,
        sourceWindowKey,
        previewLabel: "Issue reported",
        previewMessage: `Logged ${exceptionLabel.toLowerCase()} for ${customer?.fullName ?? "the customer"}.`,
        customerNotificationPreview,
        bookingCandidates: [this.toProviderAssistantBookingCandidate(bookingWithIntervention ?? exceptionBooking)],
        updatedBooking: bookingWithIntervention ?? exceptionBooking
      };
    }

    if (action.actionType === "mark-booking-late") {
      const lateEtaIso = this.buildProviderAssistantLateEta(booking, action.lateMinutes!);
      const customer = await this.repository.findCustomerById(booking.customerId);
      const lateWindowLabel = getBookingServiceWindow(booking.scheduledStartIso).label.toLowerCase();
      const etaText = new Date(lateEtaIso).toLocaleTimeString([], { timeStyle: "short" });
      const reasonText = action.lateReason ? ` Reason: ${action.lateReason}` : "";
      const customerNotificationPreview = `${
        customer?.fullName ?? "The customer"
      } will be told you now expect to arrive around ${etaText} in the ${lateWindowLabel} window.${reasonText}`;

      if (!execute) {
        return {
          command: originalCommand,
          understood: true,
          actionType: "mark-booking-late",
          actionTypes: ["mark-booking-late"],
          requiresBookingSelection: false,
          requiresConfirmation: true,
          executed: false,
          notifyCustomer: true,
          matchedBookingId: booking.id,
          matchedCustomerName: customer?.fullName,
          sourceWindowKey,
          lateMinutes: action.lateMinutes,
          lateEtaIso,
          previewLabel: "Ready to send a late update",
          previewMessage: `Let ${customer?.fullName ?? "this customer"} know you are about ${
            action.lateMinutes
          } minutes behind and now expect to arrive around ${etaText}.`,
          customerNotificationPreview,
          bookingCandidates: [this.toProviderAssistantBookingCandidate(booking)]
        };
      }

      const lateUpdatedBooking = await this.markBookingLate(providerId, {
        bookingId: booking.id,
        lateEtaIso,
        reason: action.lateReason
      });
      const now = new Date().toISOString();
      const intervention: BookingInterventionRecord = {
        id: crypto.randomUUID(),
        action: "provider-assistant-late-update",
        createdAt: now,
        actorRole: "provider-assistant",
        actorUserId: providerId,
        note: `Provider assistant command: ${originalCommand}`,
        previousStatus: booking.status,
        nextStatus: lateUpdatedBooking.status
      };
      const bookingWithIntervention = await this.repository.updateBooking(booking.id, {
        interventions: [...lateUpdatedBooking.interventions, intervention]
      });

      return {
        command: originalCommand,
        understood: true,
        actionType: "mark-booking-late",
        actionTypes: ["mark-booking-late"],
        requiresBookingSelection: false,
        requiresConfirmation: false,
        executed: true,
        notifyCustomer: true,
        matchedBookingId: booking.id,
        matchedCustomerName: customer?.fullName,
        sourceWindowKey,
        lateMinutes: action.lateMinutes,
        lateEtaIso,
        previewLabel: "Late update sent",
        previewMessage: `Sent a late update to ${customer?.fullName ?? "the customer"} with an arrival estimate around ${etaText}.`,
        customerNotificationPreview,
        bookingCandidates: [this.toProviderAssistantBookingCandidate(bookingWithIntervention ?? lateUpdatedBooking)],
        updatedBooking: bookingWithIntervention ?? lateUpdatedBooking
      };
    }

    if (action.actionType === "start-route") {
      const customer = await this.repository.findCustomerById(booking.customerId);
      const provider = await this.repository.findProviderById(providerId);
      if (action.arrivalUpdate) {
        const arrivalUpdate = this.buildArrivalCustomerUpdate({
          providerLabel: provider?.companyName ?? "Your landscaping business",
          booking
        });

        if (booking.status === "requested") {
          return {
            command: originalCommand,
            understood: true,
            actionType: "start-route",
            actionTypes: ["start-route"],
            requiresBookingSelection: false,
            requiresConfirmation: false,
            executed: false,
            notifyCustomer: true,
            matchedBookingId: booking.id,
            matchedCustomerName: customer?.fullName,
            sourceWindowKey,
            previewLabel: "Confirm this booking first",
            previewMessage: "Confirm this booking and start the route before sending an arrival update.",
            bookingCandidates: [this.toProviderAssistantBookingCandidate(booking)]
          };
        }

        if (booking.status === "completed" || booking.status === "cancelled" || booking.status === "refunded") {
          return {
            command: originalCommand,
            understood: true,
            actionType: "start-route",
            actionTypes: ["start-route"],
            requiresBookingSelection: false,
            executed: false,
            requiresConfirmation: false,
            notifyCustomer: false,
            matchedBookingId: booking.id,
            matchedCustomerName: customer?.fullName,
            sourceWindowKey,
            previewLabel: "Arrival update not available",
            previewMessage: "Arrival updates are only available before the booking is closed.",
            bookingCandidates: [this.toProviderAssistantBookingCandidate(booking)]
          };
        }

        if (!booking.onRouteConfirmedAt) {
          return {
            command: originalCommand,
            understood: true,
            actionType: "start-route",
            actionTypes: ["start-route"],
            requiresBookingSelection: false,
            requiresConfirmation: false,
            executed: false,
            notifyCustomer: true,
            matchedBookingId: booking.id,
            matchedCustomerName: customer?.fullName,
            sourceWindowKey,
            previewLabel: "Start the route first",
            previewMessage: "Start the route before sending an arrival update from the provider assistant.",
            bookingCandidates: [this.toProviderAssistantBookingCandidate(booking)]
          };
        }

        const customerNotificationPreview = `${customer?.fullName ?? "The customer"} will be told: ${
          arrivalUpdate.notificationBody
        }`;

        if (!execute) {
          return {
            command: originalCommand,
            understood: true,
            actionType: "start-route",
            actionTypes: ["start-route"],
            requiresBookingSelection: false,
            requiresConfirmation: true,
            executed: false,
            notifyCustomer: true,
            matchedBookingId: booking.id,
            matchedCustomerName: customer?.fullName,
            sourceWindowKey,
            previewLabel: "Ready to send arrival update",
            previewMessage: `Tell ${customer?.fullName ?? "this customer"} the crew has arrived and is getting set up.`,
            customerNotificationPreview,
            bookingCandidates: [this.toProviderAssistantBookingCandidate(booking)]
          };
        }

        await Promise.all([
          this.createNotification({
            recipientId: booking.customerId,
            recipientRole: "customer",
            category: "booking",
            title: "Your crew has arrived",
            body: arrivalUpdate.notificationBody,
            actionHref: `/customer/dashboard?bookingId=${booking.id}&tracking=1`
          }),
          this.createNotification({
            recipientId: booking.providerId,
            recipientRole: "provider",
            category: "booking",
            title: "Arrival update sent",
            body: "The customer was told the crew has arrived and is getting set up.",
            actionHref: `/provider/management?bookingId=${booking.id}`
          })
        ]);

        const now = new Date().toISOString();
        const intervention: BookingInterventionRecord = {
          id: crypto.randomUUID(),
          action: "provider-assistant-arrival-update",
          createdAt: now,
          actorRole: "provider-assistant",
          actorUserId: providerId,
          note: `Provider assistant command: ${originalCommand}`,
          previousStatus: booking.status,
          nextStatus: booking.status
        };
        const bookingWithIntervention = await this.repository.updateBooking(booking.id, {
          interventions: [...booking.interventions, intervention]
        });

        return {
          command: originalCommand,
          understood: true,
          actionType: "start-route",
          actionTypes: ["start-route"],
          requiresBookingSelection: false,
          requiresConfirmation: false,
          executed: true,
          notifyCustomer: true,
          matchedBookingId: booking.id,
          matchedCustomerName: customer?.fullName,
          sourceWindowKey,
          previewLabel: "Arrival update sent",
          previewMessage: `Told ${customer?.fullName ?? "the customer"} the crew has arrived and is getting set up.`,
          customerNotificationPreview,
          bookingCandidates: [this.toProviderAssistantBookingCandidate(bookingWithIntervention ?? booking)],
          updatedBooking: bookingWithIntervention ?? booking
        };
      }

      const routeUpdate = this.buildOnRouteCustomerUpdate({
        booking,
        routeLeaderLabel: provider?.companyName ?? "Your landscaping business",
        routeStartPoint: provider?.address.point
      });
      if (booking.status !== "confirmed") {
        return {
          command: originalCommand,
          understood: true,
          actionType: "start-route",
          actionTypes: ["start-route"],
          requiresBookingSelection: false,
          requiresConfirmation: false,
          executed: false,
          notifyCustomer: true,
          matchedBookingId: booking.id,
          matchedCustomerName: customer?.fullName,
          sourceWindowKey,
          previewLabel: "Route cannot start yet",
          previewMessage: "Confirm this booking before starting the route from the provider assistant.",
          bookingCandidates: [this.toProviderAssistantBookingCandidate(booking)]
        };
      }

      const customerNotificationPreview = `${customer?.fullName ?? "The customer"} will be told: ${
        routeUpdate.previewText
      }`;

      if (!execute) {
        return {
          command: originalCommand,
          understood: true,
          actionType: "start-route",
          actionTypes: ["start-route"],
          requiresBookingSelection: false,
          requiresConfirmation: true,
          executed: false,
          notifyCustomer: true,
          matchedBookingId: booking.id,
          matchedCustomerName: customer?.fullName,
          sourceWindowKey,
          previewLabel: "Ready to start the route",
          previewMessage: `Start the route for ${customer?.fullName ?? "this customer"}, send an on-my-way ETA, and unlock live arrival tracking.`,
          customerNotificationPreview,
          bookingCandidates: [this.toProviderAssistantBookingCandidate(booking)]
        };
      }

      const providerIdentity = await this.repository.findAuthIdentityByUserId(providerId);
      if (!providerIdentity || providerIdentity.role !== "provider") {
        throw new HttpError(404, "Provider identity not found for this assistant command");
      }

      const onRouteBooking = await this.markBookingOnRoute(providerIdentity, { bookingId: booking.id });
      const now = new Date().toISOString();
      const intervention: BookingInterventionRecord = {
        id: crypto.randomUUID(),
        action: "provider-assistant-start-route",
        createdAt: now,
        actorRole: "provider-assistant",
        actorUserId: providerId,
        note: `Provider assistant command: ${originalCommand}`,
        previousStatus: booking.status,
        nextStatus: onRouteBooking.status
      };
      const bookingWithIntervention = await this.repository.updateBooking(booking.id, {
        interventions: [...onRouteBooking.interventions, intervention]
      });

      return {
        command: originalCommand,
        understood: true,
        actionType: "start-route",
        actionTypes: ["start-route"],
        requiresBookingSelection: false,
        requiresConfirmation: false,
        executed: true,
        notifyCustomer: true,
        matchedBookingId: booking.id,
        matchedCustomerName: customer?.fullName,
        sourceWindowKey,
        previewLabel: "Route started",
        previewMessage: `Started the route for ${customer?.fullName ?? "the customer"}, sent an on-my-way ETA, and unlocked live arrival tracking.`,
        customerNotificationPreview,
        bookingCandidates: [this.toProviderAssistantBookingCandidate(bookingWithIntervention ?? onRouteBooking)],
        updatedBooking: bookingWithIntervention ?? onRouteBooking
      };
    }

    if (action.actionType === "start-work") {
      const customer = await this.repository.findCustomerById(booking.customerId);
      if (booking.status === "in-progress") {
        return {
          command: originalCommand,
          understood: true,
          actionType: "start-work",
          actionTypes: ["start-work"],
          requiresBookingSelection: false,
          requiresConfirmation: false,
          executed: false,
          notifyCustomer: false,
          matchedBookingId: booking.id,
          matchedCustomerName: customer?.fullName,
          sourceWindowKey,
          previewLabel: "Work already started",
          previewMessage: `${customer?.fullName ?? "This customer"} is already marked in progress.`,
          bookingCandidates: [this.toProviderAssistantBookingCandidate(booking)]
        };
      }

      if (booking.status !== "confirmed") {
        return {
          command: originalCommand,
          understood: true,
          actionType: "start-work",
          actionTypes: ["start-work"],
          requiresBookingSelection: false,
          requiresConfirmation: false,
          executed: false,
          notifyCustomer: false,
          matchedBookingId: booking.id,
          matchedCustomerName: customer?.fullName,
          sourceWindowKey,
          previewLabel: "Work cannot start yet",
          previewMessage: "Confirm this booking before starting work from the provider assistant.",
          bookingCandidates: [this.toProviderAssistantBookingCandidate(booking)]
        };
      }

      if (!booking.onRouteConfirmedAt) {
        return {
          command: originalCommand,
          understood: true,
          actionType: "start-work",
          actionTypes: ["start-work"],
          requiresBookingSelection: false,
          requiresConfirmation: false,
          executed: false,
          notifyCustomer: false,
          matchedBookingId: booking.id,
          matchedCustomerName: customer?.fullName,
          sourceWindowKey,
          previewLabel: "Start the route first",
          previewMessage: "Start the route first, then ask the provider assistant to begin work.",
          bookingCandidates: [this.toProviderAssistantBookingCandidate(booking)]
        };
      }

      if (this.countBookingEvidence(booking, "before") < 1) {
        return {
          command: originalCommand,
          understood: true,
          actionType: "start-work",
          actionTypes: ["start-work"],
          requiresBookingSelection: false,
          requiresConfirmation: false,
          executed: false,
          notifyCustomer: false,
          matchedBookingId: booking.id,
          matchedCustomerName: customer?.fullName,
          sourceWindowKey,
          previewLabel: "Before photo still needed",
          previewMessage: "Capture at least one before photo before starting work from the provider assistant.",
          bookingCandidates: [this.toProviderAssistantBookingCandidate(booking)]
        };
      }

      if (!execute) {
        return {
          command: originalCommand,
          understood: true,
          actionType: "start-work",
          actionTypes: ["start-work"],
          requiresBookingSelection: false,
          requiresConfirmation: true,
          executed: false,
          notifyCustomer: false,
          matchedBookingId: booking.id,
          matchedCustomerName: customer?.fullName,
          sourceWindowKey,
          previewLabel: "Ready to start work",
          previewMessage: `Start work for ${customer?.fullName ?? "this customer"} and move the booking into the active job state.`,
          bookingCandidates: [this.toProviderAssistantBookingCandidate(booking)]
        };
      }

      const providerIdentity = await this.repository.findAuthIdentityByUserId(providerId);
      if (!providerIdentity || providerIdentity.role !== "provider") {
        throw new HttpError(404, "Provider identity not found for this assistant command");
      }

      const startedBooking = await this.startBooking(providerIdentity, { bookingId: booking.id });
      const now = new Date().toISOString();
      const intervention: BookingInterventionRecord = {
        id: crypto.randomUUID(),
        action: "provider-assistant-start-work",
        createdAt: now,
        actorRole: "provider-assistant",
        actorUserId: providerId,
        note: `Provider assistant command: ${originalCommand}`,
        previousStatus: booking.status,
        nextStatus: startedBooking.status
      };
      const bookingWithIntervention = await this.repository.updateBooking(booking.id, {
        interventions: [...startedBooking.interventions, intervention]
      });

      return {
        command: originalCommand,
        understood: true,
        actionType: "start-work",
        actionTypes: ["start-work"],
        requiresBookingSelection: false,
        requiresConfirmation: false,
        executed: true,
        notifyCustomer: false,
        matchedBookingId: booking.id,
        matchedCustomerName: customer?.fullName,
        sourceWindowKey,
        previewLabel: "Work started",
        previewMessage: `Started work for ${customer?.fullName ?? "the customer"} and moved the booking into progress.`,
        bookingCandidates: [this.toProviderAssistantBookingCandidate(bookingWithIntervention ?? startedBooking)],
        updatedBooking: bookingWithIntervention ?? startedBooking
      };
    }

    const targetWindowKey = action.targetWindowKey!;
    const targetWindow = this.buildProviderAssistantTargetWindow(booking, targetWindowKey);
    const customer = await this.repository.findCustomerById(booking.customerId);
    await this.assertProviderRescheduleWindowIsAvailable(
      booking.providerId,
      booking.id,
      targetWindow.startIso,
      targetWindow.endIso
    );

    const customerNotificationPreview = `Updated to ${this.formatBookingWindowWithDate(targetWindow.startIso)} for ${
      customer?.fullName ?? "the customer"
    }.`;

    if (!execute) {
      return {
        command: originalCommand,
        understood: true,
        actionType: "reschedule-booking",
        actionTypes: ["reschedule-booking"],
        requiresBookingSelection: false,
        requiresConfirmation: true,
        executed: false,
        notifyCustomer: true,
        matchedBookingId: booking.id,
        matchedCustomerName: customer?.fullName,
        sourceWindowKey,
        targetWindowKey,
        targetWindowLabel: this.providerAssistantWindowLabel(targetWindowKey),
        suggestedStartIso: targetWindow.startIso,
        suggestedEndIso: targetWindow.endIso,
        previewLabel: "Ready to reschedule",
        previewMessage: `Move ${customer?.fullName ?? "this customer"} to ${this.providerAssistantWindowLabel(
          targetWindowKey
        )} on ${new Date(targetWindow.startIso).toLocaleDateString()}.`,
        customerNotificationPreview,
        bookingCandidates: [this.toProviderAssistantBookingCandidate(booking)]
      };
    }

    const now = new Date().toISOString();
    const intervention: BookingInterventionRecord = {
      id: crypto.randomUUID(),
      action: "provider-assistant-reschedule",
      createdAt: now,
      actorRole: "provider-assistant",
      actorUserId: providerId,
      note: `Provider assistant command: ${originalCommand}`,
      previousStatus: booking.status,
      nextStatus: booking.status === "requested" ? "requested" : "confirmed",
      previousScheduledStartIso: booking.scheduledStartIso,
      previousScheduledEndIso: booking.scheduledEndIso,
      nextScheduledStartIso: targetWindow.startIso,
      nextScheduledEndIso: targetWindow.endIso
    };

    const updatedBooking = await this.repository.updateBooking(booking.id, {
      scheduledStartIso: targetWindow.startIso,
      scheduledEndIso: targetWindow.endIso,
      status: booking.status === "requested" ? "requested" : "confirmed",
      onRouteConfirmedAt: undefined,
      onRouteConfirmedByCrewMemberId: undefined,
      lateNoticeSentAt: undefined,
      lateEtaIso: undefined,
      lateReason: undefined,
      activeExceptionType: undefined,
      activeExceptionReportedAt: undefined,
      activeExceptionNotes: undefined,
      disputedAt: undefined,
      disputeReason: undefined,
      disputedByRole: undefined,
      completedAt: undefined,
      interventions: [...booking.interventions, intervention]
    });

    if (!updatedBooking) {
      throw new HttpError(500, "Provider assistant could not reschedule the booking");
    }

    await this.createNotification({
      recipientId: booking.customerId,
      recipientRole: "customer",
      category: "booking",
      title: "Your service window was updated",
      body: `Your provider moved this job to ${this.formatBookingWindowWithDate(targetWindow.startIso)}.`,
      actionHref: `/customer/dashboard?bookingId=${booking.id}`
    });

    this.analytics.record({
      id: crypto.randomUUID(),
      name: MarketplaceTelemetryEventCatalog.bookingRescheduled,
      actorId: providerId,
      occurredAt: now,
      properties: {
        bookingId: booking.id,
        providerId,
        previousStartIso: booking.scheduledStartIso,
        nextStartIso: targetWindow.startIso,
        source: "provider-assistant"
      }
    });

    return {
      command: originalCommand,
      understood: true,
      actionType: "reschedule-booking",
      actionTypes: ["reschedule-booking"],
      requiresBookingSelection: false,
      requiresConfirmation: false,
      executed: true,
      notifyCustomer: true,
      matchedBookingId: booking.id,
      matchedCustomerName: customer?.fullName,
      sourceWindowKey,
      targetWindowKey,
      targetWindowLabel: this.providerAssistantWindowLabel(targetWindowKey),
      suggestedStartIso: targetWindow.startIso,
      suggestedEndIso: targetWindow.endIso,
      previewLabel: "Command executed",
      previewMessage: `Moved ${customer?.fullName ?? "the customer"} to ${this.providerAssistantWindowLabel(
        targetWindowKey
      )} and sent an update.`,
      customerNotificationPreview,
      bookingCandidates: [this.toProviderAssistantBookingCandidate(updatedBooking)],
      updatedBooking
    };
  }

  private projectBookingAfterProviderAssistantAction(
    booking: Booking & { customerName: string },
    action: ParsedProviderAssistantAction
  ): Booking & { customerName: string } {
    const now = new Date().toISOString();
    if (action.actionType === "accept-crew-match" || action.actionType === "deny-crew-match") {
      return {
        ...booking
      };
    }

    if (action.actionType === "message-crew") {
      return {
        ...booking
      };
    }

    if (action.actionType === "set-route-stop") {
      return {
        ...booking
      };
    }

    if (action.actionType === "assign-route-leader") {
      return {
        ...booking
      };
    }

    if (action.actionType === "clear-route-leader") {
      return {
        ...booking,
        assignedRouteLeaderCrewMemberId: undefined
      };
    }

    if (action.actionType === "clear-route-stop") {
      return {
        ...booking,
        routeActiveStop: undefined
      };
    }

    if (action.actionType === "confirm-booking") {
      return {
        ...booking,
        status: "confirmed"
      };
    }

    if (action.actionType === "start-route") {
      return {
        ...booking,
        onRouteConfirmedAt: now,
        lateNoticeSentAt: undefined,
        lateEtaIso: undefined,
        lateReason: undefined
      };
    }

    if (action.actionType === "start-work") {
      return {
        ...booking,
        status: "in-progress"
      };
    }

    if (action.actionType === "complete-booking") {
      return {
        ...booking,
        status: "completed",
        completedAt: now,
        activeExceptionType: undefined,
        activeExceptionReportedAt: undefined,
        activeExceptionNotes: undefined
      };
    }

    if (action.actionType === "mark-booking-late") {
      return {
        ...booking,
        lateNoticeSentAt: now,
        lateEtaIso: this.buildProviderAssistantLateEta(booking, action.lateMinutes ?? 0),
        lateReason: action.lateReason
      };
    }

    if (action.actionType === "report-booking-exception") {
      return {
        ...booking,
        activeExceptionType: action.exceptionType,
        activeExceptionReportedAt: now,
        activeExceptionNotes: action.exceptionNotes
      };
    }

    const targetWindow = this.buildProviderAssistantTargetWindow(booking, action.targetWindowKey!);
    return {
      ...booking,
      scheduledStartIso: targetWindow.startIso,
      scheduledEndIso: targetWindow.endIso,
      status: booking.status === "requested" ? "requested" : "confirmed",
      onRouteConfirmedAt: undefined,
      onRouteConfirmedByCrewMemberId: undefined,
      lateNoticeSentAt: undefined,
      lateEtaIso: undefined,
      lateReason: undefined,
      activeExceptionType: undefined,
      activeExceptionReportedAt: undefined,
      activeExceptionNotes: undefined,
      disputedAt: undefined,
      disputeReason: undefined,
      disputedByRole: undefined,
      completedAt: undefined
    };
  }

  private projectCrewMatchesAfterProviderAssistantAction(
    matches: CrewMatchCandidate[],
    action: ParsedProviderAssistantAction
  ): CrewMatchCandidate[] {
    if (
      action.actionType !== "accept-best-crew-match" &&
      action.actionType !== "accept-crew-match" &&
      action.actionType !== "deny-crew-match"
    ) {
      return matches;
    }

    const matchedCrew =
      action.actionType === "accept-best-crew-match"
        ? matches.find((match) => match.status === "pending-provider-review")
        : matches.find((match) => {
            if (
              match.status !== "pending-provider-review" &&
              match.status !== "accepted"
            ) {
              return false;
            }

            const normalizedName = match.crewMemberName.toLowerCase();
            const query = action.crewMatchCrewNameQuery?.trim().toLowerCase();
            if (!query) {
              return false;
            }

            return normalizedName === query || normalizedName.includes(query) || query.includes(normalizedName);
          });

    if (!matchedCrew) {
      return matches;
    }

    const nextStatus = action.actionType === "accept-crew-match" ? "accepted" : "denied";
    return matches.map((match) =>
      match.id === matchedCrew.id
        ? {
            ...match,
            status: nextStatus,
            reviewedAt: new Date().toISOString()
          }
        : match
    );
  }

  private buildProviderAssistantDispatchRangeSummary(
    dispatchDays: ProviderCalendarOverviewResponse["dispatchDays"]
  ): ProviderDispatchRangeSummary | undefined {
    const activeDays = dispatchDays.filter(
      (day) => day.yardmatchJobCount > 0 || day.externalBlockCount > 0
    );
    if (activeDays.length === 0) {
      return undefined;
    }

    const watchDays = activeDays.filter((day) => day.routeStatus === "watch");
    const overloadedDays = activeDays.filter((day) => day.routeStatus === "overloaded");
    const busiestDay = [...activeDays].sort((left, right) => right.yardmatchJobCount - left.yardmatchJobCount)[0];
    const highestCrewGapDay = [...activeDays].sort((left, right) => right.crewGap - left.crewGap)[0];
    const highestDriveMilesDay = [...activeDays].sort(
      (left, right) => right.estimatedDriveMiles - left.estimatedDriveMiles
    )[0];
    const recommendations = Array.from(
      new Set(activeDays.flatMap((day) => day.recommendations).filter(Boolean))
    ).slice(0, 3);

    return {
      scope: "next-7-days",
      activeDayCount: activeDays.length,
      totalYardmatchJobs: activeDays.reduce((sum, day) => sum + day.yardmatchJobCount, 0),
      totalExternalBlocks: activeDays.reduce((sum, day) => sum + day.externalBlockCount, 0),
      totalCrewGap: activeDays.reduce((sum, day) => sum + day.crewGap, 0),
      watchDayCount: watchDays.length,
      overloadedDayCount: overloadedDays.length,
      busiestDay,
      highestCrewGapDay,
      highestDriveMilesDay,
      recommendations
    };
  }

  private mergeProviderAssistantResponses(
    command: string,
    actionTypes: ProviderAssistantActionType[],
    responses: ProviderAssistantCommandResponse[],
    executed: boolean
  ): ProviderAssistantCommandResponse {
    const lastResponse = responses.at(-1)!;
    const previewMessages = responses.map((response, index) => `Step ${index + 1}: ${response.previewMessage}`);
    const notificationPreview = responses
      .map((response) => response.customerNotificationPreview)
      .filter((value): value is string => Boolean(value))
      .join(" Then, ");

    return {
      command,
      understood: true,
      actionType: responses[0]?.actionType,
      actionTypes,
      requiresBookingSelection: false,
      requiresConfirmation: !executed,
      executed,
      notifyCustomer: responses.some((response) => response.notifyCustomer),
      matchedBookingId: lastResponse.matchedBookingId,
      matchedCustomerName: lastResponse.matchedCustomerName,
      sourceWindowKey: responses[0]?.sourceWindowKey,
      targetWindowKey: lastResponse.targetWindowKey,
      targetWindowLabel: lastResponse.targetWindowLabel,
      suggestedStartIso: lastResponse.suggestedStartIso,
      suggestedEndIso: lastResponse.suggestedEndIso,
      lateMinutes: lastResponse.lateMinutes,
      lateEtaIso: lastResponse.lateEtaIso,
      previewLabel: executed ? "Multi-step command executed" : "Ready to run multi-step command",
      previewMessage: previewMessages.join(" "),
      customerNotificationPreview: notificationPreview || undefined,
      bookingCandidates: lastResponse.bookingCandidates,
      updatedBooking: lastResponse.updatedBooking
    };
  }

  private providerAssistantHelpText(): string {
    return 'Try a command like "Set equipment pickup as the next stop for my afternoon appointment", "Clear the route stop for my afternoon appointment", "Accept the best crew for my afternoon appointment", "Accept Morgan Crew for my afternoon appointment", "Confirm my afternoon appointment", "Confirm my afternoon appointment and start route", "Start route for my afternoon appointment and start work", "Make Taylor Crew the route leader for my afternoon appointment", "Tell Morgan Crew to head to the equipment pickup first for my afternoon appointment", "Clear the route leader for my afternoon appointment", "Move my afternoon appointment to evening and notify the customer", "Tell my afternoon customer I am 30 minutes late", "Complete my afternoon appointment", or "Mark my afternoon appointment no access because the gate is locked."';
  }

  public async createCustomerProperty(
    customerId: string,
    payload: CreateCustomerPropertyRequest
  ): Promise<CustomerProperty> {
    const customer = await this.repository.findCustomerById(customerId);

    if (!customer) {
      throw new Error("Customer not found");
    }

    const validatedAddress = await this.normalizeAndValidateAddress(payload.address);
    const cachedAddress = await this.resolveSavedPropertyAddress(validatedAddress.address, customer.properties);
    const property = this.propertyBook.createProperty(crypto.randomUUID(), {
      ...payload,
      address: cachedAddress,
      customerId
    });
    const properties = customer.properties.map((existingProperty) => ({
      ...existingProperty,
      isDefault: payload.setAsDefault ? false : existingProperty.isDefault
    }));
    properties.push(property);

    const defaultProperty = payload.setAsDefault
      ? property
      : properties.find((existingProperty) => existingProperty.isDefault) ?? property;

    await this.repository.updateCustomer(customer.id, {
      properties,
      defaultPropertyId: defaultProperty.id,
      address: defaultProperty.address,
      lawnSizeSqFt: defaultProperty.lawnSizeSqFt ?? customer.lawnSizeSqFt,
      propertyNotes: defaultProperty.accessNotes ?? customer.propertyNotes
    });

    this.analytics.record({
      id: crypto.randomUUID(),
      name: MarketplaceTelemetryEventCatalog.customerPropertyAdded,
      actorId: customer.id,
      occurredAt: new Date().toISOString(),
      properties: {
        propertyLabel: property.label,
        setAsDefault: property.isDefault,
        city: property.address.city
      }
    });

    return property;
  }

  public async listCustomerProperties(customerId: string): Promise<CustomerProperty[]> {
    return this.repository.listCustomerProperties(customerId);
  }

  public async listProviderReviews(providerId: string): Promise<ProviderReview[]> {
    return this.repository.listProviderReviews(providerId);
  }

  public async updateReviewResponse(payload: UpdateReviewResponseRequest): Promise<ProviderReview> {
    const review = await this.repository.findProviderReviewById(payload.reviewId);
    if (!review) {
      throw new HttpError(404, "Review not found");
    }

    const responseHandledBy = payload.responseHandledBy?.trim().replace(/\s+/g, " ") || undefined;
    const responseNotes = payload.responseNotes?.trim().replace(/\s+/g, " ") || undefined;
    const publicReplyBody = payload.publicReplyBody?.trim().replace(/\s+/g, " ") || undefined;
    const responseChannel = payload.responseChannel;
    const responseChannelMetadata = this.normalizeReviewResponseChannelMetadata(
      payload.responseChannelMetadata
    );
    const externalResponseId = payload.externalResponseId?.trim().replace(/\s+/g, " ") || undefined;
    const publicResponseUrl = payload.publicResponseUrl?.trim() || undefined;

    if (payload.responseStatus === "posted" && (!publicReplyBody || publicReplyBody.length < 20)) {
      throw new HttpError(400, "Add the public reply you posted so ops can audit the response.");
    }

    if (payload.responseStatus === "posted" && !responseChannel) {
      throw new HttpError(400, "Choose where the public reply was posted so ops can trace the live channel.");
    }

    if (payload.responseStatus === "posted" && !externalResponseId && !publicResponseUrl) {
      throw new HttpError(
        400,
        "Add a public reply link or external response id so ops can trace the posted reply."
      );
    }

    if (payload.responseStatus === "skipped" && (!responseNotes || responseNotes.length < 12)) {
      throw new HttpError(400, "Explain why the public reply was skipped.");
    }

    const updatedReview = await this.repository.updateProviderReview(review.id, {
      responseStatus: payload.responseStatus,
      responseHandledAt: payload.responseStatus === "pending" ? undefined : new Date().toISOString(),
      responseHandledBy: payload.responseStatus === "pending" ? undefined : responseHandledBy,
      responseNotes: payload.responseStatus === "pending" ? undefined : responseNotes,
      publicReplyBody: payload.responseStatus === "posted" ? publicReplyBody : undefined,
      responseChannel: payload.responseStatus === "posted" ? responseChannel : undefined,
      responseChannelMetadata:
        payload.responseStatus === "posted" ? responseChannelMetadata : undefined,
      externalResponseId: payload.responseStatus === "posted" ? externalResponseId : undefined,
      publicResponseUrl: payload.responseStatus === "posted" ? publicResponseUrl : undefined
    });

    if (!updatedReview) {
      throw new HttpError(500, "Review response state could not be updated");
    }

    return updatedReview;
  }

  public async createInboundReviewResponse(
    payload: CreateInboundReviewResponseRequest,
    secretHeader: string | undefined
  ): Promise<ProviderReview> {
    const configuredSecret = process.env.INBOUND_REVIEW_RESPONSE_WEBHOOK_SECRET?.trim();
    if (!configuredSecret) {
      throw new HttpError(503, "Inbound review response webhook secret is not configured yet.");
    }
    if (!secretHeader || secretHeader.trim() !== configuredSecret) {
      throw new HttpError(401, "Invalid inbound review response secret.");
    }

    const review = await this.repository.findProviderReviewById(payload.reviewId);
    if (!review) {
      throw new HttpError(404, "Review not found");
    }

    const normalizedExternalResponseId = payload.externalResponseId?.trim().replace(/\s+/g, " ") || undefined;
    const normalizedPublicResponseUrl = payload.publicResponseUrl?.trim() || undefined;
    const normalizedPublicReplyBody = payload.publicReplyBody?.trim().replace(/\s+/g, " ") || "";
    const normalizedChannelMetadata = this.normalizeReviewResponseChannelMetadata(
      payload.responseChannelMetadata
    );
    const normalizedHandledBy = payload.responseHandledBy?.trim().replace(/\s+/g, " ") || "Inbound automation";
    const normalizedNotes =
      payload.responseNotes?.trim().replace(/\s+/g, " ") ||
      `Posted via inbound ${payload.responseChannel.replaceAll("-", " ")} automation.`;

    if (
      review.responseStatus === "posted" &&
      review.responseChannel === payload.responseChannel &&
      ((normalizedExternalResponseId && review.externalResponseId === normalizedExternalResponseId) ||
        (normalizedPublicResponseUrl && review.publicResponseUrl === normalizedPublicResponseUrl))
    ) {
      return review;
    }

    return this.updateReviewResponse({
      reviewId: payload.reviewId,
      responseStatus: "posted",
      responseHandledBy: normalizedHandledBy,
      responseNotes: normalizedNotes,
      publicReplyBody: normalizedPublicReplyBody,
      responseChannel: payload.responseChannel,
      responseChannelMetadata: normalizedChannelMetadata,
      externalResponseId: normalizedExternalResponseId,
      publicResponseUrl: normalizedPublicResponseUrl
    });
  }

  public async createInboundSharedInboxReviewResponse(
    payload: CreateInboundSharedInboxReviewResponseRequest,
    secretHeader: string | undefined
  ): Promise<ProviderReview> {
    const normalizedExternalResponseId =
      payload.externalResponseId?.trim().replace(/\s+/g, " ") ||
      this.normalizeInboundMessageReference(payload.messageId);
    const normalizedThreadId =
      this.normalizeInboundMessageReference(payload.threadId) ?? payload.threadId?.trim() ?? undefined;
    const normalizedSenderEmail = payload.senderEmail?.trim().toLowerCase() || undefined;
    const normalizedMailboxName = payload.mailboxName?.trim().replace(/\s+/g, " ") || undefined;
    const intakeNotes: string[] = [];

    if (!payload.externalResponseId?.trim() && normalizedExternalResponseId) {
      intakeNotes.push("externalResponseId was derived from the shared inbox message id for retry-safe deduplication.");
    }
    intakeNotes.push("Recorded via the inbound shared inbox review-response automation route.");

    return this.createInboundReviewResponse(
      {
        reviewId: payload.reviewId,
        responseHandledBy: payload.responseHandledBy,
        responseNotes: payload.responseNotes,
        publicReplyBody: payload.publicReplyBody,
        responseChannel: "shared-inbox",
        responseChannelMetadata: {
          emailMessageId: this.normalizeInboundMessageReference(payload.messageId),
          emailThreadId: normalizedThreadId,
          threadUrl: payload.threadUrl?.trim() || undefined,
          mailboxName: normalizedMailboxName,
          senderEmail: normalizedSenderEmail,
          intakeNotes
        },
        externalResponseId: normalizedExternalResponseId,
        publicResponseUrl: payload.publicResponseUrl
      },
      secretHeader
    );
  }

  public async createInboundGoogleBusinessProfileReviewResponse(
    payload: CreateInboundGoogleBusinessProfileReviewResponseRequest,
    secretHeader: string | undefined
  ): Promise<ProviderReview> {
    const normalizedReplyId = payload.replyId?.trim().replace(/\s+/g, " ") || undefined;
    const normalizedLocationName =
      payload.profileLocationName?.trim().replace(/\s+/g, " ") || undefined;

    return this.createInboundReviewResponse(
      {
        reviewId: payload.reviewId,
        responseHandledBy: payload.responseHandledBy,
        responseNotes: payload.responseNotes,
        publicReplyBody: payload.publicReplyBody,
        responseChannel: "google-business-profile",
        responseChannelMetadata: {
          threadUrl: payload.threadUrl?.trim() || undefined,
          profileLocationName: normalizedLocationName,
          intakeNotes: ["Recorded via the inbound Google Business Profile review-response automation route."]
        },
        externalResponseId: normalizedReplyId,
        publicResponseUrl: payload.publicResponseUrl
      },
      secretHeader
    );
  }

  public async escalateReviewForSupport(
    payload: EscalateReviewSupportRequest
  ): Promise<OpsReviewResponseItem> {
    const review = await this.repository.findProviderReviewById(payload.reviewId);
    if (!review) {
      throw new HttpError(404, "Review not found");
    }

    const booking = await this.repository.findBookingById(review.bookingId);
    if (!booking) {
      throw new HttpError(404, "Booking not found");
    }

    const provider = await this.repository.findProviderById(review.providerId);
    if (!provider) {
      throw new HttpError(404, "Provider not found");
    }

    const relatedTickets = (await this.repository.listSupportTickets()).filter(
      (ticket) => ticket.bookingId === booking.id
    );
    const openServiceQualityTicket = relatedTickets.find(
      (ticket) => ticket.issueType === "service-quality" && ticket.status !== "resolved"
    );
    const escalationNotes = payload.escalationNotes?.trim().replace(/\s+/g, " ") || undefined;
    if (!escalationNotes || escalationNotes.length < 12) {
      throw new HttpError(400, "Add a specific support follow-up note before escalating this review.");
    }
    const escalatedBy = payload.escalatedBy?.trim().replace(/\s+/g, " ") || undefined;
    const escalatedAt = new Date().toISOString();

    const supportTicket =
      openServiceQualityTicket ??
      (await this.createSupportTicket(
        {
          userId: review.customerId,
          role: "customer"
        },
        {
          bookingId: booking.id,
          issueType: "service-quality",
          subject: `Review escalation: ${this.titleCaseCategory(booking.category)}`,
          description:
            `Ops escalated a public review into service-quality follow-up. ` +
            `Rating: ${review.overallRating}/5. Review: ${review.reviewText}. ` +
            `Ops note: ${escalationNotes}`
        }
      ));

    const nextSupportTicket =
      openServiceQualityTicket && openServiceQualityTicket.status !== "resolved"
        ? ((await this.repository.updateSupportTicket(openServiceQualityTicket.id, {
            updatedAt: escalatedAt,
            description:
              `${openServiceQualityTicket.description}\n\nReview escalation note (${escalatedAt}): ${escalationNotes}`
          })) ??
          openServiceQualityTicket)
        : supportTicket;

    const updatedReview = await this.repository.updateProviderReview(review.id, {
      supportTicketId: nextSupportTicket.id,
      escalatedAt,
      escalatedBy,
      escalationNotes
    });

    if (!updatedReview) {
      throw new HttpError(500, "Review escalation could not be saved");
    }

    const queueItem = this.buildOpsReviewResponseQueueItem(
      updatedReview,
      booking,
      provider,
      (await this.repository.listSupportTickets()).filter((ticket) => ticket.bookingId === booking.id)
    );

    if (!queueItem) {
      throw new HttpError(500, "Review escalation could not be loaded back into the ops queue");
    }

    return queueItem;
  }

  public async listCustomerReviewOpportunities(
    customerId: string
  ): Promise<ListCustomerReviewOpportunitiesResponse> {
    const now = new Date(Date.now());
    const opportunities = (await this.repository
      .listBookings())
      .filter((booking) => booking.customerId === customerId && booking.status === "completed")
      .map(async (booking) => this.buildReviewOpportunity(booking, now))
      ;

    const resolvedOpportunities = (await Promise.all(opportunities))
      .filter((opportunity): opportunity is CustomerReviewOpportunity => opportunity !== undefined)
      .sort((left, right) => (right.completedAt ?? "").localeCompare(left.completedAt ?? ""));

    return {
      opportunities: resolvedOpportunities
    };
  }

  public async listCustomerRetentionOpportunities(
    customerId: string
  ): Promise<ListCustomerRetentionOpportunitiesResponse> {
    const [bookings, recurringPlans] = await Promise.all([
      this.repository.listBookings(),
      this.repository.listRecurringServicePlans()
    ]);

    const relevantBookings = bookings.filter((booking) => booking.customerId === customerId);
    const providerNames = new Map(
      (
        await Promise.all(
          [...new Set(relevantBookings.map((booking) => booking.providerId))].map(async (providerId) => [
            providerId,
            (await this.repository.findProviderById(providerId))?.companyName ?? "Landscaping business"
          ] as const)
        )
      ).map(([providerId, providerName]) => [providerId, providerName])
    );
    const activeRecurringPlanKeys = new Set(
      recurringPlans
        .filter((plan) => plan.customerId === customerId)
        .filter((plan) => plan.status === "active" && plan.servicePropertyId)
        .map((plan) => `${plan.servicePropertyId}:${plan.category}`)
    );
    const futureBookingKeys = new Set(
      relevantBookings
        .filter(
          (booking) =>
            booking.servicePropertyId &&
            booking.status !== "completed" &&
            booking.status !== "cancelled" &&
            booking.status !== "refunded"
        )
        .map((booking) => `${booking.servicePropertyId}:${booking.category}`)
    );

    const opportunitiesByKey = new Map<string, CustomerRetentionOpportunity>();
    const completedBookings = relevantBookings
      .filter((booking) => booking.status === "completed" && booking.completedAt && booking.servicePropertyId)
      .sort((left, right) => (right.completedAt ?? "").localeCompare(left.completedAt ?? ""));
    const completedBookingsByKey = new Map<string, Booking[]>();

    for (const booking of completedBookings) {
      if (!booking.servicePropertyId) {
        continue;
      }

      const groupKey = `${booking.servicePropertyId}:${booking.category}`;
      const existing = completedBookingsByKey.get(groupKey) ?? [];
      existing.push(booking);
      completedBookingsByKey.set(groupKey, existing);
    }

    for (const booking of completedBookings) {
      if (!booking.servicePropertyId || !booking.completedAt) {
        continue;
      }

      const groupKey = `${booking.servicePropertyId}:${booking.category}`;
      if (opportunitiesByKey.has(groupKey) || futureBookingKeys.has(groupKey)) {
        continue;
      }

      const providerName = providerNames.get(booking.providerId) ?? "Landscaping business";
      const opportunity = this.buildCustomerRetentionOpportunityForBooking(
        booking,
        providerName,
        activeRecurringPlanKeys.has(groupKey),
        completedBookingsByKey.get(groupKey) ?? [booking]
      );
      if (!opportunity) {
        continue;
      }

      opportunitiesByKey.set(groupKey, opportunity);
    }

    return {
      opportunities: [...opportunitiesByKey.values()]
        .sort((left, right) => right.completedAt.localeCompare(left.completedAt))
        .slice(0, 3)
    };
  }

  private buildCustomerRetentionOpportunityForBooking(
    booking: Booking,
    providerName: string,
    hasActiveRecurringPlan: boolean,
    completedBookingsForCategory: Booking[]
  ): CustomerRetentionOpportunity | undefined {
    if (!booking.servicePropertyId || !booking.completedAt) {
      return undefined;
    }

    const completedAtMs = new Date(booking.completedAt).getTime();
    const now = new Date(Date.now());
    const daysSinceCompleted = Math.max(
      0,
      Math.floor((Date.now() - completedAtMs) / (24 * 60 * 60 * 1000))
    );
    const categoryLabel = this.titleCaseCategory(booking.category).toLowerCase();
    const completedCategoryCount = completedBookingsForCategory.length;
    const sameProviderCompletedCount = completedBookingsForCategory.filter(
      (candidate) => candidate.providerId === booking.providerId
    ).length;
    const loyaltySegment =
      sameProviderCompletedCount >= 2
        ? "provider-loyal"
        : completedCategoryCount >= 2
          ? "repeat-customer"
          : "new-repeat";
    const lastServiceGapDays =
      completedBookingsForCategory[1]?.completedAt
        ? Math.max(
            0,
            Math.floor(
              (new Date(completedBookingsForCategory[0]!.completedAt!).getTime() -
                new Date(completedBookingsForCategory[1]!.completedAt!).getTime()) /
                (24 * 60 * 60 * 1000)
            )
          )
        : undefined;

    if (booking.category === "lawn-mowing" && !hasActiveRecurringPlan && daysSinceCompleted <= 21) {
      const recommendedCadence =
        completedCategoryCount >= 2 &&
        lastServiceGapDays !== undefined &&
        lastServiceGapDays >= 10 &&
        lastServiceGapDays <= 18
          ? "biweekly"
          : "weekly";
      const strategyKey =
        recommendedCadence === "biweekly"
          ? "lawn-mowing-biweekly-repeat"
          : "lawn-mowing-recurring";
      const cadenceLabel = recommendedCadence === "biweekly" ? "every 2 weeks" : "weekly";
      const title =
        recommendedCadence === "biweekly"
          ? "Keep this yard on an every-2-weeks route"
          : "Keep this lawn on schedule";
      const loyaltyLine =
        loyaltySegment === "provider-loyal"
          ? ` You've already completed ${sameProviderCompletedCount} lawn mowing visits with ${providerName} at this property, so GreenRain can keep the same relationship while making the schedule easier to repeat.`
          : loyaltySegment === "repeat-customer"
            ? ` You've already booked ${completedCategoryCount} lawn mowing visits here, so this is a good moment to stop re-requesting the same service manually.`
            : "";
      return {
        id: `${booking.id}:start-recurring-plan`,
        sourceBookingId: booking.id,
        propertyId: booking.servicePropertyId,
        providerId: booking.providerId,
        providerName,
        category: booking.category,
        completedAt: booking.completedAt,
        daysSinceCompleted,
        completedCategoryCount,
        sameProviderCompletedCount,
        loyaltySegment,
        lastServiceGapDays,
        kind: "start-recurring-plan",
        strategyKey,
        trigger: "recent-completion",
        title,
        message: `${providerName} finished the last lawn mowing visit on ${this.formatShortDate(booking.completedAt)}. GreenRain can recommend the next route again or turn it into an ${cadenceLabel} plan so this service stays on schedule instead of becoming a one-off scramble.${loyaltyLine}`,
        actionLabel: recommendedCadence === "biweekly" ? "Set up biweekly mowing" : "Set up recurring mowing",
        recommendedCadence
      };
    }

    if (booking.category === "seasonal-cleanup" && daysSinceCompleted >= 30) {
      return {
        id: `${booking.id}:seasonal-cleanup-follow-up`,
        sourceBookingId: booking.id,
        propertyId: booking.servicePropertyId,
        providerId: booking.providerId,
        providerName,
        category: booking.category,
        completedAt: booking.completedAt,
        daysSinceCompleted,
        completedCategoryCount,
        sameProviderCompletedCount,
        loyaltySegment,
        lastServiceGapDays,
        kind: "rebook-service",
        strategyKey: "seasonal-cleanup-follow-up",
        trigger: "30-day-follow-up",
        title: "Plan the next cleanup pass",
        message: `${providerName} completed the last seasonal cleanup on ${this.formatShortDate(booking.completedAt)}. If the property is starting to drift again, GreenRain can price the next cleanup and recommend the best route without rebuilding the request from scratch.${loyaltySegment === "provider-loyal" ? ` You've already trusted ${providerName} for ${sameProviderCompletedCount} cleanup visits here.` : ""}`,
        actionLabel: "Book cleanup again",
        recommendedCadence: "one-time"
      };
    }

    if (booking.category === "hedge-trimming" && daysSinceCompleted >= 60) {
      return {
        id: `${booking.id}:hedge-trimming-reminder`,
        sourceBookingId: booking.id,
        propertyId: booking.servicePropertyId,
        providerId: booking.providerId,
        providerName,
        category: booking.category,
        completedAt: booking.completedAt,
        daysSinceCompleted,
        completedCategoryCount,
        sameProviderCompletedCount,
        loyaltySegment,
        lastServiceGapDays,
        kind: "rebook-service",
        strategyKey: "hedge-trimming-reminder",
        trigger: "60-day-follow-up",
        title: "Refresh the hedge line",
        message: `${providerName} handled the last hedge trimming visit on ${this.formatShortDate(booking.completedAt)}. If the shape is starting to soften again, GreenRain can reload the recommendation and timing from the same property.${loyaltySegment === "provider-loyal" ? ` This property already has ${sameProviderCompletedCount} hedge visits with the same provider.` : ""}`,
        actionLabel: "Book hedge trimming again",
        recommendedCadence: "one-time"
      };
    }

    if (
      booking.category === "mulch-installation" &&
      this.isSpringSeasonWindow(now) &&
      daysSinceCompleted >= 240 &&
      daysSinceCompleted <= 430
    ) {
      return {
        id: `${booking.id}:mulch-refresh-spring`,
        sourceBookingId: booking.id,
        propertyId: booking.servicePropertyId,
        providerId: booking.providerId,
        providerName,
        category: booking.category,
        completedAt: booking.completedAt,
        daysSinceCompleted,
        completedCategoryCount,
        sameProviderCompletedCount,
        loyaltySegment,
        lastServiceGapDays,
        kind: "rebook-service",
        strategyKey: "mulch-refresh-spring",
        trigger: "spring-season-window",
        title: "Refresh the mulch before the season starts",
        message: `${providerName} completed the last mulch installation on ${this.formatShortDate(booking.completedAt)}. Spring is a good time to refresh beds before growth and weeds make the property feel behind.${loyaltySegment === "provider-loyal" ? ` You've already used ${providerName} for ${sameProviderCompletedCount} mulch visits here, so GreenRain can reload a familiar recommendation.` : ""}`,
        actionLabel: "Book mulch refresh",
        recommendedCadence: "one-time"
      };
    }

    if (
      booking.category === "leaf-blowing" &&
      this.isFallSeasonWindow(now) &&
      daysSinceCompleted >= 240 &&
      daysSinceCompleted <= 430
    ) {
      return {
        id: `${booking.id}:leaf-blowing-fall-return`,
        sourceBookingId: booking.id,
        propertyId: booking.servicePropertyId,
        providerId: booking.providerId,
        providerName,
        category: booking.category,
        completedAt: booking.completedAt,
        daysSinceCompleted,
        completedCategoryCount,
        sameProviderCompletedCount,
        loyaltySegment,
        lastServiceGapDays,
        kind: "rebook-service",
        strategyKey: "leaf-blowing-fall-return",
        trigger: "fall-season-window",
        title: "Get ahead of the next leaf cycle",
        message: `${providerName} handled the last leaf blowing visit on ${this.formatShortDate(booking.completedAt)}. Fall cleanups get easier when the route is lined up before the heavier leaf drop starts.${loyaltySegment === "provider-loyal" ? ` This property already has ${sameProviderCompletedCount} leaf visits with the same provider.` : ""}`,
        actionLabel: "Book leaf blowing again",
        recommendedCadence: "one-time"
      };
    }

    if (
      booking.category === "fertilization" &&
      this.isSpringSeasonWindow(now) &&
      daysSinceCompleted >= 150 &&
      daysSinceCompleted <= 430
    ) {
      return {
        id: `${booking.id}:fertilization-spring-return`,
        sourceBookingId: booking.id,
        propertyId: booking.servicePropertyId,
        providerId: booking.providerId,
        providerName,
        category: booking.category,
        completedAt: booking.completedAt,
        daysSinceCompleted,
        completedCategoryCount,
        sameProviderCompletedCount,
        loyaltySegment,
        lastServiceGapDays,
        kind: "rebook-service",
        strategyKey: "fertilization-spring-return",
        trigger: "spring-season-window",
        title: "Line up a spring fertilization visit",
        message: `${providerName} completed the last fertilization visit on ${this.formatShortDate(booking.completedAt)}. Spring is usually the cleanest time to restart lawn treatments before growth and weeds get ahead.${loyaltySegment === "provider-loyal" ? ` You've already used ${providerName} for ${sameProviderCompletedCount} fertilization visits here.` : ""}`,
        actionLabel: "Book fertilization again",
        recommendedCadence: "one-time"
      };
    }

    if (
      booking.category === "aeration" &&
      this.isFallSeasonWindow(now) &&
      daysSinceCompleted >= 150 &&
      daysSinceCompleted <= 430
    ) {
      return {
        id: `${booking.id}:aeration-fall-return`,
        sourceBookingId: booking.id,
        propertyId: booking.servicePropertyId,
        providerId: booking.providerId,
        providerName,
        category: booking.category,
        completedAt: booking.completedAt,
        daysSinceCompleted,
        completedCategoryCount,
        sameProviderCompletedCount,
        loyaltySegment,
        lastServiceGapDays,
        kind: "rebook-service",
        strategyKey: "aeration-fall-return",
        trigger: "fall-season-window",
        title: "Plan fall aeration before the turf slows down",
        message: `${providerName} completed the last aeration visit on ${this.formatShortDate(booking.completedAt)}. Fall is usually the strongest window to reopen the lawn before colder weather and dormant growth set in.${loyaltySegment === "provider-loyal" ? ` This property already has ${sameProviderCompletedCount} aeration visits with the same provider.` : ""}`,
        actionLabel: "Book aeration again",
        recommendedCadence: "one-time"
      };
    }

    if (
      booking.category === "gutter-cleaning" &&
      this.isFallGutterSeasonWindow(now) &&
      daysSinceCompleted >= 150 &&
      daysSinceCompleted <= 430
    ) {
      return {
        id: `${booking.id}:gutter-cleaning-fall-prep`,
        sourceBookingId: booking.id,
        propertyId: booking.servicePropertyId,
        providerId: booking.providerId,
        providerName,
        category: booking.category,
        completedAt: booking.completedAt,
        daysSinceCompleted,
        completedCategoryCount,
        sameProviderCompletedCount,
        loyaltySegment,
        lastServiceGapDays,
        kind: "rebook-service",
        strategyKey: "gutter-cleaning-fall-prep",
        trigger: "fall-season-window",
        title: "Clear gutters before late-season weather",
        message: `${providerName} completed the last gutter cleaning on ${this.formatShortDate(booking.completedAt)}. Late fall is a good time to clear rooflines before leaf buildup turns into overflow, ice, or messy winter runoff.${loyaltySegment === "provider-loyal" ? ` This property already has ${sameProviderCompletedCount} gutter visits with the same provider.` : ""}`,
        actionLabel: "Book gutter cleaning again",
        recommendedCadence: "one-time"
      };
    }

    if (this.isWinterRetentionCategory(booking.category) && this.isWinterSeasonWindow(now)) {
      const snowStrategyKey =
        booking.category === "snow-blowing"
          ? "snow-blowing-winter-ready"
          : booking.category === "ice-melt-salting"
            ? "ice-melt-salting-winter-ready"
            : "snow-shoveling-winter-ready";
      const serviceName =
        booking.category === "ice-melt-salting"
          ? "ice melt salting"
          : booking.category === "snow-blowing"
            ? "snow blowing"
            : "snow shoveling";

      if (daysSinceCompleted >= 7 && daysSinceCompleted <= 430) {
        return {
          id: `${booking.id}:${snowStrategyKey}`,
          sourceBookingId: booking.id,
          propertyId: booking.servicePropertyId,
          providerId: booking.providerId,
          providerName,
          category: booking.category,
          completedAt: booking.completedAt,
          daysSinceCompleted,
          completedCategoryCount,
          sameProviderCompletedCount,
          loyaltySegment,
          lastServiceGapDays,
          kind: "rebook-service",
          strategyKey: snowStrategyKey,
          trigger: "winter-season-window",
          title:
            booking.category === "ice-melt-salting"
              ? "Keep ice treatment ready"
              : "Keep winter service ready",
          message: `${providerName} handled the last ${serviceName} visit on ${this.formatShortDate(booking.completedAt)}. During the winter window, GreenRain can re-check provider availability and reload a fresh recommendation before the next storm or freeze.${loyaltySegment === "provider-loyal" ? ` You've already trusted ${providerName} for ${sameProviderCompletedCount} winter visits here.` : ""}`,
          actionLabel:
            booking.category === "ice-melt-salting"
              ? "Book ice treatment again"
              : `Book ${serviceName} again`,
          recommendedCadence: "one-time"
        };
      }
    }

    if (daysSinceCompleted >= 90) {
      return {
        id: `${booking.id}:general-90-day-rebook`,
        sourceBookingId: booking.id,
        propertyId: booking.servicePropertyId,
        providerId: booking.providerId,
        providerName,
        category: booking.category,
        completedAt: booking.completedAt,
        daysSinceCompleted,
        completedCategoryCount,
        sameProviderCompletedCount,
        loyaltySegment,
        lastServiceGapDays,
        kind: "rebook-service",
        strategyKey: "general-90-day-rebook",
        trigger: "90-day-follow-up",
        title: `Book ${categoryLabel} again`,
        message: `${providerName} completed the last ${categoryLabel} visit on ${this.formatShortDate(booking.completedAt)}. If it is time to line up the next pass, GreenRain can re-price the work and reload a fresh recommendation from the same property.`,
        actionLabel: `Book ${categoryLabel} again`,
        recommendedCadence: "one-time"
      };
    }

    return undefined;
  }

  public async setDefaultCustomerProperty(
    customerId: string,
    payload: SetDefaultCustomerPropertyRequest
  ): Promise<CustomerProfile> {
    const customer = await this.repository.findCustomerById(customerId);

    if (!customer) {
      throw new Error("Customer not found");
    }

    const property = customer.properties.find((item) => item.id === payload.propertyId);
    if (!property) {
      throw new Error("Property not found");
    }

    const properties = this.propertyBook.setDefaultProperty(customer.properties, payload.propertyId);
    const updatedCustomer = await this.repository.updateCustomer(customer.id, {
      properties,
      defaultPropertyId: payload.propertyId,
      address: property.address,
      lawnSizeSqFt: property.lawnSizeSqFt ?? customer.lawnSizeSqFt,
      propertyNotes: property.accessNotes ?? customer.propertyNotes
    });

    if (!updatedCustomer) {
      throw new Error("Customer could not be updated");
    }

    this.analytics.record({
      id: crypto.randomUUID(),
      name: MarketplaceTelemetryEventCatalog.customerDefaultPropertyChanged,
      actorId: customer.id,
      occurredAt: new Date().toISOString(),
      properties: {
        propertyId: payload.propertyId,
        city: property.address.city
      }
    });

    return updatedCustomer;
  }

  public async listBookingsForUser(actor: AuthIdentityRecord): Promise<Booking[]> {
    const bookings = await this.repository.listBookings();
    if (actor.role === "customer") {
      return bookings.filter((booking) => booking.customerId === actor.userId);
    }

    if (actor.role === "provider") {
      return bookings.filter((booking) => booking.providerId === actor.userId);
    }

    return [];
  }

  public async updateBookingAddress(
    customerId: string,
    payload: UpdateBookingAddressRequest
  ): Promise<UpdateBookingAddressResponse> {
    const booking = await this.repository.findBookingById(payload.bookingId);
    if (!booking) {
      throw new Error("Booking not found");
    }

    if (booking.customerId !== customerId) {
      throw new Error("Only the booking customer can request an address change");
    }

    const customer = await this.repository.findCustomerById(customerId);
    if (!customer) {
      throw new Error("Customer not found");
    }

    const selectedProperty = payload.newPropertyId
      ? customer.properties.find((property) => property.id === payload.newPropertyId)
      : undefined;

    if (payload.newPropertyId && !selectedProperty) {
      throw new Error("Selected property does not belong to the customer");
    }

    const requestedAddress = selectedProperty
      ? selectedProperty.address
      : (await this.normalizeValidateAndResolveCustomerAddress(payload.newAddress, customer)).address;

    const provider = await this.repository.findProviderById(booking.providerId);
    if (!provider) {
      throw new Error("Provider not found");
    }

    const evaluation = this.bookingAddressPolicy.evaluateAddressChange({
      booking,
      provider,
      newAddress: requestedAddress
    });

    const historyEntry = this.bookingAddressPolicy.buildAddressChangeHistoryEntry({
      bookingId: booking.id,
      customerId,
      previousAddress: booking.serviceAddress,
      requestedAddress: requestedAddress,
      requestedPropertyId: payload.newPropertyId,
      outcome: evaluation.outcome,
      reason: evaluation.reason
    });

    const nextHistory = [...booking.addressChangeHistory, historyEntry];
    const updatedBooking =
      evaluation.outcome === "updated"
        ? await this.repository.updateBooking(booking.id, {
            serviceAddress: requestedAddress,
            servicePropertyId: payload.newPropertyId,
            addressChangeHistory: nextHistory
          })
        : await this.repository.updateBooking(booking.id, {
            addressChangeHistory: nextHistory
          });

    if (!updatedBooking) {
      throw new Error("Booking could not be updated");
    }

    const eventName =
      evaluation.outcome === "updated"
        ? MarketplaceTelemetryEventCatalog.bookingAddressChanged
        : evaluation.outcome === "requires-provider-review"
          ? MarketplaceTelemetryEventCatalog.bookingAddressChangePendingReview
          : MarketplaceTelemetryEventCatalog.bookingAddressChangeBlocked;

    this.analytics.record({
      id: crypto.randomUUID(),
      name: eventName,
      actorId: customerId,
      occurredAt: new Date().toISOString(),
      properties: {
        bookingId: booking.id,
        providerId: booking.providerId,
        outcome: evaluation.outcome,
        reason: evaluation.reason
      }
    });

    return {
      booking: updatedBooking,
      outcome: evaluation.outcome,
      reason: evaluation.reason
    };
  }

  public async listPaymentsForUser(actor: AuthIdentityRecord): Promise<PaymentRecord[]> {
    const [payments, bookings, matches] = await Promise.all([
      this.repository.listPayments(),
      this.repository.listBookings(),
      actor.role === "crew-member" ? this.repository.listCrewMatches() : Promise.resolve([])
    ]);

    return payments
      .filter((payment) => {
        const booking = bookings.find((candidate) => candidate.id === payment.bookingId);
        if (!booking) {
          return false;
        }

        if (actor.role === "customer") {
          return booking.customerId === actor.userId;
        }

        if (actor.role === "provider") {
          return booking.providerId === actor.userId;
        }

        return matches.some(
          (match) =>
            match.bookingId === booking.id &&
            match.crewMemberId === actor.userId &&
            match.status === "accepted"
        );
      })
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  public async getProviderPayoutLedger(providerId: string): Promise<ProviderPayoutLedgerResponse> {
    const provider = await this.repository.findProviderById(providerId);
    if (!provider) {
      throw new HttpError(404, "Provider not found");
    }

    const [bookings, payments, matches, customers] = await Promise.all([
      this.repository.listBookings(),
      this.repository.listPayments(),
      this.repository.listCrewMatches(),
      this.repository.listCustomers()
    ]);
    const providerBookings = bookings.filter(
      (booking) => booking.providerId === providerId && this.isPayoutRelevantBooking(booking)
    );
    const settlementPairs = await Promise.all(
      providerBookings.map(async (booking) => {
        const payment = payments.find(
          (candidate) => candidate.bookingId === booking.id && candidate.status === "captured"
        );
        const settlement = payment
          ? await this.ensureBookingFinancialSettlement(booking, payment)
          : await this.repository.findBookingFinancialSettlement(booking.id);
        return [booking.id, settlement] as const;
      })
    );
    const settlementByBookingId = new Map(settlementPairs);

    const entries = providerBookings
      .map((booking) => {
        const payment = payments.find((candidate) => candidate.bookingId === booking.id);
        const acceptedMatches = matches.filter(
          (match) => match.bookingId === booking.id && match.status === "accepted"
        );
        const customer = customers.find((candidate) => candidate.id === booking.customerId);
        const settlement = settlementByBookingId.get(booking.id);
        const crewShareCents = 0;
        const payoutStatus = this.getPayoutLedgerStatus(booking, payment);
        const availableAtIso = this.getPayoutAvailabilityIso(booking, payoutStatus);
        const providerNetAmountCents = settlement?.providerNetCents ?? booking.totalCents;

        const entry: ProviderPayoutLedgerEntry = {
          id: `provider-payout-${booking.id}`,
          bookingId: booking.id,
          customerName: customer?.fullName ?? "Customer",
          serviceDateIso: booking.scheduledStartIso,
          serviceLabel: this.titleCaseCategory(booking.category),
          addressLine: this.formatAddressLine(booking.serviceAddress),
          grossAmountCents: booking.totalCents,
          crewShareCents,
          finderFeeCents: settlement?.finderFeeCents,
          completedJobFeeCents: settlement?.completedJobFeeCents,
          platformFeeCents: settlement?.platformGrossRevenueCents,
          economicsPolicyVersion: settlement?.policyVersion,
          providerNetAmountCents,
          crewMembersAssigned: acceptedMatches.length,
          paymentId: payment?.id,
          paymentStatus: payment?.status,
          status: payoutStatus,
          availableAtIso,
          note: this.buildProviderPayoutNote(booking, payoutStatus, payment, acceptedMatches.length)
        };

        return entry;
      })
      .sort((left, right) => right.serviceDateIso.localeCompare(left.serviceDateIso));

    return {
      providerId,
      totalGrossCapturedCents: entries
        .filter((entry) => entry.paymentStatus === "captured")
        .reduce((sum, entry) => sum + entry.grossAmountCents, 0),
      totalNetReadyCents: entries
        .filter((entry) => entry.status === "ready")
        .reduce((sum, entry) => sum + entry.providerNetAmountCents, 0),
      totalNetScheduledCents: entries
        .filter((entry) => entry.status === "scheduled")
        .reduce((sum, entry) => sum + entry.providerNetAmountCents, 0),
      totalCrewOwedCents: entries
        .filter((entry) => entry.status !== "reversed")
        .reduce((sum, entry) => sum + entry.crewShareCents, 0),
      pendingCustomerPaymentCents: entries
        .filter((entry) => entry.status === "awaiting-customer-payment")
        .reduce((sum, entry) => sum + entry.grossAmountCents, 0),
      payoutSchedule: this.buildProviderPayoutScheduleSummary(provider, entries),
      entries
    };
  }

  public async getCrewPayoutLedger(crewMemberId: string): Promise<CrewPayoutLedgerResponse> {
    const crewMember = await this.repository.findCrewMemberById(crewMemberId);
    if (!crewMember) {
      throw new HttpError(404, "Crew member not found");
    }

    const [matches, bookings, payments] = await Promise.all([
      this.repository.listCrewMatches(),
      this.repository.listBookings(),
      this.repository.listPayments()
    ]);

    // YardMatch does not accrue, hold, or disburse crew wages. Crew members are
    // engaged and paid by their provider business under the launch responsibility model.
    const entries: CrewPayoutLedgerEntry[] = [];
    const nextWeeklyPayoutDateIso = this.getNextPayoutRunIso(this.crewPayoutWeekday);
    const crewMatches = matches.filter((match) => match.crewMemberId === crewMemberId);
    const attendanceSummary = this.buildCrewAttendanceSummary(crewMember, crewMatches, bookings);
    const earningsSummary = this.buildCrewEarningsSummary(
      entries,
      nextWeeklyPayoutDateIso,
      attendanceSummary.completedAssignmentCount
    );
    const performanceSummary = this.buildCrewPerformanceSummary(crewMember, crewMatches, bookings, payments);

    return {
      crewMemberId,
      totalReadyCents: entries
        .filter((entry) => entry.status === "ready")
        .reduce((sum, entry) => sum + entry.amountCents, 0),
      totalScheduledCents: entries
        .filter((entry) => entry.status === "scheduled")
        .reduce((sum, entry) => sum + entry.amountCents, 0),
      totalPaidCents: entries
        .filter((entry) => entry.status === "paid")
        .reduce((sum, entry) => sum + entry.amountCents, 0),
      pendingCustomerPaymentCents: entries
        .filter((entry) => entry.status === "awaiting-customer-payment")
        .reduce((sum, entry) => sum + entry.amountCents, 0),
      nextWeeklyPayoutDateIso,
      holdPeriodHours: this.payoutHoldHours,
      earningsSummary,
      attendanceSummary,
      performanceSummary,
      entries
    };
  }

  private buildCrewEarningsSummary(
    entries: CrewPayoutLedgerEntry[],
    nextWeeklyPayoutDateIso: string,
    completedAssignmentCount: number
  ): CrewPayoutLedgerResponse["earningsSummary"] {
    const readyCents = entries
      .filter((entry) => entry.status === "ready")
      .reduce((sum, entry) => sum + entry.amountCents, 0);
    const scheduledCents = entries
      .filter((entry) => entry.status === "scheduled")
      .reduce((sum, entry) => sum + entry.amountCents, 0);
    const pendingCustomerPaymentCents = entries
      .filter((entry) => entry.status === "awaiting-customer-payment")
      .reduce((sum, entry) => sum + entry.amountCents, 0);
    const onHoldCents = entries
      .filter((entry) => entry.status === "on-hold")
      .reduce((sum, entry) => sum + entry.amountCents, 0);
    const reversedCents = entries
      .filter((entry) => entry.status === "reversed")
      .reduce((sum, entry) => sum + entry.amountCents, 0);
    const guidance = [
      "YardMatch does not employ, contract, or pay individual crew members at launch.",
      "The provider business that accepts and supervises a crew member is responsible for compensation, payroll or contractor reporting, insurance, and workplace compliance.",
      "Use the assignment and attendance history for operational records; confirm pay details directly with the provider business before accepting work."
    ];

    return {
      completedAssignmentCount,
      readyCents,
      scheduledCents,
      pendingCustomerPaymentCents,
      onHoldCents,
      reversedCents,
      nextWeeklyPayoutDateIso,
      holdPeriodHours: this.payoutHoldHours,
      guidance
    };
  }

  private buildCrewAttendanceSummary(
    crewMember: CrewMemberProfile,
    matches: CrewMatchCandidate[],
    bookings: Booking[]
  ): CrewPayoutLedgerResponse["attendanceSummary"] {
    const acceptedMatches = matches.filter((match) => match.status === "accepted");
    const cancelledMatches = matches.filter((match) => match.status === "cancelled-by-crew");
    const acceptedBookingIds = new Set(acceptedMatches.map((match) => match.bookingId));
    const activeAssignmentCount = bookings.filter(
      (booking) =>
        acceptedBookingIds.has(booking.id) &&
        booking.status !== "completed" &&
        booking.status !== "cancelled" &&
        booking.status !== "refunded"
    ).length;
    const completedAssignmentCount = bookings.filter(
      (booking) => acceptedBookingIds.has(booking.id) && this.isPayoutRelevantBooking(booking)
    ).length;
    const totalDecisionCount = acceptedMatches.length + cancelledMatches.length;
    const attendanceRate = totalDecisionCount > 0 ? acceptedMatches.length / totalDecisionCount : 1;
    const cancellationCount = crewMember.cancellationCount ?? cancelledMatches.length;
    const reliabilityStatus =
      cancellationCount >= 3 || (totalDecisionCount >= 3 && attendanceRate < 0.75)
        ? "at-risk"
        : cancellationCount > 0 || (totalDecisionCount >= 2 && attendanceRate < 0.9)
          ? "watch"
          : "strong";
    const warnings: string[] = [];

    if (cancelledMatches.length > 0) {
      warnings.push(`${cancelledMatches.length} cancelled assignment${cancelledMatches.length === 1 ? "" : "s"} are recorded in attendance history.`);
    }
    if (cancellationCount >= 3) {
      warnings.push("Repeated call-offs can reduce future staffing priority until the crew member rebuilds reliability.");
    } else if (cancellationCount > 0) {
      warnings.push("Recent call-offs can lower future match priority for tight launch routes.");
    }
    if (activeAssignmentCount > 0) {
      warnings.push(`${activeAssignmentCount} accepted assignment${activeAssignmentCount === 1 ? "" : "s"} are still active and not yet reflected as completed earnings.`);
    }

    return {
      acceptedAssignmentCount: acceptedMatches.length,
      activeAssignmentCount,
      completedAssignmentCount,
      cancelledAssignmentCount: cancelledMatches.length,
      cancellationCount,
      lastCancellationAt: crewMember.lastCancellationAt,
      attendanceRate,
      reliabilityStatus,
      warnings
    };
  }

  private buildCrewPerformanceSummary(
    crewMember: CrewMemberProfile,
    matches: CrewMatchCandidate[],
    bookings: Booking[],
    payments: PaymentRecord[]
  ): CrewPayoutLedgerResponse["performanceSummary"] {
    const acceptedBookingIds = new Set(
      matches.filter((match) => match.status === "accepted").map((match) => match.bookingId)
    );
    const completedBookings = bookings.filter(
      (booking) => acceptedBookingIds.has(booking.id) && this.isPayoutRelevantBooking(booking)
    );
    const paymentByBookingId = new Map(payments.map((payment) => [payment.bookingId, payment]));
    const crewEvidence = completedBookings.flatMap((booking) =>
      booking.serviceEvidence.filter(
        (evidence) => evidence.capturedByRole === "crew-member" && evidence.capturedByUserId === crewMember.id
      )
    );
    const disputedAssignmentCount = completedBookings.filter(
      (booking) => Boolean(booking.disputedAt) || booking.status === "disputed"
    ).length;
    const refundedAssignmentCount = completedBookings.filter((booking) => {
      const payment = paymentByBookingId.get(booking.id);
      return booking.status === "refunded" || payment?.status === "refunded";
    }).length;
    const completedWithoutIssueCount = completedBookings.filter((booking) => {
      const payment = paymentByBookingId.get(booking.id);
      return (
        !booking.disputedAt &&
        booking.status !== "disputed" &&
        booking.status !== "refunded" &&
        payment?.status !== "refunded"
      );
    }).length;
    const routeConfirmationCount = completedBookings.filter((booking) => Boolean(booking.onRouteConfirmedAt)).length;
    const beforeEvidenceCount = crewEvidence.filter((evidence) => evidence.phase === "before").length;
    const afterEvidenceCount = crewEvidence.filter((evidence) => evidence.phase === "after").length;
    const reviewedEvidenceCount = crewEvidence.filter((evidence) => Boolean(evidence.reviewStatus)).length;
    const providerCount = new Set(completedBookings.map((booking) => booking.providerId)).size;
    const serviceCategories = Array.from(new Set(completedBookings.map((booking) => booking.category))).sort();
    const cancellationCount =
      crewMember.cancellationCount ?? matches.filter((match) => match.status === "cancelled-by-crew").length;
    const highlights: string[] = [];
    const warnings: string[] = [];

    if (completedBookings.length > 0) {
      highlights.push(
        `${completedBookings.length} completed assignment${completedBookings.length === 1 ? "" : "s"} are tied to this crew profile.`
      );
    } else {
      warnings.push("No completed assignments are available yet, so performance is still in the launch baseline stage.");
    }
    if (completedWithoutIssueCount > 0) {
      highlights.push(
        `${completedWithoutIssueCount} completed assignment${completedWithoutIssueCount === 1 ? "" : "s"} closed without a dispute or refund reversal.`
      );
    }
    if (routeConfirmationCount > 0) {
      highlights.push(
        `${routeConfirmationCount} completed assignment${routeConfirmationCount === 1 ? "" : "s"} include on-route confirmation.`
      );
    }
    if (crewEvidence.length > 0) {
      highlights.push(
        `${crewEvidence.length} crew-captured evidence item${crewEvidence.length === 1 ? "" : "s"} support service follow-through.`
      );
    }
    if (providerCount > 1) {
      highlights.push(`Assignments span ${providerCount} providers, which can broaden launch staffing confidence.`);
    }

    if (disputedAssignmentCount > 0) {
      warnings.push(
        `${disputedAssignmentCount} completed assignment${disputedAssignmentCount === 1 ? "" : "s"} have dispute history and should be reviewed before assigning tight launch routes.`
      );
    }
    if (refundedAssignmentCount > 0) {
      warnings.push(
        `${refundedAssignmentCount} assignment${refundedAssignmentCount === 1 ? "" : "s"} ended in a refund reversal, so ops should review context before raising priority.`
      );
    }
    if (completedBookings.length > 0 && routeConfirmationCount === 0) {
      warnings.push("Completed assignments do not yet show route confirmation history.");
    }
    if (completedBookings.length > 0 && crewEvidence.length === 0) {
      warnings.push("Completed assignments do not yet include crew-captured evidence.");
    }
    if (cancellationCount > 0) {
      warnings.push(`${cancellationCount} crew call-off${cancellationCount === 1 ? "" : "s"} remain part of the performance record.`);
    }

    const performanceStatus =
      disputedAssignmentCount > 0 || refundedAssignmentCount > 0 || cancellationCount >= 3
        ? "needs-review"
        : completedBookings.length === 0 ||
            cancellationCount > 0 ||
            routeConfirmationCount === 0 ||
            crewEvidence.length === 0
          ? "building"
          : "strong";

    return {
      completedAssignmentCount: completedBookings.length,
      completedWithoutIssueCount,
      disputedAssignmentCount,
      refundedAssignmentCount,
      routeConfirmationCount,
      evidenceContributionCount: crewEvidence.length,
      beforeEvidenceCount,
      afterEvidenceCount,
      reviewedEvidenceCount,
      providerCount,
      serviceCategories,
      performanceStatus,
      highlights,
      warnings
    };
  }

  public async getOpsPayoutPreview(): Promise<OpsPayoutRunPreviewResponse> {
    const [providers, bookings, payments] = await Promise.all([
      this.repository.listProviders(),
      this.repository.listBookings(),
      this.repository.listPayments()
    ]);
    type DisbursementEntryRef = OpsPayoutRunPreviewResponse["disbursementBatches"][number]["entries"][number];
    type MutableDisbursementBatch = {
      id: string;
      runDateIso: string;
      recipientRole: OpsPayoutRunPreviewResponse["disbursementBatches"][number]["recipientRole"];
      railMode: OpsPayoutRunPreviewResponse["disbursementBatches"][number]["railMode"];
      actionStatus: OpsPayoutRunPreviewResponse["disbursementBatches"][number]["actionStatus"];
      totalCents: number;
      recipientIds: Set<string>;
      bookingIds: Set<string>;
      entryIds: string[];
      entries: DisbursementEntryRef[];
      blockerReasons: string[];
      manualActionLabel: string;
      auditInstructions: string[];
    };

    const providerRuns = new Map<
      string,
      {
        runDateIso: string;
        providerIds: Set<string>;
        bookingIds: Set<string>;
        providerNetCents: number;
        crewShareCents: number;
      }
    >();
    const disbursementBatches = new Map<string, MutableDisbursementBatch>();
    const crewNextWeeklyPayoutDateIso = this.getNextPayoutRunIso(this.crewPayoutWeekday);
    const touchDisbursementBatch = (
      id: string,
      runDateIso: string,
      recipientRole: MutableDisbursementBatch["recipientRole"]
    ) => {
      const existing = disbursementBatches.get(id);
      if (existing) {
        return existing;
      }

      const batch: MutableDisbursementBatch = {
        id,
        runDateIso,
        recipientRole,
        railMode: "manual-preview",
        actionStatus: recipientRole === "provider" ? "ready-for-manual-review" : "blocked",
        totalCents: 0,
        recipientIds: new Set<string>(),
        bookingIds: new Set<string>(),
        entryIds: [],
        entries: [],
        blockerReasons:
          recipientRole === "provider"
            ? [
                "External payout rails are not configured yet, so ops must execute and reconcile this batch manually."
              ]
            : [
                "YardMatch does not create crew transfers; the provider business is responsible for crew compensation."
              ],
        manualActionLabel:
          recipientRole === "provider"
            ? "Review provider payout batch"
            : "Blocked legacy crew transfer",
        auditInstructions: [
          "Confirm every entry still has captured customer payment before disbursement.",
          "Confirm no refund review, completed-job dispute, or support hold opened after this preview was generated.",
          "Record the external transfer id, recipient, amount, and operator in the financial runbook until payout rails are integrated."
        ]
      };
      disbursementBatches.set(id, batch);
      return batch;
    };
    const addDisbursementEntry = (
      batch: MutableDisbursementBatch,
      entry: DisbursementEntryRef
    ) => {
      batch.totalCents += entry.amountCents;
      batch.recipientIds.add(entry.recipientId);
      batch.bookingIds.add(entry.bookingId);
      batch.entryIds.push(entry.entryId);
      batch.entries.push(entry);
    };

    let totalProviderReadyCents = 0;
    let totalCrewReadyCents = 0;
    let totalAwaitingCustomerPaymentCents = 0;
    let onHoldEntryCount = 0;
    let providerInstantEligibleCount = 0;

    for (const provider of providers) {
      const providerBookings = bookings.filter(
        (booking) => booking.providerId === provider.id && this.isPayoutRelevantBooking(booking)
      );
      const nextRunIso = this.getNextPayoutRunIso(provider.weeklyPayoutDay);
      let providerInstantEligibleCents = 0;

      for (const booking of providerBookings) {
        const payment =
          payments.find(
            (candidate) => candidate.bookingId === booking.id && candidate.status === "captured"
          ) ?? payments.find((candidate) => candidate.bookingId === booking.id);
        const settlement = payment
          ? await this.ensureBookingFinancialSettlement(booking, payment)
          : await this.repository.findBookingFinancialSettlement(booking.id);
        const crewShareCents = 0;
        const providerNetAmountCents = settlement?.providerNetCents ?? booking.totalCents;
        const payoutStatus = this.getPayoutLedgerStatus(booking, payment);

        if (payoutStatus === "ready") {
          totalProviderReadyCents += providerNetAmountCents;
          providerInstantEligibleCents += providerNetAmountCents;

          const run = providerRuns.get(nextRunIso) ?? {
            runDateIso: nextRunIso,
            providerIds: new Set<string>(),
            bookingIds: new Set<string>(),
            providerNetCents: 0,
            crewShareCents: 0
          };
          run.providerIds.add(provider.id);
          run.bookingIds.add(booking.id);
          run.providerNetCents += providerNetAmountCents;
          run.crewShareCents += crewShareCents;
          providerRuns.set(nextRunIso, run);
          if (providerNetAmountCents > 0) {
            addDisbursementEntry(
              touchDisbursementBatch(
                `provider-manual-${nextRunIso.slice(0, 10)}`,
                nextRunIso,
                "provider"
              ),
              {
                entryId: `provider-payout-${booking.id}`,
                bookingId: booking.id,
                recipientId: provider.id,
                recipientRole: "provider",
                amountCents: providerNetAmountCents,
                paymentId: payment?.id,
                availableAtIso: this.getPayoutAvailabilityIso(booking, payoutStatus)
              }
            );
          }
        } else if (payoutStatus === "awaiting-customer-payment") {
          totalAwaitingCustomerPaymentCents += booking.totalCents;
        } else if (payoutStatus === "on-hold") {
          onHoldEntryCount += 1;
        }
      }

      if (
        provider.instantPayoutsEnabled &&
        providerInstantEligibleCents >= this.instantPayoutMinimumCents
      ) {
        providerInstantEligibleCount += 1;
      }
    }

    return {
      generatedAt: new Date().toISOString(),
      totalProviderReadyCents,
      totalCrewReadyCents,
      totalAwaitingCustomerPaymentCents,
      onHoldEntryCount,
      providerInstantEligibleCount,
      crewNextWeeklyPayoutDateIso,
      payoutPolicy: this.buildOpsPayoutPolicySummary(),
      providerRuns: Array.from(providerRuns.values())
        .map((run) => ({
          runDateIso: run.runDateIso,
          providerCount: run.providerIds.size,
          bookingCount: run.bookingIds.size,
          providerNetCents: run.providerNetCents,
          crewShareCents: run.crewShareCents,
          providerIds: Array.from(run.providerIds)
        }))
        .sort((left, right) => left.runDateIso.localeCompare(right.runDateIso)),
      disbursementBatches: Array.from(disbursementBatches.values())
        .map((batch) => ({
          id: batch.id,
          runDateIso: batch.runDateIso,
          recipientRole: batch.recipientRole,
          railMode: batch.railMode,
          actionStatus: batch.actionStatus,
          totalCents: batch.totalCents,
          recipientCount: batch.recipientIds.size,
          bookingCount: batch.bookingIds.size,
          entryCount: batch.entryIds.length,
          recipientIds: Array.from(batch.recipientIds),
          entryIds: batch.entryIds,
          entries: batch.entries,
          blockerReasons: batch.blockerReasons,
          manualActionLabel: batch.manualActionLabel,
          auditInstructions: batch.auditInstructions
        }))
        .sort((left, right) => {
          if (left.runDateIso !== right.runDateIso) {
            return left.runDateIso.localeCompare(right.runDateIso);
          }
          return left.recipientRole.localeCompare(right.recipientRole);
        })
    };
  }

  public async listOpsPayoutDisbursementRuns(): Promise<OpsPayoutDisbursementRunsResponse> {
    const runs = await this.repository.listPayoutDisbursementRuns();
    return {
      generatedAt: new Date().toISOString(),
      runs: runs.sort((left, right) => {
        if (left.runDateIso !== right.runDateIso) {
          return right.runDateIso.localeCompare(left.runDateIso);
        }
        return right.createdAt.localeCompare(left.createdAt);
      })
    };
  }

  public async createOpsPayoutDisbursementRun(
    actor: AuthIdentityRecord,
    payload: CreateOpsPayoutDisbursementRunRequest
  ): Promise<CreateOpsPayoutDisbursementRunResponse> {
    if (actor.role !== "ops") {
      throw new HttpError(403, "Only operations can create payout disbursement runs");
    }

    const previewBatchId = payload.previewBatchId?.trim();
    if (!previewBatchId) {
      throw new HttpError(400, "previewBatchId is required");
    }

    const preview = await this.getOpsPayoutPreview();
    const batch = preview.disbursementBatches.find((candidate) => candidate.id === previewBatchId);
    if (!batch) {
      throw new HttpError(404, "Payout disbursement preview batch not found");
    }
    if (batch.entryCount === 0 || batch.totalCents <= 0) {
      throw new HttpError(400, "Payout disbursement batch has no payable entries");
    }

    const entryFingerprint = this.buildPayoutDisbursementEntryFingerprint(batch);
    const existing = await this.repository.findPayoutDisbursementRunByBatchFingerprint(
      batch.id,
      entryFingerprint
    );
    if (existing) {
      return {
        run: existing,
        created: false,
        matchedPreviewBatch: batch
      };
    }

    const now = new Date().toISOString();
    const run = await this.repository.createPayoutDisbursementRun({
      id: crypto.randomUUID(),
      previewBatchId: batch.id,
      entryFingerprint,
      runDateIso: batch.runDateIso,
      recipientRole: batch.recipientRole,
      railMode: batch.railMode,
      actionStatus: batch.actionStatus,
      status: "manual-review",
      totalCents: batch.totalCents,
      recipientCount: batch.recipientCount,
      bookingCount: batch.bookingCount,
      entryCount: batch.entryCount,
      recipientIds: [...batch.recipientIds],
      entryIds: [...batch.entryIds],
      entries: batch.entries.map((entry) => ({ ...entry })),
      blockerReasons: [...batch.blockerReasons],
      manualActionLabel: batch.manualActionLabel,
      auditInstructions: [
        ...batch.auditInstructions,
        "Attach the external bank or payout-provider reference here after the manual run is reconciled."
      ],
      createdAt: now,
      updatedAt: now,
      createdByOpsUserId: actor.userId,
      createdByOpsEmail: actor.email,
      operatorNotes: payload.operatorNotes?.trim() || undefined
    });

    return {
      run,
      created: true,
      matchedPreviewBatch: batch
    };
  }

  public async listLaunchOperationsTasks(): Promise<LaunchOperationsTasksResponse> {
    const tasks = await this.repository.listLaunchOperationsTasks();
    return {
      generatedAt: new Date().toISOString(),
      tasks: this.sortLaunchOperationsTasks(tasks)
    };
  }

  public async createLaunchOperationsTask(
    actor: AuthIdentityRecord,
    payload: CreateLaunchOperationsTaskRequest
  ): Promise<CreateLaunchOperationsTaskResponse> {
    if (actor.role !== "ops") {
      throw new HttpError(403, "Only operations can create launch operations tasks");
    }

    const recommendationKey = payload.recommendationKey;
    const pocketKey = payload.pocketKey?.trim();
    if (!recommendationKey) {
      throw new HttpError(400, "recommendationKey is required");
    }
    if (!pocketKey) {
      throw new HttpError(400, "pocketKey is required");
    }

    const overview = await this.getObservabilityOverview();
    const recommendation = overview.launchOperationsPolicy.coverageActionRecommendations.find(
      (candidate) => candidate.key === recommendationKey && candidate.pocketKey === pocketKey
    );
    if (!recommendation) {
      throw new HttpError(404, "Launch operations recommendation not found");
    }

    const recommendationFingerprint = this.buildLaunchOperationsRecommendationFingerprint(recommendation);
    const existing = await this.repository.findLaunchOperationsTaskByRecommendationFingerprint(
      recommendationFingerprint
    );
    if (existing) {
      return {
        task: existing,
        created: false,
        matchedRecommendation: recommendation
      };
    }

    const assignee = await this.resolveLaunchOperationsTaskAssignee(payload.assignedToOpsUserId);
    const now = new Date();
    const nowIso = now.toISOString();
    const dueAtIso = new Date(now.getTime() + recommendation.dueWithinHours * 60 * 60 * 1000).toISOString();
    const task = await this.repository.createLaunchOperationsTask({
      id: crypto.randomUUID(),
      recommendationFingerprint,
      recommendationKey: recommendation.key,
      pocketKey: recommendation.pocketKey,
      city: recommendation.city,
      state: recommendation.state,
      postalCode: recommendation.postalCode,
      priority: recommendation.priority,
      owner: recommendation.owner,
      status: "open",
      title: recommendation.title,
      detail: recommendation.detail,
      recommendedAction: recommendation.recommendedAction,
      dueAtIso,
      relatedScenarioKeys: [...recommendation.relatedScenarioKeys],
      createdAt: nowIso,
      updatedAt: nowIso,
      createdByOpsUserId: actor.userId,
      createdByOpsEmail: actor.email,
      assignedToOpsUserId: assignee?.id,
      assignedToOpsEmail: assignee?.email,
      operatorNotes: payload.operatorNotes?.trim() || undefined
    });

    return {
      task,
      created: true,
      matchedRecommendation: recommendation
    };
  }

  public async updateLaunchOperationsTask(
    actor: AuthIdentityRecord,
    payload: UpdateLaunchOperationsTaskRequest
  ): Promise<UpdateLaunchOperationsTaskResponse> {
    if (actor.role !== "ops") {
      throw new HttpError(403, "Only operations can update launch operations tasks");
    }

    const taskId = payload.taskId?.trim();
    if (!taskId) {
      throw new HttpError(400, "taskId is required");
    }

    const existing = (await this.repository.listLaunchOperationsTasks()).find((task) => task.id === taskId);
    if (!existing) {
      throw new HttpError(404, "Launch operations task not found");
    }

    const nowIso = new Date().toISOString();
    const updates: Partial<LaunchOperationsTask> = {
      updatedAt: nowIso
    };

    if (payload.status !== undefined) {
      updates.status = payload.status;
      if (payload.status === "completed") {
        updates.completedAt = existing.completedAt ?? nowIso;
        updates.completedByOpsUserId = existing.completedByOpsUserId ?? actor.userId;
      } else if (existing.status === "completed") {
        updates.completedAt = undefined;
        updates.completedByOpsUserId = undefined;
      }
    }

    if (payload.assignedToOpsUserId !== undefined) {
      const assignee = await this.resolveLaunchOperationsTaskAssignee(payload.assignedToOpsUserId ?? undefined);
      updates.assignedToOpsUserId = assignee?.id;
      updates.assignedToOpsEmail = assignee?.email;
    }

    if (payload.operatorNotes !== undefined) {
      updates.operatorNotes = payload.operatorNotes.trim() || undefined;
    }
    if (payload.completionNotes !== undefined) {
      updates.completionNotes = payload.completionNotes.trim() || undefined;
    }

    const task = await this.repository.updateLaunchOperationsTask(taskId, updates);
    if (!task) {
      throw new HttpError(404, "Launch operations task not found");
    }

    return { task };
  }

  public async notifyDueLaunchOperationsTasks(
    actor: AuthIdentityRecord,
    payload: ProcessLaunchOperationsTaskNotificationsRequest = {}
  ): Promise<LaunchOperationsTaskNotificationSweepResponse> {
    if (actor.role !== "ops") {
      throw new HttpError(403, "Only operations can process launch operations task notifications");
    }

    const asOfMs = payload.asOfIso ? Date.parse(payload.asOfIso) : Date.now();
    if (!Number.isFinite(asOfMs)) {
      throw new HttpError(400, "asOfIso must be a valid ISO timestamp");
    }
    const asOfIso = new Date(asOfMs).toISOString();
    const [allTasks, opsUsers] = await Promise.all([
      this.repository.listLaunchOperationsTasks(),
      this.repository.listOpsUsers()
    ]);
    const tasks = allTasks.filter((task) => !payload.taskId || task.id === payload.taskId);
    if (payload.taskId && tasks.length === 0) {
      throw new HttpError(404, "Launch operations task not found");
    }

    const items: LaunchOperationsTaskNotificationSweepItem[] = [];
    for (const task of tasks) {
      const recipients = task.assignedToOpsUserId
        ? opsUsers
            .filter((opsUser) => opsUser.id === task.assignedToOpsUserId)
            .map((opsUser) => ({ recipientId: opsUser.id, recipientRole: "ops" as const }))
        : opsUsers.map((opsUser) => ({ recipientId: opsUser.id, recipientRole: "ops" as const }));

      if (recipients.length === 0) {
        items.push(
          await this.processLaunchOperationsTaskNotification({
            task,
            asOfMs,
            dryRun: Boolean(payload.dryRun),
            includeFuture: Boolean(payload.includeFuture)
          })
        );
        continue;
      }

      for (const recipient of recipients) {
        items.push(
          await this.processLaunchOperationsTaskNotification({
            task,
            recipientId: recipient.recipientId,
            recipientRole: recipient.recipientRole,
            asOfMs,
            dryRun: Boolean(payload.dryRun),
            includeFuture: Boolean(payload.includeFuture)
          })
        );
      }
    }

    const dueNotificationCount = items.filter((item) =>
      ["sent", "already-sent", "dry-run"].includes(item.notificationStatus)
    ).length;
    const sentNotificationCount = items.filter((item) => item.notificationStatus === "sent").length;
    const alreadySentCount = items.filter((item) => item.notificationStatus === "already-sent").length;

    return {
      generatedAt: new Date().toISOString(),
      asOfIso,
      dryRun: Boolean(payload.dryRun),
      taskCount: tasks.length,
      candidateNotificationCount: items.length,
      dueNotificationCount,
      sentNotificationCount,
      alreadySentCount,
      skippedNotificationCount: items.length - dueNotificationCount,
      items
    };
  }

  public async escalateOverdueLaunchOperationsTasks(
    actor: AuthIdentityRecord,
    payload: ProcessLaunchOperationsTaskEscalationsRequest = {}
  ): Promise<LaunchOperationsTaskEscalationSweepResponse> {
    if (actor.role !== "ops") {
      throw new HttpError(403, "Only operations can escalate launch operations tasks");
    }

    const asOfMs = payload.asOfIso ? Date.parse(payload.asOfIso) : Date.now();
    if (!Number.isFinite(asOfMs)) {
      throw new HttpError(400, "asOfIso must be a valid ISO timestamp");
    }
    const asOfIso = new Date(asOfMs).toISOString();
    const [allTasks, opsUsers] = await Promise.all([
      this.repository.listLaunchOperationsTasks(),
      this.repository.listOpsUsers()
    ]);
    const tasks = allTasks.filter((task) => !payload.taskId || task.id === payload.taskId);
    if (payload.taskId && tasks.length === 0) {
      throw new HttpError(404, "Launch operations task not found");
    }

    const recipients = opsUsers.map((opsUser) => ({
      recipientId: opsUser.id,
      recipientRole: "ops" as const
    }));
    const items: LaunchOperationsTaskEscalationSweepItem[] = [];
    for (const task of tasks) {
      if (recipients.length === 0) {
        items.push(
          await this.processLaunchOperationsTaskEscalation({
            task,
            asOfMs,
            dryRun: Boolean(payload.dryRun)
          })
        );
        continue;
      }

      for (const recipient of recipients) {
        items.push(
          await this.processLaunchOperationsTaskEscalation({
            task,
            recipientId: recipient.recipientId,
            recipientRole: recipient.recipientRole,
            asOfMs,
            dryRun: Boolean(payload.dryRun)
          })
        );
      }
    }

    const overdueEscalationCount = items.filter((item) =>
      ["sent", "already-sent", "dry-run"].includes(item.escalationStatus)
    ).length;
    const sentNotificationCount = items.filter((item) => item.escalationStatus === "sent").length;
    const alreadySentCount = items.filter((item) => item.escalationStatus === "already-sent").length;

    return {
      generatedAt: new Date().toISOString(),
      asOfIso,
      dryRun: Boolean(payload.dryRun),
      taskCount: tasks.length,
      candidateEscalationCount: items.length,
      overdueEscalationCount,
      sentNotificationCount,
      alreadySentCount,
      skippedEscalationCount: items.length - overdueEscalationCount,
      items
    };
  }

  public async createCheckoutSession(
    customerId: string,
    payload: CreateCheckoutSessionRequest
  ): Promise<CreateCheckoutSessionResponse> {
    const booking = await this.repository.findBookingById(payload.bookingId);
    if (!booking) {
      throw new HttpError(404, "Booking not found");
    }

    if (booking.customerId !== customerId) {
      throw new HttpError(403, "Customers can only pay for their own bookings");
    }

    if (booking.status === "cancelled" || booking.status === "refunded") {
      throw new HttpError(400, "Cancelled or refunded bookings cannot be paid");
    }

    if (booking.status === "disputed") {
      throw new HttpError(409, "Disputed bookings must be resolved by support before payment can continue");
    }

    const customer = await this.repository.findCustomerById(customerId);
    if (!customer) {
      throw new HttpError(404, "Customer not found");
    }

    const existingPayments = (await this.repository.listPayments()).filter(
      (payment) => payment.bookingId === booking.id
    );
    const paidPayment = existingPayments.find((payment) => payment.status === "captured");
    if (paidPayment) {
      throw new HttpError(409, "This booking has already been paid.");
    }

    const session = await this.stripeCheckout.createCheckoutSession({
      booking,
      customer,
      appBaseUrl: this.appBaseUrl,
      successPath: payload.successPath ?? "/customer/dashboard?payment=stripe-success",
      cancelPath: payload.cancelPath ?? "/customer/dashboard?payment=stripe-cancelled"
    });

    const now = new Date().toISOString();
    const currentPayment = existingPayments[0];
    const paymentBase: PaymentRecord = {
      id: currentPayment?.id ?? crypto.randomUUID(),
      bookingId: booking.id,
      amountCents: booking.totalCents,
      currency: "usd",
      status: "pending",
      processor: "stripe",
      refundable: false,
      checkoutSessionId: session.checkoutSessionId,
      checkoutSessionUrl: session.checkoutUrl,
      processorPaymentIntentId: session.paymentIntentId,
      refundReason: currentPayment?.refundReason,
      refundReviewStatus: currentPayment?.refundReviewStatus,
      refundRequestedAt: currentPayment?.refundRequestedAt,
      refundRequestedByRole: currentPayment?.refundRequestedByRole,
      refundReviewedAt: currentPayment?.refundReviewedAt,
      refundReviewedByRole: currentPayment?.refundReviewedByRole,
      refundDecisionNotes: currentPayment?.refundDecisionNotes,
      failureReason: undefined,
      paidAt: undefined,
      createdAt: currentPayment?.createdAt ?? now,
      updatedAt: now
    };

    const payment = currentPayment
      ? await this.repository.updatePayment(currentPayment.id, {
          amountCents: paymentBase.amountCents,
          currency: paymentBase.currency,
          status: paymentBase.status,
          processor: paymentBase.processor,
          refundable: paymentBase.refundable,
          checkoutSessionId: paymentBase.checkoutSessionId,
          checkoutSessionUrl: paymentBase.checkoutSessionUrl,
          processorPaymentIntentId: paymentBase.processorPaymentIntentId,
          refundReason: paymentBase.refundReason,
          refundReviewStatus: paymentBase.refundReviewStatus,
          refundRequestedAt: paymentBase.refundRequestedAt,
          refundRequestedByRole: paymentBase.refundRequestedByRole,
          refundReviewedAt: paymentBase.refundReviewedAt,
          refundReviewedByRole: paymentBase.refundReviewedByRole,
          refundDecisionNotes: paymentBase.refundDecisionNotes,
          failureReason: paymentBase.failureReason,
          paidAt: paymentBase.paidAt,
          updatedAt: paymentBase.updatedAt
        })
      : await this.repository.createPayment(paymentBase);

    if (!payment) {
      throw new HttpError(500, "Payment record could not be created");
    }

    this.analytics.recordFunnelStep(MarketplaceTelemetryEventCatalog.paymentCheckoutStarted, booking.id, {
      paymentId: payment.id,
      processor: payment.processor,
      amountCents: payment.amountCents,
      bookingStatus: booking.status
    });

    return {
      checkoutUrl: session.checkoutUrl,
      payment
    };
  }

  public async finalizeCheckoutSession(
    customerId: string,
    payload: FinalizeCheckoutSessionRequest
  ): Promise<PaymentRecord> {
    let verifiedSession: Awaited<ReturnType<PaymentCheckoutGateway["verifyCheckoutSession"]>> | undefined;
    let payment = await this.repository.findPaymentByCheckoutSessionId(payload.checkoutSessionId);
    if (!payment) {
      verifiedSession = await this.stripeCheckout.verifyCheckoutSession(payload.checkoutSessionId);
      if (verifiedSession.paymentIntentId) {
        payment = (await this.repository.listPayments()).find(
          (candidate) => candidate.processorPaymentIntentId === verifiedSession?.paymentIntentId
        );
      }
    }

    if (!payment) {
      throw new HttpError(404, "Payment session not found");
    }

    const booking = await this.repository.findBookingById(payment.bookingId);
    if (!booking) {
      throw new HttpError(404, "Booking not found");
    }

    if (booking.customerId !== customerId) {
      throw new HttpError(403, "Customers can only finalize payments for their own bookings");
    }

    if (payment.status === "captured") {
      return payment;
    }

    const session =
      verifiedSession ?? (await this.stripeCheckout.verifyCheckoutSession(payload.checkoutSessionId));
    if (session.paid) {
      return this.capturePaymentRecord(payment, booking, session.paymentIntentId);
    }

    await this.failPaymentRecord(
      payment,
      booking,
      session.failureReason ?? "Stripe payment has not completed yet.",
      "checkout-finalize"
    );
    throw new HttpError(409, session.failureReason ?? "Stripe payment has not completed yet.");
  }

  public async processStripeWebhook(rawBody: string, signatureHeader: string): Promise<{
    received: true;
    eventType: string;
    paymentId?: string;
  }> {
    const event = await this.stripeCheckout.parseWebhookEvent(rawBody, signatureHeader);
    const payment = await this.findPaymentForStripeWebhookEvent(event);
    if (!payment) {
      return {
        received: true,
        eventType: event.type
      };
    }

    const booking = await this.repository.findBookingById(payment.bookingId);
    if (!booking) {
      throw new HttpError(404, "Booking not found");
    }

    if (event.type === "checkout.session.completed" && event.paid) {
      const updatedPayment = await this.capturePaymentRecord(payment, booking, event.paymentIntentId);
      return {
        received: true,
        eventType: event.type,
        paymentId: updatedPayment.id
      };
    }

    if (event.type === "checkout.session.expired") {
      const updatedPayment = await this.failPaymentRecord(
        payment,
        booking,
        event.failureReason ?? "Stripe checkout expired.",
        "webhook"
      );
      return {
        received: true,
        eventType: event.type,
        paymentId: updatedPayment.id
      };
    }

    if (event.type === "payment_intent.payment_failed") {
      const updatedPayment = await this.failPaymentRecord(
        payment,
        booking,
        event.failureReason ?? "Stripe payment failed.",
        "webhook"
      );
      return {
        received: true,
        eventType: event.type,
        paymentId: updatedPayment.id
      };
    }

    if (event.type === "charge.refunded") {
      const updatedPayment = await this.markPaymentRefundedFromProcessor(payment, booking);
      return {
        received: true,
        eventType: event.type,
        paymentId: updatedPayment.id
      };
    }

    return {
      received: true,
      eventType: event.type,
      paymentId: payment.id
    };
  }

  private async findPaymentForStripeWebhookEvent(
    event: StripeWebhookEvent
  ): Promise<PaymentRecord | undefined> {
    if (event.checkoutSessionId) {
      return this.repository.findPaymentByCheckoutSessionId(event.checkoutSessionId);
    }

    if (event.paymentIntentId) {
      return (await this.repository.listPayments()).find(
        (payment) => payment.processorPaymentIntentId === event.paymentIntentId
      );
    }

    return undefined;
  }

  public async createPaymentIntent(payload: CreatePaymentIntentRequest): Promise<PaymentRecord> {
    const booking = await this.repository.findBookingById(payload.bookingId);
    if (!booking) {
      throw new HttpError(404, "Booking not found");
    }

    if (booking.status === "cancelled" || booking.status === "refunded") {
      throw new HttpError(400, "Cancelled or refunded bookings cannot be paid");
    }

    if (booking.status === "disputed") {
      throw new HttpError(409, "Disputed bookings must be resolved by support before payment can continue");
    }

    const now = new Date().toISOString();
    const payment: PaymentRecord = {
      id: crypto.randomUUID(),
      bookingId: payload.bookingId,
      amountCents: payload.amountCents,
      currency: payload.currency ?? "usd",
      processor: "manual",
      createdAt: now,
      updatedAt: now,
      status: "authorized",
      refundable: true,
      refundReviewStatus: undefined,
      refundRequestedAt: undefined,
      refundRequestedByRole: undefined,
      refundReviewedAt: undefined,
      refundReviewedByRole: undefined,
      refundDecisionNotes: undefined
    };

    this.analytics.recordFunnelStep(MarketplaceTelemetryEventCatalog.paymentAuthorized, payload.bookingId, {
      amountCents: payload.amountCents
    });
    return this.repository.createPayment(payment);
  }

  public async createRefund(
    requester: { userId: string; role: "customer" | "provider" },
    payload: CreateRefundRequest
  ): Promise<PaymentRecord> {
    const payment = await this.repository.findPaymentById(payload.paymentId);
    if (!payment) {
      throw new HttpError(404, "Payment not found");
    }

    const booking = await this.repository.findBookingById(payment.bookingId);
    if (!booking) {
      throw new HttpError(404, "Booking not found");
    }

    if (requester.role === "customer" && booking.customerId !== requester.userId) {
      throw new HttpError(403, "Customers can only request refunds for their own bookings");
    }

    if (requester.role === "provider" && booking.providerId !== requester.userId) {
      throw new HttpError(403, "Providers can only manage refunds for their own jobs");
    }

    if (payment.status !== "captured") {
      throw new HttpError(400, "Only captured customer payments can enter refund review");
    }

    if (booking.status === "refunded") {
      throw new HttpError(409, "This booking has already been refunded");
    }

    const existingRefundTicket = (await this.repository.listSupportTickets()).find(
      (ticket) =>
        ticket.bookingId === booking.id &&
        ticket.issueType === "billing" &&
        ticket.status !== "resolved"
    );
    if (existingRefundTicket) {
      throw new HttpError(409, "A refund review is already open for this booking");
    }

    if (payment.refundReviewStatus === "requested") {
      throw new HttpError(409, "A refund review is already in progress for this payment");
    }

    const now = new Date().toISOString();
    const reason = payload.reason.trim();
    if (!reason) {
      throw new HttpError(400, "A refund reason is required");
    }

    const updatedPayment = await this.repository.updatePayment(payload.paymentId, {
      refundReason: reason,
      refundReviewStatus: "requested",
      refundRequestedAt: now,
      refundRequestedByRole: requester.role === "provider" ? "provider" : "customer",
      refundReviewedAt: undefined,
      refundReviewedByRole: undefined,
      refundDecisionNotes: undefined,
      refundable: false,
      updatedAt: now
    });

    if (!updatedPayment) {
      throw new Error("Payment not found");
    }

    await this.createSupportTicket(
      {
        userId: requester.userId,
        role: requester.role
      },
      {
        bookingId: booking.id,
        issueType: "billing",
        subject: "Refund review requested",
        description: `${requester.role === "provider" ? "Provider" : "Customer"} requested a refund review. Reason: ${reason}`
      }
    );

    const requesterLabel = requester.role === "provider" ? "The business owner" : "The customer";
    await Promise.all([
      this.createNotification({
        recipientId: booking.customerId,
        recipientRole: "customer",
        category: "support",
        title:
          requester.role === "customer"
            ? "Refund review requested"
            : "Provider requested a refund review",
        body:
          requester.role === "customer"
            ? "YardMatch support is reviewing your refund request."
            : "The provider asked YardMatch support to review this booking for a refund.",
        actionHref: `/customer/dashboard?bookingId=${booking.id}`
      }),
      this.createNotification({
        recipientId: booking.providerId,
        recipientRole: "provider",
        category: "support",
        title:
          requester.role === "provider"
            ? "Refund review requested"
            : "Customer requested a refund review",
        body: `${requesterLabel} asked YardMatch support to review this booking for a refund.`,
        actionHref: `/provider/management?bookingId=${booking.id}`
      })
    ]);

    this.analytics.recordFunnelStep(MarketplaceTelemetryEventCatalog.refundRequested, updatedPayment.bookingId, {
      paymentId: updatedPayment.id,
      reason
    });
    return updatedPayment;
  }

  public async createOpsRefundOverride(
    payload: CreateOpsRefundOverrideRequest
  ): Promise<PaymentRecord> {
    const ticket = (await this.repository.listSupportTickets()).find(
      (candidate) => candidate.id === payload.ticketId
    );
    if (!ticket) {
      throw new HttpError(404, "Support ticket not found");
    }

    if (ticket.issueType !== "billing") {
      throw new HttpError(400, "Refund overrides can only start from billing tickets");
    }

    if (ticket.status === "resolved") {
      throw new HttpError(409, "Resolved tickets cannot open a new refund review");
    }

    const payment = await this.repository.findPaymentById(payload.paymentId);
    if (!payment) {
      throw new HttpError(404, "Payment not found");
    }

    const booking = await this.repository.findBookingById(payment.bookingId);
    if (!booking) {
      throw new HttpError(404, "Booking not found");
    }

    if (ticket.bookingId && ticket.bookingId !== booking.id) {
      throw new HttpError(400, "This billing ticket is not tied to the selected payment");
    }

    if (payment.status !== "captured") {
      throw new HttpError(400, "Only captured customer payments can enter refund review");
    }

    if (booking.status === "refunded") {
      throw new HttpError(409, "This booking has already been refunded");
    }

    if (payment.refundReviewStatus === "requested") {
      throw new HttpError(409, "A refund review is already in progress for this payment");
    }

    const reason = payload.reason.trim();
    if (!reason) {
      throw new HttpError(400, "A refund reason is required");
    }

    const now = new Date().toISOString();
    const updatedPayment = await this.repository.updatePayment(payment.id, {
      refundReason: reason,
      refundReviewStatus: "requested",
      refundRequestedAt: now,
      refundRequestedByRole: "ops",
      refundReviewedAt: undefined,
      refundReviewedByRole: undefined,
      refundDecisionNotes: undefined,
      refundable: false,
      updatedAt: now
    });

    if (!updatedPayment) {
      throw new HttpError(500, "Payment could not be updated for refund review");
    }

    await this.repository.updateSupportTicket(ticket.id, {
      updatedAt: now,
      description: `${ticket.description}\n\nCustomer service opened a refund review override. Reason: ${reason}`
    });

    await Promise.all([
      this.createNotification({
        recipientId: booking.customerId,
        recipientRole: "customer",
        category: "support",
        title: "Customer service opened a refund review",
        body: "YardMatch support opened a refund review on this booking and is reviewing next steps.",
        actionHref: `/customer/dashboard?bookingId=${booking.id}`
      }),
      this.createNotification({
        recipientId: booking.providerId,
        recipientRole: "provider",
        category: "support",
        title: "Customer service opened a refund review",
        body: "YardMatch support opened a refund review tied to this booking.",
        actionHref: `/provider/management?bookingId=${booking.id}`
      })
    ]);

    this.analytics.recordFunnelStep(MarketplaceTelemetryEventCatalog.refundRequested, updatedPayment.bookingId, {
      paymentId: updatedPayment.id,
      reason,
      openedBy: "ops"
    });

    if (booking.status === "completed" && booking.completedAt) {
      await this.ensureBookingFinancialSettlement(booking, updatedPayment);
    }

    return updatedPayment;
  }

  private async ensureBookingFinancialSettlement(
    booking: Booking,
    payment: PaymentRecord
  ) {
    if (booking.status !== "completed" || !booking.completedAt || payment.status !== "captured") {
      return undefined;
    }
    return this.repository.settleBookingFinancials({
      bookingId: booking.id,
      paymentId: payment.id,
      customerId: booking.customerId,
      providerId: booking.providerId,
      customerChargeCents: payment.amountCents,
      currency: payment.currency,
      actualProcessorFeeCents: 0
    });
  }

  public async createOpsBookingIntervention(
    payload: CreateOpsBookingInterventionRequest
  ): Promise<Booking> {
    const booking = await this.repository.findBookingById(payload.bookingId);
    if (!booking) {
      throw new HttpError(404, "Booking not found");
    }

    const note = payload.note.trim();
    if (!note) {
      throw new HttpError(400, "An intervention note is required");
    }

    const ticket = payload.ticketId
      ? (await this.repository.listSupportTickets()).find((candidate) => candidate.id === payload.ticketId)
      : undefined;
    if (payload.ticketId && !ticket) {
      throw new HttpError(404, "Support ticket not found");
    }
    if (ticket?.bookingId && ticket.bookingId !== booking.id) {
      throw new HttpError(400, "This support ticket is not tied to the selected booking");
    }

    const interventionResolutionAction = this.getResolutionActionForIntervention(payload.action);
    if (interventionResolutionAction) {
      if (!ticket && (booking.status === "disputed" || booking.serviceEvidence.length > 0)) {
        throw new HttpError(
          409,
          "Link the related support ticket before changing the final outcome of this booking"
        );
      }

      if (ticket) {
        this.assertEvidenceReviewedBeforeSensitiveSupportResolution(
          ticket,
          booking,
          interventionResolutionAction
        );
        this.assertDetailedRationaleForLowConfidenceSensitiveSupportResolution(
          ticket,
          booking,
          interventionResolutionAction,
          note
        );
      }
    }

    const now = new Date().toISOString();
    let scheduledStartIso = payload.scheduledStartIso;
    let scheduledEndIso = payload.scheduledEndIso;

    if (payload.action === "reschedule-booking") {
      if (!scheduledStartIso || !scheduledEndIso) {
        throw new HttpError(400, "A new start and end time are required to reschedule the booking");
      }

      const startMs = Date.parse(scheduledStartIso);
      const endMs = Date.parse(scheduledEndIso);
      if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
        throw new HttpError(400, "A valid booking window is required");
      }

      if (startMs <= Date.now()) {
        throw new HttpError(400, "Rescheduled bookings must stay in the future");
      }
    } else {
      scheduledStartIso = undefined;
      scheduledEndIso = undefined;
    }

    if (
      booking.status === "cancelled" &&
      payload.action !== "restore-active-booking" &&
      payload.action !== "add-note"
    ) {
      throw new HttpError(409, "Cancelled bookings cannot take that intervention");
    }

    if (
      booking.status === "refunded" &&
      payload.action !== "add-note"
    ) {
      throw new HttpError(409, "Refunded bookings cannot take that intervention");
    }

    const intervention: BookingInterventionRecord = {
      id: crypto.randomUUID(),
      action: payload.action,
      createdAt: now,
      actorRole: "ops",
      actorUserId: "ops-system",
      note,
      ticketId: payload.ticketId,
      previousStatus: booking.status,
      nextStatus: this.getInterventionNextStatus(booking, payload.action),
      previousScheduledStartIso: booking.scheduledStartIso,
      previousScheduledEndIso: booking.scheduledEndIso,
      nextScheduledStartIso: scheduledStartIso,
      nextScheduledEndIso: scheduledEndIso
    };

    const updatedBooking = await this.applyOpsBookingIntervention(booking, payload, intervention, now);

    if (ticket) {
      await this.repository.updateSupportTicket(ticket.id, {
        updatedAt: now,
        triagedAt: ticket.triagedAt ?? (ticket.status === "open" ? now : undefined),
        status: ticket.status === "open" ? "triaged" : ticket.status,
        description: `${ticket.description}\n\nOps intervention: ${payload.action}. Note: ${note}`
      });
    }

    this.analytics.record({
      id: crypto.randomUUID(),
      name: MarketplaceTelemetryEventCatalog.supportTicketOpened,
      actorId: booking.id,
      occurredAt: now,
      properties: {
        bookingId: booking.id,
        interventionAction: payload.action,
        ticketId: payload.ticketId ?? "none"
      }
    });

    return updatedBooking;
  }

  public async reviewBookingEvidenceForOps(
    payload: ReviewBookingEvidenceForOpsRequest
  ): Promise<Booking> {
    const booking = await this.repository.findBookingById(payload.bookingId);
    if (!booking) {
      throw new HttpError(404, "Booking not found");
    }

    const evidenceIndex = booking.serviceEvidence.findIndex((photo) => photo.id === payload.evidenceId);
    if (evidenceIndex === -1) {
      throw new HttpError(404, "Booking evidence not found");
    }

    const ticket = payload.ticketId
      ? (await this.repository.listSupportTickets()).find((candidate) => candidate.id === payload.ticketId)
      : undefined;
    if (payload.ticketId && !ticket) {
      throw new HttpError(404, "Support ticket not found");
    }
    if (ticket?.bookingId && ticket.bookingId !== booking.id) {
      throw new HttpError(400, "This support ticket is not tied to the selected booking");
    }

    const reviewNotes = payload.reviewNotes?.trim();
    const reviewedAt = new Date().toISOString();
    const nextEvidence = booking.serviceEvidence.map((photo, index) =>
      index === evidenceIndex
        ? {
            ...photo,
            reviewStatus: payload.reviewStatus,
            reviewNotes: reviewNotes || undefined,
            reviewedAt,
            reviewedByRole: "ops" as const,
            reviewedByUserId: "ops-system"
          }
        : photo
    );

    const updatedBooking = await this.repository.updateBooking(booking.id, {
      serviceEvidence: nextEvidence
    });

    if (!updatedBooking) {
      throw new HttpError(500, "Booking evidence review could not be saved");
    }

    if (ticket) {
      const evidence = booking.serviceEvidence[evidenceIndex];
      await this.repository.updateSupportTicket(ticket.id, {
        updatedAt: reviewedAt,
        triagedAt: ticket.triagedAt ?? (ticket.status === "open" ? reviewedAt : undefined),
        status: ticket.status === "open" ? "triaged" : ticket.status,
        description:
          `${ticket.description}\n\nOps evidence review: ${evidence?.phase ?? "photo"} ` +
          `${payload.reviewStatus}${reviewNotes ? `. Notes: ${reviewNotes}` : "."}`
      });
    }

    return updatedBooking;
  }

  public async createSupportTicket(
    requester: { userId: string; role: "customer" | "provider" | "crew-member" },
    payload: CreateSupportTicketRequest
  ): Promise<SupportTicket> {
    if (payload.bookingId) {
      const booking = await this.repository.findBookingById(payload.bookingId);
      if (!booking) {
        throw new Error("Booking not found");
      }

      if (requester.role === "customer" && booking.customerId !== requester.userId) {
        throw new Error("Customers can only open support tickets for their own bookings");
      }

      if (requester.role === "provider" && booking.providerId !== requester.userId) {
        throw new Error("Providers can only open support tickets for their own jobs");
      }

      if (requester.role === "crew-member") {
        const matches = await this.repository.listCrewMatches();
        const hasAcceptedMatch = matches.some(
          (match) =>
            match.bookingId === booking.id &&
            match.crewMemberId === requester.userId &&
            match.status === "accepted"
        );
        if (!hasAcceptedMatch) {
          throw new Error("Crew members can only open support tickets for accepted assignments");
        }
      }
    }

    const ticket: SupportTicket = {
      id: crypto.randomUUID(),
      bookingId: payload.bookingId,
      requesterId: requester.userId,
      subject: payload.subject,
      description: payload.description,
      issueType: payload.issueType,
      status: "open",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.analytics.recordFunnelStep(MarketplaceTelemetryEventCatalog.supportTicketOpened, requester.userId, {
      issueType: payload.issueType,
      bookingId: payload.bookingId ?? "none"
    });
    const savedTicket = await this.repository.createSupportTicket(ticket);
    const linkedLead = await this.maybeCreateLaunchLeadFromSupportTicket(requester, payload);
    if (!linkedLead) {
      return savedTicket;
    }

    return (
      (await this.repository.updateSupportTicket(savedTicket.id, {
        launchLeadId: linkedLead.id,
        updatedAt: new Date().toISOString()
      })) ?? { ...savedTicket, launchLeadId: linkedLead.id }
    );
  }

  public async createLaunchLead(payload: CreateLaunchLeadRequest): Promise<LaunchLead> {
    const sourceReferenceId = payload.sourceReferenceId?.trim() || undefined;
    if (sourceReferenceId) {
      const existingLead = await this.repository.findLaunchLeadBySourceReferenceId(sourceReferenceId);
      if (existingLead) {
        return existingLead;
      }
    }

    const contactName = payload.contactName.trim().replace(/\s+/g, " ");
    if (contactName.length < 2) {
      throw new HttpError(400, "A contact name is required.");
    }

    const email = payload.email?.trim().toLowerCase() || undefined;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new HttpError(400, "A valid email address is required.");
    }

    const areaLabel = payload.areaLabel.trim().replace(/\s+/g, " ");
    if (areaLabel.length < 2) {
      throw new HttpError(400, "An area or town is required.");
    }

    const message = payload.message.trim().replace(/\s+/g, " ");
    if (message.length < 12) {
      throw new HttpError(400, "Add a little more detail so ops can follow up clearly.");
    }

    const phone = this.normalizeLaunchLeadPhone(payload.phone);
    const allowsPlatformMessageOnly =
      payload.preferredContactMethod === "platform-message" &&
      this.sourceChannelSupportsPlatformMessage(payload.sourceChannel ?? "website");
    if (!email && !phone && !allowsPlatformMessageOnly) {
      throw new HttpError(400, "Add at least one contact method: email or phone.");
    }
    if (payload.preferredContactMethod === "email" && !email) {
      throw new HttpError(400, "Add an email address for email follow-up.");
    }
    if ((payload.preferredContactMethod === "phone" || payload.preferredContactMethod === "text") && !phone) {
      throw new HttpError(400, "Add a phone number for phone or text follow-up.");
    }
    if (payload.preferredContactMethod === "platform-message" && !allowsPlatformMessageOnly) {
      throw new HttpError(
        400,
        "Platform-message follow-up is only supported for channel-mediated sources like Google Business Profile or social."
      );
    }
    const assignedOwner = payload.assignedOwner?.trim()
      ? payload.assignedOwner.trim().replace(/\s+/g, " ")
      : undefined;

    const now = new Date();
    const createdAt = now.toISOString();
    const lead: LaunchLead = {
      id: crypto.randomUUID(),
      sourceChannel: payload.sourceChannel ?? "website",
      requestSource: payload.requestSource?.trim() || undefined,
      sourceReferenceId,
      channelMetadata: payload.channelMetadata,
      attribution: payload.attribution,
      contactName,
      email,
      phone,
      preferredContactMethod: payload.preferredContactMethod,
      areaLabel,
      serviceCategory: payload.serviceCategory,
      message,
      status: "new",
      assignedOwner,
      firstResponseDueAt: new Date(
        now.getTime() + MarketplacePlatformService.launchLeadFirstResponseSlaMinutes * 60_000
      ).toISOString(),
      convertedBookingIds: [],
      reviewIds: [],
      createdAt,
      updatedAt: createdAt
    };

    const savedLead = await this.repository.createLaunchLead(lead);
    this.analytics.record({
      id: crypto.randomUUID(),
      name: MarketplaceTelemetryEventCatalog.launchLeadCaptured,
      occurredAt: createdAt,
      properties: {
        leadId: savedLead.id,
        sourceChannel: savedLead.sourceChannel,
        requestSource: savedLead.requestSource ?? "unknown",
        preferredContactMethod: savedLead.preferredContactMethod,
        hasEmail: Boolean(savedLead.email),
        hasPhone: Boolean(savedLead.phone),
        hasAssignedOwner: Boolean(savedLead.assignedOwner),
        serviceCategory: savedLead.serviceCategory ?? "unknown",
        ...this.buildLaunchAttributionAnalyticsProperties(savedLead.attribution)
      }
    });

    return savedLead;
  }

  public async createInboundLaunchLead(
    payload: CreateInboundLaunchLeadRequest,
    secretHeader: string | undefined
  ): Promise<LaunchLead> {
    const configuredSecret = process.env.INBOUND_LEAD_WEBHOOK_SECRET?.trim();
    if (!configuredSecret) {
      throw new HttpError(503, "Inbound lead webhook secret is not configured yet.");
    }
    if (!secretHeader || secretHeader.trim() !== configuredSecret) {
      throw new HttpError(401, "Invalid inbound lead secret.");
    }
    if (payload.sourceChannel === "website") {
      throw new HttpError(400, "Website leads should use the public launch lead form.");
    }
    if (!payload.sourceReferenceId.trim()) {
      throw new HttpError(400, "Inbound leads require a sourceReferenceId for idempotency.");
    }

    const email = payload.email?.trim().toLowerCase() || undefined;
    const messageParts = [
      payload.subject?.trim().replace(/\s+/g, " ") || undefined,
      payload.message?.trim().replace(/\s+/g, " ") || undefined
    ].filter((part): part is string => Boolean(part));
    const messageText = messageParts.join(". ");
    const intakeDetails = this.prepareInboundLeadIntakeDetails({
      sourceChannel: payload.sourceChannel,
      channelMetadata: payload.channelMetadata,
      areaLabel: payload.areaLabel,
      serviceCategory: payload.serviceCategory,
      phone: payload.phone,
      preferredContactMethod: payload.preferredContactMethod,
      messageText
    });
    const phone = intakeDetails.phone;
    const allowsPlatformMessageOnly =
      (payload.preferredContactMethod === "platform-message" ||
        intakeDetails.preferredContactMethod === "platform-message") &&
      this.sourceChannelSupportsPlatformMessage(payload.sourceChannel);
    if (!email && !phone && !allowsPlatformMessageOnly) {
      throw new HttpError(400, "Inbound leads require at least one contact method: email or phone.");
    }

    const subject = payload.subject?.trim().replace(/\s+/g, " ") || undefined;
    const messageBody = payload.message?.trim().replace(/\s+/g, " ") || undefined;
    const message = messageText || "Inbound lead captured for ops follow-up.";
    const contactName =
      payload.contactName?.trim().replace(/\s+/g, " ") ||
      this.deriveInboundContactName(email, phone, payload.sourceChannel);
    const preferredContactMethod =
      intakeDetails.preferredContactMethod ??
      payload.preferredContactMethod ??
      (email ? "email" : phone ? "phone" : this.sourceChannelSupportsPlatformMessage(payload.sourceChannel) ? "platform-message" : "phone");

    return this.createLaunchLead({
      sourceChannel: payload.sourceChannel,
      requestSource: payload.requestSource?.trim() || `inbound-${payload.sourceChannel}`,
      sourceReferenceId: payload.sourceReferenceId,
      channelMetadata: intakeDetails.channelMetadata,
      contactName,
      email,
      phone,
      preferredContactMethod,
      areaLabel: intakeDetails.areaLabel,
      serviceCategory: intakeDetails.serviceCategory,
      message,
      assignedOwner: payload.assignedOwner?.trim() || undefined
    });
  }

  public async createInboundEmailLaunchLead(
    payload: CreateInboundEmailLaunchLeadRequest,
    secretHeader: string | undefined
  ): Promise<LaunchLead> {
    const senderIdentity = this.parseInboundMailboxIdentity(payload.senderEmail, payload.senderName);
    const replyToIdentity = this.parseInboundMailboxIdentity(payload.replyToEmail, payload.replyToName);
    const senderEmail = senderIdentity.email;
    const contactEmail = replyToIdentity.email ?? senderEmail;
    if (!senderEmail || !contactEmail) {
      throw new HttpError(400, "Inbound email leads require a sender email address.");
    }

    const sourceReferenceId =
      payload.sourceReferenceId?.trim() || this.normalizeInboundMessageReference(payload.messageId);
    if (!sourceReferenceId) {
      throw new HttpError(400, "Inbound email leads require a sourceReferenceId or messageId for idempotency.");
    }

    const subject = payload.subject?.trim().replace(/\s+/g, " ") || undefined;
    const textBody = payload.textBody?.trim().replace(/\s+/g, " ") || undefined;
    const htmlBody = payload.htmlBody?.trim();
    const normalizedHtmlBody = !textBody && htmlBody ? this.normalizeInboundEmailHtmlBody(htmlBody) : undefined;
    const replyToName = replyToIdentity.name;
    const replyToEmail = replyToIdentity.email;
    const inferredNotes: string[] = [];
    if (!payload.sourceReferenceId?.trim() && payload.messageId?.trim()) {
      inferredNotes.push("sourceReferenceId was derived from the inbound email message id for retry-safe deduplication.");
    }
    if (replyToEmail && replyToEmail !== senderEmail) {
      inferredNotes.push("Follow up on the reply-to address from the inbound email metadata before assuming the original sender mailbox is monitored.");
    }
    if (!textBody && normalizedHtmlBody) {
      inferredNotes.push("Inbound email body was normalized from HTML because no plain-text body was supplied.");
    }

    return this.createInboundLaunchLead(
      {
        sourceChannel: "email",
        requestSource: "direct-email-forward",
        sourceReferenceId,
        channelMetadata: {
          emailMessageId: this.normalizeInboundMessageReference(payload.messageId),
          emailThreadId:
            this.normalizeInboundMessageReference(payload.threadId) ??
            payload.threadId?.trim() ??
            undefined,
          replyToEmail,
          replyToName,
          intakeNotes: inferredNotes.length > 0 ? inferredNotes : undefined
        },
        contactName:
          replyToName ||
          senderIdentity.name ||
          this.deriveInboundContactName(contactEmail, undefined, "email"),
        email: contactEmail,
        areaLabel: payload.areaLabel?.trim().replace(/\s+/g, " ") || undefined,
        serviceCategory: payload.serviceCategory,
        subject,
        message: textBody ?? normalizedHtmlBody ?? subject ?? "Inbound email lead captured for ops follow-up.",
        assignedOwner: payload.assignedOwner?.trim() || undefined
      },
      secretHeader
    );
  }

  public async createInboundGoogleBusinessProfileLead(
    payload: CreateInboundGoogleBusinessProfileLeadRequest,
    secretHeader: string | undefined
  ): Promise<LaunchLead> {
    const messageText = payload.messageText?.trim().replace(/\s+/g, " ");
    if (!messageText) {
      throw new HttpError(400, "Inbound Google Business Profile leads require the message text.");
    }

    const customerEmail = payload.customerEmail?.trim().toLowerCase() || undefined;
    const customerPhone = this.normalizeLaunchLeadPhone(payload.customerPhone);
    const threadUrl = payload.threadUrl?.trim();
    const profileLocationName = payload.profileLocationName?.trim().replace(/\s+/g, " ");
    const message =
      `${messageText}` +
      `${profileLocationName ? ` Google Business Profile location: ${profileLocationName}.` : ""}`;

    return this.createInboundLaunchLead(
      {
        sourceChannel: "google-business-profile",
        requestSource: "google-business-profile-message",
        sourceReferenceId: payload.sourceReferenceId,
        channelMetadata: {
          threadUrl,
          profileLocationName
        },
        contactName:
          payload.customerName?.trim().replace(/\s+/g, " ") ||
          this.deriveInboundContactName(customerEmail, customerPhone, "google-business-profile"),
        email: customerEmail,
        phone: customerPhone,
        preferredContactMethod: customerEmail || customerPhone ? "platform-message" : "platform-message",
        areaLabel: payload.areaLabel?.trim().replace(/\s+/g, " ") || "Needs area confirmation",
        serviceCategory: payload.serviceCategory,
        message,
        assignedOwner: payload.assignedOwner?.trim() || undefined
      },
      secretHeader
    );
  }

  public async createInboundReferralLaunchLead(
    payload: CreateInboundReferralLaunchLeadRequest,
    secretHeader: string | undefined
  ): Promise<LaunchLead> {
    const referrerName = payload.referrerName?.trim().replace(/\s+/g, " ");
    if (!referrerName) {
      throw new HttpError(400, "Inbound referral leads require a referrer name.");
    }

    const referredCustomerEmail = payload.referredCustomerEmail?.trim().toLowerCase() || undefined;
    const referredCustomerPhone = this.normalizeLaunchLeadPhone(payload.referredCustomerPhone);
    const referrerEmail = payload.referrerEmail?.trim().toLowerCase() || undefined;
    const referrerPhone = this.normalizeLaunchLeadPhone(payload.referrerPhone);

    if (!referredCustomerEmail && !referredCustomerPhone && !referrerEmail && !referrerPhone) {
      throw new HttpError(
        400,
        "Inbound referral leads require a way to follow up with either the referred customer or the referrer."
      );
    }

    const contactName =
      payload.referredCustomerName?.trim().replace(/\s+/g, " ") ||
      referrerName;
    const contactEmail = referredCustomerEmail ?? referrerEmail;
    const contactPhone = referredCustomerPhone ?? referrerPhone;
    const preferredContactMethod = contactEmail ? "email" : "phone";
    const details = payload.messageText?.trim().replace(/\s+/g, " ");
    const referredCustomerName = payload.referredCustomerName?.trim().replace(/\s+/g, " ");
    const message =
      `Referral from ${referrerName}.` +
      `${referredCustomerName ? ` Referred customer: ${referredCustomerName}.` : ""}` +
      `${details ? ` Notes: ${details}` : ""}`;

    return this.createInboundLaunchLead(
      {
        sourceChannel: "referral",
        requestSource: "referral-forwarder",
        sourceReferenceId: payload.sourceReferenceId,
        channelMetadata: {
          referrerName,
          referrerEmail,
          referrerPhone,
          referralFollowUpTarget:
            !referredCustomerEmail && !referredCustomerPhone ? "referrer" : "referred-customer"
        },
        contactName,
        email: contactEmail,
        phone: contactPhone,
        preferredContactMethod,
        areaLabel: payload.areaLabel?.trim().replace(/\s+/g, " ") || "Needs area confirmation",
        serviceCategory: payload.serviceCategory,
        message,
        assignedOwner: payload.assignedOwner?.trim() || undefined
      },
      secretHeader
    );
  }

  public async listOpsLaunchLeads(): Promise<OpsLaunchLead[]> {
    const now = Date.now();
    const [leads, bookings, customers, providers] = await Promise.all([
      this.repository.listLaunchLeads(),
      this.repository.listBookings(),
      this.repository.listCustomers(),
      this.repository.listProviders()
    ]);

    return leads
      .map((lead) => {
        const isClosed = lead.status === "converted" || lead.status === "closed-lost";
        const nextActionDueAt = isClosed
          ? undefined
          : lead.firstRespondedAt
            ? lead.nextFollowUpDueAt
            : lead.firstResponseDueAt;
        const isFirstResponseOverdue = !isClosed && !lead.firstRespondedAt && new Date(lead.firstResponseDueAt).getTime() < now;
        const isFollowUpOverdue =
          !isClosed &&
          Boolean(lead.firstRespondedAt) &&
          Boolean(lead.nextFollowUpDueAt) &&
          new Date(lead.nextFollowUpDueAt ?? "").getTime() < now;
        const suggestedBookingMatches = this.buildSuggestedLaunchLeadBookingMatches(
          lead,
          bookings,
          customers,
          providers
        );

        return {
          lead,
          nextActionDueAt,
          isFirstResponseOverdue,
          isFollowUpOverdue,
          suggestedBookingMatches,
          responseGuidance: this.buildLaunchLeadResponseGuidance(
            lead,
            suggestedBookingMatches,
            bookings,
            providers
          ),
          hoursSinceCreated: Math.max(
            0,
            Math.round(((now - new Date(lead.createdAt).getTime()) / (60 * 60 * 1000)) * 10) / 10
          )
        } satisfies OpsLaunchLead;
      })
      .sort((left, right) => {
        const leftClosed = left.lead.status === "converted" || left.lead.status === "closed-lost";
        const rightClosed = right.lead.status === "converted" || right.lead.status === "closed-lost";
        if (leftClosed !== rightClosed) {
          return leftClosed ? 1 : -1;
        }

        const leftUrgency = left.isFirstResponseOverdue || left.isFollowUpOverdue ? 0 : 1;
        const rightUrgency = right.isFirstResponseOverdue || right.isFollowUpOverdue ? 0 : 1;
        if (leftUrgency !== rightUrgency) {
          return leftUrgency - rightUrgency;
        }

        if (left.nextActionDueAt && right.nextActionDueAt && left.nextActionDueAt !== right.nextActionDueAt) {
          return left.nextActionDueAt.localeCompare(right.nextActionDueAt);
        }

        return right.lead.createdAt.localeCompare(left.lead.createdAt);
      });
  }

  public async updateLaunchLeadForOps(payload: UpdateLaunchLeadRequest): Promise<LaunchLead> {
    const lead = (await this.repository.listLaunchLeads()).find((candidate) => candidate.id === payload.leadId);
    if (!lead) {
      throw new HttpError(404, "Launch lead not found.");
    }

    const linkedBooking = payload.linkBookingId
      ? await this.repository.findBookingById(payload.linkBookingId)
      : undefined;
    if (payload.linkBookingId && !linkedBooking) {
      throw new HttpError(404, "Booking to link was not found.");
    }
    if (linkedBooking?.launchLeadId && linkedBooking.launchLeadId !== lead.id) {
      throw new HttpError(400, "That booking is already linked to a different launch lead.");
    }

    const effectiveStatus = linkedBooking ? "converted" : payload.status;

    const assignedOwner = payload.assignedOwner?.trim()
      ? payload.assignedOwner.trim().replace(/\s+/g, " ")
      : payload.assignedOwner === undefined
        ? lead.assignedOwner
        : undefined;
    if (effectiveStatus !== "new" && !assignedOwner) {
      throw new HttpError(400, "Assign an owner before moving this lead forward.");
    }

    const nextFollowUpDueAt = payload.nextFollowUpDueAt
      ? new Date(payload.nextFollowUpDueAt).toISOString()
      : effectiveStatus === "contacted" || effectiveStatus === "qualified"
        ? lead.nextFollowUpDueAt
        : undefined;
    if ((effectiveStatus === "contacted" || effectiveStatus === "qualified") && !nextFollowUpDueAt) {
      throw new HttpError(400, "Set the next follow-up time before saving this lead status.");
    }

    const outcomeSummary = payload.outcomeSummary?.trim()
      ? payload.outcomeSummary.trim().replace(/\s+/g, " ")
      : payload.outcomeSummary === undefined
        ? lead.outcomeSummary
        : undefined;
    const autoGeneratedOutcomeSummary = linkedBooking
      ? `Ops linked booking ${linkedBooking.id} back to this lead for marketplace conversion tracking.`
      : undefined;
    if ((effectiveStatus === "converted" || effectiveStatus === "closed-lost") && !outcomeSummary && !autoGeneratedOutcomeSummary) {
      throw new HttpError(400, "Add an outcome summary before closing this lead.");
    }

    const lossReason =
      effectiveStatus === "closed-lost"
        ? payload.lossReason ?? lead.lossReason
        : undefined;
    if (effectiveStatus === "closed-lost" && !lossReason) {
      throw new HttpError(400, "Choose a closed-lost reason before closing this lead.");
    }

    const updatedAt = new Date().toISOString();
    const firstRespondedAt =
      lead.firstRespondedAt ??
      (effectiveStatus === "contacted" ||
      effectiveStatus === "qualified" ||
      effectiveStatus === "converted" ||
      effectiveStatus === "closed-lost"
        ? updatedAt
        : undefined);
    const lastContactedAt =
      effectiveStatus === "contacted" || effectiveStatus === "qualified" ? updatedAt : lead.lastContactedAt;
    const closedAt =
      effectiveStatus === "converted" || effectiveStatus === "closed-lost" ? updatedAt : undefined;

    const updatedLead = await this.repository.updateLaunchLead(lead.id, {
      status: effectiveStatus,
      assignedOwner,
      nextFollowUpDueAt,
      outcomeSummary: outcomeSummary ?? autoGeneratedOutcomeSummary,
      lossReason,
      firstRespondedAt,
      lastContactedAt,
      closedAt,
      updatedAt
    });

    if (!updatedLead) {
      throw new HttpError(500, "Launch lead could not be updated.");
    }

    const finalLead = linkedBooking
      ? await this.linkBookingToLaunchLead(updatedLead, linkedBooking, updatedAt)
      : updatedLead;

    if (!lead.firstRespondedAt && firstRespondedAt) {
      this.analytics.record({
        id: crypto.randomUUID(),
        name: MarketplaceTelemetryEventCatalog.launchLeadContacted,
        occurredAt: updatedAt,
        properties: {
          leadId: finalLead.id,
          status: finalLead.status,
          sourceChannel: finalLead.sourceChannel,
          requestSource: finalLead.requestSource ?? "unknown",
          hasAssignedOwner: Boolean(finalLead.assignedOwner),
          ...this.buildLaunchAttributionAnalyticsProperties(finalLead.attribution)
        }
      });
    }

    if (finalLead.status === "converted" || finalLead.status === "closed-lost") {
      this.analytics.record({
        id: crypto.randomUUID(),
        name: MarketplaceTelemetryEventCatalog.launchLeadClosed,
        occurredAt: updatedAt,
        properties: {
          leadId: finalLead.id,
          status: finalLead.status,
          sourceChannel: finalLead.sourceChannel,
          requestSource: finalLead.requestSource ?? "unknown",
          lossReason: finalLead.lossReason ?? "none",
          hasAssignedOwner: Boolean(finalLead.assignedOwner),
          ...this.buildLaunchAttributionAnalyticsProperties(finalLead.attribution)
        }
      });
    }

    return finalLead;
  }

  public async listSupportTicketsForRequester(
    requester: { userId: string; role: "customer" | "provider" | "crew-member" }
  ): Promise<SupportTicket[]> {
    return (await this.repository.listSupportTickets())
      .filter((ticket) => ticket.requesterId === requester.userId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  public async listOpsSupportTickets(): Promise<SupportOpsTicket[]> {
    const [tickets, bookings, payments, customers, providers, crewMembers] = await Promise.all([
      this.repository.listSupportTickets(),
      this.repository.listBookings(),
      this.repository.listPayments(),
      this.repository.listCustomers(),
      this.repository.listProviders(),
      this.repository.listCrewMembers()
    ]);
    const customerById = new Map(customers.map((customer) => [customer.id, customer]));
    const providerById = new Map(providers.map((provider) => [provider.id, provider]));
    const crewMemberById = new Map(crewMembers.map((crewMember) => [crewMember.id, crewMember]));

    return tickets
      .map((ticket) => {
        const booking = ticket.bookingId
          ? bookings.find((candidate) => candidate.id === ticket.bookingId)
          : undefined;
        const payment = booking
          ? payments.find((candidate) => candidate.bookingId === booking.id)
          : undefined;
        const customer = booking
          ? customerById.get(booking.customerId)
          : undefined;
        const provider = booking
          ? providerById.get(booking.providerId)
          : undefined;
        const evidenceSummary = booking ? this.buildSupportEvidenceSummary(booking) : undefined;
        const resolutionGuidance =
          booking && evidenceSummary
            ? this.buildSupportResolutionGuidance(
                ticket,
                booking,
                payment,
                evidenceSummary,
                customer?.fullName,
                provider?.companyName
              )
            : undefined;
        const resolutionPolicy =
          booking && evidenceSummary && resolutionGuidance
            ? this.buildSupportResolutionPolicy(ticket, booking, payment, evidenceSummary, resolutionGuidance)
            : undefined;
        const requesterRole = this.resolveSupportTimelineActorRole(
          ticket.requesterId,
          customerById,
          providerById,
          crewMemberById
        );

        return {
          ticket,
          booking,
          payment,
          customerName: customer?.fullName,
          providerName: provider?.companyName,
          evidenceSummary,
          resolutionGuidance,
          resolutionPolicy,
          providerCoordinationTemplates: booking
            ? this.buildSupportProviderCoordinationTemplates(ticket, booking, customer?.fullName, provider?.companyName)
            : [],
          exceptionScripts: booking
            ? this.buildSupportExceptionHandlingScripts(ticket, booking, payment, customer?.fullName, provider?.companyName)
            : [],
          timeline: this.buildSupportTimeline(ticket, booking, payment, requesterRole)
        } satisfies SupportOpsTicket;
      })
      .sort((left, right) => right.ticket.createdAt.localeCompare(left.ticket.createdAt));
  }

  public async getOpsFinancialExceptionSummary(): Promise<OpsFinancialExceptionSummaryResponse> {
    const [tickets, bookings, payments, customers, providers] = await Promise.all([
      this.repository.listSupportTickets(),
      this.repository.listBookings(),
      this.repository.listPayments(),
      this.repository.listCustomers(),
      this.repository.listProviders()
    ]);

    const customerById = new Map(customers.map((customer) => [customer.id, customer]));
    const providerById = new Map(providers.map((provider) => [provider.id, provider]));
    const bookingById = new Map(bookings.map((booking) => [booking.id, booking]));
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    const refundReviews = payments
      .filter((payment) => payment.refundReviewStatus === "requested")
      .map((payment) => {
        const booking = bookingById.get(payment.bookingId);
        const customer = booking ? customerById.get(booking.customerId) : undefined;
        const provider = booking ? providerById.get(booking.providerId) : undefined;
        return {
          bookingId: payment.bookingId,
          paymentId: payment.id,
          customerName: customer?.fullName,
          providerName: provider?.companyName,
          amountCents: payment.amountCents,
          bookingStatus: booking?.status ?? "completed",
          paymentStatus: payment.status,
          refundReviewStatus: payment.refundReviewStatus,
          refundReason: payment.refundReason,
          refundRequestedAt: payment.refundRequestedAt,
          refundRequestedByRole: payment.refundRequestedByRole
        } satisfies OpsRefundSummaryItem;
      })
      .sort((left, right) =>
        (right.refundRequestedAt ?? "").localeCompare(left.refundRequestedAt ?? "")
      );

    const payoutHolds = bookings.reduce<OpsPayoutHoldSummaryItem[]>((items, booking) => {
        const payment = payments.find((candidate) => candidate.bookingId === booking.id);
        const holdReason = this.getPayoutHoldReason(booking, payment);
        if (!holdReason) {
          return items;
        }

        const customer = customerById.get(booking.customerId);
        const provider = providerById.get(booking.providerId);
        items.push({
          bookingId: booking.id,
          ...(payment?.id ? { paymentId: payment.id } : {}),
          ...(customer?.fullName ? { customerName: customer.fullName } : {}),
          ...(provider?.companyName ? { providerName: provider.companyName } : {}),
          category: booking.category,
          bookingStatus: booking.status,
          ...(payment?.status ? { paymentStatus: payment.status } : {}),
          amountCents: payment?.amountCents ?? booking.totalCents,
          holdReason,
          ...(holdReason === "refund-review"
            ? payment?.refundRequestedAt
              ? { openedAt: payment.refundRequestedAt }
              : {}
            : booking.disputedAt
              ? { openedAt: booking.disputedAt }
              : {}),
          ...(holdReason === "refund-review"
            ? payment?.refundRequestedByRole
              ? { openedByRole: payment.refundRequestedByRole }
              : {}
            : booking.disputedByRole
              ? { openedByRole: booking.disputedByRole }
              : {}),
          ...(holdReason === "refund-review"
            ? payment?.refundReason
              ? { notes: payment.refundReason }
              : {}
            : booking.disputeReason
              ? { notes: booking.disputeReason }
              : {})
        });
        return items;
      }, [])
      .sort((left, right) => (right.openedAt ?? "").localeCompare(left.openedAt ?? ""));

    const activeExceptions = bookings
      .filter(
        (booking) =>
          Boolean(booking.activeExceptionType) &&
          booking.status !== "completed" &&
          booking.status !== "cancelled" &&
          booking.status !== "refunded"
      )
      .map((booking) => {
        const customer = customerById.get(booking.customerId);
        const provider = providerById.get(booking.providerId);
        return {
          bookingId: booking.id,
          customerName: customer?.fullName,
          providerName: provider?.companyName,
          category: booking.category,
          bookingStatus: booking.status,
          exceptionType: booking.activeExceptionType as OpsBookingExceptionSummaryItem["exceptionType"],
          reportedAt: booking.activeExceptionReportedAt,
          notes: booking.activeExceptionNotes
        } satisfies OpsBookingExceptionSummaryItem;
      })
      .sort((left, right) => (right.reportedAt ?? "").localeCompare(left.reportedAt ?? ""));

    return {
      generatedAt: new Date().toISOString(),
      refundReviewOpenCount: refundReviews.length,
      refundedAmountLast30DaysCents: payments
        .filter(
          (payment) =>
            payment.status === "refunded" &&
            payment.refundReviewedAt &&
            new Date(payment.refundReviewedAt).getTime() >= thirtyDaysAgo
        )
        .reduce((sum, payment) => sum + payment.amountCents, 0),
      payoutHoldCount: payoutHolds.length,
      activeBookingExceptionCount: activeExceptions.length,
      disputedBookingCount: bookings.filter((booking) => booking.status === "disputed").length,
      openBillingTicketCount: tickets.filter(
        (ticket) => ticket.issueType === "billing" && ticket.status !== "resolved"
      ).length,
      payoutHolds,
      refundReviews,
      activeExceptions
    };
  }

  private getSupportOpsTicketEscalationProfile(input: {
    ticket: SupportTicket;
    booking?: Booking;
    payment?: PaymentRecord;
  }): {
    priority: SupportOpsTicketEscalationSweepItem["priority"];
    thresholdHours: number;
    signal: string;
  } {
    const payoutHoldReason = input.booking
      ? this.getPayoutHoldReason(input.booking, input.payment)
      : undefined;

    if (input.booking?.activeExceptionType) {
      return {
        priority: "urgent",
        thresholdHours: 2,
        signal: `active ${input.booking.activeExceptionType} field exception`
      };
    }
    if (input.booking?.status === "disputed" || payoutHoldReason === "dispute") {
      return {
        priority: "urgent",
        thresholdHours: 4,
        signal: "disputed booking payout hold"
      };
    }
    if (input.payment?.refundReviewStatus === "requested" || payoutHoldReason === "refund-review") {
      return {
        priority: "urgent",
        thresholdHours: 4,
        signal: "open refund review payout hold"
      };
    }
    if (input.ticket.issueType === "billing") {
      return {
        priority: "high",
        thresholdHours: 8,
        signal: "billing support issue"
      };
    }
    if (input.ticket.issueType === "service-quality") {
      return {
        priority: "high",
        thresholdHours: 8,
        signal: "service-quality support issue"
      };
    }
    return {
      priority: "normal",
      thresholdHours: 24,
      signal: `${input.ticket.issueType} support issue`
    };
  }

  private async processSupportOpsTicketEscalation(input: {
    ticket: SupportTicket;
    booking?: Booking;
    payment?: PaymentRecord;
    recipientId?: string;
    recipientRole?: AppNotification["recipientRole"];
    asOfMs: number;
    dryRun: boolean;
  }): Promise<SupportOpsTicketEscalationSweepItem> {
    const profile = this.getSupportOpsTicketEscalationProfile({
      ticket: input.ticket,
      booking: input.booking,
      payment: input.payment
    });
    const openedMs = Date.parse(input.ticket.createdAt);
    const updatedMs = Date.parse(input.ticket.updatedAt);
    const safeOpenedMs = Number.isFinite(openedMs) ? openedMs : input.asOfMs;
    const safeUpdatedMs = Number.isFinite(updatedMs) ? updatedMs : safeOpenedMs;
    const ageHours = Number(Math.max(0, (input.asOfMs - safeOpenedMs) / (60 * 60 * 1000)).toFixed(2));
    const hoursSinceUpdate = Number(
      Math.max(0, (input.asOfMs - safeUpdatedMs) / (60 * 60 * 1000)).toFixed(2)
    );
    const notificationTitle = `Support SLA escalation: ${input.ticket.subject}`;
    const notificationBody =
      `${profile.signal} has been ${input.ticket.status} for ${hoursSinceUpdate} hours since the last update ` +
      `(${ageHours} hours since opened). Review ticket ${input.ticket.id}` +
      `${input.ticket.bookingId ? ` for booking ${input.ticket.bookingId}` : ""}.`;
    const baseItem = {
      ticketId: input.ticket.id,
      bookingId: input.ticket.bookingId,
      issueType: input.ticket.issueType,
      ticketStatus: input.ticket.status,
      priority: profile.priority,
      openedAtIso: input.ticket.createdAt,
      lastUpdatedAtIso: input.ticket.updatedAt,
      ageHours,
      hoursSinceUpdate,
      escalationThresholdHours: profile.thresholdHours,
      recipientId: input.recipientId,
      recipientRole: input.recipientRole,
      notificationTitle,
      notificationBody
    } satisfies Omit<
      SupportOpsTicketEscalationSweepItem,
      "escalationStatus" | "reason" | "notificationId"
    >;

    if (input.ticket.status === "resolved") {
      return {
        ...baseItem,
        escalationStatus: "resolved",
        reason: "Support ticket is already resolved."
      };
    }
    if (hoursSinceUpdate < profile.thresholdHours) {
      return {
        ...baseItem,
        escalationStatus: "not-due",
        reason: `Ticket has not passed the ${profile.thresholdHours}-hour ${profile.priority} SLA threshold.`
      };
    }
    if (!input.recipientId || !input.recipientRole) {
      return {
        ...baseItem,
        escalationStatus: "no-recipient",
        reason: "No ops recipient is available for this support escalation."
      };
    }

    const marker = this.buildSupportOpsTicketEscalationMarker(input.ticket.id);
    const existingNotification = (await this.repository.listNotificationsByRecipient(input.recipientId)).find(
      (notification) =>
        notification.category === "support" &&
        notification.actionHref === "/ops/support" &&
        notification.body.includes(marker)
    );
    if (existingNotification) {
      return {
        ...baseItem,
        escalationStatus: "already-sent",
        notificationId: existingNotification.id,
        reason: "A matching support SLA escalation notification already exists."
      };
    }

    if (input.dryRun) {
      return {
        ...baseItem,
        escalationStatus: "dry-run",
        reason: "Dry run requested; no support escalation notification was created."
      };
    }

    const notification = await this.createNotification({
      recipientId: input.recipientId,
      recipientRole: input.recipientRole,
      category: "support",
      title: notificationTitle,
      body: `${notificationBody}\n\n${marker}`,
      actionHref: "/ops/support"
    });

    return {
      ...baseItem,
      escalationStatus: "sent",
      notificationId: notification.id,
      reason: "Support SLA escalation notification created."
    };
  }

  private buildSupportOpsTicketEscalationMarker(ticketId: string) {
    return `Support SLA escalation: ${ticketId}`;
  }

  public async escalateStaleOpsSupportTickets(
    actor: AuthIdentityRecord,
    payload: ProcessSupportOpsTicketEscalationsRequest = {}
  ): Promise<SupportOpsTicketEscalationSweepResponse> {
    if (actor.role !== "ops") {
      throw new HttpError(403, "Only operations can escalate support tickets");
    }

    const asOfMs = payload.asOfIso ? Date.parse(payload.asOfIso) : Date.now();
    if (!Number.isFinite(asOfMs)) {
      throw new HttpError(400, "asOfIso must be a valid ISO timestamp");
    }
    const asOfIso = new Date(asOfMs).toISOString();
    const [allTickets, bookings, payments, opsUsers] = await Promise.all([
      this.repository.listSupportTickets(),
      this.repository.listBookings(),
      this.repository.listPayments(),
      this.repository.listOpsUsers()
    ]);
    const tickets = allTickets.filter((ticket) => !payload.ticketId || ticket.id === payload.ticketId);
    if (payload.ticketId && tickets.length === 0) {
      throw new HttpError(404, "Support ticket not found");
    }
    const bookingById = new Map(bookings.map((booking) => [booking.id, booking]));
    const paymentByBookingId = new Map(payments.map((payment) => [payment.bookingId, payment]));
    const recipients = opsUsers.map((opsUser) => ({
      recipientId: opsUser.id,
      recipientRole: "ops" as const
    }));
    const items: SupportOpsTicketEscalationSweepItem[] = [];

    for (const ticket of tickets) {
      const booking = ticket.bookingId ? bookingById.get(ticket.bookingId) : undefined;
      const payment = booking ? paymentByBookingId.get(booking.id) : undefined;
      if (recipients.length === 0) {
        items.push(
          await this.processSupportOpsTicketEscalation({
            ticket,
            booking,
            payment,
            asOfMs,
            dryRun: Boolean(payload.dryRun)
          })
        );
        continue;
      }

      for (const recipient of recipients) {
        items.push(
          await this.processSupportOpsTicketEscalation({
            ticket,
            booking,
            payment,
            recipientId: recipient.recipientId,
            recipientRole: recipient.recipientRole,
            asOfMs,
            dryRun: Boolean(payload.dryRun)
          })
        );
      }
    }

    const dueEscalationCount = items.filter((item) =>
      ["sent", "already-sent", "dry-run"].includes(item.escalationStatus)
    ).length;
    const sentNotificationCount = items.filter((item) => item.escalationStatus === "sent").length;
    const alreadySentCount = items.filter((item) => item.escalationStatus === "already-sent").length;

    return {
      generatedAt: new Date().toISOString(),
      asOfIso,
      dryRun: Boolean(payload.dryRun),
      ticketCount: tickets.length,
      candidateEscalationCount: items.length,
      dueEscalationCount,
      sentNotificationCount,
      alreadySentCount,
      skippedEscalationCount: items.length - dueEscalationCount,
      items
    };
  }

  public async updateSupportTicketForOps(
    payload: UpdateSupportTicketRequest
  ): Promise<SupportTicket> {
    const ticket = (await this.repository.listSupportTickets()).find(
      (candidate) => candidate.id === payload.ticketId
    );
    if (!ticket) {
      throw new HttpError(404, "Support ticket not found");
    }

    const now = new Date().toISOString();
    const resolutionNotes = payload.resolutionNotes?.trim() || undefined;
    if (payload.status === "resolved" && !resolutionNotes) {
      throw new HttpError(400, "Resolution notes are required when resolving a support ticket");
    }

    if (ticket.bookingId) {
      const booking = await this.repository.findBookingById(ticket.bookingId);
      if (booking) {
        if (payload.status === "resolved") {
          const latestPayment = await this.findLatestPaymentForBooking(booking.id);
          this.assertEvidenceReviewedBeforeSensitiveSupportResolution(
            ticket,
            booking,
            payload.resolutionAction
          );
          this.assertDetailedRationaleForLowConfidenceSensitiveSupportResolution(
            ticket,
            booking,
            payload.resolutionAction,
            resolutionNotes
          );
          this.assertRefundReviewBeforePaidCompletedDisputeCancellation(
            booking,
            latestPayment,
            payload.resolutionAction
          );
          if (payload.resolutionAction === "approve-refund" || payload.resolutionAction === "deny-refund") {
            await this.applySupportResolutionToRefund(booking, payload.resolutionAction, resolutionNotes as string);
          } else {
            await this.applySupportResolutionToBooking(booking, payload.resolutionAction);
          }
        } else if (payload.status === "triaged" && booking.status === "disputed") {
          await this.createNotification({
            recipientId: booking.customerId,
            recipientRole: "customer",
            category: "support",
            title: "Dispute under review",
            body: "YardMatch support has triaged your dispute and is reviewing next steps.",
            actionHref: `/customer/dashboard?bookingId=${booking.id}&issue=dispute`
          });
        }
        if (payload.status === "triaged" && ticket.issueType === "billing") {
          await Promise.all([
            this.createNotification({
              recipientId: booking.customerId,
              recipientRole: "customer",
              category: "support",
              title: "Refund review under review",
              body: "YardMatch support triaged your refund request and is reviewing next steps.",
              actionHref: `/customer/dashboard?bookingId=${booking.id}`
            }),
            this.createNotification({
              recipientId: booking.providerId,
              recipientRole: "provider",
              category: "support",
              title: "Refund review under review",
              body: "YardMatch support triaged the refund request tied to this booking.",
              actionHref: `/provider/management?bookingId=${booking.id}`
            })
          ]);
        }
      }
    }

    const updatedTicket = await this.repository.updateSupportTicket(ticket.id, {
      status: payload.status,
      updatedAt: now,
      triagedAt: payload.status === "triaged" ? ticket.triagedAt ?? now : ticket.triagedAt,
      resolvedAt: payload.status === "resolved" ? now : ticket.resolvedAt,
      resolutionNotes,
      resolutionAction: payload.status === "resolved" ? payload.resolutionAction : undefined
    });

    if (!updatedTicket) {
      throw new HttpError(500, "Support ticket could not be updated");
    }

    return updatedTicket;
  }

  private getInterventionNextStatus(
    booking: Booking,
    action: CreateOpsBookingInterventionRequest["action"]
  ): Booking["status"] | undefined {
    if (action === "cancel-booking") {
      return "cancelled";
    }

    if (action === "complete-booking") {
      return "completed";
    }

    if (action === "restore-active-booking") {
      return this.getResolvedActiveBookingStatus(booking);
    }

    if (action === "reschedule-booking") {
      return "confirmed";
    }

    return undefined;
  }

  private getResolutionActionForIntervention(
    action: CreateOpsBookingInterventionRequest["action"]
  ): UpdateSupportTicketRequest["resolutionAction"] | undefined {
    if (action === "restore-active-booking") {
      return "restore-active-booking";
    }

    if (action === "complete-booking") {
      return "complete-booking";
    }

    if (action === "cancel-booking") {
      return "cancel-booking";
    }

    return undefined;
  }

  private async applyOpsBookingIntervention(
    booking: Booking,
    payload: CreateOpsBookingInterventionRequest,
    intervention: BookingInterventionRecord,
    now: string
  ): Promise<Booking> {
    const baseUpdates: Partial<Booking> = {
      interventions: [...booking.interventions, intervention]
    };

    if (payload.action === "add-note") {
      const notedBooking = await this.repository.updateBooking(booking.id, baseUpdates);
      if (!notedBooking) {
        throw new HttpError(500, "Booking intervention note could not be saved");
      }
      return notedBooking;
    }

    if (payload.action === "reschedule-booking") {
      const rescheduledBooking = await this.repository.updateBooking(booking.id, {
        ...baseUpdates,
        scheduledStartIso: payload.scheduledStartIso,
        scheduledEndIso: payload.scheduledEndIso,
        status: "confirmed",
        onRouteConfirmedAt: undefined,
        onRouteConfirmedByCrewMemberId: undefined,
        lateNoticeSentAt: undefined,
        lateEtaIso: undefined,
        lateReason: undefined,
        activeExceptionType: undefined,
        activeExceptionReportedAt: undefined,
        activeExceptionNotes: undefined,
        disputedAt: undefined,
        disputeReason: undefined,
        disputedByRole: undefined,
        completedAt: undefined
      });
      if (!rescheduledBooking) {
        throw new HttpError(500, "Booking could not be rescheduled");
      }

      await this.notifyOpsBookingIntervention(
        booking,
        "Support rescheduled your booking",
        `YardMatch support moved this booking to ${this.formatBookingWindowWithDate(payload.scheduledStartIso ?? booking.scheduledStartIso)}.`
      );
      return rescheduledBooking;
    }

    if (payload.action === "cancel-booking") {
      const cancelledBooking = await this.repository.updateBooking(booking.id, {
        ...baseUpdates,
        status: "cancelled",
        activeExceptionType: undefined,
        activeExceptionReportedAt: undefined,
        activeExceptionNotes: undefined,
        disputedAt: undefined,
        disputeReason: undefined,
        disputedByRole: undefined
      });
      if (!cancelledBooking) {
        throw new HttpError(500, "Booking could not be cancelled");
      }

      await this.notifyOpsBookingIntervention(
        booking,
        "Support cancelled your booking",
        "YardMatch support cancelled this booking after review."
      );
      return cancelledBooking;
    }

    if (payload.action === "complete-booking") {
      const completedBooking = await this.repository.updateBooking(booking.id, {
        ...baseUpdates,
        status: "completed",
        completedAt: booking.completedAt ?? now,
        activeExceptionType: undefined,
        activeExceptionReportedAt: undefined,
        activeExceptionNotes: undefined,
        disputedAt: undefined,
        disputeReason: undefined,
        disputedByRole: undefined
      });
      if (!completedBooking) {
        throw new HttpError(500, "Booking could not be completed");
      }

      const existingInvite = await this.repository.findReviewInviteByBookingId(booking.id);
      if (!existingInvite) {
        const customer = await this.repository.findCustomerById(booking.customerId);
        if (customer) {
          await this.repository.createReviewInvite(
            this.buildReviewInvite(completedBooking, customer.email, completedBooking.completedAt ?? now)
          );
        }
      }

      await this.notifyOpsBookingIntervention(
        booking,
        "Support marked your booking complete",
        "YardMatch support reviewed the service record and marked this booking complete."
      );
      return completedBooking;
    }

    const restoredStatus = this.getResolvedActiveBookingStatus(booking);
    const restoredBooking = await this.repository.updateBooking(booking.id, {
      ...baseUpdates,
      status: restoredStatus,
      activeExceptionType: undefined,
      activeExceptionReportedAt: undefined,
      activeExceptionNotes: undefined,
      disputedAt: undefined,
      disputeReason: undefined,
      disputedByRole: undefined
    });
    if (!restoredBooking) {
      throw new HttpError(500, "Booking could not be restored");
    }

    await this.notifyOpsBookingIntervention(
      booking,
      restoredStatus === "completed" ? "Support kept your booking complete" : "Support restored your booking",
      restoredStatus === "completed"
        ? "YardMatch support reviewed the issue and kept this booking marked complete."
        : "YardMatch support reviewed the issue and restored this booking to the active schedule."
    );
    return restoredBooking;
  }

  private async notifyOpsBookingIntervention(
    booking: Booking,
    customerTitle: string,
    body: string
  ): Promise<void> {
    await Promise.all([
      this.createNotification({
        recipientId: booking.customerId,
        recipientRole: "customer",
        category: "support",
        title: customerTitle,
        body,
        actionHref: `/customer/dashboard?bookingId=${booking.id}`
      }),
      this.createNotification({
        recipientId: booking.providerId,
        recipientRole: "provider",
        category: "support",
        title: customerTitle,
        body,
        actionHref: `/provider/management?bookingId=${booking.id}`
      })
    ]);
  }

  public createAnalyticsEvent(payload: AnalyticsEvent): AnalyticsEvent {
    return this.analytics.record(payload);
  }

  private async applySupportResolutionToBooking(
    booking: Booking,
    resolutionAction: UpdateSupportTicketRequest["resolutionAction"]
  ): Promise<void> {
    const action =
      resolutionAction ??
      (this.getResolvedActiveBookingStatus(booking) === "completed"
        ? "complete-booking"
        : "restore-active-booking");

    const baseUpdates: Partial<Booking> = {
      activeExceptionType: undefined,
      activeExceptionReportedAt: undefined,
      activeExceptionNotes: undefined,
      disputeReason: undefined,
      disputedAt: undefined,
      disputedByRole: undefined
    };

    if (action === "cancel-booking") {
      await this.repository.updateBooking(booking.id, {
        ...baseUpdates,
        status: "cancelled"
      });
      await this.createNotification({
        recipientId: booking.customerId,
        recipientRole: "customer",
        category: "support",
        title: "Support resolved your booking issue",
        body: "YardMatch support closed the ticket and cancelled the booking.",
        actionHref: `/customer/dashboard?bookingId=${booking.id}`
      });
      return;
    }

    if (action === "complete-booking") {
      await this.repository.updateBooking(booking.id, {
        ...baseUpdates,
        status: "completed",
        completedAt: booking.completedAt ?? new Date().toISOString()
      });
      await this.createNotification({
        recipientId: booking.customerId,
        recipientRole: "customer",
        category: "support",
        title: "Support resolved your booking issue",
        body: "YardMatch support closed the ticket and marked the service complete.",
        actionHref: `/customer/dashboard?bookingId=${booking.id}`
      });
      return;
    }

    const restoredStatus = this.getResolvedActiveBookingStatus(booking);

    await this.repository.updateBooking(booking.id, {
      ...baseUpdates,
      status: restoredStatus
    });
    await this.createNotification({
      recipientId: booking.customerId,
      recipientRole: "customer",
      category: "support",
      title: "Support resolved your booking issue",
      body:
        restoredStatus === "completed"
          ? "YardMatch support reviewed the issue and kept the booking marked complete."
          : "YardMatch support reviewed the issue and restored the booking to the active schedule.",
      actionHref: `/customer/dashboard?bookingId=${booking.id}`
    });
  }

  private async applySupportResolutionToRefund(
    booking: Booking,
    resolutionAction: "approve-refund" | "deny-refund",
    resolutionNotes: string
  ): Promise<void> {
    const payment = (await this.repository.listPayments())
      .filter((candidate) => candidate.bookingId === booking.id)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];

    if (!payment) {
      throw new HttpError(404, "Payment record not found for this booking");
    }

    if (payment.refundReviewStatus !== "requested") {
      throw new HttpError(409, "There is no active refund review to resolve for this payment");
    }

    const now = new Date().toISOString();

    if (resolutionAction === "approve-refund") {
      await this.syncApprovedRefundIfNeeded(payment, booking);
      const updatedPayment = await this.repository.updatePayment(payment.id, {
        status: "refunded",
        refundable: false,
        refundReviewStatus: "approved",
        refundReviewedAt: now,
        refundReviewedByRole: "ops",
        refundDecisionNotes: resolutionNotes,
        updatedAt: now
      });
      if (!updatedPayment) {
        throw new HttpError(500, "Payment record could not be updated");
      }

      await this.repository.updateBooking(booking.id, {
        status: "refunded"
      });

      this.analytics.recordFunnelStep(MarketplaceTelemetryEventCatalog.refundCompleted, booking.id, {
        paymentId: updatedPayment.id
      });

      await Promise.all([
        this.createNotification({
          recipientId: booking.customerId,
          recipientRole: "customer",
          category: "support",
          title: "Refund approved",
          body: "YardMatch support approved this refund request and reversed the customer payment.",
          actionHref: `/customer/dashboard?bookingId=${booking.id}`
        }),
        this.createNotification({
          recipientId: booking.providerId,
          recipientRole: "provider",
          category: "support",
          title: "Refund approved",
          body: "YardMatch support approved the refund review tied to this booking.",
          actionHref: `/provider/management?bookingId=${booking.id}`
        })
      ]);
      return;
    }

    const updatedPayment = await this.repository.updatePayment(payment.id, {
      status: "captured",
      refundable: true,
      refundReviewStatus: "denied",
      refundReviewedAt: now,
      refundReviewedByRole: "ops",
      refundDecisionNotes: resolutionNotes,
      updatedAt: now
    });
    if (!updatedPayment) {
      throw new HttpError(500, "Payment record could not be updated");
    }

    await Promise.all([
      this.createNotification({
        recipientId: booking.customerId,
        recipientRole: "customer",
        category: "support",
        title: "Refund request denied",
        body: "YardMatch support reviewed this refund request and left the payment in place.",
        actionHref: `/customer/dashboard?bookingId=${booking.id}`
      }),
      this.createNotification({
        recipientId: booking.providerId,
        recipientRole: "provider",
        category: "support",
        title: "Refund request denied",
        body: "YardMatch support closed the refund review and kept the payment captured.",
        actionHref: `/provider/management?bookingId=${booking.id}`
      })
    ]);
  }

  private async syncApprovedRefundIfNeeded(payment: PaymentRecord, booking: Booking): Promise<void> {
    if (payment.processor !== "stripe") {
      return;
    }

    if (!payment.processorPaymentIntentId) {
      throw new HttpError(
        409,
        "Stripe refund sync requires a saved payment intent before ops can approve this refund."
      );
    }

    await this.stripeCheckout.createRefund({
      paymentIntentId: payment.processorPaymentIntentId,
      amountCents: payment.amountCents,
      reason: payment.refundReason ?? "Refund review approved by YardMatch support.",
      bookingId: booking.id,
      paymentId: payment.id
    });
  }

  private async markPaymentRefundedFromProcessor(
    payment: PaymentRecord,
    booking: Booking
  ): Promise<PaymentRecord> {
    const wasAlreadyRefunded = payment.status === "refunded";
    if (wasAlreadyRefunded && booking.status === "refunded") {
      return payment;
    }

    const now = new Date().toISOString();
    const refundReviewResolved = payment.refundReviewStatus === "requested";
    const updatedPayment = await this.repository.updatePayment(payment.id, {
      status: "refunded",
      refundable: false,
      refundReviewStatus: refundReviewResolved ? "approved" : payment.refundReviewStatus,
      refundReviewedAt: refundReviewResolved ? payment.refundReviewedAt ?? now : payment.refundReviewedAt,
      refundReviewedByRole: refundReviewResolved ? payment.refundReviewedByRole ?? "ops" : payment.refundReviewedByRole,
      refundDecisionNotes:
        payment.refundDecisionNotes ?? "Refund synchronized from Stripe webhook.",
      updatedAt: now
    });

    if (!updatedPayment) {
      throw new HttpError(500, "Payment record could not be updated");
    }

    if (booking.status !== "refunded") {
      const updatedBooking = await this.repository.updateBooking(booking.id, {
        status: "refunded"
      });
      if (!updatedBooking) {
        throw new HttpError(500, "Booking record could not be updated");
      }
    }

    if (!wasAlreadyRefunded) {
      this.analytics.recordFunnelStep(MarketplaceTelemetryEventCatalog.refundCompleted, booking.id, {
        paymentId: updatedPayment.id,
        processor: updatedPayment.processor,
        source: "stripe-webhook"
      });
    }

    return updatedPayment;
  }

  public async processReviewInvites(
    payload: ProcessReviewInvitesRequest = {}
  ): Promise<ProcessReviewInvitesResponse> {
    const now = payload.nowIso ? new Date(payload.nowIso) : new Date();
    const sentAt = now.toISOString();
    const dispatches = (await this.repository
      .listScheduledReviewInvites())
      .filter((invite) => {
        if (new Date(invite.expiresAtIso).getTime() <= now.getTime()) {
          void this.repository.updateReviewInvite(invite.id, {
            status: "expired"
          });
          return false;
        }

        return new Date(invite.scheduledSendIso).getTime() <= now.getTime();
      })
      .map(async (invite) => {
        const updatedInvite = await this.repository.updateReviewInvite(invite.id, {
          status: "sent",
          sentAt
        });

        if (!updatedInvite) {
          throw new Error("Review invite could not be updated");
        }

        this.analytics.record({
          id: crypto.randomUUID(),
          name: MarketplaceTelemetryEventCatalog.reviewInviteSent,
          actorId: updatedInvite.customerId,
          occurredAt: sentAt,
          properties: {
            bookingId: updatedInvite.bookingId,
            providerId: updatedInvite.providerId,
            channelCount: updatedInvite.channels.length
          }
        });

        await this.createNotification({
          recipientId: updatedInvite.customerId,
          recipientRole: "customer",
          category: "review",
          title: "Leave your service review",
          body: "Your review window is now open for a completed YardMatch service.",
          actionHref: "/customer/dashboard"
        });

        return {
          inviteId: updatedInvite.id,
          bookingId: updatedInvite.bookingId,
          customerId: updatedInvite.customerId,
          email: updatedInvite.email,
          scheduledSendIso: updatedInvite.scheduledSendIso,
          sentAt,
          deepLinkPath: updatedInvite.deepLinkPath,
          subject: "How did your YardMatch service go?",
          templateKey: "review-invite-v1"
        } satisfies ReviewInviteDispatch;
      });

    return {
      dispatches: await Promise.all(dispatches)
    };
  }

  public recordSessionHeartbeat(payload: SessionHeartbeatRequest): ActiveSession {
    return this.analytics.recordSessionHeartbeat(payload);
  }

  public async getObservabilityOverview(): Promise<ObservabilityOverview> {
    const [bookings, launchLeads, reviewInvites, supportTickets, providers, opsUsers] = await Promise.all([
      this.repository.listBookings(),
      this.repository.listLaunchLeads(),
      this.repository.listReviewInvites(),
      this.repository.listSupportTickets(),
      this.repository.listProviders(),
      this.repository.listOpsUsers()
    ]);
    const opsIdentities = await Promise.all(
      opsUsers.map((opsUser) => this.repository.findAuthIdentityByUserId(opsUser.id))
    );
    const opsAccounts = opsUsers.map((profile, index) => this.buildOpsAccountSummary(profile, opsIdentities[index]));

    const overview = this.analytics.getOverview({
      bookings,
      launchLeads,
      reviewInvites,
      supportTickets
    });
    const providerReviews = (
      await Promise.all(providers.map((provider) => this.repository.listProviderReviews(provider.id)))
    ).flat();
    const recentReviewResponses = this.buildOpsReviewResponseQueue(
      providerReviews,
      bookings,
      providers,
      supportTickets
    );
    const inboundAutomationOverview = this.buildInboundAutomationOverview(
      launchLeads,
      providerReviews
    );
    const opsAccessAudit = this.buildOpsAccessAuditOverview(opsAccounts);
    const providersById = new Map(providers.map((provider) => [provider.id, provider.companyName]));
    const retentionMetricsByProvider = overview.retentionMetricsByProvider.map((metric) => ({
      ...metric,
      providerName: providersById.get(metric.providerId) ?? metric.providerName
    }));

    return {
      ...overview,
      pendingReviewResponses: recentReviewResponses.filter((item) => item.responseStatus === "pending").length,
      urgentReviewResponses: recentReviewResponses.filter(
        (item) => item.responseStatus === "pending" && item.priority === "urgent"
      ).length,
      watchReviewResponses: recentReviewResponses.filter(
        (item) => item.responseStatus === "pending" && item.priority === "watch"
      ).length,
      overdueReviewResponses: recentReviewResponses.filter(
        (item) => item.responseStatus === "pending" && item.isResponseOverdue
      ).length,
      recentReviewResponses,
      inboundAutomationSourceMetrics: inboundAutomationOverview.sourceMetrics,
      inboundAutomationAlerts: inboundAutomationOverview.alerts,
      recentInboundAutomationActivity: inboundAutomationOverview.recentActivity,
      totalOpsAccounts: opsAccessAudit.totalOpsAccounts,
      activeOpsAdminAccounts: opsAccessAudit.activeOpsAdminAccounts,
      activeOpsStaffAccounts: opsAccessAudit.activeOpsStaffAccounts,
      disabledOpsAccounts: opsAccessAudit.disabledOpsAccounts,
      lockedOpsAccounts: opsAccessAudit.lockedOpsAccounts,
      dormantOpsAccounts: opsAccessAudit.dormantOpsAccounts,
      neverSignedInOpsAccounts: opsAccessAudit.neverSignedInOpsAccounts,
      opsAccountsWithRecentFailures: opsAccessAudit.opsAccountsWithRecentFailures,
      pendingOpsPasswordResetInvites: opsAccessAudit.pendingOpsPasswordResetInvites,
      opsAccessPolicy: opsAccessAudit.opsAccessPolicy,
      launchOperationsPolicy: this.buildLaunchOperationsPolicy(bookings, supportTickets, providers),
      accessAlerts: opsAccessAudit.accessAlerts,
      recentOpsAccessChanges: opsAccessAudit.recentOpsAccessChanges,
      recentOpsAuthenticationEvents: opsAccessAudit.recentOpsAuthenticationEvents,
      recentOpsSignIns: opsAccessAudit.recentOpsSignIns,
      recentFailedOpsSignIns: opsAccessAudit.recentFailedOpsSignIns,
      recommendationInsights: this.buildRecommendationInsights({
        providerSearches: overview.providerSearches,
        providerSearchesNoResults: overview.providerSearchesNoResults,
        providerSearchesNoOpenWindows: overview.providerSearchesNoOpenWindows,
        providerSearchCoverageRate: overview.providerSearchCoverageRate,
        providerSearchOpenWindowRate: overview.providerSearchOpenWindowRate,
        recommendationViews: overview.recommendationViews,
        recommendationBookingIntents: overview.recommendationBookingIntents,
        recommendationBookingIntentRate: overview.recommendationBookingIntentRate,
        acceptedRecommendations: overview.acceptedRecommendations,
        swappedRecommendations: overview.swappedRecommendations,
        recommendationAcceptanceRate: overview.recommendationAcceptanceRate,
        recommendationSwapRate: overview.recommendationSwapRate,
        sourceMetrics: overview.recommendationMetricsBySource
      }),
      retentionMetricsByProvider,
      retentionInsights: this.buildRetentionInsights({
        promptViews: overview.retentionPromptViews,
        promptAccepts: overview.retentionPromptAccepts,
        strategyMetrics: overview.retentionMetricsByStrategy,
        sourceMetrics: overview.retentionMetricsBySource,
        providerMetrics: retentionMetricsByProvider
      })
    };
  }

  private buildRecommendationInsights(input: {
    providerSearches: number;
    providerSearchesNoResults: number;
    providerSearchesNoOpenWindows: number;
    providerSearchCoverageRate: number;
    providerSearchOpenWindowRate: number;
    recommendationViews: number;
    recommendationBookingIntents: number;
    recommendationBookingIntentRate: number;
    acceptedRecommendations: number;
    swappedRecommendations: number;
    recommendationAcceptanceRate: number;
    recommendationSwapRate: number;
    sourceMetrics: ObservabilityOverview["recommendationMetricsBySource"];
  }): ObservabilityOverview["recommendationInsights"] {
    const insights: ObservabilityOverview["recommendationInsights"] = [];
    const hasLowVolume = input.recommendationViews < 10 || input.recommendationBookingIntents < 3;

    insights.push({
      kind: "volume",
      status: hasLowVolume ? "needs-volume" : "working",
      title: hasLowVolume
        ? "Recommendation signal still needs volume"
        : "Recommendation signal has enough early volume",
      detail: `${input.recommendationViews} recommendation view${
        input.recommendationViews === 1 ? "" : "s"
      }, ${input.recommendationBookingIntents} booking intent${
        input.recommendationBookingIntents === 1 ? "" : "s"
      }, and ${input.acceptedRecommendations + input.swappedRecommendations} booking selection${
        input.acceptedRecommendations + input.swappedRecommendations === 1 ? "" : "s"
      } are currently attributed.`,
      recommendedAction: hasLowVolume
        ? "Keep tracking by surface, but treat acceptance, swap, and reveal rates as directional until at least 10 views and 3 booking intents exist."
        : "Review source-level acceptance, swap, and handoff rates weekly before changing ranking weights or exposing more alternatives.",
      recommendationViews: input.recommendationViews,
      recommendationBookingIntents: input.recommendationBookingIntents,
      acceptedRecommendations: input.acceptedRecommendations,
      swappedRecommendations: input.swappedRecommendations,
      rate: input.recommendationAcceptanceRate
    });

    const weakestCoverage = [...input.sourceMetrics]
      .filter((metric) => metric.providerSearches >= 2)
      .sort((left, right) => {
        const openWindowDelta = left.providerSearchOpenWindowRate - right.providerSearchOpenWindowRate;
        if (openWindowDelta !== 0) {
          return openWindowDelta;
        }

        return left.providerSearchCoverageRate - right.providerSearchCoverageRate;
      })[0];
    if (
      weakestCoverage &&
      (weakestCoverage.providerSearchCoverageRate < 0.8 || weakestCoverage.providerSearchOpenWindowRate < 0.7)
    ) {
      insights.push({
        kind: "coverage",
        status: "watch",
        title: `${weakestCoverage.requestSource} recommendation coverage needs attention`,
        detail: `${weakestCoverage.providerSearches} search session${
          weakestCoverage.providerSearches === 1 ? "" : "s"
        } show ${weakestCoverage.providerSearchCoverageRate.toFixed(2)} coverage and ${weakestCoverage.providerSearchOpenWindowRate.toFixed(2)} open-window rate.`,
        recommendedAction:
          "Review ZIP/category supply for this source before sending more launch traffic or relaxing fallback-area confidence.",
        requestSource: weakestCoverage.requestSource,
        providerSearches: weakestCoverage.providerSearches,
        recommendationViews: weakestCoverage.recommendationViews,
        rate: weakestCoverage.providerSearchOpenWindowRate
      });
    }

    const weakHandoff = [...input.sourceMetrics]
      .filter((metric) => metric.recommendationViews >= 2)
      .filter(
        (metric) =>
          metric.recommendationBookingIntentRate < 0.35 ||
          metric.recommendationDismissalRate >= 0.35 ||
          metric.recommendationSwapRate >= 0.35
      )
      .sort((left, right) => {
        const dismissalDelta = right.recommendationDismissalRate - left.recommendationDismissalRate;
        if (dismissalDelta !== 0) {
          return dismissalDelta;
        }

        return left.recommendationBookingIntentRate - right.recommendationBookingIntentRate;
      })[0];
    if (weakHandoff) {
      insights.push({
        kind: "handoff",
        status: "watch",
        title: `${weakHandoff.requestSource} recommendation handoff is weak`,
        detail: `${weakHandoff.recommendationViews} view${
          weakHandoff.recommendationViews === 1 ? "" : "s"
        } produced ${weakHandoff.recommendationBookingIntents} booking intent${
          weakHandoff.recommendationBookingIntents === 1 ? "" : "s"
        }, ${weakHandoff.recommendationDismissals} dismissal${
          weakHandoff.recommendationDismissals === 1 ? "" : "s"
        }, and ${weakHandoff.swappedRecommendations} swap${weakHandoff.swappedRecommendations === 1 ? "" : "s"}.`,
        recommendedAction:
          "Inspect recommendation explanation, price confidence, and alternative-provider reveal behavior for this surface before changing ranking.",
        requestSource: weakHandoff.requestSource,
        recommendationViews: weakHandoff.recommendationViews,
        recommendationBookingIntents: weakHandoff.recommendationBookingIntents,
        acceptedRecommendations: weakHandoff.acceptedRecommendations,
        swappedRecommendations: weakHandoff.swappedRecommendations,
        rate: weakHandoff.recommendationBookingIntentRate
      });
    }

    const strongestSource = [...input.sourceMetrics]
      .filter((metric) => metric.recommendationViews >= 2 || metric.recommendationBookingIntents > 0)
      .sort((left, right) => {
        const acceptanceDelta = right.recommendationAcceptanceRate - left.recommendationAcceptanceRate;
        if (acceptanceDelta !== 0) {
          return acceptanceDelta;
        }

        return right.recommendationBookingIntentRate - left.recommendationBookingIntentRate;
      })[0];
    if (strongestSource) {
      insights.push({
        kind: "surface",
        status: strongestSource.recommendationAcceptanceRate >= 0.5 ? "working" : "needs-volume",
        title: `${strongestSource.requestSource} is the strongest recommendation surface`,
        detail: `${strongestSource.recommendationViews} view${
          strongestSource.recommendationViews === 1 ? "" : "s"
        } produced ${strongestSource.acceptedRecommendations} accepted recommendation${
          strongestSource.acceptedRecommendations === 1 ? "" : "s"
        } and ${strongestSource.swappedRecommendations} swap${strongestSource.swappedRecommendations === 1 ? "" : "s"}.`,
        recommendedAction:
          strongestSource.recommendationAcceptanceRate >= 0.5
            ? "Keep this source active and compare whether stronger traffic volume preserves first-choice acceptance."
            : "Keep collecting source-level data before using this surface to tune ranking or alternative-provider exposure.",
        requestSource: strongestSource.requestSource,
        providerSearches: strongestSource.providerSearches,
        recommendationViews: strongestSource.recommendationViews,
        recommendationBookingIntents: strongestSource.recommendationBookingIntents,
        acceptedRecommendations: strongestSource.acceptedRecommendations,
        swappedRecommendations: strongestSource.swappedRecommendations,
        rate: strongestSource.recommendationAcceptanceRate
      });
    }

    return insights.slice(0, 4);
  }

  private buildRetentionInsights(input: {
    promptViews: number;
    promptAccepts: number;
    strategyMetrics: ObservabilityOverview["retentionMetricsByStrategy"];
    sourceMetrics: ObservabilityOverview["retentionMetricsBySource"];
    providerMetrics: ObservabilityOverview["retentionMetricsByProvider"];
  }): ObservabilityOverview["retentionInsights"] {
    const insights: ObservabilityOverview["retentionInsights"] = [];
    const bookingRequests = input.sourceMetrics.reduce((sum, metric) => sum + metric.bookingRequests, 0);
    const hasLowVolume = input.promptViews < 10 || bookingRequests < 3;

    insights.push({
      kind: "volume",
      status: hasLowVolume ? "needs-volume" : "working",
      title: hasLowVolume ? "Retention signal still needs volume" : "Retention signal has enough early volume",
      detail: `${input.promptViews} retention prompt view${input.promptViews === 1 ? "" : "s"}, ${input.promptAccepts} accept${input.promptAccepts === 1 ? "" : "s"}, and ${bookingRequests} repeat booking request${bookingRequests === 1 ? "" : "s"} are currently attributed.`,
      recommendedAction: hasLowVolume
        ? "Keep the retention nudges live, but treat strategy, source, and provider comparisons as directional until at least 10 views and 3 repeat bookings exist."
        : "Review strategy, source, and provider metrics weekly and prune prompts that create clicks without repeat bookings.",
      promptViews: input.promptViews,
      promptAccepts: input.promptAccepts,
      bookingRequests,
      rate: input.promptViews > 0 ? input.promptAccepts / input.promptViews : 0
    });

    const topStrategy = [...input.strategyMetrics].sort((left, right) => {
      if (right.promptAccepts !== left.promptAccepts) {
        return right.promptAccepts - left.promptAccepts;
      }
      if (right.acceptanceRate !== left.acceptanceRate) {
        return right.acceptanceRate - left.acceptanceRate;
      }
      return right.promptViews - left.promptViews;
    })[0];
    if (topStrategy) {
      insights.push({
        kind: "strategy",
        status:
          topStrategy.promptViews < 5
            ? "needs-volume"
            : topStrategy.acceptanceRate >= 0.25
              ? "working"
              : "watch",
        title: `${this.formatRetentionStrategyLabel(topStrategy.strategyKey)} is the leading retention prompt`,
        detail: `${topStrategy.promptAccepts} of ${topStrategy.promptViews} prompt view${topStrategy.promptViews === 1 ? "" : "s"} accepted for ${this.titleCaseCategory(topStrategy.category).toLowerCase()}.`,
        recommendedAction:
          topStrategy.promptViews < 5
            ? "Keep collecting impressions before changing this strategy; one or two customers can swing the rate too much."
            : topStrategy.acceptanceRate >= 0.25
              ? "Keep this prompt active and compare whether accepted clicks become repeat bookings from the same source."
              : "Review the copy, timing, or category fit before expanding this prompt.",
        strategyKey: topStrategy.strategyKey,
        trigger: topStrategy.trigger,
        category: topStrategy.category,
        promptViews: topStrategy.promptViews,
        promptAccepts: topStrategy.promptAccepts,
        rate: topStrategy.acceptanceRate
      });
    }

    const weakSource = input.sourceMetrics.find(
      (metric) => metric.promptAccepts >= 2 && metric.clickToBookingRate < 0.5
    );
    if (weakSource) {
      insights.push({
        kind: "source",
        status: "watch",
        title: `${weakSource.requestSource} retention clicks need booking follow-through`,
        detail: `${weakSource.promptAccepts} accepted prompt${weakSource.promptAccepts === 1 ? "" : "s"} produced ${weakSource.bookingRequests} repeat booking request${weakSource.bookingRequests === 1 ? "" : "s"}.`,
        recommendedAction:
          "Check whether the handoff from accepted prompt to fresh recommendation is creating friction before sending more traffic through this source.",
        requestSource: weakSource.requestSource,
        strategyKey: weakSource.strategyKey,
        trigger: weakSource.trigger,
        category: weakSource.category,
        promptAccepts: weakSource.promptAccepts,
        bookingRequests: weakSource.bookingRequests,
        rate: weakSource.clickToBookingRate
      });
    } else {
      const topSource = input.sourceMetrics[0];
      if (topSource) {
        insights.push({
          kind: "source",
          status: topSource.bookingRequests >= 3 ? "working" : "needs-volume",
          title: `${topSource.requestSource} is the top repeat-booking source`,
          detail: `${topSource.bookingRequests} repeat booking request${topSource.bookingRequests === 1 ? "" : "s"} came from ${topSource.promptAccepts} accepted prompt${topSource.promptAccepts === 1 ? "" : "s"}.`,
          recommendedAction:
            topSource.bookingRequests >= 3
              ? "Keep this source active and compare one-time rebooks against recurring starts before scaling spend."
              : "Keep attributing accepted prompts and bookings so source quality is visible before launch volume grows.",
          requestSource: topSource.requestSource,
          strategyKey: topSource.strategyKey,
          trigger: topSource.trigger,
          category: topSource.category,
          promptAccepts: topSource.promptAccepts,
          bookingRequests: topSource.bookingRequests,
          rate: topSource.clickToBookingRate
        });
      }
    }

    const topProvider = input.providerMetrics[0];
    if (topProvider) {
      insights.push({
        kind: "provider",
        status: topProvider.bookingRequests >= 3 ? "working" : "needs-volume",
        title: `${topProvider.providerName ?? "A provider"} is leading attributed repeat bookings`,
        detail: `${topProvider.bookingRequests} repeat booking request${topProvider.bookingRequests === 1 ? "" : "s"} are attributed to ${this.formatRetentionStrategyLabel(topProvider.strategyKey).toLowerCase()}.`,
        recommendedAction:
          topProvider.bookingRequests >= 3
            ? "Watch service quality, route density, and payout outcomes before increasing loyalty weighting for this provider."
            : "Keep provider-level attribution visible, but avoid over-weighting loyalty until more repeat bookings land.",
        providerId: topProvider.providerId,
        providerName: topProvider.providerName,
        strategyKey: topProvider.strategyKey,
        trigger: topProvider.trigger,
        category: topProvider.category,
        bookingRequests: topProvider.bookingRequests
      });
    }

    return insights.slice(0, 4);
  }

  private formatRetentionStrategyLabel(strategyKey: string): string {
    return strategyKey
      .split("-")
      .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
      .join(" ");
  }

  private buildLaunchOperationsPolicy(
    bookings: Booking[],
    supportTickets: SupportTicket[],
    providers: ProviderProfile[]
  ): ObservabilityOverview["launchOperationsPolicy"] {
    const activeExceptions = bookings.filter((booking) => Boolean(booking.activeExceptionType));
    const disputedCompletedBookings = bookings.filter(
      (booking) => booking.status === "disputed" && Boolean(booking.completedAt)
    );
    const openServiceQualityTickets = supportTickets.filter(
      (ticket) => ticket.issueType === "service-quality" && ticket.status !== "resolved"
    );
    const verifiedProviderCount = providers.filter((provider) => provider.verificationStatus === "verified").length;
    const coveragePockets = this.buildLaunchOperationsCoveragePockets(
      bookings,
      supportTickets,
      providers
    );
    const warnings: string[] = [];

    if (verifiedProviderCount < 2) {
      warnings.push("Verified provider coverage is thin; keep launch promises narrow and route overflow through support before expanding availability.");
    }
    const watchPockets = coveragePockets.filter((pocket) => pocket.pressureLevel !== "normal");
    if (watchPockets.length > 0) {
      warnings.push(
        `${watchPockets.length} launch pocket${watchPockets.length === 1 ? "" : "s"} need ZIP-level supply or exception review before expanding demand.`
      );
    }
    if (activeExceptions.length > 0) {
      warnings.push(`${activeExceptions.length} active field exception${activeExceptions.length === 1 ? "" : "s"} need same-day owner follow-up.`);
    }
    if (disputedCompletedBookings.length > 0) {
      warnings.push(`${disputedCompletedBookings.length} completed disputed booking${disputedCompletedBookings.length === 1 ? "" : "s"} are holding payout release until evidence-backed support resolution.`);
    }
    if (openServiceQualityTickets.length > 0) {
      warnings.push(`${openServiceQualityTickets.length} open service-quality ticket${openServiceQualityTickets.length === 1 ? "" : "s"} should stay tied to provider evidence, customer updates, and the final booking intervention.`);
    }

    const pressureScore =
      activeExceptions.length * 2 +
      disputedCompletedBookings.length * 2 +
      openServiceQualityTickets.length +
      (verifiedProviderCount < 2 ? 2 : 0);

    return {
      policyVersion: "launch-ops-v1",
      activePressureLevel: pressureScore >= 5 ? "critical" : pressureScore >= 2 ? "watch" : "normal",
      coveragePockets,
      coverageActionRecommendations: this.buildLaunchOperationsCoverageActionRecommendations(coveragePockets),
      scenarioRules: [
        {
          key: "coverage-limit",
          title: "Coverage limit",
          trigger: "A customer asks for a service, town, or time window outside verified launch coverage.",
          primaryOwner: "ops",
          primaryAction: "Keep the recommendation-first promise narrow: confirm the area, explain the current coverage limit, and collect the request as a launch lead instead of showing unqualified providers.",
          customerPromise: "Give a specific next follow-up window and do not imply guaranteed service until verified supply can cover the property.",
          providerInstruction: "Do not ask providers to stretch radius or scope unless ops has verified staffing, travel time, and economics for that job.",
          escalationRule: "Escalate when two or more qualified leads arrive from the same uncovered pocket in a week."
        },
        {
          key: "low-supply",
          title: "Low supply",
          trigger: "Provider search has no verified provider with a trustworthy open window.",
          primaryOwner: "ops",
          primaryAction: "Hold the customer in a managed follow-up path, check provider availability directly, and keep backup choices curated instead of opening a broad directory.",
          customerPromise: "Offer a human availability check or a clear alternative timing window.",
          providerInstruction: "Ask only category-qualified providers for concrete capacity, travel fit, and earliest reliable arrival.",
          escalationRule: "Escalate if low-supply searches or no-open-window searches repeat for the same category or launch pocket."
        },
        {
          key: "weather-delay",
          title: "Weather or route delay",
          trigger: "Weather, route pressure, equipment, or staffing risk threatens the promised service window.",
          primaryOwner: "support",
          primaryAction: "Send the customer a delay update, ask the provider for a realistic completion plan, and reschedule only when the new window is more reliable than waiting.",
          customerPromise: "Name the updated ETA or the exact decision time for the next update.",
          providerInstruction: "Provider must confirm crew coverage, route leader, and whether the job can still be completed safely.",
          recommendedInterventionAction: "reschedule-booking",
          escalationRule: "Escalate when the ETA slips twice, the crew gap remains open, or the provider cannot confirm same-day completion."
        },
        {
          key: "provider-no-show",
          title: "Provider no-show",
          trigger: "Provider or assigned crew has not confirmed route progress near the service window.",
          primaryOwner: "support",
          primaryAction: "Contact the provider immediately, protect the customer with an update, and cancel or reschedule through an audited intervention if the provider cannot recover quickly.",
          customerPromise: "Acknowledge the missed expectation plainly and give the customer a concrete recovery option.",
          providerInstruction: "Provider must explain what happened, whether a crew member can still arrive, and how customer communication will be fixed.",
          recommendedInterventionAction: "cancel-booking",
          escalationRule: "Escalate immediately for repeat provider no-shows or when customer trust cannot be recovered with same-day service."
        },
        {
          key: "customer-no-show",
          title: "Customer access issue",
          trigger: "Crew cannot access the property, gate, driveway, pets, or required work area.",
          primaryOwner: "support",
          primaryAction: "Document the access issue, ask the customer for instructions, and keep the provider moving only if the delay will not damage later route commitments.",
          customerPromise: "Explain what access detail is needed and how long the provider can reasonably wait.",
          providerInstruction: "Provider should capture before evidence and notes before leaving or changing scope.",
          recommendedInterventionAction: "reschedule-booking",
          escalationRule: "Escalate when access cannot be resolved before the route window collapses or when the provider asks for a cancellation fee decision."
        },
        {
          key: "service-quality",
          title: "Service-quality issue",
          trigger: "Customer, provider, review, or support evidence suggests the service may not meet launch standards.",
          primaryOwner: "support",
          primaryAction: "Keep the issue in support, review evidence before resolving, and coordinate with the provider before promising refund or rework outcomes.",
          customerPromise: "Tell the customer support is reviewing photos, notes, checklist context, and provider response before closing the case.",
          providerInstruction: "Provider should send before/after evidence, recovery timing, and any scope constraints before ops resolves the ticket.",
          escalationRule: "Escalate when reviewed evidence supports the customer, evidence is mixed, or the provider lacks a credible recovery plan."
        },
        {
          key: "completed-dispute",
          title: "Completed-job dispute",
          trigger: "A completed booking is disputed after payment capture and payout is on hold.",
          primaryOwner: "support",
          primaryAction: "Review evidence before closing the dispute, keep payout holds active while disputed, and only release the completed booking when the resolution supports the provider.",
          customerPromise: "Explain whether support is keeping the booking complete, approving a refund, or documenting mixed evidence.",
          providerInstruction: "Provider must supply completion evidence and recovery context before payout release.",
          recommendedInterventionAction: "complete-booking",
          escalationRule: "Escalate when evidence is mixed or inconclusive, because final resolution requires a specific written rationale."
        }
      ],
      serviceQualityStandards: [
        "Every launch job should have enough before/after evidence, notes, or checklist detail to explain the service outcome without relying on memory.",
        "Provider updates must be specific about arrival, delay, access, completion, or recovery timing; vague reassurance is not enough for launch incidents.",
        "Customer-facing updates should acknowledge the operational issue, name the next decision point, and avoid promising refunds or rework before evidence review.",
        "Providers with active disputes, refunds, or field exceptions need documented recovery before broader recommendation visibility."
      ],
      interventionRules: [
        "Outcome-changing interventions for disputes and service-quality cases must stay linked to the support ticket.",
        "Submitted evidence must be reviewed before resolving dispute, service-quality, or refund-review cases.",
        "Provider-favoring resolutions must not override customer-leaning reviewed evidence.",
        "Mixed or inconclusive evidence requires a specific written rationale before ops finalizes the booking or refund outcome.",
        "Completed-job disputes keep the provider settlement on hold until support resolves the booking out of disputed status; crew compensation remains the provider business's responsibility."
      ],
      escalationTriggers: [
        "two or more active field exceptions at the same time",
        "any completed-job dispute with captured payment and payout hold",
        "repeat no-show, delay, or service-quality tickets for the same provider",
        "verified provider coverage below two active businesses in a launch pocket",
        "any support decision where evidence direction conflicts with the requested customer or provider outcome"
      ],
      warnings
    };
  }

  private buildLaunchOperationsCoverageActionRecommendations(
    coveragePockets: ObservabilityOverview["launchOperationsPolicy"]["coveragePockets"]
  ): ObservabilityOverview["launchOperationsPolicy"]["coverageActionRecommendations"] {
    return coveragePockets.flatMap((pocket) => {
      const recommendations: ObservabilityOverview["launchOperationsPolicy"]["coverageActionRecommendations"] = [];
      const pocketLabel = `${pocket.city}, ${pocket.state} ${pocket.postalCode}`;

      if (pocket.verifiedProviderCount === 0) {
        recommendations.push({
          key: "hold-demand",
          pocketKey: pocket.pocketKey,
          city: pocket.city,
          state: pocket.state,
          postalCode: pocket.postalCode,
          priority: "urgent",
          owner: "ops",
          title: `Hold new demand in ${pocketLabel}`,
          detail: "No verified provider is currently attached to this ZIP-level launch pocket.",
          recommendedAction:
            "Pause new launch promises here, collect requests as launch leads, and verify supply before opening recommendation-first booking.",
          dueWithinHours: 4,
          relatedScenarioKeys: ["coverage-limit", "low-supply"]
        });
      } else if (pocket.verifiedProviderCount < 2) {
        recommendations.push({
          key: "verify-supply",
          pocketKey: pocket.pocketKey,
          city: pocket.city,
          state: pocket.state,
          postalCode: pocket.postalCode,
          priority: pocket.activeBookingCount > 0 ? "high" : "normal",
          owner: "provider-success",
          title: `Verify backup supply in ${pocketLabel}`,
          detail: `${pocket.verifiedProviderCount} verified provider${pocket.verifiedProviderCount === 1 ? "" : "s"} currently cover this pocket.`,
          recommendedAction:
            "Confirm backup provider capacity, travel fit, and category coverage before increasing local demand or broadening windows.",
          dueWithinHours: pocket.activeBookingCount > 0 ? 12 : 48,
          relatedScenarioKeys: ["coverage-limit", "low-supply"]
        });
      }

      if (pocket.activeExceptionCount > 0) {
        recommendations.push({
          key: "recover-field-exception",
          pocketKey: pocket.pocketKey,
          city: pocket.city,
          state: pocket.state,
          postalCode: pocket.postalCode,
          priority: pocket.activeExceptionCount > 1 ? "urgent" : "high",
          owner: "support",
          title: `Recover active field exception in ${pocketLabel}`,
          detail: `${pocket.activeExceptionCount} active field exception${pocket.activeExceptionCount === 1 ? "" : "s"} are open in this pocket.`,
          recommendedAction:
            "Coordinate customer and provider updates today, then decide whether the pocket should stay open, narrow windows, or pause new requests.",
          dueWithinHours: pocket.activeExceptionCount > 1 ? 4 : 8,
          relatedScenarioKeys: ["weather-delay", "provider-no-show", "customer-no-show", "service-quality"]
        });
      }

      if (pocket.openServiceQualityTicketCount > 0) {
        recommendations.push({
          key: "resolve-service-quality",
          pocketKey: pocket.pocketKey,
          city: pocket.city,
          state: pocket.state,
          postalCode: pocket.postalCode,
          priority: pocket.openServiceQualityTicketCount > 1 ? "urgent" : "high",
          owner: "support",
          title: `Resolve service quality before expansion in ${pocketLabel}`,
          detail: `${pocket.openServiceQualityTicketCount} open service-quality ticket${pocket.openServiceQualityTicketCount === 1 ? "" : "s"} are tied to this pocket.`,
          recommendedAction:
            "Review evidence, coordinate provider recovery, and keep local demand narrow until the support outcome is documented.",
          dueWithinHours: 24,
          relatedScenarioKeys: ["service-quality", "completed-dispute"]
        });
      }

      return recommendations;
    }).slice(0, 12);
  }

  private buildLaunchOperationsCoveragePockets(
    bookings: Booking[],
    supportTickets: SupportTicket[],
    providers: ProviderProfile[]
  ): ObservabilityOverview["launchOperationsPolicy"]["coveragePockets"] {
    type MutablePocket = {
      pocketKey: string;
      city: string;
      state: string;
      postalCode: string;
      verifiedProviderIds: Set<string>;
      activeBookingIds: Set<string>;
      completedBookingIds: Set<string>;
      activeExceptionCount: number;
      openServiceQualityTicketCount: number;
      supportedCategories: Set<Booking["category"]>;
    };
    const pockets = new Map<string, MutablePocket>();
    const bookingMap = new Map(bookings.map((booking) => [booking.id, booking]));

    const touchPocket = (address: Address): MutablePocket => {
      const city = address.city.trim() || "Unknown city";
      const state = address.state.trim().toUpperCase() || "NA";
      const postalCode = address.postalCode.trim().slice(0, 5) || "unknown";
      const pocketKey = `${state}:${postalCode}:${city.toLowerCase()}`;
      const existing = pockets.get(pocketKey);
      if (existing) {
        return existing;
      }
      const pocket: MutablePocket = {
        pocketKey,
        city,
        state,
        postalCode,
        verifiedProviderIds: new Set<string>(),
        activeBookingIds: new Set<string>(),
        completedBookingIds: new Set<string>(),
        activeExceptionCount: 0,
        openServiceQualityTicketCount: 0,
        supportedCategories: new Set<Booking["category"]>()
      };
      pockets.set(pocketKey, pocket);
      return pocket;
    };

    for (const provider of providers) {
      if (provider.verificationStatus !== "verified") {
        continue;
      }
      const pocket = touchPocket(provider.address);
      pocket.verifiedProviderIds.add(provider.id);
      for (const category of provider.categories) {
        pocket.supportedCategories.add(category);
      }
    }

    for (const booking of bookings) {
      const pocket = touchPocket(booking.serviceAddress);
      pocket.supportedCategories.add(booking.category);
      if (booking.status === "completed" || booking.status === "refunded") {
        pocket.completedBookingIds.add(booking.id);
      } else if (booking.status !== "cancelled") {
        pocket.activeBookingIds.add(booking.id);
      }
      if (booking.activeExceptionType) {
        pocket.activeExceptionCount += 1;
      }
    }

    for (const ticket of supportTickets) {
      if (ticket.issueType !== "service-quality" || ticket.status === "resolved" || !ticket.bookingId) {
        continue;
      }
      const booking = bookingMap.get(ticket.bookingId);
      if (!booking) {
        continue;
      }
      touchPocket(booking.serviceAddress).openServiceQualityTicketCount += 1;
    }

    return Array.from(pockets.values())
      .map((pocket) => {
        const warnings: string[] = [];
        if (pocket.verifiedProviderIds.size < 2) {
          warnings.push("Verified supply is thin for this ZIP-level launch pocket.");
        }
        if (pocket.activeBookingIds.size > Math.max(2, pocket.verifiedProviderIds.size * 3)) {
          warnings.push("Active booking load is high relative to verified supply in this pocket.");
        }
        if (pocket.activeExceptionCount > 0) {
          warnings.push("Active field exceptions need same-day support follow-up in this pocket.");
        }
        if (pocket.openServiceQualityTicketCount > 0) {
          warnings.push("Open service-quality tickets should be resolved before increasing demand in this pocket.");
        }

        const pressureLevel: ObservabilityOverview["launchOperationsPolicy"]["coveragePockets"][number]["pressureLevel"] =
          pocket.verifiedProviderIds.size === 0 ||
          pocket.activeExceptionCount > 1 ||
          pocket.openServiceQualityTicketCount > 1
            ? "critical"
            : warnings.length > 0
              ? "watch"
              : "normal";
        const recommendedAction =
          pressureLevel === "critical"
            ? "Hold new demand in this pocket until ops confirms verified supply, exception recovery, or support resolution."
            : pressureLevel === "watch"
              ? "Keep demand narrow, monitor service-quality and route pressure, and verify provider capacity before expanding this pocket."
              : "Keep this pocket active with normal launch monitoring.";

        return {
          pocketKey: pocket.pocketKey,
          city: pocket.city,
          state: pocket.state,
          postalCode: pocket.postalCode,
          verifiedProviderCount: pocket.verifiedProviderIds.size,
          activeBookingCount: pocket.activeBookingIds.size,
          completedBookingCount: pocket.completedBookingIds.size,
          activeExceptionCount: pocket.activeExceptionCount,
          openServiceQualityTicketCount: pocket.openServiceQualityTicketCount,
          supportedCategories: Array.from(pocket.supportedCategories).sort(),
          pressureLevel,
          warnings,
          recommendedAction
        };
      })
      .sort((left, right) => {
        const pressureRank: Record<typeof left.pressureLevel, number> = { critical: 2, watch: 1, normal: 0 };
        if (pressureRank[right.pressureLevel] !== pressureRank[left.pressureLevel]) {
          return pressureRank[right.pressureLevel] - pressureRank[left.pressureLevel];
        }
        if (right.activeExceptionCount !== left.activeExceptionCount) {
          return right.activeExceptionCount - left.activeExceptionCount;
        }
        if (right.openServiceQualityTicketCount !== left.openServiceQualityTicketCount) {
          return right.openServiceQualityTicketCount - left.openServiceQualityTicketCount;
        }
        if (right.activeBookingCount !== left.activeBookingCount) {
          return right.activeBookingCount - left.activeBookingCount;
        }
        return left.pocketKey.localeCompare(right.pocketKey);
      })
      .slice(0, 8);
  }

  public async buildCalendarFeed(providerId: string): Promise<string> {
    const provider = await this.repository.findProviderById(providerId);
    if (!provider) {
      throw new HttpError(404, "Provider not found");
    }

    const bookings = await this.listProviderCalendarBookings(providerId);
    return this.schedulingService.buildProviderCombinedCalendarFeed({
      providerName: provider.companyName,
      bookings,
      externalBlocks: this.getActiveExternalCalendarBlocks(provider)
    });
  }

  public async buildCalendarFeedByToken(feedToken: string): Promise<string> {
    const provider = (await this.repository.listProviders()).find(
      (item) => item.calendarConnection.feedToken === feedToken
    );

    if (!provider) {
      throw new HttpError(404, "Calendar feed not found");
    }

    return this.buildCalendarFeed(provider.id);
  }

  public async getProviderCalendarSubscription(
    providerId: string
  ): Promise<ProviderCalendarSubscriptionResponse> {
    const provider = await this.ensureProviderCalendarFeedToken(providerId);
    const token = provider.calendarConnection.feedToken;
    if (!token) {
      throw new HttpError(500, "Calendar feed token could not be created");
    }

    const feedUrl = `${this.apiBaseUrl}${"/api/calendar/feed"}?token=${encodeURIComponent(token)}`;
    return {
      providerId: provider.id,
      providerName: provider.companyName,
      feedUrl,
      webcalUrl: feedUrl.replace(/^http/, "webcal"),
      actions: this.buildProviderCalendarSubscriptionActions(feedUrl),
      instructions: [
        "Apple Calendar can subscribe directly with the Apple Calendar action or the raw webcal link.",
        "Google Calendar can use the Google Calendar action or paste the feed URL into Add calendar by URL.",
        "The feed includes YardMatch jobs plus your manual outside-client and personal blocks."
      ]
    };
  }

  public async getProviderCalendarImports(providerId: string): Promise<ProviderCalendarImportsResponse> {
    const provider = await this.repository.findProviderById(providerId);
    if (!provider) {
      throw new HttpError(404, "Provider not found");
    }
    const bookings = await this.listFutureProviderCalendarConflictBookings(provider.id);

    return {
      providerId: provider.id,
      subscriptions: [...(provider.calendarConnection.externalSubscriptions ?? [])].sort((left, right) =>
        left.title.localeCompare(right.title)
      ),
      importedBlockCount: (provider.calendarConnection.externalBlocks ?? []).filter(
        (block) => block.source === "calendar-import"
      ).length,
      syncHealth: this.buildProviderCalendarSyncHealth(provider, bookings)
    };
  }

  public async createProviderCalendarImport(
    providerId: string,
    payload: CreateExternalCalendarImportRequest
  ): Promise<ProviderCalendarImportsResponse> {
    const provider = await this.repository.findProviderById(providerId);
    if (!provider) {
      throw new HttpError(404, "Provider not found");
    }

    const title = payload.title.trim();
    const feedUrl = payload.feedUrl.trim();
    if (!title) {
      throw new HttpError(400, "Calendar import title is required");
    }

    if (!/^https?:\/\/|^webcal:\/\//i.test(feedUrl) && !/^data:text\/calendar/i.test(feedUrl)) {
      throw new HttpError(400, "Calendar import feedUrl must be an http, https, webcal, or data URL");
    }

    const subscription: ExternalCalendarSubscription = {
      id: crypto.randomUUID(),
      title,
      provider: payload.provider,
      feedUrl,
      importedEventCount: 0,
      syncStatus: "active"
    };

    const nextSubscriptions = [...(provider.calendarConnection.externalSubscriptions ?? []), subscription];
    const savedProvider = await this.repository.updateProvider(provider.id, {
      calendarConnection: {
        ...provider.calendarConnection,
        externalSubscriptions: nextSubscriptions
      }
    });
    if (!savedProvider) {
      throw new HttpError(500, "Calendar import could not be created");
    }

    const imported = await this.syncExternalCalendarSubscription(savedProvider, subscription, nextSubscriptions);
    const bookings = await this.listFutureProviderCalendarConflictBookings(imported.id);
    return {
      providerId,
      subscriptions: imported.calendarConnection.externalSubscriptions ?? [],
      importedBlockCount: (imported.calendarConnection.externalBlocks ?? []).filter(
        (block) => block.source === "calendar-import"
      ).length,
      syncHealth: this.buildProviderCalendarSyncHealth(imported, bookings)
    };
  }

  public async syncProviderCalendarImport(
    providerId: string,
    payload: SyncExternalCalendarImportRequest
  ): Promise<ProviderCalendarImportsResponse> {
    const provider = await this.repository.findProviderById(providerId);
    if (!provider) {
      throw new HttpError(404, "Provider not found");
    }

    const subscription = (provider.calendarConnection.externalSubscriptions ?? []).find(
      (item) => item.id === payload.subscriptionId
    );
    if (!subscription) {
      throw new HttpError(404, "Calendar import not found");
    }

    const updatedProvider = await this.syncExternalCalendarSubscription(
      provider,
      subscription,
      provider.calendarConnection.externalSubscriptions ?? []
    );
    const bookings = await this.listFutureProviderCalendarConflictBookings(updatedProvider.id);
    return {
      providerId,
      subscriptions: updatedProvider.calendarConnection.externalSubscriptions ?? [],
      importedBlockCount: (updatedProvider.calendarConnection.externalBlocks ?? []).filter(
        (block) => block.source === "calendar-import"
      ).length,
      syncHealth: this.buildProviderCalendarSyncHealth(updatedProvider, bookings)
    };
  }

  public async syncStaleProviderCalendarImports(
    providerId: string
  ): Promise<SyncStaleProviderCalendarImportsResponse> {
    const provider = await this.repository.findProviderById(providerId);
    if (!provider) {
      throw new HttpError(404, "Provider not found");
    }

    const subscriptions = provider.calendarConnection.externalSubscriptions ?? [];
    const now = Date.now();
    const targets = subscriptions.filter(
      (subscription) =>
        subscription.syncStatus === "error" ||
        !subscription.lastSyncedAt ||
        now - Date.parse(subscription.lastSyncedAt) > 24 * 60 * 60 * 1000
    );

    let currentProvider = provider;
    let syncedSubscriptionCount = 0;
    let failedSubscriptionCount = 0;

    for (const target of targets) {
      const currentSubscription = (currentProvider.calendarConnection.externalSubscriptions ?? []).find(
        (item) => item.id === target.id
      );
      if (!currentSubscription) {
        failedSubscriptionCount += 1;
        continue;
      }

      const beforeStatus = currentSubscription.syncStatus;
      currentProvider = await this.syncExternalCalendarSubscription(
        currentProvider,
        currentSubscription,
        currentProvider.calendarConnection.externalSubscriptions ?? []
      );
      const afterStatus = (currentProvider.calendarConnection.externalSubscriptions ?? []).find(
        (item) => item.id === target.id
      )?.syncStatus;

      if (afterStatus === "active") {
        syncedSubscriptionCount += 1;
      } else if (beforeStatus === "error" || afterStatus === "error") {
        failedSubscriptionCount += 1;
      }
    }

    const bookings = await this.listFutureProviderCalendarConflictBookings(currentProvider.id);
    return {
      providerId,
      subscriptions: currentProvider.calendarConnection.externalSubscriptions ?? [],
      importedBlockCount: (currentProvider.calendarConnection.externalBlocks ?? []).filter(
        (block) => block.source === "calendar-import"
      ).length,
      syncHealth: this.buildProviderCalendarSyncHealth(currentProvider, bookings),
      attemptedSubscriptionCount: targets.length,
      syncedSubscriptionCount,
      failedSubscriptionCount
    };
  }

  public async removeProviderCalendarImport(
    providerId: string,
    payload: RemoveExternalCalendarImportRequest
  ): Promise<ProviderCalendarImportsResponse> {
    const provider = await this.repository.findProviderById(providerId);
    if (!provider) {
      throw new HttpError(404, "Provider not found");
    }

    const nextSubscriptions = (provider.calendarConnection.externalSubscriptions ?? []).filter(
      (item) => item.id !== payload.subscriptionId
    );
    const nextBlocks = (provider.calendarConnection.externalBlocks ?? []).filter(
      (block) => block.subscriptionId !== payload.subscriptionId
    );

    const updatedProvider = await this.repository.updateProvider(providerId, {
      calendarConnection: {
        ...provider.calendarConnection,
        externalSubscriptions: nextSubscriptions,
        externalBlocks: nextBlocks
      }
    });

    if (!updatedProvider) {
      throw new HttpError(500, "Calendar import could not be removed");
    }
    const bookings = await this.listFutureProviderCalendarConflictBookings(updatedProvider.id);

    return {
      providerId,
      subscriptions: updatedProvider.calendarConnection.externalSubscriptions ?? [],
      importedBlockCount: (updatedProvider.calendarConnection.externalBlocks ?? []).filter(
        (block) => block.source === "calendar-import"
      ).length,
      syncHealth: this.buildProviderCalendarSyncHealth(updatedProvider, bookings)
    };
  }

  public async getProviderCalendarOverview(
    providerId: string,
    input?: {
      fromIso?: string;
      toIso?: string;
    }
  ): Promise<ProviderCalendarOverviewResponse> {
    const provider = await this.repository.findProviderById(providerId);
    if (!provider) {
      throw new HttpError(404, "Provider not found");
    }

    const windowStartIso = input?.fromIso
      ? new Date(input.fromIso).toISOString()
      : new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
    const windowEndIso = input?.toIso
      ? new Date(input.toIso).toISOString()
      : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    if (
      Number.isNaN(new Date(windowStartIso).getTime()) ||
      Number.isNaN(new Date(windowEndIso).getTime()) ||
      new Date(windowEndIso).getTime() <= new Date(windowStartIso).getTime()
    ) {
      throw new HttpError(400, "Calendar overview window must use valid ISO dates with end after start");
    }

    const [staffingSummaries, rawBookings] = await Promise.all([
      this.buildProviderStaffingSummaries(provider),
      this.repository.listBookings()
    ]);
    const bookingNotesById = new Map(rawBookings.map((booking) => [booking.id, booking.notes]));
    const bookings = staffingSummaries
      .map((job) => ({
        id: job.bookingId,
        category: job.category,
        customerName: job.customerName,
        addressLine: job.serviceAddress.line1,
        city: job.serviceAddress.city,
        state: job.serviceAddress.state,
        scheduledStartIso: job.scheduledStartIso,
        scheduledEndIso: job.scheduledEndIso,
        status: job.status,
        notes: bookingNotesById.get(job.bookingId),
        serviceAddress: job.serviceAddress,
        requiredCrewMembers: job.requiredCrewMembers,
        assignedCrewMembers: job.assignedCrewMembers
      }))
      .filter((booking) =>
      this.doIntervalsOverlap(booking.scheduledStartIso, booking.scheduledEndIso, windowStartIso, windowEndIso)
    );
    const externalBlocks = this.getActiveExternalCalendarBlocks(provider).filter((block) =>
      this.doIntervalsOverlap(block.startIso, block.endIso, windowStartIso, windowEndIso)
    );

    const events = this.schedulingService.buildProviderCalendarEvents({
      bookings: bookings.map((booking) => ({
        id: booking.id,
        category: booking.category,
        customerName: booking.customerName,
        addressLine: booking.addressLine,
        city: booking.city,
        state: booking.state,
        scheduledStartIso: booking.scheduledStartIso,
        scheduledEndIso: booking.scheduledEndIso,
        status: booking.status,
        notes: booking.notes
      })),
      externalBlocks
    });
    const dispatchDays = this.schedulingService.buildProviderDispatchDays({
      providerAddress: provider.address,
      bookings,
      externalBlocks
    });

    return {
      providerId: provider.id,
      providerName: provider.companyName,
      windowStartIso,
      windowEndIso,
      totalEvents: events.length,
      yardmatchJobCount: bookings.length,
      externalBlockCount: externalBlocks.length,
      syncHealth: this.buildProviderCalendarSyncHealth(provider, bookings, externalBlocks),
      dispatchDays,
      events
    };
  }

  private filterProviderSlotsAgainstExternalBlocks(
    provider: ProviderProfile,
    slots: Array<{ startIso: string; endIso: string; isBooked: boolean; providerId: string; id: string }>
  ) {
    const blocks = this.getActiveExternalCalendarBlocks(provider);
    if (blocks.length === 0) {
      return slots;
    }

    return slots.filter(
      (slot) =>
        !blocks.some((block) =>
          this.doIntervalsOverlap(slot.startIso, slot.endIso, block.startIso, block.endIso)
        )
    );
  }

  private getActiveExternalCalendarBlocks(provider: ProviderProfile): ExternalCalendarBlock[] {
    if (!provider.calendarConnection.externalEventsBlockingEnabled) {
      return [];
    }

    return [...(provider.calendarConnection.externalBlocks ?? [])].sort((left, right) =>
      left.startIso.localeCompare(right.startIso)
    );
  }

  private buildProviderCalendarSyncHealth(
    provider: ProviderProfile,
    bookings: Array<{ scheduledStartIso: string; scheduledEndIso: string }> = [],
    activeExternalBlocks = this.getActiveExternalCalendarBlocks(provider)
  ): ProviderCalendarSyncHealth {
    const subscriptions = provider.calendarConnection.externalSubscriptions ?? [];
    const now = Date.now();
    const allExternalBlocks = provider.calendarConnection.externalBlocks ?? [];
    const manualBlockCount = allExternalBlocks.filter((block) => block.source === "manual").length;
    const importedBlocks = allExternalBlocks.filter((block) => block.source === "calendar-import");
    const importedBlockCount = importedBlocks.length;
    const upcomingExternalBlocks = allExternalBlocks.filter(
      (block) => Date.parse(block.endIso) > now
    );
    const conflictingYardmatchJobCount = bookings.filter((booking) =>
      allExternalBlocks.some((block) =>
        this.doIntervalsOverlap(block.startIso, block.endIso, booking.scheduledStartIso, booking.scheduledEndIso)
      )
    ).length;
    const staleSubscriptions = subscriptions.filter((subscription) => {
      if (!subscription.lastSyncedAt) {
        return true;
      }

      return now - Date.parse(subscription.lastSyncedAt) > 24 * 60 * 60 * 1000;
    });
    const erroredSubscriptions = subscriptions.filter((subscription) => subscription.syncStatus === "error");

    const notes: string[] = [];
    const externalBlockingEnabled = provider.calendarConnection.externalEventsBlockingEnabled ?? false;

    if (subscriptions.length === 0) {
      notes.push("No outside calendar feeds are connected yet.");
    }

    if (!externalBlockingEnabled && upcomingExternalBlocks.length > 0) {
      notes.push("Outside blocks are saved, but they are not reducing YardMatch availability yet.");
    }

    if (conflictingYardmatchJobCount > 0) {
      notes.push(
        `${conflictingYardmatchJobCount} YardMatch job${conflictingYardmatchJobCount === 1 ? " overlaps" : "s overlap"} an outside calendar block and needs ops or provider review.`
      );
    }

    if (erroredSubscriptions.length > 0) {
      notes.push(
        `${erroredSubscriptions.length} calendar feed${erroredSubscriptions.length === 1 ? " is" : "s are"} currently failing to sync.`
      );
    }

    if (staleSubscriptions.length > 0) {
      notes.push(
        `${staleSubscriptions.length} calendar feed${staleSubscriptions.length === 1 ? " has" : "s have"} not synced in the last 24 hours.`
      );
    }

    if (externalBlockingEnabled && importedBlockCount > 0 && activeExternalBlocks.length === 0) {
      notes.push("Imported outside calendars exist, but there are no active blocks in the current schedule window.");
    }

    if (notes.length === 0) {
      notes.push("Outside calendars are synced and availability protection looks healthy.");
    }

    const status: ProviderCalendarSyncHealth["status"] =
      erroredSubscriptions.length > 0 ||
      (!externalBlockingEnabled && upcomingExternalBlocks.length > 0) ||
      conflictingYardmatchJobCount > 0
        ? "at-risk"
        : staleSubscriptions.length > 0
          ? "attention"
          : "healthy";

    return {
      status,
      externalBlockingEnabled,
      subscriptionCount: subscriptions.length,
      activeSubscriptionCount: subscriptions.filter((subscription) => subscription.syncStatus === "active").length,
      erroredSubscriptionCount: erroredSubscriptions.length,
      staleSubscriptionCount: staleSubscriptions.length,
      importedBlockCount,
      manualBlockCount,
      upcomingExternalBlockCount: upcomingExternalBlocks.length,
      conflictingYardmatchJobCount,
      nextExternalBlockStartIso: upcomingExternalBlocks
        .sort((left, right) => left.startIso.localeCompare(right.startIso))[0]?.startIso,
      notes
    };
  }

  private buildProviderCalendarSubscriptionActions(feedUrl: string): ProviderCalendarSubscriptionAction[] {
    const webcalUrl = feedUrl.replace(/^http/, "webcal");
    const googleCalendarUrl = `https://calendar.google.com/calendar/u/0/r/settings/addbyurl?cid=${encodeURIComponent(feedUrl)}`;

    return [
      {
        platform: "apple-calendar",
        label: "Apple Calendar",
        href: webcalUrl,
        helperText: "Opens the native subscribe flow in Apple Calendar and other webcal-capable apps."
      },
      {
        platform: "google-calendar",
        label: "Google Calendar",
        href: googleCalendarUrl,
        helperText: "Opens Google Calendar's Add by URL screen with the YardMatch feed prefilled."
      },
      {
        platform: "ical",
        label: "Raw feed URL",
        href: feedUrl,
        helperText: "Use this HTTPS feed in any iCal-compatible calendar that prefers a plain URL."
      }
    ];
  }

  private async listFutureProviderCalendarConflictBookings(providerId: string) {
    return (await this.repository.listBookings()).filter(
      (booking) =>
        booking.providerId === providerId &&
        booking.status !== "cancelled" &&
        booking.status !== "completed" &&
        booking.status !== "refunded" &&
        Date.parse(booking.scheduledEndIso) > Date.now()
    );
  }

  private async persistExternalCalendarSubscriptionError(
    provider: ProviderProfile,
    subscriptionId: string,
    errorMessage: string,
    allSubscriptions: ExternalCalendarSubscription[]
  ): Promise<ProviderProfile> {
    const nextSubscriptions = allSubscriptions.map((item) =>
      item.id === subscriptionId
        ? {
            ...item,
            lastSyncedAt: new Date().toISOString(),
            syncStatus: "error" as const,
            lastError: errorMessage
          }
        : item
    );

    const updatedProvider = await this.repository.updateProvider(provider.id, {
      calendarConnection: {
        ...provider.calendarConnection,
        externalSubscriptions: nextSubscriptions,
        lastSyncedAt: new Date().toISOString()
      }
    });

    if (!updatedProvider) {
      throw new HttpError(500, "Calendar import error state could not be saved");
    }

    return updatedProvider;
  }

  private async syncExternalCalendarSubscription(
    provider: ProviderProfile,
    subscription: ExternalCalendarSubscription,
    allSubscriptions: ExternalCalendarSubscription[]
  ): Promise<ProviderProfile> {
    try {
      const icsBody = await this.fetchExternalCalendarFeed(subscription.feedUrl);
      const importedBlocks = this.parseExternalCalendarFeed({
        icsBody,
        subscriptionId: subscription.id,
        title: subscription.title
      });
      const manualBlocks = (provider.calendarConnection.externalBlocks ?? []).filter(
        (block) => block.source !== "calendar-import" && block.subscriptionId !== subscription.id
      );
      const nextBlocks = this.normalizeExternalCalendarBlocks([...manualBlocks, ...importedBlocks]);
      const nextSubscriptions = allSubscriptions.map((item) =>
        item.id === subscription.id
          ? {
              ...item,
              importedEventCount: importedBlocks.length,
              lastSyncedAt: new Date().toISOString(),
              syncStatus: "active" as const,
              lastError: undefined
            }
          : item
      );

      await this.ensureExternalCalendarBlocksDoNotConflict({
        ...provider,
        calendarConnection: {
          ...provider.calendarConnection,
          externalBlocks: nextBlocks,
          externalSubscriptions: nextSubscriptions
        }
      });

      const updatedProvider = await this.repository.updateProvider(provider.id, {
        calendarConnection: {
          ...provider.calendarConnection,
          externalBlocks: nextBlocks,
          externalSubscriptions: nextSubscriptions,
          lastSyncedAt: new Date().toISOString()
        }
      });

      if (!updatedProvider) {
        throw new HttpError(500, "Calendar import could not be synced");
      }

      return updatedProvider;
    } catch (error) {
      return this.persistExternalCalendarSubscriptionError(
        provider,
        subscription.id,
        error instanceof Error ? error.message : "Calendar import could not be synced",
        allSubscriptions
      );
    }
  }

  private async fetchExternalCalendarFeed(feedUrl: string): Promise<string> {
    const normalizedUrl = feedUrl.replace(/^webcal:\/\//i, "https://");
    const response = await fetch(normalizedUrl);
    if (!response.ok) {
      throw new HttpError(400, `Calendar feed returned ${response.status}`);
    }

    return response.text();
  }

  private parseExternalCalendarFeed(input: {
    icsBody: string;
    subscriptionId: string;
    title: string;
  }): ExternalCalendarBlock[] {
    const unfolded = input.icsBody.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
    const events = unfolded.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) ?? [];
    const now = Date.now();
    const oneYearFromNow = now + 366 * 24 * 60 * 60 * 1000;

    const importedBlocks: ExternalCalendarBlock[] = [];

    for (const event of events) {
        const summary = this.readIcsValue(event, "SUMMARY") ?? input.title;
        const description = this.readIcsValue(event, "DESCRIPTION");
        const dtStart = this.readIcsDate(event, "DTSTART");
        const dtEnd = this.readIcsDate(event, "DTEND");
        if (!dtStart || !dtEnd || dtEnd.getTime() <= dtStart.getTime()) {
          continue;
        }

        if (dtEnd.getTime() < now - 24 * 60 * 60 * 1000 || dtStart.getTime() > oneYearFromNow) {
          continue;
        }

        const normalizedTitle = summary.trim() || input.title;
        importedBlocks.push({
          id: `${input.subscriptionId}:${this.readIcsValue(event, "UID") ?? crypto.randomUUID()}`,
          title: normalizedTitle,
          blockType: "off-platform-client" as const,
          startIso: dtStart.toISOString(),
          endIso: dtEnd.toISOString(),
          notes: description?.trim() || `Imported from ${input.title}`,
          source: "calendar-import" as const,
          createdAt: new Date().toISOString(),
          subscriptionId: input.subscriptionId
        } satisfies ExternalCalendarBlock);
    }

    return importedBlocks.sort((left, right) => left.startIso.localeCompare(right.startIso));
  }

  private readIcsValue(eventBlock: string, propertyName: string): string | undefined {
    const match = eventBlock.match(new RegExp(`^${propertyName}(?:;[^:]+)?:([^\r\n]+)$`, "m"));
    return match?.[1]
      ?.replaceAll("\\n", "\n")
      .replaceAll("\\,", ",")
      .replaceAll("\\;", ";")
      .replaceAll("\\\\", "\\");
  }

  private readIcsDate(eventBlock: string, propertyName: "DTSTART" | "DTEND"): Date | undefined {
    const match = eventBlock.match(new RegExp(`^${propertyName}((?:;[^:]+)?):([^\r\n]+)$`, "m"));
    if (!match) {
      return undefined;
    }

    const parameters = match[1] ?? "";
    const rawValue = match[2]?.trim();
    if (!rawValue) {
      return undefined;
    }

    if (parameters.includes("VALUE=DATE")) {
      const year = Number(rawValue.slice(0, 4));
      const month = Number(rawValue.slice(4, 6)) - 1;
      const day = Number(rawValue.slice(6, 8));
      return new Date(Date.UTC(year, month, day));
    }

    const normalized = rawValue.endsWith("Z") ? rawValue.slice(0, -1) : rawValue;
    const year = Number(normalized.slice(0, 4));
    const month = Number(normalized.slice(4, 6)) - 1;
    const day = Number(normalized.slice(6, 8));
    const hour = Number(normalized.slice(9, 11) || "0");
    const minute = Number(normalized.slice(11, 13) || "0");
    const second = Number(normalized.slice(13, 15) || "0");
    return rawValue.endsWith("Z")
      ? new Date(Date.UTC(year, month, day, hour, minute, second))
      : new Date(year, month, day, hour, minute, second);
  }

  private normalizeExternalCalendarBlocks(
    blocks: UpdateProviderSettingsRequest["externalCalendarBlocks"]
  ): ExternalCalendarBlock[] {
    return [...(blocks ?? [])]
      .map((block) => {
        const title = block.title.trim();
        if (!title) {
          throw new HttpError(400, "Each external calendar block needs a title");
        }

        const startTime = new Date(block.startIso);
        const endTime = new Date(block.endIso);
        if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) {
          throw new HttpError(400, "External calendar block times must be valid ISO dates");
        }

        if (endTime.getTime() <= startTime.getTime()) {
          throw new HttpError(400, "Each external calendar block must end after it starts");
        }

        return {
          id: block.id ?? crypto.randomUUID(),
          title,
          blockType: block.blockType,
          startIso: startTime.toISOString(),
          endIso: endTime.toISOString(),
          notes: block.notes?.trim() || undefined,
          source: block.source ?? "manual",
          createdAt: block.createdAt ?? new Date().toISOString(),
          subscriptionId: block.subscriptionId
        } satisfies ExternalCalendarBlock;
      })
      .sort((left, right) => left.startIso.localeCompare(right.startIso));
  }

  private async listProviderCalendarBookings(providerId: string) {
    const customers = await this.repository.listCustomers();
    return (await this.repository.listBookings())
      .filter(
        (booking) =>
          booking.providerId === providerId &&
          booking.status !== "cancelled" &&
          booking.status !== "refunded"
      )
      .sort((left, right) => left.scheduledStartIso.localeCompare(right.scheduledStartIso))
      .map((booking) => {
        const customer = customers.find((item) => item.id === booking.customerId);
        return {
          id: booking.id,
          category: booking.category,
          customerName: customer?.fullName ?? "YardMatch customer",
          addressLine: booking.serviceAddress.line1,
          city: booking.serviceAddress.city,
          state: booking.serviceAddress.state,
          scheduledStartIso: booking.scheduledStartIso,
          scheduledEndIso: booking.scheduledEndIso,
          status: booking.status,
          notes: booking.notes
        };
      });
  }

  private async ensureExternalCalendarBlocksDoNotConflict(provider: ProviderProfile): Promise<void> {
    const blocks = this.getActiveExternalCalendarBlocks(provider);
    if (blocks.length === 0) {
      return;
    }

    const bookings = (await this.repository.listBookings()).filter(
      (booking) =>
        booking.providerId === provider.id &&
        booking.status !== "cancelled" &&
        booking.status !== "completed" &&
        booking.status !== "refunded"
    );

    const conflictingBlock = blocks.find((block) =>
      bookings.some((booking) =>
        this.doIntervalsOverlap(
          block.startIso,
          block.endIso,
          booking.scheduledStartIso,
          booking.scheduledEndIso
        )
      )
    );

    if (conflictingBlock) {
      throw new HttpError(
        400,
        `The block "${conflictingBlock.title}" overlaps an existing YardMatch job. Adjust the block window or reschedule the booked service first.`
      );
    }
  }

  private async assertProviderRescheduleWindowIsAvailable(
    providerId: string,
    bookingId: string,
    scheduledStartIso: string,
    scheduledEndIso: string
  ): Promise<void> {
    await this.assertProviderWindowIsAvailable(providerId, scheduledStartIso, scheduledEndIso);

    const overlappingBooking = (await this.repository.listBookings()).find(
      (booking) =>
        booking.providerId === providerId &&
        booking.id !== bookingId &&
        booking.status !== "cancelled" &&
        booking.status !== "refunded" &&
        booking.status !== "completed" &&
        this.doIntervalsOverlap(
          booking.scheduledStartIso,
          booking.scheduledEndIso,
          scheduledStartIso,
          scheduledEndIso
        )
    );

    if (overlappingBooking) {
      throw new HttpError(
        409,
        "That provider window overlaps another YardMatch job. Pick a different service window."
      );
    }
  }

  private async assertProviderWindowIsAvailable(
    providerId: string,
    scheduledStartIso: string,
    scheduledEndIso: string
  ): Promise<void> {
    const provider = await this.repository.findProviderById(providerId);
    if (!provider) {
      throw new HttpError(404, "Provider not found");
    }

    const overlapsExternalBlock = this.getActiveExternalCalendarBlocks(provider).some((block) =>
      this.doIntervalsOverlap(
        block.startIso,
        block.endIso,
        scheduledStartIso,
        scheduledEndIso
      )
    );

    if (overlapsExternalBlock) {
      throw new HttpError(
        409,
        "That service window is no longer available. The provider may be booked or blocked by an outside calendar event."
      );
    }

    if (!this.isWithinProviderAcceptanceWindow(provider, scheduledStartIso)) {
      throw new HttpError(409, this.buildProviderAcceptanceWindowMessage(provider.minimumBookingLeadHours));
    }
  }

  private isWithinProviderAcceptanceWindow(
    provider: Pick<ProviderProfile, "minimumBookingLeadHours">,
    scheduledStartIso: string
  ): boolean {
    const minimumLeadHours = provider.minimumBookingLeadHours ?? 0;
    if (minimumLeadHours <= 0) {
      return true;
    }

    const scheduledStart = Date.parse(scheduledStartIso);
    if (Number.isNaN(scheduledStart)) {
      return false;
    }

    return scheduledStart - Date.now() >= minimumLeadHours * 60 * 60 * 1000;
  }

  private buildProviderAcceptanceWindowMessage(minimumBookingLeadHours: number): string {
    const leadText =
      minimumBookingLeadHours === 1
        ? "at least 1 hour in advance"
        : `at least ${minimumBookingLeadHours} hours in advance`;
    return `This business only accepts new bookings ${leadText}. Pick a later service window.`;
  }

  private doIntervalsOverlap(
    leftStartIso: string,
    leftEndIso: string,
    rightStartIso: string,
    rightEndIso: string
  ): boolean {
    return (
      new Date(leftStartIso).getTime() < new Date(rightEndIso).getTime() &&
      new Date(rightStartIso).getTime() < new Date(leftEndIso).getTime()
    );
  }

  private parseProviderAssistantCommand(command: string): ParsedProviderAssistantCommand {
    const trimmed = command.trim();
    const chainSegments = trimmed
      .split(/\s+\band\b\s+/i)
      .map((segment) => segment.trim())
      .filter(Boolean);

    if (chainSegments.length >= 2) {
      const parsedSegments = chainSegments.map((segment) => this.parseSingleProviderAssistantAction(segment));
      if (parsedSegments.every((action): action is ParsedProviderAssistantAction => Boolean(action))) {
        let inheritedSourceWindowKey: ParsedProviderAssistantAction["sourceWindowKey"];
        const actions = parsedSegments.map((action) => {
          const withInheritedWindow = {
            ...action,
            sourceWindowKey: action.sourceWindowKey ?? inheritedSourceWindowKey
          };
          inheritedSourceWindowKey = withInheritedWindow.sourceWindowKey;
          return withInheritedWindow;
        });

        return {
          understood: true,
          actionType: actions[0].actionType,
          actionTypes: actions.map((action) => action.actionType),
          actions,
          dispatchScope: actions.find((action) => action.dispatchScope)?.dispatchScope,
          dispatchFocus: actions.find((action) => action.dispatchFocus)?.dispatchFocus,
          sourceWindowKey: actions[0].sourceWindowKey,
          targetWindowKey: actions.find((action) => action.targetWindowKey)?.targetWindowKey,
          notifyCustomer: actions.some((action) => action.notifyCustomer),
          routeLeaderCrewNameQuery: actions.find((action) => action.routeLeaderCrewNameQuery)?.routeLeaderCrewNameQuery,
          lateMinutes: actions.find((action) => action.lateMinutes)?.lateMinutes,
          lateReason: actions.find((action) => action.lateReason)?.lateReason,
          exceptionType: actions.find((action) => action.exceptionType)?.exceptionType,
          exceptionNotes: actions.find((action) => action.exceptionNotes)?.exceptionNotes
        };
      }
    }

    const singleAction = this.parseSingleProviderAssistantAction(trimmed);
    return {
      understood: Boolean(singleAction),
      actionType: singleAction?.actionType,
      actionTypes: singleAction ? [singleAction.actionType] : [],
      actions: singleAction ? [singleAction] : [],
      dispatchScope: singleAction?.dispatchScope,
      dispatchFocus: singleAction?.dispatchFocus,
      sourceWindowKey: singleAction?.sourceWindowKey,
      targetWindowKey: singleAction?.targetWindowKey,
      notifyCustomer: singleAction?.notifyCustomer ?? false,
      routeLeaderCrewNameQuery: singleAction?.routeLeaderCrewNameQuery,
      lateMinutes: singleAction?.lateMinutes,
      lateReason: singleAction?.lateReason,
      exceptionType: singleAction?.exceptionType,
      exceptionNotes: singleAction?.exceptionNotes
    };
  }

  private parseSingleProviderAssistantAction(command: string): ParsedProviderAssistantAction | undefined {
    const normalized = command.trim().toLowerCase();
    const notifyCustomer =
      /notify|notification|message|tell/.test(normalized) &&
      /customer|property owner|homeowner|client/.test(normalized);
    const targetBoundary = normalized.match(/\b(?:to|into)\b/);
    const beforeTarget = targetBoundary ? normalized.slice(0, targetBoundary.index).trim() : normalized;
    const afterTarget = targetBoundary
      ? normalized.slice((targetBoundary.index ?? 0) + targetBoundary[0].length).trim()
      : "";

    const crewMessageDetails = this.parseProviderAssistantCrewMessage(command);
    const targetWindowKey = this.parseProviderAssistantWindowFromCommand(afterTarget, true);
    const sourceWindowKey =
      crewMessageDetails?.body && (crewMessageDetails.crewNameQuery || crewMessageDetails.target)
        ? this.parseProviderAssistantWindowFromCommand(normalized, true)
        : this.parseProviderAssistantWindowFromCommand(beforeTarget, true);
    const crewMatchCrewNameQuery = this.parseProviderAssistantCrewMatchName(command);
    const routeLeaderCrewNameQuery = this.parseProviderAssistantRouteLeaderCrewName(command);
    const routeStopKind = this.parseProviderAssistantRouteStopKind(normalized);
    const dispatchScope = this.parseProviderAssistantDispatchScope(normalized);
    const dispatchFocus = this.parseProviderAssistantDispatchFocus(normalized);
    const lateMinutes = this.parseProviderAssistantLateMinutes(normalized);
    const lateReason = this.parseProviderAssistantLateReason(normalized);
    const exceptionType = this.parseProviderAssistantExceptionType(normalized);
    const exceptionNotes = this.parseProviderAssistantExceptionNotes(command);
    const isClearRouteLeaderCommand =
      /\b(clear|remove|unset)\b/.test(normalized) &&
      /\broute leader\b/.test(normalized);
    const isAssignRouteLeaderCommand =
      Boolean(routeLeaderCrewNameQuery) &&
      /\b(assign|make|set)\b/.test(normalized) &&
      /\broute leader\b/.test(normalized);
    const isCrewMessageCommand =
      Boolean(crewMessageDetails?.body && (crewMessageDetails.crewNameQuery || crewMessageDetails.target)) &&
      /\b(?:tell|message|ask)\b/.test(normalized) &&
      (/\bcrew\b/.test(normalized) || /\broute leader\b/.test(normalized));
    const isClearRouteStopCommand =
      /\b(clear|remove|skip)\b/.test(normalized) &&
      /\b(route stop|equipment pickup|staging stop)\b/.test(normalized);
    const isSetRouteStopCommand =
      Boolean(routeStopKind) &&
      /\b(set|use|add|make)\b/.test(normalized) &&
      /\b(stop|first)\b/.test(normalized);
    const isAcceptBestCrewCommand =
      /\b(?:accept|assign|pick|choose)\b/.test(normalized) &&
      /\b(?:the\s+)?(?:best|top)\s+crew\b/.test(normalized);
    const isDispatchSummaryCommand =
      Boolean(dispatchScope) &&
      (/\b(?:how|what|show|summarize|summary|review)\b/.test(normalized) ||
        /\b(?:route|dispatch|schedule)\b/.test(normalized)) &&
      !/\b(?:appointment|booking|job|visit)\b/.test(normalized);
    const isDispatchAdjustmentCommand =
      Boolean(dispatchScope) &&
      /\b(?:what|which|suggest|recommend)\b/.test(normalized) &&
      /\b(?:move|reschedule|shift|push)\b/.test(normalized) &&
      !/\b(?:appointment|booking|job|visit)\b/.test(normalized);
    const isStaffingAdjustmentCommand =
      Boolean(dispatchScope) &&
      /\b(?:need|add|bring|get|send|assign|where)\b/.test(normalized) &&
      /\b(?:crew|staffing|hands|people)\b/.test(normalized) &&
      !/\b(?:appointment|booking|job|visit)\b/.test(normalized);
    const isAcceptCrewCommand =
      Boolean(crewMatchCrewNameQuery) &&
      /\b(?:accept|approve)\b/.test(normalized) &&
      /\bcrew\b/.test(normalized);
    const isDenyCrewCommand =
      Boolean(crewMatchCrewNameQuery) &&
      /\b(?:deny|decline|pass on)\b/.test(normalized) &&
      /\bcrew\b/.test(normalized);
    const isConfirmCommand = /\b(confirm|approve|accept)\b/.test(normalized) && /\b(appointment|booking|job|visit)\b/.test(normalized);
    const isCompleteCommand = /\b(complete|finish|wrap up|done with)\b/.test(normalized) && /\b(appointment|booking|job|visit|service)\b/.test(normalized);
    const isLateCommand = Boolean(lateMinutes) && /\blate|behind\b/.test(normalized);
    const isRescheduleCommand = Boolean(targetWindowKey && /change|move|shift|resched/.test(normalized));
    const isExceptionCommand =
      Boolean(exceptionType) &&
      /\b(no access|can't access|cannot access|unable to access|customer not ready|no show|no-show|could not complete|couldn't complete|cannot complete)\b/.test(
        normalized
      );
    const isStartWorkCommand = /\b(start work|begin work|start the job|begin the job|start service|begin service)\b/.test(
      normalized
    );
    const isStartRouteCommand = /\b(start route|start the route|on my way|head out|heading out|leave for|heading to)\b/.test(
      normalized
    );
    const isArrivalUpdateCommand =
      !isStartWorkCommand &&
      /\b(arrived|at the property|at the house|we'?re here|we are here|i'?m here|i am here|on[-\s]?site|starting soon|getting set up)\b/.test(
        normalized
      );

    const actionType = isCrewMessageCommand
      ? "message-crew"
      : isClearRouteStopCommand
        ? "clear-route-stop"
      : isSetRouteStopCommand
        ? "set-route-stop"
      : isStaffingAdjustmentCommand
        ? "recommend-staffing-adjustment"
      : isDispatchAdjustmentCommand
        ? "recommend-dispatch-adjustment"
      : isDispatchSummaryCommand
        ? "summarize-dispatch"
      : isAcceptBestCrewCommand
        ? "accept-best-crew-match"
      : isAcceptCrewCommand
        ? "accept-crew-match"
        : isDenyCrewCommand
          ? "deny-crew-match"
      : isAssignRouteLeaderCommand
      ? "assign-route-leader"
      : isClearRouteLeaderCommand
        ? "clear-route-leader"
        : isConfirmCommand
      ? "confirm-booking"
      : isCompleteCommand
        ? "complete-booking"
        : isExceptionCommand
          ? "report-booking-exception"
          : isRescheduleCommand
            ? "reschedule-booking"
            : isLateCommand
              ? "mark-booking-late"
              : isArrivalUpdateCommand || isStartRouteCommand
                ? "start-route"
                : isStartWorkCommand
                  ? "start-work"
                  : undefined;

    if (!actionType) {
      return undefined;
    }

    return {
      command,
      actionType,
      dispatchScope,
      dispatchFocus,
      sourceWindowKey,
      targetWindowKey,
      crewMatchCrewNameQuery,
      routeLeaderCrewNameQuery,
      crewMessageCrewNameQuery: crewMessageDetails?.crewNameQuery,
      crewMessageTarget: crewMessageDetails?.target,
      crewMessageBody: crewMessageDetails?.body,
      routeStopKind,
      notifyCustomer:
        actionType === "confirm-booking" ||
        actionType === "complete-booking" ||
        actionType === "report-booking-exception" ||
        actionType === "mark-booking-late" ||
        actionType === "start-route"
          ? true
          : notifyCustomer,
      lateMinutes,
      lateReason,
      arrivalUpdate: isArrivalUpdateCommand,
      exceptionType,
      exceptionNotes
    };
  }

  private parseProviderAssistantExceptionType(command: string): MarkBookingExceptionRequest["exceptionType"] | undefined {
    if (/\b(no show|no-show)\b/.test(command)) {
      return "customer-no-show";
    }

    if (/\bcustomer not ready\b/.test(command)) {
      return "customer-not-ready";
    }

    if (/\b(no access|can't access|cannot access|unable to access)\b/.test(command)) {
      return "unable-to-access-property";
    }

    if (/\b(could not complete|couldn't complete|cannot complete)\b/.test(command)) {
      return "service-could-not-be-completed";
    }

    return undefined;
  }

  private parseProviderAssistantExceptionNotes(command: string): string | undefined {
    const match = command.match(/\b(?:because|reason[:]?|due to)\b\s+(.+)$/i);
    return match?.[1]?.trim() || undefined;
  }

  private parseProviderAssistantRouteLeaderCrewName(command: string): string | undefined {
    const assignMatch =
      command.match(/\b(?:assign|make|set)\s+(.+?)\s+(?:as\s+|the\s+)?route leader\b/i) ??
      command.match(/\broute leader\s+(?:should be|is)\s+(.+?)(?:\s+for\b|$)/i);
    return assignMatch?.[1]?.trim();
  }

  private parseProviderAssistantRouteStopKind(
    command: string
  ): SetBookingRouteStopRequest["kind"] | undefined {
    if (/\bstaging stop\b/.test(command)) {
      return "staging";
    }

    if (/\bequipment pickup\b/.test(command) || /\bpickup stop\b/.test(command)) {
      return "equipment-pickup";
    }

    return undefined;
  }

  private parseProviderAssistantCrewMatchName(command: string): string | undefined {
    const reviewMatch =
      command.match(/\b(?:accept|approve|deny|decline)\s+(.+?)(?:\s+for\b|$)/i) ??
      command.match(/\bpass on\s+(.+?)(?:\s+for\b|$)/i);
    return reviewMatch?.[1]?.trim();
  }

  private parseProviderAssistantDispatchScope(
    command: string
  ): "today" | "tomorrow" | "next-7-days" | undefined {
    if (/\b(next 7 days|next seven days|this week|next week)\b/.test(command)) {
      return "next-7-days";
    }

    if (/\btomorrow\b/.test(command)) {
      return "tomorrow";
    }

    if (/\btoday\b/.test(command)) {
      return "today";
    }

    return undefined;
  }

  private parseProviderAssistantDispatchFocus(command: string): "summary" | "attention" {
    return /\b(attention|risk|risky|problem|pressure|overloaded|watch)\b/.test(command)
      ? "attention"
      : "summary";
  }

  private parseProviderAssistantCrewMessage(
    command: string
  ): {
    crewNameQuery?: string;
    target?: "named-crew" | "route-leader" | "accepted-crew";
    body?: string;
  } | undefined {
    const routeLeaderMatch =
      command.match(/\b(?:tell|ask|message)\s+(?:the\s+)?route leader\s+to\s+(.+)$/i) ??
      command.match(/\b(?:tell|ask|message)\s+(?:the\s+)?route leader\s+(?:that|about)\s+(.+)$/i);
    if (routeLeaderMatch?.[1]) {
      return {
        target: "route-leader",
        body: this.toSentenceCase(this.stripProviderAssistantBookingSelector(routeLeaderMatch[1]))
      };
    }

    const acceptedCrewMatch =
      command.match(/\b(?:tell|ask|message)\s+(?:the\s+)?(?:accepted crew|assigned crew|crew team|whole crew|all crew|crew)\s+to\s+(.+)$/i) ??
      command.match(/\b(?:tell|ask|message)\s+(?:the\s+)?(?:accepted crew|assigned crew|crew team|whole crew|all crew|crew)\s+(?:that|about)\s+(.+)$/i);
    if (acceptedCrewMatch?.[1]) {
      return {
        target: "accepted-crew",
        body: this.toSentenceCase(this.stripProviderAssistantBookingSelector(acceptedCrewMatch[1]))
      };
    }

    const match =
      command.match(/\b(?:tell|ask)\s+(.+?)\s+to\s+(.+)$/i) ??
      command.match(/\b(?:message|tell|ask)\s+(.+?)\s+(?:that|about)\s+(.+)$/i);
    if (!match) {
      return undefined;
    }

    const crewNameQuery = match[1]?.trim();
    const body = this.stripProviderAssistantBookingSelector(match[2] ?? "");
    if (!crewNameQuery || !body) {
      return undefined;
    }

    return {
      crewNameQuery,
      target: "named-crew",
      body: this.toSentenceCase(body)
    };
  }

  private stripProviderAssistantBookingSelector(value: string): string {
    return value
      .trim()
      .replace(
        /\s+for\s+(?:my|this|the|today'?s)\s+(?:(?:late\s+afternoon(?:\s*\/\s*evening)?)|morning|afternoon|evening|night)\s+(?:appointment|booking|job|visit)\b.*$/i,
        ""
      )
      .replace(/\s+for\s+(?:my|this|the)\s+(?:appointment|booking|job|visit)\b.*$/i, "")
      .replace(/^["'\s]+|["'\s]+$/g, "")
      .trim();
  }

  private parseProviderAssistantWindowFromCommand(
    text: string,
    targetOnly = false
  ): "morning" | "afternoon" | "late-afternoon-night" | undefined {
    if (/late afternoon|evening|night/.test(text)) {
      return "late-afternoon-night";
    }

    if (/afternoon/.test(text)) {
      return "afternoon";
    }

    if (/morning/.test(text)) {
      return "morning";
    }

    return targetOnly ? undefined : undefined;
  }

  private async listProviderAssistantCandidates(providerId: string) {
    const [bookings, customers] = await Promise.all([
      this.repository.listBookings(),
      this.repository.listCustomers()
    ]);
    const customerById = new Map(customers.map((customer) => [customer.id, customer]));

    return bookings
      .filter(
        (booking) =>
          booking.providerId === providerId &&
          booking.status !== "cancelled" &&
          booking.status !== "completed" &&
          booking.status !== "refunded" &&
          Date.parse(booking.scheduledStartIso) > Date.now()
      )
      .sort((left, right) => left.scheduledStartIso.localeCompare(right.scheduledStartIso))
      .map((booking) => ({
        ...booking,
        customerName: customerById.get(booking.customerId)?.fullName ?? "Customer"
      }));
  }

  private async listProviderAssistantBookingMatches(
    providerId: string,
    bookingId: string
  ): Promise<CrewMatchCandidate[]> {
    const staffing = await this.getProviderStaffingOverview(providerId);
    return staffing.jobs.find((job) => job.bookingId === bookingId)?.matches ?? [];
  }

  private toProviderAssistantBookingCandidate(booking: Booking & { customerName?: string }): ProviderAssistantBookingCandidate {
    const window = getBookingServiceWindow(booking.scheduledStartIso);
    return {
      bookingId: booking.id,
      customerName: booking.customerName ?? "Customer",
      scheduledStartIso: booking.scheduledStartIso,
      scheduledEndIso: booking.scheduledEndIso,
      currentWindowKey: window.key,
      currentWindowLabel: window.label,
      addressLine: this.formatAddressLine(booking.serviceAddress)
    };
  }

  private toProviderAssistantBookingCandidateFromCalendarEvent(
    event: ProviderCalendarOverviewResponse["events"][number]
  ): ProviderAssistantBookingCandidate | undefined {
    if (event.source !== "yardmatch-booking" || !event.bookingId) {
      return undefined;
    }

    const window = getBookingServiceWindow(event.startIso);
    const addressLine =
      event.addressLine ??
      ([event.city, event.state].filter(Boolean).join(", ") || "Service address");

    return {
      bookingId: event.bookingId,
      customerName: event.customerName ?? "Customer",
      scheduledStartIso: event.startIso,
      scheduledEndIso: event.endIso,
      currentWindowKey: window.key,
      currentWindowLabel: window.label,
      addressLine
    };
  }

  private toProviderAssistantBookingCandidateFromStaffingJob(
    job: ProviderStaffingJobSummary
  ): ProviderAssistantBookingCandidate {
    const window = getBookingServiceWindow(job.scheduledStartIso);
    return {
      bookingId: job.bookingId,
      customerName: job.customerName,
      scheduledStartIso: job.scheduledStartIso,
      scheduledEndIso: job.scheduledEndIso,
      currentWindowKey: window.key,
      currentWindowLabel: window.label,
      addressLine: this.formatAddressLine(job.serviceAddress)
    };
  }

  private getProviderAssistantStaffingJobsNeedingCrew(
    staffing: ProviderStaffingOverview,
    dayStartIso: string,
    dayEndIso: string,
    windowKey?: BookingServiceWindowKey
  ): ProviderStaffingJobSummary[] {
    return staffing.jobs
      .filter((job) => {
        if (job.crewGap <= 0 && !job.requiresRouteLeaderAssignment) {
          return false;
        }

        if (!this.doIntervalsOverlap(job.scheduledStartIso, job.scheduledEndIso, dayStartIso, dayEndIso)) {
          return false;
        }

        return windowKey ? getBookingServiceWindow(job.scheduledStartIso).key === windowKey : true;
      })
      .sort((left, right) => {
        const uncoveredGapDelta =
          this.getProviderAssistantUncoveredCrewGap(right) - this.getProviderAssistantUncoveredCrewGap(left);
        if (uncoveredGapDelta !== 0) {
          return uncoveredGapDelta;
        }

        const gapDelta = right.crewGap - left.crewGap;
        if (gapDelta !== 0) {
          return gapDelta;
        }

        if (left.requiresRouteLeaderAssignment !== right.requiresRouteLeaderAssignment) {
          return right.requiresRouteLeaderAssignment ? 1 : -1;
        }

        return new Date(left.scheduledStartIso).getTime() - new Date(right.scheduledStartIso).getTime();
      });
  }

  private buildProviderAssistantStaffingPlan(
    jobsNeedingCrew: ProviderStaffingJobSummary[]
  ): ProviderAssistantStaffingPlanItem[] {
    return jobsNeedingCrew.map((job) => {
      const pendingMatchCount = this.getProviderAssistantPendingMatchCount(job);
      const uncoveredCrewGap = this.getProviderAssistantUncoveredCrewGap(job);
      const acceptedCrewCount = job.matches.filter((match) => match.status === "accepted").length;
      const recommendedRouteLeader = this.selectProviderAssistantRouteLeaderCandidate(job);
      const window = getBookingServiceWindow(job.scheduledStartIso);
      const recommendedAction =
        job.crewGap <= 0
          ? job.requiresRouteLeaderAssignment
            ? "assign-route-leader"
            : "covered"
          : pendingMatchCount >= job.crewGap
            ? "review-pending-matches"
            : pendingMatchCount > 0
              ? "review-pending-then-source"
              : "source-more-crew";
      const reasons = [
        `${job.customerName}'s ${window.label.toLowerCase()} ${this.titleCaseCategory(
          job.category
        ).toLowerCase()} booking needs ${job.requiredCrewMembers} crew member${
          job.requiredCrewMembers === 1 ? "" : "s"
        }.`,
        `${job.assignedCrewMembers} assigned, ${acceptedCrewCount} accepted, ${pendingMatchCount} pending review.`
      ];

      if (uncoveredCrewGap > 0) {
        reasons.push(
          `${uncoveredCrewGap} crew slot${uncoveredCrewGap === 1 ? "" : "s"} still need${
            uncoveredCrewGap === 1 ? "s" : ""
          } sourcing after pending matches.`
        );
      } else if (pendingMatchCount > 0) {
        reasons.push("Pending matches can close the visible gap without sourcing new crew.");
      } else {
        reasons.push("Current accepted and assigned crew cover the planned requirement.");
      }

      if (job.requiresRouteLeaderAssignment) {
        reasons.push(
          recommendedRouteLeader
            ? `Assign ${recommendedRouteLeader.crewMemberName} as route leader so the accepted crew has one field owner.`
            : "Assign a route leader before the accepted crew starts travel."
        );
      } else if (job.assignedRouteLeaderCrewMemberName) {
        reasons.push(`${job.assignedRouteLeaderCrewMemberName} is already set as route leader.`);
      }

      return {
        bookingId: job.bookingId,
        customerName: job.customerName,
        category: job.category,
        scheduledStartIso: job.scheduledStartIso,
        scheduledEndIso: job.scheduledEndIso,
        currentWindowKey: window.key,
        currentWindowLabel: window.label,
        requiredCrewMembers: job.requiredCrewMembers,
        assignedCrewMembers: job.assignedCrewMembers,
        acceptedCrewCount,
        pendingMatchCount,
        crewGap: job.crewGap,
        uncoveredCrewGap,
        routeLeaderRequired: job.requiresRouteLeaderAssignment,
        routeLeaderAssigned: Boolean(job.assignedRouteLeaderCrewMemberId),
        assignedRouteLeaderCrewMemberId: job.assignedRouteLeaderCrewMemberId,
        assignedRouteLeaderCrewMemberName: job.assignedRouteLeaderCrewMemberName,
        recommendedRouteLeaderCrewMemberId: recommendedRouteLeader?.crewMemberId,
        recommendedRouteLeaderCrewMemberName: recommendedRouteLeader?.crewMemberName,
        recommendedAction,
        reasons
      };
    });
  }

  private buildProviderAssistantStaffingPlanPreview(plan: ProviderAssistantStaffingPlanItem[]): string {
    if (plan.length <= 1) {
      return "";
    }

    const sourceCount = plan.filter(
      (item) => item.recommendedAction === "source-more-crew" || item.recommendedAction === "review-pending-then-source"
    ).length;
    const reviewCount = plan.filter(
      (item) =>
        item.recommendedAction === "review-pending-matches" || item.recommendedAction === "review-pending-then-source"
    ).length;
    const routeLeaderCount = plan.filter((item) => item.recommendedAction === "assign-route-leader").length;
    const planParts = [
      sourceCount > 0
        ? `${sourceCount} job${sourceCount === 1 ? "" : "s"} still need${sourceCount === 1 ? "s" : ""} sourcing`
        : undefined,
      reviewCount > 0
        ? `${reviewCount} job${reviewCount === 1 ? "" : "s"} should review pending matches`
        : undefined,
      routeLeaderCount > 0
        ? `${routeLeaderCount} job${routeLeaderCount === 1 ? "" : "s"} need${
            routeLeaderCount === 1 ? "s" : ""
          } a route leader`
        : undefined
    ].filter((part): part is string => Boolean(part));

    if (planParts.length === 0) {
      return ` Staffing plan covers ${plan.length} competing jobs.`;
    }

    return ` Staffing plan covers ${plan.length} competing jobs: ${planParts.join("; ")}.`;
  }

  private getProviderAssistantPendingMatchCount(job: ProviderStaffingJobSummary): number {
    return job.matches.filter((match) => match.status === "pending-provider-review").length;
  }

  private getProviderAssistantUncoveredCrewGap(job: ProviderStaffingJobSummary): number {
    return Math.max(job.crewGap - this.getProviderAssistantPendingMatchCount(job), 0);
  }

  private selectProviderAssistantRouteLeaderCandidate(
    job: ProviderStaffingJobSummary
  ): CrewMatchCandidate | undefined {
    return [...job.matches]
      .filter((match) => match.status === "accepted")
      .sort((left, right) => {
        const scoreDelta = (right.recommendationScore ?? 0) - (left.recommendationScore ?? 0);
        if (scoreDelta !== 0) {
          return scoreDelta;
        }

        if (left.autoAccepted !== right.autoAccepted) {
          return left.autoAccepted ? -1 : 1;
        }

        return left.distanceMiles - right.distanceMiles;
      })[0];
  }

  private selectProviderAssistantDispatchFocusWindow(
    targetDay: ProviderCalendarOverviewResponse["dispatchDays"][number]
  ): ProviderCalendarOverviewResponse["dispatchDays"][number]["windowSummaries"][number] | undefined {
    return [...targetDay.windowSummaries].sort((left, right) => {
      const crewGapDelta = right.crewGap - left.crewGap;
      if (crewGapDelta !== 0) {
        return crewGapDelta;
      }

      const bookedDelta = right.bookedMinutes - left.bookedMinutes;
      if (bookedDelta !== 0) {
        return bookedDelta;
      }

      return right.blockedMinutes - left.blockedMinutes;
    })[0];
  }

  private selectProviderAssistantWeekAttentionDay(
    overview: ProviderCalendarOverviewResponse
  ): ProviderCalendarOverviewResponse["dispatchDays"][number] | undefined {
    if (overview.dispatchDays.length === 0) {
      return undefined;
    }

    return [...overview.dispatchDays].sort((left, right) => {
      const routeStatusDelta = this.providerDispatchRoutePriority(right.routeStatus) - this.providerDispatchRoutePriority(left.routeStatus);
      if (routeStatusDelta !== 0) {
        return routeStatusDelta;
      }

      const crewGapDelta = right.crewGap - left.crewGap;
      if (crewGapDelta !== 0) {
        return crewGapDelta;
      }

      const driveDelta = right.estimatedDriveMiles - left.estimatedDriveMiles;
      if (driveDelta !== 0) {
        return driveDelta;
      }

      return right.yardmatchJobCount - left.yardmatchJobCount;
    })[0];
  }

  private providerDispatchRoutePriority(status: ProviderDispatchRouteStatus): number {
    if (status === "overloaded") {
      return 3;
    }

    if (status === "watch") {
      return 2;
    }

    return 1;
  }

  private selectProviderAssistantReliefWindow(
    targetDay: ProviderCalendarOverviewResponse["dispatchDays"][number],
    focusWindow: ProviderCalendarOverviewResponse["dispatchDays"][number]["windowSummaries"][number]
  ): ProviderCalendarOverviewResponse["dispatchDays"][number]["windowSummaries"][number] | undefined {
    const focusPressure = this.calculateProviderAssistantDispatchWindowPressure(focusWindow);
    const bestWindow = [...targetDay.windowSummaries]
      .filter((window) => window.windowKey !== focusWindow.windowKey)
      .sort((left, right) => {
        const pressureDelta =
          this.calculateProviderAssistantDispatchWindowPressure(left) -
          this.calculateProviderAssistantDispatchWindowPressure(right);
        if (pressureDelta !== 0) {
          return pressureDelta;
        }

        return left.yardmatchJobCount - right.yardmatchJobCount;
      })[0];

    if (!bestWindow) {
      return undefined;
    }

    const bestPressure = this.calculateProviderAssistantDispatchWindowPressure(bestWindow);
    return bestPressure + 45 <= focusPressure ? bestWindow : undefined;
  }

  private isProviderAssistantStaffingPressureDominant(
    targetDay: ProviderCalendarOverviewResponse["dispatchDays"][number],
    focusWindow: ProviderCalendarOverviewResponse["dispatchDays"][number]["windowSummaries"][number]
  ): boolean {
    return (
      focusWindow.crewGap > 0 &&
      focusWindow.crewGap > focusWindow.yardmatchJobCount &&
      targetDay.crewGap > 0 &&
      focusWindow.blockedMinutes < 90 &&
      targetDay.estimatedDriveMiles < 22 &&
      targetDay.longestDriveLegMiles < 8 &&
      targetDay.largestIdleGapMinutes < 90
    );
  }

  private calculateProviderAssistantDispatchWindowPressure(
    window: ProviderCalendarOverviewResponse["dispatchDays"][number]["windowSummaries"][number]
  ): number {
    return window.crewGap * 240 + window.bookedMinutes + window.blockedMinutes + window.yardmatchJobCount * 45;
  }

  private buildProviderAssistantTargetWindowFromSlot(
    booking: Booking,
    slot: AvailabilitySlot
  ) {
    const durationMs =
      new Date(booking.scheduledEndIso).getTime() - new Date(booking.scheduledStartIso).getTime();
    const start = new Date(slot.startIso);
    return {
      startIso: start.toISOString(),
      endIso: new Date(start.getTime() + durationMs).toISOString()
    };
  }

  private async findProviderAssistantCrossDayReliefSlot(
    providerId: string,
    booking: Booking,
    afterIso: string
  ): Promise<AvailabilitySlot | undefined> {
    const provider = await this.repository.findProviderById(providerId);
    if (!provider) {
      return undefined;
    }

    const durationMinutes = Math.max(
      30,
      (new Date(booking.scheduledEndIso).getTime() - new Date(booking.scheduledStartIso).getTime()) / 60_000
    );
    const providerSlots = this.filterProviderSlotsAgainstExternalBlocks(
      provider,
      await this.repository.listSlotsByProvider(provider.id)
    );
    const candidateSlots = providerSlots.filter(
      (slot) =>
        !slot.isBooked &&
        Date.parse(slot.startIso) >= Date.parse(afterIso) &&
        this.isWithinProviderAcceptanceWindow(provider, slot.startIso) &&
        Date.parse(slot.endIso) - Date.parse(slot.startIso) >= durationMinutes * 60_000
    );

    if (candidateSlots.length === 0) {
      return undefined;
    }

    const overview = await this.getProviderCalendarOverview(providerId, {
      fromIso: afterIso,
      toIso: new Date(Date.parse(afterIso) + 7 * 24 * 60 * 60 * 1000).toISOString()
    });

    return [...candidateSlots].sort((left, right) => {
      const scoreDelta =
        this.scoreProviderAssistantCrossDayReliefSlot(left, overview) -
        this.scoreProviderAssistantCrossDayReliefSlot(right, overview);
      if (scoreDelta !== 0) {
        return scoreDelta;
      }

      return Date.parse(left.startIso) - Date.parse(right.startIso);
    })[0];
  }

  private scoreProviderAssistantCrossDayReliefSlot(
    slot: AvailabilitySlot,
    overview: ProviderCalendarOverviewResponse
  ): number {
    const slotDay = overview.dispatchDays.find(
      (day) => day.dateIso.slice(0, 10) === this.localDateKey(slot.startIso)
    );
    if (!slotDay) {
      return 0;
    }

    const slotWindowKey = getBookingServiceWindow(slot.startIso).key;
    const slotWindow = slotDay.windowSummaries.find((window) => window.windowKey === slotWindowKey);

    return (
      this.providerDispatchRoutePriority(slotDay.routeStatus) * 1_000 +
      slotDay.crewGap * 250 +
      slotDay.estimatedDriveMiles * 8 +
      (slotWindow ? this.calculateProviderAssistantDispatchWindowPressure(slotWindow) : 0)
    );
  }

  private orderProviderAssistantDispatchAdjustmentCandidates(
    candidates: ProviderAssistantBookingCandidate[],
    sourceWindowKey: BookingServiceWindowKey,
    targetWindowKey?: BookingServiceWindowKey
  ): ProviderAssistantBookingCandidate[] {
    const ordered = [...candidates].sort((left, right) =>
      new Date(left.scheduledStartIso).getTime() - new Date(right.scheduledStartIso).getTime()
    );

    if (!targetWindowKey || targetWindowKey === sourceWindowKey) {
      return ordered.reverse();
    }

    const moveEarlier =
      sourceWindowKey === "late-afternoon-night" ||
      (sourceWindowKey === "afternoon" && targetWindowKey === "morning");
    return moveEarlier ? ordered : ordered.reverse();
  }

  private buildProviderAssistantDispatchBookingCandidates(
    overview: ProviderCalendarOverviewResponse,
    targetDay: ProviderCalendarOverviewResponse["dispatchDays"][number],
    focusWindow?: ProviderCalendarOverviewResponse["dispatchDays"][number]["windowSummaries"][number]
  ): ProviderAssistantBookingCandidate[] {
    const dayStartIso = targetDay.dateIso;
    const dayEndIso = new Date(new Date(targetDay.dateIso).getTime() + 24 * 60 * 60 * 1000).toISOString();

    const dayEvents = overview.events
      .filter(
        (event) =>
          event.source === "yardmatch-booking" &&
          event.bookingId &&
          this.doIntervalsOverlap(event.startIso, event.endIso, dayStartIso, dayEndIso)
      )
      .sort((left, right) => new Date(left.startIso).getTime() - new Date(right.startIso).getTime());

    const focusEvents =
      focusWindow && focusWindow.yardmatchJobCount > 0
        ? dayEvents.filter((event) => getBookingServiceWindow(event.startIso).key === focusWindow.windowKey)
        : dayEvents;

    const candidateEvents = focusEvents.length > 0 ? focusEvents : dayEvents;
    const seenBookingIds = new Set<string>();

    return candidateEvents.flatMap((event) => {
      if (!event.bookingId || seenBookingIds.has(event.bookingId)) {
        return [];
      }

      const candidate = this.toProviderAssistantBookingCandidateFromCalendarEvent(event);
      if (!candidate) {
        return [];
      }

      seenBookingIds.add(event.bookingId);
      return [candidate];
    });
  }

  private buildProviderAssistantDispatchWindow(scope: "today" | "tomorrow" | "next-7-days"): {
    fromIso: string;
    toIso: string;
  } {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    if (scope === "tomorrow") {
      start.setDate(start.getDate() + 1);
    }

    const end = new Date(start);
    end.setDate(end.getDate() + (scope === "next-7-days" ? 7 : 1));
    return {
      fromIso: start.toISOString(),
      toIso: end.toISOString()
    };
  }

  private providerAssistantDispatchScopeLabel(scope: "today" | "tomorrow" | "next-7-days"): string {
    switch (scope) {
      case "tomorrow":
        return "Tomorrow";
      case "next-7-days":
        return "The next 7 days";
      default:
        return "Today";
    }
  }

  private buildProviderAssistantTargetWindow(
    booking: Booking,
    targetWindowKey: "morning" | "afternoon" | "late-afternoon-night"
  ) {
    const durationMs =
      new Date(booking.scheduledEndIso).getTime() - new Date(booking.scheduledStartIso).getTime();
    const start = new Date(booking.scheduledStartIso);

    if (targetWindowKey === "morning") {
      start.setHours(8, 0, 0, 0);
    } else if (targetWindowKey === "afternoon") {
      start.setHours(13, 0, 0, 0);
    } else {
      start.setHours(17, 0, 0, 0);
    }

    if (start.getTime() <= Date.now()) {
      start.setDate(start.getDate() + 1);
    }

    const end = new Date(start.getTime() + durationMs);
    return {
      startIso: start.toISOString(),
      endIso: end.toISOString()
    };
  }

  private buildProviderAssistantLateEta(booking: Booking, lateMinutes: number): string {
    const scheduledStartMs = new Date(booking.scheduledStartIso).getTime();
    const baselineMs = Math.max(scheduledStartMs, Date.now());
    return new Date(baselineMs + lateMinutes * 60 * 1000).toISOString();
  }

  private providerAssistantWindowLabel(windowKey: "morning" | "afternoon" | "late-afternoon-night"): string {
    return windowKey === "late-afternoon-night" ? "Late afternoon / evening" : this.toTitleCase(windowKey);
  }

  private parseProviderAssistantLateMinutes(command: string): number | undefined {
    const match =
      command.match(/(\d+)\s*(minute|minutes|min|mins)\s+late/) ??
      command.match(/late\s+by\s+(\d+)\s*(minute|minutes|min|mins)/) ??
      command.match(/(\d+)\s*(hour|hours|hr|hrs)\s+late/) ??
      command.match(/late\s+by\s+(\d+)\s*(hour|hours|hr|hrs)/);

    if (!match) {
      return undefined;
    }

    const numericValue = Number(match[1]);
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      return undefined;
    }

    return /hour|hours|hr|hrs/.test(match[2] ?? "") ? numericValue * 60 : numericValue;
  }

  private parseProviderAssistantLateReason(command: string): string | undefined {
    const becauseMatch = command.match(/\b(?:because|due to)\b\s+(.+)$/);
    if (becauseMatch?.[1]) {
      return this.toSentenceCase(becauseMatch[1].trim().replace(/[.]+$/, ""));
    }

    const finishingMatch = command.match(/\b(finishing .+)$/);
    if (finishingMatch?.[1]) {
      return this.toSentenceCase(finishingMatch[1].trim().replace(/[.]+$/, ""));
    }

    return undefined;
  }

  public async getUserByIdentity(
    identity: AuthIdentityRecord
  ): Promise<CurrentUserResponse["user"] | undefined> {
    if (identity.role === "customer") {
      return this.repository.findCustomerById(identity.userId);
    }

    if (identity.role === "provider") {
      return this.repository.findProviderById(identity.userId);
    }

    if (identity.role === "ops") {
      return this.repository.findOpsUserById(identity.userId);
    }

    return this.repository.findCrewMemberById(identity.userId);
  }

  public buildSensitiveActionPolicy(
    identity: AuthIdentityRecord,
    sessionIssuedAtSeconds?: number
  ): SensitiveActionPolicy {
    const now = Date.now();
    const issuedAtMs = sessionIssuedAtSeconds ? sessionIssuedAtSeconds * 1000 : undefined;
    const maxAgeSeconds = MarketplacePlatformService.sensitiveActionFreshSessionMaxAgeSeconds;
    const sessionFreshUntilIso = issuedAtMs
      ? new Date(issuedAtMs + maxAgeSeconds * 1000).toISOString()
      : undefined;
    const isCurrentSessionFresh =
      issuedAtMs !== undefined ? now <= issuedAtMs + maxAgeSeconds * 1000 : false;
    const buildAction = (
      action: Omit<
        SensitiveActionPolicyItem,
        "maxSessionAgeSeconds" | "sessionFreshUntilIso" | "isCurrentSessionFresh"
      >
    ): SensitiveActionPolicyItem => ({
      ...action,
      maxSessionAgeSeconds: maxAgeSeconds,
      sessionFreshUntilIso,
      isCurrentSessionFresh
    });
    const providerActions: SensitiveActionPolicyItem[] =
      identity.role === "provider"
        ? [
            buildAction({
              key: "provider-payout-settings",
              label: "Provider payout timing and instant payout settings",
              ownerRole: "provider",
              requiresFreshSession: true,
              enforcementStatus: "enforced",
              currentBackendSurface: "POST /api/providers/settings",
              rationale:
                "Weekly payout day and instant-payout preference affect settlement timing, so changes require a fresh provider session."
            }),
            buildAction({
              key: "provider-bank-account",
              label: "Provider bank account changes",
              ownerRole: "provider",
              requiresFreshSession: true,
              enforcementStatus: "contract-ready",
              futureBackendSurface: "future provider bank-account update route",
              rationale:
                "Bank account changes will control where provider funds land and must use the same fresh-session standard before external payout rails are enabled."
            }),
            buildAction({
              key: "provider-payout-account",
              label: "Provider external payout account changes",
              ownerRole: "provider",
              requiresFreshSession: true,
              enforcementStatus: "contract-ready",
              futureBackendSurface: "future payout-provider account link/update route",
              rationale:
                "External payout account linking can redirect provider settlement and should not be accepted from an old bearer session."
            })
          ]
        : [];
    const customerActions: SensitiveActionPolicyItem[] =
      identity.role === "customer"
        ? [
            buildAction({
              key: "customer-payment-method",
              label: "Customer payment method changes",
              ownerRole: "customer",
              requiresFreshSession: true,
              enforcementStatus: "contract-ready",
              futureBackendSurface: "future customer payment-method update route",
              rationale:
                "Stored payment-method changes affect future checkout and refund flows and should require a fresh customer session once the backend stores payment methods."
            })
          ]
        : [];

    return {
      generatedAt: new Date(now).toISOString(),
      sessionIssuedAtIso: issuedAtMs ? new Date(issuedAtMs).toISOString() : undefined,
      actions: [...providerActions, ...customerActions]
    };
  }

  public async findOpsUserById(opsUserId: string): Promise<OpsProfile | undefined> {
    return this.repository.findOpsUserById(opsUserId);
  }

  public async findAuthIdentityByEmail(email: string): Promise<AuthIdentityRecord | undefined> {
    return this.repository.findAuthIdentityByEmail(email);
  }

  public async findAuthIdentityByProvider(
    provider: "google" | "apple",
    subject: string
  ): Promise<AuthIdentityRecord | undefined> {
    return this.repository.findAuthIdentityByProvider(provider, subject);
  }

  public async findAuthIdentityByUserId(userId: string): Promise<AuthIdentityRecord | undefined> {
    return this.repository.findAuthIdentityByUserId(userId);
  }

  public async updateAuthIdentity(
    userId: string,
    updates: Partial<AuthIdentityRecord>
  ): Promise<AuthIdentityRecord | undefined> {
    return this.repository.updateAuthIdentity(userId, updates);
  }

  private buildOpsAccountSummary(
    profile: OpsProfile,
    identity: AuthIdentityRecord | undefined
  ): OpsAccountSummary {
    const isAuthenticationLocked = this.isOpsAuthenticationLocked(identity);
    return {
      profile,
      sessionVersion: identity?.sessionVersion ?? 1,
      hasPassword: Boolean(identity?.passwordHash),
      isActive: !identity?.accessDisabledAt,
      isAuthenticationLocked,
      authenticationLockExpiresAt: isAuthenticationLocked ? identity?.authenticationLockExpiresAt : undefined,
      accessDisabledAt: identity?.accessDisabledAt,
      accessDisabledBy: identity?.accessDisabledBy,
      accessChangeNotes: identity?.accessChangeNotes,
      lastAccessChangeAt: identity?.lastAccessChangeAt,
      lastAccessChangeBy: identity?.lastAccessChangeBy,
      lastAccessChangeKind: identity?.lastAccessChangeKind,
      accessHistory: identity?.accessHistory ?? [],
      authHistory: identity?.authHistory ?? [],
      lastAuthenticatedAt: identity?.lastAuthenticatedAt,
      lastAuthenticatedMethod: identity?.lastAuthenticatedMethod,
      failedAuthenticationCount: identity?.failedAuthenticationCount ?? 0,
      lastFailedAuthenticationAt: identity?.lastFailedAuthenticationAt,
      lastFailedAuthenticationReason: identity?.lastFailedAuthenticationReason,
      passwordResetRequestedAt: identity?.resetPasswordRequestedAt,
      passwordResetExpiresAt: identity?.resetPasswordExpiresAt
    };
  }

  private buildOpsAccessAuditOverview(opsAccounts: OpsAccountSummary[]): {
    totalOpsAccounts: number;
    activeOpsAdminAccounts: number;
    activeOpsStaffAccounts: number;
    disabledOpsAccounts: number;
    lockedOpsAccounts: number;
    dormantOpsAccounts: number;
    neverSignedInOpsAccounts: number;
    opsAccountsWithRecentFailures: number;
    pendingOpsPasswordResetInvites: number;
    opsAccessPolicy: OpsAccessGovernancePolicy;
    accessAlerts: OpsAccessAlertItem[];
    recentOpsAccessChanges: OpsAccessAuditItem[];
    recentOpsAuthenticationEvents: OpsAuthenticationAuditItem[];
    recentOpsSignIns: OpsSignInAuditItem[];
    recentFailedOpsSignIns: OpsFailedSignInAuditItem[];
  } {
    const actorNames = new Map(
      opsAccounts.map((account) => [account.profile.id, account.profile.fullName])
    );
    const now = Date.now();
    const staleThresholdMs = now - 30 * 24 * 60 * 60 * 1000;
    const failureThresholdMs = now - 7 * 24 * 60 * 60 * 1000;
    const recentOpsAccessChanges = opsAccounts
      .flatMap((account) =>
        account.accessHistory.map((entry) => ({
          opsUserId: account.profile.id,
          opsUserName: account.profile.fullName,
          opsUserEmail: account.profile.email,
          internalScope: account.profile.internalScope,
          isActive: account.isActive,
          changedAt: entry.changedAt,
          changedBy: entry.changedBy,
          changedByName: entry.changedBy ? actorNames.get(entry.changedBy) : undefined,
          kind: entry.kind,
          notes: entry.notes
        }))
      )
      .sort((left, right) => right.changedAt.localeCompare(left.changedAt))
      .slice(0, 12);
    const recentOpsSignIns = opsAccounts
      .flatMap((account) => {
        if (!account.lastAuthenticatedAt || !account.lastAuthenticatedMethod) {
          return [];
        }

        return [
          {
            opsUserId: account.profile.id,
            opsUserName: account.profile.fullName,
            opsUserEmail: account.profile.email,
            internalScope: account.profile.internalScope,
            isActive: account.isActive,
            signedInAt: account.lastAuthenticatedAt,
            method: account.lastAuthenticatedMethod
          }
        ];
      })
      .sort((left, right) => right.signedInAt.localeCompare(left.signedInAt))
      .slice(0, 12);
    const recentOpsAuthenticationEvents = opsAccounts
      .flatMap((account) =>
        account.authHistory.map((entry) => ({
          opsUserId: account.profile.id,
          opsUserName: account.profile.fullName,
          opsUserEmail: account.profile.email,
          internalScope: account.profile.internalScope,
          isActive: account.isActive,
          occurredAt: entry.occurredAt,
          kind: entry.kind,
          recordedBy: entry.recordedBy,
          recordedByName: entry.recordedBy ? actorNames.get(entry.recordedBy) : undefined,
          method: entry.method,
          reason: entry.reason,
          failedCount: entry.failedCount,
          lockExpiresAt: entry.lockExpiresAt,
          notes: entry.notes
        }))
      )
      .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
      .slice(0, 16);
    const recentFailedOpsSignIns = opsAccounts
      .flatMap((account) => {
        if (!account.lastFailedAuthenticationAt || !account.lastFailedAuthenticationReason) {
          return [];
        }

        return [
          {
            opsUserId: account.profile.id,
            opsUserName: account.profile.fullName,
            opsUserEmail: account.profile.email,
            internalScope: account.profile.internalScope,
            isActive: account.isActive,
            failedAt: account.lastFailedAuthenticationAt,
            failedCount: account.failedAuthenticationCount,
            reason: account.lastFailedAuthenticationReason
          }
        ];
      })
      .sort((left, right) => right.failedAt.localeCompare(left.failedAt))
      .slice(0, 12);
    const accessAlerts = this.buildOpsAccessAlerts(opsAccounts);
    const activeOpsAdminAccounts = opsAccounts.filter(
      (account) => account.isActive && account.profile.internalScope === "admin"
    ).length;
    const activeOpsStaffAccounts = opsAccounts.filter(
      (account) => account.isActive && account.profile.internalScope === "operations"
    ).length;
    const opsAccessPolicy = this.buildOpsAccessGovernancePolicy({
      activeOpsAdminAccounts,
      activeOpsStaffAccounts,
      disabledOpsAccounts: opsAccounts.filter((account) => !account.isActive).length,
      lockedOpsAccounts: opsAccounts.filter((account) => account.isAuthenticationLocked).length
    });

    return {
      totalOpsAccounts: opsAccounts.length,
      activeOpsAdminAccounts,
      activeOpsStaffAccounts,
      disabledOpsAccounts: opsAccounts.filter((account) => !account.isActive).length,
      lockedOpsAccounts: opsAccounts.filter((account) => account.isAuthenticationLocked).length,
      dormantOpsAccounts: opsAccounts.filter((account) => {
        if (!account.isActive || !account.lastAuthenticatedAt) {
          return false;
        }

        const lastAuthenticatedAt = Date.parse(account.lastAuthenticatedAt);
        return !Number.isNaN(lastAuthenticatedAt) && lastAuthenticatedAt < staleThresholdMs;
      }).length,
      neverSignedInOpsAccounts: opsAccounts.filter(
        (account) => account.isActive && !account.lastAuthenticatedAt
      ).length,
      opsAccountsWithRecentFailures: opsAccounts.filter((account) => {
        if (!account.lastFailedAuthenticationAt || account.failedAuthenticationCount <= 0) {
          return false;
        }

        const failedAt = Date.parse(account.lastFailedAuthenticationAt);
        return !Number.isNaN(failedAt) && failedAt >= failureThresholdMs;
      }).length,
      pendingOpsPasswordResetInvites: opsAccounts.filter((account) => {
        if (!account.passwordResetExpiresAt) {
          return false;
        }

        const expiresAt = Date.parse(account.passwordResetExpiresAt);
        return !Number.isNaN(expiresAt) && expiresAt > now;
      }).length,
      opsAccessPolicy,
      accessAlerts,
      recentOpsAccessChanges,
      recentOpsAuthenticationEvents,
      recentOpsSignIns,
      recentFailedOpsSignIns
    };
  }

  private buildOpsAccessGovernancePolicy(input: {
    activeOpsAdminAccounts: number;
    activeOpsStaffAccounts: number;
    disabledOpsAccounts: number;
    lockedOpsAccounts: number;
  }): OpsAccessGovernancePolicy {
    const minimumActiveAdminAccounts = 1;
    const warnings: string[] = [];

    if (input.activeOpsAdminAccounts < minimumActiveAdminAccounts) {
      warnings.push("At least one active ops-admin account is required before internal staff tooling is launch-ready.");
    }
    if (input.lockedOpsAccounts > 0) {
      warnings.push("Review locked internal accounts before launch support hours begin.");
    }
    if (input.disabledOpsAccounts > 0) {
      warnings.push("Disabled internal accounts should be reviewed during staff-access audits.");
    }

    return {
      roleModel: "admin-and-operations",
      minimumActiveAdminAccounts,
      activeAdminAccountCount: input.activeOpsAdminAccounts,
      hasRequiredAdminCoverage: input.activeOpsAdminAccounts >= minimumActiveAdminAccounts,
      adminRequiredActions: [
        "create internal ops accounts",
        "change ops admin-vs-operations scope",
        "rotate another ops user's sessions or password",
        "prepare password reset or invite links for ops users",
        "deactivate or reactivate ops accounts",
        "clear temporary ops authentication locks"
      ],
      operationsAllowedActions: [
        "review ops overview and launch metrics",
        "work support, refund, dispute, review-response, launch-lead, payout-preview, notification-health, and provider-verification queues",
        "run retry or escalation workflows that do not change staff account access"
      ],
      authenticationControls: [
        "dedicated ops identities are required for internal tooling",
        "provider and business-owner accounts cannot access internal ops surfaces",
        "temporary lockouts trigger after repeated failed ops password attempts",
        "ops authentication and access changes are retained in durable audit history"
      ],
      escalationTriggers: [
        "no active ops-admin account",
        "locked internal staff account",
        "disabled account receiving login attempts",
        "recent repeated failed staff sign-ins",
        "pending reset invites or never-signed-in accounts before launch support hours"
      ],
      warnings
    };
  }

  private buildOpsAccessAlerts(opsAccounts: OpsAccountSummary[]): OpsAccessAlertItem[] {
    const now = Date.now();
    const recentFailureThresholdMs = now - 7 * 24 * 60 * 60 * 1000;
    const severityRank: Record<OpsAccessAlertItem["severity"], number> = {
      critical: 3,
      warning: 2,
      info: 1
    };
    const alerts: OpsAccessAlertItem[] = [];

    for (const account of opsAccounts) {
      if (account.isAuthenticationLocked && account.authenticationLockExpiresAt) {
        alerts.push({
          opsUserId: account.profile.id,
          opsUserName: account.profile.fullName,
          opsUserEmail: account.profile.email,
          severity: "critical",
          title: "Internal staff login is temporarily locked",
          detail: `${account.profile.fullName} hit the failed-login threshold and is locked until ${account.authenticationLockExpiresAt}.`,
          recommendedAction:
            "Verify the staff member, then clear the auth lock with an audit note or route them through password recovery."
        });
        continue;
      }

      if (
        !account.isActive &&
        account.lastFailedAuthenticationAt &&
        !Number.isNaN(Date.parse(account.lastFailedAuthenticationAt)) &&
        Date.parse(account.lastFailedAuthenticationAt) >= recentFailureThresholdMs
      ) {
        alerts.push({
          opsUserId: account.profile.id,
          opsUserName: account.profile.fullName,
          opsUserEmail: account.profile.email,
          severity: "warning",
          title: "Disabled internal account is still receiving login attempts",
          detail: `${account.profile.fullName} is disabled, but the account still had a recent failed login attempt marked ${account.lastFailedAuthenticationReason?.replaceAll("-", " ") ?? "unknown reason"}.`,
          recommendedAction:
            "Confirm whether the staff member still expects access and review whether credentials or old bookmarks need cleanup."
        });
        continue;
      }

      if (
        account.isActive &&
        !account.isAuthenticationLocked &&
        account.failedAuthenticationCount >= 3 &&
        account.lastFailedAuthenticationAt &&
        !Number.isNaN(Date.parse(account.lastFailedAuthenticationAt)) &&
        Date.parse(account.lastFailedAuthenticationAt) >= recentFailureThresholdMs
      ) {
        alerts.push({
          opsUserId: account.profile.id,
          opsUserName: account.profile.fullName,
          opsUserEmail: account.profile.email,
          severity: "warning",
          title: "Internal staff login is approaching lockout",
          detail: `${account.profile.fullName} has ${account.failedAuthenticationCount} recent failed login attempt${account.failedAuthenticationCount === 1 ? "" : "s"}.`,
          recommendedAction:
            "Check whether the staff member needs a reset link or whether the attempts look suspicious before the account locks."
        });
      }
    }

    return alerts
      .sort((left, right) => {
        const severityDelta = severityRank[right.severity] - severityRank[left.severity];
        if (severityDelta !== 0) {
          return severityDelta;
        }

        return left.opsUserName.localeCompare(right.opsUserName);
      })
      .slice(0, 10);
  }

  private isOpsAuthenticationLocked(identity: AuthIdentityRecord | undefined): boolean {
    if (!identity?.authenticationLockExpiresAt) {
      return false;
    }

    const lockExpiresAtMs = Date.parse(identity.authenticationLockExpiresAt);
    return !Number.isNaN(lockExpiresAtMs) && lockExpiresAtMs > Date.now();
  }

  public isAuthIdentityTemporarilyLocked(identity: AuthIdentityRecord | undefined): boolean {
    return identity?.role === "ops" ? this.isOpsAuthenticationLocked(identity) : false;
  }

  public getAuthIdentityLockExpiryIso(identity: AuthIdentityRecord | undefined): string | undefined {
    return this.isAuthIdentityTemporarilyLocked(identity) ? identity?.authenticationLockExpiresAt : undefined;
  }

  public async recordSuccessfulAuthentication(
    userId: string,
    method: OpsAuthenticationMethod
  ): Promise<AuthIdentityRecord | undefined> {
    const updatedIdentity = await this.repository.updateAuthIdentity(userId, {
      lastAuthenticatedAt: new Date(Date.now()).toISOString(),
      lastAuthenticatedMethod: method,
      failedAuthenticationCount: 0,
      lastFailedAuthenticationAt: undefined,
      lastFailedAuthenticationReason: undefined,
      authenticationLockExpiresAt: undefined
    });
    if (updatedIdentity?.role === "ops") {
      await this.appendOpsAuthenticationHistory(userId, {
        kind: "sign-in-succeeded",
        method
      });
      return (await this.repository.findAuthIdentityByUserId(userId)) ?? updatedIdentity;
    }

    return updatedIdentity;
  }

  public async recordFailedOpsAuthentication(
    identity: AuthIdentityRecord,
    reason: OpsFailedAuthenticationReason
  ): Promise<AuthIdentityRecord | undefined> {
    if (identity.role !== "ops") {
      return identity;
    }

    const currentIdentity = (await this.repository.findAuthIdentityByUserId(identity.userId)) ?? identity;
    const previousLockExpiresAt = currentIdentity.authenticationLockExpiresAt;
    const nextFailureCount = (currentIdentity.failedAuthenticationCount ?? 0) + 1;
    const nextLockExpiresAt =
      reason === "invalid-password" && nextFailureCount >= OPS_AUTH_FAILURE_LOCK_THRESHOLD
        ? new Date(Date.now() + OPS_AUTH_LOCK_WINDOW_MINUTES * 60 * 1000).toISOString()
        : currentIdentity.authenticationLockExpiresAt;
    const updatedIdentity = await this.repository.updateAuthIdentity(identity.userId, {
      failedAuthenticationCount: nextFailureCount,
      lastFailedAuthenticationAt: new Date(Date.now()).toISOString(),
      lastFailedAuthenticationReason: reason,
      authenticationLockExpiresAt: nextLockExpiresAt
    });
    await this.appendOpsAuthenticationHistory(identity.userId, {
      kind: "sign-in-failed",
      reason,
      failedCount: nextFailureCount,
      lockExpiresAt: nextLockExpiresAt
    });
    if (nextLockExpiresAt && nextLockExpiresAt !== previousLockExpiresAt) {
      await this.appendOpsAuthenticationHistory(identity.userId, {
        kind: "temporary-lock-triggered",
        reason,
        failedCount: nextFailureCount,
        lockExpiresAt: nextLockExpiresAt
      });
    }

    return (await this.repository.findAuthIdentityByUserId(identity.userId)) ?? updatedIdentity;
  }

  private async appendOpsAuthenticationHistory(
    userId: string,
    entry: Omit<OpsAuthenticationHistoryEntry, "occurredAt"> & { occurredAt?: string }
  ): Promise<void> {
    const current = await this.repository.findAuthIdentityByUserId(userId);
    if (!current || current.role !== "ops") {
      return;
    }

    const nextEntry: OpsAuthenticationHistoryEntry = {
      occurredAt: entry.occurredAt ?? new Date(Date.now()).toISOString(),
      kind: entry.kind,
      recordedBy: entry.recordedBy,
      method: entry.method,
      reason: entry.reason,
      failedCount: entry.failedCount,
      lockExpiresAt: entry.lockExpiresAt,
      notes: entry.notes
    };
    await this.repository.updateAuthIdentity(userId, {
      authHistory: [...(current.authHistory ?? []), nextEntry]
    });
  }

  private async applyAccessAudit(
    userId: string,
    input: {
      changedBy?: string;
      kind: OpsAccessChangeKind;
      notes?: string;
    }
  ): Promise<void> {
    const current = await this.repository.findAuthIdentityByUserId(userId);
    if (!current) {
      throw new HttpError(404, "Ops account not found.");
    }

    const changedAt = new Date(Date.now()).toISOString();
    const nextEntry: OpsAccessHistoryEntry = {
      changedAt,
      changedBy: input.changedBy,
      kind: input.kind,
      notes: input.notes
    };
    await this.repository.updateAuthIdentity(userId, {
      lastAccessChangeAt: changedAt,
      lastAccessChangeBy: input.changedBy,
      lastAccessChangeKind: input.kind,
      accessChangeNotes: input.notes,
      accessHistory: [...(current.accessHistory ?? []), nextEntry]
    });
  }

  private getDefaultOpsAccountAddress(): Address {
    return {
      line1: "18 Bay Ave",
      city: "Barnegat",
      state: "NJ",
      postalCode: "08005",
      country: "US",
      point: {
        latitude: 39.7532,
        longitude: -74.2229
      }
    };
  }

  private generateTemporaryStrongPassword(): string {
    return `YmOps${crypto.randomUUID().replaceAll("-", "").slice(0, 10)}1aA`;
  }

  private async assertAnotherActiveAdminExists(excludedOpsUserId: string): Promise<void> {
    const opsUsers = await this.repository.listOpsUsers();
    const otherAdmins = await Promise.all(
      opsUsers
        .filter((opsUser) => opsUser.id !== excludedOpsUserId && opsUser.internalScope === "admin")
        .map(async (opsUser) => {
          const identity = await this.repository.findAuthIdentityByUserId(opsUser.id);
          return identity && !identity.accessDisabledAt ? opsUser : undefined;
        })
    );
    if (!otherAdmins.some(Boolean)) {
      throw new HttpError(
        409,
        "Add or reactivate another admin ops account before removing admin access from this account."
      );
    }
  }

  public getAppBaseUrl(): string {
    return this.appBaseUrl;
  }

  public getApiBaseUrl(): string {
    return this.apiBaseUrl;
  }

  private async buildProviderStaffingSummaries(
    provider: ProviderProfile
  ): Promise<ProviderStaffingJobSummary[]> {
    await this.reconcileCrewMatches(provider.id);

    const [bookings, customers, matches, crewMembers] = await Promise.all([
      this.repository.listBookings(),
      this.repository.listCustomers(),
      this.repository.listCrewMatches(),
      this.repository.listCrewMembers()
    ]);

    return bookings
      .filter(
        (booking) =>
          booking.providerId === provider.id &&
          (booking.status === "requested" ||
            booking.status === "confirmed" ||
            booking.status === "in-progress" ||
            booking.status === "disputed")
      )
      .map((booking) => {
        const customer = customers.find((item) => item.id === booking.customerId);
        const requiredCrewMembers = this.estimateRequiredCrewMembers(
          booking,
          customer?.properties.find((property) => property.id === booking.servicePropertyId)
        );
        const bookingMatches = matches.filter((match) => match.bookingId === booking.id);
        const acceptedMatches = bookingMatches.filter((match) => match.status === "accepted");
        const assignedCrewMembers = acceptedMatches.length;
        const assignedRouteLeaderCrewMemberId = this.resolveDelegatedCrewRouteLeaderId(booking, acceptedMatches);
        const assignedRouteLeaderCrewMemberName = assignedRouteLeaderCrewMemberId
          ? crewMembers.find((item) => item.id === assignedRouteLeaderCrewMemberId)?.fullName
          : undefined;
        const requiresRouteLeaderAssignment =
          provider.routeLeaderMode === "accepted-crew-fallback" &&
          acceptedMatches.length > 1 &&
          !assignedRouteLeaderCrewMemberId;
        const matchesWithRecommendations = bookingMatches
          .map((match) => {
            const crewMember = crewMembers.find((item) => item.id === match.crewMemberId);
            if (!crewMember) {
              return match;
            }

            const recommendation = this.buildCrewMatchRecommendation({
              crewMember,
              booking,
              provider,
              allBookings: bookings,
              allMatches: matches
            });

            return {
              ...match,
              recommendationScore: recommendation.score,
              recommendationLabel: recommendation.label,
              recommendationReasons: recommendation.reasons
            };
          })
          .sort((left, right) => {
            const scoreDelta = (right.recommendationScore ?? 0) - (left.recommendationScore ?? 0);
            if (scoreDelta !== 0) {
              return scoreDelta;
            }
            return left.distanceMiles - right.distanceMiles;
          });

        return {
          bookingId: booking.id,
          customerName: customer?.fullName ?? "Customer",
          serviceAddress: booking.serviceAddress,
          category: booking.category,
          status: booking.status,
          scheduledStartIso: booking.scheduledStartIso,
          scheduledEndIso: booking.scheduledEndIso,
          assignedRouteLeaderCrewMemberId,
          assignedRouteLeaderCrewMemberName,
          requiresRouteLeaderAssignment,
          onRouteConfirmedAt: booking.onRouteConfirmedAt,
          onRouteConfirmedByCrewMemberId: booking.onRouteConfirmedByCrewMemberId,
          lateNoticeSentAt: booking.lateNoticeSentAt,
          lateEtaIso: booking.lateEtaIso,
          lateReason: booking.lateReason,
          activeExceptionType: booking.activeExceptionType,
          activeExceptionReportedAt: booking.activeExceptionReportedAt,
          activeExceptionNotes: booking.activeExceptionNotes,
          disputedAt: booking.disputedAt,
          disputeReason: booking.disputeReason,
          disputedByRole: booking.disputedByRole,
          beforeEvidenceCount: this.countBookingEvidence(booking, "before"),
          afterEvidenceCount: this.countBookingEvidence(booking, "after"),
          evidencePhotos: booking.serviceEvidence.filter(
            (evidence) => evidence.evidenceType === "photo" && Boolean(evidence.imageDataUrl)
          ),
          totalCents: booking.totalCents,
          requiredCrewMembers,
          assignedCrewMembers,
          crewGap: Math.max(requiredCrewMembers - assignedCrewMembers, 0),
          matches: matchesWithRecommendations
        };
      })
      .sort((left, right) => left.scheduledStartIso.localeCompare(right.scheduledStartIso));
  }

  private async reconcileCrewMatches(providerId?: string): Promise<void> {
    const [providers, crewMembers, bookings, matches, customers] = await Promise.all([
      this.repository.listProviders(),
      this.repository.listCrewMembers(),
      this.repository.listBookings(),
      this.repository.listCrewMatches(),
      this.repository.listCustomers()
    ]);

    const targetProviders = providerId
      ? providers.filter((provider) => provider.id === providerId)
      : providers;
    const crewDayLoadMap = this.buildCrewDayLoadMap(matches, bookings);

    for (const provider of targetProviders) {
      const providerBookings = bookings.filter(
        (booking) =>
          booking.providerId === provider.id &&
          (booking.status === "requested" || booking.status === "confirmed" || booking.status === "in-progress") &&
          new Date(booking.scheduledStartIso).getTime() > Date.now()
      );

      for (const booking of providerBookings) {
        const property = customers
          .find((customer) => customer.id === booking.customerId)
          ?.properties.find((item) => item.id === booking.servicePropertyId);
        const requiredCrewMembers = this.estimateRequiredCrewMembers(booking, property);
        const bookingMatches = matches.filter((match) => match.bookingId === booking.id);
        const acceptedMatches = bookingMatches.filter((match) => match.status === "accepted");

        if (acceptedMatches.length >= requiredCrewMembers) {
          continue;
        }

        const candidatePool = crewMembers
          .filter((crewMember) =>
            this.isCrewMemberEligibleForBooking(crewMember, booking, matches, bookings, crewDayLoadMap)
          )
          .map((crewMember) => ({
            crewMember,
            recommendation: this.buildCrewMatchRecommendation({
              crewMember,
              booking,
              provider,
              allBookings: bookings,
              allMatches: matches,
              dayLoadCount:
                crewDayLoadMap.get(this.getCrewDayLoadKey(crewMember.id, booking.scheduledStartIso)) ?? 0
            })
          }))
          .sort((left, right) => {
            const scoreDelta = right.recommendation.score - left.recommendation.score;
            if (scoreDelta !== 0) {
              return scoreDelta;
            }

            return (
              this.geoService.distanceMiles(left.crewMember.address, booking.serviceAddress) -
              this.geoService.distanceMiles(right.crewMember.address, booking.serviceAddress)
            );
          });

        const gap = requiredCrewMembers - acceptedMatches.length;
        const existingIds = new Set(bookingMatches.map((match) => match.crewMemberId));
        const nextCandidates = candidatePool
          .filter(({ crewMember }) => !existingIds.has(crewMember.id))
          .slice(0, provider.staffingMode === "auto-accept" ? gap : Math.max(3, gap));

        for (const { crewMember } of nextCandidates) {
          const distanceMiles = Number(
            this.geoService.distanceMiles(crewMember.address, booking.serviceAddress).toFixed(1)
          );
          const status = provider.staffingMode === "auto-accept" ? "accepted" : "pending-provider-review";
          await this.repository.createCrewMatch({
            id: crypto.randomUUID(),
            bookingId: booking.id,
            providerId: provider.id,
            crewMemberId: crewMember.id,
            crewMemberName: crewMember.fullName,
            crewMemberPhone: crewMember.phone,
            categories: crewMember.categories,
            availableWeekdays: crewMember.availableWeekdays ?? ["Mon", "Tue", "Wed", "Thu", "Fri"],
            preferredSchedule: crewMember.preferredSchedule,
            willingToTravelMiles: crewMember.willingToTravelMiles,
            hasOwnEquipment: crewMember.hasOwnEquipment,
            winterWorkEnabled: crewMember.winterWorkEnabled ?? true,
            status,
            autoAccepted: provider.staffingMode === "auto-accept",
            distanceMiles,
            hourlyRateCents: this.estimateCrewHourlyRate(booking.category),
            createdAt: new Date().toISOString(),
            reviewedAt: provider.staffingMode === "auto-accept" ? new Date().toISOString() : undefined
          });
          const crewDayLoadKey = this.getCrewDayLoadKey(crewMember.id, booking.scheduledStartIso);
          crewDayLoadMap.set(crewDayLoadKey, (crewDayLoadMap.get(crewDayLoadKey) ?? 0) + 1);

          await this.createNotification({
            recipientId: crewMember.id,
            recipientRole: "crew-member",
            category: "staffing",
            title:
              provider.staffingMode === "auto-accept"
                ? "You were auto-matched to a job"
                : "You have a new crew match",
            body:
              provider.staffingMode === "auto-accept"
                ? `${provider.companyName} automatically assigned you to an upcoming ${this.titleCaseCategory(booking.category)} job.`
                : `${provider.companyName} is reviewing you for an upcoming ${this.titleCaseCategory(booking.category)} job.`,
            actionHref: "/crew/schedule"
          });

          if (provider.staffingMode === "auto-accept") {
            await this.refreshCrewMemberStatus(crewMember.id);
          }
        }
      }
    }
  }

  private async refreshCrewMemberStatus(crewMemberId: string): Promise<void> {
    const crewMember = await this.repository.findCrewMemberById(crewMemberId);
    if (!crewMember) {
      return;
    }

    const matches = await this.repository.listCrewMatches();
    const hasAcceptedFutureMatch = matches.some(
      (match) =>
        match.crewMemberId === crewMemberId &&
        match.status === "accepted" &&
        new Date(match.createdAt).getTime() > Date.now() - 90 * 24 * 60 * 60 * 1000
    );

    await this.repository.updateCrewMember(crewMemberId, {
      status: hasAcceptedFutureMatch ? "assigned" : "available"
    });
  }

  private isCrewMemberEligibleForBooking(
    crewMember: CrewMemberProfile,
    booking: Booking,
    allMatches: CrewMatchCandidate[],
    allBookings: Booking[],
    crewDayLoadMap?: Map<string, number>
  ): boolean {
    if (!crewMember.categories.includes(booking.category)) {
      return false;
    }

    const distanceMiles = this.geoService.distanceMiles(crewMember.address, booking.serviceAddress);
    if (distanceMiles > crewMember.willingToTravelMiles) {
      return false;
    }

    const day = this.isoToAvailabilityDay(booking.scheduledStartIso);
    if (!(crewMember.availableWeekdays ?? ["Mon", "Tue", "Wed", "Thu", "Fri"]).includes(day)) {
      return false;
    }

    if (
      (booking.category === "snow-shoveling" ||
        booking.category === "snow-blowing" ||
        booking.category === "ice-melt-salting") &&
      !(crewMember.winterWorkEnabled ?? true)
    ) {
      return false;
    }

    const acceptedBookedJobs = this.getAcceptedCrewBookings(crewMember.id, allMatches, allBookings);
    const hasConflictingAcceptedJob = acceptedBookedJobs.some(
      (acceptedBooking) =>
        acceptedBooking.id !== booking.id &&
        this.doIntervalsOverlap(
          acceptedBooking.scheduledStartIso,
          acceptedBooking.scheduledEndIso,
          booking.scheduledStartIso,
          booking.scheduledEndIso
        )
    );

    if (hasConflictingAcceptedJob) {
      return false;
    }

    return crewMember.status !== "off-duty";
  }

  private buildCrewMatchRecommendation(input: {
    crewMember: CrewMemberProfile;
    booking: Booking;
    provider: ProviderProfile;
    allBookings: Booking[];
    allMatches: CrewMatchCandidate[];
    dayLoadCount?: number;
  }): {
    score: number;
    label: "best-fit" | "good-fit" | "backup";
    reasons: string[];
  } {
    const { crewMember, booking, provider, allBookings, allMatches } = input;
    const distanceMiles = this.geoService.distanceMiles(crewMember.address, booking.serviceAddress);
    const acceptedCrewBookings = this.getAcceptedCrewBookings(crewMember.id, allMatches, allBookings);
    const sameDayAcceptedBookings = acceptedCrewBookings.filter(
      (candidate) =>
        this.localDateKey(candidate.scheduledStartIso) === this.localDateKey(booking.scheduledStartIso) &&
        candidate.id !== booking.id
    );
    const sameDayLoadCount =
      input.dayLoadCount ??
      this.getCrewSameDayLoadCount(crewMember.id, booking.scheduledStartIso, allMatches, allBookings);
    const priorProviderAssignments = acceptedCrewBookings.filter(
      (candidate) => candidate.providerId === provider.id && candidate.id !== booking.id
    ).length;
    const reliabilityPenalty = Math.min((crewMember.cancellationCount ?? 0) * 4, 12);
    const scoreParts = {
      distance: Math.round(Math.max(0, 1 - distanceMiles / Math.max(crewMember.willingToTravelMiles, 1)) * 28),
      schedulePreference: this.getSchedulePreferenceScore(crewMember.preferredSchedule),
      reliability: Math.max(
        0,
        Math.round((crewMember.rating / 5) * 12 + (Math.min(crewMember.completedJobs, 150) / 150) * 10) -
          reliabilityPenalty
      ),
      providerFamiliarity:
        crewMember.assignedProviderId === provider.id ? 12 : Math.min(priorProviderAssignments * 4, 10),
      workload:
        sameDayLoadCount === 0 ? 14 : sameDayLoadCount === 1 ? 9 : sameDayLoadCount === 2 ? 3 : -16,
      equipment:
        this.categoryBenefitsFromEquipmentOwnership(booking.category) && crewMember.hasOwnEquipment ? 8 : 0
    };

    const score = Math.max(
      0,
      scoreParts.distance +
        scoreParts.schedulePreference +
        scoreParts.reliability +
        scoreParts.providerFamiliarity +
        scoreParts.workload +
        scoreParts.equipment
    );

    const reasons: string[] = [];
    if ((crewMember.cancellationCount ?? 0) > 0) {
      reasons.push("Recent call-offs lower future match priority");
    }
    if (scoreParts.schedulePreference >= 14) {
      reasons.push("Has strong availability capacity for new jobs");
    }
    if (distanceMiles <= 5) {
      reasons.push("Very close to the property");
    }
    if (scoreParts.providerFamiliarity >= 8) {
      reasons.push("Already familiar with this business");
    }
    if (sameDayLoadCount === 0) {
      reasons.push("Open capacity on this day");
    } else if (sameDayLoadCount === 1) {
      reasons.push("Can still fit this route into the same day");
    } else if (sameDayLoadCount === 2) {
      reasons.push("Already carrying a fuller day than other crew");
    } else if (sameDayLoadCount >= 3) {
      reasons.push("Heavy same-day load, keep as a fallback only");
    }
    if (scoreParts.equipment > 0) {
      reasons.push("Brings equipment that helps on this job");
    }
    if (crewMember.rating >= 4.8 && crewMember.completedJobs >= 25) {
      reasons.push("Strong reliability history");
    }
    if (reasons.length === 0) {
      reasons.push("Matches the service and area");
    }

    return {
      score,
      label: score >= 60 ? "best-fit" : score >= 42 ? "good-fit" : "backup",
      reasons: reasons.slice(0, 3)
    };
  }

  private getAcceptedCrewBookings(
    crewMemberId: string,
    allMatches: CrewMatchCandidate[],
    allBookings: Booking[]
  ): Booking[] {
    const acceptedBookingIds = new Set(
      allMatches
        .filter((match) => match.crewMemberId === crewMemberId && match.status === "accepted")
        .map((match) => match.bookingId)
    );

    return allBookings.filter((booking) => acceptedBookingIds.has(booking.id));
  }

  private getCrewSameDayLoadCount(
    crewMemberId: string,
    scheduledStartIso: string,
    allMatches: CrewMatchCandidate[],
    allBookings: Booking[]
  ): number {
    const dayKey = this.localDateKey(scheduledStartIso);
    const bookingIds = new Set(
      allMatches
        .filter(
          (match) =>
            match.crewMemberId === crewMemberId &&
            (match.status === "accepted" || match.status === "pending-provider-review")
        )
        .map((match) => match.bookingId)
    );

    return allBookings.filter(
      (booking) => bookingIds.has(booking.id) && this.localDateKey(booking.scheduledStartIso) === dayKey
    ).length;
  }

  private buildCrewDayLoadMap(allMatches: CrewMatchCandidate[], allBookings: Booking[]): Map<string, number> {
    const loadMap = new Map<string, number>();
    for (const match of allMatches) {
      if (match.status !== "accepted" && match.status !== "pending-provider-review") {
        continue;
      }

      const booking = allBookings.find((item) => item.id === match.bookingId);
      if (!booking) {
        continue;
      }

      const key = this.getCrewDayLoadKey(match.crewMemberId, booking.scheduledStartIso);
      loadMap.set(key, (loadMap.get(key) ?? 0) + 1);
    }

    return loadMap;
  }

  private getCrewDayLoadKey(crewMemberId: string, scheduledStartIso: string): string {
    return `${crewMemberId}:${this.localDateKey(scheduledStartIso)}`;
  }

  private getSchedulePreferenceScore(preference: CrewMemberSchedulePreference): number {
    switch (preference) {
      case "full-time":
        return 16;
      case "flex":
        return 12;
      case "part-time":
        return 8;
      case "seasonal":
        return 5;
    }
  }

  private categoryBenefitsFromEquipmentOwnership(category: Booking["category"]): boolean {
    return (
      category === "mulch-installation" ||
      category === "gutter-cleaning" ||
      category === "snow-blowing" ||
      category === "leaf-blowing"
    );
  }

  private estimateRequiredCrewMembers(booking: Booking, property?: CustomerProperty): number {
    const baseByCategory: Record<Booking["category"], number> = {
      "lawn-mowing": 1,
      "hedge-trimming": 1,
      "mulch-installation": 2,
      "seasonal-cleanup": 2,
      "weed-control": 1,
      "irrigation-check": 1,
      "leaf-blowing": 1,
      "aeration": 1,
      "fertilization": 1,
      "gutter-cleaning": 2,
      "snow-shoveling": 2,
      "ice-melt-salting": 1,
      "snow-blowing": 2
    };

    let crewSize = baseByCategory[booking.category] ?? 1;
    if (property?.lawnSizeSqFt && property.lawnSizeSqFt > 5000) {
      crewSize += 1;
    }
    if (property?.shrubBedSqFt && property.shrubBedSqFt > 900) {
      crewSize += 1;
    }

    return Math.min(crewSize, 4);
  }

  private isoToAvailabilityDay(iso: string): CrewAvailabilityDay {
    return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
      new Date(iso).getDay()
    ] as CrewAvailabilityDay;
  }

  private assertCanAccessConversation(
    actor: AuthIdentityRecord,
    thread: ProviderCrewConversation
  ): void {
    const canAccess =
      (actor.role === "provider" && actor.userId === thread.providerId) ||
      (actor.role === "crew-member" && actor.userId === thread.crewMemberId);

    if (!canAccess) {
      throw new HttpError(403, "You cannot access this conversation");
    }
  }

  private assertCanAccessCustomerProviderConversation(
    actor: AuthIdentityRecord,
    thread: CustomerProviderConversation
  ): void {
    const canAccess =
      (actor.role === "customer" && actor.userId === thread.customerId) ||
      (actor.role === "provider" && actor.userId === thread.providerId);

    if (!canAccess) {
      throw new HttpError(403, "You cannot access this conversation");
    }
  }

  private assertCustomerCanManageBooking(customerId: string, booking: Booking): void {
    if (booking.customerId !== customerId) {
      throw new Error("Only the booking customer can manage this booking");
    }
  }

  private canCustomerCancelOrReschedule(booking: Booking): boolean {
    if (!(booking.status === "requested" || booking.status === "confirmed")) {
      return false;
    }

    return new Date(booking.scheduledStartIso).getTime() > Date.now();
  }

  // Review validation stays centralized here so web and mobile both inherit the same rule set.
  private assertReviewScore(score: number, fieldName: string): void {
    if (!Number.isInteger(score) || score < 1 || score > 5) {
      throw new Error(`${fieldName} must be an integer from 1 to 5`);
    }
  }

  private calculateAverageRating(
    reviews: ProviderReview[],
    field: "overallRating" | "timelinessRating" | "attentionToDetailRating"
  ): number {
    if (reviews.length === 0) {
      return 0;
    }

    const total = reviews.reduce((sum, review) => sum + review[field], 0);
    return Number((total / reviews.length).toFixed(1));
  }

  private buildReviewInvite(booking: Booking, email: string, completedAt: string): ReviewInvite {
    const scheduledSendIso = this.addHours(completedAt, MarketplacePlatformService.reviewInviteDelayHours);
    const expiresAtIso = this.addDays(scheduledSendIso, MarketplacePlatformService.reviewInviteExpiryDays);

    return {
      id: crypto.randomUUID(),
      bookingId: booking.id,
      customerId: booking.customerId,
      providerId: booking.providerId,
      email,
      status: "scheduled",
      channels: ["email", "in-app"],
      scheduledSendIso,
      expiresAtIso,
      deepLinkPath: `/bookings/${booking.id}/review`
    };
  }

  private async buildReviewOpportunity(
    booking: Booking,
    now: Date
  ): Promise<CustomerReviewOpportunity | undefined> {
    const provider = await this.repository.findProviderById(booking.providerId);
    if (!provider) {
      return undefined;
    }

    const review = await this.repository.findProviderReviewByBookingId(booking.id);
    const invite = await this.getResolvedReviewInvite(booking.id, now);

    if (review) {
      return {
        bookingId: booking.id,
        providerId: booking.providerId,
        providerName: provider.companyName,
        category: booking.category,
        completedAt: booking.completedAt,
        inviteStatus: invite?.status,
        inviteScheduledSendIso: invite?.scheduledSendIso,
        inviteSentAt: invite?.sentAt,
        reviewSubmittedAt: review.createdAt,
        canReviewNow: false,
        reviewAlreadySubmitted: true,
        reason: "Review already submitted for this completed booking."
      };
    }

    if (!invite) {
      return {
        bookingId: booking.id,
        providerId: booking.providerId,
        providerName: provider.companyName,
        category: booking.category,
        completedAt: booking.completedAt,
        canReviewNow: false,
        reviewAlreadySubmitted: false,
        reason: "The review invite has not been scheduled yet."
      };
    }

    if (invite.status === "scheduled") {
      return {
        bookingId: booking.id,
        providerId: booking.providerId,
        providerName: provider.companyName,
        category: booking.category,
        completedAt: booking.completedAt,
        inviteStatus: invite.status,
        inviteScheduledSendIso: invite.scheduledSendIso,
        canReviewNow: false,
        reviewAlreadySubmitted: false,
        reason: "A review email is scheduled for 48 hours after service completion."
      };
    }

    if (invite.status === "expired") {
      return {
        bookingId: booking.id,
        providerId: booking.providerId,
        providerName: provider.companyName,
        category: booking.category,
        completedAt: booking.completedAt,
        inviteStatus: invite.status,
        inviteScheduledSendIso: invite.scheduledSendIso,
        inviteSentAt: invite.sentAt,
        canReviewNow: false,
        reviewAlreadySubmitted: false,
        reason: "The review window has expired for this booking."
      };
    }

    return {
      bookingId: booking.id,
      providerId: booking.providerId,
      providerName: provider.companyName,
      category: booking.category,
      completedAt: booking.completedAt,
      inviteStatus: invite.status,
      inviteScheduledSendIso: invite.scheduledSendIso,
      inviteSentAt: invite.sentAt,
      canReviewNow: invite.status === "sent" || invite.status === "opened",
      reviewAlreadySubmitted: false,
      reason: "Review is unlocked from the booking-specific invite only."
    };
  }

  private async getActiveReviewInviteOrThrow(bookingId: string): Promise<ReviewInvite> {
    const invite = await this.getResolvedReviewInvite(bookingId, new Date());

    if (!invite) {
      throw new Error("No review invite exists for this booking");
    }

    if (invite.status !== "sent" && invite.status !== "opened") {
      throw new Error("The review invite is not active yet");
    }

    return invite;
  }

  private async getResolvedReviewInvite(bookingId: string, now: Date): Promise<ReviewInvite | undefined> {
    const invite = await this.repository.findReviewInviteByBookingId(bookingId);
    if (!invite) {
      return undefined;
    }

    if (
      invite.status !== "completed" &&
      invite.status !== "expired" &&
      new Date(invite.expiresAtIso).getTime() <= now.getTime()
    ) {
      return this.repository.updateReviewInvite(invite.id, {
        status: "expired"
      });
    }

    return invite;
  }

  private addHours(iso: string, hours: number): string {
    return new Date(new Date(iso).getTime() + hours * 60 * 60 * 1000).toISOString();
  }

  private addDays(iso: string, days: number): string {
    return new Date(new Date(iso).getTime() + days * 24 * 60 * 60 * 1000).toISOString();
  }

  private async buildRecurringServicePlanSummary(planId: string): Promise<RecurringServicePlanSummary> {
    const plan = await this.repository.findRecurringServicePlanById(planId);
    if (!plan) {
      throw new HttpError(404, "Recurring plan not found");
    }

    const [provider, allBookings] = await Promise.all([
      this.repository.findProviderById(plan.providerId),
      this.repository.listBookings()
    ]);

    const planBookings = allBookings
      .filter((booking) => booking.recurringPlanId === plan.id)
      .sort((left, right) => left.scheduledStartIso.localeCompare(right.scheduledStartIso));

    const upcomingBooking = planBookings.find(
      (booking) =>
        booking.status !== "cancelled" &&
        booking.status !== "completed" &&
        booking.status !== "refunded"
    );

    return {
      plan,
      providerName: provider?.companyName ?? "Landscaping business",
      upcomingBooking,
      completedOccurrenceCount: planBookings.filter((booking) => booking.status === "completed").length,
      activeOccurrenceCount: planBookings.filter((booking) =>
        booking.status === "requested" ||
        booking.status === "confirmed" ||
        booking.status === "in-progress" ||
        booking.status === "disputed"
      ).length
    };
  }

  private async scheduleNextRecurringBookingIfNeeded(completedBooking: Booking): Promise<void> {
    if (!completedBooking.recurringPlanId) {
      return;
    }

    const plan = await this.repository.findRecurringServicePlanById(completedBooking.recurringPlanId);
    if (!plan || plan.status !== "active") {
      return;
    }

    const allBookings = await this.repository.listBookings();
    const hasUpcomingRecurringBooking = allBookings.some(
      (booking) =>
        booking.recurringPlanId === plan.id &&
        booking.id !== completedBooking.id &&
        booking.status !== "cancelled" &&
        booking.status !== "completed" &&
        booking.status !== "refunded"
    );

    if (hasUpcomingRecurringBooking) {
      return;
    }

    const nextStartIso = this.shiftRecurringIso(completedBooking.scheduledStartIso, plan.frequency);
    const nextEndIso = this.shiftRecurringIso(completedBooking.scheduledEndIso, plan.frequency);
    const attemptAt = new Date().toISOString();

    try {
      const nextBooking = await this.createBookingRecord(
        plan.customerId,
        {
          providerId: plan.providerId,
          launchLeadId: plan.launchLeadId,
          serviceAddress: plan.serviceAddress,
          servicePropertyId: plan.servicePropertyId,
          category: plan.category,
          scheduledStartIso: nextStartIso,
          scheduledEndIso: nextEndIso,
          notes: plan.notes,
          totalCents: plan.totalCents
        },
        {
          recurringPlanId: plan.id,
          recurringOccurrenceIndex: (completedBooking.recurringOccurrenceIndex ?? 1) + 1,
          providerNotificationTitle: "Next recurring visit requested",
          providerNotificationBody: `The next ${this.describeRecurringFrequency(plan.frequency)} ${this.titleCaseCategory(
            plan.category
          ).toLowerCase()} visit was queued for ${this.formatBookingWindowWithDate(nextStartIso)}.`,
          skipProviderAvailabilityCheck: true,
          skipRequestedFunnelEvent: true
        }
      );

      await this.repository.updateRecurringServicePlan(plan.id, {
        lastGeneratedBookingId: nextBooking.id,
        lastGeneratedAt: nextBooking.requestedAt,
        lastSchedulingAttemptAt: attemptAt,
        lastSchedulingError: undefined
      });

      await this.createNotification({
        recipientId: plan.customerId,
        recipientRole: "customer",
        category: "booking",
        title: "Next recurring visit scheduled",
        body: `Your next ${this.describeRecurringFrequency(plan.frequency)} ${this.titleCaseCategory(
          plan.category
        ).toLowerCase()} visit was queued for ${this.formatBookingWindowWithDate(nextStartIso)}.`,
        actionHref: "/customer/dashboard"
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "We could not queue the next recurring visit automatically.";

      await this.repository.updateRecurringServicePlan(plan.id, {
        lastSchedulingAttemptAt: attemptAt,
        lastSchedulingError: message
      });

      await this.createNotification({
        recipientId: plan.customerId,
        recipientRole: "customer",
        category: "booking",
        title: "Recurring plan needs review",
        body: `We could not automatically queue the next ${this.describeRecurringFrequency(
          plan.frequency
        )} visit. ${message}`,
        actionHref: "/customer/dashboard"
      });
    }
  }

  private shiftRecurringIso(iso: string, frequency: RecurringServicePlan["frequency"]): string {
    return this.addDays(iso, frequency === "biweekly" ? 14 : 7);
  }

  private describeRecurringFrequency(frequency: RecurringServicePlan["frequency"]): string {
    return frequency === "biweekly" ? "every 2 weeks" : "every week";
  }

  private titleCaseCategory(category: Booking["category"]): string {
    return category
      .split("-")
      .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
      .join(" ");
  }

  private countBookingEvidence(booking: Booking, phase: BookingEvidenceEntry["phase"]): number {
    return booking.serviceEvidence.filter(
      (evidence) =>
        evidence.phase === phase &&
        evidence.evidenceType === "photo" &&
        evidence.capturedByRole !== "customer"
    ).length;
  }

  private buildSupportEvidenceSummary(booking: Booking) {
    const reviewed = booking.serviceEvidence.filter((evidence) => Boolean(evidence.reviewStatus));
    return {
      photoCount: booking.serviceEvidence.filter((evidence) => evidence.evidenceType === "photo").length,
      noteCount: booking.serviceEvidence.filter((evidence) => evidence.evidenceType === "note").length,
      checklistCount: booking.serviceEvidence.filter((evidence) => evidence.evidenceType === "checklist").length,
      reviewedCount: reviewed.length,
      unreviewedCount: booking.serviceEvidence.length - reviewed.length,
      supportsProviderCount: reviewed.filter((evidence) => evidence.reviewStatus === "supports-provider").length,
      supportsCustomerCount: reviewed.filter((evidence) => evidence.reviewStatus === "supports-customer").length,
      inconclusiveCount: reviewed.filter((evidence) => evidence.reviewStatus === "inconclusive").length
    };
  }

  private buildSupportResolutionGuidance(
    ticket: SupportTicket,
    booking: Booking,
    payment: PaymentRecord | undefined,
    evidenceSummary: SupportOpsTicket["evidenceSummary"],
    customerName?: string,
    providerName?: string
  ) {
    if (!evidenceSummary) {
      return undefined;
    }

    if (evidenceSummary.reviewedCount === 0) {
      const guidance = {
        confidence: "low" as const,
        rationale: "No reviewed evidence yet. Start by annotating the strongest booking evidence before resolving."
      } satisfies Omit<NonNullable<SupportOpsTicket["resolutionGuidance"]>, "templates">;
      return {
        ...guidance,
        templates: this.buildSupportResolutionReplyTemplates(
          ticket,
          booking,
          payment,
          guidance,
          customerName,
          providerName
        )
      } satisfies NonNullable<SupportOpsTicket["resolutionGuidance"]>;
    }

    const providerLead = evidenceSummary.supportsProviderCount - evidenceSummary.supportsCustomerCount;
    const customerLead = evidenceSummary.supportsCustomerCount - evidenceSummary.supportsProviderCount;
    const refundOpen = payment?.refundReviewStatus === "requested";
    const paidCompletedDisputeNeedsRefundReview =
      !refundOpen && this.isPaidCompletedDisputeCancellationBlocked(booking, payment);

    if (customerLead >= 2 || (customerLead >= 1 && ticket.issueType === "billing")) {
      const confidence: "high" | "medium" = customerLead >= 2 ? "high" : "medium";
      const guidance = {
        ...(paidCompletedDisputeNeedsRefundReview
          ? {}
          : {
              recommendedAction: refundOpen ? "approve-refund" : "cancel-booking"
            }),
        confidence,
        rationale:
          paidCompletedDisputeNeedsRefundReview
            ? "Reviewed evidence currently leans toward the customer, but this completed job has captured payment. Open or approve the tied refund review before cancelling the booking so payout release and customer settlement stay reconciled."
            : "Reviewed evidence currently leans toward the customer, so ops should consider a customer-favoring resolution."
      } satisfies Omit<NonNullable<SupportOpsTicket["resolutionGuidance"]>, "templates">;
      return {
        ...guidance,
        templates: this.buildSupportResolutionReplyTemplates(
          ticket,
          booking,
          payment,
          guidance,
          customerName,
          providerName
        )
      } satisfies NonNullable<SupportOpsTicket["resolutionGuidance"]>;
    }

    if (providerLead >= 2 || (providerLead >= 1 && booking.status === "disputed")) {
      const confidence: "high" | "medium" = providerLead >= 2 ? "high" : "medium";
      const guidance = {
        recommendedAction: refundOpen
          ? "deny-refund"
          : this.getResolvedActiveBookingStatus(booking) === "completed"
            ? "complete-booking"
            : "restore-active-booking",
        confidence,
        rationale:
          "Reviewed evidence currently leans toward the provider, so ops should consider restoring the job or keeping payment in place."
      } satisfies Omit<NonNullable<SupportOpsTicket["resolutionGuidance"]>, "templates">;
      return {
        ...guidance,
        templates: this.buildSupportResolutionReplyTemplates(
          ticket,
          booking,
          payment,
          guidance,
          customerName,
          providerName
        )
      } satisfies NonNullable<SupportOpsTicket["resolutionGuidance"]>;
    }

    const guidance = {
      confidence: "low" as const,
      rationale:
        "Reviewed evidence is mixed or inconclusive. Add more evidence review notes or document a specific ops rationale before finalizing the outcome."
    } satisfies Omit<NonNullable<SupportOpsTicket["resolutionGuidance"]>, "templates">;
    return {
      ...guidance,
      templates: this.buildSupportResolutionReplyTemplates(
        ticket,
        booking,
        payment,
        guidance,
        customerName,
        providerName
      )
    } satisfies NonNullable<SupportOpsTicket["resolutionGuidance"]>;
  }

  private buildSupportResolutionReplyTemplates(
    ticket: SupportTicket,
    booking: Booking,
    payment: PaymentRecord | undefined,
    guidance: Omit<NonNullable<SupportOpsTicket["resolutionGuidance"]>, "templates">,
    customerName?: string,
    providerName?: string
  ) {
    const templates: NonNullable<SupportOpsTicket["resolutionGuidance"]>["templates"] = [];
    const firstName = this.getFirstName(customerName);
    const providerLabel = providerName?.trim() || "GreenRain's provider team";
    const serviceLabel = this.titleCaseCategory(booking.category).toLowerCase();
    const visitWindow = this.formatBookingWindowWithDate(booking.scheduledStartIso);
    const exceptionLabel = booking.activeExceptionType
      ? getBookingExceptionLabel(booking.activeExceptionType).toLowerCase()
      : undefined;

    if (booking.lateEtaIso || booking.activeExceptionType) {
      const delayDetail = booking.lateEtaIso
        ? `The team now expects to arrive around ${new Date(booking.lateEtaIso).toLocaleTimeString([], {
            timeStyle: "short"
          })}.`
        : undefined;
      const reasonDetail = booking.lateReason?.trim() || booking.activeExceptionNotes?.trim() || undefined;
      templates.push({
        key: "delay-update",
        title: "Delay or field-issue update",
        channel: "email",
        reason:
          "Use this when the visit is delayed or blocked by an active field issue and the customer needs a clean expectation reset.",
        subject: "GreenRain update on your service",
        body:
          `Hi ${firstName},\n\n` +
          `I am following up on your ${serviceLabel} visit scheduled for ${visitWindow}. ` +
          `${delayDetail ?? "Our team ran into a field issue before the service could continue."}\n\n` +
          `${exceptionLabel ? `The current issue is ${exceptionLabel}. ` : ""}` +
          `${reasonDetail ? `Details: ${reasonDetail}\n\n` : "\n\n"}` +
          `I will keep the next step explicit once support confirms whether we should continue, reschedule, or close this out another way.\n\n` +
          `Thanks,\nGreenRain support`
      });
    }

    if (guidance.recommendedAction === "cancel-booking") {
      templates.push({
        key: "cancellation-update",
        title: "Cancellation follow-up",
        channel: "email",
        reason: "Use this when ops is unwinding the booking after review and needs a direct customer-facing closeout note.",
        subject: "GreenRain service update",
        body:
          `Hi ${firstName},\n\n` +
          `I reviewed the support case on your ${serviceLabel} booking for ${visitWindow}. Based on the service issue we documented, GreenRain is cancelling this visit rather than forcing the wrong outcome through.\n\n` +
          `If there is a payment adjustment tied to this case, I will keep that update explicit too. If you want help rebooking once the issue is cleared up, reply here and support can guide the next step.\n\n` +
          `Thanks,\nGreenRain support`
      });
    }

    if (payment?.refundReviewStatus === "requested" && guidance.recommendedAction === "approve-refund") {
      templates.push({
        key: "refund-approved",
        title: "Refund approved update",
        channel: "email",
        reason: "Use this once ops is approving a refund review so the customer gets a plain-language payment update.",
        subject: "Your GreenRain refund review is approved",
        body:
          `Hi ${firstName},\n\n` +
          `I reviewed the refund request tied to your ${serviceLabel} booking with ${providerLabel}, and GreenRain is approving the refund review.\n\n` +
          `We are reversing the customer payment from our side now. Bank timing can still vary a little after that, but you should not need to reopen this ticket unless the refund does not show up as expected.\n\n` +
          `Thanks,\nGreenRain support`
      });
    }

    if (payment?.refundReviewStatus === "requested" && guidance.recommendedAction === "deny-refund") {
      templates.push({
        key: "refund-denied",
        title: "Refund denied update",
        channel: "email",
        reason: "Use this when ops keeps the payment captured after reviewing the refund request and supporting evidence.",
        subject: "Your GreenRain refund review update",
        body:
          `Hi ${firstName},\n\n` +
          `I reviewed the refund request tied to your ${serviceLabel} booking with ${providerLabel}. Based on the service record and reviewed evidence, GreenRain is closing the refund review and keeping the payment captured.\n\n` +
          `If there is still a detail we missed, reply with that specific point so support can document it clearly instead of reopening the full case without new context.\n\n` +
          `Thanks,\nGreenRain support`
      });
    }

    if (
      ticket.issueType === "service-quality" ||
      booking.status === "disputed" ||
      guidance.recommendedAction === "restore-active-booking" ||
      guidance.recommendedAction === "complete-booking"
    ) {
      const outcomeText =
        guidance.recommendedAction === "complete-booking"
          ? "GreenRain is keeping the visit marked complete after review."
          : guidance.recommendedAction === "restore-active-booking"
            ? "GreenRain is restoring the booking to the active service path after review."
            : "GreenRain support is still working through the service-quality details before finalizing the outcome.";
      templates.push({
        key: "issue-resolution",
        title: "Issue-resolution update",
        channel: "email",
        reason: "Use this for dispute or service-quality follow-up when the customer needs a concise explanation of what support is doing next.",
        subject: "GreenRain support update",
        body:
          `Hi ${firstName},\n\n` +
          `I reviewed the support case tied to your ${serviceLabel} booking for ${visitWindow}. ${outcomeText}\n\n` +
          `If there is one specific detail you still want considered, reply with that detail directly so support can attach it to the case without losing the current review trail.\n\n` +
          `Thanks,\nGreenRain support`
      });
    }

    return templates.slice(0, 3);
  }

  private buildSupportProviderCoordinationTemplates(
    ticket: SupportTicket,
    booking: Booking,
    customerName?: string,
    providerName?: string
  ): SupportOpsTicket["providerCoordinationTemplates"] {
    const templates: SupportOpsTicket["providerCoordinationTemplates"] = [];
    const providerLabel = providerName?.trim() || "Provider team";
    const customerLabel = customerName?.trim() || "the customer";
    const serviceLabel = this.titleCaseCategory(booking.category).toLowerCase();
    const visitWindow = this.formatBookingWindowWithDate(booking.scheduledStartIso);
    const exceptionLabel = booking.activeExceptionType
      ? getBookingExceptionLabel(booking.activeExceptionType).toLowerCase()
      : undefined;

    if (booking.activeExceptionType) {
      const notesText = booking.activeExceptionNotes?.trim()
        ? ` Provider notes so far: ${booking.activeExceptionNotes.trim()}`
        : "";
      templates.push({
        key: "field-exception-provider-update",
        title: "Provider field-exception coordination",
        channel: "email",
        reason:
          "Use this when ops needs the provider to confirm the active field exception, customer-safe next step, and whether the visit should continue, move, or close.",
        subject: `GreenRain support follow-up for ${serviceLabel} field issue`,
        body:
          `Hi ${providerLabel},\n\n` +
          `GreenRain support is reviewing the ${serviceLabel} booking for ${customerLabel} scheduled ${visitWindow}. ` +
          `The active field issue is ${exceptionLabel}.${notesText}\n\n` +
          `Please reply with:\n` +
          `- whether your team can still complete the visit safely\n` +
          `- the earliest realistic continuation or reschedule window\n` +
          `- any customer action needed, such as gate access, pets, parked cars, or site cleanup\n` +
          `- whether photos or notes should be attached before support updates the customer\n\n` +
          `Please keep the reply factual so support can give the customer a clear next step without overpromising.\n\n` +
          `Thanks,\nGreenRain support`
      });
    }

    if (
      (ticket.issueType === "service-quality" || booking.status === "disputed") &&
      booking.serviceEvidence.length === 0
    ) {
      templates.push({
        key: "provider-evidence-request",
        title: "Provider evidence request",
        channel: "email",
        reason:
          "Use this when a service-quality or dispute case needs provider photos, notes, or checklist context before ops resolves it.",
        subject: `GreenRain evidence request for ${serviceLabel} support case`,
        body:
          `Hi ${providerLabel},\n\n` +
          `GreenRain support is reviewing the ${serviceLabel} booking for ${customerLabel} scheduled ${visitWindow}. ` +
          `Before we resolve the customer-facing case, please send any before/after photos, crew notes, access notes, or checklist details that explain what happened.\n\n` +
          `If there is no additional evidence, reply with that directly so support can document the gap before deciding the outcome.\n\n` +
          `Thanks,\nGreenRain support`
      });
    }

    if (ticket.status === "resolved" && (ticket.issueType === "service-quality" || booking.status === "disputed")) {
      templates.push({
        key: "provider-resolution-follow-up",
        title: "Provider resolution follow-up",
        channel: "email",
        reason:
          "Use this after ops closes a service-quality or dispute case so the provider sees the outcome and any launch-quality expectation.",
        subject: `GreenRain support outcome for ${serviceLabel} booking`,
        body:
          `Hi ${providerLabel},\n\n` +
          `GreenRain support closed the ${serviceLabel} case for ${customerLabel} scheduled ${visitWindow}. ` +
          `Please review the outcome notes in your provider dashboard and make sure any crew, timing, or access lesson is reflected before the next launch booking.\n\n` +
          `If you think support missed a material fact, reply with that specific point rather than reopening the whole case without new context.\n\n` +
          `Thanks,\nGreenRain support`
      });
    }

    return templates.slice(0, 3);
  }

  private buildSupportExceptionHandlingScripts(
    ticket: SupportTicket,
    booking: Booking,
    payment: PaymentRecord | undefined,
    customerName?: string,
    providerName?: string
  ): SupportOpsTicket["exceptionScripts"] {
    const scripts: SupportOpsTicket["exceptionScripts"] = [];
    const firstName = this.getFirstName(customerName);
    const providerLabel = providerName?.trim() || "the provider";
    const serviceLabel = this.titleCaseCategory(booking.category).toLowerCase();
    const visitWindow = this.formatBookingWindowWithDate(booking.scheduledStartIso);
    const noteText = booking.activeExceptionNotes?.trim() || booking.lateReason?.trim();
    const detailText = noteText ? ` Current detail: ${noteText}` : "";

    if (booking.lateEtaIso || /weather|rain|storm|wind|freeze|ice|snow|route|traffic/i.test(noteText ?? "")) {
      const etaText = booking.lateEtaIso
        ? new Date(booking.lateEtaIso).toLocaleTimeString([], { timeStyle: "short" })
        : undefined;
      scripts.push({
        key: "weather-or-route-delay",
        scenarioKey: "weather-delay",
        title: "Weather or route delay script",
        priority: "high",
        trigger: "Use when weather, route pressure, traffic, or a late ETA threatens the promised service window.",
        customerUpdate:
          `Hi ${firstName}, GreenRain is watching the ${serviceLabel} visit scheduled for ${visitWindow}. ` +
          `${etaText ? `The latest arrival estimate is around ${etaText}. ` : ""}` +
          "Support is confirming whether the safer path is to continue today or move the visit to a more reliable window.",
        providerInstruction:
          `Confirm whether ${providerLabel} can still complete this visit safely today, the realistic arrival/completion timing, and whether weather or route pressure affects later jobs too.${detailText}`,
        opsChecklist: [
          "Send a customer update before the window feels abandoned.",
          "Confirm provider arrival and completion timing with a specific ETA.",
          "Reschedule only when the replacement window is more reliable than waiting.",
          "Check whether the same delay threatens later launch bookings."
        ],
        escalationTriggers: [
          "The provider cannot give a realistic arrival or completion time.",
          "Weather or route pressure affects more than one customer window.",
          "The customer has already waited through the promised window."
        ],
        recommendedActions: ["send-customer-update", "confirm-provider-plan", "reschedule-booking", "escalate-ops-owner"]
      });
    }

    if (booking.activeExceptionType === "customer-no-show") {
      scripts.push({
        key: "customer-no-show-recovery",
        scenarioKey: "customer-no-show",
        title: "Customer no-show script",
        priority: "high",
        trigger: "Use when the provider is on site or on route but the customer is unavailable for required access or confirmation.",
        customerUpdate:
          `Hi ${firstName}, ${providerLabel} could not complete the ${serviceLabel} visit scheduled for ${visitWindow} because the team could not reach you or confirm access. ` +
          "Reply with the fastest access instructions so support can decide whether the visit can still continue or needs to be rescheduled.",
        providerInstruction:
          `Ask ${providerLabel} to document arrival timing, contact attempts, photos or notes, and the latest point the route can wait without damaging later jobs.${detailText}`,
        opsChecklist: [
          "Confirm provider arrival or contact-attempt evidence.",
          "Ask the customer for immediate access instructions.",
          "Protect later route commitments before asking the provider to wait.",
          "Document whether cancellation, reschedule, or restore-active-booking is the fairest path."
        ],
        escalationTriggers: [
          "The provider asks for a cancellation fee decision.",
          "The customer disputes whether access was requested.",
          "Waiting would damage later route commitments."
        ],
        recommendedActions: ["send-customer-update", "request-evidence", "reschedule-booking", "cancel-booking"]
      });
    }

    if (booking.activeExceptionType === "customer-not-ready") {
      scripts.push({
        key: "customer-not-ready-recovery",
        scenarioKey: "customer-no-show",
        title: "Customer not-ready script",
        priority: "high",
        trigger: "Use when pets, vehicles, locked areas, materials, or other customer-side blockers prevent the visit from starting cleanly.",
        customerUpdate:
          `Hi ${firstName}, ${providerLabel} is blocked from starting the ${serviceLabel} visit scheduled for ${visitWindow} because the property is not ready yet. ` +
          "Reply with what changed and when the team can safely continue.",
        providerInstruction:
          `Confirm the exact blocker, whether the crew can work around it safely, and the latest wait time before the route needs to move on.${detailText}`,
        opsChecklist: [
          "Name the customer-side blocker plainly.",
          "Confirm whether a partial service is acceptable or should be avoided.",
          "Set a concrete response deadline before the route moves on.",
          "Use an audited intervention if the visit must move or close."
        ],
        escalationTriggers: [
          "The blocker creates safety or property-damage risk.",
          "The customer does not respond before the route window collapses.",
          "Provider and customer disagree about readiness."
        ],
        recommendedActions: ["send-customer-update", "confirm-provider-plan", "reschedule-booking", "cancel-booking"]
      });
    }

    if (booking.activeExceptionType === "unable-to-access-property") {
      scripts.push({
        key: "field-access-recovery",
        scenarioKey: "customer-no-show",
        title: "Field access recovery script",
        priority: "urgent",
        trigger: "Use when a locked gate, blocked entry, missing code, pet, vehicle, or site condition prevents access.",
        customerUpdate:
          `Hi ${firstName}, ${providerLabel} cannot access the property for your ${serviceLabel} visit scheduled for ${visitWindow}. ` +
          "Reply with the gate code, entry instructions, or a clear approval to reschedule before the route has to move on.",
        providerInstruction:
          `Confirm the access blocker, attach photos or notes if available, and give support the latest time the route can wait without hurting later customers.${detailText}`,
        opsChecklist: [
          "Ask for specific gate, pet, vehicle, or entry instructions.",
          "Confirm whether provider evidence shows a real access blocker.",
          "Set a short response deadline because the route is actively waiting.",
          "Choose reschedule or cancellation through an audited intervention if access is not resolved."
        ],
        escalationTriggers: [
          "The provider is actively waiting on route.",
          "There is no customer response before the route needs to leave.",
          "The same address has repeated access issues."
        ],
        recommendedActions: ["send-customer-update", "request-evidence", "reschedule-booking", "cancel-booking"]
      });
    }

    if (booking.activeExceptionType === "service-could-not-be-completed") {
      scripts.push({
        key: "service-incomplete-recovery",
        scenarioKey: "service-quality",
        title: "Incomplete service recovery script",
        priority: payment?.status === "captured" ? "urgent" : "high",
        trigger: "Use when the provider reports the job cannot be completed as promised.",
        customerUpdate:
          `Hi ${firstName}, GreenRain is reviewing why the ${serviceLabel} visit scheduled for ${visitWindow} could not be completed as planned. ` +
          "Support is checking provider notes and any evidence before deciding whether to reschedule, close, or open a refund review.",
        providerInstruction:
          `Ask ${providerLabel} for the exact completed scope, unfinished scope, photos, and whether a safe return visit is possible.${detailText}`,
        opsChecklist: [
          "Request evidence before deciding the outcome.",
          "Separate completed scope from unfinished scope.",
          "Open a refund review when captured payment and customer-favoring evidence require settlement.",
          "Use a detailed rationale if evidence is mixed or inconclusive."
        ],
        escalationTriggers: [
          "Payment is already captured and the customer is likely owed a settlement review.",
          "Provider evidence and customer report conflict.",
          "A repeat provider issue could affect launch recommendation visibility."
        ],
        recommendedActions: [
          "send-customer-update",
          "request-evidence",
          "reschedule-booking",
          "open-refund-review",
          "escalate-ops-owner"
        ]
      });
    }

    return scripts;
  }

  private buildSupportResolutionPolicy(
    ticket: SupportTicket,
    booking: Booking,
    payment: PaymentRecord | undefined,
    evidenceSummary: NonNullable<SupportOpsTicket["evidenceSummary"]>,
    guidance: NonNullable<SupportOpsTicket["resolutionGuidance"]>
  ) {
    const requiresEvidenceReview = this.requiresReviewedEvidenceBeforeSensitiveSupportOutcome(ticket, booking);
    const supportsCustomerLead =
      evidenceSummary.supportsCustomerCount > evidenceSummary.supportsProviderCount;
    const supportsProviderLead =
      evidenceSummary.supportsProviderCount > evidenceSummary.supportsCustomerCount;
    const blockedActions: NonNullable<SupportOpsTicket["resolutionPolicy"]>["blockedActions"] =
      supportsProviderLead
        ? ["approve-refund", "cancel-booking"]
        : supportsCustomerLead
          ? ["deny-refund", "restore-active-booking", "complete-booking"]
          : [];
    if (this.isPaidCompletedDisputeCancellationBlocked(booking, payment)) {
      blockedActions.push("cancel-booking");
    }
    const requiresDetailedRationale = this.requiresDetailedRationaleForLowConfidenceSensitiveSupportDecision(
      ticket,
      booking,
      evidenceSummary
    );
    const evidenceSignal: NonNullable<SupportOpsTicket["resolutionPolicy"]>["evidenceSignal"] =
      booking.serviceEvidence.length === 0
        ? "no-evidence"
        : evidenceSummary.reviewedCount === 0
          ? "unreviewed"
          : evidenceSummary.supportsProviderCount > 0 && evidenceSummary.supportsCustomerCount > 0
            ? "mixed"
            : evidenceSummary.supportsProviderCount > 0
              ? "supports-provider"
              : evidenceSummary.supportsCustomerCount > 0
                ? "supports-customer"
                : "inconclusive";
    const warnings: string[] = [];

    if (requiresEvidenceReview && evidenceSummary.reviewedCount === 0) {
      warnings.push("Resolve actions stay locked until ops reviews at least one submitted evidence item.");
    }

    if (supportsProviderLead) {
      warnings.push(
        "Reviewed evidence currently leans toward the provider, so customer-favoring outcomes stay locked unless ops adds stronger review support."
      );
    } else if (supportsCustomerLead) {
      warnings.push(
        "Reviewed evidence currently leans toward the customer, so provider-favoring outcomes stay locked unless ops adds stronger review support."
      );
    }

    if (requiresDetailedRationale) {
      warnings.push(
        "Reviewed evidence is still low-confidence for this case, so ops must document a specific rationale before finalizing the outcome."
      );
    }

    if (this.isPaidCompletedDisputeCancellationBlocked(booking, payment)) {
      warnings.push(
        "This completed disputed booking has captured customer payment, so cancellation stays locked until a refund review is open or approved."
      );
    }

    return {
      evidenceSignal,
      confidence: guidance.confidence,
      requiresEvidenceReview,
      blockedActions: [...new Set(blockedActions)],
      requiresDetailedRationale,
      warnings,
      ...(requiresDetailedRationale
        ? {
            rationalePrompt:
              "Explain why this final outcome is still the safest supported choice based on the reviewed evidence and any follow-up context.",
            minimumDetailedRationaleLength: MIN_DETAILED_SUPPORT_RATIONALE_LENGTH,
            disallowedDetailedRationaleNotes: [...GENERIC_SUPPORT_RESOLUTION_NOTES]
          }
        : {})
    } satisfies NonNullable<SupportOpsTicket["resolutionPolicy"]>;
  }

  private async findLatestPaymentForBooking(bookingId: string): Promise<PaymentRecord | undefined> {
    return (await this.repository.listPayments())
      .filter((candidate) => candidate.bookingId === bookingId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
  }

  private assertRefundReviewBeforePaidCompletedDisputeCancellation(
    booking: Booking,
    payment: PaymentRecord | undefined,
    resolutionAction: UpdateSupportTicketRequest["resolutionAction"]
  ): void {
    if (resolutionAction !== "cancel-booking" || !this.isPaidCompletedDisputeCancellationBlocked(booking, payment)) {
      return;
    }

    throw new HttpError(
      409,
      "Open or approve the refund review before cancelling a completed disputed booking with captured customer payment."
    );
  }

  private isPaidCompletedDisputeCancellationBlocked(
    booking: Booking,
    payment: PaymentRecord | undefined
  ): boolean {
    return (
      booking.status === "disputed" &&
      Boolean(booking.completedAt) &&
      payment?.status === "captured" &&
      payment.refundReviewStatus !== "requested"
    );
  }

  private assertEvidenceReviewedBeforeSensitiveSupportResolution(
    ticket: SupportTicket,
    booking: Booking,
    resolutionAction: UpdateSupportTicketRequest["resolutionAction"]
  ) {
    if (!this.requiresReviewedEvidenceBeforeSensitiveSupportResolution(ticket, booking, resolutionAction)) {
      return;
    }

    const evidenceSummary = this.buildSupportEvidenceSummary(booking);
    if (evidenceSummary.reviewedCount > 0) {
      this.assertEvidenceDirectionSupportsResolution(evidenceSummary, resolutionAction);
      return;
    }

    throw new HttpError(
      409,
      "Review at least one submitted evidence item before resolving this refund or dispute"
    );
  }

  private assertEvidenceDirectionSupportsResolution(
    evidenceSummary: ReturnType<MarketplacePlatformService["buildSupportEvidenceSummary"]>,
    resolutionAction: UpdateSupportTicketRequest["resolutionAction"]
  ) {
    if (!resolutionAction) {
      return;
    }

    const supportsCustomerLead =
      evidenceSummary.supportsCustomerCount > evidenceSummary.supportsProviderCount;
    const supportsProviderLead =
      evidenceSummary.supportsProviderCount > evidenceSummary.supportsCustomerCount;

    if (
      this.isCustomerFavoringSupportResolution(resolutionAction) &&
      supportsProviderLead
    ) {
      throw new HttpError(
        409,
        "Reviewed evidence does not currently support a customer-favoring resolution. Add stronger evidence review first."
      );
    }

    if (
      this.isProviderFavoringSupportResolution(resolutionAction) &&
      supportsCustomerLead
    ) {
      throw new HttpError(
        409,
        "Reviewed evidence does not currently support a provider-favoring resolution. Add stronger evidence review first."
      );
    }
  }

  private assertDetailedRationaleForLowConfidenceSensitiveSupportResolution(
    ticket: SupportTicket,
    booking: Booking,
    resolutionAction: UpdateSupportTicketRequest["resolutionAction"],
    rationale: string | undefined
  ) {
    if (!resolutionAction) {
      return;
    }

    const evidenceSummary = this.buildSupportEvidenceSummary(booking);
    if (!this.requiresDetailedRationaleForLowConfidenceSensitiveSupportDecision(ticket, booking, evidenceSummary)) {
      return;
    }

    if (this.isDetailedManualSupportRationale(rationale)) {
      return;
    }

    throw new HttpError(
      409,
      "Reviewed evidence is mixed or inconclusive. Add a specific manual rationale before finalizing this refund or dispute outcome."
    );
  }

  private isCustomerFavoringSupportResolution(
    resolutionAction: UpdateSupportTicketRequest["resolutionAction"]
  ) {
    return resolutionAction === "approve-refund" || resolutionAction === "cancel-booking";
  }

  private isProviderFavoringSupportResolution(
    resolutionAction: UpdateSupportTicketRequest["resolutionAction"]
  ) {
    return (
      resolutionAction === "deny-refund" ||
      resolutionAction === "restore-active-booking" ||
      resolutionAction === "complete-booking"
    );
  }

  private requiresDetailedRationaleForLowConfidenceSensitiveSupportDecision(
    ticket: SupportTicket,
    booking: Booking,
    evidenceSummary: ReturnType<MarketplacePlatformService["buildSupportEvidenceSummary"]>
  ) {
    if (evidenceSummary.reviewedCount === 0) {
      return false;
    }

    const providerLead = evidenceSummary.supportsProviderCount - evidenceSummary.supportsCustomerCount;
    const customerLead = evidenceSummary.supportsCustomerCount - evidenceSummary.supportsProviderCount;
    const hasCustomerConfidence = customerLead >= 2 || (customerLead >= 1 && ticket.issueType === "billing");
    const hasProviderConfidence = providerLead >= 2 || (providerLead >= 1 && booking.status === "disputed");

    return !hasCustomerConfidence && !hasProviderConfidence;
  }

  private isDetailedManualSupportRationale(rationale: string | undefined) {
    const normalized = rationale?.trim().replace(/\s+/g, " ").toLowerCase();
    if (!normalized || normalized.length < MIN_DETAILED_SUPPORT_RATIONALE_LENGTH) {
      return false;
    }

    return !this.isGenericSupportResolutionRationale(normalized);
  }

  private isGenericSupportResolutionRationale(normalized: string) {
    return GENERIC_SUPPORT_RESOLUTION_NOTES.includes(
      normalized as (typeof GENERIC_SUPPORT_RESOLUTION_NOTES)[number]
    );
  }

  private requiresReviewedEvidenceBeforeSensitiveSupportResolution(
    ticket: SupportTicket,
    booking: Booking,
    resolutionAction: UpdateSupportTicketRequest["resolutionAction"]
  ) {
    if (booking.serviceEvidence.length === 0) {
      return false;
    }

    const isRefundResolution =
      resolutionAction === "approve-refund" || resolutionAction === "deny-refund";
    const isDisputeResolution = booking.status === "disputed" || ticket.issueType === "service-quality";

    return isRefundResolution || isDisputeResolution;
  }

  private requiresReviewedEvidenceBeforeSensitiveSupportOutcome(
    ticket: SupportTicket,
    booking: Booking
  ) {
    if (booking.serviceEvidence.length === 0) {
      return false;
    }

    return (
      ticket.issueType === "billing" ||
      ticket.issueType === "service-quality" ||
      booking.status === "disputed"
    );
  }

  private getResolvedActiveBookingStatus(booking: Booking): Booking["status"] {
    if (booking.completedAt) {
      return "completed";
    }

    if (booking.onRouteConfirmedAt) {
      return "in-progress";
    }

    return "confirmed";
  }

  private resolveSupportTimelineActorRole(
    requesterId: string,
    customers: Map<string, CustomerProfile>,
    providers: Map<string, ProviderProfile>,
    crewMembers: Map<string, CrewMemberProfile>
  ): SupportTimelineActorRole {
    if (customers.has(requesterId)) {
      return "customer";
    }

    if (providers.has(requesterId)) {
      return "provider";
    }

    if (crewMembers.has(requesterId)) {
      return "crew-member";
    }

    return "system";
  }

  private buildSupportTimeline(
    ticket: SupportTicket,
    booking: Booking | undefined,
    payment: PaymentRecord | undefined,
    requesterRole: SupportTimelineActorRole
  ): SupportTimelineEntry[] {
    const timeline: SupportTimelineEntry[] = [
      {
        id: `${ticket.id}-opened`,
        occurredAt: ticket.createdAt,
        actorRole: requesterRole,
        kind: "ticket-opened",
        title: "Support ticket opened",
        detail: `${ticket.issueType.replaceAll("-", " ")} issue opened: ${ticket.subject}`
      }
    ];

    if (payment?.refundRequestedAt) {
      timeline.push({
        id: `${ticket.id}-refund-requested`,
        occurredAt: payment.refundRequestedAt,
        actorRole: payment.refundRequestedByRole ?? "system",
        kind: "refund-review-opened",
        title: "Refund review opened",
        detail: payment.refundReason ?? "A refund review was opened for the captured payment."
      });
    }

    if (ticket.triagedAt) {
      timeline.push({
        id: `${ticket.id}-triaged`,
        occurredAt: ticket.triagedAt,
        actorRole: "ops",
        kind: "ticket-triaged",
        title: "Support ticket triaged",
        detail:
          ticket.issueType === "billing"
            ? "Ops triaged the billing issue and moved it into active review."
            : "Ops triaged the ticket and moved it into active review."
      });
    }

    if (booking) {
      for (const intervention of booking.interventions.filter(
        (candidate) => candidate.ticketId === ticket.id
      )) {
        timeline.push({
          id: intervention.id,
          occurredAt: intervention.createdAt,
          actorRole: intervention.actorRole,
          kind: "booking-intervention",
          title: `Booking intervention: ${intervention.action.replaceAll("-", " ")}`,
          detail: intervention.note
        });
      }

      for (const evidence of booking.serviceEvidence.filter(
        (candidate) => Boolean(candidate.reviewStatus) && Boolean(candidate.reviewedAt)
      )) {
        timeline.push({
          id: `${ticket.id}-evidence-${evidence.id}`,
          occurredAt: evidence.reviewedAt as string,
          actorRole: evidence.reviewedByRole ?? "ops",
          kind: "evidence-reviewed",
          title: `${evidence.phase === "before" ? "Before" : "After"} evidence reviewed`,
          detail: `${(evidence.reviewStatus ?? "inconclusive").replaceAll("-", " ")}${
            evidence.reviewNotes ? ` • ${evidence.reviewNotes}` : ""
          }`
        });
      }
    }

    if (payment?.refundReviewedAt && payment.refundReviewStatus) {
      timeline.push({
        id: `${ticket.id}-refund-reviewed`,
        occurredAt: payment.refundReviewedAt,
        actorRole: payment.refundReviewedByRole ?? "ops",
        kind: "refund-review-resolved",
        title:
          payment.refundReviewStatus === "approved"
            ? "Refund approved"
            : "Refund review denied",
        detail:
          payment.refundDecisionNotes ??
          (payment.refundReviewStatus === "approved"
            ? "Ops approved the refund review."
            : "Ops denied the refund review.")
      });
    }

    if (ticket.resolvedAt) {
      timeline.push({
        id: `${ticket.id}-resolved`,
        occurredAt: ticket.resolvedAt,
        actorRole: "ops",
        kind: "ticket-resolved",
        title: "Support ticket resolved",
        detail:
          ticket.resolutionNotes ??
          (ticket.resolutionAction
            ? `Resolved with ${ticket.resolutionAction.replaceAll("-", " ")}.`
            : "Ops resolved the support ticket.")
      });
    }

    return timeline.sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
  }

  private localDateKey(iso: string): string {
    const date = new Date(iso);
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  private buildLaunchLeadResponseGuidance(
    lead: LaunchLead,
    suggestedBookingMatches: LaunchLeadBookingMatch[],
    bookings: Booking[],
    providers: ProviderProfile[]
  ): LaunchLeadResponseGuidance {
    const warnings: string[] = [];
    if (!lead.assignedOwner) {
      warnings.push("Assign an owner before moving this inquiry beyond new.");
    }
    if (lead.areaLabel === "Needs area confirmation") {
      warnings.push("Confirm the service area before promising timing or pricing.");
    }
    if (!lead.serviceCategory) {
      warnings.push("Confirm the exact service before quoting scope or availability.");
    }
    if (suggestedBookingMatches.length > 0) {
      warnings.push("A possible booking match already exists, so attach it before starting duplicate follow-up.");
    }
    if (
      lead.requestSource === "customer-service-help-request" ||
      lead.requestSource === "customer-support-no-booking-ticket"
    ) {
      warnings.push("If this turns out to be an existing booking or billing issue, keep the final resolution in support as well.");
    }
    if (lead.sourceChannel === "referral") {
      warnings.push(
        "Confirm whether follow-up should go straight to the customer or back through the referrer before promising next steps."
      );
    }
    for (const note of lead.channelMetadata?.intakeNotes ?? []) {
      warnings.push(note);
    }

    const linkedBookings = bookings
      .filter((booking) => booking.launchLeadId === lead.id)
      .sort((left, right) => left.scheduledStartIso.localeCompare(right.scheduledStartIso));
    const templates = this.buildLaunchLeadReplyTemplates(lead, linkedBookings, providers);

    if (lead.status === "converted") {
      return {
        recommendedAction:
          linkedBookings.length > 0
            ? "The booking is already linked. Use this card for confirmation, repeat-service, or post-job follow-up instead of re-qualifying the lead."
            : "The lead is marked converted. Confirm the linked booking path is accurate, then shift future communication to booking follow-up.",
        warnings,
        templates
      };
    }

    if (lead.status === "closed-lost") {
      return {
        recommendedAction:
          "This lead is closed-lost. Keep the outcome summary clear enough that the next operator knows whether to reopen, reassign, or leave it closed.",
        warnings,
        templates
      };
    }

    if (lead.status === "qualified") {
      return {
        recommendedAction:
          "Push this inquiry toward a concrete next step now: confirm scope, lock timing, and either link a booking or close the loop with a specific follow-up date.",
        warnings,
        templates
      };
    }

    if (lead.status === "contacted") {
      return {
        recommendedAction:
          "Keep momentum after the first touch. Follow up on missing address, timing, or scope details and make the next action explicit before this goes stale.",
        warnings,
        templates
      };
    }

    return {
      recommendedAction:
        lead.preferredContactMethod === "platform-message"
          ? "Reply in the source thread today, confirm coverage and service details there, and document the next follow-up before this request goes stale."
          : lead.preferredContactMethod === "email"
          ? "Send the first email response today, confirm coverage and service details, and set the next follow-up before this request ages out."
          : "Make the first callback or text touch today, confirm coverage and service details, and set the next follow-up before this request ages out.",
      warnings,
      templates
    };
  }

  private buildLaunchLeadReplyTemplates(
    lead: LaunchLead,
    linkedBookings: Booking[],
    providers: ProviderProfile[]
  ): LaunchLeadReplyTemplate[] {
    const templates: LaunchLeadReplyTemplate[] = [];
    const firstName = this.getLeadFirstName(lead.contactName);
    const serviceLabel = lead.serviceCategory ? this.titleCaseCategory(lead.serviceCategory) : "yard care";
    const serviceLabelLower = serviceLabel.toLowerCase();
    const areaLabel = lead.areaLabel === "Needs area confirmation" ? "your area" : lead.areaLabel;
    const signoff = lead.assignedOwner?.trim() || "GreenRain team";
    const supportLike =
      lead.requestSource === "customer-service-help-request" ||
      lead.requestSource === "customer-support-no-booking-ticket";
    const primaryLinkedBooking = linkedBookings[0];
    const latestCompletedBooking = [...linkedBookings]
      .filter((booking) => booking.status === "completed")
      .sort((left, right) => right.scheduledStartIso.localeCompare(left.scheduledStartIso))[0];
    const suggestedProviderCompanies = providers
      .filter(
        (provider) =>
          provider.verificationStatus === "verified" &&
          (!lead.serviceCategory || provider.categories.includes(lead.serviceCategory))
      )
      .sort((left, right) => {
        if (left.reviewCount !== right.reviewCount) {
          return right.reviewCount - left.reviewCount;
        }
        if (left.rating !== right.rating) {
          return right.rating - left.rating;
        }
        return left.companyName.localeCompare(right.companyName);
      })
      .slice(0, 3)
      .map((provider) => provider.companyName);
    const providerTargetSummary =
      suggestedProviderCompanies.length > 0
        ? suggestedProviderCompanies.length === 1
          ? suggestedProviderCompanies[0]
          : `${suggestedProviderCompanies.slice(0, -1).join(", ")}, and ${suggestedProviderCompanies.at(-1)}`
        : "verified local providers";
    const firstResponseChannel = lead.preferredContactMethod === "platform-message"
      ? "platform-message"
      : lead.preferredContactMethod === "text"
      ? "text"
      : lead.preferredContactMethod === "phone" && lead.sourceChannel === "phone"
        ? "phone"
        : lead.preferredContactMethod;

    if (lead.status === "closed-lost") {
      const followUpChannel =
        lead.preferredContactMethod === "platform-message"
          ? "platform-message"
          : lead.preferredContactMethod === "phone"
            ? "email"
            : lead.preferredContactMethod;
      const subject =
        followUpChannel === "email"
          ? lead.lossReason === "out-of-area"
            ? "GreenRain service area update"
            : "GreenRain follow-up on your request"
          : undefined;
      const body =
        lead.lossReason === "out-of-area"
          ? `Hi ${firstName},\n\n` +
            `Thanks again for reaching out to GreenRain. We are not reliably covering ${areaLabel} yet, so I do not want to over-promise timing or service quality.\n\n` +
            `If our coverage expands there, I am happy to reconnect. If you want, reply with the neighborhood and service type and I can keep that on file for a future check-in.\n\n` +
            `Thanks,\n${signoff}`
          : lead.lossReason === "timeline-mismatch"
            ? `Hi ${firstName},\n\n` +
              `Thanks for the follow-up. We could not support the timing you needed for ${serviceLabelLower} in ${areaLabel} without setting the wrong expectation.\n\n` +
              `If your window changes, reply with the new timing and I can check again before you start from scratch.\n\n` +
              `Thanks,\n${signoff}`
            : lead.lossReason === "price-mismatch"
              ? `Hi ${firstName},\n\n` +
                `Thanks again for considering GreenRain. We were not able to line up the right fit on pricing for this ${serviceLabelLower} request in ${areaLabel}.\n\n` +
                `If the scope changes or you want us to re-check a simpler version of the job later, reply here and I can take another look.\n\n` +
                `Thanks,\n${signoff}`
              : `Hi ${firstName},\n\n` +
                `Closing the loop on your GreenRain request for ${serviceLabelLower} in ${areaLabel}. We are marking it closed for now so the queue stays accurate.\n\n` +
                `If you want to reopen it later, reply here with the latest timing and service details and we can pick it back up.\n\n` +
                `Thanks,\n${signoff}`;
      templates.push({
        key: "closed-lost-follow-up",
        audience: "customer",
        title: "Closed-lost closeout",
        channel: followUpChannel,
        reason: "Use this to close the loop clearly without leaving the customer wondering whether someone will still follow up.",
        subject,
        body
      });
      return templates;
    }

    if (lead.status === "converted") {
      if (primaryLinkedBooking) {
        templates.push({
          key: "booking-confirmation",
          audience: "customer",
          title: "Booking confirmation follow-up",
          channel: lead.preferredContactMethod === "phone" ? "email" : lead.preferredContactMethod,
          reason: "Use this once the lead is already converted and you need a clean confirmation or reassurance note.",
          subject: "Your GreenRain request is in motion",
          body:
            `Hi ${firstName},\n\n` +
            `Your ${serviceLabelLower} request is now in motion for ${this.formatBookingWindowWithDate(primaryLinkedBooking.scheduledStartIso)}. ` +
            `If anything changes with access, gates, pets, weather concerns, or timing, reply here and we will update it quickly.\n\n` +
            `Thanks,\n${signoff}`
        });
      }

      if (latestCompletedBooking && lead.reviewIds.length === 0) {
        templates.push({
          key: "review-request",
          audience: "customer",
          title: "Review request",
          channel: lead.preferredContactMethod === "phone" ? "email" : lead.preferredContactMethod,
          reason: "Use this after a completed booking when the lead has converted but has not left a review yet.",
          subject: "Quick GreenRain favor",
          body:
            `Hi ${firstName},\n\n` +
            `Thanks again for trusting GreenRain for your ${serviceLabelLower}. If the visit on ${this.formatBookingWindowWithDate(latestCompletedBooking.scheduledStartIso)} went the way it should have, a short reply or review would help a lot while we keep building in ${areaLabel}.\n\n` +
            `Even one or two sentences about how the job went is useful.\n\n` +
            `Thanks,\n${signoff}`
        });
      }

      if (lead.reviewIds.length > 0 || linkedBookings.length > 1) {
        templates.push({
          key: "referral-request",
          audience: "customer",
          title: "Referral ask",
          channel: lead.preferredContactMethod === "phone" ? "email" : lead.preferredContactMethod,
          reason: "Use this when the customer has already converted and shown repeat or review behavior.",
          subject: "Quick favor from GreenRain",
          body:
            `Hi ${firstName},\n\n` +
            `Thanks again for working with GreenRain. If you know a neighbor or friend in ${areaLabel} who wants the same low-friction experience, feel free to send them our way and mention your name when they reach out.\n\n` +
            `We appreciate it,\n${signoff}`
        });
      }

      return templates.slice(0, 3);
    }

    if (firstResponseChannel === "email") {
      templates.push({
        key: "first-response-email",
        audience: "customer",
        title: "First-response email",
        channel: "email",
        reason: "Use this for email-first contact-us requests and inbox-forwarded inquiries.",
        subject: `GreenRain follow-up for your ${serviceLabelLower} request`,
        body:
          `Hi ${firstName},\n\n` +
          `Thanks for reaching out to GreenRain about ${serviceLabelLower} in ${areaLabel}. I can help from here.\n\n` +
          `Before I line up the best next step, please reply with:\n` +
          `- the service address\n` +
          `- your ideal timing\n` +
          `- anything we should know about access, gates, pets, or property conditions\n\n` +
          `If you'd rather switch to text or a quick call, send the best number and I will use that instead.\n\n` +
          `Thanks,\n${signoff}`
      });
    } else if (firstResponseChannel === "platform-message") {
      templates.push({
        key: "first-response-platform-message",
        audience: "customer",
        title: "Platform message reply",
        channel: "platform-message",
        reason: "Use this when the inquiry arrived through Google Business Profile or another channel-managed thread.",
        body:
          `Hi ${firstName}, thanks for reaching out to GreenRain. I can help from here. ` +
          `Please send the service address, the timing you want, and anything we should know about access or property conditions so I can line up the best next step.`
      });
    } else if (firstResponseChannel === "text") {
      templates.push({
        key: "first-response-text",
        audience: "customer",
        title: "First-response text",
        channel: "text",
        reason: "Use this when the customer prefers text or came through a text-style support path.",
        body:
          `Hi ${firstName}, this is ${signoff} with GreenRain. Thanks for reaching out about ${serviceLabelLower} in ${areaLabel}. ` +
          `I can help. What is the service address, your ideal timing, and anything we should know before we line up the next step?`
      });
    } else {
      templates.push({
        key: "missed-call-callback",
        audience: "customer",
        title: "Missed-call callback",
        channel: "phone",
        reason: "Use this when the lead came in by phone and needs a same-day callback script.",
        body:
          `Hi ${firstName}, this is ${signoff} with GreenRain returning your call about ${serviceLabelLower} in ${areaLabel}. ` +
          `I can help. The quickest next step is confirming the service address, timing, and any access notes. ` +
          `Call or text me back at this number and I'll keep it moving.`
      });
    }

    if (supportLike) {
      templates.push({
        key: "issue-help-follow-up",
        audience: "customer",
        title: "Customer-service follow-up",
        channel: lead.preferredContactMethod === "phone" ? "phone" : lead.preferredContactMethod,
        reason: "Use this when a no-booking help request needs a clear split between pre-booking follow-up and true support.",
        subject:
          lead.preferredContactMethod === "email" ? "GreenRain follow-up on your help request" : undefined,
        body:
          `Hi ${firstName},\n\n` +
          `Thanks for reaching out. I am treating this as a pre-booking help request so it stays in our follow-up queue and does not get lost.\n\n` +
          `If this is tied to an existing booking, payment, or account issue, reply with the booking email or service address and I will route it through support too. ` +
          `If not, send the service address plus the timing you want and I will help line up the next step.\n\n` +
          `Thanks,\n${signoff}`
      });
    } else {
      templates.push({
        key: "quote-follow-up",
        audience: "customer",
        title: "Quote and timing follow-up",
        channel: lead.preferredContactMethod === "phone" ? "email" : lead.preferredContactMethod,
        reason: "Use this after the first touch when you still need scope, timing, or address details before booking.",
        subject: "Checking back on your GreenRain request",
        body:
          `Hi ${firstName},\n\n` +
          `Checking back on your ${serviceLabelLower} request for ${areaLabel}. If you still want to move forward, reply with the service address, the timing you want, and any property notes that might affect the visit.\n\n` +
          `Once I have that, I can recommend the best next step instead of sending you in circles.\n\n` +
          `Thanks,\n${signoff}`
      });
    }

    if (lead.serviceCategory) {
      templates.push({
        key: "provider-outreach",
        audience: "provider",
        title: "Provider availability outreach",
        channel: "email",
        reason: `Use this when you need live capacity confirmation before promising timing. Start with ${providerTargetSummary}.`,
        subject: `GreenRain availability check for ${serviceLabelLower} in ${areaLabel}`,
        body:
          `Hi [Provider name],\n\n` +
          `GreenRain has a ${serviceLabelLower} request in ${areaLabel} that still needs live availability confirmation before we lock customer expectations.\n\n` +
          `Can you reply with:\n` +
          `- whether you can take similar work in that area soon\n` +
          `- your realistic timing window\n` +
          `- any scope constraints or payout guardrails we should respect before we promise anything\n\n` +
          `A quick yes or no is useful. I would rather set the right expectation now than force a scramble later.\n\n` +
          `Thanks,\n${signoff}`
      });
    }

    if (lead.sourceChannel === "referral" && lead.channelMetadata?.referrerName) {
      templates.push({
        key: "partner-follow-up",
        audience: "partner",
        title: "Referral-source follow-up",
        channel: lead.channelMetadata.referrerEmail ? "email" : "phone",
        reason: "Use this to close the loop with the referrer while you confirm whether follow-up should stay with them or go directly to the customer.",
        subject: lead.channelMetadata.referrerEmail ? "GreenRain received your referral" : undefined,
        body:
          `Hi ${lead.channelMetadata.referrerName},\n\n` +
          `Thanks for sending ${firstName}'s ${serviceLabelLower} request to GreenRain. I have it in our follow-up queue now.\n\n` +
          `${lead.channelMetadata.referralFollowUpTarget === "referrer"
            ? `I am treating you as the active contact until we have the customer's direct details, so send over anything else we should know before I reply.`
            : `I plan to follow up with the customer directly, but I wanted you to know the handoff is moving.`}\n\n` +
          `If timing, access, or scope details would change the fit, send those over now so I can keep expectations accurate.\n\n` +
          `Thanks,\n${signoff}`
      });
    }

    if (lead.serviceCategory) {
      templates.push({
        key: "provider-backup-outreach",
        audience: "provider",
        title: "Curated backup coverage check",
        channel: "email",
        reason:
          "Use this when the primary recommendation is not locked yet and ops needs one or two reliable backup providers while keeping the customer flow recommendation-first instead of turning it into a directory.",
        subject: `GreenRain backup capacity check for ${serviceLabelLower} in ${areaLabel}`,
        body:
          `Hi [Provider name],\n\n` +
          `GreenRain is checking backup coverage for a ${serviceLabelLower} request in ${areaLabel}. We are still keeping the customer experience recommendation-first, so I am only confirming a small fallback set.\n\n` +
          `Can you reply with:\n` +
          `- whether you could take this as backup coverage if the primary route falls through\n` +
          `- your earliest reliable service window\n` +
          `- any scope, travel, or payout constraint that would make this a bad fit\n\n` +
          `A quick no is fine. I only want to hold backup options that would actually be reliable.\n\n` +
          `Thanks,\n${signoff}`
      });
      templates.push({
        key: "provider-pilot-readiness",
        audience: "provider",
        title: "First-booking pilot readiness",
        channel: "email",
        reason:
          "Use this when ops is considering a newer or narrow-launch provider and needs readiness confirmation before putting the first customer promise on that route.",
        subject: `GreenRain first-booking readiness check for ${serviceLabelLower}`,
        body:
          `Hi [Provider name],\n\n` +
          `Before GreenRain sends a first or early ${serviceLabelLower} booking your way in ${areaLabel}, I want to confirm the route will be reliable.\n\n` +
          `Please reply with:\n` +
          `- who owns the job day-of\n` +
          `- whether equipment, crew, and travel timing are already covered\n` +
          `- any service-quality risk we should address before the customer gets a promise\n` +
          `- whether you can send before/after proof without support chasing it\n\n` +
          `This keeps the first customer experience calm and keeps your route from getting overloaded.\n\n` +
          `Thanks,\n${signoff}`
      });
    }

    return templates.slice(0, 5);
  }

  private normalizeLaunchLeadPhone(phone?: string): string | undefined {
    if (!phone) {
      return undefined;
    }

    const normalized = phone.replace(/[^\d+]/g, "");
    return normalized.length >= 10 ? normalized.slice(0, 18) : undefined;
  }

  private sourceChannelSupportsPlatformMessage(sourceChannel: LaunchLeadSourceChannel): boolean {
    return sourceChannel === "google-business-profile" || sourceChannel === "social";
  }

  private buildOpsReviewResponseQueue(
    reviews: ProviderReview[],
    bookings: Booking[],
    providers: ProviderProfile[],
    supportTickets: SupportTicket[]
  ): OpsReviewResponseItem[] {
    const bookingsById = new Map(bookings.map((booking) => [booking.id, booking]));
    const providersById = new Map(providers.map((provider) => [provider.id, provider]));

    return [...reviews]
      .sort((left, right) => {
        if (left.responseStatus !== right.responseStatus) {
          return left.responseStatus === "pending" ? -1 : right.responseStatus === "pending" ? 1 : 0;
        }

        return right.createdAt.localeCompare(left.createdAt);
      })
      .slice(0, 8)
      .map((review) =>
        this.buildOpsReviewResponseQueueItem(
          review,
          bookingsById.get(review.bookingId),
          providersById.get(review.providerId),
          supportTickets.filter((ticket) => ticket.bookingId === review.bookingId)
        )
      )
      .filter((item): item is OpsReviewResponseItem => Boolean(item));
  }

  private buildInboundAutomationOverview(
    launchLeads: LaunchLead[],
    reviews: ProviderReview[]
  ): {
    sourceMetrics: InboundAutomationSourceMetric[];
    alerts: InboundAutomationAlertItem[];
    recentActivity: InboundAutomationActivityItem[];
  } {
    const now = Date.now();
    const recentWindowMs = 7 * 24 * 60 * 60 * 1000;
    const sourceMap = new Map<InboundAutomationSourceKey, {
      metric: InboundAutomationSourceMetric;
      recentActivity: InboundAutomationActivityItem[];
    }>();

    for (const source of this.getExpectedInboundAutomationSources()) {
      this.getOrCreateInboundAutomationSourceEntry(sourceMap, source);
    }

    for (const lead of launchLeads) {
      const source = this.getInboundAutomationSourceForLead(lead);
      if (!source) {
        continue;
      }

      const entry = this.getOrCreateInboundAutomationSourceEntry(sourceMap, source);
      const occurredAt = lead.createdAt;
      if (!entry.metric.lastOccurredAt || occurredAt > entry.metric.lastOccurredAt) {
        entry.metric.lastOccurredAt = occurredAt;
      }
      if (new Date(occurredAt).getTime() >= now - recentWindowMs) {
        entry.metric.recentCount += 1;
      }
      if (lead.status !== "converted" && lead.status !== "closed-lost") {
        entry.metric.openLeadCount = (entry.metric.openLeadCount ?? 0) + 1;
      }
      entry.recentActivity.push({
        id: `lead:${lead.id}`,
        sourceKey: source.sourceKey,
        label: source.label,
        kind: "launch-lead",
        occurredAt,
        summary: `${lead.contactName} • ${lead.areaLabel}${lead.serviceCategory ? ` • ${lead.serviceCategory.replaceAll("-", " ")}` : ""}`,
        reference: lead.sourceReferenceId
      });
    }

    for (const review of reviews) {
      const source = this.getInboundAutomationSourceForReview(review);
      if (!source) {
        continue;
      }

      const entry = this.getOrCreateInboundAutomationSourceEntry(sourceMap, source);
      const occurredAt = review.responseHandledAt ?? review.createdAt;
      if (!entry.metric.lastOccurredAt || occurredAt > entry.metric.lastOccurredAt) {
        entry.metric.lastOccurredAt = occurredAt;
      }
      if (new Date(occurredAt).getTime() >= now - recentWindowMs) {
        entry.metric.recentCount += 1;
      }
      entry.recentActivity.push({
        id: `review:${review.id}`,
        sourceKey: source.sourceKey,
        label: source.label,
        kind: "review-response",
        occurredAt,
        summary: `${review.responseStatus} public reply • rating ${review.overallRating}/5`,
        reference: review.externalResponseId ?? review.publicResponseUrl
      });
    }

    const sourceMetrics = [...sourceMap.values()]
      .map((entry) => {
        entry.metric.status = this.getInboundAutomationStatus(entry.metric, now);
        return entry.metric;
      })
      .sort((left, right) => {
        if (left.status !== right.status) {
          return left.status === "stale" ? -1 : right.status === "stale" ? 1 : left.status === "watch" ? -1 : 1;
        }
        return left.label.localeCompare(right.label);
      });

    const alerts = sourceMetrics
      .filter((metric) => metric.status !== "healthy")
      .map((metric) => this.buildInboundAutomationAlert(metric));

    const recentActivity = [...sourceMap.values()]
      .flatMap((entry) => entry.recentActivity)
      .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
      .slice(0, 10);

    return {
      sourceMetrics,
      alerts,
      recentActivity
    };
  }

  private getOrCreateInboundAutomationSourceEntry(
    sourceMap: Map<InboundAutomationSourceKey, { metric: InboundAutomationSourceMetric; recentActivity: InboundAutomationActivityItem[] }>,
    source: {
      sourceKey: InboundAutomationSourceKey;
      label: string;
      kind: "launch-lead" | "review-response";
      staleThresholdHours: number;
    }
  ) {
    const existing = sourceMap.get(source.sourceKey);
    if (existing) {
      return existing;
    }

    const created = {
      metric: {
        sourceKey: source.sourceKey,
        label: source.label,
        kind: source.kind,
        recentCount: 0,
        lastOccurredAt: undefined,
        status: "stale",
        staleThresholdHours: source.staleThresholdHours,
        openLeadCount: source.kind === "launch-lead" ? 0 : undefined
      } as InboundAutomationSourceMetric,
      recentActivity: [] as InboundAutomationActivityItem[]
    };
    sourceMap.set(source.sourceKey, created);
    return created;
  }

  private getExpectedInboundAutomationSources(): Array<{
    sourceKey: InboundAutomationSourceKey;
    label: string;
    kind: "launch-lead" | "review-response";
    staleThresholdHours: number;
  }> {
    const configured = process.env.OPS_EXPECTED_INBOUND_AUTOMATION_SOURCES
      ?.split(",")
      .map((item) => item.trim())
      .filter((item): item is InboundAutomationSourceKey => this.isInboundAutomationSourceKey(item));

    return [...new Set(configured ?? [])]
      .map((sourceKey) => this.getInboundAutomationSourceDefinition(sourceKey))
      .filter((source): source is NonNullable<typeof source> => Boolean(source));
  }

  private isInboundAutomationSourceKey(value: string): value is InboundAutomationSourceKey {
    return this.getInboundAutomationSourceDefinition(value as InboundAutomationSourceKey) !== undefined;
  }

  private getInboundAutomationSourceDefinition(
    sourceKey: InboundAutomationSourceKey
  ): {
    sourceKey: InboundAutomationSourceKey;
    label: string;
    kind: "launch-lead" | "review-response";
    staleThresholdHours: number;
  } | undefined {
    switch (sourceKey) {
      case "direct-email-lead":
        return { sourceKey, label: "Direct inbox leads", kind: "launch-lead", staleThresholdHours: 72 };
      case "google-business-profile-lead":
        return { sourceKey, label: "GBP message leads", kind: "launch-lead", staleThresholdHours: 96 };
      case "referral-lead":
        return { sourceKey, label: "Referral forwarders", kind: "launch-lead", staleThresholdHours: 168 };
      case "shared-inbox-review-response":
        return { sourceKey, label: "Shared inbox review replies", kind: "review-response", staleThresholdHours: 72 };
      case "google-business-profile-review-response":
        return { sourceKey, label: "GBP review replies", kind: "review-response", staleThresholdHours: 96 };
      default:
        return undefined;
    }
  }

  private getInboundAutomationSourceForLead(
    lead: LaunchLead
  ): {
    sourceKey: InboundAutomationSourceKey;
    label: string;
    kind: "launch-lead" | "review-response";
    staleThresholdHours: number;
  } | undefined {
    switch (lead.requestSource) {
      case "direct-email-forward":
        return this.getInboundAutomationSourceDefinition("direct-email-lead");
      case "google-business-profile-message":
        return this.getInboundAutomationSourceDefinition("google-business-profile-lead");
      case "referral-forwarder":
        return this.getInboundAutomationSourceDefinition("referral-lead");
      default:
        return undefined;
    }
  }

  private getInboundAutomationSourceForReview(
    review: ProviderReview
  ): {
    sourceKey: InboundAutomationSourceKey;
    label: string;
    kind: "launch-lead" | "review-response";
    staleThresholdHours: number;
  } | undefined {
    if (review.responseStatus !== "posted" || !review.responseChannel) {
      return undefined;
    }

    const metadata = review.responseChannelMetadata;
    const looksInbound =
      Boolean(metadata?.emailMessageId) ||
      Boolean(metadata?.mailboxName) ||
      Boolean(metadata?.profileLocationName) ||
      Boolean(metadata?.threadUrl) ||
      review.responseNotes?.toLowerCase().includes("inbound") ||
      metadata?.intakeNotes?.some((note) => /inbound .*automation route/i.test(note));

    if (!looksInbound) {
      return undefined;
    }

    if (review.responseChannel === "shared-inbox") {
      return this.getInboundAutomationSourceDefinition("shared-inbox-review-response");
    }

    if (review.responseChannel === "google-business-profile") {
      return this.getInboundAutomationSourceDefinition("google-business-profile-review-response");
    }

    return undefined;
  }

  private getInboundAutomationStatus(
    metric: InboundAutomationSourceMetric,
    now: number
  ): InboundAutomationSourceMetric["status"] {
    if (!metric.lastOccurredAt) {
      return "stale";
    }

    const ageMs = now - new Date(metric.lastOccurredAt).getTime();
    if (ageMs > metric.staleThresholdHours * 60 * 60 * 1000) {
      return "stale";
    }

    if (ageMs > (metric.staleThresholdHours / 2) * 60 * 60 * 1000) {
      return "watch";
    }

    return "healthy";
  }

  private buildInboundAutomationAlert(
    metric: InboundAutomationSourceMetric
  ): InboundAutomationAlertItem {
    const lastSeen = metric.lastOccurredAt
      ? `Last activity ${this.formatShortDate(metric.lastOccurredAt)}.`
      : "No inbound activity has been recorded yet.";
    const volumeDetail =
      metric.recentCount > 0
        ? `${metric.recentCount} item${metric.recentCount === 1 ? "" : "s"} arrived in the last 7 days.`
        : "Nothing has arrived in the last 7 days.";

    return {
      sourceKey: metric.sourceKey,
      label: metric.label,
      kind: metric.kind,
      severity: metric.status === "stale" ? "urgent" : "watch",
      detail: `${lastSeen} ${volumeDetail}`,
      recommendedAction:
        metric.kind === "launch-lead"
          ? "Check the external forwarder, webhook secret, and source mailbox or relay before launch demand silently falls back to manual entry."
          : "Check the review-reply relay, webhook secret, and posting automation before public responses drift back to manual-only handling.",
      recentCount: metric.recentCount,
      lastOccurredAt: metric.lastOccurredAt
    };
  }

  private buildOpsReviewResponseQueueItem(
    review: ProviderReview,
    booking: Booking | undefined,
    provider: ProviderProfile | undefined,
    relatedTickets: SupportTicket[]
  ): OpsReviewResponseItem | undefined {
    if (!booking || !provider) {
      return undefined;
    }

    const issueSignals = this.inferReviewIssueSignals(review);
    const hasOpenSupportTicket = relatedTickets.some((ticket) => ticket.status !== "resolved");
    const hasRefundContext = relatedTickets.some((ticket) => ticket.issueType === "billing");
    const sentiment: OpsReviewResponseItem["sentiment"] =
      review.overallRating <= 2 ? "negative" : review.overallRating === 3 || issueSignals.length > 0 ? "mixed" : "positive";
    const priority: OpsReviewResponseItem["priority"] =
      review.overallRating <= 2 || hasOpenSupportTicket || hasRefundContext
        ? "urgent"
        : review.overallRating === 3 || issueSignals.length > 0
          ? "watch"
          : "routine";
    const responseDueAt =
      review.responseStatus === "pending" ? this.getReviewResponseDueIso(review.createdAt, priority) : undefined;
    const isResponseOverdue = responseDueAt !== undefined && new Date(responseDueAt).getTime() < Date.now();
    const linkedSupportTicket = review.supportTicketId
      ? relatedTickets.find((ticket) => ticket.id === review.supportTicketId)
      : undefined;
    const supportFollowUpRecommended =
      review.responseStatus === "pending" && priority === "urgent" && !linkedSupportTicket;
    const watchouts: string[] = [];
    if (hasOpenSupportTicket) {
      watchouts.push("An open support ticket already exists for this booking, so confirm internal follow-up before posting a public reply.");
    }
    if (hasRefundContext) {
      watchouts.push("Billing or refund context is already on file. Do not promise a refund outcome publicly before checking the support record.");
    }
    if (issueSignals.includes("timing")) {
      watchouts.push("The review mentions timing or lateness, so the response should acknowledge reliability concerns directly.");
    }
    if (issueSignals.includes("quality")) {
      watchouts.push("The review points to service quality or missed-detail concerns, so avoid generic thanks-only replies.");
    }
    if (supportFollowUpRecommended) {
      watchouts.push("This review should also move into a service-quality support follow-up so the team does more than post a public reply.");
    }
    if (linkedSupportTicket?.status && linkedSupportTicket.status !== "resolved") {
      watchouts.push("A linked support follow-up is already open for this review, so keep the public reply aligned with the case notes.");
    }
    if (linkedSupportTicket?.status === "resolved") {
      watchouts.push("A linked support follow-up has already been resolved. Reopen it only if the public review changes the recovery plan.");
    }
    if (review.responseStatus === "posted") {
      watchouts.push("A public reply is already recorded. Reopen only if the posted reply needs correction or follow-up.");
      if (!review.externalResponseId && !review.publicResponseUrl) {
        watchouts.push("This posted reply is missing a traceable channel reference, so update the audit record before treating the workflow as complete.");
      }
    }
    if (review.responseStatus === "skipped") {
      watchouts.push("A skip decision is already recorded. Reopen only if new public-facing context changes that call.");
    }

    return {
      reviewId: review.id,
      bookingId: booking.id,
      providerId: provider.id,
      providerName: provider.companyName,
      category: booking.category,
      overallRating: review.overallRating,
      reviewText: review.reviewText,
      createdAt: review.createdAt,
      responseStatus: review.responseStatus,
      responseHandledAt: review.responseHandledAt,
      responseHandledBy: review.responseHandledBy,
      responseNotes: review.responseNotes,
      publicReplyBody: review.publicReplyBody,
      responseChannel: review.responseChannel,
      responseChannelMetadata: review.responseChannelMetadata,
      externalResponseId: review.externalResponseId,
      publicResponseUrl: review.publicResponseUrl,
      supportTicketId: review.supportTicketId,
      supportTicketStatus: linkedSupportTicket?.status,
      supportTicketSubject: linkedSupportTicket?.subject,
      escalatedAt: review.escalatedAt,
      escalatedBy: review.escalatedBy,
      escalationNotes: review.escalationNotes,
      responseDueAt,
      isResponseOverdue,
      sentiment,
      priority,
      issueSignals,
      watchouts,
      supportFollowUpRecommended,
      recommendedAction: this.buildReviewResponseRecommendedAction(
        review.responseStatus,
        priority,
        hasOpenSupportTicket,
        issueSignals,
        linkedSupportTicket
      ),
      publicReplyTemplate: this.buildReviewResponseTemplate(review, booking, provider, priority, issueSignals)
    };
  }

  private inferReviewIssueSignals(review: ProviderReview): string[] {
    const normalizedText = this.normalizeInboundInferenceText(review.reviewText);
    const signals = new Set<string>();

    if (/\b(?:late|delay|behind|waited|waiting|timing)\b/.test(normalizedText) || review.timelinessRating <= 3) {
      signals.add("timing");
    }
    if (
      /\b(?:quality|detail|missed|sloppy|uneven|rushed|mess|cleanup|clippings|patchy|careless)\b/.test(normalizedText) ||
      review.attentionToDetailRating <= 3
    ) {
      signals.add("quality");
    }
    if (/\b(?:communication|reply|respond|answered|call|text|update|showed up|no show)\b/.test(normalizedText)) {
      signals.add("communication");
    }
    if (/\b(?:price|pricing|cost|expensive|quote|quoted)\b/.test(normalizedText)) {
      signals.add("pricing");
    }

    return [...signals];
  }

  private buildReviewResponseRecommendedAction(
    responseStatus: ProviderReview["responseStatus"],
    priority: OpsReviewResponseItem["priority"],
    hasOpenSupportTicket: boolean,
    issueSignals: string[],
    linkedSupportTicket?: SupportTicket
  ): string {
    if (responseStatus === "posted") {
      return "A public reply is already recorded here. Only reopen this review if the posted response needs correction or a follow-up update.";
    }

    if (responseStatus === "skipped") {
      return "This review is marked skipped. Reopen it only if new context makes a public reply worth posting after all.";
    }

    if (priority === "urgent") {
      if (linkedSupportTicket?.status && linkedSupportTicket.status !== "resolved") {
        return "Reply publicly today with a calm acknowledgment, then keep the linked support follow-up moving so the public reply and the real recovery path stay aligned.";
      }

      if (linkedSupportTicket?.status === "resolved") {
        return "Reply publicly today with a calm acknowledgment, and keep the wording aligned with the resolved support outcome instead of re-opening the whole case in public.";
      }

      return hasOpenSupportTicket
        ? "Reply publicly today with a calm acknowledgment, then make sure the internal support path is aligned before promising any concrete remedy."
        : "Reply publicly today, acknowledge the specific concern without arguing, and escalate the review into a service-quality support follow-up instead of debating in public.";
    }

    if (priority === "watch") {
      return issueSignals.length > 0
        ? "Reply publicly within 24 to 48 hours, thank them, acknowledge the concern they raised, and show a concrete next step instead of using a generic thank-you."
        : "Reply publicly within 24 to 48 hours so the launch profile shows active follow-through, even when the review is only mildly mixed.";
    }

    return "Reply publicly with thanks and one specific detail so the profile shows a consistent, human review-response habit instead of silence.";
  }

  private getReviewResponseDueIso(
    createdAt: string,
    priority: OpsReviewResponseItem["priority"]
  ): string {
    const dueDate = new Date(createdAt);
    const dueHours = priority === "urgent" ? 24 : priority === "watch" ? 48 : 72;
    dueDate.setHours(dueDate.getHours() + dueHours);
    return dueDate.toISOString();
  }

  private buildReviewResponseTemplate(
    review: ProviderReview,
    booking: Booking,
    provider: ProviderProfile,
    priority: OpsReviewResponseItem["priority"],
    issueSignals: string[]
  ): OpsReviewResponseItem["publicReplyTemplate"] {
    const providerName = provider.companyName;
    const serviceLabel = this.titleCaseCategory(booking.category).toLowerCase();

    if (priority === "urgent") {
      return {
        key: "public-recovery",
        title: "Public recovery reply",
        channel: "public-review-reply",
        reason: "Use this when the review is low-rated or already tied to active support context.",
        body:
          `Thank you for the candid feedback. We are sorry this ${serviceLabel} visit did not feel like the standard ${providerName} should deliver. ` +
          `We are reviewing the details internally so the follow-up stays specific, and we appreciate you flagging it for us.`
      };
    }

    if (priority === "watch") {
      const concern =
        issueSignals.includes("timing")
          ? "the timing concerns"
          : issueSignals.includes("quality")
            ? "the service details you called out"
            : "the concerns you mentioned";
      return {
        key: "public-watchout",
        title: "Public mixed-review reply",
        channel: "public-review-reply",
        reason: "Use this when the review is mixed and needs a more specific reply than a generic thank-you.",
        body:
          `Thank you for the honest feedback. We appreciate the chance to improve, especially around ${concern}. ` +
          `Your note helps ${providerName} tighten the experience instead of treating every visit like a one-size-fits-all job.`
      };
    }

    return {
      key: "public-thank-you",
      title: "Public thank-you reply",
      channel: "public-review-reply",
      reason: "Use this to keep a visible habit of thanking happy customers without sounding canned.",
      body:
        `Thank you for taking the time to share this. We are glad ${providerName} could help with your ${serviceLabel}, and we appreciate you trusting GreenRain with the property.`
    };
  }

  private prepareInboundLeadIntakeDetails(input: {
    sourceChannel: LaunchLeadSourceChannel;
    channelMetadata?: LaunchLeadChannelMetadata;
    areaLabel?: string;
    serviceCategory?: CreateInboundLaunchLeadRequest["serviceCategory"];
    phone?: string;
    preferredContactMethod?: LaunchLeadContactPreference;
    messageText?: string;
  }): {
    areaLabel: string;
    serviceCategory?: CreateInboundLaunchLeadRequest["serviceCategory"];
    phone?: string;
    preferredContactMethod?: LaunchLeadContactPreference;
    channelMetadata?: LaunchLeadChannelMetadata;
  } {
    const notes = [...(input.channelMetadata?.intakeNotes ?? [])];
    const normalizedMessage = input.messageText?.trim().replace(/\s+/g, " ") || "";
    const inferredAreaLabel = input.areaLabel?.trim().replace(/\s+/g, " ") || this.inferInboundAreaLabel(normalizedMessage);
    if (!input.areaLabel?.trim() && inferredAreaLabel) {
      notes.push(
        `Area was inferred from the inbound message as ${inferredAreaLabel}. Confirm coverage before promising timing or pricing.`
      );
    }

    const inferredServiceCategory = input.serviceCategory ?? this.inferInboundServiceCategory(normalizedMessage);
    if (!input.serviceCategory && inferredServiceCategory) {
      notes.push(
        `Service was inferred from the inbound message as ${this.titleCaseCategory(inferredServiceCategory)}. Confirm the exact scope before quoting.`
      );
    }

    const inferredPhone = this.normalizeLaunchLeadPhone(input.phone) ?? this.extractPhoneNumberFromText(normalizedMessage);
    if (!input.phone?.trim() && inferredPhone) {
      notes.push(
        "A phone number was inferred from the inbound message. Confirm whether phone or text follow-up is best before relying on it."
      );
    }

    const inferredContactMethod =
      input.preferredContactMethod ??
      this.inferInboundContactPreferenceFromText(input.sourceChannel, normalizedMessage, Boolean(inferredPhone));
    if (!input.preferredContactMethod && inferredContactMethod && inferredContactMethod !== "email") {
      notes.push(
        `Follow-up preference was inferred from the inbound message as ${inferredContactMethod.replaceAll("-", " ")}. Confirm it on the first reply.`
      );
    }

    const uniqueNotes = [...new Set(notes)];
    return {
      areaLabel: inferredAreaLabel || "Needs area confirmation",
      serviceCategory: inferredServiceCategory,
      phone: inferredPhone,
      preferredContactMethod: inferredContactMethod,
      channelMetadata:
        uniqueNotes.length > 0
          ? {
              ...input.channelMetadata,
              intakeNotes: uniqueNotes
            }
          : input.channelMetadata
    };
  }

  private inferInboundAreaLabel(messageText: string): string | undefined {
    if (!messageText) {
      return undefined;
    }

    const launchAreaLabel =
      process.env.NEXT_PUBLIC_DEFAULT_SERVICE_AREA_LABEL?.trim().replace(/\s+/g, " ") || "Barnegat, NJ";
    const normalizedMessage = this.normalizeInboundInferenceText(messageText);
    const [city = launchAreaLabel, state = ""] = launchAreaLabel.split(",").map((part) => part.trim());
    const normalizedCity = this.normalizeInboundInferenceText(city);
    const normalizedLabel = this.normalizeInboundInferenceText(launchAreaLabel);
    const normalizedCityState = state ? `${normalizedCity} ${this.normalizeInboundInferenceText(state)}` : normalizedCity;

    if (
      normalizedMessage.includes(normalizedLabel) ||
      normalizedMessage.includes(normalizedCityState) ||
      normalizedMessage.includes(normalizedCity) ||
      normalizedMessage.includes(`${normalizedCity} township`)
    ) {
      return launchAreaLabel;
    }

    return undefined;
  }

  private inferInboundServiceCategory(
    messageText: string
  ): CreateInboundLaunchLeadRequest["serviceCategory"] | undefined {
    if (!messageText) {
      return undefined;
    }

    const normalizedMessage = this.normalizeInboundInferenceText(messageText);
    const categoryMatchers: Array<{
      category: CreateInboundLaunchLeadRequest["serviceCategory"];
      patterns: RegExp[];
    }> = [
      {
        category: "lawn-mowing",
        patterns: [/\blawn mow(?:ing)?\b/, /\bweekly mow(?:ing)?\b/, /\bgrass (?:cut|cutting)\b/, /\bmow(?:ing)?\b/]
      },
      {
        category: "seasonal-cleanup",
        patterns: [/\bseasonal cleanup\b/, /\byard cleanup\b/, /\bspring cleanup\b/, /\bfall cleanup\b/, /\bleaf cleanup\b/]
      },
      {
        category: "hedge-trimming",
        patterns: [/\bhedge trim(?:ming)?\b/, /\btrim(?:ming)? bushes\b/, /\bshrub trim(?:ming)?\b/, /\bhedges?\b/]
      },
      {
        category: "mulch-installation",
        patterns: [/\bmulch install(?:ation)?\b/, /\bmulch refresh\b/, /\bmulching\b/, /\bmulch\b/]
      },
      {
        category: "weed-control",
        patterns: [/\bweed control\b/, /\bweed treatment\b/, /\bweeds?\b/]
      },
      {
        category: "gutter-cleaning",
        patterns: [/\bgutter clean(?:ing)?\b/, /\bgutters?\b/]
      },
      {
        category: "irrigation-check",
        patterns: [/\birrigation\b/, /\bsprinkler(?: system)?\b/]
      },
      {
        category: "leaf-blowing",
        patterns: [/\bleaf blow(?:ing)?\b/, /\bblow(?:ing)? leaves\b/]
      },
      {
        category: "aeration",
        patterns: [/\bcore aeration\b/, /\baerat(?:e|ion)\b/]
      },
      {
        category: "fertilization",
        patterns: [/\bfertili(?:z|s)(?:e|ing|ation)\b/, /\blawn feed(?:ing)?\b/]
      },
      {
        category: "snow-shoveling",
        patterns: [/\bsnow shovel(?:ing)?\b/, /\bshovel snow\b/]
      },
      {
        category: "ice-melt-salting",
        patterns: [/\bice melt\b/, /\bsalt(?:ing)?\b/]
      },
      {
        category: "snow-blowing",
        patterns: [/\bsnow blow(?:ing)?\b/, /\bsnow blower\b/]
      }
    ];

    return categoryMatchers.find((matcher) => matcher.patterns.some((pattern) => pattern.test(normalizedMessage)))
      ?.category;
  }

  private extractPhoneNumberFromText(messageText: string): string | undefined {
    if (!messageText) {
      return undefined;
    }

    const match = messageText.match(/(?:\+?1[\s().-]*)?(?:\d[\s().-]*){10,11}/);
    return this.normalizeLaunchLeadPhone(match?.[0]);
  }

  private inferInboundContactPreferenceFromText(
    sourceChannel: LaunchLeadSourceChannel,
    messageText: string,
    hasPhone: boolean
  ): LaunchLeadContactPreference | undefined {
    if (!messageText) {
      return undefined;
    }

    const normalizedMessage = this.normalizeInboundInferenceText(messageText);
    if (hasPhone && /\b(?:text me|text us|send a text|sms me|txt me)\b/.test(normalizedMessage)) {
      return "text";
    }
    if (hasPhone && /\b(?:call me|call us|phone me|give me a call|reach me by phone)\b/.test(normalizedMessage)) {
      return "phone";
    }
    if (this.sourceChannelSupportsPlatformMessage(sourceChannel) && /\bmessage me here\b/.test(normalizedMessage)) {
      return "platform-message";
    }

    return undefined;
  }

  private normalizeInboundInferenceText(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .replace(/\s+/g, " ");
  }

  private deriveInboundContactName(
    email: string | undefined,
    phone: string | undefined,
    sourceChannel: LaunchLeadSourceChannel
  ): string {
    if (email) {
      const localPart = email.split("@")[0] ?? "customer";
      return this.toTitleCase(localPart.replace(/[._-]+/g, " "));
    }
    if (phone) {
      return `Inbound ${this.toTitleCase(sourceChannel.replaceAll("-", " "))} contact`;
    }
    return "Inbound contact";
  }

  private parseInboundMailboxIdentity(
    mailbox: string | undefined,
    fallbackName?: string
  ): { email?: string; name?: string } {
    const trimmedMailbox = mailbox?.trim();
    const explicitName = fallbackName?.trim().replace(/\s+/g, " ") || undefined;
    if (!trimmedMailbox) {
      return {
        email: undefined,
        name: explicitName
      };
    }

    const bracketMatch = trimmedMailbox.match(/^(.*)<([^>]+)>$/);
    if (bracketMatch) {
      const parsedName = bracketMatch[1]?.trim().replace(/^"|"$/g, "").replace(/\s+/g, " ") || explicitName;
      const parsedEmail = bracketMatch[2]?.trim().toLowerCase();
      return {
        email: parsedEmail || undefined,
        name: parsedName || undefined
      };
    }

    if (trimmedMailbox.includes("@")) {
      return {
        email: trimmedMailbox.toLowerCase(),
        name: explicitName
      };
    }

    return {
      email: undefined,
      name: explicitName ?? trimmedMailbox.replace(/\s+/g, " ")
    };
  }

  private normalizeInboundMessageReference(reference: string | undefined): string | undefined {
    const trimmed = reference?.trim();
    if (!trimmed) {
      return undefined;
    }

    return trimmed.replace(/^<+/, "").replace(/>+$/, "") || undefined;
  }

  private normalizeReviewResponseChannelMetadata(
    metadata: ReviewResponseChannelMetadata | undefined
  ): ReviewResponseChannelMetadata | undefined {
    if (!metadata) {
      return undefined;
    }

    const normalized: ReviewResponseChannelMetadata = {
      threadUrl: metadata.threadUrl?.trim() || undefined,
      profileLocationName: metadata.profileLocationName?.trim().replace(/\s+/g, " ") || undefined,
      emailMessageId: this.normalizeInboundMessageReference(metadata.emailMessageId),
      emailThreadId:
        this.normalizeInboundMessageReference(metadata.emailThreadId) ??
        metadata.emailThreadId?.trim() ??
        undefined,
      mailboxName: metadata.mailboxName?.trim().replace(/\s+/g, " ") || undefined,
      senderEmail: metadata.senderEmail?.trim().toLowerCase() || undefined,
      intakeNotes:
        metadata.intakeNotes
          ?.map((note) => note.trim().replace(/\s+/g, " "))
          .filter((note) => note.length > 0) || undefined
    };

    return Object.values(normalized).some((value) => {
      if (Array.isArray(value)) {
        return value.length > 0;
      }
      return Boolean(value);
    })
      ? normalized
      : undefined;
  }

  private normalizeInboundEmailHtmlBody(html: string): string | undefined {
    const withoutScripts = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ");
    const withLineBreaks = withoutScripts
      .replace(/<\s*br\s*\/?>/gi, "\n")
      .replace(/<\/\s*(p|div|li|tr|h[1-6])\s*>/gi, "\n");
    const withoutTags = withLineBreaks.replace(/<[^>]+>/g, " ");
    const decoded = withoutTags
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/gi, '"');
    const collapsed = decoded
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    return collapsed || undefined;
  }

  private getFirstName(name: string | undefined, fallback = "there"): string {
    const normalized = name?.trim().replace(/\s+/g, " ");
    if (!normalized) {
      return fallback;
    }

    return normalized.split(" ")[0] ?? normalized;
  }

  private getLeadFirstName(contactName: string): string {
    return this.getFirstName(contactName, "customer");
  }

  private async maybeCreateLaunchLeadFromSupportTicket(
    requester: { userId: string; role: "customer" | "provider" | "crew-member" },
    payload: CreateSupportTicketRequest
  ): Promise<LaunchLead | undefined> {
    if (
      requester.role !== "customer" ||
      payload.bookingId ||
      (payload.issueType !== "general" && payload.issueType !== "account")
    ) {
      return undefined;
    }

    const customer = await this.repository.findCustomerById(requester.userId);
    if (!customer) {
      return undefined;
    }

    const defaultProperty =
      customer.properties.find((property) => property.id === customer.defaultPropertyId) ??
      customer.properties[0];
    const areaAddress = defaultProperty?.address ?? customer.address;
    const areaLabel = `${areaAddress.city}, ${areaAddress.state}`;
    const subject = payload.subject.trim().replace(/\s+/g, " ");
    const description = payload.description.trim().replace(/\s+/g, " ");

    return this.createLaunchLead({
      sourceChannel: "email",
      requestSource: "customer-support-no-booking-ticket",
      contactName: customer.fullName,
      email: customer.email,
      phone: customer.phone,
      preferredContactMethod: "email",
      areaLabel,
      message: `Customer service help request from support ticket: ${subject}. ${description}`
    });
  }

  private buildLaunchAttributionAnalyticsProperties(
    attribution?: LaunchAttributionContext
  ): AnalyticsEvent["properties"] {
    if (!attribution) {
      return {};
    }

    const properties: AnalyticsEvent["properties"] = {};
    if (attribution.source) {
      properties.attributionSource = attribution.source;
    }
    if (attribution.medium) {
      properties.attributionMedium = attribution.medium;
    }
    if (attribution.campaign) {
      properties.attributionCampaign = attribution.campaign;
    }
    if (attribution.term) {
      properties.attributionTerm = attribution.term;
    }
    if (attribution.content) {
      properties.attributionContent = attribution.content;
    }
    if (attribution.referrerHost) {
      properties.attributionReferrerHost = attribution.referrerHost;
    }
    if (attribution.landingPath) {
      properties.attributionLandingPath = attribution.landingPath;
    }
    if (attribution.capturedAt) {
      properties.attributionCapturedAt = attribution.capturedAt;
    }

    return properties;
  }

  private buildLaunchLeadAnalyticsProperties(
    lead?: LaunchLead,
    linkMode?: LaunchLeadLinkMode
  ): AnalyticsEvent["properties"] {
    if (!lead) {
      return {};
    }

    return {
      launchLeadId: lead.id,
      launchLeadSourceChannel: lead.sourceChannel,
      launchLeadRequestSource: lead.requestSource ?? "unknown",
      ...(linkMode ? { launchLeadLinkMode: linkMode } : {})
    };
  }

  private buildRetentionAnalyticsProperties(
    retention?: CreateBookingRequest["retentionContext"]
  ): AnalyticsEvent["properties"] {
    if (!retention) {
      return {};
    }

    return {
      retentionOpportunityId: retention.opportunityId,
      retentionSourceBookingId: retention.sourceBookingId,
      retentionKind: retention.kind,
      retentionStrategyKey: retention.strategyKey,
      retentionTrigger: retention.trigger
    };
  }

  private buildSearchRetentionAnalyticsProperties(
    retention?: SearchProvidersRequest["retentionPreference"]
  ): AnalyticsEvent["properties"] {
    if (!retention) {
      return {};
    }

    return {
      retentionStrategyKey: retention.strategyKey,
      retentionTrigger: retention.trigger,
      loyaltySegment: retention.loyaltySegment,
      completedCategoryCount: retention.completedCategoryCount,
      sameProviderCompletedCount: retention.sameProviderCompletedCount
    };
  }

  private buildSuggestedLaunchLeadBookingMatches(
    lead: LaunchLead,
    bookings: Booking[],
    customers: CustomerProfile[],
    providers: ProviderProfile[]
  ): LaunchLeadBookingMatch[] {
    const normalizedLeadEmail = lead.email?.trim().toLowerCase();
    const normalizedLeadPhone = this.normalizeLaunchLeadPhone(lead.phone);
    if (!normalizedLeadEmail && !normalizedLeadPhone) {
      return [];
    }

    const customersById = new Map(customers.map((customer) => [customer.id, customer]));
    const providersById = new Map(providers.map((provider) => [provider.id, provider]));

    const matches: LaunchLeadBookingMatch[] = [];
    for (const booking of bookings) {
      if (
        lead.convertedBookingIds.includes(booking.id) ||
        (booking.launchLeadId && booking.launchLeadId !== lead.id)
      ) {
        continue;
      }

      const customer = customersById.get(booking.customerId);
      if (!customer) {
        continue;
      }

      const emailMatch = Boolean(normalizedLeadEmail) && customer.email.trim().toLowerCase() === normalizedLeadEmail;
      const phoneMatch =
        Boolean(normalizedLeadPhone) && this.normalizeLaunchLeadPhone(customer.phone) === normalizedLeadPhone;
      if (!emailMatch && !phoneMatch) {
        continue;
      }

      const provider = providersById.get(booking.providerId);
      matches.push({
        bookingId: booking.id,
        customerId: booking.customerId,
        customerName: customer.fullName,
        providerId: booking.providerId,
        providerName: provider?.companyName,
        category: booking.category,
        bookingStatus: booking.status,
        scheduledStartIso: booking.scheduledStartIso,
        requestedAt: booking.requestedAt,
        matchReason: emailMatch && phoneMatch ? "email-and-phone" : emailMatch ? "email" : "phone"
      });
    }

    return matches
      .sort((left, right) => {
        const leftCategoryScore = this.scoreLaunchLeadCategoryMatch(lead, left.category);
        const rightCategoryScore = this.scoreLaunchLeadCategoryMatch(lead, right.category);
        if (leftCategoryScore !== rightCategoryScore) {
          return leftCategoryScore - rightCategoryScore;
        }

        const leftLinkedScore = lead.convertedBookingIds.includes(left.bookingId) ? 0 : 1;
        const rightLinkedScore = lead.convertedBookingIds.includes(right.bookingId) ? 0 : 1;
        if (leftLinkedScore !== rightLinkedScore) {
          return leftLinkedScore - rightLinkedScore;
        }

        return right.requestedAt.localeCompare(left.requestedAt);
      })
      .slice(0, 4);
  }

  private async resolveLaunchLeadForCustomer(
    customer: CustomerProfile,
    payload: Pick<CreateBookingRequest, "launchLeadId" | "category">
  ): Promise<{
    lead?: LaunchLead;
    linkMode?: LaunchLeadLinkMode;
  }> {
    if (payload.launchLeadId) {
      const explicitLead = await this.repository.findLaunchLeadById(payload.launchLeadId);
      if (explicitLead && explicitLead.status !== "closed-lost") {
        return {
          lead: explicitLead,
          linkMode: "explicit-id"
        };
      }
    }

    const normalizedEmail = customer.email.trim().toLowerCase();
    const normalizedPhone = this.normalizeLaunchLeadPhone(customer.phone);
    if (!normalizedEmail && !normalizedPhone) {
      return {};
    }

    const candidates = (await this.repository.listLaunchLeads())
      .filter((lead) => lead.status !== "closed-lost")
      .map((lead) => ({
        lead,
        emailMatch: Boolean(normalizedEmail) && lead.email === normalizedEmail,
        phoneMatch: Boolean(normalizedPhone) && lead.phone === normalizedPhone
      }))
      .filter((candidate) => candidate.emailMatch || candidate.phoneMatch)
      .sort((left, right) => {
        const leftCategoryScore = this.scoreLaunchLeadCategoryMatch(left.lead, payload.category);
        const rightCategoryScore = this.scoreLaunchLeadCategoryMatch(right.lead, payload.category);
        if (leftCategoryScore !== rightCategoryScore) {
          return leftCategoryScore - rightCategoryScore;
        }

        const leftStatusScore = left.lead.status === "converted" ? 1 : 0;
        const rightStatusScore = right.lead.status === "converted" ? 1 : 0;
        if (leftStatusScore !== rightStatusScore) {
          return leftStatusScore - rightStatusScore;
        }

        if (left.emailMatch !== right.emailMatch) {
          return left.emailMatch ? -1 : 1;
        }

        return right.lead.updatedAt.localeCompare(left.lead.updatedAt);
      });

    const selected = candidates[0];
    if (!selected) {
      return {};
    }

    return {
      lead: selected.lead,
      linkMode: selected.emailMatch ? "email-match" : "phone-match"
    };
  }

  private async linkBookingToLaunchLead(
    lead: LaunchLead,
    booking: Booking,
    linkedAtIso = new Date().toISOString()
  ): Promise<LaunchLead> {
    if (!booking.launchLeadId) {
      await this.repository.updateBooking(booking.id, {
        launchLeadId: lead.id
      });
    }

    if (booking.recurringPlanId) {
      const plan = await this.repository.findRecurringServicePlanById(booking.recurringPlanId);
      if (plan) {
        if (plan.launchLeadId && plan.launchLeadId !== lead.id) {
          throw new HttpError(400, "That booking's recurring plan is already linked to a different launch lead.");
        }

        if (!plan.launchLeadId) {
          await this.repository.updateRecurringServicePlan(plan.id, {
            launchLeadId: lead.id
          });
        }
      }
    }

    return (await this.syncLaunchLeadAfterBooking(lead.id, {
      ...booking,
      launchLeadId: lead.id
    }, linkedAtIso)) ?? lead;
  }

  private scoreLaunchLeadCategoryMatch(
    lead: LaunchLead,
    bookingCategory: CreateBookingRequest["category"]
  ): number {
    if (lead.serviceCategory === bookingCategory) {
      return 0;
    }
    if (!lead.serviceCategory) {
      return 1;
    }
    return 2;
  }

  private async syncLaunchLeadAfterBooking(
    launchLeadId: string,
    booking: Booking,
    linkedAtIso = booking.requestedAt
  ): Promise<LaunchLead | undefined> {
    const lead = await this.repository.findLaunchLeadById(launchLeadId);
    if (!lead) {
      return undefined;
    }

    const convertedBookingIds = lead.convertedBookingIds.includes(booking.id)
      ? lead.convertedBookingIds
      : [...lead.convertedBookingIds, booking.id];
    const conversionSummary =
      convertedBookingIds.length === 1
        ? `Converted to booking ${booking.id} through the managed marketplace flow.`
        : `Converted lead has now generated ${convertedBookingIds.length} bookings through the managed marketplace flow.`;
    const updatedLead = await this.repository.updateLaunchLead(lead.id, {
      status: "converted",
      firstRespondedAt: lead.firstRespondedAt ?? linkedAtIso,
      closedAt: linkedAtIso,
      nextFollowUpDueAt: undefined,
      lossReason: undefined,
      outcomeSummary:
        lead.status === "converted" && lead.outcomeSummary
          ? lead.outcomeSummary
          : conversionSummary,
      convertedBookingIds,
      firstConvertedBookingAt: lead.firstConvertedBookingAt ?? booking.requestedAt,
      lastConvertedBookingAt: booking.requestedAt,
      updatedAt: linkedAtIso
    });

    return updatedLead ?? lead;
  }

  private async syncLaunchLeadAfterReview(
    launchLeadId: string,
    review: ProviderReview
  ): Promise<LaunchLead | undefined> {
    const lead = await this.repository.findLaunchLeadById(launchLeadId);
    if (!lead) {
      return undefined;
    }

    const reviewIds = lead.reviewIds.includes(review.id) ? lead.reviewIds : [...lead.reviewIds, review.id];
    const updatedLead = await this.repository.updateLaunchLead(lead.id, {
      reviewIds,
      lastReviewSubmittedAt: review.createdAt,
      updatedAt: review.createdAt
    });

    return updatedLead ?? lead;
  }

  private getServiceWindowKey(iso: string): "morning" | "afternoon" | "late-afternoon-night" {
    const hour = new Date(iso).getHours();
    if (hour < 12) {
      return "morning";
    }
    if (hour < 16) {
      return "afternoon";
    }
    return "late-afternoon-night";
  }

  private buildSearchProviderRanking(
    payload: SearchProvidersRequest,
    provider: ProviderProfile,
    providerBookings: Booking[],
    distanceMiles: number,
    suggestedSlot?: AvailabilitySlot,
    providerDecisionMetrics?: {
      confirmations: number;
      declines: number;
    }
  ): SearchProviderResult {
    const matchedCategories = payload.categories.filter((category) => provider.categories.includes(category));
    const requestedCategoryCount = Math.max(payload.categories.length, 1);
    const providerCategoryCount = Math.max(provider.categories.length, 1);
    const completedBookings = providerBookings.filter((booking) => booking.status === "completed").length;
    const nearbyCompletedBookings = providerBookings.filter(
      (booking) =>
        booking.status === "completed" &&
        booking.serviceAddress.city === payload.address.city &&
        booking.serviceAddress.state === payload.address.state
    ).length;
    const disputedBookings = providerBookings.filter((booking) => booking.status === "disputed").length;
    const refundedBookings = providerBookings.filter((booking) => booking.status === "refunded").length;
    const activeExceptionBookings = providerBookings.filter((booking) => Boolean(booking.activeExceptionType)).length;
    const nonRequestedActiveBookings = providerBookings.filter(
      (booking) => booking.status !== "requested" && booking.status !== "cancelled"
    );
    const lateNoticeCount = providerBookings.filter((booking) => Boolean(booking.lateNoticeSentAt)).length;
    const lateNoticeRate = lateNoticeCount / Math.max(nonRequestedActiveBookings.length, 1);
    const providerConfirmations = providerDecisionMetrics?.confirmations ?? 0;
    const providerDeclines = providerDecisionMetrics?.declines ?? 0;
    const providerDecisionCount = providerConfirmations + providerDeclines;
    const providerAcceptanceRate =
      providerDecisionCount > 0 ? providerConfirmations / providerDecisionCount : undefined;
    const adjustedAcceptanceScore =
      providerDecisionCount === 0
        ? 0.78
        : providerDecisionCount < 5
          ? 0.78 + ((providerAcceptanceRate ?? 0.78) - 0.78) * (providerDecisionCount / 5)
          : providerAcceptanceRate ?? 0.78;
    const rawLateScore = Math.max(0, 1 - lateNoticeRate);
    const adjustedLateScore =
      nonRequestedActiveBookings.length < 5
        ? 0.84 + (rawLateScore - 0.84) * (nonRequestedActiveBookings.length / 5)
        : rawLateScore;
    const issueRate =
      (disputedBookings + refundedBookings + activeExceptionBookings) /
      Math.max(providerBookings.length, 1);
    const specializationFocus =
      matchedCategories.length === 0
        ? 0
        : Math.min(
            1,
            matchedCategories.length / providerCategoryCount +
              (providerCategoryCount <= requestedCategoryCount + 1
                ? 0.3
                : providerCategoryCount <= requestedCategoryCount + 3
                  ? 0.15
                  : 0)
          );
    const loyaltyPreference = payload.retentionPreference;
    const loyaltyBoost =
      loyaltyPreference?.priorProviderId === provider.id
        ? loyaltyPreference.loyaltySegment === "provider-loyal"
          ? 10
          : loyaltyPreference.loyaltySegment === "repeat-customer"
            ? 6
            : 2
        : 0;
    const providerEconomics = this.buildProviderEconomicsSearchSummary(
      payload,
      distanceMiles,
      matchedCategories
    );
    const serviceFitSummary = this.buildProviderServiceFitSearchSummary(payload, provider, matchedCategories);

    const factors = {
      serviceFit: Math.round((matchedCategories.length / requestedCategoryCount) * 22),
      specialization: Math.round(specializationFocus * 10),
      distance: Math.round(
        Math.max(0, 1 - distanceMiles / Math.max(provider.serviceRadiusMiles, 1)) * 20
      ),
      reliability: Math.round(
        (provider.rating / 5) * 16 +
          (provider.timelinessRating / 5) * 12 +
          (provider.attentionToDetailRating / 5) * 8 +
          (Math.min(provider.reviewCount, 100) / 100) * 4 +
          (Math.min(completedBookings, 75) / 75) * 5
      ),
      operationalReliability: Math.round(adjustedAcceptanceScore * 7 + adjustedLateScore * 5),
      experience: Math.round((Math.min(provider.yearsExperience, 15) / 15) * 6),
      availability: suggestedSlot ? 8 : 0,
      providerEconomics:
        providerEconomics.status === "healthy" ? 6 : providerEconomics.status === "watch" ? 3 : 0,
      loyalty: loyaltyBoost,
      sponsorship: provider.sponsoredListingEnabled ? 5 : 0,
      issuePenalty: Math.round(
        Math.min(disputedBookings * 5 + refundedBookings * 4 + activeExceptionBookings * 3 + issueRate * 12, 20)
      )
    };

    const score = Math.max(
      0,
        factors.serviceFit +
        factors.specialization +
        factors.distance +
        factors.reliability +
        factors.operationalReliability +
        factors.experience +
        factors.availability +
        factors.providerEconomics +
        factors.loyalty +
        factors.sponsorship -
        factors.issuePenalty
    );

    const reasons: string[] = [];
    if (factors.loyalty >= 6) {
      reasons.push("Already completed this service at the property");
    } else if (factors.loyalty > 0) {
      reasons.push("Already familiar with this property");
    }
    if (suggestedSlot) {
      reasons.push("Open route window available");
    }
    if (
      matchedCategories.length === payload.categories.length &&
      payload.categories.length > 0 &&
      (payload.categories.length > 1 || factors.specialization < 7)
    ) {
      reasons.push(
        payload.categories.length > 1 ? "Covers all requested services" : "Matches the requested service"
      );
    }
    if (factors.specialization >= 7) {
      reasons.push(
        payload.categories.length > 1
          ? "Focused on this mix of services"
          : "Focused on this type of service"
      );
    }
    if (distanceMiles <= 5) {
      reasons.push("Close to the property");
    }
    if (provider.timelinessRating >= 4.8) {
      reasons.push("High punctuality rating");
    }
    if (providerDecisionCount >= 5 && (providerAcceptanceRate ?? 0) >= 0.9) {
      reasons.push("Usually accepts matching requests");
    }
    if (nonRequestedActiveBookings.length >= 5 && lateNoticeRate <= 0.08) {
      reasons.push("Rarely sends late updates");
    }
    if (providerEconomics.status === "healthy") {
      reasons.push("Meets provider-economics guardrails");
    } else if (providerEconomics.status === "at-risk") {
      reasons.push("Provider payout needs ops review");
    }
    if (provider.rating >= 4.8 && provider.reviewCount >= 50) {
      reasons.push("Strong reliability and review history");
    }
    if (provider.yearsExperience >= 10) {
      reasons.push("Deep local experience");
    }
    if (provider.sponsoredListingEnabled) {
      reasons.push("Sponsored placement");
    }
    if (reasons.length === 0) {
      reasons.push("Serves this property area");
    }

    const availabilityConfidence = suggestedSlot
      ? nearbyCompletedBookings >= 5 || distanceMiles <= 6
        ? "high"
        : "medium"
      : "low";
    const availabilityConfidenceLabel =
      availabilityConfidence === "high"
        ? "High confidence in this window"
        : availabilityConfidence === "medium"
          ? "Good chance this window holds"
          : "No live route window right now";
    const hasWeakOperationalSignals =
      providerDecisionCount >= 5 && (providerAcceptanceRate ?? 1) < 0.75
        ? true
        : nonRequestedActiveBookings.length >= 5 && lateNoticeRate > 0.2;
    const reliabilityLabel =
      factors.issuePenalty >= 5 ||
      provider.timelinessRating < 4.4 ||
      provider.rating < 4.4 ||
      hasWeakOperationalSignals
        ? "Reliability record trails the top match"
        : provider.rating >= 4.85 &&
            provider.timelinessRating >= 4.8 &&
            (provider.reviewCount >= 50 || completedBookings >= 25) &&
            factors.issuePenalty === 0 &&
            factors.operationalReliability >= 10
          ? "Proven dependable track record"
        : provider.rating >= 4.7 &&
            provider.timelinessRating >= 4.7 &&
            (provider.reviewCount >= 20 || completedBookings >= 10) &&
            factors.issuePenalty <= 2 &&
            factors.operationalReliability >= 8
            ? "Consistently strong service history"
          : provider.reviewCount >= 5 || completedBookings >= 3
              ? "Solid early reliability signs"
              : "Still building a YardMatch track record";
    const reliabilityDetail =
      factors.issuePenalty >= 5 || provider.timelinessRating < 4.4 || provider.rating < 4.4 || hasWeakOperationalSignals
        ? `${provider.companyName} still qualifies for the area, but GreenRain ranks it below the top recommendation because its recent reliability signals are weaker${
            providerDecisionCount >= 5 && (providerAcceptanceRate ?? 1) < 0.75
              ? ", including a higher recent request-decline rate"
              : nonRequestedActiveBookings.length >= 5 && lateNoticeRate > 0.2
                ? ", including more late updates than the strongest matches"
                : ""
          }.`
        : provider.rating >= 4.85 &&
            provider.timelinessRating >= 4.8 &&
            (provider.reviewCount >= 50 || completedBookings >= 25) &&
            factors.issuePenalty === 0 &&
            factors.operationalReliability >= 10
          ? `${provider.companyName} pairs strong reviews with on-time performance, a larger completed-job history, and steady booking follow-through.`
          : provider.rating >= 4.7 &&
              provider.timelinessRating >= 4.7 &&
              (provider.reviewCount >= 20 || completedBookings >= 10) &&
              factors.issuePenalty <= 2 &&
              factors.operationalReliability >= 8
            ? `${provider.companyName} has a healthy mix of customer reviews, punctuality, completed work history, and stable booking follow-through.`
            : provider.reviewCount >= 5 || completedBookings >= 3
              ? `${provider.companyName} has enough completed work and customer feedback to show encouraging reliability signs, even if the history is lighter than the top match.`
              : `${provider.companyName} is still building up more completed work and customer feedback on YardMatch.`;
    const neighborhoodFamiliarityLabel =
      nearbyCompletedBookings >= 10
        ? "Works this area every week"
        : nearbyCompletedBookings >= 4
          ? "Knows this neighborhood well"
          : nearbyCompletedBookings >= 1
            ? "Has already served this area"
            : "Ready to take work in this area";
    const neighborhoodFamiliarityDetail =
      nearbyCompletedBookings >= 1
        ? `${provider.companyName} has completed ${nearbyCompletedBookings} YardMatch job${
            nearbyCompletedBookings === 1 ? "" : "s"
          } in ${payload.address.city}.`
        : `${provider.companyName} serves ${payload.address.city} within a ${provider.serviceRadiusMiles}-mile route radius.`;

    return {
      provider,
      score,
      distanceMiles: Number(distanceMiles.toFixed(1)),
      hasOpenSlot: Boolean(suggestedSlot),
      suggestedSlot,
      reasons: reasons.slice(0, 3),
      completedJobCount: completedBookings,
      nearbyCompletedJobCount: nearbyCompletedBookings,
      availabilityConfidence,
      availabilityConfidenceLabel,
      reliabilityLabel,
      reliabilityDetail,
      selectionSummaryLabel: "Qualified match for this property",
      selectionSummaryDetail: `${provider.companyName} serves the area and meets the baseline fit requirements for this request.`,
      neighborhoodFamiliarityLabel,
      neighborhoodFamiliarityDetail,
      serviceFitSummary,
      providerEconomics,
      factors
    };
  }

  private buildProviderServiceFitSearchSummary(
    payload: SearchProvidersRequest,
    provider: ProviderProfile,
    matchedCategories: SearchProvidersRequest["categories"]
  ): ProviderServiceFitSearchSummary {
    const requestedCategories = Array.from(new Set(payload.categories));
    const uniqueMatchedCategories = requestedCategories.filter((category) => matchedCategories.includes(category));
    const missingCategories = requestedCategories.filter((category) => !uniqueMatchedCategories.includes(category));
    const status: ProviderServiceFitSearchSummary["status"] = missingCategories.length === 0 ? "complete" : "partial";
    const requestedLabel = requestedCategories.map((category) => this.titleCaseCategory(category).toLowerCase());
    const matchedLabel = uniqueMatchedCategories.map((category) => this.titleCaseCategory(category).toLowerCase());
    const missingLabel = missingCategories.map((category) => this.titleCaseCategory(category).toLowerCase());

    return {
      requestedCategories,
      matchedCategories: uniqueMatchedCategories,
      missingCategories,
      status,
      label:
        status === "complete"
          ? requestedCategories.length > 1
            ? "Covers the full service mix"
            : "Matches the requested service"
          : "Partial service fit",
      detail:
        status === "complete"
          ? requestedCategories.length > 1
            ? `${provider.companyName} can handle ${this.formatListForSentence(requestedLabel)} in one managed request, so YardMatch does not need to split the job across providers.`
            : `${provider.companyName} supports ${requestedLabel[0] ?? "this service"} for this property.`
          : `${provider.companyName} supports ${this.formatListForSentence(
              matchedLabel
            )}, but ${this.formatListForSentence(missingLabel)} would still need another provider or ops follow-up.`
    };
  }

  private buildProviderEconomicsSearchSummary(
    payload: SearchProvidersRequest,
    distanceMiles: number,
    matchedCategories: SearchProvidersRequest["categories"]
  ): ProviderEconomicsSearchSummary {
    const economicsCategories = Array.from(
      new Set(matchedCategories.length > 0 ? matchedCategories : payload.categories)
    );
    const categories: SearchProvidersRequest["categories"] =
      economicsCategories.length > 0 ? economicsCategories : ["lawn-mowing"];
    const durationMinutes = Math.max(
      payload.estimatedDurationMinutes ?? this.getProviderEconomicsDefaultDurationForCategories(categories),
      30
    );
    const estimatedCustomerPriceCents = this.estimateSearchCustomerPriceCentsForCategories(categories, durationMinutes);
    const estimatedProviderNetCents = Math.round(estimatedCustomerPriceCents * 0.72);
    const routeBurdenCents = Math.max(0, Math.round((distanceMiles - 6) * 140));
    const minimumRecommendedPayoutCents =
      this.getProviderEconomicsCategoryFloorCentsForCategories(categories) +
      Math.round(durationMinutes * this.getProviderEconomicsMinuteFloorCentsForCategories(categories)) +
      routeBurdenCents;
    const ratio = estimatedProviderNetCents / Math.max(minimumRecommendedPayoutCents, 1);
    const status: ProviderEconomicsSearchSummary["status"] =
      ratio >= 1.18 ? "healthy" : ratio >= 1 ? "watch" : "at-risk";
    const scopeLabel = categories.length > 1 ? "service mix" : "category";
    const label =
      status === "healthy"
        ? "Healthy provider payout"
        : status === "watch"
          ? "Payout margin needs watching"
          : "Provider payout needs ops review";
    const detail =
      status === "healthy"
        ? `Estimated provider net ${this.formatCentsForOps(estimatedProviderNetCents)} clears the ${this.formatCentsForOps(minimumRecommendedPayoutCents)} launch payout floor for this ${scopeLabel}, duration, and route.`
        : status === "watch"
          ? `Estimated provider net ${this.formatCentsForOps(estimatedProviderNetCents)} is close to the ${this.formatCentsForOps(minimumRecommendedPayoutCents)} launch payout floor for this ${scopeLabel}, so avoid discounting this request without an ops review.`
          : `Estimated provider net ${this.formatCentsForOps(estimatedProviderNetCents)} is below the ${this.formatCentsForOps(minimumRecommendedPayoutCents)} launch payout floor for this ${scopeLabel}, so ops should review pricing before pushing this match.`;

    return {
      estimatedProviderNetCents,
      minimumRecommendedPayoutCents,
      status,
      label,
      detail
    };
  }

  private getProviderEconomicsDefaultDurationForCategories(
    categories: SearchProvidersRequest["categories"]
  ): number {
    if (categories.length <= 1) {
      return this.getProviderEconomicsDefaultDuration(categories[0] ?? "lawn-mowing");
    }

    const combinedDuration = categories.reduce(
      (total, category) => total + this.getProviderEconomicsDefaultDuration(category),
      0
    );
    return Math.round(combinedDuration * 0.82);
  }

  private getProviderEconomicsDefaultDuration(
    category: SearchProvidersRequest["categories"][number]
  ): number {
    const defaults: Record<SearchProvidersRequest["categories"][number], number> = {
      "lawn-mowing": 60,
      "hedge-trimming": 90,
      "mulch-installation": 150,
      "seasonal-cleanup": 150,
      "weed-control": 60,
      "irrigation-check": 75,
      "leaf-blowing": 60,
      "aeration": 90,
      "fertilization": 60,
      "gutter-cleaning": 90,
      "snow-shoveling": 60,
      "ice-melt-salting": 45,
      "snow-blowing": 60
    };
    return defaults[category];
  }

  private estimateSearchCustomerPriceCents(
    category: SearchProvidersRequest["categories"][number],
    durationMinutes: number
  ): number {
    return this.getSearchCustomerTripBaseCents(category) + durationMinutes * 95;
  }

  private estimateSearchCustomerPriceCentsForCategories(
    categories: SearchProvidersRequest["categories"],
    durationMinutes: number
  ): number {
    if (categories.length <= 1) {
      return this.estimateSearchCustomerPriceCents(categories[0] ?? "lawn-mowing", durationMinutes);
    }

    const sortedBaseCents = categories
      .map((category) => this.getSearchCustomerTripBaseCents(category))
      .sort((left, right) => right - left);
    const combinedBaseCents =
      (sortedBaseCents[0] ?? 2800) +
      sortedBaseCents.slice(1).reduce((total, baseCents) => total + Math.round(baseCents * 0.45), 0);
    return combinedBaseCents + durationMinutes * 95;
  }

  private getSearchCustomerTripBaseCents(category: SearchProvidersRequest["categories"][number]): number {
    const tripBaseByCategory: Record<SearchProvidersRequest["categories"][number], number> = {
      "lawn-mowing": 2800,
      "hedge-trimming": 4200,
      "mulch-installation": 6500,
      "seasonal-cleanup": 5200,
      "weed-control": 3000,
      "irrigation-check": 3900,
      "leaf-blowing": 2400,
      "aeration": 3600,
      "fertilization": 3300,
      "gutter-cleaning": 5200,
      "snow-shoveling": 2600,
      "ice-melt-salting": 2400,
      "snow-blowing": 3000
    };
    return tripBaseByCategory[category];
  }

  private getProviderEconomicsCategoryFloorCents(
    category: SearchProvidersRequest["categories"][number]
  ): number {
    const floors: Record<SearchProvidersRequest["categories"][number], number> = {
      "lawn-mowing": 2600,
      "hedge-trimming": 3600,
      "mulch-installation": 5600,
      "seasonal-cleanup": 4600,
      "weed-control": 2600,
      "irrigation-check": 3400,
      "leaf-blowing": 2400,
      "aeration": 3400,
      "fertilization": 3000,
      "gutter-cleaning": 4400,
      "snow-shoveling": 2600,
      "ice-melt-salting": 2400,
      "snow-blowing": 2800
    };
    return floors[category];
  }

  private getProviderEconomicsCategoryFloorCentsForCategories(
    categories: SearchProvidersRequest["categories"]
  ): number {
    if (categories.length <= 1) {
      return this.getProviderEconomicsCategoryFloorCents(categories[0] ?? "lawn-mowing");
    }

    const sortedFloors = categories
      .map((category) => this.getProviderEconomicsCategoryFloorCents(category))
      .sort((left, right) => right - left);
    return (
      (sortedFloors[0] ?? 2600) +
      sortedFloors.slice(1).reduce((total, floorCents) => total + Math.round(floorCents * 0.5), 0)
    );
  }

  private getProviderEconomicsMinuteFloorCents(
    category: SearchProvidersRequest["categories"][number]
  ): number {
    const minuteFloors: Record<SearchProvidersRequest["categories"][number], number> = {
      "lawn-mowing": 20,
      "hedge-trimming": 24,
      "mulch-installation": 28,
      "seasonal-cleanup": 26,
      "weed-control": 20,
      "irrigation-check": 24,
      "leaf-blowing": 19,
      "aeration": 22,
      "fertilization": 20,
      "gutter-cleaning": 25,
      "snow-shoveling": 21,
      "ice-melt-salting": 20,
      "snow-blowing": 22
    };
    return minuteFloors[category];
  }

  private getProviderEconomicsMinuteFloorCentsForCategories(
    categories: SearchProvidersRequest["categories"]
  ): number {
    return Math.max(
      ...categories.map((category) => this.getProviderEconomicsMinuteFloorCents(category)),
      this.getProviderEconomicsMinuteFloorCents("lawn-mowing")
    );
  }

  private formatCentsForOps(cents: number): string {
    return `$${Math.round(cents / 100)}`;
  }

  private formatListForSentence(items: string[]): string {
    if (items.length === 0) {
      return "the requested services";
    }

    if (items.length === 1) {
      return items[0];
    }

    if (items.length === 2) {
      return `${items[0]} and ${items[1]}`;
    }

    return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
  }

  private withCustomerSelectionSummaries(
    rankedProviders: SearchProviderResult[]
  ): SearchProviderResult[] {
    if (rankedProviders.length === 0) {
      return rankedProviders;
    }

    const topResult = rankedProviders[0];
    const nextResult = rankedProviders[1];

    return rankedProviders.map((result, index) => {
      if (index === 0) {
        return {
          ...result,
          ...this.buildTopSelectionSummary(result, nextResult)
        };
      }

      return {
        ...result,
        ...this.buildAlternativeSelectionSummary(result, topResult)
      };
    });
  }

  private buildTopSelectionSummary(
    result: SearchProviderResult,
    nextResult?: SearchProviderResult
  ): Pick<SearchProviderResult, "selectionSummaryLabel" | "selectionSummaryDetail"> {
    const strengths: string[] = [];

    if (result.hasOpenSlot && !nextResult?.hasOpenSlot) {
      strengths.push("it has a real route opening when nearby backups do not");
    } else if (result.hasOpenSlot) {
      strengths.push("it has a real route opening for this request");
    }

    if ((nextResult?.factors.serviceFit ?? 0) + 3 <= result.factors.serviceFit) {
      strengths.push("its service fit is materially stronger than the next backup");
    } else if ((nextResult?.factors.specialization ?? 0) + 2 <= result.factors.specialization) {
      strengths.push("it is more focused on this kind of work");
    }

    if ((nextResult?.factors.reliability ?? 0) + 5 <= result.factors.reliability) {
      strengths.push("its reliability signals are stronger than the next option");
    } else if (result.reliabilityLabel === "Proven dependable track record") {
      strengths.push("its review and punctuality history is unusually strong");
    }

    if ((nextResult?.factors.operationalReliability ?? 0) + 3 <= result.factors.operationalReliability) {
      strengths.push("it has steadier booking follow-through than the next option");
    }

    if (nextResult && nextResult.distanceMiles - result.distanceMiles >= 2) {
      strengths.push("it is meaningfully closer to the property");
    }

    if (nextResult && result.nearbyCompletedJobCount - nextResult.nearbyCompletedJobCount >= 3) {
      strengths.push("it has deeper nearby service history");
    }

    if (strengths.length === 0) {
      strengths.push("it gives the best combined balance of fit, trust, and route efficiency");
    }

    const summaryLabel =
      result.factors.loyalty >= 6
        ? "Trusted repeat-provider match"
        : result.hasOpenSlot && strengths.some((strength) => strength.includes("route opening"))
        ? "Best mix of trust and bookable availability"
        : strengths.some((strength) => strength.includes("reliability"))
          ? "Strongest overall trust signal"
          : strengths.some((strength) => strength.includes("service fit"))
            ? "Best fit for this request"
            : "Best overall match for this property";

    return {
      selectionSummaryLabel: summaryLabel,
      selectionSummaryDetail: `GreenRain recommended ${result.provider.companyName} because ${strengths
        .slice(0, 3)
        .join(", ")}.`
    };
  }

  private buildAlternativeSelectionSummary(
    result: SearchProviderResult,
    topResult: SearchProviderResult
  ): Pick<SearchProviderResult, "selectionSummaryLabel" | "selectionSummaryDetail"> {
    const tradeoffs: string[] = [];

    if (!result.hasOpenSlot && topResult.hasOpenSlot) {
      tradeoffs.push("the recommendation has the cleaner route opening");
    }
    if (topResult.factors.reliability - result.factors.reliability >= 5) {
      tradeoffs.push("the recommendation has stronger reliability signals");
    }
    if (topResult.factors.operationalReliability - result.factors.operationalReliability >= 3) {
      tradeoffs.push("the recommendation has steadier booking follow-through");
    }
    if (topResult.factors.serviceFit - result.factors.serviceFit >= 3) {
      tradeoffs.push("the recommendation is a tighter service-fit match");
    }
    if (result.distanceMiles - topResult.distanceMiles >= 2) {
      tradeoffs.push("the recommendation is closer to the property");
    }
    if (topResult.nearbyCompletedJobCount - result.nearbyCompletedJobCount >= 3) {
      tradeoffs.push("the recommendation has deeper nearby route history");
    }
    if (result.factors.loyalty >= 6 && topResult.factors.loyalty === 0) {
      tradeoffs.push("GreenRain found a stronger current recommendation even though you have history with this provider");
    }

    const fallbackStrengths: string[] = [];
    if (result.hasOpenSlot) {
      fallbackStrengths.push("it still has a bookable route opening");
    }
    if (result.factors.specialization >= topResult.factors.specialization) {
      fallbackStrengths.push("it is still focused on this kind of work");
    }
    if (result.factors.reliability >= topResult.factors.reliability - 2) {
      fallbackStrengths.push("its trust profile is still competitive");
    }
    if (fallbackStrengths.length === 0) {
      fallbackStrengths.push("it still serves the area and fits the request");
    }

    const summaryLabel =
      result.factors.loyalty >= 6
        ? "Past provider, but not the top recommendation"
        : tradeoffs.length > 0
          ? "Why it ranks behind the recommendation"
          : "Still a qualified fallback";
    const summaryDetail =
      tradeoffs.length > 0
        ? `${result.provider.companyName} remains qualified, but GreenRain kept it behind the main recommendation because ${tradeoffs
            .slice(0, 2)
            .join(" and ")}.`
        : `${result.provider.companyName} still works as a fallback because ${fallbackStrengths
            .slice(0, 2)
            .join(" and ")}.`;

    return {
      selectionSummaryLabel: summaryLabel,
      selectionSummaryDetail: summaryDetail
    };
  }

  private buildProviderDecisionMetrics(): Map<string, { confirmations: number; declines: number }> {
    const metrics = new Map<string, { confirmations: number; declines: number }>();

    for (const event of this.analytics.listEvents()) {
      if (
        event.name !== MarketplaceTelemetryEventCatalog.bookingConfirmed &&
        event.name !== MarketplaceTelemetryEventCatalog.bookingDeclinedByProvider
      ) {
        continue;
      }

      if (!event.actorId) {
        continue;
      }

      const current = metrics.get(event.actorId) ?? {
        confirmations: 0,
        declines: 0
      };

      if (event.name === MarketplaceTelemetryEventCatalog.bookingConfirmed) {
        current.confirmations += 1;
      } else {
        current.declines += 1;
      }

      metrics.set(event.actorId, current);
    }

    return metrics;
  }

  private formatBookingWindowWithDate(iso: string): string {
    const dateLabel = new Date(iso).toLocaleDateString([], {
      weekday: "short",
      month: "short",
      day: "numeric"
    });
    return `${dateLabel} • ${formatBookingWindowSummary(iso)}`;
  }

  private formatShortDate(iso: string): string {
    return new Date(iso).toLocaleDateString([], {
      month: "short",
      day: "numeric"
    });
  }

  private isSpringSeasonWindow(date: Date): boolean {
    const month = date.getMonth();
    return month >= 2 && month <= 4;
  }

  private isFallSeasonWindow(date: Date): boolean {
    const month = date.getMonth();
    return month >= 8 && month <= 10;
  }

  private isFallGutterSeasonWindow(date: Date): boolean {
    const month = date.getMonth();
    return month >= 9 && month <= 10;
  }

  private isWinterSeasonWindow(date: Date): boolean {
    const month = date.getMonth();
    return month === 10 || month === 11 || month === 0 || month === 1;
  }

  private isWinterRetentionCategory(category: Booking["category"]): boolean {
    return category === "snow-shoveling" || category === "snow-blowing" || category === "ice-melt-salting";
  }

  private interpolatePoint(
    origin: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number },
    progress: number
  ) {
    return {
      latitude: Number((origin.latitude + (destination.latitude - origin.latitude) * progress).toFixed(6)),
      longitude: Number(
        (origin.longitude + (destination.longitude - origin.longitude) * progress).toFixed(6)
      )
    };
  }

  private async createNotification(
    payload: Omit<AppNotification, "id" | "isRead" | "createdAt">
  ): Promise<AppNotification> {
    const notification = await this.repository.createNotification({
      id: crypto.randomUUID(),
      recipientId: payload.recipientId,
      recipientRole: payload.recipientRole,
      category: payload.category,
      title: payload.title,
      body: payload.body,
      actionHref: payload.actionHref,
      isRead: false,
      createdAt: new Date().toISOString(),
      readAt: undefined
    });

    await this.queueNotificationDeliveries(notification);
    return notification;
  }

  private async ensureNotificationPreferences(
    identity: AuthIdentityRecord
  ): Promise<NotificationPreferences> {
    const existing = await this.repository.getNotificationPreferences(identity.userId);
    if (existing) {
      return existing;
    }

    const nowIso = new Date().toISOString();
    return this.repository.upsertNotificationPreferences({
      userId: identity.userId,
      role: identity.role,
      emailEnabled: true,
      smsEnabled: true,
      pushEnabled: true,
      reviewRemindersEnabled: true,
      updatedAt: nowIso
    });
  }

  private async queueNotificationDeliveries(notification: AppNotification): Promise<void> {
    const identity = await this.repository.findAuthIdentityByUserId(notification.recipientId);
    if (!identity) {
      return;
    }

    const preferences = await this.ensureNotificationPreferences(identity);
    const channels = this.getExternalNotificationChannels(notification.category, preferences);
    if (channels.length === 0) {
      return;
    }

    const destinationProfile = await this.getNotificationDestinationProfile(identity);
    if (!destinationProfile) {
      return;
    }

    await Promise.all(
      channels.map(async (channel) => {
        const delivery = await this.repository.createNotificationDelivery({
          id: crypto.randomUUID(),
          notificationId: notification.id,
          recipientId: notification.recipientId,
          recipientRole: notification.recipientRole,
          category: notification.category,
          channel,
          destination: this.getNotificationDestination(channel, destinationProfile),
          provider: "queued",
          status: "queued",
          title: notification.title,
          bodyPreview: notification.body.slice(0, 160),
          createdAt: new Date().toISOString(),
          attemptCount: 0,
          lastAttemptAt: undefined,
          nextRetryAt: undefined,
          sentAt: undefined,
          errorMessage: undefined
        });

        await this.dispatchNotificationDelivery(delivery);
      })
    );
  }

  private getExternalNotificationChannels(
    category: AppNotification["category"],
    preferences: NotificationPreferences
  ): NotificationChannel[] {
    if (category === "review") {
      return preferences.reviewRemindersEnabled && preferences.pushEnabled ? ["push"] : [];
    }

    const channels: NotificationChannel[] = [];
    if (preferences.pushEnabled) {
      channels.push("push");
    }
    if (preferences.emailEnabled) {
      channels.push("email");
    }
    if (preferences.smsEnabled && (category === "booking" || category === "staffing" || category === "support")) {
      channels.push("sms");
    }
    return channels;
  }

  private async getNotificationDestinationProfile(identity: AuthIdentityRecord): Promise<{
    email: string;
    phone: string;
    pushTokens: string[];
  } | undefined> {
    const pushTokens = (
      await this.repository.listActivePushDevicesByRecipient(identity.userId, identity.role as PushDevice["role"])
    ).map((device) => device.token);

    if (identity.role === "customer") {
      const customer = await this.repository.findCustomerById(identity.userId);
      if (!customer) {
        return undefined;
      }
      return {
        email: customer.email,
        phone: customer.phone,
        pushTokens
      };
    }

    if (identity.role === "provider") {
      const provider = await this.repository.findProviderById(identity.userId);
      if (!provider) {
        return undefined;
      }
      return {
        email: provider.email,
        phone: provider.phone,
        pushTokens
      };
    }

    const crewMember = await this.repository.findCrewMemberById(identity.userId);
    if (!crewMember) {
      return undefined;
    }

    return {
      email: crewMember.email,
      phone: crewMember.phone,
      pushTokens
    };
  }

  private getNotificationDestination(
    channel: NotificationChannel,
    profile: { email: string; phone: string; pushTokens: string[] }
  ): string {
    if (channel === "email") {
      return profile.email;
    }

    if (channel === "sms") {
      return profile.phone;
    }

    return profile.pushTokens[0] ?? "local-device";
  }

  private async dispatchNotificationDelivery(delivery: NotificationDeliveryRecord): Promise<void> {
    const attemptCount = delivery.attemptCount + 1;
    const lastAttemptAt = new Date().toISOString();
    try {
      const dispatch = await this.notificationDelivery.dispatch({
        channel: delivery.channel,
        destination: delivery.destination,
        title: delivery.title,
        body: delivery.bodyPreview
      });

      await this.repository.updateNotificationDelivery(delivery.id, {
        provider: dispatch.provider,
        status: "sent",
        attemptCount,
        lastAttemptAt,
        nextRetryAt: undefined,
        sentAt: dispatch.sentAt,
        errorMessage: undefined
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Notification delivery failed.";
      const shouldRetry = this.shouldRetryNotificationDelivery(delivery.channel, delivery.destination, attemptCount);
      await this.repository.updateNotificationDelivery(delivery.id, {
        provider: this.getFailedDeliveryProvider(delivery.channel, delivery.destination),
        status: "failed",
        attemptCount,
        lastAttemptAt,
        nextRetryAt: shouldRetry ? this.buildNotificationRetryAt(attemptCount) : undefined,
        errorMessage
      });
    }
  }

  private getFailedDeliveryProvider(channel: NotificationChannel, destination: string): string {
    return this.notificationDelivery.getProviderName(channel, destination);
  }

  private shouldRetryNotificationDelivery(
    channel: NotificationChannel,
    destination: string,
    attemptCount: number
  ): boolean {
    return attemptCount < 3 && this.notificationDelivery.supportsRetry(channel, destination);
  }

  private buildNotificationRetryAt(attemptCount: number): string {
    const retryMinutes = attemptCount === 1 ? 1 : attemptCount === 2 ? 5 : 15;
    return new Date(Date.now() + retryMinutes * 60 * 1000).toISOString();
  }

  private async listDueNotificationDeliveries(): Promise<NotificationDeliveryRecord[]> {
    return (await this.repository.listAllNotificationDeliveries()).filter(
      (delivery) =>
        delivery.status === "failed" &&
        delivery.nextRetryAt &&
        Date.parse(delivery.nextRetryAt) <= Date.now()
    );
  }

  private async retryDueNotificationDeliveries(identity: AuthIdentityRecord): Promise<void> {
    const deliveries = (await this.listDueNotificationDeliveries()).filter(
      (delivery) => delivery.recipientId === identity.userId && delivery.recipientRole === identity.role
    );

    await Promise.all(deliveries.map((delivery) => this.dispatchNotificationDelivery(delivery)));
  }

  private buildNotificationOpsChannelHealth(
    deliveries: NotificationDeliveryRecord[],
    now: number,
    last24Hours: number
  ): NotificationOpsChannelHealth[] {
    const groups = new Map<string, NotificationOpsChannelHealth>();

    for (const delivery of deliveries) {
      const key = `${delivery.channel}:${delivery.provider}`;
      const existing = groups.get(key) ?? {
        channel: delivery.channel,
        provider: delivery.provider,
        totalDeliveries: 0,
        deliveriesLast24Hours: 0,
        sentCount: 0,
        failedCount: 0,
        queuedCount: 0,
        pendingRetryCount: 0,
        overdueRetryCount: 0,
        lastAttemptAt: undefined
      };

      existing.totalDeliveries += 1;
      if (Date.parse(delivery.createdAt) >= last24Hours) {
        existing.deliveriesLast24Hours += 1;
      }
      if (delivery.status === "sent") {
        existing.sentCount += 1;
      }
      if (delivery.status === "failed") {
        existing.failedCount += 1;
      }
      if (delivery.status === "queued") {
        existing.queuedCount += 1;
      }
      if (delivery.nextRetryAt) {
        existing.pendingRetryCount += 1;
        if (Date.parse(delivery.nextRetryAt) <= now) {
          existing.overdueRetryCount += 1;
        }
      }

      const candidateAttemptAt = delivery.lastAttemptAt ?? delivery.sentAt ?? delivery.createdAt;
      if (!existing.lastAttemptAt || candidateAttemptAt > existing.lastAttemptAt) {
        existing.lastAttemptAt = candidateAttemptAt;
      }

      groups.set(key, existing);
    }

    return [...groups.values()].sort((left, right) => {
      if (right.failedCount !== left.failedCount) {
        return right.failedCount - left.failedCount;
      }
      return right.totalDeliveries - left.totalDeliveries;
    });
  }

  private buildNotificationOpsAlerts(input: {
    deliveriesLast24Hours: number;
    failedLast24Hours: number;
    pendingRetryCount: number;
    overdueRetryCount: number;
    exhaustedFailureCount: number;
    channels: NotificationOpsChannelHealth[];
    deliveryPolicy: NotificationOpsDeliveryPolicy;
  }): NotificationOpsAlert[] {
    const alerts: NotificationOpsAlert[] = [];
    const opsAlertTargets = this.notificationDelivery.getOpsAlertTargets();

    if (input.overdueRetryCount > 0) {
      alerts.push({
        severity: "critical",
        title: "Overdue notification retries need attention",
        detail: `${input.overdueRetryCount} delivery attempt${input.overdueRetryCount === 1 ? "" : "s"} should have retried already but are still waiting.`
      });
    }

    if (input.exhaustedFailureCount > 0) {
      alerts.push({
        severity: "warning",
        title: "Some deliveries exhausted retry attempts",
        detail: `${input.exhaustedFailureCount} delivery failure${input.exhaustedFailureCount === 1 ? "" : "s"} no longer have a retry scheduled and may need manual follow-up.`
      });
    }

    const noisyChannels = input.channels.filter((channel) => channel.failedCount >= 3 || channel.overdueRetryCount > 0);
    if (noisyChannels.length > 0) {
      alerts.push({
        severity: "warning",
        title: "One or more delivery channels are noisy",
        detail: noisyChannels
          .slice(0, 3)
          .map(
            (channel) =>
              `${channel.provider} ${channel.channel} (${channel.failedCount} failed${channel.overdueRetryCount > 0 ? `, ${channel.overdueRetryCount} overdue` : ""})`
          )
          .join(" • ")
      });
    }

    const mockProviders = [...new Set(input.channels.filter((channel) => channel.provider.startsWith("mock-")).map((channel) => channel.provider))];
    if (mockProviders.length > 0) {
      alerts.push({
        severity: "info",
        title: "Mock notification providers are still active",
        detail: `${mockProviders.join(", ")} are still being used in this environment, so those channels are not yet production-grade.`
      });
    }

    const mockFallbackChannels = input.deliveryPolicy.channelPolicies.filter(
      (policy) => policy.readinessStatus === "mock-fallback"
    );
    if (mockFallbackChannels.length > 0) {
      alerts.push({
        severity: "warning",
        title: "Production notification channels need configuration",
        detail: mockFallbackChannels
          .map((policy) => `${policy.channel}: ${policy.missingConfiguration.join(", ")}`)
          .join(" • ")
      });
    }

    if (
      opsAlertTargets.length === 0 &&
      (alerts.some((alert) => alert.severity === "warning" || alert.severity === "critical") ||
        !input.deliveryPolicy.opsAlertTargetsConfigured)
    ) {
      alerts.push({
        severity: "warning",
        title: "No external ops alert targets are configured",
        detail: "Set NOTIFICATION_ALERT_EMAILS or NOTIFICATION_ALERT_SMS_NUMBERS so critical delivery problems can reach ops outside the dashboard."
      });
    }

    if (alerts.length === 0) {
      const failureRate =
        input.deliveriesLast24Hours > 0 ? Math.round((input.failedLast24Hours / input.deliveriesLast24Hours) * 100) : 0;
      alerts.push({
        severity: "info",
        title: "Delivery health looks stable",
        detail:
          input.deliveriesLast24Hours > 0
            ? `${input.failedLast24Hours} failed out of ${input.deliveriesLast24Hours} deliveries in the last 24 hours (${failureRate}% failure rate), with ${input.pendingRetryCount} retryable item${input.pendingRetryCount === 1 ? "" : "s"} in flight.`
            : "No notification deliveries have been recorded in the last 24 hours."
      });
    }

    return alerts;
  }

  private async ensureTimedNotifications(identity: AuthIdentityRecord): Promise<void> {
    if (identity.role !== "provider") {
      return;
    }

    await Promise.all([
      this.ensureProviderDepartureReminders(identity.userId),
      this.ensureProviderStaffingReviewReminders(identity.userId)
    ]);
  }

  private async ensureProviderDepartureReminders(providerId: string): Promise<void> {
    const [provider, bookings, notifications] = await Promise.all([
      this.repository.findProviderById(providerId),
      this.repository.listBookings(),
      this.repository.listNotificationsByRecipient(providerId)
    ]);

    if (!provider) {
      return;
    }

    const now = Date.now();
    const existingReminderActions = new Set(
      notifications
        .filter((notification) => notification.recipientRole === "provider")
        .map((notification) => notification.actionHref)
        .filter((actionHref): actionHref is string => Boolean(actionHref))
    );

    await Promise.all(
      bookings
        .filter(
          (booking) =>
            booking.providerId === providerId &&
            booking.status === "confirmed" &&
            !booking.onRouteConfirmedAt
        )
        .map(async (booking) => {
          const scheduledStart = new Date(booking.scheduledStartIso).getTime();
          const minutesUntilStart = Math.round((scheduledStart - now) / (1000 * 60));
          if (minutesUntilStart < 0 || minutesUntilStart > provider.departureReminderLeadMinutes) {
            return;
          }

          const actionHref = `/provider/management?bookingId=${booking.id}&reminder=departure`;
          if (existingReminderActions.has(actionHref)) {
            return;
          }

          const customer = await this.repository.findCustomerById(booking.customerId);
          const leadText =
            minutesUntilStart <= 15
              ? `Leave now for ${customer?.fullName ?? "your next customer"}.`
              : `Plan to head out in about ${minutesUntilStart} minutes.`;

          await this.createNotification({
            recipientId: providerId,
            recipientRole: "provider",
            category: "booking",
            title: "Time to head out soon",
            body: `${leadText} ${booking.serviceAddress.line1} • ${this.formatBookingWindowWithDate(booking.scheduledStartIso)}`,
            actionHref
          });
        })
    );
  }

  private async ensureProviderStaffingReviewReminders(providerId: string): Promise<void> {
    const [provider, bookings, notifications, matches, customers] = await Promise.all([
      this.repository.findProviderById(providerId),
      this.repository.listBookings(),
      this.repository.listNotificationsByRecipient(providerId),
      this.repository.listCrewMatches(),
      this.repository.listCustomers()
    ]);

    if (!provider || provider.staffingMode !== "review-first") {
      return;
    }

    const now = Date.now();
    const existingReminderActions = new Set(
      notifications
        .filter((notification) => notification.recipientRole === "provider")
        .map((notification) => notification.actionHref)
        .filter((actionHref): actionHref is string => Boolean(actionHref))
    );

    await Promise.all(
      bookings
        .filter(
          (booking) =>
            booking.providerId === providerId &&
            (booking.status === "requested" || booking.status === "confirmed") &&
            !booking.onRouteConfirmedAt
        )
        .map(async (booking) => {
          const scheduledStart = new Date(booking.scheduledStartIso).getTime();
          const hoursUntilStart = (scheduledStart - now) / (1000 * 60 * 60);
          if (hoursUntilStart < 0 || hoursUntilStart > provider.crewReviewLeadHours) {
            return;
          }

          const actionHref = `/provider/management?bookingId=${booking.id}&reminder=staffing`;
          if (existingReminderActions.has(actionHref)) {
            return;
          }

          const customer = customers.find((item) => item.id === booking.customerId);
          const bookingMatches = matches.filter((match) => match.bookingId === booking.id);
          const acceptedCount = bookingMatches.filter((match) => match.status === "accepted").length;
          const pendingCount = bookingMatches.filter((match) => match.status === "pending-provider-review").length;
          const requiredCrewMembers = this.estimateRequiredCrewMembers(
            booking,
            customer?.properties.find((property) => property.id === booking.servicePropertyId)
          );
          const crewGap = Math.max(requiredCrewMembers - acceptedCount, 0);

          if (pendingCount === 0 || crewGap === 0) {
            return;
          }

          await this.createNotification({
            recipientId: providerId,
            recipientRole: "provider",
            category: "staffing",
            title: "Review crew staffing soon",
            body: `${pendingCount} pending crew match${pendingCount === 1 ? "" : "es"} still need review for ${customer?.fullName ?? "this customer"} • ${crewGap} open slot${crewGap === 1 ? "" : "s"} remaining.`,
            actionHref
          });
        })
    );
  }

  private async ensureProviderCalendarFeedToken(providerId: string): Promise<ProviderProfile> {
    const provider = await this.repository.findProviderById(providerId);
    if (!provider) {
      throw new HttpError(404, "Provider not found");
    }

    if (provider.calendarConnection.feedToken) {
      return provider;
    }

    const updatedProvider = await this.repository.updateProvider(providerId, {
      calendarConnection: {
        ...provider.calendarConnection,
        feedToken: crypto.randomUUID(),
        lastSyncedAt: new Date().toISOString()
      }
    });

    if (!updatedProvider) {
      throw new HttpError(500, "Calendar feed token could not be saved");
    }

    return updatedProvider;
  }

  private async capturePaymentRecord(
    payment: PaymentRecord,
    booking: Booking,
    paymentIntentId?: string
  ): Promise<PaymentRecord> {
    if (payment.status === "captured") {
      return payment;
    }

    const now = new Date().toISOString();
    const updatedPayment = await this.repository.updatePayment(payment.id, {
      status: "captured",
      refundable: true,
      processorPaymentIntentId: paymentIntentId ?? payment.processorPaymentIntentId,
      failureReason: undefined,
      paidAt: payment.paidAt ?? now,
      updatedAt: now
    });

    if (!updatedPayment) {
      throw new HttpError(500, "Payment record could not be updated");
    }

    this.analytics.recordFunnelStep(MarketplaceTelemetryEventCatalog.paymentCaptured, booking.id, {
      paymentId: updatedPayment.id,
      amountCents: updatedPayment.amountCents,
      processor: updatedPayment.processor
    });
    await this.createNotification({
      recipientId: booking.customerId,
      recipientRole: "customer",
      category: "booking",
      title: "Payment received",
      body: "Your YardMatch payment went through successfully.",
      actionHref: "/customer/dashboard"
    });
    await this.createNotification({
      recipientId: booking.providerId,
      recipientRole: "provider",
      category: "booking",
      title: "Customer payment received",
      body: "A customer completed payment for an upcoming YardMatch booking.",
      actionHref: "/provider/management"
    });

    if (booking.status === "completed" && booking.completedAt) {
      await this.ensureBookingFinancialSettlement(booking, updatedPayment);
    }

    return updatedPayment;
  }

  private async failPaymentRecord(
    payment: PaymentRecord,
    booking: Booking,
    failureReason: string,
    failureStage: "checkout-finalize" | "webhook"
  ): Promise<PaymentRecord> {
    if (payment.status === "captured" || payment.status === "refunded") {
      return payment;
    }

    const updatedPayment = await this.repository.updatePayment(payment.id, {
      status: "failed",
      refundable: false,
      failureReason,
      updatedAt: new Date().toISOString()
    });

    if (!updatedPayment) {
      throw new HttpError(500, "Payment record could not be updated");
    }

    this.analytics.recordFunnelStep(MarketplaceTelemetryEventCatalog.paymentFailed, booking.id, {
      paymentId: updatedPayment.id,
      processor: updatedPayment.processor,
      amountCents: updatedPayment.amountCents,
      failureStage,
      failureReasonCategory: this.classifyPaymentFailureReason(failureReason)
    });

    return updatedPayment;
  }

  private classifyPaymentFailureReason(failureReason: string): string {
    const normalizedReason = failureReason.trim().toLowerCase();

    if (normalizedReason.includes("expired")) {
      return "expired";
    }

    if (normalizedReason.includes("not completed") || normalizedReason.includes("not complete")) {
      return "not-completed";
    }

    if (normalizedReason.includes("declin") || normalizedReason.includes("fail")) {
      return "declined-or-failed";
    }

    return "other";
  }

  private estimateCrewHourlyRate(category: Booking["category"]): number {
    const rateByCategory: Record<Booking["category"], number> = {
      "lawn-mowing": 2200,
      "hedge-trimming": 2400,
      "mulch-installation": 2500,
      "seasonal-cleanup": 2300,
      "weed-control": 2200,
      "irrigation-check": 2600,
      "leaf-blowing": 2100,
      "aeration": 2300,
      "fertilization": 2250,
      "gutter-cleaning": 2550,
      "snow-shoveling": 2350,
      "ice-melt-salting": 2300,
      "snow-blowing": 2450
    };

    return rateByCategory[category];
  }

  private isPayoutRelevantBooking(booking: Booking): boolean {
    return (
      booking.status === "completed" ||
      booking.status === "refunded" ||
      (booking.status === "disputed" && Boolean(booking.completedAt))
    );
  }

  private estimateCrewMatchPayoutCents(booking: Booking, hourlyRateCents: number): number {
    const durationHours = Math.max(
      1,
      (Date.parse(booking.scheduledEndIso) - Date.parse(booking.scheduledStartIso)) / (60 * 60 * 1000)
    );
    return Math.round(hourlyRateCents * durationHours);
  }

  private isValidPayoutWeekday(value: string): value is ProviderProfile["weeklyPayoutDay"] {
    return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].includes(value);
  }

  private getNextPayoutRunIso(weekday: CrewAvailabilityDay): string {
    const dayIndexByKey: Record<CrewAvailabilityDay, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6
    };
    const now = new Date();
    const next = new Date(now);
    next.setHours(9, 0, 0, 0);
    const targetDay = dayIndexByKey[weekday];
    const delta = (targetDay - next.getDay() + 7) % 7 || 7;
    next.setDate(next.getDate() + delta);
    return next.toISOString();
  }

  private buildProviderPayoutScheduleSummary(
    provider: ProviderProfile,
    entries: ProviderPayoutLedgerEntry[]
  ): ProviderPayoutLedgerResponse["payoutSchedule"] {
    const instantPayoutEligibleCents = provider.instantPayoutsEnabled
      ? entries
          .filter((entry) => entry.status === "ready")
          .reduce((sum, entry) => sum + entry.providerNetAmountCents, 0)
      : 0;

    return {
      weeklyPayoutDay: provider.weeklyPayoutDay,
      nextWeeklyPayoutDateIso: this.getNextPayoutRunIso(provider.weeklyPayoutDay),
      holdPeriodHours: this.payoutHoldHours,
      instantPayoutsEnabled: provider.instantPayoutsEnabled,
      instantPayoutMinimumCents: this.instantPayoutMinimumCents,
      instantPayoutEligibleCents
    };
  }

  private buildOpsPayoutPolicySummary(): OpsPayoutRunPreviewResponse["payoutPolicy"] {
    return {
      disbursementRailStatus: "manual-preview-only",
      providerHoldPeriodHours: this.payoutHoldHours,
      crewHoldPeriodHours: 0,
      providerWeeklyRunRule:
        "Provider net settlements deduct the versioned YardMatch finder/job fees and are grouped after the post-service hold period. Crew compensation never enters YardMatch payout runs.",
      crewWeeklyPayoutDay: this.crewPayoutWeekday,
      crewCompensationResponsibility: "provider",
      stripeChargePattern: "separate-charges-and-transfers",
      instantPayoutMinimumCents: this.instantPayoutMinimumCents,
      readyRequirements: [
        "booking completed or completed dispute resolved in the provider's favor",
        "customer payment captured",
        "post-service hold period elapsed",
        "immutable booking settlement and balanced ledger entries recorded",
        "provider credentials verified and current",
        "provider Stripe recipient transfers and payouts capabilities active",
        "no open refund review",
        "no active completed-job dispute",
        "payment not refunded"
      ],
      holdReasons: [
        "open refund review",
        "completed booking dispute",
        "customer payment still awaiting capture",
        "provider credentials missing, expired, or pending review",
        "Stripe recipient transfer or payout capability not active",
        "refunded or reversed customer payment"
      ]
    };
  }

  private buildPayoutDisbursementEntryFingerprint(
    batch: OpsPayoutRunPreviewResponse["disbursementBatches"][number]
  ): string {
    const stableEntries = batch.entries
      .map((entry) => ({
        entryId: entry.entryId,
        bookingId: entry.bookingId,
        recipientId: entry.recipientId,
        recipientRole: entry.recipientRole,
        amountCents: entry.amountCents,
        paymentId: entry.paymentId ?? null
      }))
      .sort((left, right) => left.entryId.localeCompare(right.entryId));

    return createHash("sha256").update(JSON.stringify(stableEntries)).digest("hex");
  }

  private buildLaunchOperationsRecommendationFingerprint(
    recommendation: LaunchOperationsCoverageActionRecommendation
  ): string {
    return createHash("sha256")
      .update(
        JSON.stringify({
          key: recommendation.key,
          pocketKey: recommendation.pocketKey,
          postalCode: recommendation.postalCode,
          priority: recommendation.priority,
          owner: recommendation.owner,
          dueWithinHours: recommendation.dueWithinHours,
          relatedScenarioKeys: [...recommendation.relatedScenarioKeys].sort()
        })
      )
      .digest("hex");
  }

  private async resolveLaunchOperationsTaskAssignee(
    opsUserId?: string | null
  ): Promise<OpsProfile | undefined> {
    const trimmedOpsUserId = opsUserId?.trim();
    if (!trimmedOpsUserId) {
      return undefined;
    }
    const assignee = await this.repository.findOpsUserById(trimmedOpsUserId);
    if (!assignee) {
      throw new HttpError(404, "Assigned ops user not found");
    }
    return assignee;
  }

  private sortLaunchOperationsTasks(tasks: LaunchOperationsTask[]): LaunchOperationsTask[] {
    const statusRank: Record<LaunchOperationsTask["status"], number> = {
      open: 0,
      "in-progress": 1,
      blocked: 2,
      completed: 3,
      cancelled: 4
    };
    const priorityRank: Record<LaunchOperationsTask["priority"], number> = {
      urgent: 0,
      high: 1,
      normal: 2
    };
    return [...tasks].sort((left, right) => {
      if (statusRank[left.status] !== statusRank[right.status]) {
        return statusRank[left.status] - statusRank[right.status];
      }
      if (left.dueAtIso !== right.dueAtIso) {
        return left.dueAtIso.localeCompare(right.dueAtIso);
      }
      if (priorityRank[left.priority] !== priorityRank[right.priority]) {
        return priorityRank[left.priority] - priorityRank[right.priority];
      }
      return right.updatedAt.localeCompare(left.updatedAt);
    });
  }

  private getPayoutLedgerStatus(
    booking: Booking,
    payment?: PaymentRecord
  ): ProviderPayoutLedgerEntry["status"] {
    if (booking.status === "refunded" || payment?.status === "refunded") {
      return "reversed";
    }

    if (this.getPayoutHoldReason(booking, payment)) {
      return "on-hold";
    }

    if (payment?.status !== "captured") {
      return "awaiting-customer-payment";
    }

    const completedAtMs = Date.parse(booking.completedAt ?? booking.scheduledEndIso);
    const readyAtMs = completedAtMs + this.payoutHoldHours * 60 * 60 * 1000;
    return readyAtMs <= Date.now() ? "ready" : "scheduled";
  }

  private getPayoutHoldReason(
    booking: Booking,
    payment?: PaymentRecord
  ): "refund-review" | "dispute" | undefined {
    if (payment?.refundReviewStatus === "requested") {
      return "refund-review";
    }

    if (booking.status === "disputed" && booking.completedAt) {
      return "dispute";
    }

    return undefined;
  }

  private getPayoutAvailabilityIso(
    booking: Booking,
    status: ProviderPayoutLedgerEntry["status"]
  ): string | undefined {
    if (status !== "scheduled" && status !== "ready") {
      return undefined;
    }

    return new Date(
      Date.parse(booking.completedAt ?? booking.scheduledEndIso) + this.payoutHoldHours * 60 * 60 * 1000
    ).toISOString();
  }

  private normalizeAddress(address: Address): Address {
    const line1 = this.toTitleCase(this.normalizeAddressText(address.line1));
    const line2 = this.toTitleCase(this.normalizeAddressText(address.line2));
    const city = this.toTitleCase(this.normalizeAddressText(address.city));
    const state = this.normalizeAddressText(address.state).toUpperCase();
    const postalCode = this.normalizePostalCode(address.postalCode);
    const country = this.normalizeAddressText(address.country).toUpperCase();

    return {
      ...address,
      line1,
      line2: line2 || undefined,
      city,
      state,
      postalCode,
      country
    };
  }

  private async normalizeAndValidateAddress(address: Address): Promise<AddressValidationOutcome> {
    const normalizedAddress = this.normalizeAddress(address);
    const validatedAddress = await this.addressValidation.validateAddress(normalizedAddress);
    return {
      ...validatedAddress,
      address: this.normalizeAddress(validatedAddress.address)
    };
  }

  private async normalizeValidateAndResolveCustomerAddress(
    address: Address,
    customer: CustomerProfile | undefined
  ): Promise<AddressValidationOutcome> {
    const validatedAddress = await this.normalizeAndValidateAddress(address);
    if (!customer) {
      return validatedAddress;
    }

    return {
      ...validatedAddress,
      address: await this.resolveSavedPropertyAddress(validatedAddress.address, customer.properties)
    };
  }

  private async resolveSavedPropertyAddress(
    address: Address,
    existingProperties: CustomerProperty[]
  ): Promise<Address> {
    const normalizedAddress = this.normalizeAddress(address);
    const geocodeCacheKey = this.buildAddressGeocodeCacheKey(normalizedAddress);
    const cachedProperty = existingProperties.find((property) => {
      const existingKey =
        property.address.geocodeCacheKey ?? this.buildAddressGeocodeCacheKey(this.normalizeAddress(property.address));
      return existingKey === geocodeCacheKey;
    });

    if (cachedProperty?.address.point) {
      return {
        ...normalizedAddress,
        point: cachedProperty.address.point,
        geocodeCacheKey,
        geocodedAt: cachedProperty.address.geocodedAt,
        geocodePrecision: cachedProperty.address.geocodePrecision,
        geocodeProvider: cachedProperty.address.geocodeProvider
      };
    }

    const alreadyGoogleGeocoded =
      normalizedAddress.geocodeProvider === "google-address-validation" ||
      normalizedAddress.geocodeProvider === "google-geocoding";
    if (alreadyGoogleGeocoded) {
      return {
        ...normalizedAddress,
        geocodeCacheKey
      };
    }

    const googleSuggestion = await this.placeSearch.geocodeAddress(normalizedAddress);
    if (googleSuggestion) {
      return {
        ...normalizedAddress,
        point: googleSuggestion.address.point,
        geocodeCacheKey,
        geocodedAt: googleSuggestion.address.geocodedAt,
        geocodePrecision: googleSuggestion.address.geocodePrecision,
        geocodeProvider: googleSuggestion.address.geocodeProvider
      };
    }

    return {
      ...normalizedAddress,
      geocodeCacheKey,
      geocodedAt: normalizedAddress.geocodedAt ?? new Date().toISOString(),
      geocodePrecision: normalizedAddress.geocodePrecision ?? "customer-provided",
      geocodeProvider: normalizedAddress.geocodeProvider ?? "customer-provided"
    };
  }

  private buildAddressGeocodeCacheKey(address: Address): string {
    return [
      address.line1,
      address.line2 ?? "",
      address.city,
      address.state,
      address.postalCode,
      address.country
    ]
      .map((part) => this.normalizeAddressText(part).toLowerCase())
      .join("|");
  }

  private buildNormalizedAddressSummary(
    original: Address,
    normalized: Address,
    validation?: AddressValidationOutcome
  ) {
    const normalizedFields = (
      [
        ["line1", original.line1, normalized.line1],
        ["line2", original.line2 ?? "", normalized.line2 ?? ""],
        ["city", original.city, normalized.city],
        ["state", original.state, normalized.state],
        ["postalCode", original.postalCode, normalized.postalCode],
        ["country", original.country, normalized.country]
      ] as const
    )
      .filter(([, before, after]) => before !== after)
      .map(([field]) => field);

    return {
      displayLabel: this.formatAddressLine(normalized),
      wasNormalized: normalizedFields.length > 0,
      normalizedFields,
      validationSource: validation?.source,
      validationConfidence: validation?.confidence,
      validationMessage: validation?.message
    };
  }

  private normalizeAddressText(value: string | undefined): string {
    return (value ?? "").trim().replace(/\s+/g, " ");
  }

  private normalizePostalCode(postalCode: string): string {
    const compact = this.normalizeAddressText(postalCode).replace(/\s+/g, "");
    const digits = compact.replace(/[^0-9]/g, "");
    if (digits.length === 9) {
      return `${digits.slice(0, 5)}-${digits.slice(5)}`;
    }

    if (digits.length === 5) {
      return digits;
    }

    return compact.toUpperCase();
  }

  private toTitleCase(value: string): string {
    return value.replace(/\b([a-z])/gi, (segment) => segment.toUpperCase());
  }

  private toSentenceCase(value: string): string {
    if (!value) {
      return value;
    }

    return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
  }

  private formatAddressLine(address: Address): string {
    return `${address.line1}, ${address.city}, ${address.state} ${address.postalCode}`;
  }

  private buildProviderPayoutNote(
    booking: Booking,
    status: ProviderPayoutLedgerEntry["status"],
    payment: PaymentRecord | undefined,
    assignedCrewCount: number
  ): string {
    if (status === "reversed") {
      return "Customer payment was refunded, so provider payout is reversed.";
    }

    if (status === "awaiting-customer-payment") {
      return "Customer payment still needs to clear before provider earnings can settle.";
    }

    if (status === "on-hold") {
      const holdReason = this.getPayoutHoldReason(booking, payment);
      if (holdReason === "dispute") {
        return `A booking dispute is open for this job, so provider payout is on hold. Latest note: ${booking.disputeReason ?? "Support is reviewing the disputed service outcome."}`;
      }

      return `A refund review is open for this booking, so provider payout is on hold. Latest note: ${payment?.refundReason ?? "Refund review requested."}`;
    }

    if (assignedCrewCount === 0) {
      return status === "ready"
        ? "The versioned YardMatch fees have been deducted and the provider settlement is ready. Crew compensation remains the provider business's responsibility."
        : "The versioned YardMatch fees have been deducted and the provider settlement is scheduled. Crew compensation remains the provider business's responsibility.";
    }

    return status === "ready"
      ? `The provider settlement is ready; any crew compensation is paid separately by the provider business. Payment status: ${payment?.status ?? "unknown"}.`
      : `The provider settlement is scheduled; any crew compensation is paid separately by the provider business. Payment status: ${payment?.status ?? "unknown"}.`;
  }

}
