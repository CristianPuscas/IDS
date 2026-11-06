/**
 * Normalizarea datelor de intrare (tolerantă la câmpuri lipsă) și indexuri de căutare.
 * Folosit de Simulator și de validateData.
 */

const arr = (x) => (Array.isArray(x) ? x : []);
const obj = (x) => (x && typeof x === 'object' && !Array.isArray(x) ? x : {});

/** Extrage listele din obiectul `data` din contract (acceptă și liste directe). */
export function extractLists(data) {
  const d = obj(data);
  const pick = (v, key) => (Array.isArray(v) ? v : arr(v?.[key]));
  const partsSrc = d.parts;
  return {
    assemblies: Array.isArray(partsSrc) ? arr(d.assemblies) : arr(partsSrc?.assemblies ?? d.assemblies),
    connectors: Array.isArray(partsSrc) ? pick(d.connectors, 'connectors') : arr(partsSrc?.connectors ?? (Array.isArray(d.connectors) ? d.connectors : d.connectors?.connectors)),
    parts: pick(partsSrc, 'parts'),
    flags: pick(d.flags, 'flags'),
    tools: pick(d.tools, 'tools'),
    specs: pick(d.specs, 'specs'),
    tests: pick(d.tests, 'tests'),
    faults: pick(d.faults, 'faults'),
    lessons: pick(d.lessons, 'lessons'),
    variants: d.variants && typeof d.variants === 'object' ? d.variants : null
  };
}

/** Elemente de fixare normalizate sau null (null / count 0 → fără elemente de fixare). */
export function normalizeFasteners(f) {
  if (!f || typeof f !== 'object') return null;
  const count = f.count == null ? 1 : Number(f.count);
  if (!(count > 0)) return null;
  return {
    ...f,
    count,
    type: f.type ?? 'șurub',
    size: f.size ?? null,
    tools: arr(f.tools),
    torqueSpec: f.torqueSpec ?? null,
    sequenceSpec: f.sequenceSpec ?? null
  };
}

export function normalizePart(p) {
  return {
    ...p,
    name: p.name || p.id,
    mountsOn: arr(p.mountsOn),
    benchOnly: !!p.benchOnly,
    blockedBy: arr(p.blockedBy),
    requiresFlags: obj(p.requiresFlags),
    fasteners: normalizeFasteners(p.fasteners),
    removeTools: arr(p.removeTools),
    isGasket: !!p.isGasket,
    singleUse: !!p.singleUse,
    sealsFluid: p.sealsFluid ?? null,
    inspectRequiresRemoved: !!p.inspectRequiresRemoved,
    inspections: arr(p.inspections),
    measurements: arr(p.measurements),
    cost: Number.isFinite(Number(p.cost)) ? Number(p.cost) : 0,
    laborMin: Number.isFinite(Number(p.laborMin)) ? Number(p.laborMin) : 0
  };
}

const req = (r) => ({ removed: arr(r?.removed), installed: arr(r?.installed), flags: obj(r?.flags) });

export function normalizeFlag(f) {
  return {
    ...f,
    name: f.name || f.id,
    default: !!f.default,
    toolsOn: arr(f.toolsOn),
    toolsOff: arr(f.toolsOff),
    requiresOn: req(f.requiresOn),
    requiresOff: req(f.requiresOff),
    mustBeOffToStart: !!f.mustBeOffToStart
  };
}

export function normalizeConnector(c) {
  return { ...c, name: c.name || c.id, between: arr(c.between), requiresFlags: obj(c.requiresFlags) };
}

export function normalizeTest(t) {
  return { ...t, name: t.name || t.id, tool: t.tool ?? null, perCylinder: !!t.perCylinder, variants: arr(t.variants), requires: req(t.requires), specRef: t.specRef ?? null };
}

export function normalizeRequirements(r) { return req(r); }

function mapById(list, norm = (x) => x) {
  const m = new Map();
  for (const x of list) if (x && typeof x.id === 'string' && !m.has(x.id)) m.set(x.id, norm(x));
  return m;
}

/** Construiește baza de date internă (Map-uri + indexuri derivate). */
export function buildDb(data) {
  const L = extractLists(data);
  const parts = mapById(L.parts, normalizePart);
  const connectors = mapById(L.connectors, normalizeConnector);
  const db = {
    lists: L,
    parts,
    partIds: [...parts.keys()],
    assemblies: mapById(L.assemblies),
    connectors,
    connectorIds: [...connectors.keys()],
    flags: mapById(L.flags, normalizeFlag),
    tools: mapById(L.tools),
    specs: mapById(L.specs),
    tests: mapById(L.tests, normalizeTest),
    faults: mapById(L.faults),
    lessons: mapById(L.lessons),
    variants: L.variants,
    childrenOf: new Map(),
    connectorsOf: new Map()
  };
  for (const id of db.partIds) { db.childrenOf.set(id, []); db.connectorsOf.set(id, []); }
  for (const p of parts.values()) {
    for (const parent of p.mountsOn) if (db.childrenOf.has(parent) && !db.childrenOf.get(parent).includes(p.id)) db.childrenOf.get(parent).push(p.id);
  }
  for (const c of connectors.values()) {
    for (const pid of c.between) if (db.connectorsOf.has(pid) && !db.connectorsOf.get(pid).includes(c.id)) db.connectorsOf.get(pid).push(c.id);
  }
  return db;
}

/** Fluidul care se scurge la golire, mapat pe flagul de golire. */
export const FLUID_DRAIN_FLAG = { ulei: 'ulei_golit', lichid_racire: 'lichid_racire_golit', combustibil: 'combustibil_depresurizat' };

/** True dacă piesa are elemente de fixare (după normalizare). */
export const hasFasteners = (p) => !!(p && p.fasteners);
