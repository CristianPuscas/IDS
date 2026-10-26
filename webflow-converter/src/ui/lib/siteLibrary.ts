import { parseSiteStyles } from '../../engine/siteStyles';
import { addLibrarySource, deserializeLibrary, EMPTY_STYLE_LIBRARY, serializeLibrary, stylesToLibraryClasses, type StyleLibrary } from '../../engine/styleLibrary';
import { getStorage } from './drafts';

/**
 * The style guide library ("1. Your site's style guide", ../../engine/styleLibrary) kept in
 * localStorage so it survives reloads, in its compact form only (never the pasted payload). Every
 * storage access is wrapped in try/catch: private windows and full quotas just mean the library
 * lasts for this page only, and the UI says so.
 *
 * Ownership: ui.
 */

/** What the app keeps: the library and whether conversions use it. */
export interface LibraryState {
  library: StyleLibrary;
  /** Use the library when converting. */
  enabled: boolean;
}

/** How a save went. */
export type SaveResult = 'saved' | 'quota' | 'unavailable';

export const STYLE_LIBRARY_KEY = 'wf-converter:style-library:v2';
/** Before the style guide step: several sites of verbatim styles, one active (migrated once). */
export const LEGACY_SITE_LIBRARY_KEY = 'wf-converter:site-styles:v1';

export const EMPTY_LIBRARY_STATE: LibraryState = Object.freeze({ library: EMPTY_STYLE_LIBRARY, enabled: true }) as LibraryState;

/** True for the error a full localStorage throws (named differently across browsers). */
export function isQuotaError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { name?: unknown; code?: unknown };
  return e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014;
}

/**
 * Reads the library; empty when nothing is stored, the data is corrupt, or storage throws. A
 * library saved by the older "Reuse classes from your Webflow site" import becomes one source per
 * site.
 */
export function loadStyleLibrary(storage: Storage | null = getStorage()): LibraryState {
  const empty = (): LibraryState => ({ library: { sources: [], classes: new Map() }, enabled: true });
  if (!storage) return empty();
  try {
    const raw = storage.getItem(STYLE_LIBRARY_KEY);
    if (raw) {
      const o = JSON.parse(raw) as { enabled?: unknown };
      return { library: deserializeLibrary(o), enabled: o.enabled !== false };
    }
    const legacy = storage.getItem(LEGACY_SITE_LIBRARY_KEY);
    return legacy ? migrateLegacy(JSON.parse(legacy)) : empty();
  } catch {
    return empty();
  }
}

function migrateLegacy(raw: unknown): LibraryState {
  let library: StyleLibrary = { sources: [], classes: new Map() };
  const o = raw && typeof raw === 'object' ? (raw as { sites?: unknown; activeId?: unknown }) : {};
  if (Array.isArray(o.sites)) {
    for (const site of o.sites as Record<string, unknown>[]) {
      if (!site || typeof site.label !== 'string' || !Array.isArray(site.styles)) continue;
      const styles = parseSiteStyles(JSON.stringify(site.styles)).styles;
      if (styles.length === 0) continue;
      const at = typeof site.updatedAt === 'string' && !Number.isNaN(Date.parse(site.updatedAt)) ? new Date(site.updatedAt) : new Date();
      library = addLibrarySource(library, { kind: 'designer', label: site.label, classes: stylesToLibraryClasses(styles), variables: [] }, at).library;
    }
  }
  // "None (don't reuse site classes)" was a choice too.
  return { library, enabled: o.activeId !== null || library.sources.length === 0 };
}

/**
 * Saves the library (compact form). On a full quota the old v1 import is removed (it held whole
 * style objects) and the save is tried once more. An empty library removes the key.
 */
export function saveStyleLibrary(state: LibraryState, storage: Storage | null = getStorage()): SaveResult {
  if (!storage) return 'unavailable';
  try {
    if (state.library.sources.length === 0) {
      storage.removeItem(STYLE_LIBRARY_KEY);
      storage.removeItem(LEGACY_SITE_LIBRARY_KEY);
      return 'saved';
    }
    const text = JSON.stringify({ ...serializeLibrary(state.library), enabled: state.enabled });
    try {
      storage.setItem(STYLE_LIBRARY_KEY, text);
    } catch (err) {
      if (!isQuotaError(err)) throw err;
      storage.removeItem(LEGACY_SITE_LIBRARY_KEY);
      storage.setItem(STYLE_LIBRARY_KEY, text);
    }
    storage.removeItem(LEGACY_SITE_LIBRARY_KEY);
    return 'saved';
  } catch (err) {
    return isQuotaError(err) ? 'quota' : 'unavailable';
  }
}

/** Size of the stored form in characters (what counts against the ~5 MB localStorage quota). */
export function storedSize(state: LibraryState): number {
  return JSON.stringify({ ...serializeLibrary(state.library), enabled: state.enabled }).length;
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
