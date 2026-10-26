/**
 * Baseline reset for full-document input (option `neutralizeDefaults`).
 *
 * A page that leaves some tag properties to the browser (body letter-spacing, heading line-height,
 * paragraph margins…) renders differently once pasted, because the destination site's tag styles
 * (`body { letter-spacing: .025em }`, `h3 { font-family: … }`, `p { margin-bottom: 0 }`) and
 * webflow.css (`h1 { margin-top: 20px }`, `img { max-width: 100% }`, `label { font-weight: bold }`)
 * now apply. Class styles cannot express tag defaults, so a short block of bare tag rules, set to
 * the browser defaults, is put at the top of the `<style>` embed. It comes after the site's CSS in
 * the published page, so at equal specificity it wins over site tag styles, and every source rule
 * (later in the embed, or a class) still wins over it.
 *
 * A property the source itself declares for a tag (outside `@media`, including in selector lists
 * such as `h1, h2, h3, p { margin-top: 0 }`) is left out for that tag.
 *
 * Ownership: engine.
 */

import type { CssStyleRule } from './cssParser';
import { expandShorthand } from './cssValues';

/** The reset, as `[tags, declarations]`, in browser-default values. */
const RESET: [string[], [string, string][]][] = [
  [['body'], [['letter-spacing', 'normal'], ['font-size', '16px'], ['line-height', 'normal'], ['color', 'CanvasText']]],
  [
    ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
    [['font-family', 'inherit'], ['letter-spacing', 'inherit'], ['line-height', 'inherit'], ['color', 'inherit'], ['text-transform', 'none'], ['font-weight', 'bold']],
  ],
  [['h1'], [['font-size', '2em'], ['margin', '.67em 0']]],
  [['h2'], [['font-size', '1.5em'], ['margin', '.83em 0']]],
  [['h3'], [['font-size', '1.17em'], ['margin', '1em 0']]],
  [['h4'], [['font-size', '1em'], ['margin', '1.33em 0']]],
  [['h5'], [['font-size', '.83em'], ['margin', '1.67em 0']]],
  [['h6'], [['font-size', '.67em'], ['margin', '2.33em 0']]],
  [['p'], [['margin', '1em 0'], ['letter-spacing', 'inherit']]],
  [['label'], [['display', 'inline'], ['margin-bottom', '0'], ['font-weight', 'normal']]],
  [['img'], [['max-width', 'none'], ['vertical-align', 'baseline']]],
  [['ul', 'ol'], [['margin', '1em 0'], ['padding-left', '40px']]],
  // `<b>` is always pasted as `<strong>` (Strong), so the reset only needs `strong`.
  [['strong'], [['font-weight', 'bolder']]],
];

/** Shorthands `expandShorthand` keeps whole, with the longhands they set. */
const SHORTHAND_FAMILY: Record<string, string[]> = {
  font: ['font-family', 'font-size', 'font-weight', 'font-style', 'font-variant', 'font-stretch', 'line-height'],
  margin: ['margin-top', 'margin-right', 'margin-bottom', 'margin-left'],
  padding: ['padding-top', 'padding-right', 'padding-bottom', 'padding-left'],
  'list-style': ['list-style-type', 'list-style-position', 'list-style-image'],
};

/** True for a selector that is a bare type selector (`h1`, `p`…). */
const BARE_TAG = /^[a-z][a-z0-9]*$/;

/** Longhands a source declaration sets (`all` sets everything). */
function longhands(property: string, value: string): string[] | 'all' {
  if (property === 'all') return 'all';
  const out = new Set<string>([property, ...(SHORTHAND_FAMILY[property] ?? [])]);
  for (const d of expandShorthand(property, value)) out.add(d.property);
  return [...out];
}

/** Tag -> longhands the source declares for that bare tag (outside `@media`). */
function sourceTagProperties(rules: CssStyleRule[]): Map<string, Set<string> | 'all'> {
  const map = new Map<string, Set<string> | 'all'>();
  for (const rule of rules) {
    if (rule.mediaStack.length > 0) continue;
    for (const raw of rule.selectors) {
      const tag = raw.trim().toLowerCase();
      if (!BARE_TAG.test(tag)) continue;
      let set = map.get(tag) ?? new Set<string>();
      for (const d of rule.declarations) {
        if (set === 'all') break;
        const lh = longhands(d.property, d.value);
        if (lh === 'all') set = 'all';
        else for (const p of lh) set.add(p);
      }
      map.set(tag, set);
    }
  }
  return map;
}

/**
 * The reset CSS for this source, or `""` when the source already sets every property.
 *
 * @param rules Parsed source rules (after class renames).
 */
export function buildBaselineReset(rules: CssStyleRule[]): string {
  const declared = sourceTagProperties(rules);
  const lines: string[] = [];
  for (const [tags, decls] of RESET) {
    // Remaining declarations per tag; tags that end up identical share one rule.
    const groups: { tags: string[]; text: string }[] = [];
    for (const tag of tags) {
      const covered = declared.get(tag);
      if (covered === 'all') continue;
      const parts: string[] = [];
      for (const [property, value] of decls) {
        const expanded = expandShorthand(property, value);
        const free = expanded.filter((d) => !covered?.has(d.property) && !covered?.has(property));
        if (free.length === expanded.length) parts.push(`${property}:${value}`);
        else for (const d of free) parts.push(`${d.property}:${d.value}`);
      }
      if (parts.length === 0) continue;
      const text = parts.join(';');
      const group = groups.find((g) => g.text === text);
      if (group) group.tags.push(tag);
      else groups.push({ tags: [tag], text });
    }
    for (const g of groups) lines.push(`${g.tags.join(',')}{${g.text}}`);
  }
  if (lines.length === 0) return '';
  return `/* Browser defaults this page relies on (resets the site's tag styles; option neutralizeDefaults) */\n${lines.join('\n')}`;
}

/** True when the HTML is a full document rather than a fragment. */
export function isFullDocument(html: string): boolean {
  return /<!doctype\s|<html[\s>]|<body[\s>]|<head[\s>]/i.test(html);
}
