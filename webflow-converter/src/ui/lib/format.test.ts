import { describe, expect, it } from 'vitest';
import type { ConvertWarning } from '../../engine/types';
import { countBySeverity, formatBytes, groupWarnings } from './format';

describe('formatBytes', () => {
  it('formats B / KB / MB', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(50 * 1024)).toBe('50 KB');
    expect(formatBytes(3 * 1024 * 1024)).toBe('3.0 MB');
  });
});

describe('groupWarnings', () => {
  const w = (code: ConvertWarning['code'], severity: ConvertWarning['severity']): ConvertWarning => ({ code, severity, message: code });

  it('groups by code, sorts by severity then size, and keeps the max severity', () => {
    const groups = groupWarnings([
      w('descendant-selector', 'warning'),
      w('script-extracted', 'info'),
      w('descendant-selector', 'warning'),
      w('parse-error', 'error'),
      w('script-extracted', 'warning'),
    ]);
    expect(groups.map((g) => [g.code, g.severity, g.items.length])).toEqual([
      ['parse-error', 'error', 1],
      ['descendant-selector', 'warning', 2],
      ['script-extracted', 'warning', 2],
    ]);
    expect(groups[1]?.label).toMatch(/Descendant/);
  });

  it('counts by severity', () => {
    expect(countBySeverity([w('other', 'info'), w('other', 'info'), w('other', 'error')])).toEqual({ error: 1, warning: 0, info: 2 });
  });
});
