import { describe, expect, it } from 'vitest';
import { classifySelector, isWebflowSafeClassName } from './selectors';

describe('classifySelector', () => {
  it.each([
    ['.card', ['card'], null, null],
    ['.card.is-active', ['card', 'is-active'], null, null],
    ['.btn:hover', ['btn'], null, 'hover'],
    ['.btn:active', ['btn'], null, 'active'],
    ['.btn:focus', ['btn'], null, 'focus'],
    ['.btn:focus-visible', ['btn'], null, 'focus-visible'],
    ['.link:visited', ['link'], null, 'visited'],
    ['.field::placeholder', ['field'], null, 'placeholder'],
    ['.nav_link.w--current', ['nav_link'], 'current', null],
    ['.dropdown.w--open:hover', ['dropdown'], 'open', 'hover'],
    ['.a:hover.b', ['a', 'b'], null, 'hover'],
  ])('%s is native', (sel, classes, webflowState, pseudo) => {
    const r = classifySelector(sel);
    expect(r).toMatchObject({ kind: 'native', classes, webflowState, pseudo });
  });

  it.each([
    ['.a .b', 'descendant-selector'],
    ['.a > .b', 'descendant-selector'],
    ['.a + .b', 'descendant-selector'],
    ['.a ~ .b', 'descendant-selector'],
    ['.a::before', 'pseudo-element'],
    ['.a:after', 'pseudo-element'],
    ['.a:nth-child(2)', 'unsupported-pseudo'],
    ['.a:not(.b)', 'unsupported-pseudo'],
    ['.a:focus-within', 'unsupported-pseudo'],
    ['.a:first-child', 'unsupported-pseudo'],
    ['.a:hover:focus', 'unsupported-pseudo'],
    ['#hero', 'id-selector'],
    ['.a#b', 'id-selector'],
    ['h1', 'tag-selector'],
    ['div.card', 'tag-selector'],
    ['*', 'unsupported-selector'],
    ['[data-x]', 'unsupported-selector'],
    ['.a[data-x="1"]', 'unsupported-selector'],
    [':root', 'css-variable'],
  ])('%s goes to the embed (%s)', (sel, code) => {
    const r = classifySelector(sel);
    expect(r.kind).toBe('embed');
    if (r.kind === 'embed') expect(r.code).toBe(code);
  });

  it('flags page-wide selectors as global', () => {
    for (const sel of ['body', 'html', '*', 'body .a']) {
      const r = classifySelector(sel);
      expect(r.kind === 'embed' && r.global).toBe(true);
    }
    const r = classifySelector('.a .b');
    expect(r.kind === 'embed' && r.global).toBe(false);
  });

  it('unescapes class names', () => {
    expect(classifySelector('.md\\:flex')).toMatchObject({ kind: 'native', classes: ['md:flex'] });
  });

  it('scores specificity by classes and pseudo-classes', () => {
    expect(classifySelector('.a')).toMatchObject({ specificity: 1 });
    expect(classifySelector('.a.b:hover')).toMatchObject({ specificity: 3 });
  });
});

describe('isWebflowSafeClassName', () => {
  it('accepts lowercase BEM/Client-First names and rejects others', () => {
    expect(isWebflowSafeClassName('hero_title')).toBe(true);
    expect(isWebflowSafeClassName('is-active')).toBe(true);
    expect(isWebflowSafeClassName('heroTitle')).toBe(false);
    expect(isWebflowSafeClassName('md:flex')).toBe(false);
  });
});
