import { toWebflowClassName } from '../../engine/classNames';
import { isClientFirstUtility } from '../../engine/clientFirst';
import { siteClassKey, splitDuplicateSuffix } from '../../engine/siteStyles';
import type { WfStyle } from '../../engine/types';
import { getStorage } from './drafts';

/**
 * "These classes probably exist in your Webflow site already" — the warning shown before the
 * copy (spec 3.6). Without an import of the site's styles the converter cannot know the site's
 * classes, but two kinds are likely there: Client-First utilities (`padding-global`,
 * `container-large`…), and classes this browser already copied to Webflow in an earlier
 * conversion (repeated test pastes into one site; GreenIron v5 paste test: 239 "name 2" classes).
 * Webflow renames a pasted class to "name 2" when the site has the name with different styles.
 *
 * Every storage access is wrapped in try/catch: without storage the history is just empty.
 *
 * Ownership: ui.
 */

export const COPIED_CLASSES_KEY = 'wf-converter:copied-classes:v1';
const MAX_HISTORY = 4000;

/** Base classes copied in earlier conversions: name -> signature of the styles copied (oldest first). */
export type CopiedClasses = Map<string, string>;

/** Signature of a style's declarations (FNV-1a of `styleLess` + `variants`). */
export function styleSignature(style: Pick<WfStyle, 'styleLess' | 'variants'>): string {
  const text = `${style.styleLess ?? ''}\u0001${JSON.stringify(style.variants ?? {})}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(36);
}

/** Reads the history; empty when nothing is stored, the data is corrupt, or storage throws. */
export function loadCopiedClasses(storage: Storage | null = getStorage()): CopiedClasses {
  const out: CopiedClasses = new Map();
  if (!storage) return out;
  try {
    const raw = JSON.parse(storage.getItem(COPIED_CLASSES_KEY) ?? '[]') as unknown;
    if (Array.isArray(raw)) for (const e of raw) if (Array.isArray(e) && typeof e[0] === 'string' && typeof e[1] === 'string') out.set(e[0], e[1]);
  } catch {
    /* empty history */
  }
  return out;
}

/** Adds the base classes of a copied payload to the history. Returns the new history. */
export function recordCopiedClasses(styles: readonly Pick<WfStyle, 'name' | 'comb' | 'styleLess' | 'variants'>[], storage: Storage | null = getStorage()): CopiedClasses {
  const next = loadCopiedClasses(storage);
  for (const s of styles) {
    if ((s.comb ?? '') !== '') continue;
    next.delete(s.name);
    next.set(s.name, styleSignature(s));
  }
  const entries = [...next].slice(-MAX_HISTORY);
  if (storage) {
    try {
      storage.setItem(COPIED_CLASSES_KEY, JSON.stringify(entries));
    } catch {
      /* quota / private mode: the history lasts for this page only */
    }
  }
  return new Map(entries);
}

/**
 * Base classes of a result that this browser copied before with DIFFERENT styles: pasted into the
 * same site, Webflow creates "name 2" for each (unless the site styles import covers them).
 */
export function changedSinceCopied(styles: readonly Pick<WfStyle, 'name' | 'comb' | 'styleLess' | 'variants'>[], copied: CopiedClasses, reused: ReadonlySet<string> = new Set()): string[] {
  const out: string[] = [];
  for (const s of styles) {
    if ((s.comb ?? '') !== '' || reused.has(s.name)) continue;
    const sig = copied.get(s.name);
    if (sig !== undefined && sig !== styleSignature(s)) out.push(s.name);
  }
  return out;
}

/** Class names used in `class="…"` attributes, in the form Webflow publishes (first use order). */
export function inputClassNames(html: string): string[] {
  const out = new Set<string>();
  for (const m of html.matchAll(/\sclass\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
    for (const c of (m[1] ?? m[2] ?? '').split(/\s+/)) if (c) out.add(toWebflowClassName(c));
  }
  out.delete('');
  return [...out];
}

/** Result of {@link duplicateRisk}. */
export interface DuplicateRisk {
  /** Classes likely to exist in the site that the import does not cover (all of them without one). */
  likely: string[];
  /** Of `likely`: copied to Webflow from this browser before. */
  copiedBefore: string[];
  /** Of `likely`: Client-First utility / core classes. */
  utilities: string[];
}

/**
 * Which of the input's classes probably exist in the destination site, minus those the imported
 * site styles cover (a covered class is pasted as the site's own style and never becomes "name 2").
 */
export function duplicateRisk(names: readonly string[], copied: Iterable<string>, siteStyles: readonly Pick<WfStyle, 'name' | 'comb'>[] = []): DuplicateRisk {
  const covered = new Set(siteStyles.filter((s) => (s.comb ?? '') === '').map((s) => siteClassKey(splitDuplicateSuffix(s.name).base)));
  const before = new Set([...copied].map((n) => siteClassKey(splitDuplicateSuffix(n).base)));
  const likely: string[] = [];
  const copiedBefore: string[] = [];
  const utilities: string[] = [];
  for (const name of names) {
    const key = siteClassKey(name);
    if (covered.has(key)) continue;
    const wasCopied = before.has(key);
    const utility = isClientFirstUtility(name);
    if (!wasCopied && !utility) continue;
    likely.push(name);
    if (wasCopied) copiedBefore.push(name);
    if (utility) utilities.push(name);
  }
  return { likely, copiedBefore, utilities };
}
