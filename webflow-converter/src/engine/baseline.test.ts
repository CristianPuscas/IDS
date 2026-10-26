import { describe, expect, it } from 'vitest';
import { buildBaselineReset, isFullDocument } from './baseline';
import { parseCss } from './cssParser';
import { convert, validateXscp, type ConvertOptions } from './index';
import { embeddedCss } from './testHelpers';

const doc = (css: string, body = '<div class="a">x</div>') => `<!DOCTYPE html><html><head><style>${css}</style></head><body>${body}</body></html>`;
const run = (html: string, options: Partial<ConvertOptions> = {}) => {
  const res = convert({ mode: 'combined', html }, options);
  expect(validateXscp(res.data)).toEqual([]);
  return res;
};

describe('baseline reset (neutralizeDefaults, F3)', () => {
  it('puts the reset first in the <style> embed of a full document, before the source rules', () => {
    const res = run(doc('.a { color: red } .b h3 { font-size: 16px }', '<div class="a"><div class="b"><h3>t</h3></div></div>'));
    const css = embeddedCss(res);
    expect(css.indexOf('body{')).toBeGreaterThan(-1);
    expect(css.indexOf('body{')).toBeLessThan(css.indexOf('.b h3') === -1 ? css.indexOf('h3 {') : css.indexOf('.b h3'));
    expect(css).toMatch(/body\{letter-spacing:normal;font-size:1rem;line-height:normal;color:CanvasText\}/);
    expect(res.warnings.some((w) => w.code === 'baseline-reset' && w.severity === 'info')).toBe(true);
  });

  it('uses bare tag selectors so it outranks the site tag styles it replaces', () => {
    const reset = buildBaselineReset([]);
    expect(reset).toContain('h1,h2,h3,h4,h5,h6{font-family:inherit;letter-spacing:inherit;line-height:inherit;color:inherit;text-transform:none;font-weight:bold}');
    expect(reset).not.toContain(':where(');
    expect(reset).toContain('p{margin:1em 0;letter-spacing:inherit}');
    expect(reset).toContain('label{display:inline;margin-bottom:0;font-weight:normal}');
    expect(reset).toContain('img{max-width:none;vertical-align:baseline}');
    expect(reset).toContain('ul,ol{margin:1em 0;padding-left:40px}');
    expect(reset).toContain('strong{font-weight:bolder}');
  });

  it('skips properties the source sets for that tag, including in selector lists', () => {
    const reset = buildBaselineReset(parseCss('h1,h2,h3,p{margin-top:0} body{line-height:1.6;color:#111} label{font:inherit;display:block;margin-bottom:5px}').rules);
    expect(reset).toContain('p{margin-right:0;margin-bottom:1em;margin-left:0;letter-spacing:inherit}');
    expect(reset).not.toMatch(/p\{[^}]*margin-top/);
    expect(reset).toContain('body{letter-spacing:normal;font-size:16px}');
    expect(reset).toContain('h4{font-size:1em;margin:1.33em 0}');
    expect(reset).not.toMatch(/(^|\n)label\{/); // font: inherit covers font-weight
  });

  it('ignores tag rules inside @media when deciding what the source sets', () => {
    expect(buildBaselineReset(parseCss('@media (max-width: 600px) { p { margin: 0 } }').rules)).toContain('p{margin:1em 0;');
  });

  it('is not added for a fragment, or when the option is off', () => {
    const frag = run('<style>.a{color:red} .a p{margin:0}</style><div class="a"><p>x</p></div>');
    expect(embeddedCss(frag)).not.toContain('Browser defaults');
    const off = run(doc('.a p { margin: 0 }', '<div class="a"><p>x</p></div>'), { neutralizeDefaults: false });
    expect(embeddedCss(off)).not.toContain('Browser defaults');
    expect(isFullDocument('<div>x</div>')).toBe(false);
    expect(isFullDocument('<!doctype html><p>x</p>')).toBe(true);
  });

  it('keeps @import first', () => {
    const res = run(doc('@import url("https://x.y/a.css"); .a { color: red } .a p { margin: 0 }', '<div class="a"><p>x</p></div>'));
    const css = embeddedCss(res);
    expect(css.indexOf('@import')).toBeLessThan(css.indexOf('Browser defaults'));
  });
});
