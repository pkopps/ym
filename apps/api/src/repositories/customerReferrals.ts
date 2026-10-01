import type { CustomerReferralChannel, LaunchLeadStatus } from "@yardmatch/contracts";

export interface CustomerReferralRecord {
  id: string;
  referrerCustomerId: string;
  leadId: string;
  friendName: string;
  channel: CustomerReferralChannel;
  contact: string;
  areaLabel?: string;
  consentVersion: string;
  consentedAt: string;
  createdAt: string;
  leadStatus: LaunchLeadStatus;
}
