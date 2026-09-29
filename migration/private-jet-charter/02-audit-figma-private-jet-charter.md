# 02 — Audit Figma: pagina „Private Jet Charter” (LunaJets)

- **Fișier Figma:** fileKey `kLdwkY54wIiha02RhcMP36`, pagina `LJ` (`264:5234`)
- **Tip audit:** READ-ONLY. Nu s-a scris nimic în Figma sau în Webflow și nu s-a atins git-ul.
- **Țintă:** reconstrucție în Webflow cu Client-First v2, **refolosind sistemul construit pentru About și Why LunaJets** (vezi `../about/04-build-log.md`, `../why-lunajets/04-build-log.md`, `../why-lunajets/02-audit-figma-why-lunajets.md`).
- **Data:** 2026-09-29
- **Capturi:** `/home/user/IDS/migration/private-jet-charter/figma-screenshots/`

| Fișier | Conținut |
|---|---|
| `reference-image-41_private-jet-charter-column.png` | Decupajul coloanei „Private Jet Charter” din referința `264:7690` (1092×4062, **scara 0.7583** față de frame-ul de 1440×5356), cu fotografiile puse la locul lor |
| `ref_00-navbar_264-6396.png` … `ref_07-footer_264-6773.png` | Aceleași 8 zone, decupate per secțiune din coloana de mai sus |
| `chart-mobile_264-6774_wireframe-from-metadata.png` | **Wireframe reconstruit local din `get_metadata`** pentru CHART MOBILE (786×2236, ×2). **Nu e o randare Figma:** pozițiile, dimensiunile și textele sunt exacte, culorile sunt presupuse (chip navy, rânduri-etichetă gri deschis) |

> ⚠️ **Limitare de acces (important).** Limita MCP Figma (plan Starter) era deja atinsă din auditul Why LunaJets. În această sesiune:
> - `get_metadata` **nu a mai fost apelat**: s-a refolosit rezultatul salvat local al apelului pe toată pagina `264:5234` (16:06, sesiunea Why). El conține deja frame-ul PJC `264:6395` și `CHART MOBILE` `264:6774` complet (structură, node ID-uri, poziții, dimensiuni, **toate textele** — numele layerelor text = conținutul lor);
> - s-a încărcat `skill://figma/figma-design-to-code/SKILL.md`;
> - primul `get_design_context` (pe `264:6395`, `forceCode`) a răspuns *„You've reached the Figma MCP tool call limit on the Starter plan”*. **Nu s-a mai apelat niciun tool Figma după aceea** (nici design context pe `264:6774`, nici `get_screenshot`).
>
> Consecință: **nu există nicio valoare tipografică sau de culoare exactă din Figma pentru această pagină.** Geometria (x, y, w, h), ordinea și textele sunt exacte (metadata). Mărimile de font, line-height-urile, culorile și radius-urile sunt **estimate** din geometrie (înălțimea casetelor de text / numărul de rânduri), din eșantionarea pixelilor în referință (care e neclară la scara 0.758) și din valorile exacte ale paginilor About/Why. Toate sunt marcate cu **≈** și trebuie confirmate în Dev Mode înainte de build.

---

## 1. Frame-uri și breakpoint-uri

| Nod | Nume | Poziție (x, y) | Dimensiune | Rol |
|---|---|---|---|---|
| **`264:6395`** | **Private Jet Charter — LunaJets** | 3951, 0 | **1440 × 5356** | **Desktop, în scop** |
| **`264:6774`** | **CHART MOBILE** | 5591, 1206 | **393 × 1118** | **Mobil, doar secțiunea „Comparison”** (tabelul comparativ) |
| `264:7695` | text `https://www.lunajets.com/en/private-jet-charter` | 4281, -116 | — | URL-ul live, deasupra frame-ului |
| `264:7690` | image 41 | 6409, -94 | 5216 × 6071 | Referința cu fotografii; **coloana din dreapta** = Private Jet Charter |

| Breakpoint | Stare |
|---|---|
| Desktop 1440 | ✅ `264:6395` |
| Tablet (991) | ❌ **LIPSEȘTE** |
| Mobile landscape (767) | ❌ **LIPSEȘTE** |
| Mobile portrait (479) | ⚠️ **Parțial**: doar tabelul comparativ (`264:6774`, 393 px). Restul paginii nu are mobil |

**Ordinea verticală (y în frame):**

| # | Secțiune | Nod | Nume layer | y | Înălțime | Fundal |
|---|---|---|---|---|---|---|
| 0 | Navbar | `264:6396` | Top-navbar | 0 | 76 | navy |
| 1 | Hero cu căutare (widget quote) | `264:6423` | `section_deposit-hero` (!) | 76 | 424 | fotografie închisă + panou alb translucid |
| 2 | Bloc H1 (text + imagine) | `264:6440` | `section_h1-block` | 500 | 568 | alb |
| 3 | Tabel comparativ | `264:6456` | `section_flying` (!) | 1068 | 1114.07 | alb |
| 4 | Deposit Account (3 carduri) | `264:6586` | `section_booking-experience` | 2182.07 | 596.64 | alb |
| 5 | Special private jet charter (8 carduri) | `264:6625` | `section_flying` (!) | 2778.70 | 1233.30 | alb |
| 6 | Destinații în trend (4 carduri foto) | `264:6719` | `section_flying` (!) | 4012.01 | 622.85 | alb |
| 7 | Footer | `264:6773` | Footer Container (instanță) | 4634.86 | 681 | navy |

**Ritm vertical:** toate secțiunile 2–6 au `container-medium` la **y = 56** și **56 px jos** (excepție: 5, unde cardurile depășesc containerul, vezi §6). About și Why folosesc **80**. Între două secțiuni albe rezultă 112 px.

---

## 2. Secțiuni, în detaliu (Desktop 1440)

### 0. Navbar: `264:6396`

- Aceeași instanță ca în About/Why: logo 100×20 (`264:6397`), navigație 573×9 la x=**294.5** (About: 282.5), `DESTINATIONS` ascuns (`264:6415`), `Buttons Container` 378×44 (`264:6419`–`264:6422`).
- Nicio stare activă desenată pentru linkul PRIVATE JET CHARTER.
- **Reutilizare:** componenta Webflow **Navbar** **ca atare**.

### 1. Hero cu căutare: `264:6423` „section_deposit-hero” (1440 × 424)

**Layout.**
- Fundal: **fotografie pe tot frame-ul** (fill de imagine pe frame, fără layer de imagine în arbore). Referința: **jet privat pe pistă, la amurg, în tonuri albastru-închis** (navy ≈ `#202835` sus, `#1B222A` jos, eșantionat), probabil cu overlay navy.
- Panou `264:6424` „Container”: **1280 × 226** la x=80, y=99 → padding secțiune **99 sus / 99 jos**. Fundal **alb translucid** (eșantionat ≈ `#9B9FA3` peste foto ⇒ ≈ `rgba(255,255,255,0.55)`, posibil cu `backdrop-filter: blur`, ca navbar-ul). Radius ≈ 0–2.
- Padding interior panou: **48** stânga/dreapta, **40** sus, **60** jos (asimetric).

**Conținut:**

| # | Element | Nod | Specificații |
|---|---|---|---|
| 1 | Tab-uri `264:6425` (1184 × 44) | instanță `TabOnLight` `264:6426` (343 × 44) | 3 tab-uri: `ONE WAY` (activ: fundal navy, text alb), `ROUND TRIP`, `MULTI-CITY` (inactive: text gri, fără fundal). Gilroy ≈ 11–12 px UPPERCASE, ls ≈ |
| 2 | gap 16 | — | tab-uri → rând de căutare |
| 3 | Rând căutare `264:6427` (1184 × 66) | — | câmpuri albe, înălțime **66** |
| 3a | `From` | `264:6430` Input-onLight/Main, 327 × 66 | placeholder `From` + chevron ▾ |
| 3b | Buton swap | `264:6433` IconButtonSmall/onLight 44 × 44 (+ icon `264:6434` 20×18) | cerc navy cu săgeți ⇄, **suprapus** între From și To (x=320.5) |
| 3c | `To` | `264:6431`, 327 × 66 | placeholder `To` + chevron |
| 3d | separator | `264:6437` Input-onLight/Main, **1 × 66** (!) | instanță de input folosită ca linie |
| 3e | `Departure date & time` + pasageri | `264:6438`, 403 × 66 | în referință apar **două câmpuri**: `Departure date & time` ▾ și pasageri (icon persoană, `1` ▾) |
| 3f | CTA `REQUEST QUOTE` | `264:6439` ButtonBig/onLight, **110 × 66** în metadata | buton plin navy, text alb uppercase. **În referință butonul are ≈ 185 px** și nu se suprapune |

**Imagine:** fundal secțiune, 1440 × 424 (raport **3.4 : 1**), fotografia de mai sus. Probabil LCP-ul paginii → `loading="eager"` / `fetchpriority="high"` (dacă devine `<img>` absolut în loc de `background-image`).

**Reutilizare:**

| Element | Decizie |
|---|---|
| Structura `section_` › `padding-global` › `container-large` › `padding-section-medium` | **ca atare** (padding 99 ≈ `padding-section-medium` 80 + ajustare, sau lasă 5rem) |
| Fundal foto + overlay | **nou**: `pjc-search_background-image-wrapper` (absolute, inset 0) › `img.image-cover` + `pjc-search_overlay` (navy, opacitate ≈) |
| Panou | **nou**: `quote-search_component` (fundal alb ≈55 %, blur, padding 2.5rem 3rem 3.75rem). **Propun nume fără prefix de pagină**, pentru că widget-ul de quote va apărea și pe alte pagini (home, destinații) |
| Tab-uri | **nou**: `quote-search_tabs` › `quote-search_tab` + combo `is-active` (`role="tablist"` / `aria-selected`, sau radio-uri stilizate) |
| Rând câmpuri | **nou**: `quote-search_form` (flex, gap 0.5rem) › `quote-search_field` (+ combo `is-wide` pentru date) › `form_input` (dacă se refolosește clasa input din footer, altfel `quote-search_input`) |
| Swap | **nou**: `quote-search_swap` (cerc 2.75rem navy, absolut între câmpuri), `aria-label="Swap departure and arrival"` |
| CTA | `button` (navy plin, **refolosit**) + posibil combo `is-large` (înălțime 66). În Webflow: `button` cu `min-height` pe `quote-search_submit` |
| **Funcționalitate** | **În afara auditului de design.** Pe site-ul vechi, widget-ul are autocomplete aeroporturi, date picker și trimite spre fluxul de quote. De decis la Stage 03: **embed al widget-ului existent** (recomandat) vs reconstrucție |

### 2. Bloc H1: `264:6440` „section_h1-block” (1440 × 568)

**Layout.** `container-medium` `264:6441` 1280 × 456 la y=56 (padding **56 / 56**). În interior `about_us_content` (!) `264:6442`:
- Coloana text `264:6443`: **647 px** (x 0–647), conținut poziționat absolut.
- Imagine `264:6455`: **633 × 454** la x=647, **lipită** de coloana text (gap 0 în frame; gap vizual real = 647 − 602 = **45 px**, marginea paragrafului).
- Aliniere: sus (text 456, imagine 454).

**Conținut (ordine vizuală):**

| # | Element | Nod | Poziție (y în coloană) | Specificații |
|---|---|---|---|---|
| 1 | Eyebrow `ON DEMAND PRIVATE AVIATION` | `264:6444` (linie `264:6445` 24×1, text `264:6446`) | 0 | identic cu About: linie 24×1 navy, gap 10, Gilroy 11 px ls 2.42 UPPERCASE (≈, din About) |
| 2 | gap 25 | spacer-20 `264:6452` (nu corespunde) | — | real **25 px** |
| 3 | **H1** `Private jet charter` / *`with LunaJets`* | `264:6447` | 38 → 154 (**116 px, 2 rânduri**) | Vanitas ≈ **54 / 58 (≈1.07)**, rândul 2 italic (referință). Consistent cu About (54/1.1) |
| 4 | gap 25 | spacer-24 `264:6453` | — | — |
| 5 | **Linie divizoare** | `264:6448` › `264:6449` | 179, **60 × 1** | **Element nou**: linie scurtă navy (eșantionat gri ≈ `#A4ACB3` din cauza blur-ului ⇒ ≈ navy sau navy 50 %) |
| 6 | gap 25 | spacer-32 `264:6454` (nu corespunde) | — | — |
| 7 | Paragraf(e) | `264:6451` în `p1-wrap` `264:6450` (602 × 251) | 205, **602 × 174** | un singur layer text cu **2 paragrafe** (6 rânduri × **29 px**: 2 + rând gol + 3). Gilroy ≈ 16 / **≈29 (1.8)** |

Text verbatim:
- P1: `Access the largest choice of aircraft without being locked in a costly contract. Discover the benefits of chartering flights with LunaJets.`
- P2: `LunaJets grants you access to over 4,800 of the most recent and sought-after private jets worldwide, offering unrivalled charter solutions for both business and leisure travels. Whether you are flying private to Europe, Asia, or the United States.`

**Imagine** `264:6455` „[IMG] Family on jet — hero photo”: **633 × 454** (raport **1.394 ≈ 7:5**), dreapta, radius ≈ 0. **Referința NU arată o familie**, ci un **bărbat în costum închis urcând scara unui jet privat cu fuzelaj metalic lustruit**, motorul și coada în dreapta, cer albastru. **Fără buton/CTA** în acest bloc.

**Reutilizare:**

| Element | Decizie |
|---|---|
| Layout 2 coloane text / imagine | `split_component` (About) are gap 4rem, imagine 5/4, align center. Aici: coloane ~1.02 : 1, gap ≈ 45, imagine **7/5**, align start. → **combo** `split_component is-pjc-hero`? Ar trebui suprascrise și copiii (aspect imagine). **Recomand clasă nouă** `pjc-hero_component` (grid 1fr 1fr, gap 3rem, align start) › `pjc-hero_content` + `pjc-hero_image-wrapper` (aspect 7/5, overflow hidden, radius small) › `img.image-cover`. Alternativă de discutat la Stage 03: generalizarea `why-hero_*` / `about-hero_*` într-un `hero-split_*` partajat (al 3-lea hero cu aceeași idee) |
| Eyebrow | `tagline_*` **ca atare** |
| H1 + `<em>` | tag `h1` global **ca atare** |
| Spațiere 25 | `spacer-small` (1.5rem = 24) **refolosit** |
| Linie divizoare 60 px | **nou** `pjc-hero_divider` (3.75rem × 1px, `Border Color/alternate` navy). Dacă mai apare pe alte pagini: utilitar partajat `divider-short` |
| Paragrafe | `p` global. Line-height ≈1.8 → vezi §4 (aceeași abatere ca la Why `card-split`) |

### 3. Tabel comparativ: `264:6456` „section_flying” (1440 × 1114.07)

**Header** `264:6458` „_w-why_header” (**818** px lățime, x=0 în container):
- Eyebrow `WAYS TO FLY` (`264:6459`, text `264:6461`) → spacer-20 → **H2** `264:6463` (818 × 86, 2 rânduri): `Charter vs fractional ownership` / `vs` *`membership program`* (rândul 2 italic în referință; de confirmat dacă „vs” e italic) → spacer-24 → paragraf `264:6465` (818 × 58, 2 rânduri de **29 px**):
  `Choosing how you fly privately is a significant decision. This comparison cuts through the complexity so you can see at a glance what each model really costs: in fees, flexibility, and commitment.`
- Header → tabel: **48 px** (tabelul la y=249).

**Tabel** `264:6466` „Row - Comparison table → Data” (1280 × 753.07) › `264:6467` (1277.87 × 750.93, offset 1.57/1.52 ⇒ **chenar ≈1.5 px** în jur).

> ⚠️ Tabelul e **lipit și scalat ×1.0667 (16/15)**: 14.9333 = 14 × 1.0667, 30.933 = 29 × 1.0667, 71.4667 = 67 × 1.0667, 61.8667 = 58 × 1.0667, 29.867 = 28 × 1.0667. Valorile normalizate sunt date între paranteze.

- **Coloane:** 384.77 (etichete, ≈30 %) · 302.54 (LUNAJETS, ≈23.7 %) · 300.57 (Fractional, ≈23.5 %) · 290.01 (Membership, ≈22.7 %).
- **Rând header** 71.47 (norm. **67**): celula 1 goală; celula LUNAJETS **fundal navy** (≈ `#0C1C36` eșantionat ⇒ `#061D38`) cu **logo-ul LunaJets alb** (wordmark italic, `264:6471`, 137 × 34.7 ⇒ norm. ≈ 128 × 32); celulele Fractional/Membership fundal ≈ `#F7F8FA`, text gri UPPERCASE ≈ 11–12 px, ls ≈ 1–2 px.
- **Rânduri de date** 60.8 (primul) / 61.87 (norm. **58**), 11 rânduri, separatoare orizontale subțiri (≈ `#E1E5E8`, 1 px).
- **Coloana etichete:** text la x=29.87 (norm. **28**), UPPERCASE, gri (≈ `Text Color/tertiary`), ≈ 11–12 px, ls ≈ 1.5 px.
- **Coloana LunaJets (evidențiată):** fundal ≈ `#F5F8FB` pe toată coloana; valoarea e un **chip navy** centrat: înălțime 30.93 (norm. **29**), padding orizontal 14.93 (norm. **14**), text alb ≈ 12–13 px, radius ≈ 4.
- **Coloanele Fractional/Membership:** text simplu centrat, gri închis ≈ 13–14 px.

| # | Etichetă (col. 1) | LUNAJETS (chip) | Fractional ownership | Membership program |
|---|---|---|---|---|
| 1 | `Upfront fees` | `None` | `Required aircraft share purchase` | `Full subscription` |
| 2 | `Annual dues` | `None` | `Fixed monthly management fee` | `None` |
| 3 | `Commitment` | `Pay as you go` | `Long-term contract` | `Multi year subscription program` |
| 4 | `Worldwide reach` | `Global` | `Based on plane location` | `Areas of service based on subscription` |
| 5 | `Fleet access` | `4,800+` | `Limited` | `Limited to company aircraft` |
| 6 | `Minimum booking notice` | `None` | `Depends on share` | `Usually 48h` |
| 7 | `Service` | `24/7` | `Less personalised support` | `Less personalised support` |
| 8 | `Peak / blackout days` | `None` | `Depending on share` | `Yes` |
| 9 | `Busy airport surcharges` | `None` | `Depending on share` | `Yes` |
| 10 | `Taxi time` | `Incl. in price` | `Yes` | `Yes` |
| 11 | `Conversion rates` | `Fully flexible` | `Yes` | `Yes` |

Noduri: rânduri `264:6476`, `6486`, `6496`, `6506`, `6516`, `6526`, `6536`, `6546`, `6556`, `6566`, `6576`; header `264:6468`.

#### 3M. Versiunea mobilă: `264:6774` „CHART MOBILE” (393 × 1118)

Structură (din metadata; vezi wireframe-ul reconstruit):

| Zonă | Nod | Poziție / dimensiune | Specificații |
|---|---|---|---|
| Eyebrow `WAYS TO FLY` | `264:6911` (linie `264:6913`, text `264:6912`) | x=19.33, y=24; 124.7 × 14 | linia 24 la x=0, textul la x=**30** (gap **6**, față de 10 pe desktop) |
| H2 | `264:6914` | y=50, **301.28 × 99**, **3 rânduri** cu rupturi explicite | `Charter vs fractional` / `ownership vs membership` / `program`. ≈ Vanitas **30 / 33**. Italicul nu se poate verifica |
| Lede | `264:6915` | y=164, 362.92 × 39, 2 rânduri | **Text diferit de desktop (scurtat):** `Choosing how you fly privately is a significant decision` / `— see at a glance what each model really costs.` ≈ Gilroy 13–14 / 19.5 |
| Tabel | `264:6777` „Row - Table wrapper cell (border + radius on this one td)” | x=**14**, y=217, **365 × 852** | chenar + radius **doar pe wrapper** (numele layerului). Interior `264:6778` 363 × 850 (chenar 1 px) |
| Header | `264:6779` | 363 × **52** | **3 coloane, fără coloana de etichete**: LUNAJETS (logo 83 × 21) 127.16 · `Fractional` / `ownership` 117.98 · `Membership` / `program` 117.86. Text ≈ 10–11 px pe 2 rânduri |
| Rând-etichetă (× 11) | ex. `264:6788` „Row - ROW: Upfront fees” | 363 × **28**, pe toată lățimea | eticheta la x=12, y=12, ≈ 10–11 px. **Eticheta devine un rând separat deasupra valorilor** |
| Rând-valori (× 11) | ex. `264:6790` | 363 × **47** (valori pe 2 rânduri) / **41** (1 rând) / 44 (ultimul) | 3 celule: chip LunaJets (înălțime **21**, padding **7**, text ≈ 10–11 px) + 2 valori text centrate, rupte pe 2 rânduri |
| Legendă | `264:6906` | x=117.44, y=**1085**, 158 × 13 | 2 pătrățele **8 × 13** + `LunaJets` / `Other models`. **Legenda există doar pe mobil** |

- Ultimul rând-etichetă e numit „Conversion rates **(last row — no bottom border needed)**”: ultimul rând nu are bordură de jos.
- Marginea stângă diferă: text la **19.33**, tabel la **14** (față de `padding-global` 1.25rem = 20 pe mobil).
- Pas vertical: H2 → lede **15 px**, lede → tabel **14 px**, tabel → legendă **16 px**.
- Textele celulelor sunt aceleași ca pe desktop (cu rupturi de rând manuale).

**Reutilizare (desktop + mobil):**

| Element | Decizie |
|---|---|
| Header de secțiune | pattern **Section header** (tagline › `spacer-custom1` › `h2` cu `<em>`) **ca atare**. Lățime 818 → `max-width-xlarge` (Client-First, 64rem) sau lasă `max-width-large` (45rem = 720, paragraful trece pe 3 rânduri) |
| Paragraf lede | `p` global (sau `text-size-medium` dacă se vrea mai mare). Mobil: **un singur text** pentru ambele breakpoint-uri (recomand textul desktop; nu duplica cu `hide-mobile-*`) |
| Tabel | **nou, partajat**: `comparison_component` (wrapper cu chenar `Border Color/primary`, radius small, overflow hidden) › `table.comparison_table` › `thead` / `tbody` › `tr.comparison_row` › `th.comparison_head-cell` (+ combo **`is-highlight`**: navy, logo), `th.comparison_label-cell` (`scope="row"`), `td.comparison_cell` (+ combo **`is-highlight`**: fundal highlight), `span.comparison_chip`, `img/svg.comparison_logo`. `<caption class="sr-only">` (ex. „Private jet charter vs fractional ownership vs membership program”). Tabel HTML real (accesibil), prin elementul Custom Element / HtmlEmbed în Webflow |
| Mobil (≤767 / ≤479) | **același DOM**, alt layout CSS: `tr` → `display: grid; grid-template-columns: repeat(3, 1fr)`; `th.comparison_label-cell` → `grid-column: 1 / -1` (rândul-etichetă de 28 px); prima celulă goală din header → `display: none`. Legenda → **nou** `comparison_legend` (vizibil doar ≤767), `aria-hidden="true"` dacă header-ul rămâne semantic |
| Chip | **nou** `comparison_chip` (inline-flex, padding 0 0.875rem, min-height 1.8125rem, fundal `Background Color/primary`, text `Text Color/alternate`, radius ≈ 0.25rem = `Radius/Medium`; mobil: padding 0 0.4375rem, 1.3125rem) |
| Logo LunaJets | SVG-ul logo-ului din Navbar (`currentColor`, alb), refolosit inline |

### 4. Deposit Account: `264:6586` „section_booking-experience” (1440 × 596.64)

**Header** `264:6588` „section_title-wrapper” (1280 × 119), **pe 2 coloane**:
- `header-left` `264:6589` (608): eyebrow `OUR BOOKING MODEL` (`264:6590`/`264:6592`) → spacer-20 → H2 `264:6594` (451 × 86): `Streamlined booking` / *`with the Deposit Account`*.
- `header-right` `264:6595` (608, la x=**672** ⇒ gap **64**, y=90): paragraf `264:6596` (608 × 29, 1 rând, lh ≈29), **aliniat jos** cu H2: `Deposit money on our account to access the perfect booking experience.`
- Header → carduri: **64 px**.

**Grilă** `264:6597` „booking_experience-grid” (1280 × 301.64): **3 carduri 405.33 × 301.64, gap 32**.
Card „experience-card”: chenar subțire (≈ `#E1E5E8`), fundal alb, radius ≈ 2, **padding 36**, conținut aliniat stânga:
- icon line-art navy (≈ 50 × 64 / 60.5 × 52.5 / 50 × 54.8, **dimensiuni diferite**) → gap **24** → titlu Vanitas ≈ **28 / 35** (1 sau 2 rânduri) → gap **24** → text Gilroy ≈ **16 / 24** (2 rânduri de 24 px).

| Card | Nod | Icon (nod) | Titlu | Text |
|---|---|---|---|---|
| 1 | `264:6598` | `264:6599` Group 5869 — **document cu semnătură** (foaie cu colț îndoit, „v”) | `Book with one simple signature` | `Book flights freely without the hassle of repeated wire transfers.` |
| 2 | `264:6608` | `264:6609` Group 5870 — **card bancar tăiat** | `No more credit card holds` | `Don't worry about securing last-minute flights or settling additional expenses.` |
| 3 | `264:6616` | `264:6617` Group 5871 — **cronometru / ceas** | `No fund expiration` | `If you need to withdraw your funds, you can do it at any moment.` |

**Reutilizare:**

| Element | Decizie |
|---|---|
| Header pe 2 coloane | **nou** `pjc-booking_header` (grid 1fr 1fr, column-gap 4rem, align-items end; ≤767: o coloană, gap 1.5rem). Dacă apare pe alte pagini → `header-split_component` partajat |
| Carduri | **nou** `ul.booking_list` (grid 3 col, gap 2rem, `role=list`) › `li.booking_card` (flex column, padding 2.25rem, border `Border Color/primary`, radius small) › `booking_card-icon` (3rem, SVG `currentColor`, `aria-hidden`) + `h3.booking_card-title` + `p` |
| Titlu 28 px | Nu există treaptă de 28: H3 = 24, `card-split_title` = 32. **Recomand** `h3.heading-style-h3` (1.5rem) **ca atare**, cu o mică pierdere de fidelitate; alternativ `booking_card-title` 1.75rem (nou) |
| Text | `p` global (16/24) **ca atare** |
| Gap-uri 24 | `spacer-small` sau gap 1.5rem în `booking_card` |
| Icoane | 3 SVG-uri noi; sursa: site-ul vechi sau export Figma când se resetează limita. Normalizare la o casetă de 3rem |

### 5. Special private jet charter: `264:6625` „section_flying” (1440 × 1233.30)

**Header** `264:6627` (1280 × 145): eyebrow `WAYS TO FLY` (`264:6628`, text `264:6630`) → spacer-20 → H2 `264:6632` (88 px, 2 rânduri): `Special private` / `jet charter` (**fără parte italică**, singurul H2 așa de pe pagină) → spacer-24.
- H2 → carduri: **64.4 px** (grila la y=201 + 40.4).

> ⚠️ Cardurile sunt **lipite și scalate ×1.0298** (offset-uri 1.0297681 pe toate imaginile/containerele, săgeata 13.387 = 13 × 1.0298). Suma lor dă totuși exact 1280, deci normalizarea e simplă: **4 × 296, gap 32** (ca `stats_list` / `tailored_list`).

**Grilă** `264:6634` (1280 × 976.3): **4 coloane × 2 rânduri**, carduri **295.29** lățime, gap orizontal **32.95**, gap vertical **≈37** (rândul 2 la y=556.55). Înălțimi inegale: rândul 1 **478–479**, rândul 2 **454–456**.

Card „Background+Border”: chenar ≈ `#E1E5E8` 1 px, fundal alb, radius ≈ 0–2, **text centrat**:
- imagine sus, **full-bleed** (fără padding): **294.26 × 180.16** (raport **1.633 ≈ 13:8**);
- titlu `h3` (layer „Heading 3 → …”): Vanitas ≈ **22 / 28.5** (29 px pe 1 rând, 57 pe 2), la ≈ 24 px sub imagine;
- gap ≈ 16 → text Gilroy ≈ **15 / 23** (116 px = 5 rânduri, 139 = 6, 162 = 7), centrat;
- link `LEARN MORE` + săgeată 13.4 px (text 85 × 15), centrat, **jos în card** (aliniat pe rând).

| Rând, col | Card | Imagine (nod, layer) | Ce arată referința | Titlu | Text |
|---|---|---|---|---|---|
| 1,1 | `264:6635` | `264:6636` „image 13” | **lounge / terminal FBO** cu pereți de sticlă, canapele, avion privat afară (posibil **aceeași poză** ca „Last-minute flights” din Why, `264:6344` „image 37”) | `Last minute charter` | `Our experienced team regularly responds to urgent flight requests, ready to fly less than an hour after the client's enquiry. 35 minutes is our quickest take-off time after a booking.` |
| 1,2 | `264:6646` | `264:6647` „image 16” | **elicopter mic** (tip Robinson) aterizat pe iarbă, lumină de apus | `Helicopter charter` | `For final miles or short connections, chartering a helicopter is often the most convenient option. Whether in winter or summer, LunaJets can arrange helicopter transfers to bring you closer to your destination.` |
| 1,3 | `264:6657` | `264:6658` „image 3” | **jet-ambulanță alb cu cruce roșie** (livrea tip Rega) în zbor, cer cu nori | `Emergency charter` | `LunaJets offers rapid, worldwide medical evacuation and air ambulance services. Available 24/7, our team arranges emergency flights for bed-to-bed transfers, repatriations, or the urgent delivery of vital supplies.` |
| 1,4 | `264:6667` | `264:6668` „image00007 (1) 1” | **cabină de jet mare**, rânduri de fotolii crem din piele, culoar central | `Group charter` | `The more, the merrier — can also be true for private flights. Flying larger groups is easy with LunaJets: our global team helps you access the aircraft most well-suited to the entire party.` |
| 2,1 | `264:6678` | `264:6679` „image 29” | **cuplu (bărbat, femeie blondă) râzând la masă în cabina unui jet** | `Leisure charter` | `LunaJets Private Aviation Advisors bring extensive expertise in arranging bespoke flights for every type of leisure travel: family weekend getaways, and winter or summer destinations.` |
| 2,2 | `264:6688` | `264:6689` „cargo_charter 2” | **cală de marfă** cu paleți înfoliați | `Cargo charter` | `Whether precious art, dangerous goods, sensitive documents, or extremely large and heavy cargo, our experts are ready to help you charter the right aircraft for your air freight.` |
| 2,3 | `264:6699` | `264:6700` „image 40” (293.23 × 179.53, ușor mai mică) | **oameni de afaceri** coborând dintr-un jet privat alb, pe pistă | `Corporate charter` | `Expert private jet charter for every sector — government, finance, entertainment, commodities, sports and consortia. Specialised advisors deliver tailored solutions for your industry.` |
| 2,4 | `264:6709` | `264:6710` „image 24” | **strângere de mână la un eveniment corporate**, oameni în costume | `Corporate events` | `Private jet charter for corporate events ensures executives arrive on time and refreshed, stay productive in-flight, and conduct confidential meetings — avoiding commercial travel delays.` |

Link: `Learn more` (afișat `LEARN MORE`) + SVG săgeată, în toate cele 8 carduri (`264:6643`, `6654`, `6664`, `6675`, `6685`, `6696`, `6706`, `6716`).

**Reutilizare:**

| Element | Decizie |
|---|---|
| Header | Section header **ca atare** |
| De ce nu `group_card` | `group_card` are padding 2.25rem 2rem, imagine 3/2 **în interior** (max 17.5rem), titlu **UPPERCASE** ls 0.08em. Aici imaginea e full-bleed, 13/8, titlul nu e uppercase. Ar trebui combo pe card + 2 copii → **clasă nouă** |
| Carduri | **nou, partajat**: `ul.charter-type_list` (grid 4 col, gap 2rem, row-gap 2rem, `role=list`) › `li.charter-type_card` (flex column, border `Border Color/primary`, radius small, overflow hidden, text center) › `charter-type_card-image-wrapper` (aspect **13/8**) › `img.image-cover` + `charter-type_card-content` (flex column, flex 1, padding 1.5rem 1.25rem 2rem) › `h3.heading-style-h4` (**refolosit**, 1.25rem ≈ 20 vs ≈22) + `p.charter-type_card-text` (0.9375rem / 1.5, nou; aceleași valori ca `group_card-text` / `tailored_card-text`) + `charter-type_card-link-wrapper` (margin-top auto, padding-top 1.5rem) |
| Link „Learn more” | `button is-link is-icon` + `button_icon` **ca atare**, cu `button_sr-text` **obligatoriu** (8 × „Learn more”, ex. „Learn more<span class="button_sr-text"> about helicopter charter</span>”) |
| Candidat CMS | cele 8 tipuri de charter au probabil pagini proprii pe site-ul vechi; de decis la Stage 03 dacă lista devine Collection List |

### 6. Destinații în trend: `264:6719` „section_flying” (1440 × 622.85)

**Header** `264:6721` (1280 × 143): eyebrow `WHERE OUR CLIENTS FLY` (`264:6722`/`264:6724`) → spacer-20 → H2 `264:6726` (86 px): `Trending private` / *`jet destinations`* → spacer-24.
- H2 → carduri: **doar 24 px** (cardurile la y=199, imediat după spacer-24). Celelalte secțiuni au 48–64.

**Grilă** `264:6728` (1280 × 367.85): 4 carduri foto, gap **32.66**, dar **lățimi diferite**: 308.58 · 308.32 · **282.55** · **282.55** (cardurile 3–4 conțin un grup de 308 px decalat cu −5.8 și tăiat).

> ⚠️ Blocul e **lipit și scalat ×1.0207** (text country la y=1.0207, padding 24.4976 = 24 × 1.0207). Normalizat: **4 × 296, gap 32**, înălțime ≈ 360 ⇒ raport **≈ 0.82 (≈ 5:6)**.

Card: fotografie pe tot cardul → **gradient** (`Gradient`, transparent sus → navy/negru jos, eșantionat ≈ `#131821` la bază) → text jos-stânga, padding **24**:
- oraș: Vanitas ≈ **20–22**, alb (caseta 23 px);
- gap ≈ 8 → țară: Gilroy ≈ **11 px UPPERCASE**, ls ≈, alb.

| Col | Card | Imagine (nod, layer) | Referința | Oraș | Țară (layer) |
|---|---|---|---|---|---|
| 1 | `264:6729` | `264:6730` „St Tropez 1” | Saint-Tropez: clopotnița ocru, acoperișuri, port cu iahturi | `Saint-Tropez` | `France` |
| 2 | `264:6739` | `264:6740` „**AdobeStock_292037389_Preview 1**” | Ibiza: Dalt Vila luminat noaptea, reflexii în apă | `Ibiza` | `SPAIN` |
| 3 | `264:6749` | `264:6754` „Curchevel 1” (+ `264:6752` „St Tropez 1” rămas în grup) | Courchevel: munți înzăpeziți, pârtie | `Courchevel` | `France` |
| 4 | `264:6761` | `264:6764` „Mykonos 1” | Mykonos: case albe, mare, insulă în fundal | `Mykonos` | `GREECE` |

Nicio indicație de link pe carduri (probabil trebuie să ducă la paginile de destinație).

**Reutilizare:**

| Element | Decizie |
|---|---|
| Header | Section header **ca atare**. Header → carduri: normalizează la `spacer-xlarge` (4rem), ca restul paginii |
| Carduri | **nou, partajat** (destinațiile vor apărea și pe alte pagini): `ul.destination_list` (grid 4 col, gap 2rem) › `li.destination_card` › `a.destination_card-link` (relative, block, aspect **5/6**, overflow hidden, radius small) › `img.image-cover` + `destination_card-overlay` (absolute, gradient navy; valoare brută one-off sau clasă partajată cu presa) + `destination_card-content` (absolute bottom, padding 1.5rem, alb) › `h3.heading-style-h4` + `destination_card-country` (text-size-tiny, uppercase, ls 0.15em). Ceva similar cu `press_card` (overlay peste foto), dar alt layout: nu e combo |
| Candidat CMS | destinațiile sunt candidat natural pentru o colecție **Destinations** (oraș, țară, imagine, slug). De decis la Stage 03 |

### 7. Footer: `264:6773`

- Instanța `Footer Container`, identică cu About/Why. **Reutilizare:** componenta Webflow **Footer** **ca atare**.
- Footer-ul se termină la 4634.86 + 681 = **5315.86**, frame-ul la 5356 ⇒ **40 px albi sub footer** în frame (la Why era invers, tăiat cu 18 px). Irelevant la build.

---

## 3. Sloturi de imagine (rezumat)

> Doar **placeholder-e**, fără upload (ca la About/Why). Toate: wrapper cu `aspect-ratio`, `overflow: hidden`, `img.image-cover`.

| # | Secțiune | Nod | Layer | Desktop | Raport propus | Poziție | Fotografia din referință | Rol / alt |
|---|---|---|---|---|---|---|---|---|
| 1 | Hero căutare | `264:6423` (fill pe frame) | — | 1440 × 424 | fundal (cover) | tot | jet privat pe pistă la amurg, tonuri navy | decorativ (`alt=""`), probabil LCP → eager |
| 2 | Bloc H1 | `264:6455` | [IMG] Family on jet — hero photo | 633 × 454 | **7 / 5** | dreapta | om de afaceri urcând scara unui jet metalizat (**nu** o familie) | ilustrativ, eager (above the fold la 1440×900) |
| 3 | Special / last minute | `264:6636` | image 13 | 294 × 180 | **13 / 8** | card 1 | lounge FBO cu jet afară | ilustrativ |
| 4 | Special / helicopter | `264:6647` | image 16 | idem | 13 / 8 | card 2 | elicopter pe iarbă la apus | ilustrativ |
| 5 | Special / emergency | `264:6658` | image 3 | idem | 13 / 8 | card 3 | jet-ambulanță cu cruce roșie (tip Rega) | ilustrativ |
| 6 | Special / group | `264:6668` | image00007 (1) 1 | idem | 13 / 8 | card 4 | cabină cu rânduri de fotolii crem | ilustrativ |
| 7 | Special / leisure | `264:6679` | image 29 | idem | 13 / 8 | card 5 | cuplu râzând în cabină | ilustrativ |
| 8 | Special / cargo | `264:6689` | cargo_charter 2 | idem | 13 / 8 | card 6 | cală cu paleți înfoliați | ilustrativ |
| 9 | Special / corporate | `264:6700` | image 40 | 293 × 180 | 13 / 8 | card 7 | oameni de afaceri lângă jet pe pistă | ilustrativ |
| 10 | Special / events | `264:6710` | image 24 | 294 × 180 | 13 / 8 | card 8 | strângere de mână la eveniment | ilustrativ |
| 11 | Destinații / Saint-Tropez | `264:6730` | St Tropez 1 | 308 × 367 (296 × 353 norm.) | **5 / 6** | card 1 | Saint-Tropez, clopotniță + port | ilustrativ, alt descriptiv |
| 12 | Destinații / Ibiza | `264:6740` | AdobeStock_292037389_Preview 1 | idem | 5 / 6 | card 2 | Ibiza noaptea | ilustrativ |
| 13 | Destinații / Courchevel | `264:6754` | Curchevel 1 | 282.5 × 367 (tăiat) | 5 / 6 | card 3 | munți înzăpeziți | ilustrativ |
| 14 | Destinații / Mykonos | `264:6764` | Mykonos 1 | idem | 5 / 6 | card 4 | case albe, mare | ilustrativ |

**Asset-uri vectoriale:** logo LunaJets alb în header-ul tabelului (desktop + mobil; = logo-ul din Navbar), 3 icoane Deposit Account, icon swap ⇄ (20 × 18), icon persoană + chevron-uri în widget, săgeata „Learn more” (deja în `button_icon`). Nimic descărcat (limită MCP + URL-uri figma.com blocate de proxy).

---

## 4. Tokenuri: ce e nou față de sistemul About + Why

**Culori** (toate ≈, eșantionate din referința neclară):

| Valoare | Unde | Propunere |
|---|---|---|
| **≈ `#F5F8FB` / `#F7F8FA`** (gri-albăstrui foarte deschis) | coloana LunaJets din tabel; celulele header Fractional/Membership | **NOU, de confirmat.** Nu se potrivește cu `Neutral/lightest` `#F4F2EF` (cald). Propunere: primitivă `Neutral/lightest-cool` + semantic `Background Color/highlight`. Dacă Dev Mode arată aceeași culoare pentru ambele zone, un singur token |
| ≈ `rgba(255,255,255,0.55)` + blur | panoul widget-ului de căutare | valoare brută one-off (sau `Alpha/white-55` dacă widget-ul devine componentă globală) |
| navy + overlay pe foto hero | secțiunea 1 | `Background Color/primary` + opacitate (one-off) |
| gradient transparent → navy | carduri destinații | valoare brută one-off (ca overlay-ul presă) |
| Chip navy, bordura tabelului, chenarele cardurilor | tabel, carduri | existente: `Background Color/primary`, `Border Color/primary` |

**Tipografie:**

| Valoare | Unde | Mapare propusă |
|---|---|---|
| Vanitas ≈ **28 / 35** | titluri carduri Deposit Account | nu există treaptă; `heading-style-h3` (24) **recomandat**, sau `booking_card-title` 1.75rem (nou) |
| Vanitas ≈ **22 / 28.5** | titluri carduri Special charter | `heading-style-h4` (20) **refolosit** |
| Vanitas ≈ 20–22 | oraș în cardurile de destinație | `heading-style-h4` **refolosit** |
| Gilroy ≈ **16 / 29 (≈1.8)** | paragrafele bloc H1, lede tabel, header-right Deposit | **a doua pagină** (după Why `card-split`) cu lh ≈ 29. Pare intenționat (stil „body large”?). **De confirmat în Dev Mode**; dacă da → `text-size-regular` + clasă de line-height sau un utilitar nou `text-style-relaxed` (lh 1.8) |
| Gilroy ≈ 15 / 23 | text carduri Special | `charter-type_card-text` (0.9375rem / 1.5), ca `group_card-text` |
| Gilroy ≈ 11–12 UPPERCASE, ls ≈ 1.5 | etichete tabel, header-e coloane, tab-uri widget | `text-size-tiny` + clasă custom a componentei (`comparison_label-cell`) |
| Gilroy ≈ 12–13 | text chip | în `comparison_chip` |
| Vanitas ≈ **30 / 33** (mobil) | H2 CHART MOBILE | aproape de `h2` la 479 (1.75rem = 28) / 767 (2rem = 32). **Nu e token nou** |
| Gilroy ≈ 10–11 (mobil) | etichete, valori, chip-uri în tabelul mobil | în clasele `comparison_*` la ≤479 |

**Spațiere:**

| Valoare | Unde | Propunere |
|---|---|---|
| **56 / 56** | padding vertical secțiunile 2–6 | nu e în scală (About/Why: 80). Opțiuni: `padding-section-medium` (5rem, consistent cu restul site-ului, **recomandat**) sau `padding-section-small` (3rem ≈ 48) dacă se vrea densitatea din design. Decizie Stage 03 |
| 99 / 99 | padding hero căutare | `padding-section-medium` + panou centrat, sau 6rem custom în `section_pjc-search` |
| 40 / 48 / 60 | padding panou widget | 2.5rem / 3rem / 3.75rem în `quote-search_component` (sau simetric 2.5rem 3rem) |
| **64** | header → carduri (Deposit, Special) | `spacer-xlarge` (4rem) ✓ |
| 48 | header → tabel | `spacer-large` (3rem) sau normalizare la `spacer-xlarge` |
| **24** | header → carduri destinații | prea mic; normalizare la `spacer-xlarge` |
| 25 | eyebrow → H1, H1 → divider, divider → text | `spacer-small` (1.5rem) |
| 36 | padding carduri Deposit | 2.25rem |
| 32 / 32.95 / 32.66 | gap carduri (Deposit, Special, Destinații) | 2rem |
| ≈ 37 | gap vertical carduri Special | 2rem (egal cu gap-ul orizontal) |
| 64 | gap coloane header Deposit | 4rem |

**Radius:** chip ≈ 4 px → `Radius/Medium` (0.25rem); carduri / wrapper tabel ≈ 2 px → `Radius/Small`. Nimic nou.

---

## 5. Propunere de structură Client-First (clase)

```
main.main-wrapper
├─ section.section_pjc-search  (relative)                          [NOU]
│  ├─ div.pjc-search_background-image-wrapper > img.image-cover + div.pjc-search_overlay   [NOU]
│  └─ padding-global > container-large > padding-section-medium
│     └─ div.quote-search_component                                 [NOU, partajat]
│        ├─ div.quote-search_tabs[role=tablist] › button.quote-search_tab(.is-active) × 3
│        └─ form.quote-search_form
│           ├─ div.quote-search_field (From)  ├─ button.quote-search_swap  ├─ div.quote-search_field (To)
│           ├─ div.quote-search_field.is-wide (Departure date & time)  ├─ div.quote-search_field (pasageri)
│           └─ button.button (.quote-search_submit) "Request quote"
│        (sau HtmlEmbed cu widget-ul existent — decizie Stage 03)
│
├─ section.section_pjc-hero > padding-global > container-large > padding-section-medium
│  └─ div.pjc-hero_component                                        [NOU] grid 1fr 1fr, gap 3rem, align start
│     ├─ div.pjc-hero_content
│     │  ├─ tagline_component › tagline_line + tagline_text          [refolosit]
│     │  ├─ spacer-small › h1 (<em>with LunaJets</em>) › spacer-small
│     │  ├─ div.pjc-hero_divider                                     [NOU]
│     │  ├─ spacer-small › p › spacer-xsmall › p
│     └─ div.pjc-hero_image-wrapper > img.image-cover               [NOU] aspect 7/5, eager
│
├─ section.section_pjc-comparison > … padding-section-medium
│  ├─ [Section header] max-width-xlarge › tagline › spacer-custom1 › h2 (<em>) › spacer-small › p
│  ├─ spacer-large
│  └─ div.comparison_component                                      [NOU, partajat]
│     ├─ table.comparison_table (caption.sr-only)
│     │  ├─ thead › tr.comparison_row › th(td) gol + th.comparison_head-cell.is-highlight (logo) + th.comparison_head-cell × 2
│     │  └─ tbody › tr.comparison_row × 11 › th.comparison_label-cell[scope=row] + td.comparison_cell.is-highlight › span.comparison_chip + td.comparison_cell × 2
│     └─ div.comparison_legend (doar ≤767)                            [NOU]
│
├─ section.section_pjc-booking > … padding-section-medium
│  ├─ div.pjc-booking_header                                        [NOU] grid 2 col, align end
│  │  ├─ div › tagline › spacer-custom1 › h2 (<em>)
│  │  └─ p
│  ├─ spacer-xlarge
│  └─ ul.booking_list › li.booking_card × 3                           [NOU]
│        › div.booking_card-icon (SVG) + h3.heading-style-h3 + p
│
├─ section.section_pjc-special > … padding-section-medium
│  ├─ [Section header]
│  ├─ spacer-xlarge
│  └─ ul.charter-type_list › li.charter-type_card × 8                [NOU, partajat]
│        ├─ div.charter-type_card-image-wrapper > img.image-cover    (13/8)
│        └─ div.charter-type_card-content › h3.heading-style-h4 + p.charter-type_card-text
│              + div.charter-type_card-link-wrapper › a.button.is-link.is-icon (+ button_sr-text, button_icon)
│
└─ section.section_pjc-destinations > … padding-section-medium
   ├─ [Section header]
   ├─ spacer-xlarge
   └─ ul.destination_list › li.destination_card × 4                  [NOU, partajat]
         › a.destination_card-link › img.image-cover + div.destination_card-overlay
             + div.destination_card-content › h3.heading-style-h4 + div.destination_card-country
```

**Rezumat refolosire:**

| Categorie | Clase / pattern-uri |
|---|---|
| **Ca atare** | Navbar, Footer, Global Styles, `page-wrapper` / `main-wrapper`, `padding-global`, `container-large`, `padding-section-medium`, `tagline_*`, pattern Section header, `h1` / `h2` + `<em>`, `heading-style-h3`, `heading-style-h4`, `text-size-tiny`, `max-width-large` / `max-width-xlarge`, `button` / `is-link` / `is-icon` / `button_icon` / `button_sr-text`, `image-cover`, scala spacer (`spacer-xsmall`, `small`, `custom1`, `large`, `xlarge`) |
| **Variantă (combo)** | `comparison_head-cell is-highlight`, `comparison_cell is-highlight`, `quote-search_tab is-active`, `quote-search_field is-wide`. Niciun combo nou pe clase existente |
| **Nou** | `pjc-search_*` (background-image-wrapper, overlay), `quote-search_*` (component, tabs, tab, form, field, swap, submit), `pjc-hero_*` (component, content, divider, image-wrapper), `comparison_*` (component, table, row, head-cell, label-cell, cell, chip, logo, legend), `pjc-booking_header`, `booking_*` (list, card, card-icon), `charter-type_*` (list, card, card-image-wrapper, card-content, card-text, card-link-wrapper), `destination_*` (list, card, card-link, card-overlay, card-content, card-country) |
| **De discutat (generalizare)** | `pjc-hero_*` / `why-hero_*` / `about-hero_*` → un `hero-split_*` partajat; `group_card-text` / `tailored_card-text` / `charter-type_card-text` (aceleași valori 15/1.5) → un utilitar de text; overlay-urile foto (presă, destinații, hero căutare) |

**Responsive (propunere; lipsește din design, cu excepția tabelului):**
- ≤991: bloc H1 pe o coloană (text, apoi imaginea, 7/5); widget-ul de căutare pe 2 rânduri (From ⇄ To / dată + pasageri + buton); Deposit 3 → 1 coloană sau 3 carduri înguste (recomand 1 coloană, max 36rem); Special 4 → 2 coloane; Destinații 4 → 2 coloane; tabelul rămâne pe 4 coloane.
- ≤767: tabelul trece în layout-ul CHART MOBILE (rânduri-etichetă pe toată lățimea, 3 coloane de valori, legendă); widget-ul pe o coloană (câmpuri stivuite, swap rotit 90°, buton full width); header Deposit pe o coloană; Special 1 coloană (max ~28rem) sau 2 coloane înguste; Destinații 2 coloane.
- ≤479: Special și Destinații pe o coloană (sau slider orizontal pentru destinații, de decis); tabelul cu fonturile mobile (≈10–11 px; atenție la lizibilitate, minim recomandat 12 px).

---

## 6. Inconsecvențe și ambiguități

1. **Nicio valoare exactă din Figma** pentru această pagină (limita MCP). Tot ce ține de fonturi, culori și radius e ≈.
2. **Mobil doar pentru tabel.** Tablet lipsește complet. Restul paginii nu are versiune mobilă.
3. **Nume de layere copiate / înșelătoare:** hero-ul cu căutare se numește `section_deposit-hero`, trei secțiuni diferite se numesc `section_flying`, header-ele `_w-why_header`, conținutul H1 `about_us_content`, slotul hero „[IMG] **Family** on jet” (poza e un om de afaceri), un card de destinație „Curchevel” (typo), un container Courchevel conține încă „St Tropez 1”, containerele de destinație au layere numite „Saint-Tropez”. **Nu le folosi ca nume de clase.**
4. **Trei blocuri lipite și scalate:** tabelul (×1.0667), cardurile Special (×1.0298), destinațiile (×1.0207). Valorile fracționare trebuie normalizate (§2).
5. **Widget-ul de căutare:** separator făcut dintr-o instanță de input de **1 px**; câmpul date + pasageri e o singură instanță de 403 px care **se suprapune 24 px** peste buton; butonul are 110 px în metadata, dar ≈185 px în referință. Padding-ul panoului e asimetric (40 sus / 60 jos).
6. **Padding vertical 56** pe toate secțiunile (About/Why: 80). Header → conținut variază: 48 (tabel), 64 (Deposit, Special), **24** (Destinații).
7. **Cardurile Special depășesc containerul:** containerul are 976.3, cardurile ajung la 1012.7 ⇒ padding-ul real de jos al secțiunii e ≈ 20 px, nu 56.
8. **Înălțimi inegale** la cardurile Special (478–479 vs 454–456) și **titluri rupte artificial** pe 2 rânduri („Emergency / charter”, „Leisure / charter”, „Corporate / charter”, „Corporate / events”) din cauza casetelor de text fixe de 131–168 px. În Webflow vor încăpea pe un rând.
9. **Lățimi inegale la destinații** (308.6 / 308.3 / 282.6 / 282.6), cu grupuri decalate și tăiate.
10. **Icoane Deposit de mărimi diferite** (50 × 64, 60.5 × 52.5, 50 × 54.8), deci titlurile nu sunt aliniate între carduri (y 123.6 / 112.5 / 114.8).
11. **H2 „Special private jet charter” fără italic**, singurul de pe pagină (și de pe cele 3 pagini). Probabil omisiune: propun *`jet charter`* italic, de confirmat.
12. **Line-height ≈ 29 px (≈1.8)** pe paragrafe (bloc H1, lede, header Deposit), ca în Why `card-split`, față de 24 px în About. Probabil un stil de text intenționat, nedocumentat.
13. **Spacere care nu corespund** (bloc H1: spacer-20/24/32 poziționați peste alte elemente; distanțele reale sunt 25/25/25).
14. **Text mobil ≠ desktop** la lede-ul tabelului (versiune scurtată pe mobil). Titlul mobil are rupturi de rând hardcodate.
15. **Marginea mobilă:** textul la 19.33 px, tabelul la 14 px, nealiniate între ele și față de `padding-global` (20).
16. **Legenda „LunaJets / Other models”** există doar pe mobil; culorile pătrățelelor nu se pot citi (lipsă screenshot).
17. **Coloanele tabelului** au lățimi ușor diferite (302.5 / 300.6 / 290.0). Propun 30 % + 3 × ~23.3 %.
18. **Conținut de confirmat cu clientul:**
    - „**Whether you are flying private to Europe, Asia, or the United States.**” e o propoziție incompletă (bloc H1, P2);
    - eyebrow `ON DEMAND PRIVATE AVIATION` (fără cratimă; Why folosește „On-demand”);
    - eyebrow-ul `WAYS TO FLY` apare **de două ori pe această pagină** (tabel și Special) și încă de două ori pe Why;
    - `Last minute charter` (aici) vs `Last-minute flights` (Why);
    - tabel: `Depends on share` vs `Depending on share`; `Multi year` → `Multi-year`; sensul valorilor `Yes` (Peak/blackout days, Busy airport surcharges, Taxi time, Conversion rates) e ambiguu (Yes = se aplică taxa?); `Annual dues: None` la Membership vs `Full subscription` la Upfront fees;
    - `over 4,800` / `4,800+`: consistent cu About/Why.
19. **Licențe imagini:** `AdobeStock_292037389_**Preview**` (Ibiza) e o previzualizare Adobe Stock (cu watermark sau nelicențiată); poza cu jetul-ambulanță pare să poarte **livreaua Rega** (marcă terță); posibilă **duplicare** a pozei lounge FBO cu Why (`image 37`). De confirmat.
20. **Nicio stare desenată** (hover/focus/active) pentru tab-uri, câmpuri, carduri, linkuri „Learn more”, carduri de destinație; nicio stare activă pentru linkul din navbar; nicio stare de eroare/validare pentru formular.
21. **Accesibilitate de verificat la build:** text alb peste fotografii (destinații) — contrastul depinde de gradient; text gri deschis pe `#F7F8FA` în header-ul tabelului și etichete (≈ `Text Color/tertiary` `#979BA1` pe alb ⇒ ~2.8:1, **sub 4.5:1**). Recomand `Text Color/secondary` (`#6B7684`) pentru etichete.

---

## Anexă: ce nu a putut fi accesat

- **Limita MCP Figma (plan Starter)** era deja atinsă. În această sesiune: 1 apel reușit (`get_figma_skill`), apoi `get_design_context` pe `264:6395` a fost refuzat. **Nu s-au mai făcut apeluri Figma.** `get_design_context` pe `264:6774`, `get_screenshot` pe `264:6395` și `get_variable_defs` **nu au putut fi rulate**.
- Metadata (structură, ID-uri, geometrie, texte) provine din rezultatul salvat local al apelului `get_metadata` pe `264:5234` din sesiunea Why LunaJets (16:06), care include integral `264:6395` și `264:6774`.
- Capturile sunt decupaje locale din imaginea de referință `264:7690` (randare 4296 × 5000 din sesiunea About), la scara 0.7583, deci **neclare**: culorile eșantionate sunt aproximative. Pentru CHART MOBILE nu există nicio randare; wireframe-ul e reconstruit din metadata.
- SVG-urile (logo în tabel, 3 icoane Deposit, icoanele widget-ului) nu au fost descărcate.
- **De făcut când se resetează limita** (în ordinea priorității): `get_design_context` pe `264:6456` (tabel desktop), `264:6774` (tabel mobil), `264:6423` (widget), `264:6586` (Deposit), apoi `264:6625` / `264:6719`; `get_variable_defs` pe `264:6395`.
