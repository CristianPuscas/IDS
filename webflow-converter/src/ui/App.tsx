import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { convertAsync } from '../engine';
import { copyToWebflow, isSafari } from '../engine/clipboard';
import type { ConvertResult, InputMode } from '../engine/types';
import { AdvancedOptionsPanel, CLASS_PREFIX_INPUT_ID } from './components/AdvancedOptions';
import { CodeEditor } from './components/CodeEditor';
import { ConvertButton, type ConvertStatus } from './components/ConvertButton';
import { HowItWorks } from './components/HowItWorks';
import { AlertIcon, LogoMark } from './components/icons';
import { InputTabs, panelId, tabId } from './components/InputTabs';
import { PromptHelper } from './components/PromptHelper';
import { ResultPanel } from './components/ResultPanel';
import { Tips } from './components/Tips';
import { Toast, type ToastAction, type ToastMessage } from './components/Toast';
import { EXAMPLE_COMBINED, EXAMPLE_SEPARATE } from './examples';
import { copyText } from './lib/clipboardText';
import { downloadText } from './lib/download';
import { buildConvertInput, EMPTY_DRAFTS, hasConvertibleInput, loadPersisted, savePersisted, type Drafts } from './lib/drafts';
import { loadAdvanced, saveAdvanced, toConvertOptions, type AdvancedOptions } from './lib/options';
import { isConvertShortcut, isMacPlatform } from './lib/platform';

const TABS_ID = 'input';
const JSON_FILE = 'webflow-paste.json';

/**
 * Root component. Holds editor state, runs `convert()` and copies the result with
 * `copyToWebflow()` in the same click / keypress (the clipboard write needs a user gesture,
 * so nothing is awaited before it).
 *
 * Ownership: ui. Engine contract: `convert`, `copyToWebflow`, `isSafari`, src/engine/types.ts.
 */
export default function App() {
  const initial = useMemo(() => loadPersisted(), []);
  const [mode, setMode] = useState<InputMode>(initial?.mode ?? 'combined');
  const [drafts, setDrafts] = useState<Drafts>(initial?.drafts ?? EMPTY_DRAFTS);
  const [result, setResult] = useState<{ id: number; value: ConvertResult } | null>(null);
  const [status, setStatus] = useState<ConvertStatus>('idle');
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [options, setOptions] = useState<AdvancedOptions>(() => loadAdvanced());
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const toastSeq = useRef(0);
  const statusTimer = useRef<number | undefined>(undefined);

  const safari = useMemo(() => isSafari(), []);
  const modKey = useMemo(() => (isMacPlatform() ? '⌘' : 'Ctrl'), []);
  const canConvert = hasConvertibleInput(mode, drafts);

  // Persist drafts (debounced). savePersisted swallows quota / privacy-mode errors.
  useEffect(() => {
    const t = window.setTimeout(() => savePersisted({ mode, drafts }), 300);
    return () => window.clearTimeout(t);
  }, [mode, drafts]);

  // Persist the advanced options. saveAdvanced swallows quota / privacy-mode errors.
  useEffect(() => {
    saveAdvanced(options);
  }, [options]);

  useEffect(() => () => window.clearTimeout(statusTimer.current), []);

  const focusClassPrefix = useCallback(() => {
    setAdvancedOpen(true);
    window.setTimeout(() => {
      const input = document.getElementById(CLASS_PREFIX_INPUT_ID) as HTMLInputElement | null;
      input?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      input?.focus({ preventScroll: true });
    }, 50);
  }, []);

  const showToast = useCallback((t: Omit<ToastMessage, 'id'>) => {
    toastSeq.current += 1;
    setToast({ ...t, id: toastSeq.current });
  }, []);
  const dismissToast = useCallback(() => setToast(null), []);

  const setCombined = (html: string) => setDrafts((d) => ({ ...d, combined: { html } }));
  const setSeparate = (key: keyof Drafts['separate']) => (v: string) =>
    setDrafts((d) => ({ ...d, separate: { ...d.separate, [key]: v } }));

  const download = useCallback(
    (json: string) => {
      if (!downloadText(json, JSON_FILE)) showToast({ kind: 'error', title: 'Download failed', message: 'Your browser blocked the file download.' });
    },
    [showToast],
  );

  /** Must be called synchronously from a user gesture. */
  const copyResult = useCallback(
    (res: ConvertResult) => {
      const pending = copyToWebflow(res.json); // no await before this line
      void pending.then((ok) => {
        if (ok) {
          const n = res.warnings.length;
          showToast({
            kind: 'success',
            title: 'Copied to Clipboard! Ready to paste in Webflow',
            message: `Select an element in the Designer and press ${modKey}+V.${n ? ` ${n} note${n === 1 ? '' : 's'} below.` : ''}`,
          });
          return;
        }
        const actions: ToastAction[] = [
          { label: 'Retry copy', onClick: () => copyResult(res) },
          { label: 'Download JSON', onClick: () => download(res.json) },
          {
            label: 'Copy raw JSON',
            onClick: () => {
              void copyText(res.json).then((done) =>
                showToast(
                  done
                    ? { kind: 'info', title: 'Raw JSON copied as text', message: 'Use it for debugging or a paste helper. Webflow itself needs the native copy.' }
                    : { kind: 'error', title: 'Could not copy the JSON', message: 'Use Download JSON instead.' },
                ),
              );
            },
          },
        ];
        showToast({
          kind: 'error',
          title: 'Could not copy to the clipboard',
          message: safari
            ? 'Safari blocks Webflow clipboard data between sites. Use Chrome, Edge, Arc or Brave, or download the JSON.'
            : 'The browser refused the clipboard write. Try again, or download the JSON.',
          actions,
        });
      });
      return pending;
    },
    [download, modKey, safari, showToast],
  );

  const handleConvert = useCallback(() => {
    if (!hasConvertibleInput(mode, drafts) || status === 'busy') return;
    setStatus('busy');
    window.clearTimeout(statusTimer.current);

    // convertAsync settles right away unless a script needs terser (loaded once, on demand); the
    // copy then still runs within the click's user-activation window.
    convertAsync(buildConvertInput(mode, drafts), toConvertOptions(options))
      .then((res: ConvertResult) => {
        setResult((prev) => ({ id: (prev?.id ?? 0) + 1, value: res }));
        return copyResult(res);
      })
      .then((ok) => {
        setStatus(ok ? 'done' : 'idle');
        if (ok) statusTimer.current = window.setTimeout(() => setStatus('idle'), 1800);
      })
      .catch((err: unknown) => {
        setStatus('idle');
        showToast({
          kind: 'error',
          title: 'Conversion failed',
          message: err instanceof Error ? err.message : 'The converter hit an unexpected error. Check the input and try again.',
        });
      });
  }, [copyResult, drafts, mode, options, showToast, status]);

  // Global shortcut: Ctrl/Cmd+Enter. A keydown is a user gesture, so the copy is allowed.
  const convertRef = useRef(handleConvert);
  useLayoutEffect(() => {
    convertRef.current = handleConvert;
  }, [handleConvert]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isConvertShortcut(e)) return;
      e.preventDefault();
      convertRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const loadExample = () => {
    if (mode === 'combined') setCombined(EXAMPLE_COMBINED);
    else setDrafts((d) => ({ ...d, separate: { ...EXAMPLE_SEPARATE } }));
  };
  const clearAll = () => {
    if (mode === 'combined') setCombined('');
    else setDrafts((d) => ({ ...d, separate: { html: '', css: '', js: '' } }));
  };
  const tabEmpty = !canConvert;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-line/80 bg-canvas/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
          <LogoMark className="shrink-0" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[15px] font-semibold tracking-tight text-white sm:text-base">HTML to Webflow Converter</h1>
            <p className="hidden truncate text-[13px] text-muted sm:block">Paste AI-generated HTML, CSS and JS. Get native Webflow elements on your clipboard.</p>
          </div>
          <HowItWorks modKey={modKey} />
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-7xl flex-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_21rem] lg:py-8">
        <div className="flex min-w-0 flex-col gap-4">
          <p className="text-[13px] text-muted sm:hidden">Paste AI-generated code. Get native Webflow elements on your clipboard.</p>

          {safari && (
            <div role="note" className="flex gap-2.5 rounded-xl border border-warn/30 bg-warn/5 px-4 py-3 text-[13px] leading-relaxed text-amber-200">
              <AlertIcon width={16} height={16} className="mt-0.5 shrink-0 text-warn" />
              <p>Safari doesn't pass Webflow clipboard data between sites, so pasting may fail. Use Chrome, Edge, Arc or Brave, or download the JSON after converting.</p>
            </div>
          )}

          <section aria-label="Code input" className="card">
            <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
              <InputTabs mode={mode} onModeChange={setMode} idPrefix={TABS_ID} />
              <div className="ml-auto flex items-center gap-1">
                <button type="button" onClick={loadExample} className="btn-ghost">
                  Load example
                </button>
                <button type="button" onClick={clearAll} disabled={tabEmpty} className="btn-ghost">
                  Clear all
                </button>
              </div>
            </div>

            <div role="tabpanel" id={panelId(TABS_ID, 'combined')} aria-labelledby={tabId(TABS_ID, 'combined')} hidden={mode !== 'combined'} className="p-3">
              <CodeEditor
                id="editor-combined"
                label="index.html with <style> and <script>"
                language="html"
                value={drafts.combined.html}
                onChange={setCombined}
                onLoadExample={() => setCombined(EXAMPLE_COMBINED)}
                placeholder={'<!-- Paste a full HTML file from Claude / ChatGPT -->\n<section class="section_hero">\n  …\n</section>\n<style>…</style>\n<script>…</script>'}
                heightClass="h-[26rem] lg:h-[32rem]"
              />
            </div>

            <div role="tabpanel" id={panelId(TABS_ID, 'separate')} aria-labelledby={tabId(TABS_ID, 'separate')} hidden={mode !== 'separate'} className="p-3">
              <div className="grid gap-3 xl:grid-cols-3">
                <CodeEditor
                  id="editor-sep-html"
                  label="index.html"
                  language="html"
                  value={drafts.separate.html}
                  onChange={setSeparate('html')}
                  onLoadExample={() => setSeparate('html')(EXAMPLE_SEPARATE.html)}
                  placeholder={'<section class="section_hero">…</section>'}
                  heightClass="h-72 xl:h-[30rem]"
                />
                <CodeEditor
                  id="editor-sep-css"
                  label="styles.css"
                  language="css"
                  value={drafts.separate.css}
                  onChange={setSeparate('css')}
                  onLoadExample={() => setSeparate('css')(EXAMPLE_SEPARATE.css)}
                  placeholder=".hero_title { font-size: 4rem; }"
                  heightClass="h-72 xl:h-[30rem]"
                />
                <CodeEditor
                  id="editor-sep-js"
                  label="script.js"
                  language="js"
                  value={drafts.separate.js}
                  onChange={setSeparate('js')}
                  onLoadExample={() => setSeparate('js')(EXAMPLE_SEPARATE.js)}
                  placeholder="document.querySelectorAll('[data-reveal]')…"
                  heightClass="h-72 xl:h-[30rem]"
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-line p-3 sm:flex-row sm:items-center">
              <ConvertButton onClick={handleConvert} disabled={!canConvert} status={status} modKey={modKey} />
              <p className="text-[13px] leading-snug text-muted">
                {canConvert ? (
                  <>
                    Then select an element in the Webflow Designer and press <kbd className="kbd">{modKey}+V</kbd>.
                  </>
                ) : (
                  'Paste your code, or load the example, to get started.'
                )}
              </p>
            </div>
          </section>

          <AdvancedOptionsPanel value={options} onChange={setOptions} open={advancedOpen} onOpenChange={setAdvancedOpen} />

          {result ? (
            <ResultPanel
              key={result.id}
              result={result.value}
              onCopyAgain={() => void copyResult(result.value)}
              onDownload={() => download(result.value.json)}
              onSetPrefix={focusClassPrefix}
            />
          ) : (
            <div className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-[13px] text-muted">
              Stats, warnings and the JSON preview appear here after you convert.
            </div>
          )}
        </div>

        <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-20 lg:self-start" aria-label="AI prompt and tips">
          <PromptHelper onCopied={(ok) => !ok && showToast({ kind: 'error', title: 'Could not copy the prompt', message: 'Open the preview and copy the text manually.' })} />
          <Tips />
        </aside>
      </main>

      <footer className="border-t border-line/70">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-[12px] text-muted sm:px-6">
          <span>Runs locally in your browser. Nothing is uploaded.</span>
          <span>Best in Chrome, Edge, Arc or Brave.</span>
        </div>
      </footer>

      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  );
}
