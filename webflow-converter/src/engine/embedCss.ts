/**
 * Post-processing of `<style>` embed selectors, so leftover CSS keeps matching and keeps winning
 * after the paste:
 *
 * - **Specificity parity** (option `embedSpecificityParity`). A class that sits at depth d > 1 of a
 *   Webflow combo chain is published as `.a.b` (0,2,0). An embed rule that targets `.b` alone
 *   (0,1,0) beat `.b`'s own rule in the source (later in source order), but loses to `.a.b` in
 *   Webflow. A compound made of that single class is repeated d times: `.b` -> `.b.b`.
 * - **Rename-proof classes** (option `renameProofEmbedCss`). Webflow renames a pasted class whose
 *   name already exists with different styles to "name 2" (`.name-2`), and embed CSS that says
 *   `.name` stops matching. Classes that are both styled natively and used in embed selectors are
 *   rewritten to `[data-h2w-class~="name"]` (same specificity), and the elements carry
 *   `data-h2w-class="<their classes>"`. A class that is also used inside Code Embed HTML (which Webflow
 *   never renames) becomes `:is(.name,[data-h2w-class~="name"])`.
 * - **Remapped tags** (option `rewriteRemappedTags`). `<b>` is pasted as `<strong>`, `<i>` as
 *   `<em>` and `<button>` as `<a>`; type selectors are rewritten to match. `button` becomes
 *   `:is(button,a:where([data-h2w-button]))`, which keeps its (0,0,1) specificity and still matches
 *   real buttons left in embeds.
 *
 * Selectors are tokenized (classes, ids, types, attributes, pseudo-classes with their arguments,
 * combinators, commas), never edited with regular expressions. Arguments of `:is()`, `:where()`,
 * `:not()`, `:has()` are rewritten recursively.
 *
 * Ownership: engine.
 */

/** What to rewrite in embed selectors. */
export interface EmbedRewritePlan {
  /** Class -> how many times a lone-class compound is repeated (only entries > 1). */
  repeat: Map<string, number>;
  /** Classes written as `[data-h2w-class~="x"]`. */
  attr: Set<string>;
  /** Of `attr`, classes also used inside Code Embed HTML: `:is(.x,[data-h2w-class~="x"])`. */
  both: Set<string>;
  /** Lower-case tag -> replacement selector text. */
  tags: Map<string, string>;
}

type TokenKind = 'class' | 'id' | 'type' | 'universal' | 'attr' | 'pseudo' | 'combinator' | 'comma' | 'other';

interface Token {
  kind: TokenKind;
  /** Source text of the token (for `pseudo`, including its parenthesised arguments). */
  text: string;
  /** Unescaped name for class/id/type/pseudo tokens. */
  name?: string;
  /** For functional pseudo-classes: the text between the parentheses. */
  args?: string;
}

const SELECTOR_ARG_PSEUDOS = new Set(['is', 'where', 'not', 'has', 'matches', '-webkit-any', '-moz-any']);

/** Splits one selector (or selector list) into tokens. Whitespace between compounds is a combinator. */
export function tokenizeSelector(sel: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  const n = sel.length;
  while (i < n) {
    const c = sel[i]!;
    if (/\s/.test(c) || c === '>' || c === '+' || c === '~') {
      let j = i;
      while (j < n && (/\s/.test(sel[j]!) || sel[j] === '>' || sel[j] === '+' || sel[j] === '~')) j++;
      const text = sel.slice(i, j);
      // Leading/trailing whitespace of the whole selector is not a combinator.
      out.push({ kind: out.length === 0 || j >= n ? 'other' : 'combinator', text });
      i = j;
      continue;
    }
    if (c === ',') {
      out.push({ kind: 'comma', text: c });
      i++;
      continue;
    }
    if (c === '.' || c === '#') {
      const { name, next } = readIdent(sel, i + 1);
      out.push({ kind: c === '.' ? 'class' : 'id', text: sel.slice(i, next), name });
      i = next;
      continue;
    }
    if (c === '[') {
      const end = scanBracket(sel, i);
      out.push({ kind: 'attr', text: sel.slice(i, end + 1) });
      i = end + 1;
      continue;
    }
    if (c === ':') {
      const start = i;
      const colons = sel[i + 1] === ':' ? 2 : 1;
      const { name, next } = readIdent(sel, i + colons);
      i = next;
      let args: string | undefined;
      if (sel[i] === '(') {
        const close = matchParen(sel, i);
        args = sel.slice(i + 1, close);
        i = close + 1;
      }
      out.push({ kind: 'pseudo', text: sel.slice(start, i), name: (colons === 2 ? '::' : ':') + name.toLowerCase(), args });
      continue;
    }
    if (c === '*') {
      out.push({ kind: 'universal', text: c });
      i++;
      continue;
    }
    if (/[a-zA-Z_\\-]/.test(c) || c.charCodeAt(0) > 127) {
      const { name, next } = readIdent(sel, i);
      if (next > i) {
        out.push({ kind: 'type', text: sel.slice(i, next), name: name.toLowerCase() });
        i = next;
        continue;
      }
    }
    out.push({ kind: 'other', text: c });
    i++;
  }
  return out;
}

/** Class names (unescaped) referenced anywhere in a selector, including inside `:not()` etc. */
export function selectorClassNames(sel: string): string[] {
  const names: string[] = [];
  for (const t of tokenizeSelector(sel)) {
    if (t.kind === 'class' && t.name) names.push(t.name);
    else if (t.kind === 'pseudo' && t.args !== undefined && SELECTOR_ARG_PSEUDOS.has(t.name!.replace(/^:+/, ''))) {
      names.push(...selectorClassNames(t.args));
    }
  }
  return names;
}

/** Rewrites one selector (or a selector list) according to `plan`. */
export function rewriteEmbedSelector(sel: string, plan: EmbedRewritePlan): string {
  const tokens = tokenizeSelector(sel);
  let out = '';
  let compound: Token[] = [];
  const flush = (): void => {
    out += rewriteCompound(compound, plan);
    compound = [];
  };
  for (const t of tokens) {
    if (t.kind === 'combinator' || t.kind === 'comma' || (t.kind === 'other' && /^\s+$/.test(t.text))) {
      flush();
      out += t.text;
    } else {
      compound.push(t);
    }
  }
  flush();
  return out;
}

function rewriteCompound(tokens: Token[], plan: EmbedRewritePlan): string {
  const classes = tokens.filter((t) => t.kind === 'class');
  const lone = classes.length === 1 && !tokens.some((t) => t.kind === 'id' || t.kind === 'type') ? classes[0]!.name! : null;
  let out = '';
  for (const t of tokens) {
    if (t.kind === 'type') {
      out += plan.tags.get(t.name!) ?? t.text;
    } else if (t.kind === 'class') {
      const name = t.name!;
      const one = plan.both.has(name) ? `:is(${t.text},${attrSelector(name)})` : plan.attr.has(name) ? attrSelector(name) : t.text;
      const times = lone === name ? (plan.repeat.get(name) ?? 1) : 1;
      out += one.repeat(times);
    } else if (t.kind === 'pseudo' && t.args !== undefined && SELECTOR_ARG_PSEUDOS.has(t.name!.replace(/^:+/, ''))) {
      // Inside :is()/:not()… only names and tags are rewritten; specificity repeats do not apply.
      const inner = rewriteEmbedSelector(t.args, { ...plan, repeat: new Map() });
      out += `${t.text.slice(0, t.text.length - t.args.length - 2)}(${inner})`;
    } else {
      out += t.text;
    }
  }
  return out;
}

/** `[data-h2w-class~="name"]` with the value escaped for a double-quoted CSS string. */
export function attrSelector(name: string): string {
  return `[data-h2w-class~="${name.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`;
}

/** Reads a CSS identifier starting at `start` (escapes are resolved in `name`, kept in the text). */
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

/** Index of the `]` closing the attribute selector that opens at `open` (strings skipped). */
function scanBracket(sel: string, open: number): number {
  for (let i = open + 1; i < sel.length; i++) {
    const c = sel[i];
    if (c === '\\') i++;
    else if (c === '"' || c === "'") {
      for (i++; i < sel.length && sel[i] !== c; i++) if (sel[i] === '\\') i++;
    } else if (c === ']') return i;
  }
  return sel.length - 1;
}

function matchParen(sel: string, open: number): number {
  let depth = 0;
  for (let i = open; i < sel.length; i++) {
    const c = sel[i];
    if (c === '\\') i++;
    else if (c === '"' || c === "'") {
      for (i++; i < sel.length && sel[i] !== c; i++) if (sel[i] === '\\') i++;
    } else if (c === '(') depth++;
    else if (c === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return sel.length - 1;
}

/** Inputs for `planEmbedRewrite`. */
export interface EmbedRewriteInput {
  /** Every selector headed for the `<style>` embed. */
  selectors: string[];
  /** Class lists of native elements (Webflow combo chains). */
  chains: string[][];
  /** Class names whose Webflow style (base or combo) has declarations. */
  styled: Set<string>;
  /** Class lists of elements placed inside Code Embeds (never renamed by Webflow). */
  embeddedClassLists: string[][];
  /** Source tags pasted as another tag (`b`, `i`, `button`). */
  remappedTags: Set<string>;
  embedSpecificityParity: boolean;
  renameProofEmbedCss: boolean;
  rewriteRemappedTags: boolean;
}

/** Tag remaps applied by the node builder, as selector replacements of the same specificity. */
export const TAG_REPLACEMENTS: Record<string, string> = {
  b: 'strong',
  i: 'em',
  button: ':is(button,a:where([data-h2w-button]))',
};

/** Works out what to rewrite in the embed selectors. */
export function planEmbedRewrite(input: EmbedRewriteInput): EmbedRewritePlan {
  const used = new Set<string>();
  for (const sel of input.selectors) for (const c of selectorClassNames(sel)) used.add(c);
  const repeat = new Map<string, number>();
  if (input.embedSpecificityParity) {
    for (const c of used) {
      let depth = 0;
      for (const chain of input.chains) depth = Math.max(depth, chain.indexOf(c) + 1);
      if (depth > 1) repeat.set(c, depth);
    }
  }
  const attr = new Set<string>();
  const both = new Set<string>();
  if (input.renameProofEmbedCss) {
    const inEmbeds = new Set(input.embeddedClassLists.flat());
    for (const c of used) {
      if (!input.styled.has(c)) continue;
      attr.add(c);
      if (inEmbeds.has(c)) both.add(c);
    }
  }
  const tags = new Map<string, string>();
  if (input.rewriteRemappedTags) for (const t of input.remappedTags) if (TAG_REPLACEMENTS[t]) tags.set(t, TAG_REPLACEMENTS[t]!);
  return { repeat, attr, both, tags };
}

/** True when the plan changes nothing. */
export function isEmptyPlan(plan: EmbedRewritePlan): boolean {
  return plan.repeat.size === 0 && plan.attr.size === 0 && plan.tags.size === 0;
}
