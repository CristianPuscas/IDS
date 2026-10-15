/**
 * Regression fixture from a real paste test: a Client-First landing page (cherry-tomato farm)
 * converted, pasted into a Webflow site that already had Client-First/Relume classes, and
 * published. See README "Known limitations" for what the live page showed.
 */
import { describe, expect, it } from 'vitest';
import FERMA from './__fixtures__/ferma.html?raw';
import { isNativeImageSrc } from './nodeBuilder';
import { convert, validateXscp } from './index';
import { classNames, elements, embeddedCss, style } from './testHelpers';
import type { WfElementNode } from './types';

describe('ferma.html (real paste-test regression)', () => {
  const res = convert({ mode: 'combined', html: FERMA });
  const css = embeddedCss(res);
  const byXattr = (id: string): WfElementNode =>
    elements(res).find((e) => e.data?.attr?.id === id || e.data?.attributes?.some((a) => a.name === 'id' && a.value === id))!;

  it('passes structural validation', () => {
    expect(validateXscp(res.data)).toEqual([]);
  });

  it('has no native Image with a non-Webflow src; external images keep their URL verbatim', () => {
    const images = elements(res).filter((e) => e.type === 'Image');
    for (const img of images) expect(isNativeImageSrc(img.data!.attr!.src!)).toBe(true);
    const custom = elements(res).filter((e) => e.type === 'DOM' && e.data?.tag === 'img');
    expect(custom).toHaveLength(10);
    const src = custom[0]!.data!.attributes!.find((a) => a.name === 'src')!.value;
    expect(src).toBe('https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=1000&q=85');
  });

  it('collapses the About layout to one column at small', () => {
    expect(style(res, 'about_layout', '&').variants.small).toEqual({ styleLess: 'grid-template-columns: 1fr;' });
  });

  it('shows the hamburger from small down and hides the navbar CTA from medium down', () => {
    expect(style(res, 'navbar_menu-button').styleLess).toContain('display: none;');
    expect(style(res, 'navbar_menu-button').variants.small).toEqual({ styleLess: 'display: block;' });
    expect(css).toContain('@media (max-width: 991px) {');
    // `.button` is also used by the contact form, which stays a Code Embed (forms: 'auto').
    expect(css).toContain('[data-h2w-class~="navbar_component"][data-h2w-class~="navbar_component"]>:is(.button,[data-h2w-class~="button"]) {\n  display: none;');
    expect(css).toMatch(/@media \(max-width: 767px\) \{\nnav \{\n {2}display: none;/);
    expect(css).not.toMatch(/max-width: ?(850|640)px/);
  });

  it('leaves no bare b selector in the embed (b is pasted as strong)', () => {
    expect(css).not.toMatch(/(^|[\s,>+~(])b(?=[\s,{:.[>+~)])/m);
    expect(css).toContain('[data-h2w-class~="hero_features"] strong {\n  font-size: 19px;');
  });

  it('starts the embed with the baseline reset, without a margin-top reset for p', () => {
    expect(css.indexOf('Browser defaults')).toBeGreaterThan(-1);
    expect(css.indexOf('Browser defaults')).toBeLessThan(css.indexOf('[data-h2w-class~="process_item"] h3'));
    expect(css).toMatch(/\nbody\{letter-spacing:normal;/);
    expect(css).toMatch(/\np\{margin-right:0;margin-bottom:1em;margin-left:0;letter-spacing:inherit\}/);
  });

  it('marks both <button> toggles with data-h2w-button and adds the click shim', () => {
    for (const id of ['menuToggle', 'contactToggle']) {
      const el = byXattr(id);
      expect(el.type).toBe('Link');
      expect(el.data!.xattr).toContainEqual({ name: 'data-h2w-button', value: '' });
    }
    const js = elements(res).filter((e) => e.type === 'HtmlEmbed').pop()!.v!;
    expect(js).toContain("querySelectorAll('[data-h2w-button]')");
  });

  it('gives the <button> toggles their user-agent font without touching the <a class="button"> links', () => {
    expect(style(res, 'navbar_menu-button').styleLess).toContain('font-family: Arial, sans-serif;');
    expect(style(res, 'button').styleLess).not.toMatch(/font-family|line-height|cursor/);
    // `.button` is shared with the embedded contact form's <button>, so the overrides sit on combos.
    const names = classNames(res, byXattr('contactToggle'));
    expect(names.slice(0, 2)).toEqual(['button', 'is-outline']);
    expect(names[2]).toMatch(/^is-button-ua(-\d+)?$/);
    expect(style(res, names[2]!, '&').styleLess).toContain('font-family: Arial, sans-serif;');
  });

  it('keeps the JS-driven contact form as a Code Embed with its original <button type=submit>', () => {
    expect(elements(res).some((e) => e.type === 'FormForm')).toBe(false);
    const form = elements(res).find((e) => e.type === 'HtmlEmbed' && e.v!.startsWith('<form id="messageForm"'))!;
    expect(form.v).toContain('<button class="button" type="submit">');
    expect(css).toContain('.contact_form-grid {');
  });

  it('flags the class names that clashed in the destination site', () => {
    const w = res.warnings.find((x) => x.code === 'class-collision-risk')!;
    for (const name of ['container-large', 'button', 'navbar_logo', 'navbar_menu-button', 'button-group', 'padding-section-large', 'text-size-medium']) {
      expect(w.detail).toContain(name);
    }
    expect(w.detail).toMatch(/Combo classes not named is-\*: .*navbar_component/);
  });
});
