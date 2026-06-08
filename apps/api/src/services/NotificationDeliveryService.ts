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
  private readonly resendApiKey = process.env.RESEND_API_KEY?.trim();
  private readonly notificationEmailFrom = process.env.NOTIFICATION_EMAIL_FROM?.trim();
  private readonly twilioAccountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  private readonly twilioAuthToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  private readonly twilioFromNumber = process.env.TWILIO_FROM_NUMBER?.trim();

  public async dispatch(input: NotificationDispatchInput): Promise<NotificationDispatchResult> {
    if (input.channel === "push" && input.destination.startsWith("ExponentPushToken[")) {
      return this.dispatchExpoPush(input);
    }

    if (input.channel === "email" && this.hasResendConfig()) {
      return this.dispatchResendEmail(input);
    }

    if (input.channel === "sms" && this.hasTwilioConfig()) {
      return this.dispatchTwilioSms(input);
    }

    const provider = this.getProviderName(input.channel, input.destination);
    return {
      provider,
      sentAt: new Date().toISOString(),
      externalId: `${provider}_${crypto.randomUUID()}`
    };
  }

  public getProviderName(channel: NotificationChannel, destination?: string): string {
    if (channel === "push" && destination?.startsWith("ExponentPushToken[")) {
      return "expo-push";
    }

    if (channel === "email") {
      return this.hasResendConfig() ? "resend" : "mock-email";
    }

    if (channel === "sms") {
      return this.hasTwilioConfig() ? "twilio" : "mock-sms";
    }

    if (channel === "push") {
      return "mock-push";
    }

    return "in-app";
  }

  public supportsRetry(channel: NotificationChannel, destination?: string): boolean {
    const provider = this.getProviderName(channel, destination);
    return provider === "expo-push" || provider === "resend" || provider === "twilio";
  }

  private hasResendConfig(): boolean {
    return Boolean(this.resendApiKey && this.notificationEmailFrom);
  }

  private hasTwilioConfig(): boolean {
    return Boolean(this.twilioAccountSid && this.twilioAuthToken && this.twilioFromNumber);
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

  private async dispatchResendEmail(input: NotificationDispatchInput): Promise<NotificationDispatchResult> {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.resendApiKey}`
      },
      body: JSON.stringify({
        from: this.notificationEmailFrom,
        to: [input.destination],
        subject: input.title,
        text: input.body
      })
    });

    if (!response.ok) {
      const payload = await response.text();
      throw new Error(`Resend request failed with status ${response.status}: ${payload.slice(0, 200)}`);
    }

    const payload = (await response.json()) as {
      id?: string;
      error?: {
        message?: string;
      };
    };

    if (payload.error?.message) {
      throw new Error(payload.error.message);
    }

    return {
      provider: "resend",
      sentAt: new Date().toISOString(),
      externalId: payload.id ?? `resend_${crypto.randomUUID()}`
    };
  }

  private async dispatchTwilioSms(input: NotificationDispatchInput): Promise<NotificationDispatchResult> {
    const accountSid = this.twilioAccountSid as string;
    const authToken = this.twilioAuthToken as string;
    const fromNumber = this.twilioFromNumber as string;
    const body = input.body === input.title ? input.body : `${input.title}\n${input.body}`;
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`
        },
        body: new URLSearchParams({
          To: input.destination,
          From: fromNumber,
          Body: body
        }).toString()
      }
    );

    if (!response.ok) {
      const payload = await response.text();
      throw new Error(`Twilio request failed with status ${response.status}: ${payload.slice(0, 200)}`);
    }

    const payload = (await response.json()) as {
      sid?: string;
      message?: string;
      status?: string;
      code?: number;
    };

    if (payload.code || payload.status === "failed") {
      throw new Error(payload.message ?? "Twilio SMS delivery failed.");
    }

    return {
      provider: "twilio",
      sentAt: new Date().toISOString(),
      externalId: payload.sid ?? `twilio_${crypto.randomUUID()}`
    };
  }
}
