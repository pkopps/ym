export const DEFAULT_EXTERNAL_REQUEST_TIMEOUT_MS = 10_000;

export class ExternalRequestTimeoutError extends Error {
  public constructor(
    message: string,
    public readonly timeoutMs: number
  ) {
    super(message);
    this.name = "ExternalRequestTimeoutError";
  }
}

export async function withAbortableTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  options: {
    timeoutMs?: number;
    timeoutMessage: string;
  }
): Promise<T> {
  const timeoutMs =
    Number.isFinite(options.timeoutMs) && Number(options.timeoutMs) > 0
      ? Number(options.timeoutMs)
      : DEFAULT_EXTERNAL_REQUEST_TIMEOUT_MS;
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      reject(new ExternalRequestTimeoutError(options.timeoutMessage, timeoutMs));
      controller.abort();
    }, timeoutMs);
  });

  try {
    return await Promise.race([operation(controller.signal), timeoutPromise]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}
