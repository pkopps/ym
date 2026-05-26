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
      const customerId = context.query.get("customerId");
      if (!customerId) {
        sendJson(response, 400, {
          message: "customerId is required"
        });
        return;
      }

      sendJson(response, 200, this.platform.listCustomerProperties(customerId));
      return;
    }

    if (context.method === "POST" && context.path === "/api/customers/properties") {
      sendJson(
        response,
        201,
        this.platform.createCustomerProperty(context.body as CreateCustomerPropertyRequest)
      );
      return;
    }

    if (context.method === "POST" && context.path === "/api/customers/properties/default") {
      sendJson(
        response,
        200,
        this.platform.setDefaultCustomerProperty(context.body as SetDefaultCustomerPropertyRequest)
      );
      return;
    }

    if (context.method === "GET" && context.path === "/api/customers/review-opportunities") {
      const customerId = context.query.get("customerId");
      if (!customerId) {
        sendJson(response, 400, {
          message: "customerId is required"
        });
        return;
      }

      sendJson(response, 200, this.platform.listCustomerReviewOpportunities(customerId));
      return;
    }

    if (context.method === "POST" && context.path === "/api/quotes/instant") {
      sendJson(response, 200, this.platform.createInstantQuote(context.body as InstantQuoteRequest));
      return;
    }

    if (context.method === "POST" && context.path === "/api/providers/search") {
      sendJson(response, 200, this.platform.searchProviders(context.body as SearchProvidersRequest));
      return;
    }

    if (context.method === "POST" && context.path === "/api/providers/settings") {
      sendJson(response, 200, this.platform.updateProviderSettings(context.body as UpdateProviderSettingsRequest));
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
      sendJson(response, 201, this.platform.createProviderReview(context.body as CreateProviderReviewRequest));
      return;
    }

    if (context.method === "POST" && context.path === "/api/bookings") {
      sendJson(response, 201, this.platform.createBooking(context.body as CreateBookingRequest));
      return;
    }

    if (context.method === "POST" && context.path === "/api/bookings/complete") {
      sendJson(response, 200, this.platform.completeBooking(context.body as CompleteBookingRequest));
      return;
    }

    if (context.method === "POST" && context.path === "/api/bookings/address") {
      sendJson(response, 200, this.platform.updateBookingAddress(context.body as UpdateBookingAddressRequest));
      return;
    }

    if (context.method === "GET" && context.path === "/api/bookings") {
      sendJson(response, 200, this.platform.listBookings());
      return;
    }

    if (context.method === "POST" && context.path === "/api/payments/intent") {
      sendJson(response, 201, this.platform.createPaymentIntent(context.body as CreatePaymentIntentRequest));
      return;
    }

    if (context.method === "POST" && context.path === "/api/payments/refund") {
      sendJson(response, 200, this.platform.createRefund(context.body as CreateRefundRequest));
      return;
    }

    if (context.method === "POST" && context.path === "/api/review-invites/process") {
      sendJson(response, 200, this.platform.processReviewInvites(context.body as ProcessReviewInvitesRequest));
      return;
    }

    const providerId = context.query.get("providerId");
    if (!providerId) {
      sendJson(response, 400, {
        message: "providerId is required"
      });
      return;
    }

    sendText(response, 200, this.platform.buildCalendarFeed(providerId));
  }
}
