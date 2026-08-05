import { ApiController, RequestContext, sendJson } from "../http";
import { RuntimeConfiguration } from "../config/productionConfig";

export class HealthController implements ApiController {
  public constructor(
    private readonly runtime: RuntimeConfiguration,
    private readonly readinessCheck: () => Promise<void>
  ) {}

  public canHandle(context: RequestContext): boolean {
    return context.method === "GET" && (context.path === "/healthz" || context.path === "/readyz");
  }

  public async handle(context: RequestContext, response: Parameters<typeof sendJson>[0]): Promise<void> {
    if (context.path === "/healthz") {
      sendJson(response, 200, {
        status: "ok",
        environment: this.runtime.deploymentEnvironment,
        repository: this.runtime.repositoryMode,
        revision: process.env.RENDER_GIT_COMMIT?.slice(0, 12) ?? process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12)
      });
      return;
    }

    try {
      await this.readinessCheck();
      sendJson(response, 200, {
        status: "ready",
        environment: this.runtime.deploymentEnvironment,
        repository: this.runtime.repositoryMode
      });
    } catch {
      sendJson(response, 503, {
        status: "not-ready",
        environment: this.runtime.deploymentEnvironment,
        repository: this.runtime.repositoryMode
      });
    }
  }
}
