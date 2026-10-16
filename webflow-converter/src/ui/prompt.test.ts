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

  it('stays short enough to paste', () => {
    expect(IDEAL_SYSTEM_PROMPT.split(/\s+/).length).toBeLessThanOrEqual(1150);
  });
});
