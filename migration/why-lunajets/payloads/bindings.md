# Why LunaJets: legarea variabilelor (după inserarea payload-urilor)

Builder-ul WHTML scrie valori brute (hex/rgba/rem). După fiecare secțiune, proprietățile de mai jos se re-leagă de variabilele existente (ID-uri din `../../about/04-build-log.md`). Se leagă **doar** clasele noi/combos din tabel. Clasele refolosite (tagline_*, button*, services_*, split_*, heading-style-*, text-*) sunt deja legate pe About.

## Variabile folosite

| Variabilă | ID |
|---|---|
| Semantic › Background Color/primary | `variable-99f1b701-019b-89dc-4b9c-2608e69578d3` |
| Semantic › Text Color/primary | `variable-ab0e6565-f2de-5697-6c2a-01962f3f48a0` |
| Semantic › Text Color/alternate | `variable-7e03c66e-bd23-5655-d46d-9c2181bff6ad` |
| Semantic › Border Color/primary | `variable-0d0719b4-d664-a947-6cad-2c18df8ba2e5` |
| Semantic › Border Color/on dark | `variable-5d5c93ac-c456-357b-025e-d4f203c267c5` |
| UI Styles › Radius/Small (0.125rem) | `relume-variable--radius-small` |
| Typography › Font Styles/Heading (Vanitas) | `relume-variable--font-style-heading` |
| Typography › Font Styles/Body (Gilroy) | `relume-variable--font-style-body` |

## Tabel de legare (clasă → proprietate → variabilă)

| # | Payload | Clasă (selector) | Breakpoint | Proprietate | Valoare brută în CSS | → Variabilă | ID |
|---|---|---|---|---|---|---|---|
| 1 | 01-hero | `why-hero_image-wrapper` | base | border-radius (toate 4 colțurile) | 0.125rem | Radius/Small | `relume-variable--radius-small` |
| 2 | 02-ways | `card-split_content` | base | border-color (toate laturile) | #E1E5E8 | Border Color/primary | `variable-0d0719b4-d664-a947-6cad-2c18df8ba2e5` |
| 3 | 02-ways | `card-split_content` | base | border-radius | 0.125rem | Radius/Small | `relume-variable--radius-small` |
| 4 | 02-ways | `card-split_image-wrapper` | base | border-radius | 0.125rem | Radius/Small | `relume-variable--radius-small` |
| 5 | 03-advantages | `section_why-advantages` | base | background-color | #061D38 | Background Color/primary | `variable-99f1b701-019b-89dc-4b9c-2608e69578d3` |
| 6 | 03-advantages | `section_why-advantages` | base | color | #ffffff | Text Color/alternate | `variable-7e03c66e-bd23-5655-d46d-9c2181bff6ad` |
| 7 | 04-tailored | `tailored_card-image-wrapper` | base | border-radius | 0.125rem | Radius/Small | `relume-variable--radius-small` |
| 8 | 06-payment | `card-split_chip` | base | color | #ffffff | Text Color/alternate | `variable-7e03c66e-bd23-5655-d46d-9c2181bff6ad` |

## Valori care rămân brute (one-off, conform Client-First v2.1)

| Clasă | Proprietate | Valoare | Motiv |
|---|---|---|---|
| `section_why-advantages` | background-image | `linear-gradient(162deg, rgba(2,12,24,0.85) 0%, rgba(6,29,56,0) 35%, rgba(12,40,71,0.6) 71%)` | același gradient ca `section_about-services` (a 2-a folosire; extragerea într-o clasă partajată e opțională, vezi plan D-W11) |
| `card-split_chip` | border-color | `rgba(255,255,255,0.6)` | pe fotografie; `Border Color/on dark` (24%) e prea slab. Dacă designerul acceptă 24%, se leagă de `variable-5d5c93ac-c456-357b-025e-d4f203c267c5` |
| `card-split_chip` | background-color | `rgba(6,29,56,0.4)` | voal navy pentru contrast pe fotografie (nu există în Figma) |

## Fonturi

Nicio clasă nouă nu setează `font-family`; toate moștenesc:

| Clasă | Moștenește de la | Dacă se setează explicit, se leagă de |
|---|---|---|
| `card-split_title` (pe `h3`) | tag `h3` (Font Styles/Heading) | `relume-variable--font-style-heading` |
| `p.heading-style-h4` (titluri feature hero) | `heading-style-h4` (deja legat) | — |
| `tailored_card-text`, `card-split_chip` | `body` (Font Styles/Body) | `relume-variable--font-style-body` |

## Clase create la pasul HtmlEmbed (nu sunt în payload-uri)

| Clasă | Pe | Stil | Legare |
|---|---|---|---|
| `why-hero_icon-embed` | HtmlEmbed în `why-hero_feature-icon` (×3) | display flex, width 100%, height 100% | — (culoarea vine prin `currentColor`) |
| `services_icon-embed` | HtmlEmbed în `services_icon` (×6) | **existentă** (About) | — |
