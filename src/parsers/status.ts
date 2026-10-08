import { entryHash } from "../hash";
import { tidy, truncate } from "../text";
import type { Entry, Parsed } from "../types";

/** Meta status orgs that matter to developers (metastatus.com/data/orgs.json). */
export const META_STATUS_ORGS = [
  "graph-api",
  "marketing-api",
  "ig-messenger",
  "messenger",
  "whatsapp-business-api",
  "facebook-login",
];

interface MetaOrg {
  id: string;
  name: string;
  services?: { id: number | string; name: string; status: string }[];
}

async function finish(items: Omit<Entry, "hash">[]): Promise<Entry[]> {
  return Promise.all(items.map(async (e) => ({ ...e, hash: await entryHash(e.title, e.text) })));
}

/** M5: one entry per service of the watched orgs; the text is just the status line. */
export async function parseMetaStatus(json: string, _pageUrl: string): Promise<Parsed> {
  const orgs = JSON.parse(json) as MetaOrg[];
  if (!Array.isArray(orgs)) throw new Error("metastatus orgs.json: expected an array");
  const items: Omit<Entry, "hash">[] = [];
  for (const org of orgs) {
    if (!META_STATUS_ORGS.includes(org.id)) continue;
    for (const svc of org.services ?? []) {
      items.push({
        key: `${org.id}/${svc.id}`,
        title: `${org.name}: ${svc.name}`,
        text: String(svc.status ?? "").trim() || "Unknown",
        url: `https://metastatus.com/${org.id}`,
      });
    }
  }
  return { entries: await finish(items) };
}

interface StatuspageSummary {
  page?: { url?: string };
  status?: { indicator?: string; description?: string };
  components?: { id: string; name: string; status: string; group?: boolean }[];
  incidents?: {
    id: string;
    name: string;
    status: string;
    impact?: string;
    shortlink?: string;
    incident_updates?: { body?: string; status?: string }[];
  }[];
}

/**
 * L3: Atlassian Statuspage summary. The overall indicator is always present;
 * components (currently none) and open incidents each get an entry. A resolved
 * incident drops out of `incidents`, which the diff reports as removed.
 */
export async function parseStatuspage(json: string, pageUrl: string): Promise<Parsed> {
  const s = JSON.parse(json) as StatuspageSummary;
  if (!s.status) throw new Error("Statuspage summary: no status block");
  const home = s.page?.url ?? new URL(pageUrl).origin;
  const items: Omit<Entry, "hash">[] = [
    {
      key: "overall",
      title: "LinkedIn API: overall status",
      text: s.status.description ?? s.status.indicator ?? "Unknown",
      url: home,
    },
  ];
  for (const c of s.components ?? []) {
    if (c.group) continue;
    items.push({ key: `component/${c.id}`, title: `LinkedIn API: ${c.name}`, text: c.status, url: home });
  }
  for (const i of s.incidents ?? []) {
    const latest = i.incident_updates?.[0]?.body;
    items.push({
      key: `incident/${i.id}`,
      title: `LinkedIn API incident: ${i.name}`,
      text: tidy([`Status: ${i.status}`, i.impact ? `Impact: ${i.impact}` : "", latest ? truncate(latest, 1000) : ""].join("\n")),
      url: i.shortlink ?? home,
    });
  }
  return { entries: await finish(items) };
}
