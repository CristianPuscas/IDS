// Ansamblul „electric”: bobine, bujii, senzori arbore cotit / axe cu came, cablaj motor.
import { CYL_X, COVER_TOP, CAM_Z, BLOCK_X } from '../dims.js';

export function register(R) {
  CYL_X.forEach((x, i) => {
    const n = i + 1;
    R.part(`bobina_${n}`, [x, COVER_TOP, 0], (b) => {
      b.rbox('plastic', [0.3, 0.26, 0.24], 0.04, [0, 0.24, 0]);
      b.rbox('plasticGrey', [0.26, 0.04, 0.2], 0.015, [0, 0.38, 0]);
      b.rbox('connector', [0.14, 0.12, 0.12], 0.02, [0, 0.26, -0.17]);
      b.box('accent', [0.06, 0.025, 0.07], [0, 0.33, -0.19]);
      b.cyl('plastic', 0.065, 0.95, [0, -0.36, 0], 'y', 20);   // corpul tubular spre bujie
      b.cyl('rubber', 0.075, 0.12, [0, -0.78, 0], 'y', 20);     // manșon cauciuc
      b.cyl('rubber', 0.1, 0.04, [0, 0.1, 0], 'y', 24);
    });
    R.part(`bujie_${n}`, [x, 2.45, 0], (b) => {
      b.box('steel', [0.012, 0.03, 0.025], [0.012, -0.01, 0]);   // electrod de masă
      b.cyl('steel', 0.005, 0.03, [0, 0.0, 0], 'y', 8);
      b.cyl('steel', 0.048, 0.16, [0, 0.08, 0], 'y', 20);       // filet
      for (let k = 0; k < 6; k++) b.torus('steelDark', 0.048, 0.004, [0, 0.015 + k * 0.025, 0], 'y', Math.PI * 2, 20);
      b.cyl('steel', 0.065, 0.07, [0, 0.195, 0], 'y', 6);        // hexagon
      b.lathe('ceramic', [[0, 0.23], [0.045, 0.23], [0.043, 0.3], [0.036, 0.36], [0.036, 0.47], [0, 0.47]], [0, 0, 0], 'y', 20);
      for (let k = 0; k < 4; k++) b.torus('ceramic', 0.037, 0.004, [0, 0.38 + k * 0.022, 0], 'y', Math.PI * 2, 16);
      b.cyl('steel', 0.016, 0.06, [0, 0.5, 0], 'y', 12);         // terminal
    });
  });

  R.part('senzor_arbore_cotit', [1.85, -0.25, 0.9], (b) => {
    b.cyl('plastic', 0.045, 0.14, [0, 0, -0.07], 'z', 16);
    b.rbox('plastic', [0.18, 0.08, 0.04], 0.015, [0.04, 0, 0.0]);
    b.bolt([0.1, 0, 0.02], 'z', 0.025);
    b.rbox('connector', [0.09, 0.09, 0.1], 0.015, [0, 0, 0.08]);
  });

  const camSensor = (b) => {
    b.cyl('plastic', 0.04, 0.2, [0, -0.1, 0], 'y', 16);
    b.rbox('plastic', [0.2, 0.06, 0.09], 0.015, [0.03, 0.03, 0]);
    b.bolt([0.1, 0.06, 0], 'y', 0.022);
    b.rbox('connector', [0.1, 0.09, 0.09], 0.015, [-0.06, 0.09, 0]);
  };
  R.part('senzor_ax_came_admisie', [1.82, COVER_TOP + 0.03, -CAM_Z], camSensor);
  R.part('senzor_ax_came_evacuare', [1.82, COVER_TOP + 0.03, CAM_Z], camSensor);

  // ---------- cablaj motor (trunchi + ramificații spre consumatori) ----------
  R.part('cablaj_motor', [0, 0, 0], (b) => {
    const T = (pts, r = 0.035) => b.tube('harness', pts, r, { radial: 8 });
    const plug = (p) => b.rbox('connector', [0.08, 0.07, 0.08], 0.015, p);
    const Y = COVER_TOP + 0.05, Z = -0.55;
    // trunchi principal pe capacul chiulasei (partea de admisie)
    T([[-2.05, Y - 0.5, Z - 0.3], [-1.9, Y, Z], [-0.9, Y + 0.02, Z], [0.2, Y + 0.02, Z], [1.2, Y + 0.02, Z], [1.95, Y - 0.05, Z]], 0.05);
    CYL_X.forEach((x) => T([[x - 0.1, Y + 0.02, Z], [x - 0.04, Y + 0.18, -0.4], [x, COVER_TOP + 0.26, -0.26]], 0.025));
    // ramură senzori axe cu came (spate)
    T([[1.95, Y - 0.05, Z], [1.98, Y + 0.08, -0.33], [1.98, Y + 0.12, 0.0], [1.92, Y + 0.12, CAM_Z]], 0.025);
    // ramură față: electrovalve, senzor temperatură, apoi coboară spre injectoare
    T([[-2.05, Y - 0.5, Z - 0.3], [-2.25, 3.2, -0.38], [-2.42, 3.1, 0.0], [-2.42, 3.08, 0.38]], 0.03);
    plug([-2.36, 3.11, -0.38]); plug([-2.36, 3.11, 0.38]);
    T([[-2.25, 3.2, -0.2], [-2.1, 3.25, 0.0], [-2.0, 3.2, 0.0]], 0.02);
    // sub-trunchi injectoare (sub galeria de admisie)
    const IY = 2.12, IZ = -0.95;
    T([[-2.05, Y - 0.5, Z - 0.3], [-2.15, 2.9, -0.92], [-2.0, IY, IZ], [-0.9, IY, IZ], [0.5, IY, IZ], [1.85, IY - 0.05, IZ]], 0.04);
    CYL_X.forEach((x) => T([[x - 0.12, IY, IZ], [x - 0.04, IY + 0.12, IZ - 0.05], [x, 2.41, -0.98]], 0.02));
    // ramură servomotor Valvetronic, pompă înaltă presiune, senzor presiune admisie
    T([[-1.4, Y + 0.02, Z], [-1.35, 3.6, -0.95], [-1.2, 3.48, -1.25]], 0.025);
    T([[1.3, Y + 0.02, Z], [1.45, 3.75, -0.85], [1.55, 3.62, -1.06]], 0.025);
    T([[0.5, Y + 0.02, Z], [0.62, 3.2, -1.15], [0.78, 2.73, -1.5]], 0.025);
    // ramură alternator + clapetă (față, admisie)
    T([[-2.0, IY, IZ], [-2.05, 1.9, -1.15], [-2.1, 1.6, -1.25]], 0.03);
    T([[-2.0, IY, IZ], [-2.05, 2.3, -1.3], [-1.95, 2.4, -1.78]], 0.025);
    // ramură spate-jos: senzor presiune ulei, senzor nivel ulei
    T([[1.85, IY - 0.05, IZ], [1.6, 1.0, -0.98], [1.35, 0.25, -1.1]], 0.03);
    T([[1.6, 1.0, -0.98], [1.25, -0.3, -0.98], [0.6, -1.4, -0.95], [0.25, -1.72, -0.36]], 0.025);
    // ramură evacuare: wastegate, sondă lambda, senzor arbore cotit
    T([[0.2, Y + 0.02, Z], [0.0, Y + 0.08, 0.2], [-0.3, Y - 0.05, 0.75], [-0.35, 3.0, 1.45], [-0.34, 2.76, 1.62]], 0.03);
    T([[1.95, Y - 0.05, Z], [2.0, 3.6, 0.6], [1.95, 2.0, 0.92], [1.9, 0.5, 0.98], [1.85, -0.25, 1.0]], 0.03);
    T([[1.95, 2.0, 0.92], [1.3, 1.75, 1.6], [0.67, 1.56, 1.98]], 0.022);
    plug([1.85, -0.25, 1.02]);
    // cleme de prindere
    for (const x of [-1.6, -0.6, 0.4, 1.5]) b.cyl('connector', 0.065, 0.04, [x, Y + 0.02, Z], 'x', 12);
  });
}
