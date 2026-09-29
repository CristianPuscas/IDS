# 02 — Audit Figma: pagina „Why LunaJets” (LunaJets)

- **Fișier Figma:** fileKey `kLdwkY54wIiha02RhcMP36`, pagina `LJ` (`264:5234`)
- **Tip audit:** READ-ONLY. Nu s-a scris nimic în Figma sau în Webflow și nu s-a atins git-ul.
- **Țintă:** reconstrucție în Webflow cu Client-First v2, **refolosind sistemul construit pentru About** (vezi `../about/02-audit-figma-about.md` și `../about/04-build-log.md`).
- **Data:** 2026-09-29
- **Capturi:** `/home/user/IDS/migration/why-lunajets/figma-screenshots/`

| Fișier | Conținut |
|---|---|
| `why-lunajets-desktop-full_264-6144.png` | Frame-ul complet (655×2400, redus din 1440×5277). Sloturile foto sunt goale |
| `01-section-hero_264-6172.png` | Hero la rezoluție mai mare (1024 px, din `get_design_context`) |
| `00-navbar…`, `01b-section-hero-full…`, `02-section-fly-ondemand…`, `03-section-fly-deposit…`, `04-section-advantages…`, `05-section-tailored…`, `06-section-pricing-payment…`, `07-footer…` | Decupaje per secțiune din captura completă (scara 0.455) |
| `reference-image-41_264-7690_full.png` | Imaginea de referință completă (4296×5000) |
| `reference-image-41_why-lunajets-column.png` | Decupajul coloanei „Why LunaJets” din referință (1093×4011, scara 0.759 față de frame) |
| `ref_00-…` … `ref_07-…` | Aceleași secțiuni, decupate din referință (cu fotografiile puse la locul lor) |

> ⚠️ **Limitare de acces (important).** După 4 apeluri, MCP-ul Figma a răspuns cu *„You've reached the Figma MCP tool call limit on the Starter plan”*. Toate tool-urile Figma au fost blocate după aceea (inclusiv `get_screenshot`). Ce s-a obținut:
> - `get_metadata` pentru toată pagina, deci **structura completă, node ID-urile, pozițiile, dimensiunile și toate textele** (numele layerelor text = conținutul lor, verificat vizual pe capturi);
> - `get_screenshot` pentru frame-ul complet;
> - `get_design_context` **doar pentru Hero** (`264:6172`), deci fonturi, mărimi și variabile exacte doar acolo.
>
> Pentru secțiunile 2–7, **mărimile de font, line-height-urile și radius-urile sunt estimate** din geometria din metadata (înălțimea blocurilor de text / numărul de rânduri) și din capturi. Toate aceste valori sunt marcate cu **≈** și trebuie confirmate în Dev Mode înainte de build. `get_variable_defs` nu a mai putut fi rulat.
>
> Imaginea de referință la rezoluție mare (4296×5000) provine din randarea `264:7690` făcută în sesiunea de audit About și salvată local de tool. Descărcarea prin `curl` de pe figma.com e blocată de proxy.

---

## 1. Frame-uri și breakpoint-uri

| Nod | Nume | Poziție (x, y) | Dimensiune | Rol |
|---|---|---|---|---|
| **`264:6144`** | **Why LunaJets — LunaJets** | 2215.5, 114.45 | **1440 × 5277** | **Desktop, în scop** |
| `264:7694` | text `https://www.lunajets.com/en/why-lunajets` | 2359, 9 | — | URL-ul live, deasupra frame-ului |
| `264:7690` | image 41 | 6409, -94 | 5216 × 6071 | Referința cu fotografiile (coloana din mijloc = Why LunaJets) |
| `264:6774` | CHART MOBILE | 5591, 1206 | 393 × 1118 | **Nu** aparține paginii. E tabelul comparativ mobil pentru Private Jet Charter (coloanele LUNAJETS / Fractional ownership / …) |

| Breakpoint | Stare |
|---|---|
| Desktop 1440 | ✅ `264:6144` |
| Tablet (991) | ❌ **LIPSEȘTE** |
| Mobile landscape (767) | ❌ **LIPSEȘTE** |
| Mobile portrait (479) | ❌ **LIPSEȘTE** |

→ Comportamentul responsive se definește de noi, cu aceleași reguli ca la About (vezi §5).

**Ordinea verticală (y în frame):**

| # | Secțiune | Nod | Nume layer | y | Înălțime | Fundal |
|---|---|---|---|---|---|---|
| 0 | Navbar | `264:6145` | Top-navbar | 0 | 76 | navy |
| 1 | Hero | `264:6172` | `section_about_hero` (!) | 76 | 678 | alb |
| 2a | Două moduri de zbor: charter | `264:6223` | `_w-fly_section` | 754 | 693 | alb |
| 2b | Două moduri de zbor: deposit | `264:6242` | `_w-fly_section` | 1447 | 430 | alb |
| 3 | Avantaje | `264:6255` | `_w-fly_advantages_section` | 1877 | 651 | navy + gradient |
| 4 | Tailored for every need | `264:6313` | `Container` (!) | 2528 | 797 | alb |
| 5 | Pricing + Payment | `264:6345` | `_w-fly_section` | 3325 | 1289 | alb |
| 6 | Footer | `264:6394` | Footer Container (instanță) | 4614 | 681 | navy |

---

## 2. Secțiuni, în detaliu (Desktop 1440)

### 0. Navbar: `264:6145`

- Identic cu About (`264:5855`): logo 100×20, 5 linkuri (layerul `DESTINATIONS` e ascuns și aici), `IconButtonSmall/onDark` + 3 × `ButtonSmall/onDark` (`264:6168`–`264:6171`).
- În captura de design, butoanele `EN ▾` și `REQUEST QUOTE` apar goale (instanțe randate incomplet). În referință apar normal.
- Nu e desenată nicio stare activă pentru linkul `WHY LUNAJETS`.
- **Reutilizare:** componenta Webflow **Navbar** existentă, **ca atare**. Opțional: clasa `w--current` / o stare activă pe link, nedesenată.

### 1. Hero: `264:6172` (1440 × 678) — singura secțiune cu `get_design_context`

**Layout.** Totul e **poziționat absolut** (fără auto-layout, fără `container-medium`). Coloana de text începe la x=80. Slotul de imagine e la x=823.

- Coloana text: ~**656.5 px** (lățimea paragrafului), de la x=80 la 736.5.
- Coloana imagine: frame `264:6216` „section_deposit-hero”, **504 × 524**, la x=823, y=101.5. Marginea dreaptă e la 1327, **nu** la 1360 (marginea containerului de 1280).
- Gap real între coloane: 86.5 px. Padding sus: 80 px. Jos: ~73 px (feature-ul 3 se termină la y=605).

**Conținut (ordinea vizuală):**

| # | Element | Nod | Specificații (exacte, din design context) |
|---|---|---|---|
| 1 | Eyebrow `INDEPENDENT & SWISS` | `264:6173` / text `264:6175` | linie 24×1 `#061D38`, gap 10; text **Gilroy Regular** 11px, ls 2.42px, lh normal, `#061D38` |
| 2 | spacer 24 | `264:6176` | — |
| 3 | **H1** `Why LunaJets?` | `264:6177` | **Vanitas Extrabold 54px, line-height 1 (leading-none)**, fără letter-spacing, `#061D38`. **Un singur rând, fără parte italică** |
| 4 | spacer 24 | `264:6178` | — |
| 5 | Paragraf | `264:6179` | Gilroy Regular 16/24, ls 0.4px, lățime 656.5: `Being a fully independent booking platform, LunaJets guarantees the best neutral options in the industry. We deliver thorough, timely and personalised service, driven by our Swiss expertise and our clients’ demanding level of expectation.` |
| 6 | spacere 40 / 72 / 40 | `264:6180`–`6182` | Rămășițe, nu corespund elementelor. Distanța reală paragraf → feature-uri este **~54–57 px** |
| 7 | Grilă de 3 feature-uri + CTA | vezi mai jos | 2 coloane × 312 px, gap coloane **32 px**, gap rânduri ~53–56 px |

**Feature item** (3 bucăți, câte 312 × 114): icon SVG **30×30** → gap **16** → titlu → gap **8** → descriere.
- Titlu: **Vanitas Extrabold 20px / 24px**, ls 0 (stil Figma `Vanitas/Bold`, variabilele `font size/20`, `line height/24`).
- Descriere: **Gilroy Regular 12px / 18px, ls 0.4px** (stil `Gilroy/Regular`, variabilele `font size/12`, `line height/18`, `letter spacing/0_4`).

| Poziție | Nod | Icon | Titlu | Descriere |
|---|---|---|---|---|
| rând 1, col 1 (80.5, 324.28) | `264:6197` (icon `264:6198`) | lacăt deschis | `No commitment` | `No long-term contracts, and no minimum flying time.` |
| rând 1, col 2 (424.5, 321) | `264:6207` (icon `264:6208`) | chitanță / bon | `No hidden costs` | `Which includes crew, catering, airport handling, taxi time, etc.` |
| rând 2, col 2 (424.5, 491) | `264:6184`, în wrapperul `264:6183` de 1000 px (!) | romb într-un cadru de focalizare | `Curated selection of aircraft` | `Tailored to your route and passenger needs.` |

**CTA** `264:6193` „Link”, la rândul 2, coloana 1 (x=80, y=535):
- **Buton plin navy** `#061D38`, **284 × 47**, radius **2px** (`corner radius/2`).
- Text `Get an instant quote` (afișat UPPERCASE): Gilroy SemiBold 12px, **ls 3px** (`letter spacing/3`, stilul `Semantic/Link upper`), alb, începe la x=35.
- Săgeată SVG 14×14 (`264:6195`), gap 10.

**Slot imagine:** `264:6216`, **504 × 524** (raport **0.962 ≈ 24:25**, aproape pătrat), dreapta, radius 0, fără layer de imagine în design (frame gol, cu spacere rămase și un layer ascuns `_w-why-grid-icon`). În referință: **fotografie alb-negru a unui avion privat văzut de dedesubt/din spate** (coadă, cele două motoare, burta), pe cer deschis. Rol: imaginea hero (LCP → `loading="eager"`).

**Reutilizare:**

| Element | Decizie |
|---|---|
| Structura `section_` › `padding-global` › `container-large` › `padding-section-medium` | **ca atare** |
| Eyebrow | `tagline_component` / `tagline_line` / `tagline_text` **ca atare**. Designul arată Gilroy **Regular** aici, față de Bold în auditul About; vizual e aproape identic, păstrăm clasa existentă (700) și semnalăm la §6 |
| H1 | tag `h1` global **ca atare** (3.375rem, lh 1.1). Designul are lh 1.0, dar e un singur rând, deci diferența nu se vede |
| Paragraf | `p` global **ca atare**. Max-width ~41rem: `max-width-large` (45rem) sau o clasă de coloană |
| Layout 2 coloane text/imagine | **nou**: `why-hero_component` (grid ~1.3fr / 1fr, gap 5rem, align center). Pattern-ul `about-hero_*` are alte proporții (560/640, aspect 64:45) și prefix de pagină. Alternativa e generalizarea lui într-un `hero-split_*` partajat, de decis la Stage 03 |
| Imagine | `why-hero_image-wrapper` (aspect-ratio **24/25**, overflow hidden) › `img.image-cover`, **nou** |
| Grila de feature-uri | **nou**: `why-hero_feature-list` (grid 2 col, column-gap 2rem, row-gap 3rem) › `why-hero_feature-item` › `why-hero_feature-icon` (1.875rem, SVG inline `currentColor`) + `h3.heading-style-h4` (**refolosit**: 1.25rem = 20px; lh 1.3 vs 1.2 în design, acceptabil) + `p.text-size-tiny` (**refolosit**: 0.75rem; lh 1.5 = 18px ✓) |
| CTA | `button is-icon` + `button_icon` (**refolosit**: `button` de bază e deja navy plin). Plasare: `why-hero_cta-wrapper` cu poziție manuală în grid (col 1 / rând 2) pe desktop. **Ordinea DOM: f1, f2, f3, CTA**, ca pe mobil butonul să vină după feature-uri |
| Spațiu paragraf → grilă | `spacer-large` (3rem, Relume; de verificat valoarea) ≈ 54–57 px |

### 2. „Two ways to fly”: `264:6223` + `264:6242`

Sunt **două frame-uri de secțiune** (693 și 430 px), dar vizual formează **o singură secțiune**: al doilea are padding-top 0 și continuă direct.

**Header** `264:6225` (720 px), la x=79.7, y=80.45 în secțiune:
- Eyebrow `TWO WAYS TO FLY` (`264:6228`) → spacer-20 → H2 (`264:6230`, 2 rânduri, 86 px înălțime): `Explore our different` / *`ways of flying`* (rândul 2 italic, ca la About).
- Header → grilă: **56 px** (grila e la y=175).

**Rândul 1** `264:6231` (1280 × 350): card text **stânga** + imagine **dreapta**, **fără gap**.
- Card `264:6232` „_w-fly_card”: **624 × 350**, border 1px ≈ `#E1E5E8` (culoare eșantionată; radius necunoscut, probabil 2px). Padding **48 px** pe toate laturile (conținutul e poziționat absolut la 48/48, butonul se termină la 302 → 48 jos).
  - Titlu `264:6233` (257×69, 2 rânduri): `On-demand private` / *`jet charter`* (rândul 2 italic). Vanitas, **≈ 32 px / lh ≈ 1.08** (estimat).
  - gap 24
  - Text `264:6234` (528 px lățime, 3 rânduri, 87 px → **lh ≈ 29 px**, font ≈ 16 px): `Gain access to over 4,800 aircraft through 500 operators across the globe — without the constraints of long-term contracts or unnecessary costs.`
  - gap 24
  - Buton outline `264:6236` „lj-button--outline-on-light”, **196 × 50**: `DISCOVER MORE` + săgeată 14×14 (identic cu About).
- Imagine `264:6241` „DSC00087 1”: **622.8 × 350** (raport **1.78 ≈ 16:9**), dreapta. Suma e 1246.8, deci **33 px mai puțin decât 1280**. Referința arată un **bărbat în costum închis vorbind la telefon, în fața unui avion privat alb, pe pistă**.

**Rândul 2** `264:6244` (1280 × 350; secțiunea `264:6242` are padding-top 0, bottom 80):
- Imagine `264:6254` „IMG_0884 1”: **656 × 350** (raport **1.87**), **stânga**. Referința arată o **ședință în biroul LunaJets din Dubai** (logo „LUNAJETS DUBAI” pe perete, 4 persoane la o masă de conferință).
- Card `264:6245`: 624 × 350, la x=655.7. Grila ocupă 1280 aici, față de 1246.8 la rândul 1.
  - Titlu `264:6246`: `The deposit` / *`account`*
  - Text `264:6247` (2 rânduri, 58 px): `Starts with a refundable minimum deposit of €100,000 to enjoy a streamlined booking experience, earn loyalty credits, and more.`
  - Buton outline `DISCOVER MORE` → (`264:6249`), la y=223. **Nu** e împins jos, deci rămân ~77 px goi sub buton.
- Distanța între rânduri: **88 px** (padding-bottom 88 al primei secțiuni).

**Reutilizare:**

| Element | Decizie |
|---|---|
| Header de secțiune | pattern-ul **Section header** (`max-width-large` › tagline › `spacer-custom1` › `h2` cu `<em>`) **ca atare** |
| Header → grilă 56 px | normalizează la `spacer-xlarge` (4rem, ca la About) sau `spacer-large` (3rem) |
| Card + imagine alăturate | **nou, partajat** (4 apariții: aici × 2 + Pricing × 2): `card-split_component` (grid 1fr 1fr, gap 0, align stretch) › `card-split_content` (flex column, padding 3rem, border 1px `Border Color/primary`, radius small) + `card-split_image-wrapper` (relative, overflow hidden, min-height ~21.875rem) › `img.image-cover`. Inversarea se face prin ordinea DOM, ca la `split_component` |
| De ce nu `split_component` + combo | `split_component` are gap 4rem, aspect 5/4 pe imagine și text fără chenar. Ar trebui suprascrise 3 clase (părinte + 2 copii), deci combo-uri pe copii. Clasa nouă e mai curată |
| Titlu card | **nou** `card-split_title` (pe `h3`): Vanitas ≈ 2rem, lh 1.1, `<em>` pe rândul 2. Nicio treaptă existentă nu are 32 px (H2 = 40, H3 = 24) |
| Text card | `p` global (16/24). Designul are lh ≈ 29 px (≈1.8): de confirmat. Dacă e intenționat, **nou** `card-split_text` (lh 1.8) |
| Buton | Button Arrow outline: `button is-secondary is-icon` + `button_icon` **ca atare**. Cu 4 × „Discover more”, `button_sr-text` e **obligatoriu** (ex. „Discover more<span class="button_sr-text"> about private jet charter</span>”) |
| Butonul jos în card | `card-split_button-wrapper` cu `margin-top: auto` (aliniază fly și pricing la fel) |

### 3. Avantaje: `264:6255` „_w-fly_advantages_section” (1440 × 651, fundal închis)

- **Fundal:** navy + gradient, **vizual identic cu Services din About**. Colțurile eșantionate: stânga-sus ≈ `#010E1C`, centru `#061D38`, dreapta-jos ≈ `#092340` (gradientul About: `rgba(2,12,24,.85)` → transparent → `rgba(12,40,71,.6)`).
- **Padding:** sus **112.45**, jos ~111.5 (≈ 7rem). Containerul `264:6256` are **1200 px** (x=119.7), **nu 1280**.
- **Header** `264:6257` (720): eyebrow alb `WHAT YOU GET` → spacer-20 → H2 alb `The advantages of` / *`flying through us`*. Header → carduri: **56 px**.
- **Carduri** `264:6263` (1200 × 252): **3 coloane × 2 rânduri**, carduri **389.33 × 118.11**, gap **16 px** pe ambele axe. Card „Background+Border”: fundal navy, border ≈ alb 24%, icon **30×30** centrat la y=28.5, text 1 rând (19 px înălțime ≈ Gilroy 14 / 18.9, ca la About) la y=70.5, centrat.

| Vizual (rând, col) | Nod | Icon | Text |
|---|---|---|---|
| 1,1 | `264:6264` | stea | `Access to top operators fleet` |
| 1,2 | `264:6269` | telefon mobil | `App and loyalty program` |
| 1,3 | `264:6276` | ceas deșteptător cu unde, **46 × 38** (!) | `Empty legs & last-minute flights` |
| 2,1 | `264:6306` | grafic descendent | `Lower rates in the market` |
| 2,2 | `264:6290` | calendar cu „x” | `Most flexible cancellation terms` |
| 2,3 | `264:6298` | bilet / card „all incl.” | `All-inclusive rates` |

(Ordinea layerelor din Figma diferă de cea vizuală: `All-inclusive rates` și `Lower rates` sunt inversate în arbore. Pentru DOM contează **ordinea vizuală** de mai sus.)

**Reutilizare:**

| Element | Decizie |
|---|---|
| Secțiune închisă + gradient | Gradientul stă acum pe `section_about-services` (valoare brută one-off). Apărând a doua oară, **propun extragerea** într-o clasă partajată, ex. `background-gradient-dark` (sau combo pe secțiune). Altfel, se duplică valoarea pe `section_why-advantages` |
| Culoare text alb | ca în About (tagline și H2 moștenesc `currentColor` / `Text Color/alternate`) |
| Padding 112 | `padding-section-large` (Relume = 7rem; de verificat în Webflow) sau normalizare la `padding-section-medium` ca în About. **Recomand normalizarea**: e aceeași componentă vizuală |
| Container 1200 | normalizează la `container-large` (1280): cardurile devin ~416 px |
| Listă carduri | `ul.services_list` + `li.services_card` › `services_icon` + `h3.services_card-title` **ca atare** |
| 3 pe rând în loc de 5 | **combo** `services_card is-third`: width `calc((100% - 2rem)/3)`. Lățimea stă pe card, deci combo-ul trebuie pus pe card, nu pe listă |
| Icon 30 px / 46×38 | normalizează la `services_icon` 1.75rem cu `viewBox` normalizat (cum s-a făcut cu iconul P/H) |

### 4. „Tailored for every need”: `264:6313` (1440 × 797)

> ⚠️ Blocul cu carduri e **lipit dintr-un alt fișier și scalat ×1.0588**, ca „As featured in” din About: lățime **1355.29**, x=42.07, carduri **313.41**, gap **33.88**. Normalizat: **4 × 296 px, gap 32**, adică exact grila `stats_list` din About.

- Header `264:6315` (x=79.7, y=85.16): eyebrow `WAYS TO FLY` (`264:6318`) → spacer-20 → H2 (`264:6319`) `Tailored for` / *`every need`* → spacer-24 (în afara bounding box-ului header-ului). Header → carduri: **56 px** de la H2.
- Carduri `264:6322` (4 coloane, **fără chenar, fără link**, text centrat):
  - Imagine **313.4 × 317.6** (normalizat **296 × 300**, raport **0.987 ≈ 1:1**), sus.
  - gap ~25 (≈ 24 normalizat)
  - Titlu (26 px înălțime → normalizat **Vanitas ≈ 20/24**, ca titlurile de feature din Hero), centrat.
  - gap ~16
  - Text (rânduri de 23.8 px → normalizat **Gilroy 15 / 22.5**, ca `group_card-text`), centrat.
- Padding: sus 85, jos **~33** (cardurile se termină la 764, secțiunea la 797). Spațiul vizual până la secțiunea următoare vine din padding-top-ul acesteia (80).

| Col | Imagine (nod, nume layer) | Ce arată referința | Titlu | Text |
|---|---|---|---|---|
| 1 | `264:6324` „AdobeStock_628304018_Preview 1” (în `264:6323` Background+Border) | câine (setter roșcat) întins pe un fotoliu crem de avion privat | `Pet-friendly travels` | `We know how important it is to bring your loved ones with you. We offer the most personalised, pet-friendly private flights.` |
| 2 | `264:6344` „image 37” | lounge / terminal FBO modern: canapele, ferestre mari, avion privat afară | `Last-minute flights` | `For those who need to travel at short notice, whether you are facing a business emergency, planning a last-minute getaway, or require an urgent evacuation.` |
| 3 | `264:6326` „image 7” (în `264:6325` Background+Border) | elicopter roșu pe cer albastru (ambulanță aeriană) | `Medical & air ambulance` | `We coordinate emergency flights, including bed-to-bed transportation, repatriations, and the urgent delivery of vital supplies.` |
| 4 | `264:6327` „ChatGPT Image 15 sept 2026, 16_48_33 1” | husă de chitară pe un fotoliu crem, lângă hublou | `Music & entertainment` | `From summer festivals to global tours, our private aviation experts are handling tour charters for major recording artists. Always assuring absolute discretion and confidentiality.` |

În captura de design, cardurile 1 și 3 au un placeholder gri `#EEF1F4` cu chenar (frame „Background+Border”). Cardurile 2 și 4 sunt dreptunghiuri goale, fără chenar.

**Reutilizare:**

| Element | Decizie |
|---|---|
| Header | pattern Section header **ca atare** |
| Listă 4 coloane | **nou** `ul.tailored_list` (grid 4 col, gap 2rem, `role=list`) › `li.tailored_card` (flex column, align center, text-align center) |
| Imagine | `tailored_card-image-wrapper` (aspect 1/1, overflow hidden, radius small?) › `img.image-cover`, **nou** |
| Titlu | `h3.heading-style-h4` (**refolosit**, 1.25rem). Alternativ, `tailored_card-title` dacă vrem lh 1.2 |
| Text | **nou** `tailored_card-text` (0.9375rem / 1.5). Aceleași valori ca `group_card-text`, dar Client-First nu recomandă folosirea claselor unei componente în alta. Alternativă: utilitar `text-size-small` (0.875rem), cu o mică pierdere de fidelitate |
| Spacing | normalizează la `padding-section-medium` (80/80) |

### 5. Pricing + Payment: `264:6345` „_w-fly_section” (1440 × 1289)

Două blocuri `container-medium` (1280 × 533) în aceeași secțiune, ca două variante ale aceluiași pattern „card + imagine” (§2), **cu înălțimea 384**.

**Blocul A: Pricing** `264:6346` (x=80, y=80.45)
- Header `264:6347` (720, **aliniat stânga**): eyebrow `PRICING PROMISE` → spacer-20 → H2 `Transparency at` / *`the best price`*. Header → grilă: 56.
- Grila `264:6353`:
  - Card `264:6354`, **624 × 384**, stânga. Conținutul e un **grup poziționat absolut** (`Group 5872/5874`) la **66.6 / 45.6** (nu 48, ca la fly). Fără titlu în card.
    - Text `264:6357` (475.6 px lățime, 3 rânduri): `Our quotes are transparent, with no upfront costs or hidden fees. Everything is included, from landing fees and taxi charges to fuel surcharges.`
    - Buton outline `DISCOVER MORE` → (`264:6359`, 196 × 50) **jos în card** (y=288, deci ~45 px padding jos). Textul stă sus, butonul jos.
  - Imagine `264:6364` „AdobeStock_438748456 1”: **624 × 384** (raport **1.625 = 13:8**), dreapta. Referința arată o **fotografie alb-negru cu un avion privat într-un hangar**, sub aripa/motorul unui avion mare, cu ferestrele hangarului în spate.
  - Suma: 1248 (≠ 1280).

**Blocul B: Payment** `264:6365` (y=669.45, adică **doar ~30 px** sub marginea reală a cardului A)
- Header `264:6366` (344 px, **aliniat DREAPTA**, la x=904 → marginea dreaptă 1248):
  - Eyebrow **în oglindă**: text `PAYMENT OPTIONS` **apoi** linia de 24 px în dreapta (`264:6370` la x=320).
  - H2 `264:6372`: `Seamless payment` / *`incl. cryptocurrencies`*, aliniat dreapta.
- Grila `264:6373`:
  - Imagine `264:6374` „image 38”: **624 × 384**, **stânga**. Referința arată o **persoană care arată cu degetul spre grafice de trading pe două monitoare** (context crypto/finanțe).
  - **Chip-uri crypto** `264:6385` „_w-crypto_chips”, suprapuse pe imagine lângă marginea dreaptă (x ≈ 567–599, y ≈ 49–335 în grilă; grupul e rotit cu 90°): 4 pastile verticale cu textul rotit, **32 px lățime** × 59 / 58 / 68 / 71, gap **10 px**, border subțire alb, fundal transparent, text alb ≈ 11–12 px:
    `BTC` (`264:6386`), `ETH` (`264:6388`), `USDT` (`264:6390`), `USDC` (`264:6392`).
  - Card `264:6375`, 624 × 384, dreapta, conținut la 66.6 / 45.6, **text aliniat dreapta**, buton aliniat dreapta jos:
    - Text `264:6378` (490.75 px, 6 rânduri): `At LunaJets, we make payment effortless and flexible to accommodate all of our clients, especially in urgent situations. You can settle your flights online or offline using all major credit and debit cards, as well as bank transfers. We also accept cryptocurrency for all our services, whether you are chartering a private jet or helicopter, funding a deposit account, or purchasing an aircraft through LunaSolutions.`
    - Buton outline `DISCOVER MORE` → (`264:6380`).
- Padding jos secțiune: ~86.5.

> ⚠️ **Tăiere:** ambele `container-medium` au 533 px, dar conținutul are 175 + 384 = **559 px**. Ultimii **26 px ai cardurilor sunt tăiați**: în captură și în referință, **bordura de jos a cardurilor lipsește**.

**Reutilizare:**

| Element | Decizie |
|---|---|
| Header A | pattern Section header **ca atare** |
| Header B aliniat dreapta | Section header + `text-align-right` (utilitar existent) pe un wrapper flex cu `align-items: flex-end`. **Nou** combo `tagline_component is-reverse` (`flex-direction: row-reverse`) pentru eyebrow-ul în oglindă |
| Card + imagine | `card-split_*` (§2) **refolosit**. Combo `card-split_content is-right` (text-align right, align-items flex-end) pentru blocul B. Butonul jos prin `card-split_button-wrapper` (margin-top auto) |
| Padding card 66/46 vs 48 | normalizează la 3rem, ca la fly |
| Chip-uri | **nou**: `ul.card-split_chip-list` (absolute, right ~1.5rem, top/bottom centrat, flex column, gap 0.625rem, `aria-label="Accepted cryptocurrencies"`) › `li.card-split_chip` (border 1px `Border Color/on dark` sau alb, radius 100vw, `writing-mode: vertical-rl` + `rotate(180deg)`, padding 0.5rem 0.25rem, `text-size-tiny`, alb). Nu e decorativ: textul trebuie să rămână citibil de cititoarele de ecran |
| Distanța A → B (~30 px) | prea mică. Propun **2 secțiuni separate** (`section_why-pricing`, `section_why-payment`) sau `spacer-xxlarge` între blocuri |

### 6. Footer: `264:6394`

- Instanța `Footer Container`, identică cu About. **Reutilizare:** componenta Webflow **Footer** **ca atare**.
- Frame-ul are 5277 px, dar footer-ul se termină la 4614 + 681 = **5295**, deci **ultimii 18 px (textul legal) sunt tăiați** în frame. Nu contează la build, footer-ul e componentă.

---

## 3. Sloturi de imagine (rezumat)

> Doar **placeholder-e**, fără upload de imagini (ca la About). Toate: wrapper cu `aspect-ratio`, `overflow: hidden`, `img.image-cover`.

| # | Secțiune | Nod | Layer | Desktop | Raport propus | Poziție | Fotografia din referință | Rol / alt |
|---|---|---|---|---|---|---|---|---|
| 1 | Hero | `264:6216` | section_deposit-hero (frame gol) | 504 × 524 | **24 / 25** | dreapta | avion privat alb-negru, văzut de dedesubt/din spate | vizual hero, LCP, eager |
| 2 | Ways / charter | `264:6241` | DSC00087 1 | 622.8 × 350 | ~16/9 (în card-split: umple înălțimea cardului) | dreapta | om de afaceri la telefon în fața unui jet pe pistă | ilustrativ, alt descriptiv |
| 3 | Ways / deposit | `264:6254` | IMG_0884 1 | 656 × 350 | idem | stânga | ședință în biroul LunaJets Dubai | ilustrativ |
| 4 | Tailored / pet | `264:6324` | AdobeStock_628304018_Preview 1 | 313 × 318 (296 × 300 norm.) | **1 / 1** | card 1 | câine pe fotoliu de jet | ilustrativ |
| 5 | Tailored / last-minute | `264:6344` | image 37 | idem | 1 / 1 | card 2 | lounge FBO cu jet afară | ilustrativ |
| 6 | Tailored / medical | `264:6326` | image 7 | idem | 1 / 1 | card 3 | elicopter roșu pe cer | ilustrativ |
| 7 | Tailored / music | `264:6327` | ChatGPT Image 15 sept 2026… | idem | 1 / 1 | card 4 | husă de chitară pe fotoliu de jet | ilustrativ |
| 8 | Pricing | `264:6364` | AdobeStock_438748456 1 | 624 × 384 | 13 / 8 | dreapta | jet alb-negru în hangar | ilustrativ |
| 9 | Payment | `264:6374` | image 38 | 624 × 384 | 13 / 8 | stânga, cu chip-uri crypto peste | grafice de trading pe monitoare | ilustrativ |

**Asset-uri vectoriale:** 3 iconuri Hero (30 px), 6 iconuri Avantaje (30 px; unul 46×38), săgeata butoanelor (14 px, deja în `button_icon`). Iconurile nu au putut fi descărcate (URL-uri figma.com blocate; design context doar pentru Hero). **Sursa recomandată:** site-ul vechi, ca la iconurile Services din About.

---

## 4. Tokenuri: ce e nou față de sistemul About

**Culori:** **nimic nou.** Paleta e aceeași: navy `#061D38`, alb, border `#E1E5E8`, alb 24% pe fundal închis și gradientul Services. `#EEF1F4` apare doar ca placeholder de imagine și nu trebuie creat.

**Tipografie:**

| Valoare | Unde | Mapare propusă |
|---|---|---|
| Vanitas 20 / 24, ls 0 | titluri feature Hero, titluri Tailored | `heading-style-h4` existent (1.25rem, lh 1.3). Nu e token nou |
| Gilroy 12 / 18, ls 0.4px | descrieri feature Hero | `text-size-tiny` (0.75rem) + lh body 1.5. Nu e token nou |
| Vanitas **≈ 32px** / ≈1.08 (2 rânduri, al 2-lea italic) | titluri card-split | **NOU**: `card-split_title` 2rem (767: 1.5rem). Între H3 (24) și H2 (40) |
| Paragraf 16px cu **lh ≈ 29px (≈1.8)** | text card-split (fly, pricing, payment) | **NOU / de confirmat**: fie normalizat la 1.5, fie `card-split_text` lh 1.8 |
| Buton ls **3px (0.25em)** | CTA Hero (`letter spacing/3`) | abatere față de 0.1em din `button`. **Recomand normalizarea** (fără combo) |
| H1 lh 1.0, fără ls | Hero | ignorat (1 rând). Rămâne tag-ul global |
| Gilroy 15 / 22.5 (scalat 15.88 / 23.82) | text Tailored | ca `group_card-text`, dar în clasa nouă `tailored_card-text` |

**Spațiere:**

| Valoare | Unde | Propunere |
|---|---|---|
| **56 px** | header → conținut (Ways, Avantaje, Tailored, Pricing) | nu e în scală. Normalizează la `spacer-xlarge` (64, ca la About) |
| 48 px | padding card-split (fly) | 3rem în `card-split_content` |
| 66.6 / 45.6 | padding card pricing/payment | normalizează la 3rem |
| 88 px | între rândurile Ways | `spacer-xxlarge` (5rem) sau o singură grilă cu gap |
| **112 px** | padding vertical Avantaje | `padding-section-large` (Relume 7rem) sau normalizare la medium |
| 54–57 px | paragraf Hero → grila de feature-uri | `spacer-large` (3rem) |
| 32 px | gap coloane feature-uri / carduri Tailored | 2rem în clasa custom |
| 16 px | gap carduri Avantaje | 1rem (deja în `services_list`) |

**Radius:** `corner radius/2` (2px) pe CTA-ul Hero = `Radius/Small`. Nu e nou.

**Variabile Figma văzute în Hero:** `font family/Font 2` (Gilroy), `font family/Font 3` (Vanitas), `font size/20`, `font size/12`, `line height/24`, `line height/18`, `letter spacing/0_4`, `letter spacing/3`, `corner radius/2`, `item spacing/12` (folosit ca font-size), `Surface/card-white`. **Stiluri text:** `Vanitas/Bold` (20/24), `Gilroy/Regular` (12/18/0.4), `Semantic/Link upper` (12, **ls 3px** aici, față de 1.2px în About).

---

## 5. Propunere de structură Client-First (clase)

```
main.main-wrapper
├─ section.section_why-hero > padding-global > container-large > padding-section-medium
│  └─ div.why-hero_component                       [NOU] grid ~1.3fr 1fr, gap 5rem, align center
│     ├─ div.why-hero_content
│     │  ├─ tagline_component › tagline_line + tagline_text        [refolosit]
│     │  ├─ spacer-small (24)                                       [refolosit]
│     │  ├─ h1 "Why LunaJets?"
│     │  ├─ spacer-small
│     │  ├─ p (max-width-large)
│     │  ├─ spacer-large
│     │  └─ div.why-hero_feature-list               [NOU] grid 2 col, gap 3rem 2rem
│     │     ├─ div.why-hero_feature-item × 3       [NOU] › div.why-hero_feature-icon [NOU] + h3.heading-style-h4 + p.text-size-tiny
│     │     └─ div.why-hero_cta-wrapper            [NOU] grid col 1 / row 2 (desktop) › a.button.is-icon › text + button_icon
│     └─ div.why-hero_image-wrapper > img.image-cover   [NOU] aspect 24/25
│
├─ section.section_why-ways > … padding-section-medium
│  ├─ [Section header] max-width-large › tagline › spacer-custom1 › h2 (<em>)
│  ├─ spacer-xlarge
│  ├─ div.card-split_component                      [NOU, partajat]
│  │  ├─ div.card-split_content                     [NOU] › h3.card-split_title [NOU] › spacer-small › p › spacer-small › div.card-split_button-wrapper [NOU] › Button Arrow outline
│  │  └─ div.card-split_image-wrapper > img.image-cover   [NOU]
│  ├─ spacer-xxlarge
│  └─ div.card-split_component  (imaginea prima în DOM)
│
├─ section.section_why-advantages (+ background-gradient-dark [NOU/extras]) > … padding-section-medium (sau large)
│  ├─ [Section header, alb]
│  ├─ spacer-xlarge
│  └─ ul.services_list › li.services_card.is-third [COMBO NOU] × 6 › services_icon + h3.services_card-title
│
├─ section.section_why-tailored > … padding-section-medium
│  ├─ [Section header]
│  ├─ spacer-xlarge
│  └─ ul.tailored_list [NOU] › li.tailored_card [NOU] × 4
│        ├─ div.tailored_card-image-wrapper > img.image-cover [NOU]
│        ├─ h3.heading-style-h4
│        └─ p.tailored_card-text [NOU]
│
├─ section.section_why-pricing > … padding-section-medium
│  ├─ [Section header]
│  ├─ spacer-xlarge
│  └─ div.card-split_component › card-split_content (fără titlu) + card-split_image-wrapper
│
└─ section.section_why-payment > … padding-section-medium
   ├─ div.why-payment_header [NOU] (flex column, align-items flex-end, text-align-right)
   │  └─ tagline_component.is-reverse [COMBO NOU] › spacer-custom1 › h2 (<em>)
   ├─ spacer-xlarge
   └─ div.card-split_component
      ├─ div.card-split_image-wrapper › img.image-cover + ul.card-split_chip-list [NOU] › li.card-split_chip × 4
      └─ div.card-split_content.is-right [COMBO NOU]
```

**Rezumat refolosire:**

| Categorie | Clase / pattern-uri |
|---|---|
| **Ca atare** | Navbar, Footer, Global Styles, `page-wrapper`/`main-wrapper`, `padding-global`, `container-large`, `padding-section-medium`, `tagline_*`, pattern Section header, `h1`/`h2` + `<em>`, `heading-style-h4`, `text-size-tiny`, `text-align-right`, `max-width-large`, `button` / `is-secondary` / `is-icon` / `button_icon` / `button_sr-text`, `services_list` / `services_card` / `services_icon` / `services_card-title`, `image-cover`, scala spacer (`spacer-small`, `custom1`, `large`, `xlarge`, `xxlarge`) |
| **Variantă (combo)** | `services_card is-third`, `tagline_component is-reverse`, `card-split_content is-right`. Gradientul Services mutat într-o clasă partajată (`background-gradient-dark`) sau duplicat |
| **Nou** | `why-hero_*` (component, content, feature-list, feature-item, feature-icon, cta-wrapper, image-wrapper), `card-split_*` (component, content, title, button-wrapper, image-wrapper, chip-list, chip), `tailored_*` (list, card, card-image-wrapper, card-text), `why-payment_header` |

**Responsive (propunere, lipsește din design):**
- ≤991: Hero pe o coloană, **textul primul și imaginea sub el** (ca About). Feature-urile rămân 2 coloane, CTA-ul iese din grilă (ordinea DOM). `card-split` pe o coloană, **imaginea deasupra** (`order: -1` pe `card-split_image-wrapper`), cu aspect fix 16/9 când nu mai e alături de card. `services_card is-third` → 2 coloane. `tailored_list` → 2 × 2.
- ≤767: feature-urile Hero și `tailored_list` pe 1 coloană (Tailored max ~28rem, centrat); avantajele pe 2 coloane (ca Services); header-ul Payment revine la stânga (`text-align-left`, tagline normal). Chip-urile crypto devin un rând orizontal sub imagine sau rămân pe imagine, mai mici.
- ≤479: avantajele pe o coloană sau 2 coloane înguste (etichetele au ~200 px, deci probabil 1 coloană).

---

## 6. Inconsecvențe și ambiguități

1. **Doar Desktop.** Nu există Tablet sau Mobile pentru Why LunaJets (`CHART MOBILE` e pentru Private Jet Charter).
2. **Sloturile foto sunt goale** în design. Fotografiile apar doar în referința `264:7690`. Slotul Hero nu are nici măcar un layer de imagine (frame gol numit `section_deposit-hero`, cu spacere și un layer ascuns `_w-why-grid-icon`).
3. **Nume de layere copiate:** Hero-ul se numește `section_about_hero`, slotul imaginii `section_deposit-hero`, secțiunea Tailored `Container`. Prefixele `_w-…` (`_w-fly_section`, `_w-why_header`, `_w-crypto_chips`) par clase ale site-ului vechi. **Nu le folosi ca nume de clase.**
4. **Hero poziționat absolut**, fără container. Imaginea se termină la 1327 (nu la 1360). Feature-urile sunt nealiniate (y 324.28 vs 321). Al treilea feature stă într-un wrapper de 1000 px. Spacerele (40 / 72 / 40) nu corespund niciunui element.
5. **Eyebrow Gilroy Regular** în Hero (design context), față de Bold în auditul About. Păstrăm `tagline_text` existent. De verificat cu designerul.
6. **H1 fără parte italică și cu lh 1.0**, diferit de About („About / *LunaJets*”, lh 1.1). E posibil să fie intenționat, fiind un singur rând.
7. **CTA-ul Hero** are ls 3px (`Semantic/Link upper` cu `letter spacing/3`) și înălțime 47. Butoanele outline au ls 1.2px și 50 px, iar în About același stil text are 1.2px. **Stilul text a fost modificat sau suprascris.**
8. **Lățimi de conținut diferite:** 1246.8 (Ways rândul 1), 1280 (Ways rândul 2), **1200** (Avantaje, container mutat la x=119.7), **1355.29** (Tailored, scalat ×1.0588), 1248 (Pricing/Payment). Totul trebuie normalizat la `container-large` (1280).
9. **Blocul Tailored e lipit și scalat ×1.0588** (lățimi, gap-uri și fonturi fracționare), ca „As featured in” din About.
10. **Carduri tăiate:** în Pricing și Payment, `container-medium` are 533 px pentru 559 px de conținut, deci **bordura de jos a cardurilor lipsește** (și în referință).
11. **Footer tăiat** cu 18 px de marginea frame-ului (5277 vs 5295).
12. **Padding-uri neuniforme:** Hero 80/73, Ways 80/88 + 0/80, Avantaje **112**/112, Tailored 85/**33**, Pricing 80/86.5. About folosea 80 peste tot.
13. **Header → conținut = 56 px** pe toată pagina, față de **64 px** în About.
14. **Distanța Pricing → Payment ≈ 30 px** (card → eyebrow), prea mică vizual.
15. **Padding-ul cardurilor diferă:** 48 px (Ways) vs 66.6 / 45.6 (Pricing/Payment, conținut într-un grup absolut). Butonul e jos în Pricing, dar imediat după text în Ways (rândul 2 lasă ~77 px goi).
16. **Carduri Tailored neuniforme:** 1 și 3 au frame „Background+Border” cu placeholder gri și chenar, 2 și 4 sunt imagini simple. Probabil fără chenar în intenție (referința nu arată chenare).
17. **Icon Avantaje 46×38** (Empty legs) față de 30×30 la celelalte, deci eticheta e decalată cu 2 px. Avantajele au icon de 30 px, Services din About 28 px.
18. **Ordinea layerelor ≠ ordinea vizuală** la Avantaje (`All-inclusive rates` / `Lower rates in the market`) și la feature-urile Hero.
19. **Conținut de confirmat:**
    - eyebrow-ul `WAYS TO FLY` (Tailored) aproape dublează `TWO WAYS TO FLY`, deși secțiunea e despre cazuri de utilizare;
    - `4,800 aircraft through 500 operators` (aici) vs `4,800+ aircraft in our network` (About): consistent, dar de verificat;
    - `€100,000` minimum deposit.
20. **Licențe imagini:** `AdobeStock_628304018_**Preview**` e o imagine Adobe Stock de previzualizare (cu watermark sau nelicențiată). `ChatGPT Image 15 sept 2026…` e **generată cu AI**. De confirmat cu clientul înainte de producție.
21. **Chip-uri crypto:** grup rotit cu 90°, cu bounding box înșelător în metadata (y 335 + 286 > 384). Poziția exactă și stilul (border, font) sunt estimate din referință.
22. **Nicio stare desenată** (hover/focus) pentru carduri, butoane și chip-uri. Nicio stare activă a linkului `WHY LUNAJETS` în navbar.

---

## Anexă: ce nu a putut fi accesat

- **Limita MCP Figma (plan Starter)** a fost atinsă după 4 apeluri (`get_metadata` pagină, `get_screenshot` frame, `get_design_context` Hero și încărcarea skill-ului). `get_design_context` pentru secțiunile 2–6, `get_variable_defs` și capturile per nod **nu au putut fi rulate**. Capturile per secțiune sunt decupaje locale din captura completă și din referință.
- Valorile tipografice exacte pentru secțiunile 2–6 (mărimi titluri card, line-height text card, stilul chip-urilor, radius carduri) sunt **estimate** (≈) și trebuie confirmate în Figma Dev Mode când limita se resetează.
- SVG-urile iconurilor (Hero, Avantaje) nu au fost descărcate: URL-urile figma.com sunt blocate de proxy, iar pentru Avantaje nu există design context.
- Imaginea de referință la rezoluție mare provine din randarea făcută de tool în sesiunea About (fișierul de rezultat al tool-ului, 4296×5000), nu dintr-un apel nou.
