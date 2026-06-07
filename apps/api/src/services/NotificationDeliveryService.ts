import { NotificationChannel } from "@yardmatch/contracts";

export interface NotificationDispatchInput {
  channel: NotificationChannel;
  destination: string;
  title: string;
  body: string;
}

export interface NotificationDispatchResult {
  provider: string;
  sentAt: string;
  externalId: string;
}

export class NotificationDeliveryService {
  public async dispatch(input: NotificationDispatchInput): Promise<NotificationDispatchResult> {
    const provider = this.getProviderName(input.channel);
    return {
      provider,
      sentAt: new Date().toISOString(),
      externalId: `${provider}_${crypto.randomUUID()}`
    };
  }

  private getProviderName(channel: NotificationChannel): string {
    if (channel === "email") {
      return "mock-email";
    }

    if (channel === "sms") {
      return "mock-sms";
    }

    if (channel === "push") {
      return "mock-push";
    }

    return "in-app";
  }
}
