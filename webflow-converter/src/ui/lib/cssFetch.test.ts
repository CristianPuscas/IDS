import { describe, expect, it } from 'vitest';
import { fetchSiteCss, normalizeUrl, stylesheetLinks } from './cssFetch';

type Route = { body: string; type?: string; status?: number } | 'cors';

/** `fetch` stand-in: a route table; `'cors'` rejects like a blocked cross-origin request. */
const fakeFetch = (routes: Record<string, Route>) => {
  const calls: string[] = [];
  const impl = async (url: string) => {
    calls.push(url);
    const r = routes[url];
    if (!r || r === 'cors') throw new TypeError('Failed to fetch');
    return new Response(r.body, { status: r.status ?? 200, headers: { 'content-type': r.type ?? 'text/html' } });
  };
  return { impl, calls };
};

describe('fetchSiteCss', () => {
  it('normalises addresses', () => {
    expect(normalizeUrl('my-site.webflow.io')?.href).toBe('https://my-site.webflow.io/');
    expect(normalizeUrl('http://x.com/a.css')?.href).toBe('http://x.com/a.css');
    expect(normalizeUrl('ftp://x.com')).toBeNull();
    expect(normalizeUrl('  ')).toBeNull();
  });

  it('finds stylesheet links, Webflow\'s first', () => {
    const html = `<head><link rel="preconnect" href="https://fonts.gstatic.com"><link href="/local.css" rel="stylesheet"><link rel='stylesheet' type='text/css' href='https://cdn.prod.website-files.com/abc/css/site.webflow.shared.123.css'></head>`;
    expect(stylesheetLinks(html, 'https://site.io/page')).toEqual(['https://cdn.prod.website-files.com/abc/css/site.webflow.shared.123.css', 'https://site.io/local.css']);
  });

  it('fetches a stylesheet URL directly', async () => {
    const { impl } = fakeFetch({ 'https://cdn.example.com/site.css': { body: '.a { color: red }', type: 'text/css' } });
    expect(await fetchSiteCss('https://cdn.example.com/site.css', impl)).toEqual({ ok: true, css: '.a { color: red }', urls: ['https://cdn.example.com/site.css'] });
  });

  it('fetches the stylesheets a page links to', async () => {
    const sheet = 'https://cdn.prod.website-files.com/abc/css/site.webflow.css';
    const { impl, calls } = fakeFetch({
      'https://site.webflow.io/': { body: `<html><head><link rel="stylesheet" href="${sheet}"></head></html>` },
      [sheet]: { body: '.padding-global { padding-left: 2.5rem }', type: 'text/css' },
    });
    const res = await fetchSiteCss('site.webflow.io', impl);
    expect(res).toEqual({ ok: true, css: '.padding-global { padding-left: 2.5rem }', urls: [sheet] });
    expect(calls).toEqual(['https://site.webflow.io/', sheet]);
  });

  it('explains a CORS failure and how to paste or upload the CSS instead', async () => {
    const { impl } = fakeFetch({ 'https://site.webflow.io/': 'cors' });
    const res = await fetchSiteCss('https://site.webflow.io', impl);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toMatch(/CORS/);
    expect(res.error).toMatch(/paste/);
    expect(res.error).toMatch(/upload the \.css file/);
  });

  it('reports HTTP errors, pages without stylesheets and bad addresses', async () => {
    const { impl } = fakeFetch({
      'https://a.io/missing.css': { body: '', status: 404 },
      'https://a.io/': { body: '<html><head></head></html>' },
    });
    expect(await fetchSiteCss('https://a.io/missing.css', impl)).toEqual({ ok: false, error: expect.stringMatching(/404/) });
    expect(await fetchSiteCss('https://a.io/', impl)).toEqual({ ok: false, error: expect.stringMatching(/No stylesheet/) });
    expect(await fetchSiteCss('', impl)).toEqual({ ok: false, error: expect.stringMatching(/address/) });
  });
});
