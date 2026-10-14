import { describe, expect, it } from 'vitest';
import { mediaToBands } from './media';

const bands = (q: string[], tol = 20, large = false): string[] | string => {
  const m = mediaToBands(q, tol, large);
  return m.kind === 'bands' ? m.bands : m.kind;
};

describe('mediaToBands: max-width (desktop-first)', () => {
  it('maps the exact Webflow breakpoints', () => {
    expect(bands(['(max-width: 991px)'])).toEqual(['tiny', 'small', 'medium']);
    expect(bands(['(max-width: 767px)'])).toEqual(['tiny', 'small']);
    expect(bands(['(max-width: 479px)'])).toEqual(['tiny']);
  });

  it('maps common AI breakpoints within the tolerance', () => {
    expect(bands(['(max-width: 1000px)'])).toEqual(['tiny', 'small', 'medium']);
    expect(bands(['(max-width: 768px)'])).toEqual(['tiny', 'small']);
    expect(bands(['(max-width: 480px)'])).toEqual(['tiny']);
    expect(bands(['screen and (max-width: 767px)'])).toEqual(['tiny', 'small']);
    expect(bands(['only screen and (max-width:767px)'])).toEqual(['tiny', 'small']);
  });

  it('applies the tolerance inclusively at the edges', () => {
    expect(bands(['(max-width: 1011px)'])).toEqual(['tiny', 'small', 'medium']); // 991 + 20
    expect(bands(['(max-width: 1012px)'])).toBe('unmatched'); // 991 + 21
    expect(bands(['(max-width: 971px)'])).toEqual(['tiny', 'small', 'medium']); // 991 - 20
    expect(bands(['(max-width: 970px)'])).toBe('unmatched');
    expect(bands(['(max-width: 459px)'])).toEqual(['tiny']); // 479 - 20
    expect(bands(['(max-width: 458px)'])).toBe('unmatched');
    expect(bands(['(max-width: 1024px)'])).toBe('unmatched');
    expect(bands(['(max-width: 1024px)'], 40)).toEqual(['tiny', 'small', 'medium']);
    expect(bands(['(max-width: 768px)'], 0)).toBe('unmatched');
  });

  it('understands em/rem and range syntax', () => {
    expect(bands(['(max-width: 48em)'])).toEqual(['tiny', 'small']); // 768px
    expect(bands(['(width < 992px)'])).toEqual(['tiny', 'small', 'medium']);
    expect(bands(['(width <= 767px)'])).toEqual(['tiny', 'small']);
    expect(bands(['(width >= 768px)'])).toEqual(['medium', 'main']);
  });
});

describe('mediaToBands: min-width (mobile-first)', () => {
  it('maps band starts', () => {
    expect(bands(['(min-width: 992px)'])).toEqual(['main']);
    expect(bands(['(min-width: 768px)'])).toEqual(['medium', 'main']);
    expect(bands(['(min-width: 480px)'])).toEqual(['small', 'medium', 'main']);
    expect(bands(['(min-width: 1024px)'])).toBe('unmatched');
  });

  it('treats 1280/1440/1920 as large breakpoints, only when enabled', () => {
    expect(bands(['(min-width: 1280px)'])).toBe('large');
    expect(bands(['(min-width: 1280px)'], 20, true)).toEqual(['large', 'xl', 'xxl']);
    expect(bands(['(min-width: 1440px)'], 20, true)).toEqual(['xl', 'xxl']);
    expect(bands(['(min-width: 992px)'], 20, true)).toEqual(['main', 'large', 'xl', 'xxl']);
  });

  it('intersects ranges and nested queries', () => {
    expect(bands(['(min-width: 768px) and (max-width: 991px)'])).toEqual(['medium']);
    expect(bands(['screen', '(max-width: 767px)'])).toEqual(['tiny', 'small']);
  });
});

describe('mediaToBands: unmatched', () => {
  it.each([
    '(prefers-reduced-motion: reduce)',
    '(hover: hover)',
    '(orientation: landscape)',
    'print',
    '(max-width: 600px), print',
    '(max-width: 600px)',
  ])('%s', (q) => {
    expect(bands([q])).toBe('unmatched');
  });
});
