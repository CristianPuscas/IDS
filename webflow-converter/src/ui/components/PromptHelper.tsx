import { useEffect, useId, useRef, useState } from 'react';
import { copyText } from '../lib/clipboardText';
import { IDEAL_SYSTEM_PROMPT } from '../prompt';
import { CheckIcon, ChevronIcon, CopyIcon, SparkIcon } from './icons';

/** Props for {@link PromptHelper}. */
export interface PromptHelperProps {
  /** Prompt text to show and copy. Defaults to {@link IDEAL_SYSTEM_PROMPT}. */
  prompt?: string;
  /** Called after a copy attempt (e.g. to show an error toast). */
  onCopied?: (ok: boolean) => void;
  /** Initial state of the preview. Default `false`. */
  defaultOpen?: boolean;
}

/**
 * Card with the "Webflow-friendly" AI system prompt: copy button, collapsible preview.
 * Ownership: ui.
 */
export function PromptHelper({ prompt = IDEAL_SYSTEM_PROMPT, onCopied, defaultOpen = false }: PromptHelperProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [copied, setCopied] = useState<'idle' | 'ok' | 'fail'>('idle');
  const timer = useRef<number | undefined>(undefined);
  const previewId = useId();

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    const ok = await copyText(prompt);
    setCopied(ok ? 'ok' : 'fail');
    onCopied?.(ok);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied('idle'), 2200);
  };

  const words = prompt.trim().split(/\s+/).length;

  return (
    <section aria-labelledby={`${previewId}-title`} className="card overflow-hidden">
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-start gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent-hover">
            <SparkIcon width={16} height={16} />
          </span>
          <div className="min-w-0">
            <h2 id={`${previewId}-title`} className="text-sm font-semibold text-white">
              Ideal AI prompt
            </h2>
            <p className="mt-0.5 text-[13px] leading-relaxed text-muted">
              Paste it as the system prompt in Claude or ChatGPT. The code it produces converts to native Webflow with little left in embeds.
            </p>
          </div>
        </div>

        <button type="button" onClick={copy} className="btn-primary-soft w-full justify-center">
          {copied === 'ok' ? <CheckIcon width={15} height={15} /> : <CopyIcon width={15} height={15} />}
          {copied === 'ok' ? 'Copied! Paste it into your AI' : copied === 'fail' ? 'Copy failed. Select the text below' : 'Copy Ideal System Prompt for AI'}
        </button>
        <span className="sr-only" aria-live="polite">
          {copied === 'ok' ? 'Prompt copied to clipboard.' : copied === 'fail' ? 'Could not copy the prompt.' : ''}
        </span>
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={previewId}
        className="flex w-full items-center gap-2 border-t border-line px-4 py-2.5 text-left text-[13px] font-medium text-zinc-300 hover:bg-white/[0.02] hover:text-white"
      >
        <ChevronIcon width={14} height={14} className={`transition-transform ${open ? 'rotate-90' : ''}`} />
        {open ? 'Hide prompt' : 'Preview prompt'}
        <span className="ml-auto font-mono text-[11px] text-muted">{words} words</span>
      </button>
      <div id={previewId} hidden={!open}>
        <pre
          tabIndex={0}
          aria-label="Prompt preview"
          className="code-scroll max-h-80 overflow-auto whitespace-pre-wrap break-words border-t border-line bg-[#0d0d11] px-4 py-3 font-mono text-[11.5px] leading-relaxed text-zinc-300 select-text"
        >
          {prompt}
        </pre>
      </div>
    </section>
  );
}
