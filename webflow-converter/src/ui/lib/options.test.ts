import { describe, expect, it } from 'vitest';
import { countChanged, DEFAULT_ADVANCED, loadAdvanced, OPTIONS_STORAGE_KEY, sanitizeAdvanced, saveAdvanced, toConvertOptions } from './options';

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

const throwing: Storage = {
  length: 0,
  clear() {},
  key: () => null,
  removeItem() {},
  getItem() {
    throw new Error('blocked');
  },
  setItem() {
    throw new Error('quota');
  },
};

describe('advanced options', () => {
  it('defaults match the engine defaults', () => {
    expect(DEFAULT_ADVANCED).toEqual({ forms: 'auto', buttonMode: 'button', classPrefix: '', breakpointSnap: 'up', neutralizeDefaults: true, externalImages: 'customElement' });
  });

  it('round-trips through storage', () => {
    const storage = memoryStorage();
    const value = { ...DEFAULT_ADVANCED, forms: 'embed' as const, classPrefix: 'gi-' };
    expect(saveAdvanced(value, storage)).toBe(true);
    expect(loadAdvanced(storage)).toEqual(value);
  });

  it('falls back to defaults for corrupt data, unknown values and throwing storage', () => {
    expect(loadAdvanced(memoryStorage({ [OPTIONS_STORAGE_KEY]: '{not json' }))).toEqual(DEFAULT_ADVANCED);
    expect(sanitizeAdvanced({ forms: 'weird', buttonMode: 'customElement', neutralizeDefaults: 'yes' })).toEqual({ ...DEFAULT_ADVANCED, buttonMode: 'customElement' });
    expect(loadAdvanced(throwing)).toEqual(DEFAULT_ADVANCED);
    expect(saveAdvanced(DEFAULT_ADVANCED, throwing)).toBe(false);
    expect(loadAdvanced(null)).toEqual(DEFAULT_ADVANCED);
  });

  it('counts changes and trims the prefix for convert()', () => {
    const value = { ...DEFAULT_ADVANCED, classPrefix: '  gi- ', breakpointSnap: 'off' as const };
    expect(countChanged(value)).toBe(2);
    expect(countChanged({ ...DEFAULT_ADVANCED, classPrefix: '   ' })).toBe(0);
    expect(toConvertOptions(value).classPrefix).toBe('gi-');
  });
});
