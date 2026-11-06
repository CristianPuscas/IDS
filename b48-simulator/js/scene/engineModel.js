// Registrul de constructori procedurali (un constructor per ID de piesă) și construcția grupurilor 3D.
import * as THREE from 'three';
import { PartBuilder } from './geom.js';
import { materialCache } from './materials.js';
import * as bloc from './builders/bloc.js';
import * as chiulasa from './builders/chiulasa.js';
import * as distributie from './builders/distributie.js';
import * as ungere from './builders/ungere.js';
import * as racire from './builders/racire.js';
import * as supraalimentare from './builders/supraalimentare.js';
import * as admisie from './builders/admisie.js';
import * as combustibil from './builders/combustibil.js';
import * as electric from './builders/electric.js';
import * as accesorii from './builders/accesorii.js';

const REGISTRY = new Map();
const R = { part(id, anchor, fn) { REGISTRY.set(id, { anchor, fn }); } };
for (const m of [bloc, chiulasa, distributie, ungere, racire, supraalimentare, admisie, combustibil, electric, accesorii]) m.register(R);

export function hasBuilder(id) { return REGISTRY.has(id); }
export function builderIds() { return [...REGISTRY.keys()]; }

/** Marchează grupul și toate mesh-urile cu partId. */
export function tagPart(group, partId) {
  group.userData.partId = partId;
  group.traverse((o) => { o.userData.partId = partId; });
}

/**
 * Construiește piesa: { group, anchor, materials, meshes }.
 * ID necunoscut → cutie generică (unknownIndex o așază lângă stand).
 */
export function buildPart(part, unknownIndex = 0) {
  const entry = REGISTRY.get(part.id);
  const mats = materialCache();
  const b = new PartBuilder();
  let anchor, post = null;
  if (entry) {
    anchor = entry.anchor;
    post = entry.fn(b) || null;
  } else {
    anchor = [3.6 + (unknownIndex % 3) * 0.7, -3.9, -2.4 + Math.floor(unknownIndex / 3) * 0.7];
    b.rbox('generic', [0.5, 0.5, 0.5], 0.05, [0, 0, 0]);
  }
  const group = b.build(mats);
  if (typeof post === 'function') post(group);
  group.name = part.id;
  tagPart(group, part.id);
  group.position.set(anchor[0], anchor[1], anchor[2]);
  return { group, anchor: new THREE.Vector3(anchor[0], anchor[1], anchor[2]), materials: mats.all(), generic: !entry };
}

/** Colectează mesh-urile și materialele unui grup (după eventuala înlocuire cu GLTF). */
export function collect(group) {
  const meshes = [], materials = new Set();
  group.traverse((o) => {
    if (o.isMesh) {
      meshes.push(o);
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => materials.add(m));
    }
  });
  return { meshes, materials: [...materials] };
}

/** Eliberează geometriile/materialele unui grup. */
export function disposeGroup(group) {
  group.traverse((o) => {
    if (o.isMesh) {
      o.geometry?.dispose();
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m?.dispose());
    }
  });
}
