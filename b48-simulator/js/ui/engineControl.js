/**
 * Pornirea/oprirea simulată a motorului: verificare finală → scurgeri vizuale → sunet (demaror + ralanti) → animație 3D.
 */
import { toast } from './dom.js';

export const ISSUE_LABELS = {
  missing: 'Piesă lipsă', fastener: 'Fixare incompletă', torque: 'Cuplu incorect', sequence: 'Ordine de strângere',
  connector: 'Conector deconectat', flag: 'Stare de pregătire', gasket: 'Garnitură', damaged: 'Piesă deteriorată', fault: 'Defect nerezolvat'
};

export class EngineControl {
  constructor(app) {
    this.app = app;
    this.running = false;
    this.lastReport = null;
  }

  /** Rulează verificarea finală (emite sim:op). Întoarce Result. */
  check() {
    const r = this.app.sim.finalCheck();
    this.lastReport = r?.data || null;
    return r;
  }

  showLeaks(report) {
    const { view } = this.app;
    view.clearLeaks();
    for (const l of report?.leaks || []) view.showLeak(l.partId, l.fluid);
  }

  /** Încearcă pornirea. report opțional (dacă tocmai s-a rulat finalCheck). */
  async start(report = null) {
    const { app } = this;
    if (!report) {
      const r = this.check();
      report = r?.data;
      if (!report) { toast(r?.message || 'Verificarea finală nu a putut fi efectuată.', 'error'); return null; }
    }
    this.stop(null, { silent: true });
    this.showLeaks(report);
    const sound = { ...(report.sound || {}) };
    if (!report.startable) sound.noStart = true;
    app.log('info', report.startable ? 'Pornire motor (simulare)…' : 'Încercare de pornire (simulare)…');
    this.running = true;
    this._update();
    const started = await app.audio.startEngine(sound, { startable: !!report.startable, rpm: 800 });
    if (!this.running) return report; // oprit între timp
    if (report.startable && started !== false) {
      app.view.setRunning(true, { rpm: 800, misfireCylinder: sound.misfireCylinder || 0, roughness: sound.roughness || 0 });
      const issues = report.issues || [];
      if (issues.length) {
        toast(`Motorul a pornit, dar există ${issues.length} problemă(e).`, 'warn', { details: issues.slice(0, 4).map((i) => i.message) });
        app.log('warn', `Motorul funcționează cu ${issues.length} problemă(e) semnalate.`);
      } else {
        toast('Motorul a pornit și funcționează la ralanti.', 'success');
        app.log('success', 'Motorul funcționează la ralanti (simulare).');
      }
      if ((report.leaks || []).length) app.notices?.explain('Scurgeri la pornire', report.leaks.map((l) => `${app.sim.getPart(l.partId)?.name || l.partId}: ${l.fluid}`).join('; '), 'warn');
    } else {
      this.running = false;
      app.view.setRunning(false);
      toast('Motorul nu pornește.', 'error', { details: (report.issues || []).slice(0, 5).map((i) => i.message) });
      app.log('error', 'Motorul nu a pornit (simulare). Consultați raportul verificării finale.');
      app.notices?.explain('Motorul nu pornește', 'Demarorul antrenează motorul, dar acesta nu pornește. Rulați „Verificare finală” pentru lista completă de probleme.', 'error',
        (report.issues || []).slice(0, 6).map((i) => `${ISSUE_LABELS[i.type] || i.type}: ${i.message}`));
    }
    this._update();
    return report;
  }

  stop(reason = null, { silent = false } = {}) {
    const was = this.running;
    this.running = false;
    this.app.audio.stopEngine();
    try { this.app.view.setRunning(false); } catch (err) { console.error(err); }
    if (was && !silent) this.app.log('info', reason || 'Motorul a fost oprit.');
    this._update();
  }

  toggle() { return this.running ? this.stop() : this.start(); }

  _update() {
    const btn = document.getElementById('btn-engine');
    if (btn) {
      btn.setAttribute('aria-pressed', String(this.running));
      btn.querySelector('.lbl').textContent = this.running ? 'Oprește motorul' : 'Pornește motorul';
      btn.classList.toggle('running', this.running);
    }
  }
}
