/**
 * Modul Diagnostic: defect aleator sau ales din listă (sim.loadFault), simptome, „Ascultă motorul”,
 * teste/inspecții/măsurători, apoi „Pune diagnosticul” (sim.diagnose) → scor, diagnostic diferențial, verificări recomandate.
 * Conține și tabul „Diagnostic” din panoul stâng.
 */
import { h, clear, toast, badge } from '../ui/dom.js';
import { openModal, confirmDialog } from '../ui/modal.js';

export function createDiagnosisMode(app) {
  const el = h('div.diag');
  let fault = null;
  let result = null;
  let listening = false;
  let seed = Date.now() % 100000;

  const faults = () => app.data.faults?.faults || [];

  const load = (id) => {
    app.engine.stop(null, { silent: true });
    app.sim.reset();
    app.sim.setEnforce(true);
    app.view.clearLeaks();
    const r = app.sim.loadFault(id);
    if (r && r.ok === false) { toast(r.message || 'Defectul nu a putut fi încărcat.', 'error'); return; }
    fault = faults().find((f) => f.id === id) || null;
    result = null;
    app.syncView();
    app.markSaved();
    app.log('info', 'Scenariu de diagnostic încărcat. Citiți simptomele și investigați.');
    render();
  };

  const random = () => {
    const list = faults();
    if (!list.length) { toast('Nu există scenarii de defect în date.', 'warn'); return; }
    seed = (seed * 9301 + 49297) % 233280;
    let pick = list[Math.floor((seed / 233280) * list.length)];
    if (fault && list.length > 1 && pick.id === fault.id) pick = list[(list.indexOf(pick) + 1) % list.length];
    load(pick.id);
  };

  const listen = async () => {
    if (!fault || listening) return;
    listening = true; render();
    const sound = fault.sound || {};
    app.audio.ensure();
    const started = await app.audio.startEngine(sound, { startable: !sound.noStart, duration: 7 });
    if (started) {
      app.view.setRunning(true, { rpm: 800, misfireCylinder: sound.misfireCylinder || 0, roughness: sound.roughness || 0 });
      setTimeout(() => { app.view.setRunning(false); listening = false; render(); }, 7000);
    } else { listening = false; render(); }
  };

  const diagnoseDialog = () => {
    if (!fault) return;
    const chosen = new Set();
    let q = '';
    const list = h('div.diag-pick');
    const renderList = () => {
      clear(list);
      for (const a of app.data.parts.assemblies || []) {
        const parts = app.data.parts.parts.filter((p) => p.assembly === a.id && (!q || p.name.toLowerCase().includes(q)));
        if (!parts.length) continue;
        list.appendChild(h('fieldset.diag-group', h('legend', a.name), parts.map((p) => h('label.chk',
          h('input', { type: 'checkbox', checked: chosen.has(p.id), onchange: (e) => { if (e.target.checked) chosen.add(p.id); else chosen.delete(p.id); count.textContent = `${chosen.size} piese alese`; } }),
          ' ', p.name))));
      }
    };
    const search = h('input.input.search', { type: 'search', placeholder: 'Caută piesă…', 'aria-label': 'Caută piesă' });
    search.addEventListener('input', () => { q = search.value.trim().toLowerCase(); renderList(); });
    const count = h('span.muted', '0 piese alese');
    if (app.state.selected) chosen.add(app.state.selected);
    renderList();
    count.textContent = `${chosen.size} piese alese`;
    const m = openModal({ title: 'Pune diagnosticul', size: 'lg',
      body: h('div', h('p', 'Selectați piesa (piesele) care cauzează defectul. Piesa selectată în 3D este bifată automat.'), h('div.btn-row', search, count), list),
      actions: [{ label: 'Renunță', value: null }, { label: 'Confirmă diagnosticul', kind: 'primary', onClick: () => {
        if (!chosen.size) { toast('Alegeți cel puțin o piesă.', 'warn'); return false; }
        return [...chosen];
      } }] });
    m.result.then((ids) => {
      if (!Array.isArray(ids)) return;
      const r = app.sim.diagnose(ids);
      if (!r?.ok && !r?.data) return;
      result = r.data || {};
      const hist = app.storage.get('diagHistory', []) || [];
      hist.push({ fault: fault.id, score: result.score ?? 0, time: Date.now() });
      app.storage.set('diagHistory', hist.slice(-50));
      if ((result.score ?? 0) >= 70) app.audio.success(); else app.audio.error();
      app.log((result.score ?? 0) >= 70 ? 'success' : 'warn', `Diagnostic: scor ${result.score ?? 0}/100.`);
      render();
      showResult();
    });
  };

  const names = (ids) => (ids || []).map((id) => app.sim.getPart(id)?.name || id);
  const showResult = () => {
    if (!result || !fault) return;
    openModal({ title: `Rezultat diagnostic — ${result.score ?? 0}/100`, size: 'lg', body: resultView() });
  };
  const resultView = () => h('div.diag-result',
    h('div.quiz-summary', h('div.big', `${result.score ?? 0}/100`), h('p', h('strong', 'Defect real: '), fault.title)),
    h('dl.stats',
      h('dt', 'Corect identificate'), h('dd', names(result.correct).join(', ') || '—'),
      h('dt', 'Omise'), h('dd', names(result.missed).join(', ') || '—'),
      h('dt', 'Greșit acuzate'), h('dd', names(result.wrong).join(', ') || '—')),
    fault.explanation ? h('div', h('h3.sub', 'Explicație'), h('p', fault.explanation)) : null,
    fault.differential?.length ? h('div', h('h3.sub', 'Diagnostic diferențial'), h('ul', fault.differential.map((d) => h('li', d)))) : null,
    fault.recommendedChecks?.length ? h('div', h('h3.sub', 'Verificări recomandate'), h('ul', fault.recommendedChecks.map((d) => h('li', d)))) : null,
    h('p.disclaimer', fault.valuesNote || 'Toate valorile sunt simulate, NEVERIFICATE.'),
    h('p.field-note', 'Defectul este considerat reparat când piesele cauză sunt înlocuite cu piese noi. Verificați cu „Verificare finală”.'));

  function render() {
    clear(el);
    const active = app.modes?.currentId === 'diagnosis';
    if (!active) {
      el.append(h('section.lsec', h('h3', 'Diagnostic'),
        h('p', 'Investigați un defect simulat: ascultați motorul, faceți teste (compresie, pierderi de presiune, presiune ulei…), inspecții și măsurători, apoi puneți diagnosticul.'),
        h('button.btn.btn-primary', { type: 'button', onclick: () => app.modes.switchTo('diagnosis') }, 'Activează modul Diagnostic')));
      return;
    }
    const list = faults();
    el.append(h('section.lsec', h('h3', 'Scenariu'),
      h('div.btn-row',
        h('button.btn.btn-sm.btn-primary', { type: 'button', onclick: async () => { if (!fault || result || await confirmDialog('Defect nou', 'Scenariul curent se abandonează.', { okLabel: 'Defect nou' })) random(); } }, '🎲 Defect aleator'),
        h('select.input.input-sm', { 'aria-label': 'Alege scenariul din listă', onchange: (e) => { if (e.target.value) load(e.target.value); } },
          h('option', { value: '' }, 'Alege din listă…'),
          list.map((f, i) => h('option', { value: f.id }, `Scenariul ${i + 1} — ${f.category || 'general'}, dificultate ${f.difficulty ?? '?'}`)))),
      h('p.field-note', 'Titlurile defectelor sunt ascunse până la diagnostic.')));
    if (!fault) {
      el.append(h('p.muted', 'Alegeți un scenariu pentru a începe.'));
      return;
    }
    el.append(h('section.lsec', h('h3', 'Simptome raportate'),
      h('ul.symptoms', (fault.symptoms || []).map((s) => h('li', s))),
      h('div.btn-row',
        h('button.btn.btn-sm', { type: 'button', disabled: listening, onclick: listen }, listening ? '🔊 Se ascultă…' : '🔊 Ascultă motorul'),
        h('button.btn.btn-sm', { type: 'button', onclick: () => app.left.activate('operations') }, 'Teste motor →'))),
    h('section.lsec', h('h3', 'Investigație'),
      h('p.field-note', 'Folosiți tabul „Operațiuni” pentru teste și panoul piesei pentru inspecții și măsurători. Deteriorările nu sunt afișate direct — trebuie descoperite.'),
      h('dl.stats', h('dt', 'Operațiuni'), h('dd', String(app.sim.stats?.ops ?? 0)), h('dt', 'Greșeli'), h('dd', String(app.sim.stats?.errors ?? 0)))),
    h('section.lsec', h('h3', 'Concluzie'),
      result ? h('div', badge(`Scor ${result.score ?? 0}/100`, (result.score ?? 0) >= 70 ? 'ok' : 'warn'), ' ',
        h('button.btn.btn-sm', { type: 'button', onclick: showResult }, 'Vezi rezultatul'))
        : h('button.btn.btn-primary.btn-block', { type: 'button', onclick: diagnoseDialog }, '🩺 Pune diagnosticul')));
  }

  return {
    id: 'diagnosis',
    name: 'Diagnostic',
    tab() { return { id: 'diagnosis', label: 'Diagnostic', icon: '🩺', el, render }; },
    enter() {
      app.sim.setEnforce(true);
      app.hud.setMode(h('div.hud-card', h('div.hud-title', '🩺 Mod diagnostic'),
        h('div.hud-text', 'Ascultați motorul, testați și inspectați, apoi puneți diagnosticul (tabul „Diagnostic”).')));
      fault = null; result = null;
      random();
      app.left?.activate('diagnosis');
    },
    exit() {
      try { app.sim.loadFault(null); } catch { /* opțional */ }
      fault = null; result = null;
      app.view.setRunning(false);
    },
    hasUnsavedProgress() { return !!fault && !result; }
  };
}
