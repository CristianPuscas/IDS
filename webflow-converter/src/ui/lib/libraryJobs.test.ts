import { describe, expect, it } from 'vitest';
import SITE_COPY from '../../engine/__fixtures__/client-first-site-copy.json?raw';
import { BATCH_SIZE, runLibraryJob, type LibraryJobProgress } from './libraryJobs';

const noPause = () => Promise.resolve();

/** A style guide copy with `n` classes (plus the fixture's nodes), several hundred KB. */
function bigPayload(n: number): string {
  const data = JSON.parse(SITE_COPY) as { payload: { styles: unknown[]; nodes: unknown[] } };
  const styles = [];
  for (let i = 0; i < n; i++) {
    styles.push({ _id: `id-${i}`, fake: false, type: 'class', name: i % 100 === 99 ? `card_${i - 1} 2` : `card_${i}`, namespace: '', comb: '', styleLess: `padding-top: ${i}px;`, variants: { medium: { styleLess: 'padding-top: 1rem;' } }, children: [], selector: null });
  }
  data.payload.styles = styles;
  data.payload.nodes = Array.from({ length: 2000 }, (_, i) => ({ _id: `n${i}`, type: 'Block', tag: 'div', classes: [], children: [], data: { text: 'x'.repeat(50) } }));
  return JSON.stringify(data);
}

describe('runLibraryJob', () => {
  it('reads and analyses a Designer paste', async () => {
    const result = await runLibraryJob({ kind: 'designer', text: SITE_COPY }, undefined, noPause);
    if (!result.ok) throw new Error(result.error);
    expect(result.classes).toHaveLength(6);
    expect(result.analysis.classCount).toBe(4);
    expect(result.analysis.combos).toHaveLength(2);
    expect(result.variables).toEqual(['variable-5f2a1b3c-0d4e-1f2a-3b4c-5d6e7f8a9b0c']);
  });

  it('reads a large paste in batches, yielding and reporting progress between them', async () => {
    const n = BATCH_SIZE * 5 + 17;
    const progress: LibraryJobProgress[] = [];
    let pauses = 0;
    const result = await runLibraryJob({ kind: 'designer', text: bigPayload(n) }, (p) => progress.push(p), () => (pauses++, Promise.resolve()));
    if (!result.ok) throw new Error(result.error);
    expect(result.classes).toHaveLength(n);
    expect(pauses).toBeGreaterThanOrEqual(6 + 2);
    const done = progress.map((p) => p.done);
    expect(done).toEqual([...done].sort((a, b) => a - b));
    expect(progress[0]!.phase).toBe('parsing');
    expect(progress.at(-1)!.phase).toBe('analysing');
    expect(result.analysis.duplicates.length).toBe(Math.floor(n / 100));
    expect(result.analysis.breakpoints).toEqual(['main', 'medium']);
  });

  it('explains bad input instead of throwing', async () => {
    const bad = await runLibraryJob({ kind: 'designer', text: 'not json' }, undefined, noPause);
    expect(bad).toEqual({ ok: false, error: expect.stringMatching(/not Webflow clipboard data/) });
    const wrongType = await runLibraryJob({ kind: 'designer', text: JSON.stringify({ type: 'other', payload: { styles: Array(BATCH_SIZE + 1).fill({}) } }) }, undefined, noPause);
    expect(wrongType).toEqual({ ok: false, error: expect.stringMatching(/Unexpected clipboard type/) });
    const noClasses = await runLibraryJob({ kind: 'designer', text: JSON.stringify({ type: '@webflow/XscpData', payload: { styles: Array(BATCH_SIZE + 1).fill({ type: 'tag' }) } }) }, undefined, noPause);
    expect(noClasses).toEqual({ ok: false, error: expect.stringMatching(/no classes/) });
    expect(await runLibraryJob({ kind: 'css', text: '' }, undefined, noPause)).toEqual({ ok: false, error: expect.stringMatching(/empty/) });
  });

  it('reads a stylesheet', async () => {
    const result = await runLibraryJob({ kind: 'css', text: ':root { --brand: red } .a { color: red } .a .b { color: blue }' }, undefined, noPause);
    if (!result.ok) throw new Error(result.error);
    expect(result.classes.map((c) => c.name)).toEqual(['a']);
    expect(result.variables).toEqual(['--brand']);
    expect(result.skipped).toBe(1);
    expect(result.analysis.fromCss).toBe(1);
  });
});
