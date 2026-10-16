// Tells the portfolio to republish /watch after a run wrote to Supabase.
// Its pages are prerendered and cached; without this they only catch up on
// their own hourly timer, which runs on a different clock from our crons.
// See ../portfolio/app/api/watch/revalidate/route.ts for the other side.
//
// Best-effort by design: the rows are already in Supabase, so a failed ping
// costs freshness, not data. It is logged and never thrown -- throwing here
// would make the queue retry a run that succeeded.

import { brief, errorFields, log } from "./log";

export async function revalidatePortfolio(env: Env, sourceId: string, inserted: number): Promise<void> {
  const url = env.PORTFOLIO_REVALIDATE_URL?.trim();
  const secret = env.WATCH_REVALIDATE_SECRET?.trim();
  // Either one unset means "not wired up", e.g. local dev or tests.
  if (!url || !secret) return;

  const fields = { source: sourceId, inserted };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      log.warn("revalidate.failed", `${sourceId}: portfolio revalidate → ${res.status}`, { ...fields, status: res.status });
      return;
    }
    log.info("revalidate.done", `${sourceId}: portfolio /watch revalidated`, fields);
  } catch (err) {
    log.warn("revalidate.failed", `${sourceId}: portfolio revalidate failed: ${brief(err)}`, { ...fields, ...errorFields(err) });
  }
}
