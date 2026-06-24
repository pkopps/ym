import { SessionHeartbeatRequest } from "@yardmatch/contracts";
import { requireOpsAccess } from "../controller-auth";
import { ApiController, RequestContext, sendJson } from "../http";
import { MarketplacePlatformService } from "../services/MarketplacePlatformService";

export class ObservabilityController implements ApiController {
  public constructor(private readonly platform: MarketplacePlatformService) {}

  public canHandle(context: RequestContext): boolean {
    return (
      (context.method === "POST" && context.path === "/api/observability/session-heartbeat") ||
      (context.method === "GET" && context.path === "/api/observability/overview") ||
      (context.method === "POST" && context.path === "/api/observability/inbound-automation/escalate")
    );
  }

  public async handle(context: RequestContext, response: Parameters<typeof sendJson>[0]): Promise<void> {
    if (context.path === "/api/observability/overview") {
      await requireOpsAccess(context, this.platform);
      sendJson(response, 200, await this.platform.getObservabilityOverview());
      return;
    }

    if (context.path === "/api/observability/inbound-automation/escalate") {
      await requireOpsAccess(context, this.platform);
      sendJson(response, 200, await this.platform.escalateInboundAutomationAlerts());
      return;
    }

    sendJson(
      response,
      201,
      this.platform.recordSessionHeartbeat(context.body as SessionHeartbeatRequest)
    );
  }
}
