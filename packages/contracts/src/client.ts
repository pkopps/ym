import {
  AddBookingEvidenceRequest,
  AssignBookingRouteLeaderRequest,
  AppNotification,
  AnalyticsEvent,
  AuthenticatedUserEnvelope,
  BookingArrivalTracking,
  Booking,
  CancelBookingRequest,
  CancelCrewMatchRequest,
  CancelRecurringServicePlanRequest,
  ConfirmPasswordResetRequest,
  CreateRecurringServicePlanRequest,
  CreateRecurringServicePlanResponse,
  CompleteSocialSignupRequest,
  ConfirmBookingRequest,
  DeclineBookingRequest,
  CustomerProviderConversation,
  CustomerProviderConversationThread,
  CrewMemberProfile,
  CompleteBookingRequest,
  CreateCheckoutSessionRequest,
  CreateCheckoutSessionResponse,
  CreateBookingDisputeRequest,
  CreateExternalCalendarImportRequest,
  CrewMatchSummary,
  CrewMatchesResponse,
  CrewOpportunity,
  CustomerProperty,
  GoogleAuthStartRequest,
  CurrentUserResponse,
  LoginRequest,
  RequestPasswordResetRequest,
  RequestPasswordResetResponse,
  MarkNotificationsReadRequest,
  ListCustomerReviewOpportunitiesResponse,
  NotificationDeliveriesResponse,
  NotificationListResponse,
  NotificationOpsHealthResponse,
  NotificationOpsEscalationResponse,
  NotificationOpsRetrySweepResponse,
  NotificationPreferences,
  OpsFinancialExceptionSummaryResponse,
  OpsPayoutRunPreviewResponse,
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
  CreateProviderReviewRequest,
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
  CreateSupportTicketRequest,
  ObservabilityOverview,
  ProviderCrewConversation,
  ProviderCalendarSubscriptionResponse,
  ProviderCalendarImportsResponse,
  SyncStaleProviderCalendarImportsResponse,
  ProviderCalendarOverviewResponse,
  ProviderProfile,
  ProviderStaffingOverview,
  ProviderReview,
  RegisterUserRequest,
  SetBookingRouteStopRequest,
  RegisterPushDeviceRequest,
  RecurringServicePlanSummary,
  MarkBookingOnRouteRequest,
  MarkBookingLateRequest,
  MarkBookingExceptionRequest,
  ListRecurringServicePlansResponse,
  ReviewCrewMatchRequest,
  ReviewProviderVerificationRequest,
  RemovePushDeviceRequest,
  RemoveExternalCalendarImportRequest,
  RescheduleBookingRequest,
  SendCustomerProviderMessageRequest,
  SendProviderCrewMessageRequest,
  SetDefaultCustomerPropertyRequest,
  SessionHeartbeatRequest,
  SearchProvidersRequest,
  SearchProvidersResponse,
  SupportOpsTicket,
  SupportTicket,
  ProviderCrewConversationThread,
  SyncExternalCalendarImportRequest,
  ClearBookingRouteStopRequest,
  UpdateBookingRouteLocationRequest,
  CrewPayoutLedgerResponse,
  UpdateCrewPreferencesRequest,
  UpdateNotificationPreferencesRequest,
  UpdateProviderSettingsRequest,
  UpdateSupportTicketRequest,
  UpdateBookingAddressRequest,
  StartBookingRequest
} from "./types";
import { ApiRoutes } from "./routes";

export class MarketplaceApiClient {
  private authToken?: string;
  private onUnauthorized?: (error: Error) => void;

  public constructor(private readonly baseUrl: string) {}

  public setAuthToken(token: string | undefined): void {
    this.authToken = token;
  }

  public setUnauthorizedHandler(handler: ((error: Error) => void) | undefined): void {
    this.onUnauthorized = handler;
  }

  private async buildError(response: Response, path: string): Promise<Error> {
    const fallback = `Request failed for ${path} with status ${response.status}`;

    try {
      const payload = (await response.json()) as { message?: string };
      return new Error(payload.message || fallback);
    } catch {
      return new Error(fallback);
    }
  }

  // Shared clients use one JSON helper so browsers and React Native stay consistent.
  private async postJson<TResponse>(path: string, payload: unknown): Promise<TResponse> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {})
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const error = await this.buildError(response, path);
      if (response.status === 401) {
        this.onUnauthorized?.(error);
      }
      throw error;
    }

    return (await response.json()) as TResponse;
  }

  private async getJson<TResponse>(path: string): Promise<TResponse> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {})
      },
      cache: "no-store"
    });

    if (!response.ok) {
      const error = await this.buildError(response, path);
      if (response.status === 401) {
        this.onUnauthorized?.(error);
      }
      throw error;
    }

    return (await response.json()) as TResponse;
  }

  public registerUser(payload: RegisterUserRequest): Promise<AuthenticatedUserEnvelope> {
    return this.postJson(ApiRoutes.register, payload);
  }

  public login(payload: LoginRequest): Promise<AuthenticatedUserEnvelope> {
    return this.postJson(ApiRoutes.login, payload);
  }

  public requestPasswordReset(
    payload: RequestPasswordResetRequest
  ): Promise<RequestPasswordResetResponse> {
    return this.postJson(ApiRoutes.requestPasswordReset, payload);
  }

  public confirmPasswordReset(payload: ConfirmPasswordResetRequest): Promise<AuthenticatedUserEnvelope> {
    return this.postJson(ApiRoutes.confirmPasswordReset, payload);
  }

  public getCurrentUser(): Promise<CurrentUserResponse> {
    return this.getJson(ApiRoutes.currentUser);
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
    return this.getJson(`${ApiRoutes.placeSearch}?query=${encodeURIComponent(query)}`);
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

  public createInstantQuote(payload: InstantQuoteRequest): Promise<InstantQuoteResponse> {
    return this.postJson(ApiRoutes.createInstantQuote, payload);
  }

  public searchProviders(payload: SearchProvidersRequest): Promise<SearchProvidersResponse> {
    return this.postJson(ApiRoutes.searchProviders, payload);
  }

  public getPublicMarketplaceOverview(): Promise<PublicMarketplaceOverviewResponse> {
    return this.getJson(ApiRoutes.publicMarketplaceOverview);
  }

  public getProviderProfile(providerId: string): Promise<ProviderProfile> {
    return this.getJson<ProviderProfile>(
      `${ApiRoutes.providerProfile}?providerId=${encodeURIComponent(providerId)}`
    );
  }

  public getProviderVerificationQueue(): Promise<ProviderVerificationQueueItem[]> {
    return this.getJson(ApiRoutes.providerVerificationQueue);
  }

  public reviewProviderVerification(payload: ReviewProviderVerificationRequest) {
    return this.postJson<ProviderProfile>(ApiRoutes.providerVerificationReview, payload);
  }

  public getCrewOpportunities(): Promise<CrewOpportunity[]> {
    return this.getJson(ApiRoutes.crewOpportunities);
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

  public getProviderReviews(providerId: string): Promise<ProviderReview[]> {
    return this.getJson<ProviderReview[]>(
      `${ApiRoutes.providerReviews}?providerId=${encodeURIComponent(providerId)}`
    );
  }

  public getCustomerReviewOpportunities(): Promise<ListCustomerReviewOpportunitiesResponse> {
    return this.getJson<ListCustomerReviewOpportunitiesResponse>(ApiRoutes.customerReviewOpportunities);
  }

  public getBookings(): Promise<Booking[]> {
    return this.getJson<Booking[]>(ApiRoutes.listBookings);
  }

  public createBooking(payload: CreateBookingRequest) {
    return this.postJson<Booking>(ApiRoutes.createBooking, payload);
  }

  public cancelBooking(payload: CancelBookingRequest) {
    return this.postJson<Booking>(ApiRoutes.cancelBooking, payload);
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

  public createBookingDispute(payload: CreateBookingDisputeRequest) {
    return this.postJson<Booking>(ApiRoutes.createBookingDispute, payload);
  }

  public getBookingTracking(bookingId: string): Promise<BookingArrivalTracking> {
    return this.getJson(`${ApiRoutes.bookingTracking}?bookingId=${encodeURIComponent(bookingId)}`);
  }

  public updateBookingAddress(payload: UpdateBookingAddressRequest) {
    return this.postJson(ApiRoutes.updateBookingAddress, payload);
  }

  public getPayments(): Promise<PaymentRecord[]> {
    return this.getJson(ApiRoutes.listPayments);
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

  public createSupportTicket(payload: CreateSupportTicketRequest) {
    return this.postJson(ApiRoutes.createSupportTicket, payload);
  }

  public getSupportTickets(): Promise<SupportTicket[]> {
    return this.getJson(ApiRoutes.supportTickets);
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
}
