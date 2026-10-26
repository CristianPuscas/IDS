import { describe, expect, it } from 'vitest';
import { countChanged, DEFAULT_ADVANCED, loadAdvanced, OPTIONS_STORAGE_KEY, sanitizeAdvanced, saveAdvanced, SITE_POLICY_VERSION, toConvertOptions } from './options';

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
    expect(DEFAULT_ADVANCED).toEqual({
      forms: 'auto',
      buttonMode: 'button',
      classPrefix: '',
      clientFirstUtilities: 'keep',
      breakpointSnap: 'up',
      neutralizeDefaults: true,
      externalImages: 'customElement',
      siteClassConflicts: 'rename',
      cssVariables: 'inline',
      uniqueCombos: true,
      units: 'rem',
      skipClientFirstUtilityStyles: false,
      stableClassIds: true,
    });
  });

  it('resets a site-class choice saved before v8 to "Create a separate class"', () => {
    expect(sanitizeAdvanced({ siteClassOverrides: 'drop' }).siteClassConflicts).toBe('rename');
    expect(sanitizeAdvanced({ siteClassOverrides: 'drop', siteClassConflicts: 'reuse' }).siteClassConflicts).toBe('rename');
    expect(sanitizeAdvanced({ siteClassConflicts: 'reuse', sitePolicy: SITE_POLICY_VERSION }).siteClassConflicts).toBe('reuse');
    // A v8 save keeps the choice.
    const storage = memoryStorage();
    saveAdvanced({ ...DEFAULT_ADVANCED, siteClassConflicts: 'reuse' }, storage);
    expect(loadAdvanced(storage).siteClassConflicts).toBe('reuse');
  });

  it('maps "Use the site\'s class" to the site\'s styles as they are', () => {
    expect(toConvertOptions({ ...DEFAULT_ADVANCED, siteClassConflicts: 'reuse' })).toMatchObject({ siteClassConflicts: 'reuse', siteClassOverrides: 'drop' });
    expect(toConvertOptions(DEFAULT_ADVANCED)).toMatchObject({ siteClassConflicts: 'rename', cssVariables: 'inline', uniqueCombos: true, units: 'rem' });
  });

  it('keeps a valid units choice and falls back to rem for anything else', () => {
    expect(sanitizeAdvanced({ units: 'keep' }).units).toBe('keep');
    expect(sanitizeAdvanced({ units: 'px' }).units).toBe('rem');
    expect(sanitizeAdvanced({}).units).toBe('rem');
    expect(toConvertOptions({ ...DEFAULT_ADVANCED, units: 'keep' })).toMatchObject({ units: 'keep' });
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
