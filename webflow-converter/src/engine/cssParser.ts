/**
 * CSS parsing. Splits a stylesheet into flat style rules (with their enclosing `@media` chain) and
 * other at-rules, without interpreting selectors. Selector classification and mapping to Webflow
 * styles happen in selectors.ts / styleMapper.ts.
 *
 * This is a small hand-written scanner rather than the browser CSSOM, because the CSSOM normalises
 * values, drops unknown properties and differs between browsers and jsdom. It understands:
 *  - comments (removed), strings (`"…"`, `'…'`, with escapes), `url(…)` and other parentheses
 *  - nested `@media` (flattened; the chain of queries is kept in `mediaStack`)
 *  - block at-rules kept verbatim (`@keyframes`, `@font-face`, `@supports`, `@layer`, `@container`…)
 *  - statement at-rules (`@import`, `@charset`, `@layer a, b;`)
 *  - `!important`
 *  - native CSS nesting (`.a { &:hover {} }`): the whole rule is kept verbatim for the embed
 *
 * Ownership: engine.
 */

import type { ConvertWarning } from './types';

/** One `property: value` declaration. */
export interface CssDeclaration {
  /** Lower-cased property name; custom properties (`--x`) keep their case. */
  property: string;
  /** Value without `!important` and without the trailing `;`. Whitespace collapsed outside strings. */
  value: string;
  important: boolean;
}

/** A qualified rule (`selector { ... }`), flattened out of any `@media` wrapper. */
export interface CssStyleRule {
  kind: 'style';
  /** Comma-split, trimmed selectors, e.g. `[".a", ".b:hover"]`. */
  selectors: string[];
  declarations: CssDeclaration[];
  /** Media query text of the enclosing `@media` chain joined with `" and "`, or `null`. */
  media: string | null;
  /** Every enclosing `@media` prelude, outermost first. `[]` when not inside `@media`. */
  mediaStack: string[];
  /** Declaration block text between the braces (comments removed). */
  body: string;
  /** Original source text of the rule without its `@media` wrappers: `selector { body }`. */
  raw: string;
  /** Position in the source, used to keep cascade order when re-emitting. */
  order: number;
}

/** Any at-rule that is not a plain `@media` wrapper: `@keyframes`, `@font-face`, `@supports`, `@import`... */
export interface CssAtRule {
  kind: 'at-rule';
  /**
   * Lower-cased name without `@`, e.g. `"keyframes"`. Two pseudo names exist:
   * `"nested"` for a style rule that uses CSS nesting, `"unparsed"` for unrecoverable input.
   */
  name: string;
  /** Text between the name and `{` / `;`. */
  prelude: string;
  /** Original source text (without enclosing `@media`), emitted verbatim into the `<style>` embed. */
  raw: string;
  /** Enclosing `@media` preludes, outermost first. */
  mediaStack: string[];
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
 * Never throws: unbalanced braces or stray tokens are skipped and reported as `parse-error`
 * warnings.
 *
 * @param css Stylesheet text from `<style>` tags and the CSS editor, concatenated.
 */
export function parseCss(css: string): ParsedCss {
  const out: ParsedCss = { rules: [], atRules: [], warnings: [] };
  const text = stripComments(css);
  const state = { order: 0 };
  parseBlock(text, 0, text.length, [], out, state);
  return out;
}

/** Recursively parses rules between `start` and `end` (exclusive). */
function parseBlock(
  css: string,
  start: number,
  end: number,
  mediaStack: string[],
  out: ParsedCss,
  state: { order: number },
): void {
  let i = start;
  while (i < end) {
    while (i < end && isWs(css.charCodeAt(i))) i++;
    if (i >= end) break;
    const ch = css[i];

    if (ch === '}' || ch === ';') {
      // Stray terminator (e.g. an extra closing brace). Skip it.
      if (ch === '}') parseWarning(out, 'Unbalanced "}" in CSS was ignored.');
      i++;
      continue;
    }
    if (css.startsWith('<!--', i) || css.startsWith('-->', i)) {
      // CDO/CDC tokens from old-style <style><!-- … --></style>.
      i += css.startsWith('<!--', i) ? 4 : 3;
      continue;
    }

    if (ch === '@') {
      const nameMatch = /^@([-\w]+)/.exec(css.slice(i, Math.min(end, i + 64)));
      const name = (nameMatch?.[1] ?? '').toLowerCase();
      const stop = scanUntil(css, i + 1, end, '{;');
      if (stop >= end || css[stop] === ';') {
        // Statement at-rule: @import, @charset, @layer a, b;, @namespace…
        const raw = css.slice(i, Math.min(stop + 1, end)).trim();
        const prelude = css.slice(i + 1 + name.length, Math.min(stop, end)).trim();
        if (name !== 'charset') {
          out.atRules.push({ kind: 'at-rule', name, prelude, raw, mediaStack, order: state.order++ });
        }
        i = stop + 1;
        continue;
      }
      const prelude = css.slice(i + 1 + name.length, stop).trim();
      let close = findMatchingBrace(css, stop, end);
      if (close < 0) {
        parseWarning(out, `Unclosed "@${name}" block; the rest of the CSS was treated as its body.`);
        close = end;
      }
      if (name === 'media') {
        parseBlock(css, stop + 1, close, [...mediaStack, prelude], out, state);
      } else {
        const raw = css.slice(i, Math.min(close + 1, end)).trim() + (close >= end ? '\n}' : '');
        out.atRules.push({ kind: 'at-rule', name, prelude, raw, mediaStack, order: state.order++ });
      }
      i = close + 1;
      continue;
    }

    // Qualified (style) rule.
    const stop = scanUntil(css, i, end, '{;}');
    if (stop >= end) {
      parseWarning(out, 'Trailing CSS without a "{ … }" block was ignored.', css.slice(i, end).trim().slice(0, 120));
      break;
    }
    if (css[stop] !== '{') {
      parseWarning(out, 'CSS text without a "{ … }" block was ignored.', css.slice(i, stop).trim().slice(0, 120));
      i = stop + 1;
      continue;
    }
    const selectorText = css.slice(i, stop).trim();
    let close = findMatchingBrace(css, stop, end);
    if (close < 0) {
      parseWarning(out, `Unclosed rule "${selectorText.slice(0, 60)}"; the rest of the CSS was treated as its body.`);
      close = end;
    }
    const body = css.slice(stop + 1, close);
    const raw = `${selectorText} {${body}}`;
    if (scanUntil(body, 0, body.length, '{') < body.length) {
      // CSS nesting (`.a { &:hover { … } }`): not flattened, kept verbatim for the embed.
      out.atRules.push({ kind: 'at-rule', name: 'nested', prelude: selectorText, raw, mediaStack, order: state.order++ });
    } else if (selectorText) {
      out.rules.push({
        kind: 'style',
        selectors: splitTopLevel(selectorText, ',').map((s) => s.trim()).filter(Boolean),
        declarations: parseDeclarations(body),
        media: mediaStack.length ? mediaStack.join(' and ') : null,
        mediaStack,
        body,
        raw,
        order: state.order++,
      });
    }
    i = close + 1;
  }
}

function parseWarning(out: ParsedCss, message: string, detail?: string): void {
  out.warnings.push({ code: 'parse-error', severity: 'warning', message, ...(detail ? { detail } : {}) });
}

/**
 * Parses a declaration block body (`"color: red; padding: 1rem !important"`), as found in a rule
 * or in an inline `style` attribute. Semicolons inside strings and parentheses
 * (`url(data:image/svg+xml;utf8,…)`) do not split.
 */
export function parseDeclarations(block: string): CssDeclaration[] {
  const decls: CssDeclaration[] = [];
  for (const part of splitTopLevel(block, ';')) {
    const colon = scanUntil(part, 0, part.length, ':');
    if (colon >= part.length) continue;
    const rawProp = part.slice(0, colon).trim();
    let value = part.slice(colon + 1).trim();
    if (!rawProp || !value) continue;
    const important = /!\s*important\s*$/i.test(value);
    if (important) value = value.replace(/\s*!\s*important\s*$/i, '');
    const property = rawProp.startsWith('--') ? rawProp : rawProp.toLowerCase();
    decls.push({ property, value: property.startsWith('--') ? value : collapseWhitespace(value), important });
  }
  return decls;
}

/** Serialises declarations back to CSS text (`prop: value;` per line), for embeds. */
export function declarationsToCss(decls: CssDeclaration[], indent = '  '): string {
  return decls.map((d) => `${indent}${d.property}: ${d.value}${d.important ? ' !important' : ''};`).join('\n');
}

/**
 * Splits `text` on `sep` at the top level only: not inside strings, `( )` or `[ ]`.
 * Empty pieces are kept (callers filter).
 */
export function splitTopLevel(text: string, sep: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let last = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '\\') {
      i++;
    } else if (c === '"' || c === "'") {
      i = skipString(text, i);
    } else if (c === '(' || c === '[') {
      depth++;
    } else if ((c === ')' || c === ']') && depth > 0) {
      depth--;
    } else if (c === sep && depth === 0) {
      parts.push(text.slice(last, i));
      last = i + 1;
    }
  }
  parts.push(text.slice(last));
  return parts;
}

/** Splits a value on top-level whitespace: `"1px solid rgb(0, 0, 0)"` -> 3 tokens. */
export function splitValueTokens(value: string): string[] {
  const tokens: string[] = [];
  let depth = 0;
  let cur = '';
  for (let i = 0; i < value.length; i++) {
    const c = value[i]!;
    if (c === '"' || c === "'") {
      const j = skipString(value, i);
      cur += value.slice(i, j + 1);
      i = j;
      continue;
    }
    if (c === '(') depth++;
    if (c === ')' && depth > 0) depth--;
    if (depth === 0 && isWs(c.charCodeAt(0))) {
      if (cur) tokens.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  if (cur) tokens.push(cur);
  return tokens;
}

/** Removes `/* … *\/` comments, leaving strings untouched. */
export function stripComments(css: string): string {
  let out = '';
  let i = 0;
  while (i < css.length) {
    const c = css[i];
    if (c === '"' || c === "'") {
      const j = skipString(css, i);
      out += css.slice(i, j + 1);
      i = j + 1;
    } else if (c === '/' && css[i + 1] === '*') {
      const close = css.indexOf('*/', i + 2);
      i = close < 0 ? css.length : close + 2;
      out += ' ';
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

/** Index of the first char in `stops` at paren/bracket depth 0 and outside strings, or `end`. */
function scanUntil(css: string, start: number, end: number, stops: string): number {
  let depth = 0;
  for (let i = start; i < end; i++) {
    const c = css[i]!;
    if (c === '\\') {
      i++;
    } else if (c === '"' || c === "'") {
      i = skipString(css, i);
    } else if (c === '(' || c === '[') {
      depth++;
    } else if ((c === ')' || c === ']') && depth > 0) {
      depth--;
    } else if (depth === 0 && stops.includes(c)) {
      return i;
    }
  }
  return end;
}

/** Given the index of `{`, returns the index of its matching `}` (or -1). */
function findMatchingBrace(css: string, open: number, end: number): number {
  let depth = 0;
  for (let i = open; i < end; i++) {
    const c = css[i];
    if (c === '\\') {
      i++;
    } else if (c === '"' || c === "'") {
      i = skipString(css, i);
    } else if (c === '{') {
      depth++;
    } else if (c === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Given the index of an opening quote, returns the index of the closing quote (or the last index). */
function skipString(text: string, start: number): number {
  const q = text[start];
  for (let i = start + 1; i < text.length; i++) {
    const c = text[i];
    if (c === '\\') i++;
    else if (c === q) return i;
    else if (c === '\n') return i; // unterminated string ends at newline (CSS spec)
  }
  return text.length - 1;
}

/** Collapses runs of whitespace to a single space outside strings, and trims. */
export function collapseWhitespace(value: string): string {
  let out = '';
  for (let i = 0; i < value.length; i++) {
    const c = value[i]!;
    if (c === '"' || c === "'") {
      const j = skipString(value, i);
      out += value.slice(i, j + 1);
      i = j;
    } else if (isWs(c.charCodeAt(0))) {
      if (!out.endsWith(' ')) out += ' ';
    } else {
      out += c;
    }
  }
  return out.trim();
}

function isWs(code: number): boolean {
  return code === 32 || code === 9 || code === 10 || code === 13 || code === 12;
}
