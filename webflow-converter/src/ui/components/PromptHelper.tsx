import { useState } from 'react';
import { IDEAL_SYSTEM_PROMPT } from '../prompt';

/** Props for {@link PromptHelper}. */
export interface PromptHelperProps {
  /** Prompt text to show and copy. Defaults to {@link IDEAL_SYSTEM_PROMPT}. */
  prompt?: string;
  /** Called after the prompt was copied (e.g. to show a toast). */
  onCopied?: (ok: boolean) => void;
}

/**
 * Shows the "Webflow-friendly" AI prompt with a copy button, so users generate code that
 * converts with minimal custom CSS.
 * Ownership: ui (placeholder).
 */
export function PromptHelper({ prompt = IDEAL_SYSTEM_PROMPT, onCopied }: PromptHelperProps) {
  const [open, setOpen] = useState(false);

  const copy = async () => {
    let ok = false;
    try {
      await navigator.clipboard.writeText(prompt);
      ok = true;
    } catch {
      ok = false;
    }
    onCopied?.(ok);
  };

  return (
    <section className="rounded-md border border-line bg-surface">
      <div className="flex items-center justify-between gap-3 px-3 py-2">
        <button type="button" onClick={() => setOpen((v) => !v)} className="text-sm font-medium text-zinc-200" aria-expanded={open}>
          AI prompt for Webflow-friendly code
        </button>
        <button type="button" onClick={copy} className="rounded border border-line px-2 py-1 font-mono text-xs text-muted hover:text-white">
          Copy prompt
        </button>
      </div>
      {open && <pre className="whitespace-pre-wrap border-t border-line px-3 py-2 font-mono text-xs text-zinc-300">{prompt}</pre>}
    </section>
  );
}
