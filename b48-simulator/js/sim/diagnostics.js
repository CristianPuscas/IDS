/**
 * Diagnostic: inspecții, măsurători, teste la nivel de motor, defecte (faults) și evaluarea diagnosticului.
 * Valori: din defectul activ dacă e definită (și nereparată), altfel nominal + zgomot determinist în [min, max].
 */
import { T, q, list, num, range, specWarning, fastenerWords } from './messages.js';
import { okResult, failResult, fromProblems } from './result.js';
import { isOnEngine, partName, toolProblem, requirementReasons } from './rules.js';
import { noise01 } from './rng.js';
import { normalizeRequirements } from './model.js';

/* ---------- defecte ---------- */

export function activeFaultDef(sim) {
  return sim.state.activeFault ? sim.db.faults.get(sim.state.activeFault) || null : null;
}

/** Defect reparat = fiecare piesă cauză a fost înlocuită cu piesă nouă (sau, la defecte de montaj, strânsă corect). */
export function faultRepaired(sim) {
  const f = activeFaultDef(sim);
  if (!f) return true;
  const roots = Object.keys(sim.state.faultProgress);
  return roots.length > 0 && roots.every((pid) => sim.state.faultProgress[pid]);
}

/** Valoarea simulată a defectului se aplică doar cât timp piesa respectivă / defectul nu e reparat. */
function faultApplies(sim, partId = null) {
  const f = activeFaultDef(sim);
  if (!f) return null;
  if (partId && sim.state.faultProgress[partId]) return null;
  if (!partId && faultRepaired(sim)) return null;
  return f;
}

export function loadFault(sim, faultId) {
  // anulează efectele defectului anterior
  for (const pid of sim.state.faultParts) {
    const st = sim.state.parts[pid];
    if (st && st.damageSource === 'fault') { st.damaged = false; st.damageNote = null; st.damageSource = null; }
  }
  sim.state.faultParts = [];
  sim.state.faultProgress = {};
  sim.state.activeFault = null;
  if (faultId == null) return okResult('FAULT_CLEARED', T.faultCleared(), { data: { faultId: null } });
  const f = sim.db.faults.get(faultId);
  if (!f) return failResult('UNKNOWN', T.unknownFault(faultId));
  for (const [pid, ps] of Object.entries(f.partStates || {})) {
    const st = sim.state.parts[pid];
    if (!st || !ps) continue;
    if (ps.damaged) {
      st.damaged = true;
      st.damageNote = ps.damageNote ?? ps.finding ?? 'Defect (simulat).';
      st.damageSource = 'fault';
    }
    if (ps.torque && typeof ps.torque === 'object') st.torque = { ...(st.torque || {}), ...ps.torque };
    if (ps.fasteners === 'loose' || ps.fasteners === 'tight') st.fasteners = sim.db.parts.get(pid).fasteners ? ps.fasteners : 'none';
    sim.state.faultParts.push(pid);
  }
  sim.state.activeFault = faultId;
  for (const pid of f.rootCauseParts || []) if (sim.db.parts.has(pid)) sim.state.faultProgress[pid] = false;
  return okResult('FAULT_LOADED', T.faultLoaded(), { data: { faultId } });
}

export function diagnose(sim, partIds) {
  const f = activeFaultDef(sim);
  if (!f) return failResult('NO_FAULT', T.noFault());
  const chosen = [...new Set((partIds || []).filter(Boolean))];
  const roots = [...new Set(f.rootCauseParts || [])];
  const correct = chosen.filter((p) => roots.includes(p));
  const missed = roots.filter((p) => !chosen.includes(p));
  const wrong = chosen.filter((p) => !roots.includes(p));
  const denom = roots.length + wrong.length;
  const score = denom ? Math.round((100 * correct.length) / denom) : 0;
  const data = { correct, missed, wrong, score, faultId: f.id, title: f.title ?? null, explanation: f.explanation ?? null };
  const names = (ids) => ids.map((i) => partName(sim, i));
  const extra = f.explanation ? [f.explanation] : [];
  if (!missed.length && !wrong.length) return okResult('DIAGNOSIS_CORRECT', T.diagnoseOk(score), { reasons: extra, data });
  return failResult('DIAGNOSIS_WRONG', T.diagnosePartial(score, names(missed), names(wrong)), extra, { data });
}

/* ---------- valori simulate ---------- */

function decimalsOf(...vals) {
  let d = 0;
  for (const v of vals) {
    if (v == null || !Number.isFinite(Number(v))) continue;
    const s = String(v);
    const i = s.indexOf('.');
    if (i >= 0) d = Math.max(d, s.length - i - 1);
  }
  return Math.min(3, d + 1);
}

/** Nominal + zgomot determinist (seed + cheie), în interiorul [min, max]. */
export function nominalValue(sim, spec, key) {
  if (!spec) return null;
  const min = spec.min != null ? Number(spec.min) : null;
  const max = spec.max != null ? Number(spec.max) : null;
  let nominal = spec.value != null ? Number(spec.value) : (min != null && max != null ? (min + max) / 2 : (min ?? max));
  if (nominal == null || !Number.isFinite(nominal)) return null;
  const u = noise01(sim.seed, key) - 0.5;
  let v = nominal;
  if (min != null && max != null && max > min) {
    v = nominal + u * (max - min) * 0.3;
    const lo = min + (max - min) * 0.02, hi = max - (max - min) * 0.02;
    v = Math.min(hi, Math.max(lo, v));
  } else {
    v = nominal + u * Math.abs(nominal) * 0.01;
  }
  const d = decimalsOf(spec.value, spec.min, spec.max);
  return Math.round(v * 10 ** d) / 10 ** d;
}

export function compareSpec(spec, v) {
  if (!spec || v == null || !Number.isFinite(Number(v))) return { inTolerance: null, status: 'unknown' };
  const min = spec.min != null ? Number(spec.min) : null;
  const max = spec.max != null ? Number(spec.max) : null;
  if (min != null && v < min) return { inTolerance: false, status: 'low' };
  if (max != null && v > max) return { inTolerance: false, status: 'high' };
  return { inTolerance: true, status: 'ok' };
}

/* ---------- inspecție ---------- */

export function inspect(sim, id) {
  const p = sim.db.parts.get(id);
  if (!p) return failResult('UNKNOWN', T.unknownPart(id));
  if (p.inspectRequiresRemoved && isOnEngine(sim, id)) return failResult('REQUIREMENTS', T.inspectNeedsRemoved(p.name), [T.reqNeedRemoved(p.name)]);
  const st = sim.state.parts[id];
  const findings = (p.inspections.length ? p.inspections : [{ id: 'vizual', name: 'Inspecție vizuală', ok: 'Fără anomalii vizibile (simulat).' }])
    .map((i) => ({ id: i.id, name: i.name || i.id, text: i.ok || 'Fără anomalii (simulat).', defect: false }));
  if (st.damaged) {
    const f = faultApplies(sim, id);
    const ps = f?.partStates?.[id];
    const perInsp = ps && typeof ps.findings === 'object' && ps.findings ? ps.findings : null;
    let applied = false;
    if (perInsp) {
      for (const fi of findings) if (perInsp[fi.id]) { fi.text = perInsp[fi.id]; fi.defect = true; applied = true; }
    }
    if (!applied) { findings[0].text = st.damageNote || ps?.finding || 'Piesă deteriorată (simulat).'; findings[0].defect = true; }
  }
  if (p.singleUse && st.disturbed && !st.isNew) {
    findings.push({ id: 'refolosire', name: 'Stare garnitură', text: 'Garnitura a fost deja comprimată la montajul anterior — nu mai etanșează sigur. Se înlocuiește.', defect: true });
  }
  if (st.installed && p.fasteners) {
    const t = st.torque;
    if (st.fasteners === 'loose') findings.push({ id: 'fixare', name: 'Elemente de fixare', text: `${fastenerWords(p.fasteners).noun} ${fastenerWords(p.fasteners).detail} nu ${fastenerWords(p.fasteners).be} ${fastenerWords(p.fasteners).tightened}.`, defect: true });
    else if (t && (t.status !== 'ok' || t.sequenceOk === false)) findings.push({ id: 'fixare', name: 'Elemente de fixare', text: t.status === 'uncontrolled' ? 'Strângere fără cuplu controlat.' : t.status === 'under' ? 'Strângere sub cuplul prescris.' : t.status === 'over' ? 'Strângere excesivă — urme de deformare.' : 'Ordinea de strângere nerespectată — contact neuniform.', defect: true });
  }
  const n = findings.filter((x) => x.defect).length;
  return okResult(n ? 'DEFECT_FOUND' : 'OK', T.inspectDone(p.name, n), { reasons: findings.map((x) => `${x.name}: ${x.text}`), data: { findings } });
}

/* ---------- măsurători ---------- */

const toolList = (t) => (t == null ? [] : Array.isArray(t) ? t : [t]);

export function measure(sim, id, measurementId, toolId) {
  const p = sim.db.parts.get(id);
  if (!p) return failResult('UNKNOWN', T.unknownPart(id));
  const m = p.measurements.find((x) => x.id === measurementId);
  if (!m) return failResult('UNKNOWN', T.unknownMeasurement(p.name, measurementId));
  const problems = [];
  if (m.requiresRemoved && isOnEngine(sim, id)) problems.push({ code: 'REQUIREMENTS', message: T.measureNeedsRemoved(p.name), reasons: [T.reqNeedRemoved(p.name)] });
  if (m.requires) {
    const rs = requirementReasons(sim, normalizeRequirements(m.requires));
    if (rs.length) problems.push({ code: 'REQUIREMENTS', message: `${T.reqNotMet(m.name || m.id)} ${rs[0]}`, reasons: rs });
  }
  const tp = toolProblem(sim, toolId, toolList(m.tool));
  if (tp) problems.push(tp);
  if (problems.length) return fromProblems(problems);

  const spec = m.specRef ? sim.getSpec(m.specRef) : null;
  const key = `${id}.${measurementId}`;
  const f = faultApplies(sim, id);
  let value = f && f.measurements && key in f.measurements ? Number(f.measurements[key]) : nominalValue(sim, spec, `measure:${key}`);
  const warnings = [];
  const sw = specWarning(spec);
  if (sw) warnings.push(sw);
  if (!spec && (value == null || Number.isNaN(value))) {
    return okResult('NO_SPEC', `${q(p.name)} — ${m.name || m.id}: ${T.noSpec()}`, { warnings, data: { value: null, unit: m.unit ?? null, spec: null, inTolerance: null, status: 'unknown' } });
  }
  const unit = spec?.unit ?? m.unit ?? '';
  const cmp = compareSpec(spec, value);
  if (!spec) warnings.push(T.noSpec());
  const msg = T.measured(p.name, m.name || m.id, value, unit, cmp.inTolerance, spec);
  return okResult(cmp.inTolerance === false ? 'OUT_OF_TOLERANCE' : 'OK', msg, { warnings, data: { value, unit, spec: spec ?? null, inTolerance: cmp.inTolerance, status: cmp.status } });
}

/* ---------- teste la nivel de motor ---------- */

export function runTest(sim, testId, { toolId = null, variant = null } = {}) {
  const t = sim.db.tests.get(testId);
  if (!t) return failResult('UNKNOWN', T.unknownTest(testId));
  const problems = [];
  let v = variant;
  if (t.variants.length) {
    if (v == null) v = t.variants[0];
    else if (!t.variants.includes(v)) return failResult('REQUIREMENTS', T.testVariantInvalid(t.name, v, t.variants), [`Alege una dintre variante: ${t.variants.join(', ')}.`]);
  } else v = null;
  const rs = requirementReasons(sim, t.requires);
  if (rs.length) problems.push({ code: 'REQUIREMENTS', message: `${T.reqNotMet(t.name)} ${rs[0]}`, reasons: rs });
  const tp = toolProblem(sim, toolId, toolList(t.tool));
  if (tp) problems.push(tp);
  if (problems.length) return fromProblems(problems);

  const spec = t.specRef ? sim.getSpec(t.specRef) : null;
  const unit = spec?.unit ?? t.unit ?? '';
  const f = faultApplies(sim, null);
  let fv;
  if (f && f.tests && f.tests[testId] !== undefined) {
    fv = f.tests[testId];
    if (fv && typeof fv === 'object' && !Array.isArray(fv)) fv = v != null ? (fv[v] ?? fv.default) : (fv.default ?? Object.values(fv)[0]);
  }
  const warnings = [];
  const sw = specWarning(spec);
  if (sw) warnings.push(sw);
  if (!spec) warnings.push(T.noSpec());
  const cyl = Number(t.cylinders) > 0 ? Number(t.cylinders) : 4;
  let values, inTolerance, summary;
  if (t.perCylinder) {
    if (Array.isArray(fv)) values = Array.from({ length: Math.max(cyl, fv.length) }, (_, i) => (fv[i] != null ? Number(fv[i]) : nominalValue(sim, spec, `test:${testId}:${v}:${i + 1}`)));
    else if (fv != null && Number.isFinite(Number(fv))) values = Array(cyl).fill(Number(fv));
    else values = Array.from({ length: cyl }, (_, i) => nominalValue(sim, spec, `test:${testId}:${v}:${i + 1}`));
    inTolerance = values.map((x) => compareSpec(spec, x).inTolerance);
    summary = values.map((x, i) => `cil. ${i + 1}: ${num(x)}${unit ? ` ${unit}` : ''}${inTolerance[i] === false ? ' (ÎN AFARA toleranței)' : ''}`).join('; ');
  } else {
    values = Array.isArray(fv) ? Number(fv[0]) : fv != null && Number.isFinite(Number(fv)) ? Number(fv) : nominalValue(sim, spec, `test:${testId}:${v}`);
    inTolerance = compareSpec(spec, values).inTolerance;
    summary = `${num(values)}${unit ? ` ${unit}` : ''}${inTolerance === false ? ' (ÎN AFARA toleranței)' : inTolerance ? ' (în toleranță)' : ''}`;
  }
  if (spec) summary += `. Admis: ${range(spec.min, spec.max, unit)}.`;
  const anyBad = Array.isArray(inTolerance) ? inTolerance.includes(false) : inTolerance === false;
  return okResult(anyBad ? 'OUT_OF_TOLERANCE' : 'OK', T.testDone(t.name, v, summary), { warnings, data: { values, unit, spec: spec ?? null, inTolerance, variant: v } });
}

export { list };
