export class ApiRoutes {
  public static readonly register = "/api/auth/register";
  public static readonly googleAuthStart = "/api/auth/google/start";
  public static readonly appleAuthStart = "/api/auth/apple/start";
  public static readonly customerProperties = "/api/customers/properties";
  public static readonly defaultCustomerProperty = "/api/customers/properties/default";
  public static readonly createInstantQuote = "/api/quotes/instant";
  public static readonly searchProviders = "/api/providers/search";
  public static readonly updateProviderSettings = "/api/providers/settings";
  public static readonly providerReviews = "/api/providers/reviews";
  public static readonly customerReviewOpportunities = "/api/customers/review-opportunities";
  public static readonly createBooking = "/api/bookings";
  public static readonly listBookings = "/api/bookings";
  public static readonly completeBooking = "/api/bookings/complete";
  public static readonly updateBookingAddress = "/api/bookings/address";
  public static readonly processReviewInvites = "/api/review-invites/process";
  public static readonly createPaymentIntent = "/api/payments/intent";
  public static readonly createRefund = "/api/payments/refund";
  public static readonly createSupportTicket = "/api/support/tickets";
  public static readonly createAnalyticsEvent = "/api/analytics/events";
  public static readonly createSessionHeartbeat = "/api/observability/session-heartbeat";
  public static readonly getObservabilityOverview = "/api/observability/overview";
  public static readonly providerCalendar = "/api/calendar/feed";
}
