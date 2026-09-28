/*
 * Tracker financiar — venituri, cheltuieli, facturi, datorii și economii (plan vs fapt).
 *
 * Forma stării (JSON simplu):
 * {
 *   categories: { venit: [nume…], cheltuiala: […], factura: […], datorie: […], economie: […] },
 *                 // ordinea = ordinea de afișare; culoarea din grafice = indexul în listă
 *   transactions: [{ id, date: 'YYYY-MM-DD', type: 'venit'|'cheltuiala'|'factura'|'datorie'|'economie',
 *                    category, amount (număr pozitiv), note, auto? }],   // auto: plată introdusă în coloana „Achitat”
 *   plans: { 'YYYY-MM': { venit: {categorie: sumă}, cheltuiala: {…}, factura: {…}, datorie: {…}, economie: {…} } },
 *   bills: { [categorie factură]: { dueDay } },            // TERMEN = ziua din lună
 *   debts: { [categorie datorie]: { dueDay, total } },      // total = suma inițială a creditului (opțional)
 *   goals: { [categorie economie]: { target } },            // ținta de acumulat
 *   openingBalance: număr,                                   // soldul dinaintea primei luni
 *   noPlan: { [tip]: true },                                 // tabele fără coloana „Plan” (doar „Achitat”)
 *   noPlanCats: { [tip]: { [categorie]: true } },            // categorii fără plan (sumă fixă): Plan „—”, needitabil
 *   notes: { 'YYYY': 'text' }                                // notițele din rezumatul anual
 * }
 * „Sold reportat” al unei luni = openingBalance + (venituri − toate ieșirile) din toate lunile anterioare.
 * „Acumulat” la economii = suma tuturor tranzacțiilor „economie” ale categoriei până la sfârșitul lunii văzute.
 * Luna / anul selectate și filtrele stau în api.prefs (nu în stare).
 */
(function () {
  'use strict';

  var TK = window.TK;
  var h = TK.h;
  var fmt = TK.fmt;
  var D = TK.date;

  var TYPES = ['venit', 'cheltuiala', 'factura', 'datorie', 'economie'];
  var OUT = ['cheltuiala', 'factura', 'datorie', 'economie'];
  var LABEL = { venit: 'Venit', cheltuiala: 'Cheltuială', factura: 'Factură', datorie: 'Datorie', economie: 'Economie' };
  var PLURAL = { venit: 'Venituri', cheltuiala: 'Cheltuieli', factura: 'Facturi', datorie: 'Datorii', economie: 'Economii' };
  var TONE = { venit: 'good', cheltuiala: 'rose', factura: 'terra', datorie: 'gold', economie: 'blue' };
  // mod procent: 'out' = mai puțin e mai bine (depășirea e marcată), 'in' = mai mult e mai bine
  var MODE = { venit: 'in', cheltuiala: 'out', factura: 'out', datorie: 'out', economie: 'in' };
  var PALETTE = [
    'var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)',
    'var(--chart-5)', 'var(--chart-6)', 'var(--chart-7)', 'var(--chart-8)',
  ];
  // eticheta coloanei cu suma realizată: la venituri „Încasat”, la restul „Achitat”
  var PAID_LABEL = { venit: 'Încasat', cheltuiala: 'Achitat', factura: 'Achitat', datorie: 'Achitat', economie: 'Achitat' };
  var FLOW_COLOR = { cheltuiala: 'var(--chart-fact)', factura: 'var(--chart-3)', datorie: 'var(--chart-6)', economie: 'var(--chart-1)', ramas: 'var(--chart-4)' };
  var MONTHS = D.MONTHS;

  /* ------------------------------------------------------------ utilitare */

  function r2(n) { return Math.round((+n || 0) * 100) / 100; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymOf(y, m) { return y + '-' + pad(m + 1); }
  function ymParts(ym) { return { y: +ym.slice(0, 4), m: +ym.slice(5, 7) - 1 }; }
  function addMonths(ym, n) {
    var p = ymParts(ym);
    var t = p.y * 12 + p.m + n;
    return ymOf(Math.floor(t / 12), ((t % 12) + 12) % 12);
  }
  function isYm(v) { return typeof v === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(v); }
  function todayYm() { return D.ym(D.today()); }
  function sumObj(o) {
    var s = 0;
    if (o) for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) s += +o[k] || 0;
    return s;
  }
  function money(v) { return v ? fmt.num(v) : '—'; }
  function periodText(ym) {
    var p = ymParts(ym);
    return fmt.date(D.make(p.y, p.m, 1)) + ' – ' + fmt.date(D.make(p.y, p.m, D.daysInMonth(p.y, p.m)));
  }

  /* ---------------------------------------------------------- agregare */

  function emptyBucket() {
    var b = { tot: {}, n: 0 };
    TYPES.forEach(function (t) { b[t] = {}; b.tot[t] = 0; });
    return b;
  }

  // Parcurge o singură dată tranzacțiile: ym -> {tip: {categorie: sumă}, tot: {tip: sumă}}
  function buildIndex(state) {
    var months = {};
    var list = state.transactions || [];
    for (var i = 0; i < list.length; i++) {
      var t = list[i];
      if (!t || !t.date || TYPES.indexOf(t.type) === -1) continue;
      var ym = t.date.slice(0, 7);
      var b = months[ym] || (months[ym] = emptyBucket());
      var a = +t.amount || 0;
      b[t.type][t.category] = (b[t.type][t.category] || 0) + a;
      b.tot[t.type] += a;
      b.n++;
    }
    var keys = Object.keys(months).sort();
    var run = +state.openingBalance || 0;
    var before = {}; // ym -> sold la începutul lunii (doar pt lunile cu date)
    keys.forEach(function (k) {
      before[k] = run;
      run += netOf(months[k].tot);
    });
    return { months: months, keys: keys, before: before, end: run, opening: +state.openingBalance || 0 };
  }

  function netOf(tot) {
    return tot.venit - tot.cheltuiala - tot.factura - tot.datorie - tot.economie;
  }

  function openingFor(idx, ym) {
    var s = idx.opening;
    for (var i = 0; i < idx.keys.length; i++) {
      var k = idx.keys[i];
      if (k >= ym) break;
      s += netOf(idx.months[k].tot);
    }
    return s;
  }

  function monthModel(state, idx, ym) {
    var b = idx.months[ym] || emptyBucket();
    var p = (state.plans || {})[ym] || {};
    var m = { ym: ym, fact: {}, plan: {}, planTot: {}, factTot: {}, n: b.n };
    TYPES.forEach(function (t) {
      m.fact[t] = b[t];
      m.plan[t] = p[t] || {};
      m.planTot[t] = sumObj(p[t]);
      m.factTot[t] = b.tot[t];
    });
    m.factOut = m.factTot.cheltuiala + m.factTot.factura + m.factTot.datorie + m.factTot.economie;
    m.planOut = m.planTot.cheltuiala + m.planTot.factura + m.planTot.datorie + m.planTot.economie;
    m.opening = openingFor(idx, ym);
    m.closing = m.opening + m.factTot.venit - m.factOut;
    m.planClosing = m.opening + m.planTot.venit - m.planOut;
    m.hasPlan = TYPES.some(function (t) { return Object.keys(m.plan[t]).length > 0; });
    return m;
  }

  function yearModel(state, idx, y) {
    var Y = { y: y, months: [], plan: {}, fact: {}, planCat: {}, factCat: {} };
    TYPES.forEach(function (t) { Y.plan[t] = 0; Y.fact[t] = 0; Y.planCat[t] = {}; Y.factCat[t] = {}; });
    for (var m = 0; m < 12; m++) {
      var mm = monthModel(state, idx, ymOf(y, m));
      Y.months.push(mm);
      TYPES.forEach(function (t) {
        Y.plan[t] += mm.planTot[t];
        Y.fact[t] += mm.factTot[t];
        var k;
        for (k in mm.plan[t]) Y.planCat[t][k] = (Y.planCat[t][k] || 0) + (+mm.plan[t][k] || 0);
        for (k in mm.fact[t]) Y.factCat[t][k] = (Y.factCat[t][k] || 0) + mm.fact[t][k];
      });
    }
    Y.planOut = Y.plan.cheltuiala + Y.plan.factura + Y.plan.datorie + Y.plan.economie;
    Y.factOut = Y.fact.cheltuiala + Y.fact.factura + Y.fact.datorie + Y.fact.economie;
    Y.opening = Y.months[0].opening;
    Y.closing = Y.opening + Y.fact.venit - Y.factOut;
    Y.planClosing = Y.opening + Y.plan.venit - Y.planOut;
    return Y;
  }

  // sumă cumulată pe categorie (până la o dată inclusiv), pentru economii / datorii
  function cumulative(state, type, cat, untilIso) {
    var s = 0, list = state.transactions;
    for (var i = 0; i < list.length; i++) {
      var t = list[i];
      if (t.type === type && t.category === cat && t.date <= untilIso) s += +t.amount || 0;
    }
    return s;
  }

  /* ---------------------------------------------------------- demo & gol */

  var DEFAULT_CATS = {
    venit: ['Salariu', 'Afacere', 'Proiecte extra', 'Dobânzi la depozit'],
    cheltuiala: ['Alimente', 'Transport', 'Casă', 'Îmbrăcăminte', 'Sănătate', 'Îngrijire personală', 'Educație', 'Cadouri',
      'Animale de companie', 'Restaurante și cafenele', 'Distracție', 'Dezvoltare personală'],
    factura: ['Internet', 'Electricitate', 'Apă', 'Telefonie mobilă', 'Gaz', 'Încălzire'],
    datorie: ['Credit de consum', 'Ipotecă', 'Credit auto'],
    economie: ['Vacanță', 'Nuntă', 'Mașină', 'Acțiuni', 'Criptomonede', 'Renovare apartament', 'MacBook'],
  };
  var DEFAULT_BILLS = { 'Internet': 3, 'Telefonie mobilă': 8, 'Electricitate': 10, 'Apă': 12, 'Gaz': 15, 'Încălzire': 18 };
  var DEFAULT_DEBTS = { 'Credit de consum': { dueDay: 1, total: 36000 }, 'Ipotecă': { dueDay: 10, total: 900000 }, 'Credit auto': { dueDay: 15, total: 120000 } };
  var DEFAULT_GOALS = { 'Vacanță': 15000, 'Nuntă': 20000, 'Mașină': 15000, 'Acțiuni': 10000, 'Criptomonede': 5000, 'Renovare apartament': 40000, 'MacBook': 30000 };

  function baseState() {
    var s = {
      categories: TK.clone(DEFAULT_CATS),
      transactions: [],
      plans: {},
      bills: {},
      debts: {},
      goals: {},
      openingBalance: 0,
      notes: {},
    };
    Object.keys(DEFAULT_BILLS).forEach(function (k) { s.bills[k] = { dueDay: DEFAULT_BILLS[k] }; });
    Object.keys(DEFAULT_DEBTS).forEach(function (k) { s.debts[k] = { dueDay: DEFAULT_DEBTS[k].dueDay, total: 0 }; });
    Object.keys(DEFAULT_GOALS).forEach(function (k) { s.goals[k] = { target: 0 }; });
    return s;
  }

  function createEmpty() { return baseState(); }

  function mulberry32(seed) {
    return function () {
      seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function createDemo() {
    var s = baseState();
    var today = D.today();
    var Y = D.year(today), CM = D.month(today), TD = D.day(today);
    var rnd = mulberry32(20260101 + Y);
    function rr(a, b, step) { step = step || 1; return Math.round((a + rnd() * (b - a)) / step) * step; }
    function pick(arr) { return arr[Math.floor(rnd() * arr.length)]; }
    var seq = 0;
    var tx = [];

    Object.keys(DEFAULT_DEBTS).forEach(function (k) { s.debts[k] = TK.clone(DEFAULT_DEBTS[k]); });
    Object.keys(DEFAULT_GOALS).forEach(function (k) { s.goals[k] = { target: DEFAULT_GOALS[k] }; });
    s.openingBalance = 18500;
    s.notes[String(Y)] = 'Obiectiv: fond de urgență de 3 salarii până în decembrie.\nDin octombrie: +500 lei lunar la „Renovare apartament”.\nVerifică tarifele la gaz înainte de sezonul rece.';

    var cold = [0, 1, 2, 10, 11];
    var saved = {};
    Object.keys(DEFAULT_GOALS).forEach(function (k) { saved[k] = 0; });

    for (var m = 0; m <= CM; m++) {
      var dim = D.daysInMonth(Y, m);
      var limit = m === CM ? TD : dim;
      var add = function (day, type, cat, amount, note) {
        day = Math.max(1, Math.min(dim, day));
        if (day > limit || !(amount > 0)) return;
        seq++;
        tx.push({ id: 'd' + seq.toString(36), date: D.make(Y, m, day), type: type, category: cat, amount: r2(amount), note: note || '' });
      };
      var isCold = cold.indexOf(m) !== -1;

      // venituri
      add(5, 'venit', 'Salariu', m >= 6 ? 23500 : 22000, 'Salariu net');
      add(20, 'venit', 'Afacere', rr(6000, 9000, 100), 'Încasări magazin online');
      if (rnd() < 0.55) add(rr(12, 25), 'venit', 'Proiecte extra', rr(2500, 6000, 100), pick(['Proiect freelance', 'Traduceri', 'Consultanță']));
      add(28, 'venit', 'Dobânzi la depozit', rr(280, 330, 0.01), 'Dobândă depozit la termen');

      // facturi
      add(3, 'factura', 'Internet', 250, 'Abonament internet');
      add(8, 'factura', 'Telefonie mobilă', rnd() < 0.3 ? 165 : 150, 'Abonament mobil');
      add(10, 'factura', 'Electricitate', isCold ? rr(640, 760, 0.01) : rr(480, 620, 0.01), 'Energie electrică');
      add(12, 'factura', 'Apă', rr(215, 285, 0.01), 'Apă și canalizare');
      add(15, 'factura', 'Gaz', isCold ? rr(900, 1500, 0.01) : (m === 3 || m === 9 ? rr(380, 600, 0.01) : rr(150, 250, 0.01)), 'Gaze naturale');
      if (isCold) add(18, 'factura', 'Încălzire', rr(1800, 2600, 0.01), 'Agent termic');
      else if (m === 3) add(18, 'factura', 'Încălzire', rr(800, 1000, 0.01), 'Agent termic');

      // datorii
      add(1, 'datorie', 'Credit de consum', 3000, 'Rată lunară');
      add(10, 'datorie', 'Ipotecă', 7500, 'Rată ipotecă');
      add(15, 'datorie', 'Credit auto', 4000, 'Rată credit auto');

      // economii (se opresc când ținta e atinsă)
      var saveTo = function (day, cat, amount, note) {
        var left = DEFAULT_GOALS[cat] - saved[cat];
        var a = Math.min(amount, left);
        if (a <= 0 || day > limit) return;
        saved[cat] += a;
        add(day, 'economie', cat, a, note);
      };
      saveTo(6, 'Vacanță', 2000, 'Pușculița de vacanță');
      saveTo(6, 'Nuntă', 1500, 'Cont economii nuntă');
      saveTo(21, 'Mașină', 1000, 'Avans mașină');
      if (rnd() < 0.6) saveTo(21, 'Acțiuni', 1000, 'ETF global');
      if (rnd() < 0.4) saveTo(25, 'Criptomonede', 500, 'Cumpărare lunară');
      if (m % 2 === 0) saveTo(6, 'Renovare apartament', 1000, 'Fond renovare');
      saveTo(25, 'MacBook', 800, 'Pentru laptop nou');

      // cheltuieli
      var n, i;
      n = 7 + Math.floor(rnd() * 3);
      for (i = 0; i < n; i++) add(rr(1, dim), 'cheltuiala', 'Alimente', rr(180, 520, 0.1), pick(['Supermarket', 'Piața Centrală', 'Brutărie', 'Cumpărături săptămânale', 'Fructe și legume']));
      for (i = 0; i < 4; i++) add(rr(1, dim), 'cheltuiala', 'Transport', rr(100, 350, 1), pick(['Carburant', 'Taxi', 'Parcare', 'Carburant', 'Spălătorie auto']));
      n = 1 + (rnd() < 0.5 ? 1 : 0);
      for (i = 0; i < n; i++) add(rr(1, dim), 'cheltuiala', 'Casă', rr(150, 900, 1), pick(['Detergenți și consumabile', 'Veselă', 'Reparație robinet', 'Lenjerie de pat']));
      if (rnd() < 0.55) add(rr(1, dim), 'cheltuiala', 'Îmbrăcăminte', rr(400, 1600, 10), pick(['Încălțăminte', 'Geacă', 'Haine copii', 'Blugi']));
      if (rnd() < 0.6) add(rr(1, dim), 'cheltuiala', 'Sănătate', rr(150, 700, 1), pick(['Farmacie', 'Analize', 'Stomatolog', 'Vitamine']));
      add(rr(1, dim), 'cheltuiala', 'Îngrijire personală', rr(200, 450, 10), pick(['Frizerie', 'Cosmetice', 'Manichiură']));
      if (rnd() < 0.5) add(rr(1, dim), 'cheltuiala', 'Educație', rr(250, 600, 10), pick(['Cărți', 'Curs online', 'Rechizite']));
      if (rnd() < 0.45 || m === 2) add(rr(1, dim), 'cheltuiala', 'Cadouri', rr(200, 800, 10), pick(['Cadou zi de naștere', 'Flori', 'Cadou nuntă prieteni']));
      add(rr(1, dim), 'cheltuiala', 'Animale de companie', rr(180, 450, 1), pick(['Hrană pisică', 'Veterinar', 'Nisip și accesorii']));
      for (i = 0; i < 3; i++) add(rr(1, dim), 'cheltuiala', 'Restaurante și cafenele', rr(120, 450, 1), pick(['Cafenea', 'Cină în oraș', 'Prânz de afaceri', 'Pizza acasă']));
      n = 1 + (rnd() < 0.5 ? 1 : 0);
      for (i = 0; i < n; i++) add(rr(1, dim), 'cheltuiala', 'Distracție', rr(100, 400, 10), pick(['Cinema', 'Concert', 'Bowling', 'Teatru']));
      add(rr(1, dim), 'cheltuiala', 'Dezvoltare personală', rr(250, 700, 10), pick(['Sală de sport', 'Abonament aplicație', 'Atelier fotografie']));
    }

    tx.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    s.transactions = tx;

    // planuri pentru toate lunile anului
    for (var pm = 0; pm < 12; pm++) {
      var c = cold.indexOf(pm) !== -1;
      s.plans[ymOf(Y, pm)] = {
        venit: { 'Salariu': pm >= 6 ? 23500 : 22000, 'Afacere': 7000, 'Proiecte extra': 3000, 'Dobânzi la depozit': 300 },
        cheltuiala: {
          'Alimente': 3000, 'Transport': 900, 'Casă': 700, 'Îmbrăcăminte': 600, 'Sănătate': 400, 'Îngrijire personală': 350,
          'Educație': 300, 'Cadouri': pm === 11 ? 1500 : 300, 'Animale de companie': 300, 'Restaurante și cafenele': 500,
          'Distracție': 400, 'Dezvoltare personală': 500,
        },
        factura: {
          'Internet': 250, 'Electricitate': c ? 700 : 600, 'Apă': 250, 'Telefonie mobilă': 150,
          'Gaz': c ? 1000 : (pm === 3 || pm === 9 ? 500 : 200), 'Încălzire': c ? 2200 : (pm === 3 ? 900 : 0),
        },
        datorie: { 'Credit de consum': 3000, 'Ipotecă': 7500, 'Credit auto': 4000 },
        economie: { 'Vacanță': 2000, 'Nuntă': 1500, 'Mașină': 1000, 'Acțiuni': 700, 'Criptomonede': 300, 'Renovare apartament': 500, 'MacBook': 800 },
      };
      // ținta de vacanță (15 000) se atinge după 7,5 luni de câte 2 000 → din a 9-a lună nu mai e planificată
      if (pm >= 8) delete s.plans[ymOf(Y, pm)].economie['Vacanță'];
      if (!s.plans[ymOf(Y, pm)].factura['Încălzire']) delete s.plans[ymOf(Y, pm)].factura['Încălzire'];
    }
    return s;
  }

  // Curăță datele (inclusiv cele importate): nu trebuie să blocheze niciodată trackerul.
  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function validIso(v) {
    if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
    var y = +v.slice(0, 4), m = +v.slice(5, 7), d = +v.slice(8, 10);
    return y >= 1900 && y <= 2200 && m >= 1 && m <= 12 && d >= 1 && d <= D.daysInMonth(y, m - 1);
  }
  function catName(v) {
    if (typeof v !== 'string' && typeof v !== 'number') return '';
    return String(v).trim().replace(/\s+/g, ' ').slice(0, 120);
  }
  function posNum(v) { var n = r2(+v); return isFinite(n) && n > 0 ? n : null; }

  function migrate(s) {
    if (!isObj(s)) {
      var meta = s && typeof s === 'object' && isObj(s.meta) ? s.meta : null;
      s = {};
      if (meta) s.meta = meta;
    }
    var base = baseState();
    // categorii: liste de nume unice, nevide
    var hadCats = isObj(s.categories);
    var cats = {};
    TYPES.forEach(function (t) {
      var src = hadCats && Array.isArray(s.categories[t]) ? s.categories[t] : (hadCats ? [] : base.categories[t]);
      var out = [];
      src.forEach(function (c) { c = catName(c); if (c && out.indexOf(c) === -1) out.push(c); });
      cats[t] = out;
    });
    s.categories = cats;
    function ensureCat(t, c) { if (cats[t].indexOf(c) === -1) cats[t].push(c); }

    // tranzacții: dată ISO validă, tip cunoscut, sumă pozitivă
    var seen = {};
    s.transactions = (Array.isArray(s.transactions) ? s.transactions : []).filter(function (t) {
      return isObj(t) && validIso(t.date) && TYPES.indexOf(t.type) !== -1 && posNum(t.amount) != null;
    }).map(function (t) {
      var c = catName(t.category) || 'Fără categorie';
      ensureCat(t.type, c);
      var id = typeof t.id === 'string' && t.id && !seen[t.id] ? t.id : TK.uid() + Object.keys(seen).length.toString(36);
      seen[id] = true;
      var out = { id: id, date: t.date, type: t.type, category: c, amount: posNum(t.amount), note: typeof t.note === 'string' ? t.note.slice(0, 500) : '' };
      if (t.auto === true) out.auto = true;
      return out;
    });

    // planuri: {'YYYY-MM': {tip: {categorie: sumă > 0}}}
    var plans = {};
    if (isObj(s.plans)) {
      Object.keys(s.plans).forEach(function (ym) {
        var p = s.plans[ym];
        if (!isYm(ym) || !isObj(p)) return;
        var outP = {};
        TYPES.forEach(function (t) {
          if (!isObj(p[t])) return;
          var o = {};
          Object.keys(p[t]).forEach(function (k) {
            var c = catName(k), v = posNum(p[t][k]);
            if (c && v != null) { o[c] = v; ensureCat(t, c); }
          });
          if (Object.keys(o).length) outP[t] = o;
        });
        if (Object.keys(outP).length) plans[ym] = outP;
      });
    }
    s.plans = plans;

    function day(v) { var n = +v; return isFinite(n) && n >= 1 && n <= 31 && n % 1 === 0 ? n : null; }
    function nonNeg(v) { var n = +v; return isFinite(n) && n > 0 ? r2(n) : 0; }
    function cleanMap(src, type, fn) {
      var out = {};
      if (isObj(src)) Object.keys(src).forEach(function (k) {
        var c = catName(k);
        if (c && cats[type].indexOf(c) !== -1) out[c] = fn(isObj(src[k]) ? src[k] : {});
      });
      return out;
    }
    s.bills = cleanMap(s.bills, 'factura', function (o) { return { dueDay: day(o.dueDay) }; });
    s.debts = cleanMap(s.debts, 'datorie', function (o) { return { dueDay: day(o.dueDay), total: nonNeg(o.total) }; });
    s.goals = cleanMap(s.goals, 'economie', function (o) { return { target: nonNeg(o.target) }; });

    var notes = {};
    if (isObj(s.notes)) Object.keys(s.notes).forEach(function (k) {
      if (/^\d{4}$/.test(k) && typeof s.notes[k] === 'string') notes[k] = s.notes[k];
    });
    s.notes = notes;
    var ob = +s.openingBalance;
    s.openingBalance = isFinite(ob) ? r2(ob) : 0;
    var np = {};
    if (isObj(s.noPlan)) TYPES.forEach(function (t) { if (s.noPlan[t] === true) np[t] = true; });
    s.noPlan = np;
    var npc = {};
    if (isObj(s.noPlanCats)) TYPES.forEach(function (t) {
      if (!isObj(s.noPlanCats[t])) return;
      Object.keys(s.noPlanCats[t]).forEach(function (c) {
        if (s.noPlanCats[t][c] === true && cats[t].indexOf(c) !== -1) (npc[t] || (npc[t] = {}))[c] = true;
      });
    });
    s.noPlanCats = npc;
    return s;
  }

  function summary(state) {
    state = migrate(state);
    var idx = buildIndex(state);
    var m = monthModel(state, idx, todayYm());
    return [
      { label: 'Venituri', value: fmt.lei(m.factTot.venit) },
      { label: 'Cheltuieli + facturi', value: fmt.lei(m.factTot.cheltuiala + m.factTot.factura) },
      { label: 'Economii', value: fmt.lei(m.factTot.economie) },
      { label: 'Sold final', value: fmt.lei(m.closing) },
    ];
  }

  /* ----------------------------------------------------- piese de interfață */

  function pctSpan(fact, plan, mode) {
    if (!plan) return h('span', { class: 'tk-muted' }, '—');
    var r = fact / plan;
    var rr = Math.round(r * 10000);
    var cls = 'tk-pct';
    if (mode === 'out') {
      if (rr > 10000) cls += ' is-over';
      else if (rr === 10000) cls += ' is-full';
    } else if (rr >= 10000) cls += ' is-full';
    return h('span', { class: cls }, fmt.pct(r));
  }
  function curTd() { return h('td', { class: 'cur' }, 'lei'); }
  function numTd(v, cls) { return h('td', { class: 'num' + (cls ? ' ' + cls : '') }, money(v)); }
  function pctTd(fact, plan, mode) { return h('td', { class: 'num' }, pctSpan(fact, plan, mode)); }
  function th(text, cls, attrs) {
    var a = attrs || {};
    a.class = cls || null;
    a.scope = a.scope || 'col';
    return h('th', a, text);
  }
  function cardHead(title, tone, extra) {
    return h('header', { class: 'tk-card__head' + (tone ? ' tk-card__head--' + tone : '') },
      h('h2', { class: 'tk-card__title' }, title), extra || null);
  }
  function titleB(a, b) { return [a + ' ', h('b', null, b)]; }
  function emptyRows(n, cols) {
    var out = [];
    for (var i = 0; i < n; i++) {
      out.push(h('tr', { class: 'is-empty', 'aria-hidden': 'true' }, cols.map(function (c) {
        return h('td', { class: c === 'cur' ? 'cur' : c === 'num' ? 'num' : null }, c === 'cur' ? 'lei' : '');
      })));
    }
    return out;
  }
  // KPI: valoare de fapt, plan + procent și o bară de progres față de plan
  function kpi(label, fact, plan, mode) {
    var r = plan ? fact / plan : 0;
    var over = mode === 'out' && Math.round(r * 10000) > 10000;
    return h('div', { class: 'tk-kpi', role: 'listitem' },
      h('span', { class: 'tk-kpi__label' }, label),
      h('span', { class: 'tk-kpi__value' }, fmt.num(fact), h('span', { class: 'cur' }, 'lei')),
      h('span', { class: 'tk-kpi__hint' }, plan ? ['plan ' + fmt.num(plan) + ' · ', pctSpan(fact, plan, mode)] : 'fără plan'),
      plan ? h('span', {
        class: 'tk-progress ' + (over ? '' : mode === 'out' ? 'tk-progress--rose' : 'tk-progress--sage'),
        style: { '--p': Math.min(100, r * 100).toFixed(1) + '%' }, role: 'progressbar',
        'aria-valuenow': String(Math.round(r * 100)), 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-label': label + ' față de plan',
      }) : null);
  }

  // culori fixe pe entitate; la coliziune (mai multe entități decât culori) trece la următoarea liberă
  function assignColors(items) {
    var used = {};
    items.forEach(function (it) {
      if (it.color) return;
      var i = ((it.pref % PALETTE.length) + PALETTE.length) % PALETTE.length, n = 0;
      while (used[i] && n < PALETTE.length) { i = (i + 1) % PALETTE.length; n++; }
      used[i] = true;
      it.color = PALETTE[i];
    });
    return items;
  }
  function topWithOther(items, n) {
    var sorted = items.filter(function (d) { return d.value > 0; }).sort(function (a, b) { return b.value - a.value; });
    if (sorted.length <= n + 1) return assignColors(sorted);
    var head = assignColors(sorted.slice(0, n));
    var rest = TK.sum(sorted.slice(n), function (d) { return d.value; });
    head.push({ label: 'Altele', value: rest, color: 'var(--chart-track)' });
    return head;
  }

  function captureFocus() {
    var a = document.activeElement;
    if (!a || !a.id) return null;
    var all = false;
    try { all = a.selectionStart === 0 && a.selectionEnd === String(a.value || '').length && a.value !== ''; } catch (e) { /* select */ }
    return { id: a.id, all: all };
  }
  function restoreFocus(f, scope) {
    if (!f) return;
    var el = document.getElementById(f.id);
    if (!el || (scope && !scope.contains(el)) || el === document.activeElement) return;
    try {
      el.focus({ preventScroll: true });
      if (f.all && el.select && document.activeElement === el) el.select();
    } catch (e) { /* ignorăm */ }
  }

  // grafic cu bare orizontale Plan vs Fapt; fără valori → mesaj în loc de axă goală
  function flowBars(box, labels, plan, fact, label) {
    if (!plan.some(Boolean) && !fact.some(Boolean)) {
      TK.clear(box);
      box.appendChild(h('p', { class: 'fin-nodata' }, 'Fără date încă. Adaugă un plan sau o tranzacție.'));
      return;
    }
    TK.charts.hbars(box, {
      labels: labels,
      series: [
        { name: 'Plan', values: plan, color: 'var(--chart-plan)' },
        { name: 'Achitat', values: fact, color: 'var(--chart-fact)' },
      ],
      format: fmt.lei, label: label,
    });
  }

  function chartCard(title, draw, charts, cls) {
    var box = h('div', { class: 'fin-chart' });
    charts.push(function () { draw(box); });
    return h('article', { class: 'tk-card fin-chart-card' + (cls ? ' ' + cls : '') },
      h('div', { class: 'tk-card__body' }, h('h3', { class: 'tk-chart__title' }, title), box));
  }

  /* ----------------------------------------------------------- montare */

  function mount(el, api) {
    var S = function () { return api.state; };
    migrate(api.state);
    fixPrefs();
    var cleanups = [];

    // Preferințe de filtrare care nu mai corespund datelor (categorie redenumită / ștearsă, import) → resetate.
    function fixPrefs() {
      var s = S();
      var f = api.prefs.get('txf', null);
      if (f != null) {
        if (!isObj(f)) f = {};
        var nf = {
          month: f.month === 'all' || isYm(f.month) ? f.month : undefined,
          type: TYPES.indexOf(f.type) !== -1 ? f.type : '',
          cat: '',
          q: typeof f.q === 'string' ? f.q : '',
        };
        if (typeof f.cat === 'string' && f.cat) {
          var cut = f.cat.indexOf('|');
          var ct = f.cat.slice(0, cut), cn = f.cat.slice(cut + 1);
          if (cut > 0 && TYPES.indexOf(ct) !== -1 && s.categories[ct].indexOf(cn) !== -1 && (!nf.type || nf.type === ct)) nf.cat = f.cat;
        }
        if (JSON.stringify(nf) !== JSON.stringify(f)) api.prefs.set('txf', nf);
      }
      var at = api.prefs.get('addType', 'cheltuiala');
      if (TYPES.indexOf(at) === -1) { at = 'cheltuiala'; api.prefs.set('addType', at); }
      var ac = api.prefs.get('addCat', '');
      if (ac && s.categories[at].indexOf(ac) === -1) api.prefs.set('addCat', '');
    }
    // Ține preferințele în pas cu redenumirea / ștergerea unei categorii.
    function prefsCategoryChanged(type, oldN, newN) {
      var f = api.prefs.get('txf', null);
      if (isObj(f) && f.cat === type + '|' + oldN) { f.cat = newN ? type + '|' + newN : ''; api.prefs.set('txf', f); }
      if (api.prefs.get('addType', '') === type && api.prefs.get('addCat', '') === oldN) api.prefs.set('addCat', newN || '');
    }

    function getYm() {
      var v = api.prefs.get('ym', null);
      return isYm(v) ? v : todayYm();
    }
    function setYm(v) { api.prefs.set('ym', v); }
    function getYear() {
      var v = api.prefs.get('year', null);
      return typeof v === 'number' && v > 1990 && v < 2200 ? v : D.year(D.today());
    }

    function yearsRange() {
      var cy = D.year(D.today()), lo = cy - 1, hi = cy + 1;
      S().transactions.forEach(function (t) { var y = +t.date.slice(0, 4); if (y < lo) lo = y; if (y > hi) hi = y; });
      Object.keys(S().plans).forEach(function (k) { var y = +k.slice(0, 4); if (y < lo) lo = y; if (y > hi) hi = y; });
      var out = [];
      for (var y = lo; y <= hi; y++) out.push(y);
      return out;
    }

    /* ---- tabs ---- */
    var TABS = [['', 'Luna'], ['tranzactii', 'Tranzacții'], ['trackere', 'Facturi, datorii, economii'], ['anual', 'Rezumat anual'], ['setari', 'Setări']];
    var route = api.route;
    if (!TABS.some(function (t) { return t[0] === route; })) route = '';
    el.appendChild(h('nav', { class: 'fin-tabs', 'aria-label': 'Secțiuni tracker financiar' },
      h('div', { class: 'tk-tabs', role: 'tablist' }, TABS.map(function (t) {
        var on = t[0] === route;
        return h('button', {
          type: 'button', role: 'tab', id: 'fin-tab-' + (t[0] || 'luna'),
          class: 'tk-tab' + (on ? ' is-active' : ''), 'aria-selected': on ? 'true' : 'false',
          onclick: function () { if (!on) api.go(t[0]); },
        }, t[1]);
      }))));
    var body = h('div', { class: 'fin-view' });
    el.appendChild(body);

    /* ---- categorii: redenumire / ștergere / editare (Setări și direct din tabele) ---- */
    function usage(type, cat) {
      var s = S(), n = 0, sum = 0, months = 0;
      s.transactions.forEach(function (t) { if (t.type === type && t.category === cat) { n++; sum += +t.amount || 0; } });
      Object.keys(s.plans).forEach(function (k) { var p = s.plans[k][type]; if (p && p[cat]) months++; });
      return { n: n, sum: sum, months: months };
    }
    function extraMap(type) { return type === 'factura' ? 'bills' : type === 'datorie' ? 'debts' : type === 'economie' ? 'goals' : null; }

    function isNoPlanCat(type, cat) { return !!(S().noPlanCats[type] || {})[cat]; }
    function setNoPlanCat(type, cat, on) {
      var s = S();
      var m = s.noPlanCats[type] || (s.noPlanCats[type] = {});
      if (on) m[cat] = true; else delete m[cat];
      if (!Object.keys(m).length) delete s.noPlanCats[type];
    }
    function rename(type, oldN, newN) {
      var s = S();
      if (isNoPlanCat(type, oldN)) { setNoPlanCat(type, oldN, false); setNoPlanCat(type, newN, true); }
      var cats = s.categories[type];
      cats[cats.indexOf(oldN)] = newN;
      s.transactions.forEach(function (t) { if (t.type === type && t.category === oldN) t.category = newN; });
      Object.keys(s.plans).forEach(function (k) {
        var p = s.plans[k][type];
        if (p && Object.prototype.hasOwnProperty.call(p, oldN)) { p[newN] = p[oldN]; delete p[oldN]; }
      });
      var mk = extraMap(type);
      if (mk && s[mk][oldN]) { s[mk][newN] = s[mk][oldN]; delete s[mk][oldN]; }
      prefsCategoryChanged(type, oldN, newN);
      api.commit();
    }
    function remove(type, cat) {
      var s = S();
      setNoPlanCat(type, cat, false);
      s.categories[type] = s.categories[type].filter(function (c) { return c !== cat; });
      s.transactions = s.transactions.filter(function (t) { return !(t.type === type && t.category === cat); });
      Object.keys(s.plans).forEach(function (k) {
        var p = s.plans[k];
        if (p[type]) { delete p[type][cat]; if (!Object.keys(p[type]).length) delete p[type]; }
        if (!Object.keys(p).length) delete s.plans[k];
      });
      var mk = extraMap(type);
      if (mk) delete s[mk][cat];
      prefsCategoryChanged(type, cat, null);
      api.commit();
    }

    function askRemove(type, cat, after) {
      var u = usage(type, cat);
      if (!u.n && !u.months) {
        remove(type, cat);
        TK.ui.toast('Categoria „' + cat + '” a fost ștearsă.');
        if (after) after();
        return;
      }
      var parts = [];
      if (u.n) parts.push(u.n + (u.n === 1 ? ' tranzacție' : ' tranzacții') + ' în valoare de ' + fmt.lei(u.sum));
      if (u.months) parts.push('sume planificate în ' + u.months + (u.months === 1 ? ' lună' : ' luni'));
      TK.ui.confirm({
        title: 'Ștergi categoria „' + cat + '”?',
        text: 'Categoria are ' + parts.join(' și ') + '. Dacă o ștergi, se șterg și acestea, iar totalurile lunilor respective vor scădea. Ca să le păstrezi, redenumește categoria în loc s-o ștergi.',
        ok: 'Șterge categoria și datele ei', danger: true,
      }).then(function (yes) {
        if (!yes) return;
        remove(type, cat);
        TK.ui.toast('Categoria „' + cat + '” și datele ei au fost șterse.');
        if (after) after();
      });
    }

    var NOUN = { venit: 'sursă de venit', cheltuiala: 'categorie', factura: 'factură', datorie: 'credit', economie: 'obiectiv' };

    // Formular pentru o categorie: nouă (cat = null) sau existentă. ym = luna pentru câmpul „Plan”.
    function categoryForm(type, cat, ym, after) {
      var s = S();
      var mk = extraMap(type);
      var ex = cat && mk ? (s[mk][cat] || {}) : {};
      var plan = cat && ym ? +(((s.plans[ym] || {})[type] || {})[cat]) || null : null;
      var p = ym ? ymParts(ym) : null;
      var fields = [{ name: 'name', label: 'Nume', type: 'text', value: cat || '', required: true, placeholder: type === 'factura' ? 'ex. Televiziune' : '' }];
      if (type === 'factura' || type === 'datorie') fields.push({ name: 'due', label: 'Termen (ziua din lună)', type: 'number', value: ex.dueDay || null, placeholder: '1–31' });
      if (type === 'datorie') fields.push({ name: 'total', label: 'Total credit (lei)', type: 'money', value: ex.total || null, hint: 'Opțional: pentru „Rămas de plătit”.' });
      if (type === 'economie') fields.push({ name: 'target', label: 'Țintă (lei)', type: 'money', value: ex.target || null });
      var showPlan = !!p && !s.noPlan[type];
      if (showPlan) {
        fields.push({ name: 'noPlanCat', label: 'Fără plan (sumă fixă): completez doar „' + PAID_LABEL[type] + '”', type: 'checkbox', value: cat ? isNoPlanCat(type, cat) : false });
        fields.push({ name: 'plan', label: 'Plan pentru ' + fmt.monthYear(p.y, p.m).toLowerCase() + ' (lei)', type: 'money', value: plan });
        fields.push({ name: 'allMonths', label: 'Același plan în toate lunile din ' + p.y, type: 'checkbox', value: !cat });
      }
      TK.ui.form({
        title: cat ? 'Editează „' + cat + '”' : 'Adaugă ' + NOUN[type],
        fields: fields,
        submit: cat ? 'Salvează' : 'Adaugă',
        onDelete: !!cat,
        deleteLabel: 'Șterge',
        validate: function (v) {
          var name = v.name.replace(/\s+/g, ' ');
          if (name !== cat && S().categories[type].indexOf(name) !== -1) return 'Există deja „' + name + '”.';
          if (v.due != null && (v.due < 1 || v.due > 31 || v.due % 1)) return 'Termenul este o zi din lună, de la 1 la 31.';
          if ((v.total != null && v.total < 0) || (v.target != null && v.target < 0) || (v.plan != null && v.plan < 0)) return 'Sumele nu pot fi negative.';
          return null;
        },
      }).then(function (v) {
        if (!v) return;
        if (v.__delete) { askRemove(type, cat, after); return; }
        var name = v.name.replace(/\s+/g, ' ');
        var s2 = S();
        if (!cat) s2.categories[type].push(name);
        else if (name !== cat) rename(type, cat, name);
        if (mk) {
          var e = s2[mk][name] || (s2[mk][name] = {});
          if (type === 'factura' || type === 'datorie') e.dueDay = v.due || null;
          if (type === 'datorie') e.total = v.total ? r2(v.total) : 0;
          if (type === 'economie') e.target = v.target ? r2(v.target) : 0;
        }
        if (showPlan && v.noPlanCat) {
          // fără plan: ștergem planurile categoriei din toate lunile
          setNoPlanCat(type, name, true);
          Object.keys(s2.plans).forEach(function (k) { setPlanRaw(k, type, name, null); });
          api.commit();
        } else if (showPlan && v.allMonths) {
          setNoPlanCat(type, name, false);
          for (var mm = 0; mm < 12; mm++) setPlanRaw(ymOf(p.y, mm), type, name, v.plan);
          api.commit();
        } else if (showPlan) {
          setNoPlanCat(type, name, false);
          setPlan(ym, type, name, v.plan);
        } else api.commit();
        TK.ui.toast(cat ? '„' + name + '” a fost salvat.' : '„' + name + '” a fost adăugat.');
        if (after) after();
      });
    }

    // Celula cu numele categoriei: un clic deschide editarea.
    function catCell(type, cat, ym, after) {
      var grip = h('span', { class: 'fin-drag', title: 'Trage ca să muți', 'aria-hidden': 'true', dataset: { type: type, cat: cat } });
      grip.addEventListener('pointerdown', function (e) { startDrag(e, grip, type, cat, after); });
      return h('td', { class: 'fin-cat', title: cat },
        h('span', { class: 'fin-cat-in' }, grip,
          h('button', { type: 'button', class: 'fin-cat-btn', 'aria-label': 'Editează ' + cat, onclick: function () { categoryForm(type, cat, ym, after); } }, cat)));
    }

    /* ---- mutare prin tragere: sus / jos în același tabel sau în alt tabel (alt tip) ---- */
    function startDrag(e, grip, type, cat, after) {
      if (e.button != null && e.button !== 0) return;
      e.preventDefault();
      var row = grip.closest('tr');
      var ghost = h('div', { class: 'fin-ghost' }, cat);
      document.body.appendChild(ghost);
      row.classList.add('is-dragging');
      var marked = null, target = null;
      function place(x, y) { ghost.style.left = (x + 12) + 'px'; ghost.style.top = (y - 14) + 'px'; }
      function clearMark() { if (marked) marked.classList.remove('is-drop-before', 'is-drop-after', 'is-drop-end'); marked = null; }
      function find(x, y) {
        var el = document.elementFromPoint(x, y);
        var tr = el && el.closest ? el.closest('tr') : null;
        var tb = el && el.closest ? el.closest('tbody[data-ftype]') : null;
        if (!tb) return null;
        var g = tr && tr.querySelector('.fin-drag');
        if (g) {
          var r = tr.getBoundingClientRect();
          return { type: tb.dataset.ftype, before: g.dataset.cat, after: y > r.top + r.height / 2, el: tr };
        }
        return { type: tb.dataset.ftype, before: null, el: tr || tb };
      }
      function move(ev) {
        // derulare automată lângă marginile ecranului
        if (ev.clientY < 60) window.scrollBy(0, -14);
        else if (ev.clientY > window.innerHeight - 60) window.scrollBy(0, 14);
        place(ev.clientX, ev.clientY);
        clearMark();
        target = find(ev.clientX, ev.clientY);
        if (target && target.el) {
          marked = target.el;
          marked.classList.add(target.before ? (target.after ? 'is-drop-after' : 'is-drop-before') : 'is-drop-end');
        }
      }
      function end(ev) {
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', end);
        document.removeEventListener('pointercancel', end);
        ghost.remove();
        row.classList.remove('is-dragging');
        clearMark();
        if (ev.type === 'pointercancel' || !target) return;
        dropCategory(type, cat, target, after);
      }
      place(e.clientX, e.clientY);
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', end);
      document.addEventListener('pointercancel', end);
    }

    function dropCategory(type, cat, t, after) {
      var s = S();
      var to = t.type;
      if (TYPES.indexOf(to) === -1) return;
      if (to === type) {
        var arr = s.categories[type];
        var from = arr.indexOf(cat);
        if (from === -1 || t.before === cat) return;
        arr.splice(from, 1);
        var at = t.before ? arr.indexOf(t.before) + (t.after ? 1 : 0) : arr.length;
        arr.splice(at, 0, cat);
        api.commit();
        if (after) after();
        return;
      }
      if (s.categories[to].indexOf(cat) !== -1) {
        TK.ui.toast('În ' + PLURAL[to] + ' există deja „' + cat + '”.');
        return;
      }
      var u = usage(type, cat);
      var doMove = function () {
        var s2 = S();
        s2.categories[type] = s2.categories[type].filter(function (c) { return c !== cat; });
        var arr2 = s2.categories[to];
        var at2 = t.before ? arr2.indexOf(t.before) + (t.after ? 1 : 0) : arr2.length;
        arr2.splice(Math.max(0, at2), 0, cat);
        s2.transactions.forEach(function (x) { if (x.type === type && x.category === cat) { x.type = to; delete x.auto; } });
        Object.keys(s2.plans).forEach(function (k) {
          var p = s2.plans[k];
          if (p[type] && Object.prototype.hasOwnProperty.call(p[type], cat)) {
            (p[to] || (p[to] = {}))[cat] = p[type][cat];
            delete p[type][cat];
            if (!Object.keys(p[type]).length) delete p[type];
          }
        });
        var mFrom = extraMap(type), mTo = extraMap(to);
        var old = mFrom ? s2[mFrom][cat] : null;
        if (mFrom) delete s2[mFrom][cat];
        if (mTo && !s2[mTo][cat]) {
          var due = old && old.dueDay ? old.dueDay : null;
          s2[mTo][cat] = to === 'factura' ? { dueDay: due } : to === 'datorie' ? { dueDay: due, total: 0 } : { target: 0 };
        }
        if (isNoPlanCat(type, cat)) { setNoPlanCat(type, cat, false); setNoPlanCat(to, cat, true); }
        prefsCategoryChanged(type, cat, null);
        api.commit();
        TK.ui.toast('„' + cat + '” a fost mutat în ' + PLURAL[to] + '.');
        if (after) after();
      };
      if (!u.n && !u.months) { doMove(); return; }
      var parts = [];
      if (u.n) parts.push(u.n + (u.n === 1 ? ' tranzacție' : ' tranzacții'));
      if (u.months) parts.push('planurile din ' + u.months + (u.months === 1 ? ' lună' : ' luni'));
      TK.ui.confirm({
        title: 'Muți „' + cat + '” în ' + PLURAL[to] + '?',
        text: 'Categoria trece din ' + PLURAL[type] + ' în ' + PLURAL[to] + ', împreună cu ' + parts.join(' și ') + '. Totalurile lunilor se recalculează.',
        ok: 'Mută în ' + PLURAL[to],
      }).then(function (yes) { if (yes) doMove(); });
    }
    // Comutator „Cu plan” pentru un tabel: fără plan rămâne doar coloana Achitat / Încasat.
    function planToggle(type, after, id) {
      var on = !S().noPlan[type];
      return h('label', { class: 'fin-plan-toggle', for: id, title: 'Afișează sau ascunde coloanele Plan și Progres' },
        h('input', {
          type: 'checkbox', class: 'tk-toggle', id: id, checked: on,
          onchange: function (e) {
            if (e.target.checked) delete S().noPlan[type]; else S().noPlan[type] = true;
            api.commit();
            if (after) after();
          },
        }),
        h('span', null, 'Cu plan'));
    }
    function addCatButton(type, ym, after, id) {
      return h('button', { type: 'button', class: 'tk-btn tk-btn--sm tk-btn--ghost fin-add-cat', id: id, onclick: function () { categoryForm(type, null, ym, after); } }, '+ Adaugă ' + NOUN[type]);
    }

    /* ---- plan editabil în celulă ---- */
    function setPlan(ym, type, cat, v) {
      setPlanRaw(ym, type, cat, v);
      api.commit();
    }
    function setPlanRaw(ym, type, cat, v) {
      var s = S();
      var p = s.plans[ym] || (s.plans[ym] = {});
      var pt = p[type] || (p[type] = {});
      if (v == null || v === 0) delete pt[cat];
      else pt[cat] = r2(v);
      if (!Object.keys(pt).length) delete p[type];
      if (!Object.keys(p).length) delete s.plans[ym];
    }
    // Totalul realizat fără categoriile fără plan (pentru procentul din rândul Total).
    function factWithPlan(m, type) {
      return TK.sum(S().categories[type], function (c) { return isNoPlanCat(type, c) ? 0 : (m.fact[type][c] || 0); });
    }
    function lockedPlanTd() {
      return h('td', { class: 'num fin-locked', title: 'Fără plan (sumă fixă). Se schimbă din fereastra categoriei.' }, '—');
    }
    function planInput(ym, type, cat, idx, where, rerender) {
      var cur = +(((S().plans[ym] || {})[type] || {})[cat]) || 0;
      var id = 'fin-plan-' + where + '-' + type + '-' + idx;
      var shown = cur ? fmt.num(cur) : '';
      var inp = h('input', {
        class: 'tk-cell-input', id: id, type: 'text', inputmode: 'decimal', autocomplete: 'off',
        value: shown, placeholder: '—', 'aria-label': 'Plan ' + cat + ' (lei)', dataset: { plan: where + '-' + type },
      });
      var done = false;
      function save(focusNext) {
        if (done) return;
        var raw = inp.value.trim();
        var v = fmt.parseNum(raw);
        if (raw !== '' && (v == null || v < 0)) {
          TK.ui.toast('Scrie o sumă validă, de exemplu 1 500,00.');
          inp.value = shown;
          return;
        }
        if ((v || 0) === cur) { inp.value = shown; if (focusNext) moveNext(); return; }
        done = true;
        var nextId = focusNext ? nextPlanId() : null;
        setPlan(ym, type, cat, v);
        setTimeout(function () {
          rerender();
          if (nextId) restoreFocus({ id: nextId, all: true });
        }, 0);
      }
      function nextPlanId() {
        var list = Array.prototype.slice.call(document.querySelectorAll('input[data-plan="' + where + '-' + type + '"]'));
        var i = list.indexOf(inp);
        return list[i + 1] ? list[i + 1].id : null;
      }
      function moveNext() {
        var id2 = nextPlanId();
        if (id2) restoreFocus({ id: id2, all: true }); else inp.blur();
      }
      inp.addEventListener('focus', function () {
        setTimeout(function () { if (document.activeElement === inp) { try { inp.select(); } catch (e) { /* */ } } }, 0);
      });
      inp.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); save(true); }
        else if (e.key === 'Escape') { inp.value = shown; inp.blur(); }
      });
      inp.addEventListener('change', function () { save(false); });
      return inp;
    }

    /* ---- „Achitat” editabil în celulă (facturi, datorii) ----
     * Suma scrisă devine totalul plătit în lună pentru categorie: plățile din Tranzacții rămân,
     * iar diferența e o singură plată „auto” (creată, modificată sau ștearsă aici). */
    function setPaid(ym, type, cat, x) {
      var s = S();
      var inMonth = s.transactions.filter(function (t) { return t.type === type && t.category === cat && t.date.slice(0, 7) === ym; });
      var manual = TK.sum(inMonth, function (t) { return t.auto ? 0 : +t.amount || 0; });
      var need = r2((x || 0) - manual);
      if (need < -0.004) {
        TK.ui.toast('Ai deja ' + fmt.lei(manual) + ' în Tranzacții pentru „' + cat + '” în această lună. Micșorează suma acolo.');
        return false;
      }
      s.transactions = s.transactions.filter(function (t) { return !(t.auto && inMonth.indexOf(t) !== -1); });
      if (need > 0.004) {
        s.transactions.push({ id: TK.uid(), date: payDate(type, cat, ym), type: type, category: cat, amount: need, note: PAID_LABEL[type] + ' din tracker', auto: true });
      }
      api.commit();
      return true;
    }
    // Adaugă o sumă peste ce e deja achitat în lună (o tranzacție nouă, vizibilă în Tranzacții).
    function addPayment(ym, type, cat, amount, date, note) {
      S().transactions.push({ id: TK.uid(), date: date || payDate(type, cat, ym), type: type, category: cat, amount: r2(amount), note: note || '' });
      api.commit();
    }
    // Fereastra „Sume”: lista sumelor unei categorii (editare / ștergere) + adăugarea uneia noi.
    // La economii lista cuprinde toate depunerile până la sfârșitul lunii (ca „Acumulat”).
    function amountsDialog(ym, type, cat, rerender) {
      var p = ymParts(ym);
      var monthEnd = D.make(p.y, p.m, D.daysInMonth(p.y, p.m));
      var cumulativeScope = type === 'economie';
      var list = S().transactions.filter(function (t) {
        if (t.type !== type || t.category !== cat) return false;
        return cumulativeScope ? t.date <= monthEnd : t.date.slice(0, 7) === ym;
      }).sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
      var total = TK.sum(list, function (t) { return +t.amount || 0; });
      var close;
      function reopen() { amountsDialog(ym, type, cat, rerender); }
      var rows = list.map(function (t) {
        return h('tr', null,
          h('td', { class: 'fin-date' }, fmt.dateShort(t.date)),
          h('td', { class: 'fin-am-note', title: t.note || '' }, t.note || h('span', { class: 'tk-muted' }, '—')),
          h('td', { class: 'num' }, fmt.num(t.amount)),
          h('td', { class: 'fin-actions' },
            h('button', { type: 'button', class: 'tk-icon-btn', id: 'fin-am-edit-' + t.id, 'aria-label': 'Modifică suma ' + fmt.lei(t.amount) + ' din ' + fmt.date(t.date), title: 'Modifică',
              onclick: function () { close(); txForm(t).then(function () { rerender(); reopen(); }); } }, '✎'),
            h('button', { type: 'button', class: 'tk-icon-btn fin-del', id: 'fin-am-del-' + t.id, 'aria-label': 'Șterge suma ' + fmt.lei(t.amount) + ' din ' + fmt.date(t.date), title: 'Șterge',
              onclick: function () {
                close();
                TK.ui.confirm({ title: 'Ștergi suma?', text: fmt.lei(t.amount) + ' din ' + fmt.date(t.date) + ' la „' + cat + '” va fi ștearsă.', ok: 'Șterge suma', danger: true })
                  .then(function (yes) {
                    if (yes) {
                      S().transactions = S().transactions.filter(function (x) { return x !== t; });
                      api.commit();
                      TK.ui.toast('Suma a fost ștearsă.');
                      rerender();
                    }
                    reopen();
                  });
              } }, '🗑')));
      });
      var amt = h('input', { class: 'tk-input num', id: 'fin-am-amount', type: 'text', inputmode: 'decimal', autocomplete: 'off', placeholder: '0,00' });
      var date = h('input', { class: 'tk-input', id: 'fin-am-date', type: 'date', value: payDate(type, cat, ym) });
      var note = h('input', { class: 'tk-input', id: 'fin-am-note', type: 'text', autocomplete: 'off', placeholder: 'opțional' });
      var err = h('p', { class: 'tk-form-error', role: 'alert', hidden: true });
      var form = h('form', { class: 'fin-am-add', novalidate: true },
        h('div', { class: 'tk-field' }, h('label', { class: 'tk-label', for: 'fin-am-amount' }, 'Sumă nouă (lei)'), amt),
        h('div', { class: 'tk-field' }, h('label', { class: 'tk-label', for: 'fin-am-date' }, 'Data'), date),
        h('div', { class: 'tk-field fin-am-notef' }, h('label', { class: 'tk-label', for: 'fin-am-note' }, 'Notă'), note),
        h('button', { type: 'submit', class: 'tk-btn tk-btn--primary', id: 'fin-am-submit' }, 'Adaugă'));
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var v = fmt.parseNum(amt.value);
        if (!(v > 0)) { err.textContent = 'Scrie o sumă mai mare decât zero.'; err.hidden = false; amt.focus(); return; }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date.value)) { err.textContent = 'Alege o dată validă.'; err.hidden = false; return; }
        addPayment(ym, type, cat, v, date.value, note.value.trim());
        TK.ui.toast('Am adăugat ' + fmt.lei(v) + ' la „' + cat + '”.');
        rerender();
        close();
        reopen();
      });
      var content = h('div', { class: 'tk-stack fin-am' },
        h('p', { class: 'tk-muted' }, (cumulativeScope ? 'Toate depunerile până la ' + fmt.date(monthEnd) : fmt.monthYear(p.y, p.m)) + ' · total ', h('b', null, fmt.lei(total))),
        list.length
          ? h('div', { class: 'tk-scroll fin-am-list' }, h('table', { class: 'tk-table tk-table--dense fin-table' },
              h('thead', null, h('tr', null, th('Data'), th('Notă'), th('Sumă', 'num'), th(h('span', { class: 'tk-sr' }, 'Acțiuni')))),
              h('tbody', null, rows)))
          : h('p', { class: 'tk-muted' }, 'Nicio sumă încă.'),
        form, err);
      var dlgTitle = { venit: 'Încasări', economie: 'Depuneri' }[type] || 'Plăți';
      close = TK.ui.modal({ title: dlgTitle + ' · ' + cat, content: content, actions: [{ label: 'Închide', kind: 'ghost' }] });
      setTimeout(function () { try { amt.focus(); } catch (e2) { /* */ } }, 0);
    }

    function paidInput(ym, type, cat, fact, idx, where, rerender) {
      var id = 'fin-paid-in-' + where + '-' + type + '-' + idx;
      var shown = fact ? fmt.num(fact) : '';
      var inp = h('input', {
        class: 'tk-cell-input', id: id, type: 'text', inputmode: 'decimal', autocomplete: 'off',
        value: shown, placeholder: '—', 'aria-label': PAID_LABEL[type] + ' ' + cat + ' (lei)',
        title: 'Scrie totalul sau +50 ca să adaugi 50 la suma existentă',
      });
      var done = false;
      function save() {
        if (done) return;
        var raw = inp.value.trim();
        // „+50” sau „+ 50” = adaugă peste suma existentă
        var plus = /^\+/.test(raw) ? fmt.parseNum(raw.slice(1)) : null;
        if (/^\+/.test(raw)) {
          if (!(plus > 0)) { TK.ui.toast('După „+” scrie suma de adăugat, de exemplu +50.'); inp.value = shown; return; }
          done = true;
          addPayment(ym, type, cat, plus);
          TK.ui.toast('Am adăugat ' + fmt.lei(plus) + ' la „' + cat + '”.');
          setTimeout(rerender, 0);
          return;
        }
        var v = fmt.parseNum(raw);
        if (raw !== '' && (v == null || v < 0)) {
          TK.ui.toast('Scrie o sumă validă, de exemplu 1 500,00.');
          inp.value = shown;
          return;
        }
        if (r2(v || 0) === r2(fact)) { inp.value = shown; return; }
        done = true;
        if (!setPaid(ym, type, cat, v)) { inp.value = shown; done = false; return; }
        setTimeout(rerender, 0);
      }
      inp.addEventListener('focus', function () {
        setTimeout(function () { if (document.activeElement === inp) { try { inp.select(); } catch (e) { /* */ } } }, 0);
      });
      inp.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); inp.blur(); }
        else if (e.key === 'Escape') { inp.value = shown; inp.blur(); }
      });
      inp.addEventListener('change', save);
      var plusBtn = h('button', {
        type: 'button', class: 'tk-icon-btn fin-plus', id: id + '-add', title: 'Sume: adaugă, modifică sau șterge', 'aria-label': 'Sumele pentru ' + cat,
        onclick: function () { amountsDialog(ym, type, cat, rerender); },
      }, '+');
      return h('span', { class: 'fin-paid-wrap' }, inp, plusBtn);
    }

    /* ---- resetarea unei luni: tranzacțiile și planul ei; categoriile, setările și celelalte luni rămân ---- */
    function resetMonth(ym, after) {
      var s = S();
      var p = ymParts(ym);
      var label = fmt.monthYear(p.y, p.m);
      var nTx = s.transactions.filter(function (t) { return t.date.slice(0, 7) === ym; }).length;
      var hasPlan = !!(s.plans[ym] && Object.keys(s.plans[ym]).some(function (t) { return Object.keys(s.plans[ym][t] || {}).length; }));
      if (!nTx && !hasPlan) { TK.ui.toast(label + ' este deja goală.'); return; }
      var parts = [];
      if (nTx) parts.push(nTx + (nTx === 1 ? ' tranzacție (sumă)' : ' tranzacții (sume)'));
      if (hasPlan) parts.push('planul lunii');
      TK.ui.confirm({
        title: 'Resetezi ' + label + '?',
        text: 'Se șterg ' + parts.join(' și ') + '. Categoriile, facturile, datoriile, țintele de economii și celelalte luni rămân neschimbate.',
        ok: 'Resetează luna',
        danger: true,
      }).then(function (yes) {
        if (!yes) return;
        s.transactions = s.transactions.filter(function (t) { return t.date.slice(0, 7) !== ym; });
        delete s.plans[ym];
        api.commit();
        after();
        TK.ui.toast(label + ' a fost resetată.');
      });
    }

    /* ---- selector de lună ---- */
    function monthPicker(ym, onChange, idp) {
      var p = ymParts(ym);
      var years = yearsRange();
      if (years.indexOf(p.y) === -1) years.push(p.y);
      var msel = h('select', { class: 'tk-cell-input', id: idp + '-m', 'aria-label': 'Luna' },
        MONTHS.map(function (n, i) { return h('option', { value: String(i), selected: i === p.m }, n); }));
      var ysel = h('select', { class: 'tk-cell-input', id: idp + '-y', 'aria-label': 'Anul' },
        years.map(function (y) { return h('option', { value: String(y), selected: y === p.y }, String(y)); }));
      msel.addEventListener('change', function () { onChange(ymOf(p.y, +msel.value)); });
      ysel.addEventListener('change', function () { onChange(ymOf(+ysel.value, p.m)); });
      return h('div', { class: 'fin-mpick' },
        h('button', { type: 'button', class: 'tk-icon-btn', id: idp + '-prev', 'aria-label': 'Luna anterioară', onclick: function () { onChange(addMonths(ym, -1)); } }, '‹'),
        msel, ysel,
        h('button', { type: 'button', class: 'tk-icon-btn', id: idp + '-next', 'aria-label': 'Luna următoare', onclick: function () { onChange(addMonths(ym, 1)); } }, '›'));
    }

    /* ---- formular tranzacție (adăugare / editare) ---- */
    function kindOptions() {
      var out = [];
      TYPES.forEach(function (t) {
        S().categories[t].forEach(function (c) { out.push({ value: t + '|' + c, label: LABEL[t] + ' · ' + c }); });
      });
      return out;
    }
    function defaultDateFor(ym) {
      var t = D.today();
      if (D.ym(t) === ym) return t;
      var p = ymParts(ym);
      return D.make(p.y, p.m, ym < D.ym(t) ? D.daysInMonth(p.y, p.m) : 1);
    }
    function txForm(tx, defaults) {
      var isNew = !tx;
      var cur = tx || defaults || {};
      return TK.ui.form({
        title: isNew ? 'Tranzacție nouă' : 'Editează tranzacția',
        fields: [
          { name: 'date', label: 'Data', type: 'date', value: cur.date, required: true },
          { name: 'kind', label: 'Tip și categorie', type: 'select', options: kindOptions(), value: (cur.type || 'cheltuiala') + '|' + (cur.category || ''), required: true },
          { name: 'amount', label: 'Sumă (lei)', type: 'money', value: cur.amount, required: true, placeholder: '0,00' },
          { name: 'note', label: 'Notă', type: 'text', value: cur.note || '', placeholder: 'opțional' },
        ],
        submit: isNew ? 'Adaugă tranzacția' : 'Salvează',
        onDelete: !isNew,
        deleteLabel: 'Șterge tranzacția',
        validate: function (v) {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(v.date || '')) return 'Alege o dată validă.';
          if (!(v.amount > 0)) return 'Suma trebuie să fie mai mare decât zero.';
          if (!v.kind) return 'Alege tipul și categoria.';
          return null;
        },
      }).then(function (v) {
        if (!v) return false;
        var s = S();
        if (v.__delete) {
          s.transactions = s.transactions.filter(function (t) { return t !== tx; });
          api.commit();
          TK.ui.toast('Tranzacția a fost ștearsă.');
          return true;
        }
        var cut = v.kind.indexOf('|');
        var rec = tx || { id: TK.uid() };
        rec.date = v.date;
        rec.type = v.kind.slice(0, cut);
        rec.category = v.kind.slice(cut + 1);
        rec.amount = r2(v.amount);
        rec.note = v.note || '';
        if (isNew) s.transactions.push(rec);
        api.commit();
        TK.ui.toast(isNew ? 'Tranzacția a fost adăugată.' : 'Tranzacția a fost salvată.');
        return true;
      });
    }

    /* ---- bifă facturi / datorii ---- */
    function payDate(type, cat, ym) {
      if (D.ym(D.today()) === ym) return D.today();
      var p = ymParts(ym);
      var map = type === 'factura' ? S().bills : type === 'datorie' ? S().debts : {};
      var dd = +((map[cat] || {}).dueDay) || 1;
      return D.make(p.y, p.m, Math.max(1, Math.min(dd, D.daysInMonth(p.y, p.m))));
    }
    function onTick(cb, type, cat, m, rerender) {
      var plan = +m.plan[type][cat] || 0, fact = m.fact[type][cat] || 0;
      if (!cb.checked) {
        cb.checked = true;
        TK.ui.toast('„' + cat + '” e plătită integral. Ca s-o debifezi, micșorează sau șterge plata din Tranzacții.');
        return;
      }
      if (!(plan > 0)) {
        cb.checked = false;
        TK.ui.toast('Setează mai întâi suma planificată pentru „' + cat + '”.');
        return;
      }
      var missing = r2(plan - fact);
      var date = payDate(type, cat, m.ym);
      TK.ui.confirm({
        title: 'Marchezi „' + cat + '” ca plătită?',
        text: 'Se adaugă o plată de ' + fmt.lei(missing) + ' (cât lipsește până la plan), cu data ' + fmt.date(date) + '.',
        ok: 'Adaugă plata',
      }).then(function (yes) {
        if (!yes) { cb.checked = false; return; }
        S().transactions.push({ id: TK.uid(), date: date, type: type, category: cat, amount: missing, note: 'Achitat din tracker', auto: true });
        api.commit();
        TK.ui.toast('Plata pentru „' + cat + '” a fost adăugată.');
        rerender();
      });
    }

    function billTable(m, type, where, rerender, opts) {
      opts = opts || {};
      var s = S();
      var cats = s.categories[type];
      var map = type === 'factura' ? s.bills : s.debts;
      var monthEnd = (function () { var p = ymParts(m.ym); return D.make(p.y, p.m, D.daysInMonth(p.y, p.m)); })();
      var showLeft = type === 'datorie' && cats.some(function (c) { return (map[c] || {}).total > 0; });
      var usePlan = !s.noPlan[type];
      var head = usePlan
        ? [th(h('span', { class: 'tk-sr' }, 'Plătit'), 'chk'), th('Categorie'), th('Termen', 'fin-due'), th('Plan', 'num', { colspan: 2 }), th('Achitat', 'num', { colspan: 2 }), th('Progres', 'num')]
        : [th('Categorie'), th('Termen', 'fin-due'), th('Achitat', 'num', { colspan: 2 })];
      if (showLeft) head.push(th('Rămas de plătit', 'num', { colspan: 2 }));
      var rows = cats.map(function (c, i) {
        var plan = +m.plan[type][c] || 0, fact = m.fact[type][c] || 0;
        var paid = plan > 0 && fact >= plan - 0.004;
        var cb = h('input', { type: 'checkbox', class: 'tk-check', id: 'fin-paid-' + where + '-' + type + '-' + i, checked: paid, 'aria-label': c + ' plătită' });
        cb.addEventListener('change', function () { onTick(cb, type, c, m, rerender); });
        var due = (map[c] || {}).dueDay;
        var locked = isNoPlanCat(type, c);
        var cells = usePlan ? [
          h('td', { class: 'chk' }, locked ? null : cb),
          catCell(type, c, m.ym, rerender),
          h('td', { class: 'tk-center fin-due' }, due ? String(due) : '—'),
          curTd(), locked ? lockedPlanTd() : h('td', { class: 'num' }, planInput(m.ym, type, c, i, where, rerender)),
          curTd(), h('td', { class: 'num' }, paidInput(m.ym, type, c, fact, i, where, rerender)),
          pctTd(fact, plan, 'out'),
        ] : [
          catCell(type, c, m.ym, rerender),
          h('td', { class: 'tk-center fin-due' }, due ? String(due) : '—'),
          curTd(), h('td', { class: 'num' }, paidInput(m.ym, type, c, fact, i, where, rerender)),
        ];
        if (showLeft) {
          var tot = +(map[c] || {}).total || 0;
          var left = tot ? Math.max(0, tot - cumulative(s, type, c, monthEnd)) : null;
          cells.push(curTd(), h('td', { class: 'num' }, tot ? fmt.num(left) : '—'));
        }
        return h('tr', { class: paid && usePlan ? 'fin-paid' : null }, cells);
      });
      var cols = usePlan ? ['', '', '', 'cur', 'num', 'cur', 'num', 'num'] : ['', '', 'cur', 'num'];
      if (showLeft) cols.push('cur', 'num');
      var pad = Math.max(0, (opts.minRows || 0) - cats.length);
      var foot = usePlan
        ? [h('th', { colspan: 3, scope: 'row' }, 'Total'), curTd(), numTd(m.planTot[type]), curTd(), numTd(m.factTot[type]), pctTd(factWithPlan(m, type), m.planTot[type], 'out')]
        : [h('th', { colspan: 2, scope: 'row' }, 'Total'), curTd(), numTd(m.factTot[type])];
      if (showLeft) {
        var leftTot = TK.sum(cats, function (c) { var tot = +(map[c] || {}).total || 0; return tot ? Math.max(0, tot - cumulative(s, type, c, monthEnd)) : 0; });
        foot.push(curTd(), numTd(leftTot));
      }
      return [h('div', { class: 'tk-card__body tk-card__body--flush tk-scroll' },
        h('table', { class: 'tk-table tk-table--dense fin-table' },
          h('thead', null, h('tr', null, head)),
          h('tbody', { dataset: { ftype: type } }, rows, emptyRows(pad, cols)),
          h('tfoot', null, h('tr', null, foot)))),
        h('div', { class: 'fin-cat-tools' }, addCatButton(type, m.ym, rerender, 'fin-addcat-' + where + '-' + type), planToggle(type, rerender, 'fin-useplan-' + where + '-' + type))];
    }

    /* ================================================== LUNA (dashboard) */

    function viewMonth() {
      var ym = getYm();

      function render() {
        var focus = captureFocus();
        var s = S();
        var idx = buildIndex(s);
        var m = monthModel(s, idx, ym);
        var p = ymParts(ym);
        var charts = [];
        TK.clear(body);

        var grid = h('div', { class: 'fin-dash' });

        /* antet */
        grid.appendChild(h('div', { class: 'tk-hero fin-head' },
          h('div', { class: 'tk-rule', 'aria-hidden': 'true' }),
          h('h1', { class: 'tk-hero__title' }, MONTHS[p.m]),
          h('p', { class: 'tk-hero__sub' }, 'Dashboard planificator financiar'),
          h('div', { class: 'tk-kv fin-kv' },
            h('span', { class: 'tk-kv__k' }, 'Perioada'), h('span', { class: 'tk-kv__v' }, h('span', { class: 'tk-money' }, periodText(ym))),
            h('span', { class: 'tk-kv__k' }, 'Luna'), h('span', { class: 'tk-kv__v' }, monthPicker(ym, function (v) { ym = v; setYm(v); render(); }, 'fin-luna')),
            h('span', { class: 'tk-kv__k' }, 'Moneda'), h('span', { class: 'tk-kv__v' }, 'lei (MDL)')),
          h('div', { class: 'tk-row fin-head__actions' },
            h('button', { type: 'button', class: 'tk-btn tk-btn--primary tk-btn--sm', id: 'fin-luna-add', onclick: function () {
              txForm(null, { date: defaultDateFor(ym), type: 'cheltuiala', category: s.categories.cheltuiala[0] }).then(function (ok) { if (ok) render(); });
            } }, '+ Adaugă tranzacție'),
            h('button', { type: 'button', class: 'tk-btn tk-btn--sm', id: 'fin-luna-copy', onclick: copyPlan }, 'Copiază planul din luna trecută'),
            h('button', { type: 'button', class: 'tk-btn tk-btn--sm tk-btn--ghost fin-reset', id: 'fin-luna-reset', onclick: function () { resetMonth(ym, render); } }, '↺ Resetează luna'))
        ));

        /* KPI */
        grid.appendChild(h('div', { class: 'tk-kpis fin-kpis fin-span-2', role: 'list', 'aria-label': 'Indicatori ' + MONTHS[p.m] + ' ' + p.y },
          kpi('Venituri', m.factTot.venit, m.planTot.venit, 'in'),
          kpi('Cheltuieli și facturi', m.factTot.cheltuiala + m.factTot.factura, m.planTot.cheltuiala + m.planTot.factura, 'out'),
          kpi('Datorii', m.factTot.datorie, m.planTot.datorie, 'out'),
          kpi('Economii', m.factTot.economie, m.planTot.economie, 'in')));

        /* grafice */
        grid.appendChild(chartCard('Flux de numerar', function (box) {
          flowBars(box, TYPES.map(function (t) { return PLURAL[t]; }), TYPES.map(function (t) { return m.planTot[t]; }),
            TYPES.map(function (t) { return m.factTot[t]; }), 'Flux de numerar, plan și fapt');
        }, charts));
        grid.appendChild(chartCard('Structura veniturilor', function (box) {
          TK.charts.pie(box, {
            data: assignColors(s.categories.venit.map(function (c, i) { return { label: c, value: m.fact.venit[c] || 0, pref: i }; }).filter(function (d) { return d.value > 0; })),
            format: fmt.lei, label: 'Structura veniturilor',
          });
        }, charts));
        grid.appendChild(chartCard('Distribuția reală', function (box) {
          TK.charts.pie(box, { data: realDistribution(m.factTot), format: fmt.lei, label: 'Distribuția reală a veniturilor' });
        }, charts));

        /* coloana 1: flux + sumar venituri */
        grid.appendChild(h('div', { class: 'tk-stack' }, fluxCard(m), summaryCard(m, 'venit', render, { minRows: 5 })));
        /* coloana 2: sumar cheltuieli */
        var nExp = s.categories.cheltuiala.length;
        var tallRows = Math.max(nExp + 2, 14);
        grid.appendChild(summaryCard(m, 'cheltuiala', render, { minRows: tallRows }));
        /* coloana 3: tracker facturi */
        grid.appendChild(h('article', { class: 'tk-card' },
          cardHead(titleB('Tracker', 'facturi')),
          billTable(m, 'factura', 'luna', render, { minRows: tallRows })));

        /* top-20, unde s-au dus banii, ultimele tranzacții */
        var outItems = [];
        var offset = 0;
        OUT.forEach(function (t) {
          s.categories[t].forEach(function (c, i) {
            var v = m.fact[t][c] || 0;
            if (v > 0) outItems.push({ label: c, value: v, type: t, pref: offset + i });
          });
          offset += s.categories[t].length;
        });
        outItems.sort(function (a, b) { return b.value - a.value; });
        grid.appendChild(top20Card(outItems, m.factOut));
        grid.appendChild(chartCard('Unde s-au dus banii', function (box) {
          TK.charts.pie(box, {
            data: topWithOther(outItems.map(function (d) { return { label: d.label, value: d.value, pref: d.pref }; }), 7),
            format: fmt.lei, label: 'Unde s-au dus banii', size: 210, legendBelow: true,
          });
        }, charts, 'fin-where'));
        grid.appendChild(recentCard(ym, render));

        body.appendChild(grid);
        body.appendChild(h('p', { class: 'tk-note fin-foot-note' }, 'Compară planul cu faptul, urmărește fluxul de numerar și vezi imediat unde cheltuielile au depășit bugetul. Sumele „Plan” se editează direct în tabel.'));
        charts.forEach(function (fn) { fn(); });
        restoreFocus(focus, body);
      }

      function copyPlan() {
        var s = S();
        var prev = addMonths(ym, -1);
        var src = s.plans[prev];
        if (!src || !Object.keys(src).length) { TK.ui.toast('Luna ' + MONTHS[ymParts(prev).m].toLowerCase() + ' nu are plan de copiat.'); return; }
        var doCopy = function () {
          s.plans[ym] = TK.clone(src);
          // categoriile fără plan (sumă fixă) rămân fără plan
          Object.keys(s.noPlanCats).forEach(function (t) {
            Object.keys(s.noPlanCats[t]).forEach(function (c) { setPlanRaw(ym, t, c, null); });
          });
          api.commit();
          render();
          TK.ui.toast('Planul a fost copiat din ' + MONTHS[ymParts(prev).m].toLowerCase() + '.');
        };
        var cur = s.plans[ym];
        if (cur && Object.keys(cur).length) {
          TK.ui.confirm({
            title: 'Înlocuiești planul lunii?',
            text: 'Planul pentru ' + fmt.monthYear(ymParts(ym).y, ymParts(ym).m) + ' va fi înlocuit cu cel din ' + fmt.monthYear(ymParts(prev).y, ymParts(prev).m) + '.',
            ok: 'Înlocuiește planul',
          }).then(function (yes) { if (yes) doCopy(); });
        } else doCopy();
      }

      render();
    }

    function realDistribution(tot) {
      var data = OUT.map(function (t) { return { label: PLURAL[t], value: tot[t], color: FLOW_COLOR[t] }; });
      var left = tot.venit - (tot.cheltuiala + tot.factura + tot.datorie + tot.economie);
      if (left > 0) data.push({ label: 'Rămas', value: left, color: FLOW_COLOR.ramas });
      return data;
    }

    function fluxCard(m) {
      function row(sign, label, plan, fact, strong) {
        return h('tr', null,
          h('td', { class: 'fin-sign', 'aria-hidden': 'true' }, sign),
          h(strong ? 'th' : 'td', strong ? { scope: 'row' } : null, label),
          curTd(), numTd(plan), curTd(), numTd(fact));
      }
      return h('article', { class: 'tk-card' },
        cardHead(titleB('Flux', 'de numerar')),
        h('div', { class: 'tk-card__body tk-card__body--flush tk-scroll' },
          h('table', { class: 'tk-table tk-table--dense fin-table fin-flux' },
            h('thead', null, h('tr', null, th(h('span', { class: 'tk-sr' }, 'Semn'), 'fin-sign'), th('Categorie'), th('Plan', 'num', { colspan: 2 }), th('Achitat', 'num', { colspan: 2 }))),
            h('tbody', null,
              row('+', 'Sold reportat', m.opening, m.opening),
              row('+', 'Total venituri', m.planTot.venit, m.factTot.venit, true),
              OUT.map(function (t) { return row('−', PLURAL[t], m.planTot[t], m.factTot[t]); })),
            h('tfoot', null, h('tr', null,
              h('th', { colspan: 2, scope: 'row' }, 'Sold final'),
              curTd(), h('td', { class: 'num' }, fmt.num(m.planClosing)), curTd(), h('td', { class: 'num' + (m.closing < 0 ? ' fin-neg' : '') }, fmt.num(m.closing)))))));
    }

    function summaryCard(m, type, rerender, opts) {
      opts = opts || {};
      var cats = S().categories[type];
      var usePlan = !S().noPlan[type];
      var withPct = type !== 'venit' && usePlan;
      var tone = type === 'venit' ? 'sage' : null;
      var head = [th('Categorie')];
      if (usePlan) head.push(th('Plan', 'num', { colspan: 2 }));
      head.push(th(PAID_LABEL[type], 'num', { colspan: 2 }));
      if (withPct) head.push(th('Progres', 'num'));
      var rows = cats.map(function (c, i) {
        var plan = +m.plan[type][c] || 0, fact = m.fact[type][c] || 0;
        var cells = [catCell(type, c, m.ym, rerender)];
        if (usePlan) cells.push(curTd(), isNoPlanCat(type, c) ? lockedPlanTd() : h('td', { class: 'num' }, planInput(m.ym, type, c, i, 'luna', rerender)));
        cells.push(curTd(), h('td', { class: 'num' }, paidInput(m.ym, type, c, fact, i, 'luna', rerender)));
        if (withPct) cells.push(pctTd(fact, plan, MODE[type]));
        return h('tr', null, cells);
      });
      var cols = usePlan ? ['', 'cur', 'num', 'cur', 'num'] : ['', 'cur', 'num'];
      if (withPct) cols.push('num');
      var foot = [h('th', { scope: 'row' }, 'Total')];
      if (usePlan) foot.push(curTd(), numTd(m.planTot[type]));
      foot.push(curTd(), numTd(m.factTot[type]));
      if (withPct) foot.push(pctTd(factWithPlan(m, type), m.planTot[type], MODE[type]));
      return h('article', { class: 'tk-card' + (tone ? ' tk-card--' + tone : '') },
        cardHead(titleB('Sumar', PLURAL[type].toLowerCase()), tone),
        h('div', { class: 'tk-card__body tk-card__body--flush tk-scroll' },
          h('table', { class: 'tk-table tk-table--dense fin-table' },
            h('thead', null, h('tr', null, head)),
            h('tbody', { dataset: { ftype: type } }, rows, emptyRows(Math.max(0, (opts.minRows || 0) - cats.length), cols)),
            h('tfoot', null, h('tr', null, foot)))),
        h('div', { class: 'fin-cat-tools' }, addCatButton(type, m.ym, rerender, 'fin-addcat-luna-' + type), planToggle(type, rerender, 'fin-useplan-luna-' + type)));
    }

    function top20Card(items, total) {
      var top = items.slice(0, 20);
      return h('article', { class: 'tk-card tk-card--terra' },
        cardHead(titleB('Top-20', 'categorii de cheltuieli'), 'terra'),
        h('div', { class: 'tk-card__body tk-card__body--flush tk-scroll' },
          h('table', { class: 'tk-table tk-table--dense fin-table' + (top.length ? ' tk-rank' : '') },
            h('thead', null, h('tr', null, th('#'), th('Categorie'), th('Achitat', 'num', { colspan: 2 }), th('Procent', 'num'))),
            h('tbody', null, top.length ? top.map(function (d, i) {
              return h('tr', null,
                h('td', null, String(i + 1)),
                h('td', { class: 'fin-cat', title: d.label + ' · ' + LABEL[d.type] }, h('span', { class: 'fin-type-dot fin-type-dot--lead', 'data-tone': TONE[d.type] }), h('span', { class: 'tk-sr' }, LABEL[d.type] + ': '), d.label),
                curTd(), numTd(d.value),
                h('td', { class: 'num' }, fmt.pct(TK.ratio(d.value, total))));
            }) : h('tr', null, h('td', { colspan: 5, class: 'tk-muted tk-center' }, 'Nicio ieșire în luna aceasta.'))),
            h('tfoot', null, h('tr', null, h('th', { colspan: 2, scope: 'row' }, 'Total ieșiri'), curTd(), numTd(total), h('td', { class: 'num' }, total ? '100,00%' : '—'))))),
        h('div', { class: 'tk-card__foot fin-legend-types' }, OUT.map(function (t) {
          return h('span', null, h('span', { class: 'fin-type-dot', 'data-tone': TONE[t] }), PLURAL[t]);
        })));
    }

    function recentCard(ym, rerender) {
      var list = S().transactions.filter(function (t) { return t.date.slice(0, 7) === ym; });
      list = list.map(function (t, i) { return { t: t, i: i }; }).sort(function (a, b) {
        return a.t.date < b.t.date ? 1 : a.t.date > b.t.date ? -1 : b.i - a.i;
      }).slice(0, 12).map(function (x) { return x.t; });
      return h('article', { class: 'tk-card' },
        cardHead(titleB('Ultimele', 'tranzacții')),
        h('div', { class: 'tk-card__body tk-card__body--flush tk-scroll' },
          h('table', { class: 'tk-table tk-table--dense fin-table' },
            h('thead', null, h('tr', null, th('Data'), th('Categorie'), th('Sumă', 'num', { colspan: 2 }), th(h('span', { class: 'tk-sr' }, 'Acțiuni')))),
            h('tbody', null, list.length ? list.map(function (t) {
              return h('tr', null,
                h('td', { class: 'fin-date' }, fmt.dateShort(t.date)),
                h('td', { class: 'fin-cat', title: t.category + ' · ' + LABEL[t.type] + (t.note ? ' · ' + t.note : '') },
                  h('span', { class: 'fin-type-dot fin-type-dot--lead', 'data-tone': TONE[t.type] }), h('span', { class: 'tk-sr' }, LABEL[t.type] + ': '), t.category),
                h('td', { class: 'cur' }, t.type === 'venit' ? '+' : '−'),
                h('td', { class: 'num' + (t.type === 'venit' ? ' fin-in' : '') }, fmt.num(t.amount)),
                h('td', { class: 'chk' }, h('button', {
                  type: 'button', class: 'tk-icon-btn', id: 'fin-recent-edit-' + t.id, 'aria-label': 'Editează ' + t.category + ' ' + fmt.date(t.date),
                  onclick: function () { txForm(t).then(function (ok) { if (ok) rerender(); }); },
                }, '✎')));
            }) : h('tr', null, h('td', { colspan: 5, class: 'tk-muted tk-center' }, 'Încă nu ai tranzacții în luna aceasta.'))))),
        h('div', { class: 'tk-card__foot fin-legend-types' }, TYPES.map(function (t) {
          return h('span', null, h('span', { class: 'fin-type-dot', 'data-tone': TONE[t] }), PLURAL[t]);
        })),
        h('div', { class: 'tk-card__foot' },
          h('span', null, 'În lună: ', h('b', null, String(S().transactions.filter(function (t) { return t.date.slice(0, 7) === ym; }).length))),
          h('button', { type: 'button', class: 'tk-btn tk-btn--sm tk-btn--ghost', id: 'fin-recent-all', onclick: function () {
            var f = api.prefs.get('txf', {}) || {};
            f.month = ym;
            api.prefs.set('txf', f);
            api.go('tranzactii');
          } }, 'Vezi toate tranzacțiile lunii →')));
    }

    /* ================================================== TRANZACȚII */

    function viewTransactions() {
      var LIMIT = 150;
      var f = api.prefs.get('txf', null) || {};
      if (f.month !== 'all' && !isYm(f.month)) f.month = getYm();
      if (TYPES.indexOf(f.type) === -1) f.type = '';
      f.cat = f.cat || '';
      f.q = f.q || '';
      var showAll = false;
      function saveF() { api.prefs.set('txf', f); }

      TK.clear(body);
      body.appendChild(h('div', { class: 'tk-hero fin-page-head' },
        h('div', { class: 'tk-rule', 'aria-hidden': 'true' }),
        h('h1', { class: 'tk-hero__title' }, 'Tranzacții'),
        h('p', { class: 'tk-hero__sub' }, 'Registrul operațiunilor: dată, tip, categorie, sumă')));

      /* adăugare rapidă */
      var addType = api.prefs.get('addType', 'cheltuiala');
      if (TYPES.indexOf(addType) === -1) addType = 'cheltuiala';
      var fDate = h('input', { class: 'tk-input', type: 'date', id: 'fin-add-date', value: D.today(), required: true });
      var fType = h('select', { class: 'tk-select', id: 'fin-add-type' }, TYPES.map(function (t) { return h('option', { value: t, selected: t === addType }, LABEL[t]); }));
      var fCat = h('select', { class: 'tk-select', id: 'fin-add-cat' });
      var fAmt = h('input', { class: 'tk-input num', type: 'text', inputmode: 'decimal', id: 'fin-add-amount', placeholder: '0,00', autocomplete: 'off' });
      var fNote = h('input', { class: 'tk-input', type: 'text', id: 'fin-add-note', placeholder: 'opțional', autocomplete: 'off' });
      var fErr = h('p', { class: 'tk-form-error', role: 'alert', hidden: true });
      function fillCats(sel, type, current, allLabel) {
        TK.clear(sel);
        if (allLabel) sel.appendChild(h('option', { value: '' }, allLabel));
        var cats = type ? S().categories[type] : [];
        if (!type && allLabel) {
          TYPES.forEach(function (t) {
            sel.appendChild(h('optgroup', { label: PLURAL[t] }, S().categories[t].map(function (c) {
              return h('option', { value: t + '|' + c, selected: current === t + '|' + c }, c);
            })));
          });
          return;
        }
        cats.forEach(function (c) {
          sel.appendChild(h('option', { value: allLabel ? type + '|' + c : c, selected: (allLabel ? type + '|' + c : c) === current }, c));
        });
      }
      fillCats(fCat, addType, api.prefs.get('addCat', ''));
      fType.addEventListener('change', function () {
        api.prefs.set('addType', fType.value);
        fillCats(fCat, fType.value, '');
      });
      fCat.addEventListener('change', function () { api.prefs.set('addCat', fCat.value); });
      function field(id, label, ctl, cls) {
        return h('div', { class: 'tk-field' + (cls ? ' ' + cls : '') }, h('label', { class: 'tk-label', for: id }, label), ctl);
      }
      var form = h('form', { class: 'tk-toolbar fin-addform', novalidate: true },
        field('fin-add-date', 'Data', fDate, 'fin-f-date'),
        field('fin-add-type', 'Tip', fType, 'fin-f-type'),
        field('fin-add-cat', 'Categorie', fCat, 'fin-f-cat'),
        field('fin-add-amount', 'Sumă (lei)', fAmt, 'fin-f-amt'),
        field('fin-add-note', 'Notă', fNote, 'fin-f-note'),
        h('button', { type: 'submit', class: 'tk-btn tk-btn--primary', id: 'fin-add-submit' }, 'Adaugă'));
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var amt = fmt.parseNum(fAmt.value);
        var err = null;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(fDate.value)) err = 'Alege data.';
        else if (!fCat.value) err = 'Adaugă mai întâi o categorie în Setări.';
        else if (!(amt > 0)) err = 'Scrie o sumă mai mare decât zero.';
        fAmt.setAttribute('aria-invalid', err && !(amt > 0) ? 'true' : 'false');
        if (err) { fErr.textContent = err; fErr.hidden = false; (amt > 0 ? fDate : fAmt).focus(); return; }
        fErr.hidden = true;
        var rec = { id: TK.uid(), date: fDate.value, type: fType.value, category: fCat.value, amount: r2(amt), note: fNote.value.trim() };
        S().transactions.push(rec);
        api.commit();
        fAmt.value = '';
        fNote.value = '';
        fAmt.focus();
        var visible = f.month === 'all' || f.month === rec.date.slice(0, 7);
        TK.ui.toast('Adăugat: ' + LABEL[rec.type].toLowerCase() + ' „' + rec.category + '”, ' + fmt.lei(rec.amount) + (visible ? '.' : ' (în altă lună decât filtrul).'));
        refreshMonthOptions();
        renderTable();
      });
      body.appendChild(h('section', { class: 'tk-card fin-add-card', 'aria-labelledby': 'fin-add-title' },
        h('header', { class: 'tk-card__head' }, h('h2', { class: 'tk-card__title', id: 'fin-add-title' }, 'Adaugă ', h('b', null, 'tranzacție'))),
        h('div', { class: 'tk-card__body' }, form, fErr)));

      /* filtre */
      var qMonth = h('select', { class: 'tk-select', id: 'fin-f-month' });
      function refreshMonthOptions() {
        var set = {};
        S().transactions.forEach(function (t) { set[t.date.slice(0, 7)] = 1; });
        set[todayYm()] = 1;
        if (f.month !== 'all') set[f.month] = 1;
        TK.clear(qMonth);
        qMonth.appendChild(h('option', { value: 'all', selected: f.month === 'all' }, 'Toate lunile'));
        Object.keys(set).sort().reverse().forEach(function (k) {
          var p = ymParts(k);
          qMonth.appendChild(h('option', { value: k, selected: f.month === k }, fmt.monthYear(p.y, p.m)));
        });
      }
      refreshMonthOptions();
      var qType = h('select', { class: 'tk-select', id: 'fin-f-type' },
        h('option', { value: '' }, 'Toate tipurile'),
        TYPES.map(function (t) { return h('option', { value: t, selected: f.type === t }, LABEL[t]); }));
      var qCat = h('select', { class: 'tk-select', id: 'fin-f-cat' });
      fillCats(qCat, f.type, f.cat, 'Toate categoriile');
      var qText = h('input', { class: 'tk-input', type: 'search', id: 'fin-f-q', placeholder: 'Notă sau categorie…', value: f.q, autocomplete: 'off' });
      qMonth.addEventListener('change', function () { f.month = qMonth.value; saveF(); renderTable(); });
      qType.addEventListener('change', function () { f.type = qType.value; f.cat = ''; fillCats(qCat, f.type, '', 'Toate categoriile'); saveF(); renderTable(); });
      qCat.addEventListener('change', function () { f.cat = qCat.value; saveF(); renderTable(); });
      var onQ = TK.debounce(function () { f.q = qText.value.trim(); saveF(); renderTable(); }, 160);
      cleanups.push(onQ.cancel);
      qText.addEventListener('input', onQ);
      var resetBtn = h('button', { type: 'button', class: 'tk-btn tk-btn--ghost tk-btn--sm', id: 'fin-f-reset', onclick: function () {
        f = { month: 'all', type: '', cat: '', q: '' };
        saveF();
        qType.value = ''; fillCats(qCat, '', '', 'Toate categoriile'); qText.value = '';
        refreshMonthOptions();
        renderTable();
      } }, 'Resetează filtrele');

      var tableHost = h('div', { class: 'tk-card__body tk-card__body--flush tk-scroll fin-tx-scroll' });
      var footHost = h('div', { class: 'tk-card__foot fin-tx-foot', 'aria-live': 'polite' });
      body.appendChild(h('section', { class: 'tk-card fin-tx-card', 'aria-label': 'Registrul tranzacțiilor' },
        h('div', { class: 'tk-card__body fin-filters' },
          h('div', { class: 'tk-toolbar' },
            field('fin-f-month', 'Luna', qMonth), field('fin-f-type', 'Tip', qType), field('fin-f-cat', 'Categorie', qCat),
            field('fin-f-q', 'Căutare', qText, 'fin-f-search'), h('span', { class: 'tk-spacer' }), resetBtn)),
        tableHost, footHost));
      body.appendChild(h('p', { class: 'tk-note' }, 'Toate tranzacțiile se distribuie automat pe luni și ajung în rapoartele potrivite.'));

      function filtered() {
        var q = f.q.toLowerCase();
        var catType = null, catName = null;
        if (f.cat) { var cut = f.cat.indexOf('|'); catType = f.cat.slice(0, cut); catName = f.cat.slice(cut + 1); }
        var out = [];
        S().transactions.forEach(function (t, i) {
          if (f.month !== 'all' && t.date.slice(0, 7) !== f.month) return;
          if (f.type && t.type !== f.type) return;
          if (catType && (t.type !== catType || t.category !== catName)) return;
          if (q && (t.category + ' ' + (t.note || '') + ' ' + LABEL[t.type]).toLowerCase().indexOf(q) === -1) return;
          out.push({ t: t, i: i });
        });
        out.sort(function (a, b) { return a.t.date < b.t.date ? 1 : a.t.date > b.t.date ? -1 : b.i - a.i; });
        return out.map(function (x) { return x.t; });
      }

      function renderTable() {
        var focus = captureFocus();
        var list = filtered();
        var shown = showAll ? list : list.slice(0, LIMIT);
        TK.clear(tableHost);
        var rows = shown.map(function (t) {
          return h('tr', null,
            h('td', { class: 'fin-date' }, h('span', { class: 'fin-date-long' }, fmt.date(t.date)), h('span', { class: 'fin-date-short', 'aria-hidden': 'true' }, fmt.dateShort(t.date))),
            h('td', null, h('span', { class: 'tk-pill fin-pill', 'data-tone': TONE[t.type], title: LABEL[t.type] }, h('span', { class: 'tk-dot' }), h('span', { class: 'fin-pill-txt' }, LABEL[t.type]))),
            h('td', { class: 'fin-cat-cell', title: t.category }, t.category, t.note ? h('span', { class: 'fin-note-sub', 'aria-hidden': 'true' }, t.note) : null),
            h('td', { class: 'num fin-amt' }, fmt.num(t.amount), h('span', { class: 'cur' }, ' lei')),
            h('td', { class: 'fin-note-cell tk-hide-sm', title: t.note || null }, t.note || ''),
            h('td', { class: 'chk' }, h('button', {
              type: 'button', class: 'tk-icon-btn', id: 'fin-tx-edit-' + t.id, 'aria-label': 'Editează ' + t.category + ', ' + fmt.date(t.date),
              onclick: function () { txForm(t).then(function (ok) { if (ok) { refreshMonthOptions(); renderTable(); } }); },
            }, '✎')));
        });
        if (!list.length) {
          tableHost.appendChild(h('div', { class: 'fin-empty-wrap' }, h('div', { class: 'tk-empty' },
            h('strong', null, 'Nicio tranzacție aici'),
            S().transactions.length ? 'Schimbă filtrele sau adaugă o tranzacție mai sus.' : 'Adaugă prima tranzacție cu formularul de mai sus.')));
        } else {
          tableHost.appendChild(h('table', { class: 'tk-table tk-table--dense fin-table fin-tx-table' },
            h('thead', null, h('tr', null, th('Dată'), th('Tip'), th('Categorie'), th('Sumă', 'num'), th('Notă', 'tk-hide-sm'), th(h('span', { class: 'tk-sr' }, 'Acțiuni'), 'chk'))),
            h('tbody', null, rows)));
        }
        if (list.length > shown.length) {
          tableHost.appendChild(h('div', { class: 'fin-more' }, h('button', {
            type: 'button', class: 'tk-btn tk-btn--sm', id: 'fin-tx-more', onclick: function () { showAll = true; renderTable(); },
          }, 'Arată toate cele ' + list.length + ' tranzacții')));
        }
        TK.clear(footHost);
        var tot = {};
        TYPES.forEach(function (t) { tot[t] = 0; });
        list.forEach(function (t) { tot[t.type] += +t.amount || 0; });
        footHost.appendChild(h('span', { class: 'fin-count' }, h('b', null, String(list.length)), list.length === 1 ? ' tranzacție' : ' tranzacții'));
        footHost.appendChild(h('span', { class: 'fin-totals' }, TYPES.filter(function (t) { return tot[t] > 0; }).map(function (t) {
          return h('span', { class: 'fin-tot' }, h('span', { class: 'tk-pill', 'data-tone': TONE[t] }, PLURAL[t]), ' ', h('b', { class: 'tk-money' }, fmt.lei(tot[t])));
        })));
        restoreFocus(focus, body);
      }
      renderTable();
    }

    /* ================================================== FACTURI, DATORII, ECONOMII */

    function viewTrackers() {
      var ym = getYm();
      function render() {
        var focus = captureFocus();
        var s = S();
        var idx = buildIndex(s);
        var m = monthModel(s, idx, ym);
        var p = ymParts(ym);
        TK.clear(body);
        body.appendChild(h('div', { class: 'fin-trk-head' },
          h('div', { class: 'tk-hero' },
            h('div', { class: 'tk-rule', 'aria-hidden': 'true' }),
            h('h1', { class: 'tk-hero__title fin-title-sm' }, 'Nu doar venituri'),
            h('p', { class: 'tk-hero__sub' }, 'și cheltuieli: facturi, datorii, economii și investiții')),
          h('div', { class: 'tk-kv fin-kv' },
            h('span', { class: 'tk-kv__k' }, 'Luna'), h('span', { class: 'tk-kv__v' }, monthPicker(ym, function (v) { ym = v; setYm(v); render(); }, 'fin-trk')),
            h('span', { class: 'tk-kv__k' }, 'Perioada'), h('span', { class: 'tk-kv__v' }, h('span', { class: 'tk-money' }, periodText(ym))))));

        var bills = h('section', { class: 'fin-trk-block' },
          h('h2', { class: 'tk-h2' }, 'Facturi'),
          h('p', { class: 'tk-muted' }, 'Controlează plățile regulate. Bifează o factură ca s-o marchezi plătită.'),
          h('article', { class: 'tk-card' }, cardHead(titleB('Tracker', 'facturi')), billTable(m, 'factura', 'trk', render, { minRows: 8 })));
        var debts = h('section', { class: 'fin-trk-block' },
          h('h2', { class: 'tk-h2' }, 'Datorii'),
          h('p', { class: 'tk-muted' }, 'Urmărește ratele și cât mai ai de plătit.'),
          h('article', { class: 'tk-card' }, cardHead(titleB('Tracker', 'datorii')), billTable(m, 'datorie', 'trk', render, { minRows: 8 })));
        body.appendChild(h('div', { class: 'fin-trk-grid' }, bills, debts));

        /* economii */
        var monthEnd = D.make(p.y, p.m, D.daysInMonth(p.y, p.m));
        var totT = 0, totA = 0, totM = 0;
        var rows = s.categories.economie.map(function (c, i) {
          var target = +((s.goals[c] || {}).target) || 0;
          var acc = cumulative(s, 'economie', c, monthEnd);
          var inMonth = m.fact.economie[c] || 0;
          totT += target; totA += acc; totM += inMonth;
          var ratio = target ? acc / target : 0;
          var pctv = Math.min(100, ratio * 100);
          return h('tr', null,
            catCell('economie', c, null, render),
            curTd(), numTd(target),
            curTd(), numTd(acc),
            curTd(), numTd(inMonth),
            h('td', { class: 'fin-bar-cell' }, target ? h('span', {
              class: 'tk-progress tk-progress--sage', style: { '--p': pctv.toFixed(2) + '%' }, role: 'progressbar',
              'aria-valuenow': String(Math.round(pctv)), 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-label': 'Progres ' + c,
            }) : h('span', { class: 'tk-muted' }, 'fără țintă')),
            pctTd(acc, target, 'in'),
            h('td', { class: 'chk' }, h('button', {
              type: 'button', class: 'tk-icon-btn', id: 'fin-save-add-' + i, 'aria-label': 'Depunerile pentru ' + c, title: 'Depuneri: adaugă, modifică sau șterge',
              onclick: function () { amountsDialog(ym, 'economie', c, render); },
            }, '+')));
        });
        body.appendChild(h('section', { class: 'fin-trk-block fin-trk-save' },
          h('h2', { class: 'tk-h2' }, 'Economii și investiții'),
          h('p', { class: 'tk-muted' }, 'Planifică acumulările și urmărește banii investiți. „Acumulat” include toate depunerile până la sfârșitul lunii alese.'),
          h('article', { class: 'tk-card tk-card--sage' },
            cardHead(titleB('Tracker', 'economii și investiții'), 'sage'),
            h('div', { class: 'tk-card__body tk-card__body--flush tk-scroll' },
              h('table', { class: 'tk-table tk-table--dense fin-table' },
                h('thead', null, h('tr', null, th('Categorie'), th('Țintă', 'num', { colspan: 2 }), th('Acumulat', 'num', { colspan: 2 }), th('Luna aceasta', 'num', { colspan: 2 }), th('Progres', null, { colspan: 2 }), th(h('span', { class: 'tk-sr' }, 'Adaugă'), 'chk'))),
                h('tbody', { dataset: { ftype: 'economie' } }, rows, emptyRows(Math.max(0, 9 - rows.length), ['', 'cur', 'num', 'cur', 'num', 'cur', 'num', '', 'num', ''])),
                h('tfoot', null, h('tr', null, h('th', { scope: 'row' }, 'Total'), curTd(), numTd(totT), curTd(), numTd(totA), curTd(), numTd(totM), h('td', null), pctTd(totA, totT, 'in'), h('td', null))))),
            h('div', { class: 'fin-cat-tools' }, addCatButton('economie', null, render, 'fin-addcat-trk-economie')))));
        body.appendChild(h('p', { class: 'tk-note' }, 'Controlează toate direcțiile financiare într-un singur sistem.'));
        restoreFocus(focus, body);
      }
      render();
    }

    /* ================================================== REZUMAT ANUAL */

    function viewYear() {
      var y = getYear();
      var saveNote = null, notePending = null;
      function flushNote() { if (saveNote && notePending) saveNote.flush(); }
      function render() {
        var focus = captureFocus();
        var s = S();
        var idx = buildIndex(s);
        var Y = yearModel(s, idx, y);
        var curYm = todayYm();
        var charts = [];
        TK.clear(body);
        var grid = h('div', { class: 'fin-year' });

        var years = yearsRange();
        if (years.indexOf(y) === -1) years.push(y);
        var ysel = h('select', { class: 'tk-cell-input', id: 'fin-year-y', 'aria-label': 'Anul' },
          years.map(function (v) { return h('option', { value: String(v), selected: v === y }, String(v)); }));
        ysel.addEventListener('change', function () { y = +ysel.value; api.prefs.set('year', y); render(); });
        grid.appendChild(h('div', { class: 'tk-hero fin-head' },
          h('div', { class: 'tk-rule', 'aria-hidden': 'true' }),
          h('h1', { class: 'tk-hero__title fin-title-sm' }, 'Rezumat anual'),
          h('p', { class: 'tk-hero__sub' }, 'Toate cele 12 luni într-o singură imagine'),
          h('div', { class: 'tk-kv fin-kv' },
            h('span', { class: 'tk-kv__k' }, 'Anul'), h('span', { class: 'tk-kv__v' }, h('div', { class: 'fin-mpick' },
              h('button', { type: 'button', class: 'tk-icon-btn', id: 'fin-year-prev', 'aria-label': 'Anul anterior', onclick: function () { y--; api.prefs.set('year', y); render(); } }, '‹'),
              ysel,
              h('button', { type: 'button', class: 'tk-icon-btn', id: 'fin-year-next', 'aria-label': 'Anul următor', onclick: function () { y++; api.prefs.set('year', y); render(); } }, '›'))),
            h('span', { class: 'tk-kv__k' }, 'Moneda'), h('span', { class: 'tk-kv__v' }, 'lei (MDL)'))));

        grid.appendChild(h('div', { class: 'tk-kpis fin-kpis fin-span-3', role: 'list', 'aria-label': 'Indicatori ' + y },
          kpi('Venituri', Y.fact.venit, Y.plan.venit, 'in'),
          kpi('Cheltuieli', Y.fact.cheltuiala, Y.plan.cheltuiala, 'out'),
          kpi('Facturi', Y.fact.factura, Y.plan.factura, 'out'),
          kpi('Plăți datorii', Y.fact.datorie, Y.plan.datorie, 'out'),
          kpi('Economii', Y.fact.economie, Y.plan.economie, 'in')));

        grid.appendChild(chartCard('Flux de numerar', function (box) {
          flowBars(box, TYPES.map(function (t) { return PLURAL[t]; }), TYPES.map(function (t) { return Y.plan[t]; }),
            TYPES.map(function (t) { return Y.fact[t]; }), 'Flux de numerar anual');
        }, charts));
        grid.appendChild(chartCard('Structura veniturilor', function (box) {
          TK.charts.pie(box, {
            data: topWithOther(s.categories.venit.map(function (c, i) { return { label: c, value: Y.factCat.venit[c] || 0, pref: i }; }), 7),
            format: fmt.lei, label: 'Structura veniturilor pe an', legendBelow: true,
          });
        }, charts));
        grid.appendChild(chartCard('Structura cheltuielilor', function (box) {
          TK.charts.pie(box, {
            data: topWithOther(s.categories.cheltuiala.map(function (c, i) { return { label: c, value: Y.factCat.cheltuiala[c] || 0, pref: i }; }), 7),
            format: fmt.lei, label: 'Structura cheltuielilor pe an', legendBelow: true,
          });
        }, charts));
        grid.appendChild(chartCard('Distribuția reală', function (box) {
          TK.charts.pie(box, { data: realDistribution(Y.fact), format: fmt.lei, label: 'Distribuția reală pe an', legendBelow: true });
        }, charts));

        /* coloana 1: prezentare flux + total */
        function frow(label, plan, fact, mode, strong) {
          return h('tr', null, h(strong ? 'th' : 'td', strong ? { scope: 'row' } : null, label), numTd(plan), numTd(fact), pctTd(fact, plan, mode));
        }
        var flux = h('article', { class: 'tk-card' },
          cardHead(titleB('Prezentare', 'flux de numerar')),
          h('div', { class: 'tk-card__body tk-card__body--flush tk-scroll' },
            h('table', { class: 'tk-table tk-table--dense fin-table fin-compact' },
              h('thead', null, h('tr', null, th('Categorie'), th('Plan, lei', 'num'), th('Achitat, lei', 'num'), th('Progres', 'num'))),
              h('tbody', null,
                h('tr', null, h('td', { title: 'Sold la 1 ianuarie' }, 'Sold inițial'), numTd(Y.opening), numTd(Y.opening), h('td', { class: 'num' }, '')),
                frow('Total venituri', Y.plan.venit, Y.fact.venit, 'in', true),
                OUT.map(function (t) { return frow(PLURAL[t], Y.plan[t], Y.fact[t], MODE[t]); })),
              h('tfoot', null, h('tr', null, h('th', { scope: 'row' }, 'Sold final'), h('td', { class: 'num' }, fmt.num(Y.planClosing)),
                h('td', { class: 'num' + (Y.closing < 0 ? ' fin-neg' : '') }, fmt.num(Y.closing)), pctTd(Y.closing, Y.planClosing > 0 ? Y.planClosing : 0, 'in'))))));
        var big = h('article', { class: 'tk-card tk-card--plain fin-big-card' },
          h('div', { class: 'tk-card__body' },
            h('p', { class: 'tk-chart__title' }, 'Total cheltuieli și facturi'),
            h('p', { class: 'fin-big' }, fmt.num(Y.fact.cheltuiala + Y.fact.factura), h('span', { class: 'cur' }, ' lei')),
            h('p', { class: 'tk-muted fin-big-sub' }, 'cheltuieli ' + fmt.lei(Y.fact.cheltuiala) + ' · facturi ' + fmt.lei(Y.fact.factura))));
        var fin = h('article', { class: 'tk-card' },
          cardHead(titleB('Sumar', 'finanțe')),
          h('div', { class: 'tk-card__body tk-card__body--flush tk-scroll' },
            h('table', { class: 'tk-table tk-table--dense fin-table fin-compact' },
              h('thead', null, h('tr', null, th('Categorie'), th('Plan, lei', 'num'), th('Achitat, lei', 'num'), th('Progres', 'num'))),
              h('tbody', null, TYPES.map(function (t) { return frow(PLURAL[t], Y.plan[t], Y.fact[t], MODE[t], t === 'venit'); })),
              h('tfoot', null, h('tr', null, h('th', { scope: 'row' }, 'Total ieșiri'), numTd(Y.planOut), numTd(Y.factOut), pctTd(Y.factOut, Y.planOut, 'out'))))));

        function monthTable(type, tone) {
          var rows = Y.months.map(function (mm, i) {
            var future = mm.ym > curYm;
            var fact = mm.factTot[type], plan = mm.planTot[type];
            return h('tr', { class: mm.ym === curYm ? 'fin-cur' : null },
              h('td', null, MONTHS[i]), numTd(plan), numTd(future && !fact ? 0 : fact),
              h('td', { class: 'num' }, future && !fact ? h('span', { class: 'tk-muted' }, '—') : pctSpan(fact, plan, MODE[type])));
          });
          return h('article', { class: 'tk-card' + (tone ? ' tk-card--' + tone : '') },
            cardHead(titleB('Sumar', PLURAL[type].toLowerCase()), tone),
            h('div', { class: 'tk-card__body tk-card__body--flush tk-scroll' },
              h('table', { class: 'tk-table tk-table--dense fin-table fin-compact' },
                h('thead', null, h('tr', null, th('Lună'), th('Plan, lei', 'num'), th(PAID_LABEL[type] + ', lei', 'num'), th('Progres', 'num'))),
                h('tbody', null, rows),
                h('tfoot', null, h('tr', null, h('th', { scope: 'row' }, 'Total'), numTd(Y.plan[type]), numTd(Y.fact[type]), pctTd(Y.fact[type], Y.plan[type], MODE[type]))))));
        }

        grid.appendChild(h('div', { class: 'tk-stack' }, flux, big));
        grid.appendChild(monthTable('venit', 'sage'));
        grid.appendChild(monthTable('cheltuiala'));
        grid.appendChild(monthTable('factura'));
        grid.appendChild(fin);
        grid.appendChild(monthTable('datorie'));
        grid.appendChild(monthTable('economie', 'sage'));

        /* notițe */
        var ta = h('textarea', { class: 'tk-textarea fin-notes', id: 'fin-notes', 'aria-label': 'Notițe pentru ' + y, placeholder: 'Obiective, observații, idei pentru anul ' + y + '…' }, s.notes[String(y)] || '');
        var status = h('span', { class: 'tk-muted fin-notes-status', 'aria-live': 'polite' }, '');
        flushNote();
        var yNote = y;
        notePending = null;
        saveNote = TK.debounce(function () {
          if (!notePending) return;
          var v = notePending.value;
          notePending = null;
          if (v.trim()) S().notes[String(yNote)] = v; else delete S().notes[String(yNote)];
          api.commit();
          if (status.isConnected) status.textContent = 'Salvat';
        }, 600);
        ta.addEventListener('input', function () { notePending = ta; status.textContent = 'Se salvează…'; saveNote(); });
        grid.appendChild(h('article', { class: 'tk-card' },
          cardHead('Notițe'),
          h('div', { class: 'tk-card__body fin-notes-body' }, ta, status)));

        grid.appendChild(chartCard('Venituri vs cheltuieli pe luni', function (box) {
          TK.charts.bars(box, {
            labels: D.MONTHS_SHORT.map(function (x) { return x.replace('.', ''); }),
            series: [
              { name: 'Venituri', values: Y.months.map(function (mm) { return mm.factTot.venit; }), color: 'var(--chart-plan)' },
              { name: 'Cheltuieli, facturi și datorii', values: Y.months.map(function (mm) { return mm.factTot.cheltuiala + mm.factTot.factura + mm.factTot.datorie; }), color: 'var(--chart-fact)' },
            ],
            height: 220, format: fmt.lei, label: 'Venituri și cheltuieli pe luni',
          });
        }, charts, 'fin-span-4'));

        body.appendChild(grid);
        body.appendChild(h('p', { class: 'tk-note' }, 'Toate cele 12 luni se adună într-o singură imagine financiară.'));
        charts.forEach(function (fn) { fn(); });
        restoreFocus(focus, body);
      }
      cleanups.push(flushNote);
      render();
    }

    /* ================================================== SETĂRI */

    function viewSettings() {
      function render() {
        var focus = captureFocus();
        var s = S();
        TK.clear(body);
        body.appendChild(h('div', { class: 'tk-hero fin-page-head' },
          h('div', { class: 'tk-rule', 'aria-hidden': 'true' }),
          h('h1', { class: 'tk-hero__title' }, 'Setări'),
          h('p', { class: 'tk-hero__sub' }, 'Categorii, termene, credite, ținte și soldul inițial')));

        var grid = h('div', { class: 'tk-grid tk-grid--2 fin-settings' });
        TYPES.forEach(function (t) { grid.appendChild(categoryCard(t)); });

        var ob = h('input', { class: 'tk-input num', id: 'fin-set-opening', type: 'text', inputmode: 'decimal', autocomplete: 'off', value: fmt.num(s.openingBalance || 0) });
        ob.addEventListener('change', function () {
          var v = fmt.parseNum(ob.value);
          if (v == null) { TK.ui.toast('Scrie o sumă validă.'); ob.value = fmt.num(S().openingBalance || 0); return; }
          S().openingBalance = r2(v);
          api.commit();
          ob.value = fmt.num(S().openingBalance);
          TK.ui.toast('Soldul inițial a fost salvat.');
        });
        grid.appendChild(h('article', { class: 'tk-card tk-card--plain' },
          cardHead('Sold inițial', 'plain'),
          h('div', { class: 'tk-card__body tk-stack' },
            h('div', { class: 'tk-field' }, h('label', { class: 'tk-label', for: 'fin-set-opening' }, 'Suma disponibilă înainte de prima lună (lei)'), ob),
            h('p', { class: 'tk-muted' }, '„Sold reportat” al fiecărei luni pornește de la această sumă și adună rezultatul lunilor anterioare.'))));

        var n = s.transactions.length;
        var nPlans = Object.keys(s.plans).length;
        grid.appendChild(h('article', { class: 'tk-card tk-card--plain' },
          cardHead('Zonă periculoasă', 'plain'),
          h('div', { class: 'tk-card__body tk-stack' },
            h('p', { class: 'tk-muted' }, 'Ai ' + n + (n === 1 ? ' tranzacție' : ' tranzacții') + ' și planuri pentru ' + nPlans + (nPlans === 1 ? ' lună' : ' luni') + '. Fă mai întâi o copie de rezervă din pagina principală.'),
            h('div', { class: 'tk-row' },
              h('button', { type: 'button', class: 'tk-btn tk-btn--danger', id: 'fin-set-clear-tx', disabled: !n, onclick: function () {
                TK.ui.confirm({
                  title: 'Golești toate tranzacțiile?',
                  text: 'Se șterg toate cele ' + n + ' tranzacții. Categoriile, planurile, termenele și țintele rămân. Acțiunea nu poate fi anulată.',
                  ok: 'Golește tranzacțiile', danger: true,
                }).then(function (yes) {
                  if (!yes) return;
                  S().transactions = [];
                  api.commit();
                  TK.ui.toast('Toate tranzacțiile au fost șterse.');
                  render();
                });
              } }, 'Golește toate tranzacțiile'),
              h('button', { type: 'button', class: 'tk-btn tk-btn--ghost', id: 'fin-set-clear-plans', disabled: !nPlans, onclick: function () {
                TK.ui.confirm({
                  title: 'Ștergi toate planurile?',
                  text: 'Se șterg sumele planificate din toate cele ' + nPlans + ' luni. Tranzacțiile rămân.',
                  ok: 'Șterge planurile', danger: true,
                }).then(function (yes) {
                  if (!yes) return;
                  S().plans = {};
                  api.commit();
                  TK.ui.toast('Planurile au fost șterse.');
                  render();
                });
              } }, 'Șterge toate planurile')))));

        body.appendChild(grid);
        restoreFocus(focus, body);
      }


      function categoryCard(type) {
        var s = S();
        var cats = s.categories[type];
        var mk = extraMap(type);
        var head = [th('#', 'idx'), th('Categorie')];
        if (type === 'factura') head.push(th('Termen (zi)', 'num'));
        if (type === 'datorie') head.push(th('Termen (zi)', 'num'), th('Total credit (lei)', 'num'));
        if (type === 'economie') head.push(th('Țintă (lei)', 'num'));
        head.push(th(h('span', { class: 'tk-sr' }, 'Acțiuni')));

        function numInput(id, label, val, onSave, isDay) {
          var inp = h('input', { class: 'tk-cell-input', id: id, type: 'text', inputmode: isDay ? 'numeric' : 'decimal', autocomplete: 'off', value: val ? (isDay ? String(val) : fmt.num(val)) : '', placeholder: '—', 'aria-label': label });
          inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); inp.blur(); } });
          inp.addEventListener('change', function () {
            var v = fmt.parseNum(inp.value);
            if (inp.value.trim() !== '' && (v == null || v < 0 || (isDay && (v < 1 || v > 31 || v % 1)))) {
              TK.ui.toast(isDay ? 'Termenul este o zi din lună, de la 1 la 31.' : 'Scrie o sumă validă.');
              inp.value = val ? (isDay ? String(val) : fmt.num(val)) : '';
              return;
            }
            onSave(v == null ? 0 : (isDay ? v : r2(v)));
            val = v;
            inp.value = v ? (isDay ? String(v) : fmt.num(v)) : '';
            api.commit();
          });
          return inp;
        }

        var rows = cats.map(function (c, i) {
          var base = 'fin-set-' + type + '-' + i;
          var name = h('input', { class: 'tk-cell-input', id: base + '-name', type: 'text', value: c, autocomplete: 'off', 'aria-label': 'Nume categorie ' + c });
          name.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); name.blur(); } if (e.key === 'Escape') { name.value = c; name.blur(); } });
          name.addEventListener('change', function () {
            var v = name.value.trim().replace(/\s+/g, ' ');
            if (!v) { TK.ui.toast('Numele nu poate fi gol.'); name.value = c; return; }
            if (v === c) { name.value = c; return; }
            if (S().categories[type].indexOf(v) !== -1) { TK.ui.toast('Există deja categoria „' + v + '”.'); name.value = c; return; }
            rename(type, c, v);
            TK.ui.toast('Categoria a fost redenumită în „' + v + '”. Tranzacțiile și planurile au fost actualizate.');
            setTimeout(render, 0);
          });
          var cells = [h('td', { class: 'idx' }, h('span', { class: 'tk-swatch', style: { '--c': PALETTE[i % PALETTE.length] }, 'aria-hidden': 'true' })), h('td', null, name)];
          var ex = mk ? (s[mk][c] || (s[mk][c] = type === 'factura' ? { dueDay: 1 } : type === 'datorie' ? { dueDay: 1, total: 0 } : { target: 0 })) : null;
          if (type === 'factura' || type === 'datorie') {
            cells.push(h('td', { class: 'num' }, numInput(base + '-due', 'Termen ' + c + ' (ziua din lună)', ex.dueDay, function (v) { ex.dueDay = v || null; }, true)));
          }
          if (type === 'datorie') cells.push(h('td', { class: 'num' }, numInput(base + '-total', 'Total credit ' + c, ex.total, function (v) { ex.total = v; })));
          if (type === 'economie') cells.push(h('td', { class: 'num' }, numInput(base + '-target', 'Țintă ' + c, ex.target, function (v) { ex.target = v; })));
          cells.push(h('td', { class: 'fin-actions' },
            h('button', { type: 'button', class: 'tk-icon-btn', id: base + '-up', 'aria-label': 'Mută „' + c + '” mai sus', disabled: i === 0, onclick: function () { move(type, i, -1); } }, '↑'),
            h('button', { type: 'button', class: 'tk-icon-btn', id: base + '-down', 'aria-label': 'Mută „' + c + '” mai jos', disabled: i === cats.length - 1, onclick: function () { move(type, i, 1); } }, '↓'),
            h('button', { type: 'button', class: 'tk-icon-btn fin-del', id: base + '-del', 'aria-label': 'Șterge categoria „' + c + '”', onclick: function () { askRemove(type, c, render); } }, '✕')));
          return h('tr', null, cells);
        });

        var addId = 'fin-set-' + type + '-new';
        var addInp = h('input', { class: 'tk-input', id: addId, type: 'text', placeholder: 'Categorie nouă', autocomplete: 'off' });
        var addForm = h('form', { class: 'fin-set-add', novalidate: true },
          h('label', { class: 'tk-sr', for: addId }, 'Categorie nouă pentru ' + PLURAL[type].toLowerCase()),
          addInp,
          h('button', { type: 'submit', class: 'tk-btn tk-btn--sm', id: addId + '-btn' }, 'Adaugă'));
        addForm.addEventListener('submit', function (e) {
          e.preventDefault();
          var v = addInp.value.trim().replace(/\s+/g, ' ');
          if (!v) { addInp.focus(); return; }
          if (S().categories[type].indexOf(v) !== -1) { TK.ui.toast('Există deja categoria „' + v + '”.'); return; }
          S().categories[type].push(v);
          var mk2 = extraMap(type);
          if (mk2) S()[mk2][v] = type === 'factura' ? { dueDay: 1 } : type === 'datorie' ? { dueDay: 1, total: 0 } : { target: 0 };
          api.commit();
          TK.ui.toast('Categoria „' + v + '” a fost adăugată.');
          render();
          restoreFocus({ id: addId });
        });

        return h('article', { class: 'tk-card' + (type === 'venit' || type === 'economie' ? ' tk-card--sage' : ''), id: 'fin-set-card-' + type },
          cardHead([PLURAL[type] + ' ', h('b', null, '· categorii')], type === 'venit' || type === 'economie' ? 'sage' : null),
          h('div', { class: 'tk-card__body tk-card__body--flush tk-scroll' },
            h('table', { class: 'tk-table tk-table--dense fin-table fin-set-table' },
              h('thead', null, h('tr', null, head)),
              h('tbody', null, rows.length ? rows : h('tr', null, h('td', { colspan: head.length, class: 'tk-muted tk-center' }, 'Nicio categorie.'))))),
          h('div', { class: 'tk-card__body fin-set-foot' }, addForm));
      }

      function move(type, i, d) {
        var cats = S().categories[type];
        var j = i + d;
        if (j < 0 || j >= cats.length) return;
        var tmp = cats[i]; cats[i] = cats[j]; cats[j] = tmp;
        api.commit();
        render();
        restoreFocus({ id: 'fin-set-' + type + '-' + j + (d < 0 ? '-up' : '-down') });
      }


      render();
    }

    /* ---- pornire ---- */
    if (route === 'tranzactii') viewTransactions();
    else if (route === 'trackere') viewTrackers();
    else if (route === 'anual') viewYear();
    else if (route === 'setari') viewSettings();
    else viewMonth();

    return {
      unmount: function () { cleanups.forEach(function (fn) { try { fn(); } catch (e) { /* */ } }); },
    };
  }

  // expus pentru teste
  TK.financeModel = { buildIndex: buildIndex, monthModel: monthModel, yearModel: yearModel, cumulative: cumulative };

  var DEF = {
    id: 'finance',
    slug: 'finante',
    name: 'Tracker financiar',
    short: 'Finanțe',
    tone: 'rose',
    tagline: 'Venituri, cheltuieli, facturi, datorii și economii — plan și realizat, pe lună și pe an.',
    version: 1,
    createDemo: createDemo,
    createEmpty: createEmpty,
    migrate: migrate,
    summary: summary,
    mount: mount,
  };

  TK.register(DEF);
})();
