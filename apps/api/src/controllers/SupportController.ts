import {
  CreateInboundEmailLaunchLeadRequest,
  CreateInboundGoogleBusinessProfileLeadRequest,
  CreateInboundReferralLaunchLeadRequest,
  AnalyticsEvent,
  CreateInboundLaunchLeadRequest,
  CreateLaunchLeadRequest,
  CreateOpsBookingInterventionRequest,
  CreateOpsRefundOverrideRequest,
  ReviewBookingEvidenceForOpsRequest,
  CreateSupportTicketRequest,
  UpdateLaunchLeadRequest,
  UpdateSupportTicketRequest
} from "@yardmatch/contracts";
import { requireAuthenticatedIdentity } from "../controller-auth";
import { ApiController, RequestContext, sendJson } from "../http";
import { MarketplacePlatformService } from "../services/MarketplacePlatformService";

export class SupportController implements ApiController {
  public constructor(private readonly platform: MarketplacePlatformService) {}

  public canHandle(context: RequestContext): boolean {
    return (
      (context.method === "POST" && context.path === "/api/launch/leads") ||
      (context.method === "POST" && context.path === "/api/launch/inbound") ||
      (context.method === "POST" && context.path === "/api/launch/inbound/email") ||
      (context.method === "POST" && context.path === "/api/launch/inbound/google-business-profile") ||
      (context.method === "POST" && context.path === "/api/launch/inbound/referral") ||
      (context.method === "GET" && context.path === "/api/launch/ops/leads") ||
      (context.method === "POST" && context.path === "/api/launch/ops/leads/update") ||
      (context.method === "GET" && context.path === "/api/support/tickets") ||
      (context.method === "POST" && context.path === "/api/support/tickets") ||
      (context.method === "GET" && context.path === "/api/support/ops/summary") ||
      (context.method === "GET" && context.path === "/api/support/ops/tickets") ||
      (context.method === "POST" && context.path === "/api/support/ops/tickets/update") ||
      (context.method === "POST" && context.path === "/api/support/ops/refund-override") ||
      (context.method === "POST" && context.path === "/api/support/ops/bookings/intervene") ||
      (context.method === "POST" && context.path === "/api/support/ops/bookings/evidence/review") ||
      (context.method === "POST" && context.path === "/api/analytics/events")
    );
  }

  public async handle(context: RequestContext, response: Parameters<typeof sendJson>[0]): Promise<void> {
    if (context.path === "/api/launch/ops/leads") {
      sendJson(response, 200, await this.platform.listOpsLaunchLeads());
      return;
    }

    if (context.path === "/api/launch/ops/leads/update") {
      sendJson(response, 200, await this.platform.updateLaunchLeadForOps(context.body as UpdateLaunchLeadRequest));
      return;
    }

    if (context.path === "/api/launch/leads") {
      sendJson(response, 201, await this.platform.createLaunchLead(context.body as CreateLaunchLeadRequest));
      return;
    }

    if (context.path === "/api/launch/inbound") {
      sendJson(
        response,
        201,
        await this.platform.createInboundLaunchLead(
          context.body as CreateInboundLaunchLeadRequest,
          context.headers["x-yardmatch-inbound-secret"]
        )
      );
      return;
    }

    if (context.path === "/api/launch/inbound/email") {
      sendJson(
        response,
        201,
        await this.platform.createInboundEmailLaunchLead(
          context.body as CreateInboundEmailLaunchLeadRequest,
          context.headers["x-yardmatch-inbound-secret"]
        )
      );
      return;
    }

    if (context.path === "/api/launch/inbound/google-business-profile") {
      sendJson(
        response,
        201,
        await this.platform.createInboundGoogleBusinessProfileLead(
          context.body as CreateInboundGoogleBusinessProfileLeadRequest,
          context.headers["x-yardmatch-inbound-secret"]
        )
      );
      return;
    }

    if (context.path === "/api/launch/inbound/referral") {
      sendJson(
        response,
        201,
        await this.platform.createInboundReferralLaunchLead(
          context.body as CreateInboundReferralLaunchLeadRequest,
          context.headers["x-yardmatch-inbound-secret"]
        )
      );
      return;
    }

    if (context.path === "/api/support/ops/summary") {
      sendJson(response, 200, await this.platform.getOpsFinancialExceptionSummary());
      return;
    }

    if (context.path === "/api/support/ops/tickets") {
      sendJson(response, 200, await this.platform.listOpsSupportTickets());
      return;
    }

    if (context.path === "/api/support/ops/refund-override") {
      sendJson(
        response,
        200,
        await this.platform.createOpsRefundOverride(context.body as CreateOpsRefundOverrideRequest)
      );
      return;
    }

    if (context.path === "/api/support/ops/bookings/intervene") {
      sendJson(
        response,
        200,
        await this.platform.createOpsBookingIntervention(context.body as CreateOpsBookingInterventionRequest)
      );
      return;
    }

    if (context.path === "/api/support/ops/bookings/evidence/review") {
      sendJson(
        response,
        200,
        await this.platform.reviewBookingEvidenceForOps(context.body as ReviewBookingEvidenceForOpsRequest)
      );
      return;
    }

    if (context.path === "/api/support/ops/tickets/update") {
      sendJson(
        response,
        200,
        await this.platform.updateSupportTicketForOps(context.body as UpdateSupportTicketRequest)
      );
      return;
    }

    if (context.path === "/api/support/tickets") {
      const identity = await requireAuthenticatedIdentity(context, this.platform);
      if (context.method === "GET") {
        sendJson(response, 200, await this.platform.listSupportTicketsForRequester(identity));
        return;
      }
      sendJson(
        response,
        201,
        await this.platform.createSupportTicket(identity, context.body as CreateSupportTicketRequest)
      );
      return;
    }

    sendJson(response, 201, this.platform.createAnalyticsEvent(context.body as AnalyticsEvent));
  }
}
