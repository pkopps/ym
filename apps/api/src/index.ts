import { createServer } from "node:http";
import { PrismaClient } from "@prisma/client";
import { DataEngineeringLogger } from "@yardmatch/analytics";
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
import { ExternalRequestTimeoutError } from "./integrations/outboundRequestTimeout";

const runtimeConfiguration = validateRuntimeConfiguration();
const prismaClient = runtimeConfiguration.repositoryMode === "prisma-postgres"
  ? new PrismaClient()
  : undefined;
const repository = runtimeConfiguration.repositoryMode === "prisma-postgres"
  ? new PrismaMarketplaceRepository(prismaClient as PrismaClient)
  : new InMemoryMarketplaceRepository();
const port = Number(process.env.PORT ?? 4001);
const repositoryMode = runtimeConfiguration.repositoryMode;
const analytics = new DataEngineeringLogger();
const platform = new MarketplacePlatformService(repository, analytics);
const controllers: ApiController[] = [
  new HealthController(runtimeConfiguration, async () => {
    if (prismaClient) {
      await prismaClient.$queryRaw`SELECT 1`;
    }
  }),
  new DocsController(),
  new AuthController(platform),
  new MediaController(platform),
  new MarketplaceController(platform),
  new ObservabilityController(platform),
  new SupportController(platform)
];

const server = createServer(async (request, response) => {
  let context: Awaited<ReturnType<typeof parseRequest>> | undefined;

  try {
    applyCorsHeaders(request, response);

    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }

    const parsedContext = await parseRequest(request, runtimeConfiguration.maxRequestBodyBytes);
    context = parsedContext;
    const controller = controllers.find((item) => item.canHandle(parsedContext));

    if (!controller) {
      sendJson(response, 404, {
        message: await localizeApiErrorMessage("Route not found", parsedContext.headers)
      });
      return;
    }

    await controller.handle(parsedContext, response);
  } catch (error) {
    if (error instanceof HttpError) {
      sendJson(response, error.statusCode, {
        message: await localizeApiErrorMessage(error.message, context?.headers ?? request.headers)
      });
      return;
    }

    if (error instanceof ExternalRequestTimeoutError) {
      sendJson(response, 504, {
        message: await localizeApiErrorMessage(error.message, context?.headers ?? request.headers)
      });
      return;
    }

    const fallbackMessage = error instanceof Error ? error.message : "Unknown server error";
    sendJson(response, 500, {
      message: await localizeApiErrorMessage(fallbackMessage, context?.headers ?? request.headers)
    });
  }
});

// A single monolith keeps deployment simple while the product surface is still growing quickly.
server.listen(port, () => {
  console.log(`YardMatch API listening on http://localhost:${port} (${repositoryMode})`);
});

let shuttingDown = false;
async function shutDown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  console.log(`YardMatch API received ${signal}; draining active requests.`);

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
    await prismaClient?.$disconnect();
  });
}

process.once("SIGTERM", () => void shutDown("SIGTERM"));
process.once("SIGINT", () => void shutDown("SIGINT"));
