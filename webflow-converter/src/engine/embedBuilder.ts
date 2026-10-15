/**
 * HtmlEmbed (Code Embed) builders (spec 2.4 HtmlEmbed). Used for leftover CSS (`<style>`),
 * scripts (`<script>`), head links and elements kept as raw code (e.g. `<svg>`, `<canvas>`).
 *
 * Embeds over `maxChars` are split into several embeds (spec 5):
 * - CSS is split between rules (a rule is never cut), at `maxEmbedChars` (10k).
 * - Scripts use `maxScriptEmbedChars` (50k, the Designer's Code Embed limit). Classic inline
 *   scripts are split between top-level statements into several `<script>` tags. Classic scripts
 *   share one global scope, so top-level `const`/`function` declarations stay visible across tags.
 *   Modules, import maps and single giant statements (e.g. one IIFE) cannot be split; they are
 *   minified (./jsMinify), and when that is not enough the script is returned as an external file
 *   to host, with a placeholder comment embed and an `embed-too-large` warning.
 *
 * Ownership: engine.
 */

import { uuid } from './ids';
import type { JsBundle, ScriptEntry } from './jsExtractor';
import { minifyScript } from './jsMinify';
import type { ConvertWarning, ExternalScript, JsMinifier, WfElementNode } from './types';

/** Embed nodes plus any warnings produced while splitting. */
export interface EmbedBuildResult {
  nodes: WfElementNode[];
  warnings: ConvertWarning[];
}

/**
 * Builds one HtmlEmbed node. `v` and `data.embed.meta.html` hold the same string; `script` and
 * `iframe` flags are sniffed from the code.
 *
 * @param code Raw HTML for the embed (e.g. `"<style>...</style>"`, `"<svg>...</svg>"`).
 * @param classes Optional style ids (embeds are normally classless).
 */
export function buildEmbedNode(code: string, classes: string[] = []): WfElementNode {
  return {
    _id: uuid(),
    type: 'HtmlEmbed',
    tag: 'div',
    classes,
    children: [],
    v: code,
    data: {
      insideRTE: false,
      embed: {
        type: 'html',
        meta: {
          html: code,
          div: false,
          iframe: /<iframe[\s>]/i.test(code),
          script: /<script[\s>]/i.test(code),
          compilable: false,
        },
      },
    },
  };
}

const STYLE_OPEN = '<style>\n';
const STYLE_CLOSE = '\n</style>';

/**
 * Wraps leftover CSS in `<style>` embeds, splitting between chunks so no embed exceeds `maxChars`.
 *
 * @param cssChunks Rule/at-rule source texts in cascade order (each chunk is never split).
 * @param maxChars Max characters per embed, including the `<style>` tags.
 */
export function buildStyleEmbeds(cssChunks: string[], maxChars: number): EmbedBuildResult {
  const warnings: ConvertWarning[] = [];
  const safe = cssChunks.map((c) => c.replace(/<\/style/gi, '<\\/style'));
  const codes = packChunks(safe, maxChars, STYLE_OPEN, STYLE_CLOSE, '\n');
  for (const code of codes) {
    if (code.length > maxChars) {
      warnings.push({
        code: 'embed-too-large',
        severity: 'warning',
        message: `A single CSS rule produces a ${code.length}-character embed, over the ${maxChars}-character limit.`,
        detail: code.slice(STYLE_OPEN.length, STYLE_OPEN.length + 120),
      });
    }
  }
  if (codes.length > 1) {
    warnings.push({
      code: 'embed-split',
      severity: 'info',
      message: `Unsupported CSS was split across ${codes.length} Code Embeds to stay under ${maxChars} characters each.`,
    });
  }
  return { nodes: codes.map((c) => buildEmbedNode(c)), warnings };
}

/** Options for `buildScriptEmbeds`. */
export interface ScriptEmbedOptions {
  /** Minify scripts that cannot be split under the cap (default `true`). */
  minify?: boolean;
  /** Injected minifier (terser), tried before the built-in stripper. */
  minifier?: JsMinifier | null;
}

/** `buildScriptEmbeds` output: embeds, warnings, and scripts that must be hosted as files. */
export interface ScriptEmbedResult extends EmbedBuildResult {
  /** Scripts too large for an embed even after minifying (each left a placeholder comment embed). */
  external: ExternalScript[];
  /** A script needed minifying and no injected minifier was available (`convertAsync` retries with terser). */
  wantsMinifier: boolean;
}

/**
 * Turns a script bundle into `<script>` embeds, in bundle order: tags are packed into as few
 * embeds as fit under `maxChars`, and oversized classic scripts are split between statements.
 * A statement that is still too large (one big IIFE), or an oversized module, is minified
 * (./jsMinify: the injected minifier, then the comment/whitespace stripper; output must parse).
 * A script that still does not fit is left out: it is returned in `external` (to host as a file)
 * and a placeholder comment embed takes its place.
 *
 * @param bundle Output of `extractJs`.
 * @param maxChars Max characters per script embed (`maxScriptEmbedChars`, 50000 by default).
 */
export function buildScriptEmbeds(bundle: JsBundle, maxChars: number, options: ScriptEmbedOptions = {}): ScriptEmbedResult {
  const warnings: ConvertWarning[] = [];
  const tags: string[] = [];
  const external: ExternalScript[] = [];
  const minify = options.minify !== false;
  const minifier = options.minifier ?? null;
  let wantsMinifier = false;
  let splitScripts = 0;

  for (const s of bundle.scripts) {
    const open = `<script${renderAttrs(s)}>`;
    const close = '</script>';
    if (s.src) {
      tags.push(`<script src="${escapeAttr(s.src)}"${renderAttrs(s)}></script>`);
      continue;
    }
    const code = escapeScript(s.code).trim();
    const wrap = (p: string): string => `${open}\n${p}\n${close}`;
    const fits = (p: string): boolean => wrap(p).length <= maxChars;
    if (fits(code)) {
      tags.push(wrap(code));
      continue;
    }
    const budget = maxChars - open.length - close.length - 2;
    const splittable = isSplittable(s);
    const module = scriptType(s) === 'module';
    let pieces = splittable ? splitJsStatements(code, budget) : [code];

    if (!pieces.every(fits)) {
      if (!minifier) wantsMinifier = true;
      if (minify) {
        let method = '';
        // Minify only the statements that are too large; they are complete top-level statements.
        const piecewise = splittable
          ? pieces.map((p) => {
              if (fits(p)) return p;
              const m = minifyScript(p, module, minifier);
              if (m) method = m.method;
              return m ? escapeScript(m.code) : p;
            })
          : pieces;
        if (splittable && piecewise.every(fits)) {
          pieces = piecewise;
        } else {
          // Minify the script as a whole, then split again if needed.
          const m = minifyScript(code, module, minifier);
          if (m) {
            method = m.method;
            const min = escapeScript(m.code).trim();
            const again = splittable ? splitJsStatements(min, budget) : [min];
            if (again.every(fits)) pieces = again;
          }
        }
        if (pieces.every(fits)) {
          const after = pieces.reduce((n, p) => n + p.length, 0);
          warnings.push({
            code: 'script-extracted',
            severity: 'info',
            message: `A script of ${code.length.toLocaleString('en-US')} characters is over the ${maxChars.toLocaleString('en-US')}-character Code Embed limit, so it was minified (${
              method === 'minifier' ? 'terser' : 'comments and whitespace removed'
            }) to ${after.toLocaleString('en-US')} characters.`,
            detail: code.slice(0, 120),
          });
        }
      }
    }

    if (!pieces.every(fits)) {
      const name = external.length === 0 ? 'script.js' : `script-${external.length + 1}.js`;
      const type = scriptType(s);
      external.push({ name, code: s.code.trim(), type });
      tags.push(placeholder(name, s.code.trim().length, type));
      warnings.push({
        code: 'embed-too-large',
        severity: 'warning',
        message: `A script of ${s.code.trim().length.toLocaleString('en-US')} characters is too large for a Webflow Code Embed (limit ${maxChars.toLocaleString('en-US')}) even after minifying, so it was left out. Download ${name}, host it (e.g. GitHub + jsDelivr) and add <script${
          type ? ` type="${type}"` : ''
        } src="…/${name}"></script> in Page Settings → Before </body>.`,
        detail: s.code.trim().slice(0, 120),
      });
      continue;
    }
    if (pieces.length > 1) splitScripts++;
    for (const p of pieces) tags.push(wrap(p));
  }

  const codes = packChunks(tags, maxChars, '', '', '\n');
  if (splitScripts > 0) {
    warnings.push({
      code: 'embed-split',
      severity: 'info',
      message: `${splitScripts} large script${splitScripts > 1 ? 's were' : ' was'} split between top-level statements across several <script> tags.`,
    });
  }
  return { nodes: codes.map((c) => buildEmbedNode(c)), warnings, external, wantsMinifier };
}

/** Escapes `</script` so inline code cannot close its tag early. */
function escapeScript(code: string): string {
  return code.replace(/<\/script/gi, '<\\/script');
}

/** The comment embed left where an external script was. */
function placeholder(name: string, chars: number, type: string): string {
  // No literal "<script" here: the embed must not be flagged as a script.
  return `<!-- h2w: ${name} (${chars} characters${type ? `, type ${type}` : ''}) was too large for a Code Embed. Host the file and load it with a script src tag in Page Settings, Before body end. -->`;
}

function scriptType(s: ScriptEntry): string {
  return (s.attributes.find((a) => a.name.toLowerCase() === 'type')?.value ?? '').trim().toLowerCase();
}

/** Only classic JavaScript can be split into several tags without changing scope. */
function isSplittable(s: ScriptEntry): boolean {
  const type = scriptType(s);
  return type === '' || type === 'text/javascript' || type === 'application/javascript';
}

function renderAttrs(s: ScriptEntry): string {
  return s.attributes.map((a) => (a.value === '' ? ` ${a.name}` : ` ${a.name}="${escapeAttr(a.value)}"`)).join('');
}

function escapeAttr(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

/**
 * Greedily packs chunks into strings of at most `maxChars` (a single oversized chunk stays whole).
 */
export function packChunks(chunks: string[], maxChars: number, open: string, close: string, sep: string): string[] {
  const out: string[] = [];
  let current: string[] = [];
  let size = open.length + close.length;
  for (const chunk of chunks) {
    const add = chunk.length + (current.length > 0 ? sep.length : 0);
    if (current.length > 0 && size + add > maxChars) {
      out.push(open + current.join(sep) + close);
      current = [];
      size = open.length + close.length;
    }
    size += chunk.length + (current.length > 0 ? sep.length : 0);
    current.push(chunk);
  }
  if (current.length > 0) out.push(open + current.join(sep) + close);
  return out;
}

const REGEX_PRECEDERS = new Set('(,=:[!&|?{};+-*%<>~^'.split(''));
const REGEX_KEYWORDS = new Set(['return', 'typeof', 'case', 'do', 'else', 'in', 'of', 'new', 'delete', 'void', 'throw', 'instanceof', 'yield', 'await']);
/** Tokens that continue the previous statement; never split before them. */
const CONTINUATION = /^(else\b|catch\b|finally\b|while\b|[.,)\]}?:+\-*/%&|^=<>]|\(|\[|`)/;

/**
 * Splits JavaScript into top-level statements (outside braces, parens, strings, template
 * literals, comments and regex literals) and greedily packs them into pieces of at most
 * `maxChars`. A split point is a newline at depth 0 after `;` or `}` that is not followed by a
 * continuation token (`else`, `.then`, `)`…). Returns `[code]` when no split point exists.
 */
export function splitJsStatements(code: string, maxChars: number): string[] {
  const boundaries: number[] = [];
  let depth = 0;
  let lastSig = ''; // last significant (non-space, non-comment) character
  let lastWord = '';
  const templateStack: number[] = []; // brace depth at which each `${` opened
  let i = 0;
  const n = code.length;

  const skipString = (q: string): void => {
    i++;
    while (i < n && code[i] !== q) {
      if (code[i] === '\\') i++;
      else if (code[i] === '\n') break;
      i++;
    }
    i++;
  };
  // Scans a template literal from just after a backtick (or a closing `}` of `${…}`).
  const scanTemplate = (): void => {
    while (i < n) {
      const c = code[i];
      if (c === '\\') i += 2;
      else if (c === '`') {
        i++;
        return;
      } else if (c === '$' && code[i + 1] === '{') {
        templateStack.push(depth);
        depth++;
        i += 2;
        return;
      } else i++;
    }
  };

  while (i < n) {
    const c = code[i]!;
    if (c === '/' && code[i + 1] === '/') {
      while (i < n && code[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && code[i + 1] === '*') {
      const end = code.indexOf('*/', i + 2);
      i = end < 0 ? n : end + 2;
      continue;
    }
    if (c === '"' || c === "'") {
      skipString(c);
      lastSig = c;
      lastWord = '';
      continue;
    }
    if (c === '`') {
      i++;
      scanTemplate();
      lastSig = '`';
      lastWord = '';
      continue;
    }
    if (c === '/' && (lastSig === '' || REGEX_PRECEDERS.has(lastSig) || REGEX_KEYWORDS.has(lastWord))) {
      // Regex literal.
      i++;
      let inClass = false;
      while (i < n && code[i] !== '\n') {
        const r = code[i];
        if (r === '\\') i++;
        else if (r === '[') inClass = true;
        else if (r === ']') inClass = false;
        else if (r === '/' && !inClass) break;
        i++;
      }
      i++;
      while (i < n && /[a-z]/i.test(code[i]!)) i++;
      lastSig = '/';
      lastWord = '';
      continue;
    }
    if (c === '{' || c === '(' || c === '[') depth++;
    else if (c === '}' || c === ')' || c === ']') {
      depth = Math.max(0, depth - 1);
      if (c === '}' && templateStack.length && templateStack[templateStack.length - 1] === depth) {
        templateStack.pop();
        i++;
        scanTemplate();
        lastSig = '`';
        continue;
      }
    }
    if (c === '\n' && depth === 0 && (lastSig === ';' || lastSig === '}')) {
      const rest = code.slice(i + 1, i + 200).replace(/^(\s|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*/, '');
      if (!CONTINUATION.test(rest)) boundaries.push(i + 1);
    }
    if (/[A-Za-z_$]/.test(c)) {
      let j = i;
      while (j < n && /[\w$]/.test(code[j]!)) j++;
      lastWord = code.slice(i, j);
      lastSig = code[j - 1]!;
      i = j;
      continue;
    }
    if (!/\s/.test(c)) {
      lastSig = c;
      lastWord = '';
    }
    i++;
  }

  if (boundaries.length === 0) return [code];
  const statements: string[] = [];
  let prev = 0;
  for (const b of boundaries) {
    statements.push(code.slice(prev, b));
    prev = b;
  }
  statements.push(code.slice(prev));
  return packChunks(statements.filter((s) => s.trim()), maxChars, '', '', '').map((s) => s.trim());
}
