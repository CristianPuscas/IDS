import { describe, expect, it } from 'vitest';
import { IDEAL_SYSTEM_PROMPT } from './prompt';

describe('IDEAL_SYSTEM_PROMPT', () => {
  it('asks for Client-First v2 conventions', () => {
    for (const s of [
      'Client-First v2',
      'page-wrapper > main-wrapper (<main>) > section_[name] (<section>) > padding-global > container-[small|medium|large] > padding-section-[small|medium|large]',
      'folder_element',
      '[folder]_component',
      'Utility classes have hyphens only',
      'heading-style-h1 to h6',
      'text-size-*',
      'max-width-*',
      'At most ONE utility class per element',
      'only "is-" modifiers on a custom class',
      'max-width 48 / 64 / 80rem',
      '1rem = 16px',
      '--text-color--primary',
      'var(--text-color--primary)',
      'No CSS reset and no Global Styles embed',
      'class prefix option',
    ]) {
      expect(IDEAL_SYSTEM_PROMPT, s).toContain(s);
    }
  });

  it('keeps the converter rules', () => {
    for (const s of [
      'ONE complete HTML file',
      'ONE <style> block',
      'Vanilla HTML, CSS and JS only',
      'Class selectors only',
      'States only on the class itself',
      '@media (max-width: 991px)',
      '@media (max-width: 767px)',
      '@media (max-width: 479px)',
      'Semantic tags',
      'meaningful alt',
      'exact pinned version',
      'data attributes',
      'novalidate',
      '40,000 characters',
      '# Before you answer',
    ]) {
      expect(IDEAL_SYSTEM_PROMPT, s).toContain(s);
    }
  });

  it('asks for rem units with px only for radius and border/outline/stroke widths', () => {
    for (const s of [
      'base 16px',
      'rem (base 16px: 1rem = 16px) for every length',
      'px only for border-radius and for border, outline and stroke widths',
      'Keep as is: 0 (no unit), % for fluid widths, em',
      'unitless line-height',
      'px in the media query breakpoints',
    ]) {
      expect(IDEAL_SYSTEM_PROMPT, s).toContain(s);
    }
    expect(IDEAL_SYSTEM_PROMPT).not.toContain('px only for 1px borders');
  });

  it('describes the inline CSS variables (v8): var() resolved, variables scoped on the wrapper', () => {
    expect(IDEAL_SYSTEM_PROMPT).toContain('resolves var() to values in native classes and scopes the variables on the pasted wrapper');
    expect(IDEAL_SYSTEM_PROMPT).not.toContain('keeps var() in native classes');
  });

  it('stays short enough to paste', () => {
    expect(IDEAL_SYSTEM_PROMPT.split(/\s+/).length).toBeLessThanOrEqual(1150);
  });
});
