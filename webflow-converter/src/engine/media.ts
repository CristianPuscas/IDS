/**
 * Media query -> Webflow breakpoint mapping (spec 3.2).
 *
 * Webflow is desktop-first: `main` is the base, `medium` (≤991px), `small` (≤767px) and `tiny`
 * (≤479px) cascade down; the optional `large` (≥1280), `xl` (≥1440) and `xxl` (≥1920) cascade up.
 *
 * Instead of mapping a query straight to a variant key, we map it to the set of viewport **bands**
 * it covers:
 *
 *   tiny ≤479 | small 480–767 | medium 768–991 | main 992–1279 | large 1280–1439 | xl 1440–1919 | xxl ≥1920
 *
 * (`large`/`xl`/`xxl` exist only when `includeLargeBreakpoints` is on; otherwise `main` is ≥992.)
 *
 * - `(max-width: N)` with |N − 991| ≤ tolerance covers tiny+small+medium (likewise 767, 479).
 * - `(min-width: N)` with |N − 992| ≤ tolerance covers main and up; 768 -> medium and up; 480 ->
 *   small and up. This lets mobile-first CSS map natively: styleMapper resolves the value of each
 *   property in every band and re-encodes it desktop-first (see styleMapper `resolveBands`).
 * - `(min-width: ~1280/1440/1920)` covers large/xl/xxl and up, only with `includeLargeBreakpoints`.
 * - `and`-ed conditions intersect; nested `@media` intersect too.
 * - Range syntax `(width <= N)`, `(width < N)`, `(width >= N)`, `(width > N)` and `em`/`rem`
 *   units (×16px) are understood.
 * - Anything else (`orientation`, `hover`, `prefers-*`, `print`, comma lists, `not`, other widths)
 *   is unmatched and stays in the `<style>` embed with its original query.
 *
 * Ownership: engine.
 */

import { WF_MAX_WIDTH_BREAKPOINTS, WF_MIN_WIDTH_BREAKPOINTS } from './types';

/** Viewport bands, narrowest first. */
export const ALL_BANDS = ['tiny', 'small', 'medium', 'main', 'large', 'xl', 'xxl'] as const;
export type Band = (typeof ALL_BANDS)[number];

/** Bands in play: `large`/`xl`/`xxl` only when large breakpoints are enabled. */
export function bandDomain(includeLarge: boolean): Band[] {
  return includeLarge ? [...ALL_BANDS] : ['tiny', 'small', 'medium', 'main'];
}

/** Result of `mediaToBands`. */
export type MediaMapping =
  | { kind: 'bands'; bands: Band[] }
  /** A min-width query near 1280/1440/1920 while large breakpoints are disabled. */
  | { kind: 'large'; reason: string }
  | { kind: 'unmatched'; reason: string };

/** Lower bound (px) of each band. */
const BAND_START: Record<Band, number> = {
  tiny: 0,
  small: WF_MAX_WIDTH_BREAKPOINTS.tiny + 1, // 480
  medium: WF_MAX_WIDTH_BREAKPOINTS.small + 1, // 768
  main: WF_MAX_WIDTH_BREAKPOINTS.medium + 1, // 992
  large: WF_MIN_WIDTH_BREAKPOINTS.large, // 1280
  xl: WF_MIN_WIDTH_BREAKPOINTS.xl, // 1440
  xxl: WF_MIN_WIDTH_BREAKPOINTS.xxl, // 1920
};

/**
 * Maps a chain of `@media` preludes (outermost first) to the bands it covers.
 *
 * @param stack `CssStyleRule.mediaStack`. `[]` covers every band.
 * @param tolerancePx `ConvertOptions.breakpointTolerancePx`.
 * @param includeLarge `ConvertOptions.includeLargeBreakpoints`.
 */
export function mediaToBands(stack: string[], tolerancePx: number, includeLarge: boolean): MediaMapping {
  const domain = bandDomain(includeLarge);
  let bands = new Set<Band>(domain);
  for (const prelude of stack) {
    const m = queryToBands(prelude, tolerancePx, includeLarge);
    if (m.kind !== 'bands') return m;
    bands = new Set(m.bands.filter((b) => bands.has(b)));
  }
  if (bands.size === 0) return { kind: 'unmatched', reason: 'media query matches no Webflow breakpoint' };
  return { kind: 'bands', bands: domain.filter((b) => bands.has(b)) };
}

function queryToBands(prelude: string, tol: number, includeLarge: boolean): MediaMapping {
  const domain = bandDomain(includeLarge);
  let q = prelude.trim().toLowerCase().replace(/\s+/g, ' ');
  if (q.includes(',')) return { kind: 'unmatched', reason: 'media query list (comma)' };
  q = q.replace(/^only /, '');
  q = q.replace(/^(screen|all)( and |$)/, '');
  if (!q) return { kind: 'bands', bands: domain };

  let bands = new Set<Band>(domain);
  for (const part of q.split(/ and /)) {
    const cond = part.trim();
    const parsed = parseWidthCondition(cond);
    if (!parsed) return { kind: 'unmatched', reason: `unsupported media feature ${cond}` };
    const covered = conditionToBands(parsed, tol, includeLarge, domain);
    if (covered.kind !== 'bands') return covered;
    bands = new Set(covered.bands.filter((b) => bands.has(b)));
  }
  return { kind: 'bands', bands: domain.filter((b) => bands.has(b)) };
}

/** `max` = viewport ≤ px, `min` = viewport ≥ px. */
interface WidthCondition {
  type: 'max' | 'min';
  px: number;
}

function parseWidthCondition(cond: string): WidthCondition | null {
  let m = /^\(\s*(max|min)-width\s*:\s*([\d.]+)(px|em|rem)?\s*\)$/.exec(cond);
  if (m) return { type: m[1] as 'max' | 'min', px: toPx(m[2]!, m[3]) };
  m = /^\(\s*width\s*(<=|<|>=|>)\s*([\d.]+)(px|em|rem)?\s*\)$/.exec(cond);
  if (m) {
    const px = toPx(m[2]!, m[3]);
    switch (m[1]) {
      case '<=':
        return { type: 'max', px };
      case '<':
        return { type: 'max', px: px - 1 };
      case '>=':
        return { type: 'min', px };
      default:
        return { type: 'min', px: px + 1 };
    }
  }
  return null;
}

function toPx(n: string, unit: string | undefined): number {
  const v = parseFloat(n);
  return unit === 'em' || unit === 'rem' ? v * 16 : v;
}

function conditionToBands(c: WidthCondition, tol: number, includeLarge: boolean, domain: Band[]): MediaMapping {
  if (c.type === 'max') {
    for (const [bp, px] of Object.entries(WF_MAX_WIDTH_BREAKPOINTS) as [Band, number][]) {
      if (Math.abs(c.px - px) <= tol) {
        // max-width ~991 covers medium and everything narrower.
        const idx = domain.indexOf(bp);
        return { kind: 'bands', bands: domain.slice(0, idx + 1) };
      }
    }
    return { kind: 'unmatched', reason: `max-width ${c.px}px is not within ±${tol}px of 991/767/479` };
  }
  // min-width: band starts. 480/768/992 always; 1280/1440/1920 only with large breakpoints.
  const starts: Band[] = ['small', 'medium', 'main'];
  for (const band of starts) {
    if (Math.abs(c.px - BAND_START[band]) <= tol) {
      return { kind: 'bands', bands: domain.slice(domain.indexOf(band)) };
    }
  }
  for (const band of ['large', 'xl', 'xxl'] as const) {
    if (Math.abs(c.px - BAND_START[band]) <= tol) {
      if (!includeLarge) return { kind: 'large', reason: `min-width ${c.px}px maps to the "${band}" breakpoint` };
      return { kind: 'bands', bands: domain.slice(domain.indexOf(band)) };
    }
  }
  return { kind: 'unmatched', reason: `min-width ${c.px}px is not within ±${tol}px of 480/768/992` };
}
