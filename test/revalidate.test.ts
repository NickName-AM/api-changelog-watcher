// The portfolio ping: skipped unless wired up, authenticated, and never thrown.
// fetch is stubbed, so nothing leaves the test.

import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";
import { revalidatePortfolio } from "../src/revalidate";

const URL = "https://portfolio.test/api/watch/revalidate/";
const wired = { ...env, PORTFOLIO_REVALIDATE_URL: URL, WATCH_REVALIDATE_SECRET: "s3cret" };

afterEach(() => vi.restoreAllMocks());

describe("revalidatePortfolio", () => {
  it("does nothing without the secret or the URL", async () => {
    const fetch = vi.spyOn(globalThis, "fetch");
    await revalidatePortfolio({ ...wired, WATCH_REVALIDATE_SECRET: "" }, "tiktok-dev", 1);
    await revalidatePortfolio({ ...wired, PORTFOLIO_REVALIDATE_URL: "" }, "tiktok-dev", 1);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("POSTs the bearer secret to the URL", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
    await revalidatePortfolio(wired, "tiktok-dev", 2);
    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe(URL);
    expect(init).toMatchObject({ method: "POST", headers: { Authorization: "Bearer s3cret" } });
  });

  it("swallows a rejected request and a non-2xx answer", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("network down"));
    await expect(revalidatePortfolio(wired, "tiktok-dev", 1)).resolves.toBeUndefined();
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("no", { status: 401 }));
    await expect(revalidatePortfolio(wired, "tiktok-dev", 1)).resolves.toBeUndefined();
  });
});
