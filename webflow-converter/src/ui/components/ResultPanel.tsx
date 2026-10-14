import { useMemo, useState } from 'react';
import type { ConvertResult, ConvertWarningSeverity } from '../../engine/types';
import { copyText } from '../lib/clipboardText';
import { countBySeverity, formatBytes, groupWarnings } from '../lib/format';
import { CheckIcon, ChevronIcon, CopyIcon, DownloadIcon, RetryIcon } from './icons';

/** Props for {@link ResultPanel}. */
export interface ResultPanelProps {
  /** Last conversion result. */
  result: ConvertResult;
  /** Re-copies `result.json` with `copyToWebflow()` (called from a click). */
  onCopyAgain: () => void;
  /** Downloads `result.json` as a file. */
  onDownload: () => void;
}

const SEV_DOT: Record<ConvertWarningSeverity, string> = { error: 'bg-err', warning: 'bg-warn', info: 'bg-sky-400' };
const SEV_TEXT: Record<ConvertWarningSeverity, string> = { error: 'text-err', warning: 'text-warn', info: 'text-sky-300' };

/** Max characters rendered in the JSON preview (the copy button always copies everything). */
const PREVIEW_LIMIT = 150_000;

/**
 * Shows conversion stats, grouped warnings and a JSON preview.
 * Ownership: ui.
 */
export function ResultPanel({ result, onCopyAgain, onDownload }: ResultPanelProps) {
  const { stats, warnings } = result;
  const groups = useMemo(() => groupWarnings(warnings), [warnings]);
  const counts = useMemo(() => countBySeverity(warnings), [warnings]);

  const chips: { label: string; value: string; hint: string }[] = [
    { label: 'Nodes', value: String(stats.nodes), hint: 'Element and text nodes' },
    { label: 'Classes', value: String(stats.styles), hint: 'Native Webflow class styles' },
    { label: 'Embeds', value: String(stats.embeds), hint: 'Code Embed elements' },
    { label: 'CSS → embed', value: String(stats.embeddedCssRules), hint: 'CSS rules placed in <style> embeds' },
    { label: 'JS size', value: formatBytes(stats.jsBytes), hint: 'JavaScript placed in <script> embeds' },
  ];

  return (
    <section aria-labelledby="result-title" className="card motion-safe:animate-pop-in">
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <h2 id="result-title" className="text-sm font-semibold text-white">
            Conversion result
          </h2>
          <p className="text-[13px] text-muted">
            {warnings.length === 0
              ? 'Clean conversion. No warnings.'
              : `${warnings.length} note${warnings.length === 1 ? '' : 's'}: ${counts.error} error · ${counts.warning} warning · ${counts.info} info`}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <button type="button" onClick={onDownload} className="btn-secondary">
            <DownloadIcon width={14} height={14} />
            Download JSON
          </button>
          <button type="button" onClick={onCopyAgain} className="btn-primary-soft">
            <RetryIcon width={14} height={14} />
            Copy again
          </button>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3 lg:grid-cols-5">
        {chips.map((c) => (
          <div key={c.label} title={c.hint} className="rounded-lg border border-line bg-canvas/60 px-3 py-2">
            <dt className="truncate text-[11px] font-medium uppercase tracking-wider text-muted">{c.label}</dt>
            <dd className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-white">{c.value}</dd>
          </div>
        ))}
      </dl>

      {groups.length > 0 && (
        <details open={counts.error > 0 || undefined} className="group/w border-t border-line">
          <summary className="summary-row">
            <ChevronIcon width={14} height={14} className="transition-transform group-open/w:rotate-90" />
            Warnings
            <span className="rounded-full bg-white/5 px-2 py-0.5 font-mono text-[11px] text-zinc-400">{warnings.length}</span>
            <span className="ml-auto flex items-center gap-2">
              {(['error', 'warning', 'info'] as const).map((s) =>
                counts[s] > 0 ? (
                  <span key={s} className={`flex items-center gap-1 font-mono text-[11px] ${SEV_TEXT[s]}`}>
                    <span className={`size-1.5 rounded-full ${SEV_DOT[s]}`} aria-hidden="true" />
                    {counts[s]}
                    <span className="sr-only"> {s}</span>
                  </span>
                ) : null,
              )}
            </span>
          </summary>
          <ul className="space-y-1.5 px-4 pb-4">
            {groups.map((g) => (
              <li key={g.code}>
                <details className="group/g rounded-lg border border-line bg-canvas/50">
                  <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-zinc-200 hover:bg-white/[0.02] [&::-webkit-details-marker]:hidden">
                    <span className={`size-2 shrink-0 rounded-full ${SEV_DOT[g.severity]}`} aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">{g.label}</span>
                    <span className="sr-only">{g.severity}, </span>
                    <span className="font-mono text-[11px] text-muted">×{g.items.length}</span>
                    <ChevronIcon width={13} height={13} className="shrink-0 text-muted transition-transform group-open/g:rotate-90" />
                  </summary>
                  <ul className="space-y-2 border-t border-line px-3 py-2.5">
                    {g.items.map((w, i) => (
                      <li key={i} className="text-[13px] leading-snug text-zinc-300">
                        {w.message}
                        {w.detail && (
                          <code className="mt-1 block overflow-x-auto whitespace-pre rounded-md bg-black/40 px-2 py-1 font-mono text-[11.5px] text-zinc-400 code-scroll">
                            {w.detail}
                          </code>
                        )}
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            ))}
          </ul>
        </details>
      )}

      <JsonPreview json={result.json} data={result.data} />
    </section>
  );
}

/** Collapsible pretty-printed JSON. Formats only when opened. */
function JsonPreview({ json, data }: { json: string; data: unknown }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const pretty = useMemo(() => (open ? JSON.stringify(data, null, 2) : ''), [open, data]);
  const shown = pretty.length > PREVIEW_LIMIT ? `${pretty.slice(0, PREVIEW_LIMIT)}\n… (truncated in preview)` : pretty;

  const copy = async () => {
    const ok = await copyText(pretty || json);
    setCopied(ok);
    if (ok) window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <details className="group/j border-t border-line" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="summary-row">
        <ChevronIcon width={14} height={14} className="transition-transform group-open/j:rotate-90" />
        JSON preview
        <span className="ml-auto font-mono text-[11px] text-muted">{formatBytes(new Blob([json]).size)}</span>
      </summary>
      {open && (
        <div className="px-4 pb-4">
          <div className="relative overflow-hidden rounded-lg border border-line bg-[#0d0d11]">
            <button type="button" onClick={copy} className="btn-secondary absolute right-2 top-2 z-10">
              {copied ? <CheckIcon width={13} height={13} /> : <CopyIcon width={13} height={13} />}
              {copied ? 'Copied' : 'Copy JSON'}
            </button>
            <pre tabIndex={0} aria-label="Webflow clipboard JSON" className="code-scroll max-h-96 overflow-auto p-3 pr-28 font-mono text-[11.5px] leading-relaxed text-zinc-300">
              {shown}
            </pre>
          </div>
          <p className="mt-2 text-[12px] text-muted">
            This copies plain text, for debugging. To paste elements into Webflow, use <span className="text-zinc-300">Copy again</span>.
          </p>
        </div>
      )}
    </details>
  );
}
