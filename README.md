# api-changelog-watcher

A Cloudflare Worker that tracks public API changes from Meta, TikTok and
LinkedIn. On a cron it fetches their changelogs and status pages, diffs each
one against the last copy in KV, has Workers AI explain each change in plain
English, and writes the result to Supabase for the portfolio's `/watch` page.
It runs entirely on free tiers.

```
cron ──► queue (one message per source) ──► fetch ─► parse ─► diff ─► AI ─► Supabase
 hourly: status pages                         │ unchanged? stop (304 / same body hash)
 6-hourly: changelogs                         └ snapshot in KV
```

## Sources

| id | What | Schedule |
|---|---|---|
| `meta-graph-latest` | Graph API changelog for the newest version (resolved from the index, currently v26.0) | 6 h |
| `meta-graph-ooc` | Graph API out-of-cycle changes, newest year page (resolved from the index) | 6 h |
| `meta-marketing` | Marketing API changelog (served as Markdown) | 6 h |
| `tiktok-dev` | TikTok for Developers changelog | 6 h |
| `linkedin-recent` | LinkedIn Marketing API recent changes (Markdown via `Accept: text/markdown`) | 6 h |
| `linkedin-versioning` | LinkedIn versioning and sunset page (Markdown) | 6 h |
| `meta-status` | metastatus.com `orgs.json`, developer-facing orgs only | hourly |
| `linkedin-status` | linkedin-apistatus.com (Atlassian Statuspage `summary.json`) | hourly |

The 6-hourly cron runs at minute 15 (`15 */6 * * *`) so it never coincides with
the hourly one (`0 * * * *`). The cron strings live in both `wrangler.toml` and
`CRONS` in `src/sources.ts`; keep them in sync.

`meta-status` watches the `graph-api`, `marketing-api`, `ig-messenger`,
`messenger`, `whatsapp-business-api` and `facebook-login` orgs.

TikTok's API for Business changelog is left out because it is rendered with
JavaScript (the HTML has no content). TikTok has no official status page.

## How a run works

1. **Fetch** with the honest User-Agent from `wrangler.toml` (Meta returns 400
   to a bare browser UA but 200 to this one), a 20 s timeout and a 3 MB body
   cap. Two-step sources fetch the index first and pick the page to watch.
   The snapshot's `ETag` / `Last-Modified` are sent back as `If-None-Match` /
   `If-Modified-Since`, and a 304 ends the run. None of the current sources
   send validators, so in practice step 2 does the short-circuiting.
2. **Short-circuit** if the body's SHA-256 matches the last snapshot for the
   same page URL.
3. **Parse** into entries `{key, title, text, hash}`. HTML goes through
   `HTMLRewriter` (native, so it barely touches the 10 ms CPU budget) and is
   split at headings, Markdown is split on `## `, Meta status gives one entry
   per service, and Statuspage gives the overall status plus one entry per open
   incident. Keys stay stable across harmless edits: dates become ISO, LinkedIn
   months are keyed by version number, and the "(Latest)" tag is ignored.
4. **Guard.** 0 entries, or a changelog dropping below half its previous count,
   is treated as a broken parser. The run records an error and keeps the old
   snapshot.
5. **Baseline.** The first run stores a snapshot. A changelog reports every
   entry already on the page with change type `preexisting`, so notices
   published before the watcher started (a deprecation that takes effect next
   month, say) still reach `/watch`, labelled as not newly seen. Entries that
   mention a deprecation, sunset or breaking change go first, so they get the
   AI summaries if the budget runs out. A status source reports nothing on its
   first run: its current state is mostly "operational" rows.
6. **Diff** `{key: hash}` maps into added / modified / removed. When the version
   changes (Meta v26 → v27), the old page's entries are not reported as removed.
7. **Summarise.** Added, modified and preexisting changelog entries go to
   `@cf/zai-org/glm-4.7-flash` (thinking off), falling back to
   `@cf/google/gemma-4-26b-a4b-it`. The model returns JSON with a summary,
   category (`breaking`, `deprecation`, `new`, `fix`, `docs`), versions and
   effective date, and every field is validated. At most
   `MAX_AI_CALLS_PER_RUN` (12) calls per run. Past that, or if both models give
   unusable output, the change is stored with its raw excerpt only (category
   `docs`). Removed entries and status flips (category `incident`) get a fixed
   one-line summary with no model call.
8. **Store** through the Supabase `record_watch_result()` RPC, then write the
   KV snapshot. Every run is recorded, including `unchanged` and `error` ones.
   If the store fails, the queue retries (up to 3 times, backing off 60 s per
   attempt). Rows are unique on `(source, entry_key, content_hash)`, so a retry
   never creates duplicates. Messages that exhaust their retries land in
   `watch-jobs-dlq`, whose consumer records one final `error` run and drops
   them.

## Layout

```
src/
  index.ts        fetch / scheduled / queue handlers
  sources.ts      source registry and cron → schedule map
  pipeline.ts     one run of one source
  fetch.ts        HTTP fetch, index resolution, conditional headers
  diff.ts         entry diff, baseline snapshot, parser guard
  summarize.ts    Workers AI prompt and output validation
  store.ts        Supabase RPC call (plain fetch, no SDK)
  hash.ts         SHA-256 via crypto.subtle
  text.ts         entity decoding, whitespace tidy, slugs, ISO dates
  log.ts          structured log events for Workers Logs
  types.ts        shared types
  env.d.ts        secret types (wrangler types can't see secrets)
  parsers/        html (HTMLRewriter splitter), meta, tiktok, markdown, status
scripts/probe.ts  fetch every source from Node and report or save fixtures
test/             vitest in workerd, against the fixtures in test/fixtures/
```

## Supabase

The schema is not part of this repo. It creates:

- `watch_sources`: one row per source with its latest version and health. Public read.
- `watch_changes`: the detected changes. Public read. `change_type` is
  `added`, `modified`, `removed`, `status`, or `preexisting` (on the page
  before the watcher's first run; needs `supabase/0010_watch_preexisting.sql`).
- `watch_runs`: one row per run, for debugging. No policies, so not public.
  Pruned to 30 days by `record_watch_result()`.

Nothing has a write policy. The Worker writes only through
`record_watch_result()`, which only the service role may call. Give the Worker
its own `sb_secret_…` key so revoking it touches nothing else (a legacy
`service_role` JWT also works). Titles, excerpts and summaries are copied from
third-party pages or produced by a model: render them as text, never as HTML.

## Configuration

`wrangler.toml` vars:

| Var | Default | What |
|---|---|---|
| `USER_AGENT` | `api-changelog-watcher/0.1 (+…/watch)` | Sent with every fetch |
| `MAX_AI_CALLS_PER_RUN` | `12` | AI summaries per source run |
| `ENABLE_DEBUG` | `false` | Enables `/debug/*` |
| `PORTFOLIO_REVALIDATE_URL` | `https://www.abikmaharjan.com.np/api/watch/revalidate/` | POSTed after every run that writes to Supabase (new changes or just source status), so the portfolio's cached `/watch` republishes. Keep the trailing slash |

Secrets (`wrangler secret put`, or `.dev.vars` locally):

| Secret | What |
|---|---|
| `SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `SUPABASE_WATCH_KEY` | The Worker's dedicated `sb_secret_…` key |
| `RUN_TOKEN` | Bearer token for `/run` and `/debug/*`. If unset, both refuse every request. |
| `WATCH_REVALIDATE_SECRET` | Same value as the portfolio's. Unset, no ping is sent and `/watch` catches up on its hourly timer. A failed ping is logged (`revalidate.failed`) and never retries the run. |

Without both Supabase secrets the Worker still runs, but results are only logged.

## Local development

```sh
npm install
cp .dev.vars.example .dev.vars        # leave SUPABASE_* empty to skip storing
npm test                              # parsers, diff, AI-output validation, pipeline, handlers
npm run typecheck
npm run types                         # after editing wrangler.toml
npm run probe                         # live check of every source (add -- --save to refresh fixtures)
npx wrangler dev --local --test-scheduled
```

Tests run in workerd with remote bindings off, so they never touch the real
account. The probe runs in Node, where `HTMLRewriter` doesn't exist, so it
reports a rough heading count for HTML sources; `npm test` runs the real parsers.

With `wrangler dev` running (`TOKEN` is `RUN_TOKEN` from `.dev.vars`):

```sh
curl "localhost:8787/__scheduled?cron=0+*+*+*+*"        # hourly cron → status sources
curl "localhost:8787/__scheduled?cron=15+*/6+*+*+*"     # 6 h cron → changelogs
H="Authorization: Bearer $TOKEN"
curl -X POST -H "$H" "localhost:8787/debug/parse?source=tiktok-dev"          # live parse, no state
curl -X POST -H "$H" "localhost:8787/debug/run?source=tiktok-dev&ai=0"       # full run, no AI
curl -X POST -H "$H" "localhost:8787/debug/run?source=tiktok-dev&store=0"    # full run, no Supabase write
curl -X POST -H "$H" --data-binary @edited.html "localhost:8787/debug/run?source=tiktok-dev&ai=0"
curl -X POST -H "$H" "localhost:8787/debug/snapshot?source=tiktok-dev"
curl -X POST -H "$H" "localhost:8787/debug/reset?source=tiktok-dev"
```

A non-empty POST body to `/debug/parse` or `/debug/run` is used instead of
fetching the live page, which is how you test an edited fixture.

The AI binding is marked `remote = true`, but `--local` turns off remote
bindings, so Workers AI is unavailable and runs fall back to raw excerpts.
`npm run dev` (`wrangler dev --test-scheduled`, no `--local`) uses real Workers
AI. That needs `wrangler login` and spends real (free) neurons.

## Adding a source

1. Add an entry to `SOURCES` in `src/sources.ts`.
2. If the page has a new shape, add a parser in `src/parsers/`.
3. Save a fixture with `npm run probe -- --save <id>`.
4. Add a case in `test/parsers.test.ts`.

## HTTP endpoints

These are for local dev. In production the Worker has no public URL
(`workers_dev = false`, `preview_urls = false`), so nothing below is reachable
there unless you turn the workers.dev URL on.

| Route | Auth | What |
|---|---|---|
| `GET /` | none | Lists the sources (id, platform, kind, schedule, url) |
| `POST /run?source=<id>` | `Bearer RUN_TOKEN` | Runs one source inline and returns the result |
| `POST /run?source=all` | `Bearer RUN_TOKEN` | Enqueues every source (also the default with no `source`) |
| `/debug/*` | `Bearer RUN_TOKEN` and `ENABLE_DEBUG=true` | parse, run, snapshot, reset. Answers 404 when disabled. Off in production. |

## Deploying

Deploying and creating remote resources is done by hand:

```sh
npx wrangler queues create watch-jobs
npx wrangler queues create watch-jobs-dlq
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_WATCH_KEY
npx wrangler secret put RUN_TOKEN
npx wrangler secret put WATCH_REVALIDATE_SECRET
npm run deploy                        # also provisions the WATCH_KV namespace
```

Create the Supabase schema first.

The deployed Worker has no public URL, so check it by watching the next cron:
run `npx wrangler tail`, wait for the top of the hour (status sources) or
`:15` past every 6th hour (changelogs), then look at `watch_runs` in Supabase.
To trigger a run by hand instead, set `workers_dev = true` temporarily, deploy,
`curl -X POST -H "Authorization: Bearer $RUN_TOKEN" "https://api-changelog-watcher.<subdomain>.workers.dev/run?source=meta-graph-latest"`,
then set it back to `false` and deploy again.

## Logs

Each log line is an object with a one-line `message` for people to read
(`tiktok-dev changed: 3 changes (2 added, 1 modified)`) and a fixed `event`
name plus fields for queries in Workers Logs (dashboard → Observability). The level
matches the problem: `error` for a failed run, `warn` for a retry or an AI
fallback.

| Event | When | Main fields |
|---|---|---|
| `run.done` | Every run, one line | `source`, `reason`, `attempt`, `outcome`, `stage`, `version`, `entries`, `changes`, `added`/`modified`/`removed`, `preexisting` (baseline), `ai_ok`/`ai_failed`/`ai_skipped`, `inserted`, `snapshot_written`, `duration_ms`, `error` |
| `run.store_failed` | The Supabase write failed (the run will retry) | same as `run.done`, with `error` for the store failure and `run_error` for the run's own error |
| `run.enqueued`, `cron.enqueued` | `POST /run?source=all`, or a cron fired | `sources`, `cron`, `schedule` |
| `queue.retry` | A queued run threw | `source`, `attempt`, `delay_seconds`, `error` |
| `queue.dead_letter` | Retries used up | `source`, `attempts` |
| `ai.unusable`, `ai.failed` | One model gave junk or threw (the next model is tried) | `model`, `source`, `key`, `error` |
| `cron.unknown`, `queue.unknown_source`, `queue.dead_letter_store_failed` | Should not happen | |

`stage` says where the run stopped: `not_modified` (304) and `same_body` are
the cheap exits, `done` means it parsed and diffed. On an error it names the
step that failed (`fetch`, `parse`, `guard`, …). Useful queries:
`event = "run.done" AND outcome = "error"`, and `source = "<id>"`.

## Free-plan budget

| Resource | Free limit | Expected use |
|---|---|---|
| CPU per invocation | 10 ms | One source per invocation. Parsing a 170 KB Meta page is a few ms. Check p99 in the dashboard after deploying. |
| Cron triggers | 5 per account | 2 |
| Queue operations | 10,000/day | 72 messages/day ≈ 216 ops |
| KV writes | 1,000/day | ≤ 72/day (only when a body changes) |
| Workers AI | 10,000 neurons/day | ~26 per summary; 0 on quiet days |

## License

MIT for the code. The files in `test/fixtures/` are trimmed excerpts of the
public Meta, TikTok and LinkedIn pages, kept only to test the parsers; their
content belongs to those companies.
