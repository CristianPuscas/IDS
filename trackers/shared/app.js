/*
 * Trackere — aplicația-cadru.
 * Trackerele se înregistrează cu TK.register({...}); cadrul le montează după hash
 * (#finante, #obiceiuri-saptamanal …), ține bara de sus, pagina principală,
 * bannerul pentru datele exemplu, exportul / importul și sincronizarea în cont.
 */
(function () {
  'use strict';

  var TK = window.TK;
  var h = TK.h;
  var registry = [];
  var stores = {};

  /*
   * Trackerele se înregistrează cu TK.register(def) (definit în core.js):
   * def: {
   *   id, slug, name, short, tagline, version,
   *   createDemo() -> state, createEmpty() -> state, migrate?(state) -> state,
   *   summary?(state) -> [{label, value}]   (cartonașul de pe pagina principală)
   *   mount(el, api) -> {unmount?()}
   * }
   */

  function bySlug(slug) {
    for (var i = 0; i < registry.length; i++) if (registry[i].slug === slug) return registry[i];
    return null;
  }

  /* ---------------------------------------------------------------- rute */

  function parseHash() {
    var raw = (location.hash || '').replace(/^#/, '');
    var i = raw.indexOf('-');
    var slug = i === -1 ? raw : raw.slice(0, i);
    var sub = i === -1 ? '' : raw.slice(i + 1);
    return { slug: slug, sub: sub };
  }

  function go(slug, sub) {
    var target = '#' + (slug || 'acasa') + (sub ? '-' + sub : '');
    if (location.hash === target) route();
    else location.hash = target;
  }
  TK.go = go;

  /* ---------------------------------------------------------------- shell */

  var root, main, navLinks = {}, statusEl, current = null;

  function syncLabel() {
    var list = Object.keys(stores).map(function (k) { return stores[k]; });
    if (list.some(function (s) { return s.status === 'error'; })) return { text: 'Doar local', tone: 'bad', hint: 'Sincronizarea s-a întrerupt. Datele sunt salvate în acest browser.' };
    if (list.length && list.every(function (s) { return s.status === 'cloud'; })) return { text: 'Sincronizat', tone: 'good', hint: 'Datele sunt salvate în contul tău și apar pe toate dispozitivele.' };
    return { text: 'Salvat local', tone: 'grey', hint: 'Datele sunt salvate în acest browser.' };
  }

  function renderStatus() {
    if (!statusEl) return;
    var st = syncLabel();
    statusEl.textContent = '';
    statusEl.setAttribute('data-tone', st.tone);
    statusEl.title = st.hint;
    statusEl.appendChild(h('span', { class: 'tk-dot' }));
    statusEl.appendChild(document.createTextNode(st.text));
  }
  TK.onStatus(renderStatus);

  function buildShell() {
    root = document.getElementById('app');
    TK.clear(root);
    var nav = h('nav', { class: 'tk-nav', 'aria-label': 'Trackere' });
    navLinks.acasa = h('a', { class: 'tk-nav__link', href: '#acasa' }, 'Acasă');
    nav.appendChild(navLinks.acasa);
    registry.forEach(function (def) {
      navLinks[def.slug] = h('a', { class: 'tk-nav__link', href: '#' + def.slug }, def.short);
      nav.appendChild(navLinks[def.slug]);
    });
    statusEl = h('span', { class: 'tk-pill tk-sync', 'data-tone': 'grey' });
    var bar = h('header', { class: 'tk-topbar' },
      h('a', { class: 'tk-brand', href: '#acasa' }, 'Trackere'),
      nav,
      statusEl
    );
    main = h('main', { class: 'tk-main', id: 'tk-main', tabindex: '-1' });
    root.appendChild(bar);
    root.appendChild(main);
    renderStatus();
  }

  function setActiveNav(slug) {
    for (var k in navLinks) {
      var on = k === slug;
      navLinks[k].classList.toggle('is-active', on);
      if (on) navLinks[k].setAttribute('aria-current', 'page');
      else navLinks[k].removeAttribute('aria-current');
    }
  }

  function unmountCurrent() {
    if (current && current.instance && current.instance.unmount) {
      try { current.instance.unmount(); } catch (e) { console.error(e); }
    }
    current = null;
  }

  function route() {
    var r = parseHash();
    var def = bySlug(r.slug);
    var prevSlug = current && current.slug;
    unmountCurrent();
    TK.clear(main);
    if (!def) {
      setActiveNav('acasa');
      document.title = 'Trackere Personale';
      renderHome();
      current = { slug: 'acasa' };
    } else {
      setActiveNav(def.slug);
      document.title = def.name + ' · Trackere';
      mountTracker(def, r.sub);
    }
    if (prevSlug !== (def ? def.slug : 'acasa')) window.scrollTo(0, 0);
  }

  /* ------------------------------------------------------ montare tracker */

  function demoBanner(def, store) {
    if (!store.get().meta || !store.get().meta.demo) return null;
    return h('div', { class: 'tk-demo-banner', role: 'note' },
      h('span', null, h('b', null, 'Date exemplu. '), 'Așa arată trackerul completat. Poți lucra direct pe ele sau începe de la zero.'),
      h('span', { class: 'tk-row' },
        h('button', {
          type: 'button', class: 'tk-btn tk-btn--sm tk-btn--ghost',
          onclick: function () {
            store.get().meta.demo = false;
            store.commit();
            route();
          },
        }, 'Păstrează exemplele'),
        h('button', {
          type: 'button', class: 'tk-btn tk-btn--sm tk-btn--primary',
          onclick: function () {
            TK.ui.confirm({
              title: 'Începi de la zero?',
              text: 'Datele exemplu din „' + def.name + '” vor fi șterse. Categoriile și setările de bază rămân.',
              ok: 'Începe de la zero',
              danger: true,
            }).then(function (yes) {
              if (yes) { store.reset(false); TK.ui.toast('Trackerul este gol și pregătit.'); }
            });
          },
        }, 'Începe de la zero')
      )
    );
  }

  function mountTracker(def, sub) {
    var store = stores[def.id];
    var host = h('div', { class: 'tk-page tk-tracker tk-tracker--' + def.id });
    var banner = demoBanner(def, store);
    if (banner) main.appendChild(h('div', { class: 'tk-page tk-page--banner' }, banner));
    main.appendChild(host);
    var api = {
      id: def.id,
      el: host,
      store: store,
      get state() { return store.get(); },
      commit: function () { store.commit(); },
      route: sub || '',
      go: function (s) { go(def.slug, s); },
      prefs: TK.prefs.scope(def.id),
      h: TK.h, fmt: TK.fmt, date: TK.date, charts: TK.charts, ui: TK.ui,
    };
    var instance = null;
    try {
      instance = def.mount(host, api) || null;
    } catch (e) {
      console.error(e);
      TK.clear(host);
      host.appendChild(h('div', { class: 'tk-empty' },
        h('p', null, 'Trackerul nu a putut fi afișat.'),
        h('p', { class: 'tk-muted' }, String(e && e.message || e)),
        h('button', { type: 'button', class: 'tk-btn', onclick: function () { store.reset(true); } }, 'Reîncarcă datele exemplu')
      ));
    }
    current = { slug: def.slug, def: def, instance: instance };
  }

  /* ------------------------------------------------------- pagina principală */

  function renderHome() {
    var page = h('div', { class: 'tk-page tk-home' });
    page.appendChild(h('div', { class: 'tk-hero' },
      h('h1', { class: 'tk-hero__title' }, 'Trackere'),
      h('p', { class: 'tk-hero__sub' }, 'Finanțe · Obiceiuri · Sarcini')
    ));
    page.appendChild(h('p', { class: 'tk-note' },
      'Trei trackere legate într-un singur loc. Introduci datele o singură dată, iar sumarele, procentele și graficele se calculează singure.'));

    var grid = h('div', { class: 'tk-grid tk-grid--3' });
    registry.forEach(function (def) {
      var store = stores[def.id];
      var items = [];
      try { items = def.summary ? def.summary(store.get()) : []; } catch (e) { console.error(e); }
      grid.appendChild(h('article', { class: 'tk-card tk-home__card' },
        h('div', { class: 'tk-card__head tk-card__head--' + (def.tone || 'rose') },
          h('h2', { class: 'tk-card__title' }, def.name)),
        h('div', { class: 'tk-card__body tk-stack' },
          h('p', { class: 'tk-muted' }, def.tagline),
          items.length ? h('dl', { class: 'tk-home__stats' }, items.map(function (it) {
            return h('div', null, h('dt', { class: 'tk-kpi__label' }, it.label), h('dd', { class: 'tk-kpi__value' }, it.value));
          })) : null,
          h('a', { class: 'tk-btn tk-btn--primary', href: '#' + def.slug }, 'Deschide ' + def.short.toLowerCase())
        )
      ));
    });
    page.appendChild(grid);
    page.appendChild(dataCard());
    main.appendChild(page);
  }

  function dataCard() {
    var st = syncLabel();
    return h('section', { class: 'tk-card tk-home__data' },
      h('div', { class: 'tk-card__head tk-card__head--plain' }, h('h2', { class: 'tk-card__title' }, 'Datele tale')),
      h('div', { class: 'tk-card__body tk-stack' },
        h('p', null, h('span', { class: 'tk-pill', 'data-tone': st.tone }, h('span', { class: 'tk-dot' }), st.text), ' ', st.hint),
        h('p', { class: 'tk-muted' }, 'Fă din când în când o copie de rezervă. Cu ea poți muta datele pe alt dispozitiv sau le poți recupera.'),
        h('div', { class: 'tk-row' },
          h('button', { type: 'button', class: 'tk-btn', onclick: exportAll }, 'Exportă copia (JSON)'),
          h('button', { type: 'button', class: 'tk-btn', onclick: importAll }, 'Importă o copie'),
          h('button', { type: 'button', class: 'tk-btn tk-btn--ghost', onclick: resetDemo }, 'Reîncarcă exemplele')
        )
      )
    );
  }

  function exportAll() {
    var payload = { app: 'trackere', version: 1, exportedAt: new Date().toISOString(), trackers: {} };
    registry.forEach(function (def) { payload.trackers[def.id] = stores[def.id].get(); });
    var text = JSON.stringify(payload, null, 2);
    TK.saveFile('trackere-' + TK.date.today() + '.json', text).then(function (ok) {
      if (ok) TK.ui.toast('Copia a fost pregătită pentru salvare.');
      else showCopyFallback(text);
    });
  }

  function showCopyFallback(text) {
    var ta = h('textarea', { class: 'tk-textarea', rows: 8, readonly: true }, text);
    TK.ui.modal({
      title: 'Copiază datele',
      content: h('div', { class: 'tk-stack' },
        h('p', { class: 'tk-muted' }, 'Salvarea fișierului nu este disponibilă aici. Copiază textul și păstrează-l într-un fișier .json.'),
        ta),
      actions: [
        { label: 'Închide', kind: 'ghost' },
        {
          label: 'Copiază', kind: 'primary', onClick: function () {
            var done = function () { TK.ui.toast('Copiat.'); };
            try {
              navigator.clipboard.writeText(text).then(done, function () { ta.select(); });
            } catch (e) { ta.select(); }
            return false;
          },
        },
      ],
    });
  }

  function importAll() {
    TK.pickJSON().then(function (data) {
      if (!data) return;
      if (data.__error) { TK.ui.toast(data.__error); return; }
      if (!data.trackers || typeof data.trackers !== 'object') {
        TK.ui.toast('Fișierul nu este o copie de rezervă a trackerelor.');
        return;
      }
      var isObj = function (v) { return v && typeof v === 'object' && !Array.isArray(v); };
      var valid = registry.filter(function (d) { return isObj(data.trackers[d.id]); });
      var skipped = registry.filter(function (d) { return data.trackers[d.id] != null && !isObj(data.trackers[d.id]); });
      var names = valid.map(function (d) { return d.name; });
      if (!names.length) { TK.ui.toast('Copia nu conține date valide pentru niciun tracker.'); return; }
      TK.ui.confirm({
        title: 'Importi copia?',
        text: 'Se vor înlocui datele actuale din: ' + names.join(', ') + '.' +
          (skipped.length ? ' Datele pentru ' + skipped.map(function (d) { return d.name; }).join(', ') + ' nu sunt valide și vor fi ignorate.' : ''),
        ok: 'Importă',
        danger: true,
      }).then(function (yes) {
        if (!yes) return;
        valid.forEach(function (def) {
          stores[def.id].replace(TK.clone(data.trackers[def.id]));
        });
        TK.ui.toast('Datele au fost importate.');
        route();
      });
    });
  }

  function resetDemo() {
    TK.ui.confirm({
      title: 'Reîncarci datele exemplu?',
      text: 'Toate cele trei trackere vor primi din nou datele exemplu. Datele tale actuale se pierd, așa că exportă mai întâi o copie.',
      ok: 'Reîncarcă exemplele',
      danger: true,
    }).then(function (yes) {
      if (!yes) return;
      registry.forEach(function (def) { stores[def.id].reset(true); });
      TK.ui.toast('Exemplele au fost reîncărcate.');
      route();
    });
  }

  /* ----------------------------------------------------------------- start */

  function boot() {
    // Un tracker care nu-și poate crea datele nu trebuie să le blocheze pe celelalte.
    registry = TK._registry.filter(function (def) {
      try {
        stores[def.id] = new TK.Store(def.id, def);
        return true;
      } catch (e) {
        console.error('Trackerul „' + (def.name || def.id) + '” nu a putut porni:', e);
        return false;
      }
    });
    registry.forEach(function (def) {
      stores[def.id].onReplace(function () {
        // Date noi (alt dispozitiv, import, resetare): redesenăm vederea curentă.
        if (current && (current.slug === def.slug || current.slug === 'acasa')) route();
      });
    });
    TK.stores = stores;
    buildShell();
    window.addEventListener('hashchange', route);
    route();

    TK.capability('db').then(function (db) {
      if (!db) return;
      registry.forEach(function (def) { stores[def.id].attachCloud(db); });
      renderStatus();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
