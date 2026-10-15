import { ArrowIcon, CheckIcon, Spinner } from './icons';

/** Visual state of the convert button. */
export type ConvertStatus = 'idle' | 'busy' | 'done';

/** Props for {@link ConvertButton}. */
export interface ConvertButtonProps {
  /**
   * Click handler. The App runs `convertAsync()` (synchronous unless a script needs terser) and
   * then `copyToWebflow()` within this same user gesture's activation window.
   */
  onClick: () => void;
  disabled?: boolean;
  /** `busy` shows a spinner, `done` a short confirmation. */
  status?: ConvertStatus;
  /** Button text. Defaults to "Convert & Copy to Webflow". */
  label?: string;
  /** Modifier key label for the shortcut hint, e.g. "⌘" or "Ctrl". */
  modKey?: string;
}

/**
 * Primary call to action. Shortcut: Ctrl/Cmd+Enter (handled in App).
 * Ownership: ui.
 */
export function ConvertButton({ onClick, disabled = false, status = 'idle', label = 'Convert & Copy to Webflow', modKey = 'Ctrl' }: ConvertButtonProps) {
  const busy = status === 'busy';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      aria-busy={busy}
      aria-keyshortcuts="Control+Enter Meta+Enter"
      className="group relative inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-xl bg-accent px-6 text-base font-semibold text-white shadow-[0_8px_30px_-8px_rgba(20,110,245,0.7)] transition-[background-color,box-shadow,transform] hover:bg-accent-hover active:translate-y-px disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500 disabled:shadow-none sm:w-auto"
    >
      {busy ? (
        <Spinner width={18} height={18} />
      ) : status === 'done' ? (
        <CheckIcon width={18} height={18} />
      ) : null}
      <span>{busy ? 'Converting…' : status === 'done' ? 'Copied!' : label}</span>
      {status === 'idle' && (
        <>
          <ArrowIcon width={18} height={18} className="transition-transform motion-safe:group-hover:translate-x-0.5 group-disabled:hidden" />
          <kbd className="ml-1 hidden rounded-md border border-white/25 bg-white/10 px-1.5 py-0.5 font-mono text-[11px] font-medium text-white/90 group-disabled:border-zinc-700 group-disabled:bg-transparent group-disabled:text-zinc-500 sm:inline">
            {modKey}+↵
          </kbd>
        </>
      )}
    </button>
  );
}
