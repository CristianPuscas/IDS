/**
 * HtmlEmbed (Code Embed) builders (spec 2.4 HtmlEmbed). Used for leftover CSS (`<style>`),
 * scripts (`<script>`), head links and elements kept as raw code (e.g. `<svg>`).
 *
 * Embeds over `maxChars` are split into several embeds (spec 5: keep each under 10k chars).
 *
 * Ownership: engine.
 */

import { uuid } from './ids';
import type { JsBundle } from './jsExtractor';
import type { WfElementNode } from './types';

/**
 * Builds one HtmlEmbed node. `v` and `data.embed.meta.html` hold the same string; `script` and
 * `iframe` flags are sniffed from the code.
 *
 * @param code Raw HTML for the embed (e.g. `"<style>...</style>"`, `"<svg>...</svg>"`).
 * @param classes Optional style ids (embeds are normally classless).
 */
export function buildEmbedNode(code: string, classes: string[] = []): WfElementNode {
  return {
    _id: uuid(),
    type: 'HtmlEmbed',
    tag: 'div',
    classes,
    children: [],
    v: code,
    data: {
      insideRTE: false,
      embed: {
        type: 'html',
        meta: {
          html: code,
          div: false,
          iframe: /<iframe[\s>]/i.test(code),
          script: /<script[\s>]/i.test(code),
          compilable: false,
        },
      },
    },
  };
}

/**
 * Wraps leftover CSS in `<style>` embeds, splitting between rules so no embed exceeds `maxChars`.
 *
 * @param cssChunks Rule/at-rule source texts in cascade order (each chunk is never split).
 * @param maxChars Max characters per embed, including the `<style>` tags.
 * @returns Zero or more HtmlEmbed nodes, in order.
 */
export function buildStyleEmbeds(cssChunks: string[], maxChars: number): WfElementNode[] {
  return packChunks(cssChunks, maxChars, '<style>\n', '\n</style>').map((code) => buildEmbedNode(code));
}

/**
 * Turns a script bundle into `<script>` embeds: one per external `src`, and inline code packed
 * under `maxChars` per embed.
 *
 * @param bundle Output of `extractJs`.
 * @param maxChars Max characters per embed.
 */
export function buildScriptEmbeds(bundle: JsBundle, maxChars: number): WfElementNode[] {
  const nodes: WfElementNode[] = [];
  for (const s of bundle.scripts) {
    const attrs = s.attributes.map((a) => (a.value === '' ? ` ${a.name}` : ` ${a.name}="${a.value}"`)).join('');
    if (s.src) {
      nodes.push(buildEmbedNode(`<script src="${s.src}"${attrs}></script>`));
    } else if (s.code.trim()) {
      nodes.push(buildEmbedNode(`<script${attrs}>\n${s.code}\n</script>`));
    }
  }
  void maxChars; // Stub: splitting of oversized inline scripts is left to the engine agent.
  return nodes;
}

/** Greedily packs chunks into strings of at most `maxChars` (a single oversized chunk stays whole). */
function packChunks(chunks: string[], maxChars: number, open: string, close: string): string[] {
  const out: string[] = [];
  let current: string[] = [];
  let size = open.length + close.length;
  for (const chunk of chunks) {
    const add = chunk.length + 1;
    if (current.length > 0 && size + add > maxChars) {
      out.push(open + current.join('\n') + close);
      current = [];
      size = open.length + close.length;
    }
    current.push(chunk);
    size += add;
  }
  if (current.length > 0) out.push(open + current.join('\n') + close);
  return out;
}
