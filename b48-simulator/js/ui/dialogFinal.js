/**
 * Raportul verificării finale: probleme, scurgeri, profil de sunet; buton de pornire a motorului.
 */
import { h } from './dom.js';
import { openModal } from './modal.js';
import { ISSUE_LABELS } from './engineControl.js';

const FLUIDS = { ulei: 'ulei', lichid_racire: 'lichid de răcire', aer: 'aer (admisie/supraalimentare)', gaze_evacuare: 'gaze de evacuare', combustibil: 'combustibil' };
const SOUND_LABELS = { misfireCylinder: 'Rateu cilindru', roughness: 'Funcționare neuniformă', chainRattle: 'Zornăit lanț', turboWhistle: 'Șuierat turbo', knock: 'Bătăi', hiss: 'Șuierat scăpare aer', noStart: 'Nu pornește' };

export function renderReport(app, report) {
  const { sim } = app;
  const issues = report?.issues || [];
  const leaks = report?.leaks || [];
  const name = (i) => sim.getPart(i.partId)?.name || sim.getConnector(i.connectorId)?.name || sim.getFlagDef(i.flagId)?.name || '';
  const sound = report?.sound || {};
  const soundItems = Object.entries(sound).filter(([, v]) => v && v !== 0);
  return h('div.report',
    h(`div.report-status.${report?.startable ? 'ok' : 'bad'}`,
      report?.startable ? (issues.length ? '⚠ Motorul poate porni, dar există probleme.' : '✔ Totul este în ordine — motorul poate porni.') : '✖ Motorul NU poate porni în această stare.'),
    h('h3.sub', `Probleme (${issues.length})`),
    issues.length ? h('ul.issue-list', issues.map((i) => h(`li.issue.issue-${i.type}`,
      h('span.badge.badge-warn', ISSUE_LABELS[i.type] || i.type), ' ', h('span', i.message), name(i) ? h('span.muted', ` — ${name(i)}`) : null)))
      : h('p.muted', 'Nicio problemă detectată.'),
    h('h3.sub', `Scurgeri (${leaks.length})`),
    leaks.length ? h('ul', leaks.map((l) => h('li', `${sim.getPart(l.partId)?.name || l.partId}: ${FLUIDS[l.fluid] || l.fluid}`))) : h('p.muted', 'Nicio scurgere.'),
    soundItems.length ? h('div', h('h3.sub', 'Ce se va auzi'), h('ul', soundItems.map(([k, v]) => h('li', `${SOUND_LABELS[k] || k}${typeof v === 'number' && k !== 'misfireCylinder' ? `: ${Math.round(v * 100)}%` : k === 'misfireCylinder' ? `: ${v}` : ''}`)))) : null,
    h('p.disclaimer', 'Verificare simulată pe baza stării modelului educațional. Nu înlocuiește procedurile oficiale BMW.'));
}

export async function openFinalCheckDialog(app) {
  const r = app.engine.check();
  if (!r?.data) return r;
  const report = r.data;
  app.engine.showLeaks(report);
  if (report.startable && !(report.issues || []).length) app.audio.success(); else app.audio.error();
  const m = openModal({
    title: 'Verificare finală', size: 'lg', body: renderReport(app, report),
    actions: [
      { label: 'Închide', value: 'close' },
      { label: report.startable ? 'Pornește motorul' : 'Încearcă pornirea', kind: 'primary', autofocus: true, value: 'start' }
    ]
  });
  const choice = await m.result;
  if (choice === 'start') await app.engine.start(report);
  return r;
}
