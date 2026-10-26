import { describe, expect, it } from 'vitest';
import { buildScriptEmbeds, buildStyleEmbeds, packChunks, splitJsStatements } from './embedBuilder';
import { convert, validateXscp } from './index';
import { extractJs } from './jsExtractor';
import { embedCodes, embeddedCss } from './testHelpers';

describe('script ordering', () => {
  it('puts import maps first, then CDN libraries, then inline code, then editor JS', () => {
    const res = convert({
      mode: 'separate',
      html: `<!doctype html><html><head>
        <script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"></script>
      </head><body>
        <div class="box"></div>
        <script>gsap.to('.box', { x: 100 });</script>
        <script src="https://unpkg.com/lenis@1.1.13/dist/lenis.min.js" defer></script>
        <script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js"}}</script>
        <script type="module">import * as THREE from 'three'; console.log(THREE);</script>
      </body></html>`,
      css: '',
      js: 'console.log("editor");',
    });
    expect(validateXscp(res.data)).toEqual([]);
    const js = embedCodes(res).filter((c) => c.includes('<script')).join('\n');
    const pos = [
      '<script type="importmap">',
      'gsap.min.js"></script>',
      'lenis.min.js" defer></script>',
      "gsap.to('.box'",
      '<script type="module">\nimport * as THREE',
      'console.log("editor")',
    ].map((s) => js.indexOf(s));
    expect(pos.every((p) => p >= 0)).toBe(true);
    expect([...pos].sort((a, b) => a - b)).toEqual(pos);
  });

  it('places script embeds last under the root and marks meta.script', () => {
    const res = convert({ mode: 'combined', html: '<div class="a"></div><script>console.log(1)</script>' });
    const root = res.data.payload.nodes[0]!;
    const lastId = 'children' in root ? root.children[root.children.length - 1] : '';
    const last = res.data.payload.nodes.find((n) => n._id === lastId)!;
    expect('type' in last && last.type).toBe('HtmlEmbed');
    expect('data' in last && last.data?.embed?.meta.script).toBe(true);
  });

  it('marks editor JS with import statements as a module', () => {
    const bundle = extractJs([], "import gsap from 'https://esm.sh/gsap';\ngsap.to('.a', {x: 1});");
    expect(bundle.scripts[0]!.attributes).toEqual([{ name: 'type', value: 'module' }]);
  });

  it('counts UTF-8 bytes of inline JS', () => {
    const bundle = extractJs([{ src: null, code: 'const s = "é";', attributes: [] }], '');
    expect(bundle.totalBytes).toBe(15);
  });

  it('escapes </script> inside inline code', () => {
    const out = buildScriptEmbeds({ scripts: [{ src: null, code: 'const s = "</script>";', attributes: [] }], totalBytes: 0, warnings: [] }, 10000);
    expect(out.nodes[0]!.v).toContain('"<\\/script>"');
  });
});

describe('embed size limits', () => {
  it('splits leftover CSS between rules so each embed stays under the limit', () => {
    const rules = Array.from({ length: 60 }, (_, i) => `.wrap .item-${i} { color: #${String(i).padStart(3, '0')}; margin: 0; }`).join('\n');
    const res = convert({ mode: 'separate', html: '<div class="wrap"></div>', css: rules, js: '' }, { maxEmbedChars: 800 });
    expect(validateXscp(res.data)).toEqual([]);
    const styles = embedCodes(res).filter((c) => c.startsWith('<style>'));
    expect(styles.length).toBeGreaterThan(3);
    for (const c of styles) {
      expect(c.length).toBeLessThanOrEqual(800);
      expect(c.endsWith('</style>')).toBe(true);
    }
    for (let i = 0; i < 60; i++) expect(embeddedCss(res)).toContain(`.wrap .item-${i} {`);
    expect(res.warnings.some((w) => w.code === 'embed-split')).toBe(true);
    expect(res.stats.embeddedCssRules).toBe(60);
  });

  it('wraps each chunk of a large media group in its own @media', () => {
    const inner = Array.from({ length: 30 }, (_, i) => `.x .y${i} { color: red; }`).join(' ');
    const res = convert({ mode: 'separate', html: '<div class="x"></div>', css: `@media (max-width: 600px) { ${inner} }`, js: '' }, { maxEmbedChars: 400, breakpointSnap: 'off' });
    const styles = embedCodes(res).filter((c) => c.startsWith('<style>'));
    expect(styles.length).toBeGreaterThan(1);
    for (const c of styles) expect(c).toMatch(/^<style>\n@media \(max-width: 600px\) \{/);
  });

  it('warns when one rule alone exceeds the limit', () => {
    const big = `.a .b { background-image: url("data:image/svg+xml;utf8,${'x'.repeat(1200)}"); }`;
    const out = buildStyleEmbeds([big], 500);
    expect(out.nodes).toHaveLength(1);
    expect(out.warnings.some((w) => w.code === 'embed-too-large')).toBe(true);
  });

  it('splits a large classic script between top-level statements', () => {
    const code = Array.from({ length: 80 }, (_, i) => `function f${i}() {\n  return ${i} / 2;\n}\nconst v${i} = f${i}();`).join('\n');
    const res = convert({ mode: 'separate', html: '<div></div>', css: '', js: code }, { maxScriptEmbedChars: 1000 });
    expect(validateXscp(res.data)).toEqual([]);
    const scripts = embedCodes(res).filter((c) => c.includes('<script'));
    expect(scripts.length).toBeGreaterThan(2);
    for (const c of scripts) expect(c.length).toBeLessThanOrEqual(1000);
    const joined = scripts.join('\n');
    for (let i = 0; i < 80; i++) expect(joined).toContain(`function f${i}() {\n  return ${i} / 2;\n}`);
    expect(res.stats.jsBytes).toBe(new TextEncoder().encode(code).length);
  });

  it('does not split modules and warns instead', () => {
    const code = `import x from 'y';\n${'console.log(1);\n'.repeat(100)}`;
    const out = buildScriptEmbeds({ scripts: [{ src: null, code, attributes: [{ name: 'type', value: 'module' }] }], totalBytes: 0, warnings: [] }, 500);
    expect(out.nodes).toHaveLength(1);
    expect(out.warnings.some((w) => w.code === 'embed-too-large')).toBe(true);
  });
});

describe('splitJsStatements', () => {
  it('never splits inside strings, templates, regexes, comments or blocks', () => {
    const code = [
      'const a = "x;\\n}";',
      'const re = /[;}]\\n/g;',
      'const t = `a ${ { b: 1 }.b }\n;}\n`;',
      '// comment ;}\n',
      'if (a) {',
      '  run();',
      '}',
      'else {',
      '  stop();',
      '}',
      'promise',
      '  .then(() => 1);',
      'const last = 1;',
    ].join('\n');
    const pieces = splitJsStatements(code, 1);
    const joined = pieces.join('\n');
    // Every piece must be one of the intended statements.
    expect(pieces.some((p) => p.startsWith('if (a)') && p.includes('else {'))).toBe(true);
    expect(pieces.some((p) => p.startsWith('promise') && p.includes('.then'))).toBe(true);
    expect(pieces.some((p) => p.startsWith('const t = `') && p.includes(';}\n`;'))).toBe(true);
    expect(joined.replace(/\s/g, '')).toBe(code.replace(/\s/g, ''));
  });

  it('returns the code whole when there is no top-level boundary (IIFE)', () => {
    const code = '(function () {\n  const a = 1;\n  console.log(a);\n})();';
    expect(splitJsStatements(code, 10)).toEqual([code]);
  });
});

describe('packChunks', () => {
  it('packs greedily and keeps order', () => {
    expect(packChunks(['aaa', 'bbb', 'ccc'], 7, '', '', '\n')).toEqual(['aaa\nbbb', 'ccc']);
  });
});
