/**
 * Legătura Simulator ↔ vizualizare 3D ↔ audio ↔ UI.
 * Ascultă sim:op / view:pick / tool:active și sincronizează animațiile (coadă serială), sunetele și notificările.
 */
import { toast } from './dom.js';
import { ACTION_LABELS } from './actions.js';

export function setupGlue(app) {
  const { bus, sim, view, audio } = app;
  let queue = Promise.resolve();
  const enqueue = (fn) => { queue = queue.then(fn).catch((err) => console.error('[glue] animație eșuată:', err)); return queue; };
  const sync = () => { try { view.syncVisibility((id) => sim.isOnEngine(id)); } catch (err) { console.error(err); } };
  app.syncView = () => enqueue(sync);
  app.animationQueue = () => queue;

  const partName = (raw) => { const id = raw == null ? raw : String(raw).split('.')[0]; return sim.getPart?.(id)?.name || sim.getConnector?.(id)?.name || sim.getFlagDef?.(id)?.name || sim.getTest?.(id)?.name || id || ''; };
  // aceste operațiuni își afișează singure rezultatul (dialog/raport), deci nu primesc toast generic de eroare
  const SELF_REPORTING = new Set(['final_check', 'diagnose', 'load_fault', 'preset']);

  bus.on('view:pick', ({ partId } = {}) => {
    if (partId) app.select(partId, { source: 'view' });
  });

  bus.on('view:hover', ({ partId } = {}) => {
    const el = document.getElementById('hover-label');
    if (!el) return;
    const p = partId ? sim.getPart(partId) : null;
    el.textContent = p ? p.name : '';
    el.hidden = !p;
  });

  bus.on('tool:active', ({ toolId } = {}) => {
    app.modes?.onToolActive?.(toolId);
    app.inventory?.render();
    const t = toolId ? sim.getTool(toolId) : null;
    if (t) app.log('info', `Sculă activă: ${t.name}.`);
  });

  bus.on('sim:op', ({ action, target, result } = {}) => {
    if (!result) return;
    const label = ACTION_LABELS[action] || action;
    // strângere greșită: refuzată ca rezultat (ok:false), dar aplicată fizic (data.applied) → animație + explicație
    if (!result.ok && action === 'tighten' && result.data?.applied) {
      audio.error();
      toast(result.message || 'Strângere incorectă.', 'error', { details: [...(result.reasons || []), 'Slăbiți elementele de fixare și strângeți din nou corect.'] });
      app.notices?.explain(`Strângere incorectă — ${partName(target)}`, result.message, 'error', [...(result.reasons || []), 'Strângerea a fost aplicată: slăbiți și strângeți din nou cu cheia dinamometrică, la valoarea și în ordinea din specificație.']);
      const toolIdT = result.data?.toolId || sim.activeTool;
      enqueue(async () => {
        await view.playToolAnimation(target, toolIdT, 'tighten');
        if (sim.getTool(toolIdT)?.category === 'torque') audio.torqueClick();
        const st = sim.getPartState(target);
        if (st?.damaged) view.setDamaged(target, true);
      });
      return;
    }
    if (!result.ok && SELF_REPORTING.has(action)) return;
    if (!result.ok) {
      audio.error();
      toast(result.message || 'Operațiune refuzată.', 'error', { details: result.reasons || [] });
      app.notices?.explain(`${label}${target ? ' — ' + partName(target) : ''}: operațiune refuzată`, result.message, 'error', result.reasons || []);
      return;
    }
    if (result.warnings?.length) {
      toast(result.warnings[0], 'warn', { details: result.warnings.slice(1) });
      app.notices?.explain(`${label} — ${partName(target)}: atenție`, result.warnings.join(' '), 'warn');
    }
    if (result.code === 'NO_CHANGE') { toast(result.message || 'Nicio schimbare.', 'info'); return; }
    const toolId = result.data?.toolId || sim.activeTool;
    const group = Array.isArray(result.data?.group) ? result.data.group : [];
    switch (action) {
      case 'loosen':
        audio.ratchet(7);
        enqueue(() => view.playToolAnimation(target, toolId, 'loosen'));
        break;
      case 'tighten':
        enqueue(async () => {
          audio.ratchet(4);
          await view.playToolAnimation(target, toolId, 'tighten');
          const tool = toolId ? sim.getTool(toolId) : null;
          if (tool?.category === 'torque') audio.torqueClick();
          const st = sim.getPartState(target);
          if (st?.damaged) view.setDamaged(target, true);
        });
        break;
      case 'remove':
        audio.clunk();
        enqueue(async () => { await view.animateRemove(target, group); sync(); });
        break;
      case 'install':
      case 'install_new':
        enqueue(async () => {
          sync();
          await view.animateInstall(target, group);
          audio.clunk();
          sync();
          const st = sim.getPartState(target);
          view.setDamaged(target, !!(st?.damaged && st?.torque?.status === 'over'));
        });
        break;
      case 'connect':
      case 'disconnect':
        audio.plastic();
        break;
      case 'setFlag': case 'flag_on': case 'flag_off': case 'flag':
        audio.chime();
        enqueue(sync);
        break;
      case 'inspect': case 'measure': case 'test': case 'runTest': case 'finalCheck': case 'final_check': case 'diagnose':
        break;
      default:
        enqueue(sync);
    }
  });

  bus.on('sim:changed', () => app.refresh());
  bus.on('sim:log', (e = {}) => app.logPanel?.add(e));
}
