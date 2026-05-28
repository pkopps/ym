export type MarketplaceRole = "customer" | "provider" | "crew-member";
export type AuthFlowMode = "signup" | "login";
export type AuthProvider = "google" | "apple";
export type TelemetryPlatformSurface =
  | "api"
  | "web-mobile"
  | "web-desktop"
  | "ios-phone"
  | "ios-tablet"
  | "android-phone"
  | "android-tablet";

export type ServiceCategory =
  | "lawn-mowing"
  | "hedge-trimming"
  | "mulch-installation"
  | "seasonal-cleanup"
  | "weed-control"
  | "irrigation-check"
  | "leaf-blowing"
  | "aeration"
  | "fertilization"
  | "gutter-cleaning"
  | "snow-shoveling"
  | "ice-melt-salting"
  | "snow-blowing";

export type EstimateConfidenceTier = "high" | "medium" | "low";
export type PropertySlope = "flat" | "moderate" | "steep";
export type LotComplexity = "low" | "medium" | "high";
export type FollowUpInputType = "single-select" | "number";
export type PropertyEstimateSource =
  | "licensed-imagery-model"
  | "address-heuristic"
  | "hybrid-imagery-plus-confirmation";

export type BookingStatus =
  | "requested"
  | "confirmed"
  | "in-progress"
  | "completed"
  | "disputed"
  | "refunded";

export type PaymentStatus = "authorized" | "captured" | "refunded" | "failed";

export type SupportTicketStatus = "open" | "triaged" | "resolved";
export type ReviewScore = 1 | 2 | 3 | 4 | 5;
export type ReviewInviteStatus = "scheduled" | "sent" | "opened" | "completed" | "expired";
export type NotificationChannel = "email" | "in-app" | "push";
export type CrewMemberSchedulePreference = "full-time" | "part-time" | "seasonal" | "flex";
export type CrewMemberStatus = "available" | "assigned" | "off-duty";

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  point: GeoPoint;
}

export interface CustomerProperty {
  id: string;
  label: string;
  address: Address;
  gateCode?: string;
  accessNotes?: string;
  lawnSizeSqFt?: number;
  shrubBedSqFt?: number;
  drivewaySqFt?: number;
  sidewalkLinearFt?: number;
  isDefault: boolean;
  createdAt: string;
}

export interface CalendarConnection {
  provider: "apple" | "google" | "outlook";
  connected: boolean;
  externalCalendarId?: string;
}

export interface BaseUser {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: MarketplaceRole;
  address: Address;
  createdAt: string;
}

export interface CustomerProfile extends BaseUser {
  role: "customer";
  propertyNotes: string;
  lawnSizeSqFt: number;
  properties: CustomerProperty[];
  defaultPropertyId: string;
}

export interface ProviderProfile extends BaseUser {
  role: "provider";
  companyName: string;
  bio: string;
  yearsExperience: number;
  serviceRadiusMiles: number;
  sponsoredListingEnabled: boolean;
  categories: ServiceCategory[];
  rating: number;
  timelinessRating: number;
  attentionToDetailRating: number;
  reviewCount: number;
  calendarConnection: CalendarConnection;
}

export interface CrewMemberProfile extends BaseUser {
  role: "crew-member";
  bio: string;
  yearsExperience: number;
  categories: ServiceCategory[];
  willingToTravelMiles: number;
  preferredSchedule: CrewMemberSchedulePreference;
  hasOwnEquipment: boolean;
  rating: number;
  completedJobs: number;
  status: CrewMemberStatus;
  assignedProviderId?: string;
}

export interface CrewOpportunity {
  id: string;
  providerId: string;
  providerCompanyName: string;
  title: string;
  categories: ServiceCategory[];
  city: string;
  state: string;
  hourlyRateCents: number;
  preferredSchedule: CrewMemberSchedulePreference;
  requiresEquipmentOwnership: boolean;
  summary: string;
}

export interface CrewAssignment {
  id: string;
  providerId: string;
  crewMemberId: string;
  bookingId?: string;
  title: string;
  startIso: string;
  endIso: string;
  meetingPoint: Address;
  notes: string;
  status: "scheduled" | "checked-in" | "completed";
}

export interface AvailabilitySlot {
  id: string;
  providerId: string;
  startIso: string;
  endIso: string;
  isBooked: boolean;
}

export interface Booking {
  id: string;
  customerId: string;
  providerId: string;
  serviceAddress: Address;
  servicePropertyId?: string;
  category: ServiceCategory;
  requestedAt: string;
  scheduledStartIso: string;
  scheduledEndIso: string;
  status: BookingStatus;
  completedAt?: string;
  notes: string;
  totalCents: number;
  reviewId?: string;
  addressChangeHistory: BookingAddressChangeRequest[];
}

export interface ProviderReview {
  id: string;
  bookingId: string;
  providerId: string;
  customerId: string;
  overallRating: ReviewScore;
  timelinessRating: ReviewScore;
  attentionToDetailRating: ReviewScore;
  reviewText: string;
  createdAt: string;
}

export interface ReviewInvite {
  id: string;
  bookingId: string;
  customerId: string;
  providerId: string;
  email: string;
  status: ReviewInviteStatus;
  channels: NotificationChannel[];
  scheduledSendIso: string;
  sentAt?: string;
  openedAt?: string;
  completedAt?: string;
  expiresAtIso: string;
  deepLinkPath: string;
}

export interface CustomerReviewOpportunity {
  bookingId: string;
  providerId: string;
  providerName: string;
  category: ServiceCategory;
  completedAt?: string;
  inviteStatus?: ReviewInviteStatus;
  inviteScheduledSendIso?: string;
  inviteSentAt?: string;
  reviewSubmittedAt?: string;
  canReviewNow: boolean;
  reviewAlreadySubmitted: boolean;
  reason: string;
}

export interface PaymentRecord {
  id: string;
  bookingId: string;
  amountCents: number;
  status: PaymentStatus;
  refundable: boolean;
  refundReason?: string;
}

export interface SupportTicket {
  id: string;
  bookingId?: string;
  requesterId: string;
  subject: string;
  description: string;
  issueType: "billing" | "service-quality" | "account" | "general";
  status: SupportTicketStatus;
  createdAt: string;
}

export interface RegisterUserRequest {
  fullName: string;
  email: string;
  password: string;
  phone: string;
  role: MarketplaceRole;
  address: Address;
  companyName?: string;
  bio?: string;
  yearsExperience?: number;
  serviceRadiusMiles?: number;
  categories?: ServiceCategory[];
  propertyNotes?: string;
  lawnSizeSqFt?: number;
  propertyLabel?: string;
  willingToTravelMiles?: number;
  preferredSchedule?: CrewMemberSchedulePreference;
  hasOwnEquipment?: boolean;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthenticatedSession {
  token: string;
  expiresInSeconds: number;
}

export interface AuthenticatedUserEnvelope {
  session: AuthenticatedSession;
  user: CustomerProfile | ProviderProfile | CrewMemberProfile;
}

export interface CurrentUserResponse {
  user: CustomerProfile | ProviderProfile | CrewMemberProfile;
}

export interface GoogleAuthStartRequest {
  role: MarketplaceRole;
  mode: AuthFlowMode;
}

export interface GoogleAuthStartResponse {
  provider: AuthProvider;
  role: MarketplaceRole;
  mode: AuthFlowMode;
  redirectUrl: string;
  status: "demo-redirect";
}

export interface SearchProvidersRequest {
  address: Address;
  categories: ServiceCategory[];
  dateIso: string;
  estimatedDurationMinutes?: number;
}

export interface SearchProvidersResponse {
  providers: ProviderProfile[];
  suggestedSlots: AvailabilitySlot[];
}

export interface CreateBookingRequest {
  providerId: string;
  serviceAddress: Address;
  servicePropertyId?: string;
  category: ServiceCategory;
  scheduledStartIso: string;
  scheduledEndIso: string;
  notes: string;
  totalCents: number;
}

export interface CreateCustomerPropertyRequest {
  label: string;
  address: Address;
  gateCode?: string;
  accessNotes?: string;
  lawnSizeSqFt?: number;
  shrubBedSqFt?: number;
  drivewaySqFt?: number;
  sidewalkLinearFt?: number;
  setAsDefault?: boolean;
}

export interface SetDefaultCustomerPropertyRequest {
  propertyId: string;
}

export interface UpdateProviderSettingsRequest {
  serviceRadiusMiles: number;
  sponsoredListingEnabled?: boolean;
}

export interface BookingAddressChangeRequest {
  id: string;
  bookingId: string;
  previousAddress: Address;
  requestedAddress: Address;
  requestedPropertyId?: string;
  requestedAt: string;
  requestedByCustomerId: string;
  outcome: "updated" | "requires-provider-review" | "blocked";
  reason: string;
}

export interface UpdateBookingAddressRequest {
  bookingId: string;
  newAddress: Address;
  newPropertyId?: string;
}

export interface UpdateBookingAddressResponse {
  booking: Booking;
  outcome: "updated" | "requires-provider-review" | "blocked";
  reason: string;
}

export interface QuoteFollowUpAnswer {
  questionId: string;
  value: string | number;
}

export interface QuoteFollowUpQuestion {
  id: string;
  prompt: string;
  inputType: FollowUpInputType;
  helperText: string;
  options?: Array<{
    label: string;
    value: string;
  }>;
  min?: number;
  max?: number;
}

export interface PropertyMeasurementEstimate {
  turfSqFt: number;
  shrubBedSqFt: number;
  drivewaySqFt: number;
  sidewalkLinearFt: number;
  lotComplexity: LotComplexity;
  slope: PropertySlope;
}

export interface InstantQuoteRequest {
  address: Address;
  category: ServiceCategory;
  propertyId?: string;
  customerId?: string;
  followUpAnswers?: QuoteFollowUpAnswer[];
}

export interface InstantQuoteResponse {
  address: Address;
  category: ServiceCategory;
  source: PropertyEstimateSource;
  confidenceScore: number;
  confidenceTier: EstimateConfidenceTier;
  estimatedPriceCents: number;
  estimatedDurationMinutes: number;
  estimatedCrewSize: number;
  estimateSummary: string;
  measurements: PropertyMeasurementEstimate;
  followUpQuestions: QuoteFollowUpQuestion[];
  quoteReadyForCheckout: boolean;
}

export interface CreatePaymentIntentRequest {
  bookingId: string;
  amountCents: number;
}

export interface CreateRefundRequest {
  paymentId: string;
  reason: string;
}

export interface CreateSupportTicketRequest {
  bookingId?: string;
  subject: string;
  description: string;
  issueType: "billing" | "service-quality" | "account" | "general";
}

export interface CompleteBookingRequest {
  bookingId: string;
}

export interface CreateProviderReviewRequest {
  bookingId: string;
  overallRating: ReviewScore;
  timelinessRating: ReviewScore;
  attentionToDetailRating: ReviewScore;
  reviewText: string;
}

export interface ListCustomerReviewOpportunitiesResponse {
  opportunities: CustomerReviewOpportunity[];
}

export interface ProcessReviewInvitesRequest {
  nowIso?: string;
}

export interface ReviewInviteDispatch {
  inviteId: string;
  bookingId: string;
  customerId: string;
  email: string;
  scheduledSendIso: string;
  sentAt: string;
  deepLinkPath: string;
  subject: string;
  templateKey: string;
}

export interface ProcessReviewInvitesResponse {
  dispatches: ReviewInviteDispatch[];
}

export interface AnalyticsEvent {
  id: string;
  name: string;
  occurredAt: string;
  actorId?: string;
  properties: Record<string, string | number | boolean>;
}

export interface SessionHeartbeatRequest {
  sessionId: string;
  actorId?: string;
  role?: MarketplaceRole;
  platform: TelemetryPlatformSurface;
  path: string;
  occurredAt: string;
}

export interface ActiveSession {
  sessionId: string;
  actorId?: string;
  role?: MarketplaceRole;
  platform: TelemetryPlatformSurface;
  path: string;
  lastSeenAt: string;
}

export interface ObservabilityOverview {
  generatedAt: string;
  totalBookings: number;
  requestedBookings: number;
  bookingsLast24Hours: number;
  refundRequestedCount: number;
  openSupportTickets: number;
  activeUsers5m: number;
  activeCustomers5m: number;
  activeProviders5m: number;
  activeCrewMembers5m: number;
  activeUsersByPlatform: Partial<Record<TelemetryPlatformSurface, number>>;
  recentEvents: AnalyticsEvent[];
}
