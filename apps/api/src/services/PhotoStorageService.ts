import { randomBytes } from "node:crypto";
import { del, get, put } from "@vercel/blob";
import { BookingEvidenceEntry } from "@yardmatch/contracts";
import { withAbortableTimeout } from "../integrations/outboundRequestTimeout";
import { ValidatedEvidenceImage } from "../media/imageValidation";

export type PhotoStorageMode = "inline" | "vercel-blob-private";

export interface StoredEvidencePhoto {
  deliveryUrl: string;
  storageProvider?: "vercel-blob-private";
  objectPathname?: string;
  accessToken?: string;
}

export interface ReadEvidencePhoto {
  bytes: Buffer;
  contentType: string;
}

export class PhotoStorageService {
  public readonly mode: PhotoStorageMode;
  private readonly blobToken: string | undefined;

  public constructor(
    private readonly apiBaseUrl = process.env.API_BASE_URL ?? `http://localhost:${process.env.PORT ?? "4001"}`,
    mode = process.env.PHOTO_STORAGE_MODE?.trim(),
    blobToken = process.env.BLOB_READ_WRITE_TOKEN?.trim(),
    private readonly externalRequestTimeoutMs = 15_000
  ) {
    this.mode = mode === "vercel-blob-private" ? mode : "inline";
    this.blobToken = blobToken;
  }

  public async store(
    bookingId: string,
    evidenceId: string,
    originalDataUrl: string,
    image: ValidatedEvidenceImage
  ): Promise<StoredEvidencePhoto> {
    if (this.mode === "inline") {
      return { deliveryUrl: originalDataUrl };
    }
    if (!this.blobToken) {
      throw new Error("Private photo storage is missing BLOB_READ_WRITE_TOKEN");
    }

    const objectPathname = `booking-evidence/${bookingId}/${evidenceId}.${image.extension}`;
    await withAbortableTimeout(
      (signal) =>
        put(objectPathname, image.bytes, {
          access: "private",
          token: this.blobToken,
          contentType: image.contentType,
          addRandomSuffix: false,
          allowOverwrite: false,
          maximumSizeInBytes: image.bytes.length,
          cacheControlMaxAge: 60,
          abortSignal: signal
        }),
      {
        timeoutMs: this.externalRequestTimeoutMs,
        timeoutMessage: "Photo storage did not respond in time. Try saving the photo again."
      }
    );
    const accessToken = randomBytes(32).toString("base64url");
    return {
      deliveryUrl: this.buildPrivateDeliveryUrl(evidenceId, accessToken),
      storageProvider: "vercel-blob-private",
      objectPathname,
      accessToken
    };
  }

  public buildMarketingDeliveryUrl(evidenceId: string): string {
    return `${this.apiBaseUrl.replace(/\/$/, "")}/api/media/marketing/${encodeURIComponent(evidenceId)}`;
  }

  public extractAccessToken(deliveryUrl: string | undefined): string | undefined {
    if (!deliveryUrl) {
      return undefined;
    }
    try {
      return new URL(deliveryUrl).searchParams.get("token") ?? undefined;
    } catch {
      return undefined;
    }
  }

  public async read(objectPathname: string): Promise<ReadEvidencePhoto | undefined> {
    if (!this.blobToken) {
      throw new Error("Private photo storage is missing BLOB_READ_WRITE_TOKEN");
    }
    return withAbortableTimeout(async (signal) => {
      const result = await get(objectPathname, {
        access: "private",
        token: this.blobToken,
        useCache: false,
        abortSignal: signal
      });
      if (!result || result.statusCode !== 200) {
        return undefined;
      }
      return {
        bytes: Buffer.from(await new Response(result.stream).arrayBuffer()),
        contentType: result.blob.contentType
      };
    }, {
      timeoutMs: this.externalRequestTimeoutMs,
      timeoutMessage: "Photo storage did not respond in time. Try loading the photo again."
    });
  }

  public async remove(evidence: Pick<BookingEvidenceEntry, "imageObjectPathname">): Promise<void> {
    if (this.mode !== "vercel-blob-private" || !evidence.imageObjectPathname || !this.blobToken) {
      return;
    }
    await withAbortableTimeout(
      (signal) => del(evidence.imageObjectPathname as string, {
        token: this.blobToken,
        abortSignal: signal
      }),
      {
        timeoutMs: this.externalRequestTimeoutMs,
        timeoutMessage: "Photo storage did not respond in time. Try removing the photo again."
      }
    );
  }

  private buildPrivateDeliveryUrl(evidenceId: string, accessToken: string): string {
    const base = this.apiBaseUrl.replace(/\/$/, "");
    return `${base}/api/media/evidence/${encodeURIComponent(evidenceId)}?token=${encodeURIComponent(accessToken)}`;
  }
}
