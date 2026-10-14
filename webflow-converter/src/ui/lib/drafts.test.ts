import { describe, expect, it } from 'vitest';
import { buildConvertInput, EMPTY_DRAFTS, hasConvertibleInput, loadPersisted, savePersisted, STORAGE_KEY, type Drafts } from './drafts';

const drafts: Drafts = {
  combined: { html: '<div class="a">combined</div>' },
  separate: { html: '<div class="b"></div>', css: '.b{color:red}', js: 'console.log(1)' },
};

/** Minimal in-memory Storage. */
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

describe('buildConvertInput', () => {
  it('uses only the combined draft in combined mode', () => {
    expect(buildConvertInput('combined', drafts)).toEqual({ mode: 'combined', html: drafts.combined.html });
  });

  it('uses the three separate editors in separate mode', () => {
    expect(buildConvertInput('separate', drafts)).toEqual({ mode: 'separate', ...drafts.separate });
  });
});

describe('hasConvertibleInput', () => {
  it('is false for empty or whitespace-only input', () => {
    expect(hasConvertibleInput('combined', EMPTY_DRAFTS)).toBe(false);
    expect(hasConvertibleInput('separate', { ...EMPTY_DRAFTS, separate: { html: '  ', css: '\n', js: '\t' } })).toBe(false);
  });

  it('checks only the active tab', () => {
    const onlyCombined: Drafts = { ...EMPTY_DRAFTS, combined: { html: '<p>x</p>' } };
    expect(hasConvertibleInput('combined', onlyCombined)).toBe(true);
    expect(hasConvertibleInput('separate', onlyCombined)).toBe(false);
  });

  it('accepts CSS-only or JS-only separate input', () => {
    expect(hasConvertibleInput('separate', { ...EMPTY_DRAFTS, separate: { html: '', css: '.a{}', js: '' } })).toBe(true);
    expect(hasConvertibleInput('separate', { ...EMPTY_DRAFTS, separate: { html: '', css: '', js: 'x()' } })).toBe(true);
  });
});

describe('persistence', () => {
  it('round-trips mode and drafts', () => {
    const s = memoryStorage();
    expect(savePersisted({ mode: 'separate', drafts }, s)).toBe(true);
    expect(loadPersisted(s)).toEqual({ mode: 'separate', drafts });
  });

  it('returns null for missing or corrupt data', () => {
    expect(loadPersisted(memoryStorage())).toBeNull();
    expect(loadPersisted(memoryStorage({ [STORAGE_KEY]: '{not json' }))).toBeNull();
    expect(loadPersisted(null)).toBeNull();
  });

  it('fills missing fields with empty strings', () => {
    const s = memoryStorage({ [STORAGE_KEY]: JSON.stringify({ mode: 'weird', drafts: { separate: { css: '.a{}' , js: 5 } } }) });
    expect(loadPersisted(s)).toEqual({ mode: 'combined', drafts: { combined: { html: '' }, separate: { html: '', css: '.a{}', js: '' } } });
  });

  it('never throws when storage throws', () => {
    const broken = memoryStorage();
    broken.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    broken.getItem = () => {
      throw new Error('SecurityError');
    };
    expect(savePersisted({ mode: 'combined', drafts }, broken)).toBe(false);
    expect(loadPersisted(broken)).toBeNull();
  });
});
