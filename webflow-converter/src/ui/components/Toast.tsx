import { useEffect, useRef, useState } from 'react';
import { AlertIcon, CheckIcon, CloseIcon, InfoIcon } from './icons';

/** Visual style of a toast. */
export type ToastKind = 'success' | 'error' | 'info';

/** A button inside a toast (e.g. "Download JSON"). Runs inside the click gesture. */
export interface ToastAction {
  label: string;
  onClick: () => void;
}

/** A toast to display. `null` in App state means no toast. */
export interface ToastMessage {
  /** Changes for every new toast so timers and animations restart. */
  id: number;
  kind: ToastKind;
  title: string;
  message?: string;
  actions?: ToastAction[];
}

/** Props for {@link Toast}. */
export interface ToastProps {
  /** Toast to show, or `null` to render nothing. */
  toast: ToastMessage | null;
  /** Called when the toast is dismissed (click or timeout). */
  onDismiss: () => void;
  /** Auto-dismiss delay in ms for success/info toasts. Error toasts stay until closed. Default 4500. */
  durationMs?: number;
}

const KIND: Record<ToastKind, { ring: string; icon: string; bar: string }> = {
  success: { ring: 'border-ok/35', icon: 'bg-ok/15 text-ok', bar: 'bg-ok' },
  error: { ring: 'border-err/40', icon: 'bg-err/15 text-err', bar: 'bg-err' },
  info: { ring: 'border-line', icon: 'bg-accent/15 text-accent-hover', bar: 'bg-accent' },
};

const EXIT_MS = 160;

/**
 * Animated status toast. The live region is always mounted so screen readers announce changes;
 * errors use role="alert". Auto-dismiss pauses while hovered or focused.
 * Ownership: ui.
 */
export function Toast({ toast, onDismiss, durationMs = 4500 }: ToastProps) {
  const [leaving, setLeaving] = useState(false);
  const [paused, setPaused] = useState(false);
  const exitTimer = useRef<number | undefined>(undefined);

  const autoDismiss = toast && toast.kind !== 'error' && durationMs > 0;

  useEffect(() => {
    setLeaving(false);
    setPaused(false);
    window.clearTimeout(exitTimer.current);
  }, [toast?.id]);

  useEffect(() => () => window.clearTimeout(exitTimer.current), []);

  const close = () => {
    if (leaving) return;
    setLeaving(true);
    exitTimer.current = window.setTimeout(onDismiss, EXIT_MS);
  };

  useEffect(() => {
    if (!autoDismiss || paused) return;
    const t = window.setTimeout(close, durationMs);
    return () => window.clearTimeout(t);
  }, [toast?.id, autoDismiss, paused, durationMs]);

  const k = toast ? KIND[toast.kind] : KIND.info;
  const Icon = toast?.kind === 'success' ? CheckIcon : toast?.kind === 'error' ? AlertIcon : InfoIcon;

  return (
    <div aria-live="polite" aria-atomic="true" className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center p-4 sm:justify-end">
      {toast && (
        <div
          key={toast.id}
          role={toast.kind === 'error' ? 'alert' : 'status'}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
          onKeyDown={(e) => e.key === 'Escape' && close()}
          className={`pointer-events-auto relative w-full max-w-sm overflow-hidden rounded-xl border bg-surface-2/95 shadow-2xl shadow-black/50 backdrop-blur ${k.ring} ${
            leaving ? 'animate-toast-out' : 'animate-toast-in'
          }`}
        >
          <div className="flex gap-3 p-4">
            <span className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ${k.icon}`}>
              <Icon width={15} height={15} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white">{toast.title}</p>
              {toast.message && <p className="mt-0.5 text-sm text-zinc-400">{toast.message}</p>}
              {toast.actions && toast.actions.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {toast.actions.map((a) => (
                    <button key={a.label} type="button" onClick={a.onClick} className="btn-secondary">
                      {a.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button type="button" onClick={close} aria-label="Dismiss notification" className="-m-1 h-fit rounded-md p-1 text-zinc-500 hover:bg-white/5 hover:text-zinc-200">
              <CloseIcon width={16} height={16} />
            </button>
          </div>
          {autoDismiss && !leaving && (
            <div
              aria-hidden="true"
              className={`absolute inset-x-0 bottom-0 h-0.5 origin-left animate-toast-progress opacity-60 motion-reduce:hidden ${k.bar}`}
              style={{ animationDuration: `${durationMs}ms`, animationPlayState: paused ? 'paused' : 'running' }}
            />
          )}
        </div>
      )}
    </div>
  );
}
