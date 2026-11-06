/**
 * Panoul stânga cu tab-uri: Lecții / Operațiuni / Ansambluri / Banc / Diagnostic / Date & Import.
 * Fiecare tab este un obiect { id, label, el, render() }; doar tab-ul activ se redesenează la sim:changed.
 */
import { h, clear } from './dom.js';

export class LeftPanel {
  constructor(app, root) {
    this.app = app;
    this.root = root;
    this.tabs = [];
    this.active = null;
    this.tabList = h('div.tabs', { role: 'tablist', 'aria-label': 'Secțiuni' });
    this.body = h('div.tab-body');
    clear(root).append(this.tabList, this.body);
    this.tabList.addEventListener('keydown', (e) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
      e.preventDefault();
      const i = this.tabs.findIndex((t) => t.id === this.active);
      const n = (i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1) + this.tabs.length) % this.tabs.length;
      this.activate(this.tabs[n].id, true);
    });
  }

  add(tab) {
    const btn = h('button.tab', { type: 'button', role: 'tab', id: `tab-${tab.id}`, 'aria-controls': `pane-${tab.id}`, 'aria-selected': 'false', tabIndex: -1,
      onclick: () => this.activate(tab.id) }, h('span.tab-icon', { 'aria-hidden': 'true' }, tab.icon || ''), h('span.tab-label', tab.label),
    h('span.tab-count', { hidden: true }));
    const pane = h('div.tab-pane', { role: 'tabpanel', id: `pane-${tab.id}`, 'aria-labelledby': `tab-${tab.id}`, hidden: true }, tab.el);
    tab.btn = btn; tab.pane = pane;
    this.tabList.appendChild(btn);
    this.body.appendChild(pane);
    this.tabs.push(tab);
    if (!this.active) this.activate(tab.id);
    return tab;
  }

  activate(id, focus = false) {
    const tab = this.tabs.find((t) => t.id === id);
    if (!tab) return;
    this.active = id;
    for (const t of this.tabs) {
      const on = t.id === id;
      t.btn.setAttribute('aria-selected', String(on));
      t.btn.tabIndex = on ? 0 : -1;
      t.pane.hidden = !on;
    }
    if (focus) tab.btn.focus();
    try { tab.render?.(); } catch (err) { console.error(`[ui] tab ${id}:`, err); }
    this.app.storage?.set('ui.tab', id);
  }

  setCount(id, n) {
    const tab = this.tabs.find((t) => t.id === id);
    if (!tab) return;
    const c = tab.btn.querySelector('.tab-count');
    c.hidden = !n;
    c.textContent = n ? String(n) : '';
  }

  refresh() {
    const tab = this.tabs.find((t) => t.id === this.active);
    try { tab?.render?.(); } catch (err) { console.error(`[ui] tab ${this.active}:`, err); }
    for (const t of this.tabs) { try { t.badge?.(); } catch { /* opțional */ } }
  }
}
