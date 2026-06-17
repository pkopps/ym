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
export type PropertyMeasurementSource = "saved-property" | "customer-follow-up" | "address-heuristic";
export type QuoteConfidenceReasonImpact = "positive" | "warning";
export type PropertyEstimateSource =
  | "licensed-imagery-model"
  | "address-heuristic"
  | "hybrid-imagery-plus-confirmation";

export type BookingStatus =
  | "requested"
  | "confirmed"
  | "in-progress"
  | "completed"
  | "cancelled"
  | "disputed"
  | "refunded";
export type RecurringServiceFrequency = "weekly" | "biweekly";
export type RecurringServicePlanStatus = "active" | "cancelled";

export type PaymentStatus = "pending" | "authorized" | "captured" | "refunded" | "failed";
export type PaymentProcessor = "manual" | "stripe";
export type RefundReviewStatus = "requested" | "approved" | "denied";
export type RefundActorRole = "customer" | "provider" | "ops";
export type PayoutLedgerStatus =
  | "awaiting-customer-payment"
  | "on-hold"
  | "scheduled"
  | "ready"
  | "paid"
  | "reversed";

export type SupportTicketStatus = "open" | "triaged" | "resolved";
export type SupportIssueType = "billing" | "service-quality" | "account" | "general";
export type SupportBookingResolution =
  | "restore-active-booking"
  | "cancel-booking"
  | "complete-booking"
  | "approve-refund"
  | "deny-refund";
export type OpsBookingInterventionAction =
  | "add-note"
  | "reschedule-booking"
  | "restore-active-booking"
  | "cancel-booking"
  | "complete-booking"
  | "provider-assistant-set-route-stop"
  | "provider-assistant-clear-route-stop"
  | "provider-assistant-accept-best-crew-match"
  | "provider-assistant-accept-crew-match"
  | "provider-assistant-deny-crew-match"
  | "provider-assistant-message-crew"
  | "provider-assistant-assign-route-leader"
  | "provider-assistant-clear-route-leader"
  | "provider-assistant-confirm-booking"
  | "provider-assistant-complete-booking"
  | "provider-assistant-report-exception"
  | "provider-assistant-reschedule"
  | "provider-assistant-late-update"
  | "provider-assistant-start-route"
  | "provider-assistant-start-work";
export type ProviderAssistantActionType =
  | "summarize-dispatch"
  | "recommend-dispatch-adjustment"
  | "recommend-staffing-adjustment"
  | "set-route-stop"
  | "clear-route-stop"
  | "accept-best-crew-match"
  | "accept-crew-match"
  | "deny-crew-match"
  | "message-crew"
  | "assign-route-leader"
  | "clear-route-leader"
  | "confirm-booking"
  | "complete-booking"
  | "report-booking-exception"
  | "reschedule-booking"
  | "mark-booking-late"
  | "start-route"
  | "start-work";
export type PlaceSuggestionSource = "google-geocoding" | "local-dataset";
export type ReviewScore = 1 | 2 | 3 | 4 | 5;
export type ReviewInviteStatus = "scheduled" | "sent" | "opened" | "completed" | "expired";
export type NotificationChannel = "email" | "in-app" | "push" | "sms";
export type AppNotificationCategory = "booking" | "staffing" | "review" | "support" | "account";
export type NotificationDeliveryStatus = "queued" | "sent" | "failed" | "skipped";
export type PushDevicePlatform = "ios" | "android";
export type PushDeviceProvider = "expo";
export type CrewMemberSchedulePreference = "full-time" | "part-time" | "seasonal" | "flex";
export type CrewMemberStatus = "available" | "assigned" | "off-duty";
export type CrewAvailabilityDay = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
export type ProviderStaffingMode = "auto-accept" | "review-first";
export type ProviderRouteLeaderMode = "provider-only" | "accepted-crew-fallback";
export type ProviderVerificationStatus = "pending-review" | "verified" | "rejected";
export type ProviderPayoutWeekday = CrewAvailabilityDay;
export type CrewMatchStatus = "pending-provider-review" | "accepted" | "denied" | "cancelled-by-crew";
export type ExternalCalendarBlockType =
  | "off-platform-client"
  | "personal-time"
  | "travel-buffer"
  | "equipment-maintenance";
export type ExternalCalendarProvider = "google" | "apple" | "ical";
export type ExternalCalendarSubscriptionStatus = "active" | "error";
export type ProviderCalendarSyncHealthStatus = "healthy" | "attention" | "at-risk";
export type BookingArrivalTrackingStatus =
  | "unavailable"
  | "not-started"
  | "on-route"
  | "arrived"
  | "completed";
export type BookingRouteStopKind = "equipment-pickup" | "staging";
export type BookingServiceWindowKey = "morning" | "afternoon" | "late-afternoon-night";
export type ProviderCalendarEventSource = "yardmatch-booking" | "external-block";
export type ProviderDispatchRouteStatus = "comfortable" | "watch" | "overloaded";
export type BookingRouteLocationSource = "computed-origin" | "provider-device" | "crew-device";
export type BookingEvidencePhase = "before" | "after";
export type BookingEvidenceType = "photo" | "note" | "checklist";
export type BookingEvidenceReviewStatus = "supports-provider" | "supports-customer" | "inconclusive";
export type BookingExceptionType =
  | "customer-no-show"
  | "customer-not-ready"
  | "unable-to-access-property"
  | "service-could-not-be-completed";

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
  geocodeCacheKey?: string;
  geocodedAt?: string;
  geocodePrecision?: "address" | "postal-code" | "city" | "customer-provided";
  geocodeProvider?: "google-address-validation" | "google-geocoding" | "customer-provided";
}

export interface BookingRouteStop {
  id: string;
  kind: BookingRouteStopKind;
  label: string;
  address: Address;
  createdAt: string;
  reachedAt?: string;
}

export interface PlaceSuggestion {
  id: string;
  label: string;
  source: PlaceSuggestionSource;
  matchQuality?: "high" | "medium" | "low";
  matchReason?: string;
  address: Address;
}

export interface PlaceSearchResponse {
  query: string;
  searchMode: "google-geocoding" | "local-dataset" | "none";
  searchConfidence: "high" | "medium" | "low";
  searchMessage?: string;
  suggestions: PlaceSuggestion[];
}

export interface ReverseGeocodePlaceRequest {
  latitude: number;
  longitude: number;
}

export function isPlaceSuggestionSafeToAutoSelect(
  suggestion: PlaceSuggestion | undefined
): boolean {
  if (!suggestion) {
    return false;
  }

  if (suggestion.source === "google-geocoding") {
    return true;
  }

  return suggestion.matchQuality === "high";
}

export interface ExternalCalendarBlock {
  id: string;
  title: string;
  blockType: ExternalCalendarBlockType;
  startIso: string;
  endIso: string;
  notes?: string;
  source: "manual" | "calendar-import";
  createdAt: string;
  subscriptionId?: string;
}

export interface ExternalCalendarSubscription {
  id: string;
  title: string;
  provider: ExternalCalendarProvider;
  feedUrl: string;
  importedEventCount: number;
  lastSyncedAt?: string;
  syncStatus: ExternalCalendarSubscriptionStatus;
  lastError?: string;
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
  feedToken?: string;
  lastSyncedAt?: string;
  externalEventsBlockingEnabled?: boolean;
  externalBlocks?: ExternalCalendarBlock[];
  externalSubscriptions?: ExternalCalendarSubscription[];
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
  minimumBookingLeadHours: number;
  staffingMode?: ProviderStaffingMode;
  crewReviewLeadHours: number;
  departureReminderLeadMinutes: number;
  routeLeaderMode: ProviderRouteLeaderMode;
  weeklyPayoutDay: ProviderPayoutWeekday;
  instantPayoutsEnabled: boolean;
  verificationStatus: ProviderVerificationStatus;
  verificationSubmittedAt?: string;
  verificationReviewedAt?: string;
  verificationNotes?: string;
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
  availableWeekdays?: CrewAvailabilityDay[];
  willingToTravelMiles: number;
  preferredSchedule: CrewMemberSchedulePreference;
  hasOwnEquipment: boolean;
  winterWorkEnabled?: boolean;
  rating: number;
  completedJobs: number;
  cancellationCount: number;
  lastCancellationAt?: string;
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
  neededByStartIso: string;
  neededByEndIso: string;
  hourlyRateCents: number;
  preferredSchedule: CrewMemberSchedulePreference;
  requiresEquipmentOwnership: boolean;
  trainingProvided: boolean;
  equipmentProvided: boolean;
  summary: string;
}

export interface CrewMatchCandidate {
  id: string;
  bookingId: string;
  providerId: string;
  crewMemberId: string;
  crewMemberName: string;
  crewMemberPhone: string;
  categories: ServiceCategory[];
  availableWeekdays: CrewAvailabilityDay[];
  preferredSchedule: CrewMemberSchedulePreference;
  willingToTravelMiles: number;
  hasOwnEquipment: boolean;
  winterWorkEnabled: boolean;
  status: CrewMatchStatus;
  autoAccepted: boolean;
  distanceMiles: number;
  hourlyRateCents: number;
  recommendationScore?: number;
  recommendationLabel?: "best-fit" | "good-fit" | "backup";
  recommendationReasons?: string[];
  cancellationReason?: string;
  cancelledAt?: string;
  createdAt: string;
  reviewedAt?: string;
}

export interface ProviderStaffingJobSummary {
  bookingId: string;
  customerName: string;
  serviceAddress: Address;
  category: ServiceCategory;
  status: BookingStatus;
  scheduledStartIso: string;
  scheduledEndIso: string;
  assignedRouteLeaderCrewMemberId?: string;
  assignedRouteLeaderCrewMemberName?: string;
  requiresRouteLeaderAssignment: boolean;
  onRouteConfirmedAt?: string;
  onRouteConfirmedByCrewMemberId?: string;
  lateNoticeSentAt?: string;
  lateEtaIso?: string;
  lateReason?: string;
  activeExceptionType?: BookingExceptionType;
  activeExceptionReportedAt?: string;
  activeExceptionNotes?: string;
  routeActiveStop?: BookingRouteStop;
  routeLivePoint?: GeoPoint;
  routeLiveUpdatedAt?: string;
  routeLiveSource?: BookingRouteLocationSource;
  routeLiveSpeedMph?: number;
  routeLiveAccuracyMeters?: number;
  disputedAt?: string;
  disputeReason?: string;
  disputedByRole?: "customer" | "provider";
  beforeEvidenceCount: number;
  afterEvidenceCount: number;
  totalCents: number;
  requiredCrewMembers: number;
  assignedCrewMembers: number;
  crewGap: number;
  matches: CrewMatchCandidate[];
}

export interface ProviderStaffingOverview {
  provider: ProviderProfile;
  jobs: ProviderStaffingJobSummary[];
}

export interface CrewMatchSummary {
  id: string;
  bookingId: string;
  providerId: string;
  providerCompanyName: string;
  providerPhone: string;
  category: ServiceCategory;
  serviceAddress: Address;
  scheduledStartIso: string;
  scheduledEndIso: string;
  bookingStatus: BookingStatus;
  assignedRouteLeaderCrewMemberId?: string;
  isAssignedRouteLeader: boolean;
  requiresRouteLeaderAssignment: boolean;
  onRouteConfirmedAt?: string;
  lateNoticeSentAt?: string;
  lateEtaIso?: string;
  lateReason?: string;
  activeExceptionType?: BookingExceptionType;
  activeExceptionReportedAt?: string;
  activeExceptionNotes?: string;
  disputedAt?: string;
  disputeReason?: string;
  disputedByRole?: "customer" | "provider";
  beforeEvidenceCount: number;
  afterEvidenceCount: number;
  status: CrewMatchStatus;
  hourlyRateCents: number;
  canChat: boolean;
  summary: string;
  cancellationReason?: string;
  cancelledAt?: string;
}

export interface CrewMatchesResponse {
  crewMember: CrewMemberProfile;
  matches: CrewMatchSummary[];
}

export interface ProviderCrewConversation {
  id: string;
  crewMatchId: string;
  bookingId: string;
  providerId: string;
  crewMemberId: string;
  providerName: string;
  crewMemberName: string;
  status: CrewMatchStatus;
  updatedAt: string;
  lastMessagePreview?: string;
  unreadCount: number;
}

export interface ProviderCrewMessage {
  id: string;
  threadId: string;
  senderId: string;
  senderRole: "provider" | "crew-member";
  body: string;
  createdAt: string;
}

export interface ProviderCrewConversationThread {
  thread: ProviderCrewConversation;
  messages: ProviderCrewMessage[];
}

export interface CustomerProviderConversation {
  id: string;
  bookingId: string;
  customerId: string;
  providerId: string;
  customerName: string;
  providerName: string;
  updatedAt: string;
  lastMessagePreview?: string;
  unreadCount: number;
}

export interface CustomerProviderMessage {
  id: string;
  threadId: string;
  senderId: string;
  senderRole: "customer" | "provider";
  body: string;
  createdAt: string;
}

export interface CustomerProviderConversationThread {
  thread: CustomerProviderConversation;
  messages: CustomerProviderMessage[];
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
  recurringPlanId?: string;
  recurringOccurrenceIndex?: number;
  serviceAddress: Address;
  servicePropertyId?: string;
  category: ServiceCategory;
  requestedAt: string;
  scheduledStartIso: string;
  scheduledEndIso: string;
  status: BookingStatus;
  assignedRouteLeaderCrewMemberId?: string;
  onRouteConfirmedAt?: string;
  onRouteConfirmedByCrewMemberId?: string;
  lateNoticeSentAt?: string;
  lateEtaIso?: string;
  lateReason?: string;
  activeExceptionType?: BookingExceptionType;
  activeExceptionReportedAt?: string;
  activeExceptionNotes?: string;
  routeActiveStop?: BookingRouteStop;
  routeLivePoint?: GeoPoint;
  routeLiveUpdatedAt?: string;
  routeLiveSource?: BookingRouteLocationSource;
  routeLiveSpeedMph?: number;
  routeLiveAccuracyMeters?: number;
  disputedAt?: string;
  disputeReason?: string;
  disputedByRole?: "customer" | "provider";
  completedAt?: string;
  notes: string;
  totalCents: number;
  reviewId?: string;
  serviceEvidence: BookingEvidenceEntry[];
  interventions: BookingInterventionRecord[];
  addressChangeHistory: BookingAddressChangeRequest[];
}

export interface BookingInterventionRecord {
  id: string;
  action: OpsBookingInterventionAction;
  createdAt: string;
  actorRole: "ops" | "provider-assistant";
  actorUserId: string;
  note: string;
  ticketId?: string;
  previousStatus?: BookingStatus;
  nextStatus?: BookingStatus;
  previousScheduledStartIso?: string;
  previousScheduledEndIso?: string;
  nextScheduledStartIso?: string;
  nextScheduledEndIso?: string;
}

export interface BookingEvidenceChecklistItem {
  label: string;
  completed: boolean;
}

export interface BookingEvidenceEntry {
  id: string;
  phase: BookingEvidencePhase;
  evidenceType: BookingEvidenceType;
  capturedAt: string;
  capturedByRole: "provider" | "crew-member";
  capturedByUserId: string;
  imageDataUrl?: string;
  note?: string;
  checklistItems?: BookingEvidenceChecklistItem[];
  reviewStatus?: BookingEvidenceReviewStatus;
  reviewNotes?: string;
  reviewedAt?: string;
  reviewedByRole?: "ops";
  reviewedByUserId?: string;
}

export interface BookingArrivalTracking {
  bookingId: string;
  status: BookingArrivalTrackingStatus;
  customerId: string;
  providerId: string;
  crewMemberId?: string;
  crewMemberName?: string;
  destination: Address;
  currentPoint?: GeoPoint;
  routeStartPoint?: GeoPoint;
  currentLegDestination?: Address;
  activeRouteStop?: BookingRouteStop;
  source: BookingRouteLocationSource;
  liveUpdatedAt?: string;
  isLiveLocationStale?: boolean;
  progressPercent: number;
  remainingLegDistanceMiles?: number;
  remainingDistanceMiles?: number;
  etaToCurrentLegMinutes?: number;
  etaMinutes?: number;
  unlockedAt?: string;
  lastComputedAt: string;
  message: string;
}

export interface RecurringServicePlan {
  id: string;
  customerId: string;
  providerId: string;
  serviceAddress: Address;
  servicePropertyId?: string;
  category: ServiceCategory;
  frequency: RecurringServiceFrequency;
  requestedAt: string;
  notes: string;
  totalCents: number;
  status: RecurringServicePlanStatus;
  anchorScheduledStartIso: string;
  anchorScheduledEndIso: string;
  lastGeneratedBookingId?: string;
  lastGeneratedAt?: string;
  lastSchedulingAttemptAt?: string;
  lastSchedulingError?: string;
  cancelledAt?: string;
  cancellationReason?: string;
}

export interface RecurringServicePlanSummary {
  plan: RecurringServicePlan;
  providerName: string;
  upcomingBooking?: Booking;
  completedOccurrenceCount: number;
  activeOccurrenceCount: number;
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
  currency: string;
  status: PaymentStatus;
  processor: PaymentProcessor;
  refundable: boolean;
  checkoutSessionId?: string;
  checkoutSessionUrl?: string;
  processorPaymentIntentId?: string;
  refundReason?: string;
  refundReviewStatus?: RefundReviewStatus;
  refundRequestedAt?: string;
  refundRequestedByRole?: RefundActorRole;
  refundReviewedAt?: string;
  refundReviewedByRole?: RefundActorRole;
  refundDecisionNotes?: string;
  failureReason?: string;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderPayoutLedgerEntry {
  id: string;
  bookingId: string;
  customerName: string;
  serviceDateIso: string;
  serviceLabel: string;
  addressLine: string;
  grossAmountCents: number;
  crewShareCents: number;
  providerNetAmountCents: number;
  crewMembersAssigned: number;
  paymentId?: string;
  paymentStatus?: PaymentStatus;
  status: PayoutLedgerStatus;
  availableAtIso?: string;
  note: string;
}

export interface ProviderPayoutScheduleSummary {
  weeklyPayoutDay: ProviderPayoutWeekday;
  nextWeeklyPayoutDateIso: string;
  holdPeriodHours: number;
  instantPayoutsEnabled: boolean;
  instantPayoutMinimumCents: number;
  instantPayoutEligibleCents: number;
}

export interface ProviderPayoutLedgerResponse {
  providerId: string;
  totalGrossCapturedCents: number;
  totalNetReadyCents: number;
  totalNetScheduledCents: number;
  totalCrewOwedCents: number;
  pendingCustomerPaymentCents: number;
  payoutSchedule: ProviderPayoutScheduleSummary;
  entries: ProviderPayoutLedgerEntry[];
}

export interface CrewPayoutLedgerEntry {
  id: string;
  bookingId: string;
  providerId: string;
  providerCompanyName: string;
  serviceDateIso: string;
  serviceLabel: string;
  addressLine: string;
  amountCents: number;
  paymentId?: string;
  paymentStatus?: PaymentStatus;
  status: PayoutLedgerStatus;
  availableAtIso?: string;
  note: string;
}

export interface CrewPayoutLedgerResponse {
  crewMemberId: string;
  totalReadyCents: number;
  totalScheduledCents: number;
  totalPaidCents: number;
  pendingCustomerPaymentCents: number;
  nextWeeklyPayoutDateIso: string;
  holdPeriodHours: number;
  entries: CrewPayoutLedgerEntry[];
}

export interface OpsProviderPayoutRunPreviewItem {
  runDateIso: string;
  providerCount: number;
  bookingCount: number;
  providerNetCents: number;
  crewShareCents: number;
  providerIds: string[];
}

export interface OpsPayoutRunPreviewResponse {
  generatedAt: string;
  totalProviderReadyCents: number;
  totalCrewReadyCents: number;
  totalAwaitingCustomerPaymentCents: number;
  onHoldEntryCount: number;
  providerInstantEligibleCount: number;
  crewNextWeeklyPayoutDateIso: string;
  providerRuns: OpsProviderPayoutRunPreviewItem[];
}

export interface SupportTicket {
  id: string;
  bookingId?: string;
  requesterId: string;
  subject: string;
  description: string;
  issueType: SupportIssueType;
  status: SupportTicketStatus;
  createdAt: string;
  updatedAt: string;
  triagedAt?: string;
  resolvedAt?: string;
  resolutionNotes?: string;
  resolutionAction?: SupportBookingResolution;
}

export interface SupportEvidenceSummary {
  photoCount: number;
  noteCount: number;
  checklistCount: number;
  reviewedCount: number;
  unreviewedCount: number;
  supportsProviderCount: number;
  supportsCustomerCount: number;
  inconclusiveCount: number;
}

export interface SupportResolutionGuidance {
  recommendedAction?: SupportBookingResolution;
  confidence: "high" | "medium" | "low";
  rationale: string;
}

export type SupportTimelineActorRole =
  | MarketplaceRole
  | "ops"
  | "provider-assistant"
  | "system";

export type SupportTimelineEntryKind =
  | "ticket-opened"
  | "ticket-triaged"
  | "ticket-resolved"
  | "refund-review-opened"
  | "refund-review-resolved"
  | "booking-intervention"
  | "evidence-reviewed";

export interface SupportTimelineEntry {
  id: string;
  occurredAt: string;
  actorRole: SupportTimelineActorRole;
  kind: SupportTimelineEntryKind;
  title: string;
  detail: string;
}

export interface SupportOpsTicket {
  ticket: SupportTicket;
  booking?: Booking;
  payment?: PaymentRecord;
  customerName?: string;
  providerName?: string;
  evidenceSummary?: SupportEvidenceSummary;
  resolutionGuidance?: SupportResolutionGuidance;
  timeline: SupportTimelineEntry[];
}

export interface OpsRefundSummaryItem {
  bookingId: string;
  paymentId: string;
  customerName?: string;
  providerName?: string;
  amountCents: number;
  bookingStatus: BookingStatus;
  paymentStatus: PaymentStatus;
  refundReviewStatus?: RefundReviewStatus;
  refundReason?: string;
  refundRequestedAt?: string;
  refundRequestedByRole?: RefundActorRole;
}

export interface OpsBookingExceptionSummaryItem {
  bookingId: string;
  customerName?: string;
  providerName?: string;
  category: ServiceCategory;
  bookingStatus: BookingStatus;
  exceptionType: BookingExceptionType;
  reportedAt?: string;
  notes?: string;
}

export interface OpsFinancialExceptionSummaryResponse {
  generatedAt: string;
  refundReviewOpenCount: number;
  refundedAmountLast30DaysCents: number;
  payoutHoldCount: number;
  activeBookingExceptionCount: number;
  disputedBookingCount: number;
  openBillingTicketCount: number;
  refundReviews: OpsRefundSummaryItem[];
  activeExceptions: OpsBookingExceptionSummaryItem[];
}

export interface ProviderVerificationQueueItem {
  provider: ProviderProfile;
  openBookingCount: number;
  reviewCount: number;
}

export interface AppNotification {
  id: string;
  recipientId: string;
  recipientRole: MarketplaceRole;
  category: AppNotificationCategory;
  title: string;
  body: string;
  actionHref?: string;
  isRead: boolean;
  createdAt: string;
  readAt?: string;
}

export interface NotificationPreferences {
  userId: string;
  role: MarketplaceRole;
  emailEnabled: boolean;
  smsEnabled: boolean;
  pushEnabled: boolean;
  reviewRemindersEnabled: boolean;
  updatedAt: string;
}

export interface PushDevice {
  id: string;
  userId: string;
  role: MarketplaceRole;
  platform: PushDevicePlatform;
  provider: PushDeviceProvider;
  token: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastSeenAt: string;
}

export interface RegisterPushDeviceRequest {
  platform: PushDevicePlatform;
  provider: PushDeviceProvider;
  token: string;
}

export interface RemovePushDeviceRequest {
  token: string;
}

export interface UpdateNotificationPreferencesRequest {
  emailEnabled?: boolean;
  smsEnabled?: boolean;
  pushEnabled?: boolean;
  reviewRemindersEnabled?: boolean;
}

export interface NotificationDeliveryRecord {
  id: string;
  notificationId: string;
  recipientId: string;
  recipientRole: MarketplaceRole;
  category: AppNotificationCategory;
  channel: NotificationChannel;
  destination: string;
  provider: string;
  status: NotificationDeliveryStatus;
  title: string;
  bodyPreview: string;
  errorMessage?: string;
  attemptCount: number;
  createdAt: string;
  lastAttemptAt?: string;
  nextRetryAt?: string;
  sentAt?: string;
}

export interface NotificationListResponse {
  notifications: AppNotification[];
  unreadCount: number;
}

export interface MarkNotificationsReadRequest {
  notificationIds?: string[];
}

export interface NotificationDeliveriesResponse {
  deliveries: NotificationDeliveryRecord[];
}

export interface NotificationOpsChannelHealth {
  channel: NotificationChannel;
  provider: string;
  totalDeliveries: number;
  deliveriesLast24Hours: number;
  sentCount: number;
  failedCount: number;
  queuedCount: number;
  pendingRetryCount: number;
  overdueRetryCount: number;
  lastAttemptAt?: string;
}

export interface NotificationOpsAlert {
  severity: "info" | "warning" | "critical";
  title: string;
  detail: string;
}

export interface NotificationOpsHealthResponse {
  generatedAt: string;
  totalDeliveries: number;
  deliveriesLast24Hours: number;
  sentLast24Hours: number;
  failedLast24Hours: number;
  queuedCount: number;
  pendingRetryCount: number;
  overdueRetryCount: number;
  exhaustedFailureCount: number;
  channels: NotificationOpsChannelHealth[];
  recentFailures: NotificationDeliveryRecord[];
  alerts: NotificationOpsAlert[];
}

export interface NotificationOpsRetrySweepResponse {
  retriedCount: number;
  sentCount: number;
  failedCount: number;
  remainingOverdueCount: number;
}

export interface NotificationOpsEscalationResponse {
  generatedAt: string;
  escalated: boolean;
  reason: string;
  targetCount: number;
  sentCount: number;
  failedCount: number;
}

export interface ProviderCalendarSubscriptionAction {
  platform: "apple-calendar" | "google-calendar" | "ical";
  label: string;
  href: string;
  helperText: string;
}

export interface ProviderCalendarSubscriptionResponse {
  providerId: string;
  providerName: string;
  feedUrl: string;
  webcalUrl: string;
  actions: ProviderCalendarSubscriptionAction[];
  instructions: string[];
}

export interface ProviderCalendarSyncHealth {
  status: ProviderCalendarSyncHealthStatus;
  externalBlockingEnabled: boolean;
  subscriptionCount: number;
  activeSubscriptionCount: number;
  erroredSubscriptionCount: number;
  staleSubscriptionCount: number;
  importedBlockCount: number;
  manualBlockCount: number;
  upcomingExternalBlockCount: number;
  conflictingYardmatchJobCount: number;
  nextExternalBlockStartIso?: string;
  notes: string[];
}

export interface ProviderCalendarEvent {
  id: string;
  source: ProviderCalendarEventSource;
  title: string;
  startIso: string;
  endIso: string;
  isBlockingAvailability: boolean;
  addressLine?: string;
  city?: string;
  state?: string;
  status?: BookingStatus;
  customerName?: string;
  bookingId?: string;
  category?: ServiceCategory;
  blockType?: ExternalCalendarBlockType;
  notes?: string;
}

export interface ProviderDispatchWindowSummary {
  windowKey: BookingServiceWindowKey;
  label: string;
  yardmatchJobCount: number;
  externalBlockCount: number;
  totalCrewRequired: number;
  totalCrewAssigned: number;
  crewGap: number;
  bookedMinutes: number;
  blockedMinutes: number;
}

export interface ProviderDispatchDaySummary {
  dateIso: string;
  dayLabel: string;
  yardmatchJobCount: number;
  externalBlockCount: number;
  totalCrewRequired: number;
  totalCrewAssigned: number;
  crewGap: number;
  bookedMinutes: number;
  blockedMinutes: number;
  estimatedDriveMiles: number;
  longestDriveLegMiles: number;
  largestIdleGapMinutes: number;
  outlierStopCount: number;
  firstJobStartIso?: string;
  lastJobEndIso?: string;
  firstStopAddressLine?: string;
  routeStatus: ProviderDispatchRouteStatus;
  recommendations: string[];
  windowSummaries: ProviderDispatchWindowSummary[];
}

export interface ProviderDispatchRangeSummary {
  scope: "next-7-days";
  activeDayCount: number;
  totalYardmatchJobs: number;
  totalExternalBlocks: number;
  totalCrewGap: number;
  watchDayCount: number;
  overloadedDayCount: number;
  busiestDay?: ProviderDispatchDaySummary;
  highestCrewGapDay?: ProviderDispatchDaySummary;
  highestDriveMilesDay?: ProviderDispatchDaySummary;
  recommendations: string[];
}

export interface ProviderCalendarOverviewResponse {
  providerId: string;
  providerName: string;
  windowStartIso: string;
  windowEndIso: string;
  totalEvents: number;
  yardmatchJobCount: number;
  externalBlockCount: number;
  syncHealth: ProviderCalendarSyncHealth;
  dispatchDays: ProviderDispatchDaySummary[];
  events: ProviderCalendarEvent[];
}

export interface ProviderCalendarImportsResponse {
  providerId: string;
  subscriptions: ExternalCalendarSubscription[];
  importedBlockCount: number;
  syncHealth: ProviderCalendarSyncHealth;
}

export interface SyncStaleProviderCalendarImportsResponse extends ProviderCalendarImportsResponse {
  syncedSubscriptionCount: number;
  failedSubscriptionCount: number;
  attemptedSubscriptionCount: number;
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
  availableWeekdays?: CrewAvailabilityDay[];
  willingToTravelMiles?: number;
  preferredSchedule?: CrewMemberSchedulePreference;
  hasOwnEquipment?: boolean;
  winterWorkEnabled?: boolean;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RequestPasswordResetRequest {
  email: string;
}

export interface RequestPasswordResetResponse {
  success: true;
  message: string;
  expiresAtIso?: string;
  resetCodePreview?: string;
  resetUrlPreview?: string;
}

export interface ConfirmPasswordResetRequest {
  email: string;
  resetCode: string;
  newPassword: string;
}

export interface AuthenticatedSession {
  token: string;
  expiresInSeconds: number;
  expiresAtIso: string;
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
  redirectUri?: string;
}

export interface GoogleAuthStartResponse {
  provider: AuthProvider;
  role: MarketplaceRole;
  mode: AuthFlowMode;
  redirectUrl: string;
  status: "oauth-redirect";
}

export interface SocialAuthPendingIdentity {
  provider: AuthProvider;
  role: MarketplaceRole;
  mode: AuthFlowMode;
  pendingToken: string;
  email: string;
  fullName: string;
  expiresAtIso: string;
}

export interface CompleteSocialSignupRequest {
  pendingToken: string;
  fullName: string;
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
  availableWeekdays?: CrewAvailabilityDay[];
  willingToTravelMiles?: number;
  preferredSchedule?: CrewMemberSchedulePreference;
  hasOwnEquipment?: boolean;
  winterWorkEnabled?: boolean;
}

export interface SearchProvidersRequest {
  address: Address;
  categories: ServiceCategory[];
  dateIso: string;
  estimatedDurationMinutes?: number;
  requestSource?: string;
}

export interface SearchProvidersResponse {
  providers: ProviderProfile[];
  rankedProviders: SearchProviderResult[];
  suggestedSlots: AvailabilitySlot[];
  recommendationSessionId: string;
  recommendedProviderId?: string;
}

export interface PublicMarketplaceFeaturedProvider {
  id: string;
  companyName: string;
  ownerName: string;
  city: string;
  state: string;
  rating: number;
  timelinessRating: number;
  reviewCount: number;
  yearsExperience: number;
  serviceRadiusMiles: number;
  primaryCategory?: ServiceCategory;
}

export interface PublicMarketplaceOverviewResponse {
  generatedAt: string;
  verifiedProviderCount: number;
  averageRating: number;
  activeCategoryCount: number;
  featuredProviders: PublicMarketplaceFeaturedProvider[];
  topRatedProviders: PublicMarketplaceFeaturedProvider[];
  mostOnTimeProviders: PublicMarketplaceFeaturedProvider[];
}

export interface SearchProviderResult {
  provider: ProviderProfile;
  score: number;
  distanceMiles: number;
  hasOpenSlot: boolean;
  suggestedSlot?: AvailabilitySlot;
  reasons: string[];
  completedJobCount: number;
  nearbyCompletedJobCount: number;
  availabilityConfidence: "high" | "medium" | "low";
  availabilityConfidenceLabel: string;
  reliabilityLabel: string;
  reliabilityDetail: string;
  selectionSummaryLabel: string;
  selectionSummaryDetail: string;
  neighborhoodFamiliarityLabel: string;
  neighborhoodFamiliarityDetail: string;
  factors: {
    serviceFit: number;
    specialization: number;
    distance: number;
    reliability: number;
    operationalReliability: number;
    experience: number;
    availability: number;
    sponsorship: number;
    issuePenalty: number;
  };
}

export interface CustomerProviderChoicePresentation {
  badge: string;
  heading: string;
  detail: string;
}

function buildRecommendedChoicePresentation(
  result: SearchProviderResult
): CustomerProviderChoicePresentation {
  return {
    badge: "Recommended for this property",
    heading: "Best overall match",
    detail: result.hasOpenSlot
      ? "GreenRain picked this provider for service fit, trust history, and a real route opening."
      : "GreenRain picked this provider as the strongest overall fit, even though the near-term route window is currently full."
  };
}

function buildHighestRatedChoicePresentation(): CustomerProviderChoicePresentation {
  return {
    badge: "Highest rated",
    heading: "Strongest review history",
    detail: "This option stands out on customer ratings and punctuality among the other qualified providers."
  };
}

function buildClosestRouteChoicePresentation(): CustomerProviderChoicePresentation {
  return {
    badge: "Closest route",
    heading: "Shortest travel distance",
    detail: "This option is closer to the property than the other revealed backups, which can help route efficiency."
  };
}

function buildLocalSpecialistChoicePresentation(): CustomerProviderChoicePresentation {
  return {
    badge: "Local specialist",
    heading: "Deepest neighborhood familiarity",
    detail: "This option has the strongest nearby completed-job context among the other revealed backups."
  };
}

function buildServiceSpecialistChoicePresentation(): CustomerProviderChoicePresentation {
  return {
    badge: "Service specialist",
    heading: "Focused on this type of work",
    detail: "This provider leans more heavily into the requested service mix than a generic backup match."
  };
}

function buildOpenRouteChoicePresentation(): CustomerProviderChoicePresentation {
  return {
    badge: "Open route option",
    heading: "Another bookable match",
    detail: "This provider still has a live route opening and remains a solid fallback if you skip the recommendation."
  };
}

function buildQualifiedFallbackChoicePresentation(): CustomerProviderChoicePresentation {
  return {
    badge: "Qualified backup",
    heading: "Another verified option",
    detail: "This provider still serves the area and fits the request, but ranks behind the main recommendation."
  };
}

function getAlternativeRatingScore(result: SearchProviderResult) {
  return (
    result.provider.rating * 1000 +
    result.provider.timelinessRating * 100 +
    Math.min(result.provider.reviewCount, 250)
  );
}

function getAlternativeLocalSpecialistScore(result: SearchProviderResult) {
  return (
    result.nearbyCompletedJobCount * 1000 +
    result.factors.specialization * 100 +
    result.completedJobCount
  );
}

function pickAlternativeIndex(
  rankedProviders: SearchProviderResult[],
  usedIndexes: Set<number>,
  comparator: (left: SearchProviderResult, right: SearchProviderResult) => number
) {
  let bestIndex: number | undefined;
  for (let index = 1; index < rankedProviders.length; index += 1) {
    if (usedIndexes.has(index)) {
      continue;
    }

    if (bestIndex === undefined || comparator(rankedProviders[index], rankedProviders[bestIndex]) > 0) {
      bestIndex = index;
    }
  }

  if (bestIndex !== undefined) {
    usedIndexes.add(bestIndex);
  }

  return bestIndex;
}

export function buildCustomerProviderChoicePresentations(
  rankedProviders: SearchProviderResult[]
): CustomerProviderChoicePresentation[] {
  if (rankedProviders.length === 0) {
    return [];
  }

  const presentations: CustomerProviderChoicePresentation[] = rankedProviders.map((result) =>
    buildQualifiedFallbackChoicePresentation()
  );
  presentations[0] = buildRecommendedChoicePresentation(rankedProviders[0]);

  if (rankedProviders.length === 1) {
    return presentations;
  }

  const usedIndexes = new Set<number>();
  const highestRatedIndex = pickAlternativeIndex(
    rankedProviders,
    usedIndexes,
    (left, right) => getAlternativeRatingScore(left) - getAlternativeRatingScore(right)
  );
  const closestRouteIndex = pickAlternativeIndex(
    rankedProviders,
    usedIndexes,
    (left, right) => right.distanceMiles - left.distanceMiles
  );
  const localSpecialistIndex = pickAlternativeIndex(
    rankedProviders,
    usedIndexes,
    (left, right) => getAlternativeLocalSpecialistScore(left) - getAlternativeLocalSpecialistScore(right)
  );

  if (highestRatedIndex !== undefined) {
    presentations[highestRatedIndex] = buildHighestRatedChoicePresentation();
  }
  if (closestRouteIndex !== undefined) {
    presentations[closestRouteIndex] = buildClosestRouteChoicePresentation();
  }
  if (localSpecialistIndex !== undefined) {
    presentations[localSpecialistIndex] = buildLocalSpecialistChoicePresentation();
  }

  for (let index = 1; index < rankedProviders.length; index += 1) {
    const result = rankedProviders[index];
    const presentation = presentations[index];
    if (presentation.badge !== "Qualified backup") {
      continue;
    }

    if (result.factors.specialization >= 7) {
      presentations[index] = buildServiceSpecialistChoicePresentation();
      continue;
    }

    if (result.hasOpenSlot) {
      presentations[index] = buildOpenRouteChoicePresentation();
    }
  }

  return presentations;
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
  recommendationSessionId?: string;
  recommendedProviderId?: string;
  selectedProviderRank?: number;
  viewedAlternativeProviders?: boolean;
  recommendationSource?: string;
}

export interface CreateRecurringServicePlanRequest extends CreateBookingRequest {
  frequency: RecurringServiceFrequency;
}

export interface CreateRecurringServicePlanResponse {
  plan: RecurringServicePlanSummary;
  initialBooking: Booking;
}

export interface ListRecurringServicePlansResponse {
  plans: RecurringServicePlanSummary[];
}

export interface CancelRecurringServicePlanRequest {
  planId: string;
  reason?: string;
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
  minimumBookingLeadHours?: number;
  staffingMode?: ProviderStaffingMode;
  crewReviewLeadHours?: number;
  departureReminderLeadMinutes?: number;
  routeLeaderMode?: ProviderRouteLeaderMode;
  weeklyPayoutDay?: ProviderPayoutWeekday;
  instantPayoutsEnabled?: boolean;
  sponsoredListingEnabled?: boolean;
  externalEventsBlockingEnabled?: boolean;
  externalCalendarBlocks?: Array<{
    id?: string;
    title: string;
    blockType: ExternalCalendarBlockType;
    startIso: string;
    endIso: string;
    notes?: string;
    source?: "manual" | "calendar-import";
    createdAt?: string;
    subscriptionId?: string;
  }>;
}

export interface AssignBookingRouteLeaderRequest {
  bookingId: string;
  crewMemberId?: string;
}

export interface ReviewProviderVerificationRequest {
  providerId: string;
  action: "approve" | "reject";
  notes?: string;
}

export interface CreateExternalCalendarImportRequest {
  title: string;
  provider: ExternalCalendarProvider;
  feedUrl: string;
}

export interface SyncExternalCalendarImportRequest {
  subscriptionId: string;
}

export interface RemoveExternalCalendarImportRequest {
  subscriptionId: string;
}

export interface UpdateCrewPreferencesRequest {
  categories?: ServiceCategory[];
  availableWeekdays?: CrewAvailabilityDay[];
  willingToTravelMiles?: number;
  preferredSchedule?: CrewMemberSchedulePreference;
  hasOwnEquipment?: boolean;
  winterWorkEnabled?: boolean;
}

export interface CancelCrewMatchRequest {
  crewMatchId: string;
  reason?: string;
}

export interface ReviewCrewMatchRequest {
  crewMatchId: string;
  action: "accept" | "deny";
}

export interface SendProviderCrewMessageRequest {
  crewMatchId?: string;
  threadId?: string;
  body: string;
}

export interface SendCustomerProviderMessageRequest {
  bookingId?: string;
  threadId?: string;
  body: string;
}

export interface MarkBookingOnRouteRequest {
  bookingId: string;
}

export interface UpdateBookingRouteLocationRequest {
  bookingId: string;
  point: GeoPoint;
  capturedAtIso?: string;
  speedMph?: number;
  accuracyMeters?: number;
}

export interface SetBookingRouteStopRequest {
  bookingId: string;
  kind: BookingRouteStopKind;
  label?: string;
  address?: Address;
}

export interface ClearBookingRouteStopRequest {
  bookingId: string;
}

export interface MarkBookingLateRequest {
  bookingId: string;
  lateEtaIso: string;
  reason?: string;
}

export interface MarkBookingExceptionRequest {
  bookingId: string;
  exceptionType: BookingExceptionType;
  notes?: string;
}

export interface AddBookingEvidenceRequest {
  bookingId: string;
  phase: BookingEvidencePhase;
  evidenceType?: BookingEvidenceType;
  imageDataUrl?: string;
  note?: string;
  checklistItems?: BookingEvidenceChecklistItem[];
}

export interface CreateBookingDisputeRequest {
  bookingId: string;
  reason: string;
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

export interface ProviderAssistantCommandRequest {
  command: string;
  bookingId?: string;
  execute?: boolean;
}

export interface ProviderAssistantBookingCandidate {
  bookingId: string;
  customerName: string;
  scheduledStartIso: string;
  scheduledEndIso: string;
  currentWindowKey: BookingServiceWindowKey;
  currentWindowLabel: string;
  addressLine: string;
}

export interface ProviderAssistantCommandResponse {
  command: string;
  understood: boolean;
  actionType?: ProviderAssistantActionType;
  actionTypes?: ProviderAssistantActionType[];
  requiresBookingSelection: boolean;
  requiresConfirmation: boolean;
  executed: boolean;
  notifyCustomer: boolean;
  matchedBookingId?: string;
  matchedCustomerName?: string;
  sourceWindowKey?: BookingServiceWindowKey;
  targetWindowKey?: BookingServiceWindowKey;
  targetWindowLabel?: string;
  suggestedStartIso?: string;
  suggestedEndIso?: string;
  lateMinutes?: number;
  lateEtaIso?: string;
  dispatchDaySummary?: ProviderDispatchDaySummary;
  dispatchWindowSummary?: ProviderDispatchWindowSummary;
  dispatchRangeSummary?: ProviderDispatchRangeSummary;
  previewLabel: string;
  previewMessage: string;
  customerNotificationPreview?: string;
  bookingCandidates: ProviderAssistantBookingCandidate[];
  updatedBooking?: Booking;
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

export interface PropertyMeasurementEstimateSources {
  turfSqFt: PropertyMeasurementSource;
  shrubBedSqFt: PropertyMeasurementSource;
  drivewaySqFt: PropertyMeasurementSource;
  sidewalkLinearFt: PropertyMeasurementSource;
}

export interface QuoteConfidenceReason {
  impact: QuoteConfidenceReasonImpact;
  label: string;
  detail: string;
}

export interface NormalizedAddressSummary {
  displayLabel: string;
  wasNormalized: boolean;
  normalizedFields: Array<"line1" | "line2" | "city" | "state" | "postalCode" | "country">;
  validationSource?: "local-rules" | "google-address-validation";
  validationConfidence?: "local-only" | "validated" | "review-suggested";
  validationMessage?: string;
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
  normalizedAddress: NormalizedAddressSummary;
  category: ServiceCategory;
  source: PropertyEstimateSource;
  confidenceScore: number;
  confidenceTier: EstimateConfidenceTier;
  confidenceReasons: QuoteConfidenceReason[];
  estimatedPriceCents: number;
  estimatedDurationMinutes: number;
  estimatedCrewSize: number;
  estimateSummary: string;
  measurements: PropertyMeasurementEstimate;
  measurementSources: PropertyMeasurementEstimateSources;
  followUpQuestions: QuoteFollowUpQuestion[];
  quoteReadyForCheckout: boolean;
}

export interface CreatePaymentIntentRequest {
  bookingId: string;
  amountCents: number;
  currency?: string;
}

export interface CreateCheckoutSessionRequest {
  bookingId: string;
  successPath?: string;
  cancelPath?: string;
}

export interface CreateCheckoutSessionResponse {
  checkoutUrl: string;
  payment: PaymentRecord;
}

export interface FinalizeCheckoutSessionRequest {
  checkoutSessionId: string;
}

export interface CreateRefundRequest {
  paymentId: string;
  reason: string;
}

export interface CreateOpsRefundOverrideRequest {
  ticketId: string;
  paymentId: string;
  reason: string;
}

export interface CreateSupportTicketRequest {
  bookingId?: string;
  subject: string;
  description: string;
  issueType: SupportIssueType;
}

export interface UpdateSupportTicketRequest {
  ticketId: string;
  status: SupportTicketStatus;
  resolutionNotes?: string;
  resolutionAction?: SupportBookingResolution;
}

export interface CreateOpsBookingInterventionRequest {
  bookingId: string;
  ticketId?: string;
  action: OpsBookingInterventionAction;
  note: string;
  scheduledStartIso?: string;
  scheduledEndIso?: string;
}

export interface ReviewBookingEvidenceForOpsRequest {
  bookingId: string;
  evidenceId: string;
  ticketId?: string;
  reviewStatus: BookingEvidenceReviewStatus;
  reviewNotes?: string;
}

export interface ConfirmBookingRequest {
  bookingId: string;
}

export interface DeclineBookingRequest {
  bookingId: string;
  reason?: string;
}

export interface StartBookingRequest {
  bookingId: string;
}

export interface CompleteBookingRequest {
  bookingId: string;
}

export interface CancelBookingRequest {
  bookingId: string;
}

export interface RescheduleBookingRequest {
  bookingId: string;
  scheduledStartIso: string;
  scheduledEndIso: string;
}

export function getBookingServiceWindow(startIso: string): {
  key: BookingServiceWindowKey;
  label: string;
  rangeLabel: string;
  arrivalLabel: string;
} {
  const hour = new Date(startIso).getHours();

  if (hour < 12) {
    return {
      key: "morning",
      label: "Morning",
      rangeLabel: "7:00 AM - 12:00 PM",
      arrivalLabel: "Morning arrival window"
    };
  }

  if (hour < 16) {
    return {
      key: "afternoon",
      label: "Afternoon",
      rangeLabel: "12:00 PM - 4:00 PM",
      arrivalLabel: "Afternoon arrival window"
    };
  }

  return {
    key: "late-afternoon-night",
    label: "Late afternoon / evening",
    rangeLabel: "4:00 PM - 8:00 PM",
    arrivalLabel: "Late afternoon / evening window"
  };
}

export function formatBookingWindowSummary(startIso: string): string {
  const window = getBookingServiceWindow(startIso);
  return `${window.label} • ${window.rangeLabel}`;
}

export function getBookingExceptionLabel(exceptionType: BookingExceptionType): string {
  switch (exceptionType) {
    case "customer-no-show":
      return "Customer no-show";
    case "customer-not-ready":
      return "Customer not ready";
    case "unable-to-access-property":
      return "Unable to access property";
    case "service-could-not-be-completed":
      return "Service could not be completed";
  }
}

export function getExternalCalendarBlockLabel(blockType: ExternalCalendarBlockType): string {
  switch (blockType) {
    case "off-platform-client":
      return "Off-platform client";
    case "personal-time":
      return "Personal time";
    case "travel-buffer":
      return "Travel buffer";
    case "equipment-maintenance":
      return "Equipment maintenance";
  }
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

export interface RecommendationSurfaceMetrics {
  requestSource: string;
  providerSearches: number;
  providerSearchesNoResults: number;
  providerSearchesNoOpenWindows: number;
  providerSearchCoverageRate: number;
  providerSearchOpenWindowRate: number;
  recommendationViews: number;
  recommendationAlternativesViewed: number;
  recommendationAlternativeRevealRate: number;
  recommendationDismissals: number;
  recommendationDismissalRate: number;
  recommendationBookingIntents: number;
  recommendationBookingIntentRate: number;
  acceptedRecommendations: number;
  swappedRecommendations: number;
  recommendationAcceptanceRate: number;
  recommendationSwapRate: number;
}

export interface ObservabilityOverview {
  generatedAt: string;
  totalBookings: number;
  requestedBookings: number;
  bookingsLast24Hours: number;
  refundRequestedCount: number;
  openSupportTickets: number;
  providerSearches: number;
  providerSearchesNoResults: number;
  providerSearchesNoOpenWindows: number;
  providerSearchCoverageRate: number;
  providerSearchOpenWindowRate: number;
  recommendationViews: number;
  recommendationAlternativesViewed: number;
  recommendationAlternativeRevealRate: number;
  recommendationDismissals: number;
  recommendationDismissalRate: number;
  recommendationBookingIntents: number;
  recommendationBookingIntentRate: number;
  acceptedRecommendations: number;
  swappedRecommendations: number;
  recommendationAcceptanceRate: number;
  recommendationSwapRate: number;
  providerBookingConfirmations: number;
  providerBookingDeclines: number;
  customerBookingCancellations: number;
  paymentCheckoutStarts: number;
  paymentAuthorizations: number;
  paymentCaptures: number;
  paymentFailures: number;
  recommendationMetricsBySource: RecommendationSurfaceMetrics[];
  activeUsers5m: number;
  activeCustomers5m: number;
  activeProviders5m: number;
  activeCrewMembers5m: number;
  activeUsersByPlatform: Partial<Record<TelemetryPlatformSurface, number>>;
  recentEvents: AnalyticsEvent[];
}
