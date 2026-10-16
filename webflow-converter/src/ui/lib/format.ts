import type { ConvertWarning, ConvertWarningCode, ConvertWarningSeverity } from '../../engine/types';

/** `1234` -> `"1.2 KB"`. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
  const mb = kb / 1024;
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}

/** Human labels for warning codes. Unknown codes fall back to the raw code. */
export const WARNING_LABELS: Record<ConvertWarningCode, string> = {
  'empty-input': 'Empty input',
  'parse-error': 'Parse errors',
  'multiple-roots-wrapped': 'Wrapped in one root',
  'unsupported-element': 'Unsupported elements',
  'unsupported-selector': 'Unsupported selectors',
  'unsupported-pseudo': 'Unsupported pseudo-classes',
  'pseudo-element': 'Pseudo-elements (::before / ::after)',
  'tag-selector': 'Tag selectors',
  'id-selector': 'ID selectors',
  'descendant-selector': 'Descendant / combinator selectors',
  'unmatched-media': 'Non-Webflow media queries',
  'large-breakpoint-folded': 'Large breakpoints folded',
  'css-variable': 'CSS variables',
  'at-rule': 'At-rules (@keyframes, @font-face…)',
  'vendor-prefix': 'Vendor prefixes',
  'important-dropped': '!important removed',
  'external-image': 'External images',
  'external-script': 'External scripts (CDN)',
  'script-extracted': 'Scripts moved to embed',
  'embed-split': 'Embeds split',
  'embed-too-large': 'Embed too large',
  'class-renamed': 'Classes renamed',
  'class-collision-risk': 'Class name clash risk',
  'site-classes': 'Reused site classes',
  'breakpoint-snapped': 'Media queries snapped to breakpoints',
  'baseline-reset': 'Browser-default reset',
  'client-first-structure': 'Client-First structure',
  'not-implemented': 'Not implemented yet',
  other: 'Other',
};

const SEVERITY_RANK: Record<ConvertWarningSeverity, number> = { error: 2, warning: 1, info: 0 };

export interface WarningGroup {
  code: ConvertWarningCode;
  label: string;
  /** Highest severity in the group. */
  severity: ConvertWarningSeverity;
  items: ConvertWarning[];
}

/** Groups warnings by code, most severe groups first, then by size; keeps first-seen order on ties. */
export function groupWarnings(warnings: readonly ConvertWarning[]): WarningGroup[] {
  const map = new Map<ConvertWarningCode, WarningGroup>();
  for (const w of warnings) {
    let g = map.get(w.code);
    if (!g) {
      g = { code: w.code, label: WARNING_LABELS[w.code] ?? w.code, severity: w.severity, items: [] };
      map.set(w.code, g);
    }
    g.items.push(w);
    if ((SEVERITY_RANK[w.severity] ?? 0) > (SEVERITY_RANK[g.severity] ?? 0)) g.severity = w.severity;
  }
  return [...map.values()].sort(
    (a, b) => (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0) || b.items.length - a.items.length,
  );
}

/** Counts warnings per severity. */
export function countBySeverity(warnings: readonly ConvertWarning[]): Record<ConvertWarningSeverity, number> {
  const out: Record<ConvertWarningSeverity, number> = { error: 0, warning: 0, info: 0 };
  for (const w of warnings) out[w.severity] = (out[w.severity] ?? 0) + 1;
  return out;
}
