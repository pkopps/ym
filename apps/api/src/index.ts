import { createServer } from "node:http";
import { PrismaClient } from "@prisma/client";
import { DataEngineeringLogger } from "@yardmatch/analytics";
import { AuthController } from "./controllers/AuthController";
import { DocsController } from "./controllers/DocsController";
import { MarketplaceController } from "./controllers/MarketplaceController";
import { ObservabilityController } from "./controllers/ObservabilityController";
import { SupportController } from "./controllers/SupportController";
import { ApiController, HttpError, applyCorsHeaders, parseRequest, sendJson } from "./http";
import { InMemoryMarketplaceRepository } from "./repositories/InMemoryMarketplaceRepository";
import { PrismaMarketplaceRepository } from "./repositories/PrismaMarketplaceRepository";
import { MarketplacePlatformService } from "./services/MarketplacePlatformService";

const repository = process.env.DATABASE_URL
  ? new PrismaMarketplaceRepository(new PrismaClient())
  : new InMemoryMarketplaceRepository();
const analytics = new DataEngineeringLogger();
const platform = new MarketplacePlatformService(repository, analytics);
const controllers: ApiController[] = [
  new DocsController(),
  new AuthController(platform),
  new MarketplaceController(platform),
  new ObservabilityController(platform),
  new SupportController(platform)
];

const server = createServer(async (request, response) => {
  try {
    applyCorsHeaders(response);

    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }

    const context = await parseRequest(request);
    const controller = controllers.find((item) => item.canHandle(context));

    if (!controller) {
      sendJson(response, 404, {
        message: "Route not found"
      });
      return;
    }

    await controller.handle(context, response);
  } catch (error) {
    if (error instanceof HttpError) {
      sendJson(response, error.statusCode, {
        message: error.message
      });
      return;
    }

    sendJson(response, 500, {
      message: error instanceof Error ? error.message : "Unknown server error"
    });
  }
});

// A single monolith keeps deployment simple while the product surface is still growing quickly.
server.listen(4000, () => {
  console.log("YardMatch API listening on http://localhost:4000");
});
