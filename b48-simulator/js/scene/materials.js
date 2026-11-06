// Biblioteca de materiale PBR. Fiecare piesă primește clone proprii (evidențiere individuală).
import * as THREE from 'three';

export const MATERIAL_DEFS = {
  alu:        { color: 0x9da1a6, metalness: 0.7, roughness: 0.56 },  // aluminiu turnat
  aluHead:    { color: 0xaaaeb2, metalness: 0.7, roughness: 0.5 },
  aluDark:    { color: 0x7d838a, metalness: 0.7, roughness: 0.5 },
  aluMach:    { color: 0xd6d9dc, metalness: 0.9, roughness: 0.26 },   // suprafețe prelucrate
  piston:     { color: 0xc4c6c4, metalness: 0.75, roughness: 0.38 },
  steel:      { color: 0xc6cad0, metalness: 0.95, roughness: 0.24 },
  steelDark:  { color: 0x6b7178, metalness: 0.9, roughness: 0.36 },
  iron:       { color: 0x585c61, metalness: 0.6, roughness: 0.74 },   // fontă
  exhaust:    { color: 0x6e625a, metalness: 0.75, roughness: 0.62 },  // fontă/oțel evacuare (nuanță termică)
  plastic:    { color: 0x1b1d20, metalness: 0.05, roughness: 0.55 },  // plastic negru
  plasticCover: { color: 0x2f3236, metalness: 0.1, roughness: 0.42 },
  plasticGrey: { color: 0x4c5056, metalness: 0.05, roughness: 0.6 },
  nylon:      { color: 0x3b3833, metalness: 0.0, roughness: 0.5 },    // patine lanț
  rubber:     { color: 0x141414, metalness: 0.0, roughness: 0.92 },   // cauciuc
  hose:       { color: 0x18191a, metalness: 0.0, roughness: 0.58 },
  gasket:     { color: 0x6c7160, metalness: 0.3, roughness: 0.6 },
  mls:        { color: 0x9ea19a, metalness: 0.85, roughness: 0.4 },   // garnitură multistrat oțel
  copper:     { color: 0xb87333, metalness: 1.0, roughness: 0.32 },   // cupru (bobinaj, șaibe)
  brass:      { color: 0xc9a24a, metalness: 1.0, roughness: 0.34 },   // alamă (senzori)
  harness:    { color: 0x202224, metalness: 0.0, roughness: 0.82 },   // cablaj
  connector:  { color: 0x2c3036, metalness: 0.05, roughness: 0.5 },
  accent:     { color: 0x3d7a5a, metalness: 0.05, roughness: 0.5 },   // siguranțe conectori
  ceramic:    { color: 0xeeeae2, metalness: 0.0, roughness: 0.3 },
  bolt:       { color: 0x8e9399, metalness: 0.92, roughness: 0.34 },
  chain:      { color: 0x9da2a8, metalness: 0.95, roughness: 0.3 },
  dark:       { color: 0x0c0d0e, metalness: 0.0, roughness: 1.0 },
  clamp:      { color: 0xa7afb8, metalness: 0.9, roughness: 0.3 },
  fin:        { color: 0x9aa1a8, metalness: 0.8, roughness: 0.45 },
  oilFilter:  { color: 0xd9cfa8, metalness: 0.0, roughness: 0.85 },   // hârtie filtrantă
  generic:    { color: 0x7d8a99, metalness: 0.4, roughness: 0.5 },
  // scule și stand (nu sunt piese)
  toolSteel:  { color: 0xd2d6db, metalness: 1.0, roughness: 0.18 },
  toolGrip:   { color: 0xb3261e, metalness: 0.0, roughness: 0.55 },
  toolBlack:  { color: 0x1a1a1a, metalness: 0.2, roughness: 0.5 },
  paint:      { color: 0x8a2c22, metalness: 0.35, roughness: 0.5 },
};

/** Material nou pentru o cheie; userData.base păstrează valorile originale pentru restaurare. */
export function createMaterial(key) {
  const def = MATERIAL_DEFS[key] || MATERIAL_DEFS.generic;
  const m = new THREE.MeshStandardMaterial({
    color: def.color, metalness: def.metalness ?? 0.5, roughness: def.roughness ?? 0.5,
    side: THREE.DoubleSide,
  });
  m.userData.key = key;
  m.userData.base = { color: m.color.clone(), opacity: 1 };
  return m;
}

/** Fabrică de materiale cu cache local (o instanță per cheie, per piesă). */
export function materialCache() {
  const cache = new Map();
  const fn = (key) => {
    if (!cache.has(key)) cache.set(key, createMaterial(key));
    return cache.get(key);
  };
  fn.all = () => [...cache.values()];
  return fn;
}

/** Pregătește un material extern (GLTF) pentru evidențiere. */
export function adoptMaterial(m) {
  const c = m.clone();
  if (!c.emissive) return c;
  c.userData.key = 'gltf';
  c.userData.base = { color: c.color ? c.color.clone() : new THREE.Color(1, 1, 1), opacity: c.opacity ?? 1 };
  return c;
}
