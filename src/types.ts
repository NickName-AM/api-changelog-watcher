export type Platform = "meta" | "tiktok" | "linkedin";
export type SourceKind = "changelog" | "status";
export type Schedule = "hourly" | "6h";

/** One diffable unit of a page: a changelog section, or one status component. */
export interface Entry {
  key: string;
  title: string;
  text: string;
  url?: string;
  hash: string;
}

export interface Parsed {
  entries: Entry[];
  /**
   * What the page is "about": the API version for a version changelog, the
   * year page for Meta's out-of-cycle notes. When it changes between runs, the
   * entries are diffed as a new page: all added, none removed (unless the
   * source sets `rollingVersion`).
   */
  version?: string;
}

export interface SourceDef {
  id: string;
  platform: Platform;
  kind: SourceKind;
  schedule: Schedule;
  name: string;
  /** Human-facing URL, and the URL fetched unless `resolve` is set. */
  url: string;
  accept?: string;
  /**
   * Two-step sources: `url` is an index page, and this picks the page to watch
   * from it (for example Meta's newest `versionNN.0`).
   */
  resolve?: (indexBody: string) => string;
  /**
   * Cut the page down to the part worth watching before hashing and parsing.
   * Less HTML through HTMLRewriter means less CPU, and dropping page chrome
   * (scripts, nonces, tracking tokens) lets an unchanged page short-circuit.
   */
  extract?: (body: string) => string;
  /**
   * `version` is only the newest item on a page that keeps its history (LinkedIn's
   * monthly list), so it is shown but a new one is not diffed as a new page.
   */
  rollingVersion?: boolean;
  parse: (body: string, pageUrl: string) => Promise<Parsed>;
}

export interface SnapshotEntry {
  hash: string;
  title: string;
  text: string;
  url?: string;
}

export interface Snapshot {
  v: 1;
  savedAt: string;
  pageUrl: string;
  etag?: string;
  lastModified?: string;
  bodyHash: string;
  version?: string;
  count: number;
  entries: Record<string, SnapshotEntry>;
}

export type ChangeType = "added" | "modified" | "removed" | "status";

export const CATEGORIES = ["breaking", "deprecation", "new", "fix", "docs", "incident"] as const;
export type Category = (typeof CATEGORIES)[number];

/** A detected change before it is summarised. */
export interface Change {
  key: string;
  title: string;
  url?: string;
  /** added / modified / removed, as seen by the diff. Status sources rewrite this to "status". */
  diffType: "added" | "modified" | "removed";
  newText?: string;
  oldText?: string;
  /** Identifies this exact transition (see transitionHash); retries dedupe on it. */
  contentHash: string;
}

export interface Summary {
  summary: string | null;
  category: Category | null;
  versions: string[];
  effectiveDate: string | null;
  ai: boolean;
}

/** One row for watch_changes, in the shape record_watch_result() expects. */
export interface ChangeRow {
  entry_key: string;
  change_type: ChangeType;
  title: string;
  url: string | null;
  excerpt: string | null;
  summary: string | null;
  category: Category | null;
  versions: string[];
  effective_date: string | null;
  content_hash: string;
}

export type Outcome = "baseline" | "unchanged" | "changed" | "error";

export interface RunResult {
  sourceId: string;
  outcome: Outcome;
  startedAt: string;
  durationMs: number;
  version?: string;
  entryCount?: number;
  changes: ChangeRow[];
  error?: string;
  stored: boolean;
}

export interface JobMessage {
  sourceId: string;
  reason: "cron" | "manual";
}
