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
