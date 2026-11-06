# Surse consultate și politica datelor tehnice

Acest fișier descrie de unde provin datele din `data/*.json`, ce s-a extras din fiecare sursă, nivelul de încredere
și regulile după care sunt marcate valorile. Data accesării tuturor surselor: **2026-11-06**.

> **Important:** simulatorul este **educațional**. Nicio valoare din `data/specs.json` nu este „VERIFICATĂ”.
> Valorile marcate `"demo": true` sunt **inventate doar pentru funcționarea simulatorului** și **NU se folosesc pe un motor real**.

## 1. Politica de marcare

| Marcaj | Înțeles | Unde apare |
|---|---|---|
| `status: "VERIFICATĂ"` | Valoare dintr-un document oficial BMW identificat (document + secțiune/pagină) **și** pentru varianta de motor selectată. | Nicăieri în MVP — varianta nu e aleasă (`variants.json → selected: "demo"`). |
| `status: "NEVERIFICATĂ"` (fără `demo`) | Valoare găsită într-o sursă publică (cu `source` completat), dar neconfirmată pentru varianta selectată. | 8 specificații informative: cilindree, alezaj, cursă, rapoarte de compresie, supape/cilindru, presiuni de injecție. |
| `status: "NEVERIFICATĂ"` + `demo: true` | Valoare inventată pentru simulator. Nota: „Valoare demonstrativă pentru simulator. NU se folosește pe un motor real.” | 64 de specificații: **toate** cuplurile, ordinile de strângere, toleranțele, presiunile de test, volumele, intervalul de schimb ulei, rezistența bobinelor, ordinea de aprindere, calarea (fără valoare). |

Reguli suplimentare aplicate:

* **Cupluri de strângere, unghiuri, ordini de strângere** — toate demonstrative. Ordinile urmează principiul general „în spirală,
  din centru spre exterior”; numerotarea șuruburilor este a simulatorului, nu a documentației BMW.
* **Poziții de calare și proceduri speciale** (blocarea distribuției, depresurizarea combustibilului, aerisirea răcirii,
  adaptări cu tester) — **nu sunt furnizate**. `spec_calare_distributie` are `value: null` și explică acest lucru.
* **Coduri de scule speciale BMW** — `bmwCode: null`, `bmwCodeStatus: "NEVERIFICAT"` (scula_blocare_ax_came, scula_blocare_volanta, extractor_amortizor).
* **Mărimile capetelor de șurub** (`fasteners.size`) — `sizeStatus: "NEVERIFICATĂ"`, fără sursă; sculele din `fasteners.tools`
  sunt alegeri plauzibile pentru simulator.
* **Coduri de piese** — nu sunt incluse.
* **Costuri (`cost`, lei) și manoperă (`laborMin`)** din `parts.json` și **prețurile sculelor** din `tools.json` sunt
  **demonstrative**, folosite doar în modul Workshop. Nu reflectă prețuri reale.
* **Numărul de elemente de fixare** (`fasteners.count`) este plauzibil, nu confirmat.
* **Defectele** (`faults.json`) au valori de test și măsurători **simulate**, coerente doar cu specificațiile demonstrative.
* **Geometria 3D** este aproximativă/schematică (`accuracy` la fiecare piesă).

## 2. Surse folosite efectiv

### [S1] Wikipedia (en) — „BMW B48”
* URL: https://en.wikipedia.org/wiki/BMW_B48 (revizia `oldid=1347740922`)
* Tip: enciclopedie, **sursă neoficială**. Încredere: **medie** (date generale bune; tabelul de modele are mențiuni „citation needed”).
* Extras:
  * producție din 2014; 4 cilindri în linie, turbo; cilindree 1597 cm³ (B48B16) și 1998 cm³ (B48B20);
  * alezaj 82,0 mm; cursă 75,6 mm (1,6 l) / 94,6 mm (2,0 l); raport de compresie 9,5:1 – 11:1;
  * bloc și chiulasă din aluminiu, bloc „closed-deck”; DOHC cu VANOS (Double VANOS) și Valvetronic; distribuție pe lanț;
  * un singur turbo twin-scroll, intercooler aer–lichid; injecție directă Bosch HDEV5 200 bar (non-TU), HDEV6 + pompă HDP6 350 bar (B48TU);
  * carter umed cu schimbător de căldură cu apă; răcire cu lichid;
  * B48TU (2018): lanț dintr-o singură bucată (în loc de două părți), circuite de răcire separate pentru chiulasă și carter,
    biele forjate, arbore cotit forjat mai ușor;
  * versiunea de 225 kW: arbore cotit ranforsat cu paliere mai mari, pistoane cu 9,5:1, turbo mai mare;
  * tabelul de coduri (B48B20M0, B48B20O0, B48B20O1, B48A20O1, B48A20M1, B48A20T1 …) cu putere, cuplu, ani și listele de modele pe putere
    → folosite în `variants.json` (asocierea cod ↔ model este marcată „de confirmat”).

### [S2] BMW Technical Training — Reference Manual „B46TU/B48TU Engines” (ST1837, © 2018 BMW of North America)
* Copie publică pe ManualsLib: https://www.manualslib.com/manual/3882621/Bmw-B48tu.html
* Tip: material de **instruire** BMW (nu manual de reparații), consultat printr-o copie publică terță. Încredere: **medie-ridicată**
  pentru descrieri; nu conține cupluri sau proceduri de atelier în paginile consultate. Paginile sunt cele din vizualizatorul ManualsLib.
* Pagini consultate (text extras):
  * **p.7 — 1.2 Innovations B48TU**: arbore cotit ranforsat cu diametru mai mare al palierelor; piston nou cu compresie modificată;
    biele noi fără bucșă în piciorul bielei; turbo mai mare cu supapă de recirculare integrată; injectoare modificate, 350 bar;
    conducte de aer de admisie noi; capac motor cu logo M Performance; reduceri de greutate la arborele cotit; distribuție pe lanț
    dintr-o singură parte; ghidaj de curea modificat; Split Cooling; modul de management termic cu supapă electrică (SCV).
  * **p.10 — 1.4 Technical data**: B46B20O1 — 190 kW, 400 N·m, 4 cilindri, 1998 cm³, 82/94,6 mm, 10,2:1, 4 supape/cilindru, 11/2018;
    B48A20T1/B48B20T1 — 225 kW, 450 N·m, 1998 cm³, 82/94,6 mm, 9,5:1, 11/2018.
  * **p.15 — Chain drive**: distribuția pe partea de ieșire a forțelor; lanț dintr-o singură parte pentru axele cu came; lanț cu bucșe
    de 8 mm; antrenarea pompei combinate ulei–vacuum printr-un lanț separat (text extras parțial — de confirmat);
    cuzineții de bielă într-o singură mărime standard (descrierea paginii).
* Doar titlurile capitolelor (fără conținut citit): p.12 Crankshaft, p.13 Connecting rod, p.18 Chain tensioner, p.19 Valve gear/VANOS,
  p.20 Belt drive, p.22 Cooling system, p.25 Heat management module, p.31 Coolant pump, p.32 Exhaust system, p.34 Fuel high-pressure pump,
  p.35 Direct rail, p.37 Solenoid valve injector — folosite doar ca trimiteri în `notes`.

### [S3] bimmer-service.com — „BMW B46 / B48 Engine Workshop Manual”
* URL: https://www.bimmer-service.com/2025/11/04/bmw-b46-b48-engine-workshop-manual/
* Tip: pagină de prezentare a unui pachet PDF, **sursă neoficială**; pagina nu precizează dacă documentele sunt oficiale BMW.
  Încredere: **scăzută**. **Nu s-au descărcat și nu s-au folosit** PDF-urile (manuale protejate).
* Extras (doar text de prezentare, folosit în `notes`, marcat NEVERIFICAT): coduri B48B20O1/B46B20O1; recomandare neoficială de
  schimb ulei la 7.000–10.000 km; scurgeri la garnitura capacului/etanșări/schimbătorul de căldură după 80.000–120.000 km;
  defectarea pompei/termostatului la 80.000–120.000 km; uzura turbo după 150.000–200.000 km; ulei murdar ca principală cauză de
  blocare VANOS/Valvetronic.

### [S0] Contractul proiectului — `docs/ARCHITECTURE.md`
* Structura pieselor (ierarhie de montaj, blocaje, flaguri, direcții de demontare), lista de conectori, scule, teste și defecte.
* Afirmația că ventilația carterului este integrată în capacul chiulasei provine din contract și din descrieri generale;
  nu a fost confirmată într-o sursă din lista de mai sus (marcată NEVERIFICATĂ în `notes`).

## 3. Ce NU s-a folosit
* Manuale de atelier protejate (ISTA, TIS, ETK etc.) — nu s-a presupus acces la ele.
* Cupluri, toleranțe sau proceduri de pe forumuri — nu au fost preluate.
* Ordinea de aprindere 1-3-4-2 este cea uzuală la motoarele BMW cu 4 cilindri în linie, dar **nu a fost găsită** în sursele consultate
  → marcată `demo: true`.

## 4. Ce trebuie să furnizeze utilizatorul pentru varianta exactă
Pentru ca o valoare să poată deveni „VERIFICATĂ” sunt necesare:
1. **Codul exact al motorului** (de pe blocul motor/eticheta de identificare, ex. `B48B20O1`), **anul de fabricație** și **modelul vehiculului**
   (seria de șasiu, ex. G20 330i), eventual VIN-ul pentru identificarea în documentația BMW.
2. **Documentația oficială** pentru acea variantă (manual de reparații BMW / ISTA), cu **document, secțiune și pagină** pentru fiecare valoare:
   cupluri și unghiuri (inclusiv etapele de strângere), ordinile de strângere, toleranțe și limite de uzură, poziții de calare și sculele
   speciale (coduri BMW), presiuni de test, volume de fluide și specificații, intervale de service, piese de unică folosință.
3. Valorile pot fi importate ca suprascrieri JSON (vezi `js/core/importer.js`), completând câmpurile `status`, `variant` și `source`.
   Până atunci, UI-ul afișează insigna „NEVERIFICATĂ” (și „valoare demonstrativă” acolo unde `demo: true`).

## 5. Rezumat cantitativ (MVP)
* `specs.json`: 72 de specificații — 64 `demo: true`, 8 `NEVERIFICATĂ` cu sursă publică, 0 `VERIFICATĂ`.
* `parts.json`: 90 de piese, 23 de conectori, 10 ansambluri; toate `sizeStatus: "NEVERIFICATĂ"`.
* `tools.json`: 40 de scule; 3 speciale cu `bmwCode: null`.
* `variants.json`: `selected: "demo"`; codurile B48A20M0 și B48B20O2 nu au fost găsite în surse (ani/modele `null`).
