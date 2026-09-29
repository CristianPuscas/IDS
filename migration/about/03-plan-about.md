# 03 — Faza B: sinteză și plan de build pentru pagina „About” (LunaJets → Webflow, Client-First v2)

> **Etapa:** Faza B, doar planificare. În această etapă nu se modifică nimic în Webflow, Figma sau git.
> **Data:** 2026-09-29
> **Surse:** `01-audit-old-about.md` (pagina live https://www.lunajets.com/en/about-us), `02-audit-figma-about.md` (Figma `kLdwkY54wIiha02RhcMP36`, frame `264:5854`, doar Desktop 1440), inventarul read-only al site-ului țintă, capturile din `figma-screenshots/` și `old-screenshots/`.
> **Site țintă:** „Daniel's Marvelous Site”, site id `6a82dbc04ebf3e2d805651ab` (template Relume). Home `6a82dbc34ebf3e2d80565233`.
> **Convenții:** Finsweet Client-First v2 (culori ca variabile v2.1, fără prefix în nume; rem la baza de 16px; `_` = clasă custom, doar `-` = utilitar; combo-uri `is-`). Numele claselor și textele paginii rămân în engleză.
> **Imagini:** nu se urcă nimic. Peste tot se folosesc placeholder-e (element Image fără asset) într-un wrapper cu `aspect-ratio` fix.

Legendă pentru sursa textelor: **[F]** = Figma, **[V]** = pagina veche, **[F+V]** = text Figma completat cu elemente din pagina veche, **[D]** = decizie din acest plan (vezi §1).

---

## 1. Rezumat și decizii deschise

### 1.1 Rezumat

- Pagina nouă urmează designul Figma Desktop 1440: Navbar, Hero, Metrics (header + 4 statistici + 3 blocuri split), Services (dark), Luna Aviation Group, Standards, As featured in, Footer.
- Nu există frame-uri de tabletă sau mobil. Comportamentul responsive din §9 este propunerea noastră și trebuie validat.
- Site-ul țintă este un template Relume cu clase mixte. Înainte de build facem curățenie (§3) și restructurăm variabilele pe modelul Client-First v2.1 (§4).
- Din pagina veche păstrăm tot ce contează pentru SEO, chiar dacă Figma nu le desenează: slug-ul, canonical-ul, cele 7 linkuri inline spre orașe, JSON-LD (AboutPage, Organization, WebSite, LocalBusiness), alt-urile imaginilor și linkurile legale din footer.
- Toate inconsecvențele Figma primesc o singură valoare de sistem (§4.6).

### 1.2 Decizii deschise (cu default recomandat, ca build-ul să poată continua)

Build-ul pornește cu valorile din coloana **Default**. Fiecare default este ușor de schimbat ulterior (text, prop de componentă sau o clasă).

| # | Întrebare pentru client / user | Opțiuni | **Default recomandat** | Motiv |
|---|---|---|---|---|
| D1 | Numărul de birouri: **7** (pagina veche, CMS, JSON-LD) sau **10** (Figma)? | 7 / 10 | **7** | Chiar paragraful Figma din split 1 enumeră 7 orașe (Madrid, Dubai, Geneva, Paris, London, Zurich, Riga). JSON-LD are 7 `LocalBusiness`. Cifra 10 ar contrazice datele structurate. |
| D2 | Anul statisticii de zboruri: `in 2024` (Figma) sau `in 2025` (vechi + hero Figma)? | 2024 / 2025 | **2025**: `Flights organised in 2025` | Hero-ul Figma spune tot „In 2025 … over 12,000 flights”. Pagina trebuie să fie coerentă cu ea însăși. |
| D3 | Formatul veniturilor: `€180m` (hero Figma) sau `180m€` (statistica Figma și pagina veche)? | €180m / 180m€ | **`€180m` peste tot**. Statistica devine număr `€180` + sufix `m` | Convenția în engleză pune simbolul monedei în față. Același format în hero și în statistică. |
| D4 | Cardul „LunaGroup Charter” portocaliu (`#E76C1E`): stare hover desenată sau accent permanent? | hover / static | **Accent static**, doar pe titlul cardului (culoarea de brand LunaGroup). Linkul `Discover` rămâne navy. | Portocaliul pe text de 12px are contrast 3.2:1 pe alb, sub pragul AA de 4.5:1. Pe titlul de 24px (text mare, prag 3:1) trece. Implementat ca variantă de componentă (`Accent = Orange`), deci se poate schimba dintr-un click. |
| D5 | Presa „As featured in”: textul este Lorem ipsum, iar datele (May 11, 2024…) par fictive. Ce articole reale intră? | 3 articole reale / altă selecție | **Build cu placeholder-e marcate `[PLACEHOLDER]`**. Pagina **nu se publică pe producție** cu Lorem ipsum. Dacă nu primim conținut până la go-live, secțiunea primește `hide`. | Clientul trebuie să trimită, pentru fiecare articol: logo SVG alb, foto de fundal, excerpt (≤140 caractere), dată, URL extern, limbă. |
| D6 | Licența webfont Vanitas + Gilroy și fișierul **Gilroy Bold (700)**, care lipsește. | — | **Build pe staging cu fonturile existente (woff2 de pe site-ul vechi).** Publicarea pe domeniul de producție se blochează până la confirmarea licenței. Clientul trimite `Gilroy-Bold.woff2`. | Figma folosește Gilroy Bold (eyebrow, etichete statistici, footer). Fără fișier, browserul generează faux-bold. Clasele se setează oricum cu `font-weight: 700`, deci când apare fișierul nu mai trebuie modificat nimic. |
| D7 | Ce se întâmplă cu „Our Offices” (listă CMS cu 7 birouri în footer) și cu cele 7 JSON-LD `LocalBusiness` emise de ea? | păstrăm secțiunea / o scoatem | **O scoatem de pe About (conform Figma).** Cele 7 `LocalBusiness` intră static în JSON-LD-ul `Organization` (`subOrganization`), în head-ul site-ului. Când se refac paginile `/contact-us/<oraș>`, fiecare `LocalBusiness` se mută pe pagina orașului lui. | Nu pierdem datele structurate. Linkurile spre orașe rămân prin cele 7 linkuri inline din split 1 (D10b). |
| D8 | Footer-ul Figma nu are: **linkuri legale**, **selector de limbă**, logo-ul **MEBAA** și textul „Member of leading business aviation associations:”. | adăugăm / urmăm Figma | **Linkuri legale: le adăugăm** (obligatoriu): `Terms & Conditions`, `Privacy Policy`, `Legal Notice`. **Selector de limbă: doar în navbar**, ca în Figma. **MEBAA: îl păstrăm** ca al 5-lea logo (membru real, apare și în JSON-LD `memberOf`). Textul introductiv nu intră. | Legal = cerință juridică. MEBAA = fapt verificabil, nu costă nimic vizual. |
| D9 | WhatsApp (buton în navbar-ul vechi) și **bara sticky de mobil** (`Request quotes` + WhatsApp, ≤991px) lipsesc din Figma. | păstrăm / renunțăm | **WhatsApp devine un item în dropdown-ul de telefon** (`WhatsApp`, link `https://api.whatsapp.com/send?phone=41793311212`). **Bara sticky se amână** până la designul global de mobil, marcată prioritate mare (conversie). | Canalul nu se pierde și nu inventăm un design de mobil nevalidat. |
| D10 | CTA-ul hero `Read our history` (→ `/en/why-lunajets/our-history`) lipsește din Figma. | păstrăm / renunțăm | **Îl păstrăm ca link text discret** (`button is-link is-icon`, stilul „Discover”) sub paragraful 2 din hero. | Mega-meniul care mai trimitea spre pagina de istorie se amână (D11), deci fără acest link pagina ar rămâne fără link intern de pe About. De validat cu designerul. |
| D10b | Cele 7 linkuri inline spre orașe din paragraful „Global reach” lipsesc din Figma. | păstrăm / renunțăm | **Le păstrăm** (text Figma, cu linkurile vechi pe numele orașelor). | Linkuri contextuale pentru SEO, fără impact vizual (stil `text-style-link`). |
| D11 | Mega-meniurile navbar-ului nu sunt desenate în Figma. | refacem acum / mai târziu | **Faza C: linkuri simple de top-level.** Mega-meniul vine într-o fază globală separată. | În afara scopului About, fără design. |
| D12 | Butonul `REQUEST QUOTE`: pe site-ul vechi este code component React (`InquireButton`, librăria `lunajets-library`), care nu există pe site-ul țintă. Label: `Request quote` (Figma) sau `Request quotes` (vechi)? | — | **Label `Request quote` (Figma). Link temporar `/en?requestFlight=1`** (același URL ca `ReserveAction` din JSON-LD). Se înlocuiește cu code component-ul când librăria DevLink e partajată pe site. | Fără `href="#"`. |
| D13 | Newsletter: providerul nu e cunoscut, iar Figma nu desenează buton de submit. | — | **Formular Webflow nativ** (`form_*`), cu câmp email și buton-săgeată în interiorul câmpului (`aria-label="Subscribe"`). Acțiunea și providerul se leagă ulterior. Pe staging formularul nu este conectat. | — |
| D14 | Contrast: gri-ul datelor de presă (`#8E98A4`) și etichetele statisticilor (navy la 45% opacitate ≈ `#8F99A5`) au **~2.9:1 pe alb**, sub AA (4.5:1). | păstrăm Figma / corectăm | **`Text Color/secondary` = `#6B7684`** (4.6:1 pe alb). Opacitatea de pe etichete dispare. | Accesibilitate WCAG AA. Diferența vizuală e minimă. |
| D15 | `LunaLogistik` apare în footer-ul Figma, dar nu are URL cunoscut. | — | **Itemul primește `hide`** până primim URL-ul. | Fără linkuri `#`. |
| D16 | Cardul `LunaJets` din Group: unde trimite `Discover`? (pe vechi era `#`) | — | **`/en/private-jet-charter`** | Pagina de prezentare a serviciului principal. |
| D17 | Badge-ul ARGUS (imagine) din Standards e înlocuit în Figma de turbine eoliene. | Figma / vechi | **Figma (turbine eoliene).** Logo-ul ARGUS rămâne în footer. | — |
| D18 | `aggregateRating` (4.8/5, 2302) din JSON-LD `Organization`. | păstrăm / scoatem | **Îl scoatem.** | Google nu afișează recenzii „self-serving” pentru `Organization`/`LocalBusiness`. Se poate re-adăuga dacă clientul insistă. |
| D19 | Copyright: `© 2025` în Figma, `© 2026` pe vechi. | — | **An dinamic**: `<span data-year>2026</span>` + script de 1 linie în footer. | — |
| D20 | Localizare: Webflow Localization (8 limbi) acum sau doar EN? | vezi §2 | **Doar EN în Faza C.** Structura (slug-uri, texte fără majuscule hardcodate) se pregătește pentru localizare. | Nu blochează build-ul. Blochează doar go-live-ul pe domeniu (§2). |

---

## 2. Maparea URL-urilor

### 2.1 Fapte

- Site-ul vechi (tot Webflow) servește **engleza sub `/en/`**, cu `x-default` → `/en/about-us`, plus 7 locale cu **slug-uri localizate**.
- Site-ul țintă este un **alt site Webflow**. La go-live, domeniul `www.lunajets.com` trece pe el. Redirect-urile 301 se configurează pe site-ul țintă (Site settings → Publishing / SEO → 301 redirects).
- **Slug-ul paginii în Webflow: `about-us`** (neschimbat). Dacă și prefixul de locale rămâne `/en/`, nu e nevoie de niciun redirect.
- ⚠️ **De verificat în Faza C** (Site settings → Localization, pe site-ul vechi `67c72c8a3c305a53672bdcca`): cum servește site-ul vechi engleza sub `/en/` (ce locale e primar, ce subdirector are). Configurația trebuie replicată identic pe site-ul țintă. Dacă nu se poate, e nevoie de 301 de la `/en/about-us` la `/about-us` (și la fel pentru tot site-ul).

### 2.2 Tabel

| URL VECHI | URL NOU | ACȚIUNE | CMS | REDIRECT |
|---|---|---|---|---|
| `https://www.lunajets.com/en/about-us` (și `x-default`) | `https://www.lunajets.com/en/about-us` (pagina statică „About us”, slug `about-us`, locale EN) | Rebuild complet, Faza C | Nu (pagină statică). Secțiunea Presă: statică acum, CMS „Press” mai târziu (§8) | **Niciunul**, dacă locale-ul EN rămâne pe `/en/`. Altfel **301** `/en/about-us` → `/about-us` |
| `https://www.lunajets.com/fr/a-propos` | `…/fr/a-propos` | Localizare FR, după Faza C | Nu | Niciunul dacă Localization e activă cu slug-ul `a-propos` la go-live. Dacă lansăm doar EN: **302 temporar** → `/en/about-us`, eliminat la publicarea traducerii |
| `https://www.lunajets.com/de/uber-uns` | `…/de/uber-uns` | Localizare DE | Nu | idem (302 temporar → `/en/about-us` dacă lipsește DE) |
| `https://www.lunajets.com/it/chi-siamo` | `…/it/chi-siamo` | Localizare IT | Nu | idem |
| `https://www.lunajets.com/es/quienes-somos` | `…/es/quienes-somos` | Localizare ES | Nu | idem |
| `https://www.lunajets.com/ru/o-nas` | `…/ru/o-nas` | Localizare RU | Nu | idem |
| `https://www.lunajets.com/hu/rolunk` | `…/hu/rolunk` | Localizare HU | Nu | idem |
| `https://www.lunajets.com/pl/o-nas` | `…/pl/o-nas` | Localizare PL | Nu | idem |

### 2.3 Strategia de localizare (întrebare deschisă, D20)

- **Varianta A (recomandată pe termen lung):** Webflow Localization (plan cu add-on de localizare) cu aceleași 8 locale și aceleași slug-uri localizate. Webflow generează automat `hreflang` pentru paginile localizate, deci nu se adaugă hreflang manual.
- **Varianta B (Faza C):** construim doar EN. Nu adăugăm `hreflang` spre pagini care nu există. **Go-live-ul pe domeniu nu se face** până nu există fie Localization (A), fie cele 7 redirect-uri 302 temporare.
- Pregătire pentru localizare, aplicată încă din Faza C:
  - Textele se scriu în sentence case, iar majusculele vin din CSS (`text-transform`), ca traducătorii să lucreze pe text normal.
  - Fără text în imagini.
  - Componentele folosesc props de text, ca să poată fi traduse per locale.

### 2.4 Dependențe de linkuri (pagini care încă nu există pe site-ul țintă)

Pe staging, About trimite spre pagini încă neconstruite:

- `/en/why-lunajets/our-history`, `/our-locations`, `/global-management`, `/our-team`
- `/en/contact-us/{geneva-switzerland|london-uk|zurich-switzerland|paris-france|dubai-uae|madrid-spain|riga-latvia}`
- `/en/corporate-social-responsibility`, `/en/media-centre`, `/en/private-jet-charter`
- `/en/terms-conditions`, `/en/privacy-policy`, `/en/legal-notice`

Le punem ca **URL links cu calea de producție** și le trecem într-un registru (tabel în QA, §11 pasul 08). Când paginile apar în Webflow, se transformă în **Page links**, ca Webflow să aplice automat prefixul de locale.

---

## 3. Plan de curățenie pentru site-ul țintă (doar propunere, se execută cu aprobare)

### 3.1 Ce NU atingem

- Paginile **Style Guide** (draft), **404**, **Password** și pagina **Home** (ca pagină: id, slug, setări).
- Componenta **„Global Styles”**: nu se șterge. Doar conținutul embed-ului se aliniază la Client-First (§5.1).
- Clasele Client-First existente: `page-wrapper`, `main-wrapper`, `padding-global`, `container-*`, `padding-section-*`, `heading-style-*`, `text-*`, `margin-*`/`padding-*` + clasele de direcție, `spacer-*`, `max-width-*`, `hide-*`, `overflow-*`, `z-index-*`, `aspect-ratio-*`, `icon-embed-*`, `icon-1x1-*`, `button` + combo-urile, `form_*`, `shadow-*`, `global-styles`. Valorile lor se ajustează în §4 și §5, dar nu se șterg.
- Clasele `rl-styleguide_*`, cât timp pagina Style Guide există (sunt folosite de ea).
- Site settings: domenii, hosting, localizare, integrări.
- Colecțiile CMS: **userul** le șterge manual (Essays, Authors, Categories, Tags). Noi doar verificăm după aceea.

### 3.2 Ce ștergem sau redenumim (în ordine)

| Pas | Acțiune | Detaliu | Unde |
|---|---|---|---|
| C0 | **Backup** | Site settings → Backups → backup manual „pre-cleanup 2026-09-xx”. | Manual (UI) |
| C1 | Userul șterge cele 4 colecții CMS | Dispar și paginile-template Essays/Authors/Categories/Tags. Verificăm că nu rămân Collection List-uri goale pe Home. | Manual (user) |
| C2 | Golim conținutul Relume de pe Home | Se șterg secțiunile din `main-wrapper` (după captură de ecran de referință). Rămân `page-wrapper` și `main-wrapper`. Home va fi refăcută într-o fază separată. | Designer |
| C3 | Duplicate | `container-large 2`, `padding-global 2`, `text-size-medium 2`: se selectează elementele care le folosesc (Style Manager → „Select elements”), li se aplică clasa originală, apoi duplicatul se șterge. | Designer |
| C4 | Clase generice | `Div Block 2…29`, `Collection List 2…7`, `Text Block 2/3`: după C1–C2 ar trebui să fie nefolosite și să dispară la C6. Cele încă folosite se redenumesc Client-First sau se înlocuiesc. | Designer |
| C5 | Seturi străine | `iron-*`, `at-*`, `trainer-*`, `essay-*`, `hero-*`, `blog_*`, `faq1_*`: după C1–C2 devin nefolosite. `color-scheme-1` și `background-color-black` se șterg după migrarea variabilelor (§4). `background-color-white` se înlocuiește cu `background-color-alternate`. | Designer |
| C6 | Style Manager → **Clean Up** | Șterge toate clasele nefolosite. Înainte, verificăm în listă că nu apare nimic din §3.1 (utilitarele nefolosite **nu** se șterg: dacă apar în lista de clean-up, se deselectează). | Designer (manual) |
| C7 | Variabile Relume | Se execută **după** pasul 02 (§4.1). Variabilele Relume nefolosite se șterg doar după ce utilitarele sunt re-legate de noile tokenuri. | Designer |
| C8 | Verificare | Home și Style Guide se deschid fără erori. Style Manager nu mai conține clase din seturile de la C4–C5. Audit panel (U) fără erori noi. | Designer |

> ⚠️ **Clean Up** șterge și utilitarele Client-First încă nefolosite (de ex. `margin-xxhuge`). Recomandare: înainte de C6, aplicăm temporar utilitarele pe o pagină-schelă (de ex. Style Guide), sau deselectăm manual clasele care trebuie păstrate.

---

## 4. Design system → Webflow Variables

### 4.1 Structura colecțiilor (propunere de restructurare)

Colecțiile Relume actuale („Primitives”, „Color Schemes”, „Typography”, „UI Styles”, fiecare cu un mod Base) se refolosesc astfel:

| Colecție | Rol după restructurare | Ce se întâmplă cu conținutul Relume |
|---|---|---|
| **Primitives** (se păstrează numele) | Culori brute: grupuri `Brand`, `Neutral`, `Alpha`, `System` | Variabilele Relume se șterg după re-legare (C7) |
| **Color Schemes** → **redenumită `Semantic`** (sau colecție nouă `Semantic`, iar „Color Schemes” se șterge dacă redenumirea nu e disponibilă) | Tokenuri semantice Client-First v2.1: `Background Color`, `Text Color`, `Border Color`, `Link Color` | Schemele Relume se șterg, iar `color-scheme-1` dispare |
| **Typography** | Doar `Font Family/heading`, `Font Family/body` | Variabilele de mărime Relume (font-size, line-height) se șterg. Mărimile stau în clase, pentru că variabilele Webflow nu au breakpoint-uri (regula Client-First) |
| **UI Styles** | Doar `Radius/small`, `Radius/medium` | Restul variabilelor Relume se șterg |

Clasele leagă **doar tokenuri semantice**, niciodată primitive (excepție: `Font Family/*` și `Radius/*`, care nu au nivel semantic).

> Înainte de pasul 02 se face un inventar exact (numele și valorile variabilelor Relume, plus ce clase le folosesc), pentru că inventarul read-only nu le-a listat individual.

### 4.2 Culori: primitive (colecția `Primitives`)

| Variabilă (grup/nume) | Valoare | Sursă Figma / vechi |
|---|---|---|
| `Brand/navy` | `#061D38` | `Surface/card-dark`, `Text/primary-onLight`, `--lj-blue` |
| `Brand/navy-dark` | `#020C18` | gradient Services (vechi) |
| `Brand/navy-light` | `#0C2847` | gradient Services |
| `Brand/orange` | `#E76C1E` | `color/orange/51` „Tango” |
| `Neutral/white` | `#FFFFFF` | `Surface/ground` |
| `Neutral/lightest` | `#F4F2EF` | `Surface/card-beige`, `--lj-cream` (rezervă) |
| `Neutral/lighter` | `#E1E5E8` | `color/azure/90` „Porcelain” |
| `Neutral/light` | `#979BA1` | `Text/tetriary-onDark` (legal footer; 6:1 pe navy ✅) |
| `Neutral/dark` | `#6B7684` | **nou, D14** (înlocuiește `#8E98A4`; 4.6:1 pe alb ✅) |
| `Alpha/white-12` | `rgba(255,255,255,0.12)` | `Button/secondary-onDark`, `Surface/Input-onDark` |
| `Alpha/white-24` | `rgba(255,255,255,0.24)` | `Border/primary-onDark` |
| `Alpha/navy-50` | `rgba(6,29,56,0.5)` | border rând statistici |
| `System/focus` | `#E76C1E` | focus ring: 3.2:1 pe alb, 5.3:1 pe navy (≥3:1 pentru non-text ✅) |
| `System/success-light` | `#E6F4EA` | mesaje formular |
| `System/success-dark` | `#0E5E2F` | mesaje formular |
| `System/error-light` | `#FDECEA` | mesaje formular |
| `System/error-dark` | `#8A1C12` | mesaje formular |

Culorile folosite o singură dată rămân **pe clasa custom**, nu devin variabile (regula v2.1):

- gradientul Services: `linear-gradient(162deg, rgba(2,12,24,0.85) 0%, rgba(6,29,56,0) 35%, rgba(12,40,71,0.6) 71%)`;
- overlay-ul de presă: `rgba(6,29,56,0.85)`.

### 4.3 Culori: tokenuri semantice (colecția `Semantic`)

| Token | → Primitivă | Legat pe |
|---|---|---|
| `Background Color/primary` | `Brand/navy` | `background-color-primary`, `button`, `navbar_component`, `footer_component`, `services_card` |
| `Background Color/secondary` | `Neutral/lightest` | `background-color-secondary` (rezervă) |
| `Background Color/tertiary` | `Alpha/white-12` | `navbar_icon-button`, `form_input is-newsletter` |
| `Background Color/alternate` | `Neutral/white` | `background-color-alternate`, `button is-alternate`, `body` |
| `Background Color/success` / `error` | `System/success-light` / `System/error-light` | `form_message-success` / `form_message-error` |
| `Text Color/primary` | `Brand/navy` | `body`, `text-color-primary`, `button is-secondary`, `button is-alternate` |
| `Text Color/secondary` | `Neutral/dark` | `text-color-secondary`, `stats_label`, `press_card-date`, `form_input::placeholder` |
| `Text Color/tertiary` | `Neutral/light` | `footer_legal-text` |
| `Text Color/alternate` | `Neutral/white` | `text-color-alternate`, `background-color-primary`, `button` |
| `Text Color/accent` | `Brand/orange` | `group_card-title is-accent` |
| `Text Color/success` / `error` | `System/success-dark` / `System/error-dark` | mesaje formular |
| `Border Color/primary` | `Neutral/lighter` | `group_card`, `press_card`, `form_input` |
| `Border Color/secondary` | `Alpha/navy-50` | `stats_list` (top/bottom) |
| `Border Color/alternate` | `Brand/navy` | `button is-secondary` |
| `Border Color/on dark` | `Alpha/white-24` | `navbar_component` (bottom), `services_card`, `footer_divider` |
| `Border Color/focus` | `System/focus` | focus ring în embed-ul Global Styles |
| `Link Color/primary` | `Brand/navy` | tag-ul `a`, `text-style-link`, `button is-link` |
| `Link Color/alternate` | `Neutral/white` | `navbar_link`, `footer_link` |

Numele CSS rezultate urmează modelul Webflow `--<colecție>--<grup>--<nume>`, de exemplu `--semantic--text-color--primary`. **Nu se folosesc în custom code**, cu o singură excepție: focus ring-ul din embed (§5.1), unde numele se verifică în Designer după creare.

### 4.4 Tipografie

**Fonturi** (upload manual, Site settings → Fonts; vezi D6):

| Familie în Webflow | Fișier | Weight / style | Folosire |
|---|---|---|---|
| `Vanitas` | `Vanitas-Extrabold.woff2` | 700 normal | h1–h6, statistici |
| `Vanitas` | `Vanitas-ExtraboldItalic.woff2` | 700 italic | `<em>` din titluri |
| `Gilroy` | `Gilroy-Regular.woff2` | 400 normal | body |
| `Gilroy` | `Gilroy-SemiBold.woff2` | 600 normal | butoane, nav, lead, titluri coloane footer |
| `Gilroy` | `Gilroy-Bold.woff2` ⚠️ lipsește | 700 normal | eyebrow, etichete statistici, linkuri footer, legal |

- Numele de familie se setează explicit ca `Gilroy` (nu „Radomir Tinkov Gilroy”, ca pe vechi).
- Gilroy Light, Medium și italicele **nu se urcă** (nu sunt folosite în design).
- Cormorant Garamond **nu se importă** (rămășiță Figma).
- Înainte de upload, fișierul Vanitas Extrabold se verifică vizual (Figma îl randează subțire).

**Variabile (colecția `Typography`):**

| Variabilă | Valoare |
|---|---|
| `Font Family/heading` | `Vanitas`, fallback `Georgia, serif` |
| `Font Family/body` | `Gilroy`, fallback `Arial, sans-serif` |

**Mărimi (în clase și stiluri de tag, nu în variabile). Coloane: rem la 16px; base / 991 / 767 / 479:**

| Tag / clasă | Font | base | 991 | 767 | 479 | line-height | letter-spacing | Sursă Figma |
|---|---|---|---|---|---|---|---|---|
| `h1` = `heading-style-h1` | heading 700 | **3.375rem** (54) | 3rem | 2.5rem | 2.25rem | 1.1 | **0.03em** | H1 54 |
| `h2` = `heading-style-h2` | heading 700 | **2.5rem** (40) | 2.25rem | 2rem | 1.75rem | 1.1 | **0.03em** | H2 40 |
| `h3` = `heading-style-h3` | heading 700 | **1.5rem** (24) | — | 1.25rem | — | 1.2 | 0.03em | titlu card 24 |
| `h4` = `heading-style-h4` | heading 700 | 1.25rem | — | 1.125rem | — | 1.3 | 0.02em | nefolosit pe About |
| `h5` = `heading-style-h5` | heading 700 | 1.125rem | — | 1rem | — | 1.4 | 0.02em | nefolosit |
| `h6` = `heading-style-h6` | heading 700 | 1rem | — | 0.875rem | — | 1.4 | 0.02em | nefolosit |
| `body` / `p` | body 400 | **1rem** (16) | — | — | — | 1.5 (24px) | 0.025em (0.4px) | paragraf 16/24 |
| `text-size-large` | — | 1.5rem | — | 1.25rem | — | (moștenit) | — | lead 24 |
| `text-size-medium` | — | 1.25rem | — | 1.125rem | — | — | — | — |
| `text-size-regular` | — | 1rem | — | — | — | — | — | — |
| `text-size-small` | — | 0.875rem (14) | — | — | — | — | — | card Services, footer |
| `text-size-tiny` | — | 0.75rem (12) | — | — | — | — | — | legal |

- **Regula „clasă = tag”:** `heading-style-h4`–`h6` primesc exact valorile tag-urilor pe toate breakpoint-urile, adică se corectează inconsecvența din cloneable.
- **`h2` fără `text-transform`** (vechiul `capitalize` dispare). Textele se scriu în sentence case, ca în Figma.
- **Italicul din titluri:** `<em>` în interiorul lui `h1`/`h2`. Moștenește familia și weight-ul, deci browserul folosește fața Vanitas 700 italic. Tag-ul `em` nu are nevoie de stil.

**Clase custom de text** (grupuri unice, cu diferențe responsive):

| Clasă | Proprietăți | Sursă Figma |
|---|---|---|
| `tagline_text` | body 700, 0.6875rem (11px), lh 1.2, ls 0.22em, uppercase | eyebrow 11 / 2.42px |
| `split_lead` | body 600, 1.5rem (767: 1.25rem), lh 1.3, ls 0.02em | lead 24/1.3/0.5px |
| `stats_number` | heading 700, 3.25rem / 3rem / 2.75rem / 2.5rem, lh 1.05, ls 0.02em | 52 / 1.05 / 1px |
| `stats_suffix` | heading 700, 1.375rem (767: 1.25rem), lh 1.2 | sufix 22 |
| `stats_label` | body 700, 0.75rem, lh 1.3, ls 0.22em, uppercase, `Text Color/secondary` | 12 / 2.64px |
| `services_card-title` | body 400, 0.875rem, lh 1.35, ls 0, text-align center | 14 / 18.9 |
| `group_card-title` | (h3) + uppercase, ls 0.08em, text-align center | 24 / 2px |
| `group_card-text` | body 400, 0.9375rem (15px), lh 1.5 | 15 / 22.5 |
| `press_card-text` | body 400, 0.9375rem, lh 1.5 | 15.88 normalizat |
| `press_card-date` | body 400, 0.875rem, `Text Color/secondary` | 13.77 normalizat |
| `navbar_link` | body 600, 0.8125rem (13px), lh 1.2, ls 0.12em, uppercase | 13 / 1.56px |
| `footer_column-title` | body 600, 0.875rem, lh 1.43, ls 0.02em, uppercase | 14/20 |
| `footer_link` | body 700, 0.875rem, lh 1.43, ls 0.02em | 14/20 Bold |
| `footer_legal-text` | body 700, 0.75rem, lh 1.33, ls 0.02em, `Text Color/tertiary` | 12/16 |

### 4.5 Spațiere

**Scala Client-First, cu 2 mărimi adăugate** (decizie de proiect, documentată):

| Figma | Clasă Client-First | base | 991 | 767 | Folosire |
|---|---|---|---|---|---|
| 16 | `spacer-small` / `margin-small` / `padding-small` | 1rem | — | — | paragraf → paragraf |
| **20** | **`spacer-custom1`** (+ `margin-custom1`, `padding-custom1`) | **1.25rem** | 1.25rem | 1rem | eyebrow → titlu |
| **24** | **`spacer-custom2`** (+ `margin-custom2`, `padding-custom2`) | **1.5rem** | 1.5rem | 1.25rem | titlu → paragraf |
| 32 | `spacer-medium` | 2rem | 1.5rem | 1.25rem | înainte de butoane, H1 → paragraf |
| 40 | `padding-global` (orizontal); `stats_list` (vertical, în clasa custom) | 2.5rem | 2.5rem | 1.25rem | — |
| 48 | `spacer-large` | 3rem | 2.5rem | 1.5rem | footer, header presă → carduri |
| 56 (24 + 32, dublat) | → **`spacer-medium`** (2rem) | — | — | — | rezolvare inconsecvență |
| 64 | `spacer-xlarge` / gap `about-metrics_component` | 4rem | 3rem | 2rem | header → listă, între blocuri |
| 80 | `padding-section-medium` / `padding-xxlarge` | 5rem | 4rem | 3rem | padding vertical secțiuni |

- Gap-urile de grid/flex (16 / 32 / 64 / 80) stau pe **clasele custom părinte** (`services_list` 1rem, `group_list` 2rem, `split_component` 4rem, `about-hero_component` 5rem), cu override pe breakpoint-uri (§9).
- Valorile off-grid (10, 14, 18px) se rotunjesc în clasele custom: 10 → 0.625rem (gap eyebrow/buton), 14 → 0.875rem (gap statistici), 18 → 1.125rem (padding buton, ca înălțimea să rămână 50px).

### 4.6 Radius, border și inconsecvențe rezolvate

**Radius (colecția `UI Styles`):**

| Variabilă | Valoare | Folosire |
|---|---|---|
| `Radius/small` | **0.125rem (2px)** | butoane (inclusiv outline, unde Figma avea 1px), carduri, toate wrapper-ele de imagine, butoanele navbar |
| `Radius/medium` | 0.25rem (4px) | input newsletter |

**Border:** întotdeauna `1px solid` (px, conform excepției Client-First), culoare din `Border Color/*`. Umbre nu există.

**Inconsecvențe Figma → o singură valoare de sistem:**

| Inconsecvență | Valori Figma | **Valoare de sistem** |
|---|---|---|
| Letter-spacing H2 | 1.65px / 1.2px / 1.0588px | **0.03em** pe `h2` (= 1.2px la 40px; la H1 54px dă 1.62px ≈ 1.65px) |
| Spacere duble în hero | 24 + 32 = 56px (H1 → P) + spacer-32 final gol | **`spacer-medium` (2rem)** între H1 și P. Spacer-ul final **se elimină** |
| Spacere duble în split 2/3 | 16 + 32 = 48px înainte de buton (split 1: 32) | **`spacer-medium` (2rem)** în toate cele 3 split-uri |
| Footer 1240 vs pagină 1280 | padding 100px → 1240 | **`padding-global` + `container-large` (80rem = 1280)**. Vertical: `padding-section-medium` (5rem) |
| Nume container | frame-uri `container-medium` cu 1280px | **`container-large`** (80rem). `container-medium` rămâne la valoarea Client-First de 64rem |
| Radius imagini | 0 (hero, split 2/3), 2px (split 1, standards) | **`Radius/small` pe toate** |
| Secțiunea presă scalată ×1.0588 | 84.7 / 42.35 / 50.8 / 33.9 / 1355px | normalizată: `padding-section-medium`, `container-large`, gap 3rem (titlu → carduri), gap carduri 2rem |
| Metrics cu padding-top 0 | — | spacing wrapper `padding-bottom padding-xxlarge` (fără padding-top) |
| Raport imagine Standards | 540×440 (1.227) | **5/4**, ca split-urile (diferență de 8px în înălțime) |
| Cardurile Group cu poziționare absolută; linkurile „Discover” nealiniate | y 363 vs 385 | flex column, iar linkul primește `margin-top: auto` (aliniat jos) |
| Icon-ul P/H din Services are 32×17 | celelalte au 28×28 | toate iconurile în `services_icon` 1.75rem × 1.75rem, SVG cu `viewBox` normalizat |
| Buton navbar 40px vs 44px | REQUEST QUOTE 40 | `button is-small` rămâne 2.5rem (40px), conform Figma. Butoanele-icon au 2.75rem (44px) |
| Banda goală de 20px deasupra imaginii în cardurile de presă | — | eliminată |

**`max-width-*` personalizate (decizie de proiect):**

| Clasă | Client-First default | **Proiect** | Folosire |
|---|---|---|---|
| `max-width-medium` | 32rem | **35rem** (560) | coloana text hero, paragraful header-ului Metrics (544 ≈ 35rem) |
| `max-width-large` | 48rem | **45rem** (720) | toate header-ele de secțiune |

---

## 5. Stiluri globale

### 5.1 Embed-ul Global Styles (componenta existentă „Global Styles”)

Conținutul embed-ului se aliniază la embed-ul oficial Client-First v2:

- font smoothing (`-webkit-font-smoothing: antialiased`), `text-rendering: optimizeLegibility`;
- focus vizibil: `*[tabindex]:focus-visible, input[type="file"]:focus-visible { outline: 0.125rem solid var(--semantic--border-color--focus); outline-offset: 0.125rem; }`. Numele variabilei se confirmă în Designer după pasul 02;
- `!important` pe `margin-0`, `padding-0`, `spacing-clean`, pe clasele de direcție (`margin-top`, `padding-bottom` etc.) și pe `hide`, `hide-tablet`, `hide-mobile-landscape`, `hide-mobile-portrait`. Se verifică numele exact al clasei de mobil portrait existente (`hide-mobile-portrait` vs `hide-mobile`) și se folosește unul singur;
- `container-*`: `margin-left/right: auto !important`;
- reset rich text (primul/ultimul copil fără margin), `inherit-color`, `text-style-2lines/3lines`;
- `.w-nav-overlay` / `.w-nav-menu` pentru navbar la tabletă (vezi §6.1);
- **fără** reguli Relume care nu au corespondent Client-First (se compară linie cu linie).

### 5.2 Stiluri de tag

| Tag | Stil |
|---|---|
| `body` | `Font Family/body`, 1rem, lh 1.5, ls 0.025em, color `Text Color/primary`, background `Background Color/alternate` |
| `h1`–`h6` | `Font Family/heading`, 700, mărimile din §4.4, margin 0, **fără culoare** (moștenită de la secțiune) |
| `p` | margin 0 |
| `a` | color `Link Color/primary`, text-decoration none |
| `em` | fără stil (moștenește familia și weight-ul, italic implicit) |
| `ul`, `ol` | margin 0, padding-left 1.25rem (listele semantice din componente primesc clasă custom cu padding 0 și `list-style: none`) |
| `img` | max-width 100%, display inline-block, vertical-align middle |

### 5.3 Structură și containere

| Clasă | base | 991 | 767 | 479 |
|---|---|---|---|---|
| `padding-global` | padding-left/right **2.5rem** | 2.5rem | 1.25rem | 1.25rem |
| `container-large` | max-width **80rem** | — | — | — |
| `container-medium` | 64rem | — | — | — |
| `container-small` | 48rem | — | — | — |
| `padding-section-small` | 3rem | — | 2rem | — |
| `padding-section-medium` | **5rem** | 4rem | 3rem | — |
| `padding-section-large` | 8rem | 6rem | 4rem | — |
| `page-wrapper` | fără stiluri (**fără `overflow: hidden`**, altfel navbar-ul sticky nu mai funcționează) | | | |
| `main-wrapper` | fără stiluri, tag `<main>`, id `main` (ținta skip-link-ului) | | | |

### 5.4 Utilitare noi sau ajustate

| Clasă | Stil |
|---|---|
| `background-color-primary` | background `Background Color/primary`, color `Text Color/alternate` |
| `background-color-alternate` | background `Background Color/alternate`, color `Text Color/primary` (înlocuiește `background-color-white`) |
| `image-cover` | width 100%, height 100%, `object-fit: cover`, position absolute, inset 0 (se folosește **doar** în interiorul unui `*_image-wrapper`) |
| `text-style-link` | color inherit, text-decoration underline, text-underline-offset 0.15em. Hover: color `Link Color/primary` |
| `spacer-custom1`, `spacer-custom2` (+ `margin-`/`padding-custom1/2`) | vezi §4.5 |
| `speakable` | **fără stiluri**. Hook pentru `SpeakableSpecification` din JSON-LD (se păstrează clasa de pe vechi) |

**Pattern pentru imagini placeholder:** `div.[folder]_image-wrapper` (position relative, overflow hidden, `aspect-ratio`, `border-radius: Radius/small`, width 100%) > `img.image-cover`. Elementul este Image fără asset (Webflow afișează placeholder-ul implicit), cu alt text setat (§7), `loading` = eager doar pe hero și lazy pe rest.

### 5.5 Butoane

| Clasă | Rol | Stil base | Hover (propunere; Figma nu are stări) |
|---|---|---|---|
| `button` | primar pe fundal deschis | display inline-flex, justify/align center, gap 0.625rem, padding **1.125rem 2rem**, bg `Background Color/primary`, color `Text Color/alternate`, border 1px solid `Border Color/alternate`, radius `Radius/small`, body 600, **0.75rem**, lh 1.2, ls **0.1em**, uppercase, text-align center, transition 200ms (background-color, color, border-color) | opacity 0.9 (fără token nou) |
| `button is-secondary` | **outline cu săgeată** (Figma „lj-button--outline-on-light”) | bg transparent, color `Text Color/primary`, border `Border Color/alternate`. Înălțime rezultată ≈ 50px | bg `Background Color/primary`, color `Text Color/alternate` (inversare) |
| `button is-alternate` | alb pe fundal închis | bg `Background Color/alternate`, color `Text Color/primary`, border-color `Background Color/alternate` | opacity 0.9 |
| `button is-small` | mărime compactă | padding **0.75rem 1.25rem**, font-size **0.8125rem**, ls 0.12em (Figma REQUEST QUOTE: 12/20, 13px, 1.56px) | — |
| `button is-link` | link text („Discover”, „Read more”) | bg none, border none, padding 0, color `Link Color/primary`, gap 0.5rem | săgeata se mută `translateX(0.25rem)` |
| `button is-icon` | buton cu icon (se combină cu variantele de mai sus) | display flex. Copil `div.button_icon` 0.875rem × 0.875rem, flex none, SVG săgeată `currentColor` | — |

Combinații folosite (maxim 3 clase):

- **outline cu săgeată** = `button is-secondary is-icon`;
- **small on dark** (REQUEST QUOTE) = `button is-small is-alternate`;
- **link „Discover”** = `button is-link is-icon`.

SVG săgeată (embed în `button_icon`, `aria-hidden="true"`):

```html
<svg width="100%" height="100%" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M1 7h12M8 2l5 5-5 5" stroke="currentColor" stroke-width="1.2"/></svg>
```

### 5.6 Eyebrow (tagline)

`div.tagline_component` (flex, align center, gap 0.625rem, color inherit)

- `div.tagline_line`: 1.5rem × 1px, background `currentColor`, flex none
- `p.tagline_text`: §4.4

Pe secțiunile închise culoarea vine de la `background-color-primary`, deci nu e nevoie de variantă.

### 5.7 Breakpoint-uri

Webflow standard: base (≥992), **991** tabletă, **767** mobile landscape, **479** mobile portrait.

În plus, **breakpoint-ul 1280** se activează **doar pentru navbar** (§6.1 și §9). Nicio altă clasă nu primește stiluri la 1280.

---

## 6. Componente reutilizabile

Legendă: **C** = componentă Webflow (cu props), **K** = doar clase (pattern documentat).

### 6.1 Navbar (**C** `Navbar`)

- **Props:** niciuna în Faza C. Starea curentă (`w--current`) e gestionată de Webflow. Ulterior, prop de vizibilitate `Show language switcher` (implicit off până la D20).
- **Element:** Webflow **Navbar** (`w-nav`), collapse la **Tablet**.
- `navbar_component`:
  - `position: sticky`, top 0, z-index 1000, bg `Background Color/primary`, border-bottom 1px `Border Color/on dark`, `backdrop-filter: blur(16px)`;
  - fără radius: radius-ul de 1px din Figma se ignoră, pentru că bara e full-width.

```
div.navbar_component  [w-nav, role=banner]
├─ a.navbar_skip-link  "Skip to content" → #main   (vizibil doar la focus)
└─ div.navbar_container   (flex, space-between, align center, padding 1rem 1.5rem, min-height 4.75rem)
   ├─ a.navbar_logo-link [w-nav-brand] → / (Page link Home)   aria-label="LunaJets - Go to homepage"
   │  └─ div.navbar_logo   (embed SVG logo alb, 6.25rem × 1.25rem)
   ├─ nav.navbar_menu [w-nav-menu]   (flex, gap 1.5rem)
   │  ├─ a.navbar_link [w-nav-link]  "About us"            → /en/about-us
   │  ├─ a.navbar_link               "Why LunaJets"        → /en/why-lunajets
   │  ├─ a.navbar_link               "Private jet charter" → /en/private-jet-charter
   │  ├─ a.navbar_link               "Pricing"             → /en/prices
   │  ├─ a.navbar_link               "Aircraft"            → /en/fleet
   │  └─ div.navbar_menu-extras  (hide pe desktop; vizibil în meniul mobil ≤767)
   │     ├─ a.navbar_link  "Login" → https://www.members.lunajets.com/en/login
   │     └─ a.button.is-alternate  "Request quote" → /en?requestFlight=1      (D12)
   ├─ div.navbar_buttons   (flex, gap 1rem)
   │  ├─ a.navbar_icon-button  → https://www.members.lunajets.com/en/login   aria-label="Login"
   │  │  └─ div.navbar_icon  (embed SVG user, 1.25rem)
   │  ├─ div.navbar_dropdown [w-dropdown]   (selector limbă; hide până la D20)
   │  │  ├─ div.navbar_icon-button.is-dropdown [w-dropdown-toggle]  "EN" + div.navbar_chevron
   │  │  └─ nav.navbar_dropdown-list [w-dropdown-list]  (8 locale, după Localization)
   │  ├─ div.navbar_dropdown [w-dropdown]   (contact)
   │  │  ├─ div.navbar_icon-button.is-dropdown [w-dropdown-toggle]  aria-label="Contact options"
   │  │  │  ├─ div.navbar_icon (embed telefon)   └─ div.navbar_chevron
   │  │  └─ nav.navbar_dropdown-list [w-dropdown-list]
   │  │     ├─ a.navbar_dropdown-link  "lunajets@lunajets.com" → mailto:
   │  │     ├─ a.navbar_dropdown-link  "Switzerland +41 22 782 12 12" → tel:+41227821212
   │  │     ├─ … (cele 13 numere din audit §4.1; Poland +377… de confirmat, vezi §11 QA)
   │  │     └─ a.navbar_dropdown-link  "WhatsApp" → https://api.whatsapp.com/send?phone=41793311212 (target _blank)   (D9)
   │  └─ a.button.is-small.is-alternate  "Request quote" → /en?requestFlight=1   (hide ≤767)
   └─ div.navbar_menu-button [w-nav-button]   aria-label="Menu"   (hamburger, vizibil ≤991)
      └─ div.navbar_menu-icon > div.navbar_menu-line ×3
```

- `navbar_icon-button`: 2.75rem × 2.75rem, padding 0.75rem, bg `Background Color/tertiary`, radius `Radius/small`, `backdrop-filter: blur(17px)`, color `Text Color/alternate`.
- `is-dropdown`: width auto, gap 0.75rem.
- `navbar_link`: color `Link Color/alternate`, hover opacity 0.7.

**Problema de lățime:** navbar-ul Figma are nevoie de ~1230px (5 linkuri + 4 butoane). La base (992–1279px) nu încape. Soluția:

- la **base**: `navbar_menu` gap 1rem, `navbar_link` 0.75rem, iar selectorul de limbă și dropdown-ul de telefon primesc `display: none` (clasa custom `navbar_dropdown`);
- la **1280+**: gap 1.5rem, 0.8125rem, dropdown-urile vizibile.

### 6.2 Footer (**C** `Footer`)

- **Props:** niciuna (conținut global).
- `footer_component`: tag `<footer>`, bg `Background Color/primary`, color `Text Color/alternate`.

```
footer.footer_component
└─ div.padding-global.padding-section-medium
   └─ div.container-large
      ├─ div.footer_top   (flex, space-between, align start)
      │  ├─ div.footer_brand   (flex column, gap 1rem)
      │  │  ├─ a.footer_logo-link → /   aria-label="LunaJets - Go to homepage"
      │  │  │  └─ div.footer_logo  (embed SVG, 10.1875rem × 2rem)
      │  │  └─ div.footer_social-list  (flex, gap 0.75rem)
      │  │     └─ a.footer_social-link ×5  (target _blank, aria-label)  > div.footer_social-icon (1.25rem, embed SVG)
      │  │        ordine Figma: Facebook, X, Instagram, YouTube, LinkedIn  (URL-uri din audit §4.2)
      │  └─ div.footer_app-list  (flex, gap 1rem)
      │     ├─ a.footer_app-link → App Store URL  > div.footer_app-image-wrapper (5.625rem × 1.875rem) > img.image-cover alt="Download mobile app on the App Store"
      │     └─ a.footer_app-link → Google Play URL > … alt="Download mobile app on Google Play"
      ├─ div.spacer-large
      ├─ div.footer_middle   (grid: 1fr 22.5rem, gap 3rem)
      │  ├─ div.footer_link-grid   (grid 4 col auto, gap 3rem)
      │  │  └─ div.footer_link-column ×4
      │  │     ├─ p.footer_column-title   "Aircraft" | "Luna Aviation Group" | "Destinations" | "Contact us"
      │  │     ├─ div.spacer-custom2
      │  │     └─ ul.footer_link-list [role=list] (flex column, gap 0.75rem, list-style none, padding 0)
      │  │        └─ li > a.footer_link
      │  │           Aircraft: Private Jet Charter → /en/private-jet-charter · Empty Legs → /en/empty-leg-flights · Fleet → /en/fleet · Jet Comparator → /en/why-lunajets/jet-comparator
      │  │           Luna Aviation Group: LunaJets → /en · LunaGroup Charter → https://www.lunagroupcharter.com/ · LunaLogistik (hide, D15) · LunaSolutions → https://www.lunaaircraftsolutions.com/
      │  │           Destinations: Countries & cities → /en/destinations · Airports → /en/airports
      │  │           Contact us: Contact → /en/contact-us
      │  └─ div.footer_newsletter
      │     ├─ p.footer_column-title  "Newsletter"
      │     ├─ div.spacer-small
      │     └─ div.form_component [w-form]
      │        ├─ form.footer_newsletter-form  (position relative)   aria-label="Newsletter signup"
      │        │  ├─ label.footer_newsletter-label  "Email"   (sr-only: ascuns vizual, citit de screen readere)
      │        │  ├─ input.form_input.is-newsletter  type=email, name=email, placeholder="Enter your email", required
      │        │  └─ button.footer_newsletter-submit (input submit sau button)  aria-label="Subscribe"  > div.button_icon (săgeată)
      │        ├─ div.form_message-success  "Thank you! You are subscribed."
      │        └─ div.form_message-error  "Something went wrong. Please try again."
      ├─ div.spacer-large
      ├─ div.footer_divider   (height 1px, bg `Border Color/on dark`)
      ├─ div.spacer-medium
      └─ div.footer_bottom   (flex column, gap 2rem)
         ├─ div.footer_bottom-row   (flex, space-between, align center)
         │  ├─ div.footer_swiss  (flex, gap 0.75rem, align center)
         │  │  ├─ div.footer_flag  (embed SVG CH, 1.5rem × 1.25rem, aria-hidden)
         │  │  └─ p.footer_swiss-text  "A Swiss-based company."
         │  └─ div.footer_association-list  (flex, gap 2rem, align center, wrap)
         │     └─ a.footer_association-link ×5  (target _blank, rel noopener)  > div.footer_association-image-wrapper > img.image-cover
         │        The Air Charter Association · ARGUS Certification · EBAA · NBAA · MEBAA (D8)   (alt-uri și URL-uri din audit §4.2)
         ├─ div.footer_legal-links  (flex, gap 1.5rem, wrap)   (D8)
         │  ├─ a.footer_legal-link "Terms & Conditions" → /en/terms-conditions
         │  ├─ a.footer_legal-link "Privacy Policy" → /en/privacy-policy
         │  └─ a.footer_legal-link "Legal Notice" → /en/legal-notice
         └─ div.footer_legal   (flex column, gap 0.375rem)
            ├─ p.footer_legal-text  "© <span data-year>2026</span> LunaJets. All Rights Reserved."   (D19)
            └─ p.footer_legal-text  "LunaJets is an air charter broker and only acts as an intermediary between third-party aircraft operators and the client. LunaJets arranges carriage by air by chartering aircraft from the operator, acting as agent, in the name and on behalf of the client. LunaJets does not itself operate aircraft, is not a contracting or indirect carrier and does not provide air transportation services."
```

Clarificări pentru arbore:

- Label-ul de email: clasă custom `footer_newsletter-label` (stil „sr-only”: position absolute, 1px, clip), cu text `Email`.
- `footer_swiss-text`: body 700, 0.75rem, ls 0.02em, alb.
- `footer_legal-link`: 0.75rem, 700, `Text Color/tertiary`, hover alb.
- `form_input is-newsletter`: min-height 4.125rem (66px), padding 0.75rem 3.5rem 0.75rem 1.25rem, bg `Background Color/tertiary`, border none, radius `Radius/medium`, color alb, 700, 1rem, ls 0.05em.
- `footer_newsletter-submit`: absolute right 0.75rem, 2.75rem pătrat.
- Script an dinamic (Footer, embed): `document.querySelectorAll('[data-year]').forEach(e=>e.textContent=new Date().getFullYear())`.

### 6.3 Eyebrow (**C** `Tagline`)

- **Props:** `Text` (text, implicit „Our story”).
- **Arbore:** `div.tagline_component > div.tagline_line + p.tagline_text`
- Textul se scrie în sentence case. Uppercase vine din CSS.

### 6.4 Section header (**K**, doar clase)

Titlul are `<em>` inline și nivelul de heading poate varia, ceea ce props-urile de text nu acoperă curat. Pattern:

```
div.max-width-large            (+ .text-align-center .align-center pentru varianta centrată)
├─ [Tagline]                    (opțional)
├─ div.spacer-custom1
├─ h2  "Line one<br><em>line two</em>"
├─ div.spacer-custom2          (doar dacă urmează paragraf)
└─ div.max-width-medium > p     (opțional)
```

### 6.5 Butoane (**K** + **C** `Button Arrow`)

- Butoanele fără icon (`Request quote`) folosesc doar clase (§5.5).
- **C `Button Arrow`** (săgeata SVG se repetă de 10+ ori):
  - **Props:** `Text` (text), `Link` (link, cu opțiunea new tab), `Variant` (variantă: `Outline` = `button is-secondary is-icon` | `Text link` = `button is-link is-icon`).
  - Dacă variantele de componentă nu sunt disponibile în Designer: 2 componente separate, `Button Outline Arrow` și `Text Link Arrow`.
  - **Arbore:** `a.button.is-secondary.is-icon > div (text) + div.button_icon (embed săgeată)`.
  - Pentru `aria-label` diferit de text (de ex. 3 × „Discover”): custom attribute pe instanță. Dacă atributul nu se poate seta pe instanță, textul vizibil se completează cu `span` sr-only (de ex. „Discover<span class="button_sr-text"> LunaGroup Charter</span>”).

### 6.6 Stat item (**C** `Stat Item`)

- **Props:** `Number` (text), `Suffix` (text), `Show suffix` (vizibilitate), `Label` (text).

```
div.stats_item   (flex column, gap 0.875rem)
├─ div.stats_number-wrapper   (flex, align baseline, gap 0.125rem)
│  ├─ p.stats_number   "12,000"
│  └─ p.stats_suffix   "+"
└─ p.stats_label       "Flights organised in 2025"
```

Părintele este `div.stats_list` (K):

- grid 4 col, gap 2rem, padding 2.5rem 0;
- border-top și border-bottom 1px `Border Color/secondary`.

### 6.7 Bloc split imagine/text + variantă inversată (**K**)

```
div.split_component   (grid 1fr 1fr, gap 4rem, align-items center)
├─ div.split_content
│  ├─ h2 …
│  ├─ div.spacer-custom2
│  ├─ p … [div.spacer-small, p …]
│  ├─ div.spacer-medium
│  └─ [Button Arrow — Outline]
└─ div.split_image-wrapper   (aspect-ratio 5/4, radius small, overflow hidden, relative)
   └─ img.image-cover
```

- **Varianta inversată (imagine stânga) = ordinea DOM inversată** (`split_image-wrapper` primul). Nu e nevoie de combo.
- Pe ≤991, `split_image-wrapper` primește `order: -1` pe clasa de bază, deci imaginea ajunge deasupra textului în **toate** blocurile, indiferent de ordinea DOM.
- Combo **`split_component is-standards`**: grid 11fr 9fr, gap 5rem. Se folosește doar în Standards.

### 6.8 Service card (**K**)

Iconurile sunt SVG inline (embed), nu props de imagine.

```
ul.services_list [role=list]  (flex, wrap, justify center, gap 1rem, list-style none, padding 0)
└─ li.services_card   (flex column, justify/align center, gap 0.75rem, padding 1.75rem 1rem, min-height 7.375rem,
                       width calc((100% - 4rem)/5), bg Background Color/primary, border 1px Border Color/on dark, radius small)
   ├─ div.services_icon   (1.75rem × 1.75rem, color alb, embed SVG normalizat viewBox 0 0 28 28, aria-hidden)
   └─ h3.services_card-title   "24/7 worldwide"
```

### 6.9 Group card (**C** `Group Card`)

- **Props:**
  - `Image` (imagine, cu alt),
  - `Title` (text),
  - `Description` (text),
  - `Link` (link, new tab pentru externe),
  - `Link label` (text, implicit „Discover”),
  - `Accent` (variantă: `Default` | `Orange` → `group_card-title is-accent`, D4).

```
div.group_card   (flex column, align center, text center, padding 2.25rem 2rem 2rem, border 1px Border Color/primary, radius small,
                  width calc((100% - 4rem)/3))
├─ div.group_card-image-wrapper   (width 100%, max-width 17.5rem, aspect-ratio 3/2, relative, overflow hidden)
│  └─ img.image-cover
├─ div.spacer-custom2
├─ h3.group_card-title   "LunaGroup Charter"   (+ is-accent)
├─ div.spacer-xsmall  (0.5rem; Figma ~12px. Rotunjit la scala existentă, fără margin pe elementul de text)
├─ p.group_card-text
└─ div.group_card-link-wrapper   (margin-top auto, padding-top 1.5rem)
   └─ [Button Arrow — Text link]
```

### 6.10 Press card (**C** `Press Card`; va deveni template de Collection List, §8)

- **Props:**
  - `Background image` (imagine, decorativă, alt gol),
  - `Logo` (imagine, alt = numele publicației),
  - `Excerpt` (text),
  - `Date` (text),
  - `Link` (link extern, new tab).

```
div.press_card   (flex column, border 1px Border Color/primary, radius small, overflow hidden, width calc((100% - 4rem)/3))
├─ div.press_card-image-wrapper   (aspect-ratio 5/2, relative, overflow hidden, flex center)
│  ├─ img.image-cover   (alt="")
│  ├─ div.press_card-overlay   (absolute inset 0, bg rgba(6,29,56,0.85))
│  └─ div.press_card-logo-wrapper   (relative, z-index 1, height 2.25rem, max-width 70%)
│     └─ img.press_card-logo   (height 100%, width auto, object-fit contain; alt="Financial Times")
└─ div.press_card-body   (flex column, align center, text center, gap 1.5rem, padding 1.5rem)
   ├─ p.press_card-text
   ├─ p.press_card-date
   └─ [Button Arrow — Text link]  "Read more"
```

### 6.11 Discover link (**K**, parte din `Button Arrow`, varianta `Text link`)

`a.button.is-link.is-icon > div "Discover" + div.button_icon` (0.8125rem).

---

## 7. Structura paginii About

**Pagina Webflow:** nume „About us”, slug `about-us`, fără folder părinte.

```
body
└─ div.page-wrapper
   ├─ [Global Styles]
   ├─ [Navbar]
   ├─ main.main-wrapper#main
   │  ├─ 7.1 section.section_about-hero
   │  ├─ 7.2 section.section_about-metrics
   │  ├─ 7.3 section.section_about-services.background-color-primary
   │  ├─ 7.4 section.section_about-group
   │  ├─ 7.5 section.section_about-standards
   │  └─ 7.6 section.section_about-press
   └─ [Footer]
```

### 7.1 Hero

```
section.section_about-hero
└─ div.padding-global.padding-section-medium
   └─ div.container-large
      └─ div.about-hero_component   (grid 7fr 8fr, gap 5rem, align-items center)
         ├─ div.about-hero_content
         │  ├─ [Tagline] Text="Our story"                                   [F]
         │  ├─ div.spacer-custom1
         │  ├─ h1  "About<br><em>LunaJets</em>"                             [F]=[V]
         │  ├─ div.spacer-medium                                            (56px → 2rem)
         │  ├─ p.speakable  "Founded in December 2007, LunaJets was one of the first private jet brokers to offer an online booking experience. Since then, leveraging proprietary technology, LunaJets has become the European market leader in private jet charter services."   [F]
         │  ├─ div.spacer-custom2
         │  ├─ p.speakable  "In 2025, the company has organised over 12,000 flights and surpassed €180m in revenue, making it one of the fastest-growing companies in the industry."   [F] (D2, D3)
         │  ├─ div.spacer-medium                                            (D10)
         │  └─ [Button Arrow — Text link] "Read our history" → /en/why-lunajets/our-history   [V] (D10)
         └─ div.about-hero_image-wrapper   (aspect-ratio 64/45, radius small, overflow hidden, relative)
            └─ img.image-cover   loading=eager
               slot: 640 × 450 (64:45) · alt: "LunaJets headquarters office building in Geneva"
```

### 7.2 Metrics (header + statistici + 3 split-uri)

```
section.section_about-metrics
└─ div.padding-global
   └─ div.container-large
      └─ div.padding-bottom.padding-xxlarge        (padding-top 0, conform Figma)
         └─ div.about-metrics_component   (flex column, gap 4rem; 991: 3rem; 767: 2.5rem)
            ├─ div.max-width-large
            │  ├─ [Tagline] Text="Since 2007"                                       [F]
            │  ├─ div.spacer-custom1
            │  ├─ h2  "A European leader<br><em>since 2007</em>"                    [F]=[V]
            │  ├─ div.spacer-custom2
            │  └─ div.max-width-medium
            │     └─ p  "A market leader by every measure that matters — flight volume, revenue, and the breadth of clients we serve, year after year."   [F]
            ├─ div.stats_list
            │  ├─ [Stat Item] Number="12,000" Suffix="+"  Label="Flights organised in 2025"                 [F+V] (D2)
            │  ├─ [Stat Item] Number="€180"   Suffix="m"  Label="2025 revenue"                              [F] (D3)
            │  ├─ [Stat Item] Number="7"      Show suffix=off Label="Offices across Europe & Middle East"   [V] (D1)
            │  └─ [Stat Item] Number="4,800"  Suffix="+"  Label="Aircraft in our network"                   [F]=[V]
            ├─ div.split_component                                   (split 1: text | imagine)
            │  ├─ div.split_content
            │  │  ├─ h2  "A global reach mixed with local <em>expertise</em>"          [F]
            │  │  ├─ div.spacer-custom2
            │  │  ├─ p  "Our offices are strategically located across Europe and the Middle East, with a spread going from [Madrid] to [Dubai]. Headquartered in [Geneva], we are also present in [Paris], [London], [Zurich] and [Riga]."   [F+V] (D10b)
            │  │  │     fiecare oraș = a.text-style-link → /en/contact-us/{madrid-spain|dubai-uae|geneva-switzerland|paris-france|london-uk|zurich-switzerland|riga-latvia}
            │  │  ├─ div.spacer-small
            │  │  ├─ p  "This local presence reflects our commitment to always being close to our clients, offering unmatched regional expertise as well as cultural and linguistic proximity."   [F]
            │  │  ├─ div.spacer-medium
            │  │  └─ [Button Arrow — Outline] "View all local offices" → /en/why-lunajets/our-locations   [F]=[V]
            │  └─ div.split_image-wrapper > img.image-cover
            │        slot: 600 × 480 (5:4) · alt: "Aerial view of Lake Geneva with the Jet d'Eau fountain and boats docked in the marina"  [V adaptat]
            ├─ div.split_component                                   (split 2: imagine | text — DOM inversat)
            │  ├─ div.split_image-wrapper > img.image-cover
            │  │     slot: 600 × 480 (5:4) · alt: "Eymeric Segard and Guillaume Launay sitting in the LunaJets Geneva office"  [V]
            │  └─ div.split_content
            │     ├─ h2  "Backed by a deep industry <em>knowledge</em>"                 [F]
            │     ├─ div.spacer-custom2
            │     ├─ p  "United by a passion for operational excellence and a strong focus on the client above all, LunaJets management team offers a comprehensive expertise in private aviation."   [F]=[V]
            │     ├─ div.spacer-medium                                   (48px → 2rem)
            │     └─ [Button Arrow — Outline] "Discover our management" → /en/why-lunajets/global-management
            └─ div.split_component                                   (split 3: text | imagine)
               ├─ div.split_content
               │  ├─ h2  "A dedicated team committed to <em>excellence</em>"          [F]
               │  ├─ div.spacer-custom2
               │  ├─ p  "Our private aviation advisors are available 24/7 to support every aspect of your journey and match all your expectations wherever you are."   [F]=[V]
               │  ├─ div.spacer-medium
               │  └─ [Button Arrow — Outline] "Meet our team" → /en/why-lunajets/our-team
               └─ div.split_image-wrapper > img.image-cover
                     slot: 600 × 480 (5:4) · alt: "LunaJets private aviation advisors checking flight routes"  [V]
```

### 7.3 Services (dark)

- `section_about-services`: `background-image` = gradientul din §4.2 peste `Background Color/primary`, dat de `background-color-primary`.
- Clasele se aplică în ordinea `section_about-services` (custom) + `background-color-primary` (utilitar global). Stilurile se pun doar pe `section_about-services`, nu pe combo.

```
section.section_about-services.background-color-primary
└─ div.padding-global.padding-section-medium
   └─ div.container-large
      ├─ div.max-width-large
      │  ├─ [Tagline] Text="Our service standard"                    [F]
      │  ├─ div.spacer-custom1
      │  └─ h2  "High-end<br><em>quality service</em>"              [F] (fără U+200D)
      ├─ div.spacer-xlarge
      └─ ul.services_list
         ├─ li.services_card > div.services_icon (glob/busolă) + h3.services_card-title "24/7 worldwide"
         ├─ li.services_card > (advisor) + "Dedicated private advisor"
         ├─ li.services_card > (hartă) + "Support in multiple languages"
         ├─ li.services_card > (P/H normalizat 28×28) + "Car & helicopter transfers"      [F]
         └─ li.services_card > (clopoțel) + "VIP concierge service"
```

Iconurile se refolosesc din SVG-urile inline ale paginii vechi (audit §3.3), normalizate la `viewBox="0 0 28 28"`, `stroke="currentColor"`. Nu se urcă asset-uri.

### 7.4 Luna Aviation Group

```
section.section_about-group
└─ div.padding-global.padding-section-medium
   └─ div.container-large
      ├─ div.max-width-large
      │  ├─ [Tagline] Text="The Luna Aviation Group"                               [F]=[V]
      │  ├─ div.spacer-custom1
      │  ├─ h2  "Delivered with<br><em>Swiss excellence</em>"                      [F]
      │  ├─ div.spacer-custom2
      │  └─ p.speakable  "From on-demand private jet charters to industry-specific solutions, the Luna Aviation Group knows how to address every travel requirement. Whether you are flying for business, enjoying leisure with loved ones, moving a large group, or considering aircraft acquisition — you benefit from a fully tailored service designed around your exact needs."   [F]
      ├─ div.spacer-xlarge
      └─ div.group_list   (flex, wrap, justify center, align stretch, gap 2rem)
         ├─ [Group Card] Title="LunaJets" Description="A European leader in private jet charter. LunaJets organises private jet flights anywhere in the world." Link=/en/private-jet-charter (D16) Accent=Default
         │     slot 280 × 186 (3:2) · alt: "White private jet on the runway with its airstair open"
         ├─ [Group Card] Title="LunaGroup Charter" Description="The expertise to organise group flights — from conferences and incentive trips to entire team or family movements." Link=https://www.lunagroupcharter.com/ (new tab) Accent=Orange (D4)
         │     slot 280 × 186 (3:2) · alt: "Private jet cabin with cream leather seats for group travel"
         └─ [Group Card] Title="LunaSolutions" Description="Aircraft acquisition, sales and management — for clients ready to step into ownership with confidence." Link=https://www.lunaaircraftsolutions.com/ (new tab) Accent=Default
               slot 280 × 186 (3:2) · alt: "Close-up of an aircraft jet engine fan blades in black and white"
```

- Link label pe toate: `Discover` [F].
- Numele accesibile: „Discover LunaJets”, „Discover LunaGroup Charter (opens in a new tab)”, „Discover LunaSolutions (opens in a new tab)”.

### 7.5 Standards

```
section.section_about-standards
└─ div.padding-global.padding-section-medium
   └─ div.container-large
      └─ div.split_component.is-standards
         ├─ div.split_content
         │  ├─ [Tagline] Text="Certifications & standards"                          [F]=[V]
         │  ├─ div.spacer-custom1
         │  ├─ h2  "Exceeding the highest<br><em>standards</em>"                    [F]
         │  ├─ div.spacer-medium
         │  ├─ p.split_lead  "LunaJets was the first European broker to obtain the ARGUS certification."   [F]
         │  ├─ div.spacer-custom2
         │  ├─ p.speakable  "As a European leader in private aviation, LunaJets is dedicated to setting the highest standards in charter integrity and social responsibility. Certified as an ARGUS broker for over a decade, we also support initiatives to reduce our clients’ carbon footprint, offering the option to fly with Sustainable Aviation Fuel (SAF) for a more environmentally responsible journey."   [F]=[V]
         │  ├─ div.spacer-medium
         │  └─ [Button Arrow — Outline] "Discover more" → /en/corporate-social-responsibility   [F] (href [V])
         │        nume accesibil: "Discover more about our commitments"
         └─ div.split_image-wrapper > img.image-cover
               slot 540 × 440 → 5:4 (§4.6) · alt: "Wind turbines on a green hillside under a blue sky"   (D17)
```

### 7.6 As featured in

```
section.section_about-press
└─ div.padding-global.padding-section-medium
   └─ div.container-large
      └─ div.about-press_component   (flex column, align center, gap 3rem)
         ├─ div.max-width-large.text-align-center
         │  └─ h2  "As featured in"                                  [F] (fără eyebrow, conform Figma)
         ├─ div.press_list   (flex, wrap, justify center, gap 2rem, width 100%)
         │  ├─ [Press Card] Logo alt="Financial Times"     Excerpt="[PLACEHOLDER] …" Date="[PLACEHOLDER]" Link=(URL real, D5)
         │  ├─ [Press Card] Logo alt="The New York Times"  …
         │  └─ [Press Card] Logo alt="El Mundo"            …
         │        slot fundal: ~428 × 169 → aspect 5/2 · alt="" (decorativ) · slot logo: înălțime 2.25rem
         └─ [Button Arrow — Outline] "All media coverage" → /en/media-centre   [F]=[V]
```

Fiecare „Read more” primește numele accesibil „Read the article in <Publication> (opens in a new tab)”.

---

## 8. CMS

| Colecție | Recomandare pe termen lung | **Recomandare acum (Faza C)** |
|---|---|---|
| **Press** („As featured in” + viitorul Media Centre) | **Da, colecție.** Va alimenta și `/en/media-centre`. | **Nu o creăm încă.** Secțiunea se construiește cu 3 instanțe ale componentei `Press Card` (conținutul e Lorem ipsum, D5). Structura cardului e deja gândită ca template de Collection List. Colecția se creează odată cu migrarea Media Centre sau când clientul trimite articolele reale. |
| **Offices** | **Da, colecție**, pentru paginile `/contact-us/<oraș>`, eventual footer și JSON-LD `LocalBusiness` dinamic. | **Nu acum.** Figma nu are „Our Offices” pe About (D7). JSON-LD-ul `LocalBusiness` e static în head-ul site-ului. |

**Câmpuri propuse: Press**

| Câmp | Tip | Obligatoriu | Notă |
|---|---|---|---|
| Name | Plain text | ✅ | titlul articolului (intern + meta) |
| Slug | Slug | ✅ | — |
| Publication name | Plain text | ✅ | folosit ca alt pentru logo |
| Publication logo | Image | ✅ | SVG alb, pe overlay navy |
| Background image | Image | — | decorativ (alt gol) |
| Excerpt | Plain text (max 140) | ✅ | textul cardului |
| Publish date | Date/Time | ✅ | afișat `MMMM D, YYYY` |
| Article URL | Link | ✅ | extern, new tab (repară `href="#"` de pe vechi) |
| Language | Option (EN, FR, DE, IT, ES, RU, HU, PL) | ✅ | filtru, ca să nu mai apară articole FR pe pagina EN |
| Featured on About | Switch | — | filtru pentru About |

- Lista de pe About: filtru `Featured on About = on` și `Language = EN`, sortare după dată descrescător, limit 3.
- Pagina-template a colecției nu se leagă nicăieri: **noindex** și excludere din sitemap, pentru că item-urile duc spre articole externe. Media Centre listează toate item-urile fără limită, deci nu apar pagini orfane.

**Câmpuri propuse: Offices**

- Name („Geneva, Switzerland”) ✅, Slug ✅, City ✅, Country ✅, Country code ✅
- Street address ✅, Postal code, Phone display ✅, Phone E.164 (pentru `tel:`) ✅, Email ✅
- Contact page (link) ✅, Google Maps URL, Latitude (number) ✅, Longitude (number) ✅
- Image + Image alt, Opening hours (text, implicit `Mo-Su 00:00-23:59`), Sort order (number)

---

## 9. Reguli responsive (propunere, fără frame-uri Figma pentru tabletă/mobil)

Principii:

- stilurile desktop sunt baza și coboară în cascadă;
- scalarea tipografică din §4.4;
- `padding-global` și `padding-section-*` sunt deja responsive (§5.3);
- gap-urile din clasele custom scad pe breakpoint-uri.

| Secțiune / element | 991 (tabletă) | 767 (mobile landscape) | 479 (mobile portrait) |
|---|---|---|---|
| **Navbar** (1280+ = desktop complet) | Hamburger (`w-nav` collapse Tablet). Meniul devine panou full-width sub bară (bg navy, linkuri stivuite, 1rem, padding 1.5rem). În bară rămân: logo, login, telefon, Request quote, burger | Login și Request quote se mută în meniu (`navbar_menu-extras` vizibil). `navbar_buttons` păstrează doar dropdown-ul de telefon. Padding bară 1.25rem | idem. Padding bară 1rem. Logo 5.5rem |
| **Hero** | 1 coloană. **Text primul, imaginea sub text** (H1 rămâne above-the-fold). Gap 3rem. Imaginea 100% lățime, aspect 64/45 | gap 2rem | — |
| **Metrics header** | `max-width-large` rămâne (sub 720px devine 100%) | — | — |
| **Stats** | grid **2 × 2**, gap 2rem, padding 2rem 0 | 2 × 2, gap 1.5rem | **1 coloană**, gap 1.5rem. Opțional divider între item-uri (border-top pe `stats_item` + `is-` doar dacă e cerut) |
| **Split 1–3** | 1 coloană, gap 2.5rem. **Imaginea deasupra textului în toate blocurile** (`order: -1` pe `split_image-wrapper`). Zig-zag-ul dispare | gap 2rem | Butoanele outline rămân auto-width (min-height 50px e suficient pentru touch) |
| **Services** | Carduri `width: calc((100% - 2rem)/3)`, deci 3 + 2 centrate (flex wrap, justify center) | `calc((100% - 1rem)/2)`, deci 2 + 2 + 1 centrat | idem 2 coloane (etichetele încap la ~170px). Padding card 1.5rem 0.75rem |
| **Group** | `calc((100% - 2rem)/2)`, deci 2 + 1 centrat | 100% (1 coloană), max-width 28rem, centrat | idem. Padding card 2rem 1.5rem |
| **Standards** | 1 coloană, imaginea deasupra (regula split), gap 2.5rem | gap 2rem. `split_lead` 1.25rem | — |
| **Press** | `calc((100% - 2rem)/2)`, 2 + 1 centrat | 1 coloană, max-width 28rem | — |
| **Footer** | `footer_middle` → 1 coloană (link-grid, apoi newsletter full-width, max 30rem). Link-grid 4 coloane rămân | link-grid **2 × 2**, gap 2rem. `footer_top` stivuit (brand, apoi badge-uri app), gap 1.5rem. `footer_bottom-row` stivuit, aliniat stânga, gap 1.5rem. Logo-urile asociațiilor fac wrap, gap 1.5rem, înălțime max 1.75rem | link-grid rămâne 2 × 2 (liste scurte) |
| **Tipografie** | h1 3rem, h2 2.25rem, stats 3rem | h1 2.5rem, h2 2rem, h3 1.25rem, stats 2.75rem, lead 1.25rem | h1 2.25rem, h2 1.75rem, stats 2.5rem |
| **Spacing** | scala Client-First (medium 1.5, large 2.5, xlarge 3, xxlarge 4) | (medium 1.25, large 1.5, xlarge 2, xxlarge 3); custom1 1rem; custom2 1.25rem | — |

**Verificări obligatorii în Faza C:**

- fără scroll orizontal la 320px;
- titlurile H2 cu `<br>` se rup curat;
- ținte touch ≥ 44px în meniu și în footer;
- testare și la **1280** și **1024** (zona 992–1279 a navbar-ului).

---

## 10. SEO pentru pagină

| Element | Valoare | Unde |
|---|---|---|
| Title | `About LunaJets - Private Jet Charter Broker` (43 caractere) [V] | Page settings → SEO |
| Meta description | `As Europe's first ARGUS-certified broker, we provide tailored private aviation solutions and 24/7 support, grounded in excellence and discretion.` (145 caractere; [V] cu „ARGUS-certified” corectat) | Page settings → SEO |
| OG title / description | identice cu title / description | Page settings → Open Graph |
| OG image | foto hero (sediul Geneva), 1200 × 630, **după upload-ul de asset-uri**. Până atunci câmpul rămâne gol pe staging | Page settings → Open Graph |
| `og:url` (lipsea pe vechi) | `<meta property="og:url" content="https://www.lunajets.com/en/about-us">` | Page settings → Custom code → Head |
| `twitter:site` (lipsea) | `<meta name="twitter:site" content="@lunajets">` (handle dedus din `x.com/lunajets`, de confirmat) | Custom code → Head |
| Canonical | self: `https://www.lunajets.com/en/about-us`. Se setează **Global Canonical Tag URL = `https://www.lunajets.com`** în Site settings → SEO **la go-live** (câmp gol = niciun canonical pe site) | Site settings |
| Indexare | staging `*.webflow.io`: indexare dezactivată. Producție: fără `noindex` | Site settings → SEO |
| hreflang | doar prin Webflow Localization (automat). Fără hreflang manual cât timp e doar EN (D20) | — |
| Slug | `about-us` | Page settings |

**Outline headings:**

```
H1  About LunaJets
H2  A European leader since 2007
H2  A global reach mixed with local expertise
H2  Backed by a deep industry knowledge
H2  A dedicated team committed to excellence
H2  High-end quality service
  H3  24/7 worldwide · Dedicated private advisor · Support in multiple languages · Car & helicopter transfers · VIP concierge service
H2  Delivered with Swiss excellence
  H3  LunaJets · LunaGroup Charter · LunaSolutions
H2  Exceeding the highest standards
H2  As featured in
(Navbar și footer: fără headings. Titlurile coloanelor din footer sunt <p>. Statisticile sunt <p>.)
```

**Alt text:** vezi §7. Imaginile de fundal din cardurile de presă au `alt=""`. Logo-urile publicațiilor au alt = numele publicației. Iconurile SVG au `aria-hidden="true"`.

**JSON-LD** (static, fără CMS; entitatea `&#39;` dublu-escape-uită de pe vechi dispare: se scrie apostrof simplu):

1. **Site-wide** (Site settings → Custom code → Head), un `@graph` cu:
   - `Organization` `https://www.lunajets.com/#organization`: `name`, `legalName` „LunaJets S.A.”, `url`, `logo` (URL asset după upload), `foundingDate` „2007-12”, `founder` Eymeric Segard (+ `sameAs` LinkedIn), `description` [V], `address` (29 Rue Lect, 1217 Meyrin, Geneva, CH), 3 × `contactPoint` [V], `sameAs` (Instagram, YouTube, LinkedIn, Facebook, X, Google Maps), `knowsAbout` [V], `memberOf` (The Air Charter Association, ARGUS, EBAA, NBAA, MEBAA), `subOrganization`: 7 × `LocalBusiness` complete [V, D7]. **Fără `aggregateRating`** (D18).
   - `WebSite` `https://www.lunajets.com/#website`: `url`, `name`, `publisher` → `#organization`, `inLanguage` „en”.
2. **Doar pe About** (Page settings → Custom code → Head):

```json
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "AboutPage",
  "@id": "https://www.lunajets.com/en/about-us#aboutpage",
  "url": "https://www.lunajets.com/en/about-us",
  "name": "About LunaJets - Private Jet Charter Broker",
  "description": "As Europe's first ARGUS-certified broker, we provide tailored private aviation solutions and 24/7 support, grounded in excellence and discretion.",
  "inLanguage": "en",
  "isPartOf": { "@id": "https://www.lunajets.com/#website" },
  "about": { "@id": "https://www.lunajets.com/#organization" },
  "speakable": { "@type": "SpeakableSpecification", "cssSelector": [".speakable"] }
}
</script>
```

Validare: Rich Results Test + validator.schema.org înainte de go-live.

---

## 11. Ordinea de build (checklist Faza C)

Legendă execuție:

- **[DES]** = Designer API. Cere Webflow Designer deschis pe site și pe pagina corectă, cu aplicația MCP (Webflow MCP Bridge) conectată. Lucrează doar pe pagina deschisă.
- **[DATA]** = Data API. Nu cere Designer deschis.
- **[MAN]** = manual în UI (nu există API sau e mai sigur manual).

Fiecare pas se încheie cu captură de ecran sau raport și **aprobare** înainte de pasul următor.

### 01 Cleanup (§3)

- [ ] 01.1 Backup manual al site-ului. **[MAN]**
- [ ] 01.2 Confirmare că cele 4 colecții au fost șterse de user. Listare colecții. **[DATA]**
- [ ] 01.3 Inventar complet: pagini, clase (cu număr de utilizări), variabile (nume și valori), componente. **[DES]** + **[DATA]** pentru pagini
- [ ] 01.4 Captură Home, apoi ștergerea secțiunilor Relume din `main-wrapper` de pe Home. **[DES]** (Home deschisă)
- [ ] 01.5 Rezolvarea duplicatelor (`container-large 2`, `padding-global 2`, `text-size-medium 2`). **[DES]**
- [ ] 01.6 Style Manager → Clean Up, cu protecția utilitarelor Client-First (vezi nota din §3.2). **[MAN]** în Designer
- [ ] 01.7 Verificare: Home, Style Guide, 404 se deschid fără erori. **[DES]**

### 02 Variables (§4)

- [ ] 02.1 Creare primitive în `Primitives` (§4.2). **[DES]**
- [ ] 02.2 Colecția `Semantic` (redenumire „Color Schemes” sau colecție nouă) + tokenuri semantice ca aliasuri (§4.3). **[DES]** (redenumirea colecției: **[MAN]** dacă API-ul nu o permite)
- [ ] 02.3 `Typography`: `Font Family/heading`, `Font Family/body`. `UI Styles`: `Radius/small`, `Radius/medium`. **[DES]**
- [ ] 02.4 Re-legarea utilitarelor existente (`text-color-*`, `background-color-*`, `button*`, `form_*`) la tokenurile semantice. **[DES]**
- [ ] 02.5 Ștergerea variabilelor Relume și a clasei `color-scheme-1` (după 02.4; verificare „used by”). **[DES]**

### 03 Global styles și fonturi (§4.4, §5)

- [ ] 03.1 Upload fonturi Vanitas (2 fețe) + Gilroy (400, 600, 700 când există), cu numele de familie `Vanitas` / `Gilroy`. **[MAN]** Site settings → Fonts (fără API)
- [ ] 03.2 Actualizarea embed-ului din componenta Global Styles (§5.1). **[MAN]** (paste în Code Embed) sau **[DES]** dacă editarea embed-ului e expusă
- [ ] 03.3 Stiluri de tag: body, h1–h6, p, a, ul/ol, img, pe toate breakpoint-urile. **[DES]** dacă API-ul expune selectori de tag, altfel **[MAN]** în Designer
- [ ] 03.4 Valori utilitare: `heading-style-h1..h6` = tag-uri, `text-size-*`, `padding-global`, `container-*`, `padding-section-*`, scala `spacer-/margin-/padding-*`, `max-width-medium` (35rem) / `max-width-large` (45rem), pe breakpoint-uri. **[DES]**
- [ ] 03.5 Clase noi: `spacer-custom1/2` (+ margin/padding), `image-cover`, `background-color-primary/alternate`, `text-style-link`, `speakable`. **[DES]**
- [ ] 03.6 Butoane: `button`, `is-secondary`, `is-alternate`, `is-small`, `is-link`, `is-icon`, `button_icon` + stări hover/focus. **[DES]**
- [ ] 03.7 Actualizarea paginii Style Guide cu noile stiluri (opțional, recomandat pentru QA vizual). **[DES]**

### 04 Componente (§6)

- [ ] 04.1 `Tagline` (prop Text). **[DES]**
- [ ] 04.2 `Button Arrow` (props Text, Link, Variant). **[DES]**
- [ ] 04.3 `Navbar` (w-nav, dropdown-uri, breakpoint 1280 pentru navbar). **[DES]**
- [ ] 04.4 `Footer` (inclusiv formularul de newsletter nativ, linkurile legale, scriptul pentru an). **[DES]**
- [ ] 04.5 `Stat Item`, `Group Card` (variantă Accent), `Press Card`. **[DES]**

### 05 Pagina About, secțiune cu secțiune (§7)

- [ ] 05.1 Crearea paginii „About us”, slug `about-us`. **[DES]** (creare) / **[DATA]** (setări)
- [ ] 05.2 Schelet: `page-wrapper` > Global Styles + Navbar + `main.main-wrapper#main` + Footer. **[DES]** (About deschisă)
- [ ] 05.3 Hero (§7.1). **[DES]**
- [ ] 05.4 Metrics: header + stats (§7.2, prima parte). **[DES]**
- [ ] 05.5 Metrics: 3 split-uri (§7.2, a doua parte). **[DES]**
- [ ] 05.6 Services (§7.3), inclusiv iconurile SVG normalizate. **[DES]**
- [ ] 05.7 Group (§7.4). **[DES]**
- [ ] 05.8 Standards (§7.5). **[DES]**
- [ ] 05.9 Press (§7.6), cu placeholder-e marcate. **[DES]**
- [ ] 05.10 Comparație vizuală la 1440 cu `about-desktop-full_264-5854.png` (tolerate doar abaterile documentate în §4.6). **[DES]** (captură)

### 06 Responsive (§9)

- [ ] 06.1 Navbar: 1280 / base / 991 / 767 / 479. **[DES]**
- [ ] 06.2 Hero + Metrics + split-uri: 991 / 767 / 479. **[DES]**
- [ ] 06.3 Services + Group + Standards + Press: 991 / 767 / 479. **[DES]**
- [ ] 06.4 Footer: 991 / 767 / 479. **[DES]**
- [ ] 06.5 Verificare 320 / 375 / 479 / 767 / 991 / 1024 / 1280 / 1440 / 1920: fără scroll orizontal. **[DES]** (preview)

### 07 SEO (§10)

- [ ] 07.1 Title, meta description, OG title/description, slug. **[DATA]** (update page settings)
- [ ] 07.2 Custom code head pe About: AboutPage JSON-LD, `og:url`, `twitter:site`. **[MAN]** (Page settings → Custom code). Inline scripts prin Data API sunt limitate ca lungime și gândite pentru JS, deci nu sunt potrivite pentru ld+json
- [ ] 07.3 JSON-LD site-wide (Organization + WebSite + 7 LocalBusiness). **[MAN]** (Site settings → Custom code → Head)
- [ ] 07.4 Alt text pe toate placeholder-ele. **[DES]**
- [ ] 07.5 Staging fără indexare. Global Canonical notat pentru go-live. **[MAN]**

### 08 QA

- [ ] 08.1 Publicare pe staging (`*.webflow.io`). **[DATA]** (publish, doar cu aprobare)
- [ ] 08.2 Audit panel (U): alt, headings, labels. Lighthouse (Perf, A11y, SEO, BP) pe mobil și desktop. Contrast (D14). Navigare doar cu tastatura (skip-link, dropdown-uri, meniu, focus vizibil). **[MAN]**
- [ ] 08.3 Checklist Client-First: fără clase `Div Block`, maxim 3–4 clase în stack, niciun stil pe stack de utilitare, tipografia doar pe elementele de text, `section_` / `padding-global` / `container-large` corecte. **[DES]** (inventar clase)
- [ ] 08.4 Registru de linkuri (§2.4): toate linkurile interne și externe, fără `#`, cu `target=_blank` + `rel=noopener` pe externe. Numărul pentru Poland (`+377…`, prefix Monaco) marcat pentru confirmare cu clientul. **[MAN]**
- [ ] 08.5 Validare JSON-LD (Rich Results Test, schema.org validator). **[MAN]**
- [ ] 08.6 Listă de blocaje pentru go-live: D5 (presă), D6 (licență + Gilroy Bold), D20 (localizare / redirect-uri), Global Canonical, asset-uri reale (imagini, OG image, logo-uri SVG), code component Request quote (D12), provider newsletter (D13).
