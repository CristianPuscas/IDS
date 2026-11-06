/**
 * Dialogul de măsurare: afișează valoarea măsurată și cere decizia „În toleranță?” (Da/Nu) → feedback + scor.
 * În modul ghidat arată și limitele specificației.
 */
import { h, toast } from './dom.js';
import { openModal } from './modal.js';
import { renderSpec, formatSpecValue } from './specView.js';

const fmtNum = (v) => (v == null ? '—' : typeof v === 'number' ? String(Math.round(v * 1000) / 1000).replace('.', ',') : String(v));

function chooseMeasurement(app, part) {
  const list = part.measurements || [];
  if (!list.length) { toast(`${part.name} nu are măsurători definite.`, 'info'); return Promise.resolve(null); }
  if (list.length === 1) return Promise.resolve(list[0].id);
  const m = openModal({
    title: `Măsurare — ${part.name}`, size: 'sm',
    body: h('div.choice-list', list.map((x) => h('button.btn.btn-block', { type: 'button', onclick: () => m.close(x.id) },
      `${x.name}${x.tool ? ` — ${app.sim.getTool(x.tool)?.name || x.tool}` : ''}`))),
    actions: [{ label: 'Renunță', value: null }]
  });
  return m.result;
}

export async function openMeasureDialog(app, partId, measId) {
  const { sim } = app;
  const part = sim.getPart(partId);
  if (!part) { toast(`Piesă necunoscută: ${partId}`, 'error'); return null; }
  if (!measId) measId = await chooseMeasurement(app, part);
  if (!measId) return null;
  const def = (part.measurements || []).find((x) => x.id === measId) || { id: measId, name: measId };
  const r = sim.measure(partId, measId, sim.activeTool);
  if (!r?.ok) return r;               // glue afișează motivul
  const d = r.data || {};
  const spec = d.spec || (def.specRef ? sim.getSpec(def.specRef) : null);
  const guided = app.modes?.currentId === 'guided';
  const exam = app.modes?.currentId === 'exam';
  const unit = d.unit || spec?.unit || '';
  const feedback = h('div.feedback', { 'aria-live': 'polite' });
  const valueBox = h('div.measure-value', h('span.big', fmtNum(Array.isArray(d.value) ? d.value.join(' / ') : d.value)), h('span.unit', unit));

  const body = h('div.measure',
    h('p', `${def.name} — ${part.name}`),
    h('p.muted', `Sculă: ${sim.getTool(sim.activeTool)?.name || '—'}`),
    valueBox,
    d.value == null ? h('p.warn-text', r.message || 'Fără specificație — valoarea nu poate fi evaluată.') : null,
    guided && spec ? h('div.hint-box', h('strong', 'Limite (ghidat): '), formatSpecValue(spec)) : null,
    spec && !exam ? renderSpec(spec, app, { compact: !guided }) : null,
    h('p.question', 'Valoarea măsurată este în toleranță?'),
    feedback);

  const answer = (yes) => {
    const truth = Array.isArray(d.inTolerance) ? d.inTolerance.every(Boolean) : d.inTolerance;
    if (truth == null) {
      feedback.className = 'feedback feedback-info';
      feedback.textContent = 'Nu există o specificație pentru comparație — decizia nu poate fi punctată.';
      return;
    }
    const correct = (!!yes) === (!!truth);
    app.score.record('measure', correct);
    feedback.className = `feedback ${correct ? 'feedback-ok' : 'feedback-bad'}`;
    feedback.textContent = correct
      ? `Corect! Valoarea ${truth ? 'este' : 'NU este'} în toleranță${spec ? ` (${formatSpecValue(spec)})` : ''}.`
      : `Greșit. Valoarea ${truth ? 'este' : 'NU este'} în toleranță${spec && !exam ? ` (${formatSpecValue(spec)})` : ''}.`;
    if (correct) app.audio.success(); else app.audio.error();
    app.log(correct ? 'success' : 'warn', `Măsurare ${def.name} (${part.name}): ${fmtNum(d.value)} ${unit} — decizie ${correct ? 'corectă' : 'greșită'}.`);
    m.setActions([{ label: 'Închide', kind: 'primary', value: r, autofocus: true }]);
  };

  const m = openModal({
    title: `Măsurare — ${def.name}`, size: 'md', body,
    actions: [
      { label: 'Nu, în afara toleranței', onClick: () => { answer(false); return false; } },
      { label: 'Da, în toleranță', kind: 'primary', onClick: () => { answer(true); return false; } }
    ]
  });
  await m.result;
  return r;
}
