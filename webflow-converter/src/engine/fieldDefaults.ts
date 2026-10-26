/**
 * Webflow form-field defaults. Native form fields are published with Webflow classes, and
 * webflow.css styles them (S2: Webstudio's copy of webflow.css,
 * `apps/builder/app/shared/copy-paste/plugin-webflow/style-presets.css`):
 *
 *   .w-input, .w-select { color: #333; vertical-align: middle; background-color: #fff;
 *     border: 1px solid #ccc; width: 100%; height: 38px; margin-bottom: 10px; padding: 8px 12px;
 *     font-size: 14px; line-height: 1.42857; display: block }
 *   .w-select { background-color: #f3f3f3 }      textarea.w-input { height: auto }
 *   .w-input:focus, .w-select:focus { border-color: #3898ec; outline: 0 }
 *   .w-checkbox, .w-radio { margin-bottom: 5px; padding-left: 20px; display: block }
 *   .w-checkbox-input { float: left; margin: 4px 0 0 -20px }   .w-radio-input { float: left; margin: 3px 0 0 -20px }
 *   button, input, select, textarea { color: inherit; font: inherit; margin: 0 }   (normalize)
 *
 * Any of these the source CSS did not set leak into the pasted design (a 38px-high select cuts its
 * text off; fields grow a grey border and a 10px bottom margin). As for buttons (./buttonDefaults),
 * the field's base class gets longhands that restore what the *source* rendered: the user's value
 * when only a weaker rule (`input {}`) set it, otherwise the browser default.
 *
 * The browser defaults below are Chromium's (`html.css`, form-controls refresh): measured values
 * where known, the rest HEURISTIC (select padding, textarea font). Only the resting state outside
 * `@media` decides; the `:focus` border colour is restored to the resting one unless the source
 * styles `:focus`.
 *
 * Ownership: engine.
 */

import { BUTTON_UA_FONT, coveredValue, defaultTargets, type ButtonTarget } from './buttonDefaults';
import { matchedDeclarations } from './cascade';
import type { CssStyleRule } from './cssParser';
import { wrapRaw } from './cssValues';

/** Native field kinds that get Webflow classes. */
export type FieldKind = 'input' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'checkbox-wrapper' | 'radio-wrapper';

const SIDES = ['top', 'right', 'bottom', 'left'] as const;

/** `.w-input` / `.w-select` from webflow.css, as longhands. */
function wInput(kind: 'input' | 'textarea' | 'select'): [string, string][] {
  return [
    ['color', '#333333'],
    ['vertical-align', 'middle'],
    ['background-color', kind === 'select' ? '#f3f3f3' : '#ffffff'],
    ...SIDES.flatMap((s): [string, string][] => [
      [`border-${s}-width`, '1px'],
      [`border-${s}-style`, 'solid'],
      [`border-${s}-color`, '#cccccc'],
    ]),
    ['width', '100%'],
    ['height', kind === 'textarea' ? 'auto' : '38px'],
    ['margin-bottom', '10px'],
    ['padding-top', '8px'],
    ['padding-right', '12px'],
    ['padding-bottom', '8px'],
    ['padding-left', '12px'],
    ['font-size', '14px'],
    ['line-height', '1.42857'],
    ['display', 'block'],
  ];
}

/** Chromium defaults of `<input>` (text-like), `<textarea>` and `<select>`. */
function uaField(kind: 'input' | 'textarea' | 'select', prop: string): string {
  switch (prop) {
    case 'color':
      return '#000000';
    case 'vertical-align':
      return 'baseline';
    case 'background-color':
      return '#ffffff';
    case 'width':
    case 'height':
      return 'auto';
    case 'margin-bottom':
      return '0px';
    case 'font-size':
      return '13.3333px';
    case 'line-height':
      return 'normal';
    case 'display':
      return 'inline-block';
  }
  if (/^border-.*-width$/.test(prop)) return kind === 'input' ? '2px' : '1px';
  if (/^border-.*-style$/.test(prop)) return kind === 'input' ? 'inset' : 'solid';
  if (/^border-.*-color$/.test(prop)) return '#767676';
  if (prop.startsWith('padding-')) {
    if (kind === 'textarea') return '2px';
    if (kind === 'select') return '0px'; // HEURISTIC
    return prop === 'padding-top' || prop === 'padding-bottom' ? '1px' : '2px';
  }
  return '';
}

/** Checkbox/radio inputs: `.w-checkbox-input` / `.w-radio-input`, and their Chromium margins. */
function wChoice(kind: 'checkbox' | 'radio'): [string, string][] {
  return [
    ['float', 'left'],
    ['margin-top', kind === 'checkbox' ? '4px' : '3px'],
    ['margin-right', '0px'],
    ['margin-bottom', '0px'],
    ['margin-left', '-20px'],
  ];
}
function uaChoice(kind: 'checkbox' | 'radio', prop: string): string {
  if (prop === 'float') return 'none';
  const m = kind === 'checkbox' ? { top: '3px', right: '3px', bottom: '3px', left: '4px' } : { top: '3px', right: '3px', bottom: '0px', left: '5px' };
  const side = /^margin-(top|right|bottom|left)$/.exec(prop)?.[1] as keyof typeof m | undefined;
  return side ? m[side] : '';
}

/** `.w-checkbox` / `.w-radio` wrappers (a `<label>`): the source label was inline, unpadded. */
const W_CHOICE_WRAPPER: [string, string][] = [
  ['margin-bottom', '5px'],
  ['padding-left', '20px'],
  ['display', 'block'],
];
function uaWrapper(prop: string): string {
  return prop === 'display' ? 'inline' : '0px';
}

/** normalize's `font: inherit` on fields, as `[property, browser default, Webflow value]`. */
const FIELD_FONT: (readonly [string, string, string])[] = BUTTON_UA_FONT.filter(([p]) => p === 'font-family' || p === 'font-weight' || p === 'font-style').map(
  ([p, v]) => [p, v, 'inherit'] as const,
);

/**
 * Per-property targets for one native field (see `defaultTargets`): what its class must declare so
 * it renders like the source instead of picking up webflow.css defaults. Text fields also get
 * `:focus` targets (`state: 'focus'`) that keep the resting border colour.
 *
 * @param el Source `<input>`, `<textarea>`, `<select>` or checkbox/radio `<label>` wrapper.
 * @param rules All parsed style rules (after class-name normalization).
 */
export function fieldTargets(el: Element, rules: CssStyleRule[], kind: FieldKind): ButtonTarget[] {
  switch (kind) {
    case 'input':
    case 'textarea':
    case 'select': {
      const font = kind === 'textarea' ? FIELD_FONT.map(([p, v, n]) => [p, p === 'font-family' ? 'monospace' : v, n] as const) : FIELD_FONT;
      return [...defaultTargets(el, rules, { webflow: wInput(kind), ua: (p) => uaField(kind, p), weak: font }), ...focusTargets(el, rules)];
    }
    case 'checkbox':
    case 'radio':
      return defaultTargets(el, rules, { webflow: wChoice(kind), ua: (p) => uaChoice(kind, p) });
    default:
      return defaultTargets(el, rules, { webflow: W_CHOICE_WRAPPER, ua: uaWrapper });
  }
}

/**
 * webflow.css turns a field's border blue on focus (`.w-input:focus { border-color: #3898ec }`, a
 * (0,2,0) selector that beats the field's own class). Unless the source styles the field's
 * `:focus` border itself, the `:focus` state keeps the resting colour (source value or browser
 * default). Sides whose resting colour cannot be worked out (a `var()` shorthand) are skipped.
 */
function focusTargets(el: Element, rules: CssStyleRule[]): ButtonTarget[] {
  const focusRule = rules.some(
    (r) =>
      r.mediaStack.length === 0 &&
      r.declarations.some((d) => d.property.startsWith('border') || d.property === 'all') &&
      r.selectors.some((s) => /:focus/.test(s) && safeMatches(el, s.replace(/:focus(-visible|-within)?/g, ''))),
  );
  if (focusRule) return [];
  const matched = matchedDeclarations(el, rules).filter((m) => m.mediaStack.length === 0);
  const out: ButtonTarget[] = [];
  for (const side of SIDES) {
    const prop = `border-${side}-color`;
    let value: string | null = '#767676';
    for (const m of matched) {
      const v = coveredValue(m.decl, prop);
      if (v !== undefined) value = v;
    }
    if (value === null || /^(inherit|initial|unset|revert)/i.test(value)) continue;
    out.push({ property: prop, value: wrapRaw(value), natural: '#3898ec', state: 'focus' });
  }
  return out;
}

function safeMatches(el: Element, selector: string): boolean {
  try {
    return el.matches(selector.trim() || '*');
  } catch {
    return false;
  }
}
