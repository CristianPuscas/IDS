import { describe, expect, it } from 'vitest';
import { isClientFirstCore, isClientFirstUtility, missingCoreStructure } from './clientFirst';
import { convert, validateXscp, type ConvertOptions } from './index';
import { classNames, elements, embeddedCss, style } from './testHelpers';

describe('Client-First class list', () => {
  it('detects core and utility classes', () => {
    for (const name of [
      'page-wrapper',
      'main-wrapper',
      'padding-global',
      'container-small',
      'container-large',
      'padding-section-medium',
      'margin-bottom',
      'margin-large',
      'padding-0',
      'spacer-xxlarge',
      'spacing-clean',
      'max-width-medium',
      'max-width-full-tablet',
      'text-size-large',
      'text-weight-semibold',
      'text-style-allcaps',
      'text-align-center',
      'text-color-secondary',
      'heading-style-h2',
      'background-color-primary',
      'button',
      'button-group',
      'hide-mobile-landscape',
      'icon-1x1-small',
      'aspect-ratio-widescreen',
    ]) {
      expect(isClientFirstUtility(name), name).toBe(true);
    }
    expect(isClientFirstCore('padding-global')).toBe(true);
    expect(isClientFirstCore('text-size-large')).toBe(false);
  });

  it('never treats custom classes, is- combos or look-alikes as utilities', () => {
    for (const name of ['hero_content', 'nav_link', 'section_hero', 'is-large', 'heading-style-h7', 'text-size-huge', 'margin-big', 'container', 'card', 'buttons', 'padding-global-2']) {
      expect(isClientFirstUtility(name), name).toBe(false);
    }
  });

  it('reports what the core structure is missing', () => {
    expect(missingCoreStructure(['section_hero', 'padding-global', 'container-large'], 1)).toEqual([]);
    expect(missingCoreStructure(['hero', 'hero_title'], 2)).toEqual(['padding-global', 'container-[size]', 'section_[name]']);
    expect(missingCoreStructure(['section_hero', 'container-medium'], 0)).toEqual(['padding-global']);
    // A snippet without sections is too small to judge.
    expect(missingCoreStructure(['card', 'card_title'], 0)).toEqual([]);
  });
});

const run = (html: string, css = '', options: Partial<ConvertOptions> = {}) => {
  const res = convert({ mode: 'separate', html, css, js: '' }, options);
  expect(validateXscp(res.data)).toEqual([]);
  return res;
};

const CF_HTML =
  '<section class="section_hero"><div class="padding-global"><div class="container-large"><div class="hero_content is-dark"><h2 class="heading-style-h2">Hi</h2><p class="text-size-large">x</p></div></div></div></section>';
const CF_CSS =
  '.padding-global { padding-left: 2.5rem; padding-right: 2.5rem } .container-large { max-width: 80rem } .hero_content { display: flex } .hero_content.is-dark { color: white } .heading-style-h2 { font-size: 3rem } .text-size-large { font-size: 1.5rem } .heading-style-h2 .x { color: red }';

describe("clientFirstUtilities with a classPrefix", () => {
  it("'keep' (default) prefixes only custom classes and combos", () => {
    const res = run(CF_HTML, CF_CSS, { classPrefix: 'gi-' });
    const names = res.data.payload.styles.map((s) => s.name);
    expect(names).toEqual(expect.arrayContaining(['gi-section_hero', 'padding-global', 'container-large', 'gi-hero_content', 'gi-is-dark', 'heading-style-h2', 'text-size-large']));
    expect(names).not.toContain('gi-padding-global');
    expect(style(res, 'container-large').styleLess).toContain('max-width: 80rem;');
    const block = elements(res).find((e) => e.classes.length === 2)!;
    expect(classNames(res, block)).toEqual(['gi-hero_content', 'gi-is-dark']);
    expect(embeddedCss(res)).toContain('heading-style-h2"] .x');
    const info = res.warnings.find((w) => w.code === 'class-collision-risk')!;
    expect(info.severity).toBe('info');
    expect(info.items).toBeUndefined();
    expect(info.detail).toBe('padding-global, container-large, heading-style-h2, text-size-large');
  });

  it("'prefix' prefixes the utilities too and stays quiet about clashes", () => {
    const res = run(CF_HTML, CF_CSS, { classPrefix: 'gi-', clientFirstUtilities: 'prefix' });
    const names = res.data.payload.styles.map((s) => s.name);
    expect(names).toEqual(expect.arrayContaining(['gi-padding-global', 'gi-container-large', 'gi-heading-style-h2', 'gi-text-size-large', 'gi-hero_content']));
    expect(names.some((n) => !n.startsWith('gi-'))).toBe(false);
    expect(res.warnings.some((w) => w.code === 'class-collision-risk')).toBe(false);
  });

  it('has no effect without a prefix; an invalid value falls back to keep', () => {
    const a = run(CF_HTML, CF_CSS, { clientFirstUtilities: 'prefix' });
    expect(a.data.payload.styles.map((s) => s.name)).toContain('padding-global');
    const b = run(CF_HTML, CF_CSS, { classPrefix: 'gi-', clientFirstUtilities: 'weird' as never });
    expect(b.data.payload.styles.map((s) => s.name)).toContain('padding-global');
  });

  it('without a prefix, the clash warning calls Client-First utilities expected and suggests the prefix', () => {
    const res = run(CF_HTML, CF_CSS);
    const w = res.warnings.find((x) => x.code === 'class-collision-risk')!;
    expect(w.severity).toBe('warning');
    expect(w.message).toContain('expected to exist in a Client-First site');
    expect(w.message).toContain('name-2');
    expect(w.message).toContain('identical styles');
    expect(w.message).toContain('classPrefix');
    expect(w.message).toContain("import your site's styles");
    expect(w.detail).toBe('Client-First utility / core classes: padding-global, container-large, heading-style-h2, text-size-large');
    expect(w.items).toEqual(['padding-global', 'container-large', 'heading-style-h2', 'text-size-large']);
  });
});

describe('Client-First structure hint', () => {
  const hint = (res: ReturnType<typeof run>) => res.warnings.find((w) => w.code === 'client-first-structure');

  it('is quiet for the core structure', () => {
    expect(hint(run(CF_HTML, CF_CSS))).toBeUndefined();
  });

  it('is an info note when sections lack padding-global / container', () => {
    const res = run('<section class="hero"><div class="hero_inner"><h1>x</h1></div></section>', '.hero { padding: 2rem }');
    const w = hint(res)!;
    expect(w.severity).toBe('info');
    expect(w.message).toContain('padding-global / container-[size] / section_[name]');
    expect(w.message).toContain('only a hint');
  });

  it('is quiet for a small snippet without sections', () => {
    expect(hint(run('<div class="card"><p class="card_text">x</p></div>', '.card { color: red }'))).toBeUndefined();
  });
});
