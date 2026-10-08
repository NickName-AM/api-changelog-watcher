// Step 1 probe: fetch every source the way the Worker does and report what came
// back. Runs in Node (no Cloudflare involved): `npm run probe`.
//
//   npm run probe                 status, size, type, validators, rough entry count
//   npm run probe -- --save       also refresh test/fixtures/<id>.<ext>
//   npm run probe -- meta-status  only the named source(s)
//
// HTMLRewriter only exists in workerd, so HTML sources get a regex heading
// count here; `npm test` runs the real parsers against the saved fixtures.

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fetchSource } from "../src/fetch";
import { SOURCES } from "../src/sources";

const USER_AGENT = "api-changelog-watcher/0.1 (+https://www.abikmaharjan.com.np/watch)";
const FIXTURES = join(import.meta.dirname, "..", "test", "fixtures");

const args = process.argv.slice(2);
const save = args.includes("--save");
const only = args.filter((a) => !a.startsWith("--"));

function extFor(body: string): string {
  const head = body.trimStart().slice(0, 200);
  if (head.startsWith("{") || head.startsWith("[")) return "json";
  if (/^<!doctype html|^<html/i.test(head)) return "html";
  return "md";
}

async function roughCount(id: string, body: string, pageUrl: string): Promise<string> {
  const src = SOURCES.find((s) => s.id === id)!;
  try {
    const parsed = await src.parse(body, pageUrl);
    return `${parsed.entries.length} entries${parsed.version ? `, version ${parsed.version}` : ""}`;
  } catch (err) {
    if (err instanceof ReferenceError && /HTMLRewriter/.test(err.message)) {
      return `~${(body.match(/<h[2-4][\s>]/g) ?? []).length} headings (HTML; real count in npm test)`;
    }
    return `parse error: ${String(err)}`;
  }
}

let failed = 0;
if (save) await mkdir(FIXTURES, { recursive: true });

for (const src of SOURCES) {
  if (only.length && !only.includes(src.id)) continue;
  const t0 = Date.now();
  try {
    const f = await fetchSource(src, USER_AGENT, null);
    const ext = extFor(f.body);
    const validators = [f.etag && `etag ${f.etag}`, f.lastModified && `last-modified ${f.lastModified}`].filter(Boolean).join(", ") || "no validators";
    console.log(`✓ ${src.id.padEnd(20)} ${String(f.body.length).padStart(7)} chars  ${ext.padEnd(4)}  ${Date.now() - t0} ms`);
    console.log(`    ${f.pageUrl}`);
    console.log(`    ${validators}; ${await roughCount(src.id, f.body, f.pageUrl)}`);
    if (save) {
      await writeFile(join(FIXTURES, `${src.id}.${ext}`), f.body);
      console.log(`    saved test/fixtures/${src.id}.${ext}`);
    }
  } catch (err) {
    failed++;
    console.log(`✗ ${src.id.padEnd(20)} ${String(err)}`);
  }
}

process.exit(failed ? 1 : 0);
