/**
 * Class-name normalization (spec 3.1).
 *
 * Webflow publishes a class under a selector derived from its name. The rule, verbatim from
 * Webflow's own Designer bundle (S1, `toClassName` / `toClassNameNoConflictChecks`):
 *
 *   name.toLowerCase()
 *       .replace(/[^0-9a-z_-]/g, " ")      // every other character becomes a space
 *       .replace(/^[ _-]+|[ _-]+$/g, "")   // trim spaces, "_" and "-" at both ends
 *       .replace(/\s+/g, "-")              // runs of spaces become one "-"
 *   then .replace(/(^[\d]|^wf?-)/, "_$1")  // a leading digit, "w-" or "wf-" gets a "_" prefix
 *
 * So `heroTitle` publishes as `.herotitle` and `md:flex` as `.md-flex`. CSS and JS in Code Embeds
 * keep referring to the original name and stop matching. The converter therefore renames such
 * classes to their published form up front (HTML class attributes, `<style>` selectors, CSS editor),
 * so name and selector agree everywhere. JavaScript is never rewritten: the caller gets the list of
 * renames and the string literals that still mention an old name, to report as a warning.
 *
 * Ownership: engine.
 */

/** Webflow's selector form of a class name (S1 `toClassName`). Empty input yields `""`. */
export function toWebflowClassName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^0-9a-z_-]/g, ' ')
    .replace(/^[ _-]+|[ _-]+$/g, '')
    .replace(/\s+/g, '-');
  return slug.replace(/(^[\d]|^wf?-)/, '_$1');
}

/** True when Webflow publishes the class under exactly this name. */
export function isWebflowClassName(name: string): boolean {
  return name !== '' && toWebflowClassName(name) === name;
}

/**
 * Plans renames for class names used in the HTML. Names that already are in Webflow form keep
 * their name. Every other name gets its Webflow form; when that form is already taken (by a
 * class that is already in Webflow form, by a CSS-only class, or by an earlier rename) a numeric
 * suffix is added (`herotitle-2`), so two source classes never merge into one.
 *
 * @param htmlClasses Class names used on elements, in document order.
 * @param otherNames Other names that must not be reused (class names found only in CSS).
 * @returns `old -> new` for renamed classes only, in document order.
 */
export function planClassRenames(htmlClasses: Iterable<string>, otherNames: Iterable<string> = []): Map<string, string> {
  const ordered = [...new Set(htmlClasses)];
  const taken = new Set<string>();
  for (const n of ordered) if (isWebflowClassName(n)) taken.add(n);
  for (const n of otherNames) if (isWebflowClassName(n)) taken.add(n);

  const renames = new Map<string, string>();
  for (const name of ordered) {
    // Webflow's own state classes (`w--current`, `w--open`) are handled as states, never renamed.
    if (isWebflowClassName(name) || name.startsWith('w--')) continue;
    const base = toWebflowClassName(name) || 'class';
    let candidate = base;
    for (let i = 2; taken.has(candidate); i++) candidate = `${base}-${i}`;
    taken.add(candidate);
    renames.set(name, candidate);
  }
  return renames;
}

/**
 * Rewrites class selectors in a stylesheet. Only selector preludes (the text before a `{` that
 * is not an at-rule) are touched, so values such as `url(img/a.Hero.png)` are left alone. Handles
 * escapes (`.md\:flex`), strings, comments, attribute selectors and functional pseudo-classes
 * (`:not(.heroTitle)`).
 *
 * @param css Stylesheet text.
 * @param renames `old -> new` class names (unescaped).
 */
export function rewriteCssClasses(css: string, renames: Map<string, string>): string {
  if (renames.size === 0 || !css) return css;
  return mapCssClasses(css, (name) => renames.get(name));
}

/** Walks selector preludes and replaces each `.class` for which `fn` returns a new name. */
function mapCssClasses(css: string, fn: (name: string) => string | undefined): string {
  let out = '';
  let segStart = 0;
  let i = 0;
  const n = css.length;
  while (i < n) {
    const c = css[i]!;
    if (c === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      i = end < 0 ? n : end + 2;
      continue;
    }
    if (c === '"' || c === "'") {
      i = skipString(css, i) + 1;
      continue;
    }
    if (c === '\\') {
      i += 2;
      continue;
    }
    if (c === ';' || c === '}') {
      out += css.slice(segStart, i + 1);
      segStart = i + 1;
      i++;
      continue;
    }
    if (c === '{') {
      const seg = css.slice(segStart, i);
      out += seg.trimStart().startsWith('@') ? seg : mapSelector(seg, fn);
      out += '{';
      segStart = i + 1;
      i++;
      continue;
    }
    i++;
  }
  return out + css.slice(segStart);
}

/** Rewrites `.class` tokens of one selector list (comments and strings kept verbatim). */
export function rewriteSelector(sel: string, renames: Map<string, string>): string {
  return mapSelector(sel, (name) => renames.get(name));
}

function mapSelector(sel: string, fn: (name: string) => string | undefined): string {
  let out = '';
  let i = 0;
  let bracket = 0;
  while (i < sel.length) {
    const c = sel[i]!;
    if (c === '/' && sel[i + 1] === '*') {
      const end = sel.indexOf('*/', i + 2);
      const stop = end < 0 ? sel.length : end + 2;
      out += sel.slice(i, stop);
      i = stop;
      continue;
    }
    if (c === '"' || c === "'") {
      const stop = skipString(sel, i) + 1;
      out += sel.slice(i, stop);
      i = stop;
      continue;
    }
    if (c === '\\') {
      out += sel.slice(i, i + 2);
      i += 2;
      continue;
    }
    if (c === '[') bracket++;
    else if (c === ']' && bracket > 0) bracket--;
    if (c === '.' && bracket === 0) {
      const { name, next } = readIdent(sel, i + 1);
      const renamed = name ? fn(name) : undefined;
      if (renamed !== undefined) {
        out += `.${renamed}`;
        i = next;
        continue;
      }
    }
    out += c;
    i++;
  }
  return out;
}

/**
 * Class names that scripts add, remove or toggle at runtime: string literals passed to
 * `classList.add/remove/toggle/replace`, jQuery `addClass/removeClass/toggleClass`, or assigned to
 * `className`. Also any literal that is just one `is-*` / `w--*` modifier (`var OPEN = 'is-open'`).
 * Such a class appears on the element only as a real class, never in its `data-h2w-class`
 * attribute, so embed CSS must still match it as `.name` (./embedCss). A simple scan, by design.
 */
export function scriptToggledClasses(scripts: readonly string[]): Set<string> {
  const out = new Set<string>();
  const literal = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\$]|\\.)*)`/g;
  const addTokens = (text: string) => {
    for (const t of text.split(/[^\w-]+/)) if (/^-?[a-zA-Z_][\w-]*$/.test(t)) out.add(t);
  };
  const call = /\.(?:classList\s*\.\s*(?:add|remove|toggle|replace)|addClass|removeClass|toggleClass)\s*\(|\.className\s*\+?=/g;
  for (const code of scripts) {
    for (const m of code.matchAll(call)) {
      // The arguments: literals up to the closing parenthesis / end of statement.
      const rest = code.slice(m.index! + m[0].length, m.index! + m[0].length + 300);
      const end = m[0].endsWith('(') ? closingParen(rest) : rest.search(/[;\n]/);
      const args = end >= 0 ? rest.slice(0, end) : rest;
      for (const l of args.matchAll(literal)) addTokens(l[1] ?? l[2] ?? l[3] ?? '');
    }
    for (const l of code.matchAll(literal)) {
      const text = (l[1] ?? l[2] ?? l[3] ?? '').trim();
      if (/^(?:is-|w--)[\w-]+$/.test(text)) out.add(text);
    }
  }
  return out;
}

/** Index of the `)` that closes a call whose `(` was just before `text` (strings skipped), or -1. */
function closingParen(text: string): number {
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '\\') i++;
    else if (c === '"' || c === "'" || c === '`') {
      for (i++; i < text.length && text[i] !== c; i++) if (text[i] === '\\') i++;
    } else if (c === '(') depth++;
    else if (c === ')') {
      if (depth === 0) return i;
      depth--;
    }
  }
  return -1;
}

/** A JS string literal that still mentions a renamed class. */
export interface JsClassReference {
  oldName: string;
  newName: string;
  /** The literal as written, shortened to 80 characters. */
  literal: string;
}

/**
 * Finds string literals (`'…'`, `"…"`, `` `…` ``) in scripts that mention an old class name as a
 * whole token (not part of a longer name). A simple search, by design: scripts are never rewritten,
 * this only feeds a warning.
 */
export function findJsClassReferences(scripts: string[], renames: Map<string, string>): JsClassReference[] {
  const out: JsClassReference[] = [];
  const seen = new Set<string>();
  if (renames.size === 0) return out;
  const literal = /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g;
  for (const code of scripts) {
    for (const m of code.matchAll(literal)) {
      const text = m[0];
      for (const [oldName, newName] of renames) {
        const re = new RegExp(`(^|[^\\w-])${escapeRegExp(oldName)}(?![\\w-])`);
        if (!re.test(text.slice(1, -1))) continue;
        const key = `${oldName}\u0001${text}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ oldName, newName, literal: text.length > 80 ? `${text.slice(0, 77)}…` : text });
      }
    }
  }
  return out;
}

/**
 * Applies renames to every `class` attribute in a document, and to `<style>` elements that stayed
 * in it (inside inline SVG).
 */
export function renameClassesInDocument(doc: Document, renames: Map<string, string>): void {
  if (renames.size === 0) return;
  doc.querySelectorAll('[class]').forEach((el) => {
    const raw = el.getAttribute('class') ?? '';
    const next = raw
      .split(/\s+/)
      .filter(Boolean)
      .map((c) => renames.get(c) ?? c)
      .join(' ');
    if (next !== raw.trim()) el.setAttribute('class', next);
  });
  doc.querySelectorAll('style').forEach((el) => {
    const css = el.textContent ?? '';
    const next = rewriteCssClasses(css, renames);
    if (next !== css) el.textContent = next;
  });
}

/** Class names referenced by `.class` selectors in a stylesheet (unescaped). */
export function cssClassNames(css: string): Set<string> {
  const names = new Set<string>();
  mapCssClasses(css, (name) => {
    names.add(name);
    return undefined;
  });
  return names;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Index of the closing quote of the string starting at `start` (or the last index). */
function skipString(text: string, start: number): number {
  const q = text[start];
  for (let i = start + 1; i < text.length; i++) {
    const c = text[i];
    if (c === '\\') i++;
    else if (c === q) return i;
    else if (c === '\n') return i;
  }
  return text.length - 1;
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
