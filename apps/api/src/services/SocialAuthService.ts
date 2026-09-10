import { createPrivateKey, createSign } from "node:crypto";
import { HttpError } from "../http";
import {
  DEFAULT_EXTERNAL_REQUEST_TIMEOUT_MS,
  withAbortableTimeout
} from "../integrations/outboundRequestTimeout";

export type SocialAuthProvider = "google" | "apple";

export interface SocialIdentity {
  provider: SocialAuthProvider;
  subject: string;
  email: string;
  emailVerified: boolean;
  fullName: string;
}

function base64UrlEncode(value: string | Buffer): string {
  return Buffer.from(value)
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(value: string): string {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Buffer.from(padded, "base64").toString("utf8");
}

function deriveDisplayNameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "yardmatch";
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

export class SocialAuthService {
  public constructor(
    private readonly apiBaseUrl: string,
    private readonly externalRequestTimeoutMs = DEFAULT_EXTERNAL_REQUEST_TIMEOUT_MS
  ) {}

  public isConfigured(provider: SocialAuthProvider): boolean {
    return this.getMissingConfiguration(provider).length === 0;
  }

  public getMissingConfiguration(provider: SocialAuthProvider): string[] {
    if (provider === "google") {
      const missing: string[] = [];
      if (!process.env.GOOGLE_OAUTH_CLIENT_ID?.trim()) {
        missing.push("GOOGLE_OAUTH_CLIENT_ID");
      }
      if (!process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim()) {
        missing.push("GOOGLE_OAUTH_CLIENT_SECRET");
      }
      return missing;
    }

    const missing: string[] = [];
    if (!process.env.APPLE_CLIENT_ID?.trim()) {
      missing.push("APPLE_CLIENT_ID");
    }
    if (!process.env.APPLE_TEAM_ID?.trim()) {
      missing.push("APPLE_TEAM_ID");
    }
    if (!process.env.APPLE_KEY_ID?.trim()) {
      missing.push("APPLE_KEY_ID");
    }
    if (!process.env.APPLE_PRIVATE_KEY?.trim()) {
      missing.push("APPLE_PRIVATE_KEY");
    }
    return missing;
  }

  public buildAuthorizationUrl(provider: SocialAuthProvider, state: string): string {
    if (!this.isConfigured(provider)) {
      throw new HttpError(
        503,
        `${provider === "google" ? "Google" : "Apple"} auth is not configured yet. Missing ${this.getMissingConfiguration(
          provider
        ).join(", ")}`
      );
    }

    if (provider === "google") {
      const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      url.searchParams.set("client_id", process.env.GOOGLE_OAUTH_CLIENT_ID!.trim());
      url.searchParams.set("redirect_uri", this.getCallbackUrl("google"));
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", "openid email profile");
      url.searchParams.set("state", state);
      url.searchParams.set("prompt", "select_account");
      return url.toString();
    }

    const url = new URL("https://appleid.apple.com/auth/authorize");
    url.searchParams.set("client_id", process.env.APPLE_CLIENT_ID!.trim());
    url.searchParams.set("redirect_uri", this.getCallbackUrl("apple"));
    url.searchParams.set("response_type", "code");
    url.searchParams.set("response_mode", "form_post");
    url.searchParams.set("scope", "name email");
    url.searchParams.set("state", state);
    return url.toString();
  }

  public async exchangeCode(provider: SocialAuthProvider, code: string): Promise<SocialIdentity> {
    if (provider === "google") {
      return this.exchangeGoogleCode(code);
    }

    return this.exchangeAppleCode(code);
  }

  private getCallbackUrl(provider: SocialAuthProvider): string {
    return `${this.apiBaseUrl}/api/auth/${provider}/callback`;
  }

  private async exchangeGoogleCode(code: string): Promise<SocialIdentity> {
    const tokenPayload = await withAbortableTimeout(async (signal) => {
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!.trim(),
          client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!.trim(),
          code,
          grant_type: "authorization_code",
          redirect_uri: this.getCallbackUrl("google")
        }),
        signal
      });

      if (!tokenResponse.ok) {
        throw new HttpError(502, "Google token exchange failed");
      }

      return (await tokenResponse.json()) as {
        access_token?: string;
      };
    }, {
      timeoutMs: this.externalRequestTimeoutMs,
      timeoutMessage: "Google sign-in took too long. Please try again."
    });
    if (!tokenPayload.access_token) {
      throw new HttpError(502, "Google token exchange did not return an access token");
    }

    const userInfo = await withAbortableTimeout(async (signal) => {
      const userInfoResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
        headers: {
          Authorization: `Bearer ${tokenPayload.access_token}`
        },
        signal
      });

      if (!userInfoResponse.ok) {
        throw new HttpError(502, "Google user info lookup failed");
      }

      return (await userInfoResponse.json()) as {
        sub?: string;
        email?: string;
        email_verified?: boolean;
        name?: string;
      };
    }, {
      timeoutMs: this.externalRequestTimeoutMs,
      timeoutMessage: "Google sign-in took too long. Please try again."
    });

    if (!userInfo.sub || !userInfo.email) {
      throw new HttpError(502, "Google user info is missing required identity fields");
    }

    return {
      provider: "google",
      subject: userInfo.sub,
      email: userInfo.email.trim().toLowerCase(),
      emailVerified: Boolean(userInfo.email_verified),
      fullName: userInfo.name?.trim() || deriveDisplayNameFromEmail(userInfo.email)
    };
  }

  private async exchangeAppleCode(code: string): Promise<SocialIdentity> {
    const tokenPayload = await withAbortableTimeout(async (signal) => {
      const tokenResponse = await fetch("https://appleid.apple.com/auth/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          client_id: process.env.APPLE_CLIENT_ID!.trim(),
          client_secret: this.buildAppleClientSecret(),
          code,
          grant_type: "authorization_code",
          redirect_uri: this.getCallbackUrl("apple")
        }),
        signal
      });

      if (!tokenResponse.ok) {
        throw new HttpError(502, "Apple token exchange failed");
      }

      return (await tokenResponse.json()) as {
        id_token?: string;
      };
    }, {
      timeoutMs: this.externalRequestTimeoutMs,
      timeoutMessage: "Apple sign-in took too long. Please try again."
    });

    if (!tokenPayload.id_token) {
      throw new HttpError(502, "Apple token exchange did not return an identity token");
    }

    const identityPayload = this.parseAppleIdentityToken(tokenPayload.id_token);
    if (!identityPayload.sub || !identityPayload.email) {
      throw new HttpError(502, "Apple user info is missing required identity fields");
    }

    return {
      provider: "apple",
      subject: identityPayload.sub,
      email: identityPayload.email.trim().toLowerCase(),
      emailVerified: identityPayload.email_verified === true,
      fullName: deriveDisplayNameFromEmail(identityPayload.email)
    };
  }

  private buildAppleClientSecret(): string {
    const teamId = process.env.APPLE_TEAM_ID!.trim();
    const clientId = process.env.APPLE_CLIENT_ID!.trim();
    const keyId = process.env.APPLE_KEY_ID!.trim();
    const privateKey = process.env.APPLE_PRIVATE_KEY!.replaceAll("\\n", "\n");
    const issuedAt = Math.floor(Date.now() / 1000);
    const expiresAt = issuedAt + 60 * 60;
    const header = {
      alg: "ES256",
      kid: keyId,
      typ: "JWT"
    };
    const payload = {
      iss: teamId,
      iat: issuedAt,
      exp: expiresAt,
      aud: "https://appleid.apple.com",
      sub: clientId
    };
    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));
    const unsignedToken = `${encodedHeader}.${encodedPayload}`;
    const signature = createSign("SHA256")
      .update(unsignedToken)
      .end()
      .sign({
        key: createPrivateKey(privateKey),
        dsaEncoding: "ieee-p1363"
      });
    return `${unsignedToken}.${base64UrlEncode(signature)}`;
  }

  private parseAppleIdentityToken(token: string): {
    sub?: string;
    email?: string;
    email_verified?: boolean;
    aud?: string;
    iss?: string;
  } {
    const [, encodedPayload] = token.split(".");
    if (!encodedPayload) {
      throw new HttpError(502, "Apple identity token was malformed");
    }

    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as {
      sub?: string;
      email?: string;
      email_verified?: boolean | string;
      aud?: string;
      iss?: string;
    };

    if (payload.aud !== process.env.APPLE_CLIENT_ID?.trim() || payload.iss !== "https://appleid.apple.com") {
      throw new HttpError(502, "Apple identity token was issued for a different audience");
    }

    return {
      sub: payload.sub,
      email: payload.email,
      email_verified:
        typeof payload.email_verified === "string"
          ? payload.email_verified === "true"
          : payload.email_verified,
      aud: payload.aud,
      iss: payload.iss
    };
  }
}
