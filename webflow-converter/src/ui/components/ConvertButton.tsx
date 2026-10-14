/** Props for {@link ConvertButton}. */
export interface ConvertButtonProps {
  /**
   * Click handler. Must stay synchronous up to the clipboard write: the App runs `convert()`
   * and then `copyToWebflow()` inside this same user gesture.
   */
  onClick: () => void;
  disabled?: boolean;
  /** Shows a busy label while converting. */
  busy?: boolean;
  /** Button text. Defaults to "Convert & copy to Webflow". */
  label?: string;
}

/**
 * Primary call to action.
 * Ownership: ui (placeholder).
 */
export function ConvertButton({ onClick, disabled = false, busy = false, label = 'Convert & copy to Webflow' }: ConvertButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
    >
      {busy ? 'Converting…' : label}
    </button>
  );
}
