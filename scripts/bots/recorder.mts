import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface ResponseRecord {
  at: string;
  persona: string;
  botId: string;
  action: string;
  method: string;
  path: string;
  status: number;
  ms: number;
  message?: string;
  /** Expected refusals (a stranger reading live location, a reused reset code) are recorded but not counted as failures. */
  expected?: boolean;
}

export interface EventRecord {
  at: string;
  botId: string;
  action: string;
  bookingId?: string;
  planId?: string;
  detail?: Record<string, unknown>;
}

export interface FindingRecord {
  kind: "invariant" | "probe" | "gap";
  name: string;
  message: string;
  rows?: unknown[];
}

/** Writes one run's evidence under reports/bot-runs/<timestamp>/. */
export class RunRecorder {
  public readonly dir: string;
  public readonly responses: ResponseRecord[] = [];
  public readonly events: EventRecord[] = [];
  public readonly findings: FindingRecord[] = [];
  private readonly latencies = new Map<string, number[]>();

  public constructor(root: string, label = new Date().toISOString().replace(/[:.]/g, "-")) {
    this.dir = join(root, label);
    mkdirSync(this.dir, { recursive: true });
  }

  public response(record: ResponseRecord): void {
    const key = `${record.method} ${record.path}`;
    const list = this.latencies.get(key) ?? [];
    list.push(record.ms);
    this.latencies.set(key, list);
    if (record.status >= 200 && record.status < 300) return;
    this.responses.push(record);
    appendFileSync(join(this.dir, "non-2xx.jsonl"), `${JSON.stringify(record)}\n`);
  }

  public event(record: Omit<EventRecord, "at">): void {
    const full = { at: new Date().toISOString(), ...record };
    this.events.push(full);
    appendFileSync(join(this.dir, "events.jsonl"), `${JSON.stringify(full)}\n`);
  }

  public finding(record: FindingRecord): void {
    this.findings.push(record);
    appendFileSync(join(this.dir, "findings.jsonl"), `${JSON.stringify(record)}\n`);
  }

  public latencySummary(): Array<{ route: string; count: number; p50: number; p95: number; max: number }> {
    const pick = (sorted: number[], q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0;
    return [...this.latencies.entries()].map(([route, values]) => {
      const sorted = [...values].sort((a, b) => a - b);
      return { route, count: sorted.length, p50: Math.round(pick(sorted, 0.5)), p95: Math.round(pick(sorted, 0.95)), max: Math.round(sorted.at(-1) ?? 0) };
    }).sort((a, b) => b.p95 - a.p95);
  }

  public writeJson(name: string, value: unknown): void {
    writeFileSync(join(this.dir, name), `${JSON.stringify(value, null, 2)}\n`);
  }

  public writeText(name: string, value: string): void {
    writeFileSync(join(this.dir, name), value);
  }
}
