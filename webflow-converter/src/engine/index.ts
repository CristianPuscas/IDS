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
import { isClientFirstUtility, missingCoreStructure } from './clientFirst';
import { cssClassNames, findJsClassReferences, isWebflowClassName, planClassRenames, renameClassesInDocument, rewriteCssClasses, scriptToggledClasses } from './classNames';
import { attrSelector, isEmptyPlan, planEmbedRewrite, rewriteEmbedSelector } from './embedCss';
import { parseCss } from './cssParser';
import { buildEmbedNode, buildScriptEmbeds, buildStyleEmbeds } from './embedBuilder';
import { parseHtml, type ParsedHtml } from './htmlParser';
import { uuid } from './ids';
import { extractJs } from './jsExtractor';
import { loadTerserMinifier } from './jsMinify';
import { buildNodes } from './nodeBuilder';
import { createStyleRegistry, mapStyles, type MapStylesHooks, type StyleRegistry } from './styleMapper';
import {
  buildOverrideCss,
  conflictingCombos,
  emptyClientFirstUtilities,
  finalizeStyles,
  matchConflicts,
  matchSiteStyles,
  planRenames,
  renameSuffix,
  siteReuseWarnings,
  type SiteMatch,
} from './siteStyles';
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
  type WfStyle,
  type XscpData,
} from './types';

export * from './types';
export { copyToWebflow, isSafari } from './clipboard';
export { validateXscp } from './validate';
export { mergeSiteStyles, parseSiteStyles, siteClassKey } from './siteStyles';

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
  if (!Number.isFinite(out.maxScriptEmbedChars) || out.maxScriptEmbedChars < 100) {
    out.maxScriptEmbedChars = Number.isFinite(out.maxScriptEmbedChars) ? 100 : DEFAULT_CONVERT_OPTIONS.maxScriptEmbedChars;
  }
  if (!['auto', 'native', 'embed'].includes(out.forms)) out.forms = DEFAULT_CONVERT_OPTIONS.forms;
  if (!['button', 'linkBlock', 'customElement'].includes(out.buttonMode)) out.buttonMode = DEFAULT_CONVERT_OPTIONS.buttonMode;
  if (typeof out.jsMinifier !== 'function') out.jsMinifier = null;
  if (out.clientFirstUtilities !== 'keep' && out.clientFirstUtilities !== 'prefix') out.clientFirstUtilities = DEFAULT_CONVERT_OPTIONS.clientFirstUtilities;
  if (!Array.isArray(out.siteStyles)) delete out.siteStyles;
  if (out.siteClassOverrides !== 'embed' && out.siteClassOverrides !== 'drop') out.siteClassOverrides = DEFAULT_CONVERT_OPTIONS.siteClassOverrides;
  if (out.siteClassConflicts !== 'rename' && out.siteClassConflicts !== 'reuse') out.siteClassConflicts = DEFAULT_CONVERT_OPTIONS.siteClassConflicts;
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
      stats: { nodes: 1, styles: 0, embeds: 0, embeddedCssRules: 0, jsBytes: 0, reusedClasses: 0, newClasses: 0 },
      externalScripts: [],
    };
  }
}

/** Results whose scripts needed minifying without an injected minifier (see `convertAsync`). */
const WANTS_MINIFIER = new WeakSet<ConvertResult>();

/**
 * `convert()` with terser available for oversized scripts. Runs `convert()`; when a script was too
 * large for one Code Embed and no `jsMinifier` was given, loads terser (a separate chunk, loaded
 * once) and converts again with it. Falls back to the first result (built-in stripper) when terser
 * cannot be loaded, e.g. from a single-file build opened over `file://`. Never rejects.
 *
 * In a click handler, the extra await only happens for oversized scripts, and is short enough to
 * stay inside the browser's user-activation window for `copyToWebflow()`.
 */
export async function convertAsync(input: ConvertInput, options?: Partial<ConvertOptions>): Promise<ConvertResult> {
  const first = convert(input, options);
  if (!WANTS_MINIFIER.has(first) || options?.minifyScripts === false) return first;
  try {
    const jsMinifier = await loadTerserMinifier();
    return convert(input, { ...options, jsMinifier });
  } catch {
    return first;
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
  const structureHint = clientFirstStructureHint(parsed);
  if (structureHint) warnings.push(structureHint);
  if (opts.classPrefix) {
    const prefix = sanitizePrefix(opts.classPrefix);
    if (prefix) cssText = prefixClassNames(parsed, cssText, scriptsText, prefix, opts.clientFirstUtilities === 'keep', warnings);
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
    scriptText: scriptsText.join('\n'),
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
      scriptClasses: scriptToggledClasses(scriptsText),
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

  // Reuse the destination site's classes (spec 3.6): matched classes become the site's style objects
  // verbatim at the end (finalizeStyles); where the source differs, its values go to the embed.
  const chainStyles = registry.prefixes();
  const importOn = !!(opts.reuseSiteClasses && opts.siteStyles?.length);
  let matches: SiteMatch[] = importOn ? matchSiteStyles(chainStyles, opts.siteStyles!) : [];
  // Same name, different design (layout-critical differences): with 'rename' such a class is not
  // reused but emitted with its own styles under a new name, and so are its combos (their site
  // parent no longer applies) and combos the site has under that name with other styles.
  let renames = new Map<string, string>();
  if (importOn && opts.siteClassConflicts === 'rename') {
    const sourceStyled = styleMap.sourceStyledChains;
    const conflicts = new Map<string, string[]>();
    const dropped = new Set<string>();
    const kept: SiteMatch[] = [];
    for (const m of matches) {
      const parentKey = m.chain.slice(0, -1).join('\u0001');
      const reasons = matchConflicts(m, sourceStyled);
      if (reasons.length > 0) conflicts.set(m.ours._id, reasons);
      if (reasons.length > 0 || (m.chain.length > 1 && dropped.has(parentKey))) dropped.add(m.chain.join('\u0001'));
      else kept.push(m);
    }
    const keptIds = new Set(kept.map((m) => m.ours._id));
    const toRename = new Set(conflicts.keys());
    for (const id of conflictingCombos(chainStyles, opts.siteStyles!, keptIds, sourceStyled)) toRename.add(id);
    renames = planRenames(chainStyles, toRename, opts.siteStyles!, renameSuffix(parsed.document.title ?? ''));
    matches = kept;
    if (renames.size > 0) warnings.push(...renameWarnings(chainStyles, renames, conflicts, scriptsText));
  }
  const reusedIds = new Set(matches.map((m) => m.ours._id));
  let overrideRules = 0;
  if (matches.length > 0) {
    const differing = matches.filter((m) => m.overrides.size > 0);
    const embedAllowed = opts.keepUnsupportedInEmbed;
    const override =
      differing.length > 0 && opts.siteClassOverrides === 'embed' && embedAllowed
        ? buildOverrideCss(differing, opts.maxEmbedChars)
        : { chunks: [], rules: 0, skipped: [] };
    if (override.chunks.length > 0) {
      tagDataWfc(built.nodes, registry, new Set(differing.flatMap((m) => m.chain)));
      // First, so later embed rules of equal specificity (unmatched media…) still win as in the source.
      styleMap.leftoverCss.unshift(...override.chunks);
      overrideRules = override.rules;
    }
    warnings.push(...siteReuseWarnings(matches, { rules: override.rules, skipped: override.skipped, mode: opts.siteClassOverrides, embedAllowed }));
  }
  if (opts.skipClientFirstUtilityStyles) {
    const emptied = emptyClientFirstUtilities(chainStyles, reusedIds);
    if (emptied.length > 0) {
      warnings.push({
        code: 'site-classes',
        severity: 'warning',
        message: `${emptied.length} Client-First utility class${emptied.length === 1 ? ' was' : 'es were'} emitted with empty styles (skipClientFirstUtilityStyles), so a site that has ${emptied.length === 1 ? 'it' : 'them'} applies its own values. Their source CSS was dropped. Not confirmed by a paste test: if Webflow renames ${emptied.length === 1 ? 'it' : 'them'} to "name 2", the element is unstyled.`,
        detail: emptied.join(', '),
      });
    }
  }
  warnings.push(...collisionWarnings(registry, opts, new Set([...reusedIds, ...renames.keys()])));

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
  const scriptEmbeds = buildScriptEmbeds(js, opts.maxScriptEmbedChars, { minify: opts.minifyScripts, minifier: opts.jsMinifier });
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

  const styles = finalizeStyles(
    registry.styles(),
    chainStyles,
    nodes.filter((n): n is WfElementNode => !isTextNode(n)),
    { matches, renames, stableIds: opts.stableClassIds },
  );
  const data = createXscpData(nodes, styles);
  const json = JSON.stringify(data);
  const embedCount = nodes.filter((n) => !isTextNode(n) && n.type === 'HtmlEmbed').length;

  const result: ConvertResult = {
    data,
    json,
    warnings,
    stats: {
      nodes: nodes.length,
      styles: styles.length,
      embeds: embedCount,
      embeddedCssRules: opts.keepUnsupportedInEmbed ? styleMap.leftoverRuleCount + overrideRules : 0,
      jsBytes: js.totalBytes,
      reusedClasses: matches.length,
      newClasses: styles.length - matches.length,
      ...(renames.size > 0 ? { renamedClasses: renames.size } : {}),
    },
    externalScripts: scriptEmbeds.external,
  };
  if (scriptEmbeds.wantsMinifier) WANTS_MINIFIER.add(result);
  return result;
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
 * Other class names that Client-First / Relume sites commonly define (the Client-First core and
 * utility names come from ./clientFirst). Pasting a class whose name exists with different styles
 * makes Webflow rename it to "name 2" (S7); a combo class merges with a same-named class of the
 * site, whose styles then apply too.
 */
const OTHER_COMMON_CLASS = [
  /^(fs-styleguide.*|container)$/,
  /^navbar_/,
  /^[a-z]+\d+_/, // Relume component names: navbar1_component, header5_content…
];

/**
 * The note listing classes renamed so they do not reuse a different site class, plus a warning
 * when a script mentions one of the old names (scripts are not rewritten).
 */
function renameWarnings(chains: readonly { classes: string[]; style: WfStyle }[], renames: ReadonlyMap<string, string>, conflicts: ReadonlyMap<string, string[]>, scripts: readonly string[]): ConvertWarning[] {
  const lines: string[] = [];
  const pairs = new Map<string, string>();
  for (const { classes, style } of chains) {
    const to = renames.get(style._id);
    if (!to) continue;
    const from = classes.join('.');
    const why = conflicts.get(style._id);
    lines.push(`${from} → ${to}${why ? ` (site's version differs in ${why.slice(0, 6).join(', ')}${why.length > 6 ? '…' : ''})` : " (the site has this combo with other styles; Webflow would merge them)"}`);
    pairs.set(style.name, to);
  }
  const n = pairs.size;
  const shown = [...pairs].slice(0, 3).map(([a, b]) => `${a} → ${b}`).join(', ');
  const out: ConvertWarning[] = [
    {
      code: 'site-classes',
      severity: 'warning',
      message: `${n} class${n === 1 ? ' was' : 'es were'} renamed to avoid clashing with different site classes: ${shown}${pairs.size > 3 ? '…' : '.'} Your site has ${n === 1 ? 'this name' : 'these names'} with another design, so reusing ${n === 1 ? 'it' : 'them'} would change the pasted section (choose "Reuse the site's" to reuse them anyway).`,
      detail: lines.join('\n'),
      items: [...new Set(renames.values())],
    },
  ];
  const text = scripts.join('\n');
  const inScripts = [...pairs.keys()].filter((name) => new RegExp(`(^|[^\\w-])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`).test(text));
  if (inScripts.length > 0) {
    out.push({
      code: 'site-classes',
      severity: 'warning',
      message: `A script mentions ${inScripts.length === 1 ? 'a renamed class' : 'renamed classes'} (${inScripts.join(', ')}); scripts are not rewritten, so update ${inScripts.length === 1 ? 'it' : 'them'} to the new name${inScripts.length === 1 ? '' : 's'}.`,
      detail: inScripts.map((c) => `${c} → ${pairs.get(c)}`).join('\n'),
    });
  }
  return out;
}

/**
 * Class clash warnings. Without a prefix: Client-First utilities (expected in a Client-First site),
 * other common names and combos not named `is-*`. With a prefix and `clientFirstUtilities: 'keep'`:
 * an info about the utilities that kept their names. With `'prefix'`: nothing.
 */
function collisionWarnings(registry: StyleRegistry, opts: ConvertOptions, reused: ReadonlySet<string> = new Set()): ConvertWarning[] {
  const utilities: string[] = [];
  const common: string[] = [];
  const combos: string[] = [];
  const isCombos: string[] = [];
  const importOn = !!(opts.siteStyles?.length && opts.reuseSiteClasses);
  const add = (list: string[], name: string) => {
    if (!list.includes(name)) list.push(name);
  };
  // A class whose combo parent is reused may still be new: only skip the reused styles themselves.
  for (const s of registry.styles()) {
    if (reused.has(s._id)) continue;
    if (isClientFirstUtility(s.name)) add(utilities, s.name);
    else if (s.comb === '' && OTHER_COMMON_CLASS.some((re) => re.test(s.name))) add(common, s.name);
    else if (s.comb === '&' && !s.name.startsWith('is-') && !/^inline-style-\d+$/.test(s.name)) add(combos, s.name);
    // Without an import nothing tells us which is-* combos the site has. Webflow merges a pasted
    // combo with a same-named one even under a new parent (hero-construction paste test:
    // .hero_button.is-secondary came out with the site's green is-secondary).
    else if (s.comb === '&' && s.name.startsWith('is-') && !importOn && (s.styleLess.trim() || Object.keys(s.variants).length > 0)) add(isCombos, s.name);
  }

  if (opts.classPrefix) {
    if (opts.clientFirstUtilities !== 'keep' || utilities.length === 0) return [];
    return [
      {
        code: 'class-collision-risk',
        severity: 'info',
        message: `${utilities.length} Client-First utility class${utilities.length > 1 ? 'es' : ''} kept ${utilities.length > 1 ? 'their names' : 'its name'} (clientFirstUtilities: 'keep'), so a Client-First site reuses its own. Where the site's styles differ, Webflow pastes ${utilities.length > 1 ? 'them' : 'it'} as "name 2" (name-2); set clientFirstUtilities to 'prefix' to prefix ${utilities.length > 1 ? 'them' : 'it'} too.`,
        detail: utilities.join(', '),
      },
    ];
  }

  if (utilities.length === 0 && common.length === 0 && combos.length === 0 && isCombos.length === 0) return [];
  const detail: string[] = [];
  if (utilities.length) detail.push(`Client-First utility / core classes: ${utilities.join(', ')}`);
  if (common.length) detail.push(`Other common Client-First / Relume names: ${common.join(', ')}`);
  if (combos.length) detail.push(`Combo classes not named is-*: ${combos.join(', ')}`);
  if (isCombos.length) detail.push(`Styled is-* combo classes: ${isCombos.join(', ')}`);
  const parts: string[] = [];
  if (utilities.length) {
    parts.push(
      'Client-First utility and core classes are expected to exist in a Client-First site: Webflow renames a pasted one to "name 2" (name-2) unless the site already has it with identical styles.',
    );
  }
  if (common.length || combos.length) {
    parts.push('Other names may clash the same way, and a combo class merges with a site class of the same name (its styles apply too).');
  }
  if (isCombos.length) {
    parts.push(
      `Combo class${isCombos.length > 1 ? 'es' : ''} ${isCombos.slice(0, 3).join(', ')}${isCombos.length > 3 ? '…' : ''} may merge with a same-named combo in your site and take its styles, even on a new parent class.`,
    );
  }
  parts.push(
    opts.siteStyles?.length && opts.reuseSiteClasses
      ? "These names are not in your imported site styles: import a copy that contains them (e.g. the style guide page) to reuse the site's classes, or set a classPrefix."
      : "To reuse your site's classes instead, import your site's styles (\"Reuse classes from your Webflow site\": copy an element in the Designer and paste it into the app). Otherwise set a classPrefix (Client-First utilities keep their names by default).",
  );
  return [
    {
      code: 'class-collision-risk',
      severity: 'warning',
      message: parts.join(' '),
      detail: detail.join('\n'),
      items: [...utilities, ...common, ...combos, ...isCombos],
    },
  ];
}

/**
 * Info hint when a page with sections does not follow the Client-First core structure
 * (`section_[name] > padding-global > container-[size]`). Never an error: the page converts the same.
 */
function clientFirstStructureHint(parsed: ParsedHtml): ConvertWarning | null {
  const sections = parsed.document.querySelectorAll('section').length;
  const missing = missingCoreStructure(parsed.classNames, sections);
  if (missing.length === 0) return null;
  return {
    code: 'client-first-structure',
    severity: 'info',
    message: `Not the Client-First core structure: no ${missing.join(' / ')} class found. Client-First pages use page-wrapper > main-wrapper > section_[name] > padding-global > container-[size] > padding-section-[size]. This is only a hint; the page converts the same.`,
    detail: `Missing: ${missing.join(', ')}`,
  };
}

/** Lower-cases a class prefix and replaces other characters with "-"; `""` when unusable. */
function sanitizePrefix(prefix: string): string {
  const p = prefix.trim().toLowerCase().replace(/[^0-9a-z_-]/g, '-');
  return p && isWebflowClassName(`${p}x`) ? p : '';
}

/**
 * Adds `prefix` to every class used in the HTML (not to CSS-only classes, which scripts usually
 * toggle), in the document and in the CSS. With `keepUtilities`, Client-First core and utility
 * classes keep their names (option `clientFirstUtilities: 'keep'`). Scripts are not rewritten;
 * literals that mention a prefixed class are reported.
 */
function prefixClassNames(
  parsed: ParsedHtml,
  cssText: string,
  scripts: string[],
  prefix: string,
  keepUtilities: boolean,
  warnings: ConvertWarning[],
): string {
  const renames = new Map<string, string>();
  for (const c of parsed.classNames) {
    if (c.startsWith('w--') || c.startsWith(prefix) || (keepUtilities && isClientFirstUtility(c))) continue;
    renames.set(c, prefix + c);
  }
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
