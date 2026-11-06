/**
 * Încărcarea datelor din data/*.json, aplicarea suprascrierilor importate (merge pe id)
 * și aplicarea politicii de verificare a specificațiilor.
 *
 * Întoarce obiectul `data` din contract (§4): { parts, flags, tools, specs, tests, faults, lessons, variants }
 * — fiecare cheie = conținutul fișierului (ex. data.parts.parts, data.specs.specs).
 */
export const DATA_FILES = ['parts', 'flags', 'tools', 'specs', 'tests', 'faults', 'lessons', 'variants'];

/** Unde intră fiecare tip de suprascriere: [fișier, cheie listă] */
export const OVERRIDE_TARGETS = {
  specs: ['specs', 'specs'],
  parts: ['parts', 'parts'],
  assemblies: ['parts', 'assemblies'],
  connectors: ['parts', 'connectors'],
  lessons: ['lessons', 'lessons'],
  faults: ['faults', 'faults'],
  tools: ['tools', 'tools'],
  tests: ['tests', 'tests'],
  flags: ['flags', 'flags']
};

export class DataLoadError extends Error {
  constructor(file, message, cause) {
    super(`data/${file}.json: ${message}`);
    this.file = file;
    this.cause = cause;
  }
}

async function fetchJson(base, name) {
  let res;
  try {
    res = await fetch(`${base}${name}.json`, { cache: 'no-cache' });
  } catch (err) {
    throw new DataLoadError(name, `nu a putut fi descărcat (${err.message}). Porniți aplicația printr-un server local (npm start).`, err);
  }
  if (!res.ok) throw new DataLoadError(name, `fișierul lipsește sau nu poate fi citit (HTTP ${res.status}).`);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new DataLoadError(name, `JSON invalid — ${err.message}`, err);
  }
}

/** Copiere profundă simplă (datele sunt JSON pur). */
export function clone(obj) {
  return obj == null ? obj : JSON.parse(JSON.stringify(obj));
}

/** Combină o listă de elemente cu suprascrieri, pe `id`. Câmpurile suprascrierii înlocuiesc câmpurile existente. */
export function mergeById(list = [], overrides = []) {
  const out = list.map((x) => x);
  const index = new Map(out.map((x, i) => [x && x.id, i]));
  for (const item of overrides || []) {
    if (!item || typeof item !== 'object' || !item.id) continue;
    if (item._delete === true) {
      if (index.has(item.id)) out.splice(index.get(item.id), 1, null);
      continue;
    }
    if (index.has(item.id)) {
      const i = index.get(item.id);
      out[i] = { ...out[i], ...clone(item) };
    } else {
      index.set(item.id, out.length);
      out.push(clone(item));
    }
  }
  return out.filter(Boolean);
}

/** Aplică un set de suprascrieri peste o copie a datelor de bază. */
export function applyOverrides(baseData, overrides = {}) {
  const data = clone(baseData);
  for (const [kind, items] of Object.entries(overrides || {})) {
    const target = OVERRIDE_TARGETS[kind];
    if (!target || !Array.isArray(items) || !items.length) continue;
    const [file, key] = target;
    if (!data[file]) data[file] = {};
    data[file][key] = mergeById(data[file][key] || [], items);
  }
  return data;
}

/**
 * Politica datelor tehnice: o specificație poate rămâne „VERIFICATĂ” doar dacă are document + pagină
 * în `source` și `variant` egal cu varianta selectată. Altfel este retrogradată la „NEVERIFICATĂ”.
 */
export function enforceSpecPolicy(data, selectedVariant) {
  const specs = data?.specs?.specs || [];
  let downgraded = 0;
  for (const s of specs) {
    if (s.status !== 'VERIFICATĂ') continue;
    const src = s.source || {};
    const reasons = [];
    if (!src.document) reasons.push('lipsește documentul sursă');
    if (src.page == null || src.page === '') reasons.push('lipsește pagina');
    if (!selectedVariant || selectedVariant === 'demo') reasons.push('varianta motorului nu este aleasă');
    else if (s.variant !== selectedVariant) reasons.push(`specificația este pentru varianta „${s.variant ?? '—'}”, nu pentru „${selectedVariant}”`);
    if (reasons.length) {
      s.status = 'NEVERIFICATĂ';
      s.statusNote = `Retrogradată automat: ${reasons.join('; ')}.`;
      downgraded++;
    }
  }
  return downgraded;
}

/**
 * Încarcă toate fișierele de date.
 * @param {object} opts { base = './data/', overrides = {}, variant = null }
 * @returns {Promise<{ data, base, errors: DataLoadError[], downgraded }>}
 */
export async function loadData({ base = './data/', overrides = {}, variant = null } = {}) {
  const results = await Promise.allSettled(DATA_FILES.map((f) => fetchJson(base, f)));
  const errors = [];
  const raw = {};
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') raw[DATA_FILES[i]] = r.value;
    else errors.push(r.reason instanceof DataLoadError ? r.reason : new DataLoadError(DATA_FILES[i], String(r.reason)));
  });
  if (errors.length) {
    const err = new Error(errors.map((e) => e.message).join('\n'));
    err.fileErrors = errors;
    throw err;
  }
  // normalizează formele minimale
  raw.parts.parts ||= []; raw.parts.assemblies ||= []; raw.parts.connectors ||= [];
  raw.flags.flags ||= []; raw.tools.tools ||= []; raw.specs.specs ||= []; raw.tests.tests ||= [];
  raw.faults.faults ||= []; raw.lessons.lessons ||= []; raw.variants.variants ||= [];

  const baseData = clone(raw);
  let data;
  try {
    data = applyOverrides(raw, overrides);
  } catch (err) {
    console.warn('[dataLoader] Suprascrierile nu au putut fi aplicate:', err);
    data = clone(raw);
  }
  if (variant && data.variants.variants.some((v) => v.id === variant)) data.variants.selected = variant;
  const downgraded = enforceSpecPolicy(data, data.variants.selected);
  return { data, base: baseData, errors: [], downgraded };
}
