# Motorul comun (`window.TK`)

Scripturi clasice, fără module și fără build. Ordinea de încărcare (vezi `trackers/index.html`):
`shared/core.js` → `shared/charts.js` → `finance/finance.js` → `habits/habits.js` → `tasks/tasks.js` → `shared/app.js`.
Fiecare tracker e un IIFE care apelează `TK.register({...})`. Aplicația-cadru îl montează după hash.

## Înregistrare

```js
(function () {
  'use strict';
  var TK = window.TK, h = TK.h;

  TK.register({
    id: 'finance',            // cheia de stocare (nu o schimba)
    slug: 'finante',          // hash-ul: #finante, #finante-anual …
    name: 'Tracker financiar',
    short: 'Finanțe',         // eticheta din bara de navigare
    tone: 'rose',             // culoarea cartonașului de pe pagina principală (rose|sage|terra)
    tagline: 'Venituri, cheltuieli, facturi, datorii și economii într-o singură privire.',
    version: 1,
    createDemo: function () { return { /* date exemplu realiste */ }; },
    createEmpty: function () { return { /* aceeași formă, fără înregistrări; păstrează categoriile/setările */ }; },
    migrate: function (state) { return state; },          // opțional
    summary: function (state) { return [{ label: 'Sold luna curentă', value: TK.fmt.lei(1234) }]; }, // 2–4 cifre pt pagina principală
    mount: function (el, api) {
      // desenează în `el`; returnează opțional {unmount: fn}
    },
  });
})();
```

Starea (`state`) este un obiect JSON simplu (fără Date, Map, funcții). Cadrul adaugă `state.meta`
(`rev`, `updatedAt`, `demo`) — nu-l folosi, nu-l șterge. Toată starea unui tracker trebuie să încapă în
**sub 250 KB** JSON (e salvată ca un singur document).

## API-ul primit în `mount(el, api)`

| | |
|---|---|
| `api.state` | starea curentă (obiect mutabil). Modifici pe loc, apoi `api.commit()`. |
| `api.commit()` | salvează (local imediat, în cont după 0,7 s). Apelează după fiecare acțiune a utilizatorului. |
| `api.route` | sub-ruta curentă (textul după `-` din hash), ex. `'anual'` pentru `#finante-anual`; `''` = implicit. |
| `api.go(sub)` | schimbă sub-ruta → cadrul **remontează** trackerul (apel nou la `mount`). |
| `api.prefs.get(k, def)` / `.set(k, v)` | preferințe per vizitator (luna selectată, filtre). Nu sunt date. |
| `api.h, api.fmt, api.date, api.charts, api.ui` | aceleași ca `TK.*` |

Când datele se schimbă din afară (alt dispozitiv, import, „Începe de la zero”), cadrul remontează trackerul.
Deci: ține în `api.prefs` tot ce e stare de interfață (lună/an selectat, filtre, tab) ca să supraviețuiască remontării.
Re-randează local (doar secțiunea afectată) după o acțiune, ca să nu pierzi focusul din câmpuri.

## Utilitare

- `TK.h(tag, attrs, ...children)` → element. `attrs`: `class`, `style` (string sau obiect, inclusiv `'--p'`), `dataset`, `onclick`/`oninput`/`onchange`…, `value`, `checked`, `disabled`, `html` (innerHTML — evită pentru text de la utilizator). Copii: text, noduri, array-uri, `null` ignorat.
- `TK.clear(el)`, `TK.esc(str)`, `TK.uid()`, `TK.clone(obj)`, `TK.debounce(fn, ms)`, `TK.sum(arr, fn)`, `TK.groupBy(arr, fn)`, `TK.ratio(a, b)` (0 dacă b = 0).

### Formatare (`TK.fmt`)
- `lei(1500)` → `1 500,00 lei` · `lei(1500, 0)` → `1 500 lei` · `num(1500.5)` → `1 500,50` · `num(n, 0)`
- `leiShort(150000)` → `150 mii` (axe)
- `pct(1.0143)` → `101,43%` (primește **raport**, nu procent) · `pct(r, 1)` → o zecimală
- `parseNum('1 500,50')` → `1500.5` (acceptă și `1.500,50`, `1500.5`; gol → `null`)
- `date('2026-01-05')` → `05 ian. 2026` · `dateShort` → `05 ian.` · `month(0)` → `Ianuarie` · `monthYear(2026, 8)` → `Septembrie 2026` · `days(5)` → `5 zile`

### Date (`TK.date`) — datele sunt stringuri ISO `YYYY-MM-DD`, lunile 0–11
- `today()`, `iso(Date)`, `parse(iso)`, `make(y, m, d)`, `year(iso)`, `month(iso)`, `day(iso)`, `ym(iso)` → `2026-09`
- `daysInMonth(y, m)`, `addDays(iso, n)`, `diffDays(a, b)` (= b − a), `weekday(iso)` (0 = luni … 6 = duminică), `startOfWeek(iso)`
- `chunkWeeks(y, m)` → `[[1..7],[8..14],…]` (săptămânile „SĂPTĂMÂNA 1…5” din foile de calcul)
- `calendarGrid(y, m)` → săptămâni luni→duminică `[{iso, day, inMonth}]`
- `MONTHS`, `MONTHS_SHORT`, `WEEKDAYS` (`Luni`…), `WEEKDAYS_SHORT` (`Lu Ma Mi Jo Vi Sâ Du`)

### Dialoguri (`TK.ui`) — `alert/confirm/prompt` NU funcționează în vizualizator, folosește-le pe acestea
- `ui.toast('Salvat.')`
- `ui.confirm({title, text, ok, cancel, danger}) → Promise<boolean>`
- `ui.form({title, fields, submit, validate(values) → mesaj|null, onDelete: true}) → Promise<values|null>`
  câmpuri: `{name, label, type: 'text|money|number|date|select|textarea|checkbox', options: ['A','B'] | [{value,label}], value, required, placeholder, hint}`.
  `money`/`number` se întorc ca număr (sau `null`). Cu `onDelete: true` apare butonul „Șterge”, iar rezultatul e `{__delete: true}`.
- `ui.modal({title, content: Node, actions: [{label, kind, onClick(close) → false ca să rămână deschis}]}) → close()`

### Grafice (`TK.charts`) — toate primesc un element container și se redesenează la redimensionare
- `donut(el, {value, max?, top: 'PROGRES', main?: '81,7%', sub?: '304 / 372', color?, size: 150})` — inel de progres (value = raport 0..1 sau value+max)
- `pie(el, {data: [{label, value, color?}], hole: 0 | 0.6, format: TK.fmt.lei, legend: true, size: 170, center?})`
- `bars(el, {labels, series: [{name, values, color?}], height, format, yFormat, yMax, axis: true, valueLabels, sublabels, colorFn(v, i, si)})`
- `hbars(el, {labels, series: [{name, values, color?}], format})` — Plan vs Fapt orizontal
- `area(el, {labels, values, max: 1, height, format, tips?})` — curba „Dinamica pe zile”
- `legend([{label, color, value?}])` → Node
Culori: implicit `var(--chart-1…8)` în ordine fixă; Plan = `var(--chart-plan)`, Fapt = `var(--chart-fact)`.
O culoare urmează **entitatea**, nu rangul: dă aceeași culoare aceleiași categorii peste tot (ex. mapează categoria → index fix).

## Reguli
- Interfața în **română**, sumele în **lei**. Text scris pentru utilizator (butoane care spun exact ce fac).
- Nu folosi `alert/confirm/prompt`, `window.print`, `window.open`, linkuri `download`, iframes.
- Fără biblioteci externe. Doar clasele din `shared/theme.css` (vezi `shared/DESIGN.md`) + CSS propriu în fișierul trackerului, prefixat cu `.tk-tracker--<id>`.
- Pagina nu are voie să deruleze orizontal la 390 px: tabelele late stau în `.tk-scroll`.
- Controale: fiecare `input/select` are `id` stabil și `label` (sau `aria-label`).
