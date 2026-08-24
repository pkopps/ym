import { BookingListScope } from "@yardmatch/contracts";
import { HttpError } from "./http";

export const DEFAULT_PAGE_LIMIT = 25;
export const MAX_PAGE_LIMIT = 100;

export interface PaginationInput {
  cursor?: string;
  limit: number;
}

export function parsePaginationInput(query: URLSearchParams): PaginationInput {
  const rawLimit = query.get("limit");
  const limit = rawLimit === null ? DEFAULT_PAGE_LIMIT : Number(rawLimit);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_PAGE_LIMIT) {
    throw new HttpError(400, `limit must be an integer between 1 and ${MAX_PAGE_LIMIT}`);
  }

  return {
    cursor: query.get("cursor")?.trim() || undefined,
    limit
  };
}

export function parseBookingListScope(query: URLSearchParams): BookingListScope {
  const scope = query.get("scope")?.trim() || "all";
  if (scope !== "active" && scope !== "history" && scope !== "all") {
    throw new HttpError(400, "scope must be active, history, or all");
  }
  return scope;
}

export function encodePageCursor(recordId: string): string {
  return Buffer.from(JSON.stringify({ version: 1, recordId }), "utf8").toString("base64url");
}

export function decodePageCursor(cursor?: string): string | undefined {
  if (!cursor) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as {
      version?: unknown;
      recordId?: unknown;
    };
    if (
      parsed.version !== 1 ||
      typeof parsed.recordId !== "string" ||
      parsed.recordId.length < 1 ||
      parsed.recordId.length > 200
    ) {
      throw new Error("Invalid cursor payload");
    }
    return parsed.recordId;
  } catch {
    throw new HttpError(400, "cursor is invalid or expired");
  }
}

export function parseBoundedBookingIds(query: URLSearchParams): string[] {
  const ids = query
    .getAll("bookingId")
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) {
    throw new HttpError(400, "At least one bookingId is required");
  }
  if (uniqueIds.length > MAX_PAGE_LIMIT || uniqueIds.some((id) => id.length > 200)) {
    throw new HttpError(400, `No more than ${MAX_PAGE_LIMIT} booking ids can be requested`);
  }
  return uniqueIds;
}
