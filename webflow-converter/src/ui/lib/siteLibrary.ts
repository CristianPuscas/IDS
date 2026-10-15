import type { WfStyle } from '../../engine/types';
import { mergeSiteStyles, parseSiteStyles } from '../../engine/siteStyles';
import { getStorage } from './drafts';

/**
 * Imported site styles ("Reuse classes from your Webflow site"), kept in localStorage so they
 * survive reloads. Several sites can be stored; one (or none) is active and is passed to
 * `convert()` as `siteStyles`. Every storage access is wrapped in try/catch: private windows and
 * full quotas just mean the import lasts for this page only.
 *
 * Ownership: ui.
 */

/** One imported site. */
export interface SiteEntry {
  id: string;
  /** User-given label, e.g. "My site". */
  label: string;
  /** Class styles copied from the Designer, verbatim. */
  styles: WfStyle[];
  /** ISO time of the last import. */
  updatedAt: string;
}

/** All imported sites plus the active one. */
export interface SiteLibrary {
  sites: SiteEntry[];
  /** Id of the site whose classes are reused, or `null` for none. */
  activeId: string | null;
}

export const SITE_LIBRARY_KEY = 'wf-converter:site-styles:v1';
export const EMPTY_LIBRARY: SiteLibrary = Object.freeze({ sites: [], activeId: null }) as SiteLibrary;

/** Reads the library; empty when nothing is stored, the data is corrupt, or storage throws. */
export function loadSiteLibrary(storage: Storage | null = getStorage()): SiteLibrary {
  if (!storage) return { sites: [], activeId: null };
  try {
    const raw = storage.getItem(SITE_LIBRARY_KEY);
    if (!raw) return { sites: [], activeId: null };
    return sanitizeLibrary(JSON.parse(raw));
  } catch {
    return { sites: [], activeId: null };
  }
}

/** Saves the library. Returns `false` when storage is unavailable or full. */
export function saveSiteLibrary(lib: SiteLibrary, storage: Storage | null = getStorage()): boolean {
  if (!storage) return false;
  try {
    storage.setItem(SITE_LIBRARY_KEY, JSON.stringify(lib));
    return true;
  } catch {
    return false;
  }
}

function sanitizeLibrary(raw: unknown): SiteLibrary {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const sites: SiteEntry[] = [];
  if (Array.isArray(o.sites)) {
    for (const s of o.sites as Record<string, unknown>[]) {
      if (!s || typeof s.id !== 'string' || typeof s.label !== 'string' || !Array.isArray(s.styles)) continue;
      const styles = parseSiteStyles(JSON.stringify(s.styles)).styles;
      if (styles.length === 0) continue;
      sites.push({ id: s.id, label: s.label, styles, updatedAt: typeof s.updatedAt === 'string' ? s.updatedAt : '' });
    }
  }
  const activeId = typeof o.activeId === 'string' && sites.some((s) => s.id === o.activeId) ? o.activeId : null;
  return { sites, activeId };
}

/** Normalised label used to find an existing site ("My Site " = "my site"). */
const labelKey = (label: string) => label.trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * Adds styles to the site called `label` (created when new) and makes it active. `mode: 'merge'`
 * (default) adds to the classes already imported for that site (several copies of different
 * sections); `'replace'` starts over.
 */
export function importIntoLibrary(lib: SiteLibrary, label: string, styles: WfStyle[], mode: 'merge' | 'replace' = 'merge', now = new Date()): SiteLibrary {
  const name = label.trim().replace(/\s+/g, ' ') || 'My site';
  const existing = lib.sites.find((s) => labelKey(s.label) === labelKey(name));
  const updatedAt = now.toISOString();
  if (existing) {
    const next: SiteEntry = { ...existing, label: name, styles: mode === 'replace' ? mergeSiteStyles(styles) : mergeSiteStyles(existing.styles, styles), updatedAt };
    return { sites: lib.sites.map((s) => (s.id === existing.id ? next : s)), activeId: existing.id };
  }
  const id = `site-${now.getTime().toString(36)}-${lib.sites.length}`;
  return { sites: [...lib.sites, { id, label: name, styles: mergeSiteStyles(styles), updatedAt }], activeId: id };
}

/** Removes a site; the active one falls back to none. */
export function removeFromLibrary(lib: SiteLibrary, id: string): SiteLibrary {
  return { sites: lib.sites.filter((s) => s.id !== id), activeId: lib.activeId === id ? null : lib.activeId };
}

/** The active site, if any. */
export function activeSite(lib: SiteLibrary): SiteEntry | null {
  return lib.sites.find((s) => s.id === lib.activeId) ?? null;
}

/** Number of base classes (combos not counted), the "142 classes" in the status line. */
export function classCount(entry: SiteEntry): number {
  return entry.styles.filter((s) => (s.comb ?? '') === '').length;
}

/**
 * Reads Webflow clipboard data from a paste event: the Designer puts it in `application/json`;
 * `text/plain` is the fallback (a JSON file or a dump pasted as text).
 */
export function readClipboardPayload(data: Pick<DataTransfer, 'getData'> | null): string {
  if (!data) return '';
  let json = '';
  try {
    json = data.getData('application/json');
  } catch {
    json = '';
  }
  if (json.trim()) return json;
  try {
    return data.getData('text/plain');
  } catch {
    return '';
  }
}
