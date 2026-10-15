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
import { MediaController } from "./controllers/MediaController";
import { ObservabilityController } from "./controllers/ObservabilityController";
import { SupportController } from "./controllers/SupportController";
import { ApiController, HttpError, applyCorsHeaders, parseRequest, sendJson } from "./http";
import { localizeApiErrorMessage } from "./i18n";
import { InMemoryMarketplaceRepository } from "./repositories/InMemoryMarketplaceRepository";
import { PrismaMarketplaceRepository } from "./repositories/PrismaMarketplaceRepository";
import { MarketplacePlatformService } from "./services/MarketplacePlatformService";
import { validateRuntimeConfiguration } from "./config/productionConfig";
import { enforceLaunchFeatureFlags } from "./config/featureGate";
import { ExternalRequestTimeoutError } from "./integrations/outboundRequestTimeout";
import { createApiRuntimeObservabilityFromEnv } from "./observability/ApiRuntimeObservability";
import {
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
const analytics = new ProductAnalytics(prismaClient);
await analytics.restore();
const analyticsMaintenance = setInterval(() => {
  void analytics.maintenance().catch(() => console.error("Analytics maintenance failed; inspect collection health."));
}, 1000);
analyticsMaintenance.unref();
const apiRuntimeObservability = createApiRuntimeObservabilityFromEnv();
const platform = new MarketplacePlatformService(repository, analytics);
// Durable claims allow each API replica to safely share this bounded worker.
let notificationWork: Promise<unknown> | undefined;
const notificationMaintenance = setInterval(() => {
  notificationWork ??= platform.retryDueNotificationDeliveriesForOps()
    .catch(() => console.error("Notification worker failed; queued work remains recoverable."))
    .finally(() => { notificationWork = undefined; });
}, 1000);
notificationMaintenance.unref();
const controllers: ApiController[] = [
  new HealthController(runtimeConfiguration, async () => {
    if (prismaClient) {
      await prismaClient.$queryRaw`SELECT 1`;
    }
  }),
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
  const requestId = crypto.randomUUID();
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
      sendJson(response, 404, {
        message: await localizeApiErrorMessage("Route not found", parsedContext.headers)
      });
      return;
    }

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
      sendJson(response, error.statusCode, {
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
      sendJson(response, 504, {
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
    sendJson(response, 500, {
      message: await localizeApiErrorMessage("Unexpected server error", context?.headers ?? request.headers)
    });
  } finally {
    let route = context?.path;
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

let shuttingDown = false;
async function shutDown(reason: string): Promise<void> {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  clearInterval(notificationMaintenance);
  clearInterval(analyticsMaintenance);
  console.log(`YardMatch API received ${reason}; draining active requests.`);

  const forcedShutdown = setTimeout(() => {
    server.closeAllConnections();
    process.exitCode = 1;
  }, 10_000);
  forcedShutdown.unref();

  server.close(async (error) => {
    clearTimeout(forcedShutdown);
    if (error) {
      console.error("YardMatch API shutdown failed", error);
      process.exitCode = 1;
    }
    await notificationWork;
    await analytics.drain().catch(() => { process.exitCode = 1; });
    await prismaClient?.$disconnect();
    await flushApiErrorReporting();
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
