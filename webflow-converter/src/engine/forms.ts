/**
 * Native Webflow forms (spec 2.4 "Forms", VERIFIED [S3, S17]; S4 measured that native form nodes
 * paste completely, and that a form control emitted as a Block crashes the paste).
 *
 * `<form>` becomes the structure the Designer builds:
 *
 *   FormWrapper (div, form:{type:"wrapper"})
 *     FormForm (form, form:{type:"form", name}, attr:{id, name, data-name, method, action, redirect})
 *       …fields, labels and any other content, converted in place…
 *       FormButton (input type=submit, form:{type:"button", wait})
 *     FormSuccessMessage (div, form:{type:"msg-done"}) > Text Block
 *     FormErrorMessage   (div, form:{type:"msg-fail"}) > Text Block
 *
 * | Source                                        | Node                                         |
 * |-----------------------------------------------|----------------------------------------------|
 * | input text/email/password/tel/number (or none) | FormTextInput (`maxlength` 256 by default)   |
 * | textarea                                       | FormTextarea (`maxlength` 5000 by default)   |
 * | select with option children                    | FormSelect (`opts: [{v, t}]`)                |
 * | label                                          | FormBlockLabel (`attr.for`)                  |
 * | label wrapping a checkbox / radio              | FormCheckboxWrapper / FormRadioWrapper > input + FormInlineLabel |
 * | input checkbox / radio                         | FormCheckboxInput / FormRadioInput           |
 * | button (submit), input submit                  | FormButton (`value` = button text)           |
 * | file, hidden, date, range, color… inputs, reset buttons, optgroups | HtmlEmbed of the control, inside the form, with a warning |
 *
 * Evidence: every type, tag and `data.form.type` above is in the spec table except the radio
 * wrapper and radio label, whose `form.type` values (`radio`, `radio-label`) are inferred from the
 * checkbox pair; S4 reports that FormRadio* nodes paste.
 *
 * Ownership: engine.
 */

import type { FieldKind } from './fieldDefaults';
import type { WfAttr, WfElementNode, WfFormData, WfNode, WfNodeData, WfSelectOption, WfXattr } from './types';
import { uuid } from './ids';

/** Default texts of the Designer's form blocks. */
export const FORM_SUCCESS_TEXT = 'Thank you! Your submission has been received!';
export const FORM_ERROR_TEXT = 'Oops! Something went wrong while submitting the form.';
const WAIT_TEXT = 'Please wait...';

/** Input types FormTextInput can hold (the Designer's Plain, Email, Password, Phone, Number). */
const TEXT_INPUT_TYPES = new Set(['text', 'email', 'password', 'tel', 'number']);

/** Tags handled by `buildFormControl` while inside a native form. */
export const FORM_CONTROL_TAGS = new Set(['input', 'textarea', 'select', 'label', 'button', 'fieldset', 'legend', 'option', 'optgroup', 'datalist', 'output']);

/** What the form builder needs from the node builder. */
export interface FormBuilderApi {
  /** Appends a node to the pre-order list. */
  push(node: WfNode): void;
  /** Converts an element (form-aware while inside a form); returns the new top-level node ids. */
  buildElement(el: Element): string[];
  /** Converts an element's children with the usual whitespace handling. */
  buildChildren(el: Element, textContext: boolean): string[];
  /** Style ids for the element's classes (plus inline style); `extra` names are appended. */
  resolveClasses(el: Element, extra?: string[]): string[];
  /** Style ids for an explicit list of class names. */
  resolveNames(names: string[]): string[];
  /** Custom attributes of the element, minus `reserved`. */
  xattr(el: Element, reserved: string[]): WfXattr[];
  /** Keeps the element as an HtmlEmbed and records a warning. */
  embed(el: Element, reason: string): string;
  /** Records the Webflow `.w-button` neutralization for a submit button; returns extra class names. */
  submitButtonClasses(el: Element): string[];
  /** Records the `.w-input`/`.w-select`/`.w-checkbox`… neutralization for a field; returns extra class names. */
  fieldClasses(el: Element, kind: FieldKind): string[];
  /** Registers low-priority declarations on a generated class; returns the class name. */
  defaultsClass(base: string, decls: { property: string; value: string }[]): string;
  warn(message: string, detail?: string, severity?: 'info' | 'warning'): void;
}

/** Builds a native form. Returns the FormWrapper id. */
export function buildForm(api: FormBuilderApi, form: Element): string {
  const formClasses = (form.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
  // `.w-form` adds `margin: 0 0 15px` to the wrapper; the source had no wrapper at all.
  const wrapperClass = api.defaultsClass(`${formClasses[0] ?? 'form'}-wrapper`, [{ property: 'margin-bottom', value: '0px' }]);
  const wrapper = node('FormWrapper', 'div', api.resolveNames([wrapperClass]), { form: { type: 'wrapper' } }, {});
  api.push(wrapper);

  const id = form.getAttribute('id') ?? '';
  const name = formName(form);
  const attr: WfAttr = {
    id,
    name: form.getAttribute('name') || slug(name),
    'data-name': name,
    method: (form.getAttribute('method') || 'get').toLowerCase(),
    action: form.getAttribute('action') ?? '',
    redirect: '',
    'data-redirect': '',
  };
  const formNode = node('FormForm', 'form', api.resolveClasses(form), { form: { type: 'form', name } }, attr, api.xattr(form, ['name', 'data-name', 'method', 'action']));
  api.push(formNode);
  formNode.children = api.buildChildren(form, false);

  const done = messageBlock(api, 'FormSuccessMessage', 'msg-done', FORM_SUCCESS_TEXT);
  const fail = messageBlock(api, 'FormErrorMessage', 'msg-fail', FORM_ERROR_TEXT);
  wrapper.children = [formNode._id, done, fail];
  return wrapper._id;
}

/**
 * Converts a form control (or label/fieldset) inside a native form. Returns the ids of the nodes
 * that take the element's place (a label wrapping a field yields the label and the field), or
 * `undefined` when the element is not a control, so the caller converts it normally.
 */
export function buildFormControl(api: FormBuilderApi, el: Element): string[] | undefined {
  const tag = el.tagName.toLowerCase();
  switch (tag) {
    case 'input':
      return [buildInput(api, el)];
    case 'textarea':
      return [buildTextarea(api, el)];
    case 'select':
      return [buildSelect(api, el)];
    case 'label':
      return buildLabel(api, el);
    case 'button': {
      const type = (el.getAttribute('type') ?? 'submit').toLowerCase();
      if (type === 'submit') return [buildSubmit(api, el)];
      if (type === 'button') return undefined; // a plain button: regular Link/Button conversion
      return [api.embed(el, `<button type="${type}"> has no native Webflow form element`)];
    }
    case 'fieldset':
    case 'legend':
      return undefined; // Custom Element (DOM) with form-aware children
    default:
      return [api.embed(el, `<${tag}> has no native Webflow form element`)];
  }
}

function buildInput(api: FormBuilderApi, el: Element): string {
  const type = (el.getAttribute('type') ?? 'text').toLowerCase();
  if (TEXT_INPUT_TYPES.has(type)) {
    const name = fieldName(el, 'Field');
    const attr: WfAttr = {
      type,
      name,
      'data-name': name,
      id: el.getAttribute('id') ?? '',
      placeholder: el.getAttribute('placeholder') ?? '',
      maxlength: numberAttr(el, 'maxlength', 256),
      required: el.hasAttribute('required'),
      disabled: el.hasAttribute('disabled'),
      autofocus: el.hasAttribute('autofocus'),
    };
    const xattr = api.xattr(el, RESERVED_INPUT);
    const value = el.getAttribute('value');
    if (value !== null && value !== '') {
      // No real dump shows a default value on FormTextInput (spec 2.4), so it rides along as a
      // custom attribute; the browser reads it as the input's initial value.
      xattr.push({ name: 'value', value });
      api.warn(
        `A default value (value="${value}") was kept as a custom attribute on the native input. That Webflow keeps a "value" custom attribute is unverified: check the field after pasting, or use forms: 'embed'.`,
        el.outerHTML.slice(0, 120),
      );
    }
    const n = node('FormTextInput', 'input', api.resolveClasses(el, api.fieldClasses(el, 'input')), { form: { type: 'input', name, passwordPage: false } }, attr, xattr);
    api.push(n);
    return n._id;
  }
  if (type === 'checkbox' || type === 'radio') {
    // A bare checkbox/radio still needs its Webflow wrapper (a <label>); the source had none, so
    // its .w-checkbox/.w-radio padding and margin are cancelled on a generated class.
    const kind = type === 'checkbox' ? 'checkbox' : 'radio';
    const wrapperClass = api.defaultsClass(`${kind}-field`, [
      { property: 'margin-bottom', value: '0px' },
      { property: 'padding-left', value: '0px' },
      { property: 'display', value: 'inline' },
    ]);
    const wrapper = node(kind === 'checkbox' ? 'FormCheckboxWrapper' : 'FormRadioWrapper', 'label', api.resolveNames([wrapperClass]), { form: { type: kind } }, {});
    api.push(wrapper);
    wrapper.children = [buildChoiceInput(api, el, kind)];
    return wrapper._id;
  }
  if (type === 'submit') return buildSubmit(api, el);
  return api.embed(el, `<input type="${type}"> has no native Webflow form element`);
}

function buildChoiceInput(api: FormBuilderApi, el: Element, kind: 'checkbox' | 'radio'): string {
  const name = fieldName(el, kind === 'checkbox' ? 'Checkbox' : 'Radio');
  const attr: WfAttr = {
    type: kind,
    name,
    'data-name': name,
    id: el.getAttribute('id') ?? '',
    required: el.hasAttribute('required'),
    checked: el.hasAttribute('checked'),
  };
  if (kind === 'radio') attr.value = el.getAttribute('value') ?? 'on';
  const n = node(
    kind === 'checkbox' ? 'FormCheckboxInput' : 'FormRadioInput',
    'input',
    api.resolveClasses(el, api.fieldClasses(el, kind)),
    { form: { type: kind === 'checkbox' ? 'checkbox-input' : 'radio-input', name } },
    attr,
    api.xattr(el, [...RESERVED_INPUT, 'value', 'checked']),
  );
  api.push(n);
  return n._id;
}

function buildTextarea(api: FormBuilderApi, el: Element): string {
  const name = fieldName(el, 'Field');
  const attr: WfAttr = {
    name,
    'data-name': name,
    id: el.getAttribute('id') ?? '',
    placeholder: el.getAttribute('placeholder') ?? '',
    maxlength: numberAttr(el, 'maxlength', 5000),
    required: el.hasAttribute('required'),
    autofocus: el.hasAttribute('autofocus'),
  };
  const n = node('FormTextarea', 'textarea', api.resolveClasses(el, api.fieldClasses(el, 'textarea')), { form: { type: 'textarea', name } }, attr, api.xattr(el, [...RESERVED_INPUT, 'rows', 'cols']));
  api.push(n);
  if ((el.textContent ?? '').trim()) api.warn('Default text inside a <textarea> was dropped.', (el.textContent ?? '').trim().slice(0, 120));
  return n._id;
}

function buildSelect(api: FormBuilderApi, el: Element): string {
  if (el.querySelector('optgroup')) return api.embed(el, '<select> with <optgroup> has no native Webflow equivalent');
  const name = fieldName(el, 'Field');
  const opts: WfSelectOption[] = Array.from(el.querySelectorAll('option')).map((o) => {
    const t = (o.textContent ?? '').replace(/\s+/g, ' ').trim();
    return { v: o.getAttribute('value') ?? t, t };
  });
  const attr: WfAttr = {
    name,
    'data-name': name,
    id: el.getAttribute('id') ?? '',
    required: el.hasAttribute('required'),
    multiple: el.hasAttribute('multiple'),
  };
  const n = node('FormSelect', 'select', api.resolveClasses(el, api.fieldClasses(el, 'select')), { form: { type: 'select', name, opts } }, attr, api.xattr(el, RESERVED_INPUT));
  api.push(n);
  return n._id;
}

function buildLabel(api: FormBuilderApi, el: Element): string[] {
  const choice = el.querySelector('input[type="checkbox" i], input[type="radio" i]');
  if (choice) {
    const kind = (choice.getAttribute('type') ?? '').toLowerCase() === 'radio' ? 'radio' : 'checkbox';
    const wrapper = node(
      kind === 'checkbox' ? 'FormCheckboxWrapper' : 'FormRadioWrapper',
      'label',
      api.resolveClasses(el, api.fieldClasses(el, kind === 'checkbox' ? 'checkbox-wrapper' : 'radio-wrapper')),
      { form: { type: kind } },
      {},
      api.xattr(el, ['for']),
    );
    api.push(wrapper);
    const ids = [buildChoiceInput(api, choice, kind)];
    // The rest of the label's content becomes the inline label (a span).
    const rest = Array.from(el.childNodes).filter((c) => c !== choice && !(c.nodeType === 3 && !(c.textContent ?? '').trim()));
    const span = rest.length === 1 && rest[0]!.nodeType === 1 && (rest[0] as Element).tagName.toLowerCase() === 'span' ? (rest[0] as Element) : null;
    const text = rest.map((c) => c.textContent ?? '').join('').replace(/\s+/g, ' ').trim();
    if (text) {
      const inline = node('FormInlineLabel', 'span', span ? api.resolveClasses(span) : [], { form: { type: kind === 'checkbox' ? 'checkbox-label' : 'radio-label' } }, {});
      api.push(inline);
      const t: WfNode = { _id: uuid(), text: true, v: text };
      api.push(t);
      inline.children = [t._id];
      ids.push(inline._id);
    }
    wrapper.children = ids;
    return [wrapper._id];
  }

  const controls = Array.from(el.querySelectorAll('input, select, textarea'));
  const forAttr = el.getAttribute('for') ?? controls[0]?.getAttribute('id') ?? '';
  const label = node('FormBlockLabel', 'label', api.resolveClasses(el), { form: { type: 'label' } }, forAttr ? { for: forAttr } : {}, api.xattr(el, ['for']));
  api.push(label);
  if (controls.length === 0) {
    label.children = api.buildChildren(el, true);
    return [label._id];
  }
  // A label cannot hold a native field: its text stays in the label, the fields follow it.
  const text = Array.from(el.childNodes)
    .filter((c) => !controls.some((ctl) => c === ctl || (c.nodeType === 1 && (c as Element).contains(ctl))))
    .map((c) => c.textContent ?? '')
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
  if (text) {
    const t: WfNode = { _id: uuid(), text: true, v: text };
    api.push(t);
    label.children = [t._id];
  }
  api.warn('A <label> wrapping a field was split: Webflow labels cannot contain fields, so the field now follows its label.', el.outerHTML.slice(0, 120), 'info');
  return [label._id, ...controls.flatMap((c) => api.buildElement(c))];
}

function buildSubmit(api: FormBuilderApi, el: Element): string {
  const tag = el.tagName.toLowerCase();
  const value = tag === 'input' ? el.getAttribute('value') || 'Submit' : (el.textContent ?? '').replace(/\s+/g, ' ').trim() || 'Submit';
  if (tag === 'button' && el.children.length > 0) {
    api.warn('A submit button became a native Form Button, which holds plain text only; icons or markup inside it were dropped.', el.outerHTML.slice(0, 120));
  }
  const wait = el.getAttribute('data-wait') || WAIT_TEXT;
  const attr: WfAttr = { type: 'submit', value, 'data-wait': wait };
  const extra = api.submitButtonClasses(el);
  const n = node('FormButton', 'input', api.resolveClasses(el, extra), { form: { type: 'button', wait } }, attr, api.xattr(el, ['type', 'value', 'data-wait', 'name']));
  api.push(n);
  return n._id;
}

function messageBlock(api: FormBuilderApi, type: 'FormSuccessMessage' | 'FormErrorMessage', formType: 'msg-done' | 'msg-fail', text: string): string {
  const msg = node(type, 'div', [], { form: { type: formType } }, {});
  api.push(msg);
  const block: WfElementNode = {
    _id: uuid(),
    type: 'Block',
    tag: 'div',
    classes: [],
    children: [],
    data: { tag: 'div', text: true, ...common({}, []) },
  };
  api.push(block);
  const t: WfNode = { _id: uuid(), text: true, v: text };
  api.push(t);
  block.children = [t._id];
  msg.children = [block._id];
  return msg._id;
}

const RESERVED_INPUT = ['type', 'name', 'data-name', 'placeholder', 'maxlength', 'required', 'disabled', 'autofocus', 'value'];

function node(type: WfElementNode['type'], tag: string, classes: string[], extra: { form: WfFormData } & Partial<WfNodeData>, attr: WfAttr, xattr: WfXattr[] = []): WfElementNode {
  return { _id: uuid(), type, tag, classes, children: [], data: { ...extra, ...common(attr, xattr) } };
}

function common(attr: WfAttr, xattr: WfXattr[]): Pick<WfNodeData, 'displayName' | 'attr' | 'xattr' | 'search' | 'visibility'> {
  return {
    displayName: '',
    attr: { id: '', ...attr },
    xattr,
    search: { exclude: false },
    visibility: { conditions: [] },
  };
}

function fieldName(el: Element, fallback: string): string {
  return el.getAttribute('name') || el.getAttribute('data-name') || el.getAttribute('id') || fallback;
}

function numberAttr(el: Element, name: string, fallback: number): number {
  const v = parseInt(el.getAttribute(name) ?? '', 10);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

/**
 * The form's name in the Designer and in form submissions: `data-name`, `name`, `id`,
 * `aria-label`, the text of its `aria-labelledby` element, or its first custom `data-*` attribute
 * (`data-contact-form` -> "Contact Form"); "Form" only when none exists.
 */
export function formName(form: Element): string {
  const direct = form.getAttribute('data-name') || form.getAttribute('name') || form.getAttribute('id') || form.getAttribute('aria-label');
  if (direct && direct.trim()) return direct.trim();
  const labelledBy = (form.getAttribute('aria-labelledby') ?? '').split(/\s+/).filter(Boolean);
  const text = labelledBy
    .map((id) => form.ownerDocument.getElementById(id)?.textContent ?? '')
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (text) return text.slice(0, 60);
  const data = customDataAttributes(form)[0];
  if (data) {
    const words = data.slice('data-'.length).split(/[-_]+/).filter(Boolean);
    if (words.length) return words.map((w) => w[0]!.toUpperCase() + w.slice(1)).join(' ');
  }
  return 'Form';
}

/** `data-*` attribute names an author added (Webflow's own and the converter's are left out). */
function customDataAttributes(el: Element): string[] {
  return Array.from(el.attributes)
    .map((a) => a.name.toLowerCase())
    .filter((n) => n.startsWith('data-') && !/^data-(name|wait|redirect|h2w-.*|wf-.*)$/.test(n));
}

/** Script patterns that handle form submission. */
const SUBMIT_JS = /addEventListener\s*\(\s*['"`]submit['"`]|\.onsubmit\b|\brequestSubmit\b|\.on\(\s*['"`]submit['"`]|\.submit\(\s*function/;

/**
 * Reasons to think custom JavaScript drives a form (option `forms: 'auto'` keeps such forms as
 * Code Embeds; `'native'` warns). Empty when none apply. Webflow's webflow.js binds a delegated
 * submit handler to every native form that ignores `defaultPrevented`, so a native form and a
 * custom submit handler fight.
 *
 * @param form The source `<form>`.
 * @param scriptText All inline script source of the page.
 */
export function scriptedFormReasons(form: Element, scriptText: string): string[] {
  const reasons: string[] = [];
  if (form.hasAttribute('novalidate')) reasons.push('it has novalidate');
  const controls = Array.from(form.querySelectorAll('input, select, textarea, button'));
  const dataAttrs = [...new Set([form, ...controls].flatMap(customDataAttributes))];
  if (!(form.getAttribute('action') ?? '').trim() && dataAttrs.length > 0) {
    reasons.push(`it has no action and has data attributes (${dataAttrs.slice(0, 3).join(', ')}${dataAttrs.length > 3 ? '…' : ''})`);
  }
  if (SUBMIT_JS.test(scriptText)) reasons.push('the scripts handle submit events');
  const id = form.getAttribute('id');
  if (id && mentionsId(scriptText, id)) reasons.push(`the scripts refer to its id "${id}"`);
  const used = customDataAttributes(form).filter((name) => mentionsDataAttr(scriptText, name));
  if (used.length) reasons.push(`the scripts use its ${used.join(', ')} attribute${used.length > 1 ? 's' : ''}`);
  return reasons;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** `#id`, `'id'`/`"id"`/`` `id` `` as a whole string, or `forms.id` in the scripts. */
function mentionsId(js: string, id: string): boolean {
  const e = escapeRe(id);
  return new RegExp(`#${e}(?![\\w-])|['"\`]${e}['"\`]|\\bforms\\.${e}\\b`).test(js);
}

/** `data-foo-bar` (not `data-foo-bar-baz`) or `dataset.fooBar` in the scripts. */
function mentionsDataAttr(js: string, name: string): boolean {
  const camel = name.slice('data-'.length).replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
  return new RegExp(`${escapeRe(name)}(?![\\w-])|dataset\\.${escapeRe(camel)}\\b|dataset\\[['"]${escapeRe(camel)}['"]`).test(js);
}

function slug(s: string): string {
  return s.trim().replace(/\s+/g, '-').replace(/[^\w-]/g, '') || 'form';
}
