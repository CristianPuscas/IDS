import {
  DEFAULT_CONVERT_OPTIONS,
  type BreakpointSnap,
  type ButtonMode,
  type ClientFirstUtilities,
  type ConvertOptions,
  type ExternalImageMode,
  type FormMode,
  type SiteClassConflicts,
  type SiteClassOverrides,
} from '../../engine/types';
import { getStorage } from './drafts';

/** The engine options the "Advanced options" panel exposes. */
export interface AdvancedOptions {
  forms: FormMode;
  buttonMode: ButtonMode;
  classPrefix: string;
  clientFirstUtilities: ClientFirstUtilities;
  breakpointSnap: BreakpointSnap;
  neutralizeDefaults: boolean;
  externalImages: ExternalImageMode;
  /** Where a reused site class differs from the source CSS (see the site styles panel). */
  siteClassOverrides: SiteClassOverrides;
  /** When an imported site class has the same name but another design (see the site styles panel). */
  siteClassConflicts: SiteClassConflicts;
  /** Experimental: empty Client-First utility styles so the site's apply. */
  skipClientFirstUtilityStyles: boolean;
  /** Deterministic style ids. */
  stableClassIds: boolean;
}

export const DEFAULT_ADVANCED: Readonly<AdvancedOptions> = Object.freeze({
  forms: DEFAULT_CONVERT_OPTIONS.forms,
  buttonMode: DEFAULT_CONVERT_OPTIONS.buttonMode,
  classPrefix: DEFAULT_CONVERT_OPTIONS.classPrefix,
  clientFirstUtilities: DEFAULT_CONVERT_OPTIONS.clientFirstUtilities,
  breakpointSnap: DEFAULT_CONVERT_OPTIONS.breakpointSnap,
  neutralizeDefaults: DEFAULT_CONVERT_OPTIONS.neutralizeDefaults,
  externalImages: DEFAULT_CONVERT_OPTIONS.externalImages,
  siteClassOverrides: DEFAULT_CONVERT_OPTIONS.siteClassOverrides,
  siteClassConflicts: DEFAULT_CONVERT_OPTIONS.siteClassConflicts,
  skipClientFirstUtilityStyles: DEFAULT_CONVERT_OPTIONS.skipClientFirstUtilityStyles,
  stableClassIds: DEFAULT_CONVERT_OPTIONS.stableClassIds,
});

export const OPTIONS_STORAGE_KEY = 'wf-converter:options:v1';

const FORMS: readonly FormMode[] = ['auto', 'native', 'embed'];
const BUTTONS: readonly ButtonMode[] = ['button', 'linkBlock', 'customElement'];
const CF_UTILITIES: readonly ClientFirstUtilities[] = ['keep', 'prefix'];
const SNAPS: readonly BreakpointSnap[] = ['up', 'off'];
const IMAGES: readonly ExternalImageMode[] = ['customElement', 'embed', 'image'];
const OVERRIDES: readonly SiteClassOverrides[] = ['embed', 'drop'];
const CONFLICTS: readonly SiteClassConflicts[] = ['rename', 'reuse'];
const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);

const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback);

/** Coerces stored or partial data into valid options (unknown values fall back to the defaults). */
export function sanitizeAdvanced(raw: unknown): AdvancedOptions {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    forms: pick(o.forms, FORMS, DEFAULT_ADVANCED.forms),
    buttonMode: pick(o.buttonMode, BUTTONS, DEFAULT_ADVANCED.buttonMode),
    classPrefix: typeof o.classPrefix === 'string' ? o.classPrefix.slice(0, 40) : DEFAULT_ADVANCED.classPrefix,
    clientFirstUtilities: pick(o.clientFirstUtilities, CF_UTILITIES, DEFAULT_ADVANCED.clientFirstUtilities),
    breakpointSnap: pick(o.breakpointSnap, SNAPS, DEFAULT_ADVANCED.breakpointSnap),
    neutralizeDefaults: typeof o.neutralizeDefaults === 'boolean' ? o.neutralizeDefaults : DEFAULT_ADVANCED.neutralizeDefaults,
    externalImages: pick(o.externalImages, IMAGES, DEFAULT_ADVANCED.externalImages),
    // Options saved before v7 have no siteClassConflicts: their "Use the site's" choice was made
    // when every same-named class was reused, so it falls back to the default with the new policy.
    siteClassOverrides: o.siteClassConflicts === undefined ? DEFAULT_ADVANCED.siteClassOverrides : pick(o.siteClassOverrides, OVERRIDES, DEFAULT_ADVANCED.siteClassOverrides),
    siteClassConflicts: pick(o.siteClassConflicts, CONFLICTS, DEFAULT_ADVANCED.siteClassConflicts),
    skipClientFirstUtilityStyles: bool(o.skipClientFirstUtilityStyles, DEFAULT_ADVANCED.skipClientFirstUtilityStyles),
    stableClassIds: bool(o.stableClassIds, DEFAULT_ADVANCED.stableClassIds),
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
