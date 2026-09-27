/*
 * Trackere — grafice SVG fără dependențe.
 * TK.charts.donut / pie / bars / hbars / area / legend
 * Culorile vin din tokenii CSS (--chart-1…8, --chart-plan, --chart-fact, --chart-track …),
 * textul din tokenii de cerneală. Fiecare grafic se redesenează la schimbarea lățimii
 * și are tooltip la hover / atingere (elementele cu atributul data-tip).
 */
(function () {
  'use strict';

  var TK = (window.TK = window.TK || {});
  var fmt = function (v) { return TK.fmt.num(v, 0); };

  function seriesColor(c, i) {
    return c || 'var(--chart-' + ((i % 8) + 1) + ')';
  }

  function attrEsc(s) { return TK.esc(s); }

  function niceStep(range, count) {
    if (!(range > 0)) return 1;
    var raw = range / count;
    var mag = Math.pow(10, Math.floor(Math.log10(raw)));
    var n = raw / mag;
    var step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
    return step * mag;
  }

  function niceScale(max, count) {
    var step = niceStep(max, count || 4);
    var top = Math.max(step, Math.ceil(max / step) * step);
    var ticks = [];
    for (var v = 0; v <= top + step / 2; v += step) ticks.push(v);
    return { max: top, ticks: ticks };
  }

  // Drum pentru o bară verticală cu capătul de sus rotunjit (r px), bază dreaptă.
  function barPathV(x, y, w, h, r) {
    x = +x; y = +y; w = +w; h = +h;
    if (h <= 0) return '';
    r = Math.min(r, w / 2, h);
    return 'M' + x + ',' + (y + h) + 'V' + (y + r) + 'Q' + x + ',' + y + ' ' + (x + r) + ',' + y +
      'H' + (x + w - r) + 'Q' + (x + w) + ',' + y + ' ' + (x + w) + ',' + (y + r) + 'V' + (y + h) + 'Z';
  }
  // Bară orizontală cu capătul din dreapta rotunjit.
  function barPathH(x, y, w, h, r) {
    x = +x; y = +y; w = +w; h = +h;
    if (w <= 0) return '';
    r = Math.min(r, h / 2, w);
    return 'M' + x + ',' + y + 'H' + (x + w - r) + 'Q' + (x + w) + ',' + y + ' ' + (x + w) + ',' + (y + r) +
      'V' + (y + h - r) + 'Q' + (x + w) + ',' + (y + h) + ' ' + (x + w - r) + ',' + (y + h) + 'H' + x + 'Z';
  }

  // Curbă monotonă (Fritsch–Carlson) prin puncte [[x,y],…]
  function monotonePath(pts) {
    var n = pts.length;
    if (n === 0) return '';
    if (n === 1) return 'M' + pts[0][0] + ',' + pts[0][1];
    var dx = [], dy = [], m = [], t = [];
    for (var i = 0; i < n - 1; i++) {
      dx[i] = pts[i + 1][0] - pts[i][0];
      dy[i] = pts[i + 1][1] - pts[i][1];
      m[i] = dy[i] / dx[i];
    }
    t[0] = m[0];
    t[n - 1] = m[n - 2];
    for (i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
    for (i = 0; i < n - 1; i++) {
      if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
      var a = t[i] / m[i], b = t[i + 1] / m[i], s = a * a + b * b;
      if (s > 9) { var k = 3 / Math.sqrt(s); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
    }
    var d = 'M' + pts[0][0] + ',' + pts[0][1];
    for (i = 0; i < n - 1; i++) {
      var h3 = dx[i] / 3;
      d += 'C' + (pts[i][0] + h3) + ',' + (pts[i][1] + t[i] * h3) + ' ' +
        (pts[i + 1][0] - h3) + ',' + (pts[i + 1][1] - t[i + 1] * h3) + ' ' +
        pts[i + 1][0] + ',' + pts[i + 1][1];
    }
    return d;
  }

  /* --------------------------------------------------------------- tooltip */

  var tip;
  function ensureTip() {
    if (!tip) {
      tip = document.createElement('div');
      tip.className = 'tk-tip';
      tip.setAttribute('role', 'tooltip');
      tip.hidden = true;
      document.body.appendChild(tip);
    }
    return tip;
  }
  function showTip(target, x, y) {
    var t = ensureTip();
    t.textContent = '';
    String(target.getAttribute('data-tip')).split('\n').forEach(function (line, i) {
      var row = document.createElement('div');
      if (i === 0) row.className = 'tk-tip__title';
      row.textContent = line;
      t.appendChild(row);
    });
    t.hidden = false;
    var r = t.getBoundingClientRect();
    var left = Math.min(window.innerWidth - r.width - 8, Math.max(8, x + 12));
    var top = y - r.height - 12;
    if (top < 8) top = y + 16;
    t.style.left = left + 'px';
    t.style.top = top + 'px';
  }
  function hideTip() { if (tip) tip.hidden = true; }

  var activeMark = null;
  function markOn(el) {
    if (activeMark === el) return;
    markOff();
    activeMark = el;
    el.classList.add('is-hover');
    var g = el.closest('.tk-chart');
    if (g && el.hasAttribute('data-x')) {
      var line = g.querySelector('.tk-crosshair');
      if (line) {
        line.setAttribute('x1', el.getAttribute('data-x'));
        line.setAttribute('x2', el.getAttribute('data-x'));
        line.style.opacity = 1;
      }
      var dot = g.querySelector('.tk-crossdot');
      if (dot && el.hasAttribute('data-y')) {
        dot.setAttribute('cx', el.getAttribute('data-x'));
        dot.setAttribute('cy', el.getAttribute('data-y'));
        dot.style.opacity = 1;
      }
    }
  }
  function markOff() {
    if (!activeMark) return;
    activeMark.classList.remove('is-hover');
    var g = activeMark.closest('.tk-chart');
    if (g) {
      var line = g.querySelector('.tk-crosshair');
      if (line) line.style.opacity = 0;
      var dot = g.querySelector('.tk-crossdot');
      if (dot) dot.style.opacity = 0;
    }
    activeMark = null;
  }

  document.addEventListener('pointermove', function (e) {
    var el = e.target && e.target.closest ? e.target.closest('.tk-chart [data-tip]') : null;
    if (el) { markOn(el); showTip(el, e.clientX, e.clientY); } else { markOff(); hideTip(); }
  }, { passive: true });
  document.addEventListener('pointerdown', function (e) {
    var el = e.target && e.target.closest ? e.target.closest('.tk-chart [data-tip]') : null;
    if (el) { markOn(el); showTip(el, e.clientX, e.clientY); } else { markOff(); hideTip(); }
  }, { passive: true });
  window.addEventListener('scroll', function () { markOff(); hideTip(); }, { passive: true, capture: true });

  /* ------------------------------------------------------------ montare */

  // Desenează în `el` și redesenează când lățimea se schimbă.
  function mount(el, opts, draw, kind) {
    el.classList.add('tk-chart');
    if (kind) el.classList.add('tk-chart--' + kind);
    var lastW = -1;
    function render() {
      var w = Math.round(el.clientWidth) || opts.width || 480;
      if (w === lastW) return;
      lastW = w;
      el.innerHTML = draw(w);
    }
    render();
    if (el._tkRO) el._tkRO.disconnect();
    if (typeof ResizeObserver !== 'undefined') {
      el._tkRO = new ResizeObserver(function () { render(); });
      el._tkRO.observe(el);
    }
    return el;
  }

  function svgOpen(w, h, label) {
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h +
      '" role="img" aria-label="' + attrEsc(label || 'Grafic') + '" preserveAspectRatio="xMinYMin meet">';
  }

  function legendHTML(items) {
    return '<div class="tk-legend">' + items.map(function (it) {
      return '<span class="tk-legend__item"><span class="tk-swatch" style="background:' + it.color + '"></span>' +
        attrEsc(it.label) + (it.value != null ? ' <span class="tk-muted">' + attrEsc(it.value) + '</span>' : '') + '</span>';
    }).join('') + '</div>';
  }

  /* ---------------------------------------------------------------- donut */

  /*
   * Inel de progres.
   * opts: {value: 0..1 (sau value + max), top: 'PROGRES', main: '81,7%' (implicit procentul),
   *        sub: '304 / 372', color, size: 150, thickness: 14, label}
   */
  function donut(el, opts) {
    opts = opts || {};
    var ratio = opts.max != null ? TK.ratio(opts.value, opts.max) : (opts.value || 0);
    ratio = Math.max(0, ratio);
    var main = opts.main != null ? opts.main : TK.fmt.pct(ratio, 1);
    var label = opts.label || ((opts.top ? opts.top + ': ' : '') + main + (opts.sub ? ' (' + opts.sub + ')' : ''));
    return mount(el, opts, function (w) {
      var size = Math.min(opts.size || 150, w);
      var th = opts.thickness || Math.max(10, Math.round(size * 0.1));
      var r = (size - th) / 2, c = size / 2, circ = 2 * Math.PI * r;
      var shown = Math.min(ratio, 1);
      var s = svgOpen(size, size, label);
      s += '<circle cx="' + c + '" cy="' + c + '" r="' + r + '" style="fill:none;stroke:var(--chart-track)" stroke-width="' + th + '"/>';
      if (shown > 0) {
        s += '<circle cx="' + c + '" cy="' + c + '" r="' + r + '" style="fill:none;stroke:' + (opts.color || 'var(--chart-plan)') +
          '" stroke-width="' + th + '" stroke-dasharray="' + (circ * shown).toFixed(2) + ' ' + circ.toFixed(2) +
          '" transform="rotate(-90 ' + c + ' ' + c + ')" data-tip="' + attrEsc(label) + '"/>';
      }
      var inner = size - 2 * th;
      // textul central se micșorează ca să nu atingă inelul
      var fs = Math.min(Math.round(size * 0.14), Math.floor(inner * 0.8 / (Math.max(4, String(main).length) * 0.56)));
      var hasTop = !!opts.top, hasSub = !!opts.sub;
      var y = c + fs * 0.35 + (hasTop && !hasSub ? fs * 0.35 : 0) - (hasSub && !hasTop ? fs * 0.3 : 0);
      if (hasTop) {
        s += '<text x="' + c + '" y="' + (y - fs * 1.05) + '" text-anchor="middle" class="tk-chart__cap" style="fill:var(--ink-3);font-size:' +
          Math.max(8, Math.round(size * 0.06)) + 'px;letter-spacing:.08em">' + attrEsc(String(opts.top).toUpperCase()) + '</text>';
      }
      s += '<text x="' + c + '" y="' + y + '" text-anchor="middle" class="tk-chart__big" style="fill:' + (opts.mainColor || 'var(--terra)') +
        ';font-size:' + fs + 'px;font-weight:600">' + attrEsc(main) + '</text>';
      if (hasSub) {
        s += '<text x="' + c + '" y="' + (y + fs * 1.1) + '" text-anchor="middle" style="fill:var(--ink-2);font-size:' +
          Math.max(9, Math.round(size * 0.075)) + 'px">' + attrEsc(opts.sub) + '</text>';
      }
      return '<div class="tk-chart__center">' + s + '</svg></div>';
    }, 'donut');
  }

  /* ------------------------------------------------------------------ pie */

  /*
   * Plăcintă / inel pe categorii.
   * opts: {data: [{label, value, color}], hole: 0..0.8 (0 = plăcintă), format(v), legend: true|false,
   *        legendValues: true, size: 170, label, center: 'text în gol'}
   */
  function pie(el, opts) {
    opts = opts || {};
    var f = opts.format || fmt;
    var data = (opts.data || []).filter(function (d) { return d.value > 0; });
    var total = TK.sum(data, function (d) { return d.value; });
    return mount(el, opts, function (w) {
      var stack = w < 360 || opts.legendBelow;
      var size = Math.min(opts.size || 170, stack ? w : w * 0.5);
      var r = size / 2 - 2, c = size / 2, hole = (opts.hole || 0) * r;
      var s = svgOpen(size, size, opts.label || 'Distribuție');
      if (!total) {
        s += '<circle cx="' + c + '" cy="' + c + '" r="' + r + '" style="fill:var(--chart-track)"/>';
        s += '<text x="' + c + '" y="' + (c + 4) + '" text-anchor="middle" style="fill:var(--ink-3);font-size:12px">Fără date</text>';
      } else if (data.length === 1) {
        var d0 = data[0], col0 = seriesColor(d0.color, 0);
        s += '<circle cx="' + c + '" cy="' + c + '" r="' + r + '" style="fill:' + col0 + '" data-tip="' +
          attrEsc(d0.label + '\n' + f(d0.value) + ' · 100%') + '"/>';
      } else {
        var a0 = -Math.PI / 2;
        data.forEach(function (d, i) {
          var a1 = a0 + (d.value / total) * Math.PI * 2;
          var large = a1 - a0 > Math.PI ? 1 : 0;
          var x0 = c + r * Math.cos(a0), y0 = c + r * Math.sin(a0);
          var x1 = c + r * Math.cos(a1), y1 = c + r * Math.sin(a1);
          var path = 'M' + c + ',' + c + 'L' + x0.toFixed(2) + ',' + y0.toFixed(2) + 'A' + r + ',' + r + ' 0 ' + large + ' 1 ' + x1.toFixed(2) + ',' + y1.toFixed(2) + 'Z';
          s += '<path d="' + path + '" style="fill:' + seriesColor(d.color, i) + ';stroke:var(--surface)" stroke-width="2" stroke-linejoin="round" data-tip="' +
            attrEsc(d.label + '\n' + f(d.value) + ' · ' + TK.fmt.pct(d.value / total, 1)) + '"/>';
          a0 = a1;
        });
      }
      if (hole > 0) {
        s += '<circle cx="' + c + '" cy="' + c + '" r="' + hole + '" style="fill:var(--surface)"/>';
        if (opts.center) {
          s += '<text x="' + c + '" y="' + (c + 5) + '" text-anchor="middle" style="fill:var(--ink);font-size:' + Math.round(size * 0.1) + 'px;font-weight:600">' + attrEsc(opts.center) + '</text>';
        }
      }
      s += '</svg>';
      var legend = opts.legend === false ? '' : legendHTML(data.map(function (d, i) {
        return {
          label: d.label,
          color: seriesColor(d.color, i),
          value: opts.legendValues === false ? null : TK.fmt.pct(d.value / total, 1),
        };
      }));
      return '<div class="tk-chart__pie' + (stack ? ' is-stacked' : '') + '">' + s + legend + '</div>';
    }, 'pie');
  }

  /* ----------------------------------------------------------------- bars */

  /*
   * Bare verticale grupate.
   * opts: {labels: [...], series: [{name, values: [...], color}], height: 200, format(v),
   *        yFormat(v), yMax, axis: true, valueLabels: false, sublabels: [...] (rând sub etichete),
   *        colorFn(value, index, seriesIndex) -> culoare, legend: auto, label}
   */
  function bars(el, opts) {
    opts = opts || {};
    var f = opts.format || fmt;
    var yf = opts.yFormat || TK.fmt.leiShort;
    var labels = opts.labels || [];
    var series = opts.series || [];
    var multi = series.length > 1;
    return mount(el, opts, function (w) {
      var H = opts.height || 200;
      var axis = opts.axis !== false;
      var subH = opts.sublabels ? 14 : 0;
      var m = { l: axis ? 44 : 4, r: 4, t: opts.valueLabels ? 16 : 8, b: 18 + subH };
      var pw = Math.max(10, w - m.l - m.r), ph = H - m.t - m.b;
      var max = opts.yMax || 0;
      series.forEach(function (s) { s.values.forEach(function (v) { if (v > max) max = v; }); });
      var scale = niceScale(max || 1, 4);
      if (opts.yMax) scale = { max: opts.yMax, ticks: opts.yTicks || [0, opts.yMax / 2, opts.yMax] };
      var n = labels.length || 1;
      var band = pw / n;
      var groupW = band * (n > 20 ? 0.72 : 0.64);
      var gap = multi ? 2 : 0;
      var bw = Math.max(1, (groupW - gap * (series.length - 1)) / Math.max(1, series.length));
      var y = function (v) { return m.t + ph - (Math.max(0, v) / scale.max) * ph; };
      var s = svgOpen(w, H, opts.label || 'Grafic cu bare');
      if (axis) {
        scale.ticks.forEach(function (t) {
          var yy = y(t).toFixed(1);
          s += '<line x1="' + m.l + '" x2="' + (w - m.r) + '" y1="' + yy + '" y2="' + yy + '" style="stroke:var(--chart-grid)" stroke-width="1"/>';
          s += '<text x="' + (m.l - 6) + '" y="' + (+yy + 3) + '" text-anchor="end" style="fill:var(--ink-3);font-size:10px">' + attrEsc(yf(t)) + '</text>';
        });
      } else {
        s += '<line x1="' + m.l + '" x2="' + (w - m.r) + '" y1="' + (m.t + ph) + '" y2="' + (m.t + ph) + '" style="stroke:var(--chart-grid)" stroke-width="1"/>';
      }
      var every = Math.max(1, Math.ceil(n / Math.floor(pw / 22)));
      labels.forEach(function (lab, i) {
        var gx = m.l + band * i + (band - groupW) / 2;
        series.forEach(function (se, si) {
          var v = se.values[i] || 0;
          var x = gx + si * (bw + gap);
          var col = (opts.colorFn && opts.colorFn(v, i, si)) || seriesColor(se.color, si);
          var yy = y(v), hh = m.t + ph - yy;
          var tipTxt = (lab != null ? lab : '') + (opts.tipTitle ? opts.tipTitle(i) : '') + '\n' + (multi ? se.name + ': ' : '') + f(v);
          if (hh > 0.5) {
            s += '<path d="' + barPathV(x.toFixed(2), yy.toFixed(2), bw.toFixed(2), hh.toFixed(2), Math.min(4, bw / 2)) + '" style="fill:' + col + '"/>';
          }
          // zonă de hover mai mare decât bara
          s += '<rect x="' + x.toFixed(2) + '" y="' + m.t + '" width="' + bw.toFixed(2) + '" height="' + ph + '" style="fill:transparent" data-tip="' + attrEsc(tipTxt) + '"/>';
          if (opts.valueLabels && !multi) {
            s += '<text x="' + (x + bw / 2).toFixed(2) + '" y="' + (yy - 4).toFixed(2) + '" text-anchor="middle" style="fill:var(--ink-2);font-size:10px">' + attrEsc(f(v)) + '</text>';
          }
        });
        if (i % every === 0) {
          s += '<text x="' + (m.l + band * i + band / 2).toFixed(2) + '" y="' + (m.t + ph + 13) + '" text-anchor="middle" style="fill:var(--ink-3);font-size:10px">' + attrEsc(lab) + '</text>';
          if (opts.sublabels) {
            s += '<text x="' + (m.l + band * i + band / 2).toFixed(2) + '" y="' + (m.t + ph + 13 + subH) + '" text-anchor="middle" style="fill:var(--terra);font-size:9px">' + attrEsc(opts.sublabels[i]) + '</text>';
          }
        }
      });
      s += '</svg>';
      var legend = (opts.legend === true || (opts.legend !== false && multi))
        ? legendHTML(series.map(function (se, i) { return { label: se.name, color: seriesColor(se.color, i) }; }))
        : '';
      return legend + s;
    }, 'bars');
  }

  /* ---------------------------------------------------------------- hbars */

  /*
   * Bare orizontale grupate (ex. flux de numerar Plan vs Fapt).
   * opts: {labels, series: [{name, values, color}], format(v), xFormat(v), labelWidth, rowHeight, label}
   */
  function hbars(el, opts) {
    opts = opts || {};
    var f = opts.format || fmt;
    var xf = opts.xFormat || TK.fmt.leiShort;
    var labels = opts.labels || [];
    var series = opts.series || [];
    return mount(el, opts, function (w) {
      var lw = Math.min(opts.labelWidth || 104, Math.round(w * 0.36));
      var barH = opts.barHeight || 8, gap = 2;
      var rowH = opts.rowHeight || Math.max(24, series.length * (barH + gap) + 12);
      var m = { l: lw, r: 26, t: 4, b: 20 };
      var H = m.t + m.b + rowH * labels.length;
      var pw = Math.max(10, w - m.l - m.r);
      var max = 0;
      series.forEach(function (s) { s.values.forEach(function (v) { if (v > max) max = v; }); });
      var scale = niceScale(max || 1, w < 420 ? 2 : 4);
      var x = function (v) { return m.l + (Math.max(0, v) / scale.max) * pw; };
      var s = svgOpen(w, H, opts.label || 'Grafic cu bare orizontale');
      scale.ticks.forEach(function (t) {
        var xx = x(t).toFixed(1);
        s += '<line x1="' + xx + '" x2="' + xx + '" y1="' + m.t + '" y2="' + (H - m.b) + '" style="stroke:var(--chart-grid)" stroke-width="1"/>';
        s += '<text x="' + xx + '" y="' + (H - 6) + '" text-anchor="middle" style="fill:var(--ink-3);font-size:10px">' + attrEsc(xf(t)) + '</text>';
      });
      labels.forEach(function (lab, i) {
        var top = m.t + rowH * i;
        var blockH = series.length * barH + (series.length - 1) * gap;
        var by = top + (rowH - blockH) / 2;
        s += '<text x="' + (m.l - 8) + '" y="' + (top + rowH / 2 + 3.5).toFixed(1) + '" text-anchor="end" style="fill:var(--ink-2);font-size:11px">' + attrEsc(lab) + '</text>';
        var tipLines = [lab];
        series.forEach(function (se, si) { tipLines.push(se.name + ': ' + f(se.values[i] || 0)); });
        series.forEach(function (se, si) {
          var v = se.values[i] || 0;
          var yy = by + si * (barH + gap);
          var ww = x(v) - m.l;
          if (ww > 0.5) {
            s += '<path d="' + barPathH(m.l, yy.toFixed(2), ww.toFixed(2), barH, Math.min(4, barH / 2)) + '" style="fill:' + seriesColor(se.color, si) + '"/>';
          }
        });
        s += '<rect x="0" y="' + top + '" width="' + w + '" height="' + rowH + '" style="fill:transparent" data-tip="' + attrEsc(tipLines.join('\n')) + '"/>';
      });
      s += '</svg>';
      var legend = opts.legend === false ? '' : legendHTML(series.map(function (se, i) { return { label: se.name, color: seriesColor(se.color, i) }; }));
      return legend + s;
    }, 'hbars');
  }

  /* ----------------------------------------------------------------- area */

  /*
   * Curbă cu arie (dinamică pe zile).
   * opts: {labels, values (null = lipsă), max: 1, height: 150, format(v), color, fill, tips: [...] (text tooltip per punct), label}
   */
  function area(el, opts) {
    opts = opts || {};
    var f = opts.format || function (v) { return TK.fmt.pct(v, 0); };
    var labels = opts.labels || [];
    var values = opts.values || [];
    return mount(el, opts, function (w) {
      var H = opts.height || 150;
      var m = { l: 4, r: 4, t: 10, b: opts.axisLabels === false ? 6 : 18 };
      var pw = Math.max(10, w - m.l - m.r), ph = H - m.t - m.b;
      var n = values.length;
      var max = opts.max != null ? opts.max : Math.max.apply(null, values.filter(function (v) { return v != null; }).concat([1]));
      var band = pw / Math.max(1, n);
      var X = function (i) { return m.l + band * i + band / 2; };
      var Y = function (v) { return m.t + ph - (Math.min(max, Math.max(0, v)) / (max || 1)) * ph; };
      var pts = [];
      values.forEach(function (v, i) { if (v != null) pts.push([+X(i).toFixed(2), +Y(v).toFixed(2)]); });
      var col = opts.color || 'var(--chart-fact)';
      var s = svgOpen(w, H, opts.label || 'Dinamică');
      s += '<line x1="' + m.l + '" x2="' + (w - m.r) + '" y1="' + (m.t + ph) + '" y2="' + (m.t + ph) + '" style="stroke:var(--chart-grid)" stroke-width="1"/>';
      if (pts.length > 1) {
        var line = monotonePath(pts);
        var areaPath = line + 'L' + pts[pts.length - 1][0] + ',' + (m.t + ph) + 'L' + pts[0][0] + ',' + (m.t + ph) + 'Z';
        s += '<path d="' + areaPath + '" style="fill:' + (opts.fill || 'var(--rose-soft)') + '"/>';
        s += '<path d="' + line + '" style="fill:none;stroke:' + col + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>';
      } else if (pts.length === 1) {
        s += '<circle cx="' + pts[0][0] + '" cy="' + pts[0][1] + '" r="4" style="fill:' + col + '"/>';
      }
      s += '<line class="tk-crosshair" x1="0" x2="0" y1="' + m.t + '" y2="' + (m.t + ph) + '" style="stroke:var(--ink-3);opacity:0" stroke-width="1" stroke-dasharray="3 3"/>';
      s += '<circle class="tk-crossdot" cx="0" cy="0" r="4.5" style="fill:' + col + ';stroke:var(--surface);opacity:0" stroke-width="2"/>';
      var every = Math.max(1, Math.ceil(n / Math.floor(pw / 22)));
      values.forEach(function (v, i) {
        var tipTxt = (opts.tips && opts.tips[i]) || (String(labels[i] != null ? labels[i] : i + 1) + '\n' + (v == null ? '—' : f(v)));
        s += '<rect x="' + (m.l + band * i).toFixed(2) + '" y="' + m.t + '" width="' + band.toFixed(2) + '" height="' + ph +
          '" style="fill:transparent" data-x="' + X(i).toFixed(2) + '"' + (v != null ? ' data-y="' + Y(v).toFixed(2) + '"' : '') + ' data-tip="' + attrEsc(tipTxt) + '"/>';
        if (opts.axisLabels !== false && i % every === 0) {
          s += '<text x="' + X(i).toFixed(2) + '" y="' + (H - 5) + '" text-anchor="middle" style="fill:var(--ink-3);font-size:10px">' + attrEsc(labels[i]) + '</text>';
        }
      });
      return s + '</svg>';
    }, 'area');
  }

  /* --------------------------------------------------------------- legend */

  // Legendă HTML de sine stătătoare: TK.charts.legend([{label, color, value}]) -> Node
  function legend(items) {
    var wrap = document.createElement('div');
    wrap.innerHTML = legendHTML(items.map(function (it, i) {
      return { label: it.label, color: seriesColor(it.color, i), value: it.value };
    }));
    return wrap.firstChild;
  }

  TK.charts = {
    donut: donut,
    pie: pie,
    bars: bars,
    hbars: hbars,
    area: area,
    legend: legend,
    color: seriesColor,
    niceScale: niceScale,
  };
})();
