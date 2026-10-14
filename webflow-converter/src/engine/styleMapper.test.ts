import { describe, expect, it } from 'vitest';
import { convert, validateXscp, type ConvertOptions } from './index';
import { classNames, embeddedCss, first, style } from './testHelpers';

const run = (htmlBody: string, css: string, options?: Partial<ConvertOptions>) => {
  const res = convert({ mode: 'separate', html: htmlBody, css, js: '' }, options);
  expect(validateXscp(res.data)).toEqual([]);
  return res;
};

describe('class -> native style', () => {
  it('maps a single-class rule to a base style with longhands', () => {
    const res = run(
      '<div class="card"></div>',
      '.card { padding: 2rem 1.5rem; margin: 0 auto; border-radius: 12px; gap: 1rem; display: flex; box-shadow: 0 1px 2px rgba(0,0,0,.1); }',
    );
    const s = style(res, 'card');
    expect(s).toMatchObject({ type: 'class', comb: '', fake: false, namespace: '', selector: null, origin: null, children: [] });
    expect(s.styleLess).toBe(
      'padding-top: 2rem; padding-right: 1.5rem; padding-bottom: 2rem; padding-left: 1.5rem; ' +
        'margin-top: 0; margin-right: auto; margin-bottom: 0; margin-left: auto; ' +
        'border-top-left-radius: 12px; border-top-right-radius: 12px; border-bottom-right-radius: 12px; border-bottom-left-radius: 12px; ' +
        'grid-row-gap: 1rem; grid-column-gap: 1rem; display: flex; box-shadow: 0 1px 2px rgba(0,0,0,.1);',
    );
    expect(embeddedCss(res)).toBe('');
    expect(res.stats.embeddedCssRules).toBe(0);
  });

  it('keeps units and expands grid repeat()', () => {
    const res = run('<div class="grid"></div>', '.grid { width: 50vw; height: 10vh; font-size: 1.25em; grid-template-columns: repeat(3, minmax(0, 1fr)); }');
    expect(style(res, 'grid').styleLess).toBe('width: 50vw; height: 10vh; font-size: 1.25em; grid-template-columns: 1fr 1fr 1fr;');
  });

  it('merges several rules for the same class in cascade order (later wins)', () => {
    const res = run('<p class="t"></p>', '.t { color: red; font-size: 1rem } .t { color: blue }');
    expect(style(res, 't').styleLess).toBe('font-size: 1rem; color: blue;');
  });

  it('emits one style per class even when it is used many times', () => {
    const res = run('<div class="a"></div><div class="a"></div><div class="a"></div>', '.a{color:red}');
    expect(res.data.payload.styles.filter((s) => s.name === 'a')).toHaveLength(1);
  });

  it('creates empty styles for classes without CSS (classes stay on elements)', () => {
    const res = run('<div class="js-hook"></div>', '');
    expect(style(res, 'js-hook').styleLess).toBe('');
  });

  it('wraps var() values in @raw and puts :root variables in the embed', () => {
    const res = run('<a class="link">x</a>', ':root { --brand: #146ef5; --space: 1rem; } .link { color: var(--brand); padding: var(--space); }');
    expect(style(res, 'link').styleLess).toContain('color: @raw<|var(--brand)|>;');
    expect(style(res, 'link').styleLess).toContain('padding-left: @raw<|var(--space)|>;');
    expect(embeddedCss(res)).toContain(':root {\n  --brand: #146ef5;\n  --space: 1rem;\n}');
    expect(res.warnings.some((w) => w.code === 'css-variable')).toBe(true);
  });

  it('keeps custom-property declarations inside a class rule in the embed, rest native', () => {
    const res = run('<div class="card"></div>', '.card { --pad: 2rem; color: red; }');
    expect(style(res, 'card').styleLess).toBe('color: red;');
    expect(embeddedCss(res)).toContain('.card {\n  --pad: 2rem;\n}');
  });

  it('routes !important and vendor-prefixed declarations to the embed', () => {
    const res = run('<div class="glass"></div>', '.glass { -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); color: red !important; }');
    expect(style(res, 'glass').styleLess).toBe('backdrop-filter: blur(8px);');
    const css = embeddedCss(res);
    expect(css).toContain('-webkit-backdrop-filter: blur(8px);');
    expect(css).toContain('color: red !important;');
  });
});

describe('combo classes', () => {
  it('builds combo chains with comb "&" and children links', () => {
    const res = run(
      '<a class="button is-secondary is-small">x</a><a class="button">y</a>',
      '.button { padding: 1rem } .button.is-secondary { background-color: transparent } .button.is-secondary.is-small { padding: .5rem }',
    );
    const base = style(res, 'button');
    const sec = style(res, 'is-secondary', '&');
    const small = style(res, 'is-small', '&');
    expect(base.children).toEqual([sec._id]);
    expect(sec.children).toEqual([small._id]);
    expect(sec.styleLess).toBe('background-color: transparent;');
    expect(small.styleLess).toBe('padding-top: .5rem; padding-right: .5rem; padding-bottom: .5rem; padding-left: .5rem;');
    expect(classNames(res, first(res, 'Link'))).toEqual(['button', 'is-secondary', 'is-small']);
  });

  it('folds a standalone modifier rule into the combo where the element uses it', () => {
    const res = run('<div class="card is-active"></div>', '.card { color: black } .is-active { color: red; outline: 2px solid red }');
    expect(style(res, 'card').styleLess).toBe('color: black;');
    expect(style(res, 'is-active', '&').styleLess).toBe('color: red; outline-width: 2px; outline-style: solid; outline-color: red;');
  });

  it('gives the same combo name under different bases separate styles', () => {
    const res = run('<div class="a is-on"></div><div class="b is-on"></div>', '.a.is-on{color:red} .b.is-on{color:blue}');
    const combos = res.data.payload.styles.filter((s) => s.name === 'is-on' && s.comb === '&');
    expect(combos.map((c) => c.styleLess).sort()).toEqual(['color: blue;', 'color: red;']);
  });

  it('a class used alone and as a combo gets a base and a combo style', () => {
    const res = run('<div class="tag"></div><div class="card tag"></div>', '.tag { color: red }');
    expect(style(res, 'tag', '').styleLess).toBe('color: red;');
    expect(style(res, 'tag', '&').styleLess).toBe('color: red;');
  });

  it('keeps JS-toggled combos (not present in the HTML) in the embed', () => {
    const res = run('<nav class="menu"></nav>', '.menu { display: none } .menu.is-open { display: block }');
    expect(style(res, 'menu').styleLess).toBe('display: none;');
    expect(res.data.payload.styles.some((s) => s.name === 'is-open')).toBe(false);
    expect(embeddedCss(res)).toContain('.menu.is-open {\n  display: block;\n}');
  });
});

describe('states', () => {
  it.each([
    [':hover', 'main_hover'],
    [':active', 'main_active'],
    [':focus', 'main_focus'],
    [':focus-visible', 'main_focus-visible'],
    [':visited', 'main_visited'],
  ])('%s -> %s', (pseudo, key) => {
    const res = run('<a class="btn">x</a>', `.btn { color: black } .btn${pseudo} { color: red }`);
    expect(style(res, 'btn').variants).toEqual({ [key]: { styleLess: 'color: red;' } });
  });

  it('maps .w--current and combo hover', () => {
    const res = run('<a class="nav_link is-dark">x</a>', '.nav_link.w--current { color: blue } .nav_link.is-dark:hover { color: white }');
    expect(style(res, 'nav_link').variants).toEqual({ main_current: { styleLess: 'color: blue;' } });
    expect(style(res, 'is-dark', '&').variants).toEqual({ main_hover: { styleLess: 'color: white;' } });
  });

  it('hover inside a media query becomes <breakpoint>_hover', () => {
    const res = run(
      '<a class="btn">x</a>',
      '.btn:hover { transform: scale(1.05) } @media (max-width: 991px) { .btn:hover { transform: none } } @media (max-width: 479px) { .btn:hover { color: red } }',
    );
    expect(style(res, 'btn').variants).toEqual({
      main_hover: { styleLess: 'transform: scale(1.05);' },
      medium_hover: { styleLess: 'transform: none;' },
      tiny_hover: { styleLess: 'color: red;' },
    });
  });

  it('routes unsupported pseudos and pseudo-elements to the embed but keeps the base native', () => {
    const res = run('<div class="card"></div>', '.card { position: relative } .card::before { content: ""; } .card:nth-child(2) { color: red } .card:focus-within { outline: 0 }');
    expect(style(res, 'card').styleLess).toBe('position: relative;');
    const css = embeddedCss(res);
    expect(css).toContain('.card::before');
    expect(css).toContain('.card:nth-child(2)');
    expect(css).toContain('.card:focus-within');
    expect(res.warnings.filter((w) => ['pseudo-element', 'unsupported-pseudo'].includes(w.code))).toHaveLength(3);
  });
});

describe('breakpoints', () => {
  it.each([
    ['(max-width: 991px)', 'medium'],
    ['(max-width: 767px)', 'small'],
    ['(max-width: 479px)', 'tiny'],
    ['(max-width: 1000px)', 'medium'],
    ['(max-width: 768px)', 'small'],
    ['(max-width: 480px)', 'tiny'],
    ['screen and (max-width: 767px)', 'small'],
  ])('%s -> %s', (query, key) => {
    const res = run('<div class="a"></div>', `.a { font-size: 2rem } @media ${query} { .a { font-size: 1rem } }`);
    expect(style(res, 'a').variants).toEqual({ [key]: { styleLess: 'font-size: 1rem;' } });
  });

  it('only emits the delta between breakpoints', () => {
    const res = run(
      '<div class="a"></div>',
      '.a { color: red; padding: 2rem } @media (max-width: 991px) { .a { color: red; padding: 1rem } } @media (max-width: 767px) { .a { padding: 1rem } }',
    );
    expect(style(res, 'a').variants).toEqual({
      medium: { styleLess: 'padding-top: 1rem; padding-right: 1rem; padding-bottom: 1rem; padding-left: 1rem;' },
    });
  });

  it('respects the tolerance edge (inclusive) and the option', () => {
    const css = (n: number) => `.a { color: red } @media (max-width: ${n}px) { .a { color: blue } }`;
    expect(Object.keys(style(run('<div class="a"></div>', css(1011)), 'a').variants)).toEqual(['medium']);
    const out = run('<div class="a"></div>', css(1012));
    expect(style(out, 'a').variants).toEqual({});
    expect(embeddedCss(out)).toContain('@media (max-width: 1012px) {\n.a {\n  color: blue;\n}\n}');
    expect(out.warnings.some((w) => w.code === 'unmatched-media')).toBe(true);
    const custom = run('<div class="a"></div>', css(1024), { breakpointTolerancePx: 40 });
    expect(Object.keys(style(custom, 'a').variants)).toEqual(['medium']);
  });

  it('keeps non-width media queries in the embed with the original query', () => {
    const res = run('<div class="a"></div>', '.a { transition: all .3s } @media (prefers-reduced-motion: reduce) { .a { transition: none } }');
    expect(style(res, 'a').variants).toEqual({});
    expect(embeddedCss(res)).toContain('@media (prefers-reduced-motion: reduce) {\n.a {\n  transition: none;\n}\n}');
  });

  it('re-encodes mobile-first min-width rules desktop-first', () => {
    const res = run(
      '<div class="grid"></div>',
      '.grid { display: grid; grid-template-columns: 1fr; } @media (min-width: 768px) { .grid { grid-template-columns: 1fr 1fr; } } @media (min-width: 992px) { .grid { grid-template-columns: 1fr 1fr 1fr; } }',
    );
    const s = style(res, 'grid');
    expect(s.styleLess).toBe('display: grid; grid-template-columns: 1fr 1fr 1fr;');
    expect(s.variants).toEqual({
      medium: { styleLess: 'grid-template-columns: 1fr 1fr;' },
      small: { styleLess: 'grid-template-columns: 1fr;' },
    });
    expect(embeddedCss(res)).toBe('');
  });

  it('moves a min-width declaration without a base value to the embed (cannot be unset desktop-first)', () => {
    const res = run('<div class="nav"></div>', '.nav { color: red } @media (min-width: 992px) { .nav { display: flex; color: blue } }');
    const s = style(res, 'nav');
    expect(s.styleLess).toBe('color: blue;');
    expect(s.variants).toEqual({ medium: { styleLess: 'color: red;' } });
    expect(embeddedCss(res)).toContain('@media (min-width: 992px) {\n.nav {\n  display: flex;\n}\n}');
  });

  it('folds large min-width queries into the embed unless large breakpoints are enabled', () => {
    const css = '.a { font-size: 1rem } @media (min-width: 1440px) { .a { font-size: 1.25rem } }';
    const off = run('<div class="a"></div>', css);
    expect(style(off, 'a').variants).toEqual({});
    expect(off.warnings.some((w) => w.code === 'large-breakpoint-folded')).toBe(true);
    const on = run('<div class="a"></div>', css, { includeLargeBreakpoints: true });
    expect(style(on, 'a').variants).toEqual({ xl: { styleLess: 'font-size: 1.25rem;' } });
  });
});

describe('unsupported selectors -> embed', () => {
  it.each([
    ['.card .title { color: red }', 'descendant-selector'],
    ['.list > .item { color: red }', 'descendant-selector'],
    ['.a + .b { color: red }', 'descendant-selector'],
    ['.a ~ .b { color: red }', 'descendant-selector'],
    ['.a::after { content: "" }', 'pseudo-element'],
    ['.a:nth-child(odd) { color: red }', 'unsupported-pseudo'],
    ['#hero { color: red }', 'id-selector'],
    ['h1 { color: red }', 'tag-selector'],
    ['* { box-sizing: border-box }', 'unsupported-selector'],
    ['[data-theme="dark"] .a { color: red }', 'descendant-selector'],
    ['.a[aria-expanded="true"] { color: red }', 'unsupported-selector'],
  ])('%s (%s)', (css, code) => {
    const res = run('<div class="a card list"><h1 id="hero" class="title b item">x</h1></div>', css);
    expect(embeddedCss(res)).toContain(css.slice(0, css.indexOf('{')).trim());
    expect(res.warnings.some((w) => w.code === code)).toBe(true);
    expect(res.stats.embeddedCssRules).toBe(1);
  });

  it('keeps @keyframes and @font-face verbatim, and the animation property native', () => {
    const res = run(
      '<div class="spinner"></div>',
      '@font-face { font-family: "X"; src: url(x.woff2) format("woff2"); } @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } } .spinner { animation: spin 1s linear infinite; }',
    );
    expect(style(res, 'spinner').styleLess).toBe('animation: spin 1s linear infinite;');
    const css = embeddedCss(res);
    expect(css).toContain('@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }');
    expect(css).toContain('@font-face { font-family: "X"; src: url(x.woff2) format("woff2"); }');
    expect(css.indexOf('@font-face')).toBeLessThan(css.indexOf('@keyframes'));
    expect(res.stats.embeddedCssRules).toBe(0); // at-rules are not style rules
  });

  it('keeps @supports blocks and puts @import first', () => {
    const res = run('<div class="a"></div>', '.x .y { color: red } @import url("https://fonts.googleapis.com/css2?family=Inter"); @supports (display: grid) { .a { display: grid } }');
    const css = embeddedCss(res);
    expect(css.startsWith('<style>\n@import')).toBe(true);
    expect(css).toContain('@supports (display: grid) { .a { display: grid } }');
  });

  it('a class with native styles that is also used in complex selectors keeps both', () => {
    const res = run('<div class="card"><h3 class="card_title">t</h3></div>', '.card { padding: 1rem } .card:hover .card_title { color: red }');
    expect(style(res, 'card').styleLess).toContain('padding-top: 1rem;');
    expect(embeddedCss(res)).toContain('.card:hover .card_title {\n  color: red;\n}');
  });

  it('splits a selector list between native and embed', () => {
    const res = run('<div class="a"></div><div class="b"><p></p></div>', '.a, .b p { color: red }');
    expect(style(res, 'a').styleLess).toBe('color: red;');
    expect(embeddedCss(res)).toContain('.b p {\n  color: red;\n}');
    expect(embeddedCss(res)).not.toContain('.a,');
  });

  it('copies rules for classes used inside Code Embed elements to the embed', () => {
    const res = run('<div class="hero"><canvas class="hero_canvas"></canvas></div>', '.hero_canvas { position: absolute; inset: 0 }');
    expect(res.data.payload.styles.some((s) => s.name === 'hero_canvas')).toBe(false);
    expect(embeddedCss(res)).toContain('.hero_canvas {\n  position: absolute;\n  inset: 0;\n}');
  });

  it('preserves source order of embedded rules and groups them by media query', () => {
    const res = run('<div class="a"></div>', '.a .b { color: red } #x { color: blue } @media (max-width: 600px) { .a .b { color: green } #x { color: pink } } h2 { margin: 0 }');
    const css = embeddedCss(res);
    const order = ['.a .b {\n  color: red', '#x {\n  color: blue', '@media (max-width: 600px) {', 'color: green', 'color: pink', 'h2 {'].map((s) =>
      css.indexOf(s),
    );
    expect(order.every((v) => v >= 0)).toBe(true);
    expect([...order].sort((x, y) => x - y)).toEqual(order);
    expect(css.match(/@media/g)).toHaveLength(1);
  });

  it('drops unsupported CSS with warnings when keepUnsupportedInEmbed is false', () => {
    const res = run('<div class="a"></div>', '.a { color: red } .a .b { color: blue } @keyframes k { to { opacity: 0 } }', { keepUnsupportedInEmbed: false });
    expect(embeddedCss(res)).toBe('');
    expect(res.stats.embeddedCssRules).toBe(0);
    expect(res.warnings.some((w) => w.message.startsWith('Dropped'))).toBe(true);
    expect(style(res, 'a').styleLess).toBe('color: red;');
  });

  it('warns about global selectors with warning severity', () => {
    const res = run('<div class="a"></div>', 'body { margin: 0; font-family: Inter } html { scroll-behavior: smooth }');
    const global = res.warnings.filter((w) => w.message.includes('whole page'));
    expect(global).toHaveLength(2);
    expect(global.every((w) => w.severity === 'warning')).toBe(true);
  });
});

describe('class name hygiene', () => {
  it('warns when Webflow will slugify a class name', () => {
    const res = run('<div class="heroTitle"></div>', '.heroTitle { color: red }');
    expect(style(res, 'heroTitle').styleLess).toBe('color: red;');
    expect(res.warnings.some((w) => w.code === 'class-renamed' && w.detail === 'heroTitle')).toBe(true);
  });

  it('ignores duplicated class tokens and Webflow state classes on elements', () => {
    const res = run('<a class="link link w--current">x</a>', '');
    expect(classNames(res, first(res, 'Link'))).toEqual(['link']);
  });
});
