/**
 * Tab „Banc”: piesele demontate (și piesele care călătoresc atașate de o piesă demontată).
 * Selectarea de aici funcționează și fără 3D.
 */
import { h, clear, badge } from './dom.js';
import { partStatusDot } from './tabAssemblies.js';

export function createBenchTab(app) {
  const el = h('div.bench');
  const render = () => {
    const { sim, data } = app;
    clear(el);
    const parts = data.parts.parts || [];
    const removed = parts.filter((p) => !sim.getPartState(p.id)?.installed);
    const onBench = parts.filter((p) => { const s = sim.getPartState(p.id); return s?.installed && !s.onEngine; });
    const row = (p) => {
      const st = sim.getPartState(p.id) || {};
      let canInst = null;
      if (!st.installed) { try { canInst = sim.canInstall(p.id); } catch { canInst = null; } }
      return h('li.bench-item',
        h(`button.part-row${app.state.selected === p.id ? '.selected' : ''}`, { type: 'button', dataset: { part: p.id }, onclick: () => app.select(p.id) },
          partStatusDot(app, p.id), h('span', p.name),
          st.damaged && app.modes?.currentId !== 'diagnosis' ? badge('deteriorată', 'danger') : null,
          (p.isGasket || p.singleUse) && !st.isNew ? badge('folosită', 'warn') : null),
        !st.installed ? h('div.bench-actions',
          h('button.btn.btn-xs', { type: 'button', disabled: canInst ? !canInst.ok && sim.enforce : false, title: canInst && !canInst.ok ? (canInst.reasons || []).join('\n') : '',
            onclick: () => app.actions.perform('install', p.id) }, 'Montează'),
          h('button.btn.btn-xs', { type: 'button', onclick: () => app.actions.perform('install_new', p.id) }, 'Montează nouă')) : null);
    };
    el.appendChild(h('section.lsec', h('h3', `Piese demontate (${removed.length})`),
      removed.length ? h('ul.bench-list', removed.map(row)) : h('p.muted', 'Bancul este gol — nicio piesă demontată.')));
    if (onBench.length) {
      el.appendChild(h('section.lsec', h('h3', `Atașate de piese demontate (${onBench.length})`),
        h('p.field-note', 'Piese montate pe o piesă care e acum pe banc (ex. supapele în chiulasă). Se pot demonta doar pe banc.'),
        h('ul.bench-list', onBench.map(row))));
    }
  };
  const badgeFn = () => {
    const n = (app.data.parts.parts || []).filter((p) => !app.sim.getPartState(p.id)?.installed).length;
    app.left?.setCount('bench', n);
  };
  return { id: 'bench', label: 'Banc', icon: '🛠', el, render, badge: badgeFn };
}
