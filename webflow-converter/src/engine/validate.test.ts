import { describe, expect, it } from 'vitest';
import { convert } from './index';
import { validateXscp } from './validate';
import type { WfElementNode, XscpData } from './types';

const sample = (): XscpData =>
  convert({
    mode: 'separate',
    html: '<div class="card is-active"><h2 class="card_title">Hi</h2><svg></svg></div><p>x</p>',
    css: '.card { padding: 1rem } .card.is-active { color: red } .card .x { margin: 0 }',
    js: 'go()',
  }).data;

describe('validateXscp', () => {
  it('accepts converter output', () => {
    expect(validateXscp(sample())).toEqual([]);
  });

  it('accepts the spec 6.2 / 6.3 example shapes', () => {
    const res = convert({ mode: 'combined', html: '<a class="cv-button is-secondary" id="cta-primary" data-track="hero-cta" href="https://example.com" target="_blank">Get started</a>' });
    expect(validateXscp(res.data)).toEqual([]);
    expect(res.data.payload.nodes[0]).toMatchObject({
      type: 'Link',
      data: { button: true, block: '', link: { mode: 'external', url: 'https://example.com', target: '_blank' }, attr: { id: 'cta-primary' } },
    });
  });

  it('detects a wrong type, duplicate ids, missing children/classes and extra roots', () => {
    const d = sample();
    (d as { type: string }).type = 'nope';
    const nodes = d.payload.nodes;
    nodes.push({ ...nodes[1]! }); // duplicate id, second root
    (nodes[0] as WfElementNode).children.push('missing-child');
    (nodes[0] as WfElementNode).classes.push('missing-class');
    const problems = validateXscp(d).join('\n');
    expect(problems).toContain('type must be');
    expect(problems).toContain('duplicate node id');
    expect(problems).toContain('child missing-child not found');
    expect(problems).toContain('class missing-class not found');
  });

  it('detects a broken combo chain', () => {
    const d = sample();
    for (const s of d.payload.styles) s.children = [];
    expect(validateXscp(d).some((p) => p.includes('does not list combo'))).toBe(true);
  });

  it('detects an embed whose v and meta.html differ', () => {
    const d = sample();
    const embed = d.payload.nodes.find((n) => 'type' in n && n.type === 'HtmlEmbed') as WfElementNode;
    embed.v = 'changed';
    expect(validateXscp(d).some((p) => p.includes('v must equal'))).toBe(true);
  });
});
