import { describe, expect, it } from 'vitest';
import { planEmbedRewrite, rewriteEmbedSelector, selectorClassNames, type EmbedRewritePlan } from './embedCss';
import { convert, validateXscp, type ConvertOptions } from './index';
import { elements, embeddedCss, first } from './testHelpers';

const plan = (p: Partial<EmbedRewritePlan>): EmbedRewritePlan => ({ repeat: new Map(), attr: new Set(), both: new Set(), tags: new Map(), ...p });
const run = (html: string, css: string, options: Partial<ConvertOptions> = {}) => {
  const res = convert({ mode: 'separate', html, css, js: '' }, options);
  expect(validateXscp(res.data)).toEqual([]);
  return res;
};

describe('rewriteEmbedSelector', () => {
  it('repeats a lone combo class d times (specificity parity, F4)', () => {
    const p = plan({ repeat: new Map([['about_layout', 2]]) });
    expect(rewriteEmbedSelector('.about_layout', p)).toBe('.about_layout.about_layout');
    expect(rewriteEmbedSelector('.about_layout:hover > img', p)).toBe('.about_layout.about_layout:hover > img');
    // Not a lone class: left alone.
    expect(rewriteEmbedSelector('.about_layout.is-open', p)).toBe('.about_layout.is-open');
    expect(rewriteEmbedSelector('div.about_layout', p)).toBe('div.about_layout');
  });

  it('writes native classes as [data-h2w-class~=…] (F5), keeps others', () => {
    const p = plan({ attr: new Set(['card', 'nav']), both: new Set(['nav']) });
    expect(rewriteEmbedSelector('.card .title, .card.open:hover', p)).toBe('[data-h2w-class~="card"] .title, [data-h2w-class~="card"].open:hover');
    expect(rewriteEmbedSelector('.nav a', p)).toBe(':is(.nav,[data-h2w-class~="nav"]) a');
    expect(rewriteEmbedSelector('.x:not(.card)', p)).toBe('.x:not([data-h2w-class~="card"])');
    expect(rewriteEmbedSelector('a[href^=".card"]', p)).toBe('a[href^=".card"]');
  });

  it('combines repeat and attribute rewriting', () => {
    const p = plan({ repeat: new Map([['nb', 2]]), attr: new Set(['nb', 'button']) });
    expect(rewriteEmbedSelector('.nb>.button', p)).toBe('[data-h2w-class~="nb"][data-h2w-class~="nb"]>[data-h2w-class~="button"]');
  });

  it('rewrites remapped type selectors only (F6)', () => {
    const p = plan({ tags: new Map([['b', 'strong'], ['i', 'em'], ['button', ':is(button,a:where([data-h2w-button]))']]) });
    expect(rewriteEmbedSelector('.hero_features b', p)).toBe('.hero_features strong');
    expect(rewriteEmbedSelector('I.x, .b, [data-b] b:hover', p)).toBe('em.x, .b, [data-b] strong:hover');
    expect(rewriteEmbedSelector('button:hover, .bar button.x', p)).toBe(':is(button,a:where([data-h2w-button])):hover, .bar :is(button,a:where([data-h2w-button])).x');
    expect(rewriteEmbedSelector(':not(b) > i', p)).toBe(':not(strong) > em');
    expect(rewriteEmbedSelector('.body', p)).toBe('.body');
    expect(rewriteEmbedSelector('a:nth-child(2n+1) i', p)).toBe('a:nth-child(2n+1) em');
  });

  it('lists class names, including inside :not()/:is()', () => {
    expect(selectorClassNames('.a > .b:not(.c), :is(.d) [class="e"]')).toEqual(['a', 'b', 'c', 'd']);
  });

  it('plans only classes with native styles for data-h2w-class and only deep classes for repeats', () => {
    const p = planEmbedRewrite({
      selectors: ['.wrap .card', '.about'],
      chains: [['container', 'about'], ['card']],
      styled: new Set(['card', 'about', 'container']),
      embeddedClassLists: [],
      remappedTags: new Set(['b']),
      embedSpecificityParity: true,
      renameProofEmbedCss: true,
      rewriteRemappedTags: true,
    });
    expect([...p.attr]).toEqual(['card', 'about']);
    expect([...p.repeat]).toEqual([['about', 2]]);
    expect([...p.tags]).toEqual([['b', 'strong']]);
  });
});

describe('embed CSS rewriting in convert()', () => {
  it('keeps an embed rule on a combo class winning over the combo selector (F4)', () => {
    const res = run('<div class="container about"></div>', '.about { display: grid } @media (orientation: portrait) { .about { display: block } }');
    expect(embeddedCss(res)).toContain('[data-h2w-class~="about"][data-h2w-class~="about"] {\n  display: block;');
    const off = run('<div class="container about"></div>', '.about { display: grid } @media (orientation: portrait) { .about { display: block } }', {
      embedSpecificityParity: false,
      renameProofEmbedCss: false,
    });
    expect(embeddedCss(off)).toContain('.about {\n  display: block;');
  });

  it('tags elements whose classes the embed references with data-h2w-class (F5)', () => {
    const res = run('<div class="card is-big"><h3>t</h3></div><div class="other"></div><span class="js-only"></span>', '.card { padding: 1px } .card h3 { margin: 0 } .js-only.open { display: block } .other { color: red }');
    const card = elements(res).find((e) => e.data?.xattr?.some((a) => a.name === 'data-h2w-class'))!;
    expect(card.data!.xattr).toContainEqual({ name: 'data-h2w-class', value: 'card is-big' });
    expect(elements(res).filter((e) => e.data?.xattr?.some((a) => a.name === 'data-h2w-class'))).toHaveLength(1);
    const css = embeddedCss(res);
    expect(css).toContain('[data-h2w-class~="card"] h3 {');
    expect(css).toContain('.js-only.open {'); // JS-toggled / embed-only classes keep their names
    expect(res.warnings.some((w) => w.message.includes('data-h2w-class'))).toBe(true);
  });

  it('puts data-h2w-class in data.attributes on Custom Elements', () => {
    const res = run('<div><img class="pic" src="https://x.y/a.png"></div>', '.pic { width: 10px } .pic:first-child { width: 20px }');
    const img = first(res, 'DOM');
    expect(img.data!.attributes).toContainEqual({ name: 'data-h2w-class', value: 'pic' });
    expect(embeddedCss(res)).toContain('[data-h2w-class~="pic"]:first-child');
  });

  it('can be turned off', () => {
    const res = run('<div class="card"><h3>t</h3></div>', '.card { padding: 1px } .card h3 { margin: 0 }', { renameProofEmbedCss: false });
    expect(embeddedCss(res)).toContain('.card h3 {');
    expect(elements(res).some((e) => e.data?.xattr?.some((a) => a.name === 'data-h2w-class'))).toBe(false);
  });

  it('rewrites b / i / button selectors to the pasted tags (F6)', () => {
    const res = run('<p class="f"><b>1</b> <i>2</i></p><button class="t">x</button>', '.f b { font-size: 19px } .f i { color: red } button { font: inherit } .f { color: blue }');
    const css = embeddedCss(res);
    expect(css).toContain('[data-h2w-class~="f"] strong {');
    expect(css).toContain('[data-h2w-class~="f"] em {');
    expect(css).toContain(':is(button,a:where([data-h2w-button])) {');
    expect(css).not.toMatch(/(^|[\s,>])b \{/m);
    const off = run('<p class="f"><b>1</b></p>', '.f b { font-size: 19px }', { rewriteRemappedTags: false });
    expect(embeddedCss(off)).toContain('.f b {');
  });

  it('leaves tag selectors alone when nothing was remapped', () => {
    const res = run('<p class="f"><strong>1</strong></p>', '.f b { font-size: 19px }', { renameProofEmbedCss: false });
    expect(embeddedCss(res)).toContain('.f b {');
  });
});
