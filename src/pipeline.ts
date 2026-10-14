// One run of one source: fetch → short-circuit → parse → guard → diff →
// summarise → store → snapshot. Each queue message runs this once, so each
// source gets its own 10 ms CPU budget. Waiting on fetch, KV and AI is free.

import { baselineChanges, diffEntries, guard, isEmpty, toSnapshot } from "./diff";
import { fetchSource, type Fetched } from "./fetch";
import { sha256 } from "./hash";
import { brief, errorFields, log } from "./log";
import { revalidatePortfolio } from "./revalidate";
import { recordRun, storeConfig } from "./store";
import { deterministicSummary, fallbackSummary, summarizeWithAi } from "./summarize";
import { truncate } from "./text";
import type { Change, ChangeRow, JobMessage, RunResult, Snapshot, SourceDef, Summary } from "./types";

export interface RunOptions {
  /** Use this body instead of fetching (debug route and tests). */
  body?: string;
  /** Page URL to attribute an injected body to. Defaults to the source URL. */
  pageUrl?: string;
  /** Set false to skip Workers AI (summaries fall back to the raw excerpt). */
  ai?: boolean;
  /** Set false to skip the Supabase write even when it is configured. */
  store?: boolean;
  /** What started the run, for the logs. Defaults to "manual". */
  reason?: JobMessage["reason"] | "debug";
  /** Queue delivery attempt (1 on the first try), for the logs. */
  attempt?: number;
}

/** Where a run got to. On an error, the step that failed. */
type Stage = "load" | "fetch" | "not_modified" | "same_body" | "parse" | "guard" | "diff" | "summarize" | "done";

interface AiStats {
  /** Workers AI summaries that came back usable. */
  ok: number;
  /** Both models failed or returned junk; the row keeps the raw excerpt. */
  failed: number;
  /** Over MAX_AI_CALLS_PER_RUN, or AI turned off; raw excerpt only. */
  skipped: number;
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

async function summarizeAll(
  env: Env,
  src: SourceDef,
  changes: Change[],
  useAi: boolean,
  stats: AiStats,
): Promise<ChangeRow[]> {
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
      if (s.ai) stats.ok++;
      else stats.failed++;
    } else {
      s = fallbackSummary();
      stats.skipped++;
    }
    rows.push(toRow(src, change, s));
  }
  return rows;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The one-line `message` of a run.done log, e.g. "tiktok-dev changed: 3 changes (2 added, 1 modified)". */
function runMessage(
  result: RunResult,
  stage: Stage,
  diff: { added: number; modified: number; removed: number } | undefined,
  ai: AiStats,
): string {
  const id = result.sourceId;
  switch (result.outcome) {
    case "error":
      return `${id} failed at ${stage}: ${brief(result.error)}`;
    case "baseline": {
      let msg = `${id} baseline: saved ${plural(result.entryCount ?? 0, "entry", "entries")}, `;
      msg += result.changes.length > 0 ? `${result.changes.length} reported as preexisting` : "nothing reported";
      if (ai.failed > 0) msg += `, ${plural(ai.failed, "AI summary", "AI summaries")} failed`;
      if (ai.skipped > 0) msg += `, ${ai.skipped} without AI`;
      return msg;
    }
    case "unchanged":
      if (stage === "not_modified") return `${id} unchanged (304 Not Modified)`;
      if (stage === "same_body") return `${id} unchanged (same page body)`;
      return `${id} unchanged (page changed, entries did not)`;
    case "changed": {
      const parts = diff
        ? (["added", "modified", "removed"] as const).filter((k) => diff[k] > 0).map((k) => `${diff[k]} ${k}`)
        : [];
      let msg = `${id} changed: ${plural(result.changes.length, "change")}`;
      if (parts.length > 0) msg += ` (${parts.join(", ")})`;
      if (ai.failed > 0) msg += `, ${plural(ai.failed, "AI summary", "AI summaries")} failed`;
      if (ai.skipped > 0) msg += `, ${ai.skipped} without AI`;
      return msg;
    }
  }
}

export async function runSource(env: Env, src: SourceDef, opts: RunOptions = {}): Promise<RunResult> {
  const t0 = Date.now();
  const startedAt = new Date(t0).toISOString();
  const result: RunResult = { sourceId: src.id, outcome: "unchanged", startedAt, durationMs: 0, changes: [], stored: false };
  let nextSnapshot: Snapshot | null = null;
  let stage: Stage = "load";
  let pageUrl: string | undefined;
  let diffCounts: { added: number; modified: number; removed: number } | undefined;
  const ai: AiStats = { ok: 0, failed: 0, skipped: 0 };

  try {
    const prev = await env.WATCH_KV.get<Snapshot>(snapshotKey(src.id), "json");

    stage = "fetch";
    const fetched: Fetched =
      opts.body !== undefined
        ? { pageUrl: opts.pageUrl ?? src.url, notModified: false, body: opts.body }
        : await fetchSource(src, env.USER_AGENT, prev);
    pageUrl = fetched.pageUrl;

    if (fetched.notModified) {
      stage = "not_modified";
      result.version = prev?.version;
      result.entryCount = prev?.count;
    } else {
      // F4: identical body → nothing to do. One KV read and one native hash.
      const body = src.extract ? src.extract(fetched.body) : fetched.body;
      const bodyHash = await sha256(body);
      if (prev && prev.bodyHash === bodyHash && prev.pageUrl === fetched.pageUrl) {
        stage = "same_body";
        result.version = prev.version;
        result.entryCount = prev.count;
      } else {
        stage = "parse";
        const parsed = await src.parse(body, fetched.pageUrl);
        const version = parsed.version;
        const versionChanged = !src.rollingVersion && Boolean(prev?.version && version && prev.version !== version);
        result.version = version;
        result.entryCount = parsed.entries.length;

        stage = "guard";
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
          // F7: first ever run. A changelog reports what is already on the page
          // as "preexisting"; a status source reports nothing, since its
          // current state is mostly "operational" rows that changed nothing.
          result.outcome = "baseline";
          if (src.kind === "changelog") {
            stage = "summarize";
            const changes = await baselineChanges(parsed.entries);
            result.changes = await summarizeAll(env, src, changes, opts.ai !== false, ai);
          }
        } else {
          stage = "diff";
          const d = await diffEntries(prev, parsed.entries, versionChanged);
          diffCounts = { added: d.added.length, modified: d.modified.length, removed: d.removed.length };
          if (!isEmpty(d)) {
            result.outcome = "changed";
            stage = "summarize";
            const changes = [...d.added, ...d.modified, ...d.removed];
            result.changes = await summarizeAll(env, src, changes, opts.ai !== false, ai);
          }
        }
        stage = "done";
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
  const fields = {
    source: src.id,
    platform: src.platform,
    kind: src.kind,
    reason: opts.reason ?? "manual",
    attempt: opts.attempt,
    outcome: result.outcome,
    // An error keeps the step it failed at; otherwise where the run stopped
    // (not_modified and same_body are the cheap short-circuits).
    stage,
    page_url: pageUrl,
    version: result.version,
    entries: result.entryCount,
    changes: result.changes.length,
    ...diffCounts,
    ...(result.outcome === "baseline" ? { preexisting: result.changes.length } : {}),
    ...(result.changes.length > 0 ? { ai_ok: ai.ok, ai_failed: ai.failed, ai_skipped: ai.skipped } : {}),
    duration_ms: result.durationMs,
    error: result.error,
  };

  const cfg = opts.store === false ? null : storeConfig(env);
  let inserted: number | undefined;
  if (cfg) {
    try {
      inserted = (await recordRun(cfg, src, result)).inserted;
    } catch (err) {
      // The caller retries; this line keeps what the lost run found.
      log.error("run.store_failed", `${src.id} ${result.outcome}, but the Supabase write failed: ${brief(err)}`, {
        ...fields,
        ...errorFields(err),
        run_error: result.error,
      });
      throw err;
    }
    result.stored = true;
  }
  if (nextSnapshot) await env.WATCH_KV.put(snapshotKey(src.id), JSON.stringify(nextSnapshot));

  // Only when rows were actually new: a queue retry of a run that already
  // stored finds its rows deduped (inserted 0) and stays quiet. Source status
  // (last_checked_at, last_ok_at) changes every run and is left to the
  // portfolio's hourly fallback -- its stale badge is a 24 h threshold, so a
  // ping on each ok/error flip would not show anything sooner.
  if (inserted) await revalidatePortfolio(env, src.id, inserted);

  const done = {
    ...fields,
    stored: result.stored,
    inserted,
    snapshot_written: nextSnapshot !== null,
  };
  const message = runMessage(result, stage, diffCounts, ai);
  if (result.outcome === "error") log.error("run.done", message, done);
  else if (ai.failed > 0) log.warn("run.done", message, done);
  else log.info("run.done", message, done);
  return result;
}
