// Secrets are not in wrangler.toml, so `wrangler types` can't see them.
// Set them with `wrangler secret put`, or in .dev.vars for local dev.

interface WatchSecrets {
  SUPABASE_URL?: string;
  SUPABASE_WATCH_KEY?: string;
  RUN_TOKEN?: string;
}

interface Env extends WatchSecrets {}

declare namespace Cloudflare {
  interface Env extends WatchSecrets {}
}
