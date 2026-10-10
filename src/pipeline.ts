// One run of one source: fetch → short-circuit → parse → guard → diff →
// summarise → store → snapshot. Each queue message runs this once, so each
// source gets its own 10 ms CPU budget. Waiting on fetch, KV and AI is free.

import { diffEntries, guard, isEmpty, toSnapshot } from "./diff";
import { fetchSource, type Fetched } from "./fetch";
import { sha256 } from "./hash";
import { recordRun, storeConfig } from "./store";
import { deterministicSummary, fallbackSummary, summarizeWithAi } from "./summarize";
import { truncate } from "./text";
import type { Change, ChangeRow, RunResult, Snapshot, SourceDef, Summary } from "./types";

export interface RunOptions {
  /** Use this body instead of fetching (debug route and tests). */
  body?: string;
  /** Page URL to attribute an injected body to. Defaults to the source URL. */
  pageUrl?: string;
  /** Set false to skip Workers AI (summaries fall back to the raw excerpt). */
  ai?: boolean;
  /** Set false to skip the Supabase write even when it is configured. */
  store?: boolean;
}

export const snapshotKey = (sourceId: string) => `snap:${sourceId}`;

const EXCERPT_CHARS = 500;

function toRow(src: SourceDef, change: Change, s: Summary): ChangeRow {
  const text = change.diffType === "removed" ? change.oldText : change.newText;
  return {
    entry_key: change.key,
    change_type: src.kind === "status" ? "status" : change.diffType,
    title: truncate(change.title, 300),
    url: change.url ?? null,
    excerpt: text ? truncate(text, EXCERPT_CHARS) : null,
    summary: s.summary,
    category: s.category,
    versions: s.versions,
    effective_date: s.effectiveDate,
    content_hash: change.contentHash,
  };
}

async function summarizeAll(env: Env, src: SourceDef, changes: Change[], useAi: boolean): Promise<ChangeRow[]> {
  const budget = Math.max(0, Number(env.MAX_AI_CALLS_PER_RUN) || 0);
  let aiCalls = 0;
  const rows: ChangeRow[] = [];
  // Sequential on purpose: a new Meta version can add a dozen entries, and
  // there is no hurry. It also keeps us well inside Workers AI rate limits.
  for (const change of changes) {
    let s: Summary;
    if (src.kind === "status" || change.diffType === "removed") {
      s = deterministicSummary(src, change);
    } else if (useAi && aiCalls < budget) {
      aiCalls++;
      s = await summarizeWithAi(env.AI, src, change);
    } else {
      s = fallbackSummary();
    }
    rows.push(toRow(src, change, s));
  }
  return rows;
}

export async function runSource(env: Env, src: SourceDef, opts: RunOptions = {}): Promise<RunResult> {
  const t0 = Date.now();
  const startedAt = new Date(t0).toISOString();
  const result: RunResult = { sourceId: src.id, outcome: "unchanged", startedAt, durationMs: 0, changes: [], stored: false };
  let nextSnapshot: Snapshot | null = null;

  try {
    const prev = await env.WATCH_KV.get<Snapshot>(snapshotKey(src.id), "json");

    const fetched: Fetched =
      opts.body !== undefined
        ? { pageUrl: opts.pageUrl ?? src.url, notModified: false, body: opts.body }
        : await fetchSource(src, env.USER_AGENT, prev);

    if (fetched.notModified) {
      result.version = prev?.version;
      result.entryCount = prev?.count;
    } else {
      // F4: identical body → nothing to do. One KV read and one native hash.
      const body = src.extract ? src.extract(fetched.body) : fetched.body;
      const bodyHash = await sha256(body);
      if (prev && prev.bodyHash === bodyHash && prev.pageUrl === fetched.pageUrl) {
        result.version = prev.version;
        result.entryCount = prev.count;
      } else {
        const parsed = await src.parse(body, fetched.pageUrl);
        const version = parsed.version;
        const versionChanged = !src.rollingVersion && Boolean(prev?.version && version && prev.version !== version);
        result.version = version;
        result.entryCount = parsed.entries.length;

        const problem = guard(src.kind, prev, parsed.entries.length, versionChanged);
        if (problem) throw new Error(problem);

        nextSnapshot = toSnapshot(parsed.entries, {
          pageUrl: fetched.pageUrl,
          bodyHash,
          etag: fetched.etag,
          lastModified: fetched.lastModified,
          version,
        });

        if (!prev) {
          // F7: first ever run stores the snapshot and reports nothing, so the
          // feed doesn't open with years of history.
          result.outcome = "baseline";
        } else {
          const d = await diffEntries(prev, parsed.entries, versionChanged);
          if (!isEmpty(d)) {
            result.outcome = "changed";
            result.changes = await summarizeAll(env, src, [...d.added, ...d.modified, ...d.removed], opts.ai !== false);
          }
        }
      }
    }
  } catch (err) {
    result.outcome = "error";
    result.error = truncate(err instanceof Error ? err.message : String(err), 1000);
    nextSnapshot = null; // never overwrite a good snapshot after a failure
  }

  result.durationMs = Date.now() - t0;

  // Store first, snapshot second: if the store fails, the queue retries and the
  // same diff is found again. Rows are deduped on (source, key, content_hash).
  const cfg = opts.store === false ? null : storeConfig(env);
  if (cfg) {
    await recordRun(cfg, src, result);
    result.stored = true;
  }
  if (nextSnapshot) await env.WATCH_KV.put(snapshotKey(src.id), JSON.stringify(nextSnapshot));

  console.log(
    JSON.stringify({
      msg: "run",
      source: src.id,
      outcome: result.outcome,
      changes: result.changes.length,
      entries: result.entryCount,
      version: result.version,
      ms: result.durationMs,
      stored: result.stored,
      error: result.error,
    }),
  );
  return result;
}
