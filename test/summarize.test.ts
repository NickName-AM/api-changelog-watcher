import { describe, expect, it } from "vitest";
import { getSource } from "../src/sources";
import { buildPrompt, deterministicSummary, parseAiOutput } from "../src/summarize";
import type { Change } from "../src/types";

describe("parseAiOutput", () => {
  const good = { summary: "  The X endpoint is removed.  ", category: "breaking", versions: ["v26.0"], effective_date: "2026-10-27" };

  it("accepts OpenAI-style chat output", () => {
    const s = parseAiOutput({ choices: [{ message: { content: JSON.stringify(good) } }] });
    expect(s).toEqual({ summary: "The X endpoint is removed.", category: "breaking", versions: ["v26.0"], effectiveDate: "2026-10-27", ai: true });
  });

  it("accepts the legacy { response } shape, as a string or an object", () => {
    expect(parseAiOutput({ response: JSON.stringify(good) })?.category).toBe("breaking");
    expect(parseAiOutput({ response: good })?.category).toBe("breaking");
  });

  it("digs JSON out of surrounding prose or code fences", () => {
    const s = parseAiOutput({ response: "Sure!\n```json\n" + JSON.stringify(good) + "\n```" });
    expect(s?.summary).toBe("The X endpoint is removed.");
  });

  it("repairs bad fields instead of trusting them", () => {
    const s = parseAiOutput({ response: { summary: "ok", category: "catastrophic", versions: ["v1", 7, ""], effective_date: "2026-02-31" } });
    expect(s).toMatchObject({ category: "docs", versions: ["v1"], effectiveDate: null });
  });

  it("returns null for unusable output", () => {
    expect(parseAiOutput({ response: "no json here" })).toBeNull();
    expect(parseAiOutput({ response: { summary: "" } })).toBeNull();
    expect(parseAiOutput(null)).toBeNull();
  });
});

describe("prompts and deterministic summaries", () => {
  const change: Change = { key: "k", title: "Thing", diffType: "modified", oldText: "old body", newText: "new body", contentHash: "h" };

  it("includes old and new text for a modification", () => {
    const p = buildPrompt(getSource("meta-graph-latest")!, change);
    expect(p).toContain("<old>\nold body\n</old>");
    expect(p).toContain("<new>\nnew body\n</new>");
  });

  it("describes a status flip without a model", () => {
    const s = deterministicSummary(getSource("meta-status")!, {
      ...change,
      title: "Graph API: Core",
      oldText: "No known issues",
      newText: "Major disruption",
    });
    expect(s).toMatchObject({ category: "incident", ai: false });
    expect(s.summary).toBe('Graph API: Core changed from "No known issues" to "Major disruption".');
  });
});
