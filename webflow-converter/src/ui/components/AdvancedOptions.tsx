import { useId } from 'react';
import { countChanged, DEFAULT_ADVANCED, type AdvancedOptions } from '../lib/options';
import { ChevronIcon } from './icons';

/** Props for {@link AdvancedOptionsPanel}. */
export interface AdvancedOptionsProps {
  value: AdvancedOptions;
  onChange: (next: AdvancedOptions) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Id of the class prefix input, so other parts of the UI can focus it. */
export const CLASS_PREFIX_INPUT_ID = 'adv-class-prefix';

interface Choice<T extends string> {
  value: T;
  label: string;
  hint: string;
}

const FORM_CHOICES: Choice<AdvancedOptions['forms']>[] = [
  { value: 'auto', label: 'Auto', hint: 'Native Form Block, except forms your JavaScript drives (novalidate, data hooks, submit listeners): those keep their HTML in a Code Embed.' },
  { value: 'native', label: 'Native', hint: 'Always a Webflow Form Block. Webflow handles the submit (its alerts, Webflow Forms, Turnstile); custom form scripts may break.' },
  { value: 'embed', label: 'Embed', hint: 'Every form stays HTML in a Code Embed. No Webflow form handling.' },
];

const BUTTON_CHOICES: Choice<AdvancedOptions['buttonMode']>[] = [
  { value: 'button', label: 'Button', hint: 'Native Webflow Button (an <a>); .w-button defaults are neutralized and a click shim stops href="#" jumps.' },
  { value: 'linkBlock', label: 'Link Block', hint: 'A Link Block with a Text Block inside. No .w-button.' },
  { value: 'customElement', label: 'Custom Element', hint: 'A real <button> (Custom Element) with its attributes and type. Best for accessibility; not paste-tested yet.' },
];

const CF_UTILITY_CHOICES: Choice<AdvancedOptions['clientFirstUtilities']>[] = [
  { value: 'keep', label: 'Keep names', hint: 'With a prefix, Client-First utilities (padding-global, container-large, text-size-*…) keep their names and reuse the site’s; only custom classes are prefixed.' },
  { value: 'prefix', label: 'Prefix too', hint: 'With a prefix, Client-First utilities are prefixed like every other class. Nothing reuses the site’s utilities.' },
];

const SNAP_CHOICES: Choice<AdvancedOptions['breakpointSnap']>[] = [
  { value: 'up', label: 'Snap up', hint: 'Off-grid max-width queries (850px, 640px…) snap to the next Webflow breakpoint and become native variants.' },
  { value: 'off', label: 'Keep in embed', hint: 'Off-grid media queries stay exactly as written, in the <style> embed.' },
];

const RESET_CHOICES: Choice<'on' | 'off'>[] = [
  { value: 'on', label: 'On', hint: 'Full documents get a short reset of browser defaults at the top of the <style> embed, so the site’s tag styles do not leak in.' },
  { value: 'off', label: 'Off', hint: 'No reset: the destination site’s body, heading and paragraph styles apply.' },
];

const ID_CHOICES: Choice<'stable' | 'random'>[] = [
  { value: 'stable', label: 'Stable', hint: 'Each class id is derived from its name and styles, so the same output always carries the same ids. Webflow matches classes by name and styles, so this is harmless.' },
  { value: 'random', label: 'Random', hint: 'A new random id for every class on every conversion.' },
];

const IMAGE_CHOICES: Choice<AdvancedOptions['externalImages']>[] = [
  { value: 'customElement', label: 'Custom Element', hint: 'External images keep their exact URL, srcset and sizes as an <img> Custom Element.' },
  { value: 'embed', label: 'Embed', hint: 'External images go into Code Embeds with their original HTML.' },
  { value: 'image', label: 'Native Image', hint: 'Native Image elements. Webflow may rewrite the URL to its CDN on publish.' },
];

/**
 * Collapsible "Advanced options" card: forms, buttons, class prefix (and Client-First utilities), breakpoint snapping, the
 * browser-default reset and external images. Purely controlled; the App persists the values.
 * Ownership: ui.
 */
export function AdvancedOptionsPanel({ value, onChange, open, onOpenChange }: AdvancedOptionsProps) {
  const changed = countChanged(value);
  const set = <K extends keyof AdvancedOptions>(key: K, v: AdvancedOptions[K]) => onChange({ ...value, [key]: v });

  return (
    <details className="card group/adv" open={open} onToggle={(e) => onOpenChange(e.currentTarget.open)}>
      <summary className="summary-row rounded-xl">
        <ChevronIcon width={14} height={14} className="transition-transform group-open/adv:rotate-90" />
        Advanced options
        {changed > 0 && (
          <span className="rounded-full bg-accent/15 px-2 py-0.5 font-mono text-[11px] text-[#8db8ff] ring-1 ring-inset ring-accent/40">{changed} changed</span>
        )}
        <span className="ml-auto hidden truncate text-[12px] font-normal text-muted sm:inline">Forms, buttons, class prefix, breakpoints, images</span>
      </summary>
      <div className="grid gap-x-6 gap-y-5 border-t border-line p-4 md:grid-cols-2">
        <Segmented legend="Forms" name="adv-forms" choices={FORM_CHOICES} value={value.forms} onChange={(v) => set('forms', v)} />
        <Segmented legend="Buttons" name="adv-buttons" choices={BUTTON_CHOICES} value={value.buttonMode} onChange={(v) => set('buttonMode', v)} />
        <ClassPrefixField value={value.classPrefix} onChange={(v) => set('classPrefix', v)} />
        <Segmented
          legend="Client-First utilities"
          name="adv-cf-utilities"
          choices={CF_UTILITY_CHOICES}
          value={value.clientFirstUtilities}
          onChange={(v) => set('clientFirstUtilities', v)}
        />
        <Segmented legend="Off-grid breakpoints" name="adv-snap" choices={SNAP_CHOICES} value={value.breakpointSnap} onChange={(v) => set('breakpointSnap', v)} />
        <Segmented
          legend="Browser-default reset"
          name="adv-reset"
          choices={RESET_CHOICES}
          value={value.neutralizeDefaults ? 'on' : 'off'}
          onChange={(v) => set('neutralizeDefaults', v === 'on')}
        />
        <Segmented legend="External images" name="adv-images" choices={IMAGE_CHOICES} value={value.externalImages} onChange={(v) => set('externalImages', v)} />
        <Segmented
          legend="Class ids"
          name="adv-class-ids"
          choices={ID_CHOICES}
          value={value.stableClassIds ? 'stable' : 'random'}
          onChange={(v) => set('stableClassIds', v === 'stable')}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-2.5 text-[12px] text-muted">
        <span>Saved in this browser and used for every conversion.</span>
        <button type="button" className="btn-ghost ml-auto" disabled={changed === 0} onClick={() => onChange({ ...DEFAULT_ADVANCED })}>
          Reset to defaults
        </button>
      </div>
    </details>
  );
}

function Segmented<T extends string>({ legend, name, choices, value, onChange }: { legend: string; name: string; choices: Choice<T>[]; value: T; onChange: (v: T) => void }) {
  const hintId = useId();
  const current = choices.find((c) => c.value === value) ?? choices[0]!;
  return (
    <fieldset className="min-w-0" aria-describedby={hintId}>
      <legend className="text-[13px] font-medium text-zinc-200">{legend}</legend>
      <div className="mt-1.5 flex flex-wrap gap-0.5 rounded-lg border border-line bg-canvas/60 p-0.5 sm:inline-flex">
        {choices.map((c) => (
          <label
            key={c.value}
            className="flex-1 cursor-pointer select-none whitespace-nowrap rounded-md px-2.5 py-1 text-center text-xs font-medium text-muted transition-colors hover:text-zinc-100 has-[:checked]:bg-accent/20 has-[:checked]:text-white has-[:checked]:ring-1 has-[:checked]:ring-inset has-[:checked]:ring-accent/40 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent-hover sm:flex-none"
          >
            <input type="radio" className="sr-only" name={name} value={c.value} checked={c.value === value} onChange={() => onChange(c.value)} />
            {c.label}
          </label>
        ))}
      </div>
      <p id={hintId} className="mt-1.5 text-[12px] leading-snug text-muted">
        {current.hint}
      </p>
    </fieldset>
  );
}

function ClassPrefixField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const hintId = useId();
  return (
    <div className="min-w-0">
      <label htmlFor={CLASS_PREFIX_INPUT_ID} className="text-[13px] font-medium text-zinc-200">
        Class prefix
      </label>
      <input
        id={CLASS_PREFIX_INPUT_ID}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. gi-"
        spellCheck={false}
        autoComplete="off"
        maxLength={40}
        aria-describedby={hintId}
        className="mt-1.5 block w-full rounded-lg border border-line bg-canvas/60 px-3 py-1.5 font-mono text-[13px] text-zinc-100 placeholder:text-zinc-600 focus:border-accent focus:outline-none sm:max-w-56"
      />
      <p id={hintId} className="mt-1.5 text-[12px] leading-snug text-muted">
        Added to your classes so nothing clashes with the site’s classes (Client-First utilities: see below). Scripts that use class names are not rewritten.
      </p>
    </div>
  );
}
