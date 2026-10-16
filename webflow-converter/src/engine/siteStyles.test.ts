import { describe, expect, it } from 'vitest';
import { convert, mergeSiteStyles, parseSiteStyles, siteClassKey, validateXscp, type ConvertOptions, type WfStyle } from './index';
import { isUuidShaped, stableUuid } from './ids';
import { matchSiteStyles, parseStyleLess, splitDuplicateSuffix } from './siteStyles';
import { classNames, elements, embeddedCss, first, style } from './testHelpers';
import SITE_COPY from './__fixtures__/client-first-site-copy.json?raw';


const SITE = parseSiteStyles(SITE_COPY).styles;
const site = (name: string): WfStyle => SITE.find((s) => s.name === name)!;

const run = (html: string, css = '', options: Partial<ConvertOptions> = {}) => {
  const res = convert({ mode: 'separate', html, css, js: '' }, options);
  expect(validateXscp(res.data)).toEqual([]);
  return res;
};

describe('parseSiteStyles', () => {
  it('reads every class style of a Designer clipboard verbatim, unknown fields included', () => {
    const parsed = parseSiteStyles(SITE_COPY);
    expect(parsed.error).toBeUndefined();
    expect(parsed.styles.map((s) => s.name)).toEqual(['padding-global', 'container-large', 'heading-style-h2', 'button', 'is-secondary', 'is-small']);
    const raw = JSON.parse(SITE_COPY).payload.styles[0];
    expect(parsed.styles[0]).toEqual(raw);
    expect(Object.keys(parsed.styles[0]!)).toEqual(Object.keys(raw));
    expect(parsed.styles[0]!.createdBy).toBe('5e8f3a2b1c4d6e7f8a9b0c1d');
  });

  it('accepts { payload: { styles } } and bare arrays, and skips invalid entries', () => {
    const one = { _id: 'a', type: 'class', name: 'x', comb: '', styleLess: '', variants: {}, children: [] };
    expect(parseSiteStyles(JSON.stringify({ payload: { styles: [one, { _id: 'b', type: 'tag', name: 'h1' }, { type: 'class', name: 'y' }] } })).styles).toEqual([one]);
    expect(parseSiteStyles(JSON.stringify([one])).styles).toEqual([one]);
  });

  it('explains what went wrong', () => {
    expect(parseSiteStyles('').error).toMatch(/empty/);
    expect(parseSiteStyles('<div>').error).toMatch(/Ctrl\/Cmd\+C/);
    expect(parseSiteStyles('{"type":"other"}').error).toMatch(/Unexpected clipboard type/);
    expect(parseSiteStyles('{"type":"@webflow/XscpData","payload":{"nodes":[],"styles":[]}}').error).toMatch(/no classes/);
  });

  it('merges imports by _id and keeps the union of children', () => {
    const a = { ...site('button'), children: ['1'] };
    const b = { ...site('button'), children: ['2'] };
    const merged = mergeSiteStyles([a], [b, site('container-large')]);
    expect(merged).toHaveLength(2);
    expect(merged[0]!.children).toEqual(['1', '2']);
  });

  it('keys names the way Webflow slugifies them', () => {
    expect(siteClassKey('Container Large')).toBe('container-large');
    expect(siteClassKey('container-large')).toBe('container-large');
    expect(siteClassKey('Container Large 2')).toBe('container-large-2');
  });

  it('splits styleLess at top-level semicolons only', () => {
    const m = parseStyleLess('background-image: url("a;b.png"); font-family: "A; B", sans-serif; color: @raw<|var(--x)|>;');
    expect([...m.keys()]).toEqual(['background-image', 'font-family', 'color']);
  });
});

describe('reusing site classes', () => {
  const html =
    '<div class="padding-global"><div class="container-large"><h2 class="heading-style-h2">Hi</h2><a class="button is-secondary" href="#">Go</a><div class="hero_card">c</div></div></div>';
  const css = [
    '.padding-global { padding-left: 2.5rem; padding-right: 2.5rem }',
    '@media (max-width: 991px) { .padding-global { padding-left: 2rem; padding-right: 2rem } }',
    '@media (max-width: 767px) { .padding-global { padding-left: 1.25rem; padding-right: 1.25rem } }',
    '.container-large { width: 100%; max-width: 80rem; margin-left: auto; margin-right: auto }',
    '.hero_card { padding: 1rem }',
  ].join('\n');

  it('emits the site style object verbatim (same _id, same fields) and no duplicate', () => {
    const res = run(html, css, { siteStyles: SITE });
    const styles = res.data.payload.styles;
    for (const name of ['padding-global', 'container-large', 'heading-style-h2', 'button']) {
      const ours = styles.filter((s) => s.name === name && s.comb === '');
      expect(ours).toHaveLength(1);
      const { children: _c, ...rest } = ours[0]!;
      const { children: _s, ...siteRest } = site(name);
      expect(rest).toEqual(siteRest);
      expect(JSON.stringify(rest)).toBe(JSON.stringify(siteRest)); // same key order too
    }
    const wrapper = elements(res).find((e) => classNames(res, e)[0] === 'padding-global')!;
    expect(wrapper.classes).toEqual([site('padding-global')._id]);
    expect(res.stats.reusedClasses).toBe(5); // + the is-secondary combo under button
    expect(res.stats.newClasses).toBe(1); // hero_card
    const info = res.warnings.find((w) => w.code === 'site-classes' && w.severity === 'info')!;
    expect(info.message).toMatch(/^5 classes reuse your site's/);
  });

  it('identical source CSS needs no override; the clash warning skips reused classes', () => {
    const res = run('<div class="padding-global"><div class="container-large">x</div></div>', css.replace('.hero_card { padding: 1rem }', ''), { siteStyles: SITE });
    expect(res.warnings.some((w) => w.code === 'site-classes' && w.severity === 'warning')).toBe(false);
    expect(embeddedCss(res)).toBe('');
    expect(res.warnings.some((w) => w.code === 'class-collision-risk')).toBe(false);
  });

  it('chains a new combo onto a reused base, and reuses a site combo under its parent', () => {
    const res = run('<div><a class="button is-secondary" href="#">a</a><a class="button is-large" href="#">b</a></div>', '.button.is-large { font-size: 2rem }', {
      siteStyles: SITE,
    });
    const btn = style(res, 'button');
    expect(btn._id).toBe(site('button')._id);
    const secondary = style(res, 'is-secondary', '&');
    expect(secondary._id).toBe(site('is-secondary')._id);
    const large = style(res, 'is-large', '&');
    expect(SITE.some((s) => s._id === large._id)).toBe(false);
    expect(btn.children).toEqual([secondary._id, large._id]);
    expect(large.styleLess).toContain('font-size: 2rem;');
  });

  it('does not reuse a site combo under a different base', () => {
    const res = run('<div class="card is-secondary">x</div>', '.card { color: red } .card.is-secondary { color: blue }', { siteStyles: SITE, siteClassConflicts: 'reuse' });
    expect(SITE.some((s) => s._id === style(res, 'is-secondary', '&')._id)).toBe(false);
  });

  it('renames a combo that the site has with other styles (Webflow merges combos by name)', () => {
    const res = run('<div class="card is-secondary">x</div>', '.card { color: red } .card.is-secondary { color: blue }', { siteStyles: SITE });
    const combo = style(res, 'is-secondary-new', '&');
    expect(combo.styleLess).toBe('color: blue;');
    expect(res.data.payload.styles.some((s) => s.name === 'is-secondary')).toBe(false);
    expect(res.stats.renamedClasses).toBe(1);
  });

  it('keeps the site class unchanged and moves differing source CSS to a scoped embed override', () => {
    const res = run(
      '<div class="container-large"><p>x</p></div>',
      '.container-large { max-width: 70rem; margin-left: auto; margin-right: auto; width: 100% } @media (max-width: 767px) { .container-large { max-width: 100% } }',
      { siteStyles: SITE, siteClassConflicts: 'reuse' },
    );
    const s = style(res, 'container-large');
    expect(s.styleLess).toBe(site('container-large').styleLess);
    expect(s.variants).toEqual({});
    const embed = embeddedCss(res);
    expect(embed).toContain('[data-h2w-class~="container-large"] {\n  max-width: 70rem;\n}');
    expect(embed).toMatch(/@media \(max-width: 767px\) \{\n\[data-h2w-class~="container-large"\] \{\n {2}max-width: 100%;/);
    expect(embed).not.toContain('margin-left');
    const block = elements(res).find((e) => e.classes[0] === s._id)!;
    expect(block.data?.xattr).toContainEqual({ name: 'data-h2w-class', value: 'container-large' });
    const w = res.warnings.find((x) => x.code === 'site-classes' && x.severity === 'warning')!;
    expect(w.message).toContain("site's class is kept unchanged");
    expect(w.detail).toContain('container-large → main: max-width: 70rem | small: max-width: 100%');
  });

  it("siteClassOverrides 'drop' uses the site's styles as they are", () => {
    const res = run('<div class="container-large">x</div>', '.container-large { max-width: 70rem }', { siteStyles: SITE, siteClassOverrides: 'drop', siteClassConflicts: 'reuse' });
    expect(embeddedCss(res)).toBe('');
    expect(res.warnings.find((x) => x.code === 'site-classes' && x.severity === 'warning')!.message).toContain('dropped');
  });

  it('overrides states of reused classes with the matching pseudo-class', () => {
    const res = run('<a class="button" href="#">x</a>', '.button:hover { background-color: #ff0000 }', { siteStyles: SITE, buttonMode: 'linkBlock', siteClassConflicts: 'reuse' });
    expect(embeddedCss(res)).toContain('[data-h2w-class~="button"]:hover {\n  background-color: #ff0000;\n}');
  });

  it('matches names case- and space-insensitively, like Webflow selectors', () => {
    const renamed = SITE.map((s) => (s.name === 'container-large' ? { ...s, name: 'Container Large' } : s));
    const res = run('<div class="container-large">x</div>', '.container-large { width: 100%; max-width: 80rem; margin-left: auto; margin-right: auto }', { siteStyles: renamed });
    const out = res.data.payload.styles.find((s) => s._id === site('container-large')._id)!;
    expect(out.name).toBe('Container Large');
  });

  it('reuseSiteClasses: false ignores the import', () => {
    const res = run('<div class="container-large">x</div>', '.container-large { width: 100% }', { siteStyles: SITE, reuseSiteClasses: false });
    expect(style(res, 'container-large')._id).not.toBe(site('container-large')._id);
    expect(res.stats.reusedClasses).toBe(0);
  });
});

describe('stable class ids', () => {
  const html = '<div class="card is-big"><p class="card_text">x</p><p style="color:red">y</p></div>';
  const css = '.card { padding: 1rem } .card.is-big { padding: 2rem } .card_text { color: blue }';

  it('gives the same style ids on every run, and random node ids', () => {
    const a = run(html, css);
    const b = run(html, css);
    expect(a.data.payload.styles.map((s) => s._id)).toEqual(b.data.payload.styles.map((s) => s._id));
    expect(a.data.payload.styles.every((s) => isUuidShaped(s._id) && s._id[14] === '4')).toBe(true);
    expect(a.data.payload.nodes[0]!._id).not.toBe(b.data.payload.nodes[0]!._id);
  });

  it('changes the id when the CSS changes, and keeps chains distinct', () => {
    const a = run(html, css);
    const b = run(html, css.replace('padding: 1rem', 'padding: 3rem'));
    expect(style(a, 'card')._id).not.toBe(style(b, 'card')._id);
    expect(style(a, 'card_text')._id).toBe(style(b, 'card_text')._id);
    const c = run('<div><div class="a is-x">1</div><div class="b is-x">2</div></div>', '.is-x { color: red }');
    const combos = c.data.payload.styles.filter((s) => s.name === 'is-x');
    expect(new Set(combos.map((s) => s._id)).size).toBe(2);
  });

  it('stableClassIds: false keeps random ids', () => {
    const a = run(html, css, { stableClassIds: false });
    const b = run(html, css, { stableClassIds: false });
    expect(style(a, 'card')._id).not.toBe(style(b, 'card')._id);
  });

  it('stableUuid is deterministic and UUID-v4 shaped', () => {
    expect(stableUuid('x')).toBe(stableUuid('x'));
    expect(stableUuid('x')).not.toBe(stableUuid('y'));
    expect(stableUuid('x')).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

describe('skipClientFirstUtilityStyles', () => {
  it('empties Client-First utility base classes that are not imported, with a warning', () => {
    const res = run(
      '<div class="padding-global"><div class="container-large"><p class="hero_text">x</p></div></div>',
      '.padding-global { padding-left: 5% } .container-large { max-width: 80rem } .hero_text { color: red }',
      { skipClientFirstUtilityStyles: true, siteStyles: SITE.filter((s) => s.name === 'container-large'), siteClassConflicts: 'reuse' },
    );
    expect(style(res, 'padding-global').styleLess).toBe('');
    expect(style(res, 'hero_text').styleLess).toBe('color: red;');
    expect(style(res, 'container-large')._id).toBe(site('container-large')._id);
    const w = res.warnings.find((x) => x.code === 'site-classes' && x.message.includes('empty styles'))!;
    expect(w.detail).toBe('padding-global');
  });

  it('is off by default', () => {
    const res = run('<div class="padding-global">x</div>', '.padding-global { padding-left: 5% }');
    expect(style(res, 'padding-global').styleLess).toBe('padding-left: 5%;');
  });
});

describe('payload with site styles stays valid', () => {
  it('validates for a full Client-First page', () => {
    const res = run(
      '<div class="page-wrapper"><main class="main-wrapper"><section class="section_hero"><div class="padding-global"><div class="container-large"><div class="padding-section-large"><h2 class="heading-style-h2">T</h2><a class="button is-secondary is-small" href="#">Go</a></div></div></div></section></main></div>',
      '.section_hero { background: #000 } .button.is-secondary.is-small { font-size: 0.875rem }',
      { siteStyles: SITE },
    );
    expect(validateXscp(res.data)).toEqual([]);
    const link = first(res, 'Link');
    // is-small is a site combo of `button`, not of `button.is-secondary`: a new combo is created,
    // under a new name because the site's is-small has other styles (Webflow merges by name).
    expect(classNames(res, link)).toEqual(['button', 'is-secondary', 'is-small-new']);
    expect(link.classes[2]).not.toBe(site('is-small')._id);
  });
});

describe('matching site classes that Webflow numbered', () => {
  const cls = (id: string, name: string, styleLess = 'color: red;'): WfStyle => ({ _id: id, fake: false, type: 'class', name, namespace: '', comb: '', styleLess, variants: {}, children: [], selector: null });
  const ours = (name: string) => ({ classes: [name], style: cls(`ours-${name}`, name, 'color: blue;') });

  it('splits the " N" suffix like Webflow (getPrefix)', () => {
    expect(splitDuplicateSuffix('padding-global 5')).toEqual({ base: 'padding-global', n: 5 });
    expect(splitDuplicateSuffix('padding-global')).toEqual({ base: 'padding-global', n: 0 });
    expect(splitDuplicateSuffix('box-2')).toEqual({ base: 'box-2', n: 0 });
  });

  it('reuses "name N" when only a numbered copy was imported, and prefers the base name, then the lowest number', () => {
    expect(matchSiteStyles([ours('padding-global')], [cls('s5', 'padding-global 5')]).map((m) => m.site._id)).toEqual(['s5']);
    expect(matchSiteStyles([ours('padding-global')], [cls('s5', 'padding-global 5'), cls('s3', 'padding-global 3')]).map((m) => m.site._id)).toEqual(['s3']);
    expect(matchSiteStyles([ours('padding-global')], [cls('s5', 'padding-global 5'), cls('s0', 'padding-global')]).map((m) => m.site._id)).toEqual(['s0']);
    expect(matchSiteStyles([ours('container-large')], [cls('c', 'Container Large 2')]).map((m) => m.site._id)).toEqual(['c']);
  });

  it('pastes the numbered site class verbatim (name included) and routes differences to the embed', () => {
    const SITE_N: WfStyle[] = [{ ...site('padding-global'), _id: 'pg5', name: 'padding-global 5' }];
    const res = run('<div class="padding-global">x</div>', '.padding-global { padding-left: 3rem; padding-right: 3rem; }', { siteStyles: SITE_N });
    const out = res.data.payload.styles.filter((s) => s.name.startsWith('padding-global'));
    expect(out).toHaveLength(1);
    expect(out[0]!.name).toBe('padding-global 5');
    expect(classNames(res, elements(res).find((e) => e.classes.length > 0)!)).toEqual(['padding-global 5']);
    expect(embeddedCss(res)).toContain('[data-h2w-class~="padding-global"] {');
  });
});
