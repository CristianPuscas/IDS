/**
 * Panoul dreapta „Piesă selectată”: identitate, stare, condiții prealabile, acțiuni disponibile (cu motivele de blocare),
 * specificații cu insigne de status, inspecții și măsurători.
 */
import { h, badge, clear } from './dom.js';
import { renderSpec, linkView } from './specView.js';
import { ACTION_LABELS } from './actions.js';

const ACTION_ICONS = { loosen: '↺', tighten: '↻', remove: '⬆', install: '⬇', install_new: '★', inspect: '🔍', measure: '📏', connect: '🔌', disconnect: '⏏' };

/** Transformă diverse forme (listă de id-uri, listă de obiecte, hartă) în [{ id, value, obj }] */
function asList(x) {
  if (!x) return [];
  if (Array.isArray(x)) return x.map((e) => (typeof e === 'string' ? { id: e } : { id: e?.id ?? e?.flagId ?? e?.partId ?? e?.connectorId, value: e?.value ?? e?.required ?? e?.connected, obj: e }));
  if (typeof x === 'object') return Object.entries(x).map(([id, value]) => ({ id, value: typeof value === 'object' ? value?.required ?? value?.value : value, obj: typeof value === 'object' ? value : null }));
  return [{ id: String(x) }];
}

export class PartPanel {
  constructor(app, root) {
    this.app = app;
    this.root = root;
    this.partId = null;
  }

  show(partId) { this.partId = partId; this.render(); }

  render() {
    const { app, root } = this;
    const { sim } = app;
    clear(root);
    const id = this.partId;
    const part = id ? sim.getPart(id) : null;
    if (!part) {
      root.appendChild(h('div.empty-state',
        h('div.empty-icon', { 'aria-hidden': 'true' }, '🔧'),
        h('p', 'Nicio piesă selectată.'),
        h('p.muted', 'Faceți clic pe o piesă în vizualizarea 3D sau alegeți-o din tab-urile „Ansambluri” / „Banc”.')));
      return;
    }
    const st = sim.getPartState(id) || {};
    const asm = (app.data.parts.assemblies || []).find((a) => a.id === part.assembly);
    const mode = app.modes?.currentId;
    const exam = mode === 'exam';
    const diag = mode === 'diagnosis';

    // antet
    root.appendChild(h('div.part-head',
      h('h2.part-name', part.name),
      h('div.part-sub',
        asm ? h('span.asm-chip', { style: { '--asm': asm.color || '#888' } }, asm.name) : null,
        badge(part.accuracy === 'schematic' ? 'Model schematic' : 'Model educațional aproximativ', 'muted',
          'Geometria 3D este aproximativă, nu o reproducere exactă a piesei reale.')),
      h('div.part-id.muted', `ID: ${part.id}`)));

    // stare
    const chips = [];
    chips.push(st.installed ? badge('Montată', 'ok') : badge('Demontată', 'warn'));
    if (st.installed) chips.push(st.onEngine ? badge('Pe motor', 'info') : badge('Pe banc (cu piesa-părinte)', 'muted'));
    if (part.fasteners) {
      const fx = st.fasteners === 'tight' ? ['Șuruburi strânse', 'ok'] : st.fasteners === 'loose' ? ['Șuruburi slăbite', 'warn'] : ['Fără fixare activă', 'muted'];
      chips.push(badge(fx[0], fx[1]));
    }
    if (st.torque && st.torque.status) {
      const tmap = { ok: ['Cuplu aplicat corect', 'ok'], under: ['Cuplu insuficient', 'warn'], over: ['Cuplu excesiv', 'danger'], uncontrolled: ['Strângere necontrolată', 'warn'] };
      const [t, k] = tmap[st.torque.status] || [`Cuplu: ${st.torque.status}`, 'info'];
      chips.push(badge(`${t}${st.torque.value != null && !exam ? ` (${st.torque.value} Nm${st.torque.angle ? ` + ${st.torque.angle}°` : ''})` : ''}`, k));
      if (st.torque.sequenceOk === false) chips.push(badge('Ordine greșită', 'danger'));
    }
    chips.push(st.isNew ? badge('Nouă', 'ok') : badge('Folosită', 'muted'));
    if (st.damaged && !diag) chips.push(badge('Deteriorată', 'danger', st.damageNote || ''));
    if (part.isGasket || part.singleUse) chips.push(badge('Unică folosință', 'warn', 'Garnitură/etanșare: se înlocuiește la fiecare demontare.'));
    root.appendChild(section('Stare', h('div.chips', chips),
      st.damaged && st.damageNote && !diag ? h('p.danger-text', st.damageNote) : null));

    // acțiuni
    let actions = [];
    try { actions = sim.availableActions(id) || []; } catch (err) { console.error(err); }
    const allowed = actions.filter((a) => a.allowed);
    const blocked = actions.filter((a) => !a.allowed);
    // butoanele blocate rămân apăsabile: simulatorul explică refuzul (și îl contorizează ca greșeală în modurile stricte)
    const actBtn = (a) => h(`button.btn.action-btn${a.allowed ? '.btn-primary' : '.is-blocked'}`, {
      type: 'button',
      'aria-label': `${a.label || ACTION_LABELS[a.action] || a.action}${a.allowed ? '' : ' (blocat)'}`,
      title: a.allowed ? '' : (a.reasons || []).join('\n'),
      dataset: { action: a.action, target: a.target || id },
      onclick: () => app.actions.perform(a.action, a.target || id, { measurementId: a.measurementId || a.measurement })
    }, h('span.ai', { 'aria-hidden': 'true' }, ACTION_ICONS[a.action] || '•'), a.label || ACTION_LABELS[a.action] || a.action, a.allowed ? null : h('span.lock', { 'aria-hidden': 'true' }, ' 🔒'));
    root.appendChild(section('Acțiuni',
      allowed.length ? h('div.action-grid', allowed.map(actBtn)) : h('p.muted', 'Nicio acțiune permisă acum.'),
      blocked.length ? h('details.blocked', { open: allowed.length === 0 },
        h('summary', `Blocate (${blocked.length}) — de ce?`),
        h('ul.blocked-list', blocked.map((a) => h('li',
          actBtn(a),
          h('ul.reasons', (a.reasons || ['Condiții neîndeplinite.']).map((r) => h('li', r))))))) : null,
      h('p.field-note', `Sculă activă: ${sim.getTool(sim.activeTool)?.name || 'niciuna'}`)));

    // condiții prealabile
    root.appendChild(this.renderDeps(id, part));

    // despre
    root.appendChild(section('Despre piesă',
      part.description ? h('p', part.description) : null,
      part.function ? h('p', h('strong', 'Funcție: '), part.function) : null,
      part.notes ? h('p.notes', h('strong', 'Note de atelier: '), part.notes) : null,
      linkView(app, 'part', id)));

    // fixare + specificații
    const specs = [];
    const fx = part.fasteners;
    if (fx?.torqueSpec) specs.push(sim.getSpec(fx.torqueSpec) || { id: fx.torqueSpec, name: fx.torqueSpec, status: 'NEVERIFICATĂ' });
    if (fx?.sequenceSpec) specs.push(sim.getSpec(fx.sequenceSpec) || { id: fx.sequenceSpec, name: fx.sequenceSpec, status: 'NEVERIFICATĂ' });
    for (const m of part.measurements || []) if (m.specRef) { const s = sim.getSpec(m.specRef); if (s && !specs.includes(s)) specs.push(s); }
    root.appendChild(section('Specificații',
      fx ? h('p.fx-line', `${fx.count} × ${fx.type || 'element de fixare'} ${fx.size || ''} `,
        fx.sizeStatus ? badge(`dimensiune ${fx.sizeStatus}`, 'warn') : null,
        h('div.muted', `Scule acceptate: ${(fx.tools || []).map((t) => sim.getTool(t)?.name || t).join(', ') || '—'}`)) : h('p.muted', 'Fără elemente de fixare.'),
      part.removeTools?.length ? h('p.muted', `Scule la scoatere: ${part.removeTools.map((t) => sim.getTool(t)?.name || t).join(', ')}`) : null,
      specs.length ? h('div.spec-list', specs.map((s) => renderSpec(s, app, { hideValue: exam }))) : h('p.muted', 'Nicio specificație asociată.'),
      exam ? h('p.field-note', 'În modul Examen valorile sunt ascunse.') : null));

    // inspecții și măsurători
    const insp = part.inspections || []; const meas = part.measurements || [];
    if (insp.length || meas.length) {
      root.appendChild(section('Inspecții și măsurători',
        insp.length ? h('ul.plain', insp.map((i) => h('li', '🔍 ', i.name))) : null,
        meas.length ? h('ul.plain', meas.map((m) => h('li', '📏 ', m.name,
          h('span.muted', ` — ${sim.getTool(m.tool)?.name || m.tool || 'fără sculă'}${m.requiresRemoved ? ' · piesa trebuie demontată' : ''}`)))) : null,
        part.inspectRequiresRemoved ? h('p.field-note', 'Inspecția completă necesită demontarea piesei.') : null));
    }

    if (mode === 'workshop') {
      root.appendChild(section('Deviz (demonstrativ)',
        h('p', `Preț piesă nouă: ${part.cost ?? '—'} lei · Manoperă: ${part.laborMin ?? '—'} min`),
        h('p.field-note', 'Sume demonstrative, nu prețuri reale.')));
    }
  }

  renderDeps(id, part) {
    const { sim } = this.app;
    let deps = null;
    try { deps = sim.dependencies(id); } catch (err) { console.error(err); }
    if (!deps) return section('Condiții prealabile', h('p.muted', 'Indisponibile.'));
    const rows = [];
    const pname = (x) => sim.getPart(x)?.name || x;
    const okOf = (o, fallback) => (o && typeof o.ok === 'boolean' ? o.ok : fallback);
    const mounts = asList(deps.mounts);
    if (mounts.length) rows.push(depRow(part.benchOnly ? 'Se demontează pe banc de pe' : 'Se montează pe', mounts.map((m) => {
      const on = sim.isOnEngine(m.id);
      return [m.obj?.name || pname(m.id), okOf(m.obj, on), on ? 'pe motor' : 'nu e pe motor'];
    })));
    const blockers = asList(deps.blockers);
    if (blockers.length) rows.push(depRow('De demontat înainte', blockers.map((b) => {
      const inst = !!sim.getPartState(b.id)?.installed;
      return [b.obj?.name || pname(b.id), okOf(b.obj, !inst), inst ? 'încă montată' : 'demontată'];
    })));
    const cons = asList(deps.connectors);
    if (cons.length) rows.push(depRow('Conectori', cons.map((c) => {
      const conn = c.obj && typeof c.obj.connected === 'boolean' ? c.obj.connected : !!sim.getConnectorState(c.id)?.connected;
      return [c.obj?.name || sim.getConnector(c.id)?.name || c.id, okOf(c.obj, !conn), conn ? 'conectat (deconectați înainte de demontare)' : 'deconectat'];
    })));
    const flags = asList(deps.flags ?? part.requiresFlags);
    if (flags.length) rows.push(depRow('Stări necesare (demontare)', flags.map((f) => {
      const req = f.obj && typeof f.obj.required === 'boolean' ? f.obj.required : (f.value === undefined ? true : !!f.value);
      const cur = sim.getFlag(f.id);
      return [f.obj?.name || sim.getFlagDef(f.id)?.name || f.id, okOf(f.obj, cur === req), `necesar: ${req ? 'da' : 'nu'} · acum: ${cur ? 'da' : 'nu'}`];
    })));
    const tools = asList(deps.tools);
    if (tools.length) rows.push(depRow('Scule (oricare)', tools.map((t) => {
      const active = sim.activeTool === t.id;
      const usable = this.app.modes?.isToolUsable?.(t.id) ?? true;
      return [t.obj?.name || sim.getTool(t.id)?.name || t.id, active, active ? 'activă' : usable ? 'disponibilă în inventar' : 'nu o dețineți'];
    })));
    const fx = deps.fasteners;
    const fxState = typeof fx === 'string' ? fx : fx?.state;
    if (fxState && fxState !== 'none') rows.push(depRow('Fixare', [[fx?.label || 'Elemente de fixare', fxState !== 'tight',
      fxState === 'tight' ? 'strânse — slăbiți înainte de demontare' : 'slăbite']]));
    return section('Condiții prealabile', rows.length ? rows : h('p.muted', 'Nicio condiție specială.'));
  }
}

function depRow(title, items) {
  return h('div.dep', h('div.dep-title', title), h('ul.dep-list', items.map(([name, ok, note]) =>
    h(`li.${ok ? 'dep-ok' : 'dep-bad'}`, h('span.dep-mark', { 'aria-hidden': 'true' }, ok ? '✔' : '✖'), h('span', name), note ? h('span.muted', ` — ${note}`) : null))));
}

function section(title, ...children) {
  return h('section.psec', h('h3.psec-title', title), ...children);
}
