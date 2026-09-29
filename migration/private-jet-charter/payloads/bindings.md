# Private Jet Charter: legarea variabilelor (după inserarea payload-urilor)

Builder-ul WHTML scrie valori brute (hex/rgba/rem). După fiecare secțiune, proprietățile de mai jos se re-leagă de variabile (ID-uri din `../../about/04-build-log.md`). Se leagă **doar** clasele noi / combo-urile noi din tabel. Clasele refolosite (`tagline_*`, `button*`, `split_component`, `split_content`, `split_image-wrapper`, `group_card-text`, `group_card-link-wrapper`, `heading-style-h4`, `text-style-link`, `button_sr-text`, `image-cover`, `max-width-large`, `spacer-*`) sunt deja legate pe About/Why și **nu se ating**.

**Precondiție:** `variables-to-create.md` (1 primitivă + 1 semantic) creat înainte de rândurile marcate `‹nou›`.

## Variabile folosite

| Variabilă | ID |
|---|---|
| Semantic › Background Color/primary | `variable-99f1b701-019b-89dc-4b9c-2608e69578d3` |
| Semantic › Background Color/alternate | `variable-13d45ed5-f589-7904-2a14-77ea704d92a9` |
| Semantic › Background Color/highlight | ‹nou, după `variables-to-create.md`› |
| Semantic › Text Color/primary | `variable-ab0e6565-f2de-5697-6c2a-01962f3f48a0` |
| Semantic › Text Color/secondary | `variable-9a72e5fd-0d7e-1a94-9012-4d7ee95a415d` |
| Semantic › Text Color/alternate | `variable-7e03c66e-bd23-5655-d46d-9c2181bff6ad` |
| Semantic › Border Color/primary | `variable-0d0719b4-d664-a947-6cad-2c18df8ba2e5` |
| Semantic › Border Color/secondary | `variable-f98eaa0f-5556-3176-0d02-53f772fda9b0` |
| Semantic › Border Color/alternate | `variable-32b343c5-eb4b-69e0-b0c2-cded055233d4` |
| UI Styles › Radius/Small (0.125rem) | `relume-variable--radius-small` |
| UI Styles › Radius/Medium (0.25rem) | `relume-variable--radius-medium` |

## Tabel de legare (clasă → proprietate → variabilă)

| # | Payload | Clasă (selector) | Breakpoint | Proprietate | Valoare brută | → Variabilă | ID |
|---|---|---|---|---|---|---|---|
| 1 | 01-search | `section_pjc-search` | base | background-color | #061D38 | Background Color/primary | `variable-99f1b701-019b-89dc-4b9c-2608e69578d3` |
| 2 | 01-search | `quote-search_component` | base | color | #061D38 | Text Color/primary | `variable-ab0e6565-f2de-5697-6c2a-01962f3f48a0` |
| 3 | 01-search | `quote-search_component` | base | border-radius | 0.125rem | Radius/Small | `relume-variable--radius-small` |
| 4 | 01-search | `quote-search_tab-text` | base | color | #061D38 | Text Color/primary | `variable-ab0e6565-f2de-5697-6c2a-01962f3f48a0` |
| 5 | 01-search | `quote-search_tab-text` | base | border-radius | 0.125rem | Radius/Small | `relume-variable--radius-small` |
| 6 | 01-search | `quote-search_field-icon` | base | color | #6B7684 | Text Color/secondary | `variable-9a72e5fd-0d7e-1a94-9012-4d7ee95a415d` |
| 7 | 01-search | `quote-search_input` | base | background-color | #FFFFFF | Background Color/alternate | `variable-13d45ed5-f589-7904-2a14-77ea704d92a9` |
| 8 | 01-search | `quote-search_input` | base | border-color | #FFFFFF | Background Color/alternate (bordura = fundalul câmpului) | `variable-13d45ed5-f589-7904-2a14-77ea704d92a9` |
| 9 | 01-search | `quote-search_input` | base | color | #061D38 | Text Color/primary | `variable-ab0e6565-f2de-5697-6c2a-01962f3f48a0` |
| 10 | 01-search | `quote-search_input` | base | border-radius | 0.125rem | Radius/Small | `relume-variable--radius-small` |
| 11 | 01-search | `quote-search_swap` | base | background-color | #061D38 | Background Color/primary | `variable-99f1b701-019b-89dc-4b9c-2608e69578d3` |
| 12 | 01-search | `quote-search_swap` | base | color | #FFFFFF | Text Color/alternate | `variable-7e03c66e-bd23-5655-d46d-9c2181bff6ad` |
| 13 | 02-intro | `pjc-hero_divider` | base | background-color | #061D38 | Border Color/alternate (linie decorativă = bordură) | `variable-32b343c5-eb4b-69e0-b0c2-cded055233d4` |
| 14 | 03-comparison | `comparison_component` | base | border-color | #E1E5E8 | Border Color/primary | `variable-0d0719b4-d664-a947-6cad-2c18df8ba2e5` |
| 15 | 03-comparison | `comparison_component` | base | border-radius | 0.125rem | Radius/Small | `relume-variable--radius-small` |
| 16 | 03-comparison | `comparison_head-cell` | base | border-left-color | #E1E5E8 | Border Color/primary | `variable-0d0719b4-d664-a947-6cad-2c18df8ba2e5` |
| 17 | 03-comparison | `comparison_head-cell` | base | background-color | #F5F8FB | **Background Color/highlight** | ‹nou› |
| 18 | 03-comparison | `comparison_head-cell` | base | color | #6B7684 | Text Color/secondary | `variable-9a72e5fd-0d7e-1a94-9012-4d7ee95a415d` |
| 19 | 03-comparison | `comparison_head-cell.is-lunajets` | base | background-color | #061D38 | Background Color/primary | `variable-99f1b701-019b-89dc-4b9c-2608e69578d3` |
| 20 | 03-comparison | `comparison_head-cell.is-lunajets` | base | border-left-color | #061D38 | Border Color/alternate | `variable-32b343c5-eb4b-69e0-b0c2-cded055233d4` |
| 21 | 03-comparison | `comparison_head-cell.is-lunajets` | base | color | #FFFFFF | Text Color/alternate | `variable-7e03c66e-bd23-5655-d46d-9c2181bff6ad` |
| 22 | 03-comparison | `comparison_label-cell` | base | border-top-color | #E1E5E8 | Border Color/primary | `variable-0d0719b4-d664-a947-6cad-2c18df8ba2e5` |
| 23 | 03-comparison | `comparison_label-cell` | base | color | #6B7684 | Text Color/secondary | `variable-9a72e5fd-0d7e-1a94-9012-4d7ee95a415d` |
| 24 | 03-comparison | `comparison_label-cell` | 767 | background-color | #F5F8FB | **Background Color/highlight** | ‹nou› |
| 25 | 03-comparison | `comparison_cell` | base | border-top-color, border-left-color | #E1E5E8 | Border Color/primary | `variable-0d0719b4-d664-a947-6cad-2c18df8ba2e5` |
| 26 | 03-comparison | `comparison_cell` | base | color | #6B7684 | Text Color/secondary | `variable-9a72e5fd-0d7e-1a94-9012-4d7ee95a415d` |
| 27 | 03-comparison | `comparison_cell.is-highlight` | base | background-color | #F5F8FB | **Background Color/highlight** | ‹nou› |
| 28 | 03-comparison | `comparison_cell.is-highlight` | 767 | background-color | #FFFFFF | Background Color/alternate | `variable-13d45ed5-f589-7904-2a14-77ea704d92a9` |
| 29 | 03-comparison | `comparison_chip` | base | background-color | #061D38 | Background Color/primary | `variable-99f1b701-019b-89dc-4b9c-2608e69578d3` |
| 30 | 03-comparison | `comparison_chip` | base | color | #FFFFFF | Text Color/alternate | `variable-7e03c66e-bd23-5655-d46d-9c2181bff6ad` |
| 31 | 03-comparison | `comparison_chip` | base | border-radius | 0.25rem | Radius/Medium | `relume-variable--radius-medium` |
| 32 | 03-comparison | `comparison_legend-swatch` | base | background-color | #061D38 | Background Color/primary | `variable-99f1b701-019b-89dc-4b9c-2608e69578d3` |
| 33 | 03-comparison | `comparison_legend-swatch` | base | border-color | #061D38 | Border Color/alternate | `variable-32b343c5-eb4b-69e0-b0c2-cded055233d4` |
| 34 | 03-comparison | `comparison_legend-swatch.is-other` | base | background-color | #FFFFFF | Background Color/alternate | `variable-13d45ed5-f589-7904-2a14-77ea704d92a9` |
| 35 | 03-comparison | `comparison_legend-swatch.is-other` | base | border-color | #E1E5E8 | Border Color/primary | `variable-0d0719b4-d664-a947-6cad-2c18df8ba2e5` |
| 36 | 04-booking | `booking_card` | base | border-color | #E1E5E8 | Border Color/primary | `variable-0d0719b4-d664-a947-6cad-2c18df8ba2e5` |
| 37 | 04-booking | `booking_card` | base | border-radius | 0.125rem | Radius/Small | `relume-variable--radius-small` |
| 38 | 04-booking | `booking_card-icon` | base | color | #061D38 | Text Color/primary | `variable-ab0e6565-f2de-5697-6c2a-01962f3f48a0` |
| 39 | 05-special | `charter-type_card` | base | border-color | #E1E5E8 | Border Color/primary | `variable-0d0719b4-d664-a947-6cad-2c18df8ba2e5` |
| 40 | 05-special | `charter-type_card` | base | border-radius | 0.125rem | Radius/Small | `relume-variable--radius-small` |
| 41 | 05-special | `charter-type_card` | base | background-color | #FFFFFF | Background Color/alternate | `variable-13d45ed5-f589-7904-2a14-77ea704d92a9` |
| 42 | 06-destinations | `destination_card-link` | base | color | #FFFFFF | Text Color/alternate | `variable-7e03c66e-bd23-5655-d46d-9c2181bff6ad` |
| 43 | 06-destinations | `destination_card-link` | base | border-radius | 0.125rem | Radius/Small | `relume-variable--radius-small` |
| 44 | 07-faq | `faq_list` | base | border-top-color | rgba(6,29,56,0.5) | Border Color/secondary | `variable-f98eaa0f-5556-3176-0d02-53f772fda9b0` |
| 45 | 07-faq | `faq_item` | base | border-bottom-color | rgba(6,29,56,0.5) | Border Color/secondary | `variable-f98eaa0f-5556-3176-0d02-53f772fda9b0` |

`.button.is-search` (combo nou pe `button`) nu are culori proprii: moștenește legările `button`.

## Valori care rămân brute (one-off, conform Client-First v2.1)

| Clasă | Proprietate | Valoare | Motiv |
|---|---|---|---|
| `pjc-search_overlay` | background-color | `rgba(6,29,56,0.45)` | voal navy peste foto (≈, nedefinit în Figma); a 1-a folosire |
| `quote-search_component` | background-color | `rgba(255,255,255,0.55)` | panou translucid (≈ Figma). Dacă widget-ul apare și pe Home/destinații → primitivă `Alpha/white-55` + semantic `Background Color/glass` |
| `quote-search_component` | backdrop-filter | `blur(12px)` | efect, nu culoare |
| `destination_card-overlay` | background-image | `linear-gradient(180deg, rgba(6,29,56,0) 45%, rgba(6,29,56,0.85) 100%)` | gradient pe foto; aceeași opacitate finală ca overlay-ul `press_card` (85%) |
| embed-uri `scripts.md` | diverse | hex | variabilele nu se leagă în HtmlEmbed |

## Fonturi

Nicio clasă nouă nu setează `font-family`; toate moștenesc (`body` → Gilroy, `h*` / `heading-style-h4` → Vanitas). Dacă builder-ul adaugă explicit font-family pe `quote-search_input` (inputurile nu moștenesc fontul fără normalize), se leagă de `relume-variable--font-style-body`.

## Clase create la pasul HtmlEmbed (nu sunt în payload-uri)

| Clasă | Pe | Stil | Legare |
|---|---|---|---|
| `icon-embed-fill` (**utilitar nou**) | HtmlEmbed în `comparison_logo` (×1) și `booking_card-icon` (×3) | display flex, width 100%, height 100%, justify-content center, align-items center | — (culoarea vine prin `currentColor`) |

`why-hero_icon-embed` (Why) are aceleași stiluri dar nume de pagină; nu se refolosește aici ca să nu legăm pagina PJC de folderul `why-hero_`. Unificarea (`why-hero_icon-embed` → `icon-embed-fill`) = refactor opțional ulterior.
