import { ApiController, RequestContext } from "../http";
import { MarketplacePlatformService } from "../services/MarketplacePlatformService";

export class MediaController implements ApiController {
  public constructor(private readonly platform: MarketplacePlatformService) {}

  public canHandle(context: RequestContext): boolean {
    return context.method === "GET" && (
      /^\/api\/media\/evidence\/[^/]+$/.test(context.path) ||
      /^\/api\/media\/marketing\/[^/]+$/.test(context.path)
    );
  }

  public async handle(context: RequestContext, response: Parameters<ApiController["handle"]>[1]): Promise<void> {
    const marketingUse = context.path.startsWith("/api/media/marketing/");
    const evidenceId = decodeURIComponent(context.path.split("/").at(-1) ?? "");
    const photo = await this.platform.getEvidencePhoto(
      evidenceId,
      context.query.get("token") ?? undefined,
      marketingUse
    );

    response.writeHead(200, {
      "Content-Type": photo.contentType,
      "Content-Length": photo.bytes.length,
      "Content-Disposition": "inline",
      // Marketing eligibility is consent-driven and can be revoked at any time.
      // Do not let a CDN retain a previously eligible image after revocation.
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    });
    response.end(photo.bytes);
  }
}
