// Ansamblul „chiulasa”: garnitură, chiulasă, axe cu came, Valvetronic, culbutori, arcuri, supape, capace.
import * as THREE from 'three';
import { roundedRect, circlePath, rectPath, polyShape } from '../geom.js';
import { CYL_X, BORE_R, DECK_Y, HEAD_TOP, COVER_TOP, CAM_Y, CAM_Z, BLOCK_X, BLOCK_Z, JOURNAL_X } from '../dims.js';

const VALVE_DX = 0.14;           // decalaj supape pe X față de axa cilindrului
const VALVE_Z = 0.2;             // supape admisie la −Z, evacuare la +Z
const LOBE_PHASE = [0, 1.5 * Math.PI, 0.5 * Math.PI, Math.PI]; // came (½ din arborele cotit), ordine 1-3-4-2

/** Profil de camă (în planul (z,y)), vârful spre +y. */
function camShape() {
  const s = new THREE.Shape();
  s.absarc(0, 0, 0.15, Math.PI / 2 + 0.95, Math.PI / 2 - 0.95 + Math.PI * 2, false);
  s.absarc(0, 0.12, 0.075, 0.25, Math.PI - 0.25, false);
  s.closePath();
  return s;
}

function camshaft(b, z) {
  b.cyl('steel', 0.085, 3.85, [0.02, 0, 0], 'x', 20);
  const cam = camShape();
  CYL_X.forEach((x, i) => {
    for (const dx of [-VALVE_DX, VALVE_DX]) b.extrude('steel', cam, 0.09, { along: 'x', p: [x + dx, 0, 0], r: [LOBE_PHASE[i], 0, 0], curve: 10 });
  });
  for (const x of JOURNAL_X) b.cyl('aluMach', 0.12, 0.1, [x, 0, 0], 'x', 24);
  b.cyl('steelDark', 0.09, 0.08, [-1.92, 0, 0], 'x', 6); // hexagon pentru cheie
  // roată senzor (impulsuri)
  const w = new THREE.Shape(); w.absarc(0, 0, 0.17, 0, Math.PI * 2, false); w.holes.push(circlePath(0, 0, 0.08));
  b.extrude('steelDark', w, 0.02, { along: 'x', p: [1.86, 0, 0] });
  for (let k = 0; k < 4; k++) b.box('steelDark', [0.02, 0.06, 0.1], [1.86, 0.19 * Math.cos(k * Math.PI / 2), 0.19 * Math.sin(k * Math.PI / 2)], [k * Math.PI / 2, 0, 0]);
}

export function register(R) {
  // ---------- garnitură chiulasă (multistrat) ----------
  R.part('garnitura_chiulasa', [0, DECK_Y + 0.015, 0], (b) => {
    const s = roundedRect(BLOCK_X * 2, BLOCK_Z * 2, 0.08);
    CYL_X.forEach((x) => s.holes.push(circlePath(x, 0, BORE_R + 0.01)));
    for (const x of JOURNAL_X) for (const z of [-0.62, 0.62]) s.holes.push(circlePath(x, z, 0.055));
    for (const x of [-1.82, -0.91, 0, 0.91, 1.82]) for (const z of [-0.5, 0.5]) s.holes.push(circlePath(x + 0.2, z * 1.2, 0.03));
    b.extrude('mls', s, 0.03, { along: 'y', curve: 32 });
  });

  // ---------- chiulasă ----------
  R.part('chiulasa', [0, DECK_Y + 0.03, 0], (b) => {
    const H = HEAD_TOP - DECK_Y - 0.03; // ≈ 0.97
    const SLAB = 0.26;
    // placa inferioară (camere de ardere)
    b.extrude('aluHead', roundedRect(BLOCK_X * 2, BLOCK_Z * 2, 0.08), SLAB, { along: 'y', p: [0, SLAB / 2, 0] });
    // pereți laterali și de capăt (puțul axelor cu came rămâne deschis sus)
    for (const z of [-1, 1]) b.box('aluHead', [BLOCK_X * 2, H - SLAB, 0.12], [0, SLAB + (H - SLAB) / 2, z * (BLOCK_Z - 0.06)]);
    for (const x of [-1, 1]) b.box('aluHead', [0.12, H - SLAB, BLOCK_Z * 2], [x * (BLOCK_X - 0.06), SLAB + (H - SLAB) / 2, 0]);
    b.box('aluMach', [BLOCK_X * 2, 0.02, 0.12], [0, H - 0.01, -(BLOCK_Z - 0.06)]);
    b.box('aluMach', [BLOCK_X * 2, 0.02, 0.12], [0, H - 0.01, (BLOCK_Z - 0.06)]);
    // lagăre axe cu came (jumătatea inferioară) + capace de lagăr cu șuruburi
    const camY = CAM_Y - (DECK_Y + 0.03);
    for (const x of JOURNAL_X) {
      for (const z of [-CAM_Z, CAM_Z]) {
        const sh = roundedRect(0.34, camY - SLAB, 0.02, z, SLAB + (camY - SLAB) / 2);
        b.extrude('aluHead', sh, 0.1, { along: 'x', p: [x, 0, 0] });
        b.box('aluMach', [0.1, 0.1, 0.36], [x, camY + 0.13, z]);
        b.bolts([[x, camY + 0.18, z - 0.13], [x, camY + 0.18, z + 0.13]], 'y', 0.03);
      }
    }
    // turnuri bujii (tuburi)
    CYL_X.forEach((x) => b.lathe('aluHead', [[0.075, SLAB], [0.11, SLAB], [0.11, H], [0.075, H], [0.075, SLAB]], [x, 0, 0], 'y', 24));
    // șuruburi chiulasă (vizibile după scoaterea axelor)
    for (const x of JOURNAL_X) for (const z of [-0.6, 0.6]) b.bolt([x, SLAB, z], 'y', 0.055);
    // flanșe porturi admisie (−Z) și evacuare (+Z) cu interior întunecat
    CYL_X.forEach((x) => {
      b.rbox('aluHead', [0.6, 0.32, 0.08], 0.03, [x, 0.3, -BLOCK_Z - 0.03]);
      b.add(new THREE.CircleGeometry(0.11, 16), 'dark', { p: [x, 0.3, -BLOCK_Z - 0.072], r: [0, Math.PI, 0], s: [1.6, 1, 1] });
      b.rbox('aluHead', [0.55, 0.3, 0.08], 0.03, [x, 0.27, BLOCK_Z + 0.03]);
    });
    // bosaje față pentru electrovalve/termostat, suport pompă înaltă presiune (spate, admisie)
    b.box('aluHead', [0.06, 0.3, 1.0], [-BLOCK_X - 0.03, 0.7, 0]);
    b.box('aluHead', [0.35, 0.35, 0.1], [1.5, 0.75, -BLOCK_Z - 0.04]);
    b.box('aluHead', [0.3, 0.3, 0.12], [-1.2, 0.85, -BLOCK_Z - 0.05]); // flanșă servomotor
  });

  // ---------- axe cu came ----------
  R.part('ax_came_admisie', [0, CAM_Y, -CAM_Z], (b) => camshaft(b, -CAM_Z));
  R.part('ax_came_evacuare', [0, CAM_Y, CAM_Z], (b) => camshaft(b, CAM_Z));

  // ---------- ax excentric Valvetronic ----------
  R.part('ax_excentric', [0, CAM_Y + 0.13, -0.58], (b) => {
    b.cyl('steel', 0.05, 3.7, [0, 0, 0], 'x', 16);
    CYL_X.forEach((x) => { for (const dx of [-VALVE_DX, VALVE_DX]) b.cyl('steelDark', 0.075, 0.06, [x + dx, 0.025, 0.01], 'x', 20); });
    // sector dințat acționat de servomotor
    const sec = new THREE.Shape();
    const n = 14;
    sec.moveTo(0, 0);
    for (let k = 0; k <= n * 2; k++) {
      const a = -Math.PI * 0.85 + (k / (n * 2)) * Math.PI * 0.6;
      const r = k % 2 ? 0.2 : 0.18;
      sec.lineTo(r * Math.cos(a), r * Math.sin(a));
    }
    sec.closePath();
    b.extrude('steelDark', sec, 0.05, { along: 'x', p: [-1.2, 0, 0] });
  });

  // ---------- servomotor Valvetronic ----------
  R.part('valvetronic_servomotor', [-1.2, CAM_Y + 0.12, -1.0], (b) => {
    b.cyl('plastic', 0.15, 0.42, [0, 0, -0.18], 'z', 28);
    b.cyl('aluDark', 0.17, 0.06, [0, 0, 0.05], 'z', 28);
    b.cyl('steelDark', 0.03, 0.25, [0, 0, 0.18], 'z', 10); // ax melcat
    b.rbox('connector', [0.16, 0.12, 0.14], 0.02, [0, 0.19, -0.25]);
    b.box('accent', [0.04, 0.03, 0.06], [0, 0.26, -0.25]);
    b.bolts([[0.13, 0.12, 0.08], [-0.13, 0.12, 0.08], [0, -0.17, 0.08]], '-z', 0.03);
  });

  // ---------- culbutori cu role + elemente hidraulice ----------
  R.part('culbutori_tacheti', [0, CAM_Y - 0.2, 0], (b) => {
    CYL_X.forEach((x) => {
      for (const dx of [-VALVE_DX, VALVE_DX]) for (const side of [-1, 1]) {
        const zc = side * CAM_Z;
        b.box('steelDark', [0.06, 0.04, 0.32], [x + dx, -0.02, side * 0.31]);
        b.cyl('steel', 0.04, 0.05, [x + dx, 0.012, zc], 'x', 14); // rolă
        b.cyl('steel', 0.045, 0.22, [x + dx, -0.14, side * 0.46], 'y', 14); // element hidraulic
        if (side < 0) b.box('steel', [0.05, 0.12, 0.05], [x + dx, 0.09, -0.44]); // pârghie intermediară Valvetronic
      }
    });
  });

  // ---------- arcuri supape (16) ----------
  R.part('arcuri_supape', [0, 2.66, 0], (b) => {
    CYL_X.forEach((x) => {
      for (const dx of [-VALVE_DX, VALVE_DX]) for (const z of [-VALVE_Z, VALVE_Z]) {
        b.spring('steel', 0.052, 0.009, 5, 0.2, [x + dx, 0, z]);
        b.cyl('steelDark', 0.06, 0.02, [x + dx, 0.11, z], 'y', 16); // taler
      }
    });
  });

  // ---------- supape ----------
  const valves = (b, headR) => {
    CYL_X.forEach((x) => {
      for (const dx of [-VALVE_DX, VALVE_DX]) {
        b.lathe('steel', [[0, -0.005], [headR, 0], [headR, 0.02], [0.03, 0.08], [0.024, 0.12], [0.024, 0.44], [0, 0.44]], [x + dx, 0, 0], 'y', 24);
      }
    });
  };
  R.part('supape_admisie', [0, DECK_Y + 0.07, -VALVE_Z], (b) => valves(b, 0.12));
  R.part('supape_evacuare', [0, DECK_Y + 0.07, VALVE_Z], (b) => valves(b, 0.105));

  // ---------- garnitură capac chiulasă ----------
  R.part('garnitura_capac_chiulasa', [0, HEAD_TOP + 0.012, 0], (b) => {
    const s = roundedRect(BLOCK_X * 2, BLOCK_Z * 2, 0.08);
    s.holes.push(rectPath(BLOCK_X * 2 - 0.2, BLOCK_Z * 2 - 0.2, 0, 0, 0.05));
    b.extrude('rubber', s, 0.024, { along: 'y' });
    CYL_X.forEach((x) => b.torus('rubber', 0.12, 0.014, [x, 0, 0], 'y'));
  });

  // ---------- capac chiulasă (cu nervuri) ----------
  R.part('capac_chiulasa', [0, HEAD_TOP + 0.025, 0], (b) => {
    const H = COVER_TOP - HEAD_TOP - 0.025;
    const prof = polyShape([[-BLOCK_Z, 0], [BLOCK_Z, 0], [BLOCK_Z, 0.28], [0.6, H], [-0.6, H], [-BLOCK_Z, 0.28]]);
    b.extrude('plasticCover', prof, BLOCK_X * 2, { along: 'x', p: [0, 0, 0], bevel: 0.03 });
    // flanșă de jos
    b.box('plasticCover', [BLOCK_X * 2 + 0.04, 0.06, BLOCK_Z * 2 + 0.2], [0, 0.03, 0]);
    // nervuri transversale între puțurile bobinelor
    for (const x of [-1.82, -0.91, 0, 0.91, 1.82]) b.box('plasticCover', [0.05, 0.06, 1.15], [x, H + 0.02, 0]);
    // nervuri longitudinale pe pante
    for (const z of [-1, 1]) {
      b.box('plasticCover', [BLOCK_X * 2 - 0.2, 0.05, 0.05], [0, 0.42, z * 0.71], [z * 0.6, 0, 0]);
      for (const x of [-1.6, -1.1, -0.6, -0.1, 0.4, 0.9, 1.4]) b.box('plasticCover', [0.04, 0.22, 0.04], [x + 0.25, 0.3, z * 0.75]);
    }
    // puțuri bobine
    CYL_X.forEach((x) => b.cyl('dark', 0.14, 0.02, [x, H + 0.002, 0], 'y', 28));
    // bușon umplere ulei, element ventilație carter (integrat), bosaje senzori
    b.cyl('plastic', 0.13, 0.08, [-1.15, H + 0.04, 0.42], 'y', 28);
    for (let k = 0; k < 6; k++) b.box('plastic', [0.25, 0.04, 0.03], [-1.15, H + 0.1, 0.42], [0, (k * Math.PI) / 6, 0]);
    b.rbox('plasticCover', [0.7, 0.12, 0.3], 0.04, [0.6, H + 0.05, -0.38]);
    for (const z of [-CAM_Z, CAM_Z]) b.cyl('plasticCover', 0.08, 0.06, [1.82, H + 0.02, z], 'y', 20);
    // șuruburi de prindere (14)
    const bolts = [];
    for (const x of [-1.7, -1.0, -0.33, 0.33, 1.0, 1.7]) for (const z of [-1, 1]) bolts.push([x, 0.06, z * (BLOCK_Z + 0.07)]);
    b.bolts(bolts, 'y', 0.04);
    b.bolts([[-BLOCK_X, 0.06, 0], [BLOCK_X, 0.06, 0]], 'y', 0.04);
  });

  // ---------- capac acustic ----------
  R.part('capac_motor_acustic', [0, 4.42, 0], (b) => {
    const rim = roundedRect(3.7, 1.5, 0.3);
    rim.holes.push(rectPath(3.5, 1.3, 0, 0, 0.25));
    b.extrude('plastic', rim, 0.16, { along: 'y', p: [0, 0.08, 0] });
    b.extrude('plastic', roundedRect(3.7, 1.5, 0.3), 0.1, { along: 'y', p: [0, 0.2, 0], bevel: 0.04 });
    b.extrude('plasticGrey', roundedRect(2.6, 0.8, 0.2), 0.04, { along: 'y', p: [-0.2, 0.27, 0], bevel: 0.015 });
    for (const x of [-1.55, 1.55]) for (const z of [-0.55, 0.55]) b.cyl('rubber', 0.07, 0.03, [x, 0.265, z], 'y', 16);
  });
}
