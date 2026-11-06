// Animații de demontare/montare: deplasare cu easing a unui grup de piese; robust la animații concurente.
import * as THREE from 'three';

export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

export class Animator {
  constructor() {
    this.tweens = new Set();
    this.byRec = new Map(); // rec.id → tween activ
  }

  /**
   * Animează rec.animOffset de la `from` la `to` pentru toate piesele din recs.
   * onUpdate(recs, k) la fiecare cadru, onEnd(recs) la final. Întoarce Promise<boolean> (false = anulată).
   */
  run(recs, from, to, duration, { onUpdate, onEnd } = {}) {
    return new Promise((resolve) => {
      const tw = { recs: new Set(recs), from: from.clone(), to: to.clone(), start: performance.now(), duration, onUpdate, onEnd, resolve };
      for (const rec of recs) {
        const old = this.byRec.get(rec.id);
        if (old && old !== tw) { // anulează partea veche pentru această piesă
          old.recs.delete(rec);
          if (!old.recs.size) { this.tweens.delete(old); old.resolve(false); }
        }
        this.byRec.set(rec.id, tw);
        rec.animating = true;
      }
      this.tweens.add(tw);
    });
  }

  isAnimating(id) { return this.byRec.has(id); }

  update(now = performance.now()) {
    const _v = new THREE.Vector3();
    for (const tw of [...this.tweens]) {
      const k = Math.min(1, (now - tw.start) / tw.duration);
      _v.lerpVectors(tw.from, tw.to, easeInOutCubic(k));
      for (const rec of tw.recs) rec.animOffset.copy(_v);
      tw.onUpdate?.([...tw.recs], k);
      if (k >= 1) {
        this.tweens.delete(tw);
        const recs = [...tw.recs];
        for (const rec of recs) { this.byRec.delete(rec.id); rec.animating = false; }
        try { tw.onEnd?.(recs); } catch (e) { console.error(e); }
        tw.resolve(true);
      }
    }
  }

  /** Încheie imediat toate animațiile (ex. la dispose). */
  finishAll() {
    this.update(Number.POSITIVE_INFINITY);
  }
}
