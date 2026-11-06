// Efecte de scurgere: picături care cad din partea de jos a piesei și formează o băltoacă; gaze = particule care urcă.
import * as THREE from 'three';

export const FLUIDS = {
  ulei: { color: 0x3b2a12, kind: 'drip', rough: 0.15 },
  lichid_racire: { color: 0xff4fa3, kind: 'drip', rough: 0.1 },
  combustibil: { color: 0xd8c35a, kind: 'drip', rough: 0.08 },
  aer: { color: 0xffffff, kind: 'gas' },
  gaze_evacuare: { color: 0x9a9a9a, kind: 'gas' },
};

const DROPS = 10, PUFFS = 26;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3();

export class LeakFX {
  /** getBox(partId) → THREE.Box3 în coordonate lume (sau null). */
  constructor(root, getBox, floorY) {
    this.root = root; this.getBox = getBox; this.floorY = floorY;
    this.leaks = new Map();
    this.dropGeo = new THREE.SphereGeometry(0.045, 10, 8);
    this.puffGeo = new THREE.SphereGeometry(0.07, 10, 8);
    this.puddleGeo = new THREE.CircleGeometry(1, 40);
  }

  show(partId, fluid) {
    const def = FLUIDS[fluid] || FLUIDS.ulei;
    const key = `${partId}|${fluid}`;
    if (this.leaks.has(key) || !this.getBox(partId)) return;
    const lk = { partId, def, t: 0 };
    if (def.kind === 'drip') {
      lk.mat = new THREE.MeshStandardMaterial({ color: def.color, roughness: def.rough, metalness: 0.1, transparent: true, opacity: 0.9 });
      lk.mesh = new THREE.InstancedMesh(this.dropGeo, lk.mat, DROPS);
      lk.drops = Array.from({ length: DROPS }, (_, i) => ({ p: new THREE.Vector3(), v: 0, wait: i * 0.18 + Math.random() * 0.1, active: false }));
      lk.puddleMat = new THREE.MeshStandardMaterial({ color: def.color, roughness: def.rough * 0.5, metalness: 0.2, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
      lk.puddle = new THREE.Mesh(this.puddleGeo, lk.puddleMat);
      lk.puddle.rotation.x = -Math.PI / 2;
      lk.puddle.scale.setScalar(0.001);
      lk.puddle.renderOrder = 3;
      lk.puddleR = 0.18;
      this.root.add(lk.puddle);
    } else {
      lk.mat = new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: fluid === 'aer' ? 0.42 : 0.5, depthWrite: false });
      lk.mesh = new THREE.InstancedMesh(this.puffGeo, lk.mat, PUFFS);
      lk.puffs = Array.from({ length: PUFFS }, (_, i) => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), life: -i * 0.07, max: 1.4 + Math.random() * 0.6 }));
      lk.mesh.renderOrder = 4;
    }
    lk.mesh.frustumCulled = false;
    lk.mesh.userData.fx = true;
    this.root.add(lk.mesh);
    this.leaks.set(key, lk);
    this.update(0);
  }

  clear() {
    for (const lk of this.leaks.values()) {
      this.root.remove(lk.mesh); lk.mesh.dispose(); lk.mat.dispose();
      if (lk.puddle) { this.root.remove(lk.puddle); lk.puddleMat.dispose(); }
    }
    this.leaks.clear();
  }

  _spawnDrop(d, box) {
    const c = box.getCenter(_p), sz = box.getSize(_s);
    d.p.set(c.x + (Math.random() - 0.5) * sz.x * 0.5, box.min.y, c.z + (Math.random() - 0.5) * sz.z * 0.5);
    d.v = 0; d.active = true;
  }

  update(dt) {
    for (const lk of this.leaks.values()) {
      const box = this.getBox(lk.partId);
      if (!box) continue;
      lk.t += dt;
      if (lk.drops) {
        const c = box.getCenter(new THREE.Vector3());
        lk.puddle.position.set(c.x, this.floorY + 0.012, c.z);
        lk.drops.forEach((d, i) => {
          if (!d.active) {
            d.wait -= dt;
            if (d.wait <= 0) this._spawnDrop(d, box);
          } else {
            d.v += 9.8 * 0.35 * dt; // gravitație (încetinită vizual)
            d.p.y -= d.v * dt * 2.2;
            if (d.p.y <= this.floorY + 0.02) {
              d.active = false; d.wait = 0.3 + Math.random() * 0.6;
              lk.puddleR = Math.min(1.0, lk.puddleR + 0.05);
            }
          }
          const sc = d.active ? 1 : 0.0001;
          _s.set(sc, sc * 1.6, sc);
          _m.compose(d.p, _q.identity(), _s);
          lk.mesh.setMatrixAt(i, _m);
        });
        lk.puddle.scale.setScalar(lk.puddleR);
      } else {
        const c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
        lk.puffs.forEach((p, i) => {
          p.life += dt;
          if (p.life >= p.max) { p.life -= p.max; p.spawned = false; }
          if (p.life >= 0 && !p.spawned) {
            p.spawned = true;
            p.p.set(c.x + (Math.random() - 0.5) * sz.x * 0.6, c.y + (Math.random() - 0.3) * sz.y * 0.5, c.z + (Math.random() - 0.5) * sz.z * 0.6);
            p.v.set((Math.random() - 0.5) * 0.35, 0.7 + Math.random() * 0.6, (Math.random() - 0.5) * 0.35);
          }
          let sc = 0.0001;
          if (p.life >= 0) {
            p.p.addScaledVector(p.v, dt);
            const k = p.life / p.max;
            sc = (0.5 + k * 1.8) * (k > 0.7 ? (1 - k) / 0.3 : 1);
          }
          _s.setScalar(Math.max(0.0001, sc));
          _m.compose(p.p, _q.identity(), _s);
          lk.mesh.setMatrixAt(i, _m);
        });
      }
      lk.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  dispose() {
    this.clear();
    this.dropGeo.dispose(); this.puffGeo.dispose(); this.puddleGeo.dispose();
  }
}
