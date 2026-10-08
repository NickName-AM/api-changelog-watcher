import { describe, expect, it } from "vitest";
import { diffEntries, guard, isEmpty, toSnapshot } from "../src/diff";
import { entryHash } from "../src/hash";
import type { Entry } from "../src/types";

async function entry(key: string, text: string): Promise<Entry> {
  return { key, title: key.toUpperCase(), text, hash: await entryHash(key.toUpperCase(), text) };
}

async function snap(entries: Entry[], version?: string) {
  return toSnapshot(entries, { pageUrl: "https://example.com", bodyHash: "x", version });
}

describe("diffEntries", () => {
  it("finds nothing when entries are identical", async () => {
    const e = [await entry("a", "1"), await entry("b", "2")];
    expect(isEmpty(diffEntries(await snap(e), e, false))).toBe(true);
  });

  it("classifies added, modified and removed", async () => {
    const prev = await snap([await entry("a", "1"), await entry("b", "2"), await entry("c", "3")]);
    const next = [await entry("a", "1"), await entry("b", "2 edited"), await entry("d", "4")];
    const d = diffEntries(prev, next, false);
    expect(d.added.map((c) => c.key)).toEqual(["d"]);
    expect(d.modified.map((c) => c.key)).toEqual(["b"]);
    expect(d.modified[0]!.oldText).toBe("2");
    expect(d.modified[0]!.newText).toBe("2 edited");
    expect(d.removed.map((c) => c.key)).toEqual(["c"]);
    expect(d.removed[0]!.contentHash).toMatch(/^removed:/);
  });

  it("does not report the old version's entries as removed after a version bump", async () => {
    const prev = await snap([await entry("old-1", "x"), await entry("old-2", "y")], "v26.0");
    const d = diffEntries(prev, [await entry("new-1", "z")], true);
    expect(d.added).toHaveLength(1);
    expect(d.removed).toHaveLength(0);
  });

  it("gives a re-edit back to old text the same content hash as the original", async () => {
    const a1 = await entry("a", "1");
    const a2 = await entry("a", "2");
    const d1 = diffEntries(await snap([a1]), [a2], false);
    const d2 = diffEntries(await snap([a2]), [a1], false);
    expect(d2.modified[0]!.contentHash).toBe(a1.hash);
    expect(d1.modified[0]!.contentHash).toBe(a2.hash);
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
