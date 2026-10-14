# HTML to Webflow Converter

A client-side web app that converts HTML/CSS/JS (often AI-generated) into Webflow's native
clipboard format, `@webflow/XscpData`. You click **Convert**, the result goes on your clipboard,
and you paste it into the Webflow Designer with Ctrl/Cmd+V. Elements become native Webflow
elements and class styles. CSS and JS that Webflow cannot represent natively go into Code Embeds.

Everything runs in the browser. Nothing is uploaded.

- Format reference: [`docs/webflow-xscp-spec.md`](docs/webflow-xscp-spec.md). It covers what is verified and what is uncertain.
- Browser: use a Chromium browser (Chrome, Edge, Arc, Brave). Safari does not pass the
  `application/json` clipboard entry to another site (spec section 4).

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
    │   ├── nodeBuilder.ts      buildNodes(): DOM -> pre-order WfNode list under one root Block
    │   ├── jsExtractor.ts      extractJs(): <script> tags + JS editor -> ordered bundle
    │   ├── embedBuilder.ts     HtmlEmbed builders for <style>/<script>/raw code, with size splitting
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
  embedPlacement: 'root';          // embeds are appended as children of the root wrapper
  keepUnsupportedInEmbed: boolean; // true: unmappable CSS goes into a <style> embed
  maxEmbedChars: number;           // 10000: split larger embeds
  includeLargeBreakpoints: boolean;// false: min-width rules are not emitted as large/xl/xxl
}

interface ConvertResult {
  data: XscpData;
  json: string;
  warnings: ConvertWarning[];
  stats: { nodes; styles; embeds; embeddedCssRules; jsBytes };
}
```

## Status

The scaffold is in place. `clipboard.ts`, `ids.ts` and `validate.ts` are complete. The other engine
modules are minimal stubs, and for now the converter wraps the HTML in Code Embeds. The engine work
replaces them with native element and style mapping, following checklist section 7 of the spec.

Credits: the converter approach and prompt guidance follow Timothy Ricks' "AI To Webflow" video
(analysis in `../analize/youtube-skB7npZnwcc.md`).
