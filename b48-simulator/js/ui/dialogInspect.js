/**
 * Dialogul de inspecție: afișează constatările întoarse de sim.inspect.
 */
import { h, toast } from './dom.js';
import { openModal } from './modal.js';

export async function openInspectDialog(app, partId) {
  const { sim } = app;
  const part = sim.getPart(partId);
  if (!part) { toast(`Piesă necunoscută: ${partId}`, 'error'); return null; }
  const r = sim.inspect(partId);
  if (!r?.ok) return r;
  const findings = r.data?.findings || [];
  const body = h('div.inspect',
    h('p.muted', `${part.name} — ${part.accuracy === 'schematic' ? 'model schematic' : 'model educațional aproximativ'}. Constatările sunt simulate.`),
    findings.length
      ? h('ul.findings', findings.map((f) => h(`li.finding${f.defect ? '.finding-bad' : '.finding-ok'}`,
        h('span.finding-icon', { 'aria-hidden': 'true' }, f.defect ? '⚠' : '✔'),
        h('div', h('strong', f.name || f.id), h('div', f.text || '')))))
      : h('p', r.message || 'Nicio constatare.'),
    findings.some((f) => f.defect) ? h('p.warn-text', 'S-au găsit anomalii. Notați-le pentru diagnostic.') : null);
  if (findings.some((f) => f.defect)) app.audio.error(); else app.audio.chime();
  await openModal({ title: `Inspecție — ${part.name}`, body, actions: [{ label: 'Închide', kind: 'primary', autofocus: true }] }).result;
  return r;
}
