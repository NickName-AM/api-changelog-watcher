import { describe, expect, it } from "vitest";
import { diffEntries, guard, isEmpty, toSnapshot } from "../src/diff";
import { entryHash } from "../src/hash";
import type { Entry } from "../src/types";

async function entry(key: string, text: string): Promise<Entry> {
  return { key, title: key.toUpperCase(), text, hash: await entryHash(key.toUpperCase(), text) };
}

async function snap(entries: Entry[], version?: string, savedAt?: string) {
  const s = toSnapshot(entries, { pageUrl: "https://example.com", bodyHash: "x", version });
  return savedAt ? { ...s, savedAt } : s;
}

/** Feed `texts` to one entry in turn, one snapshot per run, and collect each change's hash. */
async function transitions(texts: string[]): Promise<string[]> {
  const hashes: string[] = [];
  let prev = await snap([await entry("a", texts[0]!)], undefined, "2026-01-01T00:00:00.000Z");
  for (let i = 1; i < texts.length; i++) {
    const next = [await entry("a", texts[i]!)];
    const d = await diffEntries(prev, next, false);
    hashes.push(...d.modified.map((c) => c.contentHash));
    prev = await snap(next, undefined, `2026-01-01T0${i}:00:00.000Z`);
  }
  return hashes;
}

describe("diffEntries", () => {
  it("finds nothing when entries are identical", async () => {
    const e = [await entry("a", "1"), await entry("b", "2")];
    expect(isEmpty(await diffEntries(await snap(e), e, false))).toBe(true);
  });

  it("classifies added, modified and removed", async () => {
    const prev = await snap([await entry("a", "1"), await entry("b", "2"), await entry("c", "3")]);
    const next = [await entry("a", "1"), await entry("b", "2 edited"), await entry("d", "4")];
    const d = await diffEntries(prev, next, false);
    expect(d.added.map((c) => c.key)).toEqual(["d"]);
    expect(d.modified.map((c) => c.key)).toEqual(["b"]);
    expect(d.modified[0]!.oldText).toBe("2");
    expect(d.modified[0]!.newText).toBe("2 edited");
    expect(d.removed.map((c) => c.key)).toEqual(["c"]);
    expect(d.removed[0]!.contentHash).toMatch(/^[0-9a-f]{32}$/);
  });

  it("does not report the old version's entries as removed after a version bump", async () => {
    const prev = await snap([await entry("old-1", "x"), await entry("old-2", "y")], "v26.0");
    const d = await diffEntries(prev, [await entry("new-1", "z")], true);
    expect(d.added).toHaveLength(1);
    expect(d.removed).toHaveLength(0);
  });

  it("gives a status that flips 4 times 4 distinct hashes", async () => {
    const hashes = await transitions(["ok", "down", "ok", "down", "ok"]);
    expect(hashes).toHaveLength(4);
    expect(new Set(hashes).size).toBe(4);
  });

  it("gives a revert A → B → A its own row instead of colliding with an earlier one", async () => {
    const [toB, backToA] = await transitions(["A", "B", "A"]);
    expect(backToA).not.toBe(toB);
    // The revert's hash is not the entry hash of A, so it can't hit a row stored for A earlier.
    expect(backToA).not.toBe((await entry("a", "A")).hash);
  });

  it("gives repeated removals and re-additions distinct hashes", async () => {
    const a = await entry("a", "1");
    const b = await entry("b", "2");
    const removed1 = (await diffEntries(await snap([a, b], undefined, "2026-01-01T00:00:00.000Z"), [b], false)).removed;
    const added = (await diffEntries(await snap([b], undefined, "2026-01-01T01:00:00.000Z"), [a, b], false)).added;
    const removed2 = (await diffEntries(await snap([a, b], undefined, "2026-01-01T02:00:00.000Z"), [b], false)).removed;
    const all = [removed1[0]!.contentHash, added[0]!.contentHash, removed2[0]!.contentHash];
    expect(new Set(all).size).toBe(3);
  });

  it("is deterministic: diffing the same prev and next twice (a retry) gives identical hashes", async () => {
    const prev = await snap([await entry("a", "1"), await entry("b", "2"), await entry("c", "3")]);
    const next = [await entry("a", "1"), await entry("b", "2 edited"), await entry("d", "4")];
    const hashes = async () => {
      const d = await diffEntries(prev, next, false);
      return [...d.added, ...d.modified, ...d.removed].map((c) => [c.key, c.contentHash]);
    };
    const first = await hashes();
    expect(first).toHaveLength(3);
    expect(await hashes()).toEqual(first);
  });
});

describe("guard", () => {
  it("rejects zero entries", () => {
    expect(guard("changelog", null, 0, false)).toMatch(/0 entries/);
    expect(guard("status", null, 0, false)).toMatch(/0 entries/);
  });

  it("rejects a more-than-half drop for changelogs only", async () => {
    const prev = await snap(await Promise.all(["a", "b", "c", "d", "e"].map((k) => entry(k, k))));
    expect(guard("changelog", prev, 2, false)).toMatch(/fell from 5 to 2/);
    expect(guard("changelog", prev, 3, false)).toBeNull();
    expect(guard("changelog", prev, 2, true)).toBeNull();
    expect(guard("status", prev, 1, false)).toBeNull();
  });
});
