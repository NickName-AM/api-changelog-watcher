// F12: persist one run to Supabase through the record_watch_result() RPC.
// Plain fetch to PostgREST: no SDK, no bundle weight.

import type { RunResult, SourceDef } from "./types";

export interface StoreConfig {
  url: string;
  key: string;
}

export function storeConfig(env: Env): StoreConfig | null {
  const url = env.SUPABASE_URL?.trim();
  const key = env.SUPABASE_WATCH_KEY?.trim();
  return url && key ? { url: url.replace(/\/+$/, ""), key } : null;
}

export function buildPayload(src: SourceDef, run: RunResult) {
  return {
    source: {
      id: src.id,
      platform: src.platform,
      kind: src.kind,
      name: src.name,
      url: src.url,
      latest_version: run.version ?? null,
    },
    run: {
      started_at: run.startedAt,
      outcome: run.outcome,
      duration_ms: run.durationMs,
      error: run.error ?? null,
    },
    changes: run.changes,
  };
}

/** Throws on failure so the queue retries; the unique constraint makes retries safe. */
export async function recordRun(cfg: StoreConfig, src: SourceDef, run: RunResult): Promise<{ inserted: number }> {
  const headers: Record<string, string> = {
    apikey: cfg.key,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  // New-style sb_secret_… keys go in `apikey` only. A legacy service_role JWT
  // also needs to be the bearer token.
  if (!cfg.key.startsWith("sb_")) headers.Authorization = `Bearer ${cfg.key}`;

  const res = await fetch(`${cfg.url}/rest/v1/rpc/record_watch_result`, {
    method: "POST",
    headers,
    body: JSON.stringify({ p: buildPayload(src, run) }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 500);
    throw new Error(`Supabase record_watch_result → ${res.status}: ${detail}`);
  }
  const out = (await res.json()) as { inserted?: number } | null;
  return { inserted: out?.inserted ?? 0 };
}
