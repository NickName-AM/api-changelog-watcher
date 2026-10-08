import { createScheduledController, env } from "cloudflare:test";
import { describe, expect, it, vi } from "vitest";
import worker from "../src/index";

// Explicit vars, so a local .dev.vars can't change what these tests see.
const testEnv = { ...env, RUN_TOKEN: "test-token", ENABLE_DEBUG: "false" };
const call = (url: string, init?: RequestInit, e: Env = testEnv) =>
  worker.fetch(new Request(url, init) as Request<unknown, IncomingRequestCfProperties>, e);
const auth = { authorization: "Bearer test-token" };

describe("fetch handler", () => {
  it("lists sources at /", async () => {
    const res = await call("https://w.test/");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { sources: { id: string }[] };
    expect(body.sources.map((s) => s.id)).toContain("linkedin-recent");
  });

  it("refuses /run without the bearer token", async () => {
    const res = await call("https://w.test/run?source=all", { method: "POST" });
    expect(res.status).toBe(401);
  });

  it("refuses /run with the wrong token", async () => {
    const res = await call("https://w.test/run?source=all", { method: "POST", headers: { authorization: "Bearer nope" } });
    expect(res.status).toBe(401);
  });

  it("hides /debug when ENABLE_DEBUG is off, even with the token", async () => {
    const res = await call("https://w.test/debug/parse?source=tiktok-dev", { method: "POST", headers: auth, body: "<article></article>" });
    expect(res.status).toBe(404);
  });

  it("serves /debug/parse with a posted fixture when enabled", async () => {
    const html = '<article><h2 id="may_1,_2026">May 1, 2026</h2><p>Hello</p></article>';
    const res = await call(
      "https://w.test/debug/parse?source=tiktok-dev",
      { method: "POST", headers: auth, body: html },
      { ...testEnv, ENABLE_DEBUG: "true" },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { count: number; entries: { key: string }[] };
    expect(body.entries.map((e) => e.key)).toEqual(["2026-05-01"]);
  });
});

describe("scheduled handler", () => {
  it("enqueues only the status sources on the hourly cron", async () => {
    const sendBatch = vi.spyOn(env.JOBS, "sendBatch").mockResolvedValue(undefined as never);
    await worker.scheduled(createScheduledController({ cron: "0 * * * *" }), env);
    const ids = [...sendBatch.mock.calls[0]![0]].map((m) => (m.body as { sourceId: string }).sourceId);
    expect(ids.sort()).toEqual(["linkedin-status", "meta-status"]);

    sendBatch.mockClear();
    await worker.scheduled(createScheduledController({ cron: "15 */6 * * *" }), env);
    const ids6h = [...sendBatch.mock.calls[0]![0]].map((m) => (m.body as { sourceId: string }).sourceId);
    expect(ids6h).toHaveLength(6);
    expect(ids6h).not.toContain("meta-status");
    sendBatch.mockRestore();
  });
});
