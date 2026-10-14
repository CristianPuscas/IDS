import { describe, expect, it } from 'vitest';
import { isConvertShortcut, isMacPlatform } from './platform';

describe('shortcut helpers', () => {
  it('detects Ctrl/Cmd+Enter only', () => {
    expect(isConvertShortcut({ key: 'Enter', ctrlKey: true })).toBe(true);
    expect(isConvertShortcut({ key: 'Enter', metaKey: true })).toBe(true);
    expect(isConvertShortcut({ key: 'Enter' })).toBe(false);
    expect(isConvertShortcut({ key: 'Enter', ctrlKey: true, shiftKey: true })).toBe(false);
    expect(isConvertShortcut({ key: 'a', ctrlKey: true })).toBe(false);
  });

  it('detects Mac platforms', () => {
    expect(isMacPlatform('MacIntel')).toBe(true);
    expect(isMacPlatform('Win32 Mozilla/5.0 (Windows NT 10.0)')).toBe(false);
  });
});
