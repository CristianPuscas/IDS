# 03 — Faza B: plan de build pentru pagina „Why LunaJets” (LunaJets → Webflow, Client-First v2)

> **Etapa:** Faza B, doar planificare. Nu se modifică nimic în Webflow, Figma sau git.
> **Data:** 2026-09-29
> **Surse:** `01-audit-old-why-lunajets.md` (live https://www.lunajets.com/en/why-lunajets), `02-audit-figma-why-lunajets.md` (Figma `kLdwkY54wIiha02RhcMP36`, frame `264:6144`, doar Desktop 1440; secțiunile 2–5 au valori estimate ≈), `../about/03-plan-about.md` (deciziile D1–D20 rămân valabile), `../about/04-build-log.md` (ce e deja construit), capturile din `figma-screenshots/` și `old-screenshots/`.
> **Site țintă:** `6a82dbc04ebf3e2d805651ab`. Pagina se construiește ca **draft**. Nu se șterge nicio clasă. Imaginile **nu se urcă**: `<img src="" alt="…">` în wrapper cu `aspect-ratio`.
> **Payload-uri gata de inserat:** `payloads/` (vezi §7 și §3).

Legendă surse text: **[F]** Figma, **[V]** pagina veche, **[F+V]** text Figma completat din vechi, **[D]** decizie din acest plan.

---

## 1. Decizii (cu default, ca build-ul să poată continua)

Deciziile About D1–D20 se aplică neschimbate (în special D12 butonul Request quote → `/en?requestFlight=1`, D14 contrast, D20 doar EN). Mai jos, doar deciziile noi (prefix **W**).

| # | Întrebare | Opțiuni | **Default** | Motiv |
|---|---|---|---|---|
| W1 | Textul H1 | `Why LunaJets?` [F] / `Why LunaJets` [V] | **`Why LunaJets?`** [F] | Designul e sursa textelor (ca pe About). Întrebarea retorică e directă și conține brandul; ES are deja `¿Por qué LunaJets?`. Un singur H1. |
| W2 | Title tag | `Why Choosing LunaJets…` [V] | **`Why Choose LunaJets for Your Next Private Flight`** (48 car.) | Corectură gramaticală. og:title, twitter:title și JSON-LD `name` derivă din el. |
| W3 | Sursa textelor | Figma / vechi | **Figma pentru tot ce e desenat**; din vechi doar ce lipsește și contează (paragraful Tailored, linkurile, alt-urile) | Consecvent cu About. Textele Figma sunt în sentence case, `capitalize` global dispare. |
| W4 | „With 20 years of experience” (fondată dec. 2007 ⇒ ~19 ani în 2026) | 20 / nearly 20 / since 2007 | **`With nearly 20 years of experience…`** | Adevărat acum și până în dec. 2027; schimbare minimă a textului vechi. De confirmat cu clientul. |
| W5 | Paragraful de sub „Tailored for every need” (absent în Figma, dar Figma lasă un spacer-24 după header) | păstrăm / scoatem | **Păstrăm** (text [V] + W4), `p.speakable` în `max-width-medium` | SEO + speakable + suportă 2 linkuri contextuale (W9). Impact vizual mic (pattern Section header din About). |
| W6 | Eyebrow Tailored: `Ways to fly` [F] dublează `Two ways to fly` | F / V | **`Bespoke private flights`** [V] | Evită repetiția; descrie corect secțiunea. |
| W7 | Mapare iconuri (vechi semantic greșite) | — | **Iconurile Figma, redesenate ca line-icons 32×32 `currentColor`** (hero: lacăt deschis, chitanță, romb în cadru; avantaje: stea, telefon mobil, ceas deșteptător, grafic descendent, calendar cu x, card). Refolosite din vechi doar `07-smartphone` și `11-credit-card` (normalizate). Eliminate: telefon pentru „top operators’ fleet”, ceas pentru „No hidden costs”, săgeți ramificate, trend plin | SVG-urile Figma nu au putut fi exportate (limita MCP). Iconurile din `icons.json` sunt **interimare**; se înlocuiesc cu exportul Figma (noduri `264:6198`, `264:6208`, `264:6184`, `264:6264…6306`) fără schimbare de structură. |
| W8 | Imaginea crypto (vechi: XRP / Bitcoin Cash, monede neacceptate) | vechi / Figma | **Imaginea Figma** (grafice de trading pe monitoare, fără monede anume) + pastilele BTC/ETH/USDT/USDC | Rezolvă contradicția. Alt nou, generic. |
| W9 | Hub fără linkuri spre sub-pagini | bloc nou / linkuri contextuale | **Linkuri contextuale `text-style-link` în textele existente**, fără element vizual nou: hero „Swiss expertise” → `/en/about-us`, „clients’ demanding level of expectation” → `/en/why-lunajets/testimonials`; Ways „4,800 aircraft” → `/en/fleet`; Tailored „LunaGroup Charter” → extern, „our team” → `/en/why-lunajets/our-team`; Payment „deposit account” → `/en/frequent-charter-program`, „LunaSolutions” → extern | Hub-ul câștigă linkuri contextuale fără design nevalidat. History/management/locations sunt deja legate contextual din About. `…/lunajets-one-of-the-best-employer-in-switzerland` rămâne orfană: se rezolvă pe pagina Careers/Media (în afara scopului). |
| W10 | Ancora ruptă `#special-private-jet-charter` („Other examples of charter solutions”) | reparăm / scoatem | **Linkul dispare** (cardul 4 Figma îl înlocuiește cu „Music & entertainment”). **Task pentru rebuild-ul Private Jet Charter:** secțiunea `section_special-jet` primește `id="special-private-jet-charter"`, apoi se poate re-adăuga link cu ancoră oriunde | Nu publicăm linkuri spre ancore inexistente. |
| W11 | Gradientul navy (a 2-a folosire după About Services) | extragem clasă / duplicăm | **Duplicat pe `section_why-advantages`** (valoare brută one-off) | Extragerea în `background-gradient-dark` ar cere modificarea About (clasă re-aplicată). Se face la a 3-a folosire. |
| W12 | Titlu card ≈32px (Ways) | clasă nouă / utilitar | **Clasă nouă `card-split_title`** pe `h3`: 2rem / lh 1.1 / ls 0.03em (991: 1.75rem; 767: 1.5rem) | Nicio treaptă existentă nu are 32px (H2 40, H3 24). |
| W13 | Line-height text card ≈1.8 (≈29px) | 1.5 / 1.8 | **1.5** (tag `p` global, fără clasă nouă) | Estimare ≈ din geometrie, fără Dev Mode; tot restul site-ului e 1.5. Se revine doar dacă Dev Mode confirmă 1.8. |
| W14 | Header → conținut 56px [F] | 3.5rem / 4rem | **`spacer-xlarge` (4rem)** | Identic About; 3.5rem nu e în scală și diferența de 8px nu se vede. |
| W15 | Padding Avantaje 112px [F] | `padding-section-large` / medium | **`padding-section-medium`** | Aceeași componentă vizuală ca Services din About (80px). |
| W16 | Padding card 48px (Ways) vs 66/46 (Pricing/Payment) | — | **3rem peste tot**; `min-height: 22rem` pe `card-split_content` (Figma 350 / 384) | O singură valoare de sistem; butonul aliniat jos (`margin-top: auto`). |
| W17 | Distanța Pricing → Payment ≈30px [F] | aceeași secțiune / separat | **2 secțiuni separate** (`section_why-pricing`, `section_why-payment`), fiecare `padding-section-medium` | Ritm identic cu restul paginii (80 + 80). |
| W18 | Blocul „The private jet charter app you need” (vechi; **absent în Figma**) | păstrăm / scoatem | **Scos** | Badge-urile App Store / Google Play există în Footer (componenta globală); „App and loyalty program” rămâne în avantaje. |
| W19 | Regula imaginii pe mobil | — | **Hero:** text primul, imaginea sub text (ca About hero, H1 above the fold). **card-split** (Ways, Pricing, Payment): **imaginea deasupra cardului** la ≤991 (`order: -1`), indiferent de ordinea DOM (ca `split_*` din About) | Aceeași regulă pe tot site-ul. |
| W20 | Numele programului: „The deposit account” [F] vs „Frequent Charter Program” [V] (și „funding your Frequent Charter Program” în textul crypto) | F / V | **Textele Figma** („deposit account”), link spre `/en/frequent-charter-program` | De confirmat: dacă produsul se redenumește, slug-ul și pagina țintă se schimbă. |
| W21 | Licențe imagini: `AdobeStock_628304018_Preview` (câine, **preview nelicențiat**), `ChatGPT Image 15 sept 2026` (chitară, **generată AI**), `AdobeStock_438748456` (hangar, de verificat licența) | — | Build cu placeholder-e; **blocant go-live** până la fișiere licențiate | Risc juridic. |
| W22 | Titluri feature hero: heading sau nu? | h3 / p | **`p.heading-style-h4`** | Sub H1 ar fi H3 fără H2 (salt de nivel); pe vechi erau tot `<p>`. |
| W23 | Carduri Tailored: link | pe titlu + JS / card întreg | **Card întreg = `a.tailored_card-content`** (link block), fără JS; cardul 4 fără link (`div` cu aceeași clasă) | Webflow nu poate crea `::after` din Designer; scriptul `data-lj_card_link` nu există pe site-ul nou. |
| W24 | Butoane: 4 × „Discover more” | — | `button is-secondary is-icon` + `button_sr-text` (nume accesibile unice) | Etichetă Figma; hrefs din vechi (`/en/private-jet-charter`, `/en/frequent-charter-program`, `/en/prices`, `/en/why-lunajets/private-jet-hire-cost/pay-with-cryptocurrency`). Label-urile vechi („See Full Pricing Details” etc.) dispar. |
| W25 | CTA hero: ls 3px [F] vs 0.1em (`button`) | — | **`button is-icon`**, fără combo (ls 0.1em) | Stilul text Figma a fost suprascris local; normalizat. |
| W26 | Tagline hero → H1: 24px [F] | spacer-small / custom1 | **`spacer-custom1`** (1.25rem), ca pe toată pagina și pe About | Sistem unic tagline → titlu. H1 → P = `spacer-small` (24 [F]). |

---

## 2. Maparea URL-urilor

| URL VECHI | URL NOU | ACȚIUNE | CMS | REDIRECT |
|---|---|---|---|---|
| `https://www.lunajets.com/en/why-lunajets` (și `x-default`) | `…/en/why-lunajets`, pagină statică „Why LunaJets”, **slug `why-lunajets`**, locale EN | Rebuild, Faza C (draft) | Nu | Niciunul dacă EN rămâne pe `/en/` (ca About, §2.1 acolo) |
| `/fr/pourquoi-lunajets` | idem, localizat | Localizare FR | Nu | Niciunul cu Localization; altfel 302 temporar → `/en/why-lunajets` |
| `/de/warum-lunajets`, `/it/perche-lunajets`, `/es/porque-lunajets`, `/ru/pochemu` (fără „lunajets”!), `/hu/miert-lunajets`, `/pl/dlaczego-lunajets` | idem | Localizare | Nu | idem |
| `/en/why-lunajets/private-jet-hire-cost` | `/en/prices` | — | — | **301 de replicat** pe site-ul nou (există pe vechi) |

**hreflang:** doar prin Webflow Localization (automat, 8 locale + x-default). Cât timp e doar EN (D20), **fără hreflang manual**. Slug-urile localizate se păstrează identic, inclusiv `ru/pochemu`. La localizare, cardurile Ways rămân **H3 în toate limbile** (pe vechi, non-EN aveau H2).

**De verificat în Faza C:** sub-paginile sunt la `/en/why-lunajets/*` (history, team, …). Pe site-ul țintă, pagina `why-lunajets` și un folder `why-lunajets` trebuie să coexiste; se verifică cum e rezolvat pe site-ul vechi (`67c72c8a3c305a53672bdcca`, read-only) și se replică. Dacă Designer-ul refuză slug-ul identic, pagina se creează ca pagină a folderului conform soluției de pe vechi, fără a schimba URL-ul public.

Linkuri spre pagini încă neconstruite (registrul §2.4 din About, + ): `/en/fleet`, `/en/frequent-charter-program`, `/en/prices`, `/en/why-lunajets/testimonials`, `/en/why-lunajets/private-jet-hire-cost/pay-with-cryptocurrency`, `/en/insights/flying-with-pets-on-a-private-jet`, `/en/private-jet-services/last-minute-flights`, `/en/private-jet-services/emergency-charter`. Rămân URL links cu calea de producție; devin Page links când paginile există.

---

## 3. Clase

### 3.1 Refolosite (NU se redefinesc; nu apar în CSS-ul payload-urilor)

- Structură: `page-wrapper`, `main-wrapper`, `padding-global`, `container-large`, `padding-section-medium`, `max-width-large` (48rem), `max-width-medium` (35rem).
- Spacere: `spacer-small` (1.5), `spacer-large` (3), `spacer-xlarge` (4), `spacer-xxlarge` (5), `spacer-custom1` (1.25).
- Tipografie: tag-urile `h1`–`h3`, `p`, `em`; `heading-style-h4`, `text-size-tiny`, `text-style-link`.
- Eyebrow: `tagline_component`, `tagline_line`, `tagline_text`.
- Butoane: `button`, `is-secondary`, `is-icon`, `button_icon`, `button_sr-text` (folosit și în linkurile externe inline pentru „(opens in a new tab)”).
- Media: `image-cover`.
- Services (About): `services_list`, `services_card`, `services_icon`, `services_card-title`, `services_icon-embed`.
- Componente: Global Styles, Navbar, Footer.
- `speakable`: planificată în About §5.4 (fără stiluri). **Dacă nu există** (payload-urile About nu au folosit-o), builder-ul o creează din HTML; dacă nu, se creează manual goală.

### 3.2 Noi

| Clasă | Tip | Payload | Rol |
|---|---|---|---|
| `section_why-hero` | secțiune | 01 | position relative |
| `why-hero_component` | custom | 01 | grid 13fr/10fr, gap 5rem / 3rem |
| `why-hero_content` | custom | 01 | coloana text |
| `why-hero_feature-list` | custom | 01 | grid 2 col, gap 3rem / 2rem |
| `why-hero_feature-item` | custom | 01 | flex column, gap 0.5rem |
| `why-hero_feature-icon` | custom | 01 | 1.875rem, margin-bottom 0.5rem (total 16px [F]) |
| `why-hero_cta-wrapper` | custom | 01 | plasare grid col 1 / rând 2 pe desktop |
| `why-hero_image-wrapper` | custom | 01 | aspect 24/25 (991: 4/3), radius |
| `why-hero_icon-embed` | custom | pas embed | HtmlEmbed 100% × 100% |
| `section_why-ways` | secțiune | 02 | — |
| `card-split_component` | custom **partajat** | 02 | grid 1fr 1fr, gap 0, stretch |
| `card-split_content` | custom | 02 | flex column, padding 3rem, border, min-height 22rem |
| `card-split_title` | custom | 02 | 2rem / 1.1 (W12) |
| `card-split_button-wrapper` | custom | 02 | margin-top auto |
| `card-split_image-wrapper` | custom | 02 | relative, overflow hidden, radius; ≤991 order −1, 16/9 |
| `section_why-advantages` | secțiune | 03 | navy + gradient, text alb |
| `services_card is-third` | **combo** | 03 | 3 coloane (767: 2) |
| `section_why-tailored` | secțiune | 04 | — |
| `tailored_list` | custom | 04 | `ul` grid 4 col (991: 2; 767: 1, max 28rem) |
| `tailored_card` | custom | 04 | `li`, display flex (înălțimi egale) |
| `tailored_card-content` | custom | 04 | `a` (link block) sau `div`; flex column centrat, gap 1rem |
| `tailored_card-image-wrapper` | custom | 04 | aspect 1/1, radius |
| `tailored_card-text` | custom | 04 | 0.9375rem / 1.5 |
| `section_why-pricing` | secțiune | 05 | — |
| `section_why-payment` | secțiune | 06 | — |
| `why-payment_header` | custom | 06 | flex column, aliniat dreapta (991: stânga) |
| `tagline_component is-reverse` | **combo** | 06 | row-reverse (991: row) |
| `card-split_content is-right` | **combo** | 06 | text-align right (991: left) |
| `card-split_chip-list` | custom | 06 | `ul` absolut pe imagine, vertical (767: rând jos-stânga) |
| `card-split_chip` | custom | 06 | pastilă verticală (`writing-mode: vertical-rl` + rotate 180°) |

Combo-uri noi: 3, fiecare cu nume unic în payload-ul lui (`is-third` în 03; `is-reverse` și `is-right` în 06). Maxim 3 clase în stack (`button is-secondary is-icon`).

---

## 4. Arborele paginii

```
body
└─ div.page-wrapper
   ├─ [Global Styles]  ├─ [Navbar]
   ├─ main.main-wrapper#main
   │  ├─ 4.1 section.section_why-hero
   │  ├─ 4.2 section.section_why-ways
   │  ├─ 4.3 section.section_why-advantages
   │  ├─ 4.4 section.section_why-tailored
   │  ├─ 4.5 section.section_why-pricing
   │  └─ 4.6 section.section_why-payment
   └─ [Footer]
```
Fiecare secțiune: `section_*` › `padding-global` › `container-large` › `padding-section-medium` (ca About).

### 4.1 Hero (`01-hero`)
```
why-hero_component
├─ why-hero_content
│  ├─ [Tagline] "Independent & Swiss"                                          [F]
│  ├─ spacer-custom1 ├─ h1 "Why LunaJets?" [F] (W1) ├─ spacer-small
│  ├─ p.speakable "Being a fully independent booking platform, … driven by our [Swiss expertise] and our [clients’ demanding level of expectation]."  [F] + linkuri (W9)
│  ├─ spacer-large
│  └─ why-hero_feature-list
│     ├─ why-hero_feature-item › why-hero_feature-icon[data-icon=lock-open] + p.heading-style-h4 "No commitment" + p.text-size-tiny "No long-term contracts, and no minimum flying time."
│     ├─ … [receipt] "No hidden costs" / "Which includes crew, catering, airport handling, taxi time, etc."
│     ├─ … [focus-diamond] "Curated selection of aircraft" / "Tailored to your route and passenger needs."
│     └─ why-hero_cta-wrapper › a.button.is-icon "Get an instant quote" → /en?requestFlight=1 (D12)
└─ why-hero_image-wrapper › img.image-cover  (24/25, eager)
      alt: "Black and white photo of the underside of a private jet showing two engine exhausts and tail" [V]
```
Ordinea DOM f1, f2, f3, CTA; pe desktop CTA-ul e plasat explicit la col 1 / rând 2 (ca în Figma).

### 4.2 Two ways to fly (`02-ways`)
```
max-width-large › [Tagline] "Two ways to fly" › spacer-custom1 › h2 "Explore our different<br><em>ways of flying</em>"  [F]
spacer-xlarge
card-split_component
├─ card-split_content › h3.card-split_title "On-demand private<br><em>jet charter</em>" › spacer-small
│  › p "Gain access to over [4,800 aircraft] through 500 operators across the globe — without the constraints of long-term contracts or unnecessary costs." [F]
│  › spacer-small › card-split_button-wrapper › "Discover more" (sr: about on-demand private jet charter) → /en/private-jet-charter
└─ card-split_image-wrapper › img  alt "Businessman in a dark suit talking on the phone in front of a white private jet on the tarmac"
spacer-xxlarge  (88 [F] → 5rem)
card-split_component   (DOM: imagine, apoi card)
├─ card-split_image-wrapper › img  alt "Business meeting around a conference table in the LunaJets Dubai office"
└─ card-split_content › h3 "The deposit<br><em>account</em>" › p "Starts with a refundable minimum deposit of €100,000 to enjoy a streamlined booking experience, earn loyalty credits, and more." [F]
   › "Discover more" (sr: about the deposit account) → /en/frequent-charter-program
```

### 4.3 Advantages (`03-advantages`, fundal închis)
```
max-width-large › [Tagline] "What you get" › h2 "The advantages of<br><em>flying through us</em>"  [F]
spacer-xlarge
ul.services_list › 6 × li.services_card.is-third › div.services_icon[data-icon] (+ HtmlEmbed.services_icon-embed) + h3.services_card-title
   star "Access to top operators’ fleet" (apostrof adăugat) · smartphone "App and loyalty program" · alarm-clock "Empty legs & last-minute flights"
   trend-down "Lower rates in the market" · calendar-x "Most flexible cancellation terms" · credit-card "All-inclusive rates"   [F, ordinea vizuală]
```

### 4.4 Tailored (`04-tailored`)
```
max-width-large › [Tagline] "Bespoke private flights" (W6) › spacer-custom1 › h2 "Tailored for<br><em>every need</em>" [F]
   › spacer-small › max-width-medium › p.speakable "With nearly 20 years of experience and an extended network through [LunaGroup Charter], we handle the flights that others can't. Whatever the complexity, the route, or the timeline, [our team] has seen it before." [V] (W4, W5, W9)
spacer-xlarge
ul.tailored_list
├─ li.tailored_card › a.tailored_card-content → /en/insights/flying-with-pets-on-a-private-jet
│     › tailored_card-image-wrapper (1/1) › img alt "Red setter dog lying on a cream leather seat in a private jet cabin"  ⚠ W21
│     › h3.heading-style-h4 "Pet-friendly travels" › p.tailored_card-text [F=V]
├─ … → /en/private-jet-services/last-minute-flights   img "Modern private terminal lounge with sofas and a private jet visible through large windows"  "Last-minute flights"
├─ … → /en/private-jet-services/emergency-charter     img "Red air ambulance helicopter flying against a blue sky"  "Medical & air ambulance"
└─ li.tailored_card › div.tailored_card-content (fără link)  img "Guitar case resting on a cream leather seat next to a private jet window" ⚠ W21 (AI)  "Music & entertainment" [F]
```

### 4.5 Pricing (`05-pricing`)
```
max-width-large › [Tagline] "Pricing promise" › h2 "Transparency at<br><em>the best price</em>"  [F]
spacer-xlarge
card-split_component
├─ card-split_content (fără titlu) › p.speakable "Our quotes are transparent, … to fuel surcharges." [F=V] › spacer-small › "Discover more" (sr: about our pricing) → /en/prices
└─ card-split_image-wrapper › img alt "Black and white photo of a private jet parked inside a hangar"
```

### 4.6 Payment (`06-payment`)
```
why-payment_header › [Tagline.is-reverse] "Payment options" › spacer-custom1 › h2 "Seamless payment<br><em>incl. cryptocurrencies</em>" (fără U+200D) [F]
spacer-xlarge
card-split_component
├─ card-split_image-wrapper › img alt "Person pointing at trading charts displayed on two computer monitors" (W8)
│     + ul.card-split_chip-list[aria-label="Accepted cryptocurrencies"] › li.card-split_chip × 4: BTC · ETH · USDT · USDC
└─ card-split_content.is-right › p.speakable "At LunaJets, … funding a [deposit account], or purchasing an aircraft through [LunaSolutions]." [F] (W20)
      › "Discover more" (sr: about crypto payment options) → /en/why-lunajets/private-jet-hire-cost/pay-with-cryptocurrency
```

---

## 5. Responsive (fără frame-uri Figma; aceleași principii ca About §9)

| Element | 991 | 767 | 479 |
|---|---|---|---|
| Hero `why-hero_component` | 1 coloană; text, apoi imaginea (aspect **4/3**) | row-gap 2rem | — |
| Hero feature-list | rămâne 2 col; CTA pe rândul 3, pe toată lățimea (f3 trece la col 1) | **1 coloană**, gap 2rem; CTA ultimul | — |
| `card-split_component` | 1 coloană; **imaginea deasupra** (`order:-1`, 16/9); card fără min-height, padding 2rem | titlu 1.5rem | padding card 1.5rem |
| `card-split_title` | 1.75rem | 1.5rem | — |
| Payment header / tagline / card `is-right` | aliniate **stânga**, tagline normal (row) | — | — |
| Chips crypto | vertical pe marginea dreaptă a imaginii | **rând orizontal, jos-stânga** pe imagine (text orizontal) | idem |
| `services_card is-third` | 3 col (identic base) | 2 col | 2 col (padding card 1.5rem 0.75rem din About) |
| `tailored_list` | 2 × 2 | 1 coloană, max-width 28rem centrat, gap 2.5rem | — |
| Tipografie / spacing / padding-section | scala existentă (About §9) | idem | idem |

Verificări: fără scroll orizontal la 320 (preview local la 390 și 1440: OK), `<br>` din H2 se rup curat, ținte touch ≥44px, `writing-mode` al pastilelor funcționează (vezi §7, pasul 06).

---

## 6. SEO

| Element | Valoare |
|---|---|
| Slug | `why-lunajets` |
| Title | `Why Choose LunaJets for Your Next Private Flight` (48 car.) (W2) |
| Meta description | `We offer a smarter way to fly private with on-demand charters, all-inclusive fixed pricing, and no upfront fees, backed by our 24/7 advisory team.` (146 car.) [V] |
| OG / Twitter title + description | identice cu title / description |
| OG image | PNG-ul dedicat de pe vechi (`…699db094114ae48855010706_why-choosing-lunajets-for-your-next-private-flight.png`), redenumit `why-choose-lunajets…`, după upload-ul de asset-uri; gol pe staging |
| Custom code head | `<meta property="og:url" content="https://www.lunajets.com/en/why-lunajets">`, `<meta name="twitter:site" content="@lunajets">` (de confirmat), `twitter:image` = OG image |
| Canonical | self (prin Global Canonical la go-live, About §10) |
| Indexare | staging fără index; producție fără `noindex` |

**Outline:**
```
H1  Why LunaJets?
H2  Explore our different ways of flying
  H3  On-demand private jet charter · The deposit account
H2  The advantages of flying through us
  H3  × 6 (services_card-title)
H2  Tailored for every need
  H3  Pet-friendly travels · Last-minute flights · Medical & air ambulance · Music & entertainment
H2  Transparency at the best price
H2  Seamless payment incl. cryptocurrencies
(Titlurile feature din hero sunt <p> (W22); navbar/footer fără headings.)
```

**Alt text:** în §4 și în payload-uri. Iconuri: `aria-hidden="true"`. Linkuri externe: `target="_blank" rel="noopener"` + „(opens in a new tab)” sr-only.

**JSON-LD** (Page settings → Custom code → Head; `Organization`/`WebSite` sunt site-wide, About §10):
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": "https://www.lunajets.com/en/why-lunajets#webpage",
      "url": "https://www.lunajets.com/en/why-lunajets",
      "name": "Why Choose LunaJets for Your Next Private Flight",
      "description": "We offer a smarter way to fly private with on-demand charters, all-inclusive fixed pricing, and no upfront fees, backed by our 24/7 advisory team.",
      "inLanguage": "en",
      "isPartOf": { "@id": "https://www.lunajets.com/#website" },
      "about": { "@id": "https://www.lunajets.com/#organization" },
      "breadcrumb": { "@id": "https://www.lunajets.com/en/why-lunajets#breadcrumb" },
      "speakable": { "@type": "SpeakableSpecification", "cssSelector": [".speakable"] }
    },
    {
      "@type": "BreadcrumbList",
      "@id": "https://www.lunajets.com/en/why-lunajets#breadcrumb",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.lunajets.com/en" },
        { "@type": "ListItem", "position": 2, "name": "Why LunaJets", "item": "https://www.lunajets.com/en/why-lunajets" }
      ]
    }
  ]
}
</script>
```
`speakable` țintește 4 paragrafe scurte (hero, Tailored, Pricing, Payment). `primaryImageOfPage` se adaugă după upload-ul imaginii hero. Validare: Rich Results Test + validator.schema.org.

---

## 7. Pași de build (Faza C)

[DES] = Designer API (pagina deschisă, MCP Bridge conectat) · [DATA] = Data API · [MAN] = manual. Fiecare pas: captură + aprobare.

- [ ] **00** Verificare slug/folder `why-lunajets` (§2). [DATA] listare pagini/foldere
- [ ] **01** Creare pagină „Why LunaJets”, slug `why-lunajets`, **draft**; title, description, OG title/description (§6). [DATA]
- [ ] **02** Schelet: `page-wrapper` › Global Styles + Navbar + `main.main-wrapper#main` + Footer (instanțe existente, ca pe About). [DES]
- [ ] **03** Inserare secțiuni, în ordine, în `main-wrapper` (WHTML builder, HTML + CSS din `payloads/`):
  `01-hero` → `02-ways` → `03-advantages` → `04-tailored` → `05-pricing` → `06-payment`. [DES]
  Payload 02 **înaintea** lui 05/06 (creează `card-split_*`; 05/06 doar le refolosesc). Dacă builder-ul raportează conflict de nume pe o clasă existentă, se folosește clasa existentă, nu se creează duplicat (`… 2`).
- [ ] **04** HtmlEmbed-uri pentru iconuri (`payloads/icons.json`, 9 bucăți): în fiecare `[data-icon]` gol se pune un HtmlEmbed cu SVG-ul corespunzător; clasă `why-hero_icon-embed` (hero, clasă nouă: display flex, 100% × 100%) sau `services_icon-embed` (avantaje, existentă). Apoi atributele `data-icon` se pot păstra (inofensive). [DES]
- [ ] **05** Legarea variabilelor după `payloads/bindings.md` (8 legări). [DES]
- [ ] **06** Verificări specifice: `grid-column/row-start/end` pe `why-hero_cta-wrapper` aplicate pe clasă (nu `w-node`); `writing-mode` + `rotate(180deg)` pe `card-split_chip` (dacă builder-ul nu acceptă `writing-mode`: custom property în Style panel sau regulă în embed-ul Global Styles `.card-split_chip{writing-mode:vertical-rl}` + media 767 `horizontal-tb`); `aria-label` pe `ul.card-split_chip-list`; `role="list"` pe liste; `target`/`rel` pe linkurile externe. [DES]
- [ ] **07** Responsive 991 / 767 / 479 conform §5; test 320–1920. [DES]
- [ ] **08** Custom code head: JSON-LD (§6), `og:url`, `twitter:site`, `twitter:image`. [MAN]
- [ ] **09** Navbar: starea activă a linkului „Why LunaJets” (`aria-current="page"` / stil current) — linkurile navbar sunt URL links, deci `w--current` nu apare automat. [DES], de decis global
- [ ] **10** QA: Audit panel (alt, headings), Lighthouse, tastatură (focus pe cardurile-link Tailored), contrast pastile pe foto, comparație vizuală cu `why-lunajets-desktop-full_264-6144.png` (abateri tolerate: cele din §1). [MAN]
- [ ] **11** Blocante go-live: W21 (licențe imagini), W7 (iconuri Figma finale), W4/W20 (texte de confirmat), imagini reale + OG image, D6/D12/D20 din About, 301 `private-jet-hire-cost` → `/en/prices`.

### Fișiere payload

| Fișier | Conținut | Mărime |
|---|---|---|
| `payloads/01-hero.html` / `.css` | Hero | 2.1 KB / 1.2 KB |
| `payloads/02-ways.html` / `.css` | Two ways + clasele `card-split_*` | 2.4 KB / 0.9 KB |
| `payloads/03-advantages.html` / `.css` | Avantaje + combo `is-third` | 1.4 KB / 0.3 KB |
| `payloads/04-tailored.html` / `.css` | Tailored | 3.1 KB / 0.8 KB |
| `payloads/05-pricing.html` / `.css` | Pricing (doar clasa de secțiune) | 1.2 KB / 0.04 KB |
| `payloads/06-payment.html` / `.css` | Payment + chips + combo-uri `is-reverse`, `is-right` | 2.1 KB / 1.2 KB |
| `payloads/icons.json` | 9 × `{section, dataIcon, label, source, svg}` (`currentColor`, `aria-hidden`) | 7.9 KB |
| `payloads/bindings.md` | Tabelul de legare a variabilelor (ID-uri exacte) | — |

Media query-urile sunt exact `@media screen and (max-width: 991px|767px|479px)`; nicio `var(--…)` în CSS; niciun `<script>`; iconurile mari nu sunt inline (doar săgeata butoanelor, ca pe About).

---

## Întrebări pentru client

1. H1 `Why LunaJets?` (Figma) și title `Why Choose LunaJets for Your Next Private Flight`: OK? (W1, W2)
2. „Nearly 20 years” sau altă formulare (fondată dec. 2007)? (W4)
3. Numele programului: „deposit account” (Figma) sau „Frequent Charter Program” (vechi)? Minimul €100,000 și „4,800 aircraft / 500 operators” sunt corecte? (W20)
4. Licențe: imaginea câinelui e un **Adobe Stock Preview**, chitara e **generată AI**, hangarul (AdobeStock_438748456) — avem fișierele licențiate? (W21)
5. Cardul „Music & entertainment” înlocuiește „The unusual ones are our specialty”: OK? Există o pagină spre care să ducă?
6. Secțiunea app („The private jet charter app you need”) dispare (badge-urile rămân în footer): OK? (W18)
7. Export SVG pentru cele 9 iconuri Figma (sau acceptați iconurile interimare)? (W7)
8. Handle-ul X/Twitter `@lunajets` pentru `twitter:site`.
