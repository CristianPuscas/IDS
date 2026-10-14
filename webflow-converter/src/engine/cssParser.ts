/**
 * CSS parsing. Splits a stylesheet into flat style rules (with their enclosing `@media`) and
 * other at-rules, without interpreting selectors. Selector classification and mapping to
 * Webflow styles happen in styleMapper.ts.
 *
 * Must not depend on the browser CSSOM (it normalises and drops values); a small hand-written
 * tokenizer is expected.
 *
 * Ownership: engine.
 */

import type { ConvertWarning } from './types';

/** One `property: value` declaration. */
export interface CssDeclaration {
  /** Lower-cased property name; custom properties (`--x`) keep their case. */
  property: string;
  /** Value without `!important` and without the trailing `;`. */
  value: string;
  important: boolean;
}

/** A qualified rule (`selector { ... }`), flattened out of any `@media` wrapper. */
export interface CssStyleRule {
  kind: 'style';
  /** Comma-split, trimmed selectors, e.g. `[".a", ".b:hover"]`. */
  selectors: string[];
  declarations: CssDeclaration[];
  /** Media query text of the enclosing `@media` (e.g. `"(max-width: 768px)"`), or `null`. */
  media: string | null;
  /** Original source text of the rule (for embeds). */
  raw: string;
  /** Position in the source, used to keep cascade order when re-emitting. */
  order: number;
}

/** Any at-rule that is not a plain `@media` wrapper: `@keyframes`, `@font-face`, `@supports`, `@import`... */
export interface CssAtRule {
  kind: 'at-rule';
  /** Lower-cased name without `@`, e.g. `"keyframes"`. */
  name: string;
  /** Text between the name and `{` / `;`. */
  prelude: string;
  /** Original source text, emitted verbatim into the `<style>` embed. */
  raw: string;
  order: number;
}

/** Result of `parseCss`. */
export interface ParsedCss {
  rules: CssStyleRule[];
  atRules: CssAtRule[];
  warnings: ConvertWarning[];
}

/**
 * Parses CSS text (comments removed, nested `@media` flattened).
 *
 * @param css Stylesheet text from `<style>` tags and the CSS editor, concatenated.
 */
export function parseCss(css: string): ParsedCss {
  // Stub: the engine agent replaces this with a real tokenizer. Until then the whole stylesheet
  // is passed through as one opaque chunk so it still reaches the `<style>` embed.
  const trimmed = css.trim();
  const atRules: CssAtRule[] = trimmed ? [{ kind: 'at-rule', name: 'unparsed', prelude: '', raw: trimmed, order: 0 }] : [];
  return { rules: [], atRules, warnings: [] };
}

/**
 * Parses a declaration block body (`"color: red; padding: 1rem !important"`), as found in a rule
 * or in an inline `style` attribute.
 */
export function parseDeclarations(block: string): CssDeclaration[] {
  return block
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.includes(':'))
    .map((part) => {
      const idx = part.indexOf(':');
      const rawProp = part.slice(0, idx).trim();
      let value = part.slice(idx + 1).trim();
      const important = /!important\s*$/i.test(value);
      if (important) value = value.replace(/\s*!important\s*$/i, '');
      const property = rawProp.startsWith('--') ? rawProp : rawProp.toLowerCase();
      return { property, value, important };
    });
}
