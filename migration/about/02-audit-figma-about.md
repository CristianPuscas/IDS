# 02 — Audit Figma: pagina „About” (LunaJets)

- **Fișier Figma:** `Cristi (Copy) (Copy)` — fileKey `kLdwkY54wIiha02RhcMP36`
- **Pagina Figma:** `LJ` (id `264:5234`) — singura pagină din document
- **Tip audit:** READ-ONLY (nimic scris în Figma sau Webflow)
- **Țintă:** reconstrucție în Webflow cu Finsweet Client-First v2
- **Data:** 2026-09-29
- **Capturi salvate:** `/home/user/IDS/migration/about/figma-screenshots/`

| Fișier | Conținut |
|---|---|
| `about-desktop-full_264-5854.png` | Frame-ul About complet (558×2400, redus din 1440×6202) |
| `01-navbar_264-5855.png` … `08-footer_264-6143.png` | Câte o captură per secțiune (din `get_design_context`) |
| `reference-image-41_264-7690.png` | Imaginea de referință completă (3 pagini, 1375×1600) |
| `reference-image-41_about-column.png` | Decupaj la rezoluție mare doar pe coloana „About” din imaginea de referință (1115×4740) |

> Notă tehnică: descărcarea prin `curl` de pe `www.figma.com` a fost blocată de proxy (403, politică de organizație). Capturile au fost obținute prin răspunsul base64 al tool-ului și copiate local — conținutul este identic.

---

## 1. Frame-uri găsite

Pe canvas-ul `LJ` există următoarele noduri de nivel superior:

| Nod | Nume | Poziție (x, y) | Dimensiune | Relevanță |
|---|---|---|---|---|
| `264:5854` | **About — LunaJets** | 350, -225 | **1440 × 6201.79** | **Desktop About — în scop** |
| `264:6144` | Why LunaJets — LunaJets | 2215.5, 114 | 1440 × 5277 | în afara scopului |
| `264:6395` | Private Jet Charter — LunaJets | 3951, 0 | 1440 × 5356 | în afara scopului |
| `264:6774` | CHART MOBILE | 5591, 1206 | 393 × 1118 | în afara scopului (tabel comparativ mobil pentru Private Jet Charter) |
| `264:7690` | **image 41** | 6409, -94 | 5216 × 6071 | **Imaginea de referință** cu fotografiile plasate (vezi §6) |
| `264:7693` | text `https://www.lunajets.com/en/about-us` | 573, -419 | — | URL-ul live al paginii, deasupra frame-ului About |
| `264:7694` / `264:7695` | URL-uri Why LunaJets / Private Jet Charter | — | — | în afara scopului |

**Breakpoint-uri:**

| Breakpoint | Stare |
|---|---|
| Desktop 1440 | ✅ `264:5854` |
| Tablet (991 / 768) | ❌ **LIPSEȘTE** |
| Mobile landscape (767) | ❌ **LIPSEȘTE** |
| Mobile portrait (479 / 393 / 375) | ❌ **LIPSEȘTE** (singurul frame mobil, `CHART MOBILE`, aparține altei pagini) |

→ Comportamentul responsive trebuie definit de noi (propunere în §7.6).

**Ordinea verticală în frame-ul About (y în frame):**

| # | Secțiune | Nod | y start | Înălțime |
|---|---|---|---|---|
| 0 | Top-navbar | `264:5855` | 0 | 76 |
| 1 | section_about_hero | `264:5882` | 76 | 610 |
| 2 | section_metrics (+ 3 blocuri split) | `264:5899` | 686 | 2146 |
| 3 | section_services | `264:5965` | 2832 | 461.11 |
| 4 | section_group | `264:6019` | 3293.11 | 888.5 |
| 5 | section_standards | `264:6057` | 4181.61 | 600 |
| 6 | AS FEATURED IN — white | `264:6078` | 4781.61 | 739.18 |
| 7 | Footer Container (instance) | `264:6143` | 5520.79 | 681 |

---

## 2. Secțiuni — detaliu (Desktop 1440)

> Toate secțiunile de conținut (1–5) folosesc aceeași schemă: `section` cu padding orizontal **40px** și vertical **80px**, conținut într-un frame numit `container-medium` cu lățimea **1280px** (centrat → margini efective 80px la 1440). Spațierea verticală internă se face cu frame-uri goale `spacer-16/20/24/32/64` (compatibil 1:1 cu conceptul de spacer din Client-First).
>
> **Diferențe per breakpoint:** nu pot fi documentate — există doar Desktop.

### Element recurent: „Hero Label” (eyebrow)

Apare în secțiunile 1, 2, 3, 4, 5.
- Auto-layout orizontal, gap **10px**, align center.
- `Label Line`: dreptunghi **24 × 1px**, `#061D38` (alb `#FFFFFF` pe fundal închis).
- Text: **Gilroy Bold 11px**, line-height normal, letter-spacing **2.42px** (0.22em), UPPERCASE (scris cu majuscule în text), culoare `#061D38` / alb pe dark.
- Urmat de `spacer-20` (20px) până la titlu.

### Element recurent: Titlu H2 pe două rânduri (rândul 2 italic)

- Font **Vanitas Extrabold** (rândul 1) + **Vanitas Extrabold Italic** (rândul 2 sau ultimul cuvânt), `#061D38`.
- 40px / line-height 1.1 (44px); letter-spacing **1.65px** în header-ele de secțiune, **1.2px** în blocurile split, **1.0588px** în „As featured in”.
- În Figma, nodul-părinte are stil de bază `Cormorant Garamond Bold` (rămășiță), dar toate span-urile randate sunt Vanitas.

### Element recurent: Buton outline cu săgeată (`lj-button--outline-on-light`)

- Frame auto-layout orizontal, gap **10px**, padding **18px vertical / 32px orizontal**, înălțime rezultată **50px**.
- Border **1px solid `#061D38`**, radius **1px** (variabila `Radiuses/S`), fundal transparent.
- Text **Gilroy SemiBold 12px**, line-height normal, letter-spacing **1.2px**, UPPERCASE, `#061D38`.
- Icon `arrow` 14 × 14 (SVG) în dreapta.

---

### 0. Navbar — `264:5855` „Top-navbar” (detaliu și în §5)

- 1440 × 76, auto-layout orizontal, `justify: space-between`, align center, padding **16px vertical / 24px orizontal**.
- Fundal `#061D38` (`Surface/card-dark`), border 1px `rgba(255,255,255,0.24)` (`Border/primary-onDark`), radius 1px, `backdrop-filter: blur(16px)`.

### 1. Hero — `264:5882` „section_about_hero”

- **Fundal:** alb `#FFFFFF` (`Surface/card-white`).
- **Layout:** secțiune flex column, padding **80px / 40px**. `container-medium` (`264:5883`) 1280 × 450 → auto-layout **orizontal**, gap **80px**, align-items center.
  - Coloana text `about-hero__content` (`264:5884`): **560px** lățime, auto-layout vertical, fără gap (doar spacere).
  - Coloana imagine: `LJ-HQ_GVA 1` (`264:5898`) **640 × 450**.
- **Conținut (ordinea exactă):**
  1. Eyebrow: `OUR STORY`
  2. spacer-20
  3. **H1** (Vanitas Extrabold 54px / 1.1, letter-spacing 1.65px):
     - rândul 1: `About`
     - rândul 2 (italic): `LunaJets`
  4. spacer-24 + spacer-32 (= **56px** în total; între ele e un `divider-wrap` 60×1 **ascuns**)
  5. Paragraf (Gilroy Regular 16/24, letter-spacing 0.4px, `#061D38`):
     `Founded in December 2007, LunaJets was one of the first private jet brokers to offer an online booking experience. Since then, leveraging proprietary technology, LunaJets has become the European market leader in private jet charter services.`
  6. spacer-24
  7. Paragraf: `In 2025, the company has organised over 12,000 flights and surpassed €180m in revenue, making it one of the fastest-growing companies in the industry.`
  8. spacer-32 (la final, fără nimic după)
- **Butoane:** niciunul.
- **Slot imagine:** 640 × 450 (raport **1.422 : 1**, ≈ 64:45), rol: fotografie hero — sediul LunaJets din Geneva; poziție: dreapta; fără radius; object-fit recomandat **cover**. În design fill-ul imaginii este gol (vezi §6).

### 2. Metrics + blocuri split — `264:5899` „section_metrics”

- **Fundal:** alb.
- **Padding:** **top 0**, bottom **80px**, lateral 40px (spațiul de sus vine din padding-bottom-ul hero).
- `container-medium` (`264:5900`) 1280 — auto-layout **vertical, gap 64px**. Conține 5 copii:

#### 2a. Header — `264:5901` „metrics-block__header” (720px)
- Eyebrow: `SINCE 2007`
- spacer-20
- H2: `A European leader` / *`since 2007`*
- spacer-24
- Paragraf (lățime fixă **544px**): `A market leader by every measure that matters — flight volume, revenue, and the breadth of clients we serve, year after year.`

#### 2b. Rând statistici — `264:5909` „stat-row”
- 1280 × 179, auto-layout **orizontal**, gap **32px**, padding vertical **40px**.
- Border **top + bottom 1px `rgba(6,29,56,0.5)`** (hardcodat, nu variabilă).
- 4 coloane `stat` egale (flex 1 → **296px** fiecare), fiecare vertical, gap **14px**:

| Nod | Număr (Vanitas Extrabold 52px / 1.05, ls 1px) | Sufix (Vanitas Extrabold 22px) | Etichetă (Gilroy Bold 12px, ls 2.64px, opacity 45%) |
|---|---|---|---|
| `264:5910` | `12,000` | `+` | `FLIGHTS ORGANISED IN 2024` |
| `264:5913` | `180` | `m€` | `2025 REVENUE` |
| `264:5916` | `10` | — | `OFFICES ACROSS EUROPE & MIDDLE EAST` (se rupe pe 2 rânduri) |
| `264:5919` | `4,800` | `+` | `AIRCRAFT IN OUR NETWORK` |

#### 2c. Split 1 — `264:5922` „location-split” (text stânga / imagine dreapta)
- 1280 × 480, auto-layout **orizontal**, gap **64px**, align center.
- Text `264:5923` (flex 1 → 616px):
  - H2 40px (ls 1.2px): `A global reach mixed with local ` + *`expertise`*
  - spacer-24
  - P: `Our offices are strategically located across Europe and the Middle East, with a spread going from Madrid to Dubai. Headquartered in Geneva, we are also present in Paris, London, Zurich and Riga.`
  - spacer-16
  - P: `This local presence reflects our commitment to always being close to our clients, offering unmatched regional expertise as well as cultural and linguistic proximity.`
  - spacer-32
  - Buton outline: `VIEW ALL LOCAL OFFICES` → (256 × 50)
- Imagine `264:5936` „[IMG] Aerial view of Lake Geneva”: **600 × 480** (5:4 = 1.25), **radius 2px**, dreapta.

#### 2d. Split 2 — `264:5937` (imagine stânga / text dreapta)
- Aceeași structură, ordinea inversată.
- Imagine `264:5938` „DSC03595_V1 (1) 1”: **600 × 480** (5:4), stânga, **fără radius**.
- Text `264:5939` (616px):
  - H2: `Backed by a deep industry ` + *`knowledge`*
  - spacer-24
  - P: `United by a passion for operational excellence and a strong focus on the client above all, LunaJets management team offers a comprehensive expertise in private aviation.`
  - spacer-16 + spacer-32 (= 48px — vezi §8)
  - Buton outline: `DISCOVER OUR MANAGEMENT` → (283 × 50)

#### 2e. Split 3 — `264:5951` (text stânga / imagine dreapta)
- Text `264:5952`:
  - H2: `A dedicated team committed to ` + *`excellence`*
  - spacer-24
  - P: `Our private aviation advisors are available 24/7 to support every aspect of your journey and match all your expectations wherever you are.`
  - spacer-16 + spacer-32 (= 48px)
  - Buton outline: `MEET OUR TEAM` → (193 × 50)
- Imagine `264:5964` „DSC06593 2”: **600 × 480** (5:4), dreapta, fără radius.

### 3. Services — `264:5965` „section_services” (secțiune închisă)

- **Fundal:** `#061D38` + gradient suprapus:
  `linear-gradient(162.24deg, rgba(2,12,24,0.85) 0%, rgba(6,29,56,0) 35.356%, rgba(12,40,71,0.6) 70.711%)`, peste `linear-gradient(90deg, #061D38, #061D38)`.
- **Padding:** 80px / 40px. `container-medium` 1280, auto-layout vertical (fără gap, cu spacer-64).
- **Header** `264:5967` (720px):
  - Eyebrow alb: `OUR SERVICE STANDARD`
  - spacer-20
  - H2 alb (ls 1.65px): `High-end` / *`quality service`*
- spacer-64
- **Rând carduri** `264:5974`: auto-layout orizontal, gap **16px**, justify center; 5 carduri de **243.2 × 118** (min-height 118).
  - Card: fundal `#061D38`, border **1px `rgba(255,255,255,0.24)`**, radius **2px**, padding ~**28.5px vertical / 16px orizontal**, auto-layout vertical centrat, gap **12px**.
  - Icon 28 × 28 (SVG line, alb) + text Gilroy Regular **14px / 18.9px**, alb, centrat.

| Nod card | Icon | Text |
|---|---|---|
| `264:5975` | busolă / glob (`SVG`) | `24/7 worldwide` |
| `264:5984` | `advisor-suit 1` (persoană în costum) | `Dedicated private advisor` |
| `264:5994` | hartă pliată (`SVG`) | `Support in multiple languages` |
| `264:6000` | grup custom `Group 5853`: două cercuri 17.2px cu literele `P` și `H` (Vanitas Bold 12.93px) — 32.15 × 17.21 | `Car & helicopter transfers` |
| `264:6011` | clopoțel concierge (`SVG`) | `VIP concierge service` |

- **Imagini foto:** niciuna (doar iconuri).

### 4. Luna Aviation Group — `264:6019` „section_group”

- **Fundal:** alb (`Surface/ground`). Padding 80 / 40. Container 1280, vertical, **gap 64px**.
- **Header** `264:6021` (720px):
  - Eyebrow: `THE LUNA AVIATION GROUP`
  - spacer-20
  - H2: `Delivered with` / *`Swiss excellence`*
  - spacer-24
  - P (720px): `From on-demand private jet charters to industry-specific solutions, the Luna Aviation Group knows how to address every travel requirement. Whether you are flying for business, enjoying leisure with loved ones, moving a large group, or considering aircraft acquisition — you benefit from a fully tailored service designed around your exact needs.`
- **Rând carduri** `264:6029`: orizontal, gap **32px** (variabila `item spacing/m`), 3 carduri **405.33 × 425.5**.
  - Card: border **1px `#E1E5E8`** (`color/azure/90` / stil „Porcelain”), radius **2px**, fundal transparent/alb. **Conținutul este poziționat absolut** (nu auto-layout), centrat orizontal:
    - Imagine **280 × 186** (raport **1.505 ≈ 3:2**) la top 37.5px, centrată.
    - Titlu: **Vanitas Extrabold 24px**, UPPERCASE, letter-spacing **2px**, centrat, line-height normal, la y≈252.
    - Descriere: **Gilroy Regular 15px / 22.5px**, `#061D38`, centrat, la y≈293.
    - Link: `Discover` — Gilroy SemiBold 12px, ls 1.2px, UPPERCASE (stilul `Semantic/Link upper`) + săgeată SVG 13×13, gap 8px.

| Nod | Titlu | Descriere | Link | Culoare accent | Imagine |
|---|---|---|---|---|---|
| `264:6030` | `LunaJets` | `A European leader in private jet charter. LunaJets organises private jet flights anywhere in the world.` | `Discover` → | `#061D38` | `264:6038` „PLANE HQ 1” |
| `264:6039` | `LunaGroup Charter` | `The expertise to organise group flights — from conferences and incentive trips to entire team or family movements.` | `Discover` → | **`#E76C1E`** (titlu + link portocalii) | `264:6047` „image00007 (1) 3” |
| `264:6048` | `LunaSolutions` | `Aircraft acquisition, sales and management — for clients ready to step into ownership with confidence.` | `Discover` → | `#061D38` | `264:6056` „AdobeStock_645869687 1” |

### 5. Standards — `264:6057` „section_standards”

- **Fundal:** alb. Padding 80 / 40. Container 1280 × 440, **orizontal, gap 80px**, align center.
- **Text** `264:6059` (flex 1 → **660px**):
  - Eyebrow: `CERTIFICATIONS & STANDARDS`
  - spacer-20
  - H2: `Exceeding the highest` / *`standards`*
  - spacer-32
  - Lead (Gilroy **SemiBold 24px / 1.3**, ls 0.5px): `LunaJets was the first European broker to obtain the ARGUS certification.`
  - spacer-24
  - P: `As a European leader in private aviation, LunaJets is dedicated to setting the highest standards in charter integrity and social responsibility. Certified as an ARGUS broker for over a decade, we also support initiatives to reduce our clients' carbon footprint, offering the option to fly with Sustainable Aviation Fuel (SAF) for a more environmentally responsible journey.`
  - spacer-32
  - Buton outline: `DISCOVER MORE` → (196 × 50)
- **Media** `264:6076` „standards-split__media”: **540 × 440** (raport **1.227**, ≈ 27:22), radius **2px**, overflow clip; conține `264:6077` „[IMG] Wind turbines on hillside”.

### 6. As featured in — `264:6078` „AS FEATURED IN — white”

> ⚠️ Secțiune lipită dintr-un alt fișier și **scalată ×1.0588** — toate valorile sunt fracționare.

- **Fundal:** fără fill (→ alb al paginii).
- **Layout:** auto-layout vertical, gap **50.824px**, padding **84.706px vertical / 42.353px orizontal** → conținut lat **1355.29px** (nu 1280).
- **Titlu** `264:6080`: `As featured in` — Vanitas Extrabold 40px / 46.588px, ls 1.0588px, **centrat**, fără eyebrow.
- **Carduri** `264:6081`: orizontal, gap **33.882px**, 3 carduri ~**429 × 365.9**:
  - Border **1.059px `#E1E5E8`**, radius 2.118px, auto-layout vertical.
  - Bandă goală de ~20px sus (frame `264:6083` numit „The New York Times”, raport 403.33/19 — fără conținut vizibil).
  - `Image + logo` **427.76 × 169.41** (raport **≈ 2.525:1**), radius 2.118, overflow clip:
    - fotografie de fundal (cover, supradimensionată și decalată),
    - overlay **`#061D38` opacitate 85%**,
    - logo publicație (SVG alb) centrat.
  - Corp: padding 24.6 / 25.4, gap 25.4px, centrat:
    - Text **Gilroy Regular 15.88px / 23.82px**, `#061D38`: `Lorem ipsum dolor sit amet, aenean consectetuer adipiscing elit, commod ligula eget dolor.`
    - Dată **Gilroy Regular 13.77px**, `#8E98A4` (`color/azure/60`, „Regent Gray”)
    - Link `Read more` — Gilroy SemiBold 12.7px, ls 1.27px, UPPERCASE + săgeată 13.77px, gap 8.46px.

| Nod card | Logo (SVG) | Foto fundal | Dată |
|---|---|---|---|
| `264:6082` | FINANCIAL TIMES (`264:6087`, 275.4 × 23.3) | `264:6085` „sortter-CktZjrBaM8s-unsplash 1” | `May 11, 2024` |
| `264:6099` | The New York Times (`264:6104`, 248.3 × 36) | `264:6102` „AdobeStock_284813966_Editorial_Use_Only 1” | `May 11, 2024` |
| `264:6118` | EL MUNDO (`264:6123`, 203.3 × 25.4) | `264:6121` „sortter-lZVozQJ5wfY-unsplash 1” | `April 24, 2024` |

- **Buton** `264:6139`: `ALL MEDIA COVERAGE` → — outline, border 1.059px `#061D38`, radius 1.059px, padding **19.06 / 33.88**, text Gilroy SemiBold **12px**, ls 1.27px, UPPERCASE, săgeată 14.82px, gap 10.59px. Centrat.

### 7. Footer — `264:6143` (instance „Footer Container”) — detaliu în §5

---

## 3. Design tokens

### 3.1 Culori

| Hex | Variabile / stiluri Figma | Unde e folosit |
|---|---|---|
| **`#061D38`** (navy) | `Surface/card-dark`, `Text/primary-onLight` | Toate textele pe fundal deschis, navbar, footer, secțiunea Services, carduri services, bordura butoanelor outline, overlay presă (85%) |
| **`#FFFFFF`** | `Surface/ground`, `Surface/card-white`, `Surface/Input-onLight`, `Text/primary-onDark`, `Icon/contrast-onDark`, `color/white/solid`, stil `White` | Fundaluri secțiuni, text pe dark, buton REQUEST QUOTE |
| `rgba(255,255,255,0.24)` / `#FFFFFF3D` | `Border/primary-onDark`, `color/white/ 24%`, stil `White 24%` | Border navbar, border carduri Services |
| `rgba(255,255,255,0.12)` / `#FFFFFF1F` | `Button/secondary-onDark`, `Surface/Input-onDark` | Butoane icon/EN/telefon din navbar, input newsletter |
| **`#E1E5E8`** | `color/azure/90`, stil `Porcelain` | Border carduri Group și Presă |
| `#8E98A4` | `color/azure/60`, stil `Regent Gray` | Datele din cardurile de presă |
| `#979BA1` | `Text/tetriary-onDark`, `Icon/primary-onLight` | Text legal footer |
| **`#E76C1E`** (portocaliu) | `color/orange/51`, stil `Tango` | Titlu + link card „LunaGroup Charter” |
| `#F4F2EF` | `Surface/card-beige` | Definită, **nefolosită** vizibil pe About |
| `rgba(6,29,56,0.5)` | — (hardcodat) | Border sus/jos rând statistici |
| `rgba(2,12,24,0.85)`, `rgba(12,40,71,0.6)` | — (hardcodat) | Gradient secțiunea Services |
| `#061D38` @ 45% opacitate | — (opacity pe text) | Etichete statistici |

### 3.2 Tipografie

**Familii:**
- **Vanitas** — Extrabold, Extrabold Italic (titluri, cifre), Bold (literele P/H din icon). Vizual apare ca un serif de display subțire, deși stilul e numit „Extrabold” — de verificat fișierul de font.
- **Gilroy** — Regular (400), SemiBold (600), Bold (700) (body, UI, butoane, etichete). Variabila `font family/Font 2` = Gilroy.
- *Cormorant Garamond Bold* — apare doar ca stil de bază pe unele noduri de titlu (nu e randat). **Nu îl importa.**

**Scara folosită:**

| Rol | Font | Size | Line-height | Letter-spacing | Transform | Noduri exemplu |
|---|---|---|---|---|---|---|
| H1 hero | Vanitas Extrabold (+ Italic) | **54px** | 1.1 (59.4px) | 1.65px | — | `264:5889` |
| Număr statistică | Vanitas Extrabold | **52px** (sufix 22px) | 1.05 | 1px | — | `264:5911` |
| H2 secțiune | Vanitas Extrabold (+ Italic) | **40px** | 1.1 (44px) | 1.65px / 1.2px / 1.0588px | — | `264:5906`, `264:5924`, `264:6080` |
| Titlu card Group | Vanitas Extrabold | **24px** | normal | 2px | UPPERCASE | `264:6031` |
| Lead | Gilroy SemiBold | **24px** | 1.3 | 0.5px | — | `264:6066` |
| Paragraf | Gilroy Regular | **16px** | 24px | 0.4px | — | `264:5894` |
| Input placeholder | Gilroy Bold | 16px | normal | 0.8px | — | footer |
| Text card Group | Gilroy Regular | **15px** | 22.5px | 0 | — | `264:6033` |
| Text card presă | Gilroy Regular | 15.88px | 23.82px | 0 | — | `264:6091` |
| Label card Services | Gilroy Regular | **14px** | 18.9px | 0 | — | `264:5983` |
| Link footer / titlu coloană | Gilroy Bold / SemiBold | 14px | 20px | 0.28px | titluri UPPERCASE | footer |
| Dată presă | Gilroy Regular | 13.77px | normal | 0 | — | `264:6094` |
| Link navbar | Gilroy SemiBold | **13px** | 16px | 1.56px | UPPERCASE | `264:5868` |
| Buton / link „Discover” | Gilroy SemiBold | **12px** | normal (100%) | 1.2px | UPPERCASE | `264:5932`, `264:6035` |
| Etichetă statistică | Gilroy Bold | 12px | normal | 2.64px | UPPERCASE, opacity .45 | `264:5912` |
| Legal footer | Gilroy Bold | 12px | 16px | 0.24px | — | footer |
| Eyebrow | Gilroy Bold | **11px** | normal | 2.42px | UPPERCASE | `264:5887` |

**Stiluri de text definite în Figma** (aplicate foarte rar; majoritatea textelor sunt hardcodate):
- `Lunajets-website/Body/Normal` — Gilroy Regular 14 / 20, ls 2%
- `Body/M-regular` — Gilroy Regular 16 / 100%, ls 5%
- `Body/Сaption-S` — Gilroy Regular 12 / 100%, ls 2%
- `Lunajets-website/Body/Caption-small` — Gilroy Regular 12 / 16, ls 2%
- `Semantic/Link upper` — Gilroy SemiBold 12 / 100%, ls 1.2px

### 3.3 Spațiere

| Valoare | Unde |
|---|---|
| **80px** | padding vertical secțiuni (hero, services, group, standards; bottom la metrics); gap orizontal hero și standards |
| **40px** | padding orizontal secțiuni; padding vertical rând statistici |
| **64px** | gap vertical container metrics/group; gap split text–imagine; spacer-64 în Services |
| **32px** | spacer-32 (înainte de butoane); gap statistici; gap carduri Group |
| **24px** | spacer-24 (titlu → paragraf); gap navbar între linkuri |
| **20px** | spacer-20 (eyebrow → titlu) |
| **16px** | spacer-16 (paragraf → paragraf); gap carduri Services; gap butoane navbar; padding navbar vertical |
| 14px | gap număr → etichetă statistică |
| 12px | gap icon → text în cardurile Services; gap linkuri footer |
| 10px | gap linie → text în eyebrow; gap text → săgeată buton |
| 100px | padding footer (toate laturile) |
| 48px | gap footer (blocuri, coloane) |

Variabile de spațiere Figma: `Spacings/300` = 6, `Spacings/400` = 8, `Spacings/500` = 12, `item spacing/8`, `item spacing/12`, `item spacing/m` = 32.

### 3.4 Radius, borduri, umbre, efecte

- **Radius:** 1px (`Radiuses/S` — butoane outline, navbar), **2px** (`Radiuses/M`, `corner radius/2` — carduri, butoane navbar, imaginile split 1 și standards), 4px (input newsletter), 2.118px (presă, scalat).
- **Borduri:** toate 1px — `#061D38` (butoane outline), `#E1E5E8` (carduri), `rgba(255,255,255,0.24)` (dark), `rgba(6,29,56,0.5)` (statistici).
- **Umbre:** **niciuna**.
- **Efecte:** `backdrop-filter: blur(16px)` pe navbar; `blur(17px)` pe butoanele din navbar și input-ul newsletter.
- **Gradient:** doar în secțiunea Services (vezi §2.3).
- **Overlay:** `#061D38` la 85% peste fotografiile de presă.

---

## 4. Componente / instanțe și elemente repetate

**Instanțe reale de componente Figma în frame-ul About:**

| Instanță | Componentă | Nr. | Unde |
|---|---|---|---|
| `264:5878` | `IconButtonSmall/onDark` | 1 | Navbar (icon utilizator) |
| `264:5879`, `264:5880`, `264:5881` | `ButtonSmall/onDark` | 3 | Navbar (EN ▾, telefon ▾, REQUEST QUOTE) |
| `264:6143` | `Footer Container` | 1 | Footer |

Restul (butoane outline, carduri, eyebrow, statistici) sunt **frame-uri simple, nu componente** — dar se repetă și sunt candidați clari pentru componente Webflow sau clase globale:

| Element repetat | Apariții pe About | Recomandare Webflow |
|---|---|---|
| **Navbar** | 1 (identic pe celelalte 2 pagini din fișier) | Componentă Webflow `navbar` |
| **Footer** | 1 (identic pe celelalte 2 pagini) | Componentă Webflow `footer` |
| **Eyebrow** (linie + text) | 5 | Clasă globală `tagline_component` / componentă mică cu prop text |
| **Header de secțiune** (eyebrow + H2 pe 2 rânduri cu italic + paragraf opțional) | 5 | Structură standard; poate fi componentă cu props |
| **Buton outline cu săgeată** | 5 (+1 „All media coverage”) | `button is-secondary is-icon` (clasă globală) |
| **Bloc split imagine + text** | 3 (metrics) + 1 similar (standards) | Clasă custom globală `split_component` + combo `is-reverse` |
| **Stat item** | 4 | `stats_item` în grid |
| **Card service (dark)** | 5 | `services_card` |
| **Card Group** | 3 | `group_card` (poate fi CMS ulterior) |
| **Card presă** | 3 | `press_card` (candidat CMS „Press”) |
| **Text link cu săgeată** („Discover”, „Read more”) | 6 | Clasă globală `text-link` / `button is-link is-icon` |

Celelalte pagini din fișier (Why LunaJets, Private Jet Charter) reutilizează același navbar, footer, eyebrow, H2 cu italic și butoane outline → merită construite de la început ca **componente globale**.

---

## 5. Navbar și footer

### 5.1 Navbar (`264:5855`)

- Bară 1440 × 76, fundal `#061D38`, border 1px alb 24%, blur 16px, padding 16 / 24, `space-between`.
- **Stânga:** logo `LUNAJETS` (SVG alb, **100 × 20**).
- **Centru:** `Navigation` — auto-layout orizontal, gap **24px**, linkuri Gilroy SemiBold 13px, ls 1.56px, UPPERCASE, alb:
  1. `ABOUT US`
  2. `WHY LUNAJETS`
  3. `PRIVATE JET CHARTER`
  4. `PRICING` (layer numit „Charter Costs”)
  5. `AIRCRAFT` (layer numit „Container”)
  - *ascuns:* `DESTINATIONS` (`264:5874`, hidden)
- **Dreapta:** `Buttons Container`, gap **16px**:
  1. Buton icon 44 × 44 (icon utilizator 20px), fundal `rgba(255,255,255,0.12)`, radius 2, padding 12.
  2. `EN` + chevron ▾ (44h, padding 12, gap 12) — selector de limbă.
  3. Icon telefon + chevron ▾ (44h) — dropdown contact.
  4. **`REQUEST QUOTE`** — fundal alb, text `#061D38` Gilroy SemiBold 13px ls 1.56px, padding **12 / 20**, **160 × 40**, radius 2 (buton primar).
- Nu există stare sticky/scroll sau meniu mobil desenat.

### 5.2 Footer (`264:6143`)

- 1440 × 681, fundal `#061D38`, padding **100px** (toate laturile) → lățime utilă **1240px**, auto-layout vertical, gap **48px**.
- **Top — Logo + Buttons** (`space-between`):
  - Logo `LUNAJETS` SVG **162.9 × 32** + rând social **156 × 20** (Facebook, X, Instagram, YouTube, LinkedIn), gap 12.
  - Dreapta: badge-uri **App Store** și **Google Play** (~90 × 30 fiecare, contur alb).
- **Mijloc** (`space-between`):
  - 4 coloane, gap **48px**; fiecare: titlu (Gilroy SemiBold 14/20 UPPERCASE ls 0.28, alb) → gap 24 → listă linkuri (Gilroy Bold 14/20, ls 0.28, alb, gap 12):
    - `AIRCRAFT`: `Private Jet Charter`, `Empty Legs`, `Fleet`, `Jet Comparator`
    - `LUNA AVIATION GROUP`: `LunaJets`, `LunaGroup Charter`, `LunaLogistik`, `LunaSolutions`
    - `DESTINATIONS`: `Countries & cities`, `Airports`
    - `CONTACT US`: `Contact`
  - Coloana `NEWSLETTER` (360px): titlu → gap 12 → input 66px înălțime, fundal `rgba(255,255,255,0.12)`, radius 4, padding 12/20, placeholder `Enter your email` (Gilroy Bold 16, ls 0.8). **Fără buton de submit desenat.**
- **Divider** 1px (alb semi-transparent).
- **Bottom** (gap 32):
  - Rând `space-between`: steag elvețian 24 × 20 + `A Swiss-based company.` (Gilroy Bold 12, ls 0.24, alb) | logo-uri parteneri (gap 32, 460px): **The Air Charter Association**, **ARGUS**, **EBAA**, **NBAA** (SVG albe).
  - Text legal (Gilroy Bold 12/16, ls 0.24, `#979BA1`, gap 6):
    - `© 2025 LunaJets. All Rights Reserved.`
    - `LunaJets is an air charter broker and only acts as an intermediary between third-party aircraft operators and the client. LunaJets arranges carriage by air by chartering aircraft from the operator, acting as agent, in the name and on behalf of the client. LunaJets does not itself operate aircraft, is not a contracting or indirect carrier and does not provide air transportation services.`

---

## 6. Imaginea de referință și sloturile de imagine

### 6.1 Unde este

- Nod **`264:7690` „image 41”** (rounded-rectangle cu fill de imagine), pe pagina `LJ`, la **x = 6409, y = -94**, **5216 × 6071px** — în dreapta tuturor frame-urilor (după `CHART MOBILE`).
- Este o **captură a celor 3 pagini** (About, Why LunaJets, Private Jet Charter) așezate una lângă alta, **cu toate fotografiile plasate**. Coloana din stânga, cu eticheta „About — LunaJets”, corespunde exact frame-ului `264:5854`.
- **Important:** în frame-ul de design `264:5854`, sloturile foto sunt **goale** (dreptunghiuri fără fill vizibil — vezi `about-desktop-full_264-5854.png`). Imaginea de referință este singura sursă care arată ce fotografie merge unde.
- Diferență față de design: în referință, secțiunea „As featured in” arată fotografii de ziare în spatele overlay-ului navy; în design overlay-ul pare plin (#2B3F56 aparent).

### 6.2 Maparea fotografiilor pe secțiuni (desktop)

> Nu se urcă imagini în Webflow — doar **placeholder-e** cu dimensiunea/raportul de mai jos. Recomandare generală: `object-fit: cover`, wrapper cu `aspect-ratio` fix și `overflow: hidden`.

| # | Secțiune | Nod slot | Nume layer | Dimensiune desktop | Raport | Poziție | Radius | Ce arată referința (rol) |
|---|---|---|---|---|---|---|---|---|
| 1 | Hero | `264:5898` | `LJ-HQ_GVA 1` | **640 × 450** | 1.422 : 1 (≈ 64:45) | dreapta, lângă text | 0 | Sediul LunaJets din Geneva — clădire de birouri cu fațadă de sticlă, copaci, cer senin |
| 2 | Metrics / split 1 | `264:5936` | `[IMG] Aerial view of Lake Geneva` | **600 × 480** | 5 : 4 | dreapta | 2px | Lacul Geneva cu Jet d'Eau (fântâna arteziană), cer albastru cu nori |
| 3 | Metrics / split 2 | `264:5938` | `DSC03595_V1 (1) 1` | **600 × 480** | 5 : 4 | **stânga** | 0 | Doi directori în costum stând într-un birou (echipa de management) |
| 4 | Metrics / split 3 | `264:5964` | `DSC06593 2` | **600 × 480** | 5 : 4 | dreapta | 0 | Consultant la telefon, la birou, cu monitoare; coleg în fundal (echipa 24/7) |
| 5 | Group / card LunaJets | `264:6038` | `PLANE HQ 1` | **280 × 186** | 1.505 : 1 (≈ 3:2) | sus, centrat în card | 0 | Avion privat alb pe pistă, cu scara deschisă |
| 6 | Group / card LunaGroup Charter | `264:6047` | `image00007 (1) 3` | **280 × 186** | ≈ 3:2 | sus, centrat în card | 0 | Interior cabină cu fotolii din piele crem (zboruri de grup) |
| 7 | Group / card LunaSolutions | `264:6056` | `AdobeStock_645869687 1` | **280 × 186** | ≈ 3:2 | sus, centrat în card | 0 | Prim-plan cu palele unui motor de avion, alb-negru (achiziție / management aeronave) |
| 8 | Standards | `264:6077` (în `264:6076`) | `[IMG] Wind turbines on hillside` | **540 × 440** | 1.227 : 1 (≈ 27:22) | dreapta | 2px | Turbine eoliene pe un deal verde, cer albastru (sustenabilitate / SAF) |
| 9 | Presă / FT | `264:6085` | `sortter-CktZjrBaM8s-unsplash 1` | slot vizibil **427.76 × 169.41** | ≈ 2.53 : 1 | fundalul capului de card, sub overlay 85% navy + logo | 2px | Pagini de ziar (decorativ, aproape invizibil sub overlay) |
| 10 | Presă / NYT | `264:6102` | `AdobeStock_284813966_Editorial_Use_Only 1` | idem | ≈ 2.53 : 1 | idem | 2px | Ziar The New York Times (decorativ) |
| 11 | Presă / El Mundo | `264:6121` | `sortter-lZVozQJ5wfY-unsplash 1` | idem | ≈ 2.53 : 1 | idem | 2px | Ziar El Mundo (decorativ) |

**Asset-uri non-foto (vectoriale) — de tratat separat de placeholder-ele foto:**
- Logo LunaJets (navbar 100×20, footer 162.9×32), iconuri navbar (20px), săgeți butoane (14px / 13px).
- 5 iconuri Services (28px; unul e un grup custom P/H 32×17).
- Logo-uri publicații FT / NYT / El Mundo (SVG albe).
- Footer: social icons, badge-uri App Store / Google Play, steag CH, logo-uri ACA / ARGUS / EBAA / NBAA.

---

## 7. Propunere de mapare pe Client-First

### 7.1 Structură și containere

| Figma | Client-First |
|---|---|
| Padding lateral secțiune 40px | `padding-global` (2.5rem — **identic** cu valoarea default) |
| Padding vertical 80px (hero, services, group, standards) | `padding-section-medium` (5rem — **identic** cu default-ul) |
| Metrics: top 0, bottom 80 | `padding-bottom` + `padding-xxlarge` (5rem) sau `padding-section-medium` pe hero + `spacer` — **nu** `padding-section-*` complet |
| „As featured in” 84.7 / 42.35 (scalat) | normalizează la `padding-global` + `padding-section-medium` |
| Frame `container-medium` **1280px** | ⚠️ În Client-First, 1280px = **`container-large`** (80rem). `container-medium` = 64rem = 1024px. Numele din Figma **nu** corespunde; folosește `container-large`. |
| Footer, padding 100 → 1240px | recomandat `padding-global` + `container-large` (1280) pentru aliniere cu restul paginii — de confirmat |
| Coloană text hero 560px | `max-width-medium` default = 32rem (512) → personalizează la **35rem** sau folosește o clasă custom `about-hero_content` |
| Header secțiune 720px | cel mai apropiat: `max-width-large` (48rem = 768) sau personalizare la 45rem |
| Paragraf metrics 544px | 34rem — clasă custom sau `max-width-medium` personalizat |

### 7.2 Tipografie

| Figma | Tag / clasă Client-First | Valoare propusă (rem) |
|---|---|---|
| H1 54px / 1.1 Vanitas | `h1` / `heading-style-h1` | 3.375rem, lh 1.1, ls 0.03em |
| H2 40px / 1.1 Vanitas | `h2` / `heading-style-h2` | 2.5rem, lh 1.1, ls 0.03em (unificat) |
| Titlu card 24px Vanitas UPPERCASE | `h3` / `heading-style-h3` + `text-style-allcaps` | 1.5rem, lh 1.2, ls 2px (~0.083em) |
| Rândul/cuvântul italic din titluri | `<span>` cu `text-style-italic` (Vanitas Extrabold Italic trebuie încărcat ca font separat) | — |
| Lead 24px Gilroy SemiBold / 1.3 | `text-size-large` + `text-weight-semibold` | 1.5rem (default = 1.5rem ✅) |
| Paragraf 16/24 Gilroy Regular | stil de tag `body` / `p` = `text-size-regular` | 1rem, lh 1.5, ls 0.025em |
| Text card 15 / 22.5 | `text-size-regular` (normalizează la 16) sau clasă custom `group_card-text` 0.9375rem | — |
| Card Services 14 / 18.9, linkuri footer 14/20 | `text-size-small` | 0.875rem (default ✅) |
| Buton / link 12px SemiBold UPPERCASE ls 1.2px | în clasa `button` (custom) sau `text-size-tiny` + `text-weight-semibold` + `text-style-allcaps` | 0.75rem, ls 0.1em |
| Etichetă statistică 12px Bold ls 2.64 op. 45% | clasă custom `stats_label` | 0.75rem, ls 0.22em |
| Legal footer 12/16 | `text-size-tiny` sau `footer_legal-text` | 0.75rem |
| Nav 13px SemiBold UPPERCASE ls 1.56 | clasă custom `navbar_link` | 0.8125rem, ls 0.12em |
| Eyebrow 11px Bold ls 2.42 | clasă custom `tagline` (sau `text-style-tagline`) | 0.6875rem, ls 0.22em |
| Număr statistică 52px (sufix 22px) | clasă custom `stats_number` + `stats_suffix` (nu heading — nu e titlu semantic) | 3.25rem / 1.375rem |
| `h4`–`h6` | nefolosite pe About — setează o scară coerentă (ex. 1.25 / 1.125 / 1rem) | — |

**Font-uri de încărcat în Webflow:** Vanitas (Extrabold, Extrabold Italic, eventual Bold) + Gilroy (Regular 400, SemiBold 600, Bold 700). Ambele sunt comerciale — trebuie verificată licența webfont. Setează `body` = Gilroy, `h1`–`h6` = Vanitas.

### 7.3 Spațiere (spacer-e Figma → Client-First)

| Figma | Client-First default | Observație |
|---|---|---|
| spacer-16 | `spacer-small` (1rem) | ✅ identic |
| spacer-20 | — | nu există în scală → `spacer-custom1` = 1.25rem, sau `spacer_tagline` custom |
| spacer-24 | — | nu există → `spacer-custom2` = 1.5rem (sau personalizează `spacer-medium`) |
| spacer-32 | `spacer-medium` (2rem) | ✅ |
| spacer-48 (16+32) | `spacer-large` (3rem) | dacă se păstrează 48 intenționat |
| spacer-64 / gap 64 | `spacer-xlarge` (4rem) | ✅ |
| 80 (padding vertical) | `padding-section-medium` / `spacer-xxlarge` (5rem) | ✅ |
| Gap-uri grid (16 / 32 / 64 / 80) | în clasele custom (`services_list`, `group_list`, `split_component`, `about-hero_component`) | conform regulii „gap pe părinte custom” |

### 7.4 Culori — propunere variabile (Client-First v2.1, fără prefixe)

**Primitive:**

| Grup / nume | Valoare |
|---|---|
| `Brand/navy` | `#061D38` |
| `Brand/navy-darkest` | `#020C18` |
| `Brand/navy-light` | `#0C2847` |
| `Brand/orange` | `#E76C1E` |
| `Neutral/white` | `#FFFFFF` |
| `Neutral/100` | `#E1E5E8` |
| `Neutral/400` | `#8E98A4` |
| `Neutral/500` | `#979BA1` |
| `Neutral/beige` | `#F4F2EF` |
| `Alpha/white-12` | `rgba(255,255,255,0.12)` |
| `Alpha/white-24` | `rgba(255,255,255,0.24)` |
| `Alpha/navy-50` | `rgba(6,29,56,0.5)` |

**Semantice:**

| Token | → Primitive | Folosire |
|---|---|---|
| `Background Color/primary` | Brand/navy | navbar, footer, Services, carduri Services |
| `Background Color/alternate` | Neutral/white | secțiuni deschise, buton REQUEST QUOTE |
| `Background Color/secondary` | Neutral/beige | rezervă (nefolosit pe About) |
| `Background Color/overlay` | Alpha/white-12 | butoane navbar, input newsletter |
| `Text Color/primary` | Brand/navy | text pe deschis |
| `Text Color/alternate` | Neutral/white | text pe închis |
| `Text Color/secondary` | Neutral/400 | date presă |
| `Text Color/tertiary` | Neutral/500 | legal footer |
| `Text Color/accent` | Brand/orange | card LunaGroup Charter |
| `Border Color/primary` | Neutral/100 | carduri Group / presă |
| `Border Color/alternate` | Brand/navy | butoane outline |
| `Border Color/on dark` | Alpha/white-24 | navbar, carduri Services |
| `Border Color/divider` | Alpha/navy-50 | rândul de statistici |
| `Link Color/primary` | Brand/navy | linkuri „Discover / Read more” |
| `Link Color/alternate` | Neutral/white | linkuri navbar / footer |

Secțiunea Services: `section_about-services` + add-on `section-style-dark` (culoare + fundal), cu gradientul pe clasa custom a secțiunii.

### 7.5 Clase / structură propuse per secțiune

| Secțiune | Clase |
|---|---|
| Hero | `section_about-hero` › `padding-global padding-section-medium` › `container-large` › `about-hero_component` (flex, gap 5rem) › `about-hero_content` + `about-hero_image-wrapper` (aspect 64/45) |
| Metrics | `section_about-metrics` › … › `section-header_component` + `stats_list` (grid 4 col, gap 2rem, border top/bottom) › `stats_item` › `stats_number` / `stats_label` |
| Split × 3 | `split_component` (grid 2 col, gap 4rem) + `is-reverse`; `split_content`, `split_image-wrapper` (aspect 5/4) |
| Services | `section_about-services section-style-dark` › `services_list` (grid 5 col, gap 1rem) › `services_card` › `services_icon` + `services_label` |
| Group | `section_about-group` › `group_list` (grid 3 col, gap 2rem) › `group_card` › `group_card-image-wrapper` (aspect 3/2) + `group_card-title` + `group_card-text` + `text-link` |
| Standards | `section_about-standards` › `split_component` (reutilizat, gap 5rem ca `is-wide-gap`) › `split_image-wrapper is-standards` (aspect 27/22) |
| Presă | `section_about-press` › `press_list` (grid 3 col) › `press_card` › `press_card-image-wrapper` (aspect ~2.53) + `press_card-overlay` + `press_card-logo` + `press_card-body` |
| Butoane | `button` (primar alb — REQUEST QUOTE), `button is-secondary is-icon` (outline + săgeată), `text-link` (Discover / Read more) |
| Eyebrow | `tagline_component` › `tagline_line` + `tagline` |

### 7.6 Responsive (lipsă în design — propunere)

- Tablet (≤991): hero, split-uri și standards → o coloană (imaginea sub text sau deasupra); statistici 2 × 2; Services 3 + 2 sau 2 coloane; Group și presă 1–2 coloane.
- Mobile (≤767): totul pe o coloană; H1 ~2.5rem, H2 ~2rem; `padding-section-medium` scade automat (4 → 3rem); navbar cu meniu hamburger (nu e desenat).
- Trebuie **confirmat cu designerul/clientul**.

---

## 8. Ambiguități și inconsecvențe

1. **Lipsesc breakpoint-urile Tablet și Mobile** pentru About — doar Desktop 1440.
2. **Sloturile foto sunt goale** în design; fotografiile apar doar în imaginea de referință `264:7690`.
3. **Denumirea containerului:** frame-urile se numesc `container-medium`, dar au 1280px = `container-large` în Client-First.
4. **Spacere duble:**
   - Hero: `spacer-24` + `spacer-32` = **56px** între H1 și paragraf (+ un divider ascuns între ele).
   - Hero: `spacer-32` final, după ultimul paragraf, fără conținut.
   - Split 2 și 3: `spacer-16` + `spacer-32` = **48px** înainte de buton, față de **32px** în split 1 (spacer-16 rămas de la paragraful al doilea care lipsește).
5. **Letter-spacing inconsecvent pe H2:** 1.65px (header-e) vs 1.2px (split-uri) vs 1.0588px (presă). Recomandare: o singură valoare (~0.03em).
6. **Font de bază rezidual** `Cormorant Garamond Bold` pe nodurile de titlu (nerandat). Stilul „Vanitas Extrabold” arată vizual subțire — de verificat fișierul de font înainte de upload.
7. **Secțiunea „As featured in” este scalată ×1.0588:** padding 84.706 / 42.353, gap 50.824 / 33.882, fonturi 15.88 / 13.77 / 12.7, border 1.059, radius 2.118, lățime conținut 1355px (≠ 1280). Nu are eyebrow, spre deosebire de celelalte secțiuni. Numele frame-ului nu urmează convenția `section_`. De normalizat la grila paginii.
8. **Carduri presă:** layer-ul benzii de sus se numește „The New York Times” și pe cardul FT; banda de ~20px de deasupra imaginii e goală (probabil rămășiță); textul e **Lorem ipsum** (placeholder), iar datele (May 11, 2024 / April 24, 2024) sunt probabil fictive.
9. **Contradicții de conținut:** hero spune „In 2025 … over 12,000 flights”, iar statistica spune `FLIGHTS ORGANISED IN 2024`; hero scrie `€180m`, statistica `180m€`. De confirmat cu clientul.
10. **Card „LunaGroup Charter” portocaliu** (`#E76C1E`) — nu e clar dacă e o stare hover/activă desenată sau un accent permanent al brandului LunaGroup.
11. **Cardurile Group au conținut poziționat absolut:** linkul „Discover” e la y=363 în cardul 1 (descriere pe 2 rânduri) vs 385.5 în cardurile 2–3 → linkurile nu sunt aliniate. În Webflow folosește flex column (eventual cu linkul împins jos).
12. **Carduri Services:** lățimi fracționare (243.19 / 243.2), padding 28.54 / 28.57; iconul 4 (P/H) e un grup custom 32×17 în loc de 28×28 → textul e decalat (y 64 vs 69.5).
13. **Radius inconsecvent pe imagini:** split 1 și standards au 2px, hero și split 2/3 au 0.
14. **Variabile folosite greșit semantic:** `font-size/16` folosit ca gap, `letter-spacing/1` ca grosime de border, `line-height/24` ca font-size, `item spacing/12` ca font-size. Majoritatea textelor nu folosesc stilurile de text definite, iar stilul `Body/M-regular` (16 / 100% / 5%) nu corespunde paragrafului folosit (16 / 24 / 0.4px).
15. **Navbar:** numele layerelor nu corespund textului („Charter Costs” → PRICING, „Container” → AIRCRAFT); `DESTINATIONS` este ascuns; butonul REQUEST QUOTE are 40px înălțime vs 44px la celelalte; bara are radius 1px și border pe toată lățimea (neobișnuit pentru un navbar full-width). În codul generat, fundalul butoanelor secundare apare ca fallback alb, dar variabila reală e `rgba(255,255,255,0.12)`.
16. **Footer:** padding 100px → conținut 1240px, nealiniat cu containerul de 1280px al paginii. Linkurile sunt Gilroy **Bold** 14, titlurile SemiBold 14 — neobișnuit (de verificat). Input-ul newsletter nu are buton submit și nici stări.
17. **Secțiunea Metrics** are padding-top 0 (se bazează pe padding-bottom-ul hero) — la reconstrucție trebuie tratat explicit (spacer sau padding-bottom only).
18. **Valori off-grid:** 14px (gap statistici), 10px (eyebrow/buton), 18px padding buton, 15px text card, 13px nav, 11px eyebrow, 1.3 lh lead, 18.9px lh service — de rotunjit la rem-uri curate unde e posibil (0.875 / 1 / 1.25rem).
19. **Imaginea hero** (450px) e mai înaltă decât coloana de text (429px) — ok cu align center, dar de reținut pentru raportul pe tablet.
20. **Nu există stări** (hover, focus, active) desenate pentru butoane, linkuri sau carduri, cu posibila excepție a cardului portocaliu.

---

## Anexă — ce nu a putut fi accesat

- Descărcarea PNG prin URL-urile Figma (`www.figma.com`) a fost blocată de proxy-ul de ieșire (403, politică) → capturile au fost salvate prin răspunsurile base64 ale tool-ului.
- `search_design_system` a rulat limitat (1 interogare/apel) și a returnat doar componente dintr-o altă bibliotecă („For Daniel DEV - Orly Website”) → componentele sursă ale `ButtonSmall/onDark` și `Footer Container` nu au fost identificate într-o bibliotecă publicată.
- Fișierele de font (Vanitas, Gilroy) nu pot fi verificate din Figma.
