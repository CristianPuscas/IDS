/**
 * Finsweet Client-First v2 class vocabulary: the core-structure and utility class names of the
 * Client-First starter (cloneable), as one source of truth for the collision check, the
 * `clientFirstUtilities` prefix option and the structure hint.
 *
 * Client-First naming: a custom class contains `_` (`folder_element`, `section_hero`); a utility
 * has dashes only (`text-size-large`). Every utility is global, so a Client-First site is expected
 * to define these names already.
 *
 * Ownership: engine.
 */

/** Core-structure classes (page-wrapper > main-wrapper > section_[id] > padding-global > container-[size] > padding-section-[size]). */
export const CLIENT_FIRST_CORE: readonly string[] = [
  'page-wrapper',
  'main-wrapper',
  'padding-global',
  'container-small',
  'container-medium',
  'container-large',
  'padding-section-small',
  'padding-section-medium',
  'padding-section-large',
];

const SIZES = 'tiny|xxsmall|xsmall|small|medium|large|xlarge|xxlarge|huge|xhuge|xxhuge|custom1|custom2|custom3';
const DIRECTIONS = 'top|bottom|left|right|vertical|horizontal';
const MAX_WIDTHS = 'xxsmall|xsmall|small|medium|large|xlarge|xxlarge|full|full-tablet|full-mobile-landscape|full-mobile-portrait';

/** Utility classes of the Client-First starter (exact names and families). */
const CLIENT_FIRST_UTILITY: readonly RegExp[] = [
  // Spacing: size and direction classes, spacer blocks, resets.
  new RegExp(`^(margin|padding)-(${SIZES}|${DIRECTIONS}|0)$`),
  new RegExp(`^spacer-(${SIZES})$`),
  /^spacing-clean$/,
  // Max width.
  new RegExp(`^max-width-(${MAX_WIDTHS})$`),
  // Typography.
  /^text-size-(large|medium|regular|small|tiny)$/,
  /^text-weight-(light|normal|medium|semibold|bold|xbold)$/,
  /^text-style-(allcaps|italic|link|muted|nowrap|strikethrough|quote|2lines|3lines)$/,
  /^text-align-(left|center|right)$/,
  /^text-color-[a-z0-9]+(-[a-z0-9]+)*$/, // colour families are project-defined (primary, secondary, alternate…)
  /^heading-style-h[1-6]$/,
  /^text-rich-text$/,
  /^inherit-color$/,
  // Colour.
  /^background-color-[a-z0-9]+(-[a-z0-9]+)*$/,
  // Starter components without a folder (global classes of the cloneable).
  /^button(-group)?$/,
  // Other utilities.
  /^icon-(1x1|height)-(small|medium|large)$/,
  /^icon-embed-(xxsmall|xsmall|small|medium|large|custom1|custom2|custom3)$/,
  /^aspect-ratio-(square|portrait|landscape|widescreen)$/,
  /^hide(-(tablet|mobile-landscape|mobile-portrait|mobile))?$/,
  /^z-index-[12]$/,
  /^(layer|align-center|display-inlineflex)$/,
  /^overflow-(hidden|scroll|auto|visible)$/,
  /^pointer-events-(none|auto)$/,
];

const CORE_SET = new Set(CLIENT_FIRST_CORE);

/** True for a Client-First core-structure class (`page-wrapper`, `padding-global`, `container-large`…). */
export function isClientFirstCore(name: string): boolean {
  return CORE_SET.has(name);
}

/**
 * True for a Client-First core or utility class name, i.e. a class a Client-First site is expected
 * to already define. Custom classes (with `_`) and `is-` combos are never utilities.
 */
export function isClientFirstUtility(name: string): boolean {
  if (name.includes('_') || name.startsWith('is-')) return false;
  return CORE_SET.has(name) || CLIENT_FIRST_UTILITY.some((re) => re.test(name));
}

/** `container-small`, `container-large`… (any size word). */
const CONTAINER = /^container-[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * What a page is missing from the Client-First core structure, or `[]` when it follows it (or is
 * too small to tell: no `<section>`, `section_` class or wrapper class).
 *
 * @param classNames Every class used in the HTML.
 * @param sectionCount Number of `<section>` elements.
 */
export function missingCoreStructure(classNames: Iterable<string>, sectionCount: number): string[] {
  const names = [...classNames];
  const has = (test: (n: string) => boolean): boolean => names.some(test);
  const sectioned = sectionCount > 0 || has((n) => n.startsWith('section_') || n === 'page-wrapper' || n === 'main-wrapper');
  if (!sectioned) return [];
  const missing: string[] = [];
  if (!has((n) => n === 'padding-global')) missing.push('padding-global');
  if (!has((n) => CONTAINER.test(n))) missing.push('container-[size]');
  if (!has((n) => n.startsWith('section_'))) missing.push('section_[name]');
  return missing;
}
