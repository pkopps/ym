import { randomUUID } from "node:crypto";
import { normalizeReferralPhone, type CreateCustomerReferralRequest, type CreateCustomerReferralResponse,
  type CustomerReferral, type CustomerReferralsOverview, type LaunchLead } from "@yardmatch/contracts";
import { HttpError } from "../http";
import type { MarketplaceRepository } from "../repositories/MarketplaceRepository";
import type { CustomerReferralRecord } from "../repositories/customerReferrals";

export const customerReferralConsentVersion = "friend-contact-permission-v1";

function textField(value: unknown, label: string, maximum: number): string {
  if (typeof value !== "string" || /[\u0000-\u001f\u007f]/.test(value) || value.trim().length > maximum) {
    throw new HttpError(400, `Enter a valid ${label}.`);
  }
  return value.trim().replace(/\s+/g, " ");
}

function present(record: CustomerReferralRecord): CustomerReferral {
  return { id: record.id, friendName: record.friendName, channel: record.channel, contact: record.contact,
    areaLabel: record.areaLabel, createdAt: record.createdAt,
    status: record.leadStatus === "converted" ? "booked" : record.leadStatus === "closed-lost" ? "closed"
      : record.leadStatus === "new" ? "saved" : "in-progress" };
}

export class CustomerReferralService {
  public constructor(private readonly repository: MarketplaceRepository, private readonly appBaseUrl: string) {}

  public async list(customerId: string): Promise<CustomerReferralsOverview> {
    if (!await this.repository.findCustomerById(customerId)) throw new HttpError(404, "Customer not found.");
    return { referrals: (await this.repository.listCustomerReferrals(customerId)).map(present),
      shareBaseUrl: new URL("/customer", this.appBaseUrl).toString() };
  }

  public async create(customerId: string, payload: CreateCustomerReferralRequest): Promise<CreateCustomerReferralResponse> {
    if (!payload || payload.contactPermission !== true) {
      throw new HttpError(400, "Confirm your friend agreed to share their contact details with YardMatch for follow-up.");
    }
    const friendName = textField(payload.friendName, "friend name", 80);
    if (friendName.length < 2) throw new HttpError(400, "Enter your friend's name.");
    const areaLabel = payload.areaLabel === undefined ? undefined : textField(payload.areaLabel, "town or area", 100) || undefined;
    if (payload.channel !== "email" && payload.channel !== "phone") throw new HttpError(400, "Choose email or phone.");
    const rawContact = textField(payload.contact, "contact", 254);
    const contact = payload.channel === "phone" ? normalizeReferralPhone(rawContact) : rawContact.toLowerCase();
    if (!contact || (payload.channel === "email" && !/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(contact))) {
      throw new HttpError(400, payload.channel === "email" ? "Enter a valid email address." : "Enter a valid US phone number, including the area code.");
    }
    const customer = await this.repository.findCustomerById(customerId);
    if (!customer) throw new HttpError(404, "Customer not found.");
    if ((payload.channel === "email" && contact === customer.email.trim().toLowerCase()) ||
        (payload.channel === "phone" && contact === normalizeReferralPhone(customer.phone))) {
      throw new HttpError(400, "Use your friend's contact details instead of your own.");
    }

    return this.repository.withLock(`customer-referrals:${customerId}`, async (repository) => {
      const existing = await repository.findCustomerReferralByContact(customerId, payload.channel, contact);
      if (existing) return { referral: present(existing), created: false };
      const now = new Date();
      if (await repository.countCustomerReferralsSince(customerId, new Date(now.getTime() - 86_400_000).toISOString()) >= 10) {
        throw new HttpError(429, "You can save up to 10 new referrals in 24 hours. Please try again later.");
      }
      const createdAt = now.toISOString();
      const leadId = randomUUID();
      const record: CustomerReferralRecord = {
        id: randomUUID(), referrerCustomerId: customerId, leadId, friendName, channel: payload.channel,
        contact, areaLabel, consentVersion: customerReferralConsentVersion, consentedAt: createdAt, createdAt, leadStatus: "new"
      };
      const lead: LaunchLead = {
        id: leadId, sourceChannel: "referral", requestSource: "customer-referral",
        sourceReferenceId: `customer-referral:${record.id}`,
        channelMetadata: { referrerName: customer.fullName, referrerEmail: customer.email, referrerPhone: customer.phone,
          referralFollowUpTarget: "referred-customer", intakeNotes: [
            `Authenticated customer ${customerId} confirmed friend contact permission (${customerReferralConsentVersion}) at ${createdAt}.`,
            "Referral saved. Invitation delivery is not tracked; the customer sends from their own email or text app. No reward has been promised."
          ] },
        contactName: friendName, email: payload.channel === "email" ? contact : undefined,
        phone: payload.channel === "phone" ? contact : undefined, preferredContactMethod: payload.channel === "email" ? "email" : "text",
        areaLabel: areaLabel ?? "Needs area confirmation", message: `Friend referral from ${customer.fullName}. Contact permission confirmed for YardMatch follow-up.`,
        status: "new", firstResponseDueAt: new Date(now.getTime() + 60 * 60_000).toISOString(),
        convertedBookingIds: [], reviewIds: [], createdAt, updatedAt: createdAt
      };
      return { referral: present(await repository.createCustomerReferralWithLead(record, lead)), created: true };
    });
  }
}
