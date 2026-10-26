import { describe, expect, it } from 'vitest';
import type { WfStyle } from '../../engine/types';
import { changedSinceCopied, COPIED_CLASSES_KEY, duplicateRisk, inputClassNames, loadCopiedClasses, recordCopiedClasses } from './duplicateRisk';

function memoryStorage(): Storage {
  const m = new Map<string, string>();
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

const style = (name: string, styleLess: string, comb: '' | '&' = ''): WfStyle => ({ _id: name, fake: false, type: 'class', name, namespace: '', comb, styleLess, variants: {}, children: [], selector: null });

describe('duplicate risk before the copy', () => {
  it('reads class names from the input in the form Webflow publishes', () => {
    expect(inputClassNames('<div class="padding-global  heroTitle"><a class=\'button is-small\'></a><p data-class="x"></p></div>')).toEqual(['padding-global', 'herotitle', 'button', 'is-small']);
  });

  it('flags Client-First utilities and classes copied before, minus what the site import covers', () => {
    const names = ['padding-global', 'container-large', 'nav_component', 'hero_title'];
    expect(duplicateRisk(names, [])).toEqual({ likely: ['padding-global', 'container-large'], copiedBefore: [], utilities: ['padding-global', 'container-large'] });
    const r = duplicateRisk(names, ['nav_component'], [style('padding-global 5', '')]);
    expect(r.likely).toEqual(['container-large', 'nav_component']);
    expect(r.copiedBefore).toEqual(['nav_component']);
  });

  it('remembers copied classes with their styles and reports the ones that changed', () => {
    const storage = memoryStorage();
    expect(loadCopiedClasses(storage).size).toBe(0);
    recordCopiedClasses([style('nav_component', 'position: fixed;'), style('is-open', 'opacity: 1;', '&')], storage);
    const copied = loadCopiedClasses(storage);
    expect([...copied.keys()]).toEqual(['nav_component']);
    expect(changedSinceCopied([style('nav_component', 'position: fixed;')], copied)).toEqual([]);
    expect(changedSinceCopied([style('nav_component', 'position: sticky;')], copied)).toEqual(['nav_component']);
    expect(changedSinceCopied([style('nav_component', 'position: sticky;')], copied, new Set(['nav_component']))).toEqual([]);
    storage.setItem(COPIED_CLASSES_KEY, '{bad');
    expect(loadCopiedClasses(storage).size).toBe(0);
  });
});
