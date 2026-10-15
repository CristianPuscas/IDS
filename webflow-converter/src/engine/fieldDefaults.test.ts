import { describe, expect, it } from 'vitest';
import { convert, validateXscp, type ConvertOptions } from './index';
import { classNames, first, style } from './testHelpers';

const run = (html: string, css = '', options: Partial<ConvertOptions> = {}) => {
  const res = convert({ mode: 'separate', html: `<form action="/x">${html}</form>`, css, js: '' }, { forms: 'native', ...options });
  expect(validateXscp(res.data)).toEqual([]);
  return res;
};

describe('native field defaults (.w-input / .w-select / .w-checkbox)', () => {
  it('gives a select with only padding set height:auto and the other source values', () => {
    const res = run('<select class="calc_select" name="s"><option>A</option></select>', '.calc_select{padding:1rem}');
    const s = style(res, 'calc_select').styleLess;
    expect(s).toContain('height: auto;');
    expect(s).toContain('margin-bottom: 0px;');
    expect(s).toContain('display: inline-block;');
    expect(s).toContain('width: auto;');
    expect(s).toContain('background-color: #ffffff;'); // .w-select is #f3f3f3
    expect(s).toContain('color: #000000;');
    expect(s).toContain('border-top-color: #767676;');
    expect(s).toContain('font-size: 13.3333px;');
    expect(s).toContain('line-height: normal;');
    expect(s).toContain('padding-top: 1rem;');
    expect(s).not.toMatch(/padding-top: 0px/);
  });

  it('adds nothing the source class already sets, and keeps the focus border colour', () => {
    const css =
      '.f { display: block; width: 100%; height: 3rem; margin: 0 0 1rem; padding: .5rem; border: 2px solid #0a0; background-color: #fff; color: #111; font: 16px/1.5 Inter, sans-serif; vertical-align: top; }';
    const res = run('<input class="f" name="a">', css);
    const st = style(res, 'f');
    expect(st.styleLess).toBe(
      'display: block; width: 100%; height: 3rem; margin-top: 0; margin-right: 0; margin-bottom: 1rem; margin-left: 0; padding-top: .5rem; padding-right: .5rem; padding-bottom: .5rem; padding-left: .5rem; border-top-style: solid; border-top-width: 2px; border-top-color: #0a0; border-right-style: solid; border-right-width: 2px; border-right-color: #0a0; border-bottom-style: solid; border-bottom-width: 2px; border-bottom-color: #0a0; border-left-style: solid; border-left-width: 2px; border-left-color: #0a0; background-color: #fff; color: #111; font: 16px/1.5 Inter, sans-serif; vertical-align: top;',
    );
    expect(st.variants.main_focus).toEqual({ styleLess: 'border-top-color: #0a0; border-right-color: #0a0; border-bottom-color: #0a0; border-left-color: #0a0;' });
  });

  it('leaves :focus alone when the source styles it', () => {
    const res = run('<input class="f" name="a">', '.f { border: 1px solid red } .f:focus { border-color: blue }');
    expect(style(res, 'f').variants.main_focus).toEqual({ styleLess: 'border-top-color: blue; border-right-color: blue; border-bottom-color: blue; border-left-color: blue;' });
  });

  it('copies a weaker tag rule the .w-input class would beat', () => {
    const res = run('<input class="f" name="a">', 'input { height: 44px } .f { padding: 1rem }');
    expect(style(res, 'f').styleLess).toContain('height: 44px;');
  });

  it('does not add height to a textarea (textarea.w-input is height: auto)', () => {
    const res = run('<textarea class="t" name="m"></textarea>', '.t { padding: 1rem }');
    const s = style(res, 't').styleLess;
    expect(s).not.toMatch(/(^|; )height:/);
    expect(s).toContain('font-family: monospace;');
    expect(s).toContain('border-top-color: #767676;'); // 1px solid like .w-input: only the colour differs
  });

  it('gives a classless field a generated class first in its list', () => {
    const res = run('<input name="a">');
    const input = first(res, 'FormTextInput');
    expect(classNames(res, input)).toEqual(['field']);
    expect(style(res, 'field').styleLess).toContain('height: auto;');
  });

  it('cancels the .w-checkbox-input float and offset, and the bare wrapper padding', () => {
    const res = run('<input type="checkbox" class="cb" name="ok">', '.cb { width: 1rem; height: 1rem }');
    expect(style(res, 'cb').styleLess).toContain('float: none;');
    expect(style(res, 'cb').styleLess).toContain('margin-left: 4px;');
    expect(classNames(res, first(res, 'FormCheckboxWrapper'))).toEqual(['checkbox-field']);
    expect(style(res, 'checkbox-field').styleLess).toBe('display: inline; margin-bottom: 0px; padding-left: 0px;');
  });

  it('splits differing values onto an is-field-ua combo when fields share a class', () => {
    const res = run('<input class="c" name="a"><textarea class="c" name="b"></textarea>', '.c { padding: 1rem }');
    // The input's 2px inset border and the textarea's monospace font differ: each gets a combo.
    const input = classNames(res, first(res, 'FormTextInput'));
    const area = classNames(res, first(res, 'FormTextarea'));
    expect(input[0]).toBe('c');
    expect(area[0]).toBe('c');
    expect(style(res, input[1]!, '&').styleLess).toContain('border-top-style: inset;');
    expect(style(res, area[1]!, '&').styleLess).toBe('font-family: monospace;');
    expect(style(res, 'c').styleLess).toContain('height: auto;');
  });
});
