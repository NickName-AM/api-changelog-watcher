// Body extractors (SourceDef.extract). Plain indexOf/slice, so they cost
// almost nothing, and the HTML parser then sees ~10x less input.

/**
 * The slice from the first `start` to the tag containing the first `end` after
 * it. Returns the whole body if either marker is missing, so a markup change
 * still reaches the parser and trips the guard instead of failing silently.
 */
export function sliceBetween(body: string, start: string, end: string, endInclusive = false): string {
  const s = body.indexOf(start);
  if (s < 0) return body;
  const e = body.indexOf(end, s);
  if (e < 0) return body;
  const stop = endInclusive ? e + end.length : body.lastIndexOf("<", e);
  return body.slice(s, stop > s ? stop : e);
}

/**
 * Meta docs pages: from the <h1> to the toolbar after the article. Facebook's
 * outbound-link redirector (l.facebook.com/l.php?u=...&h=<token>) gets a fresh
 * token on every request; keep only the destination so the body hash is stable.
 */
export function extractMetaArticle(body: string): string {
  return sliceBetween(body, "<h1", 'id="developer_documentation_toolbar"').replace(
    /(https:\/\/l\.facebook\.com\/l\.php\?u=[^&"]*)[^"]*/g,
    "$1",
  );
}

/** TikTok: just the <article> element. */
export function extractArticle(body: string): string {
  return sliceBetween(body, "<article", "</article>", true);
}
