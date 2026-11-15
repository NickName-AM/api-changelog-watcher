import { entryHash } from "../hash";
import { MAX_ENTRY_TEXT, parseLooseDate, slug, truncate, uniqueKeys } from "../text";
import type { Entry, Parsed } from "../types";
import { splitHtml, type Section } from "./html";
import { splitMarkdownTree } from "./markdown";

const META_ORIGIN = "https://developers.facebook.com";

/**
 * M1: the changelog index only tells us the newest `versionNN.N` page.
 * Since Nov 2026 the index redirects to /documentation/development/graph-api/changelog
 * and answers with text/markdown linking to that path. Only versions that predate the
 * move redirect from /docs/, so we return the newest link exactly as the index gives it.
 */
export function resolveLatestGraphVersion(indexBody: string): string {
  let best: { v: [number, number]; path: string } | null = null;
  const re = /\/(?:docs|documentation\/[\w-]+)\/graph-api\/changelog\/version(\d+)\.(\d+)/g;
  for (const m of indexBody.matchAll(re)) {
    const v: [number, number] = [Number(m[1]), Number(m[2])];
    if (!best || v[0] > best.v[0] || (v[0] === best.v[0] && v[1] > best.v[1])) best = { v, path: m[0] };
  }
  if (!best) throw new Error("Meta changelog index: no versionNN.N link found");
  return META_ORIGIN + best.path;
}

/**
 * M3: the out-of-cycle index is a table of links, newest year first. Since 2024
 * each year is one page with a section per date, so we watch the newest one.
 */
export function resolveLatestOutOfCyclePage(indexHtml: string): string {
  const from = Math.max(0, indexHtml.indexOf("<h1"));
  const re = /href="(\/docs\/graph-api\/changelog\/(?:non-versioned-changes|out-of-cycle-changes|ooc-changes)\/[^"#?]+)/g;
  re.lastIndex = from;
  const m = re.exec(indexHtml);
  if (!m) throw new Error("Meta out-of-cycle index: no change page link found");
  return META_ORIGIN + m[1]!.replace(/\/$/, "");
}

async function sectionsToEntries(
  sections: Section[],
  pageUrl: string,
  keyPath: (s: Section) => string[] = (s) => s.path,
): Promise<Entry[]> {
  const items = sections.map((s) => ({
    key: slug(keyPath(s).join(" / ")),
    title: s.path.join(" › "),
    text: truncate(s.body, MAX_ENTRY_TEXT),
    url: pageUrl,
  }));
  uniqueKeys(items);
  return Promise.all(items.map(async (e) => ({ ...e, hash: await entryHash(e.title, e.text) })));
}

const META_PAGE = {
  start: "h1",
  // The toolbar and footer that follow the article body.
  stop: "#developer_documentation_toolbar, #devsite_footer",
};

/**
 * M2: one entry per h2/h3/h4 section of the newest version's changelog.
 * Since Oct 2026 the version pages redirect to /documentation/... and answer
 * with text/markdown; both shapes give the same heading paths, so keys match.
 */
export async function parseMetaVersionPage(body: string, pageUrl: string): Promise<Parsed> {
  const isHtml = /<h1[\s>]/i.test(body);
  const { h1, sections } = isHtml
    ? await splitHtml(body, { ...META_PAGE, headings: "h2, h3, h4" })
    : (({ title, sections }) => ({ h1: title, sections }))(splitMarkdownTree(body, 4));
  const vm = /version\s+(\d+\.\d+)/i.exec(h1) ?? /version(\d+\.\d+)/.exec(pageUrl);
  return { entries: await sectionsToEntries(sections, pageUrl), version: vm ? `v${vm[1]}` : undefined };
}

/** M3 year page: h2 is the date, h3 the change. Keys lead with the ISO date when there is one. */
export async function parseMetaOutOfCyclePage(html: string, pageUrl: string): Promise<Parsed> {
  const { h1, sections } = await splitHtml(html, { ...META_PAGE, headings: "h2, h3" });
  const keyPath = (s: Section) => {
    const date = s.path[0] ? parseLooseDate(s.path[0]) : null;
    return date ? [date, ...s.path.slice(1)] : s.path;
  };
  const ym = /\b(20\d\d)\b/.exec(h1);
  const page = pageUrl.split("/").pop();
  return { entries: await sectionsToEntries(sections, pageUrl, keyPath), version: ym?.[1] ?? page };
}
