// Animația de funcționare: arbore cotit, cinematica bielă-manivelă, came la ½ turație, fulii, lanț, vibrații.
import * as THREE from 'three';
import { CYL_X, CRANK_R, PIN_PHASE, FIRE_ANGLE, pistonPinY } from './dims.js';

const TAU = Math.PI * 2;
// raport de rotație față de arborele cotit (rotația întregii piese)
const ROTATE = {
  arbore_cotit: 1, pinion_arbore_cotit: 1, amortizor_vibratii: 1, volanta: 1,
  ax_came_admisie: 0.5, ax_came_evacuare: 0.5, vanos_admisie: 0.5, vanos_evacuare: 0.5,
};
// sub-grupuri rotative: [partId, numeSub, raport]
const SUBS = [
  ['alternator', 'spin', 0.45 / 0.14], ['compresor_ac', 'spin', 0.45 / 0.26], ['pompa_apa', 'spin', 0.45 / 0.17],
  ['intinzator_curea', 'spin', 0.45 / 0.12], ['arbori_echilibrare', 'shaftA', 2], ['arbori_echilibrare', 'shaftB', -2],
  ['turbocompresor', 'wheel', 18],
];

export class Running {
  constructor() {
    this.on = false;
    this.theta = 0;     // unghiul arborelui cotit (rad)
    this.omega = 0;     // viteza unghiulară vizuală (rad/s)
    this.opts = { rpm: 800, misfireCylinder: 0, roughness: 0 };
    this.kick = 0;
    this.vib = new THREE.Vector3();
    this.vibRot = new THREE.Euler();
  }

  set(on, { rpm = 800, misfireCylinder = 0, roughness = 0 } = {}) {
    this.on = !!on;
    this.opts = { rpm: Math.max(0, +rpm || 0), misfireCylinder: +misfireCylinder || 0, roughness: Math.min(1, Math.max(0, +roughness || 0)) };
  }

  /** Avansează unghiul; încetinit vizual (≈1 rot/s la ralanti) ca să se poată urmări. */
  update(dt) {
    const target = this.on ? TAU * Math.min(3, 0.5 + this.opts.rpm / 1600) : 0;
    this.omega += (target - this.omega) * Math.min(1, dt * (this.on ? 1.8 : 1.2));
    if (this.omega < 0.01 && !this.on) this.omega = 0;
    const prev = this.theta;
    this.theta += this.omega * dt;
    // rateu: la unghiul de aprindere al cilindrului afectat → smucitură + scădere de turație
    const mc = this.opts.misfireCylinder;
    if (this.on && mc >= 1 && mc <= 4) {
      const fa = FIRE_ANGLE[mc - 1], c0 = Math.floor((prev - fa) / (2 * TAU)), c1 = Math.floor((this.theta - fa) / (2 * TAU));
      if (c1 > c0) { this.kick = 1; this.omega *= 0.9; }
    }
    this.kick *= Math.exp(-dt * 9);
    const speed = this.omega / TAU;
    const amp = speed * (0.003 + this.opts.roughness * 0.02) + this.kick * 0.03;
    if (amp > 1e-5) {
      this.vib.set((Math.random() - 0.5) * amp, (Math.random() - 0.5) * amp * 1.4, (Math.random() - 0.5) * amp * 1.2);
      this.vibRot.set((Math.random() - 0.5) * amp * 0.08 + this.kick * 0.006 * Math.sin(this.theta), 0, (Math.random() - 0.5) * amp * 0.05);
    } else { this.vib.set(0, 0, 0); this.vibRot.set(0, 0, 0); }
  }

  /** Scrie pozițiile/rotațiile cinematice în rec-uri; active(rec) = piesa e pe motor. */
  apply(recs, active) {
    const th = this.theta;
    for (const id in ROTATE) {
      const rec = recs.get(id);
      if (rec && active(rec)) rec.kinRotX = th * ROTATE[id];
    }
    for (const [id, name, k] of SUBS) {
      const rec = recs.get(id);
      const sub = rec?.group.userData.subs?.[name];
      if (sub && active(rec)) sub.rotation.x = th * k;
    }
    const chain = recs.get('lant_distributie');
    if (chain && active(chain) && chain.group.userData.chain && this.omega > 0) chain.group.userData.chain.set(-th * 0.212);
    CYL_X.forEach((x, i) => {
      const n = i + 1;
      const a = th + PIN_PHASE[i];
      const yp = pistonPinY(a);
      const dy = CRANK_R * Math.cos(a) - yp, dz = CRANK_R * Math.sin(a);
      const rod = recs.get(`biela_${n}`);
      if (rod && (active(rod) || !rod.kinPos)) {
        rod.kinPos = (rod.kinPos || new THREE.Vector3()).set(x, yp, 0);
        rod.kinRotX = Math.atan2(-dz, -dy);
      }
      for (const id of [`piston_${n}`, `segmenti_${n}`]) {
        const r = recs.get(id);
        if (r && (active(r) || !r.kinPos)) r.kinPos = (r.kinPos || new THREE.Vector3()).set(x, yp, 0);
      }
    });
  }
}
