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
 *
 * v7 renamed classes whose design differed, yet the next paste on a NEW page (/testhero, diag5)
 * still had the GreenIron colours: `section_hero 2`, `hero_card 2`, the EMPTY `hero_component`,
 * `hero_content`, `hero_stat(-label)`, `hero_image`, `hero_card-label/-title` were the site's
 * GreenIron style objects (exactly what the converter emits when an import is active and same-named
 * classes are reused), and `.hero_button-2.is-secondary`, a combo Webflow created that day under a
 * brand-new parent, carried GreenIron's green values. The user's rule since v8: "if a class name
 * repeats and the CSS is different, create a duplicate of that class" -- for base classes AND
 * combos, with or without an import. So: any CSS difference means a separate class, combos get a
 * name derived from their CSS (`uniqueCombos`), and :root variables are inlined/scoped
 * (`cssVariables`) so no site variable or other section can recolour the hero.
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
  // Same design, other values (a Client-First utility): different CSS, so a separate class since v8.
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

/** GreenIron's colour variables, as its :root embed / site Variables would define them on the page. */
const GREENIRON_ROOT_CSS = `:root {
  --background-color--primary: #04140c;
  --background-color--secondary: #082015;
  --background-color--alternate: #082015;
  --background-color--accent: #3ddc84;
  --text-color--primary: #ecfff3;
  --text-color--secondary: #7fb895;
  --text-color--alternate: #ecfff3;
  --border-color--primary: #174a30;
  --border-color--accent: #3ddc84;
}`;

/** Corbel's colours (hero-construction.html :root). */
const CORBEL = { white: '#ffffff', lightest: '#f4f5f7', dark: '#4a5260', darkest: '#14181f', amber: '#f5a524' };

/**
 * The value a custom property has on a pasted element: its nearest definition among the pasted
 * root's scoped block (`[data-h2w-vars]`, an ancestor of every pasted element) and the page's
 * `:root` blocks (GreenIron's, then ours if they are still global). Enough for these blocks.
 */
function customPropertyOnPastedElement(res: ConvertResult, name: string): string | undefined {
  const css = embedCodes(res).join('\n');
  const decl = (block: string) => new RegExp(`${name.replace(/-/g, '\\-')}:\\s*([^;]+);`).exec(block)?.[1]?.trim();
  const scoped = /\[data-h2w-vars="[^"]+"\]\s*\{([^}]*)\}/.exec(css)?.[1];
  const fromScope = scoped ? decl(scoped) : undefined;
  if (fromScope) return fromScope;
  // Global blocks: the pasted embed comes after the site's CSS, so its :root wins over GreenIron's.
  const ownRoot = /:root\s*\{([^}]*)\}/.exec(css)?.[1];
  return (ownRoot ? decl(ownRoot) : undefined) ?? decl(GREENIRON_ROOT_CSS);
}

/** Resolves `var()` in a class value the way the pasted page would (one level of nesting is enough here). */
function resolveOnPage(res: ConvertResult, value: string): string {
  return value.replace(/@raw<\|var\((--[\w-]+)\)\|>|var\((--[\w-]+)\)/g, (_m, a: string | undefined, b: string | undefined) => {
    const v = customPropertyOnPastedElement(res, (a ?? b)!) ?? '';
    const inner = /^var\((--[\w-]+)\)$/.exec(v);
    return inner ? (customPropertyOnPastedElement(res, inner[1]!) ?? v) : v;
  });
}

const prop = (s: WfStyle, name: string): string | undefined => new RegExp(`(?:^|; )${name}: ([^;]+);`).exec(s.styleLess)?.[1];

describe('hero-construction paste test', () => {
  it('converts without site styles: own classes with the source colours as values, :root variables scoped to the pasted root', () => {
    const res = run();
    const section = style(res, 'section_hero');
    expect(section.styleLess).not.toContain('background');
    expect(prop(section, 'color')).toBe(CORBEL.darkest);
    expect(prop(style(res, 'hero_eyebrow'), 'background-color')).toBe(CORBEL.lightest);
    expect(prop(style(res, 'hero_button'), 'background-color')).toBe(CORBEL.amber);
    expect(prop(style(res, 'hero_card'), 'background-color')).toBe(CORBEL.darkest);
    expect(prop(style(res, 'hero_card'), 'color')).toBe(CORBEL.white);
    expect(JSON.stringify(res.data.payload.styles)).not.toContain('var(--');
    // The variables are defined on the pasted root, never on :root.
    const root = res.data.payload.nodes[0] as WfElementNode;
    const scope = root.data?.xattr?.find((a) => a.name === 'data-h2w-vars')?.value;
    expect(scope).toMatch(/^v[0-9a-f]{8}$/);
    const [first, second] = kids(res, root) as WfElementNode[];
    expect(first!.type).toBe('HtmlEmbed');
    expect(first!.v).toContain(`[data-h2w-vars="${scope}"] {\n  --neutral--white: #ffffff;`);
    expect(first!.v).not.toMatch(/:root\s*\{/);
    expect(classNames(res, second!)).toEqual(['section_hero']);
    expect(res.stats.reusedClasses).toBe(0);
    expect(res.warnings.some((w) => w.code === 'css-variable' && /21 CSS variables were replaced by their values/.test(w.message))).toBe(true);
  });

  it('keeps the Corbel colours on a page that holds GreenIron classes, combos and :root variables', () => {
    for (const siteStyles of [undefined, GREENIRON_SITE]) {
      const res = run(siteStyles ? { siteStyles } : {});
      const cls = (name: string) => style(res, res.data.payload.styles.find((s) => s.comb === '' && (s.name === name || s.name === `${name}-corbel`))!.name);
      // White background: the section sets none (the page shows through), never GreenIron's #04140c.
      expect(cls('section_hero').styleLess).not.toContain('background');
      expect(JSON.stringify(res.data.payload.styles)).not.toMatch(/#04140c|#3ddc84|#ecfff3|#7fb895|rgba\(8, 32, 21/);
      // Amber primary button, dark card, dark text: the values themselves, whatever the page defines.
      expect(resolveOnPage(res, prop(cls('hero_button'), 'background-color')!)).toBe(CORBEL.amber);
      expect(resolveOnPage(res, prop(cls('hero_card'), 'background-color')!)).toBe(CORBEL.darkest);
      expect(resolveOnPage(res, prop(cls('hero_stat-label'), 'color')!)).toBe(CORBEL.dark);
      // The secondary button combo has a name no site combo has, so Webflow cannot merge it.
      const combo = res.data.payload.styles.find((s) => s.comb === '&')!;
      expect(combo.name).toMatch(/^is-secondary-(corbel|[0-9a-z]{4})$/);
      expect(res.data.payload.styles.some((s) => s.comb === '&' && s.name === 'is-secondary')).toBe(false);
      expect(resolveOnPage(res, prop(combo, 'border-top-color')!)).toBe(CORBEL.darkest);
    }
  });

  it("cssVariables 'scope' keeps var() in the classes and resolves them from the pasted root, not GreenIron's :root", () => {
    const res = run({ cssVariables: 'scope' });
    const button = style(res, 'hero_button');
    expect(prop(button, 'background-color')).toBe('@raw<|var(--background-color--accent)|>');
    expect(customPropertyOnPastedElement(res, '--background-color--accent')).toBe('var(--brand--primary)');
    expect(resolveOnPage(res, prop(button, 'background-color')!)).toBe(CORBEL.amber);
    expect(resolveOnPage(res, prop(style(res, 'hero_card'), 'background-color')!)).toBe(CORBEL.darkest);
    expect(embedCodes(res).join('\n')).not.toMatch(/:root\s*\{/);
    // The trust icon rule in the embed is outside the classes but inside the pasted root: var() stays.
    expect(embedCodes(res).join('\n')).toContain('color: var(--text-color--primary);');
  });

  it("cssVariables 'global' keeps the :root block (pre-v8): GreenIron's variables could then win", () => {
    const res = run({ cssVariables: 'global' });
    expect(prop(style(res, 'hero_button'), 'background-color')).toBe('@raw<|var(--background-color--accent)|>');
    const root = res.data.payload.nodes[0] as WfElementNode;
    expect(root.data?.xattr?.some((a) => a.name === 'data-h2w-vars')).toBe(false);
    expect(embedCodes(res)[0]).toMatch(/:root\s*\{[^}]*--background-color--primary:\s*var\(--neutral--white\)/);
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

  it('creates a separate class for every site class with the same name and different CSS', () => {
    const res = run({ siteStyles: GREENIRON_SITE });
    const names = res.data.payload.styles.map((s) => s.name);
    for (const name of ['section_hero', 'hero_component', 'hero_content', 'hero_card', 'hero_image', 'padding-section-large']) {
      expect(names).not.toContain(name);
      expect(names).toContain(`${name}-corbel`);
    }
    // No site style object of a differing class is in the payload.
    const ids = new Set(res.data.payload.styles.map((s) => s._id));
    for (const id of ['gi-section-hero', 'gi-hero-component', 'gi-hero-component-2', 'gi-hero-content', 'gi-hero-card', 'gi-hero-image', 'cf-padding-section-large']) {
      expect(ids.has(id)).toBe(false);
    }
    // The renamed section carries the source's CSS, not the site's dark green background.
    const section = style(res, 'section_hero-corbel');
    expect(section.styleLess).not.toContain('#04140c');
    expect(section.styleLess).not.toContain('min-height');
    expect(embedCodes(res).join('\n')).not.toContain('[data-h2w-class~="section_hero"]');
    expect(style(res, 'hero_card-corbel').styleLess).toContain('left: 1.5rem;');
    expect(style(res, 'padding-section-large-corbel').styleLess).toBe('padding-top: 8rem; padding-bottom: 8rem;');
    // The combo the site has under another parent with other styles is renamed too.
    expect(classNames(res, byClass(res, 'hero_button-group').children.map((id) => elements(res).find((e) => e._id === id)!)[1]!)).toEqual(['hero_button', 'is-secondary-corbel']);
    const w = res.warnings.find((x) => x.code === 'site-classes' && /renamed to avoid clashing/.test(x.message))!;
    expect(w.severity).toBe('warning');
    expect(w.message).toMatch(/^7 classes were renamed to avoid clashing with different site classes: section_hero → section_hero-corbel/);
    expect(w.detail).toContain("section_hero → section_hero-corbel (site's version differs in position, display");
    expect(w.detail).toContain('padding-section-large → padding-section-large-corbel');
    expect(res.stats.renamedClasses).toBe(7);
  });

  it('reuses only the site classes whose CSS is identical', () => {
    const res = run({ siteStyles: GREENIRON_SITE });
    const payloadIds = new Set(res.data.payload.styles.map((s) => s._id));
    for (const id of ['cf-padding-global', 'cf-container-large']) expect(payloadIds.has(id)).toBe(true);
    expect(res.stats.reusedClasses).toBe(2);
    // Nothing of the site's needs undoing: no override rules in the embed.
    expect(embedCodes(res).join('\n')).not.toContain('[data-h2w-class~=');
  });

  it("siteClassConflicts 'reuse' (\"Use the site's class\") still reuses every same-named base class", () => {
    const res = run({ siteStyles: GREENIRON_SITE, siteClassConflicts: 'reuse' });
    expect(style(res, 'section_hero')._id).toBe('gi-section-hero');
    expect(style(res, 'hero_component')._id).toBe('gi-hero-component');
    // Combos keep a CSS-derived name even then: Webflow would merge them silently.
    expect(res.stats.renamedClasses).toBe(1);
    expect(res.data.payload.styles.find((s) => s.comb === '&')!.name).toMatch(/^is-secondary-[0-9a-z]{4}$/);
  });

  it('renames deterministically, and avoids names the site already has', () => {
    const taken = [...GREENIRON_SITE, cls('gi-taken', 'section_hero-corbel', 'color: red;')];
    const a = run({ siteStyles: taken });
    const b = run({ siteStyles: taken });
    expect(style(a, 'section_hero-corbel-2')._id).toBe(style(b, 'section_hero-corbel-2')._id);
    expect(a.data.payload.styles.some((s) => s.name === 'section_hero-corbel')).toBe(false);
    const c = run();
    const d = run();
    expect(c.data.payload.styles.find((s) => s.comb === '&')!.name).toBe(d.data.payload.styles.find((s) => s.comb === '&')!.name);
  });
});

describe('uniqueCombos', () => {
  const html = (script = '') =>
    `<style>.btn{padding:1rem}.btn.is-dark{background-color:#111;color:#fff}.btn.is-open{color:red}.btn.is-empty{}</style><div><a class="btn is-dark" href="#">a</a><a class="btn is-open" href="#">b</a><a class="btn is-empty" href="#">c</a></div>${script}`;

  it('suffixes styled combos with a hash of their CSS; unstyled combos keep their name', () => {
    const res = convert({ mode: 'combined', html: html() });
    const combos = res.data.payload.styles.filter((s) => s.comb === '&').map((s) => s.name);
    expect(combos).toHaveLength(3);
    expect(combos.find((n) => n.startsWith('is-dark'))).toMatch(/^is-dark-[0-9a-z]{4}$/);
    expect(combos.find((n) => n.startsWith('is-open'))).toMatch(/^is-open-[0-9a-z]{4}$/);
    expect(combos).toContain('is-empty');
    const note = res.warnings.find((w) => /got a suffix from their CSS/.test(w.message))!;
    expect(note.message).toMatch(/^2 combo classes got a suffix/);
  });

  it('keeps the name of a combo a script toggles and repeats its CSS in the embed', () => {
    const res = convert({ mode: 'combined', html: html(`<script>document.querySelector('.btn').classList.toggle('is-open')</script>`) });
    const combos = res.data.payload.styles.filter((s) => s.comb === '&').map((s) => s.name);
    expect(combos).toContain('is-open');
    expect(combos.find((n) => n.startsWith('is-dark'))).toMatch(/^is-dark-[0-9a-z]{4}$/);
    const css = embedCodes(res).join('\n');
    expect(css).toMatch(/\[data-h2w-class~="btn"\]\.is-open \{\n {2}color: red;\n\}/);
    const w = res.warnings.find((x) => /keeps its name because a script adds or toggles it/.test(x.message))!;
    expect(w.severity).toBe('warning');
    expect(w.message).toContain('btn.is-open');
  });

  it('is off with uniqueCombos: false', () => {
    const res = convert({ mode: 'combined', html: html() }, { uniqueCombos: false });
    expect(res.data.payload.styles.filter((s) => s.comb === '&').map((s) => s.name).sort()).toEqual(['is-dark', 'is-empty', 'is-open']);
  });
});
