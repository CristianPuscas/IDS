/**
 * Reguli de montaj/demontaj (fără efecte secundare): isOnEngine, blocanți, benchGroup,
 * canRemove / canInstall, conectori, condiții (flaguri, piese demontate/montate), scule.
 */
import { T, q, list, fastenerWords } from './messages.js';
import { okResult, failResult, fromProblems } from './result.js';

/* ---------- nume ---------- */
export const partName = (sim, id) => sim.db.parts.get(id)?.name || id;
export const toolName = (sim, id) => sim.db.tools.get(id)?.name || id;
export const connectorName = (sim, id) => sim.db.connectors.get(id)?.name || id;
export const flagName = (sim, id) => sim.db.flags.get(id)?.name || id;
const partNames = (sim, ids) => ids.map((i) => partName(sim, i));
const toolNames = (sim, ids) => ids.map((i) => toolName(sim, i));

/* ---------- poziție ---------- */

/** Instalată și toți părinții pe motor (recursiv). `memo` opțional (Map) pentru apeluri în masă. */
export function isOnEngine(sim, id, memo = null, path = new Set()) {
  if (memo && memo.has(id)) return memo.get(id);
  const st = sim.state.parts[id];
  const p = sim.db.parts.get(id);
  if (!p || !st || !st.installed) { memo?.set(id, false); return false; }
  if (path.has(id)) return false; // ciclu în date: tratăm ca „nu pe motor”
  path.add(id);
  let ok = true;
  for (const parent of p.mountsOn) {
    if (!sim.db.parts.has(parent)) continue;
    if (!isOnEngine(sim, parent, memo, path)) { ok = false; break; }
  }
  path.delete(id);
  memo?.set(id, ok);
  return ok;
}

/** Blocanți = blockedBy explicit ∪ copiii non-bench (care au piesa în mountsOn). */
export function blockers(sim, id) {
  const p = sim.db.parts.get(id);
  if (!p) return [];
  const out = [];
  for (const b of p.blockedBy) if (b !== id && sim.db.parts.has(b) && !out.includes(b)) out.push(b);
  for (const c of sim.db.childrenOf.get(id) || []) {
    if (c !== id && !sim.db.parts.get(c).benchOnly && !out.includes(c)) out.push(c);
  }
  return out;
}

/**
 * Un blocant „este în cale” dacă e pe motor; pentru o piesă benchOnly (lucrată pe banc)
 * contează orice blocant instalat (pe același subansamblu).
 */
export function blockerPresent(sim, blockerId, targetBenchOnly) {
  return targetBenchOnly ? !!sim.state.parts[blockerId]?.installed : isOnEngine(sim, blockerId);
}

export function presentBlockers(sim, id) {
  const p = sim.db.parts.get(id);
  if (!p) return [];
  return blockers(sim, id).filter((b) => blockerPresent(sim, b, p.benchOnly));
}

/** Descendenți benchOnly instalați care călătoresc cu piesa (recursiv). */
export function benchGroup(sim, id, acc = [], root = id) {
  for (const c of sim.db.childrenOf.get(id) || []) {
    if (c === root || acc.includes(c)) continue;
    if (sim.db.parts.get(c).benchOnly && sim.state.parts[c]?.installed) {
      acc.push(c);
      benchGroup(sim, c, acc, root);
    }
  }
  return acc;
}

/** Toți descendenții instalați (folosit în modul liber, unde piesa se scoate cu tot ce e pe ea). */
export function travelGroup(sim, id, acc = [], root = id) {
  for (const c of sim.db.childrenOf.get(id) || []) {
    if (c === root || acc.includes(c)) continue;
    if (sim.state.parts[c]?.installed) {
      acc.push(c);
      travelGroup(sim, c, acc, root);
    }
  }
  return acc;
}

export const connectorsOf = (sim, id) => [...(sim.db.connectorsOf.get(id) || [])];

/* ---------- condiții ---------- */

/** Probleme pentru flaguri cerute: { flagId: valoare }. */
export function flagProblems(sim, requiresFlags) {
  const problems = [];
  for (const [fid, val] of Object.entries(requiresFlags || {})) {
    const want = !!val;
    if (sim.getFlag(fid) === want) continue;
    const def = sim.db.flags.get(fid);
    const name = def?.name || fid;
    problems.push(want
      ? { code: 'FLAG_REQUIRED', message: T.flagRequired(name, def?.onLabel), reasons: [T.reasonFlagOn(name, def?.onLabel)] }
      : { code: 'FLAG_REQUIRED', message: T.flagMustBeOff(name, def?.offLabel), reasons: [T.reasonFlagOff(name, def?.offLabel)] });
  }
  return problems;
}

/** Motive nesatisfăcute pentru { removed, installed, flags }. */
export function requirementReasons(sim, req) {
  const reasons = [];
  for (const pid of req?.removed || []) if (sim.db.parts.has(pid) && isOnEngine(sim, pid)) reasons.push(T.reqNeedRemoved(partName(sim, pid)));
  for (const pid of req?.installed || []) if (sim.db.parts.has(pid) && !isOnEngine(sim, pid)) reasons.push(T.reqNeedInstalled(partName(sim, pid)));
  for (const p of flagProblems(sim, req?.flags)) reasons.push(...p.reasons);
  return reasons;
}

/** Problemă de sculă (null dacă e în regulă). `needed` gol = nu e nevoie de sculă. */
export function toolProblem(sim, toolId, needed) {
  const list_ = (needed || []).filter(Boolean);
  if (!list_.length) return null;
  const names = toolNames(sim, list_);
  if (!toolId) return { code: 'NO_TOOL', message: T.noTool(names), reasons: [T.reasonChooseTool(names)] };
  if (!list_.includes(toolId)) return { code: 'WRONG_TOOL', message: T.wrongTool(toolName(sim, toolId), names), reasons: [T.reasonChooseTool(names)] };
  return null;
}

/* ---------- demontare / montare ---------- */

export function checkRemove(sim, id, toolId) {
  const p = sim.db.parts.get(id);
  if (!p) return failResult('UNKNOWN', T.unknownPart(id));
  const st = sim.state.parts[id];
  if (!st.installed) return failResult('NOT_INSTALLED', T.notInstalled(p.name));
  if (!sim.enforce) return okResult('OK', `${q(p.name)} poate fi demontată (modul liber).`);

  const problems = [];
  if (p.benchOnly) {
    const onParents = p.mountsOn.filter((x) => sim.db.parts.has(x) && isOnEngine(sim, x));
    if (onParents.length) {
      problems.push({ code: 'BENCH_ONLY', message: T.benchOnlyRemove(p.name, partNames(sim, onParents)), reasons: onParents.map((x) => T.reasonRemoveFromEngine(partName(sim, x))) });
    }
  }
  const bl = presentBlockers(sim, id);
  if (bl.length) problems.push({ code: 'BLOCKED', message: T.blockedRemove(p.name, partNames(sim, bl)), reasons: bl.map((b) => T.reasonRemove(partName(sim, b))) });

  const cs = connectorsOf(sim, id).filter((c) => sim.state.connectors[c]?.connected);
  if (cs.length) {
    const names = cs.map((c) => connectorName(sim, c));
    problems.push({ code: 'CONNECTED', message: cs.length === 1 ? T.connected(names[0]) : T.connectedMany(names), reasons: names.map((n) => T.reasonDisconnect(n)) });
  }
  if (p.fasteners && st.fasteners === 'tight') {
    const w = fastenerWords(p.fasteners);
    problems.push({ code: 'FASTENED', message: T.fastened(w), reasons: [T.reasonLoosen(w, toolNames(sim, p.fasteners.tools))] });
  }
  problems.push(...flagProblems(sim, p.requiresFlags));
  if (p.removeTools.length) {
    const tp = toolProblem(sim, toolId, p.removeTools);
    if (tp) problems.push(tp);
  }
  if (problems.length) return fromProblems(problems);
  return okResult('OK', `${q(p.name)} poate fi demontată.`);
}

export function checkInstall(sim, id, { newPart = false } = {}) {
  const p = sim.db.parts.get(id);
  if (!p) return failResult('UNKNOWN', T.unknownPart(id));
  const st = sim.state.parts[id];
  if (st.installed) return failResult('ALREADY_INSTALLED', T.alreadyInstalled(p.name));
  const warnings = [];
  if (p.singleUse && !newPart) warnings.push(T.reusedGasket(p.name));
  if (st.damaged && !newPart) warnings.push(T.reusedDamaged(p.name, st.damageNote));
  if (!sim.enforce) return okResult('OK', `${q(p.name)} poate fi montată (modul liber).`, { warnings });

  const problems = [];
  const parents = p.mountsOn.filter((x) => sim.db.parts.has(x));
  if (p.benchOnly) {
    const onParents = parents.filter((x) => isOnEngine(sim, x));
    if (onParents.length) problems.push({ code: 'BENCH_ONLY', message: T.benchOnlyInstall(p.name, partNames(sim, onParents)), reasons: onParents.map((x) => T.reasonRemoveFromEngine(partName(sim, x))) });
  } else {
    const missing = parents.filter((x) => !isOnEngine(sim, x));
    if (missing.length) problems.push({ code: 'MOUNT_MISSING', message: T.mountMissing(p.name, partNames(sim, missing)), reasons: missing.map((x) => T.reasonInstall(partName(sim, x))) });
  }
  const bl = presentBlockers(sim, id);
  if (bl.length) problems.push({ code: 'BLOCKED', message: T.blockedInstall(p.name, partNames(sim, bl)), reasons: bl.map((b) => T.reasonRemove(partName(sim, b))) });
  if (problems.length) return fromProblems(problems, { warnings });
  return okResult('OK', `${q(p.name)} poate fi montată.`, { warnings });
}

/* ---------- conectori ---------- */

export function checkDisconnect(sim, cid) {
  const c = sim.db.connectors.get(cid);
  if (!c) return failResult('UNKNOWN', T.unknownConnector(cid));
  if (!sim.state.connectors[cid].connected) return okResult('NO_CHANGE', T.connectorAlreadyDisconnected(c.name));
  if (sim.enforce) {
    const problems = flagProblems(sim, c.requiresFlags);
    if (problems.length) return fromProblems(problems);
  }
  return okResult('OK', `${q(c.name)} poate fi deconectat.`);
}

export function checkConnect(sim, cid) {
  const c = sim.db.connectors.get(cid);
  if (!c) return failResult('UNKNOWN', T.unknownConnector(cid));
  if (sim.state.connectors[cid].connected) return okResult('NO_CHANGE', T.connectorAlreadyConnected(c.name));
  const problems = [];
  const missing = c.between.filter((pid) => sim.db.parts.has(pid) && !isOnEngine(sim, pid));
  if (missing.length) problems.push({ code: 'MOUNT_MISSING', message: T.connectorEndMissing(c.name, partNames(sim, missing)), reasons: missing.map((pid) => T.reasonInstall(partName(sim, pid))) });
  if (sim.enforce) problems.push(...flagProblems(sim, c.requiresFlags));
  if (problems.length) return fromProblems(problems);
  return okResult('OK', `${q(c.name)} poate fi conectat.`);
}

/** Pentru panoul „Condiții prealabile”. */
export function dependencies(sim, id) {
  const p = sim.db.parts.get(id);
  if (!p) return null;
  const st = sim.state.parts[id];
  const mounts = p.mountsOn.filter((x) => sim.db.parts.has(x)).map((x) => ({ id: x, name: partName(sim, x), ok: p.benchOnly ? !isOnEngine(sim, x) : isOnEngine(sim, x) }));
  const bl = blockers(sim, id).map((b) => ({ id: b, name: partName(sim, b), explicit: p.blockedBy.includes(b), ok: !blockerPresent(sim, b, p.benchOnly) }));
  const connectors = connectorsOf(sim, id).map((c) => ({ id: c, name: connectorName(sim, c), connected: !!sim.state.connectors[c]?.connected, ok: !sim.state.connectors[c]?.connected }));
  const flags = Object.entries(p.requiresFlags).map(([fid, v]) => ({ id: fid, name: flagName(sim, fid), required: !!v, value: !!v, current: sim.getFlag(fid), label: v ? sim.db.flags.get(fid)?.onLabel : sim.db.flags.get(fid)?.offLabel, ok: sim.getFlag(fid) === !!v }));
  const toolIds = [...new Set([...(p.fasteners?.tools || []), ...p.removeTools])];
  const tools = toolIds.map((t) => ({ id: t, name: toolName(sim, t), owned: sim.db.tools.get(t)?.defaultOwned ?? null, active: sim.activeTool === t }));
  const fasteners = p.fasteners
    ? { ...p.fasteners, state: st.fasteners, label: `${fastenerWords(p.fasteners).noun} ${fastenerWords(p.fasteners).detail}`, ok: st.fasteners !== 'tight' }
    : null;
  return {
    mounts,
    blockers: bl,
    connectors,
    flags,
    fasteners,
    tools,
    removeTools: p.removeTools.map((t) => ({ id: t, name: toolName(sim, t) })),
    torqueSpec: p.fasteners?.torqueSpec ? sim.getSpec(p.fasteners.torqueSpec) : null,
    sequenceSpec: p.fasteners?.sequenceSpec ? sim.getSpec(p.fasteners.sequenceSpec) : null,
    benchOnly: p.benchOnly,
    benchGroup: benchGroup(sim, id)
  };
}

export { list };
