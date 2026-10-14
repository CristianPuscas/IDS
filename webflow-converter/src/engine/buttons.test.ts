import { describe, expect, it } from 'vitest';
import { buttonNeutralizers } from './buttonDefaults';
import { parseCss } from './cssParser';
import { convert, validateXscp, type ConvertOptions } from './index';
import { classNames, elements, first, kids, style, textOf } from './testHelpers';
import type { WfElementNode } from './types';

const run = (html: string, css = '', options: Partial<ConvertOptions> = {}) => {
  const res = convert({ mode: 'separate', html, css, js: '' }, options);
  expect(validateXscp(res.data)).toEqual([]);
  return res;
};

/** Neutralizers for the first element matching `selector` in `html`. */
const neutralize = (html: string, css: string, selector: string) => {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return Object.fromEntries(buttonNeutralizers(doc.querySelector(selector)!, parseCss(css).rules).map((d) => [d.property, d.value]));
};

describe('buttonNeutralizers', () => {
  it('restores link defaults for an <a href> where .w-button would differ', () => {
    expect(neutralize('<a class="btn" href="/x">Go</a>', '.btn { background-color: red }', 'a')).toEqual({
      display: 'inline',
      'padding-top': '0px',
      'padding-right': '0px',
      'padding-bottom': '0px',
      'padding-left': '0px',
      color: '#0000ee',
      'text-decoration': 'underline',
    });
  });

  it('an <a> without href is not a link: inherited colour, no underline, auto cursor', () => {
    expect(neutralize('<a class="btn">Go</a>', '.btn { display: inline-block; padding: 0 }', 'a')).toEqual({
      'background-color': 'transparent',
      color: 'inherit',
      cursor: 'auto',
    });
  });

  it('restores the user-agent button styles for a <button>', () => {
    expect(neutralize('<button>Menu</button>', '', 'button')).toEqual({
      'padding-top': '1px',
      'padding-right': '6px',
      'padding-bottom': '1px',
      'padding-left': '6px',
      'background-color': '#efefef',
      color: '#000000',
      'border-top-width': '2px',
      'border-top-style': 'outset',
      'border-top-color': '#767676',
      'border-right-width': '2px',
      'border-right-style': 'outset',
      'border-right-color': '#767676',
      'border-bottom-width': '2px',
      'border-bottom-style': 'outset',
      'border-bottom-color': '#767676',
      'border-left-width': '2px',
      'border-left-style': 'outset',
      'border-left-color': '#767676',
      'line-height': 'normal',
      cursor: 'default',
    });
  });

  it('copies values from tag rules, which lose to .w-button in Webflow', () => {
    const css = 'button { background: none; border: 0; font: inherit; cursor: pointer; color: inherit; padding: 0 }';
    expect(neutralize('<button class="icon-btn">x</button>', css, 'button')).toEqual({
      'background-color': 'transparent',
      color: 'inherit',
      'padding-top': '0',
      'padding-right': '0',
      'padding-bottom': '0',
      'padding-left': '0',
    });
  });

  it('adds nothing when class rules already set every .w-button property', () => {
    const css =
      '.btn { display: inline-flex; padding: 1rem 2rem; background-color: #000; color: #fff; border: 0; line-height: 1; text-decoration: none; cursor: pointer; border-radius: 4px }';
    expect(neutralize('<a class="btn" href="#">Go</a>', css, 'a')).toEqual({});
  });

  it('ignores hover and media rules when deciding the resting value', () => {
    const css = '.btn:hover { color: red } @media (max-width: 767px) { .btn { color: blue } } .btn { background-color: #000; display: block; padding: 0; text-decoration: none }';
    expect(neutralize('<a class="btn" href="#">Go</a>', css, 'a')).toEqual({ color: '#0000ee' });
  });
});

describe('buttonMode: "button" (default)', () => {
  it('puts the neutralizers on the button base class, under the user CSS', () => {
    const res = run('<a class="btn" href="/x">Go</a>', '.btn { background-color: red; color: white }');
    expect(first(res, 'Link').data).toMatchObject({ button: true, block: '' });
    expect(style(res, 'btn').styleLess).toBe(
      'display: inline; padding-top: 0px; padding-right: 0px; padding-bottom: 0px; padding-left: 0px; text-decoration: underline; background-color: red; color: white;',
    );
    expect(res.warnings.some((w) => w.message.includes('.w-button defaults') && w.severity === 'info')).toBe(true);
  });

  it('a breakpoint value still overrides the neutralizer', () => {
    const res = run('<a class="btn" href="/x">Go</a>', '.btn { background-color: red; color: #fff; display: block; text-decoration: none; padding: 0 } @media (max-width: 767px) { .btn { padding: 1rem } }');
    const btn = style(res, 'btn');
    expect(btn.styleLess).toContain('padding-top: 0;');
    expect(btn.variants.small?.styleLess).toContain('padding-top: 1rem;');
  });

  it('combo classes that set a property keep it', () => {
    const res = run(
      '<a class="btn is-primary" href="#">A</a><a class="btn" href="#">B</a>',
      '.btn { padding: 1rem; display: inline-block; text-decoration: none; color: #fff } .btn.is-primary { background-color: blue }',
    );
    expect(style(res, 'btn').styleLess).toContain('background-color: transparent;');
    expect(style(res, 'is-primary', '&').styleLess).toBe('background-color: blue;');
  });

  it('gives a classless button a generated "button" class', () => {
    const res = run('<div><button>Menu</button><button>Close</button></div>');
    const links = elements(res).filter((e) => e.type === 'Link');
    expect(links.map((l) => classNames(res, l))).toEqual([['button'], ['button']]);
    expect(style(res, 'button').styleLess).toContain('background-color: #efefef;');
  });

  it('the generated class avoids existing class names', () => {
    const res = run('<div class="button"></div><button>Menu</button>', '.button { color: red }');
    expect(classNames(res, first(res, 'Link'))).toEqual(['button-2']);
    expect(style(res, 'button').styleLess).toBe('color: red;');
  });

  it('skips a base class shared with non-button elements, with a warning', () => {
    const res = run('<a class="btn" href="#">A</a><div class="btn">B</div>', '.btn { color: red }');
    expect(style(res, 'btn').styleLess).toBe('color: red;');
    expect(res.warnings.some((w) => w.severity === 'warning' && w.detail === 'btn' && w.message.includes('.w-button'))).toBe(true);
  });

  it('adds nothing for a fully styled button', () => {
    const css =
      '.button { display: inline-block; padding: 0.875rem 1.75rem; border-radius: 0.5rem; background-color: #146ef5; color: #ffffff; text-decoration: none; }';
    const res = run('<a href="#signup" class="button">Get started</a>', css);
    expect(style(res, 'button').styleLess).toBe(
      'display: inline-block; padding-top: 0.875rem; padding-right: 1.75rem; padding-bottom: 0.875rem; padding-left: 1.75rem; border-top-left-radius: 0.5rem; border-top-right-radius: 0.5rem; border-bottom-right-radius: 0.5rem; border-bottom-left-radius: 0.5rem; background-color: #146ef5; color: #ffffff; text-decoration: none;',
    );
    expect(res.warnings.some((w) => w.message.includes('.w-button defaults'))).toBe(false);
  });
});

describe('buttonMode: "linkBlock"', () => {
  it('emits a Link Block (no .w-button) with the content in a Text Block', () => {
    const res = run('<a class="btn" href="/x">Go <strong>now</strong></a>', '.btn { background-color: red }', { buttonMode: 'linkBlock' });
    const link = first(res, 'Link');
    expect(link.data).toMatchObject({ button: false, block: 'inline', link: { url: '/x' } });
    expect(classNames(res, link)).toEqual(['btn']);
    const [block] = kids(res, link) as WfElementNode[];
    expect(block).toMatchObject({ type: 'Block', classes: [], data: { text: true } });
    expect(textOf(res, block!)).toBe('Go now');
    expect(style(res, 'btn').styleLess).toBe('background-color: red;');
  });

  it('applies to <button> too', () => {
    const res = run('<button class="menu-toggle">Menu</button>', '', { buttonMode: 'linkBlock' });
    expect(first(res, 'Link').data).toMatchObject({ button: false, block: 'inline', xattr: [{ name: 'role', value: 'button' }] });
    expect(res.data.payload.styles.map((s) => s.name)).toEqual(['menu-toggle']);
  });
});
