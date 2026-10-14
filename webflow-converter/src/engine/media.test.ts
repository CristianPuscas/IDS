import { describe, expect, it } from 'vitest';
import { mediaToBands, snapMediaStack } from './media';

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

describe('mediaToBands: breakpointSnap "up" (F2)', () => {
  const snap = (q: string[]) => mediaToBands(q, 20, false, 'up');

  it('snaps an off-grid max-width up to the smallest Webflow breakpoint that contains it', () => {
    expect(snap(['(max-width:850px)'])).toEqual({ kind: 'bands', bands: ['tiny', 'small', 'medium'], snapped: [{ px: 850, band: 'medium' }] });
    expect(snap(['(max-width:640px)'])).toEqual({ kind: 'bands', bands: ['tiny', 'small'], snapped: [{ px: 640, band: 'small' }] });
    expect(snap(['(max-width: 400px)'])).toMatchObject({ bands: ['tiny'], snapped: [{ px: 400, band: 'tiny' }] });
    expect(snap(['(max-width: 40em)'])).toMatchObject({ bands: ['tiny', 'small'] }); // 640px
  });

  it('leaves near-breakpoint queries unsnapped and wide ones unmatched', () => {
    expect(snap(['(max-width: 767px)'])).toEqual({ kind: 'bands', bands: ['tiny', 'small'] });
    expect(snap(['(max-width: 1200px)']).kind).toBe('unmatched');
    expect(snap(['(max-width: 1024px)']).kind).toBe('unmatched');
    expect(snap(['(prefers-reduced-motion: reduce)']).kind).toBe('unmatched');
  });

  it('"off" (the function default) keeps the old behaviour', () => {
    expect(bands(['(max-width: 850px)'])).toBe('unmatched');
    expect(mediaToBands(['(max-width: 640px)'], 20, false, 'off').kind).toBe('unmatched');
  });

  it('snapMediaStack rewrites only the snapped conditions', () => {
    expect(snapMediaStack(['(max-width:850px)'], 20, false)).toEqual(['(max-width: 991px)']);
    expect(snapMediaStack(['screen and (max-width: 640px)'], 20, false)).toEqual(['screen and (max-width: 767px)']);
    expect(snapMediaStack(['(min-width: 768px) and (max-width: 850px)'], 20, false)).toEqual(['(min-width: 768px) and (max-width: 991px)']);
    expect(snapMediaStack(['(max-width: 767px)'], 20, false)).toEqual(['(max-width: 767px)']);
  });
});
