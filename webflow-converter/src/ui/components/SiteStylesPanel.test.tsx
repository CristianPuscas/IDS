import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import SITE_COPY from '../../engine/__fixtures__/client-first-site-copy.json?raw';
import type { SiteClassConflicts } from '../../engine/types';
import { EMPTY_LIBRARY_STATE, type LibraryState } from '../lib/siteLibrary';
import { SITE_PASTE_ID, SiteStylesPanel } from './SiteStylesPanel';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let latest: LibraryState = EMPTY_LIBRARY_STATE;

function Harness() {
  const [state, setState] = useState<LibraryState>(EMPTY_LIBRARY_STATE);
  const [conflicts, setConflicts] = useState<SiteClassConflicts>('rename');
  latest = state;
  return (
    <SiteStylesPanel
      state={state}
      onStateChange={setState}
      saveResult="saved"
      conflicts={conflicts}
      onConflictsChange={setConflicts}
      emptyUtilities={false}
      onEmptyUtilitiesChange={() => undefined}
      open
      onOpenChange={() => undefined}
      modKey="Ctrl"
    />
  );
}

/** Dispatches a paste whose clipboard holds `json` as application/json. */
function paste(target: Element, json: string) {
  const event = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', { value: { getData: (t: string) => (t === 'application/json' ? json : '') } });
  target.dispatchEvent(event);
}

/** Waits until `check` passes (jobs run asynchronously, in batches). */
async function until(check: () => boolean) {
  for (let i = 0; i < 100 && !check(); i++) await act(() => new Promise((r) => setTimeout(r, 5)));
  expect(check()).toBe(true);
}

describe('SiteStylesPanel', () => {
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

  const q = (sel: string) => host.querySelector(sel);

  it('is labelled as the optional first step', () => {
    expect(q('summary')!.textContent).toContain("1. Your site's style guide");
    expect(q('summary')!.textContent).toContain('(optional)');
    expect(q('[data-testid="site-status"]')!.textContent).toBe('none');
  });

  it('adds a pasted page with an analysis, then renames and removes it', async () => {
    act(() => paste(q(`#${SITE_PASTE_ID}`)!, SITE_COPY));
    await until(() => latest.library.sources.length === 1);
    const source = latest.library.sources[0]!;
    expect(source.label).toMatch(/^\d{1,2} [A-Z][a-z]{2} \d{4} · 4 classes$/);
    expect(q('[data-testid="last-analysis"]')!.textContent).toContain('Utility');
    expect(q('[data-testid="site-status"]')!.textContent).toBe('4 classes · 1 source');
    expect(q('[data-testid="library-sources"]')!.textContent).toContain(source.label);

    const renameBtn = host.querySelector<HTMLButtonElement>(`button[aria-label="Rename ${source.label}"]`)!;
    act(() => renameBtn.click());
    const input = host.querySelector<HTMLInputElement>(`input[aria-label="New label for ${source.label}"]`)!;
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      setter.call(input, 'Style guide');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    act(() => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    expect(latest.library.sources[0]!.label).toBe('Style guide');

    act(() => host.querySelector<HTMLButtonElement>('button[aria-label="Remove Style guide"]')!.click());
    expect(latest.library.sources).toHaveLength(0);
    expect(latest.library.classes.size).toBe(0);
  });

  it('shows why a paste failed', async () => {
    act(() => paste(q(`#${SITE_PASTE_ID}`)!, 'nope'));
    await until(() => (q('[role="status"]')?.textContent ?? '').includes('not Webflow clipboard data'));
    expect(latest.library.sources).toHaveLength(0);
  });
});
