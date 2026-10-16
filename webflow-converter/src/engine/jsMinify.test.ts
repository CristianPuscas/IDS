import { describe, expect, it } from 'vitest';
import { buildScriptEmbeds } from './embedBuilder';
import { loadTerserMinifier, minifyScript, parsesAsScript, stripJs } from './jsMinify';
import { convert, convertAsync, validateXscp } from './index';
import { embedCodes, elements } from './testHelpers';

/** A ~60 KB classic IIFE with comments and indentation (one top-level statement: unsplittable). */
function bigIife(target = 60_000): string {
  let body = '';
  for (let i = 0; body.length < target; i++) {
    body += `
  /* ---------- Section ${i}: synthetic block ---------- */
  // Formats a value for the counter with id ${i}.
  function format${i}(value, unit) {
    var text = String(value) + ' ' + (unit || 'kg');   // "100 kg"
    var re = /[\\s/]+/g;
    return \`\${text.replace(re, ' ')}  (#${i})\`;
  }
  document.querySelectorAll('[data-count-${i}]').forEach(function (el) {
    el.textContent = format${i}(el.getAttribute('data-count-${i}'), null);
  });
`;
  }
  return `(function () {\n  'use strict';${body}\n})();`;
}

describe('stripJs', () => {
  it.each([
    ['var a = b\n(c)', 'var a=b\n(c)'],
    ['x = y\n++z', 'x=y\n++z'],
    ['return\nx', 'return\nx'],
    ['a + +b', 'a+ +b'],
    ['a - -b', 'a- -b'],
    ['if (x) /a b/.test(y)', 'if(x)/a b/.test(y)'],
    ['var s = `a  ${ b + `c  ${d}` }  e`; f()', 'var s=`a  ${b+`c  ${d}`}  e`;f()'],
    ["t = 'a  b' // c\n, u = 1 .toString()", "t='a  b'\n,u=1 .toString()"],
    ['var o = { a: 1 }\nfoo()', 'var o={a:1}\nfoo()'],
    ['a++\nb', 'a++\nb'],
    ['let x = y / 2 / z', 'let x=y/2/z'],
    ['/*! keep */\nvar a = 1; /* drop */ var b = 2', '/*! keep */\nvar a=1;var b=2'],
    ['a = b\n/* x */\n  .c()', 'a=b\n.c()'],
  ])('%j -> %j', (input, output) => {
    expect(stripJs(input)).toBe(output);
    expect(parsesAsScript(output)).toBe(parsesAsScript(input));
  });

  it('shrinks a large IIFE by a third and keeps it parseable', () => {
    const code = bigIife();
    const out = stripJs(code);
    expect(out.length).toBeLessThan(code.length * 0.8);
    expect(parsesAsScript(out)).toBe(true);
  });
});

describe('minifyScript', () => {
  it('never returns code that does not parse', () => {
    expect(minifyScript('var a = ;', false, null)).toBeNull();
    expect(minifyScript('var a = 1', false, () => 'var a = ;')).toEqual({ code: 'var a=1', method: 'strip' });
  });

  it('does not strip modules without an injected minifier (no parse check possible)', () => {
    expect(minifyScript("import x from 'y';\n  x();", true, null)).toBeNull();
  });

  it('uses terser when loaded', async () => {
    const terser = await loadTerserMinifier();
    const m = minifyScript(bigIife(5000), false, terser)!;
    expect(m.method).toBe('minifier');
    expect(parsesAsScript(m.code)).toBe(true);
  });
});

describe('oversized scripts', () => {
  it('minifies a 60 KB IIFE into one embed under 50,000 characters', () => {
    const code = bigIife();
    expect(code.length).toBeGreaterThan(60_000);
    const res = convert({ mode: 'separate', html: '<div class="x"></div>', css: '', js: code });
    expect(validateXscp(res.data)).toEqual([]);
    const scripts = embedCodes(res).filter((c) => c.includes('<script'));
    for (const s of scripts) expect(s.length).toBeLessThanOrEqual(50_000);
    expect(res.externalScripts).toEqual([]);
    expect(res.warnings.some((w) => /minified \(comments and whitespace removed\)/.test(w.message))).toBe(true);
    const inner = scripts.join('\n').replace(/^<script>\n|\n<\/script>$/g, '');
    expect(parsesAsScript(inner)).toBe(true);
  });

  it('uses terser through convertAsync', async () => {
    const res = await convertAsync({ mode: 'separate', html: '<div></div>', css: '', js: bigIife() });
    expect(res.warnings.some((w) => /minified \(terser\)/.test(w.message))).toBe(true);
    for (const s of embedCodes(res)) expect(s.length).toBeLessThanOrEqual(50_000);
  });

  it('hands a script that cannot fit out as an external file with a placeholder embed', () => {
    const code = `(function () {\n  var data = "${'x'.repeat(60_000)}";\n  window.data = data;\n})();`;
    const res = convert({ mode: 'separate', html: '<div></div>', css: '', js: code });
    expect(validateXscp(res.data)).toEqual([]);
    expect(res.externalScripts).toEqual([{ name: 'script.js', code, type: '' }]);
    const placeholder = elements(res).find((e) => e.type === 'HtmlEmbed' && e.v!.startsWith('<!-- h2w: script.js'))!;
    expect(placeholder.data!.embed!.meta.script).toBe(false);
    for (const c of embedCodes(res)) expect(c.length).toBeLessThanOrEqual(50_000);
    const w = res.warnings.find((x) => x.code === 'embed-too-large')!;
    expect(w.severity).toBe('warning');
    expect(w.message).toContain('Download script.js');
    expect(w.message).toContain('Page Settings → Before </body>');
  });

  it('keeps scripts after an external one in their own embeds, in order', () => {
    const out = buildScriptEmbeds(
      {
        scripts: [
          { src: null, code: `var big = "${'y'.repeat(600)}";`, attributes: [] },
          { src: null, code: 'console.log(1);', attributes: [] },
        ],
        totalBytes: 0,
        warnings: [],
      },
      300,
    );
    expect(out.external.map((e) => e.name)).toEqual(['script.js']);
    expect(out.nodes.map((n) => n.v).join('\n')).toMatch(/^<!-- h2w: script\.js[\s\S]*console\.log\(1\);/);
    expect(out.wantsMinifier).toBe(true);
  });

  it('can turn minifying off', () => {
    const res = convert({ mode: 'separate', html: '<div></div>', css: '', js: bigIife() }, { minifyScripts: false });
    expect(res.externalScripts).toHaveLength(1);
  });
});
