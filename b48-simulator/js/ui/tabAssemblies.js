/**
 * Tab „Ansambluri”: vizibilitatea ansamblurilor în 3D, izolare, lista tuturor pieselor (selectare fără 3D), căutare.
 */
import { h, clear } from './dom.js';

export function partStatusDot(app, id) {
  const st = app.sim.getPartState(id) || {};
  const cls = !st.installed ? 'dot-removed' : st.onEngine ? 'dot-on' : 'dot-bench';
  const title = !st.installed ? 'demontată' : st.onEngine ? 'pe motor' : 'pe banc';
  return h(`span.dot.${cls}`, { title, 'aria-label': title });
}

export function createAssembliesTab(app) {
  const el = h('div.asm');
  const hidden = new Set();
  const open = new Set();
  let isolated = null;
  let query = '';
  const search = h('input.input.search', { type: 'search', placeholder: 'Caută piesă…', 'aria-label': 'Caută piesă după nume' });
  search.addEventListener('input', () => { query = search.value.trim().toLowerCase(); renderList(); });
  const list = h('div.asm-list');

  const renderList = () => {
    const { sim, data } = app;
    clear(list);
    const parts = data.parts.parts || [];
    for (const a of data.parts.assemblies || []) {
      const mine = parts.filter((p) => p.assembly === a.id && (!query || p.name.toLowerCase().includes(query) || p.id.includes(query)));
      if (query && !mine.length) continue;
      const vis = !hidden.has(a.id);
      const cb = h('input', { type: 'checkbox', checked: vis, 'aria-label': `Afișează ansamblul ${a.name}`,
        onchange: () => { if (cb.checked) hidden.delete(a.id); else hidden.add(a.id); app.view.setAssemblyVisible(a.id, cb.checked); app.syncView?.(); } });
      const isIso = isolated === a.id;
      const det = h('details.asm-group', { open: open.has(a.id) || !!query },
        h('summary',
          h('span.asm-swatch', { style: { background: a.color || '#888' }, 'aria-hidden': 'true' }),
          h('span.asm-name', a.name), h('span.muted', ` (${mine.length})`)),
        h('div.asm-tools',
          h('label.chk', cb, ' vizibil'),
          h('button.btn.btn-xs', { type: 'button', 'aria-pressed': String(isIso),
            onclick: () => {
              isolated = isIso ? null : a.id;
              app.view.isolate(isolated ? parts.filter((p) => p.assembly === a.id).map((p) => p.id) : null);
              app.syncView?.();
              renderList();
            } }, isIso ? 'Anulează izolarea' : 'Izolează')),
        h('ul.part-list', mine.map((p) => h('li',
          h(`button.part-row${app.state.selected === p.id ? '.selected' : ''}`, { type: 'button', dataset: { part: p.id }, onclick: () => app.select(p.id, { focus: true }) },
            partStatusDot(app, p.id), h('span', p.name))))));
      det.addEventListener('toggle', () => { if (det.open) open.add(a.id); else open.delete(a.id); });
      list.appendChild(det);
    }
    if (!list.children.length) list.appendChild(h('p.muted', 'Nicio piesă găsită.'));
  };

  el.append(h('div.lsec-head', search,
    h('button.btn.btn-xs', { type: 'button', onclick: () => {
      hidden.clear(); isolated = null;
      for (const a of app.data.parts.assemblies || []) app.view.setAssemblyVisible(a.id, true);
      app.view.isolate(null); app.syncView?.(); renderList();
    } }, 'Arată tot')),
  h('p.field-note', 'Legendă: ', h('span.dot.dot-on'), ' pe motor ', h('span.dot.dot-bench'), ' pe banc ', h('span.dot.dot-removed'), ' demontată'),
  list);
  return { id: 'assemblies', label: 'Ansambluri', icon: '🧩', el, render: renderList };
}
