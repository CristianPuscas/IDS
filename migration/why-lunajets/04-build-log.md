# 04 — Jurnal de build: Why LunaJets

Site: **Daniel's Marvelous Site** (`6a82dbc04ebf3e2d805651ab`) · Plan: `03-plan-why-lunajets.md` · Payload-uri: `payloads/`

## Pagina ✅

- id `6abbe696786ace7db8dab31e`, slug `why-lunajets`, **draft**.
- SEO title `Why Choose LunaJets for Your Next Private Flight`; meta description (146 car.) din plan §6; OG copiat din SEO.

```
Body
└─ div.page-wrapper
   ├─ Global Styles (instanță)
   ├─ Navbar (instanță componentă globală)
   ├─ main.main-wrapper#main
   │  ├─ section_why-hero        (payload 01)
   │  ├─ section_why-ways        (payload 02)
   │  ├─ section_why-advantages  (payload 03)
   │  ├─ section_why-tailored    (payload 04)
   │  ├─ section_why-pricing     (payload 05)
   │  └─ section_why-payment     (payload 06)
   └─ Footer (instanță componentă globală)
```

## Secțiuni ✅

Inserate prin WHTML builder, fără erori sau avertismente. Clasele reutilizate de la About (tagline_*, button*, services_*, spacer-*, heading-style-h4, text-size-tiny, text-style-link, image-cover, button_sr-text) nu au fost redefinite.

Clase noi: `section_why-*` (6), `why-hero_*`, `card-split_*` (component, content, title, button-wrapper, image-wrapper, chip-list, chip), `tailored_*` (list, card, card-content, card-image-wrapper, card-text), `why-payment_header`.
Combo-uri noi (verificate): `services_card.is-third`, `tagline_component.is-reverse`, `card-split_content.is-right`.
`writing-mode: vertical-rl` pe `card-split_chip` a fost acceptat (fallback-ul din plan nu a fost necesar).

## Iconuri ✅

9 HtmlEmbed-uri cu SVG `currentColor`: 3 în hero (`why-hero_icon-embed`, clasă nouă) + 6 în Advantages (`services_icon-embed`, existentă). 7 sunt iconuri interimare (Figma nu a putut fi exportat), 2 preluate de pe site-ul vechi (smartphone, credit-card) — de înlocuit cu exporturile Figma.

## Legare variabile ✅ (tabelul din `payloads/bindings.md`)

- `why-hero_image-wrapper`, `card-split_image-wrapper`, `tailored_card-image-wrapper`: radius → `Radius/Small`.
- `card-split_content`: border → `Border Color/primary`, radius → `Radius/Small`.
- `section_why-advantages`: background → `Background Color/primary`, color → `Text Color/alternate` (gradientul rămâne valoare brută, one-off).
- `card-split_chip`: color → `Text Color/alternate` (border 60% și fundal 40% rămân brute, conform planului).

## Rămas

- Întrebările pentru client din plan (H1/title, „nearly 20 years”, deposit account vs Frequent Charter Program, licențe imagini Adobe Stock Preview / ChatGPT / hangar, cardul „Music & entertainment”, eliminarea blocului app, exporturi SVG Figma, handle X).
- JSON-LD (WebPage + speakable + BreadcrumbList) și meta head (og:url, twitter:*) — pas SEO.
- Verificarea în Dev Mode Figma a valorilor estimate (≈) din secțiunile 2–5 când se resetează limita planului Starter.
