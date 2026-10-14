# Webflow Designer clipboard format (`@webflow/XscpData`): technical spec

Research date: 2026-10-14. Purpose: building an "HTML to Webflow" converter that writes a payload the Webflow Designer accepts on Cmd/Ctrl+V.

Webflow does not document this format and can change it at any time. Every claim below is labelled:

- **VERIFIED [Sx]**: confirmed by a primary or strong source (Webflow's own code or docs, or real Designer clipboard dumps), cited by ID.
- **UNCERTAIN**: inferred, single-source, third-party claim, or contradicted. The text says why.

"Real dumps" means the 450 `@webflow/XscpData` blobs I collected from public repos (S3) and analysed with a script. That corpus holds 8,348 element nodes, 3,644 text nodes and 5,390 styles. Most of it is Designer-produced. Where a claim rests only on generated (non-Designer) payloads, the text says so.

---

## 0. Sources

| ID | Source | What it is |
|---|---|---|
| S1 | `rchipka/webflow-export` → `webflow-designer.js` (https://github.com/rchipka/webflow-export) | An archived copy of Webflow's own Designer JS bundle, committed Dec 2018. It contains `getXscpData`, `prepareXscpData`, `parseVariantKey`, the style-block builder and the paste error strings. This is primary evidence, but it is old. |
| S2 | Webstudio's Webflow paste importer: `packages/project-build/src/runtime/webflow/{schema.ts,styles.ts,instances-properties.ts}` and `apps/builder/app/shared/copy-paste/plugin-webflow/{plugin-webflow.ts,plugin-webflow.test.tsx}` (https://github.com/webstudio-is/webstudio) | A production zod schema and test fixtures for every common Webflow element. They were captured from Webflow. |
| S3 | Real clipboard dumps: `darknoon/layer-formats/webflow/webflow.json` (MIT); `systemflowco/scripts/sf13/*.json` (a production component library); `faithchurchdev/json/page1`; `FelixTown/FelixTown.github.io/*.json`; `finsweet/hacks/src/webflow-hacks/*/*.json`; `ben-alrdy/alrdy-animate/webflow-recipes/osmo-button-032/copy.html` | Payloads copied out of the Designer. |
| S4 | `karenrebecag/Webflow-Converter`: `docs/webflow-paste-behavior.md`, `src/emit/xscp.ts`, `src/emit/schema.ts` (https://github.com/karenrebecag/Webflow-Converter) | A converter whose author measured paste behaviour on a real site (2026-10-09). |
| S5 | `bejamas/webflow-clipboard`, `src/copy-payload.ts` (https://github.com/bejamas/webflow-clipboard) | An npm library for "Copy to Webflow". |
| S6 | `systemflowco/scripts/sf/library.js` and `sf/paste.js` | Production copy and paste code for a Webflow component library. |
| S7 | Webflow Help, "Copy and paste between sites" (https://help.webflow.com/hc/en-us/articles/33961319728403) | Official docs. |
| S8 | Webflow Designer API, Styles overview (https://developers.webflow.com/designer/reference/styles-overview) | Official breakpoint IDs and pseudo-state names. These are for the Designer API, not the clipboard. |
| S9 | Webflow Updates, "Increased custom code character limit" (https://webflow.com/updates/increased-custom-code-character-limit) and Help, "Custom code embed" (https://help.webflow.com/hc/en-us/articles/33961332238611) | Official. |
| S10 | Alex Harri, "The web's clipboard…" (https://alexharri.com/blog/clipboard) | Browser clipboard behaviour. |
| S11 | WebKit, "Clipboard API Improvements" (https://webkit.org/blog/8170/clipboard-api-improvements/) and W3C public-webapps-github 2022-02/0690 | Safari's same-origin rule for custom MIME types. |
| S12 | Webflow Help, "Custom CSS properties and values" (https://help.webflow.com/hc/en-us/articles/33961265610259) | Official. |
| S13 | `febi-git/html-to-webflow` (https://github.com/febi-git/html-to-webflow) | A Claude Code skill built around Timothy Ricks' moden.club converter. Documents its CSS rules and output. |
| S14 | `karenrebecag/Code-to-Webflow` (skill) and `karenrebecag/atom-uikit-ds` (`docs/decisions/012-webflow-xscp-export.md`, `scripts/webflow/generate-xscp.mjs`, `public/r/webflow/*.json`) | A generator plus an ADR that was corrected against a real dump. |
| S15 | Ycode's Webflow importer, `lib/import/adapters/webflow/{xscp-types.ts,styles.ts}` (https://github.com/ycode/ycode) | A second production parser. |
| S16 | Webstudio docs, "Copy-paste / Webflow" (https://github.com/webstudio-is/webstudio-community/blob/main/docs/university/foundations/copy-paste/webflow.md) | What the clipboard does and does not contain. |
| S17 | `humanagencyorg/webflow-xscp_bindings` (Ruby) | A generator with commented real form-node examples. |
| S18 | Bubble forum, "Copy To Clipboard As application/json" (https://forum.bubble.io/t/copy-to-clipboard-as-application-json/270983) | A community report. |

---

## 1. Top-level shape

```json
{
  "type": "@webflow/XscpData",
  "payload": {
    "nodes":  [ /* element nodes and text nodes, flat list */ ],
    "styles": [ /* class style blocks */ ],
    "assets": [ /* asset records (images used by nodes/styles) */ ],
    "ix1": [],
    "ix2": { "interactions": [], "events": [], "actionLists": [] }
  },
  "meta": {
    "unlinkedSymbolCount": 0,
    "droppedLinks": 0,
    "dynBindRemovedCount": 0,
    "dynListBindRemovedCount": 0,
    "paginationRemovedCount": 0
  }
}
```

- **VERIFIED [S1]:** On paste, Webflow reads the clipboard's `application/json` entry, `JSON.parse`s it and requires `type === "@webflow/XscpData"`. The literal code is `cc = lookup("application/json"); dc = a => a && "@webflow/XscpData" === a.type; getXscpData = a => cc(a).chain(jsonParse).chain(ec)`. The same bundle's exporter builds `{type:"@webflow/XscpData", payload:{nodes, styles, assets, ix1, ix2}, meta}`.
- **VERIFIED [S3]:** All 450 real blobs have `type` and `payload`, and `payload.nodes` and `payload.styles`. 449 have `assets`, `ix1` and `ix2`. 448 have `meta`.
- **VERIFIED [S3, S1]:** The `meta` keys are `unlinkedSymbolCount`, `droppedLinks`, `dynBindRemovedCount` and `dynListBindRemovedCount`. These four are in the 2018 code. Current Designer output adds `paginationRemovedCount` (447/448). Newer dumps also add `universalBindingsRemovedCount`, `codeComponentsRemovedCount` and `richTextComponentsStripped` (seen both as `false` and as a number). These are counters Webflow fills while copying. S1 shows they feed a log message ("For pasting cross-site we had to …"). A generator should emit them all as `0`.
- **UNCERTAIN:** Whether `meta`, `assets`, `ix1` and `ix2` can be omitted. Webstudio's reader schema [S2] only requires `nodes`, `styles` and `assets`. I found no measured test of Webflow accepting a payload without them. **Recommendation:** always emit the full shape above.
- **VERIFIED [S1] for 2018; UNCERTAIN today:** The nodes must form exactly one tree. S1 throws `"Subtree reification resulted in more than one root!"`. In every real dump, `nodes[0]` is the root and the nodes are in pre-order. S4's validator also requires that the first node is not anyone's child. **Recommendation:** emit a single root wrapper first, then its descendants in pre-order.

---

## 2. Nodes

### 2.1 Common element-node fields

```json
{
  "_id": "uuid-like string",
  "type": "Block",
  "tag": "div",
  "classes": ["<style _id>", "<combo style _id>"],
  "children": ["<node _id>", "..."],
  "data": { /* type-specific; see below */ }
}
```

- **VERIFIED [S1, S3]:** `_id`, `type`, `tag`, `classes` and `children` are on every element node. `classes` holds style `_id`s, not class names. S1's export is `classes: data.styleBlockIds`. In S3, every class reference resolves to `payload.styles[]._id`.
- **VERIFIED [S1]:** The exporter runs `cleanDeep`, which removes empty values, so `data` is often partial or missing. S3 has 7,626 of 8,348 nodes with `data`. The systemflow production dumps paste fine with minimal nodes such as `{"_id","tag":"strong","classes":[],"children":[],"type":"Strong"}` with no `data`.
- **VERIFIED [S3]:** Real `_id`s have UUID shape (8-4-4-4-12 hex), but they are not RFC-4122 v4.
- **VERIFIED [S1]:** Webflow rewrites IDs on paste. S1 has `updatePasteNodes`, `updateXscpStyleBlockIds` and a "cloning" step.
- **UNCERTAIN:** Whether non-UUID IDs (for example `atom-badge-1`) are accepted. S14 later switched to UUID-shaped IDs. **Recommendation:** use random UUID v4 for node and style `_id`s, unique within the payload.
- **VERIFIED [S1]:** Element nodes can also carry a top-level `v` holding the node's value. It is used by `HtmlEmbed` (see 2.4).

### 2.2 Text nodes

```json
{ "_id": "uuid", "text": true, "v": "Literal text" }
```

- **VERIFIED [S1, S2, S3]:** 3,644 text nodes in S3 all have exactly `{_id, text:true, v}`. S1's exporter writes `{_id, text:!0, v:data.value}`.
- **VERIFIED [S3]:** Text nodes are children of Heading, Paragraph, Block (Text Block), Link, Span, ListItem, Strong, Blockquote, NavbarLink, DropdownLink, FormBlockLabel and similar types. Inline formatting is expressed as sibling nodes: a Paragraph's `children` mixes text nodes with `Link`, `Span`, `Strong`, `Emphasized` and `LineBreak` nodes (S2 RichText test; S3).
- **UNCERTAIN:** HTML entity handling. `v` appears to be the decoded literal text. Emit plain Unicode and do not HTML-escape.

### 2.3 Common `data` fields

The fields below appear on most element types in current dumps:

```json
"data": {
  "tag": "div",
  "text": false,
  "displayName": "",
  "attr": { "id": "" },
  "xattr": [ { "name": "data-foo", "value": "bar" } ],
  "search": { "exclude": false },
  "visibility": { "conditions": [] },
  "devlink": { "runtimeProps": {}, "slot": "" }
}
```

| Field | Meaning | Status |
|---|---|---|
| `data.tag` | The rendered HTML tag for types whose tag can change: Block (`div`, `section`, `header`, `footer`, `nav`, `main`, `aside`, `article`, `figure`, `address`, `span`?), Heading (`h1`–`h6`), List (`ul`/`ol`), Section, VFlex/HFlex, Grid, Navbar\*/Dropdown\* parts. It must match the node-level `tag`. | **VERIFIED [S3]**: present on Block 4081/4082, Heading 458/458 and List 125/125. S2 test "Figure" uses `type:"Block", tag:"figure"`. |
| `data.text` | On `Block`: `true` makes it a **Text Block** (a div that holds text children directly); `false` makes it a Div Block. On `ListItem` it is `true` when the item holds text directly. | **VERIFIED [S2 instances-properties: `Block` + `data.text` → Text; S3]** |
| `data.attr` | Built-in attributes. `attr.id` is the element ID (the Settings → ID field); `""` means none. Type-specific built-ins also live here: Image `src`/`alt`/`loading`/`width`/`height`; form fields `name`/`placeholder`/`type`/`required`; FormForm `action`/`method`/`name`/`data-name`/`redirect`. | **VERIFIED [S2 schema; S3]** |
| `data.xattr` | **Custom attributes**, as an ordered array of `{name, value}` with string values. Use it for `data-*`, `aria-*`, `role` and any other non-built-in attribute. | **VERIFIED [S2 schema; S3]**, e.g. `[{"name":"data-button-032","value":""}]`. **UNCERTAIN:** whether `class` in `xattr` is honoured. S15 notes real dumps sometimes carry `{name:"class", value:"…"}`, but never put class names there. Use `classes`. |
| `data.search.exclude` | Site-search exclusion flag. Default `false`. | **VERIFIED [S3]** (field present). Semantics inferred from the name. |
| `data.visibility.conditions` | Conditional visibility. `[]` means always shown. `[false]` means hidden. CMS-dependent conditions appear as `[false, true]`. Newer dumps add `keepInHtml: {tag:"False", val:{}}`. | **VERIFIED [S2 instances-properties comment; S3]** |
| `data.displayName` | Custom Navigator label. `""` means the default label. | **VERIFIED (field) [S3]**; meaning **UNCERTAIN** but strongly implied (S16 mentions Navigator names). |
| `data.devlink` | `{runtimeProps:{}, slot:""}`. Used by DevLink/components export. Safe to emit or omit. | **VERIFIED (field) [S3]**; meaning **UNCERTAIN**. |
| `data.style` | Per-element (classless) styles, shaped `{base:{<breakpoint>:{<pseudo>:{camelCaseProp: value}}}}`, e.g. `{"base":{"small":{"noPseudo":{"order":-9999}}}}`. Used by Quick Stack/Grid cells. | **VERIFIED [S2 schema/test; S3]**. **Recommendation:** do not generate it. Use classes. |
| `data.sym`, `data.macro`, `data.eventIds`, `data.Source` | Symbol, macro, interaction and form-source internals. | **VERIFIED (exist) [S3]**. Do not generate. |

### 2.4 Element types and their `data`

The 61 node types observed in real payloads (list from S4 `schema.ts`; S2's `wfNodeTypes` is a subset; S3 counts in parentheses where present):

`Animation, BackgroundVideoWrapper, Block, Blockquote, DOM, DropdownLink, DropdownList, DropdownToggle, DropdownWrapper, Emphasized, Figcaption, Figure, FormBlockLabel, FormButton, FormCheckboxInput, FormCheckboxWrapper, FormErrorMessage, FormForm, FormInlineLabel, FormRadioInput, FormRadioWrapper, FormSelect, FormSuccessMessage, FormTextInput, FormTextarea, FormWrapper, Grid, Heading, HtmlEmbed, Image, InlineCode, LightboxWrapper, LineBreak, Link, List, ListItem, MapWidget, NavbarBrand, NavbarButton, NavbarLink, NavbarMenu, NavbarWrapper, Paragraph, RichText, SearchButton, SearchForm, SearchInput, Section, SliderArrow, SliderMask, SliderNav, SliderSlide, SliderWrapper, Span, Strong, TabsContent, TabsLink, TabsMenu, TabsPane, TabsWrapper, VFlex`.

S2 additionally lists `Superscript, Subscript, BlockContainer, Container, Layout, Cell, HFlex, Row, Column, CodeBlock, NavbarContainer, Icon`. S3 also contains `Icon`, `HFlex`, `NavbarContainer` and `Dynamo*` (CMS collection list).

The common converter mapping follows.

#### Block (Div Block, Text Block, semantic containers)
```json
{"type":"Block","tag":"div","classes":[…],"children":[…],
 "data":{"tag":"div","text":false,"attr":{"id":""},"xattr":[],"search":{"exclude":false},"visibility":{"conditions":[]},"displayName":""}}
```
- **VERIFIED [S3, S2]:** `<div>`, `<header>`, `<footer>`, `<nav>`, `<main>`, `<aside>`, `<article>`, `<figure>`, `<address>` and similar elements become `Block` with `tag` and `data.tag` set to the HTML tag. A div that directly contains text becomes `Block` with `data.text: true` (a Text Block).
- **UNCERTAIN:** `<span>` as Block. S4 measured that a Block inside a `<p>` renders as a `<div>`, so `span` must use the native **`Span`** type.

#### Section
```json
{"type":"Section","tag":"section","data":{"tag":"section","grid":{"type":"section"}, …}}
```
- **VERIFIED [S3]:** 160 of 160 Section nodes have `data.grid = {"type":"section"}`. A `<section>` emitted as `Block` with tag `section` is also valid [S2 test "Section" uses the type; S14 emits Block], so either works.

#### Container (Webflow "Container" element)
- **UNCERTAIN [S2 only]:** `type: "BlockContainer"` (the new `w-layout-blockcontainer`) or the legacy `type: "Container"` (`w-container`), tag `div`. Neither appears in S3. **Recommendation:** emit a classed `Block` instead, which needs no Webflow preset CSS.

#### VFlex / HFlex / Grid / Layout+Cell (Quick Stack)
- **VERIFIED [S3]:** `VFlex` and `HFlex` take `data.tag:"div"`. `Grid` takes `data.tag` and `data.grid` (legacy value `"two-by-two"`; in newer dumps an object). Layout and Cell are described in S2.
- **Recommendation:** for converters, emit `Block` with `display:flex` or `display:grid` in the class. S4 measured that a Block with `display:grid` behaves the same as the Grid type.

#### Heading
```json
{"type":"Heading","tag":"h2","classes":[…],"children":["<text id>"],
 "data":{"tag":"h2","attr":{"id":""},"xattr":[],"search":{"exclude":false},"visibility":{"conditions":[]},"displayName":""}}
```
- **VERIFIED [S3, S2]:** `tag` and `data.tag` must be one of `h1`–`h6`.

#### Paragraph
```json
{"type":"Paragraph","tag":"p","classes":[…],"children":[…],"data":{"attr":{"id":""},"xattr":[], …}}
```
- **VERIFIED [S3]:** `Paragraph` has no `data.tag`; its tag is always `p`.

#### Link (Text Link, Link Block, Button)
```json
{"type":"Link","tag":"a","classes":[…],"children":[…],
 "data":{"button":false,"block":"","link":{"mode":"external","url":"https://…","target":"_blank"},
         "attr":{"id":""},"xattr":[], …}}
```
- **VERIFIED [S3]:** Analysis of 940 real Link nodes:
  - **Text Link:** `button:false, block:""`, with text children.
  - **Button** (`.w-button`): `button:true, block:""`, with text children.
  - **Link Block:** `button:false, block:"inline"`, with element children (Block, Heading, HtmlEmbed, DOM).
- **VERIFIED [S3, S2]:** `data.link` shapes:
  - `{mode:"external", url}`: the common case.
  - `{mode:"external", url, target:"_blank"}`: opens in a new tab.
  - `{mode:"external"}`: no URL.
  - `{mode:"external", preload:"none"}`.
  - `{mode:"section", domId:"<node _id>"}`: an in-page anchor.
- **VERIFIED [S2 schema]:** other forms the readers accept: `{href}` (page or section links), `{email, subject?}` and `{tel}`.
- **UNCERTAIN:** the exact `mode` values for email and phone links. They are probably `"email"` and `"phone"` but were not seen in dumps. **Recommendation:** convert `mailto:` and `tel:` hrefs to `{mode:"external", url:"mailto:…"}`.
- **VERIFIED [S7]:** Page and section links that point outside the pasted fragment are reset on cross-site paste.
- **VERIFIED [S2 tests; S3]:** Some generators also set `data.attr.href`. Real Designer dumps keep the URL only in `data.link`. Prefer `data.link`.
- `<button>` has no native non-form equivalent. S4 and S14 emit `Link` with `button:true` plus `xattr role=button`. **UNCERTAIN**, but it pastes.

#### Image
```json
{"type":"Image","tag":"img","classes":[…],"children":[],
 "data":{"attr":{"src":"https://…/x.png","alt":"…","loading":"lazy","width":"auto","height":"auto","id":""},
         "img":{"id":"<asset _id>"},"srcsetDisabled":false,"sizes":[], …}}
```
- **VERIFIED [S3, S2]:** `src`, `alt`, `loading` (`lazy`/`eager`/`auto`), `width` and `height` are strings (for example `"auto"` or `"36"`). They live in `data.attr`. `data.img.id` references a `payload.assets[]._id`.
- **VERIFIED [S3]:** Real asset records look like `{_id, cdnUrl, siteId, fileName, origFileName, fileHash, mimeType, s3Url, width, height, createdOn, variants, …}`. S2 lists the full schema.
- **UNCERTAIN:** Pasting an Image with only `data.attr.src` (an external URL, no `img.id`, no asset). S4 and S14 do this and report successful pastes, and the image hot-links. The Designer's asset panel will not know about it. Fabricating asset records (fake `siteId`/`fileHash`) is risky; don't.
- **Observed in our own paste test (2026-10-14):** such an Image pasted fine, but on the *published* page every external `src` was rewritten to `https://cdn.prod.website-files.com/<basename>` (query string dropped), which returned 403. The converter therefore emits external images as a DOM node (`data.tag:"img"`, attributes in `data.attributes`) and keeps native Images for `data:` URIs and Webflow CDN URLs. Whether Webflow keeps `src` on a DOM `img` through publish still needs a paste test.

#### HtmlEmbed (Code Embed)
```json
{"type":"HtmlEmbed","tag":"div","classes":[],"children":[],
 "v":"<svg …>…</svg>",
 "data":{"insideRTE":false,
         "embed":{"type":"html","meta":{"html":"<svg …>…</svg>","div":false,"iframe":false,"script":false,"compilable":false}}}}
```
- **VERIFIED [S3]:** All 111 real embeds have `data.embed.type:"html"` and `meta.{html, div, iframe, script, compilable}`, plus a top-level `v`.
- **VERIFIED [S3]:** `v` is a parsed or normalised copy of the code: in one real dump `v` has `viewbox` lowercased while `meta.html` keeps `viewBox`. **Recommendation:** set both to the same source string.
- **VERIFIED [S3]:** `meta.script` was `true` for the one embed that contained `<script>`. **UNCERTAIN:** `iframe` is presumably `true` when the code contains `<iframe>`; `div` and `compilable` (likely CMS-binding compilation) were always `false`. **Recommendation:** set `script` and `iframe` by sniffing the code, and leave `div` and `compilable` as `false`.

#### List / ListItem
```json
{"type":"List","tag":"ul","data":{"tag":"ul","list":{"type":"list","unstyled":false}}}
{"type":"ListItem","tag":"li","data":{"list":{"type":"item"}}}
```
- **VERIFIED [S3]:**
  - `List` has `data.tag` set to `ul` or `ol` and `data.list: {type:"list", unstyled}`. `unstyled:true` corresponds to Webflow's "None" list style (`w-list-unstyled`).
  - `ListItem` (458 in S3) carries `{list:{type:"item"}}` or `{text:true}`.

#### Span / Strong / Emphasized / Superscript / Subscript / LineBreak / Blockquote
- **VERIFIED [S2 tests, S3]:**
  - `Span` uses tag `span`.
  - `Strong` uses tag `strong`. It is not `Bold`.
  - The italic type is **`Emphasized`** (not "Emphasis") with tag `em`.
  - `Superscript` uses `sup` and `Subscript` uses `sub`.
  - `LineBreak` uses tag `br` and has no children.
  - `Blockquote` uses tag `blockquote`.
  - All of these may omit `data`.
- **UNCERTAIN:** how `<b>`, `<i>` and `<u>` map. Use `Strong` and `Emphasized` for the first two, and a `Span` plus a class for `u`.

#### RichText
- **VERIFIED [S3]:** `{"type":"RichText","tag":"div","data":{"rich":true,"tag":"div"}}`, whose children are Heading, Paragraph, List, Blockquote and Figure nodes. Converters normally don't need this.

#### DOM (Webflow "Custom Element")
```json
{"type":"DOM","tag":"div","classes":[…],"children":[…],
 "data":{"tag":"span","attributes":[{"name":"aria-hidden","value":"true"}],"text":false,"slot":"",
         "visibility":{"conditions":[]}}}
```
- **VERIFIED [S3 (Osmo button dump), S4, S15]:** For DOM nodes the real HTML tag is in **`data.tag`**; the node-level `tag` stays `"div"`. Attributes go in **`data.attributes`** (not `xattr`). This is the escape hatch for any tag without a native type: `svg`, `path`, `table`, `video`, `iframe`, `button`, `label`, `input`, and so on.
- **UNCERTAIN:** S4 emits `input`, `label`, `form`, `iframe` and `table` as DOM, and notes that its native mapping is still pending. A text child inside DOM works [S3: DOM parent of a text node].

#### Forms
- **VERIFIED [S3, S17]:**

| Type | tag | Key `data` |
|---|---|---|
| `FormWrapper` | div | `form:{type:"wrapper"}` |
| `FormForm` | form | `form:{type:"form", name:"Email Form"}`, `attr:{id, name, "data-name", method:"get", action:"", redirect:"", "data-redirect":""}` |
| `FormTextInput` | input | `form:{type:"input", name, passwordPage:false}`, `attr:{type:"email"/"text"/…, name, "data-name", id, placeholder, maxlength:256, required:bool, disabled:bool, autofocus:bool}` |
| `FormTextarea` | textarea | `form:{type:"textarea", name}`, `attr:{name, id, placeholder, maxlength:5000, required, autofocus}` |
| `FormSelect` | select | `form:{type:"select", name, opts:[{v,t}]}`, `attr:{name, id, required, multiple}` |
| `FormBlockLabel` | label | `form:{type:"label"}`, `attr.for?` |
| `FormCheckboxWrapper` / `FormCheckboxInput` / `FormInlineLabel` | label/input/span | `form:{type:"checkbox"}` / `form:{type:"checkbox-input", name}`, `attr:{type:"checkbox", checked}`, `inputType:"custom"` / `form:{type:"checkbox-label"}` |
| `FormRadioWrapper` / `FormRadioInput` | label/input | `form:{type:"radio-input", name}`, `attr:{type:"radio", value}` |
| `FormButton` | input | `form:{type:"button", wait:"Please wait..."}`, `attr:{type:"submit", value:"Submit", "data-wait":"Please wait..."}` |
| `FormSuccessMessage` / `FormErrorMessage` | div | `form:{type:"msg-done"}` / `form:{type:"msg-fail"}` |

- **VERIFIED [S4]:** Native form nodes (FormWrapper, FormTextInput, FormSelect, FormRadio\*) paste completely. Use the full Wrapper → Form + Success + Error structure. S4 reports that a form control emitted as `Block` crashes on paste.
- **VERIFIED [S7]:** A pasted form takes the destination site's notification settings.

#### Navbar, Dropdown, Tabs, Slider, Lightbox, Dynamo (CMS)
- **VERIFIED (types exist) [S3]:** Their `data` holds widget configuration (`navbar`, `dropdown`, `tabs`, `slider`, `lightbox`, `dyn`).
- **Recommendation:** do not generate these from arbitrary HTML. Output plain Blocks and Links. CMS lists paste empty [S7].

---

## 3. Styles

### 3.1 Style object

```json
{
  "_id": "uuid",
  "fake": false,
  "type": "class",
  "name": "hero_title",
  "namespace": "",
  "comb": "",
  "styleLess": "font-size: 3rem; line-height: 1.1;",
  "variants": { "medium": { "styleLess": "font-size: 2.5rem;" } },
  "children": [],
  "createdBy": "58cee682df096f5938172d6c",
  "origin": null,
  "selector": null
}
```

- **VERIFIED [S1]:** Webflow's style-block builder takes `{_id, fake, type, name, namespace, comb, styleLess, variants, children}`. It **throws** if `type` is not `"class"` or `"tag"`, or if `name` is empty or whitespace (`"Invalid style type"` / `"Invalid style name"`).
- **VERIFIED [S3]:**
  - 5,389 of 5,390 real styles have `_id, fake, type, name, namespace, comb, styleLess, variants, children, selector`.
  - `type` is always `"class"`, `fake` is `false`, `namespace` is `""` and `selector` is `null`.
- **VERIFIED [S3]:** `createdBy` (a 24-hex Webflow user id) is present on only 432 of 5,390 styles, and `origin: null` on only 277.
- **UNCERTAIN:** Both are therefore optional in practice. S14's ADR addendum confirms one real dump with no `origin`. S14's earlier claim that "without `createdBy`/`origin` Webflow rejects the paste" is not supported by the corpus. **Recommendation:** emit `origin: null`; `createdBy` is harmless but unnecessary.
- **VERIFIED [S1, S3]:** `name` is the human-readable class name as typed in the Designer. Spaces are allowed: Webflow derives the CSS selector by slugifying, so `box 2` becomes `.box-2` [S4].
- **VERIFIED [S1]:** The slug rule, from the Designer bundle's `toClassName` / `toClassNameNoConflictChecks`: `name.toLowerCase().replace(/[^0-9a-z_-]/g, " ").replace(/^[ _-]+|[ _-]+$/g, "").replace(/\s+/g, "-")`, then `.replace(/(^[\d]|^wf?-)/, "_$1")`. So `heroTitle` → `.herotitle`, `md:flex` → `.md-flex`, `2col` → `._2col` and `w-full` → `._w-full`. The converter renames classes to this form up front (`src/engine/classNames.ts`).
- **VERIFIED [S3]:** `styleLess` is a CSS declaration list: `prop: value;` pairs separated by a single space, with no selector and no braces. An empty class uses `""`.

### 3.2 Breakpoint variants

- **VERIFIED [S1, S2, S8]:** Breakpoint keys:

| Key | Media | Notes |
|---|---|---|
| (base) `main` | none | Stored in top-level `styleLess`, not in `variants` |
| `medium` | `max-width: 991px` | Tablet |
| `small` | `max-width: 767px` | Mobile landscape |
| `tiny` | `max-width: 479px` | Mobile portrait |
| `large` | `min-width: 1280px` | Optional larger breakpoint |
| `xl` | `min-width: 1440px` | |
| `xxl` | `min-width: 1920px` | |

- **VERIFIED [S3]:** Real usage counts are `medium` 1131, `small` 703, `tiny` 636, `xl` 2, `large` 1.
- **VERIFIED [S4, measured]:** Pasting any `large` variant makes the Designer add that breakpoint **to the whole site** ("1 breakpoint added"). **Recommendation:** fold `min-width` rules into base unless the user opts in.
- **VERIFIED [S2]:** Media queries that don't match these exact ranges have no representation. Desktop-first cascade applies: medium inherits from base, small from medium, tiny from small. A converter must map arbitrary `@media` widths to the nearest range or drop them into an embed `<style>`.

### 3.3 State variants

- **VERIFIED [S1]:** Variant key grammar is `<breakpoint>[_<webflowState>][_<pseudo>]`. S1's `parseVariantKey`:
  ```js
  b = key.split("_");
  { mediaQuery: b.shift(),
    webflowState: (b.length && STATES_ORDER.indexOf(b[0]) >= 0) ? b.shift() : null,
    pseudoState: b.length ? b.shift() : null }
  ```
  `webflowState` ∈ `open`, `current`. These are Webflow class states rendered as `.w--open` and `.w--current`.
- **VERIFIED [S1 (2018 list), S3 (current dumps)]:** Pseudo-states in the 2018 list are `hover`, `active`, `focus`, `visited` and `placeholder`.
- **VERIFIED [S3]:** Real current keys, with counts:

| Key | Count |
|---|---|
| `main_hover` | 452 |
| `main_active` | 344 |
| `main_focus` | 286 |
| `medium_open` | 55 |
| `main_open` | 50 |
| `main_current` | 45 |
| `main_placeholder` | 9 |
| `tiny_open` | 8 |
| `main_redirected-focus` | 3 |
| `main_redirected-checked` | 3 |
| `main_current_hover` | 1 |

- **VERIFIED [S2 test fixture]:** Breakpoint plus state combos: `tiny_hover`, `tiny_focus`, `tiny_active`, `tiny_focus-visible` and `tiny_visited`. So `medium_hover` and similar keys are valid.
- **VERIFIED [S1, S3]:** The Designer's **"Pressed" state is `active` in the clipboard** (`main_active`), **not** `main_pressed`. `main_pressed` appears in no dump and no GitHub code. The Designer *API* [S8] calls it `pressed`, which is a different surface. Ycode [S15] accepts both defensively.
- **Mapping to emit:**

| CSS | Variant key | Status |
|---|---|---|
| `:hover` | `main_hover` | VERIFIED |
| `:active` | `main_active` | VERIFIED |
| `:focus` | `main_focus` | VERIFIED |
| `:focus-visible` | `main_focus-visible` | VERIFIED [S2] |
| `:visited` | `main_visited` | VERIFIED [S2, S1] |
| `::placeholder` | `main_placeholder` | VERIFIED [S3]. Webstudio maps it to `::placeholder` [S2] |
| `.w--current` | `main_current` | VERIFIED (Webflow-specific) |
| `.w--open` | `main_open` | VERIFIED (Webflow-specific) |
| `:focus-within` | `main_focus-within` | UNCERTAIN: the name comes from S8's list, not from a dump |
| `:first-child`, `:last-child`, `:nth-child(odd)`, `:nth-child(even)` | `main_first-child`, `main_last-child`, `main_nth-child(odd)`, `main_nth-child(even)` | UNCERTAIN: names from S8 (Collection-item states); never seen in a dump |
| `:checked` on custom checkbox or radio | `main_redirected-checked`, `main_redirected-focus` | VERIFIED [S3] (Webflow custom-input specific) |

- Any other pseudo-class (`:not`, `:has`, `:disabled`, `:nth-child(3)`, …) has no key. Send it to an embed `<style>` block.

### 3.4 Combo classes and `classes` order

- **VERIFIED [S1]:** Combinator constants are `COMBINATORS = { NONE: "", DESCENDANT: "|", COMBO: "&" }`.
- **VERIFIED [S3]:**
  - A **base class** has `comb: ""`.
  - A **combo class** has `comb: "&"`, and its `name` is only the modifier name (for example `is-secondary`, not `button is-secondary`).
  - The node lists them in order: `classes: [baseId, combo1Id, combo2Id, …]`.
  - **Combo chain via `children`:** every style lists, in its `children`, the `_id`s of the combo styles that follow it on some element. Checked across all real Designer dumps, for every adjacent pair `(classes[i], classes[i+1])`, `classes[i+1] ∈ styles[classes[i]].children` (3,648 of 3,648 pairs). The only violations were in a generator's non-Designer output (atom-uikit-ds, 36 pairs). Example from a real dump:
    - `button` (comb `""`) has `children: [is-secondary, …]`.
    - `is-secondary` (comb `"&"`) has `children: [is-small]`.
    - The node has `classes: [button, is-secondary, is-small]`.
  - Combo styles hold **only the delta** declarations; the browser applies `.button.is-secondary`.
- **UNCERTAIN:**
  - Whether Webflow tolerates a payload that omits `children`, or two `comb:""` classes on one node. S14's generator does both and reports successful pastes; S2's reader doesn't need them. **Recommendation:** replicate the Designer: one base class, the rest as `&` combos, and fill `children`.
  - Whether the same combo name under two different bases needs two separate style objects. Inferred: **yes**, because Webflow scopes a combo to its parent chain. Give each its own `_id`.
- **VERIFIED [S1]:** `comb: "|"` means a descendant selector (used for tag or nested selectors). Not seen in clipboard dumps. **UNCERTAIN:** do not emit.

### 3.5 Values and special tokens in `styleLess`

- **VERIFIED [S3]:** Designer output is **longhand only**: `padding-top`/`-right`/`-bottom`/`-left`, `margin-*`, `border-top-left-radius`, …, `border-*-width`/`-style`/`-color`, `grid-column-gap` and `grid-row-gap` (instead of `gap`), and `transition-property`/`-duration`/`-timing-function`. The only shorthands in real dumps were `overflow`, plus `border-radius` and `grid-area` wrapped in `@raw` (below). Colours come out as `#hex`, `hsla(…)` or `rgba(…)`. `font-family` is a plain stack string.
- **UNCERTAIN:** Whether shorthands such as `padding: 1rem 2rem` or `gap: 1rem` are accepted and expanded on paste. Generators S14 and S4 emit some shorthands and report successful pastes, but the Style panel may show them as custom properties. **Recommendation:** expand to longhands like the Designer.
- **VERIFIED [S4]:** The Designer writes explicit grid tracks such as `1fr 1fr` (S3: `1fr` ×260, `1fr 1fr` ×48, …). S4 measured that `repeat(2, minmax(0, 1fr))` rendered narrow columns. **Recommendation:** expand `repeat()` and `minmax(0, Nfr)`.
- **VERIFIED [S3, S2]:** `@raw<|…|>` holds a raw value the Designer can't model natively. Real Osmo dump: `display: @raw<|inline-grid|>; color: @raw<|var(--button-032-color)|>; grid-area: @raw<|1 / 1|>; clip-path: @raw<|inset(0% 0% -15% 0%)|>; z-index: @raw<|1|>`. Webstudio strips it with `/@raw<\|([^@]+)\|>/g → "$1"`.
  - **UNCERTAIN:** the exact rules for when Webflow requires `@raw`. **Recommendation:** use it for `var(--…)` values and for keyword values the panel lacks.
- **VERIFIED [S1, S2, S15, S3]:** `@img_<assetId>` is a background-image reference to `payload.assets[]._id` (real: `background-image: @img_6214dbe5aab84d7f641f3aec`). S1 defines `B = "@img_"`.
  - For a converter without assets, use `background-image: url("https://…")`. **UNCERTAIN** whether Webflow keeps it.
- **VERIFIED [S2 fixture; S4 measured]:** `@var_<variable-id>` references a Webflow Variable (seen as `@var_relume-variable-color-neutral-1`). S4 measured that an `@var_` pointing to a variable that does not exist pastes without error but leaves a **dangling reference**, and no variable is created. **Do not emit `@var_`.**
- **VERIFIED [S7]:** Variables used in the source site arrive as plain values, not as variables.
- **VERIFIED [S12]:** Webflow supports "custom properties", meaning arbitrary CSS properties without native Style panel controls. Exceptions: properties with **vendor prefixes** (e.g. `-webkit-…`) and properties with **limited browser support** are not supported.
  - **UNCERTAIN** how those map onto `styleLess` on paste. S4 saw `aspect-ratio` saved without problems; S4 keeps a configurable "unsafe props" list because others reported style-panel crashes with it.
- `!important`: **UNCERTAIN.** Webflow added `!important` to Custom properties (Webflow updates page "important custom properties"), but there is no clipboard evidence.

---

## 4. Putting it on the clipboard

```js
function copyToWebflow(json /* object */) {
  const str = JSON.stringify(json);          // must start with "{", no BOM
  const onCopy = (e) => {
    e.preventDefault();
    e.clipboardData.setData("application/json", str);   // what Webflow reads
    e.clipboardData.setData("text/plain", str);         // optional fallback
  };
  document.addEventListener("copy", onCopy, true);
  try {
    document.execCommand("copy");             // call synchronously inside a click handler
  } finally {
    document.removeEventListener("copy", onCopy, true);
  }
}
```

- **VERIFIED [S1]:** Webflow reads only `application/json` from the paste event's `clipboardData`. If it is missing or invalid the paste fails with "The clipboard is empty." / "Couldn't read native clipboard data." S13, S5 and alrdy-animate (S3) all report "Clipboard is empty" when only `text/plain` is present.
- **VERIFIED [S10]:** `navigator.clipboard.write([new ClipboardItem({"application/json": blob})])` throws "Type application/json not supported on write". The async API only allows `text/plain`, `text/html`, `image/png` and `web …`-prefixed custom formats. A `web application/json` entry is **not** the same as `application/json`, so the copy-event path is required. `e.clipboardData.setData("application/json", …)` inside a `copy` event works [S10].
- **VERIFIED [S6]:** `text/plain` is **not required**. Systemflow's production library sets only `application/json`. S5, S13 and S14 set both; setting both is harmless and lets users paste the JSON into a text editor for debugging.
- **VERIFIED [S11]; UNCERTAIN for current Safari:** In Safari, custom MIME types set through `DataTransfer` cannot be read cross-origin, so a converter on your domain cannot hand `application/json` to `webflow.com`. Cite: "shipping Safari's DataTransfer APIs don't allow for cross-origin transfer of custom data types" (W3C list, 2022). S4 tells users to use a Chromium browser. **Recommendation:** Chromium (Chrome, Edge, Arc, Brave) is the supported path; detect Safari and warn. Firefox is untested.
- **VERIFIED [S5 comment]:** "Webflow Designer paste handler requires the clipboard to start exactly with `{`". Strip BOMs and leading junk. JSON.parse tolerates leading whitespace, so this is cautious advice rather than a hard rule.
- Paste target: select an element (Body or a container) in the Designer and press Cmd/Ctrl+V. **VERIFIED [S1]** error string: "An element needs to be selected to paste into."

---

## 5. Limitations and gotchas

| Topic | Fact | Status |
|---|---|---|
| Code Embed length | The limit is **50,000 characters** per Code Embed (also site/page custom code and CMS rich text), since 2024-05-07, on paid sites and workspaces. Older limits were 10,000 and earlier 5,000. A free (unpaid) site may still be limited to 10,000. | **VERIFIED [S9]** for 50k on paid plans. **UNCERTAIN:** the free-plan limit, and whether a pasted over-length embed is truncated, rejected or kept. Keep each embed under 10,000 characters to be safe and split larger CSS. |
| Pseudo-elements `::before` / `::after` | Not representable as variants. The only pseudo-element key is `placeholder`. | **VERIFIED [S1 state list; S3]**. S13 and S14 move them to `<style>`. Emit them in an HtmlEmbed `<style>` or in site custom code. |
| Descendant, child or sibling selectors (`.a .b`, `.a > b`, `.a + .b`), `:not()`, `:has()`, attribute selectors, ID selectors | No representation in class styles. | **VERIFIED [S13 rules; S14 ADR 2b]**. Route them to a `<style>` embed. |
| Compound class selectors `.a.b` | Representable **only** as a combo (`comb:"&"`) on an element whose `classes` are `[a, b]`. | VERIFIED (3.4) |
| Global tag styles (`h1 {}`, `body {}`, `a {}`) | Not carried in the clipboard. Even Designer-to-Designer copies don't include them. | **VERIFIED [S7, S16]**. S1 shows `type:"tag"` style blocks exist internally, but pasting them is **UNCERTAIN**; don't. Move them to a `<style>` embed or convert them to classes. |
| CSS custom properties (`--x: …` declarations) | No clipboard field defines a variable. `var(--x)` as a *value* can appear wrapped in `@raw<\|…\|>` (real dump) or plain (generators). The variable itself must be defined in site or page custom code (e.g. a `:root` `<style>` embed). Webflow Variables (`@var_…`) cannot be created via paste. | **VERIFIED [S3, S4, S7]**; plain `var()` without `@raw` is **UNCERTAIN** |
| `@keyframes`, `@font-face`, `@supports`, `prefers-reduced-motion` and other non-breakpoint `@media` | No field. The `animation` property can be stored, but the keyframes must live in a `<style>` embed or head code. | **VERIFIED (no field) [S1, S2]**; S14 sends these to the head. |
| Custom fonts | The pasted `font-family` falls back unless the font is installed on the destination site. | **VERIFIED [S7]** |
| Class name collisions | Pasting a class whose **name exists with different CSS** creates `name 2`, `name 3` (selector `.name-2`). Our paste test confirmed this for base classes (`container-large` → `container-large-3`, `button` → `button-2`); combo classes were not renamed and the element also matched the site's global class of the same name. A class with the **same name and identical CSS** merges. A class with **empty `styleLess`** whose name exists reuses the site's class and its values (this is how Client-First utility combos are reused). | **VERIFIED [S7 official; S4 measured]**. S13's claim that rules get merged into the existing class contradicts both and is **UNCERTAIN/likely wrong**. Prefix generated class names (e.g. `cv-`) so `<style>` embeds keep matching. |
| Unknown or invalid properties | Webflow's behaviour is undocumented. S12 says vendor-prefixed and limited-support properties are not allowed as custom properties. | **UNCERTAIN**. Drop vendor-prefixed properties, or move them to a `<style>` embed. |
| Scripts | `<script>` in an embed is stored (`meta.script:true`) but doesn't run in the Designer canvas, only in preview or on the published site. | **VERIFIED [S3 flag; S13 quote of the Designer warning]** |
| Interactions | Can be included via `ix2`, but generating them is out of scope. Page triggers are never pasted. | **VERIFIED [S7]** |
| Components / Symbols | Pasted components become plain elements. Code components are removed (`codeComponentsRemovedCount`). | **VERIFIED [S7, S3 meta]** |
| `<svg>` | No native SVG element. Use an `HtmlEmbed` (the common approach) or DOM nodes (`data.tag:"svg"`/`"path"`, attributes in `data.attributes`). | **VERIFIED [S3, S15]** |
| `<video>`, `<iframe>`, `<table>`, `<button>`, `<input>` outside forms | Use DOM nodes or an HtmlEmbed. | VERIFIED that DOM exists; per-tag behaviour **UNCERTAIN** |
| Payload size | No documented cap. Payloads of hundreds of KB (whole pages) are common in S3. | **UNCERTAIN** |
| Re-paste dedup | Re-pasting the same deterministic output merges identical classes instead of renaming them. | **VERIFIED [S7 rule; S14 playbook]** |

**How Timothy Ricks' moden.club converter handles the leftovers (S13):** it produces native elements and classes. CSS it cannot map becomes a `<style>` HtmlEmbed and JS becomes a `<script>` HtmlEmbed, both inserted as children of the converted root. Its authoring rules: class-only selectors, no descendant selectors, only simple pseudos (`:hover`/`:focus`/`:focus-visible`/`:active`), combos via `.a.b`, REM units preferred, and no `::before`/`::after`. **VERIFIED [S13]** as third-party documentation of that tool; I did not inspect the tool itself.

---

## 6. Examples

### 6.1 Real excerpts (Designer output)

Text node and heading, from `faithchurchdev/json/page1` [S3]:
```json
{"_id":"f4a7bf38-cc02-11d4-f404-a4ebf2ee133f","type":"Heading","tag":"h1","classes":[],"children":["f4a7bf38-cc02-11d4-f404-a4ebf2ee1340"],"data":{"tag":"h1","attr":{"id":""},"xattr":[],"search":{"exclude":false},"visibility":{"conditions":[]},"displayName":""}}
{"_id":"f4a7bf38-cc02-11d4-f404-a4ebf2ee1340","text":true,"v":"Resonate with the visitor's problem"}
```

A Block with its class, from `darknoon/layer-formats/webflow/webflow.json` (MIT) [S3]:
```json
{"_id":"dad489b0-2486-23e8-ede8-52b71bb82f9a","type":"Block","tag":"div","classes":["d53a63e0-0a2e-d29a-608c-bc42bf3980d3"],"children":[],"data":{"tag":"div","text":false,"displayName":"","attr":{"id":""},"xattr":[],"search":{"exclude":false},"visibility":{"conditions":[]}}}
{"_id":"d53a63e0-0a2e-d29a-608c-bc42bf3980d3","fake":false,"type":"class","name":"lofi-header","namespace":"","comb":"","styleLess":"width: 104px; height: 18px; border-top-left-radius: 6px; border-top-right-radius: 6px; border-bottom-left-radius: 6px; border-bottom-right-radius: 6px; background-color: #29292b; perspective-origin: 0% 0%; transform-origin: 0% 0%;","variants":{},"children":[],"createdBy":"58cee682df096f5938172d6c","selector":null}
```

### 6.2 Minimal complete payload A: div with class, heading with text, embed

Constructed to mirror the real shapes above. It passes structural validation (unique IDs; every child and class resolves). **I did not paste-test it in Webflow.**

```json
{
  "type": "@webflow/XscpData",
  "payload": {
    "nodes": [
      {
        "_id": "3f1c2a10-0001-4a00-8000-000000000001",
        "type": "Block",
        "tag": "div",
        "classes": ["9a7e0c11-0001-4b00-8000-0000000000a1"],
        "children": ["3f1c2a10-0001-4a00-8000-000000000002", "3f1c2a10-0001-4a00-8000-000000000004"],
        "data": {
          "tag": "div", "text": false, "displayName": "",
          "attr": { "id": "" }, "xattr": [],
          "search": { "exclude": false }, "visibility": { "conditions": [] }
        }
      },
      {
        "_id": "3f1c2a10-0001-4a00-8000-000000000002",
        "type": "Heading",
        "tag": "h2",
        "classes": ["9a7e0c11-0001-4b00-8000-0000000000a2"],
        "children": ["3f1c2a10-0001-4a00-8000-000000000003"],
        "data": {
          "tag": "h2", "displayName": "",
          "attr": { "id": "" }, "xattr": [],
          "search": { "exclude": false }, "visibility": { "conditions": [] }
        }
      },
      { "_id": "3f1c2a10-0001-4a00-8000-000000000003", "text": true, "v": "Hello from the converter" },
      {
        "_id": "3f1c2a10-0001-4a00-8000-000000000004",
        "type": "HtmlEmbed",
        "tag": "div",
        "classes": [],
        "children": [],
        "v": "<svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\"><circle cx=\"12\" cy=\"12\" r=\"10\" fill=\"currentColor\"/></svg>",
        "data": {
          "insideRTE": false,
          "embed": {
            "type": "html",
            "meta": {
              "html": "<svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\"><circle cx=\"12\" cy=\"12\" r=\"10\" fill=\"currentColor\"/></svg>",
              "div": false, "iframe": false, "script": false, "compilable": false
            }
          }
        }
      }
    ],
    "styles": [
      {
        "_id": "9a7e0c11-0001-4b00-8000-0000000000a1",
        "fake": false, "type": "class", "name": "cv-card", "namespace": "", "comb": "",
        "styleLess": "display: flex; padding-top: 2rem; padding-right: 2rem; padding-bottom: 2rem; padding-left: 2rem; flex-direction: column; grid-column-gap: 1rem; grid-row-gap: 1rem; border-top-left-radius: 0.5rem; border-top-right-radius: 0.5rem; border-bottom-left-radius: 0.5rem; border-bottom-right-radius: 0.5rem; background-color: #f4f4f5;",
        "variants": {
          "small": { "styleLess": "padding-top: 1rem; padding-right: 1rem; padding-bottom: 1rem; padding-left: 1rem;" }
        },
        "children": [], "createdBy": "000000000000000000000000", "origin": null, "selector": null
      },
      {
        "_id": "9a7e0c11-0001-4b00-8000-0000000000a2",
        "fake": false, "type": "class", "name": "cv-card_title", "namespace": "", "comb": "",
        "styleLess": "margin-top: 0px; margin-bottom: 0px; font-size: 2rem; line-height: 1.2;",
        "variants": {}, "children": [], "createdBy": "000000000000000000000000", "origin": null, "selector": null
      }
    ],
    "assets": [],
    "ix1": [],
    "ix2": { "interactions": [], "events": [], "actionLists": [] }
  },
  "meta": {
    "unlinkedSymbolCount": 0, "droppedLinks": 0, "dynBindRemovedCount": 0,
    "dynListBindRemovedCount": 0, "paginationRemovedCount": 0
  }
}
```

### 6.3 Minimal complete payload B: button link with combo class, states and breakpoints

This payload is constructed and was not paste-tested. It shows:
- a `Link` with `button: true`
- `target`, element `id` and a custom attribute
- a base class whose `children` list the combo
- a combo `is-secondary` (`comb: "&"`)
- `main_hover`, `main_active` (Pressed), `main_focus-visible`, `medium` and `tiny`

```json
{
  "type": "@webflow/XscpData",
  "payload": {
    "nodes": [
      {
        "_id": "7b2d4e20-0002-4a00-8000-000000000001",
        "type": "Link",
        "tag": "a",
        "classes": ["c41f0a22-0002-4b00-8000-0000000000b1", "c41f0a22-0002-4b00-8000-0000000000b2"],
        "children": ["7b2d4e20-0002-4a00-8000-000000000002"],
        "data": {
          "button": true,
          "block": "",
          "link": { "mode": "external", "url": "https://example.com", "target": "_blank" },
          "displayName": "",
          "attr": { "id": "cta-primary" },
          "xattr": [{ "name": "data-track", "value": "hero-cta" }],
          "search": { "exclude": false },
          "visibility": { "conditions": [] }
        }
      },
      { "_id": "7b2d4e20-0002-4a00-8000-000000000002", "text": true, "v": "Get started" }
    ],
    "styles": [
      {
        "_id": "c41f0a22-0002-4b00-8000-0000000000b1",
        "fake": false, "type": "class", "name": "cv-button", "namespace": "", "comb": "",
        "styleLess": "padding-top: 0.75rem; padding-right: 1.5rem; padding-bottom: 0.75rem; padding-left: 1.5rem; background-color: #146ef5; color: #ffffff; font-weight: 600; text-decoration: none; transition-property: background-color; transition-duration: 200ms; transition-timing-function: ease;",
        "variants": {
          "main_hover": { "styleLess": "background-color: #0b5ed7;" },
          "main_active": { "styleLess": "background-color: #094db1;" },
          "main_focus-visible": { "styleLess": "outline-style: solid; outline-width: 2px; outline-color: #0b5ed7;" },
          "medium": { "styleLess": "padding-right: 1.25rem; padding-left: 1.25rem;" },
          "tiny": { "styleLess": "width: 100%; text-align: center;" }
        },
        "children": ["c41f0a22-0002-4b00-8000-0000000000b2"],
        "createdBy": "000000000000000000000000", "origin": null, "selector": null
      },
      {
        "_id": "c41f0a22-0002-4b00-8000-0000000000b2",
        "fake": false, "type": "class", "name": "is-secondary", "namespace": "", "comb": "&",
        "styleLess": "background-color: transparent; color: #146ef5;",
        "variants": { "main_hover": { "styleLess": "background-color: #eef4ff;" } },
        "children": [], "createdBy": "000000000000000000000000", "origin": null, "selector": null
      }
    ],
    "assets": [],
    "ix1": [],
    "ix2": { "interactions": [], "events": [], "actionLists": [] }
  },
  "meta": {
    "unlinkedSymbolCount": 0, "droppedLinks": 0, "dynBindRemovedCount": 0,
    "dynListBindRemovedCount": 0, "paginationRemovedCount": 0
  }
}
```

---

## 7. Converter checklist (derived from the above)

1. Parse the HTML and walk it in pre-order. The first emitted node is the single root, so wrap multiple top-level nodes in a `Block`.
2. Map tags as follows:

   | HTML | Emits |
   |---|---|
   | `div`, `header`, `footer`, `nav`, `main`, `aside`, `article`, `figure` | `Block` with `data.tag`; set `data.text:true` if the element has only text |
   | `section` | `Section` (or `Block` with tag `section`) |
   | `h1`–`h6` | `Heading` |
   | `p` | `Paragraph` |
   | `a` | `Link` (button / block / text variant per 2.4) |
   | `img` | `Image` |
   | `ul`, `ol` | `List` |
   | `li` | `ListItem` |
   | `span` | `Span` |
   | `strong`, `b` | `Strong` |
   | `em`, `i` | `Emphasized` |
   | `br` | `LineBreak` |
   | `blockquote` | `Blockquote` |
   | `sup`, `sub` | `Superscript`, `Subscript` |
   | `form` and its controls | the native `Form*` structure |
   | `svg` | `HtmlEmbed` |
   | anything else | `DOM` |

3. Put `id` in `data.attr.id`. Put other non-built-in attributes in `data.xattr` (or in `data.attributes` for `DOM` nodes).
4. Build styles with this resolution order:

   | CSS input | Where it goes |
   |---|---|
   | Single-class rule (`.a`) | Base style (`comb:""`) |
   | `.a.b` | Combo style (`comb:"&"`), chained through `children` |
   | Supported pseudo-classes | State variants (3.3) |
   | Breakpoint `@media` | `medium` / `small` / `tiny` |
   | Everything else (descendants, tag rules, pseudo-elements, keyframes, `:root` variables, unmatched media, unsupported pseudos) | One HtmlEmbed `<style>` per component (child of the root), kept under 10k characters |

5. Expand shorthands to longhands, use `grid-*-gap`, and expand `repeat()`. Never emit `@var_`. Prefix class names to avoid " 2" renames.
6. Validate before copying:
   - unique `_id`s
   - every child id exists
   - no node has two parents
   - every class id exists
   - every style has a non-empty `name` and `type:"class"`
7. Copy using the copy-event method (section 4) inside a click handler, in a Chromium browser.

## 8. Open-source repos found that generate or consume this format

| Repo | Role |
|---|---|
| `webstudio-is/webstudio` | Most complete **reader**: zod schema, variant parser and fixtures |
| `ycode/ycode` (`lib/import/adapters/webflow`) | Reader |
| `karenrebecag/Webflow-Converter` | TSX+Tailwind to XscpData generator, with **measured paste behaviour** |
| `karenrebecag/Code-to-Webflow` | Claude skill (HTML/CSS to XscpData). Some claims are wrong (see 3.1, 3.3) |
| `karenrebecag/atom-uikit-ds` (`scripts/webflow/generate-xscp.mjs`) | Generator plus ADR |
| `bejamas/webflow-clipboard` | Copy and paste helpers (npm) |
| `febi-git/html-to-webflow` | Workflow around the moden.club converter |
| `humanagencyorg/webflow-xscp_bindings` | Ruby generator for forms |
| `tomiwao/webflow-element-copier-2` | Browser extension |
| `fellanH/webflow-copy-paste` | |
| `RantirAI/webtir2-1` (`webflowTranslator.ts`) | |
| `systemflowco/scripts`, `finsweet/hacks`, `darknoon/layer-formats` | Corpora of real payloads |
| `rchipka/webflow-export` | 2018 Webflow Designer bundle (primary source for the paste reader) |

Hosted tools (closed source):
- moden.club/tools/html-to-webflow (Timothy Ricks)
- html-to-webflow-element-converter.vercel.app
- FlowForge (Autara)
- Byq Supply Code Converter
- htflow (a Webflow app that uses the Designer API rather than the clipboard)
