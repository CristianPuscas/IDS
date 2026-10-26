import { describe, expect, it } from 'vitest';
import SITE_COPY from '../../engine/__fixtures__/client-first-site-copy.json?raw';
import { runLibraryJob, type LibraryJob, type LibraryJobProgress } from './libraryJobs';
import { processLibraryJob, type JobWorker } from './libraryRunner';

/** A worker stand-in that runs the job in-process and answers like ./libraryWorker. */
function fakeWorker(mode: 'ok' | 'error' | 'silent' = 'ok'): JobWorker & { terminated: boolean; posted: unknown[] } {
  const w = {
    onmessage: null as ((e: MessageEvent) => void) | null,
    onerror: null as ((e: Event) => void) | null,
    terminated: false,
    posted: [] as unknown[],
    postMessage(job: unknown) {
      w.posted.push(job);
      if (mode === 'silent') return;
      if (mode === 'error') {
        setTimeout(() => w.onerror?.(new Event('error')), 0);
        return;
      }
      void runLibraryJob(job as LibraryJob, (progress) => w.onmessage?.({ data: { type: 'progress', progress } } as MessageEvent), () => Promise.resolve()).then((result) =>
        w.onmessage?.({ data: { type: 'done', result } } as MessageEvent),
      );
    },
    terminate() {
      w.terminated = true;
    },
  };
  return w;
}

const JOB: LibraryJob = { kind: 'designer', text: SITE_COPY };

describe('processLibraryJob', () => {
  it('runs the job in the worker, relays progress and terminates it', async () => {
    const worker = fakeWorker();
    const progress: LibraryJobProgress[] = [];
    const result = await processLibraryJob(JOB, (p) => progress.push(p), { createWorker: () => worker });
    expect(result.ok && result.classes).toHaveLength(6);
    expect(worker.posted).toEqual([JOB]);
    expect(progress.length).toBeGreaterThan(0);
    expect(worker.terminated).toBe(true);
  });

  it('falls back to the main thread when no worker can be created (file://, no Worker)', async () => {
    const thrown = await processLibraryJob(JOB, undefined, {
      createWorker: () => {
        throw new DOMException('blocked', 'SecurityError');
      },
    });
    expect(thrown.ok).toBe(true);
    expect((await processLibraryJob(JOB, undefined, { createWorker: () => null })).ok).toBe(true);
  });

  it('falls back when the worker fails to load or never answers', async () => {
    const failing = fakeWorker('error');
    expect((await processLibraryJob(JOB, undefined, { createWorker: () => failing })).ok).toBe(true);
    expect(failing.terminated).toBe(true);
    const silent = fakeWorker('silent');
    expect((await processLibraryJob(JOB, undefined, { createWorker: () => silent, startTimeoutMs: 10 })).ok).toBe(true);
    expect(silent.terminated).toBe(true);
  });

  it('uses the main thread in an environment without Worker (the default factory)', async () => {
    expect(typeof Worker).toBe('undefined'); // jsdom
    expect((await processLibraryJob(JOB)).ok).toBe(true);
  });
});
