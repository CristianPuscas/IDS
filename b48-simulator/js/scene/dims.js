// Dimensiuni comune ale modelului (1 unitate = 1 dm), conform ARCHITECTURE.md §2. Valori aproximative, doar vizuale.
export const CYL_X = [-1.365, -0.455, 0.455, 1.365];
export const CRANK_R = 0.473;          // jumătate din cursă (0.946)
export const ROD_L = 1.44;             // lungime bielă (centru-centru)
export const BORE_R = 0.41;            // raza alezajului (0.82 / 2)
export const DECK_Y = 2.3;
export const HEAD_TOP = 3.3;
export const COVER_TOP = 3.9;
export const CAM_Y = 3.05;
export const CAM_Z = 0.33;
export const BLOCK_X = 1.95;           // jumătate din lungimea blocului
export const BLOCK_Z = 0.78;
export const JOURNAL_X = [-1.82, -0.91, 0, 0.91, 1.82];
export const TIMING_X = 2.12;          // planul distribuției (spate, +X)
export const BELT_X = -2.3;            // planul curelei de accesorii (față, −X)
export const FLOOR_Y = -4.6;
// Faza manetonului: cil. 1 și 4 sus (0), 2 și 3 jos (π) — decalaj 180°
export const PIN_PHASE = [0, Math.PI, Math.PI, 0];
// Ordinea de aprindere 1-3-4-2 → unghiul arborelui cotit (ciclu 720°) la care aprinde fiecare cilindru
export const FIRE_ANGLE = [0, 3 * Math.PI, Math.PI, 2 * Math.PI];

/** Poziția bolțului de piston (y) pentru unghiul manetonului a. */
export function pistonPinY(a) {
  const s = CRANK_R * Math.sin(a);
  return CRANK_R * Math.cos(a) + Math.sqrt(ROD_L * ROD_L - s * s);
}
