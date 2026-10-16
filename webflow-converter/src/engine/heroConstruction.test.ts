/**
 * Regression fixture from the "hero-construction" paste test: a Client-First hero for "Corbel
 * Builders" (white background, two columns: content | figure with a floating card, :root v2.1
 * colour variables, inline SVG icons, a count-up script), pasted into a site that already held an
 * earlier landing page ("GreenIron") with the SAME generic class names and another design.
 *
 * The live page showed (diag4):
 * - a dark green hero: `section_hero` was emitted as the site's own style (#04140c background,
 *   100vh flex), because an imported copy of the site's styles was active and the converter reused
 *   every same-named class. The scoped override embed cannot undo a background the source never set;
 * - the image under the content instead of beside it: `hero_component` was bound to an EMPTY site
 *   class of that name, so the grid was gone; `hero_card`, `hero_image`, `hero_content`… took the
 *   GreenIron layout (glass card at left: -3rem, grayscale image);
 * - the secondary button in GreenIron green: Webflow merged `.hero_button.is-secondary` with the
 *   site's `is-secondary` combo although `hero_button` was a new class;
 * - the trust line split: its `<p>` held an SVG Code Embed (`<div class="w-embed">`), so the browser
 *   closed the paragraph and the icon and text fell out of the flex row.
 */
import { describe, expect, it } from 'vitest';
import HERO from './__fixtures__/hero-construction.html?raw';
import { convert, validateXscp, type ConvertOptions, type ConvertResult, type WfElementNode, type WfStyle } from './index';
import { classNames, elements, embedCodes, kids, style } from './testHelpers';

const cls = (id: string, name: string, styleLess: string, variants: WfStyle['variants'] = {}, children: string[] = [], comb: '' | '&' = ''): WfStyle => ({
  _id: id,
  fake: false,
  type: 'class',
  name,
  namespace: '',
  comb,
  styleLess,
  variants,
  children,
  selector: null,
});

/** The site's existing classes (from the GreenIron pastes and the Client-First base), as imported. */
const GREENIRON_SITE: WfStyle[] = [
  cls(
    'gi-section-hero',
    'section_hero',
    'position: relative; display: flex; overflow: hidden; box-sizing: border-box; min-height: 100vh; padding-top: 8.5rem; padding-bottom: 5rem; align-items: center; background-color: #04140c;',
    { medium: { styleLess: 'min-height: auto; padding-top: 8rem;' } },
  ),
  cls('gi-hero-component', 'hero_component', ''),
  cls('gi-hero-component-2', 'hero_component 2', 'position: relative; z-index: 1; display: grid; align-items: center; grid-column-gap: 4rem; grid-row-gap: 4rem; grid-template-columns: 1.15fr 0.85fr;'),
  cls('gi-hero-content', 'hero_content', 'display: flex; flex-direction: column; align-items: flex-start;'),
  cls(
    'gi-hero-card',
    'hero_card',
    'position: absolute; left: -3rem; bottom: 3rem; display: flex; box-sizing: border-box; max-width: 18rem; align-items: flex-start; background-color: rgba(8, 32, 21, 0.75); backdrop-filter: blur(0.875rem);',
  ),
  cls('gi-hero-image', 'hero_image', 'display: block; width: 100%; height: 100%; filter: grayscale(100%) contrast(1.15); object-fit: cover;'),
  cls('gi-button', 'button', 'padding-top: 1rem; padding-bottom: 1rem; background-color: #3ddc84;', {}, ['gi-is-secondary']),
  cls('gi-is-secondary', 'is-secondary', 'background-color: rgba(61, 220, 132, 0); color: #3ddc84;', {}, [], '&'),
  // Identical to the source: reused.
  cls('cf-padding-global', 'padding-global', 'padding-right: 2.5rem; padding-left: 2.5rem;', { small: { styleLess: 'padding-right: 1.25rem; padding-left: 1.25rem;' } }),
  cls('cf-container-large', 'container-large', 'width: 100%; max-width: 80rem; margin-right: auto; margin-left: auto;'),
  // Same design, other values (a Client-First utility): compatible, reused with the source's values in the embed.
  cls('cf-padding-section-large', 'padding-section-large', 'padding-top: 7rem; padding-bottom: 7rem;', {
    medium: { styleLess: 'padding-top: 6rem; padding-bottom: 6rem;' },
    small: { styleLess: 'padding-top: 4rem; padding-bottom: 4rem;' },
  }),
];

const run = (options: Partial<ConvertOptions> = {}): ConvertResult => {
  const res = convert({ mode: 'combined', html: HERO }, options);
  expect(validateXscp(res.data)).toEqual([]);
  return res;
};

const byClass = (res: ConvertResult, name: string): WfElementNode => {
  const el = elements(res).find((e) => classNames(res, e)[0] === name);
  if (!el) throw new Error(`no element with class ${name}`);
  return el;
};

describe('hero-construction paste test', () => {
  it('converts without site styles: own classes, var() colours, :root embed before the section', () => {
    const res = run();
    const section = style(res, 'section_hero');
    expect(section.styleLess).not.toContain('background');
    expect(section.styleLess).toContain('color: @raw<|var(--text-color--primary)|>;');
    expect(style(res, 'hero_eyebrow').styleLess).toContain('background-color: @raw<|var(--background-color--secondary)|>;');
    // The :root variables are in the first embed, before the section.
    const root = res.data.payload.nodes[0] as WfElementNode;
    const [first, second] = kids(res, root) as WfElementNode[];
    expect(first!.type).toBe('HtmlEmbed');
    expect(first!.v).toMatch(/:root\s*\{[^}]*--background-color--primary:\s*var\(--neutral--white\)/);
    expect(classNames(res, second!)).toEqual(['section_hero']);
    expect(res.stats.reusedClasses).toBe(0);
  });

  it('keeps the DOM order: content, then the figure with the image and the card', () => {
    const res = run({ siteStyles: GREENIRON_SITE });
    const component = byClass(res, 'hero_component-corbel');
    expect((kids(res, component) as WfElementNode[]).map((k) => classNames(res, k)[0])).toEqual(['hero_content-corbel', 'hero_image-wrapper']);
    const figure = byClass(res, 'hero_image-wrapper');
    expect(figure.data?.tag).toBe('figure');
    expect((kids(res, figure) as WfElementNode[]).map((k) => classNames(res, k)[0])).toEqual(['hero_image-corbel', 'hero_card-corbel']);
    const grid = style(res, 'hero_component-corbel');
    expect(grid.styleLess).toContain('display: grid;');
    expect(grid.styleLess).toContain('grid-template-columns: 1.1fr 1fr;');
  });

  it('makes a paragraph with an SVG icon a Div Block, so the browser does not split it', () => {
    const res = run();
    const line = byClass(res, 'hero_trust-line');
    expect(line.type).toBe('Block');
    expect(line.data?.tag).toBe('div');
    const children = kids(res, line);
    expect(children[0]!).toMatchObject({ type: 'HtmlEmbed' });
    expect((children[0] as WfElementNode).v).toContain('hero_trust-icon');
    expect(children.some((c) => 'text' in c && c.text && c.v.includes('Fully licensed'))).toBe(true);
    expect(res.warnings.some((w) => /A <p> containing <svg> became a Div Block/.test(w.message))).toBe(true);
    // Other paragraphs stay paragraphs.
    expect(byClass(res, 'hero_paragraph').type).toBe('Paragraph');
  });

  it('renames classes the site has with another design instead of reusing them', () => {
    const res = run({ siteStyles: GREENIRON_SITE });
    const names = res.data.payload.styles.map((s) => s.name);
    for (const name of ['section_hero', 'hero_component', 'hero_content', 'hero_card', 'hero_image']) {
      expect(names).not.toContain(name);
      expect(names).toContain(`${name}-corbel`);
    }
    // No site style object of a conflicting class is in the payload.
    const ids = new Set(res.data.payload.styles.map((s) => s._id));
    for (const id of ['gi-section-hero', 'gi-hero-component', 'gi-hero-component-2', 'gi-hero-content', 'gi-hero-card', 'gi-hero-image']) expect(ids.has(id)).toBe(false);
    // The renamed section carries the source's CSS, not the site's dark green background.
    const section = style(res, 'section_hero-corbel');
    expect(section.styleLess).not.toContain('#04140c');
    expect(section.styleLess).not.toContain('min-height');
    expect(JSON.stringify(res.data.payload.styles)).not.toContain('#04140c');
    expect(embedCodes(res).join('\n')).not.toContain('[data-h2w-class~="section_hero"]');
    expect(style(res, 'hero_card-corbel').styleLess).toContain('left: 1.5rem;');
    // The combo the site has under another parent with other styles is renamed too.
    expect(classNames(res, byClass(res, 'hero_button-group').children.map((id) => elements(res).find((e) => e._id === id)!)[1]!)).toEqual(['hero_button', 'is-secondary-corbel']);
    const w = res.warnings.find((x) => x.code === 'site-classes' && /renamed to avoid clashing/.test(x.message))!;
    expect(w.severity).toBe('warning');
    expect(w.message).toMatch(/^6 classes were renamed to avoid clashing with different site classes: section_hero → section_hero-corbel/);
    expect(w.detail).toContain('section_hero → section_hero-corbel (site\'s version differs in position, display');
    expect(res.stats.renamedClasses).toBe(6);
  });

  it('reuses equal and compatible site classes', () => {
    const res = run({ siteStyles: GREENIRON_SITE });
    const payloadIds = new Set(res.data.payload.styles.map((s) => s._id));
    for (const id of ['cf-padding-global', 'cf-container-large', 'cf-padding-section-large']) expect(payloadIds.has(id)).toBe(true);
    expect(res.stats.reusedClasses).toBe(3);
    // padding-section-large differs only in padding values: the source's go to the scoped embed.
    const css = embedCodes(res).join('\n');
    expect(css).toMatch(/\[data-h2w-class~="padding-section-large"\] \{\n {2}padding-top: 8rem;\n {2}padding-bottom: 8rem;/);
    // The 8rem override applies at every narrower width too, so the source's breakpoint values are
    // re-asserted where the site's would otherwise lose to it (paste test: 8rem on mobile).
    expect(css).toMatch(/@media \(max-width: 991px\) \{\n\[data-h2w-class~="padding-section-large"\] \{\n {2}padding-top: 6rem;\n {2}padding-bottom: 6rem;/);
    expect(css).toMatch(/@media \(max-width: 767px\) \{\n\[data-h2w-class~="padding-section-large"\] \{\n {2}padding-top: 4rem;\n {2}padding-bottom: 4rem;/);
  });

  it("siteClassConflicts 'reuse' keeps the pre-v7 behaviour (every same-named class reused)", () => {
    const res = run({ siteStyles: GREENIRON_SITE, siteClassConflicts: 'reuse' });
    expect(style(res, 'section_hero')._id).toBe('gi-section-hero');
    expect(style(res, 'hero_component')._id).toBe('gi-hero-component');
    expect(res.stats.renamedClasses).toBeUndefined();
  });

  it('renames deterministically, and avoids names the site already has', () => {
    const taken = [...GREENIRON_SITE, cls('gi-taken', 'section_hero-corbel', 'color: red;')];
    const a = run({ siteStyles: taken });
    const b = run({ siteStyles: taken });
    expect(style(a, 'section_hero-corbel-2')._id).toBe(style(b, 'section_hero-corbel-2')._id);
    expect(a.data.payload.styles.some((s) => s.name === 'section_hero-corbel')).toBe(false);
  });
});
