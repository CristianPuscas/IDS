/**
 * Client-First units (option `units`).
 *
 * Client-First v2 sizes everything in `rem` (base 16px) so a site that scales its root font size
 * scales the whole layout, and keeps hairline values in `px`: border-radius and the widths of
 * borders, outlines and strokes (a 1px border must stay 1px at any root size). With
 * `units: 'rem'` (default) every `px` length in a declaration value becomes `rem` (value / 16, at
 * most 4 decimals): plain values, shorthands (`margin`, `font`, `box-shadow`, `grid-template-*`…)
 * and lengths inside functions (`calc()`, `clamp()`, `minmax()`, `translate()`, `blur()`…).
 *
 * Left as written: those exception properties, `0`/`0px` (zero needs no unit, and `0` inside
 * `calc()` must keep one), `%`, `vh`/`vw`/`dvh`…, `em`, unitless numbers (line-height), strings
 * and `url()`, and every at-rule prelude, so `@media` breakpoints stay in px (Webflow's breakpoints
 * are px). Custom property definitions (`--space: 24px`) are converted unless the name looks like a
 * radius/border/outline/stroke token or the variable is used by one of the exception properties.
 *
 * Callers convert after `var()` resolution (./cssVariables), so an inlined value is converted
 * against the property it ends up in.
 *
 * Ownership: engine.
 */

import type { CssStyleRule } from './cssParser';
import type { UnitsMode } from './types';

/** Root font size `rem` values are computed against. */
export const REM_BASE_PX = 16;

/**
 * Properties whose lengths stay in px: border-radius (shorthand and corners, also prefixed),
 * border widths (`border`, `border-top`…, `border-width` and its longhands, logical sides),
 * `border-image-*`, outline width/offset, SVG `stroke-width`, `-webkit-text-stroke` and
 * `column-rule` width.
 */
const PX_PROPERTY = [
  /radius$/,
  /^(-webkit-|-moz-)?border(-(top|right|bottom|left|block|inline)(-(start|end))?)?(-width)?$/,
  /^border-image(-.+)?$/,
  /^outline(-width|-offset)?$/,
  /^stroke-width$/,
  /^-webkit-text-stroke(-width)?$/,
  /^column-rule(-width)?$/,
];

/** Custom property names that read as px tokens (`--radius-small`, `--border-width`…). */
const PX_VARIABLE = /radius|border|outline|stroke/i;

/** True when `property` keeps its px lengths under `units: 'rem'`. */
export function keepsPx(property: string): boolean {
  const p = property.trim().toLowerCase();
  return PX_PROPERTY.some((re) => re.test(p));
}

/**
 * `px` as a `rem` string: `24` -> `"1.5rem"`, `1` -> `"0.0625rem"`, `13.3333` -> `"0.8333rem"`.
 * Rounded to 4 decimals without trailing zeros; a result that rounds to zero is `"0"`.
 */
export function pxToRem(px: number): string {
  const rem = Number((px / REM_BASE_PX).toFixed(4));
  return rem === 0 ? '0' : `${rem}rem`;
}

/** Options for {@link convertValueUnits}. */
export interface ConvertUnitsOptions {
  /** Custom properties used by an exception property: their definitions keep px. */
  pxVariables?: ReadonlySet<string>;
}

/**
 * Converts the `px` lengths of one declaration value to `rem` (see the module comment for what
 * is left alone). Returns `value` unchanged with `units: 'keep'`.
 *
 * @param property Declaration property (custom properties included).
 * @param value Declaration value, without `!important`.
 */
export function convertValueUnits(property: string, value: string, units: UnitsMode, options: ConvertUnitsOptions = {}): string {
  if (units !== 'rem' || !/px/i.test(value)) return value;
  const prop = property.trim();
  if (prop.startsWith('--')) {
    if (PX_VARIABLE.test(prop) || options.pxVariables?.has(prop)) return value;
  } else if (keepsPx(prop)) return value;
  return pxLengthsToRem(value);
}

/** Replaces every `px` dimension token of a value with `rem`, skipping strings, `url()` and identifiers. */
function pxLengthsToRem(value: string): string {
  let out = '';
  let i = 0;
  const n = value.length;
  while (i < n) {
    const c = value[i]!;
    // Strings: copied verbatim.
    if (c === '"' || c === "'") {
      const end = stringEnd(value, i);
      out += value.slice(i, end);
      i = end;
      continue;
    }
    // Hash tokens (#fff) and escapes: copied verbatim.
    if (c === '#' || c === '\\') {
      let j = i + 1;
      while (j < n && /[\w-]/.test(value[j]!)) j++;
      out += value.slice(i, j);
      i = j;
      continue;
    }
    // Identifiers (incl. function names such as translate3d, and `-webkit-…`); url() is skipped whole.
    if (/[A-Za-z_]/.test(c) || (c === '-' && /[A-Za-z_-]/.test(value[i + 1] ?? ''))) {
      let j = i + 1;
      while (j < n && /[\w-]/.test(value[j]!)) j++;
      const ident = value.slice(i, j);
      if (ident.toLowerCase() === 'url' && value[j] === '(') {
        const close = urlEnd(value, j);
        out += value.slice(i, close);
        i = close;
        continue;
      }
      out += ident;
      i = j;
      continue;
    }
    // Numbers, with an optional sign, and their unit.
    const num = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i.exec(value.slice(i, i + 64));
    if (num && (c !== '+' && c !== '-' ? true : num[0].length > 1)) {
      let j = i + num[0].length;
      let k = j;
      while (k < n && /[A-Za-z%]/.test(value[k]!)) k++;
      const unit = value.slice(j, k);
      const amount = Number(num[0]);
      if (unit.toLowerCase() === 'px' && Number.isFinite(amount) && amount !== 0) {
        out += pxToRem(amount);
      } else {
        out += value.slice(i, k);
      }
      i = k;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

/** Index just past the string that starts at `start`. */
function stringEnd(text: string, start: number): number {
  const q = text[start];
  let i = start + 1;
  while (i < text.length && text[i] !== q) i += text[i] === '\\' ? 2 : 1;
  return Math.min(i + 1, text.length);
}

/** Index just past the `)` closing the `url(` whose `(` is at `open`. */
function urlEnd(text: string, open: number): number {
  let i = open + 1;
  while (i < text.length && text[i] !== ')') {
    if (text[i] === '"' || text[i] === "'") i = stringEnd(text, i);
    else i += text[i] === '\\' ? 2 : 1;
  }
  return Math.min(i + 1, text.length);
}

/**
 * Custom properties referenced through `var()` by an exception property (`border: var(--bw) solid`),
 * whose definitions must therefore keep px.
 */
export function pxVariablesOf(rules: readonly Pick<CssStyleRule, 'declarations'>[]): Set<string> {
  const out = new Set<string>();
  for (const r of rules) {
    for (const d of r.declarations) {
      if (!d.value.includes('var(') || (!keepsPx(d.property) && !(d.property.startsWith('--') && PX_VARIABLE.test(d.property)))) continue;
      for (const m of d.value.matchAll(/var\(\s*(--[\w-]+)/g)) out.add(m[1]!);
    }
  }
  return out;
}

/**
 * Converts the declarations of raw CSS text (`@keyframes`, `@font-face`, nested rules, scoped
 * variable blocks…) and leaves everything else as written: selectors, at-rule preludes (`@media`
 * breakpoints, `@supports`, `@container` conditions), statement at-rules (`@import … screen and
 * (max-width: 600px)`) and comments. Returns `css` unchanged with `units: 'keep'`.
 */
export function convertCssTextUnits(css: string, units: UnitsMode, options: ConvertUnitsOptions = {}): string {
  if (units !== 'rem' || !/px/i.test(css)) return css;
  let out = '';
  let depth = 0;
  let start = 0;
  let parens = 0;
  // A segment ends at `{` (a prelude: kept), or at `;`/`}` (a declaration when inside a block).
  const flush = (end: number, terminator: string) => {
    const segment = css.slice(start, end);
    out += terminator !== '{' && depth > 0 ? convertDeclarationText(segment, units, options) : segment;
    out += terminator;
    start = end + 1;
  };
  for (let i = 0; i < css.length; i++) {
    const c = css[i]!;
    if (c === '"' || c === "'") {
      i = stringEnd(css, i) - 1;
    } else if (c === '/' && css[i + 1] === '*') {
      const close = css.indexOf('*/', i + 2);
      i = close < 0 ? css.length - 1 : close + 1;
    } else if (c === '(') parens++;
    else if (c === ')') parens = Math.max(0, parens - 1);
    else if (parens === 0 && (c === '{' || c === ';' || c === '}')) {
      flush(i, c);
      if (c === '{') depth++;
      else if (c === '}') depth = Math.max(0, depth - 1);
    }
  }
  const tail = css.slice(start);
  out += depth > 0 ? convertDeclarationText(tail, units, options) : tail;
  return out;
}

/** Converts one `property: value` declaration text, keeping its surrounding whitespace. */
function convertDeclarationText(text: string, units: UnitsMode, options: ConvertUnitsOptions): string {
  if (/^\s*\/\*/.test(text)) return text;
  const colon = text.indexOf(':');
  if (colon <= 0) return text;
  const property = text.slice(0, colon).trim().toLowerCase();
  if (!/^(--)?[\w-]+$/.test(property)) return text;
  const value = text.slice(colon + 1);
  return text.slice(0, colon + 1) + convertValueUnits(property, value, units, options);
}

/**
 * Returns `rules` with their declaration values converted (new rule objects only where something
 * changed). `pxVariables` defaults to the variables the rules themselves use in exception properties.
 */
export function convertRulesUnits<T extends Pick<CssStyleRule, 'declarations'>>(rules: readonly T[], units: UnitsMode, options: ConvertUnitsOptions = {}): T[] {
  if (units !== 'rem') return [...rules];
  const opts = { pxVariables: options.pxVariables ?? pxVariablesOf(rules) };
  return rules.map((r) => {
    let changed = false;
    const declarations = r.declarations.map((d) => {
      const value = convertValueUnits(d.property, d.value, units, opts);
      if (value === d.value) return d;
      changed = true;
      return { ...d, value };
    });
    return changed ? { ...r, declarations } : r;
  });
}

/**
 * A value with px lengths written as rem (`24px` -> `1.5rem`), for comparing values that may use
 * either unit (an imported site class in px against converted output: 16px equals 1rem).
 */
export function remEquivalent(value: string): string {
  return pxLengthsToRem(value);
}
