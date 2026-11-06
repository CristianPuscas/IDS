/**
 * Modul Ghidat + motorul de rulare a lecțiilor (LessonRunner).
 * Tipuri de pași: info, identify, demo, tool, action, quiz. Progresul se salvează local per lecție.
 * În modul Liber lecțiile pot fi parcurse cu Înapoi/Sari; în Ghidat se afișează indicii (view.setHint).
 */
import { h, toast, sleep } from '../ui/dom.js';
import { confirmDialog, openModal } from '../ui/modal.js';
import { openQuizDialog } from '../ui/dialogQuiz.js';
import { ACTION_LABELS } from '../ui/actions.js';

const FLAG_OPS = new Set(['setFlag', 'flag', 'flag_on', 'flag_off']);
const TEST_OPS = new Set(['test', 'runTest']);
const FINAL_OPS = new Set(['final_check', 'finalCheck']);
const MECH_OPS = new Set(['loosen', 'remove', 'install', 'install_new', 'tighten', 'connect', 'disconnect', ...FLAG_OPS]);

export class LessonRunner {
  constructor(app) {
    this.app = app;
    this.lesson = null;
    this.index = 0;
    this.offs = [];
    this.stepState = {};
    this.mistakes = 0;
    this.lastError = null;
  }

  get active() { return !!this.lesson; }
  get step() { return this.lesson?.steps?.[this.index] || null; }
  get total() { return this.lesson?.steps?.length || 0; }
  get modeId() { return this.app.modes?.currentId; }
  get freeNav() { return this.modeId === 'free'; }
  get hints() { return this.modeId === 'guided'; }

  lessons() { return this.app.data.lessons?.lessons || []; }
  progressOf(id) { return this.app.storage.get('lessons', {})?.[id] || {}; }
  saveProgress(id, patch) {
    const all = { ...(this.app.storage.get('lessons', {}) || {}) };
    all[id] = { ...(all[id] || {}), ...patch, updated: Date.now() };
    this.app.storage.set('lessons', all);
  }

  async start(lessonId, { resume = false } = {}) {
    const { app } = this;
    const lesson = this.lessons().find((l) => l.id === lessonId);
    if (!lesson) { toast(`Lecție necunoscută: ${lessonId}`, 'error'); return false; }
    if (lesson.status !== 'disponibilă') {
      toast('Lecție planificată — procedurile detaliate necesită varianta exactă a motorului.', 'warn');
      return false;
    }
    if (!['guided', 'free'].includes(this.modeId)) {
      const ok = await confirmDialog('Pornește lecția', 'Lecțiile rulează în modul Ghidat (cu indicii) sau Liber. Treceți în modul Ghidat?', { okLabel: 'Treci în Ghidat' });
      if (!ok) return false;
      if (!(await app.modes.switchTo('guided', { skipConfirm: true }))) return false;
    } else if (this.lesson && this.lesson.id !== lessonId) {
      this.stop();
    }
    this.stop(false);
    this.lesson = lesson;
    this.mistakes = 0;
    this.lastError = null;
    const saved = this.progressOf(lesson.id);
    app.engine.stop(null, { silent: true });
    app.view.clearLeaks();
    let restored = false;
    if (resume && saved.snap && saved.step > 0 && saved.step < this.total) {
      try { app.sim.restore(saved.snap); this.index = saved.step; restored = true; } catch (err) { console.warn('[lecții] snapshot invalid:', err); }
    }
    if (!restored) {
      this.index = 0;
      app.sim.reset();
      app.sim.setEnforce(this.modeId !== 'free');
      if (lesson.initialState) {
        const r = app.sim.applyPreset({ removed: lesson.initialState.removed || [], flags: lesson.initialState.flags || {} });
        if (r && r.ok === false) toast(`Starea inițială a lecției nu a putut fi aplicată complet: ${r.message}`, 'warn', { details: r.reasons });
      }
    }
    app.sim.setEnforce(this.modeId !== 'free');
    app.syncView();
    app.markSaved();
    app.log('info', `Lecția ${lesson.code}: ${lesson.title} — ${restored ? `reluată de la pasul ${this.index + 1}` : 'începută'}.`);
    app.left?.activate('lessons');
    this.enterStep();
    return true;
  }

  stop(save = true) {
    this.clearListeners();
    if (this.lesson && save) this.saveProgress(this.lesson.id, { step: this.index, snap: safeSnap(this.app.sim) });
    if (this.lesson) this.app.bus.emit('lesson:progress', { lessonId: null });
    this.lesson = null;
    this.stepState = {};
    this.app.view.setHint(null);
    this.app.inventory?.highlight(null);
    this.app.lessonsUI?.render();
  }

  clearListeners() {
    for (const off of this.offs) { try { off(); } catch { /* ignoră */ } }
    this.offs = [];
  }

  on(evt, fn) { this.offs.push(this.app.bus.on(evt, fn)); }

  emitProgress(done = false) {
    this.app.bus.emit('lesson:progress', { lessonId: this.lesson.id, stepIndex: this.index, total: this.total, done });
  }

  enterStep() {
    const { app } = this;
    this.clearListeners();
    app.view.setHint(null);
    app.inventory?.highlight(null);
    this.stepState = { wrong: 0, feedback: null, done: false, demoDone: false };
    const step = this.step;
    if (!step) { this.finish(); return; }
    this.emitProgress(false);
    this.saveProgress(this.lesson.id, { step: this.index, snap: safeSnap(app.sim) });

    switch (step.type) {
      case 'info':
        if (step.focus) app.select(step.focus, { focus: true });
        break;
      case 'identify':
        this.on(app.viewOk ? 'view:pick' : 'ui:select', ({ partId } = {}) => this.onIdentify(partId));
        if (this.hints && step.hint) this.stepState.feedback = { level: 'tip', text: step.hint };
        break;
      case 'demo':
        this.runDemo(step);
        break;
      case 'tool':
        if (this.hints) app.inventory?.highlight(step.tool);
        if (app.sim.activeTool === step.tool) { this.stepState.feedback = { level: 'ok', text: 'Scula este deja activă.' }; setTimeout(() => this.complete(), 600); break; }
        this.on('tool:active', ({ toolId } = {}) => {
          if (toolId === step.tool) this.complete('Sculă corectă.');
          else if (toolId) this.setFeedback('bad', `„${app.sim.getTool(toolId)?.name || toolId}” nu este scula cerută.${this.hints ? ` Căutați: ${app.sim.getTool(step.tool)?.name || step.tool}.` : ''}`);
        });
        break;
      case 'action':
        this.on('sim:op', (op) => this.onOp(op));
        if (this.hints) {
          const hp = this.hintPart(step);
          if (hp) app.view.setHint(hp);
          if (step.action === 'tool' || ['loosen', 'tighten', 'remove'].includes(step.action)) { /* sculele sunt indicate în textul pasului */ }
        }
        break;
      case 'quiz':
        break;
      default:
        this.stepState.feedback = { level: 'tip', text: `Tip de pas necunoscut („${step.type}”) — folosiți „Continuă”.` };
    }
    app.lessonsUI?.render();
  }

  /** Piesa care trebuie evidențiată pentru un pas de acțiune. */
  hintPart(step) {
    const { sim } = this.app;
    const t = step.target;
    if (!t) return null;
    if (['connect', 'disconnect'].includes(step.action)) {
      const c = sim.getConnector(t);
      return c?.between?.find((x) => x !== 'cablaj_motor') || null;
    }
    if (step.action === 'measure') return String(t).split('.')[0];
    if (sim.getPart(t)) return t;
    return null;
  }

  setFeedback(level, text, reasons = []) {
    this.stepState.feedback = { level, text, reasons };
    this.app.lessonsUI?.render();
  }

  onIdentify(partId) {
    const step = this.step;
    if (!partId) return;
    if (partId === step.target) { this.complete(`Corect: ${this.app.sim.getPart(partId)?.name}.`); return; }
    this.stepState.wrong++;
    this.mistakes++;
    const picked = this.app.sim.getPart(partId)?.name || partId;
    this.lastError = { text: `Ați selectat „${picked}”, nu piesa cerută.` };
    let text = `Aceasta este „${picked}”. Încercați din nou.`;
    if (this.hints && this.stepState.wrong >= 2) {
      this.app.view.setHint(step.target);
      text += ' Indiciu: piesa cerută pulsează acum în galben.';
    }
    this.app.audio.error();
    this.setFeedback('bad', text);
  }

  matches(step, op) {
    const a = step.action; const t = step.target;
    const opA = op.action;
    if (a === 'flag_on' || a === 'flag_off') return FLAG_OPS.has(opA) && op.target === t;
    if (a === 'test') return TEST_OPS.has(opA) && op.target === t;
    if (a === 'final_check') return FINAL_OPS.has(opA);
    if (a === 'measure') {
      if (opA !== 'measure') return false;
      if (op.target === t) return true;
      const [pid, mid] = String(t).split('.');
      if (op.target !== pid) return false;
      const got = op.result?.data?.measurementId ?? op.measurementId ?? op.result?.data?.id;
      return !got || got === mid;
    }
    if (a === 'install' || a === 'install_new') return (opA === 'install' || opA === 'install_new') && op.target === t;
    return opA === a && op.target === t;
  }

  onOp(op = {}) {
    const step = this.step;
    if (!step || this.stepState.done) return;
    const { sim } = this.app;
    if (!this.matches(step, op)) {
      if (op.result?.ok && MECH_OPS.has(op.action) && this.hints) {
        this.setFeedback('tip', `Operațiunea „${ACTION_LABELS[op.action] || op.action}” a fost efectuată, dar pasul cerut este: ${step.text || ACTION_LABELS[step.action]}.`);
      }
      return;
    }
    const r = op.result || {};
    if (step.action === 'final_check') {
      const rep = r.data || {};
      if (!rep.startable) {
        this.mistakes++;
        this.lastError = { text: 'Verificarea finală arată că motorul nu poate porni.', reasons: (rep.issues || []).map((i) => i.message) };
        this.setFeedback('bad', 'Motorul nu poate porni încă. Rezolvați problemele din raport și rulați din nou verificarea finală.', this.lastError.reasons.slice(0, 6));
        return;
      }
      if ((rep.issues || []).length) this.app.notices?.explain('Verificare finală — observații', `${rep.issues.length} problemă(e) semnalate. Lecția continuă, dar recitiți raportul.`, 'warn', rep.issues.map((i) => i.message).slice(0, 6));
      this.complete('Verificare finală efectuată.');
      return;
    }
    if (!r.ok && step.action === 'tighten' && r.data?.applied) {
      this.mistakes++;
      this.lastError = { text: r.message || 'Strângere incorectă.', reasons: r.reasons || [] };
      this.setFeedback('bad', `${r.message || 'Strângere incorectă.'} Strângerea a fost aplicată greșit: slăbiți elementele de fixare și strângeți din nou corect.`, r.reasons || []);
      return;
    }
    if (!r.ok) {
      this.mistakes++;
      this.lastError = { text: r.message, reasons: r.reasons || [] };
      this.setFeedback('bad', `${r.message || 'Operațiunea a fost refuzată.'}${this.hints && step.hint ? ` Indiciu: ${step.hint}` : ''}`, r.reasons || []);
      return;
    }
    if (step.action === 'flag_on' || step.action === 'flag_off') {
      if (sim.getFlag(step.target) !== (step.action === 'flag_on')) return;
    }
    if (step.action === 'install' && step.params?.newPart && !sim.getPartState(step.target)?.isNew) {
      this.mistakes++;
      this.lastError = { text: 'Piesa trebuia înlocuită cu una nouă (garnitură/etanșare de unică folosință).' };
      this.setFeedback('bad', `${this.lastError.text} Demontați-o din nou și folosiți „Montează piesă nouă”.`);
      return;
    }
    if (step.action === 'tighten') {
      const tq = sim.getPartState(step.target)?.torque || {};
      if (tq.status !== 'ok' || tq.sequenceOk === false) {
        this.mistakes++;
        const why = tq.status === 'under' ? 'cuplul a fost prea mic' : tq.status === 'over' ? 'cuplul a fost prea mare (piesa poate fi deteriorată)'
          : tq.status === 'uncontrolled' ? 'strângerea a fost necontrolată (fără cheie dinamometrică)' : tq.sequenceOk === false ? 'ordinea de strângere a fost greșită' : 'strângerea nu respectă specificația';
        this.lastError = { text: `Strângere incorectă: ${why}.` };
        this.setFeedback('bad', `Strângere incorectă: ${why}. Slăbiți elementele de fixare și strângeți din nou cu cheia dinamometrică, la valoarea și în ordinea din specificație.`);
        return;
      }
    }
    this.complete('Pas realizat corect.');
  }

  async runDemo(step) {
    const { app } = this;
    const v = app.view;
    this.stepState.demoRunning = true;
    app.lessonsUI?.render();
    try {
      const target = step.target;
      if (target && app.sim.getPart(target)) { app.select(target, { focus: true }); }
      switch (step.demo) {
        case 'explode': {
          await tween(1200, (t) => { v.setExplode(t); app.header?.setExplodeValue(t); });
          await sleep(1500);
          await tween(900, (t) => { v.setExplode(1 - t); app.header?.setExplodeValue(1 - t); });
          break;
        }
        case 'xray':
          v.setXray(true); app.header?.setXrayPressed(true);
          await sleep(3500);
          v.setXray(false); app.header?.setXrayPressed(false);
          break;
        case 'isolate': {
          const asm = (app.data.parts.assemblies || []).find((a) => a.id === target);
          const ids = asm ? app.data.parts.parts.filter((p) => p.assembly === asm.id).map((p) => p.id) : [target, ...(safe(() => app.sim.benchGroup(target)) || [])];
          v.isolate(ids.filter(Boolean));
          await sleep(3500);
          v.isolate(null);
          app.syncView();
          break;
        }
        case 'remove_install': {
          const group = safe(() => app.sim.benchGroup(target)) || [];
          app.audio.clunk();
          await v.animateRemove(target, group);
          await sleep(700);
          await v.animateInstall(target, group);
          app.audio.clunk();
          app.syncView();
          break;
        }
        case 'run': {
          v.setRunning(true, { rpm: 800 });
          app.audio.startEngine({}, { startable: true, duration: 5 });
          await sleep(5600);
          v.setRunning(false);
          break;
        }
        default:
          await sleep(300);
      }
    } catch (err) {
      console.error('[lecții] demonstrație eșuată:', err);
    }
    if (this.step !== step) return;
    this.stepState.demoRunning = false;
    this.stepState.demoDone = true;
    app.lessonsUI?.render();
  }

  answerQuiz(i) {
    const step = this.step;
    if (!step || step.type !== 'quiz' || this.stepState.done) return;
    const ok = i === step.answer;
    this.app.score?.record('quiz', ok);
    if (ok) {
      this.stepState.quizAnswered = i;
      this.app.audio.success();
      this.setFeedback('ok', `Corect. ${step.explanation || ''}`);
      this.stepState.done = true;
      this.app.lessonsUI?.render();
    } else {
      this.mistakes++;
      this.stepState.wrong++;
      this.stepState.wrongAnswers = [...(this.stepState.wrongAnswers || []), i];
      this.lastError = { text: `Răspuns greșit: „${step.options[i]}”.` };
      this.app.audio.error();
      this.setFeedback('bad', `Răspuns greșit. ${this.hints && step.explanation && this.stepState.wrong >= 2 ? step.explanation : 'Recitiți întrebarea și încercați din nou.'}`);
    }
  }

  complete(msg) {
    if (!this.lesson || this.stepState.done) return;
    this.stepState.done = true;
    this.clearListeners();
    this.app.view.setHint(null);
    this.app.audio.chime();
    if (msg) this.setFeedback('ok', msg);
    const idx = this.index;
    setTimeout(() => { if (this.lesson && this.index === idx) this.next(); }, 700);
  }

  next() {
    if (!this.lesson) return;
    this.index++;
    this.enterStep();
  }

  back() {
    if (!this.lesson || !this.freeNav || this.index === 0) return;
    this.index--;
    this.enterStep();
  }

  skip() {
    if (!this.lesson || !this.freeNav) return;
    this.app.log('warn', `Pas sărit: ${this.step?.title || this.step?.text || this.index + 1}.`);
    this.next();
  }

  retry() {
    if (!this.lesson) return;
    const err = this.lastError;
    if (err) this.app.notices?.explain('Reia pasul — ce a mers greșit', err.text, 'warn', err.reasons || []);
    this.enterStep();
    if (err) this.setFeedback('tip', `Data trecută: ${err.text}${this.step?.hint ? ` Sfat: ${this.step.hint}` : ''}`);
  }

  async finish() {
    const { app } = this;
    const lesson = this.lesson;
    if (!lesson) return;
    this.clearListeners();
    this.emitProgress(true);
    let result = { score: 100, correct: 0, total: 0 };
    if (lesson.finalTest?.length) {
      result = (await openQuizDialog(app, { title: `Test final — Lecția ${lesson.code}`, questions: lesson.finalTest, intro: 'Răspundeți la întrebările de verificare pentru a încheia lecția.' })) || null;
    }
    if (!result) {
      this.saveProgress(lesson.id, { step: this.total, snap: null });
      toast('Testul final a fost abandonat. Îl puteți relua din lista de lecții.', 'warn');
      this.lesson = null;
      app.bus.emit('lesson:progress', { lessonId: null });
      app.lessonsUI?.render();
      return;
    }
    const prev = this.progressOf(lesson.id);
    this.saveProgress(lesson.id, { done: true, step: 0, snap: null, score: result.score, bestScore: Math.max(prev.bestScore || 0, result.score), mistakes: this.mistakes, completedAt: Date.now() });
    app.storage.save();
    app.audio.success();
    app.log('success', `Lecția ${lesson.code} finalizată — test final ${result.score}% · greșeli pe parcurs: ${this.mistakes}.`);
    this.lesson = null;
    app.view.setHint(null);
    app.bus.emit('lesson:progress', { lessonId: lesson.id, stepIndex: lesson.steps.length, total: lesson.steps.length, done: true });
    app.lessonsUI?.render();
    openModal({ title: `Lecția ${lesson.code} finalizată`, size: 'sm', body: h('div.quiz-summary',
      h('div.big', `${result.score}%`), h('p', `Test final: ${result.correct}/${result.total} corecte.`), h('p.muted', `Greșeli pe parcursul lecției: ${this.mistakes}.`)) });
  }

  /** Retake doar pentru testul final. */
  async retakeFinal(lessonId) {
    const lesson = this.lessons().find((l) => l.id === lessonId);
    if (!lesson?.finalTest?.length) return;
    const r = await openQuizDialog(this.app, { title: `Test final — Lecția ${lesson.code}`, questions: lesson.finalTest });
    if (!r) return;
    const prev = this.progressOf(lesson.id);
    this.saveProgress(lesson.id, { done: true, score: r.score, bestScore: Math.max(prev.bestScore || 0, r.score) });
    this.app.lessonsUI?.render();
  }
}

function safe(fn) { try { return fn(); } catch { return null; } }
function safeSnap(sim) { try { return sim.snapshot(); } catch { return null; } }
function tween(ms, fn) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - t0) / ms);
      fn(t * t * (3 - 2 * t));
      if (t < 1) requestAnimationFrame(tick); else resolve();
    };
    requestAnimationFrame(tick);
  });
}

export function createGuidedMode(app) {
  return {
    id: 'guided',
    name: 'Ghidat',
    enter() {
      app.sim.setEnforce(true);
      app.left?.activate('lessons');
      app.lessonsUI?.renderHud();
    },
    exit() {},
    hasUnsavedProgress() { return false; }
  };
}
