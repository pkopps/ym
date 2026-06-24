import { getBearerToken, verifySessionToken } from "./auth";
import { HttpError, RequestContext } from "./http";
import { AuthIdentityRecord } from "./repositories/MarketplaceRepository";
import { MarketplacePlatformService } from "./services/MarketplacePlatformService";

type SessionRole = AuthIdentityRecord["role"];

async function requireAuthenticatedSession(
  context: RequestContext,
  platform: MarketplacePlatformService
) {
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
  const identity = await platform.findAuthIdentityByUserId(session.userId);
  if (!identity) {
    throw new HttpError(401, "Unknown session");
  }
  if (identity.sessionVersion !== session.sessionVersion) {
    throw new HttpError(401, "Session has been replaced");
  }

  return {
    identity,
    session
  };
}

export async function requireAuthenticatedIdentity(
  context: RequestContext,
  platform: MarketplacePlatformService
) {
  return (await requireAuthenticatedSession(context, platform)).identity;
}

export async function getOptionalAuthenticatedIdentity(
  context: RequestContext,
  platform: MarketplacePlatformService
) {
  const token = getBearerToken(context);
  if (!token) {
    return undefined;
  }

  try {
    const session = verifySessionToken(token);
    const identity = await platform.findAuthIdentityByUserId(session.userId);
    if (!identity || identity.sessionVersion !== session.sessionVersion) {
      return undefined;
    }
    return identity;
  } catch {
    return undefined;
  }
}

export async function requireRole(
  context: RequestContext,
  platform: MarketplacePlatformService,
  role: SessionRole | SessionRole[]
): Promise<AuthIdentityRecord>;
export async function requireRole<const TRole extends SessionRole>(
  context: RequestContext,
  platform: MarketplacePlatformService,
  role: TRole | readonly TRole[]
): Promise<AuthIdentityRecord & { role: TRole }>;
export async function requireRole(
  context: RequestContext,
  platform: MarketplacePlatformService,
  role: SessionRole | readonly SessionRole[]
) {
  const { identity } = await requireAuthenticatedSession(context, platform);
  const allowedRoles = Array.isArray(role) ? role : [role];
  if (!allowedRoles.includes(identity.role)) {
    throw new HttpError(403, `This route requires a ${allowedRoles.join(" or ")} account`);
  }

  return identity as AuthIdentityRecord & { role: (typeof allowedRoles)[number] };
}

export async function requireOpsAccess(
  context: RequestContext,
  platform: MarketplacePlatformService
) {
  return requireRole(context, platform, "ops");
}

export async function requireFreshRole(
  context: RequestContext,
  platform: MarketplacePlatformService,
  role: SessionRole | SessionRole[],
  maxAgeSeconds: number,
  errorMessage: string
): Promise<AuthIdentityRecord>;
export async function requireFreshRole<const TRole extends SessionRole>(
  context: RequestContext,
  platform: MarketplacePlatformService,
  role: TRole | readonly TRole[],
  maxAgeSeconds: number,
  errorMessage: string
): Promise<AuthIdentityRecord & { role: TRole }>;
export async function requireFreshRole(
  context: RequestContext,
  platform: MarketplacePlatformService,
  role: SessionRole | readonly SessionRole[],
  maxAgeSeconds: number,
  errorMessage: string
) {
  const { identity, session } = await requireAuthenticatedSession(context, platform);
  const allowedRoles = Array.isArray(role) ? role : [role];
  if (!allowedRoles.includes(identity.role)) {
    throw new HttpError(403, `This route requires a ${allowedRoles.join(" or ")} account`);
  }
  const ageSeconds = Math.max(0, Math.floor(Date.now() / 1000) - (session.issuedAt ?? 0));
  if (ageSeconds > maxAgeSeconds) {
    throw new HttpError(401, errorMessage);
  }

  return identity as AuthIdentityRecord & { role: (typeof allowedRoles)[number] };
}
