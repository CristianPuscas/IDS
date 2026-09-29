# 01 — Audit pagina veche „About us” (LunaJets)

> **Etapa:** 01 — audit read-only al paginii existente, înainte de rebuild în Webflow (Finsweet Client-First).
> **Data auditului:** 2026-09-29
> **Pagina țintă:** https://www.lunajets.com/en/about-us
> **Preview Webflow (site vechi):** https://preview.webflow.com/preview/www-lunajets?…&pageId=68e8ee174a83e3b879479a1d&locale=en&workflow=preview

---

## ⚠️ STATUS: AUDIT BLOCAT — conținutul paginii NU a putut fi citit

Politica de rețea (egress) a mediului de lucru **a blocat accesul** la toate sursele care ar fi permis citirea paginii. Din acest motiv **nu există în acest document text verbatim, clase Webflow, markup, scripturi, fonturi sau screenshot-uri** preluate direct de pe pagină. Nimic din secțiunile 1–10 de mai jos nu a fost inventat: unde nu există date verificate, câmpul este marcat **„NEVERIFICAT”** sau **„DE COMPLETAT”**.

### Ce s-a încercat și rezultatul

| Sursă / metodă | Host | Rezultat |
|---|---|---|
| `curl` (HTML brut) | `www.lunajets.com` | **403 la CONNECT**: blocat de proxy-ul de egress (refuz de politică) |
| `curl` | `lunajets.com` | 403, blocat |
| WebFetch | `www.lunajets.com` | `EGRESS_BLOCKED` |
| `curl` + WebFetch | `preview.webflow.com` (preview-ul site-ului vechi) | 403 / `EGRESS_BLOCKED`. **Preview-ul nu a putut fi testat deloc** (nici măcar nu s-a ajuns la un eventual ecran de login) |
| `curl` | `www-lunajets.webflow.io` (subdomeniul Webflow) | 403, blocat |
| `curl` | `cdn.prod.website-files.com`, `assets-global.website-files.com` (CDN-ul de asset-uri Webflow) | blocat |
| Arhive / cache | `web.archive.org`, `archive.ph`, `r.jina.ai`, `webcache.googleusercontent.com`, Common Crawl (`index.commoncrawl.org`, `data.commoncrawl.org`) | toate blocate |
| PageSpeed Insights API (Lighthouse: screenshot, scripturi, fonturi, alt-uri) | `pagespeedonline.googleapis.com` | accesibil, dar **429: cota zilnică fără cheie API epuizată** |
| Webflow MCP (API read-only) | — | Contul conectat vede **un singur site**: „Daniel's Marvelous Site” (`6a82dbc04ebf3e2d805651ab`, noul proiect). Site-ul vechi `www-lunajets` **nu este accesibil** prin API, deci nu am putut citi pagini, elemente, stiluri, CMS sau custom code ale site-ului vechi. |
| Playwright / Chromium | `www.lunajets.com` | Nu a fost util: browserul trece prin același proxy, deci ar fi fost blocat identic. Folderul `old-screenshots/` a rămas gol. |

### Ce trebuie făcut ca să se deblocheze auditul (oricare dintre variante)

1. **Acces de rețea:** în setările mediului cloud (meniul mediului din bara de titlu a sesiunii → *Edit* → *Network access*) trebuie adăugate la domeniile permise: `www.lunajets.com`, `lunajets.com`, `cdn.prod.website-files.com`, `assets-global.website-files.com`, `preview.webflow.com` și, opțional, `web.archive.org`. O altă variantă este alegerea unui nivel de acces mai larg. După aceea, Etapa 01 poate fi rulată din nou integral (curl + Playwright la 1440/991/390).
2. **Acces Webflow:** autorizarea site-ului `www-lunajets` în conexiunea Webflow MCP. Asta ar permite citirea directă, fără scraping, a paginii `68e8ee174a83e3b879479a1d` (elemente, clase, interacțiuni, CMS, custom code, SEO și JSON-LD).
3. **Fișiere locale:** salvarea manuală a paginii („Save page as → Webpage, complete” sau view-source) în `/home/user/IDS/migration/about/source/`, plus screenshot-uri full-page la 1440/991/390 în `old-screenshots/`. Auditul poate fi apoi făcut din fișierele locale.

---

## Date parțiale, NEVERIFICATE (din indexul motorului de căutare, nu din pagină)

Singurele informații obținute provin din rezultate WebSearch (titluri indexate și rezumate generate de motorul de căutare). **Nu reprezintă text verbatim al paginii** și pot amesteca conținut din mai multe pagini LunaJets. Se folosesc doar ca orientare.

- **Titlu indexat pentru `/en/about-us`:** `About LunaJets - Private Jet Charter Broker` (acesta este titlul afișat de motorul de căutare; foarte probabil `<title>` / og:title, dar **neconfirmat**).
- **Fapte despre companie apărute în rezumate** (sursa exactă a paginii este neclară, deci **nu se copiază ca text final**):
  - fondată în decembrie 2007, printre primii brokeri de jet privat cu rezervare online; „European market leader”;
  - 2025: peste 12.000 de zboruri și peste 180m€ cifră de afaceri;
  - rețea de peste 4.800 de aeronave;
  - sediul central la Geneva; birouri menționate: Paris, London, Zurich, Riga, Dubai, Madrid (un rezumat spune „seven key offices”, altul „eight offices globally”, altul „100+ employees”, altul „60+ team members… 15 languages”; **cifrele sunt inconsistente între surse**);
  - primul broker european cu certificare ARGUS; opțiuni SAF (Sustainable Aviation Fuel);
  - fondator Eymeric Segard; Guillaume Launay este CEO de la 1 ianuarie 2025.
  - ⚠️ Pentru migrare: cifrele (zboruri, revenue, aeronave, birouri, angajați) trebuie **validate cu clientul**, pentru că diferă între paginile indexate.
- **Pagini interne LunaJets înrudite (URL-uri indexate, probabil legate din navbar sau din pagină; neconfirmat că apar pe about-us):**
  - https://www.lunajets.com/en (Home: „LunaJets - Private Jet Charter Since 2007”)
  - https://www.lunajets.com/en/why-lunajets/our-history („The Story of LunaJets”)
  - https://www.lunajets.com/en/why-lunajets/global-management („LunaJets Global Management”)
  - https://www.lunajets.com/en/why-lunajets/our-locations („LunaJets Locations and Offices”)
  - https://www.lunajets.com/en/contact-us/geneva-switzerland („LunaJets Geneva - Private Jet Charter Broker”)
  - https://www.lunajets.com/en/private-jet-charter
  - https://www.lunajets.com/en/private-jet-services/group-charter
  - https://www.lunajets.com/en/private-jet-charter/corporate-charter
  - https://www.lunajets.com/en/insights
  - https://media.lunajets.com/ (PDF-uri de presă)
- **Observație de arhitectură (din URL-uri):** site-ul folosește prefix de locale în path (`/en/...`), deci Webflow Localization cu subdirectoare. Există atât `/en/private-jet-charter/corporate-charter/...`, cât și `/en/private-jet-services/corporate-charter/...`. Posibile duplicate sau redirect-uri de verificat la migrare.
- **Versiuni în alte limbi ale about-us:** căutarea nu a returnat URL-uri. **DE COMPLETAT** din tag-urile `hreflang`.

---

## 1. URL, locale / hreflang, canonical
- URL: `https://www.lunajets.com/en/about-us` (confirmat doar ca URL indexat)
- Webflow pageId (din link-ul de preview): `68e8ee174a83e3b879479a1d`; site shortName: `www-lunajets`
- hreflang / variante de limbă: **DE COMPLETAT**
- Canonical: **DE COMPLETAT**

## 2. SEO
- `<title>`: probabil `About LunaJets - Private Jet Charter Broker` (**NEVERIFICAT**)
- Meta description: **DE COMPLETAT**
- Open Graph (og:title, og:description, og:image, og:type, og:url): **DE COMPLETAT**
- Twitter Card: **DE COMPLETAT**
- Meta robots: **DE COMPLETAT**
- JSON-LD / date structurate: **DE COMPLETAT**
- H1 și outline H1–H6: **DE COMPLETAT**

## 3. Secțiuni (în ordinea din pagină)
**DE COMPLETAT.** Fără acces la HTML sau randare, nu pot fi listate secțiunile, textele verbatim, CTA-urile, imaginile (src/alt) sau clasele de pe wrapper-e. Nu se știe deci nici dacă site-ul vechi urmează deja Client-First (`section_`, `padding-global`, `container-large`).

Pentru fiecare secțiune trebuie completat: nume scurt, scop, text verbatim, butoane (label + href), imagini (src, alt, rol), iconuri, clase wrapper și evaluarea Client-First.

## 4. Elemente globale
- Navbar (itemi + link-uri, language switcher, CTA): **DE COMPLETAT**
- Footer (coloane, link-uri, legal, social, newsletter): **DE COMPLETAT**
- Banner / cookie consent, elemente sticky: **DE COMPLETAT**
- Candidați probabili pentru componente reutilizabile: Navbar, Footer, language switcher, bloc CTA de tip „Request a quote”. Aceștia sunt doar ipoteze, de confirmat.

## 5. Formulare
**DE COMPLETAT** (câmpuri, action, provider: Webflow Forms sau extern / HubSpot / etc.).

## 6. Interacțiuni / animații
**DE COMPLETAT** (`data-w-id` IX2, slider, tabs, counter, marquee, Lottie, GSAP).

## 7. Custom code și integrări
**DE COMPLETAT** (GTM/GA4, cookie consent, chat, Finsweet Attributes, embed-uri CSS/JS).

## 8. CMS
**DE COMPLETAT** (`w-dyn-list`: colecțiile folosite, de exemplu echipă, birouri, testimoniale, și câmpurile vizibile).

## 9. Link-uri interne și fonturi
- Link-uri interne: vezi lista neverificată de mai sus; lista reală este **DE COMPLETAT**.
- Fonturi (Google Fonts / Typekit / custom `@font-face`): **DE COMPLETAT**.

## 10. Note pentru migrare (ce se știe deja)
- Site-ul folosește localizare pe subdirectoare (`/en/`). Noul site Webflow trebuie să păstreze aceeași structură de URL, altfel sunt necesare redirect-uri 301 pentru fiecare locale.
- Cifrele de business apar inconsistente între paginile indexate (număr de birouri, angajați, zboruri, revenue). Trebuie stabilită o sursă unică de adevăr cu clientul înainte de rebuild. Ideal, cifrele devin câmpuri CMS sau variabile reutilizabile.
- Există conținut înrudit pe pagini separate (`our-history`, `global-management`, `our-locations`). De decis dacă about-us rămâne pagină „hub” cu link-uri către ele.
- Toate celelalte verificări (H1 duplicat, alt-uri lipsă, performanță, scripturi terțe) sunt **DE COMPLETAT** după deblocarea accesului.

---

### Surse folosite (doar pentru datele NEVERIFICATE)
- Rezultate WebSearch pentru `lunajets.com` (titluri indexate): [About LunaJets - Private Jet Charter Broker](https://www.lunajets.com/en/about-us), [The Story of LunaJets](https://www.lunajets.com/en/why-lunajets/our-history), [LunaJets Global Management](https://www.lunajets.com/en/why-lunajets/global-management), [LunaJets Locations and Offices](https://www.lunajets.com/en/why-lunajets/our-locations), [LunaJets Geneva](https://www.lunajets.com/en/contact-us/geneva-switzerland), [LunaJets Home](https://www.lunajets.com/en), [Wikipedia: LunaJets](https://en.wikipedia.org/wiki/LunaJets), [LunaJets Bolsters its Management Team (PDF)](https://media.lunajets.com/media/lunajets-bolsters-its-management-team.pdf)
