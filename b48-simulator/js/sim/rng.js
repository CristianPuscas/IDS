/**
 * PRNG determinist (mulberry32) + hash de șir (FNV-1a), fără dependențe.
 * Starea este un întreg uint32, deci se poate salva în snapshot().
 */

/** Hash FNV-1a pe 32 de biți pentru un șir. */
export function hashString(str) {
  let h = 0x811c9dc5;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Transformă un seed (număr sau șir) în stare uint32. */
export function seedToState(seed) {
  if (typeof seed === 'number' && Number.isFinite(seed)) return (Math.floor(seed) >>> 0);
  return hashString(String(seed ?? 1));
}

export class Rng {
  constructor(seed = 1) { this.state = seedToState(seed); }
  /** Număr pseudo-aleator în [0, 1). */
  next() {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  /** Întreg în [min, max]. */
  int(min, max) { return min + Math.floor(this.next() * (max - min + 1)); }
  getState() { return this.state >>> 0; }
  setState(s) { this.state = (Number(s) >>> 0); }
}

/**
 * Zgomot determinist, independent de ordinea apelurilor: aceeași (seed, cheie) → aceeași valoare în [0, 1).
 * Folosit pentru măsurători (o piesă re-măsurată dă aceeași valoare).
 */
export function noise01(seed, key) {
  const r = new Rng(hashString(`${seed}|${key}`));
  r.next();
  return r.next();
}
