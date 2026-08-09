import Stripe from "stripe";
import { HttpError } from "../http";

export const STRIPE_REQUEST_TIMEOUT_MS = 10_000;

export function createStripeClient(secretKey: string): Stripe {
  return new Stripe(secretKey, {
    timeout: STRIPE_REQUEST_TIMEOUT_MS,
    maxNetworkRetries: 1
  });
}

export function isStripeTimeoutError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as {
    type?: string;
    name?: string;
    message?: string;
    detail?: { code?: string };
  };
  const isConnectionError =
    candidate.type === "StripeConnectionError" || candidate.name === "StripeConnectionError";
  return Boolean(
    isConnectionError &&
      (candidate.detail?.code === "ETIMEDOUT" || /timeout/i.test(candidate.message ?? ""))
  );
}

export async function runStripeRequest<T>(
  operation: () => Promise<T>,
  timeoutMessage: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (isStripeTimeoutError(error)) {
      throw new HttpError(504, timeoutMessage);
    }
    throw error;
  }
}
