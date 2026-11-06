// EngineView — vizualizarea 3D a motorului (API conform ARCHITECTURE.md §5).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Stage, DEFAULT_CAM } from './sceneSetup.js';
import { buildPart, collect, tagPart, disposeGroup } from './engineModel.js';
import { adoptMaterial } from './materials.js';
import { refreshLook } from './highlight.js';
import { Animator, easeInOutCubic } from './animator.js';
import { Picker } from './picking.js';
import { LabelLayer } from './labels.js';
import { LeakFX } from './effects.js';
import { ToolFX } from './tools3d.js';
import { Running } from './running.js';
import { computeExplodeVectors } from './explode.js';
import { FLOOR_Y } from './dims.js';

// piese semitransparente în modul x-ray
const XRAY_IDS = new Set(['bloc_motor', 'chiulasa', 'capac_chiulasa', 'capac_motor_acustic', 'baie_ulei',
  'garnitura_chiulasa', 'garnitura_capac_chiulasa', 'etansare_baie_ulei']);
const ANIM_MS = 700;

export class EngineView {
  constructor(containerEl, bus, partsData) {
    this.container = containerEl;
    this.bus = bus;
    this.partsData = partsData || {};
    this.recs = new Map();
    this.ready = false;
    this.selectedId = null;
    this.hintId = null;
    this.ghostMode = false;
    this.xray = false;
    this.hiddenAssemblies = new Set();
    this.isolated = null;
    this.explodeTarget = 0;
    this.explodeCur = 0;
    this._camTween = null;
    this._time = 0;
  }

  // ------------------------------------------------------------------ inițializare
  async init() {
    if (this.ready) return;
    this.stage = new Stage(this.container); // aruncă eroare clară dacă WebGL lipsește
    this.animator = new Animator();
    this.running = new Running();
    this.labels = new LabelLayer(this.container);
    this.leaks = new LeakFX(this.stage.fxRoot, (id) => this._worldBox(id), FLOOR_Y);
    this.tools = new ToolFX(this.stage.fxRoot, (id) => {
      const rec = this.recs.get(id);
      if (!rec) return null;
      const box = this._worldBox(id);
      return { center: box.getCenter(new THREE.Vector3()), size: box.getSize(new THREE.Vector3()), dir: rec.removalDir };
    });

    const parts = Array.isArray(this.partsData) ? this.partsData : (this.partsData.parts || []);
    let unknown = 0;
    for (const part of parts) {
      if (!part || !part.id || this.recs.has(part.id)) continue;
      const built = buildPart(part, unknown);
      if (built.generic) unknown++;
      this._addRec(part, built.group, built.anchor);
    }
    await this._loadModels(parts);
    this.stage.engineRoot.updateMatrixWorld(true);
    for (const rec of this.recs.values()) this._measure(rec);
    computeExplodeVectors(this.recs);
    // stare cinematică inițială (θ = 0)
    this.running.apply(this.recs, () => true);
    for (const rec of this.recs.values()) refreshLook(rec, 0);

    this.picker = new Picker(this.stage.renderer.domElement, this.stage.camera, () => this._targets(), (hits) => this._resolveHits(hits), {
      onPick: (partId) => this.bus?.emit('view:pick', { partId }),
      onHover: (partId) => this.bus?.emit('view:hover', { partId }),
    });
    this._onControlStart = () => { this._camTween = null; };
    this.stage.controls.addEventListener('start', this._onControlStart);
    this.stage.start((dt, t) => this._frame(dt, t), () => this._afterRender());
    this.ready = true;
    this.bus?.emit('view:ready', { partIds: this.getPartIds() });
  }

  _addRec(part, group, anchor) {
    const { meshes, materials } = collect(group);
    const rd = Array.isArray(part.removalDir) && part.removalDir.length === 3 ? new THREE.Vector3(...part.removalDir.map(Number)) : new THREE.Vector3(0, 1, 0);
    if (!(rd.lengthSq() > 1e-9)) rd.set(0, 1, 0);
    const rec = {
      id: part.id, part, name: part.name || part.id, assembly: part.assembly || null,
      group, meshes, materials, home: anchor.clone(), kinPos: null, kinRotX: null,
      removalDir: rd.normalize(), removeDist: 2, explodeVec: new THREE.Vector3(), animOffset: new THREE.Vector3(),
      localBox: new THREE.Box3(), homeCenter: new THREE.Vector3(), sizeLen: 1,
      base: true, animating: false, ghost: false, xray: false, selected: false, hint: false, damaged: false, fade: 1,
    };
    this.recs.set(part.id, rec);
    this.stage.engineRoot.add(group);
    return rec;
  }

  /** Cutia locală (în coordonatele grupului), centrul și distanța de demontare. */
  _measure(rec) {
    const g = rec.group;
    const saved = { p: g.position.clone(), r: g.rotation.clone() };
    g.position.set(0, 0, 0); g.rotation.set(0, 0, 0);
    g.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(g.matrixWorld).invert();
    const box = new THREE.Box3().setFromObject(g);
    rec.localBox.copy(box.isEmpty() ? new THREE.Box3(new THREE.Vector3(-0.2, -0.2, -0.2), new THREE.Vector3(0.2, 0.2, 0.2)) : box).applyMatrix4(inv);
    g.position.copy(saved.p); g.rotation.copy(saved.r);
    g.updateMatrixWorld(true);
    const size = rec.localBox.getSize(new THREE.Vector3());
    rec.sizeLen = size.length();
    rec.homeCenter.copy(rec.localBox.getCenter(new THREE.Vector3())).add(rec.home);
    rec.removeDist = THREE.MathUtils.clamp(1.5 + Math.max(size.x, size.y, size.z) * 0.35, 1.5, 3);
  }

  /** Încarcă modelele .glb declarate (part.model); la eroare rămâne geometria procedurală. */
  async _loadModels(parts) {
    const withModel = parts.filter((p) => p && p.model && this.recs.has(p.id));
    if (!withModel.length) return;
    const loader = new GLTFLoader();
    await Promise.all(withModel.map(async (part) => {
      const rec = this.recs.get(part.id);
      try {
        const gltf = await loader.loadAsync(`data/${part.model}`);
        const obj = gltf.scene;
        obj.position.sub(rec.home); // modelul este în coordonatele motorului (§2)
        obj.traverse((o) => {
          if (o.isMesh) {
            o.material = Array.isArray(o.material) ? o.material.map(adoptMaterial) : adoptMaterial(o.material);
            o.castShadow = o.receiveShadow = true;
          }
        });
        disposeGroup(rec.group);
        rec.group.clear();
        rec.group.userData.subs = {};
        rec.group.userData.instanced = {};
        delete rec.group.userData.chain;
        rec.group.add(obj);
        tagPart(rec.group, part.id);
        Object.assign(rec, collect(rec.group));
      } catch (e) {
        console.warn(`[EngineView] Model indisponibil pentru „${part.id}” (${part.model}); se folosește geometria procedurală.`, e?.message || e);
      }
    }));
  }

  // ------------------------------------------------------------------ bucla
  _frame(dt, t) {
    this._time = t;
    const now = performance.now();
    this.running.update(dt);
    this.running.apply(this.recs, (rec) => rec.base && !rec.animating && rec.group.visible && !rec.ghost);
    this.animator.update(now);
    this.explodeCur += (this.explodeTarget - this.explodeCur) * Math.min(1, dt * 7);
    if (Math.abs(this.explodeTarget - this.explodeCur) < 1e-4) this.explodeCur = this.explodeTarget;
    for (const rec of this.recs.values()) {
      const g = rec.group;
      g.position.copy(rec.kinPos || rec.home).addScaledVector(rec.explodeVec, this.explodeCur).add(rec.animOffset);
      if (rec.kinRotX !== null) g.rotation.x = rec.kinRotX;
      if (rec.hint) refreshLook(rec, t);
    }
    const root = this.stage.engineRoot;
    root.position.copy(this.running.vib);
    root.rotation.copy(this.running.vibRot);
    this._updateCamTween(now);
    this.leaks.update(dt);
    this.tools.update(now);
  }

  _afterRender() {
    const s = this.stage;
    this.labels.update(s.camera, this.recs.values(), this.selectedId, s.width, s.height,
      (rec, out) => rec.localBox.getCenter(out).applyMatrix4(rec.group.matrixWorld),
      (rec) => rec.group.visible && !rec.ghost);
  }

  // ------------------------------------------------------------------ utilitare
  _rec(id) { return id == null ? null : this.recs.get(id) || null; }

  _worldBox(id) {
    const rec = this._rec(id);
    if (!rec) return null;
    rec.group.updateWorldMatrix(true, false);
    return rec.localBox.clone().applyMatrix4(rec.group.matrixWorld);
  }

  _targets() {
    const out = [];
    for (const rec of this.recs.values()) if (rec.group.visible && !rec.ghost && (rec.fade ?? 1) > 0.5) out.push(...rec.meshes);
    return out;
  }

  /** Prima intersecție cu o piesă; în x-ray se preferă piesele interioare (nontransparente). */
  _resolveHits(hits) {
    let first = null;
    for (const h of hits) {
      const id = h.object.userData.partId;
      const rec = this._rec(id);
      if (!rec || !rec.group.visible || rec.ghost) continue;
      if (!rec.xray) return id;
      if (!first) first = id;
    }
    return first;
  }

  _applyVisibility(rec) {
    const show = !this.hiddenAssemblies.has(rec.assembly) && (!this.isolated || this.isolated.has(rec.id));
    let visible = false, ghost = false;
    if (rec.animating) visible = show;
    else if (rec.base) visible = show;
    else if (this.ghostMode) { visible = show; ghost = true; }
    rec.group.visible = visible;
    rec.ghost = ghost;
    rec.xray = this.xray && XRAY_IDS.has(rec.id);
    refreshLook(rec, this._time);
  }

  _applyAll() { for (const rec of this.recs.values()) this._applyVisibility(rec); }

  // ------------------------------------------------------------------ API public (§5)
  getPartIds() { return [...this.recs.keys()]; }

  select(partId) {
    const prev = this._rec(this.selectedId);
    if (prev) { prev.selected = false; refreshLook(prev, this._time); }
    this.selectedId = this.recs.has(partId) ? partId : null;
    const rec = this._rec(this.selectedId);
    if (rec) { rec.selected = true; refreshLook(rec, this._time); }
  }

  setHint(partId) {
    const prev = this._rec(this.hintId);
    if (prev) { prev.hint = false; refreshLook(prev, this._time); }
    this.hintId = this.recs.has(partId) ? partId : null;
    const rec = this._rec(this.hintId);
    if (rec) rec.hint = true;
  }

  setDamaged(partId, bool) {
    const rec = this._rec(partId);
    if (!rec) return;
    rec.damaged = !!bool;
    refreshLook(rec, this._time);
  }

  _groupRecs(partId, groupIds) {
    const list = [partId, ...(Array.isArray(groupIds) ? groupIds : [])];
    return [...new Set(list)].map((id) => this._rec(id)).filter(Boolean);
  }

  animateRemove(partId, groupIds = []) {
    const rec = this._rec(partId);
    if (!rec) return Promise.resolve(false);
    const recs = this._groupRecs(partId, groupIds);
    const from = rec.animating ? rec.animOffset.clone() : new THREE.Vector3();
    const to = rec.removalDir.clone().multiplyScalar(rec.removeDist);
    recs.forEach((r) => { r.animating = true; r.fade = 1; this._applyVisibility(r); });
    return this.animator.run(recs, from, to, ANIM_MS, {
      onUpdate: (rs, k) => { const f = k > 0.72 ? Math.max(0, 1 - (k - 0.72) / 0.28) : 1; rs.forEach((r) => { r.fade = f; refreshLook(r, this._time); }); },
      onEnd: (rs) => rs.forEach((r) => { r.base = false; r.fade = 1; r.animOffset.set(0, 0, 0); this._applyVisibility(r); }),
    });
  }

  animateInstall(partId, groupIds = []) {
    const rec = this._rec(partId);
    if (!rec) return Promise.resolve(false);
    const recs = this._groupRecs(partId, groupIds);
    const from = rec.animating ? rec.animOffset.clone() : rec.removalDir.clone().multiplyScalar(rec.removeDist);
    recs.forEach((r) => { r.animating = true; r.base = true; r.fade = 0; r.animOffset.copy(from); this._applyVisibility(r); });
    return this.animator.run(recs, from, new THREE.Vector3(), ANIM_MS, {
      onUpdate: (rs, k) => { const f = Math.min(1, k / 0.25); rs.forEach((r) => { r.fade = f; refreshLook(r, this._time); }); },
      onEnd: (rs) => rs.forEach((r) => { r.base = true; r.fade = 1; r.animOffset.set(0, 0, 0); this._applyVisibility(r); }),
    });
  }

  setPartVisible(partId, bool) {
    const rec = this._rec(partId);
    if (!rec) return;
    rec.base = !!bool;
    this._applyVisibility(rec);
  }

  syncVisibility(isOnEngineFn) {
    if (typeof isOnEngineFn !== 'function') return;
    for (const rec of this.recs.values()) {
      let on = true;
      try { on = !!isOnEngineFn(rec.id); } catch { on = true; }
      rec.base = on;
      this._applyVisibility(rec);
    }
  }

  setGhostRemoved(bool) { this.ghostMode = !!bool; this._applyAll(); }

  setAssemblyVisible(assemblyId, bool) {
    if (bool) this.hiddenAssemblies.delete(assemblyId); else this.hiddenAssemblies.add(assemblyId);
    this._applyAll();
  }

  setXray(bool) { this.xray = !!bool; this._applyAll(); }

  setExplode(t) { this.explodeTarget = THREE.MathUtils.clamp(+t || 0, 0, 1); }

  isolate(partIds) {
    this.isolated = Array.isArray(partIds) && partIds.length ? new Set(partIds) : null;
    this._applyAll();
  }

  focus(partId) {
    const box = this._worldBox(partId);
    if (!box) return;
    const c = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3()).length();
    const { camera, controls } = this.stage;
    const dir = camera.position.clone().sub(controls.target).normalize();
    const dist = THREE.MathUtils.clamp(size * 1.5 + 2.2, 3, 22);
    this._tweenCamera(c.clone().addScaledVector(dir, dist), c);
  }

  resetCamera() { this._tweenCamera(DEFAULT_CAM.pos.clone(), DEFAULT_CAM.target.clone()); }

  _tweenCamera(pos, target, ms = 650) {
    const { camera, controls } = this.stage;
    this._camTween = { p0: camera.position.clone(), t0: controls.target.clone(), p1: pos, t1: target, start: performance.now(), ms };
  }

  _updateCamTween(now) {
    const tw = this._camTween;
    if (!tw) return;
    const k = Math.min(1, (now - tw.start) / tw.ms), e = easeInOutCubic(k);
    const { camera, controls } = this.stage;
    camera.position.lerpVectors(tw.p0, tw.p1, e);
    controls.target.lerpVectors(tw.t0, tw.t1, e);
    if (k >= 1) this._camTween = null;
  }

  setLabels(mode) { this.labels?.setMode(mode); }

  showLeak(partId, fluid) { if (this.ready) this.leaks.show(partId, fluid); }
  clearLeaks() { this.leaks?.clear(); }

  playToolAnimation(partId, toolId, kind = 'other') {
    if (!this.ready) return Promise.resolve();
    return this.tools.play(partId, toolId, kind);
  }

  setRunning(bool, opts = {}) { this.running?.set(bool, opts); }

  setTheme(name) { this.stage?.setTheme(name); }

  dispose() {
    if (!this.stage) return;
    this.ready = false;
    this.animator.finishAll();
    this.tools.dispose();
    this.leaks.dispose();
    this.picker?.dispose();
    this.labels.dispose();
    this.stage.controls.removeEventListener('start', this._onControlStart);
    for (const rec of this.recs.values()) disposeGroup(rec.group);
    this.recs.clear();
    this.stage.dispose();
    this.stage = null;
  }
}
