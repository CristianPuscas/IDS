// Ansamblul „racire”: pompă de apă (cu fulie rotativă), termostat, conducte, senzor temperatură.
import { BLOCK_X, BELT_X } from '../dims.js';

export const WATER_PUMP_C = [1.15, 0.38];   // (y, z) centrul fuliei pompei

export function register(R) {
  R.part('pompa_apa', [-BLOCK_X - 0.1, WATER_PUMP_C[0], WATER_PUMP_C[1]], (b) => {
    b.lathe('alu', [[0, 0.06], [0.24, 0.06], [0.27, 0.0], [0.24, -0.06], [0.1, -0.1], [0.06, -0.15], [0, -0.15]], [0, 0, 0], 'x', 36);
    b.cyl('alu', 0.08, 0.3, [0.0, 0.18, 0.22], 'y', 16); // racord ieșire spre termostat
    b.cyl('alu', 0.08, 0.25, [0.0, -0.1, 0.3], 'z', 16); // racord intrare
    b.bolts([[0.06, 0.2, -0.12], [0.06, -0.2, -0.12], [0.06, 0.1, 0.22], [0.06, -0.22, 0.12]], '-x', 0.03);
    const s = b.sub('spin', [BELT_X - (-BLOCK_X - 0.1), 0, 0]);
    s.pulley('steel', 0.17, 0.12, [0, 0, 0], 6);
    s.cyl('steelDark', 0.07, 0.16, [0.06, 0, 0], 'x', 20);
    for (let k = 0; k < 4; k++) s.bolt([-0.065, 0.07 * Math.cos(k * Math.PI / 2), 0.07 * Math.sin(k * Math.PI / 2)], '-x', 0.02);
  });

  R.part('termostat', [-BLOCK_X - 0.12, 2.55, 0.42], (b) => {
    b.cyl('plastic', 0.14, 0.18, [0, 0, 0], 'x', 28);
    b.cyl('plastic', 0.17, 0.04, [0.08, 0, 0], 'x', 28);
    b.cyl('plastic', 0.07, 0.25, [-0.05, 0.0, 0.18], 'z', 16);   // racord spre radiator
    b.cyl('plastic', 0.065, 0.2, [-0.03, -0.16, 0.0], 'y', 16);  // racord spre pompă
    b.rbox('connector', [0.08, 0.08, 0.1], 0.015, [-0.12, 0.12, -0.06]); // element încălzire (termostat cartografic)
    b.bolts([[0.1, 0.14, 0.1], [0.1, -0.14, -0.1], [0.1, 0.14, -0.1]], '-x', 0.025);
  });

  R.part('conducte_racire', [0, 0, 0], (b) => {
    const X = -BLOCK_X - 0.17;
    // pompă → termostat
    b.tube('hose', [[X, 1.48, 0.6], [X - 0.05, 1.8, 0.62], [X - 0.08, 2.15, 0.48], [X - 0.15, 2.35, 0.42]], 0.07, { radial: 14 });
    // termostat → radiator (capăt liber)
    b.tube('hose', [[X - 0.17, 2.55, 0.68], [X - 0.25, 2.62, 0.95], [X - 0.6, 2.6, 1.1], [X - 0.95, 2.5, 1.1]], 0.085, { radial: 14 });
    // retur radiator → pompă (capăt liber)
    b.tube('hose', [[X, 1.05, 0.72], [X - 0.15, 0.95, 0.95], [X - 0.55, 0.85, 1.05], [X - 0.95, 0.85, 1.05]], 0.085, { radial: 14 });
    // conductă încălzire / turbo pe partea de evacuare
    b.tube('hose', [[X + 0.1, 2.25, 0.55], [-1.6, 2.15, 0.95], [-1.2, 1.4, 1.05], [-0.4, 1.3, 1.05]], 0.045, { radial: 10 });
    // coliere
    for (const p of [[X, 1.5, 0.6], [X - 0.14, 2.33, 0.42], [X - 0.2, 2.6, 0.8], [X - 0.05, 1.0, 0.82]]) b.torus('clamp', 0.08, 0.012, p, 'y');
  });

  R.part('senzor_temperatura_lichid', [-BLOCK_X - 0.05, 3.0, 0.0], (b) => {
    b.cyl('brass', 0.045, 0.06, [0, 0, 0], 'y', 6);
    b.cyl('plastic', 0.04, 0.12, [0, 0.09, 0], 'y', 16);
    b.rbox('connector', [0.09, 0.08, 0.09], 0.015, [0, 0.18, 0]);
  });
}
