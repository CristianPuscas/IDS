/**
 * Dialogul de strângere: cuplu (Nm), unghi (dacă specificația cere), ordinea șuruburilor pe o diagramă 2D.
 * Ordinea apăsată de utilizator se trimite ca `order` la sim.tighten.
 */
import { h, toast } from './dom.js';
import { openModal } from './modal.js';
import { renderSpec } from './specView.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const svg = (tag, attrs = {}) => {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
};

/** Poziții ale șuruburilor pe perimetrul unui capac dreptunghiular rotunjit. */
function boltPositions(count, w = 520, hgt = 200, pad = 30) {
  if (count <= 0) return [];
  if (count === 1) return [[w / 2, hgt / 2]];
  if (count <= 4 && count !== 4) return Array.from({ length: count }, (_, i) => [pad + ((w - 2 * pad) * i) / (count - 1), hgt / 2]);
  const x0 = pad; const y0 = pad; const x1 = w - pad; const y1 = hgt - pad;
  const per = 2 * (x1 - x0) + 2 * (y1 - y0);
  const pts = [];
  for (let i = 0; i < count; i++) {
    let d = ((i + 0.5) / count) * per;
    if (d < x1 - x0) { pts.push([x0 + d, y0]); continue; } d -= x1 - x0;
    if (d < y1 - y0) { pts.push([x1, y0 + d]); continue; } d -= y1 - y0;
    if (d < x1 - x0) { pts.push([x1 - d, y1]); continue; } d -= x1 - x0;
    pts.push([x0, y1 - d]);
  }
  return pts;
}

/**
 * @returns {Promise<object|null>} Result sim.tighten sau null (anulat)
 */
export function openTightenDialog(app, partId, { params = null } = {}) {
  const { sim } = app;
  const part = sim.getPart(partId);
  if (!part) { toast(`Piesă necunoscută: ${partId}`, 'error'); return Promise.resolve(null); }
  const fx = part.fasteners;
  if (!fx) {
    toast(`${part.name} nu are elemente de fixare de strâns.`, 'info');
    return Promise.resolve(null);
  }
  const mode = app.modes?.currentId;
  const exam = mode === 'exam';
  const guided = mode === 'guided';
  const torqueSpec = fx.torqueSpec ? sim.getSpec(fx.torqueSpec) : null;
  const seqSpec = fx.sequenceSpec ? sim.getSpec(fx.sequenceSpec) : null;
  const needsAngle = !!(torqueSpec && Number(torqueSpec.angle));
  const count = Math.max(0, Math.min(40, Number(fx.count) || 0));
  const order = [];

  // sculă: activă + chei dinamometrice + sculele de fixare
  const toolIds = new Set([sim.activeTool, ...(fx.tools || []),
    ...((app.data.tools?.tools || []).filter((t) => t.category === 'torque').map((t) => t.id))].filter(Boolean));
  const usable = [...toolIds].map((id) => sim.getTool(id)).filter(Boolean).filter((t) => app.modes?.isToolUsable?.(t.id) ?? true);
  const toolSel = h('select.input', { 'aria-label': 'Sculă folosită la strângere' },
    usable.length ? usable.map((t) => h('option', { value: t.id }, `${t.icon || ''} ${t.name}${t.range && !/Nm/.test(t.name) ? ` (${t.range[0]}–${t.range[1]} Nm)` : ''}`))
      : h('option', { value: '' }, '— nicio sculă potrivită —'));
  // implicit: scula activă dacă e cheie dinamometrică; altfel cheia dinamometrică potrivită domeniului specificației
  const torqueTools = usable.filter((t) => t.category === 'torque');
  const active = usable.find((t) => t.id === sim.activeTool);
  const target = Number(torqueSpec?.value);
  const fitting = torqueTools.find((t) => Array.isArray(t.range) && target >= t.range[0] && target <= t.range[1]);
  if (active && (active.category === 'torque' || !torqueTools.length)) toolSel.value = active.id;
  else if (fitting || torqueTools[0]) toolSel.value = (fitting || torqueTools[0]).id;
  else if (active) toolSel.value = active.id;

  const torqueIn = h('input.input', { type: 'number', min: '0', step: '0.5', inputMode: 'decimal', 'aria-label': 'Cuplu în Nm', placeholder: 'ex. 10' });
  const angleIn = h('input.input', { type: 'number', min: '0', max: '360', step: '5', 'aria-label': 'Unghi în grade', placeholder: 'ex. 90' });
  const toolNote = h('div.field-note');
  const err = h('div.form-error', { role: 'alert' });
  const orderText = h('div.order-text');

  const updateTool = () => {
    const t = sim.getTool(toolSel.value);
    if (!t) { toolNote.textContent = 'Alegeți o sculă din inventar.'; return; }
    if (t.category === 'torque') {
      toolNote.textContent = t.range ? `Domeniul cheii: ${t.range[0]}–${t.range[1]} Nm.` : 'Cheie dinamometrică.';
      torqueIn.disabled = false;
    } else {
      toolNote.textContent = 'Atenție: această sculă nu controlează cuplul — strângerea va fi „necontrolată” și va fi semnalată la verificarea finală.';
      torqueIn.disabled = true;
    }
  };
  toolSel.addEventListener('change', updateTool);

  // diagrama șuruburilor
  const W = 520; const H = 200;
  const pts = boltPositions(count, W, H);
  const diagram = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'bolt-diagram', role: 'group', 'aria-label': 'Diagrama șuruburilor — apăsați în ordinea de strângere' });
  diagram.appendChild(svg('rect', { x: 14, y: 14, width: W - 28, height: H - 28, rx: 26, class: 'bolt-cover' }));
  const label = svg('text', { x: W / 2, y: count <= 3 ? H - 24 : H / 2 + 5, 'text-anchor': 'middle', class: 'bolt-cover-label' });
  label.textContent = part.name;
  diagram.appendChild(label);
  const boltEls = pts.map(([x, y], i) => {
    const g = svg('g', { class: 'bolt', tabindex: '0', role: 'button', 'aria-label': `Șurubul ${i + 1}` });
    g.appendChild(svg('circle', { cx: x, cy: y, r: 15 }));
    const t = svg('text', { x, y: y + 4, 'text-anchor': 'middle', class: 'bolt-idx' }); t.textContent = String(i + 1);
    const o = svg('text', { x: x + 14, y: y - 12, 'text-anchor': 'middle', class: 'bolt-order' });
    g.appendChild(t); g.appendChild(o);
    const pick = () => {
      if (order.includes(i + 1)) return;
      order.push(i + 1);
      app.audio.ratchet(1);
      renderOrder();
    };
    g.addEventListener('click', pick);
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
    diagram.appendChild(g);
    return { g, o };
  });
  const renderOrder = () => {
    boltEls.forEach(({ g, o }, i) => {
      const pos = order.indexOf(i + 1);
      g.classList.toggle('done', pos >= 0);
      o.textContent = pos >= 0 ? String(pos + 1) : '';
    });
    orderText.textContent = order.length ? `Ordinea aleasă (${order.length}/${count}): ${order.join(' → ')}` : 'Apăsați șuruburile în ordinea în care doriți să le strângeți.';
  };

  const prefillFromSpec = () => {
    if (torqueSpec?.value != null) torqueIn.value = torqueSpec.value;
    if (needsAngle) angleIn.value = torqueSpec.angle;
    if (Array.isArray(seqSpec?.order)) { order.splice(0, order.length, ...seqSpec.order); renderOrder(); }
  };
  if (guided && params) {
    if (params.torque != null) torqueIn.value = params.torque;
    if (params.angle != null) angleIn.value = params.angle;
    if (Array.isArray(params.order)) order.push(...params.order);
  }

  const body = h('div.tighten',
    h('p.muted', `${part.name} — ${count} × ${fx.type || 'element de fixare'} ${fx.size || ''}${fx.sizeStatus ? ` (dimensiune ${fx.sizeStatus})` : ''}`),
    h('div.form-grid',
      h('label.field', h('span', 'Sculă'), toolSel, toolNote),
      h('label.field', h('span', 'Cuplu (Nm)'), torqueIn),
      needsAngle ? h('label.field', h('span', 'Unghi suplimentar (°)'), angleIn) : null),
    count > 0 ? h('div.bolt-wrap', diagram, h('div.bolt-actions', orderText,
      h('button.btn.btn-sm', { type: 'button', onclick: () => { order.length = 0; renderOrder(); } }, 'Șterge ordinea'),
      h('button.btn.btn-sm', { type: 'button', onclick: () => { order.length = 0; for (let i = 1; i <= count; i++) order.push(i); renderOrder(); } }, 'Ordine 1…N'))) : null,
    h('div.spec-list',
      torqueSpec ? renderSpec(torqueSpec, app, { hideValue: exam }) : h('div.spec.spec-missing', 'Fără specificație de cuplu.'),
      seqSpec ? renderSpec(seqSpec, app, { hideValue: exam }) : null,
      guided && (torqueSpec || seqSpec) ? h('button.btn.btn-sm', { type: 'button', onclick: prefillFromSpec }, 'Completează din specificația demonstrativă') : null),
    h('p.disclaimer', 'Valorile NEVERIFICATE / demonstrative sunt doar pentru simulator — nu se folosesc pe un motor real.'),
    err);

  updateTool();
  renderOrder();

  const m = openModal({
    title: `Strângere — ${part.name}`, size: 'lg', body,
    actions: [
      { label: 'Renunță', value: null },
      {
        label: 'Strânge', kind: 'primary', onClick: () => {
          err.textContent = '';
          const tool = sim.getTool(toolSel.value);
          if (!tool) { err.textContent = 'Alegeți o sculă.'; return false; }
          let torque = null;
          if (tool.category === 'torque') {
            torque = Number(String(torqueIn.value).replace(',', '.'));
            if (!torqueIn.value || !Number.isFinite(torque) || torque <= 0) { err.textContent = 'Introduceți un cuplu valid (Nm, număr pozitiv).'; torqueIn.focus(); return false; }
            if (Array.isArray(tool.range) && (torque < tool.range[0] || torque > tool.range[1])) {
              err.textContent = `Cuplul ${torque} Nm este în afara domeniului cheii (${tool.range[0]}–${tool.range[1]} Nm). Alegeți altă cheie dinamometrică.`;
              return false;
            }
          }
          let angle = null;
          if (needsAngle && angleIn.value !== '') {
            angle = Number(String(angleIn.value).replace(',', '.'));
            if (!Number.isFinite(angle) || angle < 0 || angle > 360) { err.textContent = 'Unghiul trebuie să fie între 0 și 360°.'; return false; }
          }
          const ord = order.length ? order.slice() : null;
          let r;
          try {
            r = sim.tighten(partId, { toolId: tool.id, torque, angle, order: ord });
          } catch (e) {
            err.textContent = `Eroare internă: ${e.message}`; return false;
          }
          if (!r?.ok && r?.data?.applied) return r; // strângere aplicată, dar greșită — explicată de glue
          if (!r?.ok) {
            err.textContent = [r?.message || 'Strângerea a fost refuzată.', ...(r?.reasons || [])].join(' ');
            return false;
          }
          reportTorque(app, partId, r);
          return r;
        }
      }
    ]
  });
  setTimeout(() => (torqueIn.disabled ? toolSel : torqueIn).focus(), 60);
  return m.result.then((v) => (v && typeof v === 'object' ? v : null));
}

function reportTorque(app, partId, r) {
  const st = app.sim.getPartState(partId)?.torque || r.data?.torque || r.data || {};
  const status = st.status;
  const msgs = {
    ok: ['Strângere corectă în limitele specificației (demonstrative).', 'success'],
    under: ['Cuplu insuficient — risc de neetanșeitate. Slăbiți și strângeți din nou.', 'warn'],
    over: ['Cuplu excesiv — piesa/filetul pot fi deteriorate!', 'error'],
    uncontrolled: ['Strângere necontrolată (fără cheie dinamometrică).', 'warn']
  };
  const [msg, lvl] = msgs[status] || [r.message || 'Strângere efectuată.', 'info'];
  const extra = st.sequenceOk === false ? ['Ordinea de strângere nu corespunde specificației — risc de etanșare deficitară.'] : [];
  toast(msg, lvl, { details: extra });
  if (status !== 'ok' || st.sequenceOk === false) app.notices?.explain(`Strângere — ${app.sim.getPart(partId)?.name}`, [msg, ...extra].join(' '), lvl === 'success' ? 'info' : lvl);
}
