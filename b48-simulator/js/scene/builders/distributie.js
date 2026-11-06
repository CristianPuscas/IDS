// Ansamblul „distributie”: lanț (InstancedMesh), pinioane, VANOS, întinzător, patine, electrovalve.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { prep, hullOfCircles, polyPath } from '../geom.js';
import { CAM_Y, CAM_Z, TIMING_X, BLOCK_X } from '../dims.js';

// Cercurile primitive ale lanțului în planul (u = z, v = y), relativ la (TIMING_X, 0, 0)
const CRANK_C = [0, 0, 0.2];
const EXH_C = [CAM_Z, CAM_Y, 0.28];
const INT_C = [-CAM_Z, CAM_Y, 0.28];

/** Tangenta exterioară între două cercuri; side = +1 (spre +z) sau −1. */
function outerTangent(c1, c2, side) {
  const du = c2[0] - c1[0], dv = c2[1] - c1[1];
  const L = Math.hypot(du, dv), d = [du / L, dv / L];
  const perp = side > 0 ? [d[1], -d[0]] : [-d[1], d[0]];
  const sa = (c1[2] - c2[2]) / L, ca = Math.sqrt(1 - sa * sa);
  const n = [perp[0] * ca + d[0] * sa, perp[1] * ca + d[1] * sa];
  return { p1: [c1[0] + c1[2] * n[0], c1[1] + c1[2] * n[1]], p2: [c2[0] + c2[2] * n[0], c2[1] + c2[2] * n[1]], n };
}
const lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/** Geometria unei zale: două plăci laterale + bolț. Lungimea pe +Z, plăcile separate pe X. */
function linkGeometry(pitch) {
  const parts = [];
  for (const x of [-0.028, 0.028]) {
    const g = new THREE.BoxGeometry(0.012, 0.05, pitch * 1.15); g.translate(x, 0, 0); parts.push(prep(g));
  }
  const pin = new THREE.CylinderGeometry(0.012, 0.012, 0.075, 8); pin.rotateZ(Math.PI / 2); pin.translate(0, 0, pitch / 2); parts.push(prep(pin));
  return mergeGeometries(parts, false);
}

/** Calculează matricele zalelor pentru un decalaj s de-a lungul traseului. */
export function chainMatrices(path, count, s, out = []) {
  const step = path.length / count;
  const X = new THREE.Vector3(1, 0, 0), Yv = new THREE.Vector3(), Zv = new THREE.Vector3(), P = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    const a = path.at(s + i * step);
    Zv.set(0, a.tv, a.tu);
    Yv.crossVectors(Zv, X);
    P.set(0, a.v, a.u);
    const m = out[i] || (out[i] = new THREE.Matrix4());
    m.makeBasis(X, Yv, Zv).setPosition(P);
    if (i % 2) m.scale(new THREE.Vector3(1.25, 1, 1)); // zale exterioare/interioare alternante
  }
  return out;
}

export function register(R) {
  // ---------- lanț distribuție ----------
  R.part('lant_distributie', [TIMING_X, 0, 0], (b) => {
    const poly = hullOfCircles([CRANK_C, EXH_C, INT_C].map(([u, v, r]) => [u, v, r + 0.012]), 72);
    const path = polyPath(poly);
    const count = Math.round(path.length / 0.085);
    b.instanced('links', linkGeometry(path.length / count), 'chain', chainMatrices(path, count, 0));
    return (group) => {
      const mesh = group.userData.instanced.links;
      const mats = [];
      group.userData.chain = {
        path, count,
        /** Avans lanț cu distanța s (unități) — folosit la animația de funcționare. */
        set(s) {
          chainMatrices(path, count, s, mats);
          mats.forEach((m, i) => mesh.setMatrixAt(i, m));
          mesh.instanceMatrix.needsUpdate = true;
        },
      };
    };
  });

  // ---------- pinion arbore cotit ----------
  R.part('pinion_arbore_cotit', [TIMING_X, 0, 0], (b) => {
    b.gear('steel', 0.18, 0.215, 21, 0.07, [0, 0, 0], 'x');
    b.cyl('steelDark', 0.12, 0.2, [-0.02, 0, 0], 'x', 24);
    b.gear('steelDark', 0.15, 0.18, 17, 0.05, [-0.1, 0, 0], 'x'); // pinion antrenare pompă ulei
  });

  // ---------- VANOS ----------
  const vanos = (b) => {
    b.gear('steel', 0.26, 0.295, 30, 0.07, [0, 0, 0], 'x');
    b.cyl('aluDark', 0.21, 0.1, [0.08, 0, 0], 'x', 32);
    b.cyl('aluMach', 0.2, 0.02, [0.14, 0, 0], 'x', 32);
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2 + Math.PI / 4;
      b.bolt([0.15, 0.14 * Math.cos(a), 0.14 * Math.sin(a)], 'x', 0.025);
    }
    b.cyl('steelDark', 0.07, 0.05, [0.17, 0, 0], 'x', 6); // șurub central
    b.cyl('steel', 0.08, 0.16, [-0.1, 0, 0], 'x', 16);
  };
  R.part('vanos_admisie', [TIMING_X, CAM_Y, -CAM_Z], vanos);
  R.part('vanos_evacuare', [TIMING_X, CAM_Y, CAM_Z], vanos);

  // ---------- patine (pe tangentele exterioare ale lanțului) ----------
  const rail = (b, c2, side, mat) => {
    const t = outerTangent(CRANK_C, c2, side);
    const off = (p, k) => [p[0] + t.n[0] * k, p[1] + t.n[1] * k];
    const a = off(lerp2(t.p1, t.p2, 0.12), 0.05), m = off(lerp2(t.p1, t.p2, 0.5), 0.075), e = off(lerp2(t.p1, t.p2, 0.88), 0.05);
    b.tube(mat, [[0, a[1], a[0]], [0, m[1], m[0]], [0, e[1], e[0]]], 0.032, { radial: 6, seg: 40 });
    const a2 = off(lerp2(t.p1, t.p2, 0.12), 0.1), e2 = off(lerp2(t.p1, t.p2, 0.88), 0.1), m2 = off(lerp2(t.p1, t.p2, 0.5), 0.125);
    b.tube('nylon', [[-0.02, a2[1], a2[0]], [-0.02, m2[1], m2[0]], [-0.02, e2[1], e2[0]]], 0.03, { radial: 4, seg: 40 });
    const pv = side > 0 ? e : a;
    b.bolt([-0.06, pv[1], pv[0] + side * 0.05], 'x', 0.03);
    return { t, m };
  };
  R.part('sina_intinzator', [TIMING_X, 0, 0], (b) => { rail(b, EXH_C, 1, 'nylon'); });
  R.part('sina_ghidare', [TIMING_X, 0, 0], (b) => { rail(b, INT_C, -1, 'nylon'); });

  // ---------- întinzător hidraulic ----------
  {
    const t = outerTangent(CRANK_C, EXH_C, 1);
    const mid = lerp2(t.p1, t.p2, 0.5);
    const base = [mid[0] + t.n[0] * 0.15, mid[1] + t.n[1] * 0.15];
    R.part('intinzator_lant', [TIMING_X, base[1], base[0]], (b) => {
      const dir = new THREE.Vector3(0, t.n[1], t.n[0]);
      const at = (k) => [0, dir.y * k, dir.z * k];
      b.add(new THREE.CylinderGeometry(0.075, 0.075, 0.42, 20), 'steelDark', { p: at(0.21), axis: dir });
      b.add(new THREE.CylinderGeometry(0.04, 0.04, 0.12, 14), 'steel', { p: at(-0.04), axis: dir });
      b.add(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 6), 'steel', { p: at(0.44), axis: dir });
    });
  }

  // ---------- electrovalve VANOS (fața chiulasei, −X) ----------
  const solenoid = (b) => {
    b.cyl('steelDark', 0.075, 0.08, [-0.04, 0, 0], 'x', 20);
    b.cyl('plastic', 0.065, 0.24, [-0.2, 0, 0], 'x', 20);
    b.rbox('connector', [0.1, 0.13, 0.12], 0.02, [-0.36, 0.02, 0]);
    b.box('accent', [0.05, 0.03, 0.06], [-0.36, 0.1, 0]);
    b.box('steelDark', [0.02, 0.07, 0.24], [-0.07, 0, 0]);
    b.bolt([-0.08, 0, 0.1], '-x', 0.025);
  };
  R.part('electrovalva_vanos_admisie', [-BLOCK_X - 0.06, CAM_Y - 0.02, -0.38], solenoid);
  R.part('electrovalva_vanos_evacuare', [-BLOCK_X - 0.06, CAM_Y - 0.02, 0.38], solenoid);
}
