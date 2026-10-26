import { describe, expect, it } from 'vitest';
import { parseCss, parseDeclarations, splitTopLevel, stripComments } from './cssParser';

describe('parseCss', () => {
  it('parses simple rules with comma-split selectors and source order', () => {
    const css = parseCss('.a { color: red; } .b, .c:hover { margin: 0 }');
    expect(css.rules).toHaveLength(2);
    expect(css.rules[0]!.selectors).toEqual(['.a']);
    expect(css.rules[1]!.selectors).toEqual(['.b', '.c:hover']);
    expect(css.rules[1]!.declarations).toEqual([{ property: 'margin', value: '0', important: false }]);
    expect(css.rules[0]!.order).toBeLessThan(css.rules[1]!.order);
    expect(css.warnings).toEqual([]);
  });

  it('removes comments but keeps comment-like text inside strings', () => {
    const css = parseCss('/* x { } */ .a { content: "/* not a comment */"; /* gone */ color: blue; }');
    expect(css.rules).toHaveLength(1);
    expect(css.rules[0]!.declarations).toEqual([
      { property: 'content', value: '"/* not a comment */"', important: false },
      { property: 'color', value: 'blue', important: false },
    ]);
    expect(stripComments('a/**/b')).toBe('a b');
  });

  it('does not split on semicolons or braces inside strings and url()', () => {
    const css = parseCss(`.a { background-image: url(data:image/svg+xml;utf8,<svg></svg>); content: "a;b}"; }`);
    expect(css.rules[0]!.declarations.map((d) => d.property)).toEqual(['background-image', 'content']);
    expect(css.rules[0]!.declarations[1]!.value).toBe('"a;b}"');
  });

  it('flattens nested @media and keeps the chain', () => {
    const css = parseCss('@media screen { @media (max-width: 767px) { .a { color: red } } .b { color: blue } }');
    expect(css.rules.map((r) => r.mediaStack)).toEqual([['screen', '(max-width: 767px)'], ['screen']]);
    expect(css.rules[0]!.media).toBe('screen and (max-width: 767px)');
  });

  it('keeps @keyframes, @font-face, @supports and @import verbatim as at-rules', () => {
    const css = parseCss(`
      @import url("https://fonts.googleapis.com/css2?family=Inter");
      @font-face { font-family: X; src: url(x.woff2); }
      @keyframes spin { from { transform: rotate(0) } to { transform: rotate(360deg) } }
      @supports (display: grid) { .a { display: grid } }
      .z { color: red }`);
    expect(css.atRules.map((a) => a.name)).toEqual(['import', 'font-face', 'keyframes', 'supports']);
    expect(css.atRules[2]!.raw).toContain('to { transform: rotate(360deg) }');
    expect(css.atRules[3]!.raw).toBe('@supports (display: grid) { .a { display: grid } }');
    expect(css.rules).toHaveLength(1);
  });

  it('keeps @keyframes found inside @media with their media chain', () => {
    const css = parseCss('@media (prefers-reduced-motion: no-preference) { @keyframes f { to { opacity: 1 } } }');
    expect(css.atRules[0]!.mediaStack).toEqual(['(prefers-reduced-motion: no-preference)']);
  });

  it('parses :root variables and !important', () => {
    const css = parseCss(':root { --Brand-Color: #f40; } .a { color: var(--Brand-Color) !important; }');
    expect(css.rules[0]!.declarations[0]).toEqual({ property: '--Brand-Color', value: '#f40', important: false });
    expect(css.rules[1]!.declarations[0]).toEqual({ property: 'color', value: 'var(--Brand-Color)', important: true });
  });

  it('keeps native CSS nesting verbatim', () => {
    const css = parseCss('.a { color: red; &:hover { color: blue } }');
    expect(css.rules).toHaveLength(0);
    expect(css.atRules[0]!.name).toBe('nested');
  });

  it('survives malformed CSS with warnings instead of throwing', () => {
    const css = parseCss('.a { color: red; } } .b { color: blue');
    expect(css.rules.map((r) => r.selectors[0])).toEqual(['.a', '.b']);
    expect(css.warnings.length).toBeGreaterThan(0);
    expect(css.warnings.every((w) => w.code === 'parse-error')).toBe(true);
  });
});

describe('parseDeclarations / splitTopLevel', () => {
  it('handles inline style attributes and collapses whitespace', () => {
    expect(parseDeclarations('color:red;  padding : 1rem\n 2rem ;;')).toEqual([
      { property: 'color', value: 'red', important: false },
      { property: 'padding', value: '1rem 2rem', important: false },
    ]);
  });

  it('splits on top-level commas only', () => {
    expect(splitTopLevel('.a, .b:not(.c, .d), [x="1,2"]', ',').map((s) => s.trim())).toEqual([
      '.a',
      '.b:not(.c, .d)',
      '[x="1,2"]',
    ]);
  });
});
