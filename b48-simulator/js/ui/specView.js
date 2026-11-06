/**
 * Afișarea specificațiilor tehnice cu insignele obligatorii de status (NEVERIFICATĂ / valoare demonstrativă / VERIFICATĂ)
 * și sursa. Politica: o valoare nu e niciodată prezentată ca oficială fără document + pagină + variantă potrivită.
 */
import { h, badge, toast } from './dom.js';

export function effectiveStatus(spec, selectedVariant) {
  if (!spec) return 'NEVERIFICATĂ';
  if (spec.status !== 'VERIFICATĂ') return 'NEVERIFICATĂ';
  if (!selectedVariant || selectedVariant === 'demo' || spec.variant !== selectedVariant) return 'NEVERIFICATĂ';
  const src = spec.source || {};
  if (!src.document || src.page == null) return 'NEVERIFICATĂ';
  return 'VERIFICATĂ';
}

const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
const fmt = (v) => (v == null ? '—' : String(v).replace('.', ','));

export function formatSpecValue(spec) {
  if (!spec) return '—';
  const u = spec.unit ? ` ${spec.unit}` : '';
  const range = num(spec.min) != null || num(spec.max) != null ? ` (acceptat ${fmt(spec.min)} … ${fmt(spec.max)}${u})` : '';
  switch (spec.type) {
    case 'torque': {
      const angle = num(spec.angle) ? ` + ${spec.angle}°` : '';
      return `${fmt(spec.value)}${u || ' Nm'}${angle}${range}`;
    }
    case 'sequence':
      return Array.isArray(spec.order) && spec.order.length ? `Ordine: ${spec.order.join(' → ')}` : 'Ordine nedefinită';
    case 'dimension': case 'pressure': case 'volume':
      return `${fmt(spec.value)}${u}${range}`;
    default:
      return spec.value != null ? `${spec.value}${u}` : (spec.note || '—');
  }
}

export function statusBadges(spec, selectedVariant) {
  const st = effectiveStatus(spec, selectedVariant);
  const out = [];
  if (st === 'VERIFICATĂ') out.push(badge('VERIFICATĂ', 'ok', `Verificată pentru varianta ${spec.variant}`));
  else out.push(badge('NEVERIFICATĂ', 'warn', 'Valoare neconfirmată dintr-un document oficial pentru varianta selectată. Nu se folosește pe un motor real.'));
  if (spec?.demo) out.push(badge('valoare demonstrativă', 'demo', 'Valoare inventată doar pentru funcționarea simulatorului.'));
  return out;
}

export function sourceText(spec) {
  const s = spec?.source || {};
  if (!s.document && !s.url) return 'Sursă: — (nicio sursă oficială identificată)';
  return `Sursă: ${[s.document, s.section && `secț. ${s.section}`, s.page != null && `p. ${s.page}`].filter(Boolean).join(', ')}${s.url ? ` — ${s.url}` : ''}`;
}

/** Afișează legătura către documentul din bibliotecă (dacă există). */
export function linkView(app, kind, id) {
  const link = app.importer?.getLink(kind, id);
  if (!link) return null;
  const doc = app.importer.listPdfs().find((p) => p.id === link.docId);
  const label = `📄 ${doc ? doc.name : 'document lipsă'}${link.page ? `, p. ${link.page}` : ''}${link.section ? `, ${link.section}` : ''}`;
  return h('div.spec-link', h('span', label),
    doc ? h('button.btn.btn-xs', { type: 'button', 'aria-label': `Deschide documentul ${doc.name}`,
      onclick: () => app.importer.openPdf(doc.id, link.page).catch((e) => toast(e.message, 'error')) }, 'Deschide') : null);
}

/**
 * Card de specificație.
 * @param {object} spec
 * @param {object} app
 * @param {{ hideValue?: boolean, compact?: boolean }} opts
 */
export function renderSpec(spec, app, { hideValue = false, compact = false } = {}) {
  if (!spec) return h('div.spec.spec-missing', 'Fără specificație.');
  const selected = app.data?.variants?.selected;
  return h('div.spec',
    h('div.spec-head', h('span.spec-name', spec.name || spec.id), h('span.spec-badges', statusBadges(spec, selected))),
    h('div.spec-value', hideValue ? h('em', 'Valoare ascunsă în modul Examen') : formatSpecValue(spec)),
    compact ? null : h('div.spec-meta', sourceText(spec)),
    !compact && spec.note ? h('div.spec-note', spec.note) : null,
    !compact && spec.statusNote ? h('div.spec-note.warn-text', spec.statusNote) : null,
    linkView(app, 'spec', spec.id));
}
