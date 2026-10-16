import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { InputMode } from '../../engine/types';
import { InputTabs } from './InputTabs';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Harness() {
  const [mode, setMode] = useState<InputMode>('combined');
  return (
    <>
      <InputTabs mode={mode} onModeChange={setMode} idPrefix="t" />
      <output data-testid="mode">{mode}</output>
    </>
  );
}

describe('InputTabs', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => root.render(<Harness />));
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  const tabs = () => [...host.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  const mode = () => host.querySelector('[data-testid="mode"]')?.textContent;
  const key = (el: Element, k: string) => act(() => void el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })));

  it('renders an accessible tablist with one selected tab', () => {
    expect(host.querySelector('[role="tablist"]')).not.toBeNull();
    expect(tabs().map((t) => t.getAttribute('aria-selected'))).toEqual(['true', 'false']);
    expect(tabs().map((t) => t.tabIndex)).toEqual([0, -1]);
    expect(tabs()[1]?.getAttribute('aria-controls')).toBe('t-panel-separate');
  });

  it('switches tabs on click', () => {
    act(() => tabs()[1]?.click());
    expect(mode()).toBe('separate');
    expect(tabs()[1]?.getAttribute('aria-selected')).toBe('true');
  });

  it('switches tabs and moves focus with arrow keys, Home and End', () => {
    const first = tabs()[0]!;
    first.focus();
    key(first, 'ArrowRight');
    expect(mode()).toBe('separate');
    expect(document.activeElement).toBe(tabs()[1]);
    key(tabs()[1]!, 'ArrowRight');
    expect(mode()).toBe('combined');
    key(tabs()[0]!, 'End');
    expect(mode()).toBe('separate');
    key(tabs()[1]!, 'Home');
    expect(mode()).toBe('combined');
    expect(document.activeElement).toBe(tabs()[0]);
  });
});
