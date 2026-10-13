// F6/F7/F8: entry-level diff, baseline and the parser-broken guard.
// Compares {key: hash} maps, so it is O(entries) and never diffs text.

import { sha256 } from "./hash";
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
 * Identifies one transition of one entry, not just its new state, so a status
 * that flips back to a value it had before (or a revert, or a second removal)
 * is a new row instead of colliding with the earlier one on the unique
 * (source, entry_key, content_hash) constraint. The previous snapshot pins it
 * to this run: a retry diffs against the same snapshot (it is only replaced
 * after the store succeeds), so it gets the same hash and is still deduped.
 */
export async function transitionHash(
  prev: Snapshot,
  key: string,
  diffType: Change["diffType"],
  oldHash: string | undefined,
  newHash: string | undefined,
): Promise<string> {
  const parts = [prev.savedAt, prev.bodyHash, key, diffType, oldHash ?? "none", newHash ?? "none"];
  return (await sha256(parts.join("\n"))).slice(0, 32);
}

/**
 * @param versionChanged the page now describes a different version (Meta
 *   v26 → v27). Every entry is reported as added, because matching v27's
 *   sections to v26's by key would describe the gap between the two versions,
 *   and the old page's entries disappearing is not reported as "removed".
 */
export async function diffEntries(prev: Snapshot, entries: Entry[], versionChanged: boolean): Promise<DiffResult> {
  const result: DiffResult = { added: [], modified: [], removed: [] };
  const seen = new Set<string>();

  for (const e of entries) {
    seen.add(e.key);
    const old = versionChanged ? undefined : prev.entries[e.key];
    if (!old) {
      result.added.push({
        key: e.key,
        title: e.title,
        url: e.url,
        diffType: "added",
        newText: e.text,
        contentHash: await transitionHash(prev, e.key, "added", undefined, e.hash),
      });
    } else if (old.hash !== e.hash) {
      result.modified.push({
        key: e.key,
        title: e.title,
        url: e.url,
        diffType: "modified",
        newText: e.text,
        oldText: old.text,
        contentHash: await transitionHash(prev, e.key, "modified", old.hash, e.hash),
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
        contentHash: await transitionHash(prev, key, "removed", old.hash, undefined),
      });
    }
  }
  return result;
}

/** Wording that means "something will stop working", checked on baseline entries. */
const NOTICE_RE = /deprecat|sunset|breaking|end[- ]of[- ]life|will be (?:removed|retired|disabled)|no longer (?:be )?(?:supported|available)/i;

/**
 * F7. The first run of a changelog reports every entry already on the page as
 * "preexisting", so notices published before the watcher started (Meta v26.0's
 * deprecations, say) still reach the feed, labelled as not newly seen.
 *
 * Entries that read like a deprecation or breaking change come first, page
 * order otherwise, so they get the AI summaries when MAX_AI_CALLS_PER_RUN runs
 * out. There is no previous snapshot to pin the hash to, so it is derived from
 * the entry alone: a retry, or a re-baseline after a reset, of the same entry
 * dedupes instead of adding a second row.
 */
export async function baselineChanges(entries: Entry[]): Promise<Change[]> {
  const changes: Change[] = [];
  for (const e of entries) {
    changes.push({
      key: e.key,
      title: e.title,
      url: e.url,
      diffType: "preexisting",
      newText: e.text,
      contentHash: (await sha256(["preexisting", e.key, e.hash].join("\n"))).slice(0, 32),
    });
  }
  const notice = (c: Change) => NOTICE_RE.test(`${c.title}\n${c.newText}`);
  return [...changes.filter(notice), ...changes.filter((c) => !notice(c))];
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
