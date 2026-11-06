/**
 * Dialoguri modale accesibile: Escape închide, focus în dialog, focusul revine la închidere.
 */
import { h } from './dom.js';

const stack = [];

document.addEventListener('keydown', (e) => {
  const top = stack[stack.length - 1];
  if (!top) return;
  if (e.key === 'Escape' && top.dismissable) { e.preventDefault(); top.close(null); }
  if (e.key === 'Tab') {
    const f = [...top.el.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
      .filter((x) => !x.disabled && x.offsetParent !== null);
    if (!f.length) return;
    const first = f[0]; const last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});

/**
 * @param {object} o
 * @param {string} o.title
 * @param {Node|string} o.body
 * @param {Array<{label, kind?, onClick?, autofocus?, id?}>} o.actions onClick(close) — întoarce false ca să rămână deschis
 * @param {'sm'|'md'|'lg'} o.size
 * @returns {{ el, body, footer, close(result), result: Promise }}
 */
export function openModal({ title, body, actions = [{ label: 'Închide', kind: 'primary' }], size = 'md', dismissable = true, onClose, className = '' } = {}) {
  const prevFocus = document.activeElement;
  const titleId = `dlg-title-${Math.random().toString(36).slice(2, 8)}`;
  let resolveFn;
  const result = new Promise((r) => { resolveFn = r; });
  const bodyEl = h('div.modal-body', typeof body === 'string' ? h('p', body) : body);
  const footer = h('div.modal-footer');
  const closeBtn = dismissable ? h('button.icon-btn.modal-x', { 'aria-label': 'Închide dialogul', onclick: () => api.close(null) }, '×') : null;
  const dialog = h(`div.modal.modal-${size}${className ? '.' + className : ''}`, { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId },
    h('div.modal-head', h('h2', { id: titleId }, title), closeBtn), bodyEl, footer);
  const backdrop = h('div.modal-backdrop', dialog);
  backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop && dismissable) api.close(null); });

  const api = {
    el: dialog, body: bodyEl, footer, dismissable, result, closed: false,
    close(value) {
      if (api.closed) return;
      api.closed = true;
      const i = stack.indexOf(api);
      if (i >= 0) stack.splice(i, 1);
      backdrop.classList.add('leaving');
      setTimeout(() => backdrop.remove(), 150);
      try { onClose?.(value); } catch (err) { console.error(err); }
      resolveFn(value);
      if (prevFocus && typeof prevFocus.focus === 'function' && document.contains(prevFocus)) prevFocus.focus();
    },
    setActions(list) {
      footer.replaceChildren();
      for (const a of list) {
        const b = h(`button.btn${a.kind ? '.btn-' + a.kind : ''}`, { type: 'button', id: a.id, disabled: a.disabled },
          a.label);
        b.addEventListener('click', async () => {
          const hasValue = Object.prototype.hasOwnProperty.call(a, 'value');
          if (!a.onClick) { api.close(hasValue ? a.value : a.label); return; }
          const r = await a.onClick(api);
          if (r !== false) api.close(hasValue ? a.value : (r ?? a.label));
        });
        footer.appendChild(b);
        if (a.autofocus) setTimeout(() => b.focus(), 30);
      }
    }
  };
  api.setActions(actions);
  stack.push(api);
  (document.getElementById('modal-root') || document.body).appendChild(backdrop);
  setTimeout(() => {
    if (dialog.contains(document.activeElement)) return;
    const f = dialog.querySelector('[autofocus], .modal-body input, .modal-body select, .modal-footer .btn-primary, .modal-footer button');
    (f || dialog).focus?.();
  }, 40);
  dialog.tabIndex = -1;
  return api;
}

export function confirmDialog(title, message, { okLabel = 'Confirm', cancelLabel = 'Renunță', danger = false } = {}) {
  const m = openModal({
    title, body: typeof message === 'string' ? h('p', message) : message, size: 'sm',
    actions: [
      { label: cancelLabel, value: false },
      { label: okLabel, kind: danger ? 'danger' : 'primary', value: true, autofocus: true }
    ]
  });
  return m.result.then((v) => v === true);
}

/** Alegere între mai multe opțiuni: choices = [{ label, value, kind }] → valoarea aleasă sau null */
export function choiceDialog(title, message, choices) {
  const m = openModal({ title, body: typeof message === 'string' ? h('p', message) : message, size: 'sm',
    actions: choices.map((c) => ({ label: c.label, kind: c.kind, value: c.value })) });
  return m.result;
}

/** Prompt text simplu. */
export function promptDialog(title, label, { value = '', placeholder = '', okLabel = 'OK', maxLength = 40 } = {}) {
  const input = h('input.input', { type: 'text', value, placeholder, maxLength, 'aria-label': label });
  const m = openModal({
    title, size: 'sm', body: h('label.field', h('span', label), input),
    actions: [{ label: 'Renunță', value: null }, { label: okLabel, kind: 'primary', onClick: () => input.value.trim() || false }]
  });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && input.value.trim()) m.close(input.value.trim()); });
  setTimeout(() => input.focus(), 50);
  return m.result;
}

export function anyModalOpen() { return stack.length > 0; }
