import { apiSpec, renderDocsHtml } from "../docs";
import { ApiController, RequestContext, sendHtml, sendJson } from "../http";

export class DocsController implements ApiController {
  public canHandle(context: RequestContext): boolean {
    return (
      (context.method === "GET" && context.path === "/api/docs") ||
      (context.method === "GET" && context.path === "/api/docs/openapi.json")
    );
  }

  public async handle(context: RequestContext, response: Parameters<typeof sendJson>[0]): Promise<void> {
    if (context.path === "/api/docs/openapi.json") {
      sendJson(response, 200, apiSpec);
      return;
    }

    sendHtml(response, 200, renderDocsHtml());
  }
}
