/**
 * Style mapping. Decides, selector by selector, whether CSS can become a native Webflow class
 * style (spec 3, checklist 7.4) or must go to a `<style>` embed:
 *
 * | CSS                                   | Destination                                      |
 * |---------------------------------------|--------------------------------------------------|
 * | `.a`                                  | base style (`comb: ""`)                          |
 * | `.a.b`                                | combo style (`comb: "&"`), chained via children  |
 * | `.a:hover`, `:focus`, `:active`…      | state variant (`main_hover`…)                    |
 * | `@media (max-width: ~991/767/479px)`  | `medium` / `small` / `tiny` (within tolerance)   |
 * | `@media (min-width: ~992/768/480px)`  | re-encoded desktop-first (see `resolveBands`)    |
 * | everything else                       | leftover CSS for the `<style>` embed             |
 *
 * How class rules land on Webflow's combo chains
 * -----------------------------------------------
 * Webflow styles are per *chain*: an element with `class="a b c"` gets styles `a`, `a.b` (combo
 * `b`), `a.b.c` (combo `c`), and the published CSS is `.a{}`, `.a.b{}`, `.a.b.c{}`. A source rule
 * whose class set S applies to that element (S ⊆ {a,b,c}) is written into the *shortest* chain
 * prefix that contains all of S. So `.b { … }` on an element `a b` lands in combo `a.b`, which is
 * exactly where the browser would apply it. Within one chain level, rules are applied in
 * (specificity, source order), so the cascade is preserved.
 *
 * Rules whose class set is not present on any native element (typically classes toggled by JS,
 * e.g. `.menu.is-open`) are kept in the embed so they still work at runtime. Rules that match
 * elements placed inside Code Embeds (svg, canvas…) are also copied to the embed.
 *
 * Ownership: engine.
 */

import { declarationsToCss, type CssDeclaration, type CssStyleRule, type ParsedCss } from './cssParser';
import { prepareDeclaration, type NativeDecl } from './cssValues';
import { bandDomain, mediaToBands, type Band } from './media';
import { uuid } from './ids';
import { classifySelector, isWebflowSafeClassName } from './selectors';
import type { ConvertOptions, ConvertWarning, ConvertWarningCode, WfStyle, WfVariantKey } from './types';

/** Separator for chain keys (cannot appear in a class name). */
const SEP = '\u0001';

/**
 * Creates and tracks `WfStyle` objects while nodes are built. Combo chains depend on the class
 * list of each element, so styles are created per element chain; `mapStyles` fills in their
 * declarations afterwards.
 */
export interface StyleRegistry {
  /**
   * Returns the style `_id`s for an element's class list (`classes` on a WfElementNode):
   * the first class is the base (`comb: ""`), the rest are combos (`comb: "&"`) scoped to the
   * preceding chain. Creates missing styles and records each combo in its predecessor's
   * `children`. Duplicate class names are ignored.
   *
   * @param classNames Class names in `class` attribute order. Empty array -> `[]`.
   */
  resolve(classNames: string[]): string[];
  /** All styles created so far, in creation order (this becomes `payload.styles`). */
  styles(): WfStyle[];
  /** Every distinct full class list seen on a native element. */
  chains(): string[][];
  /** Every chain prefix with its style (base styles and combos). */
  prefixes(): { classes: string[]; style: WfStyle }[];
  /** Registers declarations from an element's `style="…"` attribute under a generated class. */
  addInlineStyle(className: string, decls: CssDeclaration[]): void;
  /** Inline-style classes registered with `addInlineStyle`, in order. */
  inlineStyles(): [string, CssDeclaration[]][];
}

/** Creates an empty registry. */
export function createStyleRegistry(): StyleRegistry {
  const byKey = new Map<string, { classes: string[]; style: WfStyle }>();
  const order: WfStyle[] = [];
  const chains = new Map<string, string[]>();
  const inline: [string, CssDeclaration[]][] = [];

  const getOrCreate = (classes: string[]): WfStyle => {
    const key = classes.join(SEP);
    const existing = byKey.get(key);
    if (existing) return existing.style;
    const style: WfStyle = {
      _id: uuid(),
      fake: false,
      type: 'class',
      name: classes[classes.length - 1]!,
      namespace: '',
      comb: classes.length > 1 ? '&' : '',
      styleLess: '',
      variants: {},
      children: [],
      origin: null,
      selector: null,
    };
    byKey.set(key, { classes, style });
    order.push(style);
    return style;
  };

  return {
    resolve(classNames) {
      const names: string[] = [];
      for (const n of classNames) if (n && !names.includes(n)) names.push(n);
      if (names.length === 0) return [];
      chains.set(names.join(SEP), names);
      const ids: string[] = [];
      let prev: WfStyle | null = null;
      for (let k = 0; k < names.length; k++) {
        const style = getOrCreate(names.slice(0, k + 1));
        if (prev && !prev.children.includes(style._id)) prev.children.push(style._id);
        ids.push(style._id);
        prev = style;
      }
      return ids;
    },
    styles: () => [...order],
    chains: () => [...chains.values()],
    prefixes: () => [...byKey.values()],
    addInlineStyle(className, decls) {
      inline.push([className, decls]);
    },
    inlineStyles: () => [...inline],
  };
}

/** Where classes are used in the converted HTML (filled by nodeBuilder). */
export interface ClassUsage {
  /** Class lists of every element that was placed inside a Code Embed (svg, canvas, forms…). */
  embeddedClassLists: string[][];
}

/** Result of `mapStyles`. */
export interface StyleMapResult {
  /**
   * CSS that has no native representation, as chunks of source text in cascade order, ready for
   * `<style>` embeds (each chunk is self-contained, with its `@media` wrapper). Empty when
   * everything mapped or when `keepUnsupportedInEmbed` is false.
   */
  leftoverCss: string[];
  /** Number of style rules (not at-rules) placed in `leftoverCss`. Feeds `stats.embeddedCssRules`. */
  leftoverRuleCount: number;
  warnings: ConvertWarning[];
}

/** One native-mappable selector of one rule. */
interface Candidate {
  id: number;
  classes: string[];
  /** `""`, `"hover"`, `"current"`, `"current_hover"`, … (the variant-key suffix). */
  state: string;
  bands: Set<Band>;
  /** Native longhands; `src` indexes the source declaration they were expanded from. */
  decls: (NativeDecl & { src: number })[];
  /** Source declarations behind `decls`, used if (part of) the candidate moves to the embed. */
  source: CssDeclaration[];
  specificity: number;
  order: number;
  sub: number;
  selector: string;
  mediaStack: string[];
  /** Already copied to the embed. */
  embedded: boolean;
}

/** A piece of CSS destined for the embed. */
interface EmbedPiece {
  order: number;
  sub: number;
  mediaStack: string[];
  /** Style-rule piece: selector + declarations. */
  selector?: string;
  declText?: string;
  /** At-rule piece: verbatim text. */
  raw?: string;
  isImport?: boolean;
}

/**
 * Maps parsed CSS onto the registry's class styles (filling `styleLess` and `variants`) and
 * returns whatever must go to the `<style>` embed.
 *
 * @param css Output of `parseCss`.
 * @param registry Registry populated by `buildNodes` (element class chains + inline styles).
 * @param usage Classes used inside Code Embeds.
 * @param options Fully-resolved convert options.
 */
export function mapStyles(
  css: ParsedCss,
  registry: StyleRegistry,
  usage: ClassUsage,
  options: ConvertOptions,
): StyleMapResult {
  const warnings: ConvertWarning[] = [];
  const pieces: EmbedPiece[] = [];
  const candidates: Candidate[] = [];
  const keep = options.keepUnsupportedInEmbed;
  const verb = keep ? 'Kept in a Code Embed' : 'Dropped';
  const domain = bandDomain(options.includeLargeBreakpoints);

  const warn = (code: ConvertWarningCode, message: string, detail?: string, severity: ConvertWarning['severity'] = 'info'): void => {
    warnings.push({ code, severity, message, ...(detail ? { detail } : {}) });
  };
  const describe = (selector: string, stack: string[]): string =>
    stack.length ? `@media ${stack.join(' and ')} { ${selector} }` : selector;

  const pushRulePiece = (
    order: number,
    sub: number,
    stack: string[],
    selector: string,
    decls: CssDeclaration[],
  ): void => {
    if (decls.length === 0) return;
    pieces.push({ order, sub, mediaStack: stack, selector, declText: declarationsToCss(decls) });
  };

  // 1. At-rules go to the embed verbatim.
  for (const at of css.atRules) {
    pieces.push({ order: at.order, sub: 0, mediaStack: at.mediaStack, raw: at.raw, isImport: at.name === 'import' });
    const label =
      at.name === 'nested' ? 'nested CSS rule' : at.name === 'unparsed' ? 'unparsed CSS' : `@${at.name} rule`;
    warn('at-rule', `${verb}: ${label} has no native Webflow equivalent.`, `@${at.name} ${at.prelude}`.trim().slice(0, 160));
  }

  // 2. Style rules (+ inline styles) are split per selector into candidates and embed pieces.
  const inlineRules: CssStyleRule[] = registry.inlineStyles().map(([name, decls], i) => ({
    kind: 'style',
    selectors: [`.${name}`],
    declarations: decls,
    media: null,
    mediaStack: [],
    body: '',
    raw: '',
    order: 1e9 + i,
  }));

  let nextId = 0;
  for (const rule of [...css.rules, ...inlineRules]) {
    const isInline = rule.order >= 1e9;
    const media = mediaToBands(rule.mediaStack, options.breakpointTolerancePx, options.includeLargeBreakpoints);

    const nativeDecls: (NativeDecl & { src: number })[] = [];
    const nativeSource: CssDeclaration[] = [];
    const embedDecls: { decl: CssDeclaration; code: ConvertWarningCode; reason: string }[] = [];
    for (const d of rule.declarations) {
      const prepared = prepareDeclaration(d);
      if (prepared.kind === 'native') {
        nativeDecls.push(...prepared.decls.map((nd) => ({ ...nd, src: nativeSource.length })));
        nativeSource.push(d);
      } else {
        embedDecls.push({ decl: d, code: prepared.code, reason: prepared.reason });
      }
    }

    rule.selectors.forEach((selector, si) => {
      const where = describe(selector, rule.mediaStack);
      const sel = classifySelector(selector);
      if (sel.kind === 'embed') {
        pushRulePiece(rule.order, si * 3, rule.mediaStack, selector, rule.declarations);
        if (sel.global) {
          warn(sel.code, `${verb}: "${selector}" styles the whole page, not just the pasted element.`, where, 'warning');
        } else {
          warn(sel.code, `${verb}: ${sel.reason} cannot be a Webflow class style.`, where);
        }
        return;
      }
      if (media.kind !== 'bands') {
        pushRulePiece(rule.order, si * 3, rule.mediaStack, selector, rule.declarations);
        warn(media.kind === 'large' ? 'large-breakpoint-folded' : 'unmatched-media', `${verb}: ${media.reason}.`, where);
        return;
      }
      if (embedDecls.length > 0) {
        pushRulePiece(rule.order, si * 3 + 1, rule.mediaStack, selector, embedDecls.map((e) => e.decl));
        for (const e of embedDecls) {
          warn(e.code, `${verb}: ${e.reason}.`, where, e.code === 'important-dropped' ? 'warning' : 'info');
        }
      }
      if (nativeDecls.length > 0) {
        candidates.push({
          id: nextId++,
          classes: sel.classes,
          state: [sel.webflowState, sel.pseudo].filter(Boolean).join('_'),
          bands: new Set(media.bands),
          decls: [...nativeDecls],
          source: nativeSource,
          specificity: isInline ? 1000 : sel.specificity,
          order: rule.order,
          sub: si * 3 + 2,
          selector,
          mediaStack: rule.mediaStack,
          embedded: false,
        });
      }
    });
  }

  /** Copies the whole candidate to the embed (it may stay native too). */
  const toEmbed = (c: Candidate, code: ConvertWarningCode, message: string): void => {
    if (c.embedded) return;
    c.embedded = true;
    pushRulePiece(c.order, c.sub, c.mediaStack, c.selector, c.source);
    warn(code, `${verb}: ${message}`, describe(c.selector, c.mediaStack));
  };
  /** Moves the source declaration(s) behind `property` out of the candidate and into the embed. */
  const evictProperty = (c: Candidate, property: string, message: string): void => {
    const srcs = new Set(c.decls.filter((d) => d.property === property).map((d) => d.src));
    c.decls = c.decls.filter((d) => !srcs.has(d.src));
    if (c.embedded) return;
    pushRulePiece(c.order, c.sub, c.mediaStack, c.selector, c.source.filter((_, i) => srcs.has(i)));
    warn('unmatched-media', `${verb}: ${message}`, describe(c.selector, c.mediaStack));
  };

  // 3. Usage: which candidates apply to native elements, which (also) to embedded ones.
  const chains = registry.chains();
  const isSubset = (classes: string[], list: string[]): boolean => classes.every((c) => list.includes(c));
  const live = new Set<Candidate>();
  for (const c of candidates) {
    const onNative = chains.some((ch) => isSubset(c.classes, ch));
    const onEmbedded = usage.embeddedClassLists.some((l) => isSubset(c.classes, l));
    if (onNative) live.add(c);
    if (!onNative && !onEmbedded) {
      toEmbed(c, 'unsupported-selector', 'class combination is not on any element (probably added by JS).');
    } else if (onEmbedded) {
      toEmbed(c, 'unsupported-selector', 'class is used inside a Code Embed element.');
    }
  }

  // 4. Resolve every chain prefix.
  for (const { classes, style } of registry.prefixes()) {
    const last = classes[classes.length - 1]!;
    const group = [...live].filter((c) => c.classes.includes(last) && isSubset(c.classes, classes));
    const byState = new Map<string, Candidate[]>();
    for (const c of group) byState.set(c.state, [...(byState.get(c.state) ?? []), c]);

    const variants: WfStyle['variants'] = {};
    let styleLess = '';
    for (const [state, list] of byState) {
      const alive = [...list].sort((a, b) => a.specificity - b.specificity || a.order - b.order || a.sub - b.sub);
      let resolved = resolveBands(alive, domain);
      // A property set by a min-width rule with no narrower value cannot be expressed
      // desktop-first: move that declaration to the embed and resolve again.
      for (let guard = 0; guard < 500; guard++) {
        const problem = findUnexpressible(resolved, domain);
        if (!problem) break;
        const causes = alive.filter(
          (c) => c.bands.has(problem.wide) && !c.bands.has(problem.narrow) && c.decls.some((d) => d.property === problem.property),
        );
        if (causes.length === 0) break;
        for (const c of causes) {
          evictProperty(
            c,
            problem.property,
            `"${problem.property}" is set only from a wider breakpoint up (mobile-first) with no base value to fall back to.`,
          );
        }
        resolved = resolveBands(alive, domain);
      }
      for (const [band, decls] of encodeDesktopFirst(resolved, domain)) {
        if (decls.length === 0) continue;
        const text = toStyleLess(decls);
        if (band === 'main' && !state) styleLess = text;
        else variants[(state ? `${band}_${state}` : band) as WfVariantKey] = { styleLess: text };
      }
    }
    style.styleLess = styleLess;
    style.variants = variants;
  }

  // 5. Class-name hygiene warnings (Webflow slugifies names to build selectors, spec 3.1).
  const warnedNames = new Set<string>();
  for (const s of registry.styles()) {
    if (!isWebflowSafeClassName(s.name) && !warnedNames.has(s.name)) {
      warnedNames.add(s.name);
      warn(
        'class-renamed',
        `Class "${s.name}" has uppercase or special characters; Webflow will publish it under a slugified selector, so Code Embed CSS/JS that references it may not match.`,
        s.name,
        'warning',
      );
    }
  }

  const leftover = keep ? assembleChunks(pieces, options.maxEmbedChars) : { chunks: [], ruleCount: 0 };
  return { leftoverCss: leftover.chunks, leftoverRuleCount: leftover.ruleCount, warnings };
}

/** Property values per band: `band -> property -> value`. */
type Resolved = Map<Band, Map<string, string>>;

/**
 * Computes the final value of every property in every viewport band, applying candidates in
 * cascade order (they are pre-sorted by specificity, then source order). This is what makes
 * mobile-first `min-width` CSS representable: the result is re-encoded desktop-first by
 * `encodeDesktopFirst`.
 */
function resolveBands(cands: Candidate[], domain: Band[]): Resolved {
  const out: Resolved = new Map(domain.map((b) => [b, new Map<string, string>()]));
  for (const c of cands) {
    for (const band of domain) {
      if (!c.bands.has(band)) continue;
      const map = out.get(band)!;
      for (const d of c.decls) {
        map.delete(d.property); // re-insert so the latest declaration order wins in output
        map.set(d.property, d.value);
      }
    }
  }
  return out;
}

/** Desktop-first cascade pairs: each narrower band inherits from the wider one (and large up). */
const CASCADE: [Band, Band][] = [
  ['main', 'medium'],
  ['medium', 'small'],
  ['small', 'tiny'],
  ['main', 'large'],
  ['large', 'xl'],
  ['xl', 'xxl'],
];

/**
 * A property set at a wider band but unset at the next narrower one cannot be expressed: Webflow
 * variants only override, they cannot "unset" back to the browser default.
 */
function findUnexpressible(resolved: Resolved, domain: Band[]): { property: string; wide: Band; narrow: Band } | null {
  for (const [wide, narrow] of CASCADE) {
    if (!domain.includes(wide) || !domain.includes(narrow)) continue;
    const w = resolved.get(wide)!;
    const n = resolved.get(narrow)!;
    for (const property of w.keys()) if (!n.has(property)) return { property, wide, narrow };
  }
  return null;
}

/** Turns per-band values into `main` + per-breakpoint deltas. */
function encodeDesktopFirst(resolved: Resolved, domain: Band[]): [Band, NativeDecl[]][] {
  const out: [Band, NativeDecl[]][] = [['main', toDecls(resolved.get('main')!)]];
  for (const [wide, narrow] of CASCADE) {
    if (!domain.includes(wide) || !domain.includes(narrow)) continue;
    const w = resolved.get(wide)!;
    const delta: NativeDecl[] = [];
    for (const [property, value] of resolved.get(narrow)!) if (w.get(property) !== value) delta.push({ property, value });
    out.push([narrow, delta]);
  }
  return out;
}

function toDecls(map: Map<string, string>): NativeDecl[] {
  return [...map].map(([property, value]) => ({ property, value }));
}

/** Serialises declarations to Webflow `styleLess`: `"prop: value; prop2: value2;"`. */
export function toStyleLess(decls: NativeDecl[]): string {
  return decls.map((d) => `${d.property}: ${d.value};`).join(' ');
}

/**
 * Orders embed pieces by source position, merges selectors of the same rule that share a
 * declaration block, and groups consecutive pieces with the same `@media` chain. Each returned
 * chunk is self-contained and at most ~`maxChars` (a single oversized rule stays whole).
 */
function assembleChunks(pieces: EmbedPiece[], maxChars: number): { chunks: string[]; ruleCount: number } {
  const sorted = [...pieces].sort((a, b) => a.order - b.order || a.sub - b.sub);

  // Merge `.a, .b { same decls }` back into one rule.
  const merged: { mediaStack: string[]; text: string; isRule: boolean; isImport: boolean }[] = [];
  let i = 0;
  while (i < sorted.length) {
    const p = sorted[i]!;
    if (p.raw !== undefined) {
      merged.push({ mediaStack: p.mediaStack, text: p.raw, isRule: false, isImport: !!p.isImport });
      i++;
      continue;
    }
    const selectors = [p.selector!];
    let j = i + 1;
    while (j < sorted.length && sorted[j]!.order === p.order && sorted[j]!.declText === p.declText && sorted[j]!.raw === undefined) {
      if (!selectors.includes(sorted[j]!.selector!)) selectors.push(sorted[j]!.selector!);
      j++;
    }
    merged.push({ mediaStack: p.mediaStack, text: `${selectors.join(', ')} {\n${p.declText}\n}`, isRule: true, isImport: false });
    i = j;
  }

  // @import must precede every other rule of a stylesheet.
  merged.sort((a, b) => Number(b.isImport) - Number(a.isImport));

  const budget = Math.max(200, maxChars - 40); // room for the <style> wrapper
  const chunks: string[] = [];
  let k = 0;
  while (k < merged.length) {
    const stack = merged[k]!.mediaStack;
    const key = stack.join(SEP);
    const group: string[] = [];
    let size = 0;
    const wrapCost = stack.reduce((n, q) => n + q.length + 12, 0);
    while (k < merged.length && merged[k]!.mediaStack.join(SEP) === key) {
      const text = merged[k]!.text;
      if (group.length > 0 && size + text.length + 1 + wrapCost > budget) break;
      group.push(text);
      size += text.length + 1;
      k++;
    }
    chunks.push(wrapMedia(group.join('\n'), stack));
  }
  return { chunks, ruleCount: merged.filter((m) => m.isRule).length };
}

/** Re-wraps CSS text in its (possibly nested) `@media` blocks. */
function wrapMedia(css: string, stack: string[]): string {
  let out = css;
  for (let s = stack.length - 1; s >= 0; s--) out = `@media ${stack[s]} {\n${out}\n}`;
  return out;
}
