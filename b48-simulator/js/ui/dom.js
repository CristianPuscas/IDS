/**
 * Utilitare DOM mici: creare elemente, notificări (toast), formatare.
 */

/**
 * h('button.btn.primary', { onclick, 'aria-label': '…' }, 'Text', child…)
 * Atribute speciale: class, dataset (obiect), style (obiect sau text), on* (funcții), html (innerHTML — doar text sigur).
 */
export function h(tag, attrs = {}, ...children) {
  const m = /^([a-z0-9-]+)?((?:[.#][\w-]+)*)$/i.exec(tag) || [];
  const el = document.createElement(m[1] || 'div');
  for (const tok of (m[2] || '').match(/[.#][\w-]+/g) || []) {
    if (tok[0] === '.') el.classList.add(tok.slice(1)); else el.id = tok.slice(1);
  }
  if (attrs == null || typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs)) {
    children.unshift(attrs);
    attrs = {};
  }
  let deferredValue;
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'value') deferredValue = v;
    else if (k === 'class') el.className += (el.className ? ' ' : '') + v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'style' && typeof v === 'object') { for (const [sk, sv] of Object.entries(v)) { if (sk.startsWith('--')) el.style.setProperty(sk, sv); else el.style[sk] = sv; } }
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k in el && typeof v !== 'string' && k !== 'list') el[k] = v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  append(el, children);
  if (deferredValue !== undefined) el.value = deferredValue;
  return el;
}

export function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export function clear(el) { while (el && el.firstChild) el.removeChild(el.firstChild); return el; }

export function fmtTime(t = Date.now()) {
  const d = new Date(t);
  return d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
export function fmtDate(t) {
  try { return new Date(t).toLocaleString('ro-RO', { dateStyle: 'short', timeStyle: 'short' }); } catch { return String(t); }
}
export function fmtDuration(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
export function fmtBytes(n) {
  if (!Number.isFinite(n)) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
export function fmtLei(n) {
  return `${Math.round(Number(n) || 0).toLocaleString('ro-RO')} lei`;
}

/** Badge mic. kind: info | warn | danger | ok | demo | muted */
export function badge(text, kind = 'info', title = '') {
  return h(`span.badge.badge-${kind}`, title ? { title } : {}, text);
}

let toastRoot = null;
/** Notificare temporară. level: info | success | warn | error */
export function toast(message, level = 'info', { details = [], timeout } = {}) {
  if (!toastRoot) toastRoot = document.getElementById('toasts');
  if (!toastRoot) { console.log(`[${level}] ${message}`); return; }
  const icons = { info: 'ℹ', success: '✔', warn: '⚠', error: '✖' };
  const el = h(`div.toast.toast-${level}`, { role: level === 'error' ? 'alert' : 'status' },
    h('span.toast-icon', { 'aria-hidden': 'true' }, icons[level] || 'ℹ'),
    h('div.toast-body', h('div.toast-msg', message),
      details && details.length ? h('ul.toast-details', details.slice(0, 6).map((d) => h('li', d))) : null),
    h('button.toast-close', { 'aria-label': 'Închide notificarea', onclick: () => el.remove() }, '×'));
  toastRoot.appendChild(el);
  while (toastRoot.children.length > 5) toastRoot.firstChild.remove();
  const ms = timeout ?? (level === 'error' ? 8000 : level === 'warn' ? 6000 : 3500);
  setTimeout(() => { el.classList.add('leaving'); setTimeout(() => el.remove(), 300); }, ms);
}

/** Debounce pe animation frame. */
export function rafThrottle(fn) {
  let pending = false;
  return (...args) => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; fn(...args); });
  };
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
