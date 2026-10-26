import { runLibraryJob, type LibraryJob } from './libraryJobs';

/**
 * Web Worker entry for style guide jobs (./libraryJobs), so parsing a multi-MB Designer paste
 * does not freeze the page. Bundled inline by Vite (`?worker&inline`, a Blob URL), so it also
 * works in the single-file build. Messages: in `LibraryJob`; out `{ type: 'progress', progress }`
 * then `{ type: 'done', result }`.
 *
 * Ownership: ui.
 */

const ctx = self as unknown as { onmessage: ((e: MessageEvent<LibraryJob>) => void) | null; postMessage: (message: unknown) => void };

ctx.onmessage = (e) => {
  // No pauses needed off the main thread.
  void runLibraryJob(e.data, (progress) => ctx.postMessage({ type: 'progress', progress }), () => Promise.resolve()).then((result) =>
    ctx.postMessage({ type: 'done', result }),
  );
};
