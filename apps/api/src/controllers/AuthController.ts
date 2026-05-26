import { RegisterUserRequest } from "@yardmatch/contracts";
import { ApiController, RequestContext, sendJson } from "../http";
import { MarketplacePlatformService } from "../services/MarketplacePlatformService";

export class AuthController implements ApiController {
  public constructor(private readonly platform: MarketplacePlatformService) {}

  public canHandle(context: RequestContext): boolean {
    return context.method === "POST" && context.path === "/api/auth/register";
  }

  public async handle(
    context: RequestContext,
    response: Parameters<typeof sendJson>[0]
  ): Promise<void> {
    const user = this.platform.registerUser(context.body as RegisterUserRequest);
    sendJson(response, 201, user);
  }
}
