// Structured logs for Workers Logs. Pass objects, not JSON strings: Workers
// Logs indexes each field, so `event = "run.done" AND outcome = "error"` or
// `source = "tiktok-dev"` filters without a text match. Event names are
// `area.what` and stay fixed for queries; `message` is the one-line sentence
// a person reads in the log list. Undefined fields are left out.

type Level = "info" | "warn" | "error";
type Fields = Record<string, unknown>;

function emit(level: Level, event: string, message: string, fields: Fields): void {
  const entry: Fields = { message, event };
  for (const [k, v] of Object.entries(fields)) if (v !== undefined) entry[k] = v;
  (level === "info" ? console.log : console[level])(entry);
}

export const log = {
  info: (event: string, message: string, fields: Fields = {}) => emit("info", event, message, fields),
  warn: (event: string, message: string, fields: Fields = {}) => emit("warn", event, message, fields),
  error: (event: string, message: string, fields: Fields = {}) => emit("error", event, message, fields),
};

/** An error for the end of a message: one line, short. The full text stays in `error`. */
export function brief(err: unknown): string {
  const text = (err instanceof Error ? err.message : String(err)).replace(/\s+/g, " ").trim();
  return text.length > 200 ? `${text.slice(0, 199)}…` : text;
}

/** Error name and message as plain fields, so they can be filtered on. */
export function errorFields(err: unknown): { error: string; error_name?: string } {
  if (err instanceof Error) return { error: err.message, error_name: err.name };
  return { error: String(err) };
}
