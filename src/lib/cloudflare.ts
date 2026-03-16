import "server-only";

import type { BrowserWorker } from "@cloudflare/playwright";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export interface D1PreparedStatementLike {
  all<T = Record<string, unknown>>(): Promise<{ results?: T[] }>;
  bind(...values: unknown[]): D1PreparedStatementLike;
  first<T = Record<string, unknown>>(column?: string): Promise<T | null>;
  run(): Promise<{
    meta?: {
      changes?: number;
      last_row_id?: number | string;
    };
  }>;
}

export interface D1DatabaseLike {
  prepare(query: string): D1PreparedStatementLike;
}

export interface AppBindings extends CloudflareEnv {
  DB?: D1DatabaseLike;
  BROWSER?: BrowserWorker;
}

export function getCloudflareBindings(): AppBindings | null {
  try {
    return getCloudflareContext().env as AppBindings;
  } catch {
    return null;
  }
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for");
  if (!forwarded) return "unknown";
  return forwarded.split(",")[0]?.trim() || "unknown";
}
