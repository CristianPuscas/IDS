/**
 * Layout for elements kept in a Code Embed (canvas, svg, video, iframe…).
 *
 * Webflow renders an HtmlEmbed as `<div class="w-embed">…code…</div>`. That extra div has no size
 * of its own, so an embedded element that sizes itself against its parent (`height: 100%`,
 * percentage widths) or positions itself (`position: absolute; inset: 0`) no longer lays out like
 * in the source: percentages resolve against the auto-height wrapper, and the wrapper itself
 * becomes an extra (empty) flex or grid item.
 *
 * Fix: the spec shows HtmlEmbed nodes only with `classes: []` (spec 2.4: no real dump carries a
 * class on an embed), so the embed is placed inside a classed Block instead. That Block's class
 * (`<class>-embed`) takes over the element's layout declarations (position, offsets, size,
 * margins, z-index, aspect-ratio, flex/grid item properties, display), from every rule that
 * matches the element, per breakpoint and in cascade order, and is `display: grid` so the
 * `.w-embed` div stretches to fill it. The inner element gets an inline style that makes it fill
 * the wrapper (`display: block; width: 100%; height: 100%`, plus `position: static` / `margin: 0`
 * when those moved). An inline style is used because it outranks the element's class rules in the
 * `<style>` embed without adding selectors, and it travels with the element.
 *
 * Ownership: engine.
 */

import { matchedDeclarations, type MatchedDeclaration } from './cascade';
import { parseDeclarations, type CssDeclaration, type CssStyleRule } from './cssParser';
import { expandShorthand } from './cssValues';

/** Tags whose layout is fixed up when they are embedded. */
export const SIZED_EMBED_TAGS = new Set(['canvas', 'svg', 'video', 'iframe', 'picture', 'object', 'embed']);

/** Layout properties (and their shorthands) that move from the element to the wrapper. */
const LAYOUT = new Set([
  'position', 'inset', 'inset-inline', 'inset-block', 'top', 'right', 'bottom', 'left',
  'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height', 'aspect-ratio', 'z-index',
  'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'margin-inline', 'margin-block',
  'margin-inline-start', 'margin-inline-end', 'margin-block-start', 'margin-block-end',
  'flex', 'flex-grow', 'flex-shrink', 'flex-basis', 'align-self', 'justify-self', 'place-self', 'order',
  'grid-area', 'grid-column', 'grid-row', 'grid-column-start', 'grid-column-end', 'grid-row-start', 'grid-row-end',
  'float', 'display',
]);

/** Synthetic rules get orders above every real rule, so embed pieces (if any) come last. */
const ORDER_BASE = 2e9;

/** Result of `planEmbedSizing`. */
export interface EmbedSizingPlan {
  /** Rules for `.<wrapperClass>`, in cascade order (lowest first), ready for `mapStyles`. */
  rules: CssStyleRule[];
  /** The element's HTML with the fill style applied. */
  html: string;
  /** Layout properties that moved to the wrapper (source property names). */
  moved: string[];
}

/**
 * Decides whether an embedded element needs a sizing wrapper and builds it.
 *
 * @param el Embedded element in the parsed document.
 * @param rules All parsed style rules.
 * @param wrapperClass Class name for the wrapper Block (must be unique).
 * @param orderOffset Added to synthetic rule orders, so plans for several elements don't collide.
 * @returns `null` when the element has no percentage or absolute sizing.
 */
export function planEmbedSizing(el: Element, rules: CssStyleRule[], wrapperClass: string, orderOffset = 0): EmbedSizingPlan | null {
  const matched = matchedDeclarations(el, rules);
  if (!needsWrapper(matched)) return null;

  const selector = `.${wrapperClass}`;
  const out: CssStyleRule[] = [
    synthetic(selector, [{ property: 'display', value: 'grid', important: false }], [], ORDER_BASE + orderOffset),
  ];
  const moved = new Set<string>();
  let group: { key: string; decls: CssDeclaration[]; mediaStack: string[] } | null = null;
  const flush = (): void => {
    if (group && group.decls.length) {
      out.push(synthetic(selector, group.decls, group.mediaStack, ORDER_BASE + orderOffset + out.length));
    }
    group = null;
  };
  for (const m of matched) {
    if (!LAYOUT.has(m.decl.property)) continue;
    // Universal rules (`* { margin: 0 }`) already apply to the wrapper div itself.
    if (!m.inline && m.specificity.every((n) => n === 0)) continue;
    const decl = m.decl.property === 'display' ? wrapperDisplay(m.decl) : m.decl;
    if (!decl) continue;
    moved.add(m.decl.property);
    const key = `${m.order}\u0001${m.selector}\u0001${m.decl.important}`;
    if (!group || group.key !== key) {
      flush();
      group = { key, decls: [], mediaStack: m.mediaStack };
    }
    group.decls.push(decl);
  }
  flush();

  const clone = el.cloneNode(true) as Element;
  clone.setAttribute('style', fillStyle(el.getAttribute('style') ?? '', moved));
  return { rules: out, html: clone.outerHTML, moved: [...moved] };
}

/** True when the element positions itself absolutely or sizes itself in percentages. */
function needsWrapper(matched: MatchedDeclaration[]): boolean {
  for (const m of matched) {
    for (const d of expandShorthand(m.decl.property, m.decl.value)) {
      if (d.property === 'position' && /^(absolute|fixed)$/i.test(d.value.trim())) return true;
      if (/^(min-|max-)?(width|height)$/.test(d.property) && /%/.test(d.value)) return true;
    }
  }
  return false;
}

/** The wrapper keeps `none`; any other display becomes (inline-)grid so the embed div stretches. */
function wrapperDisplay(decl: CssDeclaration): CssDeclaration | null {
  const v = decl.value.trim().toLowerCase();
  if (v === 'contents') return null;
  const value = v === 'none' ? 'none' : v.startsWith('inline') ? 'inline-grid' : 'grid';
  return { ...decl, value };
}

function synthetic(selector: string, declarations: CssDeclaration[], mediaStack: string[], order: number): CssStyleRule {
  const body = declarations.map((d) => `${d.property}: ${d.value}${d.important ? ' !important' : ''};`).join(' ');
  return {
    kind: 'style',
    selectors: [selector],
    declarations,
    media: mediaStack.length ? mediaStack.join(' and ') : null,
    mediaStack,
    body,
    raw: `${selector} { ${body} }`,
    order,
  };
}

/** Inline style for the inner element: its own non-layout declarations plus "fill the wrapper". */
function fillStyle(original: string, moved: Set<string>): string {
  const keep = parseDeclarations(original)
    .filter((d) => !LAYOUT.has(d.property))
    .map((d) => `${d.property}: ${d.value}${d.important ? ' !important' : ''}`);
  const fill: string[] = [];
  if (moved.has('position')) fill.push('position: static');
  fill.push('display: block', 'width: 100%', 'height: 100%');
  if ([...moved].some((p) => p.startsWith('margin'))) fill.push('margin: 0');
  if (moved.has('min-width') || moved.has('min-height')) fill.push('min-width: 0', 'min-height: 0');
  if (moved.has('max-width') || moved.has('max-height')) fill.push('max-width: none', 'max-height: none');
  return [...keep, ...fill].join('; ') + ';';
}
