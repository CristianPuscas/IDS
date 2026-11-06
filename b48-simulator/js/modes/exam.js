/**
 * Modul Examen: reguli impuse, fără indicii, fără valori de specificație în dialoguri.
 * Sarcina: demontează și remontează subansamblul capacului de chiulasă. Scor final din sim.stats (greșeli, cuplu, timp).
 */
import { h, fmtDuration, toast } from '../ui/dom.js';
import { openModal, confirmDialog } from '../ui/modal.js';
import { renderReport } from '../ui/dialogFinal.js';

const KEY_PART = 'capac_chiulasa';

export function createExamMode(app) {
  let t0 = 0; let timer = null; let removedOnce = false; let finished = false; let off = null;
  const timeEl = h('span.hud-timer', '00:00');
  const phaseEl = h('div.hud-text');

  const updatePhase = () => {
    const inst = app.sim.getPartState(KEY_PART)?.installed;
    if (inst === false) removedOnce = true;
    phaseEl.textContent = finished ? 'Examen încheiat.' : !removedOnce
      ? 'Etapa 1: pregătiți motorul și demontați capacul chiulasei (cu tot ce îl blochează).'
      : inst ? 'Etapa 2 încheiată? Rulați „Termină examenul” când totul e remontat și strâns.' : 'Etapa 2: remontați subansamblul complet (garnitură nouă, cupluri, ordine, conectori, baterie).';
  };

  const finish = async () => {
    if (finished) return;
    if (!(await confirmDialog('Termină examenul', 'Se rulează verificarea finală și se calculează scorul. Continuați?', { okLabel: 'Termină' }))) return;
    finished = true;
    clearInterval(timer);
    const elapsed = Date.now() - t0;
    const r = app.engine.check();
    const report = r?.data || { issues: [], leaks: [], startable: false };
    app.engine.showLeaks(report);
    const s = app.sim.stats || {};
    const issues = report.issues || [];
    const count = (types) => issues.filter((i) => types.includes(i.type)).length;
    const lines = [];
    let score = 100;
    const pen = (label, pts) => { if (pts > 0) { score -= pts; lines.push([label, -pts]); } };
    if (!removedOnce) pen('Sarcina nu a fost efectuată (capacul nu a fost demontat)', 100);
    pen(`Greșeli / acțiuni refuzate (${s.errors || 0} × 4)`, (s.errors || 0) * 4);
    pen(`Cuplu/ordine incorecte (${count(['torque', 'sequence'])} × 10)`, count(['torque', 'sequence']) * 10);
    pen(`Fixări incomplete (${count(['fastener'])} × 10)`, count(['fastener']) * 10);
    pen(`Piese lipsă (${count(['missing'])} × 15)`, count(['missing']) * 15);
    pen(`Garnituri reutilizate (${count(['gasket'])} × 10)`, count(['gasket']) * 10);
    pen(`Conectori / stări nerezolvate (${count(['connector', 'flag'])} × 5)`, count(['connector', 'flag']) * 5);
    pen(`Piese deteriorate (${count(['damaged'])} × 10)`, count(['damaged']) * 10);
    if (!report.startable) pen('Motorul nu poate porni', 20);
    const min = elapsed / 60000;
    pen(`Timp peste 20 min (${Math.max(0, Math.round(min - 20))} min × 1)`, Math.max(0, Math.round(min - 20)));
    score = Math.max(0, Math.min(100, Math.round(score)));
    const best = Math.max(app.storage.get('examBest', 0) || 0, score);
    app.storage.set('examBest', best);
    app.storage.save();
    app.log(score >= 70 ? 'success' : 'warn', `Examen încheiat: ${score}/100 în ${fmtDuration(elapsed)}.`);
    if (score >= 70) app.audio.success(); else app.audio.error();
    updatePhase();
    openModal({ title: 'Rezultat examen', size: 'lg', body: h('div',
      h('div.quiz-summary', h('div.big', `${score}/100`), h('p', `Timp: ${fmtDuration(elapsed)} · Cel mai bun scor: ${best}`)),
      h('table.result-table', h('tbody', lines.length ? lines.map(([l, p]) => h('tr', h('td', l), h('td.bad', String(p)))) : h('tr', h('td', 'Fără penalizări — excelent!')))),
      (s.mistakes || []).length ? h('details', h('summary', `Greșeli înregistrate (${s.mistakes.length})`),
        h('ul', s.mistakes.slice(-30).map((m) => h('li', `${m.action} ${m.target || ''}: ${(m.reasons || []).join('; ')}`)))) : null,
      renderReport(app, report)),
    actions: [{ label: 'Închide' }, { label: 'Examen nou', kind: 'primary', onClick: () => { start(); } }] });
  };

  const start = () => {
    app.engine.stop(null, { silent: true });
    app.sim.reset();
    app.sim.setEnforce(true);
    app.sim.setActiveTool(null);
    app.view.setHint(null);
    app.view.clearLeaks();
    app.syncView();
    removedOnce = false; finished = false;
    t0 = Date.now();
    clearInterval(timer);
    timer = setInterval(() => { timeEl.textContent = fmtDuration(Date.now() - t0); }, 500);
    updatePhase();
    app.markSaved();
    app.log('info', 'Examen început: demontați și remontați subansamblul capacului de chiulasă.');
  };

  return {
    id: 'exam',
    name: 'Examen',
    enter() {
      app.hud.setMode(h('div.hud-card.hud-exam',
        h('div.hud-title', '📝 Examen ', timeEl),
        h('div.hud-text', h('strong', 'Sarcină: '), 'demontați și remontați subansamblul capacului de chiulasă (capac acustic, bobine, senzori, capac, garnitură). Fără indicii, valorile de specificație sunt ascunse.'),
        phaseEl,
        h('div.btn-row', h('button.btn.btn-sm.btn-primary', { type: 'button', onclick: finish }, 'Termină examenul'),
          h('button.btn.btn-sm', { type: 'button', onclick: async () => { if (await confirmDialog('Reîncepe examenul', 'Starea curentă se pierde.', { danger: true, okLabel: 'Reîncepe' })) start(); } }, 'Reîncepe'))));
      off = app.bus.on('sim:changed', updatePhase);
      start();
      toast('Examen început. Mult succes!', 'info');
    },
    exit() { clearInterval(timer); off?.(); off = null; },
    hasUnsavedProgress() { return !finished && (app.sim.stats?.ops || 0) > 0; }
  };
}
