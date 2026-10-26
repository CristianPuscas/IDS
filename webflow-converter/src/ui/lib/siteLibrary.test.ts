import { describe, expect, it } from 'vitest';
import SITE_COPY from '../../engine/__fixtures__/client-first-site-copy.json?raw';
import { parseSiteStyles } from '../../engine/siteStyles';
import { addLibrarySource, librarySiteStyles, stylesToLibraryClasses, type StyleLibrary } from '../../engine/styleLibrary';
import { isQuotaError, LEGACY_SITE_LIBRARY_KEY, loadStyleLibrary, readClipboardPayload, saveStyleLibrary, STYLE_LIBRARY_KEY, storedSize, type LibraryState } from './siteLibrary';

function memoryStorage(init: Record<string, string> = {}, quotaChars = Infinity): Storage & { map: Map<string, string> } {
  const m = new Map(Object.entries(init));
  const used = () => [...m].reduce((n, [k, v]) => n + k.length + v.length, 0);
  return {
    map: m,
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => {
      const next = used() - (m.get(k)?.length ?? 0) + String(v).length + (m.has(k) ? 0 : k.length);
      if (next > quotaChars) throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
      m.set(k, String(v));
    },
  };
}

const throwing = {
  getItem() {
    throw new Error('blocked');
  },
  setItem() {
    throw new Error('blocked');
  },
  removeItem() {
    throw new Error('blocked');
  },
} as unknown as Storage;

const STYLES = parseSiteStyles(SITE_COPY).styles;
const NOW = new Date(2026, 9, 26);
const library = (): StyleLibrary => addLibrarySource({ sources: [], classes: new Map() }, { kind: 'designer', label: 'Style guide', classes: stylesToLibraryClasses(STYLES), variables: ['v1'] }, NOW).library;

describe('style guide library storage', () => {
  it('round-trips the library and the enabled flag through storage, in compact form only', () => {
    const storage = memoryStorage();
    const state: LibraryState = { library: library(), enabled: false };
    expect(saveStyleLibrary(state, storage)).toBe('saved');
    const raw = storage.getItem(STYLE_LIBRARY_KEY)!;
    expect(raw).not.toContain('"payload"');
    expect(raw).not.toContain('"fake"');
    expect(raw.length).toBe(storedSize(state));
    const back = loadStyleLibrary(storage);
    expect(back).toEqual(state);
    expect(librarySiteStyles(back.library)).toEqual(STYLES);
  });

  it('an empty library removes the stored keys', () => {
    const storage = memoryStorage({ [STYLE_LIBRARY_KEY]: '{}', [LEGACY_SITE_LIBRARY_KEY]: '{}' });
    expect(saveStyleLibrary({ library: { sources: [], classes: new Map() }, enabled: true }, storage)).toBe('saved');
    expect(storage.length).toBe(0);
  });

  it('reports a full quota instead of throwing, and keeps what was stored before', () => {
    const storage = memoryStorage({ other: 'x'.repeat(100) }, 400);
    expect(saveStyleLibrary({ library: library(), enabled: true }, storage)).toBe('quota');
    expect(storage.getItem(STYLE_LIBRARY_KEY)).toBeNull();
    expect(storage.getItem('other')).toHaveLength(100);
  });

  it('frees the old v1 import when the quota is full, then saves', () => {
    const state: LibraryState = { library: library(), enabled: true };
    const size = storedSize(state) + STYLE_LIBRARY_KEY.length;
    const storage = memoryStorage({ [LEGACY_SITE_LIBRARY_KEY]: JSON.stringify({ sites: [], pad: 'x'.repeat(500) }) }, size + 50);
    expect(saveStyleLibrary(state, storage)).toBe('saved');
    expect(storage.getItem(LEGACY_SITE_LIBRARY_KEY)).toBeNull();
    expect(loadStyleLibrary(storage).library.sources).toHaveLength(1);
  });

  it('recognises quota errors across browsers', () => {
    expect(isQuotaError(new DOMException('x', 'QuotaExceededError'))).toBe(true);
    expect(isQuotaError({ name: 'NS_ERROR_DOM_QUOTA_REACHED' })).toBe(true);
    expect(isQuotaError({ code: 22 })).toBe(true);
    expect(isQuotaError(new Error('blocked'))).toBe(false);
    expect(isQuotaError(null)).toBe(false);
  });

  it('survives corrupt data, throwing storage and no storage', () => {
    const empty = { library: { sources: [], classes: new Map() }, enabled: true };
    expect(loadStyleLibrary(memoryStorage({ [STYLE_LIBRARY_KEY]: '{nope' }))).toEqual(empty);
    expect(loadStyleLibrary(memoryStorage({ [STYLE_LIBRARY_KEY]: '{"sources":[{"id":"a","label":"x","kind":"designer","ids":["z"]}],"classes":[1]}' }))).toEqual(empty);
    expect(loadStyleLibrary(throwing)).toEqual(empty);
    expect(saveStyleLibrary({ library: library(), enabled: true }, throwing)).toBe('unavailable');
    expect(loadStyleLibrary(null)).toEqual(empty);
    expect(saveStyleLibrary(empty, null)).toBe('unavailable');
  });

  it('migrates the older "Reuse classes from your Webflow site" import: one source per site', () => {
    const legacy = {
      sites: [
        { id: 'a', label: 'My site', styles: STYLES.slice(0, 2), updatedAt: '2026-10-20T10:00:00.000Z' },
        { id: 'b', label: 'Other', styles: STYLES.slice(3), updatedAt: 'bad' },
        { id: 'c', label: 'Broken', styles: [1, 2] },
      ],
      activeId: 'a',
    };
    const storage = memoryStorage({ [LEGACY_SITE_LIBRARY_KEY]: JSON.stringify(legacy) });
    const state = loadStyleLibrary(storage);
    expect(state.enabled).toBe(true);
    expect(state.library.sources.map((s) => s.label)).toEqual(['My site', 'Other']);
    expect(state.library.classes.size).toBe(5);
    // Saving the new form removes the old key.
    expect(saveStyleLibrary(state, storage)).toBe('saved');
    expect(storage.getItem(LEGACY_SITE_LIBRARY_KEY)).toBeNull();
    // "None" was selected: the library is kept but not used.
    expect(loadStyleLibrary(memoryStorage({ [LEGACY_SITE_LIBRARY_KEY]: JSON.stringify({ ...legacy, activeId: null }) })).enabled).toBe(false);
  });

  it('reads application/json first, then text/plain', () => {
    const dt = (types: Record<string, string>) => ({ getData: (t: string) => types[t] ?? '' });
    expect(readClipboardPayload(dt({ 'application/json': '{"a":1}', 'text/plain': 'x' }))).toBe('{"a":1}');
    expect(readClipboardPayload(dt({ 'text/plain': '{"b":2}' }))).toBe('{"b":2}');
    expect(readClipboardPayload(null)).toBe('');
  });
});
