import { fetchSource } from "./fetch";
import { brief, errorFields, log } from "./log";
import { runSource, snapshotKey } from "./pipeline";
import { CRONS, getSource, SOURCES, sourcesFor } from "./sources";
import { recordRun, storeConfig } from "./store";
import type { JobMessage, SourceDef } from "./types";

const DLQ = "watch-jobs-dlq";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

async function tokenMatches(given: string, expected: string): Promise<boolean> {
  const enc = new TextEncoder();
  // Hash both sides so the comparison is constant-time and length-independent.
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(given)),
    crypto.subtle.digest("SHA-256", enc.encode(expected)),
  ]);
  return crypto.subtle.timingSafeEqual(a, b);
}

async function authorized(req: Request, env: Env): Promise<boolean> {
  if (!env.RUN_TOKEN) return false;
  const m = /^Bearer\s+(.+)$/i.exec(req.headers.get("authorization") ?? "");
  return Boolean(m && (await tokenMatches(m[1]!.trim(), env.RUN_TOKEN)));
}

async function enqueue(env: Env, sources: SourceDef[], reason: JobMessage["reason"]): Promise<void> {
  if (sources.length === 0) return;
  await env.JOBS.sendBatch(sources.map((s) => ({ body: { sourceId: s.id, reason } satisfies JobMessage })));
}

async function handleFetch(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";

  if (path === "/" && req.method === "GET") {
    return json({
      name: "api-changelog-watcher",
      sources: SOURCES.map(({ id, platform, kind, schedule, url }) => ({ id, platform, kind, schedule, url })),
    });
  }

  // F18: manual trigger. ?source=all enqueues everything; a single id runs
  // inline and returns the result, which is what you want when testing.
  if (path === "/run") {
    if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
    if (!(await authorized(req, env))) return json({ error: "unauthorized" }, 401);
    const id = url.searchParams.get("source") ?? "all";
    if (id === "all") {
      await enqueue(env, SOURCES, "manual");
      log.info("run.enqueued", `Manual run: queued ${SOURCES.length} sources`, {
        reason: "manual",
        sources: SOURCES.map((s) => s.id),
      });
      return json({ enqueued: SOURCES.map((s) => s.id) }, 202);
    }
    const src = getSource(id);
    if (!src) return json({ error: `unknown source: ${id}` }, 404);
    return json(await runSource(env, src));
  }

  // Local testing helpers. Off unless ENABLE_DEBUG=true, and still need the token.
  if (path.startsWith("/debug/")) {
    if (env.ENABLE_DEBUG !== "true") return json({ error: "not found" }, 404);
    if (!(await authorized(req, env))) return json({ error: "unauthorized" }, 401);
    const src = getSource(url.searchParams.get("source") ?? "");
    if (!src) return json({ error: "pass ?source=<id>", sources: SOURCES.map((s) => s.id) }, 400);

    // POST a fixture as the body to use it instead of fetching the live page.
    const body = req.method === "POST" ? await req.text() : "";
    const injected = body.length > 0 ? body : undefined;

    if (path === "/debug/parse") {
      const page = injected ?? (await fetchSource(src, env.USER_AGENT, null)).body;
      const parsed = await src.parse(src.extract ? src.extract(page) : page, src.url);
      return json({
        source: src.id,
        version: parsed.version,
        count: parsed.entries.length,
        entries: parsed.entries.map((e) => ({ key: e.key, title: e.title, chars: e.text.length, hash: e.hash })),
      });
    }
    if (path === "/debug/run") {
      return json(
        await runSource(env, src, {
          body: injected,
          ai: url.searchParams.get("ai") !== "0",
          store: url.searchParams.get("store") !== "0",
          reason: "debug",
        }),
      );
    }
    if (path === "/debug/snapshot") {
      return json(await env.WATCH_KV.get(snapshotKey(src.id), "json"));
    }
    if (path === "/debug/reset") {
      await env.WATCH_KV.delete(snapshotKey(src.id));
      return json({ reset: src.id });
    }
    return json({ error: "not found" }, 404);
  }

  return json({ error: "not found" }, 404);
}

export default {
  async fetch(req, env): Promise<Response> {
    return handleFetch(req, env);
  },

  // F2: the cron only fans out. All real work happens in queue().
  async scheduled(controller, env): Promise<void> {
    const schedule = CRONS[controller.cron];
    if (!schedule) {
      log.warn("cron.unknown", `Cron "${controller.cron}" is not in CRONS; nothing queued`, { cron: controller.cron });
      return;
    }
    const sources = sourcesFor(schedule);
    await enqueue(env, sources, "cron");
    log.info("cron.enqueued", `Cron ${schedule}: queued ${sources.map((s) => s.id).join(", ") || "nothing"}`, {
      cron: controller.cron,
      schedule,
      sources: sources.map((s) => s.id),
    });
  },

  // F3: max_batch_size = 1, so each source gets its own invocation and CPU budget.
  async queue(batch, env): Promise<void> {
    for (const msg of batch.messages) {
      const src = getSource(msg.body?.sourceId);
      if (!src) {
        log.warn("queue.unknown_source", `Dropped a message for unknown source "${String(msg.body?.sourceId)}"`, {
          queue: batch.queue,
          message_id: msg.id,
          body: msg.body,
        });
        msg.ack();
        continue;
      }

      if (batch.queue === DLQ) {
        // Retries are used up; most likely Supabase was unreachable. Try once
        // more to leave a trace in watch_runs, then drop the message.
        log.error("queue.dead_letter", `${src.id} gave up after ${msg.attempts} attempts`, {
          source: src.id,
          reason: msg.body.reason,
          message_id: msg.id,
          attempts: msg.attempts,
        });
        const cfg = storeConfig(env);
        if (cfg) {
          const now = new Date().toISOString();
          await recordRun(cfg, src, {
            sourceId: src.id,
            outcome: "error",
            startedAt: now,
            durationMs: 0,
            changes: [],
            error: "gave up after queue retries (see Workers logs)",
            stored: false,
          }).catch((err) =>
            log.error("queue.dead_letter_store_failed", `${src.id}: could not record the give-up in Supabase: ${brief(err)}`, {
              source: src.id,
              ...errorFields(err),
            }),
          );
        }
        msg.ack();
        continue;
      }

      try {
        await runSource(env, src, { reason: msg.body.reason, attempt: msg.attempts });
        msg.ack();
      } catch (err) {
        // runSource only throws when the Supabase write (or the KV put) fails.
        const delaySeconds = 60 * msg.attempts;
        log.warn("queue.retry", `${src.id} attempt ${msg.attempts} failed, retrying in ${delaySeconds}s: ${brief(err)}`, {
          source: src.id,
          reason: msg.body.reason,
          message_id: msg.id,
          attempt: msg.attempts,
          delay_seconds: delaySeconds,
          ...errorFields(err),
        });
        msg.retry({ delaySeconds });
      }
    }
  },
} satisfies ExportedHandler<Env, JobMessage>;
