import { describe, expect, it } from 'vitest';
import { convert, validateXscp } from './index';
import { isTextNode, type WfElementNode } from './types';
import { classNames, elements, first, kids, style, textOf } from './testHelpers';

const html = (h: string) => {
  const res = convert({ mode: 'combined', html: h });
  expect(validateXscp(res.data)).toEqual([]);
  return res;
};

describe('tag mapping', () => {
  it.each(['div', 'header', 'footer', 'nav', 'main', 'article', 'aside', 'figure', 'address'])('<%s> -> Block', (tag) => {
    const res = html(`<${tag} class="x"><div></div></${tag}>`);
    const n = res.data.payload.nodes[0] as WfElementNode;
    expect(n).toMatchObject({ type: 'Block', tag, data: { tag, text: false } });
  });

  it('<section> -> native Section with grid type', () => {
    const res = html('<section class="hero"><div></div></section>');
    expect(res.data.payload.nodes[0]).toMatchObject({
      type: 'Section',
      tag: 'section',
      data: { tag: 'section', grid: { type: 'section' } },
    });
  });

  it('a div holding text becomes a Text Block', () => {
    const res = html('<div><div class="badge">New</div></div>');
    expect(first(res, 'Block', 'div').data!.text).toBe(false);
    const badge = elements(res).find((e) => e.data?.text === true)!;
    expect(textOf(res, badge)).toBe('New');
  });

  it.each([1, 2, 3, 4, 5, 6])('<h%i> -> Heading', (level) => {
    const res = html(`<h${level}>Title</h${level}>`);
    expect(res.data.payload.nodes[0]).toMatchObject({ type: 'Heading', tag: `h${level}`, data: { tag: `h${level}` } });
  });

  it('<p> -> Paragraph without data.tag', () => {
    const res = html('<p>Hi</p>');
    const p = res.data.payload.nodes[0] as WfElementNode;
    expect(p.type).toBe('Paragraph');
    expect(p.data?.tag).toBeUndefined();
  });

  it('inline formatting -> Strong / Emphasized / Span / Superscript / Subscript / LineBreak', () => {
    const res = html('<p>a <strong>b</strong> <b>c</b> <em>d</em> <i>e</i> <span class="hl">f</span> x<sup>2</sup> H<sub>2</sub>O<br>g</p>');
    const types = kids(res, first(res, 'Paragraph'))
      .filter((n) => !isTextNode(n))
      .map((n) => (n as WfElementNode).type);
    expect(types).toEqual(['Strong', 'Strong', 'Emphasized', 'Emphasized', 'Span', 'Superscript', 'Subscript', 'LineBreak']);
    expect(first(res, 'Strong').tag).toBe('strong');
    expect(first(res, 'Emphasized').tag).toBe('em');
    expect(first(res, 'Strong').data).toBeUndefined(); // spec 2.4: may omit data
    expect(first(res, 'LineBreak').children).toEqual([]);
  });

  it('lists -> List / ListItem', () => {
    const res = html('<ol class="steps"><li>One</li><li><a href="/x">Two</a></li></ol>');
    expect(res.data.payload.nodes[0]).toMatchObject({ type: 'List', tag: 'ol', data: { tag: 'ol', list: { type: 'list', unstyled: false } } });
    const items = elements(res).filter((e) => e.type === 'ListItem');
    expect(items).toHaveLength(2);
    expect(items[0]!.data).toMatchObject({ list: { type: 'item' }, text: true });
    expect(items[1]!.data!.text).toBeUndefined();
  });

  it('blockquote -> Blockquote', () => {
    const res = html('<blockquote>Quote</blockquote>');
    expect(res.data.payload.nodes[0]).toMatchObject({ type: 'Blockquote', tag: 'blockquote' });
  });

  it.each([
    ['<canvas id="scene" width="800" height="600" class="hero_canvas"></canvas>', 'canvas'],
    ['<video src="a.mp4" autoplay muted loop playsinline></video>', 'video'],
    ['<svg viewBox="0 0 24 24" width="24"><path d="M0 0h24v24H0z"/></svg>', 'svg'],
    ['<iframe src="https://www.youtube.com/embed/x"></iframe>', 'iframe'],
    ['<table><tbody><tr><td>1</td></tr></tbody></table>', 'table'],
  ])('%s -> HtmlEmbed of its outerHTML', (src, tag) => {
    const res = html(`<div>${src}</div>`);
    const embed = first(res, 'HtmlEmbed');
    expect(embed.v).toBe(embed.data!.embed!.meta.html);
    expect(embed.v!.startsWith(`<${tag}`)).toBe(true);
    expect(embed.data!.embed!.meta.iframe).toBe(tag === 'iframe');
    expect(res.warnings.some((w) => w.code === 'unsupported-element' && w.detail === tag)).toBe(true);
  });

  it('<form> -> HtmlEmbed of its outerHTML with forms: "embed"', () => {
    const res = convert({ mode: 'combined', html: '<div><form action="/s"><input name="email" type="email"><textarea></textarea></form></div>' }, { forms: 'embed' });
    expect(validateXscp(res.data)).toEqual([]);
    expect(first(res, 'HtmlEmbed').v).toBe('<form action="/s"><input name="email" type="email"><textarea></textarea></form>');
    expect(elements(res).some((e) => e.type.startsWith('Form'))).toBe(false);
  });

  it('keeps the canvas id, width and height in the embed', () => {
    const res = html('<div class="hero"><canvas id="webgl" width="1200" height="800"></canvas></div>');
    expect(first(res, 'HtmlEmbed').v).toBe('<canvas id="webgl" width="1200" height="800"></canvas>');
  });

  it('keeps <style> inside an inline svg with the svg', () => {
    const res = html('<div><svg><style>.st0{fill:red}</style><rect class="st0"/></svg></div>');
    expect(first(res, 'HtmlEmbed').v).toContain('<style>.st0{fill:red}</style>');
  });

  it('other elements -> DOM (Custom Element) with the real tag in data.tag', () => {
    const res = html('<p>Use <code class="kbd" data-x="1">npm i</code> <small>now</small></p>');
    const code = elements(res).find((e) => e.type === 'DOM' && e.data?.tag === 'code')!;
    expect(code.tag).toBe('div');
    expect(code.data!.attributes).toEqual([{ name: 'data-x', value: '1' }]);
    expect(classNames(res, code)).toEqual(['kbd']);
    expect(textOf(res, code)).toBe('npm i');
  });

  it('preserves whitespace in <pre>', () => {
    const res = html('<pre>line 1\n  line 2</pre>');
    expect(textOf(res, res.data.payload.nodes[0]!)).toBe('line 1\n  line 2');
  });
});

describe('attributes', () => {
  it('puts id in data.attr.id and custom attributes in data.xattr in order', () => {
    const res = html('<div id="hero" class="a" data-speed="0.5" aria-label="Hero" role="region" data-flag tabindex="0"></div>');
    const n = res.data.payload.nodes[0] as WfElementNode;
    expect(n.data!.attr).toEqual({ id: 'hero' });
    expect(n.data!.xattr).toEqual([
      { name: 'data-speed', value: '0.5' },
      { name: 'aria-label', value: 'Hero' },
      { name: 'role', value: 'region' },
      { name: 'data-flag', value: '' },
      { name: 'tabindex', value: '0' },
    ]);
  });

  it('never puts class or style into xattr', () => {
    const res = html('<div class="a" style="color: red"></div>');
    const n = res.data.payload.nodes[0] as WfElementNode;
    expect(n.data!.xattr).toEqual([]);
  });

  it('drops attribute names Webflow cannot hold (framework syntax) with a warning', () => {
    const res = html('<div @click="x" :class="y" x-data="{}"></div>');
    const n = res.data.payload.nodes[0] as WfElementNode;
    expect(n.data!.xattr).toEqual([{ name: 'x-data', value: '{}' }]);
    expect(res.warnings.filter((w) => w.message.includes('not a valid Webflow custom attribute'))).toHaveLength(2);
  });

  it('turns inline style="" into a generated class', () => {
    const res = html('<div class="card" style="padding: 1rem; color: red"></div>');
    const n = res.data.payload.nodes[0] as WfElementNode;
    expect(classNames(res, n)).toEqual(['card', 'inline-style-1']);
    expect(style(res, 'inline-style-1', '&').styleLess).toBe(
      'padding-top: 1rem; padding-right: 1rem; padding-bottom: 1rem; padding-left: 1rem; color: red;',
    );
  });

  it('does not reuse an existing class name for generated inline-style classes', () => {
    const res = html('<div class="inline-style-1"></div><div style="color: red"></div>');
    expect(res.data.payload.styles.map((s) => s.name)).toContain('inline-style-2');
  });

  it('moves <body> classes onto the root wrapper', () => {
    const res = html('<html><body class="theme-dark"><div class="a"></div></body></html>');
    const root = res.data.payload.nodes[0] as WfElementNode;
    expect(classNames(res, root)).toEqual(['theme-dark']);
  });
});

describe('text and whitespace', () => {
  it('collapses whitespace and trims at block boundaries', () => {
    const res = html('<h1>\n   Hello\n   <em>big</em>   world  \n</h1>');
    const parts = kids(res, first(res, 'Heading')).map((n) => (isTextNode(n) ? n.v : `<${(n as WfElementNode).tag}>`));
    expect(parts).toEqual(['Hello ', '<em>', ' world']);
  });

  it('keeps a single space between inline siblings and drops whitespace between blocks', () => {
    const res = html('<p><strong>a</strong> <em>b</em></p><div>\n  <div></div>\n  <div></div>\n</div>');
    const p = first(res, 'Paragraph');
    expect(kids(res, p).map((n) => (isTextNode(n) ? JSON.stringify(n.v) : (n as WfElementNode).type))).toEqual([
      'Strong',
      '" "',
      'Emphasized',
    ]);
    const outer = elements(res).find((e) => e.type === 'Block' && e.children.length === 2 && e !== res.data.payload.nodes[0])!;
    expect(kids(res, outer).every((n) => !isTextNode(n))).toBe(true);
  });

  it('decodes entities into plain Unicode text', () => {
    const res = html('<p>Tom &amp; Jerry &copy; &lt;3</p>');
    expect(textOf(res, first(res, 'Paragraph'))).toBe('Tom & Jerry © <3');
  });

  it('wraps loose top-level text in a Text Block', () => {
    const res = html('Just text');
    const block = first(res, 'Block');
    expect(block.data!.text).toBe(true);
    expect(textOf(res, block)).toBe('Just text');
  });
});

describe('links, buttons, images', () => {
  it('text link with url and target', () => {
    const res = html('<p><a href="https://x.com" target="_blank" rel="noopener" class="link">X</a></p>');
    const a = first(res, 'Link');
    expect(a.data).toMatchObject({
      button: false,
      block: '',
      link: { mode: 'external', url: 'https://x.com', target: '_blank' },
      xattr: [{ name: 'rel', value: 'noopener' }],
    });
    expect(a.data!.attr).toEqual({ id: '' });
  });

  it('link block when the link wraps elements', () => {
    const res = html('<a href="/post" class="card"><img src="https://x/y.png" alt=""><h3>T</h3></a>');
    expect(first(res, 'Link').data).toMatchObject({ button: false, block: 'inline', link: { url: '/post' } });
  });

  it('mailto, tel and #anchors stay external URLs; javascript: becomes #', () => {
    const urls = ['mailto:a@b.c', 'tel:+123', '#pricing', 'javascript:void(0)'].map((href) => {
      const res = html(`<a href="${href}">x</a>`);
      return (first(res, 'Link').data!.link as { url?: string }).url;
    });
    expect(urls).toEqual(['mailto:a@b.c', 'tel:+123', '#pricing', '#']);
  });

  it('#anchors to an element in the fragment become section links to its node id', () => {
    const res = html('<div><a href="#pricing">Go</a><section id="pricing">P</section></div>');
    const section = first(res, 'Section');
    expect(first(res, 'Link').data!.link).toEqual({ mode: 'section', domId: section._id });
  });

  it('a link without href has no url', () => {
    const res = html('<a class="x">x</a>');
    expect(first(res, 'Link').data!.link).toEqual({ mode: 'external' });
  });

  it('button-like links become Webflow Buttons', () => {
    for (const cls of ['btn', 'button', 'btn-primary', 'hero_button', 'cta-btn']) {
      const res = html(`<a href="#" class="${cls}">Go</a>`);
      expect(first(res, 'Link').data!.button).toBe(true);
    }
    const res = html('<a href="#" class="nav_link">Go</a>');
    expect(first(res, 'Link').data!.button).toBe(false);
  });

  it('<button> -> Link button with role=button, text preserved, type dropped', () => {
    const res = html('<button type="button" class="menu-toggle" aria-expanded="false" data-menu>Menu</button>');
    const b = first(res, 'Link');
    expect(b.tag).toBe('a');
    expect(b.data).toMatchObject({ button: true, block: '', link: { mode: 'external' } });
    expect(b.data!.xattr).toEqual([
      { name: 'aria-expanded', value: 'false' },
      { name: 'data-menu', value: '' },
      { name: 'role', value: 'button' },
      { name: 'data-wf-button', value: '' },
    ]);
    expect(textOf(res, b)).toBe('Menu');
    expect(classNames(res, b)).toEqual(['menu-toggle']);
  });

  it('<button> with element children becomes a Link Block', () => {
    const res = html('<button class="icon-btn"><svg width="16"></svg><span>Play</span></button>');
    expect(first(res, 'Link').data).toMatchObject({ button: false, block: 'inline' });
  });

  it('<img> -> Image with src/alt/loading/width/height in data.attr and no asset (externalImages: "image")', () => {
    const res = convert(
      { mode: 'combined', html: '<img src="https://cdn.x/a.png" alt="A" width="400" class="pic" data-parallax="0.2" srcset="a 1x">' },
      { externalImages: 'image' },
    );
    expect(validateXscp(res.data)).toEqual([]);
    const img = first(res, 'Image');
    expect(img.data!.attr).toEqual({ src: 'https://cdn.x/a.png', alt: 'A', loading: 'lazy', width: '400', height: 'auto', id: '' });
    expect(img.data!.img).toBeUndefined();
    expect(img.data!.xattr).toEqual([{ name: 'data-parallax', value: '0.2' }]);
    expect(res.data.payload.assets).toEqual([]);
    expect(res.warnings.some((w) => w.code === 'external-image')).toBe(true);
  });

  it('external <img> -> Custom Element <img> with every attribute verbatim (default)', () => {
    const src = 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=1000&q=85';
    const res = html(
      `<div><img loading="lazy" src="${src}" alt="Plante" width="400" height="300" class="pic is-round" srcset="${src}&dpr=2 2x" sizes="50vw" id="hero-img" data-x="1"></div>`,
    );
    expect(elements(res).some((e) => e.type === 'Image')).toBe(false);
    const img = elements(res).find((e) => e.type === 'DOM')!;
    // Same shape as other Custom Elements (e.g. <small>): node tag "div", real tag in data.tag.
    expect(img).toMatchObject({ type: 'DOM', tag: 'div', children: [], data: { tag: 'img', text: false, slot: '', visibility: { conditions: [] } } });
    expect(img.data!.attributes).toEqual([
      { name: 'id', value: 'hero-img' },
      { name: 'loading', value: 'lazy' },
      { name: 'src', value: src },
      { name: 'alt', value: 'Plante' },
      { name: 'width', value: '400' },
      { name: 'height', value: '300' },
      { name: 'srcset', value: `${src}&dpr=2 2x` },
      { name: 'sizes', value: '50vw' },
      { name: 'data-x', value: '1' },
    ]);
    expect(img.data!.xattr).toBeUndefined();
    expect(classNames(res, img)).toEqual(['pic', 'is-round']);
    expect(res.json).toContain(JSON.stringify(src)); // byte-identical, query string included
    expect(res.warnings.some((w) => w.code === 'external-image' && w.message.includes('Custom Elements'))).toBe(true);
  });

  it('the Custom Element <img> matches the shape the engine uses for <small>', () => {
    const res = html('<p><small class="s" data-a="1">x</small><img class="s" src="https://x.y/a.png" data-a="1"></p>');
    const [small, img] = elements(res).filter((e) => e.type === 'DOM');
    expect(Object.keys(img!).sort()).toEqual(Object.keys(small!).sort());
    expect(Object.keys(img!.data!).sort()).toEqual(Object.keys(small!.data!).sort());
    expect(img!.tag).toBe(small!.tag);
  });

  it('data: URIs and Webflow CDN URLs stay native Images', () => {
    const data = 'data:image/png;base64,iVBORw0KGgo=';
    const cdn = 'https://cdn.prod.website-files.com/64a/abc_photo.webp';
    const res = html(`<div><img src="${data}" class="a"><img src="${cdn}" alt="c"></div>`);
    const imgs = elements(res).filter((e) => e.type === 'Image');
    expect(imgs.map((i) => i.data!.attr!.src)).toEqual([data, cdn]);
    expect(classNames(res, imgs[0]!)).toEqual(['a']);
    expect(elements(res).some((e) => e.type === 'DOM')).toBe(false);
  });

  it('externalImages: "embed" keeps the <img> HTML in a Code Embed and its CSS in the style embed', () => {
    const res = convert(
      { mode: 'separate', html: '<div class="w"><img class="pic" src="https://x.y/a.png?v=1&s=2" alt="A"></div>', css: '.pic { width: 100% } .w { padding: 1px }', js: '' },
      { externalImages: 'embed' },
    );
    expect(validateXscp(res.data)).toEqual([]);
    const codes = elements(res).filter((e) => e.type === 'HtmlEmbed').map((e) => e.v!);
    expect(codes.some((c) => c.startsWith('<img class="pic" src="https://x.y/a.png?v=1&amp;s=2"'))).toBe(true);
    expect(res.data.payload.styles.some((s) => s.name === 'pic')).toBe(false);
    expect(codes.some((c) => c.includes('.pic {'))).toBe(true);
  });

  it('warns about relative image URLs', () => {
    const res = html('<img src="images/a.png">');
    expect(res.warnings.some((w) => w.code === 'external-image' && w.detail === 'images/a.png')).toBe(true);
  });
});

describe('root handling', () => {
  it('a single top-level element with no embeds is the root itself', () => {
    const res = html('<section class="hero"><h1>Hi</h1></section>');
    expect((res.data.payload.nodes[0] as WfElementNode).type).toBe('Section');
  });

  it('several top-level elements are wrapped in one root Block', () => {
    const res = html('<header></header><main></main><footer></footer>');
    const root = res.data.payload.nodes[0] as WfElementNode;
    expect(root).toMatchObject({ type: 'Block', tag: 'div', classes: [] });
    expect(kids(res, root).map((n) => (n as WfElementNode).tag)).toEqual(['header', 'main', 'footer']);
    expect(res.warnings.some((w) => w.code === 'multiple-roots-wrapped')).toBe(true);
  });

  it('a single element that needs embeds is wrapped so embeds do not become its flex/grid children', () => {
    const res = html('<style>.a .b{color:red}</style><div class="a"><div class="b"></div></div>');
    const root = res.data.payload.nodes[0] as WfElementNode;
    expect(root.classes).toEqual([]);
    expect(kids(res, root).map((n) => (n as WfElementNode).type)).toEqual(['HtmlEmbed', 'Block']);
  });
});
