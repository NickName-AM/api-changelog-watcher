import { describe, expect, it } from "vitest";
import { getSource } from "../src/sources";
import type { Parsed } from "../src/types";
import linkedinRecent from "./fixtures/linkedin-recent.md?raw";
import linkedinStatus from "./fixtures/linkedin-status.json?raw";
import linkedinVersioning from "./fixtures/linkedin-versioning.md?raw";
import metaLatest from "./fixtures/meta-graph-latest.html?raw";
import metaOoc from "./fixtures/meta-graph-ooc.html?raw";
import metaMarketing from "./fixtures/meta-marketing.md?raw";
import metaStatus from "./fixtures/meta-status.json?raw";
import tiktok from "./fixtures/tiktok-dev.html?raw";

const PAGE_URLS: Record<string, string> = {
  "meta-graph-latest": "https://developers.facebook.com/docs/graph-api/changelog/version26.0",
  "meta-graph-ooc": "https://developers.facebook.com/docs/graph-api/changelog/non-versioned-changes/nvc-2025",
};

async function parse(id: string, body: string): Promise<Parsed> {
  const src = getSource(id)!;
  return src.parse(body, PAGE_URLS[id] ?? src.url);
}

const CASES: [id: string, body: string, min: number][] = [
  ["meta-graph-latest", metaLatest, 10],
  ["meta-graph-ooc", metaOoc, 2],
  ["meta-marketing", metaMarketing, 2],
  ["tiktok-dev", tiktok, 8],
  ["linkedin-recent", linkedinRecent, 5],
  ["linkedin-versioning", linkedinVersioning, 5],
  ["meta-status", metaStatus, 6],
  ["linkedin-status", linkedinStatus, 1],
];

describe.each(CASES)("%s fixture", (id, body, min) => {
  it("parses to a sensible number of entries with unique keys", async () => {
    const { entries } = await parse(id, body);
    expect(entries.length).toBeGreaterThanOrEqual(min);
    expect(new Set(entries.map((e) => e.key)).size).toBe(entries.length);
    for (const e of entries) {
      expect(e.key).toMatch(/\S/);
      expect(e.title).toMatch(/\S/);
      expect(e.text).toMatch(/\S/);
      expect(e.hash).toMatch(/^[0-9a-f]{32}$/);
    }
  });

  it("is deterministic", async () => {
    const a = await parse(id, body);
    const b = await parse(id, body);
    expect(b.entries.map((e) => [e.key, e.hash])).toEqual(a.entries.map((e) => [e.key, e.hash]));
    expect(b.version).toBe(a.version);
  });
});

describe("Meta", () => {
  it("reads the version and splits on h2/h3/h4 sections", async () => {
    const { entries, version } = await parse("meta-graph-latest", metaLatest);
    expect(version).toBe("v26.0");
    const keys = entries.map((e) => e.key);
    expect(keys).toContain("graph-api-commerce-order-management-api-commerce-order-management-api-deprecation");
    expect(keys).toContain("api-version-deprecations");
    const dep = entries.find((e) => e.key.endsWith("commerce-order-management-api-deprecation"))!;
    expect(dep.title).toBe("Graph API › Commerce Order Management API › Commerce Order Management API deprecation");
    // Entities are decoded and list items survive as lines.
    expect(dep.text).toContain("- GET /{commerce-order-id}");
    expect(dep.text).toContain("Applies to v26.0+");
    // Nothing from the scripts and tracking pixels after the article.
    expect(entries.some((e) => e.text.includes("fbq("))).toBe(false);
  });

  it("keys out-of-cycle notes by ISO date", async () => {
    const { entries, version } = await parse("meta-graph-ooc", metaOoc);
    expect(version).toBe("2025");
    expect(entries.map((e) => e.key)).toContain("2025-04-08-meta-oembed-read-feature");
    expect(entries[0]!.title.startsWith("April 8, 2025 › ")).toBe(true);
  });

  it("resolves the newest Graph API version from the index", async () => {
    const { resolveLatestGraphVersion } = await import("../src/parsers/meta");
    const html = '<a href="/docs/graph-api/changelog/version9.0">x</a><a href="/docs/graph-api/changelog/version26.0">y</a><a href="/docs/graph-api/changelog/version25.0">z</a>';
    expect(resolveLatestGraphVersion(html)).toBe("https://developers.facebook.com/docs/graph-api/changelog/version26.0");
  });

  it("keys Marketing API sections by ISO date", async () => {
    const { entries } = await parse("meta-marketing", metaMarketing);
    expect(entries.map((e) => e.key)).toEqual(expect.arrayContaining(["intro", "2026-05-04", "available-marketing-api-versions"]));
    expect(entries.find((e) => e.key === "2026-05-04")!.text).toContain('"Ads Management Standard Access"');
  });
});

describe("TikTok", () => {
  it("normalises inconsistent heading ids to ISO dates", async () => {
    const { entries } = await parse("tiktok-dev", tiktok);
    const keys = entries.map((e) => e.key);
    expect(keys).toContain("2026-08-25");
    expect(keys).toContain("2026-06-04"); // id="june_4,_2026"
    const e = entries.find((x) => x.key === "2026-08-25")!;
    expect(e.title).toBe("August 25, 2026");
    expect(e.text).toContain("Data Portability API");
    expect(e.text.startsWith("#")).toBe(false);
    expect(e.url).toBe("https://developers.tiktok.com/doc/changelog#august-25-2026");
  });
});

describe("LinkedIn", () => {
  it("keys monthly sections by version and ignores the (Latest) tag", async () => {
    const { entries, version } = await parse("linkedin-recent", linkedinRecent);
    expect(version).toBe("202609");
    const sept = entries.find((e) => e.key === "version-202609")!;
    expect(sept.title).toBe("September 2026 - Version 202609");
    expect(entries[0]!.key).toBe("notice");
    expect(entries[0]!.text).toContain("will be sunset");
  });

  it("keeps the intro apart from a real Overview section", async () => {
    const { entries } = await parse("linkedin-versioning", linkedinVersioning);
    expect(entries.slice(0, 2).map((e) => e.key)).toEqual(["intro", "overview"]);
  });

  it("does not split inside the front matter", async () => {
    const { entries } = await parse("linkedin-recent", linkedinRecent);
    expect(entries.some((e) => e.text.includes("git_commit_id"))).toBe(false);
  });

  it("rejects an HTML page where Markdown was expected", async () => {
    await expect(parse("linkedin-recent", "<!DOCTYPE html><html><body>hi</body></html>")).rejects.toThrow(/Markdown/);
  });
});

describe("status", () => {
  it("keeps only the developer-facing Meta orgs", async () => {
    const { entries } = await parse("meta-status", metaStatus);
    const orgs = new Set(entries.map((e) => e.key.split("/")[0]));
    expect(orgs.has("graph-api")).toBe(true);
    expect(orgs.has("ads-manager")).toBe(false);
  });

  it("emits overall status plus open incidents for Statuspage", async () => {
    const withIncident = JSON.stringify({
      ...JSON.parse(linkedinStatus),
      incidents: [
        { id: "abc", name: "Elevated errors", status: "investigating", impact: "minor", incident_updates: [{ body: "Looking into it." }] },
      ],
    });
    const { entries } = await parse("linkedin-status", withIncident);
    expect(entries.map((e) => e.key)).toEqual(["overall", "incident/abc"]);
    expect(entries[1]!.text).toContain("Looking into it.");
  });
});

describe("extract", () => {
  const extractCases: [string, string][] = [
    ["meta-graph-latest", metaLatest],
    ["meta-graph-ooc", metaOoc],
    ["tiktok-dev", tiktok],
  ];

  it.each(extractCases)("%s: the slice drops the page chrome and parses to the same entries as the full page", async (id, body) => {
    const src = getSource(id)!;
    const slice = src.extract!(body);
    expect(slice.length).toBeLessThan(body.length);
    expect(slice).not.toContain("<head");
    expect(slice).not.toContain("fbq(");
    const full = await parse(id, body);
    const cut = await parse(id, slice);
    expect(cut.version).toBe(full.version);
    expect(cut.entries.map((e) => [e.key, e.hash])).toEqual(full.entries.map((e) => [e.key, e.hash]));
  });

  it("drops the per-request token from Facebook's link redirector", async () => {
    const { extractMetaArticle } = await import("../src/parsers/extract");
    const page = (h: string) =>
      `<html><h1>Version 26.0</h1><a href="https://l.facebook.com/l.php?u=https%3A%2F%2Fgithub.com%2Fx&amp;h=${h}&amp;s=1">x</a><div id="developer_documentation_toolbar"></div><script>n=${h}</script></html>`;
    expect(extractMetaArticle(page("AAA"))).toBe(extractMetaArticle(page("BBB")));
    expect(extractMetaArticle(page("AAA"))).toContain("u=https%3A%2F%2Fgithub.com%2Fx");
  });

  it("falls back to the whole body when the markers are gone", async () => {
    const { extractArticle } = await import("../src/parsers/extract");
    expect(extractArticle("<html><main>redesigned</main></html>")).toBe("<html><main>redesigned</main></html>");
  });
});
