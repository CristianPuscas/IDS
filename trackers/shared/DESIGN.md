# Trackers design system (`shared/theme.css`)

This is the reference for the agents building the tracker screens. The look recreates the spreadsheet dashboards in the promo photos: a warm cream page, thin warm-grey rules, section cards with a dusty-rose or sage header band carrying small white uppercase titles, compact tables with right-aligned tabular numbers, a letter-spaced serif month title and a deep bordo accent.

Link it with `<link rel="stylesheet" href="../shared/theme.css">`. `styleguide.html` in this folder shows every class with Romanian content, so open it next to your screen while you build.

---

## 1. Tokens (all on `:root`)

| Token | Value | Use |
|---|---|---|
| `--bg` | `#f6f3ee` | page background (html, body) |
| `--surface` | `#fffdf8` | cards, inputs, table cells |
| `--surface-2` | `#f7f2ec` | neutral alt rows, plain sub-headers, out-of-month days |
| `--line` | `#e3dbd3` | card borders, vertical column rules |
| `--line-faint` | `#eee8e2` | horizontal row rules (extra) |
| `--line-strong` | `#cdc1b7` | header underline, totals rule, input borders |
| `--ink` / `--ink-2` / `--ink-3` | `#2d2623` / `#5b504a` / `#7a6f68` | text; `--ink-3` still meets 4.5:1 on surface |
| `--accent` | `#6b1627` | bordo: primary buttons, active nav, `.tk-note` rule, focus ring |
| `--accent-ink` | `#fff8f4` | text on accent |
| `--accent-soft` | `#f3e3e4` | over-budget cell tint (extra) |
| `--rose` | `#cfa894` | **default header band** (dusty rose / peach) |
| `--rose-soft` | `#f4e9e2` | rose sub-header row, hover, highlights |
| `--rose-ink` | `#ffffff` | text on bands |
| `--sage` | `#8aa28e` | summary header band |
| `--sage-soft` | `#e5ece4` | sage sub-header row / footer |
| `--sage-deep` | `#5d7862` | sage text (`.tk-pct.is-full`), toggle on |
| `--terra` | `#b27b5d` | terracotta band / bars |
| `--terra-soft` | `#f3e3d9` | terracotta sub-header |
| `--terra-ink` | `#9b6b55` | hero month title, big KPI % (extra) |
| `--gold` / `--gold-soft` | `#c9a45c` / `#f5ecd7` | sand accents, "delegate" quadrant |
| `--blue-soft` / `--blue-ink` | `#e2eaf2` / `#3e5a78` | "waiting" status |
| `--good` / `--warn` / `--bad` | `#5d8a66` / `#b98232` / `#a3303f` | semantic |
| `--pct` | `#a3525a` | default progress-percent text (extra) |
| `--check` / `--check-line` | `#c69b84` / `#d9bcac` | ticked checkbox fill / unticked border (extra) |
| `--focus` | `#6b1627` | focus outline (extra) |
| `--chart-1 … --chart-8` | see §2 | categorical chart palette, **fixed order** |
| `--chart-track` | `#ecebe7` | donut / progress track |
| `--chart-grid` | `#e8e2dc` | gridlines |
| `--chart-plan` | `#7f9a84` | "Plan" series (sage, as in the photos) |
| `--chart-fact` | `#d8b39f` | "Fapt" series (peach / rose, as in the photos) |
| `--font-display` | Cormorant Garamond → Garamond/Palatino/Georgia → serif | hero, `.tk-h2`, plain card titles, modal title |
| `--font-body` | Inter → Segoe UI/system-ui/Roboto/Arial → sans-serif | all UI and table text |
| `--font-data` | Inter (same stack) + `tabular-nums` | numbers |
| `--radius` / `--radius-sm` | `6px` / `3px` | cards / controls |
| `--shadow` / `--shadow-lg` | very soft warm lift / modal & tooltip | |
| `--space-1 … --space-6` | 4 / 8 / 12 / 16 / 24 / 40 px | |
| `--dur`, `--ease` | 160ms (0ms under `prefers-reduced-motion`) | all transitions use these |

Fonts are loaded with one `@import` from Google Fonts (Cormorant Garamond 500/600/700 + italic 500, Inter 400–700). Both families include latin-ext, so ă â î ș ț render correctly. Offline, the page falls back to Georgia/Palatino and Segoe/Roboto/Arial, and I checked that it still looks right.

## 2. Chart palette (fixed order) and validator result

| slot | hex | name |
|---|---|---|
| `--chart-1` | `#519561` | sage |
| `--chart-2` | `#e49f70` | peach |
| `--chart-3` | `#a7593d` | terracotta |
| `--chart-4` | `#91c181` | light sage |
| `--chart-5` | `#be6d81` | blush |
| `--chart-6` | `#c6a356` | sand / gold |
| `--chart-7` | `#32703e` | deep sage |
| `--chart-8` | `#9c5f8f` | dusty mauve |

Validator (`validate_palette.js … --mode light --surface "#fffdf8"`, adjacent pairs): **ALL CHECKS PASS**.
- Lightness band: PASS (all 8 in L 0.43–0.77)
- Chroma floor: PASS (all ≥ 0.10)
- CVD separation: PASS (worst adjacent chart-2↔chart-1, ΔE 8.7 protan; tritan 11.6)
- Normal-vision floor: PASS (worst adjacent chart-6↔chart-5, ΔE 16.9)
- Contrast vs surface: **WARN** for chart-2, chart-4 and chart-6 (2.0–2.4:1). Charts must always show a legend or direct labels, which they do anyway.

The photos use greyer tints than this palette. The validator's chroma floor forces a little more saturation, so the palette stays close to the photo hues with more colour. The `--pairs all` check does **not** pass, which is normal for 8 hues. The palette is meant for pies, stacked bars and adjacent series. Do not use it for 8-series scatter plots.

### Soft "photo" palette for pies (`--pie-1 … --pie-8`)
`#79947e` sage, `#ddb8a5` peach, `#ae775b` terracotta, `#aec5ae` light sage, `#ac7d87` dusty rose, `#d6c5a3` sand, `#4c6855` deep sage, `#e4cecd` blush.
Inside any `.tk-chart--pie`, which charts.js adds to every pie and ring-pie, `--chart-1…8` are remapped to these tones. Pies therefore look like the photos, while bars and lines keep the validated palette. The finance Settings swatches use the same remap, so each category has one colour everywhere in that tracker.
Validator results, adjacent pairs:
- CVD separation PASS (worst ΔE 14.1).
- Normal-vision PASS (worst ΔE 18.6).
- Lightness band and chroma floor FAIL. This is deliberate, because the tones are pastel.
- The contrast WARN is covered by the 2px surface gaps between slices and the legend with %.
Rules: only use this palette where each slice is separated by a gap and labelled in a legend. Keep a pie to 8 slices or fewer, and group the rest into "Altele".

**Chart rules**
- Plan vs fact (bars, grouped bars): always `--chart-plan` (sage) followed by `--chart-fact` (peach), in that order, as in the photos.
- Single-value donuts (progress, completion %): `--chart-plan` on a `--chart-track` ring, with the % in `--terra-ink` in the centre.
- Pies and categorical charts: take `--chart-1…8` in order. Never reorder or skip slots, and group anything past 8 into "Altele" using `--chart-track`.
- Charts with 2–3 series may use the softer photo tones (`--chart-plan`, `--chart-fact`, `#c9d6c8`) to match the photos exactly.
- SVG text inside `.tk-chart` gets 10px Inter in `--ink-2` automatically.

## 3. Rules (do / don't)

- **Band colour:** use rose (`.tk-card__head`, default) for **trackers and lists** (facturi, datorii, flux de numerar, sarcini, week bands). Use sage (`--sage`) for **summaries and aggregates** (sumar venituri, economii, obiceiuri zilnice, top-10, progres). Use terra sparingly, for one standout card such as top cheltuieli. Use plain for dashboard widgets and filter or settings panels (it shows a serif letter-spaced title on white, like "ГОДОВАЯ СВОДКА").
- The sub-header row (`thead th`), totals (`tfoot`), the calendar weekday row and `.tk-card__foot` **automatically take the soft tone of the card's band**. This works through `:has()` or through the explicit `.tk-card--sage` / `--terra` / `--plain` modifier on the card. Add the modifier if you need it to work without `:has()`.
- Card titles are short and uppercase. Wrap the key word in `<b>`: `Tracker <b>facturi</b>`.
- **Percentages:** `.tk-pct` is the default muted bordo. Add `.is-over` when the value is **> 100%** or the category is over budget (the cell also gets a soft tint). Add `.is-full` when the value is **exactly 100%** or the item is done (sage). Leave a value below 100% plain. For "lower is better" metrics such as expenses versus plan, apply `.is-over` when fact exceeds plan.
- Numbers: every numeric cell is `td.num` (right aligned, tabular, nowrap). Put the currency in its own `td.cur` cell before the number, as the photos do, or inline as `<span class="cur">lei</span>`. Format as `145 000,00` with a non-breaking or narrow space.
- Every wide table sits inside `.tk-scroll`. Cells inside a scroller don't wrap, so the table scrolls sideways like a spreadsheet. Use `.tk-table--wrap` to let text wrap again. The page body must never scroll horizontally.
- Show 3–10 `tr.is-empty` rows after the data to keep the spreadsheet feel. Skip them on phones if the table is long.
- Completed tasks: `tr.is-done` strikes through the row, greys the text and desaturates pills. Leave the checkboxes working.
- Use only the tokens. Don't add hex values in tracker CSS, don't add `!important`, and keep selectors to a single class where you can.
- Don't add a dark theme and don't load external images. Icons are emoji or inline SVG.
- Use `.tk-btn--primary` once per view, for the main action. Everything else is a default or ghost button.

## 4. Class reference

### Shell & layout
```html
<div class="tk-app">
  <header class="tk-topbar">
    <a class="tk-brand" href="#"><span class="tk-brand__mark"></span>Trackere</a>
    <nav class="tk-nav"><a class="tk-nav__link is-active" aria-current="page">Finanțe</a>…</nav>
  </header>
  <main class="tk-page">…</main>
</div>
```
- `.tk-page`: max-width 1360px, side gutter `clamp(16px, 3vw, 32px)`.
- `.tk-grid` is one column by default. `--2` goes to 2 columns at ≥760px. `--3` goes to 2 columns at ≥760px and 3 at ≥980px. `--4` goes to 2 columns at ≥600px and 4 at ≥1100px. `--sidebar` becomes `minmax(250px,320px) 1fr` at ≥980px. `.tk-grid--stretch` (extra) gives equal-height rows.
- `.tk-stack` is a vertical stack with a 16px gap. `.tk-row` is a horizontal flex row that wraps, with a gap. `.tk-spacer` (extra) is `flex:1` and pushes the following items to the right.

### Hero
```html
<div class="tk-hero">
  <div class="tk-rule"></div>                       <!-- extra: bordo dot + line -->
  <p class="tk-eyebrow">Tracker obiceiuri</p>
  <h1 class="tk-hero__title">Septembrie</h1>
  <p class="tk-hero__sub">Dashboard planificator financiar</p>
</div>
```
The title scales with its container (`cqi`), so it fits a 250px sidebar column. For long titles such as "Tracker sarcini", reduce the letter-spacing inline: `style="letter-spacing:.12em;margin-right:-.12em"`. `.tk-h2` (extra) is the bordo section heading. It is sans uppercase, like "СЧЕТА / ДОЛГИ" on the promo slides.

### Cards
```html
<article class="tk-card">
  <header class="tk-card__head tk-card__head--sage">
    <h2 class="tk-card__title">Sumar <b>venituri</b></h2>
    <button class="tk-icon-btn" aria-label="Adaugă">+</button>   <!-- optional -->
  </header>
  <div class="tk-card__body tk-card__body--flush tk-scroll"><table class="tk-table">…</table></div>
  <footer class="tk-card__foot"><span>Total obiceiuri</span><b>3 / 3</b></footer>
</article>
```
Head modifiers are `--rose` (default), `--sage`, `--terra` and `--plain`. `.tk-card__body--flush` (extra) removes the padding and is meant for tables.

### KPIs
```html
<div class="tk-kpis">
  <div class="tk-kpi"><span class="tk-kpi__label">Venituri</span>
    <span class="tk-kpi__value">145 000,00<span class="cur">lei</span></span>
    <span class="tk-kpi__hint">plan 159 000,00</span></div>
</div>
```
Columns auto-fit and drop to 2 per row on phones. For the big terracotta "PROGRES 83,6%", use `class="tk-kpi__value tk-pct"`.

### Tables
```html
<div class="tk-scroll"><table class="tk-table [tk-table--dense]">
  <thead><tr><th class="chk"></th><th>Categorie</th><th class="num" colspan="2">Plan</th><th class="num">Progres</th></tr></thead>
  <tbody>
    <tr><td class="chk"><input class="tk-check" type="checkbox" checked></td><td>Internet</td>
        <td class="cur">lei</td><td class="num">1 000,00</td><td class="num"><span class="tk-pct is-full">100,00%</span></td></tr>
    <tr class="is-done">…</tr>
    <tr class="is-empty"><td></td>…</tr>
  </tbody>
  <tfoot><tr><th colspan="2">Total</th><td class="cur">lei</td><td class="num">7 200,00</td><td class="num">…</td></tr></tfoot>
</table></div>
```
- `tr.is-total` looks the same as `tfoot`.
- Extras: `.chk` is a narrow centred checkbox column. `.idx` is a row-number column. `td.is-hl` gives a rose-tinted cell (for example "zile rămase"). `td[data-tone="…"]` gives a tinted cell (for example transaction type: Venit = `good`, Cheltuială = `rose`).
- In-cell editing: `<input class="tk-cell-input">` or `<select class="tk-cell-input">`. It has no border until hover or focus. Inside `td.num` it right-aligns.

### Values
- `.tk-money` is a tabular number that doesn't wrap.
- `.tk-pct` takes `.is-over` or `.is-full`, as described in §3.
- `<span class="tk-progress tk-progress--sage" style="--p:66%" role="progressbar" aria-valuenow="66" aria-valuemin="0" aria-valuemax="100"></span>`: the default bar colour is terra. `--rose` gives peach and `--sage` gives sage. `.tk-progress--bar` (extra) is the fat 16px spreadsheet bar used in the habit "PROGRES" table.
- `.tk-donut` (extra) is a CSS-only donut:
  ```html
  <div class="tk-donut-wrap">
    <div class="tk-donut" style="--p:83.6%;--size:112px;--thick:12px"></div>
    <div class="tk-donut__label">Obiceiuri<b>311 / 372</b></div>
  </div>
  ```
  `--c` sets the ring colour (default `--chart-plan`).

### Controls
```html
<div class="tk-field"><label class="tk-label" for="x">Sumă (lei)</label><input class="tk-input num" id="x"></div>
<select class="tk-select">…</select>  <textarea class="tk-textarea"></textarea>
<button class="tk-btn tk-btn--primary">Salvează</button>  .tk-btn--ghost  .tk-btn--danger  .tk-btn--sm
<button class="tk-icon-btn" aria-label="Editează">✎</button>
<input type="checkbox" class="tk-check">   <input type="checkbox" class="tk-toggle">
<label class="tk-check-label"><input class="tk-check" type="checkbox"><span class="tk-check-label__text">Plan de mese</span></label>
```
- `.tk-check-label` (extra) strikes through its `__text` when checked. `.tk-check--lg` (extra) is an 18px checkbox.
- `.tk-kv` (extra) is the spreadsheet "settings" block, with a rose label cell and a white value cell:
  ```html
  <div class="tk-kv"><span class="tk-kv__k">Luna</span><span class="tk-kv__v"><select class="tk-cell-input">…</select></span></div>
  ```

### Pills
`<span class="tk-pill" data-tone="bad"><span class="tk-dot"></span>Ridicată</span>`. The tones are `sage rose terra gold blue grey bad good`.

Suggested mappings:
- Status: Neînceput = grey ○, În lucru = terra 🔍, În așteptare = blue ⏳, Suspendat = gold ⏸, Finalizat = good ✓, Întârziat = bad.
- Priority, with a dot: Critică = rose with `style="--t-dot:var(--accent)"`, Ridicată = bad, Medie = gold, Scăzută = good.

### Tabs, toolbar, notes, banners
```html
<div class="tk-tabs" role="tablist"><button class="tk-tab is-active" role="tab" aria-selected="true">Listă</button>…</div>
<div class="tk-toolbar"><div class="tk-field">…</div><span class="tk-spacer"></span><button class="tk-btn">…</button></div>
<p class="tk-note">Toate tranzacțiile se distribuie pe luni…</p>
<div class="tk-empty"><strong>Nicio sarcină aici</strong>Adaugă o sarcină…<button class="tk-btn tk-btn--sm">+ Adaugă</button></div>
<div class="tk-demo-banner"><span>Datele afișate sunt exemple.</span><button class="tk-btn tk-btn--sm">Șterge datele demo</button></div>
```

### Charts
```html
<div class="tk-card"><div class="tk-card__body">
  <p class="tk-chart__title">Structura veniturilor</p>        <!-- extra -->
  <div class="tk-chart"><svg viewBox="…">…</svg></div>
  <ul class="tk-legend"><li class="tk-legend__item"><span class="tk-swatch" style="--c:var(--chart-1)"></span>Salariu <span class="num">58%</span></li></ul>
</div></div>
<div class="tk-tip" hidden>…</div>   <!-- position:fixed, set left/top from JS -->
```

### Modal and toast
```html
<div class="tk-modal" hidden><div class="tk-modal__box" role="dialog" aria-modal="true" aria-labelledby="t">
  <h2 class="tk-modal__title" id="t">Tranzacție nouă</h2> …
  <div class="tk-modal__actions"><button class="tk-btn tk-btn--ghost">Anulează</button><button class="tk-btn tk-btn--primary">Salvează</button></div>
</div></div>
<div class="tk-toast" role="status" hidden>Salvat</div>
```
`<dialog class="tk-modal">` with `showModal()` also works. Toggle `hidden` to show or hide both elements. Close the modal on Esc and on a backdrop click, and return focus to the element that opened it.

### Task views
- **Kanban:** `.tk-kanban > .tk-kanban__col > (.tk-kanban__head, .tk-kanban__card[draggable])`. The extras are `.tk-kanban__head`, `.tk-kanban__meta`, `.tk-kanban__col.is-over` (drop target), `.tk-kanban__card.is-dragging` and `.is-done`, and `--card-accent` on the card for the left stripe colour.
- **Calendar:** put it in a `.tk-card` whose head is the month band (`<b>Sept. 2026</b>` plus ‹ › icon buttons).
  ```html
  <div class="tk-cal">
    <div class="tk-cal__head"><span>Luni</span>…<span>Duminică</span></div>   <!-- the weekday ROW -->
    <div class="tk-cal__day is-out"><span class="tk-cal__num">31</span></div>
    <div class="tk-cal__day is-today"><span class="tk-cal__num">4</span>
      <div class="tk-cal__item"><input class="tk-check" type="checkbox"><span>Scrie diploma</span></div></div>
  </div>
  ```
  The extras are `.tk-cal__num` (day number strip) and `.tk-cal__item.is-done`. On phones the checkboxes inside items are hidden and the text is truncated, so use short weekday labels there.
- **Matrix:**
  ```html
  <div class="tk-matrix"><section class="tk-matrix__q tk-matrix__q--do">
    <h3 class="tk-matrix__title">Fă acum</h3><p class="tk-matrix__sub">Important și urgent</p>
    <div class="tk-matrix__body"><div>…task row…</div></div></section>…</div>
  ```
  The modifiers are `--do` (sage), `--plan` (rose), `--delegate` (sand) and `--drop` (grey). `.tk-matrix__title`, `__sub` and `__body` are extras.

### Habits
```html
<div class="tk-scroll"><table class="tk-habit-grid">
  <thead>
    <tr><th class="tk-habit-grid__week tk-habit-grid__name">Obicei</th><th class="tk-habit-grid__week" colspan="7">Săptămâna 1</th><th class="tk-habit-grid__week is-week-start" colspan="7">Săptămâna 2</th></tr>
    <tr><th class="tk-habit-grid__name"></th><th>Sâ</th>…<th class="is-week-start">Sâ</th>…</tr>
    <tr><th class="tk-habit-grid__name"></th><th>1</th>…<th class="is-today">11</th>…</tr>
  </thead>
  <tbody><tr><th class="tk-habit-grid__name" scope="row">Antrenament</th><td><input class="tk-check" type="checkbox"></td>…</tr></tbody>
  <tfoot><tr><td class="tk-habit-grid__name">Zilnic</td><td><span class="tk-pct">75%</span></td>…</tr></tfoot>
</table></div>
```
- Put `is-week-start` on **both** the `th` and the `td` of the first day of each week.
- The extras are `.tk-habit-grid__week` (rose week band), `.tk-habit-grid__name` (sticky first column) and `.is-today` (column highlight).

### Rank
- List form: `<ol class="tk-rank"><li><span class="tk-rank__name">Fără dulciuri</span><span class="tk-rank__value">97%</span></li></ol>`. The number is generated automatically and the top 3 are shown in bordo.
- Table form: add `tk-rank` to a `.tk-table`. The first column becomes the rank column.

### Utilities
`.tk-muted`, `.tk-right`, `.tk-center`, `.tk-nowrap`, `.tk-hide-sm` (hidden under 600px) and `.tk-sr` (visually hidden). The global `[hidden]{display:none!important}` is the only `!important` in the file.

## 5. Accessibility notes
- Every interactive element gets a 2px bordo `:focus-visible` outline. Cell inputs show a bordo border and ring instead.
- Checkboxes are native `<input type="checkbox">`, so give each one an `aria-label` when it has no visible label (for example "Antrenament, ziua 3").
- Band titles are white on rose or sage (about 2.4–2.8:1), which copies the photos. They are decorative labels, so always keep them short, bold and uppercase, and never put essential data on a band.
- All motion runs through `--dur`, which drops to 0ms under `prefers-reduced-motion`.
- Phone inputs render at 16px to stop iOS from zooming on focus.

## 6. Extras beyond the contract
`--line-faint`, `--accent-soft`, `--terra-ink`, `--gold-soft`, `--blue-ink`, `--pct`, `--check`, `--check-line`, `--focus`, `--shadow-lg`, `--dur`, `--ease`, `.tk-brand`, `.tk-brand__mark`, `.tk-rule`, `.tk-h2`, `.tk-grid--stretch`, `.tk-spacer`, `.tk-card--sage/--terra/--plain`, `.tk-card__body--flush`, `.chk`, `.idx`, `.cur`, `.num`, `td.is-hl`, `td[data-tone]`, `.tk-table--wrap`, `.tk-progress--bar`, `.tk-donut`, `.tk-donut-wrap`, `.tk-donut__label`, `.tk-kv`, `.tk-kv__k`, `.tk-kv__v`, `.tk-check--lg`, `.tk-check-label`, `.tk-check-label__text`, `.tk-chart__title`, `.tk-kanban__head`, `.tk-kanban__meta`, `.is-over` / `.is-dragging` / `.is-done` states, `.tk-cal__num`, `.tk-cal__item.is-done`, `.tk-habit-grid__week`, `.tk-habit-grid__name`, `.is-today`, `.tk-matrix__title`, `.tk-matrix__sub`, `.tk-matrix__body`, `.tk-rank__name`, `.tk-rank__value`.

## 7. Phase 3 additions
- **Home (`.tk-home`):** a centred promo-slide hero with a dot-and-rule ornament, and thin bordo corner arcs drawn by `.tk-main:has(> .tk-home)` using gradients only. The note is centred. The cards stretch to equal height, each band shows a serif 01/02/03 counter, the stats sit in a 2-column grid with thin rules, and the button is pinned to the bottom of the card.
- **Top bar:** `.tk-brand` shows a ring-and-dot mark via `::before` when no `.tk-brand__mark` is present. On phones the brand and `.tk-sync` share row 1 and the nav takes row 2.
- **Demo banner:** the dot is absolutely positioned, so it never takes its own row.
- **Serif numbers:** every serif (`--font-display`) rule uses `lining-nums`, because Cormorant's old-style figures read badly as "0ı".
