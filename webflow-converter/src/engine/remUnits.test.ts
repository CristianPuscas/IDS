import { describe, expect, it } from 'vitest';
import { convert, validateXscp, type ConvertOptions, type WfStyle } from './index';
import { embeddedCss, first, style } from './testHelpers';

const CSS = `
:root { --space: 24px; --radius: 8px; --hairline: 1px; }
.card { padding: 24px 32px; margin: 0 auto; gap: 16px; border: 1px solid #ddd; border-radius: 12px; outline-offset: 2px;
  box-shadow: 0 4px 12px rgba(0,0,0,.1); width: calc(100% - 48px); max-width: 50%; min-height: 100vh; font-size: 18px;
  line-height: 1.5; letter-spacing: 0.1em; transform: translateY(-8px); border-bottom: var(--hairline) solid red; }
.card_title { margin-bottom: var(--space); border-radius: var(--radius); font: 700 20px/28px Inter, sans-serif; }
.card:hover { box-shadow: 0 8px 24px rgba(0,0,0,.2); }
.card h3 { margin-top: 12px; }
.card::after { content: "12px"; inset: -4px; border-width: 2px; }
@keyframes rise { from { transform: translateY(20px); } to { transform: none; } }
@media (max-width: 767px) { .card { padding: 16px; } .card p { font-size: 14px; } }
@media (max-width: 600px) { .card { gap: 8px; } }
`;
const HTML = '<div class="card"><h3 class="card_title">Title</h3><p>Text</p></div>';

const run = (options: Partial<ConvertOptions> = {}, html = HTML, css = CSS) => {
  const res = convert({ mode: 'separate', html, css, js: '' }, { breakpointSnap: 'off', ...options });
  expect(validateXscp(res.data)).toEqual([]);
  return res;
};

describe("units: 'rem' (default, Client-First)", () => {
  it('converts px to rem in native class styles, including shorthands, functions and states', () => {
    const card = style(run(), 'card');
    const s = card.styleLess;
    for (const decl of [
      'padding-top: 1.5rem;',
      'padding-right: 2rem;',
      'grid-column-gap: 1rem;',
      'box-shadow: 0 0.25rem 0.75rem rgba(0,0,0,.1);',
      'width: calc(100% - 3rem);',
      'font-size: 1.125rem;',
      'transform: translateY(-0.5rem);',
    ]) {
      expect(s, decl).toContain(decl);
    }
    expect(card.variants.main_hover?.styleLess).toBe('box-shadow: 0 0.5rem 1.5rem rgba(0,0,0,.2);');
    expect(card.variants.small?.styleLess).toContain('padding-top: 1rem;');
  });

  it('keeps px for border widths, radius and outline, and leaves 0, %, vh, em and unitless values alone', () => {
    const s = style(run(), 'card').styleLess;
    for (const decl of [
      'border-top-width: 1px;',
      'border-top-left-radius: 12px;',
      'outline-offset: 2px;',
      'margin-top: 0;',
      'max-width: 50%;',
      'min-height: 100vh;',
      'line-height: 1.5;',
      'letter-spacing: 0.1em;',
    ]) {
      expect(s, decl).toContain(decl);
    }
    expect(s).not.toMatch(/\d+px; (padding|margin|width|font-size)/);
  });

  it('converts inlined CSS variables against the property they end up in', () => {
    const res = run();
    const title = style(res, 'card_title').styleLess;
    expect(title).toContain('margin-bottom: 1.5rem;'); // --space: 24px
    expect(title).toContain('border-top-left-radius: 8px;'); // --radius stays px
    expect(style(res, 'card').styleLess).toContain('border-bottom-width: 1px;'); // --hairline in a border
    // The scoped definitions: --space converted, radius token and border-used variable kept in px.
    const css = embeddedCss(res);
    expect(css).toContain('--space: 1.5rem;');
    expect(css).toContain('--radius: 8px;');
    expect(css).toContain('--hairline: 1px;');
  });

  it('converts embed CSS (descendant rules, pseudo-elements, keyframes, off-grid media) but never @media breakpoints', () => {
    const css = embeddedCss(run());
    expect(css).toMatch(/h3 \{\s*margin-top: 0\.75rem;/);
    expect(css).toContain('content: "12px";');
    expect(css).toContain('inset: -0.25rem;');
    expect(css).toContain('border-width: 2px;');
    expect(css).toContain('transform: translateY(1.25rem);');
    expect(css).toContain('@media (max-width: 600px)');
    expect(css).toContain('gap: 0.5rem;');
    expect(css).toContain('@media (max-width: 767px)');
    expect(css).toContain('font-size: 0.875rem;');
    expect(css).not.toMatch(/max-width: \d+(\.\d+)?rem\)/);
  });

  it('converts inline styles mapped to classes', () => {
    const res = run({}, '<div style="padding: 20px; border: 2px solid red">x</div>', '');
    const s = res.data.payload.styles.find((x) => x.name.startsWith('inline-style'))!.styleLess;
    expect(s).toContain('padding-top: 1.25rem;');
    expect(s).toContain('border-top-width: 2px;');
  });

  it('is deterministic: same output and same combo suffix on every run', () => {
    const html = '<a class="btn is-big">x</a>';
    const css = '.btn { padding: 12px; } .btn.is-big { padding: 24px; color: red; }';
    const a = run({}, html, css);
    const b = run({}, html, css);
    expect(a.data.payload.styles).toEqual(b.data.payload.styles); // stable ids, names and declarations
    const combo = a.data.payload.styles.find((s) => s.comb === '&')!;
    expect(combo.name).toMatch(/^is-big-[0-9a-z]{4}$/);
    expect(combo.styleLess).toBe('padding-top: 1.5rem; padding-right: 1.5rem; padding-bottom: 1.5rem; padding-left: 1.5rem; color: red;');
    // Different units, different CSS: the suffix differs from the px output's.
    expect(run({ units: 'keep' }, html, css).data.payload.styles.find((s) => s.comb === '&')!.name).not.toBe(combo.name);
  });

  it('reuses a site class written in px when the converted value is the same (16px = 1rem)', () => {
    const site: WfStyle[] = [
      { _id: 'site-card', fake: false, type: 'class', name: 'box', namespace: '', comb: '', styleLess: 'padding-top: 16px; padding-right: 16px; padding-bottom: 16px; padding-left: 16px;', variants: {}, children: [], selector: null },
    ];
    const res = run({ siteStyles: site }, '<div class="box">x</div>', '.box { padding: 16px; }');
    expect(first(res, 'Block').classes).toContain('site-card');
    expect(res.stats.reusedClasses).toBe(1);
  });
});

describe("units: 'keep'", () => {
  it('leaves every unit as written, natively and in the embed', () => {
    const res = run({ units: 'keep' });
    const s = style(res, 'card').styleLess;
    expect(s).toContain('padding-top: 24px;');
    expect(s).toContain('width: calc(100% - 48px);');
    expect(style(res, 'card_title').styleLess).toContain('margin-bottom: 24px;');
    const css = embeddedCss(res);
    expect(css).toContain('transform: translateY(20px);');
    expect(css).toContain('--space: 24px;');
    expect(css).toMatch(/h3 \{\s*margin-top: 12px;/);
  });

  it('falls back to rem for an invalid value', () => {
    expect(style(run({ units: 'px' as never }), 'card').styleLess).toContain('padding-top: 1.5rem;');
  });
});
