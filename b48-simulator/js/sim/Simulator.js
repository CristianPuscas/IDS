/**
 * Simulator — fațada logicii (contract §4). Logică pură: fără DOM, fără three.js; rulează în browser și în Node.
 *
 *   const sim = new Simulator(data, bus, { seed: 1, enforce: true });
 *
 * Toate acțiunile întorc Result { ok, code, message, reasons, warnings, data? } și emit
 * 'sim:op' { action, target, result }, apoi 'sim:changed' {}. Jurnal: 'sim:log' { level, message, time }.
 */
import { buildDb, hasFasteners, FLUID_DRAIN_FLAG } from './model.js';
import { Rng, seedToState } from './rng.js';
import { okResult, failResult, addWarnings } from './result.js';
import { T, q, fastenerWords } from './messages.js';
import * as R from './rules.js';
import * as F from './fasteners.js';
import * as FL from './flags.js';
import * as D from './diagnostics.js';
import { finalCheck as runFinalCheck } from './finalCheck.js';

const NOOP_BUS = { emit() {}, on() { return () => {}; } };
/** Coduri care nu se numără ca greșeli (nu sunt refuzuri ale unei acțiuni reale). */
const NOT_MISTAKES = new Set(['UNKNOWN', 'NO_CHANGE']);
const clone = (x) => (x == null ? x : JSON.parse(JSON.stringify(x)));

export class Simulator {
  constructor(data, bus = null, { seed = 1, enforce = true } = {}) {
    this.data = data;
    this.db = buildDb(data);
    this.bus = bus && typeof bus.emit === 'function' ? bus : NOOP_BUS;
    this.seed = seed;
    this._enforce = !!enforce;
    this.rng = new Rng(seed);
    this.state = this._initialState();
    this.stats = this._emptyStats();
  }

  /* ================= stare ================= */

  _emptyStats() { return { ops: 0, errors: 0, laborMin: 0, partsCost: 0, mistakes: [] }; }

  _initialPartState(p) {
    const f = hasFasteners(p);
    return { installed: true, fasteners: f ? 'tight' : 'none', torque: f ? F.factoryTorque(this, p) : null, isNew: false, damaged: false, damageNote: null, damageSource: null, disturbed: false };
  }

  _initialState() {
    const parts = {};
    for (const p of this.db.parts.values()) parts[p.id] = this._initialPartState(p);
    const connectors = {};
    for (const id of this.db.connectorIds) connectors[id] = { connected: true };
    const flags = {};
    for (const f of this.db.flags.values()) flags[f.id] = !!f.default;
    return { parts, connectors, flags, activeTool: null, activeFault: null, faultProgress: {}, faultParts: [] };
  }

  get enforce() { return this._enforce; }
  setEnforce(v) { this._enforce = !!v; this._changed(); return this._enforce; }

  get activeTool() { return this.state.activeTool; }
  setActiveTool(toolId) {
    if (toolId != null && !this.db.tools.has(toolId)) return failResult('UNKNOWN', T.unknownTool(toolId));
    this.state.activeTool = toolId ?? null;
    this.bus.emit('tool:active', { toolId: this.state.activeTool });
    this._changed();
    return okResult('OK', toolId ? T.toolActive(this.db.tools.get(toolId).name) : T.toolNone(), { data: { toolId: this.state.activeTool } });
  }

  get activeFault() { return this.state.activeFault; }
  /** Definiția defectului activ (sau null). */
  get activeFaultDef() { return D.activeFaultDef(this); }
  get faultRepaired() { return D.faultRepaired(this); }

  /* ================= căutări ================= */

  getPart(id) { return this.db.parts.get(id) || null; }
  getTool(id) { return this.db.tools.get(id) || null; }
  getSpec(id) { return id ? this.db.specs.get(id) || null : null; }
  getConnector(id) { return this.db.connectors.get(id) || null; }
  getFlagDef(id) { return this.db.flags.get(id) || null; }
  getTest(id) { return this.db.tests.get(id) || null; }
  getFault(id) { return this.db.faults.get(id) || null; }
  getLesson(id) { return this.db.lessons.get(id) || null; }
  getAssembly(id) { return this.db.assemblies.get(id) || null; }
  get partIds() { return [...this.db.partIds]; }
  get connectorIds() { return [...this.db.connectorIds]; }

  getPartState(id) {
    const st = this.state.parts[id];
    if (!st) return null;
    return {
      installed: st.installed,
      onEngine: R.isOnEngine(this, id),
      fasteners: st.fasteners,
      torque: st.torque ? { ...st.torque } : null,
      isNew: st.isNew,
      damaged: st.damaged,
      damageNote: st.damageNote,
      disturbed: st.disturbed
    };
  }
  getConnectorState(id) { const c = this.state.connectors[id]; return c ? { connected: c.connected } : null; }
  getFlag(id) { return !!this.state.flags[id]; }

  isOnEngine(id) { return R.isOnEngine(this, id); }
  blockers(id) { return R.blockers(this, id); }
  benchGroup(id) { return R.benchGroup(this, id); }
  connectorsOf(id) { return R.connectorsOf(this, id); }
  dependencies(id) { return R.dependencies(this, id); }

  /* ================= verificări fără efecte ================= */

  canRemove(id, toolId = this.activeTool) { return R.checkRemove(this, id, toolId); }
  canInstall(id, opts = {}) { return R.checkInstall(this, id, opts); }
  canLoosen(id, toolId = this.activeTool) { return F.checkLoosen(this, id, toolId); }
  canTighten(id) { return F.checkTightenState(this, id); }
  canConnect(cid) { return R.checkConnect(this, cid); }
  canDisconnect(cid) { return R.checkDisconnect(this, cid); }
  canSetFlag(flagId, value, toolId = this.activeTool) { return FL.checkSetFlag(this, flagId, value, toolId); }

  availableActions(id) {
    const p = this.db.parts.get(id);
    if (!p) return [];
    const st = this.state.parts[id];
    const out = [];
    const add = (action, target, label, res) => out.push({ action, target, label, allowed: !!res.ok && res.code !== 'NO_CHANGE', reasons: res.ok ? [...(res.warnings || [])] : (res.reasons.length ? [...res.reasons] : [res.message]) });
    if (st.installed) {
      if (p.fasteners) {
        const w = fastenerWords(p.fasteners);
        if (st.fasteners === 'tight') add('loosen', id, `Slăbește ${w.nounLower} ${w.detail}`, F.checkLoosen(this, id, this.activeTool));
        else add('tighten', id, 'Strânge cu cheia dinamometrică', F.checkTightenState(this, id));
      }
      add('remove', id, 'Demontează', R.checkRemove(this, id, this.activeTool));
    } else {
      add('install', id, 'Montează (piesă refolosită)', R.checkInstall(this, id, { newPart: false }));
      add('install_new', id, `Montează piesă nouă${p.cost ? ` (${p.cost} lei)` : ''}`, R.checkInstall(this, id, { newPart: true }));
    }
    add('inspect', id, 'Inspectează', p.inspectRequiresRemoved && R.isOnEngine(this, id)
      ? failResult('REQUIREMENTS', T.inspectNeedsRemoved(p.name), [T.reqNeedRemoved(p.name)])
      : okResult('OK', ''));
    for (const m of p.measurements) {
      const reasons = [];
      if (m.requiresRemoved && R.isOnEngine(this, id)) reasons.push(T.reqNeedRemoved(p.name));
      if (m.requires) reasons.push(...R.requirementReasons(this, m.requires));
      const tp = R.toolProblem(this, this.activeTool, m.tool == null ? [] : [].concat(m.tool));
      if (tp) reasons.push(...tp.reasons);
      out.push({ action: 'measure', target: `${id}.${m.id}`, partId: id, measurementId: m.id, label: `Măsoară: ${m.name || m.id}`, allowed: reasons.length === 0, reasons });
    }
    for (const cid of R.connectorsOf(this, id)) {
      const c = this.db.connectors.get(cid);
      if (this.state.connectors[cid].connected) add('disconnect', cid, `Deconectează ${q(c.name)}`, R.checkDisconnect(this, cid));
      else add('connect', cid, `Conectează ${q(c.name)}`, R.checkConnect(this, cid));
    }
    return out;
  }

  /* ================= acțiuni ================= */

  _changed() { this.bus.emit('sim:changed', {}); }

  log(level, message) { this.bus.emit('sim:log', { level, message, time: Date.now() }); }

  _finish(action, target, result, { countMistake = true, silent = false } = {}) {
    this.stats.ops++;
    if (!result.ok && this._enforce && countMistake && !NOT_MISTAKES.has(result.code)) {
      this.stats.errors++;
      this.stats.mistakes.push({ time: Date.now(), action, target, code: result.code, message: result.message, reasons: result.reasons.length ? [...result.reasons] : [result.message] });
    }
    if (!silent && result.message) {
      const level = result.ok ? (result.code === 'NO_CHANGE' ? 'info' : 'success') : (this._enforce ? 'error' : 'warn');
      this.log(level, result.message);
      for (const w of result.warnings) this.log('warn', w);
    }
    this.bus.emit('sim:op', { action, target, result });
    this._changed();
    return result;
  }

  disconnect(cid) {
    const res = R.checkDisconnect(this, cid);
    if (res.ok && res.code !== 'NO_CHANGE') {
      this.state.connectors[cid].connected = false;
      return this._finish('disconnect', cid, okResult('OK', T.disconnectedOk(this.db.connectors.get(cid).name)));
    }
    return this._finish('disconnect', cid, res);
  }

  connect(cid) {
    const res = R.checkConnect(this, cid);
    if (res.ok && res.code !== 'NO_CHANGE') {
      this.state.connectors[cid].connected = true;
      return this._finish('connect', cid, okResult('OK', T.connectedOk(this.db.connectors.get(cid).name)));
    }
    return this._finish('connect', cid, res);
  }

  loosen(id, toolId = this.activeTool) {
    const res = F.checkLoosen(this, id, toolId);
    if (res.ok && res.code !== 'NO_CHANGE') {
      const st = this.state.parts[id];
      st.fasteners = 'loose';
      st.torque = null;
      const p = this.db.parts.get(id);
      return this._finish('loosen', id, okResult('OK', T.loosenedOk(p.name, fastenerWords(p.fasteners), toolId ? R.toolName(this, toolId) : null), { data: { toolId } }));
    }
    return this._finish('loosen', id, res);
  }

  remove(id, toolId = this.activeTool) {
    const res = R.checkRemove(this, id, toolId);
    if (!res.ok) return this._finish('remove', id, res);
    const p = this.db.parts.get(id);
    const st = this.state.parts[id];
    const warnings = [...res.warnings];
    // grupul se calculează ÎNAINTE de schimbare
    const group = this._enforce ? R.benchGroup(this, id) : R.travelGroup(this, id);
    if (!this._enforce) {
      for (const gid of [id, ...group]) for (const cid of R.connectorsOf(this, gid)) this.state.connectors[cid].connected = false;
      if (p.fasteners && st.fasteners === 'tight') warnings.push(T.freeModeAuto());
    }
    // scurgere: piesă care etanșează un fluid, demontată fără golire (posibil doar în modul liber)
    const drainFlag = p.sealsFluid ? FLUID_DRAIN_FLAG[p.sealsFluid] : null;
    if (drainFlag && p.requiresFlags[drainFlag] === true && this.db.flags.has(drainFlag) && !this.state.flags[drainFlag]) {
      this.state.flags[drainFlag] = true;
      warnings.push(T.spill(p.name, p.sealsFluid, this.db.flags.get(drainFlag).name));
    }
    st.installed = false;
    if (p.fasteners) st.fasteners = 'loose';
    st.torque = null;
    st.disturbed = true;
    this.stats.laborMin += p.laborMin;
    const msg = group.length ? T.removedOkGroup(p.name, group.map((g) => R.partName(this, g))) : T.removedOk(p.name);
    return this._finish('remove', id, okResult('OK', msg, { warnings, data: { group, toolId } }));
  }

  install(id, { newPart = false } = {}) {
    const action = newPart ? 'install_new' : 'install';
    const res = R.checkInstall(this, id, { newPart });
    if (!res.ok) return this._finish(action, id, res);
    const p = this.db.parts.get(id);
    const st = this.state.parts[id];
    const warnings = [...res.warnings];
    const group = this._enforce ? R.benchGroup(this, id) : R.travelGroup(this, id);
    st.installed = true;
    st.torque = null;
    if (newPart) {
      st.isNew = true;
      st.damaged = false;
      st.damageNote = null;
      st.damageSource = null;
      st.disturbed = false;
      this.stats.partsCost += p.cost;
      if (id in this.state.faultProgress) this.state.faultProgress[id] = true;
    }
    this.stats.laborMin += p.laborMin;
    if (this._enforce) {
      if (p.fasteners) { st.fasteners = 'loose'; warnings.push(T.installedNextStep(fastenerWords(p.fasteners))); }
      const disc = R.connectorsOf(this, id).filter((c) => !this.state.connectors[c].connected && this.db.connectors.get(c).between.every((pid) => !this.db.parts.has(pid) || R.isOnEngine(this, pid)));
      if (disc.length) warnings.push(T.connectorsStayDisconnected(disc.map((c) => R.connectorName(this, c))));
    } else {
      // modul liber: fixare și conectare automate
      for (const gid of [id, ...group]) {
        const gp = this.db.parts.get(gid);
        const gs = this.state.parts[gid];
        if (gp.fasteners && gs.installed && (gid === id || gs.fasteners === 'loose')) { gs.fasteners = 'tight'; gs.torque = { ...F.factoryTorque(this, gp), factory: false, auto: true }; }
        for (const cid of R.connectorsOf(this, gid)) {
          const c = this.db.connectors.get(cid);
          if (c.between.every((pid) => !this.db.parts.has(pid) || R.isOnEngine(this, pid))) this.state.connectors[cid].connected = true;
        }
      }
      if (p.fasteners) warnings.push(T.freeModeAuto());
    }
    return this._finish(action, id, okResult('OK', T.installedOk(p.name, newPart), { warnings, data: { group, newPart: !!newPart } }));
  }

  tighten(id, { toolId = this.activeTool, torque = null, angle = null, order = null } = {}) {
    return this._finish('tighten', id, F.tighten(this, id, { toolId, torque, angle, order }));
  }

  setFlag(flagId, value, toolId = this.activeTool) {
    return this._finish(value ? 'flag_on' : 'flag_off', flagId, FL.setFlag(this, flagId, value, toolId));
  }

  inspect(id) { return this._finish('inspect', id, D.inspect(this, id)); }

  measure(id, measurementId, toolId = this.activeTool) {
    return this._finish('measure', `${id}.${measurementId}`, D.measure(this, id, measurementId, toolId));
  }

  runTest(testId, { toolId = this.activeTool, variant = null } = {}) {
    return this._finish('test', testId, D.runTest(this, testId, { toolId, variant }));
  }

  finalCheck() { return this._finish('final_check', null, runFinalCheck(this), { countMistake: false }); }

  loadFault(faultId) {
    const res = D.loadFault(this, faultId ?? null);
    return this._finish('load_fault', faultId ?? null, res, { countMistake: false });
  }

  diagnose(partIds) { return this._finish('diagnose', null, D.diagnose(this, partIds), { countMistake: false }); }

  /**
   * Execută o acțiune după numele din lessons.json (disconnect|connect|loosen|remove|install|install_new|tighten|
   * flag_on|flag_off|inspect|measure|test|final_check|tool). Util pentru lecții și teste.
   */
  perform(action, target, params = {}) {
    const p = params || {};
    switch (action) {
      case 'disconnect': return this.disconnect(target);
      case 'connect': return this.connect(target);
      case 'loosen': return this.loosen(target, p.toolId ?? this.activeTool);
      case 'remove': return this.remove(target, p.toolId ?? this.activeTool);
      case 'install': return this.install(target, { newPart: !!p.newPart });
      case 'install_new': return this.install(target, { newPart: true });
      case 'tighten': return this.tighten(target, { toolId: p.toolId ?? this.activeTool, torque: p.torque ?? null, angle: p.angle ?? null, order: p.order ?? null });
      case 'flag_on': return this.setFlag(target, true, p.toolId ?? this.activeTool);
      case 'flag_off': return this.setFlag(target, false, p.toolId ?? this.activeTool);
      case 'inspect': return this.inspect(target);
      case 'measure': {
        const s = String(target ?? '');
        const i = s.indexOf('.');
        return this.measure(i >= 0 ? s.slice(0, i) : s, i >= 0 ? s.slice(i + 1) : p.measurementId, p.toolId ?? this.activeTool);
      }
      case 'test': return this.runTest(target, { toolId: p.toolId ?? this.activeTool, variant: p.variant ?? null });
      case 'final_check': return this.finalCheck();
      case 'tool': return this.setActiveTool(target);
      default: return failResult('UNKNOWN', T.unknownAction(action));
    }
  }

  /* ================= preseturi, reset, snapshot ================= */

  /**
   * Stare inițială pentru lecții/challenge: setează flagurile, apoi demontează piesele cerute și tot ce trebuie scos
   * înaintea lor (blocanți, conectori, elemente de fixare), fără greșeli și cu un singur mesaj de jurnal.
   * Se aplică peste starea curentă (apelați reset() înainte pentru o stare curată).
   */
  applyPreset({ removed = [], flags = {} } = {}) {
    const warnings = [];
    for (const [fid, v] of Object.entries(flags || {})) {
      if (this.db.flags.has(fid)) this.state.flags[fid] = !!v;
      else warnings.push(T.unknownFlag(fid));
    }
    const order = [];
    const inProgress = new Set();
    const removeDeep = (id) => {
      const p = this.db.parts.get(id);
      const st = this.state.parts[id];
      if (!p || !st.installed || inProgress.has(id)) return;
      inProgress.add(id);
      if (p.benchOnly) for (const par of p.mountsOn) if (this.db.parts.has(par) && R.isOnEngine(this, par)) removeDeep(par);
      for (const b of R.blockers(this, id)) if (R.blockerPresent(this, b, p.benchOnly)) removeDeep(b);
      for (const [fid, v] of Object.entries(p.requiresFlags)) {
        if (!(fid in (flags || {})) && this.db.flags.has(fid) && this.state.flags[fid] !== !!v) this.state.flags[fid] = !!v;
      }
      for (const cid of R.connectorsOf(this, id)) this.state.connectors[cid].connected = false;
      if (st.installed) {
        st.installed = false;
        if (p.fasteners) st.fasteners = 'loose';
        st.torque = null;
        st.disturbed = true;
        order.push(id);
      }
      inProgress.delete(id);
    };
    for (const id of removed || []) {
      if (!this.db.parts.has(id)) { warnings.push(T.unknownPart(id)); continue; }
      removeDeep(id);
    }
    const res = okResult('OK', T.presetApplied(order.length, order.map((i) => R.partName(this, i))), { warnings, data: { removed: order } });
    this.log('info', res.message);
    for (const w of warnings) this.log('warn', w);
    this.bus.emit('sim:op', { action: 'preset', target: null, result: res });
    this._changed();
    return res;
  }

  reset() {
    this.rng = new Rng(this.seed);
    this.state = this._initialState();
    this.stats = this._emptyStats();
    this.bus.emit('tool:active', { toolId: null });
    this.log('info', T.resetDone());
    this._changed();
    return okResult('OK', T.resetDone());
  }

  snapshot() {
    return clone({ version: 1, seed: this.seed, enforce: this._enforce, rng: this.rng.getState(), state: this.state, stats: this.stats });
  }

  restore(snap) {
    if (!snap || typeof snap !== 'object' || !snap.state) return failResult('INVALID', 'Instantaneu invalid — nu poate fi restaurat.');
    const s = clone(snap);
    const fresh = this._initialState();
    for (const id of Object.keys(fresh.parts)) if (s.state.parts?.[id]) fresh.parts[id] = { ...fresh.parts[id], ...s.state.parts[id] };
    for (const id of Object.keys(fresh.connectors)) if (s.state.connectors?.[id]) fresh.connectors[id] = { connected: !!s.state.connectors[id].connected };
    for (const id of Object.keys(fresh.flags)) if (s.state.flags && id in s.state.flags) fresh.flags[id] = !!s.state.flags[id];
    fresh.activeTool = s.state.activeTool && this.db.tools.has(s.state.activeTool) ? s.state.activeTool : null;
    fresh.activeFault = s.state.activeFault && this.db.faults.has(s.state.activeFault) ? s.state.activeFault : null;
    fresh.faultProgress = fresh.activeFault ? (s.state.faultProgress || {}) : {};
    fresh.faultParts = fresh.activeFault ? (s.state.faultParts || []) : [];
    this.state = fresh;
    if (s.seed !== undefined) this.seed = s.seed;
    if (typeof s.enforce === 'boolean') this._enforce = s.enforce;
    this.rng = new Rng(this.seed);
    if (s.rng != null) this.rng.setState(s.rng);
    this.stats = { ...this._emptyStats(), ...(s.stats || {}) };
    this.bus.emit('tool:active', { toolId: this.state.activeTool });
    this._changed();
    return okResult('OK', T.restored());
  }
}

export { seedToState, addWarnings };
export default Simulator;
