/**
 * Dialogul de teste la nivel de motor (compresie uscat/umed, pierderi de presiune, presiune ulei, …).
 * Rezultatele per cilindru se adună într-un tabel.
 */
import { h, toast } from './dom.js';
import { openModal } from './modal.js';
import { renderSpec } from './specView.js';

const fmt = (v) => (v == null ? '—' : typeof v === 'number' ? String(Math.round(v * 100) / 100).replace('.', ',') : String(v));
const VARIANT_LABELS = { uscat: 'Uscat', umed: 'Umed (cu ulei în cilindru)' };

function requirementsList(app, req = {}) {
  const { sim } = app;
  const items = [];
  for (const id of req.removed || []) items.push([`Demontat: ${sim.getPart(id)?.name || id}`, !sim.getPartState(id)?.installed]);
  for (const id of req.installed || []) items.push([`Montat: ${sim.getPart(id)?.name || id}`, !!sim.isOnEngine(id)]);
  for (const [id, v] of Object.entries(req.flags || {})) items.push([`${sim.getFlagDef(id)?.name || id}: ${v ? 'da' : 'nu'}`, sim.getFlag(id) === v]);
  return items;
}

export async function openTestDialog(app, testId, { variant = null } = {}) {
  const { sim } = app;
  const tests = app.data.tests?.tests || [];
  if (!testId) {
    const pick = openModal({ title: 'Alege testul', size: 'sm',
      body: h('div.choice-list', tests.map((t) => h('button.btn.btn-block', { type: 'button', onclick: () => pick.close(t.id) }, t.name))),
      actions: [{ label: 'Renunță', value: null }] });
    testId = await pick.result;
    if (!testId) return null;
  }
  const test = sim.getTest(testId);
  if (!test) { toast(`Test necunoscut: ${testId}`, 'error'); return null; }
  const exam = app.modes?.currentId === 'exam';
  const spec = test.specRef ? sim.getSpec(test.specRef) : null;
  const tool = test.tool ? sim.getTool(test.tool) : null;
  const variants = Array.isArray(test.variants) && test.variants.length ? test.variants : [null];
  let current = variant && variants.includes(variant) ? variant : variants[0];
  let lastResult = null;

  const reqBox = h('ul.req-list');
  const renderReq = () => {
    reqBox.replaceChildren(...requirementsList(app, test.requires).map(([t, ok]) => h(`li.${ok ? 'req-ok' : 'req-bad'}`, (ok ? '✔ ' : '✖ ') + t)));
    if (!reqBox.children.length) reqBox.appendChild(h('li.req-ok', '✔ Fără condiții speciale'));
  };
  const toolLine = h('p.muted');
  const renderTool = () => {
    const active = sim.getTool(sim.activeTool);
    toolLine.textContent = `Sculă necesară: ${tool ? tool.name : '—'} · Sculă activă: ${active ? active.name : 'niciuna'}`;
    toolLine.classList.toggle('warn-text', !!tool && sim.activeTool !== tool.id);
  };
  const cyl = test.perCylinder ? 4 : 0;
  const table = h('table.result-table',
    h('thead', h('tr', h('th', 'Rulare'), cyl ? [1, 2, 3, 4].map((i) => h('th', `Cil. ${i}`)) : h('th', 'Valoare'), h('th', 'Unitate'))),
    h('tbody'));
  const tbody = table.querySelector('tbody');
  const variantSel = variants[0] === null ? null : h('div.seg', { role: 'radiogroup', 'aria-label': 'Variantă test' },
    variants.map((v) => h('button.seg-btn', { type: 'button', role: 'radio', 'aria-checked': String(v === current), dataset: { v },
      onclick: (e) => { current = v; variantSel.querySelectorAll('.seg-btn').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.v === v))); } },
    VARIANT_LABELS[v] || v)));
  const msg = h('div.form-error', { role: 'alert' });

  const run = () => {
    msg.textContent = '';
    const r = sim.runTest(testId, { toolId: sim.activeTool, variant: current });
    renderReq(); renderTool();
    if (!r?.ok) { msg.textContent = [r?.message, ...(r?.reasons || [])].filter(Boolean).join(' '); return; }
    lastResult = r;
    const d = r.data || {};
    const vals = Array.isArray(d.values) ? d.values : [d.values];
    const tol = Array.isArray(d.inTolerance) ? d.inTolerance : [d.inTolerance];
    const row = h('tr', h('th', current ? (VARIANT_LABELS[current] || current) : 'Rulare'),
      vals.map((v, i) => h(`td${tol[i] === false ? '.bad' : tol[i] === true ? '.good' : ''}`, fmt(v))),
      h('td', d.unit || spec?.unit || ''));
    tbody.appendChild(row);
    app.audio.chime();
    app.log('info', `${test.name}${current ? ` (${current})` : ''}: ${vals.map(fmt).join(' / ')} ${d.unit || ''}`);
  };

  const body = h('div.test-dlg',
    test.description ? h('p', test.description) : null,
    toolLine,
    h('h3.sub', 'Condiții'), reqBox,
    variantSel ? h('div.field', h('span', 'Variantă'), variantSel) : null,
    table,
    spec ? renderSpec(spec, app, { hideValue: exam, compact: true }) : h('p.muted', 'Fără specificație de referință.'),
    h('p.disclaimer', 'Valorile sunt simulate (NEVERIFICATE) — doar pentru instruire.'),
    msg);
  renderReq(); renderTool();
  const m = openModal({ title: test.name, size: 'lg', body,
    actions: [{ label: 'Închide', value: null }, { label: 'Rulează testul', kind: 'primary', autofocus: true, onClick: () => { run(); return false; } }] });
  await m.result;
  return lastResult;
}
