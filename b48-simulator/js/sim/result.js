/**
 * Helper pentru obiectul Result din contract (§4):
 * { ok: boolean, code: string, message: string, reasons: string[], warnings: string[], data?: any }
 */

/** Result reușit. */
export function okResult(code, message, { warnings = [], reasons = [], data } = {}) {
  const r = { ok: true, code, message, reasons: [...reasons], warnings: [...warnings] };
  if (data !== undefined) r.data = data;
  return r;
}

/** Result refuzat / eșuat. */
export function failResult(code, message, reasons = [], { warnings = [], data } = {}) {
  const r = { ok: false, code, message, reasons: [...reasons], warnings: [...warnings] };
  if (data !== undefined) r.data = data;
  return r;
}

/**
 * Construiește un Result refuzat dintr-o listă de probleme [{ code, message, reasons }].
 * Codul și mesajul principal sunt ale primei probleme; `reasons` le conține pe toate.
 */
export function fromProblems(problems, { warnings = [], data } = {}) {
  const first = problems[0];
  const reasons = [];
  for (const p of problems) for (const r of (p.reasons?.length ? p.reasons : [p.message])) if (!reasons.includes(r)) reasons.push(r);
  let message = first.message;
  if (problems.length > 1) message = `${message.replace(/[.!]\s*$/, '')} (și încă ${problems.length - 1} ${problems.length - 1 === 1 ? 'condiție nesatisfăcută' : 'condiții nesatisfăcute'}).`;
  return failResult(first.code, message, reasons, { warnings, data });
}

/** Adaugă avertismente într-un Result existent (fără duplicate). */
export function addWarnings(result, warnings) {
  for (const w of warnings || []) if (w && !result.warnings.includes(w)) result.warnings.push(w);
  return result;
}
