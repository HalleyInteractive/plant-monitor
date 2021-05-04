/**
 * Asynchronous sleep helper function.
 * Typical usage in an async function would be
 *    await sleep(ms);
 * @param ms Time to sleep in milliseconds.
 */
export function sleep(ms: number) : Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function hex2(v: number) {
  const s = v.toString(16);
  if (s.length == 1) return '0'+s;
  return s;
}

async function sha256(buf: Uint8Array) {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buf.buffer);
  return new Uint8Array(hashBuffer);
}      