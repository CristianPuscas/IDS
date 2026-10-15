/**
 * Webflow's canonical declaration order in `styleLess` (spec 3.6).
 *
 * Webflow stores a pasted style with its declarations re-ordered into a fixed property order, and
 * on the next paste compares the incoming `styleLess` with the stored one as an exact string. So a
 * class whose declarations we emit in source order (`position; top; left; …`) is stored as
 * `position; left; top; …` and never matches again: every later paste of the same output makes
 * "name 2" (GreenIron v5 paste test: 208 of 239 duplicated classes differed from the earlier
 * paste's stored style only in declaration order; the 71 that happened to be in canonical order
 * were reused). Emitting declarations in this order makes repeated pastes of the same output
 * reuse the classes the first paste created.
 *
 * The order was measured, not documented: every pasted style read back through the Webflow Data
 * API on the test site (893 declaration lists incl. states, all consistent with it), merged with the
 * Designer's own copies in the real clipboard dumps of spec S3 (693 of 697 lists agree). Where
 * neither had two properties together (e.g. `outline-width`, `transition-delay`, the grid
 * child placement properties), the position is a best guess next to its group. Properties not
 * listed keep their relative order after the listed ones.
 *
 * Ownership: engine.
 */

export const CANONICAL_PROPERTY_ORDER: readonly string[] = [
  'position',
  'left',
  'top',
  'right',
  'bottom',
  'z-index',
  'display',
  'overflow',
  'overflow-x',
  'touch-action',
  'visibility',
  'overflow-y',
  'box-sizing',
  'width',
  'height',
  'min-height',
  'min-width',
  'max-width',
  'max-height',
  'aspect-ratio',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'order',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'float',
  'clear',
  'flex-direction',
  'justify-content',
  'justify-items',
  'flex-wrap',
  'align-items',
  'align-content',
  'grid-auto-flow',
  'grid-auto-columns',
  'grid-auto-rows',
  'align-self',
  'justify-self',
  'flex-grow',
  'flex-shrink',
  'flex-basis',
  'flex',
  'grid-column-gap',
  'grid-row-gap',
  'grid-template-areas',
  'grid-template-columns',
  'grid-template-rows',
  'border-top-style',
  'border-top-width',
  'border-top-color',
  'border-right-style',
  'border-right-width',
  'border-right-color',
  'border-bottom-style',
  'border-bottom-width',
  'border-bottom-color',
  'border-left-style',
  'border-left-width',
  'border-left-color',
  'border-top-left-radius',
  'border-top-right-radius',
  'border-bottom-left-radius',
  'border-bottom-right-radius',
  'border-radius',
  'background-color',
  'outline-color',
  'outline-offset',
  'outline-style',
  'outline-width',
  'background-image',
  'background-position',
  'column-count',
  'box-shadow',
  'perspective-origin',
  'transform-origin',
  'background-size',
  'background-repeat',
  'background-attachment',
  'opacity',
  'filter',
  'backdrop-filter',
  'list-style',
  'list-style-type',
  'pointer-events',
  'transform',
  'transform-style',
  'perspective',
  'transition-property',
  'transition-duration',
  'transition-timing-function',
  'transition-delay',
  'font-family',
  'color',
  'font-size',
  'line-height',
  'font-style',
  'font-weight',
  'text-align',
  'letter-spacing',
  'text-indent',
  'text-decoration',
  'user-select',
  'text-transform',
  'background-clip',
  'mix-blend-mode',
  'object-fit',
  'object-position',
  'overflow-wrap',
  'word-break',
  'resize',
  'scroll-snap-align',
  'scrollbar-color',
  'scrollbar-width',
  'scroll-snap-type',
  'text-shadow',
  'white-space',
  'text-overflow',
  'font-variant-numeric',
  'grid-area',
  'grid-row-start',
  'grid-row-end',
  'grid-column-start',
  'grid-column-end',
  'clip',
  'cursor',
  'accent-color',
  'appearance',
  'font',
  'vertical-align',
  'will-change',
];

const RANK = new Map(CANONICAL_PROPERTY_ORDER.map((p, i) => [p, i]));

/**
 * Sorts declarations into Webflow's canonical order (stable; unlisted properties keep their
 * relative order after the listed ones). Returns a new array.
 */
export function sortDeclarations<T extends { property: string }>(decls: readonly T[]): T[] {
  return decls
    .map((d, i) => ({ d, i, r: RANK.get(d.property.toLowerCase()) ?? CANONICAL_PROPERTY_ORDER.length }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.d);
}
