/**
 * Fetches a published site's CSS for the style guide library: a stylesheet URL directly, or a page
 * URL whose `<link rel="stylesheet">` files are then fetched (Webflow serves them from
 * cdn.prod.website-files.com). Browsers only let a page read another site when that site allows it
 * (CORS); Webflow's pages usually do not, so the error says how to get the CSS another way (paste
 * the stylesheet URL, paste the CSS, or upload the `.css` file).
 *
 * Ownership: ui.
 */

/** Result of {@link fetchSiteCss}. */
export type CssFetchResult = { ok: true; css: string; urls: string[] } | { ok: false; error: string };

/** Most stylesheets read from one page. */
const MAX_SHEETS = 6;

/** `example.com/page` -> `https://example.com/page`; `null` when it is not an http(s) URL. */
export function normalizeUrl(input: string): URL | null {
  const text = input.trim();
  if (!text) return null;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

/** Stylesheet URLs of an HTML page, resolved against `base`; Webflow's own files first. */
export function stylesheetLinks(html: string, base: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0];
    if (!/\brel\s*=\s*["']?[^"'>]*\bstylesheet\b/i.test(tag)) continue;
    const href = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag);
    const value = (href?.[1] ?? href?.[2] ?? href?.[3] ?? '').trim();
    if (!value) continue;
    try {
      const url = new URL(value.replace(/&amp;/g, '&'), base).href;
      if (!out.includes(url)) out.push(url);
    } catch {
      /* not a URL */
    }
  }
  const rank = (u: string) => (/website-files\.com|webflow/i.test(u) ? 0 : 1);
  return out.sort((a, b) => rank(a) - rank(b)).slice(0, MAX_SHEETS);
}

const blocked = (where: string) =>
  `Your browser could not read ${where}: the site does not allow other pages to read it (CORS). ` +
  'Open your published site, view the page source and copy the address of its stylesheet (the <link> ending in .css, usually on cdn.prod.website-files.com), then paste that address here. ' +
  'Or open the stylesheet, copy all the CSS and paste it below, or save it and upload the .css file.';

/** Fetches CSS from a page or stylesheet URL. Never rejects. */
export async function fetchSiteCss(input: string, fetchImpl: (url: string, init?: RequestInit) => Promise<Response> = (u, init) => fetch(u, init)):Promise<CssFetchResult> {
  const url = normalizeUrl(input);
  if (!url) return { ok: false, error: 'Enter the address of your published site (https://…) or of its .css file.' };
  const get = async (target: string): Promise<{ text: string; type: string } | { error: string }> => {
    try {
      const res = await fetchImpl(target, { credentials: 'omit' });
      if (!res.ok) return { error: `${new URL(target).host} answered ${res.status}. Check the address, or paste the CSS below.` };
      return { text: await res.text(), type: res.headers.get('content-type') ?? '' };
    } catch {
      return { error: blocked(new URL(target).host) };
    }
  };

  const first = await get(url.href);
  if ('error' in first) return { ok: false, error: first.error };
  const isCss = /text\/css/i.test(first.type) || /\.css$/i.test(url.pathname) || (!/<html|<head|<link/i.test(first.text) && /[.#]?[\w-]+\s*\{[^}]*:/.test(first.text));
  if (isCss) return { ok: true, css: first.text, urls: [url.href] };

  const links = stylesheetLinks(first.text, url.href);
  if (links.length === 0) return { ok: false, error: 'No stylesheet found on that page. Paste the address of the .css file, or paste the CSS below.' };
  const parts: string[] = [];
  const urls: string[] = [];
  for (const link of links) {
    const sheet = await get(link);
    if ('error' in sheet) {
      if (parts.length === 0 && link === links[0]) return { ok: false, error: sheet.error };
      continue;
    }
    parts.push(sheet.text);
    urls.push(link);
  }
  if (parts.length === 0) return { ok: false, error: blocked(new URL(links[0]!).host) };
  return { ok: true, css: parts.join('\n'), urls };
}
