/**
 * Style mapping. Decides, rule by rule, whether CSS can become a native Webflow class style
 * (spec 3, checklist 7.4) or must go to a `<style>` embed:
 *
 * | CSS                                  | Destination                                   |
 * |--------------------------------------|-----------------------------------------------|
 * | `.a`                                 | base style (`comb: ""`)                       |
 * | `.a.b`                               | combo style (`comb: "&"`), chained via children|
 * | `.a:hover`, `:focus`, `:active`...   | state variant (`main_hover`...)               |
 * | `@media (max-width: ~991/767/479px)` | `medium` / `small` / `tiny` (within tolerance) |
 * | everything else                      | leftover CSS for the `<style>` embed          |
 *
 * It also expands shorthands to longhands, `gap` to `grid-*-gap`, and `repeat()` tracks.
 *
 * Ownership: engine.
 */

import { uuid } from './ids';
import type { CssDeclaration, ParsedCss } from './cssParser';
import type { ConvertOptions, ConvertWarning, WfStyle, WfVariantKey } from './types';

/**
 * Creates and tracks `WfStyle` objects while nodes are built. Combo chains depend on the class
 * list of each element, so styles are resolved per element rather than up front.
 */
export interface StyleRegistry {
  /**
   * Returns the style `_id`s for an element's class list (`classes` on a WfElementNode):
   * the first class is the base (`comb: ""`), the rest are combos (`comb: "&"`) scoped to the
   * preceding chain. Creates missing styles (empty `styleLess` if the CSS never mentions them)
   * and records each combo in its predecessor's `children`.
   *
   * @param classNames Class names in `class` attribute order. Empty array -> `[]`.
   */
  resolve(classNames: string[]): string[];
  /** All styles created so far, in creation order (this becomes `payload.styles`). */
  styles(): WfStyle[];
}

/** Result of `mapStyles`. */
export interface StyleMapResult {
  registry: StyleRegistry;
  /**
   * CSS that has no native representation, as source text in cascade order, ready for a
   * `<style>` embed. Empty when everything mapped (or when `keepUnsupportedInEmbed` is false).
   */
  leftoverCss: string[];
  /** Number of style rules (not at-rules) placed in `leftoverCss`. Feeds `stats.embeddedCssRules`. */
  leftoverRuleCount: number;
  warnings: ConvertWarning[];
}

/**
 * Maps parsed CSS onto Webflow class styles.
 *
 * @param css Output of `parseCss`.
 * @param options Fully-resolved convert options (tolerance, large breakpoints, embed policy).
 */
export function mapStyles(css: ParsedCss, options: ConvertOptions): StyleMapResult {
  // Stub: no rule is mapped yet. The registry still creates (empty) styles for used classes.
  void options;
  return {
    registry: createStyleRegistry(new Map()),
    leftoverCss: [...css.rules, ...css.atRules].sort((a, b) => a.order - b.order).map((r) => r.raw),
    leftoverRuleCount: css.rules.length,
    warnings: [],
  };
}

/**
 * Declarations collected for one class chain (base or combo), keyed by variant.
 * Key `main` holds the base `styleLess`.
 */
export type ChainDeclarations = Map<'main' | WfVariantKey, CssDeclaration[]>;

/**
 * Builds a registry from pre-computed declarations.
 *
 * @param byChain Declarations keyed by class chain, e.g. `"button"` or `"button.is-secondary"`.
 */
export function createStyleRegistry(byChain: Map<string, ChainDeclarations>): StyleRegistry {
  const created = new Map<string, WfStyle>();
  const order: WfStyle[] = [];

  const getOrCreate = (chainKey: string, name: string, comb: WfStyle['comb']): WfStyle => {
    const existing = created.get(chainKey);
    if (existing) return existing;
    const decls = byChain.get(chainKey);
    const variants: WfStyle['variants'] = {};
    let styleLess = '';
    decls?.forEach((list, key) => {
      if (key === 'main') styleLess = toStyleLess(list);
      else variants[key] = { styleLess: toStyleLess(list) };
    });
    const style: WfStyle = {
      _id: uuid(),
      fake: false,
      type: 'class',
      name,
      namespace: '',
      comb,
      styleLess,
      variants,
      children: [],
      origin: null,
      selector: null,
    };
    created.set(chainKey, style);
    order.push(style);
    return style;
  };

  return {
    resolve(classNames) {
      const ids: string[] = [];
      let chain = '';
      let prev: WfStyle | null = null;
      for (const name of classNames) {
        if (!name) continue;
        chain = chain ? `${chain}.${name}` : name;
        const style = getOrCreate(chain, name, prev ? '&' : '');
        if (prev && !prev.children.includes(style._id)) prev.children.push(style._id);
        ids.push(style._id);
        prev = style;
      }
      return ids;
    },
    styles() {
      return [...order];
    },
  };
}

/** Serialises declarations to Webflow `styleLess`: `"prop: value; prop2: value2;"`. */
export function toStyleLess(decls: CssDeclaration[]): string {
  return decls.map((d) => `${d.property}: ${d.value};`).join(' ');
}
