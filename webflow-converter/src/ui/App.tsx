import { useCallback, useState } from 'react';
import { convert } from '../engine';
import { copyToWebflow, isSafari } from '../engine/clipboard';
import type { ConvertInput, ConvertResult, InputMode } from '../engine/types';
import { CodeEditor } from './components/CodeEditor';
import { ConvertButton } from './components/ConvertButton';
import { InputTabs } from './components/InputTabs';
import { PromptHelper } from './components/PromptHelper';
import { ResultPanel } from './components/ResultPanel';
import { Toast, type ToastMessage } from './components/Toast';

/**
 * Root component. Holds all editor state, runs `convert()` and copies the result with
 * `copyToWebflow()` in the same click (the clipboard write needs a user gesture).
 *
 * Ownership: ui. The UI agent owns layout and styling; the engine contract is `convert`,
 * `copyToWebflow` and the types in src/engine/types.ts.
 */
export default function App() {
  const [mode, setMode] = useState<InputMode>('combined');
  const [html, setHtml] = useState('');
  const [css, setCss] = useState('');
  const [js, setJs] = useState('');
  const [result, setResult] = useState<ConvertResult | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const dismissToast = useCallback(() => setToast(null), []);

  const copy = (json: string) => {
    void copyToWebflow(json).then((ok) =>
      setToast(
        ok
          ? { kind: 'success', message: 'Copied. Select an element in the Webflow Designer and press Ctrl/Cmd+V.' }
          : { kind: 'error', message: 'Copy failed. Use a Chromium browser (Chrome, Edge, Arc, Brave).' },
      ),
    );
  };

  const handleConvert = () => {
    const input: ConvertInput = mode === 'combined' ? { mode, html } : { mode, html, css, js };
    const res = convert(input);
    setResult(res);
    copy(res.json);
  };

  const hasInput = html.trim() !== '' || (mode === 'separate' && (css.trim() !== '' || js.trim() !== ''));

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-4 px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-white">HTML to Webflow</h1>
          <p className="text-sm text-muted">Paste AI-generated HTML, CSS and JS. Get native Webflow elements on your clipboard.</p>
        </div>
        <InputTabs mode={mode} onModeChange={setMode} />
      </header>

      {isSafari() && (
        <p className="rounded-md border border-warn/40 px-3 py-2 text-sm text-warn">
          Safari cannot pass Webflow data between sites. Use Chrome, Edge, Arc or Brave.
        </p>
      )}

      <PromptHelper onCopied={(ok) => setToast(ok ? { kind: 'info', message: 'Prompt copied.' } : { kind: 'error', message: 'Could not copy the prompt.' })} />

      <main className="flex flex-col gap-3">
        {mode === 'combined' ? (
          <CodeEditor label="HTML (with <style> and <script>)" language="html" value={html} onChange={setHtml} placeholder={'<section class="hero">…</section>'} />
        ) : (
          <div className="grid gap-3 lg:grid-cols-3">
            <CodeEditor label="HTML" language="html" value={html} onChange={setHtml} placeholder={'<div class="card">…</div>'} />
            <CodeEditor label="CSS" language="css" value={css} onChange={setCss} placeholder=".card { padding: 2rem; }" />
            <CodeEditor label="JS" language="js" value={js} onChange={setJs} placeholder="document.querySelector('.card')…" />
          </div>
        )}
        <div>
          <ConvertButton onClick={handleConvert} disabled={!hasInput} />
        </div>
      </main>

      <ResultPanel result={result} onCopyAgain={result ? () => copy(result.json) : undefined} />
      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  );
}
