/**
 * JavaScript extraction. Collects scripts from the HTML (`<script>` tags) and from the JS editor
 * into an ordered bundle that embedBuilder turns into `<script>` HtmlEmbeds. Scripts do not run
 * in the Designer canvas, only in preview and on the published site (spec 5).
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
  /** External library scripts first (e.g. three.js, GSAP), then inline code, in source order. */
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
  const scripts: ScriptEntry[] = htmlScripts.map((s) => ({ src: s.src, code: s.code, attributes: s.attributes }));
  if (editorJs.trim()) scripts.push({ src: null, code: editorJs, attributes: [] });
  const totalBytes = scripts.reduce((sum, s) => sum + new TextEncoder().encode(s.code).length, 0);
  return { scripts, totalBytes, warnings: [] };
}
