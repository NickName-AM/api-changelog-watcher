import type { Snapshot, SourceDef } from "./types";

export interface Fetched {
  pageUrl: string;
  notModified: boolean;
  body: string;
  etag?: string;
  lastModified?: string;
}

const TIMEOUT_MS = 20_000;
/** Biggest page we expect is ~240 KB; anything far beyond that is not a changelog. */
const MAX_BODY_BYTES = 3_000_000;

async function get(url: string, userAgent: string, accept: string, extra: Record<string, string> = {}): Promise<Response> {
  // An honest User-Agent, never a spoofed browser one.
  // Meta answers 400 to a bare Chrome UA but 200 to this.
  return fetch(url, {
    headers: { "User-Agent": userAgent, Accept: accept, ...extra },
    redirect: "follow",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}

async function readBody(res: Response, url: string): Promise<string> {
  const len = Number(res.headers.get("content-length") ?? 0);
  if (len > MAX_BODY_BYTES) throw new Error(`GET ${url}: body too large (${len} bytes)`);
  const text = await res.text();
  if (text.length > MAX_BODY_BYTES) throw new Error(`GET ${url}: body too large (${text.length} chars)`);
  return text;
}

/**
 * Fetch a source's page, resolving two-step sources first. Sends
 * If-None-Match / If-Modified-Since when the snapshot has them for the same
 * URL (none of today's sources send validators, but it costs nothing).
 */
export async function fetchSource(src: SourceDef, userAgent: string, prev: Snapshot | null): Promise<Fetched> {
  const accept = src.accept ?? "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5";
  let pageUrl = src.url;
  if (src.resolve) {
    const idx = await get(src.url, userAgent, accept);
    if (!idx.ok) throw new Error(`GET ${src.url} → ${idx.status}`);
    pageUrl = src.resolve(await readBody(idx, src.url));
  }

  const cond: Record<string, string> = {};
  if (prev && prev.pageUrl === pageUrl) {
    if (prev.etag) cond["If-None-Match"] = prev.etag;
    if (prev.lastModified) cond["If-Modified-Since"] = prev.lastModified;
  }

  const res = await get(pageUrl, userAgent, accept, cond);
  if (res.status === 304) return { pageUrl, notModified: true, body: "" };
  if (!res.ok) throw new Error(`GET ${pageUrl} → ${res.status}`);
  return {
    pageUrl,
    notModified: false,
    body: await readBody(res, pageUrl),
    etag: res.headers.get("etag") ?? undefined,
    lastModified: res.headers.get("last-modified") ?? undefined,
  };
}
