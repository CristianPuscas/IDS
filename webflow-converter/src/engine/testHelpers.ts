/**
 * Helpers for engine tests (not used by the app).
 */

import { isTextNode, type ConvertOptions, type ConvertResult, type WfElementNode, type WfNode, type WfStyle } from './types';

/**
 * Options that restore the pre-v8 output for tests about other features: combos keep their source
 * names (no `uniqueCombos` suffix) and `:root` variables stay global `var()`s.
 */
export const PRE_V8: Readonly<Partial<ConvertOptions>> = Object.freeze({ uniqueCombos: false, cssVariables: 'global' });

/** Element nodes of the payload. */
export function elements(res: ConvertResult): WfElementNode[] {
  return res.data.payload.nodes.filter((n): n is WfElementNode => !isTextNode(n));
}

/** Node by id (throws if missing). */
export function byId(res: ConvertResult, id: string): WfNode {
  const n = res.data.payload.nodes.find((x) => x._id === id);
  if (!n) throw new Error(`node ${id} not found`);
  return n;
}

/** Children of an element node. */
export function kids(res: ConvertResult, node: WfElementNode): WfNode[] {
  return node.children.map((id) => byId(res, id));
}

/** First element node of the given type (and optional tag). */
export function first(res: ConvertResult, type: string, tag?: string): WfElementNode {
  const n = elements(res).find((e) => e.type === type && (tag === undefined || e.tag === tag || e.data?.tag === tag));
  if (!n) throw new Error(`no ${type}${tag ? ` <${tag}>` : ''} node`);
  return n;
}

/** Concatenated text of a node subtree. */
export function textOf(res: ConvertResult, node: WfNode): string {
  if (isTextNode(node)) return node.v;
  return kids(res, node).map((k) => textOf(res, k)).join('');
}

/** Style by name (and comb). */
export function style(res: ConvertResult, name: string, comb: '' | '&' = ''): WfStyle {
  const s = res.data.payload.styles.find((x) => x.name === name && x.comb === comb);
  if (!s) throw new Error(`style ${name} (${comb || 'base'}) not found`);
  return s;
}

/** Class names of an element (resolved through styles). */
export function classNames(res: ConvertResult, node: WfElementNode): string[] {
  return node.classes.map((id) => res.data.payload.styles.find((s) => s._id === id)!.name);
}

/** All HtmlEmbed sources, in payload order. */
export function embedCodes(res: ConvertResult): string[] {
  return elements(res)
    .filter((e) => e.type === 'HtmlEmbed')
    .map((e) => e.v ?? '');
}

/** The concatenated `<style>` embed CSS. */
export function embeddedCss(res: ConvertResult): string {
  return embedCodes(res)
    .filter((c) => c.startsWith('<style>'))
    .join('\n');
}
