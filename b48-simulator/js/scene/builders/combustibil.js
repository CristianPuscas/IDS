// Ansamblul „combustibil”: pompă de înaltă presiune, conductă, rampă, injectoare (injecție directă).
import * as THREE from 'three';
import { CYL_X, BLOCK_Z } from '../dims.js';

const INJ_DIR = new THREE.Vector3(0, 0.25, 1).normalize(); // spre camera de ardere
const INJ_Y = 2.42, INJ_Z = -BLOCK_Z - 0.02;
export const RAIL = [0, 2.28, -1.1];

export function register(R) {
  CYL_X.forEach((x, i) => {
    R.part(`injector_${i + 1}`, [x, INJ_Y, INJ_Z], (b) => {
      b.lathe('steel', [[0, -0.26], [0.045, -0.26], [0.05, -0.2], [0.05, -0.12], [0.042, -0.1], [0.042, 0.1], [0.028, 0.13], [0.018, 0.27], [0, 0.3]], [0, 0, 0], INJ_DIR, 24);
      b.torus('rubber', 0.045, 0.01, INJ_DIR.clone().multiplyScalar(0.06).toArray(), INJ_DIR);
      const c = INJ_DIR.clone().multiplyScalar(-0.17);
      b.rbox('connector', [0.08, 0.09, 0.08], 0.015, [c.x, c.y + 0.08, c.z]);
      b.box('accent', [0.04, 0.02, 0.04], [c.x, c.y + 0.135, c.z]);
    });
  });

  R.part('rampa_combustibil', RAIL, (b) => {
    b.cyl('steel', 0.07, 3.5, [0, 0, 0], 'x', 24);
    for (const s of [-1, 1]) b.cyl('steelDark', 0.08, 0.06, [s * 1.75, 0, 0], 'x', 6);
    CYL_X.forEach((x) => {
      const p = new THREE.Vector3(x, INJ_Y - RAIL[1], INJ_Z - RAIL[2]).addScaledVector(INJ_DIR, -0.25);
      b.add(new THREE.CylinderGeometry(0.06, 0.06, 0.12, 20), 'steel', { p: p.toArray(), axis: INJ_DIR });
    });
    for (const x of [-0.9, 0.9]) {
      b.box('steelDark', [0.12, 0.3, 0.05], [x, 0.12, 0.17]);
      b.bolt([x, 0.2, 0.2], 'z', 0.03);
    }
    b.cyl('brass', 0.04, 0.08, [-1.83, 0, 0], 'x', 6); // senzor presiune rampă
    b.cyl('plastic', 0.04, 0.12, [-1.93, 0, 0], 'x', 16);
  });

  R.part('pompa_inalta_presiune', [1.55, 3.3, -1.0], (b) => {
    b.lathe('aluMach', [[0, -0.2], [0.17, -0.2], [0.17, -0.16], [0.12, -0.15], [0.12, 0.12], [0.1, 0.16], [0, 0.16]], [0, 0, 0], 'y', 32);
    b.bolts([[0.13, -0.15, 0.06], [-0.13, -0.15, -0.06]], 'y', 0.03);
    b.cyl('plastic', 0.07, 0.12, [0, 0.21, 0], 'y', 20);          // electrovalvă dozare
    b.rbox('connector', [0.08, 0.08, 0.1], 0.015, [0, 0.29, -0.06]);
    b.cyl('steel', 0.035, 0.14, [0.0, 0.0, -0.15], 'z', 12);       // racord joasă presiune
    b.cyl('steel', 0.03, 0.14, [0.13, -0.08, -0.05], 'x', 12);     // racord înaltă presiune
  });

  R.part('conducta_inalta_presiune', [0, 0, 0], (b) => {
    const pts = [[1.68, 3.22, -1.05], [1.82, 3.12, -1.1], [1.9, 2.75, -1.16], [1.88, 2.4, -1.14], [1.78, 2.28, -1.1]];
    b.tube('steel', pts, 0.022, { radial: 8 });
    b.cyl('steelDark', 0.04, 0.06, [1.69, 3.22, -1.05], 'x', 6);
    b.cyl('steelDark', 0.04, 0.06, [1.77, 2.28, -1.1], 'x', 6);
  });
}
