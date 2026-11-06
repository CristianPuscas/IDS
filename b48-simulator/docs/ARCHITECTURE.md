# BMW B48 Mechanic Simulator — Contract de arhitectură

Acest document este **contractul comun** dintre module. Toți dezvoltatorii (și agenții) trebuie să respecte
exact ID-urile, schemele și semnăturile de mai jos. Limba interfeței și a conținutului: **română, cu diacritice**.

Fără pas de build. ES modules native în browser, servite static. Three.js e copiat local în `vendor/three/`
și importat prin import map:

```html
<script type="importmap">
{ "imports": { "three": "./vendor/three/three.module.min.js", "three/addons/": "./vendor/three/addons/" } }
</script>
```
Addon-uri disponibile: `three/addons/controls/OrbitControls.js`, `three/addons/loaders/GLTFLoader.js`,
`three/addons/utils/BufferGeometryUtils.js`, `three/addons/environments/RoomEnvironment.js`.

## 0. Principii obligatorii

* **Nu inventăm date tehnice prezentate ca oficiale.** Orice moment de strângere, toleranță, ordine de strângere,
  poziție de calare, procedură specială, cod de piesă sau interval de service are în `specs.json` un câmp `status`:
  * `"VERIFICATĂ"` — doar dacă provine dintr-un document oficial BMW identificat (document + secțiune/pagină) **și**
    pentru varianta de motor selectată. În MVP nu există astfel de valori (varianta nu e încă aleasă).
  * `"NEVERIFICATĂ"` — orice altceva. Dacă valoarea e inventată doar ca să funcționeze simulatorul, se pune și
    `"demo": true`. UI-ul afișează mereu insigna „NEVERIFICATĂ” (+ „valoare demonstrativă” dacă `demo`).
* Modelul 3D este **educațional, aproximativ**. Fiecare piesă are `accuracy: "aproximativ" | "schematic"`, afișat în UI.
* Varianta motorului este necunoscută în MVP → `variants.json` are `selected: "demo"`.

## 1. Structura proiectului și proprietarii fișierelor

```
b48-simulator/
  index.html                 (UI)
  package.json               (UI)  scripts: start -> node tools/serve.mjs ; test -> node --test tests/
  tools/serve.mjs            (UI)  server static fără dependențe, port 8080 (sau PORT)
  README.md                  (UI)
  css/*.css                  (UI)
  vendor/three/...           (existent, nu se modifică)
  docs/ARCHITECTURE.md       (acest fișier)
  docs/SURSE.md              (DATE)  lista surselor consultate + ce s-a extras din fiecare
  data/*.json                (DATE)
  data/models/               (opțional .glb; gol în MVP)
  js/core/eventBus.js        (existent)
  js/core/validateData.js    (SIM)   validare scheme + referințe încrucișate
  js/core/storage.js         (UI)    localStorage cu try/catch
  js/core/dataLoader.js      (UI)    încărcare data/*.json + suprascrieri importate + validare
  js/core/importer.js        (UI)    import JSON (suprascrieri) + bibliotecă PDF
  js/sim/*.js                (SIM)   logică pură, fără DOM, fără three.js — rulează și în Node
  tests/*.test.mjs           (SIM)   `node --test tests/`
  js/scene/*.js              (3D)    EngineView și tot ce ține de three.js
  js/ui/*.js, js/modes/*.js, js/audio/*.js, js/main.js   (UI)
```

## 2. Sistem de coordonate (pentru 3D și `removalDir`)

Unitate: **1 = 1 dm (10 cm)**. Motor în linie cu 4 cilindri, „pe stand”.
* Axa X = lungimea motorului; arborele cotit pe axa X la y = 0. Cilindrul 1 la x = −1.365, apoi −0.455, 0.455, 1.365.
  Partea **față (curea accesorii, amortizor)** la **−X** (x ≈ −2.0 … −2.4). **Distribuția pe lanț este pe partea
  dinspre cutia de viteze (spate) la +X** (x ≈ 2.0 … 2.3), volanta la x ≈ 2.4 … 2.6 (la B48 lanțul e pe partea de ieșire).
* Y = sus. Bloc: y −0.6 … 2.3; baie ulei y −0.6 … −1.6; chiulasă y 2.3 … 3.3; capac chiulasă 3.3 … 3.9;
  bobine 3.9 … 4.4; capac acustic 4.4 … 4.7.
* Z: **admisie la −Z** (galerie admisie z −1.0 … −1.8), **evacuare/turbo la +Z** (turbo z 1.2 … 2.2, y 1.5 … 2.8).
* Alezaj ≈ 0.82, cursă ≈ 0.946 (aproximativ, doar vizual).

## 3. Date — scheme JSON (folderul `data/`)

Toate fișierele: UTF-8, JSON valid, texte în română.

### 3.1 `parts.json`
```jsonc
{
  "assemblies": [ { "id": "chiulasa", "name": "Chiulasă și mecanism supape", "color": "#8899aa" } ],
  "connectors": [
    { "id": "conector_bobina_1", "name": "Conector bobină cil. 1", "between": ["bobina_1", "cablaj_motor"],
      "requiresFlags": {} }
  ],
  "parts": [
    {
      "id": "capac_chiulasa",
      "name": "Capac chiulasă",
      "assembly": "chiulasa",
      "description": "Ce este (2-4 propoziții).",
      "function": "Ce rol are.",
      "notes": "Observații de atelier / particularități B48 (cu sursă dacă există).",
      "accuracy": "aproximativ",               // "aproximativ" | "schematic"
      "mountsOn": ["garnitura_capac_chiulasa"],// piesele pe care se montează (părinți)
      "benchOnly": false,                      // true = se demontează doar „pe banc”, după ce părintele a fost scos; călătorește cu părintele
      "blockedBy": [],                         // blocaje explicite suplimentare (trebuie DEMONTATE înainte)
      "requiresFlags": {},                     // ex. { "baterie_deconectata": true } — pentru demontare
      "fasteners": {                           // sau null dacă nu are elemente de fixare
        "count": 14, "type": "șurub", "size": "E10", "sizeStatus": "NEVERIFICATĂ",
        "tools": ["tubulara_e10"],             // ORICARE dintre acestea e acceptată la slăbire
        "torqueSpec": "spec_cuplu_capac_chiulasa",   // id din specs.json sau null
        "sequenceSpec": "spec_ordine_capac_chiulasa" // id din specs.json (type "sequence") sau null
      },
      "removeTools": [],                       // scule necesare la scoatere când nu există șuruburi (ex. cheie filtru), [] = manual
      "isGasket": false, "singleUse": false,   // garnituri/etanșări de unică folosință
      "sealsFluid": "ulei",                    // "ulei" | "lichid_racire" | "aer" | "gaze_evacuare" | "combustibil" | null — ce fluid scapă la montaj greșit
      "inspectRequiresRemoved": false,
      "inspections": [ { "id": "vizual", "name": "Inspecție vizuală", "ok": "Fără fisuri, deformări sau scurgeri (simulat)." } ],
      "measurements": [ { "id": "planeitate", "name": "Planeitate suprafață", "tool": "rigla_lera", "specRef": "spec_...", "requiresRemoved": true } ],
      "cost": 120,                             // lei, DEMONSTRATIV (Workshop Mode)
      "laborMin": 10,                          // minute, DEMONSTRATIV
      "removalDir": [0, 1, 0],                 // direcția animației de scoatere (vector unitate)
      "model": null                            // cale opțională .glb relativ la data/, ex. "models/capac_chiulasa.glb"
    }
  ]
}
```

#### Lista OBLIGATORIE de piese (ID → asamblare → mountsOn → benchOnly → blockedBy explicit → requiresFlags → removalDir)

Notație: `bench` = benchOnly true. Blocajele **derivate** nu se scriu în `blockedBy`: sunt calculate automat ca
„toate piesele non-bench care au această piesă în `mountsOn`”.

**bloc** (Bloc motor și mecanism bielă-manivelă)
| id | mountsOn | bench | blockedBy explicit | flags | removalDir |
|---|---|---|---|---|---|
| bloc_motor | [] | | | | [0,-1,0] |
| arbore_cotit | [bloc_motor] | | [baie_ulei, pompa_ulei, sorb_ulei, arbori_echilibrare] | ulei_golit | [0,-1,0] |
| biela_1 … biela_4 | [arbore_cotit] | | [chiulasa, baie_ulei] | ulei_golit | [0,1,0] |
| piston_1 … piston_4 | [biela_N] | bench | | | [0,1,0] |
| segmenti_1 … segmenti_4 | [piston_N] | bench | | | [0,1,0] |
| arbori_echilibrare | [bloc_motor] | | [baie_ulei, pompa_ulei] | ulei_golit | [0,-1,0] |

**chiulasa** (Chiulasă și mecanism supape)
| id | mountsOn | bench | blockedBy | flags | removalDir |
|---|---|---|---|---|---|
| garnitura_chiulasa | [bloc_motor] | | | | [0,1,0] |
| chiulasa | [garnitura_chiulasa] | | [lant_distributie] | lichid_racire_golit, ulei_golit | [0,1,0] |
| ax_came_admisie | [chiulasa] | | [garnitura_capac_chiulasa] | distributie_blocata | [0,1,0] |
| ax_came_evacuare | [chiulasa] | | [garnitura_capac_chiulasa] | distributie_blocata | [0,1,0] |
| ax_excentric | [chiulasa] | | [valvetronic_servomotor, garnitura_capac_chiulasa] | | [0,1,0] |
| valvetronic_servomotor | [chiulasa] | | | baterie_deconectata | [0,0,-1] |
| culbutori_tacheti | [chiulasa] | | [ax_came_admisie, ax_came_evacuare, ax_excentric] | | [0,1,0] |
| arcuri_supape | [chiulasa] | bench | [culbutori_tacheti] | | [0,1,0] |
| supape_admisie | [chiulasa] | bench | [arcuri_supape] | | [0,-1,0] |
| supape_evacuare | [chiulasa] | bench | [arcuri_supape] | | [0,-1,0] |
| garnitura_capac_chiulasa | [chiulasa] | | | | [0,1,0] |
| capac_chiulasa | [garnitura_capac_chiulasa] | | | baterie_deconectata | [0,1,0] |
| capac_motor_acustic | [capac_chiulasa] | | | | [0,1,0] |

**distributie** (Distribuție pe lanț și VANOS)
| id | mountsOn | bench | blockedBy | flags | removalDir |
|---|---|---|---|---|---|
| lant_distributie | [bloc_motor] | | [vanos_admisie, vanos_evacuare, intinzator_lant] | distributie_blocata | [1,0,0] |
| pinion_arbore_cotit | [arbore_cotit] | | [lant_distributie] | | [1,0,0] |
| vanos_admisie | [ax_came_admisie] | | [intinzator_lant] | distributie_blocata | [1,0,0] |
| vanos_evacuare | [ax_came_evacuare] | | [intinzator_lant] | distributie_blocata | [1,0,0] |
| intinzator_lant | [bloc_motor] | | [garnitura_capac_chiulasa] | | [0,0,1] |
| sina_intinzator | [bloc_motor] | | [lant_distributie] | | [1,0,0] |
| sina_ghidare | [bloc_motor] | | [lant_distributie] | | [1,0,0] |
| electrovalva_vanos_admisie | [chiulasa] | | | baterie_deconectata | [-1,0,0] |
| electrovalva_vanos_evacuare | [chiulasa] | | | baterie_deconectata | [-1,0,0] |

**ungere** (Ungere)
| id | mountsOn | bench | blockedBy | flags | removalDir |
|---|---|---|---|---|---|
| etansare_baie_ulei | [bloc_motor] | | | | [0,-1,0] |
| baie_ulei | [etansare_baie_ulei] | | | ulei_golit | [0,-1,0] |
| buson_golire_ulei | [baie_ulei] | | | | [0,-1,0] |
| senzor_nivel_ulei | [baie_ulei] | | | ulei_golit, baterie_deconectata | [0,-1,0] |
| pompa_ulei | [bloc_motor] | | [baie_ulei] | ulei_golit | [0,-1,0] |
| sorb_ulei | [pompa_ulei] | | [baie_ulei] | | [0,-1,0] |
| carcasa_filtru_ulei | [bloc_motor] | | | ulei_golit | [0,0,-1] |
| filtru_ulei | [carcasa_filtru_ulei] | | | | [0,1,0] |
| racitor_ulei | [carcasa_filtru_ulei] | | | lichid_racire_golit, ulei_golit | [0,0,-1] |
| senzor_presiune_ulei | [bloc_motor] | | | baterie_deconectata | [0,0,-1] |

**racire** (Răcire)
| id | mountsOn | bench | blockedBy | flags | removalDir |
|---|---|---|---|---|---|
| pompa_apa | [bloc_motor] | | | lichid_racire_golit | [-1,0,0] |
| termostat | [chiulasa] | | | lichid_racire_golit | [-1,0,0] |
| conducte_racire | [pompa_apa, termostat] | | | lichid_racire_golit | [-1,0,0] |
| senzor_temperatura_lichid | [chiulasa] | | | lichid_racire_golit, baterie_deconectata | [0,1,0] |

**supraalimentare** (Turbo și intercooler)
| id | mountsOn | bench | blockedBy | flags | removalDir |
|---|---|---|---|---|---|
| garnitura_turbo | [chiulasa] | | | | [0,0,1] |
| turbocompresor | [garnitura_turbo] | | | motor_rece | [0,0,1] |
| actuator_wastegate | [turbocompresor] | | | baterie_deconectata | [0,0,1] |
| sonda_lambda | [turbocompresor] | | | baterie_deconectata | [0,-1,0] |
| conducta_aer_turbo | [turbocompresor] | | | | [0,1,0] |
| intercooler | [] | | | | [0,-1,0] |
| conducta_turbo_intercooler | [turbocompresor, intercooler] | | | | [0,0,1] |
| conducta_intercooler_admisie | [intercooler, clapeta_acceleratie] | | | | [0,0,-1] |

**admisie** (Admisie)
| id | mountsOn | bench | blockedBy | flags | removalDir |
|---|---|---|---|---|---|
| garnitura_galerie_admisie | [chiulasa] | | | | [0,0,-1] |
| galerie_admisie | [garnitura_galerie_admisie] | | | | [0,0,-1] |
| clapeta_acceleratie | [galerie_admisie] | | | baterie_deconectata | [-1,0,0] |
| senzor_presiune_admisie | [galerie_admisie] | | | baterie_deconectata | [0,1,0] |

**combustibil** (Alimentare cu combustibil)
| id | mountsOn | bench | blockedBy | flags | removalDir |
|---|---|---|---|---|---|
| pompa_inalta_presiune | [chiulasa] | | | combustibil_depresurizat | [0,1,0] |
| conducta_inalta_presiune | [pompa_inalta_presiune, rampa_combustibil] | | | combustibil_depresurizat | [0,1,0] |
| rampa_combustibil | [chiulasa] | | | combustibil_depresurizat | [0,0,-1] |
| injector_1 … injector_4 | [chiulasa] | | [rampa_combustibil] | combustibil_depresurizat | [0,0,-1] |

**electric** (Aprindere, senzori, cablaje)
| id | mountsOn | bench | blockedBy | flags | removalDir |
|---|---|---|---|---|---|
| bobina_1 … bobina_4 | [capac_chiulasa] | | | baterie_deconectata | [0,1,0] |
| bujie_1 … bujie_4 | [chiulasa] | | [bobina_N] | | [0,1,0] |
| senzor_arbore_cotit | [bloc_motor] | | | baterie_deconectata | [0,0,1] |
| senzor_ax_came_admisie | [capac_chiulasa] | | | baterie_deconectata | [0,1,0] |
| senzor_ax_came_evacuare | [capac_chiulasa] | | | baterie_deconectata | [0,1,0] |
| cablaj_motor | [bloc_motor] | | | baterie_deconectata | [0,1,0] |

**accesorii** (Accesorii și suporturi)
| id | mountsOn | bench | blockedBy | flags | removalDir |
|---|---|---|---|---|---|
| curea_accesorii | [amortizor_vibratii, alternator, compresor_ac, pompa_apa] | | | | [-1,0,0] |
| intinzator_curea | [bloc_motor] | | [curea_accesorii] | | [-1,0,0] |
| amortizor_vibratii | [arbore_cotit] | | | | [-1,0,0] |
| alternator | [bloc_motor] | | | baterie_deconectata | [0,0,-1] |
| compresor_ac | [bloc_motor] | | | | [0,0,-1] |
| volanta | [arbore_cotit] | | | | [1,0,0] |
| suport_motor_stanga | [bloc_motor] | | | | [0,0,-1] |
| suport_motor_dreapta | [bloc_motor] | | | | [0,0,1] |

Garnituri (`isGasket: true, singleUse: true`): garnitura_chiulasa, garnitura_capac_chiulasa, etansare_baie_ulei,
garnitura_turbo, garnitura_galerie_admisie. Ventilația carterului e integrată în capacul chiulasei la B48 (se descrie în
`notes` la capac_chiulasa, nu e piesă separată).

#### Conectori obligatorii (`between` include întotdeauna `cablaj_motor`)
conector_bobina_1…4 (bobina_N), conector_injector_1…4 (injector_N), conector_senzor_ax_came_admisie,
conector_senzor_ax_came_evacuare, conector_senzor_arbore_cotit, conector_senzor_presiune_ulei, conector_senzor_nivel_ulei,
conector_senzor_temperatura (senzor_temperatura_lichid), conector_senzor_presiune_admisie, conector_clapeta (clapeta_acceleratie),
conector_valvetronic (valvetronic_servomotor), conector_electrovalva_vanos_admisie, conector_electrovalva_vanos_evacuare,
conector_alternator (requiresFlags `{ "baterie_deconectata": true }`), conector_sonda_lambda, conector_wastegate (actuator_wastegate),
conector_pompa_inalta_presiune.

### 3.2 `flags.json` — stări globale de pregătire
```jsonc
{ "flags": [
  { "id": "baterie_deconectata", "name": "Baterie deconectată", "default": false,
    "onLabel": "Deconectează bateria", "offLabel": "Reconectează bateria",
    "toolsOn": ["tubulara_10"], "toolsOff": ["tubulara_10"],          // [] = fără sculă
    "requiresOn": { "removed": [], "installed": [], "flags": {} },    // condiții pentru a seta true
    "requiresOff": { "removed": [], "installed": [], "flags": {} },   // condiții pentru a seta false
    "mustBeOffToStart": true,                                          // pornirea simulată cere false
    "description": "..." }
]}
```
ID-uri obligatorii: `baterie_deconectata`, `motor_rece` (default **false**; „Lasă motorul să se răcească”; `mustBeOffToStart: false`),
`combustibil_depresurizat`, `ulei_golit` (off = „Umple cu ulei”: requiresOff installed [baie_ulei, buson_golire_ulei, filtru_ulei, carcasa_filtru_ulei]),
`lichid_racire_golit` (off requiresOff installed [pompa_apa, termostat, conducte_racire, chiulasa, racitor_ulei]),
`distributie_blocata` (on = montare scule de blocare: toolsOn [scula_blocare_ax_came, scula_blocare_volanta],
requiresOn removed [capac_chiulasa]; `mustBeOffToStart: true` — pornire cu sculele montate = avarie gravă).
Pentru `motor_rece`: `mustBeOffToStart` false, iar la pornire nu contează.

### 3.3 `tools.json`
```jsonc
{ "tools": [
  { "id": "tubulara_e10", "name": "Cheie tubulară Torx exterior E10", "category": "socket",
    "description": "...", "size": "E10", "range": null, "price": 25, "defaultOwned": true, "icon": "🔩" }
]}
```
`category`: socket | ratchet | torque | angle | screwdriver | pliers | wrench | special | measure | diagnostic | fluid | hand.
`range`: [min, max] în Nm pentru `torque`. ID-uri obligatorii: clichet_1_4, clichet_3_8, clichet_1_2, tubulara_10, tubulara_13,
tubulara_16, tubulara_e8, tubulara_e10, tubulara_e12, tubulara_e14, tubulara_e18, cheie_torx_t30, cheie_torx_t40, cheie_bujii,
cheie_filtru_ulei, cheie_dinamometrica_mica (range [2,25]), cheie_dinamometrica (range [20,100]), cheie_dinamometrica_mare (range [60,300]),
unghiometru, surubelnita_plata, clesti_coliere, clesti_patent, scula_blocare_ax_came, scula_blocare_volanta, extractor_amortizor,
micrometru, alezometru, rigla_lera, lera, comparator, sublar, tester_compresie, tester_pierderi_presiune, multimetru, tester_presiune_racire,
endoscop, tava_scurgere, palnie_umplere, pompa_vacuum_racire? (opțional), manometru_ulei.
Scule speciale BMW: **nu inventa coduri BMW** — `"bmwCode": null, "bmwCodeStatus": "NEVERIFICAT"`.

### 3.4 `specs.json`
```jsonc
{ "specs": [
  { "id": "spec_cuplu_capac_chiulasa", "name": "Cuplu șuruburi capac chiulasă", "type": "torque",
    "value": 10, "unit": "Nm", "min": 9, "max": 11, "angle": null,    // angle: grade suplimentare (unghi) sau null
    "order": null,                                                    // doar pentru type "sequence": [indici șuruburi 1-based]
    "status": "NEVERIFICATĂ", "demo": true,
    "variant": "demo",                                                 // sau cod motor ex. "B48B20O1"
    "source": { "document": null, "section": null, "page": null, "url": null },
    "note": "Valoare demonstrativă pentru simulator. NU se folosește pe un motor real." }
]}
```
`type`: torque | sequence | dimension (min/max în mm) | pressure (bar) | volume (l) | interval | timing | info.
Pentru `dimension`/`pressure`: `value` = nominal, `min`/`max` = limite acceptate.

### 3.5 `tests.json` — teste la nivel de motor
```jsonc
{ "tests": [
  { "id": "test_compresie", "name": "Test compresie", "tool": "tester_compresie", "perCylinder": true,
    "variants": ["uscat", "umed"], "requires": { "removed": ["bujie_1","bujie_2","bujie_3","bujie_4"], "installed": [], "flags": {} },
    "specRef": "spec_compresie", "description": "..." }
]}
```
ID-uri obligatorii: test_compresie, test_pierderi_presiune (perCylinder), test_presiune_ulei, test_etanseitate_racire,
test_bobine (perCylinder, multimetru), test_endoscop (perCylinder), test_joc_turbo (comparator, requires removed [conducta_aer_turbo]).

### 3.6 `faults.json`
```jsonc
{ "faults": [
  { "id": "F_segmenti_cil3", "title": "Uzură segmenți — cilindrul 3", "difficulty": 2,
    "category": "mecanic",
    "symptoms": ["..."],
    "sound": { "misfireCylinder": 3, "roughness": 0.3, "chainRattle": 0, "turboWhistle": 0, "knock": 0, "hiss": 0 },
    "tests": { "test_compresie": { "uscat": [13.0, 13.1, 8.5, 12.9], "umed": [13.2, 13.3, 11.8, 13.1] } },
    "measurements": { "segmenti_3.joc_capete": 0.9 },               // "<partId>.<measurementId>": valoare
    "partStates": { "segmenti_3": { "damaged": true, "finding": "..." } },
    "differential": ["..."], "recommendedChecks": ["..."],
    "rootCauseParts": ["segmenti_3"],
    "explanation": "...",
    "valuesNote": "Toate valorile sunt simulate, NEVERIFICATE." }
]}
```
Minim 8 scenarii: uzură segmenți, pierdere ulei (garnitură capac chiulasă), problemă răcire (termostat/pompă apă),
turbo (joc axial/radial, șuierat), uzură distribuție (lanț/întinzător — zgomot la pornire la rece), etanșare (garnitură chiulasă),
bobină defectă (rateu), compresie incorectă (supape evacuare cil. X).

### 3.7 `lessons.json`
```jsonc
{ "lessons": [
  { "id": "L_A", "code": "A", "title": "...", "status": "disponibilă",   // "disponibilă" | "planificată"
    "objectives": ["..."], "estimatedMin": 15, "initialState": null,       // sau { "removed": [ids], "flags": {} }
    "steps": [
      { "id": "a1", "type": "info", "title": "...", "text": "...", "focus": "bloc_motor" },
      { "id": "a2", "type": "identify", "target": "chiulasa", "text": "Selectează chiulasa." },
      { "id": "a3", "type": "demo", "demo": "explode" | "xray" | "isolate" | "remove_install" | "run", "target": "chiulasa", "text": "..." },
      { "id": "a4", "type": "tool", "tool": "tubulara_e10", "text": "Alege cheia tubulară E10." },
      { "id": "a5", "type": "action", "action": "disconnect|connect|loosen|remove|install|tighten|flag_on|flag_off|inspect|measure|test|final_check",
        "target": "capac_chiulasa", "params": { "newPart": true }, "text": "...", "hint": "..." },
      { "id": "a6", "type": "quiz", "question": "...", "options": ["...", "..."], "answer": 0, "explanation": "..." }
    ],
    "finalTest": [ { "question": "...", "options": ["..."], "answer": 1, "explanation": "..." } ] }
]}
```
* `target` la `flag_on/flag_off` = id flag; la `test` = id test; la `measure` = `"<partId>.<measurementId>"`;
  la `connect/disconnect` = id conector; la `final_check` = null.
* Lecții: A (identificare), B (pregătire), **M1 „Capac chiulasă, bobine și bujii — demontare și reasamblare completă”
  (lecția MVP completă)**, C (accesorii) — `disponibilă`, complete. D…K — `planificată`, cu obiective și pași de tip `info`
  (procedurile detaliate așteaptă varianta exactă a motorului).

### 3.8 `variants.json`
```jsonc
{ "selected": "demo",
  "variants": [ { "id": "demo", "code": "B48 (generic, demonstrativ)", "years": null, "models": [], "note": "..." },
                { "id": "B48B20O1", "code": "B48B20O1", "years": "...", "models": ["..."], "status": "NEVERIFICATĂ", "note": "..." } ] }
```

## 4. Simulator (logică) — `js/sim/Simulator.js`

```js
import { Simulator } from './sim/Simulator.js';
const sim = new Simulator(data, bus, { seed: 1, enforce: true });
// data = { parts, flags, tools, specs, tests, faults, lessons, variants }  (conținutul fișierelor, ex. data.parts.parts)
```
Toate metodele de acțiune întorc un **Result**:
`{ ok: boolean, code: string, message: string, reasons: string[], warnings: string[], data?: any }` (mesaje în română).
După fiecare acțiune (reușită sau nu) se emite `bus.emit('sim:op', { action, target, result })`, apoi `sim:changed`.
Mesajele de jurnal: `bus.emit('sim:log', { level: 'info'|'success'|'warn'|'error', message, time })`.

### Reguli
* `isOnEngine(id)` = instalată și toți părinții (`mountsOn`) pe motor (recursiv; piesele cu `mountsOn: []` sunt pe motor dacă sunt instalate).
* **Blocanți(id)** = `blockedBy` explicit ∪ { c | c.mountsOn include id și !c.benchOnly }.
* **canRemove(id)** (enforce): instalată; dacă benchOnly → toți părinții NU sunt pe motor; toți blocanții neinstalați;
  toți conectorii care conțin id în `between` deconectați; dacă `fasteners` → starea `loose`; `requiresFlags` îndeplinite;
  dacă `removeTools` nevid → sculă activă ∈ removeTools. Piesele benchOnly descendente rămân `installed: true` și călătoresc cu părintele.
* **canInstall(id)**: neinstalată; benchOnly → părinții instalați dar NU pe motor (pe banc); altfel toți părinții pe motor;
  blocanții neinstalați. Garnitură `singleUse` folosită (`isNew: false`) → permis, dar avertisment + problemă la verificarea finală.
  `install(id, { newPart: true })` = piesă nouă (stare nouă, `damaged` false, se adaugă `cost` la stats.partsCost).
  După montare: fasteners `loose`, conectorii rămân deconectați.
* **loosen(id, toolId)**: instalată, fasteners `tight`, sculă ∈ fasteners.tools (altfel eroare „Sculă incorectă…”).
* **tighten(id, { toolId, torque, angle, order })**: instalată, fasteners `loose`. Dacă sculă `torque` → torque trebuie să fie în `range`-ul sculei;
  se compară cu spec: `< min` → `under`, `> max` → `over` (piesa devine `damaged`, `damageNote`), altfel `ok`; dacă spec are `angle`, se cere și unghi
  (cu sculă `unghiometru` deținută/activă nu e necesar — e suficient parametrul angle; lipsă → `under`). Dacă sculă ∈ fasteners.tools (clichet, fără cuplu
  controlat) → `uncontrolled` (cuplu pseudo-aleator determinist din seed) → problemă. Dacă `sequenceSpec` există: `order` trebuie să fie egal cu spec.order;
  altfel `sequenceOk: false` (problemă de etanșare). Rezultatul se stochează în `torque: { status, value, angle, sequenceOk }`. Fasteners → `tight`.
* **disconnect/connect(connectorId)**: `requiresFlags` ale conectorului; ambele capete trebuie să fie instalate pentru `connect`.
* **setFlag(flagId, value, toolId)**: verifică `toolsOn/toolsOff` (sculă activă ∈ listă, dacă lista nu e goală) și `requiresOn/requiresOff`.
  `ulei_golit=false` cu baie/buson/filtru greșit strânse → se permite, dar se marchează scurgere la verificare.
* **Modul liber** (`enforce: false`): `remove/install` ignoră toate condițiile cu excepția stării instalat/neinstalat; fasteners sunt trecute automat.
* Orice acțiune refuzată în `enforce` se adaugă la `stats.mistakes` și crește `stats.errors`.

### API
```js
sim.enforce; sim.setEnforce(bool)
sim.activeTool; sim.setActiveTool(toolId|null)           // emite 'tool:active' {toolId}
sim.getPart(id); sim.getTool(id); sim.getSpec(id); sim.getConnector(id); sim.getFlagDef(id); sim.getTest(id)
sim.getPartState(id)  // { installed, onEngine, fasteners: 'tight'|'loose'|'none', torque, isNew, damaged, damageNote }
sim.getConnectorState(id) // { connected }
sim.getFlag(id)       // boolean
sim.isOnEngine(id)
sim.blockers(id)      // string[]
sim.benchGroup(id)    // string[] — descendenți benchOnly care călătoresc cu piesa (recursiv, doar cei instalați)
sim.connectorsOf(id)  // string[]
sim.dependencies(id)  // { mounts, blockers, connectors, flags, fasteners, tools, torqueSpec, sequenceSpec } — pt. panoul „Condiții prealabile”
sim.canRemove(id, toolId?) / sim.canInstall(id)    // Result fără efecte secundare și fără a număra greșeli
sim.availableActions(id) // [{ action, target, label, allowed, reasons }] pentru piesă: loosen/remove/install/install_new/tighten/inspect/measure + connect/disconnect pentru conectorii ei
sim.disconnect(cid); sim.connect(cid)
sim.loosen(id, toolId = sim.activeTool)
sim.remove(id, toolId = sim.activeTool)       // data: { group: benchGroup }
sim.install(id, { newPart = false } = {})     // data: { group }
sim.tighten(id, { toolId = sim.activeTool, torque, angle = null, order = null })
sim.setFlag(flagId, value, toolId = sim.activeTool)
sim.inspect(id)                                // data: { findings: [{ id, name, text, defect: boolean }] }
sim.measure(id, measurementId, toolId = sim.activeTool) // data: { value, unit, spec, inTolerance, status }
sim.runTest(testId, { toolId = sim.activeTool, variant = null } = {}) // data: { values: number[]|number, unit, spec, inTolerance: boolean[]|boolean }
sim.finalCheck()  // Result; data: FinalReport
//   FinalReport = { startable, issues: [{ type: 'missing'|'fastener'|'torque'|'sequence'|'connector'|'flag'|'gasket'|'damaged'|'fault', partId?, connectorId?, flagId?, message }],
//                   leaks: [{ partId, fluid }], sound: { misfireCylinder, roughness, chainRattle, turboWhistle, knock, hiss, noStart } }
sim.loadFault(faultId|null); sim.activeFault  // aplică partStates; un defect e „reparat” când toate rootCauseParts au fost înlocuite cu piese noi
sim.diagnose(partIds) // Result; data: { correct, missed, wrong, score (0-100) }
sim.applyPreset({ removed = [], flags = {} })  // stare inițială pentru lecții/challenge (ordinea de demontare respectată automat, fără greșeli)
sim.reset()
sim.snapshot() / sim.restore(snap)   // JSON serializabil
sim.stats   // { ops, errors, laborMin, partsCost, mistakes: [{ time, action, target, reasons }] }
```

Valori simulate pentru măsurători/teste: dacă defectul activ definește valoarea → aceea; altfel `spec.value` + zgomot mic
determinist (seed) în interiorul [min,max]. Unde lipsește spec → `null` cu mesaj „Fără specificație”.

`js/core/validateData.js`: `export function validateData(data) -> { errors: string[], warnings: string[] }` — verifică
câmpuri obligatorii, ID-uri unice, toate referințele (mountsOn, blockedBy, connectors.between, tools, specRef, tests, lessons.target, faults),
lipsa ciclurilor în mountsOn, statusul specificațiilor.

## 5. Vizualizare 3D — `js/scene/EngineView.js`

```js
import { EngineView } from './scene/EngineView.js';
const view = new EngineView(containerEl, bus, partsData /* conținutul parts.json */);
await view.init();                // construiește scena; emite 'view:ready'
view.select(partId|null)          // evidențiere selecție (emisiv albastru)
view.setHint(partId|null)         // puls galben „următorul pas”
view.setDamaged(partId, bool)     // tentă roșie
view.animateRemove(partId, groupIds = []) : Promise   // translație pe removalDir (+ grup), apoi ascunde
view.animateInstall(partId, groupIds = []) : Promise  // apare deplasat pe removalDir și intră în poziție
view.setPartVisible(partId, bool)
view.syncVisibility(isOnEngineFn)  // vizibil = isOnEngineFn(id) && ansamblul vizibil && (izolare)
view.setGhostRemoved(bool)         // piesele demontate apar transparente (fantomă)
view.setAssemblyVisible(assemblyId, bool)
view.setXray(bool)                 // bloc/chiulasă/capace semitransparente
view.setExplode(t /* 0..1 */)
view.isolate(partIds|null)
view.focus(partId) ; view.resetCamera()
view.setLabels('none'|'selected'|'all')
view.showLeak(partId, fluid) ; view.clearLeaks()    // picături animate (ulei maro/negru, lichid răcire roz/albastru, aer = particule albe)
view.playToolAnimation(partId, toolId, kind /* 'loosen'|'tighten'|'other' */) : Promise  // sculă procedurală care se rotește
view.setRunning(bool, { rpm = 800, misfireCylinder = 0, roughness = 0 } = {})  // arbore cotit, biele, pistoane, came animate + vibrație
view.setTheme('dark'|'light')
view.getPartIds()
view.dispose()
```
Evenimente emise: `view:pick` `{ partId }` (click fără drag; partId null pe fundal), `view:hover` `{ partId|null }`, `view:ready`.
Fiecare Mesh are `userData.partId`. Pentru piese fără model `.glb` se construiește geometrie procedurală; ID necunoscut → cutie generică.
Dacă `part.model` e setat, se încearcă `GLTFLoader` (`data/<model>`), cu revenire la procedural la eroare.

## 6. Evenimente globale (EventBus)
| eveniment | payload | emițător |
|---|---|---|
| view:ready / view:pick / view:hover | vezi §5 | 3D |
| sim:op | { action, target, result } | SIM |
| sim:changed | { } | SIM |
| sim:log | { level, message, time } | SIM, UI |
| tool:active | { toolId } | SIM |
| ui:select | { partId } | UI |
| lesson:progress | { lessonId, stepIndex, total, done } | UI |
| mode:changed | { mode } | UI |

## 7. Moduri de joc (UI) — `js/modes/`
`free` (enforce false, fără obiective), `guided` (lecții, indicii `setHint`), `exam` (enforce, fără indicii, scor din stats),
`diagnosis` (defect aleator, sunet, teste, diagnostic), `assembly` (preset demontat + cronometru, reasamblare), `workshop`
(buget, cumpărare scule — doar sculele deținute pot fi activate, piese noi costă `cost`, manopera `laborMin`).
