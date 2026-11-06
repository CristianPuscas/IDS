/**
 * Inventarul de scule: grilă cu icon + nume, sculă activă evidențiată, filtrare pe categorii.
 * În modul Atelier (workshop) doar sculele deținute pot fi activate; restul afișează prețul și „Cumpără”.
 */
import { h, clear, toast, fmtLei } from './dom.js';

export const CATEGORY_LABELS = {
  all: 'Toate', socket: 'Tubulare', ratchet: 'Clichete', torque: 'Dinamometrice', angle: 'Unghi', screwdriver: 'Șurubelnițe',
  pliers: 'Clești', wrench: 'Chei', special: 'Speciale', measure: 'Măsurare', diagnostic: 'Diagnostic', fluid: 'Fluide', hand: 'Manual'
};

export class Inventory {
  constructor(app, root) {
    this.app = app;
    this.root = root;
    this.category = app.storage.get('ui.toolCat', 'all');
    this.query = '';
    this.hl = null;
  }

  /** Evidențiază (indiciu de lecție) o sculă; null = fără indiciu. */
  highlight(toolId) {
    this.hl = toolId || null;
    if (toolId) {
      const t = this.app.sim.getTool(toolId);
      if (t && this.category !== 'all' && this.category !== t.category) this.category = 'all';
    }
    this.render();
  }

  render() {
    const { app } = this;
    const { sim } = app;
    const tools = app.data.tools?.tools || [];
    const cats = ['all', ...new Set(tools.map((t) => t.category))];
    const shop = app.modes?.currentId === 'workshop';
    clear(this.root);
    const filters = h('div.inv-filters', { role: 'toolbar', 'aria-label': 'Filtru categorii scule' },
      cats.map((c) => h(`button.chip${this.category === c ? '.active' : ''}`, { type: 'button', 'aria-pressed': String(this.category === c),
        onclick: () => { this.category = c; app.storage.set('ui.toolCat', c); this.render(); } }, CATEGORY_LABELS[c] || c)));
    const active = sim.getTool(sim.activeTool);
    const head = h('div.inv-head',
      h('div.inv-active', 'Sculă activă: ', h('strong', active ? `${active.icon || ''} ${active.name}` : 'niciuna'),
        active ? h('button.btn.btn-xs', { type: 'button', onclick: () => sim.setActiveTool(null) }, 'Pune jos') : null),
      shop ? h('div.inv-budget', 'Buget: ', h('strong', fmtLei(app.modes.get('workshop')?.budget ?? 0)), h('span.muted', ' (demonstrativ)')) : null);
    const list = tools.filter((t) => this.category === 'all' || t.category === this.category);
    const grid = h('div.inv-grid', { role: 'listbox', 'aria-label': 'Scule' }, list.map((t) => {
      const usable = app.modes?.isToolUsable?.(t.id) ?? true;
      const isActive = sim.activeTool === t.id;
      const card = h(`div.tool${isActive ? '.active' : ''}${usable ? '' : '.not-owned'}${this.hl === t.id && !isActive ? '.hinted' : ''}`, { role: 'option', 'aria-selected': String(isActive), dataset: { tool: t.id } },
        h('button.tool-btn', { type: 'button', title: `${t.name}${t.description ? '\n' + t.description : ''}${t.range ? `\nDomeniu: ${t.range[0]}–${t.range[1]} Nm` : ''}`,
          'aria-label': `${t.name}${isActive ? ' (activă)' : ''}${usable ? '' : ' (nedeținută)'}`,
          onclick: () => this.pick(t, usable) },
        h('span.tool-icon', { 'aria-hidden': 'true' }, t.icon || '🔧'),
        h('span.tool-name', t.name),
        t.range ? h('span.tool-range', `${t.range[0]}–${t.range[1]} Nm`) : null),
        shop && !usable ? h('button.btn.btn-xs.btn-buy', { type: 'button', 'aria-label': `Cumpără ${t.name} cu ${t.price} lei`,
          onclick: () => app.modes.get('workshop').buyTool(t.id) }, `Cumpără ${fmtLei(t.price)}`) : null);
      return card;
    }));
    this.root.append(head, filters, grid);
  }

  pick(t, usable) {
    const { sim } = this.app;
    if (sim.activeTool === t.id) { sim.setActiveTool(null); return; }
    if (!usable) {
      this.app.audio.error();
      toast(`Nu dețineți „${t.name}”. Cumpărați-o din inventar (modul Atelier).`, 'warn');
      return;
    }
    sim.setActiveTool(t.id);
  }
}
