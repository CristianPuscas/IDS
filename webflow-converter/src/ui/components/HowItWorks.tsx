import { useEffect, useId, useRef, useState } from 'react';
import { InfoIcon } from './icons';

/** Props for {@link HowItWorks}. */
export interface HowItWorksProps {
  /** Modifier key label, e.g. "⌘" or "Ctrl". */
  modKey: string;
}

/**
 * "How it works" disclosure popover with three steps. Closes on Escape or an outside click.
 * Ownership: ui.
 */
export function HowItWorks({ modKey }: HowItWorksProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const steps: { title: string; body: string }[] = [
    { title: 'Generate', body: 'Copy the Ideal AI prompt into Claude or ChatGPT and ask for your component.' },
    { title: 'Convert', body: `Paste the code here and press Convert & Copy (${modKey}+Enter).` },
    { title: 'Paste', body: `In the Webflow Designer, select an element (e.g. Body) and press ${modKey}+V.` },
  ];

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={btnRef}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-[13px] font-medium text-zinc-300 transition-colors hover:border-zinc-600 hover:text-white"
      >
        <InfoIcon width={14} height={14} />
        <span className="sr-only min-[420px]:not-sr-only">How it works</span>
      </button>
      <div
        id={id}
        hidden={!open}
        className="absolute right-0 top-full z-40 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-line bg-surface-2 p-4 shadow-2xl shadow-black/60 motion-safe:animate-pop-in"
      >
        <p className="text-sm font-semibold text-white">How it works</p>
        <ol className="mt-3 space-y-3">
          {steps.map((s, i) => (
            <li key={s.title} className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent/15 font-mono text-xs font-semibold text-accent-hover">
                {i + 1}
              </span>
              <div>
                <p className="text-[13px] font-medium text-zinc-100">{s.title}</p>
                <p className="text-[13px] leading-snug text-muted">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-4 border-t border-line pt-3 text-[12px] text-muted">Runs entirely in your browser. Nothing is uploaded.</p>
      </div>
    </div>
  );
}
