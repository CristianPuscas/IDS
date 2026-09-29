# 01 — Audit pagina veche „Private Jet Charter” / On-demand charter (LunaJets)

> **Etapa:** 01, audit read-only al paginii existente, înainte de rebuild în Webflow (Finsweet Client-First).
> **Data auditului:** 2026-09-29
> **Pagina țintă:** https://www.lunajets.com/en/private-jet-charter (HTTP 200, `x-wf-locale: en`, Cloudflare `cf-cache-status: HIT`, `last-modified: Tue, 29 Sep 2026 16:16:33 GMT`)
> **Ultima publicare (comentariu HTML):** `Last Published: Tue Sep 29 2026 16:05:35 GMT+0000`
> **Webflow:** site ID `67c72c8a3c305a53672bdcca`, **page ID `687762d7ddee74eb6001e309`** (`x-wf-page-id: aHdi193udOtgAeMJ`). CSS publicat: `www-lunajets.shared.a5ae1c6a1.min.css` (hash nou față de Why LunaJets, `c15375a82`: site-ul a fost republicat între timp). Bundle-urile JS sunt aceleași ca pe Why LunaJets (`schunk.b36de0610a35aa79`, `schunk.3580ad529cd355f6`, `481cd81c.63100be92ef9c076`).
> **Surse folosite:** HTML brut (`curl`), CSS publicat, bundle-ul IX2, sitemap.xml, cele 7 variante de limbă, DOM randat + screenshot-uri (Playwright/Chromium, cereri preluate prin Node cu CA bundle-ul proxy-ului, TLS verificat).
> **Referință:** formatul și elementele globale urmează `../about/01-audit-old-about.md` și `../why-lunajets/01-audit-old-why-lunajets.md`. Navbar, footer, fonturi, GTM, CookieYes, code components, JSON-LD Organization/WebSite/LocalBusiness și „Our Offices” **nu sunt redocumentate**; mai jos apar doar diferențele.
> Textele verbatim sunt păstrate în engleză, între backticks sau în citate.

## Screenshot-uri (`/home/user/IDS/migration/private-jet-charter/old-screenshots/`)

| Fișier | Conținut |
|---|---|
| `old-pjc-1440-full.jpg` | Pagina completă, desktop 1440 (înălțime 12278px) |
| `old-pjc-991-full.jpg` | Pagina completă, tabletă 991 (14619px) |
| `old-pjc-390-full.jpg` | Pagina completă, mobil 390 (19937px) |
| `old-pjc-1440-hero.jpg` | Hero cu navbar (placeholder-ul gri = formularul RequestFlight neîncărcat) |
| `old-pjc-1440-fly-private.jpg` | „Fly private on your terms” (split imagine/text + badge „35 min”) |
| `old-pjc-1440-process.jpg` | „From request to takeoff” (4 pași) |
| `old-pjc-1440-pricing.jpg` | „How much does a private jet charter cost?” (tabel tarife) |
| `old-pjc-1440-benefits.jpg` | „Why flying private with us” (5 carduri + card link) |
| `old-pjc-1440-travellers.jpg` | „Made for every kind of traveller” (3 coloane pe navy + foto 20%) |
| `old-pjc-1440-services.jpg` | „Charter services for every need” (8 carduri servicii) |
| `old-pjc-1440-compare-fcp.jpg` | Tabel On-Demand vs Frequent Charter Program |
| `old-pjc-1440-compare-models.jpg` | Tabel Jet charter vs fractional vs membership |
| `old-pjc-1440-faq-default-open.jpg` / `old-pjc-1440-faq-collapsed.jpg` | FAQ: starea implicită (toate deschise) și închisă |
| `old-pjc-1440-destinations.jpg` | Slider CMS „Top trending private jet destinations” (Swiper neinițializat) |
| `old-pjc-1440-cta.jpg` | CTA final „Ready to fly?” |
| `old-pjc-991-hero.jpg`, `old-pjc-991-compare-models.jpg` | Close-up tabletă |
| `old-pjc-390-hero.jpg`, `old-pjc-390-pricing.jpg`, `old-pjc-390-compare-models.jpg`, `old-pjc-390-destinations.jpg` | Close-up mobil |

Close-up-urile 1440 (în afară de hero) sunt făcute cu navbar-ul fix ascuns, ca să nu acopere eyebrow-urile.

Iconurile SVG inline unice din `<main>` + CTA au fost salvate în `/home/user/IDS/migration/private-jet-charter/assets/old-icons/` (11 fișiere, `00-arrow-right.svg` … `10-chevron-down-faq.svg`; vezi §3).

> Note despre capturi (ca la About/Why): nu apare banner CookieYes (host blocat); code components au rămas fără CSS/JS. **Diferență importantă:** aici code component-ul `RequestFlight` este **vizibil în hero** (formularul de cerere zbor), dar nu s-a putut încărca, deci în capturi apare doar caseta goală `request-flight-wrapper` (fundal alb 60%, bordură). Bara sticky mobilă apare în mijlocul capturilor full-page 991/390 (artefact `position: fixed`). Swiper (jsdelivr) blocat ⇒ slider-ul de destinații apare ca rând static tăiat la dreapta.

---

## 1. URL, canonical, hreflang, SEO

- **URL:** `https://www.lunajets.com/en/private-jet-charter`
- **Canonical:** `<link href="https://www.lunajets.com/en/private-jet-charter" rel="canonical"/>` ✅ self-referencing
- **`<html lang="en">`**; `.page-wrapper` fără id (ca Why).
- **Sub-rute CMS sub acest slug:** în sitemap există **347** URL-uri `/en/private-jet-charter/fly-to-*` (template Destinații) și **164** `/en/private-jet-charter/fly-between-*-and-*` (template Rute). ⚠️ Slug-ul paginii este și prefixul a ~511 pagini CMS (× 8 limbi, cu prefixe localizate, ex. `/fr/location-de-jet-prive/volez-vers-paris`). Orice schimbare de slug la rebuild atrage redirect-uri în masă.
- Există și pagina `/en/private-jet-charter-aviation-frequently-asked-questions` (sitemap), **nelegată** din FAQ-ul acestei pagini.

### 1.1 hreflang (8 + x-default; toate HTTP 200)

| hreflang | URL | H1 localizat | `<title>` localizat |
|---|---|---|---|
| `x-default` | https://www.lunajets.com/en/private-jet-charter | — | — |
| `en` | https://www.lunajets.com/en/private-jet-charter | `On-demand private jet charter` | `Private Jet Charter & Hire \| Broker Since 2007 \| LunaJets` |
| `fr` | https://www.lunajets.com/fr/location-de-jet-prive | `Location de jet privé à la demande` | `Location de Jet Privé \| Courtier depuis 2007 \| LunaJets` |
| `de` | https://www.lunajets.com/de/privatjet-mieten | `Privatjet mieten, jederzeit auf Abruf` | `Privatjet mieten & chartern \| Broker seit 2007 \| LunaJets` |
| `it` | https://www.lunajets.com/it/noleggio-jet-privato | `Noleggio di jet privati su richiesta` | `Noleggio di Jet Privati su Richiesta \| Dal 2007 \| LunaJets` |
| `es` | https://www.lunajets.com/es/alquiler-de-jet-privado | `Alquiler de jet privado bajo demanda` | `Alquiler de Jet Privado \| Bróker desde 2007 \| LunaJets` |
| `ru` | https://www.lunajets.com/ru/charter-chastnogo-samoleta | `Аренда частного самолёта по запросу` | `Аренда частного самолёта \| С 2007 года \| LunaJets` |
| `hu` | https://www.lunajets.com/hu/maganrepulogep-berles | `Igény szerinti magánrepülőgép bérlés` | `Magánrepülőgép-Bérlés \| Bróker 2007 Óta \| LunaJets` |
| `pl` | https://www.lunajets.com/pl/czarter-prywatnego-samolotu | `Czarter prywatnego samolotu na życzenie` | `Wynajem prywatnego samolotu \| LunaJets` |

- Slug-uri localizate, de păstrat identic (altfel 8 × 301 + ~511 × 8 pentru sub-rutele CMS).
- ⚠️ **Secțiunea „Transparent pricing” (tabelul de tarife) există doar în EN.** În toate cele 7 limbi non-EN lipsește din HTML (vizibilitate per locale în Webflow Localization): EN are 10 H2 în main, restul 9. Restul structurii (10 secțiuni, 24 H3, 4 FAQ, 8 carduri servicii, 11 destinații) e identic între limbi.
- Cifrele hero sunt localizate ca text (FR: `+ de 4 800`, `+ de 182`, `4,8 ★`, `24/7`).

### 1.2 Meta

| Element | Valoare (verbatim) |
|---|---|
| `<title>` | `Private Jet Charter & Hire \| Broker Since 2007 \| LunaJets` (57 car.) |
| `meta description` | `No membership, no long-term commitment. Get quotes on 4,800+ private jets worldwide within minutes, with a 24/7 dedicated advisor on every flight.` (146 car.) |
| `og:title` / `twitter:title` | identice cu title |
| `og:description` / `twitter:description` | identice cu meta description |
| `og:image` / `twitter:image` | `https://cdn.prod.website-files.com/67c72c8a3c305a53672bdcca/6a27e33d1c9a0ee95f6f677c_private-jet-interior.webp` (= imaginea hero; aici `twitter:image` **există**, pe Why lipsea) |
| `og:type` | `website` |
| `og:url` | **lipsește** (ca pe About/Why) |
| `twitter:card` | `summary_large_image`; `twitter:site` lipsește |
| `meta robots` | absent (implicit index,follow) |
| `google-site-verification`, favicon, apple-touch-icon | identice cu About |

- Restul `<head>`-ului (după `preconnect code-components`) este **identic byte cu byte** cu cel de pe Why LunaJets (Consent Mode, GTM-TRDGMCLS, CookieYes sincron, Finsweet Attributes v2, Finsweet Components, `.grecaptcha-badge` ascuns, `longtext` noscript, stilul `min-height` pentru `request_component-dynamic` în hero).
- **Aici acel stil din head chiar se aplică:** `[class*=hero] .request_component-dynamic:not(:has(.visuallyhidden)) {min-height: 430px}` și `min-height: 187px` de la 991px în sus (rezervă spațiu pentru formularul din hero, anti-CLS).
- Pagina e în sitemap (`<loc>https://www.lunajets.com/en/private-jet-charter</loc>`).

### 1.3 Date structurate

**JSON-LD: 10 blocuri, toate în `<body>`.**

1–7. `LocalBusiness` × 7 („Our Offices”, footer): **identice byte cu byte** cu Why/About.
8. `@graph` Organization + WebSite: **identic byte cu byte** cu Why/About.
9. **`WebPage`** (din `.schema.w-dyn-list` #1 după footer):

```json
{"@context":"https://schema.org","@graph":[{"@type":"WebPage",
 "@id":"https://www.lunajets.com/en/private-jet-charter#webpage",
 "url":"https://www.lunajets.com/en/private-jet-charter",
 "name":"Private Jet Charter &amp; Hire | Broker Since 2007",
 "description":"No membership, no long-term commitment. Get quotes on 4,800+ private jets worldwide within minutes, with a 24/7 dedicated advisor on every flight.",
 "speakable":{"@type":"SpeakableSpecification","cssSelector":[".speakable"]},
 "inLanguage":"en","isPartOf":{"@id":"https://www.lunajets.com/#website"}}]}
```

10. **`Product`** (din `.schema.w-dyn-list` #2, **bloc nou** față de About/Why):

```json
{"@context":"https://schema.org","@graph":[{"@type":"Product",
 "@id":"https://www.lunajets.com/en/private-jet-charter#product",
 "name":"Private Jet Charter &amp; Hire | Broker Since 2007",
 "description":"No membership, no long-term commitment. …",
 "image":["https://cdn.prod.website-files.com/67c734771b96932daef1ebc6/69d11c097fff2bf853d6390b_private-jet-charter-services.webp"],
 "aggregateRating":{"@type":"AggregateRating","ratingValue":"4.8","ratingCount":2302}}]}
```

- ⚠️ `&amp;` **literal în JSON** la `name` (WebPage și Product): entitate HTML dublu-escape-uită, Google va citi „Private Jet Charter &amp; Hire”.
- ⚠️ `speakable` → `.speakable`, dar **niciun element de pe pagină nu are clasa `speakable`** (selector mort).
- ⚠️ `Product` fără `offers`/`brand`/`review`, cu rating-ul organizației (4.8/2302, identic cu `Organization.aggregateRating`): risc de politică „self-serving reviews” și de neeligibilitate. Imaginea Product (`…69d11c097fff2bf853d6390b_private-jet-charter-services.webp`, din asset-urile CMS `67c734771b96932daef1ebc6`) diferă de og:image.
- Fără `BreadcrumbList`, fără `Service`/`about → #organization`.

**Microdata (FAQ):** `div.faq-outer-wrapper[itemscope itemtype="https://schema.org/FAQPage"]` › 4 × `details[itemprop=mainEntity itemtype=Question]` › `h3[itemprop=name]` + `div[itemprop=acceptedAnswer itemtype=Answer]` › `p[itemprop=text]`. Hardcodat (nu CMS). Notă: rich result-urile FAQ sunt limitate de Google din 2023 la site-uri guvernamentale/medicale; markup-ul rămâne valid, dar fără beneficiu SERP.

### 1.4 Outline headings (ordinea DOM)

```
H1  On-demand / private jet charter               (h1.heading-style-h1 într-un HTML Embed; „private jet charter” = span.block.text-style-italic)
H2  Fly private / on your terms
H2  From request / to takeoff
  H3  Flight Request
  H3  Receive your quotes
  H3  Confirm your flight
  H3  Arrive & fly
H2  How much does a private jet charter cost?     (doar EN)
H2  Why flying private / with us
  H3  ARGUS® certification                        (h3 italic)
  H3  4,800+ aircraft worldwide
  H3  Dedicated Private Aviation Advisor
  H3  Full transparency
  H3  End-to-end trip coordination
H2  Made for every kind of traveller, / with no barrier to entry
  H3  Leisure Travellers
  H3  Business Executives
  H3  First-Time Flyers
H2  Charter services / for every need
  H3  Last minute charter  … Corporate events     (8 × H3, fiecare conține <a>)
H2  On-Demand vs. / Frequent Charter Program
H2  Jet charter / vs fractional ownership / vs membership program
H2  Frequently Asked Questions / About Private Jet Charter
  H3  How quickly can I get a quote?              (h3.heading-style-h4 în <summary>)
  H3  Do I need to pay anything before booking?
  H3  What if I need to cancel or change my flight?
  H3  Can I fly to airports not served by commercial airlines?
H2  Top trending / private jet destinations       (numele destinațiilor = <p class="heading-style-h4">, nu headings ✅)
--- în afara <main> ---
H2  Your next journey starts here                 („starts here” în <em>)
--- footer (identic) ---
H2  Our Offices + 8 × H3
```

- Un singur H1 ✅; ierarhie corectă (nu sare niveluri). 10 H2 / 24 H3 în main.
- ⚠️ **H1 și toate H2-urile din main sunt scrise în HTML Embed-uri** (`div.w-embed > h2.heading-style-h2` + `span.block.text-style-italic`), nu elemente native Webflow. Excepție: H2 din CTA (nativ, cu `<em>`).
- `h2 { text-transform: capitalize }` global ⇒ pe ecran: „How Much Does A Private Jet Charter Cost?”, „Jet Charter Vs Fractional Ownership Vs Membership Program”, „Made For Every Kind Of Traveller, With No Barrier To Entry”, „Your Next Journey Starts Here”. H1 și H3-urile FAQ nu sunt afectate.
- Gramatică: `Why flying private with us` (ar fi „Why fly private with us”).

---

## 2. Structură generală și evaluare Client-First

```
body
├─ .w-embed (global styles, identic)
├─ .page-wrapper
│  ├─ header.navbar2_component            (identic; „Private jet charter” + „On-demand jet charter” = w--current)
│  ├─ main.main-wrapper#main
│  │  ├─ section.hero_bg-image-section                    → 3.1 Hero + formular RequestFlight + 4 stats
│  │  ├─ section.split-content_section                    → 3.2 Fly private on your terms
│  │  ├─ section.dm_process-section                       → 3.3 Process (4 pași, navy)
│  │  ├─ section.pricing-section                          → 3.4 Pricing (tabel, doar EN)
│  │  ├─ section.dp_who-section                           → 3.5 Benefits (6 celule)
│  │  ├─ section.dm_why-section                           → 3.6 Travellers (navy + foto 20%)
│  │  ├─ section.section_special-jet  (fără id!)          → 3.7 Charter services (8 carduri)
│  │  ├─ section.compare-section                          → 3.8 On-Demand vs FCP (tabel)
│  │  ├─ section.compare-section                          → 3.9 Charter vs fractional vs membership (tabel)
│  │  ├─ section.dp_faq-section.background-color-cream    → 3.10 FAQ (4 × <details>)
│  │  └─ div.section_top_destinations                     → 3.11 Destinații (CMS + Swiper)
│  ├─ section.cta-request_section [variant base]          → 3.12 CTA final (⚠️ în afara <main>)
│  └─ footer.footer_u#footer                               (identic)
├─ .w-dyn-list (Organization)  ├─ .schema.w-dyn-list (WebPage)  ├─ .schema.w-dyn-list (Product)
└─ scripturi (jQuery, Webflow, embed-uri globale, GTM noscript, swiper@12, init Swiper)
```

- Diferență față de About/Why: **nu mai există** `.request_component-dynamic > .visuallyhidden` ascuns la finalul body-ului; code component-ul `RequestFlight` e **mutat vizibil în hero**, în `.request-flight-anchor#req-always` (activează logica barei sticky, vezi §5.2).

**Verdict Client-First: parțial / hibrid (similar Why, cu mai multe prefixe amestecate).**
- ✅ `padding-global`, `padding-section-medium`, `container-medium` (80rem, non-standard ca pe About/Why), `spacer-*`, `heading-style-h1..h4`, `text-style-italic`, `text-style-allcaps`, `text-size-*`, `max-width-*`, `button is-*`, `hide-tablet`/`show-tablet`, `hide-mobile-landscape`/`hide-mobile-portrait`, `sr-only` (caption tabel).
- ❌ Abateri specifice paginii:
  - Prefixe amestecate `dp_` / `dm_` în aceeași secțiune: `dp_who-section` › `dp_who-component` › **`dm_who-items-wrapper`** › `dp_who-item` › `dm_who-item_heading`; `dm_why-section` › `dm_why-item` › **`dp_why-item_content`**. Clasa `dp_who-items-wrapper` e definită în CSS, dar nefolosită aici.
  - Nume de secțiune non-CF: `hero_bg-image-section`, `split-content_section`, `dm_process-section`, `pricing-section`, `compare-section` (×2, fără modificator), `dp_faq-section`, `section_top_destinations` (**`div`, nu `section`**; folosește `container-large`, restul `container-medium`).
  - Typo-uri: `stem_process-item` (în loc de step), `swipper-slider_*` (swiper), `location_lnik`, `donwload_button` (globale).
  - Rămășițe Relume: `testimonial41_component` / `testimonial41_heading-wrapper` folosite pentru header-ul slider-ului de destinații.
  - Combo-uri fără `is-`: `centered`, `under`, `under-step`, `fixed-240`, `highlighted`, `lunajets`, `compare-table`, `dp_compare-table`/`dm_compare-table`, `_4column`, `mobile_full-2`, `align-right`, `margin-top_auto`, `flex-column`, `flex-v-center`, `background-lj-cream`, `z-index-2`, `opacity-20`, `gap-1-5rem`, `line-height-150`, `destinations`.
  - Tabele: `table_4col` folosit și pentru tabelul cu 3 coloane; `p-table_top-row_4cols` **și** `p-table_top-row_4col` pe același rând; `p-table_top-row_3cols` pe un tabel `table_4col`.
  - Utilitare cu px în nume: `max-width-640px`, `max-width-479px` (= 30rem), `max-width-800` (800px, `text-align:center` implicit).
  - `w-node-*` (grid overrides per element): 20+ id-uri în tabele și grila pricing.
  - Wrapper gol: `div.max-width-479px.max-width-full-tablet` în Benefits (H2-ul e în sibling-ul următor, deci limita de lățime nu se aplică).
  - `spacer-1-5rem` / `spacer-small` / `spacer-medium` folosite ca **combo** pe grid-uri, `<p>` și `button-group`.

---

## 3. Secțiuni (în ordinea paginii)

### 3.1 Hero — `section.hero_bg-image-section`

- **Scop:** H1, propunerea de valoare, **formularul de cerere zbor** (code component) și 4 cifre cheie, peste o fotografie full-bleed cu overlay navy.
- **Wrapper-e:** `padding-global padding-section-medium hero` › `container-medium` › `hero_bg-image-component` › `max-width-640px` › `dp_hero-content` (flex column) › eyebrow › `spacer-small` › H1 (embed) › `spacer-1-5rem` › P › `spacer-large`; apoi `div.text-color-primary` › **`request_component-dynamic`** (formular, lățime 100% din container, vezi §4) › `spacer-large` › `hero_stats-wrapper` › `divider white-full` › `spacer-xlarge` › `hero-stats_wrapper grid-4x1` (4 col; 2 col ≤991; 1 col ≤479). Fundal: `bg_image-wrapper` › `img.image-cover_absolute` + `blue_image-overlay dark-blue` (identic Why). Înălțime randată: 888px (1440), 914 (991), 1117 (390).
- **Text:**
  - Eyebrow (`tag is-text is-icon is-alternate` + `tag-line`): `Fly When You Need To` (afișat uppercase)
  - H1: `On-demand` + `<span class="block text-style-italic">private jet charter</span>` (Vanitas 54px, alb)
  - P: `Charter a private jet with no membership and no deposit. Compare quotes from 4,800+ aircraft worldwide, choose your route and departure time, and get competitive pricing within minutes. Every flight is managed by a dedicated Private Aviation Advisor, available 24/7.`
- **CTA:** niciun buton; conversia este formularul `RequestFlight` (vezi §4.1). Pe ≤991 apare și bara sticky (`Request quotes` + WhatsApp).
- **Stats** (`p.stats_item` › `span.stats_number.small-no_italic.text-color-white` Vanitas 40px / 32px ≤991 + `span.tag.is-text` Gilroy 12px uppercase, ls 1.44px); **fără iconuri**:

| Număr | Etichetă |
|---|---|
| `4,800+` | `aircraft worldwide` |
| `182+` | `countries flown to` |
| `4.8 ★` | `client rating` |
| `24/7` | `expert availability` |

- **Imagine:** `…/67c72c8a3c305a53672bdcca/6a27e33d1c9a0ee95f6f677c_private-jet-interior.webp` (1440×960, `sizes="(max-width: 1439px) 100vw, 1440px"`), alt `Spacious private jet cabin with leather seats, cushions, wooden table, and oval windows`, `loading="eager"`. Rol: fundal decorativ (și og:image).
- `4.8 ★`: steaua e caracter text (cititoarele de ecran citesc „black star”); ratingul nu are sursă vizibilă.

### 3.2 Fly private on your terms — `section.split-content_section`

- **Wrapper-e:** `padding-global padding-section-medium` › `container-medium` › `split-content_component centered` (grid 2 col 608/608; ≤991 flex column) › `split-content_image` (id `w-node-_555defb6-…302b`, **imaginea în stânga**; bordură `--stroke`, min-height 29rem; ≤991 `order:9999` ⇒ **sub** text, 27rem; ≤767 15rem) + `split-content_content_left`.
- **Badge peste imagine:** `p.image-content_absolute` (fundal `--lj-blue`, padding 1.5rem, absolut stânga-jos) › `span.heading-style-h2` `35 min` + `span.tag.is-text` `quickest take-off` + `span.text-size-tiny` `after booking`.
- **Text:**
  - Eyebrow (`tag-line is-blue`): `Complete freedom`
  - H2 (embed): `Fly private` / *`on your terms`*
  - P1: `On-demand private jet charter is the most flexible way to fly privately. No long-term commitment, no membership fee, no upfront deposit, just pay as you go.`
  - P2: `Each booking is independent. You choose your departure airport, destination, aircraft type, and date. We source the most suitable aircraft from our network of 480+ certified operators, present competitive quotes, and coordinate everything else.`
  - P3: `Whether you fly once a year or several times a month, on-demand charter gives you complete flexibility, with a dedicated Private Aviation Advisor behind every trip.`
  - (în `p-wrapper`, **fără** `speakable`)
- **CTA:** niciunul.
- **Imagine:** `…/6a27c4c2281cfb6deab534ec_lunajets-bag-catering-private-jet-table-1200x800.webp` (1200×800), alt `LunaJets branded bag and catering plate with fruit and pastries inside a private jet cabin`, lazy. Rol: foto brand/ambianță. (În imagine apare și brandul „Kiehl's”: de verificat drepturile.)

### 3.3 Process — `section.dm_process-section`

- **Fundal:** `--lj-blue` plin, text alb.
- **Wrapper-e:** `padding-global padding-section-medium` › `container-medium` › `dm_process-component` › `dm_process-content` › eyebrow › H2 › `spacer-xlarge` › `dm_process-items-wrapper` (grid 4 col, gap 2.5rem; 2 col ≤991; 1 col ≤479) › 4 × `stem_process-item` (flex column, gap 2rem) › `step_item-number_wrapper` (`step_item-number` Gilroy 300, 3.375rem, `#a3b0c0` + `tag-line under-step` 50% sub număr) + `step_item-number_content` (H3 Vanitas 32px + P).
- **Text:**
  - Eyebrow (`tag-line`, alb): `The process`
  - H2: `From request` / *`to takeoff`*

| Nr. | H3 | Paragraf (verbatim) |
|---|---|---|
| `01` | `Flight Request` | `Tell us your route, dates, number of passengers, and any specific requirements. Use our request form, reach us on WhatsApp, or call us directly, 24/7.` |
| `02` | `Receive your quotes` | `Your dedicated Private Aviation Advisor selects suitable aircraft from our network of 480+ certified operators and presents you with competitive, transparent options to compare.` |
| `03` | `Confirm your flight` | `Choose your preferred aircraft, review the per-flight contract, and confirm your booking. No hidden clauses, no surprises.` |
| `04` | `Arrive & fly` | `Head to the private terminal a few minutes before departure. Your Advisor has already handled ground transfers, catering, and any special requests. You board and go.` |

- Numerele sunt `div`, nu listă ordonată (`<ol>` ar fi semantic). Capitalizare inconsistentă între H3 (`Flight Request` vs `Receive your quotes`). Fără iconuri, fără CTA (pasul 01 menționează formularul, WhatsApp și telefonul fără linkuri).

### 3.4 Pricing — `section.pricing-section` (⚠️ doar EN)

- **Wrapper-e:** `padding-global padding-section-medium` › `container-medium` › `compare-component` › eyebrow › H2 (`max-width-640px`) › `w-layout-grid grid-2x1 spacer-1-5rem` (2 col 628/628 cu `w-node` overrides) › [P stânga-jos (`flex-left-bottom`)] + [tabel dreapta, rândurile 1–2] + [CTA stânga-sus (`flex-left-top`)].
- **Text:**
  - Eyebrow: `Transparent pricing`
  - H2: `How much does a private jet charter cost?`
  - P: `Charter rates are billed per flight hour. Around 85% of LunaJets bookings fall between €4,000 and €14,000 per hour, from roughly €2,000 for a turboprop to over €40,000 for the largest long-range jets. Every quote is a fixed, all-inclusive price covering crew, fuel and landing fees.`
- **Tabel** (`div.fs-table-1_instance[fs-table-element=table][fs-table-instance=fs-table-1]` › `table.table_2col`, `<caption class="sr-only">Hourly rates for a sample of 4 private jet categories</caption>`; antet fundal crem, celule centrate, Gilroy):

| `Aircraft category examples` (th, `hide-mobile-portrait`) | `Hourly rates` |
|---|---|
| `Turboprops` | `€2,000 - €5,000` |
| `Light jets` | `€4,600 - €7,300` |
| `Midsize jets` | `€8,400 - €12,900` |
| `Long-range jets` | `€11,000 - €42,100` |

- **CTA:** `Go to the pricing dedicated page` → `/en/prices` (`button is-link is-icon`, săgeată). Label stângaci („Go to the pricing dedicated page”).
- Inconsistență: textul spune „over €40,000”, tabelul până la €42,100 ✅ compatibil; „from roughly €2,000” = min turboprop ✅. Pe ≤479 th-ul primei coloane dispare (`hide-mobile-portrait`) ⇒ tabel fără antet pentru categorii.
- Tabelul folosește atributele Finsweet `fs-table-*`, dar Finsweet Components (jsdelivr) e blocat aici; fără JS tabelul e oricum static și complet.

### 3.5 Benefits — `section.dp_who-section`

- **Wrapper-e:** `padding-global padding-section-medium` › `container-medium` › `dp_who-component` › eyebrow › `spacer-small` › `max-width-479px max-width-full-tablet` (**gol**) › H2 (embed) › `spacer-xlarge` › `dm_who-items-wrapper` (grid 3 col, gap 1.5rem; 2 col ≤991; flex column ≤479) › 6 × `dp_who-item` (bordură 1px `--stroke`, radius 2px, padding 2rem / 1.5 / 1.25) › `dm_who-item_heading` › icon (`w-embed`, SVG 48×48, navy) + `h3.heading-style-h3.text-style-italic` (Vanitas 32px italic) + P.
- **Text:**
  - Eyebrow (`tag-line is-blue`): `Your benefits`
  - H2: `Why flying private` / *`with us`*

| # | Icon (fișier) | H3 | Paragraf (verbatim) |
|---|---|---|---|
| 1 | rozetă/badge cu bifă (`02-argus-badge.svg`, viewBox 0 0 32 32, `fill="#061d38"`) | `ARGUS® certification` | `LunaJets was the first European charter broker to obtain ARGUS® certification. For over a decade, this standard has guided every flight we arrange.` |
| 2 | 3 avioane în urcare (`03-aircraft-network.svg`, 0 0 49 49, navy + `#fff`) | `4,800+ aircraft worldwide` | `Access turboprops, light jets, midsize jets, heavy jets, and ultra-long-range aircraft via our worldwide operator network.` |
| 3 | card cu persoană + telefon (`04-advisor-card.svg`, 0 0 49 49) | `Dedicated Private Aviation Advisor` | `Every booking is managed by one dedicated advisor, from your first request to landing.` |
| 4 | document + lupă (`05-contract-magnifier.svg`, 0 0 44 40) | `Full transparency` | `Each trip comes with a clear, straightforward contract. No hidden clauses, no surprises.` |
| 5 | noduri de rețea (`06-network-nodes.svg`, 0 0 49 49) | `End-to-end trip coordination` | `Ground transfers, catering, special requests, multi-leg itineraries. Your Advisor handles every detail so the trip runs exactly as planned.` |
| 6 | — card link `dp_who-item background-lj-cream` `[data-lj_card_linked]` | — | `a.button is-link is-icon flex-column[data-lj_card_link]` `Discover all the reasons why clients fly with us` → `/en/why-lunajets` (săgeată) |

- Iconurile au culoarea hardcodată `#061d38` (nu `currentColor`), fără `aria-hidden`.
- Pattern identic cu cardul 4 din „Tailored for all your needs” de pe Why (caseta crem + buton link centrat).

### 3.6 Travellers — `section.dm_why-section`

- **Fundal:** `--lj-blue` + imagine `bg_image-wrapper z-index-1` › `img.image-cover_absolute.opacity-20`; conținutul în `padding-global … z-index-2`. Text alb.
- **Wrapper-e:** `container-medium` › `dm_why-component` › eyebrow › H2 (`max-width-640px`) › `spacer-xlarge` › `dm_why-items-wrapper` (grid 3 col; **1 col de la ≤991**) › 3 × `dm_why-item` (padding 2rem, flex column gap 2rem; `is-middle` cu borduri stânga/dreapta `#e1e4e840`, pe ≤991 borduri sus/jos) › icon SVG 48×48 alb + `dp_why-item_content` › H3 + P.
- **Text:**
  - Eyebrow (`tag-line`, alb): `From First-Timers to Frequent Flyers`
  - H2: `Made for every kind of traveller,` / *`with no barrier to entry`*

| Icon | H3 | Paragraf (verbatim) |
|---|---|---|
| palmier (`07-palm-tree.svg`, 0 0 60 65, `#fff`) | `Leisure Travellers` | `Ski weekends, summer escapes, group holidays. Fly on your own schedule, to airports closer to your destination, without adapting to commercial timetables.` |
| servietă (`08-briefcase.svg`, 0 0 49 55) | `Business Executives` | `Cover multiple cities in a single day, respond to last-minute schedule changes, and arrive ready to work. On-demand charter fits around your agenda, not the other way around.` |
| glob cu avion (`09-globe-plane.svg`, 0 0 59 59) | `First-Time Flyers` | `No membership required, no long-term commitment. A dedicated advisor guides you through every step, so your first private flight is as easy as any other.` |

- **Imagine de fundal:** `…/6a27e48b22f6bebb48f51338_vip-airliner-door-open.webp` (1200×890), alt `Close-up of an airplane wing and tail with a clear sky background and sunlight reflecting off the wing.` ⚠️ Alt-ul nu corespunde imaginii (se vede ușa deschisă a unui avion de linie VIP, nu aripă/coadă). Fiind decorativă la 20% opacitate, `alt=""` ar fi corect.
- Fără CTA.

### 3.7 Charter services — `section.section_special-jet` (⚠️ fără id)

- **Scop:** hub spre cele 8 pagini `/en/private-jet-services/*`.
- **Wrapper-e:** `padding-global padding-section-medium` › `container-medium` › `special_charter-component` › eyebrow › H2 (embed, `max-width-640px … spacer-small`) › `p.max-width-640px.spacer-1-5rem` › `grid_3x3 spacer-1-5rem` (grid 3 col, gap 2rem; 2 col / gap 2.5rem ≤991; 1 col ≤767) › 8 × `special_charter-card[data-lj_card_linked]` (flex column, gap 1rem; ≤767 margin-top 2rem) › `img.image-card.fixed-240` (height 240px, cover) + `lower_wrapper is-flex-grow` (padding 0 1.5rem 1.5rem; `justify-content: space-around` ⇒ **titlurile nu se aliniază** între carduri, vizibil în captură) › `h3.heading-style-h3` › `a.link_card.under[data-lj_card_link]` + P + `div.button.is-link.is-icon` „Learn more” (div, nu link ✅ fără link duplicat).
- **Text:**
  - Eyebrow (`tag-line is-blue`): `Bespoke charter flights`
  - H2: `Charter services` / *`for every need`*
  - P: `No two charter needs are alike. LunaJets brings two decades of expertise across every category of private flight, ensuring each booking, however complex or time-sensitive, is handled with the same precision and care. Explore the full range of services below.`

| # | Imagine (src / alt / dim.) | H3 (link) | href | Paragraf (verbatim) |
|---|---|---|---|---|
| 1 | `…/6a22cdfdad4e1960009e5277_last-minute-jet-charter.webp` / `Pilot in white shirt and sunglasses boarding a private jet on the tarmac under a partly cloudy sky` / 600×600 | `Last minute charter` | `/en/private-jet-services/last-minute-flights` | `Our experienced team regularly responds to urgent flight requests with private jets ready to fly less than an hour following the client’s enquiry. 35 minutes is our quickest take-off time after a booking.` |
| 2 | `…/6a27f41d91cd93f7d1922bd2_e7649d67b52d278dbfd599002ff8402e_helicopter-charter.webp` / `helicopter for short distance charter and final mile transfers` / 600×400 | `Helicopter charter` | `/en/private-jet-services/helicopter-flights` | `For final miles or short connections, chartering a helicopter is often the most convenient option. Whether in winter or summer, LunaJets can arrange helicopter transfers to bring you closer to your final destination with speed and ease.` |
| 3 | `…/6a27f628d0e0ee466613c761_emergency-medical-private-jet-charter.webp` / `Private jet with medical equipment and ambulance on tarmac for emergency medevac charter service` / **400×290, fără `sizes`** (upscalat la 405px) | `Emergency charter` | `/en/private-jet-services/emergency-charter` | `LunaJets offers rapid, worldwide medical evacuation (medevac) and air ambulance services. Available 24/7, our team arranges emergency flights for bed-to-bed transfers, repatriations, or the urgent delivery of vital supplies.` |
| 4 | `…/6a27f6e7024b860bd660ed12_group-charter.webp` / `Passengers walking with luggage toward an airplane on the tarmac at sunset` / 600×400 | `Group charter` | `/en/private-jet-services/group-charter` | `Flying larger groups of passengers is easy with LunaJets. Our global team of experts can help you access the aircraft best suited to your plans and guests.` |
| 5 | `…/6a27f974f3cc24240c0d93a1_private-jet-with-limousine-on-tarmack.webp` / `Private jet on tarmac with a black luxury limousine parked nearby at sunset` / 600×400 | `Leisure charter` | `/en/private-jet-services/leisure-charter` | `LunaJets’ Private Aviation Advisors bring extensive expertise in arranging bespoke flights for every type of leisure travel: family holidays, weekend getaways, and winter and summer escapes.` |
| 6 | `…/6a27f9e81d861969e7039659_cargo-charter.webp` / `Inside cargo plane with pallets of goods secured by nets on one side of the wide interior` / 600×400 | `Cargo charter` | `/en/private-jet-services/cargo-charter` | `Whether it is precious art, dangerous goods, sensitive documents or extremely large and heavy cargo, our experts are ready to help you charter the right private aircraft for your air freight.` |
| 7 | `…/6a27fa3a4cd94e811829f3bc_corporate-jet-charter.webp` / `Two business people walking from a white private jet parked on an airport tarmac under a blue sky` / 600×400 | `Corporate charter` | `/en/private-jet-services/corporate-charter` | `Expert jet charter broker for every sector: government, finance, entertainment, commodities, sports & corporate. Specialized advisors deliver tailored solutions for your industry.` |
| 8 | `…/6a27fa86fafbb453e2069d28_corporate-events.webp` / `Well-dressed people mingling at a corporate event with round tables and floral centerpieces` / 600×400 | `Corporate events` | `/en/private-jet-services/corporate-events` | `Chartering a private jet for corporate events ensures executives arrive on time and refreshed, stay productive in flight and avoid commercial travel delays.` |

- Toate imaginile lazy, webp, randate 405×240 (crop cover, fără radius).
- Imaginea 1 e aceeași ca pe Why (cardul „Last-Minute Flights”), dar cu **alt diferit** (Why: `Man in white shirt and black pants stepping onto private jet parked on airport tarmac`).
- Grila 3×3 cu 8 carduri lasă ultima celulă goală pe desktop.
- `Specialized` (US) vs `personalisation`/`traveller` (UK) în rest; `Last minute charter` fără cratimă vs `Last-Minute Flights` pe Why.

#### Verificare ancoră `#special-private-jet-charter`

- **Nu există niciun element cu `id="special-private-jet-charter"` pe pagină, în nicio limbă** (0 apariții în EN și în cele 7 variante).
- Why LunaJets leagă ancora din **toate cele 8 limbi** (ex. `/en/private-jet-charter#special-private-jet-charter`, `/fr/location-de-jet-prive#special-private-jet-charter`). Linkul duce doar în topul paginii.
- Ținta logică este `section.section_special-jet` (secțiunea „Charter services for every need”). La rebuild: `id="special-private-jet-charter"` pe secțiunea de servicii (sau schimbarea href-ului pe Why).

### 3.8 On-Demand vs Frequent Charter Program — `section.compare-section` #1

- **Wrapper-e:** `padding-global padding-section-medium` › `container-medium` › `compare-component` › eyebrow › H2 › P (`max-width-640px`) › `spacer-large` › `fs-table-1_instance` › `table.table_4col.dp_compare-table` (3 coloane) › `thead.h-table_sticky` (sticky la top 4.75rem pe ≤767) › `tbody.fs-table-1_body` › `button-group margin-top_auto mobile_full-2 spacer-medium align-right` › CTA.
- **Text:**
  - Eyebrow: `Flying multiple times a year?`
  - H2: `On-Demand vs.` / *`Frequent Charter Program`*
  - P: `Alongside on-demand charter, LunaJets offers a Frequent Charter Program designed for frequent and corporate flyers. A refundable advance payment replaces per-flight payments, and booking is even faster. Not sure which fits you? See how they compare below.`
- **Tabel** (th 1 gol, `hide-mobile-landscape`; coloana 2 `highlighted` navy/alb; coloana 1 = `p-table_feature` crem, uppercase 600; celulele `lunajets` bold):

| (feature) | `On-demand charter` | `Frequent Charter Program` |
|---|---|---|
| `Advance payment` | `None required` | `Flexible advance payment, with any unused amount refundable` |
| `Long-term contract` | `No contract` | `Flexible agreement` |
| `Per-flight payment` | `Pay as you go` | `Your advance payment is applied to each booking` |
| `Booking speed` | `Standard (minutes)` | `Even faster` |
| `Ideal for` | `Occasional / leisure flyers` | `Frequent / corporate flyers` |
| `Access to 4,800+ aircraft` | `Full access` | `Full access` |

- **CTA:** `More about the Frequent Charter Program` → `/en/frequent-charter-program` (`button is-link is-icon`, aliniat dreapta).
- Ultimul rând nu are clasa `lunajets` pe coloana on-demand ⇒ nu e bold (inconsistent vizual, vezi captura).
- Pe ≤767, un embed CSS al paginii schimbă rândurile: celula feature ocupă tot rândul, valorile dedesubt (`grid-template-columns: repeat(3, …)`).

### 3.9 Jet charter vs fractional vs membership — `section.compare-section` #2

- **Wrapper-e:** ca 3.8, cu `max-width-800 text-align-left` în jurul H2 + P; `table.table_4col.compare-table`, `thead.h-table_sticky`, rânduri `p-table_row p-table_row_4cols _4column`; la final `div.w-embed > style` (CSS responsive tabel, vezi §5.4). **Fără CTA.**
- **Text:**
  - Eyebrow: `Private jet charter vs. other options`
  - H2: `Jet charter` / *`vs fractional ownership`* / *`vs membership program`*
  - P: `Choosing how you fly privately is a significant decision. At LunaJets, we believe` **`private jet charter can serve many needs`** `: a one-off solution, a complementary option alongside an existing programme, or a full-time approach to private aviation.` `<br><br>` `This table is designed to bring clarity to each model, comparing what they really involve in terms of cost, flexibility, and long-term obligation.`
- **Tabel:**

| (feature) | `LunaJets` | `Fractional Ownership` | `Membership Program` |
|---|---|---|---|
| `Upfront fees` | `None` | `Required aircraft share purchase` | `Full subscription` |
| `Annual dues` | `None` | `Fixed monthly management fee` | `None` |
| `Commitment` | `Pay-as-you-go` | `Long-term contract` | `Multi-year subscription program` |
| `Worldwide reach` | `Global` | `Based on plane location` | `Areas of service based on subscription` |
| `Fleet access` | `4,800+ aircraft via operator network` | `Limited` | `Limited to company aircraft` |
| `Minimum booking notice` | `None` | `Depends on share` | `Usually 48h` |
| `Service` | `24/7 Private Jet Advisors` | `Customer support with less personalisation` | `Customer support with less personalisation` |
| `Peak / blackout days` | `None` | `Depending on share` | `Yes` |
| `Busy airport surcharges` | `None` | `Depending on share` | `Yes` |
| `Taxi time` | `Included in price` | `Yes` | `Yes` |
| `Change of aircraft category (smaller / larger)` | `Fully flexible` | `Yes` | `Yes` |

- Conținut ambiguu: la `Taxi time` și `Change of aircraft category` „Yes” nu spune dacă e cost suplimentar sau posibilitate; `Annual dues: None` la membership contrazice `Full subscription`. `Private Jet Advisors` vs `Private Aviation Advisor` în restul paginii. `Depends on share` vs `Depending on share`. `programme` (UK) vs `program` (US) în aceeași secțiune.
- Pe 390 tabelul are 3 coloane înghesuite (~96/128/128px) și antet sticky sub navbar (vezi `old-pjc-390-compare-models.jpg`).

### 3.10 FAQ — `section.dp_faq-section.background-color-cream`

- **Fundal:** crem `#f4f2ef`. Wrapper-e: `padding-global padding-section-medium` › `container-medium` › `dp_faq-component text-color-primary` › eyebrow › H2 › `spacer-xlarge` › `faq-outer-wrapper` (microdata FAQPage) › 4 × `details.lj_accordion-item.faq-wrapper` (border-bottom 1px navy, padding-bottom 1.25rem) › `summary.lj_accordion-toggle.background-transparent.padding-0` (flex, space-between) › `h3.heading-style-h4` (Vanitas 24px) + `span.lj_accordion-icon` (chevron `10-chevron-down-faq.svg`, rotit 180° când e deschis) + `div.lj_accordion-content…[role=region]` › `p.spacer-small`.
- **Text:**
  - Eyebrow: `FAQ`
  - H2: `Frequently Asked Questions` / *`About Private Jet Charter`*

| # | Întrebare (H3) | Răspuns (verbatim) |
|---|---|---|
| 1 | `How quickly can I get a quote?` | `In most cases within minutes. Submit your request online or call us, and a dedicated advisor will respond with suitable aircraft options to compare.` |
| 2 | `Do I need to pay anything before booking?` | `No. On-demand charter requires no upfront deposit and no membership. You receive a quote, review the per-flight contract, and payment is only processed once you confirm the booking. Each flight is billed individually.` |
| 3 | `What if I need to cancel or change my flight?` | `Cancellation and amendment terms are set out in the per-flight contract before you confirm. Terms vary by aircraft and operator. Your advisor will walk you through the options and help identify the most suitable available solution.` |
| 4 | `Can I fly to airports not served by commercial airlines?` | `Yes. Private aviation gives access to a far wider airport network than scheduled airlines, including smaller regional airfields closer to your final destination. Your advisor will identify the most suitable airport for the trip, taking runway requirements, operating hours and handling into account.` |

- Conținut **static** (nu CMS), 4 item-uri. Link spre pagina FAQ completă (`/en/private-jet-charter-aviation-frequently-asked-questions`): lipsește.

### 3.11 Top trending destinations — `div.section_top_destinations` (CMS)

- **Wrapper-e:** `div.section_top_destinations` (overflow hidden) › `padding-global padding-section-medium` › **`container-large`** › `testimonial41_component` › `testimonial41_heading-wrapper` (flex, space-between, end; column ≤767) › [eyebrow + H2] + `div.hide-tablet` › `button is-secondary is-stroke is-icon` `View all destinations` → `/en/destinations`; `spacer-xlarge` › `swipper-slider_component` › `swipper-slider_cms_wrap.swiper.w-dyn-list` › `swipper-slider_cms_list.swiper-wrapper[role=list]` › 11 × `swipper-slider_cms_item.swiper-slide.destinations[role=listitem]` (lățime 20% ⇒ 5 vizibile; 33% ≤991; 50% ≤767; 85% ≤479; padding 0 .5rem) › `a.destination_item[data-w-id=a54d778f-…]` (uppercase, radius 2px) › `destination_image_wrapper` (height 360px) › `img.image-cover_absolute` + `destination_item-text` (`p.text-size-tiny` țară + `p.heading-style-h4` oraș) + `destination-overlay` (navy, opacity .5). Apoi `div.show-tablet` › al doilea buton `View all destinations` (duplicat, doar ≤991).
- **Text:** eyebrow `Get inspired`; H2 `Top trending` / *`private jet destinations`*.
- **Item-uri (ordinea din CMS):**

| # | Țară | Oraș | href | Imagine (fișier) | alt | `title` |
|---|---|---|---|---|---|---|
| 1 | `France` | `Paris` | `/en/private-jet-charter/fly-to-paris` | `69cba09b5419ac27a89618d6_paris-palais-jardin-du-luxembourg.webp` | `Palais and Jardin (Gardens) du Luxembourg in Paris` | `Private Jet from / to Paris` |
| 2 | `United Kingdom` | `London` | `…/fly-to-london` | `69cb715a9180ab930c3ad5e2_london-city-skyline-gherkin-cheesegrater.webp` | `London's City financial district skyline featuring the Gherkin and Cheesegrater skyscrapers` | `…London` |
| 3 | `France` | `Nice` | `…/fly-to-nice` | `69c6a15cb735ce864e134135_nice-coastal-bay-yachts-mediterranean-cliffs.webp` | `Aerial view of the Mediterranean coastline near Nice with yachts anchored in a turquoise bay and forested cliffs` | `…Nice` |
| 4 | `Spain` | `Ibiza` | `…/fly-to-ibiza` | `6a4b7998759cff24d21825e8_ibiza-spain-600x400.webp` | `Skyline of boats on the Mediterranean sea near the Baltic island of Formentera in Spain` ⚠️ („Baltic” greșit: Formentera e în Baleare) | `…Ibiza` |
| 5 | `Italy` | `Milan` | `…/fly-to-milan` | `68f08d11ae00aa8426d689be_68765fbd517cea4c8cb740bf_milan_private_jet_charter.webp` (fără `sizes`) | `View of the Duomo di Milano and the Monumento a Vittorio Emanuele II in Milan` | `…Milan` |
| 6 | `Spain` | `Madrid` | `…/fly-to-madrid` | `69c6af77616d56cfbc349988_madrid-cibeles-fountain-palace-spanish-flag.webp` | `Cibeles Fountain with goddess statue and lions in Plaza de Cibeles, Madrid, with the Cibeles Palace and Spanish flag` | `…Madrid` |
| 7 | `United States (USA)` | `New York` | `…/fly-to-new-york` | `69d67219468dfd5792590ab5_new-york-private-jet-charter.webp` (fără `sizes`) | `Skyview of New York skyscrapers with the Empire State Building on a sunny day` | `…New York` |
| 8 | `Switzerland` | `Geneva` | `…/fly-to-geneva` | `69d6611c3387496425dadcc5_geneva-lake-view-card.webp` | `Daylight skyline of Lake Geneva with its Jet d Eau and the Mont Blanc bridge` | `…Geneva` |
| 9 | `Switzerland` | `Zurich` | `…/fly-to-zurich` | `69c6afeb9894848996a965dd_zurich-frauminster-church-munsterbrucke-bridge-limmat.webp` | `Fraumünster church spire and Münsterbrücke bridge over the Limmat river in Zurich's historic old town` | `…Zurich` |
| 10 | `Spain` | `Palma de Mallorca` | `…/fly-to-palma` | `69d6721a468dfd5792590ac7_mallorca-spain-soller-destination-hero.webp` (fără `sizes`; fișierul spune „soller”) | `The port of Palma de Mallorca in Spain by summer with blue sky and white clouds` | `Private Jet from / to Palma, Mallorca` |
| 11 | `United Arab Emirates (UAE)` | `Dubai` | `…/fly-to-dubai` | `69d6720553a133bc38affbc9_dubai-private-jet-charter.webp` (fără `sizes`) | `View from a swimming pool of the Persian Gulf coast in Dubai with yachts and skyscrapers` | `…Dubai` |

- Imagini găzduite pe ID-ul de asset-uri CMS `67c734771b96932daef1ebc6`, 600×400, lazy, randate 243×360 (crop portret). Toate linkurile HTTP 200.
- Textul accesibil al linkului = „France Paris” (țară + oraș, fără context „private jet to…”); `title` pe `<img>` e redundant.

### 3.12 CTA final — `section.cta-request_section` [variant `base`] (⚠️ în afara `<main>`)

- **Componentă Webflow** `cta-request_section` (aceeași ca blocul „mobile app” de pe Why), aici cu atributul `data-wf--cta-request_section--variant="base"` și **alt conținut** (slot-uri/props): gradient `linear-gradient(150deg,#020c18,#061d38 28%,#0c2847 66%)`, text alb, centrat.
- **Wrapper-e:** `padding-global padding-section-medium` › `container-medium` › `cta-request_component text-align-center` › eyebrow › `spacer-small` › H2 › `spacer-1-5rem` › `max-width-640px` › P › `spacer-1-5rem` › `button-group is-center gap-1-5rem`.
- **Text:**
  - Eyebrow (`tag is-text is-icon`, fără `tag-line`): `Ready to fly?`
  - H2 (nativ): `Your next journey` `<em>starts here</em>`
  - P: `Speak with a private aviation expert and receive your tailored quote within minutes. No commitment, no obligation.`
- **CTA-uri:**
  - `Request quotes`: code component `InquireButton` (`variant: unstyled`, props `from:""`, `to:""`), slot = componenta Webflow `Request quotes custom text` (`div.button`, `data-wf--request-quotes-custom-text--variant="base"`). Fără href; fără atribut PostHog.
  - `+41 22 782 12 12` → `tel:+41227821212` (`a.button is-secondary is-stroke is-icon w-button`, fundal alb; clasa `is-icon` fără icon).
- Plasarea în afara `<main>` (pe Why era în interior) scoate CTA-ul din landmark-ul principal.

### 3.13 Navbar / Footer

Identice cu Why/About; diferențe: `w--current` + `aria-current="page"` pe „Private jet charter” (top) și „On-demand jet charter” (mega-meniu), iar selectoarele de limbă (meniu mobil + footer) indică slug-urile acestei pagini. Bara sticky mobilă e acum **în hero** (în `request_component-dynamic`), nu la finalul body-ului.

---

## 4. Formulare

### 4.1 Formular de cerere zbor (hero) — code component `RequestFlight`

- **Element:** `div.text-color-primary` › `div.request_component-dynamic` › `div.request-flight-anchor#req-always` (`position: relative`) › `div.request-flight-wrapper` (bordură `--stroke`, radius 2px, fundal `#fff9`, padding 2rem / 1.5 ≤991 / 1.25 ≤767) › `<code-island>`:
  - loader FEDERATION: `clientModuleUrl https://code-components.website-files.com/6aa95b0fa3ce966b2c9a5943%2Fmodule%2Fwf-manifest.json`, `moduleId _6aa95b0fa3ce966b2c9a5943`, **`submoduleId RequestFlight`** (librăria `lunajets-library`);
  - `data-props='{"from":"","to":"","requestFlight":0}'`, `data-hydrate="true"`, `data-webflow-context='{"mode":"publish","interactive":true,"locale":"en"}'`;
  - SSR: `<div data-root="true" data-ssr-error="true">` **gol** (randarea pe server a eșuat; aceeași eroare apare și pe homepage). CSS inclus în template: `…/css/tags.2e0bba141.css` (doar normalize Webflow, 4.8KB).
- **Câmpuri:** **neinspectabile**: `code-components.website-files.com` este blocat de proxy (CONNECT 403), iar SSR-ul nu conține markup. Din context se deduc doar: props `from` / `to` (aeroport/oraș plecare-sosire, precompletabile din pagini de destinație/rută), flag `requestFlight` (0 = închis; `?requestFlight=1` din JSON-LD `ReserveAction` deschide probabil formularul), iar textul paginii menționează `route, dates, number of passengers, and any specific requirements` și `choose your route and departure time`.
- **Spațiu rezervat:** 187px ≥991, 430px sub 991 (stil în head) ⇒ pe desktop formularul e o bară orizontală compactă, pe mobil un formular vertical.
- **Comportament vizibil:** fără JS, caseta rămâne goală (vezi `old-pjc-1440-hero.jpg`, `old-pjc-390-hero.jpg`). Nu există fallback (link `/en?requestFlight=1`, telefon) în caz de eroare a code component-ului.
- Endpoint, validare, reCAPTCHA (badge ascuns global), tracking: necunoscute (bundle React neaccesibil).

### 4.2 Alte puncte de conversie

- `InquireButton` × 4 în pagină: navbar (PostHog `header`), meniu mobil (`mobile_menu`), bara sticky din hero (**fără** atribut PostHog; pe About avea `fixed_bottom_mobile`), CTA final (fără atribut PostHog).
- WhatsApp în bara sticky (`https://api.whatsapp.com/send?phone=41793311212`, `aria-label="Contact LunaJets on WhatsApp"`, clasa `ph_whatsapp`).
- `tel:+41227821212` în CTA final.
- Newsletter (footer): identic.
- **Niciun `<form>` / `w-form` nativ Webflow în main.**

---

## 5. Interacțiuni, CMS, custom code

### 5.1 Interacțiuni

| Element | Tip | Detalii |
|---|---|---|
| FAQ | `<details>/<summary>` nativ + CSS + JS mic | Toate cele 4 `details` au atributul **`open`** ⇒ implicit **toate deschise**. Animație CSS `::details-content` (block-size 300ms, `transition-behavior: allow-discrete`), iconul se rotește 180° pe `[open]`, focus ring `#1a73e8`. Script: la `toggle` setează `aria-expanded` pe `summary`. ⚠️ `aria-expanded="false"` în HTML deși item-urile sunt deschise; ⚠️ toate cele 4 panouri au **același id `lj_accordion-panel-1`**, iar `aria-controls` indică `lj_accordion-panel-2..4` (inexistente); `role="region"` + `aria-labelledby` corecte; H3 în `summary`. |
| Slider destinații | **Swiper 12** (`https://cdn.jsdelivr.net/npm/swiper@12/swiper-bundle.min.js`, încărcat global, și pe Why) + script de init al paginii | `slidesPerView:"auto"`, `speed:300`, `mousewheel.forceToAxis`, `keyboard`, `a11y` (`slideRole:'listitem'`), `navigation` `.swipper-slider_btn_element.is-next/.is-prev`, `pagination` `.swipper-slider_bullet_wrap`, `scrollbar` `.swipper-slider_draggable_wrap`. ⚠️ **Elementele de navigare/paginare/scrollbar nu există în DOM** ⇒ slider-ul se poate folosi doar prin drag/swipe/tastatură; pe desktop fără săgeți. În audit (jsdelivr blocat) `Swiper is not defined` ⇒ rând static, cardurile 6–11 ascunse de `overflow:hidden`. |
| Carduri destinație | IX2 hover (`e-1390`/`e-1391`, `data-w-id a54d778f-…`, action lists `a-113` „Destination Item [Hover Over]” / `a-114` „[Hover Out]”) | Hover: overlay `.destination-overlay` .5 → 0, textul `.destination_item-text` opacity 1 → 0, mutare -1rem pe un element țintă; hover out: revenire. Interacțiune globală (componentă/clasă), `mediaQueries: main`. |
| IX2 specific paginii | orfan | Singurele evenimente legate de page ID `687762d7…`: `e-1500`/`e-1501` (hover a-113/a-114) pe elementul `d2f3fd89-1174-edf4-d86b-5c5de7b34f9e`, **care nu mai există** în DOM ⇒ config moartă. |
| Carduri clickabile | script global `[data-lj_card_linked]`/`[data-lj_card_link]` | Benefits (card 6) și cele 8 carduri Services. |
| Bara sticky mobilă | script global (IntersectionObserver + MutationObserver) | Aici **activă**: găsește `.request-flight-anchor#req-always`, adaugă `.is-always` pe `.request_flight-sticky` (pe ≤991 `translateY(100%)`), și o afișează doar după ce formularul din hero iese din viewport. |
| Tabele | CSS | `thead.h-table_sticky` sticky la `top: 4.75rem` pe ≤767. |
| Hover CSS | — | underline pe `link_card.under:hover` (titluri servicii), `button.is-link.is-icon:hover`. |
| **Nu există** | — | tabs, counters animate (cifrele hero sunt text), Lottie, GSAP, video, scroll-reveal. |

### 5.2 CMS

| Listă | Colecție (dedusă) | Item-uri afișate | Câmpuri folosite | Note |
|---|---|---|---|---|
| Top trending destinations (`swipper-slider_cms_wrap.w-dyn-list`) | **Destinations** (template `/en/private-jet-charter/fly-to-*`, 347 item-uri EN în sitemap) | **11** | name (oraș), country (text/referință), image (alt din CMS), `title` img = „Private Jet from / to {name}”, slug | Filtru/sortare necunoscute (probabil un switch „trending” + ordine manuală). Slug-uri localizate (`/fr/location-de-jet-prive/volez-vers-paris`). |
| Our Offices (footer) | Offices | 7 | identic About | + 7 × JSON-LD LocalBusiness |
| `.w-dyn-list` după footer | (Schema/Organization) | 1 | embed JSON-LD | identic |
| `.schema.w-dyn-list` #1 | Schema/SEO per pagină | 1 | embed JSON-LD `WebPage` | |
| `.schema.w-dyn-list` #2 | Schema/SEO per pagină (al doilea item/colecție) | 1 | embed JSON-LD `Product` | **nou** față de About/Why |

- Tot restul (servicii, FAQ, tabele, pași, beneficii) este **static** în pagină. Colecția **Routes** (`fly-between-*`, 164 EN) folosește același prefix de URL, dar nu e listată aici.

### 5.3 Custom code specific paginii

- `<style>` în `compare-section` #2 (responsive tabel):
  `@media screen and (max-width: 767px) {.p-table_row{ grid-template-columns: repeat(3, minmax(0, 1fr)); }.p-table_row._4column{ grid-template-columns: minmax(0, .75fr) minmax(0, 1fr) minmax(0, 1fr); }.p-table_row-content{ min-width: 0; overflow-wrap: break-word; }}`
- `div.hide.w-embed.w-script` în FAQ: CSS accordion (`::-webkit-details-marker` ascuns, focus-visible, `::details-content` transition, rotire icon) + scriptul `aria-expanded`.
- Script init Swiper (după footer, vezi §5.1).
- Restul embed-urilor din body sunt identice cu Why. Finsweet Attributes: aici există atribute `fs-table-*` (3 instanțe, **toate cu același `fs-table-instance="fs-table-1"`**).

---

## 6. Linkuri interne din `<main>` (+ CTA final)

| Secțiune | Anchor | href | Status |
|---|---|---|---|
| Hero (sticky) | WhatsApp (icon, aria-label) | `https://api.whatsapp.com/send?phone=41793311212` | extern |
| Pricing | `Go to the pricing dedicated page` | `/en/prices` | 200 |
| Benefits | `Discover all the reasons why clients fly with us` | `/en/why-lunajets` | 200 |
| Services | `Last minute charter` | `/en/private-jet-services/last-minute-flights` | 200 |
| Services | `Helicopter charter` | `/en/private-jet-services/helicopter-flights` | 200 |
| Services | `Emergency charter` | `/en/private-jet-services/emergency-charter` | 200 |
| Services | `Group charter` | `/en/private-jet-services/group-charter` | 200 |
| Services | `Leisure charter` | `/en/private-jet-services/leisure-charter` | 200 |
| Services | `Cargo charter` | `/en/private-jet-services/cargo-charter` | 200 |
| Services | `Corporate charter` | `/en/private-jet-services/corporate-charter` | 200 |
| Services | `Corporate events` | `/en/private-jet-services/corporate-events` | 200 |
| Compare FCP | `More about the Frequent Charter Program` | `/en/frequent-charter-program` | 200 |
| Destinations | `View all destinations` (×2: desktop + tablet/mobil) | `/en/destinations` | 200 |
| Destinations | 11 carduri (`France Paris` …) | `/en/private-jet-charter/fly-to-{paris,london,nice,ibiza,milan,madrid,new-york,geneva,zurich,palma,dubai}` | 200 (toate) |
| CTA final | `+41 22 782 12 12` | `tel:+41227821212` | — |

- **Inbound:** Why LunaJets (`Discover On-Demand Charter`, `Other examples of charter solutions` cu ancora ruptă), homepage (card-uri `data-lj_card_link`), navbar (`Private jet charter`, `On-demand jet charter`).
- **Lipsesc** linkuri contextuale spre: `/en/prices` e prezent doar în EN (secțiunea pricing e ascunsă în restul limbilor), pagina FAQ completă, empty legs, jet comparator / categorii de aeronave (menționate în Benefits: turboprops, light, midsize, heavy, ultra-long-range), cele 7 sub-pagini de servicii de nivel 2 (`corporate-charter/*`, `leisure-charter/*`).
- Niciun `href="#"` în main ✅.

---

## 7. Iconuri salvate (`assets/old-icons/`)

| Fișier | Folosire | viewBox | Culoare |
|---|---|---|---|
| `00-arrow-right.svg` | toate CTA-urile `is-link`/`is-stroke` (11×) | 0 0 20 20 | `currentColor` ✅ (identic cu `why-lunajets/assets/old-icons/00-arrow-right.svg`, diferă doar whitespace) |
| `01-whatsapp-global.svg` | bara sticky (global) | 0 0 20 20 | `currentColor` |
| `02-argus-badge.svg` | Benefits 1 | 0 0 32 32 | `#061d38` hardcodat |
| `03-aircraft-network.svg` | Benefits 2 | 0 0 49 49 | `#061d38` + `#fff` |
| `04-advisor-card.svg` | Benefits 3 | 0 0 49 49 | `#061d38` |
| `05-contract-magnifier.svg` | Benefits 4 | 0 0 44 40 | `#061d38` |
| `06-network-nodes.svg` | Benefits 5 | 0 0 49 49 | `#061d38` |
| `07-palm-tree.svg` | Travellers 1 | 0 0 60 65 | `#fff` |
| `08-briefcase.svg` | Travellers 2 | 0 0 49 55 | `#fff` |
| `09-globe-plane.svg` | Travellers 3 | 0 0 59 59 | `#fff` (7.5KB, cel mai greu) |
| `10-chevron-down-faq.svg` | FAQ (4×) | 0 0 24 24 | `currentColor` |

Niciun SVG decorativ nu are `aria-hidden="true"`. ViewBox-uri neomogene ⇒ de normalizat la rebuild (`currentColor`, 24/32 grid).

---

## 8. Note pentru migrare

### 8.1 Probleme găsite pe pagina veche

**SEO / conținut**
1. **Ancoră ruptă (cerută de Why LunaJets):** `#special-private-jet-charter` nu există pe această pagină în nicio limbă; ținta logică e `section.section_special-jet` („Charter services for every need”).
2. JSON-LD: `&amp;` literal în `name` (WebPage + Product); `speakable` țintește `.speakable`, inexistent pe pagină; `Product` doar cu `aggregateRating` al organizației (risc de politică, fără `offers`/`brand`); fără `BreadcrumbList`/`Service`.
3. `og:url` și `twitter:site` lipsesc (twitter:image există aici ✅).
4. Secțiunea de prețuri (singurul conținut cu cifre de preț, bun pentru intenția „private jet charter cost”) **există doar în EN**; de decis dacă rămâne ascunsă în FR/DE/IT/ES/RU/HU/PL.
5. H1 și H2-urile sunt HTML Embed-uri (greu de editat/localizat în Designer; ușor de stricat). `text-transform: capitalize` global schimbă textul afișat („A”, „Vs”, „Of”, „To”).
6. Redactare: `Why flying private with us` (gramatică); `480+ certified operators` vs `4,800+ aircraft` (ok, dar ușor de confundat); `two decades` (fondată dec. 2007 ⇒ ~19 ani); `Private Jet Advisors` vs `Private Aviation Advisor`; `Last minute charter` vs `Last-Minute Flights`; US/UK amestecat (`program`/`programme`, `Specialized`/`personalisation`); `Depends`/`Depending on share`; capitalizare H3 inconsistentă.
7. Conținut tabel ambiguu (`Taxi time: Yes`, `Change of aircraft category: Yes`, `Annual dues: None` la membership).
8. Pagina FAQ completă și sub-serviciile de nivel 2 nu sunt legate; `View all destinations` dublat (desktop/mobil).
9. Alt-uri problematice: fundal Travellers (descrie aripă/coadă, imaginea arată ușa unui avion), Ibiza („Baltic island of Formentera”), `helicopter for…` fără majusculă; aceeași imagine last-minute cu alt diferit față de Why.

**Accesibilitate**
10. FAQ: toate panourile deschise implicit, dar `aria-expanded="false"`; id duplicat `lj_accordion-panel-1` ×4; `aria-controls` spre id-uri inexistente.
11. Formularul principal (hero) depinde 100% de un code component cu `data-ssr-error="true"`: fără JS/la eșec rămâne o casetă goală, fără fallback.
12. CTA final în afara `<main>`; `div.section_top_destinations` nu e `section`; pașii procesului nu sunt `<ol>`.
13. `4.8 ★` (caracter citit ca „black star”); SVG-uri decorative fără `aria-hidden`; textul linkurilor destinație „France Paris” fără context; Swiper fără butoane prev/next (doar drag/tastatură).
14. Tabelele: bune (`<table>`, `<caption>` sr-only la pricing, `th`), dar prima celulă a antetului e goală și ascunsă pe mobil; tabelele comparative nu au `<caption>` și nici `scope`.

**Performanță**
15. Swiper 12 încărcat global din jsdelivr (și pe pagini fără slider); jQuery + IX2 doar pentru hover-ul cardurilor de destinație.
16. Imagini: 5 fără `sizes` (emergency 400×290 upscalat, Milan, New York, Palma, Dubai); hero 1440px (ok, eager ✅). Restul lazy + webp ✅. Pagina e lungă (12.3k px desktop, 19.9k mobil).
17. Aceleași probleme globale ca pe About/Why (CookieYes sincron, code components pentru butoane, fonturi).

**Client-First / structură**
18. Prefixe `dp_`/`dm_` amestecate, `stem_`/`swipper-` typo, `testimonial41_*` Relume refolosit pentru destinații, `table_4col` pe tabel cu 3 coloane, combo-uri fără `is-`, wrapper gol `max-width-479px`, IX2 orfan (`e-1500/1501`), 3 instanțe `fs-table-1` cu același nume, `lower_wrapper` cu `space-around` (titluri nealiniate).

### 8.2 Candidați de reutilizare (clase deja create pe site-ul nou)

Sursa: `../about/04-build-log.md` și `../why-lunajets/04-build-log.md`.

| Bloc vechi (PJC) | Clasă nouă de refolosit | Ce trebuie adăugat |
|---|---|---|
| Eyebrow-uri (`tag is-text is-icon` ± `tag-line`, alb/navy) | `tagline_component` / `tagline_line` / `tagline_text` (+ `is-reverse` pe fundal închis, din Why) | variantă fără linie (CTA final) dacă nu există |
| Titluri cu a doua linie italic (`span.block.text-style-italic`) | tag `h1`/`h2` native + `<em>` (pattern About/Why) | — (renunțare la HTML Embed) |
| Hero cu foto full-bleed + overlay + 4 stats | `stats_list` / `stats_*` (About, 4 cifre) | secțiune nouă `section_pjc-hero` (bg image + overlay navy, ca `press_card` 85%); slot pentru formular. `why-hero_*` **nu** se potrivește (Why nou are hero split cu imagine) |
| Formular RequestFlight în hero | — | decizie: code component existent (dacă librăria se poate instala pe site-ul nou) sau CTA `button` → `/en?requestFlight=1` (D12 din Why) ca fallback |
| Fly private (split imagine stânga + text) | `split_component` (About; varianta cu imaginea în stânga) sau `card-split_component` (Why) | badge absolut „35 min” (clasă nouă mică, ex. `split_badge`) |
| Process (4 pași numerotați, navy) | `services_list` / `services_card` (fundal navy) ca schelet | clasă nouă `process_list` (`ol`) / `process_item` / `process_number`; sau `services_card.is-quarter` |
| Benefits (5 carduri bordate icon + H3 + P + card link crem) | `services_card` (icon + titlu, `services_icon-embed` currentColor) + `card-split_content` (bordură `Border Color/primary`, radius) | variantă pe fundal deschis (bordură, text navy) + descriere; cardul link crem = `tailored_card-content` fără imagine (Why, card 4) |
| Travellers (3 coloane pe navy, separatoare, foto 20%) | `services_list` + `services_card.is-third` (Why) | fundal cu imagine la 20% (one-off), separatori verticali 1px `Border Color/on dark` |
| Charter services (8 carduri: imagine + H3 link + P + „Learn more”) | `group_list` / `group_card` (About: imagine 3:2 + h3 + text + link) sau `tailored_card*` (Why: card-link întreg) | grilă 3 col cu 8 item-uri (sau 4×2); card întreg link (pattern `tailored_card-content`), `button_sr-text` pentru „Learn more”; **`id="special-private-jet-charter"` pe secțiune** |
| Pricing (text + tabel 2 col + link) | `split_component` + `button is-link is-icon` / `button_icon` | clasă nouă de tabel (`table_component`, `table_row`, `table_cell`, `is-highlight`), partajată cu cele 2 tabele comparative și cu pagina Prices |
| Tabele comparative (3 și 4 coloane, coloană LunaJets evidențiată) | — | aceleași clase `table_*` + combo `is-3col`/`is-4col`, `caption`, `th scope` |
| FAQ (`details`) | — (nu există încă pe site-ul nou) | componentă nouă `faq_list` / `faq_item` / `faq_question` / `faq_answer` / `faq_icon` (details nativ, id-uri unice, JSON-LD FAQPage sau microdata) — va fi refolosită pe multe pagini |
| Destinații (slider CMS) | — | colecția Destinations nu există încă pe site-ul nou (cele 4 colecții vechi au fost șterse); secțiune nouă, slider (Swiper self-hosted sau scroll-snap CSS) cu butoane prev/next |
| CTA final (gradient, centrat, 2 butoane) | gradientul `section_about-services` (valoare one-off), `button` / `button is-secondary` / `button is-alternate`, `button_icon` | secțiune/componentă globală `section_cta` refolosibilă (pe vechiul site e componentă cu variante) |
| Butoane `is-link is-icon`, `is-secondary is-stroke is-icon` | `button is-link is-icon`, `button is-secondary is-icon` + `button_icon`, `button_sr-text` | — |
| Navbar, Footer, Our Offices, JSON-LD Organization/WebSite | componentele globale `Navbar` / `Footer` | JSON-LD `WebPage` (+ eventual `Service`, `FAQPage`, `BreadcrumbList`) pentru pagină |

### 8.3 Recomandări pentru rebuild (sumar)
- Păstrează slug-ul `private-jet-charter` și cele 8 slug-uri localizate (sunt și prefix pentru ~511 × 8 pagini CMS); canonical + hreflang; adaugă `og:url`.
- Adaugă `id="special-private-jet-charter"` pe secțiunea „Charter services for every need”.
- JSON-LD: `WebPage`/`Service` fără `&amp;`, `speakable` doar dacă există clasa, reconsideră `Product` + rating; FAQPage consecvent (un singur format).
- Headings native (nu embed); fix gramatical `Why fly private with us`; uniformizare terminologie (Private Aviation Advisor, on-demand, last-minute, UK English).
- FAQ accesibil (id-uri unice, stare `aria-expanded` corectă sau doar `details` nativ fără ARIA suplimentar) + link spre pagina FAQ completă.
- Formularul din hero: decizie tehnică + fallback vizibil; tracking PostHog uniform pe toate CTA-urile.
- Tabele: un singur sistem de clase, `caption` + `scope`, layout mobil testat la 390.
- De confirmat cu clientul: secțiunea pricing doar în EN, „two decades”, conținutul ambiguu din tabelul comparativ, `4.8 ★` (sursă), 182+ țări, imaginea cu brand Kiehl's, alt-urile greșite.

---

## Ce nu a putut fi accesat

| Resursă | Motiv / efect |
|---|---|
| Chromium direct spre site (TLS) | Browserul nu are CA-ul proxy-ului; randarea s-a făcut cu `page.route` + `route.fetch` (Node, `NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt`). TLS verificat, nimic dezactivat. |
| `code-components.website-files.com` | CONNECT 403 (egress policy): **formularul `RequestFlight` din hero nu a putut fi randat/inspectat** (câmpuri, validare, endpoint necunoscute; SSR gol cu `data-ssr-error="true"`). Nici `InquireButton`/Newsletter nu au CSS/JS. |
| `cdn.jsdelivr.net` (Swiper 12, Finsweet Attributes, fs-components) | 403: slider-ul de destinații neinițializat (`Swiper is not defined`); comportamentul real (drag, loop) dedus din scriptul de init. |
| `d3e54v103j8qbb.cloudfront.net` (jQuery) | 403: runtime Webflow/IX2 nu a rulat (`s is not a function`); interacțiunile IX2 au fost verificate static în bundle-ul `schunk.3580ad529cd355f6.js`. |
| `cdn-cookieyes.com` | 403: banner cookie nerandat. |
| `www.googletagmanager.com` (GTM-TRDGMCLS) | 403: tag-urile din container neverificate. |
| `web.archive.org` | 403 (încercat pentru o versiune randată a formularului). |
| Webflow Designer / CMS API | Nefolosit (audit strict read-only pe site-ul live): numele exacte ale colecțiilor, câmpurile și filtrul listei „trending” sunt deduse din HTML și sitemap. |
