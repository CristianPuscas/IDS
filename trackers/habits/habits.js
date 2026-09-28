/*
 * Tracker de obiceiuri — analiza lunară a obiceiurilor zilnice, liste săptămânale și lunare.
 *
 * Forma stării (JSON, compactă):
 * {
 *   habits:  [{ id: 'h1', name: 'Antrenament', goal: 26 | null,   // zile-țintă pe lună (opțional)
 *               createdAt: '2026-01-01',                          // prima zi în care obiceiul contează
 *               createdYm: '2026-01',                             // = luna lui createdAt (vizibilitate pe luni)
 *               archivedYm?: '2026-10' }],   // oprit din prima zi a acestei luni; vizibil în lunile createdYm ≤ ym < archivedYm
 *   checks:  { '2026-09': { h1: '0110…' } },   // câte un caracter pe zi a lunii ('1' = bifat), lungime = zilele lunii
 *   weekly:  { '2026-09': [ [ {id, text, done} ], … ] },  // o listă pe fiecare săptămână (TK.date.chunkWeeks: 1–7, 8–14, …)
 *   monthly: { '2026-09': [ {id, text, done} ] },          // maximum 28 de acțiuni pe lună
 *   meta: {…}  // gestionat de cadru
 * }
 * Luna afișată și săptămâna aleasă stau în api.prefs ('ym', 'week'), nu în date.
 *
 * Calcule — o zi „eligibilă” pentru un obicei: ziua ≥ createdAt și ziua ≤ azi (zilele viitoare nu se pot bifa
 * și nu intră la numitor; lunile trecute se socotesc întregi):
 *   % pe zi       = obiceiuri bifate în zi / obiceiuri eligibile în acea zi
 *   % lunar       = total bifate / Σ zile eligibile ale tuturor obiceiurilor   („304 / 372”)
 *   % pe obicei   = zile bifate / zilele lui eligibile din lună
 */
(function () {
  'use strict';

  var TK = window.TK, h = TK.h, D = TK.date, F = TK.fmt;

  var MAX_HABITS = 30, MAX_MONTHLY = 28, MAX_WEEKLY = 15;
  var MONTHS_LOWER = D.MONTHS.map(function (s) { return s.toLowerCase(); });
  var VIEWS = [
    { sub: '', label: 'Zilnic' },
    { sub: 'saptamanal', label: 'Săptămânal' },
    { sub: 'lunar', label: 'Lunar' },
  ];

  /* ------------------------------------------------------------ utilitare */

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymOf(y, m) { return y + '-' + pad(m + 1); }
  function ymY(ym) { return +ym.slice(0, 4); }
  function ymM(ym) { return +ym.slice(5, 7) - 1; }
  function shiftYm(ym, k) {
    var y = ymY(ym), m = ymM(ym) + k;
    y += Math.floor(m / 12);
    m = ((m % 12) + 12) % 12;
    return ymOf(y, m);
  }
  function validYm(v) { return typeof v === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(v); }
  function pct0(r) { return Math.round(r * 100) + '%'; }
  function zeros(n) { var a = []; for (var i = 0; i < n; i++) a.push(0); return a; }
  function uid(p) { return (p || 'x') + TK.uid(); }

  function normalize(st) {
    if (!Array.isArray(st.habits)) st.habits = [];
    st.habits.forEach(function (hb) {
      // migrare: obiceiurile vechi aveau doar luna creării
      if (!hb.createdAt || !/^\d{4}-\d{2}-\d{2}$/.test(hb.createdAt)) hb.createdAt = (validYm(hb.createdYm) ? hb.createdYm : '2000-01') + '-01';
      hb.createdYm = hb.createdAt.slice(0, 7);
    });
    if (!st.checks || typeof st.checks !== 'object') st.checks = {};
    if (!st.weekly || typeof st.weekly !== 'object') st.weekly = {};
    if (!st.monthly || typeof st.monthly !== 'object') st.monthly = {};
    return st;
  }

  function isVisible(hb, ym) {
    return (!hb.createdYm || hb.createdYm <= ym) && (!hb.archivedYm || ym < hb.archivedYm);
  }
  function visibleHabits(st, ym) {
    return st.habits.filter(function (hb) { return isVisible(hb, ym); });
  }
  function activeCount(st) {
    return st.habits.filter(function (hb) { return !hb.archivedYm; }).length;
  }

  function getBits(st, ym, hid) {
    var mc = st.checks[ym];
    return (mc && mc[hid]) || '';
  }
  function setBit(st, ym, hid, d, on, n) {
    var mc = st.checks[ym] || (st.checks[ym] = {});
    var s = mc[hid] || '';
    while (s.length < n) s += '0';
    s = s.slice(0, d - 1) + (on ? '1' : '0') + s.slice(d);
    if (s.indexOf('1') === -1) delete mc[hid];
    else mc[hid] = s;
    if (!Object.keys(mc).length) delete st.checks[ym];
  }

  // Prima zi a lunii (1-based) în care obiceiul contează: n + 1 dacă nu contează deloc.
  function firstDay(hb, ym, n) {
    var ca = hb.createdAt || '';
    if (ca.slice(0, 7) < ym) return 1;
    if (ca.slice(0, 7) > ym) return n + 1;
    return D.day(ca);
  }

  // Toate cifrele unei luni. Se numără doar zilele eligibile (≥ createdAt și ≤ azi).
  function monthStats(st, ym, today) {
    var y = ymY(ym), m = ymM(ym), n = D.daysInMonth(y, m);
    var hs = visibleHabits(st, ym);
    var tYm = D.ym(today);
    var lastDay = ym < tYm ? n : ym === tYm ? D.day(today) : 0; // ultima zi care se poate bifa
    var perDay = zeros(n), eligible = zeros(n), perHabit = [], denHabit = [], fullHabit = [], starts = [];
    var total = 0, max = 0, goalsMet = 0, goalsSet = 0;
    hs.forEach(function (hb) {
      var s = getBits(st, ym, hb.id), c = 0, from = firstDay(hb, ym, n);
      for (var d = from; d <= lastDay; d++) {
        eligible[d - 1]++;
        if (s.charCodeAt(d - 1) === 49) { c++; perDay[d - 1]++; }
      }
      var den = Math.max(0, lastDay - from + 1);
      starts.push(from);
      perHabit.push(c);
      denHabit.push(den);
      fullHabit.push(Math.max(0, n - from + 1));
      total += c;
      max += den;
      if (hb.goal) { goalsSet++; if (c >= hb.goal) goalsMet++; }
    });
    var rate = perHabit.map(function (c, i) { return TK.ratio(c, denHabit[i]); });
    var order = hs.map(function (_, i) { return i; }).sort(function (a, b) {
      return rate[b] - rate[a] || perHabit[b] - perHabit[a] || a - b;
    });
    return {
      ym: ym, y: y, m: m, n: n, hs: hs, perDay: perDay, eligible: eligible, perHabit: perHabit, denHabit: denHabit,
      fullHabit: fullHabit, starts: starts, rate: rate, total: total, max: max,
      goalsMet: goalsMet, goalsSet: goalsSet, lastDay: lastDay, order: order,
      // null = zi fără obiceiuri eligibile (viitoare sau înainte de primul obicei)
      dayRatio: perDay.map(function (c, i) { return eligible[i] ? c / eligible[i] : null; }),
    };
  }

  // Data de la care contează un obicei adăugat în timp ce privești luna `ym`:
  //  - o lună trecută → prima zi a acelei luni (completezi istoricul);
  //  - luna curentă sau una viitoare → azi (nu scade procentul zilelor deja trecute;
  //    dacă bifezi totuși o zi anterioară din luna curentă, data de start se mută pe acea zi).
  function createdAtFor(ym, today) {
    return ym < D.ym(today) ? ym + '-01' : today;
  }

  function listStats(items) {
    var done = items.filter(function (it) { return it.done; }).length;
    return { done: done, total: items.length, ratio: TK.ratio(done, items.length) };
  }

  function weekRange(w, m) {
    return pad(w[0]) + '–' + pad(w[w.length - 1]) + ' ' + D.MONTHS_SHORT[m];
  }

  /* ------------------------------------------------------------ date demo */

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // [nume, consecvență, tipar] — tipar: 'wd' mai bine în zilele lucrătoare, 'we' mai bine în weekend, 'sun' pauză duminica
  var DEMO_HABITS = [
    ['Antrenament', 0.9, 'sun'],
    ['Citit 30 de minute', 0.6, 'we'],
    ['Studiu engleză', 0.85, 'wd'],
    ['Meditație', 0.8, null],
    ['Fără rețele sociale până la prânz', 0.84, null],
    ['Planificarea zilei', 0.88, 'wd'],
    ['Evidența finanțelor', 0.8, null],
    ['10 000 de pași', 0.78, 'we'],
    ['Lucru la proiect', 0.66, 'wd'],
    ['Somn 8 ore', 0.74, 'we'],
    ['Jurnal / reflecție', 0.93, null],
    ['Fără dulciuri', 0.96, null],
  ];
  var DEMO_WEEKLY = ['Planificarea săptămânii', 'Planificarea meniului', 'Lecție curs online', 'Revizuirea finanțelor', 'Cumpărături mari', 'Plimbare lungă'];
  var DEMO_MONTHLY = ['Curățenie generală', 'Planificarea lunii', 'Curățarea emailului', 'Detox digital', 'Vizită la părinți'];

  function createDemo() {
    var today = D.today();
    var Y = D.year(today), M = D.month(today);
    var rnd = mulberry32(20260917);
    var seq = 0;
    function iid() { seq++; return 'd' + seq.toString(36); }
    var st = createEmpty();
    var start = ymOf(Y, 0);
    st.habits = DEMO_HABITS.map(function (d, i) {
      return { id: 'h' + (i + 1), name: d[0], goal: Math.max(18, Math.min(28, Math.round(d[1] * 30) - 1)), createdAt: start + '-01', createdYm: start };
    });
    for (var m = 0; m <= M; m++) {
      var ym = ymOf(Y, m), n = D.daysInMonth(Y, m);
      var bits = st.habits.map(function () { return ''; });
      for (var d = 1; d <= n; d++) {
        var iso = D.make(Y, m, d);
        var future = iso > today;
        var wd = D.weekday(iso), weekend = wd >= 5;
        var dayF = (rnd() - 0.62) * 0.3; // zile bune și zile mai slabe
        DEMO_HABITS.forEach(function (hd, i) {
          var p = hd[1] + dayF * (1 - hd[1] + 0.25);
          if (hd[2] === 'wd') p += weekend ? -0.18 : 0.05;
          else if (hd[2] === 'we') p += weekend ? 0.12 : -0.04;
          else if (hd[2] === 'sun' && wd === 6) p -= 0.45;
          var r = rnd();
          bits[i] += !future && r < p ? '1' : '0';
        });
      }
      var mc = {};
      st.habits.forEach(function (hb, i) { if (bits[i].indexOf('1') !== -1) mc[hb.id] = bits[i]; });
      if (Object.keys(mc).length) st.checks[ym] = mc;
    }
    // liste săptămânale și lunare pentru ultimele 4 luni
    for (m = Math.max(0, M - 3); m <= M; m++) {
      ym = ymOf(Y, m);
      st.weekly[ym] = D.chunkWeeks(Y, m).map(function (w) {
        var first = D.make(Y, m, w[0]), last = D.make(Y, m, w[w.length - 1]);
        var state = last < today ? 'past' : first <= today ? 'now' : 'future';
        var list = [];
        DEMO_WEEKLY.forEach(function (t, i) {
          if (i >= 3 && rnd() < 0.55) return;
          var done = state === 'past' ? rnd() < 0.85 : state === 'now' ? (i < 2 || rnd() < 0.3) : false;
          list.push({ id: iid(), text: t, done: done });
        });
        return list;
      });
      var cur = m === M;
      st.monthly[ym] = DEMO_MONTHLY.filter(function (t, i) { return i < 3 || rnd() < 0.7; }).map(function (t, i) {
        return { id: iid(), text: t, done: cur ? i < 2 || (i === 2 && D.day(today) > 20) : rnd() < 0.85 };
      });
    }
    return st;
  }

  function createEmpty() {
    return { habits: [], checks: {}, weekly: {}, monthly: {} };
  }

  /* ------------------------------------------------------------ sumar */

  function summary(st) {
    normalize(st);
    var today = D.today();
    var s = monthStats(st, D.ym(today), today);
    var best = s.order.length && s.denHabit[s.order[0]] ? s.hs[s.order[0]].name + ' · ' + pct0(s.rate[s.order[0]]) : '—';
    var ti = D.day(today) - 1;
    return [
      { label: 'Progres lunar', value: F.pct(TK.ratio(s.total, s.max), 1) },
      { label: 'Bifate azi', value: s.perDay[ti] + ' / ' + s.eligible[ti] },
      { label: 'Cel mai constant obicei', value: best },
    ];
  }

  /* ------------------------------------------------------------ montare */

  function mount(el, api) {
    var st = normalize(api.state);
    var today = D.today();
    var view = VIEWS.some(function (v) { return v.sub === api.route; }) ? api.route : '';
    var ym = api.prefs.get('ym', D.ym(today));
    if (!validYm(ym)) ym = D.ym(today);

    var tabs = h('div', { class: 'tk-tabs hb-tabs', role: 'tablist', 'aria-label': 'Secțiuni tracker obiceiuri' },
      VIEWS.map(function (v) {
        var on = v.sub === view;
        return h('button', {
          type: 'button', class: 'tk-tab' + (on ? ' is-active' : ''), role: 'tab',
          id: 'hb-tab-' + (v.sub || 'zilnic'), 'aria-selected': on ? 'true' : 'false',
          'aria-controls': 'hb-panel',
          onclick: function () { if (!on) api.go(v.sub); },
        }, v.label);
      }));
    var panel = h('div', { class: 'hb-panel', id: 'hb-panel', role: 'tabpanel', 'aria-labelledby': 'hb-tab-' + (view || 'zilnic') });
    el.appendChild(h('div', { class: 'hb-topline' }, tabs));
    el.appendChild(panel);

    function setYm(next) {
      if (!validYm(next)) return;
      ym = next;
      api.prefs.set('ym', ym);
      render();
    }

    function ctx() {
      var y = ymY(ym), m = ymM(ym);
      return { api: api, st: st, ym: ym, y: y, m: m, n: D.daysInMonth(y, m), today: today, setYm: setYm, rerender: render };
    }

    function render() {
      var sc = panel.querySelector('.hb-grid-scroll');
      var keep = sc ? sc.scrollLeft : 0;
      TK.clear(panel);
      var c = ctx();
      if (view === 'saptamanal') renderWeekly(panel, c);
      else if (view === 'lunar') renderMonthly(panel, c);
      else renderDaily(panel, c);
      var sc2 = panel.querySelector('.hb-grid-scroll');
      if (sc2 && keep) sc2.scrollLeft = keep;
      else if (!keep) scrollToToday(panel);
    }
    render();
    return { unmount: function () { TK.clear(el); } };
  }

  // Pe ecrane înguste, grilele derulează orizontal: aducem ziua de azi în vizor.
  function scrollToToday(panel) {
    var list = panel.querySelectorAll('.hb-grid-scroll, .hb-dyn-scroll');
    Array.prototype.forEach.call(list, function (sc) {
      if (sc.scrollWidth <= sc.clientWidth + 1) return;
      var th = sc.querySelector('thead .hb-r3 th.is-today');
      var name = sc.querySelector('thead .hb-r3 .tk-habit-grid__name');
      if (!th) return;
      var nameW = name ? name.offsetWidth : 0;
      var target = th.offsetLeft - nameW - (sc.clientWidth - nameW) / 2 + th.offsetWidth / 2;
      sc.scrollLeft = Math.max(0, target);
    });
  }

  /* ------------------------------------------------------------ antet (lună / an) */

  function buildHeader(c, sub) {
    var st = c.st;
    var years = {};
    var yNow = D.year(c.today);
    for (var y = yNow - 2; y <= yNow + 1; y++) years[y] = 1;
    years[c.y] = 1;
    st.habits.forEach(function (hb) { if (hb.createdYm) years[ymY(hb.createdYm)] = 1; });
    var yearList = Object.keys(years).map(Number).sort();

    var monthSel = h('select', {
      id: 'hb-month', class: 'tk-cell-input',
      onchange: function () { c.setYm(ymOf(c.y, +monthSel.value)); },
    }, D.MONTHS.map(function (nm, i) { return h('option', { value: String(i), selected: i === c.m }, nm); }));
    var yearSel = h('select', {
      id: 'hb-year', class: 'tk-cell-input',
      onchange: function () { c.setYm(ymOf(+yearSel.value, c.m)); },
    }, yearList.map(function (yy) { return h('option', { value: String(yy), selected: yy === c.y }, String(yy)); }));

    var isNow = c.ym === D.ym(c.today);
    return h('div', { class: 'hb-head' },
      h('div', { class: 'tk-hero' },
        h('h1', { class: 'tk-hero__title' }, D.MONTHS[c.m]),
        h('p', { class: 'tk-hero__sub' }, sub)),
      h('div', { class: 'tk-kv hb-kv' },
        h('label', { class: 'tk-kv__k', for: 'hb-month' }, 'Luna'), h('span', { class: 'tk-kv__v' }, monthSel),
        h('label', { class: 'tk-kv__k', for: 'hb-year' }, 'Anul'), h('span', { class: 'tk-kv__v' }, yearSel)),
      h('div', { class: 'hb-nav' },
        h('button', { type: 'button', id: 'hb-prev', class: 'tk-btn tk-btn--sm', 'aria-label': 'Luna anterioară', title: 'Luna anterioară', onclick: function () { c.setYm(shiftYm(c.ym, -1)); } }, '‹'),
        h('button', { type: 'button', id: 'hb-now', class: 'tk-btn tk-btn--sm tk-btn--ghost', disabled: isNow, onclick: function () { c.setYm(D.ym(c.today)); } }, 'Luna curentă'),
        h('button', { type: 'button', id: 'hb-next', class: 'tk-btn tk-btn--sm', 'aria-label': 'Luna următoare', title: 'Luna următoare', onclick: function () { c.setYm(shiftYm(c.ym, 1)); } }, '›'))
    );
  }

  /* ------------------------------------------------------------ vederea Zilnic */

  function dayMeta(c) {
    var out = [];
    var tIso = c.today;
    for (var d = 1; d <= c.n; d++) {
      var iso = D.make(c.y, c.m, d);
      out.push({ d: d, iso: iso, wd: D.weekday(iso), today: iso === tIso, future: iso > tIso });
    }
    return out;
  }

  // Cele trei rânduri de antet comune grilei și dinamicii: săptămâni, zile ale săptămânii, numere.
  function gridHead(c, days, labels) {
    var weeks = D.chunkWeeks(c.y, c.m);
    var r1 = h('tr', { class: 'hb-r1' }, h('th', { class: 'tk-habit-grid__week tk-habit-grid__name', scope: 'col' }, labels[0]));
    weeks.forEach(function (w, i) {
      r1.appendChild(h('th', {
        class: 'tk-habit-grid__week' + (i ? ' is-week-start' : ''), colspan: w.length, scope: 'colgroup',
        title: 'Săptămâna ' + (i + 1) + ' · ' + weekRange(w, c.m),
      }, (w.length < 5 ? 'Săpt. ' : 'Săptămâna ') + (i + 1)));
    });
    var r2 = h('tr', { class: 'hb-r2' }, h('th', { class: 'tk-habit-grid__name' }, labels[1] || ''));
    var r3 = h('tr', { class: 'hb-r3' }, h('th', { class: 'tk-habit-grid__name' }, labels[2] || ''));
    days.forEach(function (dm) {
      var cls = (dm.d % 7 === 1 && dm.d > 1 ? 'is-week-start ' : '') + (dm.today ? 'is-today ' : '') + (dm.wd >= 5 ? 'hb-we' : '');
      r2.appendChild(h('th', { class: cls, title: D.WEEKDAYS[dm.wd] }, D.WEEKDAYS_SHORT[dm.wd]));
      r3.appendChild(h('th', { class: cls, scope: 'col', 'aria-label': dm.d + ' ' + MONTHS_LOWER[c.m] + ', ' + D.WEEKDAYS[dm.wd].toLowerCase() }, String(dm.d)));
    });
    return h('thead', null, r1, r2, r3);
  }

  function dayCellClass(dm) {
    return (dm.d % 7 === 1 && dm.d > 1 ? 'is-week-start ' : '') + (dm.today ? 'is-today ' : '') + (dm.future ? 'is-future' : '');
  }

  function renderDaily(root, c) {
    var st = c.st, api = c.api;
    var days = dayMeta(c);
    var s0 = monthStats(st, c.ym, c.today);
    var hs = s0.hs;
    var refs = { rows: [] };
    var wrap = h('div', { class: 'hb-daily', style: { '--n': String(c.n) } });
    root.appendChild(wrap);

    /* --- sus, stânga: lună + setări */
    wrap.appendChild(h('section', { class: 'hb-a-head' }, buildHeader(c, 'Analiza obiceiurilor')));

    /* --- sus, centru: progres zilnic */
    refs.bars = h('div', { class: 'hb-bars-chart' });
    wrap.appendChild(h('section', { class: 'hb-a-bars', 'aria-label': 'Progres zilnic' },
      h('p', { class: 'tk-chart__title' }, 'Progres zilnic (%)'), refs.bars));

    /* --- sus, dreapta: progres */
    refs.kpi = h('span', { class: 'tk-kpi__value tk-pct', id: 'hb-kpi-pct' }, '');
    refs.kpiDonut = h('div', { class: 'hb-kpi-donut' });
    wrap.appendChild(h('section', { class: 'tk-card hb-a-kpi' },
      h('div', { class: 'tk-card__body hb-kpi' },
        h('div', { class: 'tk-kpi' }, h('span', { class: 'tk-kpi__label' }, 'Progres'), refs.kpi),
        refs.kpiDonut)));

    /* --- mijloc, stânga: lista obiceiurilor */
    var listBody = h('tbody');
    var listT = h('table', { class: 'hb-t hb-list' },
      h('colgroup', null, h('col', { class: 'hb-col-idx' }), h('col'), h('col', { class: 'hb-col-act' })),
      h('thead', null,
        h('tr', { class: 'hb-r1' }, h('th', { class: 'hb-band', colspan: 3, scope: 'colgroup' }, h('span', null, 'Obiceiuri '), h('b', null, 'zilnice'))),
        h('tr', { class: 'hb-r2' }, h('th', { class: 'hb-band hb-band--sub', colspan: 3, id: 'hb-list-count' }, hs.length + ' / ' + MAX_HABITS + ' obiceiuri')),
        h('tr', { class: 'hb-r3' }, h('th', { class: 'hb-idx', scope: 'col' }, '#'), h('th', { scope: 'col' }, 'Obicei'), h('th', { class: 'hb-act' }, h('span', { class: 'tk-sr' }, 'Acțiuni')))),
      listBody);
    wrap.appendChild(h('section', { class: 'tk-card tk-card--sage hb-a-list', 'aria-label': 'Obiceiuri zilnice' }, listT));

    /* --- mijloc, centru: grila */
    var gridBody = h('tbody');
    var gridT = h('table', { class: 'tk-habit-grid hb-t hb-grid', id: 'hb-grid' },
      h('caption', { class: 'tk-sr' }, 'Bifează zilele în care ai respectat fiecare obicei, ' + D.MONTHS[c.m] + ' ' + c.y),
      gridHead(c, days, ['Obicei', '', '']), gridBody);
    var gridScroll = h('div', { class: 'tk-scroll hb-grid-scroll' }, gridT);
    wrap.appendChild(h('section', { class: 'tk-card hb-a-grid', 'aria-label': 'Grila de bifat' }, gridScroll));

    /* --- mijloc, dreapta: progres pe obicei */
    var progBody = h('tbody');
    refs.progSub = h('th', { class: 'hb-band hb-band--sub', colspan: 3 }, '');
    var progT = h('table', { class: 'hb-t hb-prog' },
      h('colgroup', null, h('col', { class: 'hb-col-goal' }), h('col'), h('col', { class: 'hb-col-cnt' })),
      h('thead', null,
        h('tr', { class: 'hb-r1' }, h('th', { class: 'hb-band', colspan: 3, scope: 'colgroup' }, h('b', null, 'Progres'))),
        h('tr', { class: 'hb-r2' }, refs.progSub),
        h('tr', { class: 'hb-r3' },
          h('th', { scope: 'col', title: 'Zile-țintă pe lună' }, 'Obiectiv'),
          h('th', { scope: 'col' }, 'Procent'),
          h('th', { scope: 'col' }, 'Număr'))),
      progBody);
    wrap.appendChild(h('section', { class: 'tk-card tk-card--sage hb-a-prog', 'aria-label': 'Progres pe obicei' }, progT));

    /* rânduri */
    hs.forEach(function (hb, i) {
      var bits = getBits(st, c.ym, hb.id);
      // listă
      var nameIn = h('input', {
        class: 'tk-cell-input', id: 'hb-name-' + hb.id, value: hb.name, maxlength: 60, autocomplete: 'off',
        'aria-label': 'Numele obiceiului ' + (i + 1),
        onchange: function () {
          var v = nameIn.value.trim();
          if (!v) { nameIn.value = hb.name; return; }
          hb.name = v;
          api.commit();
          nameCell.textContent = v;
          nameCell.title = v;
          delBtn.setAttribute('aria-label', 'Elimină obiceiul „' + v + '”');
          progName.textContent = v;
          goalIn.setAttribute('aria-label', 'Obiectiv (zile pe lună) pentru ' + v);
          bar.setAttribute('aria-label', 'Progres ' + v);
          gridBody.querySelectorAll('input[data-h="' + hb.id + '"]').forEach(function (cb) {
            cb.setAttribute('aria-label', v + ', ' + cb.getAttribute('data-d') + ' ' + MONTHS_LOWER[c.m]);
          });
          update();
        },
        onkeydown: function (e) {
          if (e.key === 'Enter') nameIn.blur();
          if (e.key === 'Escape') { nameIn.value = hb.name; nameIn.blur(); }
          if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
            e.preventDefault();
            var nb = hs[i + (e.key === 'ArrowUp' ? -1 : 1)];
            if (nb) moveHabit(c, hb, nb, e.key === 'ArrowDown', true);
          }
        },
      });
      var delBtn = h('button', {
        type: 'button', class: 'tk-icon-btn hb-del', id: 'hb-del-' + hb.id,
        'aria-label': 'Elimină obiceiul „' + hb.name + '”', title: 'Elimină obiceiul',
        onclick: function () { removeHabit(c, hb); },
      }, '×');
      var idxCell = h('td', {
        class: 'hb-idx hb-grip', title: 'Trage ca să muți obiceiul (sau Alt + ↑/↓ în nume)',
        onpointerdown: function (e) { startDrag(e, c, hb, idxCell); },
      }, String(i + 1));
      listBody.appendChild(h('tr', { dataset: { h: hb.id } },
        idxCell,
        h('td', { class: 'hb-name' }, nameIn),
        h('td', { class: 'hb-act' }, delBtn)));

      // grilă
      var nameCell = h('th', { class: 'tk-habit-grid__name', scope: 'row', title: hb.name }, hb.name);
      var tr = h('tr', { dataset: { h: hb.id } }, nameCell);
      days.forEach(function (dm) {
        var on = !dm.future && bits.charCodeAt(dm.d - 1) === 49;
        tr.appendChild(h('td', { class: dayCellClass(dm) + (dm.d < s0.starts[i] ? ' is-pre' : '') },
          h('input', {
            type: 'checkbox', class: 'tk-check', id: 'hb-c-' + hb.id + '-' + dm.d, checked: on,
            disabled: dm.future, title: dm.future ? 'Zi viitoare' : null,
            dataset: { h: hb.id, d: String(dm.d) },
            'aria-label': hb.name + ', ' + dm.d + ' ' + MONTHS_LOWER[c.m],
          })));
      });
      gridBody.appendChild(tr);

      // progres
      var goalIn = h('input', {
        class: 'tk-cell-input num', id: 'hb-goal-' + hb.id, inputmode: 'numeric', autocomplete: 'off',
        value: hb.goal ? String(hb.goal) : '', placeholder: '—',
        'aria-label': 'Obiectiv (zile pe lună) pentru ' + hb.name,
        onchange: function () {
          var v = F.parseNum(goalIn.value);
          if (v == null) hb.goal = null;
          else hb.goal = Math.max(1, Math.min(31, Math.round(v)));
          goalIn.value = hb.goal ? String(hb.goal) : '';
          api.commit();
          update();
        },
        onkeydown: function (e) { if (e.key === 'Enter') goalIn.blur(); },
      });
      var pctEl = h('span', { class: 'tk-pct hb-pc__v' });
      var bar = h('span', { class: 'tk-progress tk-progress--bar hb-bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-label': 'Progres ' + hb.name });
      var cnt = h('td', { class: 'num hb-cnt' });
      var progName = h('span', { class: 'hb-pc__name' }, hb.name);
      progBody.appendChild(h('tr', { dataset: { h: hb.id } },
        h('td', { class: 'num hb-goal' }, goalIn),
        h('td', { class: 'hb-pc' }, progName, h('div', { class: 'hb-pc__in' }, pctEl, bar)),
        cnt));
      refs.rows.push({ hb: hb, pct: pctEl, bar: bar, cnt: cnt });
    });

    /* rândul de adăugare, aliniat în toate cele trei tabele */
    var canAdd = activeCount(st) < MAX_HABITS;
    var addIn = h('input', {
      class: 'tk-cell-input', id: 'hb-add-name', maxlength: 60, autocomplete: 'off',
      placeholder: canAdd ? '+ Obicei nou…' : 'Maximum ' + MAX_HABITS + ' obiceiuri', disabled: !canAdd,
      'aria-label': 'Numele obiceiului nou',
    });
    var addForm = h('form', {
      class: 'hb-add', id: 'hb-add-form',
      onsubmit: function (e) {
        e.preventDefault();
        var v = addIn.value.trim();
        if (!v) { addIn.focus(); return; }
        if (activeCount(st) >= MAX_HABITS) { TK.ui.toast('Poți avea cel mult ' + MAX_HABITS + ' obiceiuri active.'); return; }
        var ca = createdAtFor(c.ym, c.today);
        st.habits.push({ id: uid('h'), name: v, goal: null, createdAt: ca, createdYm: ca.slice(0, 7) });
        api.commit();
        c.rerender();
        var again = document.getElementById('hb-add-name');
        if (again) again.focus();
        TK.ui.toast(ca === c.today ? 'Obiceiul „' + v + '” a fost adăugat și contează de azi.' : 'Obiceiul „' + v + '” a fost adăugat.');
      },
    }, addIn, h('button', { type: 'submit', class: 'tk-icon-btn', id: 'hb-add-btn', 'aria-label': 'Adaugă obiceiul', title: 'Adaugă obiceiul', disabled: !canAdd }, '+'));
    listBody.appendChild(h('tr', { class: 'hb-addrow' }, h('td', { class: 'hb-idx' }, String(hs.length + 1)), h('td', { colspan: 2 }, addForm)));
    var gridAdd = h('tr', { class: 'hb-addrow' }, h('th', { class: 'tk-habit-grid__name' }, h('label', { for: 'hb-add-name', class: 'hb-add-hint' }, '+ Obicei nou')));
    if (!hs.length) {
      gridAdd.appendChild(h('td', { colspan: c.n, class: 'hb-empty-cell' }, 'Nu ai încă obiceiuri în această lună. Scrie primul obicei în lista „Obiceiuri zilnice”.'));
    } else {
      days.forEach(function (dm) { gridAdd.appendChild(h('td', { class: dayCellClass(dm) })); });
    }
    gridBody.appendChild(gridAdd);
    progBody.appendChild(h('tr', { class: 'hb-addrow' }, h('td'), h('td'), h('td')));

    /* click pe bife: fără redesenare, doar cifrele */
    gridBody.addEventListener('change', function (e) {
      var cb = e.target;
      if (!cb || !cb.dataset || !cb.dataset.h) return;
      var d = +cb.dataset.d, iso = D.make(c.y, c.m, d);
      if (iso > c.today) { cb.checked = false; return; }
      var hb = st.habits.filter(function (x) { return x.id === cb.dataset.h; })[0];
      if (hb && cb.checked && iso < hb.createdAt) {
        // bifezi o zi dinaintea startului: obiceiul contează de atunci
        hb.createdAt = iso;
        hb.createdYm = iso.slice(0, 7);
        var cells = cb.closest('tr').querySelectorAll('td.is-pre');
        Array.prototype.forEach.call(cells, function (td) {
          var inp = td.querySelector('input');
          if (inp && +inp.dataset.d >= d) td.classList.remove('is-pre');
        });
      }
      setBit(st, c.ym, cb.dataset.h, d, cb.checked, c.n);
      api.commit();
      update();
    });

    /* --- jos, stânga: rezumatul lunii */
    refs.sumDonut = h('div', { class: 'hb-sum-donut' });
    refs.sumCount = h('b', { class: 'hb-sum-count' });
    refs.sum = {};
    var sumRows = [
      ['pct', '% completate'], ['done', 'Completate'], ['left', 'Necompletate'],
      ['total', 'Total obiceiuri-zile'], ['avg', 'Media pe zi'], ['goals', 'Obiective atinse'],
    ];
    var sumBody = h('tbody', null, sumRows.map(function (r) {
      refs.sum[r[0]] = h('td', { class: 'num' });
      return h('tr', null, h('td', null, r[1]), refs.sum[r[0]]);
    }));
    wrap.appendChild(h('section', { class: 'tk-card tk-card--sage hb-a-sum' },
      h('header', { class: 'tk-card__head tk-card__head--sage' }, h('h2', { class: 'tk-card__title' }, 'Rezumatul ', h('b', null, 'lunii'))),
      h('div', { class: 'hb-sum-top' }, refs.sumDonut,
        h('div', { class: 'hb-sum-lab' }, h('span', { class: 'tk-kpi__label' }, 'Obiceiuri zilnice'), refs.sumCount)),
      h('table', { class: 'tk-table tk-table--dense hb-sum-t' },
        h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Indicator'), h('th', { scope: 'col', class: 'num' }, 'Valoare'))),
        sumBody)));

    /* --- jos, centru: dinamica pe zile */
    refs.area = h('div', { class: 'hb-area' });
    refs.dyn = { pct: [], chk: [], un: [], tot: [] };
    var dynLabels = { pct: '% pe zi', chk: 'Bifate', un: 'Nebifate', tot: 'Total' }; // rândul % e fără semnul „%” (coloane înguste)
    var dynBody = h('tbody', null,
      h('tr', { class: 'hb-area-row' }, h('th', { class: 'tk-habit-grid__name', scope: 'row' }, 'Curba lunii'),
        h('td', { colspan: c.n, class: 'hb-area-cell' }, refs.area)));
    ['pct', 'chk', 'un', 'tot'].forEach(function (k) {
      var tr = h('tr', { class: 'hb-dyn-' + k }, h('th', { class: 'tk-habit-grid__name', scope: 'row' }, dynLabels[k]));
      days.forEach(function (dm) {
        var td = h('td', { class: dayCellClass(dm) });
        refs.dyn[k].push(td);
        tr.appendChild(td);
      });
      dynBody.appendChild(tr);
    });
    var dynT = h('table', { class: 'tk-habit-grid hb-grid hb-dyn', id: 'hb-dyn' },
      h('caption', { class: 'tk-sr' }, 'Dinamica pe zile: procent, bifate, nebifate și total pentru fiecare zi'),
      gridHead(c, days, ['Dinamica', '', '']), dynBody);
    wrap.appendChild(h('section', { class: 'tk-card hb-a-dyn' },
      h('header', { class: 'tk-card__head' }, h('h2', { class: 'tk-card__title' }, 'Dinamica ', h('b', null, 'pe zile'))),
      h('div', { class: 'tk-scroll hb-dyn-scroll' }, dynT),
      h('footer', { class: 'tk-card__foot hb-dyn-foot' }, h('span', null, 'Rânduri: % pe zi · Bifate · Nebifate · Total'))));

    /* --- jos, dreapta: top-10 */
    refs.top = h('tbody');
    wrap.appendChild(h('section', { class: 'tk-card tk-card--sage hb-a-top' },
      h('header', { class: 'tk-card__head tk-card__head--sage' }, h('h2', { class: 'tk-card__title' }, h('b', null, 'Top-10'), ' cele mai constante obiceiuri')),
      h('table', { class: 'tk-table tk-table--dense tk-rank hb-top-t' },
        h('thead', null, h('tr', null, h('th', { scope: 'col' }, '#'), h('th', { scope: 'col' }, 'Obicei'), h('th', { scope: 'col', class: 'num' }, 'Procent'))),
        refs.top)));

    /* ------ actualizare live */
    function update() {
      var s = monthStats(st, c.ym, c.today);
      var ratio = TK.ratio(s.total, s.max);
      var pctTxt = F.pct(ratio, 1);
      var frac = s.total + ' / ' + s.max;

      refs.kpi.textContent = pctTxt;
      TK.charts.donut(refs.kpiDonut, { value: ratio, top: 'Obiceiuri', main: frac, mainColor: 'var(--ink-2)', size: 116, thickness: 11, label: 'Progres lunar: ' + frac + ' bifate (' + pctTxt + ')' });
      refs.progSub.textContent = frac;

      TK.charts.bars(refs.bars, {
        labels: days.map(function (dm) { return String(dm.d); }),
        series: [{ name: 'Progres zilnic', values: s.dayRatio.map(function (v) { return v || 0; }) }],
        height: 132, axis: false, yMax: 1,
        format: function (v) { return F.pct(v, 0); },
        // sub fiecare bară procentul zilei (doar când e loc: ~20 px pe zi)
        // sub fiecare bară procentul zilei, fără „%” (titlul spune deja „%”), doar când e loc
        sublabels: s.hs.length && refs.bars.clientWidth >= c.n * 19 ? s.dayRatio.map(function (v) { return v == null ? '' : String(Math.round(v * 100)); }) : null,
        colorFn: function (v) { return v >= 1 ? 'var(--chart-plan)' : 'var(--chart-fact)'; },
        tipTitle: function (i) {
          return ' ' + MONTHS_LOWER[c.m] + ', ' + D.WEEKDAYS[days[i].wd].toLowerCase() +
            (s.dayRatio[i] == null ? ' · ' + (days[i].future ? 'zi viitoare' : 'fără obiceiuri') : ' · ' + s.perDay[i] + ' / ' + s.eligible[i]);
        },
        label: 'Progres zilnic în ' + D.MONTHS[c.m].toLowerCase() + ', procent de obiceiuri bifate pe zi',
      });

      refs.rows.forEach(function (r, i) {
        var cnt = s.perHabit[i], den = s.denHabit[i], full = s.fullHabit[i];
        var p = TK.ratio(cnt, den), goal = r.hb.goal;
        var met = goal ? cnt >= goal : den > 0 && cnt >= den;
        r.pct.textContent = pct0(p);
        r.pct.classList.toggle('is-full', p >= 1);
        r.bar.style.setProperty('--p', (p * 100).toFixed(1) + '%');
        // reperul obiectivului = ritmul necesar (obiectiv / zilele lunii în care contează obiceiul)
        if (goal && full) r.bar.style.setProperty('--g', (Math.min(1, goal / full) * 100).toFixed(1) + '%');
        else r.bar.style.removeProperty('--g');
        r.bar.classList.toggle('has-goal', !!goal);
        r.bar.classList.toggle('tk-progress--sage', met);
        r.bar.classList.toggle('tk-progress--rose', !met);
        r.bar.setAttribute('aria-valuenow', String(Math.round(p * 100)));
        r.bar.title = goal ? (met ? 'Obiectiv atins: ' : 'Obiectiv: ') + goal + ' zile' : 'Fără obiectiv';
        r.cnt.textContent = cnt + ' / ' + den;
        r.cnt.title = den < s.n ? den + ' zile care contează până acum din ' + s.n : '';
      });

      TK.charts.donut(refs.sumDonut, { value: ratio, top: 'Progres', main: F.pct(ratio, 1), size: 96, thickness: 10 });
      refs.sumCount.textContent = frac;
      var el = s.lastDay;
      refs.sum.pct.textContent = pctTxt;
      refs.sum.done.textContent = String(s.total);
      refs.sum.left.textContent = String(s.max - s.total);
      refs.sum.total.textContent = String(s.max);
      refs.sum.avg.textContent = el && s.max ? F.num(s.total / el, 1) + ' / ' + F.num(s.max / el, s.max % el ? 1 : 0) : '—';
      refs.sum.goals.textContent = s.goalsSet ? s.goalsMet + ' / ' + s.goalsSet : '—';

      TK.charts.area(refs.area, {
        labels: days.map(function (dm) { return String(dm.d); }),
        values: s.dayRatio,
        max: 1, height: 118, axisLabels: false,
        tips: days.map(function (dm, i) { return dm.d + ' ' + MONTHS_LOWER[c.m] + '\n' + (s.dayRatio[i] != null ? pct0(s.dayRatio[i]) + ' · ' + s.perDay[i] + ' / ' + s.eligible[i] : dm.future ? 'zi viitoare' : 'fără obiceiuri'); }),
        label: 'Dinamica procentului zilnic în ' + D.MONTHS[c.m].toLowerCase(),
      });
      days.forEach(function (dm, i) {
        // zilele viitoare (și cele fără obiceiuri) rămân goale: nu intră la numitor
        var k = s.perDay[i], t = s.eligible[i];
        refs.dyn.pct[i].textContent = t ? String(Math.round(k / t * 100)) : '—';
        refs.dyn.pct[i].className = dayCellClass(dm) + ' hb-dpct' + (t && k >= t ? ' is-full' : '');
        refs.dyn.chk[i].textContent = t ? String(k) : '';
        refs.dyn.un[i].textContent = t ? String(t - k) : '';
        refs.dyn.tot[i].textContent = t ? String(t) : '';
      });

      TK.clear(refs.top);
      for (var r = 0; r < 10; r++) {
        var idx = s.order[r];
        if (idx == null) {
          refs.top.appendChild(h('tr', { class: 'is-empty' }, h('td', null, String(r + 1)), h('td'), h('td')));
          continue;
        }
        var p = s.rate[idx];
        refs.top.appendChild(h('tr', null,
          h('td', null, String(r + 1)),
          h('td', { class: 'hb-top-name', title: s.hs[idx].name }, s.hs[idx].name),
          h('td', { class: 'num' }, h('span', { class: 'tk-pct' + (p >= 1 ? ' is-full' : '') }, pct0(p)))));
      }
    }
    update();
  }

  /* mutare prin tragere de numărul din lista „Obiceiuri zilnice” */
  function moveHabit(c, hb, ref, after, refocus) {
    var arr = c.st.habits;
    if (hb === ref) return;
    var from = arr.indexOf(hb);
    if (from === -1 || arr.indexOf(ref) === -1) return;
    arr.splice(from, 1);
    arr.splice(arr.indexOf(ref) + (after ? 1 : 0), 0, hb);
    c.api.commit();
    c.rerender();
    if (refocus) {
      var el = document.getElementById('hb-name-' + hb.id);
      if (el) el.focus();
    }
  }

  function startDrag(e, c, hb, grip) {
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    var row = grip.closest('tr');
    var body = row.parentNode;
    var ghost = h('div', { class: 'hb-ghost' }, hb.name);
    document.body.appendChild(ghost);
    row.classList.add('is-dragging');
    var marked = null, target = null;
    function place(x, y) { ghost.style.left = (x + 12) + 'px'; ghost.style.top = (y - 14) + 'px'; }
    function clearMark() { if (marked) marked.classList.remove('is-drop-before', 'is-drop-after'); marked = null; }
    function move(ev) {
      if (ev.clientY < 60) window.scrollBy(0, -14);
      else if (ev.clientY > window.innerHeight - 60) window.scrollBy(0, 14);
      place(ev.clientX, ev.clientY);
      clearMark();
      target = null;
      var el = document.elementFromPoint(ev.clientX, ev.clientY);
      var tr = el && el.closest ? el.closest('tr') : null;
      if (!tr || tr.parentNode !== body) return;
      var onAdd = tr.classList.contains('hb-addrow');
      if (onAdd) tr = tr.previousElementSibling;
      if (!tr || !tr.dataset.h) return;
      var ref = c.st.habits.filter(function (x) { return x.id === tr.dataset.h; })[0];
      if (!ref) return;
      var r = tr.getBoundingClientRect();
      var after = onAdd || ev.clientY > r.top + r.height / 2;
      target = { ref: ref, after: after };
      marked = tr;
      tr.classList.add(after ? 'is-drop-after' : 'is-drop-before');
    }
    function end(ev) {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', end);
      document.removeEventListener('pointercancel', end);
      ghost.remove();
      row.classList.remove('is-dragging');
      clearMark();
      if (ev.type === 'pointercancel' || !target) return;
      moveHabit(c, hb, target.ref, target.after);
    }
    place(e.clientX, e.clientY);
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', end);
    document.addEventListener('pointercancel', end);
  }

  function removeHabit(c, hb) {
    var st = c.st, api = c.api;
    var hasPast = (hb.createdAt || '').slice(0, 7) < c.ym;
    var monthName = D.MONTHS[c.m].toLowerCase() + ' ' + c.y;
    function purge() {
      st.habits = st.habits.filter(function (x) { return x !== hb; });
      Object.keys(st.checks).forEach(function (k) {
        delete st.checks[k][hb.id];
        if (!Object.keys(st.checks[k]).length) delete st.checks[k];
      });
      api.commit();
      c.rerender();
      TK.ui.toast('Obiceiul „' + hb.name + '” a fost șters.');
    }
    var actions = [{ label: 'Anulează', kind: 'ghost' }, { label: 'Șterge definitiv', kind: 'danger', onClick: purge }];
    if (hasPast) {
      actions.push({
        label: 'Oprește din ' + monthName, kind: 'primary', onClick: function () {
          hb.archivedYm = c.ym;
          Object.keys(st.checks).forEach(function (k) {
            if (k >= c.ym && st.checks[k][hb.id]) {
              delete st.checks[k][hb.id];
              if (!Object.keys(st.checks[k]).length) delete st.checks[k];
            }
          });
          api.commit();
          c.rerender();
          TK.ui.toast('„' + hb.name + '” nu mai apare din ' + monthName + '. Lunile trecute rămân neschimbate.');
        },
      });
    }
    TK.ui.modal({
      title: 'Elimini obiceiul „' + hb.name + '”?',
      content: hasPast
        ? 'Poți opri obiceiul începând cu ' + monthName + ' și păstra istoricul lunilor trecute, sau îl poți șterge definitiv împreună cu toate bifele.'
        : 'Obiceiul și bifele lui vor fi șterse.',
      actions: actions,
    });
  }

  /* ------------------------------------------------------------ liste (săptămânal / lunar) */

  // Rândul unei acțiuni dintr-o listă: bifă + text + ștergere.
  function itemRow(prefix, it, onToggle, onDelete) {
    var id = prefix + '-' + it.id;
    return h('li', { class: 'hb-item' + (it.done ? ' is-done' : ''), dataset: { id: it.id } },
      h('label', { class: 'tk-check-label', for: id },
        h('input', {
          type: 'checkbox', class: 'tk-check', id: id, checked: !!it.done,
          onchange: function (e) {
            it.done = e.target.checked;
            e.target.closest('.hb-item').classList.toggle('is-done', it.done);
            onToggle();
          },
        }),
        h('span', { class: 'tk-check-label__text' }, it.text)),
      h('button', { type: 'button', class: 'tk-icon-btn hb-del', id: id + '-del', 'aria-label': 'Șterge „' + it.text + '”', title: 'Șterge', onclick: onDelete }, '×'));
  }

  function addForm(id, placeholder, max, count, onAdd) {
    var full = count >= max;
    var input = h('input', {
      class: 'tk-cell-input', id: id, maxlength: 80, autocomplete: 'off',
      placeholder: full ? 'Lista e plină (' + max + ')' : placeholder, disabled: full, 'aria-label': placeholder.replace(/^\+\s*/, '').replace(/…$/, ''),
    });
    return h('li', { class: 'hb-item hb-item--add' }, h('form', {
      class: 'hb-add',
      onsubmit: function (e) {
        e.preventDefault();
        var v = input.value.trim();
        if (!v) { input.focus(); return; }
        onAdd(v);
      },
    }, input, h('button', { type: 'submit', class: 'tk-icon-btn', id: id + '-btn', 'aria-label': 'Adaugă', title: 'Adaugă', disabled: full }, '+')));
  }

  // Adaugă în `dst` textele din `src` care lipsesc (nebifate). -> câte au fost adăugate
  function mergeList(dst, src, max) {
    var have = {};
    dst.forEach(function (it) { have[it.text.toLowerCase()] = 1; });
    var added = 0;
    src.forEach(function (it) {
      if (dst.length >= max || have[it.text.toLowerCase()]) return;
      dst.push({ id: uid('i'), text: it.text, done: false });
      have[it.text.toLowerCase()] = 1;
      added++;
    });
    return added;
  }

  function statsCard(title, bold, donutTop, selector) {
    var refs = {};
    refs.donut = h('div', { class: 'hb-list-donut' });
    refs.pct = h('td', { class: 'num' });
    refs.done = h('td', { class: 'num' });
    refs.left = h('td', { class: 'num' });
    refs.total = h('td', { class: 'num' });
    refs.el = h('section', { class: 'tk-card hb-stats' },
      h('header', { class: 'tk-card__head' }, h('h2', { class: 'tk-card__title' }, title + ' ', h('b', null, bold))),
      selector || null,
      h('div', { class: 'tk-card__body hb-stats__chart' }, refs.donut),
      h('table', { class: 'tk-table tk-table--dense' },
        h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Indicator'), h('th', { scope: 'col', class: 'num' }, 'Cantitate'))),
        h('tbody', null,
          h('tr', null, h('td', null, '% completate'), refs.pct),
          h('tr', null, h('td', null, 'Completate'), refs.done),
          h('tr', null, h('td', null, 'Necompletate'), refs.left),
          h('tr', null, h('td', null, 'Total obiceiuri'), refs.total))));
    refs.set = function (ls) {
      TK.charts.donut(refs.donut, { value: ls.ratio, top: donutTop, main: F.pct(ls.ratio, 1), size: 150, thickness: 20, label: donutTop + ': ' + ls.done + ' din ' + ls.total + ' completate' });
      refs.pct.textContent = F.pct(ls.ratio, 1);
      refs.done.textContent = String(ls.done);
      refs.left.textContent = String(ls.total - ls.done);
      refs.total.textContent = String(ls.total);
    };
    return refs;
  }

  /* ------------------------------------------------------------ vederea Săptămânal */

  function renderWeekly(root, c) {
    var st = c.st, api = c.api;
    var weeks = D.chunkWeeks(c.y, c.m);
    var sel = api.prefs.get('week', 'all');
    if (sel !== 'all' && !(sel >= 0 && sel < weeks.length)) sel = 'all';

    function list(wi, create) {
      var arr = st.weekly[c.ym];
      if (!arr && create) arr = st.weekly[c.ym] = weeks.map(function () { return []; });
      if (!arr) return [];
      while (create && arr.length < weeks.length) arr.push([]);
      if (!arr[wi] && create) arr[wi] = [];
      return arr[wi] || [];
    }
    function prevList(wi) {
      if (wi > 0) return list(wi - 1);
      var pym = shiftYm(c.ym, -1), arr = st.weekly[pym];
      return (arr && arr[arr.length - 1]) || [];
    }
    function selection() {
      return sel === 'all' ? weeks.map(function (_, i) { return i; }) : [sel];
    }

    var selEl = h('select', {
      id: 'hb-week-sel', class: 'tk-cell-input',
      onchange: function () { sel = selEl.value === 'all' ? 'all' : +selEl.value; api.prefs.set('week', sel); c.rerender(); },
    }, h('option', { value: 'all', selected: sel === 'all' }, 'Toate'),
      weeks.map(function (w, i) { return h('option', { value: String(i), selected: sel === i }, 'Săptămâna ' + (i + 1) + ' · ' + weekRange(w, c.m)); }));
    var stats = statsCard('Obiceiuri', 'săptămânale', 'Săptămânal',
      h('div', { class: 'tk-kv hb-week-kv' }, h('label', { class: 'tk-kv__k', for: 'hb-week-sel' }, 'Alege săptămâna'), h('span', { class: 'tk-kv__v' }, selEl)));

    function updateStats() {
      var all = [];
      selection().forEach(function (wi) { all = all.concat(list(wi)); });
      stats.set(listStats(all));
    }

    var cols = h('div', { class: 'hb-weeks' + (sel === 'all' ? '' : ' is-single') });
    var colEls = {};
    function buildCol(wi) {
      var w = weeks[wi], items = list(wi);
      var ls = listStats(items);
      var pctEl = h('span', { class: 'tk-pct' }, F.pct(ls.ratio, 0));
      var bar = h('span', { class: 'tk-progress tk-progress--bar tk-progress--sage hb-wbar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(Math.round(ls.ratio * 100)), 'aria-label': 'Progres săptămâna ' + (wi + 1), style: { '--p': (ls.ratio * 100).toFixed(1) + '%' } });
      var foot = h('b', null, ls.done + ' / ' + ls.total);
      function refresh() {
        var l2 = listStats(list(wi));
        pctEl.textContent = F.pct(l2.ratio, 0);
        pctEl.classList.toggle('is-full', l2.total > 0 && l2.ratio >= 1);
        bar.style.setProperty('--p', (l2.ratio * 100).toFixed(1) + '%');
        bar.setAttribute('aria-valuenow', String(Math.round(l2.ratio * 100)));
        foot.textContent = l2.done + ' / ' + l2.total;
        updateStats();
      }
      function rebuild(focusAdd) {
        var fresh = buildCol(wi);
        colEls[wi].replaceWith(fresh);
        colEls[wi] = fresh;
        updateStats();
        if (focusAdd) { var a = document.getElementById('hb-wadd-' + wi); if (a) a.focus(); }
      }
      var ul = h('ul', { class: 'hb-items', 'aria-label': 'Lista săptămânii ' + (wi + 1) });
      items.forEach(function (it) {
        ul.appendChild(itemRow('hb-w' + wi, it, function () { api.commit(); refresh(); }, function () {
          var arr = list(wi, true);
          arr.splice(arr.indexOf(it), 1);
          api.commit();
          rebuild(false);
          TK.ui.toast('„' + it.text + '” a fost șters.');
        }));
      });
      ul.appendChild(addForm('hb-wadd-' + wi, '+ Adaugă…', MAX_WEEKLY, items.length, function (v) {
        list(wi, true).push({ id: uid('i'), text: v, done: false });
        api.commit();
        rebuild(true);
      }));
      for (var k = items.length + 1; k < 8; k++) ul.appendChild(h('li', { class: 'hb-item hb-item--empty', 'aria-hidden': 'true' }));
      pctEl.classList.toggle('is-full', ls.total > 0 && ls.ratio >= 1);

      return h('section', { class: 'tk-card hb-week', 'aria-label': 'Săptămâna ' + (wi + 1) },
        h('header', { class: 'tk-card__head hb-week__head' },
          h('h2', { class: 'tk-card__title' }, h('b', null, 'Săptămâna ' + (wi + 1)), h('span', { class: 'hb-week__range' }, weekRange(w, c.m)))),
        h('div', { class: 'hb-week__pct' }, pctEl, bar),
        ul,
        h('div', { class: 'hb-week__tools' },
          h('button', {
            type: 'button', class: 'tk-btn tk-btn--sm tk-btn--ghost', id: 'hb-wcopy-' + wi,
            title: 'Copiază lista din săptămâna anterioară (nebifată)',
            onclick: function () {
              var src = prevList(wi);
              if (!src.length) { TK.ui.toast('Săptămâna anterioară nu are nicio listă.'); return; }
              var n = mergeList(list(wi, true), src, MAX_WEEKLY);
              api.commit();
              rebuild(false);
              TK.ui.toast(n ? 'Am copiat ' + n + (n === 1 ? ' acțiune.' : ' acțiuni.') : 'Lista conține deja tot din săptămâna anterioară.');
            },
          }, '↺ Copiază lista din săptămâna anterioară'),
          h('button', {
            type: 'button', class: 'tk-btn tk-btn--sm tk-btn--ghost', id: 'hb-wall-' + wi,
            title: 'Aplică lista acestei săptămâni la toate săptămânile lunii (nebifată)',
            onclick: function () {
              var src = list(wi);
              if (!src.length) { TK.ui.toast('Lista acestei săptămâni e goală.'); return; }
              var n = 0;
              weeks.forEach(function (_, j) { if (j !== wi) n += mergeList(list(j, true), src, MAX_WEEKLY); });
              api.commit();
              c.rerender();
              TK.ui.toast(n ? 'Lista a fost aplicată tuturor săptămânilor.' : 'Toate săptămânile au deja aceste acțiuni.');
            },
          }, '⇉ Aplică lista la toate săptămânile')),
        h('footer', { class: 'tk-card__foot' }, h('span', null, 'Total obiceiuri'), foot));
    }
    selection().forEach(function (wi) {
      colEls[wi] = buildCol(wi);
      cols.appendChild(colEls[wi]);
    });

    root.appendChild(h('div', { class: 'hb-lists' },
      h('div', { class: 'hb-lists__side' }, buildHeader(c, 'Obiceiuri săptămânale'), stats.el),
      h('div', { class: 'hb-lists__main' }, cols)));
    updateStats();
  }

  /* ------------------------------------------------------------ vederea Lunar */

  function renderMonthly(root, c) {
    var st = c.st, api = c.api;
    function list(create) {
      if (!st.monthly[c.ym] && create) st.monthly[c.ym] = [];
      return st.monthly[c.ym] || [];
    }
    var stats = statsCard('Obiceiuri', 'lunare', 'Lunar');
    var main = h('div', { class: 'hb-month-wrap' });

    function build() {
      var items = list();
      var ls = listStats(items);
      var pctEl = h('span', { class: 'tk-pct' + (ls.total && ls.ratio >= 1 ? ' is-full' : '') }, F.pct(ls.ratio, 0));
      var bar = h('span', { class: 'tk-progress tk-progress--bar tk-progress--sage hb-wbar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(Math.round(ls.ratio * 100)), 'aria-label': 'Progres lunar', style: { '--p': (ls.ratio * 100).toFixed(1) + '%' } });
      var foot = h('b', null, ls.done + ' / ' + ls.total);
      function refresh() {
        var l2 = listStats(list());
        pctEl.textContent = F.pct(l2.ratio, 0);
        pctEl.classList.toggle('is-full', l2.total > 0 && l2.ratio >= 1);
        bar.style.setProperty('--p', (l2.ratio * 100).toFixed(1) + '%');
        bar.setAttribute('aria-valuenow', String(Math.round(l2.ratio * 100)));
        foot.textContent = l2.done + ' / ' + l2.total;
        stats.set(l2);
      }
      function rebuild(focusAdd) {
        TK.clear(main);
        main.appendChild(build());
        stats.set(listStats(list()));
        if (focusAdd) { var a = document.getElementById('hb-madd'); if (a) a.focus(); }
      }
      var ul = h('ul', { class: 'hb-items hb-items--month', 'aria-label': 'Acțiunile lunii' });
      items.forEach(function (it) {
        ul.appendChild(itemRow('hb-m', it, function () { api.commit(); refresh(); }, function () {
          var arr = list(true);
          arr.splice(arr.indexOf(it), 1);
          api.commit();
          rebuild(false);
          TK.ui.toast('„' + it.text + '” a fost șters.');
        }));
      });
      if (items.length < MAX_MONTHLY) {
        ul.appendChild(addForm('hb-madd', '+ Adaugă o acțiune a lunii…', MAX_MONTHLY, items.length, function (v) {
          list(true).push({ id: uid('i'), text: v, done: false });
          api.commit();
          rebuild(true);
        }));
      }
      for (var k = items.length + 1; k < MAX_MONTHLY; k++) ul.appendChild(h('li', { class: 'hb-item hb-item--empty', 'aria-hidden': 'true' }));

      return h('section', { class: 'tk-card hb-month', 'aria-label': 'Acțiunile lunii' },
        h('header', { class: 'tk-card__head' }, h('h2', { class: 'tk-card__title' }, h('b', null, D.MONTHS_SHORT[c.m] + ' ' + c.y), ' · până la ' + MAX_MONTHLY + ' acțiuni')),
        h('div', { class: 'hb-week__pct' }, pctEl, bar),
        ul,
        h('div', { class: 'hb-week__tools' },
          h('button', {
            type: 'button', class: 'tk-btn tk-btn--sm tk-btn--ghost', id: 'hb-mcopy',
            onclick: function () {
              var src = st.monthly[shiftYm(c.ym, -1)] || [];
              if (!src.length) { TK.ui.toast('Luna anterioară nu are nicio listă.'); return; }
              var n = mergeList(list(true), src, MAX_MONTHLY);
              api.commit();
              rebuild(false);
              TK.ui.toast(n ? 'Am copiat ' + n + (n === 1 ? ' acțiune.' : ' acțiuni.') : 'Lista conține deja tot din luna anterioară.');
            },
          }, '↺ Copiază din luna anterioară')),
        h('footer', { class: 'tk-card__foot' }, h('span', null, 'Total obiceiuri'), foot));
    }
    main.appendChild(build());
    root.appendChild(h('div', { class: 'hb-lists' },
      h('div', { class: 'hb-lists__side' }, buildHeader(c, 'Obiceiuri lunare'), stats.el),
      h('div', { class: 'hb-lists__main' }, main)));
    stats.set(listStats(list()));
  }

  /* ------------------------------------------------------------ înregistrare */

  var DEF = {
    id: 'habits',
    slug: 'obiceiuri',
    name: 'Tracker de obiceiuri',
    short: 'Obiceiuri',
    tone: 'sage',
    tagline: 'Bifezi ce ai făcut, iar procentele, graficele și topul se calculează singure.',
    version: 1,
    createDemo: createDemo,
    createEmpty: createEmpty,
    migrate: normalize,
    summary: summary,
    mount: mount,
  };

  TK.register(DEF);

  // expus pentru teste
  TK._habits = { monthStats: monthStats, listStats: listStats, createDemo: createDemo, normalize: normalize, createdAtFor: createdAtFor };
})();
