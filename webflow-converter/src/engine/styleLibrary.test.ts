import { describe, expect, it } from 'vitest';
import { convert, parseSiteStyles, validateXscp, type ConvertOptions, type WfStyle } from './index';
import { normalizeLengthForCompare, REFERENCE_STYLE_PREFIX } from './siteStyles';
import {
  addLibrarySource,
  analyzeClasses,
  analyzeLibrary,
  cssToLibraryClasses,
  defaultSourceLabel,
  deserializeLibrary,
  EMPTY_STYLE_LIBRARY,
  libraryClassToStyle,
  librarySiteStyles,
  payloadVariables,
  removeLibrarySource,
  renameLibrarySource,
  serializeLibrary,
  stylesToLibraryClasses,
  type LibraryClass,
  type StyleLibrary,
} from './styleLibrary';
import { PRE_V8, classNames, elements, style } from './testHelpers';
import SITE_COPY from './__fixtures__/client-first-site-copy.json?raw';

const SITE = parseSiteStyles(SITE_COPY).styles;
const NOW = new Date(2026, 9, 26, 12, 0, 0);

const PG_CSS = '.padding-global { padding-left: 2.5rem; padding-right: 2.5rem; } @media (max-width: 991px) { .padding-global { padding-left: 2rem; padding-right: 2rem; } } @media (max-width: 767px) { .padding-global { padding-left: 1.25rem; padding-right: 1.25rem; } }';

const cls = (id: string, name: string, styleLess: string, extra: Partial<LibraryClass> = {}): LibraryClass => ({ id, name, comb: '', styleLess, variants: {}, children: [], ...extra });

const add = (lib: StyleLibrary, classes: LibraryClass[], label?: string, at = NOW) => addLibrarySource(lib, { kind: 'designer', label, classes, variables: [] }, at).library;

const run = (html: string, css: string, options: Partial<ConvertOptions> = {}) => {
  const res = convert({ mode: 'separate', html, css, js: '' }, { ...PRE_V8, ...options });
  expect(validateXscp(res.data)).toEqual([]);
  return res;
};

describe('normalizeLengthForCompare', () => {
  it('treats 16px as 1rem (base 16) and canonicalises rem numbers', () => {
    expect(normalizeLengthForCompare('16px')).toBe('1rem');
    expect(normalizeLengthForCompare('1rem')).toBe('1rem');
    expect(normalizeLengthForCompare('1.0rem')).toBe('1rem');
    expect(normalizeLengthForCompare('24px')).toBe('1.5rem');
    expect(normalizeLengthForCompare('1px')).toBe('0.0625rem');
    expect(normalizeLengthForCompare('-8px')).toBe('-0.5rem');
    expect(normalizeLengthForCompare('.5rem')).toBe('0.5rem');
    expect(normalizeLengthForCompare('0px')).toBe('0');
  });

  it('converts every length of a value, and leaves other units and words alone', () => {
    expect(normalizeLengthForCompare('16px 32px')).toBe('1rem 2rem');
    expect(normalizeLengthForCompare('calc(100% - 32px)')).toBe('calc(100% - 2rem)');
    expect(normalizeLengthForCompare('0 4px 12px rgba(0,0,0,0.2)')).toBe('0 0.25rem 0.75rem rgba(0,0,0,0.2)');
    expect(normalizeLengthForCompare('1.5em')).toBe('1.5em');
    expect(normalizeLengthForCompare('50%')).toBe('50%');
    expect(normalizeLengthForCompare('url(icon-16px.png)')).toBe('url(icon-16px.png)');
    expect(normalizeLengthForCompare('1.2')).toBe('1.2');
  });

  it('makes a px site class match the same CSS written in rem (reused, no override, no rename)', () => {
    const sitePx: WfStyle[] = [{ ...SITE.find((s) => s.name === 'padding-global')!, styleLess: 'padding-right: 40px; padding-left: 40px;', variants: {} }];
    const res = run('<div class="padding-global">x</div>', '.padding-global { padding-left: 2.5rem; padding-right: 2.5rem; }', { siteStyles: sitePx });
    expect(res.stats.reusedClasses).toBe(1);
    expect(res.stats.renamedClasses ?? 0).toBe(0);
    expect(style(res, 'padding-global').styleLess).toBe('padding-right: 40px; padding-left: 40px;');
  });
});

describe('Designer paste -> library class', () => {
  it('round-trips the copied style objects exactly (same keys, order and values)', () => {
    const back = stylesToLibraryClasses(SITE).map(libraryClassToStyle);
    expect(back).toEqual(SITE);
    for (let i = 0; i < SITE.length; i++) expect(JSON.stringify(back[i])).toBe(JSON.stringify(SITE[i]));
  });

  it('does not store the default fields', () => {
    const [c] = stylesToLibraryClasses(SITE);
    expect(c!.extra).toEqual({ createdBy: '5e8f3a2b1c4d6e7f8a9b0c1d', origin: null });
  });

  it('lists variables: a variables list, @var_ references and var(--x)', () => {
    const classes = [cls('a', 'a', 'color: @var_variable-123; margin-top: @raw<|var(--space-m)|>;')];
    expect(payloadVariables({ payload: { variables: [{ name: 'Brand / Blue' }, { id: 'v-2' }] } }, classes)).toEqual(['Brand / Blue', 'v-2', 'variable-123', '--space-m']);
  });
});

describe('analysis', () => {
  it('counts utility vs custom classes, combos with parents, variables and breakpoints of the fixture', () => {
    const a = analyzeClasses(stylesToLibraryClasses(SITE));
    expect(a.classCount).toBe(4);
    expect(a.utilities).toEqual(['button', 'container-large', 'heading-style-h2', 'padding-global']);
    expect(a.custom).toEqual([]);
    expect(a.combos).toEqual([
      { name: 'is-secondary', parent: 'button' },
      { name: 'is-small', parent: 'button' },
    ]);
    expect(a.breakpoints).toEqual(['main', 'medium', 'small']);
    expect(a.states).toEqual(['hover']);
    expect(a.variables).toEqual(['variable-5f2a1b3c-0d4e-1f2a-3b4c-5d6e7f8a9b0c']);
    expect(a.duplicates).toEqual([]);
  });

  it('flags Webflow\'s numbered duplicates ("foo 2", "foo 3")', () => {
    const a = analyzeClasses([cls('1', 'hero_title', 'color: red;'), cls('2', 'hero_title 2', 'color: blue;'), cls('3', 'hero_title 3', ''), cls('4', 'card 2', ''), cls('5', 'heading-style-h2', '')]);
    expect(a.duplicates).toEqual([
      { name: 'card 2', base: 'card', baseExists: false },
      { name: 'hero_title 2', base: 'hero_title', baseExists: true },
      { name: 'hero_title 3', base: 'hero_title', baseExists: true },
    ]);
    expect(a.custom).toContain('hero_title');
    expect(a.utilities).toEqual(['heading-style-h2']);
  });

  it('counts a name known from both a Designer copy and CSS once', () => {
    const css = cssToLibraryClasses('.padding-global { padding-left: 2.5rem } .section_hero { color: red }');
    let lib = add(EMPTY_STYLE_LIBRARY, stylesToLibraryClasses(SITE));
    lib = addLibrarySource(lib, { kind: 'css-text', classes: css.classes, variables: [] }, NOW).library;
    const a = analyzeLibrary(lib);
    expect(a.classCount).toBe(5);
    expect(a.custom).toEqual(['section_hero']);
    expect(a.fromCss).toBe(1);
  });
});

describe('library sources', () => {
  it('merges pages into one library, labels them, and removes only what no other source has', () => {
    let lib = add(EMPTY_STYLE_LIBRARY, [cls('a', 'page-wrapper', ''), cls('b', 'section_hero', 'color: red;')]);
    expect(lib.sources[0]!.label).toBe('26 Oct 2026 · 2 classes');
    expect(defaultSourceLabel(NOW, 1)).toBe('26 Oct 2026 · 1 class');
    // A second page shares page-wrapper (same _id) and adds a class.
    lib = add(lib, [cls('a', 'page-wrapper', 'display: block;'), cls('c', 'footer_component', '')], '  Footer   page ', NOW);
    expect(lib.sources.map((s) => s.label)).toEqual(['26 Oct 2026 · 2 classes', 'Footer page']);
    expect(new Set(lib.sources.map((s) => s.id)).size).toBe(2);
    expect([...lib.classes.keys()]).toEqual(['a', 'b', 'c']);
    expect(lib.classes.get('a')!.styleLess).toBe('display: block;'); // the newer copy wins

    lib = renameLibrarySource(lib, lib.sources[0]!.id, 'Style guide');
    expect(lib.sources[0]!.label).toBe('Style guide');
    lib = renameLibrarySource(lib, lib.sources[0]!.id, '   ');
    expect(lib.sources[0]!.label).toBe('26 Oct 2026 · 2 classes');

    const afterRemove = removeLibrarySource(lib, lib.sources[0]!.id);
    expect([...afterRemove.classes.keys()]).toEqual(['a', 'c']); // page-wrapper is still on the footer page
    expect(removeLibrarySource(afterRemove, afterRemove.sources[0]!.id).classes.size).toBe(0);
  });

  it('keeps the combo children of both copies of a class', () => {
    let lib = add(EMPTY_STYLE_LIBRARY, [cls('btn', 'button', '', { children: ['c1'] }), cls('c1', 'is-a', '', { comb: '&' })]);
    lib = add(lib, [cls('btn', 'button', '', { children: ['c2'] }), cls('c2', 'is-b', '', { comb: '&' })]);
    expect(lib.classes.get('btn')!.children).toEqual(['c1', 'c2']);
    lib = removeLibrarySource(lib, lib.sources[1]!.id);
    expect(lib.classes.get('btn')!.children).toEqual(['c1']);
  });

  it('serialises compactly (short keys, no defaults, no payload) and reads back the same library', () => {
    let lib = add(EMPTY_STYLE_LIBRARY, stylesToLibraryClasses(SITE), 'Style guide');
    lib = addLibrarySource(lib, { kind: 'css-url', url: 'https://cdn.example.com/site.css', classes: cssToLibraryClasses('.a { color: red }').classes, variables: ['--x'] }, NOW).library;
    const stored = serializeLibrary(lib);
    const text = JSON.stringify(stored);
    expect(text).not.toContain('"fake"');
    expect(text).not.toContain('"namespace"');
    expect(text).not.toContain('"nodes"');
    const back = deserializeLibrary(JSON.parse(text));
    expect(back).toEqual(lib);
    expect(librarySiteStyles(back).slice(0, SITE.length)).toEqual(SITE);
  });

  it('drops malformed stored data instead of throwing', () => {
    expect(deserializeLibrary(null)).toEqual({ sources: [], classes: new Map() });
    expect(deserializeLibrary({ sources: [{ id: 's', label: 'x', kind: 'nope', ids: ['a'] }], classes: [{ i: 'a', n: 'a' }] })).toEqual({ sources: [], classes: new Map() });
    const lib = deserializeLibrary({ sources: [{ id: 's', label: 'x', kind: 'designer', ids: ['a', 'missing'] }], classes: [{ i: 'a', n: 'a', v: { medium: 1 } }, { i: 'orphan', n: 'o' }, { n: 'no-id' }] });
    expect(lib.sources[0]!.classIds).toEqual(['a']);
    expect([...lib.classes.keys()]).toEqual(['a']);
    expect(lib.classes.get('a')!.variants).toEqual({});
  });
});

describe('CSS source', () => {
  it('reads base classes, combos, breakpoints, states and variables; skips w- and descendant rules', () => {
    const css = `
      :root { --brand: #146ef5; --space-m: 2rem; }
      .w-button { color: red; }
      .padding-global { padding: 0 2.5rem; }
      .button { color: #fff; }
      .button:hover { color: #eee; }
      .button.is-secondary { background-color: transparent; }
      .nav_link.w--current { font-weight: 700; }
      .card .card_title { color: red; }
      @media screen and (max-width: 991px) { .padding-global { padding-left: 2rem; padding-right: 2rem; } }
      @media screen and (max-width: 767px) { .padding-global { padding-left: 1.25rem; padding-right: 1.25rem; } }
      @media screen and (max-width: 479px) { .button:hover { color: red; } }
      @media (min-width: 1440px) { .button { font-size: 1.25rem; } }
    `;
    const out = cssToLibraryClasses(css);
    expect(out.error).toBeUndefined();
    expect(out.variables).toEqual(['--brand', '--space-m']);
    expect(out.skipped).toBe(1);
    const byId = new Map(out.classes.map((c) => [c.id, c]));
    expect(out.classes.every((c) => c.id.startsWith(REFERENCE_STYLE_PREFIX))).toBe(true);
    expect([...byId.keys()]).not.toContain(`${REFERENCE_STYLE_PREFIX}w-button`);
    const pg = byId.get(`${REFERENCE_STYLE_PREFIX}padding-global`)!;
    expect(pg.styleLess).toContain('padding-left: 2.5rem;');
    expect(pg.styleLess).toContain('padding-top: 0');
    expect(Object.keys(pg.variants)).toEqual(['medium', 'small']);
    const button = byId.get(`${REFERENCE_STYLE_PREFIX}button`)!;
    expect(button.variants).toEqual({ main_hover: 'color: #eee;', tiny_hover: 'color: red;', xl: 'font-size: 1.25rem;' });
    const combo = byId.get(`${REFERENCE_STYLE_PREFIX}button.is-secondary`)!;
    expect(combo.comb).toBe('&');
    expect(button.children).toEqual([combo.id]);
    expect(byId.get(`${REFERENCE_STYLE_PREFIX}nav_link.w--current`)).toBeUndefined();
    expect(byId.get(`${REFERENCE_STYLE_PREFIX}nav_link`)!.variants).toEqual({ main_current: 'font-weight: 700;' });
  });

  it('explains empty or class-less CSS', () => {
    expect(cssToLibraryClasses('  ').error).toMatch(/empty/);
    expect(cssToLibraryClasses('body { margin: 0 }').error).toMatch(/No class rules/);
  });
});

describe('conversion against the whole library', () => {
  const HTML = '<section class="section_hero"><h1 class="hero_title">Hi</h1><div class="padding-global">x</div></section>';
  const CSS = `.section_hero { background-color: #fff } .hero_title { font-size: 4rem } ${PG_CSS}`;

  it('reuses a same-name same-CSS class from one page and renames a clash from another page to a name free in every page', () => {
    // Page 1: the style guide (padding-global identical) plus an earlier rename the user kept.
    let lib = add(EMPTY_STYLE_LIBRARY, [...stylesToLibraryClasses(SITE), cls('old', 'hero_title-new', 'color: red;')], 'Style guide');
    // Page 2: another hero with the same class name and other CSS.
    lib = add(lib, [cls('other-hero', 'hero_title', 'font-size: 6rem; color: #0f0;')], 'Home');
    const res = run(HTML, CSS, { siteStyles: librarySiteStyles(lib) });
    const names = elements(res).flatMap((e) => classNames(res, e));
    expect(names).toContain('padding-global');
    expect(res.data.payload.styles.find((s) => s.name === 'padding-global')!._id).toBe(SITE[0]!._id); // pasted verbatim
    expect(names).not.toContain('hero_title');
    expect(names).not.toContain('hero_title-new'); // taken on page 1
    expect(names).toContain('hero_title-new-2');
    expect(style(res, 'hero_title-new-2').styleLess).toContain('font-size: 4rem;');
    expect(res.stats.renamedClasses).toBe(1);
  });

  it('uses CSS-only classes for renames and taken names, but never pastes them as the site\'s own', () => {
    const css = cssToLibraryClasses(`.hero_title { font-size: 2rem } ${PG_CSS.replace('padding-left: 2.5rem; padding-right: 2.5rem;', 'padding-left: 40px; padding-right: 40px;')}`);
    const lib = addLibrarySource(EMPTY_STYLE_LIBRARY, { kind: 'css-url', classes: css.classes, variables: [] }, NOW).library;
    const res = run(HTML, CSS, { siteStyles: librarySiteStyles(lib) });
    const names = elements(res).flatMap((e) => classNames(res, e));
    expect(names).toContain('hero_title-new'); // same name, other CSS -> separate class
    expect(names).toContain('padding-global'); // same CSS (40px = 2.5rem): name kept
    expect(res.data.payload.styles.some((s) => s._id.startsWith(REFERENCE_STYLE_PREFIX))).toBe(false);
    expect(style(res, 'padding-global').styleLess).toContain('padding-left: 2.5rem;'); // our own style
    expect(res.stats.reusedClasses).toBe(0);
  });

  it('prefers the Designer copy over a CSS copy of the same class', () => {
    let lib = add(EMPTY_STYLE_LIBRARY, stylesToLibraryClasses(SITE));
    lib = addLibrarySource(lib, { kind: 'css-text', classes: cssToLibraryClasses('.padding-global { padding-left: 9rem }').classes, variables: [] }, NOW).library;
    const res = run('<div class="padding-global">x</div>', PG_CSS, { siteStyles: librarySiteStyles(lib) });
    expect(res.stats.reusedClasses).toBe(1);
    expect(style(res, 'padding-global')._id).toBe(SITE[0]!._id);
  });
});
