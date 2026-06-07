import { createHash, createHmac, randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto";
import type { RequestContext } from "./http";

const DEV_JWT_SECRET = "yardmatch-dev-secret";
export const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;
export const PASSWORD_RESET_TTL_MINUTES = 20;

export interface SessionActor {
  userId: string;
  email: string;
  role: "customer" | "provider" | "crew-member";
  sessionVersion: number;
}

interface JwtPayload extends SessionActor {
  iat: number;
  exp: number;
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

function getJwtSecret(): string {
  return process.env.JWT_SECRET?.trim() || DEV_JWT_SECRET;
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derivedKey}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, originalKey] = storedHash.split(":");
  if (!salt || !originalKey) {
    return false;
  }

  const candidateKey = scryptSync(password, salt, 64).toString("hex");
  return timingSafeEqual(Buffer.from(originalKey, "hex"), Buffer.from(candidateKey, "hex"));
}

export function validatePasswordStrength(password: string): void {
  const trimmed = password.trim();
  if (trimmed.length < 8) {
    throw new Error("Password must be at least 8 characters long");
  }

  if (!/[A-Z]/.test(trimmed) || !/[a-z]/.test(trimmed) || !/[0-9]/.test(trimmed)) {
    throw new Error("Password must include uppercase, lowercase, and numeric characters");
  }
}

export function getSessionExpiryIso(expiresInSeconds: number): string {
  return new Date(Date.now() + expiresInSeconds * 1000).toISOString();
}

export function generatePasswordResetCode(): string {
  return String(randomInt(100000, 1000000));
}

export function hashPasswordResetCode(email: string, resetCode: string): string {
  return createHash("sha256")
    .update(`${email.trim().toLowerCase()}:${resetCode}:${getJwtSecret()}`)
    .digest("hex");
}

export function signSessionToken(actor: SessionActor): string {
  const header = {
    alg: "HS256",
    typ: "JWT"
  };
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload: JwtPayload = {
    ...actor,
    iat: issuedAt,
    exp: issuedAt + TOKEN_TTL_SECONDS
  };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;
  const signature = createHmac("sha256", getJwtSecret()).update(unsignedToken).digest("base64url");
  return `${unsignedToken}.${signature}`;
}

export function verifySessionToken(token: string): SessionActor {
  const [encodedHeader, encodedPayload, providedSignature] = token.split(".");
  if (!encodedHeader || !encodedPayload || !providedSignature) {
    throw new Error("Malformed bearer token");
  }

  const unsignedToken = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = createHmac("sha256", getJwtSecret()).update(unsignedToken).digest("base64url");
  if (!timingSafeEqual(Buffer.from(providedSignature), Buffer.from(expectedSignature))) {
    throw new Error("Invalid bearer token");
  }

  const parsedPayload = JSON.parse(base64UrlDecode(encodedPayload)) as JwtPayload;
  const now = Math.floor(Date.now() / 1000);
  if (parsedPayload.exp <= now) {
    throw new Error("Expired bearer token");
  }

  return {
    userId: parsedPayload.userId,
    email: parsedPayload.email,
    role: parsedPayload.role,
    sessionVersion: parsedPayload.sessionVersion ?? 1
  };
}

export function getBearerToken(context: RequestContext): string | undefined {
  const header = context.headers.authorization ?? context.headers.Authorization;
  if (!header) {
    return undefined;
  }

  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return undefined;
  }

  return token;
}
