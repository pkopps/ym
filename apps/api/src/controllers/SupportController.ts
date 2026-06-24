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
import { requireOpsAccess, requireRole } from "../controller-auth";
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
      await requireOpsAccess(context, this.platform);
      sendJson(response, 200, await this.platform.listOpsLaunchLeads());
      return;
    }

    if (context.path === "/api/launch/ops/leads/update") {
      await requireOpsAccess(context, this.platform);
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
          this.normalizeInboundEmailLaunchLeadRequest(context.body),
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
      await requireOpsAccess(context, this.platform);
      sendJson(response, 200, await this.platform.getOpsFinancialExceptionSummary());
      return;
    }

    if (context.path === "/api/support/ops/tickets") {
      await requireOpsAccess(context, this.platform);
      sendJson(response, 200, await this.platform.listOpsSupportTickets());
      return;
    }

    if (context.path === "/api/support/ops/refund-override") {
      await requireOpsAccess(context, this.platform);
      sendJson(
        response,
        200,
        await this.platform.createOpsRefundOverride(context.body as CreateOpsRefundOverrideRequest)
      );
      return;
    }

    if (context.path === "/api/support/ops/bookings/intervene") {
      await requireOpsAccess(context, this.platform);
      sendJson(
        response,
        200,
        await this.platform.createOpsBookingIntervention(context.body as CreateOpsBookingInterventionRequest)
      );
      return;
    }

    if (context.path === "/api/support/ops/bookings/evidence/review") {
      await requireOpsAccess(context, this.platform);
      sendJson(
        response,
        200,
        await this.platform.reviewBookingEvidenceForOps(context.body as ReviewBookingEvidenceForOpsRequest)
      );
      return;
    }

    if (context.path === "/api/support/ops/tickets/update") {
      await requireOpsAccess(context, this.platform);
      sendJson(
        response,
        200,
        await this.platform.updateSupportTicketForOps(context.body as UpdateSupportTicketRequest)
      );
      return;
    }

    if (context.path === "/api/support/tickets") {
      const identity = await requireRole(context, this.platform, ["customer", "provider", "crew-member"]);
      if (context.method === "GET") {
        sendJson(
          response,
          200,
          await this.platform.listSupportTicketsForRequester({
            userId: identity.userId,
            role: identity.role as "customer" | "provider" | "crew-member"
          })
        );
        return;
      }
      sendJson(
        response,
        201,
        await this.platform.createSupportTicket(
          {
            userId: identity.userId,
            role: identity.role as "customer" | "provider" | "crew-member"
          },
          context.body as CreateSupportTicketRequest
        )
      );
      return;
    }

    sendJson(response, 201, this.platform.createAnalyticsEvent(context.body as AnalyticsEvent));
  }

  private normalizeInboundEmailLaunchLeadRequest(body: unknown): CreateInboundEmailLaunchLeadRequest {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return body as CreateInboundEmailLaunchLeadRequest;
    }

    const record = body as Record<string, unknown>;
    const readString = (...keys: string[]) => this.readStringField(record, keys);
    const serviceCategory = readString("serviceCategory", "service_category");

    return {
      sourceReferenceId: readString("sourceReferenceId", "source_reference_id"),
      messageId: readString("messageId", "message_id", "message-id", "MessageID"),
      threadId: readString("threadId", "thread_id", "thread-id", "inReplyTo", "in-reply-to", "references"),
      senderEmail: readString("senderEmail", "sender_email", "from", "fromEmail", "from_email", "sender") ?? "",
      senderName: readString("senderName", "sender_name", "fromName", "from_name"),
      replyToEmail: readString("replyToEmail", "reply_to", "replyTo", "reply-to"),
      replyToName: readString("replyToName", "reply_to_name", "replyToName", "reply-to-name"),
      subject: readString("subject", "Subject"),
      textBody: readString(
        "textBody",
        "text_body",
        "text",
        "bodyText",
        "body_text",
        "body_plain",
        "body-plain",
        "strippedText",
        "stripped-text",
        "body"
      ),
      htmlBody: readString("htmlBody", "html_body", "html", "body_html", "body-html", "strippedHtml", "stripped-html"),
      areaLabel: readString("areaLabel", "area_label"),
      serviceCategory: serviceCategory as CreateInboundEmailLaunchLeadRequest["serviceCategory"] | undefined,
      assignedOwner: readString("assignedOwner", "assigned_owner")
    };
  }

  private readStringField(
    record: Record<string, unknown>,
    keys: string[]
  ): string | undefined {
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
}
