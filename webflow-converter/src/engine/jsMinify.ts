/**
 * Minification of scripts that are too large for one Code Embed (`maxScriptEmbedChars`).
 *
 * Two minifiers, tried in order by `minifyScript`:
 * 1. An injected synchronous minifier (`ConvertOptions.jsMinifier`). `loadTerserMinifier()` loads
 *    terser with a dynamic `import()` (its own chunk, so the main bundle stays small) and wraps
 *    `minify_sync`; `convertAsync` in ./index uses it.
 * 2. `stripJs`, a conservative comment and whitespace stripper. It never renames, reorders or
 *    rewrites anything: it only drops comments (except a leading `/*!`/`@license` one) and
 *    whitespace, and keeps a line break wherever automatic semicolon insertion could depend on it.
 *    It knows strings, template literals (with nested `${}`), regular-expression literals and
 *    comments, so their contents are copied verbatim.
 *
 * Output is only used when it parses: for classic scripts both the input and the output must pass
 * a `new Function(code)` parse check. Module scripts cannot be checked that way, so only an
 * injected minifier (which parses them itself) is used for them.
 *
 * Ownership: engine.
 */

import type { JsMinifier } from './types';

/** Which minifier produced the code. */
export type MinifyMethod = 'minifier' | 'strip';

/** True when `new Function` can be used at all (it throws under a strict CSP). */
function canParse(): boolean {
  try {
    new Function('');
    return true;
  } catch {
    return false;
  }
}

/** True when `code` parses as a classic script (function body). `false` when it cannot be checked. */
export function parsesAsScript(code: string): boolean {
  try {
    // Only parsed, never called.
    new Function(code);
    return true;
  } catch {
    return false;
  }
}

/**
 * Minifies `code`, returning `null` when no verified smaller result exists.
 *
 * @param code Script source.
 * @param module `true` for `type="module"` scripts (no `new Function` check possible).
 * @param minifier Optional injected minifier (terser), tried first.
 */
export function minifyScript(code: string, module: boolean, minifier: JsMinifier | null): { code: string; method: MinifyMethod } | null {
  const verifiable = !module && canParse();
  const originalParses = verifiable && parsesAsScript(code);
  if (minifier) {
    try {
      const out = minifier(code, { module });
      if (typeof out === 'string' && out.trim() && out.length < code.length && (module || !originalParses || parsesAsScript(out))) {
        return { code: out, method: 'minifier' };
      }
    } catch {
      // Fall through to the stripper.
    }
  }
  if (!originalParses) return null;
  const stripped = stripJs(code);
  if (stripped.length >= code.length || !parsesAsScript(stripped)) return null;
  return { code: stripped, method: 'strip' };
}

/** Keywords after which `/` starts a regular expression. */
const REGEX_KEYWORDS = new Set(['return', 'typeof', 'case', 'do', 'else', 'in', 'of', 'new', 'delete', 'void', 'throw', 'instanceof', 'yield', 'await']);
/** Keywords whose parenthesised head is followed by a statement (`if (x) /re/.test(y)`). */
const CONTROL_KEYWORDS = new Set(['if', 'while', 'for', 'with']);
/** Punctuators after which `/` starts a regular expression. */
const REGEX_AFTER = new Set('(,=:[!&|?{};+-*%<>~^}'.split(''));
/** Characters that can join a neighbour into a different token when the space between is dropped. */
const JOINING = new Set('+-*/%<>=!&|^?.:'.split(''));
const NEWLINE = /[\n\r\u2028\u2029]/;

/** Word-like character: identifiers, numbers, escapes, private names. */
function isWordChar(c: string | undefined): boolean {
  return c !== undefined && (/[\w$\\#]/.test(c) || c.charCodeAt(0) > 127);
}

/**
 * Removes comments and redundant whitespace from classic JavaScript. Conservative: a line break
 * is kept after any token where automatic semicolon insertion or a restricted production could
 * depend on it (words, literals, `)`, `]`, `}`, `++`, `--`), and a space is kept wherever dropping
 * it could join two tokens. Never ship the result without a parse check (`minifyScript` does).
 */
export function stripJs(code: string): string {
  const n = code.length;
  let out = '';
  let i = 0;
  // Whitespace or comments seen since the last emitted token.
  let gap = false;
  let gapNewline = false;
  // Last emitted significant token, for separator and regex decisions.
  type Kind = 'none' | 'word' | 'number' | 'punct' | 'literal';
  // `as Kind`: assigned inside closures, so it must not be narrowed to 'none'.
  let lastKind = 'none' as Kind;
  let lastText = '';
  let lastParenControl = false;
  const parenStack: boolean[] = [];
  const templateStack: number[] = []; // brace depth at which each `${` opened
  let braceDepth = 0;

  const needsNewline = (): boolean => {
    if (lastKind === 'word' || lastKind === 'number' || lastKind === 'literal') return true;
    return lastText === ')' || lastText === ']' || lastText === '}' || lastText.endsWith('++') || lastText.endsWith('--');
  };

  /** Emits a token, preceded by the separator it needs. */
  const emit = (text: string, kind: Kind): void => {
    if (gap && out.length > 0) {
      const prev = out[out.length - 1]!;
      const next = text[0]!;
      if (gapNewline && needsNewline()) out += '\n';
      else if (isWordChar(prev) && isWordChar(next)) out += ' ';
      else if (JOINING.has(prev) && JOINING.has(next)) out += ' ';
      else if (lastKind === 'number' && next === '.') out += ' ';
    }
    gap = false;
    gapNewline = false;
    out += text;
    lastKind = kind;
    lastText = text;
  };

  /** Reads template text from `i` (after a backtick, or the `}` closing `${…}`) up to `${` or the closing backtick. */
  const readTemplate = (): { text: string; opened: boolean } => {
    const start = i;
    while (i < n) {
      const c = code[i];
      if (c === '\\') i += 2;
      else if (c === '`') {
        i++;
        return { text: code.slice(start, i), opened: false };
      } else if (c === '$' && code[i + 1] === '{') {
        templateStack.push(braceDepth);
        braceDepth++;
        i += 2;
        return { text: code.slice(start, i), opened: true };
      } else i++;
    }
    return { text: code.slice(start, n), opened: false };
  };
  const emitTemplate = (head: string): void => {
    const { text, opened } = readTemplate();
    emit(head + text, opened ? 'punct' : 'literal');
    // Inside `${` the next token starts an expression (like after `{`).
    lastText = opened ? '${' : '`';
  };

  while (i < n) {
    const c = code[i]!;
    if (/\s/.test(c)) {
      gap = true;
      if (NEWLINE.test(c)) gapNewline = true;
      i++;
      continue;
    }
    if (c === '/' && code[i + 1] === '/') {
      while (i < n && !NEWLINE.test(code[i]!)) i++;
      gap = true;
      continue;
    }
    if (c === '/' && code[i + 1] === '*') {
      const end = code.indexOf('*/', i + 2);
      const stop = end < 0 ? n : end + 2;
      const text = code.slice(i, stop);
      i = stop;
      if (lastKind === 'none' && /^\/\*!|@license|@preserve/.test(text)) {
        // A license comment before the first token is kept, on its own line.
        out += text + '\n';
        continue;
      }
      gap = true;
      if (NEWLINE.test(text)) gapNewline = true;
      continue;
    }
    if (c === '"' || c === "'") {
      const start = i;
      i++;
      while (i < n && code[i] !== c) {
        if (code[i] === '\\') i++;
        else if (NEWLINE.test(code[i]!)) break;
        i++;
      }
      i++;
      emit(code.slice(start, Math.min(i, n)), 'literal');
      continue;
    }
    if (c === '`') {
      i++;
      emitTemplate('`');
      continue;
    }
    if (c === '/') {
      const regexOk =
        lastKind === 'none' ||
        (lastKind === 'punct' && (lastText === ')' ? lastParenControl : REGEX_AFTER.has(lastText[lastText.length - 1]!))) ||
        (lastKind === 'word' && REGEX_KEYWORDS.has(lastText));
      if (regexOk) {
        const start = i;
        i++;
        let inClass = false;
        while (i < n && !NEWLINE.test(code[i]!)) {
          const r = code[i];
          if (r === '\\') i++;
          else if (r === '[') inClass = true;
          else if (r === ']') inClass = false;
          else if (r === '/' && !inClass) break;
          i++;
        }
        i++;
        while (i < n && isWordChar(code[i])) i++;
        emit(code.slice(start, Math.min(i, n)), 'literal');
        continue;
      }
    }
    if (isWordChar(c)) {
      let j = i;
      while (j < n && isWordChar(code[j])) j++;
      emit(code.slice(i, j), /[0-9]/.test(c) ? 'number' : 'word');
      i = j;
      continue;
    }
    // Punctuators, one character at a time.
    if (c === '}' && templateStack.length && templateStack[templateStack.length - 1] === braceDepth - 1) {
      // End of a `${…}` expression: the template continues.
      braceDepth--;
      templateStack.pop();
      i++;
      emitTemplate('}');
      continue;
    }
    const control = lastKind === 'word' && CONTROL_KEYWORDS.has(lastText);
    emit(c, 'punct');
    if (c === '(') parenStack.push(control);
    else if (c === ')') lastParenControl = parenStack.pop() ?? false;
    else if (c === '{') braceDepth++;
    else if (c === '}') braceDepth = Math.max(0, braceDepth - 1);
    else if (OPERATOR.test(c)) lastText = /[+\-*/%<>=!&|^?.:~]+$/.exec(out)![0];
    i++;
  }
  return out.trim();
}

const OPERATOR = /[+\-*/%<>=!&|^?.:~]/;

let terserPromise: Promise<JsMinifier> | null = null;

/**
 * Loads terser (a separate chunk) and returns a synchronous minifier built on `minify_sync`.
 * Classic scripts keep their top-level names (other embeds may use them); comments starting with
 * `/*!` or holding `@license`/`@preserve` are kept. Rejects when the chunk cannot be loaded
 * (e.g. a single-file build opened from `file://`).
 */
export function loadTerserMinifier(): Promise<JsMinifier> {
  if (!terserPromise) {
    terserPromise = import('terser').then((terser) => {
      const minifier: JsMinifier = (code, { module }) => {
        const res = terser.minify_sync(code, {
          module,
          toplevel: false,
          compress: { passes: 1 },
          mangle: true,
          format: { comments: /^!|@license|@preserve/i },
        });
        return typeof res.code === 'string' ? res.code : null;
      };
      return minifier;
    });
    terserPromise.catch(() => {
      terserPromise = null;
    });
  }
  return terserPromise;
}
