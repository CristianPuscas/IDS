// Selecție cu mouse/touch: click fără drag (< 5 px) → pick; hover limitat în frecvență → hover + cursor.
import * as THREE from 'three';

export class Picker {
  /**
   * @param {HTMLElement} dom  canvas-ul
   * @param {THREE.Camera} camera
   * @param {() => THREE.Object3D[]} getTargets  mesh-uri selectabile (vizibile, nefantomă)
   * @param {(hits) => string|null} resolve  alege piesa din intersecții
   * @param {{onPick, onHover}} cb
   */
  constructor(dom, camera, getTargets, resolve, cb) {
    Object.assign(this, { dom, camera, getTargets, resolve, cb });
    this.ray = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this.down = null;
    this.hoverId = null;
    this._lastHover = 0;
    this._pending = null;
    this._onDown = (e) => { if (e.isPrimary !== false) this.down = { x: e.clientX, y: e.clientY, b: e.button }; };
    this._onUp = (e) => {
      const d = this.down; this.down = null;
      if (!d || d.b !== e.button || e.button > 0) return;
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) >= 5) return;
      this.cb.onPick(this.pickAt(e.clientX, e.clientY));
    };
    this._onMove = (e) => {
      if (e.buttons) return; // în timpul rotirii nu calculăm hover
      this._pending = { x: e.clientX, y: e.clientY };
      const now = performance.now();
      if (now - this._lastHover < 60) { this._schedule(); return; }
      this._flushHover();
    };
    this._onLeave = () => { this._pending = null; this._setHover(null); };
    dom.addEventListener('pointerdown', this._onDown);
    dom.addEventListener('pointerup', this._onUp);
    dom.addEventListener('pointermove', this._onMove);
    dom.addEventListener('pointerleave', this._onLeave);
  }

  _schedule() {
    if (this._timer) return;
    this._timer = setTimeout(() => { this._timer = null; this._flushHover(); }, 60);
  }

  _flushHover() {
    if (!this._pending) return;
    this._lastHover = performance.now();
    const { x, y } = this._pending; this._pending = null;
    this._setHover(this.pickAt(x, y));
  }

  _setHover(id) {
    if (id === this.hoverId) return;
    this.hoverId = id;
    this.dom.style.cursor = id ? 'pointer' : '';
    this.cb.onHover(id);
  }

  /** Piesa de sub coordonatele ecran (sau null). */
  pickAt(clientX, clientY) {
    const r = this.dom.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    this.ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera);
    const hits = this.ray.intersectObjects(this.getTargets(), false);
    return this.resolve(hits);
  }

  dispose() {
    clearTimeout(this._timer);
    const d = this.dom;
    d.removeEventListener('pointerdown', this._onDown);
    d.removeEventListener('pointerup', this._onUp);
    d.removeEventListener('pointermove', this._onMove);
    d.removeEventListener('pointerleave', this._onLeave);
    d.style.cursor = '';
  }
}
