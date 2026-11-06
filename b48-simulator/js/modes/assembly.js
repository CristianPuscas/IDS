/**
 * Modul Asamblare contra timp: motorul pornește cu subansamblul capacului de chiulasă demontat (sim.applyPreset);
 * cronometru vizibil; la final verificare finală + penalizări de timp; clasament local top 10.
 */
import { h, fmtDuration, toast, clear } from '../ui/dom.js';
import { openModal, promptDialog } from '../ui/modal.js';
import { renderReport } from '../ui/dialogFinal.js';

export const ASSEMBLY_PRESET_PARTS = ['capac_motor_acustic', 'bobina_1', 'bobina_2', 'bobina_3', 'bobina_4',
  'senzor_ax_came_admisie', 'senzor_ax_came_evacuare', 'capac_chiulasa', 'garnitura_capac_chiulasa'];

export function createAssemblyMode(app) {
  let t0 = 0; let timer = null; let started = false; let finished = false; let off = null;
  const timeEl = h('span.hud-timer', '00:00');
  const statusEl = h('div.hud-text');

  const board = () => (app.storage.get('leaderboard', []) || []).slice().sort((a, b) => a.time - b.time).slice(0, 10);
  const boardTable = (highlight) => {
    const rows = board();
    return rows.length ? h('table.result-table', h('thead', h('tr', h('th', '#'), h('th', 'Nume'), h('th', 'Timp'), h('th', 'Penalizări'), h('th', 'Data'))),
      h('tbody', rows.map((r, i) => h(`tr${highlight && r.id === highlight ? '.hl' : ''}`, h('td', String(i + 1)), h('td', r.name), h('td', fmtDuration(r.time)),
        h('td', `${Math.round(r.penalty / 1000)} s`), h('td', new Date(r.date).toLocaleDateString('ro-RO'))))))
      : h('p.muted', 'Clasamentul este gol.');
  };

  const remaining = () => ASSEMBLY_PRESET_PARTS.filter((id) => app.sim.getPart(id) && !app.sim.getPartState(id)?.installed).length;
  const update = () => {
    if (!started && (app.sim.stats?.ops || 0) > 0 && !finished) { started = true; t0 = Date.now(); }
    statusEl.textContent = finished ? 'Încheiat.' : `Piese de montat: ${remaining()} · ${started ? 'cronometrul rulează' : 'cronometrul pornește la prima acțiune'}`;
  };

  const setup = () => {
    app.engine.stop(null, { silent: true });
    app.sim.reset();
    app.sim.setEnforce(true);
    const removed = ASSEMBLY_PRESET_PARTS.filter((id) => app.sim.getPart(id));
    const r = app.sim.applyPreset({ removed, flags: { baterie_deconectata: true } });
    if (r && r.ok === false) toast(`Preset parțial: ${r.message}`, 'warn', { details: r.reasons });
    app.sim.setActiveTool(null);
    app.view.clearLeaks();
    app.syncView();
    started = false; finished = false; t0 = 0;
    timeEl.textContent = '00:00';
    clearInterval(timer);
    timer = setInterval(() => { if (started && !finished) timeEl.textContent = fmtDuration(Date.now() - t0); }, 250);
    update();
    app.markSaved();
    app.log('info', 'Asamblare contra timp: remontați subansamblul capacului de chiulasă.');
  };

  const finish = async () => {
    if (finished) return;
    const elapsed = started ? Date.now() - t0 : 0;
    const r = app.engine.check();
    const report = r?.data || { issues: [], leaks: [], startable: false };
    app.engine.showLeaks(report);
    const issues = report.issues || [];
    const errors = app.sim.stats?.errors || 0;
    if (!report.startable || remaining() > 0) {
      app.audio.error();
      openModal({ title: 'Încă nu e gata', size: 'lg', body: h('div', h('p', 'Motorul nu poate porni sau mai sunt piese de montat. Cronometrul continuă.'), renderReport(app, report)) });
      return;
    }
    finished = true;
    clearInterval(timer);
    const penalty = issues.length * 30000 + errors * 15000;
    const total = elapsed + penalty;
    timeEl.textContent = fmtDuration(total);
    update();
    app.audio.success();
    app.engine.start(report);
    const name = (await promptDialog('Timp înregistrat', `Timp: ${fmtDuration(elapsed)} + penalizări ${Math.round(penalty / 1000)} s = ${fmtDuration(total)}. Numele pentru clasament:`, { value: app.storage.get('playerName', '') || 'Mecanic', okLabel: 'Salvează' })) || 'Anonim';
    app.storage.set('playerName', name);
    const entry = { id: `r${Date.now()}`, name, time: total, raw: elapsed, penalty, issues: issues.length, errors, date: Date.now() };
    const lb = [...(app.storage.get('leaderboard', []) || []), entry].sort((a, b) => a.time - b.time).slice(0, 10);
    app.storage.set('leaderboard', lb);
    app.storage.save();
    app.log('success', `Asamblare încheiată în ${fmtDuration(total)} (cu penalizări).`);
    openModal({ title: 'Clasament local — top 10', size: 'md', body: h('div',
      lb.some((x) => x.id === entry.id) ? null : h('p.muted', 'Timpul nu a intrat în top 10.'),
      boardTable(entry.id), h('p.field-note', 'Penalizări: 30 s pentru fiecare problemă la verificarea finală, 15 s pentru fiecare acțiune greșită.')),
    actions: [{ label: 'Închide' }, { label: 'Încă o tură', kind: 'primary', onClick: () => { setup(); } }] });
  };

  return {
    id: 'assembly',
    name: 'Asamblare contra timp',
    enter() {
      app.hud.setMode(h('div.hud-card.hud-exam',
        h('div.hud-title', '⏱ Asamblare contra timp ', timeEl),
        h('div.hud-text', 'Remontați capacul chiulasei, garnitura (nouă!), senzorii, bobinele și capacul acustic; reconectați totul și bateria.'),
        statusEl,
        h('div.btn-row',
          h('button.btn.btn-sm.btn-primary', { type: 'button', onclick: finish }, 'Gata — verifică'),
          h('button.btn.btn-sm', { type: 'button', onclick: setup }, 'Reîncepe'),
          h('button.btn.btn-sm', { type: 'button', onclick: () => openModal({ title: 'Clasament local — top 10', body: boardTable() }) }, 'Clasament'))));
      off = app.bus.on('sim:changed', update);
      setup();
      app.left?.activate('bench');
    },
    exit() { clearInterval(timer); off?.(); off = null; },
    hasUnsavedProgress() { return started && !finished; }
  };
}
