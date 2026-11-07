import type { Address, SearchProvidersRequest, ServiceCategory } from "@yardmatch/contracts";
import type { SessionActor } from "../auth";
import { withAbortableTimeout } from "../integrations/outboundRequestTimeout";
import type { AuthIdentityRecord } from "../repositories/MarketplaceRepository";

export type CriticalPathName = "database" | "matching" | "signIn";
export type CriticalPathCheckStatus = "pass" | "fail" | "not-configured";

export interface CriticalPathCheckResult {
  status: CriticalPathCheckStatus;
  durationMs: number;
}

export interface CriticalPathReport {
  /** "ok" only when every check passes; monitors should alert on anything else (HTTP 503). */
  status: "ok" | "failing" | "incomplete";
  checkedAt: string;
  checks: Record<CriticalPathName, CriticalPathCheckResult>;
}

export interface CriticalPathConfig {
  matching?: {
    address: Address;
    category: ServiceCategory;
    minimumMatches: number;
  };
  signIn?: {
    email: string;
    password: string;
  };
}

export interface CriticalPathDependencies {
  checkDatabase(): Promise<void>;
  searchProviders(payload: SearchProvidersRequest): Promise<{ totalMatches: number }>;
  findAuthIdentityByEmail(email: string): Promise<AuthIdentityRecord | undefined>;
  getUserByIdentity(identity: AuthIdentityRecord): Promise<unknown>;
  isAuthIdentityTemporarilyLocked(identity: AuthIdentityRecord | undefined): boolean;
  verifyPassword(password: string, storedHash: string): Promise<boolean>;
  signSessionToken(actor: SessionActor): string;
  verifySessionToken(token: string): SessionActor;
  /** Private detail goes to logs and Sentry; the public report only says pass or fail. */
  reportFailure(check: CriticalPathName, error: unknown): void;
}

export class CriticalPathCheckError extends Error {
  public constructor(check: CriticalPathName, reason: string) {
    super(`${check} critical-path check failed: ${reason}`);
    this.name = "CriticalPathCheckError";
  }
}

const DEFAULT_CACHE_MS = 30_000;
const DEFAULT_CHECK_TIMEOUT_MS = 8_000;

export function readCriticalPathConfig(env: Record<string, string | undefined> = process.env): CriticalPathConfig {
  const config: CriticalPathConfig = {};
  const rawAddress = env.CRITICAL_PATH_MATCHING_ADDRESS?.trim();
  if (rawAddress) {
    try {
      const address = JSON.parse(rawAddress) as Address;
      const point = address?.point;
      if (address?.line1 && address.city && address.state && address.postalCode &&
          Number.isFinite(point?.latitude) && Number.isFinite(point?.longitude)) {
        const minimumMatches = Number(env.CRITICAL_PATH_MATCHING_MIN_RESULTS ?? 1);
        config.matching = {
          address: { ...address, country: address.country || "US" },
          category: (env.CRITICAL_PATH_MATCHING_CATEGORY?.trim() || "lawn-mowing") as ServiceCategory,
          minimumMatches: Number.isSafeInteger(minimumMatches) && minimumMatches >= 0 ? minimumMatches : 1
        };
      }
    } catch {
      // An unparseable canary address is reported as not configured rather than crashing startup.
    }
  }
  const email = env.CRITICAL_PATH_SIGN_IN_EMAIL?.trim().toLowerCase();
  const password = env.CRITICAL_PATH_SIGN_IN_PASSWORD;
  if (email && password) {
    config.signIn = { email, password };
  }
  return config;
}

/**
 * Exercises the paths customers and providers notice first — database, provider matching, and
 * password sign-in — without side effects: no sessions, devices, failed-attempt counters,
 * bookings, or reportable analytics are written. Results are cached so a public probe cannot be
 * used to load the API.
 */
export class CriticalPathMonitor {
  private cached?: { report: CriticalPathReport; expiresAtMs: number };
  private inFlight?: Promise<CriticalPathReport>;

  public constructor(
    private readonly dependencies: CriticalPathDependencies,
    private readonly config: CriticalPathConfig = readCriticalPathConfig(),
    private readonly options: { cacheMs?: number; checkTimeoutMs?: number; now?: () => number } = {}
  ) {}

  public async getReport(): Promise<CriticalPathReport> {
    const now = this.now();
    if (this.cached && this.cached.expiresAtMs > now) {
      return this.cached.report;
    }
    this.inFlight ??= this.runChecks().finally(() => { this.inFlight = undefined; });
    const report = await this.inFlight;
    this.cached = { report, expiresAtMs: this.now() + (this.options.cacheMs ?? DEFAULT_CACHE_MS) };
    return report;
  }

  private async runChecks(): Promise<CriticalPathReport> {
    const [database, matching, signIn] = await Promise.all([
      this.runCheck("database", () => this.dependencies.checkDatabase()),
      this.config.matching ? this.runCheck("matching", () => this.checkMatching()) : notConfigured(),
      this.config.signIn ? this.runCheck("signIn", () => this.checkSignIn()) : notConfigured()
    ]);
    const checks = { database, matching, signIn };
    const results = Object.values(checks);
    return {
      status: results.some((result) => result.status === "fail")
        ? "failing"
        : results.some((result) => result.status === "not-configured")
          ? "incomplete"
          : "ok",
      checkedAt: new Date(this.now()).toISOString(),
      checks
    };
  }

  private async runCheck(name: CriticalPathName, work: () => Promise<void>): Promise<CriticalPathCheckResult> {
    const startedAt = this.now();
    try {
      await withAbortableTimeout(async () => work(), {
        timeoutMs: this.options.checkTimeoutMs ?? DEFAULT_CHECK_TIMEOUT_MS,
        timeoutMessage: `${name} critical-path check timed out`
      });
      return { status: "pass", durationMs: this.now() - startedAt };
    } catch (error) {
      this.dependencies.reportFailure(name, error);
      return { status: "fail", durationMs: this.now() - startedAt };
    }
  }

  private async checkMatching(): Promise<void> {
    const matching = this.config.matching!;
    const tomorrow = new Date(this.now() + 86_400_000).toISOString().slice(0, 10);
    const result = await this.dependencies.searchProviders({
      address: matching.address,
      categories: [matching.category],
      dateIso: tomorrow,
      requestSource: "critical-path-monitor"
    });
    if (result.totalMatches < matching.minimumMatches) {
      throw new CriticalPathCheckError(
        "matching",
        `expected at least ${matching.minimumMatches} provider match(es), found ${result.totalMatches}`
      );
    }
  }

  private async checkSignIn(): Promise<void> {
    const { email, password } = this.config.signIn!;
    const identity = await this.dependencies.findAuthIdentityByEmail(email);
    if (!identity?.passwordHash) {
      throw new CriticalPathCheckError("signIn", "monitor account was not found or has no password");
    }
    if (this.dependencies.isAuthIdentityTemporarilyLocked(identity)) {
      throw new CriticalPathCheckError("signIn", "monitor account is locked");
    }
    if (identity.accessDisabledAt) {
      throw new CriticalPathCheckError("signIn", "monitor account access is disabled");
    }
    // Deliberately does not record a failed attempt, so a rotated password cannot lock the account.
    if (!(await this.dependencies.verifyPassword(password, identity.passwordHash))) {
      throw new CriticalPathCheckError("signIn", "monitor account password did not verify");
    }
    if (!(await this.dependencies.getUserByIdentity(identity))) {
      throw new CriticalPathCheckError("signIn", "monitor account profile is missing");
    }
    const token = this.dependencies.signSessionToken({
      userId: identity.userId,
      email: identity.email,
      role: identity.role,
      sessionVersion: identity.sessionVersion
    });
    const verified = this.dependencies.verifySessionToken(token);
    if (verified.userId !== identity.userId) {
      throw new CriticalPathCheckError("signIn", "session token did not round-trip");
    }
  }

  private now(): number {
    return this.options.now?.() ?? Date.now();
  }
}

async function notConfigured(): Promise<CriticalPathCheckResult> {
  return { status: "not-configured", durationMs: 0 };
}
