import { ApiController, RequestContext } from "../http";
import { MarketplacePlatformService } from "../services/MarketplacePlatformService";

export class MediaController implements ApiController {
  public constructor(private readonly platform: MarketplacePlatformService) {}

  public canHandle(context: RequestContext): boolean {
    return context.method === "GET" && (
      /^\/api\/media\/evidence\/[^/]+$/.test(context.path) ||
      /^\/api\/media\/marketing\/[^/]+$/.test(context.path) ||
      /^\/api\/media\/credentials\/[^/]+\/[^/]+$/.test(context.path)
    );
  }

  public async handle(context: RequestContext, response: Parameters<ApiController["handle"]>[1]): Promise<void> {
    const marketingUse = context.path.startsWith("/api/media/marketing/");
    const segments = context.path.split("/");
    const photo = context.path.startsWith("/api/media/credentials/")
      ? await this.platform.getCredentialDocument(
          decodeURIComponent(segments.at(-2) ?? ""),
          decodeURIComponent(segments.at(-1) ?? ""),
          context.query.get("token") ?? undefined
        )
      : await this.platform.getEvidencePhoto(
          decodeURIComponent(segments.at(-1) ?? ""),
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
