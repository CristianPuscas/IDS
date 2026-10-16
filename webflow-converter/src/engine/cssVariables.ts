/**
 * CSS custom properties defined page-wide (`:root`, `html`, `body`), option `cssVariables`.
 *
 * In the source they live on `:root`. Pasted as they are, they go to a `<style>` embed as a global
 * `:root { … }` block, which is a problem in Webflow: a site Variable, a site-wide custom code block
 * or another pasted section with the same names (`--background-color--primary` is the Client-First
 * v2.1 name, so two Client-First sections share it) overrides them, and the pasted block in turn
 * changes every other section of the page. Two remedies:
 *
 * - `'scope'`: the definitions move to `[data-h2w-vars="<id>"]`, an attribute the converter puts on
 *   the pasted root element. Custom properties inherit, so every pasted element still sees them, and
 *   a definition on that element wins over any `:root` one, wherever it comes from. Rules aimed at
 *   the whole page (`body`, `html`, `*`) are outside that element, so `var()` in them is replaced by
 *   the value.
 * - `'inline'` (default): additionally, `var(--x)` in every declaration is replaced by its value
 *   when `--x` has exactly one unconditional definition on `:root`/`html`/`body` and none elsewhere.
 *   Class styles then carry literal values, so a class keeps its colours on any page, with or
 *   without the embed. Variables that also change in a `@media` query or on another selector stay
 *   `var()` and keep their scoped definitions.
 * - `'global'`: the definitions stay on `:root` as written (the behaviour before v8).
 *
 * Evidence: hero-construction paste test on /testhero (diag5): the site's own Variables are named
 * `--_semantic---…`, so they did not clash there, but any Client-First site or a second pasted
 * section would.
 *
 * Ownership: engine.
 */

import type { CssDeclaration, CssStyleRule } from './cssParser';
import { stableUuid } from './ids';
import type { CssVariablesMode } from './types';

/** Selectors whose custom properties count as page-wide definitions. */
const PAGE_SELECTOR = /^(?::root|html|html:root|body)$/i;
/** Selectors that style the whole page (outside the pasted element). */
const GLOBAL_SELECTOR = /^(?:\*|html|body|:root)(?![\w-])/i;

/** What `planCssVariables` did. */
export interface CssVariablesPlan {
  /** The source rules after the change (definitions moved out, values substituted). */
  rules: CssStyleRule[];
  /** CSS with the scoped definitions (`[data-h2w-vars="…"] { … }`), or `''`. */
  scopedCss: string;
  /** Value of `data-h2w-vars` for the pasted root element, or `null` when nothing was scoped. */
  scopeId: string | null;
  /** Names of the variables whose `var()` uses were replaced by values. */
  inlined: string[];
  /** Names of the variables left as `var()` (conditional or defined on other selectors). */
  kept: string[];
}

const isCustom = (d: CssDeclaration): boolean => d.property.startsWith('--');

/** Attribute selector of a scope id. */
export function scopeSelector(id: string): string {
  return `[data-h2w-vars="${id}"]`;
}

/**
 * Moves page-wide custom property definitions to a scope and/or substitutes their values.
 * Returns the rules unchanged with `mode: 'global'` or when the source defines no variables.
 */
export function planCssVariables(rules: readonly CssStyleRule[], mode: CssVariablesMode): CssVariablesPlan {
  const none: CssVariablesPlan = { rules: [...rules], scopedCss: '', scopeId: null, inlined: [], kept: [] };
  if (mode === 'global') return none;

  // 1. Collect definitions: unconditional page-wide ones, and names that are conditional or local.
  const values = new Map<string, string>();
  const conditional = new Set<string>();
  let hasPageVars = false;
  for (const r of rules) {
    const page = r.selectors.length > 0 && r.selectors.every((s) => PAGE_SELECTOR.test(s.trim()));
    for (const d of r.declarations) {
      if (!isCustom(d)) continue;
      if (!page) conditional.add(d.property);
      else {
        hasPageVars = true;
        if (r.mediaStack.length > 0) conditional.add(d.property);
        else values.set(d.property, d.value);
      }
    }
  }
  if (!hasPageVars) return none;

  // 2. Split page-wide rules: custom properties go to the scope, the rest stays where it was.
  const scoped: { media: string[]; decls: CssDeclaration[] }[] = [];
  const out: CssStyleRule[] = [];
  for (const r of rules) {
    const page = r.selectors.length > 0 && r.selectors.every((s) => PAGE_SELECTOR.test(s.trim()));
    const custom = page ? r.declarations.filter(isCustom) : [];
    if (custom.length === 0) {
      out.push(r);
      continue;
    }
    scoped.push({ media: r.mediaStack, decls: custom });
    const rest = r.declarations.filter((d) => !isCustom(d));
    if (rest.length > 0) out.push({ ...r, declarations: rest });
  }

  // 3. Substitute values: everywhere for 'inline' (unconditional variables only), in page-wide
  // rules for 'scope' (they are outside the scope, so var() there would find nothing).
  const inlinable = new Map([...values].filter(([name]) => !conditional.has(name)));
  const used = new Set<string>();
  const substitute = (r: CssStyleRule, table: Map<string, string>): CssStyleRule => {
    let changed = false;
    const declarations = r.declarations.map((d) => {
      if (isCustom(d) || !d.value.includes('var(')) return d;
      const value = resolveVars(d.value, table, used);
      if (value === d.value) return d;
      changed = true;
      return { ...d, value };
    });
    return changed ? { ...r, declarations } : r;
  };
  const resolvedRules = out.map((r) => {
    const global = r.selectors.some((s) => GLOBAL_SELECTOR.test(s.trim()));
    // Page-wide rules get every unconditional value (the scoped definitions cannot reach them).
    if (global) return substitute(r, values);
    return mode === 'inline' ? substitute(r, inlinable) : r;
  });

  const id = `v${stableUuid(scoped.map((s) => s.media.join('|') + '{' + s.decls.map((d) => `${d.property}:${d.value}`).join(';')).join('\n')).slice(0, 8)}`;
  const sel = scopeSelector(id);
  const scopedCss = scoped
    .map(({ media, decls }) => {
      let css = `${sel} {\n${decls.map((d) => `  ${d.property}: ${d.value}${d.important ? ' !important' : ''};`).join('\n')}\n}`;
      for (let i = media.length - 1; i >= 0; i--) css = `@media ${media[i]} {\n${css}\n}`;
      return css;
    })
    .join('\n');
  const allNames = new Set(scoped.flatMap((s) => s.decls.map((d) => d.property)));
  return {
    rules: resolvedRules,
    scopedCss,
    scopeId: id,
    inlined: mode === 'inline' ? [...used].filter((n) => inlinable.has(n)).sort() : [],
    kept: mode === 'inline' ? [...allNames].filter((n) => !inlinable.has(n)).sort() : [],
  };
}

/**
 * Replaces `var(--name)` / `var(--name, fallback)` in `value` with the value from `table`
 * (recursively; a fallback is used when the name is unknown and the fallback resolves). Unknown
 * names without a usable fallback are left as they are. `used` collects the names substituted.
 */
export function resolveVars(value: string, table: ReadonlyMap<string, string>, used: Set<string> = new Set(), depth = 0): string {
  if (depth > 20 || !value.includes('var(')) return value;
  let out = '';
  let i = 0;
  while (i < value.length) {
    const at = value.indexOf('var(', i);
    if (at < 0 || (at > 0 && /[\w-]/.test(value[at - 1]!))) {
      if (at < 0) {
        out += value.slice(i);
        break;
      }
      out += value.slice(i, at + 4);
      i = at + 4;
      continue;
    }
    const close = matchParen(value, at + 3);
    if (close < 0) {
      out += value.slice(i);
      break;
    }
    out += value.slice(i, at);
    const inner = value.slice(at + 4, close);
    const comma = topLevelComma(inner);
    const name = (comma < 0 ? inner : inner.slice(0, comma)).trim();
    const fallback = comma < 0 ? null : inner.slice(comma + 1).trim();
    const own = table.get(name);
    let replacement: string | null = null;
    if (own !== undefined) {
      const resolved = resolveVars(own, table, used, depth + 1);
      if (!resolved.includes('var(')) {
        replacement = resolved;
        used.add(name);
      }
    } else if (fallback !== null) {
      const resolved = resolveVars(fallback, table, used, depth + 1);
      if (!resolved.includes('var(')) replacement = resolved;
    }
    out += replacement ?? value.slice(at, close + 1);
    i = close + 1;
  }
  return out;
}

/** Index of the `)` matching the `(` at `open`, or -1. */
function matchParen(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (c === '"' || c === "'") {
      for (i++; i < text.length && text[i] !== c; i++) if (text[i] === '\\') i++;
    } else if (c === '(') depth++;
    else if (c === ')' && --depth === 0) return i;
  }
  return -1;
}

/** Index of the first comma outside parentheses and strings, or -1. */
function topLevelComma(text: string): number {
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"' || c === "'") {
      for (i++; i < text.length && text[i] !== c; i++) if (text[i] === '\\') i++;
    } else if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (c === ',' && depth === 0) return i;
  }
  return -1;
}
