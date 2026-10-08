// Small string helpers shared by the parsers. Everything here is linear in the
// input; nothing does character-level diffing.

const NAMED: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  hellip: "…",
  rarr: "→",
  larr: "←",
  copy: "©",
  reg: "®",
  trade: "™",
  bull: "•",
  middot: "·",
};

/** HTMLRewriter hands text over still entity-encoded, and Meta's Markdown has entities too. */
export function decodeEntities(s: string): string {
  if (!s.includes("&")) return s;
  return s.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (m, body: string) => {
    if (body[0] === "#") {
      const code = body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : m;
    }
    return NAMED[body.toLowerCase()] ?? m;
  });
}

/** Collapse runs of spaces, trim each line, and drop repeated blank lines. */
export function tidy(s: string): string {
  return s
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t\f\v ]+/g, " ")
    .split("\n")
    .map((l) => l.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 120) || "untitled"
  );
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

function iso(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * "August 25, 2026", "Aug 25 2026", "june_4,_2026", "05/04/2026" (US order) → "2026-08-25".
 * Returns null for anything else.
 */
export function parseLooseDate(input: string): string | null {
  const s = input.replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();
  let m = /^([A-Za-z]+)\.? (\d{1,2}),? (\d{4})$/.exec(s);
  if (m) {
    const month = MONTHS[m[1]!.toLowerCase().slice(0, 4)] ?? MONTHS[m[1]!.toLowerCase().slice(0, 3)];
    return month ? iso(Number(m[3]), month, Number(m[2])) : null;
  }
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (m) return iso(Number(m[3]), Number(m[1]), Number(m[2]));
  return null;
}

export function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1).trimEnd() + "…";
}

/** Give repeated keys a stable "-2", "-3" suffix, in document order. */
export function uniqueKeys<T extends { key: string }>(items: T[]): T[] {
  const seen = new Map<string, number>();
  for (const item of items) {
    const n = (seen.get(item.key) ?? 0) + 1;
    seen.set(item.key, n);
    if (n > 1) item.key = `${item.key}-${n}`;
  }
  return items;
}

/** Cap on one entry's text; keeps snapshots and AI prompts bounded. */
export const MAX_ENTRY_TEXT = 20_000;
