// Step 4 tests, against the Worker's real (local, per-test) KV.
// AI and Supabase are switched off; those are exercised by hand (see README).

import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { runSource, snapshotKey } from "../src/pipeline";
import { getSource } from "../src/sources";
import type { Snapshot } from "../src/types";
import tiktok from "./fixtures/tiktok-dev.html?raw";
import metaStatus from "./fixtures/meta-status.json?raw";
import linkedinRecent from "./fixtures/linkedin-recent.md?raw";

const OFFLINE = { ai: false, store: false } as const;
const src = getSource("tiktok-dev")!;

describe("runSource", () => {
  it("baseline → unchanged → one modified → guard error", async () => {
    const first = await runSource(env, src, { ...OFFLINE, body: tiktok });
    expect(first.outcome).toBe("baseline");
    expect(first.changes).toHaveLength(0);
    const snap = await env.WATCH_KV.get<Snapshot>(snapshotKey(src.id), "json");
    expect(snap?.count).toBe(first.entryCount);

    const second = await runSource(env, src, { ...OFFLINE, body: tiktok });
    expect(second.outcome).toBe("unchanged");

    const edited = tiktok.replace(
      "Incorporated additional information about Login Kit",
      "Incorporated much more information about Login Kit",
    );
    expect(edited).not.toBe(tiktok);
    const third = await runSource(env, src, { ...OFFLINE, body: edited });
    expect(third.outcome).toBe("changed");
    expect(third.changes).toHaveLength(1);
    expect(third.changes[0]).toMatchObject({
      entry_key: "2026-08-25",
      change_type: "modified",
      summary: null, // AI off → raw excerpt only
      category: "docs",
    });
    expect(third.changes[0]!.excerpt).toContain("much more information");

    const before = await env.WATCH_KV.get(snapshotKey(src.id));
    const broken = await runSource(env, src, { ...OFFLINE, body: "<html><body>maintenance</body></html>" });
    expect(broken.outcome).toBe("error");
    expect(broken.error).toMatch(/parser guard/);
    expect(await env.WATCH_KV.get(snapshotKey(src.id))).toBe(before);
  });

  it("reports a status flip with a deterministic summary", async () => {
    const status = getSource("meta-status")!;
    await runSource(env, status, { ...OFFLINE, body: metaStatus });
    const orgs = JSON.parse(metaStatus) as { id: string; services: { status: string }[] }[];
    orgs.find((o) => o.id === "graph-api")!.services[0]!.status = "Major disruption";
    const run = await runSource(env, status, { ...OFFLINE, body: JSON.stringify(orgs) });
    expect(run.outcome).toBe("changed");
    expect(run.changes).toHaveLength(1);
    expect(run.changes[0]).toMatchObject({ change_type: "status", category: "incident" });
    expect(run.changes[0]!.summary).toMatch(/to "Major disruption"/);
  });

  it("diffs a new LinkedIn month as one added section, not a new page", async () => {
    const linkedin = getSource("linkedin-recent")!;
    const first = await runSource(env, linkedin, { ...OFFLINE, body: linkedinRecent });
    expect(first.outcome).toBe("baseline");
    const next = linkedinRecent
      .replace(/\s*\(Latest\)/i, "")
      .replace("## September 2026", "## December 2099 - Version 209912 (Latest)\n\nA new month.\n\n## September 2026");
    const run = await runSource(env, linkedin, { ...OFFLINE, body: next });
    expect(run.version).toBe("209912");
    expect(run.changes).toHaveLength(1);
    expect(run.changes[0]).toMatchObject({ entry_key: "version-209912", change_type: "added" });
  });
});
