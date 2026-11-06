/**
 * Validarea datelor (contract §4, ultimul paragraf): câmpuri obligatorii, ID-uri unice, referințe încrucișate
 * (mountsOn, blockedBy, connectors.between, tools, specRef, tests, lessons.target, faults), cicluri în mountsOn
 * și în graful de blocaje, statusul specificațiilor.
 *
 *   validateData(data, { contractIds = 'auto' }) -> { errors: string[], warnings: string[] }
 *
 * `contractIds`: true = verifică și lista de ID-uri obligatorii din contract (ca avertismente);
 * 'auto' = doar dacă setul de date pare complet (≥ 30 de piese); false = niciodată.
 */
import { extractLists } from '../sim/model.js';

const ACCURACY = ['aproximativ', 'schematic'];
const FLUIDS = ['ulei', 'lichid_racire', 'aer', 'gaze_evacuare', 'combustibil'];
const TOOL_CATEGORIES = ['socket', 'ratchet', 'torque', 'angle', 'screwdriver', 'pliers', 'wrench', 'special', 'measure', 'diagnostic', 'fluid', 'hand'];
const SPEC_TYPES = ['torque', 'sequence', 'dimension', 'pressure', 'volume', 'interval', 'timing', 'info'];
const SPEC_STATUS = ['VERIFICATĂ', 'NEVERIFICATĂ'];
const STEP_TYPES = ['info', 'identify', 'demo', 'tool', 'action', 'quiz'];
const ACTIONS = ['disconnect', 'connect', 'loosen', 'remove', 'install', 'install_new', 'tighten', 'flag_on', 'flag_off', 'inspect', 'measure', 'test', 'final_check'];
const DEMOS = ['explode', 'xray', 'isolate', 'remove_install', 'run'];
const LESSON_STATUS = ['disponibilă', 'planificată'];

const range = (prefix, n) => Array.from({ length: n }, (_, i) => `${prefix}_${i + 1}`);
export const CONTRACT_IDS = {
  parts: [
    'bloc_motor', 'arbore_cotit', ...range('biela', 4), ...range('piston', 4), ...range('segmenti', 4), 'arbori_echilibrare',
    'garnitura_chiulasa', 'chiulasa', 'ax_came_admisie', 'ax_came_evacuare', 'ax_excentric', 'valvetronic_servomotor', 'culbutori_tacheti',
    'arcuri_supape', 'supape_admisie', 'supape_evacuare', 'garnitura_capac_chiulasa', 'capac_chiulasa', 'capac_motor_acustic',
    'lant_distributie', 'pinion_arbore_cotit', 'vanos_admisie', 'vanos_evacuare', 'intinzator_lant', 'sina_intinzator', 'sina_ghidare',
    'electrovalva_vanos_admisie', 'electrovalva_vanos_evacuare',
    'etansare_baie_ulei', 'baie_ulei', 'buson_golire_ulei', 'senzor_nivel_ulei', 'pompa_ulei', 'sorb_ulei', 'carcasa_filtru_ulei', 'filtru_ulei',
    'racitor_ulei', 'senzor_presiune_ulei',
    'pompa_apa', 'termostat', 'conducte_racire', 'senzor_temperatura_lichid',
    'garnitura_turbo', 'turbocompresor', 'actuator_wastegate', 'sonda_lambda', 'conducta_aer_turbo', 'intercooler', 'conducta_turbo_intercooler',
    'conducta_intercooler_admisie',
    'garnitura_galerie_admisie', 'galerie_admisie', 'clapeta_acceleratie', 'senzor_presiune_admisie',
    'pompa_inalta_presiune', 'conducta_inalta_presiune', 'rampa_combustibil', ...range('injector', 4),
    ...range('bobina', 4), ...range('bujie', 4), 'senzor_arbore_cotit', 'senzor_ax_came_admisie', 'senzor_ax_came_evacuare', 'cablaj_motor',
    'curea_accesorii', 'intinzator_curea', 'amortizor_vibratii', 'alternator', 'compresor_ac', 'volanta', 'suport_motor_stanga', 'suport_motor_dreapta'
  ],
  connectors: [
    ...range('conector_bobina', 4), ...range('conector_injector', 4), 'conector_senzor_ax_came_admisie', 'conector_senzor_ax_came_evacuare',
    'conector_senzor_arbore_cotit', 'conector_senzor_presiune_ulei', 'conector_senzor_nivel_ulei', 'conector_senzor_temperatura',
    'conector_senzor_presiune_admisie', 'conector_clapeta', 'conector_valvetronic', 'conector_electrovalva_vanos_admisie',
    'conector_electrovalva_vanos_evacuare', 'conector_alternator', 'conector_sonda_lambda', 'conector_wastegate', 'conector_pompa_inalta_presiune'
  ],
  flags: ['baterie_deconectata', 'motor_rece', 'combustibil_depresurizat', 'ulei_golit', 'lichid_racire_golit', 'distributie_blocata'],
  tools: [
    'clichet_1_4', 'clichet_3_8', 'clichet_1_2', 'tubulara_10', 'tubulara_13', 'tubulara_16', 'tubulara_e8', 'tubulara_e10', 'tubulara_e12',
    'tubulara_e14', 'tubulara_e18', 'cheie_torx_t30', 'cheie_torx_t40', 'cheie_bujii', 'cheie_filtru_ulei', 'cheie_dinamometrica_mica',
    'cheie_dinamometrica', 'cheie_dinamometrica_mare', 'unghiometru', 'surubelnita_plata', 'clesti_coliere', 'clesti_patent',
    'scula_blocare_ax_came', 'scula_blocare_volanta', 'extractor_amortizor', 'micrometru', 'alezometru', 'rigla_lera', 'lera', 'comparator',
    'sublar', 'tester_compresie', 'tester_pierderi_presiune', 'multimetru', 'tester_presiune_racire', 'endoscop', 'tava_scurgere',
    'palnie_umplere', 'manometru_ulei'
  ],
  tests: ['test_compresie', 'test_pierderi_presiune', 'test_presiune_ulei', 'test_etanseitate_racire', 'test_bobine', 'test_endoscop', 'test_joc_turbo'],
  lessons: ['L_A', 'L_B', 'L_M1', 'L_C']
};

const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);
const isNum = (x) => typeof x === 'number' && Number.isFinite(x);

export function validateData(data, { contractIds = 'auto' } = {}) {
  const errors = [];
  const warnings = [];
  const E = (m) => errors.push(m);
  const W = (m) => warnings.push(m);

  if (!isObj(data)) return { errors: ['Datele lipsesc sau nu sunt un obiect.'], warnings };
  const L = extractLists(data);

  /* ---------- indexuri + unicitate ---------- */
  const index = (list, kind) => {
    const m = new Map();
    list.forEach((x, i) => {
      if (!isObj(x)) { E(`${kind}[${i}]: element invalid (nu este obiect).`); return; }
      if (typeof x.id !== 'string' || !x.id) { E(`${kind}[${i}]: lipsește „id”.`); return; }
      if (m.has(x.id)) E(`${kind}: ID duplicat „${x.id}”.`);
      else m.set(x.id, x);
    });
    return m;
  };
  if (!L.parts.length) E('parts.json: lista „parts” lipsește sau este goală.');
  const parts = index(L.parts, 'parts');
  const assemblies = index(L.assemblies, 'assemblies');
  const connectors = index(L.connectors, 'connectors');
  const flags = index(L.flags, 'flags');
  const tools = index(L.tools, 'tools');
  const specs = index(L.specs, 'specs');
  const tests = index(L.tests, 'tests');
  const faults = index(L.faults, 'faults');
  const lessons = index(L.lessons, 'lessons');

  const refPart = (ctx, id) => { if (!parts.has(id)) E(`${ctx}: piesă inexistentă „${id}”.`); };
  const refTool = (ctx, id) => { if (!tools.has(id)) E(`${ctx}: sculă inexistentă „${id}”.`); };
  const refFlag = (ctx, id) => { if (!flags.has(id)) E(`${ctx}: flag inexistent „${id}”.`); };
  const refSpec = (ctx, id, type = null) => {
    const s = specs.get(id);
    if (!s) { E(`${ctx}: specificație inexistentă „${id}”.`); return; }
    if (type && s.type !== type) W(`${ctx}: specificația „${id}” are tipul „${s.type}”, așteptat „${type}”.`);
  };
  const checkReq = (ctx, r) => {
    if (r == null) return;
    if (!isObj(r)) { E(`${ctx}: trebuie să fie obiect { removed, installed, flags }.`); return; }
    for (const k of ['removed', 'installed']) {
      if (r[k] == null) continue;
      if (!Array.isArray(r[k])) E(`${ctx}.${k}: trebuie să fie listă.`);
      else r[k].forEach((p) => refPart(`${ctx}.${k}`, p));
    }
    if (r.flags != null) {
      if (!isObj(r.flags)) E(`${ctx}.flags: trebuie să fie obiect.`);
      else Object.keys(r.flags).forEach((f) => refFlag(`${ctx}.flags`, f));
    }
  };
  const checkFlagMap = (ctx, m) => {
    if (m == null) return;
    if (!isObj(m)) { E(`${ctx}: trebuie să fie obiect { flagId: boolean }.`); return; }
    for (const [f, v] of Object.entries(m)) {
      refFlag(ctx, f);
      if (typeof v !== 'boolean') W(`${ctx}.${f}: valoarea ar trebui să fie boolean.`);
    }
  };

  /* ---------- piese ---------- */
  for (const p of parts.values()) {
    const ctx = `piesa „${p.id}”`;
    if (!p.name) E(`${ctx}: lipsește „name”.`);
    if (!p.assembly) E(`${ctx}: lipsește „assembly”.`);
    else if (assemblies.size && !assemblies.has(p.assembly)) E(`${ctx}: ansamblu inexistent „${p.assembly}”.`);
    if (!p.description) W(`${ctx}: lipsește „description”.`);
    if (!p.function) W(`${ctx}: lipsește „function”.`);
    if (p.accuracy != null && !ACCURACY.includes(p.accuracy)) W(`${ctx}: „accuracy” trebuie să fie ${ACCURACY.join(' | ')}.`);
    if (p.accuracy == null) W(`${ctx}: lipsește „accuracy”.`);
    if (p.mountsOn != null && !Array.isArray(p.mountsOn)) E(`${ctx}: „mountsOn” trebuie să fie listă.`);
    for (const m of p.mountsOn || []) { if (m === p.id) E(`${ctx}: se montează pe ea însăși.`); else refPart(`${ctx}.mountsOn`, m); }
    if (p.benchOnly && !(p.mountsOn || []).length) E(`${ctx}: piesă benchOnly fără părinte în „mountsOn”.`);
    if (p.blockedBy != null && !Array.isArray(p.blockedBy)) E(`${ctx}: „blockedBy” trebuie să fie listă.`);
    for (const b of p.blockedBy || []) { if (b === p.id) E(`${ctx}: se blochează pe ea însăși.`); else refPart(`${ctx}.blockedBy`, b); }
    checkFlagMap(`${ctx}.requiresFlags`, p.requiresFlags);
    if (p.fasteners != null) {
      const f = p.fasteners;
      if (!isObj(f)) E(`${ctx}: „fasteners” trebuie să fie obiect sau null.`);
      else {
        if (f.count != null && !(isNum(f.count) && f.count >= 0)) E(`${ctx}.fasteners.count: număr invalid.`);
        if (!Array.isArray(f.tools)) E(`${ctx}.fasteners.tools: trebuie să fie listă.`);
        else {
          if (!f.tools.length && f.count > 0) W(`${ctx}.fasteners.tools: listă goală (slăbire fără sculă).`);
          f.tools.forEach((t) => refTool(`${ctx}.fasteners.tools`, t));
        }
        if (f.torqueSpec) refSpec(`${ctx}.fasteners.torqueSpec`, f.torqueSpec, 'torque');
        if (f.sequenceSpec) {
          refSpec(`${ctx}.fasteners.sequenceSpec`, f.sequenceSpec, 'sequence');
          const s = specs.get(f.sequenceSpec);
          if (s && Array.isArray(s.order) && isNum(f.count)) {
            if (s.order.some((i) => !Number.isInteger(i) || i < 1 || i > f.count)) E(`${ctx}: ordinea din „${f.sequenceSpec}” conține indici în afara 1…${f.count}.`);
            if (s.order.length !== f.count) W(`${ctx}: ordinea din „${f.sequenceSpec}” are ${s.order.length} poziții, dar piesa are ${f.count} elemente de fixare.`);
          }
        }
        if (f.size && !f.sizeStatus) W(`${ctx}.fasteners: lipsește „sizeStatus” (ex. „NEVERIFICATĂ”).`);
      }
    }
    if (p.removeTools != null && !Array.isArray(p.removeTools)) E(`${ctx}: „removeTools” trebuie să fie listă.`);
    for (const t of p.removeTools || []) refTool(`${ctx}.removeTools`, t);
    if (p.sealsFluid != null && !FLUIDS.includes(p.sealsFluid)) E(`${ctx}: „sealsFluid” invalid „${p.sealsFluid}” (permis: ${FLUIDS.join(', ')} sau null).`);
    if (p.removalDir != null && !(Array.isArray(p.removalDir) && p.removalDir.length === 3 && p.removalDir.every(isNum))) W(`${ctx}: „removalDir” trebuie să fie [x, y, z].`);
    if (p.removalDir == null) W(`${ctx}: lipsește „removalDir”.`);
    for (const k of ['cost', 'laborMin']) if (p[k] != null && !isNum(p[k])) W(`${ctx}: „${k}” trebuie să fie număr.`);
    if (p.model != null && typeof p.model !== 'string') W(`${ctx}: „model” trebuie să fie șir sau null.`);
    const seenInsp = new Set();
    for (const i of p.inspections || []) {
      if (!i?.id || !i?.name) E(`${ctx}.inspections: fiecare inspecție are nevoie de „id” și „name”.`);
      else if (seenInsp.has(i.id)) E(`${ctx}.inspections: ID duplicat „${i.id}”.`);
      else seenInsp.add(i.id);
    }
    const seenMeas = new Set();
    for (const m of p.measurements || []) {
      if (!m?.id || !m?.name) { E(`${ctx}.measurements: fiecare măsurătoare are nevoie de „id” și „name”.`); continue; }
      if (seenMeas.has(m.id)) E(`${ctx}.measurements: ID duplicat „${m.id}”.`);
      seenMeas.add(m.id);
      if (m.tool) [].concat(m.tool).forEach((t) => refTool(`${ctx}.measurements.${m.id}.tool`, t));
      if (m.specRef) refSpec(`${ctx}.measurements.${m.id}.specRef`, m.specRef);
      else W(`${ctx}.measurements.${m.id}: fără „specRef” (valoarea nu poate fi comparată).`);
      if (m.requires) checkReq(`${ctx}.measurements.${m.id}.requires`, m.requires);
    }
  }

  /* ---------- cicluri: mountsOn și graful de blocaje ---------- */
  const findCycle = (edges) => {
    const color = new Map();
    const stack = [];
    let found = null;
    const dfs = (u) => {
      color.set(u, 1); stack.push(u);
      for (const v of edges(u)) {
        if (found) return;
        if (color.get(v) === 1) { found = [...stack.slice(stack.indexOf(v)), v]; return; }
        if (!color.get(v)) dfs(v);
      }
      stack.pop(); color.set(u, 2);
    };
    for (const id of parts.keys()) { if (!color.get(id) && !found) dfs(id); }
    return found;
  };
  const mountCycle = findCycle((id) => (parts.get(id).mountsOn || []).filter((x) => parts.has(x)));
  if (mountCycle) E(`Ciclu în „mountsOn”: ${mountCycle.join(' → ')}.`);
  else {
    const children = new Map([...parts.keys()].map((id) => [id, []]));
    for (const p of parts.values()) for (const m of p.mountsOn || []) if (children.has(m)) children.get(m).push(p.id);
    // „X blocat de Y” = Y trebuie scos înaintea lui X
    const blockEdges = (id) => {
      const p = parts.get(id);
      const out = (p.blockedBy || []).filter((x) => parts.has(x));
      for (const c of children.get(id)) if (!parts.get(c).benchOnly) out.push(c);
      return out;
    };
    const blockCycle = findCycle(blockEdges);
    if (blockCycle) E(`Blocaj circular (piesele nu pot fi demontate niciodată): ${blockCycle.join(' → ')}.`);
  }

  /* ---------- conectori ---------- */
  for (const c of connectors.values()) {
    const ctx = `conectorul „${c.id}”`;
    if (!c.name) E(`${ctx}: lipsește „name”.`);
    if (!Array.isArray(c.between) || c.between.length < 2) E(`${ctx}: „between” trebuie să conțină cel puțin 2 piese.`);
    else {
      c.between.forEach((p) => refPart(`${ctx}.between`, p));
      if (parts.has('cablaj_motor') && !c.between.includes('cablaj_motor')) W(`${ctx}: „between” nu include „cablaj_motor”.`);
    }
    checkFlagMap(`${ctx}.requiresFlags`, c.requiresFlags);
  }

  /* ---------- flaguri ---------- */
  for (const f of flags.values()) {
    const ctx = `flagul „${f.id}”`;
    if (!f.name) E(`${ctx}: lipsește „name”.`);
    if (typeof f.default !== 'boolean') W(`${ctx}: „default” ar trebui să fie boolean.`);
    if (!f.onLabel || !f.offLabel) W(`${ctx}: lipsesc „onLabel”/„offLabel”.`);
    for (const k of ['toolsOn', 'toolsOff']) {
      if (f[k] == null) continue;
      if (!Array.isArray(f[k])) E(`${ctx}.${k}: trebuie să fie listă.`);
      else f[k].forEach((t) => refTool(`${ctx}.${k}`, t));
    }
    checkReq(`${ctx}.requiresOn`, f.requiresOn);
    checkReq(`${ctx}.requiresOff`, f.requiresOff);
    if (f.mustBeOffToStart != null && typeof f.mustBeOffToStart !== 'boolean') W(`${ctx}: „mustBeOffToStart” ar trebui să fie boolean.`);
  }
  if (flags.has('motor_rece') && flags.get('motor_rece').default !== false) W('flagul „motor_rece”: „default” trebuie să fie false (contract).');
  if (flags.has('distributie_blocata') && flags.get('distributie_blocata').mustBeOffToStart !== true) W('flagul „distributie_blocata”: „mustBeOffToStart” trebuie să fie true.');

  /* ---------- scule ---------- */
  for (const t of tools.values()) {
    const ctx = `scula „${t.id}”`;
    if (!t.name) E(`${ctx}: lipsește „name”.`);
    if (!TOOL_CATEGORIES.includes(t.category)) W(`${ctx}: categorie necunoscută „${t.category}”.`);
    if (t.category === 'torque' && !(Array.isArray(t.range) && t.range.length === 2 && t.range.every(isNum) && t.range[0] < t.range[1])) E(`${ctx}: cheia dinamometrică are nevoie de „range”: [min, max].`);
    if (t.bmwCode != null && t.bmwCodeStatus !== 'VERIFICAT') W(`${ctx}: cod BMW „${t.bmwCode}” fără sursă verificată — folosiți "bmwCode": null, "bmwCodeStatus": "NEVERIFICAT".`);
    if (t.price != null && !isNum(t.price)) W(`${ctx}: „price” trebuie să fie număr.`);
  }

  /* ---------- specificații ---------- */
  for (const s of specs.values()) {
    const ctx = `specificația „${s.id}”`;
    if (!s.name) E(`${ctx}: lipsește „name”.`);
    if (!SPEC_TYPES.includes(s.type)) E(`${ctx}: tip invalid „${s.type}”.`);
    if (!SPEC_STATUS.includes(s.status)) E(`${ctx}: „status” trebuie să fie „VERIFICATĂ” sau „NEVERIFICATĂ” (este „${s.status}”).`);
    if (s.status === 'VERIFICATĂ') {
      const src = s.source || {};
      if (!src.document) E(`${ctx}: marcată VERIFICATĂ fără document sursă.`);
      if (src.section == null && src.page == null) E(`${ctx}: marcată VERIFICATĂ fără secțiune/pagină.`);
      if (s.demo) E(`${ctx}: o valoare demonstrativă nu poate fi VERIFICATĂ.`);
      if (!s.variant || s.variant === 'demo') E(`${ctx}: marcată VERIFICATĂ fără variantă de motor.`);
    }
    if (s.status === 'NEVERIFICATĂ' && s.demo == null) W(`${ctx}: NEVERIFICATĂ fără câmpul „demo”.`);
    if (s.type === 'torque' && !isNum(s.value)) E(`${ctx}: cuplul are nevoie de „value” numeric.`);
    if (s.type === 'sequence' && !(Array.isArray(s.order) && s.order.length)) E(`${ctx}: o ordine de strângere are nevoie de „order”: [indici].`);
    if (isNum(s.min) && isNum(s.max) && s.min > s.max) E(`${ctx}: min (${s.min}) > max (${s.max}).`);
    if (isNum(s.value) && isNum(s.min) && isNum(s.max) && (s.value < s.min || s.value > s.max)) W(`${ctx}: valoarea nominală ${s.value} este în afara [${s.min}, ${s.max}].`);
    if (s.angle != null && !isNum(s.angle)) E(`${ctx}: „angle” trebuie să fie număr sau null.`);
  }

  /* ---------- teste ---------- */
  for (const t of tests.values()) {
    const ctx = `testul „${t.id}”`;
    if (!t.name) E(`${ctx}: lipsește „name”.`);
    if (t.tool) refTool(`${ctx}.tool`, t.tool);
    if (t.specRef) refSpec(`${ctx}.specRef`, t.specRef);
    if (t.variants != null && !Array.isArray(t.variants)) E(`${ctx}: „variants” trebuie să fie listă.`);
    checkReq(`${ctx}.requires`, t.requires);
  }

  /* ---------- defecte ---------- */
  for (const f of faults.values()) {
    const ctx = `defectul „${f.id}”`;
    if (!f.title) E(`${ctx}: lipsește „title”.`);
    if (!Array.isArray(f.rootCauseParts) || !f.rootCauseParts.length) E(`${ctx}: „rootCauseParts” lipsește sau e gol.`);
    else f.rootCauseParts.forEach((p) => refPart(`${ctx}.rootCauseParts`, p));
    for (const p of Object.keys(f.partStates || {})) refPart(`${ctx}.partStates`, p);
    for (const [tid, val] of Object.entries(f.tests || {})) {
      const t = tests.get(tid);
      if (!t) { E(`${ctx}.tests: test inexistent „${tid}”.`); continue; }
      const variants = Array.isArray(t.variants) ? t.variants : [];
      const checkVals = (c2, v) => {
        if (t.perCylinder && Array.isArray(v) && v.length !== 4) W(`${c2}: test pe cilindri cu ${v.length} valori (așteptat 4).`);
        if (Array.isArray(v) ? !v.every(isNum) : !isNum(v)) E(`${c2}: valori numerice așteptate.`);
      };
      if (isObj(val)) {
        for (const [vk, vv] of Object.entries(val)) {
          if (variants.length && !variants.includes(vk) && vk !== 'default') W(`${ctx}.tests.${tid}: variantă necunoscută „${vk}”.`);
          checkVals(`${ctx}.tests.${tid}.${vk}`, vv);
        }
      } else checkVals(`${ctx}.tests.${tid}`, val);
    }
    for (const [key, v] of Object.entries(f.measurements || {})) {
      const dot = key.indexOf('.');
      const pid = dot >= 0 ? key.slice(0, dot) : key;
      const mid = dot >= 0 ? key.slice(dot + 1) : '';
      const p = parts.get(pid);
      if (!p) E(`${ctx}.measurements: piesă inexistentă în „${key}”.`);
      else if (!(p.measurements || []).some((m) => m.id === mid)) E(`${ctx}.measurements: piesa „${pid}” nu are măsurătoarea „${mid}”.`);
      if (!isNum(v)) E(`${ctx}.measurements.${key}: valoare numerică așteptată.`);
    }
    if (f.sound != null) {
      if (!isObj(f.sound)) E(`${ctx}.sound: trebuie să fie obiect.`);
      else for (const k of ['misfireCylinder', 'roughness', 'chainRattle', 'turboWhistle', 'knock', 'hiss']) if (f.sound[k] != null && !isNum(f.sound[k])) W(`${ctx}.sound.${k}: număr așteptat.`);
    }
    for (const l of f.leaks || []) { refPart(`${ctx}.leaks`, l?.partId); if (!FLUIDS.includes(l?.fluid)) W(`${ctx}.leaks: fluid invalid „${l?.fluid}”.`); }
    if (!f.valuesNote) W(`${ctx}: lipsește „valuesNote” (valorile sunt simulate, NEVERIFICATE).`);
  }

  /* ---------- lecții ---------- */
  const checkQuiz = (ctx, qz) => {
    if (!qz.question) E(`${ctx}: lipsește „question”.`);
    if (!Array.isArray(qz.options) || qz.options.length < 2) E(`${ctx}: „options” trebuie să aibă cel puțin 2 variante.`);
    else if (!(Number.isInteger(qz.answer) && qz.answer >= 0 && qz.answer < qz.options.length)) E(`${ctx}: „answer” (${qz.answer}) în afara opțiunilor.`);
  };
  for (const l of lessons.values()) {
    const ctx = `lecția „${l.id}”`;
    if (!l.title) E(`${ctx}: lipsește „title”.`);
    if (l.status && !LESSON_STATUS.includes(l.status)) W(`${ctx}: status necunoscut „${l.status}”.`);
    if (l.initialState != null) {
      if (!isObj(l.initialState)) E(`${ctx}.initialState: trebuie să fie obiect sau null.`);
      else {
        (l.initialState.removed || []).forEach((p) => refPart(`${ctx}.initialState.removed`, p));
        checkFlagMap(`${ctx}.initialState.flags`, l.initialState.flags);
      }
    }
    if (!Array.isArray(l.steps)) { E(`${ctx}: „steps” trebuie să fie listă.`); continue; }
    if (l.status === 'disponibilă' && !l.steps.length) E(`${ctx}: lecție disponibilă fără pași.`);
    const stepIds = new Set();
    l.steps.forEach((s, i) => {
      const sc = `${ctx}, pasul ${s?.id ?? i + 1}`;
      if (!isObj(s)) { E(`${sc}: pas invalid.`); return; }
      if (!s.id) E(`${sc}: lipsește „id”.`);
      else if (stepIds.has(s.id)) E(`${ctx}: ID de pas duplicat „${s.id}”.`);
      else stepIds.add(s.id);
      if (!STEP_TYPES.includes(s.type)) { E(`${sc}: tip necunoscut „${s.type}”.`); return; }
      if (s.focus) refPart(`${sc}.focus`, s.focus);
      if (s.type === 'identify') refPart(`${sc}.target`, s.target);
      if (s.type === 'demo') {
        if (!DEMOS.includes(s.demo)) W(`${sc}: demo necunoscut „${s.demo}”.`);
        if (s.target != null) refPart(`${sc}.target`, s.target);
      }
      if (s.type === 'tool') refTool(`${sc}.tool`, s.tool);
      if (s.type === 'quiz') checkQuiz(sc, s);
      if (s.type === 'action') {
        if (!ACTIONS.includes(s.action)) { E(`${sc}: acțiune necunoscută „${s.action}”.`); return; }
        const t = s.target;
        switch (s.action) {
          case 'connect': case 'disconnect': if (!connectors.has(t)) E(`${sc}: conector inexistent „${t}”.`); break;
          case 'flag_on': case 'flag_off': refFlag(`${sc}.target`, t); break;
          case 'test': if (!tests.has(t)) E(`${sc}: test inexistent „${t}”.`); break;
          case 'measure': {
            const str = String(t ?? '');
            const dot = str.indexOf('.');
            const p = parts.get(dot >= 0 ? str.slice(0, dot) : str);
            if (!p) E(`${sc}: piesă inexistentă în ținta „${t}”.`);
            else if (!(p.measurements || []).some((m) => m.id === str.slice(dot + 1))) E(`${sc}: măsurătoare inexistentă „${t}”.`);
            break;
          }
          case 'final_check': if (t != null) W(`${sc}: „final_check” are target null.`); break;
          default: refPart(`${sc}.target`, t);
        }
        if (s.params?.toolId) refTool(`${sc}.params.toolId`, s.params.toolId);
      }
    });
    (l.finalTest || []).forEach((qz, i) => checkQuiz(`${ctx}, testul final #${i + 1}`, qz));
  }

  /* ---------- variante ---------- */
  if (L.variants) {
    const vs = Array.isArray(L.variants.variants) ? L.variants.variants : [];
    if (!vs.length) W('variants.json: lista „variants” este goală.');
    if (L.variants.selected && !vs.some((v) => v?.id === L.variants.selected)) E(`variants.json: varianta selectată „${L.variants.selected}” nu există.`);
  }

  /* ---------- ID-uri obligatorii din contract ---------- */
  const doContract = contractIds === true || (contractIds === 'auto' && parts.size >= 30);
  if (doContract) {
    const miss = (kind, map, ids) => { const m = ids.filter((id) => !map.has(id)); if (m.length) W(`ID-uri obligatorii lipsă în ${kind}: ${m.join(', ')}.`); };
    miss('parts', parts, CONTRACT_IDS.parts);
    miss('connectors', connectors, CONTRACT_IDS.connectors);
    miss('flags', flags, CONTRACT_IDS.flags);
    miss('tools', tools, CONTRACT_IDS.tools);
    miss('tests', tests, CONTRACT_IDS.tests);
    miss('lessons', lessons, CONTRACT_IDS.lessons);
    if (faults.size < 8) W(`faults.json: ${faults.size} scenarii (minim 8 cerute).`);
  }

  return { errors, warnings };
}

export default validateData;
