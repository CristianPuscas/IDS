/**
 * Declaration preparation for native `styleLess` (spec 3.5).
 *
 * The Designer writes longhands only, so shorthands are expanded:
 *   margin / padding / inset / margin-inline… -> four sides
 *   border-radius                             -> four corners (elliptical `a / b` supported)
 *   border, border-top…, border-width/style/color -> per-side width/style/color
 *   outline                                   -> outline-width/style/color
 *   gap / row-gap / column-gap                -> grid-row-gap / grid-column-gap
 *   transition                                -> transition-property/duration/timing-function(/delay)
 *   background (single colour or single image) -> background-color / background-image
 *   grid-template-* `repeat(N, x)` and `minmax(0, Nfr)` -> explicit tracks
 *
 * Units are kept as written here (px -> rem happens before, in ./styleMapper via ./units). `var(--x)` values are wrapped in `@raw<|…|>` as in real dumps
 * (spec 3.5); the variable definitions themselves go to the `<style>` embed.
 *
 * Declarations Webflow cannot hold natively are reported as `embed` so the caller can route them
 * to the `<style>` embed: custom property definitions (`--x: …`), vendor-prefixed properties or
 * values (spec 3.5, S12), `!important` (no clipboard evidence) and values containing `;{}`.
 *
 * Ownership: engine.
 */

import { splitTopLevel, splitValueTokens, type CssDeclaration } from './cssParser';
import type { ConvertWarningCode } from './types';

/** A native longhand `prop: value` ready for `styleLess`. */
export interface NativeDecl {
  property: string;
  value: string;
}

/** Result of `prepareDeclaration`. */
export type PreparedDecl =
  | { kind: 'native'; decls: NativeDecl[] }
  | { kind: 'embed'; code: ConvertWarningCode; reason: string };

const VENDOR = /^-(webkit|moz|ms|o)-/i;

/**
 * Turns one source declaration into native longhands, or says why it must be embedded.
 */
export function prepareDeclaration(decl: CssDeclaration): PreparedDecl {
  const { property, value } = decl;
  if (property.startsWith('--')) return { kind: 'embed', code: 'css-variable', reason: `custom property ${property}` };
  if (VENDOR.test(property)) return { kind: 'embed', code: 'vendor-prefix', reason: `vendor-prefixed property ${property}` };
  if (/(^|[\s(,])-(webkit|moz|ms|o)-/i.test(value)) {
    return { kind: 'embed', code: 'vendor-prefix', reason: `vendor-prefixed value in ${property}` };
  }
  if (decl.important) return { kind: 'embed', code: 'important-dropped', reason: `${property} uses !important` };
  if (/[;{}]/.test(stripStrings(value))) return { kind: 'embed', code: 'other', reason: `unsafe characters in ${property}` };
  if (/^(expression|behavior)$/i.test(property)) return { kind: 'embed', code: 'other', reason: `legacy property ${property}` };

  const expanded = expandShorthand(property, value);
  return {
    kind: 'native',
    decls: expanded.map((d) => ({ property: d.property, value: wrapRaw(d.property === 'font-family' ? unquoteFontFamilies(d.value) : d.value) })),
  };
}

/** Generic family names and CSS-wide keywords: a family with one of these names must stay quoted. */
const FONT_KEYWORDS = new Set([
  'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-serif', 'ui-sans-serif', 'ui-monospace',
  'ui-rounded', 'emoji', 'math', 'fangsong', 'inherit', 'initial', 'unset', 'default', 'revert', 'revert-layer',
]);

/**
 * When a `font-family` has two or more quoted names, removes the quotes around those that are valid
 * unquoted (a sequence of CSS identifiers, e.g. `"Bebas Neue"` -> `Bebas Neue`), as the CSS spec
 * allows. Webflow drops a `font-family` whose value has two or more quoted names: `"Bebas Neue",
 * Impact, "Arial Narrow", sans-serif` is stored but neither published nor shown in the Style panel
 * (GreenIron v5 paste test; `"Inter", Arial, sans-serif` and `Georgia, "Times New Roman", serif`
 * were kept), so the text fell back to the inherited font. Names that need their quotes keep them.
 */
export function unquoteFontFamilies(value: string): string {
  if (/var\(/i.test(value)) return value;
  const parts = splitTopLevel(value, ',');
  // One quoted name is published fine (and keeps matching classes earlier pastes created).
  if (parts.filter((p) => /^\s*["']/.test(p)).length < 2) return value;
  return parts
    .map((part) => {
      const name = part.trim();
      const m = /^(["'])((?:(?!\1)[^\\])*)\1$/.exec(name);
      if (!m) return name;
      const inner = m[2]!.trim().replace(/\s+/g, ' ');
      const words = inner.split(' ');
      const plain = words.every((w) => /^-?[a-zA-Z_][\w-]*$/.test(w) && !/^--/.test(w) && !FONT_KEYWORDS.has(w.toLowerCase()));
      return plain ? inner : name;
    })
    .join(', ');
}

/** Wraps values that reference CSS variables in Webflow's `@raw<|…|>` marker (spec 3.5). */
export function wrapRaw(value: string): string {
  if (value.startsWith('@raw<|')) return value;
  return /var\(\s*--/.test(value) ? `@raw<|${value}|>` : value;
}

const SIDES = ['top', 'right', 'bottom', 'left'] as const;
const CORNERS = ['top-left', 'top-right', 'bottom-right', 'bottom-left'] as const;
const BORDER_STYLES = new Set(['none', 'hidden', 'dotted', 'dashed', 'solid', 'double', 'groove', 'ridge', 'inset', 'outset']);
const WIDE_KEYWORDS = new Set(['inherit', 'initial', 'unset', 'revert', 'revert-layer']);

/**
 * Expands one shorthand into longhands. Unknown properties (and anything that cannot be expanded
 * safely, e.g. a lone `var()` standing for several values) pass through unchanged.
 */
export function expandShorthand(property: string, value: string): NativeDecl[] {
  const same = [{ property, value }];
  const tokens = splitValueTokens(value);
  const isWide = tokens.length === 1 && WIDE_KEYWORDS.has(value.toLowerCase());
  // A var() may stand for several values (`--space: 1rem 2rem`), so a side/corner shorthand with
  // fewer tokens than slots cannot be expanded safely. Keep the shorthand; `wrapRaw` turns it into
  // `@raw<|…|>`, the form real dumps use for shorthands such as `border-radius` (spec 3.5).
  const varShort = (slots: number, toks: string[] = tokens): boolean => toks.length < slots && toks.some((t) => /var\(/i.test(t));

  switch (property) {
    case 'margin':
    case 'padding':
      if (tokens.length === 0 || tokens.length > 4 || varShort(4)) return same;
      return fourSides(tokens, isWide).map((v, i) => ({ property: `${property}-${SIDES[i]}`, value: v }));
    case 'inset':
      if (tokens.length === 0 || tokens.length > 4 || varShort(4)) return same;
      return fourSides(tokens, isWide).map((v, i) => ({ property: SIDES[i]!, value: v }));
    case 'margin-inline':
    case 'padding-inline':
    case 'margin-block':
    case 'padding-block':
    case 'inset-inline':
    case 'inset-block': {
      if (tokens.length === 0 || tokens.length > 2 || varShort(2)) return same;
      const base = property.replace(/-(inline|block)$/, '');
      const [a, b] = [tokens[0]!, tokens[1] ?? tokens[0]!];
      const sides = property.endsWith('inline') ? ['left', 'right'] : ['top', 'bottom'];
      const name = (side: string): string => (base === 'inset' ? side : `${base}-${side}`);
      return [
        { property: name(sides[0]!), value: a },
        { property: name(sides[1]!), value: b },
      ];
    }
    case 'margin-inline-start':
    case 'margin-inline-end':
    case 'padding-inline-start':
    case 'padding-inline-end':
    case 'margin-block-start':
    case 'margin-block-end':
    case 'padding-block-start':
    case 'padding-block-end': {
      const side = { 'inline-start': 'left', 'inline-end': 'right', 'block-start': 'top', 'block-end': 'bottom' }[
        property.replace(/^(margin|padding)-/, '')
      ];
      return [{ property: `${property.split('-')[0]}-${side}`, value }];
    }
    case 'border-radius': {
      const [h, v] = splitTopLevel(value, '/').map((p) => splitValueTokens(p.trim()));
      if (!h || h.length === 0 || h.length > 4 || (v && (v.length === 0 || v.length > 4))) return same;
      if (varShort(4, h) || (v && varShort(4, v))) return same;
      const hs = fourSides(h, isWide);
      const vs = v ? fourSides(v, false) : null;
      return CORNERS.map((corner, i) => ({
        property: `border-${corner}-radius`,
        value: vs ? `${hs[i]} ${vs[i]}` : hs[i]!,
      }));
    }
    case 'border-width':
    case 'border-style':
    case 'border-color': {
      if (tokens.length === 0 || tokens.length > 4 || varShort(4)) return same;
      const kind = property.slice('border-'.length);
      return fourSides(tokens, isWide).map((v, i) => ({ property: `border-${SIDES[i]}-${kind}`, value: v }));
    }
    case 'border':
    case 'border-top':
    case 'border-right':
    case 'border-bottom':
    case 'border-left': {
      const parts = parseLineShorthand(tokens, isWide);
      if (!parts) return same;
      const sides = property === 'border' ? SIDES : [property.slice('border-'.length)];
      const out: NativeDecl[] = [];
      for (const side of sides) {
        if (parts.width) out.push({ property: `border-${side}-width`, value: parts.width });
        if (parts.style) out.push({ property: `border-${side}-style`, value: parts.style });
        if (parts.color) out.push({ property: `border-${side}-color`, value: parts.color });
      }
      return out;
    }
    case 'outline': {
      const parts = parseLineShorthand(tokens, isWide);
      if (!parts) return same;
      const out: NativeDecl[] = [];
      if (parts.width) out.push({ property: 'outline-width', value: parts.width });
      if (parts.style) out.push({ property: 'outline-style', value: parts.style });
      if (parts.color) out.push({ property: 'outline-color', value: parts.color });
      return out;
    }
    case 'gap':
    case 'grid-gap': {
      if (tokens.length === 0 || tokens.length > 2 || varShort(2)) return same;
      return [
        { property: 'grid-row-gap', value: tokens[0]! },
        { property: 'grid-column-gap', value: tokens[1] ?? tokens[0]! },
      ];
    }
    case 'row-gap':
      return [{ property: 'grid-row-gap', value }];
    case 'column-gap':
      return [{ property: 'grid-column-gap', value }];
    case 'transition':
      return expandTransition(value) ?? same;
    case 'background': {
      if (tokens.length === 1 && !isWide) {
        const t = tokens[0]!;
        if (/^(url|(repeating-)?(linear|radial|conic)-gradient|image-set)\(/i.test(t)) {
          return [{ property: 'background-image', value: t }];
        }
        if (isColor(t)) return [{ property: 'background-color', value: t }];
      }
      return same;
    }
    case 'grid-template-columns':
    case 'grid-template-rows':
      return [{ property, value: expandRepeat(value) }];
    default:
      return same;
  }
}

/** CSS 1–4 value side expansion (top, right, bottom, left). */
function fourSides(tokens: string[], isWide: boolean): string[] {
  if (isWide) return [tokens[0]!, tokens[0]!, tokens[0]!, tokens[0]!];
  const [a, b = a, c = a, d = b] = tokens as [string, string?, string?, string?];
  return [a, b!, c!, d!];
}

/** Splits `1px solid #000` style shorthands into width / style / color. */
function parseLineShorthand(
  tokens: string[],
  isWide: boolean,
): { width?: string; style?: string; color?: string } | null {
  if (isWide) return { width: tokens[0], style: tokens[0], color: tokens[0] };
  if (tokens.length === 0 || tokens.length > 3) return null;
  // A lone var() could be any combination; keep the shorthand.
  if (tokens.length === 1 && /^var\(/i.test(tokens[0]!)) return null;
  const out: { width?: string; style?: string; color?: string } = {};
  for (const t of tokens) {
    const lower = t.toLowerCase();
    if (!out.style && BORDER_STYLES.has(lower)) out.style = lower;
    else if (!out.width && (isLength(t) || ['thin', 'medium', 'thick'].includes(lower))) out.width = t === '0' ? '0px' : t;
    else if (!out.color) out.color = t;
    else return null;
  }
  return out;
}

function isLength(t: string): boolean {
  return /^-?(\d+\.?\d*|\.\d+)([a-z%]+)?$/i.test(t) || /^(calc|clamp|min|max)\(/i.test(t);
}

const NAMED_COLORS = new Set([
  'transparent', 'currentcolor', 'black', 'white', 'red', 'green', 'blue', 'yellow', 'orange', 'purple',
  'gray', 'grey', 'silver', 'maroon', 'navy', 'teal', 'olive', 'lime', 'aqua', 'fuchsia', 'pink', 'brown',
]);

function isColor(t: string): boolean {
  return (
    /^#[0-9a-f]{3,8}$/i.test(t) ||
    /^(rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color|color-mix)\(/i.test(t) ||
    /^var\(/i.test(t) ||
    NAMED_COLORS.has(t.toLowerCase())
  );
}

const TIMING = /^(ease|ease-in|ease-out|ease-in-out|linear|step-start|step-end)$|^(cubic-bezier|steps|linear)\(/i;
const TIME = /^-?(\d+\.?\d*|\.\d+)(ms|s)$/i;

/**
 * `transition: opacity .3s ease, transform 300ms cubic-bezier(…) 50ms` ->
 * transition-property / -duration / -timing-function (+ -delay when any delay is non-zero),
 * the longhand form the Designer writes (spec 3.5). Returns null when it cannot parse.
 */
function expandTransition(value: string): NativeDecl[] | null {
  if (/var\(/i.test(value)) return null;
  const items = splitTopLevel(value, ',').map((s) => s.trim());
  const props: string[] = [];
  const durations: string[] = [];
  const timings: string[] = [];
  const delays: string[] = [];
  for (const item of items) {
    if (!item) return null;
    let prop: string | null = null;
    let duration: string | null = null;
    let delay: string | null = null;
    let timing: string | null = null;
    for (const t of splitValueTokens(item)) {
      if (TIME.test(t)) {
        if (duration === null) duration = t;
        else if (delay === null) delay = t;
        else return null;
      } else if (TIMING.test(t)) {
        if (timing !== null) return null;
        timing = t;
      } else if (prop === null && /^[a-z-]+$/i.test(t)) {
        prop = t;
      } else {
        return null;
      }
    }
    props.push(prop ?? 'all');
    durations.push(duration ?? '0s');
    timings.push(timing ?? 'ease');
    delays.push(delay ?? '0s');
  }
  if (props.length === 1 && props[0] === 'none') return [{ property: 'transition-property', value: 'none' }];
  const out: NativeDecl[] = [
    { property: 'transition-property', value: props.join(', ') },
    { property: 'transition-duration', value: durations.join(', ') },
    { property: 'transition-timing-function', value: timings.join(', ') },
  ];
  if (delays.some((d) => parseFloat(d) !== 0)) out.push({ property: 'transition-delay', value: delays.join(', ') });
  return out;
}

/**
 * Expands `repeat(3, 1fr)` -> `1fr 1fr 1fr` and `minmax(0, 1fr)` -> `1fr` (spec 3.5: the Designer
 * writes explicit tracks, and `repeat(N, minmax(0, 1fr))` was measured to render narrow columns).
 * `repeat(auto-fit|auto-fill, …)` cannot be expanded and is kept.
 */
export function expandRepeat(value: string): string {
  let out = value.replace(/minmax\(\s*0(px)?\s*,\s*([\d.]+fr)\s*\)/gi, '$2');
  // Expand innermost integer repeat() calls until none remain.
  for (let guard = 0; guard < 10; guard++) {
    const m = /repeat\(\s*(\d+)\s*,/i.exec(out);
    if (!m) break;
    const start = m.index;
    let depth = 0;
    let end = -1;
    for (let i = start; i < out.length; i++) {
      if (out[i] === '(') depth++;
      else if (out[i] === ')') {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end < 0) break;
    const count = Math.min(parseInt(m[1]!, 10), 48);
    const track = out.slice(start + m[0].length, end).trim();
    out = out.slice(0, start) + Array.from({ length: count }, () => track).join(' ') + out.slice(end + 1);
  }
  return out;
}

function stripStrings(v: string): string {
  return v.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, '""');
}
