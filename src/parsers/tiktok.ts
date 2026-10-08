import { entryHash } from "../hash";
import { MAX_ENTRY_TEXT, parseLooseDate, slug, truncate, uniqueKeys } from "../text";
import type { Parsed } from "../types";
import { splitHtml } from "./html";

/**
 * T1: entries are `<h2 id="august-25-2026">August 25, 2026</h2>` inside the
 * article. The ids are inconsistent (`june_4,_2026`), so the key is the ISO
 * date read from the heading text, falling back to the id.
 */
export async function parseTikTokChangelog(html: string, pageUrl: string): Promise<Parsed> {
  const { sections } = await splitHtml(html, {
    start: "article",
    headings: "h2",
    skip: "a.anchor-link",
  });
  const base = pageUrl.split("#")[0];
  const items = sections.map((s) => {
    const title = s.path[s.path.length - 1] ?? "";
    const date = parseLooseDate(title) ?? (s.id ? parseLooseDate(s.id.replace(/-/g, " ")) : null);
    return {
      key: date ?? slug(s.id ?? title),
      title,
      text: truncate(s.body, MAX_ENTRY_TEXT),
      url: s.id ? `${base}#${encodeURIComponent(s.id)}` : base,
    };
  });
  uniqueKeys(items);
  const entries = await Promise.all(items.map(async (e) => ({ ...e, hash: await entryHash(e.title, e.text) })));
  return { entries };
}
