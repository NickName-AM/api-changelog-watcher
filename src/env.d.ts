// Secrets are not in wrangler.toml, so `wrangler types` can't see them.
// Set them with `wrangler secret put`, or in .dev.vars for local dev.

interface WatchSecrets {
  SUPABASE_URL?: string;
  SUPABASE_WATCH_KEY?: string;
  RUN_TOKEN?: string;
  /** Shared with the portfolio; see src/revalidate.ts. */
  WATCH_REVALIDATE_SECRET?: string;
}

interface Env extends WatchSecrets {}

declare namespace Cloudflare {
  interface Env extends WatchSecrets {}
}
