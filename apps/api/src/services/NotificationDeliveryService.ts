import { NotificationChannel } from "@yardmatch/contracts";

export interface NotificationDispatchInput {
  channel: NotificationChannel;
  destination: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface NotificationDispatchResult {
  provider: string;
  sentAt: string;
  externalId: string;
}

export class NotificationDeliveryService {
  public async dispatch(input: NotificationDispatchInput): Promise<NotificationDispatchResult> {
    if (input.channel === "push" && input.destination.startsWith("ExponentPushToken[")) {
      return this.dispatchExpoPush(input);
    }

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

  private async dispatchExpoPush(input: NotificationDispatchInput): Promise<NotificationDispatchResult> {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        to: input.destination,
        title: input.title,
        body: input.body,
        data: input.data
      })
    });

    if (!response.ok) {
      throw new Error(`Expo push request failed with status ${response.status}`);
    }

    const payload = (await response.json()) as {
      data?: {
        id?: string;
        status?: string;
        message?: string;
      };
      errors?: Array<{ message?: string }>;
    };

    const errorMessage = payload.errors?.[0]?.message ?? (payload.data?.status === "error" ? payload.data.message : undefined);
    if (errorMessage) {
      throw new Error(errorMessage);
    }

    return {
      provider: "expo-push",
      sentAt: new Date().toISOString(),
      externalId: payload.data?.id ?? `expo-push_${crypto.randomUUID()}`
    };
  }
}
