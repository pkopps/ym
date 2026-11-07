import { getOptionalAuthenticatedIdentity } from "./controller-auth";
import { analyticsRequestContext, parseAnalyticsContext } from "./observability/analyticsContext";
import { PrivacyController } from "./controllers/PrivacyController";
import { ReadinessController } from "./controllers/ReadinessController";
import { enforceMobileRelease } from "./observability/mobileReleasePolicy";
import { createServer } from "node:http";
import { PrismaClient } from "@prisma/client";
import { ProductAnalytics } from "./observability/ProductAnalytics";
import { AuthController } from "./controllers/AuthController";
import { DocsController } from "./controllers/DocsController";
import { MarketplaceController } from "./controllers/MarketplaceController";
import { HealthController } from "./controllers/HealthController";
import { CriticalPathController } from "./controllers/CriticalPathController";
import { CriticalPathMonitor } from "./observability/CriticalPathMonitor";
import { signSessionToken, verifyPassword, verifySessionToken } from "./auth";
import { MediaController } from "./controllers/MediaController";
import { ObservabilityController } from "./controllers/ObservabilityController";
import { SupportController } from "./controllers/SupportController";
import { ApiController, HttpError, applyCorsHeaders, parseRequest, resolveRequestId, sendErrorJson } from "./http";
import { localizeApiErrorMessage } from "./i18n";
import { InMemoryMarketplaceRepository } from "./repositories/InMemoryMarketplaceRepository";
import { PrismaMarketplaceRepository } from "./repositories/PrismaMarketplaceRepository";
import { MarketplacePlatformService } from "./services/MarketplacePlatformService";
import { validateRuntimeConfiguration } from "./config/productionConfig";
import { enforceLaunchFeatureFlags } from "./config/featureGate";
import { ExternalRequestTimeoutError, withAbortableTimeout } from "./integrations/outboundRequestTimeout";
import { UNMATCHED_ROUTE_LABEL, createApiRuntimeObservabilityFromEnv } from "./observability/ApiRuntimeObservability";
import {
  captureApiBackgroundException,
  captureApiException,
  captureApiProcessException,
  flushApiErrorReporting,
  initializeApiErrorReporting
} from "./observability/sentry";

const runtimeConfiguration = validateRuntimeConfiguration();
await initializeApiErrorReporting();
const prismaClient = runtimeConfiguration.repositoryMode === "prisma-postgres"
  ? new PrismaClient()
  : undefined;
const repository = runtimeConfiguration.repositoryMode === "prisma-postgres"
  ? new PrismaMarketplaceRepository(prismaClient as PrismaClient)
  : new InMemoryMarketplaceRepository();
const port = Number(process.env.PORT ?? 4001);
const repositoryMode = runtimeConfiguration.repositoryMode;
const apiRuntimeObservability = createApiRuntimeObservabilityFromEnv();
function reportBackgroundFailure(job: string, error: unknown): void {
  apiRuntimeObservability.recordBackgroundFailure(job, error);
  captureApiBackgroundException(error, job);
}
const analytics = new ProductAnalytics(prismaClient);
await analytics.restore();
let analyticsWork: Promise<unknown> | undefined;
const analyticsMaintenance = setInterval(() => {
  analyticsWork ??= analytics.maintenance()
    .catch((error: unknown) => reportBackgroundFailure("analytics-maintenance", error))
    .finally(() => { analyticsWork = undefined; });
}, 1000);
analyticsMaintenance.unref();
const platform = new MarketplacePlatformService(repository, analytics);
// Durable claims allow each API replica to safely share this bounded worker.
// Queued deliveries stay in the database, so a failed sweep is retried on the next tick.
let notificationWork: Promise<unknown> | undefined;
const notificationMaintenance = setInterval(() => {
  notificationWork ??= platform.retryDueNotificationDeliveriesForOps()
    .catch((error: unknown) => reportBackgroundFailure("notification-delivery", error))
    .finally(() => { notificationWork = undefined; });
}, 1000);
notificationMaintenance.unref();
const READINESS_DATABASE_TIMEOUT_MS = 3_000;
let shuttingDown = false;
async function checkDatabase(): Promise<void> {
  if (prismaClient) {
    const client = prismaClient;
    // A hung database connection must fail the health check instead of hanging it.
    await withAbortableTimeout(async () => client.$queryRaw`SELECT 1`, {
      timeoutMs: READINESS_DATABASE_TIMEOUT_MS,
      timeoutMessage: "Database readiness check timed out"
    });
  }
}
const criticalPathMonitor = new CriticalPathMonitor({
  checkDatabase,
  // Marked internal so monitor searches never count toward product analytics funnels.
  searchProviders: (payload) => analyticsRequestContext.run({ role: "ops", internal: true },
    () => platform.searchProviders(payload, { trustedAddress: true })),
  findAuthIdentityByEmail: (email) => platform.findAuthIdentityByEmail(email),
  getUserByIdentity: (identity) => platform.getUserByIdentity(identity),
  isAuthIdentityTemporarilyLocked: (identity) => platform.isAuthIdentityTemporarilyLocked(identity),
  verifyPassword,
  signSessionToken,
  verifySessionToken,
  reportFailure: (check, error) => reportBackgroundFailure(`critical-path:${check}`, error)
});
const controllers: ApiController[] = [
  new HealthController(runtimeConfiguration, async () => {
    if (shuttingDown) {
      // A probe that lands on a still-open connection during drain must not report ready.
      throw new Error("API is shutting down");
    }
    await checkDatabase();
  }),
  new CriticalPathController(criticalPathMonitor),
  new DocsController(),
  new ReadinessController(platform, analytics, prismaClient),
  new PrivacyController(platform, prismaClient),
  new AuthController(platform),
  new MediaController(platform),
  new MarketplaceController(platform),
  new ObservabilityController(platform, apiRuntimeObservability, analytics),
  new SupportController(platform, analytics)
];

const server = createServer(async (request, response) => {
  let context: Awaited<ReturnType<typeof parseRequest>> | undefined;
  const requestId = resolveRequestId(request.headers);
  let routeMatched = false;
  const startedAt = performance.now();
  let errorType: string | undefined;
  let errorCategory: "client-request" | "authentication" | "dependency-timeout" | "server-error" | undefined;
  let errorFrames: string[] | undefined;

  try {
    response.setHeader("X-Request-Id", requestId);
    applyCorsHeaders(request, response);

    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }

    const parsedContext = await parseRequest(request, runtimeConfiguration.maxRequestBodyBytes);
    context = parsedContext;
    enforceMobileRelease(parsedContext);
    enforceLaunchFeatureFlags(parsedContext, runtimeConfiguration.features);
    const controller = controllers.find((item) => item.canHandle(parsedContext));

    if (!controller) {
      sendErrorJson(response, 404, {
        message: await localizeApiErrorMessage("Route not found", parsedContext.headers)
      });
      return;
    }

    routeMatched = true;
    const analyticsActor = await getOptionalAuthenticatedIdentity(parsedContext, platform);
    await analyticsRequestContext.run({...parseAnalyticsContext(parsedContext.headers["x-yardmatch-analytics"]), role: analyticsActor?.role ?? "anonymous",
      internal: analyticsActor?.role === "ops" || (process.env.ANALYTICS_EXCLUDED_USER_IDS ?? "").split(",").includes(analyticsActor?.userId ?? "__anonymous__")},
      () => controller.handle(parsedContext, response));
  } catch (error) {
    if (error instanceof HttpError) {
      errorType = error.name || "HttpError";
      errorCategory = error.statusCode === 401 || error.statusCode === 403
        ? "authentication"
        : error.statusCode >= 500
          ? "server-error"
          : "client-request";
      if (error.statusCode >= 500) {
        captureApiException(error, {
          requestId,
          method: request.method ?? "GET",
          route: context?.path ?? "/request-parse",
          statusCode: error.statusCode,
          category: errorCategory
        });
      }
      sendErrorJson(response, error.statusCode, {
        message: await localizeApiErrorMessage(error.message, context?.headers ?? request.headers)
      });
      return;
    }

    if (error instanceof ExternalRequestTimeoutError) {
      errorType = error.name || "ExternalRequestTimeoutError";
      errorCategory = "dependency-timeout";
      captureApiException(error, {
        requestId,
        method: request.method ?? "GET",
        route: context?.path ?? "/request-parse",
        statusCode: 504,
        category: errorCategory
      });
      sendErrorJson(response, 504, {
        message: await localizeApiErrorMessage(error.message, context?.headers ?? request.headers)
      });
      return;
    }

    errorType = error instanceof Error ? error.name : "UnknownServerError";
    errorCategory = "server-error";
    errorFrames = error instanceof Error
      ? error.stack?.split("\n").slice(1, 9).map((frame) => frame.trim())
      : undefined;
    captureApiException(error, {
      requestId,
      method: request.method ?? "GET",
      route: context?.path ?? "/request-parse",
      statusCode: 500,
      category: errorCategory
    });
    sendErrorJson(response, 500, {
      message: await localizeApiErrorMessage("Unexpected server error", context?.headers ?? request.headers)
    });
  } finally {
    // Unmatched paths (scanners, typos) share one bucket so they cannot grow route metrics without bound.
    let route = routeMatched ? context?.path : context ? UNMATCHED_ROUTE_LABEL : undefined;
    if (!route) {
      try {
        route = new URL(request.url ?? "/", "http://localhost").pathname;
      } catch {
        route = "/unparseable-request";
      }
    }
    apiRuntimeObservability.recordRequest({
      requestId,
      method: request.method ?? "GET",
      route,
      statusCode: response.statusCode,
      durationMs: performance.now() - startedAt,
      errorType,
      category: errorCategory,
      errorFrames
    });
  }
});

// A single monolith keeps deployment simple while the product surface is still growing quickly.
server.listen(port, () => {
  console.log(`YardMatch API listening on http://localhost:${port} (${repositoryMode})`);
});

// Render waits maxShutdownDelaySeconds (30s) before SIGKILL; exit on our own terms before that.
const DRAIN_CONNECTIONS_MS = 10_000;
const HARD_EXIT_MS = 25_000;

async function runShutdownStep(step: string, work: () => Promise<unknown> | undefined): Promise<void> {
  try {
    await work();
  } catch (error) {
    process.exitCode = 1;
    console.error(JSON.stringify({
      event: "api_shutdown_step_failed",
      occurredAt: new Date().toISOString(),
      step,
      errorType: error instanceof Error ? error.name : "UnknownShutdownError"
    }));
  }
}

async function shutDown(reason: string): Promise<void> {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  clearInterval(notificationMaintenance);
  clearInterval(analyticsMaintenance);
  console.log(`YardMatch API received ${reason}; draining active requests.`);

  const hardExit = setTimeout(() => {
    console.error(`YardMatch API did not finish draining within ${HARD_EXIT_MS} ms; exiting.`);
    process.exit(1);
  }, HARD_EXIT_MS);
  hardExit.unref();

  const forcedShutdown = setTimeout(() => {
    server.closeAllConnections();
    process.exitCode = 1;
  }, DRAIN_CONNECTIONS_MS);
  forcedShutdown.unref();
  // Idle keep-alive sockets would otherwise hold server.close() open until they time out.
  server.closeIdleConnections();

  server.close(async (error) => {
    clearTimeout(forcedShutdown);
    if (error) {
      console.error("YardMatch API shutdown failed", error);
      process.exitCode = 1;
    }
    // Let in-flight sweeps finish so leased notifications are not left waiting for lease expiry.
    await runShutdownStep("notification-worker", () => notificationWork);
    await runShutdownStep("analytics-worker", () => analyticsWork);
    await runShutdownStep("analytics-drain", () => analytics.drain());
    await runShutdownStep("database-disconnect", () => prismaClient?.$disconnect());
    await runShutdownStep("error-reporting-flush", () => flushApiErrorReporting());
    clearTimeout(hardExit);
    process.exit(process.exitCode ?? 0);
  });
}

process.once("SIGTERM", () => void shutDown("SIGTERM"));
process.once("SIGINT", () => void shutDown("SIGINT"));
process.once("uncaughtException", (error) => {
  apiRuntimeObservability.recordProcessFailure("uncaught-exception", error);
  captureApiProcessException(error, "uncaught-exception");
  process.exitCode = 1;
  void shutDown("an uncaught exception");
});
process.once("unhandledRejection", (reason) => {
  apiRuntimeObservability.recordProcessFailure("unhandled-rejection", reason);
  captureApiProcessException(reason, "unhandled-rejection");
  process.exitCode = 1;
  void shutDown("an unhandled rejection");
});
