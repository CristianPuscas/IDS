import { useId, useLayoutEffect, useMemo, useRef, type KeyboardEvent } from 'react';
import { countLines, handleEditorKey, type EditorState } from '../lib/editorKeys';

/** Language of a {@link CodeEditor}, shown as a badge. */
export type CodeLanguage = 'html' | 'css' | 'js';

/** Props for {@link CodeEditor}. */
export interface CodeEditorProps {
  /** Visible label above the editor, e.g. "HTML". */
  label: string;
  language: CodeLanguage;
  value: string;
  /** Called with the full new text on every edit. */
  onChange: (value: string) => void;
  placeholder?: string;
  /** Optional DOM id for the textarea. Defaults to a generated id. */
  id?: string;
  /** Shows a "Load example" button when provided. */
  onLoadExample?: () => void;
  /** Tailwind height class for the text area, e.g. `h-96`. */
  heightClass?: string;
}

const BADGE: Record<CodeLanguage, string> = {
  html: 'text-orange-300 bg-orange-400/10 ring-orange-400/25',
  css: 'text-sky-300 bg-sky-400/10 ring-sky-400/25',
  js: 'text-yellow-200 bg-yellow-400/10 ring-yellow-400/25',
};

const nf = new Intl.NumberFormat('en-US');

/**
 * Dependency-free code editor: monospace textarea with a synced line-number gutter.
 * Tab indents by two spaces, Shift+Tab outdents. Press Esc, then Tab, to move focus out.
 * Ownership: ui.
 */
export function CodeEditor({ label, language, value, onChange, placeholder, id, onLoadExample, heightClass = 'h-96' }: CodeEditorProps) {
  const autoId = useId();
  const editorId = id ?? `editor-${language}-${autoId}`;
  const hintId = `${editorId}-hint`;
  const taRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const pendingSel = useRef<[number, number] | null>(null);
  const tabEscape = useRef(false);

  const lines = useMemo(() => countLines(value), [value]);
  const gutterText = useMemo(() => Array.from({ length: lines }, (_, i) => i + 1).join('\n'), [lines]);

  // Restore the caret after a programmatic edit (Tab / Shift+Tab).
  useLayoutEffect(() => {
    const sel = pendingSel.current;
    const ta = taRef.current;
    if (sel && ta) {
      ta.setSelectionRange(sel[0], sel[1]);
      pendingSel.current = null;
    }
  }, [value]);

  const syncScroll = () => {
    const ta = taRef.current;
    const g = gutterRef.current;
    if (ta && g) g.style.transform = `translateY(${-ta.scrollTop}px)`;
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      tabEscape.current = true;
      return;
    }
    if (e.key === 'Tab' && tabEscape.current) {
      tabEscape.current = false;
      return; // let focus move on
    }
    tabEscape.current = false;
    const ta = e.currentTarget;
    const state: EditorState = { value: ta.value, start: ta.selectionStart, end: ta.selectionEnd };
    const next = handleEditorKey(e, state);
    if (!next) return;
    e.preventDefault();
    if (next.value !== state.value) {
      pendingSel.current = [next.start, next.end];
      onChange(next.value);
    } else {
      ta.setSelectionRange(next.start, next.end);
    }
  };

  return (
    <div className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-surface transition-colors focus-within:border-accent/70 focus-within:ring-2 focus-within:ring-accent/25">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
        <span className={`rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold uppercase ring-1 ring-inset ${BADGE[language]}`}>
          {language}
        </span>
        <label htmlFor={editorId} className="truncate text-sm font-medium text-zinc-200">
          {label}
        </label>
        <div className="ml-auto flex items-center gap-1">
          {onLoadExample && (
            <button type="button" onClick={onLoadExample} className="btn-ghost">
              Load example
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              onChange('');
              taRef.current?.focus();
            }}
            disabled={value === ''}
            className="btn-ghost"
            aria-label={`Clear ${label}`}
          >
            Clear
          </button>
        </div>
      </div>

      <div className="relative flex min-h-0 bg-[#0d0d11]">
        <div className="pointer-events-none relative w-11 shrink-0 select-none overflow-hidden border-r border-line/70 bg-surface/60" aria-hidden="true">
          <div ref={gutterRef} className="absolute inset-x-0 top-0 whitespace-pre px-2 py-3 text-right font-mono text-[13px] leading-6 text-zinc-600 will-change-transform">
            {gutterText}
          </div>
        </div>
        <textarea
          ref={taRef}
          id={editorId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onScroll={syncScroll}
          placeholder={placeholder}
          aria-describedby={hintId}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          wrap="off"
          className={`code-scroll block min-w-0 flex-1 resize-y whitespace-pre bg-transparent px-3 py-3 font-mono text-[13px] leading-6 text-zinc-100 caret-accent outline-none placeholder:text-zinc-600 focus-visible:outline-none ${heightClass} min-h-40`}
        />
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-1.5 font-mono text-[11px] text-muted">
        <span id={hintId}>
          <span className="hidden sm:inline">Tab indents · Shift+Tab outdents · Esc then Tab to leave</span>
          <span className="sm:hidden">Tab indents · Esc, Tab to leave</span>
        </span>
        <span className="shrink-0 tabular-nums">
          {nf.format(lines)} {lines === 1 ? 'line' : 'lines'} · {nf.format(value.length)} chars
        </span>
      </div>
    </div>
  );
}
