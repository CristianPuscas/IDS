/**
 * UI lecții: lista A…K (status, obiective, durată, progres) și cardul pasului curent (în tab + compact în HUD).
 */
import { h, clear, badge } from './dom.js';

const TYPE_LABELS = { info: 'Informație', identify: 'Identificare', demo: 'Demonstrație', tool: 'Alegere sculă', action: 'Operațiune', quiz: 'Întrebare' };
const PART_ACTIONS = new Set(['loosen', 'remove', 'install', 'install_new', 'tighten', 'inspect']);
const DIRECT_ACTIONS = new Set(['flag_on', 'flag_off', 'test', 'final_check', 'measure', 'connect', 'disconnect']);

export class LessonsUI {
  constructor(app) {
    this.app = app;
    this.el = h('div.lessons');
    this.hudEl = h('div.hud-lesson');
    this.expanded = new Set();
  }

  tab() { return { id: 'lessons', label: 'Lecții', icon: '🎓', el: this.el, render: () => this.render() }; }

  render() {
    try { this.renderTab(); this.renderHud(); } catch (err) { console.error('[lecții] randare:', err); }
  }

  renderTab() {
    const { app } = this;
    const runner = app.lessons;
    clear(this.el);
    if (runner.active) this.el.appendChild(this.stepCard(false));
    const key = runner.active ? `${runner.lesson.id}:${runner.index}` : '';
    if (key && key !== this._lastKey) {
      const scroller = this.el.closest('.tab-body');
      if (scroller) scroller.scrollTop = 0;
    }
    this._lastKey = key;
    const lessons = runner.lessons();
    const intro = h('p.field-note', app.modes.currentId === 'guided' ? 'Mod ghidat: indicii și verificarea fiecărui pas.' : app.modes.currentId === 'free'
      ? 'Mod liber: puteți parcurge lecțiile cu Înapoi/Sari, fără reguli impuse.' : 'Lecțiile pornesc în modul Ghidat.');
    this.el.appendChild(h('section.lsec', h('h3', 'Lecții'), intro,
      h('ul.lesson-list', lessons.map((l) => this.lessonItem(l)))));
  }

  lessonItem(l) {
    const { app } = this;
    const runner = app.lessons;
    const prog = runner.progressOf(l.id);
    const available = l.status === 'disponibilă';
    const running = runner.lesson?.id === l.id;
    const steps = l.steps?.length || 0;
    const open = this.expanded.has(l.id) || running;
    const statusBadge = !available ? badge('planificată', 'muted') : prog.done ? badge(`finalizată · ${prog.bestScore ?? prog.score ?? 0}%`, 'ok')
      : prog.step > 0 ? badge(`în curs · pas ${prog.step + 1}/${steps}`, 'info') : badge('disponibilă', 'info');
    const det = h(`details.lesson${available ? '' : '.planned'}${running ? '.running' : ''}`, { open },
      h('summary', h('span.lesson-code', l.code), h('span.lesson-title', l.title), statusBadge),
      h('div.lesson-body',
        h('div.muted', `Durată estimată: ${l.estimatedMin ?? '—'} min · ${steps} pași${l.finalTest?.length ? ` · test final ${l.finalTest.length} întrebări` : ''}`),
        l.objectives?.length ? h('ul.objectives', l.objectives.map((o) => h('li', o))) : null,
        available ? h('div.btn-row',
          running ? h('button.btn.btn-sm', { type: 'button', onclick: () => runner.stop() }, '■ Oprește lecția')
            : prog.step > 0 && !prog.done
              ? [h('button.btn.btn-sm.btn-primary', { type: 'button', onclick: () => runner.start(l.id, { resume: true }) }, `▶ Continuă (pas ${prog.step + 1})`),
                h('button.btn.btn-sm', { type: 'button', onclick: () => runner.start(l.id) }, '↺ De la început')]
              : h('button.btn.btn-sm.btn-primary', { type: 'button', dataset: { lesson: l.id }, onclick: () => runner.start(l.id) }, prog.done ? '↺ Reia lecția' : '▶ Începe lecția'),
          prog.done && l.finalTest?.length && !running ? h('button.btn.btn-sm', { type: 'button', onclick: () => runner.retakeFinal(l.id) }, 'Refă testul final') : null)
          : h('div.planned-note',
            h('p', '🔒 Lecție planificată: procedurile detaliate (cupluri, ordini, calare) diferă între variantele B48 și vor fi adăugate după identificarea exactă a motorului (cod complet, an, model) și importul documentației oficiale.'),
            (l.steps || []).filter((s) => s.type === 'info').length ? h('details', h('summary', 'Conținut informativ disponibil'),
              h('ul', (l.steps || []).filter((s) => s.type === 'info').map((s) => h('li', h('strong', s.title || ''), s.title ? ' — ' : '', s.text || ''))))
              : null)));
    det.addEventListener('toggle', () => { if (det.open) this.expanded.add(l.id); else this.expanded.delete(l.id); });
    return det;
  }

  stepCard(compact) {
    const { app } = this;
    const runner = app.lessons;
    const step = runner.step;
    const lesson = runner.lesson;
    if (!step) return h('div.step-card', h('p', 'Lecția s-a încheiat — urmează testul final.'));
    const st = runner.stepState;
    const fb = st.feedback;
    const sim = app.sim;
    const body = [];

    if (step.title && !compact) body.push(h('h4.step-title', step.title));
    else if (step.title) body.push(h('strong', step.title));
    if (step.text || step.question) body.push(h('p.step-text', step.text || step.question));
    if (runner.hints && step.hint && step.type === 'action') body.push(h('div.hint-box', '💡 ', step.hint));

    const actions = [];
    switch (step.type) {
      case 'info':
        if (step.focus && !compact) actions.push(h('button.btn.btn-sm', { type: 'button', onclick: () => app.select(step.focus, { focus: true }) }, 'Arată piesa'));
        actions.push(h('button.btn.btn-sm.btn-primary', { type: 'button', 'data-step-next': '', onclick: () => runner.next() }, 'Continuă →'));
        break;
      case 'identify':
        body.push(h('p.muted', app.viewOk ? 'Faceți clic pe piesă în vizualizarea 3D.' : 'Vizualizarea 3D nu este disponibilă — selectați piesa din tabul „Ansambluri”.'));
        break;
      case 'demo':
        actions.push(h('button.btn.btn-sm', { type: 'button', disabled: !!st.demoRunning, onclick: () => runner.runDemo(step) }, st.demoRunning ? 'Demonstrație în curs…' : '↻ Repetă demonstrația'));
        actions.push(h('button.btn.btn-sm.btn-primary', { type: 'button', 'data-step-next': '', disabled: !st.demoDone && !runner.freeNav, onclick: () => runner.next() }, 'Continuă →'));
        break;
      case 'tool': {
        const t = sim.getTool(step.tool);
        body.push(h('p.muted', `Sculă activă: ${sim.getTool(sim.activeTool)?.name || 'niciuna'}`));
        if (runner.hints && t) body.push(h('div.hint-box', '💡 Căutați în inventar: ', h('strong', `${t.icon || ''} ${t.name}`)));
        break;
      }
      case 'action': {
        const a = step.action;
        const tgt = step.target;
        const partId = runner.hintPart(step);
        if (partId && !compact) actions.push(h('button.btn.btn-sm', { type: 'button', onclick: () => app.select(partId, { focus: true }) }, 'Arată piesa'));
        if (a === 'tighten') {
          actions.push(h('button.btn.btn-sm.btn-primary', { type: 'button', onclick: () => app.actions.perform('tighten', tgt, { params: runner.hints ? step.params : null }) }, 'Deschide dialogul de strângere'));
        } else if (DIRECT_ACTIONS.has(a) && (runner.hints || runner.freeNav)) {
          actions.push(h('button.btn.btn-sm.btn-primary', { type: 'button', dataset: { stepAction: a },
            onclick: () => app.actions.perform(a, tgt, { measurementId: a === 'measure' ? String(tgt).split('.')[1] : undefined }) }, directLabel(app, a, tgt)));
        } else if (PART_ACTIONS.has(a)) {
          body.push(h('p.muted', 'Executați operațiunea din panoul „Piesă selectată” (dreapta).'));
        } else {
          body.push(h('p.muted', 'Executați operațiunea din tabul „Operațiuni”.'));
        }
        break;
      }
      case 'quiz': {
        const opts = h('div.quiz-options', (step.options || []).map((o, i) => {
          const wrong = (st.wrongAnswers || []).includes(i);
          const correct = st.done && st.quizAnswered === i;
          return h(`button.btn.btn-block.quiz-opt${wrong ? '.wrong' : ''}${correct ? '.correct' : ''}`, { type: 'button', disabled: st.done || wrong, onclick: () => runner.answerQuiz(i) },
            `${String.fromCharCode(65 + i)}. ${o}`);
        }));
        body.push(opts);
        if (st.done) actions.push(h('button.btn.btn-sm.btn-primary', { type: 'button', 'data-step-next': '', onclick: () => runner.next() }, 'Continuă →'));
        break;
      }
      default:
        actions.push(h('button.btn.btn-sm.btn-primary', { type: 'button', onclick: () => runner.next() }, 'Continuă →'));
    }

    const nav = [];
    if (runner.freeNav) {
      nav.push(h('button.btn.btn-xs', { type: 'button', disabled: runner.index === 0, onclick: () => runner.back() }, '← Înapoi'));
      nav.push(h('button.btn.btn-xs', { type: 'button', onclick: () => runner.skip() }, 'Sari →'));
    }
    nav.push(h('button.btn.btn-xs', { type: 'button', title: 'Reia pasul curent și explică ultima greșeală', onclick: () => runner.retry() }, '↺ Reia pasul'));
    if (!compact) nav.push(h('button.btn.btn-xs', { type: 'button', onclick: () => runner.stop() }, '■ Oprește'));

    return h(`div.step-card${compact ? '.compact' : ''}`, { 'aria-live': 'polite' },
      h('div.step-head',
        h('span.step-lesson', `${lesson.code} · Pas ${runner.index + 1}/${runner.total}`),
        h('span.badge.badge-muted', TYPE_LABELS[step.type] || step.type)),
      h('div.step-bar', h('div.step-fill', { style: { width: `${Math.round((runner.index / Math.max(1, runner.total)) * 100)}%` } })),
      ...body,
      fb ? h(`div.feedback.feedback-${fb.level === 'ok' ? 'ok' : fb.level === 'bad' ? 'bad' : 'info'}`, fb.text,
        fb.reasons?.length ? h('ul.reasons', fb.reasons.map((r) => h('li', r))) : null) : null,
      actions.length ? h('div.btn-row', actions) : null,
      h('div.btn-row.step-nav', nav));
  }

  renderHud() {
    const { app } = this;
    clear(this.hudEl);
    if (app.lessons.active) this.hudEl.appendChild(this.stepCard(true));
    else if (app.modes?.currentId === 'guided') {
      this.hudEl.appendChild(h('div.hud-card',
        h('div.hud-title', '🎓 Mod ghidat'),
        h('div.hud-text', 'Alegeți o lecție din tabul „Lecții”. Pașii următori sunt evidențiați în galben în 3D, iar sculele cerute în inventar.')));
    }
    app.hud.setLesson(this.hudEl.firstChild ? this.hudEl : null);
  }
}

function directLabel(app, a, tgt) {
  const { sim } = app;
  switch (a) {
    case 'flag_on': return sim.getFlagDef(tgt)?.onLabel || 'Activează';
    case 'flag_off': return sim.getFlagDef(tgt)?.offLabel || 'Dezactivează';
    case 'test': return `Deschide: ${sim.getTest(tgt)?.name || 'test'}`;
    case 'final_check': return 'Verificare finală';
    case 'measure': return 'Măsoară';
    case 'connect': return `Conectează ${sim.getConnector(tgt)?.name || ''}`;
    case 'disconnect': return `Deconectează ${sim.getConnector(tgt)?.name || ''}`;
    default: return a;
  }
}
