// F1: the source registry. Adding a source is one entry here plus, if the page
// has a new shape, a parser in ./parsers.

import { extractArticle, extractMetaArticle } from "./parsers/extract";
import { parseLinkedInRecentChanges, parseMarkdownSections } from "./parsers/markdown";
import {
  parseMetaOutOfCyclePage,
  parseMetaVersionPage,
  resolveLatestGraphVersion,
  resolveLatestOutOfCyclePage,
} from "./parsers/meta";
import { parseMetaStatus, parseStatuspage } from "./parsers/status";
import { parseTikTokChangelog } from "./parsers/tiktok";
import type { Schedule, SourceDef } from "./types";

export const SOURCES: SourceDef[] = [
  {
    id: "meta-graph-latest",
    platform: "meta",
    kind: "changelog",
    schedule: "6h",
    name: "Meta Graph API: latest version changelog",
    url: "https://developers.facebook.com/docs/graph-api/changelog",
    resolve: resolveLatestGraphVersion,
    extract: extractMetaArticle,
    parse: parseMetaVersionPage,
  },
  {
    id: "meta-graph-ooc",
    platform: "meta",
    kind: "changelog",
    schedule: "6h",
    name: "Meta Graph API: out-of-cycle changes",
    url: "https://developers.facebook.com/docs/graph-api/changelog/out-of-cycle-changes",
    resolve: resolveLatestOutOfCyclePage,
    extract: extractMetaArticle,
    parse: parseMetaOutOfCyclePage,
  },
  {
    id: "meta-marketing",
    platform: "meta",
    kind: "changelog",
    schedule: "6h",
    name: "Meta Marketing API changelog",
    url: "https://developers.facebook.com/docs/marketing-api/marketing-api-changelog",
    accept: "text/markdown, text/plain;q=0.9, */*;q=0.1",
    parse: parseMarkdownSections,
  },
  {
    id: "tiktok-dev",
    platform: "tiktok",
    kind: "changelog",
    schedule: "6h",
    name: "TikTok for Developers changelog",
    url: "https://developers.tiktok.com/doc/changelog",
    extract: extractArticle,
    parse: parseTikTokChangelog,
  },
  {
    id: "linkedin-recent",
    platform: "linkedin",
    kind: "changelog",
    schedule: "6h",
    name: "LinkedIn Marketing API: recent changes",
    url: "https://learn.microsoft.com/en-us/linkedin/marketing/integrations/recent-changes",
    accept: "text/markdown",
    rollingVersion: true,
    parse: parseLinkedInRecentChanges,
  },
  {
    id: "linkedin-versioning",
    platform: "linkedin",
    kind: "changelog",
    schedule: "6h",
    name: "LinkedIn Marketing API: versioning",
    url: "https://learn.microsoft.com/en-us/linkedin/marketing/versioning",
    accept: "text/markdown",
    parse: parseMarkdownSections,
  },
  {
    id: "meta-status",
    platform: "meta",
    kind: "status",
    schedule: "hourly",
    name: "Meta platform status",
    url: "https://metastatus.com/data/orgs.json",
    accept: "application/json",
    parse: parseMetaStatus,
  },
  {
    id: "linkedin-status",
    platform: "linkedin",
    kind: "status",
    schedule: "hourly",
    name: "LinkedIn API status",
    url: "https://www.linkedin-apistatus.com/api/v2/summary.json",
    accept: "application/json",
    parse: parseStatuspage,
  },
];

/** Must match [triggers].crons in wrangler.toml. */
export const CRONS: Record<string, Schedule> = {
  "0 * * * *": "hourly",
  "15 */6 * * *": "6h",
};

export function getSource(id: string): SourceDef | undefined {
  return SOURCES.find((s) => s.id === id);
}

export function sourcesFor(schedule: Schedule): SourceDef[] {
  return SOURCES.filter((s) => s.schedule === schedule);
}
