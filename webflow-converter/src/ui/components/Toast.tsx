import { useEffect } from 'react';

/** Visual style of a toast. */
export type ToastKind = 'success' | 'error' | 'info';

/** A toast to display. `null` in App state means no toast. */
export interface ToastMessage {
  kind: ToastKind;
  message: string;
}

/** Props for {@link Toast}. */
export interface ToastProps {
  /** Toast to show, or `null` to render nothing. */
  toast: ToastMessage | null;
  /** Called when the toast is dismissed (click or timeout). */
  onDismiss: () => void;
  /** Auto-dismiss delay in ms. `0` disables auto-dismiss. Default 4000. */
  durationMs?: number;
}

const KIND_CLASS: Record<ToastKind, string> = {
  success: 'border-ok/40 text-ok',
  error: 'border-err/40 text-err',
  info: 'border-line text-zinc-200',
};

/**
 * Transient status message (e.g. "Copied! Paste into Webflow with Ctrl/Cmd+V").
 * Ownership: ui (placeholder).
 */
export function Toast({ toast, onDismiss, durationMs = 4000 }: ToastProps) {
  useEffect(() => {
    if (!toast || durationMs <= 0) return;
    const t = window.setTimeout(onDismiss, durationMs);
    return () => window.clearTimeout(t);
  }, [toast, durationMs, onDismiss]);

  if (!toast) return null;
  return (
    <div role="status" aria-live="polite" className="fixed inset-x-4 bottom-4 z-50 flex justify-center sm:inset-x-auto sm:right-4">
      <button
        type="button"
        onClick={onDismiss}
        className={`rounded-md border bg-surface-2 px-4 py-2.5 text-left text-sm shadow-lg ${KIND_CLASS[toast.kind]}`}
      >
        {toast.message}
      </button>
    </div>
  );
}
