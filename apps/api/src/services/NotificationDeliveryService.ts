import { NotificationChannel, NotificationOpsDeliveryPolicy } from "@yardmatch/contracts";

export interface OpsAlertTarget {
  channel: "email" | "sms";
  destination: string;
}

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
  private readonly notificationAlertEmails = process.env.NOTIFICATION_ALERT_EMAILS?.trim();
  private readonly notificationAlertSmsNumbers = process.env.NOTIFICATION_ALERT_SMS_NUMBERS?.trim();
  private readonly staging = process.env.YARDMATCH_ENV?.trim().toLowerCase() === "staging";
  private readonly stagingAllowedEmails = new Set(
    this.parseCsv(process.env.STAGING_NOTIFICATION_ALLOWED_EMAILS).map((item) => item.toLowerCase())
  );
  private readonly stagingAllowedSmsNumbers = new Set(
    this.parseCsv(process.env.STAGING_NOTIFICATION_ALLOWED_SMS_NUMBERS)
  );
  private readonly stagingAllowedPushTokens = new Set(
    this.parseCsv(process.env.STAGING_NOTIFICATION_ALLOWED_PUSH_TOKENS)
  );

  public async dispatch(input: NotificationDispatchInput): Promise<NotificationDispatchResult> {
    if (this.staging && input.channel !== "in-app" && !this.isStagingDestinationAllowed(input)) {
      const provider = `staging-suppressed-${input.channel}`;
      return {
        provider,
        sentAt: new Date().toISOString(),
        externalId: `${provider}_${crypto.randomUUID()}`
      };
    }

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
    if (
      this.staging &&
      channel !== "in-app" &&
      destination &&
      !this.isStagingDestinationAllowed({ channel, destination })
    ) {
      return `staging-suppressed-${channel}`;
    }

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

  public getOpsDeliveryPolicy(): NotificationOpsDeliveryPolicy {
    const channelPolicies: NotificationOpsDeliveryPolicy["channelPolicies"] = [
      {
        channel: "push",
        productionProvider: "expo-push",
        activeProvider: "expo-push",
        readinessStatus: "production-ready",
        retrySupported: true,
        readyRequirements: [
          "Register Expo push tokens from production mobile builds.",
          "Confirm Expo project and native app push credentials before production rollout."
        ],
        missingConfiguration: []
      },
      {
        channel: "email",
        productionProvider: "resend",
        activeProvider: this.getProviderName("email"),
        readinessStatus: this.hasResendConfig() ? "production-ready" : "mock-fallback",
        retrySupported: this.hasResendConfig(),
        readyRequirements: [
          "Set RESEND_API_KEY.",
          "Set NOTIFICATION_EMAIL_FROM to the approved YardMatch sender identity."
        ],
        missingConfiguration: [
          ...(!this.resendApiKey ? ["RESEND_API_KEY"] : []),
          ...(!this.notificationEmailFrom ? ["NOTIFICATION_EMAIL_FROM"] : [])
        ]
      },
      {
        channel: "sms",
        productionProvider: "twilio",
        activeProvider: this.getProviderName("sms"),
        readinessStatus: this.hasTwilioConfig() ? "production-ready" : "mock-fallback",
        retrySupported: this.hasTwilioConfig(),
        readyRequirements: [
          "Set TWILIO_ACCOUNT_SID.",
          "Set TWILIO_AUTH_TOKEN.",
          "Set TWILIO_FROM_NUMBER to the approved YardMatch sender number."
        ],
        missingConfiguration: [
          ...(!this.twilioAccountSid ? ["TWILIO_ACCOUNT_SID"] : []),
          ...(!this.twilioAuthToken ? ["TWILIO_AUTH_TOKEN"] : []),
          ...(!this.twilioFromNumber ? ["TWILIO_FROM_NUMBER"] : [])
        ]
      }
    ];
    const productionReadyCount = channelPolicies.filter(
      (policy) => policy.readinessStatus === "production-ready"
    ).length;
    const productionReadinessStatus =
      productionReadyCount === channelPolicies.length
        ? "production-ready"
        : productionReadyCount > 0
          ? "partially-configured"
          : "mock-only";

    return {
      productionReadinessStatus,
      pushStrategy: "expo-push",
      opsAlertTargetsConfigured: this.getOpsAlertTargets().length > 0,
      channelPolicies,
      readyRequirements: [
        "Keep Expo push-token registration enabled for production mobile builds.",
        "Configure Resend before relying on transactional email delivery.",
        "Configure Twilio before relying on SMS delivery.",
        "Configure NOTIFICATION_ALERT_EMAILS or NOTIFICATION_ALERT_SMS_NUMBERS before launch support hours."
      ]
    };
  }

  public getOpsAlertTargets(): OpsAlertTarget[] {
    const targets: OpsAlertTarget[] = [];

    for (const destination of this.parseCsv(this.notificationAlertEmails)) {
      targets.push({
        channel: "email",
        destination
      });
    }

    for (const destination of this.parseCsv(this.notificationAlertSmsNumbers)) {
      targets.push({
        channel: "sms",
        destination
      });
    }

    return targets;
  }

  private hasResendConfig(): boolean {
    return Boolean(this.resendApiKey && this.notificationEmailFrom);
  }

  private hasTwilioConfig(): boolean {
    return Boolean(this.twilioAccountSid && this.twilioAuthToken && this.twilioFromNumber);
  }

  private parseCsv(value: string | undefined): string[] {
    return (value ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private isStagingDestinationAllowed(input: Pick<NotificationDispatchInput, "channel" | "destination">): boolean {
    if (input.channel === "email") {
      return this.stagingAllowedEmails.has(input.destination.toLowerCase());
    }
    if (input.channel === "sms") {
      return this.stagingAllowedSmsNumbers.has(input.destination);
    }
    if (input.channel === "push") {
      return this.stagingAllowedPushTokens.has(input.destination);
    }
    return true;
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
