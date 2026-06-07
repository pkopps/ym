import {
  AppNotification,
  AnalyticsEvent,
  AuthenticatedUserEnvelope,
  BookingArrivalTracking,
  Booking,
  CancelBookingRequest,
  ConfirmBookingRequest,
  CustomerProviderConversation,
  CustomerProviderConversationThread,
  CrewMemberProfile,
  CompleteBookingRequest,
  CreateCheckoutSessionRequest,
  CreateCheckoutSessionResponse,
  CreateBookingDisputeRequest,
  CrewMatchesResponse,
  CrewOpportunity,
  CustomerProperty,
  GoogleAuthStartRequest,
  CurrentUserResponse,
  LoginRequest,
  MarkNotificationsReadRequest,
  ListCustomerReviewOpportunitiesResponse,
  NotificationDeliveriesResponse,
  NotificationListResponse,
  NotificationPreferences,
  PaymentRecord,
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
  ProviderProfile,
  ProviderStaffingOverview,
  ProviderReview,
  RegisterUserRequest,
  MarkBookingOnRouteRequest,
  MarkBookingLateRequest,
  MarkBookingExceptionRequest,
  ReviewCrewMatchRequest,
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

  public constructor(private readonly baseUrl: string) {}

  public setAuthToken(token: string | undefined): void {
    this.authToken = token;
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
      throw new Error(`Request failed for ${path} with status ${response.status}`);
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
      throw new Error(`Request failed for ${path} with status ${response.status}`);
    }

    return (await response.json()) as TResponse;
  }

  public registerUser(payload: RegisterUserRequest): Promise<AuthenticatedUserEnvelope> {
    return this.postJson(ApiRoutes.register, payload);
  }

  public login(payload: LoginRequest): Promise<AuthenticatedUserEnvelope> {
    return this.postJson(ApiRoutes.login, payload);
  }

  public getCurrentUser(): Promise<CurrentUserResponse> {
    return this.getJson(ApiRoutes.currentUser);
  }

  public getGoogleAuthStartUrl(payload: GoogleAuthStartRequest): string {
    const query = new URLSearchParams({
      role: payload.role,
      mode: payload.mode
    });

    return `${this.baseUrl}${ApiRoutes.googleAuthStart}?${query.toString()}`;
  }

  public getAppleAuthStartUrl(payload: GoogleAuthStartRequest): string {
    const query = new URLSearchParams({
      role: payload.role,
      mode: payload.mode
    });

    return `${this.baseUrl}${ApiRoutes.appleAuthStart}?${query.toString()}`;
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
