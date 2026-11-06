/**
 * Modul Atelier: buget inițial demonstrativ (5000 lei), cumpărare scule (doar sculele deținute pot fi activate),
 * piese noi costă part.cost, manopera = laborMin × tarif demonstrativ; rezumat deviz. Toate sumele sunt DEMONSTRATIVE.
 */
import { h, fmtLei, toast } from '../ui/dom.js';
import { openModal, confirmDialog } from '../ui/modal.js';

export const START_BUDGET = 5000;
export const LABOR_RATE = 3; // lei / minut (demonstrativ, 180 lei/oră)

export function createWorkshopMode(app) {
  let ws = null;
  let offs = [];
  let laborBase = 0;
  const budgetEl = h('strong');
  const laborEl = h('span');

  const defaults = () => ({
    budget: START_BUDGET,
    owned: (app.data.tools?.tools || []).filter((t) => t.defaultOwned).map((t) => t.id),
    purchases: [], parts: []
  });
  const load = () => {
    const s = app.storage.get('workshop', null);
    ws = s && Array.isArray(s.owned) ? { ...defaults(), ...s } : defaults();
  };
  const save = () => { app.storage.set('workshop', ws); app.storage.save(); };
  const laborMin = () => Math.max(0, (app.sim.stats?.laborMin || 0) - laborBase);
  const update = () => {
    budgetEl.textContent = fmtLei(ws?.budget ?? 0);
    laborEl.textContent = `${Math.round(laborMin())} min manoperă · ${fmtLei(laborMin() * LABOR_RATE)}`;
  };

  const mode = {
    id: 'workshop',
    name: 'Atelier',
    get budget() { return ws?.budget ?? 0; },
    enter() {
      load();
      app.sim.setEnforce(true);
      laborBase = app.sim.stats?.laborMin || 0;
      if (app.sim.activeTool && !ws.owned.includes(app.sim.activeTool)) app.sim.setActiveTool(null);
      app.hud.setMode(h('div.hud-card',
        h('div.hud-title', '🏭 Atelier'),
        h('div.hud-text', 'Buget: ', budgetEl, h('span.muted', ' (demonstrativ)')),
        h('div.hud-text', laborEl),
        h('div.btn-row',
          h('button.btn.btn-sm.btn-primary', { type: 'button', onclick: () => mode.showEstimate() }, '🧾 Deviz'),
          h('button.btn.btn-sm', { type: 'button', onclick: async () => {
            if (!(await confirmDialog('Resetează atelierul', `Bugetul revine la ${fmtLei(START_BUDGET)} și se păstrează doar sculele de bază.`, { danger: true, okLabel: 'Resetează' }))) return;
            ws = defaults(); laborBase = app.sim.stats?.laborMin || 0; save(); update(); app.inventory.render();
          } }, 'Resetează bugetul'))));
      offs.push(app.bus.on('ui:part-new', ({ partId, cost } = {}) => {
        const c = Number(cost) || 0;
        ws.budget -= c;
        ws.parts.push({ partId, name: app.sim.getPart(partId)?.name || partId, cost: c, time: Date.now() });
        save(); update(); app.inventory.render();
        app.log('info', `Piesă nouă: ${app.sim.getPart(partId)?.name} — ${fmtLei(c)} (demonstrativ). Buget rămas: ${fmtLei(ws.budget)}.`);
      }));
      offs.push(app.bus.on('sim:changed', update));
      update();
      app.inventory?.render();
    },
    exit() { offs.forEach((o) => o()); offs = []; },
    hasUnsavedProgress() { return false; },
    isToolUsable(toolId) { return !!ws && ws.owned.includes(toolId); },
    onToolActive(toolId) {
      if (toolId && ws && !ws.owned.includes(toolId)) {
        app.sim.setActiveTool(null);
        toast(`Nu dețineți „${app.sim.getTool(toolId)?.name || toolId}”. Cumpărați-o din inventar.`, 'warn');
      }
    },
    beforeAction(action, target) {
      if (action === 'install_new') {
        const cost = Number(app.sim.getPart(target)?.cost) || 0;
        if (cost > ws.budget) return { ok: false, message: `Buget insuficient pentru piesa nouă (${fmtLei(cost)}; disponibil ${fmtLei(ws.budget)}).`, reasons: ['Montați piesa existentă sau resetați bugetul.'] };
      }
      return null;
    },
    buyTool(toolId) {
      const t = app.sim.getTool(toolId);
      if (!t || ws.owned.includes(toolId)) return;
      const price = Number(t.price) || 0;
      if (price > ws.budget) { app.audio.error(); toast(`Buget insuficient pentru „${t.name}” (${fmtLei(price)}).`, 'warn'); return; }
      ws.budget -= price;
      ws.owned.push(toolId);
      ws.purchases.push({ toolId, name: t.name, price, time: Date.now() });
      save(); update();
      app.audio.success();
      app.log('success', `Sculă cumpărată: ${t.name} — ${fmtLei(price)} (demonstrativ).`);
      app.inventory.render();
    },
    showEstimate() {
      const tools = ws.purchases || []; const parts = ws.parts || [];
      const sumT = tools.reduce((a, x) => a + x.price, 0);
      const sumP = parts.reduce((a, x) => a + x.cost, 0);
      const labor = laborMin() * LABOR_RATE;
      openModal({ title: 'Deviz (demonstrativ)', size: 'md', body: h('div',
        h('table.result-table',
          h('thead', h('tr', h('th', 'Poziție'), h('th', 'Sumă'))),
          h('tbody',
            parts.map((p) => h('tr', h('td', `Piesă nouă: ${p.name}`), h('td', fmtLei(p.cost)))),
            h('tr', h('td', `Manoperă: ${Math.round(laborMin())} min × ${LABOR_RATE} lei/min`), h('td', fmtLei(labor))),
            h('tr.total', h('th', 'Total client (piese + manoperă)'), h('th', fmtLei(sumP + labor))),
            tools.length ? h('tr', h('td', `Investiții scule atelier (${tools.length})`), h('td', fmtLei(sumT))) : null,
            h('tr', h('td', 'Buget rămas'), h('td', fmtLei(ws.budget))))),
        h('p.disclaimer', 'Toate sumele sunt DEMONSTRATIVE (nu sunt prețuri sau timpi normați reali).')) });
    }
  };
  return mode;
}
