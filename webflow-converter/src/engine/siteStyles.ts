/**
 * Reusing the destination site's classes (spec 3.6).
 *
 * Webflow reuses an existing class on paste only when the pasted style has the same name
 * (ignoring a trailing " N") AND exactly the same `styleLess`/`variants` (AND, for a combo, the
 * same parent). Otherwise a base class becomes "name 2". Pasted `_id`s are ignored by the matcher
 * and never kept. Sources: the 2018 Designer's `importXscpStyles` (S1) and Webflow's help article
 * "Copy and paste between sites" (S7).
 *
 * So the only reliable way to reuse `container-large` is to paste the site's own style object,
 * byte for byte. The user copies an element from their site in the Designer and pastes it into the
 * app ("site styles" import, `parseSiteStyles`). Then, for every class of the output whose name
 * matches a site class (`siteClassKey`), the payload carries the site's style verbatim (same `_id`,
 * `styleLess`, `variants` in the same key order, `createdBy`, `origin`…; only `children` is ours,
 * which the matcher ignores). Declarations where the source CSS differs from the site's class go to
 * the `<style>` embed under `[data-h2w-class~="name"]` (same specificity as `.name`, later in the
 * cascade, matches only the pasted elements), so the site's class itself stays untouched.
 *
 * Also here: `stableClassIds` (deterministic style ids) and `skipClientFirstUtilityStyles`.
 *
 * Ownership: engine.
 */

import { isClientFirstUtility } from './clientFirst';
import { toWebflowClassName } from './classNames';
import { attrSelector } from './embedCss';
import { stableUuid } from './ids';
import { WF_MAX_WIDTH_BREAKPOINTS, WF_MIN_WIDTH_BREAKPOINTS, XSCP_TYPE, type ConvertWarning, type WfStyle, type WfStyleVariants } from './types';

/* ------------------------------------------------------------------------------------------------
 * Import
 * ---------------------------------------------------------------------------------------------- */

/** Result of {@link parseSiteStyles}. */
export interface SiteStylesParse {
  /** Class styles found (verbatim objects), in payload order. Empty on error. */
  styles: WfStyle[];
  /** Why nothing could be read, for the UI. */
  error?: string;
}

/**
 * Reads the class styles out of a Webflow Designer clipboard payload (`@webflow/XscpData`, what
 * Ctrl/Cmd+C on an element in the Designer puts in `application/json`). Also accepts
 * `{ payload: { styles } }` or a bare array of style objects. Styles are kept verbatim, including
 * fields this converter does not know. Entries that are not valid class styles (no `_id`, no name,
 * `type` other than `class`) are skipped.
 */
export function parseSiteStyles(text: string): SiteStylesParse {
  const trimmed = text.replace(/^﻿/, '').trim();
  if (!trimmed) return { styles: [], error: 'The clipboard is empty.' };
  let data: unknown;
  try {
    data = JSON.parse(trimmed);
  } catch {
    return { styles: [], error: 'This is not Webflow clipboard data. In the Webflow Designer, select an element and press Ctrl/Cmd+C, then paste here.' };
  }
  let raw: unknown;
  if (Array.isArray(data)) raw = data;
  else if (data && typeof data === 'object') {
    const d = data as { type?: unknown; payload?: { styles?: unknown } };
    if (d.type !== undefined && d.type !== XSCP_TYPE) {
      return { styles: [], error: `Unexpected clipboard type "${String(d.type)}"; expected ${XSCP_TYPE}.` };
    }
    raw = d.payload?.styles;
  }
  if (!Array.isArray(raw)) return { styles: [], error: 'No styles found in this clipboard data.' };
  const styles = raw.filter(isSiteStyle).map((s) => cloneStyle(s));
  if (styles.length === 0) return { styles: [], error: 'The copied element has no classes. Copy an element with classes (e.g. the page wrapper or a style guide section).' };
  return { styles };
}

function isSiteStyle(v: unknown): v is WfStyle {
  if (!v || typeof v !== 'object') return false;
  const s = v as Record<string, unknown>;
  return (
    typeof s._id === 'string' &&
    s._id.trim() !== '' &&
    s.type === 'class' &&
    typeof s.name === 'string' &&
    s.name.trim() !== '' &&
    (s.comb === undefined || s.comb === '' || s.comb === '&') &&
    (s.styleLess === undefined || typeof s.styleLess === 'string') &&
    (s.variants === undefined || (typeof s.variants === 'object' && s.variants !== null && !Array.isArray(s.variants))) &&
    (s.children === undefined || (Array.isArray(s.children) && s.children.every((c) => typeof c === 'string')))
  );
}

/** Deep copy (JSON-safe objects only), keeping key order. */
function cloneStyle(s: WfStyle): WfStyle {
  return JSON.parse(JSON.stringify(s)) as WfStyle;
}

/**
 * Merges style lists by `_id` (later lists win), e.g. several imports of the same site. Combos
 * keep the union of their parents' `children`.
 */
export function mergeSiteStyles(...lists: readonly (readonly WfStyle[])[]): WfStyle[] {
  const byId = new Map<string, WfStyle>();
  for (const list of lists) {
    for (const s of list) {
      const prev = byId.get(s._id);
      const next = cloneStyle(s);
      if (prev) next.children = [...new Set([...(prev.children ?? []), ...(next.children ?? [])])];
      byId.set(s._id, next);
    }
  }
  return [...byId.values()];
}

/**
 * Key two class names share when Webflow publishes them under the same selector (S1
 * `toClassName`): lower case, other characters as "-", e.g. `"Container Large"` and
 * `"container-large"` both give `container-large`.
 */
export function siteClassKey(name: string): string {
  return toWebflowClassName(name);
}

/* ------------------------------------------------------------------------------------------------
 * Matching
 * ---------------------------------------------------------------------------------------------- */

/** One of our class chains (a registry prefix) and its style. */
export interface ChainStyle {
  classes: string[];
  style: WfStyle;
}

/** A class of ours that reuses a site style. */
export interface SiteMatch {
  chain: string[];
  ours: WfStyle;
  site: WfStyle;
  /** Declarations where the source differs from the site's class, per variant key (`''` = main). */
  overrides: Map<string, Map<string, string>>;
  /** Properties the site's class sets that the source does not (they now apply too). */
  siteOnly: string[];
}

/**
 * Finds, for each of our chains, the site style it can reuse: a base class by `siteClassKey`; a
 * combo by name under the site style its parent chain reuses (Webflow scopes combos to their
 * parent, spec 3.4). Chains must be in parent-before-child order (registry order is).
 */
export function matchSiteStyles(chains: readonly ChainStyle[], siteStyles: readonly WfStyle[]): SiteMatch[] {
  const bases = new Map<string, WfStyle>();
  const byId = new Map<string, WfStyle>();
  for (const s of siteStyles) byId.set(s._id, s);
  for (const s of siteStyles) {
    if ((s.comb ?? '') !== '') continue;
    const key = siteClassKey(s.name);
    const prev = bases.get(key);
    // Prefer the exact name over another spelling that slugs the same ("Button" vs "button").
    if (!prev || (prev.name !== key && s.name === key)) bases.set(key, s);
  }

  const matchedByChain = new Map<string, WfStyle>();
  const used = new Set<string>();
  const out: SiteMatch[] = [];
  for (const { classes, style } of chains) {
    let site: WfStyle | undefined;
    if (classes.length === 1) {
      site = bases.get(siteClassKey(style.name));
    } else {
      const parent = matchedByChain.get(classes.slice(0, -1).join('\u0001'));
      if (parent) {
        const key = siteClassKey(style.name);
        site = (parent.children ?? [])
          .map((id) => byId.get(id))
          .find((c) => c !== undefined && c.comb === '&' && siteClassKey(c.name) === key);
      }
    }
    if (!site || used.has(site._id)) continue;
    used.add(site._id);
    matchedByChain.set(classes.join('\u0001'), site);
    out.push({ chain: classes, ours: style, site, ...diffStyles(style, site) });
  }
  return out;
}

/** Splits a `styleLess` string into `property -> value` (top-level `;` only). */
export function parseStyleLess(text: string): Map<string, string> {
  const out = new Map<string, string>();
  let depth = 0;
  let quote = '';
  let start = 0;
  const flush = (end: number) => {
    const part = text.slice(start, end).trim();
    start = end + 1;
    const colon = part.indexOf(':');
    if (colon <= 0) return;
    const prop = part.slice(0, colon).trim().toLowerCase();
    const value = part.slice(colon + 1).trim();
    if (prop && value) out.set(prop, value);
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = '';
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    else if (ch === ';' && depth === 0) flush(i);
  }
  flush(text.length);
  return out;
}

/** Value as plain CSS: unwraps Webflow's `@raw<|…|>` marker. */
export function plainCssValue(value: string): string {
  return value.replace(/@raw<\|([\s\S]*?)\|>/g, '$1').trim();
}

function normValue(value: string): string {
  let v = plainCssValue(value).replace(/\s+/g, ' ').replace(/\s*([(),])\s*/g, '$1');
  if (/^#[0-9a-f]{3,8}$/i.test(v)) v = v.toLowerCase();
  if (/^[+-]?0(\.0+)?(px|rem|em|%|vw|vh)?$/i.test(v)) v = '0';
  return v;
}

/** Declarations per variant key (`''` = main). */
function declsByKey(style: WfStyle): Map<string, Map<string, string>> {
  const out = new Map<string, Map<string, string>>([['', parseStyleLess(style.styleLess ?? '')]]);
  for (const [key, variant] of Object.entries(style.variants ?? {})) {
    if (variant && typeof variant.styleLess === 'string') out.set(key, parseStyleLess(variant.styleLess));
  }
  return out;
}

function diffStyles(ours: WfStyle, site: WfStyle): Pick<SiteMatch, 'overrides' | 'siteOnly'> {
  const mine = declsByKey(ours);
  const theirs = declsByKey(site);
  const overrides = new Map<string, Map<string, string>>();
  const siteOnly = new Set<string>();
  for (const [key, decls] of mine) {
    const other = theirs.get(key) ?? new Map<string, string>();
    for (const [prop, value] of decls) {
      const s = other.get(prop);
      if (s !== undefined && normValue(s) === normValue(value)) continue;
      if (!overrides.has(key)) overrides.set(key, new Map());
      overrides.get(key)!.set(prop, value);
    }
  }
  for (const [key, decls] of theirs) {
    const own = mine.get(key);
    for (const prop of decls.keys()) if (!own?.has(prop)) siteOnly.add(key ? `${prop} (${key})` : prop);
  }
  return { overrides, siteOnly: [...siteOnly] };
}

/* ------------------------------------------------------------------------------------------------
 * Override CSS
 * ---------------------------------------------------------------------------------------------- */

const PSEUDO_CSS: Record<string, string> = {
  hover: ':hover',
  active: ':active',
  pressed: ':active',
  focus: ':focus',
  'focus-visible': ':focus-visible',
  'focus-within': ':focus-within',
  visited: ':visited',
  placeholder: '::placeholder',
  'first-child': ':first-child',
  'last-child': ':last-child',
  'nth-child(odd)': ':nth-child(odd)',
  'nth-child(even)': ':nth-child(even)',
};

const MEDIA_ORDER = ['', 'medium', 'small', 'tiny', 'large', 'xl', 'xxl'];

/** `@media` query for a breakpoint (`''` for main), or `null` when unknown. */
function mediaFor(bp: string): string | null {
  if (bp === 'main') return '';
  if (bp in WF_MAX_WIDTH_BREAKPOINTS) return `(max-width: ${WF_MAX_WIDTH_BREAKPOINTS[bp as keyof typeof WF_MAX_WIDTH_BREAKPOINTS]}px)`;
  if (bp in WF_MIN_WIDTH_BREAKPOINTS) return `(min-width: ${WF_MIN_WIDTH_BREAKPOINTS[bp as keyof typeof WF_MIN_WIDTH_BREAKPOINTS]}px)`;
  return null;
}

/** Splits a variant key (`medium_hover`, `main_current`) into breakpoint and selector suffix. */
function variantTarget(key: string): { bp: string; suffix: string } | null {
  if (!key) return { bp: 'main', suffix: '' };
  const [bp, ...rest] = key.split('_');
  if (!bp || mediaFor(bp) === null) return null;
  let suffix = '';
  for (const part of rest) {
    if (part === 'current' || part === 'open') suffix += `.w--${part}`;
    else if (PSEUDO_CSS[part]) suffix += PSEUDO_CSS[part];
    else return null;
  }
  return { bp, suffix };
}

/**
 * CSS rules that restore the source's values on the pasted elements where they differ from the
 * reused site classes, scoped with `[data-h2w-class~="…"]` (one attribute per chain level, the same
 * specificity as `.a.b`). Returns self-contained chunks (each with its `@media`), at most
 * ~`maxChars` each, desktop-first order (main, medium, small, tiny, then min-width ones).
 */
export function buildOverrideCss(matches: readonly SiteMatch[], maxChars: number): { chunks: string[]; rules: number; skipped: string[] } {
  const byMedia = new Map<string, string[]>();
  const skipped: string[] = [];
  let rules = 0;
  for (const m of matches) {
    const base = m.chain.map(attrSelector).join('');
    for (const [key, decls] of m.overrides) {
      const target = variantTarget(key);
      if (!target) {
        skipped.push(`${m.chain.join('.')} (${key})`);
        continue;
      }
      const body = [...decls].map(([p, v]) => `  ${p}: ${plainCssValue(v)};`).join('\n');
      const list = byMedia.get(target.bp) ?? [];
      list.push(`${base}${target.suffix} {\n${body}\n}`);
      byMedia.set(target.bp, list);
      rules++;
    }
  }
  const chunks: string[] = [];
  const budget = Math.max(200, maxChars - 60);
  const ordered = [...byMedia.keys()].sort((a, b) => MEDIA_ORDER.indexOf(a === 'main' ? '' : a) - MEDIA_ORDER.indexOf(b === 'main' ? '' : b));
  for (const bp of ordered) {
    const media = mediaFor(bp)!;
    const wrap = (css: string) => (media ? `@media ${media} {\n${css}\n}` : css);
    let group: string[] = [];
    let size = 0;
    for (const rule of byMedia.get(bp)!) {
      if (group.length > 0 && size + rule.length + 1 > budget - media.length) {
        chunks.push(wrap(group.join('\n')));
        group = [];
        size = 0;
      }
      group.push(rule);
      size += rule.length + 1;
    }
    if (group.length) chunks.push(wrap(group.join('\n')));
  }
  return { chunks, rules, skipped };
}

/* ------------------------------------------------------------------------------------------------
 * Payload styles
 * ---------------------------------------------------------------------------------------------- */

/** Options for {@link finalizeStyles}. */
export interface FinalizeStylesOptions {
  matches: readonly SiteMatch[];
  /** Replace our style ids with {@link stableStyleId}. */
  stableIds: boolean;
}

/**
 * Builds `payload.styles` from our styles: matched ones become the site's style objects verbatim
 * (only `children` is rebuilt, from our combo chains), the rest optionally get stable ids. Rewrites
 * `classes` of every node in place. Returns the styles in our order.
 */
export function finalizeStyles(
  styles: readonly WfStyle[],
  chains: readonly ChainStyle[],
  nodes: readonly { classes?: string[] }[],
  opts: FinalizeStylesOptions,
): WfStyle[] {
  const siteFor = new Map(opts.matches.map((m) => [m.ours._id, m.site]));
  const chainOf = new Map(chains.map((c) => [c.style._id, c.classes]));
  const idMap = new Map<string, string>();
  for (const s of styles) {
    const site = siteFor.get(s._id);
    if (site) idMap.set(s._id, site._id);
    else if (opts.stableIds) idMap.set(s._id, stableStyleId(chainOf.get(s._id) ?? [s.name], s));
  }
  const mapId = (id: string) => idMap.get(id) ?? id;

  const out = styles.map((s) => {
    const site = siteFor.get(s._id);
    const children = s.children.map(mapId);
    if (site) return { ...cloneStyle(site), children };
    return { ...s, _id: mapId(s._id), children };
  });
  for (const n of nodes) if (Array.isArray(n.classes) && n.classes.length) n.classes = n.classes.map(mapId);
  return out;
}

/**
 * Deterministic id of one of our styles: a hash of its class chain and its declarations, so the
 * same output keeps the same ids, and two classes with different CSS never share an id.
 */
export function stableStyleId(chain: readonly string[], style: Pick<WfStyle, 'styleLess' | 'variants'>): string {
  return stableUuid(`h2w-style-v1\u0002${chain.join('\u0001')}\u0002${style.styleLess}\u0002${JSON.stringify(style.variants ?? {})}`);
}

/* ------------------------------------------------------------------------------------------------
 * Client-First utilities without an import
 * ---------------------------------------------------------------------------------------------- */

/**
 * Empties the styles of Client-First utility base classes (option `skipClientFirstUtilityStyles`)
 * that did not match an imported site style, so that IF Webflow reuses a same-named class with an
 * empty pasted style (measured by S4 in 2026, not what the 2018 code does: spec 3.6, UNCERTAIN), the
 * site's version applies. Returns the emptied class names.
 */
export function emptyClientFirstUtilities(chains: readonly ChainStyle[], skip: ReadonlySet<string>): string[] {
  const out: string[] = [];
  for (const { classes, style } of chains) {
    if (classes.length !== 1 || skip.has(style._id) || !isClientFirstUtility(style.name)) continue;
    if (!style.styleLess && Object.keys(style.variants).length === 0) continue;
    style.styleLess = '';
    style.variants = {} as WfStyleVariants;
    out.push(style.name);
  }
  return out;
}

/* ------------------------------------------------------------------------------------------------
 * Warnings
 * ---------------------------------------------------------------------------------------------- */

/** Info/warning notes about reused classes and their overrides. */
export function siteReuseWarnings(
  matches: readonly SiteMatch[],
  overrides: { rules: number; skipped: string[]; mode: 'embed' | 'drop'; embedAllowed: boolean },
): ConvertWarning[] {
  if (matches.length === 0) return [];
  const out: ConvertWarning[] = [];
  const label = (m: SiteMatch) => m.chain.join('.');
  out.push({
    code: 'site-classes',
    severity: 'info',
    message: `${matches.length} class${matches.length === 1 ? '' : 'es'} reuse${matches.length === 1 ? 's' : ''} your site's existing style${matches.length === 1 ? '' : 's'} (same _id and identical styles), so Webflow pastes ${matches.length === 1 ? 'it' : 'them'} without creating "name 2".`,
    detail: matches.map(label).join(', '),
    items: matches.map((m) => m.chain[m.chain.length - 1]!),
  });
  const differing = matches.filter((m) => m.overrides.size > 0);
  if (differing.length > 0) {
    const lines = differing.map((m) => {
      const parts = [...m.overrides].map(([key, decls]) => `${key || 'main'}: ${[...decls].map(([p, v]) => `${p}: ${plainCssValue(v)}`).join('; ')}`);
      return `${label(m)} → ${parts.join(' | ')}`;
    });
    const kept = overrides.mode === 'embed' && overrides.embedAllowed;
    out.push({
      code: 'site-classes',
      severity: 'warning',
      message: kept
        ? `${differing.length} reused class${differing.length === 1 ? '' : 'es'} differ${differing.length === 1 ? 's' : ''} from your site's version. The site's class is kept unchanged; the source's differing values (${overrides.rules} rule${overrides.rules === 1 ? '' : 's'}) are in the <style> embed under [data-h2w-class~="…"], which applies only to the pasted elements.`
        : `${differing.length} reused class${differing.length === 1 ? '' : 'es'} differ${differing.length === 1 ? 's' : ''} from your site's version. The site's styles are used as they are; the source's differing values were dropped.`,
      detail: lines.join('\n'),
    });
  }
  const leaks = matches.filter((m) => m.siteOnly.length > 0);
  if (leaks.length > 0) {
    out.push({
      code: 'site-classes',
      severity: 'info',
      message: `Your site's version of ${leaks.length} reused class${leaks.length === 1 ? '' : 'es'} sets properties the source does not; they apply to the pasted elements too.`,
      detail: leaks.map((m) => `${label(m)}: ${m.siteOnly.join(', ')}`).join('\n'),
    });
  }
  if (overrides.skipped.length > 0) {
    out.push({
      code: 'site-classes',
      severity: 'info',
      message: 'Some differing values are on states that have no CSS equivalent and were not overridden.',
      detail: overrides.skipped.join('\n'),
    });
  }
  return out;
}
