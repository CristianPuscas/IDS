import { describe, expect, it } from 'vitest';
import { convertCssTextUnits, convertRulesUnits, convertValueUnits, keepsPx, pxToRem, pxVariablesOf, remEquivalent } from './units';

const rem = (property: string, value: string) => convertValueUnits(property, value, 'rem');

describe('pxToRem', () => {
  it('divides by 16, at most 4 decimals, no trailing zeros', () => {
    expect(pxToRem(24)).toBe('1.5rem');
    expect(pxToRem(16)).toBe('1rem');
    expect(pxToRem(1)).toBe('0.0625rem');
    expect(pxToRem(10)).toBe('0.625rem');
    expect(pxToRem(13.3333)).toBe('0.8333rem');
    expect(pxToRem(1440)).toBe('90rem');
    expect(pxToRem(-20)).toBe('-1.25rem');
    expect(pxToRem(0.5)).toBe('0.0313rem');
  });

  it('returns 0 for values that round to zero', () => {
    expect(pxToRem(0)).toBe('0');
    expect(pxToRem(0.0001)).toBe('0');
    expect(pxToRem(-0.0001)).toBe('0');
  });
});

describe('convertValueUnits', () => {
  it('converts plain lengths and shorthands', () => {
    expect(rem('padding', '24px')).toBe('1.5rem');
    expect(rem('margin', '0 auto 32px')).toBe('0 auto 2rem');
    expect(rem('padding', '8px 12px 16px 20px')).toBe('0.5rem 0.75rem 1rem 1.25rem');
    expect(rem('gap', '24px 16px')).toBe('1.5rem 1rem');
    expect(rem('inset', '-10px 0 auto 4px')).toBe('-0.625rem 0 auto 0.25rem');
    expect(rem('font', 'italic 700 18px/28px Inter, sans-serif')).toBe('italic 700 1.125rem/1.75rem Inter, sans-serif');
    expect(rem('line-height', '24px')).toBe('1.5rem');
    expect(rem('letter-spacing', '-0.5px')).toBe('-0.0313rem');
    expect(rem('max-width', '1200px')).toBe('75rem');
  });

  it('converts lengths inside functions', () => {
    expect(rem('width', 'calc(100% - 48px)')).toBe('calc(100% - 3rem)');
    expect(rem('font-size', 'clamp(24px, 4vw, 48px)')).toBe('clamp(1.5rem, 4vw, 3rem)');
    expect(rem('width', 'min(100%, 640px)')).toBe('min(100%, 40rem)');
    expect(rem('height', 'max(50vh, 320px)')).toBe('max(50vh, 20rem)');
    expect(rem('grid-template-columns', 'repeat(auto-fill, minmax(240px, 1fr))')).toBe('repeat(auto-fill, minmax(15rem, 1fr))');
    expect(rem('grid-template-columns', '200px 1fr 200px')).toBe('12.5rem 1fr 12.5rem');
    expect(rem('transform', 'translate(-50%, 12px) translate3d(4px, 0, 0) rotate(45deg)')).toBe('translate(-50%, 0.75rem) translate3d(0.25rem, 0, 0) rotate(45deg)');
    expect(rem('transform', 'translateY(-8px) scale(1.05)')).toBe('translateY(-0.5rem) scale(1.05)');
    expect(rem('box-shadow', '0 4px 12px rgba(0, 0, 0, 0.1), inset 0 1px 0 #fff')).toBe('0 0.25rem 0.75rem rgba(0, 0, 0, 0.1), inset 0 0.0625rem 0 #fff');
    expect(rem('filter', 'blur(8px) drop-shadow(0 2px 4px black)')).toBe('blur(0.5rem) drop-shadow(0 0.125rem 0.25rem black)');
    expect(rem('padding', 'var(--x, 16px)')).toBe('var(--x, 1rem)');
  });

  it('keeps px in border-radius, border widths, outline, stroke and column-rule widths', () => {
    for (const [property, value] of [
      ['border-radius', '12px'],
      ['border-radius', '12px 12px 0 0 / 8px'],
      ['border-top-left-radius', '4px'],
      ['border-bottom-right-radius', '4px'],
      ['-webkit-border-radius', '4px'],
      ['border', '1px solid #ccc'],
      ['border-top', '2px dashed red'],
      ['border-left', '1px solid var(--border-color--primary)'],
      ['border-width', '1px 2px'],
      ['border-bottom-width', '1px'],
      ['border-inline-start-width', '1px'],
      ['border-block', '1px solid'],
      ['border-image-width', '10px'],
      ['outline', '2px solid blue'],
      ['outline-width', '2px'],
      ['outline-offset', '4px'],
      ['stroke-width', '1.5px'],
      ['-webkit-text-stroke', '1px black'],
      ['-webkit-text-stroke-width', '1px'],
      ['column-rule', '1px solid #ddd'],
      ['column-rule-width', '1px'],
    ]) {
      expect(rem(property!, value!), property).toBe(value);
      expect(keepsPx(property!), property).toBe(true);
    }
    expect(keepsPx('border-color')).toBe(false);
    expect(keepsPx('border-spacing')).toBe(false);
    expect(rem('border-spacing', '8px')).toBe('0.5rem');
  });

  it('leaves 0, %, viewport units, em, unitless numbers and other units alone', () => {
    expect(rem('margin', '0')).toBe('0');
    expect(rem('margin', '0px 16px')).toBe('0px 1rem');
    expect(rem('width', 'calc(100% - 0px)')).toBe('calc(100% - 0px)');
    expect(rem('width', '50%')).toBe('50%');
    expect(rem('height', '100vh')).toBe('100vh');
    expect(rem('min-height', '100dvh')).toBe('100dvh');
    expect(rem('width', '50vw')).toBe('50vw');
    expect(rem('padding', '1em 2rem')).toBe('1em 2rem');
    expect(rem('line-height', '1.5')).toBe('1.5');
    expect(rem('font-weight', '700')).toBe('700');
    expect(rem('transition', 'all 300ms ease 0.2s')).toBe('all 300ms ease 0.2s');
  });

  it('skips strings, url(), identifiers and hex colours', () => {
    expect(rem('content', '"12px"')).toBe('"12px"');
    expect(rem('background-image', 'url(img-24px.png)')).toBe('url(img-24px.png)');
    expect(rem('background', 'url("a 10px.png") 10px 20px / 32px no-repeat')).toBe('url("a 10px.png") 0.625rem 1.25rem / 2rem no-repeat');
    expect(rem('font-family', 'Font16px, sans-serif')).toBe('Font16px, sans-serif');
    expect(rem('grid-template-areas', '"a 10px"')).toBe('"a 10px"');
    expect(rem('animation-name', 'slide-10px')).toBe('slide-10px');
    expect(rem('color', '#100px')).toBe('#100px');
  });

  it('accepts uppercase PX and leading-dot or signed numbers', () => {
    expect(rem('padding', '32PX')).toBe('2rem');
    expect(rem('margin', '.5px +8px')).toBe('0.0313rem 0.5rem');
  });

  it('converts custom property definitions, except radius/border/outline/stroke tokens and px variables', () => {
    expect(rem('--space-medium', '24px')).toBe('1.5rem');
    expect(rem('--radius-small', '4px')).toBe('4px');
    expect(rem('--border-width', '1px')).toBe('1px');
    expect(rem('--outline-offset', '2px')).toBe('2px');
    expect(rem('--stroke', '1.5px')).toBe('1.5px');
    expect(convertValueUnits('--hairline', '1px', 'rem', { pxVariables: new Set(['--hairline']) })).toBe('1px');
  });

  it("returns the value unchanged with units: 'keep'", () => {
    expect(convertValueUnits('padding', '24px', 'keep')).toBe('24px');
    expect(convertCssTextUnits('.a { padding: 24px }', 'keep')).toBe('.a { padding: 24px }');
    const rules = [{ declarations: [{ property: 'padding', value: '24px', important: false }] }];
    expect(convertRulesUnits(rules, 'keep')[0]).toBe(rules[0]);
  });
});

describe('convertCssTextUnits', () => {
  it('converts declarations in keyframes, font-face and nested blocks, never at-rule preludes', () => {
    const css = '@keyframes up { from { transform: translateY(20px); opacity: 0 } to { transform: none } }';
    expect(convertCssTextUnits(css, 'rem')).toBe('@keyframes up { from { transform: translateY(1.25rem); opacity: 0 } to { transform: none } }');
    expect(convertCssTextUnits('@media (max-width: 767px) { .a { padding: 32px; border: 1px solid } }', 'rem')).toBe(
      '@media (max-width: 767px) { .a { padding: 2rem; border: 1px solid } }',
    );
    expect(convertCssTextUnits('@supports (gap: 10px) { .a { gap: 10px } }', 'rem')).toBe('@supports (gap: 10px) { .a { gap: 0.625rem } }');
    expect(convertCssTextUnits('@container card (min-width: 400px) { .t { font-size: 20px } }', 'rem')).toBe(
      '@container card (min-width: 400px) { .t { font-size: 1.25rem } }',
    );
    expect(convertCssTextUnits('.a { margin: 8px; &:hover { margin: 16px } }', 'rem')).toBe('.a { margin: 0.5rem; &:hover { margin: 1rem } }');
  });

  it('keeps statement at-rules, selectors, strings and data URLs intact', () => {
    expect(convertCssTextUnits('@import url(x.css) screen and (max-width: 600px);', 'rem')).toBe('@import url(x.css) screen and (max-width: 600px);');
    expect(convertCssTextUnits('.w-10px::before { content: "10px"; width: 10px }', 'rem')).toBe('.w-10px::before { content: "10px"; width: 0.625rem }');
    const dataUrl = '.i { background: url(data:image/svg+xml;utf8,<svg width="10px"></svg>) 0 0 / 24px }';
    expect(convertCssTextUnits(dataUrl, 'rem')).toBe('.i { background: url(data:image/svg+xml;utf8,<svg width="10px"></svg>) 0 0 / 1.5rem }');
  });

  it('converts scoped variable blocks, keeping px tokens', () => {
    const css = '[data-h2w-vars="v1"] {\n  --space: 24px;\n  --radius: 8px;\n  --bw: 2px;\n}';
    expect(convertCssTextUnits(css, 'rem', { pxVariables: new Set(['--bw']) })).toBe('[data-h2w-vars="v1"] {\n  --space: 1.5rem;\n  --radius: 8px;\n  --bw: 2px;\n}');
  });
});

describe('convertRulesUnits / pxVariablesOf', () => {
  it('finds variables used by exception properties and keeps their definitions in px', () => {
    const rules = [
      { declarations: [{ property: '--line', value: '1px', important: false }, { property: '--pad', value: '20px', important: false }] },
      { declarations: [{ property: 'border', value: 'var(--line) solid red', important: false }, { property: 'padding', value: 'var(--pad)', important: false }] },
    ];
    expect([...pxVariablesOf(rules)]).toEqual(['--line']);
    const out = convertRulesUnits(rules, 'rem');
    expect(out[0]!.declarations.map((d) => d.value)).toEqual(['1px', '1.25rem']);
    expect(out[1]).toBe(rules[1]); // unchanged rule objects are reused
  });
});

describe('remEquivalent', () => {
  it('writes px as rem so 16px compares equal to 1rem', () => {
    expect(remEquivalent('16px')).toBe('1rem');
    expect(remEquivalent('0 24px')).toBe('0 1.5rem');
    expect(remEquivalent('1rem')).toBe('1rem');
  });
});
