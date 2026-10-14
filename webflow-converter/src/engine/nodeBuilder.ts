/**
 * Node building. Walks the parsed DOM in pre-order and emits Webflow nodes following the tag
 * mapping in spec checklist 7.2 (div -> Block, h1-h6 -> Heading, p -> Paragraph, a -> Link,
 * img -> Image, ul/ol -> List, span -> Span, svg -> HtmlEmbed, unknown -> DOM, forms -> Form*...).
 *
 * Always emits a single root `Block` first (spec 1), so several top-level elements are wrapped.
 *
 * Ownership: engine.
 */

import { uuid } from './ids';
import { buildEmbedNode } from './embedBuilder';
import type { StyleRegistry } from './styleMapper';
import type { ConvertOptions, ConvertWarning, WfElementNode, WfNode } from './types';

/** Result of `buildNodes`. */
export interface NodeBuildResult {
  /** The root wrapper node (also `nodes[0]`). Embeds are appended to its `children`. */
  root: WfElementNode;
  /** All nodes in pre-order, root first. */
  nodes: WfNode[];
  warnings: ConvertWarning[];
}

/**
 * Converts DOM nodes into a flat pre-order list of Webflow nodes under one root wrapper.
 *
 * @param roots Top-level DOM nodes from `parseHtml`.
 * @param registry Resolves each element's `class` list to style ids.
 * @param options Fully-resolved convert options.
 */
export function buildNodes(roots: Node[], registry: StyleRegistry, options: ConvertOptions): NodeBuildResult {
  void options;
  const root = createBlock('div', registry.resolve([]));
  const nodes: WfNode[] = [root];
  const warnings: ConvertWarning[] = [];

  // Stub: every top-level element becomes a raw HtmlEmbed until the real tree walk lands.
  for (const node of roots) {
    const html = node.nodeType === 1 ? (node as Element).outerHTML : (node.textContent ?? '');
    const embed = buildEmbedNode(html);
    root.children.push(embed._id);
    nodes.push(embed);
  }
  if (roots.length > 0) {
    warnings.push({
      code: 'not-implemented',
      severity: 'warning',
      message: 'Native element conversion is not implemented yet; HTML was placed in Code Embeds.',
    });
  }
  return { root, nodes, warnings };
}

/** Creates an empty Div Block (or semantic container) node with the common `data` fields. */
export function createBlock(tag: string, classes: string[]): WfElementNode {
  return {
    _id: uuid(),
    type: 'Block',
    tag,
    classes,
    children: [],
    data: {
      tag,
      text: false,
      displayName: '',
      attr: { id: '' },
      xattr: [],
      search: { exclude: false },
      visibility: { conditions: [] },
    },
  };
}
