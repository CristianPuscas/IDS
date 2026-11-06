/**
 * Verificarea finală: raport de probleme, scurgeri și profilul de sunet al motorului.
 * FinalReport = { startable, issues: [...], leaks: [{ partId, fluid }], sound: { misfireCylinder, roughness, chainRattle, turboWhistle, knock, hiss, noStart } }
 */
import { T, fastenerWords } from './messages.js';
import { okResult, failResult } from './result.js';
import { isOnEngine, connectorName } from './rules.js';
import { activeFaultDef, faultRepaired } from './diagnostics.js';

const CYL_RE = /^(bobina|bujie|injector)_(\d+)$/;
/** Piese a căror lipsă NU împiedică pornirea (dau rateu sau sunt cosmetice). */
const NON_CRITICAL = new Set(['capac_motor_acustic']);
const TIMING_PARTS = new Set(['lant_distributie', 'intinzator_lant', 'sina_intinzator', 'sina_ghidare', 'vanos_admisie', 'vanos_evacuare', 'pinion_arbore_cotit']);

function startCritical(part) {
  if (part.startCritical === false) return false;
  if (part.startCritical === true) return true;
  if (CYL_RE.test(part.id)) return false;
  return !NON_CRITICAL.has(part.id);
}

/** Fluidul etanșat de piesă: propriul `sealsFluid` sau al garniturii pe care se montează. */
export function sealedFluid(sim, part) {
  if (part.sealsFluid) return part.sealsFluid;
  for (const par of part.mountsOn) {
    const pp = sim.db.parts.get(par);
    if (pp?.isGasket && pp.sealsFluid) return pp.sealsFluid;
  }
  return null;
}

/** Fluidul unei garnituri: al ei sau al piesei care se montează pe ea. */
function gasketFluid(sim, gasket) {
  if (gasket.sealsFluid) return gasket.sealsFluid;
  for (const c of sim.db.childrenOf.get(gasket.id) || []) {
    const cp = sim.db.parts.get(c);
    if (cp?.sealsFluid) return cp.sealsFluid;
  }
  return null;
}

const clamp01 = (x) => Math.max(0, Math.min(1, Number(x) || 0));

export function finalCheck(sim) {
  const memo = new Map();
  const on = (id) => isOnEngine(sim, id, memo);
  const issues = [];
  const leaks = [];
  const addLeak = (partId, fluid) => { if (fluid && !leaks.some((l) => l.partId === partId && l.fluid === fluid)) leaks.push({ partId, fluid }); };
  const misfire = new Set();
  let noStart = false;
  let roughness = 0, chainRattle = 0, turboWhistle = 0, knock = 0, hiss = 0;

  for (const id of sim.db.partIds) {
    const p = sim.db.parts.get(id);
    const st = sim.state.parts[id];
    const cyl = CYL_RE.exec(id);
    if (!on(id)) {
      if (p.benchOnly && st.installed) continue; // e pe părinte; lipsa părintelui e raportată separat
      issues.push({ type: 'missing', partId: id, message: T.fcMissing(p.name) });
      if (cyl) misfire.add(Number(cyl[2]));
      else if (startCritical(p)) noStart = true;
      continue;
    }
    const fluid = sealedFluid(sim, p);
    if (p.fasteners) {
      if (st.fasteners === 'loose') {
        issues.push({ type: 'fastener', partId: id, message: T.fcLoose(p.name, fastenerWords(p.fasteners)) });
        addLeak(id, fluid);
        if (TIMING_PARTS.has(id)) chainRattle = Math.max(chainRattle, 0.7);
      } else if (st.torque) {
        const t = st.torque;
        if (t.status === 'under') issues.push({ type: 'torque', partId: id, message: T.fcUnder(p.name, t.value) });
        else if (t.status === 'over') issues.push({ type: 'torque', partId: id, message: T.fcOver(p.name, t.value) });
        else if (t.status === 'uncontrolled') issues.push({ type: 'torque', partId: id, message: T.fcUncontrolled(p.name) });
        if (t.sequenceOk === false) issues.push({ type: 'sequence', partId: id, message: T.fcSequence(p.name) });
        if (t.status !== 'ok' || t.sequenceOk === false) {
          addLeak(id, fluid);
          if (TIMING_PARTS.has(id)) chainRattle = Math.max(chainRattle, 0.5);
          if (cyl && t.status !== 'ok') roughness += 0.05;
        }
      }
    }
    if (p.singleUse && st.disturbed && !st.isNew) {
      const gf = gasketFluid(sim, p);
      issues.push({ type: 'gasket', partId: id, message: T.fcGasket(p.name, gf) });
      addLeak(id, gf);
    }
    if (st.damaged) {
      issues.push({ type: 'damaged', partId: id, message: T.fcDamaged(p.name, st.damageNote) });
      if (cyl && (cyl[1] === 'bobina' || cyl[1] === 'bujie')) misfire.add(Number(cyl[2]));
    }
  }

  for (const cid of sim.db.connectorIds) {
    if (sim.state.connectors[cid].connected) continue;
    const c = sim.db.connectors.get(cid);
    const ends = c.between.filter((pid) => sim.db.parts.has(pid));
    if (!ends.every((pid) => on(pid))) continue; // capăt lipsă → raportat ca piesă lipsă
    issues.push({ type: 'connector', connectorId: cid, message: T.fcConnector(connectorName(sim, cid)) });
    let cylHit = false;
    for (const pid of ends) {
      const m = CYL_RE.exec(pid);
      if (m && (m[1] === 'bobina' || m[1] === 'injector')) { misfire.add(Number(m[2])); cylHit = true; }
    }
    if (!cylHit) roughness += 0.05;
  }

  for (const [fid, def] of sim.db.flags) {
    if (!sim.state.flags[fid]) continue;
    if (fid === 'distributie_blocata') {
      issues.push({ type: 'flag', flagId: fid, severity: 'grav', message: T.fcTimingLocked(def.name) });
      noStart = true;
    } else if (fid === 'ulei_golit') {
      issues.push({ type: 'flag', flagId: fid, message: T.fcNoOil(def.name, def.offLabel) });
      noStart = true;
    } else if (fid === 'lichid_racire_golit') {
      issues.push({ type: 'flag', flagId: fid, message: T.fcNoCoolant(def.name, def.offLabel) });
      noStart = true;
    } else if (def.mustBeOffToStart) {
      issues.push({ type: 'flag', flagId: fid, message: T.fcFlagOn(def.name, def.offLabel) });
      noStart = true;
    }
  }

  const fault = activeFaultDef(sim);
  let faultSound = null;
  if (fault && !faultRepaired(sim)) {
    issues.push({ type: 'fault', message: T.fcFault() });
    faultSound = fault.sound || {};
    for (const l of fault.leaks || []) if (l?.partId && l?.fluid) addLeak(l.partId, l.fluid);
    for (const pid of fault.rootCauseParts || []) {
      const rp = sim.db.parts.get(pid);
      if (rp?.isGasket && rp.sealsFluid && on(pid)) addLeak(pid, rp.sealsFluid);
    }
    if (faultSound.noStart) noStart = true;
  }

  for (const l of leaks) {
    if (l.fluid === 'aer') { hiss += 0.5; turboWhistle = Math.max(turboWhistle, 0.2); }
    else if (l.fluid === 'gaze_evacuare') hiss += 0.3;
  }

  const cyls = [...misfire].sort((a, b) => a - b);
  roughness += cyls.length * 0.3;
  let misfireCylinder = cyls[0] || 0;
  if (faultSound) {
    if (!misfireCylinder && faultSound.misfireCylinder) misfireCylinder = Number(faultSound.misfireCylinder) || 0;
    roughness = Math.max(roughness, Number(faultSound.roughness) || 0);
    chainRattle = Math.max(chainRattle, Number(faultSound.chainRattle) || 0);
    turboWhistle = Math.max(turboWhistle, Number(faultSound.turboWhistle) || 0);
    knock = Math.max(knock, Number(faultSound.knock) || 0);
    hiss = Math.max(hiss, Number(faultSound.hiss) || 0);
  }
  const sound = {
    misfireCylinder,
    roughness: clamp01(roughness),
    chainRattle: clamp01(chainRattle),
    turboWhistle: clamp01(turboWhistle),
    knock: clamp01(knock),
    hiss: clamp01(hiss),
    noStart
  };
  const report = { startable: !noStart, issues, leaks, sound, misfireCylinders: cyls, faultRepaired: fault ? faultRepaired(sim) : null };
  const reasons = issues.map((i) => i.message);
  const warnings = leaks.map((l) => T.fcLeak(sim.db.parts.get(l.partId)?.name || l.partId, l.fluid));
  if (!issues.length && !noStart) return okResult('FINAL_OK', T.fcOk(), { warnings, data: report });
  return failResult(noStart ? 'NO_START' : 'FINAL_ISSUES', T.fcIssues(issues.length, !noStart), reasons, { warnings, data: report });
}
