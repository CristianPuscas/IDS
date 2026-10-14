/**
 * JavaScript extraction. Collects scripts from the HTML (`<script>` tags) and from the JS editor
 * into an ordered bundle that embedBuilder turns into `<script>` HtmlEmbeds. Scripts do not run
 * in the Designer canvas, only in preview and on the published site (spec 5).
 *
 * Execution order of the bundle:
 *   1. `<script type="importmap">` (must precede any module that uses it)
 *   2. external `<script src>` libraries (Three.js, GSAP, Lenis…), in document order
 *   3. inline scripts, in document order (`type="module"`, shaders, JSON-LD keep their type)
 *   4. the JS editor contents (separate mode), last
 *
 * Moving libraries ahead of inline code matches how AI-generated pages are written (libraries
 * in `<head>`, app code at the end of `<body>`) and guarantees globals such as `THREE`/`gsap`
 * exist when the inline code runs.
 *
 * Ownership: engine.
 */

import type { HtmlScript } from './htmlParser';
import type { ConvertWarning } from './types';

/** One script to emit, in execution order. */
export interface ScriptEntry {
  /** External URL (`<script src>`), or `null` for inline code. */
  src: string | null;
  /** Inline code (empty for external scripts). */
  code: string;
  /** Extra attributes to keep on the emitted tag (`type="module"`, `defer`...). */
  attributes: { name: string; value: string }[];
}

/** Result of `extractJs`. */
export interface JsBundle {
  /** Import maps, then external library scripts, then inline code, then editor JS. */
  scripts: ScriptEntry[];
  /** UTF-8 byte length of all inline code. Feeds `stats.jsBytes`. */
  totalBytes: number;
  warnings: ConvertWarning[];
}

/**
 * Merges `<script>` tags from the HTML with the JS editor contents.
 *
 * @param htmlScripts Scripts found by `parseHtml`, in document order.
 * @param editorJs Contents of the JS editor (`separate` mode), or `""`.
 */
export function extractJs(htmlScripts: HtmlScript[], editorJs: string): JsBundle {
  const warnings: ConvertWarning[] = [];
  const typeOf = (s: HtmlScript): string =>
    (s.attributes.find((a) => a.name.toLowerCase() === 'type')?.value ?? '').trim().toLowerCase();

  const entries = htmlScripts
    .map((s) => ({ src: s.src?.trim() || null, code: s.src ? '' : s.code, attributes: s.attributes }))
    .filter((s) => s.src || s.code.trim());

  const importMaps = entries.filter((s) => !s.src && typeOf(s) === 'importmap');
  const external = entries.filter((s) => s.src);
  const inline = entries.filter((s) => !s.src && typeOf(s) !== 'importmap');

  const scripts: ScriptEntry[] = [...importMaps, ...external, ...inline];
  if (editorJs.trim()) {
    const isModule = /^\s*(import\s[^(]|import\s*['"{*]|export\s)/m.test(editorJs);
    scripts.push({ src: null, code: editorJs, attributes: isModule ? [{ name: 'type', value: 'module' }] : [] });
  }

  if (external.length > 0) {
    warnings.push({
      code: 'external-script',
      severity: 'info',
      message: `${external.length} external script${external.length > 1 ? 's were' : ' was'} added to a Code Embed before the inline code.`,
      detail: external.map((s) => s.src).join('\n'),
    });
  }
  const inlineCount = importMaps.length + inline.length + (editorJs.trim() ? 1 : 0);
  if (inlineCount > 0) {
    warnings.push({
      code: 'script-extracted',
      severity: 'info',
      message: `${inlineCount} inline script${inlineCount > 1 ? 's were' : ' was'} placed in Code Embeds; scripts run in Preview and on the published site, not in the Designer canvas.`,
    });
  }

  const encoder = new TextEncoder();
  const totalBytes = scripts.reduce((sum, s) => sum + encoder.encode(s.code).length, 0);
  return { scripts, totalBytes, warnings };
}
