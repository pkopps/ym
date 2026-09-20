import {
  CreateLaunchOperationsTaskRequest,
  ProcessLaunchOperationsTaskEscalationsRequest,
  ProcessLaunchOperationsTaskNotificationsRequest,
  ProcessOpsAutomationRunRequest,
  SessionHeartbeatRequest,
  UpdateLaunchOperationsTaskRequest
} from "@yardmatch/contracts";
import { getOptionalAuthenticatedIdentity, requireOpsAccess } from "../controller-auth";
import { ApiController, HttpError, RequestContext, sendJson } from "../http";
import { MarketplacePlatformService } from "../services/MarketplacePlatformService";
import { ApiRuntimeObservability } from "../observability/ApiRuntimeObservability";

import { ProductAnalytics, AnalyticsRateLimit } from "../observability/ProductAnalytics";

export class ObservabilityController implements ApiController {
  private readonly heartbeatLimit = new AnalyticsRateLimit();
  public constructor(
    private readonly platform: MarketplacePlatformService,
    private readonly apiRuntimeObservability?: Pick<ApiRuntimeObservability, "getSnapshot">,
    private readonly analytics?: ProductAnalytics
  ) {}

  public canHandle(context: RequestContext): boolean {
    return (
      (context.method === "POST" && context.path === "/api/observability/session-heartbeat") ||
      (context.method === "GET" && context.path === "/api/observability/overview") ||
      (context.method === "GET" && context.path === "/api/observability/product-analytics") ||
      (context.method === "GET" && context.path === "/api/observability/launch-operations/tasks") ||
      (context.method === "POST" && context.path === "/api/observability/launch-operations/tasks") ||
      (context.method === "POST" && context.path === "/api/observability/launch-operations/tasks/update") ||
      (context.method === "POST" && context.path === "/api/observability/launch-operations/tasks/notify-due") ||
      (context.method === "POST" &&
        context.path === "/api/observability/launch-operations/tasks/escalate-overdue") ||
      (context.method === "POST" && context.path === "/api/observability/ops-automation/run-due") ||
      (context.method === "GET" && context.path === "/api/observability/ops-automation/runs") ||
      (context.method === "POST" && context.path === "/api/observability/inbound-automation/escalate")
    );
  }

  public async handle(context: RequestContext, response: Parameters<typeof sendJson>[0]): Promise<void> {
    if (context.path === "/api/observability/product-analytics") {
      await requireOpsAccess(context, this.platform);
      sendJson(response, 200, await this.analytics?.report(Number(context.query.get("days")) || 30));
      return;
    }
    if (context.path === "/api/observability/overview") {
      await requireOpsAccess(context, this.platform);
      const overview = await this.platform.getObservabilityOverview();
      sendJson(response, 200, {
        ...overview,
        apiRuntime: this.apiRuntimeObservability?.getSnapshot()
      });
      return;
    }

    if (context.path === "/api/observability/inbound-automation/escalate") {
      await requireOpsAccess(context, this.platform);
      sendJson(response, 200, await this.platform.escalateInboundAutomationAlerts());
      return;
    }

    if (context.method === "GET" && context.path === "/api/observability/launch-operations/tasks") {
      await requireOpsAccess(context, this.platform);
      sendJson(response, 200, await this.platform.listLaunchOperationsTasks());
      return;
    }

    if (context.method === "POST" && context.path === "/api/observability/launch-operations/tasks") {
      const identity = await requireOpsAccess(context, this.platform);
      sendJson(
        response,
        201,
        await this.platform.createLaunchOperationsTask(
          identity,
          context.body as CreateLaunchOperationsTaskRequest
        )
      );
      return;
    }

    if (context.method === "POST" && context.path === "/api/observability/launch-operations/tasks/update") {
      const identity = await requireOpsAccess(context, this.platform);
      sendJson(
        response,
        200,
        await this.platform.updateLaunchOperationsTask(
          identity,
          context.body as UpdateLaunchOperationsTaskRequest
        )
      );
      return;
    }

    if (context.method === "POST" && context.path === "/api/observability/launch-operations/tasks/notify-due") {
      const identity = await requireOpsAccess(context, this.platform);
      sendJson(
        response,
        200,
        await this.platform.notifyDueLaunchOperationsTasks(
          identity,
          context.body as ProcessLaunchOperationsTaskNotificationsRequest
        )
      );
      return;
    }

    if (
      context.method === "POST" &&
      context.path === "/api/observability/launch-operations/tasks/escalate-overdue"
    ) {
      const identity = await requireOpsAccess(context, this.platform);
      sendJson(
        response,
        200,
        await this.platform.escalateOverdueLaunchOperationsTasks(
          identity,
          context.body as ProcessLaunchOperationsTaskEscalationsRequest
        )
      );
      return;
    }

    if (context.method === "POST" && context.path === "/api/observability/ops-automation/run-due") {
      const identity = await requireOpsAccess(context, this.platform);
      sendJson(
        response,
        200,
        await this.platform.runDueOpsAutomation(
          identity,
          context.body as ProcessOpsAutomationRunRequest
        )
      );
      return;
    }

    if (context.method === "GET" && context.path === "/api/observability/ops-automation/runs") {
      await requireOpsAccess(context, this.platform);
      sendJson(response, 200, await this.platform.listOpsAutomationRuns());
      return;
    }

    this.heartbeatLimit.check(context);
    const payload = context.body as SessionHeartbeatRequest;
    if (!payload || !/^[a-zA-Z0-9_-]{8,100}$/.test(payload.sessionId ?? "") ||
      typeof payload.path !== "string" || payload.path.length > 160 || payload.path.includes("?") ||
      !["web-mobile", "web-desktop", "ios-phone", "ios-tablet", "android-phone", "android-tablet"].includes(payload.platform)) {
      throw new HttpError(400, "Invalid presence heartbeat");
    }
    const identity = await getOptionalAuthenticatedIdentity(context, this.platform);
    sendJson(response, 201, this.platform.recordSessionHeartbeat({...payload,
      actorId: identity?.userId, role: identity?.role, occurredAt: new Date().toISOString()}));
  }
}
