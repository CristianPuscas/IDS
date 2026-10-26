/**
 * Regression fixtures from real paste tests of the "GreenIron" landing page (Client-First naming,
 * GSAP/ScrollTrigger/Lenis from a CDN, a 61.5 KB inline IIFE).
 *
 * greeniron-snippets.html (v2 paste): representative snippets reconstructed from the published DOM.
 * The live page showed:
 * - JS-driven forms broken by native conversion (webflow.js took over submit: alerts, POST to
 *   Webflow Forms, the form and its custom success message hidden, Turnstile disabling submit;
 *   `submit.textContent` no longer worked on the `<input type=submit>`);
 * - number inputs without their `value`;
 * - a 56.6 KB IIFE in one Code Embed, over the Designer's 50,000-character limit.
 *
 * greeniron.html (v5 paste, the user's full original file). The live page showed:
 * - 239 classes pasted as "name 2"/"name 5" although the site held the same classes from an
 *   earlier paste of identical output: Webflow stores declarations in its own canonical order and
 *   matches the next paste by exact `styleLess` string (./propertyOrder);
 * - the mobile menu never opening: `.nav_menu.is-open` was rewritten to
 *   `[data-h2w-class~="nav_menu"][data-h2w-class~="is-open"]`, but the script adds the real class
 *   `is-open`, never the attribute (./embedCss, `scriptToggledClasses`);
 * - the hero card title and every other "Bebas Neue" text in the inherited sans font, which also
 *   widened the hero title so the 1.15fr/0.85fr grid squeezed the hero image to a sliver: Webflow
 *   drops a `font-family` with two quoted names (./cssValues `unquoteFontFamilies`).
 */
import { describe, expect, it } from 'vitest';
import GREENIRON from './__fixtures__/greeniron-snippets.html?raw';
import GREENIRON_FULL from './__fixtures__/greeniron.html?raw';
import { parsesAsScript } from './jsMinify';
import { convert, validateXscp, type ConvertResult, type WfElementNode, type WfStyle } from './index';
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

/** A class as the test site stored it after the earlier paste (read back through the Webflow Data API). */
const siteStyle = (id: string, name: string, styleLess: string, variants: Record<string, string> = {}): WfStyle => ({
  _id: id,
  fake: false,
  type: 'class',
  name,
  namespace: '',
  comb: '',
  styleLess,
  variants: Object.fromEntries(Object.entries(variants).map(([k, v]) => [k, { styleLess: v }])) as WfStyle['variants'],
  children: [],
  createdBy: '6a82dbc04ebf3e2d80565199',
  origin: null,
  selector: null,
});

/** The four classes the user named, exactly as Webflow stored them (canonical declaration order). */
const STORED = {
  nav_component: 'position: fixed; left: 0; top: 0; right: 0; z-index: 100;',
  section_marquee: 'position: relative; overflow: hidden; box-sizing: border-box; padding-top: 2.5rem; padding-bottom: 2.5rem; background-color: #04140c;',
  'padding-global': 'box-sizing: border-box; padding-right: 2.5rem; padding-left: 2.5rem;',
  'padding-section-large': 'box-sizing: border-box; padding-top: 7rem; padding-bottom: 7rem;',
};

describe('greeniron.html (full original, v5 paste-test regression)', () => {
  const res = convert({ mode: 'combined', html: GREENIRON_FULL });
  const css = embeddedCss(res);

  it('passes structural validation', () => {
    expect(validateXscp(res.data)).toEqual([]);
  });

  it('emits declarations in the order Webflow stores them, so a re-paste reuses the classes', () => {
    for (const [name, stored] of Object.entries(STORED)) expect(style(res, name).styleLess).toBe(stored);
    expect(style(res, 'padding-global').variants).toEqual({
      medium: { styleLess: 'padding-right: 2rem; padding-left: 2rem;' },
      small: { styleLess: 'padding-right: 1.25rem; padding-left: 1.25rem;' },
    });
    expect(style(res, 'padding-section-large').variants).toEqual({
      medium: { styleLess: 'padding-top: 5rem; padding-bottom: 5rem;' },
      small: { styleLess: 'padding-top: 4rem; padding-bottom: 4rem;' },
    });
  });

  it('is deterministic: two conversions give byte-identical styles', () => {
    const again = convert({ mode: 'combined', html: GREENIRON_FULL });
    expect(JSON.stringify(again.data.payload.styles)).toBe(JSON.stringify(res.data.payload.styles));
  });

  it('opens the mobile menu: the is-open rules match the class the script toggles', () => {
    expect(css).toMatch(/@media \(max-width: 991px\) \{\s*\[data-h2w-class~="nav_menu"\]:is\(\.is-open,\[data-h2w-class~="is-open"\]\) \{\s*opacity: 1;\s*visibility: visible;/);
    for (const line of ['nav_toggle-top', 'nav_toggle-middle', 'nav_toggle-bottom']) {
      expect(css).toContain(`[data-h2w-class~="${line}"]:is(.is-open,[data-h2w-class~="is-open"]) {`);
    }
    expect(css).not.toMatch(/\[data-h2w-class~="nav_menu"\]\[data-h2w-class~="is-open"\]/);

    // The published element: Webflow renamed the class (nav_menu-2); the script added `is-open`.
    const menu = elements(res).find((e) => e.data?.xattr?.some((a) => a.name === 'data-nav-menu'))!;
    const tag = menu.data!.xattr!.find((a) => a.name === 'data-h2w-class')!.value;
    const el = document.createElement('nav');
    el.className = 'nav_menu-2';
    el.setAttribute('data-h2w-class', tag);
    const selector = '[data-h2w-class~="nav_menu"]:is(.is-open,[data-h2w-class~="is-open"])';
    expect(el.matches(selector)).toBe(false);
    el.classList.add('is-open');
    expect(el.matches(selector)).toBe(true);
    expect(embedCodes(res).some((c) => /menu\.classList\.toggle\(["']is-open["']/.test(c))).toBe(true);
  });

  it('keeps the condensed display font: no font-family with two quoted names', () => {
    expect(style(res, 'hero_card-title').styleLess).toContain('font-family: Bebas Neue, Impact, Arial Narrow, sans-serif;');
    expect(style(res, 'hero_title').styleLess).toContain('font-family: Bebas Neue, Impact, Arial Narrow, sans-serif;');
    for (const s of res.data.payload.styles) {
      for (const text of [s.styleLess, ...Object.values(s.variants).map((v) => v?.styleLess ?? '')]) {
        const family = /font-family: ([^;]*);/.exec(text)?.[1];
        if (family) expect((family.match(/"/g) ?? []).length, `${s.name}: ${family}`).toBeLessThan(4);
      }
    }
    // One quoted name is published fine and stays as it was (matches the stored class).
    expect(style(res, 'page_wrapper').styleLess).toContain('font-family: "Inter", Arial, sans-serif;');
  });

  describe('with the site styles imported (classes left numbered by earlier pastes)', () => {
    const SITE: WfStyle[] = [
      siteStyle('ef2d92f1-d48c-70a8-1483-af21d2565bcb', 'nav_component', STORED.nav_component),
      siteStyle('ef2d92f1-d48c-70a8-1483-af21d2565bfd', 'section_marquee', STORED.section_marquee),
      // Only a numbered copy of these was imported: Webflow ignores " N" when matching.
      siteStyle('71225367-d435-01de-6976-6c5b034ed279', 'padding-global 5', STORED['padding-global'], {
        medium: 'padding-right: 2rem; padding-left: 2rem;',
        small: 'padding-right: 1.25rem; padding-left: 1.25rem;',
      }),
      siteStyle('ef2d92f1-d48c-70a8-1483-af21d2565c04', 'padding-section-large 2', STORED['padding-section-large'], { medium: 'padding-top: 5rem; padding-bottom: 5rem;' }),
      siteStyle('47e53913-eb45-d5ea-b09a-1fceda151969', 'padding-section-large', 'padding-top: 7rem; padding-bottom: 7rem;', { medium: 'padding-top: 6rem; padding-bottom: 6rem;' }),
    ];
    const reused: ConvertResult = convert({ mode: 'combined', html: GREENIRON_FULL }, { siteStyles: SITE, siteClassConflicts: 'reuse' });
    const usesStyle = (id: string) => elements(reused).some((e: WfElementNode) => e.classes.includes(id));

    it('pastes each matched class as the site\'s own style object and never its own under that name', () => {
      expect(validateXscp(reused.data)).toEqual([]);
      const styles = reused.data.payload.styles;
      for (const site of [SITE[0]!, SITE[1]!, SITE[2]!, SITE[4]!]) {
        const out = styles.find((s) => s._id === site._id)!;
        const { children: _a, ...a } = out;
        const { children: _b, ...b } = site;
        expect(a).toEqual(b);
        expect(usesStyle(site._id)).toBe(true);
      }
      // The base name wins over a numbered one, even when its styles differ (they go to the embed).
      expect(styles.some((s) => s._id === SITE[4]!._id)).toBe(true);
      expect(styles.some((s) => s._id === SITE[3]!._id)).toBe(false);
      for (const base of ['nav_component', 'section_marquee', 'padding-global', 'padding-section-large']) {
        const same = styles.filter((s) => s.comb === '' && s.name.replace(/ \d+$/, '') === base);
        expect(same, base).toHaveLength(1);
      }
      expect(embeddedCss(reused)).toMatch(/\[data-h2w-class~="padding-section-large"\] \{\s*box-sizing: border-box;\s*\}/);
      expect(reused.stats.reusedClasses).toBe(4);
    });
  });
});
