# 04 — Jurnal de build (Faza C)

Site: **Daniel's Marvelous Site** (`6a82dbc04ebf3e2d805651ab`)

## Decizii ale userului

- Cele 4 colecții CMS (Essays, Authors, Categories, Tags) au fost șterse manual de user. Verificat: 0 colecții, paginile template au dispărut.
- **Pasul 01 Cleanup se sare**: nu se șterge nicio clasă și conținutul Relume de pe Home rămâne.
- Variabilele Relume **nu se șterg**. Se refolosesc (Font Styles, Radius, Color Scheme 1) sau rămân nefolosite.

## Pasul 02 — Variabile (aprobat A + B + C + D) ✅

### A. `Primitives` (`collection-0220e3ad-eb86-03ea-3026-8a5979301dd2`): 17 culori noi

| Variabilă | Valoare | ID |
|---|---|---|
| Brand/navy | #061D38 | variable-a76b156d-8c97-aa6f-66aa-0c1d65e3a9f2 |
| Brand/navy-dark | #020C18 | variable-c64ad1e9-fbe0-b4f9-3773-19845a81930e |
| Brand/navy-light | #0C2847 | variable-3af08dd2-0041-5c84-1cdb-24be328fef31 |
| Brand/orange | #E76C1E | variable-327d10eb-f97c-7f08-68a5-6795c92d323f |
| Neutral/white | #FFFFFF | variable-d933914e-87cd-0af5-3655-569b4cb815e0 |
| Neutral/lightest | #F4F2EF | variable-71abb36b-c9f3-1a47-2dba-4dab643608b9 |
| Neutral/lighter | #E1E5E8 | variable-6c6ccc1c-d217-7755-8edd-c26320c0a10f |
| Neutral/light | #979BA1 | variable-3768d39b-5d6f-1ceb-b300-9ab7e57c62f1 |
| Neutral/dark | #6B7684 | variable-b589d7d7-3c6a-ce81-fb20-eb97af5597a9 |
| Alpha/white-12 | rgba(255,255,255,0.12) | variable-e1004d13-834f-fbeb-2e1a-dd14183ee28b |
| Alpha/white-24 | rgba(255,255,255,0.24) | variable-22ade1ca-c634-b111-2727-d6851cf9ef4d |
| Alpha/navy-50 | rgba(6,29,56,0.5) | variable-914dfde0-8768-fd5d-d159-77edb4dcdb2a |
| System/focus | #E76C1E | variable-1d8fb42f-0f18-dd8f-da51-e2d5a8ed2f6d |
| System/success-light | #E6F4EA | variable-7b66f00a-3bef-c3e9-6e2a-28aaf8cbeb09 |
| System/success-dark | #0E5E2F | variable-bd73a77b-22a1-8942-0e8e-267c3405bfee |
| System/error-light | #FDECEA | variable-ae19dd4d-3edf-8150-e4d1-2604769003ad |
| System/error-dark | #8A1C12 | variable-2233ded4-5e8e-0237-8bb4-9d3bd24f9337 |

### B. Colecție nouă `Semantic` (`collection-fdbc1c40-eb55-0ca1-48fe-6627002fe71f`): 20 tokenuri (aliasuri)

| Token | → Primitivă | ID |
|---|---|---|
| Background Color/primary | Brand/navy | variable-99f1b701-019b-89dc-4b9c-2608e69578d3 |
| Background Color/secondary | Neutral/lightest | variable-550782fd-0e9c-7b11-501c-5eaaf42434c1 |
| Background Color/tertiary | Alpha/white-12 | variable-bc9e34f9-d51a-6251-28fa-cfe8df3542ff |
| Background Color/alternate | Neutral/white | variable-13d45ed5-f589-7904-2a14-77ea704d92a9 |
| Background Color/success | System/success-light | variable-07db8d1c-a710-ff9e-83ae-3e23b364d540 |
| Background Color/error | System/error-light | variable-c8b91417-6412-ee5a-08a3-8082e7f72b2c |
| Text Color/primary | Brand/navy | variable-ab0e6565-f2de-5697-6c2a-01962f3f48a0 |
| Text Color/secondary | Neutral/dark | variable-9a72e5fd-0d7e-1a94-9012-4d7ee95a415d |
| Text Color/tertiary | Neutral/light | variable-099743b9-75e6-d9c0-bdc6-5e8457cf11e2 |
| Text Color/alternate | Neutral/white | variable-7e03c66e-bd23-5655-d46d-9c2181bff6ad |
| Text Color/accent | Brand/orange | variable-a130f677-faca-995e-3e42-d5a78095429a |
| Text Color/success | System/success-dark | variable-dff8faa5-d6f7-2c4f-9831-837d71097869 |
| Text Color/error | System/error-dark | variable-ce752e48-d787-3477-9864-c8bbd1c6017e |
| Border Color/primary | Neutral/lighter | variable-0d0719b4-d664-a947-6cad-2c18df8ba2e5 |
| Border Color/secondary | Alpha/navy-50 | variable-f98eaa0f-5556-3176-0d02-53f772fda9b0 |
| Border Color/alternate | Brand/navy | variable-32b343c5-eb4b-69e0-b0c2-cded055233d4 |
| Border Color/on dark | Alpha/white-24 | variable-5d5c93ac-c456-357b-025e-d4f203c267c5 |
| Border Color/focus | System/focus | variable-dbfe01af-6e1b-7049-21e9-7a46f06c0b92 |
| Link Color/primary | Brand/navy | variable-251bf888-793d-ba50-91b6-c835d095abbc |
| Link Color/alternate | Neutral/white | variable-9b382925-facf-ddbd-dd5c-ef89d0503b63 |

### C. Variabile Relume actualizate (nu create)

| Variabilă | Valoare veche | Valoare nouă |
|---|---|---|
| Typography › Font Styles/Heading (`relume-variable--font-style-heading`) | system-ui | `Vanitas` |
| Typography › Font Styles/Body (`relume-variable--font-style-body`) | system-ui | `Gilroy` |
| UI Styles › Radius/Small (`relume-variable--radius-small`) | 0px | 0.125rem (2px) |
| UI Styles › Radius/Medium (`relume-variable--radius-medium`) | 0px | 0.25rem (4px) |

Notă: variabila de font nu acceptă o listă de fallback (`Vanitas, Georgia, serif` a dat eroare). Fallback-ul se pune la Pasul 03 în stilurile de tag (body/headings) sau în embed-ul Global Styles. Până la upload-ul fonturilor, browserul folosește fontul implicit.

### D. `Color Schemes` › Color Scheme 1 — re-legat la tokenurile Semantic

| Variabilă | Înainte | Acum |
|---|---|---|
| Color Scheme 1/Text | Neutral Darkest (black) | Text Color/primary (navy) |
| Color Scheme 1/Background | White | Background Color/alternate (white) |
| Color Scheme 1/Foreground | Neutral Lightest (#eee) | Background Color/secondary (#F4F2EF) |
| Color Scheme 1/Border | Neutral Darkest (black) | Border Color/primary (#E1E5E8) |
| Color Scheme 1/Accent | Neutral Darkest (black) | Text Color/accent (orange) |

## Următorul pas

03 — Fonturi (upload manual de user) + stiluri globale (§4.4, §5 din `03-plan-about.md`).
