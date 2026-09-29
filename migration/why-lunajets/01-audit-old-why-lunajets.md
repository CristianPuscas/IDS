# 01 — Audit pagina veche „Why LunaJets” (LunaJets)

> **Etapa:** 01, audit read-only al paginii existente, înainte de rebuild în Webflow (Finsweet Client-First).
> **Data auditului:** 2026-09-29
> **Pagina țintă:** https://www.lunajets.com/en/why-lunajets (HTTP 200, `x-wf-locale: en`, Cloudflare `cf-cache-status: HIT`)
> **Ultima publicare (comentariu HTML):** `Last Published: Tue Sep 29 2026 16:01:06 GMT+0000`
> **Webflow:** site ID `67c72c8a3c305a53672bdcca`, **page ID `68e90e131b1598e618c46968`** (`x-wf-page-id: aOkOExsVmOYYxGlo`). CSS publicat: `www-lunajets.shared.c15375a82.min.css` (hash nou față de auditul About, `348a00619`: site-ul a fost republicat între timp).
> **Surse folosite:** HTML brut (`curl`), CSS publicat, bundle-urile JS Webflow, sitemap.xml, cele 7 variante de limbă, DOM randat + screenshot-uri (Playwright/Chromium, cereri preluate prin Node cu CA bundle-ul proxy-ului).
> **Referință:** formatul și elementele globale urmează `../about/01-audit-old-about.md`. Navbar, footer, fonturi, GTM, CookieYes, code components, JSON-LD Organization/WebSite și „Our Offices” **nu sunt redocumentate**; mai jos apar doar diferențele.
> Textele verbatim sunt păstrate în engleză, între backticks sau în citate.

## Screenshot-uri (`/home/user/IDS/migration/why-lunajets/old-screenshots/`)

| Fișier | Conținut |
|---|---|
| `old-why-lunajets-1440-full.jpg` | Pagina completă, desktop 1440 (înălțime 6471px) |
| `old-why-lunajets-991-full.jpg` | Pagina completă, tabletă 991 (8016px) |
| `old-why-lunajets-390-full.jpg` | Pagina completă, mobil 390 (10195px) |
| `old-why-lunajets-1440-hero.jpg` | Close-up hero (cu navbar) |
| `old-why-lunajets-1440-advantages.jpg` | Close-up grila „Advantages” (iconuri vizibile) |
| `old-why-lunajets-1440-needs.jpg` | Close-up „Tailored for all your needs” |
| `old-why-lunajets-1440-crypto.jpg` | Close-up „Seamless payment” |
| `old-why-lunajets-1440-app-cta.jpg` | Close-up CTA aplicație mobilă |

Iconurile SVG inline din `<main>` au fost salvate (unice) în `/home/user/IDS/migration/why-lunajets/assets/old-icons/` (10 fișiere `.svg`).

> Note despre capturi (aceleași ca la About): bara sticky mobilă (`request_flight-sticky`) apare în mijlocul capturilor full-page la 991/390 (artefact `position: fixed`); nu apare banner CookieYes (host blocat); code components au rămas fără CSS-ul lor (butoanele „Request quotes” / „Request a quote” sunt afișate prin fallback-ul SSR din slot).

---

## 1. URL, canonical, hreflang, SEO

- **URL:** `https://www.lunajets.com/en/why-lunajets`
- **Canonical:** `<link href="https://www.lunajets.com/en/why-lunajets" rel="canonical"/>` ✅ self-referencing
- **`<html lang="en">`**; `.page-wrapper` **fără id** (About avea `#pt-aboutus`).

### 1.1 hreflang (toate 8 + x-default; toate verificate HTTP 200)

| hreflang | URL | H1 localizat |
|---|---|---|
| `x-default` | https://www.lunajets.com/en/why-lunajets | — |
| `en` | https://www.lunajets.com/en/why-lunajets | `Why LunaJets` |
| `fr` | https://www.lunajets.com/fr/pourquoi-lunajets | `Pourquoi Choisir LunaJets` |
| `de` | https://www.lunajets.com/de/warum-lunajets | `Warum LunaJets` |
| `it` | https://www.lunajets.com/it/perche-lunajets | `Perché scegliere LunaJets` |
| `es` | https://www.lunajets.com/es/porque-lunajets | `¿Por qué LunaJets?` |
| `ru` | https://www.lunajets.com/ru/pochemu | `Почему LunaJets` |
| `hu` | https://www.lunajets.com/hu/miert-lunajets | `Miért a LunaJets` |
| `pl` | https://www.lunajets.com/pl/dlaczego-lunajets | `Dlaczego LunaJets` |

- Slug-uri localizate (atenție: `ru/pochemu` fără „lunajets”; `es/porque-lunajets` fără accent/spațiu). De păstrat identic sau 8 × 301.
- Toate cele 7 variante non-EN au **aceleași 7 secțiuni** (`hero_bg-image-section` … `cta-request_section`), 8 imagini în main și aceleași 4 pastile crypto.

### 1.2 Meta

| Element | Valoare (verbatim) |
|---|---|
| `<title>` | `Why Choosing LunaJets for Your Next Private Flight` (50 car.; ⚠️ gramatical: „Why Choose…”) |
| `meta description` | `We offer a smarter way to fly private with on-demand charters, all-inclusive fixed pricing, and no upfront fees, backed by our 24/7 advisory team.` (146 car.) |
| `og:title` / `twitter:title` | identice cu title |
| `og:description` / `twitter:description` | identice cu meta description |
| `og:image` | `https://cdn.prod.website-files.com/67c72c8a3c305a53672bdcca/699db094114ae48855010706_why-choosing-lunajets-for-your-next-private-flight.png` (PNG dedicat) |
| `og:type` | `website` |
| `og:url` | **lipsește** (ca pe About) |
| `twitter:card` | `summary_large_image`; `twitter:image` **lipsește** (pe About exista); `twitter:site` lipsește |
| `meta robots` | absent (implicit index,follow) |
| `google-site-verification`, favicon, apple-touch-icon | identice cu About |

- `<head>`-ul (scripturi, stiluri, preload fonturi, preconnect) este **identic byte cu byte** cu cel de pe About (Consent Mode, GTM-TRDGMCLS, CookieYes sincron, Finsweet Attributes v2, Finsweet Components, `.grecaptcha-badge` ascuns, `longtext` noscript, `min-height` pentru `request_component-dynamic` în hero).
- Pagina e în sitemap (`<loc>https://www.lunajets.com/en/why-lunajets</loc>`).

### 1.3 JSON-LD (9 blocuri, toate în `<body>`)

1–7. **`LocalBusiness`** × 7 din lista CMS „Our Offices” din footer (identic About).
8. **`@graph` Organization + WebSite**: **identic byte cu byte** cu About (vezi About §2.1).
9. **`WebPage`** (din `.schema.w-dyn-list` după footer; pe About era `AboutPage`):

```json
{"@type":"WebPage","@id":"https://www.lunajets.com/en/why-lunajets#webpage",
 "url":"https://www.lunajets.com/en/why-lunajets",
 "name":"Why Choosing LunaJets for Your Next Private Flight",
 "description":"We offer a smarter way to fly private with on-demand charters, all-inclusive fixed pricing, and no upfront fees, backed by our 24/7 advisory team.",
 "speakable":{"@type":"SpeakableSpecification","cssSelector":[".speakable"]},
 "inLanguage":"en","isPartOf":{"@id":"https://www.lunajets.com/#website"}}
```

- Fără `about → #organization` (About îl avea), fără `BreadcrumbList`, fără `primaryImageOfPage`. Aici nu există problema cu `&#39;` dublu-escape-uit.
- `.speakable` țintește 2 paragrafe (intro „Tailored…” și paragraful crypto); `speakable-2` (pe 2 wrapper-e) nu e referit.

### 1.4 Outline headings (ordinea DOM)

```
H1  Why LunaJets                                        (h1.heading-style-h1)
H2  Flexible / Flight solutions                         (<br>, „Flight solutions” în <em>)
  H3  On-Demand Private Jet Charter
  H3  Frequent Charter Program
H2  The Advantages of Flying Through Us                 („Flying Through Us” în <em>)
  H3  Access to top operators’ fleet
  H3  App and loyalty program
  H3  Empty legs and last minute flights
  H3  Best market rates
  H3  Most flexible cancellation terms
  H3  All Inclusive rates
H2  Tailored for / All Your needs                       (<em><br>All Your needs</em>)
  H3  Pet-Friendly Travels                              (H3 în interiorul <a>)
  H3  Last-Minute Flights                               (H3 în interiorul <a>)
  H3  Medical Evacuation & Air Ambulance                (H3 în interiorul <a>)
  H3  The Unusual Ones Are Our Specialty                (nelinkat)
H2  Transparency at the Best Price                      („the Best Price” în <em>)
H2  Seamless payment / ‍incl. cryptocurrencies           (U+200D zero-width joiner după <br>!)
H2  The private jet charter app you need
--- footer (identic About) ---
H2  Our Offices  +  8 × H3 (7 orașe + Contact us)
```

- Un singur H1 ✅. Fără H4–H6. Hero stats sunt `<p>`, nu headings ✅.
- `h2 { text-transform: capitalize }` global ⇒ pe ecran: „The Advantages Of Flying Through Us”, „Tailored For All Your Needs”, „Transparency At The Best Price”, „Seamless Payment Incl. Cryptocurrencies”, „The Private Jet Charter App You Need”.
- ⚠️ **Inconsistență între limbi:** în EN cele 2 carduri „Two ways to fly” sunt **H3**, în toate cele 7 limbi non-EN sunt **H2** (cu clasa `heading-style-h3`). EN are 6 H2/12 H3 în main, celelalte 8 H2/10 H3.

---

## 2. Secțiuni (în ordinea paginii)

### Structură generală și evaluare Client-First

```
body
├─ .w-embed (global styles, identic About)
├─ .page-wrapper
│  ├─ header.navbar2_component                     (identic About; „Why LunaJets” = w--current)
│  ├─ main.main-wrapper#main
│  │  ├─ section.hero_bg-image-section             → 2.1 Hero (fundal foto + 3 „why” stats)
│  │  ├─ section._w-fly_section                    → 2.2 Two ways to fly (2 carduri)
│  │  ├─ section._w-fly_advantages_section         → 2.3 Advantages (grilă 6, navy)
│  │  ├─ section._w-fly_needs_section              → 2.4 Tailored for all your needs (4 carduri foto)
│  │  ├─ section._w-transparency_section           → 2.5 Pricing promise (split text/imagine)
│  │  ├─ section._w-crypto_section                 → 2.6 Payment options (split imagine/text)
│  │  └─ section.cta-request_section               → 2.7 Mobile app CTA (gradient)
│  └─ footer.footer_u#footer                       (identic About, inclusiv „Our Offices” CMS)
├─ .w-dyn-list (JSON-LD Organization)  ├─ .schema.w-dyn-list (JSON-LD WebPage)
└─ .request_component-dynamic + .request_flight-sticky (identic About)
```

**Verdict Client-First: parțial / hibrid (mai slab decât About).**
- ✅ Folosește `padding-global`, `padding-section-medium`, `container-medium` (80rem, non-standard, ca pe About), `spacer-*`, `heading-style-h1..h3`, `max-width-*`, `button is-*`, `tag is-text is-icon`, `icon-embed-*`, `text-color-white`, `text-align-center`.
- ❌ Abateri specifice paginii:
  - Secțiuni cu prefix **`_w-`** (`_w-fly_section`, `_w-fly_advantages_section`, `_w-transparency_section`, `_w-crypto_section`): underscore la început și nu `section_[nume]`. Probabil redenumite din `w-…` (prefix rezervat Webflow).
  - Separator inconsistent: `_w-fly_needs_section` vs `_w-fly-needs_grid` / `_w-fly-needs_item` / `_w-fly-needs_image`.
  - `_w-fly_needs_section` reutilizează `_w-fly_advantages_component` ca wrapper (clasă din altă secțiune).
  - Clasele de secțiune `_w-fly_section`, `_w-fly_needs_section`, `_w-transparency_section`, `_w-crypto_section`, `hero_bg-image-component`, `hero_stats-wrapper` **nu au niciun stil în CSS** (sunt doar etichete).
  - `transparency-content_image` e folosit și în secțiunea crypto.
  - Utilitare cu px în nume și valori care nu corespund: `max-width-400px` = **28rem (448px)**, `max-width-432px` = 27rem, `max-width-384px`, `max-width-364px`, `max-width-640px`; `spacer-1-5rem` folosit și ca **combo pe `<p>` și pe grid** (`speakable spacer-1-5rem`, `_w-fly-needs_grid spacer-1-5rem`), adică spacer ca padding-top pe conținut.
  - Combo-uri fără `is-`: `hero`, `left-align`, `why_item`, `tiny-no_italic`, `white-full`, `dark-blue`, `margin-top_auto`, `max-width-full-tablet`, `under`, `centered`, `mobile_full`, `flex-column`, `flex-v-center`, `background-lj-cream`.
  - Typo reutilizat: `donwload_button` (pe `<img>` și pe `<a>`).
  - `w-node-*` (grid overrides per element): `#w-node-ee6a5e91-…-18c46968` (item advantages 2), `#w-node-e099df7c-…` și `#w-node-_33a4c6ca-…` (imaginile split, `align-self:center`).

---

### 2.1 Hero — `section.hero_bg-image-section`

- **Scop:** H1 + propunerea de valoare, CTA de cerere ofertă, 3 argumente cheie peste o fotografie full-bleed.
- **Wrapper-e:** `padding-global padding-section-medium hero` › `container-medium` › `hero_bg-image-component` › `max-width-640px` › `dp_hero-content left-align`; apoi `spacer-xxlarge` › `hero_stats-wrapper` › `divider white-full` › `spacer-xlarge` › `hero-stats_wrapper` (grid 3 col; 2 col ≤991; 1 col ≤479) › 3 × `stats_item why_item`. Fundal: `bg_image-wrapper` (absolute, z-index -1) › `img.image-cover_absolute` + `blue_image-overlay dark-blue` (opacity .85, `linear-gradient(60deg,#020c18 35%,#061d38 85%,#0c2847)`). Text alb. Înălțime randată: 802px (1440), 888 (991), 1035 (390).
- **Text:**
  - Eyebrow (`tag is-text is-icon is-alternate` + `tag-line`): `Trusted by clients around the globe`
  - H1: `Why LunaJets`
  - P: `Private aviation has a reputation for complexity and hidden costs. At LunaJets, we believe it doesn't have to be that way. Headquartered in Geneva and guided by Swiss values of precision and discretion, we work exclusively in your interest, with no fleet to sell and no operator to favour, sourcing the right aircraft, at the right price, from first quote to final invoice.`
- **CTA:** `Request a quote` → **code component** `InquireButton` (`lunajets-library`, variant `unstyled`, props `from:""`, `to:""`), slot `div.button is-secondary is-icon` + săgeată SVG. Fără href; deschide formularul React. ⚠️ Fără atribut PostHog `data-ph-capture-attribute-cta_request_flight` (navbar-ul îl are).
- **Stats „why”** (număr = `p.stats_number tiny-no_italic text-color-white`, Vanitas 1.375rem; eticheta = `p.tag is-text`, Gilroy 12px uppercase; icon `icon-1x1-large w-embed` 2.5rem, SVG 44×44):

| Icon (SVG inline) | Titlu | Descriere (verbatim) |
|---|---|---|
| cerc cu bifă (`01-check-circle.svg`) | `No Commitment` | `No long-term contracts, and no minimum flying time.` |
| săgeată lungă dreapta (`02-arrow-long-right.svg`) | `Curated Selection of Aircraft` | `Tailored to your route and passenger needs.` |
| ceas (`03-clock.svg`) ⚠️ semantică slabă | `No Hidden Costs` | `Which includes crew, catering, airport handling, taxi time, etc.` |

- **Imagine:** `https://cdn.prod.website-files.com/67c72c8a3c305a53672bdcca/6a22a816d47c127315d8eab7_private-jet-tail.webp` (original 4096×2731, servit `-p-1600` la 1440), alt `Black and white photo of the underside of a private jet showing two engine exhausts and tail`, `loading="eager"`, `sizes="(max-width: 4096px) 100vw, 4096px"`. Rol: fundal decorativ (alt-ul descriptiv e acceptabil, dar ar putea fi `alt=""`).
- Divider doar **deasupra** statisticilor (pe About: sus și jos).

### 2.2 Two ways to fly — `section._w-fly_section`

- **Scop:** cele două modele comerciale (on-demand vs. program cu avans).
- **Wrapper-e:** `padding-global padding-section-medium` › `container-medium` › `_w-fly_component` (flex column) › header › `_w-fly_grid` (grid 2 col, gap 2rem; 1 col ≤767) › 2 × `_w-fly_content` (border 1px `--stroke`, radius 2px, padding 2.5rem / 2rem ≤991 / 1.25rem ≤767, flex column gap 1.5rem) › H3 + P + `button-group margin-top_auto` (CTA aliniat jos).
- **Text:**
  - Eyebrow (`tag-line is-blue`): `Two ways to fly`
  - H2 (`max-width-400px max-width-full-tablet`): `Flexible` `<br>` `<em>Flight solutions</em>`
- **Carduri:**

| H3 | Paragraf (verbatim) | CTA (label → href) |
|---|---|---|
| `On-Demand Private Jet Charter` | `No contracts, no commitments, no compromise. On demand charter is the purest form of private flying: you choose when, where and how you fly, and we find the best aircraft for each trip. Ideal if your schedule is unpredictable or your destinations change, we handle every detail, every time.` | `Discover On-Demand Charter` → `/en/private-jet-charter` |
| `Frequent Charter Program` | `A 100% refundable advance payment designed for frequent flyers and corporate clients. Each trip is drawn against it as you fly, streamlining confirmations and simplifying the administration of recurring travel.` | `Discover the Frequent Charter Program` → `/en/frequent-charter-program` |

- CTA-uri: `a.button is-link is-icon` (text uppercase + săgeată `00-arrow-right.svg`, identică cu cea de pe About). Imagini: niciuna.
- Notă text: `On demand charter` (fără cratimă) vs `On-Demand` în H3.

### 2.3 The Advantages of Flying Through Us — `section._w-fly_advantages_section`

- **Scop:** 6 beneficii ale brokerajului LunaJets.
- **Fundal:** `--lj-blue` (#061d38) plin (nu gradient). Text alb.
- **Wrapper-e:** `padding-global padding-section-medium` › `container-medium` › `_w-fly_advantages_component` › header › `_w-fly_advantages_grid` (grid 3 col, gap 1px pe fundal `#ffffff3d` + padding 1px ⇒ efect de linii de grilă; 2 col ≤991; 1 col ≤479) › 6 × `_w-fly_advantages_item` (fundal `#071b32`, padding 2rem, flex column; ≤479 devine rând icon+titlu, min-height 90px) › `fly_advantages-icon_wrapper` (2rem) › `icon-embed-white w-embed` (culoare `#efebe7`) + `h3.heading-style-h3.text-color-white` (Vanitas 2rem).
- **Text:**
  - Eyebrow (`tag is-text is-icon is-alternate`): `Smart Flying`
  - H2 (`heading-style-h2 text-color-white`, `max-width-400px`): `The Advantages of` `<em>Flying Through Us</em>`
- **Item-uri:**

| # | H3 (verbatim) | Icon SVG (viewBox) | Fișier |
|---|---|---|---|
| 1 | `Access to top operators’ fleet` | telefon (0 0 20 20, `currentColor`) ⚠️ semantică | `06-phone.svg` |
| 2 | `App and loyalty program` | smartphone (0 0 33 33, `fill="white"` hardcodat) | `07-smartphone.svg` |
| 3 | `Empty legs and last minute flights` | săgeată în jos + bifă (0 0 32 32, stroke `#F4F2EF`) | `08-empty-leg-arrow-check.svg` |
| 4 | `Best market rates` | trend descendent (0 0 36 36, fill `#F6F6F6`) | `09-trend-down.svg` |
| 5 | `Most flexible cancellation terms` | săgeți ramificate (0 0 35 36, `fill="white"`) | `10-split-arrows.svg` |
| 6 | `All Inclusive rates` | card bancar (0 0 33 33, fill `#FAFAFA`) | `11-credit-card.svg` |

- Iconurile au viewBox-uri și culori inconsistente (doar #1 folosește `currentColor`; restul au alb/gri hardcodat) ⇒ de normalizat la rebuild.
- Fără descrieri sub titluri, fără CTA, fără imagini.

### 2.4 Tailored for All Your needs — `section._w-fly_needs_section`

- **Scop:** cazuri de utilizare speciale, cu linkuri spre paginile de servicii.
- **Wrapper-e:** `padding-global padding-section-medium` › `container-medium` › `_w-fly_advantages_component` (!) › header + P › `_w-fly-needs_grid spacer-1-5rem` (grid 4 col, gap 1.5rem; 2 col ≤991; 1 col ≤767) › 4 × `_w-fly-needs_item` (flex column, gap 1.5rem) › `_w-fly-needs_image` (min-height 21.25rem = 340px, `img.image-cover_absolute`) + `a.link_no-underline.under` › H3 + P.
- **Card-link:** atributele `data-lj_card_linked` (pe item) + `data-lj_card_link` (pe `<a>`) activează scriptul global din footer care face tot cardul clickabil (documentat pe About §6, acolo „neaplicat” — **aici e folosit**). Linkul semantic înconjoară doar H3-ul; underline la hover (`under`).
- **Text:**
  - Eyebrow (`tag-line is-blue`): `Bespoke private flights`
  - H2 (`max-width-384px`): `Tailored for` `<em><br>All Your needs</em>`
  - P (`.speakable`): `With 20 years of experience and an extended network through LunaGroup Charter, we handle the flights that others can't. Whatever the complexity, the route, or the timeline, our team has seen it before.`
- **Carduri:**

| # | Imagine (src / alt / dim.) | H3 | Paragraf (verbatim) | Link |
|---|---|---|---|---|
| 1 | `…/6a22ce5389c16ec226a2f94c_pet-friendly-private-flights.webp` / `Luxurious private jet cabin with white leather seats and a pet bed on the carpeted floor` / 400×400 | `Pet-Friendly Travels` | `We know how important it is to bring your loved ones with you. We offer the most personalised, pet-friendly private flights.` | `/en/insights/flying-with-pets-on-a-private-jet` |
| 2 | `…/6a22cdfdad4e1960009e5277_last-minute-jet-charter.webp` / `Man in white shirt and black pants stepping onto private jet parked on airport tarmac` / 600×600 | `Last-Minute Flights` | `For those who need to travel at short notice, whether you are facing a business emergency, planning a last-minute getaway, or require an urgent evacuation.` | `/en/private-jet-services/last-minute-flights` |
| 3 | `…/6a22a463e3e9bc85d7d1ef2a_medical-evacuation-air-ambulance-charter-flight.webp` / `Medical airplane with open door and stairs alongside an ambulance on an airport runway.` / 400×400 (în plus un `div.image-wrapper`, fără `sizes`) | `Medical Evacuation & Air Ambulance` | `We coordinate emergency flights, including bed-to-bed transportation, repatriations, and the urgent delivery of vital supplies.` | `/en/private-jet-services/emergency-charter` |
| 4 | **fără imagine**: `_w-fly-needs_image background-lj-cream` cu `center-wrapper flex-v-center padding-medium` și buton | `The Unusual Ones Are Our Specialty` (nelinkat) | `Every week we handle requests that don't fit a category. Unusual airstrips, diplomatic sensitivities, cargo + passengers combined, multi-continent routing. If it involves a private aircraft, we've seen it before.` | buton `Other examples of charter solutions` (`button is-link is-icon flex-column`, săgeată) → `/en/private-jet-charter#special-private-jet-charter` ⚠️ **ancora nu există** pe pagina țintă (secțiunea e `section.section_special-jet`, fără id) |

- Toate imaginile `loading="lazy"`, webp, randate 302×340 (crop cover). Cardul 4 are `data-lj_card_linked` pe caseta crem, nu pe item.

### 2.5 Pricing promise — `section._w-transparency_section`

- **Scop:** promisiunea de preț transparent, link spre pagina de prețuri.
- **Wrapper-e:** `padding-global padding-section-medium` › `container-medium` › **`split-content_component centered`** (grid 2 col, identic cu About) › `split-content_content_left` (text stânga) + `transparency-content_image` (imagine dreapta; border 1px `--stroke`, min-height 35rem / 27rem ≤991 / 21.25rem ≤767; pe ≤991 `order: 9999` ⇒ imaginea **sub** text, invers față de hero-ul About `tablet-first`).
- **Text:**
  - Eyebrow: `Pricing promise`
  - H2 (`max-width-364px`): `Transparency at` `<em>the Best Price</em>`
  - P (în `p-wrapper speakable-2`): `Our quotes are transparent, with no upfront costs or hidden fees. Everything is included, from landing fees and taxi charges to fuel surcharges.`
- **CTA:** `See Full Pricing Details` → `/en/prices` (`button is-tertiary is-stroke is-icon mobile_full`, identic cu CTA-urile split de pe About).
- **Imagine:** `…/6a22a564294d92b4554d4b10_lunajets-geneva-office-sales-floor.webp`, alt `sales floor at LunaJets geneva headquarters offices` (minusculă la „sales”/„geneva”), 600×600, lazy. Rol: foto echipă/birou.

### 2.6 Payment options — `section._w-crypto_section`

- **Scop:** metode de plată, inclusiv crypto.
- **Wrapper-e:** `split-content_component centered` cu **imaginea stânga** (`transparency-content_image`, id `w-node-_33a4c6ca-…`) și textul dreapta (`split-content_content_left`, deși e în dreapta). Pe ≤991 imaginea trece sub text.
- **Text:**
  - Eyebrow: `Payment options`
  - H2 (`max-width-432px`): `Seamless payment` `<br>` `‍` (U+200D) `<em>incl. cryptocurrencies</em>`
  - P (`.speakable` în `p-wrapper speakable-2`): `At LunaJets, we make payment effortless and flexible to accommodate all of our clients, especially in urgent situations. You can settle your flights online or offline using all major credit and debit cards, as well as bank transfers. We also accept cryptocurrency for all our services, whether you are chartering a private jet or helicopter, funding your Frequent Charter Program, or purchasing an aircraft through LunaSolutions.`
  - Pastile (`crypto_items-wrapper` flex, gap .625rem › 4 × `crypto_item`: border 1px `--stroke`, radius 999px, padding .5rem 1rem): `BTC` · `ETH` · `USDT` · `USDC`
- **CTA:** `See Crypto Payment Options` → `/en/why-lunajets/private-jet-hire-cost/pay-with-cryptocurrency` (HTTP 200; notă: părintele `/en/why-lunajets/private-jet-hire-cost` face 301 → `/en/prices`).
- **Imagine:** `…/69204c90ee59b4bdfcd0052b_1526c94e96f0117bb54dee1a8b9b12d7_crypto.webp` (1514×960), alt `Cryptocurrency price list showing Bitcoin, Ethereum, XRP, and Bitcoin Cash with positive percentage changes in green`, lazy. Rol: ilustrație stock. ⚠️ Imaginea arată XRP și Bitcoin Cash, care nu sunt în lista de monede acceptate (BTC/ETH/USDT/USDC).

### 2.7 Mobile app CTA — `section.cta-request_section`

- **Scop:** promovarea aplicației mobile.
- **Fundal:** `linear-gradient(150deg,#020c18,#061d38 28%,#0c2847 66%)` (**același gradient ca `section_about_us_services` de pe About**), text alb. Clasa are și o variantă de componentă (`w-variant-2b4bdb5f-…`: fundal transparent, text navy) ⇒ `cta-request_section` e o **componentă Webflow reutilizabilă** cu variantă, folosită probabil și pe alte pagini.
- **Wrapper-e:** `padding-global padding-section-medium` › `container-medium` › `cta-request_component text-align-center` (flex column, centrat) › eyebrow › `max-width-432px` › H2 › `spacer-medium` › `button-group` cu 2 badge-uri.
- **Text:**
  - Eyebrow (`tag is-text is-icon`, **fără `tag-line`**): `The mobile app`
  - H2: `The private jet charter app you need`
- **CTA-uri (imagini-link, `target="_blank"`, fără `rel`):**
  - App Store: `…/6945959903e5e83cc08163bb_Group%205841.svg`, alt `Download mobile app on the App Store` → `https://apps.apple.com/gb/app/private-jets-charter-lunajets/id462220739`
  - Google Play: `…/6945959909c08ed5f30226bf_Group%205842.svg`, alt `Download mobile app from Google Play for Android` (footer-ul folosește `…on Google Play`) → `https://play.google.com/store/apps/details?id=com.abonobo.lunajets`
  - Ambele `img.donwload_button` (150×50; SVG intrinsec 91×31). La App Store clasa e pe `<img>`, la Google Play pe `<a>` și pe `<img>` (inconsistent).
- Aceleași badge-uri apar din nou în footer, la ~300px distanță (duplicare vizuală).

### 2.8 Footer + „Our Offices”

Identic cu About (§4.2 acolo); singura diferență: linkurile selectorului de limbă indică slug-urile Why LunaJets.

---

## 3. Sub-pagini și linkuri interne

### 3.1 Sub-paginile `/en/why-lunajets/*` (sitemap + navbar)

| URL | Status | Legat din conținutul paginii? | Legat din navbar? |
|---|---|---|---|
| `/en/why-lunajets/our-history` | 200 | ❌ | ✅ `Our history` |
| `/en/why-lunajets/our-locations` | 200 | ❌ | ✅ `Our offices` |
| `/en/why-lunajets/our-team` | 200 | ❌ | ✅ `Our Team` |
| `/en/why-lunajets/global-management` | 200 | ❌ | ✅ `Global Management` |
| `/en/why-lunajets/testimonials` | 200 | ❌ | ✅ `Client testimonials` |
| `/en/why-lunajets/jet-comparator` | 200 | ❌ | ✅ `Jet comparator` (meniul Aircraft) |
| `/en/why-lunajets/private-jet-hire-cost/pay-with-cryptocurrency` | 200 | ✅ CTA crypto | ❌ |
| `/en/why-lunajets/lunajets-one-of-the-best-employer-in-switzerland` | 200 | ❌ | ❌ (doar în sitemap, pagină orfană pe această rută) |
| `/en/why-lunajets/private-jet-hire-cost` | 301 → `/en/prices` | — | — |

> **Pagina „hub” Why LunaJets nu leagă din conținut nicio sub-pagină „company”** (history, team, management, locations, testimonials, comparator). Legătura există doar prin mega-meniu și prin „Our Offices” din footer. În arhitectura URL, `/en/about-us` nu e sub `/why-lunajets/`, deși sub-paginile „company” sunt.

### 3.2 Toate linkurile din `<main>`

| Secțiune | Anchor | href | Status |
|---|---|---|---|
| Hero | `Request a quote` | — (code component, fără href) | — |
| Two ways | `Discover On-Demand Charter` | `/en/private-jet-charter` | 200 |
| Two ways | `Discover the Frequent Charter Program` | `/en/frequent-charter-program` | 200 |
| Needs | `Pet-Friendly Travels` (H3) | `/en/insights/flying-with-pets-on-a-private-jet` | 200 |
| Needs | `Last-Minute Flights` (H3) | `/en/private-jet-services/last-minute-flights` | 200 |
| Needs | `Medical Evacuation & Air Ambulance` (H3) | `/en/private-jet-services/emergency-charter` | 200 |
| Needs | `Other examples of charter solutions` | `/en/private-jet-charter#special-private-jet-charter` | 200, **ancoră inexistentă** ⚠️ |
| Pricing | `See Full Pricing Details` | `/en/prices` | 200 |
| Payment | `See Crypto Payment Options` | `/en/why-lunajets/private-jet-hire-cost/pay-with-cryptocurrency` | 200 |
| App | App Store badge | `https://apps.apple.com/gb/app/private-jets-charter-lunajets/id462220739` | extern |
| App | Google Play badge | `https://play.google.com/store/apps/details?id=com.abonobo.lunajets` | extern |

Navbar și footer: identice cu About (≈60 linkuri în navbar, 7 orașe + contact + legal în footer). Niciun link `href="#"` în main ✅.

---

## 4. Formulare, interacțiuni, CMS, custom code

### 4.1 Formulare
- **Niciun `<form>` / `w-form` în main.** Singurul punct de conversie din conținut e code component-ul `InquireButton` din hero (deschide formularul React de request flight, neinspectat). Restul (newsletter footer, request quotes navbar/sticky, component ascuns cu `data-ssr-error="true"`) sunt identice cu About.

### 4.2 Interacțiuni / animații
- **Niciun `data-w-id` în `<main>`.** Singurele `data-w-id` sunt cele globale (mega-meniu, dropdown-uri, carduri „Our Offices”), identice cu About.
- **Config IX2 verificată** (pe About nu fusese): JSON-ul IX2 al site-ului se află în `www-lunajets.schunk.3580ad529cd355f6.js` (703KB) și **nu conține niciun eveniment legat de page ID-ul `68e90e131b1598e618c46968`**. Bundle-ul specific paginii (`www-lunajets.481cd81c.63100be92ef9c076.js`, 1.9KB) e doar loader-ul rspack. ⇒ Fără scroll-reveal, counter, parallax sau hover IX2 pe secțiunile paginii.
- **Nu există:** slider, tabs, marquee, Lottie, GSAP, video, counter animat (stats-urile hero sunt text, nu numere).
- Hover CSS: underline pe H3-urile cardurilor Needs (`link_no-underline.under:hover`) și pe `button.is-link.is-icon:hover`.
- JS global folosit efectiv aici: **card-uri clickabile `[data-lj_card_linked]` / `[data-lj_card_link]`** (secțiunea Needs), plus sticky bar, mega-meniu etc.

### 4.3 CMS
- **Nicio `w-dyn-list` în `<main>`**: tot conținutul paginii e static.
- CMS doar în zonele globale: „Our Offices” (Offices, 7 item-uri + JSON-LD LocalBusiness), `.w-dyn-list` (Organization/WebSite) și `.schema.w-dyn-list` (aici emite `WebPage` pentru această pagină, deci colecția „Schema/SEO” are câte un item per pagină sau un câmp de tip pagină).

### 4.4 Custom code specific paginii
- **Niciunul.** Embed-urile `<script>`/`<style>` din `<body>` sunt identice cu About, minus embed-ul CSS de presă (`.news-item:first-child`), care lipsește aici. Diferă doar fișierele JS Webflow (chunk-uri rspack per pagină).
- Integrări (GTM, Consent Mode, CookieYes, Finsweet Attributes/Components, code components, Intellimize, reCAPTCHA hidden, WhatsApp): identice cu About. Finsweet Attributes încărcat, **niciun atribut `fs-*`** pe pagină.

---

## 5. Note pentru migrare

### 5.1 Probleme găsite pe pagina veche

**SEO / conținut**
1. Title neidiomatic: `Why Choosing LunaJets…` ⇒ propunere `Why Choose LunaJets for Your Next Private Flight` (de confirmat cu clientul; og/twitter/JSON-LD derivă din el).
2. `og:url`, `twitter:image`, `twitter:site` lipsesc. JSON-LD `WebPage` fără `about`/`primaryImageOfPage`/`BreadcrumbList`.
3. **Ancoră ruptă:** `#special-private-jet-charter` nu există pe `/en/private-jet-charter` (de adăugat id pe `section_special-jet` sau de schimbat href-ul).
4. **Hub fără linkuri spre sub-pagini:** niciun link contextual spre our-history, our-team, global-management, our-locations, testimonials, jet-comparator, about-us. Pagina „best employer” e orfană. Oportunitate SEO clară la rebuild.
5. Heading-uri: H2 crypto conține **U+200D**; `text-transform: capitalize` global alterează textul (`Of`, `For`, `At`, `Incl.`); EN are H3 la cardurile „Two ways”, celelalte 7 limbi au H2 ⇒ de uniformizat (H3).
6. Inconsistențe de redactare: `On demand` vs `On-Demand`; `last minute flights` vs `Last-Minute Flights`; `All Inclusive rates` (majusculă) vs `all-inclusive` în meta; Title Case amestecat cu sentence case; `Request a quote` (hero) vs `Request quotes` (navbar).
7. `With 20 years of experience` (fondată dec. 2007 ⇒ ~19 ani în 2026; About spune „since 2007”): de confirmat sau de formulat „nearly 20 years”.
8. Imaginea crypto arată XRP / Bitcoin Cash, dar pagina acceptă BTC/ETH/USDT/USDC.
9. Badge-urile app se repetă în CTA și în footer, iar alt-ul Google Play diferă între ele.

**Accesibilitate**
10. Alt-uri foto bune și descriptive ✅; hero-ul are alt descriptiv deși e fundal decorativ (acceptabil, sau `alt=""`). `sales floor at LunaJets geneva…` cu minuscule.
11. Linkuri externe `target="_blank"` fără `rel="noopener"` și fără indicare „opens in new tab”.
12. Cardurile Needs: H3 în `<a>` + script de card-link ✅; cardul 4 are titlul nelinkat și linkul pe un buton din caseta crem (pattern diferit).
13. Iconuri semantic nepotrivite (telefon pentru „Access to top operators’ fleet”, ceas pentru „No Hidden Costs”); SVG-urile nu au `aria-hidden="true"` (decorative).
14. Contrast: eticheta stats hero (Gilroy 12px, uppercase) peste fotografie cu overlay .85, OK vizual; de verificat în QA.

**Performanță**
15. Imaginea hero e 4096×2731 la sursă (servită responsive `-p-1600` ✅, `eager` ✅). Restul lazy + webp ✅. Imaginea 3 din Needs fără `sizes`.
16. Aceleași probleme globale ca pe About (CookieYes sincron, Finsweet Attributes nefolosit, code components pentru butoane, fonturi preîncărcate inutil).

**Client-First / structură**
17. Prefix `_w-` pe secțiuni, clase-etichetă fără stiluri, `_w-fly_advantages_component` refolosit în altă secțiune, `transparency-content_image` refolosit la crypto, `split-content_content_left` folosit pentru coloana din dreapta, `max-width-400px` = 448px, spacer ca combo pe `<p>`/grid, `donwload_button`. Detalii în §2.

### 5.2 Blocuri care corespund pattern-urilor About (candidați de reutilizare)

Clasele noi sunt cele din `../about/04-build-log.md` (site-ul nou).

| Bloc Why LunaJets (vechi) | Echivalent pe About vechi | Clasă nouă de refolosit | Ce trebuie adăugat |
|---|---|---|---|
| Eyebrow-uri (`tag is-text is-icon` + `tag-line`, inclusiv varianta albă `is-alternate`) | identic | `tagline_component` / `tagline_line` / `tagline_text` | combo pentru varianta pe fundal închis (dacă nu există); variantă fără linie (CTA app) |
| Hero stats „why” (3 × icon + titlu + etichetă, divider sus) | `hero_stats-wrapper` / `stats_item` (4 cifre) | `stats_list` / `stats_*` | variantă cu icon (`is-icon`/`is-3col`), titlu text în loc de cifră |
| Hero cu fotografie full-bleed + overlay navy | — (About are hero split) | `section_about-hero` **nu** se potrivește | secțiune nouă `section_why-hero` (bg image + overlay); overlay-ul se poate alinia cu cel din `press_card` (navy 85%) |
| Pricing promise și Payment options (split text/imagine, imagine alternând stânga/dreapta, CTA outline cu săgeată) | `split-content_component centered` (folosit de 5 ori) | `split_component` (+ varianta cu imaginea în stânga), `split_lead` nu e necesar | combo pentru ordinea pe mobil (imaginea sub text pe Why vs deasupra pe About: de decis unitar) |
| CTA-uri `button is-tertiary is-stroke is-icon mobile_full` | identic | `button is-secondary is-icon` + `button_icon` | — |
| CTA-uri text `button is-link is-icon` (Two ways, Needs) | — | `button is-link is-icon` + `button_icon` (deja definit) | — |
| Grila Advantages (6 celule pe navy, icon + H3) | Services (5 carduri pe gradient, icon + H3) | `services_list` / `services_card` / `services_icon-embed` (currentColor) | variantă 3 coloane cu linii de grilă 1px; fundal navy plin vs gradient; iconurile de normalizat la `currentColor` |
| Two ways to fly (2 carduri bordate cu H3 + P + CTA jos) | Group (3 carduri bordate `div_group-intro`) | `group_list` / `group_card` (fără imagine) | variantă 2 coloane; CTA `margin-top: auto` |
| Tailored for all your needs (4 carduri: foto + H3 link + P, card clickabil) | Group cards (noi, cu foto 3:2) / Press cards | `group_card` (imagine + h3 + text + link) | 4 coloane; card 4 „fără imagine” pe crem cu buton; card-link fără JS (pseudo-element `::after` pe link) |
| Mobile app CTA (gradient, centrat, 2 badge-uri) | gradientul Services | gradientul `section_about-services` | dacă noul footer are deja badge-urile, de evaluat dacă secțiunea rămâne; pe site-ul vechi e componentă cu variantă (`cta-request_section`) |
| Pastile crypto (`crypto_item`) | — | — | clasă nouă mică (`pill`/`tag` rotunjit) |
| Navbar, Footer, Our Offices, JSON-LD Organization/WebSite, sticky bar mobil | identice | componentele globale `Navbar` / `Footer` deja construite | JSON-LD `WebPage` pentru această pagină |

### 5.3 Recomandări pentru rebuild (sumar)
- Păstrează cele 8 slug-uri localizate + canonical + hreflang; adaugă `og:url` și `twitter:image`.
- JSON-LD: `WebPage` (sau `AboutPage`/`CollectionPage` ca hub) cu `speakable`, `about → #organization`, `BreadcrumbList`.
- Repară ancora `#special-private-jet-charter`, elimină U+200D, uniformizează nivelurile heading-urilor (H3 pentru carduri) între limbi.
- Adaugă un bloc de linkuri contextuale spre sub-paginile „company” (history, team, management, locations, testimonials, about-us, careers).
- Normalizează iconurile (viewBox, `currentColor`, `aria-hidden`) și reconsideră iconurile nepotrivite semantic.
- De confirmat cu clientul: title-ul, „20 years”, imaginea crypto, păstrarea secțiunii app CTA (dublează footer-ul), label-ul CTA hero.

---

## Ce nu a putut fi accesat

| Resursă | Motiv / efect |
|---|---|
| Chromium direct spre site (TLS) | Browserul nu are CA-ul proxy-ului; randarea s-a făcut cu `page.route` + `route.fetch` (Node, `NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt`). TLS verificat, nimic dezactivat. |
| `cdn-cookieyes.com` | 403 (egress): banner cookie nerandat. |
| `d3e54v103j8qbb.cloudfront.net` (jQuery) | 403: runtime-ul Webflow (IX2, dropdown-uri) nu a rulat în browser; `Webflow.require('ix2')` indisponibil. Config IX2 verificată static în bundle (vezi §4.2). |
| `cdn.jsdelivr.net` (Finsweet Attributes, fs-components) | 403 |
| `www.googletagmanager.com` (GTM-TRDGMCLS) | 403: tag-urile din container neverificate. |
| `code-components.website-files.com` | abortat: CSS/JS code components (InquireButton, newsletter) neîncărcate; formularul de request flight neinspectat. |
| Webflow Designer / preview | Nefolosit (audit strict pe site-ul live, conform cerinței read-only). |
