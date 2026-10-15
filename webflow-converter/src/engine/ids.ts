/**
 * Id helpers. Node and style `_id`s are random UUID v4 strings, unique within a payload
 * (spec 2.1: Webflow rewrites ids on paste, but they must be UUID-shaped and unique).
 *
 * Ownership: engine.
 */

/** Matches the 8-4-4-4-12 hex shape of a UUID (any version). */
export const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Returns a random RFC 4122 version 4 UUID, e.g. `"3f1c2a10-5b2e-4a00-8f00-1c2d3e4f5a6b"`.
 * Uses `crypto.randomUUID` when available (secure contexts), then `crypto.getRandomValues`,
 * then `Math.random` as a last resort (non-cryptographic, fine for clipboard ids).
 */
export function uuid(): string {
  const c: Crypto | undefined = typeof globalThis.crypto !== 'undefined' ? globalThis.crypto : undefined;
  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === 'function') {
    c.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  // Version 4 and RFC 4122 variant bits.
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** True when `id` has UUID shape. Used by payload validation. */
export function isUuidShaped(id: string): boolean {
  return UUID_SHAPE.test(id);
}

/**
 * Deterministic UUID-v4-shaped id for `key` (a 128-bit non-cryptographic hash, cyrb128). The same
 * key always gives the same id. Used for style `_id`s (option `stableClassIds`), so pasting the same
 * output twice carries the same style ids. Webflow ignores pasted style ids when it decides to reuse
 * a class (spec 3.6), so this is harmless; node ids stay random.
 */
export function stableUuid(key: string): string {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < key.length; i++) {
    const k = key.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  const bytes: number[] = [];
  for (const h of [h1, h2, h3, h4]) {
    const u = h >>> 0;
    bytes.push((u >>> 24) & 0xff, (u >>> 16) & 0xff, (u >>> 8) & 0xff, u & 0xff);
  }
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
