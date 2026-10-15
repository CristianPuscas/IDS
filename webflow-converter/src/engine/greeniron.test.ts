/**
 * Regression fixture from a real paste test: the "GreenIron" landing page, converted with v2,
 * pasted into Webflow and published. The live page showed:
 * - JS-driven forms broken by native conversion (webflow.js took over submit: alerts, POST to
 *   Webflow Forms, the form and its custom success message hidden, Turnstile disabling submit;
 *   `submit.textContent` no longer worked on the `<input type=submit>`);
 * - number inputs without their `value`;
 * - a 56.6 KB IIFE in one Code Embed, over the Designer's 50,000-character limit.
 *
 * TODO: the fixture holds representative snippets reconstructed from the published DOM. When the
 * user uploads the full original GreenIron HTML, swap it in (keep the assertions).
 */
import { describe, expect, it } from 'vitest';
import GREENIRON from './__fixtures__/greeniron-snippets.html?raw';
import { parsesAsScript } from './jsMinify';
import { convert, validateXscp } from './index';
import { elements, embedCodes, embeddedCss, first, style } from './testHelpers';

describe('greeniron-snippets.html (real paste-test regression)', () => {
  const res = convert({ mode: 'combined', html: GREENIRON });
  const forms = embedCodes(res).filter((c) => c.startsWith('<form'));
  const scripts = embedCodes(res).filter((c) => c.includes('<script'));

  it('passes structural validation', () => {
    expect(validateXscp(res.data)).toEqual([]);
  });

  it('keeps every JS-driven form as a Code Embed in auto mode', () => {
    expect(elements(res).some((e) => e.type.startsWith('Form'))).toBe(false);
    expect(forms).toHaveLength(4);
    for (const f of forms) expect(f).toContain('novalidate=""');
    const contact = forms.find((f) => f.includes('data-contact-form'))!;
    expect(contact).toContain('<button type="submit" class="button" data-contact-submit="">Trimite cererea</button>');
    expect(contact).toContain('data-contact-success=""');
    expect(res.warnings.filter((w) => /is driven by custom JavaScript/.test(w.message))).toHaveLength(4);
  });

  it('keeps the number inputs\' values', () => {
    const calc = forms.filter((f) => f.includes('data-calc-form')).join('\n');
    for (const [id, value] of [['calc-orm-weight', '100'], ['calc-orm-reps', '5'], ['calc-bmi-height', '178'], ['calc-bmi-weight', '75']]) {
      expect(calc).toMatch(new RegExp(`id="${id}"[^>]*value="${value}"`));
    }
  });

  it('styles the embedded forms through the <style> embed with their original class names', () => {
    const css = embeddedCss(res);
    expect(css).toContain('.calc_select {\n  width: 100%;\n  padding: 1rem 1.25rem;');
    expect(css).toContain('.contact_input {');
    expect(css).toContain('.contact_form-grid {\n  grid-template-columns: 1fr;');
    // `.button` is also a native class (the schedule buttons): the rule reaches both.
    expect(css).toMatch(/:is\(\.button,\[data-h2w-class~="button"\]\) \{/);
  });

  it('fits the 61.5 KB IIFE in one Code Embed (or hands it out as a file)', () => {
    for (const s of scripts) expect(s.length).toBeLessThanOrEqual(50000);
    const iife = scripts.find((s) => s.includes('initContactForm'));
    if (iife) {
      const code = iife.slice(iife.lastIndexOf('<script>') + '<script>'.length, iife.lastIndexOf('</script>'));
      expect(parsesAsScript(code)).toBe(true);
      expect(res.externalScripts).toEqual([]);
    } else {
      expect(res.externalScripts).toHaveLength(1);
    }
  });

  it('still converts the <button>s outside forms to native Buttons with the click shim', () => {
    const tab = first(res, 'Link');
    expect(tab.data!.button).toBe(true);
    expect(style(res, 'schedule_tab').styleLess).toContain('font-family: Arial, sans-serif;');
  });

  it('warns, and keeps value as a custom attribute, with forms: "native"', () => {
    const native = convert({ mode: 'combined', html: GREENIRON }, { forms: 'native' });
    expect(validateXscp(native.data)).toEqual([]);
    expect(native.warnings.filter((w) => /looks driven by custom JavaScript/.test(w.message))).toHaveLength(4);
    const weight = elements(native).find((e) => e.type === 'FormTextInput' && e.data?.attr?.id === 'calc-orm-weight')!;
    expect(weight.data!.xattr).toContainEqual({ name: 'value', value: '100' });
    expect(style(native, 'calc_select').styleLess).toContain('height: auto;');
  });
});
