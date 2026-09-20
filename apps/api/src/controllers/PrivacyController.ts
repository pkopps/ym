import { Prisma, type PrismaClient } from "@prisma/client";
import { HttpError, sendJson, type ApiController, type RequestContext } from "../http";
import { requireAuthenticatedIdentity, requireOpsAccess } from "../controller-auth";
import type { MarketplacePlatformService } from "../services/MarketplacePlatformService";
type PrivacyRecord = {id: string; userId: string; kind: string; status: string; requestedAt: Date; updatedAt: Date; reviewedBy: string | null; reviewNotes: string | null; audit: Prisma.JsonArray};
export class PrivacyController implements ApiController {
  private readonly localRequests = new Map<string, PrivacyRecord>();
  public constructor(private readonly platform: MarketplacePlatformService, private readonly prisma?: PrismaClient) {}
  public canHandle(context: RequestContext) {
    return ["GET", "POST"].includes(context.method) && ["/api/account/privacy-requests", "/api/ops/privacy-requests"].includes(context.path);
  }
  public async handle(context: RequestContext, response: Parameters<typeof sendJson>[0]) {
    const ops = context.path.startsWith("/api/ops/");
    const actor = ops ? await requireOpsAccess(context, this.platform) : await requireAuthenticatedIdentity(context, this.platform);
    if (context.method === "GET") {
      const requests = this.prisma ? await this.prisma.privacyRequest.findMany({where: ops ? {} : {userId: actor.userId},
        orderBy: {requestedAt: "desc"}, take: 100}) : [...this.localRequests.values()].filter(row => ops || row.userId === actor.userId);
      sendJson(response, 200, {requests}); return;
    }
    const body = context.body as {kind?: string; id?: string; status?: string; notes?: string};
    if (ops) {
      if (!["in-review", "awaiting-owner", "retention-required"].includes(body?.status ?? "") ||
        typeof body.notes !== "string" || body.notes.trim().length < 15 || body.notes.length > 2000) {
        throw new HttpError(400, "Record a review status and a specific retention or fulfillment plan");
      }
      const current = this.prisma ? await this.prisma.privacyRequest.findUnique({where: {id: body.id ?? ""}}) : this.localRequests.get(body.id ?? "");
      if (!current) throw new HttpError(404, "Privacy request not found");
      const audit = [...(Array.isArray(current.audit) ? current.audit : []), {actorId: actor.userId, status: body.status!, notes: body.notes, at: new Date().toISOString()}];
      const update = {audit, status: body.status!, reviewNotes: body.notes, reviewedBy: actor.userId, updatedAt: new Date()};
      const result = this.prisma ? (await this.prisma.$queryRaw<PrivacyRecord[]>`
        UPDATE "PrivacyRequest" SET "status"=${update.status}, "reviewNotes"=${update.reviewNotes},
        "reviewedBy"=${update.reviewedBy}, "updatedAt"=${update.updatedAt},
        "audit"="audit" || ${JSON.stringify(audit.slice(-1))}::jsonb WHERE "id"=${current.id} RETURNING *
      `)[0] : {...current,...update};
      if (!this.prisma) this.localRequests.set(result.id,result);
      sendJson(response,200,result); return;
    }
    if (!["account-deletion", "data-export", "photo-removal"].includes(body?.kind ?? "")) throw new HttpError(400, "Unknown privacy request");
    const existing = this.prisma ? await this.prisma.privacyRequest.findFirst({where: {userId: actor.userId, kind: body.kind!, status: {in: ["requested", "in-review", "awaiting-owner", "retention-required"]}}})
      : [...this.localRequests.values()].find(row => row.userId === actor.userId && row.kind === body.kind && ["requested", "in-review", "awaiting-owner", "retention-required"].includes(row.status));
    if (existing) { sendJson(response,200,existing); return; }
    const record: PrivacyRecord = {id: crypto.randomUUID(), userId: actor.userId, kind: body.kind!, status:"requested",
      requestedAt: new Date(), updatedAt: new Date(), reviewedBy:null, reviewNotes:null, audit: []};
    const result = this.prisma ? await this.prisma.privacyRequest.create({data:record}).catch(async error => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return this.prisma!.privacyRequest.findFirstOrThrow({where: {userId: actor.userId, kind: body.kind!}});
      }
      throw error;
    }) : record;
    if (!this.prisma) this.localRequests.set(record.id, record);
    sendJson(response,201,result);
  }
}
