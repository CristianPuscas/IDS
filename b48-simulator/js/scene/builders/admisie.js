// Ansamblul „admisie”: garnitură, galerie (plenum + canale), clapetă accelerație, senzor presiune.
import * as THREE from 'three';
import { roundedRect, rectPath } from '../geom.js';
import { CYL_X, BLOCK_Z } from '../dims.js';

export const PLENUM = [0, 2.15, -1.5];
const PORT_Y = 2.63, PORT_Z = -BLOCK_Z - 0.08;

export function register(R) {
  R.part('garnitura_galerie_admisie', [0, PORT_Y, PORT_Z - 0.01], (b) => {
    const s = roundedRect(3.5, 0.36, 0.06);
    CYL_X.forEach((x) => s.holes.push(rectPath(0.34, 0.22, x, 0, 0.08)));
    b.extrude('rubber', s, 0.02, { along: 'z' });
  });

  R.part('galerie_admisie', PLENUM, (b) => {
    const [ax, ay, az] = PLENUM;
    const r = (x, y, z) => [x - ax, y - ay, z - az];
    // plenum (secțiune rotunjită extrudată pe X)
    b.extrude('plastic', roundedRect(0.5, 0.8, 0.2), 3.4, { along: 'x', bevel: 0.03 });
    for (const x of [-1.2, -0.4, 0.4, 1.2]) b.box('plastic', [0.04, 0.84, 0.54], [x, 0, 0]);
    b.box('plastic', [3.3, 0.04, 0.04], [0, 0, -0.27]);
    // flanșa spre chiulasă + canale
    b.box('plastic', [3.5, 0.36, 0.05], r(0, PORT_Y, PORT_Z - 0.045));
    CYL_X.forEach((x) => {
      b.tube('plastic', [r(x, PORT_Y, PORT_Z - 0.05), r(x, 2.78, -1.05), r(x * 0.98, 2.82, -1.32), r(x * 0.96, 2.5, -1.52)], 0.11, { radial: 14 });
      b.bolts([r(x - 0.27, PORT_Y + 0.12, PORT_Z - 0.07), r(x + 0.27, PORT_Y - 0.12, PORT_Z - 0.07)], '-z', 0.03);
    });
    // flanșa clapetei (față, −X)
    b.cyl('plastic', 0.17, 0.06, [-1.72, 0, 0], 'x', 28);
  });

  R.part('clapeta_acceleratie', [-1.93, PLENUM[1], PLENUM[2]], (b) => {
    const ring = [[0.13, 0.17], [0.19, 0.17], [0.19, -0.17], [0.13, -0.17], [0.13, 0.17]];
    b.lathe('alu', ring, [0, 0, 0], 'x', 32);
    b.rbox('alu', [0.26, 0.38, 0.38], 0.04, [0.02, 0, 0]);
    b.lathe('dark', [[0.131, 0.172], [0.131, -0.172]], [0, 0, 0], 'x', 32);
    // clapeta (fluture) înclinată în interiorul alezajului
    b.add(new THREE.CylinderGeometry(0.125, 0.125, 0.01, 28), 'steel', { p: [-0.08, 0, 0], r: [0, 0, Math.PI / 2 - 0.35] });
    b.add(new THREE.CylinderGeometry(0.13, 0.13, 0.01, 28), 'dark', { p: [0.0, 0, 0], r: [0, 0, Math.PI / 2] });
    b.rbox('plastic', [0.22, 0.3, 0.14], 0.04, [0.0, 0.02, -0.25]);  // carcasă motor electric
    b.rbox('connector', [0.1, 0.1, 0.12], 0.02, [0.0, 0.2, -0.28]);
    b.bolts([[0.12, 0.15, 0.15], [0.12, -0.15, -0.15], [0.12, 0.15, -0.15], [0.12, -0.15, 0.15]], 'x', 0.025);
  });

  R.part('senzor_presiune_admisie', [0.7, PLENUM[1] + 0.43, PLENUM[2]], (b) => {
    b.rbox('plastic', [0.14, 0.08, 0.12], 0.02, [0, 0.04, 0]);
    b.rbox('connector', [0.1, 0.09, 0.1], 0.02, [0.1, 0.07, 0]);
    b.box('accent', [0.04, 0.02, 0.05], [0.1, 0.125, 0]);
    b.bolt([-0.1, 0.0, 0], 'y', 0.025);
  });
}
