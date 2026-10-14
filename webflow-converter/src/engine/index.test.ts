import { describe, expect, it } from 'vitest';
import { convert, validateXscp, XSCP_TYPE } from './index';

describe('convert (contract smoke test)', () => {
  it('returns a structurally valid XscpData payload', () => {
    const res = convert({
      mode: 'separate',
      html: '<div class="card"><h2 class="card_title">Hello</h2></div>',
      css: '.card { padding: 2rem; }',
      js: 'console.log("hi");',
    });
    expect(res.data.type).toBe(XSCP_TYPE);
    expect(res.json.startsWith('{')).toBe(true);
    expect(JSON.parse(res.json)).toEqual(res.data);
    expect(validateXscp(res.data)).toEqual([]);
    expect(res.stats.nodes).toBe(res.data.payload.nodes.length);
    expect(res.stats.styles).toBe(res.data.payload.styles.length);
    expect(res.stats.jsBytes).toBeGreaterThan(0);
  });

  it('warns on empty input and still returns a valid payload', () => {
    const res = convert({ mode: 'combined', html: '   ' });
    expect(res.warnings.some((w) => w.code === 'empty-input')).toBe(true);
    expect(validateXscp(res.data)).toEqual([]);
  });
});
