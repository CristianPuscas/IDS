// Scule procedurale animate lângă piesă (clichet, cheie dinamometrică, șurubelniță, clește, sculă specială, generică).
import * as THREE from 'three';
import { PartBuilder, UP } from './geom.js';
import { materialCache } from './materials.js';
import { easeInOutCubic } from './animator.js';

/** Tipul sculei după prefixul ID-ului. */
export function toolKind(toolId = '') {
  const id = String(toolId);
  if (/^(clichet|tubulara)/.test(id)) return 'ratchet';
  if (/^cheie_dinamometrica/.test(id)) return 'torque';
  if (/^surubelnita/.test(id)) return 'screwdriver';
  if (/^(clesti|cleste)/.test(id)) return 'pliers';
  if (/^(scula_|extractor)/.test(id)) return 'special';
  if (/^cheie_/.test(id)) return 'wrench';
  return 'generic';
}

/** Construiește scula: axa de lucru = +Y local, capătul activ în origine (spre piesă). */
function buildTool(kind) {
  const b = new PartBuilder();
  switch (kind) {
    case 'ratchet':
    case 'torque': {
      const L = kind === 'torque' ? 2.6 : 1.5;
      b.cyl('toolSteel', 0.085, 0.24, [0, 0.12, 0], 'y', 20);           // tubulară
      b.cyl('toolSteel', 0.05, 0.16, [0, 0.3, 0], 'y', 16);             // prelungitor
      b.cyl('toolSteel', 0.13, 0.1, [0, 0.42, 0], 'y', 24);             // cap clichet
      b.box('toolSteel', [L, 0.07, 0.12], [L / 2, 0.42, 0]);            // mâner
      b.cyl(kind === 'torque' ? 'toolBlack' : 'toolGrip', 0.08, L * 0.38, [L * 0.78, 0.42, 0], 'x', 16);
      if (kind === 'torque') { b.cyl('toolSteel', 0.07, 0.6, [L * 0.4, 0.42, 0], 'x', 16); b.box('toolGrip', [0.12, 0.02, 0.06], [L * 0.45, 0.49, 0]); }
      break;
    }
    case 'screwdriver':
      b.cyl('toolSteel', 0.025, 0.8, [0, 0.4, 0], 'y', 10);
      b.box('toolSteel', [0.06, 0.06, 0.01], [0, 0.02, 0]);
      b.cyl('toolGrip', 0.09, 0.55, [0, 1.05, 0], 'y', 12, 0.075);
      b.cyl('toolBlack', 0.092, 0.08, [0, 0.82, 0], 'y', 12);
      break;
    case 'pliers':
      for (const s of [-1, 1]) {
        b.box('toolSteel', [0.05, 0.4, 0.04], [s * 0.04, 0.2, 0], [0, 0, s * 0.08]);
        b.box('toolGrip', [0.07, 0.8, 0.06], [s * 0.12, 0.85, 0], [0, 0, s * -0.12]);
      }
      b.cyl('toolSteel', 0.05, 0.08, [0, 0.42, 0], 'z', 16);
      break;
    case 'special':
      b.box('toolBlack', [0.7, 0.08, 0.35], [0, 0.18, 0]);
      for (const x of [-0.25, 0.25]) b.cyl('toolSteel', 0.04, 0.2, [x, 0.06, 0], 'y', 12);
      b.cyl('toolSteel', 0.06, 0.4, [0, 0.4, 0], 'y', 12);
      b.box('toolGrip', [0.8, 0.08, 0.08], [0, 0.6, 0]);
      break;
    case 'wrench':
      b.torus('toolSteel', 0.09, 0.035, [0, 0.05, 0], 'y');
      b.box('toolSteel', [1.0, 0.04, 0.1], [0.58, 0.05, 0]);
      b.cyl('toolGrip', 0.05, 0.4, [0.95, 0.05, 0], 'x', 12);
      break;
    default:
      b.cyl('toolSteel', 0.06, 0.6, [0, 0.3, 0], 'y', 12);
      b.cyl('toolGrip', 0.1, 0.4, [0, 0.8, 0], 'y', 12);
  }
  const mats = materialCache();
  const g = b.build(mats);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.userData.fx = true; } });
  return { group: g, materials: mats.all() };
}

export class ToolFX {
  /** getInfo(partId) → { center: Vector3, size: Vector3, dir: Vector3 } în lume. */
  constructor(root, getInfo) {
    this.root = root; this.getInfo = getInfo;
    this.active = new Set();
  }

  play(partId, toolId, kind = 'other') {
    const info = this.getInfo(partId);
    if (!info) return Promise.resolve();
    const tk = toolKind(toolId);
    const { group, materials } = buildTool(tk);
    const holder = new THREE.Group();
    const dir = info.dir.clone().normalize();
    const ext = Math.abs(info.size.x * dir.x) + Math.abs(info.size.y * dir.y) + Math.abs(info.size.z * dir.z);
    holder.position.copy(info.center).addScaledVector(dir, ext / 2 + 0.06);
    holder.quaternion.setFromUnitVectors(UP, dir);
    holder.add(group);
    holder.scale.setScalar(0.001);
    this.root.add(holder);
    const sign = kind === 'loosen' ? 1 : kind === 'tighten' ? -1 : 0;
    return new Promise((resolve) => {
      const item = { holder, group, materials, start: performance.now(), sign, tk, resolve };
      this.active.add(item);
    });
  }

  update(now = performance.now()) {
    const IN = 140, SPIN = 900, OUT = 160;
    for (const it of [...this.active]) {
      const t = now - it.start;
      const s = t < IN ? t / IN : t > IN + SPIN ? Math.max(0, 1 - (t - IN - SPIN) / OUT) : 1;
      it.holder.scale.setScalar(Math.max(0.001, s));
      const k = Math.min(1, Math.max(0, (t - IN) / SPIN));
      if (it.sign) it.group.rotation.y = it.sign * easeInOutCubic(k) * Math.PI * 1.5;
      else if (it.tk === 'pliers') it.group.rotation.y = Math.sin(k * Math.PI * 4) * 0.25;
      else it.group.rotation.y = Math.sin(k * Math.PI * 3) * 0.35;
      if (t >= IN + SPIN + OUT) this._finish(it);
    }
  }

  _finish(it) {
    this.active.delete(it);
    this.root.remove(it.holder);
    it.group.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
    it.materials.forEach((m) => m.dispose());
    it.resolve();
  }

  dispose() { for (const it of [...this.active]) this._finish(it); }
}
