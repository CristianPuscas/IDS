import { describe, expect, it } from 'vitest';
import { parseCss } from './cssParser';
import { planCssVariables, resolveVars } from './cssVariables';
import { convert } from './index';
import { embeddedCss, style } from './testHelpers';

describe('resolveVars', () => {
  const table = new Map([
    ['--a', '#111'],
    ['--b', 'var(--a)'],
    ['--loop', 'var(--loop)'],
  ]);

  it('replaces known variables, nested ones and fallbacks', () => {
    expect(resolveVars('1px solid var(--b)', table)).toBe('1px solid #111');
    expect(resolveVars('var(--missing, var(--a))', table)).toBe('#111');
    expect(resolveVars('var(--missing, rgba(0, 0, 0, 0.5))', table)).toBe('rgba(0, 0, 0, 0.5)');
    expect(resolveVars('calc(var(--x) + 1px)', table)).toBe('calc(var(--x) + 1px)');
  });

  it('leaves cycles and unknown names alone', () => {
    expect(resolveVars('var(--loop)', table)).toBe('var(--loop)');
    expect(resolveVars('var(--nope)', table)).toBe('var(--nope)');
  });
});

describe('planCssVariables', () => {
  const css = `:root { --brand: #f5a524; --text: #14181f; font-size: 18px }
@media (prefers-color-scheme: dark) { :root { --text: #fff } }
.dark { --brand: #000 }
.btn { background-color: var(--brand); color: var(--text); border-color: var(--undefined) }
body { color: var(--text); background: var(--brand) }`;

  it("'inline' substitutes unconditional variables only and scopes every definition", () => {
    const plan = planCssVariables(parseCss(css).rules, 'inline');
    const btn = plan.rules.find((r) => r.selectors[0] === '.btn')!;
    // --brand is redefined on .dark and --text in a media query: both stay var().
    expect(btn.declarations.map((d) => d.value)).toEqual(['var(--brand)', 'var(--text)', 'var(--undefined)']);
    expect(plan.kept).toEqual(['--brand', '--text']);
    // The non-custom declaration stays on :root.
    expect(plan.rules.find((r) => r.selectors[0] === ':root')!.declarations.map((d) => d.property)).toEqual(['font-size']);
    expect(plan.scopedCss).toContain(`[data-h2w-vars="${plan.scopeId}"] {\n  --brand: #f5a524;\n  --text: #14181f;\n}`);
    expect(plan.scopedCss).toContain(`@media (prefers-color-scheme: dark) {\n[data-h2w-vars="${plan.scopeId}"] {\n  --text: #fff;\n}\n}`);
    // body is outside the pasted root: its var() get the unconditional values.
    const body = plan.rules.find((r) => r.selectors[0] === 'body')!;
    expect(body.declarations.map((d) => d.value)).toEqual(['#14181f', '#f5a524']);
  });

  it("'global' leaves everything as written", () => {
    const rules = parseCss(css).rules;
    const plan = planCssVariables(rules, 'global');
    expect(plan.rules).toEqual(rules);
    expect(plan.scopeId).toBeNull();
  });

  it('does nothing without page-wide variables', () => {
    const plan = planCssVariables(parseCss('.a { color: var(--x) }').rules, 'inline');
    expect(plan.scopeId).toBeNull();
    expect(plan.scopedCss).toBe('');
  });
});

describe('cssVariables in convert()', () => {
  const html = '<style>:root{--accent:#f5a524}.card{background-color:var(--accent)}</style><div class="card">x</div>';

  it('inlines by default and scopes the definitions on the payload root', () => {
    const res = convert({ mode: 'combined', html });
    expect(style(res, 'card').styleLess).toBe('background-color: #f5a524;');
    expect(embeddedCss(res)).toMatch(/\[data-h2w-vars="v[0-9a-f]{8}"\] \{\n {2}--accent: #f5a524;\n\}/);
    expect(embeddedCss(res)).not.toContain(':root');
  });

  it("without an embed, 'scope' falls back to inlining (there is nowhere to define the variables)", () => {
    const res = convert({ mode: 'combined', html }, { cssVariables: 'scope', keepUnsupportedInEmbed: false });
    expect(style(res, 'card').styleLess).toBe('background-color: #f5a524;');
    expect(JSON.stringify(res.data.payload.nodes)).not.toContain('data-h2w-vars');
  });
});
