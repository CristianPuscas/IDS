import {
  DEFAULT_CONVERT_OPTIONS,
  type BreakpointSnap,
  type ButtonMode,
  type ClientFirstUtilities,
  type ConvertOptions,
  type CssVariablesMode,
  type ExternalImageMode,
  type FormMode,
  type SiteClassConflicts,
  type UnitsMode,
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
  /**
   * "Same class name, different CSS" (site styles panel): `'rename'` = create a separate class
   * (default), `'reuse'` = use the site's class (its styles; the source's differing CSS is dropped).
   */
  siteClassConflicts: SiteClassConflicts;
  /** `:root` CSS variables: inline values (default), scope to the pasted section, or keep global. */
  cssVariables: CssVariablesMode;
  /** Give styled combo classes a CSS-derived suffix so Webflow cannot merge them with the site's. */
  uniqueCombos: boolean;
  /** Length units: px -> rem (Client-First, default) or as written. */
  units: UnitsMode;
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
  siteClassConflicts: DEFAULT_CONVERT_OPTIONS.siteClassConflicts,
  cssVariables: DEFAULT_CONVERT_OPTIONS.cssVariables,
  uniqueCombos: DEFAULT_CONVERT_OPTIONS.uniqueCombos,
  units: DEFAULT_CONVERT_OPTIONS.units,
  skipClientFirstUtilityStyles: DEFAULT_CONVERT_OPTIONS.skipClientFirstUtilityStyles,
  stableClassIds: DEFAULT_CONVERT_OPTIONS.stableClassIds,
});

export const OPTIONS_STORAGE_KEY = 'wf-converter:options:v1';

/**
 * Version of the site-class policy stored with the options. Choices saved under an older policy
 * fall back to the default: before v8, "Reuse the site's" / "Use the site's" adopted the site's
 * styles for same-named classes, which gave a new paste another project's colours (/testhero).
 */
export const SITE_POLICY_VERSION = 8;

const FORMS: readonly FormMode[] = ['auto', 'native', 'embed'];
const BUTTONS: readonly ButtonMode[] = ['button', 'linkBlock', 'customElement'];
const CF_UTILITIES: readonly ClientFirstUtilities[] = ['keep', 'prefix'];
const SNAPS: readonly BreakpointSnap[] = ['up', 'off'];
const IMAGES: readonly ExternalImageMode[] = ['customElement', 'embed', 'image'];
const CONFLICTS: readonly SiteClassConflicts[] = ['rename', 'reuse'];
const VARIABLES: readonly CssVariablesMode[] = ['inline', 'scope', 'global'];
const UNITS: readonly UnitsMode[] = ['rem', 'keep'];
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
    // A choice saved under an older site-class policy (or none) falls back to "Create a separate class".
    siteClassConflicts: o.sitePolicy === SITE_POLICY_VERSION ? pick(o.siteClassConflicts, CONFLICTS, DEFAULT_ADVANCED.siteClassConflicts) : DEFAULT_ADVANCED.siteClassConflicts,
    cssVariables: pick(o.cssVariables, VARIABLES, DEFAULT_ADVANCED.cssVariables),
    uniqueCombos: bool(o.uniqueCombos, DEFAULT_ADVANCED.uniqueCombos),
    units: pick(o.units, UNITS, DEFAULT_ADVANCED.units),
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
    storage.setItem(OPTIONS_STORAGE_KEY, JSON.stringify({ ...options, sitePolicy: SITE_POLICY_VERSION }));
    return true;
  } catch {
    return false;
  }
}

/** The `convert()` options for the panel's choices (the prefix is trimmed). */
export function toConvertOptions(options: AdvancedOptions): Partial<ConvertOptions> {
  // "Use the site's class" means the site's styles as they are; with "Create a separate class" only
  // identical classes are reused, so there is nothing to override either way.
  return { ...options, classPrefix: options.classPrefix.trim(), siteClassOverrides: options.siteClassConflicts === 'reuse' ? 'drop' : 'embed' };
}

/** How many options differ from the defaults. */
export function countChanged(options: AdvancedOptions): number {
  return (Object.keys(DEFAULT_ADVANCED) as (keyof AdvancedOptions)[]).filter((k) =>
    k === 'classPrefix' ? options.classPrefix.trim() !== DEFAULT_ADVANCED.classPrefix : options[k] !== DEFAULT_ADVANCED[k],
  ).length;
}
