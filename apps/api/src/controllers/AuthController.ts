import {
  AuthenticatedUserEnvelope,
  ConfirmPasswordResetRequest,
  CurrentUserResponse,
  GoogleAuthStartResponse,
  LoginRequest,
  RequestPasswordResetRequest,
  RegisterUserRequest
} from "@yardmatch/contracts";
import {
  TOKEN_TTL_SECONDS,
  getSessionExpiryIso,
  getBearerToken,
  hashPassword,
  signSessionToken,
  validatePasswordStrength,
  verifyPassword,
  verifySessionToken
} from "../auth";
import { ApiController, HttpError, RequestContext, sendJson, sendRedirect } from "../http";
import { MarketplacePlatformService } from "../services/MarketplacePlatformService";

export class AuthController implements ApiController {
  public constructor(private readonly platform: MarketplacePlatformService) {}

  public canHandle(context: RequestContext): boolean {
    return (
      (context.method === "POST" && context.path === "/api/auth/register") ||
      (context.method === "POST" && context.path === "/api/auth/login") ||
      (context.method === "POST" && context.path === "/api/auth/password-reset/request") ||
      (context.method === "POST" && context.path === "/api/auth/password-reset/confirm") ||
      (context.method === "GET" && context.path === "/api/auth/me") ||
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

    if (context.method === "POST" && context.path === "/api/auth/login") {
      const payload = context.body as LoginRequest;
      const identity = await this.platform.findAuthIdentityByEmail(payload.email.trim().toLowerCase());

      if (!identity?.passwordHash || !verifyPassword(payload.password, identity.passwordHash)) {
        throw new HttpError(401, "Invalid email or password");
      }

      const user = await this.platform.getUserByIdentity(identity);
      if (!user) {
        throw new HttpError(404, "User profile not found");
      }

      const result: AuthenticatedUserEnvelope = {
        session: {
          token: signSessionToken({
            userId: identity.userId,
            email: identity.email,
            role: identity.role,
            sessionVersion: identity.sessionVersion
          }),
          expiresInSeconds: TOKEN_TTL_SECONDS,
          expiresAtIso: getSessionExpiryIso(TOKEN_TTL_SECONDS)
        },
        user
      };

      sendJson(response, 200, result);
      return;
    }

    if (context.method === "POST" && context.path === "/api/auth/password-reset/request") {
      const payload = context.body as RequestPasswordResetRequest;
      const result = await this.platform.requestPasswordReset(payload);
      sendJson(response, 200, result);
      return;
    }

    if (context.method === "POST" && context.path === "/api/auth/password-reset/confirm") {
      const payload = context.body as ConfirmPasswordResetRequest;
      const user = await this.platform.confirmPasswordReset(payload);
      const identity = await this.platform.findAuthIdentityByUserId(user.id);
      if (!identity) {
        throw new HttpError(404, "User profile not found");
      }

      const result: AuthenticatedUserEnvelope = {
        session: {
          token: signSessionToken({
            userId: identity.userId,
            email: identity.email,
            role: identity.role,
            sessionVersion: identity.sessionVersion
          }),
          expiresInSeconds: TOKEN_TTL_SECONDS,
          expiresAtIso: getSessionExpiryIso(TOKEN_TTL_SECONDS)
        },
        user
      };

      sendJson(response, 200, result);
      return;
    }

    if (context.method === "GET" && context.path === "/api/auth/me") {
      const token = getBearerToken(context);
      if (!token) {
        throw new HttpError(401, "Missing bearer token");
      }

      let session;
      try {
        session = verifySessionToken(token);
      } catch (error) {
        throw new HttpError(401, error instanceof Error ? error.message : "Invalid bearer token");
      }
      const identity = await this.platform.findAuthIdentityByUserId(session.userId);
      if (!identity) {
        throw new HttpError(401, "Unknown session");
      }
      if (identity.sessionVersion !== session.sessionVersion) {
        throw new HttpError(401, "Session has been replaced");
      }

      const user = await this.platform.getUserByIdentity(identity);
      if (!user) {
        throw new HttpError(404, "User profile not found");
      }

      const result: CurrentUserResponse = {
        user
      };
      sendJson(response, 200, result);
      return;
    }

    const payload = context.body as RegisterUserRequest;
    validatePasswordStrength(payload.password);
    const existingIdentity = await this.platform.findAuthIdentityByEmail(payload.email.trim().toLowerCase());
    if (existingIdentity) {
      throw new HttpError(409, "An account with that email already exists");
    }

    const user = await this.platform.registerUser(
      {
        ...payload,
        email: payload.email.trim().toLowerCase()
      },
      hashPassword(payload.password)
    );

    const result: AuthenticatedUserEnvelope = {
      session: {
        token: signSessionToken({
          userId: user.id,
          email: user.email,
          role: user.role,
          sessionVersion: 1
        }),
        expiresInSeconds: TOKEN_TTL_SECONDS,
        expiresAtIso: getSessionExpiryIso(TOKEN_TTL_SECONDS)
      },
      user
    };

    sendJson(response, 201, result);
  }
}
