// Utilitare de geometrie procedurală: PartBuilder (unește geometriile pe material), forme, curbe.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const AX = {
  x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1),
  '-x': new THREE.Vector3(-1, 0, 0), '-y': new THREE.Vector3(0, -1, 0), '-z': new THREE.Vector3(0, 0, -1),
};
export const UP = AX.y;
const FROM_Z = AX.z;
const TAU = Math.PI * 2;

export function vec(a) { return a?.isVector3 ? a.clone() : new THREE.Vector3(a[0], a[1], a[2]); }
export function axisVec(axis) {
  if (!axis) return null;
  if (typeof axis === 'string') return AX[axis];
  return vec(axis).normalize();
}

/** Normalizează o geometrie pentru unire: doar position+normal, neindexată, fără grupuri. */
export function prep(geo) {
  let g = geo.index ? geo.toNonIndexed() : geo;
  if (g !== geo) geo.dispose();
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  if (!g.attributes.normal) g.computeVertexNormals();
  g.clearGroups();
  g.morphAttributes = {};
  return g;
}

const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _e = new THREE.Euler();
const _p = new THREE.Vector3(), _s = new THREE.Vector3();

/** Matrice din { p, r (euler), q, axis (orientează axa `from` pe axis), s }. */
export function makeMatrix(t = {}, from = UP) {
  _q.identity();
  const ax = axisVec(t.axis);
  if (ax) _q.setFromUnitVectors(from, ax);
  if (t.r) { _e.set(t.r[0] || 0, t.r[1] || 0, t.r[2] || 0); _q2.setFromEuler(_e); _q.premultiply(_q2); }
  if (t.q) _q.premultiply(t.q);
  _p.set(0, 0, 0);
  if (t.p) _p.set(t.p[0], t.p[1], t.p[2]);
  if (typeof t.s === 'number') _s.setScalar(t.s);
  else if (t.s) _s.set(t.s[0], t.s[1], t.s[2]);
  else _s.set(1, 1, 1);
  return new THREE.Matrix4().compose(_p, _q, _s);
}

// Baze pentru extrudare: forma (u,v) + direcția extrudării w
const EXTRUDE_BASIS = {
  z: new THREE.Matrix4(),
  x: new THREE.Matrix4().makeBasis(AX.z, AX.y, AX['-x']), // u→z, v→y
  y: new THREE.Matrix4().makeBasis(AX.x, AX.z, AX['-y']), // u→x, v→z
};

/** Construiește o piesă: colectează geometrii pe chei de material și le unește la final. */
export class PartBuilder {
  constructor() { this.geos = new Map(); this.inst = []; this.subs = []; }

  add(geo, mat, t = {}, from = UP) {
    const g = prep(geo);
    g.applyMatrix4(makeMatrix(t, from));
    if (!this.geos.has(mat)) this.geos.set(mat, []);
    this.geos.get(mat).push(g);
    return this;
  }
  box(mat, size, p, r) { return this.add(new THREE.BoxGeometry(size[0], size[1], size[2]), mat, { p, r }); }
  /** Cutie cu muchii rotunjite (extrudare cu teșitură). */
  rbox(mat, size, radius, p, r) {
    const [w, h, d] = size;
    const rad = Math.min(radius, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3);
    const sh = roundedRect(w - 2 * rad, h - 2 * rad, Math.max(0.001, rad * 0.4));
    const g = new THREE.ExtrudeGeometry(sh, { depth: Math.max(0.001, d - 2 * rad), bevelEnabled: true, bevelThickness: rad, bevelSize: rad, bevelSegments: 2, curveSegments: 4 });
    g.translate(0, 0, -(d - 2 * rad) / 2);
    return this.add(g, mat, { p, r });
  }
  cyl(mat, r, h, p, axis = 'y', seg = 24, r2 = r, open = false) {
    return this.add(new THREE.CylinderGeometry(r, r2, h, seg, 1, open), mat, { p, axis });
  }
  sphere(mat, r, p, s) { return this.add(new THREE.SphereGeometry(r, 16, 12), mat, { p, s }); }
  torus(mat, R, r, p, axis = 'y', arc = TAU, seg = 32, rot) {
    return this.add(new THREE.TorusGeometry(R, r, 8, seg, arc), mat, { p, axis, r: rot }, FROM_Z);
  }
  /** Profil [[raza, y], ...] rotit în jurul axei. */
  lathe(mat, profile, p, axis = 'y', seg = 32) {
    const pts = profile.map(([r, y]) => new THREE.Vector2(Math.max(0, r), y));
    return this.add(new THREE.LatheGeometry(pts, seg), mat, { p, axis });
  }
  tube(mat, pts, radius, o = {}) {
    const curve = new THREE.CatmullRomCurve3(pts.map(vec), !!o.closed, 'catmullrom', o.tension ?? 0.5);
    const g = new THREE.TubeGeometry(curve, o.seg ?? Math.max(16, pts.length * 12), radius, o.radial ?? 10, !!o.closed);
    this.add(g, mat, { p: o.p });
    if (o.caps !== false && !o.closed) { // capete închise
      const a = curve.getPoint(0), b = curve.getPoint(1);
      const ta = curve.getTangent(0), tb = curve.getTangent(1);
      this.add(new THREE.CircleGeometry(radius, o.radial ?? 10), mat, { p: [a.x, a.y, a.z], axis: ta.clone().negate() }, FROM_Z);
      this.add(new THREE.CircleGeometry(radius, o.radial ?? 10), mat, { p: [b.x, b.y, b.z], axis: tb }, FROM_Z);
    }
    return curve;
  }
  /** Extrudare formă 2D; along = direcția extrudării ('x' → forma în (z,y), 'y' → (x,z), 'z' → (x,y)). */
  extrude(mat, shape, depth, o = {}) {
    const bevel = o.bevel || 0;
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: Math.max(0.001, depth - 2 * bevel), bevelEnabled: bevel > 0, bevelThickness: bevel,
      bevelSize: bevel, bevelSegments: o.bevelSeg ?? 2, curveSegments: o.curve ?? 12,
    });
    g.translate(0, 0, -(depth - 2 * bevel) / 2);
    g.applyMatrix4(EXTRUDE_BASIS[o.along || 'z']);
    return this.add(g, mat, { p: o.p, r: o.r });
  }
  /** Șurub cu cap hexagonal + șaibă; axis = direcția în care „privește” capul. */
  bolt(p, axis = 'y', size = 0.05, mat = 'bolt') {
    const d = axisVec(axis);
    const P = vec(p);
    const head = P.clone().addScaledVector(d, size * 0.15 + size * 0.35);
    this.add(new THREE.CylinderGeometry(size * 1.35, size * 1.35, size * 0.15, 16), mat, { p: P.clone().addScaledVector(d, size * 0.075).toArray(), axis: d });
    this.add(new THREE.CylinderGeometry(size, size, size * 0.7, 6), mat, { p: head.toArray(), axis: d });
    return this;
  }
  bolts(list, axis = 'y', size = 0.05, mat = 'bolt') { for (const p of list) this.bolt(p, axis, size, mat); return this; }
  /** Pinion / roată dințată extrudată pe axa dată. */
  gear(mat, rRoot, rTip, teeth, width, p, axis = 'x', holeR = 0) {
    const along = typeof axis === 'string' ? axis.replace('-', '') : 'x';
    return this.extrude(mat, gearShape(rRoot, rTip, teeth, holeR), width, { along, p, curve: 8 });
  }
  /** Fulie cu caneluri (curea poli-V). */
  pulley(mat, r, width, p, grooves = 6, axis = 'x') {
    const prof = [[0, -width / 2], [r * 0.98, -width / 2]];
    for (let i = 0; i <= grooves * 2; i++) {
      const y = -width / 2 + (width * i) / (grooves * 2);
      prof.push([i % 2 ? r * 0.955 : r, y]);
    }
    prof.push([r * 0.98, width / 2], [0, width / 2]);
    return this.lathe(mat, prof, p, axis, 40);
  }
  /** Arc elicoidal. */
  spring(mat, R, wire, turns, h, p, axis = 'y') {
    const curve = new Helix(R, h, turns);
    return this.add(new THREE.TubeGeometry(curve, Math.ceil(turns * 16), wire, 6, false), mat, { p, axis });
  }
  /** Sub-grup cu pivot propriu (ex. fulie rotită la „pornire”). */
  sub(name, pivot = [0, 0, 0]) {
    const b = new PartBuilder();
    this.subs.push({ name, pivot, b });
    return b;
  }
  /** InstancedMesh (ex. zalele lanțului). */
  instanced(name, geo, mat, matrices) { this.inst.push({ name, geo: prep(geo), mat, matrices }); return this; }

  /** Construiește grupul; matFor(key) întoarce materialul (deja clonat pentru piesă). */
  build(matFor) {
    const group = new THREE.Group();
    group.userData.subs = {};
    group.userData.instanced = {};
    for (const [key, list] of this.geos) {
      const geo = list.length === 1 ? list[0] : mergeGeometries(list, false);
      if (list.length > 1) list.forEach((g) => g.dispose());
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, matFor(key));
      mesh.castShadow = true; mesh.receiveShadow = true;
      group.add(mesh);
    }
    for (const it of this.inst) {
      const mesh = new THREE.InstancedMesh(it.geo, matFor(it.mat), it.matrices.length);
      it.matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere(); mesh.computeBoundingBox();
      mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      group.add(mesh);
      group.userData.instanced[it.name] = mesh;
    }
    for (const s of this.subs) {
      const child = s.b.build(matFor);
      child.position.set(s.pivot[0], s.pivot[1], s.pivot[2]);
      group.add(child);
      group.userData.subs[s.name] = child;
    }
    return group;
  }
}

class Helix extends THREE.Curve {
  constructor(R, h, turns) { super(); this.R = R; this.h = h; this.turns = turns; }
  getPoint(t, target = new THREE.Vector3()) {
    const a = t * this.turns * TAU;
    return target.set(this.R * Math.cos(a), this.h * t - this.h / 2, this.R * Math.sin(a));
  }
}

// ---------- forme 2D ----------
export function roundedRect(w, h, r, cx = 0, cy = 0) {
  const s = new THREE.Shape();
  const x = cx - w / 2, y = cy - h / 2;
  r = Math.min(r, w / 2, h / 2);
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
export function rectPath(w, h, cx = 0, cy = 0, r = 0) {
  if (r > 0) { const s = roundedRect(w, h, r, cx, cy); const p = new THREE.Path(); p.curves = s.curves; return p; }
  const p = new THREE.Path();
  p.moveTo(cx - w / 2, cy - h / 2); p.lineTo(cx - w / 2, cy + h / 2); p.lineTo(cx + w / 2, cy + h / 2); p.lineTo(cx + w / 2, cy - h / 2); p.closePath();
  return p;
}
export function circlePath(cx, cy, r) { const p = new THREE.Path(); p.absarc(cx, cy, r, 0, TAU, true); return p; }
export function polyShape(pts) {
  const s = new THREE.Shape();
  pts.forEach(([u, v], i) => (i ? s.lineTo(u, v) : s.moveTo(u, v)));
  s.closePath();
  return s;
}
export function gearShape(rRoot, rTip, teeth, holeR = 0) {
  const s = new THREE.Shape();
  const step = TAU / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    const pts = [[rRoot, a], [rTip, a + step * 0.28], [rTip, a + step * 0.5], [rRoot, a + step * 0.78]];
    pts.forEach(([r, ang], k) => {
      const x = r * Math.cos(ang), y = r * Math.sin(ang);
      if (i === 0 && k === 0) s.moveTo(x, y); else s.lineTo(x, y);
    });
  }
  s.closePath();
  if (holeR > 0) s.holes.push(circlePath(0, 0, holeR));
  return s;
}

// ---------- învelitoare convexă pentru curea / lanț ----------
/** circles: [[u, v, r]] → poligon convex (CCW) care înfășoară cercurile. */
export function hullOfCircles(circles, samples = 64) {
  const pts = [];
  for (const [u, v, r] of circles) for (let i = 0; i < samples; i++) {
    const a = (i / samples) * TAU;
    pts.push([u + r * Math.cos(a), v + r * Math.sin(a)]);
  }
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for (const p of pts) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop(); lower.push(p); }
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop(); upper.push(p); }
  upper.pop(); lower.pop();
  return resamplePoly(lower.concat(upper), 0.03);
}
/** Re-eșantionează un poligon închis la pas aproximativ constant. */
export function resamplePoly(poly, step) {
  const path = polyPath(poly);
  const n = Math.max(8, Math.round(path.length / step));
  const out = [];
  for (let i = 0; i < n; i++) { const a = path.at((i / n) * path.length); out.push([a.u, a.v]); }
  return out;
}
/** Parametrizare după lungime a unui poligon închis. */
export function polyPath(poly) {
  const cum = [0];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    cum.push(cum[i] + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const length = cum[cum.length - 1];
  return {
    length,
    at(s) {
      s = ((s % length) + length) % length;
      let lo = 0, hi = poly.length;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; }
      const a = poly[lo], b = poly[(lo + 1) % poly.length];
      const seg = cum[lo + 1] - cum[lo] || 1;
      const k = (s - cum[lo]) / seg;
      const tu = (b[0] - a[0]) / seg, tv = (b[1] - a[1]) / seg;
      return { u: a[0] + (b[0] - a[0]) * k, v: a[1] + (b[1] - a[1]) * k, tu, tv };
    },
  };
}
/** Deplasează vârfurile unui poligon convex CCW spre exterior. */
export function offsetPoly(poly, d) {
  const n = poly.length;
  return poly.map((p, i) => {
    const a = poly[(i - 1 + n) % n], b = poly[(i + 1) % n];
    let tu = b[0] - a[0], tv = b[1] - a[1];
    const L = Math.hypot(tu, tv) || 1; tu /= L; tv /= L;
    return [p[0] + tv * d, p[1] - tu * d]; // normala exterioară pentru CCW
  });
}

// ---------- volută (carcasă spirală turbo) ----------
/** Spirală în planul YZ în jurul axei X: raza centrului R0→R1, raza tubului r0→r1, unghi arc. */
export function voluteGeometry(R0, R1, r0, r1, arc = TAU * 0.92, segs = 64, radial = 16) {
  const pos = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, th = t * arc;
    const R = R0 + (R1 - R0) * t, r = r0 + (r1 - r0) * t;
    const ny = Math.cos(th), nz = Math.sin(th);
    for (let j = 0; j <= radial; j++) {
      const ph = (j / radial) * TAU;
      const c = Math.cos(ph), s = Math.sin(ph);
      pos.push(s * r, (R + c * r) * ny, (R + c * r) * nz);
    }
  }
  for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) {
    const a = i * (radial + 1) + j, b = a + radial + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
