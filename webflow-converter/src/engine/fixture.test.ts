import { describe, expect, it } from 'vitest';
import { convert, validateXscp } from './index';
import { isTextNode, type ConvertResult, type WfElementNode, type WfNode } from './types';
import { elements, embedCodes, embeddedCss, first, style } from './testHelpers';

/** A typical AI-generated landing page: nav with hover, hero with a Three.js canvas, card grid, GSAP. */
const LANDING = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nebula — Ship faster</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0b0b12;
      --text: #f5f5f7;
      --accent: #7c5cff;
      --radius: 16px;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: var(--bg); color: var(--text); font-family: 'Inter', sans-serif; }

    /* Navigation */
    .nav { position: fixed; top: 0; left: 0; right: 0; display: flex; justify-content: space-between; align-items: center; padding: 1.5rem 5%; z-index: 10; }
    .nav_logo { font-weight: 800; font-size: 1.25rem; color: var(--text); text-decoration: none; }
    .nav_menu { display: flex; gap: 2rem; list-style: none; }
    .nav_link { color: rgba(245, 245, 247, 0.7); text-decoration: none; transition: color 0.2s ease; }
    .nav_link:hover { color: var(--text); }
    .nav_link.is-active { color: var(--accent); }

    /* Hero */
    .hero { position: relative; min-height: 100vh; display: flex; align-items: center; padding: 0 5%; overflow: hidden; }
    .hero_canvas { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 0; }
    .hero_content { position: relative; z-index: 1; max-width: 40rem; }
    .hero_title { font-size: 4.5rem; line-height: 1.05; letter-spacing: -0.03em; }
    .hero_title span { background: linear-gradient(90deg, var(--accent), #00d4ff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .hero_text { margin-top: 1.5rem; font-size: 1.125rem; opacity: 0.8; }
    .button { display: inline-block; margin-top: 2rem; padding: 0.875rem 1.75rem; border-radius: 999px; background-color: var(--accent); color: #fff; font-weight: 600; text-decoration: none; transition: transform 0.2s ease, box-shadow 0.2s ease; }
    .button:hover { transform: translateY(-2px); box-shadow: 0 10px 30px rgba(124, 92, 255, 0.4); }
    .button.is-ghost { background-color: transparent; border: 1px solid rgba(255, 255, 255, 0.2); }

    /* Features */
    .features { padding: 8rem 5%; }
    .features_grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1.5rem; }
    .card { padding: 2rem; border-radius: var(--radius); background-color: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.08); transition: transform 0.3s ease; }
    .card:hover { transform: translateY(-4px); }
    .card::before { content: ""; position: absolute; inset: 0; }
    .card_icon { width: 3rem; height: 3rem; }
    .card_title { margin-top: 1rem; font-size: 1.25rem; }
    .card_text { margin-top: 0.5rem; opacity: 0.7; }
    .features_grid .card:nth-child(2) { border-color: var(--accent); }

    @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }

    @media (max-width: 991px) {
      .hero_title { font-size: 3.5rem; }
      .features_grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (max-width: 767px) {
      .nav_menu { display: none; }
      .features_grid { grid-template-columns: 1fr; }
      .button:hover { transform: none; }
    }
    @media (max-width: 479px) {
      .hero_title { font-size: 2.5rem; }
    }
    @media (prefers-reduced-motion: reduce) {
      .card { transition: none; }
    }
  </style>
</head>
<body>
  <nav class="nav">
    <a href="#" class="nav_logo">Nebula</a>
    <ul class="nav_menu">
      <li><a href="#features" class="nav_link is-active">Features</a></li>
      <li><a href="#pricing" class="nav_link">Pricing</a></li>
    </ul>
  </nav>

  <section class="hero" id="top">
    <canvas id="hero-canvas" class="hero_canvas" width="1440" height="900"></canvas>
    <div class="hero_content" data-animate="fade-up">
      <h1 class="hero_title">Ship <span>faster</span> than light</h1>
      <p class="hero_text">Nebula turns your ideas into production apps in minutes.</p>
      <a href="#features" class="button">Get started</a>
      <a href="https://github.com" class="button is-ghost" target="_blank">GitHub</a>
    </div>
  </section>

  <section class="features" id="features">
    <div class="features_grid">
      <div class="card" data-animate="card">
        <svg class="card_icon" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5z"/></svg>
        <h3 class="card_title">Instant deploys</h3>
        <p class="card_text">Push to main and you are live.</p>
      </div>
      <div class="card" data-animate="card">
        <h3 class="card_title">Edge network</h3>
        <p class="card_text">Served from 300+ cities.</p>
      </div>
      <div class="card" data-animate="card">
        <h3 class="card_title">Analytics</h3>
        <p class="card_text">Know what <strong>matters</strong>.</p>
      </div>
    </div>
  </section>

  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"></script>
  <script>
    const canvas = document.getElementById('hero-canvas');
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 1000);
    function animate() { requestAnimationFrame(animate); renderer.render(scene, camera); }
    animate();
  </script>
  <script>
    gsap.registerPlugin(ScrollTrigger);
    gsap.from('[data-animate="card"]', { y: 40, opacity: 0, stagger: 0.1, scrollTrigger: { trigger: '.features_grid' } });
  </script>
</body>
</html>`;

/** Compact structural outline: `Type<tag>.class.combo "text"`, indented by depth. */
function outline(res: ConvertResult): string {
  const map = new Map(res.data.payload.nodes.map((n) => [n._id, n]));
  const name = (id: string): string => res.data.payload.styles.find((s) => s._id === id)!.name;
  const lines: string[] = [];
  const walk = (n: WfNode, depth: number): void => {
    const pad = '  '.repeat(depth);
    if (isTextNode(n)) {
      lines.push(`${pad}"${n.v}"`);
      return;
    }
    const e = n as WfElementNode;
    const tag = e.type === 'DOM' ? e.data?.tag : e.tag;
    const cls = e.classes.map((c) => `.${name(c)}`).join('');
    const extra =
      e.type === 'HtmlEmbed'
        ? ` [${(e.v ?? '').slice(0, 30).replace(/\n/g, ' ')}…]`
        : e.type === 'Link'
          ? ` {button:${e.data?.button}, block:"${e.data?.block}"}`
          : '';
    lines.push(`${pad}${e.type}<${tag}>${cls}${extra}`);
    for (const c of e.children) walk(map.get(c)!, depth + 1);
  };
  walk(res.data.payload.nodes[0]!, 0);
  return lines.join('\n');
}

describe('AI-generated landing page fixture', () => {
  const res = convert({ mode: 'combined', html: LANDING });

  it('passes structural validation', () => {
    expect(validateXscp(res.data)).toEqual([]);
    expect(JSON.parse(res.json)).toEqual(res.data);
    expect(res.json.startsWith('{"type":"@webflow/XscpData"')).toBe(true);
  });

  it('has the expected element structure', () => {
    expect(outline(res)).toMatchInlineSnapshot(`
      "Block<div>
        HtmlEmbed<div> [<link href="https://fonts.goog…]
        HtmlEmbed<div> [<style> :root {   --bg: #0b0b1…]
        Block<nav>.nav
          Link<a>.nav_logo {button:false, block:""}
            "Nebula"
          List<ul>.nav_menu
            ListItem<li>
              Link<a>.nav_link.is-active {button:false, block:""}
                "Features"
            ListItem<li>
              Link<a>.nav_link {button:false, block:""}
                "Pricing"
        Section<section>.hero
          Block<div>.hero_canvas-embed
            HtmlEmbed<div> [<canvas id="hero-canvas" class…]
          Block<div>.hero_content
            Heading<h1>.hero_title
              "Ship "
              Span<span>
                "faster"
              " than light"
            Paragraph<p>.hero_text
              "Nebula turns your ideas into production apps in minutes."
            Link<a>.button {button:true, block:""}
              "Get started"
            Link<a>.button.is-ghost {button:true, block:""}
              "GitHub"
        Section<section>.features
          Block<div>.features_grid
            Block<div>.card
              HtmlEmbed<div> [<svg class="card_icon" viewBox…]
              Heading<h3>.card_title
                "Instant deploys"
              Paragraph<p>.card_text
                "Push to main and you are live."
            Block<div>.card
              Heading<h3>.card_title
                "Edge network"
              Paragraph<p>.card_text
                "Served from 300+ cities."
            Block<div>.card
              Heading<h3>.card_title
                "Analytics"
              Paragraph<p>.card_text
                "Know what "
                Strong<strong>
                  "matters"
                "."
        HtmlEmbed<div> [<script src="https://cdnjs.clo…]"
    `);
  });

  it('maps the nav with hover state and combo class natively', () => {
    const link = style(res, 'nav_link');
    expect(link.styleLess).toBe(
      'color: rgba(245, 245, 247, 0.7); text-decoration: none; transition-property: color; transition-duration: 0.2s; transition-timing-function: ease;',
    );
    expect(link.variants).toEqual({ main_hover: { styleLess: 'color: @raw<|var(--text)|>;' } });
    expect(style(res, 'is-active', '&').styleLess).toBe('color: @raw<|var(--accent)|>;');
    expect(style(res, 'nav_menu').variants).toEqual({ small: { styleLess: 'display: none;' } });
  });

  it('maps the card grid with breakpoints and hover', () => {
    const grid = style(res, 'features_grid');
    expect(grid.styleLess).toBe('display: grid; grid-template-columns: 1fr 1fr 1fr; grid-row-gap: 1.5rem; grid-column-gap: 1.5rem;');
    expect(grid.variants).toEqual({
      medium: { styleLess: 'grid-template-columns: 1fr 1fr;' },
      small: { styleLess: 'grid-template-columns: 1fr;' },
    });
    expect(style(res, 'card').variants).toEqual({ main_hover: { styleLess: 'transform: translateY(-4px);' } });
    expect(style(res, 'hero_title').variants).toEqual({
      medium: { styleLess: 'font-size: 3.5rem;' },
      tiny: { styleLess: 'font-size: 2.5rem;' },
    });
    const button = style(res, 'button');
    expect(button.variants).toMatchObject({ main_hover: {}, small_hover: { styleLess: 'transform: none;' } });
    expect(button.children).toEqual([style(res, 'is-ghost', '&')._id]);
  });

  it('keeps the canvas (with id/size) and the svg in embeds', () => {
    const codes = embedCodes(res);
    expect(codes).toContain(
      '<canvas id="hero-canvas" class="hero_canvas" width="1440" height="900" style="position: static; display: block; width: 100%; height: 100%;"></canvas>',
    );
    expect(codes.some((c) => c.startsWith('<svg class="card_icon"'))).toBe(true);
    expect(first(res, 'Section').data!.attr!.id).toBe('top');
  });

  it('moves the Three.js canvas layout (absolute, inset 0, 100%) onto a classed wrapper Block', () => {
    const wrap = style(res, 'hero_canvas-embed');
    expect(wrap.styleLess).toBe(
      'display: grid; position: absolute; top: 0; right: 0; bottom: 0; left: 0; width: 100%; height: 100%; z-index: 0;',
    );
    const block = elements(res).find((e) => e.classes[0] === wrap._id)!;
    expect(block.type).toBe('Block');
    expect(block.children).toHaveLength(1);
    // The canvas rule itself stays in the <style> embed for the inner element.
    expect(embeddedCss(res)).toContain('.hero_canvas {');
  });

  it('routes everything non-native to one <style> embed in source order', () => {
    const css = embeddedCss(res);
    for (const s of [
      ':root {',
      '* {',
      'body {',
      '.hero_canvas {',
      '.hero_title span {',
      '.card::before {',
      '.card_icon {',
      '.features_grid .card:nth-child(2) {',
      '@keyframes float',
      '@media (prefers-reduced-motion: reduce)',
    ]) {
      expect(css).toContain(s);
    }
    expect(css.indexOf(':root')).toBeLessThan(css.indexOf('@keyframes float'));
    expect(res.data.payload.styles.some((s) => s.name === 'hero_canvas' || s.name === 'card_icon')).toBe(false);
  });

  it('puts Three.js and GSAP before the inline code, in one script embed at the end', () => {
    const root = res.data.payload.nodes[0] as WfElementNode;
    const lastEmbed = res.data.payload.nodes.find((n) => n._id === root.children[root.children.length - 1]) as WfElementNode;
    const js = lastEmbed.v!;
    const order = ['three.min.js', 'gsap.min.js', 'ScrollTrigger.min.js', 'new THREE.WebGLRenderer', 'gsap.registerPlugin'].map((s) =>
      js.indexOf(s),
    );
    expect(order.every((p) => p >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(lastEmbed.data!.embed!.meta.script).toBe(true);
  });

  it('fills stats consistently', () => {
    const nodes = res.data.payload.nodes;
    expect(res.stats.nodes).toBe(nodes.length);
    expect(res.stats.styles).toBe(res.data.payload.styles.length);
    expect(res.stats.embeds).toBe(nodes.filter((n) => !isTextNode(n) && n.type === 'HtmlEmbed').length);
    expect(res.stats.embeddedCssRules).toBeGreaterThanOrEqual(8);
    expect(res.stats.jsBytes).toBeGreaterThan(300);
  });

  it('references only existing styles and uses unique UUID ids', () => {
    const ids = [...res.data.payload.nodes.map((n) => n._id), ...res.data.payload.styles.map((s) => s._id)];
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});
