// Aspectul piesei: selecție (emisiv albastru), indiciu (puls galben), avariată (roșu), x-ray, fantomă, estompare.
// Stările se combină; valorile de bază se citesc mereu din material.userData.base (restaurare corectă).
import * as THREE from 'three';

const BLUE = new THREE.Color(0x2f8cff);
const YELLOW = new THREE.Color(0xffc21a);
const RED = new THREE.Color(0xff2a1a);
const GHOST = new THREE.Color(0x9fc4ff);
const _c = new THREE.Color();

export const XRAY_OPACITY = 0.17;
export const GHOST_OPACITY = 0.14;

/** Recalculează materialele piesei din starea rec { selected, hint, damaged, xray, ghost, fade }. */
export function refreshLook(rec, time = 0) {
  const pulse = 0.5 + 0.5 * Math.sin(time * 6.5);
  let opacity = 1;
  if (rec.ghost) opacity = GHOST_OPACITY;
  else if (rec.xray) opacity = XRAY_OPACITY;
  opacity *= rec.fade ?? 1;
  const transparent = opacity < 0.999;
  for (const m of rec.materials) {
    const base = m.userData.base;
    if (!base) continue;
    if (m.color) {
      m.color.copy(base.color);
      if (rec.damaged) m.color.lerp(RED, 0.55);
      if (rec.ghost) m.color.lerp(GHOST, 0.6);
    }
    if (m.emissive) {
      _c.setRGB(0, 0, 0);
      let ei = 0;
      if (rec.selected) { _c.copy(BLUE); ei = 0.55; }
      if (rec.hint) {
        if (rec.selected) _c.lerp(YELLOW, 0.5 * pulse); else _c.copy(YELLOW);
        ei = Math.max(ei, 0.2 + 0.55 * pulse);
      }
      if (rec.damaged && !rec.selected && !rec.hint) { _c.copy(RED); ei = 0.3; }
      if (rec.ghost) ei *= 0.4;
      m.emissive.copy(_c);
      m.emissiveIntensity = ei;
    }
    const op = (base.opacity ?? 1) * opacity;
    if (m.opacity !== op) m.opacity = op;
    const tr = transparent || (base.opacity ?? 1) < 1;
    if (m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true; }
    m.depthWrite = !transparent;
  }
  const cast = !rec.ghost && !rec.xray && opacity > 0.5;
  if (rec._cast !== cast) {
    rec._cast = cast;
    for (const mesh of rec.meshes) mesh.castShadow = cast;
  }
  // piesele transparente se desenează după cele opace
  const order = rec.ghost ? 2 : rec.xray ? 1 : 0;
  if (rec._order !== order) { rec._order = order; for (const mesh of rec.meshes) mesh.renderOrder = order; }
}
