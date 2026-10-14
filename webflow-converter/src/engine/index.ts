/**
 * Public engine API. The UI imports only from this module (and from ./types, ./clipboard).
 *
 * Pipeline:
 *   parseHtml -> parseCss -> buildNodes (registers class chains) -> mapStyles (fills styles,
 *   collects leftover CSS) -> extractJs -> embeds -> XscpData
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

import { cssClassNames, findJsClassReferences, planClassRenames, renameClassesInDocument, rewriteCssClasses } from './classNames';
import { parseCss } from './cssParser';
import { buildEmbedNode, buildScriptEmbeds, buildStyleEmbeds } from './embedBuilder';
import { parseHtml, type ParsedHtml } from './htmlParser';
import { uuid } from './ids';
import { extractJs } from './jsExtractor';
import { buildNodes } from './nodeBuilder';
import { createStyleRegistry, mapStyles } from './styleMapper';
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

function convertUnsafe(input: ConvertInput, opts: ConvertOptions): ConvertResult {
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
  if (opts.normalizeClassNames) {
    cssText = normalizeClassNames(parsed, cssText, [...parsed.scripts.map((s) => s.code), editorJs], warnings);
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

  const styleMap = mapStyles({ ...css, rules: [...css.rules, ...built.extraRules] }, registry, built.usage, opts);
  warnings.push(...styleMap.warnings);

  const js = extractJs(parsed.scripts, editorJs);
  warnings.push(...js.warnings);

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
