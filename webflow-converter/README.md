# HTML to Webflow Converter

A client-side web app that converts HTML/CSS/JS (often AI-generated) into Webflow's native
clipboard format, `@webflow/XscpData`. You click **Convert**, the result goes on your clipboard,
and you paste it into the Webflow Designer with Ctrl/Cmd+V. Elements become native Webflow
elements and class styles. CSS and JS that Webflow cannot represent natively go into Code Embeds.

Everything runs in the browser. Nothing is uploaded.

Format reference: [`docs/webflow-xscp-spec.md`](docs/webflow-xscp-spec.md). It covers what is
verified and what is uncertain.

> **Validate by pasting.** Webflow does not document this clipboard format. The output follows real
> Designer dumps and passes structural validation and an automated browser test, but the only real
> proof is a paste into the Webflow Designer. Test each new kind of input on a scratch page first.

## Features

- Two input modes: **All-in-One** (one HTML file with `<style>` and `<script>`) and **Separate
  Files** (HTML, CSS and JS editors). Each has a "Load example" button.
- Native Webflow elements: Div Blocks, Sections, Headings, Paragraphs, Text Links, Link Blocks,
  Buttons, Images, Lists, and inline Span/Strong/Emphasized/Superscript/Subscript/Line Break.
- Native Webflow forms: Form Block with text inputs, textareas, selects, checkboxes, radios, labels,
  a submit button and the success and error messages Webflow requires.
- Buttons keep the source look: every Webflow `.w-button` default (blue background, padding,
  white text…) that your CSS does not set is overridden on the button's class.
- Class names are renamed to the selector Webflow publishes (`heroTitle` → `herotitle`,
  `md:flex` → `md-flex`), and the `<style>` embed is rewritten to match.
- Embedded canvas, svg, video and iframe elements with percentage or absolute sizing get a wrapper
  Div Block that carries their layout, so they size like in the source.
- Native class styles: base classes, combo classes (`.a.b`, with the Designer's `children` chain),
  state variants and breakpoint variants. Shorthands are expanded to the longhands the Designer
  writes, and `repeat(N, …)` grid tracks are expanded.
- Mobile-first `min-width` CSS is re-encoded desktop-first onto Webflow's breakpoints.
- In-page links (`href="#id"`) to an element inside the pasted tree become Webflow section links.
- Everything else goes into Code Embeds, split to stay under 10,000 characters each: leftover CSS
  as `<style>` (first child of the root) and JS as `<script>` (last child).
- Structural validation before copying, then a summary with node, class and embed counts, plus
  warnings that explain every piece sent to an embed.
- Fallbacks: Download JSON, and copy the raw JSON as text for debugging.
- An "ideal AI prompt" you can give Claude or ChatGPT so the code it writes converts cleanly.

## How to use

1. Open the app in a Chromium browser (Chrome, Edge, Arc or Brave).
2. Paste your code into the All-in-One tab, or into the HTML/CSS/JS editors of the Separate tab.
3. Press **Convert & Copy to Webflow** (Ctrl/Cmd+Enter). A green toast confirms the copy.
4. In the Webflow Designer, select an element (the Body, or a container you want to paste into)
   and press **Ctrl/Cmd+V**. Webflow refuses the paste if nothing is selected.
5. Check the warnings list. Scripts in embeds do not run on the Designer canvas, so check them in
   Preview or on the published site. Add any custom fonts to the site.

## What becomes native and what goes into an embed

| Input | Result in Webflow |
|---|---|
| `div`, `header`, `footer`, `nav`, `main`, `article`, `aside`, `figure`, `address` | Div Block with that tag (Text Block when it holds text directly) |
| `section` | Section |
| `h1`–`h6`, `p`, `blockquote` | Heading, Paragraph, Block Quote |
| `a` | Text Link; Link Block when it wraps block elements or images; Button when it looks like one (`btn`, `button`, `*-btn` classes or `role="button"`) |
| `button` | Webflow Button (an `<a>` with `role="button"`); Link Block if it wraps block elements. Option `buttonMode: 'linkBlock'` makes button-like elements Link Blocks |
| `form` and its `input`/`textarea`/`select`/`label`/submit `button` | Native Form Block: FormWrapper > FormForm (+ success and error messages), FormTextInput, FormTextarea, FormSelect, FormBlockLabel, Checkbox/Radio wrappers, FormButton |
| File, hidden, date, range… inputs, reset buttons, `<optgroup>` selects inside a form | Code Embed inside the native form, with a warning |
| `img` | Image that keeps its original URL (hot-linked, no asset record) |
| `ul`/`ol`, `li` | List, List Item |
| `span`, `strong`/`b`, `em`/`i`, `sup`, `sub`, `br` | Span, Bold, Italic, Superscript, Subscript, Line Break |
| Other tags (`small`, `code`, `pre`, `label`, `time`, `hr`…) | Custom Element (DOM node) |
| `svg`, `canvas`, `video`, `audio`, `iframe`, `picture`, `table`, form controls outside a form… | Code Embed with the element's HTML; inside a classed Div Block (`<class>-embed`) when it uses percentage sizes or absolute positioning |
| `.a { }` | Base class |
| `.a.b { }` | Combo class `b` on `a`, only for combinations present in the HTML |
| `:hover`, `:active`, `:focus`, `:focus-visible`, `:visited`, `::placeholder`, `.w--current`, `.w--open` | State variants (`main_hover`, `main_active` for "Pressed"…) |
| `@media (max-width: 991/767/479px)` and `(min-width: 992/768/480px)`, ±20px | `medium` / `small` / `tiny` variants |
| `style="…"` attributes | A generated class (`inline-style-N`) |
| `var(--x)` values | Kept in the class as `@raw<\|var(--x)\|>` (the variables themselves go to the embed) |
| Tag, ID, attribute, descendant, child and sibling selectors; `::before`/`::after`; other pseudo-classes | `<style>` embed |
| `:root`/custom property definitions, `@keyframes`, `@font-face`, `@import`, other `@media` | `<style>` embed |
| Vendor-prefixed properties or values, `!important` | `<style>` embed |
| Class combinations not on any element (usually toggled by JS) | `<style>` embed |
| `<script>` (inline or `src`) and the JS editor | `<script>` embed, last child of the root |
| `<link rel="stylesheet">` | Embed, first child of the root |

The payload is always one tree. If the input has several top-level elements or needs embeds, they
are wrapped in one classless Div Block.

## Browser support

| Browser | Status |
|---|---|
| Chrome, Edge, Arc, Brave (Chromium) | Supported. This is the tested path. |
| Safari | May not work. Safari does not pass custom clipboard types such as `application/json` to another site, so Webflow can report an empty clipboard (spec section 4). The app shows a warning. |
| Firefox | Untested. |

## Known limitations

- **Images** keep their original URL with no Webflow asset record (spec 2.4: fabricating asset
  records is risky). They hot-link from the original host and do not appear in the Assets panel.
  Relative URLs will not resolve. `srcset`/`sizes` are dropped.
- **Buttons** are Webflow Buttons, which carry `.w-button`. The converter adds the source's values
  (or the browser defaults of the source `<a>`/`<button>`) to the button's base class for each
  `.w-button` property your CSS leaves unset. This is skipped, with a warning, when that base class
  is also used on non-button elements. UA font styles of `<button>` (13.33px system font) are not
  reproduced, because the element becomes an `<a>`. Use `buttonMode: 'linkBlock'` to avoid
  `.w-button` entirely (the text then sits in a Text Block inside a Link Block).
- **Forms** are native (`forms: 'native'`). The node shapes come from real Designer dumps (spec
  2.4); the radio wrapper and radio label types are inferred from the checkbox pair. Native fields
  pick up Webflow's `.w-input`/`.w-select`/`.w-checkbox` defaults (height 38px, padding, grey
  border…) where your CSS does not set them, and a submit button with icons becomes a plain-text
  Form Button. File, hidden, date and other unsupported controls stay as Code Embeds inside the
  form, so Webflow form handling does not see their files. The pasted form uses the destination
  site's notification settings. Use `forms: 'embed'` to keep the original HTML.
- **Code Embed sizing**: Webflow wraps each Code Embed in an unsized `.w-embed` div. Embedded
  elements with percentage sizes or absolute positioning are therefore placed in a classed Div
  Block that takes over their layout declarations (from every matching rule and breakpoint), and
  get an inline style that makes them fill it. Other embedded elements are unchanged. Spec 2.4 shows
  no Code Embed with a class, hence the wrapper. Turn it off with `embedSizing: 'none'`.
- **Section links** are used only when the `#id` target is inside the pasted tree. Other anchors
  stay plain `#id` URLs. The section-link shape comes from real dumps but has not been
  paste-tested here.
- **`var()` in side shorthands**: `padding: var(--x)` and similar (fewer tokens than sides) is kept
  as one shorthand in `@raw<|…|>`, because the variable may hold several values. The Style panel
  shows it as a raw value.
- **Cascade across states**: combo classes reproduce the cascade per state and per breakpoint,
  but conflicts between a combo's base value and the parent's `:hover` (or other state) value
  are not reconciled.
- **Class names** are renamed with Webflow's own rule (lowercase; other characters become `-`;
  a leading digit, `w-` or `wf-` gets a `_` prefix), and classes that would collide get a suffix
  (`card-2`). HTML and CSS are rewritten; scripts are not. A warning lists every rename and every
  string literal in your JS that still uses an old name, so you can update it. CSS-only classes
  (usually toggled by JS) keep their names. Turn it off with `normalizeClassNames: false`.
- **Breakpoints**: `min-width` 1280/1440/1920 and odd widths stay in the `<style>` embed, because
  pasting `large`/`xl`/`xxl` variants adds breakpoints to the whole site.
- **Scripts** do not run on the Designer canvas. Webflow Interactions are not generated.
- The format is undocumented and Webflow can change it. See the spec for every uncertain point.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # vitest run
npm run typecheck  # tsc --noEmit
npm run build      # typecheck + production build into dist/
npm run preview    # serve dist/
```

Stack: Vite 7, React 19, TypeScript 5.9 (strict, `noUncheckedIndexedAccess`), Tailwind CSS 4
(`@tailwindcss/vite`, tokens in `src/index.css`), Vitest 4 with jsdom. Fonts: Inter and
JetBrains Mono from Google Fonts.

## Deploy

The app is fully static, so any static host can serve `dist/`.

**GitHub Pages (built in).** Live URL: <https://cristianpuscas.github.io/IDS/>

- `.github/workflows/deploy-pages.yml` runs `npm ci && npm test && npm run build` in
  `webflow-converter/` and publishes `webflow-converter/dist`. It runs on every push to `main`
  that touches `webflow-converter/**` (so after a PR is merged), or manually from
  Actions → "Deploy webflow-converter to GitHub Pages" → Run workflow (`workflow_dispatch`).
- One-time setup: in the repo go to **Settings → Pages → Build and deployment → Source** and
  choose **GitHub Actions**.
- `.github/workflows/ci.yml` runs typecheck, tests and build on pull requests and on pushes to
  branches other than `main`.

**Base path.** `vite.config.ts` reads `BASE_PATH` (default `/`). Pages serves the app under
`/<repo-name>/`, so the workflow sets `BASE_PATH=/${{ github.event.repository.name }}/`. The path
is case-sensitive: the repo is `IDS`, so the path is `/IDS/`. To reproduce locally:

```bash
BASE_PATH=/IDS/ npm run build
npx vite preview --base /IDS/   # http://localhost:4173/IDS/
```

**Vercel or Netlify.** Import the repo, set the root directory to `webflow-converter`, the build
command to `npm run build` and the output directory to `dist`. Leave `BASE_PATH` unset, because
these hosts serve from the domain root.

## Folder structure

```
webflow-converter/
├── docs/webflow-xscp-spec.md   Clipboard format spec (source of truth for the engine)
├── index.html                  Fonts, favicon, #root
├── vite.config.ts              Vite + React + Tailwind plugins, Vitest config (jsdom)
└── src/
    ├── main.tsx                Mounts <App />
    ├── index.css               Tailwind import + @theme design tokens (dark)
    ├── engine/                 Conversion logic (no React, no DOM rendering)
    │   ├── types.ts            SHARED CONTRACT: XscpData types + ConvertInput/Options/Result/Warning
    │   ├── index.ts            convert(): the public pipeline; re-exports types, copyToWebflow, validateXscp
    │   ├── htmlParser.ts       parseHtml(): DOM + extracted <style>/<script>/<link>
    │   ├── cssParser.ts        parseCss(): flat rules (with @media) + at-rules; parseDeclarations()
    │   ├── styleMapper.ts      mapStyles(): CSS -> WfStyle registry + leftover CSS for embeds
    │   ├── selectors.ts        classifySelector(): native class/combo/state selector or embed
    │   ├── media.ts            mediaToBands(): @media -> Webflow breakpoint bands
    │   ├── cssValues.ts        prepareDeclaration(): longhand expansion, @raw, embed-only values
    │   ├── nodeBuilder.ts      buildNodes(): DOM -> pre-order WfNode list under one root Block
    │   ├── jsExtractor.ts      extractJs(): <script> tags + JS editor -> ordered bundle
    │   ├── embedBuilder.ts     HtmlEmbed builders for <style>/<script>/raw code, with size splitting
    │   ├── embedSizing.ts      Layout wrapper Block for sized canvas/svg/video/iframe embeds
    │   ├── forms.ts            Native Form Block (FormWrapper, FormForm, fields, messages)
    │   ├── buttonDefaults.ts   .w-button neutralizers for Webflow Buttons
    │   ├── classNames.ts       Webflow class-name rule, renames, CSS selector rewriting
    │   ├── cascade.ts          Which source declarations apply to an element (specificity)
    │   ├── validate.ts         validateXscp(): structural checks before copying
    │   ├── clipboard.ts        copyToWebflow(): copy-event clipboard write (done); isSafari()
    │   ├── ids.ts              uuid() v4 helper
    │   └── *.test.ts           Vitest tests
    └── ui/                     Interface (React)
        ├── App.tsx             State, convert() + copyToWebflow() on click
        ├── prompt.ts           IDEAL_SYSTEM_PROMPT (Webflow-friendly AI prompt)
        └── components/
            ├── InputTabs.tsx   'combined' | 'separate' tabs
            ├── CodeEditor.tsx  label, language ('html'|'css'|'js'), value, onChange, placeholder
            ├── PromptHelper.tsx Shows and copies the AI prompt
            ├── ConvertButton.tsx
            ├── Toast.tsx
            └── ResultPanel.tsx Stats and warnings
```

## Module ownership

The engine and the UI are built in parallel by different people or agents. They meet only at the
contract below.

| Area | Owner | May change freely | Contract (change only additively) |
|---|---|---|---|
| `src/engine/**` | Engine | Internals of every engine module, internal types, new engine files, engine tests | `convert()` signature, `copyToWebflow()`, `isSafari()`, `validateXscp()` |
| `src/ui/**`, `src/index.css`, `index.html` | UI | Layout, styling, components, prompt text, UI tests | Component props interfaces (used only inside `ui/`) |
| `src/engine/types.ts` | Shared | Add optional fields or new union members | Everything exported. Coordinate before renaming or removing anything |

Rules:

- The UI imports from `src/engine/index.ts`, `src/engine/types.ts` and `src/engine/clipboard.ts`
  only. It never imports engine internals such as `cssParser`.
- The engine never imports from `src/ui/` or React.
- `convert()` is pure, synchronous and never throws. It reports problems in `warnings`.
- `copyToWebflow()` must run inside the click handler, with no `await` before it.

## Engine contract

```ts
convert(input: ConvertInput, options?: Partial<ConvertOptions>): ConvertResult
copyToWebflow(json: string): Promise<boolean>

type ConvertInput =
  | { mode: 'combined'; html: string }
  | { mode: 'separate'; html: string; css: string; js: string };

interface ConvertOptions {
  breakpointTolerancePx: number;   // 20: max-width media within ±20px of 991/767/479 maps to medium/small/tiny
  embedPlacement: 'root';          // embeds are children of the root wrapper (CSS first, JS last)
  keepUnsupportedInEmbed: boolean; // true: unmappable CSS goes into a <style> embed
  maxEmbedChars: number;           // 10000: split larger embeds
  includeLargeBreakpoints: boolean;// false: min-width 1280/1440/1920 rules go to the embed, not large/xl/xxl
  buttonMode: 'button' | 'linkBlock'; // 'button': native Button + .w-button neutralizers; 'linkBlock': Link Block, no .w-button
  forms: 'native' | 'embed';          // 'native': Webflow Form Block; 'embed': form HTML in a Code Embed
  embedSizing: 'wrapper' | 'none';    // 'wrapper': sized canvas/svg/video/iframe get a classed layout Div Block
  normalizeClassNames: boolean;       // true: rename classes to Webflow's published form, rewrite CSS
}

interface ConvertResult {
  data: XscpData;
  json: string;
  warnings: ConvertWarning[];
  stats: { nodes; styles; embeds; embeddedCssRules; jsBytes };
}
```

## Testing

- `npm test` runs the unit tests for the engine and UI, including fixture-based end-to-end
  conversions validated with `validateXscp()`.
- A browser check (Playwright, not a project dependency) has been run against `npm run preview`.
  It loads each tab's example, presses Convert, captures the `application/json` clipboard entry
  from the copy event and checks the invariants: single pre-order root, unique UUID ids, no
  dangling child or class references, combo chains, `styleLess` format, variant keys and embed
  meta.

Credits: the converter approach and prompt guidance follow Timothy Ricks' "AI To Webflow" video
(analysis in `../analize/youtube-skB7npZnwcc.md`).
