// Ansamblul „ungere”: baie ulei, etanșare, bușon, senzori, pompă, sorb, carcasă filtru, filtru, răcitor.
import * as THREE from 'three';
import { roundedRect, rectPath, polyShape } from '../geom.js';
import { BLOCK_X } from '../dims.js';

const PAN_Z = 0.88;

/** Formă de stea (element filtrant plisat). */
function pleatShape(r1, r2, n) {
  const s = new THREE.Shape();
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2, r = i % 2 ? r1 : r2;
    if (i) s.lineTo(r * Math.cos(a), r * Math.sin(a)); else s.moveTo(r, 0);
  }
  s.closePath();
  return s;
}

export function register(R) {
  R.part('etansare_baie_ulei', [0, -0.61, 0], (b) => {
    const s = roundedRect(BLOCK_X * 2, PAN_Z * 2, 0.06);
    s.holes.push(rectPath(BLOCK_X * 2 - 0.14, PAN_Z * 2 - 0.14, 0, 0, 0.04));
    b.extrude('gasket', s, 0.02, { along: 'y' });
  });

  R.part('baie_ulei', [0, -0.62, 0], (b) => {
    // flanșă
    const fl = roundedRect(BLOCK_X * 2, PAN_Z * 2, 0.06);
    fl.holes.push(rectPath(BLOCK_X * 2 - 0.16, PAN_Z * 2 - 0.16, 0, 0, 0.04));
    b.extrude('alu', fl, 0.07, { along: 'y', p: [0, -0.035, 0] });
    // cuvă cu pereți înclinați (secțiune în planul (z,y), extrudată pe X)
    const prof = polyShape([[-0.86, -0.06], [-0.86, -0.4], [-0.58, -0.96], [0.58, -0.96], [0.86, -0.4], [0.86, -0.06]]);
    b.extrude('alu', prof, BLOCK_X * 2 - 0.04, { along: 'x', bevel: 0.025 });
    // nervuri de răcire pe fund și lateral
    for (const z of [-0.45, -0.27, -0.09, 0.09, 0.27, 0.45]) b.box('alu', [BLOCK_X * 2 - 0.3, 0.06, 0.03], [0, -1.0, z]);
    for (const x of [-1.5, -0.9, -0.3, 0.3, 0.9, 1.5]) for (const z of [-1, 1]) b.box('alu', [0.04, 0.4, 0.05], [x, -0.5, z * 0.8], [z * -0.45, 0, 0]);
    // șuruburi flanșă (din jos)
    const pts = [];
    for (const x of [-1.8, -1.2, -0.6, 0, 0.6, 1.2, 1.8]) for (const z of [-1, 1]) pts.push([x, -0.07, z * (PAN_Z - 0.04)]);
    for (const z of [-0.4, 0.4]) for (const x of [-1, 1]) pts.push([x * (BLOCK_X - 0.04), -0.07, z]);
    b.bolts(pts, '-y', 0.035);
    b.cyl('alu', 0.14, 0.04, [0.9, -0.995, 0.3], 'y', 24); // bosaj bușon
  });

  R.part('buson_golire_ulei', [0.9, -1.64, 0.3], (b) => {
    b.cyl('copper', 0.085, 0.015, [0, 0.01, 0], 'y', 24);
    b.cyl('steel', 0.07, 0.06, [0, -0.03, 0], 'y', 6);
    b.cyl('steel', 0.035, 0.1, [0, 0.07, 0], 'y', 12);
  });

  R.part('senzor_nivel_ulei', [0.2, -1.6, -0.25], (b) => {
    b.cyl('plastic', 0.13, 0.04, [0, -0.02, 0], 'y', 24);
    b.cyl('plastic', 0.08, 0.3, [0, 0.15, 0], 'y', 20);
    b.rbox('connector', [0.12, 0.1, 0.14], 0.02, [0, -0.08, -0.1]);
    b.bolts([[0.1, -0.04, 0.05], [-0.1, -0.04, 0.05], [0, -0.04, -0.11]], '-y', 0.025);
  });

  R.part('pompa_ulei', [-1.0, -0.98, 0.1], (b) => {
    b.rbox('aluDark', [0.62, 0.34, 0.5], 0.05, [0, 0, 0]);
    b.cyl('aluDark', 0.2, 0.12, [-0.36, 0, 0], 'x', 28);
    b.gear('steel', 0.13, 0.16, 18, 0.05, [-0.44, 0, 0], 'x');
    b.cyl('steelDark', 0.06, 0.25, [0.2, 0.05, 0.27], 'z', 14); // supapă reglare
    b.bolts([[0.25, 0.17, 0.2], [-0.25, 0.17, 0.2], [0.25, 0.17, -0.2], [-0.25, 0.17, -0.2]], 'y', 0.03);
    b.box('aluDark', [0.1, 0.4, 0.1], [0.15, 0.32, 0]); // racord spre bloc
  });

  R.part('sorb_ulei', [-1.0, -1.25, 0.1], (b) => {
    b.tube('steel', [[0.1, 0.1, 0], [0.18, 0.0, 0.05], [0.28, -0.12, 0.08], [0.32, -0.22, 0.05]], 0.045, { radial: 12 });
    b.cyl('steelDark', 0.24, 0.05, [0.32, -0.25, 0.05], 'y', 32);
    b.cyl('dark', 0.2, 0.052, [0.32, -0.255, 0.05], 'y', 32);
    b.box('steel', [0.1, 0.02, 0.14], [0.1, 0.11, 0]);
  });

  R.part('carcasa_filtru_ulei', [0.8, 0.9, -1.02], (b) => {
    b.lathe('alu', [[0.15, -0.38], [0.2, -0.38], [0.2, 0.3], [0.21, 0.3], [0.21, 0.36], [0.15, 0.36], [0.15, -0.38]], [0, 0, 0], 'y', 36);
    b.cyl('alu', 0.15, 0.04, [0, -0.36, 0], 'y', 28);
    b.box('alu', [0.4, 0.5, 0.22], [0, -0.05, 0.2]);            // flanșă spre bloc
    b.box('alu', [0.1, 0.12, 0.3], [0.25, 0.05, 0.0]);           // racord lichid răcire
    b.cyl('alu', 0.05, 0.25, [0.25, 0.05, -0.2], 'z', 14);
    b.bolts([[-0.16, 0.15, 0.32], [0.16, 0.15, 0.32], [-0.16, -0.25, 0.32], [0.16, -0.25, 0.32]], 'z', 0.03);
  });

  R.part('filtru_ulei', [0.8, 1.32, -1.02], (b) => {
    b.cyl('plastic', 0.2, 0.1, [0, 0, 0], 'y', 32);
    b.cyl('plastic', 0.09, 0.06, [0, 0.08, 0], 'y', 6);           // hexagon pentru cheie
    for (let k = 0; k < 12; k++) b.box('plastic', [0.02, 0.08, 0.06], [0.2 * Math.cos(k * Math.PI / 6), 0, 0.2 * Math.sin(k * Math.PI / 6)], [0, -k * Math.PI / 6, 0]);
    b.extrude('oilFilter', pleatShape(0.11, 0.14, 24), 0.55, { along: 'y', p: [0, -0.33, 0], curve: 2 });
    b.cyl('rubber', 0.15, 0.02, [0, -0.06, 0], 'y', 28);
  });

  R.part('racitor_ulei', [0.8, 0.7, -1.38], (b) => {
    for (let i = 0; i < 9; i++) b.box(i % 2 ? 'aluDark' : 'alu', [0.5, 0.028, 0.26], [0, -0.2 + i * 0.05, 0]);
    b.box('aluDark', [0.54, 0.04, 0.3], [0, -0.24, 0]);
    b.box('aluDark', [0.54, 0.04, 0.3], [0, 0.24, 0]);
    for (const x of [-0.18, 0.18]) b.cyl('alu', 0.04, 0.12, [x, 0.3, 0], 'y', 14);
    b.bolts([[-0.22, 0.27, 0.1], [0.22, 0.27, 0.1]], 'y', 0.025);
  });

  R.part('senzor_presiune_ulei', [1.35, 0.25, -0.9], (b) => {
    b.cyl('brass', 0.05, 0.06, [0, 0, -0.01], 'z', 6);
    b.cyl('brass', 0.025, 0.08, [0, 0, 0.05], 'z', 12);
    b.cyl('plastic', 0.045, 0.1, [0, 0, -0.09], 'z', 16);
    b.rbox('connector', [0.09, 0.09, 0.08], 0.015, [0, 0, -0.17]);
  });
}
