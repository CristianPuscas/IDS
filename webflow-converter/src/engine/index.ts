/**
 * Public engine API. The UI imports only from this module (and from ./types, ./clipboard).
 *
 * Pipeline:
 *   parseHtml -> parseCss -> mapStyles -> buildNodes -> extractJs -> embeds -> XscpData
 *
 * Ownership: engine.
 */

import { parseCss } from './cssParser';
import { buildScriptEmbeds, buildStyleEmbeds, buildEmbedNode } from './embedBuilder';
import { parseHtml } from './htmlParser';
import { extractJs } from './jsExtractor';
import { buildNodes } from './nodeBuilder';
import { mapStyles } from './styleMapper';
import {
  DEFAULT_CONVERT_OPTIONS,
  XSCP_TYPE,
  type ConvertInput,
  type ConvertOptions,
  type ConvertResult,
  type ConvertWarning,
  type WfElementNode,
  type XscpData,
} from './types';

export * from './types';
export { copyToWebflow, isSafari } from './clipboard';
export { validateXscp } from './validate';

/** Merges user options over `DEFAULT_CONVERT_OPTIONS`. */
export function resolveOptions(options: Partial<ConvertOptions> = {}): ConvertOptions {
  return { ...DEFAULT_CONVERT_OPTIONS, ...options };
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
  const opts = resolveOptions(options);
  const warnings: ConvertWarning[] = [];
  const editorCss = input.mode === 'separate' ? input.css : '';
  const editorJs = input.mode === 'separate' ? input.js : '';

  if (!input.html.trim() && !editorCss.trim() && !editorJs.trim()) {
    warnings.push({ code: 'empty-input', severity: 'error', message: 'Nothing to convert: the input is empty.' });
  }

  const html = parseHtml(input.html);
  warnings.push(...html.warnings);

  const css = parseCss([...html.styles, editorCss].filter((s) => s.trim()).join('\n'));
  warnings.push(...css.warnings);

  const styleMap = mapStyles(css, opts);
  warnings.push(...styleMap.warnings);

  const built = buildNodes(html.roots, styleMap.registry, opts);
  warnings.push(...built.warnings);

  const js = extractJs(html.scripts, editorJs);
  warnings.push(...js.warnings);

  // Embeds go last under the root, so `nodes` stays in pre-order (embedPlacement: 'root').
  const embeds: WfElementNode[] = [];
  if (html.headLinks.length > 0) embeds.push(buildEmbedNode(html.headLinks.join('\n')));
  if (opts.keepUnsupportedInEmbed) embeds.push(...buildStyleEmbeds(styleMap.leftoverCss, opts.maxEmbedChars));
  embeds.push(...buildScriptEmbeds(js, opts.maxEmbedChars));
  for (const e of embeds) built.root.children.push(e._id);

  const nodes = [...built.nodes, ...embeds];
  const styles = styleMap.registry.styles();
  const data = createXscpData(nodes, styles);
  const json = JSON.stringify(data);

  const embedCount = nodes.filter((n) => 'type' in n && n.type === 'HtmlEmbed').length;
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
