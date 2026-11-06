// Ansamblul „supraalimentare”: garnitură, turbocompresor (carcase spirale), wastegate, sondă lambda, conducte, intercooler.
import { roundedRect, rectPath, voluteGeometry } from '../geom.js';
import { CYL_X, BLOCK_Z, FLOOR_Y } from '../dims.js';

export const TURBO_C = [0, 2.1, 1.7];          // axa turbo (paralelă cu X) trece prin (y, z) = (2.1, 1.7)
const TURB_X = 0.3, COMP_X = -0.22;
export const COMP_OUT = [COMP_X, 2.34, 2.15];  // ieșire compresor (spre intercooler)
export const COMP_IN = [-0.48, 2.1, 1.7];      // intrare compresor (aer filtrat)
export const IC = [-3.45, -0.35, 0];           // centrul intercoolerului
const EX_Y = 2.6, EX_Z = BLOCK_Z + 0.08;       // flanșa evacuare pe chiulasă

const rel = (p, a) => [p[0] - a[0], p[1] - a[1], p[2] - a[2]];

export function register(R) {
  R.part('garnitura_turbo', [0, EX_Y, EX_Z], (b) => {
    const s = roundedRect(3.5, 0.38, 0.06);
    CYL_X.forEach((x) => s.holes.push(rectPath(0.36, 0.22, x, 0, 0.08)));
    b.extrude('mls', s, 0.02, { along: 'z' });
  });

  R.part('turbocompresor', TURBO_C, (b) => {
    const A = TURBO_C;
    // galerie evacuare integrată: flanșă + 4 canale spre carcasa turbinei
    b.box('exhaust', [3.5, 0.4, 0.07], rel([0, EX_Y, EX_Z + 0.045], A));
    CYL_X.forEach((x) => {
      b.bolts([rel([x - 0.26, EX_Y + 0.15, EX_Z + 0.08], A), rel([x + 0.26, EX_Y - 0.15, EX_Z + 0.08], A)], 'z', 0.035);
      b.tube('exhaust', [rel([x, EX_Y, EX_Z + 0.06], A), rel([x * 0.85, EX_Y + 0.02, EX_Z + 0.3], A), rel([x * 0.45 + TURB_X * 0.4, 2.42, 1.3], A), rel([TURB_X, 2.3, 1.42], A)], 0.11, { radial: 14 });
    });
    // carcasa turbinei (volută) + disc central
    b.add(voluteGeometry(0.17, 0.27, 0.09, 0.19), 'exhaust', { p: [TURB_X, 0, 0], r: [-1.2, 0, 0] });
    b.cyl('exhaust', 0.27, 0.26, [TURB_X + 0.02, 0, 0], 'x', 36);
    b.cyl('exhaust', 0.17, 0.08, [TURB_X + 0.17, 0, 0], 'x', 28);
    // ieșire turbină + cot spre țeava de evacuare
    b.tube('exhaust', [[TURB_X + 0.1, 0, 0], [TURB_X + 0.32, 0, 0], [TURB_X + 0.47, -0.18, 0.04], [TURB_X + 0.5, -0.52, 0.08]], 0.13, { radial: 16 });
    b.cyl('steelDark', 0.19, 0.04, [TURB_X + 0.5, -0.55, 0.08], 'y', 28);
    // carcasa lagărelor (CHRA) + conducte ulei/apă
    b.cyl('iron', 0.12, 0.3, [0.03, 0, 0], 'x', 24);
    b.tube('steel', [[0.05, -0.12, 0], [0.08, -0.4, -0.1], [0.05, -0.8, -0.6], [0.0, -0.9, -0.82]], 0.022, { radial: 8 });
    b.tube('steel', [[-0.02, 0.12, -0.04], [-0.1, 0.35, -0.3], [-0.3, 0.4, -0.75]], 0.02, { radial: 8 });
    // carcasa compresorului (aluminiu) cu ieșire tangențială sus, spre +Z
    b.add(voluteGeometry(0.15, 0.22, 0.07, 0.13), 'alu', { p: [COMP_X, 0, 0], r: [-Math.PI * 2 * 0.92, 0, 0] });
    b.cyl('alu', 0.24, 0.16, [COMP_X + 0.04, 0, 0], 'x', 36);
    b.cyl('alu', 0.3, 0.05, [COMP_X + 0.13, 0, 0], 'x', 36);
    b.lathe('alu', [[0.1, 0], [0.135, 0], [0.135, -0.26], [0.1, -0.26], [0.1, 0]], [COMP_X - 0.02, 0, 0], 'x', 32);
    b.cyl('alu', 0.1, 0.45, rel([COMP_X, 2.34, 1.93], A), 'z', 24);
    b.torus('alu', 0.1, 0.018, rel(COMP_OUT, A), 'z');
    // roata compresorului (vizibilă prin intrare) — se rotește la funcționare
    const w = b.sub('wheel', [COMP_X - 0.06, 0, 0]);
    w.cyl('aluMach', 0.025, 0.14, [-0.07, 0, 0], 'x', 16, 0.06);
    for (let k = 0; k < 7; k++) w.box('aluMach', [0.12, 0.008, 0.085], [-0.06, 0.06 * Math.cos(k * 0.9), 0.06 * Math.sin(k * 0.9)], [k * 0.9 + Math.PI / 2, 0, 0.5]);
  });

  R.part('actuator_wastegate', [COMP_X, 2.68, 1.62], (b) => {
    b.cyl('steelDark', 0.12, 0.12, [0, 0, 0], 'z', 32);
    b.cyl('steelDark', 0.13, 0.02, [0, 0, 0.06], 'z', 32);
    b.box('steelDark', [0.06, 0.18, 0.04], [0, -0.12, -0.04]);   // suport
    b.cyl('steel', 0.012, 0.6, [0.32, -0.02, -0.02], 'x', 8);     // tijă
    b.box('steel', [0.03, 0.14, 0.03], [0.62, -0.08, -0.02]);    // levier clapetă
    b.rbox('connector', [0.1, 0.08, 0.1], 0.015, [-0.12, 0.08, 0.04]);
  });

  R.part('sonda_lambda', [TURB_X + 0.25, TURBO_C[1] - 0.12, TURBO_C[2] + 0.02], (b) => {
    b.cyl('steel', 0.04, 0.06, [0, 0, 0], 'y', 6);
    b.cyl('steel', 0.025, 0.12, [0, -0.08, 0], 'y', 12);
    b.cyl('steel', 0.022, 0.08, [0, 0.07, 0], 'y', 12);
    b.tube('harness', [[0, -0.14, 0], [0.05, -0.3, 0.05], [0.12, -0.4, 0.2]], 0.015, { radial: 6 });
    b.rbox('connector', [0.08, 0.06, 0.12], 0.015, [0.12, -0.42, 0.26]);
  });

  R.part('conducta_aer_turbo', [0, 0, 0], (b) => {
    b.tube('plastic', [COMP_IN, [-0.75, 2.12, 1.7], [-1.05, 2.4, 1.6], [-1.3, 3.05, 1.4], [-1.45, 3.75, 1.2]], 0.13, { radial: 18 });
    b.torus('clamp', 0.135, 0.016, [-0.55, 2.1, 1.7], 'x');
    b.torus('rubber', 0.14, 0.03, [-1.45, 3.75, 1.2], [-0.2, 1, -0.3]);
    for (let i = 0; i < 4; i++) b.torus('plastic', 0.14, 0.012, [-1.18 - i * 0.05, 2.65 + i * 0.16, 1.52 - i * 0.04], [-0.35, 1, -0.3]);
  });

  R.part('intercooler', IC, (b) => {
    b.box('aluDark', [0.2, 1.0, 1.85], [0, 0, 0]);
    for (let i = 0; i < 19; i++) b.box('fin', [0.23, 0.012, 1.84], [0, -0.48 + i * 0.053, 0]);
    for (const z of [-1, 1]) {
      b.rbox('plastic', [0.3, 1.1, 0.22], 0.05, [0, 0, z * 1.03]);
      b.cyl('plastic', 0.11, 0.22, [0.2, 0.3, z * 1.05], 'x', 20);
      // picioare de sprijin până la podea (doar pentru vizualizare pe stand)
      b.cyl('steelDark', 0.03, IC[1] - FLOOR_Y - 0.55, [0, -0.55 - (IC[1] - FLOOR_Y - 0.55) / 2, z * 0.8], 'y', 10);
      b.box('steelDark', [0.5, 0.03, 0.12], [0, FLOOR_Y - IC[1] + 0.015, z * 0.8]);
    }
  });

  R.part('conducta_turbo_intercooler', [0, 0, 0], (b) => {
    const end = [IC[0] + 0.32, IC[1] + 0.3, 1.05];
    b.tube('hose', [COMP_OUT, [COMP_X - 0.02, 2.3, 2.42], [-0.7, 1.6, 2.52], [-1.9, 0.55, 2.2], [-2.9, 0.0, 1.35], [end[0] + 0.2, end[1], end[2]], end], 0.1, { radial: 16, seg: 120 });
    b.torus('clamp', 0.105, 0.014, [COMP_X, 2.34, 2.25], 'z');
    b.torus('clamp', 0.105, 0.014, [end[0] + 0.05, end[1], end[2]], 'x');
  });

  R.part('conducta_intercooler_admisie', [0, 0, 0], (b) => {
    const st = [IC[0] + 0.32, IC[1] + 0.3, -1.05];
    b.tube('hose', [st, [st[0] + 0.2, st[1], st[2] - 0.05], [-2.85, 0.5, -1.6], [-2.8, 1.55, -1.7], [-2.55, 2.15, -1.52], [-2.22, 2.15, -1.5]], 0.1, { radial: 16, seg: 120 });
    b.torus('clamp', 0.105, 0.014, [-2.28, 2.15, -1.5], 'x');
    b.torus('clamp', 0.105, 0.014, [st[0] + 0.05, st[1], st[2]], 'x');
  });
}
