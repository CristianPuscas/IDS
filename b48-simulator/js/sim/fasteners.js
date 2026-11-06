/**
 * Elemente de fixare: slăbire, strângere și evaluarea cuplului + unghiului + ordinii de strângere.
 */
import { T, q, fastenerWords, specTag, specWarning, range, num } from './messages.js';
import { okResult, failResult } from './result.js';
import { toolName, toolProblem } from './rules.js';

/** Cuplu „din fabrică” pentru starea inițială. */
export function factoryTorque(sim, part) {
  const spec = part.fasteners?.torqueSpec ? sim.getSpec(part.fasteners.torqueSpec) : null;
  return { status: 'ok', value: spec?.value ?? null, angle: spec?.angle ?? null, sequenceOk: true, factory: true };
}

export function checkLoosen(sim, id, toolId) {
  const p = sim.db.parts.get(id);
  if (!p) return failResult('UNKNOWN', T.unknownPart(id));
  const st = sim.state.parts[id];
  if (!st.installed) return failResult('NOT_INSTALLED', T.notInstalled(p.name));
  if (!p.fasteners) return failResult('NO_FASTENERS', T.noFasteners(p.name));
  const w = fastenerWords(p.fasteners);
  if (st.fasteners === 'loose') return okResult('NO_CHANGE', T.alreadyLoose(p.name, w));
  const tool = toolId ? sim.db.tools.get(toolId) : null;
  if (toolId && tool?.category === 'torque' && !p.fasteners.tools.includes(toolId)) {
    const names = p.fasteners.tools.map((t) => toolName(sim, t));
    return failResult('WRONG_TOOL', T.torqueToolNotForLoosen(tool.name), names.length ? [T.reasonChooseTool(names)] : []);
  }
  const tp = toolProblem(sim, toolId, p.fasteners.tools);
  if (tp) return failResult(tp.code, tp.message, tp.reasons);
  return okResult('OK', `${w.noun} ${w.detail} pot fi ${w.loosened}.`);
}

/** Verificare doar de stare (pentru availableActions): instalată + slăbită. */
export function checkTightenState(sim, id) {
  const p = sim.db.parts.get(id);
  if (!p) return failResult('UNKNOWN', T.unknownPart(id));
  const st = sim.state.parts[id];
  if (!st.installed) return failResult('NOT_INSTALLED', T.notInstalled(p.name));
  if (!p.fasteners) return failResult('NO_FASTENERS', T.noFasteners(p.name));
  if (st.fasteners === 'tight') return failResult('ALREADY_TIGHT', T.alreadyTight(p.name, fastenerWords(p.fasteners)));
  return okResult('OK', `${q(p.name)} poate fi strânsă.`);
}

const arraysEqual = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => Number(x) === Number(b[i]));
const RANK = { ok: 0, under: 1, over: 2 };

/**
 * Evaluează strângerea și aplică rezultatul în stare. Întoarce Result:
 *  ok:true code 'OK' — corect; ok:false + data.applied:true pentru under/over/uncontrolled/sequence
 *  (elementele de fixare sunt totuși strânse, iar problema apare la verificarea finală).
 */
export function tighten(sim, id, { toolId = null, torque = null, angle = null, order = null } = {}) {
  const base = checkTightenState(sim, id);
  if (!base.ok) return base;
  const p = sim.db.parts.get(id);
  const st = sim.state.parts[id];
  const f = p.fasteners;
  const spec = f.torqueSpec ? sim.getSpec(f.torqueSpec) : null;
  const seqSpec = f.sequenceSpec ? sim.getSpec(f.sequenceSpec) : null;
  const warnings = [];
  const tool = toolId ? sim.db.tools.get(toolId) : null;

  let mode;
  if (!toolId) {
    if (!f.tools.length && !spec) mode = 'plain';
    else {
      const names = ['cheie dinamometrică', ...f.tools.map((t) => toolName(sim, t))];
      return failResult('NO_TOOL', T.noTool(names), [T.reasonChooseTool(names)]);
    }
  } else if (!tool) {
    return failResult('UNKNOWN', T.unknownTool(toolId));
  } else if (tool.category === 'torque') {
    mode = 'torque';
  } else if (tool.category === 'angle') {
    return failResult('WRONG_TOOL', T.wrongTightenTool(tool.name, f.tools.map((t) => toolName(sim, t))), [T.angleToolHint()]);
  } else if (f.tools.includes(toolId)) {
    mode = spec ? 'uncontrolled' : 'plain';
  } else {
    return failResult('WRONG_TOOL', T.wrongTightenTool(tool.name, f.tools.map((t) => toolName(sim, t))), [T.reasonRetighten()]);
  }

  const tq = torque == null || torque === '' ? null : Number(torque);
  const ang = angle == null || angle === '' ? null : Number(angle);
  if (mode === 'torque') {
    if (tq == null || !Number.isFinite(tq)) return failResult('REQUIREMENTS', T.noTorqueValue(), spec ? [`Valoare prescrisă: ${num(spec.value)} Nm (${range(spec.min, spec.max, 'Nm')}) ${specTag(spec)}.`] : []);
    const [rmin, rmax] = Array.isArray(tool.range) ? tool.range : [null, null];
    if ((rmin != null && tq < rmin) || (rmax != null && tq > rmax)) {
      return failResult('TORQUE_RANGE', T.torqueOutOfToolRange(tool.name, tq, rmin, rmax), ['Alege o cheie dinamometrică al cărei domeniu include valoarea prescrisă.']);
    }
  }

  const sw = specWarning(spec);
  if (sw) warnings.push(sw);
  const tag = specTag(spec);
  const problems = []; // mesaje
  let status = 'ok';
  let value = mode === 'torque' ? tq : null;

  if (mode === 'torque' && spec) {
    const min = spec.min ?? spec.value;
    const max = spec.max ?? spec.value;
    let s = 'ok';
    if (min != null && tq < min) { s = 'under'; problems.push(T.torqueUnder(tq, min, tag)); }
    else if (max != null && tq > max) { s = 'over'; problems.push(T.torqueOver(tq, max, tag)); }
    if (spec.angle != null) {
      const tol = spec.angleTolerance ?? 5;
      let a = 'ok';
      if (ang == null || !Number.isFinite(ang)) { a = 'under'; problems.push(T.angleMissing(spec.angle, tag)); }
      else if (ang < spec.angle - tol) { a = 'under'; problems.push(T.angleUnder(ang, spec.angle, tag)); }
      else if (ang > spec.angle + tol) { a = 'over'; problems.push(T.angleOver(ang, spec.angle, tag)); }
      if (RANK[a] > RANK[s]) s = a;
    }
    status = s;
  } else if (mode === 'torque' && !spec) {
    warnings.push(T.noTorqueSpec(p.name));
  } else if (mode === 'uncontrolled') {
    status = 'uncontrolled';
    value = Math.round((spec.value ?? 10) * (0.55 + 0.9 * sim.rng.next()) * 10) / 10;
    problems.push(T.uncontrolled(p.name, tool.name, value, spec));
  }

  let sequenceOk = true;
  if (seqSpec && Array.isArray(seqSpec.order) && seqSpec.order.length) {
    sequenceOk = arraysEqual(order, seqSpec.order);
    if (!sequenceOk) {
      problems.push(T.sequenceWrong(Array.isArray(order) ? order : null, seqSpec.order, specTag(seqSpec)));
      const ssw = specWarning(seqSpec);
      if (ssw && !warnings.includes(ssw)) warnings.push(ssw);
    }
  }

  // aplică
  st.fasteners = 'tight';
  st.torque = { status, value, angle: ang, sequenceOk, toolId: toolId ?? null };
  if (status === 'over') {
    st.damaged = true;
    st.damageNote = problems[0];
    st.damageSource = 'torque';
  }
  const good = status === 'ok' && sequenceOk;
  // reparare defect de montaj: piesă cauză care nu era deteriorată, strânsă acum corect
  if (good && sim.state.activeFault && id in sim.state.faultProgress) {
    const fault = sim.db.faults.get(sim.state.activeFault);
    const ps = fault?.partStates?.[id];
    if (!ps?.damaged && !st.damaged) sim.state.faultProgress[id] = true;
  }

  const data = { applied: true, torque: { ...st.torque }, spec: spec ?? null, sequenceSpec: seqSpec ?? null };
  if (good) {
    const msg = mode === 'plain' ? T.tightenedPlain(p.name) : T.tightenedOk(p.name, tq, spec, !!seqSpec);
    return okResult('OK', msg, { warnings, data });
  }
  const code = status === 'over' ? 'TORQUE_OVER' : status === 'under' ? 'TORQUE_UNDER' : status === 'uncontrolled' ? 'UNCONTROLLED' : 'SEQUENCE';
  return failResult(code, problems[0], [...problems.slice(1), T.reasonRetighten()], { warnings, data });
}
