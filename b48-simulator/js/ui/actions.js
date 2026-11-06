/**
 * Executorul central al acțiunilor utilizatorului. Toate butoanele (panou piesă, operațiuni, lecții)
 * trec pe aici: verifică regulile modului curent, deschide dialogurile necesare și apelează Simulatorul.
 * Reacțiile vizuale/sonore la rezultat sunt tratate în glue.js (pe evenimentul sim:op).
 */
import { toast } from './dom.js';
import { openTightenDialog } from './dialogTighten.js';
import { openMeasureDialog } from './dialogMeasure.js';
import { openInspectDialog } from './dialogInspect.js';
import { openTestDialog } from './dialogTest.js';
import { openFinalCheckDialog } from './dialogFinal.js';

const NON_MECHANICAL = new Set(['inspect', 'measure', 'test', 'final_check']);

export const ACTION_LABELS = {
  loosen: 'Slăbește', remove: 'Demontează', install: 'Montează', install_new: 'Montează piesă nouă',
  tighten: 'Strânge', inspect: 'Inspectează', measure: 'Măsoară', connect: 'Conectează', disconnect: 'Deconectează',
  flag_on: 'Activează', flag_off: 'Dezactivează', test: 'Test', final_check: 'Verificare finală'
};

function fail(message, reasons = []) {
  return { ok: false, code: 'ui_blocked', message, reasons, warnings: [] };
}

export class Actions {
  constructor(app) { this.app = app; }

  /**
   * @param {string} action
   * @param {string} target
   * @param {object} opts { measurementId, params, variant, prefill, newPart }
   * @returns {Promise<object|null>} Result-ul simulatorului (sau null dacă dialogul a fost anulat)
   */
  async perform(action, target, opts = {}) {
    const { app } = this;
    const { sim } = app;
    const block = app.modes?.beforeAction?.(action, target, opts);
    if (block && block.ok === false) {
      app.audio.error();
      toast(block.message, 'warn', { details: block.reasons });
      app.notices?.explain('Acțiune blocată de modul curent', block.message, 'warn', block.reasons);
      return block;
    }
    if (!NON_MECHANICAL.has(action) && app.engine?.running) app.engine.stop('Motorul a fost oprit înainte de intervenție.');
    try {
      switch (action) {
        case 'loosen': return sim.loosen(target, sim.activeTool);
        case 'remove': return sim.remove(target, sim.activeTool);
        case 'install': return sim.install(target, { newPart: !!opts.newPart });
        case 'install_new': {
          const r = sim.install(target, { newPart: true });
          if (r?.ok) app.bus.emit('ui:part-new', { partId: target, cost: sim.getPart(target)?.cost || 0 });
          return r;
        }
        case 'tighten': return await openTightenDialog(app, target, opts);
        case 'connect': return sim.connect(target);
        case 'disconnect': return sim.disconnect(target);
        case 'flag_on': return sim.setFlag(target, true, sim.activeTool);
        case 'flag_off': return sim.setFlag(target, false, sim.activeTool);
        case 'inspect': return await openInspectDialog(app, target);
        case 'measure': {
          let partId = target; let measId = opts.measurementId;
          if (!measId && typeof target === 'string' && target.includes('.')) [partId, measId] = target.split('.');
          return await openMeasureDialog(app, partId, measId);
        }
        case 'test': return await openTestDialog(app, target, opts);
        case 'final_check': return await openFinalCheckDialog(app);
        default:
          toast(`Acțiune necunoscută: ${action}`, 'warn');
          return fail(`Acțiune necunoscută: ${action}`);
      }
    } catch (err) {
      console.error(`[actions] ${action}(${target}) a eșuat:`, err);
      app.log?.('error', `Eroare internă la „${ACTION_LABELS[action] || action}” (${target}): ${err.message}`);
      toast(`Eroare internă: ${err.message}`, 'error');
      return fail(err.message);
    }
  }
}
