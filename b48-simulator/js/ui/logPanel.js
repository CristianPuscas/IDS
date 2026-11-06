/**
 * Jurnalul operațiunilor (nivel info/succes/avertisment/eroare + oră) și zona de avertismente/explicații
 * + bara de progres a lecției.
 */
import { h, clear, fmtTime } from './dom.js';

const LEVELS = { info: 'Info', success: 'Succes', warn: 'Avertisment', error: 'Eroare' };

export class LogPanel {
  constructor(app, root) {
    this.app = app;
    this.root = root;
    this.filter = 'all';
    this.entries = [];
    this.list = h('ol.log-list', { 'aria-live': 'polite', 'aria-relevant': 'additions' });
    const filters = h('div.log-filters', { role: 'toolbar', 'aria-label': 'Filtru jurnal' },
      ['all', 'info', 'success', 'warn', 'error'].map((l) => h(`button.chip.chip-xs${l === 'all' ? '.active' : ''}`, { type: 'button', dataset: { level: l },
        onclick: (e) => { this.filter = l; filters.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c.dataset.level === l)); this.renderAll(); } },
      l === 'all' ? 'Toate' : LEVELS[l])),
      h('button.chip.chip-xs', { type: 'button', 'aria-label': 'Golește jurnalul', onclick: () => { this.entries = []; app.storage.set('log', []); this.renderAll(); } }, 'Golește'));
    clear(root).append(h('div.panel-title', 'Jurnal operațiuni', filters), this.list);
    for (const e of app.storage.get('log', []) || []) this.entries.push({ ...e, restored: true });
    this.renderAll();
  }

  add({ level = 'info', message = '', time = Date.now() } = {}) {
    if (!message) return;
    const lvl = LEVELS[level] ? level : 'info';
    const e = { level: lvl, message: String(message), time: typeof time === 'number' ? time : Date.parse(time) || Date.now() };
    this.entries.push(e);
    if (this.entries.length > 400) this.entries.splice(0, this.entries.length - 400);
    this.app.storage.appendLog(e);
    if (this.filter === 'all' || this.filter === lvl) {
      this.list.appendChild(this.row(e));
      while (this.list.children.length > 200) this.list.firstChild.remove();
      this.list.scrollTop = this.list.scrollHeight;
    }
  }

  row(e) {
    return h(`li.log.log-${e.level}${e.restored ? '.restored' : ''}`,
      h('time', fmtTime(e.time)), h('span.log-lvl', LEVELS[e.level]), h('span.log-msg', e.message));
  }

  renderAll() {
    clear(this.list);
    const list = this.entries.filter((e) => this.filter === 'all' || e.level === this.filter).slice(-200);
    for (const e of list) this.list.appendChild(this.row(e));
    this.list.scrollTop = this.list.scrollHeight;
  }
}

export class Notices {
  constructor(app, root) {
    this.app = app;
    this.root = root;
    this.progress = h('div.lesson-progress', { hidden: true },
      h('div.lp-head', h('span.lp-title'), h('span.lp-count')),
      h('div.lp-bar', { role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0', 'aria-label': 'Progresul lecției' }, h('div.lp-fill')));
    this.list = h('ul.notice-list', { 'aria-live': 'polite' });
    this.empty = h('p.muted.notice-empty', 'Aici apar explicațiile: de ce o operațiune a fost refuzată, avertismente și sfaturi.');
    clear(root).append(h('div.panel-title', 'Progres și explicații'), this.progress, this.empty, this.list);
    app.bus.on('lesson:progress', (p) => this.setProgress(p));
  }

  setProgress({ lessonId, stepIndex = 0, total = 0, done = false, title } = {}) {
    if (!lessonId) { this.progress.hidden = true; return; }
    const lesson = (this.app.data.lessons?.lessons || []).find((l) => l.id === lessonId);
    const pct = total ? Math.round(((done ? total : stepIndex) / total) * 100) : 0;
    this.progress.hidden = false;
    this.progress.querySelector('.lp-title').textContent = title || (lesson ? `Lecția ${lesson.code}: ${lesson.title}` : lessonId);
    this.progress.querySelector('.lp-count').textContent = done ? 'Finalizată ✔' : `Pas ${Math.min(stepIndex + 1, total)} / ${total}`;
    this.progress.querySelector('.lp-fill').style.width = `${pct}%`;
    this.progress.querySelector('.lp-bar').setAttribute('aria-valuenow', String(pct));
  }

  /** Explicație/avertisment: level info | warn | error | tip */
  explain(title, text, level = 'info', reasons = []) {
    this.empty.hidden = true;
    const li = h(`li.notice.notice-${level}`,
      h('div.notice-head', h('strong', title), h('time', fmtTime()),
        h('button.icon-btn.icon-xs', { type: 'button', 'aria-label': 'Închide explicația', onclick: () => { li.remove(); if (!this.list.children.length) this.empty.hidden = false; } }, '×')),
      text ? h('div', text) : null,
      reasons?.length ? h('ul.reasons', reasons.map((r) => h('li', r))) : null);
    this.list.prepend(li);
    while (this.list.children.length > 8) this.list.lastChild.remove();
  }

  clear() { clear(this.list); this.empty.hidden = false; }
}
