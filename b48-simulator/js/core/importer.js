/**
 * Import/export de date (suprascrieri JSON), bibliotecă locală de PDF-uri (manuale proprii ale utilizatorului)
 * și asocieri document ↔ specificație/piesă/procedură.
 *
 * Nu se extrage text din PDF — valorile se introduc manual sau prin JSON.
 * O specificație poate fi marcată „VERIFICATĂ” doar dacă are document asociat + pagină + variantă egală cu cea selectată.
 */
import { applyOverrides, mergeById, clone, OVERRIDE_TARGETS } from './dataLoader.js';

export const IMPORT_KINDS = ['specs', 'parts', 'lessons', 'faults', 'tools'];
const PACK_KEYS = Object.keys(OVERRIDE_TARGETS);
const KIND_LABELS = { specs: 'Specificații', parts: 'Piese', assemblies: 'Ansambluri', connectors: 'Conectori',
  lessons: 'Lecții', faults: 'Defecte', tools: 'Scule', tests: 'Teste', flags: 'Stări' };
export const kindLabel = (k) => KIND_LABELS[k] || k;

const IDB_NAME = 'b48sim-pdf';
const IDB_STORE = 'files';

function guessKind(item) {
  if (!item || typeof item !== 'object') return null;
  if ('steps' in item || 'finalTest' in item) return 'lessons';
  if ('symptoms' in item || 'rootCauseParts' in item) return 'faults';
  if ('assembly' in item || 'mountsOn' in item) return 'parts';
  if ('price' in item || ('category' in item && 'icon' in item)) return 'tools';
  if ('status' in item && ('type' in item || 'unit' in item || 'value' in item)) return 'specs';
  return null;
}

function emptyPack() { return {}; }

export class Importer {
  /**
   * @param {import('./storage.js').Storage} storage
   * @param {{ validate?: Function }} opts validate = validateData(data) -> { errors, warnings }
   */
  constructor(storage, { validate = null } = {}) {
    this.storage = storage;
    this.validate = validate;
    this.sessionFiles = new Map(); // id -> Blob (dacă IndexedDB nu e disponibil)
    this._dbPromise = null;
  }

  // ---------- suprascrieri ----------
  getOverrides() { return clone(this.storage.get('overrides', {}) || {}); }
  hasOverrides() { return Object.values(this.getOverrides()).some((a) => Array.isArray(a) && a.length); }
  countOverrides() {
    return Object.values(this.getOverrides()).reduce((n, a) => n + (Array.isArray(a) ? a.length : 0), 0);
  }

  /**
   * Interpretează textul JSON importat.
   * @returns {{ pack: object, kinds: string[], errors: string[] }}
   */
  parseImport(text, kindHint = 'auto') {
    const errors = [];
    let json;
    try { json = JSON.parse(text); } catch (err) { return { pack: emptyPack(), kinds: [], errors: [`JSON invalid: ${err.message}`] }; }
    const pack = emptyPack();
    const put = (kind, items) => {
      if (!Array.isArray(items)) { errors.push(`„${kind}” trebuie să fie o listă.`); return; }
      const bad = items.filter((x) => !x || typeof x !== 'object' || !x.id);
      if (bad.length) errors.push(`${bad.length} element(e) din „${kind}” nu au câmpul „id”.`);
      pack[kind] = (pack[kind] || []).concat(items.filter((x) => x && x.id));
    };
    const forced = kindHint && kindHint !== 'auto' ? kindHint : null;

    if (Array.isArray(json)) {
      const kind = forced || guessKind(json[0]);
      if (!kind) errors.push('Nu s-a putut deduce tipul listei. Alegeți tipul explicit (specificații, piese, …).');
      else put(kind, json);
    } else if (json && typeof json === 'object') {
      const keys = PACK_KEYS.filter((k) => k in json);
      if (keys.length) {
        for (const k of keys) {
          const v = json[k];
          // acceptă și forma fișierului, ex. { specs: { specs: [...] } }
          if (v && !Array.isArray(v) && typeof v === 'object' && Array.isArray(v[k])) put(k, v[k]);
          else put(k, v);
        }
        if (json.parts && !Array.isArray(json.parts) && json.parts.assemblies) put('assemblies', json.parts.assemblies);
      } else if (json.id) {
        const kind = forced || guessKind(json);
        if (!kind) errors.push('Obiect cu „id”, dar tipul nu a putut fi dedus. Alegeți tipul explicit.');
        else put(kind, [json]);
      } else {
        errors.push('Format necunoscut. Se acceptă: o listă de elemente, un fișier de date (ex. { "specs": [...] }) sau un pachet { specs, parts, lessons, faults, tools }.');
      }
    } else {
      errors.push('Conținutul nu este un obiect sau o listă JSON.');
    }
    if (forced && Array.isArray(json) === false && !(forced in pack) && !errors.length) {
      errors.push(`Fișierul nu conține elemente de tipul ales („${kindLabel(forced)}”).`);
    }
    // specificațiile importate nu pot intra direct ca VERIFICATE fără sursă — politica se aplică la încărcare
    return { pack, kinds: Object.keys(pack), errors };
  }

  /** Diferențe între datele curente și pachet. */
  diff(currentData, pack) {
    const added = []; const modified = []; const unchanged = [];
    for (const [kind, items] of Object.entries(pack)) {
      const [file, key] = OVERRIDE_TARGETS[kind] || [];
      const list = currentData?.[file]?.[key] || [];
      const byId = new Map(list.map((x) => [x.id, x]));
      for (const item of items) {
        const old = byId.get(item.id);
        const label = item.name || item.title || old?.name || old?.title || item.id;
        if (!old) { added.push({ kind, id: item.id, label }); continue; }
        const fields = Object.keys(item).filter((f) => JSON.stringify(item[f]) !== JSON.stringify(old[f]));
        if (fields.length) modified.push({ kind, id: item.id, label, fields });
        else unchanged.push({ kind, id: item.id, label });
      }
    }
    return { added, modified, unchanged };
  }

  /** Validează datele de bază + suprascrierile existente + pachetul nou. */
  validateCombined(baseData, pack) {
    const merged = this._mergeOverrides(this.getOverrides(), pack);
    const combined = applyOverrides(baseData, merged);
    if (!this.validate) return { errors: [], warnings: ['Validatorul de date (validateData) nu este disponibil — importul nu a putut fi verificat complet.'] };
    try {
      const r = this.validate(combined) || {};
      return { errors: r.errors || [], warnings: r.warnings || [] };
    } catch (err) {
      return { errors: [`Validatorul a eșuat: ${err.message}`], warnings: [] };
    }
  }

  _mergeOverrides(existing, pack) {
    const out = clone(existing || {});
    for (const [kind, items] of Object.entries(pack || {})) out[kind] = mergeById(out[kind] || [], items);
    return out;
  }

  applyPack(pack) {
    const merged = this._mergeOverrides(this.getOverrides(), pack);
    this.storage.set('overrides', merged);
    return this.storage.save();
  }

  clearOverrides() {
    this.storage.set('overrides', {});
    return this.storage.save();
  }

  // ---------- export ----------
  download(filename, obj) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  /** Datele curente, cu legăturile către documente incluse la specificații/piese/lecții. */
  buildExportData(data) {
    const out = clone(data);
    const docName = (id) => this.listPdfs().find((p) => p.id === id)?.name || null;
    const attach = (kind, list) => {
      for (const item of list || []) {
        const link = this.getLink(kind, item.id);
        if (link) item.documentLink = { document: docName(link.docId), docId: link.docId, page: link.page, section: link.section || null };
      }
    };
    attach('spec', out.specs?.specs);
    attach('part', out.parts?.parts);
    attach('lesson', out.lessons?.lessons);
    out._export = { app: 'BMW B48 Mechanic Simulator', date: new Date().toISOString(),
      note: 'Valorile marcate NEVERIFICATĂ nu se folosesc pe un motor real.' };
    return out;
  }

  buildExportOverrides() {
    return { ...this.getOverrides(), _links: this.storage.get('links', {}),
      _pdfs: this.listPdfs().map(({ id, name, size, date, note }) => ({ id, name, size, date, note })),
      _export: { date: new Date().toISOString(), note: 'Suprascrieri importate local. Fișierele PDF nu sunt incluse.' } };
  }

  // ---------- legături document ----------
  _linkKey(kind, id) { return `${kind}:${id}`; }
  getLink(kind, id) { return this.storage.get('links', {})?.[this._linkKey(kind, id)] || null; }
  allLinks() { return this.storage.get('links', {}) || {}; }
  setLink(kind, id, { docId, page = null, section = '' }) {
    const links = { ...(this.storage.get('links', {}) || {}) };
    links[this._linkKey(kind, id)] = { docId, page: page === '' || page == null ? null : Number(page), section: section || '', date: new Date().toISOString() };
    this.storage.set('links', links);
    this.storage.save();
  }
  removeLink(kind, id) {
    const links = { ...(this.storage.get('links', {}) || {}) };
    delete links[this._linkKey(kind, id)];
    this.storage.set('links', links);
    this.storage.save();
  }

  /**
   * Încearcă marcarea unei specificații ca VERIFICATĂ.
   * Condiții: document asociat existent în bibliotecă + pagină + varianta specificației == varianta selectată (≠ demo).
   */
  canVerify(spec, selectedVariant, variantForSpec = spec?.variant) {
    const reasons = [];
    const link = spec ? this.getLink('spec', spec.id) : null;
    if (!link) reasons.push('Nu există un document asociat din bibliotecă.');
    else {
      if (!this.listPdfs().some((p) => p.id === link.docId)) reasons.push('Documentul asociat nu mai există în bibliotecă.');
      if (!link.page) reasons.push('Lipsește pagina din document.');
    }
    if (!selectedVariant || selectedVariant === 'demo') reasons.push('Varianta motorului nu este aleasă (este „demo”).');
    else if (variantForSpec !== selectedVariant) reasons.push(`Varianta specificației („${variantForSpec ?? '—'}”) diferă de varianta selectată („${selectedVariant}”).`);
    return { ok: reasons.length === 0, reasons, link };
  }

  markVerified(spec, selectedVariant, { value, min, max, angle } = {}) {
    const check = this.canVerify(spec, selectedVariant, selectedVariant);
    if (!check.ok) return check;
    const doc = this.listPdfs().find((p) => p.id === check.link.docId);
    const item = { id: spec.id, status: 'VERIFICATĂ', demo: false, variant: selectedVariant,
      source: { document: doc?.name || check.link.docId, section: check.link.section || null, page: check.link.page, url: null } };
    if (value !== undefined && value !== '' && value !== null) item.value = Number(value);
    if (min !== undefined && min !== '' && min !== null) item.min = Number(min);
    if (max !== undefined && max !== '' && max !== null) item.max = Number(max);
    if (angle !== undefined && angle !== '' && angle !== null) item.angle = Number(angle);
    this.applyPack({ specs: [item] });
    return { ok: true, reasons: [] };
  }

  unmarkVerified(specId) {
    this.applyPack({ specs: [{ id: specId, status: 'NEVERIFICATĂ' }] });
  }

  // ---------- bibliotecă PDF ----------
  listPdfs() { return (this.storage.get('pdfs', []) || []).slice(); }

  _db() {
    if (this._dbPromise) return this._dbPromise;
    this._dbPromise = new Promise((resolve, reject) => {
      try {
        if (!('indexedDB' in window)) { reject(new Error('IndexedDB indisponibil')); return; }
        const req = indexedDB.open(IDB_NAME, 1);
        req.onupgradeneeded = () => { req.result.createObjectStore(IDB_STORE); };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error || new Error('IndexedDB: eroare la deschidere'));
        req.onblocked = () => reject(new Error('IndexedDB blocat'));
      } catch (err) { reject(err); }
    });
    this._dbPromise.catch(() => {});
    return this._dbPromise;
  }

  async _idb(mode, fn) {
    const db = await this._db();
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(IDB_STORE, mode);
        const store = tx.objectStore(IDB_STORE);
        const req = fn(store);
        tx.oncomplete = () => resolve(req?.result);
        tx.onerror = () => reject(tx.error || new Error('IndexedDB: tranzacție eșuată'));
        tx.onabort = () => reject(tx.error || new Error('IndexedDB: tranzacție anulată'));
      } catch (err) { reject(err); }
    });
  }

  /** Adaugă un PDF ales de utilizator. Întoarce metadatele (cu `sessionOnly` dacă nu a putut fi persistat). */
  async addPdf(file, note = '') {
    if (!file) throw new Error('Niciun fișier ales.');
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    if (!isPdf) throw new Error(`„${file.name}” nu pare a fi un PDF.`);
    const id = `doc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const meta = { id, name: file.name, size: file.size, date: new Date().toISOString(), note: note || '', sessionOnly: false };
    try {
      await this._idb('readwrite', (s) => s.put(file, id));
    } catch (err) {
      console.warn('[importer] PDF-ul nu a putut fi salvat în IndexedDB — rămâne doar pentru sesiunea curentă.', err);
      meta.sessionOnly = true;
    }
    this.sessionFiles.set(id, file);
    this.storage.set('pdfs', [...this.listPdfs(), meta]);
    this.storage.save();
    return meta;
  }

  updatePdfNote(id, note) {
    this.storage.set('pdfs', this.listPdfs().map((p) => (p.id === id ? { ...p, note } : p)));
    this.storage.save();
  }

  async removePdf(id) {
    this.sessionFiles.delete(id);
    try { await this._idb('readwrite', (s) => s.delete(id)); } catch (err) { /* poate nu era salvat */ }
    this.storage.set('pdfs', this.listPdfs().filter((p) => p.id !== id));
    this.storage.save();
  }

  async getPdfBlob(id) {
    if (this.sessionFiles.has(id)) return this.sessionFiles.get(id);
    try {
      const blob = await this._idb('readonly', (s) => s.get(id));
      if (blob) { this.sessionFiles.set(id, blob); return blob; }
    } catch (err) { /* indisponibil */ }
    return null;
  }

  /** Deschide PDF-ul într-un tab nou (object URL, cu #page=N). */
  async openPdf(id, page = null) {
    const win = window.open('', '_blank');
    const blob = await this.getPdfBlob(id);
    if (!blob) {
      if (win) win.close();
      throw new Error('Fișierul PDF nu mai este disponibil (a fost salvat doar pentru sesiunea anterioară). Adăugați-l din nou în bibliotecă.');
    }
    const url = URL.createObjectURL(blob.type ? blob : new Blob([blob], { type: 'application/pdf' }));
    const full = page ? `${url}#page=${Number(page)}` : url;
    if (win) win.location.href = full; else window.open(full, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 10 * 60 * 1000);
  }
}
