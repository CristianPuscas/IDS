# 03 — Faza B: plan de build pentru pagina „Private Jet Charter” (LunaJets → Webflow, Client-First v2)

> **Etapa:** Faza B, doar planificare. Nu se modifică nimic în Webflow, Figma sau git.
> **Data:** 2026-09-29
> **Surse:** `01-audit-old-private-jet-charter.md` (live https://www.lunajets.com/en/private-jet-charter), `02-audit-figma-private-jet-charter.md` (Figma `kLdwkY54wIiha02RhcMP36`, desktop `264:6395` + `CHART MOBILE` `264:6774`; **toate valorile tipografice / de culoare sunt ≈**, limita MCP a blocat Dev Mode), `../why-lunajets/03-plan-why-lunajets.md` (deciziile W1–W26 rămân valabile unde se aplică), `../about/03-plan-about.md` (D1–D20), `../about/04-build-log.md` și `../why-lunajets/04-build-log.md` (ce e deja construit), capturile din `figma-screenshots/` și `old-screenshots/`.
> **Site țintă:** `6a82dbc04ebf3e2d805651ab`. Pagina se construiește ca **draft**, slug **`private-jet-charter`**. Nu se șterge nicio clasă. Imaginile **nu se urcă**: `<img src="" alt="…">` în wrapper cu `aspect-ratio`.
> **Payload-uri gata de inserat:** `payloads/` (vezi §3, §7). Validate local cu Playwright (stiluri de bază aproximative) la 1440 / 991 / 767 / 390 / 320: **fără scroll orizontal**.

Legendă surse text: **[F]** Figma, **[V]** pagina veche, **[F+V]** text Figma completat din vechi, **[D]** decizie din acest plan.

---

## 1. Decizii (cu default, ca build-ul să poată continua)

Deciziile About D1–D20 și Why W1–W26 se aplică neschimbate (în special D12 Request quote → `/en?requestFlight=1`, D14 contrast, D20 doar EN, W3 Figma = sursa textelor, W13 line-height 1.5, W14 header → conținut `spacer-xlarge`, W19 regula imaginii pe mobil, W23 fără JS pentru carduri, W26 tagline → titlu `spacer-custom1`). Mai jos, doar deciziile noi (prefix **P**).

### 1.1 Structură și conținut

| # | Întrebare | Opțiuni | **Default** | Motiv |
|---|---|---|---|---|
| P1 | Slug | păstrat / schimbat | **`private-jet-charter`** (identic) | Prefix pentru 347 `fly-to-*` + 164 `fly-between-*` (× 8 limbi). Orice schimbare = redirect-uri în masă. |
| P2 | Widget-ul de căutare din hero (code component `RequestFlight` indisponibil) | embed componentă / reconstrucție / buton | **UI-ul Figma reconstruit ca `<form method="get" action="/en">` real, accesibil**, cu `requestFlight=1` ascuns, radio-uri „trip type” (One way / Round trip / Multi-city), câmpuri etichetate From, To, buton swap, Date & time (`datetime-local`), Passengers (`number`, 1–99), submit „Request quote”. Funcționează fără JS; scriptul swap e opțional (`payloads/scripts.md`) | Pagina rămâne utilizabilă și indexabilă fără componenta React; GET-ul ajunge în fluxul existent (`?requestFlight=1`, ca D12) cu parametrii precompletați. **Temporar**: se înlocuiește cu componenta reală / integrarea (autocomplete, date picker) când librăria e disponibilă pe site-ul nou; clasele panoului rămân. |
| P3 | Nume de clasă pentru widget | `pjc-search_*` / partajat | **`quote-search_*`** (fără prefix de pagină) + `section_pjc-search` / `pjc-search_*` doar pentru fundal | Widget-ul va apărea și pe Home / destinații (audit Figma §2.1). |
| P4 | Blocul H1 (text + imagine) | clasă nouă `pjc-hero_*` / reutilizare | **Reutilizare `split_component` + `split_content`** (grid 1fr 1fr, gap 4rem ⇒ coloane de 608px = exact Figma 602–647) + **combo nou `split_image-wrapper is-hero`** (aspect **7/5**; la ≤991 `order: 0` ⇒ textul/H1 rămâne deasupra imaginii, regula W19 pentru hero). Clasă nouă doar `pjc-hero_divider` (linia 60px) | Cea mai mare reutilizare; o singură abatere de la `split_image-wrapper` (raport + ordine), exact cazul de combo. |
| P5 | Line-height ≈1.8 (≈29px) pe paragrafe (bloc H1, lede tabel, header Deposit) | 1.8 / 1.5 | **1.5** (tag `p` global) | Idem W13: valoare ≈ fără Dev Mode, restul site-ului e 1.5. Se revine doar dacă Dev Mode confirmă 1.8 (atunci utilitar nou `text-style-relaxed`, nu per-clasă). |
| P6 | Padding vertical secțiuni 56px [F] (hero căutare 99px) | 3.5rem / 5rem | **`padding-section-medium` (5rem) peste tot** | Ritm identic cu About/Why (W15). |
| P7 | Header → conținut | 48 / 64 / 24 [F] | Tabel: **`spacer-large`** (3rem = 48 exact); Deposit și Special: **`spacer-xlarge`** (64 exact); Destinații 24 → **`spacer-xlarge`** (normalizat) | Valori din scală. |
| P8 | Tabelul comparativ | div-uri / embed / tabel real | **`<table>` real**: `caption` (sr-only), `th scope="col"` / `th scope="row"`, celula de colț `td` goală; coloana LunaJets = logo (SVG `aria-hidden`) + text sr-only „LunaJets”; valorile LunaJets în `comparison_chip`. Mobil (≤767) **doar CSS**, același DOM: `table/thead/tbody` → block, `tr` → grid 3 col, eticheta pe un rând întreg (`grid-column 1 / 4`), colțul ascuns, legendă vizibilă (`aria-hidden`, informația e deja în antet) | Accesibil și indexabil; respectă CHART MOBILE `264:6774`. |
| P9 | Culoarea coloanei evidențiate (≈ `#F5F8FB` / `#F7F8FA`) | valoare brută / token | **Token nou**: primitivă `Neutral/lightest-cool` = `#F5F8FB` + semantic `Background Color/highlight` (alias). Un singur token pentru coloana LunaJets, antetul Fractional/Membership și rândurile-etichetă mobile | `payloads/variables-to-create.md`. Se creează **înainte** de legare. |
| P10 | Text lede mobil diferit (versiune scurtată în Figma) | 2 texte + `hide-*` / 1 text | **Un singur text (desktop)** | Fără conținut duplicat; paragraful are 4 rânduri la 390. |
| P11 | Contrast etichete tabel (≈ `Text Color/tertiary` `#979BA1` ⇒ 2.8:1) | tertiary / secondary | **`Text Color/secondary` `#6B7684`** (4.6:1 pe alb, 4.4:1 pe `#F5F8FB` pentru 11px bold uppercase — la limită; de verificat în QA) | D14. |
| P12 | Tab-urile inactive ale widget-ului (gri pe panou translucid ≈ `#9B9FA3` ⇒ ~1.9:1) | gri [F] / navy | **Text navy** (`Text Color/primary`), tab activ = fundal navy + text alb | Contrast ≥ 4.5:1 peste foto. |
| P13 | `id="special-private-jet-charter"` | — | **Pe `section_pjc-special`** („Special private jet charter”) | Repară ancora legată din Why LunaJets în toate cele 8 limbi (W10). |
| P14 | H2 „Special private jet charter” fără italic [F] | ca Figma / consecvent | **`Special private<br><em>jet charter</em>`** | Singurul H2 fără italic din 3 pagini ⇒ probabil omisiune (audit Figma §6.11). De confirmat. |
| P15 | Eyebrow `WAYS TO FLY` de 2 ori pe pagină [F] | — | Tabel: **`Ways to fly`** [F]; Special: **`Bespoke charter flights`** [V] | Evită repetiția (logica W6). |
| P16 | Carduri Special (8): link | card întreg / titlu / buton | **Un singur link real pe card: `button is-link is-icon` „Learn more”** + `button_sr-text` („ about helicopter charter”…) → `/en/private-jet-services/*` [V] | Figma desenează explicit „Learn more”; nume accesibile unice; fără JS. |
| P17 | Clase carduri Special | `group_card` + combo / nou | **Noi: `charter-type_list`, `charter-type_card`, `charter-type_image-wrapper`, `charter-type_content`**; **refolosite ca atare: `heading-style-h4`, `group_card-text` (0.9375/1.5), `group_card-link-wrapper` (margin-top auto, padding-top 1.5rem)** | `group_card` are imaginea în interior (3/2, max 17.5rem), padding și lățime flex: un combo ar suprascrie aproape tot. Copiii cu valori identice se refolosesc. |
| P18 | Destinații | CMS / static | **4 carduri statice** (CMS la migrarea colecției Destinations). Linkuri **verificate în sitemap-ul live** (toate `<loc>` există): `/en/private-jet-charter/fly-to-saint-tropez`, `…/fly-to-ibiza`, `…/fly-to-courchevel`, `…/fly-to-mykonos`. Card întreg = link (`a.destination_card-link`), titlul `h3` cu prefix sr-only „Private jet charter to ” | Păstrează linkurile interne spre paginile CMS vechi; nume accesibil explicit (vechi: „France Paris”). |
| P19 | „View all destinations” (vechi, absent în Figma) | păstrăm / scoatem | **Păstrăm un singur buton** `button is-secondary is-icon` centrat sub grilă → `/en/destinations` | Hub-ul de destinații are nevoie de link din pagina-părinte; 4 carduri statice nu acoperă cele 347. Abatere vizuală mică. |
| P20 | Header Deposit pe 2 coloane (align bottom) | `split_component` / nou | **Nou `booking_header`** (grid 1fr 1fr, gap 4rem, `align-items: end`) + `booking_header-content` | `split_component` are `align-items: center` și ar cere combo doar pentru aliniere. |
| P21 | Titlu card Deposit ≈28px | clasă nouă / h3 | **`h3` tag (1.5rem)** | Nicio treaptă de 28; pierdere mică de fidelitate (audit Figma §2.4). |
| P22 | Iconuri Deposit (Figma neexportabil) | — | **3 line-icons interimare 32×32 `currentColor`** (document cu semnătură, card tăiat, cronometru) în `icons.json`, casetă 3rem (normalizează 50×64 / 60×52 / 50×55 ⇒ titluri aliniate) | Ca W7; se înlocuiesc cu exportul Figma (`264:6599`, `264:6609`, `264:6617`) fără schimbare de structură. |
| P23 | Clasa HtmlEmbed pentru iconuri | `why-hero_icon-embed` / nou | **Utilitar nou `icon-embed-fill`** (flex, 100% × 100%, centrat) | Nu legăm PJC de folderul `why-hero_`. Unificarea ulterioară = refactor opțional. |
| P24 | Clasa sr-only | nouă / existentă | **`button_sr-text`** (existentă, stil sr-only) pentru caption, label-urile formularului și prefixele sr | Deja folosită ca sr-only generic pe Why; redenumirea într-un `sr-only` global = refactor ulterior. |
| P25 | Linkuri contextuale (hub) | — | Bloc H1: „benefits of chartering flights with LunaJets” → `/en/why-lunajets`, „4,800 of the most recent and sought-after private jets” → `/en/fleet`; lede tabel: „really costs” → `/en/prices`; header Deposit: „Deposit money on our account” → `/en/frequent-charter-program` | Recuperează linkurile din secțiunile vechi eliminate (Benefits, Pricing, FCP) fără elemente vizuale noi (W9). |
| P26 | Textele Figma cu probleme | — | [D] corecturi minime: P2 bloc H1 propoziție incompletă ⇒ „…for both business and leisure travel, whether you are flying private to Europe, Asia or the United States.”; „locked in” → „locked into”; `ON DEMAND` → `On-demand`; `Multi year` → `Multi-year`; `Depending on share` → `Depends on share` (unificat); `Last minute` → `Last-minute`; em-dash-urile din cardurile Group/Corporate înlocuite cu punctuație simplă; `in-flight` → `in flight` | Consecvență cu Why/About; de validat de client. |

### 1.2 Conținut vechi fără loc în Figma

| Bloc vechi | **Default** | Justificare |
|---|---|---|
| Hero: 4 cifre (4,800+ / 182+ / 4.8 ★ / 24/7) | **Scos** | Hero-ul devine widget-ul de căutare; 4,800+ și 24/7 apar în tabel și în text; „182+” și „4.8 ★” n-au sursă vizibilă (audit V §3.1). |
| „Fly private on your terms” (split + badge 35 min) | **Înlocuit** de blocul H1 [F] | Același rol (propunerea de valoare); „35 minutes” rămâne în cardul Last-minute. |
| Process „From request to takeoff” (4 pași) | **Scos** — ⚠️ întrebare client | Conținut util dar nedesenat; ar cere o secțiune nouă. Textele rămân în audit dacă se reintroduc (recomandat ca `ol`). |
| Pricing (tabel tarife, doar EN) | **Scos** + link contextual „really costs” → `/en/prices` — ⚠️ întrebare client | Singurele cifre de preț (intenția „private jet charter cost”); pagina dedicată `/en/prices` le acoperă. Varianta alternativă: secțiune scurtă cu tabelul (clasele `comparison_*` se pot refolosi). |
| Benefits (5 carduri + link Why) | **Scos** + link contextual → `/en/why-lunajets` | Dublează Why LunaJets. |
| Travellers (3 profiluri) | **Scos** | Nedesenat, fără linkuri; valoare SEO mică. |
| Charter services (8 carduri) | **Păstrat** = „Special private jet charter” [F] | + `id` (P13). |
| On-Demand vs Frequent Charter Program (tabel) | **Înlocuit** de secțiunea Deposit Account [F] + link → `/en/frequent-charter-program` | Figma prezintă același produs (numele: W20). |
| Charter vs fractional vs membership | **Păstrat** = tabelul comparativ [F] | Texte Figma (P26). |
| **FAQ (4 întrebări)** | **PĂSTRAT** ca secțiune nouă, **fără design Figma** (`section_pjc-faq`, componentă nouă partajată `faq_*`, `details/summary` nativ, primul item deschis) + link „See all private jet charter FAQs” → `/en/private-jet-charter-aviation-frequently-asked-questions` (pagină orfană pe vechi) + JSON-LD `FAQPage` — ⚠️ **ÎNTREBARE DESCHISĂ PRINCIPALĂ** | Singurul conținut care răspunde direct la întrebări long-tail (quote, plată, anulare, aeroporturi); rich result-urile FAQ sunt limitate de Google din 2023, dar textul rămâne indexabil. Dacă designerul/clientul refuză: se scoate payload-ul 07 **și** blocul `FAQPage` din JSON-LD, iar linkul spre pagina FAQ se mută în lede-ul tabelului. |
| Destinații (slider CMS, 11) | **4 carduri statice** [F] (P18) + „View all destinations” (P19) | Swiper dispare (fără JS extern). |
| CTA final „Your next journey starts here” (în afara `<main>`) | **Scos** | Conversia e widget-ul din hero + Request quote din Navbar; consecvent cu About/Why (fără CTA final în Figma). |

---

## 2. Maparea URL-urilor

| URL VECHI | URL NOU | ACȚIUNE | CMS | REDIRECT |
|---|---|---|---|---|
| `https://www.lunajets.com/en/private-jet-charter` (și `x-default`) | `…/en/private-jet-charter`, pagină statică „Private Jet Charter”, **slug `private-jet-charter`**, locale EN | Rebuild, Faza C (draft) | Nu (destinațiile statice deocamdată) | Niciunul |
| `/fr/location-de-jet-prive`, `/de/privatjet-mieten`, `/it/noleggio-jet-privato`, `/es/alquiler-de-jet-privado`, `/ru/charter-chastnogo-samoleta`, `/hu/maganrepulogep-berles`, `/pl/czarter-prywatnego-samolotu` | idem, localizat | Localizare (D20: ulterior) | Nu | Niciunul cu Localization; slug-urile localizate se păstrează identic (sunt și prefixele CMS) |
| `/en/private-jet-charter/fly-to-*` (347) și `/fly-between-*-and-*` (164), × 8 limbi | **neschimbate** | Migrare CMS (în afara acestei pagini) | Da | Niciunul, **dacă** prefixul rămâne |

**hreflang:** doar prin Webflow Localization (8 locale + x-default). Cât timp e doar EN, fără hreflang manual.

**De verificat în Faza C (pasul 00):** pe site-ul nou, pagina statică `private-jet-charter` trebuie să coexiste cu URL-urile CMS `/private-jet-charter/fly-to-*` / `fly-between-*` (două template-uri, același prefix). Se verifică read-only pe site-ul vechi (`67c72c8a3c305a53672bdcca`) cum e rezolvat (colecție cu slug `private-jet-charter` + pagină statică? un singur template? rewrite?) și se replică **înainte** de a crea pagina, ca slug-ul să nu fie „ocupat” greșit. Dacă Designer-ul refuză slug-ul identic, se oprește build-ul și se decide cu userul (nu se schimbă URL-ul public).

Linkuri spre pagini încă neconstruite (URL links cu calea de producție; devin Page links când paginile există): `/en/fleet`, `/en/prices`, `/en/frequent-charter-program`, `/en/destinations`, `/en/private-jet-services/{last-minute-flights, helicopter-flights, emergency-charter, group-charter, leisure-charter, cargo-charter, corporate-charter, corporate-events}`, `/en/private-jet-charter/fly-to-{saint-tropez, ibiza, courchevel, mykonos}`, `/en/private-jet-charter-aviation-frequently-asked-questions`. `/en/why-lunajets` există (draft).

---

## 3. Clase

### 3.1 Refolosite (NU se redefinesc; nu apar în CSS-ul payload-urilor)

- Structură: `page-wrapper`, `main-wrapper`, `padding-global`, `container-large`, `padding-section-medium`, `max-width-large` (45rem).
- Spacere: `spacer-small` (1.5), `spacer-large` (3), `spacer-xlarge` (4), `spacer-custom1` (1.25).
- Tipografie: tag-urile `h1`–`h3`, `p`, `em`; `heading-style-h4`, `text-style-link`, `speakable` (hook JSON-LD, fără stiluri).
- Eyebrow: `tagline_component`, `tagline_line`, `tagline_text`.
- Butoane: `button`, `is-secondary`, `is-link`, `is-icon`, `button_icon` (săgeata standard), `button_sr-text` (și ca sr-only generic, P24).
- Media: `image-cover` (absolute, cover; doar în `*_image-wrapper` / link-wrapper).
- Split (About): `split_component`, `split_content`, `split_image-wrapper` (bază).
- Group (About): `group_card-text`, `group_card-link-wrapper`.
- Componente: Global Styles, Navbar, Footer.

### 3.2 Noi

| Clasă | Tip | Payload | Rol |
|---|---|---|---|
| `section_pjc-search` | secțiune | 01 | relative, overflow hidden, fundal navy (fallback sub foto) |
| `pjc-search_image-wrapper` | custom | 01 | absolute inset 0 (foto de fundal) |
| `pjc-search_overlay` | custom | 01 | voal navy 45% (≈) |
| `quote-search_component` | custom **partajat** | 01 | panou alb 55% + blur 12px, padding 2.5rem 3rem (991: 2rem; 767: 1.5; 479: 1.25) |
| `quote-search_form` | custom | 01 | flex column, gap 1rem |
| `quote-search_tabs` | custom | 01 | `role=radiogroup`, flex wrap, gap 0.25rem |
| `quote-search_tab` | custom | 01 | `label` (margin 0, cursor pointer) |
| `quote-search_radio` | custom | 01 | radio ascuns vizual (focus rămâne) |
| `quote-search_tab-text` | custom | 01 | 11px uppercase ls .15em, padding .875rem 1.25rem; activ prin CSS embed `:checked +` |
| `quote-search_fields` | custom | 01 | flex row, gap .5rem (991: wrap; 767: column) |
| `quote-search_route` | custom | 01 | From + swap + To (relative) |
| `quote-search_field` | custom | 01 | flex 1, relative |
| `quote-search_field is-date` | **combo** | 01 | 14rem fix (991: flex 1, 12rem) |
| `quote-search_field is-passengers` | **combo** | 01 | 6.5rem fix |
| `quote-search_field-icon` | custom | 01 | icon persoană absolut stânga |
| `quote-search_input` | custom **partajat** | 01 | 66px (4.125rem), alb, 14px/600 |
| `quote-search_input is-with-icon` | **combo** | 01 | padding-left 2.75rem |
| `quote-search_swap` | custom | 01 | cerc navy 2.75rem centrat între câmpuri (767: dreapta, rotit 90°) |
| `button is-search` | **combo** pe `button` | 01 | justify center, min-width 11.5rem (767: 100%, min-height 3.5rem) |
| `section_pjc-hero` | secțiune | 02 | — |
| `pjc-hero_divider` | custom | 02 | 3.75rem × 1px navy |
| `split_image-wrapper is-hero` | **combo** | 02 | aspect 7/5; 991: order 0 |
| `section_pjc-comparison` | secțiune | 03 | — |
| `comparison_component` | custom **partajat** | 03 | chenar 1px + radius, overflow hidden |
| `comparison_table` | custom | 03 | `table` 100%, collapse, layout fixed (767: block) |
| `comparison_head` / `comparison_body` | custom | 03 | `thead` / `tbody` (767: block) |
| `comparison_row` | custom | 03 | `tr` (767: grid 3 col) |
| `comparison_corner` | custom | 03 | celula goală 30% (767: none) |
| `comparison_head-cell` | custom | 03 | antet coloană, fundal highlight, 11px uppercase |
| `comparison_head-cell is-lunajets` | **combo** | 03 | fundal navy, logo alb |
| `comparison_logo` | custom | 03 | 8rem × 1.6rem (767: 5.25 × 1.05) |
| `comparison_label-cell` | custom | 03 | `th scope=row`, 11px uppercase secondary (767: rând întreg, fundal highlight) |
| `comparison_cell` | custom | 03 | valoare centrată 14px (767: 13px) |
| `comparison_cell is-highlight` | **combo** | 03 | fundal highlight (767: alb) |
| `comparison_chip` | custom | 03 | pastilă navy, radius Medium |
| `comparison_legend` (+ `-item`, `-swatch`) | custom | 03 | doar ≤767, `aria-hidden` |
| `comparison_legend-swatch is-other` | **combo** | 03 | pătrățel alb cu chenar |
| `section_pjc-booking` | secțiune | 04 | — |
| `booking_header` / `booking_header-content` | custom | 04 | grid 2 col align end (767: 1 col) |
| `booking_list` | custom | 04 | `ul` grid 3 col, gap 2rem (767: 1 col) |
| `booking_card` | custom | 04 | flex column, gap 1.5rem, padding 2.25rem, chenar |
| `booking_card-icon` | custom | 04 | 3rem, navy, wrapper `data-icon` |
| `section_pjc-special` | secțiune | 05 | **`id="special-private-jet-charter"`** |
| `charter-type_list` | custom **partajat** | 05 | `ul` grid 4 col (991: 2; 479: 1) |
| `charter-type_card` | custom | 05 | `li` flex column, chenar, overflow hidden, text center |
| `charter-type_image-wrapper` | custom | 05 | aspect 13/8, full-bleed |
| `charter-type_content` | custom | 05 | flex column, grow, gap 1rem, padding 1.5rem 1.25rem 2rem |
| `section_pjc-destinations` | secțiune | 06 | — |
| `destination_list` | custom **partajat** | 06 | `ul` grid 4 col (991 și mai jos: 2 col) |
| `destination_card` | custom | 06 | `li` flex |
| `destination_card-link` | custom | 06 | `a` block, aspect 5/6, radius, text alb |
| `destination_card-overlay` | custom | 06 | gradient navy 0 → 85% (one-off) |
| `destination_card-content` | custom | 06 | absolut jos, padding 1.5rem (479: 1rem) |
| `destination_card-country` | custom | 06 | 11px uppercase ls .15em |
| `destination_button-wrapper` | custom | 06 | flex center |
| `section_pjc-faq` | secțiune | 07 | — |
| `faq_list` / `faq_item` / `faq_question` / `faq_icon` / `faq_answer` | custom **partajat** | 07 | `details` + `summary`, bordură `Border Color/secondary` |
| `icon-embed-fill` | **utilitar nou** | pas HtmlEmbed | flex, 100% × 100%, centrat (P23) |

Combo-uri noi (8), fiecare cu nume unic în payload-ul lui: 01 `is-date`, `is-passengers`, `is-with-icon`, `is-search`; 02 `is-hero`; 03 `is-lunajets`, `is-highlight`, `is-other`. Maxim 3 clase în stack (`button is-link is-icon`).

---

## 4. Arborele paginii

```
body
└─ div.page-wrapper
   ├─ [Global Styles]  ├─ [Navbar]
   ├─ main.main-wrapper#main
   │  ├─ 4.1 section.section_pjc-search          (01)
   │  ├─ 4.2 section.section_pjc-hero            (02)  ← H1
   │  ├─ 4.3 section.section_pjc-comparison      (03)
   │  ├─ 4.4 section.section_pjc-booking         (04)
   │  ├─ 4.5 section.section_pjc-special#special-private-jet-charter (05)
   │  ├─ 4.6 section.section_pjc-destinations    (06)
   │  └─ 4.7 section.section_pjc-faq             (07)  ← fără design Figma (§1.2)
   └─ [Footer]
```
Fiecare secțiune: `section_*` › `padding-global` › `container-large` › `padding-section-medium` (ca About/Why).

### 4.1 Search hero (`01-search`)
```
section_pjc-search
├─ pjc-search_image-wrapper › img.image-cover (alt="", eager, fetchpriority=high — LCP) + pjc-search_overlay
└─ padding-global › container-large › padding-section-medium
   └─ quote-search_component
      └─ form.quote-search_form [method=get action=/en aria-label="Request a private jet quote"]
         ├─ input[type=hidden name=requestFlight value=1]
         ├─ quote-search_tabs [role=radiogroup aria-label="Trip type"]
         │  └─ 3 × label.quote-search_tab › input.quote-search_radio[type=radio name=trip value=one-way(checked)|round-trip|multi-city] + span.quote-search_tab-text "One way" / "Round trip" / "Multi-city"
         └─ quote-search_fields
            ├─ quote-search_route
            │  ├─ quote-search_field › label.button_sr-text[for=pjc-from] "From: departure city or airport" + input.quote-search_input#pjc-from[name=from placeholder=From]
            │  ├─ button.quote-search_swap[type=button aria-label="Swap departure and arrival" data-quote-swap] › svg ⇄ (aria-hidden)
            │  └─ quote-search_field › label (sr) "To: arrival city or airport" + input#pjc-to[name=to placeholder=To]
            ├─ quote-search_field.is-date › label (sr) "Departure date and time" + input#pjc-date[type=datetime-local name=date]
            ├─ quote-search_field.is-passengers › quote-search_field-icon (svg persoană) + label (sr) "Number of passengers" + input.is-with-icon#pjc-passengers[type=number min=1 max=99 value=1 name=passengers]
            └─ button.button.is-search[type=submit] "Request quote"
      [HtmlEmbed A: CSS stări; HtmlEmbed B: script swap — payloads/scripts.md]
```
Submit fără JS: `/en?requestFlight=1&trip=one-way&from=…&to=…&date=…&passengers=1` (verificat local cu FormData).

### 4.2 Bloc H1 (`02-intro`)
```
split_component
├─ split_content
│  ├─ [Tagline] "On-demand private aviation" [F, P26] › spacer-custom1
│  ├─ h1 "Private jet charter<br><em>with LunaJets</em>" [F] › spacer-small
│  ├─ pjc-hero_divider › spacer-small
│  ├─ p.speakable "Access the largest choice of aircraft without being locked into a costly contract. Discover the [benefits of chartering flights with LunaJets]." [F, P25] › spacer-small
│  └─ p.speakable "LunaJets grants you access to over [4,800 of the most recent and sought-after private jets] worldwide, offering unrivalled charter solutions for both business and leisure travel, whether you are flying private to Europe, Asia or the United States." [F+D]
└─ split_image-wrapper.is-hero (7/5) › img.image-cover  eager
      alt "Businessman in a dark suit climbing the airstair of a polished private jet under a blue sky"
```

### 4.3 Comparison (`03-comparison`)
```
max-width-large › [Tagline] "Ways to fly" › spacer-custom1 › h2 "Charter vs fractional ownership<br>vs <em>membership program</em>" [F]
   › spacer-small › p.speakable "Choosing how you fly privately is a significant decision. This comparison cuts through the complexity so you can see at a glance what each model [really costs]: in fees, flexibility, and commitment." [F, P25]
spacer-large
comparison_component › table.comparison_table
├─ caption.button_sr-text "Private jet charter with LunaJets compared with fractional ownership and membership programs"
├─ thead.comparison_head › tr.comparison_row › td.comparison_corner + th[scope=col].comparison_head-cell.is-lunajets (comparison_logo[data-icon=lunajets-logo] + sr "LunaJets") + th "Fractional ownership" + th "Membership program"
└─ tbody.comparison_body › 11 × tr.comparison_row › th[scope=row].comparison_label-cell + td.comparison_cell.is-highlight › span.comparison_chip + td.comparison_cell × 2
   Upfront fees | None | Required aircraft share purchase | Full subscription
   Annual dues | None | Fixed monthly management fee | None
   Commitment | Pay as you go | Long-term contract | Multi-year subscription program
   Worldwide reach | Global | Based on plane location | Areas of service based on subscription
   Fleet access | 4,800+ | Limited | Limited to company aircraft
   Minimum booking notice | None | Depends on share | Usually 48h
   Service | 24/7 | Less personalised support | Less personalised support
   Peak / blackout days | None | Depends on share | Yes
   Busy airport surcharges | None | Depends on share | Yes
   Taxi time | Incl. in price | Yes | Yes
   Conversion rates | Fully flexible | Yes | Yes                                 [F, P26]
comparison_legend[aria-hidden] › 2 × comparison_legend-item (swatch navy "LunaJets" · swatch.is-other "Other models")   (doar ≤767)
```

### 4.4 Deposit Account (`04-booking`)
```
booking_header
├─ booking_header-content › [Tagline] "Our booking model" › spacer-custom1 › h2 "Streamlined booking<br><em>with the Deposit Account</em>" [F]
└─ p.speakable "[Deposit money on our account] to access the perfect booking experience." [F, P25]
spacer-xlarge
ul.booking_list[role=list] › 3 × li.booking_card › booking_card-icon[data-icon] + h3 + p
   document-signature "Book with one simple signature" / "Book flights freely without the hassle of repeated wire transfers."
   card-off "No more credit card holds" / "Don’t worry about securing last-minute flights or settling additional expenses."
   stopwatch "No fund expiration" / "If you need to withdraw your funds, you can do it at any moment."   [F]
```

### 4.5 Special private jet charter (`05-special`, `id="special-private-jet-charter"`)
```
max-width-large › [Tagline] "Bespoke charter flights" (P15) › spacer-custom1 › h2 "Special private<br><em>jet charter</em>" (P14)
spacer-xlarge
ul.charter-type_list[role=list] › 8 × li.charter-type_card
   ├─ charter-type_image-wrapper (13/8) › img.image-cover lazy
   └─ charter-type_content › h3.heading-style-h4 + p.group_card-text + group_card-link-wrapper › a.button.is-link.is-icon "Learn more<span.button_sr-text> about …</span>" + button_icon
```
| # | H3 [F, P26] | href [V] | alt (din referința Figma) |
|---|---|---|---|
| 1 | Last-minute charter | `/en/private-jet-services/last-minute-flights` | Private terminal lounge with sofas and a private jet parked outside the glass wall |
| 2 | Helicopter charter | `…/helicopter-flights` | Light helicopter landed on a grass field at sunset |
| 3 | Emergency charter | `…/emergency-charter` | White air ambulance jet with a red cross flying above the clouds |
| 4 | Group charter | `…/group-charter` | Large private jet cabin with rows of cream leather seats and a central aisle |
| 5 | Leisure charter | `…/leisure-charter` | Couple laughing at a table in a private jet cabin |
| 6 | Cargo charter | `…/cargo-charter` | Cargo aircraft hold loaded with wrapped pallets |
| 7 | Corporate charter | `…/corporate-charter` | Business people walking away from a white private jet on the tarmac |
| 8 | Corporate events | `…/corporate-events` | Business people shaking hands at a corporate event |

Paragrafele: textele Figma (cu P26). Payload-ul are 7.8 KB (sub limită); dacă builder-ul îl refuză, se împarte: 05a (header + `ul` + cardurile 1–4), 05b (cardurile 5–8 inserate în același `ul`).

### 4.6 Destinations (`06-destinations`)
```
max-width-large › [Tagline] "Where our clients fly" › spacer-custom1 › h2 "Trending private<br><em>jet destinations</em>" [F]
spacer-xlarge
ul.destination_list[role=list] › 4 × li.destination_card › a.destination_card-link[href]
   › img.image-cover (lazy) + destination_card-overlay + destination_card-content › h3.heading-style-h4 (sr "Private jet charter to " + oraș) + p.destination_card-country
   Saint-Tropez · France → /en/private-jet-charter/fly-to-saint-tropez   alt "Ochre bell tower and rooftops of Saint-Tropez above the harbour with moored yachts"
   Ibiza · Spain → …/fly-to-ibiza                                        alt "Dalt Vila old town in Ibiza lit up at night and reflected in the harbour"
   Courchevel · France → …/fly-to-courchevel                             alt "Snow-covered mountains and ski slopes above Courchevel"
   Mykonos · Greece → …/fly-to-mykonos                                   alt "White houses of Mykonos overlooking the blue Aegean Sea"
spacer-large › destination_button-wrapper › a.button.is-secondary.is-icon "View all destinations" → /en/destinations (P19)
```

### 4.7 FAQ (`07-faq`, fără design Figma)
```
max-width-large
├─ [Tagline] "FAQ" › spacer-custom1 › h2 "Frequently asked questions<br><em>about private jet charter</em>" [V, sentence case]
├─ spacer-xlarge
├─ faq_list › 4 × details.faq_item (primul [open]) › summary.faq_question › h3.heading-style-h4 + faq_icon (chevron svg aria-hidden) ; faq_answer › p     [V, verbatim]
├─ spacer-large
└─ a.button.is-link.is-icon "See all private jet charter FAQs" → /en/private-jet-charter-aviation-frequently-asked-questions
```
Fără ARIA suplimentar (fără `aria-expanded`/`aria-controls` manuale: `details` nativ le expune corect; repară id-urile duplicate vechi). Rotirea iconului și ascunderea markerului: embed A.

---

## 5. Responsive (desktop din Figma; mobil doar pentru tabel; restul după principiile About §9 / Why §5)

| Element | 991 | 767 | 479 |
|---|---|---|---|
| `quote-search_component` | padding 2rem; rândul 1 = From ⇄ To (100%), rândul 2 = dată (flex) + pasageri + buton | padding 1.5rem; toate câmpurile stivuite; swap în dreapta, rotit 90°; buton 100% | padding 1.25rem; tab-uri mai înguste (pe un rând la 390; la 320 „Multi-city” trece pe rândul 2) |
| Bloc H1 `split_component` | 1 coloană; **text/H1 primul, imaginea sub** (`is-hero` order 0), 7/5 | row-gap 2rem (bază) | — |
| Tabel | 4 coloane (identic) | **CHART MOBILE**: antet 3 col (fără colț), eticheta pe rând întreg cu fundal highlight, 3 valori dedesubt, chip mic, legendă | idem |
| `booking_header` | 2 col | 1 col, gap 1.5rem | — |
| `booking_list` | 3 col, padding 1.75rem | 1 col, padding 1.5rem | — |
| `charter-type_list` | 2 col | 2 col, gap 1.5rem | 1 col |
| `destination_list` | 2 col | 2 col | 2 col, gap 1rem, padding text 1rem |
| FAQ | — | padding întrebare 1.25rem, răspuns fără padding dreapta | — |
| Tipografie / spacing | scala existentă (About §9) | idem | idem |

Verificare locală (Playwright, `base.css` aproximativ + CSS-ul payload-urilor + embed A + iconuri): scrollWidth = clientWidth la **1440, 991, 767, 390, 320**. O depășire la 320 (`flex-wrap` rămas din 991 pe coloana 767) a fost corectată (`flex-wrap: nowrap` la 767, `min-width: 0` pe câmpuri).

---

## 6. SEO

| Element | Valoare |
|---|---|
| Slug | `private-jet-charter` (P1) |
| Title | **`Private Jet Charter & Hire | Broker Since 2007 | LunaJets`** (57 car.) [V] — păstrat: pagina rankează, conține cuvântul-cheie principal și e sub 60 car. |
| Meta description | `No membership, no long-term commitment. Get quotes on 4,800+ private jets worldwide within minutes, with a 24/7 dedicated advisor on every flight.` (146 car.) [V] — consecvent cu conținutul nou (tabel, 4,800+, 24/7) |
| H1 | `Private jet charter with LunaJets` [F] (vechi: „On-demand private jet charter”); un singur H1, nativ (nu embed) |
| OG / Twitter title + description | identice cu title / description |
| OG image | foto hero de pe vechi (`…6a27e33d1c9a0ee95f6f677c_private-jet-interior.webp`) sau noua foto a secțiunii de căutare, după upload; gol pe staging |
| Custom code head | `<meta property="og:url" content="https://www.lunajets.com/en/private-jet-charter">`, `twitter:site` (de confirmat, ca la Why), `twitter:image` = OG image |
| Canonical | self (Global Canonical la go-live, About §10) |
| Indexare | staging fără index; producție fără `noindex` |

**Outline:**
```
H1  Private jet charter with LunaJets
H2  Charter vs fractional ownership vs membership program
H2  Streamlined booking with the Deposit Account
  H3  Book with one simple signature · No more credit card holds · No fund expiration
H2  Special private jet charter
  H3  × 8 (Last-minute charter … Corporate events)
H2  Trending private jet destinations
  H3  × 4 (Private jet charter to Saint-Tropez / Ibiza / Courchevel / Mykonos)
H2  Frequently asked questions about private jet charter
  H3  × 4 întrebări
(Widget-ul de căutare nu are headings; tabelul folosește th, nu headings.)
```

**Alt text:** în §4. Foto de fundal a căutării `alt=""` (decorativă). Iconuri, logo tabel, chevron, swap: `aria-hidden="true"`.

**JSON-LD** (Page settings → Custom code → Head; `Organization` / `WebSite` sunt site-wide, About §10). **Fără `Product` + `aggregateRating`** (rating-ul organizației pe un „Product” fără oferte = self-serving review, risc de politică) și fără `&amp;` literal în JSON. `speakable` țintește 4 paragrafe `.speakable` care chiar există acum.
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": "https://www.lunajets.com/en/private-jet-charter#webpage",
      "url": "https://www.lunajets.com/en/private-jet-charter",
      "name": "Private Jet Charter & Hire | Broker Since 2007",
      "description": "No membership, no long-term commitment. Get quotes on 4,800+ private jets worldwide within minutes, with a 24/7 dedicated advisor on every flight.",
      "inLanguage": "en",
      "isPartOf": { "@id": "https://www.lunajets.com/#website" },
      "about": { "@id": "https://www.lunajets.com/#organization" },
      "breadcrumb": { "@id": "https://www.lunajets.com/en/private-jet-charter#breadcrumb" },
      "speakable": { "@type": "SpeakableSpecification", "cssSelector": [".speakable"] }
    },
    {
      "@type": "BreadcrumbList",
      "@id": "https://www.lunajets.com/en/private-jet-charter#breadcrumb",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.lunajets.com/en" },
        { "@type": "ListItem", "position": 2, "name": "Private Jet Charter", "item": "https://www.lunajets.com/en/private-jet-charter" }
      ]
    },
    {
      "@type": "FAQPage",
      "@id": "https://www.lunajets.com/en/private-jet-charter#faq",
      "mainEntity": [
        { "@type": "Question", "name": "How quickly can I get a quote?",
          "acceptedAnswer": { "@type": "Answer", "text": "In most cases within minutes. Submit your request online or call us, and a dedicated advisor will respond with suitable aircraft options to compare." } },
        { "@type": "Question", "name": "Do I need to pay anything before booking?",
          "acceptedAnswer": { "@type": "Answer", "text": "No. On-demand charter requires no upfront deposit and no membership. You receive a quote, review the per-flight contract, and payment is only processed once you confirm the booking. Each flight is billed individually." } },
        { "@type": "Question", "name": "What if I need to cancel or change my flight?",
          "acceptedAnswer": { "@type": "Answer", "text": "Cancellation and amendment terms are set out in the per-flight contract before you confirm. Terms vary by aircraft and operator. Your advisor will walk you through the options and help identify the most suitable available solution." } },
        { "@type": "Question", "name": "Can I fly to airports not served by commercial airlines?",
          "acceptedAnswer": { "@type": "Answer", "text": "Yes. Private aviation gives access to a far wider airport network than scheduled airlines, including smaller regional airfields closer to your final destination. Your advisor will identify the most suitable airport for the trip, taking runway requirements, operating hours and handling into account." } }
      ]
    }
  ]
}
</script>
```
Dacă FAQ-ul se scoate (§1.2): se șterge nodul `FAQPage` (restul rămâne). Textele JSON-LD trebuie să rămână identice cu cele vizibile. `primaryImageOfPage` se adaugă după upload-ul imaginii. Validare: Rich Results Test + validator.schema.org.

---

## 7. Pași de build (Faza C)

[DES] = Designer API (pagina deschisă, MCP Bridge conectat) · [DATA] = Data API · [MAN] = manual. Fiecare pas: captură + aprobare.

- [ ] **00** Verificare coexistență pagină statică `private-jet-charter` + URL-urile CMS `/private-jet-charter/fly-to-*` / `fly-between-*` (§2), read-only pe site-ul vechi; decizie înainte de pasul 02. [DATA]
- [ ] **01** Variabile: `payloads/variables-to-create.md` (primitiva `Neutral/lightest-cool` `#F5F8FB`, apoi aliasul `Background Color/highlight`); notează ID-urile în `bindings.md` și în build log. [DES]
- [ ] **02** Creare pagină „Private Jet Charter”, slug `private-jet-charter`, **draft**; title, description, OG title/description (§6). [DATA]
- [ ] **03** Schelet: `page-wrapper` › Global Styles + Navbar + `main.main-wrapper#main` + Footer (instanțe existente). [DES]
- [ ] **04** Inserare secțiuni, în ordine, în `main-wrapper` (WHTML builder, HTML + CSS din `payloads/`):
  `01-search` → `02-intro` → `03-comparison` → `04-booking` → `05-special` → `06-destinations` → `07-faq`. [DES]
  Dacă builder-ul raportează conflict pe o clasă existentă (`split_*`, `group_card-*`, `button*`, `tagline_*`), se folosește clasa existentă, **nu** se creează `… 2` și nu se rescriu stilurile ei (CSS-ul payload-urilor nu le conține, cu excepția combo-urilor noi `split_image-wrapper.is-hero` și `button.is-search`).
- [ ] **05** Verificări de element după inserare (builder-ul poate să nu suporte toate tag-urile): [DES]
  - `form`: dacă devine Form Block → Action `/en`, Method `GET`, fără mesaje success/error; dacă webflow.js interceptează, refacere ca Custom Element `form` (scripts.md, Note). `input` radio/hidden/number/datetime-local, `label[for]`, `button type=button/submit`: dacă lipsesc → Custom Element cu tag-ul respectiv și aceleași clase/atribute. Radio-ul „One way” trebuie să rămână `checked`.
  - `table/caption/thead/tbody/tr/th/td`: element nativ Table sau Custom Element cu tag-ul exact; atributele `scope` obligatorii.
  - `details/summary`: Custom Element dacă nu există nativ; `open` pe primul item.
  - Atribute: `id="special-private-jet-charter"` pe secțiunea 05; `role="list"` pe cele 4 `ul`; `role="radiogroup"` + `aria-label`; `aria-hidden` pe legendă; `fetchpriority="high"` + `loading="eager"` pe foto căutare; `loading="eager"` pe imaginea blocului H1.
- [ ] **06** HtmlEmbed-uri iconuri (`payloads/icons.json`, 4): în fiecare `[data-icon]` gol un HtmlEmbed cu SVG-ul, clasă nouă **`icon-embed-fill`** (display flex, width/height 100%, center). [DES]
- [ ] **07** HtmlEmbed A (CSS stări) + B (script swap, opțional) conform `payloads/scripts.md`. [DES]
- [ ] **08** Legarea variabilelor după `payloads/bindings.md` (45 legări; rândurile ‹nou› cu ID-urile de la pasul 01). [DES]
- [ ] **09** Responsive 991 / 767 / 479 conform §5; test 320–1920 (în special tabelul la 390 și formularul la 320). [DES]
- [ ] **10** Custom code head: JSON-LD (§6), `og:url`, `twitter:*`. [MAN]
- [ ] **11** Navbar: starea activă „Private jet charter” (`aria-current="page"`), decizie globală (ca Why pasul 09). [DES]
- [ ] **12** Why LunaJets: se poate re-adăuga linkul „Other examples of charter solutions” → `/en/private-jet-charter#special-private-jet-charter` (W10), dacă clientul îl vrea. [DES]
- [ ] **13** QA: Audit panel (alt, headings, labels), Lighthouse (LCP = foto căutare), tastatură (radio-uri cu săgeți, swap, submit, details), contrast (tab-uri pe panou translucid, text alb pe destinații, etichete tabel pe `#F5F8FB`), comparație vizuală cu `figma-screenshots/ref_*` (abaterile tolerate = §1). [MAN]
- [ ] **14** Blocante go-live: integrarea reală a widget-ului (P2), FAQ confirmat sau scos (§1.2), valorile ≈ confirmate în Dev Mode (culori, `#F5F8FB`, opacitatea panoului / overlay-ului, line-height), iconuri Figma finale (P22), licențe imagini (Ibiza = `AdobeStock_…_Preview`, jet-ambulanța cu livrea Rega, posibil duplicat lounge FBO cu Why), texte P26 validate, OG image.

### Fișiere payload (ordinea de inserare)

| Fișier | Conținut | Mărime HTML / CSS |
|---|---|---|
| `payloads/01-search.html` / `.css` | Hero cu formularul `quote-search_*` | 2.8 KB / 3.3 KB |
| `payloads/02-intro.html` / `.css` | Bloc H1 (`split_*` + `is-hero` + divider) | 1.3 KB / 0.2 KB |
| `payloads/03-comparison.html` / `.css` | Header + tabel + legendă | 4.8 KB / 2.6 KB |
| `payloads/04-booking.html` / `.css` | Deposit Account | 1.3 KB / 0.9 KB |
| `payloads/05-special.html` / `.css` | 8 carduri + `id` | 7.8 KB / 0.9 KB |
| `payloads/06-destinations.html` / `.css` | 4 destinații + „View all” | 2.7 KB / 1.2 KB |
| `payloads/07-faq.html` / `.css` | FAQ (fără design Figma) | 3.2 KB / 0.6 KB |
| `payloads/icons.json` | 4 × `{section, dataIcon, label, source, embedClass, svg}` (logo + 3 iconuri interimare, `currentColor`, `aria-hidden`) | 4.6 KB |
| `payloads/scripts.md` | Embed A (CSS `:checked`, `[open]`, placeholder, focus) + embed B (swap JS) | — |
| `payloads/bindings.md` | 45 legări clasă → variabilă (ID-uri exacte) + valori brute one-off | — |
| `payloads/variables-to-create.md` | `Neutral/lightest-cool` + `Background Color/highlight` | — |

Media query-urile sunt exact `@media screen and (max-width: 991px|767px|479px)`; nicio `var(--…)` în CSS; niciun `<script>`/`<style>` în HTML; id-uri unice; SVG-urile mari (logo, iconuri) sunt wrapper-e goale `data-icon` (inline doar săgeata butoanelor, chevron-ul FAQ, swap-ul și iconul persoană, < 250 B fiecare).

---

## Întrebări pentru client

1. **FAQ (4 întrebări, fără design Figma):** îl păstrăm ca secțiune la final (default, cu JSON-LD `FAQPage` și link spre pagina FAQ completă) sau îl scoatem? Dacă rămâne, designerul validează stilul propus. (§1.2)
2. **Widget-ul de căutare:** confirmați că `/en?requestFlight=1&trip=…&from=…&to=…&date=…&passengers=…` e acceptat de fluxul de cerere până la integrarea componentei reale? Când e disponibilă librăria `lunajets-library` pe site-ul nou? (P2)
3. Secțiunile vechi scoase: **Process (4 pași)** și **tabelul de prețuri (doar EN)** — acceptați eliminarea, cu linkul contextual spre `/en/prices`? (§1.2)
4. H1 `Private jet charter with LunaJets` (Figma) în loc de `On-demand private jet charter`; title-ul vechi păstrat: OK? (§6)
5. H2 „Special private *jet charter*” cu italic, ca restul titlurilor? Eyebrow „Bespoke charter flights” în loc de al doilea „Ways to fly”? (P14, P15)
6. Tabel: sensul lui „Yes” la Peak/blackout, Busy airport surcharges, Taxi time, Conversion rates (se aplică o taxă?); „Annual dues: None” la Membership vs „Full subscription”; ce înseamnă „Conversion rates” (vechi: „Change of aircraft category”)? Corecturile P26 OK?
7. Culoarea coloanei evidențiate (`#F5F8FB` ≈) și opacitățile panoului / overlay-ului: confirmare în Dev Mode. (P9)
8. Licențe imagini: Ibiza (`AdobeStock_292037389_Preview`), jet-ambulanța cu livrea Rega, lounge-ul FBO (posibil același ca pe Why). Iconurile Deposit: export SVG din Figma sau acceptați varianta interimară? (P22)
9. „Deposit Account” (cu majuscule, Figma) vs „deposit account” (Why) vs „Frequent Charter Program” (pagina țintă): numele final? (W20)
10. Handle-ul X/Twitter pentru `twitter:site`.
