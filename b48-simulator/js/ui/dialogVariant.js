/**
 * Selectorul variantei de motor (variants.json). Alegerea se salvează local.
 */
import { h, toast } from './dom.js';
import { openModal } from './modal.js';
import { enforceSpecPolicy } from '../core/dataLoader.js';

export function variantLabel(app) {
  const v = app.data.variants?.variants?.find((x) => x.id === app.data.variants?.selected);
  if (!v || v.id === 'demo') return 'generic DEMONSTRATIV';
  return `${v.code || v.id} (valori NEVERIFICATE)`;
}

export async function openVariantDialog(app) {
  const variants = app.data.variants?.variants || [];
  const selected = app.data.variants?.selected || 'demo';
  let choice = selected;
  const list = h('div.variant-list', { role: 'radiogroup', 'aria-label': 'Variante de motor' },
    variants.map((v) => {
      const input = h('input', { type: 'radio', name: 'variant', value: v.id, checked: v.id === selected, onchange: () => { choice = v.id; } });
      return h('label.variant-item', input,
        h('div',
          h('div.variant-code', v.code || v.id, v.status ? h('span.badge.badge-warn', v.status) : null, v.id === 'demo' ? h('span.badge.badge-demo', 'demonstrativ') : null),
          h('div.muted', [v.years ? `Ani: ${v.years}` : null, v.models?.length ? `Modele: ${v.models.join(', ')}` : null].filter(Boolean).join(' · ') || '—'),
          v.note ? h('div.variant-note', v.note) : null));
    }));
  const body = h('div',
    h('p', 'Procedurile detaliate și valorile oficiale (cupluri, toleranțe, ordini de strângere, calare) diferă între variantele B48. Pentru a le putea folosi este necesară identificarea exactă a motorului:'),
    h('ul', h('li', 'codul complet al motorului (ex. de pe bloc / documentele vehiculului);'), h('li', 'anul fabricației;'), h('li', 'modelul vehiculului (seria, codul de șasiu).')),
    h('p.warn-text', 'Alegerea unei variante NU face valorile „verificate”. Ele rămân NEVERIFICATE până la importul documentației oficiale (tabul „Date & Import”) cu document + pagină asociate.'),
    list);
  const m = openModal({ title: 'Alege varianta motorului', size: 'md', body,
    actions: [{ label: 'Renunță', value: null }, { label: 'Salvează alegerea', kind: 'primary', onClick: () => choice }] });
  const res = await m.result;
  if (!res || res === selected) return;
  app.data.variants.selected = res;
  app.storage.set('variant', res);
  app.storage.save();
  enforceSpecPolicy(app.data, res);
  app.header?.updateVariant();
  app.refresh();
  if (res === 'demo') toast('Varianta: generic demonstrativ.', 'info');
  else {
    toast(`Varianta selectată: ${res}. Valorile rămân NEVERIFICATE până la importul documentației.`, 'warn');
    app.notices?.explain('Variantă de motor aleasă', `Ați ales ${res}. Specificațiile din simulator sunt încă demonstrative/NEVERIFICATE. Importați datele din documentația oficială și asociați documentul + pagina pentru fiecare valoare.`, 'warn');
  }
  app.log('info', `Varianta motorului schimbată: ${res}.`);
  const hasVerified = (app.importer.getOverrides().specs || []).some((s) => s.status === 'VERIFICATĂ');
  if (hasVerified) setTimeout(() => location.reload(), 600);
}
