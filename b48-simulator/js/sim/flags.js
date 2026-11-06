/**
 * Flaguri globale de pregătire (baterie deconectată, ulei golit, distribuție blocată …).
 */
import { T, q } from './messages.js';
import { okResult, failResult, fromProblems } from './result.js';
import { toolProblem, requirementReasons } from './rules.js';

export function checkSetFlag(sim, flagId, value, toolId) {
  const def = sim.db.flags.get(flagId);
  if (!def) return failResult('UNKNOWN', T.unknownFlag(flagId));
  const want = !!value;
  if (sim.getFlag(flagId) === want) return okResult('NO_CHANGE', T.flagNoChange(def.name, want));
  const label = want ? def.onLabel : def.offLabel;
  const problems = [];
  const tp = toolProblem(sim, toolId, want ? def.toolsOn : def.toolsOff);
  if (tp) problems.push(tp);
  const reasons = requirementReasons(sim, want ? def.requiresOn : def.requiresOff);
  if (reasons.length) problems.push({ code: 'REQUIREMENTS', message: `${T.reqNotMet(label || def.name)} ${reasons[0]}`, reasons });
  if (!problems.length) return okResult('OK', `${q(label || def.name)} se poate efectua.`);
  if (!sim.enforce) {
    const all = problems.flatMap((p) => p.reasons);
    return okResult('OK', `${q(label || def.name)} se poate efectua (modul liber).`, { warnings: [T.freeModeIgnored(all)] });
  }
  return fromProblems(problems);
}

export function setFlag(sim, flagId, value, toolId) {
  const check = checkSetFlag(sim, flagId, value, toolId);
  if (!check.ok || check.code === 'NO_CHANGE') return check;
  const def = sim.db.flags.get(flagId);
  const want = !!value;
  sim.state.flags[flagId] = want;
  const warnings = [...check.warnings];
  if (def.description && want && flagId === 'distributie_blocata') warnings.push('Nu uita: sculele de blocare trebuie scoase înainte de pornire.');
  return okResult('OK', T.flagSet(def.name, want, want ? def.onLabel : def.offLabel), { warnings, data: { flagId, value: want } });
}
