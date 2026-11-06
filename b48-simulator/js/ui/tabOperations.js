/**
 * Tab „Operațiuni”: stări de pregătire (flags), conectori, teste la nivel de motor, verificare finală, statistici.
 */
import { h, clear, badge } from './dom.js';

export function createOperationsTab(app) {
  const el = h('div.ops');
  let connOpen = false;
  const render = () => {
    const { sim, data } = app;
    clear(el);
    // stări
    const flags = data.flags?.flags || [];
    el.appendChild(h('section.lsec', h('h3', 'Pregătire (stări)'),
      h('p.field-note', 'Unele operațiuni cer o stare prealabilă (ex. bateria deconectată, ulei golit). Pentru unele stări este nevoie de o sculă activă.'),
      h('ul.op-list', flags.map((f) => {
        const on = !!sim.getFlag(f.id);
        const tools = on ? f.toolsOff : f.toolsOn;
        const req = on ? f.requiresOff : f.requiresOn;
        const reqText = [
          ...(req?.removed || []).map((id) => `demontat: ${sim.getPart(id)?.name || id}`),
          ...(req?.installed || []).map((id) => `montat: ${sim.getPart(id)?.name || id}`),
          ...Object.entries(req?.flags || {}).map(([k, v]) => `${sim.getFlagDef(k)?.name || k}: ${v ? 'da' : 'nu'}`)
        ];
        return h('li.op-item', { dataset: { flag: f.id } },
          h('div.op-main', h('span.op-name', f.name), on ? badge('DA', 'ok') : badge('NU', 'muted')),
          f.description ? h('div.field-note', f.description) : null,
          tools?.length ? h('div.field-note', `Sculă: ${tools.map((t) => sim.getTool(t)?.name || t).join(' / ')}`) : null,
          reqText.length ? h('div.field-note', `Condiții: ${reqText.join('; ')}`) : null,
          h('button.btn.btn-sm', { type: 'button', dataset: { action: on ? 'flag_off' : 'flag_on', target: f.id },
            onclick: () => app.actions.perform(on ? 'flag_off' : 'flag_on', f.id) }, on ? (f.offLabel || 'Dezactivează') : (f.onLabel || 'Activează')));
      }))));

    // teste
    const tests = data.tests?.tests || [];
    el.appendChild(h('section.lsec', h('h3', 'Teste motor'),
      h('ul.op-list', tests.map((t) => h('li.op-item',
        h('div.op-main', h('span.op-name', t.name), t.perCylinder ? badge('per cilindru', 'muted') : null),
        h('div.field-note', `Sculă: ${sim.getTool(t.tool)?.name || t.tool || '—'}`),
        h('button.btn.btn-sm', { type: 'button', dataset: { action: 'test', target: t.id }, onclick: () => app.actions.perform('test', t.id) }, 'Deschide testul'))))));

    // conectori
    const conns = data.parts?.connectors || [];
    const connected = conns.filter((c) => sim.getConnectorState(c.id)?.connected).length;
    const det = h('details.lsec', { open: connOpen },
      h('summary', h('strong', `Conectori electrici (${connected}/${conns.length} conectați)`)),
      h('ul.op-list.compact', conns.map((c) => {
        const on = !!sim.getConnectorState(c.id)?.connected;
        return h('li.op-row', h('span.op-name', c.name), on ? badge('conectat', 'ok') : badge('deconectat', 'warn'),
          h('button.btn.btn-xs', { type: 'button', dataset: { action: on ? 'disconnect' : 'connect', target: c.id }, onclick: () => app.actions.perform(on ? 'disconnect' : 'connect', c.id) }, on ? 'Deconectează' : 'Conectează'));
      })));
    det.addEventListener('toggle', () => { connOpen = det.open; });
    el.appendChild(det);

    // verificare + statistici
    const s = sim.stats || {};
    el.appendChild(h('section.lsec', h('h3', 'Verificare și statistici'),
      h('button.btn.btn-primary.btn-block', { type: 'button', onclick: () => app.actions.perform('final_check', null) }, '✔ Verificare finală'),
      h('dl.stats',
        h('dt', 'Operațiuni'), h('dd', String(s.ops ?? 0)),
        h('dt', 'Greșeli'), h('dd', String(s.errors ?? 0)),
        h('dt', 'Manoperă (demo)'), h('dd', `${Math.round(s.laborMin ?? 0)} min`),
        h('dt', 'Piese noi (demo)'), h('dd', `${Math.round(s.partsCost ?? 0)} lei`),
        h('dt', 'Mod strict'), h('dd', sim.enforce ? 'da (reguli impuse)' : 'nu (mod liber)'))));
  };
  return { id: 'operations', label: 'Operațiuni', icon: '⚙', el, render };
}
