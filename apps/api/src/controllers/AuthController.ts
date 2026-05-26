import { GoogleAuthStartResponse, RegisterUserRequest } from "@yardmatch/contracts";
import { ApiController, RequestContext, sendJson, sendRedirect } from "../http";
import { MarketplacePlatformService } from "../services/MarketplacePlatformService";

export class AuthController implements ApiController {
  public constructor(private readonly platform: MarketplacePlatformService) {}

  public canHandle(context: RequestContext): boolean {
    return (
      (context.method === "POST" && context.path === "/api/auth/register") ||
      (context.method === "GET" &&
        (context.path === "/api/auth/google/start" || context.path === "/api/auth/apple/start"))
    );
  }

  public async handle(
    context: RequestContext,
    response: Parameters<typeof sendJson>[0]
  ): Promise<void> {
    if (
      context.method === "GET" &&
      (context.path === "/api/auth/google/start" || context.path === "/api/auth/apple/start")
    ) {
      const role = (context.query.get("role") ?? "customer") as GoogleAuthStartResponse["role"];
      const mode = (context.query.get("mode") ?? "signup") as GoogleAuthStartResponse["mode"];
      const provider =
        context.path === "/api/auth/apple/start" ? ("apple" as const) : ("google" as const);
      const redirectPath =
        role === "provider" ? "/provider" : role === "crew-member" ? "/crew" : "/customer";
      const redirectUrl = `http://localhost:3000${redirectPath}?authProvider=${provider}&mode=${mode}`;

      // This shared entry point keeps the web signup pages aligned until a production OAuth
      // callback and token exchange are wired in.
      const payload: GoogleAuthStartResponse = {
        provider,
        role,
        mode,
        redirectUrl,
        status: "demo-redirect"
      };

      response.setHeader("X-YardMatch-Google-Auth", JSON.stringify(payload));
      sendRedirect(response, redirectUrl);
      return;
    }

    const user = this.platform.registerUser(context.body as RegisterUserRequest);
    sendJson(response, 201, user);
  }
}
