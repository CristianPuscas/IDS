import { describe, expect, it } from 'vitest';
import { formName, scriptedFormReasons } from './forms';
import { convert, validateXscp, type ConvertOptions } from './index';
import { classNames, elements, embedCodes, embeddedCss, first, style } from './testHelpers';

const run = (html: string, css = '', js = '', options: Partial<ConvertOptions> = {}) => {
  const res = convert({ mode: 'separate', html, css, js }, options);
  expect(validateXscp(res.data)).toEqual([]);
  return res;
};

const CONTACT = `<section class="section_contact"><form class="contact_form" data-contact-form novalidate>
  <input class="contact_input" type="email" name="email" required data-validate="required email">
  <p class="contact_error" data-contact-error></p>
  <button type="submit" class="button" data-contact-submit>Send</button>
  <div class="contact_success" data-contact-success>Thanks!</div>
</form></section>`;
const CONTACT_CSS = '.contact_form { display: grid; gap: 1rem } .contact_input { padding: 1rem; border: 1px solid #333 } .button { background-color: #000; color: #fff; padding: 1rem 2rem }';
const CONTACT_JS = `document.querySelectorAll('[data-contact-form]').forEach(function (form) {
  form.addEventListener('submit', function (e) { e.preventDefault(); form.querySelector('[data-contact-submit]').textContent = 'Sending…'; });
});`;

describe('forms: "auto" (default)', () => {
  it('keeps a JS-driven contact form as a Code Embed with novalidate, <button type=submit> and styled classes', () => {
    const res = run(CONTACT, CONTACT_CSS, CONTACT_JS);
    expect(elements(res).some((e) => e.type === 'FormForm' || e.type === 'FormButton')).toBe(false);
    const form = embedCodes(res).find((c) => c.startsWith('<form'))!;
    expect(form).toContain('novalidate=""');
    expect(form).toContain('<button type="submit" class="button" data-contact-submit="">Send</button>');
    const css = embeddedCss(res);
    expect(css).toContain('.contact_form {\n  display: grid;');
    expect(css).toContain('.contact_input {\n  padding: 1rem;');
    expect(css).toContain('.button {\n  background-color: #000;');
    // Embedded classes are not turned into (unused) native styles.
    expect(res.data.payload.styles.some((s) => s.name === 'contact_input')).toBe(false);
    const w = res.warnings.find((x) => /is driven by custom JavaScript/.test(x.message))!;
    expect(w.message).toContain('it has novalidate');
    expect(w.message).toContain('the scripts handle submit events');
    expect(w.message).toContain('data-contact-form');
  });

  it('converts a plain <form action="/x"> with no scripts to a native Form Block', () => {
    const res = run('<form action="/x" class="signup"><input type="email" name="email" class="signup_input"><button type="submit">Join</button></form>', '.signup_input { padding: 1rem }');
    expect(first(res, 'FormForm').data!.attr!.action).toBe('/x');
    expect(first(res, 'FormTextInput')).toBeDefined();
    expect(first(res, 'FormButton')).toBeDefined();
    expect(embedCodes(res).some((c) => c.startsWith('<form'))).toBe(false);
  });

  it('keeps a form native when only an unrelated script is present', () => {
    const res = run('<form action="/x" id="search"><input name="q"></form>', '', "document.querySelector('.menu').addEventListener('click', toggle);");
    expect(first(res, 'FormForm')).toBeDefined();
  });

  it('embeds a form the scripts address by id', () => {
    const res = run('<form action="/x" id="quote"><input name="q"></form>', '', "const f = document.getElementById('quote'); f.reset();");
    expect(elements(res).some((e) => e.type === 'FormForm')).toBe(false);
    expect(res.warnings.find((w) => /is driven by custom JavaScript/.test(w.message))!.message).toContain('its id "quote"');
  });

  it('embeds a form without action that carries data hooks', () => {
    const res = run('<form class="calc"><input type="number" name="w" value="100" data-calc-number></form>');
    expect(embedCodes(res).find((c) => c.startsWith('<form'))).toContain('value="100"');
  });
});

describe('forms: "native" and "embed"', () => {
  it('warns when scripts drive a form that becomes native, and keeps its classes native', () => {
    const res = run(CONTACT, CONTACT_CSS, CONTACT_JS, { forms: 'native' });
    expect(first(res, 'FormForm')).toBeDefined();
    const w = res.warnings.find((x) => /looks driven by custom JavaScript/.test(x.message))!;
    expect(w.severity).toBe('warning');
    expect(w.message).toMatch(/alerts for empty required fields.*Turnstile/);
    expect(classNames(res, first(res, 'FormTextInput'))).toEqual(['contact_input']);
  });

  it('does not warn for a plain native form', () => {
    const res = run('<form action="/x"><input name="q"></form>', '', '', { forms: 'native' });
    expect(res.warnings.some((w) => /custom JavaScript/.test(w.message))).toBe(false);
  });

  it('embeds every form with forms: "embed"', () => {
    const res = run('<form action="/x"><input name="q"></form>', '', '', { forms: 'embed' });
    expect(embedCodes(res).some((c) => c.startsWith('<form'))).toBe(true);
  });
});

describe('number input values on native forms', () => {
  it('keeps value as a custom attribute with an "unverified" warning', () => {
    const res = run('<form action="/calc"><input type="number" name="weight" value="100" min="20"></form>', '', '', { forms: 'native' });
    const input = first(res, 'FormTextInput');
    expect(input.data!.attr!.type).toBe('number');
    expect(input.data!.xattr).toContainEqual({ name: 'value', value: '100' });
    expect(input.data!.xattr).toContainEqual({ name: 'min', value: '20' });
    expect(res.warnings.some((w) => /value="100".*unverified/.test(w.message))).toBe(true);
  });
});

describe('form names', () => {
  const doc = (html: string): Element => new DOMParser().parseFromString(html, 'text/html').querySelector('form')!;

  it('uses data-name, name, id, aria-label, aria-labelledby text, then a data hook', () => {
    expect(formName(doc('<form data-name="Lead" name="x" id="y"></form>'))).toBe('Lead');
    expect(formName(doc('<form id="contact"></form>'))).toBe('contact');
    expect(formName(doc('<form aria-label="Newsletter signup"></form>'))).toBe('Newsletter signup');
    expect(formName(doc('<h3 id="t">Book a  session</h3><form aria-labelledby="t"></form>'))).toBe('Book a session');
    expect(formName(doc('<form data-contact-form></form>'))).toBe('Contact Form');
    expect(formName(doc('<form></form>'))).toBe('Form');
  });

  it('names the native FormForm from its data hook', () => {
    const res = run('<form action="/x" data-newsletter><input name="e"></form>', '', '', { forms: 'native' });
    expect(first(res, 'FormForm').data!.form).toEqual({ type: 'form', name: 'Newsletter' });
  });

  it('lists the reasons for a scripted form', () => {
    const form = doc('<form novalidate data-calc-form><input data-calc-number></form>');
    expect(scriptedFormReasons(form, "form.addEventListener('submit', f); el.dataset.calcForm")).toEqual([
      'it has novalidate',
      'it has no action and has data attributes (data-calc-form, data-calc-number)',
      'the scripts handle submit events',
      'the scripts use its data-calc-form attribute',
    ]);
    expect(scriptedFormReasons(doc('<form action="/x"><input></form>'), 'form.onsubmit = f')).toEqual(['the scripts handle submit events']);
  });

  it('leaves form styles native for a native form (style still has its declarations)', () => {
    const res = run('<form action="/x" class="f"><input class="i" name="q"></form>', '.f { display: flex }');
    expect(style(res, 'f').styleLess).toBe('display: flex;');
  });
});
