import { SessionHeartbeatRequest } from "@yardmatch/contracts";
import { ApiController, RequestContext, sendJson } from "../http";
import { MarketplacePlatformService } from "../services/MarketplacePlatformService";

export class ObservabilityController implements ApiController {
  public constructor(private readonly platform: MarketplacePlatformService) {}

  public canHandle(context: RequestContext): boolean {
    return (
      (context.method === "POST" && context.path === "/api/observability/session-heartbeat") ||
      (context.method === "GET" && context.path === "/api/observability/overview")
    );
  }

  public async handle(context: RequestContext, response: Parameters<typeof sendJson>[0]): Promise<void> {
    if (context.path === "/api/observability/overview") {
      sendJson(response, 200, await this.platform.getObservabilityOverview());
      return;
    }

    sendJson(
      response,
      201,
      this.platform.recordSessionHeartbeat(context.body as SessionHeartbeatRequest)
    );
  }
}
