import type { ConvertInput, InputMode } from '../../engine/types';

/** Editor contents for each input mode. Each tab keeps its own text. */
export interface Drafts {
  combined: { html: string };
  separate: { html: string; css: string; js: string };
}

/** What the app saves to localStorage. */
export interface PersistedState {
  mode: InputMode;
  drafts: Drafts;
}

export const EMPTY_DRAFTS: Drafts = Object.freeze({
  combined: Object.freeze({ html: '' }),
  separate: Object.freeze({ html: '', css: '', js: '' }),
}) as Drafts;

export const STORAGE_KEY = 'wf-converter:drafts:v1';

/** Builds the engine input from the active tab only. The other tab's draft is ignored. */
export function buildConvertInput(mode: InputMode, drafts: Drafts): ConvertInput {
  if (mode === 'combined') return { mode: 'combined', html: drafts.combined.html };
  const { html, css, js } = drafts.separate;
  return { mode: 'separate', html, css, js };
}

/** True when the active tab has any non-whitespace text to convert. */
export function hasConvertibleInput(mode: InputMode, drafts: Drafts): boolean {
  if (mode === 'combined') return drafts.combined.html.trim() !== '';
  const { html, css, js } = drafts.separate;
  return html.trim() !== '' || css.trim() !== '' || js.trim() !== '';
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/** Returns `window.localStorage`, or `null` when it is missing or blocked. */
export function getStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** Reads saved drafts. Returns `null` when nothing is stored, the data is corrupt, or storage throws. */
export function loadPersisted(storage: Storage | null = getStorage()): PersistedState | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const p = parsed as { mode?: unknown; drafts?: { combined?: Record<string, unknown>; separate?: Record<string, unknown> } };
    const mode: InputMode = p.mode === 'separate' ? 'separate' : 'combined';
    const c = p.drafts?.combined ?? {};
    const s = p.drafts?.separate ?? {};
    return {
      mode,
      drafts: {
        combined: { html: str(c.html) },
        separate: { html: str(s.html), css: str(s.css), js: str(s.js) },
      },
    };
  } catch {
    return null;
  }
}

/** Saves drafts. Returns `false` when storage is unavailable or full. */
export function savePersisted(state: PersistedState, storage: Storage | null = getStorage()): boolean {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
