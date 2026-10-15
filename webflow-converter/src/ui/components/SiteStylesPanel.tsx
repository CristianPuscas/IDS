import { useId, useState, type ClipboardEvent } from 'react';
import { parseSiteStyles } from '../../engine/siteStyles';
import type { SiteClassOverrides } from '../../engine/types';
import { activeSite, classCount, importIntoLibrary, readClipboardPayload, removeFromLibrary, type SiteLibrary } from '../lib/siteLibrary';
import { ChevronIcon, CloseIcon } from './icons';

/** Id of the paste box, so other parts of the UI can focus it. */
export const SITE_PASTE_ID = 'site-styles-paste';

/** Props for {@link SiteStylesPanel}. */
export interface SiteStylesPanelProps {
  library: SiteLibrary;
  onLibraryChange: (next: SiteLibrary) => void;
  /** `false` when the last save to localStorage failed. */
  saved: boolean;
  overrides: SiteClassOverrides;
  onOverridesChange: (v: SiteClassOverrides) => void;
  emptyUtilities: boolean;
  onEmptyUtilitiesChange: (v: boolean) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modKey: string;
}

type Feedback = { kind: 'ok' | 'error'; text: string } | null;

/** One-line status, e.g. `142 classes from "My site"`. */
export function siteStatus(library: SiteLibrary): string {
  const site = activeSite(library);
  if (!site) return 'Site styles: none';
  const n = classCount(site);
  return `Site styles: ${n} class${n === 1 ? '' : 'es'} from "${site.label}"`;
}

/**
 * "Reuse classes from your Webflow site": the user copies an element in the Webflow Designer and
 * pastes it here. The site's class styles are stored (several sites, merge or replace) and passed
 * to `convert()` as `siteStyles`, so matching classes are pasted as the site's own instead of
 * "name 2" duplicates (spec 3.6).
 *
 * Ownership: ui.
 */
export function SiteStylesPanel(props: SiteStylesPanelProps) {
  const { library, onLibraryChange, saved, overrides, onOverridesChange, emptyUtilities, onEmptyUtilitiesChange, open, onOpenChange, modKey } = props;
  const current = activeSite(library);
  const [label, setLabel] = useState(current?.label ?? 'My site');
  const [replace, setReplace] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const labelId = useId();
  const stepsId = useId();
  const radioName = useId();

  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    const text = readClipboardPayload(e.clipboardData);
    const parsed = parseSiteStyles(text);
    if (parsed.error) {
      setFeedback({ kind: 'error', text: parsed.error });
      return;
    }
    const next = importIntoLibrary(library, label, parsed.styles, replace ? 'replace' : 'merge');
    const site = activeSite(next)!;
    const got = parsed.styles.filter((s) => (s.comb ?? '') === '').length;
    setLabel(site.label);
    onLibraryChange(next);
    setFeedback({
      kind: 'ok',
      text: `${got} class${got === 1 ? '' : 'es'} imported into "${site.label}" (${classCount(site)} in total${parsed.styles.length > got ? `, plus ${parsed.styles.length - got} combo${parsed.styles.length - got === 1 ? '' : 's'}` : ''}).`,
    });
  };

  return (
    <details className="card group/site" open={open} onToggle={(e) => onOpenChange(e.currentTarget.open)}>
      <summary className="summary-row rounded-xl">
        <ChevronIcon width={14} height={14} className="transition-transform group-open/site:rotate-90" />
        Reuse classes from your Webflow site
        <span
          className={`ml-auto truncate rounded-full px-2 py-0.5 font-mono text-[11px] ring-1 ring-inset ${current ? 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30' : 'bg-white/5 text-muted ring-line'}`}
          data-testid="site-status"
        >
          {current ? `${classCount(current)} classes from "${current.label}"` : 'none'}
        </span>
      </summary>
      <div className="grid gap-4 border-t border-line p-4">
        <p className="text-[13px] leading-relaxed text-zinc-300">
          {siteStatus(library)}. Webflow only reuses a class it already has when the pasted class is <em>identical</em>; otherwise it adds{' '}
          <code className="font-mono text-[12px]">container-large 2</code>. Import your site's classes once, and matching classes are pasted as your site's own.
        </p>
        <ol id={stepsId} className="list-decimal space-y-1 pl-5 text-[13px] leading-snug text-muted">
          <li>
            In the Webflow Designer, select the <span className="text-zinc-200">page wrapper</span> (or a section of your style guide page) and press{' '}
            <kbd className="kbd">{modKey}+C</kbd>.
          </li>
          <li>
            Click the box below and press <kbd className="kbd">{modKey}+V</kbd>. Paste more copies to add classes from other pages.
          </li>
          <li>Convert as usual: classes with the same name reuse your site's. Use Chrome, Edge, Arc or Brave.</li>
        </ol>

        <div className="grid gap-3 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
          <div className="min-w-0">
            <label htmlFor={labelId} className="text-[13px] font-medium text-zinc-200">
              Site name
            </label>
            <input
              id={labelId}
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={60}
              spellCheck={false}
              autoComplete="off"
              className="mt-1.5 block w-full rounded-lg border border-line bg-canvas/60 px-3 py-1.5 text-[13px] text-zinc-100 focus:border-accent focus:outline-none"
            />
            <label className="mt-2 flex items-center gap-2 text-[12px] text-muted">
              <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} className="accent-[#4f8cff]" />
              Replace this site's classes (instead of adding)
            </label>
          </div>
          <div className="min-w-0">
            <label htmlFor={SITE_PASTE_ID} className="text-[13px] font-medium text-zinc-200">
              Paste here
            </label>
            <textarea
              id={SITE_PASTE_ID}
              value=""
              onChange={() => undefined}
              onPaste={onPaste}
              rows={3}
              spellCheck={false}
              aria-describedby={stepsId}
              placeholder={`Click here and press ${modKey}+V after copying an element in the Webflow Designer`}
              className="mt-1.5 block w-full resize-none rounded-lg border border-dashed border-accent/50 bg-accent/5 px-3 py-2 text-[13px] text-zinc-100 placeholder:text-zinc-400 focus:border-accent focus:outline-none"
            />
            <p role="status" aria-live="polite" className={`mt-1.5 min-h-[1.25rem] text-[12px] ${feedback?.kind === 'error' ? 'text-err' : 'text-emerald-300'}`}>
              {feedback?.text ?? ''}
            </p>
          </div>
        </div>

        {library.sites.length > 0 && (
          <fieldset className="min-w-0">
            <legend className="text-[13px] font-medium text-zinc-200">Use classes from</legend>
            <ul className="mt-1.5 space-y-1">
              <li>
                <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-[13px] text-zinc-300 hover:bg-white/[0.03]">
                  <input type="radio" name={radioName} checked={library.activeId === null} onChange={() => onLibraryChange({ ...library, activeId: null })} className="accent-[#4f8cff]" />
                  None (don't reuse site classes)
                </label>
              </li>
              {library.sites.map((s) => (
                <li key={s.id} className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-white/[0.03]">
                  <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-[13px] text-zinc-200">
                    <input type="radio" name={radioName} checked={library.activeId === s.id} onChange={() => onLibraryChange({ ...library, activeId: s.id })} className="accent-[#4f8cff]" />
                    <span className="truncate">{s.label}</span>
                    <span className="shrink-0 font-mono text-[11px] text-muted">{classCount(s)} classes</span>
                  </label>
                  <button
                    type="button"
                    className="btn-ghost shrink-0"
                    aria-label={`Clear the classes imported for ${s.label}`}
                    onClick={() => {
                      onLibraryChange(removeFromLibrary(library, s.id));
                      setFeedback(null);
                    }}
                  >
                    <CloseIcon width={12} height={12} />
                    Clear
                  </button>
                </li>
              ))}
            </ul>
            {!saved && <p className="mt-1 text-[12px] text-warn">This browser blocked saving, so the import lasts until you reload the page.</p>}
          </fieldset>
        )}

        <div className="grid gap-x-6 gap-y-4 md:grid-cols-2">
          <Choice
            legend="When your CSS differs from the site's class"
            name="site-overrides"
            value={overrides}
            onChange={onOverridesChange}
            choices={[
              { value: 'embed', label: 'Keep my CSS', hint: 'The site’s class stays unchanged; your differing values go to the <style> embed and apply only to the pasted elements.' },
              { value: 'drop', label: 'Use the site’s', hint: 'The pasted elements look like the rest of your site; your differing values are dropped.' },
            ]}
          />
          <Choice
            legend="Client-First utilities without an import"
            name="site-empty-utilities"
            value={emptyUtilities ? 'on' : 'off'}
            onChange={(v) => onEmptyUtilitiesChange(v === 'on')}
            choices={[
              { value: 'off', label: 'Off', hint: 'Utilities keep the source CSS. Without an import, Webflow adds “name 2” if your site’s version differs.' },
              {
                value: 'on',
                label: 'Empty styles (experimental)',
                hint: 'Utilities not in the import are pasted with no styles, so your site’s apply if Webflow reuses them. Not confirmed: if it renames them, they are unstyled.',
              },
            ]}
          />
        </div>
      </div>
    </details>
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
