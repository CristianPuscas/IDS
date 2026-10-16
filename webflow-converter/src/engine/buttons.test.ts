import { describe, expect, it } from 'vitest';
import { buttonNeutralizers } from './buttonDefaults';
import { parseCss } from './cssParser';
import { BUTTON_CLICK_SHIM, convert, validateXscp, type ConvertOptions } from './index';
import { PRE_V8, classNames, elements, first, kids, style, textOf } from './testHelpers';
import type { WfElementNode } from './types';

const run = (html: string, css = '', options: Partial<ConvertOptions> = {}) => {
  const res = convert({ mode: 'separate', html, css, js: '' }, { ...PRE_V8, ...options });
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
      // The <button> user-agent font, lost when it becomes an <a> (F9).
      'font-family': 'Arial, sans-serif',
      'font-size': '13.3333px',
      'font-weight': '400',
      'font-style': 'normal',
      'letter-spacing': 'normal',
      'text-transform': 'none',
      'text-align': 'center',
    });
  });

  it('keeps the user-agent font props the source sets, on any rule', () => {
    const css = '.menu { font-size: 26px; text-align: left } * { letter-spacing: .1em }';
    const out = neutralize('<button class="menu">x</button>', css, 'button');
    expect(out).toMatchObject({ 'font-family': 'Arial, sans-serif', 'font-weight': '400', 'line-height': 'normal' });
    expect(out).not.toHaveProperty('font-size');
    expect(out).not.toHaveProperty('text-align');
    expect(out).not.toHaveProperty('letter-spacing');
  });

  it('an <a> gets no font declarations (it inherits in the source too)', () => {
    const out = neutralize('<a class="btn" href="#">Go</a>', '', 'a');
    expect(Object.keys(out).some((k) => k.startsWith('font') || k === 'text-align')).toBe(false);
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
      // `font: inherit` covers the font longhands; the text resets of the UA stay.
      'letter-spacing': 'normal',
      'text-transform': 'none',
      'text-align': 'center',
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
      'display: inline; padding-top: 0px; padding-right: 0px; padding-bottom: 0px; padding-left: 0px; background-color: red; color: white; text-decoration: underline;',
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

  it('puts the overrides on a combo when the base class is shared with non-button elements', () => {
    const res = run('<a class="btn" href="#">A</a><div class="btn">B</div>', '.btn { color: red }');
    expect(style(res, 'btn').styleLess).toBe('color: red;');
    const link = first(res, 'Link');
    expect(classNames(res, link)).toEqual(['btn', 'is-button-ua']);
    expect(style(res, 'is-button-ua', '&').styleLess).toContain('background-color: transparent;');
    expect(classNames(res, elements(res).find((e) => e.type === 'Block' && e.classes.length > 0)!)).toEqual(['btn']);
    expect(res.warnings.some((w) => w.message.includes('"btn" is also used by other elements'))).toBe(true);
  });

  it('adds nothing for a fully styled button', () => {
    const css =
      '.button { display: inline-block; padding: 0.875rem 1.75rem; border-radius: 0.5rem; background-color: #146ef5; color: #ffffff; text-decoration: none; }';
    const res = run('<a href="#signup" class="button">Get started</a>', css);
    expect(style(res, 'button').styleLess).toBe(
      'display: inline-block; padding-top: 0.875rem; padding-right: 1.75rem; padding-bottom: 0.875rem; padding-left: 1.75rem; border-top-left-radius: 0.5rem; border-top-right-radius: 0.5rem; border-bottom-left-radius: 0.5rem; border-bottom-right-radius: 0.5rem; background-color: #146ef5; color: #ffffff; text-decoration: none;',
    );
    expect(res.warnings.some((w) => w.message.includes('.w-button defaults'))).toBe(false);
  });
});

describe('buttons sharing a base class (F9)', () => {
  const css =
    '.button { display: inline-flex; padding: 13px 21px; background: green; color: white; font-size: 14px; border: 1px solid green; border-radius: 99px; text-decoration: none }';

  it('keeps <a class="button"> inheriting and gives <button class="button"> an is-button-ua combo', () => {
    const res = run(`<div><a class="button" href="#x">Link</a><button class="button" id="t">Toggle</button></div>`, css);
    const base = style(res, 'button');
    // Nothing that would change the links: no line-height, cursor or font on the shared base.
    expect(base.styleLess).not.toMatch(/line-height|cursor|font-family|text-align/);
    const combo = style(res, 'is-button-ua', '&');
    expect(combo.styleLess).toContain('line-height: normal;');
    expect(combo.styleLess).toContain('cursor: default;');
    expect(combo.styleLess).toContain('font-family: Arial, sans-serif;');
    expect(combo.styleLess).toContain('text-align: center;');
    expect(combo.styleLess).not.toContain('font-size');
    const [a, b] = elements(res).filter((e) => e.type === 'Link');
    expect(classNames(res, a!)).toEqual(['button']);
    expect(classNames(res, b!)).toEqual(['button', 'is-button-ua']);
    expect(base.children).toEqual([combo._id]);
  });

  it('puts agreed values on the base when every button is a <button>', () => {
    const res = run('<div><button class="menu">A</button><button class="menu">B</button></div>', '.menu { font-size: 26px }');
    expect(style(res, 'menu').styleLess).toContain('font-family: Arial, sans-serif;');
    expect(res.data.payload.styles.some((s) => s.name === 'is-button-ua')).toBe(false);
  });

  it('appends the combo after existing combos and inline styles', () => {
    const res = run(`<div><a class="button" href="#">A</a><button class="button is-outline" style="margin:0">B</button></div>`, css + ' .button.is-outline { background: none }');
    const b = elements(res).filter((e) => e.type === 'Link')[1]!;
    expect(classNames(res, b)).toEqual(['button', 'is-outline', 'inline-style-1', 'is-button-ua']);
  });
});

describe('button click shim (F8)', () => {
  it('marks converted <button>s and puts a preventDefault shim first in the script embed', () => {
    const res = convert({ mode: 'combined', html: '<div><button class="t" id="m">x</button><a class="btn" href="/x">y</a></div><script>init()</script>' });
    expect(validateXscp(res.data)).toEqual([]);
    const [b, a] = elements(res).filter((e) => e.type === 'Link');
    expect(b!.data!.xattr).toContainEqual({ name: 'data-h2w-button', value: '' });
    expect(a!.data!.xattr!.some((x) => x.name === 'data-h2w-button')).toBe(false);
    const js = elements(res).filter((e) => e.type === 'HtmlEmbed').pop()!.v!;
    expect(js.startsWith(`<script>\n${BUTTON_CLICK_SHIM}\n</script>`)).toBe(true);
    expect(js.indexOf('init()')).toBeGreaterThan(js.indexOf('preventDefault'));
  });

  it('adds a script embed for the shim when the page has no scripts', () => {
    const res = run('<button class="t">x</button>');
    const root = res.data.payload.nodes[0] as WfElementNode;
    expect(root.type).toBe('Block');
    const last = elements(res).find((e) => e._id === root.children[root.children.length - 1])!;
    expect(last.v).toContain(BUTTON_CLICK_SHIM);
  });

  it('can be turned off', () => {
    const res = run('<button class="t">x</button>', '', { buttonClickShim: false, rewriteRemappedTags: false });
    expect(first(res, 'Link').data!.xattr!.some((x) => x.name === 'data-h2w-button')).toBe(false);
    expect(elements(res).some((e) => e.type === 'HtmlEmbed')).toBe(false);
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
    expect(first(res, 'Link').data).toMatchObject({
      button: false,
      block: 'inline',
      xattr: [
        { name: 'role', value: 'button' },
        { name: 'data-h2w-button', value: '' },
      ],
    });
    expect(res.data.payload.styles.map((s) => s.name)).toEqual(['menu-toggle']);
  });
});

describe('buttonMode: "customElement"', () => {
  const opts = { buttonMode: 'customElement' } as const;

  it('keeps <button> as a Custom Element with all attributes and an explicit type', () => {
    const res = run('<button class="btn" id="go" aria-expanded="false" data-x>Go <span class="icon">→</span></button><button class="btn" type="submit">Send</button>', '.btn { padding: 1rem; background-color: #000; color: #fff; border: 0; font: 600 1rem Inter }', opts);
    const [a, b] = elements(res).filter((e) => e.type === 'DOM' && e.data?.tag === 'button');
    expect(a!.tag).toBe('div');
    expect(a!.data!.attributes).toEqual([
      { name: 'id', value: 'go' },
      { name: 'type', value: 'button' },
      { name: 'aria-expanded', value: 'false' },
      { name: 'data-x', value: '' },
    ]);
    expect(b!.data!.attributes).toContainEqual({ name: 'type', value: 'submit' });
    expect(classNames(res, a!)).toEqual(['btn']);
    expect(textOf(res, a!)).toBe('Go →');
    expect(elements(res).some((e) => e.type === 'Link')).toBe(false);
    expect(res.json).not.toContain('data-h2w-button');
    expect(embedJs(res)).not.toContain(BUTTON_CLICK_SHIM);
  });

  it('keeps the class styles native and restores what webflow.css resets on <button>', () => {
    const res = run('<button class="btn">Go</button>', '.btn { padding: 1rem; background-color: #000 }', opts);
    const s = style(res, 'btn').styleLess;
    expect(s).toContain('padding-top: 1rem;');
    expect(s).toContain('background-color: #000;');
    expect(s).toContain('font-family: Arial, sans-serif;');
    expect(s).toContain('border-top-style: outset;');
    expect(s).toContain('color: #000000;');
    expect(s).not.toMatch(/display|text-decoration/);
  });

  it('leaves <a class="button"> as a Webflow Button', () => {
    const res = run('<a class="button" href="/x">X</a>', '.button { padding: 1rem }', opts);
    expect(first(res, 'Link').data!.button).toBe(true);
  });
});

function embedJs(res: ReturnType<typeof convert>): string {
  return elements(res)
    .filter((e) => e.type === 'HtmlEmbed')
    .map((e) => e.v ?? '')
    .join('\n');
}
