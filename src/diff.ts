// F6/F7/F8: entry-level diff, baseline and the parser-broken guard.
// Compares {key: hash} maps, so it is O(entries) and never diffs text.

import type { Change, Entry, Snapshot, SourceKind } from "./types";

export interface DiffResult {
  added: Change[];
  modified: Change[];
  removed: Change[];
}

export function isEmpty(d: DiffResult): boolean {
  return d.added.length + d.modified.length + d.removed.length === 0;
}

/**
 * @param versionChanged the page now describes a different version (Meta
 *   v26 → v27), so the old page's entries disappearing is expected and is not
 *   reported as "removed".
 */
export function diffEntries(prev: Snapshot, entries: Entry[], versionChanged: boolean): DiffResult {
  const result: DiffResult = { added: [], modified: [], removed: [] };
  const seen = new Set<string>();

  for (const e of entries) {
    seen.add(e.key);
    const old = prev.entries[e.key];
    if (!old) {
      result.added.push({ key: e.key, title: e.title, url: e.url, diffType: "added", newText: e.text, contentHash: e.hash });
    } else if (old.hash !== e.hash) {
      result.modified.push({
        key: e.key,
        title: e.title,
        url: e.url,
        diffType: "modified",
        newText: e.text,
        oldText: old.text,
        contentHash: e.hash,
      });
    }
  }

  if (!versionChanged) {
    for (const [key, old] of Object.entries(prev.entries)) {
      if (seen.has(key)) continue;
      result.removed.push({
        key,
        title: old.title,
        url: old.url,
        diffType: "removed",
        oldText: old.text,
        contentHash: `removed:${old.hash}`,
      });
    }
  }
  return result;
}

/**
 * F8. A page that suddenly parses to nothing, or to less than half of last
 * time, almost always means the markup changed under the parser, not that the
 * platform deleted its changelog. Returns an error message, or null if fine.
 */
export function guard(kind: SourceKind, prev: Snapshot | null, count: number, versionChanged: boolean): string | null {
  if (count === 0) return "parser guard: page parsed to 0 entries";
  if (kind === "changelog" && prev && !versionChanged && count < prev.count / 2) {
    return `parser guard: entry count fell from ${prev.count} to ${count}`;
  }
  return null;
}

export function toSnapshot(
  entries: Entry[],
  meta: { pageUrl: string; bodyHash: string; etag?: string; lastModified?: string; version?: string },
): Snapshot {
  const map: Snapshot["entries"] = {};
  for (const e of entries) map[e.key] = { hash: e.hash, title: e.title, text: e.text, url: e.url };
  return {
    v: 1,
    savedAt: new Date().toISOString(),
    pageUrl: meta.pageUrl,
    etag: meta.etag,
    lastModified: meta.lastModified,
    bodyHash: meta.bodyHash,
    version: meta.version,
    count: entries.length,
    entries: map,
  };
}
