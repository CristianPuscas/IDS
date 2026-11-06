/**
 * Persistență locală (localStorage) cu toleranță la erori.
 * Cheie unică: 'b48sim.v1'. Dacă localStorage este blocat (mod privat, politici), datele
 * rămân doar în memorie pentru sesiunea curentă — aplicația continuă să funcționeze.
 *
 * Structură: { theme, mode, variant, volume, muted, lessons: { [id]: { step, done, score, snap } },
 *   simSnapshot: { savedAt, snap, mode } | null, workshop: { budget, owned: [] }, log: [], leaderboard: [],
 *   overrides: { specs:[], parts:[], lessons:[], faults:[], tools:[] }, pdfs: [], links: {} }
 */
export const STORAGE_KEY = 'b48sim.v1';
const LOG_LIMIT = 200;

function defaults() {
  return {
    version: 1,
    theme: 'dark',
    mode: 'free',
    variant: null,
    volume: 0.7,
    muted: false,
    lessons: {},
    simSnapshot: null,
    workshop: null,
    log: [],
    leaderboard: [],
    overrides: {},
    pdfs: [],
    links: {}
  };
}

export class Storage {
  constructor(key = STORAGE_KEY) {
    this.key = key;
    this.available = false;
    this.lastError = null;
    this._timer = null;
    this.data = defaults();
    try {
      const probe = '__b48sim_probe__';
      window.localStorage.setItem(probe, '1');
      window.localStorage.removeItem(probe);
      this.available = true;
      const raw = window.localStorage.getItem(this.key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') this.data = { ...defaults(), ...parsed };
      }
    } catch (err) {
      this.lastError = err;
      console.warn('[storage] localStorage indisponibil sau corupt — se folosește memoria sesiunii.', err);
    }
  }

  /** Citește o cheie de nivel superior (sau o cale „a.b.c”). */
  get(path, fallback = undefined) {
    const parts = String(path).split('.');
    let cur = this.data;
    for (const p of parts) {
      if (cur == null || typeof cur !== 'object' || !(p in cur)) return fallback;
      cur = cur[p];
    }
    return cur === undefined ? fallback : cur;
  }

  /** Scrie o valoare (cale „a.b.c”) și programează salvarea. */
  set(path, value) {
    const parts = String(path).split('.');
    let cur = this.data;
    for (let i = 0; i < parts.length - 1; i++) {
      if (cur[parts[i]] == null || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = value;
    this.scheduleSave();
    return value;
  }

  /** Modificare prin funcție: storage.update('lessons', l => ({...l, x: 1})) */
  update(path, fn) {
    return this.set(path, fn(this.get(path)));
  }

  appendLog(entry) {
    const log = Array.isArray(this.data.log) ? this.data.log : [];
    log.push(entry);
    if (log.length > LOG_LIMIT) log.splice(0, log.length - LOG_LIMIT);
    this.data.log = log;
    this.scheduleSave(1500);
  }

  scheduleSave(delay = 300) {
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this.save(), delay);
  }

  /** Salvare imediată. Întoarce true dacă datele au ajuns în localStorage. */
  save() {
    clearTimeout(this._timer);
    if (!this.available) return false;
    try {
      window.localStorage.setItem(this.key, JSON.stringify(this.data));
      this.lastError = null;
      return true;
    } catch (err) {
      this.lastError = err;
      console.warn('[storage] Salvarea a eșuat (spațiu insuficient sau acces blocat).', err);
      return false;
    }
  }

  /** Șterge progresul (lecții, snapshot, workshop, jurnal, clasament), păstrează preferințele și importurile. */
  clearProgress() {
    const keep = { theme: this.data.theme, variant: this.data.variant, volume: this.data.volume, muted: this.data.muted,
      overrides: this.data.overrides, pdfs: this.data.pdfs, links: this.data.links, mode: this.data.mode };
    this.data = { ...defaults(), ...keep };
    this.save();
  }

  clearAll() {
    this.data = defaults();
    if (this.available) {
      try { window.localStorage.removeItem(this.key); } catch (err) { this.lastError = err; }
    }
  }
}
