# Handoff – HTML to Webflow Converter

A summary for continuing in a new session (last updated: 2026-10-26).

## How the user wants to work
- Language: **Romanian**.
- Claude acts as an **orchestrator**. It only sends the user questions and status updates; agents and subagents do the actual work.
- Every status message **starts with a progress bar** and the estimated time left, for example:
  `Faza N  [████░░░░]  40%   ⏱ ~20 min rămase`
- When an agent finishes: commit and push to the working branch, then send the user a **single-file HTML version** (vN) that they can open in Chrome.

## Repo, branch, PR
- Repo: `CristianPuscas/IDS`
- Working branch: `claude/dreamy-euler-jbjxxk`
- Last good code commit: **`207cfdd`** (v9; the HANDOFF update is the commit right after it). v8 was `d898fa7`.
- PR: https://github.com/CristianPuscas/IDS/pull/1 (into `main`, open)
- App: `webflow-converter/` (Vite 7 + React 19 + TypeScript strict + Tailwind v4 + Vitest)
- Tests: **600**, all passing (`npm run typecheck`, `npm test`, `npm run build`)
- Deploy: GitHub Pages workflow `.github/workflows/deploy-pages.yml`. It needs Settings → Pages → Source: GitHub Actions, and deploys after a merge to `main`. CI: `.github/workflows/ci.yml`.
- Other files:
  - `analize/youtube-skB7npZnwcc.md`: analysis of Timothy Ricks' video "AI To Webflow"
  - `webflow-converter/docs/webflow-xscp-spec.md`: spec of the Webflow clipboard format

## What the app does
It converts HTML/CSS/JS (usually AI-generated) into Webflow's clipboard format, `@webflow/XscpData`. The output goes to the clipboard as `application/json` via a copy event, and the user pastes it into the Webflow Designer. It works in Chromium browsers; Safari may block the copy.

**Main pieces:**
- **Engine** (`src/engine/`): HTML → native Webflow nodes, and CSS → native classes. Native classes cover combos, states (hover, active, focus…) and breakpoints 991/767/479, with snapping of nearby breakpoints. CSS that Webflow can't hold natively, and all JS, goes into embeds.
- **UI** (`src/ui/`):
  - Combined / Separate input tabs
  - "Copy Ideal System Prompt for AI" button (Client-First v2)
  - Advanced options
  - "Reuse classes from your Webflow site" (the user pastes a Designer copy)
  - Results panel and warnings

**New in v9** (merged from two agent branches; conflict in `normValue` resolved as `normalizeLengthForCompare(remEquivalent(...))`):
- **"1. Your site's style guide" step** (`src/engine/styleLibrary.ts`, `src/ui/components/SiteStylesPanel.tsx`, `src/ui/lib/{siteLibrary,cssFetch,libraryJobs,libraryRunner,libraryWorker}.ts`): paste whole Designer pages (page wrapper, Ctrl/Cmd+C); they accumulate into one library in localStorage (per-source list: label, rename, remove, clear; on/off switch). Each paste is analysed: utility vs custom classes, combos, variables, breakpoints/states, existing " 2" duplicates (warnings). Secondary sources: published CSS by URL (CORS fallback message), pasted or uploaded `.css` — these are reference styles (`h2w-ref:`) that decide renames/taken names but are never pasted as the site's own. Same name + same CSS → reused, pasted with the site's own styleLess bytes; same name + different CSS → renamed against the whole library. Parsing runs in an inline (Blob) Web Worker with a main-thread fallback; storage handles QuotaExceededError.
- **Client-First units** (`src/engine/units.ts`, option `units: 'rem' | 'keep'`, default `rem`): px → rem (base 16, max 4 decimals) in native styles, inline styles, defaults and embed CSS; border-radius and border/outline/stroke/column-rule widths stay px; 0, %, vh/vw, em, unitless, strings, url() and @media breakpoints untouched. Library comparison treats 16px = 1rem. The AI prompt asks for rem (and now describes `cssVariables: 'inline'` correctly).

**Default behaviours as of v8:**
- **Forms** `auto`: forms driven by custom JS (`novalidate`, `data-*` hooks, a submit listener) stay as an embed; plain forms become native Webflow forms.
- **Buttons:** native Button, with neutralised `.w-button` styles. Optional `customElement` mode for a real `<button>`.
- **External images:** become a Custom Element `img` with the src intact.
- **Scripts:** minified with terser when over 50k characters; if still too big, they are offered for external hosting.
- **CSS properties** are written in Webflow's canonical order. This prevents "name 2" duplicates on repeated pastes.
- **Same class name, different CSS → Create a separate class** (default; this is the user's explicit rule).
- **`uniqueCombos`:** combos with styles get a CSS-derived suffix, e.g. `is-secondary-srt6`, because Webflow merges combos by name. Combos used by JS keep their name and their CSS goes to the embed.
- **`cssVariables: 'inline'`:** `var()` is resolved to values; the variables are scoped on the pasted wrapper (`data-h2w-vars`).
- **Client-First:** list of utility classes, the `clientFirstUtilities` keep/prefix option, a hint when the core structure is missing, and an optional `classPrefix`.
- **Internal attributes:** `data-h2w-class`, `data-h2w-button`, `data-h2w-vars`.

## Real paste tests (Webflow site `daniels-marvelous-site-1ce6b2.webflow.io`)
- **Farm page** (`/testtimosha`):
  - Fixed: broken external images, site tag-style leaks, mobile menu, `b`→`strong`, buttons with `href="#"`.
- **GreenIron** (fixture `src/engine/__fixtures__/greeniron.html`):
  - Fixed: duplicated JS forms, empty inputs, `.w-select`, a 56 KB script, the burger menu (`is-open` selector), Bebas font (two quoted names), duplicates caused by property order.
- **Corbel hero** (`/testhero`, fixture `hero-construction.html`):
  - GreenIron colours came through because classes were reused by name and the `is-secondary` combo was merged. Fixed in v8.
- **v9 NOT paste-tested yet** (nor v8). Checklist:
  - (a) style guide paste: class/combo/variable counts and the " 2" duplicate warnings look right;
  - (b) same utilities with identical CSS → no "name 2", even when the site is in px and our output is rem;
  - (c) same name, different CSS → a new name that does not collide with any page in the library;
  - (d) fetch CSS by URL (CORS: expect the fallback message on most sites; paste/upload works);
  - (e) rem output looks right in the Designer; border-radius and border widths stay px;
  - (f) earlier v8 checks: `data-h2w-vars` survives, renamed combos stay separate.

## Next steps for the new session
1. Check out `claude/dreamy-euler-jbjxxk` (v9), then run `cd webflow-converter && npm ci && npm test`.
2. Send the user the single-file v9 (rebuild from the commit if the scratchpad is gone).
3. Wait for the user's paste test in Webflow; diagnose problems with Firecrawl, since the proxy blocks `*.webflow.io`.
4. When the tests pass: merge the PR, then enable GitHub Pages.

## Notes
- **Single-file build:** run `git archive HEAD webflow-converter`, then `npm ci && npm run build`. Inline the JS (as a module) and the CSS, including the terser chunk, into one HTML file. Verify it over `file://` with Playwright (Chromium at `/opt/pw-browsers/chromium`).
- **Scratchpad is temporary:** the files v1–v9 and the diagnostic folders in the session scratchpad will not carry over to a new session. Rebuild v9 from the commit if needed. The library parser is already a Blob-inlined worker inside the main JS chunk. v9 was inlined this way: CSS in `<style>`, favicon as a data URI, the terser chunk as a JSON string in `<script type="application/json">` loaded through a Blob URL (`import("./terser-*.js")` replaced by `import(globalThis.__h2wTerserUrl())`), the main chunk in `<script type="module">` (escape `"<!--` as `"<\!--`; use function replacements so `$&` in the code is not expanded).
- **Plugin `savvy-progress-local`** (Agents panel): it lives on branch `claude/new-session-mfuub3`. It was reviewed and is not dangerous, but it adds "caveman"-style instructions to every agent. The user installs it themselves locally (the cloud session blocked the install).
