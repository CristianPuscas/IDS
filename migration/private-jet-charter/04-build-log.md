# 04 — Jurnal de build: Private Jet Charter

Site: **Daniel's Marvelous Site** (`6a82dbc04ebf3e2d805651ab`) · Plan: `03-plan-private-jet-charter.md` · Payload-uri: `payloads/`

## Pagina ✅

- id `6abbeed3f7bbc6735a210d48`, slug `private-jet-charter`, **nu mai e draft** (la fel About `6abbdc32e0166bd4870e4b1b` și Why `6abbe696786ace7db8dab31e`, 29.09). Draft off ≠ publicat: paginile intră doar la următorul Publish.
- SEO title `Private Jet Charter & Hire | Broker Since 2007 | LunaJets`; meta description din plan §6; OG copiat din SEO.
- JSON-LD (WebPage + speakable + BreadcrumbList + FAQPage) setat din Page settings prin API, identic cu plan §6.

```
Body
└─ div.page-wrapper
   ├─ Global Styles (instanță)
   ├─ Navbar (instanță)
   ├─ main.main-wrapper#main
   │  ├─ section_pjc-search        (01) + embed CSS stări + embed script swap
   │  ├─ section_pjc-hero          (02)  H1
   │  ├─ section_pjc-comparison    (03)  <table> real
   │  ├─ section_pjc-booking       (04)
   │  ├─ section_pjc-special       (05)  id="special-private-jet-charter"
   │  ├─ section_pjc-destinations  (06)
   │  └─ section_pjc-faq           (07)  <details>/<summary>
   └─ Footer (instanță)
```

## Variabile noi ✅

| Colecție | Nume | ID | Valoare |
|---|---|---|---|
| Primitives | `Neutral/lightest-cool` | `variable-887a8ed8-7d63-5b4a-47f1-c76f52830360` | `#F5F8FB` (≈, de confirmat în Dev Mode) |
| Semantic | `Background Color/highlight` | `variable-127529ce-67a2-0e28-caeb-2ac6c9a0a40e` | alias → primitiva de mai sus |

## Secțiuni ✅

Toate 7 payload-urile inserate prin WHTML builder. Singurul avertisment: clasa internă `._w-input` nu a fost creată (duplicat Webflow, fără efect).
- Tabel, caption, thead/tbody, `th scope`, `details/summary` (cu `open` pe primul) au rămas elemente native cu tag-ul corect.
- Ancora `#special-private-jet-charter` e pe secțiunea 05 (repară linkul de pe Why LunaJets).
- Combo-uri verificate: `button.is-search`, `split_image-wrapper.is-hero`, `quote-search_field.is-date`, `.is-passengers`, `quote-search_input.is-with-icon`, `comparison_head-cell.is-lunajets`, `comparison_cell.is-highlight`, `comparison_legend-swatch.is-other`.

### Formularul de căutare — ce s-a schimbat față de payload

`<form>` a devenit Form Block nativ Webflow. Reparat prin API:
- Action `/en`, Method `GET`, nume „Quote search”; textul butonului „Request quote”.
- Radio-uri: id-uri unice (`pjc-trip-one-way`, `pjc-trip-round`, `pjc-trip-multi`), valori `one-way` / `round-trip` / `multi-city`; „One way” rămâne bifat.
- Hidden `requestFlight=1` (id `pjc-request-flight`); `for` pus pe toate cele 4 label-uri ascunse.
- **Placeholder** și **`type="button"`** sunt atribute rezervate în API. De aceea câmpurile From / To și butonul swap sunt HtmlEmbed-uri (același markup și clase ca în payload; `name`, `id`, `placeholder` păstrate). Swap-ul primește `border-style: none` pe clasă.
- Mesajele success/error ale Form Block există (ascunse implicit). **De verificat în staging** că webflow.js trimite GET spre `/en?requestFlight=1&trip=…` și nu interceptează (plan `scripts.md`, Note).

## Iconuri și embed-uri ✅

- Clasă utilitară nouă `icon-embed-fill` (flex, 100% × 100%, centrat).
- 4 HtmlEmbed-uri cu SVG `currentColor`: logo LunaJets în antetul tabelului + 3 iconuri interimare în Deposit Account (de înlocuit cu exporturile Figma).
- Embed A (CSS: tab activ `:checked`, hover, focus, placeholder, marker FAQ, rotire icon) și embed B (script swap From/To) la finalul `section_pjc-search`.

## Legare variabile ✅

Toate cele 45 de legări din `payloads/bindings.md`, pe proprietăți longhand (culori pe fiecare latură, raze pe fiecare colț), inclusiv breakpoint-ul 767 (`comparison_label-cell` → highlight, `comparison_cell.is-highlight` → alternate). Valorile one-off rămân brute, conform planului.

## Rămas

- Întrebările pentru client din plan (FAQ păstrat/scos, format GET al cererii de zbor, pașii de proces și tabelul de prețuri scoase, H1, tabelul „Yes”/„Conversion rates”, licențe imagini Ibiza / Rega / lounge, Deposit Account vs Frequent Charter Program, handle X).
- Imagini: placeholdere `<img src="">` cu alt text (fără upload, cum s-a cerut).
- `og:url` / `twitter:*` în head (manual), starea activă în navbar, QA (Lighthouse, tastatură, contrast), valorile ≈ din Figma Dev Mode.
- Coexistența slug-ului static `private-jet-charter` cu paginile CMS `fly-to-*` / `fly-between-*`: de rezolvat când se face CMS-ul de destinații (Webflow nu permite o pagină statică și o colecție cu același slug).
