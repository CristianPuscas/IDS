/**
 * HTML parsing. Turns the user's HTML string into a DOM tree and pulls out the parts that are
 * not elements to convert: `<style>` blocks, `<script>` tags and `<link rel="stylesheet">` tags.
 *
 * Runs in the browser (DOMParser) and in Vitest (jsdom environment).
 *
 * Ownership: engine.
 */

import type { ConvertWarning } from './types';

/** A `<script>` tag found in the HTML. */
export interface HtmlScript {
  /** `src` attribute for external scripts, otherwise `null`. */
  src: string | null;
  /** Inline code (empty for external scripts). */
  code: string;
  /** Other attributes (`type`, `defer`, `async`, `crossorigin`...), in source order. */
  attributes: { name: string; value: string }[];
}

/** Result of `parseHtml`. */
export interface ParsedHtml {
  /** The parsed document (owner of `roots`). */
  document: Document;
  /**
   * Top-level nodes to convert, in order: the children of `<body>`, after `<style>`, `<script>`
   * and `<link>` elements have been removed. Whitespace-only text nodes are excluded.
   */
  roots: Node[];
  /** Text of every `<style>` element (head and body), in document order. */
  styles: string[];
  /** Every `<script>` element (head and body), in document order. */
  scripts: HtmlScript[];
  /** Outer HTML of `<link rel="stylesheet">` / `<link rel="preconnect">` tags to keep in an embed. */
  headLinks: string[];
  warnings: ConvertWarning[];
}

/**
 * Parses an HTML document or fragment.
 *
 * @param html Full document (`<!doctype html>...`) or a fragment. Empty input yields no roots.
 * @returns The DOM, the top-level nodes to convert and the extracted style/script/link tags.
 */
export function parseHtml(html: string): ParsedHtml {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const styles: string[] = [];
  const scripts: HtmlScript[] = [];
  const headLinks: string[] = [];

  doc.querySelectorAll('style').forEach((el) => {
    styles.push(el.textContent ?? '');
    el.remove();
  });
  doc.querySelectorAll('script').forEach((el) => {
    scripts.push({
      src: el.getAttribute('src'),
      code: el.textContent ?? '',
      attributes: Array.from(el.attributes)
        .filter((a) => a.name !== 'src')
        .map((a) => ({ name: a.name, value: a.value })),
    });
    el.remove();
  });
  doc.querySelectorAll('link').forEach((el) => {
    const rel = (el.getAttribute('rel') ?? '').toLowerCase();
    if (rel.includes('stylesheet') || rel.includes('preconnect')) headLinks.push(el.outerHTML);
    el.remove();
  });

  const roots = Array.from(doc.body.childNodes).filter(
    (n) => n.nodeType === 1 || (n.nodeType === 3 && (n.textContent ?? '').trim() !== ''),
  );

  return { document: doc, roots, styles, scripts, headLinks, warnings: [] };
}
