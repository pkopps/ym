import type { CustomerReferral } from "./types";

/** Launch coverage is US-only. Store the same E.164 number for formatting variants. */
export function normalizeReferralPhone(value: string): string | undefined {
  const compact = value.trim().replace(/[\s().-]/g, "");
  const match = /^(?:\+?1)?([2-9]\d{2}[2-9]\d{6})$/.exec(compact);
  return match ? `+1${match[1]}` : undefined;
}

/** Opening a composer is not evidence of delivery. Callers must never mark it sent. */
export function buildReferralInvitationHref(
  referral: Pick<CustomerReferral, "channel" | "contact">,
  subject: string,
  body: string,
  ios = false
): string {
  return referral.channel === "email"
    ? `mailto:${encodeURIComponent(referral.contact)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    : `sms:${referral.contact}${ios ? "&" : "?"}body=${encodeURIComponent(body)}`;
}
