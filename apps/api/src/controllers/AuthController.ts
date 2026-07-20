import {
  AuthenticatedUserEnvelope,
  CompleteSocialSignupRequest,
  ConfirmPasswordResetRequest,
  CreateOpsAccountRequest,
  RequestOpsAccountPasswordResetRequest,
  CurrentUserResponse,
  GoogleAuthStartResponse,
  LoginRequest,
  OpsAuthenticationMethod,
  RotateOpsAccountSessionsRequest,
  RequestPasswordResetRequest,
  RegisterUserRequest,
  UpdateOpsAccountAccessRequest,
  UpdateOpsAccountRequest
} from "@yardmatch/contracts";
import {
  TOKEN_TTL_SECONDS,
  getSessionExpiryIso,
  getBearerToken,
  hashPassword,
  signScopedToken,
  signSessionToken,
  validatePasswordStrength,
  verifyScopedToken,
  verifyPassword,
  verifySessionToken
} from "../auth";
import { requireOpsAdminAccess } from "../controller-auth";
import { ApiController, HttpError, RequestContext, sendJson, sendRedirect } from "../http";
import { MarketplacePlatformService } from "../services/MarketplacePlatformService";
import { SocialAuthProvider, SocialAuthService, SocialIdentity } from "../services/SocialAuthService";

const oauthStatePurpose = "yardmatch-oauth-state";
const socialSignupPurpose = "yardmatch-social-signup";
const oauthStateTtlSeconds = 60 * 10;
const socialSignupTtlSeconds = 60 * 30;

interface OAuthStatePayload {
  provider: SocialAuthProvider;
  role: GoogleAuthStartResponse["role"];
  mode: GoogleAuthStartResponse["mode"];
  redirectUri: string;
}

interface PendingSocialSignupPayload {
  provider: SocialAuthProvider;
  subject: string;
  email: string;
  fullName: string;
  role: GoogleAuthStartResponse["role"];
  mode: GoogleAuthStartResponse["mode"];
}

export class AuthController implements ApiController {
  private readonly socialAuth: SocialAuthService;

  public constructor(private readonly platform: MarketplacePlatformService) {
    this.socialAuth = new SocialAuthService(platform.getApiBaseUrl());
  }

  public canHandle(context: RequestContext): boolean {
    return (
      (context.method === "POST" && context.path === "/api/auth/register") ||
      (context.method === "POST" && context.path === "/api/auth/login") ||
      (context.method === "POST" && context.path === "/api/auth/password-reset/request") ||
      (context.method === "POST" && context.path === "/api/auth/password-reset/confirm") ||
      (context.method === "GET" && context.path === "/api/ops/accounts") ||
      (context.method === "POST" && context.path === "/api/ops/accounts") ||
      (context.method === "POST" && context.path === "/api/ops/accounts/update") ||
      (context.method === "POST" && context.path === "/api/ops/accounts/rotate-sessions") ||
      (context.method === "POST" && context.path === "/api/ops/accounts/password-reset/request") ||
      (context.method === "POST" && context.path === "/api/ops/accounts/access") ||
      (context.method === "POST" && context.path === "/api/auth/social/complete") ||
      (context.method === "GET" && context.path === "/api/auth/me") ||
      (context.method === "GET" &&
        (context.path === "/api/auth/google/start" ||
          context.path === "/api/auth/apple/start" ||
          context.path === "/api/auth/google/callback" ||
          context.path === "/api/auth/apple/callback"))
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
      const role = this.parseRole(context.query.get("role"));
      const mode = this.parseMode(context.query.get("mode"));
      const provider = this.getProviderFromPath(context.path);
      const redirectUri = this.normalizeRedirectUri(context.query.get("redirectUri"), role);

      if (!this.socialAuth.isConfigured(provider)) {
        this.redirectWithError(
          response,
          {
            provider,
            role,
            mode,
            redirectUri
          },
          `${provider === "google" ? "Google" : "Apple"} sign-in is not configured yet. Missing ${this.socialAuth
            .getMissingConfiguration(provider)
            .join(", ")}.`
        );
        return;
      }

      const state = signScopedToken<OAuthStatePayload>(
        oauthStatePurpose,
        {
          provider,
          role,
          mode,
          redirectUri
        },
        oauthStateTtlSeconds
      );
      const authorizationUrl = this.socialAuth.buildAuthorizationUrl(provider, state);
      response.setHeader(
        "X-YardMatch-Google-Auth",
        JSON.stringify({
          provider,
          role,
          mode,
          redirectUrl: authorizationUrl,
          status: "oauth-redirect"
        } satisfies GoogleAuthStartResponse)
      );
      sendRedirect(response, authorizationUrl);
      return;
    }

    if (
      context.method === "GET" &&
      (context.path === "/api/auth/google/callback" || context.path === "/api/auth/apple/callback")
    ) {
      const provider = this.getProviderFromPath(context.path);
      const stateToken = context.query.get("state");
      const fallbackState: OAuthStatePayload = {
        provider,
        role: "customer",
        mode: "login",
        redirectUri: this.getDefaultRedirectUri("customer")
      };

      let state = fallbackState;
      if (stateToken) {
        try {
          state = verifyScopedToken<OAuthStatePayload>(stateToken, oauthStatePurpose);
        } catch (error) {
          this.redirectWithError(
            response,
            fallbackState,
            error instanceof Error ? error.message : "OAuth state was invalid or expired."
          );
          return;
        }
      }

      const providerError = context.query.get("error") ?? context.query.get("error_description");
      if (providerError) {
        this.redirectWithError(response, state, providerError);
        return;
      }

      const code = context.query.get("code");
      if (!code) {
        this.redirectWithError(response, state, "The authentication provider did not return an authorization code.");
        return;
      }

      try {
        const socialIdentity = await this.socialAuth.exchangeCode(provider, code);
        const resolved = await this.resolveSocialIdentity(state, socialIdentity);

        if ("pendingToken" in resolved) {
          this.redirectWithPendingSignup(response, state, resolved);
          return;
        }

        this.redirectWithSession(response, state.redirectUri, resolved);
      } catch (error) {
        this.redirectWithError(
          response,
          state,
          error instanceof Error ? error.message : "Unable to finish the social sign-in right now."
        );
      }
      return;
    }

    if (context.method === "POST" && context.path === "/api/auth/login") {
      const payload = context.body as LoginRequest;
      const identity = await this.platform.findAuthIdentityByEmail(payload.email.trim().toLowerCase());

      if (this.platform.isAuthIdentityTemporarilyLocked(identity)) {
        const lockExpiresAt = this.platform.getAuthIdentityLockExpiryIso(identity);
        throw new HttpError(
          423,
          lockExpiresAt
            ? `Account temporarily locked after repeated failed sign-ins until ${lockExpiresAt}.`
            : "Account temporarily locked after repeated failed sign-ins."
        );
      }

      if (!identity?.passwordHash || !verifyPassword(payload.password, identity.passwordHash)) {
        if (identity?.role === "ops") {
          await this.platform.recordFailedOpsAuthentication(identity, "invalid-password");
        }
        throw new HttpError(401, "Invalid email or password");
      }
      if (identity.accessDisabledAt) {
        if (identity.role === "ops") {
          await this.platform.recordFailedOpsAuthentication(identity, "disabled-account");
        }
        throw new HttpError(403, "Account access has been disabled");
      }

      const user = await this.platform.getUserByIdentity(identity);
      if (!user) {
        throw new HttpError(404, "User profile not found");
      }

      sendJson(response, 200, await this.createAuthenticatedEnvelope(identity, user, "password"));
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
      if (identity.accessDisabledAt) {
        throw new HttpError(403, "Account access has been disabled");
      }

      sendJson(response, 200, await this.createAuthenticatedEnvelope(identity, user, "password-reset"));
      return;
    }

    if (context.path === "/api/ops/accounts") {
      const actor = await requireOpsAdminAccess(context, this.platform);
      if (context.method === "GET") {
        sendJson(response, 200, await this.platform.listOpsAccounts());
        return;
      }
      sendJson(response, 201, await this.platform.createOpsAccount(actor, context.body as CreateOpsAccountRequest));
      return;
    }

    if (context.method === "POST" && context.path === "/api/ops/accounts/update") {
      const actor = await requireOpsAdminAccess(context, this.platform);
      sendJson(response, 200, await this.platform.updateOpsAccount(actor, context.body as UpdateOpsAccountRequest));
      return;
    }

    if (context.method === "POST" && context.path === "/api/ops/accounts/rotate-sessions") {
      const actor = await requireOpsAdminAccess(context, this.platform);
      sendJson(
        response,
        200,
        await this.platform.rotateOpsAccountSessions(actor, context.body as RotateOpsAccountSessionsRequest)
      );
      return;
    }

    if (context.method === "POST" && context.path === "/api/ops/accounts/password-reset/request") {
      const actor = await requireOpsAdminAccess(context, this.platform);
      sendJson(
        response,
        200,
        await this.platform.requestOpsAccountPasswordReset(actor, context.body as RequestOpsAccountPasswordResetRequest)
      );
      return;
    }

    if (context.method === "POST" && context.path === "/api/ops/accounts/access") {
      const actor = await requireOpsAdminAccess(context, this.platform);
      sendJson(
        response,
        200,
        await this.platform.updateOpsAccountAccess(actor, context.body as UpdateOpsAccountAccessRequest)
      );
      return;
    }

    if (context.method === "POST" && context.path === "/api/auth/social/complete") {
      const payload = context.body as CompleteSocialSignupRequest;
      let pending: PendingSocialSignupPayload;
      try {
        pending = verifyScopedToken<PendingSocialSignupPayload>(payload.pendingToken, socialSignupPurpose);
      } catch (error) {
        throw new HttpError(401, error instanceof Error ? error.message : "The social signup session has expired.");
      }

      if (pending.role !== payload.role) {
        throw new HttpError(409, "Finish signup from the same YardMatch role you started with.");
      }

      if (!payload.fullName.trim()) {
        throw new HttpError(400, "Full name is required.");
      }
      if (!payload.phone.trim()) {
        throw new HttpError(400, "Phone number is required.");
      }
      if (
        !payload.address?.line1?.trim() ||
        !payload.address?.city?.trim() ||
        !payload.address?.state?.trim() ||
        !payload.address?.postalCode?.trim()
      ) {
        throw new HttpError(400, "A full service address is required.");
      }

      const linkedIdentity = await this.platform.findAuthIdentityByProvider(pending.provider, pending.subject);
      if (linkedIdentity) {
        throw new HttpError(409, "This social account is already connected to a YardMatch profile.");
      }

      const existingIdentity = await this.platform.findAuthIdentityByEmail(pending.email);
      if (existingIdentity && existingIdentity.role !== pending.role) {
        throw new HttpError(409, "That email already belongs to a different YardMatch role.");
      }

      if (existingIdentity?.userId) {
        const updatedIdentity = await this.platform.updateAuthIdentity(existingIdentity.userId, {
          ...(pending.provider === "google"
            ? { googleSubject: pending.subject }
            : { appleSubject: pending.subject })
        });
        if (!updatedIdentity) {
          throw new HttpError(404, "Unable to link the social account.");
        }
        const user = await this.platform.getUserByIdentity(updatedIdentity);
        if (!user) {
          throw new HttpError(404, "User profile not found");
        }
        sendJson(response, 200, await this.createAuthenticatedEnvelope(updatedIdentity, user, pending.provider));
        return;
      }

      const user = await this.platform.registerUser({
        fullName: payload.fullName.trim(),
        email: pending.email,
        phone: payload.phone.trim(),
        role: pending.role,
        address: payload.address,
        companyName: payload.companyName,
        bio: payload.bio,
        yearsExperience: payload.yearsExperience,
        serviceRadiusMiles: payload.serviceRadiusMiles,
        categories: payload.categories,
        propertyNotes: payload.propertyNotes,
        lawnSizeSqFt: payload.lawnSizeSqFt,
        propertyLabel: payload.propertyLabel,
        availableWeekdays: payload.availableWeekdays,
        willingToTravelMiles: payload.willingToTravelMiles,
        preferredSchedule: payload.preferredSchedule,
        hasOwnEquipment: payload.hasOwnEquipment,
        winterWorkEnabled: payload.winterWorkEnabled
      });
      const updatedIdentity = await this.platform.updateAuthIdentity(user.id, {
        ...(pending.provider === "google" ? { googleSubject: pending.subject } : { appleSubject: pending.subject })
      });
      if (!updatedIdentity) {
        throw new HttpError(500, "Unable to finish the social signup.");
      }

      sendJson(response, 201, await this.createAuthenticatedEnvelope(updatedIdentity, user, pending.provider));
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
        user,
        sensitiveActionPolicy: this.platform.buildSensitiveActionPolicy(identity, session.issuedAt)
      };
      sendJson(response, 200, result);
      return;
    }

    const payload = context.body as RegisterUserRequest;
    if (payload.role === "ops") {
      throw new HttpError(403, "Ops accounts cannot be created through the public signup flow.");
    }
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

      sendJson(
        response,
        201,
        await this.createAuthenticatedEnvelope(
          {
            userId: user.id,
            email: user.email,
            role: user.role,
            sessionVersion: 1
          },
          user,
          "password"
        )
      );
  }

  private parseRole(value: string | null): GoogleAuthStartResponse["role"] {
    return value === "provider" || value === "crew-member" || value === "customer" ? value : "customer";
  }

  private parseMode(value: string | null): GoogleAuthStartResponse["mode"] {
    return value === "signup" || value === "login" ? value : "signup";
  }

  private getProviderFromPath(path: string): SocialAuthProvider {
    return path.includes("/apple/") ? "apple" : "google";
  }

  private getDefaultRedirectUri(role: GoogleAuthStartResponse["role"]): string {
    const webCompletionUrl = new URL("/auth/complete", this.platform.getAppBaseUrl());
    webCompletionUrl.searchParams.set("role", role);
    return webCompletionUrl.toString();
  }

  private normalizeRedirectUri(
    redirectUri: string | null,
    role: GoogleAuthStartResponse["role"]
  ): string {
    if (!redirectUri) {
      return this.getDefaultRedirectUri(role);
    }

    const trimmed = redirectUri.trim();
    if (
      trimmed.startsWith(`${this.platform.getAppBaseUrl()}/`) ||
      trimmed.startsWith("yardmatch-customer://") ||
      trimmed.startsWith("yardmatch-provider://") ||
      trimmed.startsWith("yardmatch-crew://")
    ) {
      return trimmed;
    }

    return this.getDefaultRedirectUri(role);
  }

  private async resolveSocialIdentity(
    state: OAuthStatePayload,
    socialIdentity: SocialIdentity
  ): Promise<AuthenticatedUserEnvelope | PendingSocialSignupPayload & { pendingToken: string; expiresAtIso: string }> {
    const linkedIdentity = await this.platform.findAuthIdentityByProvider(socialIdentity.provider, socialIdentity.subject);
    if (linkedIdentity) {
      if (linkedIdentity.role !== state.role) {
        throw new HttpError(409, `This ${socialIdentity.provider} account is already linked to a different YardMatch role.`);
      }

      const user = await this.platform.getUserByIdentity(linkedIdentity);
      if (!user) {
        throw new HttpError(404, "User profile not found");
      }

      return this.createAuthenticatedEnvelope(linkedIdentity, user, socialIdentity.provider);
    }

    const existingIdentity = await this.platform.findAuthIdentityByEmail(socialIdentity.email);
    if (existingIdentity) {
      if (existingIdentity.role !== state.role) {
        throw new HttpError(409, "That email already belongs to a different YardMatch role.");
      }

      const updatedIdentity = await this.platform.updateAuthIdentity(existingIdentity.userId, {
        ...(socialIdentity.provider === "google"
          ? { googleSubject: socialIdentity.subject }
          : { appleSubject: socialIdentity.subject })
      });
      if (!updatedIdentity) {
        throw new HttpError(404, "Unable to connect that social account.");
      }
      const user = await this.platform.getUserByIdentity(updatedIdentity);
      if (!user) {
        throw new HttpError(404, "User profile not found");
      }
      return this.createAuthenticatedEnvelope(updatedIdentity, user, socialIdentity.provider);
    }

    if (state.mode === "login") {
      throw new HttpError(404, "No YardMatch account exists yet for this email. Continue with sign up instead.");
    }

    const pendingPayload: PendingSocialSignupPayload = {
      provider: socialIdentity.provider,
      subject: socialIdentity.subject,
      email: socialIdentity.email,
      fullName: socialIdentity.fullName,
      role: state.role,
      mode: state.mode
    };

    return {
      ...pendingPayload,
      pendingToken: signScopedToken<PendingSocialSignupPayload>(
        socialSignupPurpose,
        pendingPayload,
        socialSignupTtlSeconds
      ),
      expiresAtIso: getSessionExpiryIso(socialSignupTtlSeconds)
    };
  }

  private async createAuthenticatedEnvelope(
    identity: NonNullable<Awaited<ReturnType<MarketplacePlatformService["findAuthIdentityByUserId"]>>>,
    user: NonNullable<Awaited<ReturnType<MarketplacePlatformService["getUserByIdentity"]>>>,
    method: OpsAuthenticationMethod
  ): Promise<AuthenticatedUserEnvelope> {
    const refreshedIdentity =
      identity.role === "ops"
        ? (await this.platform.recordSuccessfulAuthentication(identity.userId, method)) ?? identity
        : identity;
    return {
      session: {
        token: signSessionToken({
          userId: refreshedIdentity.userId,
          email: refreshedIdentity.email,
          role: refreshedIdentity.role,
          sessionVersion: refreshedIdentity.sessionVersion
        }),
        expiresInSeconds: TOKEN_TTL_SECONDS,
        expiresAtIso: getSessionExpiryIso(TOKEN_TTL_SECONDS)
      },
      user
    };
  }

  private buildRedirectUrl(redirectUri: string, params: Record<string, string>): string {
    const target = new URL(redirectUri);
    for (const [key, value] of Object.entries(params)) {
      target.searchParams.set(key, value);
    }
    return target.toString();
  }

  private redirectWithError(
    response: Parameters<typeof sendJson>[0],
    state: OAuthStatePayload,
    message: string
  ): void {
    sendRedirect(
      response,
      this.buildRedirectUrl(state.redirectUri, {
        authStatus: "error",
        provider: state.provider,
        role: state.role,
        mode: state.mode,
        message
      })
    );
  }

  private redirectWithSession(
    response: Parameters<typeof sendJson>[0],
    redirectUri: string,
    envelope: AuthenticatedUserEnvelope
  ): void {
    sendRedirect(
      response,
      this.buildRedirectUrl(redirectUri, {
        authStatus: "success",
        token: envelope.session.token,
        expiresAtIso: envelope.session.expiresAtIso,
        role: envelope.user.role,
        email: envelope.user.email,
        userId: envelope.user.id,
        fullName: envelope.user.fullName
      })
    );
  }

  private redirectWithPendingSignup(
    response: Parameters<typeof sendJson>[0],
    state: OAuthStatePayload,
    pending: PendingSocialSignupPayload & { pendingToken: string; expiresAtIso: string }
  ): void {
    sendRedirect(
      response,
      this.buildRedirectUrl(state.redirectUri, {
        authStatus: "pending-signup",
        provider: pending.provider,
        role: pending.role,
        mode: pending.mode,
        pendingToken: pending.pendingToken,
        expiresAtIso: pending.expiresAtIso,
        email: pending.email,
        fullName: pending.fullName
      })
    );
  }
}
