// Ansamblul „bloc”: bloc motor, arbore cotit, biele, pistoane, segmenți, arbori de echilibrare.
import * as THREE from 'three';
import { roundedRect, circlePath, polyShape } from '../geom.js';
import { CYL_X, CRANK_R, ROD_L, BORE_R, DECK_Y, BLOCK_X, BLOCK_Z, JOURNAL_X, PIN_PHASE, pistonPinY } from '../dims.js';

/** Forma unui braț de arbore cotit cu contragreutate (în planul (z,y), manetonul spre +y). */
function webShape() {
  const s = new THREE.Shape();
  s.moveTo(0.27, CRANK_R);
  s.absarc(0, CRANK_R, 0.27, 0, Math.PI, false);
  s.lineTo(-0.3, 0.05);
  s.absarc(0, 0, 0.6, Math.PI + 0.55, Math.PI * 2 - 0.55, false);
  s.lineTo(0.3, 0.05);
  s.closePath();
  return s;
}

export function register(R) {
  // ---------- bloc motor ----------
  R.part('bloc_motor', [0, 0, 0], (b) => {
    // zona cilindrilor: extrudare pe Y cu 4 alezaje (vizibile în x-ray)
    const top = roundedRect(BLOCK_X * 2, BLOCK_Z * 2, 0.08);
    CYL_X.forEach((x) => top.holes.push(circlePath(x, 0, BORE_R)));
    b.extrude('alu', top, DECK_Y - 0.55, { along: 'y', p: [0, (DECK_Y + 0.55) / 2, 0], curve: 32 });
    // cămăși (inele de fontă la nivelul feței)
    CYL_X.forEach((x) => b.add(new THREE.RingGeometry(BORE_R, BORE_R + 0.035, 40), 'iron', { p: [x, DECK_Y + 0.002, 0], r: [-Math.PI / 2, 0, 0] }));
    // carter inferior (cadru gol) + pereți laterali mai lați
    const skirt = roundedRect(BLOCK_X * 2, 1.76, 0.06);
    skirt.holes.push(roundedRect(BLOCK_X * 2 - 0.16, 1.5, 0.05));
    b.extrude('alu', skirt, 1.15, { along: 'y', p: [0, -0.025, 0] });
    // pereți paliere cu lagăre (vizibili în x-ray)
    for (const x of JOURNAL_X) {
      const bh = roundedRect(1.5, 1.15, 0.05, 0, -0.025);
      bh.holes.push(circlePath(0, 0, 0.29));
      b.extrude('aluDark', bh, 0.1, { along: 'x', p: [x, 0, 0] });
      // capace paliere cu șuruburi (de jos)
      b.box('iron', [0.14, 0.12, 0.8], [x, -0.36, 0]);
      b.bolts([[x, -0.42, -0.3], [x, -0.42, 0.3]], '-y', 0.04);
    }
    // nervuri verticale pe pereții laterali (manta de apă)
    for (const z of [-1, 1]) {
      for (const x of [-1.82, -0.91, 0, 0.91, 1.82]) b.box('alu', [0.08, 1.6, 0.06], [x, 1.35, z * (BLOCK_Z + 0.02)]);
      b.box('alu', [BLOCK_X * 2 - 0.1, 0.07, 0.06], [0, 0.6, z * 0.9]); // centură carter
      for (const x of [-1.4, -0.45, 0.45, 1.4]) b.box('alu', [0.06, 0.9, 0.05], [x, 0.05, z * 0.9]);
      // flanșă baie ulei
      b.box('aluMach', [BLOCK_X * 2, 0.05, 0.12], [0, -0.575, z * 0.82]);
    }
    // fața spate (flanșă distribuție/cutie) și fața față
    b.box('aluDark', [0.05, 2.7, 1.5], [BLOCK_X + 0.025, 0.85, 0]);
    b.box('aluDark', [0.04, 2.6, 1.4], [-BLOCK_X - 0.02, 0.9, 0]);
    b.cyl('aluMach', 0.3, 0.06, [-BLOCK_X - 0.06, 0, 0], 'x', 32); // carcasă simering față
    // bosaje (suporți, pompă)
    b.box('alu', [0.5, 0.35, 0.08], [-0.4, 0.9, -0.84]);
    b.box('alu', [0.5, 0.35, 0.08], [-0.6, 0.7, 0.84]);
    // șuruburi chiulasă vizibile la fața blocului (capete în chiulasă) — aici doar găuri filetate
    for (const x of JOURNAL_X) for (const z of [-0.62, 0.62]) b.add(new THREE.CircleGeometry(0.045, 12), 'dark', { p: [x, DECK_Y + 0.003, z], r: [-Math.PI / 2, 0, 0] });
  });

  // ---------- arbore cotit (pivot pe axa X, y = 0) ----------
  R.part('arbore_cotit', [0, 0, 0], (b) => {
    for (const x of JOURNAL_X) b.cyl('steel', 0.26, 0.2, [x, 0, 0], 'x', 32);
    const web = webShape();
    CYL_X.forEach((x, i) => {
      const flip = PIN_PHASE[i] ? Math.PI : 0;
      const py = Math.cos(PIN_PHASE[i]) * CRANK_R;
      b.cyl('steel', 0.23, 0.24, [x, py, 0], 'x', 28); // maneton
      for (const dx of [-0.17, 0.17]) b.extrude('steelDark', web, 0.1, { along: 'x', p: [x + dx, 0, 0], r: [flip, 0, 0], curve: 16 });
    });
    b.cyl('steel', 0.19, 0.3, [-2.05, 0, 0], 'x', 24);      // capăt față (spre amortizor)
    b.cyl('steel', 0.15, 0.5, [2.18, 0, 0], 'x', 24);       // capăt spate
    b.cyl('steelDark', 0.45, 0.06, [2.42, 0, 0], 'x', 40);  // flanșă volantă
  });

  // ---------- biele, pistoane, segmenți (pivot = bolțul pistonului) ----------
  CYL_X.forEach((x, i) => {
    const n = i + 1;
    const pinY = pistonPinY(PIN_PHASE[i]);
    R.part(`biela_${n}`, [x, pinY, 0], (b) => {
      b.cyl('steelDark', 0.13, 0.17, [0, 0, 0], 'x', 24);            // ochi mic
      b.box('steelDark', [0.06, ROD_L - 0.42, 0.15], [0, -ROD_L / 2, 0]); // inima profilului I
      for (const z of [-0.07, 0.07]) b.box('steelDark', [0.15, ROD_L - 0.42, 0.035], [0, -ROD_L / 2, z]);
      b.cyl('steelDark', 0.33, 0.2, [0, -ROD_L, 0], 'x', 32);       // cap bielă
      b.box('steelDark', [0.2, 0.12, 0.76], [0, -ROD_L - 0.02, 0]);    // capac bielă
      b.bolts([[0, -ROD_L - 0.08, -0.3], [0, -ROD_L - 0.08, 0.3]], '-y', 0.045);
    });
    R.part(`piston_${n}`, [x, pinY, 0], (b) => {
      b.lathe('piston', [[0, 0.3], [0.36, 0.3], [0.395, 0.28], [0.395, 0.26], [0.385, 0.255], [0.385, 0.235], [0.395, 0.23],
        [0.395, 0.21], [0.385, 0.205], [0.385, 0.185], [0.395, 0.18], [0.395, -0.05], [0.388, -0.28], [0.34, -0.28], [0.34, 0.16], [0, 0.16]], [0, 0, 0], 'y', 40);
      b.cyl('steel', 0.1, 0.62, [0, 0, 0], 'x', 20); // bolț
      b.cyl('dark', 0.25, 0.005, [0, 0.302, 0], 'y', 32, 0.25); // calotă (depuneri)
    });
    R.part(`segmenti_${n}`, [x, pinY, 0], (b) => {
      b.torus('steel', 0.397, 0.011, [0, 0.245, 0], 'y', Math.PI * 2, 48);
      b.torus('steel', 0.397, 0.011, [0, 0.195, 0], 'y', Math.PI * 2, 48);
      b.torus('steelDark', 0.395, 0.013, [0, 0.145, 0], 'y', Math.PI * 2, 48);
    });
  });

  // ---------- arbori de echilibrare (în baia de ulei) ----------
  R.part('arbori_echilibrare', [0.55, -1.12, 0], (b) => {
    b.box('aluDark', [1.7, 0.06, 0.9], [0, -0.2, 0]);
    for (const x of [-0.82, 0.82]) b.box('aluDark', [0.07, 0.4, 0.9], [x, 0, 0]);
    b.box('aluDark', [0.07, 0.4, 0.9], [0, 0, 0]);
    b.bolts([[-0.82, 0.22, -0.38], [-0.82, 0.22, 0.38], [0.82, 0.22, -0.38], [0.82, 0.22, 0.38]], 'y', 0.04);
    for (const [name, z] of [['shaftA', -0.27], ['shaftB', 0.27]]) {
      const s = b.sub(name, [0, 0, z]);
      s.cyl('steel', 0.06, 1.75, [0, 0, 0], 'x', 16);
      const w = new THREE.Shape(); w.absarc(0, 0, 0.17, 0.15 * Math.PI, 0.85 * Math.PI, false); w.lineTo(0, 0); w.closePath();
      for (const x of [-0.42, 0.42]) s.extrude('steelDark', w, 0.3, { along: 'x', p: [x, 0, 0] });
      s.gear('steel', 0.13, 0.155, 20, 0.08, [-0.95, 0, 0], 'x');
    }
  });
}
