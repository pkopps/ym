import {
  CompleteBookingRequest,
  CreateProviderReviewRequest,
  CreateCustomerPropertyRequest,
  CreateBookingRequest,
  InstantQuoteRequest,
  CreatePaymentIntentRequest,
  ProcessReviewInvitesRequest,
  CreateRefundRequest,
  SetDefaultCustomerPropertyRequest,
  SearchProvidersRequest,
  UpdateProviderSettingsRequest,
  UpdateBookingAddressRequest
} from "@yardmatch/contracts";
import { requireAuthenticatedIdentity, requireRole } from "../controller-auth";
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
      (context.method === "POST" && context.path === "/api/providers/search") ||
      (context.method === "POST" && context.path === "/api/providers/settings") ||
      (context.method === "GET" && context.path === "/api/providers/reviews") ||
      (context.method === "POST" && context.path === "/api/providers/reviews") ||
      (context.method === "POST" && context.path === "/api/bookings") ||
      (context.method === "POST" && context.path === "/api/bookings/complete") ||
      (context.method === "POST" && context.path === "/api/bookings/address") ||
      (context.method === "GET" && context.path === "/api/bookings") ||
      (context.method === "POST" && context.path === "/api/review-invites/process") ||
      (context.method === "POST" && context.path === "/api/payments/intent") ||
      (context.method === "POST" && context.path === "/api/payments/refund") ||
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
      sendJson(response, 200, await this.platform.createInstantQuote(context.body as InstantQuoteRequest));
      return;
    }

    if (context.method === "POST" && context.path === "/api/providers/search") {
      sendJson(response, 200, await this.platform.searchProviders(context.body as SearchProvidersRequest));
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

    if (context.method === "POST" && context.path === "/api/bookings") {
      const identity = await requireRole(context, this.platform, "customer");
      sendJson(
        response,
        201,
        await this.platform.createBooking(identity.userId, context.body as CreateBookingRequest)
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

    if (context.method === "POST" && context.path === "/api/payments/intent") {
      await requireRole(context, this.platform, "customer");
      sendJson(response, 201, await this.platform.createPaymentIntent(context.body as CreatePaymentIntentRequest));
      return;
    }

    if (context.method === "POST" && context.path === "/api/payments/refund") {
      await requireRole(context, this.platform, "customer");
      sendJson(response, 200, await this.platform.createRefund(context.body as CreateRefundRequest));
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

    const identity = await requireRole(context, this.platform, "provider");
    sendText(response, 200, await this.platform.buildCalendarFeed(identity.userId));
  }
}
