import { decodeEntities, tidy } from "../text";

export interface Section {
  /** Heading texts from the outermost level down to this section's own heading. */
  path: string[];
  level: number;
  id?: string;
  body: string;
}

export interface SplitOptions {
  /** Capture starts when an element matching this selector opens. */
  start: string;
  /**
   * Capture stops when an element matching this selector opens. Without it,
   * capture stops when the `start` element closes (use that for a container
   * such as `article`).
   */
  stop?: string;
  /** Headings that open a new section. Levels are read from the tag name. */
  headings?: string;
  /** Elements whose text is ignored (scripts, permalink "#" anchors). */
  skip?: string;
}

export interface SplitResult {
  /** Text of the first <h1> inside the captured region, or just before it. */
  h1: string;
  sections: Section[];
}

const BLOCKS = "p, div, br, tr, table, pre, blockquote, ul, ol, dd, dt";

/**
 * Splits an HTML page into sections at heading boundaries, using HTMLRewriter
 * (lol-html, native streaming) so the parse costs almost no JS CPU time.
 * Sections with no body text, such as an h3 immediately followed by an h4, are
 * dropped; their heading still appears in the path of the sections below it.
 */
export async function splitHtml(html: string, opts: SplitOptions): Promise<SplitResult> {
  const headingSel = opts.headings ?? "h2, h3, h4";
  const skipSel = ["script", "style", "noscript", "template", "svg", opts.skip].filter(Boolean).join(", ");

  let started = false;
  let stopped = false;
  let skipDepth = 0;
  let h1: string | null = null;
  let h1Buf: string | null = null;
  let heading: { level: number; id?: string; text: string } | null = null;
  const stack: string[] = [];
  const sections: Section[] = [];
  let current: Section | null = null;

  const live = () => started && !stopped && skipDepth === 0;
  const flush = () => {
    if (current) {
      current.body = tidy(decodeEntities(current.body));
      if (current.body) sections.push(current);
    }
    current = null;
  };

  const rewriter = new HTMLRewriter()
    .on(opts.start, {
      element(el) {
        if (started) return;
        started = true;
        if (!opts.stop) el.onEndTag(() => void (stopped = true));
      },
    })
    .on(skipSel, {
      element(el) {
        try {
          // Throws for elements that can't have an end tag; those hold no text anyway.
          el.onEndTag(() => void skipDepth--);
          skipDepth++;
        } catch {
          /* void element */
        }
      },
    })
    .on("h1", {
      element(el) {
        if (h1 !== null || stopped) return;
        h1Buf = "";
        el.onEndTag(() => {
          h1 = tidy(decodeEntities(h1Buf ?? ""));
          h1Buf = null;
        });
      },
    })
    .on(headingSel, {
      element(el) {
        if (!started || stopped) return;
        flush();
        const level = Number(el.tagName.slice(1)) || 2;
        heading = { level, id: el.getAttribute("id") ?? undefined, text: "" };
        el.onEndTag(() => {
          if (!heading) return;
          const text = tidy(decodeEntities(heading.text)).replace(/\s+/g, " ");
          // Drop deeper levels, then put this heading at its own level.
          stack.length = Math.max(0, level - 1);
          stack[level - 1] = text;
          const path = stack.filter((t): t is string => typeof t === "string" && t.length > 0);
          current = { path, level, id: heading.id, body: "" };
          heading = null;
        });
      },
    })
    .on(BLOCKS, {
      element() {
        if (live() && current && !heading) current.body += "\n";
      },
    })
    .on("li", {
      element() {
        if (live() && current && !heading) current.body += "\n- ";
      },
    })
    .onDocument({
      text(t) {
        if (skipDepth > 0) return;
        if (h1Buf !== null) h1Buf += t.text;
        if (!started || stopped) return;
        if (heading) heading.text += t.text;
        else if (current) current.body += t.text;
      },
    });

  if (opts.stop) {
    rewriter.on(opts.stop, {
      element() {
        if (started) stopped = true;
      },
    });
  }

  await rewriter.transform(new Response(html)).arrayBuffer();
  flush();
  return { h1: h1 ?? "", sections };
}
