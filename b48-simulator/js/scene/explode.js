// Vedere explodată: vector per piesă = removalDir + direcția față de centrul motorului,
// cumulat pe lanțul mountsOn (piesele mai „adânci” se depărtează mai mult, odată cu părinții lor).
import * as THREE from 'three';

export const ENGINE_CENTER = new THREE.Vector3(0, 1.4, 0);

export function computeExplodeVectors(recs) {
  const memo = new Map();
  const visit = (id, stack) => {
    if (memo.has(id)) return memo.get(id);
    const rec = recs.get(id);
    if (!rec || stack.has(id)) return new THREE.Vector3();
    stack.add(id);
    const parents = (rec.part.mountsOn || []).filter((p) => recs.has(p));
    const v = new THREE.Vector3();
    for (const p of parents) v.add(visit(p, stack));
    if (parents.length) v.divideScalar(parents.length);
    if (parents.length) {
      const radial = rec.homeCenter.clone().sub(ENGINE_CENTER);
      radial.y *= 0.5;
      if (radial.lengthSq() > 1e-6) radial.normalize();
      const dir = rec.removalDir.clone().multiplyScalar(1).addScaledVector(radial, 0.4);
      if (dir.lengthSq() < 1e-6) dir.copy(rec.removalDir);
      const step = 0.55 + Math.min(0.7, rec.sizeLen * 0.1);
      v.addScaledVector(dir.normalize(), step);
    } else if (rec.id !== 'bloc_motor') {
      // piese independente (ex. intercooler): doar radial
      const radial = rec.homeCenter.clone().sub(ENGINE_CENTER).setY(0);
      if (radial.lengthSq() > 1e-6) v.addScaledVector(radial.normalize(), 1.0);
    }
    stack.delete(id);
    memo.set(id, v);
    return v;
  };
  for (const id of recs.keys()) recs.get(id).explodeVec.copy(visit(id, new Set()));
}
