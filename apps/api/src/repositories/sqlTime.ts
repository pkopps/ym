import { Prisma } from "@prisma/client";

/** Prisma DateTime columns store UTC without a zone; raw Date parameters carry a zone. */
export function utcTimestamp(value: Date): Prisma.Sql {
  return Prisma.sql`(${value} AT TIME ZONE 'UTC')`;
}
