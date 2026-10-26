/**
 * HTML parsing. Turns the user's HTML string into a DOM tree and pulls out the parts that are
 * not elements to convert: `<style>` blocks, `<script>` tags and `<link rel="stylesheet">` tags.
 * Works for full documents (`<!doctype html><html><head>…`) and for fragments: DOMParser puts a
 * fragment's leading `<style>`/`<link>` in `<head>` and the rest in `<body>`; both are searched.
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
  /** Classes on `<body>`; the converter puts them on the root wrapper. */
  bodyClasses: string[];
  /** Every class name used on any element (for collision-free generated names). */
  classNames: Set<string>;
  warnings: ConvertWarning[];
}

/**
 * Parses an HTML document or fragment.
 *
 * `<style>` and `<script>` inside `<svg>` stay with the SVG (they belong to it).
 *
 * @param html Full document (`<!doctype html>...`) or a fragment. Empty input yields no roots.
 * @returns The DOM, the top-level nodes to convert and the extracted style/script/link tags.
 */
export function parseHtml(html: string): ParsedHtml {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const styles: string[] = [];
  const scripts: HtmlScript[] = [];
  const headLinks: string[] = [];
  const warnings: ConvertWarning[] = [];
  const outsideSvg = (el: Element): boolean => !el.parentElement?.closest('svg');

  doc.querySelectorAll('style').forEach((el) => {
    if (!outsideSvg(el)) return;
    styles.push(el.textContent ?? '');
    el.remove();
  });
  doc.querySelectorAll('script').forEach((el) => {
    if (!outsideSvg(el)) return;
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
    if (/\b(stylesheet|preconnect|preload|modulepreload)\b/.test(rel)) headLinks.push(el.outerHTML);
    el.remove();
  });

  const roots = Array.from(doc.body.childNodes).filter(
    (n) => n.nodeType === 1 || (n.nodeType === 3 && (n.textContent ?? '').trim() !== ''),
  );

  const classNames = new Set<string>();
  doc.querySelectorAll('[class]').forEach((el) => {
    for (const c of (el.getAttribute('class') ?? '').split(/\s+/)) if (c) classNames.add(c);
  });
  const bodyClasses = (doc.body.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);

  if (html.trim() && roots.length === 0 && styles.length === 0 && scripts.length === 0) {
    warnings.push({ code: 'parse-error', severity: 'warning', message: 'The HTML contains no elements to convert.' });
  }

  return { document: doc, roots, styles, scripts, headLinks, bodyClasses, classNames, warnings };
}
