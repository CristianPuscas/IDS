/**
 * Bootstrap BMW B48 Mechanic Simulator:
 * date (dataLoader) → validare (validateData) → EventBus → Simulator → EngineView (cu revenire dacă WebGL eșuează)
 * → UI → moduri → audio → restaurare progres. Gestionare globală a erorilor.
 */
import { EventBus } from './core/eventBus.js';
import { Storage } from './core/storage.js';
import { loadData } from './core/dataLoader.js';
import { Importer } from './core/importer.js';
import { AudioEngine } from './audio/audioEngine.js';
import { h, $, toast, rafThrottle, fmtDate } from './ui/dom.js';
import { choiceDialog } from './ui/modal.js';
import { Actions } from './ui/actions.js';
import { setupGlue } from './ui/glue.js';
import { EngineControl } from './ui/engineControl.js';
import { PartPanel } from './ui/partPanel.js';
import { LeftPanel } from './ui/leftPanel.js';
import { createOperationsTab } from './ui/tabOperations.js';
import { createAssembliesTab } from './ui/tabAssemblies.js';
import { createBenchTab } from './ui/tabBench.js';
import { createDataTab, showValidationModal } from './ui/tabData.js';
import { LessonsUI } from './ui/lessons.js';
import { Inventory } from './ui/inventory.js';
import { LogPanel, Notices } from './ui/logPanel.js';
import { Header, notifySaved } from './ui/header.js';
import { ModeManager } from './modes/modeManager.js';
import { createFreeMode } from './modes/free.js';
import { createGuidedMode, LessonRunner } from './modes/guided.js';
import { createExamMode } from './modes/exam.js';
import { createDiagnosisMode } from './modes/diagnosis.js';
import { createAssemblyMode } from './modes/assembly.js';
import { createWorkshopMode } from './modes/workshop.js';

const app = {
  state: { selected: null },
  viewOk: false,
  validation: { errors: [], warnings: [] },
  savedOps: 0
};
window.__b48app = app; // util pentru depanare din consolă

// ---------- încărcare ----------
const setStatus = (t) => { const el = $('#loading-status'); if (el) el.textContent = t; };
function showFatal(title, err, { offerClearOverrides = false } = {}) {
  console.error(title, err);
  const box = $('#loading-error');
  const lines = String(err?.message || err).split('\n');
  box.hidden = false;
  box.replaceChildren(h('strong', title), h('ul', lines.map((l) => h('li', l))),
    h('div.btn-row',
      h('button.btn.btn-primary', { type: 'button', onclick: () => location.reload() }, 'Reîncearcă'),
      offerClearOverrides ? h('button.btn', { type: 'button', onclick: () => { app.storage?.set('overrides', {}); app.storage?.save(); location.reload(); } }, 'Șterge datele importate și reîncearcă') : null));
  document.querySelector('#loading .spinner')?.remove();
  setStatus('Aplicația nu a putut porni.');
}

// ---------- vizualizare 3D sigură ----------
const NOOP_VIEW_METHODS = ['init', 'select', 'setHint', 'setDamaged', 'animateRemove', 'animateInstall', 'setPartVisible', 'syncVisibility',
  'setGhostRemoved', 'setAssemblyVisible', 'setXray', 'setExplode', 'isolate', 'focus', 'resetCamera', 'setLabels', 'showLeak', 'clearLeaks',
  'playToolAnimation', 'setRunning', 'setTheme', 'getPartIds', 'dispose'];

function nullView() {
  const v = {};
  for (const m of NOOP_VIEW_METHODS) v[m] = () => Promise.resolve();
  v.getPartIds = () => [];
  v.isNull = true;
  return v;
}

/** Învelește EngineView: o eroare într-o metodă 3D nu blochează UI-ul. */
function safeView(real) {
  return new Proxy(real, {
    get(target, prop) {
      if (prop === 'then') return undefined;
      const val = target[prop];
      if (typeof val !== 'function') {
        if (val === undefined && NOOP_VIEW_METHODS.includes(prop)) return () => Promise.resolve();
        return val;
      }
      return (...args) => {
        try {
          const r = val.apply(target, args);
          return r && typeof r.then === 'function' ? r.catch((err) => { console.error(`[3D] ${String(prop)} a eșuat:`, err); }) : r;
        } catch (err) {
          console.error(`[3D] ${String(prop)} a eșuat:`, err);
          return Promise.resolve();
        }
      };
    }
  });
}

async function createView() {
  const host = $('#view-host');
  try {
    const { EngineView } = await import('./scene/EngineView.js');
    const view = new EngineView(host, app.bus, app.data.parts);
    await view.init();
    app.viewOk = true;
    return safeView(view);
  } catch (err) {
    console.warn('[3D] Vizualizarea 3D nu este disponibilă:', err);
    const box = $('#view-error');
    box.hidden = false;
    box.replaceChildren(h('div.view-error-card',
      h('div.empty-icon', { 'aria-hidden': 'true' }, '🖥'),
      h('h2', 'Vizualizarea 3D nu este disponibilă'),
      h('p', 'Browserul nu a putut inițializa WebGL (sau modulul 3D nu s-a încărcat). Restul simulatorului funcționează: selectați piesele din tab-urile „Ansambluri” și „Banc”, iar operațiunile, lecțiile și testele rămân disponibile.'),
      h('p.muted', `Detalii: ${err?.message || err}`)));
    try { host.replaceChildren(); } catch { /* ignoră */ }
    return nullView();
  }
}

// ---------- erori globale ----------
let lastErr = { msg: '', t: 0 };
function reportGlobalError(msg) {
  const now = Date.now();
  if (msg === lastErr.msg && now - lastErr.t < 3000) return;
  lastErr = { msg, t: now };
  try { app.log?.('error', `Eroare neașteptată: ${msg}`); } catch { /* ignoră */ }
  toast(`Eroare neașteptată: ${msg}`, 'error');
}
window.addEventListener('error', (e) => {
  const msg = e?.message || String(e?.error || 'eroare');
  if (/ResizeObserver loop/i.test(msg)) return;
  reportGlobalError(msg);
});
window.addEventListener('unhandledrejection', (e) => {
  const r = e?.reason;
  reportGlobalError(r?.message || String(r));
});

// ---------- bootstrap ----------
async function boot() {
  const storage = new Storage();
  app.storage = storage;
  document.documentElement.dataset.theme = storage.get('theme', 'dark') === 'light' ? 'light' : 'dark';

  setStatus('Se încarcă validatorul de date…');
  let validateData = null;
  try { ({ validateData } = await import('./core/validateData.js')); } catch (err) { console.warn('[date] validateData indisponibil:', err); }
  app.importer = new Importer(storage, { validate: validateData });

  setStatus('Se încarcă datele motorului…');
  try {
    const loaded = await loadData({ overrides: storage.get('overrides', {}), variant: storage.get('variant', null) });
    app.data = loaded.data;
    app.baseData = loaded.base;
  } catch (err) {
    showFatal('Datele nu au putut fi încărcate', err, { offerClearOverrides: app.importer.hasOverrides() });
    return;
  }

  setStatus('Se validează datele…');
  if (validateData) {
    try { const v = validateData(app.data) || {}; app.validation = { errors: v.errors || [], warnings: v.warnings || [] }; }
    catch (err) { app.validation = { errors: [`Validatorul a eșuat: ${err.message}`], warnings: [] }; }
  } else {
    app.validation = { errors: [], warnings: ['Validatorul de date (js/core/validateData.js) nu este disponibil.'] };
  }

  app.bus = new EventBus();
  app.log = (level, message) => app.bus.emit('sim:log', { level, message, time: Date.now() });

  setStatus('Se inițializează simulatorul…');
  try {
    const { Simulator } = await import('./sim/Simulator.js');
    app.sim = new Simulator(app.data, app.bus, { seed: 1, enforce: true });
  } catch (err) {
    showFatal('Simulatorul nu a putut porni', err, { offerClearOverrides: app.importer.hasOverrides() });
    return;
  }

  app.audio = new AudioEngine({ volume: storage.get('volume', 0.7), muted: storage.get('muted', false) });

  setStatus('Se construiește modelul 3D…');
  app.view = await createView();
  try { app.view.setTheme(document.documentElement.dataset.theme); } catch { /* opțional */ }

  setStatus('Se pregătește interfața…');
  buildUi();
  await startModes();
  hideLoading();
  afterStart();
}

function buildUi() {
  const modeHud = h('div.hud-slot');
  const lessonHud = h('div.hud-slot');
  const hudToggle = h('button.hud-toggle', { type: 'button', 'aria-expanded': 'true', onclick: () => {
    const c = $('#mode-hud').classList.toggle('collapsed');
    hudToggle.setAttribute('aria-expanded', String(!c));
    hudToggle.textContent = c ? '▸ Arată instrucțiunile' : '▾ Ascunde';
  } }, '▾ Ascunde');
  $('#mode-hud').append(hudToggle, modeHud, lessonHud);
  app.hud = {
    setMode(el) { modeHud.replaceChildren(...(el ? [el] : [])); },
    setLesson(el) { if (el) { if (el.parentNode !== lessonHud) lessonHud.replaceChildren(el); } else lessonHud.replaceChildren(); },
    clear() { modeHud.replaceChildren(); }
  };

  app.score = {
    counts: {},
    record(kind, ok) { const c = (this.counts[kind] ||= { ok: 0, total: 0 }); c.total++; if (ok) c.ok++; }
  };

  app.actions = new Actions(app);
  app.engine = new EngineControl(app);
  app.notices = new Notices(app, $('#notices'));
  app.logPanel = new LogPanel(app, $('#log'));
  app.partPanel = new PartPanel(app, $('#part-panel'));
  app.inventory = new Inventory(app, $('#inventory'));
  app.lessons = new LessonRunner(app);
  app.lessonsUI = new LessonsUI(app);
  app.modes = new ModeManager(app);
  const diagMode = createDiagnosisMode(app);

  app.left = new LeftPanel(app, $('#left-panel'));
  app.left.add(app.lessonsUI.tab());
  app.left.add(createOperationsTab(app));
  app.left.add(createAssembliesTab(app));
  app.left.add(createBenchTab(app));
  app.left.add(diagMode.tab());
  app.left.add(createDataTab(app));

  app.modes.register(createFreeMode(app));
  app.modes.register(createGuidedMode(app));
  app.modes.register(createExamMode(app));
  app.modes.register(diagMode);
  app.modes.register(createAssemblyMode(app));
  app.modes.register(createWorkshopMode(app));

  app.select = (partId, { focus = false } = {}) => {
    const id = partId && app.sim.getPart(partId) ? partId : null;
    app.state.selected = id;
    app.view.select(id);
    if (id && focus && app.sim.isOnEngine(id)) app.view.focus(id);
    app.bus.emit('ui:select', { partId: id });
    app.partPanel.show(id);
    app.left.refresh();
    if (id && window.matchMedia('(max-width: 900px)').matches && document.body.classList.contains('show-left')) {
      document.body.classList.remove('show-left');
    }
  };

  const doRefresh = rafThrottle(() => {
    try { app.partPanel.render(); } catch (err) { console.error('[ui] panou piesă:', err); }
    app.left.refresh();
    app.lessonsUI.renderHud();
  });
  app.refresh = (immediate = false) => { if (immediate) { app.partPanel.render(); app.left.refresh(); app.lessonsUI.renderHud(); } else doRefresh(); };

  app.markSaved = () => { app.savedOps = app.sim.stats?.ops || 0; };
  app.hasUnsavedSim = () => (app.sim.stats?.ops || 0) > app.savedOps;

  app.saveProgress = () => {
    try {
      app.storage.set('simSnapshot', { savedAt: Date.now(), mode: app.modes.currentId, snap: app.sim.snapshot() });
      if (app.lessons.active) app.lessons.saveProgress(app.lessons.lesson.id, { step: app.lessons.index, snap: app.sim.snapshot() });
    } catch (err) { console.error(err); }
    const ok = app.storage.save();
    app.markSaved();
    notifySaved(ok);
    app.log(ok ? 'success' : 'warn', ok ? 'Progres salvat local.' : 'Salvarea locală a eșuat (stocare blocată).');
  };

  app.resetEngine = async () => {
    app.lessons.stop();
    app.engine.stop(null, { silent: true });
    const mode = app.modes.current;
    if (mode && ['exam', 'assembly', 'diagnosis'].includes(mode.id)) {
      try { mode.exit(); await mode.enter(); } catch (err) { console.error(err); }
    } else {
      app.sim.reset();
      app.sim.setEnforce(mode?.id !== 'free');
    }
    for (const id of app.sim.partIds || []) app.view.setDamaged(id, false);
    app.view.clearLeaks();
    app.syncView();
    app.select(null);
    app.markSaved();
    toast('Motorul a fost resetat la starea inițială.', 'info');
  };

  app.resetAll = () => {
    app.storage.clearProgress();
    toast('Progresul a fost șters.', 'info');
    setTimeout(() => location.reload(), 300);
  };

  app.showValidation = () => showValidationModal(app);

  app.header = new Header(app);
  setupGlue(app);
  app.inventory.render();
  app.partPanel.render();
  app.select(null);
  window.addEventListener('beforeunload', () => app.storage.save());
}

async function startModes() {
  const saved = app.storage.get('mode', 'free');
  const id = app.modes.get(saved) ? saved : 'free';
  // modurile cu sesiune proprie pornesc mereu de la zero; la încărcare nu se cere confirmare
  await app.modes.switchTo(id, { skipConfirm: true });
  const tab = app.storage.get('ui.tab', null);
  if (tab && !['diagnosis'].includes(tab)) app.left.activate(tab);
  app.syncView();
}

function hideLoading() {
  const l = $('#loading');
  l.classList.add('done');
  setTimeout(() => l.remove(), 400);
}

async function afterStart() {
  const v = app.validation;
  if (v.errors.length) {
    showValidationPanel(v);
    app.log('error', `Validarea datelor: ${v.errors.length} erori, ${v.warnings.length} avertismente.`);
  } else if (v.warnings.length) {
    app.log('warn', `Validarea datelor: ${v.warnings.length} avertismente (vezi „Date & Import”).`);
  }
  if (!app.storage.available) toast('Stocarea locală este blocată — progresul nu se va păstra după închiderea paginii.', 'warn');
  app.log('info', `Simulator pornit — ${app.data.parts.parts.length} piese, ${app.data.lessons.lessons.length} lecții, ${app.data.faults.faults.length} scenarii de defect.`);

  const snap = app.storage.get('simSnapshot', null);
  if (snap?.snap && ['free', 'guided', 'workshop'].includes(app.modes.currentId)) {
    const c = await choiceDialog('Sesiune salvată', `S-a găsit o stare salvată a motorului (${fmtDate(snap.savedAt)}). Doriți să o reluați?`, [
      { label: 'Începe de la zero', value: false },
      { label: 'Reia sesiunea', value: true, kind: 'primary' }
    ]);
    if (c === true) {
      const r = app.sim.restore(snap.snap);
      if (r?.ok === false) toast(r.message, 'error');
      else {
        app.sim.setEnforce(app.modes.currentId !== 'free');
        app.syncView();
        app.markSaved();
        toast('Sesiunea a fost reluată.', 'success');
      }
    }
  }
}

function showValidationPanel(v) {
  const panel = h('div.validation-panel', { role: 'alert' },
    h('div.vp-head', h('strong', `⚠ Datele au ${v.errors.length} erori de validare`),
      h('button.icon-btn.icon-xs', { type: 'button', 'aria-label': 'Închide panoul de validare', onclick: () => panel.remove() }, '×')),
    h('ul', v.errors.slice(0, 5).map((e) => h('li', e))),
    v.errors.length > 5 ? h('p.muted', `… și încă ${v.errors.length - 5}.`) : null,
    h('button.btn.btn-xs', { type: 'button', onclick: () => app.showValidation() }, 'Toate detaliile'));
  $('#viewport').appendChild(panel);
}

boot().catch((err) => showFatal('Eroare la pornire', err));
