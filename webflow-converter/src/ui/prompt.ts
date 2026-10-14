/**
 * The "Webflow-friendly" system prompt users paste into their AI tool before generating code.
 * Based on Timothy Ricks' guidance (see analize/youtube-skB7npZnwcc.md, section 3 ~3:14):
 * vanilla HTML/CSS/JS, REM units, BEM-style classes with single underscores, class-only styling,
 * no descendant selectors, simple selectors, few utility classes, no complex pseudo-selectors.
 *
 * Ownership: ui. PLACEHOLDER: the UI agent writes the full prompt (Webflow breakpoints
 * 991/767/479px, allowed pseudo-states, no ::before/::after, keep JS in one script, etc.).
 */
export const IDEAL_SYSTEM_PROMPT = `Write vanilla HTML, CSS, and JS using REM units instead of PX, BEM-style class naming with single underscores instead of double, class-only styling (no styling tags/IDs), no descendant selectors, and simple selectors. Avoid heavy utility class usage and complex pseudo-selectors.`;
