import { DEFAULT_CONVERT_OPTIONS, type BreakpointSnap, type ButtonMode, type ConvertOptions, type ExternalImageMode, type FormMode } from '../../engine/types';
import { getStorage } from './drafts';

/** The engine options the "Advanced options" panel exposes. */
export interface AdvancedOptions {
  forms: FormMode;
  buttonMode: ButtonMode;
  classPrefix: string;
  breakpointSnap: BreakpointSnap;
  neutralizeDefaults: boolean;
  externalImages: ExternalImageMode;
}

export const DEFAULT_ADVANCED: Readonly<AdvancedOptions> = Object.freeze({
  forms: DEFAULT_CONVERT_OPTIONS.forms,
  buttonMode: DEFAULT_CONVERT_OPTIONS.buttonMode,
  classPrefix: DEFAULT_CONVERT_OPTIONS.classPrefix,
  breakpointSnap: DEFAULT_CONVERT_OPTIONS.breakpointSnap,
  neutralizeDefaults: DEFAULT_CONVERT_OPTIONS.neutralizeDefaults,
  externalImages: DEFAULT_CONVERT_OPTIONS.externalImages,
});

export const OPTIONS_STORAGE_KEY = 'wf-converter:options:v1';

const FORMS: readonly FormMode[] = ['auto', 'native', 'embed'];
const BUTTONS: readonly ButtonMode[] = ['button', 'linkBlock', 'customElement'];
const SNAPS: readonly BreakpointSnap[] = ['up', 'off'];
const IMAGES: readonly ExternalImageMode[] = ['customElement', 'embed', 'image'];

const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback);

/** Coerces stored or partial data into valid options (unknown values fall back to the defaults). */
export function sanitizeAdvanced(raw: unknown): AdvancedOptions {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    forms: pick(o.forms, FORMS, DEFAULT_ADVANCED.forms),
    buttonMode: pick(o.buttonMode, BUTTONS, DEFAULT_ADVANCED.buttonMode),
    classPrefix: typeof o.classPrefix === 'string' ? o.classPrefix.slice(0, 40) : DEFAULT_ADVANCED.classPrefix,
    breakpointSnap: pick(o.breakpointSnap, SNAPS, DEFAULT_ADVANCED.breakpointSnap),
    neutralizeDefaults: typeof o.neutralizeDefaults === 'boolean' ? o.neutralizeDefaults : DEFAULT_ADVANCED.neutralizeDefaults,
    externalImages: pick(o.externalImages, IMAGES, DEFAULT_ADVANCED.externalImages),
  };
}

/** Reads saved options; defaults when nothing is stored, the data is corrupt, or storage throws. */
export function loadAdvanced(storage: Storage | null = getStorage()): AdvancedOptions {
  if (!storage) return { ...DEFAULT_ADVANCED };
  try {
    const raw = storage.getItem(OPTIONS_STORAGE_KEY);
    return raw ? sanitizeAdvanced(JSON.parse(raw)) : { ...DEFAULT_ADVANCED };
  } catch {
    return { ...DEFAULT_ADVANCED };
  }
}

/** Saves options. Returns `false` when storage is unavailable or full. */
export function saveAdvanced(options: AdvancedOptions, storage: Storage | null = getStorage()): boolean {
  if (!storage) return false;
  try {
    storage.setItem(OPTIONS_STORAGE_KEY, JSON.stringify(options));
    return true;
  } catch {
    return false;
  }
}

/** The `convert()` options for the panel's choices (the prefix is trimmed). */
export function toConvertOptions(options: AdvancedOptions): Partial<ConvertOptions> {
  return { ...options, classPrefix: options.classPrefix.trim() };
}

/** How many options differ from the defaults. */
export function countChanged(options: AdvancedOptions): number {
  return (Object.keys(DEFAULT_ADVANCED) as (keyof AdvancedOptions)[]).filter((k) =>
    k === 'classPrefix' ? options.classPrefix.trim() !== DEFAULT_ADVANCED.classPrefix : options[k] !== DEFAULT_ADVANCED[k],
  ).length;
}
