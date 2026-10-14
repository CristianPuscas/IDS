/**
 * Webflow Button defaults. A Webflow Button (`Link` with `button: true`, and `FormButton`) is
 * published with the `w-button` class, and webflow.css gives `.w-button`:
 *
 *   display: inline-block; padding: 9px 15px; background-color: #3898EC; color: white; border: 0;
 *   line-height: inherit; text-decoration: none; cursor: pointer; border-radius: 0;
 *
 * Any of these the source CSS did not set leak into the pasted design (a blue box with white text).
 * `buttonNeutralizers` computes, for one source element, the longhands that restore what the
 * *source* rendered for each of those properties:
 *
 * - The property is set by a rule of class specificity or higher (or inline / `!important`): the
 *   user's value already beats `.w-button`, nothing to add.
 * - It is set only by a weaker rule (`a {}`, `button {}`, `* {}`): `.w-button` would win in Webflow,
 *   so that rule's value is copied.
 * - It is not set: the browser default of the source tag is used. An `<a>` gets link defaults
 *   (inline, no padding, transparent, link blue and underlined when it has an `href`); a
 *   `<button>`/`<input>` gets the user-agent button styles (1px 6px padding, #efefef, black text,
 *   2px outset border, `line-height: normal`, `cursor: default`).
 *
 * Only the resting state outside `@media` decides; breakpoint rules keep overriding the result
 * through the normal variant mapping.
 *
 * Ownership: engine.
 */

import { atLeastClass, matchedDeclarations } from './cascade';
import type { CssDeclaration, CssStyleRule } from './cssParser';
import { expandShorthand, wrapRaw, type NativeDecl } from './cssValues';
import { splitTopLevel, splitValueTokens } from './cssParser';

const SIDES = ['top', 'right', 'bottom', 'left'] as const;
const CORNERS = ['top-left', 'top-right', 'bottom-right', 'bottom-left'] as const;

/** `.w-button` from webflow.css, as longhands. */
export const W_BUTTON_DEFAULTS: ReadonlyArray<readonly [string, string]> = [
  ['display', 'inline-block'],
  ...SIDES.map((s) => [`padding-${s}`, s === 'top' || s === 'bottom' ? '9px' : '15px'] as const),
  ['background-color', '#3898ec'],
  ['color', '#ffffff'],
  ...SIDES.flatMap((s) => [
    [`border-${s}-width`, '0px'] as const,
    [`border-${s}-style`, 'none'] as const,
    [`border-${s}-color`, 'currentcolor'] as const,
  ]),
  ['line-height', 'inherit'],
  ['text-decoration', 'none'],
  ['cursor', 'pointer'],
  ...CORNERS.map((c) => [`border-${c}-radius`, '0px'] as const),
];

const INHERITED = new Set(['color', 'line-height', 'cursor']);

/** CSS initial values (used for `unset`/`initial`/`revert` on non-inherited properties). */
function initialValue(prop: string): string {
  if (prop === 'display') return 'inline';
  if (prop === 'background-color') return 'transparent';
  if (prop === 'text-decoration') return 'none';
  if (/-style$/.test(prop)) return 'none';
  if (/^border-.*-color$/.test(prop)) return 'currentcolor';
  return '0px';
}

/** What the browser renders for the source tag when no author CSS sets the property. */
function userAgentValue(prop: string, tag: string, hasHref: boolean): string {
  if (tag === 'a') {
    switch (prop) {
      case 'display':
        return 'inline';
      case 'background-color':
        return 'transparent';
      case 'color':
        return hasHref ? '#0000ee' : 'inherit';
      case 'text-decoration':
        return hasHref ? 'underline' : 'none';
      case 'cursor':
        return hasHref ? 'pointer' : 'auto';
      case 'line-height':
        return 'inherit';
    }
    if (prop.startsWith('padding-')) return '0px';
    return W_BUTTON_DEFAULTS.find(([p]) => p === prop)?.[1] ?? '';
  }
  // <button>, <input type="submit">: the user-agent button styles.
  switch (prop) {
    case 'display':
      return 'inline-block';
    case 'background-color':
      return '#efefef';
    case 'color':
      return '#000000';
    case 'line-height':
      return 'normal';
    case 'cursor':
      return 'default';
    case 'text-decoration':
      return 'none';
  }
  if (prop === 'padding-top' || prop === 'padding-bottom') return '1px';
  if (prop === 'padding-left' || prop === 'padding-right') return '6px';
  if (/^border-(top|right|bottom|left)-width$/.test(prop)) return '2px';
  if (/^border-(top|right|bottom|left)-style$/.test(prop)) return 'outset';
  if (/^border-(top|right|bottom|left)-color$/.test(prop)) return '#767676';
  return '0px';
}

const WIDE = new Set(['inherit', 'initial', 'unset', 'revert', 'revert-layer']);

/**
 * The value `decl` gives `prop`, or `undefined` when it does not touch `prop`, or `null` when it
 * does but the value cannot be worked out (the property then counts as "user-set").
 */
function coveredValue(decl: CssDeclaration, prop: string): string | null | undefined {
  const p = decl.property;
  const v = decl.value.trim();
  if (p === 'all') return resolveKeyword(prop, v.toLowerCase());
  if (p === 'font' && prop === 'line-height') {
    if (WIDE.has(v.toLowerCase())) return resolveKeyword(prop, v.toLowerCase());
    const m = /\/\s*([^\s,]+)/.exec(v);
    return m ? m[1]! : 'normal';
  }
  if (p === 'background' && prop === 'background-color') {
    if (WIDE.has(v.toLowerCase())) return resolveKeyword(prop, v.toLowerCase());
    const layers = splitTopLevel(v, ',');
    const last = splitValueTokens((layers[layers.length - 1] ?? '').trim());
    const color = last.find((t) => /^(#[0-9a-f]{3,8}|(rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color|color-mix)\(|var\()/i.test(t) || /^(transparent|currentcolor|white|black)$/i.test(t));
    return color ?? 'transparent';
  }
  if (p.startsWith('text-decoration') && prop === 'text-decoration') {
    return p === 'text-decoration' || p === 'text-decoration-line' ? v : undefined;
  }
  const expanded = expandShorthand(p, v);
  const hit = expanded.find((d) => d.property === prop);
  if (hit) return resolveKeyword(prop, hit.value.toLowerCase()) ?? hit.value;
  if (!covers(p, prop)) return undefined;
  // A shorthand kept whole (e.g. `padding: var(--x)`) sets the longhand to an unknown value; an
  // expanded one that omits a component (`border: none`) resets it to its initial value.
  return expanded.some((d) => d.property === p) ? null : initialValue(prop);
}

/** Shorthand -> longhand coverage for shorthands kept whole by `expandShorthand`. */
function covers(shorthand: string, prop: string): boolean {
  switch (shorthand) {
    case 'padding':
      return prop.startsWith('padding-');
    case 'border':
      return /^border-(top|right|bottom|left)-(width|style|color)$/.test(prop);
    case 'border-width':
    case 'border-style':
    case 'border-color':
      return prop.startsWith('border-') && prop.endsWith(shorthand.slice('border'.length));
    case 'border-top':
    case 'border-right':
    case 'border-bottom':
    case 'border-left':
      return new RegExp(`^${shorthand}-(width|style|color)$`).test(prop);
    case 'border-radius':
      return /^border-.*-radius$/.test(prop);
    default:
      return false;
  }
}

/** Resolves `unset`/`initial`/`revert`/`inherit` to a concrete value; other values -> null. */
function resolveKeyword(prop: string, value: string): string | null {
  if (value === 'inherit') return 'inherit';
  if (!WIDE.has(value)) return null;
  return INHERITED.has(prop) ? 'inherit' : initialValue(prop);
}

const COLOR_ALIASES: Record<string, string> = { white: '#ffffff', '#fff': '#ffffff', black: '#000000', '#000': '#000000' };

function same(a: string, b: string): boolean {
  const norm = (x: string): string => {
    const l = x.trim().toLowerCase();
    if (/^0(px|rem|em)?$/.test(l)) return '0';
    return COLOR_ALIASES[l] ?? l;
  };
  return norm(a) === norm(b);
}

/**
 * Longhands to add to a converted button's base class so it renders like the source element
 * instead of picking up `.w-button` defaults. Empty when the user's CSS already covers them.
 *
 * @param el Source element (`<a>`, `<button>` or `<input type="submit">`) in the parsed document.
 * @param rules All parsed style rules (after class-name normalization).
 */
export function buttonNeutralizers(el: Element, rules: CssStyleRule[]): NativeDecl[] {
  const tag = el.tagName.toLowerCase();
  const hasHref = tag === 'a' && el.hasAttribute('href');
  const matched = matchedDeclarations(el, rules).filter((m) => m.mediaStack.length === 0);
  const out: NativeDecl[] = [];
  for (const [prop, wValue] of W_BUTTON_DEFAULTS) {
    let winner: { value: string | null; strong: boolean } | null = null;
    for (const m of matched) {
      const value = coveredValue(m.decl, prop);
      if (value === undefined) continue;
      winner = { value, strong: m.inline || m.decl.important || atLeastClass(m.specificity) };
    }
    let value: string;
    if (winner) {
      if (winner.strong || winner.value === null) continue;
      value = winner.value;
    } else {
      value = userAgentValue(prop, tag, hasHref);
    }
    if (!value || same(value, wValue)) continue;
    out.push({ property: prop, value: wrapRaw(value) });
  }
  return out;
}
