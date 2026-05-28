import { AnalyticsEvent, CreateSupportTicketRequest } from "@yardmatch/contracts";
import { requireAuthenticatedIdentity } from "../controller-auth";
import { ApiController, RequestContext, sendJson } from "../http";
import { MarketplacePlatformService } from "../services/MarketplacePlatformService";

export class SupportController implements ApiController {
  public constructor(private readonly platform: MarketplacePlatformService) {}

  public canHandle(context: RequestContext): boolean {
    return (
      (context.method === "POST" && context.path === "/api/support/tickets") ||
      (context.method === "POST" && context.path === "/api/analytics/events")
    );
  }

  public async handle(context: RequestContext, response: Parameters<typeof sendJson>[0]): Promise<void> {
    if (context.path === "/api/support/tickets") {
      const identity = await requireAuthenticatedIdentity(context, this.platform);
      sendJson(
        response,
        201,
        await this.platform.createSupportTicket(identity.userId, context.body as CreateSupportTicketRequest)
      );
      return;
    }

    sendJson(response, 201, this.platform.createAnalyticsEvent(context.body as AnalyticsEvent));
  }
}
