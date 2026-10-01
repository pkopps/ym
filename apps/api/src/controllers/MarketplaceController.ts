import { requireOpsAdminAccess } from "../controller-auth";
import type { ProviderServicePrice, UpdateZipServiceMinimumRequest } from "@yardmatch/contracts";
import {
  ProviderAvailabilityRequest,
  UpdateBookingScheduleRequest,
  RespondBookingScheduleRequest,
  AddBookingEvidenceRequest,
  AssignBookingRouteLeaderRequest,
  ClearBookingRouteStopRequest,
  CancelBookingRequest,
  CancelCrewMatchRequest,
  CancelRecurringServicePlanRequest,
  ClaimPublicCrewOpportunityRequest,
  ConfirmBookingRequest,
  DeclineBookingRequest,
  CompleteBookingRequest,
  CreateExternalCalendarImportRequest,
  CreateCheckoutSessionRequest,
  CreateInboundGoogleBusinessProfileReviewResponseRequest,
  CreateInboundReviewResponseRequest,
  CreateInboundSharedInboxReviewResponseRequest,
  CreateProviderReviewRequest,
  EscalateReviewSupportRequest,
  UpdateReviewResponseRequest,
  ProviderAssistantCommandRequest,
  ReviewProviderVerificationRequest,
  ReviewProviderCredentialRequest,
  SubmitProviderCredentialRequest,
  CreateCustomerPropertyRequest,
  CreateBookingRequest,
  CreateRecurringServicePlanRequest,
  CreateBookingDisputeRequest,
  InstantQuoteRequest,
  MarkBookingExceptionRequest,
  MarkBookingLateRequest,
  MarkNotificationsReadRequest,
  RegisterPushDeviceRequest,
  ReverseGeocodePlaceRequest,
  SetBookingRouteStopRequest,
  UpdateBookingRouteLocationRequest,
  UpdateNotificationPreferencesRequest,
  MarkBookingOnRouteRequest,
  CreatePaymentIntentRequest,
  CreateOpsPayoutDisbursementRunRequest,
  ExecuteOpsPayoutDisbursementRunRequest,
  FinalizeCheckoutSessionRequest,
  ProcessReviewInvitesRequest,
  ProcessProviderOnboardingAutomationRequest,
  CreateRefundRequest,
  ReviewCrewMatchRequest,
  SelectPublicCrewOpportunityRequest,
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
  UpdateProviderProfileRequest,
  UpdateProviderSettingsRequest,
  UpdateBookingAddressRequest,
  UpdateBookingPhotoMarketingUseRequest
} from "@yardmatch/contracts";
import {
  getOptionalAuthenticatedIdentity,
  requireAuthenticatedIdentity,
  requireFreshRole,
  requireOpsAccess,
  requireRole
} from "../controller-auth";
import { ApiController, RequestContext, sendJson, sendText } from "../http";
import { localizeProviderCalendarOverview } from "../i18n";
import {
  parseBookingListScope,
  parseBoundedBookingIds,
  parsePaginationInput
} from "../pagination";
import { MarketplacePlatformService } from "../services/MarketplacePlatformService";

export class MarketplaceController implements ApiController {
  public constructor(private readonly platform: MarketplacePlatformService) {}

  public canHandle(context: RequestContext): boolean {
    return (
      (["GET", "POST"].includes(context.method) && context.path === "/api/providers/pricing") ||
      (["GET", "POST"].includes(context.method) && context.path === "/api/ops/pricing/minimums") ||
      (context.method === "GET" && context.path === "/api/pricing/minimums") ||
      (context.method === "GET" && context.path === "/api/customers/properties") ||
      (context.method === "POST" && context.path === "/api/customers/properties") ||
      (context.method === "POST" && context.path === "/api/customers/properties/default") ||
      (context.method === "GET" && context.path === "/api/customers/review-opportunities") ||
      (context.method === "GET" && context.path === "/api/customers/retention-opportunities") ||
      (context.method === "POST" && context.path === "/api/quotes/instant") ||
      (context.method === "POST" && context.path === "/api/providers/availability") ||
      (context.method === "GET" && context.path === "/api/bookings/detail") ||
      (context.method === "GET" && context.path === "/api/places/search") ||
      (context.method === "POST" && context.path === "/api/places/reverse-geocode") ||
      (context.method === "POST" && context.path === "/api/providers/search") ||
      (context.method === "GET" && context.path === "/api/providers/public-overview") ||
      (context.method === "GET" && context.path === "/api/providers/profile") ||
      (context.method === "POST" && context.path === "/api/providers/profile") ||
      (context.method === "GET" && context.path === "/api/providers/verification/queue") ||
      (context.method === "POST" && context.path === "/api/providers/verification/review") ||
      (context.method === "POST" && context.path === "/api/providers/credentials") ||
      (context.method === "POST" && context.path === "/api/providers/credentials/review") ||
      (context.method === "GET" && context.path === "/api/providers/connect/status") ||
      (context.method === "POST" && context.path === "/api/providers/connect/onboarding") ||
      (context.method === "POST" && context.path === "/api/providers/verification/onboarding-automation/sweep") ||
      (context.method === "GET" && context.path === "/api/crew/opportunities") ||
      (context.method === "GET" && context.path === "/api/crew/opportunities/public") ||
      (context.method === "POST" && context.path === "/api/crew/opportunities/public/select") ||
      (context.method === "POST" && context.path === "/api/crew/opportunities/claim") ||
      (context.method === "GET" && context.path === "/api/providers/clients") ||
      (context.method === "GET" && context.path === "/api/providers/staffing") ||
      (context.method === "POST" && context.path === "/api/providers/staffing/review") ||
      (context.method === "POST" && context.path === "/api/providers/staffing/route-leader") ||
      (context.method === "POST" && context.path === "/api/providers/settings") ||
      (context.method === "POST" && context.path === "/api/providers/assistant") ||
      (context.method === "GET" && context.path === "/api/providers/reviews") ||
      (context.method === "POST" && context.path === "/api/providers/reviews") ||
      (context.method === "POST" && context.path === "/api/providers/reviews/response") ||
      (context.method === "POST" && context.path === "/api/providers/reviews/response/inbound") ||
      (context.method === "POST" && context.path === "/api/providers/reviews/response/inbound/shared-inbox") ||
      (context.method === "POST" && context.path === "/api/providers/reviews/response/inbound/google-business-profile") ||
      (context.method === "POST" && context.path === "/api/providers/reviews/escalate") ||
      (context.method === "GET" && context.path === "/api/notifications") ||
      (context.method === "POST" && context.path === "/api/notifications/read") ||
      (context.method === "GET" && context.path === "/api/notifications/preferences") ||
      (context.method === "POST" && context.path === "/api/notifications/preferences") ||
      (context.method === "GET" && context.path === "/api/notifications/deliveries") ||
      (context.method === "POST" && context.path === "/api/notifications/devices") ||
      (context.method === "POST" && context.path === "/api/notifications/devices/remove") ||
      (context.method === "GET" && context.path === "/api/notifications/ops/health") ||
      (context.method === "POST" && context.path === "/api/notifications/ops/retry-due") ||
      (context.method === "POST" && context.path === "/api/notifications/ops/escalate") ||
      (context.method === "POST" && context.path === "/api/bookings") ||
      (context.method === "GET" && context.path === "/api/bookings/recurring-plans") ||
      (context.method === "POST" && context.path === "/api/bookings/recurring-plans") ||
      (context.method === "POST" && context.path === "/api/bookings/recurring-plans/cancel") ||
      (context.method === "POST" && context.path === "/api/bookings/cancel") ||
      (context.method === "POST" && context.path === "/api/bookings/schedule-update") ||
      (context.method === "POST" && context.path === "/api/bookings/schedule-response") ||
      (context.method === "POST" && context.path === "/api/bookings/reschedule") ||
      (context.method === "POST" && context.path === "/api/bookings/confirm") ||
      (context.method === "POST" && context.path === "/api/bookings/decline") ||
      (context.method === "POST" && context.path === "/api/bookings/start") ||
      (context.method === "POST" && context.path === "/api/bookings/evidence") ||
      (context.method === "POST" && context.path === "/api/bookings/photo-marketing-use") ||
      (context.method === "POST" && context.path === "/api/bookings/complete") ||
      (context.method === "POST" && context.path === "/api/bookings/on-route") ||
      (context.method === "POST" && context.path === "/api/bookings/route-stop") ||
      (context.method === "POST" && context.path === "/api/bookings/route-stop/clear") ||
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
      (context.method === "POST" && context.path === "/api/crew/matches/cancel") ||
      (context.method === "GET" && context.path === "/api/chat/provider-crew/threads") ||
      (context.method === "GET" && context.path === "/api/chat/provider-crew/messages") ||
      (context.method === "POST" && context.path === "/api/chat/provider-crew/messages") ||
      (context.method === "GET" && context.path === "/api/chat/customer-provider/threads") ||
      (context.method === "GET" && context.path === "/api/chat/customer-provider/messages") ||
      (context.method === "POST" && context.path === "/api/chat/customer-provider/messages") ||
      (context.method === "GET" && context.path === "/api/payments") ||
      (context.method === "GET" && context.path === "/api/payouts/provider") ||
      (context.method === "GET" && context.path === "/api/payouts/crew") ||
      (context.method === "GET" && context.path === "/api/payouts/ops/preview") ||
      (context.method === "GET" && context.path === "/api/payouts/ops/disbursement-runs") ||
      (context.method === "POST" && context.path === "/api/payouts/ops/disbursement-runs") ||
      (context.method === "POST" && context.path === "/api/payouts/ops/disbursement-runs/execute") ||
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
      (context.method === "POST" && context.path === "/api/calendar/imports/sync-stale") ||
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

    if (context.path === "/api/pricing/minimums" && context.method === "GET") {
      const rows = await this.platform.getPricingMinimums(context.query.get("postalCode") ?? "");
      sendJson(response, 200, rows.map(({ postalCode, category, minimumStartingPriceCents }) => ({ postalCode, category, minimumStartingPriceCents })));
      return;
    }
    if (context.path === "/api/ops/pricing/minimums") {
      const identity = await requireOpsAdminAccess(context, this.platform);
      sendJson(response, 200, context.method === "GET"
        ? await this.platform.getPricingMinimums(context.query.get("postalCode") ?? "")
        : await this.platform.setPricingMinimum(identity.userId, context.body as UpdateZipServiceMinimumRequest));
      return;
    }
    if (context.path === "/api/providers/pricing") {
      const identity = await requireRole(context, this.platform, "provider");
      sendJson(response, 200, context.method === "GET"
        ? await this.platform.getProviderPricing(identity.userId, context.query.get("postalCode") ?? "")
        : await this.platform.saveProviderPricing(identity.userId, (context.body as { prices: ProviderServicePrice[] })?.prices));
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

    if (context.method === "POST" && context.path === "/api/places/reverse-geocode") {
      const payload = context.body as ReverseGeocodePlaceRequest;
      sendJson(response, 200, await this.platform.reverseGeocodePlace(payload.latitude, payload.longitude));
      return;
    }

    if (context.method === "POST" && context.path === "/api/providers/search") {
      sendJson(response, 200, await this.platform.searchProviders(context.body as SearchProvidersRequest));
      return;
    }

    if (context.method === "POST" && context.path === "/api/providers/availability") {
      sendJson(response, 200, await this.platform.getProviderAvailability(context.body as ProviderAvailabilityRequest));
      return;
    }

    if (context.method === "GET" && context.path === "/api/providers/public-overview") {
      sendJson(response, 200, await this.platform.getPublicMarketplaceOverview());
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

      sendJson(response, 200, await this.platform.getMarketplaceProviderProfile(providerId));
      return;
    }

    if (context.method === "GET" && context.path === "/api/customers/retention-opportunities") {
      const identity = await requireRole(context, this.platform, "customer");
      sendJson(response, 200, await this.platform.listCustomerRetentionOpportunities(identity.userId));
      return;
    }

    if (context.method === "POST" && context.path === "/api/providers/profile") {
      const identity = await requireRole(context, this.platform, "provider");
      sendJson(
        response,
        200,
        await this.platform.updateProviderProfile(identity.userId, context.body as UpdateProviderProfileRequest)
      );
      return;
    }

    if (context.method === "GET" && context.path === "/api/providers/verification/queue") {
      await requireOpsAccess(context, this.platform);
      sendJson(response, 200, await this.platform.listProviderVerificationQueue());
      return;
    }

    if (context.method === "POST" && context.path === "/api/providers/verification/review") {
      await requireOpsAccess(context, this.platform);
      sendJson(
        response,
        200,
        await this.platform.reviewProviderVerification(context.body as ReviewProviderVerificationRequest)
      );
      return;
    }

    if (context.method === "POST" && context.path === "/api/providers/credentials") {
      const identity = await requireRole(context, this.platform, "provider");
      sendJson(
        response,
        200,
        await this.platform.submitProviderCredential(
          identity.userId,
          context.body as SubmitProviderCredentialRequest
        )
      );
      return;
    }

    if (context.method === "POST" && context.path === "/api/providers/credentials/review") {
      const identity = await requireOpsAccess(context, this.platform);
      sendJson(
        response,
        200,
        await this.platform.reviewProviderCredential(
          identity.userId,
          context.body as ReviewProviderCredentialRequest
        )
      );
      return;
    }

    if (context.method === "GET" && context.path === "/api/providers/connect/status") {
      const identity = await requireRole(context, this.platform, "provider");
      sendJson(response, 200, await this.platform.getProviderConnectStatus(identity.userId));
      return;
    }

    if (context.method === "POST" && context.path === "/api/providers/connect/onboarding") {
      const identity = await requireFreshRole(
        context,
        this.platform,
        "provider",
        MarketplacePlatformService.sensitiveActionFreshSessionMaxAgeSeconds,
        "Re-authentication required for payout onboarding. Sign in again and retry within 15 minutes."
      );
      sendJson(response, 200, await this.platform.startProviderConnectOnboarding(identity.userId));
      return;
    }

    if (context.method === "POST" && context.path === "/api/providers/verification/onboarding-automation/sweep") {
      const identity = await requireOpsAccess(context, this.platform);
      sendJson(
        response,
        200,
        await this.platform.processProviderOnboardingAutomation(
          identity,
          context.body as ProcessProviderOnboardingAutomationRequest
        )
      );
      return;
    }

    if (context.method === "GET" && context.path === "/api/crew/opportunities") {
      await requireRole(context, this.platform, "crew-member");
      sendJson(response, 200, await this.platform.listCrewOpportunities());
      return;
    }

    if (context.method === "GET" && context.path === "/api/crew/opportunities/public") {
      sendJson(response, 200, await this.platform.listCrewOpportunities());
      return;
    }

    if (context.method === "POST" && context.path === "/api/crew/opportunities/public/select") {
      sendJson(
        response,
        200,
        await this.platform.selectPublicCrewOpportunity(context.body as SelectPublicCrewOpportunityRequest)
      );
      return;
    }

    if (context.method === "POST" && context.path === "/api/crew/opportunities/claim") {
      const identity = await requireRole(context, this.platform, "crew-member");
      sendJson(
        response,
        200,
        await this.platform.claimPublicCrewOpportunity(
          identity.userId,
          context.body as ClaimPublicCrewOpportunityRequest
        )
      );
      return;
    }

    if (context.method === "GET" && context.path === "/api/providers/clients") {
      const identity = await requireRole(context, this.platform, "provider");
      response.setHeader("Cache-Control", "private, no-store");
      sendJson(response, 200, await this.platform.getProviderClients(identity.userId));
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

    if (context.method === "POST" && context.path === "/api/providers/staffing/route-leader") {
      const identity = await requireRole(context, this.platform, "provider");
      sendJson(
        response,
        200,
        await this.platform.assignBookingRouteLeader(identity.userId, context.body as AssignBookingRouteLeaderRequest)
      );
      return;
    }

    if (context.method === "POST" && context.path === "/api/providers/settings") {
      const payload = context.body as UpdateProviderSettingsRequest;
      const identity = MarketplaceController.requiresFreshProviderPayoutReauth(payload)
        ? await requireFreshRole(
            context,
            this.platform,
            "provider",
            MarketplacePlatformService.sensitiveActionFreshSessionMaxAgeSeconds,
            "Re-authentication required for payout settings. Sign in again and retry within 15 minutes."
          )
        : await requireRole(context, this.platform, "provider");
      sendJson(
        response,
        200,
        await this.platform.updateProviderSettings(identity.userId, payload)
      );
      return;
    }

    if (context.method === "POST" && context.path === "/api/providers/assistant") {
      const identity = await requireRole(context, this.platform, "provider");
      sendJson(
        response,
        200,
        await this.platform.runProviderAssistantCommand(identity.userId, context.body as ProviderAssistantCommandRequest)
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

      sendJson(response, 200, await this.platform.listPublicProviderReviews(providerId));
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

    if (context.method === "POST" && context.path === "/api/providers/reviews/response") {
      await requireOpsAccess(context, this.platform);
      sendJson(
        response,
        200,
        await this.platform.updateReviewResponse(context.body as UpdateReviewResponseRequest)
      );
      return;
    }

    if (context.method === "POST" && context.path === "/api/providers/reviews/response/inbound") {
      sendJson(
        response,
        201,
        await this.platform.createInboundReviewResponse(
          context.body as CreateInboundReviewResponseRequest,
          context.headers["x-yardmatch-review-response-secret"]
        )
      );
      return;
    }

    if (context.method === "POST" && context.path === "/api/providers/reviews/response/inbound/shared-inbox") {
      sendJson(
        response,
        201,
        await this.platform.createInboundSharedInboxReviewResponse(
          this.normalizeInboundSharedInboxReviewResponseRequest(context.body),
          context.headers["x-yardmatch-review-response-secret"]
        )
      );
      return;
    }

    if (
      context.method === "POST" &&
      context.path === "/api/providers/reviews/response/inbound/google-business-profile"
    ) {
      sendJson(
        response,
        201,
        await this.platform.createInboundGoogleBusinessProfileReviewResponse(
          this.normalizeInboundGoogleBusinessProfileReviewResponseRequest(context.body),
          context.headers["x-yardmatch-review-response-secret"]
        )
      );
      return;
    }

    if (context.method === "POST" && context.path === "/api/providers/reviews/escalate") {
      await requireOpsAccess(context, this.platform);
      sendJson(
        response,
        200,
        await this.platform.escalateReviewForSupport(context.body as EscalateReviewSupportRequest)
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

    if (context.method === "GET" && context.path === "/api/notifications/ops/health") {
      await requireOpsAccess(context, this.platform);
      sendJson(response, 200, await this.platform.getNotificationOpsHealth());
      return;
    }

    if (context.method === "POST" && context.path === "/api/notifications/ops/retry-due") {
      await requireOpsAccess(context, this.platform);
      sendJson(response, 200, await this.platform.retryDueNotificationDeliveriesForOps());
      return;
    }

    if (context.method === "POST" && context.path === "/api/notifications/ops/escalate") {
      await requireOpsAccess(context, this.platform);
      sendJson(response, 200, await this.platform.escalateNotificationOpsAlerts());
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

    if (context.method === "GET" && context.path === "/api/bookings/detail") {
      const identity = await requireRole(context, this.platform, "customer");
      const requestId = context.query.get("requestId");
      sendJson(response, 200, requestId ? await this.platform.getCustomerBookingForRequest(identity.userId, requestId) : await this.platform.getCustomerBooking(identity.userId, context.query.get("bookingId") ?? ""));
      return;
    }

    if (context.method === "GET" && context.path === "/api/bookings/recurring-plans") {
      const identity = await requireRole(context, this.platform, "customer");
      sendJson(response, 200, await this.platform.listRecurringServicePlansForCustomer(identity.userId));
      return;
    }

    if (context.method === "POST" && context.path === "/api/bookings/recurring-plans") {
      const identity = await requireRole(context, this.platform, "customer");
      sendJson(
        response,
        201,
        await this.platform.createRecurringServicePlan(
          identity.userId,
          context.body as CreateRecurringServicePlanRequest
        )
      );
      return;
    }

    if (context.method === "POST" && context.path === "/api/bookings/recurring-plans/cancel") {
      const identity = await requireRole(context, this.platform, "customer");
      sendJson(
        response,
        200,
        await this.platform.cancelRecurringServicePlan(
          identity.userId,
          context.body as CancelRecurringServicePlanRequest
        )
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

    if (context.method === "POST" && context.path === "/api/bookings/schedule-update") {
      const identity = await requireRole(context, this.platform, "provider");
      sendJson(response, 200, await this.platform.updateBookingSchedule(identity.userId, context.body as UpdateBookingScheduleRequest));
      return;
    }
    if (context.method === "POST" && context.path === "/api/bookings/schedule-response") {
      const identity = await requireRole(context, this.platform, "customer");
      sendJson(response, 200, await this.platform.respondBookingSchedule(identity.userId, context.body as RespondBookingScheduleRequest));
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

    if (context.method === "POST" && context.path === "/api/bookings/decline") {
      const identity = await requireRole(context, this.platform, "provider");
      sendJson(
        response,
        200,
        await this.platform.declineBooking(identity.userId, context.body as DeclineBookingRequest)
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

    if (context.method === "POST" && context.path === "/api/bookings/evidence") {
      const identity = await requireAuthenticatedIdentity(context, this.platform);
      sendJson(
        response,
        200,
        await this.platform.addBookingEvidence(identity, context.body as AddBookingEvidenceRequest)
      );
      return;
    }

    if (context.method === "POST" && context.path === "/api/bookings/photo-marketing-use") {
      const identity = await requireRole(context, this.platform, "customer");
      sendJson(
        response,
        200,
        await this.platform.updateBookingPhotoMarketingUse(
          identity.userId,
          context.body as UpdateBookingPhotoMarketingUseRequest
        )
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

    if (context.method === "POST" && context.path === "/api/bookings/route-stop") {
      const identity = await requireRole(context, this.platform, "provider");
      sendJson(
        response,
        200,
        await this.platform.setBookingRouteStop(identity.userId, context.body as SetBookingRouteStopRequest)
      );
      return;
    }

    if (context.method === "POST" && context.path === "/api/bookings/route-stop/clear") {
      const identity = await requireRole(context, this.platform, "provider");
      sendJson(
        response,
        200,
        await this.platform.clearBookingRouteStop(identity.userId, context.body as ClearBookingRouteStopRequest)
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
        await this.platform.createBookingDispute(
          {
            userId: identity.userId,
            role: identity.role as "customer" | "provider"
          },
          context.body as CreateBookingDisputeRequest
        )
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
      sendJson(
        response,
        200,
        await this.platform.listBookingsForUser(identity, {
          ...parsePaginationInput(context.query),
          scope: parseBookingListScope(context.query)
        })
      );
      return;
    }

    if (context.method === "GET" && context.path === "/api/payments") {
      const identity = await requireAuthenticatedIdentity(context, this.platform);
      sendJson(
        response,
        200,
        await this.platform.listPaymentsForUser(identity, parseBoundedBookingIds(context.query))
      );
      return;
    }

    if (context.method === "GET" && context.path === "/api/payouts/provider") {
      const identity = await requireRole(context, this.platform, "provider");
      sendJson(response, 200, await this.platform.getProviderPayoutLedger(identity.userId));
      return;
    }

    if (context.method === "GET" && context.path === "/api/payouts/crew") {
      const identity = await requireRole(context, this.platform, "crew-member");
      sendJson(response, 200, await this.platform.getCrewPayoutLedger(identity.userId));
      return;
    }

    if (context.method === "GET" && context.path === "/api/payouts/ops/preview") {
      await requireOpsAccess(context, this.platform);
      sendJson(response, 200, await this.platform.getOpsPayoutPreview());
      return;
    }

    if (context.method === "GET" && context.path === "/api/payouts/ops/disbursement-runs") {
      await requireOpsAccess(context, this.platform);
      sendJson(response, 200, await this.platform.listOpsPayoutDisbursementRuns());
      return;
    }

    if (context.method === "POST" && context.path === "/api/payouts/ops/disbursement-runs") {
      const identity = await requireOpsAccess(context, this.platform);
      sendJson(
        response,
        201,
        await this.platform.createOpsPayoutDisbursementRun(
          identity,
          context.body as CreateOpsPayoutDisbursementRunRequest
        )
      );
      return;
    }

    if (
      context.method === "POST" &&
      context.path === "/api/payouts/ops/disbursement-runs/execute"
    ) {
      const identity = await requireFreshRole(
        context,
        this.platform,
        "ops",
        MarketplacePlatformService.sensitiveActionFreshSessionMaxAgeSeconds,
        "Re-authentication required for provider transfers. Sign in again and retry within 15 minutes."
      );
      sendJson(
        response,
        200,
        await this.platform.executeOpsPayoutDisbursementRun(
          identity,
          context.body as ExecuteOpsPayoutDisbursementRunRequest
        )
      );
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
      const identity = await requireRole(context, this.platform, ["customer", "provider"]);
      sendJson(
        response,
        200,
        await this.platform.createRefund(
          {
            userId: identity.userId,
            role: identity.role as "customer" | "provider"
          },
          context.body as CreateRefundRequest
        )
      );
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

    if (context.method === "POST" && context.path === "/api/crew/matches/cancel") {
      const identity = await requireRole(context, this.platform, "crew-member");
      sendJson(response, 200, await this.platform.cancelCrewMatch(identity.userId, context.body as CancelCrewMatchRequest));
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
      const overview = await this.platform.getProviderCalendarOverview(identity.userId, {
        fromIso: context.query.get("from") ?? undefined,
        toIso: context.query.get("to") ?? undefined
      });
      sendJson(
        response,
        200,
        await localizeProviderCalendarOverview(overview, context.headers)
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

    if (context.method === "POST" && context.path === "/api/calendar/imports/sync-stale") {
      const identity = await requireRole(context, this.platform, "provider");
      sendJson(response, 200, await this.platform.syncStaleProviderCalendarImports(identity.userId));
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

  private normalizeInboundSharedInboxReviewResponseRequest(
    body: unknown
  ): CreateInboundSharedInboxReviewResponseRequest {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return body as CreateInboundSharedInboxReviewResponseRequest;
    }

    const record = body as Record<string, unknown>;
    const readString = (...keys: string[]) => this.readStringField(record, keys);

    return {
      reviewId: readString("reviewId", "review_id", "review-id") ?? "",
      externalResponseId: readString(
        "externalResponseId",
        "external_response_id",
        "replyId",
        "reply_id",
        "reply-id"
      ),
      messageId: readString("messageId", "message_id", "message-id", "MessageID"),
      threadId: readString("threadId", "thread_id", "thread-id", "inReplyTo", "in-reply-to", "references"),
      threadUrl: readString("threadUrl", "thread_url", "thread-url"),
      mailboxName: readString("mailboxName", "mailbox_name", "mailbox"),
      senderEmail: readString("senderEmail", "sender_email", "from", "fromEmail", "from_email", "sender"),
      responseHandledBy: readString("responseHandledBy", "response_handled_by", "handledBy", "handled_by"),
      responseNotes: readString("responseNotes", "response_notes", "notes"),
      publicReplyBody: readString(
        "publicReplyBody",
        "public_reply_body",
        "replyText",
        "reply_text",
        "text",
        "body"
      ) ?? "",
      publicResponseUrl: readString(
        "publicResponseUrl",
        "public_response_url",
        "public-url",
        "public_url",
        "replyUrl",
        "reply_url"
      )
    };
  }

  private normalizeInboundGoogleBusinessProfileReviewResponseRequest(
    body: unknown
  ): CreateInboundGoogleBusinessProfileReviewResponseRequest {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return body as CreateInboundGoogleBusinessProfileReviewResponseRequest;
    }

    const record = body as Record<string, unknown>;
    const readString = (...keys: string[]) => this.readStringField(record, keys);

    return {
      reviewId: readString("reviewId", "review_id", "review-id") ?? "",
      replyId: readString("replyId", "reply_id", "reply-id", "externalResponseId", "external_response_id"),
      threadUrl: readString("threadUrl", "thread_url", "thread-url"),
      profileLocationName: readString(
        "profileLocationName",
        "profile_location_name",
        "locationName",
        "location_name",
        "location-name"
      ),
      responseHandledBy: readString("responseHandledBy", "response_handled_by", "handledBy", "handled_by"),
      responseNotes: readString("responseNotes", "response_notes", "notes"),
      publicReplyBody: readString(
        "publicReplyBody",
        "public_reply_body",
        "replyText",
        "reply_text",
        "text",
        "body"
      ) ?? "",
      publicResponseUrl: readString(
        "publicResponseUrl",
        "public_response_url",
        "public-url",
        "public_url",
        "replyUrl",
        "reply_url"
      )
    };
  }

  private readStringField(record: Record<string, unknown>, keys: string[]): string | undefined {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed.length > 0) {
          return trimmed;
        }
        continue;
      }

      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item !== "string") {
            continue;
          }
          const trimmed = item.trim();
          if (trimmed.length > 0) {
            return trimmed;
          }
        }
      }
    }

    return undefined;
  }

  private static requiresFreshProviderPayoutReauth(payload: UpdateProviderSettingsRequest): boolean {
    return payload.weeklyPayoutDay !== undefined || payload.instantPayoutsEnabled !== undefined;
  }
}
