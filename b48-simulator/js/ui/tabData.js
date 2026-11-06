/**
 * Tab „Date & Import”: import JSON (suprascrieri) cu previzualizare și validare, export, bibliotecă PDF locală,
 * asocieri document ↔ specificație/piesă/lecție și marcarea „VERIFICATĂ” (doar cu document + pagină + variantă potrivită).
 */
import { h, clear, toast, fmtBytes, fmtDate, badge } from './dom.js';
import { confirmDialog, openModal } from './modal.js';
import { kindLabel } from '../core/importer.js';
import { effectiveStatus, formatSpecValue } from './specView.js';

export function createDataTab(app) {
  const el = h('div.datatab');
  let preview = null; // { pack, diff, validation, fileName }
  let linkKind = 'spec';
  let linkTarget = '';

  const render = () => {
    clear(el);
    el.append(statusSection(), importSection(), exportSection(), pdfSection(), linkSection());
  };

  // ---------- stare ----------
  function statusSection() {
    const v = app.validation || { errors: [], warnings: [] };
    return h('section.lsec', h('h3', 'Starea datelor'),
      h('dl.stats',
        h('dt', 'Suprascrieri importate'), h('dd', String(app.importer.countOverrides())),
        h('dt', 'Erori de validare'), h('dd', v.errors.length ? h('span.danger-text', String(v.errors.length)) : '0'),
        h('dt', 'Avertismente'), h('dd', String(v.warnings.length)),
        h('dt', 'Stocare locală'), h('dd', app.storage.available ? 'disponibilă' : h('span.warn-text', 'blocată — doar sesiunea curentă'))),
      v.errors.length || v.warnings.length ? h('button.btn.btn-sm', { type: 'button', onclick: () => app.showValidation() }, 'Arată rezultatul validării') : null,
      h('p.field-note', 'Politică: nicio valoare nu este prezentată ca oficială. O specificație devine „VERIFICATĂ” doar cu document oficial asociat, pagină și varianta de motor selectată.'));
  }

  // ---------- import ----------
  function importSection() {
    const kindSel = h('select.input', { 'aria-label': 'Tipul datelor importate' },
      h('option', { value: 'auto' }, 'Detectare automată / pachet'),
      ['specs', 'parts', 'lessons', 'faults', 'tools'].map((k) => h('option', { value: k }, kindLabel(k))));
    const file = h('input', { type: 'file', accept: '.json,application/json', 'aria-label': 'Alege fișier JSON' });
    const out = h('div.import-preview');
    const doPreview = async () => {
      const f = file.files?.[0];
      if (!f) { toast('Alegeți un fișier JSON.', 'warn'); return; }
      let text;
      try { text = await f.text(); } catch (err) { toast(`Fișierul nu poate fi citit: ${err.message}`, 'error'); return; }
      const parsed = app.importer.parseImport(text, kindSel.value);
      if (parsed.errors.length && !parsed.kinds.length) {
        preview = null;
        clear(out).appendChild(h('div.error-box', h('strong', 'Import imposibil'), h('ul', parsed.errors.map((e) => h('li', e)))));
        return;
      }
      const diff = app.importer.diff(app.data, parsed.pack);
      const validation = app.importer.validateCombined(app.baseData, parsed.pack);
      preview = { pack: parsed.pack, diff, validation, parseErrors: parsed.errors, fileName: f.name };
      renderPreview(out);
    };
    if (preview) renderPreview(out);
    return h('section.lsec', h('h3', 'Import JSON'),
      h('p.field-note', 'Tipuri acceptate: specificații, piese, lecții, defecte, scule sau un pachet { specs, parts, lessons, faults, tools }. Elementele se combină cu datele existente după „id”.'),
      h('label.field', h('span', 'Tip'), kindSel),
      h('label.field', h('span', 'Fișier'), file),
      h('button.btn.btn-sm', { type: 'button', onclick: doPreview }, 'Previzualizează diferențele'),
      out);
  }

  function renderPreview(out) {
    const { diff, validation, parseErrors, fileName } = preview;
    const canApply = !validation.errors.length && (diff.added.length + diff.modified.length) > 0;
    clear(out).append(
      h('p', h('strong', fileName), ` — ${diff.added.length} adăugate, ${diff.modified.length} modificate, ${diff.unchanged.length} neschimbate`),
      diff.added.length ? h('details', { open: true }, h('summary', `Adăugate (${diff.added.length})`),
        h('ul.diff-list', diff.added.slice(0, 100).map((d) => h('li.diff-add', `+ [${kindLabel(d.kind)}] ${d.label} (${d.id})`)))) : null,
      diff.modified.length ? h('details', { open: true }, h('summary', `Modificate (${diff.modified.length})`),
        h('ul.diff-list', diff.modified.slice(0, 100).map((d) => h('li.diff-mod', `~ [${kindLabel(d.kind)}] ${d.label} (${d.id}): ${d.fields.join(', ')}`)))) : null,
      parseErrors.length ? h('div.warn-box', h('strong', 'Observații la citire'), h('ul', parseErrors.map((e) => h('li', e)))) : null,
      validation.errors.length ? h('div.error-box', h('strong', `Erori de validare (${validation.errors.length}) — importul nu poate fi aplicat`), h('ul', validation.errors.slice(0, 30).map((e) => h('li', e)))) : null,
      validation.warnings.length ? h('details.warn-box', h('summary', `Avertismente (${validation.warnings.length})`), h('ul', validation.warnings.slice(0, 30).map((e) => h('li', e)))) : null,
      (preview.pack.specs || []).some((s) => s.status === 'VERIFICATĂ')
        ? h('p.warn-text', 'Specificațiile marcate „VERIFICATĂ” rămân VERIFICATE doar dacă au document + pagină în „source” și varianta egală cu cea selectată; altfel sunt retrogradate automat la NEVERIFICATĂ.') : null,
      h('div.btn-row',
        h('button.btn.btn-primary.btn-sm', { type: 'button', disabled: !canApply, onclick: async () => {
          if (!(await confirmDialog('Aplică importul', 'Datele importate se salvează local și pagina se reîncarcă pentru a reconstrui simularea. Starea curentă nesalvată a motorului se pierde.', { okLabel: 'Aplică și reîncarcă' }))) return;
          const saved = app.importer.applyPack(preview.pack);
          if (!saved) toast('Atenție: stocarea locală nu este disponibilă — importul nu va persista după reîncărcare.', 'warn');
          app.log('success', `Import aplicat din ${preview.fileName}.`);
          app.storage.save();
          setTimeout(() => location.reload(), 300);
        } }, 'Aplică și reîncarcă'),
        h('button.btn.btn-sm', { type: 'button', onclick: () => { preview = null; clear(out); } }, 'Anulează')));
  }

  // ---------- export ----------
  function exportSection() {
    return h('section.lsec', h('h3', 'Export'),
      h('div.btn-col',
        h('button.btn.btn-sm', { type: 'button', onclick: () => app.importer.download('b48sim-date-curente.json', app.importer.buildExportData(app.data)) }, '⬇ Exportă datele curente (JSON)'),
        h('button.btn.btn-sm', { type: 'button', onclick: () => app.importer.download('b48sim-suprascrieri.json', app.importer.buildExportOverrides()) }, '⬇ Exportă suprascrierile + asocierile'),
        h('button.btn.btn-sm.btn-danger', { type: 'button', disabled: !app.importer.hasOverrides(), onclick: async () => {
          if (!(await confirmDialog('Șterge suprascrierile', 'Toate datele importate local vor fi șterse și se revine la data/*.json. Asocierile cu documente și biblioteca PDF se păstrează.', { okLabel: 'Șterge și reîncarcă', danger: true }))) return;
          app.importer.clearOverrides();
          setTimeout(() => location.reload(), 200);
        } }, 'Șterge suprascrierile')));
  }

  // ---------- PDF ----------
  function pdfSection() {
    const file = h('input', { type: 'file', accept: 'application/pdf,.pdf', multiple: true, 'aria-label': 'Alege PDF-uri' });
    const note = h('input.input', { type: 'text', placeholder: 'Notă (ex. manual service, ediția…)', 'aria-label': 'Notă document', maxLength: 200 });
    const add = async () => {
      const files = [...(file.files || [])];
      if (!files.length) { toast('Alegeți cel puțin un PDF.', 'warn'); return; }
      for (const f of files) {
        try {
          const meta = await app.importer.addPdf(f, note.value.trim());
          toast(meta.sessionOnly ? `„${meta.name}” adăugat doar pentru sesiunea curentă (IndexedDB indisponibil).` : `„${meta.name}” adăugat în bibliotecă.`, meta.sessionOnly ? 'warn' : 'success');
        } catch (err) { toast(err.message, 'error'); }
      }
      render();
    };
    const docs = app.importer.listPdfs();
    return h('section.lsec', h('h3', 'Bibliotecă PDF (manuale proprii)'),
      h('p.field-note', 'Fișierele rămân doar în acest browser (IndexedDB). Textul din PDF NU este extras automat — valorile se introduc manual (mai jos) sau prin import JSON.'),
      h('label.field', h('span', 'Fișiere PDF'), file), note,
      h('button.btn.btn-sm', { type: 'button', onclick: add }, '＋ Adaugă în bibliotecă'),
      docs.length ? h('ul.doc-list', docs.map((d) => {
        const page = h('input.input.input-xs', { type: 'number', min: '1', placeholder: 'pag.', 'aria-label': `Pagina pentru ${d.name}` });
        const noteIn = h('input.input.input-xs', { type: 'text', value: d.note || '', 'aria-label': `Notă pentru ${d.name}`, maxLength: 200 });
        noteIn.addEventListener('change', () => app.importer.updatePdfNote(d.id, noteIn.value));
        return h('li.doc',
          h('div.doc-name', '📄 ', d.name, d.sessionOnly ? badge('doar sesiune', 'warn') : null),
          h('div.muted', `${fmtBytes(d.size)} · ${fmtDate(d.date)}`),
          noteIn,
          h('div.btn-row', page,
            h('button.btn.btn-xs', { type: 'button', onclick: () => app.importer.openPdf(d.id, page.value || null).catch((e) => toast(e.message, 'error')) }, 'Deschide'),
            h('button.btn.btn-xs.btn-danger', { type: 'button', onclick: async () => {
              if (!(await confirmDialog('Șterge documentul', `Ștergeți „${d.name}” din bibliotecă? Asocierile către el vor rămâne fără document.`, { danger: true, okLabel: 'Șterge' }))) return;
              await app.importer.removePdf(d.id); render();
            } }, 'Șterge')));
      })) : h('p.muted', 'Biblioteca este goală.'));
  }

  // ---------- asocieri ----------
  function linkSection() {
    const docs = app.importer.listPdfs();
    const lists = {
      spec: (app.data.specs?.specs || []).map((s) => [s.id, s.name || s.id]),
      part: (app.data.parts?.parts || []).map((p) => [p.id, p.name]),
      lesson: (app.data.lessons?.lessons || []).map((l) => [l.id, `${l.code ? l.code + ' — ' : ''}${l.title}`])
    };
    const kindSel = h('select.input', { 'aria-label': 'Tip element', value: linkKind,
      onchange: () => { linkKind = kindSel.value; linkTarget = ''; render(); } },
    h('option', { value: 'spec' }, 'Specificație'), h('option', { value: 'part' }, 'Piesă'), h('option', { value: 'lesson' }, 'Procedură / lecție'));
    const targetSel = h('select.input', { 'aria-label': 'Element', value: linkTarget || lists[linkKind][0]?.[0] || '',
      onchange: () => { linkTarget = targetSel.value; render(); } },
    lists[linkKind].map(([id, name]) => h('option', { value: id }, name)));
    linkTarget = targetSel.value;
    const existing = linkTarget ? app.importer.getLink(linkKind, linkTarget) : null;
    const docSel = h('select.input', { 'aria-label': 'Document', value: existing?.docId || docs[0]?.id || '' },
      docs.length ? docs.map((d) => h('option', { value: d.id }, d.name)) : h('option', { value: '' }, '— biblioteca e goală —'));
    const page = h('input.input', { type: 'number', min: '1', value: existing?.page ?? '', placeholder: 'ex. 112', 'aria-label': 'Pagina' });
    const sectionIn = h('input.input', { type: 'text', value: existing?.section || '', placeholder: 'ex. 11 12 …', 'aria-label': 'Secțiunea', maxLength: 120 });

    const save = () => {
      if (!docSel.value) { toast('Adăugați întâi un PDF în bibliotecă.', 'warn'); return; }
      if (!linkTarget) { toast('Alegeți elementul.', 'warn'); return; }
      const p = page.value ? Number(page.value) : null;
      if (page.value && (!Number.isInteger(p) || p < 1)) { toast('Pagina trebuie să fie un număr întreg ≥ 1.', 'warn'); return; }
      app.importer.setLink(linkKind, linkTarget, { docId: docSel.value, page: p, section: sectionIn.value.trim() });
      toast('Asociere salvată.', 'success');
      app.log('info', `Document asociat la ${linkKind} „${linkTarget}”.`);
      app.refresh(); render();
    };

    let verifyBox = null;
    if (linkKind === 'spec' && linkTarget) {
      const spec = app.sim.getSpec(linkTarget) || (app.data.specs?.specs || []).find((s) => s.id === linkTarget);
      const selected = app.data.variants?.selected;
      const st = effectiveStatus(spec, selected);
      const check = app.importer.canVerify(spec, selected, selected);
      const valIn = h('input.input.input-xs', { type: 'number', step: 'any', placeholder: 'valoare', 'aria-label': 'Valoare oficială' });
      const minIn = h('input.input.input-xs', { type: 'number', step: 'any', placeholder: 'min', 'aria-label': 'Minim' });
      const maxIn = h('input.input.input-xs', { type: 'number', step: 'any', placeholder: 'max', 'aria-label': 'Maxim' });
      verifyBox = h('div.verify-box',
        h('div', 'Status actual: ', st === 'VERIFICATĂ' ? badge('VERIFICATĂ', 'ok') : badge('NEVERIFICATĂ', 'warn'), spec?.demo ? badge('valoare demonstrativă', 'demo') : null),
        h('div.muted', `Valoare curentă: ${formatSpecValue(spec)}`),
        h('p.field-note', 'Introduceți valorile citite din documentul oficial (opțional, dacă diferă), apoi marcați specificația.'),
        h('div.btn-row', valIn, minIn, maxIn),
        check.ok ? null : h('ul.reasons', check.reasons.map((r) => h('li', r))),
        h('div.btn-row',
          h('button.btn.btn-sm.btn-primary', { type: 'button', disabled: !check.ok, onclick: async () => {
            const r = app.importer.markVerified(spec, selected, { value: valIn.value, min: minIn.value, max: maxIn.value });
            if (!r.ok) { toast('Nu se poate marca VERIFICATĂ.', 'error', { details: r.reasons }); return; }
            toast('Specificație marcată VERIFICATĂ. Pagina se reîncarcă.', 'success');
            setTimeout(() => location.reload(), 500);
          } }, 'Marchează VERIFICATĂ'),
          st === 'VERIFICATĂ' ? h('button.btn.btn-sm', { type: 'button', onclick: () => { app.importer.unmarkVerified(spec.id); setTimeout(() => location.reload(), 200); } }, 'Revino la NEVERIFICATĂ') : null));
    }

    const all = Object.entries(app.importer.allLinks());
    return h('section.lsec', h('h3', 'Asocieri document ↔ date'),
      h('p.field-note', 'Legați un document din bibliotecă (pagină + secțiune) de o specificație, piesă sau procedură. Legătura apare în panoul piesei și în exportul JSON.'),
      h('label.field', h('span', 'Tip'), kindSel),
      h('label.field', h('span', 'Element'), targetSel),
      h('label.field', h('span', 'Document'), docSel),
      h('div.form-grid', h('label.field', h('span', 'Pagina'), page), h('label.field', h('span', 'Secțiunea'), sectionIn)),
      h('div.btn-row', h('button.btn.btn-sm', { type: 'button', onclick: save }, 'Salvează asocierea'),
        existing ? h('button.btn.btn-sm', { type: 'button', onclick: () => { app.importer.removeLink(linkKind, linkTarget); app.refresh(); render(); } }, 'Elimină asocierea') : null),
      verifyBox,
      all.length ? h('details', h('summary', `Toate asocierile (${all.length})`), h('ul.plain', all.map(([k, l]) => {
        const doc = docs.find((d) => d.id === l.docId);
        return h('li', `${k} → ${doc ? doc.name : 'document lipsă'}${l.page ? `, p. ${l.page}` : ''}${l.section ? `, ${l.section}` : ''}`);
      }))) : null);
  }

  return { id: 'data', label: 'Date & Import', icon: '🗂', el, render };
}

/** Panou cu rezultatul validării datelor. */
export function showValidationModal(app) {
  const v = app.validation || { errors: [], warnings: [] };
  openModal({ title: 'Validarea datelor', size: 'lg', body: h('div',
    v.errors.length ? h('div.error-box', h('strong', `Erori (${v.errors.length})`), h('ul', v.errors.map((e) => h('li', e)))) : h('p', '✔ Nicio eroare.'),
    v.warnings.length ? h('details.warn-box', { open: v.errors.length === 0 }, h('summary', `Avertismente (${v.warnings.length})`), h('ul', v.warnings.map((e) => h('li', e)))) : null,
    h('p.field-note', 'Aplicația rămâne utilizabilă; elementele cu erori pot funcționa incorect.')) });
}
