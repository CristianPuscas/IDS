import { describe, expect, it } from 'vitest';
import { convert, validateXscp, type ConvertOptions } from './index';
import { classNames, elements, embedCodes, embeddedCss, first, style } from './testHelpers';

const run = (html: string, css = '', options: Partial<ConvertOptions> = {}) => {
  const res = convert({ mode: 'separate', html, css, js: '' }, options);
  expect(validateXscp(res.data)).toEqual([]);
  return res;
};

describe('class collision risk (F7)', () => {
  it('warns about Client-First / Relume core names and combos not named is-*', () => {
    const res = run(
      '<div class="container-large navbar_component"><a class="button is-outline" href="#">x</a><p class="text-size-medium">t</p><div class="hero_card">c</div></div>',
      '.container-large { width: 100% } .navbar_component { display: flex } .button { color: red } .text-size-medium { font-size: 1rem }',
    );
    const w = res.warnings.find((x) => x.code === 'class-collision-risk')!;
    expect(w.severity).toBe('warning');
    expect(w.message).toContain('"name 2"');
    expect(w.message).toContain('classPrefix');
    expect(w.detail).toContain('container-large');
    expect(w.detail).toContain('button');
    expect(w.detail).toContain('text-size-medium');
    expect(w.detail).toMatch(/Combo classes not named is-\*: navbar_component$/m);
    expect(w.detail).not.toContain('hero_card');
    expect(w.detail).not.toContain('is-outline');
  });

  it('says nothing for distinct names', () => {
    const res = run('<div class="ferma_hero"><p class="ferma_text is-big">x</p></div>', '.ferma_hero { color: red }');
    expect(res.warnings.some((w) => w.code === 'class-collision-risk')).toBe(false);
  });
});

describe('classPrefix (F7)', () => {
  const html = '<div class="card is-big"><h3 class="card_title">t</h3><button class="toggle">x</button><div class="panel"></div></div>';
  const css = '.card { padding: 1px } .card.is-big { padding: 2px } .card_title { margin: 0 } .card h3 { color: red } .panel.open { display: block } .panel { display: none }';

  it('prefixes every HTML class, natively and in the embed CSS; CSS-only classes keep their names', () => {
    const res = run(html, css, { classPrefix: 'fm-' });
    const card = elements(res).find((e) => e.type === 'Block' && e.classes.length === 2)!;
    expect(classNames(res, card)).toEqual(['fm-card', 'fm-is-big']);
    expect(style(res, 'fm-card').styleLess).toBe('padding-top: 1px; padding-right: 1px; padding-bottom: 1px; padding-left: 1px;');
    expect(style(res, 'fm-is-big', '&').styleLess).toContain('padding-top: 2px;');
    const embed = embeddedCss(res);
    expect(embed).toContain('[data-h2w-class~="fm-card"] h3');
    expect(embed).toContain('[data-h2w-class~="fm-panel"].open');
    expect(embed).not.toMatch(/\.card\b/);
    expect(res.warnings.some((w) => w.code === 'class-collision-risk')).toBe(false);
  });

  it('prefixes generated classes too (button defaults, inline styles)', () => {
    const res = run('<div><button>Menu</button><p style="color:red">x</p></div>', '', { classPrefix: 'fm-' });
    expect(classNames(res, first(res, 'Link'))).toEqual(['fm-button']);
    expect(classNames(res, first(res, 'Paragraph'))).toEqual(['fm-inline-style-1']);
  });

  it('warns about class names in JS string literals', () => {
    const res = convert({ mode: 'combined', html: `${'<style>.card{padding:1px}</style>'}<div class="card"></div><script>document.querySelector('.card')</script>` }, { classPrefix: 'fm-' });
    const w = res.warnings.find((x) => x.code === 'class-renamed' && x.severity === 'warning')!;
    expect(w.message).toContain('card → fm-card');
    expect(embedCodes(res).some((c) => c.includes("querySelector('.card')"))).toBe(true);
  });

  it('ignores an unusable prefix with a warning', () => {
    const res = run('<div class="card"></div>', '.card { color: red }', { classPrefix: '9x' });
    expect(style(res, 'card').styleLess).toBe('color: red;');
    expect(res.warnings.some((w) => w.message.includes('classPrefix "9x"'))).toBe(true);
  });
});

describe('class-collision-risk items', () => {
  it('lists the risky class names in items', () => {
    const res = convert({ mode: 'separate', html: '<div class="container-large"><a class="button" href="#">x</a></div>', css: '.container-large{max-width:80rem}', js: '' });
    const w = res.warnings.find((x) => x.code === 'class-collision-risk')!;
    expect(w.items).toEqual(expect.arrayContaining(['container-large', 'button']));
  });
});
