import { parseClipboardJson, siteStylesFromData } from '../../engine/siteStyles';
import { analyzeClasses, cssToLibraryClasses, payloadVariables, stylesToLibraryClasses, type LibraryClass, type StyleGuideAnalysis } from '../../engine/styleLibrary';
import { XSCP_TYPE } from '../../engine/types';

/**
 * The heavy part of adding a style guide source: parsing a Designer paste (several MB of JSON) or
 * a stylesheet, compacting its classes and analysing them. Runs in the library worker
 * (./libraryWorker) or, where workers are unavailable (the single-file build opened from file://),
 * on the main thread in batches that yield between them (./libraryRunner). Pure apart from the
 * `pause` between batches, so Vitest runs it directly.
 *
 * Ownership: ui.
 */

/** Work for the runner. */
export type LibraryJob = { kind: 'designer'; text: string } | { kind: 'css'; text: string };

/** Result of a job: the classes to add and their analysis, or why nothing could be read. */
export type LibraryJobResult =
  | { ok: true; classes: LibraryClass[]; variables: string[]; analysis: StyleGuideAnalysis; skipped: number }
  | { ok: false; error: string };

/** Progress, 0..1, with a short phase name for the UI. */
export interface LibraryJobProgress {
  phase: 'parsing' | 'reading' | 'analysing';
  done: number;
}

/** Styles handled per batch before yielding. */
export const BATCH_SIZE = 400;

/** Lets the browser paint and handle input between batches. */
export const yieldToBrowser = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** Runs a job, reporting progress and pausing between batches. Never throws. */
export async function runLibraryJob(job: LibraryJob, onProgress: (p: LibraryJobProgress) => void = () => undefined, pause: () => Promise<void> = yieldToBrowser): Promise<LibraryJobResult> {
  try {
    onProgress({ phase: 'parsing', done: 0 });
    await pause();
    if (job.kind === 'css') {
      const parsed = cssToLibraryClasses(job.text);
      if (parsed.error) return { ok: false, error: parsed.error };
      onProgress({ phase: 'analysing', done: 0.9 });
      await pause();
      return { ok: true, classes: parsed.classes, variables: parsed.variables, analysis: analyzeClasses(parsed.classes, parsed.variables), skipped: parsed.skipped };
    }

    const json = parseClipboardJson(job.text);
    if ('error' in json) return { ok: false, error: json.error };
    onProgress({ phase: 'reading', done: 0.3 });
    await pause();
    // Read the styles in batches: each batch is validated and deep-copied (siteStylesFromData).
    const data = json.value as { type?: unknown; payload?: { styles?: unknown } } | unknown[] | null;
    const raw = Array.isArray(data) ? data : data && typeof data === 'object' ? data.payload?.styles : undefined;
    const wrongType = !Array.isArray(data) && data && typeof data === 'object' && data.type !== undefined && data.type !== XSCP_TYPE;
    let classes: LibraryClass[] = [];
    if (Array.isArray(raw) && raw.length > BATCH_SIZE && !wrongType) {
      for (let i = 0; i < raw.length; i += BATCH_SIZE) {
        const part = siteStylesFromData(raw.slice(i, i + BATCH_SIZE));
        classes = classes.concat(stylesToLibraryClasses(part.styles));
        onProgress({ phase: 'reading', done: 0.3 + 0.6 * Math.min(1, (i + BATCH_SIZE) / raw.length) });
        await pause();
      }
      // No class at all: the same message as a small paste.
      if (classes.length === 0) return { ok: false, error: siteStylesFromData([]).error ?? 'No styles found in this clipboard data.' };
    } else {
      const parsed = siteStylesFromData(json.value);
      if (parsed.error) return { ok: false, error: parsed.error };
      classes = stylesToLibraryClasses(parsed.styles);
    }
    onProgress({ phase: 'analysing', done: 0.92 });
    await pause();
    const variables = payloadVariables(json.value, classes);
    return { ok: true, classes, variables, analysis: analyzeClasses(classes, variables), skipped: 0 };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? `Could not read this data: ${err.message}` : 'Could not read this data.' };
  }
}
