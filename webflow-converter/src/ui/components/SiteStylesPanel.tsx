import { useId, useMemo, useRef, useState, type ChangeEvent, type ClipboardEvent } from 'react';
import {
  addLibrarySource,
  analyzeLibrary,
  baseClassCount,
  formatSourceDate,
  removeLibrarySource,
  renameLibrarySource,
  sourceClasses,
  type LibrarySource,
  type LibrarySourceKind,
  type StyleGuideAnalysis,
} from '../../engine/styleLibrary';
import type { SiteClassConflicts } from '../../engine/types';
import { fetchSiteCss } from '../lib/cssFetch';
import type { LibraryJob, LibraryJobProgress } from '../lib/libraryJobs';
import { processLibraryJob } from '../lib/libraryRunner';
import { readClipboardPayload, type LibraryState, type SaveResult } from '../lib/siteLibrary';
import { AlertIcon, ChevronIcon, CloseIcon } from './icons';

/** Id of the paste box, so other parts of the UI can focus it. */
export const SITE_PASTE_ID = 'site-styles-paste';

/** Props for {@link SiteStylesPanel}. */
export interface SiteStylesPanelProps {
  state: LibraryState;
  onStateChange: (next: LibraryState) => void;
  /** How the last save to localStorage went. */
  saveResult: SaveResult;
  conflicts: SiteClassConflicts;
  onConflictsChange: (v: SiteClassConflicts) => void;
  emptyUtilities: boolean;
  onEmptyUtilitiesChange: (v: boolean) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modKey: string;
}

type Feedback = { kind: 'ok' | 'error'; text: string } | null;
type Busy = { text: string; done: number } | null;

const KIND_LABEL: Record<LibrarySourceKind, string> = { designer: 'Designer', 'css-url': 'CSS URL', 'css-text': 'CSS' };

const BREAKPOINT_LABEL: Record<string, string> = {
  main: 'Desktop',
  medium: 'Tablet ≤991',
  small: 'Landscape ≤767',
  tiny: 'Portrait ≤479',
  large: '≥1280',
  xl: '≥1440',
  xxl: '≥1920',
};

const PHASE_LABEL: Record<LibraryJobProgress['phase'], string> = { parsing: 'Reading the data…', reading: 'Collecting classes…', analysing: 'Analysing…' };

const plural = (n: number, word: string, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;

/** One-line status, e.g. `142 classes from 3 sources`. */
export function siteStatus(state: LibraryState): string {
  const { library, enabled } = state;
  if (library.sources.length === 0) return 'Style guide: none';
  const n = baseClassCount([...library.classes.values()]);
  return `Style guide: ${plural(n, 'class', 'classes')} from ${plural(library.sources.length, 'source')}${enabled ? '' : ' (not used)'}`;
}

/**
 * "1. Your site's style guide (optional)": the user copies whole pages of their Webflow site in
 * the Designer (the style guide page: select the page wrapper, Ctrl/Cmd+C) and pastes them here;
 * the published site's CSS can be added too (by URL, pasted or as a file). Every source is
 * analysed (utility vs custom classes, combos, variables, breakpoints, "name 2" duplicates) and
 * merged into one library (../../engine/styleLibrary) that `convert()` checks every class against:
 * same name and CSS -> the site's class is reused; same name, other CSS -> a separate class.
 * Parsing runs in a worker, or in batches when there is none (../lib/libraryRunner).
 *
 * Ownership: ui.
 */
export function SiteStylesPanel(props: SiteStylesPanelProps) {
  const { state, onStateChange, saveResult, conflicts, onConflictsChange, emptyUtilities, onEmptyUtilitiesChange, open, onOpenChange, modKey } = props;
  const { library, enabled } = state;
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState<Busy>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [last, setLast] = useState<{ label: string; analysis: StyleGuideAnalysis; skipped: number } | null>(null);
  const [cssUrl, setCssUrl] = useState('');
  const [cssText, setCssText] = useState('');
  const [renaming, setRenaming] = useState<{ id: string; text: string } | null>(null);
  // The latest state, for jobs that finish after other changes.
  const stateRef = useRef(state);
  stateRef.current = state;
  const fileRef = useRef<HTMLInputElement>(null);
  const labelId = useId();
  const stepsId = useId();
  const urlId = useId();
  const cssId = useId();
  const total = useMemo(() => analyzeLibrary(library), [library]);
  const hasLibrary = library.sources.length > 0;

  const run = (job: LibraryJob, meta: { kind: LibrarySourceKind; url?: string; fallbackLabel?: string }) => {
    setFeedback(null);
    setBusy({ text: PHASE_LABEL.parsing, done: 0 });
    void processLibraryJob(job, (p) => setBusy({ text: PHASE_LABEL[p.phase], done: p.done })).then((result) => {
      setBusy(null);
      if (!result.ok) {
        setFeedback({ kind: 'error', text: result.error });
        return;
      }
      const current = stateRef.current;
      const { library: next, source } = addLibrarySource(current.library, {
        kind: meta.kind,
        label: label.trim() || meta.fallbackLabel,
        url: meta.url,
        classes: result.classes,
        variables: result.variables,
      });
      onStateChange({ ...current, library: next });
      setLast({ label: source.label, analysis: result.analysis, skipped: result.skipped });
      setLabel('');
      const a = result.analysis;
      setFeedback({
        kind: 'ok',
        text: `Added “${source.label}”: ${plural(a.classCount, 'class', 'classes')} (${a.utilities.length} utility, ${a.custom.length} custom), ${plural(a.combos.length, 'combo')}. The library now has ${plural(baseClassCount([...next.classes.values()]), 'class', 'classes')}.`,
      });
    });
  };

  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    if (busy) return;
    const text = readClipboardPayload(e.clipboardData);
    if (!text.trim()) {
      setFeedback({ kind: 'error', text: 'The clipboard is empty. Copy the page wrapper in the Webflow Designer first.' });
      return;
    }
    run({ kind: 'designer', text }, { kind: 'designer' });
  };

  const onFetch = () => {
    if (busy || !cssUrl.trim()) return;
    setFeedback(null);
    setBusy({ text: 'Fetching the CSS…', done: 0 });
    void fetchSiteCss(cssUrl).then((res) => {
      if (!res.ok) {
        setBusy(null);
        setFeedback({ kind: 'error', text: res.error });
        return;
      }
      setCssUrl('');
      run({ kind: 'css', text: res.css }, { kind: 'css-url', url: res.urls[0] });
    });
  };

  const onAddCss = () => {
    if (busy || !cssText.trim()) return;
    run({ kind: 'css', text: cssText }, { kind: 'css-text' });
    setCssText('');
  };

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || busy) return;
    file.text().then(
      (text) => run({ kind: 'css', text }, { kind: 'css-text' }),
      () => setFeedback({ kind: 'error', text: `Could not read ${file.name}.` }),
    );
  };

  const commitRename = () => {
    if (!renaming) return;
    onStateChange({ ...state, library: renameLibrarySource(library, renaming.id, renaming.text) });
    setRenaming(null);
  };

  return (
    <details className="card group/site" open={open} onToggle={(e) => onOpenChange(e.currentTarget.open)}>
      <summary className="summary-row rounded-xl">
        <ChevronIcon width={14} height={14} className="transition-transform group-open/site:rotate-90" />
        1. Your site's style guide <span className="font-normal text-muted">(optional)</span>
        <span
          className={`ml-auto truncate rounded-full px-2 py-0.5 font-mono text-[11px] ring-1 ring-inset ${hasLibrary && enabled ? 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30' : 'bg-white/5 text-muted ring-line'}`}
          data-testid="site-status"
        >
          {hasLibrary ? `${plural(total.classCount, 'class', 'classes')} · ${plural(library.sources.length, 'source')}${enabled ? '' : ' · off'}` : 'none'}
        </span>
      </summary>
      <div className="grid gap-4 border-t border-line p-4">
        <p className="text-[13px] leading-relaxed text-zinc-300">
          {siteStatus(state)}. Webflow only reuses a class it already has when the pasted class is <em>identical</em>; otherwise it adds{' '}
          <code className="font-mono text-[12px]">container-large 2</code>. Add your site's style guide once: a class with the same name and CSS is pasted as your site's own, and a class with the same name but other CSS gets a separate name.
        </p>
        <ol id={stepsId} className="list-decimal space-y-1 pl-5 text-[13px] leading-snug text-muted">
          <li>
            In the Webflow Designer, open your style guide page, select the <span className="text-zinc-200">page wrapper</span> and press <kbd className="kbd">{modKey}+C</kbd>.
          </li>
          <li>
            Click the box below and press <kbd className="kbd">{modKey}+V</kbd>. Add more pages the same way: they all go into one library, saved in this browser.
          </li>
          <li>Convert as usual. Use Chrome, Edge, Arc or Brave.</li>
        </ol>

        <div className="grid gap-3 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
          <div className="min-w-0">
            <label htmlFor={labelId} className="text-[13px] font-medium text-zinc-200">
              Label <span className="font-normal text-muted">(optional)</span>
            </label>
            <input
              id={labelId}
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={60}
              spellCheck={false}
              autoComplete="off"
              placeholder="e.g. Style guide"
              className="mt-1.5 block w-full rounded-lg border border-line bg-canvas/60 px-3 py-1.5 text-[13px] text-zinc-100 placeholder:text-zinc-500 focus:border-accent focus:outline-none"
            />
            <p className="mt-1.5 text-[12px] text-muted">Empty: the date and class count, e.g. “{formatSourceDate(new Date())} · 142 classes”.</p>
          </div>
          <div className="min-w-0">
            <label htmlFor={SITE_PASTE_ID} className="text-[13px] font-medium text-zinc-200">
              Paste a page here
            </label>
            <textarea
              id={SITE_PASTE_ID}
              value=""
              onChange={() => undefined}
              onPaste={onPaste}
              rows={3}
              spellCheck={false}
              aria-describedby={stepsId}
              aria-busy={busy !== null}
              placeholder={busy ? 'Working…' : `Click here and press ${modKey}+V after copying the page wrapper in the Webflow Designer`}
              className="mt-1.5 block w-full resize-none rounded-lg border border-dashed border-accent/50 bg-accent/5 px-3 py-2 text-[13px] text-zinc-100 placeholder:text-zinc-400 focus:border-accent focus:outline-none"
            />
            {busy ? (
              <div role="status" aria-live="polite" className="mt-1.5" data-testid="library-busy">
                <div className="flex items-center justify-between text-[12px] text-zinc-300">
                  <span>{busy.text}</span>
                  <span className="font-mono tabular-nums text-muted">{Math.round(busy.done * 100)}%</span>
                </div>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/5">
                  <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${Math.max(4, Math.round(busy.done * 100))}%` }} />
                </div>
              </div>
            ) : (
              <p role="status" aria-live="polite" className={`mt-1.5 min-h-[1.25rem] text-[12px] ${feedback?.kind === 'error' ? 'text-err' : 'text-emerald-300'}`}>
                {feedback?.text ?? ''}
              </p>
            )}
          </div>
        </div>

        {last && <AnalysisView title={`Just added: “${last.label}”`} analysis={last.analysis} skipped={last.skipped} testId="last-analysis" />}

        {hasLibrary && (
          <section className="grid gap-3 rounded-lg border border-line bg-canvas/40 p-3" aria-label="Style guide library">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[13px] font-semibold text-zinc-100">Your library</h3>
              <label className="ml-auto flex items-center gap-2 text-[12px] text-zinc-300">
                <input type="checkbox" checked={enabled} onChange={(e) => onStateChange({ ...state, enabled: e.target.checked })} className="accent-[#4f8cff]" />
                Use it when converting
              </label>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  if (typeof window !== 'undefined' && typeof window.confirm === 'function' && !window.confirm('Remove every source from the style guide library?')) return;
                  onStateChange({ ...state, library: { sources: [], classes: new Map() } });
                  setLast(null);
                  setFeedback(null);
                }}
              >
                Clear all
              </button>
            </div>
            <AnalysisView analysis={total} testId="library-analysis" />
            <ul className="space-y-1" data-testid="library-sources">
              {library.sources.map((s) => (
                <SourceRow
                  key={s.id}
                  source={s}
                  classCount={baseClassCount(sourceClasses(library, s))}
                  renaming={renaming?.id === s.id ? renaming.text : null}
                  onRenameStart={() => setRenaming({ id: s.id, text: s.label })}
                  onRenameChange={(text) => setRenaming({ id: s.id, text })}
                  onRenameCommit={commitRename}
                  onRenameCancel={() => setRenaming(null)}
                  onRemove={() => {
                    onStateChange({ ...state, library: removeLibrarySource(library, s.id) });
                    setFeedback(null);
                  }}
                />
              ))}
            </ul>
            {saveResult === 'quota' && (
              <p className="text-[12px] text-warn">The library is too big for this browser's storage, so it lasts until you reload the page. Remove some sources (CSS sources are usually the largest) to save it.</p>
            )}
            {saveResult === 'unavailable' && <p className="text-[12px] text-warn">This browser blocked saving, so the library lasts until you reload the page.</p>}
          </section>
        )}

        <details className="group/css rounded-lg border border-line">
          <summary className="flex cursor-pointer select-none items-center gap-2 px-3 py-2 text-[13px] font-medium text-zinc-200">
            <ChevronIcon width={12} height={12} className="transition-transform group-open/css:rotate-90" />
            Also add your published site's CSS <span className="font-normal text-muted">(names and CSS only)</span>
          </summary>
          <div className="grid gap-3 border-t border-line p-3">
            <p className="text-[12px] leading-snug text-muted">
              Classes from CSS decide which names are taken and when to create a separate class, but cannot be pasted as your site's own (only a Designer copy can). Webflow pages usually block other sites from reading them; if fetching fails, paste the CSS or upload the file.
            </p>
            <div className="min-w-0">
              <label htmlFor={urlId} className="text-[13px] font-medium text-zinc-200">
                Site or stylesheet URL
              </label>
              <div className="mt-1.5 flex gap-2">
                <input
                  id={urlId}
                  type="url"
                  value={cssUrl}
                  onChange={(e) => setCssUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), onFetch())}
                  spellCheck={false}
                  autoComplete="off"
                  placeholder="https://your-site.webflow.io"
                  className="block min-w-0 flex-1 rounded-lg border border-line bg-canvas/60 px-3 py-1.5 text-[13px] text-zinc-100 placeholder:text-zinc-500 focus:border-accent focus:outline-none"
                />
                <button type="button" className="btn-secondary shrink-0" onClick={onFetch} disabled={busy !== null || !cssUrl.trim()}>
                  Fetch CSS
                </button>
              </div>
            </div>
            <div className="min-w-0">
              <label htmlFor={cssId} className="text-[13px] font-medium text-zinc-200">
                Or paste the CSS
              </label>
              <textarea
                id={cssId}
                value={cssText}
                onChange={(e) => setCssText(e.target.value)}
                rows={3}
                spellCheck={false}
                placeholder=".padding-global { padding-left: 2.5rem; padding-right: 2.5rem; }"
                className="mt-1.5 block w-full resize-y rounded-lg border border-line bg-canvas/60 px-3 py-2 font-mono text-[12px] text-zinc-100 placeholder:text-zinc-500 focus:border-accent focus:outline-none"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" className="btn-secondary" onClick={onAddCss} disabled={busy !== null || !cssText.trim()}>
                  Add CSS
                </button>
                <button type="button" className="btn-ghost" onClick={() => fileRef.current?.click()} disabled={busy !== null}>
                  Upload .css file
                </button>
                <input ref={fileRef} type="file" accept=".css,text/css" className="hidden" onChange={onFile} />
              </div>
            </div>
          </div>
        </details>

        <div className="grid gap-x-6 gap-y-4 md:grid-cols-2">
          <Choice
            legend="Same class name, different CSS"
            name="site-conflicts"
            value={conflicts}
            onChange={onConflictsChange}
            choices={[
              {
                value: 'rename',
                label: 'Create a separate class',
                hint: 'When your library has a class of the same name with any other CSS (e.g. another hero’s section_hero), yours is pasted as a separate class (section_hero-corbel) with your CSS, under a name no class of the library has. Only classes with identical CSS are reused (16px counts as 1rem).',
              },
              {
                value: 'reuse',
                label: 'Use the site’s class',
                hint: 'Same-named classes take your site’s styles; your differing CSS is dropped, so the pasted section looks like your site. Combo classes still get their own names. Classes known only from CSS keep their own styles.',
              },
            ]}
          />
          <Choice
            legend="Client-First utilities not in the library"
            name="site-empty-utilities"
            value={emptyUtilities ? 'on' : 'off'}
            onChange={(v) => onEmptyUtilitiesChange(v === 'on')}
            choices={[
              { value: 'off', label: 'Off', hint: 'Utilities keep the source CSS. If they are not in the library, Webflow adds “name 2” when your site’s version differs.' },
              {
                value: 'on',
                label: 'Empty styles (experimental)',
                hint: 'Utilities not in the library are pasted with no styles, so your site’s apply if Webflow reuses them. Not confirmed: if it renames them, they are unstyled.',
              },
            ]}
          />
        </div>
      </div>
    </details>
  );
}

/** Counts and lists of an analysis, with "name 2" duplicates as a warning. */
function AnalysisView({ analysis: a, title, skipped = 0, testId }: { analysis: StyleGuideAnalysis; title?: string; skipped?: number; testId?: string }) {
  const chips: { label: string; value: number | string; hint: string }[] = [
    { label: 'Classes', value: a.classCount, hint: 'Base classes (combos not counted)' },
    { label: 'Utility', value: a.utilities.length, hint: 'Client-First utility and core classes' },
    { label: 'Custom', value: a.custom.length, hint: 'Every other base class' },
    { label: 'Combos', value: a.combos.length, hint: 'Combo classes, e.g. button.is-secondary' },
    { label: 'Variables', value: a.variables.length, hint: 'Variables the styles refer to (if the copy includes them)' },
    { label: 'Breakpoints', value: a.breakpoints.length, hint: 'Breakpoints with styles' },
  ];
  const lists: { label: string; items: string[] }[] = [
    { label: 'Utility classes', items: a.utilities },
    { label: 'Custom classes', items: a.custom },
    { label: 'Combo classes', items: a.combos.map((c) => (c.parent ? `${c.parent}.${c.name}` : c.name)) },
    { label: 'Variables', items: a.variables },
    { label: 'Breakpoints', items: a.breakpoints.map((b) => BREAKPOINT_LABEL[b] ?? b) },
    { label: 'States', items: a.states },
  ].filter((l) => l.items.length > 0);
  return (
    <div className="grid gap-2" data-testid={testId}>
      {title && <h3 className="text-[13px] font-semibold text-zinc-100">{title}</h3>}
      <dl className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {chips.map((c) => (
          <div key={c.label} title={c.hint} className="rounded-lg border border-line bg-canvas/60 px-2.5 py-1.5">
            <dt className="truncate text-[10px] font-medium uppercase tracking-wider text-muted">{c.label}</dt>
            <dd className="font-mono text-base font-semibold tabular-nums text-white">{c.value}</dd>
          </div>
        ))}
      </dl>
      {a.duplicates.length > 0 && (
        <div role="note" className="flex gap-2 rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-[12px] leading-snug text-amber-100" data-testid="duplicate-classes">
          <AlertIcon width={14} height={14} className="mt-0.5 shrink-0 text-warn" />
          <p>
            Your site already has {plural(a.duplicates.length, 'numbered duplicate')} ({a.duplicates.slice(0, 6).map((d) => `“${d.name}”`).join(', ')}
            {a.duplicates.length > 6 ? '…' : ''}): Webflow made {a.duplicates.length === 1 ? 'it' : 'them'} when a pasted class clashed. Consider merging {a.duplicates.length === 1 ? 'it' : 'them'} into the original class in the Designer.
          </p>
        </div>
      )}
      {(a.fromCss > 0 || skipped > 0) && (
        <p className="text-[12px] text-muted">
          {a.fromCss > 0 && `${plural(a.fromCss, 'class', 'classes')} from CSS only. `}
          {skipped > 0 && `${plural(skipped, 'CSS selector')} could not become a class (descendants, other media…) and ${skipped === 1 ? 'was' : 'were'} skipped.`}
        </p>
      )}
      {lists.length > 0 && (
        <details className="text-[12px]">
          <summary className="cursor-pointer text-muted hover:text-zinc-200">Show lists</summary>
          <div className="mt-1 grid gap-1.5">
            {lists.map((l) => (
              <p key={l.label} className="break-words text-zinc-300">
                <span className="font-medium text-zinc-200">{l.label}:</span> <span className="font-mono text-[11px] text-muted">{l.items.join(', ')}</span>
              </p>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

/** One source of the library: label (renamable), kind, date, class count, remove. */
function SourceRow(props: {
  source: LibrarySource;
  classCount: number;
  renaming: string | null;
  onRenameStart: () => void;
  onRenameChange: (text: string) => void;
  onRenameCommit: () => void;
  onRenameCancel: () => void;
  onRemove: () => void;
}) {
  const { source: s, classCount, renaming } = props;
  const date = s.addedAt && !Number.isNaN(Date.parse(s.addedAt)) ? formatSourceDate(new Date(s.addedAt)) : '';
  return (
    <li className="flex flex-wrap items-center gap-2 rounded-md px-2 py-1 hover:bg-white/[0.03]">
      {renaming !== null ? (
        <input
          type="text"
          value={renaming}
          autoFocus
          maxLength={60}
          aria-label={`New label for ${s.label}`}
          onChange={(e) => props.onRenameChange(e.target.value)}
          onBlur={props.onRenameCommit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') props.onRenameCommit();
            if (e.key === 'Escape') props.onRenameCancel();
          }}
          className="min-w-0 flex-1 rounded-md border border-accent bg-canvas/60 px-2 py-0.5 text-[13px] text-zinc-100 focus:outline-none"
        />
      ) : (
        <span className="min-w-0 flex-1 truncate text-[13px] text-zinc-200" title={s.url ?? s.label}>
          {s.label}
        </span>
      )}
      <span className="shrink-0 rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted">{KIND_LABEL[s.kind]}</span>
      {date && <span className="shrink-0 text-[11px] text-muted">{date}</span>}
      <span className="shrink-0 font-mono text-[11px] text-muted">{plural(classCount, 'class', 'classes')}</span>
      {renaming === null && (
        <button type="button" className="btn-ghost shrink-0" onClick={props.onRenameStart} aria-label={`Rename ${s.label}`}>
          Rename
        </button>
      )}
      <button type="button" className="btn-ghost shrink-0" aria-label={`Remove ${s.label}`} onClick={props.onRemove}>
        <CloseIcon width={12} height={12} />
        Remove
      </button>
    </li>
  );
}

function Choice<T extends string>({ legend, name, choices, value, onChange }: { legend: string; name: string; choices: { value: T; label: string; hint: string }[]; value: T; onChange: (v: T) => void }) {
  const hintId = useId();
  const current = choices.find((c) => c.value === value) ?? choices[0]!;
  return (
    <fieldset className="min-w-0" aria-describedby={hintId}>
      <legend className="text-[13px] font-medium text-zinc-200">{legend}</legend>
      <div className="mt-1.5 flex flex-wrap gap-0.5 rounded-lg border border-line bg-canvas/60 p-0.5 sm:inline-flex">
        {choices.map((c) => (
          <label
            key={c.value}
            className="flex-1 cursor-pointer select-none whitespace-nowrap rounded-md px-2.5 py-1 text-center text-xs font-medium text-muted transition-colors hover:text-zinc-100 has-[:checked]:bg-accent/20 has-[:checked]:text-white has-[:checked]:ring-1 has-[:checked]:ring-inset has-[:checked]:ring-accent/40 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent-hover sm:flex-none"
          >
            <input type="radio" className="sr-only" name={name} value={c.value} checked={c.value === value} onChange={() => onChange(c.value)} />
            {c.label}
          </label>
        ))}
      </div>
      <p id={hintId} className="mt-1.5 text-[12px] leading-snug text-muted">
        {current.hint}
      </p>
    </fieldset>
  );
}
