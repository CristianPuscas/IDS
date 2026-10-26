import { describe, expect, it } from 'vitest';
import { FORM_ERROR_TEXT, FORM_SUCCESS_TEXT } from './forms';
import { convert, validateXscp, type ConvertOptions } from './index';
import { classNames, elements, first, kids, style, textOf } from './testHelpers';
import { isTextNode, type ConvertResult, type WfElementNode } from './types';

const run = (html: string, css = '', options: Partial<ConvertOptions> = {}) => {
  const res = convert({ mode: 'separate', html, css, js: '' }, options);
  expect(validateXscp(res.data)).toEqual([]);
  return res;
};

const types = (res: ConvertResult, node: WfElementNode): string[] =>
  kids(res, node).map((n) => (isTextNode(n) ? 'text' : n.type));

const CONTACT = `<form id="contact" name="contact" data-name="Contact" class="contact_form" action="https://formspree.io/f/x" method="POST">
  <label for="name" class="field_label">Name</label>
  <input id="name" name="name" type="text" placeholder="Jane" required class="field_input">
  <label for="email">Email</label>
  <input id="email" name="email" type="email" maxlength="100" data-track="email">
  <select name="topic" id="topic" required><option value="">Pick one</option><option value="sales">Sales</option><option>Support</option></select>
  <textarea name="message" id="message" placeholder="Hi"></textarea>
  <label class="checkbox"><input type="checkbox" name="terms" id="terms" required> <span class="checkbox_text">I agree</span></label>
  <label class="radio"><input type="radio" name="plan" value="pro"> Pro</label>
  <input type="file" name="cv">
  <button type="submit" class="btn">Send message</button>
</form>`;

describe('forms: "native" (default)', () => {
  const res = run(CONTACT, '.contact_form { display: grid; gap: 1rem } .btn { background-color: #000; color: #fff; padding: 1rem; border: 0; cursor: pointer; line-height: 1; display: inline-block }');

  it('builds FormWrapper > FormForm + success + error messages', () => {
    const wrapper = res.data.payload.nodes[0] as WfElementNode;
    expect(wrapper).toMatchObject({ type: 'FormWrapper', tag: 'div', data: { form: { type: 'wrapper' } } });
    expect(types(res, wrapper)).toEqual(['FormForm', 'FormSuccessMessage', 'FormErrorMessage']);
    const [, done, fail] = kids(res, wrapper) as WfElementNode[];
    expect(done!.data!.form).toEqual({ type: 'msg-done' });
    expect(fail!.data!.form).toEqual({ type: 'msg-fail' });
    expect(textOf(res, done!)).toBe(FORM_SUCCESS_TEXT);
    expect(textOf(res, fail!)).toBe(FORM_ERROR_TEXT);
  });

  it('neutralizes the .w-form bottom margin on a generated wrapper class', () => {
    const wrapper = res.data.payload.nodes[0] as WfElementNode;
    expect(classNames(res, wrapper)).toEqual(['contact_form-wrapper']);
    expect(style(res, 'contact_form-wrapper').styleLess).toBe('margin-bottom: 0px;');
  });

  it('keeps the form classes, name, method and action on FormForm', () => {
    const form = first(res, 'FormForm');
    expect(form.tag).toBe('form');
    expect(classNames(res, form)).toEqual(['contact_form']);
    expect(form.data).toMatchObject({
      form: { type: 'form', name: 'Contact' },
      attr: { id: 'contact', name: 'contact', 'data-name': 'Contact', method: 'post', action: 'https://formspree.io/f/x', redirect: '', 'data-redirect': '' },
    });
    expect(style(res, 'contact_form').styleLess).toContain('display: grid;');
    expect(types(res, form)).toEqual([
      'FormBlockLabel',
      'FormTextInput',
      'FormBlockLabel',
      'FormTextInput',
      'FormSelect',
      'FormTextarea',
      'FormCheckboxWrapper',
      'FormRadioWrapper',
      'HtmlEmbed',
      'FormButton',
    ]);
  });

  it('maps text inputs: name, type, placeholder, required, maxlength, id', () => {
    const [name, email] = elements(res).filter((e) => e.type === 'FormTextInput');
    expect(name).toMatchObject({
      tag: 'input',
      data: {
        form: { type: 'input', name: 'name', passwordPage: false },
        attr: { type: 'text', name: 'name', 'data-name': 'name', id: 'name', placeholder: 'Jane', maxlength: 256, required: true, disabled: false, autofocus: false },
      },
    });
    expect(classNames(res, name!)).toEqual(['field_input']);
    expect(email!.data).toMatchObject({ attr: { type: 'email', maxlength: 100, required: false }, xattr: [{ name: 'data-track', value: 'email' }] });
  });

  it('maps labels with their for attribute', () => {
    const label = first(res, 'FormBlockLabel');
    expect(label).toMatchObject({ tag: 'label', data: { form: { type: 'label' }, attr: { for: 'name' } } });
    expect(classNames(res, label)).toEqual(['field_label']);
    expect(textOf(res, label)).toBe('Name');
  });

  it('maps select options and textarea', () => {
    expect(first(res, 'FormSelect').data).toMatchObject({
      form: {
        type: 'select',
        name: 'topic',
        opts: [
          { v: '', t: 'Pick one' },
          { v: 'sales', t: 'Sales' },
          { v: 'Support', t: 'Support' },
        ],
      },
      attr: { name: 'topic', id: 'topic', required: true, multiple: false },
    });
    expect(first(res, 'FormTextarea')).toMatchObject({
      tag: 'textarea',
      data: { form: { type: 'textarea', name: 'message' }, attr: { placeholder: 'Hi', maxlength: 5000 } },
    });
  });

  it('maps checkbox and radio labels to wrapper > input + inline label', () => {
    const cb = first(res, 'FormCheckboxWrapper');
    expect(cb).toMatchObject({ tag: 'label', data: { form: { type: 'checkbox' } } });
    expect(classNames(res, cb)).toEqual(['checkbox']);
    expect(types(res, cb)).toEqual(['FormCheckboxInput', 'FormInlineLabel']);
    const [input, label] = kids(res, cb) as WfElementNode[];
    expect(input!.data).toMatchObject({ form: { type: 'checkbox-input', name: 'terms' }, attr: { type: 'checkbox', id: 'terms', required: true, checked: false } });
    expect(label).toMatchObject({ tag: 'span', data: { form: { type: 'checkbox-label' } } });
    expect(classNames(res, label!)).toEqual(['checkbox_text']);
    expect(textOf(res, label!)).toBe('I agree');

    const radio = first(res, 'FormRadioWrapper');
    expect(types(res, radio)).toEqual(['FormRadioInput', 'FormInlineLabel']);
    expect((kids(res, radio)[0] as WfElementNode).data).toMatchObject({ form: { type: 'radio-input', name: 'plan' }, attr: { type: 'radio', value: 'pro' } });
  });

  it('keeps unsupported controls (file input) as a Code Embed inside the form, with a warning', () => {
    expect(first(res, 'HtmlEmbed').v).toBe('<input type="file" name="cv">');
    expect(res.warnings.some((w) => w.severity === 'warning' && w.message.includes('<input type="file">'))).toBe(true);
  });

  it('turns the submit button into a FormButton with the button text as value', () => {
    const btn = first(res, 'FormButton');
    expect(btn).toMatchObject({
      tag: 'input',
      children: [],
      data: { form: { type: 'button', wait: 'Please wait...' }, attr: { type: 'submit', value: 'Send message', 'data-wait': 'Please wait...' } },
    });
    expect(classNames(res, btn)).toEqual(['btn']);
    // .btn sets everything .w-button touches (UA radius/text-decoration equal .w-button); only the
    // <button> user-agent font is added (webflow.css gives inputs `font: inherit`).
    expect(style(res, 'btn').styleLess).toBe(
      'display: inline-block; padding-top: 1rem; padding-right: 1rem; padding-bottom: 1rem; padding-left: 1rem; border-top-width: 0px; border-right-width: 0px; border-bottom-width: 0px; border-left-width: 0px; ' +
        'background-color: #000; font-family: Arial, sans-serif; color: #fff; font-size: 0.8333rem; line-height: 1; font-style: normal; font-weight: 400; text-align: center; letter-spacing: normal; text-transform: none; cursor: pointer;',
    );
  });
});

describe('forms: edge cases', () => {
  it('finds fields nested in divs and splits a label that wraps a text field', () => {
    const res = run('<div class="card"><form><div class="field"><label>Email <input id="e" name="email" type="email"></label></div><input type="submit" value="Go"></form></div>');
    const field = elements(res).find((e) => e.type === 'Block' && classNames(res, e)[0] === 'field')!;
    expect(types(res, field)).toEqual(['FormBlockLabel', 'FormTextInput']);
    const label = first(res, 'FormBlockLabel');
    expect(label.data!.attr).toMatchObject({ for: 'e' });
    expect(textOf(res, label)).toBe('Email');
    expect(first(res, 'FormButton').data!.attr).toMatchObject({ value: 'Go' });
    // A classless submit button gets the generated neutralizer class.
    expect(classNames(res, first(res, 'FormButton'))).toEqual(['button']);
  });

  it('a type="button" inside a form stays a regular Button', () => {
    const res = run('<form><input name="q"><button type="button" class="btn">Clear</button></form>');
    expect(first(res, 'Link').data!.button).toBe(true);
    expect(elements(res).some((e) => e.type === 'FormButton')).toBe(false);
  });

  it('embeds selects with optgroups and hidden inputs', () => {
    const res = run('<form><select name="a"><optgroup label="x"><option>1</option></optgroup></select><input type="hidden" name="t" value="1"></form>');
    const form = first(res, 'FormForm');
    expect(types(res, form)).toEqual(['HtmlEmbed', 'HtmlEmbed']);
    expect(res.warnings.filter((w) => w.severity === 'warning' && w.message.includes('Code Embed inside the native form'))).toHaveLength(2);
  });

  it('a bare checkbox still gets its wrapper label', () => {
    const res = run('<form><input type="checkbox" name="news" checked></form>');
    const wrap = first(res, 'FormCheckboxWrapper');
    expect(types(res, wrap)).toEqual(['FormCheckboxInput']);
    expect((kids(res, wrap)[0] as WfElementNode).data!.attr).toMatchObject({ checked: true, name: 'news' });
  });

  it('inputs outside a form stay Code Embeds', () => {
    const res = run('<div><input type="search" name="q"></div>');
    expect(first(res, 'HtmlEmbed').v).toBe('<input type="search" name="q">');
  });

  it('a fieldset inside a native form becomes a Custom Element with native fields', () => {
    const res = run('<form><fieldset class="group"><legend>Who</legend><input name="n"></fieldset></form>');
    const fs = elements(res).find((e) => e.type === 'DOM' && e.data?.tag === 'fieldset')!;
    expect(types(res, fs)).toEqual(['DOM', 'FormTextInput']);
  });
});
