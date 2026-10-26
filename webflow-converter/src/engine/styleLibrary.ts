/**
 * The site's style guide library ("1. Your site's style guide").
 *
 * The user copies whole pages of their Webflow site in the Designer (usually the style guide page:
 * select the page wrapper, Ctrl/Cmd+C) and pastes them into the app. Every paste is a *source*; all
 * sources merge into ONE library, which `convert()` gets as `siteStyles` (`librarySiteStyles`), so
 * the rules of ./siteStyles run against the whole library: same name and same CSS -> the site's
 * style is pasted verbatim and Webflow reuses it; same name, different CSS -> ours is renamed to a
 * name no class of the library has.
 *
 * Secondary sources: the site's published CSS (fetched by URL, pasted, or a `.css` file), read with
 * ./cssParser (`cssToLibraryClasses`). Those classes have the site's names and CSS but not the
 * Designer's style objects, so they become reference styles (`REFERENCE_STYLE_PREFIX`): they decide
 * renames and taken names but are never pasted as the site's own.
 *
 * What is kept is compact (`serializeLibrary`): per class its id, name, combo flag, its declarations
 * per breakpoint/state exactly as Webflow stores them (`styleLess`: Webflow reuses a class only when
 * these bytes are identical, so they are not rewritten; comparisons normalise them on the fly,
 * including 16px = 1rem), its combo children and metadata such as `createdBy`; plus each source's
 * label, date, class ids and variable names. Never the pasted payload itself (its nodes, assets and
 * interactions are most of its megabytes).
 *
 * Pure functions only: storage lives in ui/lib/siteLibrary, off-main-thread work in ui/lib.
 *
 * Ownership: engine.
 */

import { isClientFirstUtility } from './clientFirst';
import { parseCss } from './cssParser';
import { prepareDeclaration } from './cssValues';
import { ALL_BANDS, mediaToBands, type Band } from './media';
import { sortDeclarations } from './propertyOrder';
import { classifySelector } from './selectors';
import { isReferenceStyle, parseStyleLess, REFERENCE_STYLE_PREFIX, siteClassKey, splitDuplicateSuffix } from './siteStyles';
import type { WfComb, WfStyle, WfStyleVariants } from './types';

/* ------------------------------------------------------------------------------------------------
 * Types
 * ---------------------------------------------------------------------------------------------- */

/** Where a source came from. */
export type LibrarySourceKind = 'designer' | 'css-url' | 'css-text';

/** One class of the library (compact form of a Webflow style). */
export interface LibraryClass {
  /** The site's style `_id`, or `h2w-ref:<chain>` for a class read from CSS. */
  id: string;
  /** Class name as the site spells it. */
  name: string;
  comb: WfComb;
  /** Main declarations, verbatim `styleLess`. */
  styleLess: string;
  /** Variant key (`medium`, `main_hover`…) -> verbatim `styleLess`, in the site's key order. */
  variants: Record<string, string>;
  /** Ids of the combo classes under this class. */
  children: string[];
  /** Other fields of the Designer's style object (`createdBy`, `origin`…), kept verbatim. */
  extra?: Record<string, unknown>;
}

/** One added page or stylesheet. */
export interface LibrarySource {
  id: string;
  /** User label; defaults to "26 Oct 2026 · 142 classes". */
  label: string;
  kind: LibrarySourceKind;
  /** ISO time it was added. */
  addedAt: string;
  /** The stylesheet URL, for `css-url`. */
  url?: string;
  /** Ids of its classes in `StyleLibrary.classes`. */
  classIds: string[];
  /** Variable names seen in it. */
  variables: string[];
}

/** Every source and the merged classes. */
export interface StyleLibrary {
  sources: LibrarySource[];
  /** Merged classes by id. A class several sources have is stored once (the last added wins). */
  classes: Map<string, LibraryClass>;
}

/** What a paste or a stylesheet contributes, before it is added. */
export interface LibraryInput {
  classes: LibraryClass[];
  variables: string[];
}

/** Counts and lists shown for a paste and for the whole library. */
export interface StyleGuideAnalysis {
  /** Base classes (combos not counted). */
  classCount: number;
  /** Client-First utility / core base classes (./clientFirst). */
  utilities: string[];
  /** Other base classes. */
  custom: string[];
  combos: { name: string; parent: string | null }[];
  variables: string[];
  /** Breakpoints with declarations, widest-first desktop cascade (`main`, `medium`, `small`, `tiny`, then `large`…). */
  breakpoints: string[];
  /** States with declarations (`hover`, `focus`, `current`…). */
  states: string[];
  /** Classes Webflow numbered because the name was taken (`button 2`). */
  duplicates: { name: string; base: string; baseExists: boolean }[];
  /** Classes read from CSS (no Designer copy). */
  fromCss: number;
}

export const EMPTY_STYLE_LIBRARY: StyleLibrary = Object.freeze({ sources: [], classes: new Map() }) as StyleLibrary;

/* ------------------------------------------------------------------------------------------------
 * Designer paste
 * ---------------------------------------------------------------------------------------------- */

/** Fields of a style object that {@link LibraryClass} holds itself (the rest goes to `extra`). */
const OWN_FIELDS = new Set(['_id', 'name', 'comb', 'styleLess', 'variants', 'children']);
/** Fields whose value is always the same, so they are not stored. */
const DEFAULTS: Record<string, unknown> = { fake: false, type: 'class', namespace: '', selector: null };

/** Compact form of Designer styles (from `parseSiteStyles`). */
export function stylesToLibraryClasses(styles: readonly WfStyle[]): LibraryClass[] {
  return styles.map((s) => {
    const variants: Record<string, string> = {};
    for (const [key, v] of Object.entries(s.variants ?? {})) if (v && typeof v.styleLess === 'string') variants[key] = v.styleLess;
    const extra: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(s)) if (!OWN_FIELDS.has(k) && !(k in DEFAULTS && DEFAULTS[k] === v)) extra[k] = v;
    const out: LibraryClass = { id: s._id, name: s.name, comb: s.comb === '&' ? '&' : '', styleLess: s.styleLess ?? '', variants, children: [...(s.children ?? [])] };
    if (Object.keys(extra).length > 0) out.extra = extra;
    return out;
  });
}

/** The style object a library class stands for (a Designer class comes back as it was copied). */
export function libraryClassToStyle(c: LibraryClass): WfStyle {
  const variants: WfStyleVariants = {};
  for (const [key, styleLess] of Object.entries(c.variants)) (variants as Record<string, { styleLess: string }>)[key] = { styleLess };
  const { selector, ...extra } = c.extra ?? {};
  return {
    _id: c.id,
    fake: false,
    type: 'class',
    name: c.name,
    namespace: '',
    comb: c.comb,
    styleLess: c.styleLess,
    variants,
    children: [...c.children],
    ...(extra as Partial<WfStyle>),
    selector: (selector ?? null) as null,
  };
}

/**
 * Variable names a Designer payload mentions: a `variables` list if the payload has one (newer
 * copies may), `@var_<id>` references in styles (Webflow Variables, spec 3.5) and `var(--name)`.
 */
export function payloadVariables(data: unknown, classes: readonly LibraryClass[]): string[] {
  const out = new Set<string>();
  const payload = data && typeof data === 'object' ? ((data as { payload?: unknown }).payload as Record<string, unknown> | undefined) : undefined;
  const lists = [payload?.variables, (data as Record<string, unknown> | null)?.variables];
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const v of list) {
      if (!v || typeof v !== 'object') continue;
      const o = v as Record<string, unknown>;
      const name = typeof o.name === 'string' ? o.name : typeof o.id === 'string' ? o.id : typeof o._id === 'string' ? o._id : '';
      if (name.trim()) out.add(name.trim());
    }
  }
  for (const c of classes) for (const name of styleVariableRefs(c)) out.add(name);
  return [...out];
}

function styleVariableRefs(c: LibraryClass): string[] {
  const out: string[] = [];
  for (const text of [c.styleLess, ...Object.values(c.variants)]) {
    for (const m of text.matchAll(/@var_([\w-]+)/g)) out.push(m[1]!);
    for (const m of text.matchAll(/var\(\s*(--[\w-]+)/g)) out.push(m[1]!);
  }
  return out;
}

/* ------------------------------------------------------------------------------------------------
 * CSS source
 * ---------------------------------------------------------------------------------------------- */

/** Bands each Webflow breakpoint covers (desktop-first max-width ones, then min-width ones). */
const BREAKPOINT_BANDS: [string, Band[]][] = [
  ['medium', ['tiny', 'small', 'medium']],
  ['small', ['tiny', 'small']],
  ['tiny', ['tiny']],
  ['large', ['large', 'xl', 'xxl']],
  ['xl', ['xl', 'xxl']],
  ['xxl', ['xxl']],
];

/** Webflow breakpoint of a `@media` chain (`main` without one), or `null` when none matches. */
function breakpointOf(mediaStack: string[]): string | null {
  const m = mediaToBands(mediaStack, 0, true);
  if (m.kind !== 'bands') return null;
  const set = new Set(m.bands);
  if (ALL_BANDS.every((b) => set.has(b))) return 'main';
  for (const [bp, bands] of BREAKPOINT_BANDS) if (bands.length === set.size && bands.every((b) => set.has(b))) return bp;
  return null;
}

/** Result of {@link cssToLibraryClasses}. */
export interface CssLibraryParse extends LibraryInput {
  /** Class rules that could not become class styles (descendant selectors, odd media…). */
  skipped: number;
  error?: string;
}

/**
 * Reads the class rules of a stylesheet (e.g. the site's published `….webflow.css`) into reference
 * classes: `.a` is a base class, `.a.b` the combo `b` under `a`; `@media` max-width 991/767/479 and
 * min-width 1280/1440/1920 become breakpoints, `:hover`/`.w--current`… states. Shorthands are
 * expanded the way the converter expands the source CSS, so both compare alike. Webflow's own
 * `w-*` classes are left out. `:root` custom properties are listed as variables.
 */
export function cssToLibraryClasses(css: string): CssLibraryParse {
  if (!css.trim()) return { classes: [], variables: [], skipped: 0, error: 'The CSS is empty.' };
  const parsed = parseCss(css);
  const variables = new Set<string>();
  /** chain key -> variant key -> property -> value */
  const chains = new Map<string, { classes: string[]; decls: Map<string, Map<string, string>> }>();
  let skipped = 0;
  for (const rule of parsed.rules) {
    for (const selector of rule.selectors) {
      const sel = selector.trim();
      if (/^(:root|html|body)$/i.test(sel)) {
        for (const d of rule.declarations) if (d.property.startsWith('--')) variables.add(d.property);
        continue;
      }
      if (!sel.includes('.')) continue;
      const c = classifySelector(sel);
      if (c.kind !== 'native') {
        skipped++;
        continue;
      }
      if (c.classes.some((n) => n.startsWith('w-'))) continue;
      const bp = breakpointOf(rule.mediaStack);
      if (!bp) {
        skipped++;
        continue;
      }
      const state = [c.webflowState, c.pseudo].filter(Boolean).join('_');
      const key = state ? `${bp}_${state}` : bp === 'main' ? '' : bp;
      const chainKey = c.classes.map(siteClassKey).join('.');
      let entry = chains.get(chainKey);
      if (!entry) {
        entry = { classes: c.classes, decls: new Map() };
        chains.set(chainKey, entry);
      }
      let decls = entry.decls.get(key);
      if (!decls) {
        decls = new Map();
        entry.decls.set(key, decls);
      }
      for (const d of rule.declarations) {
        if (d.property.startsWith('--')) continue;
        const prepared = prepareDeclaration(d);
        if (prepared.kind !== 'native') continue;
        for (const n of prepared.decls) {
          decls.delete(n.property);
          decls.set(n.property, n.value);
        }
      }
    }
  }

  const toStyleLess = (decls: Map<string, string> | undefined) =>
    sortDeclarations([...(decls ?? new Map<string, string>())].map(([property, value]) => ({ property, value })))
      .map((d) => `${d.property}: ${d.value};`)
      .join(' ');
  const byKey = new Map<string, LibraryClass>();
  const ensure = (chain: string[]): LibraryClass => {
    const key = chain.map(siteClassKey).join('.');
    let cls = byKey.get(key);
    if (cls) return cls;
    cls = { id: `${REFERENCE_STYLE_PREFIX}${key}`, name: chain[chain.length - 1]!, comb: chain.length > 1 ? '&' : '', styleLess: '', variants: {}, children: [] };
    byKey.set(key, cls);
    if (chain.length > 1) {
      const parent = ensure(chain.slice(0, -1));
      if (!parent.children.includes(cls.id)) parent.children.push(cls.id);
    }
    return cls;
  };
  for (const { classes, decls } of chains.values()) {
    const cls = ensure(classes);
    cls.styleLess = toStyleLess(decls.get(''));
    const keys = [...decls.keys()].filter((k) => k !== '').sort((a, b) => variantRank(a) - variantRank(b) || a.localeCompare(b));
    for (const k of keys) {
      const text = toStyleLess(decls.get(k));
      if (text) cls.variants[k] = text;
    }
  }
  const classes = [...byKey.values()];
  if (classes.length === 0) return { classes, variables: [...variables], skipped, error: 'No class rules found in this CSS.' };
  return { classes, variables: [...variables], skipped };
}

/* ------------------------------------------------------------------------------------------------
 * Library
 * ---------------------------------------------------------------------------------------------- */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "26 Oct 2026" in local time, the same in every browser language. */
export function formatSourceDate(date: Date): string {
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/** Label of a source the user did not name: "26 Oct 2026 · 142 classes". */
export function defaultSourceLabel(date: Date, classCount: number): string {
  return `${formatSourceDate(date)} · ${classCount} class${classCount === 1 ? '' : 'es'}`;
}

/** True for a class read from CSS (a reference class, not a Designer copy). */
export function isCssClass(c: Pick<LibraryClass, 'id'>): boolean {
  return isReferenceStyle({ _id: c.id });
}

/** Base classes (combos not counted) of a list. */
export function baseClassCount(classes: readonly Pick<LibraryClass, 'comb'>[]): number {
  return classes.filter((c) => c.comb === '').length;
}

/**
 * Adds a source. Its classes join the library by id: one the library has already (the same class
 * copied from another page) is replaced by the newer copy, keeping the combo children of both.
 */
export function addLibrarySource(
  lib: StyleLibrary,
  input: LibraryInput & { kind: LibrarySourceKind; label?: string; url?: string },
  now = new Date(),
): { library: StyleLibrary; source: LibrarySource } {
  const classes = new Map(lib.classes);
  for (const c of input.classes) {
    const prev = classes.get(c.id);
    classes.set(c.id, prev ? { ...c, children: [...new Set([...prev.children, ...c.children])] } : c);
  }
  const label = (input.label ?? '').trim().replace(/\s+/g, ' ') || defaultSourceLabel(now, baseClassCount(input.classes));
  let id = `src-${now.getTime().toString(36)}`;
  for (let n = 2; lib.sources.some((s) => s.id === id); n++) id = `src-${now.getTime().toString(36)}-${n}`;
  const source: LibrarySource = {
    id,
    label,
    kind: input.kind,
    addedAt: now.toISOString(),
    classIds: [...new Set(input.classes.map((c) => c.id))],
    variables: [...new Set(input.variables)],
  };
  if (input.url) source.url = input.url;
  return { library: { sources: [...lib.sources, source], classes }, source };
}

/** Removes a source and every class no other source has. */
export function removeLibrarySource(lib: StyleLibrary, id: string): StyleLibrary {
  const sources = lib.sources.filter((s) => s.id !== id);
  if (sources.length === lib.sources.length) return lib;
  const keep = new Set(sources.flatMap((s) => s.classIds));
  const classes = new Map([...lib.classes].filter(([cid]) => keep.has(cid)));
  for (const [cid, c] of classes) {
    const children = c.children.filter((ch) => keep.has(ch) || !lib.classes.has(ch));
    if (children.length !== c.children.length) classes.set(cid, { ...c, children });
  }
  return { sources, classes };
}

/** Renames a source; an empty label goes back to the default one. */
export function renameLibrarySource(lib: StyleLibrary, id: string, label: string): StyleLibrary {
  return {
    ...lib,
    sources: lib.sources.map((s) => {
      if (s.id !== id) return s;
      const clean = label.trim().replace(/\s+/g, ' ');
      return { ...s, label: clean || defaultSourceLabel(new Date(s.addedAt), baseClassCount(s.classIds.map((c) => lib.classes.get(c)).filter((c) => c !== undefined))) };
    }),
  };
}

/** Classes of one source (those still in the library). */
export function sourceClasses(lib: StyleLibrary, source: LibrarySource): LibraryClass[] {
  return source.classIds.map((id) => lib.classes.get(id)).filter((c): c is LibraryClass => c !== undefined);
}

/** Variable names of every source. */
export function libraryVariables(lib: StyleLibrary): string[] {
  return [...new Set(lib.sources.flatMap((s) => s.variables))];
}

/**
 * The library as `ConvertOptions.siteStyles`: Designer classes as the style objects that were
 * copied, then the reference classes read from CSS.
 */
export function librarySiteStyles(lib: StyleLibrary): WfStyle[] {
  const styles = [...lib.classes.values()].map(libraryClassToStyle);
  return [...styles.filter((s) => !isReferenceStyle(s)), ...styles.filter((s) => isReferenceStyle(s))];
}

/* ------------------------------------------------------------------------------------------------
 * Analysis
 * ---------------------------------------------------------------------------------------------- */

const BREAKPOINT_ORDER = ['main', 'medium', 'small', 'tiny', 'large', 'xl', 'xxl'];

function variantRank(key: string): number {
  const i = BREAKPOINT_ORDER.indexOf(key.split('_')[0] ?? '');
  return (i < 0 ? BREAKPOINT_ORDER.length : i) * 2 + (key.includes('_') ? 1 : 0);
}

/**
 * Utility vs custom classes (Client-First, ./clientFirst), combos with their parent, variables,
 * breakpoints and states in use, and classes Webflow numbered (`button 2`: the site already has
 * a duplicate, a warning). A name the library has both from a Designer copy and from CSS counts once.
 */
export function analyzeClasses(classes: readonly LibraryClass[], variables: readonly string[] = []): StyleGuideAnalysis {
  const parentOf = new Map<string, string>();
  for (const c of classes) for (const ch of c.children) parentOf.set(ch, c.name);
  // Designer classes first, so a CSS copy of the same name does not count twice.
  const ordered = [...classes].sort((a, b) => Number(isCssClass(a)) - Number(isCssClass(b)));
  const seenBase = new Set<string>();
  const seenCombo = new Set<string>();
  const utilities: string[] = [];
  const custom: string[] = [];
  const combos: { name: string; parent: string | null }[] = [];
  const breakpoints = new Set<string>();
  const states = new Set<string>();
  const vars = new Set(variables);
  let fromCss = 0;
  for (const c of ordered) {
    if (c.comb === '&') {
      const parent = parentOf.get(c.id) ?? null;
      const key = `${parent ? siteClassKey(parent) : ''}\u0001${siteClassKey(c.name)}`;
      if (seenCombo.has(key)) continue;
      seenCombo.add(key);
      combos.push({ name: c.name, parent });
    } else {
      const key = siteClassKey(c.name);
      if (seenBase.has(key)) continue;
      seenBase.add(key);
      (isClientFirstUtility(splitDuplicateSuffix(c.name).base) ? utilities : custom).push(c.name);
    }
    if (isCssClass(c)) fromCss++;
    if (parseStyleLess(c.styleLess).size > 0) breakpoints.add('main');
    for (const [key, text] of Object.entries(c.variants)) {
      if (parseStyleLess(text).size === 0) continue;
      const [bp, ...rest] = key.split('_');
      if (bp) breakpoints.add(bp);
      for (const s of rest) states.add(s);
    }
    for (const v of styleVariableRefs(c)) vars.add(v);
  }
  const baseNames = new Set([...seenBase]);
  const duplicates: StyleGuideAnalysis['duplicates'] = [];
  for (const name of [...utilities, ...custom]) {
    const { base, n } = splitDuplicateSuffix(name);
    if (n >= 2) duplicates.push({ name, base, baseExists: baseNames.has(siteClassKey(base)) });
  }
  duplicates.sort((x, y) => x.name.localeCompare(y.name));
  const byName = (a: string, b: string) => a.localeCompare(b);
  return {
    classCount: utilities.length + custom.length,
    utilities: utilities.sort(byName),
    custom: custom.sort(byName),
    combos: combos.sort((a, b) => a.name.localeCompare(b.name) || (a.parent ?? '').localeCompare(b.parent ?? '')),
    variables: [...vars].sort(byName),
    breakpoints: BREAKPOINT_ORDER.filter((b) => breakpoints.has(b)).concat([...breakpoints].filter((b) => !BREAKPOINT_ORDER.includes(b))),
    states: [...states].sort(byName),
    duplicates,
    fromCss,
  };
}

/** {@link analyzeClasses} of the whole library. */
export function analyzeLibrary(lib: StyleLibrary): StyleGuideAnalysis {
  return analyzeClasses([...lib.classes.values()], libraryVariables(lib));
}

/* ------------------------------------------------------------------------------------------------
 * Compact storage form
 * ---------------------------------------------------------------------------------------------- */

/** Stored class: short keys, empty fields left out. */
interface StoredClass {
  i: string;
  n: string;
  c?: 1;
  s?: string;
  v?: Record<string, string>;
  ch?: string[];
  x?: Record<string, unknown>;
}

interface StoredSource {
  id: string;
  label: string;
  kind: LibrarySourceKind;
  at: string;
  url?: string;
  ids: string[];
  vars?: string[];
}

/** Version of the stored form. */
export const LIBRARY_FORMAT = 2;

/** The library as compact JSON-safe data (see the module comment). */
export function serializeLibrary(lib: StyleLibrary): { v: number; sources: StoredSource[]; classes: StoredClass[] } {
  const classes: StoredClass[] = [];
  for (const c of lib.classes.values()) {
    const o: StoredClass = { i: c.id, n: c.name };
    if (c.comb === '&') o.c = 1;
    if (c.styleLess) o.s = c.styleLess;
    if (Object.keys(c.variants).length) o.v = c.variants;
    if (c.children.length) o.ch = c.children;
    if (c.extra && Object.keys(c.extra).length) o.x = c.extra;
    classes.push(o);
  }
  const sources = lib.sources.map((s) => {
    const o: StoredSource = { id: s.id, label: s.label, kind: s.kind, at: s.addedAt, ids: s.classIds };
    if (s.url) o.url = s.url;
    if (s.variables.length) o.vars = s.variables;
    return o;
  });
  return { v: LIBRARY_FORMAT, sources, classes };
}

const KINDS: readonly LibrarySourceKind[] = ['designer', 'css-url', 'css-text'];
const isStr = (v: unknown): v is string => typeof v === 'string';
const strList = (v: unknown): string[] => (Array.isArray(v) ? v.filter(isStr) : []);

/** Reads {@link serializeLibrary} output back; anything malformed is dropped, never thrown. */
export function deserializeLibrary(raw: unknown): StyleLibrary {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const classes = new Map<string, LibraryClass>();
  if (Array.isArray(o.classes)) {
    for (const item of o.classes) {
      if (!item || typeof item !== 'object') continue;
      const c = item as Record<string, unknown>;
      if (!isStr(c.i) || !c.i.trim() || !isStr(c.n) || !c.n.trim()) continue;
      const variants: Record<string, string> = {};
      if (c.v && typeof c.v === 'object' && !Array.isArray(c.v)) for (const [k, v] of Object.entries(c.v)) if (isStr(v)) variants[k] = v;
      const cls: LibraryClass = { id: c.i, name: c.n, comb: c.c === 1 ? '&' : '', styleLess: isStr(c.s) ? c.s : '', variants, children: strList(c.ch) };
      if (c.x && typeof c.x === 'object' && !Array.isArray(c.x)) cls.extra = c.x as Record<string, unknown>;
      classes.set(cls.id, cls);
    }
  }
  const sources: LibrarySource[] = [];
  if (Array.isArray(o.sources)) {
    for (const item of o.sources) {
      if (!item || typeof item !== 'object') continue;
      const s = item as Record<string, unknown>;
      if (!isStr(s.id) || !isStr(s.label) || !KINDS.includes(s.kind as LibrarySourceKind)) continue;
      const classIds = strList(s.ids).filter((id) => classes.has(id));
      if (classIds.length === 0 || sources.some((x) => x.id === s.id)) continue;
      const source: LibrarySource = { id: s.id, label: s.label, kind: s.kind as LibrarySourceKind, addedAt: isStr(s.at) ? s.at : '', classIds, variables: strList(s.vars) };
      if (isStr(s.url)) source.url = s.url;
      sources.push(source);
    }
  }
  // Classes no source lists are leftovers of a partial write: drop them.
  const listed = new Set(sources.flatMap((s) => s.classIds));
  for (const id of [...classes.keys()]) if (!listed.has(id)) classes.delete(id);
  return { sources, classes };
}
