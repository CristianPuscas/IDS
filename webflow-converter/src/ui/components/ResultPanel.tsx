import type { ConvertResult } from '../../engine/types';

/** Props for {@link ResultPanel}. */
export interface ResultPanelProps {
  /** Last conversion result, or `null` before the first conversion. */
  result: ConvertResult | null;
  /** Re-copies `result.json` to the clipboard (must be called from a click). */
  onCopyAgain?: () => void;
}

/**
 * Shows conversion stats (nodes, styles, embeds, embedded CSS rules, JS bytes) and warnings.
 * Ownership: ui (placeholder).
 */
export function ResultPanel({ result, onCopyAgain }: ResultPanelProps) {
  if (!result) {
    return <p className="font-mono text-xs text-muted">No conversion yet.</p>;
  }
  const { stats, warnings } = result;
  const items: [string, number][] = [
    ['Nodes', stats.nodes],
    ['Classes', stats.styles],
    ['Embeds', stats.embeds],
    ['CSS rules in embed', stats.embeddedCssRules],
    ['JS bytes', stats.jsBytes],
  ];
  return (
    <section className="flex flex-col gap-3">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {items.map(([k, v]) => (
          <div key={k} className="rounded-md border border-line bg-surface px-3 py-2">
            <dt className="text-xs text-muted">{k}</dt>
            <dd className="font-mono text-lg text-white">{v}</dd>
          </div>
        ))}
      </dl>
      {warnings.length > 0 && (
        <ul className="flex flex-col gap-1">
          {warnings.map((w, i) => (
            <li key={i} className="font-mono text-xs text-warn">
              [{w.severity}] {w.message}
              {w.detail ? ` (${w.detail})` : ''}
            </li>
          ))}
        </ul>
      )}
      {onCopyAgain && (
        <button type="button" onClick={onCopyAgain} className="self-start rounded border border-line px-2 py-1 font-mono text-xs text-muted hover:text-white">
          Copy again
        </button>
      )}
    </section>
  );
}
