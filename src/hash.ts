const encoder = new TextEncoder();

/** SHA-256 hex. Native (crypto.subtle), so it costs next to no Worker CPU time. */
export async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", encoder.encode(s));
  let out = "";
  for (const b of new Uint8Array(buf)) out += b.toString(16).padStart(2, "0");
  return out;
}

/** Entry hashes only need to tell versions of one entry apart; 128 bits is plenty. */
export async function entryHash(title: string, text: string): Promise<string> {
  return (await sha256(`${title}\n${text}`)).slice(0, 32);
}
