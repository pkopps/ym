import type { RunRecorder } from "./recorder.mts";

export class ApiError extends Error {
  public constructor(public readonly status: number, message: string, public readonly body: unknown) {
    super(message);
  }
}

export interface CallOptions {
  token?: string;
  /** Statuses the caller expects (a probe that should be refused). They are recorded with expected: true. */
  expect?: number[];
  action?: string;
}

/** One HTTP client per bot. Every call is timed; every non-2xx is written to the run's non-2xx.jsonl. */
export class BotClient {
  public token?: string;

  public constructor(
    private readonly baseUrl: string,
    private readonly recorder: RunRecorder,
    public readonly persona: string,
    public readonly botId: string
  ) {}

  public async call<T = unknown>(method: "GET" | "POST", path: string, body?: unknown, options: CallOptions = {}): Promise<T> {
    const token = options.token ?? this.token;
    const started = performance.now();
    let status = 0, text = "";
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(60_000)
      });
      status = response.status;
      text = await response.text();
    } catch (error) {
      status = 0;
      text = JSON.stringify({ message: error instanceof Error ? error.message : String(error) });
    }
    const ms = performance.now() - started;
    let payload: unknown;
    try { payload = text ? JSON.parse(text) : undefined; } catch { payload = text; }
    const message = typeof payload === "object" && payload && "message" in payload ? String((payload as { message: unknown }).message) : text.slice(0, 300);
    this.recorder.response({
      at: new Date().toISOString(), persona: this.persona, botId: this.botId, action: options.action ?? path,
      method, path: path.split("?")[0]!, status, ms, ...(status < 200 || status >= 300 ? { message } : {}),
      ...(options.expect?.includes(status) ? { expected: true } : {})
    });
    if (status < 200 || status >= 300) throw new ApiError(status, `${method} ${path} -> ${status}: ${message}`, payload);
    return payload as T;
  }

  public get<T = unknown>(path: string, options?: CallOptions) {
    return this.call<T>("GET", path, undefined, options);
  }

  public post<T = unknown>(path: string, body?: unknown, options?: CallOptions) {
    return this.call<T>("POST", path, body ?? {}, options);
  }

  /** Runs a call that is allowed to fail; returns undefined instead of throwing. */
  public async attempt<T>(work: () => Promise<T>): Promise<T | undefined> {
    try { return await work(); } catch (error) { if (error instanceof ApiError) return undefined; throw error; }
  }
}
