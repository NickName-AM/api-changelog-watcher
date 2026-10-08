import { entryHash } from "../hash";
import { decodeEntities, MAX_ENTRY_TEXT, parseLooseDate, slug, tidy, truncate, uniqueKeys } from "../text";
import type { Entry, Parsed } from "../types";

export interface MdSection {
  heading: string;
  body: string;
}

/** Strip a leading `---` YAML front-matter block (Microsoft Learn sends one). */
export function stripFrontMatter(md: string): { front: string; body: string } {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(md.replace(/\r\n?/g, "\n"));
  return m ? { front: m[1]!, body: md.slice(m[0].length) } : { front: "", body: md };
}

/**
 * Split on `## ` headings. Text before the first one (minus the `# ` title)
 * becomes a section with an empty heading: on Learn pages that is where the
 * deprecation warning lives, so it is worth watching.
 */
export function splitMarkdown(md: string): MdSection[] {
  // A Markdown source answering with an HTML page means content negotiation
  // stopped working; fail loudly rather than diff a page of markup.
  if (/^\s*<(!doctype|html)/i.test(md)) throw new Error("expected Markdown, got HTML");
  const { body } = stripFrontMatter(md);
  const out: MdSection[] = [];
  let heading = "";
  let buf: string[] = [];
  let inFence = false;
  const push = () => {
    const text = tidy(decodeEntities(buf.join("\n")));
    if (text) out.push({ heading, body: text });
  };
  for (const line of body.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    if (!inFence && line.startsWith("## ")) {
      push();
      heading = tidy(decodeEntities(line.slice(3)));
      buf = [];
    } else if (!inFence && /^# /.test(line) && !heading) {
      // Page title; not content.
    } else {
      buf.push(line);
    }
  }
  push();
  return out;
}

async function toEntries(items: Omit<Entry, "hash">[]): Promise<Entry[]> {
  uniqueKeys(items);
  return Promise.all(items.map(async (e) => ({ ...e, hash: await entryHash(e.title, e.text) })));
}

/**
 * L1: `## September 2026 - Version 202609 (Latest)`. The key is the version
 * number, so the "(Latest)" tag moving to next month's heading is not a change.
 */
export async function parseLinkedInRecentChanges(md: string, pageUrl: string): Promise<Parsed> {
  const sections = splitMarkdown(md);
  let latest: string | undefined;
  const items = sections.map((s) => {
    const title = s.heading.replace(/\s*\(latest\)\s*$/i, "").trim() || "Notice";
    const vm = /version\s+(\d{6})/i.exec(title);
    if (vm && (!latest || vm[1]! > latest)) latest = vm[1];
    return {
      key: vm ? `version-${vm[1]}` : s.heading ? slug(title) : "notice",
      title,
      text: truncate(s.body, MAX_ENTRY_TEXT),
      url: pageUrl,
    };
  });
  return { entries: await toEntries(items), version: latest };
}

/** L2 and M4: generic `## ` sections; date headings (`## 05/04/2026`) get ISO keys. */
export async function parseMarkdownSections(md: string, pageUrl: string): Promise<Parsed> {
  const items = splitMarkdown(md).map((s) => {
    // The text before the first heading is "intro", so it can't collide with a real "## Overview".
    const title = s.heading || "Intro";
    const date = s.heading ? parseLooseDate(s.heading) : null;
    return {
      key: date ?? (s.heading ? slug(s.heading) : "intro"),
      title,
      text: truncate(s.body, MAX_ENTRY_TEXT),
      url: pageUrl,
    };
  });
  return { entries: await toEntries(items) };
}
