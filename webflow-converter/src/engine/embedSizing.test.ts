import { describe, expect, it } from 'vitest';
import { convert, validateXscp, type ConvertOptions } from './index';
import { classNames, elements, embedCodes, embeddedCss, style } from './testHelpers';
import type { WfElementNode } from './types';

const run = (html: string, css = '', options: Partial<ConvertOptions> = {}) => {
  const res = convert({ mode: 'separate', html, css, js: '' }, options);
  expect(validateXscp(res.data)).toEqual([]);
  return res;
};

/** The Block that wraps the (first) HtmlEmbed whose code starts with `prefix`. */
const wrapperOf = (res: ReturnType<typeof run>, prefix: string): WfElementNode | undefined => {
  const embed = elements(res).find((e) => e.type === 'HtmlEmbed' && (e.v ?? '').startsWith(prefix))!;
  return elements(res).find((e) => e.children.includes(embed._id) && e.type === 'Block' && e.classes.length === 1);
};

describe('embed sizing wrapper (embedSizing: "wrapper", default)', () => {
  it('the example hero canvas (absolute, 100%) gets a classed wrapper and fills it', () => {
    const css = `.section_hero { position: relative; overflow: hidden; }
.hero_canvas { position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0.6; }`;
    const res = run('<section class="section_hero"><canvas class="hero_canvas" data-hero-canvas aria-hidden="true"></canvas><div class="x">Hi</div></section>', css);
    const wrap = wrapperOf(res, '<canvas')!;
    expect(classNames(res, wrap)).toEqual(['hero_canvas-embed']);
    expect(style(res, 'hero_canvas-embed').styleLess).toBe('position: absolute; left: 0; top: 0; display: grid; width: 100%; height: 100%;');
    expect(embedCodes(res)).toContain(
      '<canvas class="hero_canvas" data-hero-canvas="" aria-hidden="true" style="position: static; display: block; width: 100%; height: 100%;"></canvas>',
    );
    // Non-layout declarations stay with the element in the <style> embed.
    expect(embeddedCss(res)).toContain('opacity: 0.6;');
  });

  it('moves layout from an inline style and keeps the rest on the element', () => {
    const res = run('<div class="hero"><video class="bg" src="a.mp4" style="position:absolute; inset:0; width:100%; height:100%; object-fit:cover"></video></div>');
    expect(style(res, 'bg-embed').styleLess).toBe('position: absolute; left: 0; top: 0; right: 0; bottom: 0; display: grid; width: 100%; height: 100%;');
    expect(embedCodes(res)[0]).toBe('<video class="bg" src="a.mp4" style="object-fit: cover; position: static; display: block; width: 100%; height: 100%;"></video>');
  });

  it('carries breakpoint variants and display: none to the wrapper', () => {
    const res = run('<div><video class="vid" src="a.mp4"></video></div>', '.vid { width: 100%; aspect-ratio: 16 / 9 } @media (max-width: 767px) { .vid { display: none } }');
    const s = style(res, 'vid-embed');
    expect(s.styleLess).toBe('display: grid; width: 100%; aspect-ratio: 16 / 9;');
    expect(s.variants).toEqual({ small: { styleLess: 'display: none;' } });
  });

  it('honours descendant selectors and names a classless element after its tag', () => {
    const res = run('<div class="frame"><iframe src="https://example.com"></iframe></div>', '.frame iframe { height: 100%; border: 0 }');
    expect(classNames(res, wrapperOf(res, '<iframe')!)).toEqual(['iframe-embed']);
    expect(style(res, 'iframe-embed').styleLess).toBe('display: grid; height: 100%;');
  });

  it('shares one wrapper class between identical elements', () => {
    const res = run('<div><svg class="ico" viewBox="0 0 1 1"></svg><svg class="ico" viewBox="0 0 1 1"></svg></div>', '.ico { width: 50%; }');
    const wrappers = elements(res).filter((e) => e.type === 'Block' && e.classes.length === 1);
    expect(wrappers.map((w) => classNames(res, w))).toEqual([['ico-embed'], ['ico-embed']]);
    expect(res.data.payload.styles.filter((s) => s.name.startsWith('ico-embed'))).toHaveLength(1);
  });

  it('leaves fixed-size elements alone', () => {
    const res = run('<div><svg class="icon" viewBox="0 0 24 24"></svg></div>', '.icon { width: 24px; height: 24px; }');
    expect(wrapperOf(res, '<svg')).toBeUndefined();
    expect(embedCodes(res)).toContain('<svg class="icon" viewBox="0 0 24 24"></svg>');
  });

  it('can be turned off', () => {
    const res = run('<div><canvas class="c"></canvas></div>', '.c { position: absolute; inset: 0 }', { embedSizing: 'none' });
    expect(embedCodes(res)).toContain('<canvas class="c"></canvas>');
    expect(wrapperOf(res, '<canvas')).toBeUndefined();
    expect(res.data.payload.styles).toHaveLength(0);
  });
});
