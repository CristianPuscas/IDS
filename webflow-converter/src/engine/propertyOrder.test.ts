import { describe, expect, it } from 'vitest';
import { CANONICAL_PROPERTY_ORDER, sortDeclarations } from './propertyOrder';
import { toStyleLess } from './styleMapper';

const decls = (text: string) => text.split(';').map((d) => d.trim()).filter(Boolean).map((d) => ({ property: d.split(':')[0]!.trim(), value: d.slice(d.indexOf(':') + 1).trim() }));

describe('Webflow canonical declaration order', () => {
  it('has no duplicates', () => {
    expect(new Set(CANONICAL_PROPERTY_ORDER).size).toBe(CANONICAL_PROPERTY_ORDER.length);
  });

  // Source order (what v5 emitted) -> what Webflow stored and published (Data API, GreenIron v5 test site).
  it.each([
    ['position: fixed; top: 0; left: 0; right: 0; z-index: 100;', 'position: fixed; left: 0; top: 0; right: 0; z-index: 100;'],
    ['padding-left: 2.5rem; padding-right: 2.5rem; box-sizing: border-box;', 'box-sizing: border-box; padding-right: 2.5rem; padding-left: 2.5rem;'],
    [
      'position: relative; overflow: hidden; padding-top: 2.5rem; padding-bottom: 2.5rem; background-color: #04140c; box-sizing: border-box;',
      'position: relative; overflow: hidden; box-sizing: border-box; padding-top: 2.5rem; padding-bottom: 2.5rem; background-color: #04140c;',
    ],
    [
      'margin-top: 0; margin-right: 0; margin-bottom: 0; margin-left: 0; max-width: 32rem; font-size: 1rem; line-height: 1.6; color: #b9e6ca;',
      'max-width: 32rem; margin-top: 0; margin-right: 0; margin-bottom: 0; margin-left: 0; color: #b9e6ca; font-size: 1rem; line-height: 1.6;',
    ],
    [
      'position: relative; min-height: 100vh; overflow-x: clip; background-color: #04140c; color: #b9e6ca; font-family: "Inter", Arial, sans-serif; font-size: 1rem; line-height: 1.6;',
      'position: relative; overflow-x: clip; min-height: 100vh; background-color: #04140c; font-family: "Inter", Arial, sans-serif; color: #b9e6ca; font-size: 1rem; line-height: 1.6;',
    ],
    ['transform: translateY(0); outline-width: 2px; outline-style: solid; outline-color: #b8ffd6; outline-offset: 0.25rem;', 'outline-color: #b8ffd6; outline-offset: 0.25rem; outline-style: solid; outline-width: 2px; transform: translateY(0);'],
    [
      'border-top-left-radius: 1rem; border-top-right-radius: 1rem; border-bottom-right-radius: 1rem; border-bottom-left-radius: 1rem;',
      'border-top-left-radius: 1rem; border-top-right-radius: 1rem; border-bottom-left-radius: 1rem; border-bottom-right-radius: 1rem;',
    ],
  ])('%s', (source, stored) => {
    expect(toStyleLess(decls(source))).toBe(stored);
  });

  it('keeps unlisted properties after the listed ones, in their own order', () => {
    expect(sortDeclarations(decls('zoom: 2; color: red; caret-color: blue; display: block')).map((d) => d.property)).toEqual(['display', 'color', 'zoom', 'caret-color']);
  });
});
