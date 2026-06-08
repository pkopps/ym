import {
  CancelBookingRequest,
  ConfirmBookingRequest,
  CompleteBookingRequest,
  CreateExternalCalendarImportRequest,
  CreateCheckoutSessionRequest,
  CreateProviderReviewRequest,
  CreateCustomerPropertyRequest,
  CreateBookingRequest,
  CreateBookingDisputeRequest,
  InstantQuoteRequest,
  MarkBookingExceptionRequest,
  MarkBookingLateRequest,
  MarkNotificationsReadRequest,
  RegisterPushDeviceRequest,
  UpdateBookingRouteLocationRequest,
  UpdateNotificationPreferencesRequest,
  MarkBookingOnRouteRequest,
  CreatePaymentIntentRequest,
  FinalizeCheckoutSessionRequest,
  ProcessReviewInvitesRequest,
  CreateRefundRequest,
  ReviewCrewMatchRequest,
  RemovePushDeviceRequest,
  RemoveExternalCalendarImportRequest,
  SendCustomerProviderMessageRequest,
  SendProviderCrewMessageRequest,
  SetDefaultCustomerPropertyRequest,
  SearchProvidersRequest,
  SyncExternalCalendarImportRequest,
  StartBookingRequest,
  RescheduleBookingRequest,
  UpdateCrewPreferencesRequest,
  UpdateProviderSettingsRequest,
  UpdateBookingAddressRequest
} from "@yardmatch/contracts";
import { getOptionalAuthenticatedIdentity, requireAuthenticatedIdentity, requireRole } from "../controller-auth";
import { ApiController, RequestContext, sendJson, sendText } from "../http";
import { MarketplacePlatformService } from "../services/MarketplacePlatformService";

export class MarketplaceController implements ApiController {
  public constructor(private readonly platform: MarketplacePlatformService) {}

  public canHandle(context: RequestContext): boolean {
    return (
      (context.method === "GET" && context.path === "/api/customers/properties") ||
      (context.method === "POST" && context.path === "/api/customers/properties") ||
      (context.method === "POST" && context.path === "/api/customers/properties/default") ||
      (context.method === "GET" && context.path === "/api/customers/review-opportunities") ||
      (context.method === "POST" && context.path === "/api/quotes/instant") ||
      (context.method === "GET" && context.path === "/api/places/search") ||
      (context.method === "POST" && context.path === "/api/providers/search") ||
      (context.method === "GET" && context.path === "/api/providers/profile") ||
      (context.method === "GET" && context.path === "/api/crew/opportunities") ||
      (context.method === "GET" && context.path === "/api/providers/staffing") ||
      (context.method === "POST" && context.path === "/api/providers/staffing/review") ||
      (context.method === "POST" && context.path === "/api/providers/settings") ||
      (context.method === "GET" && context.path === "/api/providers/reviews") ||
      (context.method === "POST" && context.path === "/api/providers/reviews") ||
      (context.method === "GET" && context.path === "/api/notifications") ||
      (context.method === "POST" && context.path === "/api/notifications/read") ||
      (context.method === "GET" && context.path === "/api/notifications/preferences") ||
      (context.method === "POST" && context.path === "/api/notifications/preferences") ||
      (context.method === "GET" && context.path === "/api/notifications/deliveries") ||
      (context.method === "POST" && context.path === "/api/notifications/devices") ||
      (context.method === "POST" && context.path === "/api/notifications/devices/remove") ||
      (context.method === "POST" && context.path === "/api/bookings") ||
      (context.method === "POST" && context.path === "/api/bookings/cancel") ||
      (context.method === "POST" && context.path === "/api/bookings/reschedule") ||
      (context.method === "POST" && context.path === "/api/bookings/confirm") ||
      (context.method === "POST" && context.path === "/api/bookings/start") ||
      (context.method === "POST" && context.path === "/api/bookings/complete") ||
      (context.method === "POST" && context.path === "/api/bookings/on-route") ||
      (context.method === "POST" && context.path === "/api/bookings/route-location") ||
      (context.method === "POST" && context.path === "/api/bookings/late") ||
      (context.method === "POST" && context.path === "/api/bookings/exception") ||
      (context.method === "POST" && context.path === "/api/bookings/dispute") ||
      (context.method === "GET" && context.path === "/api/bookings/tracking") ||
      (context.method === "POST" && context.path === "/api/bookings/address") ||
      (context.method === "GET" && context.path === "/api/bookings") ||
      (context.method === "POST" && context.path === "/api/review-invites/process") ||
      (context.method === "POST" && context.path === "/api/crew/preferences") ||
      (context.method === "GET" && context.path === "/api/crew/matches") ||
      (context.method === "GET" && context.path === "/api/chat/provider-crew/threads") ||
      (context.method === "GET" && context.path === "/api/chat/provider-crew/messages") ||
      (context.method === "POST" && context.path === "/api/chat/provider-crew/messages") ||
      (context.method === "GET" && context.path === "/api/chat/customer-provider/threads") ||
      (context.method === "GET" && context.path === "/api/chat/customer-provider/messages") ||
      (context.method === "POST" && context.path === "/api/chat/customer-provider/messages") ||
      (context.method === "GET" && context.path === "/api/payments") ||
      (context.method === "POST" && context.path === "/api/payments/webhook") ||
      (context.method === "POST" && context.path === "/api/payments/checkout-session") ||
      (context.method === "POST" && context.path === "/api/payments/checkout-session/finalize") ||
      (context.method === "POST" && context.path === "/api/payments/intent") ||
      (context.method === "POST" && context.path === "/api/payments/refund") ||
      (context.method === "GET" && context.path === "/api/calendar/overview") ||
      (context.method === "GET" && context.path === "/api/calendar/subscription") ||
      (context.method === "GET" && context.path === "/api/calendar/imports") ||
      (context.method === "POST" && context.path === "/api/calendar/imports") ||
      (context.method === "POST" && context.path === "/api/calendar/imports/sync") ||
      (context.method === "POST" && context.path === "/api/calendar/imports/remove") ||
      (context.method === "GET" && context.path === "/api/calendar/feed")
    );
  }

  public async handle(context: RequestContext, response: Parameters<typeof sendJson>[0]): Promise<void> {
    if (context.method === "GET" && context.path === "/api/customers/properties") {
      const identity = await requireRole(context, this.platform, "customer");
      sendJson(response, 200, await this.platform.listCustomerProperties(identity.userId));
      return;
    }

    if (context.method === "POST" && context.path === "/api/customers/properties") {
      const identity = await requireRole(context, this.platform, "customer");
      sendJson(
        response,
        201,
        await this.platform.createCustomerProperty(identity.userId, context.body as CreateCustomerPropertyRequest)
      );
      return;
    }

    if (context.method === "POST" && context.path === "/api/customers/properties/default") {
      const identity = await requireRole(context, this.platform, "customer");
      sendJson(
        response,
        200,
        await this.platform.setDefaultCustomerProperty(
          identity.userId,
          context.body as SetDefaultCustomerPropertyRequest
        )
      );
      return;
    }

    if (context.method === "GET" && context.path === "/api/customers/review-opportunities") {
      const identity = await requireRole(context, this.platform, "customer");
      sendJson(response, 200, await this.platform.listCustomerReviewOpportunities(identity.userId));
      return;
    }

    if (context.method === "POST" && context.path === "/api/quotes/instant") {
      const identity = await getOptionalAuthenticatedIdentity(context, this.platform);
      sendJson(
        response,
        200,
        await this.platform.createInstantQuote({
          ...(context.body as InstantQuoteRequest),
          customerId: identity?.role === "customer" ? identity.userId : undefined
        })
      );
      return;
    }

    if (context.method === "GET" && context.path === "/api/places/search") {
      sendJson(response, 200, await this.platform.searchPlaces(context.query.get("query") ?? ""));
      return;
    }

    if (context.method === "POST" && context.path === "/api/providers/search") {
      sendJson(response, 200, await this.platform.searchProviders(context.body as SearchProvidersRequest));
      return;
    }

    if (context.method === "GET" && context.path === "/api/providers/profile") {
      await requireAuthenticatedIdentity(context, this.platform);
      const providerId = context.query.get("providerId");
      if (!providerId) {
        sendJson(response, 400, {
          message: "providerId is required"
        });
        return;
      }

      sendJson(response, 200, await this.platform.getProviderProfile(providerId));
      return;
    }

    if (context.method === "GET" && context.path === "/api/crew/opportunities") {
      await requireRole(context, this.platform, "crew-member");
      sendJson(response, 200, await this.platform.listCrewOpportunities());
      return;
    }

    if (context.method === "GET" && context.path === "/api/providers/staffing") {
      const identity = await requireRole(context, this.platform, "provider");
      sendJson(response, 200, await this.platform.getProviderStaffingOverview(identity.userId));
      return;
    }

    if (context.method === "POST" && context.path === "/api/providers/staffing/review") {
      const identity = await requireRole(context, this.platform, "provider");
      sendJson(response, 200, await this.platform.reviewCrewMatch(identity.userId, context.body as ReviewCrewMatchRequest));
      return;
    }

    if (context.method === "POST" && context.path === "/api/providers/settings") {
      const identity = await requireRole(context, this.platform, "provider");
      sendJson(
        response,
        200,
        await this.platform.updateProviderSettings(identity.userId, context.body as UpdateProviderSettingsRequest)
      );
      return;
    }

    if (context.method === "GET" && context.path === "/api/providers/reviews") {
      const providerId = context.query.get("providerId");
      if (!providerId) {
        sendJson(response, 400, {
          message: "providerId is required"
        });
        return;
      }

      sendJson(response, 200, this.platform.listProviderReviews(providerId));
      return;
    }

    if (context.method === "POST" && context.path === "/api/providers/reviews") {
      const identity = await requireRole(context, this.platform, "customer");
      sendJson(
        response,
        201,
        await this.platform.createProviderReview(identity.userId, context.body as CreateProviderReviewRequest)
      );
      return;
    }

    if (context.method === "GET" && context.path === "/api/notifications") {
      const identity = await requireAuthenticatedIdentity(context, this.platform);
      sendJson(response, 200, await this.platform.listNotifications(identity));
      return;
    }

    if (context.method === "POST" && context.path === "/api/notifications/read") {
      const identity = await requireAuthenticatedIdentity(context, this.platform);
      sendJson(
        response,
        200,
        await this.platform.markNotificationsRead(identity, context.body as MarkNotificationsReadRequest)
      );
      return;
    }

    if (context.method === "GET" && context.path === "/api/notifications/preferences") {
      const identity = await requireAuthenticatedIdentity(context, this.platform);
      sendJson(response, 200, await this.platform.getNotificationPreferences(identity));
      return;
    }

    if (context.method === "POST" && context.path === "/api/notifications/preferences") {
      const identity = await requireAuthenticatedIdentity(context, this.platform);
      sendJson(
        response,
        200,
        await this.platform.updateNotificationPreferences(
          identity,
          context.body as UpdateNotificationPreferencesRequest
        )
      );
      return;
    }

    if (context.method === "GET" && context.path === "/api/notifications/deliveries") {
      const identity = await requireAuthenticatedIdentity(context, this.platform);
      sendJson(response, 200, await this.platform.listNotificationDeliveries(identity));
      return;
    }

    if (context.method === "POST" && context.path === "/api/notifications/devices") {
      const identity = await requireAuthenticatedIdentity(context, this.platform);
      sendJson(response, 200, await this.platform.registerPushDevice(identity, context.body as RegisterPushDeviceRequest));
      return;
    }

    if (context.method === "POST" && context.path === "/api/notifications/devices/remove") {
      const identity = await requireAuthenticatedIdentity(context, this.platform);
      sendJson(response, 200, await this.platform.removePushDevice(identity, context.body as RemovePushDeviceRequest));
      return;
    }

    if (context.method === "POST" && context.path === "/api/bookings") {
      const identity = await requireRole(context, this.platform, "customer");
      sendJson(
        response,
        201,
        await this.platform.createBooking(identity.userId, context.body as CreateBookingRequest)
      );
      return;
    }

    if (context.method === "POST" && context.path === "/api/bookings/cancel") {
      const identity = await requireRole(context, this.platform, "customer");
      sendJson(
        response,
        200,
        await this.platform.cancelBooking(identity.userId, context.body as CancelBookingRequest)
      );
      return;
    }

    if (context.method === "POST" && context.path === "/api/bookings/reschedule") {
      const identity = await requireRole(context, this.platform, "customer");
      sendJson(
        response,
        200,
        await this.platform.rescheduleBooking(identity.userId, context.body as RescheduleBookingRequest)
      );
      return;
    }

    if (context.method === "POST" && context.path === "/api/bookings/confirm") {
      const identity = await requireRole(context, this.platform, "provider");
      sendJson(
        response,
        200,
        await this.platform.confirmBooking(identity.userId, context.body as ConfirmBookingRequest)
      );
      return;
    }

    if (context.method === "POST" && context.path === "/api/bookings/start") {
      const identity = await requireAuthenticatedIdentity(context, this.platform);
      sendJson(
        response,
        200,
        await this.platform.startBooking(identity, context.body as StartBookingRequest)
      );
      return;
    }

    if (context.method === "POST" && context.path === "/api/bookings/complete") {
      const identity = await requireRole(context, this.platform, "provider");
      sendJson(
        response,
        200,
        await this.platform.completeBooking(identity.userId, context.body as CompleteBookingRequest)
      );
      return;
    }

    if (context.method === "POST" && context.path === "/api/bookings/on-route") {
      const identity = await requireAuthenticatedIdentity(context, this.platform);
      sendJson(
        response,
        200,
        await this.platform.markBookingOnRoute(identity, context.body as MarkBookingOnRouteRequest)
      );
      return;
    }

    if (context.method === "POST" && context.path === "/api/bookings/route-location") {
      const identity = await requireAuthenticatedIdentity(context, this.platform);
      sendJson(
        response,
        200,
        await this.platform.updateBookingRouteLocation(
          identity,
          context.body as UpdateBookingRouteLocationRequest
        )
      );
      return;
    }

    if (context.method === "POST" && context.path === "/api/bookings/late") {
      const identity = await requireRole(context, this.platform, "provider");
      sendJson(
        response,
        200,
        await this.platform.markBookingLate(identity.userId, context.body as MarkBookingLateRequest)
      );
      return;
    }

    if (context.method === "POST" && context.path === "/api/bookings/exception") {
      const identity = await requireRole(context, this.platform, "provider");
      sendJson(
        response,
        200,
        await this.platform.markBookingException(identity.userId, context.body as MarkBookingExceptionRequest)
      );
      return;
    }

    if (context.method === "POST" && context.path === "/api/bookings/dispute") {
      const identity = await requireRole(context, this.platform, ["customer", "provider"]);
      sendJson(
        response,
        200,
        await this.platform.createBookingDispute(identity, context.body as CreateBookingDisputeRequest)
      );
      return;
    }

    if (context.method === "GET" && context.path === "/api/bookings/tracking") {
      const identity = await requireAuthenticatedIdentity(context, this.platform);
      const bookingId = context.query.get("bookingId");
      if (!bookingId) {
        sendJson(response, 400, {
          message: "bookingId is required"
        });
        return;
      }

      sendJson(response, 200, await this.platform.getBookingArrivalTracking(identity, bookingId));
      return;
    }

    if (context.method === "POST" && context.path === "/api/bookings/address") {
      const identity = await requireRole(context, this.platform, "customer");
      sendJson(
        response,
        200,
        await this.platform.updateBookingAddress(identity.userId, context.body as UpdateBookingAddressRequest)
      );
      return;
    }

    if (context.method === "GET" && context.path === "/api/bookings") {
      const identity = await requireAuthenticatedIdentity(context, this.platform);
      sendJson(response, 200, await this.platform.listBookingsForUser(identity));
      return;
    }

    if (context.method === "GET" && context.path === "/api/payments") {
      const identity = await requireAuthenticatedIdentity(context, this.platform);
      sendJson(response, 200, await this.platform.listPaymentsForUser(identity));
      return;
    }

    if (context.method === "POST" && context.path === "/api/payments/webhook") {
      const signatureHeader = context.headers["stripe-signature"];
      if (!signatureHeader) {
        sendJson(response, 400, {
          message: "Stripe-Signature header is required."
        });
        return;
      }

      sendJson(
        response,
        200,
        await this.platform.processStripeWebhook(context.rawBody ?? "", signatureHeader)
      );
      return;
    }

    if (context.method === "POST" && context.path === "/api/payments/checkout-session") {
      const identity = await requireRole(context, this.platform, "customer");
      sendJson(
        response,
        201,
        await this.platform.createCheckoutSession(identity.userId, context.body as CreateCheckoutSessionRequest)
      );
      return;
    }

    if (context.method === "POST" && context.path === "/api/payments/checkout-session/finalize") {
      const identity = await requireRole(context, this.platform, "customer");
      sendJson(
        response,
        200,
        await this.platform.finalizeCheckoutSession(
          identity.userId,
          context.body as FinalizeCheckoutSessionRequest
        )
      );
      return;
    }

    if (context.method === "POST" && context.path === "/api/payments/intent") {
      await requireRole(context, this.platform, "customer");
      sendJson(response, 201, await this.platform.createPaymentIntent(context.body as CreatePaymentIntentRequest));
      return;
    }

    if (context.method === "POST" && context.path === "/api/payments/refund") {
      const identity = await requireAuthenticatedIdentity(context, this.platform);
      sendJson(response, 200, await this.platform.createRefund(identity, context.body as CreateRefundRequest));
      return;
    }

    if (context.method === "POST" && context.path === "/api/review-invites/process") {
      sendJson(
        response,
        200,
        await this.platform.processReviewInvites(context.body as ProcessReviewInvitesRequest)
      );
      return;
    }

    if (context.method === "POST" && context.path === "/api/crew/preferences") {
      const identity = await requireRole(context, this.platform, "crew-member");
      sendJson(response, 200, await this.platform.updateCrewPreferences(identity.userId, context.body as UpdateCrewPreferencesRequest));
      return;
    }

    if (context.method === "GET" && context.path === "/api/crew/matches") {
      const identity = await requireRole(context, this.platform, "crew-member");
      sendJson(response, 200, await this.platform.getCrewMatchesForCrew(identity.userId));
      return;
    }

    if (context.method === "GET" && context.path === "/api/chat/provider-crew/threads") {
      const identity = await requireAuthenticatedIdentity(context, this.platform);
      sendJson(response, 200, await this.platform.listProviderCrewConversations(identity));
      return;
    }

    if (context.method === "GET" && context.path === "/api/chat/provider-crew/messages") {
      const identity = await requireAuthenticatedIdentity(context, this.platform);
      sendJson(
        response,
        200,
        await this.platform.getProviderCrewConversationThread(
          identity,
          context.query.get("threadId") ?? undefined,
          context.query.get("crewMatchId") ?? undefined
        )
      );
      return;
    }

    if (context.method === "POST" && context.path === "/api/chat/provider-crew/messages") {
      const identity = await requireAuthenticatedIdentity(context, this.platform);
      sendJson(response, 201, await this.platform.sendProviderCrewMessage(identity, context.body as SendProviderCrewMessageRequest));
      return;
    }

    if (context.method === "GET" && context.path === "/api/calendar/subscription") {
      const identity = await requireRole(context, this.platform, "provider");
      sendJson(response, 200, await this.platform.getProviderCalendarSubscription(identity.userId));
      return;
    }

    if (context.method === "GET" && context.path === "/api/calendar/overview") {
      const identity = await requireRole(context, this.platform, "provider");
      sendJson(
        response,
        200,
        await this.platform.getProviderCalendarOverview(identity.userId, {
          fromIso: context.query.get("from") ?? undefined,
          toIso: context.query.get("to") ?? undefined
        })
      );
      return;
    }

    if (context.method === "GET" && context.path === "/api/calendar/imports") {
      const identity = await requireRole(context, this.platform, "provider");
      sendJson(response, 200, await this.platform.getProviderCalendarImports(identity.userId));
      return;
    }

    if (context.method === "POST" && context.path === "/api/calendar/imports") {
      const identity = await requireRole(context, this.platform, "provider");
      sendJson(
        response,
        201,
        await this.platform.createProviderCalendarImport(
          identity.userId,
          context.body as CreateExternalCalendarImportRequest
        )
      );
      return;
    }

    if (context.method === "POST" && context.path === "/api/calendar/imports/sync") {
      const identity = await requireRole(context, this.platform, "provider");
      sendJson(
        response,
        200,
        await this.platform.syncProviderCalendarImport(
          identity.userId,
          context.body as SyncExternalCalendarImportRequest
        )
      );
      return;
    }

    if (context.method === "POST" && context.path === "/api/calendar/imports/remove") {
      const identity = await requireRole(context, this.platform, "provider");
      sendJson(
        response,
        200,
        await this.platform.removeProviderCalendarImport(
          identity.userId,
          context.body as RemoveExternalCalendarImportRequest
        )
      );
      return;
    }

    if (context.method === "GET" && context.path === "/api/chat/customer-provider/threads") {
      const identity = await requireRole(context, this.platform, ["customer", "provider"]);
      sendJson(response, 200, await this.platform.listCustomerProviderConversations(identity));
      return;
    }

    if (context.method === "GET" && context.path === "/api/chat/customer-provider/messages") {
      const identity = await requireRole(context, this.platform, ["customer", "provider"]);
      sendJson(
        response,
        200,
        await this.platform.getCustomerProviderConversationThread(
          identity,
          context.query.get("threadId") ?? undefined,
          context.query.get("bookingId") ?? undefined
        )
      );
      return;
    }

    if (context.method === "POST" && context.path === "/api/chat/customer-provider/messages") {
      const identity = await requireRole(context, this.platform, ["customer", "provider"]);
      sendJson(
        response,
        201,
        await this.platform.sendCustomerProviderMessage(
          identity,
          context.body as SendCustomerProviderMessageRequest
        )
      );
      return;
    }

    const feedToken = context.query.get("token");
    if (feedToken) {
      sendText(response, 200, await this.platform.buildCalendarFeedByToken(feedToken));
      return;
    }

    const identity = await requireRole(context, this.platform, "provider");
    sendText(response, 200, await this.platform.buildCalendarFeed(identity.userId));
  }
}
