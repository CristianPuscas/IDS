import { describe, expect, it } from 'vitest';
import { isUuidShaped, uuid } from './ids';

describe('uuid', () => {
  it('returns UUID v4 shaped strings', () => {
    const id = uuid();
    expect(isUuidShaped(id)).toBe(true);
    expect(id[14]).toBe('4');
  });

  it('returns unique values', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => uuid()));
    expect(ids.size).toBe(1000);
  });
});
