/*
 * Trackere — nucleul comun.
 * Expune `window.TK`: construire DOM, formatare (lei, procente, date în română),
 * utilitare de dată, preferințe per vizitator, dialoguri în pagină și
 * depozitul de date (localStorage + sincronizare în cont prin capabilitatea `db`).
 * Scripturi clasice (fără module), ca aplicația să meargă și deschisă direct din fișier.
 */
(function () {
  'use strict';

  var TK = (window.TK = window.TK || {});

  /* ------------------------------------------------------------------ DOM */

  // h('div', {class: 'x', onclick: fn, dataset: {id: 1}}, 'text', child, [more])
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
        var v = attrs[k];
        if (v == null || v === false) continue;
        if (k === 'class' || k === 'className') el.className = v;
        else if (k === 'style' && typeof v === 'object') {
          for (var s in v) {
            if (s.indexOf('--') === 0) el.style.setProperty(s, v[s]);
            else el.style[s] = v[s];
          }
        } else if (k === 'dataset') {
          for (var d in v) el.dataset[d] = v[d];
        } else if (k === 'html') el.innerHTML = v;
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') {
          el.addEventListener(k.slice(2).toLowerCase(), v);
        } else if (k === 'value' || k === 'checked' || k === 'selected' || k === 'disabled' || k === 'indeterminate') {
          el[k] = v;
        } else if (v === true) el.setAttribute(k, '');
        else el.setAttribute(k, String(v));
      }
    }
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }

  function append(el, child) {
    if (child == null || child === false || child === true) return;
    if (Array.isArray(child)) {
      for (var i = 0; i < child.length; i++) append(el, child[i]);
    } else if (child instanceof Node) el.appendChild(child);
    else el.appendChild(document.createTextNode(String(child)));
  }

  function clear(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
    return el;
  }

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  TK.h = h;
  TK.append = append;
  TK.clear = clear;
  TK.esc = esc;

  /* -------------------------------------------------------------- general */

  TK.uid = function () {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  };

  TK.clone = function (obj) {
    return obj == null ? obj : JSON.parse(JSON.stringify(obj));
  };

  TK.debounce = function (fn, ms) {
    var t;
    function d() {
      var args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms);
    }
    d.flush = function () { clearTimeout(t); fn(); };
    d.cancel = function () { clearTimeout(t); };
    return d;
  };

  TK.sum = function (arr, fn) {
    var s = 0;
    for (var i = 0; i < arr.length; i++) {
      var v = fn ? fn(arr[i], i) : arr[i];
      if (typeof v === 'number' && isFinite(v)) s += v;
    }
    return s;
  };

  TK.groupBy = function (arr, fn) {
    var out = {};
    for (var i = 0; i < arr.length; i++) {
      var k = fn(arr[i]);
      (out[k] = out[k] || []).push(arr[i]);
    }
    return out;
  };

  // ratio sigur: 0 dacă numitorul e 0
  TK.ratio = function (a, b) {
    return b ? a / b : 0;
  };

  /* ----------------------------------------------------------- formatare */

  var NBSP = ' ';

  function groupThousands(intStr) {
    return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  }

  // 1500.5 -> "1 500,50"
  function num(n, dec) {
    if (dec == null) dec = 2;
    if (n == null || n === '' || !isFinite(n)) return '—';
    var neg = n < 0;
    var fixed = Math.abs(Number(n)).toFixed(dec);
    var parts = fixed.split('.');
    var out = groupThousands(parts[0]) + (parts[1] ? ',' + parts[1] : '');
    return (neg && Number(fixed) !== 0 ? '−' : '') + out;
  }

  var fmt = {
    num: num,
    // 1500 -> "1 500,00 lei"
    lei: function (n, dec) {
      if (n == null || n === '' || !isFinite(n)) return '—';
      return num(n, dec == null ? 2 : dec) + NBSP + 'lei';
    },
    // 1500 -> "1 500 lei" (pentru axe și spații mici)
    leiShort: function (n) {
      if (n == null || !isFinite(n)) return '—';
      var a = Math.abs(n);
      if (a >= 1e6) return num(n / 1e6, a >= 1e7 ? 0 : 1) + NBSP + 'mil.';
      if (a >= 1e4) return num(n / 1e3, 0) + NBSP + 'mii';
      return num(n, 0);
    },
    // 0.6667 -> "66,67%"
    pct: function (ratio, dec) {
      if (ratio == null || !isFinite(ratio)) return '—';
      return num(ratio * 100, dec == null ? 2 : dec) + '%';
    },
    // "1 500,50" / "1500.5" / "1.500,50" -> 1500.5 ; gol -> null
    parseNum: function (str) {
      if (typeof str === 'number') return isFinite(str) ? str : null;
      if (str == null) return null;
      var s = String(str).replace(/[\s  lei]/gi, '').replace(/−/g, '-');
      if (s === '') return null;
      if (s.indexOf(',') !== -1) s = s.replace(/\./g, '').replace(',', '.');
      var v = parseFloat(s);
      return isFinite(v) ? v : null;
    },
  };

  /* ---------------------------------------------------------------- date */

  var MONTHS = ['Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie', 'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie'];
  var MONTHS_SHORT = ['ian.', 'feb.', 'mar.', 'apr.', 'mai', 'iun.', 'iul.', 'aug.', 'sept.', 'oct.', 'nov.', 'dec.'];
  var WEEKDAYS = ['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă', 'Duminică'];
  var WEEKDAYS_SHORT = ['Lu', 'Ma', 'Mi', 'Jo', 'Vi', 'Sâ', 'Du'];

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  var date = {
    MONTHS: MONTHS,
    MONTHS_SHORT: MONTHS_SHORT,
    WEEKDAYS: WEEKDAYS,
    WEEKDAYS_SHORT: WEEKDAYS_SHORT,

    // Date -> "2026-09-27" (ora locală)
    iso: function (d) {
      return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    },
    today: function () { return date.iso(new Date()); },
    // "2026-09-27" -> Date la miezul nopții local
    parse: function (iso) {
      if (!iso) return null;
      var p = String(iso).split('-');
      if (p.length < 3) return null;
      var d = new Date(+p[0], +p[1] - 1, +p[2]);
      return isNaN(d) ? null : d;
    },
    make: function (y, m, d) { return y + '-' + pad(m + 1) + '-' + pad(d); }, // m: 0-11
    year: function (iso) { return +String(iso).slice(0, 4); },
    month: function (iso) { return +String(iso).slice(5, 7) - 1; }, // 0-11
    day: function (iso) { return +String(iso).slice(8, 10); },
    ym: function (iso) { return String(iso).slice(0, 7); }, // "2026-09"
    daysInMonth: function (y, m) { return new Date(y, m + 1, 0).getDate(); },
    addDays: function (iso, n) {
      var d = date.parse(iso);
      d.setDate(d.getDate() + n);
      return date.iso(d);
    },
    // zile de la a la b (b - a), ignorând ora de vară
    diffDays: function (a, b) {
      var da = date.parse(a), db = date.parse(b);
      if (!da || !db) return null;
      return Math.round((Date.UTC(db.getFullYear(), db.getMonth(), db.getDate()) - Date.UTC(da.getFullYear(), da.getMonth(), da.getDate())) / 864e5);
    },
    // 0 = luni … 6 = duminică
    weekday: function (iso) {
      var d = date.parse(iso);
      return (d.getDay() + 6) % 7;
    },
    // luni din săptămâna care conține ziua
    startOfWeek: function (iso) { return date.addDays(iso, -date.weekday(iso)); },
    // zilele lunii împărțite în bucăți de 7 începând cu ziua 1 (ca în foile de calcul)
    // -> [[1..7],[8..14],…]
    chunkWeeks: function (y, m) {
      var n = date.daysInMonth(y, m), out = [];
      for (var d = 1; d <= n; d += 7) {
        var w = [];
        for (var i = d; i < d + 7 && i <= n; i++) w.push(i);
        out.push(w);
      }
      return out;
    },
    // grilă de calendar (săptămâni luni→duminică) cu zile din lunile vecine
    // -> [[{iso, day, inMonth}, …7], …]
    calendarGrid: function (y, m) {
      var first = date.make(y, m, 1);
      var start = date.startOfWeek(first);
      var last = date.make(y, m, date.daysInMonth(y, m));
      var end = date.addDays(date.startOfWeek(last), 6);
      var weeks = [], cur = start;
      while (date.diffDays(cur, end) >= 0) {
        var w = [];
        for (var i = 0; i < 7; i++) {
          w.push({ iso: cur, day: date.day(cur), inMonth: date.month(cur) === m && date.year(cur) === y });
          cur = date.addDays(cur, 1);
        }
        weeks.push(w);
      }
      return weeks;
    },
  };

  // "2026-01-05" -> "05 ian. 2026"
  fmt.date = function (iso) {
    var d = date.parse(iso);
    if (!d) return '—';
    return pad(d.getDate()) + ' ' + MONTHS_SHORT[d.getMonth()] + ' ' + d.getFullYear();
  };
  // "2026-01-05" -> "05 ian."
  fmt.dateShort = function (iso) {
    var d = date.parse(iso);
    if (!d) return '—';
    return pad(d.getDate()) + ' ' + MONTHS_SHORT[d.getMonth()];
  };
  fmt.month = function (m) { return MONTHS[m]; };
  fmt.monthYear = function (y, m) { return MONTHS[m] + ' ' + y; };
  // 1 -> "1 zi", 5 -> "5 zile", 25 -> "25 de zile"
  fmt.days = function (n) {
    var a = Math.abs(n);
    if (a === 1) return n + ' zi';
    if (a === 0 || a % 100 < 20) return n + ' zile';
    return n + ' de zile';
  };

  TK.fmt = fmt;
  TK.date = date;

  /* ------------------------------------------------ preferințe per vizitator */

  var PREF_PREFIX = 'tk:pref:';
  TK.prefs = {
    get: function (key, def) {
      try {
        var raw = localStorage.getItem(PREF_PREFIX + key);
        return raw == null ? def : JSON.parse(raw);
      } catch (e) { return def; }
    },
    set: function (key, val) {
      try { localStorage.setItem(PREF_PREFIX + key, JSON.stringify(val)); } catch (e) { /* stocare indisponibilă */ }
    },
    scope: function (ns) {
      return {
        get: function (k, def) { return TK.prefs.get(ns + ':' + k, def); },
        set: function (k, v) { TK.prefs.set(ns + ':' + k, v); },
      };
    },
  };

  /* ------------------------------------------------------------- UI: dialoguri */

  var ui = {};
  var toastTimer;

  ui.toast = function (msg) {
    var el = document.querySelector('.tk-toast');
    if (!el) {
      el = h('div', { class: 'tk-toast', role: 'status', 'aria-live': 'polite' });
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.hidden = false;
    el.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.classList.remove('is-visible');
      el.hidden = true;
    }, 2600);
  };

  // Deschide o fereastră modală. Returnează funcția close().
  // opts: {title, content: Node|string, actions: [{label, kind:'primary|ghost|danger', onClick(close) -> false ca să rămână deschisă}], onClose}
  ui.modal = function (opts) {
    var prevFocus = document.activeElement;
    var box = h('div', { class: 'tk-modal__box', role: 'dialog', 'aria-modal': 'true', 'aria-label': opts.title || 'Dialog' });
    var backdrop = h('div', { class: 'tk-modal' }, box);
    var closed = false;

    function close() {
      if (closed) return;
      closed = true;
      document.removeEventListener('keydown', onKey, true);
      backdrop.remove();
      if (opts.onClose) opts.onClose();
      if (prevFocus && prevFocus.focus) {
        try { prevFocus.focus(); } catch (e) { /* elementul poate lipsi */ }
      }
    }
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
    }

    if (opts.title) box.appendChild(h('h2', { class: 'tk-modal__title' }, opts.title));
    if (opts.content != null) {
      box.appendChild(typeof opts.content === 'string' ? h('p', { class: 'tk-muted' }, opts.content) : opts.content);
    }
    var actions = (opts.actions || [{ label: 'Închide', kind: 'ghost' }]).map(function (a) {
      return h('button', {
        type: a.submit ? 'submit' : 'button',
        form: a.submit ? a.form : null,
        class: 'tk-btn' + (a.kind ? ' tk-btn--' + a.kind : ''),
        onclick: a.submit ? null : function () {
          var r = a.onClick ? a.onClick(close) : undefined;
          if (r !== false) close();
        },
      }, a.label);
    });
    box.appendChild(h('div', { class: 'tk-modal__actions' }, actions));

    backdrop.addEventListener('mousedown', function (e) { if (e.target === backdrop) close(); });
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(backdrop);

    var focusable = box.querySelector('input, select, textarea, button');
    if (focusable) setTimeout(function () { focusable.focus(); }, 0);
    return close;
  };

  // Confirmare în pagină (confirm() nu funcționează în vizualizator).
  // -> Promise<boolean>
  ui.confirm = function (opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var done = false;
      function finish(v) { if (!done) { done = true; resolve(v); } }
      ui.modal({
        title: opts.title || 'Ești sigur?',
        content: opts.text || null,
        onClose: function () { finish(false); },
        actions: [
          { label: opts.cancel || 'Anulează', kind: 'ghost', onClick: function () { finish(false); } },
          { label: opts.ok || 'Confirmă', kind: opts.danger ? 'danger' : 'primary', onClick: function () { finish(true); } },
        ],
      });
    });
  };

  // Formular în fereastră modală.
  // fields: [{name, label, type:'text|number|money|date|select|textarea|checkbox|color', options:[{value,label}]|[string], value, required, placeholder, min, max, step, hint}]
  // -> Promise<object|null>  (null = anulat). Sumele (`money`/`number`) sunt returnate ca număr sau null.
  ui.form = function (opts) {
    return new Promise(function (resolve) {
      var formId = 'tk-form-' + TK.uid();
      var done = false;
      function finish(v) { if (!done) { done = true; resolve(v); } }

      var controls = {};
      var form = h('form', { id: formId, class: 'tk-stack', novalidate: true });
      (opts.fields || []).forEach(function (f) {
        var id = formId + '-' + f.name;
        var ctl;
        if (f.type === 'select') {
          ctl = h('select', { id: id, class: 'tk-select', name: f.name },
            (f.options || []).map(function (o) {
              var val = typeof o === 'object' ? o.value : o;
              var lab = typeof o === 'object' ? o.label : o;
              return h('option', { value: val, selected: String(val) === String(f.value) }, lab);
            }));
        } else if (f.type === 'textarea') {
          ctl = h('textarea', { id: id, class: 'tk-textarea', name: f.name, rows: f.rows || 3, placeholder: f.placeholder }, f.value || '');
        } else if (f.type === 'checkbox') {
          ctl = h('input', { id: id, type: 'checkbox', class: 'tk-check', name: f.name, checked: !!f.value });
        } else {
          var isNum = f.type === 'number' || f.type === 'money';
          ctl = h('input', {
            id: id,
            class: 'tk-input',
            name: f.name,
            type: isNum ? 'text' : (f.type || 'text'),
            inputmode: isNum ? 'decimal' : null,
            value: f.value == null ? '' : (f.type === 'money' ? num(f.value, 2).replace(/ /g, ' ') : f.value),
            placeholder: f.placeholder,
            min: f.min, max: f.max, step: f.step,
            autocomplete: 'off',
          });
        }
        controls[f.name] = { el: ctl, def: f };
        var label = h('label', { class: 'tk-label', for: id }, f.label + (f.required ? ' *' : ''));
        if (f.type === 'checkbox') {
          form.appendChild(h('div', { class: 'tk-field tk-field--inline' }, ctl, label));
        } else {
          form.appendChild(h('div', { class: 'tk-field' }, label, ctl, f.hint ? h('small', { class: 'tk-muted' }, f.hint) : null));
        }
      });
      var err = h('p', { class: 'tk-form-error', role: 'alert', hidden: true });
      form.appendChild(err);

      var close;
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var out = {}, bad = null;
        for (var name in controls) {
          var c = controls[name], f = c.def, v;
          if (f.type === 'checkbox') v = c.el.checked;
          else if (f.type === 'number' || f.type === 'money') {
            v = fmt.parseNum(c.el.value);
            if (c.el.value.trim() !== '' && v == null) bad = bad || ('„' + f.label + '” trebuie să fie un număr.');
          } else v = c.el.value.trim();
          if (f.required && (v == null || v === '')) bad = bad || ('Completează „' + f.label + '”.');
          out[name] = v;
        }
        if (!bad && opts.validate) bad = opts.validate(out) || null;
        if (bad) {
          err.textContent = bad;
          err.hidden = false;
          return;
        }
        finish(out);
        close();
      });

      var actions = [{ label: opts.cancel || 'Anulează', kind: 'ghost', onClick: function () { finish(null); } }];
      if (opts.onDelete) {
        actions.unshift({
          label: opts.deleteLabel || 'Șterge',
          kind: 'danger',
          onClick: function () { finish({ __delete: true }); },
        });
      }
      actions.push({ label: opts.submit || 'Salvează', kind: 'primary', submit: true, form: formId });

      close = ui.modal({
        title: opts.title,
        content: form,
        onClose: function () { finish(null); },
        actions: actions,
      });
    });
  };

  TK.ui = ui;

  /* ------------------------------------------------------ platforma artifact */

  // Promisiune spre o capabilitate a vizualizatorului claude.ai sau null
  // (fișier local, alt host, capabilitate neacordată).
  TK.capability = function (name) {
    try {
      if (window.claude && typeof window.claude.use === 'function') {
        return window.claude.use(name).catch(function () { return null; });
      }
    } catch (e) { /* ignorăm */ }
    return Promise.resolve(null);
  };

  // Salvează un fișier: prin capabilitatea `downloads` în vizualizator,
  // altfel printr-un link local (fișier deschis direct din disc).
  TK.saveFile = function (filename, text, mime) {
    return TK.capability('downloads').then(function (dl) {
      if (dl) {
        return dl.save({ filename: filename, data: new Blob([text], { type: mime || 'application/json' }) })
          .then(function () { return true; })
          .catch(function () { return false; });
      }
      if (window.claude) return false; // în vizualizator, un link de descărcare e blocat
      try {
        var blob = new Blob([text], { type: mime || 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = h('a', { href: url, download: filename, hidden: true });
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1000);
        return true;
      } catch (e) { return false; }
    });
  };

  // Deschide selectorul de fișiere și citește un JSON. -> Promise<object|null>
  TK.pickJSON = function () {
    return new Promise(function (resolve) {
      var input = h('input', { type: 'file', accept: 'application/json,.json', hidden: true });
      input.addEventListener('change', function () {
        var file = input.files && input.files[0];
        input.remove();
        if (!file) return resolve(null);
        var reader = new FileReader();
        reader.onload = function () {
          try { resolve(JSON.parse(reader.result)); } catch (e) { resolve({ __error: 'Fișierul nu este un JSON valid.' }); }
        };
        reader.onerror = function () { resolve({ __error: 'Fișierul nu a putut fi citit.' }); };
        reader.readAsText(file);
      });
      document.body.appendChild(input);
      input.click();
    });
  };

  /* ------------------------------------------------------------ depozit date */

  var LOCAL_PREFIX = 'tk:data:v1:';
  var MAX_DOC_BYTES = 250 * 1024;

  function readLocal(key) {
    try {
      var raw = localStorage.getItem(LOCAL_PREFIX + key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function writeLocal(key, state) {
    try { localStorage.setItem(LOCAL_PREFIX + key, JSON.stringify(state)); return true; } catch (e) { return false; }
  }

  /*
   * Store: starea unui tracker.
   *  - pornește din localStorage (sau din datele demo),
   *  - la fiecare commit() scrie local imediat și în cont (db) după o pauză,
   *  - când contul are o versiune mai nouă (alt dispozitiv), o adoptă și anunță `onReplace`.
   */
  function Store(key, def) {
    this.key = key;
    this.def = def;
    this.listeners = [];
    this.cloudRef = null;
    this.writing = false;
    this.pending = false;
    this.status = 'local'; // 'local' | 'cloud' | 'error'
    var s = readLocal(key);
    this.state = s ? this._migrate(s) : this._fresh(true);
    this._pushCloud = TK.debounce(this._flushCloud.bind(this), 700);
  }

  Store.prototype._fresh = function (demo) {
    var s = demo ? this.def.createDemo() : this.def.createEmpty();
    s.meta = { v: this.def.version || 1, rev: TK.uid(), updatedAt: 0, demo: !!demo };
    return s;
  };

  Store.prototype._migrate = function (s) {
    if (!s || typeof s !== 'object') return this._fresh(true);
    s.meta = s.meta || { v: 1, rev: TK.uid(), updatedAt: 0, demo: false };
    if (this.def.migrate) s = this.def.migrate(s) || s;
    return s;
  };

  Store.prototype.get = function () { return this.state; };

  // Salvează starea curentă (după ce ai modificat-o pe loc).
  Store.prototype.commit = function () {
    var m = this.state.meta || (this.state.meta = {});
    m.rev = TK.uid();
    m.updatedAt = Date.now();
    writeLocal(this.key, this.state);
    if (this.cloudRef) this._pushCloud();
  };

  // Înlocuiește toată starea (import, resetare) și anunță ascultătorii.
  Store.prototype.replace = function (next, opts) {
    this.state = this._migrate(next);
    if (!opts || !opts.fromCloud) this.commit();
    else writeLocal(this.key, this.state);
    this._emit();
  };

  Store.prototype.reset = function (demo) {
    this.replace(this._fresh(!!demo));
  };

  Store.prototype.onReplace = function (fn) {
    this.listeners.push(fn);
    var self = this;
    return function () { self.listeners = self.listeners.filter(function (f) { return f !== fn; }); };
  };

  Store.prototype._emit = function () {
    for (var i = 0; i < this.listeners.length; i++) {
      try { this.listeners[i](this.state); } catch (e) { console.error(e); }
    }
  };

  Store.prototype._flushCloud = function () {
    var self = this;
    if (!this.cloudRef) return;
    if (this.writing) { this.pending = true; return; }
    var body = TK.clone(this.state);
    var size = JSON.stringify(body).length;
    if (size > MAX_DOC_BYTES) {
      this.status = 'error';
      ui.toast('Datele sunt prea mari pentru sincronizare. Sunt salvate doar în acest browser.');
      TK.emitStatus();
      return;
    }
    this.writing = true;
    this.cloudRef.set(body).then(function () {
      self.status = 'cloud';
    }, function (e) {
      self.status = 'error';
      console.warn('Sincronizare eșuată', e);
      if (e && e.code === 'unavailable') setTimeout(function () { self._pushCloud(); }, 1500 + Math.random() * 1500);
    }).then(function () {
      self.writing = false;
      TK.emitStatus();
      if (self.pending) { self.pending = false; self._flushCloud(); }
    });
  };

  // Leagă depozitul de documentul `trackers/<key>` din baza de date a artifactului.
  Store.prototype.attachCloud = function (db) {
    var self = this;
    try { this.cloudRef = db.doc('trackers/' + this.key); } catch (e) { return; }
    this.cloudRef.onSnapshot(function (snap) {
      self.status = 'cloud';
      if (!snap.exists) {
        // Contul nu are încă datele: urcăm ce a lucrat utilizatorul local (nu și demo-ul neatins).
        if (self.state.meta && self.state.meta.updatedAt) self._pushCloud();
        TK.emitStatus();
        return;
      }
      if (snap.metadata && snap.metadata.hasPendingWrites) return;
      var remote = snap.data();
      var local = self.state.meta || {};
      var rmeta = (remote && remote.meta) || {};
      if (rmeta.rev === local.rev) { TK.emitStatus(); return; }
      if ((local.updatedAt || 0) > (rmeta.updatedAt || 0)) {
        // Modificări locale mai noi (făcute înainte să se conecteze contul).
        self._pushCloud();
      } else {
        self.replace(TK.clone(remote), { fromCloud: true });
      }
      TK.emitStatus();
    }, function (e) {
      self.status = 'error';
      self.cloudRef = null;
      console.warn('Sincronizare oprită', e);
      TK.emitStatus();
    });
  };

  TK.Store = Store;

  // starea sincronizării pentru bara de sus
  var statusListeners = [];
  TK.onStatus = function (fn) { statusListeners.push(fn); };
  TK.emitStatus = function () {
    for (var i = 0; i < statusListeners.length; i++) statusListeners[i]();
  };
})();
