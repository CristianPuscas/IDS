/*
 * Tracker de sarcini.
 * Introduci o sarcină o singură dată (lista generală), iar dashboardul, kanbanul, matricea
 * Eisenhower, calendarul și planificatoarele se actualizează singure.
 *
 * STAREA (JSON simplu, salvată ca un singur document):
 * {
 *   tasks: [{
 *     id: string,
 *     title: string,
 *     due: 'YYYY-MM-DD' | null,           // termenul
 *     assignee: string,                   // numele executantului ('' = fără)
 *     status: 'neinceput' | 'lucru' | 'asteptare' | 'suspendat' | 'finalizat',
 *     category: string,                   // numele categoriei ('' = fără)
 *     priority: 'critic' | 'ridicat' | 'mediu' | 'scazut' | '',
 *     important: boolean, urgent: boolean, // matricea Eisenhower
 *     notes: string,
 *     time: 'HH:MM' | '',                 // ora (calendar / planificator)
 *     createdAt: 'YYYY-MM-DD',
 *     doneAt: 'YYYY-MM-DD' | null,        // se completează când statusul devine „finalizat”
 *     prevStatus?: string                 // doar la sarcinile finalizate: statusul refăcut la debifare
 *   }],
 *   people: [{ name, emoji }],            // executanți
 *   categories: [{ name, emoji }],
 *   boardNotes: { kanban: string, matrix: string },
 *   planner: {
 *     settings: { start: 'HH:MM', interval: 30 | 60, hours: 8 | 12 | 16 | 24, format24: boolean, includeDaily: boolean },
 *     days: { 'YYYY-MM-DD': { top3: [string, string, string], slots: { 'HH:MM': string } } }
 *   }
 * }
 * „Întârziat” nu se stochează: e derivat (termen < azi și status ≠ finalizat).
 */
(function () {
  'use strict';

  var TK = window.TK;
  if (!TK) return;
  var h = TK.h, D = TK.date, F = TK.fmt;

  /* ------------------------------------------------------------ constante */

  var STATUSES = [
    { id: 'neinceput', label: 'Neînceput', icon: '○', tone: 'grey', color: 'var(--line-strong)' },
    { id: 'lucru', label: 'În lucru', icon: '🔧', tone: 'terra', color: 'var(--terra)' },
    { id: 'asteptare', label: 'În așteptare', icon: '⏳', tone: 'blue', color: 'var(--pie-2)' },
    { id: 'suspendat', label: 'Suspendat', icon: '⏸', tone: 'gold', color: 'var(--pie-6)' },
    { id: 'finalizat', label: 'Finalizat', icon: '✓', tone: 'good', color: 'var(--chart-plan)' },
  ];
  var PRIORITIES = [
    { id: 'critic', label: 'Critic', icon: '🔺', tone: 'bad', color: 'var(--accent)' },
    { id: 'ridicat', label: 'Ridicat', icon: '🔴', tone: 'rose', color: 'var(--terra)' },
    { id: 'mediu', label: 'Mediu', icon: '🟡', tone: 'gold', color: 'var(--gold)' },
    { id: 'scazut', label: 'Scăzut', icon: '🟢', tone: 'sage', color: 'var(--chart-plan)' },
  ];
  var QUADRANTS = [
    { id: 'do', imp: true, urg: true, title: 'Fă acum', sub: 'Important și urgent', color: 'var(--sage)' },
    { id: 'plan', imp: true, urg: false, title: 'Planifică', sub: 'Important, nu urgent', color: 'var(--rose)' },
    { id: 'delegate', imp: false, urg: true, title: 'Deleagă', sub: 'Urgent, nu important', color: 'var(--gold)' },
    { id: 'drop', imp: false, urg: false, title: 'Elimină', sub: 'Nici important, nici urgent', color: 'var(--ink-3)' },
  ];
  var STATUS_BY = {}, PRIO_BY = {}, QUAD_BY = {};
  STATUSES.forEach(function (s) { STATUS_BY[s.id] = s; });
  PRIORITIES.forEach(function (p) { PRIO_BY[p.id] = p; });
  QUADRANTS.forEach(function (q) { QUAD_BY[q.id] = q; });

  var DEFAULT_PEOPLE = [
    { name: 'Andrei', emoji: '👨' },
    { name: 'Ioana', emoji: '👩' },
    { name: 'Mihai', emoji: '🧔' },
    { name: 'Elena', emoji: '👩‍🦰' },
  ];
  var DEFAULT_CATEGORIES = [
    { name: 'Muncă/Studii', emoji: '💼' },
    { name: 'Business', emoji: '📁' },
    { name: 'Personal', emoji: '🙂' },
    { name: 'Sănătate și sport', emoji: '🏃' },
    { name: 'Treburi casnice', emoji: '🏠' },
    { name: 'Dezvoltare personală', emoji: '🌱' },
    { name: 'Finanțe', emoji: '💰' },
    { name: 'Întâlniri', emoji: '📅' },
  ];

  function defaultPlanner() {
    return { settings: { start: '09:00', interval: 60, hours: 24, format24: true, includeDaily: true }, days: {} };
  }

  /* ------------------------------------------------------------ utilitare */

  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function toMin(t) { var p = String(t || '0:0').split(':'); return (+p[0] || 0) * 60 + (+p[1] || 0); }
  function hhmm(min) { min = ((min % 1440) + 1440) % 1440; return pad2(Math.floor(min / 60)) + ':' + pad2(min % 60); }
  function clock(key, f24) {
    if (f24 !== false) return key;
    var hh = +key.slice(0, 2);
    return (hh % 12 || 12) + ':' + key.slice(3) + (hh < 12 ? ' AM' : ' PM');
  }
  function today() { return D.today(); }
  function isDone(t) { return t.status === 'finalizat'; }
  function isOverdue(t, td) { return !isDone(t) && !!t.due && t.due < (td || today()); }
  function daysLeft(t, td) { return t.due ? D.diffDays(td || today(), t.due) : null; }
  // Singurul loc care schimbă statusul. Când sarcina devine „finalizat”, ține minte statusul
  // anterior (prevStatus), ca debifarea din orice vedere să-l poată reface.
  function setStatus(t, s) {
    s = STATUS_BY[s] ? s : 'neinceput';
    if (s === 'finalizat') {
      if (t.status !== 'finalizat') t.prevStatus = t.status;
      if (!t.doneAt) t.doneAt = today();
    } else {
      delete t.prevStatus;
      t.doneAt = null;
    }
    t.status = s;
  }
  // Bifează / debifează „finalizat” (listă, kanban, matrice, calendar, planificator).
  function markDone(t, on) {
    if (on) { setStatus(t, 'finalizat'); return; }
    if (t.status !== 'finalizat') return;
    var prev = t.prevStatus;
    setStatus(t, prev && STATUS_BY[prev] && prev !== 'finalizat' ? prev : 'neinceput');
  }
  function quadOf(t) { return t.important ? (t.urgent ? 'do' : 'plan') : (t.urgent ? 'delegate' : 'drop'); }
  function weekdayLong(iso) { return D.WEEKDAYS[D.weekday(iso)].toLowerCase(); }
  function dayHeader(iso) { return weekdayLong(iso) + ', ' + D.day(iso) + ' ' + D.MONTHS_SHORT[D.month(iso)] + ' ' + D.year(iso); }
  function monthBand(y, m) { return (D.MONTHS_SHORT[m] + ' ' + y).toUpperCase(); }
  function validIso(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !!D.parse(s); }

  function sortTasks(list) {
    return list.slice().sort(function (a, b) {
      var da = isDone(a), db = isDone(b);
      if (da !== db) return da ? 1 : -1;
      if (a.due !== b.due) {
        if (!a.due) return 1;
        if (!b.due) return -1;
        return a.due < b.due ? -1 : 1;
      }
      return (a.time || '99').localeCompare(b.time || '99') || String(a.title).localeCompare(String(b.title), 'ro');
    });
  }

  function personOf(st, name) {
    for (var i = 0; i < st.people.length; i++) if (st.people[i].name === name) return st.people[i];
    return null;
  }
  function categoryOf(st, name) {
    for (var i = 0; i < st.categories.length; i++) if (st.categories[i].name === name) return st.categories[i];
    return null;
  }
  function whoText(st, name) {
    if (!name) return '—';
    var p = personOf(st, name);
    return (p && p.emoji ? p.emoji : '👤') + ' ' + name;
  }
  function catText(st, name) {
    if (!name) return '—';
    var c = categoryOf(st, name);
    return (c && c.emoji ? c.emoji : '🏷️') + ' ' + name;
  }

  function statusPill(id) {
    var s = STATUS_BY[id] || STATUS_BY.neinceput;
    return h('span', { class: 'tk-pill', 'data-tone': s.tone }, s.icon + ' ' + s.label);
  }
  function prioPill(id) {
    var p = PRIO_BY[id];
    if (!p) return null;
    return h('span', { class: 'tk-pill', 'data-tone': p.tone }, p.icon + ' ' + p.label);
  }
  function overduePill(short) {
    return h('span', { class: 'tk-pill tks-late', 'data-tone': 'bad' }, short ? '⚠' : '⚠ Întârziat');
  }

  // Textul și tonul pentru „Zile rămase”.
  function daysInfo(t, td) {
    if (isDone(t)) return { text: '✓ Finalizat', cls: 'tks-days is-done' };
    var dl = daysLeft(t, td);
    if (dl == null) return { text: '—', cls: 'tks-days' };
    if (dl < 0) return { text: 'Întârziat ' + F.days(-dl), cls: 'tks-days is-late', tone: 'bad' };
    if (dl === 0) return { text: 'Azi', cls: 'tks-days is-soon', hl: true };
    return { text: String(dl), cls: 'tks-days' + (dl <= 3 ? ' is-soon' : ''), hl: dl <= 3 };
  }
  function daysCell(t, td, compact) {
    var i = daysInfo(t, td);
    var text = i.text;
    if (compact) {
      var dl = daysLeft(t, td);
      if (isDone(t)) text = '✓';
      else if (dl != null && dl < 0) text = '⚠ ' + F.days(dl).replace('-', '−');
    }
    return h('td', { class: 'num ' + i.cls + (i.hl ? ' is-hl' : ''), 'data-tone': i.tone || null, title: compact && text !== i.text ? i.text : null },
      text, compact && text !== i.text ? h('span', { class: 'tk-sr' }, ' (' + i.text + ')') : null);
  }

  function opt(value, label, cur) {
    return h('option', { value: value, selected: String(value) === String(cur) }, label);
  }
  function selectEl(id, label, options, value, onchange, cls) {
    return h('select', { id: id, class: cls || 'tk-select', 'aria-label': label, onchange: onchange },
      options.map(function (o) { return opt(o.value, o.label, value); }));
  }
  function statusOptions() { return STATUSES.map(function (s) { return { value: s.id, label: s.icon + ' ' + s.label }; }); }
  function peopleOptions(st, allLabel) {
    return [{ value: '', label: allLabel }].concat(st.people.map(function (p) { return { value: p.name, label: (p.emoji ? p.emoji + ' ' : '') + p.name }; }));
  }

  // Re-randează păstrând focusul pe controlul cu același id.
  function keepFocus(fn) {
    var a = document.activeElement;
    var id = a && a.id;
    var selStart = null, selEnd = null;
    try { if (a && typeof a.selectionStart === 'number') { selStart = a.selectionStart; selEnd = a.selectionEnd; } } catch (e) { /* fără selecție */ }
    fn();
    if (id) {
      var n = document.getElementById(id);
      if (n && n !== document.activeElement) {
        try { n.focus({ preventScroll: true }); } catch (e) { n.focus(); }
        try { if (selStart != null && n.setSelectionRange) n.setSelectionRange(selStart, selEnd); } catch (e) { /* tip fără selecție */ }
      }
    }
  }

  function card(title, opts, body) {
    opts = opts || {};
    return h('article', { class: 'tk-card' + (opts.cls ? ' ' + opts.cls : '') },
      h('header', { class: 'tk-card__head tk-card__head--' + (opts.tone || 'plain') },
        h('h2', { class: 'tk-card__title' }, title), opts.actions || null),
      h('div', { class: 'tk-card__body' + (opts.flush ? ' tk-card__body--flush' : '') + (opts.scroll ? ' tk-scroll' : '') }, body));
  }

  function hero(title, sub, small) {
    return h('div', { class: 'tk-hero tks-hero' + (small ? ' tks-hero--sm' : '') },
      h('div', { class: 'tk-rule' }),
      h('h1', { class: 'tk-hero__title', style: 'letter-spacing:.14em;margin-right:-.14em' }, title),
      sub ? h('p', { class: 'tk-hero__sub' }, sub) : null);
  }

  function kv(pairs) {
    var out = h('div', { class: 'tk-kv' });
    pairs.forEach(function (p) {
      out.appendChild(h('label', { class: 'tk-kv__k', for: p.id || null }, p.k));
      out.appendChild(h('span', { class: 'tk-kv__v' }, p.v));
    });
    return out;
  }

  /* ------------------------------------------------------------ date demo */

  function createDemo() {
    var T = today();
    // [titlu, zile față de azi, executant, status, categorie, prioritate, important, urgent, ora, notițe]
    var rows = [
      ['Filmare Reels', -10, 'Andrei', 'finalizat', 'Muncă/Studii', 'ridicat', 1, 1],
      ['Montaj video', -2, 'Andrei', 'lucru', 'Muncă/Studii', 'ridicat', 1, 1, '', 'Varianta scurtă pentru Reels și cea lungă pentru YouTube.'],
      ['Planificarea săptămânii', -6, 'Mihai', 'finalizat', 'Personal', 'scazut', 0, 0],
      ['Completare tracker finanțe', 1, 'Andrei', 'lucru', 'Finanțe', 'mediu', 1, 1],
      ['Răspuns clienților', 1, 'Ioana', 'asteptare', 'Business', 'ridicat', 0, 1],
      ['Actualizare site', 3, 'Andrei', 'suspendat', 'Business', 'scazut', 1, 0],
      ['Scriere scenariu', -4, 'Andrei', 'finalizat', 'Muncă/Studii', 'critic', 1, 0],
      ['Antrenament', 4, 'Ioana', 'neinceput', 'Sănătate și sport', '', 1, 0, '07:30'],
      ['Lecție de engleză', 5, 'Elena', 'neinceput', 'Dezvoltare personală', 'mediu', 1, 0, '19:00'],
      ['Cumpărături', 6, 'Andrei', 'lucru', 'Treburi casnice', '', 0, 1],
      ['Apel cu echipa', 8, 'Andrei', 'asteptare', 'Întâlniri', 'mediu', 0, 1, '10:00'],
      ['Verificare reclamă', -1, 'Andrei', 'finalizat', 'Business', 'mediu', 0, 0],
      ['Citit 20 de pagini', -3, 'Mihai', 'finalizat', 'Dezvoltare personală', 'scazut', 0, 0],
      ['Rezumatul zilei', 10, 'Mihai', 'lucru', 'Personal', '', 0, 0],
      ['Programare la medic', 0, 'Elena', 'neinceput', 'Sănătate și sport', 'ridicat', 1, 1, '16:00'],
      ['Cadou pentru mama', 12, 'Ioana', 'neinceput', 'Personal', 'mediu', 1, 0],
      ['Curățenie acasă', -5, 'Mihai', 'finalizat', 'Treburi casnice', 'scazut', 0, 0],
      ['Frizer la 18:00', -8, 'Andrei', 'finalizat', 'Personal', '', 0, 1, '18:00'],
      ['Plata facturilor', -7, 'Elena', 'finalizat', 'Finanțe', 'ridicat', 1, 1],
      ['Pregătire prezentare', 18, 'Ioana', 'neinceput', 'Muncă/Studii', 'critic', 1, 0],
      ['Revizuire buget lunar', -9, 'Ioana', 'finalizat', 'Finanțe', 'mediu', 1, 0],
      ['Întâlnire cu contabilul', 25, 'Elena', 'neinceput', 'Întâlniri', 'mediu', 0, 1, '11:00'],
      ['Yoga de dimineață', -2, 'Elena', 'finalizat', 'Sănătate și sport', 'scazut', 0, 0, '07:00'],
      ['Trimitere ofertă', -1, 'Ioana', 'asteptare', 'Business', 'critic', 1, 1],
      ['Idei pentru blog', null, 'Mihai', 'neinceput', 'Dezvoltare personală', '', 0, 0],
    ];
    var tasks = rows.map(function (r, i) {
      var due = r[1] == null ? null : D.addDays(T, r[1]);
      return {
        id: 'demo' + (i + 1),
        title: r[0],
        due: due,
        assignee: r[2],
        status: r[3],
        category: r[4],
        priority: r[5],
        important: !!r[6],
        urgent: !!r[7],
        notes: r[9] || '',
        time: r[8] || '',
        createdAt: D.addDays(T, Math.min(r[1] || 0, 0) - 7),
        doneAt: r[3] === 'finalizat' ? (due && due <= T ? due : T) : null,
      };
    });
    var planner = defaultPlanner();
    planner.days[T] = {
      top3: ['Montaj video', 'Completare tracker finanțe', 'Programare la medic'],
      slots: {
        '09:00': 'Planificarea zilei',
        '10:00': 'Montaj video',
        '11:00': 'Montaj video',
        '12:00': 'Completare tracker finanțe',
        '13:00': 'Prânz',
        '14:00': 'Răspuns clienților',
        '16:00': 'Programare la medic',
        '18:00': 'Plimbare',
        '21:00': 'Rezumatul zilei',
      },
    };
    planner.days[D.addDays(T, 1)] = {
      top3: ['Completare tracker finanțe', 'Răspuns clienților', ''],
      slots: { '09:00': 'Completare tracker finanțe', '11:00': 'Răspuns clienților', '15:00': 'Actualizare site' },
    };
    return {
      tasks: tasks,
      people: TK.clone(DEFAULT_PEOPLE),
      categories: TK.clone(DEFAULT_CATEGORIES),
      boardNotes: {
        kanban: 'Mută cardurile între coloane pe măsură ce avansezi.\nVineri: verificăm ce e „În așteptare”.',
        matrix: 'Începe ziua cu „Fă acum”. Ce e în „Elimină” poate aștepta.',
      },
      planner: planner,
    };
  }

  function createEmpty() {
    return {
      tasks: [],
      people: TK.clone(DEFAULT_PEOPLE),
      categories: TK.clone(DEFAULT_CATEGORIES),
      boardNotes: { kanban: '', matrix: '' },
      planner: defaultPlanner(),
    };
  }

  function migrate(s) {
    if (!Array.isArray(s.tasks)) s.tasks = [];
    if (!Array.isArray(s.people)) s.people = TK.clone(DEFAULT_PEOPLE);
    if (!Array.isArray(s.categories)) s.categories = TK.clone(DEFAULT_CATEGORIES);
    if (!s.boardNotes || typeof s.boardNotes !== 'object') s.boardNotes = { kanban: '', matrix: '' };
    if (!s.planner || typeof s.planner !== 'object') s.planner = defaultPlanner();
    var def = defaultPlanner().settings;
    s.planner.settings = s.planner.settings || {};
    for (var k in def) if (s.planner.settings[k] == null) s.planner.settings[k] = def[k];
    if (!s.planner.days || typeof s.planner.days !== 'object') s.planner.days = {};
    s.tasks.forEach(function (t) {
      if (!t.id) t.id = TK.uid();
      t.title = String(t.title || '');
      if (!STATUS_BY[t.status]) t.status = 'neinceput';
      if (t.status !== 'finalizat' || !STATUS_BY[t.prevStatus] || t.prevStatus === 'finalizat') delete t.prevStatus;
      if (t.priority && !PRIO_BY[t.priority]) t.priority = '';
      t.important = !!t.important;
      t.urgent = !!t.urgent;
      if (!validIso(t.due)) t.due = null;
      t.assignee = t.assignee || '';
      t.category = t.category || '';
      t.notes = t.notes || '';
      t.time = t.time || '';
    });
    return s;
  }

  /* ------------------------------------------------------------ filtre salvate */

  // Preferințele de filtru care rețin un executant / o categorie.
  var PERSON_PREFS = ['fWho', 'kbWho', 'mxWho', 'calWho'];
  var CATEGORY_PREFS = ['fCat'];

  // La montare: un filtru care indică un executant / o categorie ce nu mai există revine la „Toți”.
  function sanitizePrefs(api) {
    var P = api.prefs, st = api.state;
    var people = st.people.map(function (p) { return p.name; });
    var cats = st.categories.map(function (c) { return c.name; });
    PERSON_PREFS.forEach(function (k) { var v = P.get(k, ''); if (v && people.indexOf(v) === -1) P.set(k, ''); });
    CATEGORY_PREFS.forEach(function (k) { var v = P.get(k, ''); if (v && cats.indexOf(v) === -1) P.set(k, ''); });
    var fSt = P.get('fSt', '');
    if (fSt && fSt !== 'active' && fSt !== 'intarziat' && !STATUS_BY[fSt]) P.set('fSt', '');
    ['mxHide', 'calHide'].forEach(function (k) {
      var v = P.get(k, null);
      if (v != null && !Array.isArray(v)) P.set(k, ['finalizat']);
    });
  }
  // La redenumire (nou = numele nou) sau ștergere (nou = ''): mută filtrele salvate odată cu elementul.
  function retargetPrefs(api, kind, oldName, newName) {
    (kind === 'people' ? PERSON_PREFS : CATEGORY_PREFS).forEach(function (k) {
      if (api.prefs.get(k, '') === oldName) api.prefs.set(k, newName);
    });
  }

  /* ------------------------------------------------------------ calcule */

  function stats(tasks, td) {
    td = td || today();
    var s = { total: tasks.length, done: 0, active: 0, lucru: 0, overdue: 0, d7: 0, d14: 0, d30: 0, byStatus: {}, byPrio: {}, next: null };
    STATUSES.forEach(function (x) { s.byStatus[x.id] = 0; });
    PRIORITIES.forEach(function (x) { s.byPrio[x.id] = 0; });
    s.byPrio[''] = 0;
    tasks.forEach(function (t) {
      s.byStatus[t.status] = (s.byStatus[t.status] || 0) + 1;
      if (t.status === 'lucru') s.lucru++;
      if (isDone(t)) { s.done++; return; }
      s.active++;
      s.byPrio[t.priority || ''] = (s.byPrio[t.priority || ''] || 0) + 1;
      if (isOverdue(t, td)) s.overdue++;
      var dl = daysLeft(t, td);
      if (dl != null && dl >= 0) {
        if (dl <= 7) s.d7++;
        if (dl <= 14) s.d14++;
        if (dl <= 30) s.d30++;
        if (!s.next || t.due < s.next.due) s.next = t;
      }
    });
    return s;
  }

  function upcoming(tasks, n, withOverdue, td) {
    td = td || today();
    return sortTasks(tasks.filter(function (t) {
      return !isDone(t) && t.due && (withOverdue || t.due >= td);
    })).slice(0, n);
  }

  /* ------------------------------------------------------------ formular */

  function openTaskForm(api, task, preset, after) {
    var st = api.state;
    var isNew = !task;
    var v = task || {
      title: '', due: null, assignee: '', status: 'neinceput', category: '', priority: '',
      important: false, urgent: false, notes: '', time: '',
    };
    if (isNew && preset) for (var k in preset) v[k] = preset[k];
    var people = peopleOptions(st, '— fără executant —');
    if (v.assignee && !personOf(st, v.assignee)) people.push({ value: v.assignee, label: '👤 ' + v.assignee });
    var cats = [{ value: '', label: '— fără categorie —' }].concat(st.categories.map(function (c) {
      return { value: c.name, label: (c.emoji ? c.emoji + ' ' : '') + c.name };
    }));
    if (v.category && !categoryOf(st, v.category)) cats.push({ value: v.category, label: '🏷️ ' + v.category });
    TK.ui.form({
      title: isNew ? 'Sarcină nouă' : 'Editează sarcina',
      submit: isNew ? 'Adaugă sarcina' : 'Salvează',
      onDelete: !isNew,
      deleteLabel: 'Șterge sarcina',
      fields: [
        { name: 'title', label: 'Sarcină', type: 'text', value: v.title, required: true, placeholder: 'ex. Montaj video' },
        { name: 'due', label: 'Termen', type: 'date', value: v.due || '' },
        { name: 'time', label: 'Ora (opțional)', type: 'time', value: v.time || '', hint: 'Apare în calendar și în planificator.' },
        { name: 'assignee', label: 'Executant', type: 'select', options: people, value: v.assignee || '' },
        { name: 'status', label: 'Status', type: 'select', options: statusOptions(), value: v.status },
        { name: 'category', label: 'Categorie', type: 'select', options: cats, value: v.category || '' },
        {
          name: 'priority', label: 'Prioritate', type: 'select', value: v.priority || '',
          options: [{ value: '', label: '— fără prioritate —' }].concat(PRIORITIES.map(function (p) { return { value: p.id, label: p.icon + ' ' + p.label }; })),
        },
        { name: 'important', label: 'Important (matricea Eisenhower)', type: 'checkbox', value: v.important },
        { name: 'urgent', label: 'Urgent (matricea Eisenhower)', type: 'checkbox', value: v.urgent },
        { name: 'notes', label: 'Notițe', type: 'textarea', value: v.notes || '' },
      ],
      validate: function (o) {
        if (o.title.length > 200) return 'Titlul poate avea cel mult 200 de caractere.';
        if (o.due && !validIso(o.due)) return 'Termenul nu este o dată validă.';
        if (o.time && !/^\d{2}:\d{2}$/.test(o.time)) return 'Ora trebuie scrisă ca HH:MM (ex. 09:30).';
        return null;
      },
    }).then(function (res) {
      if (!res) return;
      var s = api.state;
      if (res.__delete) {
        s.tasks = s.tasks.filter(function (t) { return t !== task; });
        api.commit();
        TK.ui.toast('Sarcina „' + task.title + '” a fost ștearsă.');
      } else {
        var t = task || { id: TK.uid(), createdAt: today(), doneAt: null };
        t.title = res.title;
        t.due = res.due || null;
        t.time = res.time || '';
        t.assignee = res.assignee || '';
        t.category = res.category || '';
        t.priority = res.priority || '';
        t.important = !!res.important;
        t.urgent = !!res.urgent;
        t.notes = res.notes || '';
        setStatus(t, res.status);
        if (isNew) s.tasks.push(t);
        api.commit();
        TK.ui.toast(isNew ? 'Sarcina a fost adăugată.' : 'Sarcina a fost salvată.');
      }
      if (after) after();
    });
  }

  // Șterge o sarcină după confirmare.
  function deleteTask(api, t, after) {
    TK.ui.confirm({
      title: 'Ștergi sarcina?',
      text: '„' + t.title + '” va fi ștearsă definitiv.',
      ok: 'Șterge sarcina',
      danger: true,
    }).then(function (yes) {
      if (!yes) return;
      api.state.tasks = api.state.tasks.filter(function (x) { return x !== t; });
      api.commit();
      TK.ui.toast('Sarcina „' + t.title + '” a fost ștearsă.');
      if (after) after();
    });
  }
  // Butoanele ✎ (editează) și 🗑 (șterge) pentru o sarcină.
  function taskActions(api, t, idp, after) {
    return h('span', { class: 'tks-actions' },
      h('button', {
        type: 'button', class: 'tk-icon-btn tks-act', id: idp + '-edit-' + t.id, title: 'Editează', 'aria-label': 'Editează „' + t.title + '”',
        onclick: function (e) { e.stopPropagation(); openTaskForm(api, t, null, after); },
      }, '✎'),
      h('button', {
        type: 'button', class: 'tk-icon-btn tks-act tks-act--del', id: idp + '-del-' + t.id, title: 'Șterge', 'aria-label': 'Șterge „' + t.title + '”',
        onclick: function (e) { e.stopPropagation(); deleteTask(api, t, after); },
      }, '🗑'));
  }

  /* ============================================================ VEDERI */

  var TABS = [
    { id: '', label: 'Listă și dashboard' },
    { id: 'kanban', label: 'Kanban' },
    { id: 'matrice', label: 'Matrice Eisenhower' },
    { id: 'calendar', label: 'Calendar' },
    { id: 'planificator', label: 'Planificator' },
    { id: 'setari', label: 'Setări' },
  ];

  /* ------------------------------------------------ 1. Listă și dashboard */

  function viewList(root, ctx) {
    var api = ctx.api, P = api.prefs;
    var f = {
      who: P.get('fWho', ''),
      st: P.get('fSt', ''),
      cat: P.get('fCat', ''),
      q: P.get('fQ', ''),
      hide: P.get('hideDone', false),
    };
    var headEl = h('div', { class: 'tk-grid tk-grid--sidebar tks-head' });
    var dashEl = h('div', { class: 'tks-dash' });
    var tbarEl = h('div', { class: 'tk-toolbar tks-toolbar' });
    var listEl = h('div', { class: 'tks-listcard' });
    root.appendChild(headEl);
    root.appendChild(dashEl);
    root.appendChild(tbarEl);
    root.appendChild(listEl);

    function kpi(label, value, extra, cls) {
      return h('div', { class: 'tk-kpi' + (cls ? ' ' + cls : '') },
        h('span', { class: 'tk-kpi__value' }, value),
        h('span', { class: 'tk-kpi__label' }, label),
        extra ? h('span', { class: 'tk-kpi__hint' }, extra) : null);
    }

    function renderHead() {
      var s = stats(api.state.tasks);
      TK.clear(headEl);
      headEl.appendChild(hero('Tracker sarcini', 'Toate sarcinile într-un singur sistem'));
      headEl.appendChild(h('div', { class: 'tk-kpis tks-kpis', role: 'group', 'aria-label': 'Indicatori sarcini' },
        kpi('Total sarcini', String(s.total), null, 'tks-kpi-total'),
        kpi('În lucru', String(s.lucru), null, 'tks-kpi-lucru'),
        kpi('Finalizate', String(s.done), F.pct(TK.ratio(s.done, s.total), 1), 'tks-kpi-done'),
        kpi('Întârziate', String(s.overdue), null, 'tks-kpi-late' + (s.overdue ? ' is-bad' : '')),
        kpi('Termen ≤ 7 zile', String(s.d7), null, 'tks-kpi-d7'),
        kpi('≤ 14 zile', String(s.d14), null, 'tks-kpi-d14'),
        kpi('≤ 30 zile', String(s.d30), null, 'tks-kpi-d30')
      ));
    }

    function renderDash() {
      var st = api.state, s = stats(st.tasks), td = today();
      TK.clear(dashEl);

      // Cele mai apropiate deadline-uri
      var up = upcoming(st.tasks, 8, true, td);
      var dl = h('table', { class: 'tk-table tk-table--dense tks-deadlines' },
        h('thead', null, h('tr', null, h('th', null, 'Sarcină'), h('th', null, 'Termen'), h('th', null, 'Executant'))),
        h('tbody', null, up.length ? up.map(function (t) {
          var late = isOverdue(t, td);
          return h('tr', { class: late ? 'is-late' : null },
            h('td', { class: 'tks-ellipsis' }, t.title),
            h('td', { class: 'tk-nowrap' + (late ? ' tks-late-text' : '') }, F.date(t.due), late ? ' ⚠' : ''),
            h('td', { class: 'tk-nowrap' }, whoText(st, t.assignee)));
        }) : h('tr', null, h('td', { colspan: 3, class: 'tk-muted tk-center' }, 'Niciun termen activ.'))));
      var w1 = h('section', { class: 'tk-card tks-widget tks-widget--deadlines' },
        h('div', { class: 'tk-card__body' }, h('h2', { class: 'tk-chart__title' }, 'Cele mai apropiate deadline-uri'),
          h('div', { class: 'tk-scroll' }, dl)));

      // Progres
      var donutEl = h('div', { class: 'tks-donut', id: 'tks-chart-progress' });
      var w2 = h('section', { class: 'tk-card tks-widget' },
        h('div', { class: 'tk-card__body' }, h('h2', { class: 'tk-chart__title' }, 'Progres'), donutEl));

      // Statusuri
      var pieEl = h('div', { id: 'tks-chart-status' });
      var w3 = h('section', { class: 'tk-card tks-widget' },
        h('div', { class: 'tk-card__body' }, h('h2', { class: 'tk-chart__title' }, 'Statusuri'), pieEl));

      // Priorități (sarcini active)
      var barsEl = h('div', { id: 'tks-chart-prio' });
      var w4 = h('section', { class: 'tk-card tks-widget' },
        h('div', { class: 'tk-card__body' }, h('h2', { class: 'tk-chart__title' }, 'Priorități · active'), barsEl));

      // Încărcare pe executanți (sarcini active)
      var loadEl = h('div', { id: 'tks-chart-load' });
      var w5 = h('section', { class: 'tk-card tks-widget' },
        h('div', { class: 'tk-card__body' }, h('h2', { class: 'tk-chart__title' }, 'Încărcare · sarcini active'), loadEl));

      dashEl.appendChild(h('div', { class: 'tks-dash__row tks-dash__row--a' }, w1, w2, w3));
      dashEl.appendChild(h('div', { class: 'tks-dash__row tks-dash__row--b' }, w4, w5));

      TK.charts.donut(donutEl, {
        value: s.done, max: s.total, top: 'Finalizate', sub: s.done + ' / ' + s.total, size: 150,
        main: F.pct(TK.ratio(s.done, s.total), 1),
      });
      TK.charts.pie(pieEl, {
        data: STATUSES.map(function (x) { return { label: x.icon + ' ' + x.label, value: s.byStatus[x.id] || 0, color: x.color }; }),
        hole: 0.6, size: 150, legend: true, center: String(s.total),
        format: function (v) { return v + (v === 1 ? ' sarcină' : ' sarcini'); },
        label: 'Sarcini pe statusuri',
      });
      var prioLabels = PRIORITIES.map(function (p) { return p.icon + ' ' + p.label; });
      var prioVals = PRIORITIES.map(function (p) { return s.byPrio[p.id] || 0; });
      if (s.byPrio['']) { prioLabels.push('Fără'); prioVals.push(s.byPrio['']); }
      TK.charts.bars(barsEl, {
        labels: prioLabels,
        series: [{ name: 'Sarcini active', values: prioVals }],
        height: 170, axis: false, valueLabels: true, legend: false,
        format: function (v) { return String(v); },
        colorFn: function (v, i) { return PRIORITIES[i] ? PRIORITIES[i].color : 'var(--line-strong)'; },
        label: 'Sarcini active pe priorități',
      });
      var names = st.people.map(function (p) { return p.name; });
      var extra = {};
      st.tasks.forEach(function (t) { if (!isDone(t) && t.assignee && names.indexOf(t.assignee) === -1) extra[t.assignee] = 1; });
      names = names.concat(Object.keys(extra));
      var labels = names.map(function (n) { return whoText(st, n); });
      var vals = names.map(function (n) { return st.tasks.filter(function (t) { return !isDone(t) && t.assignee === n; }).length; });
      var unassigned = st.tasks.filter(function (t) { return !isDone(t) && !t.assignee; }).length;
      if (unassigned) { labels.push('Fără executant'); vals.push(unassigned); }
      TK.charts.hbars(loadEl, {
        labels: labels,
        series: [{ name: 'Sarcini active', values: vals, color: 'var(--terra)' }],
        format: function (v) { return String(v); },
        xFormat: function (v) { return Math.abs(v - Math.round(v)) < 1e-9 ? F.num(v, 0) : ''; },
        legend: false, barHeight: 14, rowHeight: 30, labelWidth: 120,
        label: 'Sarcini active pe executanți',
      });
    }

    function renderToolbar() {
      var st = api.state;
      TK.clear(tbarEl);
      function field(id, label, ctl) { return h('div', { class: 'tk-field' }, h('label', { class: 'tk-label', for: id }, label), ctl); }
      var catOpts = [{ value: '', label: 'Toate' }].concat(st.categories.map(function (c) { return { value: c.name, label: (c.emoji ? c.emoji + ' ' : '') + c.name }; }));
      var stOpts = [{ value: '', label: 'Toate' }, { value: 'active', label: 'Active (nefinalizate)' }, { value: 'intarziat', label: '⚠ Întârziate' }].concat(statusOptions());
      tbarEl.appendChild(field('tks-f-who', 'Executant', selectEl('tks-f-who', 'Filtru executant', peopleOptions(st, 'Toți'), f.who, function (e) { f.who = e.target.value; P.set('fWho', f.who); renderTable(); })));
      tbarEl.appendChild(field('tks-f-st', 'Status', selectEl('tks-f-st', 'Filtru status', stOpts, f.st, function (e) { f.st = e.target.value; P.set('fSt', f.st); renderTable(); })));
      tbarEl.appendChild(field('tks-f-cat', 'Categorie', selectEl('tks-f-cat', 'Filtru categorie', catOpts, f.cat, function (e) { f.cat = e.target.value; P.set('fCat', f.cat); renderTable(); })));
      tbarEl.appendChild(field('tks-f-q', 'Căutare', h('input', {
        id: 'tks-f-q', class: 'tk-input', type: 'search', value: f.q, placeholder: 'ex. site', autocomplete: 'off',
        oninput: function (e) { f.q = e.target.value; P.set('fQ', f.q); renderTable(); },
      })));
      tbarEl.appendChild(h('label', { class: 'tk-check-label tks-hide-done', for: 'tks-f-hide' },
        h('input', { id: 'tks-f-hide', class: 'tk-toggle', type: 'checkbox', checked: f.hide, onchange: function (e) { f.hide = e.target.checked; P.set('hideDone', f.hide); renderTable(); } }),
        h('span', null, 'Ascunde finalizate')));
      tbarEl.appendChild(h('span', { class: 'tk-spacer' }));
      tbarEl.appendChild(h('button', {
        type: 'button', class: 'tk-btn tk-btn--sm tk-btn--ghost', id: 'tks-f-reset',
        onclick: function () {
          f.who = ''; f.st = ''; f.cat = ''; f.q = ''; f.hide = false;
          P.set('fWho', ''); P.set('fSt', ''); P.set('fCat', ''); P.set('fQ', ''); P.set('hideDone', false);
          renderToolbar(); renderTable();
        },
      }, 'Resetează filtrele'));
    }

    function filtered() {
      var td = today(), q = f.q.trim().toLowerCase();
      return sortTasks(api.state.tasks.filter(function (t) {
        if (f.hide && isDone(t)) return false;
        if (f.who && t.assignee !== f.who) return false;
        if (f.cat && t.category !== f.cat) return false;
        if (f.st === 'active' && isDone(t)) return false;
        else if (f.st === 'intarziat' && !isOverdue(t, td)) return false;
        else if (f.st && f.st !== 'active' && f.st !== 'intarziat' && t.status !== f.st) return false;
        if (q && (t.title + ' ' + (t.notes || '')).toLowerCase().indexOf(q) === -1) return false;
        return true;
      }));
    }

    function onChanged() {
      api.commit();
      keepFocus(function () { renderHead(); renderDash(); renderTable(); });
    }

    function row(t, td) {
      var st = api.state, done = isDone(t), late = isOverdue(t, td), s = STATUS_BY[t.status];
      return h('tr', { class: done ? 'is-done' : (late ? 'is-late' : null), dataset: { id: t.id } },
        h('td', { class: 'tks-titlecell' },
          h('button', { type: 'button', class: 'tks-link', id: 'tks-edit-' + t.id, title: 'Editează sarcina', onclick: function () { openTaskForm(api, t, null, onChanged); } }, t.title),
          late ? overduePill(true) : null),
        h('td', { class: 'tk-nowrap' + (late ? ' tks-late-text' : '') }, t.due ? F.date(t.due) : '—', t.time ? h('span', { class: 'tk-muted' }, ' · ' + t.time) : null),
        h('td', { class: 'tk-nowrap' }, whoText(st, t.assignee)),
        h('td', { class: 'tks-statuscell' }, selectEl('tks-st-' + t.id, 'Status: ' + t.title, statusOptions(), t.status, function (e) {
          setStatus(t, e.target.value);
          onChanged();
          TK.ui.toast('Status: ' + STATUS_BY[t.status].label + '.');
        }, 'tk-cell-input tks-status')),
        h('td', { class: 'tk-nowrap' }, catText(st, t.category)),
        h('td', null, prioPill(t.priority)),
        h('td', { class: 'chk' }, h('input', {
          type: 'checkbox', class: 'tk-check', id: 'tks-imp-' + t.id, checked: t.important, 'aria-label': 'Important: ' + t.title,
          onchange: function (e) { t.important = e.target.checked; api.commit(); },
        })),
        h('td', { class: 'chk' }, h('input', {
          type: 'checkbox', class: 'tk-check', id: 'tks-urg-' + t.id, checked: t.urgent, 'aria-label': 'Urgent: ' + t.title,
          onchange: function (e) { t.urgent = e.target.checked; api.commit(); },
        })),
        daysCell(t, td),
        h('td', { class: 'chk tks-actcell' }, taskActions(api, t, 'tks-l', onChanged))
      );
    }

    function renderTable() {
      var td = today(), list = filtered(), total = api.state.tasks.length;
      var tbody = h('tbody');
      list.forEach(function (t) {
        var tr = row(t, td);
        var sel = tr.querySelector('.tks-status');
        if (sel) sel.setAttribute('data-tone', STATUS_BY[t.status].tone);
        tbody.appendChild(tr);
      });
      if (!list.length) {
        tbody.appendChild(h('tr', null, h('td', { colspan: 10, class: 'tk-center tk-muted tks-norows' },
          total ? 'Nicio sarcină nu corespunde filtrelor.' : 'Nu ai încă nicio sarcină. Apasă „+ Sarcină nouă”.')));
      }
      for (var i = 0; i < 3; i++) {
        var er = h('tr', { class: 'is-empty tk-hide-sm', 'aria-hidden': 'true' });
        for (var j = 0; j < 10; j++) er.appendChild(h('td', null, ''));
        tbody.appendChild(er);
      }
      var table = h('table', { class: 'tk-table tks-list', id: 'tks-list' },
        h('thead', null,
          h('tr', { class: 'tks-list__group' },
            h('th', { colspan: 6, class: 'tks-list__blank' }, ''),
            h('th', { colspan: 2 }, 'Matrice Eisenhower'),
            h('th', { colspan: 2, class: 'tks-list__blank' }, '')),
          h('tr', null,
            h('th', null, 'Sarcină'), h('th', null, 'Termen'), h('th', null, 'Executant'), h('th', null, 'Status'),
            h('th', null, 'Categorie'), h('th', null, 'Prioritate'), h('th', { class: 'chk' }, 'Important?'),
            h('th', { class: 'chk' }, 'Urgent?'), h('th', { class: 'num' }, 'Zile rămase'), h('th', { class: 'chk' }, h('span', { class: 'tk-sr' }, 'Acțiuni')))),
        tbody);
      keepFocus(function () {
        TK.clear(listEl);
        listEl.appendChild(h('article', { class: 'tk-card' },
          h('header', { class: 'tk-card__head tk-card__head--plain' },
            h('h2', { class: 'tk-card__title' }, 'Listă generală'),
            h('span', { class: 'tk-muted tks-count', id: 'tks-list-count' }, list.length === total ? total + ' sarcini' : list.length + ' din ' + total + ' sarcini')),
          h('div', { class: 'tk-card__body tk-card__body--flush tk-scroll tks-listscroll' }, table)));
      });
    }

    renderHead();
    renderDash();
    renderToolbar();
    renderTable();
    ctx.refresh = function () { keepFocus(function () { renderHead(); renderDash(); renderToolbar(); renderTable(); }); };
  }

  /* ------------------------------------------------ panouri comune */

  function notesCard(api, key, id) {
    var save = TK.debounce(function () { api.commit(); }, 400);
    var ta = h('textarea', {
      id: id, class: 'tk-textarea tks-notes', rows: 8, 'aria-label': 'Notițe', placeholder: 'Scrie aici…',
      oninput: function (e) { api.state.boardNotes[key] = e.target.value; save(); },
      onblur: function () { save.flush(); },
    }, api.state.boardNotes[key] || '');
    return { el: card('Notițe', { cls: 'tks-notes-card' }, ta), flush: function () { save.flush(); } };
  }

  /* ------------------------------------------------ 2. Kanban */

  function viewKanban(root, ctx) {
    var api = ctx.api, P = api.prefs;
    var f = { from: P.get('kbFrom', ''), to: P.get('kbTo', ''), who: P.get('kbWho', '') };
    var board = h('div', { class: 'tk-kanban tks-board', id: 'tks-board', 'aria-label': 'Tablă kanban' });
    var notes = notesCard(api, 'kanban', 'tks-kb-notes');
    ctx.flushers.push(notes.flush);

    function setF(k, v) { f[k] = v; P.set({ from: 'kbFrom', to: 'kbTo', who: 'kbWho' }[k], v); renderBoard(); }
    var filterCard = card('Filtru', null, h('div', { class: 'tk-stack tks-gap-sm' },
      kv([
        { k: 'Termen de la', id: 'tks-kb-from', v: h('input', { id: 'tks-kb-from', class: 'tk-cell-input', type: 'date', value: f.from, onchange: function (e) { setF('from', e.target.value); } }) },
        { k: 'până la', id: 'tks-kb-to', v: h('input', { id: 'tks-kb-to', class: 'tk-cell-input', type: 'date', value: f.to, onchange: function (e) { setF('to', e.target.value); } }) },
        { k: 'Executant', id: 'tks-kb-who', v: selectEl('tks-kb-who', 'Executant', peopleOptions(api.state, 'Toți'), f.who, function (e) { setF('who', e.target.value); }, 'tk-cell-input') },
      ]),
      h('button', {
        type: 'button', class: 'tk-btn tk-btn--sm tk-btn--ghost', id: 'tks-kb-reset',
        onclick: function () {
          f = { from: '', to: '', who: '' };
          P.set('kbFrom', ''); P.set('kbTo', ''); P.set('kbWho', '');
          root.querySelector('#tks-kb-from').value = '';
          root.querySelector('#tks-kb-to').value = '';
          root.querySelector('#tks-kb-who').value = '';
          renderBoard();
        },
      }, 'Resetează filtrul')));

    root.appendChild(h('div', { class: 'tks-side' },
      hero('Kanban', 'Tabla sarcinilor', true),
      h('aside', { class: 'tk-stack tks-side__panel' },
        filterCard,
        h('p', { class: 'tk-note tks-small-note' }, h('b', null, 'Important: '), 'tabla arată sarcinile din lista generală. Trage un card în altă coloană (sau folosește ◀ ▶) ca să-i schimbi statusul. Apasă pe titlu ca să-l editezi.'),
        notes.el),
      h('div', { class: 'tks-side__main' }, board)));

    function matches(t) {
      if (f.who && t.assignee !== f.who) return false;
      if (f.from && (!t.due || t.due < f.from)) return false;
      if (f.to && (!t.due || t.due > f.to)) return false;
      return true;
    }

    function move(t, status) {
      if (t.status === status) return;
      setStatus(t, status);
      api.commit();
      keepFocus(renderBoard);
      TK.ui.toast('„' + t.title + '” → ' + STATUS_BY[status].label + '.');
    }

    function cardEl(t, idx, td) {
      var st = api.state, prio = PRIO_BY[t.priority], late = isOverdue(t, td);
      var i = STATUSES.indexOf(STATUS_BY[t.status]);
      var prev = STATUSES[i - 1], next = STATUSES[i + 1];
      var c = h('div', {
        class: 'tk-kanban__card' + (isDone(t) ? ' is-done' : '') + (late ? ' is-late' : ''),
        draggable: 'true', dataset: { id: t.id }, role: 'listitem',
        style: { '--card-accent': prio ? prio.color : STATUS_BY[t.status].color },
      },
        h('button', { type: 'button', class: 'tks-link tks-card__title', id: 'tks-kb-edit-' + t.id, onclick: function () { openTaskForm(api, t, null, ctx.refresh); } }, t.title),
        h('div', { class: 'tk-kanban__meta' },
          h('span', { class: late ? 'tks-late-text' : null }, '📅 ' + (t.due ? F.dateShort(t.due) : 'fără termen')),
          t.assignee ? h('span', null, whoText(st, t.assignee)) : null,
          prioPill(t.priority),
          late ? overduePill() : null),
        h('div', { class: 'tks-card__move' },
          h('button', {
            type: 'button', class: 'tk-icon-btn tks-mini', id: 'tks-kb-prev-' + t.id, disabled: !prev,
            'aria-label': prev ? 'Mută „' + t.title + '” în ' + prev.label : 'Prima coloană',
            onclick: function () { if (prev) move(t, prev.id); },
          }, '◀'),
          h('span', { class: 'tks-card__status' }, STATUS_BY[t.status].icon + ' ' + STATUS_BY[t.status].label),
          h('button', {
            type: 'button', class: 'tk-icon-btn tks-mini', id: 'tks-kb-next-' + t.id, disabled: !next,
            'aria-label': next ? 'Mută „' + t.title + '” în ' + next.label : 'Ultima coloană',
            onclick: function () { if (next) move(t, next.id); },
          }, '▶'),
          taskActions(api, t, 'tks-kb', function () { ctx.refresh(); }))
      );
      c.addEventListener('dragstart', function (e) {
        try { e.dataTransfer.setData('text/plain', t.id); e.dataTransfer.effectAllowed = 'move'; } catch (x) { /* ignorăm */ }
        c.classList.add('is-dragging');
      });
      c.addEventListener('dragend', function () { c.classList.remove('is-dragging'); });
      return c;
    }

    function renderBoard() {
      var st = api.state, td = today();
      var list = sortTasks(st.tasks.filter(matches));
      TK.clear(board);
      STATUSES.forEach(function (s) {
        var items = list.filter(function (t) { return t.status === s.id; });
        var col = h('section', { class: 'tk-kanban__col', dataset: { status: s.id }, 'aria-label': s.label },
          h('div', { class: 'tk-kanban__head' },
            h('span', { class: 'tk-pill', 'data-tone': s.tone }, s.icon + ' ' + s.label),
            h('span', { class: 'tks-colcount' }, String(items.length))),
          h('div', { class: 'tks-col__list', role: 'list' }, items.map(function (t, i) { return cardEl(t, i, td); })),
          items.length ? null : h('p', { class: 'tks-col__empty tk-muted' }, 'Trage aici o sarcină'),
          h('button', {
            type: 'button', class: 'tk-btn tk-btn--sm tk-btn--ghost tks-col__add', id: 'tks-kb-add-' + s.id,
            onclick: function () { openTaskForm(api, null, { status: s.id, assignee: f.who || '' }, ctx.refresh); },
          }, '+ Adaugă'));
        col.addEventListener('dragover', function (e) { e.preventDefault(); try { e.dataTransfer.dropEffect = 'move'; } catch (x) { /* */ } col.classList.add('is-over'); });
        col.addEventListener('dragleave', function (e) { if (!col.contains(e.relatedTarget)) col.classList.remove('is-over'); });
        col.addEventListener('drop', function (e) {
          e.preventDefault();
          col.classList.remove('is-over');
          var id = '';
          try { id = e.dataTransfer.getData('text/plain'); } catch (x) { /* */ }
          var t = api.state.tasks.filter(function (x) { return x.id === id; })[0];
          if (t) move(t, s.id);
        });
        board.appendChild(col);
      });
    }

    renderBoard();
    ctx.refresh = function () { keepFocus(renderBoard); };
  }

  /* ------------------------------------------------ 3. Matrice Eisenhower */

  function viewMatrix(root, ctx) {
    var api = ctx.api, P = api.prefs;
    var who = P.get('mxWho', '');
    var hide = P.get('mxHide', ['finalizat']);
    var notes = notesCard(api, 'matrix', 'tks-mx-notes');
    ctx.flushers.push(notes.flush);
    var grid = h('div', { class: 'tk-matrix tks-matrix', id: 'tks-matrix' });

    var hideList = h('div', { class: 'tks-checklist' }, STATUSES.map(function (s) {
      return h('label', { class: 'tk-check-label', for: 'tks-mx-hide-' + s.id },
        h('input', {
          type: 'checkbox', class: 'tk-check', id: 'tks-mx-hide-' + s.id, checked: hide.indexOf(s.id) !== -1,
          onchange: function (e) {
            hide = hide.filter(function (x) { return x !== s.id; });
            if (e.target.checked) hide.push(s.id);
            P.set('mxHide', hide);
            renderGrid();
          },
        }),
        h('span', null, s.icon + ' ' + s.label));
    }));

    root.appendChild(h('div', { class: 'tks-side' },
      hero('Matrice Eisenhower', 'Important vs urgent', true),
      h('aside', { class: 'tk-stack tks-side__panel' },
        card('Filtru', null, h('div', { class: 'tk-stack tks-gap-sm' },
          kv([{ k: 'Executant', id: 'tks-mx-who', v: selectEl('tks-mx-who', 'Executant', peopleOptions(api.state, 'Toți'), who, function (e) { who = e.target.value; P.set('mxWho', who); renderGrid(); }, 'tk-cell-input') }]),
          h('p', { class: 'tk-label' }, 'Ascunde statusuri'),
          hideList)),
        h('p', { class: 'tk-note tks-small-note' }, h('b', null, 'Important: '), 'cadranul vine din coloanele „Important?” și „Urgent?” ale listei. Mută o sarcină trăgând-o în alt cadran sau alegând cadranul din rândul ei.'),
        notes.el),
      h('div', { class: 'tks-side__main' }, grid)));

    function moveTo(t, qid) {
      var q = QUAD_BY[qid];
      if (!q || quadOf(t) === qid) return;
      t.important = q.imp;
      t.urgent = q.urg;
      api.commit();
      keepFocus(renderGrid);
      TK.ui.toast('„' + t.title + '” → ' + q.title + '.');
    }

    function renderGrid() {
      var st = api.state, td = today();
      TK.clear(grid);
      QUADRANTS.forEach(function (q) {
        var all = st.tasks.filter(function (t) { return quadOf(t) === q.id && (!who || t.assignee === who); });
        var done = all.filter(isDone).length;
        var shown = sortTasks(all.filter(function (t) { return hide.indexOf(t.status) === -1; }));
        var donutEl = h('div', { class: 'tks-mx-donut', id: 'tks-mx-donut-' + q.id });
        var tbody = h('tbody', null, shown.map(function (t, i) {
          var tr = h('tr', { class: isDone(t) ? 'is-done' : null, draggable: 'true', dataset: { id: t.id } },
            h('td', { class: 'chk' }, h('input', {
              type: 'checkbox', class: 'tk-check', id: 'tks-mx-done-' + t.id, checked: isDone(t), 'aria-label': 'Finalizat: ' + t.title,
              onchange: function (e) {
                markDone(t, e.target.checked);
                api.commit();
                keepFocus(renderGrid);
              },
            })),
            h('td', { class: 'tks-titlecell' }, h('button', { type: 'button', class: 'tks-link', id: 'tks-mx-edit-' + t.id, onclick: function () { openTaskForm(api, t, null, ctx.refresh); } }, t.title)),
            h('td', { class: 'tk-nowrap' }, whoText(st, t.assignee)),
            daysCell(t, td, true),
            h('td', { class: 'tks-qcell' }, selectEl('tks-mx-q-' + t.id, 'Cadran pentru ' + t.title,
              QUADRANTS.map(function (x) { return { value: x.id, label: x.title }; }), q.id,
              function (e) { moveTo(t, e.target.value); }, 'tk-cell-input')));
          tr.addEventListener('dragstart', function (e) {
            try { e.dataTransfer.setData('text/plain', t.id); e.dataTransfer.effectAllowed = 'move'; } catch (x) { /* */ }
            tr.classList.add('is-dragging');
          });
          tr.addEventListener('dragend', function () { tr.classList.remove('is-dragging'); });
          return tr;
        }));
        if (!shown.length) tbody.appendChild(h('tr', null, h('td', { colspan: 5, class: 'tk-muted tk-center' }, all.length ? 'Toate sarcinile de aici sunt ascunse.' : 'Nicio sarcină aici.')));
        for (var i = 0; i < Math.max(0, 4 - shown.length); i++) {
          tbody.appendChild(h('tr', { class: 'is-empty tk-hide-sm', 'aria-hidden': 'true' }, h('td'), h('td'), h('td'), h('td'), h('td')));
        }
        var sec = h('section', { class: 'tk-matrix__q tk-matrix__q--' + q.id, dataset: { q: q.id }, 'aria-label': q.title + ': ' + q.sub },
          h('h3', { class: 'tk-matrix__title' }, q.title),
          h('p', { class: 'tk-matrix__sub' }, q.sub),
          h('div', { class: 'tks-mx-top' }, donutEl,
            h('p', { class: 'tks-mx-stat' }, h('b', null, String(all.length - done)), ' de făcut', h('br'), h('span', { class: 'tk-muted' }, done + ' finalizate din ' + all.length))),
          h('div', { class: 'tk-scroll' }, h('table', { class: 'tk-table tk-table--dense tk-table--wrap tks-mx-table' },
            h('thead', null, h('tr', null, h('th', { class: 'chk' }, h('span', { class: 'tk-sr' }, 'Finalizat')), h('th', null, 'Sarcină'), h('th', null, 'Executant'), h('th', { class: 'num' }, 'Zile rămase'), h('th', null, 'Cadran'))),
            tbody)));
        sec.addEventListener('dragover', function (e) { e.preventDefault(); sec.classList.add('is-over'); });
        sec.addEventListener('dragleave', function (e) { if (!sec.contains(e.relatedTarget)) sec.classList.remove('is-over'); });
        sec.addEventListener('drop', function (e) {
          e.preventDefault();
          sec.classList.remove('is-over');
          var id = '';
          try { id = e.dataTransfer.getData('text/plain'); } catch (x) { /* */ }
          var t = api.state.tasks.filter(function (x) { return x.id === id; })[0];
          if (t) moveTo(t, q.id);
        });
        grid.appendChild(sec);
        TK.charts.donut(donutEl, {
          value: done, max: all.length, top: q.title, size: 104, thickness: 11, color: q.color,
          main: F.pct(TK.ratio(done, all.length), 1), label: q.title + ': ' + done + ' din ' + all.length + ' finalizate',
        });
      });
    }

    renderGrid();
    ctx.refresh = function () { keepFocus(renderGrid); };
  }

  /* ------------------------------------------------ 4. Calendar */

  function viewCalendar(root, ctx) {
    var api = ctx.api, P = api.prefs, T = today();
    var y = P.get('calY', D.year(T)), m = P.get('calM', D.month(T));
    var who = P.get('calWho', '');
    var hide = P.get('calHide', ['finalizat']);
    var side = h('aside', { class: 'tk-stack tks-side__panel' });
    var main = h('div', { class: 'tks-side__main tk-stack' });
    root.appendChild(h('div', { class: 'tks-side' }, hero('Calendar', 'Calendar inteligent', true), side, main));

    function setMonth(ny, nm) {
      if (nm < 0) { nm = 11; ny--; }
      if (nm > 11) { nm = 0; ny++; }
      y = ny; m = nm;
      P.set('calY', y); P.set('calM', m);
      keepFocus(function () { renderSide(); renderMain(); });
    }
    function visible(t) {
      return t.due && (!who || t.assignee === who) && hide.indexOf(t.status) === -1;
    }
    function toggle(t, on) {
      markDone(t, on);
      api.commit();
      keepFocus(function () { renderSide(); renderMain(); });
    }

    function renderSide() {
      var st = api.state;
      TK.clear(side);
      var years = [];
      for (var yy = D.year(T) - 3; yy <= D.year(T) + 3; yy++) years.push({ value: yy, label: String(yy) });
      if (y < D.year(T) - 3 || y > D.year(T) + 3) years.push({ value: y, label: String(y) });
      side.appendChild(card('Setări calendar', null, h('div', { class: 'tk-stack tks-gap-sm' },
        kv([
          { k: 'Luna', id: 'tks-cal-m', v: selectEl('tks-cal-m', 'Luna', D.MONTHS.map(function (n, i) { return { value: i, label: n }; }), m, function (e) { setMonth(y, +e.target.value); }, 'tk-cell-input') },
          { k: 'Anul', id: 'tks-cal-y', v: selectEl('tks-cal-y', 'Anul', years, y, function (e) { setMonth(+e.target.value, m); }, 'tk-cell-input') },
          { k: 'Executant', id: 'tks-cal-who', v: selectEl('tks-cal-who', 'Executant', peopleOptions(st, 'Toți'), who, function (e) { who = e.target.value; P.set('calWho', who); keepFocus(function () { renderSide(); renderMain(); }); }, 'tk-cell-input') },
        ]),
        h('button', { type: 'button', class: 'tk-btn tk-btn--sm tk-btn--ghost', id: 'tks-cal-today', onclick: function () { setMonth(D.year(T), D.month(T)); } }, 'Mergi la luna curentă'))));

      side.appendChild(card('Ascunde din calendar', { tone: 'sage' }, h('div', { class: 'tks-checklist' }, STATUSES.map(function (s) {
        return h('label', { class: 'tk-check-label', for: 'tks-cal-hide-' + s.id },
          h('input', {
            type: 'checkbox', class: 'tk-check', id: 'tks-cal-hide-' + s.id, checked: hide.indexOf(s.id) !== -1,
            onchange: function (e) {
              hide = hide.filter(function (x) { return x !== s.id; });
              if (e.target.checked) hide.push(s.id);
              P.set('calHide', hide);
              keepFocus(renderMain);
            },
          }),
          h('span', null, s.icon + ' ' + s.label));
      }))));

      // Adaugă sarcini
      var isCur = y === D.year(T) && m === D.month(T);
      var titleIn = h('input', { id: 'tks-cal-new-title', class: 'tk-input', type: 'text', placeholder: 'Denumirea sarcinii', 'aria-label': 'Denumirea sarcinii noi', autocomplete: 'off' });
      var dateIn = h('input', { id: 'tks-cal-new-date', class: 'tk-input', type: 'date', value: isCur ? T : D.make(y, m, 1), 'aria-label': 'Termenul sarcinii noi' });
      function quickAdd(e) {
        if (e) e.preventDefault();
        var title = titleIn.value.trim();
        if (!title) { titleIn.focus(); TK.ui.toast('Scrie denumirea sarcinii.'); return; }
        var due = validIso(dateIn.value) ? dateIn.value : null;
        var t = { id: TK.uid(), title: title, due: due, assignee: who || '', status: 'neinceput', category: '', priority: '', important: false, urgent: false, notes: '', time: '', createdAt: T, doneAt: null };
        api.state.tasks.push(t);
        api.commit();
        TK.ui.toast('Sarcina a fost adăugată' + (due ? ' pe ' + F.date(due) : '') + '.');
        if (due && (D.year(due) !== y || D.month(due) !== m)) { setMonth(D.year(due), D.month(due)); }
        else keepFocus(function () { renderSide(); renderMain(); });
        var ti = document.getElementById('tks-cal-new-title');
        if (ti) ti.focus();
      }
      var monthTasks = sortTasks(st.tasks.filter(function (t) { return t.due && D.year(t.due) === y && D.month(t.due) === m && (!who || t.assignee === who); }));
      var list = h('table', { class: 'tk-table tk-table--dense tks-cal-list' },
        h('thead', null, h('tr', null, h('th', { class: 'chk' }, h('span', { class: 'tk-sr' }, 'Finalizat')), h('th', null, 'Denumire'), h('th', null, 'Termen'))),
        h('tbody', null, monthTasks.length ? monthTasks.map(function (t) {
          return h('tr', { class: isDone(t) ? 'is-done' : null },
            h('td', { class: 'chk' }, h('input', { type: 'checkbox', class: 'tk-check', id: 'tks-cal-lchk-' + t.id, checked: isDone(t), 'aria-label': 'Finalizat: ' + t.title, onchange: function (e) { toggle(t, e.target.checked); } })),
            h('td', { class: 'tks-ellipsis' }, t.title),
            h('td', { class: 'tk-nowrap' }, F.dateShort(t.due)));
        }) : h('tr', null, h('td', { colspan: 3, class: 'tk-muted tk-center' }, 'Nicio sarcină în această lună.'))));
      side.appendChild(card('Adaugă sarcini', { tone: 'sage' }, h('div', { class: 'tk-stack tks-gap-sm' },
        h('form', { class: 'tks-quickadd', onsubmit: quickAdd },
          titleIn, dateIn,
          h('button', { type: 'submit', class: 'tk-btn tk-btn--sm', id: 'tks-cal-add' }, 'Adaugă')),
        h('div', { class: 'tk-scroll tks-cal-listwrap' }, list))));
    }

    function itemEl(t, iso) {
      var label = (t.time ? t.time + ' ' : '') + t.title;
      return h('div', { class: 'tk-cal__item' + (isDone(t) ? ' is-done' : '') + (isOverdue(t, T) ? ' is-late' : '') },
        h('input', { type: 'checkbox', class: 'tk-check', id: 'tks-cal-chk-' + t.id, checked: isDone(t), 'aria-label': 'Finalizat: ' + t.title, onchange: function (e) { toggle(t, e.target.checked); } }),
        h('button', { type: 'button', class: 'tks-link tks-cal__txt', id: 'tks-cal-edit-' + t.id, title: label, onclick: function (e) { e.stopPropagation(); openTaskForm(api, t, null, ctx.refresh); } }, label));
    }

    function renderMain() {
      var st = api.state;
      TK.clear(main);
      var byDay = TK.groupBy(sortTasks(st.tasks.filter(visible)), function (t) { return t.due; });
      var cal = h('div', { class: 'tk-cal tks-cal', id: 'tks-cal' });
      cal.appendChild(h('div', { class: 'tk-cal__head' }, D.WEEKDAYS.map(function (w, i) {
        return h('span', null, h('span', { class: 'tks-wd-long' }, w), h('span', { class: 'tks-wd-short', 'aria-hidden': 'true' }, D.WEEKDAYS_SHORT[i]));
      })));
      D.calendarGrid(y, m).forEach(function (week) {
        week.forEach(function (d) {
          var items = byDay[d.iso] || [];
          var day = h('div', {
            class: 'tk-cal__day' + (d.inMonth ? '' : ' is-out') + (d.iso === T ? ' is-today' : ''),
            dataset: { iso: d.iso }, title: 'Apasă pe spațiul liber ca să adaugi o sarcină pe ' + F.date(d.iso),
          },
            h('span', { class: 'tk-cal__num' }, d.iso === T ? h('span', { class: 'tks-today-tag' }, 'azi ') : null, String(d.day)),
            items.map(function (t) { return itemEl(t, d.iso); }));
          day.addEventListener('click', function (e) {
            if (e.target === day || (e.target.classList && e.target.classList.contains('tk-cal__num'))) {
              openTaskForm(api, null, { due: d.iso, assignee: who || '' }, ctx.refresh);
            }
          });
          cal.appendChild(day);
        });
      });
      var calCard = h('article', { class: 'tk-card tks-cal-card' },
        h('header', { class: 'tk-card__head' },
          h('button', { type: 'button', class: 'tk-icon-btn', id: 'tks-cal-prev', 'aria-label': 'Luna anterioară', onclick: function () { setMonth(y, m - 1); } }, '‹'),
          h('h2', { class: 'tk-card__title', id: 'tks-cal-title' }, h('b', null, monthBand(y, m))),
          h('button', { type: 'button', class: 'tk-icon-btn', id: 'tks-cal-next', 'aria-label': 'Luna următoare', onclick: function () { setMonth(y, m + 1); } }, '›')),
        h('div', { class: 'tk-card__body tk-card__body--flush' }, cal));
      main.appendChild(calCard);

      // Agenda (telefon): zilele lunii care au sarcini
      var days = Object.keys(byDay).filter(function (iso) { return D.year(iso) === y && D.month(iso) === m; }).sort();
      var agenda = h('section', { class: 'tk-card tks-agenda', 'aria-label': 'Agenda lunii' },
        h('header', { class: 'tk-card__head' }, h('h2', { class: 'tk-card__title' }, 'Agenda · ', h('b', null, monthBand(y, m)))),
        h('div', { class: 'tk-card__body tk-card__body--flush' }, days.length ? days.map(function (iso) {
          return h('div', { class: 'tks-agenda__day' + (iso === T ? ' is-today' : '') },
            h('p', { class: 'tks-agenda__date' }, dayHeader(iso) + (iso === T ? ' · azi' : '')),
            byDay[iso].map(function (t) {
              return h('label', { class: 'tk-check-label tks-agenda__item', for: 'tks-ag-chk-' + t.id },
                h('input', { type: 'checkbox', class: 'tk-check', id: 'tks-ag-chk-' + t.id, checked: isDone(t), onchange: function (e) { toggle(t, e.target.checked); } }),
                h('span', { class: 'tk-check-label__text' }, (t.time ? t.time + ' · ' : '') + t.title),
                t.assignee ? h('span', { class: 'tk-muted tks-agenda__who' }, whoText(st, t.assignee)) : null);
            }));
        }) : h('p', { class: 'tk-muted tks-pad' }, 'Nicio sarcină vizibilă în această lună.')));
      main.appendChild(agenda);
    }

    renderSide();
    renderMain();
    ctx.refresh = function () { keepFocus(function () { renderSide(); renderMain(); }); };
  }

  /* ------------------------------------------------ 5. Planificator */

  function slotList(s) {
    var start = toMin(s.start), iv = +s.interval || 60, n = Math.max(1, Math.round((+s.hours || 24) * 60 / iv)), out = [];
    for (var i = 0; i < n; i++) {
      var a = start + i * iv;
      out.push({ key: hhmm(a), end: hhmm(a + iv) });
    }
    return out;
  }

  function viewPlanner(root, ctx) {
    var api = ctx.api, P = api.prefs, T = today();
    var mode = P.get('plMode', 'zilnic');
    var date = P.get('plDate', T);
    if (!validIso(date)) date = T;
    var week = P.get('plWeek', D.startOfWeek(T));
    if (!validIso(week)) week = D.startOfWeek(T);
    var withLate = P.get('plLate', false);
    var save = TK.debounce(function () { api.commit(); }, 400);
    ctx.flushers.push(function () { save.flush(); });

    var body = h('div', { class: 'tks-planner' });
    var modeTabs = h('div', { class: 'tk-tabs tks-modes', role: 'tablist', 'aria-label': 'Tip planificator' });
    [{ id: 'zilnic', label: 'Zilnic' }, { id: 'saptamanal', label: 'Săptămânal' }].forEach(function (x) {
      modeTabs.appendChild(h('button', {
        type: 'button', class: 'tk-tab' + (mode === x.id ? ' is-active' : ''), role: 'tab', id: 'tks-pl-mode-' + x.id,
        'aria-selected': mode === x.id ? 'true' : 'false',
        onclick: function () { if (mode === x.id) return; mode = x.id; P.set('plMode', mode); render(); },
      }, x.label));
    });
    root.appendChild(modeTabs);
    root.appendChild(body);

    function S() { return api.state.planner.settings; }
    function getDay(iso, create) {
      var days = api.state.planner.days;
      if (!days[iso] && create) days[iso] = { top3: ['', '', ''], slots: {} };
      return days[iso] || null;
    }
    function tidy(iso) {
      var d = api.state.planner.days[iso];
      if (!d) return;
      for (var k in d.slots) if (!String(d.slots[k]).trim()) delete d.slots[k];
      var emptyTop = !(d.top3 || []).some(function (x) { return String(x || '').trim(); });
      if (emptyTop && !Object.keys(d.slots).length) delete api.state.planner.days[iso];
    }
    function setSlot(iso, key, val) {
      var d = getDay(iso, true);
      d.slots[key] = val;
      save();
    }
    function datalist() {
      var titles = sortTasks(api.state.tasks.filter(function (t) { return !isDone(t); })).map(function (t) { return t.title; });
      var seen = {};
      return h('datalist', { id: 'tks-dl-tasks' }, titles.filter(function (t) { if (seen[t]) return false; seen[t] = 1; return true; }).map(function (t) { return h('option', { value: t }); }));
    }
    function toggleTask(t, on) {
      markDone(t, on);
      api.commit();
      keepFocus(render);
    }
    function dueList(iso, idp) {
      var tasks = sortTasks(api.state.tasks.filter(function (t) { return t.due === iso; }));
      if (!tasks.length) return h('p', { class: 'tk-muted tks-small' }, 'Nicio sarcină cu termen în această zi.');
      return h('div', { class: 'tks-checklist tks-checklist--tight' }, tasks.map(function (t) {
        var id = idp + t.id;
        return h('label', { class: 'tk-check-label', for: id },
          h('input', { type: 'checkbox', class: 'tk-check', id: id, checked: isDone(t), onchange: function (e) { toggleTask(t, e.target.checked); } }),
          h('span', { class: 'tk-check-label__text' }, (t.time ? t.time + ' · ' : '') + t.title));
      }));
    }

    function settingsCard() {
      var s = S();
      function upd(k, v) { s[k] = v; api.commit(); keepFocus(render); }
      var starts = [];
      for (var i = 0; i < 48; i++) starts.push({ value: hhmm(i * 30), label: clock(hhmm(i * 30), s.format24) });
      return card('Setări planner', { tone: 'rose' }, kv([
        { k: 'Ora de început', id: 'tks-pl-start', v: selectEl('tks-pl-start', 'Ora de început', starts, s.start, function (e) { upd('start', e.target.value); }, 'tk-cell-input') },
        { k: 'Interval', id: 'tks-pl-int', v: selectEl('tks-pl-int', 'Interval', [{ value: 30, label: '30 min' }, { value: 60, label: '1 oră' }], s.interval, function (e) { upd('interval', +e.target.value); }, 'tk-cell-input') },
        { k: 'Durată', id: 'tks-pl-hours', v: selectEl('tks-pl-hours', 'Durata zilei planificate', [8, 12, 16, 24].map(function (n) { return { value: n, label: n + ' ore' }; }), s.hours, function (e) { upd('hours', +e.target.value); }, 'tk-cell-input') },
        { k: 'Format 24h', id: 'tks-pl-f24', v: h('input', { type: 'checkbox', class: 'tk-toggle', id: 'tks-pl-f24', checked: s.format24, onchange: function (e) { upd('format24', e.target.checked); } }) },
        { k: 'Sarcinile zilei', id: 'tks-pl-daily', v: h('input', { type: 'checkbox', class: 'tk-toggle', id: 'tks-pl-daily', checked: s.includeDaily, onchange: function (e) { upd('includeDaily', e.target.checked); } }) },
      ]));
    }

    function deadlinesCard() {
      var st = api.state;
      var list = upcoming(st.tasks, 12, withLate, T);
      return card('Cele mai apropiate deadline-uri', { tone: 'sage', cls: 'tks-pl-dead' }, h('div', { class: 'tk-stack tks-gap-sm' },
        h('label', { class: 'tk-check-label', for: 'tks-pl-late' },
          h('input', { type: 'checkbox', class: 'tk-check', id: 'tks-pl-late', checked: withLate, onchange: function (e) { withLate = e.target.checked; P.set('plLate', withLate); keepFocus(render); } }),
          h('span', null, '+ întârziate')),
        list.length ? h('table', { class: 'tk-table tk-table--dense' },
          h('thead', null, h('tr', null, h('th', null, 'Sarcină'), h('th', null, 'Termen'))),
          h('tbody', null, list.map(function (t) {
            var late = isOverdue(t, T);
            return h('tr', { class: late ? 'is-late' : null }, h('td', { class: 'tks-ellipsis' }, t.title),
              h('td', { class: 'tk-nowrap' + (late ? ' tks-late-text' : '') }, F.dateShort(t.due)));
          }))) : h('p', { class: 'tk-muted tks-small' }, 'Niciun termen apropiat.')));
    }

    function renderDaily() {
      var s = S(), d = getDay(date, false) || { top3: ['', '', ''], slots: {} };
      var slots = slotList(s);
      var nowKey = null;
      if (date === T) {
        var now = new Date(), nm = now.getHours() * 60 + now.getMinutes();
        slots.forEach(function (sl) {
          var a = toMin(sl.key), b = a + s.interval;
          if ((nm >= a && nm < b) || (nm + 1440 >= a && nm + 1440 < b)) nowKey = sl.key;
        });
      }
      var col1 = h('div', { class: 'tk-stack tks-pl-col' },
        hero('Planner zilnic', 'Tabel tracker sarcini'),
        kv([
          { k: 'Data', id: 'tks-pl-date', v: h('input', { id: 'tks-pl-date', class: 'tk-cell-input', type: 'date', value: date, onchange: function (e) { if (validIso(e.target.value)) { date = e.target.value; P.set('plDate', date); keepFocus(render); } } }) },
          { k: 'Ziua săpt.', v: h('span', { class: 'tks-weekday', id: 'tks-pl-weekday' }, weekdayLong(date)) },
        ]),
        h('div', { class: 'tks-stepper' },
          h('button', { type: 'button', class: 'tk-btn tk-btn--sm', id: 'tks-pl-prevday', 'aria-label': 'Ziua anterioară', onclick: function () { date = D.addDays(date, -1); P.set('plDate', date); keepFocus(render); } }, '‹'),
          h('button', { type: 'button', class: 'tk-btn tk-btn--sm tk-btn--ghost', id: 'tks-pl-today', onclick: function () { date = T; P.set('plDate', date); keepFocus(render); } }, 'Azi'),
          h('button', { type: 'button', class: 'tk-btn tk-btn--sm', id: 'tks-pl-nextday', 'aria-label': 'Ziua următoare', onclick: function () { date = D.addDays(date, 1); P.set('plDate', date); keepFocus(render); } }, '›')));

      var rows = slots.map(function (sl) {
        var id = 'tks-pl-slot-' + sl.key.replace(':', '');
        return h('tr', { class: sl.key === nowKey ? 'is-now' : null },
          h('td', { class: 'num tks-time' }, clock(sl.key, s.format24)),
          h('td', { class: 'tks-dash-sep', 'aria-hidden': 'true' }, '–'),
          h('td', { class: 'num tks-time' }, clock(sl.end, s.format24)),
          h('td', { class: 'tks-slot' }, h('input', {
            id: id, class: 'tk-cell-input', type: 'text', list: 'tks-dl-tasks', autocomplete: 'off',
            value: d.slots[sl.key] || '', 'aria-label': 'Sarcină la ' + clock(sl.key, s.format24),
            oninput: function (e) { setSlot(date, sl.key, e.target.value); },
            onblur: function () { tidy(date); save.flush(); },
          })));
      });
      var col2 = card('Program · ' + dayHeader(date), { tone: 'rose', flush: true, cls: 'tks-pl-slots' },
        h('table', { class: 'tk-table tk-table--dense tks-slots' },
          h('thead', null, h('tr', null, h('th', { colspan: 3 }, 'Ora'), h('th', null, 'Sarcină'))),
          h('tbody', null, rows)));

      var top = h('ol', { class: 'tks-top3' }, [0, 1, 2].map(function (i) {
        var id = 'tks-pl-top-' + i;
        return h('li', null, h('input', {
          id: id, class: 'tk-cell-input', type: 'text', list: 'tks-dl-tasks', autocomplete: 'off',
          value: (d.top3 && d.top3[i]) || '', 'aria-label': 'Prioritatea ' + (i + 1), placeholder: 'Prioritatea ' + (i + 1),
          oninput: function (e) { var dd = getDay(date, true); dd.top3 = dd.top3 || ['', '', '']; dd.top3[i] = e.target.value; save(); },
          onblur: function () { tidy(date); save.flush(); },
        }));
      }));
      var col3 = h('div', { class: 'tk-stack tks-pl-col' },
        card('Top-3 priorități', null, top),
        s.includeDaily ? card('Sarcinile zilei', { tone: 'sage' }, dueList(date, 'tks-pl-due-')) : null,
        deadlinesCard(),
        settingsCard());
      body.appendChild(h('div', { class: 'tks-pl-day' }, col1, col2, col3));
    }

    function renderWeekly() {
      var s = S(), slots = slotList(s);
      var days = [];
      for (var i = 0; i < 7; i++) days.push(D.addDays(week, i));
      var end = days[6];
      function setWeek(iso) { week = D.startOfWeek(iso); P.set('plWeek', week); keepFocus(render); }
      var left = h('div', { class: 'tk-stack tks-pl-col tks-side__head' },
        hero('Planner săptămânal', 'Tabel tracker sarcini'),
        kv([
          { k: 'Data de început', id: 'tks-pw-start', v: h('input', { id: 'tks-pw-start', class: 'tk-cell-input', type: 'date', value: week, onchange: function (e) { if (validIso(e.target.value)) setWeek(e.target.value); } }) },
          { k: 'Ziua săpt.', v: h('span', { class: 'tks-weekday' }, weekdayLong(week)) },
          { k: 'Sarcinile zilnice', id: 'tks-pw-daily', v: h('input', { type: 'checkbox', class: 'tk-toggle', id: 'tks-pw-daily', checked: s.includeDaily, onchange: function (e) { s.includeDaily = e.target.checked; api.commit(); keepFocus(render); } }) },
        ]),
        h('div', { class: 'tks-stepper' },
          h('button', { type: 'button', class: 'tk-btn tk-btn--sm', id: 'tks-pw-prev', 'aria-label': 'Săptămâna anterioară', onclick: function () { setWeek(D.addDays(week, -7)); } }, '‹'),
          h('button', { type: 'button', class: 'tk-btn tk-btn--sm tk-btn--ghost', id: 'tks-pw-cur', onclick: function () { setWeek(T); } }, 'Săptămâna curentă'),
          h('button', { type: 'button', class: 'tk-btn tk-btn--sm', id: 'tks-pw-next', 'aria-label': 'Săptămâna următoare', onclick: function () { setWeek(D.addDays(week, 7)); } }, '›')));
      var panel = h('div', { class: 'tk-stack tks-pl-col tks-side__panel' }, settingsCard(), deadlinesCard());

      var thead = h('thead', null, h('tr', null,
        h('th', { class: 'tks-wk-time' }, 'Ora'),
        days.map(function (iso) { return h('th', { class: iso === T ? 'is-today' : null, scope: 'col' }, dayHeader(iso)); })));
      var tbody = h('tbody');
      if (s.includeDaily) {
        tbody.appendChild(h('tr', { class: 'tks-wk-due' },
          h('th', { class: 'tks-wk-time', scope: 'row' }, 'Termene'),
          days.map(function (iso) { return h('td', { class: iso === T ? 'is-today' : null }, dueList(iso, 'tks-pw-due-' + iso + '-')); })));
      }
      slots.forEach(function (sl) {
        tbody.appendChild(h('tr', null,
          h('th', { class: 'tks-wk-time num', scope: 'row' }, clock(sl.key, s.format24) + ' – ' + clock(sl.end, s.format24)),
          days.map(function (iso) {
            var d = getDay(iso, false);
            var id = 'tks-pw-' + iso + '-' + sl.key.replace(':', '');
            return h('td', { class: iso === T ? 'is-today' : null }, h('input', {
              id: id, class: 'tk-cell-input', type: 'text', list: 'tks-dl-tasks', autocomplete: 'off',
              value: (d && d.slots[sl.key]) || '', 'aria-label': dayHeader(iso) + ', ' + clock(sl.key, s.format24),
              oninput: function (e) { setSlot(iso, sl.key, e.target.value); },
              onblur: function () { tidy(iso); save.flush(); },
            }));
          })));
      });
      var right = card('Săptămâna ' + F.dateShort(week) + ' – ' + F.date(end), { tone: 'rose', flush: true, cls: 'tks-pl-week tks-side__main' },
        h('div', { class: 'tk-scroll tks-wk-scroll' }, h('table', { class: 'tk-table tk-table--dense tks-week', id: 'tks-week' }, thead, tbody)));
      body.appendChild(h('div', { class: 'tks-side tks-pl-wk' }, left, panel, right));
    }

    function render() {
      TK.clear(body);
      Array.prototype.forEach.call(modeTabs.children, function (b) {
        var on = b.id === 'tks-pl-mode-' + mode;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      body.appendChild(datalist());
      if (mode === 'saptamanal') renderWeekly(); else renderDaily();
    }

    render();
    ctx.refresh = function () { keepFocus(render); };
  }

  /* ------------------------------------------------ 6. Setări */

  function viewSettings(root, ctx) {
    var api = ctx.api;
    var wrap = h('div', { class: 'tk-stack' });
    root.appendChild(wrap);

    function listEditor(kind) {
      var isPeople = kind === 'people';
      var arr = api.state[kind];
      var field = isPeople ? 'assignee' : 'category';
      var noun = isPeople ? 'executantul' : 'categoria';
      var prefix = isPeople ? 'tks-set-p' : 'tks-set-c';
      function usage(name) { return api.state.tasks.filter(function (t) { return t[field] === name; }).length; }
      function rename(item, input) {
        var nv = input.value.trim(), old = item.name;
        if (nv === old) return;
        if (!nv) { input.value = old; TK.ui.toast('Numele nu poate fi gol.'); return; }
        if (arr.some(function (x) { return x !== item && x.name.toLowerCase() === nv.toLowerCase(); })) { input.value = old; TK.ui.toast('Există deja „' + nv + '”.'); return; }
        item.name = nv;
        var n = 0;
        api.state.tasks.forEach(function (t) { if (t[field] === old) { t[field] = nv; n++; } });
        retargetPrefs(api, kind, old, nv);
        api.commit();
        TK.ui.toast('Redenumit' + (n ? '; ' + n + (n === 1 ? ' sarcină actualizată.' : ' sarcini actualizate.') : '.'));
        keepFocus(render);
      }
      var tbody = h('tbody', null, arr.map(function (item, i) {
        var nameIn = h('input', { id: prefix + '-name-' + i, class: 'tk-cell-input', type: 'text', value: item.name, 'aria-label': 'Nume', maxlength: 60, onchange: function (e) { rename(item, e.target); } });
        var n = usage(item.name);
        return h('tr', null,
          h('td', { class: 'tks-emoji' }, h('input', {
            id: prefix + '-emoji-' + i, class: 'tk-cell-input tks-emoji-in', type: 'text', value: item.emoji || '', maxlength: 8,
            'aria-label': 'Emoji pentru ' + item.name,
            onchange: function (e) { item.emoji = e.target.value.trim(); api.commit(); keepFocus(render); },
          })),
          h('td', null, nameIn),
          h('td', { class: 'num tk-muted' }, n + (n === 1 ? ' sarcină' : ' sarcini')),
          h('td', { class: 'chk' }, h('button', {
            type: 'button', class: 'tk-icon-btn', id: prefix + '-del-' + i, 'aria-label': 'Șterge ' + item.name,
            onclick: function () {
              var go = n ? TK.ui.confirm({
                title: 'Ștergi ' + noun + ' „' + item.name + '”?',
                text: n + (n === 1 ? ' sarcină rămâne' : ' sarcini rămân') + ' fără ' + (isPeople ? 'executant' : 'categorie') + '.',
                ok: 'Șterge', danger: true,
              }) : Promise.resolve(true);
              go.then(function (yes) {
                if (!yes) return;
                api.state[kind] = api.state[kind].filter(function (x) { return x !== item; });
                api.state.tasks.forEach(function (t) { if (t[field] === item.name) t[field] = ''; });
                retargetPrefs(api, kind, item.name, '');
                api.commit();
                TK.ui.toast('„' + item.name + '” a fost șters' + (isPeople ? '.' : 'ă.'));
                render();
              });
            },
          }, '✕')));
      }));
      var emojiNew = h('input', { id: prefix + '-new-emoji', class: 'tk-input tks-emoji-in', type: 'text', maxlength: 8, placeholder: isPeople ? '🙂' : '🏷️', 'aria-label': 'Emoji nou' });
      var nameNew = h('input', { id: prefix + '-new-name', class: 'tk-input', type: 'text', maxlength: 60, placeholder: isPeople ? 'Nume executant' : 'Nume categorie', 'aria-label': isPeople ? 'Numele executantului nou' : 'Numele categoriei noi' });
      var form = h('form', {
        class: 'tks-addrow', onsubmit: function (e) {
          e.preventDefault();
          var nv = nameNew.value.trim();
          if (!nv) { nameNew.focus(); TK.ui.toast('Scrie un nume.'); return; }
          if (api.state[kind].some(function (x) { return x.name.toLowerCase() === nv.toLowerCase(); })) { TK.ui.toast('Există deja „' + nv + '”.'); return; }
          api.state[kind].push({ name: nv, emoji: emojiNew.value.trim() || (isPeople ? '👤' : '🏷️') });
          api.commit();
          TK.ui.toast('Adăugat.');
          render();
          var n2 = document.getElementById(prefix + '-new-name');
          if (n2) n2.focus();
        },
      }, emojiNew, nameNew, h('button', { type: 'submit', class: 'tk-btn tk-btn--sm', id: prefix + '-add' }, isPeople ? '+ Adaugă executant' : '+ Adaugă categorie'));
      return card(isPeople ? 'Executanți' : 'Categorii', { tone: isPeople ? 'rose' : 'sage' }, h('div', { class: 'tk-stack tks-gap-sm' },
        h('div', { class: 'tk-scroll' }, h('table', { class: 'tk-table tk-table--dense' },
          h('thead', null, h('tr', null, h('th', null, 'Emoji'), h('th', null, 'Nume'), h('th', { class: 'num' }, 'Folosit în'), h('th', { class: 'chk' }, h('span', { class: 'tk-sr' }, 'Șterge')))),
          tbody)),
        form,
        h('p', { class: 'tk-muted tks-small' }, 'Redenumirea se aplică automat tuturor sarcinilor.')));
    }

    function render() {
      TK.clear(wrap);
      var done = api.state.tasks.filter(isDone).length;
      wrap.appendChild(hero('Setări', 'Executanți, categorii și curățenie', true));
      wrap.appendChild(h('div', { class: 'tk-grid tk-grid--2' }, listEditor('people'), listEditor('categories')));
      wrap.appendChild(card('Curățenie', null, h('div', { class: 'tk-row' },
        h('p', { class: 'tk-muted' }, done ? done + (done === 1 ? ' sarcină finalizată' : ' sarcini finalizate') + ' în listă.' : 'Nu ai sarcini finalizate.'),
        h('span', { class: 'tk-spacer' }),
        h('button', {
          type: 'button', class: 'tk-btn tk-btn--danger', id: 'tks-set-purge', disabled: !done,
          onclick: function () {
            TK.ui.confirm({
              title: 'Ștergi sarcinile finalizate?',
              text: done + (done === 1 ? ' sarcină finalizată va fi ștearsă' : ' sarcini finalizate vor fi șterse') + ' definitiv. Progresul (%) se va recalcula doar pe sarcinile rămase.',
              ok: 'Șterge sarcinile finalizate', danger: true,
            }).then(function (yes) {
              if (!yes) return;
              api.state.tasks = api.state.tasks.filter(function (t) { return !isDone(t); });
              api.commit();
              TK.ui.toast('Sarcinile finalizate au fost șterse.');
              render();
            });
          },
        }, 'Șterge sarcinile finalizate'))));
    }

    render();
    ctx.refresh = function () { keepFocus(render); };
  }

  var VIEWS = {
    '': viewList,
    kanban: viewKanban,
    matrice: viewMatrix,
    calendar: viewCalendar,
    planificator: viewPlanner,
    setari: viewSettings,
  };

  /* ============================================================ înregistrare */

  var DEF = {
    id: 'tasks',
    slug: 'sarcini',
    name: 'Tracker de sarcini',
    short: 'Sarcini',
    tone: 'terra',
    tagline: 'Toate sarcinile într-un singur sistem: termene, priorități, calendar, kanban și planificare.',
    version: 1,
    createDemo: createDemo,
    createEmpty: createEmpty,
    migrate: migrate,
    summary: function (state) {
      var tasks = (state && state.tasks) || [];
      var s = stats(tasks);
      return [
        { label: 'Active', value: String(s.active) },
        { label: 'Întârziate', value: String(s.overdue) },
        { label: 'Finalizate', value: s.done + ' (' + F.pct(TK.ratio(s.done, s.total), 0) + ')' },
        { label: 'Următorul termen', value: s.next ? F.dateShort(s.next.due) : '—' },
      ];
    },
    mount: function (el, api) {
      migrate(api.state);
      sanitizePrefs(api);
      var route = Object.prototype.hasOwnProperty.call(VIEWS, api.route) ? api.route : '';
      var ctx = { api: api, refresh: function () {}, flushers: [] };

      var tabs = h('div', { class: 'tk-tabs tks-tabs', role: 'tablist', 'aria-label': 'Vederi sarcini' }, TABS.map(function (t) {
        var on = t.id === route;
        return h('button', {
          type: 'button', role: 'tab', id: 'tks-tab-' + (t.id || 'lista'),
          class: 'tk-tab' + (on ? ' is-active' : ''), 'aria-selected': on ? 'true' : 'false',
          onclick: function () { if (!on) api.go(t.id); },
        }, t.label);
      }));
      var addBtn = route === 'setari' ? null : h('button', {
        type: 'button', class: 'tk-btn tk-btn--primary', id: 'tks-new',
        onclick: function () { openTaskForm(api, null, null, function () { ctx.refresh(); }); },
      }, '+ Sarcină nouă');
      el.appendChild(h('div', { class: 'tks-top' }, tabs, h('span', { class: 'tk-spacer' }), addBtn));
      var view = h('div', { class: 'tks-view tks-view--' + (route || 'lista') });
      el.appendChild(view);
      VIEWS[route](view, ctx);
      return {
        unmount: function () {
          ctx.flushers.forEach(function (fn) { try { fn(); } catch (e) { /* ignorăm */ } });
        },
      };
    },
  };

  TK.register(DEF);

  // expus pentru teste
  TK._tasks = { stats: stats, createDemo: createDemo, isOverdue: isOverdue, quadOf: quadOf, sortTasks: sortTasks };
})();
