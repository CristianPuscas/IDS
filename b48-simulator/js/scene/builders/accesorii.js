// Ansamblul „accesorii”: curea (pe învelitoarea fuliilor), întinzător, amortizor, alternator, compresor AC, volantă, suporți.
import * as THREE from 'three';
import { hullOfCircles, offsetPoly, polyShape, circlePath, gearShape } from '../geom.js';
import { BELT_X, BLOCK_X } from '../dims.js';
import { WATER_PUMP_C } from './racire.js';

// Fulii în planul curelei (u = z, v = y, r)
export const PULLEYS = {
  crank: [0, 0, 0.45],
  ac: [-1.1, -0.35, 0.26],
  tensioner: [-1.45, 0.45, 0.12],
  alternator: [-1.05, 1.3, 0.14],
  pump: [WATER_PUMP_C[1], WATER_PUMP_C[0], 0.17],
};
const ALT = [-1.8, PULLEYS.alternator[1], PULLEYS.alternator[0]];
const AC = [-1.8, PULLEYS.ac[1], PULLEYS.ac[0]];
const TENS = [-2.12, PULLEYS.tensioner[1], PULLEYS.tensioner[0]];

export function register(R) {
  R.part('curea_accesorii', [BELT_X, 0, 0], (b) => {
    const hull = hullOfCircles(Object.values(PULLEYS), 96);
    const outer = offsetPoly(hull, 0.035);
    const sh = polyShape(outer);
    const hole = new THREE.Path(); hull.slice().reverse().forEach(([u, v], i) => (i ? hole.lineTo(u, v) : hole.moveTo(u, v))); hole.closePath();
    sh.holes.push(hole);
    b.extrude('rubber', sh, 0.12, { along: 'x', curve: 2 });
  });

  R.part('amortizor_vibratii', [BELT_X, 0, 0], (b) => {
    b.pulley('iron', 0.45, 0.14, [0, 0, 0], 8);
    const face = new THREE.Shape(); face.absarc(0, 0, 0.38, 0, Math.PI * 2, false);
    for (let k = 0; k < 6; k++) face.holes.push(circlePath(0.24 * Math.cos(k * Math.PI / 3), 0.24 * Math.sin(k * Math.PI / 3), 0.05));
    b.extrude('steelDark', face, 0.04, { along: 'x', p: [-0.09, 0, 0] });
    b.cyl('rubber', 0.41, 0.1, [-0.02, 0, 0], 'x', 40);
    b.cyl('steel', 0.13, 0.12, [-0.1, 0, 0], 'x', 28);
    b.cyl('steelDark', 0.09, 0.08, [-0.18, 0, 0], 'x', 6);   // șurub central
    b.cyl('steel', 0.2, 0.14, [0.12, 0, 0], 'x', 28);        // butuc spre arbore
  });

  R.part('alternator', ALT, (b) => {
    b.lathe('alu', [[0, -0.36], [0.26, -0.36], [0.3, -0.3], [0.3, 0.3], [0.26, 0.36], [0, 0.36]], [0, 0, 0], 'x', 36);
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      b.box('dark', [0.12, 0.03, 0.05], [-0.26, 0.301 * Math.cos(a), 0.301 * Math.sin(a)], [a, 0, 0]);
    }
    b.box('alu', [0.25, 0.3, 0.1], [0.05, 0.05, 0.33]);            // urechi de prindere spre bloc
    b.bolts([[0.15, 0.13, 0.39], [-0.08, -0.05, 0.39]], 'z', 0.03);
    b.cyl('plastic', 0.13, 0.06, [0.39, 0, 0], 'x', 24);
    b.rbox('connector', [0.08, 0.1, 0.12], 0.015, [0.36, 0.2, 0]);
    b.cyl('copper', 0.02, 0.08, [0.4, -0.12, 0.1], 'x', 8);        // borna B+
    const s = b.sub('spin', [BELT_X - ALT[0], 0, 0]);
    s.pulley('steel', 0.14, 0.12, [0, 0, 0], 6);
    s.cyl('steelDark', 0.05, 0.1, [-0.08, 0, 0], 'x', 6);
    for (let k = 0; k < 8; k++) s.box('aluDark', [0.04, 0.2, 0.02], [0.15, 0.1 * Math.cos(k * Math.PI / 4), 0.1 * Math.sin(k * Math.PI / 4)], [k * Math.PI / 4, 0, 0]);
  });

  R.part('compresor_ac', AC, (b) => {
    b.lathe('alu', [[0, -0.33], [0.24, -0.33], [0.27, -0.28], [0.27, 0.3], [0.22, 0.35], [0, 0.35]], [0, 0, 0], 'x', 36);
    for (const x of [-0.15, 0.0, 0.15]) b.torus('alu', 0.272, 0.012, [x, 0, 0], 'x');
    b.box('alu', [0.5, 0.12, 0.12], [0.05, 0.0, 0.3]);            // urechi de prindere
    b.bolts([[0.2, 0.0, 0.37], [-0.1, 0.0, 0.37]], 'z', 0.03);
    for (const x of [0.05, 0.2]) { b.box('aluDark', [0.1, 0.12, 0.1], [x, 0.3, 0]); b.cyl('steel', 0.03, 0.12, [x, 0.4, 0], 'y', 10); }
    const s = b.sub('spin', [BELT_X - AC[0], 0, 0]);
    s.pulley('steel', 0.26, 0.12, [0, 0, 0], 6);
    s.cyl('steelDark', 0.2, 0.03, [-0.075, 0, 0], 'x', 32);        // placă ambreiaj
    s.cyl('steelDark', 0.05, 0.05, [-0.1, 0, 0], 'x', 6);
  });

  R.part('intinzator_curea', TENS, (b) => {
    const pivot = [0.1, 0.42, 0.55]; // (x, y, z) relativ — pe fața blocului
    b.tube('aluDark', [[0.05, 0, 0], [0.08, 0.2, 0.28], [pivot[0], pivot[1], pivot[2]]], 0.045, { radial: 6 });
    b.cyl('aluDark', 0.11, 0.12, pivot, 'x', 24);
    b.cyl('aluDark', 0.08, 0.3, [0.12, 0.15, 0.38], 'x', 20);       // amortizor arc
    b.bolt([pivot[0] - 0.06, pivot[1], pivot[2]], '-x', 0.035);
    const s = b.sub('spin', [BELT_X - TENS[0], 0, 0]);
    s.lathe('steel', [[0, -0.065], [0.12, -0.065], [0.125, -0.05], [0.125, 0.05], [0.12, 0.065], [0, 0.065]], [0, 0, 0], 'x', 32);
    s.cyl('steelDark', 0.05, 0.14, [0, 0, 0], 'x', 6);
  });

  R.part('volanta', [2.5, 0, 0], (b) => {
    const disc = new THREE.Shape(); disc.absarc(0, 0, 1.27, 0, Math.PI * 2, false);
    for (let k = 0; k < 6; k++) disc.holes.push(circlePath(0.78 * Math.cos(k * Math.PI / 3 + 0.5), 0.78 * Math.sin(k * Math.PI / 3 + 0.5), 0.16));
    b.extrude('steelDark', disc, 0.1, { along: 'x', curve: 48 });
    b.extrude('steel', gearShape(1.27, 1.34, 100, 1.2), 0.06, { along: 'x', p: [-0.02, 0, 0], curve: 64 });
    b.cyl('steel', 0.36, 0.16, [0.02, 0, 0], 'x', 36);
    b.cyl('aluMach', 1.05, 0.02, [0.06, 0, 0], 'x', 64, 1.05);    // suprafața de frecare
    for (let k = 0; k < 8; k++) b.bolt([0.1, 0.25 * Math.cos(k * Math.PI / 4), 0.25 * Math.sin(k * Math.PI / 4)], 'x', 0.035);
  });

  const mount = (b, side) => {
    b.box('alu', [0.62, 0.45, 0.08], [0, 0, side * 0.13]);
    b.box('alu', [0.3, 0.18, 0.5], [0, 0.0, side * -0.12]);
    b.box('alu', [0.08, 0.35, 0.4], [0, -0.08, side * -0.05]);
    b.cyl('rubber', 0.16, 0.22, [0, 0.0, side * -0.42], 'y', 24);
    b.cyl('steelDark', 0.18, 0.04, [0, 0.13, side * -0.42], 'y', 24);
    b.cyl('steel', 0.03, 0.16, [0, 0.22, side * -0.42], 'y', 10);
    b.bolts([[-0.22, 0.15, side * 0.17], [0.22, 0.15, side * 0.17], [-0.22, -0.15, side * 0.17], [0.22, -0.15, side * 0.17]], side > 0 ? '-z' : 'z', 0.035);
  };
  R.part('suport_motor_stanga', [-0.4, 0.9, -0.95], (b) => mount(b, 1));
  R.part('suport_motor_dreapta', [-0.6, 0.7, 0.95], (b) => mount(b, -1));
}

export { BLOCK_X };
