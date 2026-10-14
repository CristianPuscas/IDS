/**
 * Node building. Walks the parsed DOM in pre-order and emits Webflow nodes (spec 2, checklist 7.2):
 *
 * | HTML                                                      | Webflow node                              |
 * |-----------------------------------------------------------|-------------------------------------------|
 * | div, header, footer, nav, main, article, aside, figure, address | `Block` + `data.tag` (`text:true` when it holds text) |
 * | section                                                   | `Section` (`data.grid = {type:"section"}`) |
 * | h1–h6                                                     | `Heading`                                 |
 * | p                                                         | `Paragraph`                               |
 * | a                                                         | `Link`: text link, Link Block (`block:"inline"`) or Button (`button:true`) |
 * | button                                                    | `Link` with `button:true` + `role="button"` (Link Block if it holds elements) |
 * | img                                                       | `Image` (external `src`, no asset record)  |
 * | ul/ol, li                                                 | `List`, `ListItem`                        |
 * | span, strong/b, em/i, sup, sub, br, blockquote            | `Span`, `Strong`, `Emphasized`, `Superscript`, `Subscript`, `LineBreak`, `Blockquote` |
 * | canvas, video, audio, svg, iframe, form controls, table…  | `HtmlEmbed` with the element's outerHTML  |
 * | any other element (small, code, pre, label, dl, time…)    | `DOM` (Custom Element, real tag in `data.tag`) |
 *
 * Attributes: `id` -> `data.attr.id`; everything else that is not a built-in of the node type
 * (`data-*`, `aria-*`, `role`, …) -> `data.xattr` (`data.attributes` on DOM nodes).
 * `style="…"` becomes a generated class (`inline-style-N`) so it stays editable in the Designer.
 *
 * Ownership: engine.
 */

import { parseDeclarations } from './cssParser';
import { buildEmbedNode } from './embedBuilder';
import { uuid } from './ids';
import type { ClassUsage, StyleRegistry } from './styleMapper';
import { isTextNode, type ConvertOptions, type ConvertWarning, type WfElementNode, type WfLink, type WfNode, type WfNodeData, type WfXattr } from './types';

/** Result of `buildNodes`. */
export interface NodeBuildResult {
  /** The root wrapper node (also `nodes[0]`). Embeds are appended to its `children`. */
  root: WfElementNode;
  /** All nodes in pre-order, root first. */
  nodes: WfNode[];
  /** Ids of the converted top-level nodes (children of `root`). */
  topLevel: string[];
  usage: ClassUsage;
  warnings: ConvertWarning[];
}

/** Extra inputs for `buildNodes`. */
export interface BuildNodesExtra {
  /** Classes of `<body>`, applied to the root wrapper. */
  rootClasses?: string[];
  /** Every class name in the input (HTML and CSS), so generated names never clash. */
  reservedClassNames?: Set<string>;
}

/** Tags that become a Block with a matching `data.tag` (spec 2.4 Block). */
const BLOCK_TAGS = new Set(['div', 'header', 'footer', 'nav', 'main', 'article', 'aside', 'figure', 'address']);

/** Tags kept verbatim in an HtmlEmbed: no native type, or native type too risky (forms, spec 2.4). */
const EMBED_TAGS = new Set([
  'canvas', 'video', 'audio', 'svg', 'math', 'iframe', 'object', 'embed', 'picture', 'form', 'input', 'textarea',
  'select', 'option', 'optgroup', 'fieldset', 'table', 'dialog', 'template', 'noscript', 'progress', 'meter', 'map',
  'datalist', 'output', 'slot',
]);

/** Elements that are dropped entirely (metadata). */
const SKIP_TAGS = new Set(['script', 'style', 'link', 'meta', 'title', 'base', 'head']);

/** Block-level tags, used for whitespace handling and Link Block detection. */
const BLOCK_LEVEL = new Set([
  'div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'section', 'header', 'footer', 'nav', 'main',
  'article', 'aside', 'figure', 'figcaption', 'blockquote', 'table', 'form', 'pre', 'hr', 'address', 'details',
  'summary', 'dl', 'dt', 'dd', 'fieldset', 'hgroup', 'dialog', 'body', 'canvas', 'video', 'iframe', 'svg', 'picture',
]);

/** Simple inline formatting tags with a native type and no tag-specific data. */
const INLINE_TYPES: Record<string, { type: WfElementNode['type']; tag: string }> = {
  span: { type: 'Span', tag: 'span' },
  strong: { type: 'Strong', tag: 'strong' },
  b: { type: 'Strong', tag: 'strong' },
  em: { type: 'Emphasized', tag: 'em' },
  i: { type: 'Emphasized', tag: 'em' },
  sup: { type: 'Superscript', tag: 'sup' },
  sub: { type: 'Subscript', tag: 'sub' },
};

/** Attribute names Webflow can hold as custom attributes. */
const VALID_ATTR_NAME = /^[a-zA-Z_][\w.:-]*$/;

/** Webflow-managed state classes that must not be put on elements. */
const WEBFLOW_STATE_CLASSES = new Set(['w--current', 'w--open']);

interface Ctx {
  registry: StyleRegistry;
  options: ConvertOptions;
  nodes: WfNode[];
  warnings: ConvertWarning[];
  embeddedClassLists: string[][];
  reserved: Set<string>;
  inlineCounter: number;
  /** Aggregated per-tag notices, emitted once at the end. */
  embeddedTags: Map<string, number>;
  domTags: Map<string, number>;
  notes: Set<string>;
  /** Links whose href is `#id`, resolved to section links once every node exists. */
  anchorLinks: { node: WfElementNode; fragment: string }[];
}

/**
 * Converts DOM nodes into a flat pre-order list of Webflow nodes under one root wrapper Block.
 *
 * @param roots Top-level DOM nodes from `parseHtml`.
 * @param registry Resolves each element's `class` list to style ids (and records chains).
 * @param options Fully-resolved convert options.
 * @param extra Root classes and reserved class names.
 */
export function buildNodes(
  roots: Node[],
  registry: StyleRegistry,
  options: ConvertOptions,
  extra: BuildNodesExtra = {},
): NodeBuildResult {
  const ctx: Ctx = {
    registry,
    options,
    nodes: [],
    warnings: [],
    embeddedClassLists: [],
    reserved: extra.reservedClassNames ?? new Set(),
    inlineCounter: 0,
    embeddedTags: new Map(),
    domTags: new Map(),
    notes: new Set(),
    anchorLinks: [],
  };

  const root = createBlock('div', registry.resolve(extra.rootClasses ?? []));
  ctx.nodes.push(root);

  const significant = roots.filter((n) => n.nodeType === 1 || (n.nodeType === 3 && (n.textContent ?? '').trim()));
  for (const node of significant) {
    if (node.nodeType === 3) {
      // Loose top-level text goes into its own Text Block.
      const block = createBlock('div', []);
      block.data!.text = true;
      ctx.nodes.push(block);
      const t = textNode(collapse(node.textContent ?? '').trim());
      ctx.nodes.push(t);
      block.children.push(t._id);
      root.children.push(block._id);
      continue;
    }
    const id = buildElement(ctx, node as Element);
    if (id) root.children.push(id);
  }

  resolveAnchorLinks(ctx);

  for (const [tag, n] of ctx.embeddedTags) {
    ctx.warnings.push({
      code: 'unsupported-element',
      severity: 'info',
      message: `<${tag}> has no native Webflow element; ${n === 1 ? 'it was' : `${n} were`} placed in a Code Embed.`,
      detail: tag,
    });
  }
  for (const [tag, n] of ctx.domTags) {
    ctx.warnings.push({
      code: 'unsupported-element',
      severity: 'info',
      message: `<${tag}> was converted to a Custom Element (DOM node)${n > 1 ? ` (${n}×)` : ''}.`,
      detail: tag,
    });
  }

  return {
    root,
    nodes: ctx.nodes,
    topLevel: [...root.children],
    usage: { embeddedClassLists: ctx.embeddedClassLists },
    warnings: ctx.warnings,
  };
}

/** Builds one element (and its subtree). Returns the node id, or null if it was skipped. */
function buildElement(ctx: Ctx, el: Element): string | null {
  const tag = el.tagName.toLowerCase();
  if (SKIP_TAGS.has(tag)) return null;

  if (EMBED_TAGS.has(tag) || el.namespaceURI === 'http://www.w3.org/2000/svg') {
    return buildElementEmbed(ctx, el, tag);
  }

  const classes = resolveClasses(ctx, el);
  const id = el.getAttribute('id') ?? '';

  if (BLOCK_TAGS.has(tag) || tag === 'section') {
    const isSection = tag === 'section';
    const node: WfElementNode = {
      _id: uuid(),
      type: isSection ? 'Section' : 'Block',
      tag,
      classes,
      children: [],
      data: {
        tag,
        ...(isSection ? { grid: { type: 'section' } } : { text: hasDirectText(el) }),
        ...commonData(ctx, el, id, []),
      },
    };
    return emit(ctx, node, el, hasDirectText(el));
  }

  if (/^h[1-6]$/.test(tag)) {
    const node = element('Heading', tag, classes, { tag, ...commonData(ctx, el, id, []) });
    return emit(ctx, node, el, true);
  }

  if (tag === 'p') {
    return emit(ctx, element('Paragraph', 'p', classes, commonData(ctx, el, id, [])), el, true);
  }

  if (tag === 'a' || tag === 'button') return buildLink(ctx, el, tag, classes, id);

  if (tag === 'img') return buildImage(ctx, el, classes, id);

  if (tag === 'ul' || tag === 'ol') {
    const node = element('List', tag, classes, {
      tag,
      list: { type: 'list', unstyled: false },
      ...commonData(ctx, el, id, []),
    });
    return emit(ctx, node, el, false);
  }

  if (tag === 'li') {
    const text = hasDirectText(el);
    const node = element('ListItem', 'li', classes, {
      list: { type: 'item' },
      ...(text ? { text: true } : {}),
      ...commonData(ctx, el, id, []),
    });
    return emit(ctx, node, el, text);
  }

  if (tag === 'br') {
    const node: WfElementNode = { _id: uuid(), type: 'LineBreak', tag: 'br', classes, children: [] };
    ctx.nodes.push(node);
    return node._id;
  }

  if (tag === 'blockquote') {
    return emit(ctx, element('Blockquote', 'blockquote', classes, commonData(ctx, el, id, [])), el, true);
  }

  const inline = INLINE_TYPES[tag];
  if (inline) {
    // Spec 2.4: these types may omit `data`; only emit it when there is an id or attributes.
    const xattr = collectXattr(ctx, el, []);
    const node: WfElementNode = { _id: uuid(), type: inline.type, tag: inline.tag, classes, children: [] };
    if (id || xattr.length) node.data = { attr: { id }, xattr };
    return emit(ctx, node, el, true);
  }

  // Anything else: Webflow Custom Element (DOM node). Real tag in data.tag, attributes in
  // data.attributes (spec 2.4 DOM).
  ctx.domTags.set(tag, (ctx.domTags.get(tag) ?? 0) + 1);
  const attributes: WfXattr[] = [];
  if (id) attributes.push({ name: 'id', value: id });
  attributes.push(...collectXattr(ctx, el, []));
  const textLike = !BLOCK_LEVEL.has(tag) || hasDirectText(el);
  const node: WfElementNode = {
    _id: uuid(),
    type: 'DOM',
    tag: 'div',
    classes,
    children: [],
    data: { tag, attributes, text: false, slot: '', visibility: { conditions: [] } },
  };
  return emit(ctx, node, el, textLike, tag === 'pre');
}

/** `<a>` / `<button>` -> Link (text link, Link Block or Button; spec 2.4 Link). */
function buildLink(ctx: Ctx, el: Element, tag: 'a' | 'button', classes: string[], id: string): string {
  const hasBlockChild = Array.from(el.children).some((c) => {
    const t = c.tagName.toLowerCase();
    return BLOCK_LEVEL.has(t) || t === 'img' || EMBED_TAGS.has(t) || c.namespaceURI === 'http://www.w3.org/2000/svg';
  });
  const classNames = (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
  const looksLikeButton =
    tag === 'button' ||
    el.getAttribute('role') === 'button' ||
    classNames.some((c) => /^(btn|button)([-_]|$)/i.test(c) || /[-_](btn|button)$/i.test(c));
  const isButton = looksLikeButton && !hasBlockChild;

  const reserved = tag === 'a' ? ['href', 'target'] : ['type'];
  const extraAttrs: WfXattr[] = [];
  if (tag === 'button' && !el.hasAttribute('role')) extraAttrs.push({ name: 'role', value: 'button' });

  const link: WfLink = { mode: 'external' };
  if (tag === 'a') {
    const href = el.getAttribute('href');
    if (href !== null && href.trim() !== '') {
      // `#id` anchors become section links later if the target is in the fragment (resolveAnchorLinks).
      link.url = /^\s*javascript:/i.test(href) ? '#' : href.trim();
    }
    const target = el.getAttribute('target');
    if (target) link.target = target;
  }

  const node = element('Link', 'a', classes, {
    button: isButton,
    block: hasBlockChild ? 'inline' : '',
    link,
    ...commonData(ctx, el, id, reserved, extraAttrs),
  });
  if (tag === 'a') {
    const fragment = /^#(.+)$/.exec((el.getAttribute('href') ?? '').trim());
    if (fragment) ctx.anchorLinks.push({ node, fragment: fragment[1]! });
  }
  if (tag === 'button' && !ctx.notes.has('button')) {
    ctx.notes.add('button');
    ctx.warnings.push({
      code: 'unsupported-element',
      severity: 'info',
      message: '<button> became a Webflow Button/Link (an <a> with role="button"); CSS or JS that targets the "button" tag will not match it.',
      detail: 'button',
    });
  }
  return emit(ctx, node, el, !hasBlockChild);
}

/**
 * `href="#id"` pointing at an element inside the pasted tree -> `{mode:"section", domId:<node _id>}`,
 * the in-page anchor shape of real Designer dumps (spec 2.4 Link). Anchors whose target is not in
 * the fragment (or sits inside a Code Embed) stay plain `#id` URLs, since Webflow resets section
 * links that point outside the pasted fragment (spec 2.4, S7).
 */
function resolveAnchorLinks(ctx: Ctx): void {
  const byHtmlId = new Map<string, string>();
  for (const n of ctx.nodes) {
    if (isTextNode(n)) continue;
    const htmlId = n.data?.attr?.id;
    if (htmlId && !byHtmlId.has(htmlId)) byHtmlId.set(htmlId, n._id);
  }
  for (const { node, fragment } of ctx.anchorLinks) {
    let target = fragment;
    try {
      target = decodeURIComponent(fragment);
    } catch {
      // Keep the raw fragment.
    }
    const domId = byHtmlId.get(target);
    if (domId && node.data) node.data.link = { mode: 'section', domId };
  }
}

/** `<img>` -> Image with an external `src` and no asset record (spec 2.4 Image). */
function buildImage(ctx: Ctx, el: Element, classes: string[], id: string): string {
  const src = el.getAttribute('src') ?? '';
  const loadingAttr = (el.getAttribute('loading') ?? '').toLowerCase();
  const loading = loadingAttr === 'eager' || loadingAttr === 'auto' ? loadingAttr : 'lazy';
  const node: WfElementNode = {
    _id: uuid(),
    type: 'Image',
    tag: 'img',
    classes,
    children: [],
    data: {
      srcsetDisabled: false,
      sizes: [],
      ...commonData(ctx, el, id, ['src', 'alt', 'loading', 'width', 'height', 'srcset', 'sizes']),
    },
  };
  node.data!.attr = {
    src,
    alt: el.getAttribute('alt') ?? '',
    loading,
    width: el.getAttribute('width') ?? 'auto',
    height: el.getAttribute('height') ?? 'auto',
    id,
  };
  if (!ctx.notes.has('img')) {
    ctx.notes.add('img');
    ctx.warnings.push({
      code: 'external-image',
      severity: 'info',
      message: 'Images keep their original URL (hot-linked); upload them to Webflow Assets to host them.',
    });
  }
  if (src && !/^(https?:|data:|\/\/)/i.test(src)) {
    ctx.warnings.push({
      code: 'external-image',
      severity: 'warning',
      message: 'Image has a relative URL that will not resolve inside Webflow.',
      detail: src,
    });
  }
  if (el.hasAttribute('srcset') && !ctx.notes.has('srcset')) {
    ctx.notes.add('srcset');
    ctx.warnings.push({
      code: 'external-image',
      severity: 'info',
      message: 'srcset/sizes were dropped: Webflow generates responsive variants only for uploaded assets.',
    });
  }
  ctx.nodes.push(node);
  return node._id;
}

/** Elements without a native type -> HtmlEmbed of their outerHTML (keeps id, width, height…). */
function buildElementEmbed(ctx: Ctx, el: Element, tag: string): string {
  const html = el.outerHTML;
  const node = buildEmbedNode(html);
  ctx.nodes.push(node);
  ctx.embeddedTags.set(tag, (ctx.embeddedTags.get(tag) ?? 0) + 1);
  // Record class usage inside the embed: CSS targeting these classes must stay in the <style> embed.
  for (const e of [el, ...Array.from(el.querySelectorAll('[class]'))]) {
    const list = (e.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
    if (list.length) ctx.embeddedClassLists.push(list);
  }
  if (html.length > ctx.options.maxEmbedChars) {
    ctx.warnings.push({
      code: 'embed-too-large',
      severity: 'warning',
      message: `<${tag}> is ${html.length} characters, over the ${ctx.options.maxEmbedChars}-character Code Embed limit; it cannot be split.`,
      detail: tag,
    });
  }
  return node._id;
}

/** Pushes `node`, then builds its children (pre-order). */
function emit(ctx: Ctx, node: WfElementNode, el: Element, textContext: boolean, preserveWs = false): string {
  ctx.nodes.push(node);
  node.children = buildChildren(ctx, el, textContext, preserveWs);
  return node._id;
}

/**
 * Builds child nodes with HTML-like whitespace handling: runs of whitespace collapse to one space;
 * whitespace-only text is dropped in containers and kept between inline siblings in text contexts;
 * text is trimmed next to block boundaries. `<pre>` keeps its whitespace.
 */
function buildChildren(ctx: Ctx, el: Element, textContext: boolean, preserveWs: boolean): string[] {
  const ids: string[] = [];
  const kids = Array.from(el.childNodes).filter((n) => n.nodeType === 1 || n.nodeType === 3);
  const parentBlock = BLOCK_LEVEL.has(el.tagName.toLowerCase());
  kids.forEach((kid, idx) => {
    if (kid.nodeType === 1) {
      const id = buildElement(ctx, kid as Element);
      if (id) ids.push(id);
      return;
    }
    const raw = kid.textContent ?? '';
    if (preserveWs) {
      if (raw) pushText(ctx, ids, raw);
      return;
    }
    let t = collapse(raw);
    const prev = kids[idx - 1];
    const next = kids[idx + 1];
    if (t.trim() === '') {
      if (!textContext || !prev || !next || isBlockNode(prev) || isBlockNode(next)) return;
      pushText(ctx, ids, ' ');
      return;
    }
    if ((!prev && parentBlock) || (prev && isBlockNode(prev))) t = t.trimStart();
    if ((!next && parentBlock) || (next && isBlockNode(next))) t = t.trimEnd();
    if (t) pushText(ctx, ids, t);
  });
  return ids;
}

function pushText(ctx: Ctx, ids: string[], v: string): void {
  const t = textNode(v);
  ctx.nodes.push(t);
  ids.push(t._id);
}

function isBlockNode(n: Node): boolean {
  return n.nodeType === 1 && BLOCK_LEVEL.has((n as Element).tagName.toLowerCase());
}

function collapse(s: string): string {
  return s.replace(/[ \t\n\r\f]+/g, ' ');
}

/** True when the element has a non-whitespace text node as a direct child. */
function hasDirectText(el: Element): boolean {
  return Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? '').trim() !== '');
}

/**
 * Class list -> style ids. Also turns `style="…"` into a generated class appended to the chain,
 * because Webflow has no per-element inline styles on paste (spec 2.3 `data.style` is not
 * generated).
 */
function resolveClasses(ctx: Ctx, el: Element): string[] {
  const names = (el.getAttribute('class') ?? '').split(/\s+/).filter((c) => c && !WEBFLOW_STATE_CLASSES.has(c));
  const style = el.getAttribute('style');
  if (style && style.trim()) {
    const decls = parseDeclarations(style);
    if (decls.length) {
      let name: string;
      do {
        ctx.inlineCounter++;
        name = `inline-style-${ctx.inlineCounter}`;
      } while (ctx.reserved.has(name));
      ctx.reserved.add(name);
      ctx.registry.addInlineStyle(name, decls);
      names.push(name);
      if (!ctx.notes.has('inline-style')) {
        ctx.notes.add('inline-style');
        ctx.warnings.push({
          code: 'other',
          severity: 'info',
          message: 'Inline style="…" attributes were turned into generated classes (inline-style-N).',
        });
      }
    }
  }
  return ctx.registry.resolve(names);
}

/** Common `data` fields (spec 2.3). */
function commonData(
  ctx: Ctx,
  el: Element,
  id: string,
  reserved: string[],
  extraXattr: WfXattr[] = [],
): Pick<WfNodeData, 'displayName' | 'attr' | 'xattr' | 'search' | 'visibility'> {
  return {
    displayName: '',
    attr: { id },
    xattr: [...collectXattr(ctx, el, reserved), ...extraXattr],
    search: { exclude: false },
    visibility: { conditions: [] },
  };
}

/** Custom attributes (`data-*`, `aria-*`, `role`, …) in source order, minus built-ins. */
function collectXattr(ctx: Ctx, el: Element, reserved: string[]): WfXattr[] {
  const out: WfXattr[] = [];
  for (const a of Array.from(el.attributes)) {
    const name = a.name;
    if (name === 'id' || name === 'class' || name === 'style' || reserved.includes(name)) continue;
    if (!VALID_ATTR_NAME.test(name)) {
      ctx.warnings.push({
        code: 'other',
        severity: 'warning',
        message: `Attribute "${name}" is not a valid Webflow custom attribute name and was dropped.`,
        detail: `<${el.tagName.toLowerCase()} ${name}="${a.value}">`,
      });
      continue;
    }
    out.push({ name, value: a.value });
  }
  return out;
}

function element(type: WfElementNode['type'], tag: string, classes: string[], data: WfNodeData): WfElementNode {
  return { _id: uuid(), type, tag, classes, children: [], data };
}

function textNode(v: string): WfNode {
  return { _id: uuid(), text: true, v };
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
