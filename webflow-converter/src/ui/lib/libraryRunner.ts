import LibraryWorker from './libraryWorker?worker&inline';
import { runLibraryJob, type LibraryJob, type LibraryJobProgress, type LibraryJobResult } from './libraryJobs';

/**
 * Runs a style guide job (./libraryJobs) in a Web Worker, falling back to batches on the main
 * thread when the worker cannot start: no Worker support, a blocked Blob URL (some file:// or CSP
 * setups), a load error, or no answer within `startTimeoutMs`.
 *
 * Ownership: ui.
 */

/** Worker-like object, so tests can stand in for a real Worker. */
export interface JobWorker {
  onmessage: ((e: MessageEvent) => void) | null;
  onerror: ((e: Event) => void) | null;
  postMessage(message: unknown): void;
  terminate(): void;
}

/** Options for {@link processLibraryJob}. */
export interface RunnerOptions {
  /** Creates the worker; throws or returns `null` when there is none. */
  createWorker?: () => JobWorker | null;
  /** Fall back when the worker sends nothing for this long (ms). */
  startTimeoutMs?: number;
}

const defaultWorker = (): JobWorker | null => (typeof Worker === 'undefined' ? null : (new LibraryWorker() as unknown as JobWorker));

/** Runs `job`, preferring the worker. Never rejects. */
export function processLibraryJob(job: LibraryJob, onProgress: (p: LibraryJobProgress) => void = () => undefined, opts: RunnerOptions = {}): Promise<LibraryJobResult> {
  const fallback = () => runLibraryJob(job, onProgress);
  let worker: JobWorker | null = null;
  try {
    worker = (opts.createWorker ?? defaultWorker)();
  } catch {
    worker = null;
  }
  if (!worker) return fallback();
  const w = worker;

  return new Promise<LibraryJobResult>((resolve) => {
    let settled = false;
    let heard = false;
    const finish = (result: Promise<LibraryJobResult> | LibraryJobResult) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      w.onmessage = null;
      w.onerror = null;
      try {
        w.terminate();
      } catch {
        /* already gone */
      }
      void Promise.resolve(result).then(resolve);
    };
    const timer = window.setTimeout(() => {
      if (!heard) finish(fallback());
    }, opts.startTimeoutMs ?? 4000);
    w.onmessage = (e: MessageEvent) => {
      heard = true;
      const msg = e.data as { type?: string; progress?: LibraryJobProgress; result?: LibraryJobResult } | null;
      if (msg?.type === 'progress' && msg.progress) onProgress(msg.progress);
      else if (msg?.type === 'done' && msg.result) finish(msg.result);
    };
    w.onerror = (e: Event) => {
      e.preventDefault?.();
      finish(fallback());
    };
    try {
      w.postMessage(job);
    } catch {
      finish(fallback());
    }
  });
}
