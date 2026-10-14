import { describe, expect, it } from 'vitest';
import { expandRepeat, expandShorthand, prepareDeclaration } from './cssValues';

const exp = (p: string, v: string): string =>
  expandShorthand(p, v)
    .map((d) => `${d.property}: ${d.value}`)
    .join('; ');

describe('expandShorthand', () => {
  it('expands margin/padding with 1–4 values', () => {
    expect(exp('padding', '1rem')).toBe('padding-top: 1rem; padding-right: 1rem; padding-bottom: 1rem; padding-left: 1rem');
    expect(exp('margin', '0 auto')).toBe('margin-top: 0; margin-right: auto; margin-bottom: 0; margin-left: auto');
    expect(exp('padding', '1px 2px 3px')).toBe('padding-top: 1px; padding-right: 2px; padding-bottom: 3px; padding-left: 2px');
    expect(exp('margin', '1px 2px 3px 4px')).toBe('margin-top: 1px; margin-right: 2px; margin-bottom: 3px; margin-left: 4px');
    expect(exp('padding', 'clamp(1rem, 2vw, 2rem) 5%')).toBe(
      'padding-top: clamp(1rem, 2vw, 2rem); padding-right: 5%; padding-bottom: clamp(1rem, 2vw, 2rem); padding-left: 5%',
    );
  });

  it('expands logical margin/padding and inset', () => {
    expect(exp('padding-inline', '2rem')).toBe('padding-left: 2rem; padding-right: 2rem');
    expect(exp('margin-block', '1rem 2rem')).toBe('margin-top: 1rem; margin-bottom: 2rem');
    expect(exp('inset', '0')).toBe('top: 0; right: 0; bottom: 0; left: 0');
  });

  it('expands border-radius to four corners, including elliptical radii', () => {
    expect(exp('border-radius', '8px')).toBe(
      'border-top-left-radius: 8px; border-top-right-radius: 8px; border-bottom-right-radius: 8px; border-bottom-left-radius: 8px',
    );
    expect(exp('border-radius', '10px 20px / 5px')).toBe(
      'border-top-left-radius: 10px 5px; border-top-right-radius: 20px 5px; border-bottom-right-radius: 10px 5px; border-bottom-left-radius: 20px 5px',
    );
  });

  it('expands border into per-side width/style/color', () => {
    expect(exp('border', '1px solid rgba(0, 0, 0, 0.1)')).toContain('border-left-color: rgba(0, 0, 0, 0.1)');
    expect(expandShorthand('border', '1px solid #eee')).toHaveLength(12);
    expect(exp('border-bottom', '2px dashed red')).toBe(
      'border-bottom-width: 2px; border-bottom-style: dashed; border-bottom-color: red',
    );
    expect(exp('border', 'none')).toBe(
      'border-top-style: none; border-right-style: none; border-bottom-style: none; border-left-style: none',
    );
    expect(exp('border-color', 'red blue')).toBe(
      'border-top-color: red; border-right-color: blue; border-bottom-color: red; border-left-color: blue',
    );
  });

  it('maps gap to grid-row-gap / grid-column-gap', () => {
    expect(exp('gap', '1rem 2rem')).toBe('grid-row-gap: 1rem; grid-column-gap: 2rem');
    expect(exp('gap', '1rem')).toBe('grid-row-gap: 1rem; grid-column-gap: 1rem');
    expect(exp('column-gap', '3rem')).toBe('grid-column-gap: 3rem');
  });

  it('expands transition lists', () => {
    expect(exp('transition', 'opacity .3s ease, transform 300ms cubic-bezier(0.2, 0, 0, 1)')).toBe(
      'transition-property: opacity, transform; transition-duration: .3s, 300ms; transition-timing-function: ease, cubic-bezier(0.2, 0, 0, 1)',
    );
    expect(exp('transition', 'all 0.2s ease-in 0.1s')).toContain('transition-delay: 0.1s');
  });

  it('splits simple background shorthands and passes complex ones through', () => {
    expect(exp('background', '#000')).toBe('background-color: #000');
    expect(exp('background', 'linear-gradient(90deg, red, blue)')).toBe('background-image: linear-gradient(90deg, red, blue)');
    expect(exp('background', 'url(x.png) center / cover no-repeat')).toBe('background: url(x.png) center / cover no-repeat');
  });

  it('passes box-shadow, flex and grid-area through as strings', () => {
    expect(exp('box-shadow', '0 10px 30px rgba(0,0,0,.2)')).toBe('box-shadow: 0 10px 30px rgba(0,0,0,.2)');
    expect(exp('flex', '1 1 0%')).toBe('flex: 1 1 0%');
    expect(exp('grid-area', '1 / 1 / 2 / 3')).toBe('grid-area: 1 / 1 / 2 / 3');
  });
});

describe('expandRepeat', () => {
  it('expands integer repeat() and minmax(0, Nfr)', () => {
    expect(expandRepeat('repeat(3, 1fr)')).toBe('1fr 1fr 1fr');
    expect(expandRepeat('repeat(2, minmax(0, 1fr))')).toBe('1fr 1fr');
    expect(expandRepeat('200px repeat(2, 1fr)')).toBe('200px 1fr 1fr');
    expect(expandRepeat('repeat(auto-fit, minmax(240px, 1fr))')).toBe('repeat(auto-fit, minmax(240px, 1fr))');
  });
});

describe('prepareDeclaration', () => {
  it('wraps var() values in @raw', () => {
    expect(prepareDeclaration({ property: 'color', value: 'var(--accent)', important: false })).toEqual({
      kind: 'native',
      decls: [{ property: 'color', value: '@raw<|var(--accent)|>' }],
    });
  });

  it.each([
    [{ property: '--x', value: '1', important: false }, 'css-variable'],
    [{ property: '-webkit-backdrop-filter', value: 'blur(4px)', important: false }, 'vendor-prefix'],
    [{ property: 'display', value: '-webkit-box', important: false }, 'vendor-prefix'],
    [{ property: 'color', value: 'red', important: true }, 'important-dropped'],
  ])('routes %o to the embed (%s)', (decl, code) => {
    const r = prepareDeclaration(decl);
    expect(r.kind).toBe('embed');
    if (r.kind === 'embed') expect(r.code).toBe(code);
  });
});
