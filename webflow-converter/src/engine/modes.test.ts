import { describe, expect, it } from 'vitest';
import { convert, validateXscp } from './index';
import { embedCodes, embeddedCss, style } from './testHelpers';

describe('combined vs separate input modes', () => {
  const doc = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"><title>T</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" rel="stylesheet">
  <link rel="icon" href="/favicon.ico">
  <style>.card { padding: 1rem; } .card .t { color: red; }</style>
</head>
<body>
  <div class="card"><p class="t">Hi</p></div>
  <script>console.log('inline');</script>
</body>
</html>`;

  it('combined: extracts <style>, <script> and font <link>s from a full document', () => {
    const res = convert({ mode: 'combined', html: doc });
    expect(validateXscp(res.data)).toEqual([]);
    expect(style(res, 'card').styleLess).toContain('padding-top: 1rem;');
    // .card is styled natively, so the embed reaches it through data-wfc; .t has no native style.
    expect(embeddedCss(res)).toContain('[data-wfc~="card"] .t');
    const codes = embedCodes(res);
    expect(codes[0]).toContain('fonts.googleapis.com/css2');
    expect(codes[0]).not.toContain('favicon');
    expect(codes.some((c) => c.includes("console.log('inline')"))).toBe(true);
    // <head> content never becomes nodes.
    expect(res.json).not.toContain('"title"');
  });

  it('separate: merges editor CSS after inline <style>, editor JS after inline <script>', () => {
    const res = convert({
      mode: 'separate',
      html: '<style>.a { color: red; }</style><div class="a"></div><script>first()</script>',
      css: '.a { color: blue; } .a .b { margin: 0 }',
      js: 'second()',
    });
    expect(validateXscp(res.data)).toEqual([]);
    expect(style(res, 'a').styleLess).toBe('color: blue;');
    const js = embedCodes(res).filter((c) => c.includes('<script')).join('\n');
    expect(js.indexOf('first()')).toBeLessThan(js.indexOf('second()'));
  });

  it('separate: works with a plain fragment and no CSS/JS', () => {
    const res = convert({ mode: 'separate', html: '<h2 class="t">x</h2>', css: '', js: '' });
    expect(validateXscp(res.data)).toEqual([]);
    expect(res.stats).toEqual({ nodes: 2, styles: 1, embeds: 0, embeddedCssRules: 0, jsBytes: 0 });
  });

  it('separate: CSS/JS without HTML still produces a valid payload of embeds', () => {
    const res = convert({ mode: 'separate', html: '', css: '.x .y { color: red }', js: 'go()' });
    expect(validateXscp(res.data)).toEqual([]);
    expect(res.stats.embeds).toBe(2);
    expect(res.warnings.some((w) => w.code === 'empty-input')).toBe(false);
  });

  it('never throws on garbage input', () => {
    const inputs = ['<<<>>>', '<div', '</p></div>', '<style>}}}{{{</style><div class="a">x', '\u0000\u0001'];
    for (const html of inputs) {
      const res = convert({ mode: 'combined', html });
      expect(validateXscp(res.data)).toEqual([]);
      expect(JSON.parse(res.json)).toEqual(res.data);
    }
  });
});
