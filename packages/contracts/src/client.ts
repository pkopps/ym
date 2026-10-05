import type { BookingRecoveryOptions, RecoverBookingRequest, ReviewBookingAddressRequest, UpdateBookingAddressResponse, ManageProviderAvailabilityRequest } from "./types";
import type { ZipServiceMinimum, ZipServiceMinimumRecord, UpdateZipServiceMinimumRequest, ProviderServicePrice, ProviderPricingOverview } from "./pricing";
import {
  ProviderAvailabilityRequest,
  AvailabilitySlot,
  UpdateBookingScheduleRequest,
  RespondBookingScheduleRequest,
  AddBookingEvidenceRequest,
  AssignBookingRouteLeaderRequest,
  AnalyticsEvent,
  AccountSecuritySettings,
  AuthenticatedUserEnvelope,
  BeginTwoFactorSetupRequest,
  BeginTwoFactorSetupResponse,
  BookingArrivalTracking,
  Booking,
  BookingListScope,
  BookingPageResponse,
  CancelBookingRequest,
  CancelCrewMatchRequest,
  CancelRecurringServicePlanRequest,
  ClaimPublicCrewOpportunityRequest,
  ConfirmPasswordResetRequest,
  CreateOpsAccountResponse,
  CreateOpsAccountRequest,
  CreateRecurringServicePlanRequest,
  CreateRecurringServicePlanResponse,
  CompleteSocialSignupRequest,
  ConfirmBookingRequest,
  DeclineBookingRequest,
  CustomerProviderConversation,
  CustomerProviderConversationThread,
  CrewMemberProfile,
  CrewMatchCandidate,
  CompleteBookingRequest,
  CreateCheckoutSessionRequest,
  CreateCheckoutSessionResponse,
  CreateBookingDisputeRequest,
  CreateExternalCalendarImportRequest,
  CreateInboundEmailLaunchLeadRequest,
  CreateInboundGoogleBusinessProfileReviewResponseRequest,
  CreateInboundReviewResponseRequest,
  CreateInboundSharedInboxReviewResponseRequest,
  CreateInboundGoogleBusinessProfileLeadRequest,
  CreateInboundLaunchLeadRequest,
  CreateInboundReferralLaunchLeadRequest,
  CreateCustomerReferralRequest,
  CreateCustomerReferralResponse,
  CustomerReferralsOverview,
  CrewMatchSummary,
  CrewMatchesResponse,
  CrewOpportunity,
  CustomerProperty,
  GoogleAuthStartRequest,
  CurrentUserResponse,
  DisableTwoFactorRequest,
  LoginRequest,
  LoginResponse,
  RequestPasswordResetRequest,
  RequestPasswordResetResponse,
  ResendTwoFactorChallengeRequest,
  RequestOpsAccountPasswordResetRequest,
  RequestOpsAccountPasswordResetResponse,
  MarkNotificationsReadRequest,
  InboundAutomationEscalationResponse,
  ListCustomerRetentionOpportunitiesResponse,
  ListCustomerReviewOpportunitiesResponse,
  NotificationDeliveriesResponse,
  NotificationListResponse,
  NotificationOpsHealthResponse,
  NotificationOpsEscalationResponse,
  NotificationOpsRetrySweepResponse,
  NotificationPreferences,
  OpsFinancialExceptionSummaryResponse,
  OpsAccountSummary,
  CreateLaunchOperationsTaskRequest,
  CreateLaunchOperationsTaskResponse,
  CreateOpsPayoutDisbursementRunRequest,
  CreateOpsPayoutDisbursementRunResponse,
  ExecuteOpsPayoutDisbursementRunRequest,
  ExecuteOpsPayoutDisbursementRunResponse,
  LaunchOperationsTaskEscalationSweepResponse,
  LaunchOperationsTaskNotificationSweepResponse,
  LaunchOperationsTasksResponse,
  OpsPayoutDisbursementRunsResponse,
  OpsPayoutRunPreviewResponse,
  OpsAutomationRunResponse,
  OpsAutomationRunsResponse,
  ProcessLaunchOperationsTaskEscalationsRequest,
  ProcessLaunchOperationsTaskNotificationsRequest,
  ProcessOpsAutomationRunRequest,
  ProcessProviderOnboardingAutomationRequest,
  ProviderOnboardingAutomationSweepResponse,
  PushDevice,
  PaymentRecord,
  ProviderPayoutLedgerResponse,
  ProviderAssistantCommandRequest,
  ProviderAssistantCommandResponse,
  ProviderVerificationQueueItem,
  PlaceSearchResponse,
  PublicMarketplaceOverviewResponse,
  ProcessReviewInvitesRequest,
  ProcessReviewInvitesResponse,
  ProcessSupportOpsTicketEscalationsRequest,
  CreateProviderReviewRequest,
  EscalateReviewSupportRequest,
  OpsReviewResponseItem,
  UpdateReviewResponseRequest,
  CreateCustomerPropertyRequest,
  CreateBookingRequest,
  FinalizeCheckoutSessionRequest,
  InstantQuoteRequest,
  InstantQuoteResponse,
  CreatePaymentIntentRequest,
  CreateOpsRefundOverrideRequest,
  CreateOpsBookingInterventionRequest,
  ReviewBookingEvidenceForOpsRequest,
  CreateRefundRequest,
  CreateLaunchLeadRequest,
  CreateSupportTicketRequest,
  CreateServiceComplaintRequest,
  ReplyServiceComplaintRequest,
  IssuePartialRefundRequest,
  LaunchLead,
  ObservabilityOverview,
  OpsLaunchLead,
  ProviderCrewConversation,
  ProviderCalendarSubscriptionResponse,
  ProviderCalendarImportsResponse,
  SyncStaleProviderCalendarImportsResponse,
  ProviderCalendarOverviewResponse,
  MarketplaceProviderProfile,
  ProviderProfile,
  PublicProviderReview,
  ProviderConnectOnboardingResponse,
  ProviderConnectStatusResponse,
  ProviderStaffingOverview,
  ProviderClientsOverview,
  ProviderReview,
  RegisterUserRequest,
  RotateOpsAccountSessionsRequest,
  RevokeTrustedDeviceRequest,
  UpdateOpsAccountAccessRequest,
  SetBookingRouteStopRequest,
  RegisterPushDeviceRequest,
  RecurringServicePlanSummary,
  ReverseGeocodePlaceRequest,
  MarkBookingOnRouteRequest,
  MarkBookingLateRequest,
  MarkBookingExceptionRequest,
  ListRecurringServicePlansResponse,
  ReviewCrewMatchRequest,
  ReviewProviderVerificationRequest,
  ReviewProviderCredentialRequest,
  SubmitProviderCredentialRequest,
  RemovePushDeviceRequest,
  RemoveExternalCalendarImportRequest,
  RescheduleBookingRequest,
  SendCustomerProviderMessageRequest,
  SendProviderCrewMessageRequest,
  SetDefaultCustomerPropertyRequest,
  SessionHeartbeatRequest,
  SearchProvidersRequest,
  SearchProvidersResponse,
  SelectPublicCrewOpportunityRequest,
  SelectPublicCrewOpportunityResponse,
  SupportOpsTicket,
  SupportOpsTicketEscalationSweepResponse,
  SupportTicket,
  ProviderCrewConversationThread,
  SyncExternalCalendarImportRequest,
  ClearBookingRouteStopRequest,
  UpdateBookingRouteLocationRequest,
  CrewPayoutLedgerResponse,
  UpdateCrewPreferencesRequest,
  UpdateNotificationPreferencesRequest,
  UpdateProviderProfileRequest,
  UpdateProviderSettingsRequest,
  UpdateLaunchLeadRequest,
  UpdateLaunchOperationsTaskRequest,
  UpdateLaunchOperationsTaskResponse,
  UpdateSupportTicketRequest,
  UpdateBookingAddressRequest,
  UpdateBookingPhotoMarketingUseRequest,
  UpdateOpsAccountRequest,
  StartBookingRequest,
  ConfirmTwoFactorSetupRequest,
  VerifyTwoFactorLoginRequest
} from "./types";
import { ApiRoutes } from "./routes";

const DEFAULT_API_REQUEST_TIMEOUT_MS = 30_000;
const PLACE_SEARCH_REQUEST_TIMEOUT_MS = 10_000;

export interface MarketplaceApiClientOptions {
  requestTimeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export interface BookingPageOptions {
  cursor?: string;
  limit?: number;
  scope?: BookingListScope;
}

export class MarketplaceApiTimeoutError extends Error {
  public readonly code = "REQUEST_TIMEOUT";

  public constructor(
    public readonly path: string,
    public readonly timeoutMs: number,
    message: string
  ) {
    super(message);
    this.name = "MarketplaceApiTimeoutError";
  }
}

export class MarketplaceApiError extends Error {
  public constructor(
    public readonly path: string,
    public readonly statusCode: number,
    public readonly requestId: string | undefined,
    message: string
  ) {
    super(requestId ? `${message} (Reference: ${requestId})` : message);
    this.name = "MarketplaceApiError";
  }
}

export function isMarketplaceApiTimeoutError(error: unknown): error is MarketplaceApiTimeoutError {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "REQUEST_TIMEOUT" &&
      "message" in error &&
      typeof error.message === "string"
  );
}

export class MarketplaceApiClient {
  private authToken?: string;
  private analyticsContext?: () => Record<string, unknown> | undefined;
  public setAnalyticsContext(read: () => Record<string, unknown> | undefined) { this.analyticsContext = read; }
  private locale?: string;
  private mobileClient?: {app: "customer" | "provider" | "crew"; version: string};

  public setMobileClient(app: "customer" | "provider" | "crew", version: string): void {
    this.mobileClient = {app, version};
  }
  private onUnauthorized?: (error: Error) => void;
  private readonly requestTimeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  public constructor(
    private readonly baseUrl: string,
    options: MarketplaceApiClientOptions = {}
  ) {
    this.requestTimeoutMs =
      Number.isFinite(options.requestTimeoutMs) && Number(options.requestTimeoutMs) > 0
        ? Number(options.requestTimeoutMs)
        : DEFAULT_API_REQUEST_TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  public setAuthToken(token: string | undefined): void {
    this.authToken = token;
  }

  public setLocale(locale: string | undefined): void {
    this.locale = locale;
  }

  public setUnauthorizedHandler(handler: ((error: Error) => void) | undefined): void {
    this.onUnauthorized = handler;
  }

  private buildHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      ...(this.analyticsContext?.() ? {"X-YardMatch-Analytics": JSON.stringify(this.analyticsContext())} : {}),
      ...(this.mobileClient ? {"X-YardMatch-App": this.mobileClient.app, "X-YardMatch-App-Version": this.mobileClient.version} : {}),
      ...(this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {}),
      ...(this.locale ? { "X-YardMatch-Locale": this.locale } : {})
    };
  }

  private async buildError(response: Response, path: string): Promise<Error> {
    const fallback = `Request failed for ${path} with status ${response.status}`;
    const requestId = response.headers.get("x-request-id") ?? undefined;

    try {
      const payload = (await response.json()) as { message?: string };
      return new MarketplaceApiError(path, response.status, requestId, payload.message || fallback);
    } catch {
      return new MarketplaceApiError(path, response.status, requestId, fallback);
    }
  }

  private buildTimeoutError(path: string, timeoutMs: number): MarketplaceApiTimeoutError {
    const message = this.locale?.toLowerCase().startsWith("es")
      ? "YardMatch esta tardando mas de lo esperado. Revisa tu conexion e intentalo de nuevo."
      : "YardMatch is taking longer than expected. Check your connection and try again.";
    return new MarketplaceApiTimeoutError(path, timeoutMs, message);
  }

  private async requestJson<TResponse>(
    path: string,
    init: RequestInit,
    timeoutMs = this.requestTimeoutMs
  ): Promise<TResponse> {
    const controller = new AbortController();
    let didTimeout = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      timeoutId = setTimeout(() => {
        didTimeout = true;
        reject(this.buildTimeoutError(path, timeoutMs));
        controller.abort();
      }, timeoutMs);
    });

    try {
      const requestPromise = (async () => {
        const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
          ...init,
          headers: this.buildHeaders(),
          signal: controller.signal
        });

        if (!response.ok) {
          const error = await this.buildError(response, path);
          if (response.status === 401) {
            this.onUnauthorized?.(error);
          }
          throw error;
        }

        return (await response.json()) as TResponse;
      })();

      return await Promise.race([requestPromise, timeoutPromise]);
    } catch (error) {
      if (didTimeout && !isMarketplaceApiTimeoutError(error)) {
        throw this.buildTimeoutError(path, timeoutMs);
      }
      throw error;
    } finally {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    }
  }

  // Shared clients use one JSON helper so browsers and React Native stay consistent.
  private postJson<TResponse>(
    path: string,
    payload: unknown,
    timeoutMs = this.requestTimeoutMs
  ): Promise<TResponse> {
    return this.requestJson<TResponse>(path, {
      method: "POST",
      body: JSON.stringify(payload)
    }, timeoutMs);
  }

  private getJson<TResponse>(path: string, timeoutMs = this.requestTimeoutMs): Promise<TResponse> {
    return this.requestJson<TResponse>(path, {
      method: "GET",
      cache: "no-store"
    }, timeoutMs);
  }

  public registerUser(payload: RegisterUserRequest): Promise<AuthenticatedUserEnvelope> {
    return this.postJson(ApiRoutes.register, payload);
  }

  public login(payload: LoginRequest): Promise<LoginResponse> {
    return this.postJson(ApiRoutes.login, payload);
  }

  public verifyTwoFactorLogin(payload: VerifyTwoFactorLoginRequest): Promise<AuthenticatedUserEnvelope> {
    return this.postJson(ApiRoutes.verifyTwoFactorLogin, payload);
  }

  public resendTwoFactorChallenge(
    payload: ResendTwoFactorChallengeRequest
  ): Promise<BeginTwoFactorSetupResponse> {
    return this.postJson(ApiRoutes.resendTwoFactorChallenge, payload);
  }

  public requestPasswordReset(
    payload: RequestPasswordResetRequest
  ): Promise<RequestPasswordResetResponse> {
    return this.postJson(ApiRoutes.requestPasswordReset, payload);
  }

  public confirmPasswordReset(payload: ConfirmPasswordResetRequest): Promise<LoginResponse> {
    return this.postJson(ApiRoutes.confirmPasswordReset, payload);
  }

  public getOpsAccounts(): Promise<OpsAccountSummary[]> {
    return this.getJson(ApiRoutes.opsAccounts);
  }

  public createOpsAccount(payload: CreateOpsAccountRequest): Promise<CreateOpsAccountResponse> {
    return this.postJson(ApiRoutes.opsAccounts, payload);
  }

  public updateOpsAccount(payload: UpdateOpsAccountRequest): Promise<OpsAccountSummary> {
    return this.postJson(ApiRoutes.opsAccountsUpdate, payload);
  }

  public rotateOpsAccountSessions(payload: RotateOpsAccountSessionsRequest): Promise<OpsAccountSummary> {
    return this.postJson(ApiRoutes.opsAccountsRotateSessions, payload);
  }

  public requestOpsAccountPasswordReset(
    payload: RequestOpsAccountPasswordResetRequest
  ): Promise<RequestOpsAccountPasswordResetResponse> {
    return this.postJson(ApiRoutes.opsAccountsPasswordResetRequest, payload);
  }

  public updateOpsAccountAccess(payload: UpdateOpsAccountAccessRequest): Promise<OpsAccountSummary> {
    return this.postJson(ApiRoutes.opsAccountsAccess, payload);
  }

  public getCurrentUser(): Promise<CurrentUserResponse> {
    return this.getJson(ApiRoutes.currentUser);
  }

  public getSecuritySettings(deviceId?: string): Promise<AccountSecuritySettings> {
    const suffix = deviceId ? `?deviceId=${encodeURIComponent(deviceId)}` : "";
    return this.getJson(`${ApiRoutes.securitySettings}${suffix}`);
  }

  public beginTwoFactorSetup(
    payload: BeginTwoFactorSetupRequest
  ): Promise<BeginTwoFactorSetupResponse> {
    return this.postJson(ApiRoutes.beginTwoFactorSetup, payload);
  }

  public confirmTwoFactorSetup(
    payload: ConfirmTwoFactorSetupRequest
  ): Promise<AccountSecuritySettings> {
    return this.postJson(ApiRoutes.confirmTwoFactorSetup, payload);
  }

  public disableTwoFactor(payload: DisableTwoFactorRequest): Promise<AccountSecuritySettings> {
    return this.postJson(ApiRoutes.disableTwoFactor, payload);
  }

  public revokeTrustedDevice(payload: RevokeTrustedDeviceRequest): Promise<AccountSecuritySettings> {
    return this.postJson(ApiRoutes.revokeTrustedDevice, payload);
  }

  public revokeOtherSessions(): Promise<AccountSecuritySettings> {
    return this.postJson(ApiRoutes.revokeOtherSessions, {});
  }

  public getGoogleAuthStartUrl(payload: GoogleAuthStartRequest): string {
    const query = new URLSearchParams({
      role: payload.role,
      mode: payload.mode
    });
    if (payload.redirectUri) {
      query.set("redirectUri", payload.redirectUri);
    }

    return `${this.baseUrl}${ApiRoutes.googleAuthStart}?${query.toString()}`;
  }

  public getAppleAuthStartUrl(payload: GoogleAuthStartRequest): string {
    const query = new URLSearchParams({
      role: payload.role,
      mode: payload.mode
    });
    if (payload.redirectUri) {
      query.set("redirectUri", payload.redirectUri);
    }

    return `${this.baseUrl}${ApiRoutes.appleAuthStart}?${query.toString()}`;
  }

  public completeSocialSignup(payload: CompleteSocialSignupRequest): Promise<AuthenticatedUserEnvelope> {
    return this.postJson(ApiRoutes.completeSocialSignup, payload);
  }

  public searchPlaces(query: string): Promise<PlaceSearchResponse> {
    return this.getJson(
      `${ApiRoutes.placeSearch}?query=${encodeURIComponent(query)}`,
      Math.min(this.requestTimeoutMs, PLACE_SEARCH_REQUEST_TIMEOUT_MS)
    );
  }

  public reverseGeocodePlace(payload: ReverseGeocodePlaceRequest): Promise<PlaceSearchResponse> {
    return this.postJson(
      ApiRoutes.placeReverseGeocode,
      payload,
      Math.min(this.requestTimeoutMs, PLACE_SEARCH_REQUEST_TIMEOUT_MS)
    );
  }

  public createCustomerProperty(payload: CreateCustomerPropertyRequest) {
    return this.postJson<CustomerProperty>(ApiRoutes.customerProperties, payload);
  }

  public getCustomerProperties() {
    return this.getJson<CustomerProperty[]>(ApiRoutes.customerProperties);
  }

  public setDefaultCustomerProperty(payload: SetDefaultCustomerPropertyRequest) {
    return this.postJson(ApiRoutes.defaultCustomerProperty, payload);
  }

  public getZipServiceMinimums(postalCode: string): Promise<ZipServiceMinimum[]> {
    return this.getJson(`/api/pricing/minimums?postalCode=${encodeURIComponent(postalCode)}`);
  }
  public getProviderPricing(postalCode: string): Promise<ProviderPricingOverview> {
    return this.getJson(`/api/providers/pricing?postalCode=${encodeURIComponent(postalCode)}`);
  }
  public updateProviderPricing(prices: ProviderServicePrice[]): Promise<ProviderPricingOverview> {
    return this.postJson("/api/providers/pricing", { prices });
  }
  public getOpsPricingMinimums(postalCode: string): Promise<ZipServiceMinimumRecord[]> {
    return this.getJson(`/api/ops/pricing/minimums?postalCode=${encodeURIComponent(postalCode)}`);
  }
  public updateZipServiceMinimum(payload: UpdateZipServiceMinimumRequest): Promise<ZipServiceMinimumRecord> {
    return this.postJson("/api/ops/pricing/minimums", payload);
  }

  public createInstantQuote(payload: InstantQuoteRequest): Promise<InstantQuoteResponse> {
    return this.postJson(ApiRoutes.createInstantQuote, payload);
  }

  public searchProviders(payload: SearchProvidersRequest): Promise<SearchProvidersResponse> {
    return this.postJson(ApiRoutes.searchProviders, payload);
  }

  public getOwnProviderAvailability(): Promise<AvailabilitySlot[]> {
    return this.getJson(ApiRoutes.manageProviderAvailability);
  }
  public manageProviderAvailability(payload: ManageProviderAvailabilityRequest): Promise<AvailabilitySlot[]> {
    return this.postJson(ApiRoutes.manageProviderAvailability, payload);
  }

  public getProviderAvailability(payload: ProviderAvailabilityRequest): Promise<AvailabilitySlot[]> {
    return this.postJson(ApiRoutes.providerAvailability, payload);
  }

  public getPublicMarketplaceOverview(): Promise<PublicMarketplaceOverviewResponse> {
    return this.getJson(ApiRoutes.publicMarketplaceOverview);
  }

  public getProviderProfile(providerId: string): Promise<MarketplaceProviderProfile> {
    return this.getJson<MarketplaceProviderProfile>(
      `${ApiRoutes.providerProfile}?providerId=${encodeURIComponent(providerId)}`
    );
  }

  public getProviderVerificationQueue(): Promise<ProviderVerificationQueueItem[]> {
    return this.getJson(ApiRoutes.providerVerificationQueue);
  }

  public reviewProviderVerification(payload: ReviewProviderVerificationRequest) {
    return this.postJson<ProviderProfile>(ApiRoutes.providerVerificationReview, payload);
  }

  public submitProviderCredential(payload: SubmitProviderCredentialRequest) {
    return this.postJson<ProviderProfile>(ApiRoutes.providerCredentials, payload);
  }

  public reviewProviderCredential(payload: ReviewProviderCredentialRequest) {
    return this.postJson<ProviderProfile>(ApiRoutes.providerCredentialReview, payload);
  }

  public getProviderConnectStatus(): Promise<ProviderConnectStatusResponse> {
    return this.getJson(ApiRoutes.providerConnectStatus);
  }

  public startProviderConnectOnboarding(): Promise<ProviderConnectOnboardingResponse> {
    return this.postJson(ApiRoutes.providerConnectOnboarding, {});
  }

  public processProviderOnboardingAutomation(
    payload: ProcessProviderOnboardingAutomationRequest = {}
  ): Promise<ProviderOnboardingAutomationSweepResponse> {
    return this.postJson(ApiRoutes.providerOnboardingAutomationSweep, payload);
  }

  public getCrewOpportunities(): Promise<CrewOpportunity[]> {
    return this.getJson(ApiRoutes.crewOpportunities);
  }

  public getPublicCrewOpportunities(): Promise<CrewOpportunity[]> {
    return this.getJson(ApiRoutes.publicCrewOpportunities);
  }

  public selectPublicCrewOpportunity(
    payload: SelectPublicCrewOpportunityRequest
  ): Promise<SelectPublicCrewOpportunityResponse> {
    return this.postJson(ApiRoutes.selectPublicCrewOpportunity, payload);
  }

  public claimPublicCrewOpportunity(
    payload: ClaimPublicCrewOpportunityRequest
  ): Promise<CrewMatchCandidate> {
    return this.postJson(ApiRoutes.claimPublicCrewOpportunity, payload);
  }

  public getProviderClients(): Promise<ProviderClientsOverview> {
    return this.getJson(ApiRoutes.providerClients);
  }

  public getProviderStaffingOverview(): Promise<ProviderStaffingOverview> {
    return this.getJson(ApiRoutes.providerStaffingOverview);
  }

  public reviewCrewMatch(payload: ReviewCrewMatchRequest) {
    return this.postJson(ApiRoutes.providerReviewCrewMatch, payload);
  }

  public assignBookingRouteLeader(payload: AssignBookingRouteLeaderRequest) {
    return this.postJson<Booking>(ApiRoutes.providerAssignBookingRouteLeader, payload);
  }

  public updateProviderSettings(payload: UpdateProviderSettingsRequest) {
    return this.postJson<ProviderProfile>(ApiRoutes.updateProviderSettings, payload);
  }

  public updateProviderProfile(payload: UpdateProviderProfileRequest) {
    return this.postJson<ProviderProfile>(ApiRoutes.updateProviderProfile, payload);
  }

  public runProviderAssistantCommand(payload: ProviderAssistantCommandRequest) {
    return this.postJson<ProviderAssistantCommandResponse>(ApiRoutes.providerAssistantCommand, payload);
  }

  public getProviderCalendarSubscription(): Promise<ProviderCalendarSubscriptionResponse> {
    return this.getJson(ApiRoutes.providerCalendarSubscription);
  }

  public getProviderCalendarOverview(fromIso?: string, toIso?: string): Promise<ProviderCalendarOverviewResponse> {
    const query = new URLSearchParams();
    if (fromIso) {
      query.set("from", fromIso);
    }
    if (toIso) {
      query.set("to", toIso);
    }

    const suffix = query.toString();
    return this.getJson(`${ApiRoutes.providerCalendarOverview}${suffix ? `?${suffix}` : ""}`);
  }

  public getProviderCalendarImports(): Promise<ProviderCalendarImportsResponse> {
    return this.getJson(ApiRoutes.providerCalendarImports);
  }

  public createProviderCalendarImport(payload: CreateExternalCalendarImportRequest) {
    return this.postJson<ProviderCalendarImportsResponse>(ApiRoutes.providerCalendarImports, payload);
  }

  public syncProviderCalendarImport(payload: SyncExternalCalendarImportRequest) {
    return this.postJson<ProviderCalendarImportsResponse>(ApiRoutes.providerCalendarImportsSync, payload);
  }

  public syncStaleProviderCalendarImports() {
    return this.postJson<SyncStaleProviderCalendarImportsResponse>(
      ApiRoutes.providerCalendarImportsSyncStale,
      {}
    );
  }

  public removeProviderCalendarImport(payload: RemoveExternalCalendarImportRequest) {
    return this.postJson<ProviderCalendarImportsResponse>(ApiRoutes.providerCalendarImportsRemove, payload);
  }

  public getNotifications(): Promise<NotificationListResponse> {
    return this.getJson(ApiRoutes.notifications);
  }

  public getRecurringServicePlans(): Promise<ListRecurringServicePlansResponse> {
    return this.getJson(ApiRoutes.recurringServicePlans);
  }

  public createRecurringServicePlan(
    payload: CreateRecurringServicePlanRequest
  ): Promise<CreateRecurringServicePlanResponse> {
    return this.postJson(ApiRoutes.recurringServicePlans, payload);
  }

  public cancelRecurringServicePlan(
    payload: CancelRecurringServicePlanRequest
  ): Promise<RecurringServicePlanSummary> {
    return this.postJson(ApiRoutes.cancelRecurringServicePlan, payload);
  }

  public markNotificationsRead(
    payload: MarkNotificationsReadRequest = {}
  ): Promise<NotificationListResponse> {
    return this.postJson(ApiRoutes.notificationsRead, payload);
  }

  public getNotificationPreferences(): Promise<NotificationPreferences> {
    return this.getJson(ApiRoutes.notificationPreferences);
  }

  public updateNotificationPreferences(
    payload: UpdateNotificationPreferencesRequest
  ): Promise<NotificationPreferences> {
    return this.postJson(ApiRoutes.notificationPreferences, payload);
  }

  public getNotificationDeliveries(): Promise<NotificationDeliveriesResponse> {
    return this.getJson(ApiRoutes.notificationDeliveries);
  }

  public getNotificationOpsHealth(): Promise<NotificationOpsHealthResponse> {
    return this.getJson(ApiRoutes.notificationOpsHealth);
  }

  public retryDueNotificationDeliveriesForOps(): Promise<NotificationOpsRetrySweepResponse> {
    return this.postJson(ApiRoutes.notificationOpsRetryDue, {});
  }

  public escalateNotificationOpsAlerts(): Promise<NotificationOpsEscalationResponse> {
    return this.postJson(ApiRoutes.notificationOpsEscalate, {});
  }

  public escalateInboundAutomationAlerts(): Promise<InboundAutomationEscalationResponse> {
    return this.postJson(ApiRoutes.observabilityInboundAutomationEscalate, {});
  }

  public registerPushDevice(payload: RegisterPushDeviceRequest): Promise<PushDevice> {
    return this.postJson(ApiRoutes.notificationPushDevices, payload);
  }

  public removePushDevice(payload: RemovePushDeviceRequest): Promise<{ success: true }> {
    return this.postJson(ApiRoutes.notificationPushDevicesRemove, payload);
  }

  public updateCrewPreferences(payload: UpdateCrewPreferencesRequest) {
    return this.postJson<CrewMemberProfile>(ApiRoutes.crewPreferences, payload);
  }

  public getCrewMatches(): Promise<CrewMatchesResponse> {
    return this.getJson(ApiRoutes.crewMatches);
  }

  public cancelCrewMatch(payload: CancelCrewMatchRequest): Promise<CrewMatchSummary> {
    return this.postJson(ApiRoutes.cancelCrewMatch, payload);
  }

  public getProviderCrewConversations(): Promise<ProviderCrewConversation[]> {
    return this.getJson(ApiRoutes.providerCrewConversations);
  }

  public getProviderCrewConversationThread(
    threadId?: string,
    crewMatchId?: string
  ): Promise<ProviderCrewConversationThread> {
    const query = new URLSearchParams({
      ...(threadId ? { threadId } : {}),
      ...(crewMatchId ? { crewMatchId } : {})
    });

    return this.getJson(`${ApiRoutes.providerCrewMessages}?${query.toString()}`);
  }

  public sendProviderCrewMessage(
    payload: SendProviderCrewMessageRequest
  ): Promise<ProviderCrewConversationThread> {
    return this.postJson(ApiRoutes.providerCrewMessages, payload);
  }

  public getCustomerProviderConversations(): Promise<CustomerProviderConversation[]> {
    return this.getJson(ApiRoutes.customerProviderConversations);
  }

  public getCustomerProviderConversationThread(
    threadId?: string,
    bookingId?: string
  ): Promise<CustomerProviderConversationThread> {
    const query = new URLSearchParams({
      ...(threadId ? { threadId } : {}),
      ...(bookingId ? { bookingId } : {})
    });

    return this.getJson(`${ApiRoutes.customerProviderMessages}?${query.toString()}`);
  }

  public sendCustomerProviderMessage(
    payload: SendCustomerProviderMessageRequest
  ): Promise<CustomerProviderConversationThread> {
    return this.postJson(ApiRoutes.customerProviderMessages, payload);
  }

  public createProviderReview(payload: CreateProviderReviewRequest): Promise<ProviderReview> {
    return this.postJson(ApiRoutes.providerReviews, payload);
  }

  public updateReviewResponse(payload: UpdateReviewResponseRequest): Promise<ProviderReview> {
    return this.postJson(ApiRoutes.updateReviewResponse, payload);
  }

  public createInboundReviewResponse(payload: CreateInboundReviewResponseRequest): Promise<ProviderReview> {
    return this.postJson(ApiRoutes.inboundReviewResponse, payload);
  }

  public createInboundSharedInboxReviewResponse(
    payload: CreateInboundSharedInboxReviewResponseRequest
  ): Promise<ProviderReview> {
    return this.postJson(ApiRoutes.inboundSharedInboxReviewResponse, payload);
  }

  public createInboundGoogleBusinessProfileReviewResponse(
    payload: CreateInboundGoogleBusinessProfileReviewResponseRequest
  ): Promise<ProviderReview> {
    return this.postJson(ApiRoutes.inboundGoogleBusinessProfileReviewResponse, payload);
  }

  public getProviderReviews(providerId: string): Promise<PublicProviderReview[]> {
    return this.getJson<PublicProviderReview[]>(
      `${ApiRoutes.providerReviews}?providerId=${encodeURIComponent(providerId)}`
    );
  }

  public getCustomerReviewOpportunities(): Promise<ListCustomerReviewOpportunitiesResponse> {
    return this.getJson<ListCustomerReviewOpportunitiesResponse>(ApiRoutes.customerReviewOpportunities);
  }

  public getCustomerRetentionOpportunities(): Promise<ListCustomerRetentionOpportunitiesResponse> {
    return this.getJson<ListCustomerRetentionOpportunitiesResponse>(
      ApiRoutes.customerRetentionOpportunities
    );
  }

  public getBookingsPage(options: BookingPageOptions = {}): Promise<BookingPageResponse> {
    const query = new URLSearchParams();
    if (options.cursor) {
      query.set("cursor", options.cursor);
    }
    if (options.limit !== undefined) {
      query.set("limit", String(options.limit));
    }
    if (options.scope) {
      query.set("scope", options.scope);
    }
    const suffix = query.size > 0 ? `?${query.toString()}` : "";
    return this.getJson<BookingPageResponse>(`${ApiRoutes.listBookings}${suffix}`);
  }

  public async getBookings(options: BookingPageOptions = {}): Promise<Booking[]> {
    return (await this.getBookingsPage(options)).items;
  }

  public createBooking(payload: CreateBookingRequest) {
    return this.postJson<Booking>(ApiRoutes.createBooking, payload);
  }

  public getCustomerBookingForRequest(requestId: string): Promise<Booking | null> {
    return this.getJson(`/api/bookings/detail?requestId=${encodeURIComponent(requestId)}`);
  }

  public getCustomerBooking(bookingId: string): Promise<Booking> {
    return this.getJson(`/api/bookings/detail?bookingId=${encodeURIComponent(bookingId)}`);
  }

  public cancelBooking(payload: CancelBookingRequest) {
    return this.postJson<Booking>(ApiRoutes.cancelBooking, payload);
  }

  public updateBookingSchedule(payload: UpdateBookingScheduleRequest) {
    return this.postJson<Booking>(ApiRoutes.updateBookingSchedule, payload);
  }

  public respondBookingSchedule(payload: RespondBookingScheduleRequest) {
    return this.postJson<Booking>(ApiRoutes.respondBookingSchedule, payload);
  }

  public rescheduleBooking(payload: RescheduleBookingRequest) {
    return this.postJson<Booking>(ApiRoutes.rescheduleBooking, payload);
  }

  public confirmBooking(payload: ConfirmBookingRequest) {
    return this.postJson<Booking>(ApiRoutes.confirmBooking, payload);
  }

  public declineBooking(payload: DeclineBookingRequest) {
    return this.postJson<Booking>(ApiRoutes.declineBooking, payload);
  }

  public startBooking(payload: StartBookingRequest) {
    return this.postJson<Booking>(ApiRoutes.startBooking, payload);
  }

  public completeBooking(payload: CompleteBookingRequest) {
    return this.postJson<Booking>(ApiRoutes.completeBooking, payload);
  }

  public markBookingOnRoute(payload: MarkBookingOnRouteRequest) {
    return this.postJson<Booking>(ApiRoutes.markBookingOnRoute, payload);
  }

  public setBookingRouteStop(payload: SetBookingRouteStopRequest) {
    return this.postJson<Booking>(ApiRoutes.setBookingRouteStop, payload);
  }

  public clearBookingRouteStop(payload: ClearBookingRouteStopRequest) {
    return this.postJson<Booking>(ApiRoutes.clearBookingRouteStop, payload);
  }

  public updateBookingRouteLocation(payload: UpdateBookingRouteLocationRequest) {
    return this.postJson<BookingArrivalTracking>(ApiRoutes.updateBookingRouteLocation, payload);
  }

  public markBookingLate(payload: MarkBookingLateRequest) {
    return this.postJson<Booking>(ApiRoutes.markBookingLate, payload);
  }

  public markBookingException(payload: MarkBookingExceptionRequest) {
    return this.postJson<Booking>(ApiRoutes.markBookingException, payload);
  }

  public addBookingEvidence(payload: AddBookingEvidenceRequest) {
    return this.postJson<Booking>(ApiRoutes.addBookingEvidence, payload);
  }

  public updateBookingPhotoMarketingUse(payload: UpdateBookingPhotoMarketingUseRequest) {
    return this.postJson<Booking>(ApiRoutes.updateBookingPhotoMarketingUse, payload);
  }

  public createBookingDispute(payload: CreateBookingDisputeRequest) {
    return this.postJson<Booking>(ApiRoutes.createBookingDispute, payload);
  }

  public getBookingTracking(bookingId: string): Promise<BookingArrivalTracking> {
    return this.getJson(`${ApiRoutes.bookingTracking}?bookingId=${encodeURIComponent(bookingId)}`);
  }

  public getBookingRecoveryOptions(bookingId: string): Promise<BookingRecoveryOptions> {
    return this.postJson(ApiRoutes.bookingRecoveryOptions, { bookingId });
  }
  public recoverBooking(payload: RecoverBookingRequest): Promise<Booking> {
    return this.postJson(ApiRoutes.recoverBooking, payload);
  }

  public reviewBookingAddress(payload: ReviewBookingAddressRequest): Promise<Booking> {
    return this.postJson(ApiRoutes.reviewBookingAddress, payload);
  }

  public updateBookingAddress(payload: UpdateBookingAddressRequest): Promise<UpdateBookingAddressResponse> {
    return this.postJson(ApiRoutes.updateBookingAddress, payload);
  }

  public getPayments(bookingIds: string[]): Promise<PaymentRecord[]> {
    if (bookingIds.length === 0) {
      return Promise.resolve([]);
    }
    const query = new URLSearchParams();
    for (const bookingId of [...new Set(bookingIds)]) {
      query.append("bookingId", bookingId);
    }
    return this.getJson(`${ApiRoutes.listPayments}?${query.toString()}`);
  }

  public getProviderPayoutLedger(): Promise<ProviderPayoutLedgerResponse> {
    return this.getJson(ApiRoutes.providerPayoutLedger);
  }

  public getCrewPayoutLedger(): Promise<CrewPayoutLedgerResponse> {
    return this.getJson(ApiRoutes.crewPayoutLedger);
  }

  public getOpsPayoutPreview(): Promise<OpsPayoutRunPreviewResponse> {
    return this.getJson(ApiRoutes.opsPayoutPreview);
  }

  public getOpsPayoutDisbursementRuns(): Promise<OpsPayoutDisbursementRunsResponse> {
    return this.getJson(ApiRoutes.opsPayoutDisbursementRuns);
  }

  public createOpsPayoutDisbursementRun(
    payload: CreateOpsPayoutDisbursementRunRequest
  ): Promise<CreateOpsPayoutDisbursementRunResponse> {
    return this.postJson(ApiRoutes.opsPayoutDisbursementRuns, payload);
  }

  public executeOpsPayoutDisbursementRun(
    payload: ExecuteOpsPayoutDisbursementRunRequest
  ): Promise<ExecuteOpsPayoutDisbursementRunResponse> {
    return this.postJson(ApiRoutes.opsPayoutDisbursementRunsExecute, payload);
  }

  public createCheckoutSession(
    payload: CreateCheckoutSessionRequest
  ): Promise<CreateCheckoutSessionResponse> {
    return this.postJson(ApiRoutes.createCheckoutSession, payload);
  }

  public finalizeCheckoutSession(payload: FinalizeCheckoutSessionRequest): Promise<PaymentRecord> {
    return this.postJson(ApiRoutes.finalizeCheckoutSession, payload);
  }

  public createPaymentIntent(payload: CreatePaymentIntentRequest) {
    return this.postJson(ApiRoutes.createPaymentIntent, payload);
  }

  public createRefund(payload: CreateRefundRequest) {
    return this.postJson(ApiRoutes.createRefund, payload);
  }

  public createServiceComplaint(payload: CreateServiceComplaintRequest): Promise<SupportTicket> {
    return this.postJson(ApiRoutes.serviceComplaints, payload);
  }
  public replyServiceComplaint(payload: ReplyServiceComplaintRequest): Promise<SupportTicket> {
    return this.postJson(ApiRoutes.serviceComplaintReply, payload);
  }
  public assessServiceComplaint(ticketId: string): Promise<SupportTicket> {
    return this.postJson(ApiRoutes.serviceComplaintAssessment, { ticketId });
  }
  public issuePartialRefund(payload: IssuePartialRefundRequest): Promise<PaymentRecord> {
    return this.postJson(ApiRoutes.partialRefund, payload);
  }

  public createSupportTicket(payload: CreateSupportTicketRequest): Promise<SupportTicket> {
    return this.postJson(ApiRoutes.createSupportTicket, payload);
  }

  public createLaunchLead(payload: CreateLaunchLeadRequest): Promise<LaunchLead> {
    return this.postJson(ApiRoutes.launchLeads, payload);
  }

  public listCustomerReferrals(): Promise<CustomerReferralsOverview> {
    return this.getJson(ApiRoutes.customerReferrals);
  }

  public createCustomerReferral(payload: CreateCustomerReferralRequest): Promise<CreateCustomerReferralResponse> {
    return this.postJson(ApiRoutes.customerReferrals, payload);
  }

  public createInboundLaunchLead(payload: CreateInboundLaunchLeadRequest): Promise<LaunchLead> {
    return this.postJson(ApiRoutes.inboundLaunchLeads, payload);
  }

  public createInboundEmailLaunchLead(payload: CreateInboundEmailLaunchLeadRequest): Promise<LaunchLead> {
    return this.postJson(ApiRoutes.inboundLaunchEmail, payload);
  }

  public createInboundGoogleBusinessProfileLead(
    payload: CreateInboundGoogleBusinessProfileLeadRequest
  ): Promise<LaunchLead> {
    return this.postJson(ApiRoutes.inboundLaunchGoogleBusinessProfile, payload);
  }

  public createInboundReferralLaunchLead(
    payload: CreateInboundReferralLaunchLeadRequest
  ): Promise<LaunchLead> {
    return this.postJson(ApiRoutes.inboundLaunchReferral, payload);
  }

  public escalateReviewSupport(payload: EscalateReviewSupportRequest): Promise<OpsReviewResponseItem> {
    return this.postJson(ApiRoutes.escalateReviewSupport, payload);
  }

  public getSupportTickets(): Promise<SupportTicket[]> {
    return this.getJson(ApiRoutes.supportTickets);
  }

  public getOpsLaunchLeads(): Promise<OpsLaunchLead[]> {
    return this.getJson(ApiRoutes.opsLaunchLeads);
  }

  public getOpsSupportTickets(): Promise<SupportOpsTicket[]> {
    return this.getJson(ApiRoutes.opsSupportTickets);
  }

  public getOpsSupportSummary(): Promise<OpsFinancialExceptionSummaryResponse> {
    return this.getJson(ApiRoutes.opsSupportSummary);
  }

  public createOpsRefundOverride(payload: CreateOpsRefundOverrideRequest): Promise<PaymentRecord> {
    return this.postJson(ApiRoutes.opsRefundOverride, payload);
  }

  public createOpsBookingIntervention(payload: CreateOpsBookingInterventionRequest): Promise<Booking> {
    return this.postJson(ApiRoutes.opsBookingIntervention, payload);
  }

  public reviewBookingEvidenceForOps(payload: ReviewBookingEvidenceForOpsRequest): Promise<Booking> {
    return this.postJson(ApiRoutes.opsBookingEvidenceReview, payload);
  }

  public updateOpsSupportTicket(payload: UpdateSupportTicketRequest): Promise<SupportTicket> {
    return this.postJson(ApiRoutes.opsSupportTicketsUpdate, payload);
  }

  public escalateStaleOpsSupportTickets(
    payload: ProcessSupportOpsTicketEscalationsRequest = {}
  ): Promise<SupportOpsTicketEscalationSweepResponse> {
    return this.postJson(ApiRoutes.opsSupportTicketsEscalateStale, payload);
  }

  public updateOpsLaunchLead(payload: UpdateLaunchLeadRequest) {
    return this.postJson(ApiRoutes.opsLaunchLeadsUpdate, payload);
  }

  public processReviewInvites(
    payload: ProcessReviewInvitesRequest
  ): Promise<ProcessReviewInvitesResponse> {
    return this.postJson(ApiRoutes.processReviewInvites, payload);
  }

  public trackEvent(payload: AnalyticsEvent) {
    return this.postJson(ApiRoutes.createAnalyticsEvent, payload);
  }

  public trackSessionHeartbeat(payload: SessionHeartbeatRequest) {
    return this.postJson(ApiRoutes.createSessionHeartbeat, payload);
  }

  public getObservabilityOverview(): Promise<ObservabilityOverview> {
    return this.getJson(ApiRoutes.getObservabilityOverview);
  }

  public getLaunchOperationsTasks(): Promise<LaunchOperationsTasksResponse> {
    return this.getJson(ApiRoutes.launchOperationsTasks);
  }

  public createLaunchOperationsTask(
    payload: CreateLaunchOperationsTaskRequest
  ): Promise<CreateLaunchOperationsTaskResponse> {
    return this.postJson(ApiRoutes.launchOperationsTasks, payload);
  }

  public updateLaunchOperationsTask(
    payload: UpdateLaunchOperationsTaskRequest
  ): Promise<UpdateLaunchOperationsTaskResponse> {
    return this.postJson(ApiRoutes.launchOperationsTasksUpdate, payload);
  }

  public notifyDueLaunchOperationsTasks(
    payload: ProcessLaunchOperationsTaskNotificationsRequest = {}
  ): Promise<LaunchOperationsTaskNotificationSweepResponse> {
    return this.postJson(ApiRoutes.launchOperationsTasksNotifyDue, payload);
  }

  public escalateOverdueLaunchOperationsTasks(
    payload: ProcessLaunchOperationsTaskEscalationsRequest = {}
  ): Promise<LaunchOperationsTaskEscalationSweepResponse> {
    return this.postJson(ApiRoutes.launchOperationsTasksEscalateOverdue, payload);
  }

  public runDueOpsAutomation(
    payload: ProcessOpsAutomationRunRequest = {}
  ): Promise<OpsAutomationRunResponse> {
    return this.postJson(ApiRoutes.opsAutomationRunDue, payload);
  }

  public getOpsAutomationRuns(): Promise<OpsAutomationRunsResponse> {
    return this.getJson(ApiRoutes.opsAutomationRuns);
  }
}
