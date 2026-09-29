# 01 — Audit pagina veche „About us” (LunaJets)

> **Etapa:** 01, audit read-only al paginii existente, înainte de rebuild în Webflow (Finsweet Client-First).
> **Data auditului:** 2026-09-29
> **Pagina țintă:** https://www.lunajets.com/en/about-us (HTTP 200, `x-wf-locale: en`, servită prin Cloudflare, `cf-cache-status: HIT`)
> **Ultima publicare (comentariu HTML):** `Last Published: Tue Sep 29 2026 12:20:50 GMT+0000`
> **Webflow:** site ID `67c72c8a3c305a53672bdcca` (shortName `www-lunajets`), page ID `68e8ee174a83e3b879479a1d`. Asset-urile CMS sunt găzduite sub un alt ID: `67c734771b96932daef1ebc6`. `data-wf-intellimize-customer-id="117515353"` (Webflow Optimize / Intellimize).
> **Surse folosite:** HTML brut (`curl`), CSS-ul publicat (`www-lunajets.shared.348a00619.min.css`), DOM randat + screenshot-uri (Playwright/Chromium).
> Textele verbatim sunt păstrate în limba originală, între backticks sau în blocuri de citat.

## Screenshot-uri (`/home/user/IDS/migration/about/old-screenshots/`)

| Fișier | Conținut |
|---|---|
| `old-about-1440-full.jpg` | Pagina completă, desktop 1440 (înălțime 7431px) |
| `old-about-991-full.jpg` | Pagina completă, tabletă 991 (10147px) |
| `old-about-390-full.jpg` | Pagina completă, mobil 390 (10796px) |
| `old-about-1440-navbar-megamenu-why.jpg` | Navbar desktop cu mega-meniul „Why LunaJets” deschis |
| `old-about-390-mobile-menu.jpg` | Meniul mobil deschis (burger) |

> Note despre capturi:
> - La 991 și 390, bara fixă de jos (`request_flight-sticky`) apare **în mijlocul** capturii full-page. Este un artefact al capturii (element `position: fixed`), nu un bug de layout.
> - Nu a apărut niciun banner de cookie: scriptul CookieYes a fost blocat de proxy (vezi „Ce nu a putut fi accesat”). Nu am avut ce închide.
> - Componentele de cod (React, „code-components”) au rămas fără CSS-ul lor, deci formularul de newsletter din footer apare nestilizat. Butoanele „Request quotes” au fost afișate prin fallback-ul SSR.

---

## Verificarea contextului din placeholder-ul anterior

Placeholder-ul anterior (blocat de rețea) conținea date neverificate, luate din indexul motorului de căutare. Iată ce confirmă pagina live:

| Afirmație din placeholder | Pe pagina live |
|---|---|
| Titlu `About LunaJets - Private Jet Charter Broker` | ✅ Confirmat (`<title>`, og:title, twitter:title) |
| „7 vs 8 birouri” | Pagina spune **7**: statistica `7` / `Offices across Europe & Middle East`, iar lista CMS „Our Offices” are 7 birouri (Geneva, London, Zurich, Paris, Dubai, Madrid, Riga). Și JSON-LD are 7 `LocalBusiness`. **Figma spune 10**, deci trebuie confirmat cu clientul. |
| „60+ vs 100+ angajați”, „15 languages” | **Nu apar deloc** pe pagina about-us: nici număr de angajați, nici număr de limbi. Proveneau din alte pagini sau surse. JSON-LD enumeră 13 limbi la `availableLanguage`. |
| Fondată în dec. 2007 | Doar în JSON-LD (`"foundingDate": "2007-12"`). Textul vizibil spune `in Geneva in 2007`. |
| 2025: 12.000+ zboruri, 180m€ | ✅ `In 2025, LunaJets has organised over 12,000 flights and surpassed 180m€ in revenue…` + statisticile `12,000+` / `flights organised in 2025`, `180m€` / `2025 revenue` |
| 4.800+ aeronave | ✅ `4,800+` / `aircraft in our network` |
| Eymeric Segard fondator, Guillaume Launay CEO | Numai în alt-ul unei imagini și (Segard) în JSON-LD, nu în textul vizibil |
| Primul broker european cu ARGUS, SAF | ✅ Secțiunea „Certifications & Standards” |

---

## 1. URL, locale / hreflang, canonical

- **URL:** `https://www.lunajets.com/en/about-us`
- **Canonical:** `<link href="https://www.lunajets.com/en/about-us" rel="canonical"/>` ✅ (self-referencing)
- **`<html lang="en">`**
- **hreflang** (din `<head>`; aceleași URL-uri apar în selectoarele de limbă din meniul mobil și din footer):

| hreflang | URL |
|---|---|
| `x-default` | https://www.lunajets.com/en/about-us |
| `en` | https://www.lunajets.com/en/about-us |
| `fr` | https://www.lunajets.com/fr/a-propos |
| `de` | https://www.lunajets.com/de/uber-uns |
| `it` | https://www.lunajets.com/it/chi-siamo |
| `es` | https://www.lunajets.com/es/quienes-somos |
| `ru` | https://www.lunajets.com/ru/o-nas |
| `hu` | https://www.lunajets.com/hu/rolunk |
| `pl` | https://www.lunajets.com/pl/o-nas |

- **Arhitectură:** Webflow Localization cu subdirectoare (`/en/`, `/fr/`…) și **slug-uri localizate** per limbă (`a-propos`, `uber-uns`…). Noul site trebuie să păstreze exact aceste slug-uri, altfel e nevoie de 8 redirect-uri 301.
- Status HTTP-ul variantelor non-EN nu a fost verificat individual (vezi „Ce nu a putut fi accesat”).

## 2. SEO

| Element | Valoare (verbatim) |
|---|---|
| `<title>` | `About LunaJets - Private Jet Charter Broker` |
| `meta description` | `As Europe's first Argus Certified broker, we provide tailored private aviation solutions and 24/7 support, grounded in excellence and discretion.` |
| `og:title` | `About LunaJets - Private Jet Charter Broker` |
| `og:description` | identic cu meta description |
| `og:image` | `https://cdn.prod.website-files.com/67c72c8a3c305a53672bdcca/6967c245a46d151df6b672c6_lunajets-geneva-headquarters-office-3.webp` |
| `og:type` | `website` |
| `og:url` | **lipsește** |
| `twitter:card` | `summary_large_image` |
| `twitter:title` / `twitter:description` / `twitter:image` | identice cu cele OG |
| `twitter:site` | lipsește |
| `meta robots` | **absent**, deci implicit index,follow |
| `google-site-verification` | `APbi_VQdqa_wmu3GGmRk-89eggnCEv8W6nW2Wsfod5M` |
| Favicon | `…/68f10e99e6700f84eac5184d_favicon-2.png`; apple-touch-icon `…/68f10740521da7a4b5d08bac_2427baba738d8b4f2e1fc8eaffbb8777_lunajets-logo-blue-square.png` |

### 2.1 Date structurate (JSON-LD)

Nu există JSON-LD în `<head>`. Există **9 blocuri** `application/ld+json` în `<body>`, toate generate prin embed-uri în liste CMS:

1–7. **`LocalBusiness`**, câte unul per birou, în embed-ul fiecărui item din lista „Our Offices” din footer. `@id` are forma `https://www.lunajets.com/lunajets-<oraș>#localBusiness`. Câmpuri: `name`, `url` (pagina contact a orașului), `image`, `sameAs` (Google Maps), `address` (PostalAddress), `openingHoursSpecification` (Mo–Su 00:00–23:59), `geo`, `telephone`, `email` (`geneva@lunajets.com`, `london@`, `zurich@`, `paris@`, `dubai@`, `madrid@`, `riga@`), `parentOrganization → #organization`.
8. **`@graph`** cu:
   - **`Organization`** `https://www.lunajets.com/#organization`:
     - `name` `LunaJets`, `legalName` `LunaJets S.A.`, `foundingDate` `2007-12`, `founders` Eymeric Segard (LinkedIn);
     - `description`: `Founded in 2007, LunaJets is the leading independent private jet booking platform, offering private jet charter solutions across the globe with 24/7 expert service, competitive rates, and access to over 4,800 aircraft.`;
     - `aggregateRating` 4.8/5, `reviewCount` 2302;
     - adresă: 29 Rue Lect, 1217 Meyrin, Geneva, CH;
     - 3 × `contactPoint` (sales / customer support / reservations, +41 22 782 12 12, 13 limbi: en, fr, de, it, es, ru, hu, pt, ar, tr, lv, ro, nl);
     - `sameAs`: Maps, Instagram, YouTube, LinkedIn, Facebook, X;
     - `knowsAbout` (9 servicii); `potentialAction` ReserveAction → `https://www.lunajets.com/en?requestFlight=1`;
     - `memberOf`: The Air Charter Association, (ARGUS, EBAA, NBAA, MEBAA);
     - `subOrganization`: cele 7 `LocalBusiness`.
   - **`WebSite`** `https://www.lunajets.com/#website`.
9. **`AboutPage`** `https://www.lunajets.com/en/about-us#aboutpage`: `name` = title, `description` = meta description (cu entitatea `&#39;` **dublu-escape-uită** în JSON), `speakable` → `cssSelector [".speakable"]`, `inLanguage: en`, `isPartOf #website`, `about #organization`.

> Blocurile 8 și 9 provin din două `w-dyn-list` ascunse, plasate după footer (`.w-dyn-list` și `.schema.w-dyn-list`, `role="none"`). Schema este gestionată din CMS.
> Clasele `speakable` / `speakable-2` de pe paragrafe țintesc `SpeakableSpecification`. Doar `.speakable` este referită în JSON-LD; `speakable-2` nu este.

### 2.2 Outline headings (ordinea din DOM)

```
H1  About LunaJets                                   (h1.heading-style-h1, „LunaJets” în <em>)
H2  A European leader / since 2007                   (<br>, „since 2007” în <em>)
H2  A Global Reach Mixed with a Local Expertise
H2  Backed by a Deep Industry Knowledge
H2  A Dedicated Team Committed to Excellence
H2  High-end / ‍Quality Service                      (conține caracter U+200D zero-width joiner!)
  H3  24/7 worldwide
  H3  Dedicated private advisor
  H3  Support in multiple languages
  H3  Car and helicopter transfers
  H3  VIP concierge service
H2  Delivered with Swiss Excellence                  (h2 fără clasă)
  H3  LunaJets
  H3  LunaGroup Charter
  H3  LunaSolutions
H2  Exceeding the Highest Standards in the Industry
H2  As Featured in
  (titlurile știrilor sunt <p class="h3_news-headline">, nu headings)
--- footer ---
H2  Our Offices
  H3  Geneva, Switzerland
  H3  London, United Kingdom
  H3  Zurich, Switzerland
  H3  Paris, France
  H3  Dubai, United Arab Emirates (UAE)
  H3  Madrid, Spain
  H3  Riga, Latvia
  H3  Contact us
```

- **Un singur H1** ✅. Nu există H4–H6. Mega-meniul folosește `<p class="heading-style-h3">`, deci nu poluează outline-ul ✅.
- Stilul global `h2` are `text-transform: capitalize`. De aceea pe ecran titlurile apar ca „A European Leader Since 2007”, „Delivered With Swiss Excellence”, „A Global Reach Mixed With A Local Expertise”, chiar dacă în DOM sunt scrise altfel.

---

## 3. Secțiuni (în ordinea paginii)

### Structură generală și evaluare Client-First

```
body
├─ .w-embed (global styles <style>)
├─ .page-wrapper#pt-aboutus
│  ├─ header.navbar2_component          (fixed, z-index 1000)
│  ├─ main.main-wrapper#main
│  │  ├─ section.split-content_section               → Hero
│  │  ├─ section.section_about_us_metrics            → Metrics + 3 split-uri
│  │  ├─ section.section_about_us_services.bg-color-dblue-gradient → Services
│  │  ├─ section.section_about_us_group-2            → Luna Aviation Group
│  │  ├─ section.section_about_certifications        → Standards
│  │  └─ div.section_news                            → As featured in (CMS)
│  └─ footer.footer_u#footer  (include „Our Offices” CMS + footer propriu-zis)
├─ .w-dyn-list (JSON-LD Organization)  ├─ .schema.w-dyn-list (JSON-LD AboutPage)
└─ .request_component-dynamic (code component ascuns + bara sticky mobilă)
```

**Verdict Client-First: parțial / hibrid.**
- ✅ Structura de bază CF există: `page-wrapper`, `main-wrapper`, `padding-global`, `padding-section-medium`, `container-*`, `spacer-*`, `heading-style-h1..h6`, `text-size-*`, `text-weight-*`, `text-style-*`, `max-width-*`, `icon-embed-*`, `hide-tablet`, `hide-mobile-landscape`, `form_*`, `margin-*`/`padding-*` (cu embed-ul global CF de `!important`).
- ❌ Abateri:
  - `container-medium` are `max-width: 80rem` (1280px). În CF default este 64rem, deci aici e folosit ca un `container-large`.
  - Numele secțiunilor nu respectă strict `section_[nume]` (`split-content_section`, `section_about_us_group-2` cu sufix `-2`, iar `section_news` este un `div`, nu `section`).
  - Utilitare custom cu valori în px: `max-width-364px`, `max-width-720px`, `max-width-200px`, `spacer-1-5rem`, `spacer-12px`, `spacer-0-75rem`, `max-width-31rem`.
  - Combo-uri fără prefix `is-`: `medium-no_italic`, `blue-full`, `_64px`, `_32px`, `tablet-first`, `centered`, `mobile_full`, `no-top`, `hero`, `updated`.
  - Clase cu typo (`location_lnik`, `donwload_button`, `s-nav-chervon`, `navbar_phog-wrapper`).
  - Rămășițe Relume: `navbar2_component`, `menu-icon2_*`, o variabilă `relume-variable-color-scheme-1-background` rămasă nedefinită.
  - Variabile șterse încă referite în `:root` (`--…<deleted|variable-…>`).
- **Tokens CSS existente:** `--lj-blue: #061d38`, `--lj-cream: #f4f2ef`, `--stroke: #e1e4e8`, `--gold: #9c8153`, `--_fonts---body: "Radomir Tinkov Gilroy"`, `--_fonts---heading: Vanitas`, `--accessible-components--corner-radius: 2px`.

---

### 3.0 Navbar: vezi §4.1

### 3.1 Hero: `section.split-content_section`

- **Scop:** introducere/poveste, H1, imaginea sediului.
- **Wrapper-e:** `padding-global padding-section-medium hero` › `container-medium` › `split-content_component` (grid 2 coloane, gap 4rem) › `split-content_content_left` + `split-content_image tablet-first` (pe tabletă/mobil imaginea trece **deasupra** textului).
- **Text:**
  - Eyebrow (`tag is-text is-icon` + `tag-line is-blue`): `Our journey` (afișat UPPERCASE)
  - H1: `About` + `<em>LunaJets</em>`
  - `divider _64px` (linie 64px)
  - P1: `What started as a pioneering online charter platform in Geneva in 2007 has grown, flight by flight and client by client, into one of Europe's most trusted private jet charter brokers.`
  - P2: `In 2025, LunaJets has organised over 12,000 flights and surpassed 180m€ in revenue, making it one of the fastest-growing companies in the industry.`
  - (paragrafele sunt în `p-wrapper speakable-2`)
- **CTA:** `Read our history` → `/en/why-lunajets/our-history` (`button is-tertiary is-stroke is-icon`, săgeată SVG)
- **Imagine:** `…/6a22aa9f002f0c015b5b92c5_lunajets-geneva-offices-building.webp`, alt `LunaJets geneva offices headquarters`, 800×610, `loading="eager"`, `image-cover_absolute` (object-fit cover). Rol: fotografie hero, sediul din Geneva.

### 3.2 Metrics + 3 blocuri split: `section.section_about_us_metrics`

- **Wrapper-e:** `padding-global padding-section-medium no-top` › `container-medium` › `about_us_metric_component`
- **Header:**
  - Eyebrow: `Built on trust. Driven by excellence.`
  - H2 (`max-width-364px`): `A European leader` `<br>` `<em>since 2007</em>`
  - P (`max-width-720px`): `A market leader by every measure that matters: flight volume, revenue, and the breadth of clients we serve, year after year.`
- **Statistici** (`hero_stats-wrapper` › `divider blue-full` sus și jos › `hero-stats_wrapper _4col` › 4 × `stats_item`). Numărul este `p.stats_number.medium-no_italic` (Vanitas 3.25rem), sufixul un `<sub class="text-size-medium">`, eticheta `p.tag.is-text`:

| Număr | Sufix | Etichetă (verbatim) |
|---|---|---|
| `12,000` | `+` | `flights organised in 2025` |
| `180` | `m€` | `2025 revenue` |
| `7` | — | `Offices across Europe & Middle East` |
| `4,800` | `+` | `aircraft in our network` |

  Numerele sunt text static: fără counter animat și fără `data-format`.
- **Split 1** (`split-content_component centered`; text stânga, imagine dreapta):
  - H2: `A Global Reach Mixed with a Local Expertise`
  - P1 (cu 7 linkuri inline): `Our offices are strategically located across Europe and the Middle East, with a spread going from [Madrid](/en/contact-us/madrid-spain) to [Dubai](/en/contact-us/dubai-uae). Headquartered in [Geneva](/en/contact-us/geneva-switzerland), we are also present in [Paris](/en/contact-us/paris-france), [London](/en/contact-us/london-uk), [Zurich](/en/contact-us/zurich-switzerland) and [Riga](/en/contact-us/riga-latvia).`
  - P2: `This local presence reflects our commitment to always being close to our clients, offering on-the-ground regional expertise as well as cultural and linguistic proximity.`
  - CTA: `View all local offices` → `/en/why-lunajets/our-locations`
  - Imagine: `…/6a22ab3d0c94eddbfb6d802c_geneva-lake-view-water-jet.webp`, alt `Aerial view of Geneva Lake with a large water fountain jet and many boats docked in marina.`, 640×480, lazy
- **Split 2** (imagine stânga, text dreapta):
  - Imagine: `…/6a22abb26352f6578604503c_eymeric-segard-founder-and-guillaume-launay-ceo.webp`, alt `Eymeric Segard and Guillaume Launay sitting on a chair, in LunaJets Geneva office`, 640×480
  - H2: `Backed by a Deep Industry Knowledge`
  - P: `United by a passion for operational excellence and a strong focus on the client above all, LunaJets management team offers a comprehensive expertise in private aviation.`
  - CTA: `Discover our management` → `/en/why-lunajets/global-management`
- **Split 3** (text stânga, imagine dreapta):
  - H2: `A Dedicated Team Committed to Excellence`
  - P: `Our private aviation advisors are available 24/7 to support every aspect of your journey and match all your expectations wherever you are.`
  - CTA: `Meet our team` → `/en/why-lunajets/our-team`
  - Imagine: `…/6a2271d7d71a894e5b054378_lunajets-private-aviation-advisors-checking-flight-routes.webp`, alt `LunaJets private aviation advisors checking flight routes`, 640×480
- Toate CTA-urile: `button is-tertiary is-stroke is-icon mobile_full` (pe mobil au lățime completă).

### 3.3 Services: `section.section_about_us_services.bg-color-dblue-gradient`

- **Fundal:** `linear-gradient(150deg, #020c18, #061d38 28%, #0c2847 66%)`, text alb.
- **Wrapper-e:** `padding-global padding-section-medium` › `container-medium` › `about_us_services_content` › `about_us_services_wrapper` (grid 5 coloane, gap 1.5rem; 2 coloane pe tabletă) › 5 × `about_us_service_grid_item`
- **Card:** border 1px `--stroke`, fundal `#f4f2ef0a`, radius 2px, padding 1.5rem, min-height 15rem. Icon SVG inline (`about_us_service-icon w-embed`) + `h3.text-color-white.text-size-large`.
- **Text:**
  - Eyebrow (`tag-line` alb): `Our promise`
  - H2 (`max-width-384px`): `High-end` `<br>` `‍` (U+200D) `<em>Quality Service</em>`
  - Carduri (H3): `24/7 worldwide` · `Dedicated private advisor` · `Support in multiple languages` · `Car and helicopter transfers` · `VIP concierge service`
- **Iconuri:** 5 SVG inline cu viewBox-uri diferite (0 0 33 31, 30 30, 27 27, 50 36, 27 27), deci dimensiuni inconsistente.
- **CTA:** niciunul. **Imagini:** niciuna.

### 3.4 Luna Aviation Group: `section.section_about_us_group-2`

- **Wrapper-e:** `padding-global padding-section-medium` › `container-medium` › `about_us_group_component` › `about_us_group-content` (grid 3 col, gap .5rem; 1 col pe mobil) › 3 × `a.div_group-intro` (card-link întreg: border `--stroke`, radius 2px, padding 2rem, flex column)
- **Text:**
  - Eyebrow: `The Luna Aviation Group`
  - H2 (fără clasă): `Delivered with Swiss Excellence`
  - P (`.speakable`): `Whatever brings you to private aviation (a last-minute business trip, a milestone celebration, a complex group movement, or the purchase of your own aircraft), there is a Luna Aviation Group company built precisely for that need. LunaJets handles your charter flights, LunaGroup Charter specialises in large-scale group travel, and LunaSolutions guides you through aircraft acquisition and ownership. One group, three expert teams, every journey covered.`
- **Carduri** (fiecare are: monogramă SVG inline `lj_monogram blue about`, 80px → H3 `heading-style-h3 text-style-allcaps` → `divider grey full-width` → P → CTA opțional):

| # | H3 | Descriere (verbatim) | CTA (div, nu link separat) | href card |
|---|---|---|---|---|
| 1 | `LunaJets` | `Europe's leading private jet broker, coordinating charter flights anywhere in the world.` | — (fără CTA) | `#` ⚠️ |
| 2 | `LunaGroup Charter` | `The expertise to organise all type of group charter services across the globe, and for any industries including governments, music tours, sports teams, fans, oil and gas.` | `Explore Group Charter` → | `https://www.lunagroupcharter.com/` (`target=_blank`) |
| 3 | `LunaSolutions` | `Strategic advice to clients and owners when dealing with transaction, financing, cost optimisation, sales and acquisitions of new or pre-owned aircraft.` | `Explore Aircraft Ownership` → | `https://www.lunaaircraftsolutions.com/` (`target=_blank`) |

- **Imagini foto:** niciuna. Cardurile au doar logo-uri/monograme SVG („LJ”, „LG”, „LS”).

### 3.5 Standards / Certifications: `section.section_about_certifications`

- **Wrapper-e:** `padding-global padding-section-medium` › `container-medium` › `split-content_component` (imagine **stânga**, text dreapta)
- **Imagine:** `…/6a26b54206315b3ee0ec471a_lunajets-argus-charter-broker-certified.webp`, alt `badge of LunaJets ARGUS-certified as a charter broker`, 600×600, `image-cover_absolute contain`. Rol: badge-ul de certificare ARGUS.
- **Text:**
  - Eyebrow: `Certifications & Standards`
  - H2: `Exceeding the Highest Standards in the Industry`
  - Lead (`p.font-vanitas.text-style-italic.text-size-large`): `LunaJets was the first European broker to obtain the ARGUS Certification`
  - P (`.speakable`): `As a European leader in private aviation, LunaJets is dedicated to setting the highest standards in charter integrity and social responsibility. Certified as an ARGUS broker for over a decade, we also support initiatives to reduce our clients’ carbon footprint, offering the option to fly with Sustainable Aviation Fuel (SAF) for a more environmentally responsible journey.`
- **CTA:** `Learn About Our Commitments` → `/en/corporate-social-responsibility`

### 3.6 As featured in (presă): `div.section_news` (CMS)

- **Wrapper-e:** `padding-global padding-section-medium` › `container-medium` › `news_component` › `news_header` (flex: titlu stânga, buton dreapta) + `news-component w-dyn-list` › `news_grid` (grid 2 col) › 3 × `news-item`. Un embed CSS face ca primul item să ocupe 2 rânduri pe desktop (`grid-row: span 2`).
- **Text:**
  - Eyebrow: `In the press`
  - H2: `As Featured in`
  - CTA: `All media coverage` → `/en/media-centre` (`button is-secondary is-stroke is-icon mobile_full`)
- **Item-uri CMS** (`img.img-news` + `a.link_no-underline` › `news_content` › `p.h3_news-headline` + `news_card_bottom`, care conține data și `Read more` →):

| # | Imagine (src / alt) | Titlu | Dată | Link |
|---|---|---|---|---|
| 1 | `…67c734771b96932daef1ebc6/6ab4fb6808282cc1c2b0bf66_the-sunday-times-vector-logo-lj.png` (logo The Sunday Times, 400×400) / alt = titlul | `5 ways to upgrade your next yachting adventure` | `September 23, 2026` | `#` ⚠️ |
| 2 | `…/687e607f9c5ad367931f0ccf_news-article.png` (**placeholder static**, `w-dyn-bind-empty`, câmp imagine gol) / alt = titlul | `LunaJets réalise le meilleur mois de son histoire avec une croissance de près de 15 %` (FR pe pagina EN!) | `August 13, 2026` | `#` ⚠️ |
| 3 | idem placeholder | `LunaJets Posts Best Month in Company History with nearly 15% Growth` | `August 13, 2026` | `#` ⚠️ |

### 3.7 Our Offices: parte din `footer.footer_u` (CMS), vezi §4.2

---

## 4. Elemente globale / partajate

### 4.1 Navbar: `header.navbar2_component` (fixed, fundal `--lj-blue`, min-height 4.75rem)

- `a.skip-link` `Skip to content` → `#main` ✅
- **Logo:** SVG inline (viewBox 0 0 100 20) → `/en`, `aria-label="LunaJets - Go to homepage"`.
- **Burger** (`#navbar-burger`, vizibil sub 1280px, clasa `desktop1280_hide`) + overlay `data-nav="overlay"`.
- **Meniu principal** `nav#menu-page-list` › `ul.s-navbar_content` cu **5 itemi**. Fiecare deschide la click un panou mega-meniu (`s-navbar_link-component`) cu un header-link (`p.heading-style-h3` + subtitlu + săgeată) și coloane de linkuri. Logica este JS custom, nu `w-dropdown`.

**1. `Private jet charter`**
- Header: `Private jet charter` / `Overview of all charter options` → `/en/private-jet-charter`
- `Business`: `Corporate jet charter` → `/en/private-jet-services/corporate-charter`; `Emergency jet charter` → `/en/private-jet-services/emergency-charter`; `Cargo charter` → `/en/private-jet-services/cargo-charter`
- `Leisure & more`: `Leisure jet charter` → `/en/private-jet-services/leisure-charter`; `Pet-friendly private jet` → `/en/insights/flying-with-pets-on-a-private-jet`; `Last-minute private jet` → `/en/private-jet-services/last-minute-flights`; `Group jet charter` → `/en/private-jet-services/group-charter`; `Helicopter charter` → `/en/private-jet-services/helicopter-flights`
- `Luna Aviation Group`: `LunaGroup Charter` (`Large-group and sports team charter`) → `https://www.lunagroupcharter.com/`; `LunaSolutions` (`Aircraft management and sales`) → `https://www.lunaaircraftsolutions.com/`

**2. `Pricing`**
- Header: `Pricing overview` / `How much does it cost to charter a private jet?` → `/en/prices`
- `Occasional flyers`: `On-demand jet charter` (`Book flight by flight`) → `/en/private-jet-charter`; `Empty legs` (`Repositioning flights at short notice`) → `/en/empty-leg-flights`
- `Frequent flyers`: `Frequent Charter Program` (`One advance payment, ready when you are. 100% refundable at all times.`) → `/en/frequent-charter-program`

**3. `Why LunaJets`**
- Header: `Why choose LunaJets?` / `Trusted by clients around the globe` → `/en/why-lunajets`
- `The company`: `About us` → `/en/about-us` (`w--current`); `Our history` → `/en/why-lunajets/our-history`; `Our offices` → `/en/why-lunajets/our-locations`; `Our Team` → `/en/why-lunajets/our-team`; `Global Management` → `/en/why-lunajets/global-management`; `Careers` → `/en/careers`
- `Reviews & press`: `Client testimonials` → `/en/why-lunajets/testimonials`; `Corporate Social Responsibility` → `/en/corporate-social-responsibility`; `Media centre` → `/en/media-centre`; `News and Insights` → `/en/insights`

**4. `Aircraft`**
- Header: `Browse all private jets` / `From turboprops to VIP airliners` → `/en/fleet#tab-aircraft-models`
- `By category`: `Turboprops` → `/en/fleet/hire-a-turboprop`; `Very Light Jets` → `/en/fleet/hire-a-very-light-jet`; `Light Jets` → `/en/fleet/hire-a-light-jet`; `Midsize Jets` → `/en/fleet/hire-a-midsize-jet`; `Super Midsize Jets` → `/en/fleet/hire-a-super-midsize-jet`; `Large Jets` → `/en/fleet/hire-a-large-jet`; `Long Range Jets` → `/en/fleet/hire-a-long-range-jet`; `View all categories →` → `/en/fleet#tab-aircraft-categories`
- `By manufacturer`: `Gulfstream` → `/en/fleet/gulfstream`; `Bombardier` → `/en/fleet/bombardier`; `Dassault Aviation` → `/en/fleet/dassault`; `Cessna` → `/en/fleet/cessna`; `Embraer` → `/en/fleet/embraer`; `Pilatus` → `/en/fleet/pilatus`; `View all manufacturers →` → `/en/fleet#tab-aircraft-manufacturers`
- `Tools`: `Jet comparator` (`Compare cabin, range and seats`) → `/en/why-lunajets/jet-comparator`

**5. `Destinations`** (ascuns prin CSS între 1280 și 1919px, deci **invizibil la 1440**)
- Header: `Browse all destinations` / `11 world regions and all private aviation airports` → `/en/destinations`
- `Europe & Middle East`: `Western Europe`, `Southern Europe`, `Eastern Europe`, `Northern Europe`, `Middle East` → `/en/destinations/{western-europe|southern-europe|eastern-europe|northern-europe|middle-east}`
- `Rest of the world`: `North America`, `Central America & Caribbean`, `South America`, `Africa`, `Asia`, `Oceania` → `/en/destinations/{north-america|central-america-caribbean|south-america|africa|asia|oceania}`
- `Private aviation airports`: `All airports worldwide` → `/en/airports`; `Airports near Paris` → `/en/airports-next-to-paris`; `Airports near London` → `/en/airports-next-to-london`; `Airports on the French Riviera` → `/en/airports-on-the-french-riviera`

- **Doar în meniul mobil** (`li.show_mobile_landscape`): Login, selector de limbă (`w-locales-list`, `w-dropdown`, afișează `en`; listă: English, Français, Deutsch, Italiano, Español, Русский, Magyar, Polski, cu steaguri injectate prin JS) și butonul `Request quotes`.
- **CTA-uri dreapta** (`navbar_ctas`):
  - **Login:** icon → `https://www.members.lunajets.com/en/login` (`aria-label="Login"`)
  - **Telefon:** `w-dropdown` `#navbar-phone-toggle`, `aria-label="Contact options"`. Listă: `lunajets@lunajets.com` (mailto) + 13 numere cu steag:

    | Țară | Număr |
    |---|---|
    | Switzerland | `+41 22 782 12 12` |
    | France | `+33 1 89 16 40 70` |
    | United Kingdom | `+44 2074 095 095` |
    | Spain | `+34 915 907 299` |
    | Italy | `+39 378 0030772` |
    | United States | `+1 646 568 9939` |
    | United Arab Emirates | `+971 4 227 4434` |
    | Austria | `+43 720 11 68 38` |
    | Poland | `+377 99 92 14 24` ⚠️ prefix Monaco cu steag PL |
    | Hungary | `+36 30 263 0049` |
    | Latvia | `+371 64 909 115` |
    | Greece | `+30 23 1118 0736` |
    | Brazil | `+55 21 35 00 66 71` |

  - **WhatsApp:** → `https://api.whatsapp.com/send?phone=41793311212` (`target=_blank`)
  - **`Request quotes`:** **code component** Webflow (`code-island`, librăria `lunajets-library`, componenta `InquireButton`, variant `unstyled`, props `from`/`to`). Deschide formularul de cerere zbor (React). Atribut de tracking `data-ph-capture-attribute-cta_request_flight="header"` (PostHog).
- **Componentă reutilizabilă:** da (Navbar global, partajat pe tot site-ul).

### 4.2 Footer: `footer.footer_u#footer`

**A. „Our Offices”** (`section_locations`, pe fundal alb, în interiorul `<footer>`)
- H2 `Our Offices` + `w-dyn-list` › `locations_grid#lj_locations_list` (grid 4 col, 2 pe tabletă) › 7 × `location_item` (`data-w-id` IX2).
- Fiecare item: link spre pagina de contact a orașului, cu H3 (în embed), adresă, cod poștal, icon telefon, link `tel:` și JSON-LD `LocalBusiness`:

| H3 | Adresă | Cod | Telefon | Link |
|---|---|---|---|---|
| `Geneva, Switzerland` | `29 Rue Lect` | `1217` | `+41 22 782 12 12` | `/en/contact-us/geneva-switzerland` |
| `London, United Kingdom` | `42 Berkeley Square` | `W1J 5AW` | `+44 2074 095 095` | `/en/contact-us/london-uk` |
| `Zurich, Switzerland` | `Dianastrasse 5` | `8002` | `+41 44 810 12 12` | `/en/contact-us/zurich-switzerland` |
| `Paris, France` | `9 Rue du Faubourg Saint-Honoré` | `75008` | `+33 1 89 16 40 70` | `/en/contact-us/paris-france` |
| `Dubai, United Arab Emirates (UAE)` | `DIFC - Gate District 4, Office B03` | — (span gol) | `+971 4 227 4434` | `/en/contact-us/dubai-uae` |
| `Madrid, Spain` | `C. del Conde de Aranda, 22` | `28001` | `+34 915 907 299` | `/en/contact-us/madrid-spain` |
| `Riga, Latvia` | `Alberta iela 12-5` | `LV-1010` | `+371 64 909 115` | `/en/contact-us/riga-latvia` |

- Plus un card static `Contact us` (H3 + săgeată) → `/en/contact-us` (`#lj_locations_contact`). Un script îl mută în grid pe poziția 101 (practic la final).

**B. Footer propriu-zis** (`padding-global background-color-primary` › `padding-section-medium` › `container-medium footer` › `footer_u_component`)
- **Top:**
  - Logo SVG → `/en`.
  - Social (ordinea din DOM): Instagram `https://www.instagram.com/lunajets/`, Facebook `https://www.facebook.com/lunajets`, YouTube `https://www.youtube.com/user/lunajets`, X `https://x.com/lunajets`, LinkedIn `https://www.linkedin.com/company/lunajets-s-a-` (toate `target=_blank`, cu aria-label).
  - Selector de limbă (`w-locales-list`, afișează `English`; 8 limbi).
  - Badge-uri app:
    - App Store `…/6945959903e5e83cc08163bb_Group%205841.svg` (alt `Download mobile app on the App Store`) → `https://apps.apple.com/gb/app/private-jets-charter-lunajets/id462220739`
    - Google Play `…/6945959909c08ed5f30226bf_Group%205842.svg` (alt `Download mobile app on Google Play`) → `https://play.google.com/store/apps/details?id=com.abonobo.lunajets`
  - **Newsletter:** titlu `Newsletter` + code component (formular, vezi §5).
- **Nu există coloane de linkuri** (Aircraft / Destinations etc.) în footer-ul vechi.
- **Bottom:**
  - Steag CH (SVG) + `A Swiss based company.`
  - `Member of leading business aviation associations:` + 5 logo-uri (link, `target=_blank`):

    | Logo | Imagine / alt | Link |
    |---|---|---|
    | The Air Charter Association | `…/6a3a5e7650f003377094a6ed_lunajets-air-charter-association-accredited-member-seal-inverted-rgb.svg`, alt `The Air Charter Association` | `https://www.theaircharterassociation.aero/member-directory/#:~:text=LunaJets` |
    | ARGUS | `…/6978cb149d0708878e131a8f_argus-logo-white.svg`, alt `ARGUS Certification` | `https://www.argus.aero/brokerregistry#:~:text=LunaJets` |
    | EBAA | `…/6978cb5cfb46e869cbfceaf0_ebaa-logo-white.svg`, alt `EBAA logo European Business Aviation Association` | PDF `…/69a9a41b10ccc43e6fcddadf_EBAA%20Membership%20Certificate%202026%20_LUNAJETS.pdf` |
    | NBAA | `…/6978cb5c7eaa727fd005f81a_national-business-aviation-association-nbaa-logo-white.svg`, alt `NBAA logo` | `https://nbaa.org/` |
    | MEBAA | `…/6992e511e0f3649dc20e0cf4_mebaa-logo.svg`, alt `MEBAA logo` | `https://www.mebaa.com/` |

  - Legal: `Terms & Conditions` → `/en/terms-conditions`, `Privacy Policy` → `/en/privacy-policy`, `Legal Notice` → `/en/legal-notice`
  - `© 2026 LunaJets. All Rights Reserved.`
  - `LunaJets is an air charter broker and only acts as an intermediary between third-party aircraft operators and the client. LunaJets arranges carriage by air by chartering aircraft from the operator, acting as agent, in the name and on behalf of the client. LunaJets does not itself operate aircraft, is not a contracting or indirect carrier and does not provide air transportation services.`

### 4.3 Cookie consent

- **CookieYes** (`https://cdn-cookieyes.com/client_data/b90c35c4440b82f23309cf2670ed07cd/script.js`, sincron în `<head>`) + **Google Consent Mode v2**: default `denied` pentru ad_storage, ad_user_data, ad_personalization, analytics_storage, functionality_storage, personalization_storage; `security_storage: granted`; `wait_for_update: 2000`.
- Banner-ul nu a putut fi randat în audit (host blocat), deci textul lui nu este documentat.

### 4.4 Elemente sticky / fixed

- Navbar `position: fixed` (top).
- **Bara sticky de jos, doar pe ≤991px** (`request_flight-sticky`, fundal `--lj-blue`, z-index 999): `Request quotes` (code component, tracking `fixed_bottom_mobile`) + buton WhatsApp.
- Un script leagă afișarea barei de un anchor `.request-flight-anchor#req-always`. Anchor-ul nu există pe această pagină, deci logica nu face nimic aici.
- `.request_component-dynamic > .visuallyhidden` conține code component-ul de „request flight” ascuns (`requestFlight: 0`), cu `data-ssr-error="true"` (eroare SSR).

### 4.5 Componente reutilizabile (candidați)

Navbar (cu mega-meniu), Footer, „Our Offices” (listă CMS, reutilizată probabil pe alte pagini), eyebrow `tag is-text is-icon`, butonul `button is-tertiary is-stroke is-icon`, `split-content_component` (folosit de 5 ori pe pagină), `stats_item`, card service, card group, card news, selector de limbă, dropdown telefon, bara sticky de mobil.

---

## 5. Formulare

- **Nu există niciun `<form>` Webflow nativ** (`w-form`) pe pagină.
- **Newsletter (footer):** code component React (`code-island`, CSS `code-components.website-files.com/6aa95b0fa3ce966b2c9a5943%2Fmodule%2Fb7dad8b901565fdccba4.css`).
  - `form` `aria-label="Newsletter Signup"`, fără atribut `action` (submit gestionat în JS).
  - 1 câmp: label `Email`, `input#input-newsletter-email` `type="email" name="email" placeholder="Email*"`.
  - Buton `type="submit"` cu textul `Send`.
  - Provider-ul (endpoint) **nu este vizibil** în HTML; bundle-ul componentei nu a putut fi încărcat.
- **Request quotes:** code component `InquireButton` + componenta dinamică de request flight (câmpuri `from`/`to`). Formularul propriu-zis e în bundle-ul React, neinspectat.
- `.grecaptcha-badge{display:none !important}` în head sugerează că un formular folosește Google reCAPTCHA (badge ascuns, deci e necesar textul de disclaimer reCAPTCHA).

## 6. Interacțiuni / animații

- **`data-w-id` (IX2) prezente doar pe elemente globale:**
  - 5 header-link-uri din mega-meniu (`21372bae-…-a34d/a398/a3d5/a410/a465`);
  - 2 × selector de limbă (`…a4b4`, `df12ca66-…-3eb8`) și dropdown-ul de telefon (`…a4d3`). Acestea sunt `w-dropdown`, iar `data-w-id` este standard pentru ele;
  - cele 7 carduri de birou (`879357a6-912a-5193-074a-855c0165042c`, același ID pe toate: interacțiune de template CMS, probabil hover);
  - cardul `Contact us` (`84e253e2-…-c01b`).
- **Secțiunile de conținut ale paginii (Hero → Presă) nu au nicio interacțiune IX2:** fără scroll-reveal, counter sau parallax.
- **Nu există:** slider (`w-slider`), tabs, marquee, Lottie, GSAP, background video. Clasa `.swiper-button-lock` apare doar în CSS-ul global (folosită pe alte pagini).
- **JS custom (în embed-ul navbar-ului):**
  - mega-meniu cu click/outside/Escape și body-scroll-lock pe ≤767px;
  - accesibilitate: `role=button`, `aria-expanded`, `aria-controls`;
  - închiderea meniului la click pe `[data-navmenu="off"]`;
  - injectarea steagurilor în selectorul de limbă prin `[data-value]`.
- **JS custom global (footer):**
  - sticky request bar (IntersectionObserver);
  - `ljFormatNumbers` pentru `[data-format="number"]`, cu `Intl.NumberFormat` după `lang` (neaplicat pe această pagină);
  - carduri clickabile `[data-lj_card_linked]` (neaplicat aici);
  - „Read more / Show less” pentru `.longtext-toggle-btn`, cu traduceri în 8 limbi (neaplicat aici);
  - repoziționarea cardului „Contact us” în grid;
  - tag PostHog pe butonul din bara sticky.
- Configurația IX2 (JSON-ul din `www-lunajets.eb975a5b…js`) nu a fost inspectată în detaliu (vezi „Ce nu a putut fi accesat”). La randare, `Webflow.require('ix2')` nu a fost disponibil, pentru că jQuery (cloudfront) a fost blocat în audit.

## 7. Custom code și integrări

| Integrare | Detalii |
|---|---|
| **Google Tag Manager** | `GTM-TRDGMCLS` (script în head + `<noscript>` iframe `https://www.googletagmanager.com/ns.html?id=GTM-TRDGMCLS`) |
| **Google Consent Mode v2** | inline, default denied (vezi §4.3) |
| **CookieYes** | `cdn-cookieyes.com/client_data/b90c35c4440b82f23309cf2670ed07cd/script.js` (sincron, blocant) |
| **Finsweet Attributes v2** | `https://cdn.jsdelivr.net/npm/@finsweet/attributes@2/attributes.js` cu atributele `fs-scrolldisable fs-list`. **Niciun element `fs-*` pe această pagină** (încărcat global). |
| **Finsweet Components** | `…67c72c8a3c305a53672bdcca%2F6544eda5f000985a163a8687%2F697140876cf7fdb7270bc355%2Ffinsweetcomponentsconfig-1.0.2.js` (`finsweet="components"`), care încarcă `https://cdn.jsdelivr.net/npm/@finsweet/fs-components@2/fs-components.js` |
| **Webflow code components (DevLink / React)** | `code-components.website-files.com/6aa95b0fa3ce966b2c9a5943/…` (librăria `lunajets-library`): InquireButton, Newsletter, Request flight. CSS suplimentar `…/css/tags.2e0bba141.css`. |
| **Webflow Optimize / Intellimize** | `data-wf-intellimize-customer-id="117515353"` |
| **PostHog** | atribute `data-ph-capture-attribute-cta_request_flight` (`header`, `mobile_menu`, `fixed_bottom_mobile`); scriptul vine probabil prin GTM (neverificat) |
| **Google reCAPTCHA** | badge ascuns prin CSS |
| **WhatsApp** | linkuri `api.whatsapp.com/send?phone=41793311212` |
| **Webflow runtime** | jQuery 3.5.1 (`d3e54v103j8qbb.cloudfront.net`), `www-lunajets.schunk.b36de0610a35aa79.js`, `www-lunajets.schunk.48322735ce4eb2fe.js`, `www-lunajets.eb975a5b.1d2eb801fd05e1be.js` |
| **Preconnect** | `cdn.prod.website-files.com`, `code-components.website-files.com`, `www.googletagmanager.com`, `cdn-cookieyes.com` |

**Embed-uri CSS custom:**
- Embed global (`body > .w-embed`): font smoothing; focus-visible (`#4d65ff` / `#9c8154`); `.inherit-color`; reset-uri `w-richtext`; clamp-uri `text-style-2lines/3lines/6lines`; `longtext-*`; `hide`, `hide-tablet`, `hide-mobile-landscape`, `hide-mobile`; utilitarele CF `margin-*` / `padding-*` cu `!important`; `word-spacing` pe `[lang="fr"]`; tabele în rich text; `.list.hyphen`; `footer#footer{padding-bottom:80px}` pe ≤991; breadcrumb `ol.home-hero-crumb`.
- Head: `.grecaptcha-badge` ascuns; `min-height` pentru `request_component-dynamic` în hero; `<noscript>` pentru `.longtext-text`.
- Navbar: ajustări pentru mega-meniu și ascunderea `Destinations` între 1280 și 1919px.
- Secțiunea news: primul item `grid-row: span 2` pe ≥992px.

## 8. CMS

| Listă | Unde | Colecție (dedusă) | Câmpuri vizibile |
|---|---|---|---|
| `news-component w-dyn-list` › `news_grid` | Secțiunea „As featured in” | **Press / Media coverage** (asset-uri pe site-ul CMS `67c734771b96932daef1ebc6`) | imagine (logo publicație; 2 din 3 goale, cu fallback static `news-article.png`), titlu (folosit și ca alt), dată. Linkul este `#` pe toate: câmpul URL e nelegat sau gol. **3 item-uri**, limitate/sortate probabil după dată. Conține articole în FR pe pagina EN, deci lipsește un filtru de limbă. |
| `w-dyn-list` › `locations_grid#lj_locations_list` | Footer „Our Offices” | **Offices / Locations** | nume oraș + țară, adresă, cod poștal, telefon, slug pagină contact, plus câmpuri pentru JSON-LD (imagine, Maps URL, geo lat/long, email, program, cod țară). 7 item-uri. |
| `w-dyn-list` (după footer, `role="none"`) | invizibil | colecție de tip „Schema / SEO” (1 item) | embed JSON-LD Organization + WebSite |
| `schema w-dyn-list` (după footer) | invizibil | idem (1 item) | embed JSON-LD AboutPage |

Toate celelalte secțiuni (hero, statistici, split-uri, services, group, standards) sunt **statice**.

## 9. Linkuri interne și fonturi

### 9.1 Linkuri interne din conținutul paginii (în afara navbar/footer)

| Anchor | href |
|---|---|
| `Read our history` | `/en/why-lunajets/our-history` |
| `Madrid` | `/en/contact-us/madrid-spain` |
| `Dubai` | `/en/contact-us/dubai-uae` |
| `Geneva` | `/en/contact-us/geneva-switzerland` |
| `Paris` | `/en/contact-us/paris-france` |
| `London` | `/en/contact-us/london-uk` |
| `Zurich` | `/en/contact-us/zurich-switzerland` |
| `Riga` | `/en/contact-us/riga-latvia` |
| `View all local offices` | `/en/why-lunajets/our-locations` |
| `Discover our management` | `/en/why-lunajets/global-management` |
| `Meet our team` | `/en/why-lunajets/our-team` |
| Card `LunaJets` | `#` ⚠️ |
| `Learn About Our Commitments` | `/en/corporate-social-responsibility` |
| `All media coverage` | `/en/media-centre` |
| 3 × `Read more` (presă) | `#` ⚠️ |

- Externe din conținut: `https://www.lunagroupcharter.com/`, `https://www.lunaaircraftsolutions.com/`.
- Din footer: cele 7 pagini `/en/contact-us/*`, `/en/contact-us`, `/en`, `/en/terms-conditions`, `/en/privacy-policy`, `/en/legal-notice`.
- Din navbar: vezi §4.1 (~60 de linkuri).

### 9.2 Fonturi

**Nu se folosesc Google Fonts și nici Typekit.** Toate fonturile sunt fișiere custom `@font-face` încărcate în Webflow (woff2, CDN Webflow, `font-display: swap`).

- **Vanitas: ✅ încărcat** (familia CSS `Vanitas`, `--_fonts---heading`). Este folosit pentru headings, cifrele din statistici, lead-ul italic și `font-vanitas`.
  - 700 normal: `https://cdn.prod.website-files.com/67c72c8a3c305a53672bdcca/69dcb927cc752029dafc9116_68419877420027b131ccce7f_Vanitas-Extrabold.woff2`
  - 700 italic: `https://cdn.prod.website-files.com/67c72c8a3c305a53672bdcca/69dcb96ca7c0e35a21db61e1_68419877c28ec2eb6fac7040_Vanitas-ExtraboldItalic.woff2`
  - Doar Extrabold și Extrabold Italic (declarate ca weight 700). Nu există alte greutăți.
- **Gilroy: ✅ încărcat** sub numele de familie **`Radomir Tinkov Gilroy`** (`--_fonts---body`, fallback Arial). Este folosit pentru body, butoane, etichete și navbar. 9 fețe:

| Weight / style | URL |
|---|---|
| 300 normal (Light) | `…/69dcb96c19fdcbf4b3a23058_68419758cfd9ed77f299278b_Radomir%20Tinkov%20-%20Gilroy-Light.woff2` |
| 300 italic | `…/69dcb96c2409f1297132aee2_6841975ac2d423f26b84d942_Radomir%20Tinkov%20-%20Gilroy-LightItalic.woff2` |
| 400 normal | `…/69dcb96c5be41ed13a85d3ab_68419758fc780f658231e782_Radomir%20Tinkov%20-%20Gilroy-Regular.woff2` |
| 400 italic | `…/69dcb96c6091016cc09ac3f2_68419758d72d2e96f0ca1424_Radomir%20Tinkov%20-%20Gilroy-RegularItalic.woff2` |
| 500 normal (Medium) | `…/69dcb96cbf46208a2a63db72_684197583bc4ef573b28e912_Radomir%20Tinkov%20-%20Gilroy-Medium.woff2` |
| 500 italic | `…/69dcb96c17a2bf63f74d5ad3_68419758ba8f42ff95b183c5_Radomir%20Tinkov%20-%20Gilroy-MediumItalic.woff2` |
| 600 normal (SemiBold) | `…/69dcb96c972035ba3406c2f1_684197582b8dd3d5796073b1_Radomir%20Tinkov%20-%20Gilroy-SemiBold.woff2` |
| 600 italic | `…/69dcb8b96a62469c5ea6a90c_684197588c709e2fe69c5a34_Radomir%20Tinkov%20-%20Gilroy-SemiBoldItalic.woff2` |

(prefix `https://cdn.prod.website-files.com/67c72c8a3c305a53672bdcca/`)

- **Gilroy Bold (700) NU este încărcat.** Totuși DOM-ul randat folosește `font-weight: 700` pe text Gilroy (de ex. titlurile coloanelor din footer și `text-weight-bold`), deci browserul generează un **faux-bold**. În Figma apare Gilroy Bold (11–12px eyebrow, etichete statistici), deci pentru noul site trebuie urcat și **Gilroy-Bold**.
- **Preload** în head pentru 7 fonturi: Gilroy Medium, Regular, SemiBold, RegularItalic, Light și Vanitas Extrabold, ExtraboldItalic. Pe această pagină, `document.fonts` a raportat încărcate doar Gilroy 400, Gilroy 600, Vanitas 700 normal și italic. **Light, Medium și RegularItalic sunt preîncărcate inutil.**
- Fontul `webflow-icons` (base64) vine din CSS-ul Webflow implicit.

---

## 10. Note pentru migrare

### 10.1 Probleme găsite pe pagina veche

**SEO / conținut**
1. Linkuri `href="#"`: cardul `LunaJets` din Group și toate cele 3 `Read more` din presă. Link-ul CMS al presei nu e legat.
2. Presă: 2 din 3 item-uri nu au imagine (fallback static generic). Un articol **în franceză** apare pe pagina EN.
3. `og:url` și `twitter:site` lipsesc. `meta robots` lipsește (acceptabil). Descrierea din JSON-LD `AboutPage` are `&#39;` dublu-escape-uit.
4. H2 `High-end ‍Quality Service` conține un caracter invizibil U+200D. `text-transform: capitalize` global pe h2 modifică vizual textul editorial (`With`, `A`).
5. Inconsistențe de text/majuscule: H2-urile split-urilor sunt în Title Case, celelalte în sentence case. `ARGUS Certification` (lead, fără punct) față de `ARGUS certification` în Figma.
6. Dropdown telefon: numărul pentru **Poland** este `+377` (prefix Monaco).
7. Footer: nu există coloane de navigare (SEO: mai puține linkuri interne din footer). „Our Offices” (H2 + 8 H3) stă în `<footer>`.

**Accesibilitate**
8. Imagini decorative de steag cu `alt=""` și `role="presentation"` ✅. Alt-urile foto sunt bune și descriptive ✅. Alt-urile imaginilor de presă = titlul articolului (acceptabil), dar imaginea e de fapt un logo.
9. Carduri `a.div_group-intro` au tot conținutul (H3 + P) în interiorul linkului, iar CTA-ul este un `div.button`, nu un link. Acceptabil, dar numele accesibil devine foarte lung.
10. Există skip-link și aria pe meniu ✅.

**Performanță**
11. Scripturi blocante în head: CookieYes (sincron) și Finsweet Components.
12. Finsweet Attributes v2 (`fs-list`, `fs-scrolldisable`) e încărcat pe o pagină care nu folosește `fs-*`.
13. Code components React pentru un simplu buton `Request quotes` (3 instanțe) + un component ascuns cu `data-ssr-error="true"`.
14. 7 fonturi preîncărcate, dintre care 3 nefolosite. Gilroy Bold lipsește (faux-bold).
15. Imaginea hero e `eager` ✅ (800×610 webp). Celelalte imagini sunt `lazy` ✅ și în format webp ✅.
16. JS inline mare în embed-urile navbar/footer. De mutat în fișiere externe sau în componente la rebuild.

**Client-First / structură**
17. Hibrid CF + Relume. `container-medium` = 80rem (non-standard). Utilitare cu px în nume. Combo-uri fără `is-`. Typo-uri în clase. Variabile șterse încă referite. `section_news` este `div`. Detalii în §3.

### 10.2 Maparea vechi → nou (design Figma, vezi `02-audit-figma-about.md`)

| Secțiune Figma nouă | Conținut vechi care intră aici | Diferențe de semnalat |
|---|---|---|
| **Navbar** | Logo, cei 4 itemi vizibili (`Private jet charter`, `Pricing`, `Why LunaJets`, `Aircraft`) + mega-meniurile lor, Login, dropdown telefon, `Request quotes` | Figma: `ABOUT US` devine item de top-level. Selectorul de limbă `EN ▾` apare în navbar (în vechi e doar în meniul mobil + footer). **Fără WhatsApp**. `DESTINATIONS` e ascuns și în Figma (în vechi e ascuns la 1280–1919). Mega-meniurile nu sunt desenate în Figma: de păstrat structura veche. Labelul Figma e `REQUEST QUOTE` (singular), față de `Request quotes`. |
| **Hero** | H1 `About LunaJets`, P2 (2025 / 12,000 / 180m€), imaginea sediului Geneva | Eyebrow `Our journey` → `OUR STORY`. P1 **rescris** („Founded in December 2007…” în loc de „What started as a pioneering…”). `180m€` → `€180m`. **CTA `Read our history` nu mai există** în Figma. Imaginea: poziția dreapta este aceeași; pe mobil, vechiul pune imaginea sus (`tablet-first`). |
| **Metrics (4 stats + 3 blocuri imagine/text)** | Header `A European leader since 2007` + P; cele 4 statistici; cele 3 split-uri (Global reach / Management / Team) cu texte, CTA-uri, href-uri și imagini (lac Geneva, Segard & Launay, advisors) | Eyebrow `Built on trust. Driven by excellence.` → `SINCE 2007`. „:” → „—” în P. **Statistica birouri: vechi `7`, Figma `10`** ⚠️. Eticheta zborurilor: vechi `in 2025`, Figma `in 2024` ⚠️. `on-the-ground regional expertise` → `unmatched regional expertise`. Figma pierde cele **7 linkuri inline** spre paginile orașelor (de păstrat pentru SEO). Labelurile și href-urile CTA-urilor corespund 1:1. |
| **Services (5 carduri)** | Cele 5 servicii (H3 + icon SVG) | Eyebrow `Our promise` → `OUR SERVICE STANDARD`. `Car and helicopter transfers` → `Car & helicopter transfers`. Iconurile vechi (SVG inline) pot fi refolosite. Carduri: min-height 15rem aliniat stânga în vechi, 118px centrat în Figma. |
| **Luna Aviation Group (3 carduri)** | Eyebrow, H2 `Delivered with Swiss Excellence`, cele 3 entități, link-urile externe lunagroupcharter.com / lunaaircraftsolutions.com | Paragraful intro e **complet rescris**. Descrierile cardurilor sunt **rescrise**. Monogramele SVG sunt înlocuite de **fotografii 280×186**. CTA-urile `Explore Group Charter` / `Explore Aircraft Ownership` devin `Discover`. Cardul LunaJets are acum link (vechi `#`), deci trebuie definit href-ul. Accent portocaliu pe LunaGroup (nou). |
| **Standards** | Eyebrow, lead ARGUS, paragraful ARGUS/SAF, CTA spre CSR | H2 scurtat: `Exceeding the highest standards` (fără „in the Industry”). CTA `Learn About Our Commitments` → `DISCOVER MORE` (href-ul `/en/corporate-social-responsibility` de păstrat). **Imaginea badge ARGUS (stânga) e înlocuită de turbine eoliene (dreapta)**. |
| **As featured in (3 carduri presă)** | H2, butonul `All media coverage` → `/en/media-centre`, lista CMS Press (3 item-uri) | Figma: fără eyebrow (vechi `In the press`); butonul e jos-centrat (vechi: sus-dreapta); 3 carduri egale (vechi: primul pe 2 rânduri); header de card = foto + overlay navy + logo SVG al publicației, deci trebuie câmpuri CMS noi (logo, foto de fundal, excerpt). Textul Figma e Lorem ipsum, deci trebuie legat de CMS. Trebuie reparate link-urile `#`. |
| **Footer** | Logo, social, badge-uri App Store / Google Play, newsletter, „A Swiss based company.”, logo-urile asociațiilor, copyright, disclaimer | Figma adaugă **4 coloane de linkuri** (AIRCRAFT, LUNA AVIATION GROUP, DESTINATIONS, CONTACT US), cu conținut nou. Social: ordinea diferă. Asociații: Figma are 4 logo-uri, **fără MEBAA** și fără textul `Member of leading business aviation associations:`. Copyright `© 2025` în Figma (vechi `© 2026`, de făcut dinamic). Newsletter-ul din Figma nu are buton submit (vechi: `Send`). Liniuța din „Swiss-based”. |

### 10.3 Conținut vechi care NU are loc în noul design Figma

1. **CTA-ul hero `Read our history`** → `/en/why-lunajets/our-history`.
2. **Cele 7 linkuri inline spre orașe** din paragraful „Global reach”.
3. **Secțiunea „Our Offices”** (listă CMS cu 7 birouri + card `Contact us`), inclusiv **cele 7 JSON-LD `LocalBusiness`** emise din ea. ⚠️ Dacă secțiunea dispare, schema LocalBusiness trebuie mutată altundeva (embed în pagină sau în alt component).
4. **Badge-ul ARGUS** (imagine) din Standards.
5. **Monogramele SVG** ale celor 3 companii din Group.
6. Eyebrow-ul `In the press` și layout-ul featured (primul articol dublu).
7. **Navbar:** butonul **WhatsApp**; din dropdown-ul telefon nu apar în Figma lista de 13 numere + email (există doar iconul). Item-ul `Destinations` (ascuns în ambele).
8. **Footer:** selectorul de limbă din footer, **linkurile legale** (`Terms & Conditions`, `Privacy Policy`, `Legal Notice`, care lipsesc din Figma! Sunt obligatorii, deci trebuie adăugate), logo-ul **MEBAA** și textul introductiv al asociațiilor.
9. **Bara sticky de mobil** (`Request quotes` + WhatsApp). Nu există design mobil deloc.
10. **Skip-link**, clasele `speakable` și JSON-LD-urile Organization / WebSite / AboutPage (invizibile, dar **de păstrat obligatoriu** în rebuild).
11. Alt-urile existente ale imaginilor (bune, de refolosit).

### 10.4 Conținut nou în Figma, fără sursă pe pagina veche
- Textele rescrise din hero P1, intro Group și descrierile cardurilor Group. Eyebrow-urile noi.
- Fotografiile pentru cardurile Group și pentru cardurile de presă; imaginea cu turbine eoliene.
- Coloanele de linkuri din footer.
- Statistica `10` birouri (în conflict cu 7 pe vechi și cu 7 în CMS/JSON-LD).

### 10.5 Recomandări pentru rebuild (sumar)
- Păstrează slug-urile localizate (8 limbi), canonical-ul și hreflang-urile. Adaugă `og:url`.
- Mută/recreează JSON-LD-urile (Organization, WebSite, AboutPage cu `speakable`, LocalBusiness × 7) înainte de a elimina „Our Offices”.
- Confirmă cu clientul: numărul de birouri (7 vs 10), anul statisticii de zboruri (2024 vs 2025), formatul `180m€` vs `€180m`, textele rescrise, eliminarea CTA-ului `Read our history`, eliminarea WhatsApp și MEBAA, legal links.
- Încarcă **Gilroy Bold (700)** în plus față de setul actual. Preîncarcă doar fețele folosite deasupra fold-ului.
- Press: câmpuri CMS noi (logo SVG, foto, excerpt, URL extern, limbă) + filtru pe limbă.
- Reevaluează scripturile globale (Finsweet Attributes nefolosit aici, CookieYes sincron, code components).

---

## Ce nu a putut fi accesat

| Resursă | Motiv / efect |
|---|---|
| **Preview Webflow** (`preview.webflow.com/preview/www-lunajets?…pageId=68e8ee174a83e3b879479a1d…`) | **Netestat.** Serviciul de verificare pentru comenzi Bash a devenit indisponibil (erori „no verdict”) înainte de acest pas. Preview-urile de tip designer cer de obicei login Webflow. Auditul s-a bazat integral pe site-ul live. |
| **Chromium direct spre site (TLS)** | Browserul nu are CA-ul proxy-ului în store-ul NSS, iar varianta de a-l face să aibă încredere în CA a fost refuzată de politica de permisiuni. Randarea s-a făcut prin Playwright, cu cererile preluate de partea Node (`route.fetch`), care verifică TLS cu bundle-ul CA oficial. |
| `cdn-cookieyes.com` | 403 (politica de egress): bannerul de cookie nu a fost randat/documentat. |
| `d3e54v103j8qbb.cloudfront.net` (jQuery 3.5.1) | 403: IX2 / dropdown-urile Webflow nu au rulat complet în browserul de audit. `Webflow.require('ix2')` nu a putut fi evaluat. |
| `cdn.jsdelivr.net` (Finsweet Attributes, fs-components) | 403 |
| `www.googletagmanager.com` (GTM-TRDGMCLS) | 403: conținutul containerului GTM (ce tag-uri declanșează: GA4, PostHog, Ads etc.) nu a fost verificat. |
| `code-components.website-files.com` | abortat: CSS/JS-ul code components (newsletter, request) nu s-a încărcat, deci endpoint-ul/provider-ul formularelor e necunoscut. |
| Bundle-ul IX2 (`www-lunajets.eb975a5b.1d2eb801fd05e1be.js`) și status-ul HTTP al celor 7 variante de limbă | Neverificate: comenzile Bash nu mai primeau aprobare (serviciul de verificare indisponibil). |
