// Test „date reale”: încarcă data/*.json (dacă există), rulează validateData și execută lecțiile disponibile
// (în special L_M1) prin Simulator. Problemele de date se raportează ca diagnostic (nu pică suita),
// cu excepția cazului STRICT_DATA=1, când erorile de validare și pașii eșuați fac testul să pice.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Simulator } from '../js/sim/Simulator.js';
import { validateData } from '../js/core/validateData.js';

const FILES = ['parts', 'flags', 'tools', 'specs', 'tests', 'faults', 'lessons', 'variants'];
const dataDir = fileURLToPath(new URL('../data/', import.meta.url));
const missing = FILES.filter((f) => !existsSync(`${dataDir}${f}.json`));
const STRICT = process.env.STRICT_DATA === '1';

function loadReal() {
  const data = {};
  for (const f of FILES) data[f] = JSON.parse(readFileSync(`${dataDir}${f}.json`, 'utf8'));
  return data;
}

/** Completează parametrii lipsă ai unui pas „tighten” din specificații (valoare, unghi, ordine, cheie). */
function tightenParams(sim, partId, params = {}) {
  const p = sim.getPart(partId);
  const f = p?.fasteners;
  const spec = f?.torqueSpec ? sim.getSpec(f.torqueSpec) : null;
  const seq = f?.sequenceSpec ? sim.getSpec(f.sequenceSpec) : null;
  const out = { ...params };
  if (out.torque == null && spec) out.torque = spec.value;
  if (out.angle == null && spec?.angle != null) out.angle = spec.angle;
  if (out.order == null && Array.isArray(seq?.order)) out.order = seq.order;
  let toolId = out.toolId ?? sim.activeTool;
  const tool = toolId ? sim.getTool(toolId) : null;
  const fits = (t) => t?.category === 'torque' && (!Array.isArray(t.range) || out.torque == null || (out.torque >= t.range[0] && out.torque <= t.range[1]));
  if (spec && !fits(tool)) {
    const alt = (sim.data.tools?.tools || []).find(fits);
    if (alt) { toolId = alt.id; out._autoTool = alt.id; }
  }
  out.toolId = toolId;
  return out;
}

/** Execută pașii unei lecții; întoarce lista pașilor eșuați. */
export function runLesson(sim, lesson) {
  const failures = [];
  sim.reset();
  if (lesson.initialState) sim.applyPreset(lesson.initialState);
  for (const step of lesson.steps || []) {
    if (step.type === 'tool') {
      const r = sim.setActiveTool(step.tool);
      if (!r.ok) failures.push({ step: step.id, type: 'tool', target: step.tool, code: r.code, message: r.message });
      continue;
    }
    if (step.type !== 'action') continue;
    let params = step.params || {};
    if (step.action === 'tighten') params = tightenParams(sim, step.target, params);
    const r = sim.perform(step.action, step.target, params);
    const okFinal = step.action === 'final_check' ? r.data?.startable && !r.data?.issues?.length : r.ok;
    if (!okFinal) failures.push({ step: step.id, action: step.action, target: step.target, code: r.code, message: r.message, reasons: r.reasons });
    else if (params._autoTool) failures.push({ step: step.id, action: step.action, target: step.target, code: 'INFO_AUTO_TOOL', message: `Pasul nu are sculă dinamometrică activă; testul a folosit automat „${params._autoTool}”.` });
  }
  return failures;
}

test('date reale: validateData', { skip: missing.length ? `lipsesc fișierele: ${missing.join(', ')}` : false }, (t) => {
  const { errors, warnings } = validateData(loadReal());
  t.diagnostic(`validateData: ${errors.length} erori, ${warnings.length} avertismente`);
  for (const e of errors.slice(0, 40)) t.diagnostic(`EROARE: ${e}`);
  for (const w of warnings.slice(0, 20)) t.diagnostic(`avertisment: ${w}`);
  if (STRICT) assert.deepEqual(errors, []);
});

test('date reale: stare inițială coerentă (finalCheck fără probleme)', { skip: missing.length ? 'lipsesc fișierele de date' : false }, (t) => {
  const sim = new Simulator(loadReal(), null, { seed: 1 });
  const r = sim.finalCheck();
  for (const m of r.reasons) t.diagnostic(`problemă la starea inițială: ${m}`);
  assert.equal(r.data.startable, true, r.reasons.join('\n'));
});

test('date reale: lecția L_M1 executată prin Simulator', { skip: missing.length ? 'lipsesc fișierele de date' : false }, (t) => {
  const data = loadReal();
  const lesson = (data.lessons?.lessons || []).find((l) => l.id === 'L_M1');
  if (!lesson) { t.diagnostic('L_M1 lipsește din lessons.json'); if (STRICT) assert.fail('L_M1 lipsește'); return; }
  const sim = new Simulator(data, null, { seed: 1, enforce: true });
  const failures = runLesson(sim, lesson);
  const real = failures.filter((f) => f.code !== 'INFO_AUTO_TOOL');
  t.diagnostic(`L_M1: ${(lesson.steps || []).length} pași, ${real.length} eșuați, greșeli numărate: ${sim.stats.errors}`);
  for (const f of failures) t.diagnostic(`pas ${f.step} (${f.action ?? f.type} ${f.target ?? ''}) → ${f.code}: ${f.message}${f.reasons?.length ? ' | ' + f.reasons.join(' ') : ''}`);
  if (STRICT) assert.deepEqual(real, []);
});

test('date reale: celelalte lecții disponibile (raport)', { skip: missing.length ? 'lipsesc fișierele de date' : false }, (t) => {
  const data = loadReal();
  for (const lesson of (data.lessons?.lessons || []).filter((l) => l.status === 'disponibilă' && l.id !== 'L_M1')) {
    const sim = new Simulator(data, null, { seed: 1, enforce: true });
    const failures = runLesson(sim, lesson).filter((f) => f.code !== 'INFO_AUTO_TOOL');
    t.diagnostic(`${lesson.id}: ${failures.length} pași eșuați`);
    for (const f of failures) t.diagnostic(`  ${lesson.id}/${f.step} (${f.action ?? f.type} ${f.target ?? ''}) → ${f.code}: ${f.message}`);
  }
});

test('date reale: fiecare defect se încarcă și dă valori la teste', { skip: missing.length ? 'lipsesc fișierele de date' : false }, (t) => {
  const data = loadReal();
  const sim = new Simulator(data, null, { seed: 1, enforce: false });
  for (const f of data.faults?.faults || []) {
    sim.reset();
    const r = sim.loadFault(f.id);
    assert.equal(r.ok, true, `${f.id}: ${r.message}`);
    const fc = sim.finalCheck().data;
    t.diagnostic(`${f.id}: issues=${fc.issues.length}, sound=${JSON.stringify(fc.sound)}`);
  }
});
