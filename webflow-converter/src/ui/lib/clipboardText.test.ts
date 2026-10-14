import { describe, expect, it, vi } from 'vitest';
import { IDEAL_SYSTEM_PROMPT } from '../prompt';
import { copyText } from './clipboardText';

describe('copyText (prompt copy)', () => {
  it('writes the ideal prompt with the async Clipboard API', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const fallback = vi.fn();
    await expect(copyText(IDEAL_SYSTEM_PROMPT, { clipboard: { writeText }, fallback })).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith(IDEAL_SYSTEM_PROMPT);
    expect(fallback).not.toHaveBeenCalled();
  });

  it('falls back to execCommand when writeText rejects', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('NotAllowedError'));
    const fallback = vi.fn().mockReturnValue(true);
    await expect(copyText('x', { clipboard: { writeText }, fallback })).resolves.toBe(true);
    expect(fallback).toHaveBeenCalledWith('x');
  });

  it('falls back when the Clipboard API is missing, and reports failure', async () => {
    await expect(copyText('x', { clipboard: undefined, fallback: () => false })).resolves.toBe(false);
    await expect(
      copyText('x', {
        fallback: () => {
          throw new Error('boom');
        },
      }),
    ).resolves.toBe(false);
  });
});

describe('IDEAL_SYSTEM_PROMPT', () => {
  it.each([
    ['single file', /ONE complete HTML file/],
    ['vanilla', /Vanilla HTML, CSS and JavaScript/],
    ['rem', /1rem = 16px/],
    ['class-only', /Class selectors only/],
    ['no descendants', /descendant, child or sibling/],
    ['no reset', /No "\*"/],
    ['breakpoints', /max-width: 991px[\s\S]*max-width: 767px[\s\S]*max-width: 479px/],
    ['alt text', /alt/],
    ['pinned CDN', /gsap@\d+\.\d+\.\d+/],
    ['data attributes', /data attributes/],
    ['embed note', /Code Embed/],
  ])('mentions %s', (_name, re) => {
    expect(IDEAL_SYSTEM_PROMPT).toMatch(re);
  });
});
