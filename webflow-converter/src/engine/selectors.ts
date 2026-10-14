/**
 * Selector classification (spec 3.3, 3.4, 5). Decides whether one selector (already comma-split)
 * can become a native Webflow class style, and if not, why.
 *
 * Native forms:
 *   `.a`                      base style
 *   `.a.b`                    combo chain (`comb: "&"`)
 *   `.a:hover` / `.a.b:focus` state variant (`main_hover`, …)
 *   `.a.w--current`           Webflow class state (`main_current`); `.a.w--open:hover` -> `main_open_hover`
 *   `.a::placeholder`         `main_placeholder`
 *
 * Only the states verified in real clipboard dumps are mapped (spec 3.3): hover, active (the
 * Designer's "Pressed"), focus, focus-visible, visited, placeholder, plus the Webflow states
 * current/open. Everything else (`:focus-within`, `:first-child`, `:not()`, `::before`…) is routed
 * to the `<style>` embed: emitting an unverified variant key risks a paste failure.
 *
 * Ownership: engine.
 */

import type { ConvertWarningCode, WfPseudoState, WfWebflowState } from './types';

/** A selector Webflow can represent as a class style. */
export interface NativeSelector {
  kind: 'native';
  /** Class names in selector order, de-duplicated, without Webflow state classes. */
  classes: string[];
  /** `open` / `current` when the selector has `.w--open` / `.w--current`. */
  webflowState: WfWebflowState | null;
  /** Pseudo-state suffix (`hover`, `focus-visible`, `placeholder`…), or `null`. */
  pseudo: WfPseudoState | null;
  /** Specificity as a single number (classes + pseudo-classes), for cascade ordering. */
  specificity: number;
}

/** A selector that must go to the `<style>` embed. */
export interface EmbedSelector {
  kind: 'embed';
  /** Warning category explaining why. */
  code: ConvertWarningCode;
  /** Short human-readable reason. */
  reason: string;
  /** True for selectors that style the whole page (`*`, `html`, `body`, `:root`). */
  global: boolean;
}

export type SelectorClassification = NativeSelector | EmbedSelector;

/** CSS pseudo-class -> Webflow pseudo-state, verified in dumps or Webstudio fixtures (spec 3.3). */
const PSEUDO_MAP: Record<string, WfPseudoState> = {
  hover: 'hover',
  active: 'active',
  focus: 'focus',
  'focus-visible': 'focus-visible',
  visited: 'visited',
};

/** Webflow's own state classes (spec 3.3). */
const WEBFLOW_STATE_CLASSES: Record<string, WfWebflowState> = {
  'w--current': 'current',
  'w--open': 'open',
};

const GLOBAL_TAGS = new Set(['html', 'body']);

/**
 * Classifies one selector.
 *
 * @param selector A single selector (no top-level commas), e.g. `".card.is-active:hover"`.
 */
export function classifySelector(selector: string): SelectorClassification {
  const sel = selector.trim();
  if (!sel) return embed('unsupported-selector', 'empty selector');
  if (sel === ':root' || sel === 'html:root') return embed('css-variable', 'CSS variable definitions on :root');

  if (hasCombinator(sel)) {
    const global = /^(\*|html|body|:root)(?=[\s>+~]|$)/i.test(sel);
    return embed('descendant-selector', 'descendant/child/sibling combinator', global);
  }

  const classes: string[] = [];
  let webflowState: WfWebflowState | null = null;
  let pseudo: WfPseudoState | null = null;
  let specificity = 0;
  let i = 0;

  while (i < sel.length) {
    const c = sel[i]!;
    if (c === '.') {
      const { name, next } = readIdent(sel, i + 1);
      if (!name) return embed('unsupported-selector', 'malformed class selector');
      i = next;
      const state = WEBFLOW_STATE_CLASSES[name];
      if (state) {
        if (webflowState) return embed('unsupported-selector', 'two Webflow states');
        webflowState = state;
      } else if (!classes.includes(name)) {
        classes.push(name);
      }
      specificity++;
    } else if (c === ':') {
      const isElement = sel[i + 1] === ':';
      const { name, next } = readIdent(sel, i + (isElement ? 2 : 1));
      i = next;
      let args = '';
      if (sel[i] === '(') {
        const close = matchParen(sel, i);
        args = sel.slice(i, close + 1);
        i = close + 1;
      }
      const lname = name.toLowerCase();
      if (isElement || ['before', 'after', 'first-line', 'first-letter'].includes(lname)) {
        if (lname === 'placeholder' && !pseudo) {
          pseudo = 'placeholder';
          continue;
        }
        return embed('pseudo-element', `pseudo-element ::${lname}`);
      }
      const mapped = args ? undefined : PSEUDO_MAP[lname];
      if (!mapped) return embed('unsupported-pseudo', `pseudo-class :${lname}${args}`);
      if (pseudo) return embed('unsupported-pseudo', 'more than one pseudo-class');
      pseudo = mapped;
      specificity++;
    } else if (c === '#') {
      return embed('id-selector', 'ID selector');
    } else if (c === '[') {
      return embed('unsupported-selector', 'attribute selector');
    } else if (c === '*') {
      return embed('unsupported-selector', 'universal selector *', sel === '*' || sel.startsWith('*:') || sel.startsWith('*::'));
    } else if (c === '&') {
      return embed('unsupported-selector', 'nesting selector &');
    } else if (/[a-zA-Z]/.test(c)) {
      const { name } = readIdent(sel, i);
      return embed('tag-selector', `tag selector "${name.toLowerCase()}"`, GLOBAL_TAGS.has(name.toLowerCase()));
    } else {
      return embed('unsupported-selector', `unsupported token "${c}"`);
    }
  }

  if (classes.length === 0) return embed('unsupported-selector', 'no class in selector');
  return { kind: 'native', classes, webflowState, pseudo, specificity };
}

function embed(code: ConvertWarningCode, reason: string, global = false): EmbedSelector {
  return { kind: 'embed', code, reason, global };
}

/** True if the selector has a top-level descendant/child/sibling combinator. */
function hasCombinator(sel: string): boolean {
  let depth = 0;
  for (let i = 0; i < sel.length; i++) {
    const c = sel[i]!;
    if (c === '\\') {
      i++;
      continue;
    }
    if (c === '(' || c === '[') depth++;
    else if ((c === ')' || c === ']') && depth > 0) depth--;
    else if (depth === 0 && (c === ' ' || c === '>' || c === '+' || c === '~' || c === '\t' || c === '\n')) return true;
  }
  return false;
}

/** Reads a CSS identifier starting at `start`, resolving `\` escapes. */
function readIdent(sel: string, start: number): { name: string; next: number } {
  let name = '';
  let i = start;
  while (i < sel.length) {
    const c = sel[i]!;
    if (c === '\\') {
      const hex = /^[0-9a-fA-F]{1,6} ?/.exec(sel.slice(i + 1, i + 8));
      if (hex) {
        name += String.fromCodePoint(parseInt(hex[0].trim(), 16));
        i += 1 + hex[0].length;
      } else {
        name += sel[i + 1] ?? '';
        i += 2;
      }
    } else if (/[\w-]/.test(c) || c.charCodeAt(0) > 127) {
      name += c;
      i++;
    } else {
      break;
    }
  }
  return { name, next: i };
}

function matchParen(sel: string, open: number): number {
  let depth = 0;
  for (let i = open; i < sel.length; i++) {
    if (sel[i] === '(') depth++;
    else if (sel[i] === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return sel.length - 1;
}

/**
 * True when a class name survives Webflow's slugification unchanged (lowercase letters, digits,
 * `-`, `_`). Webflow derives the published selector by slugifying the name (spec 3.1), so other
 * names are renamed on publish and `<style>`/JS references to them may stop matching.
 */
export function isWebflowSafeClassName(name: string): boolean {
  return /^[a-z_-][a-z0-9_-]*$/.test(name);
}
