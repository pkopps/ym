import { HttpError } from "../http";

export const MAX_EVIDENCE_IMAGE_BYTES = 1_500_000;
const MAX_IMAGE_DIMENSION = 12_000;
const MAX_IMAGE_PIXELS = 30_000_000;

export type EvidenceImageContentType = "image/jpeg" | "image/png" | "image/webp";

export interface ValidatedEvidenceImage {
  bytes: Buffer;
  contentType: EvidenceImageContentType;
  extension: "jpg" | "png" | "webp";
  width: number;
  height: number;
}

function readPngDimensions(bytes: Buffer): { width: number; height: number } | undefined {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (bytes.length < 24 || !bytes.subarray(0, 8).equals(signature)) {
    return undefined;
  }
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function readJpegDimensions(bytes: Buffer): { width: number; height: number } | undefined {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
    return undefined;
  }

  let offset = 2;
  while (offset + 3 < bytes.length) {
    while (offset < bytes.length && bytes[offset] === 0xff) {
      offset += 1;
    }
    const marker = bytes[offset];
    offset += 1;
    if (marker === undefined || marker === 0xd9 || marker === 0xda) {
      break;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      continue;
    }
    if (offset + 1 >= bytes.length) {
      break;
    }
    const segmentLength = bytes.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) {
      break;
    }
    if (
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf)
    ) {
      if (segmentLength < 7) {
        break;
      }
      return {
        height: bytes.readUInt16BE(offset + 3),
        width: bytes.readUInt16BE(offset + 5)
      };
    }
    offset += segmentLength;
  }

  return undefined;
}

function readWebpDimensions(bytes: Buffer): { width: number; height: number } | undefined {
  if (
    bytes.length < 30 ||
    bytes.toString("ascii", 0, 4) !== "RIFF" ||
    bytes.toString("ascii", 8, 12) !== "WEBP"
  ) {
    return undefined;
  }

  const format = bytes.toString("ascii", 12, 16);
  if (format === "VP8X") {
    return {
      width: 1 + bytes.readUIntLE(24, 3),
      height: 1 + bytes.readUIntLE(27, 3)
    };
  }

  if (format === "VP8 " && bytes.length >= 30) {
    if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) {
      return undefined;
    }
    return {
      width: bytes.readUInt16LE(26) & 0x3fff,
      height: bytes.readUInt16LE(28) & 0x3fff
    };
  }

  if (format === "VP8L" && bytes.length >= 25 && bytes[20] === 0x2f) {
    return {
      width: 1 + bytes[21] + ((bytes[22] & 0x3f) << 8),
      height: 1 + (bytes[22] >> 6) + (bytes[23] << 2) + ((bytes[24] & 0x0f) << 10)
    };
  }

  return undefined;
}

export function validateEvidenceImageDataUrl(imageDataUrl: string): ValidatedEvidenceImage {
  const match = imageDataUrl.match(/^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/]*={0,2})$/i);
  if (!match) {
    throw new HttpError(400, "Photo evidence must be a JPEG, PNG, or WebP image data URL");
  }

  const encoded = match[2];
  if (!encoded || encoded.length % 4 !== 0) {
    throw new HttpError(400, "Photo evidence contains invalid image data");
  }

  const bytes = Buffer.from(encoded, "base64");
  if (bytes.length === 0 || bytes.length > MAX_EVIDENCE_IMAGE_BYTES) {
    throw new HttpError(400, `Booking evidence images must be ${MAX_EVIDENCE_IMAGE_BYTES} bytes or fewer`);
  }

  const declaredType = match[1].toLowerCase();
  const contentType: EvidenceImageContentType = declaredType === "jpg"
    ? "image/jpeg"
    : `image/${declaredType}` as EvidenceImageContentType;
  const dimensions = contentType === "image/png"
    ? readPngDimensions(bytes)
    : contentType === "image/jpeg"
      ? readJpegDimensions(bytes)
      : readWebpDimensions(bytes);

  if (!dimensions) {
    throw new HttpError(400, "Photo evidence does not contain a valid image matching its declared type");
  }
  if (
    dimensions.width < 1 ||
    dimensions.height < 1 ||
    dimensions.width > MAX_IMAGE_DIMENSION ||
    dimensions.height > MAX_IMAGE_DIMENSION ||
    dimensions.width * dimensions.height > MAX_IMAGE_PIXELS
  ) {
    throw new HttpError(400, "Photo evidence dimensions are not supported");
  }

  return {
    bytes,
    contentType,
    extension: contentType === "image/jpeg" ? "jpg" : contentType.slice("image/".length) as "png" | "webp",
    width: dimensions.width,
    height: dimensions.height
  };
}
