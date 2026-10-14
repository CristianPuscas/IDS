import type { InputMode } from '../../engine/types';

/** Props for {@link InputTabs}. */
export interface InputTabsProps {
  /** Active tab: one combined HTML editor, or separate HTML / CSS / JS editors. */
  mode: InputMode;
  /** Called when the user picks a tab. */
  onModeChange: (mode: InputMode) => void;
}

const TABS: { mode: InputMode; label: string }[] = [
  { mode: 'combined', label: 'Single file' },
  { mode: 'separate', label: 'HTML / CSS / JS' },
];

/**
 * Tab switcher between `combined` and `separate` input modes.
 * Ownership: ui (placeholder styling).
 */
export function InputTabs({ mode, onModeChange }: InputTabsProps) {
  return (
    <div role="tablist" aria-label="Input mode" className="inline-flex rounded-md border border-line bg-surface p-0.5">
      {TABS.map((t) => (
        <button
          key={t.mode}
          type="button"
          role="tab"
          aria-selected={mode === t.mode}
          onClick={() => onModeChange(t.mode)}
          className={`rounded px-3 py-1.5 text-sm font-medium ${
            mode === t.mode ? 'bg-surface-2 text-white' : 'text-muted hover:text-zinc-200'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
