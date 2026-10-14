/**
 * A small cascade helper: which source declarations apply to one DOM element, in cascade order.
 * Used where the converter must know what the *source* page rendered for an element (button
 * defaults, embed sizing), independent of how the rules are later mapped to Webflow classes.
 *
 * Matching uses `Element.matches` on the parsed document, so descendant, tag and universal
 * selectors are honoured. Selectors with pseudo-elements or user-action states (`:hover`…) never
 * match the element's resting state and are skipped.
 *
 * Ownership: engine.
 */

import { parseDeclarations, type CssDeclaration, type CssStyleRule } from './cssParser';

/** Specificity as `[ids, classes/attributes/pseudo-classes, types/pseudo-elements]`. */
export type Specificity = [number, number, number];

/** One declaration that applies to the element, with what the cascade needs to rank it. */
export interface MatchedDeclaration {
  decl: CssDeclaration;
  /** `[1, 0, 0, 0]`-style rank: inline style beats every selector. */
  specificity: Specificity;
  /** Source order of the rule (inline style: `Infinity`). */
  order: number;
  /** Enclosing `@media` preludes (`[]` for none or for inline style). */
  mediaStack: string[];
  /** The selector that matched (`"style"` for the inline style attribute). */
  selector: string;
  inline: boolean;
}

const STATEFUL = /:(hover|active|focus|focus-visible|focus-within|visited|target|checked|invalid|valid)\b|::?(before|after|placeholder|marker|selection|first-line|first-letter|backdrop|file-selector-button)\b/i;

/**
 * Every declaration (from every rule, including ones inside `@media`) that applies to `el` in its
 * resting state, followed by its inline `style` declarations. Sorted in cascade order (lowest
 * first): `!important` last, then specificity, then source order.
 */
export function matchedDeclarations(el: Element, rules: CssStyleRule[]): MatchedDeclaration[] {
  const out: MatchedDeclaration[] = [];
  for (const rule of rules) {
    let best: { selector: string; specificity: Specificity } | null = null;
    for (const selector of rule.selectors) {
      if (STATEFUL.test(selector)) continue;
      let hit = false;
      try {
        hit = el.matches(selector);
      } catch {
        hit = false;
      }
      if (!hit) continue;
      const specificity = selectorSpecificity(selector);
      if (!best || compareSpecificity(specificity, best.specificity) > 0) best = { selector, specificity };
    }
    if (!best) continue;
    for (const decl of rule.declarations) {
      out.push({ decl, specificity: best.specificity, order: rule.order, mediaStack: rule.mediaStack, selector: best.selector, inline: false });
    }
  }
  const style = el.getAttribute('style');
  if (style) {
    for (const decl of parseDeclarations(style)) {
      out.push({ decl, specificity: [1e6, 0, 0], order: Infinity, mediaStack: [], selector: 'style', inline: true });
    }
  }
  return out.sort(
    (a, b) => Number(a.decl.important) - Number(b.decl.important) || compareSpecificity(a.specificity, b.specificity) || a.order - b.order,
  );
}

/** Compares two specificities: negative when `a` is lower. */
export function compareSpecificity(a: Specificity, b: Specificity): number {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

/** True when `s` is at least one class (`[0, 1, 0]`): it beats Webflow's `.w-*` preset rules. */
export function atLeastClass(s: Specificity): boolean {
  return compareSpecificity(s, [0, 1, 0]) >= 0;
}

/**
 * Selector specificity (Selectors Level 4): `:where()` counts zero; `:is()`, `:not()`, `:has()`
 * count their most specific argument; other pseudo-classes count as a class.
 */
export function selectorSpecificity(selector: string): Specificity {
  const s: Specificity = [0, 0, 0];
  let sel = selector.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, '""');
  // Functional pseudo-classes: take the max of their arguments, then remove them.
  for (let guard = 0; guard < 20; guard++) {
    const m = /:(where|is|not|has|matches|-webkit-any)\(/i.exec(sel);
    if (!m) break;
    const open = m.index + m[0].length - 1;
    const close = matchParen(sel, open);
    const inner = sel.slice(open + 1, close);
    if (m[1]!.toLowerCase() !== 'where') {
      let max: Specificity = [0, 0, 0];
      for (const part of splitComma(inner)) {
        const sp = selectorSpecificity(part);
        if (compareSpecificity(sp, max) > 0) max = sp;
      }
      s[0] += max[0];
      s[1] += max[1];
      s[2] += max[2];
    }
    sel = sel.slice(0, m.index) + ' ' + sel.slice(close + 1);
  }
  sel = sel.replace(/\\./g, 'x');
  s[0] += (sel.match(/#[\w-]+/g) ?? []).length;
  s[1] += (sel.match(/\.[\w-]+/g) ?? []).length;
  s[1] += (sel.match(/\[[^\]]*\]/g) ?? []).length;
  sel = sel.replace(/\[[^\]]*\]/g, ' ');
  const pseudoElements = (sel.match(/::[\w-]+(\([^)]*\))?/g) ?? []).length + (sel.match(/(^|[^:]):(before|after|first-line|first-letter)\b/gi) ?? []).length;
  s[2] += pseudoElements;
  sel = sel.replace(/::[\w-]+(\([^)]*\))?/g, ' ').replace(/:(before|after|first-line|first-letter)\b/gi, ' ');
  s[1] += (sel.match(/:[\w-]+(\([^)]*\))?/g) ?? []).length;
  sel = sel.replace(/:[\w-]+(\([^)]*\))?/g, ' ').replace(/[#.][\w-]+/g, ' ');
  s[2] += (sel.match(/(^|[\s>+~(])[a-zA-Z][\w-]*/g) ?? []).length;
  return s;
}

function matchParen(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return text.length - 1;
}

function splitComma(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let last = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (c === ',' && depth === 0) {
      parts.push(text.slice(last, i));
      last = i + 1;
    }
  }
  parts.push(text.slice(last));
  return parts.map((p) => p.trim()).filter(Boolean);
}
