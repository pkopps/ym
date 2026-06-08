import {
  AppNotification,
  AnalyticsEvent,
  AuthenticatedUserEnvelope,
  BookingArrivalTracking,
  Booking,
  CancelBookingRequest,
  ConfirmPasswordResetRequest,
  CompleteSocialSignupRequest,
  ConfirmBookingRequest,
  CustomerProviderConversation,
  CustomerProviderConversationThread,
  CrewMemberProfile,
  CompleteBookingRequest,
  CreateCheckoutSessionRequest,
  CreateCheckoutSessionResponse,
  CreateBookingDisputeRequest,
  CreateExternalCalendarImportRequest,
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
  NotificationPreferences,
  PushDevice,
  PaymentRecord,
  ProviderPayoutLedgerResponse,
  PlaceSearchResponse,
  ProcessReviewInvitesRequest,
  ProcessReviewInvitesResponse,
  CreateProviderReviewRequest,
  CreateCustomerPropertyRequest,
  CreateBookingRequest,
  FinalizeCheckoutSessionRequest,
  InstantQuoteRequest,
  InstantQuoteResponse,
  CreatePaymentIntentRequest,
  CreateRefundRequest,
  CreateSupportTicketRequest,
  ObservabilityOverview,
  ProviderCrewConversation,
  ProviderCalendarSubscriptionResponse,
  ProviderCalendarImportsResponse,
  ProviderCalendarOverviewResponse,
  ProviderProfile,
  ProviderStaffingOverview,
  ProviderReview,
  RegisterUserRequest,
  RegisterPushDeviceRequest,
  MarkBookingOnRouteRequest,
  MarkBookingLateRequest,
  MarkBookingExceptionRequest,
  ReviewCrewMatchRequest,
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

  public getProviderProfile(providerId: string): Promise<ProviderProfile> {
    return this.getJson<ProviderProfile>(
      `${ApiRoutes.providerProfile}?providerId=${encodeURIComponent(providerId)}`
    );
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

  public updateProviderSettings(payload: UpdateProviderSettingsRequest) {
    return this.postJson<ProviderProfile>(ApiRoutes.updateProviderSettings, payload);
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

  public removeProviderCalendarImport(payload: RemoveExternalCalendarImportRequest) {
    return this.postJson<ProviderCalendarImportsResponse>(ApiRoutes.providerCalendarImportsRemove, payload);
  }

  public getNotifications(): Promise<NotificationListResponse> {
    return this.getJson(ApiRoutes.notifications);
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

  public startBooking(payload: StartBookingRequest) {
    return this.postJson<Booking>(ApiRoutes.startBooking, payload);
  }

  public completeBooking(payload: CompleteBookingRequest) {
    return this.postJson<Booking>(ApiRoutes.completeBooking, payload);
  }

  public markBookingOnRoute(payload: MarkBookingOnRouteRequest) {
    return this.postJson<Booking>(ApiRoutes.markBookingOnRoute, payload);
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
