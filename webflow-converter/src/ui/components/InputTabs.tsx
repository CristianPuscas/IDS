import { useRef, type KeyboardEvent } from 'react';
import type { InputMode } from '../../engine/types';
import { nextTabIndex } from '../lib/tabs';

/** Props for {@link InputTabs}. */
export interface InputTabsProps {
  /** Active tab: one combined HTML editor, or separate HTML / CSS / JS editors. */
  mode: InputMode;
  /** Called when the user picks a tab. */
  onModeChange: (mode: InputMode) => void;
  /** Prefix for tab / panel ids. Panels must use `${idPrefix}-panel-${mode}`. */
  idPrefix?: string;
}

export const INPUT_TABS: readonly { mode: InputMode; label: string; short: string }[] = [
  { mode: 'combined', label: 'All-in-One / Combined', short: 'All-in-One' },
  { mode: 'separate', label: 'Separate Files', short: 'Separate' },
];

export const tabId = (prefix: string, mode: InputMode) => `${prefix}-tab-${mode}`;
export const panelId = (prefix: string, mode: InputMode) => `${prefix}-panel-${mode}`;

/**
 * Accessible tablist (WAI-ARIA tabs, automatic activation): arrow keys / Home / End move
 * between tabs, only the selected tab is in the tab order.
 * Ownership: ui.
 */
export function InputTabs({ mode, onModeChange, idPrefix = 'input' }: InputTabsProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = Math.max(0, INPUT_TABS.findIndex((t) => t.mode === mode));

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const next = nextTabIndex(e.key, current, INPUT_TABS.length);
    if (next === null) return;
    e.preventDefault();
    const tab = INPUT_TABS[next];
    if (!tab) return;
    onModeChange(tab.mode);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label="Input mode"
      onKeyDown={onKeyDown}
      className="inline-flex max-w-full rounded-lg border border-line bg-canvas p-1"
    >
      {INPUT_TABS.map((t, i) => {
        const selected = t.mode === mode;
        return (
          <button
            key={t.mode}
            ref={(el) => {
              refs.current[i] = el;
            }}
            id={tabId(idPrefix, t.mode)}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={panelId(idPrefix, t.mode)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onModeChange(t.mode)}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              selected ? 'bg-surface-2 text-white shadow-sm ring-1 ring-line' : 'text-muted hover:text-zinc-200'
            }`}
          >
            <span className="hidden sm:inline">{t.label}</span>
            <span className="sm:hidden">{t.short}</span>
          </button>
        );
      })}
    </div>
  );
}
