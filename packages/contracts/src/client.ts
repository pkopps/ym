import {
  AnalyticsEvent,
  AuthenticatedUserEnvelope,
  Booking,
  CancelBookingRequest,
  CustomerProviderConversation,
  CustomerProviderConversationThread,
  CrewMemberProfile,
  CompleteBookingRequest,
  CrewMatchesResponse,
  CrewOpportunity,
  CustomerProperty,
  GoogleAuthStartRequest,
  CurrentUserResponse,
  LoginRequest,
  ListCustomerReviewOpportunitiesResponse,
  ProcessReviewInvitesRequest,
  ProcessReviewInvitesResponse,
  CreateProviderReviewRequest,
  CreateCustomerPropertyRequest,
  CreateBookingRequest,
  InstantQuoteRequest,
  InstantQuoteResponse,
  CreatePaymentIntentRequest,
  CreateRefundRequest,
  CreateSupportTicketRequest,
  ObservabilityOverview,
  ProviderCrewConversation,
  ProviderProfile,
  ProviderStaffingOverview,
  ProviderReview,
  RegisterUserRequest,
  MarkBookingOnRouteRequest,
  ReviewCrewMatchRequest,
  RescheduleBookingRequest,
  SendCustomerProviderMessageRequest,
  SendProviderCrewMessageRequest,
  SetDefaultCustomerPropertyRequest,
  SessionHeartbeatRequest,
  SearchProvidersRequest,
  SearchProvidersResponse,
  ProviderCrewConversationThread,
  UpdateCrewPreferencesRequest,
  UpdateProviderSettingsRequest,
  UpdateBookingAddressRequest
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

  public completeBooking(payload: CompleteBookingRequest) {
    return this.postJson<Booking>(ApiRoutes.completeBooking, payload);
  }

  public markBookingOnRoute(payload: MarkBookingOnRouteRequest) {
    return this.postJson<Booking>(ApiRoutes.markBookingOnRoute, payload);
  }

  public updateBookingAddress(payload: UpdateBookingAddressRequest) {
    return this.postJson(ApiRoutes.updateBookingAddress, payload);
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
