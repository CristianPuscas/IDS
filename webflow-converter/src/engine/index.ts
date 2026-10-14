/**
 * Public engine API. The UI imports only from this module (and from ./types, ./clipboard).
 *
 * Pipeline:
 *   parseHtml -> class renames (normalization, `classPrefix`) -> parseCss -> buildNodes (registers
 *   class chains) -> mapStyles (fills styles, collects leftover CSS; the baseline reset goes first
 *   and embed selectors are rewritten by ./embedCss, which also tags elements with `data-h2w-class`)
 *   -> extractJs (+ button click shim) -> embeds -> XscpData
 *
 * Root decision (spec 1): the payload is always a single tree whose first node is the root. When
 * the input has exactly one top-level element and nothing needs an embed, that element is the
 * root. Otherwise everything is wrapped in one classless root `Block` (div); `<link>`/`<style>`
 * embeds become its first children and `<script>` embeds its last children, so scripts run after
 * the elements they query. A multi-root payload is never emitted: the 2018 paste code throws
 * "Subtree reification resulted in more than one root!".
 *
 * Ownership: engine.
 */

import { buildBaselineReset, isFullDocument } from './baseline';
import { cssClassNames, findJsClassReferences, isWebflowClassName, planClassRenames, renameClassesInDocument, rewriteCssClasses } from './classNames';
import { attrSelector, isEmptyPlan, planEmbedRewrite, rewriteEmbedSelector } from './embedCss';
import { parseCss } from './cssParser';
import { buildEmbedNode, buildScriptEmbeds, buildStyleEmbeds } from './embedBuilder';
import { parseHtml, type ParsedHtml } from './htmlParser';
import { uuid } from './ids';
import { extractJs } from './jsExtractor';
import { buildNodes } from './nodeBuilder';
import { createStyleRegistry, mapStyles, type MapStylesHooks, type StyleRegistry } from './styleMapper';
import {
  DEFAULT_CONVERT_OPTIONS,
  isTextNode,
  XSCP_TYPE,
  type ConvertInput,
  type ConvertOptions,
  type ConvertResult,
  type ConvertWarning,
  type WfElementNode,
  type WfNode,
  type XscpData,
} from './types';

export * from './types';
export { copyToWebflow, isSafari } from './clipboard';
export { validateXscp } from './validate';

/** Merges user options over `DEFAULT_CONVERT_OPTIONS`, ignoring `undefined` and invalid numbers. */
export function resolveOptions(options: Partial<ConvertOptions> = {}): ConvertOptions {
  const out: ConvertOptions = { ...DEFAULT_CONVERT_OPTIONS };
  for (const [k, v] of Object.entries(options) as [keyof ConvertOptions, unknown][]) {
    if (v !== undefined) (out as unknown as Record<string, unknown>)[k] = v;
  }
  if (!Number.isFinite(out.breakpointTolerancePx) || out.breakpointTolerancePx < 0) {
    out.breakpointTolerancePx = DEFAULT_CONVERT_OPTIONS.breakpointTolerancePx;
  }
  if (typeof out.classPrefix !== 'string') out.classPrefix = '';
  if (!Number.isFinite(out.maxEmbedChars) || out.maxEmbedChars < 100) {
    out.maxEmbedChars = Number.isFinite(out.maxEmbedChars) ? 100 : DEFAULT_CONVERT_OPTIONS.maxEmbedChars;
  }
  return out;
}

/** Returns an `XscpData` with the full required shape and the given nodes/styles. */
export function createXscpData(nodes: XscpData['payload']['nodes'], styles: XscpData['payload']['styles']): XscpData {
  return {
    type: XSCP_TYPE,
    payload: {
      nodes,
      styles,
      assets: [],
      ix1: [],
      ix2: { interactions: [], events: [], actionLists: [] },
    },
    meta: {
      unlinkedSymbolCount: 0,
      droppedLinks: 0,
      dynBindRemovedCount: 0,
      dynListBindRemovedCount: 0,
      paginationRemovedCount: 0,
    },
  };
}

/**
 * Converts HTML/CSS/JS into a Webflow clipboard payload.
 *
 * Pure and synchronous (no network, no clipboard access), so it can be called inside a click
 * handler right before `copyToWebflow(result.json)`. Never throws for malformed input; problems
 * are reported in `warnings`.
 *
 * @param input Combined HTML, or separate HTML/CSS/JS.
 * @param options Overrides for `DEFAULT_CONVERT_OPTIONS`.
 * @returns The payload, its JSON string, warnings and stats.
 */
export function convert(input: ConvertInput, options?: Partial<ConvertOptions>): ConvertResult {
  try {
    return convertUnsafe(input, resolveOptions(options));
  } catch (err) {
    // Contract: never throw. Return a valid empty payload with an error warning.
    const root: WfElementNode = buildEmptyRoot();
    const data = createXscpData([root], []);
    return {
      data,
      json: JSON.stringify(data),
      warnings: [
        {
          code: 'parse-error',
          severity: 'error',
          message: 'The converter failed on this input; nothing was converted.',
          detail: err instanceof Error ? err.message : String(err),
        },
      ],
      stats: { nodes: 1, styles: 0, embeds: 0, embeddedCssRules: 0, jsBytes: 0 },
    };
  }
}

function convertUnsafe(input: ConvertInput, options: ConvertOptions): ConvertResult {
  let opts = options;
  const warnings: ConvertWarning[] = [];
  const html = input.html ?? '';
  const editorCss = input.mode === 'separate' ? (input.css ?? '') : '';
  const editorJs = input.mode === 'separate' ? (input.js ?? '') : '';

  if (!html.trim() && !editorCss.trim() && !editorJs.trim()) {
    warnings.push({ code: 'empty-input', severity: 'error', message: 'Nothing to convert: the input is empty.' });
  }

  const parsed = parseHtml(html);
  warnings.push(...parsed.warnings);

  let cssText = [...parsed.styles, editorCss].filter((s) => s.trim()).join('\n');
  const scriptsText = [...parsed.scripts.map((s) => s.code), editorJs];
  if (opts.normalizeClassNames) {
    cssText = normalizeClassNames(parsed, cssText, scriptsText, warnings);
  }
  if (opts.classPrefix) {
    const prefix = sanitizePrefix(opts.classPrefix);
    if (prefix) cssText = prefixClassNames(parsed, cssText, scriptsText, prefix, warnings);
    else {
      warnings.push({
        code: 'other',
        severity: 'warning',
        message: `classPrefix "${opts.classPrefix}" is not usable as the start of a Webflow class name (letters, digits, "-" and "_", not starting with a digit, "w-" or "wf-"); no prefix was added.`,
      });
    }
    opts = { ...opts, classPrefix: prefix };
  }
  const css = parseCss(cssText);
  warnings.push(...css.warnings);

  // Class names used anywhere, so generated names (inline-style-N, button, *-embed) never clash.
  const reserved = new Set(parsed.classNames);
  for (const name of cssClassNames(cssText)) reserved.add(name);

  const registry = createStyleRegistry();
  const built = buildNodes(parsed.roots, registry, opts, {
    rootClasses: parsed.bodyClasses,
    reservedClassNames: reserved,
    cssRules: css.rules,
  });
  warnings.push(...built.warnings);

  const hooks: MapStylesHooks = {};
  if (opts.neutralizeDefaults && opts.keepUnsupportedInEmbed && isFullDocument(html)) {
    const reset = buildBaselineReset(css.rules);
    if (reset) {
      hooks.prelude = reset;
      warnings.push({
        code: 'baseline-reset',
        severity: 'info',
        message:
          'A short reset of browser defaults (body, headings, p, label, img, lists, strong) was put at the top of the <style> embed, so the site\'s tag styles do not change properties this page left to the browser. It applies to the whole page it is pasted on.',
        detail: reset,
      });
    }
  }
  hooks.prepareEmbed = (selectors) => {
    const plan = planEmbedRewrite({
      selectors,
      chains: registry.chains(),
      styled: styledClassNames(registry),
      embeddedClassLists: built.usage.embeddedClassLists,
      remappedTags: built.remappedTags,
      embedSpecificityParity: opts.embedSpecificityParity,
      renameProofEmbedCss: opts.renameProofEmbedCss,
      rewriteRemappedTags: opts.rewriteRemappedTags,
    });
    if (isEmptyPlan(plan)) return null;
    if (plan.attr.size > 0) {
      const tagged = tagDataWfc(built.nodes, registry, plan.attr);
      warnings.push({
        code: 'other',
        severity: 'info',
        message: `Code Embed CSS refers to ${plan.attr.size} native class${plan.attr.size > 1 ? 'es' : ''} through a data-h2w-class attribute (${tagged} element${tagged === 1 ? '' : 's'}), so it keeps matching if Webflow renames a clashing class to "name 2".`,
        detail: [...plan.attr].map((c) => `.${c} -> ${attrSelector(c)}`).join('\n'),
      });
    }
    return (selector) => rewriteEmbedSelector(selector, plan);
  };

  const styleMap = mapStyles({ ...css, rules: [...css.rules, ...built.extraRules] }, registry, built.usage, opts, hooks);
  warnings.push(...styleMap.warnings);
  if (!opts.classPrefix) warnings.push(...collisionWarnings(registry));

  const js = extractJs(parsed.scripts, editorJs);
  warnings.push(...js.warnings);
  if (opts.buttonClickShim && built.convertedButtons > 0) {
    js.scripts.unshift({ src: null, code: BUTTON_CLICK_SHIM, attributes: [] });
    js.totalBytes += new TextEncoder().encode(BUTTON_CLICK_SHIM).length;
    warnings.push({
      code: 'script-extracted',
      severity: 'info',
      message: `${built.convertedButtons} <button>${built.convertedButtons > 1 ? 's' : ''} became Webflow links (published with href="#"); a one-line script at the top of the script embed stops their clicks from jumping to the top of the page.`,
      detail: BUTTON_CLICK_SHIM,
    });
  }

  // Embeds: links + CSS first (styles apply before content renders), scripts last.
  const headEmbeds: WfElementNode[] = [];
  if (parsed.headLinks.length > 0) headEmbeds.push(buildEmbedNode(parsed.headLinks.join('\n')));
  const styleEmbeds = opts.keepUnsupportedInEmbed ? buildStyleEmbeds(styleMap.leftoverCss, opts.maxEmbedChars) : { nodes: [], warnings: [] };
  headEmbeds.push(...styleEmbeds.nodes);
  warnings.push(...styleEmbeds.warnings);
  const scriptEmbeds = buildScriptEmbeds(js, opts.maxEmbedChars);
  warnings.push(...scriptEmbeds.warnings);

  const { root, nodes: builtNodes, topLevel } = built;
  const descendants = builtNodes.slice(1);
  let nodes: WfNode[];
  const single = topLevel.length === 1 ? builtNodes.find((n) => n._id === topLevel[0]) : undefined;
  if (single && !isTextNode(single) && headEmbeds.length === 0 && scriptEmbeds.nodes.length === 0 && root.classes.length === 0) {
    // One element and no embeds: it is the root itself (no extra wrapper div).
    nodes = descendants;
  } else {
    root.children = [...headEmbeds.map((e) => e._id), ...topLevel, ...scriptEmbeds.nodes.map((e) => e._id)];
    nodes = [root, ...headEmbeds, ...descendants, ...scriptEmbeds.nodes];
    if (topLevel.length > 1) {
      warnings.push({
        code: 'multiple-roots-wrapped',
        severity: 'info',
        message: `${topLevel.length} top-level elements were wrapped in one root Div Block (Webflow pastes a single tree).`,
      });
    }
  }

  const styles = registry.styles();
  const data = createXscpData(nodes, styles);
  const json = JSON.stringify(data);
  const embedCount = nodes.filter((n) => !isTextNode(n) && n.type === 'HtmlEmbed').length;

  return {
    data,
    json,
    warnings,
    stats: {
      nodes: nodes.length,
      styles: styles.length,
      embeds: embedCount,
      embeddedCssRules: opts.keepUnsupportedInEmbed ? styleMap.leftoverRuleCount : 0,
      jsBytes: js.totalBytes,
    },
  };
}

/**
 * Renames classes Webflow would publish under a different selector (uppercase, `:`, `/`…) to that
 * selector, in the HTML and in every stylesheet, so native classes and `<style>` embeds keep
 * matching (spec 3.1). Scripts are not rewritten; renamed classes they mention are reported.
 * Mutates `parsed` (document, class lists) and returns the rewritten CSS.
 */
function normalizeClassNames(parsed: ParsedHtml, cssText: string, scripts: string[], warnings: ConvertWarning[]): string {
  const renames = planClassRenames(parsed.classNames, cssClassNames(cssText));
  if (renames.size === 0) return cssText;
  renameClassesInDocument(parsed.document, renames);
  const rename = (c: string): string => renames.get(c) ?? c;
  parsed.classNames = new Set([...parsed.classNames].map(rename));
  parsed.bodyClasses = parsed.bodyClasses.map(rename);
  const list = [...renames].map(([from, to]) => `${from} → ${to}`);
  warnings.push({
    code: 'class-renamed',
    severity: 'info',
    message: `${renames.size} class name${renames.size > 1 ? 's were' : ' was'} renamed to the form Webflow publishes (lowercase, other characters become "-"); the <style> CSS was updated to match.`,
    detail: list.join('\n'),
  });
  const refs = findJsClassReferences(scripts, renames);
  if (refs.length > 0) {
    const names = [...new Set(refs.map((r) => `${r.oldName} → ${r.newName}`))];
    warnings.push({
      code: 'class-renamed',
      severity: 'warning',
      message: `Scripts still reference renamed classes (${names.join(', ')}). Scripts are not rewritten: update these strings to the new names.`,
      detail: refs.map((r) => `${r.literal}  (${r.oldName} → ${r.newName})`).join('\n'),
    });
  }
  return rewriteCssClasses(cssText, renames);
}

/** Stops converted `<button>` links (`href="#"` once published) from jumping to the top. */
export const BUTTON_CLICK_SHIM =
  "document.querySelectorAll('[data-h2w-button]').forEach(b=>b.addEventListener('click',e=>e.preventDefault()))";

/** Class names whose Webflow style (base or any combo level) has declarations. */
function styledClassNames(registry: StyleRegistry): Set<string> {
  const out = new Set<string>();
  for (const { style } of registry.prefixes()) {
    if (style.styleLess.trim() || Object.keys(style.variants).length > 0) out.add(style.name);
  }
  return out;
}

/**
 * Adds `data-h2w-class="<class names>"` to every element that has one of `classes` (`data.attributes`
 * on Custom Elements, `data.xattr` elsewhere). Returns how many elements were tagged.
 */
function tagDataWfc(nodes: WfNode[], registry: StyleRegistry, classes: Set<string>): number {
  const nameById = new Map(registry.styles().map((s) => [s._id, s.name]));
  let count = 0;
  for (const n of nodes) {
    if (isTextNode(n) || n.type === 'HtmlEmbed' || n.classes.length === 0) continue;
    const names = n.classes.map((id) => nameById.get(id) ?? '').filter(Boolean);
    if (!names.some((c) => classes.has(c))) continue;
    const attr = { name: 'data-h2w-class', value: names.join(' ') };
    if (n.type === 'DOM') {
      n.data = n.data ?? {};
      n.data.attributes = [...(n.data.attributes ?? []).filter((a) => a.name !== 'data-h2w-class'), attr];
    } else {
      n.data = n.data ?? { attr: { id: '' } };
      n.data.xattr = [...(n.data.xattr ?? []).filter((a) => a.name !== 'data-h2w-class'), attr];
    }
    count++;
  }
  return count;
}

/**
 * Class names that Client-First / Relume sites commonly define globally. Pasting a class whose name
 * exists with different styles makes Webflow rename it to "name 2" (S7); a combo class merges with
 * a same-named class of the site, whose styles then apply too.
 */
const CORE_CLASS = [
  /^(page-wrapper|main-wrapper|button|button-group|hide|layer|overflow-hidden|align-center|fs-styleguide.*)$/,
  /^(container|padding|margin|spacer|text-size|text-weight|text-style|text-color|text-align|heading-style|max-width|background-color|icon-embed|icon-height|icon-1x1|pointer-events|z-index|aspect-ratio|hide)-/,
  /^navbar_/,
  /^[a-z]+\d+_/, // Relume component names: navbar1_component, header5_content…
];

function collisionWarnings(registry: StyleRegistry): ConvertWarning[] {
  const core: string[] = [];
  const combos: string[] = [];
  for (const s of registry.styles()) {
    if (s.comb === '' && CORE_CLASS.some((re) => re.test(s.name)) && !core.includes(s.name)) core.push(s.name);
    if (s.comb === '&' && !s.name.startsWith('is-') && !/^inline-style-\d+$/.test(s.name) && !combos.includes(s.name)) combos.push(s.name);
  }
  if (core.length === 0 && combos.length === 0) return [];
  const detail: string[] = [];
  if (core.length) detail.push(`Common Client-First / Relume names: ${core.join(', ')}`);
  if (combos.length) detail.push(`Combo classes not named is-*: ${combos.join(', ')}`);
  return [
    {
      code: 'class-collision-risk',
      severity: 'warning',
      message:
        'Some classes may already exist in your Webflow site. Webflow renames a pasted class that clashes to "name 2", and a combo class merges with a site class of the same name (its styles apply too). Paste into a clean site, or set the classPrefix option.',
      detail: detail.join('\n'),
    },
  ];
}

/** Lower-cases a class prefix and replaces other characters with "-"; `""` when unusable. */
function sanitizePrefix(prefix: string): string {
  const p = prefix.trim().toLowerCase().replace(/[^0-9a-z_-]/g, '-');
  return p && isWebflowClassName(`${p}x`) ? p : '';
}

/**
 * Adds `prefix` to every class used in the HTML (not to CSS-only classes, which scripts usually
 * toggle), in the document and in the CSS. Scripts are not rewritten; literals that mention a
 * prefixed class are reported.
 */
function prefixClassNames(parsed: ParsedHtml, cssText: string, scripts: string[], prefix: string, warnings: ConvertWarning[]): string {
  const renames = new Map<string, string>();
  for (const c of parsed.classNames) if (!c.startsWith('w--') && !c.startsWith(prefix)) renames.set(c, prefix + c);
  if (renames.size === 0) return cssText;
  renameClassesInDocument(parsed.document, renames);
  const rename = (c: string): string => renames.get(c) ?? c;
  parsed.classNames = new Set([...parsed.classNames].map(rename));
  parsed.bodyClasses = parsed.bodyClasses.map(rename);
  warnings.push({
    code: 'class-renamed',
    severity: 'info',
    message: `${renames.size} class name${renames.size > 1 ? 's were' : ' was'} prefixed with "${prefix}" (option classPrefix); the <style> CSS was updated to match.`,
  });
  const refs = findJsClassReferences(scripts, renames);
  if (refs.length > 0) {
    const names = [...new Set(refs.map((r) => `${r.oldName} → ${r.newName}`))];
    warnings.push({
      code: 'class-renamed',
      severity: 'warning',
      message: `Scripts still reference prefixed classes (${names.join(', ')}). Scripts are not rewritten: update these strings to the new names.`,
      detail: refs.map((r) => `${r.literal}  (${r.oldName} → ${r.newName})`).join('\n'),
    });
  }
  return rewriteCssClasses(cssText, renames);
}

function buildEmptyRoot(): WfElementNode {
  return {
    _id: uuid(),
    type: 'Block',
    tag: 'div',
    classes: [],
    children: [],
    data: {
      tag: 'div',
      text: false,
      displayName: '',
      attr: { id: '' },
      xattr: [],
      search: { exclude: false },
      visibility: { conditions: [] },
    },
  };
}
