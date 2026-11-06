# BMW B48 Mechanic Simulator

Joc web 3D educațional pentru învățarea practică a mecanicii motorului **BMW B48** (4 cilindri în linie, turbo,
distribuție pe lanț, VANOS, Valvetronic). Utilizatorul identifică piese, pregătește motorul, demontează și
remontează subansambluri cu sculele potrivite, respectă cuplurile și ordinea de strângere, face teste și măsurători
și pune diagnostice pe defecte simulate.

> **Model 3D educațional aproximativ — nu este o reproducere exactă.**
> Valorile tehnice marcate **NEVERIFICATĂ** nu se folosesc pe un motor real.

Tehnologie: HTML5, CSS3, JavaScript modular (ES modules, **fără pas de build**), Three.js local (`vendor/three/`),
Web Audio API (sunete 100% sintetizate). Interfața este integral în limba română.

## Pornire locală

Este nevoie de un server HTTP (modulele ES și `fetch` nu funcționează din `file://`).

```bash
npm start                 # node tools/serve.mjs → http://localhost:8080
PORT=3000 npm start       # alt port
# alternativ, fără Node:
python3 -m http.server 8080
```

Deschideți `http://localhost:8080` într-un browser modern cu WebGL (Chrome, Edge, Firefox, Safari recente).
Dacă WebGL nu este disponibil, aplicația afișează un mesaj, iar restul interfeței (liste de piese, operațiuni,
lecții, teste) rămâne utilizabil.

Teste automate pentru logica simulatorului: `npm test` (`node --test tests/`).

## Structura proiectului

```
index.html              pagina aplicației (import map pentru three.js)
css/                    base.css (variabile, teme) · layout.css · components.css · panels.css
js/main.js              bootstrap: date → validare → EventBus → Simulator → EngineView → UI → moduri → audio
js/core/                eventBus, storage (localStorage), dataLoader, importer (JSON + bibliotecă PDF), validateData
js/sim/                 logica simulatorului (fără DOM, rulează și în Node)
js/scene/               vizualizarea 3D (EngineView, geometrie procedurală, animații)
js/ui/                  panouri, tab-uri, dialoguri (strângere, măsurare, test, inspecție, verificare finală, chestionar, variantă)
js/modes/               moduri de joc: free, guided (+ LessonRunner), exam, diagnosis, assembly, workshop
js/audio/               audioEngine (efecte) + engineSound (sinteză motor)
data/*.json             piese, stări, scule, specificații, teste, defecte, lecții, variante
data/models/            modele .glb opționale
tools/serve.mjs         server static fără dependențe
docs/ARCHITECTURE.md    contractul dintre module (scheme JSON, API-uri, evenimente)
docs/SURSE.md           sursele consultate
tests/                  teste Node pentru simulator și date
vendor/three/           three.js (licență MIT)
```

## Interfața

* **Antet**: mod de joc, insigna variantei de motor („Variantă: generic DEMONSTRATIV”) cu „Alege varianta”,
  salvare/resetare progres, volum/mute, temă luminoasă/întunecată.
* **Panoul stâng (tab-uri)**: Lecții · Operațiuni (stări de pregătire, teste motor, conectori, verificare finală,
  statistici) · Ansambluri (vizibilitate, izolare, lista tuturor pieselor) · Banc (piese demontate) · Diagnostic ·
  Date & Import.
* **Vizualizarea 3D** cu bară de unelte: vedere explodată, X-ray, etichete, fantome pentru piesele demontate,
  resetare cameră, „Pornește motorul” (simulare + sunet), „Verificare finală”.
* **Panoul dreapta „Piesă selectată”**: descriere, funcție, note, stare (montată / pe motor / șuruburi / cuplu /
  nouă / deteriorată), condiții prealabile, acțiuni disponibile cu motivele de blocare, specificații cu insigne de
  status și sursă, inspecții și măsurători.
* **Jos**: inventarul de scule (filtru pe categorii, sculă activă), progresul lecției + explicații, jurnalul
  operațiunilor.

Accesibilitate: navigare din tastatură, focus vizibil, `Escape` închide dialogurile, etichete `aria-*`.

## Moduri de joc

| Mod | Descriere |
|---|---|
| **Liber** | Reguli de ordine dezactivate; explorare fără obiective. Lecțiile se pot parcurge cu Înapoi/Sari. |
| **Ghidat** | Lecții pas cu pas, cu indicii (piesa următoare pulsează în galben), verificarea fiecărui pas, „Reia pasul”. |
| **Examen** | Sarcină: demontează și remontează subansamblul capacului de chiulasă. Fără indicii, valori de specificație ascunse; scor din greșeli, cupluri, piese, timp. |
| **Diagnostic** | Defect aleator sau din listă: simptome, „Ascultă motorul”, teste/inspecții/măsurători, apoi „Pune diagnosticul” → scor, diagnostic diferențial, verificări recomandate. |
| **Asamblare contra timp** | Subansamblul capacului de chiulasă pornește demontat; cronometru, penalizări, clasament local top 10. |
| **Atelier** | Buget demonstrativ 5000 lei, cumpărare scule (doar cele deținute pot fi folosite), piese noi și manoperă → deviz. Toate sumele sunt demonstrative. |

## Lecții

A (identificare), B (pregătire), **M1 — Capac chiulasă, bobine și bujii: demontare și reasamblare completă**
(lecția MVP completă), C (accesorii) sunt disponibile. D…K sunt **planificate**: au obiective și conținut informativ,
dar procedurile detaliate așteaptă identificarea exactă a variantei de motor și documentația oficială.
Tipuri de pași: `info`, `identify`, `demo`, `tool`, `action`, `quiz`; fiecare lecție se încheie cu un test final.
Progresul (pas curent, finalizare, scor) se salvează local.

## Politica datelor tehnice

* Nicio valoare nu este prezentată ca oficială. Fiecare specificație are `status`:
  * **NEVERIFICATĂ** — implicit; dacă valoarea există doar ca simulatorul să funcționeze, are și `demo: true`
    („valoare demonstrativă”).
  * **VERIFICATĂ** — doar cu document oficial identificat (document + pagină) **și** pentru varianta de motor
    selectată. Altfel, la încărcare, specificația este retrogradată automat la NEVERIFICATĂ.
* În MVP varianta este `demo`, deci toate valorile sunt NEVERIFICATE.
* Codurile sculelor speciale BMW nu sunt inventate (`bmwCode: null`).

## Import de date și manuale (tab „Date & Import”)

* **Import JSON** (suprascrieri locale, combinate după `id`): specificații, piese, lecții, defecte, scule sau un
  pachet `{ "specs": [...], "parts": [...], "lessons": [...], "faults": [...], "tools": [...] }`. Înainte de
  aplicare se afișează diferențele (adăugate/modificate) și rezultatul validării; importul cu erori nu se aplică.
* **Export**: datele curente (inclusiv legăturile către documente) și suprascrierile; ștergerea suprascrierilor.
* **Bibliotecă PDF**: alegeți manualele proprii; metadatele se salvează în `localStorage`, fișierul în IndexedDB
  (dacă nu e posibil — doar pentru sesiunea curentă). „Deschide” le afișează într-un tab nou, la pagina dorită.
  **Textul din PDF nu este extras automat** — valorile se introduc manual sau prin JSON.
* **Asocieri**: legați un document (pagină + secțiune) de o specificație, piesă sau procedură; legătura apare în
  panoul piesei și în export. O specificație poate fi marcată **VERIFICATĂ** doar cu document + pagină și varianta
  egală cu cea selectată.

Exemplu minimal de import:

```json
{ "specs": [ { "id": "spec_cuplu_capac_chiulasa", "value": 10, "min": 9, "max": 11,
  "status": "NEVERIFICATĂ", "demo": true, "note": "Valoare demonstrativă." } ] }
```

## Modele 3D (.glb)

Fiecare piesă are în `data/parts.json` câmpul `model` (implicit `null` → geometrie procedurală). Pentru un model
real puneți fișierul în `data/models/` și setați, de exemplu, `"model": "models/capac_chiulasa.glb"`. Coordonate:
1 unitate = 1 dm, X = lungimea motorului (față la −X, distribuția la +X), Y = sus, admisia la −Z (vezi
`docs/ARCHITECTURE.md` §2). Dacă încărcarea eșuează, se revine automat la geometria procedurală.

## Extindere

* **Piese noi**: adăugați-le în `data/parts.json` (ansamblu, `mountsOn`, `blockedBy`, `requiresFlags`, `fasteners`,
  inspecții, măsurători, `removalDir`). Blocajele derivate se calculează automat.
* **Lecții noi**: `data/lessons.json` — pași `info/identify/demo/tool/action/quiz` + `finalTest`; `initialState`
  opțional (`{ "removed": [...], "flags": {...} }`).
* **Defecte noi**: `data/faults.json` — simptome, profil de sunet, valori de test/măsurare, `rootCauseParts`,
  diagnostic diferențial, explicație.
* **Scule / teste / specificații**: `tools.json`, `tests.json`, `specs.json` (cu `status` și `source`).
* Toate referințele sunt verificate de `js/core/validateData.js` la pornire; erorile apar într-un panou, fără a bloca
  aplicația. Schemele complete: `docs/ARCHITECTURE.md`.

## Limitări

* Geometria este procedurală și aproximativă; nu reproduce piesele reale.
* Cuplurile, toleranțele, ordinile de strângere și valorile de test sunt demonstrative/NEVERIFICATE.
* Procedurile de distribuție, chiulasă, bloc etc. (lecțiile D…K) sunt doar planificate.
* Sunetul motorului este sintetizat și ilustrativ.
* Progresul și importurile sunt salvate doar local, în browserul curent.

## Licențe

* Codul simulatorului: proiect educațional.
* **three.js** — licență MIT, © three.js authors (`vendor/three/LICENSE`).
* BMW și B48 sunt mărci ale BMW AG; proiectul nu este afiliat cu BMW.
