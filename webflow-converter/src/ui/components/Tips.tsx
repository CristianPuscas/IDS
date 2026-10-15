const NATIVE = [
  'Elements and semantic tags (section, nav, h1-h6, p, a, button, img, lists)',
  'Forms: inputs, textarea, select, checkbox, radio, labels and submit, with success/error messages (forms your JS drives stay HTML)',
  'Buttons keep their look: Webflow\'s blue .w-button defaults are neutralized',
  'Class styles, plus combo classes from .block.is-modifier (names lowercased like Webflow does)',
  ':hover, :focus and :active on the class itself',
  'Media at 991 / 767 / 479px, max-width or min-width (tablet, landscape, portrait)',
  'Attributes such as data-*, aria-* and alt, so your JS hooks keep working',
];

const EMBED = [
  'Tag, ID, descendant, child and sibling selectors',
  '::before / ::after, @keyframes, :root variables',
  'Other media queries (odd breakpoints, orientation, prefers-*)',
  'All <script> code and CDN libraries (GSAP, Three.js, Lenis)',
  'SVG, canvas, video, iframe and tables (sized ones get a wrapper Div that carries their layout)',
  'Forms your JavaScript drives (novalidate, data hooks, submit listeners), and file, hidden or date inputs',
];

/**
 * Explains what the converter makes native and what it routes to Code Embeds.
 * Ownership: ui.
 */
export function Tips() {
  return (
    <section aria-labelledby="tips-title" className="card p-4">
      <h2 id="tips-title" className="text-sm font-semibold text-white">
        What becomes native?
      </h2>
      <h3 className="mt-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ok">
        <span className="size-1.5 rounded-full bg-ok" aria-hidden="true" />
        Native in Webflow
      </h3>
      <ul className="mt-2 space-y-1.5 text-[13px] leading-snug text-zinc-300">
        {NATIVE.map((t) => (
          <li key={t} className="flex gap-2">
            <span className="mt-[0.45em] size-1 shrink-0 rounded-full bg-zinc-600" aria-hidden="true" />
            {t}
          </li>
        ))}
      </ul>
      <h3 className="mt-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-warn">
        <span className="size-1.5 rounded-full bg-warn" aria-hidden="true" />
        Goes into a Code Embed
      </h3>
      <ul className="mt-2 space-y-1.5 text-[13px] leading-snug text-zinc-300">
        {EMBED.map((t) => (
          <li key={t} className="flex gap-2">
            <span className="mt-[0.45em] size-1 shrink-0 rounded-full bg-zinc-600" aria-hidden="true" />
            {t}
          </li>
        ))}
      </ul>
      <p className="mt-4 rounded-lg border border-line bg-canvas/60 px-3 py-2 text-[12px] leading-relaxed text-muted">
        Scripts don't run on the Designer canvas. Check them in Preview or on the published site. Custom fonts need to be added to the site.
      </p>
      <p className="mt-2 rounded-lg border border-line bg-canvas/60 px-3 py-2 text-[12px] leading-relaxed text-muted">
        Class names already in your site clash: Webflow renames yours to "name 2", and a combo merges with the site's class of the same name. Use unique names, or set a class prefix in Advanced options.
      </p>
    </section>
  );
}
