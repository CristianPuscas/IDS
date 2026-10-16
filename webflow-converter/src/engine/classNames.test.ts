import { describe, expect, it } from 'vitest';
import { cssClassNames, findJsClassReferences, planClassRenames, rewriteCssClasses, scriptToggledClasses, toWebflowClassName } from './classNames';
import { convert, validateXscp } from './index';
import { PRE_V8, classNames, embedCodes, embeddedCss, first, style } from './testHelpers';

describe('toWebflowClassName (Webflow Designer toClassName, spec 3.1)', () => {
  it.each([
    ['heroTitle', 'herotitle'],
    ['md:flex', 'md-flex'],
    ['Hero Title', 'hero-title'],
    ['w-1/2', '_w-1-2'],
    ['w-full', '_w-full'],
    ['hover:bg-blue-500', 'hover-bg-blue-500'],
    ['2col', '_2col'],
    ['w-button', '_w-button'],
    ['wf-thing', '_wf-thing'],
    ['-foo_', 'foo'],
    ['a  b', 'a-b'],
    ['hero_title', 'hero_title'],
    ['block__el--mod', 'block__el--mod'],
  ])('%s -> %s', (from, to) => {
    expect(toWebflowClassName(from)).toBe(to);
    // Idempotent: the result is already in Webflow form.
    expect(toWebflowClassName(to)).toBe(to);
  });
});

describe('planClassRenames', () => {
  it('renames only names that Webflow would change', () => {
    expect([...planClassRenames(['hero_title', 'heroTitle', 'md:flex'])]).toEqual([
      ['heroTitle', 'herotitle'],
      ['md:flex', 'md-flex'],
    ]);
  });

  it('never merges two source classes: collisions get a numeric suffix', () => {
    expect([...planClassRenames(['Card', 'card'])]).toEqual([['Card', 'card-2']]);
    expect([...planClassRenames(['heroTitle', 'HeroTitle'])]).toEqual([
      ['heroTitle', 'herotitle'],
      ['HeroTitle', 'herotitle-2'],
    ]);
    // A CSS-only class (e.g. toggled by JS) keeps its name too.
    expect([...planClassRenames(['isOpen'], ['isopen'])]).toEqual([['isOpen', 'isopen-2']]);
  });

  it('leaves Webflow state classes alone', () => {
    expect(planClassRenames(['w--current', 'w--open']).size).toBe(0);
  });
});

describe('rewriteCssClasses', () => {
  const renames = new Map([
    ['heroTitle', 'herotitle'],
    ['md:flex', 'md-flex'],
  ]);

  it('rewrites class selectors, including escaped ones and ones inside :not() and @media', () => {
    const css = '.md\\:flex { display: flex }\n@media (min-width: 768px) { .card .heroTitle:hover, :not(.heroTitle) > p { color: red } }';
    expect(rewriteCssClasses(css, renames)).toBe(
      '.md-flex { display: flex }\n@media (min-width: 768px) { .card .herotitle:hover, :not(.herotitle) > p { color: red } }',
    );
  });

  it('leaves values, strings, attribute selectors and longer names untouched', () => {
    const css = '.heroTitleX, [data-x=".heroTitle"] { background: url(img/a.heroTitle.png); content: ".heroTitle" }';
    expect(rewriteCssClasses(css, renames)).toBe(css);
  });

  it('lists class names referenced by selectors', () => {
    expect([...cssClassNames('.a.b:hover, .md\\:flex .c { x: url(d.e) } @media (max-width: 1px) { .f {} }')]).toEqual([
      'a',
      'b',
      'md:flex',
      'c',
      'f',
    ]);
  });
});

describe('findJsClassReferences', () => {
  it('finds string literals that mention an old name as a whole token', () => {
    const refs = findJsClassReferences(
      [`document.querySelector('.heroTitle'); el.classList.add("heroTitle"); x = 'heroTitleX'; y = \`.md:flex\`;`],
      new Map([
        ['heroTitle', 'herotitle'],
        ['md:flex', 'md-flex'],
      ]),
    );
    expect(refs.map((r) => r.literal)).toEqual([`'.heroTitle'`, `"heroTitle"`, '`.md:flex`']);
  });
});

describe('class name normalization in convert()', () => {
  const run = (html: string, options = {}) => {
    const res = convert({ mode: 'combined', html }, { ...PRE_V8, ...options });
    expect(validateXscp(res.data)).toEqual([]);
    return res;
  };

  it('renames native classes and rewrites the embedded CSS to match', () => {
    const res = run(`<style>
      .heroTitle { font-size: 3rem }
      .heroTitle span { color: red }
      .md\\:flex { display: flex }
    </style>
    <h1 class="heroTitle md:flex">Hi <span>there</span></h1>`, { renameProofEmbedCss: false });
    expect(classNames(res, first(res, 'Heading'))).toEqual(['herotitle', 'md-flex']);
    expect(style(res, 'herotitle').styleLess).toBe('font-size: 3rem;');
    expect(style(res, 'md-flex', '&').styleLess).toBe('display: flex;');
    expect(embeddedCss(res)).toContain('.herotitle span {');
    expect(embeddedCss(res)).not.toContain('heroTitle');
    const w = res.warnings.find((x) => x.code === 'class-renamed')!;
    expect(w.detail).toBe('heroTitle → herotitle\nmd:flex → md-flex');
  });

  it('keeps two classes that differ only in case apart', () => {
    const res = run('<style>.Card { color: red } .card { color: blue }</style><div class="Card"></div><div class="card"></div>');
    expect(style(res, 'card').styleLess).toBe('color: blue;');
    expect(style(res, 'card-2').styleLess).toBe('color: red;');
  });

  it('does not rewrite scripts, but lists the literals that still use old names', () => {
    const res = run(`<div class="heroTitle"></div><script>document.querySelector('.heroTitle').classList.add('isOpen');</script>`);
    expect(embedCodes(res).some((c) => c.includes(`querySelector('.heroTitle')`))).toBe(true);
    const w = res.warnings.find((x) => x.code === 'class-renamed' && x.severity === 'warning')!;
    expect(w.message).toContain('heroTitle → herotitle');
    expect(w.detail).toContain(`'.heroTitle'`);
  });

  it('renames classes inside embedded SVG and its own <style> consistently', () => {
    const res = run('<div><svg class="myIcon" viewBox="0 0 1 1"><style>.myIcon { fill: red }</style><rect class="myIcon"/></svg></div>');
    const svg = embedCodes(res).find((c) => c.startsWith('<svg'))!;
    expect(svg).toContain('class="myicon"');
    expect(svg).toContain('.myicon { fill: red }');
  });

  it('keeps CSS-only classes (toggled by JS) unchanged', () => {
    const res = run('<style>.menu.isOpen { display: block }</style><div class="menu"></div>');
    expect(embeddedCss(res)).toContain('.menu.isOpen');
  });

  it('can be turned off', () => {
    const res = run('<style>.heroTitle { color: red }</style><div class="heroTitle"></div>', { normalizeClassNames: false });
    expect(style(res, 'heroTitle').styleLess).toBe('color: red;');
  });
});

describe('scriptToggledClasses', () => {
  it('finds classes that scripts add, remove or toggle', () => {
    const found = scriptToggledClasses([
      "menu.classList.toggle('is-open', open); el.classList.add(\"is-a\", 'is-b');",
      "bg.classList.remove(`is-scrolled`); $(x).addClass('active-tab'); el.className += ' js-ready';",
      "var OPEN = 'is-visible'; el.classList.toggle(OPEN);",
      "document.querySelector('.nav_link'); link.classList.contains('nav_link');",
    ]);
    expect([...found].sort()).toEqual(['active-tab', 'is-a', 'is-b', 'is-open', 'is-scrolled', 'is-visible', 'js-ready']);
  });
});
