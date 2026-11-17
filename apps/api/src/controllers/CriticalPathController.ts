import { ApiController, RequestContext, sendJson } from "../http";
import type { CriticalPathMonitor } from "../observability/CriticalPathMonitor";

/**
 * Public, cached probe for uptime/on-call tools. Returns 200 only when every critical path
 * passes, and 503 when any check fails or is not configured, so a monitor can alert on status code.
 * The body says pass/fail per check and nothing else; failure detail goes to logs and Sentry.
 */
export class CriticalPathController implements ApiController {
  public constructor(private readonly monitor: CriticalPathMonitor) {}

  public canHandle(context: RequestContext): boolean {
    return context.method === "GET" && context.path === "/api/observability/critical-paths";
  }

  public async handle(_context: RequestContext, response: Parameters<typeof sendJson>[0]): Promise<void> {
    const report = await this.monitor.getReport();
    response.setHeader("Cache-Control", "no-store");
    sendJson(response, report.status === "ok" ? 200 : 503, report);
  }
}
