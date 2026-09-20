import { timingSafeEqual } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import type { MarketplacePlatformService } from "../services/MarketplacePlatformService";
import { HttpError, sendJson, type ApiController, type RequestContext } from "../http";
import { requireOpsAccess } from "../controller-auth";
import { mobileReleasePolicy } from "../observability/mobileReleasePolicy";
import type { ProductAnalytics } from "../observability/ProductAnalytics";
export class ReadinessController implements ApiController {
  public constructor(private readonly platform: MarketplacePlatformService, private readonly analytics: ProductAnalytics, private readonly prisma?: PrismaClient) {}
  public canHandle(context: RequestContext) {
    return (context.method === "GET" && ["/api/mobile/release-policy", "/api/observability/readiness", "/api/observability/ops-automation/health"].includes(context.path)) ||
      (context.method === "POST" && context.path === "/api/observability/ops-automation/scheduled");
  }
  public async handle(context: RequestContext, response: Parameters<typeof sendJson>[0]) {
    if (context.path === "/api/mobile/release-policy") {
      sendJson(response, 200, mobileReleasePolicy(context.query.get("app") ?? "")); return;
    }
    if (["/api/observability/ops-automation/scheduled", "/api/observability/ops-automation/health"].includes(context.path)) {
      const token = process.env.OPS_AUTOMATION_TOKEN ?? "";
      const supplied = context.headers.authorization?.replace(/^Bearer /, "") ?? "";
      if (token.length < 32 || Buffer.byteLength(supplied) !== Buffer.byteLength(token) || !timingSafeEqual(Buffer.from(token), Buffer.from(supplied))) {
        throw new HttpError(401, "Invalid scheduler identity");
      }
      const actor = await this.platform.findAuthIdentityByUserId(process.env.OPS_AUTOMATION_USER_ID ?? "");
      if (!actor || actor.role !== "ops" || actor.accessDisabledAt) throw new HttpError(403, "Scheduler requires an active named ops account");
      if (context.method === "GET") {
        const runs = await this.platform.listOpsAutomationRuns();
        const latest = runs.runs.find(run => !run.dryRun);
        const enabled = process.env.OPS_AUTOMATION_ENABLED === "1";
        const overdue = !latest || Date.parse(latest.createdAt) < Date.now() - 45 * 60_000;
        const analytics = (await this.analytics.report(1)).health;
        const healthy = enabled && !overdue && !latest?.failedSweepCount && !analytics.dropped && analytics.pendingWrites < 100;
        sendJson(response, healthy ? 200 : 503, {healthy, enabled, overdue, lastRunAt: latest?.createdAt,
          failedSweeps: latest?.failedSweepCount ?? 0, pendingWrites: analytics.pendingWrites, droppedEvents: analytics.dropped});
        return;
      }
      const body = context.body as {dryRun?: boolean};
      const dryRun = body?.dryRun !== false;
      if (!dryRun && process.env.OPS_AUTOMATION_ENABLED !== "1") throw new HttpError(409, "Scheduled actions are not enabled");
      const result = await this.platform.runDueOpsAutomation(actor, {dryRun});
      await this.analytics.maintenance();
      sendJson(response, result.failedSweepCount ? 503 : 200, result); return;
    }
    await requireOpsAccess(context, this.platform);
    const runs = await this.platform.listOpsAutomationRuns();
    const latest = runs.runs.find(run => !run.dryRun);
    const overdue = !latest || Date.parse(latest.createdAt) < Date.now() - 45 * 60_000;
    const credentials = this.prisma ? await this.prisma.providerCredential.findMany({
      where: {status: "verified", expiresAt: {lte: new Date(Date.now() + 30 * 86400_000)}},
      select: {providerId: true, type: true, expiresAt: true}
    }) : [];
    sendJson(response, 200, {scheduler: {enabled: process.env.OPS_AUTOMATION_ENABLED === "1", overdue,
      lastRunAt: latest?.createdAt, failedSweeps: latest?.failedSweepCount ?? 0},
      analytics: (await this.analytics.report(1)).health,
      credentialReviewDue: credentials,
      mobile: ["customer", "provider", "crew"].map(mobileReleasePolicy)});
  }
}
