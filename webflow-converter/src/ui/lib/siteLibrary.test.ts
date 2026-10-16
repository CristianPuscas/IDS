import { describe, expect, it } from 'vitest';
import SITE_COPY from '../../engine/__fixtures__/client-first-site-copy.json?raw';
import { parseSiteStyles } from '../../engine/siteStyles';
import { activeSite, classCount, importIntoLibrary, loadSiteLibrary, readClipboardPayload, removeFromLibrary, saveSiteLibrary, SITE_LIBRARY_KEY } from './siteLibrary';

function memoryStorage(init: Record<string, string> = {}): Storage {
  const m = new Map(Object.entries(init));
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}

const throwing = {
  getItem() {
    throw new Error('blocked');
  },
  setItem() {
    throw new Error('quota');
  },
} as unknown as Storage;

const STYLES = parseSiteStyles(SITE_COPY).styles;

describe('site library', () => {
  it('imports, merges into the same label, replaces, and round-trips through storage', () => {
    let lib = importIntoLibrary({ sites: [], activeId: null }, 'My site', STYLES.slice(0, 2));
    expect(classCount(activeSite(lib)!)).toBe(2);
    lib = importIntoLibrary(lib, ' my  SITE ', STYLES.slice(1));
    expect(lib.sites).toHaveLength(1);
    expect(classCount(activeSite(lib)!)).toBe(4); // 4 base classes, 2 combos
    expect(activeSite(lib)!.styles).toHaveLength(6);
    lib = importIntoLibrary(lib, 'Other', STYLES.slice(0, 1));
    expect(lib.sites).toHaveLength(2);
    expect(activeSite(lib)!.label).toBe('Other');
    lib = importIntoLibrary(lib, 'my site', STYLES.slice(0, 1), 'replace');
    expect(activeSite(lib)!.styles).toHaveLength(1);

    const storage = memoryStorage();
    expect(saveSiteLibrary(lib, storage)).toBe(true);
    expect(loadSiteLibrary(storage)).toEqual(lib);
    lib = removeFromLibrary(lib, lib.activeId!);
    expect(lib.activeId).toBeNull();
    expect(lib.sites).toHaveLength(1);
  });

  it('survives corrupt data and throwing storage', () => {
    expect(loadSiteLibrary(memoryStorage({ [SITE_LIBRARY_KEY]: '{nope' }))).toEqual({ sites: [], activeId: null });
    expect(loadSiteLibrary(memoryStorage({ [SITE_LIBRARY_KEY]: '{"sites":[{"id":"a","label":"x","styles":[1]}],"activeId":"a"}' }))).toEqual({ sites: [], activeId: null });
    expect(loadSiteLibrary(throwing)).toEqual({ sites: [], activeId: null });
    expect(saveSiteLibrary({ sites: [], activeId: null }, throwing)).toBe(false);
    expect(loadSiteLibrary(null)).toEqual({ sites: [], activeId: null });
  });

  it('reads application/json first, then text/plain', () => {
    const dt = (types: Record<string, string>) => ({ getData: (t: string) => types[t] ?? '' });
    expect(readClipboardPayload(dt({ 'application/json': '{"a":1}', 'text/plain': 'x' }))).toBe('{"a":1}');
    expect(readClipboardPayload(dt({ 'text/plain': '{"b":2}' }))).toBe('{"b":2}');
    expect(readClipboardPayload(null)).toBe('');
  });
});
