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
 * | form (option `forms: 'native'`)                           | FormWrapper > FormForm + messages (see ./forms) |
 * | img (external URL, option `externalImages`)               | `DOM` Custom Element `<img>` (default), HtmlEmbed, or `Image` |
 * | img (`data:` URI or Webflow CDN URL)                      | `Image` (`data.attr.src`, no asset record) |
 * | ul/ol, li                                                 | `List`, `ListItem`                        |
 * | span, strong/b, em/i, sup, sub, br, blockquote            | `Span`, `Strong`, `Emphasized`, `Superscript`, `Subscript`, `LineBreak`, `Blockquote` |
 * | canvas, video, audio, svg, iframe, table…                 | `HtmlEmbed` with the element's outerHTML (in a sizing Block when needed, see ./embedSizing) |
 * | any other element (small, code, pre, label, dl, time…)    | `DOM` (Custom Element, real tag in `data.tag`) |
 *
 * Attributes: `id` -> `data.attr.id`; everything else that is not a built-in of the node type
 * (`data-*`, `aria-*`, `role`, …) -> `data.xattr` (`data.attributes` on DOM nodes).
 * `style="…"` becomes a generated class (`inline-style-N`) so it stays editable in the Designer.
 *
 * Buttons (option `buttonMode`): native Buttons get `.w-button` neutralizers on their base class
 * (see ./buttonDefaults); `'linkBlock'` emits a Link Block with a Text Block instead. When buttons
 * that share a base class need different values (an `<a class="button">` and a
 * `<button class="button">`), the shared values go on the base class and the rest on a generated
 * `is-button-ua` combo of the buttons that differ. A `<button>` that became a link gets
 * `data-wf-button` (options `buttonClickShim`, `rewriteRemappedTags`).
 *
 * Ownership: engine.
 */

import { buttonTargets, naturalButtonValue, sameValue, type ButtonTarget } from './buttonDefaults';
import { parseDeclarations, type CssStyleRule } from './cssParser';
import type { NativeDecl } from './cssValues';
import { buildEmbedNode } from './embedBuilder';
import { planEmbedSizing, SIZED_EMBED_TAGS } from './embedSizing';
import { buildForm, buildFormControl, FORM_CONTROL_TAGS, type FormBuilderApi } from './forms';
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
  /** Generated style rules (embed sizing wrappers) to map together with the source CSS. */
  extraRules: CssStyleRule[];
  /** Source tags that were pasted as another tag and appear in the output (`b`, `i`, `button`). */
  remappedTags: Set<string>;
  /** Number of `<button>` elements that became links carrying `data-wf-button`. */
  convertedButtons: number;
  warnings: ConvertWarning[];
}

/** Extra inputs for `buildNodes`. */
export interface BuildNodesExtra {
  /** Classes of `<body>`, applied to the root wrapper. */
  rootClasses?: string[];
  /** Every class name in the input (HTML and CSS), so generated names never clash. */
  reservedClassNames?: Set<string>;
  /** Parsed source rules, used to work out what the source rendered (buttons, embed sizing). */
  cssRules?: CssStyleRule[];
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
  rules: CssStyleRule[];
  /** True while converting the inside of a native form. */
  inForm: boolean;
  /** Buttons with their own base class; their `.w-button` neutralizers are applied at the end. */
  buttonDefaults: PendingButton[];
  pendingByElement: Map<Element, PendingButton>;
  remappedTags: Set<string>;
  convertedButtons: number;
  /** Class names used by anything that is not a Webflow Button (native or embedded). */
  otherClasses: Set<string>;
  /** Generated classes, keyed by base name + declarations, so identical ones are shared. */
  generated: Map<string, string>;
  extraRules: CssStyleRule[];
}

/** A converted button with its own classes, waiting for `applyButtonDefaults`. */
interface PendingButton {
  base: string;
  targets: ButtonTarget[];
  /** Class names of the element's chain, and the style-id array its node holds (patched in place). */
  names?: string[];
  ids?: string[];
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
    rules: extra.cssRules ?? [],
    inForm: false,
    buttonDefaults: [],
    pendingByElement: new Map(),
    remappedTags: new Set(),
    convertedButtons: 0,
    otherClasses: new Set(),
    generated: new Map(),
    extraRules: [],
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
    root.children.push(...buildElement(ctx, node as Element));
  }

  resolveAnchorLinks(ctx);
  applyButtonDefaults(ctx);

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
    extraRules: ctx.extraRules,
    remappedTags: ctx.remappedTags,
    convertedButtons: ctx.convertedButtons,
    warnings: ctx.warnings,
  };
}

/**
 * Registers the `.w-button` neutralizers of buttons that have their own classes. Per base class, a
 * value every button agrees on goes on the base class; when buttons sharing the base need
 * different values (typically `<a class="button">` next to `<button class="button">`), the base
 * keeps the natural value and each differing button gets a generated `is-button-ua` combo with
 * its own values. A base class that is also used by something other than a Button is left alone:
 * the neutralizers (e.g. `display: inline`) would change that element too.
 */
function applyButtonDefaults(ctx: Ctx): void {
  for (const list of ctx.embeddedClassLists) for (const c of list) ctx.otherClasses.add(c);
  const groups = new Map<string, PendingButton[]>();
  const skipped = new Set<string>();
  for (const b of ctx.buttonDefaults) {
    if (ctx.otherClasses.has(b.base)) {
      if (b.targets.some((t) => t.value !== null && !sameValue(t.value, t.natural))) skipped.add(b.base);
      continue;
    }
    groups.set(b.base, [...(groups.get(b.base) ?? []), b]);
  }

  const baseDecls = new Map<string, NativeDecl[]>();
  const comboDecls = new Map<PendingButton, NativeDecl[]>();
  for (const [base, members] of groups) {
    const props: string[] = [];
    for (const m of members) for (const t of m.targets) if (!props.includes(t.property)) props.push(t.property);
    const onBase: NativeDecl[] = [];
    for (const prop of props) {
      const natural = naturalButtonValue(prop);
      // What each member wants; `null` = its own CSS sets it (compatible with anything).
      const wants = members.map((m) => {
        const t = m.targets.find((x) => x.property === prop);
        return t ? t.value : natural;
      });
      const live = wants.filter((w): w is string => w !== null);
      if (live.length === 0) continue;
      const uniform = live.every((w) => sameValue(w, live[0]!));
      const baseValue = uniform || !live.some((w) => sameValue(w, natural)) ? live[0]! : natural;
      if (!sameValue(baseValue, natural)) onBase.push({ property: prop, value: baseValue });
      members.forEach((m, i) => {
        const w = wants[i];
        if (w === null || w === undefined || sameValue(w, baseValue)) return;
        comboDecls.set(m, [...(comboDecls.get(m) ?? []), { property: prop, value: w }]);
      });
    }
    if (onBase.length) baseDecls.set(base, onBase);
  }

  // Base defaults first: a combo's defaults must come later to override them at the combo level.
  for (const [base, decls] of baseDecls) ctx.registry.addDefaults(base, decls);
  const combos = new Map<PendingButton, string>();
  for (const [m, decls] of comboDecls) {
    if (!m.names || !m.ids) continue;
    const name = defaultsClass(ctx, 'is-button-ua', decls);
    combos.set(m, name);
    m.ids.splice(0, m.ids.length, ...ctx.registry.resolve([...m.names, name]));
  }

  if (baseDecls.size > 0 || comboDecls.size > 0) {
    const detail = [...baseDecls].map(([b, d]) => `.${b} { ${d.map((x) => `${x.property}: ${x.value};`).join(' ')} }`);
    for (const [m, name] of combos) detail.push(`.${m.base} … .${name} { ${comboDecls.get(m)!.map((x) => `${x.property}: ${x.value};`).join(' ')} }`);
    const classes = [...new Set([...baseDecls.keys(), ...combos.values()])];
    ctx.warnings.push({
      code: 'other',
      severity: 'info',
      message: `Webflow Buttons get .w-button defaults (blue background, padding, white text) and a <button> loses its own font when it becomes a link; ${classes.length === 1 ? 'class' : 'classes'} ${classes.map((b) => `"${b}"`).join(', ')} got declarations that keep the source look.`,
      detail: [...new Set(detail)].join('\n'),
    });
  }
  for (const base of skipped) {
    ctx.warnings.push({
      code: 'other',
      severity: 'warning',
      message: `Class "${base}" is used on a Button and on other elements, so Webflow's .w-button defaults (blue background, padding, white text) were not neutralized on it.`,
      detail: base,
    });
  }
}

/** A class name not used anywhere else, built from `base` (`base`, `base-2`, …). */
function uniqueClassName(ctx: Ctx, base: string): string {
  const prefix = ctx.options.classPrefix;
  if (prefix && !base.startsWith(prefix)) base = prefix + base;
  let name = base;
  for (let i = 2; ctx.reserved.has(name); i++) name = `${base}-${i}`;
  ctx.reserved.add(name);
  return name;
}

/** A generated class holding low-priority declarations; identical requests share one class. */
function defaultsClass(ctx: Ctx, base: string, decls: NativeDecl[]): string {
  const key = `${base}\u0001${JSON.stringify(decls)}`;
  const existing = ctx.generated.get(key);
  if (existing) return existing;
  const name = uniqueClassName(ctx, base);
  ctx.generated.set(key, name);
  ctx.registry.addDefaults(name, decls);
  return name;
}

/** Builds one element (and its subtree). Returns the ids of the nodes that take its place. */
function buildElement(ctx: Ctx, el: Element): string[] {
  const tag = el.tagName.toLowerCase();
  if (SKIP_TAGS.has(tag)) return [];

  if (tag === 'form' && ctx.options.forms === 'native' && !ctx.inForm) {
    ctx.inForm = true;
    try {
      return [buildForm(formApi(ctx), el)];
    } finally {
      ctx.inForm = false;
    }
  }
  if (ctx.inForm && FORM_CONTROL_TAGS.has(tag)) {
    const ids = buildFormControl(formApi(ctx), el);
    if (ids) return ids;
  }

  if ((EMBED_TAGS.has(tag) && !(ctx.inForm && tag === 'fieldset')) || el.namespaceURI === 'http://www.w3.org/2000/svg') {
    return [buildElementEmbed(ctx, el, tag)];
  }

  const id = el.getAttribute('id') ?? '';
  if (tag === 'a' || tag === 'button') return [buildLink(ctx, el, tag, id)];
  if (tag === 'img' && ctx.options.externalImages === 'embed' && !isNativeImageSrc(el.getAttribute('src') ?? '')) {
    noteExternalImage(ctx, el, 'embed');
    return [buildElementEmbed(ctx, el, tag, false)];
  }

  const classes = resolveClasses(ctx, el);

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
    return [emit(ctx, node, el, hasDirectText(el))];
  }

  if (/^h[1-6]$/.test(tag)) {
    const node = element('Heading', tag, classes, { tag, ...commonData(ctx, el, id, []) });
    return [emit(ctx, node, el, true)];
  }

  if (tag === 'p') {
    return [emit(ctx, element('Paragraph', 'p', classes, commonData(ctx, el, id, [])), el, true)];
  }

  if (tag === 'img') return [buildImage(ctx, el, classes, id)];

  if (tag === 'ul' || tag === 'ol') {
    const node = element('List', tag, classes, {
      tag,
      list: { type: 'list', unstyled: false },
      ...commonData(ctx, el, id, []),
    });
    return [emit(ctx, node, el, false)];
  }

  if (tag === 'li') {
    const text = hasDirectText(el);
    const node = element('ListItem', 'li', classes, {
      list: { type: 'item' },
      ...(text ? { text: true } : {}),
      ...commonData(ctx, el, id, []),
    });
    return [emit(ctx, node, el, text)];
  }

  if (tag === 'br') {
    const node: WfElementNode = { _id: uuid(), type: 'LineBreak', tag: 'br', classes, children: [] };
    ctx.nodes.push(node);
    return [node._id];
  }

  if (tag === 'blockquote') {
    return [emit(ctx, element('Blockquote', 'blockquote', classes, commonData(ctx, el, id, [])), el, true)];
  }

  const inline = INLINE_TYPES[tag];
  if (inline) {
    if (inline.tag !== tag) ctx.remappedTags.add(tag);
    // Spec 2.4: these types may omit `data`; only emit it when there is an id or attributes.
    const xattr = collectXattr(ctx, el, []);
    const node: WfElementNode = { _id: uuid(), type: inline.type, tag: inline.tag, classes, children: [] };
    if (id || xattr.length) node.data = { attr: { id }, xattr };
    return [emit(ctx, node, el, true)];
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
  return [emit(ctx, node, el, textLike, tag === 'pre')];
}

/** The node-builder services the form builder uses (see ./forms). */
function formApi(ctx: Ctx): FormBuilderApi {
  return {
    push: (node) => ctx.nodes.push(node),
    buildElement: (el) => buildElement(ctx, el),
    buildChildren: (el, textContext) => buildChildren(ctx, el, textContext, false),
    resolveClasses: (el, extra) => {
      const tag = el.tagName.toLowerCase();
      const submit = tag === 'button' || (tag === 'input' && (el.getAttribute('type') ?? '').toLowerCase() === 'submit');
      return resolveClasses(ctx, el, { generated: extra, button: submit });
    },
    resolveNames: (names) => {
      for (const n of names) ctx.otherClasses.add(n);
      return ctx.registry.resolve(names);
    },
    xattr: (el, reserved) => collectXattr(ctx, el, reserved),
    embed: (el, reason) => {
      ctx.warnings.push({
        code: 'unsupported-element',
        severity: 'warning',
        message: `${reason}; it was kept as a Code Embed inside the native form.`,
        detail: el.outerHTML.slice(0, 160),
      });
      return buildElementEmbed(ctx, el, el.tagName.toLowerCase(), false);
    },
    submitButtonClasses: (el) => buttonClasses(ctx, el),
    defaultsClass: (base, decls) => defaultsClass(ctx, base, decls),
    warn: (message, detail, severity = 'warning') =>
      ctx.warnings.push({ code: 'unsupported-element', severity, message, ...(detail ? { detail } : {}) }),
  };
}

/**
 * Records the `.w-button` neutralizers for a button element. Returns a generated class name to
 * put first in its class list when the element has no class of its own; otherwise the
 * neutralizers go to its existing base class at the end of the build.
 */
function buttonClasses(ctx: Ctx, el: Element): string[] {
  const targets = buttonTargets(el, ctx.rules);
  const own = classNamesOf(el);
  if (own.length > 0) {
    // Recorded even with nothing to add: it still takes part in the base class's agreement.
    const pending: PendingButton = { base: own[0]!, targets };
    ctx.buttonDefaults.push(pending);
    ctx.pendingByElement.set(el, pending);
    return [];
  }
  const decls = targets
    .filter((t): t is ButtonTarget & { value: string } => t.value !== null && !sameValue(t.value, t.natural))
    .map((t) => ({ property: t.property, value: t.value }));
  if (decls.length === 0) return [];
  return [defaultsClass(ctx, 'button', decls)];
}

/**
 * `<a>` / `<button>` -> Link (text link, Link Block or Button; spec 2.4 Link). With
 * `buttonMode: 'linkBlock'` a button-like element becomes a Link Block whose content sits in a
 * Text Block, so it never gets `.w-button`.
 */
function buildLink(ctx: Ctx, el: Element, tag: 'a' | 'button', id: string): string {
  const hasBlockChild = Array.from(el.children).some((c) => {
    const t = c.tagName.toLowerCase();
    return BLOCK_LEVEL.has(t) || t === 'img' || EMBED_TAGS.has(t) || c.namespaceURI === 'http://www.w3.org/2000/svg';
  });
  const classNames = classNamesOf(el);
  const looksLikeButton =
    tag === 'button' ||
    el.getAttribute('role') === 'button' ||
    classNames.some((c) => /^(btn|button)([-_]|$)/i.test(c) || /[-_](btn|button)$/i.test(c));
  const buttonLike = looksLikeButton && !hasBlockChild;
  const asLinkBlock = buttonLike && ctx.options.buttonMode === 'linkBlock';
  const isButton = buttonLike && !asLinkBlock;

  const classes = isButton
    ? resolveClasses(ctx, el, { generated: buttonClasses(ctx, el), button: true })
    : resolveClasses(ctx, el);

  const reserved = tag === 'a' ? ['href', 'target'] : ['type'];
  const extraAttrs: WfXattr[] = [];
  if (tag === 'button' && !el.hasAttribute('role')) extraAttrs.push({ name: 'role', value: 'button' });
  if (tag === 'button') {
    ctx.remappedTags.add('button');
    if ((ctx.options.buttonClickShim || ctx.options.rewriteRemappedTags) && !el.hasAttribute('data-wf-button')) {
      extraAttrs.push({ name: 'data-wf-button', value: '' });
      ctx.convertedButtons++;
    }
  }

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
    block: hasBlockChild || asLinkBlock ? 'inline' : '',
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
      message: `<button> became a Webflow ${asLinkBlock ? 'Link Block' : 'Button'} (an <a>${tag === 'button' ? ' with role="button"' : ''}); ${
        ctx.options.rewriteRemappedTags ? '<style> embed selectors for "button" were rewritten to match it, but JS' : 'CSS or JS'
      } that targets the "button" tag will not match it.`,
      detail: 'button',
    });
  }
  if (asLinkBlock) {
    // Link Blocks hold elements (spec 2.4 Link): the text goes into one classless Text Block.
    ctx.nodes.push(node);
    const block = createBlock('div', []);
    block.data!.text = true;
    ctx.nodes.push(block);
    block.children = buildChildren(ctx, el, true, false);
    node.children = block.children.length ? [block._id] : [];
    if (!block.children.length) ctx.nodes.splice(ctx.nodes.indexOf(block), 1);
    return node._id;
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

/**
 * `src` values Webflow leaves alone on a native Image: `data:` URIs and its own CDN. Any other URL
 * is rewritten on publish to `cdn.prod.website-files.com/<basename>` (query string dropped), which
 * 403s for an image that was never uploaded (seen in a real paste test).
 */
export function isNativeImageSrc(src: string): boolean {
  const s = src.trim();
  return /^data:/i.test(s) || /^(https?:)?\/\/([a-z0-9-]+\.)*(website-files\.com|uploads-ssl\.webflow\.com|uploads\.webflow\.com)\//i.test(s);
}

/**
 * `<img>` (spec 2.4 Image). A `data:` URI or Webflow CDN URL becomes a native Image with
 * `data.attr.src` and no asset record. Other URLs follow `externalImages`: by default a Custom
 * Element (`DOM`, `data.tag: "img"`, the same shape as other Custom Elements) whose
 * `data.attributes` keep `src`, `srcset`, `sizes`, `alt`, `loading`, `width`, `height`… exactly as
 * written, so Webflow never re-hosts the URL.
 */
function buildImage(ctx: Ctx, el: Element, classes: string[], id: string): string {
  const src = el.getAttribute('src') ?? '';
  if (ctx.options.externalImages === 'customElement' && !isNativeImageSrc(src)) {
    noteExternalImage(ctx, el, 'customElement');
    const attributes: WfXattr[] = [];
    if (id) attributes.push({ name: 'id', value: id });
    attributes.push(...collectXattr(ctx, el, []));
    const node: WfElementNode = {
      _id: uuid(),
      type: 'DOM',
      tag: 'div',
      classes,
      children: [],
      data: { tag: 'img', attributes, text: false, slot: '', visibility: { conditions: [] } },
    };
    ctx.nodes.push(node);
    return node._id;
  }
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
  if (!isNativeImageSrc(src)) noteExternalImage(ctx, el, 'image');
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

/** One notice per conversion mode for external images, plus a warning per relative URL. */
function noteExternalImage(ctx: Ctx, el: Element, mode: 'customElement' | 'embed' | 'image'): void {
  const key = `img-${mode}`;
  if (!ctx.notes.has(key)) {
    ctx.notes.add(key);
    const message = {
      customElement:
        'External images became Custom Elements (<img>) with their URL, srcset and sizes kept as written: Webflow rewrites the src of a native Image to its own CDN on publish, which breaks images that were never uploaded. Upload them to Assets and swap in native Images to manage them in Webflow.',
      embed: 'External images were placed in Code Embeds with their original HTML, so Webflow keeps their URL.',
      image:
        'Images keep their original URL in a native Image (hot-linked, no asset record). Webflow may rewrite such URLs to its CDN on publish; upload them to Webflow Assets to host them.',
    }[mode];
    ctx.warnings.push({ code: 'external-image', severity: mode === 'image' ? 'warning' : 'info', message });
  }
  const src = el.getAttribute('src') ?? '';
  if (src && !/^(https?:|data:|\/\/)/i.test(src)) {
    ctx.warnings.push({
      code: 'external-image',
      severity: 'warning',
      message: 'Image has a relative URL that will not resolve inside Webflow.',
      detail: src,
    });
  }
}

/**
 * Elements without a native type -> HtmlEmbed of their outerHTML (keeps id, width, height…). With
 * `embedSizing: 'wrapper'`, a canvas/svg/video/iframe that sizes itself in percentages or is
 * absolutely positioned goes inside a classed Block that carries its layout (./embedSizing).
 *
 * @param count `false` when the caller already reported the element.
 */
function buildElementEmbed(ctx: Ctx, el: Element, tag: string, count = true): string {
  let html = el.outerHTML;
  let wrapper: WfElementNode | null = null;
  if (ctx.options.embedSizing === 'wrapper' && (SIZED_EMBED_TAGS.has(tag) || el.namespaceURI === 'http://www.w3.org/2000/svg')) {
    const base = `${classNamesOf(el)[0] ?? tag}-embed`;
    const offset = ctx.extraRules.length;
    let plan = planEmbedSizing(el, ctx.rules, base, offset);
    if (plan) {
      const signature = `${base}\u0001${JSON.stringify(plan.rules.map((r) => [r.declarations, r.mediaStack]))}`;
      let name = ctx.generated.get(signature);
      if (!name) {
        name = uniqueClassName(ctx, base);
        ctx.generated.set(signature, name);
        if (name !== base) plan = planEmbedSizing(el, ctx.rules, name, offset)!;
        ctx.extraRules.push(...plan.rules);
      }
      html = plan.html;
      ctx.otherClasses.add(name);
      wrapper = createBlock('div', ctx.registry.resolve([name]));
      ctx.nodes.push(wrapper);
      if (!ctx.notes.has('embed-sizing')) {
        ctx.notes.add('embed-sizing');
        ctx.warnings.push({
          code: 'other',
          severity: 'info',
          message: `Embedded elements with percentage or absolute sizing were placed in a Div Block (".${name}"…) that carries their layout, because Webflow wraps every Code Embed in an unsized div.`,
          detail: plan.moved.join(', '),
        });
      }
    }
  }
  const node = buildEmbedNode(html);
  ctx.nodes.push(node);
  if (wrapper) wrapper.children = [node._id];
  if (count) ctx.embeddedTags.set(tag, (ctx.embeddedTags.get(tag) ?? 0) + 1);
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
  return wrapper ? wrapper._id : node._id;
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
      ids.push(...buildElement(ctx, kid as Element));
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

/** The element's own class names, minus Webflow state classes. */
function classNamesOf(el: Element): string[] {
  return (el.getAttribute('class') ?? '').split(/\s+/).filter((c) => c && !WEBFLOW_STATE_CLASSES.has(c));
}

/**
 * Class list -> style ids. Also turns `style="…"` into a generated class appended to the chain,
 * because Webflow has no per-element inline styles on paste (spec 2.3 `data.style` is not
 * generated).
 *
 * @param opts.generated Generated class names placed first (e.g. a classless button's `button`).
 * @param opts.button The element is a Webflow Button (its classes may get `.w-button` neutralizers).
 */
function resolveClasses(ctx: Ctx, el: Element, opts: { generated?: string[]; button?: boolean } = {}): string[] {
  const names = [...(opts.generated ?? []), ...classNamesOf(el)];
  const style = el.getAttribute('style');
  if (style && style.trim()) {
    const decls = parseDeclarations(style);
    if (decls.length) {
      let name: string;
      do {
        ctx.inlineCounter++;
        name = `${ctx.options.classPrefix}inline-style-${ctx.inlineCounter}`;
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
  if (!opts.button) for (const n of names) ctx.otherClasses.add(n);
  const ids = ctx.registry.resolve(names);
  const pending = opts.button ? ctx.pendingByElement.get(el) : undefined;
  if (pending) {
    pending.names = names.filter((n, i) => n && names.indexOf(n) === i);
    pending.ids = ids;
  }
  return ids;
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
