// Etichete HTML poziționate absolut peste canvas. Mod: 'none' | 'selected' | 'all' (max ~25, cele mai apropiate).
import * as THREE from 'three';

const MAX_ALL = 25;
let styleInjected = false;

function injectStyle() {
  if (styleInjected || typeof document === 'undefined') return;
  styleInjected = true;
  const st = document.createElement('style');
  st.dataset.ev = 'labels';
  // :where() → specificitate zero, ca stilurile UI să poată suprascrie
  st.textContent = `
:where(.ev-labels){position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:2}
:where(.ev-label){position:absolute;left:0;top:0;transform:translate(-50%,-50%);padding:2px 7px;border-radius:4px;
 font:600 11px/1.35 system-ui,sans-serif;color:#f2f5f8;background:rgba(18,22,28,.78);border:1px solid rgba(255,255,255,.14);
 white-space:nowrap;pointer-events:none;user-select:none;will-change:transform}
:where(.ev-label.is-selected){background:rgba(47,140,255,.92);border-color:rgba(255,255,255,.4)}`;
  document.head.appendChild(st);
}

export class LabelLayer {
  constructor(container) {
    injectStyle();
    this.root = document.createElement('div');
    this.root.className = 'ev-labels';
    container.appendChild(this.root);
    this.els = new Map();
    this.mode = 'none';
    this._v = new THREE.Vector3();
  }

  setMode(mode) {
    this.mode = ['none', 'selected', 'all'].includes(mode) ? mode : 'none';
    if (this.mode === 'none') for (const el of this.els.values()) el.style.display = 'none';
  }

  _el(rec) {
    let el = this.els.get(rec.id);
    if (!el) {
      el = document.createElement('div');
      el.className = 'ev-label';
      el.textContent = rec.name;
      el.dataset.partId = rec.id;
      this.root.appendChild(el);
      this.els.set(rec.id, el);
    }
    return el;
  }

  /** recs: iterabil de piese; worldCenter(rec, out) → centrul în lume; visible(rec) → bool. */
  update(camera, recs, selectedId, w, h, worldCenter, visible) {
    if (this.mode === 'none') return;
    const show = new Map();
    if (this.mode === 'selected') {
      for (const rec of recs) if (rec.id === selectedId && visible(rec)) show.set(rec.id, rec);
    } else {
      const cand = [];
      for (const rec of recs) {
        if (!visible(rec)) continue;
        const c = worldCenter(rec, new THREE.Vector3());
        cand.push({ rec, c, d: c.distanceToSquared(camera.position) });
      }
      cand.sort((a, b) => a.d - b.d);
      for (const it of cand.slice(0, MAX_ALL)) show.set(it.rec.id, it.rec);
      if (selectedId && !show.has(selectedId)) { const s = [...recs].find((r) => r.id === selectedId); if (s && visible(s)) show.set(s.id, s); }
    }
    for (const [id, el] of this.els) if (!show.has(id)) el.style.display = 'none';
    for (const rec of show.values()) {
      const el = this._el(rec);
      worldCenter(rec, this._v).project(camera);
      if (this._v.z > 1 || this._v.z < -1) { el.style.display = 'none'; continue; }
      const x = (this._v.x * 0.5 + 0.5) * w, y = (-this._v.y * 0.5 + 0.5) * h;
      el.style.display = '';
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`;
      el.classList.toggle('is-selected', rec.id === selectedId);
    }
  }

  dispose() { this.root.remove(); this.els.clear(); }
}
