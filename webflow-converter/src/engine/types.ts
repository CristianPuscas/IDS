/**
 * Shared contracts for the HTML to Webflow converter.
 *
 * This file is the single source of truth for:
 *  - the Webflow clipboard format (`@webflow/XscpData`), typed from docs/webflow-xscp-spec.md
 *  - the public engine API consumed by the UI (ConvertInput, ConvertOptions, ConvertResult, ConvertWarning)
 *
 * Section references (e.g. "spec 2.4") point to docs/webflow-xscp-spec.md.
 *
 * Ownership: shared. Changing an exported name or shape here affects both src/engine and src/ui,
 * so prefer additive changes (new optional fields, new union members).
 */

/* ------------------------------------------------------------------------------------------------
 * Top level (spec 1)
 * ---------------------------------------------------------------------------------------------- */

/** The literal Webflow checks on paste: `data.type === "@webflow/XscpData"`. */
export const XSCP_TYPE = '@webflow/XscpData' as const;

/** Root object written to the clipboard as `application/json`. */
export interface XscpData {
  type: typeof XSCP_TYPE;
  payload: Payload;
  meta: Meta;
}

/**
 * Clipboard payload. Always emit the full shape (spec 1 recommends never omitting
 * `assets`, `ix1`, `ix2`).
 */
export interface Payload {
  /** Flat list of element and text nodes in pre-order. `nodes[0]` must be the single root. */
  nodes: WfNode[];
  /** Class style blocks referenced by `WfElementNode.classes`. */
  styles: WfStyle[];
  /** Asset records referenced by `data.img.id` or `@img_<id>`. The converter emits `[]`. */
  assets: Asset[];
  /** Legacy interactions. Always `[]`. */
  ix1: unknown[];
  /** Interactions 2.0. Always empty arrays. */
  ix2: Ix2;
}

/** Interactions 2.0 container. Generating interactions is out of scope (spec 5). */
export interface Ix2 {
  interactions: unknown[];
  events: unknown[];
  actionLists: unknown[];
}

/**
 * Counters Webflow fills while copying. A generator emits them all as `0` (spec 1).
 * The first five are always emitted; the rest appear in newer Designer dumps.
 */
export interface Meta {
  unlinkedSymbolCount: number;
  droppedLinks: number;
  dynBindRemovedCount: number;
  dynListBindRemovedCount: number;
  paginationRemovedCount: number;
  universalBindingsRemovedCount?: number;
  codeComponentsRemovedCount?: number;
  richTextComponentsStripped?: number | boolean;
}

/* ------------------------------------------------------------------------------------------------
 * Nodes (spec 2)
 * ---------------------------------------------------------------------------------------------- */

/**
 * Element node types observed in real payloads (spec 2.4). The converter normally emits only:
 * Block, Section, Heading, Paragraph, Link, Image, List, ListItem, Span, Strong, Emphasized,
 * Superscript, Subscript, LineBreak, Blockquote, HtmlEmbed, DOM and the Form* family.
 */
export type WfNodeType =
  | 'Animation'
  | 'BackgroundVideoWrapper'
  | 'Block'
  | 'BlockContainer'
  | 'Blockquote'
  | 'Cell'
  | 'CodeBlock'
  | 'Column'
  | 'Container'
  | 'DOM'
  | 'DropdownLink'
  | 'DropdownList'
  | 'DropdownToggle'
  | 'DropdownWrapper'
  | 'Emphasized'
  | 'Figcaption'
  | 'Figure'
  | 'FormBlockLabel'
  | 'FormButton'
  | 'FormCheckboxInput'
  | 'FormCheckboxWrapper'
  | 'FormErrorMessage'
  | 'FormForm'
  | 'FormInlineLabel'
  | 'FormRadioInput'
  | 'FormRadioWrapper'
  | 'FormSelect'
  | 'FormSuccessMessage'
  | 'FormTextInput'
  | 'FormTextarea'
  | 'FormWrapper'
  | 'Grid'
  | 'HFlex'
  | 'Heading'
  | 'HtmlEmbed'
  | 'Icon'
  | 'Image'
  | 'InlineCode'
  | 'Layout'
  | 'LightboxWrapper'
  | 'LineBreak'
  | 'Link'
  | 'List'
  | 'ListItem'
  | 'MapWidget'
  | 'NavbarBrand'
  | 'NavbarButton'
  | 'NavbarContainer'
  | 'NavbarLink'
  | 'NavbarMenu'
  | 'NavbarWrapper'
  | 'Paragraph'
  | 'RichText'
  | 'Row'
  | 'SearchButton'
  | 'SearchForm'
  | 'SearchInput'
  | 'Section'
  | 'SliderArrow'
  | 'SliderMask'
  | 'SliderNav'
  | 'SliderSlide'
  | 'SliderWrapper'
  | 'Span'
  | 'Strong'
  | 'Subscript'
  | 'Superscript'
  | 'TabsContent'
  | 'TabsLink'
  | 'TabsMenu'
  | 'TabsPane'
  | 'TabsWrapper'
  | 'VFlex';

/**
 * Text node (spec 2.2). Exactly `{_id, text: true, v}`. `v` is decoded plain Unicode,
 * never HTML-escaped. Text nodes have no children and no classes.
 */
export interface WfTextNode {
  _id: string;
  text: true;
  v: string;
}

/** Element node (spec 2.1). */
export interface WfElementNode {
  /** UUID-shaped id, unique within the payload (use `uuid()` from ./ids). */
  _id: string;
  type: WfNodeType;
  /**
   * Rendered tag. Must equal `data.tag` where that exists. For `DOM` nodes this stays `"div"`
   * and the real tag lives in `data.tag` (spec 2.4 DOM).
   */
  tag: string;
  /** Style `_id`s (not class names): `[baseId, combo1Id, combo2Id, ...]` (spec 3.4). */
  classes: string[];
  /** Child node `_id`s in document order. Empty for void elements, embeds and LineBreak. */
  children: string[];
  /** Type-specific data. May be omitted for simple inline types (Strong, Span, ...). */
  data?: WfNodeData;
  /** Node value. Used by HtmlEmbed: same string as `data.embed.meta.html` (spec 2.4 HtmlEmbed). */
  v?: string;
}

/** Any node in `payload.nodes`. */
export type WfNode = WfElementNode | WfTextNode;

/** Type guard: true for `{_id, text: true, v}` text nodes. */
export function isTextNode(node: WfNode): node is WfTextNode {
  return (node as WfTextNode).text === true;
}

/** Name/value pair used by `data.xattr` (custom attributes) and `data.attributes` (DOM nodes). */
export interface WfXattr {
  name: string;
  value: string;
}

/**
 * Built-in attributes (`data.attr`, spec 2.3). `id` is the Settings -> ID field (`""` = none).
 * Image, form and form-field built-ins also live here. Values are strings except a few
 * boolean/number form flags.
 */
export interface WfAttr {
  id?: string;
  // Image (spec 2.4 Image)
  src?: string;
  alt?: string;
  loading?: 'lazy' | 'eager' | 'auto';
  width?: string;
  height?: string;
  // Form fields (spec 2.4 Forms)
  name?: string;
  'data-name'?: string;
  type?: string;
  placeholder?: string;
  value?: string;
  for?: string;
  maxlength?: number;
  required?: boolean;
  disabled?: boolean;
  autofocus?: boolean;
  checked?: boolean;
  multiple?: boolean;
  // FormForm
  method?: string;
  action?: string;
  redirect?: string;
  'data-redirect'?: string;
  'data-wait'?: string;
  /** Some generators set it; Designer dumps keep URLs in `data.link` instead. Prefer `data.link`. */
  href?: string;
  [key: string]: string | number | boolean | undefined;
}

/**
 * Link target (spec 2.4 Link). Converters should emit `{mode: "external", url, target?}`,
 * including for `mailto:` / `tel:` hrefs, and `{mode: "section", domId}` for in-fragment anchors.
 */
export type WfLink =
  | { mode: 'external'; url?: string; target?: string; preload?: string }
  | { mode: 'section'; domId: string }
  | { mode?: undefined; href: string }
  | { mode?: undefined; email: string; subject?: string }
  | { mode?: undefined; tel: string };

/** Image asset reference (`data.img`). Points at `payload.assets[]._id`. */
export interface WfImgRef {
  id: string;
}

/** Code Embed metadata (spec 2.4 HtmlEmbed). */
export interface WfEmbedMeta {
  /** Raw embed source. Must equal the node's `v`. */
  html: string;
  /** Always `false`. */
  div: boolean;
  /** `true` when the code contains `<iframe`. */
  iframe: boolean;
  /** `true` when the code contains `<script`. */
  script: boolean;
  /** Always `false` (CMS binding compilation). */
  compilable: boolean;
}

/** `data.embed` for HtmlEmbed nodes. */
export interface WfEmbed {
  type: 'html';
  meta: WfEmbedMeta;
}

/** `data.list` for List (`{type:"list", unstyled}`) and ListItem (`{type:"item"}`). */
export type WfListData = { type: 'list'; unstyled: boolean } | { type: 'item' };

/** Option of a FormSelect: value `v`, text `t`. */
export interface WfSelectOption {
  v: string;
  t: string;
}

/** `data.form` for Form* nodes (spec 2.4 Forms). */
export interface WfFormData {
  type:
    | 'wrapper'
    | 'form'
    | 'input'
    | 'textarea'
    | 'select'
    | 'label'
    | 'button'
    | 'checkbox'
    | 'checkbox-input'
    | 'checkbox-label'
    | 'radio'
    | 'radio-input'
    | 'radio-label'
    | 'msg-done'
    | 'msg-fail';
  name?: string;
  passwordPage?: boolean;
  wait?: string;
  opts?: WfSelectOption[];
}

/** `data.visibility` (spec 2.3). `[]` = always shown. */
export interface WfVisibility {
  conditions: unknown[];
  keepInHtml?: { tag: string; val: Record<string, unknown> };
}

/** `data.devlink` (spec 2.3). Safe to emit or omit. */
export interface WfDevlink {
  runtimeProps: Record<string, unknown>;
  slot: string;
}

/**
 * Per-element data (spec 2.3, 2.4). Every field is optional because Webflow strips empty
 * values; which fields apply depends on `WfElementNode.type`.
 */
export interface WfNodeData {
  // Common (spec 2.3)
  /** Rendered tag for tag-switchable types (Block, Heading, List, Section, DOM...). */
  tag?: string;
  /** Block: `true` = Text Block. ListItem: `true` when it holds text directly. */
  text?: boolean;
  /** Custom Navigator label; `""` = default. */
  displayName?: string;
  attr?: WfAttr;
  /** Custom attributes (`data-*`, `aria-*`, `role`...). Never put `class` here. */
  xattr?: WfXattr[];
  search?: { exclude: boolean };
  visibility?: WfVisibility;
  devlink?: WfDevlink;

  // Link (spec 2.4 Link)
  /** `true` = Button (`.w-button`). */
  button?: boolean;
  /** `"inline"` = Link Block (element children); `""` = text link or button. */
  block?: '' | 'inline';
  link?: WfLink;

  // Image (spec 2.4 Image)
  img?: WfImgRef;
  srcsetDisabled?: boolean;
  sizes?: unknown[];

  // HtmlEmbed (spec 2.4 HtmlEmbed)
  insideRTE?: boolean;
  embed?: WfEmbed;

  // List / ListItem
  list?: WfListData;

  // Section / Grid. Section uses `{type: "section"}`.
  grid?: { type: string } | string | Record<string, unknown>;

  // Forms
  form?: WfFormData;
  /** FormCheckboxInput / FormRadioInput: `"custom"` for styled inputs. */
  inputType?: string;

  // RichText
  rich?: boolean;

  // DOM (Custom Element). Real tag in `tag`, attributes here (not in `xattr`).
  attributes?: WfXattr[];
  slot?: string;
}

/* ------------------------------------------------------------------------------------------------
 * Styles (spec 3)
 * ---------------------------------------------------------------------------------------------- */

/**
 * Breakpoint ids (spec 3.2). `main` is the base and lives in top-level `styleLess`, never in
 * `variants` on its own. `large`/`xl`/`xxl` add a breakpoint to the whole site on paste, so the
 * converter folds min-width rules into base unless `includeLargeBreakpoints` is set.
 */
export type WfBreakpoint = 'main' | 'medium' | 'small' | 'tiny' | 'large' | 'xl' | 'xxl';

/** Max-width breakpoints with their media query upper bound in px (desktop-first cascade). */
export const WF_MAX_WIDTH_BREAKPOINTS = {
  medium: 991,
  small: 767,
  tiny: 479,
} as const satisfies Record<string, number>;

/** Min-width breakpoints with their media query lower bound in px. */
export const WF_MIN_WIDTH_BREAKPOINTS = {
  large: 1280,
  xl: 1440,
  xxl: 1920,
} as const satisfies Record<string, number>;

/** Webflow class states rendered as `.w--open` / `.w--current` (spec 3.3). */
export type WfWebflowState = 'open' | 'current';

/**
 * Pseudo-state suffixes usable in variant keys (spec 3.3).
 * CSS `:active` maps to `active` (the Designer's "Pressed"), never `pressed`.
 */
export type WfPseudoState =
  | 'hover'
  | 'active'
  | 'focus'
  | 'focus-visible'
  | 'focus-within'
  | 'visited'
  | 'placeholder'
  | 'first-child'
  | 'last-child'
  | 'nth-child(odd)'
  | 'nth-child(even)'
  | 'redirected-checked'
  | 'redirected-focus';

/**
 * Variant key grammar `<breakpoint>[_<webflowState>][_<pseudo>]` (spec 3.3), e.g.
 * `medium`, `small`, `tiny`, `main_hover`, `medium_hover`, `main_current_hover`.
 * A bare `main` is not a variant key.
 */
export type WfVariantKey =
  | Exclude<WfBreakpoint, 'main'>
  | `${WfBreakpoint}_${WfPseudoState}`
  | `${WfBreakpoint}_${WfWebflowState}`
  | `${WfBreakpoint}_${WfWebflowState}_${WfPseudoState}`;

/** One variant's declarations. */
export interface WfStyleVariant {
  /** Declaration list, same format as `WfStyle.styleLess`. */
  styleLess: string;
}

/** Variants keyed by `WfVariantKey`. */
export type WfStyleVariants = Partial<Record<WfVariantKey, WfStyleVariant>>;

/** `""` = base class, `"&"` = combo class. (`"|"` descendant exists internally; never emit it.) */
export type WfComb = '' | '&';

/** Class style block (spec 3.1). */
export interface WfStyle {
  /** UUID-shaped id referenced by `WfElementNode.classes` and other styles' `children`. */
  _id: string;
  /** Always `false`. */
  fake: boolean;
  /** Always `"class"`. Webflow throws on anything other than `class`/`tag`. */
  type: 'class';
  /** Class name as typed in the Designer. Non-empty. Combo styles hold only the modifier name. */
  name: string;
  /** Always `""`. */
  namespace: string;
  comb: WfComb;
  /**
   * Base (`main`) declarations: `prop: value;` pairs separated by a single space, no braces.
   * Longhands only (spec 3.5). `""` for an empty class.
   */
  styleLess: string;
  variants: WfStyleVariants;
  /** `_id`s of combo styles that follow this style on some element (spec 3.4). */
  children: string[];
  /** Optional 24-hex Webflow user id. Unnecessary; omit. */
  createdBy?: string;
  /** Emit `null`. */
  origin?: null;
  /** Always `null`. */
  selector: null;
}

/* ------------------------------------------------------------------------------------------------
 * Assets (spec 2.4 Image)
 * ---------------------------------------------------------------------------------------------- */

/**
 * Asset record as found in Designer dumps. The converter never fabricates these
 * (fake `siteId`/`fileHash` is risky); external images use `data.attr.src` only.
 */
export interface Asset {
  _id: string;
  cdnUrl?: string;
  siteId?: string;
  fileName?: string;
  origFileName?: string;
  fileHash?: string;
  mimeType?: string;
  s3Url?: string;
  width?: number;
  height?: number;
  createdOn?: string;
  variants?: unknown[];
  [key: string]: unknown;
}

/* ------------------------------------------------------------------------------------------------
 * Engine public API (consumed by src/ui)
 * ---------------------------------------------------------------------------------------------- */

/**
 * What the user pasted.
 * - `combined`: one HTML document/fragment that may contain `<style>` and `<script>` tags.
 * - `separate`: three editors. `css` and `js` are merged with any inline `<style>`/`<script>`
 *   found in `html`.
 */
export type ConvertInput =
  | { mode: 'combined'; html: string }
  | { mode: 'separate'; html: string; css: string; js: string };

/** Input mode, as used by the UI tabs. */
export type InputMode = ConvertInput['mode'];

/** Where generated `<style>`/`<script>` HtmlEmbeds go. `root` = appended as children of the root wrapper. */
export type EmbedPlacement = 'root';

/** Tunables for `convert()`. Pass a `Partial` and the engine fills in `DEFAULT_CONVERT_OPTIONS`. */
export interface ConvertOptions {
  /**
   * A `max-width` media query within this many px of a Webflow breakpoint (991/767/479) is
   * mapped onto it; anything farther is snapped (see `breakpointSnap`) or goes to the `<style>`
   * embed. Default 20.
   */
  breakpointTolerancePx: number;
  /** Placement of generated CSS/JS embeds. Default `'root'`. */
  embedPlacement: EmbedPlacement;
  /**
   * When `true`, CSS that has no native representation (descendant/tag/id selectors,
   * pseudo-elements, keyframes, variables, unmatched media...) is kept in a `<style>` HtmlEmbed.
   * When `false` it is dropped with a warning. Default `true`.
   */
  keepUnsupportedInEmbed: boolean;
  /** Max characters per CSS/element HtmlEmbed; larger CSS is split across several embeds. Default 10000 (spec 5). */
  maxEmbedChars: number;
  /**
   * Max characters per `<script>` HtmlEmbed (the Designer rejects Code Embeds over 50,000
   * characters). Larger classic scripts are split between top-level statements; a statement that is
   * still too large (one big IIFE) is minified (see `jsMinifier`), and a script that cannot get under
   * the cap goes to `ConvertResult.externalScripts`, leaving a placeholder comment embed. Default 50000.
   */
  maxScriptEmbedChars: number;
  /**
   * Minify a script that is too large for one embed. The engine first tries `jsMinifier` (e.g.
   * terser, injected by `convertAsync`), then a conservative comment/whitespace stripper. Output is
   * only used when it parses (`new Function` check for classic scripts). Default `true`.
   */
  minifyScripts: boolean;
  /**
   * Synchronous minifier for oversized scripts, or `null` for the built-in stripper only.
   * `convertAsync` loads terser lazily and passes it here. Returns `null` to decline.
   */
  jsMinifier: JsMinifier | null;
  /**
   * Emit `large`/`xl`/`xxl` variants for min-width media queries. Pasting them adds breakpoints
   * to the whole destination site (spec 3.2), so the default is `false` (rules go to the embed).
   */
  includeLargeBreakpoints: boolean;
  /**
   * How button-like elements (`<button>`, `<a class="btn">`, `role="button"`) are converted.
   * - `'button'` (default): the native Webflow Button. Webflow publishes it with `.w-button`
   *   (blue background, 9px 15px padding, white text…), so the button's base class gets longhands
   *   that restore what the source rendered for every `.w-button` property the CSS did not set.
   *   A classless button gets a generated `button` class for them.
   * - `'linkBlock'`: a Link Block (no `.w-button`) whose text sits in a Text Block.
   * - `'customElement'`: a `<button>` stays a real `<button>` (a Custom Element, `DOM` node with
   *   `data.tag: "button"`, every attribute kept and an explicit `type`, default `"button"`). Its
   *   classes stay native; no `.w-button`, no click shim. `<a>` elements convert as in `'button'`.
   *   Not yet paste-tested.
   */
  buttonMode: ButtonMode;
  /**
   * How `<form>` is converted.
   * - `'auto'` (default): native, except forms that custom JavaScript drives. Webflow's webflow.js
   *   takes over the submit of every native form (alerts on empty required fields, POST to Webflow
   *   Forms, hides the form, Turnstile), so a form stays a Code Embed of its original HTML when it
   *   has `novalidate`; or has no `action` and has `data-*` attributes on it or its controls; or the
   *   scripts listen for `submit` (`addEventListener('submit'`, `.onsubmit`, `requestSubmit`); or
   *   the scripts mention its id or its `data-*` attribute names. Its class rules are copied to the
   *   `<style>` embed so it keeps its look.
   * - `'native'`: Webflow Form Block (FormWrapper > FormForm + success and error
   *   messages) with native inputs, textareas, selects, checkboxes, radios, labels and submit
   *   button (spec 2.4 Forms). Unsupported controls (file, hidden, date… inputs) stay as Code
   *   Embeds inside the form, with a warning.
   * - `'embed'`: the whole form is kept as HTML in a Code Embed (no Webflow form handling).
   */
  forms: FormMode;
  /**
   * Layout of embedded canvas/svg/video/iframe elements that use percentage sizes or absolute
   * positioning. `'wrapper'` (default) puts the Code Embed in a classed Div Block
   * (`<class>-embed`) that takes over the element's layout, and makes the element fill it.
   * `'none'` embeds the element as is (it then sizes against Webflow's `.w-embed` div).
   */
  embedSizing: EmbedSizing;
  /**
   * Rename classes to the selector Webflow publishes them under (lowercase, other characters
   * turned into `-`, spec 3.1), and rewrite the `<style>` CSS to match. Scripts are never rewritten;
   * renamed classes they mention are reported. Default `true`.
   */
  normalizeClassNames: boolean;
  /**
   * How `<img>` with an external `src` is converted. Webflow re-hosts the `src` of a native Image on
   * publish (it was rewritten to `cdn.prod.website-files.com/<basename>` and returned 403 in a real
   * paste test), so the default keeps the URL out of Webflow's hands:
   * - `'customElement'` (default): a Custom Element (`DOM` node, `data.tag: "img"`) whose
   *   `data.attributes` carry `src`, `alt`, `loading`, `width`, `height`, `srcset`, `sizes`… verbatim.
   * - `'embed'`: the `<img>` HTML in a Code Embed.
   * - `'image'`: a native Image with `data.attr.src` (the previous behaviour).
   * `data:` URIs and Webflow CDN URLs always become a native Image.
   */
  externalImages: ExternalImageMode;
  /**
   * What to do with a `max-width` media query that is not within `breakpointTolerancePx` of a
   * Webflow breakpoint. `'up'` (default): below 991px it snaps up to the smallest Webflow
   * breakpoint that contains it (850 -> `medium`, 640 -> `small`, 400 -> `tiny`), with a
   * `breakpoint-snapped` note. `'off'`: it stays in the `<style>` embed.
   */
  breakpointSnap: BreakpointSnap;
  /**
   * For full-document input (`<!doctype>`, `<html>` or `<body>`), put a small tag reset at the top
   * of the `<style>` embed (body letter-spacing/size/line-height, heading and paragraph margins,
   * label/img/list/strong defaults) so the destination site's tag styles and webflow.css do not leak
   * into properties the source left to the browser. Properties the source sets on that tag are
   * skipped. Default `true`.
   */
  neutralizeDefaults: boolean;
  /**
   * In `<style>` embed selectors, repeat a lone class that sits at depth d > 1 of a Webflow combo
   * chain d times (`.about_layout` -> `.about_layout.about_layout`), so the embed rule keeps
   * beating the published combo selector as it did in the source. Default `true`.
   */
  embedSpecificityParity: boolean;
  /**
   * Classes used both natively and in `<style>` embed selectors are rewritten in the embed to
   * `[data-h2w-class~="name"]`, and the elements get `data-h2w-class="<their classes>"`, so embed CSS keeps
   * matching when Webflow renames a clashing class to "name 2". Same specificity. Default `true`.
   */
  renameProofEmbedCss: boolean;
  /**
   * Rewrite tag selectors in the `<style>` embed for tags the converter remaps: `b` -> `strong`,
   * `i` -> `em`, and `button` -> `:is(button,a:where([data-h2w-button]))` (same specificity) when a
   * `<button>` became a Webflow Button/Link. Default `true`.
   */
  rewriteRemappedTags: boolean;
  /**
   * Prefix added to every class name used in the HTML (and to generated classes), in the HTML and
   * in the `<style>` CSS, so pasted classes never clash with the destination site's classes.
   * Scripts are not rewritten; string literals that mention a prefixed class are reported.
   * Default `''` (no prefix).
   */
  classPrefix: string;
  /**
   * How `classPrefix` treats Client-First core and utility classes (`padding-global`,
   * `container-large`, `text-size-large`, `heading-style-h2`… see ./clientFirst). `'keep'`: they
   * keep their names, so a Client-First site reuses its own utilities and only custom
   * (`folder_element`) and other classes get the prefix. `'prefix'`: every class is prefixed.
   * Has no effect without a `classPrefix`. Default `'keep'`.
   */
  clientFirstUtilities: ClientFirstUtilities;
  /**
   * Links converted from `<button>` get `data-h2w-button`, and a one-line script at the top of the
   * script embed calls `preventDefault()` on their clicks, so the published `href="#"` does not
   * jump to the top of the page. Default `true`.
   */
  buttonClickShim: boolean;
}

/** `ConvertOptions.externalImages`. */
export type ExternalImageMode = 'customElement' | 'embed' | 'image';

/** `ConvertOptions.breakpointSnap`. */
export type BreakpointSnap = 'up' | 'off';

/** `ConvertOptions.buttonMode`. */
export type ButtonMode = 'button' | 'linkBlock' | 'customElement';

/** `ConvertOptions.forms`. */
export type FormMode = 'auto' | 'native' | 'embed';

/**
 * A synchronous JavaScript minifier (`ConvertOptions.jsMinifier`). Returns the minified code, or
 * `null` to decline. It may throw; the engine then falls back to its stripper.
 */
export type JsMinifier = (code: string, options: { module: boolean }) => string | null;

/** A script too large for a Code Embed, to host as a file (`ConvertResult.externalScripts`). */
export interface ExternalScript {
  /** Suggested file name (`script.js`, `script-2.js`…). */
  name: string;
  /** The script source, as written. */
  code: string;
  /** `type` attribute of the source `<script>` (e.g. `"module"`), or `""`. */
  type: string;
}

/** `ConvertOptions.clientFirstUtilities`. */
export type ClientFirstUtilities = 'keep' | 'prefix';

/** `ConvertOptions.embedSizing`. */
export type EmbedSizing = 'wrapper' | 'none';

/** Defaults applied by `convert()` for any option not passed. */
export const DEFAULT_CONVERT_OPTIONS: Readonly<ConvertOptions> = Object.freeze({
  breakpointTolerancePx: 20,
  embedPlacement: 'root',
  keepUnsupportedInEmbed: true,
  maxEmbedChars: 10000,
  maxScriptEmbedChars: 50000,
  minifyScripts: true,
  jsMinifier: null,
  includeLargeBreakpoints: false,
  buttonMode: 'button',
  forms: 'auto',
  embedSizing: 'wrapper',
  normalizeClassNames: true,
  externalImages: 'customElement',
  breakpointSnap: 'up',
  neutralizeDefaults: true,
  embedSpecificityParity: true,
  renameProofEmbedCss: true,
  rewriteRemappedTags: true,
  classPrefix: '',
  clientFirstUtilities: 'keep',
  buttonClickShim: true,
});

/** Machine-readable warning categories. The UI may group or filter by these. */
export type ConvertWarningCode =
  | 'empty-input'
  | 'parse-error'
  | 'multiple-roots-wrapped'
  | 'unsupported-element'
  | 'unsupported-selector'
  | 'unsupported-pseudo'
  | 'pseudo-element'
  | 'tag-selector'
  | 'id-selector'
  | 'descendant-selector'
  | 'unmatched-media'
  | 'large-breakpoint-folded'
  | 'css-variable'
  | 'at-rule'
  | 'vendor-prefix'
  | 'important-dropped'
  | 'external-image'
  | 'external-script'
  | 'script-extracted'
  | 'embed-split'
  | 'embed-too-large'
  | 'class-renamed'
  | 'class-collision-risk'
  | 'breakpoint-snapped'
  | 'baseline-reset'
  | 'client-first-structure'
  | 'not-implemented'
  | 'other';

/** Severity shown in the UI. `error` = output likely incomplete or will not paste correctly. */
export type ConvertWarningSeverity = 'info' | 'warning' | 'error';

/** A note about something the converter could not map natively or had to change. */
export interface ConvertWarning {
  code: ConvertWarningCode;
  severity: ConvertWarningSeverity;
  /** Human-readable, one sentence. */
  message: string;
  /** Optional offending snippet, selector, tag or media query. */
  detail?: string;
  /** Optional list of the names involved (e.g. the classes of a `class-collision-risk` warning). */
  items?: string[];
}

/** Counters shown in the result panel. */
export interface ConvertStats {
  /** Total entries in `payload.nodes` (element + text nodes). */
  nodes: number;
  /** Total entries in `payload.styles`. */
  styles: number;
  /** Number of HtmlEmbed nodes (CSS, JS, SVG and other code embeds). */
  embeds: number;
  /** CSS rules that could not be mapped natively and were placed in `<style>` embeds. */
  embeddedCssRules: number;
  /** UTF-8 byte length of all JavaScript placed in embeds. */
  jsBytes: number;
}

/** Output of `convert()`. */
export interface ConvertResult {
  data: XscpData;
  /** `JSON.stringify(data)`; starts with `{`, no BOM. This is what goes on the clipboard. */
  json: string;
  warnings: ConvertWarning[];
  stats: ConvertStats;
  /**
   * Scripts too large for a Code Embed even after minifying. Each left a placeholder comment embed;
   * host the file and add `<script src>` in Page Settings → Before `</body>`. Usually empty.
   */
  externalScripts: ExternalScript[];
}
